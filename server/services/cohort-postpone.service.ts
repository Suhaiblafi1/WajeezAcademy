/* ═══ اقتراحُ تأجيل الشعبة إلى الشهر التالي — نرسله نحن، ويقبله المدرّبُ أو تتوقّف (٢٤ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة وعلّتُه في `src/application/trainer/postpone-offer.ts`. وهنا ما يقع:

   · **المعاينة**: شعبُ الشهر المختار التي لم تبدأ (مسودّةٌ أو مفتوحةٌ أو ممتلئة)، وأوّلُ لقاءٍ لكلٍّ منها الآن وبعد
     التأجيل — ولا يُرسل شيءٌ بها.
   · **الإرسال**: لكلّ شعبةٍ اختيرت صفٌّ بمهلةٍ وسبب، وجرسٌ وبريدٌ لمدرّبيها يقولان الموعدين، والمهلةَ، وأنّ الشعبةَ
     تتوقّف تلقائيّا إن لم يقبل حتّى المهلة.
   · **القبول** يزيح الشعبةَ بكلّ مواعيدها كما يزيحها النقل (`CohortMoveService.applyShift`) — والفصلُ لا يتغيّر.
   · **عدمُ القبول** يوقف الشعبةَ الآن، و**السكوتُ** حتّى المهلة يوقفها العاملُ (`cohort_postpone_expire`) — كلاهما
     بالإلغاء نفسِه الذي تفعله الإدارة (`CohortService.transition`)، فيصل متعلّميها ومدرّبَها الخبرُ بسببه.

   وكلُّ حسمٍ يُختم بكتابةٍ مشروطةٍ قبل أثره: قبولٌ وعاملٌ متزامنان لا يزيحان شعبةً ثمّ يلغيانها.

   ═══ ونوعٌ ثانٍ: اختيارُ الموسم لشعب الموسم الأوّل (٢١ نوفمبر ٢٠٢٦) ═══

   القرارُ وعلّتُه في `src/application/trainer/season-choice.ts`، والرسالةُ في `season-choice-mail.ts`. وهو هذا الجدولُ
   نفسُه بنوع `season_choice` — لا نظامٌ موازٍ: المهلةُ والعاملُ والسحبُ والإلغاءُ بالسكوت كما هي. والفرق:
   · **المعاينة** شعبُ الفصل الجاري التي لم تبدأ، وأوّلُ لقاءٍ لكلٍّ منها في كلّ موسمٍ يُختار.
   · **الإرسال** صفٌّ لكلّ شعبة، و**رسالةٌ واحدةٌ لكلّ مدرّب** تعدّ شعبَه كلَّها — بريدٌ في الطابور وجرس.
   · **الاختيار** (`choose`): موسمٌ من القائمة فتُزاح الشعبةُ بأسابيعَ كاملةٍ إلى أوّل أسبوعه وتُربط بفصله، أو الإلغاءُ
     بسببٍ يقول إنّه اختاره — ولا يُكتب عليه استردادٌ ولا حسم.
   · **السكوت** حتّى المهلة يلغيها العاملُ — كما قيل في الرسالة. */

import { randomUUID } from 'node:crypto'
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
import { ensureTerm } from './term-ensure'
import { enqueueMail } from './outbox.service'
import { renderMail } from './mail-template'
import { publicSiteUrl } from './site-url'
import { seasonChoiceMail } from './season-choice-mail'
import { latestStartedTerm, monthWithinTerm, plannedMonthOk, termTitleAr, type SeasonRef } from '../../src/application/terms/season'
import { MOVABLE_STATUSES, moveShiftFor } from '../../src/application/trainer/cohort-move'
import { zonedDay } from '../../src/application/trainer/cohort-period'
import {
  DEFAULT_CANCEL_AR, SEASON_CANCEL_REASON_AR, SEASON_CHOICE_REASON_AR, SEASON_EXPIRED_REASON_AR,
  firstAtIn, readChoices, sameSeason, seasonChoicesAfter, seasonOptionAr, weeksIntoSeason, type OfferKind, type SeasonPick,
} from '../../src/application/trainer/season-choice'

