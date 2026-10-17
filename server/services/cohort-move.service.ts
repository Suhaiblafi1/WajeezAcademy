/* ═══ نقلُ الشعبة إلى فصلٍ آخر — المدرّبُ يطلب والإدارةُ تعتمد (١٧ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة وعلّتُه في `src/application/trainer/cohort-move.ts`. وهنا ما يقع:

   · **الطلب** من المدرّب المسنَد إلى الشعبة: فصلٌ قادمٌ وسبب. يُحفظ فصلُها وأوّلُ لقاءاتها
     وقتَه، ولا يتغيّر شيءٌ في الشعبة. وطلبٌ معلَّقٌ واحدٌ للشعبة — والمدرّبُ يسحب ثمّ يطلب.
   · **الاعتماد** من الإدارة يزيح مواعيدَ الشعبة ولقاءاتِها القائمة بأسابيعَ كاملة، ويربطها
     بفصلها الجديد إن كان منشأً، ويحدّث دعوةَ كلّ لقاء، ويبلّغ المتعلّمين بالجرس والبريد.
   · **الردّ** يُبقي كلَّ شيءٍ كما كان، ويصل المدرّبَ بسببه. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { notifyRole, safeNotify } from './notification.service'
import { SessionInviteService } from './session-invite.service'
import { termOf } from '../../src/application/terms/season'
import { fmtDateWith } from '../../src/application/text/format-ar'
import { ACADEMY_ZONE } from '../../src/application/trainer/cohort-period'
import {
  moveProblemAr, moveShiftMs, shiftDate, termLabelAr, type TermRef,
} from '../../src/application/trainer/cohort-move'
import { TRAINING_SEASON_VALUES, type TrainingSeason } from '../../src/application/trainer/application-options'

/** من يُبلَّغ بطلبٍ جديد — من يملك قرارَ الشعب */
export const COHORT_MOVE_STAFF_ROLES = ['super_admin', 'academic_manager', 'operations_manager']

const isSeason = (s: string | null | undefined): s is TrainingSeason =>
  Boolean(s && (TRAINING_SEASON_VALUES as readonly string[]).includes(s))

const dayAr = (d: Date) => fmtDateWith(d, { year: 'numeric', month: 'long', day: 'numeric', timeZone: ACADEMY_ZONE })

