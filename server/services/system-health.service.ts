/* «هل النظامُ سليم؟» — سؤالٌ لم يكن له جوابٌ إلّا في سجلّات الخادم.

   المنصّةُ تكتب وعودا كثيرةً لا يُنفّذها أحد: `Notification.status = 'queued'`
   ينتظر مُشغِّلا خلفيّا لا وجودَ له (A2 في التدقيق)، و`nextFollowUpAt`
   و`scheduledPublishAt` تواريخُ تمرّ ولا يقع عندها شيء. وحين يشكو متعلّمٌ
   أنّه لم يصله إشعار، لا شاشةَ تقول للمالك: «ثلاثةٌ وأربعون إشعارا في
   الطابور منذ يومَين، ولا عاملَ يُرسلها».

   وهذه الصفحةُ ذلك الجواب — بشرطَين:

   أ) **كلُّ بندٍ محسوبٌ من حالة القاعدة الآن.** لا عدّادٌ يُخزَّن فيبلى، ولا
      «آخرُ فحصٍ ناجح» يُكتب مرّةً ويُقرأ سنة.
   ب) **وكلُّ بندٍ يقول ما يعنيه لصاحب المنصّة، لا رقما مجرّدا.** «٤٣ إشعارا
      في الطابور» ليس جوابا؛ «٤٣ وعدا بالإعلام لم يصل، وأقدمُها منذ يومَين،
      والسببُ أنّ العاملَ الخلفيَّ غيرُ مشغَّل» جواب. */

import type { PrismaClient } from '@prisma/client'
import { fileUploadsEnabled } from './storage.service'
import { PERMISSIONS, ROLE_PERMISSIONS } from '../auth/permissions'
import { buildStamp, commitOfSnapshotLabel, runtimeEnvLabel, snapshotInSync } from '../build-stamp'
import { lastVerifiedCommit } from '../catalog/snapshot-verified'
import { hasExplicitSiteUrl, publicSiteUrl } from './notification.service'
import { getCalendlyConfig, getCalendlySync } from './integrations.service'

export type HealthLevel = 'ok' | 'attention' | 'broken' | 'unknown'

/** بندٌ واحد: ما هو، وما قيمتُه الآن، وماذا يعني، وما العمل */
export interface HealthItem {
  key: string
  titleAr: string
  /** القيمةُ كما تُقرأ — لا رقمٌ خامّ */
  valueAr: string
  level: HealthLevel
  /** ماذا يعني هذا لصاحب المنصّة */
  meaningAr: string
  /** ما العملُ إن لم يكن سليما — أو الفراغُ إن لم يكن ثمّ عمل */
  actionAr?: string
  /** أين يُعمَل، إن كان له موضعٌ في المنصّة */
  href?: string
}

export interface HealthGroup {
  titleAr: string
  items: HealthItem[]
}

const DAY = 86_400_000

/** «منذ ثلاثة أيّام» لا «2026-08-31T…» */
function agoAr(when: Date, now: Date): string {
  const ms = now.getTime() - when.getTime()
  if (ms < 3_600_000) return `منذ ${Math.max(1, Math.round(ms / 60_000))} دقيقة`
  if (ms < DAY) return `منذ ${Math.round(ms / 3_600_000)} ساعة`
  return `منذ ${Math.round(ms / DAY)} يوما`
}