/** ما يُرسل في سؤال الموسم — والعنوانُ والنصُّ ما كتبه صاحبُ المنصّة، وبلاهما الافتراضيّ */
export interface SeasonSendInput { cohortIds: string[]; deadlineAt: Date; subject?: string | null; introAr?: string | null }

const DAY_MS = 86_400_000

const dayAr = (d: Date) => fmtDateWith(d, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: ACADEMY_ZONE })
const whenAr = (d: Date) => fmtDateWith(d, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: ACADEMY_ZONE })

const notStarted = (status: string) => (UPCOMING_STATUSES as readonly string[]).includes(status)
const WEEK_MS = 7 * DAY_MS
/** المهلةُ كما تُقرأ في الرسالة والجرس: «السبت، 28 نوفمبر 2026، 11:59 م» */
const deadlineAr = (d: Date) => fmtDateWith(d, {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: ACADEMY_ZONE,
})

/** بريدُ اختيار الموسم في الطابور — غرضُه يُقرأ به ما خرج (`outbox.service.ts`) */
export const SEASON_CHOICE_MAIL_PURPOSE = 'cohort.season_choice'

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

/** شعبةٌ في معاينة اختيار الموسم — وأوّلُ لقاءٍ لها في كلّ موسمٍ يُختار */
export interface SeasonCandidate {
  cohortId: string
  title: string
  status: string
  trainersAr: string[]
  enrolled: number
  /** أوّلُ لقاءٍ الآن — أو `null` لشعبة إعدادٍ بلا موعد */
  firstAt: string | null
  targets: { year: number; season: string; firstAt: string | null }[]
  blockedAr: string | null
}

export interface SeasonPreview {
  source: { year: number; season: string; titleAr: string }
  choices: { year: number; season: string; optionAr: string }[]
  rows: SeasonCandidate[]
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

  /* ═══ اختيارُ الموسم — المعاينة (٢١ نوفمبر ٢٠٢٦) ═══
     شعبُ الفصل الجاري التي لم تبدأ — فصلُها من أوّل لقائها أو بدئها المقترَح، وإلّا من صفّ فصلها (`CohortMoveService.where`).
     ولا يُرسل بها شيء: «لا يُرسل شيءٌ عند النشر — الإدارةُ تعاين ثمّ ترسل». */
  async seasonPreview(now = new Date(), source?: SeasonRef): Promise<SeasonPreview> {
    const from = source ?? latestStartedTerm(now)
    const choices = seasonChoicesAfter(from)
    const rows = await this.notStartedCohorts()
    const moves = new CohortMoveService(this.prisma)
    const out: { row: SeasonCandidate; at: number }[] = []
    for (const c of rows) {
      const w = await moves.where(c.id)
      if (!sameSeason(w.current, from)) continue
      const trainerIds = c.trainers.map((t) => t.profile.userId).filter(Boolean)
      const first = w.firstStartsAt
      out.push({ at: (first ?? w.proposedStartsAt)?.getTime() ?? Number.MAX_SAFE_INTEGER, row: {
        cohortId: c.id, title: c.title, status: c.status,
        trainersAr: c.trainers.map((t) => t.profile.application.fullName),
        enrolled: c._count.enrollments,
        firstAt: first?.toISOString() ?? null,
        targets: choices.map((t) => ({ year: t.year, season: t.season, firstAt: first ? firstAtIn(first, t).toISOString() : null })),
        blockedAr: c.postponeOffers.length ? 'أرسل لها سؤال ينتظر الرد'
          : trainerIds.length === 0 ? 'لا مدرب بحساب على هذه الشعبة — لا أحد يصله السؤال'
          : first && first.getTime() <= now.getTime() ? 'أول لقاء مضى — لا تؤجل'
          : null,
      } })
    }
    return {
      source: { year: from.year, season: from.season, titleAr: termTitleAr(from.year, from.season) },
      choices: choices.map((t) => ({ year: t.year, season: t.season, optionAr: seasonOptionAr(t) })),
      rows: out.sort((a, b) => a.at - b.at || a.row.title.localeCompare(b.row.title)).map((x) => x.row),
    }
  }

