/* ═══ نقلُ الشعبة إلى فصلٍ آخر — المدرّبُ يطلب والإدارةُ تعتمد (١٧ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة وعلّتُه في `src/application/trainer/cohort-move.ts`. وهنا ما يقع:

   · **الطلب** من المدرّب المسنَد إلى الشعبة: فصلٌ قادمٌ وسبب. يُحفظ فصلُها وأوّلُ لقاءاتها
     وقتَه، ولا يتغيّر شيءٌ في الشعبة. وطلبٌ معلَّقٌ واحدٌ للشعبة — والمدرّبُ يسحب ثمّ يطلب.
   · **الاعتماد** من الإدارة يزيح مواعيدَ الشعبة ولقاءاتِها القائمة بأسابيعَ كاملة، ويربطها
     بفصلها الجديد إن كان منشأً، ويحدّث دعوةَ كلّ لقاء، وينقل اجتماعَه في Zoom إلى موعده الجديد
     (قرارُ صاحب المنصّة، ١٧ أكتوبر ٢٠٢٦: «فلا تصل أحدا تذكرةٌ بالموعد القديم»)، ويبلّغ المتعلّمين
     بالجرس والبريد.
   · **الردّ** يُبقي كلَّ شيءٍ كما كان، ويصل المدرّبَ بسببه. */

