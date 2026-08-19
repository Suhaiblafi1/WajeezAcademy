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
}