  /* ═══ معاينةُ الرسالة قبل إرسالها (٢٤ نوفمبر ٢٠٢٦) ═══
     «اسمح لي أن أعدّلها قبل إرسالها»: يرى صاحبُ المنصّة ما يصل أوّلَ مدرّبٍ في اختياره بنصّه هو — باسمه وشعبه
     والخيارين والمهلة — قبل أن يُرسل شيء. ولا يُكتب بها صفٌّ ولا بريد. */
  async seasonMailPreview(input: SeasonSendInput, now = new Date()) {
    const preview = await this.seasonPreview(now)
    const choices = readChoices(preview.choices)
    const rows = await this.notStartedCohorts({ id: { in: input.cohortIds } })
    const firstTrainer = rows.flatMap((c) => c.trainers).find((t) => t.profile.userId)
    const userId = firstTrainer?.profile.userId ?? null
    const mine = userId
      ? preview.rows.filter((r) => input.cohortIds.includes(r.cohortId)
        && rows.find((c) => c.id === r.cohortId)?.trainers.some((t) => t.profile.userId === userId))
      : []
    const mail = seasonChoiceMail({
      name: firstTrainer?.profile.application.fullName ?? 'اسم المدرب',
      choices, deadlineAr: deadlineAr(input.deadlineAt), href: `${publicSiteUrl()}/trainer/board`,
      subject: input.subject, introAr: input.introAr,
      cohorts: mine.length
        ? mine.map((r) => ({ title: r.title, firstAtAr: r.firstAt ? dayAr(new Date(r.firstAt)) : null }))
        : [{ title: 'اسم الشعبة', firstAtAr: null }],
    })
    return { subject: mail.subject, html: renderMail(mail.doc).html }
  }

