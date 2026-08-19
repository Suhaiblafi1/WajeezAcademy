/* خدمة الإشعارات — داخل المنصة فعالة الآن؛ البريد وWhatsApp وSMS تنتظر مزودا.
   لا إرسال حقيقي في التطوير أبدا: القنوات الخارجية تُسجل «فشل: لا مزود» وتعاد المحاولة.
   كل نجاح وفشل ومحاولة موثقة في سجل الإشعار نفسه. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'

export interface NotificationPayload {
  userId: string
  channel: 'in_app' | 'email' | 'whatsapp' | 'sms'
  title: string
  body: string
  templateKey?: string
  data?: Record<string, unknown>
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

const MAX_ATTEMPTS = 3

/** إشعار غير معيق — فشله لا يوقف أي مسار تشغيلي (قبول/دفع/شهادة/مالية) */
export async function safeNotify(prisma: PrismaClient, payload: NotificationPayload): Promise<void> {
  try {
    await new NotificationService(prisma).notify(payload)
  } catch { /* الإشعار رفاهية — السجلات التشغيلية هي مصدر الحقيقة */ }
}

export class NotificationService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  private providerFor(channel: string): NotificationProvider {
    if (channel === 'in_app') return new InAppProvider()
    return new UnwiredExternalProvider(channel as 'email' | 'whatsapp' | 'sms')
  }

  /** يبني إشعارا من قالب — متغيرات {{key}} تُستبدل من البيانات */
  async renderTemplate(key: string, channel: string, data: Record<string, unknown>) {
    const tpl = await this.prisma.notificationTemplate.findUnique({ where: { key_channel: { key, channel } } })
    if (!tpl || !tpl.active) throw new AuthError('no_template', `لا قالب فعالا لـ «${key}» على قناة ${channel}`, 404)
    const fill = (text: string) => text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(data[k] ?? `{{${k}}}`))
    return { title: fill(tpl.titleAr), body: fill(tpl.bodyAr) }
  }

  /** إرسال (أو محاولة) إشعار — يسجل النتيجة دائما */
  async notify(payload: NotificationPayload) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: payload.userId, channel: payload.channel, templateKey: payload.templateKey,
        title: payload.title, body: payload.body, data: payload.data as object,
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

    const provider = this.providerFor(n.channel)
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

  async myNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId, channel: 'in_app', status: { in: ['sent', 'read'] } },
      orderBy: { sentAt: 'desc' }, take: 50,
    })
  }

  async unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, channel: 'in_app', status: 'sent' } })
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
