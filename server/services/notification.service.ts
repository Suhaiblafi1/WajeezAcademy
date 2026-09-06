/* خدمة الإشعارات — داخل المنصة فعالة الآن؛ البريد وWhatsApp وSMS تنتظر مزودا.
   لا إرسال حقيقي في التطوير أبدا: القنوات الخارجية تُسجل «فشل: لا مزود» وتعاد المحاولة.
   كل نجاح وفشل ومحاولة موثقة في سجل الإشعار نفسه. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { getEmailConfig, type EmailConfig } from './integrations.service'
import { sendEmail } from './mail'
import { categoryForTemplate } from '../../src/application/notifications/categories'

/* لأيّ بوابةٍ الإشعار — جرسُ كلٍّ يعرض جمهورَه وحده.

   والثلاثة هي البوابات التي تُنتِج إشعارا فعلا: بوابة المتعلّم، وبوابة
   المدرّب (كشوف المستحقّات)، وبوابات العمل الإداريّة. وبوابة المستشار
   تقرأ `staff` لأنّها بوابة عملٍ لا تعلُّم — ولا يُنتَج لها اليوم شيء. */
export type NotificationAudience = 'learner' | 'trainer' | 'staff'

export const NOTIFICATION_AUDIENCES: readonly NotificationAudience[] = ['learner', 'trainer', 'staff']

export interface NotificationPayload {
  userId: string
  channel: 'in_app' | 'email' | 'whatsapp' | 'sms'
  title: string
  body: string
  templateKey?: string
  data?: Record<string, unknown>
  /** الافتراضي `learner`: السهو يُبقي الإشعار حيث يراه صاحبه لا حيث يختفي */
  audience?: NotificationAudience
}

export interface NotificationProvider {
  readonly channel: string
  send(payload: NotificationPayload): Promise<{ ok: boolean; error?: string }>
}

/** مزود داخل المنصة — الكتابة في جدول الإشعارات هي الإرسال نفسه */
export class InAppProvider implements NotificationProvider {
  readonly channel = 'in_app'
  async send(): Promise<{ ok: boolean }> {
    return { ok: true }
  }
}

/** مزود خارجي غير مربوط — يفشل بأمان ويسجل السبب بدل إرسال حقيقي */
export class UnwiredExternalProvider implements NotificationProvider {
  readonly channel: string
  constructor(channel: 'email' | 'whatsapp' | 'sms') {
    this.channel = channel
  }
  async send(): Promise<{ ok: boolean; error: string }> {
    return { ok: false, error: `لا مزود مربوطا لقناة ${this.channel} — يُفعَّل من إعدادات التكامل بعد قرار المالك` }
  }
}

/** مزود البريد الحقيقي — Resend عبر إعدادات التكامل؛ يُرسل لبريد المستخدم المسجل */
export class ResendEmailProvider implements NotificationProvider {
  readonly channel = 'email'
  private config: EmailConfig
  private toEmail: string
  constructor(config: EmailConfig, toEmail: string) {
    this.config = config
    this.toEmail = toEmail
  }
  async send(payload: NotificationPayload): Promise<{ ok: boolean; error?: string }> {
    return sendEmail(this.config, { to: this.toEmail, subject: payload.title, text: payload.body })
  }
}

/* ─── بريد مباشر لعنوان بلا حساب ───

   NotificationService.notify يشترط userId — كل إشعار مرتبط بصف User. وهذا صحيح
   لمن عنده حساب، لكنه أغلق البابَ على الحالتين اللتين لا حساب فيهما أصلا:
   رمز تحقق بريد المتقدم للتدريب، ودعوة إنشاء الحساب بعد اعتماده. فلم يكن في
   الشيفرة كلها نداءٌ واحد يستطيع مراسلة عنوان لا يملك صفا في User — وكان الرمز
   يُعاد في التطوير فقط، فالمتقدم في الإنتاج يقف عند «بانتظار تحقق البريد» أبدا.

   لا يُنشئ صف Notification: لا مالك له. والمُنادي هو من يسجّل الأثر ويقرر ماذا
   يفعل عند تعذّر الإرسال — ولا يُبتلع الفشل صامتا. */