  /* ═══ اختيارُ الموسم — الإرسال ═══
     صفٌّ لكلّ شعبةٍ اختيرت، ثمّ **رسالةٌ واحدةٌ لكلّ مدرّب** تعدّ ما أُرسل له في هذه الدفعة: بريدٌ في الطابور (`enqueueMail`)
     وجرس. وما لا يُرسل يُقال لماذا. والإعادةُ لا تكرّر: شعبةٌ لها سؤالٌ ينتظر تُتخطّى، ومن لم يُكتب له صفٌّ جديدٌ لا يصله شيء. */
  async seasonSend(actorId: string, input: SeasonSendInput, now = new Date()) {
    if (input.deadlineAt.getTime() <= now.getTime()) throw new AuthError('bad_deadline', 'المهلة مضت — اختر موعدا قادما')
    const preview = await this.seasonPreview(now)
    const choices = readChoices(preview.choices)
    const rows = await this.notStartedCohorts({ id: { in: input.cohortIds } })
    const sent: string[] = []
    const skipped: { cohortId: string; title: string; reasonAr: string }[] = []
    /** لكلّ مدرّبٍ ما أُرسل له — فتصله رسالةٌ واحدة */
    const byTrainer = new Map<string, { offerId: string; cohortId: string; title: string; firstAt: Date | null }[]>()
    for (const id of new Set(input.cohortIds)) {
      const row = preview.rows.find((r) => r.cohortId === id)
      const c = rows.find((r) => r.id === id)
      if (!row || !c) { skipped.push({ cohortId: id, title: c?.title ?? '', reasonAr: c ? 'ليست من شعب هذا الموسم' : 'بدأت أو ألغيت' }); continue }
      const firstAt = row.firstAt ? new Date(row.firstAt) : null
      const problem = row.blockedAr ?? (firstAt ? deadlineProblemAr(input.deadlineAt, now, firstAt) : null)
      if (problem) { skipped.push({ cohortId: id, title: row.title, reasonAr: problem }); continue }
      const trainerIds = [...new Set(c.trainers.map((t) => t.profile.userId).filter((u): u is string => Boolean(u)))]

      const offer = await this.prisma.cohortPostponeOffer.create({
        data: {
          cohortId: id, proposedBy: actorId, kind: 'season_choice', shiftDays: 0,
          fromFirstAt: firstAt, toFirstAt: null, choices: choices.map((t) => ({ year: t.year, season: t.season })), reasonAr: SEASON_CHOICE_REASON_AR, deadlineAt: input.deadlineAt,
        },
      })
      await recordAudit(this.prisma, {
        actorId, action: 'cohort.season_choice.propose', entityType: 'cohort', entityId: id,
        meta: { offerId: offer.id, deadlineAt: input.deadlineAt.toISOString(), choices: choices.map((t) => `${t.season}-${t.year}`) },
      })
      for (const userId of trainerIds) {
        const list = byTrainer.get(userId) ?? []
        list.push({ offerId: offer.id, cohortId: id, title: row.title, firstAt })
        byTrainer.set(userId, list)
      }
      sent.push(id)
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: [...byTrainer.keys()] } },
      select: { id: true, email: true, displayName: true, trainerProfile: { select: { application: { select: { fullName: true } } } } },
    })
    const batchId = randomUUID()
    const href = `${publicSiteUrl()}/trainer/board`
    const when = deadlineAr(input.deadlineAt)
    let emailed = 0
    for (const u of users) {
      const mine = byTrainer.get(u.id) ?? []
      const name = u.trainerProfile?.application.fullName || u.displayName || ''
      const many = mine.length > 1
      const titles = mine.map((m) => `«${m.title}»`).join('، ')
      await safeNotify(this.prisma, {
        userId: u.id, channel: 'in_app', audience: 'trainer', templateKey: 'cohort.season_choice.proposed',
        title: many ? `اختر ما يناسب شعبك (${mine.length})` : `اختر ما يناسب شعبة ${titles}`,
        body: `لم يكتمل عدد المسجلين هذا الموسم في ${titles}. اختر من صفحتك قبل ${when}: أجلها إلى ${seasonOptionAr(choices[0])}${choices.length > 1 ? '، أو إلى موسم لاحق' : ''}، أو ألغها بلا أي التزام عليك. ${DEFAULT_CANCEL_AR}`,
        data: { offerIds: mine.map((m) => m.offerId), cohortIds: mine.map((m) => m.cohortId) },
      })
      if (!u.email) continue
      const mail = seasonChoiceMail({
        name, choices, deadlineAr: when, href, subject: input.subject, introAr: input.introAr,
        cohorts: mine.map((m) => ({ title: m.title, firstAtAr: m.firstAt ? dayAr(m.firstAt) : null })),
      })
      await enqueueMail(this.prisma, { to: u.email, subject: mail.subject, ...renderMail(mail.doc), purpose: SEASON_CHOICE_MAIL_PURPOSE, batchId })
      emailed += 1
    }
    if (sent.length) {
      await recordAudit(this.prisma, {
        actorId, action: 'cohort.season_choice.send', entityType: 'cohort', entityId: 'batch',
        meta: {
          batchId, offers: sent.length, trainers: users.length, emailed, deadlineAt: input.deadlineAt.toISOString(),
          subject: input.subject?.trim() || null, introEdited: Boolean(input.introAr?.trim()),
        },
      })
    }
    return { sent: sent.length, trainers: users.length, emailed, skipped }
  }

  /* ═══ اختيارُ المدرّب — موسمٌ من قائمته أو الإلغاء ═══
     · **موسم**: تُزاح الشعبةُ بأقلّ أسابيعَ كاملةٍ تبلغ أوّلَ أسبوعه (`weeksIntoSeason`)، بيومها وساعتها، وكلُّ مواعيدها
       معها (`applyShift`)، وتُربط بفصله (`ensureTerm`). ثمّ Zoom والدعواتُ وخبرُ المتعلّمين (`afterShift`).
     · **الإلغاء**: الإلغاءُ نفسُه الذي تفعله الإدارة (`CohortService.transition`) بسببٍ يقول إنّه اختاره — ولا يُكتب
       عليه استردادٌ ولا حسم: «لا يترتب عليك أي التزام عن هذه الشعبة» («A»).
     والمسنَدُ إلى الشعبة وحدَه يختار، وما حُسم لا يُحسم ثانية. */
  async choose(userId: string, offerId: string, pick: SeasonPick, now = new Date()) {
    const offer = await this.prisma.cohortPostponeOffer.findUnique({ where: { id: offerId }, include: { cohort: { select: { title: true, status: true } } } })
    if (!offer) throw new AuthError('not_found', 'السؤال غير موجود', 404)
    const profile = await this.prisma.trainerProfile.findUnique({ where: { userId }, select: { id: true } })
    const link = profile && await this.prisma.cohortTrainer.findUnique({
      where: { cohortId_profileId: { cohortId: offer.cohortId, profileId: profile.id } },
    })
    if (!link) throw new AuthError('not_cohort_trainer', 'هذه الشعبة ليست من شعبك', 403)
    if (offer.kind !== 'season_choice') throw new AuthError('bad_kind', 'هذا اقتراح تأجيل — اقبله أو لا', 409)
    if (offer.status !== 'pending') throw new AuthError('not_pending', 'حسم هذا السؤال من قبل', 409)
    if (offer.deadlineAt.getTime() <= now.getTime()) {
      await this.expireDue(now)
      throw new AuthError('expired', 'مضت المهلة — ألغيت الشعبة', 409)
    }

    if (pick.kind === 'season') {
      const target: SeasonRef = { year: pick.year, season: pick.season }
      if (!readChoices(offer.choices).some((t) => sameSeason(t, target))) throw new AuthError('bad_season', 'اختر موسما من القائمة')
      const moves = new CohortMoveService(this.prisma)
      const w = await moves.where(offer.cohortId)
      if (!(MOVABLE_STATUSES as readonly string[]).includes(w.status)
        || (w.firstStartsAt && w.firstStartsAt.getTime() <= now.getTime())) {
        throw new AuthError('started', 'بدأت الشعبة أو ألغيت — لا تؤجل', 409)
      }
      const anchor = w.firstStartsAt ?? w.proposedStartsAt
      /* وشعبةُ إعدادٍ بلا موعدٍ ولا مقترَح: لا شيءَ فيها يُزاح — تُربط بفصلها وحدَه، كما في النقل (`moveShiftFor`) */
      const shiftMs = anchor ? weeksIntoSeason(anchor, target) * WEEK_MS : moveShiftFor(w.current, null, target)
      const toFirstAt = w.firstStartsAt ? new Date(w.firstStartsAt.getTime() + shiftMs) : null
      const claimed = await this.prisma.$transaction(async (tx) => {
        const c = await tx.cohortPostponeOffer.updateMany({
          where: { id: offerId, status: 'pending' },
          data: {
            status: 'accepted', decidedBy: userId, decidedAt: now,
            chosenYear: target.year, chosenSeason: target.season, shiftDays: Math.round(shiftMs / DAY_MS), toFirstAt,
          },
        })
        if (c.count === 0) return false
        const term = await ensureTerm(tx, target)
        await moves.applyShift(tx, offer.cohortId, shiftMs, { termId: term?.id ?? null })
        /* وشهرُها من الفصل يُقرأ من موعدها الجديد — وشهرٌ ثالثٌ من فصلٍ قديمٍ لا يصحّ في موسمٍ بشهرين */
        const cohort = await tx.cohort.findUniqueOrThrow({ where: { id: offer.cohortId }, select: { plannedMonth: true } })
        const month = toFirstAt ? monthWithinTerm(new Date(`${zonedDay(toFirstAt)}T12:00:00Z`), target.year, target.season) : cohort.plannedMonth
        const plannedMonth = month !== null && plannedMonthOk(target.season, month) ? month : null
        if (plannedMonth !== cohort.plannedMonth) await tx.cohort.update({ where: { id: offer.cohortId }, data: { plannedMonth } })
        return true
      })
      if (!claimed) throw new AuthError('not_pending', 'حسم هذا السؤال من قبل', 409)
      const titleAr = termTitleAr(target.year, target.season)
      await recordAudit(this.prisma, {
        actorId: userId, action: 'cohort.season_choice.choose', entityType: 'cohort', entityId: offer.cohortId,
        meta: { offerId, choice: `${target.season}-${target.year}`, shiftDays: Math.round(shiftMs / DAY_MS) },
      })
      await moves.afterShift(userId, offer.cohortId, {
        title: offer.cohort.title, auditMeta: { offerId }, shiftMs, why: moveWhy('accepted', SEASON_CHOICE_REASON_AR),
        noticeAr: (first) => `تأجلت الشعبة إلى ${titleAr}${first ? `، وأول لقاء فيها ${dayAr(first)}` : ''}. راجع جدولك.`,
      })
      await notifyRole(this.prisma, COHORT_MOVE_STAFF_ROLES, {
        channel: 'in_app',
        title: `اختار المدرب ${titleAr} لـ«${offer.cohort.title}»`,
        body: toFirstAt ? `أول لقاء فيها الآن ${dayAr(toFirstAt)}.` : 'ربطت بفصلها الجديد، ولا موعد فيها بعد.',
        data: { cohortId: offer.cohortId, offerId },
      })
      return { status: 'accepted' as const, season: target, toFirstAt }
    }

    const claimed = await this.prisma.cohortPostponeOffer.updateMany({
      where: { id: offerId, status: 'pending' }, data: { status: 'declined', decidedBy: userId, decidedAt: now },
    })
    if (claimed.count === 0) throw new AuthError('not_pending', 'حسم هذا السؤال من قبل', 409)
    await recordAudit(this.prisma, {
      actorId: userId, action: 'cohort.season_choice.choose', entityType: 'cohort', entityId: offer.cohortId,
      meta: { offerId, choice: 'cancel', obligationsWaived: true },
    })
    await this.stop(offer.cohortId, userId, SEASON_CANCEL_REASON_AR, 'اختار المدرب إلغاءها')
    await notifyRole(this.prisma, COHORT_MOVE_STAFF_ROLES, {
      channel: 'in_app',
      title: `اختار المدرب إلغاء «${offer.cohort.title}»`,
      body: 'ألغيت بلا أي التزام عليه، ووصل متعلميها الخبر.',
      data: { cohortId: offer.cohortId, offerId },
    })
    return { status: 'declined' as const }
  }

  /** ما أُرسل من نوعٍ واحد — آخرُ اقتراحٍ لكلّ شعبةٍ أوّلا، ومعه ما وقع به. ولكلّ نوعٍ صندوقُه في الإدارة */
  async list(kind: OfferKind = 'next_month') {
    const rows = await this.prisma.cohortPostponeOffer.findMany({
      where: { kind },
      orderBy: { createdAt: 'desc' }, take: 200,
      select: {
        id: true, cohortId: true, kind: true, status: true, fromFirstAt: true, toFirstAt: true, deadlineAt: true, decidedAt: true, createdAt: true,
        chosenYear: true, chosenSeason: true,
        cohort: { select: { title: true } },
      },
    })
    return rows.map(({ cohort, ...r }) => ({
      ...r, title: cohort.title,
      chosenAr: r.chosenYear !== null && r.chosenSeason
        ? readChoices([{ year: r.chosenYear, season: r.chosenSeason }]).map(seasonOptionAr)[0] ?? null : null,
    }))
  }

  /** اقتراحاتُ شعبه التي تنتظر ردَّه — بطاقاتُ «قبل/بعد» في «شعبي» */
  async mine(userId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({ where: { userId }, select: { id: true } })
    if (!profile) return []
    const rows = await this.prisma.cohortPostponeOffer.findMany({
      where: { status: 'pending', cohort: { trainers: { some: { profileId: profile.id } } } },
      orderBy: { deadlineAt: 'asc' },
      select: {
        id: true, cohortId: true, kind: true, fromFirstAt: true, toFirstAt: true, shiftDays: true, reasonAr: true, deadlineAt: true,
        choices: true,
        cohort: { select: { title: true } },
      },
    })
    /* ولاختيار الموسم: أوّلُ لقاءٍ في كلّ موسمٍ يُختار — من مواعيدها اليوم، فيقرأ ما سيقع قبل أن يختار */
    const moves = new CohortMoveService(this.prisma)
    const out = []
    for (const { cohort, choices, ...r } of rows) {
      if (r.kind !== 'season_choice') { out.push({ ...r, title: cohort.title, options: [] }); continue }
      const w = await moves.where(r.cohortId)
      const anchor = w.firstStartsAt ?? w.proposedStartsAt
      out.push({
        ...r, title: cohort.title,
        fromFirstAt: w.firstStartsAt ?? r.fromFirstAt,
        options: readChoices(choices).map((t) => ({
          year: t.year, season: t.season, optionAr: seasonOptionAr(t),
          firstAt: w.firstStartsAt ? firstAtIn(w.firstStartsAt, t).toISOString() : null,
          hasDates: Boolean(anchor),
        })),
      })
    }
    return out
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
    if (offer.kind !== 'next_month') throw new AuthError('bad_kind', 'هذا سؤال عن الموسم — اختر موسما أو الإلغاء', 409)
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
        body: offer.toFirstAt ? `أول لقاء فيها الآن ${dayAr(offer.toFirstAt)}.` : 'تحركت مواعيدها.',
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
    await this.stop(offer.cohortId, userId, declinedReasonAr, 'لم يقبل المدرب تأجيلها')
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
        title: offer.kind === 'season_choice'
          ? `سحبنا سؤال موسم «${offer.cohort.title}»` : `سحبنا اقتراح تأجيل «${offer.cohort.title}»`,
        body: offer.kind === 'season_choice' ? 'تبقى الشعبة في موعدها، ولا تلغى.' : 'تبقى الشعبة في موعدها، ولا تتوقف.',
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
      const season = o.kind === 'season_choice'
      await recordAudit(this.prisma, {
        actorId: null, action: season ? 'cohort.season_choice.expire' : 'cohort.postpone.expire',
        entityType: 'cohort', entityId: o.cohortId, meta: { offerId: o.id },
      })
      /* وسكوتُه عن اختيار الموسم يلغيها كما قيل له — ولا يُكتب عليه شيء: الإلغاءُ نفسُه بسببٍ يقول ذلك */
      await this.stop(o.cohortId, null, season ? SEASON_EXPIRED_REASON_AR : expiredReasonAr,
        season ? 'لم يختر المدرب موسما قبل المهلة' : 'لم يقبل المدرب تأجيلها')
      await notifyRole(this.prisma, COHORT_MOVE_STAFF_ROLES, {
        channel: 'in_app',
        title: season ? `لم يختر المدرب موسم «${o.cohort.title}» — ألغيت` : `لم يرد المدرب على تأجيل «${o.cohort.title}» — أوقفت`,
        body: 'مضت المهلة بلا رد، ووصل متعلميها ومدربها الخبر.',
        data: { cohortId: o.cohortId, offerId: o.id },
      })
      expired += 1
    }
    return { expired, withdrawn }
  }

  private async stop(cohortId: string, actorId: string | null, reasonAr: string, note: string) {
    await new CohortService(this.prisma).transition(cohortId, 'cancelled', actorId, note, { reasonAr })
  }
}