import type { Prisma, PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { notifyRole, safeNotify } from './notification.service'
import { SessionInviteService } from './session-invite.service'
import { getZoomConfig, updateZoomMeeting, zoomReady } from './zoom.service'
import { termBounds, termOf } from '../../src/application/terms/season'
import { fmtDateWith } from '../../src/application/text/format-ar'
import { ACADEMY_ZONE, asPeriod, periodBounds, realDate } from '../../src/application/trainer/cohort-period'
import { shiftDatesIn, shiftDay, shiftInstant, shiftPlan, type CopyablePlan } from '../../src/application/trainer/plan-copy'
import {
  moveProblemAr, moveReminderAt, moveShiftMs, shiftDate, termLabelAr, type TermRef,
} from '../../src/application/trainer/cohort-move'
import { TRAINING_SEASON_VALUES, type TrainingSeason } from '../../src/application/trainer/application-options'
import { ensureTerm } from './term-ensure'
import { moveWhy, type MoveWhy } from '../../src/application/learning/session-move'

/** من يُبلَّغ بطلبٍ جديد — من يملك قرارَ الشعب */
export const COHORT_MOVE_STAFF_ROLES = ['super_admin', 'academic_manager', 'operations_manager']

const isSeason = (s: string | null | undefined): s is TrainingSeason =>
  Boolean(s && (TRAINING_SEASON_VALUES as readonly string[]).includes(s))

const DAY_MS = 86_400_000

/** خطّةٌ بتواريخَ مُزاحةٍ أيّاما — أو `null` حين لا مدّةَ فيها تُزاح منها */
function shiftedPlan(raw: unknown, days: number): Prisma.InputJsonValue | null {
  const plan = raw as CopyablePlan | null
  if (!plan?.startsOn || !plan.endsOn || !Array.isArray(plan.resources)) return null
  return (shiftPlan(plan, shiftDay(plan.startsOn, days))?.plan ?? null) as Prisma.InputJsonValue | null
}

/** طلبُ المدرّب على مهمّةٍ بآخر موعدٍ مُزاح — أو `null` حين لا موعدَ فيه (`task-approval.ts`) */
function shiftedTaskChange(raw: unknown, days: number): Prisma.InputJsonValue | null {
  const change = raw as { kind?: string; fields?: { dueAt?: unknown } } | null
  if (change?.kind !== 'edit' || typeof change.fields?.dueAt !== 'string') return null
  return { ...change, fields: { ...change.fields, dueAt: shiftInstant(change.fields.dueAt, days) } } as Prisma.InputJsonValue
}

const dayAr = (d: Date) => fmtDateWith(d, { year: 'numeric', month: 'long', day: 'numeric', timeZone: ACADEMY_ZONE })

export class CohortMoveService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** فصلُ الشعبة اليوم وأوّلُ لقاءاتها — من أوّل موعدٍ فيها، ثمّ بدئها المقترَح، ثمّ فصلها المربوط */
  async where(cohortId: string): Promise<{
    status: string; title: string; current: TermRef | null; firstStartsAt: Date | null; proposedStartsAt: Date | null
  }> {
    const c = await this.prisma.cohort.findUnique({
      where: { id: cohortId },
      select: {
        status: true, title: true, startsAt: true,
        term: { select: { year: true, season: true } },
        sessions: { where: { status: { notIn: ['cancelled'] } }, orderBy: { startsAt: 'asc' }, take: 1, select: { startsAt: true } },
        plans: { where: { trainerId: { not: null } }, orderBy: { createdAt: 'desc' }, take: 1, select: { content: true } },
      },
    })
    if (!c) throw new AuthError('not_found', 'الشعبة غير موجودة', 404)
    const firstStartsAt = c.sessions[0]?.startsAt ?? c.startsAt ?? null
    /* ═══ وشعبةُ الإعداد بلا موعدٍ بعد — فصلُها من البدء المقترَح في خطّتها (٢٠ أكتوبر ٢٠٢٦) ═══
       «انقلها إلى فصل آخر» صار في بطاقة شعبة الإعداد أيضا (`CohortBoard`). وتلك لا بدءَ لها حتّى تُعتمد خطّتُها
       (`applyPeriod`)، ومدّتُها المقترحةُ في الخطّة. فمنها يُعرف فصلُها وتُحسب الإزاحة — ولا تُعدّ «أوّلَ لقاءٍ
       مضى»: مقترحٌ قديمٌ في مسودّةٍ لا يمنع نقلَها إلى فصلٍ قادم. */
    const proposed = asPeriod(c.plans[0]?.content as { startsOn?: string | null; endsOn?: string | null } | null)
    const proposedStartsAt = proposed && realDate(proposed.startsOn) ? periodBounds(proposed).from : null
    /* ═══ وفصلُها من أوّل لقائها لا من صفّ فصلها (١٩ أكتوبر ٢٠٢٦) ═══
       منه تُحسب الإزاحةُ (`moveShiftMs`) وتُستثنى من الخيارات — وصفُّ الفصل قد يفترق عن المواعيد (التأجيلُ يكتبه
       قبل أن تتحرّك)، فتقع المواعيدُ في غير ما اختير. وبطاقةُ المدرّب تحسبه من أوّل لقاءٍ كذلك (`CohortMoveBox`). */
    const anchor = firstStartsAt ?? proposedStartsAt
    const current: TermRef | null = anchor
      ? termOf(anchor)
      : c.term && isSeason(c.term.season) ? { year: c.term.year, season: c.term.season } : null
    return { status: c.status, title: c.title, current, firstStartsAt, proposedStartsAt }
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
        fromYear: w.current?.year ?? null, fromSeason: w.current?.season ?? null, fromStartsAt: w.firstStartsAt ?? w.proposedStartsAt,
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
      body: 'ينتظر قرارك في «تشغيل الشعب» — لا يتغير موعد حتى تعتمده.',
      data: { cohortId, requestId: created.id },
    })
    return created
  }

  /** طلباتُ المدرّب نفسِه — ليرى أين وقفت على بطاقة شعبته.
      ═══ والمعلّقُ على شعبةٍ يدرّس فيها يُرى ولو طلبه شريكُه (٢٠ أكتوبر ٢٠٢٦) ═══
      كان المساعدُ لا يرى طلبَ الرئيس، فيرى «انقلها إلى فصل آخر» ويُردّ بـ«لهذه الشعبة طلب نقل ينتظر — اسحبه
      أوّلا» وهو لا يراه ولا يملك سحبَه. فيُرى، و`mine` يقول هل يسحبه — السحبُ لطالبه وحدَه (`withdraw`). */
  async mine(userId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({ where: { userId }, select: { id: true } })
    const rows = await this.prisma.cohortMoveRequest.findMany({
      where: {
        OR: [
          { requestedBy: userId },
          ...(profile ? [{ status: 'pending', cohort: { trainers: { some: { profileId: profile.id } } } }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' }, take: 50,
    })
    return rows.map((r) => ({ ...r, mine: r.requestedBy === userId }))
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

  /* ── اجتماعاتُ Zoom تنتقل مع لقاءاتها — كما في نقل لقاءٍ واحد (`CohortService.moveZoomMeeting`) ──
     ولا يرمي: المواعيدُ عندنا انتقلت وإخفاقُ Zoom لا يردّها. يُعدّ ما انتقل وما أخفق، ويُكتب في
     الأثر — والرابطُ نفسُه يبقى صالحا. */
  private async moveZoomMeetings(sessions: {
    startsAt: Date; endsAt: Date | null; timezone: string | null; cohort: { timezone: string | null }
    zoom: { provider: string; meetingId: string | null } | null
  }[]): Promise<{ moved: number; failed: number }> {
    const withMeeting = sessions.filter((s) => s.zoom?.provider === 'zoom_api' && s.zoom.meetingId)
    const out = { moved: 0, failed: 0 }
    if (withMeeting.length === 0) return out
    const cfg = await getZoomConfig(this.prisma).catch(() => null)
    if (!cfg || !zoomReady(cfg)) return { moved: 0, failed: withMeeting.length }
    for (const s of withMeeting) {
      try {
        const durationMinutes = s.endsAt ? Math.max(15, Math.round((s.endsAt.getTime() - s.startsAt.getTime()) / 60_000)) : 120
        const res = await updateZoomMeeting(cfg, s.zoom!.meetingId!, {
          startsAt: s.startsAt, durationMinutes, timezone: s.timezone ?? s.cohort.timezone ?? undefined,
        })
        if (res.ok) out.moved += 1
        else { out.failed += 1; console.error('[zoom] تعذّر نقل الاجتماع مع شعبته', s.zoom!.meetingId, res.reason) }
      } catch (e) {
        out.failed += 1
        console.error('[zoom] تعذّر نقل الاجتماع مع شعبته', s.zoom!.meetingId, e)
      }
    }
    return out
  }

  /** قرارُ الإدارة — والاعتمادُ وحده ينقل الشعبة. و`byStaff`: الطلبُ طلبُ الإدارة نفسِها (`staffMove`) لا المدرّب —
      فيقرأ المتعلّمون أنّ الإدارة نقلتها بسببها */
  async review(reviewerId: string, id: string, input: { action: 'approve' | 'reject'; comment?: string }, opts: { tellRequester?: boolean; byStaff?: boolean } = {}) {
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
      /* وشعبةٌ لا موعدَ فيها ولا مقترحَ ولا فصلَ — شعبةُ إعدادٍ لم يكتب مدرّبُها مدّتَها بعد — لا شيءَ فيها يُزاح:
         نقلُها ربطُها بفصلها الجديد وحدَه. وكان يُردّ «حدّد لقاءاتها أولا»، أي يُطلب منه عملٌ قبل أن يؤجّل. */
      shiftMs = w.current ? moveShiftMs(w.current, target) : 0
    }

    const decided = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.cohortMoveRequest.update({
        where: { id },
        data: { status: input.action === 'approve' ? 'approved' : 'rejected', reviewedBy: reviewerId, reviewedAt: new Date(), reviewerComment: comment },
      })
      if (input.action === 'approve') {
        /* والفصلُ يُنشأ إن لم يكن — فلا تسقط المنقولةُ إلى «بلا فصل» (`term-ensure.ts`) */
        const term = await ensureTerm(tx, target)
        await this.applyShift(tx, r.cohortId, shiftMs, { termId: term?.id ?? null })
      }
      return updated
    })

    await recordAudit(this.prisma, {
      actorId: reviewerId, action: `cohort.move.${input.action}`, entityType: 'cohort', entityId: r.cohortId,
      meta: { requestId: id, to: `${target.season}-${target.year}`, shiftDays: Math.round(shiftMs / 86_400_000) },
    })

    if (input.action === 'approve') {
      await this.afterShift(reviewerId, r.cohortId, {
        title, auditMeta: { requestId: id }, shiftMs,
        why: moveWhy(opts.byStaff ? 'staff' : 'trainer', r.reason),
        noticeAr: (first) => `نقلت الشعبة إلى ${termLabelAr(target)}${first ? `، وأول لقاء فيها ${dayAr(first)}` : ''}. راجع جدولك.`,
      })
    }
    if (opts.tellRequester !== false) await safeNotify(this.prisma, {
      userId: r.requestedBy, channel: 'in_app', audience: 'trainer',
      title: input.action === 'approve' ? `اعتمد نقل الشعبة إلى ${termLabelAr(target)}` : 'لم يعتمد طلب نقل الشعبة',
      body: comment ?? (input.action === 'approve' ? 'تحرّكت مواعيدها كلّها، ووصل المتعلّمين الموعد الجديد.' : 'بقيت الشعبة في فصلها.'),
      data: { cohortId: r.cohortId, requestId: id },
    })
    return decided
  }

  /* ═══ إزاحةُ الشعبة بكلّ مواعيدها — داخلَ معاملة (٢٤ أكتوبر ٢٠٢٦) ═══
     كانت في `review` وحدَه. ثمّ جاء تأجيلُ شعب نوفمبر إلى ديسمبر — داخلَ الفصل نفسِه، بموافقة المدرّب لا بطلبه
     (`cohort-postpone.service.ts`) — فصارت بابا واحدا للاثنين: ما يُزاح في النقل يُزاح في التأجيل، بلا نسخةٍ ثانيةٍ
     تفترق. و`termId` يُكتب حين يُعطى وحدَه: التأجيلُ لا يغيّر الفصل. */
  async applyShift(tx: Prisma.TransactionClient, cohortId: string, shiftMs: number, opts: { termId?: string | null } = {}) {
    const c = await tx.cohort.findUniqueOrThrow({
      where: { id: cohortId },
      select: { startsAt: true, endsAt: true, joinClosesAt: true, scheduleWindowStart: true, scheduleWindowEnd: true },
    })
    await tx.cohort.update({
      where: { id: cohortId },
      data: {
        startsAt: shiftDate(c.startsAt, shiftMs), endsAt: shiftDate(c.endsAt, shiftMs),
        joinClosesAt: shiftDate(c.joinClosesAt, shiftMs), ...(opts.termId !== undefined ? { termId: opts.termId } : {}),
        /* ونافذةُ جدولة مدرّبها تنتقل معها (٢٠ أكتوبر ٢٠٢٦): بقاؤها في الفصل القديم يمنعه أن يضع
           لقاءً في مواعيد شعبته الجديدة (`schedule-window.ts`) */
        scheduleWindowStart: shiftDate(c.scheduleWindowStart, shiftMs),
        scheduleWindowEnd: shiftDate(c.scheduleWindowEnd, shiftMs),
      },
    })
    /* ═══ وكلُّ موعدٍ فيها ينتقل معها — خطّتُها ومهامُّها (٢٠ أكتوبر ٢٠٢٦) ═══

       كانت تنتقل الشعبةُ ولقاءاتُها وحدَها. وبقي في الفصل القديم:
       · **خطّتُها** — المدّةُ ومواعيدُ المحاور ولحظاتُ فتح المصادر. ومنها يُحكم متى يُفتح كلُّ شيءٍ
         للمتعلّم، فشعبةٌ نُقلت ستّةَ أشهرٍ تفتح موادَّها قبل أوّل لقاءٍ بستّة أشهر. وشعبةُ الإعداد خطّتُها
         مسودّة، فلو بقيت لاعتُمدت بمدّتها القديمة وعادت الشعبةُ إلى فصلها الأوّل (`applyPeriod`).
       · **ومهامُّها** — آخرُ موعدٍ لكلٍّ، ومعه ما يطلبه المدرّبُ عليها ولم يُعتمد بعد.
       فسأل صاحبُ المنصّة أن تنتقل كلُّها، فتُزاح بالأسابيع نفسِها بما يُزاح به النسخُ (`shiftPlan`): كلُّ
       خطّةٍ قائمةٍ — مسودّةً أو معتمدةً — وما رُدّ إلى مدرّبها ليُقابَل به، ومهلةُ تأجيلها. ولا يُمسّ
       المنسوخُ (`superseded`): سجلُّ ما كان. واعتمادُ الإدارة النقلَ هو اعتمادُ مواعيدها الجديدة. */
    if (shiftMs !== 0) {
      const days = Math.round(shiftMs / DAY_MS)
      const plans = await tx.cohortDeliveryPlan.findMany({
        where: { cohortId, status: { not: 'superseded' } },
        select: { id: true, content: true, returnedContent: true, postponedTo: true },
      })
      for (const p of plans) {
        const content = shiftedPlan(p.content, days)
        const returned = shiftedPlan(p.returnedContent, days)
        if (!content && !returned && !p.postponedTo) continue
        await tx.cohortDeliveryPlan.update({
          where: { id: p.id },
          data: {
            ...(content ? { content } : {}),
            ...(returned ? { returnedContent: returned } : {}),
            ...(p.postponedTo ? { postponedTo: shiftDate(p.postponedTo, shiftMs) } : {}),
          },
        })
      }
      /* ═══ وبطاقاتُ «قبل/بعد» التي لم يُحسم أمرُها (٢٠ أكتوبر ٢٠٢٦) ═══
         بطاقةٌ تنقل لقاءً إلى موعدٍ في الفصل القديم، إن قبلها المدرّبُ بعد النقل، أعادت لقاءه إليه. ولقطةُ
         ما كان في موضعها لو بقيت لقرأت كلَّ بطاقةٍ «تغيّر موضعُها بعدك». فسأل صاحبُ المنصّة أن تُصلح، فتُزاح
         مواعيدُ ما ينتظر الإدارةَ أو المدرّبَ واللقطةُ معها (`shiftDatesIn`). والمحسومُ سجلٌّ لا يُمسّ. */
      const cards = await tx.planEditSuggestion.findMany({
        where: { cohortId, status: { in: ['proposed', 'pending'] } }, select: { id: true, edit: true, before: true },
      })
      for (const c of cards) {
        const edit = shiftDatesIn(c.edit, days)
        const before = c.before === null ? null : shiftDatesIn(c.before, days)
        if (JSON.stringify(edit) === JSON.stringify(c.edit) && JSON.stringify(before) === JSON.stringify(c.before)) continue
        await tx.planEditSuggestion.update({
          where: { id: c.id },
          data: { edit: edit as Prisma.InputJsonValue, ...(before !== null ? { before: before as Prisma.InputJsonValue } : {}) },
        })
      }
      const tasks = await tx.cohortAssessment.findMany({
        where: { cohortId }, select: { id: true, dueAt: true, pendingChange: true },
      })
      for (const t of tasks) {
        const pending = shiftedTaskChange(t.pendingChange, days)
        if (!t.dueAt && !pending) continue
        await tx.cohortAssessment.update({
          where: { id: t.id },
          data: { ...(t.dueAt ? { dueAt: shiftDate(t.dueAt, shiftMs) } : {}), ...(pending ? { pendingChange: pending } : {}) },
        })
      }
    }
    const sessions = await tx.cohortSession.findMany({
      where: { cohortId, status: { notIn: ['done', 'cancelled'] } }, select: { id: true, startsAt: true, endsAt: true },
    })
    for (const s of sessions) {
      await tx.cohortSession.update({
        where: { id: s.id },
        data: { startsAt: new Date(s.startsAt.getTime() + shiftMs), endsAt: shiftDate(s.endsAt, shiftMs) },
      })
    }
  }

  /* وما بعد الإزاحة: اجتماعاتُ Zoom ودعواتُ التقويم وخبرُ المتعلّمين — لا يُسقط إخفاقُها قرارا وقع.
     و`shiftMs` ما أُزيحت به — منه موعدُ كلّ لقاءٍ قبلها، و`why` من طلبها ولماذا (`session-move.ts`): تقولهما
     رسالةُ التقويم لكلّ لقاء («كان … وصار …»)، ويقول السببَ الجرس (٢٨ أكتوبر ٢٠٢٦) */
  async afterShift(actorId: string | null, cohortId: string, opts: {
    title: string; auditMeta: Record<string, unknown>; noticeAr: (first: Date | undefined) => string
    shiftMs: number; why: MoveWhy
  }): Promise<{ moved: number; failed: number }> {
    const sessions = await this.prisma.cohortSession.findMany({
      where: { cohortId, status: { notIn: ['done', 'cancelled'] } }, orderBy: { startsAt: 'asc' },
      select: {
        id: true, startsAt: true, endsAt: true, timezone: true,
        cohort: { select: { timezone: true } }, zoom: { select: { provider: true, meetingId: true } },
      },
    })
    const zoom = await this.moveZoomMeetings(sessions)
    /* ودعوةُ التقويم تتحدّث بالمعرّف نفسِه وتقول موعدَه قبل الإزاحة — ولا يُسقط إخفاقُها قرارا وقع */
    const invites = new SessionInviteService(this.prisma)
    for (const s of sessions) {
      await invites.moved(s.id, new Date(s.startsAt.getTime() - opts.shiftMs), opts.why)
        .catch((e: unknown) => console.error('[invite] تعذّرت كتابة تحديث الدعوة', e))
    }
    if (zoom.moved + zoom.failed > 0) {
      await recordAudit(this.prisma, {
        actorId, action: 'cohort.move.zoom', entityType: 'cohort', entityId: cohortId,
        meta: { ...opts.auditMeta, ...zoom },
      })
    }
    const first = sessions[0]?.startsAt
    const learners = await this.prisma.enrollment.findMany({
      where: { cohortId, status: { not: 'dropped' } }, select: { userId: true },
    })
    const body = `${opts.noticeAr(first)} ${opts.why.learnerAr}`
    /* والبريدُ يخرج معه من مفتاحه (`learner-email.ts`) — وكان هنا حلقةُ قناتين بلا مفتاح،
       فلا يفتح بندُ الجرس شيئا ولا يحمل البريدُ زرّا */
    for (const l of learners) {
      await safeNotify(this.prisma, {
        userId: l.userId, channel: 'in_app', audience: 'learner', templateKey: 'cohort.schedule_changed',
        title: `تغيّر موعد «${opts.title}»`, body, data: { cohortId },
      })
    }
    return zoom
  }

  /* ═══ نقلٌ تقرّره الإدارةُ بنفسها — طلبٌ واعتمادٌ معا (١٩ أكتوبر ٢٠٢٦) ═══
     بالفحص نفسِه والأثرِ نفسِه الذي يمرّ به طلبُ المدرّب (`request` ثمّ `review`): تُزاح المواعيدُ ولقاءاتُها،
     ويتحدّث Zoom والدعوات، ويُبلَّغ المتعلّمون. والفرقُ أنّ الخبرَ يصل مدرّبي الشعبة لا مَن قرّر. */
  async staffMove(actorId: string, cohortId: string, input: { toYear: number; toSeason: string; reason: string }) {
    if (!isSeason(input.toSeason)) throw new AuthError('bad_season', 'اختر فصلا من القائمة')
    const target: TermRef = { year: input.toYear, season: input.toSeason }
    const w = await this.where(cohortId)
    const problem = moveProblemAr({ ...w, target, now: new Date(), reason: input.reason })
    if (problem) throw new AuthError('move_refused', problem)
    const open = await this.prisma.cohortMoveRequest.findFirst({ where: { cohortId, status: 'pending' }, select: { id: true } })
    if (open) throw new AuthError('already_pending', 'لهذه الشعبة طلب نقل ينتظر — احسمه أولا', 409)

    const reason = input.reason.trim()
    /* مُدخَلُ المراجع لا فعلُ أثر — فيُبنى قبل نداء الأثر */
    const decision = { action: 'approve' as const, comment: reason }
    const created = await this.prisma.cohortMoveRequest.create({
      data: {
        cohortId, requestedBy: actorId,
        fromYear: w.current?.year ?? null, fromSeason: w.current?.season ?? null, fromStartsAt: w.firstStartsAt ?? w.proposedStartsAt,
        toYear: target.year, toSeason: target.season, reason,
      },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'cohort.move.request', entityType: 'cohort', entityId: cohortId,
      meta: { requestId: created.id, to: `${target.season}-${target.year}`, byStaff: true },
    })
    const decided = await this.review(actorId, created.id, decision, { tellRequester: false, byStaff: true })

    const first = await this.prisma.cohortSession.findFirst({
      where: { cohortId, status: { notIn: ['cancelled'] } }, orderBy: { startsAt: 'asc' }, select: { startsAt: true },
    })
    const leads = await this.prisma.cohortTrainer.findMany({ where: { cohortId }, select: { profile: { select: { userId: true } } } })
    for (const userId of new Set(leads.map((l) => l.profile.userId).filter((u): u is string => Boolean(u)))) {
      await safeNotify(this.prisma, {
        userId, channel: 'in_app', audience: 'trainer',
        title: `نقلت الإدارة «${w.title}» إلى ${termLabelAr(target)}`,
        body: `${first ? `أول لقاء فيها ${dayAr(first.startsAt)}. ` : ''}${reason}`,
        data: { cohortId, requestId: created.id },
      })
    }
    return decided
  }

  /* ═══ تذكيرُ مدرّبي الشعبة المنقولة قبل فصلها الجديد بشهر — من العامل (`cohort_move_reminders`) ═══
     لآخر نقلٍ معتمَدٍ لكلّ شعبة وحدَه: ما قبله تجاوزه فيُختم بلا رسالة. ولا يُذكَّر مرّتين — يُختم
     بكتابةٍ مشروطةٍ قبل الرسالة. ولا يُذكَّر من بدأ فصلُه أو أُلغيت شعبتُه أو بدأت. */
  async remindDue(now = new Date()): Promise<{ reminded: number }> {
    const rows = await this.prisma.cohortMoveRequest.findMany({
      where: { status: 'approved', reminderSentAt: null },
      orderBy: { reviewedAt: 'desc' },
      select: { id: true, cohortId: true, toYear: true, toSeason: true, reviewedAt: true },
    })
    let reminded = 0
    const seen = new Set<string>()
    for (const r of rows) {
      const latest = !seen.has(r.cohortId)
      seen.add(r.cohortId)
      const newer = latest && await this.prisma.cohortMoveRequest.findFirst({
        where: { cohortId: r.cohortId, status: 'approved', reviewedAt: { gt: r.reviewedAt ?? new Date(0) } }, select: { id: true },
      })
      if (!latest || newer || !isSeason(r.toSeason)) {
        await this.prisma.cohortMoveRequest.update({ where: { id: r.id }, data: { reminderSentAt: now } })
        continue
      }
      const target: TermRef = { year: r.toYear, season: r.toSeason }
      if (moveReminderAt(target).getTime() > now.getTime()) continue
      const cohort = await this.prisma.cohort.findUnique({
        where: { id: r.cohortId },
        select: { title: true, status: true, trainers: { select: { profile: { select: { userId: true } } } } },
      })
      const started = termBounds(target.year, target.season).startsOn.getTime() <= now.getTime()
      /* يُختم قبل الرسالة: دورتان متزامنتان لا تذكّران مرّتين */
      const claimed = await this.prisma.cohortMoveRequest.updateMany({ where: { id: r.id, reminderSentAt: null }, data: { reminderSentAt: now } })
      if (claimed.count === 0 || !cohort || started || !['draft', 'open', 'full'].includes(cohort.status)) continue
      for (const t of cohort.trainers) {
        if (!t.profile.userId) continue
        for (const channel of ['in_app', 'email'] as const) {
          await safeNotify(this.prisma, {
            userId: t.profile.userId, channel, audience: 'trainer',
            title: `راجع «${cohort.title}» قبل ${termLabelAr(target)}`,
            body: 'يبدأ الفصل بعد شهر تقريبا. راجع محتوى الدورة وحدّثه إن لزم، وتأكّد من مواعيد اللقاءات.',
            data: { cohortId: r.cohortId },
          })
        }
      }
      await recordAudit(this.prisma, {
        actorId: null, action: 'cohort.move.remind', entityType: 'cohort', entityId: r.cohortId,
        meta: { requestId: r.id, trainers: cohort.trainers.length },
      })
      reminded += 1
    }
    return { reminded }
  }

}