export class CohortMoveService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** فصلُ الشعبة اليوم وأوّلُ لقاءاتها — من فصلها المربوط، وإلّا من أوّل موعدٍ فيها */
  async where(cohortId: string): Promise<{ status: string; title: string; current: TermRef | null; firstStartsAt: Date | null }> {
    const c = await this.prisma.cohort.findUnique({
      where: { id: cohortId },
      select: {
        status: true, title: true, startsAt: true,
        term: { select: { year: true, season: true } },
        sessions: { where: { status: { notIn: ['cancelled'] } }, orderBy: { startsAt: 'asc' }, take: 1, select: { startsAt: true } },
      },
    })
    if (!c) throw new AuthError('not_found', 'الشعبة غير موجودة', 404)
    const firstStartsAt = c.sessions[0]?.startsAt ?? c.startsAt ?? null
    const current: TermRef | null = c.term && isSeason(c.term.season)
      ? { year: c.term.year, season: c.term.season }
      : firstStartsAt ? termOf(firstStartsAt) : null
    return { status: c.status, title: c.title, current, firstStartsAt }
  }

  /** يطلب المدرّبُ — ولا يتغيّر شيء */
  async request(userId: string, cohortId: string, input: { toYear: number; toSeason: string; reason: string }) {
    if (!isSeason(input.toSeason)) throw new AuthError('bad_season', 'اختر فصلا من القائمة')
    const target: TermRef = { year: input.toYear, season: input.toSeason }
    const w = await this.where(cohortId)
    const problem = moveProblemAr({ ...w, target, now: new Date(), reason: input.reason })
    if (problem) throw new AuthError('move_refused', problem)

    const open = await this.prisma.cohortMoveRequest.findFirst({ where: { cohortId, status: 'pending' }, select: { id: true } })
    if (open) throw new AuthError('already_pending', 'لهذه الشعبة طلب نقل ينتظر — اسحبه أولا', 409)

    const created = await this.prisma.cohortMoveRequest.create({
      data: {
        cohortId, requestedBy: userId,
        fromYear: w.current?.year ?? null, fromSeason: w.current?.season ?? null, fromStartsAt: w.firstStartsAt,
        toYear: target.year, toSeason: target.season, reason: input.reason.trim(),
      },
    })
    await recordAudit(this.prisma, {
      actorId: userId, action: 'cohort.move.request', entityType: 'cohort', entityId: cohortId,
      meta: { requestId: created.id, to: `${target.season}-${target.year}` },
    })
    await notifyRole(this.prisma, COHORT_MOVE_STAFF_ROLES, {
      channel: 'in_app',
      title: `طلب نقل «${w.title}» إلى ${termLabelAr(target)}`,
      body: 'ينتظر قرارك في «الشعب» — لا يتغيّر موعد حتّى تعتمده.',
      data: { cohortId, requestId: created.id },
    })
    return created
  }

  /** طلباتُ المدرّب نفسِه — ليرى أين وقفت على بطاقة شعبته */
  async mine(userId: string) {
    return this.prisma.cohortMoveRequest.findMany({
      where: { requestedBy: userId }, orderBy: { createdAt: 'desc' }, take: 50,
    })
  }

  async withdraw(userId: string, id: string) {
    const r = await this.prisma.cohortMoveRequest.findUnique({ where: { id } })
    if (!r || r.requestedBy !== userId) throw new AuthError('not_found', 'الطلب غير موجود', 404)
    if (r.status !== 'pending') throw new AuthError('not_pending', 'لا يسحب طلب حسم', 409)
    await recordAudit(this.prisma, {
      actorId: userId, action: 'cohort.move.withdraw', entityType: 'cohort', entityId: r.cohortId, meta: { requestId: id },
    })
    return this.prisma.cohortMoveRequest.update({ where: { id }, data: { status: 'withdrawn' } })
  }

  /** ما ينتظر قرارَ الإدارة — ومعه عددُ المتعلّمين ليُقرأ أثرُ الاعتماد قبله */
  async pending() {
    const rows = await this.prisma.cohortMoveRequest.findMany({
      where: { status: 'pending' }, orderBy: { createdAt: 'asc' },
      include: { cohort: { select: { id: true, title: true, _count: { select: { enrollments: { where: { status: { not: 'dropped' } } } } } } } },
    })
    const names = new Map((await this.prisma.user.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.requestedBy))] } }, select: { id: true, displayName: true },
    })).map((u) => [u.id, u.displayName]))
    return rows.map((r) => ({
      id: r.id, cohortId: r.cohortId, cohortTitle: r.cohort.title, learners: r.cohort._count.enrollments,
      requester: names.get(r.requestedBy) ?? '—', reason: r.reason, createdAt: r.createdAt,
      fromStartsAt: r.fromStartsAt,
      fromAr: r.fromYear !== null && isSeason(r.fromSeason) ? termLabelAr({ year: r.fromYear, season: r.fromSeason }) : null,
      toAr: isSeason(r.toSeason) ? termLabelAr({ year: r.toYear, season: r.toSeason }) : r.toSeason,
      newStartsAt: r.fromYear !== null && isSeason(r.fromSeason) && isSeason(r.toSeason)
        ? shiftDate(r.fromStartsAt, moveShiftMs({ year: r.fromYear, season: r.fromSeason }, { year: r.toYear, season: r.toSeason }))
        : null,
    }))
  }

  /** قرارُ الإدارة — والاعتمادُ وحده ينقل الشعبة */
  async review(reviewerId: string, id: string, input: { action: 'approve' | 'reject'; comment?: string }) {
    const r = await this.prisma.cohortMoveRequest.findUnique({ where: { id } })
    if (!r) throw new AuthError('not_found', 'الطلب غير موجود', 404)
    if (r.status !== 'pending') throw new AuthError('not_pending', 'حسم هذا الطلب من قبل', 409)
    if (!isSeason(r.toSeason)) throw new AuthError('bad_season', 'فصل الطلب غير معروف')
    const target: TermRef = { year: r.toYear, season: r.toSeason }
    const comment = input.comment?.trim() || null

    let shiftMs = 0
    let title = ''
    if (input.action === 'approve') {
      /* يُعاد الفحصُ اليوم لا يومَ الطلب: شعبةٌ بدأت بعده لا تُنقل، والفصلُ يُقرأ من حالها الآن */
      const w = await this.where(r.cohortId)
      title = w.title
      const problem = moveProblemAr({ ...w, target, now: new Date(), reason: r.reason })
      if (problem) throw new AuthError('move_refused', problem, 409)
      if (!w.current) throw new AuthError('move_refused', 'لا موعد للشعبة يقاس منه النقل — حدّد لقاءاتها أولا', 409)
      shiftMs = moveShiftMs(w.current, target)
    }

    const decided = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.cohortMoveRequest.update({
        where: { id },
        data: { status: input.action === 'approve' ? 'approved' : 'rejected', reviewedBy: reviewerId, reviewedAt: new Date(), reviewerComment: comment },
      })
      if (input.action === 'approve') {
        const c = await tx.cohort.findUniqueOrThrow({ where: { id: r.cohortId }, select: { startsAt: true, endsAt: true, joinClosesAt: true } })
        const term = await tx.term.findUnique({ where: { year_season: { year: target.year, season: target.season } }, select: { id: true } })
        await tx.cohort.update({
          where: { id: r.cohortId },
          data: {
            startsAt: shiftDate(c.startsAt, shiftMs), endsAt: shiftDate(c.endsAt, shiftMs),
            joinClosesAt: shiftDate(c.joinClosesAt, shiftMs), termId: term?.id ?? null,
          },
        })
        const sessions = await tx.cohortSession.findMany({
          where: { cohortId: r.cohortId, status: { notIn: ['done', 'cancelled'] } }, select: { id: true, startsAt: true, endsAt: true },
        })
        for (const s of sessions) {
          await tx.cohortSession.update({
            where: { id: s.id },
            data: { startsAt: new Date(s.startsAt.getTime() + shiftMs), endsAt: shiftDate(s.endsAt, shiftMs) },
          })
        }
      }
      return updated
    })

    await recordAudit(this.prisma, {
      actorId: reviewerId, action: `cohort.move.${input.action}`, entityType: 'cohort', entityId: r.cohortId,
      meta: { requestId: id, to: `${target.season}-${target.year}`, shiftDays: Math.round(shiftMs / 86_400_000) },
    })

    if (input.action === 'approve') {
      const sessions = await this.prisma.cohortSession.findMany({
        where: { cohortId: r.cohortId, status: { notIn: ['done', 'cancelled'] } }, orderBy: { startsAt: 'asc' }, select: { id: true, startsAt: true },
      })
      /* ودعوةُ التقويم تتحدّث بالمعرّف نفسِه — ولا يُسقط إخفاقُها قرارا وقع */
      const invites = new SessionInviteService(this.prisma)
      for (const s of sessions) {
        await invites.announce(s.id, 'update').catch((e: unknown) => console.error('[invite] تعذّرت كتابة تحديث الدعوة', e))
      }
      const first = sessions[0]?.startsAt
      const learners = await this.prisma.enrollment.findMany({
        where: { cohortId: r.cohortId, status: { not: 'dropped' } }, select: { userId: true },
      })
      const body = `نقلت الشعبة إلى ${termLabelAr(target)}${first ? `، وأول لقاء فيها ${dayAr(first)}` : ''}. راجع جدولك.`
      for (const l of learners) {
        for (const channel of ['in_app', 'email'] as const) {
          await safeNotify(this.prisma, {
            userId: l.userId, channel, audience: 'learner',
            title: `تغيّر موعد «${title}»`, body, data: { cohortId: r.cohortId },
          })
        }
      }
    }
    await safeNotify(this.prisma, {
      userId: r.requestedBy, channel: 'in_app', audience: 'trainer',
      title: input.action === 'approve' ? `اعتمد نقل الشعبة إلى ${termLabelAr(target)}` : 'لم يعتمد طلب نقل الشعبة',
      body: comment ?? (input.action === 'approve' ? 'تحرّكت مواعيدها كلّها، ووصل المتعلّمين الموعد الجديد.' : 'بقيت الشعبة في فصلها.'),
      data: { cohortId: r.cohortId, requestId: id },
    })
    return decided
  }
}
