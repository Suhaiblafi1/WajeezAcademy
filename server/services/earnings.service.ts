/* خدمة مستحقات المدربين — كشوف شهرية ببنود، بدورة حياة صارمة:
   pending (بانتظار الاعتماد) → approved (معتمد) → paid (مدفوع)
   أو إلغاء من pending/approved بسبب موثق. كل انتقال يُسجل في سجل التدقيق.
   النماذج كانت موجودة في القاعدة (TrainerPayout/TrainerPayoutItem) — هذه الخدمة
   هي أول من يفعّلها فعليًا. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'

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
    const summary = { pending: 0, approved: 0, paid: 0, currency: payouts[0]?.currency ?? 'JOD' }
    for (const p of payouts) {
      if (p.status === 'pending') summary.pending += Number(p.total)
      else if (p.status === 'approved') summary.approved += Number(p.total)
      else if (p.status === 'paid') summary.paid += Number(p.total)
    }
    return { payouts, summary }
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
      where: { suspendedAt: null, application: { status: 'active' } },
      include: { application: { select: { fullName: true, reference: true } } },
      orderBy: { createdAt: 'asc' },
    })
    return profiles.map((p) => ({
      id: p.id, fullName: p.application.fullName, reference: p.application.reference,
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
        currency: input.currency ?? 'JOD',
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
    return payout
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
    return updated
  }

  approve(id: string, actorId: string) {
    return this.transition(id, actorId, ['pending'], 'approved', 'trainer_payout.approve', { approvedBy: actorId })
  }

  markPaid(id: string, actorId: string) {
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

  /* القاعدة السارية لمدرب الآن — الأحدث سرياناً */
  async activeRule(profileId: string, at = new Date()) {
    return this.prisma.trainerCompensationRule.findFirst({
      where: {
        profileId,
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    })
  }

  /* تعيين قاعدة جديدة — تُغلق القاعدة المفتوحة الحالية تلقائياً (لا تعديل صامت للتاريخ) */
  async setRule(actorId: string, input: {
    profileId: string; type: string; rate: number; currency?: string; effectiveFrom?: Date
  }) {
    if (!['per_seat', 'fixed_per_cohort', 'revenue_share'].includes(input.type)) {
      throw new AuthError('bad_type', 'نوع القاعدة يجب أن يكون per_seat أو fixed_per_cohort أو revenue_share', 400)
    }
    if (!(input.rate > 0)) throw new AuthError('bad_rate', 'المعدل يجب أن يكون أكبر من صفر', 400)
    if (input.type === 'revenue_share' && input.rate > 100) {
      throw new AuthError('bad_rate', 'نسبة الإيراد لا تتجاوز 100', 400)
    }
    const profile = await this.prisma.trainerProfile.findUnique({ where: { id: input.profileId } })
    if (!profile) throw new AuthError('unknown_profile', 'ملف المدرب غير موجود', 404)

    const now = new Date()
    const effectiveFrom = input.effectiveFrom ?? now
    const rule = await this.prisma.$transaction(async (tx) => {
      await tx.trainerCompensationRule.updateMany({
        where: { profileId: input.profileId, effectiveTo: null },
        data: { effectiveTo: effectiveFrom },
      })
      const created = await tx.trainerCompensationRule.create({
        data: {
          profileId: input.profileId, type: input.type, rate: input.rate,
          currency: input.currency ?? 'JOD', effectiveFrom, createdBy: actorId,
        },
      })
      await recordAudit(tx, {
        actorId, action: 'trainer_compensation.set_rule', entityType: 'TrainerCompensationRule', entityId: created.id,
        meta: { profileId: input.profileId, type: input.type, rate: input.rate, effectiveFrom },
      })
      return created
    })
    return rule
  }

  /* مدرب الشعبة الرئيسي — CohortTrainer lead أولاً ثم أي إسناد نشط */
  private async cohortLeadTrainer(cohortId: string) {
    const lead = await this.prisma.cohortTrainer.findFirst({
      where: { cohortId }, orderBy: { role: 'asc' }, // lead قبل assistant أبجدياً
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
    const rule = await this.activeRule(profileId)
    if (!rule) throw new AuthError('no_rule', 'لا قاعدة أتعاب سارية لهذا المدرب — عيّن قاعدة أولاً', 409)

    const courseTitle = cohort.course.versions[0]?.titleAr ?? cohort.title
    const items: { description: string; amount: number; sourceRef?: string }[] = []

    if (rule.type === 'per_seat') {
      const seats = await this.prisma.enrollment.count({
        where: { cohortId, status: { in: ['enrolled', 'completed'] } },
      })
      items.push({
        description: `تدريب «${courseTitle}» — ${seats} متعلماً × ${Number(rule.rate)} ${rule.currency}`,
        amount: seats * Number(rule.rate),
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
      rule: { type: rule.type, rate: Number(rule.rate), currency: rule.currency },
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

    const payout = await this.prisma.trainerPayout.create({
      data: {
        profileId: computed.profile.id, period: finalPeriod,
        currency: computed.rule.currency, total: computed.total,
        items: { create: computed.items },
      },
      include: { items: true },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer_payout.generate', entityType: 'TrainerPayout', entityId: payout.id,
      meta: { cohortId, period: finalPeriod, total: computed.total, rule: computed.rule },
    })
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