export type DirectMailStatus = 'sent' | 'not_configured' | 'failed'
export interface DirectMailResult {
  status: DirectMailStatus
  error?: string
}

export async function sendDirectEmail(
  prisma: PrismaClient,
  input: { to: string; subject: string; text: string; icsContent?: string; icsFilename?: string },
): Promise<DirectMailResult> {
  try {
    const config = await getEmailConfig(prisma)
    if (!config.enabled || !config.apiKey || !config.fromEmail) return { status: 'not_configured' }
    const res = await sendEmail(config, input)
    return res.ok ? { status: 'sent' } : { status: 'failed', error: res.error }
  } catch (e) {
    return { status: 'failed', error: e instanceof Error ? e.message : String(e) }
  }
}

/** أصل الموقع العام لبناء الروابط في الرسائل.

    APP_URL إلزاميٌّ على Cloudways (`docs/DEPLOYMENT.md`)، والمحلّيُّ احتياطيٌّ
    للتطوير وحده. وبلا هذا الاحتياطي كانت روابط تأكيد البريد ودعوة إنشاء
    الحساب تُبنى على localhost:7100 في الإنتاج ما لم يُضبط المتغير يدويا —
    رسالة تصل برابط لا يفتح عند أحد. */
export function publicSiteUrl(): string {
  const explicit = process.env.APP_URL?.trim()
  if (explicit) return explicit.replace(/\/+$/, '')
  return 'http://localhost:7100'
}

/** هل عنوانُ الموقع مضبوطٌ صراحةً، أم نحن على الاحتياطيّ المحلّيّ؟

    يهمّ هذا حيث يخرج العنوانُ إلى طرفٍ ثالث فيعود منه المشتري: بوّابةُ الدفع
    تأخذ `success_url` و`cancel_url` وقتَ إنشاء الجلسة، فإن كانا `localhost`
    عاد المشتري بعد دفعٍ ناجح إلى عنوانٍ لا يفتح عنده. والمالُ يُقبض والتسجيلُ
    يُسوّى (الـwebhook مستقلّ عن المتصفّح) — فيكون العطبُ صامتا في السجلّات
    صاخبا عند المشتري، وهو أسوأُ ترتيب. */
export function hasExplicitSiteUrl(): boolean {
  return Boolean(process.env.APP_URL?.trim())
}

const MAX_ATTEMPTS = 3

/** إشعار غير معيق — فشله لا يوقف أي مسار تشغيلي (قبول/دفع/شهادة/مالية) */
export async function safeNotify(prisma: PrismaClient, payload: NotificationPayload): Promise<void> {
  try {
    await new NotificationService(prisma).notify(payload)
  } catch { /* الإشعار رفاهية — السجلات التشغيلية هي مصدر الحقيقة */ }
}

/** إشعار كل المستخدمين الفعالين الحاملين لأدوار معينة — لأحداث تهم الإدارة (طلب مدرب، تذكرة دعم).

    وجمهورُه `staff` بحكم بابه: من يُرسَل إليه بدوره الوظيفيّ يُرسَل إليه في
    بوابته الوظيفية. وكان يقع في جرس بوابة الطالب لأنّ الإشعار يحمل صاحبَه
    ولا يحمل بوابتَه — فيرى الإداريّ في «تعلّمي» طلبَ انضمام مدرّب. */
export async function notifyRole(
  prisma: PrismaClient, roleIds: string[], payload: Omit<NotificationPayload, 'userId'>,
): Promise<void> {
  try {
    const holders = await prisma.userRole.findMany({
      where: { roleId: { in: roleIds }, user: { status: 'active' } },
      select: { userId: true },
    })
    const unique = [...new Set(holders.map((h) => h.userId))]
    for (const userId of unique) await safeNotify(prisma, { audience: 'staff', ...payload, userId })
  } catch { /* لا يعيق الحدث الأصلي */ }
}

