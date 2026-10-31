/* ═══ مواعيدُ الفصل بلا تعارض — معاينةٌ ثمّ إرسالٌ إلى المدرّبين (٢٢ أكتوبر ٢٠٢٦) ═══

   القاعدةُ والحلّ في `src/application/terms/schedule-clash.ts`. وهذا يقرأ شعبَ الفصل ولقاءاتِها، ويبني لكلّ
   شعبةٍ تنتقل جدولَها بسلسلته (`proposeSchedule` بيومٍ وساعةٍ نختارهما)، ثمّ:

   ① **المعاينةُ لا تكتب شيئا** — يرى صاحبُ المنصّة التعارضاتِ الآن، ومن ينتقل ومن يبقى، وما لم يُحلّ ولماذا.
   ② **والإرسالُ** يجعل كلَّ نقلٍ بطاقةَ «قبل/بعد» في «المراجعة» عند مدرّبه، معتمَدةً من الإدارة بإرسالها، ويصله
      جرسٌ وبريدٌ بالسبب والحلّ وما بعده (`clash-message.ts`). ويُعاد الحسابُ لحظةَ الإرسال — لا يُرسل ما رآه قبل
      ساعةٍ وقد تغيّر بعده.
   ③ **والرفضُ يعود إلينا بسببه.** ما رفضه المدرّبُ لا يُقترح عليه ثانية: يومُه كلُّه إن قال «اليوم لا يناسبني»،
      أو ساعتُه إن قال «الساعة»، وإلّا الموعدُ وحدَه. فإعادةُ الإرسال تقترح له موعدا آخر.

   ولا يمسّ شعبةً ثبّتت الإدارةُ موعدَها، ولا ما بدأ، ولا ما لا خطّةَ مدرّبٍ لها، ولا خطّةً تنتظر قرارَ الإدارة. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { PlanEditService } from './plan-edit.service'
import { resolvePeriod, type PlanStatus, type TrainerPlanContent } from './cohort-plan.service'
import { publicSiteUrl, safeNotify, sendDirectEmail } from './notification.service'
import { renderMail } from './mail-template'
import { proposeHourShift, proposeSchedule, type ScheduleEdit } from '../../src/application/trainer/schedule-proposal'
import { PLAN_VISIBLE_STATUSES } from '../../src/application/trainer/plan-overlay'
import { scheduleChainProblem, type PlanEdit } from '../../src/application/trainer/plan-edits'
import {
  CLASH_REASON_PREFIX, clashLines, linkWhyAr, planClashFree, rejectedScope, slotAr, type ClashCohort, type NearbyTime, type ClashCourse, type ClashInterval, type ClashRow, type RejectedSlot, type WeeklySlot,
} from '../../src/application/terms/schedule-clash'
import { CLASH_TEMPLATE_KEY, clashBellBodyAr, clashBellTitleAr, clashMailAr } from '../../src/application/terms/clash-message'
import { courseTitleAr } from '../../src/application/catalog/course-title'
import { familyCategory } from '../../src/application/catalog/pathway-category'
import publicPathways from '../../src/data/catalog/public-pathways.json'

const LIVE = ['draft', 'open', 'full', 'active'] as const
/** ما يُقرأ من الدورة لقاعدة الربط */
const COURSE_SELECT = {
  id: true, homePathwayId: true, currentVersion: true, renamedTitleAr: true,
  versions: { select: { version: true, titleAr: true, levelAr: true } },
} as const

/** الدورةُ كما تقرؤها القاعدة: مساراتُها العامّة وفئاتُها، ومستواها من إصدارها القائم */
function clashCourseOf(course: {
  id: string; homePathwayId: string | null; currentVersion: number; renamedTitleAr: string | null
  versions: { version: number; titleAr: string; levelAr: string | null }[]
}): ClashCourse {
  const v = course.versions.find((x) => x.version === course.currentVersion) ?? course.versions[0]
  const paths = publicPathways.pathways.filter((p) => p.course_ids.includes(course.id))
  const audiences = paths.length > 0
    ? [...new Set(paths.map((p) => p.category))]
    : course.homePathwayId ? [familyCategory(course.homePathwayId)] : []
  return {
    courseId: course.id,
    titleAr: courseTitleAr(course.renamedTitleAr ?? v?.titleAr ?? course.id),
    levelAr: v?.levelAr ?? null,
    pathways: paths.map((p) => ({ id: p.id, titleAr: p.short_title })),
    audiences,
  }
}