export class SystemHealthService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  async snapshot(now = new Date()): Promise<{ groups: HealthGroup[]; worst: HealthLevel; checkedAt: Date }> {
    const groups: HealthGroup[] = [
      { titleAr: 'الوعودُ المؤجَّلة — ما ينتظر مُشغِّلا خلفيّا', items: await this.deferred(now) },
      { titleAr: 'المالُ والمزوّدون', items: await this.money(now) },
      { titleAr: 'الأمنُ والدخول', items: await this.security(now) },
      { titleAr: 'الصلاحيّاتُ والأدوار', items: await this.rbac() },
      { titleAr: 'التخزينُ والقاعدة', items: await this.storage() },
      { titleAr: 'النسخةُ العاملةُ والبيئة', items: await this.deployment(now) },
    ]
    const order: HealthLevel[] = ['broken', 'attention', 'unknown', 'ok']
    const all = groups.flatMap((g) => g.items)
    const worst = order.find((lvl) => all.some((i) => i.level === lvl)) ?? 'ok'
    return { groups, worst, checkedAt: now }
  }

  /* ─────────── مزامنةُ Calendly: أتعمل فعلا؟ ───────────

     ═══ العطبُ الذي كُتب له ═══

     التكاملُ كان يُظهر نفسَه سليما وهو لا يعمل: يُحفظ الرمزُ فتُقال «مفعَّل»،
     وتسأل الوظيفةُ كلَّ خمس دقائق حسابا لا حجزَ فيه، فلا تجد شيئا ولا تكتب
     شيئا — و`runJob` لا تسجّل دورةً لم تعمل ولم يسقط لها شيء. فيبقى صمتٌ
     يُقرأ سلامةً، وحجوزٌ حقيقيّةٌ لا تصل طابورَ المراجعة (١٣ سبتمبر ٢٠٢٦).

     والسؤالُ الذي يُجاب هنا ليس «أمفعَّلٌ؟» بل **«أقرأ شيئا؟»**: رمزٌ على
     حسابٍ غيرِ المضيف صحيحٌ تماما ويردّ صفرا أبدا. فالصفرُ يُقال ويُسمّى
     احتمالُه، لا يُترك ليُقرأ هدوءا. */
  private async calendlySync(now: Date): Promise<HealthItem> {
    const [config, sync] = await Promise.all([
      getCalendlyConfig(this.prisma),
      getCalendlySync(this.prisma),
    ])
    const base = {
      key: 'calendly_sync',
      titleAr: 'مزامنةُ مواعيد Calendly',
      href: '/admin/integrations',
    }

    /* ═══ ولا تُجمع الحالتان في «لم تُضبط» ═══

       جُمعتا أوّلَ ما كُتب هذا البند، فقرأ المشغّلُ «لم تُضبط» وذهب يبحث عن
       مربّعِ التفعيل — وكان مؤشَّرا، والغائبُ الرمزُ (١٣ سبتمبر ٢٠٢٦). والعملُ
       المطلوبُ في الحالتين مختلفٌ تماما: من لا رمزَ عنده يذهب إلى Calendly
       ليولّده، ومن رمزُه محفوظٌ ينقر مربّعا ويحفظ. فيُقال أيُّهما. */
    if (!config.token) {
      return {
        ...base,
        valueAr: 'لا رمزَ محفوظ',
        level: 'attention' as const,
        meaningAr: 'بطاقةُ الحجز معروضةٌ للمتقدّمين، ومن يحجز لا يصل حجزُه إلى طابور المراجعة — يُسجَّل يدويّا أو لا يُعرف.',
        actionAr: 'ولّد رمزا شخصيّا من الحساب المضيف للمقابلات نفسِه، والصقه في حقل «الرمزُ الشخصيّ» — لا في حقل مفتاحِ التوقيع تحتَه.',
      }
    }

    if (!config.enabled) {
      return {
        ...base,
        valueAr: 'الرمزُ محفوظٌ والتكاملُ مطفأ',
        level: 'attention' as const,
        meaningAr: 'لا تُسأل Calendly البتّة ما دام مطفأً، والرمزُ المحفوظُ لا يعمل وحدَه — فالحجوزاتُ لا تصل كأن لا تكاملَ أصلا.',
        actionAr: 'علّم «مفعَّل» في بطاقة Calendly ثمّ احفظ — ولا حاجةَ لإعادة لصق الرمز.',
      }
    }

    if (!sync) {
      return {
        ...base,
        valueAr: 'مضبوطةٌ ولم تعمل دورةٌ بعد',
        level: 'unknown' as const,
        meaningAr: 'الرمزُ محفوظٌ ولم يُسجَّل نبضٌ من العامل — إمّا لم تمرّ خمسُ دقائقَ بعد، وإمّا العاملُ الخلفيُّ متوقّف.',
        actionAr: 'انتظر دورةً واحدة، فإن بقيت الحالُ فراجع تشغيلَ العامل الخلفيّ.',
      }
    }

    const at = new Date(sync.at)
    const staleMs = now.getTime() - at.getTime()

    if (sync.errorAr) {
      return {
        ...base,
        valueAr: `آخرُ دورةٍ سقطت (${sync.errorAr}) — ${agoAr(at, now)}`,
        level: 'broken' as const,
        meaningAr: 'لا يُقرأ حجزٌ ما دام النداءُ يسقط. و«ردّ 401» يعني رمزا مرفوضا: انتهى أو أُبطل أو نُسخ ناقصا.',
        actionAr: 'أعِد توليدَ الرمز من الحساب المضيف والصقه من جديد.',
      }
    }

    /* أكثرُ من ثلاث دورات بلا نبض: العاملُ متوقّفٌ لا التكامل */
    if (staleMs > 16 * 60_000) {
      return {
        ...base,
        valueAr: `آخرُ نبضٍ ${agoAr(at, now)}`,
        level: 'broken' as const,
        meaningAr: 'الدورةُ كلَّ خمس دقائق، وانقطاعُها هذه المدّةَ يعني أنّ العاملَ الخلفيَّ لا يعمل — لا أنّ Calendly صامتة.',
        actionAr: 'راجع خدمةَ العامل الخلفيّ (worker في deploy/compose.prod.yml).',
      }
    }

    if (sync.events === 0) {
      return {
        ...base,
        valueAr: `تعمل — وقرأت 0 موعدا (${agoAr(at, now)})`,
        level: 'attention' as const,
        meaningAr: 'النداءُ ينجح والحسابُ لا حجزَ فيه. وهذا متوقَّعٌ إن لم يحجز أحدٌ بعد — وإن كان ثمّ حجوزٌ فالرمزُ على حسابٍ غيرِ المضيف، وهو يردّ فراغا بلا خطأ.',
        actionAr: 'إن كنتَ تعلم بحجزٍ قائم: تأكّد أنّ الرمزَ من حساب المضيف نفسِه لا من حسابٍ آخر.',
      }
    }

    const skipped = sync.skipped > 0 ? ` · تُجووز ${sync.skipped}` : ''
    return {
      ...base,
      valueAr: `تعمل — قرأت ${sync.events} موعدا${skipped} (${agoAr(at, now)})`,
      level: sync.skipped > 0 ? ('attention' as const) : ('ok' as const),
      meaningAr: sync.skipped > 0
        ? 'قُرئ حجزٌ ولم يُطابَق طلبا — أرجحُه بريدٌ مختلفٌ عند الحجز، أو حجزٌ من Calendly مباشرةً بلا رقم الطلب.'
        : 'الحجوزاتُ تصل طابورَ المراجعة وحدَها.',
      actionAr: sync.skipped > 0 ? 'السببُ مكتوبٌ في سجلّ الأثر تحت worker.calendly_interview_sync.' : undefined,
    }
  }

  /* ── ما وُعد به ولم يُنفَّذ لغياب العامل الخلفيّ ── */
  private async deferred(now: Date): Promise<HealthItem[]> {
    const [queued, oldestQueued, failed, oldestFailed, overdueFollowUps, scheduledPublishes] = await Promise.all([
      this.prisma.notification.count({ where: { status: 'queued' } }),
      this.prisma.notification.findFirst({ where: { status: 'queued' }, orderBy: { queuedAt: 'asc' }, select: { queuedAt: true } }),
      this.prisma.notification.count({ where: { status: 'failed' } }),
      this.prisma.notification.findFirst({ where: { status: 'failed' }, orderBy: { queuedAt: 'asc' }, select: { queuedAt: true, lastError: true } }),
      /* الحالاتُ المغلقةُ لا تُحصى: «مسجَّل» نهايةٌ ناجحة، و«غيرُ مهتمّ»
         و«مغلق» نهايتان — والمتابعةُ بعدها لا معنى لها. */
      this.prisma.advisorCase.count({
        where: { nextFollowUpAt: { lt: now }, status: { notIn: ['enrolled', 'not_interested', 'closed'] } },
      }),
      this.prisma.trainerChangeRequest.count({ where: { scheduledPublishAt: { lt: now }, status: { notIn: ['published', 'rejected'] } } }),
    ])

    return [
      {
        key: 'notifications_queued',
        titleAr: 'إشعاراتٌ في الطابور',
        valueAr: queued === 0 ? 'لا شيء' : `${queued}${oldestQueued ? ` — أقدمُها ${agoAr(oldestQueued.queuedAt, now)}` : ''}`,
        /* الطابورُ ليس عطبا بذاته؛ عطبُه أن يبقى. وما مضى عليه يومٌ لم يُرسَل. */
        level: queued === 0 ? 'ok' : (oldestQueued && now.getTime() - oldestQueued.queuedAt.getTime() > DAY ? 'broken' : 'attention'),
        meaningAr: 'كلُّ صفٍّ هنا وعدٌ بالإعلام قطعَته المنصّةُ ولم يصل صاحبَه: تذكيرُ جلسةٍ، أو خبرُ قبولِ طلب، أو دعوة.',
        actionAr: 'السببُ أنّ العاملَ الخلفيَّ غيرُ مشغَّل بعد — يُشغَّل مع الخادم الجديد (المهمّة ٥٤ في الخطّة). ولا يُرسَل شيءٌ قبل وصل البريد.',
        href: '/admin/notifications',
      },
      {
        key: 'notifications_failed',
        titleAr: 'إشعاراتٌ فشل إرسالها',
        valueAr: failed === 0 ? 'لا شيء' : `${failed}${oldestFailed?.lastError ? ` — آخرُ خطإٍ: ${oldestFailed.lastError.slice(0, 90)}` : ''}`,
        level: failed === 0 ? 'ok' : 'attention',
        meaningAr: 'حاولت المنصّةُ الإرسالَ وردَّها المزوّد. والفشلُ صامتٌ عند صاحب الإشعار — لا يعرف أنّه لم يصله.',
        actionAr: failed === 0 ? undefined : 'راجع سببَ الخطأ في شاشة الإشعارات، ثمّ أعد المحاولةَ بعد إصلاحه.',
        href: '/admin/notifications',
      },
      {
        key: 'followups_overdue',
        titleAr: 'متابعاتُ مستشارين فات موعدُها',
        valueAr: overdueFollowUps === 0 ? 'لا شيء' : `${overdueFollowUps} حالة`,
        level: overdueFollowUps === 0 ? 'ok' : 'attention',
        meaningAr: 'تاريخُ المتابعة مكتوبٌ في الحالة، ولا شيءَ يُنبّه المستشارَ عنده — فالتذكيرُ اليومَ ذاكرةُ بشرٍ لا نظام.',
        actionAr: overdueFollowUps === 0 ? undefined : 'تُذكّر تلقائيّا يومَ يعمل العاملُ الخلفيّ. وحتّى ذلك الحين تُراجَع من شاشة الحالات.',
      },
      {
        key: 'scheduled_publishes',
        titleAr: 'نشرٌ مجدولٌ مرَّ موعدُه',
        valueAr: scheduledPublishes === 0 ? 'لا شيء' : `${scheduledPublishes} اقتراحا`,
        level: scheduledPublishes === 0 ? 'ok' : 'broken',
        meaningAr: 'حُدِّد للتغيير موعدُ نشرٍ ومضى، ولم يُنشَر: لا مجدولَ ينفّذه.',
        actionAr: scheduledPublishes === 0 ? undefined : 'يُنشَر يدويّا من شاشة اقتراحات المدرّبين، أو يُنتظر العاملُ الخلفيّ.',
        href: '/admin/trainers',
      },
    ]
  }

  /* ── المالُ ومزوّدوه ── */
  private async money(now: Date): Promise<HealthItem[]> {
    const [payment, email, unprocessedHooks, oldestHook, pendingRefunds, unpaidInvoices, unverified] = await Promise.all([
      this.prisma.integrationSetting.findUnique({ where: { provider: 'payment' } }),
      this.prisma.integrationSetting.findUnique({ where: { provider: 'email' } }),
      this.prisma.paymentWebhookEvent.count({ where: { processedAt: null } }),
      this.prisma.paymentWebhookEvent.findFirst({ where: { processedAt: null }, orderBy: { createdAt: 'asc' }, select: { createdAt: true, provider: true } }),
      this.prisma.refund.count({ where: { status: 'requested' } }),
      this.prisma.invoice.count({ where: { status: 'issued' } }),
      /* من يمنعه حاجزُ التوثيق من الشراء اليوم — نشِطون بلا بريدٍ موثَّق */
      this.prisma.user.count({ where: { status: 'active', emailVerifiedAt: null } }),
    ])
    const driver = (payment?.config as { driver?: string } | null)?.driver ?? 'test'
    const emailDriver = (email?.config as { driver?: string } | null)?.driver ?? null

    return [
      {
        key: 'payment_driver',
        titleAr: 'مزوّدُ الدفع',
        valueAr: driver === 'test' ? 'تجريبيّ (test) — لا مالَ حقيقيّا' : `${driver}${payment?.enabled ? ' — مفعَّل' : ' — غيرُ مفعَّل'}`,
        /* التجريبيُّ سليمٌ في مرحلة التجربة بقرار المالك، وعطبٌ يومَ الإطلاق.
           فلا يُقال «عطب» الآن، ويُقال ما يجب أن يتغيّر قبل الإطلاق. */
        level: driver === 'test' ? 'attention' : 'ok',
        meaningAr: driver === 'test'
          ? 'كلُّ «دفعةٍ» تنجح بلا مالٍ ينتقل. وهو المطلوبُ في مرحلة التجربة.'
          : 'الدفعُ حقيقيٌّ — تُراجَع المفاتيحُ والاستردادات بعنايةٍ من هنا.',
        actionAr: driver === 'test' ? 'يُبدَّل في آخرِ خطوةٍ قبل الإطلاق للعموم — قرارُ المالك.' : undefined,
        href: '/admin/integrations',
      },
      await this.calendlySync(now),
      {
        key: 'email_channel',
        titleAr: 'قناةُ البريد',
        valueAr: email?.enabled ? `موصولة (${emailDriver ?? 'مزوّدٌ محدَّد'})` : 'غيرُ موصولة',
        level: email?.enabled ? 'ok' : 'broken',
        meaningAr: 'بلا بريدٍ: لا توثيقَ عنوانٍ، ولا استعادةَ كلمةِ مرور، ولا دعوةَ موظّفٍ تصل. وتوثيقُ البريد شرطٌ لشراء شعبةٍ واستلامِ شهادة.',
        actionAr: email?.enabled ? undefined : 'وصلُ مزوّدِ بريدٍ من شاشة التكاملات — أو زرُّ «وثّق البريد يدويّا» للموظّف حتّى ذلك الحين.',
        href: '/admin/integrations',
      },
      /* ── من أيقظه وصلُ البريد (البند ٦٧) ──

         حواجزُ الشراء والشهادة الأربعةُ مشروطةٌ بـ`emailChannelEnabled()`:
         تسقط والقناةُ مغلقة، وتعمل يومَ تُوصَل. فوصلُ البريد ليس فتحَ ميزةٍ
         فحسب — هو **تفعيلُ حاجزٍ على من كان يشتري بلا مانع**.

         والرقمُ يُعرض هنا لا في استعلامٍ يكتبه المالكُ بيده: تغييرٌ صامتٌ في
         سلوك الإنتاج يجب أن يكون له عددٌ على شاشة. */
      {
        key: 'unverified_blocked',
        titleAr: 'حساباتٌ نشطةٌ بلا بريدٍ موثَّق',
        valueAr: unverified === 0
          ? 'لا شيء'
          : email?.enabled
            ? `${unverified} — ممنوعون من الشراء الآن`
            : `${unverified} — والحاجزُ ساقطٌ ما دامت القناةُ مغلقة`,
        level: unverified === 0 || !email?.enabled ? 'ok' : 'attention',
        meaningAr: 'حاجزُ التوثيق يعمل بوصل قناة البريد وحدَها. فمن كان يشتري أمسِ بلا مانعٍ قد يُردّ اليومَ حتّى يفتح رابطَ التوثيق — والشريطُ في بوّابته يعرض زرّ الإرسال تلقائيّا.',
        actionAr: unverified === 0 || !email?.enabled
          ? undefined
          : 'لا إجراءَ لازم: من يدخل بوّابته يرى الشريطَ ويطلب الرابط. وراقب أن ينزل العدد — بقاؤه عاليا يعني أنّ الرسائل لا تصل.',
        href: '/admin/users',
      },
      {
        key: 'payment_webhooks',
        titleAr: 'إشعاراتُ الدفع غيرُ المعالَجة',
        valueAr: unprocessedHooks === 0 ? 'لا شيء' : `${unprocessedHooks}${oldestHook ? ` — أقدمُها ${agoAr(oldestHook.createdAt, now)}` : ''}`,
        level: unprocessedHooks === 0 ? 'ok' : 'broken',
        meaningAr: 'المزوّدُ أخبرَنا بدفعةٍ ولم تُقيَّد: طلبٌ مدفوعٌ عند المزوّد وغيرُ مدفوعٍ عندنا، ومتعلّمٌ دفع ولم تُفتح له المنصّة.',
        actionAr: unprocessedHooks === 0 ? undefined : 'تُراجَع فورا في شاشة المالية — هذا فرقٌ بين مالٍ وُصِّل ومالٍ قُيِّد.',
        href: '/admin/finance',
      },
      {
        key: 'refunds_pending',
        titleAr: 'استردادٌ ينتظر قرارا',
        valueAr: pendingRefunds === 0 ? 'لا شيء' : `${pendingRefunds} طلبا`,
        level: pendingRefunds === 0 ? 'ok' : 'attention',
        meaningAr: 'المتعلّمُ طلب مالَه ولم يُبَتّ في طلبه.',
        href: '/admin/finance',
      },
      {
        key: 'invoices_unpaid',
        titleAr: 'فواتيرُ صادرةٌ غيرُ مدفوعة',
        valueAr: unpaidInvoices === 0 ? 'لا شيء' : `${unpaidInvoices} فاتورة`,
        level: 'ok',
        meaningAr: 'رقمُ متابعةٍ لا عطب: فاتورةٌ صادرةٌ تنتظر دفعا أو إلغاءً.',
        href: '/admin/finance',
      },
    ]
  }

  /* ── الدخولُ ومحاولاتُه ── */
  private async security(now: Date): Promise<HealthItem[]> {
    const since = new Date(now.getTime() - DAY)
    const [failedLogins, successLogins, staleSessions, invitesExpired] = await Promise.all([
      this.prisma.loginAttempt.count({ where: { success: false, createdAt: { gte: since } } }),
      this.prisma.loginAttempt.count({ where: { success: true, createdAt: { gte: since } } }),
      this.prisma.session.count({ where: { revokedAt: null, expiresAt: { lt: now } } }),
      this.prisma.passwordResetToken.count({ where: { purpose: 'invite', usedAt: null, expiresAt: { lt: now } } }),
    ])
    return [
      {
        key: 'login_failures',
        titleAr: 'محاولاتُ دخولٍ فاشلةٌ (٢٤ ساعة)',
        valueAr: `${failedLogins} فاشلة من ${failedLogins + successLogins}`,
        /* عشرون فاشلةً في يومٍ لمنصّةٍ في تجربةٍ ليست عادةً — إمّا تخمينٌ
           وإمّا موظّفٌ لا يستطيع الدخولَ ولا يقول. */
        level: failedLogins > 20 ? 'attention' : 'ok',
        meaningAr: 'الفشلُ المتكرّرُ إمّا تخمينُ كلمةِ مرور، وإمّا موظّفٌ عالقٌ خارجَ حسابه — وكلاهما يستحقّ نظرة.',
        href: '/admin/audit',
      },
      {
        key: 'sessions_stale',
        titleAr: 'جلساتٌ انتهت صلاحيّتُها ولم تُنظَّف',
        valueAr: staleSessions === 0 ? 'لا شيء' : `${staleSessions} جلسة`,
        level: staleSessions > 500 ? 'attention' : 'ok',
        meaningAr: 'لا خطرَ فيها — الجلسةُ المنتهيةُ لا تفتح شيئا — لكنّها صفوفٌ تنمو بلا تنظيف.',
        actionAr: staleSessions > 500 ? 'تُحذف دوريّا يومَ يعمل العاملُ الخلفيّ.' : undefined,
      },
      {
        key: 'invites_expired',
        titleAr: 'دعواتٌ انتهت ولم تُستعمَل',
        valueAr: invitesExpired === 0 ? 'لا شيء' : `${invitesExpired} دعوة`,
        level: invitesExpired === 0 ? 'ok' : 'attention',
        meaningAr: 'حسابٌ أُنشئ لموظّفٍ ولم يدخله صاحبُه حتّى انتهت دعوتُه — وهو ينتظر منّا لا نحن منه.',
        actionAr: invitesExpired === 0 ? undefined : 'أعد إرسالَ الدعوة من قائمة المستخدمين، تبويب «مدعوّون».',
        href: '/admin/users',
      },
    ]
  }

  /* ── مطابقةُ الصلاحيّات لما في الشيفرة ── */
  private async rbac(): Promise<HealthItem[]> {
    const [permissions, roles, grants] = await Promise.all([
      this.prisma.permission.count(),
      this.prisma.role.count(),
      this.prisma.rolePermission.count(),
    ])
    const expectedGrants = Object.values(ROLE_PERMISSIONS).reduce((n, keys) => n + keys.length, 0)
    const expectedRoles = Object.keys(ROLE_PERMISSIONS).length
    const matches = permissions >= PERMISSIONS.length && roles >= expectedRoles && grants === expectedGrants
    return [
      {
        key: 'rbac_match',
        titleAr: 'مطابقةُ الأدوار لما في الشيفرة',
        valueAr: matches
          ? `${roles} دورا · ${permissions} صلاحيّة · ${grants} منحا — مطابقة`
          : `${roles}/${expectedRoles} دورا · ${permissions}/${PERMISSIONS.length} صلاحيّة · ${grants}/${expectedGrants} منحا`,
        /* المنحُ الزائدُ أخطرُ من الناقص: صلاحيّةٌ نُزعت من المصفوفة وبقيت
           في القاعدة تعمل. والبذرُ يسحبها — فبقاؤها يعني أنّه لم يُشغَّل بعد. */
        level: matches ? 'ok' : (grants > expectedGrants ? 'broken' : 'attention'),
        meaningAr: matches
          ? 'ما تقوله الشيفرةُ هو ما تنفّذه القاعدة.'
          : grants > expectedGrants
            ? 'في القاعدة منحٌ لم تعد الشيفرةُ تقرّه: صلاحيّةٌ نُزعت من دورٍ وما زالت تعمل عليه.'
            : 'في الشيفرة أدوارٌ أو صلاحيّاتٌ لم تُبذَر بعد، فتُردّ أفعالُها بـ٤٠٣.',
        actionAr: matches ? undefined : 'يُطابَق ببذر الأدوار (`npm run catalog:import`) — يجري تلقائيّا في كلّ نشر.',
      },
    ]
  }

  /* ── التخزينُ والقاعدة ── */
  private async storage(): Promise<HealthItem[]> {
    const [docs, logRows, migration] = await Promise.all([
      this.prisma.trainerApplicationDocument.count({ where: { content: { not: null } } }),
      /* جداولُ السجلّ: تنمو بلا حدٍّ بطبيعتها، ولها الآن مدّةُ حفظٍ معلنة */
      Promise.all([
        this.prisma.auditEvent.count(),
        this.prisma.notification.count(),
        this.prisma.analyticsEvent.count(),
        this.prisma.loginAttempt.count(),
        this.prisma.paymentWebhookEvent.count(),
      ]),
      this.prisma.$queryRaw<{ migration_name: string; finished_at: Date | null }[]>`
        SELECT migration_name, finished_at FROM "_prisma_migrations"
        WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1
      `.catch(() => []),
    ])
    const last = migration[0]
    return [
      /* ═══ المفتاحُ لا يحكم كلَّ المسارات — فيُقال أيُّها ═══

         كان السطرُ يقول «غيرُ مفعَّل (مطفأٌ عمدا)» ويعلّل بأنّ «التخزينَ لم
         يُبنَ إلّا لوثائقِ طلبِ الانضمام». وكلاهما لم يعد صحيحا:

         · المخزنُ بُني (`object-store.ts` على حجمٍ دائم).
         · و**وثائقُ طلبِ الانضمام ترفع فعلا والمفتاحُ مطفأ** — إذ لم تكن
           خلفه قطّ: `requestDocumentUpload` لا تنادي الحارسَ، وحدَها من بين
           ستّةِ مُصدِري روابطِ رفع. وسببُه أنّها الوحيدةُ التي كان لها عمودٌ
           في القاعدة يوم لم يكن ثمّ مخزن، فلم تَعِد يوما بما لا تفعل.

         فسطرٌ يقول «مطفأ» وأربعةٌ وعشرون كائنا على القرص يقول غيرَ الحقّ لمن
         يقرأ «صحّةَ النظام» ليعرف حالَ منصّته. والقائمةُ تُذكَر بأسمائها:
         «مطفأ» بلا تفصيلٍ لا يقول لصاحبه ما الذي لا يعمل. */
      {
        key: 'file_uploads',
        titleAr: 'رفعُ الملفّات',
        valueAr: fileUploadsEnabled() ? 'مفعَّلٌ لكلّ المسارات' : 'وثائقُ الانضمام وحدَها',
        level: fileUploadsEnabled() ? 'ok' : 'attention',
        meaningAr: fileUploadsEnabled()
          ? 'المساراتُ الستّةُ ترفع إلى مخزن الكائنات على حجم الخادم: وثائقُ طلبِ الانضمام · السيرةُ الذاتيّة · موادُّ الشعبة · تسجيلاتُ الجلسات · ملفُّ التسليم · صورةُ المدرّب.'
          : 'يعمل الآن: وثائقُ طلبِ الانضمام — لم تكن خلف هذا المفتاح قطّ. ومطفأةٌ حتّى يُشعَل: السيرةُ الذاتيّة · موادُّ الشعبة · تسجيلاتُ الجلسات · ملفُّ التسليم · صورةُ المدرّب. ولكلٍّ منها بديلٌ يُقال لصاحبه عند المحاولة — رابطٌ خارجيٌّ أو نصّ — فلا يَعِد المفتاحُ المطفأُ بما لا يفعل.',
        actionAr: fileUploadsEnabled() ? undefined : 'المخزنُ جاهزٌ ويعمل. والإشعالُ قرارُ تشغيلٍ لا شيفرة: FILE_UPLOADS=on في deploy/.env.production، بعد نسخةٍ احتياطيّةٍ خارجَ الخادم مُثبَتةِ الاسترجاع.',
      },
      /* والعدُّ صار على ما بقي في العمود لا على الصفوف كلِّها.

         كان `trainerApplicationDocument.count()` — كلَّ صفّ — تحت عنوان
         «وثائقُ مخزَّنةٌ داخلَ القاعدة». فبعد الهجرة إلى القرص صار السطرُ
         يعدّ وثائقَ بايتاتُها على الحجم ويقول إنّها في القاعدة، ويطلب
         هجرةً تمّت. والعمودُ `content` هو ما يُثقل النسخَ فعلا. */
      {
        key: 'documents_in_db',
        titleAr: 'وثائقُ بقيت بايتاتُها في القاعدة',
        valueAr: `${docs} وثيقة`,
        level: docs > 0 ? 'attention' : 'ok',
        meaningAr: docs > 0
          ? 'بايتاتُ هذه الوثائق ما زالت في عمودِ القاعدة، تُثقل كلَّ نسخةٍ احتياطيّةٍ وتُنقل معها. تُنقل بـ«npm run storage:migrate -- --apply»، ثمّ يُفرَّغ العمودُ بـ«--purge» بعد أن يُرى المخزنُ يعمل أيّاما.'
          : 'لا بايتاتٍ في أعمدة القاعدة — ما رُفع فعلى مخزنِ الكائنات، ويدخل أرشيفَ التخزين مع كلّ نسخةٍ احتياطيّة.',
      },
      {
        /* السياسةُ تُعرَض لا تُخبَّأ: من يقرأ «صحّةَ النظام» يريد أن يعرف أنّ
           القاعدةَ لا تنمو بلا سقف، وأنّ ما حُذف حُذف بقرارٍ مكتوبٍ لا بصمت. */
        key: 'log_retention',
        titleAr: 'جداولُ السجلّ ومدّةُ حفظها',
        valueAr: `${logRows.reduce((a, b) => a + b, 0)} صفّا في خمسة جداول`,
        level: logRows.reduce((a, b) => a + b, 0) > 2_000_000 ? 'attention' : 'ok',
        meaningAr:
          'سجلُّ الأثر يُحفظ سنتَين (هو جوابُ «من غيّر هذا؟»)، والإشعارُ المقروءُ تسعين يوما، وأحداثُ الاستخدام وخطّافُ الدفع سنةً، ومحاولاتُ الدخول تسعين يوما. '
          + 'والمنتظرُ في الطابور لا يُحذف بعمره — عملٌ لم يتمّ. '
          + 'والتقليمُ على دُفعاتٍ محدودةٍ كي لا تُقفل معاملةٌ جدولا.',
        actionAr: 'يُنفّذه العاملُ الخلفيُّ مرّةً في اليوم — ولا يعمل حتّى يوجد الخادمُ الدائم (المهمّة ٥٤).',
      },
      {
        key: 'last_migration',
        titleAr: 'آخرُ ترحيلٍ طُبِّق',
        valueAr: last ? `${last.migration_name} — ${last.finished_at ? agoAr(last.finished_at, new Date()) : 'بلا وقت'}` : 'لم يُقرأ',
        level: last ? 'ok' : 'unknown',
        meaningAr: 'بنيةُ القاعدة الحاليّة. ويُقرأ هنا كي يُعرف أنّ آخرَ نشرٍ طبّق ترحيلاتِه فعلا.',
      },
    ]
  }

  /* ── ما الذي يعمل الآن، وعلى أيّ عنوان (البند ٦) ──

     الجوابُ كان موجودا في `‎/api/version` — مسارُ JSON يُقرأ بـcurl ولا يفتحه
     أحد. **ومعلومةٌ لا شاشةَ لها معلومةٌ غيرُ موجودة**: بقي سؤالُ «لماذا أرى
     موقعا قديما؟» مفتوحا أسبوعا، وذهبت جلسةٌ كاملةٌ في تشخيصٍ على بيئةٍ
     خاطئة، والجوابُ في مسارٍ لم يُفتح.

     فيُعرض هنا، حيث ينظر صاحبُ المنصّة حين يشكّ. */
  private async deployment(now: Date): Promise<HealthItem[]> {
    const stamp = buildStamp()
    const sha7 = stamp.commit ? stamp.commit.slice(0, 7) : null
    /* التسميةُ وحدَها — لا حمولةُ اللقطة. `getActiveSnapshot` تجلب المخطَّطَ
       كاملا (أسئلةً ودوراتٍ ومسارات) وهو مِيغابايتاتٌ لا لزومَ لها لسطرٍ يقول
       «متطابقان». والتسميةُ على `catalogVersion` لا على اللقطة. */
    const active = await this.prisma.catalogVersion.findFirst({
      where: { status: 'published' },
      orderBy: { publishedAt: 'desc' },
      select: { label: true },
    })
    /* والالتزامُ الذي تحقّق آخرا يُقرأ معها — وإلّا أعلنت هذه الشاشةُ تأخّرا
       بعد كلّ نشرةٍ لا تمسّ الكتالوج. والتعريفُ واحدٌ لها ولـ`/api/version`. */
    const verifiedBy = await lastVerifiedCommit(this.prisma)
    const inSync = snapshotInSync(stamp.commit, active?.label, verifiedBy)
    const labelSha = commitOfSnapshotLabel(active?.label)
    const prod = process.env.NODE_ENV === 'production'
    const explicitUrl = hasExplicitSiteUrl()

    return [
      {
        key: 'running_build',
        titleAr: 'النسخةُ التي يخدمها الخادمُ الآن',
        valueAr: sha7
          ? `${sha7}${stamp.ref ? ` · ${stamp.ref}` : ''}${stamp.builtAt ? ` · بُني ${agoAr(new Date(stamp.builtAt), now)}` : ''}`
          : stamp.builtAt
            ? `التزامٌ مجهول — بُني ${agoAr(new Date(stamp.builtAt), now)}`
            : 'مجهولةٌ تماما — لا ختمَ بناءٍ هنا',
        level: sha7 ? 'ok' : 'unknown',
        meaningAr:
          `البيئةُ المُعلَنة: ${runtimeEnvLabel()} · مصدرُ البصمة: ${stamp.source}. `
          + 'وهذا جوابُ «هل وصلت نشرتي؟» بلا لوحةِ مزوّد: قارن البصمةَ بآخر التزامٍ دُمج إلى `main`. '
          + 'ووقتُ البناء يفضح نشرةً لم تصل ولو جُهل الالتزام.',
        actionAr: sha7
          ? undefined
          : 'البناءُ لم يعرف التزامَه — يُمرَّر `GIT_COMMIT_SHA` وسيطَ بناءٍ في `deploy/deploy.sh`. والخادمُ يعمل، لكنّه أعمى عن نفسِه.',
      },
      {
        key: 'snapshot_sync',
        titleAr: 'الكودُ واللقطةُ المنشورةُ — أمن التزامٍ واحد؟',
        valueAr:
          inSync === null
            ? 'لا يمكن الحكم'
            : inSync
              ? labelSha === sha7
                ? 'نعم — من التزامٍ واحد'
                : `نعم — اللقطةُ من ${labelSha} ولم يتغيّر الكتالوجُ بعده، وهذا الالتزامُ تحقّق منها`
              : 'لا — لم يتحقّق هذا الالتزامُ من تطابقهما',
        /* والاختلافُ **ليس عطبا بذاته**: نشرٌ جارٍ يمرّ بهذه الحالة دقيقةً أو
           دقيقتَين. فهو «يحتاج نظرة» لا «معطَّل» — وبقاؤه ساعةً هو الخبر. */
        level: inSync === null ? 'unknown' : inSync ? 'ok' : 'attention',
        meaningAr:
          'المحرّكُ يقرأ اللقطةَ المنشورةَ لا ملفّاتِ الكتالوج. فاختلافُهما يعني أنّ شاشاتِ الكتالوج والتشخيص تعرض محتوى نسخةٍ أخرى غير التي يخدمها الخادم. '
          + 'ولا يُقال أيُّهما أقدم: هذا المسارُ لا يملك تاريخَ الالتزامَين، وقد كذبت العبارةُ الجازمةُ مرّةً في نشرٍ متعثّر.',
        actionAr:
          inSync === false
            ? 'إن بقي على حاله بعد دقائقَ فالنشرُ لم يكتمل — أعد النشرَ أو انشر لقطةً جديدةً من شاشة النشر.'
            : undefined,
        href: inSync === false ? '/admin/publishing' : undefined,
      },
      {
        key: 'site_url',
        titleAr: 'عنوانُ الموقع الذي تُبنى عليه الروابطُ الخارجة',
        valueAr: explicitUrl ? publicSiteUrl() : `${publicSiteUrl()} — احتياطيٌّ لا مضبوط`,
        /* الاحتياطيُّ `localhost` صوابٌ في التطوير وعطبٌ في الإنتاج — والمستوى
           يقول ذلك، فلا يحمرّ جهازُ مطوّرٍ بلا سبب. */
        level: explicitUrl ? 'ok' : prod ? 'broken' : 'ok',
        meaningAr:
          'منه تُبنى روابطُ رسائل البريد (تأكيدُ الحساب، الدعوة، استعادةُ الكلمة) وعنوانُ العودة بعد الدفع. '
          + 'وبلا ضبطِه في الإنتاج تصل الرسائلُ برابطٍ لا يفتح عند أحد، ويعود المشتري بعد دفعٍ **ناجح** إلى `localhost` — '
          + 'والمالُ يُقبض والتسجيلُ يُسوّى، فيكون العطبُ صامتا في السجلّات صاخبا عند المشتري.',
        actionAr: explicitUrl ? undefined : 'اضبط `APP_URL` في `deploy/.env.production` بعنوان الموقع، ثمّ أعد النشر.',
        href: explicitUrl ? undefined : '/admin/integrations',
      },
      {
        key: 'built_site_origin',
        titleAr: 'الأصلُ القانونيُّ الذي بُنيت عليه الواجهة',
        valueAr: stamp.siteOrigin ?? 'لم يُمرَّر — فالوقوعُ على النطاق الحيّ من الاحتياطيّ',
        /* ولا يحمرّ لغيابه: احتياطيُّ `origin.ts` هو **النطاقُ الحيُّ نفسُه**،
           فالغيابُ يقع على الصواب. والخبرُ هو أن يُمرَّر أصلٌ **آخر**. */
        level: 'ok',
        meaningAr:
          'منه تُبنى `canonical` و`og:url` وخريطةُ الموقع — وهي ما يقرؤه زاحفُ الفهرسة ومعاينةُ الرابط في واتساب وتويتر (البوتاتُ لا تشغّل React). '
          + 'و`VITE_SITE_ORIGIN` متغيّرُ بناءٍ تخبزه Vite في الحزمة ثمّ يختفي، فلا يُقرأ من بيئة الخادم أبدا — ولهذا يُختم وقتَ البناء ويُقرأ من ختمِه.',
      },
    ]
  }
}