export class NotificationService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /* اختيار المزود بالقناة — البريد يقرأ إعدادات التكامل ويحتاج بريد المستخدم */
  private async providerFor(channel: string, userId: string): Promise<NotificationProvider> {
    if (channel === 'in_app') return new InAppProvider()
    if (channel === 'email') {
      const config = await getEmailConfig(this.prisma)
      if (config.enabled && config.apiKey) {
        const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
        if (user?.email) return new ResendEmailProvider(config, user.email)
      }
    }
    return new UnwiredExternalProvider(channel as 'email' | 'whatsapp' | 'sms')
  }

  /** يبني إشعارا من قالب — متغيرات {{key}} تُستبدل من البيانات */
  async renderTemplate(key: string, channel: string, data: Record<string, unknown>) {
    const tpl = await this.prisma.notificationTemplate.findUnique({ where: { key_channel: { key, channel } } })
    if (!tpl || !tpl.active) throw new AuthError('no_template', `لا قالب فعالا لـ «${key}» على قناة ${channel}`, 404)
    const fill = (text: string) => text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(data[k] ?? `{{${k}}}`))
    return { title: fill(tpl.titleAr), body: fill(tpl.bodyAr) }
  }

  /* ═══ تفضيلُ صاحب الحساب — وحدُّه (المهمّة ٧٢) ═══

     الكتمُ يقع **قبل الكتابة**: إشعارٌ مكتومٌ لا يُنشأ صفّا ثمّ يُخفى، فلا
     جرسٌ يعدّ ما لن يُقرأ ولا جدولٌ ينمو بما لا يُرى.

     والحدُّ يُفرَض هنا لا في الشاشة: صنفٌ غيرُ قابلٍ للكتم (المال · الشهادات ·
     عملُ الموظّف) يمضي إشعارُه **مهما كان في القاعدة** — فلو حُفر صفُّ تفضيلٍ
     بيدٍ لم يُسكِت خبرا يترتّب عليه حقٌّ أو واجب. وما لا صنفَ له بعد يمضي
     أيضا: السهوُ في التصنيف لا يُسكِت أحدا.

     ويُرجَع `null` عند الكتم، ولا قارئَ لناتج `notify` في المستودع كلِّه —
     فُحص. */
  private async suppressedFor(payload: NotificationPayload): Promise<boolean> {
    const category = categoryForTemplate(payload.templateKey)
    if (!category || !category.silenceable) return false
    const pref = await this.prisma.notificationPreference.findUnique({
      where: {
        userId_category_channel: {
          userId: payload.userId, category: category.key, channel: payload.channel,
        },
      },
    })
    /* الغيابُ يعني «مُفعَّل»: من لم يفتح الشاشةَ لا يتغيّر سلوكُه */
    return pref ? !pref.enabled : false
  }

  /** إرسال (أو محاولة) إشعار — يسجل النتيجة دائما، إلّا ما كتَمَه صاحبُه */
  async notify(payload: NotificationPayload) {
    if (await this.suppressedFor(payload)) return null
    const notification = await this.prisma.notification.create({
      data: {
        userId: payload.userId, channel: payload.channel, templateKey: payload.templateKey,
        title: payload.title, body: payload.body, data: payload.data as object,
        audience: payload.audience ?? 'learner',
      },
    })
    return this.attemptSend(notification.id)
  }

  /** محاولة إرسال — ترفع العداد وتسجل النجاح أو الفشل */
  async attemptSend(notificationId: string) {
    const n = await this.prisma.notification.findUnique({ where: { id: notificationId } })
    if (!n) throw new AuthError('not_found', 'الإشعار غير موجود', 404)
    if (n.status === 'sent' || n.status === 'read') return n
    if (n.attempts >= MAX_ATTEMPTS) return n

    const provider = await this.providerFor(n.channel, n.userId)
    const result = await provider.send(n as NotificationPayload)
    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: result.ok
        ? { status: 'sent', sentAt: new Date(), attempts: { increment: 1 }, lastError: null }
        : { status: 'failed', attempts: { increment: 1 }, lastError: result.error },
    })
    await recordAudit(this.prisma, {
      actorId: null, action: result.ok ? 'notification.sent' : 'notification.failed',
      entityType: 'notification', entityId: notificationId,
      meta: { channel: n.channel, attempt: updated.attempts, error: result.error },
    })
    return updated
  }

  /** إعادة محاولة الفاشل — حتى الحد الأقصى */
  async retry(notificationId: string) {
    const n = await this.prisma.notification.findUnique({ where: { id: notificationId } })
    if (!n) throw new AuthError('not_found', 'الإشعار غير موجود', 404)
    if (n.status !== 'failed') throw new AuthError('bad_state', 'إعادة المحاولة للفاشل فقط', 409)
    if (n.attempts >= MAX_ATTEMPTS) throw new AuthError('max_attempts', 'استنفدت محاولات الإرسال', 409)
    await this.prisma.notification.update({ where: { id: notificationId }, data: { status: 'queued' } })
    return this.attemptSend(notificationId)
  }

  /* ── صندوق المتعلم ── */

  /* جرسٌ لكلّ بوابة — يعرض جمهورَها وحده.

     والجرس مكوّنٌ واحد في أربع بوابات، فالتصفية بالجمهور وحدها كانت تُفرغ
     جرس الإداريّ كما تُنظّف جرس المتعلّم: الإداريّ يقرأ من نقطة النهاية
     نفسها. فالبوابة تُعلن جمهورَها، ولا يضيع إشعارٌ عن صاحبه — ينتقل إلى
     الجرس الذي يقرأه فيه. */
  async myNotifications(userId: string, audience: NotificationAudience = 'learner') {
    return this.prisma.notification.findMany({
      where: { userId, channel: 'in_app', audience, status: { in: ['sent', 'read'] } },
      orderBy: { sentAt: 'desc' }, take: 50,
    })
  }

  async unreadCount(userId: string, audience: NotificationAudience = 'learner') {
    return this.prisma.notification.count({
      where: { userId, channel: 'in_app', audience, status: 'sent' },
    })
  }

  async markRead(userId: string, notificationId: string) {
    const n = await this.prisma.notification.findUnique({ where: { id: notificationId } })
    if (!n || n.userId !== userId) throw new AuthError('not_found', 'الإشعار غير موجود', 404)
    return this.prisma.notification.update({ where: { id: notificationId }, data: { status: 'read', readAt: new Date() } })
  }

  /* ── إدارة القوالب والسجل ── */

  async upsertTemplate(actorId: string, input: { key: string; channel: string; titleAr: string; bodyAr: string; active?: boolean }) {
    const tpl = await this.prisma.notificationTemplate.upsert({
      where: { key_channel: { key: input.key, channel: input.channel } },
      update: { titleAr: input.titleAr, bodyAr: input.bodyAr, active: input.active ?? true },
      create: { key: input.key, channel: input.channel, titleAr: input.titleAr, bodyAr: input.bodyAr, active: input.active ?? true },
    })
    await recordAudit(this.prisma, { actorId, action: 'notification.template.upsert', entityType: 'notification_template', entityId: tpl.id, meta: { key: input.key, channel: input.channel } })
    return tpl
  }

  async listTemplates() {
    return this.prisma.notificationTemplate.findMany({ orderBy: [{ key: 'asc' }, { channel: 'asc' }] })
  }

  async listLog(status?: string) {
    return this.prisma.notification.findMany({
      where: status ? { status } : undefined,
      include: { user: { select: { displayName: true, email: true } } },
      orderBy: { queuedAt: 'desc' }, take: 200,
    })
  }
}