/** بندٌ يقع على مواعيد اللقاءات أو المهامّ — والجدولُ لا يُرفع فوقه (`openKeysOf` في الرفع) */
function touchesSchedule(edit: PlanEdit): boolean {
  switch (edit.kind) {
    case 'schedule': case 'session_move': case 'session_remove': case 'task_remove': return true
    case 'task_change': return 'dueAt' in edit.set
    default: return false
  }
}

/** سببُ ما أبقاه صاحبُ المنصّة من الإرسال — ويُعرف به في الصفّ */
const HELD_AR = 'أبقيتها على موعدها — لن يصل مدربها شيء'

/** نافذةٌ بلا حدودٍ مكتوبة — أربعةُ أشهرٍ من اليوم */
const DEFAULT_WINDOW_DAYS = 120
const SEATED = ['enrolled', 'waitlisted', 'completed'] as const
/** لقاءٌ بلا نهايةٍ مكتوبة — ساعتان، كما يقيسه الفحصُ في بقيّة المنصّة */
const DEFAULT_MINUTES = 120

export interface ClashViewRow {
  cohortId: string
  title: string
  courseTitleAr: string
  trainerAr: string
  learners: number
  action: 'keep' | 'move' | 'stuck'
  fromAr: string
  toAr: string | null
  clashes: { cohortId: string; titleAr: string; whyAr: string }[]
  whyAr: string | null
  /** حالُ آخر اقتراحٍ أُرسل لها — وسببُ الرفض إن رُفض */
  sent: { status: string; toAr: string; noteAr: string | null; at: string } | null
  /** أبقاها صاحبُ المنصّة خارج هذا الإرسال — فلا تنتقل ولا يصل مدرّبَها شيء */
  held: boolean
  /** ما يصل مدرّبَها إن أُرسل: البريدُ بنصّه كما يُرسَل، وسطرُ الجرس — للمنتقلة وحدَها */
  mail: { to: string | null; subject: string; text: string; bellAr: string } | null
}

export interface ClashView {
  termId: string
  termTitleAr: string
  cohorts: number
  clashesBefore: number
  /** التعارضاتُ الآن بأسماء الدورات */
  pairs: { aTitleAr: string; bTitleAr: string; whyAr: string; firstAt: string; count: number; sections: number }[]
  rows: ClashViewRow[]
  toSend: number
}

interface Loaded {
  term: { id: string; titleAr: string }
  cohorts: ClashCohort[]
  courses: Map<string, ClashCourse>
  meta: Map<string, {
    title: string; courseTitleAr: string; trainerAr: string
    trainer: { userId: string | null; fullName: string; email: string } | null
    planId: string | null
    sent: ClashViewRow['sent']
  }>
  build: (cohortId: string, slot: WeeklySlot, whyAr: string) =>
    { ok: true; sessions: readonly ClashInterval[]; payload: { edit: ScheduleEdit; reasonAr: string } } | { ok: false; reasonAr: string }
}

