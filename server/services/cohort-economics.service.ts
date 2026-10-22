/* أغطّت الشعبةُ حقَّ مدرّبها؟ — وقائمةُ «تبدأ قريبا» (٢٢ أكتوبر ٢٠٢٦).

   الحكمُ في `src/application/trainer/cohort-economics.ts`، وهنا جمعُ بيّنته وحدَه: مدرّبُ الشعبة
   الذي تُحتسب له (`cohort-lead.ts`)، وقاعدتُه السارية (`EarningsService.activeRule`)، ومقاعدُها
   المحتسبة (`countedSeats`) — الثلاثةُ نفسُها التي يُكتب منها كشفُه، فلا يفترق الرقمان.

   والمحصَّلُ من بنود الطلبات: بندُ `cohort` الذي `refId`ه الشعبة، في طلبٍ مدفوعٍ أو رُدّ بعضُه،
   بحصّته من صافي الطلب (`lineNet`). وما رُدّ كاملا لا يُحصَّل منه شيء. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { EarningsService, countedSeats } from './earnings.service'
import { cohortLeadTrainers } from './cohort-lead'
import { cohortEconomics, lineNet, type CohortEconomics } from '../../src/application/trainer/cohort-economics'
import { cohortStartedForFloor } from '../../src/application/trainer/seat-fee'
import { UPCOMING_MAX_DAYS, UPCOMING_STATUSES, isUpcoming } from '../../src/application/learning/upcoming-cohorts'
import { LEDGER_CURRENCY } from '../../src/application/commerce/presentment'

export interface CohortMoney extends CohortEconomics {
  cohortId: string
  currency: string
  trainerName: string | null
  rule: { type: string; rate: number; minSeats: number; referralRate: number | null } | null
  /** المسجّلون الآن، والمحتسَبون منهم للمدرّب */
  enrolled: number
  counted: number
}

export interface UpcomingCohort {
  id: string
  title: string
  courseTitle: string
  status: string
  firstAt: string
  capacity: number | null
  money: CohortMoney
}

export class CohortEconomicsService {
  private prisma: PrismaClient
  private earnings: EarningsService
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.earnings = new EarningsService(prisma)
  }

  /** صافي ما حُصّل لكلّ شعبة */
  async collected(cohortIds: readonly string[]): Promise<Map<string, number>> {
    const out = new Map<string, number>()
    if (cohortIds.length === 0) return out
    const lines = await this.prisma.orderItem.findMany({
      where: { kind: 'cohort', refId: { in: [...cohortIds] }, order: { status: { in: ['paid', 'partially_refunded'] } } },
      select: {
        refId: true, unitPrice: true, quantity: true,
        order: {
          select: {
            subtotal: true, total: true,
            invoice: { select: { payments: { select: { refunds: { where: { status: 'processed' }, select: { amount: true } } } } } },
          },
        },
      },
    })
    for (const l of lines) {
      const refunded = (l.order.invoice?.payments ?? [])
        .flatMap((p) => p.refunds).reduce((s, r) => s + Number(r.amount), 0)
      const share = lineNet(
        { unitPrice: Number(l.unitPrice), quantity: l.quantity },
        { subtotal: Number(l.order.subtotal), total: Number(l.order.total), refunded },
      )
      out.set(l.refId, (out.get(l.refId) ?? 0) + share)
    }
    return out
  }

  /** مالُ شعبٍ كثيرة — المدرّبُ وقاعدتُه ومقاعدُه والمحصَّل */
  async forCohorts(cohortIds: readonly string[]): Promise<Map<string, CohortMoney>> {
    const out = new Map<string, CohortMoney>()
    if (cohortIds.length === 0) return out
    const [cohorts, leads, collected] = await Promise.all([
      this.prisma.cohort.findMany({
        where: { id: { in: [...cohortIds] } },
        select: {
          id: true, status: true, courseId: true,
          _count: { select: { enrollments: { where: { status: 'enrolled' } } } },
        },
      }),
      cohortLeadTrainers(this.prisma, cohortIds),
      this.collected(cohortIds),
    ])
    const profileIds = [...new Set(leads.values())]
    const profiles = profileIds.length === 0 ? [] : await this.prisma.trainerProfile.findMany({
      where: { id: { in: profileIds } },
      select: { id: true, application: { select: { fullName: true } } },
    })
    const nameOf = new Map(profiles.map((p) => [p.id, p.application.fullName]))

    for (const c of cohorts) {
      const profileId = leads.get(c.id) ?? null
      const rule = profileId ? await this.earnings.activeRule(profileId, { cohortId: c.id, courseId: c.courseId }) : null
      const seats = await countedSeats(this.prisma, c.id)
      const referred = profileId ? seats.filter((s) => s.referralProfileId === profileId).length : 0
      const ruleView = rule
        ? {
          type: rule.type, rate: Number(rule.rate), minSeats: rule.minSeats,
          referralRate: rule.referralRate === null ? null : Number(rule.referralRate),
        }
        : null
      const econ = cohortEconomics({
        hasTrainer: profileId !== null,
        rule: ruleView,
        seats: { general: seats.length - referred, referred },
        collected: collected.get(c.id) ?? 0,
        started: cohortStartedForFloor(c.status),
      })
      out.set(c.id, {
        ...econ,
        cohortId: c.id,
        currency: rule?.currency ?? LEDGER_CURRENCY,
        trainerName: profileId ? nameOf.get(profileId) ?? null : null,
        rule: ruleView,
        enrolled: c._count.enrollments,
        counted: seats.length,
      })
    }
    return out
  }

  async forCohort(cohortId: string): Promise<CohortMoney> {
    const money = (await this.forCohorts([cohortId])).get(cohortId)
    if (!money) throw new AuthError('not_found', 'الشعبة غير موجودة', 404)
    return money
  }

  /** ما يبدأ خلال `days` يوما ولم يبدأ — بأقربه أوّلا، ومعه ماله */
  async upcoming(days = UPCOMING_MAX_DAYS, now = new Date()): Promise<UpcomingCohort[]> {
    const rows = await this.prisma.cohort.findMany({
      where: { status: { in: [...UPCOMING_STATUSES] } },
      select: {
        id: true, title: true, status: true, startsAt: true, capacity: true,
        course: { select: { versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } } },
        sessions: {
          where: { status: { not: 'cancelled' }, placeholder: false, approvalState: 'approved' },
          orderBy: { startsAt: 'asc' }, take: 1, select: { startsAt: true },
        },
      },
    })
    const near = rows
      .map((c) => ({ ...c, firstAt: c.sessions[0]?.startsAt ?? c.startsAt }))
      .filter((c) => isUpcoming(c, now, days))
      .sort((a, b) => a.firstAt!.getTime() - b.firstAt!.getTime())
    const money = await this.forCohorts(near.map((c) => c.id))
    return near.map((c) => ({
      id: c.id, title: c.title, status: c.status,
      courseTitle: c.course.versions[0]?.titleAr ?? '',
      firstAt: c.firstAt!.toISOString(),
      capacity: c.capacity,
      money: money.get(c.id)!,
    }))
  }
}
