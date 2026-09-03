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
    ]
    const order: HealthLevel[] = ['broken', 'attention', 'unknown', 'ok']
    const all = groups.flatMap((g) => g.items)
    const worst = order.find((lvl) => all.some((i) => i.level === lvl)) ?? 'ok'
    return { groups, worst, checkedAt: now }
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
    const [payment, email, unprocessedHooks, oldestHook, pendingRefunds, unpaidInvoices] = await Promise.all([
      this.prisma.integrationSetting.findUnique({ where: { provider: 'payment' } }),
      this.prisma.integrationSetting.findUnique({ where: { provider: 'email' } }),
      this.prisma.paymentWebhookEvent.count({ where: { processedAt: null } }),
      this.prisma.paymentWebhookEvent.findFirst({ where: { processedAt: null }, orderBy: { createdAt: 'asc' }, select: { createdAt: true, provider: true } }),
      this.prisma.refund.count({ where: { status: 'requested' } }),
      this.prisma.invoice.count({ where: { status: 'issued' } }),
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
      {
        key: 'email_channel',
        titleAr: 'قناةُ البريد',
        valueAr: email?.enabled ? `موصولة (${emailDriver ?? 'مزوّدٌ محدَّد'})` : 'غيرُ موصولة',
        level: email?.enabled ? 'ok' : 'broken',
        meaningAr: 'بلا بريدٍ: لا توثيقَ عنوانٍ، ولا استعادةَ كلمةِ مرور، ولا دعوةَ موظّفٍ تصل. وتوثيقُ البريد شرطٌ لشراء شعبةٍ واستلامِ شهادة.',
        actionAr: email?.enabled ? undefined : 'وصلُ مزوّدِ بريدٍ من شاشة التكاملات — أو زرُّ «وثّق البريد يدويّا» للموظّف حتّى ذلك الحين.',
        href: '/admin/integrations',
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
      this.prisma.trainerApplicationDocument.count(),
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
      {
        key: 'file_uploads',
        titleAr: 'رفعُ الملفّات',
        valueAr: fileUploadsEnabled() ? 'مفعَّل' : 'غيرُ مفعَّل (مطفأٌ عمدا)',
        level: fileUploadsEnabled() ? 'ok' : 'attention',
        meaningAr: fileUploadsEnabled()
          ? 'الرفعُ يعمل — والملفّاتُ ما زالت تُخزَّن في القاعدة لا في مخزنِ كائنات.'
          : 'مطفأٌ لأنّ التخزينَ لم يُبنَ إلّا لوثائقِ طلبِ الانضمام: كلُّ رفعٍ آخرَ كان يفشل بعد أن يَعِد بالنجاح. فأُطفئ صراحةً بدل أن يَعِد بما لا يفعل.',
        actionAr: fileUploadsEnabled() ? undefined : 'يعمل مع مخزنِ الكائنات على الخادم الجديد (المهمّة ٥٥).',
      },
      {
        key: 'documents_in_db',
        titleAr: 'وثائقُ مخزَّنةٌ داخلَ القاعدة',
        valueAr: `${docs} وثيقة`,
        level: docs > 500 ? 'attention' : 'ok',
        meaningAr: 'الملفّاتُ في أعمدةِ القاعدة تُثقل النسخَ الاحتياطيّةَ وتنقلها معها. وهي حالٌ مؤقّتةٌ إلى أن يوجد مخزنُ كائنات.',
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
}