export class TermClashService {
  private prisma: PrismaClient
  private edits: PlanEditService
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.edits = new PlanEditService(prisma)
  }

  /** `hold`: شعبٌ أبقاها صاحبُ المنصّة على موعدها في هذا الإرسال — تُحسب ثابتةً، فيُبنى ما حولها عليها */
  private async load(termId: string, hold: ReadonlySet<string> = new Set(), now = new Date()): Promise<Loaded> {
    const term = await this.prisma.term.findUnique({ where: { id: termId }, select: { id: true, titleAr: true } })
    if (!term) throw new AuthError('not_found', 'الفصل غير موجود', 404)
    const rows = await this.prisma.cohort.findMany({
      where: { termId, status: { in: [...LIVE] } },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true, title: true, courseId: true, startsAt: true, endsAt: true, scheduleLockedAt: true,
        course: { select: COURSE_SELECT },
        trainers: { select: { profileId: true, profile: { select: { userId: true, application: { select: { fullName: true, email: true } } } } } },
        sessions: { where: { status: { not: 'cancelled' } }, select: { id: true, startsAt: true, endsAt: true, moduleIds: true, status: true, placeholder: true } },
        assessments: { select: { id: true, title: true, type: true, dueAt: true, moduleId: true, briefAr: true, maxScore: true, status: true } },
        plans: { where: { trainerId: { not: null } }, orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, status: true, content: true } },
        planEdits: { orderBy: { createdAt: 'desc' }, select: { planId: true, kind: true, status: true, edit: true, reasonAr: true, noteAr: true, createdAt: true, decidedAt: true } },
        _count: { select: { enrollments: { where: { status: { in: [...SEATED] } } } } },
      },
    })

    const courses = new Map<string, ClashCourse>()
    for (const c of rows) if (!courses.has(c.courseId)) courses.set(c.courseId, clashCourseOf(c.course))

    const intervalOf = (s: { startsAt: Date; endsAt: Date | null }): ClashInterval => ({
      startsAt: s.startsAt.getTime(),
      endsAt: s.endsAt && s.endsAt > s.startsAt ? s.endsAt.getTime() : s.startsAt.getTime() + DEFAULT_MINUTES * 60_000,
    })

    const cohorts: ClashCohort[] = []
    const meta: Loaded['meta'] = new Map()
    const inputs = new Map<string, Parameters<typeof proposeSchedule>[0]>()
    /** لقاءاتُ كلّ شعبةٍ الآتية — ما يُقاس عليه التعارضُ بعد النقل */
    const futures = new Map<string, { id: string; startsAt: Date; endsAt: Date | null }[]>()
    /** لقاءاتُها ومهامُّها كما يقرؤها فحصُ السلسلة في الرفع (`scheduleChainProblem`) */
    const chainRows = new Map<string, { sessions: { id: string; startsAt: Date; endsAt: Date | null; moduleIds: string[] }[]; tasks: { id: string; title: string; type: string; dueAt: Date | null; moduleId: string | null }[] }>()
    for (const c of rows) {
      const live = c.sessions.filter((s) => !s.placeholder)
      const future = live.filter((s) => s.startsAt.getTime() > now.getTime())
      futures.set(c.id, future)
      const plan = c.plans[0] ?? null
      const lead = c.trainers[0]?.profile ?? null

      /* ═══ وما أرسلته هذه الشاشةُ وحدَه — على خطّتها القائمة (٢٤ أكتوبر ٢٠٢٦) ═══
         كانت تقرأ كلَّ جدولٍ مقترحٍ لها: مسوّدةَ «جهّز جدولا» القديمة، وما بقي على خطّةٍ سبقت مراجعتَها — فتثبّت الشعبةَ
         على موعدٍ لن يقع، وتعرض رفضا ليس منها. فالبطاقةُ بطاقتُها إن كانت على خطّتها القائمة وسببُها سطرُ التعارض. */
      const onPlan = c.planEdits.filter((e) => plan && e.planId === plan.id)
      const mine = onPlan.filter((e) => e.kind === 'schedule' && e.reasonAr.startsWith(CLASH_REASON_PREFIX))
      /* اقتراحٌ وصل مدرّبَها ولم يقرّر فيه: تُوضع الشعبةُ على ما يقترحه. ومرفوضٌ: لا يُقترح ثانية */
      const open = mine.find((e) => e.status === 'pending')
      const openEdit = open ? (open.edit as unknown as ScheduleEdit) : null
      /* وبندٌ آخرُ لم يُقرَّر فيه على لقاءاتها أو مواعيد مهامّها — يردّ الإرسالُ جدولا فوقه، فلا يُقترح */
      const touching = onPlan.some((e) => (e.status === 'pending' || e.status === 'proposed') && touchesSchedule(e.edit as unknown as PlanEdit))
      const proposed = openEdit
        ? future.map((s) => {
          const m = openEdit.moves.find((x) => x.sessionId === s.id)
          return m ? { startsAt: Date.parse(m.startsAt), endsAt: Date.parse(m.endsAt) } : intervalOf(s)
        })
        : null
      const rejected: RejectedSlot[] = mine
        .filter((e) => e.status === 'rejected')
        .map((e) => {
          const ed = e.edit as unknown as ScheduleEdit
          return { weekday: ed.weekday, clock: ed.clock, ...(ed.days ? { days: ed.days } : {}), scope: rejectedScope(e.noteAr) }
        })

      const fixedAr = c.scheduleLockedAt ? 'ثبتت الإدارة موعدها'
        : live.some((s) => s.startsAt.getTime() <= now.getTime()) ? 'بدأت لقاءاتها'
        : !plan ? 'لا خطة مدرب لها بعد'
        : plan.status === 'submitted' ? 'خطتها تنتظر قرارك — قرر فيها أولا'
        : ![...PLAN_VISIBLE_STATUSES, 'draft', 'changes_requested'].includes(plan.status as never) ? 'خطتها ليست في يد مدربها ولا معتمدة'
        : !openEdit && touching ? 'عليها بنود مقترحة على لقاءاتها أو مهامها لم يقرر فيها مدربها'
        : hold.has(c.id) ? HELD_AR
        : null

      cohorts.push({
        cohortId: c.id, title: c.title, courseId: c.courseId,
        trainerIds: c.trainers.map((t) => t.profileId),
        learners: c._count.enrollments,
        sessions: future.map(intervalOf),
        fixedAr, proposed, rejected,
      })

      const last = mine[0]
      const lastEdit = last ? (last.edit as unknown as ScheduleEdit) : null
      meta.set(c.id, {
        title: c.title,
        courseTitleAr: courses.get(c.courseId)!.titleAr,
        trainerAr: lead?.application.fullName ?? '—',
        trainer: lead ? { userId: lead.userId, fullName: lead.application.fullName, email: lead.application.email } : null,
        planId: plan?.id ?? null,
        sent: last && lastEdit
          ? { status: last.status, toAr: slotAr({ weekday: lastEdit.weekday, clock: lastEdit.clock, days: lastEdit.days }), noteAr: last.noteAr, at: (last.decidedAt ?? last.createdAt).toISOString() }
          : null,
      })
      if (plan) {
        chainRows.set(c.id, { sessions: live, tasks: c.assessments })
        inputs.set(c.id, {
          period: resolvePeriod(plan.content as TrainerPlanContent | null, c, plan.status as PlanStatus),
          content: plan.content,
          sessions: c.sessions.map((s) => ({ ...s, startsAt: s.startsAt.toISOString(), endsAt: s.endsAt?.toISOString() ?? null })),
          tasks: c.assessments.map((t) => ({ ...t, dueAt: t.dueAt?.toISOString() ?? null })),
          now,
        })
      }
    }

    const build: Loaded['build'] = (cohortId, slot, whyAr) => {
      const input = inputs.get(cohortId)
      if (!input) return { ok: false, reasonAr: 'لا خطة مدرب لها' }
      /* وما يلتقي أكثرَ من مرّةٍ في الأسبوع: أيّامُه نفسُها بساعةٍ أخرى (`proposeHourShift`، ٢٧ أكتوبر ٢٠٢٦) */
      const r = slot.days
        ? proposeHourShift({ ...input, clock: slot.clock, whyAr })
        : proposeSchedule({ ...input, target: { weekday: slot.weekday, clock: slot.clock }, whyAr })
      if (!r.ok) return r
      /* وما يردّه الرفعُ يُردّ هنا — فلا تَعِد المعاينةُ بنقلٍ يرفضه الإرسال */
      const chain = scheduleChainProblem(r.edit, chainRows.get(cohortId)?.sessions ?? [], chainRows.get(cohortId)?.tasks ?? [])
      if (chain) return { ok: false, reasonAr: chain }
      const sessions = (futures.get(cohortId) ?? []).map((s) => {
        const m = r.edit.moves.find((x) => x.sessionId === s.id)
        return m ? { startsAt: Date.parse(m.startsAt), endsAt: Date.parse(m.endsAt) } : intervalOf(s)
      })
      return { ok: true, sessions, payload: { edit: r.edit, reasonAr: r.reasonAr } }
    }

    return { term, cohorts, courses, meta, build }
  }

  private plan(l: Loaded) {
    return planClashFree({ cohorts: l.cohorts, courses: l.courses, build: l.build })
  }

  async view(termId: string, hold: ReadonlySet<string> = new Set()): Promise<ClashView> {
    const l = await this.load(termId, hold)
    const p = this.plan(l)
    const titleOf = (id: string) => l.meta.get(id)?.courseTitleAr ?? ''
    const rows: ClashViewRow[] = p.rows.map((r) => this.viewRow(l, r, titleOf))
    return {
      termId: l.term.id,
      termTitleAr: l.term.titleAr,
      cohorts: l.cohorts.length,
      clashesBefore: p.before.length,
      /* سطرٌ واحدٌ للدورتين نفسيهما وإن تعارضت منهما شعبٌ عدّة (`clashLines`) */
      pairs: clashLines(p.before, titleOf).map((x) => ({ ...x, firstAt: new Date(x.firstAt).toISOString() })),
      rows,
      toSend: p.rows.filter((r) => r.action === 'move').length,
    }
  }

  private viewRow(l: Loaded, r: ClashRow<{ edit: ScheduleEdit; reasonAr: string }>, titleOf: (id: string) => string): ClashViewRow {
    const m = l.meta.get(r.cohortId)!
    const c = l.cohorts.find((x) => x.cohortId === r.cohortId)!
    const base = {
      cohortId: r.cohortId, title: m.title, courseTitleAr: m.courseTitleAr, trainerAr: m.trainerAr, learners: c.learners, sent: m.sent,
      held: c.fixedAr === HELD_AR, mail: null,
    }
    if (r.action === 'keep') return { ...base, action: 'keep', fromAr: slotAr(r.slot), toAr: null, clashes: [], whyAr: null }
    const clashes = r.clashes.map((x) => ({ cohortId: x.cohortId, titleAr: titleOf(x.cohortId), whyAr: x.whyAr }))
    if (r.action === 'stuck') return { ...base, action: 'stuck', fromAr: slotAr(r.slot), toAr: null, clashes, whyAr: r.whyAr }
    /* والبريدُ بنصّه كما يُرسَل — يُبنى بالدالّة نفسِها التي يُرسَل بها، فلا تفترق المعاينةُ عن المرسَل */
    const msg = { cohortTitle: m.title, courseTitleAr: m.courseTitleAr, fromAr: slotAr(r.from), toAr: slotAr(r.to) }
    const mail = this.mailOf(m.trainer?.fullName ?? '', r.cohortId, msg)
    return {
      ...base, action: 'move', fromAr: msg.fromAr, toAr: msg.toAr, clashes, whyAr: r.payload.reasonAr,
      mail: { to: m.trainer?.email ?? null, subject: mail.subject, text: mail.text, bellAr: `${clashBellTitleAr(msg)} — ${clashBellBodyAr(msg)}` },
    }
  }

  /* ═══ أوقاتُ الدورات القريبة — يراها المدرّبُ وهو يختار موعدَ لقائه (٢٢ أكتوبر ٢٠٢٦) ═══
     قرارُ صاحب المنصّة: «للمدرّبين الجدد: عندما يختار موعدا يُذكر له أنّ هذا الموعدَ اختاره مدرّبٌ آخر لدورةٍ قد
     تكون متكاملةً مع دورتك، فننصح بتغييره أو نعطيه الخيارَ أن يضيفها على أيّ حال». فهذه لقاءاتُ الشعب المربوطة
     بشعبته (`linkWhyAr`) داخل نافذة جدولتها — باسم الدورة وسبب الربط، لا باسم مدرّبها. والتنبيهُ لا يمنع. */
  async nearbyFor(userId: string, cohortId: string, now = new Date()): Promise<NearbyTime[]> {
    const profile = await this.prisma.trainerProfile.findUnique({ where: { userId }, select: { id: true } })
    if (!profile) throw new AuthError('not_trainer', 'لا ملف مدرب لهذا الحساب', 403)
    const link = await this.prisma.cohortTrainer.findFirst({ where: { cohortId, profileId: profile.id }, select: { cohortId: true } })
    if (!link) throw new AuthError('not_your_cohort', 'هذه الشعبة ليست مسندة إليك', 403)
    const mine = await this.prisma.cohort.findUniqueOrThrow({
      where: { id: cohortId },
      select: { courseId: true, startsAt: true, endsAt: true, scheduleWindowStart: true, scheduleWindowEnd: true, course: { select: COURSE_SELECT } },
    })
    const start = mine.scheduleWindowStart ?? mine.startsAt ?? now
    const from = start > now ? start : now
    const to = mine.scheduleWindowEnd ?? mine.endsAt ?? new Date(from.getTime() + DEFAULT_WINDOW_DAYS * 86_400_000)
    if (to <= from) return []
    const others = await this.prisma.cohort.findMany({
      where: {
        id: { not: cohortId }, courseId: { not: mine.courseId }, status: { in: [...LIVE] },
        /* وشعبُه الأخرى يحرسها الخادمُ عند الحفظ (`trainer_conflict`) — فلا تُعدّ هنا */
        trainers: { none: { profileId: profile.id } },
        sessions: { some: { startsAt: { gte: from, lte: to }, status: { not: 'cancelled' }, placeholder: false } },
      },
      select: {
        course: { select: COURSE_SELECT },
        sessions: { where: { startsAt: { gte: from, lte: to }, status: { not: 'cancelled' }, placeholder: false }, select: { startsAt: true, endsAt: true } },
      },
    })
    const me = clashCourseOf(mine.course)
    const out: NearbyTime[] = []
    for (const o of others) {
      const them = clashCourseOf(o.course)
      const why = linkWhyAr(me, them)
      if (!why) continue
      for (const s of o.sessions) {
        const end = s.endsAt && s.endsAt > s.startsAt ? s.endsAt : new Date(s.startsAt.getTime() + DEFAULT_MINUTES * 60_000)
        out.push({ startsAt: s.startsAt.toISOString(), endsAt: end.toISOString(), courseTitleAr: them.titleAr, whyAr: why })
      }
    }
    return out.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.courseTitleAr.localeCompare(b.courseTitleAr))
  }

  /* ═══ واحدةً واحدة — يرى صاحبُ المنصّة لمن يذهب البريدُ ثمّ يرسله (٢٧ أكتوبر ٢٠٢٦) ═══
     قرارُه: «أرني لمن سيُرسَل البريد، وأنا أرسل واحدا واحدا». فالإرسالُ لشعبةٍ واحدةٍ يسمّيها، ويُعاد الحسابُ الآن لا
     ممّا عُرض: إن لم تعد تنتقل لم يُرسَل شيءٌ وقيل لماذا. وما أُرسل يُحسب بعده على ما اقتُرح له، فلا يتغيّر ما بقي. */
  async send(actorId: string, termId: string, cohortId: string, hold: ReadonlySet<string> = new Set()) {
    const l = await this.load(termId, hold)
    const p = this.plan(l)
    const r = p.rows.find((x) => x.cohortId === cohortId)
    const m = l.meta.get(cohortId)
    if (!r || !m) throw new AuthError('not_found', 'الشعبة ليست في هذا الفصل', 404)
    let skipped: string | null = r.action !== 'move' ? 'لم تعد تحتاج نقلا' : !m.planId ? 'لا خطة مدرب لها' : null
    if (r.action === 'move' && m.planId && !skipped) {
      try {
        await this.edits.proposeClashFree(actorId, m.planId, r.payload.edit, r.payload.reasonAr)
      } catch (e) {
        skipped = e instanceof AuthError ? e.message : 'خطأ غير متوقع'
      }
      if (!skipped) {
        await this.tellTrainer(m.trainer, { id: cohortId, title: m.title }, {
          cohortTitle: m.title, courseTitleAr: m.courseTitleAr, fromAr: slotAr(r.from), toAr: slotAr(r.to),
        })
      }
    }
    await recordAudit(this.prisma, {
      actorId, action: 'term.clash.send', entityType: 'term', entityId: termId,
      meta: { cohortId, sent: skipped ? 0 : 1, clashesBefore: p.before.length, ...(skipped ? { skippedAr: skipped } : {}), ...(hold.size ? { held: hold.size } : {}) },
    })
    return { sent: skipped ? 0 : 1, skipped: skipped ? [{ titleAr: m.title, whyAr: skipped }] : [], view: await this.view(termId, hold) }
  }

  private async tellTrainer(
    trainer: { userId: string | null; fullName: string; email: string } | null,
    cohort: { id: string; title: string },
    m: Parameters<typeof clashMailAr>[0],
  ) {
    if (!trainer) return
    if (trainer.userId) {
      await safeNotify(this.prisma, {
        audience: 'trainer', userId: trainer.userId, channel: 'in_app',
        title: clashBellTitleAr(m), body: clashBellBodyAr(m),
        templateKey: CLASH_TEMPLATE_KEY, data: { cohortId: cohort.id, step: 'review' },
      })
    }
    const mail = this.mailOf(trainer.fullName, cohort.id, m)
    await sendDirectEmail(this.prisma, { to: trainer.email, subject: mail.subject, text: mail.text, html: mail.html })
  }

  /** البريدُ كما يُرسَل — ومنه المعاينةُ في الشاشة */
  private mailOf(fullName: string, cohortId: string, m: Parameters<typeof clashMailAr>[0]) {
    const mail = clashMailAr(m)
    return {
      subject: `${mail.subject} — أكاديمية وجيز`,
      ...renderMail({
        greetingName: fullName,
        preheader: `${m.toAr} كل أسبوع بدل ${m.fromAr}`,
        heading: mail.heading,
        blocks: [
          { kind: 'p', text: mail.reasonAr },
          { kind: 'p', text: mail.solutionAr },
          { kind: 'facts', rows: mail.facts },
          { kind: 'callout', text: mail.nextAr },
          { kind: 'cta', label: mail.ctaAr, href: `${publicSiteUrl()}/trainer/cohort/${cohortId}?step=review` },
        ],
      }),
    }
  }
}
