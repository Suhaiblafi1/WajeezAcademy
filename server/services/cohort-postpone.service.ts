/* ═══ اقتراحُ تأجيل الشعبة إلى الشهر التالي — نرسله نحن، ويقبله المدرّبُ أو تتوقّف (٢٤ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة وعلّتُه في `src/application/trainer/postpone-offer.ts`. وهنا ما يقع:

   · **المعاينة**: شعبُ الشهر المختار التي لم تبدأ (مسودّةٌ أو مفتوحةٌ أو ممتلئة)، وأوّلُ لقاءٍ لكلٍّ منها الآن وبعد
     التأجيل — ولا يُرسل شيءٌ بها.
   · **الإرسال**: لكلّ شعبةٍ اختيرت صفٌّ بمهلةٍ وسبب، وجرسٌ وبريدٌ لمدرّبيها يقولان الموعدين، والمهلةَ، وأنّ الشعبةَ
     تتوقّف تلقائيّا إن لم يقبل حتّى المهلة.
   · **القبول** يزيح الشعبةَ بكلّ مواعيدها كما يزيحها النقل (`CohortMoveService.applyShift`) — والفصلُ لا يتغيّر.
   · **عدمُ القبول** يوقف الشعبةَ الآن، و**السكوتُ** حتّى المهلة يوقفها العاملُ (`cohort_postpone_expire`) — كلاهما
     بالإلغاء نفسِه الذي تفعله الإدارة (`CohortService.transition`)، فيصل متعلّميها ومدرّبَها الخبرُ بسببه.

   وكلُّ حسمٍ يُختم بكتابةٍ مشروطةٍ قبل أثره: قبولٌ وعاملٌ متزامنان لا يزيحان شعبةً ثمّ يلغيانها. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { notifyRole, safeNotify } from './notification.service'
import { CohortService } from './cohort.service'
import { COHORT_MOVE_STAFF_ROLES, CohortMoveService } from './cohort-move.service'
import { fmtDateWith } from '../../src/application/text/format-ar'
import { ACADEMY_ZONE } from '../../src/application/trainer/cohort-period'
import { UPCOMING_STATUSES } from '../../src/application/learning/upcoming-cohorts'
import {
  academyMonth, deadlineProblemAr, declinedReasonAr, expiredReasonAr, shiftByWeeks, weeksToNextMonth,
} from '../../src/application/trainer/postpone-offer'
import { moveWhy } from '../../src/application/learning/session-move'

const DAY_MS = 86_400_000

const dayAr = (d: Date) => fmtDateWith(d, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: ACADEMY_ZONE })
const whenAr = (d: Date) => fmtDateWith(d, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: ACADEMY_ZONE })

const notStarted = (status: string) => (UPCOMING_STATUSES as readonly string[]).includes(status)

export interface PostponeCandidate {
  cohortId: string
  title: string
  status: string
  trainersAr: string[]
  enrolled: number
  fromFirstAt: string
  toFirstAt: string
  weeks: number
  /** ما يمنع إرسالها — جملةٌ تُعرض، أو `null` */
  blockedAr: string | null
}

