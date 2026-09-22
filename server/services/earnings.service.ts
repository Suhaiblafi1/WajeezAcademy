/* خدمة مستحقات المدربين — كشوف شهرية ببنود، بدورة حياة صارمة:
   pending (بانتظار الاعتماد) → approved (معتمد) → paid (مدفوع)
   أو إلغاء من pending/approved بسبب موثق. كل انتقال يُسجل في سجل التدقيق.
   النماذج كانت موجودة في القاعدة (TrainerPayout/TrainerPayoutItem) — هذه الخدمة
   هي أول من يفعّلها فعليًا. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { NotificationService } from './notification.service'
import { LEDGER_CURRENCY } from '../../src/application/commerce/presentment'
import { perSeatBreakdown } from '../../src/application/trainer/seat-fee'
import { settleAgainst } from '../../src/application/trainer/issued-discount'

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/ // «2026-08»

export class EarningsService {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /* كشوف المدرب نفسه + ملخص مجاميع حسب الحالة */
  async listForTrainer(userId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({ where: { userId } })
    if (!profile) throw new AuthError('no_profile', 'لا ملف مدرب مرتبطا بهذا الحساب', 404)
    const payouts = await this.prisma.trainerPayout.findMany({
      where: { profileId: profile.id },
      include: { items: true },
      orderBy: [{ period: 'desc' }, { createdAt: 'desc' }],
    })
    const summary = { pending: 0, approved: 0, paid: 0, currency: payouts[0]?.currency ?? LEDGER_CURRENCY }
    for (const p of payouts) {
      if (p.status === 'pending') summary.pending += Number(p.total)
      else if (p.status === 'approved') summary.approved += Number(p.total)
      else if (p.status === 'paid') summary.paid += Number(p.total)
    }
    /* ═══ والاتفاقُ نفسُه يُقرأ — كان الكشفُ وحدَه يصل ═══

       كانت الصفحةُ تعرض ما قُبض وما يُنتظر، ولا تعرض **على أيّ أساس**: القاعدةُ
       التي أكّدتها الإدارةُ تبقى في شاشة الإدارة، فيقرأ المدرّبُ رقما لا يعرف
       من أين جاء. والاتفاقُ المسبقُ حقُّه أن يراه قبل أن يُحسب له شيء. */
    const [agreement, rules, cohortRows, awaiting] = await Promise.all([
      this.activeRule(profile.id),
      this.listRules(profile.id),
      /* ═══ شعبةً شعبة: كم عامّا وكم عبر رابطك، وبأيّ أجر ═══

         «ليعرف ماذا سيحصل على كلّ طالبٍ عامّ وكلّ طالبٍ من الرابط» — فلا يكفي
         مجموع؛ يرى الأعدادَ والأجرَ لكلّ شعبةٍ قبل أن يُولَّد كشفُها. */
      this.prisma.cohortTrainer.findMany({
        where: { profileId: profile.id },
        include: { cohort: { select: { id: true, title: true, courseId: true, status: true } } },
      }),
      /* ═══ وخصومُه المنتظِرةُ للحسم — تُقال قبل أن تقع ═══

         البند 4-10 يحسمها في «أوّل كشفٍ يُحرَّر بعد ذلك». والمدرّبُ يقرأ
         كشوفَه هنا، فلو لم يرَ ما ينتظره لَفوجئ برقمٍ أصغرَ ممّا حسب — وهو
         بعينه ما تمنعه هذه الصفحةُ في كلّ لوحةٍ فيها. */
      this.prisma.trainerIssuedDiscount.findMany({
        where: { profileId: profile.id, status: 'used', settledItemId: null },
        include: { coupon: { select: { code: true } } },
        orderBy: { usedAt: 'asc' },
      }),
    ])
    const cohorts = await Promise.all(cohortRows.map(async (ct) => {
      const rule = await this.activeRule(profile.id, { cohortId: ct.cohort.id, courseId: ct.cohort.courseId })
      const { referred, general } = await this.seatsBySource(ct.cohort.id, profile.id)
      const rate = rule && rule.type === 'per_seat' ? Number(rule.rate) : null
      const referralRate = rule && rule.type === 'per_seat' ? (rule.referralRate === null ? rate : Number(rule.referralRate)) : null
      /* والتوقّعُ من المعادلة نفسِها التي يحتسب بها الكشف — كان هنا حسابٌ
         ثانٍ لا يطبّق الحدَّ الأدنى، فيُعرض للمدرّب أقلُّ ممّا يُدفع له. */
      const breakdown = rate === null || !rule
        ? null
        : perSeatBreakdown({
          general, referred, rate,
          referralRate: rule.referralRate === null ? null : Number(rule.referralRate),
          minSeats: rule.minSeats,
        })
      return {
        cohortId: ct.cohort.id, title: ct.cohort.title, status: ct.cohort.status,
        general, referred, rate, referralRate, currency: rule?.currency ?? LEDGER_CURRENCY,
        ruleType: rule?.type ?? null,
        billedSeats: breakdown?.billedSeats ?? null,
        floorApplied: breakdown?.floorApplied ?? false,
        projected: breakdown === null ? null : breakdown.total,
      }
    }))
    const awaitingDiscounts = {
      total: awaiting.reduce((sum, d) => sum + Number(d.amount), 0),
      currency: awaiting[0]?.currency ?? summary.currency,
      rows: awaiting.map((d) => ({
        id: d.id, code: d.coupon.code, amount: Number(d.amount),
        currency: d.currency, forWhomAr: d.forWhomAr, usedAt: d.usedAt,
      })),
    }
    return { payouts, summary, agreement, rules, cohorts, awaitingDiscounts }
  }

  /* ═══ ملخّصُ كلّ مدرّبٍ في سطر — للإدارة ═══

     «أكّدتُ التكلفةَ ولم يظهر اسمُهم ولا حالتُهم الماليّة»: كانت الشاشةُ
     تعرض الكشوفَ (ولا كشفَ بعد) والقواعدَ (بلا مجاميع) — ولا موضعَ يقول عن
     مدرّبٍ بعينه: هذه قاعدتُه، وهذا ما يُنتظر له وما اعتُمد وما دُفع. */
  async trainerSummaries() {
    const profiles = await this.listProfiles()
    return Promise.all(profiles.map(async (p) => {
      const [rule, payouts] = await Promise.all([
        this.activeRule(p.id),
        this.prisma.trainerPayout.findMany({ where: { profileId: p.id }, select: { status: true, total: true, currency: true } }),
      ])
      const sum = (st: string) => payouts.filter((x) => x.status === st).reduce((a, x) => a + Number(x.total), 0)
      return {
        ...p,
        rule: rule ? { type: rule.type, rate: Number(rule.rate), currency: rule.currency, minSeats: rule.minSeats, referralRate: rule.referralRate === null ? null : Number(rule.referralRate) } : null,
        pending: sum('pending'), approved: sum('approved'), paid: sum('paid'),
        currency: payouts[0]?.currency ?? rule?.currency ?? LEDGER_CURRENCY,
      }
    }))
  }

  /* كل الكشوف للإدارة — مع اسم المدرب، بفلتر حالة اختياري */
  async listAll(status?: string) {
    if (status && !['pending', 'approved', 'paid', 'cancelled'].includes(status)) {
      throw new AuthError('bad_status', 'حالة غير معروفة', 400)
    }
    return this.prisma.trainerPayout.findMany({
      where: status ? { status } : undefined,
      include: {
        items: true,
        profile: { include: { application: { select: { fullName: true, reference: true } } } },
      },
      orderBy: [{ status: 'asc' }, { period: 'desc' }, { createdAt: 'desc' }],
    })
  }

  /* قائمة ملفات المدربين النشطين — لنموذج إنشاء كشف جديد */
  async listProfiles() {
    const profiles = await this.prisma.trainerProfile.findMany({
      /* المعتمَدُ الذي لم يُفعَّل بعد يحتاج قاعدةً قبل أوّل شعبة — فلو قُصرت
         القائمةُ على «نشط» غاب عنها من أكّدت الإدارةُ تكلفتَه للتوّ. */
      where: { suspendedAt: null, application: { status: { in: ['active', 'onboarding', 'conditionally_approved', 'contract_pending'] } } },
      include: { application: { select: { fullName: true, reference: true, status: true } } },
      orderBy: { createdAt: 'asc' },
    })
    return profiles.map((p) => ({
      id: p.id, fullName: p.application.fullName, reference: p.application.reference, status: p.application.status,
    }))
  }

  /* ── قائمةُ الشعب لنماذج الأتعاب ──

     شاشةُ المستحقّات تحتاج الشعبَ في موضعَين: قصرُ قاعدةِ أتعابٍ على شعبةٍ
     بعينها، واختيارُ شعبةٍ ليُولَّد كشفُها. وكانت تقرؤها من
     `‎/api/admin/cohorts` — وهي وراء `cohort.manage`.

     و**المالية لا تملكها**: صلاحيّاتُها `trainer.compensation.manage`
     و`commerce.manage` و`finance.*` و`reports.*` لا غير. فكان الطلبُ
     يُردّ ٤٠٣، ويسقط `Promise.all` كلُّه — فتموت الشاشةُ بتمامها لا حقلُ
     الشعب وحدَه: «تعذر تحميل الكشوف»، ولا كشفَ ولا قاعدةَ ولا مدرّب.

     ومنحُ الماليّةِ `cohort.manage` جوابٌ أوسعُ من السؤال: تصير تُنشئ
     الشعبَ وتفتحها وتعدّل سعتَها. فالمطلوبُ قراءةٌ ضيّقةٌ بقدر الحاجة —
     معرّفٌ وعنوانٌ وحالةٌ ونهاية، بلا مسجَّلين ولا مدرّبين ولا عدّادات. */
  async listCohortOptions() {
    const rows = await this.prisma.cohort.findMany({
      select: {
        id: true, title: true, status: true, endsAt: true,
        course: { select: { versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map((c) => ({
      id: c.id, title: c.title, status: c.status, endsAt: c.endsAt,
      courseTitle: c.course.versions[0]?.titleAr ?? '',
    }))
  }

  async create(actorId: string, input: {
    profileId: string; period: string; currency?: string
    items: { description: string; amount: number; sourceRef?: string }[]
  }) {
    if (!PERIOD_RE.test(input.period)) {
      throw new AuthError('bad_period', 'صيغة الفترة يجب أن تكون مثل 2026-08', 400)
    }
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { id: input.profileId }, include: { application: true },
    })
    if (!profile) throw new AuthError('unknown_profile', 'ملف المدرب غير موجود', 404)
    const duplicate = await this.prisma.trainerPayout.findFirst({
      where: { profileId: input.profileId, period: input.period, status: { not: 'cancelled' } },
    })
    if (duplicate) {
      throw new AuthError('duplicate_period', 'يوجد كشف غير ملغى لهذا المدرب عن نفس الفترة', 409)
    }
    const total = input.items.reduce((s, i) => s + i.amount, 0)
    if (total <= 0) throw new AuthError('empty_total', 'مجموع البنود يجب أن يكون أكبر من صفر', 400)

    const payout = await this.prisma.trainerPayout.create({
      data: {
        profileId: input.profileId,
        period: input.period,
        currency: input.currency ?? LEDGER_CURRENCY,
        total,
        items: {
          create: input.items.map((i) => ({
            description: i.description, amount: i.amount, sourceRef: i.sourceRef ?? null,
          })),
        },
      },
      include: { items: true },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer_payout.create', entityType: 'TrainerPayout', entityId: payout.id,
      meta: { profileId: input.profileId, period: input.period, total, itemsCount: input.items.length },
    })
    await this.notifyTrainer(input.profileId, 'كشف مستحقات جديد بانتظار الاعتماد',
      `أُنشئ كشف مستحقاتك عن فترة ${input.period} بإجمالي ${total} ${payout.currency} — سيُراجع ويُعتمد من الإدارة المالية، ويصلك إشعار عند كل خطوة.`,
      { payoutId: payout.id, period: input.period, total })
    return payout
  }

  /* إشعار داخل المنصة للمدرب عند أحداث مستحقاته — فشل الإشعار لا يعيق الحركة المالية أبداً */
  private async notifyTrainer(profileId: string, title: string, body: string, data: Record<string, unknown>) {
    try {
      const profile = await this.prisma.trainerProfile.findUnique({ where: { id: profileId } })
      if (!profile?.userId) return
      await new NotificationService(this.prisma).notify({
        userId: profile.userId, channel: 'in_app', title, body,
        templateKey: 'trainer_payout', data, audience: 'trainer',
      })
    } catch { /* الكشف نفسه هو مصدر الحقيقة — الإشعار رفاهية لا يوقف مساراً مالياً */ }
  }

  private async transition(
    id: string, actorId: string,
    from: string[], to: string, action: string, extra: Record<string, unknown> = {}, reason?: string,
  ) {
    const payout = await this.prisma.trainerPayout.findUnique({ where: { id } })
    if (!payout) throw new AuthError('unknown_payout', 'الكشف غير موجود', 404)
    if (!from.includes(payout.status)) {
      throw new AuthError('bad_transition', `لا يمكن تنفيذ هذا الإجراء على كشف بحالة «${payout.status}»`, 409)
    }
    const updated = await this.prisma.trainerPayout.update({
      where: { id },
      data: { status: to, ...extra },
      include: { items: true },
    })
    await recordAudit(this.prisma, {
      actorId, action, entityType: 'TrainerPayout', entityId: id,
      reason, meta: { from: payout.status, to, period: payout.period, total: Number(payout.total) },
    })
    const NOTICES: Record<string, { title: string; body: string }> = {
      approved: {
        title: 'اعتُمد كشف مستحقاتك',
        body: `اعتُمد كشف فترة ${payout.period} بإجمالي ${Number(payout.total)} ${payout.currency} — الخطوة التالية الصرف، وسيصلك تأكيد فور إتمامه.`,
      },
      paid: {
        title: 'صُرفت مستحقاتك ✓',
        body: `صُرف كشف فترة ${payout.period} بإجمالي ${Number(payout.total)} ${payout.currency}. التفاصيل كلها في بوابتك — «مستحقاتي».`,
      },
      cancelled: {
        title: 'أُلغي كشف مستحقات',
        body: `أُلغي كشف فترة ${payout.period}. السبب: ${reason ?? '—'}. لأي استفسار تواصل مع منسقك.`,
      },
    }
    const notice = NOTICES[to]
    if (notice) {
      await this.notifyTrainer(payout.profileId, notice.title, notice.body,
        { payoutId: id, period: payout.period, total: Number(payout.total), status: to })
    }
    return updated
  }

  approve(id: string, actorId: string) {
    return this.transition(id, actorId, ['pending'], 'approved', 'trainer_payout.approve', { approvedBy: actorId })
  }

  /** ═══ ولا يُؤكَّد صرفٌ إلّا على حسابٍ كُشف لهذا المستحقّ بعينه ═══

      ثلاثةُ أعطابٍ يسدّها هذا الشرط، وكلُّها تقع صامتةً:

      ① **تأكيدُ صرفٍ ولا حسابَ أصلا.** يُكتب `paid` ويُخبَر المدرّبُ أنّ
         مالَه صُرف، ولا مكانَ ذهب إليه. فيسأل بعد أسبوع، ولا جوابَ في
         القاعدة.
      ② **وتأكيدٌ بلا كشف.** من لم يفتح الحسابَ لم يُحوّل — والتأكيدُ حينئذٍ
         إقرارٌ بفعلٍ لم يقع. والشرطُ يجعل كلَّ صرفٍ مسبوقا بأثرِ كشفٍ
         يقول: هذا المستحقُّ، وهذا الحساب، وهذه اللحظة.
      ③ **وتبديلُ الحساب بين الكشف والتأكيد.** يُكشف الحسابُ فيُنسَخ الرقمُ،
         ثمّ يُبدَّل الصفُّ، ثمّ يُؤكَّد الصرفُ — فيقول السجلُّ إنّ المالَ
         ذهب إلى الجديد وقد ذهب إلى القديم. وهو بابُ الاحتيال المعروفُ في
         هذا الموضع بعينه.

      والترتيبُ بعد `transition` بقصد: تلك تفحص الحالةَ وتردّ `bad_state`
      لمستحقٍّ غيرِ معتمَد، فلا يتبدّل رمزُ خطإٍ قائمٍ بسبب حارسٍ جديد. */
  async markPaid(id: string, actorId: string) {
    const payout = await this.prisma.trainerPayout.findUnique({
      where: { id },
      select: { id: true, status: true, profileId: true, bankAccountId: true },
    })
    if (payout && payout.status === 'approved') {
      if (!payout.bankAccountId) {
        throw new AuthError(
          'no_reveal',
          'لم يُكشف حسابُ المدرّب لهذا المستحقّ — اكشفْه أوّلا، فلا يُؤكَّد صرفٌ إلى حسابٍ لم يُفتَح',
          409,
        )
      }
      const active = await this.prisma.trainerBankAccount.findFirst({
        where: { profileId: payout.profileId, status: 'active' },
        select: { id: true },
      })
      if (!active || active.id !== payout.bankAccountId) {
        throw new AuthError(
          'bank_account_changed',
          'تبدّل حسابُ المدرّب بعد كشفه — اكشفْه ثانيةً وتحقّقْ من وجهة الحوالة قبل التأكيد',
          409,
        )
      }
    }
    return this.transition(id, actorId, ['approved'], 'paid', 'trainer_payout.pay', { paidAt: new Date() })
  }

  cancel(id: string, actorId: string, reason: string) {
    return this.transition(id, actorId, ['pending', 'approved'], 'cancelled', 'trainer_payout.cancel', {}, reason)
  }

  /* ═══════════ قواعد الأتعاب والتوليد التلقائي من الشعب ═══════════ */

  /* قواعد مدرب معين (أو كل القواعد للإدارة) — مع اسم المدرب */
  async listRules(profileId?: string) {
    return this.prisma.trainerCompensationRule.findMany({
      where: profileId ? { profileId } : undefined,
      include: { profile: { include: { application: { select: { fullName: true, reference: true } } } } },
      orderBy: [{ effectiveFrom: 'desc' }],
    })
  }

  /* القاعدة السارية لمدرب الآن — بدقة النطاق: شعبة محددة ← دورة محددة ← عامة، والأحدث سرياناً */
  async activeRule(profileId: string, scope: { cohortId?: string; courseId?: string } = {}, at = new Date()) {
    const latest = (extra: Record<string, unknown>) =>
      this.prisma.trainerCompensationRule.findFirst({
        where: {
          profileId, ...extra,
          effectiveFrom: { lte: at },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
        },
        orderBy: { effectiveFrom: 'desc' },
      })
    if (scope.cohortId) {
      const r = await latest({ cohortId: scope.cohortId })
      if (r) return r
    }
    if (scope.courseId) {
      const r = await latest({ courseId: scope.courseId, cohortId: null })
      if (r) return r
    }
    return latest({ courseId: null, cohortId: null })
  }

  /* تعيين قاعدة جديدة — تُغلق القاعدة المفتوحة بنفس النطاق تلقائياً (لا تعديل صامت للتاريخ).
     المتغيرات كلها بيد الإدارة: النوع والمعدل والحد الأدنى للمقاعد ونطاق شعبة/دورة اختياري */
  async setRule(actorId: string, input: {
    profileId: string; type: string; rate: number; currency?: string; effectiveFrom?: Date
    minSeats?: number; courseId?: string; cohortId?: string
    referralRate?: number
  }) {
    if (!['per_seat', 'fixed_per_cohort', 'revenue_share'].includes(input.type)) {
      throw new AuthError('bad_type', 'نوع القاعدة يجب أن يكون per_seat أو fixed_per_cohort أو revenue_share', 400)
    }
    if (!(input.rate > 0)) throw new AuthError('bad_rate', 'المعدل يجب أن يكون أكبر من صفر', 400)
    if (input.type === 'revenue_share' && input.rate > 100) {
      throw new AuthError('bad_rate', 'نسبة الإيراد لا تتجاوز 100', 400)
    }
    const minSeats = input.minSeats ?? 0
    if (minSeats < 0) throw new AuthError('bad_min_seats', 'الحد الأدنى للمقاعد لا يكون سالباً', 400)
    const profile = await this.prisma.trainerProfile.findUnique({ where: { id: input.profileId } })
    if (!profile) throw new AuthError('unknown_profile', 'ملف المدرب غير موجود', 404)
    if (input.cohortId) {
      const cohort = await this.prisma.cohort.findUnique({ where: { id: input.cohortId } })
      if (!cohort) throw new AuthError('unknown_cohort', 'الشعبة المحددة للنطاق غير موجودة', 404)
    }
    if (input.courseId) {
      const course = await this.prisma.course.findUnique({ where: { id: input.courseId } })
      if (!course) throw new AuthError('unknown_course', 'الدورة المحددة للنطاق غير موجودة', 404)
    }

    const now = new Date()
    const effectiveFrom = input.effectiveFrom ?? now
    const scope = { courseId: input.courseId ?? null, cohortId: input.cohortId ?? null }
    const rule = await this.prisma.$transaction(async (tx) => {
      await tx.trainerCompensationRule.updateMany({
        where: { profileId: input.profileId, effectiveTo: null, ...scope },
        data: { effectiveTo: effectiveFrom },
      })
      const created = await tx.trainerCompensationRule.create({
        data: {
          profileId: input.profileId, type: input.type, rate: input.rate,
          referralRate: input.type === 'per_seat' && input.referralRate !== undefined ? input.referralRate : null,
          currency: input.currency ?? LEDGER_CURRENCY, minSeats, ...scope, effectiveFrom, createdBy: actorId,
        },
      })
      await recordAudit(tx, {
        actorId, action: 'trainer_compensation.set_rule', entityType: 'TrainerCompensationRule', entityId: created.id,
        meta: { profileId: input.profileId, type: input.type, rate: input.rate, minSeats, ...scope, effectiveFrom },
      })
      return created
    })
    return rule
  }

  /* مدرب الشعبة الرئيسي — CohortTrainer lead أولاً ثم أي إسناد نشط */
  /** مقاعدُ الشعبة بمصدرها: ما جاء عبر رابط هذا المدرّب، وما عداه.

     والعامُّ يُحسب طرحا لا بشرط `NOT`: في SQL لا يُطابق `NOT (x = y)` الصفَّ
     الذي `x` فيه فارغ — وأكثرُ المقاعد فارغةُ الإحالة، فكان العامُّ يُقرأ صفرا.
     والطرحُ يقرأ الجملةَ مرّةً ويأخذ الباقيَ، فلا يضيع صفٌّ بين الشرطين. */
  private async seatsBySource(cohortId: string, profileId: string) {
    const where = { cohortId, status: { in: ['enrolled', 'completed'] } }
    const [total, referred] = await Promise.all([
      this.prisma.enrollment.count({ where }),
      this.prisma.enrollment.count({ where: { ...where, referralProfileId: profileId } }),
    ])
    return { referred, general: total - referred }
  }

  /* ═══ الأصيلُ يُرشَّح بدوره لا بترتيبٍ أبجديّ ═══

     كان هنا `orderBy: { role: 'asc' }` وفي تعليقه «lead قبل assistant
     أبجدياً» — **والتعليقُ خاطئ**: `'assistant' < 'lead'`. فكلُّ شعبةٍ فيها
     مساعدٌ كانت تُحتسب أتعابُها بقاعدة المساعد وبإحالاته هو، والأصيلُ الذي
     وقّع العقدَ لا يرى مقاعدَ رابطه. وبقيّةُ المستودَع كلُّها ترشّح
     `role: 'lead'` صراحةً (التقارير · تقويمُ الفصل · خطّةُ الشعبة)، وهذا
     الموضعُ وحدَه كان يخالفها.

     وشعبةٌ بلا أصيلٍ لا تُحتسب لمساعدٍ سهوا: تسقط إلى الإسناد، ثمّ إلى
     `no_trainer` — وخطأٌ يُقرأ خيرٌ من صرفٍ لغير صاحبه. */
  private async cohortLeadTrainer(cohortId: string) {
    const lead = await this.prisma.cohortTrainer.findFirst({
      where: { cohortId, role: 'lead' },
    })
    if (lead) return lead.profileId
    const assignment = await this.prisma.trainerCourseAssignment.findFirst({
      where: { cohortId, status: 'active' },
    })
    return assignment?.profileId ?? null
  }

  /* حاسبة مستحقات شعبة — تقرأ القاعدة السارية وتحسب البنود دون إنشاء شيء */
  async computeCohort(cohortId: string) {
    const cohort = await this.prisma.cohort.findUnique({
      where: { id: cohortId },
      include: { course: { include: { versions: { orderBy: { version: 'desc' }, take: 1 } } } },
    })
    if (!cohort) throw new AuthError('unknown_cohort', 'الشعبة غير موجودة', 404)

    const profileId = await this.cohortLeadTrainer(cohortId)
    if (!profileId) throw new AuthError('no_trainer', 'لا مدرب مسنداً لهذه الشعبة', 409)
    /* القاعدة الأدق نطاقاً تفوز: شعبة ← دورة ← عامة */
    const rule = await this.activeRule(profileId, { cohortId, courseId: cohort.courseId })
    if (!rule) throw new AuthError('no_rule', 'لا قاعدة أتعاب سارية لهذا المدرب — عيّن قاعدة أولاً', 409)

    const courseTitle = cohort.course.versions[0]?.titleAr ?? cohort.title
    const items: { description: string; amount: number; sourceRef?: string }[] = []

    if (rule.type === 'per_seat') {
      /* ═══ المقعدُ العامُّ والمقعدُ بالإحالة — بندان لا بند ═══

         قرارُ صاحب المنصّة (٨ سبتمبر ٢٠٢٦): من جاء برابط المدرّب يُحسب له بأجرٍ
         مختلف. فيُعدّ الصنفان على حدة ويُكتبان بندين — ليقرأ المدرّبُ في كشفه
         كم جاءه من رابطه وكم عامّا، لا رقما واحدا يظنّ فيه الظنون. وبلا
         `referralRate` يُحسب الكلُّ بـ`rate` كما كان. والحدُّ الأدنى يُطبَّق على
         المجموع ويُكمَّل من العامّ. */
      const { referred, general } = await this.seatsBySource(cohortId, profileId)
      const actual = referred + general
      const b = perSeatBreakdown({
        general, referred, rate: Number(rule.rate),
        referralRate: rule.referralRate === null ? null : Number(rule.referralRate),
        minSeats: rule.minSeats,
      })
      const minNote = b.floorApplied ? ` (فعلي ${actual} — طُبق الحد الأدنى ${rule.minSeats})` : ''
      /* ═══ والأعلى يُذكَر أوّلا (٢١ سبتمبر ٢٠٢٦) ═══

         قرارُ صاحب المنصّة: «ابدأ بالأعلى وهو رابط الإحالة الخاص به وبعدها
         نذكر السعر الاعتيادي». وكان بندُ العامّ يتصدّر الكشفَ وبندُ الإحالة
         يتبعه بكلمة «منهم» — وهي تحيل إلى ما قبلها، فلمّا تقدّم لم يبقَ لها
         مرجع. فصار نصُّه قائما بنفسه.

         والمجموعُ لا يتأثّر: ترتيبُ البنود عرضٌ، وجمعُها يقع على مصفوفةٍ
         كاملة. وسقفُ الكشف ومنعُ التكرار يقرآن `sourceRef` لا الموضع. */
      if (referred > 0) {
        const r = rule.referralRate === null ? Number(rule.rate) : Number(rule.referralRate)
        items.push({
          description: `تدريب «${courseTitle}» — عبر رابطك ${referred} متعلماً × ${r} ${rule.currency}`,
          amount: b.referralAmount,
          sourceRef: `cohort:${cohortId}:referral`,
        })
      }
      items.push({
        description: `تدريب «${courseTitle}» — ${b.generalSeats} متعلماً عامّا × ${Number(rule.rate)} ${rule.currency}${minNote}`,
        amount: b.generalAmount,
        sourceRef: `cohort:${cohortId}`,
      })
    } else if (rule.type === 'fixed_per_cohort') {
      items.push({
        description: `أتعاب ثابتة — شعبة «${cohort.title}» (${courseTitle})`,
        amount: Number(rule.rate),
        sourceRef: `cohort:${cohortId}`,
      })
    } else {
      /* revenue_share — نسبة من إيراد الشعبة المدفوع فعلياً */
      const paidItems = await this.prisma.orderItem.findMany({
        where: { kind: 'cohort', refId: cohortId, order: { status: 'paid' } },
        select: { unitPrice: true, quantity: true },
      })
      const revenue = paidItems.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0)
      items.push({
        description: `${Number(rule.rate)}٪ من إيراد شعبة «${cohort.title}» — إيراد مدفوع ${revenue} ${rule.currency}`,
        amount: Math.round(revenue * Number(rule.rate)) / 100,
        sourceRef: `cohort:${cohortId}`,
      })
    }

    const total = items.reduce((s, i) => s + i.amount, 0)
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { id: profileId }, include: { application: { select: { fullName: true, reference: true } } },
    })
    return {
      cohort: { id: cohort.id, title: cohort.title, status: cohort.status, courseTitle },
      profile: { id: profileId, fullName: profile?.application.fullName ?? '—' },
      rule: {
        type: rule.type, rate: Number(rule.rate), currency: rule.currency, minSeats: rule.minSeats,
        referralRate: rule.referralRate === null ? null : Number(rule.referralRate),
        scope: rule.cohortId ? 'cohort' : rule.courseId ? 'course' : 'general',
      },
      items, total,
    }
  }

  /* توليد كشف حقيقي من شعبة مكتملة — يمنع التكرار عبر sourceRef */
  async generateForCohort(actorId: string | null, cohortId: string, period?: string) {
    const cohort = await this.prisma.cohort.findUnique({ where: { id: cohortId } })
    if (!cohort) throw new AuthError('unknown_cohort', 'الشعبة غير موجودة', 404)
    if (cohort.status !== 'completed') {
      throw new AuthError('not_completed', 'التوليد التلقائي لشعبة مكتملة فقط', 409)
    }
    const computed = await this.computeCohort(cohortId)
    const finalPeriod = period ?? (cohort.endsAt ?? new Date()).toISOString().slice(0, 7)
    if (!PERIOD_RE.test(finalPeriod)) throw new AuthError('bad_period', 'صيغة الفترة يجب أن تكون مثل 2026-08', 400)

    /* لا كشفين غير ملغيين لنفس الشعبة — البند يحمل مرجعها */
    const duplicate = await this.prisma.trainerPayout.findFirst({
      where: {
        profileId: computed.profile.id, status: { not: 'cancelled' },
        items: { some: { sourceRef: `cohort:${cohortId}` } },
      },
    })
    if (duplicate) throw new AuthError('duplicate_cohort', 'ولّدت مستحقات هذه الشعبة لهذا المدرب من قبل', 409)

    /* ═══ وخصومُه هو تُحسم هنا — البند 4-10 ═══

       «أدرج المبلغ المستعمل بندا مستقلا باسمه في أول كشف مستحقات يحرر
       للمدرب بعد ذلك، وحسم منه، وبين في الكشف لمن صدر ومتى استعمل».

       وثلاثةٌ في هذا السطر لا واحد: **بندٌ مستقلٌّ** (لا رقمٌ مطروحٌ من بندِ
       تدريبٍ فلا يُرى)، **وباسمه** (يقرأ عمّن حُسم بعد شهرين)، **وفي أوّل
       كشفٍ يليه** (لا في كشف الشعبة التي استُعمل فيها — قد لا تكون له شعبةٌ
       فيها أصلا).

       والسقفُ من البند نفسِه: «لا يتجاوز مجموع ما يحسم… قيمة ذلك الكشف، وما
       زاد أجل إلى الكشف الذي يليه». فيبقى الكشفُ موجبا أبدا — وكشفٌ سالبٌ
       يصير مطالبةً بمالٍ في ذمّته، وذلك ما يمنعه الذيلُ صراحةً. */
    /* ويُقرأ الصفُّ هنا لا عبر `TrainerDiscountService`: تلك تنادي هذه الخدمةَ
       لتحسب رصيدَ المدرّب، فاستيرادُها هنا حلقةُ وحداتٍ في زمن التشغيل. */
    const pending = await this.prisma.trainerIssuedDiscount.findMany({
      where: { profileId: computed.profile.id, status: 'used', settledItemId: null },
      include: { coupon: { select: { code: true } } },
      orderBy: { usedAt: 'asc' },
    })
    const { taken } = settleAgainst(
      computed.total,
      pending.map((d) => ({ id: d.id, amount: Number(d.amount) })),
    )
    const byId = new Map(pending.map((d) => [d.id, d]))
    const discountItems = taken.map((t) => {
      const d = byId.get(t.id)!
      const usedOn = d.usedAt ? ` · استُعمل ${d.usedAt.toISOString().slice(0, 10)}` : ''
      return {
        description: `حسم خصم أصدرتَه — ${d.forWhomAr} (${d.coupon.code})${usedOn}`,
        amount: -Number(d.amount),
        sourceRef: `trainer_discount:${d.id}`,
      }
    })
    const items = [...computed.items, ...discountItems]
    const total = items.reduce((sum, i) => sum + i.amount, 0)

    const payout = await this.prisma.$transaction(async (tx) => {
      const created = await tx.trainerPayout.create({
        data: {
          profileId: computed.profile.id, period: finalPeriod,
          currency: computed.rule.currency, total,
          items: { create: items },
        },
        include: { items: true },
      })
      /* والوسمُ داخلَ المعاملة: كشفٌ يحمل بندَ حسمٍ وخصمٌ ما زال «مستعمَلا»
         يُحسم ثانيةً في الكشف الذي يليه. و`settledItemId` هو ما يمنع ذلك،
         فيُكتب مع الكشف أو لا يُكتب كلاهما. */
      for (const t of taken) {
        const item = created.items.find((i) => i.sourceRef === `trainer_discount:${t.id}`)
        await tx.trainerIssuedDiscount.updateMany({
          where: { id: t.id, status: 'used', settledItemId: null },
          data: { status: 'settled', settledAt: new Date(), settledItemId: item?.id ?? null },
        })
      }
      return created
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer_payout.generate', entityType: 'TrainerPayout', entityId: payout.id,
      meta: {
        cohortId, period: finalPeriod, total, gross: computed.total, rule: computed.rule,
        discountsSettled: taken.length,
      },
    })
    /* والإشعارُ يقول الصافيَ لا الإجماليَّ حين حُسم منه شيء — ورقمٌ في
       الإشعار يخالف ما في الكشف أسوأُ من إشعارٍ لا يُرسَل. */
    const deducted = discountItems.reduce((sum, i) => sum - i.amount, 0)
    await this.notifyTrainer(computed.profile.id, 'وُلّد كشف مستحقاتك تلقائياً',
      `اكتملت شعبة «${computed.cohort.title}» وحُسبت مستحقاتك عنها: ${total} ${payout.currency} لفترة ${finalPeriod}`
      + `${deducted > 0 ? ` (بعد حسم ${deducted} من خصومٍ أصدرتَها بنفسك)` : ''} — بانتظار اعتماد الإدارة المالية.`,
      { payoutId: payout.id, cohortId, period: finalPeriod, total, gross: computed.total, deducted })
    return payout
  }

  /* توليد دفعي — كل الشعب المكتملة التي لم تُولّد بعد؛ الأعطال الجزئية تُرصد ولا توقف البقية */
  async generateBatch(actorId: string, period?: string) {
    const completed = await this.prisma.cohort.findMany({
      where: { status: 'completed' }, select: { id: true, title: true },
    })
    const generated: { cohortId: string; title: string; payoutId: string; total: number }[] = []
    const skipped: { cohortId: string; title: string; reason: string }[] = []
    for (const c of completed) {
      try {
        const p = await this.generateForCohort(actorId, c.id, period)
        generated.push({ cohortId: c.id, title: c.title, payoutId: p.id, total: Number(p.total) })
      } catch (e) {
        skipped.push({ cohortId: c.id, title: c.title, reason: e instanceof AuthError ? e.message : 'خطأ غير متوقع' })
      }
    }
    return { generated, skipped }
  }
}