export class CohortPostponeService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** الشعبُ التي لم تبدأ بعدُ ومعها أوّلُ موعدٍ فيها — أبكرُ لقاءٍ قائمٍ أو بدؤها، أيُّهما أسبق: فالإزاحةُ تُخرج كلَّ ما فيها من الشهر */
  private async notStartedCohorts(where: { id?: { in: string[] } } = {}) {
    const rows = await this.prisma.cohort.findMany({
      where: { ...where, status: { in: [...UPCOMING_STATUSES] } },
      select: {
        id: true, title: true, status: true, startsAt: true,
        sessions: { where: { status: { notIn: ['cancelled', 'done'] } }, orderBy: { startsAt: 'asc' }, take: 1, select: { startsAt: true } },
        trainers: { select: { profile: { select: { userId: true, application: { select: { fullName: true } } } } } },
        _count: { select: { enrollments: { where: { status: { not: 'dropped' } } } } },
        postponeOffers: { where: { status: 'pending' }, take: 1, select: { id: true } },
      },
    })
    return rows.map((c) => {
      const times = [c.sessions[0]?.startsAt, c.startsAt].filter((d): d is Date => Boolean(d))
      const firstAt = times.length ? new Date(Math.min(...times.map((d) => d.getTime()))) : null
      return { ...c, firstAt }
    })
  }

  /** شعبُ الشهر بتوقيت الأكاديميّة — ولا يُرسل بها شيء */
  async preview(year: number, month: number, now = new Date()): Promise<PostponeCandidate[]> {
    const rows = await this.notStartedCohorts()
    return rows
      .filter((c) => c.firstAt && c.firstAt.getTime() > now.getTime())
      .filter((c) => { const m = academyMonth(c.firstAt!); return m.year === year && m.month === month })
      .sort((a, b) => a.firstAt!.getTime() - b.firstAt!.getTime())
      .map((c) => {
        const weeks = weeksToNextMonth(c.firstAt!)
        const trainerIds = c.trainers.map((t) => t.profile.userId).filter(Boolean)
        return {
          cohortId: c.id, title: c.title, status: c.status,
          trainersAr: c.trainers.map((t) => t.profile.application.fullName),
          enrolled: c._count.enrollments,
          fromFirstAt: c.firstAt!.toISOString(),
          toFirstAt: shiftByWeeks(c.firstAt!, weeks).toISOString(),
          weeks,
          blockedAr: c.postponeOffers.length ? 'أرسل لها اقتراح ينتظر الرد'
            : trainerIds.length === 0 ? 'لا مدرب بحساب على هذه الشعبة — لا أحد يصله الاقتراح' : null,
        }
      })
  }

  /** يُرسل لكلّ شعبةٍ اختيرت — وما لا يُرسل يُقال لماذا، ولا يُسقط ما أُرسل غيرَه */
  async send(actorId: string, input: { cohortIds: string[]; deadlineAt: Date; reasonAr: string }, now = new Date()) {
    const reasonAr = input.reasonAr.trim()
    if (!reasonAr) throw new AuthError('reason_required', 'اكتب سبب التأجيل — يصل المدرب كما هو')
    if (input.deadlineAt.getTime() <= now.getTime()) throw new AuthError('bad_deadline', 'المهلة مضت — اختر موعدا قادما')
    const rows = await this.notStartedCohorts({ id: { in: input.cohortIds } })
    const sent: string[] = []
    const skipped: { cohortId: string; title: string; reasonAr: string }[] = []
    for (const id of input.cohortIds) {
      const c = rows.find((r) => r.id === id)
      if (!c) { skipped.push({ cohortId: id, title: '', reasonAr: 'بدأت أو ألغيت' }); continue }
      const trainerIds = [...new Set(c.trainers.map((t) => t.profile.userId).filter((u): u is string => Boolean(u)))]
      const problem = !c.firstAt ? 'لا موعد لها بعد'
        : c.postponeOffers.length ? 'أرسل لها اقتراح ينتظر الرد'
        : trainerIds.length === 0 ? 'لا مدرب بحساب عليها'
        : deadlineProblemAr(input.deadlineAt, now, c.firstAt)
      if (problem) { skipped.push({ cohortId: c.id, title: c.title, reasonAr: problem }); continue }

      const weeks = weeksToNextMonth(c.firstAt!)
      const toFirstAt = shiftByWeeks(c.firstAt!, weeks)
      const offer = await this.prisma.cohortPostponeOffer.create({
        data: {
          cohortId: c.id, proposedBy: actorId, shiftDays: weeks * 7,
          fromFirstAt: c.firstAt!, toFirstAt, reasonAr, deadlineAt: input.deadlineAt,
        },
      })
      await recordAudit(this.prisma, {
        actorId, action: 'cohort.postpone.propose', entityType: 'cohort', entityId: c.id,
        meta: { offerId: offer.id, shiftDays: weeks * 7, deadlineAt: input.deadlineAt.toISOString() },
      })
      const body = [
        `نقترح تأجيل أول لقاء من ${dayAr(c.firstAt!)} إلى ${dayAr(toFirstAt)} — بنفس اليوم والساعة، وتتحرك كل مواعيدها معه.`,
        `السبب: ${reasonAr}.`,
        `إن قبلت قبل ${whenAr(input.deadlineAt)} نؤجلها. وإن لم تقبل حتى هذا الموعد تتوقف الشعبة تلقائيا.`,
      ].join('\n')
      for (const userId of trainerIds) {
        for (const channel of ['in_app', 'email'] as const) {
          await safeNotify(this.prisma, {
            userId, channel, audience: 'trainer', templateKey: 'cohort.postpone.proposed',
            title: `نقترح تأجيل «${c.title}»`, body, data: { cohortId: c.id, offerId: offer.id },
          })
        }
      }
      sent.push(c.id)
    }
    return { sent: sent.length, skipped }
  }

  /** ما أُرسل — آخرُ اقتراحٍ لكلّ شعبةٍ أوّلا، ومعه ما وقع به */
  async list() {
    const rows = await this.prisma.cohortPostponeOffer.findMany({
      orderBy: { createdAt: 'desc' }, take: 100,
      select: {
        id: true, cohortId: true, status: true, fromFirstAt: true, toFirstAt: true, deadlineAt: true, decidedAt: true, createdAt: true,
        cohort: { select: { title: true } },
      },
    })
    return rows.map(({ cohort, ...r }) => ({ ...r, title: cohort.title }))
  }

  /** اقتراحاتُ شعبه التي تنتظر ردَّه — بطاقاتُ «قبل/بعد» في «شعبي» */
  async mine(userId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({ where: { userId }, select: { id: true } })
    if (!profile) return []
    const rows = await this.prisma.cohortPostponeOffer.findMany({
      where: { status: 'pending', cohort: { trainers: { some: { profileId: profile.id } } } },
      orderBy: { deadlineAt: 'asc' },
      select: {
        id: true, cohortId: true, fromFirstAt: true, toFirstAt: true, shiftDays: true, reasonAr: true, deadlineAt: true,
        cohort: { select: { title: true } },
      },
    })
    return rows.map(({ cohort, ...r }) => ({ ...r, title: cohort.title }))
  }

  /** ردُّ المدرّب — يقبل فتُزاح، أو لا فتتوقّف. والمسنَدُ إلى الشعبة وحدَه يردّ */
  async decide(userId: string, offerId: string, action: 'accept' | 'decline', now = new Date()) {
    const offer = await this.prisma.cohortPostponeOffer.findUnique({ where: { id: offerId }, include: { cohort: { select: { title: true, status: true } } } })
    if (!offer) throw new AuthError('not_found', 'الاقتراح غير موجود', 404)
    const profile = await this.prisma.trainerProfile.findUnique({ where: { userId }, select: { id: true } })
    const link = profile && await this.prisma.cohortTrainer.findUnique({
      where: { cohortId_profileId: { cohortId: offer.cohortId, profileId: profile.id } },
    })
    if (!link) throw new AuthError('not_cohort_trainer', 'هذه الشعبة ليست من شعبك', 403)
    if (offer.status !== 'pending') throw new AuthError('not_pending', 'حسم هذا الاقتراح من قبل', 409)
    if (offer.deadlineAt.getTime() <= now.getTime()) {
      await this.expireDue(now)
      throw new AuthError('expired', 'مضت المهلة — توقفت الشعبة', 409)
    }

    if (action === 'accept') {
      const moves = new CohortMoveService(this.prisma)
      const claimed = await this.prisma.$transaction(async (tx) => {
        const c = await tx.cohortPostponeOffer.updateMany({
          where: { id: offerId, status: 'pending' }, data: { status: 'accepted', decidedBy: userId, decidedAt: now },
        })
        if (c.count === 0) return false
        await moves.applyShift(tx, offer.cohortId, offer.shiftDays * DAY_MS)
        return true
      })
      if (!claimed) throw new AuthError('not_pending', 'حسم هذا الاقتراح من قبل', 409)
      await recordAudit(this.prisma, {
        actorId: userId, action: 'cohort.postpone.accept', entityType: 'cohort', entityId: offer.cohortId,
        meta: { offerId, shiftDays: offer.shiftDays },
      })
      /* وسببُ الإدارة في اقتراحها يقرؤه المتعلّمون مع مواعيدهم الجديدة — هي من طلبت، والمدرّبُ قبل (`session-move.ts`) */
      await moves.afterShift(userId, offer.cohortId, {
        title: offer.cohort.title, auditMeta: { offerId },
        shiftMs: offer.shiftDays * DAY_MS, why: moveWhy('accepted', offer.reasonAr),
        noticeAr: (first) => `تأجلت الشعبة${first ? `، وأول لقاء فيها ${dayAr(first)}` : ''}. راجع جدولك.`,
      })
      await notifyRole(this.prisma, COHORT_MOVE_STAFF_ROLES, {
        channel: 'in_app',
        title: `قبل المدرب تأجيل «${offer.cohort.title}»`,
        body: `أول لقاء فيها الآن ${dayAr(offer.toFirstAt)}.`,
        data: { cohortId: offer.cohortId, offerId },
      })
      return { status: 'accepted' as const }
    }

    const claimed = await this.prisma.cohortPostponeOffer.updateMany({
      where: { id: offerId, status: 'pending' }, data: { status: 'declined', decidedBy: userId, decidedAt: now },
    })
    if (claimed.count === 0) throw new AuthError('not_pending', 'حسم هذا الاقتراح من قبل', 409)
    await recordAudit(this.prisma, {
      actorId: userId, action: 'cohort.postpone.decline', entityType: 'cohort', entityId: offer.cohortId, meta: { offerId },
    })
    await this.stop(offer.cohortId, userId, declinedReasonAr)
    await notifyRole(this.prisma, COHORT_MOVE_STAFF_ROLES, {
      channel: 'in_app',
      title: `لم يقبل المدرب تأجيل «${offer.cohort.title}» — أوقفت`,
      body: 'وصل متعلميها الخبر.',
      data: { cohortId: offer.cohortId, offerId },
    })
    return { status: 'declined' as const }
  }

  /** نسحب اقتراحا لم يُحسم — فتبقى الشعبةُ في موعدها، ويُقال لمدرّبها */
  async withdraw(actorId: string, offerId: string) {
    const offer = await this.prisma.cohortPostponeOffer.findUnique({ where: { id: offerId }, include: { cohort: { select: { title: true } } } })
    if (!offer) throw new AuthError('not_found', 'الاقتراح غير موجود', 404)
    const claimed = await this.prisma.cohortPostponeOffer.updateMany({
      where: { id: offerId, status: 'pending' }, data: { status: 'withdrawn', decidedBy: actorId, decidedAt: new Date() },
    })
    if (claimed.count === 0) throw new AuthError('not_pending', 'حسم هذا الاقتراح من قبل', 409)
    await recordAudit(this.prisma, {
      actorId, action: 'cohort.postpone.withdraw', entityType: 'cohort', entityId: offer.cohortId, meta: { offerId },
    })
    const leads = await this.prisma.cohortTrainer.findMany({ where: { cohortId: offer.cohortId }, select: { profile: { select: { userId: true } } } })
    for (const userId of new Set(leads.map((l) => l.profile.userId).filter((u): u is string => Boolean(u)))) {
      await safeNotify(this.prisma, {
        userId, channel: 'in_app', audience: 'trainer',
        title: `سحبنا اقتراح تأجيل «${offer.cohort.title}»`,
        body: 'تبقى الشعبة في موعدها، ولا تتوقف.',
        data: { cohortId: offer.cohortId, offerId },
      })
    }
    return { status: 'withdrawn' as const }
  }

  /** من العامل: ما مضت مهلتُه بلا ردٍّ يوقف شعبتَه. وما بدأت شعبتُه أو أُلغيت بغيره يُسحب بلا أثر */
  async expireDue(now = new Date()): Promise<{ expired: number; withdrawn: number }> {
    const due = await this.prisma.cohortPostponeOffer.findMany({
      where: { status: 'pending', deadlineAt: { lte: now } },
      include: { cohort: { select: { title: true, status: true } } },
    })
    let expired = 0
    let withdrawn = 0
    for (const o of due) {
      const live = notStarted(o.cohort.status)
      const claimed = await this.prisma.cohortPostponeOffer.updateMany({
        where: { id: o.id, status: 'pending' }, data: { status: live ? 'expired' : 'withdrawn', decidedAt: now },
      })
      if (claimed.count === 0) continue
      if (!live) { withdrawn += 1; continue }
      await recordAudit(this.prisma, {
        actorId: null, action: 'cohort.postpone.expire', entityType: 'cohort', entityId: o.cohortId, meta: { offerId: o.id },
      })
      await this.stop(o.cohortId, null, expiredReasonAr)
      await notifyRole(this.prisma, COHORT_MOVE_STAFF_ROLES, {
        channel: 'in_app',
        title: `لم يرد المدرب على تأجيل «${o.cohort.title}» — أوقفت`,
        body: 'مضت المهلة بلا رد، ووصل متعلميها ومدربها الخبر.',
        data: { cohortId: o.cohortId, offerId: o.id },
      })
      expired += 1
    }
    return { expired, withdrawn }
  }

  private async stop(cohortId: string, actorId: string | null, reasonAr: string) {
    await new CohortService(this.prisma).transition(cohortId, 'cancelled', actorId, 'لم يقبل المدرب تأجيلها', { reasonAr })
  }
}
