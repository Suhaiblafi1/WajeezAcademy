/* «ما عليك بموعد» — للمتعلّم مواعيدُه، وللمدرّب جدولُه عبر شعبه (المهمّة ٧٢).

   ─────────── لمَ خدمةٌ واحدةٌ للاثنين ───────────

   السؤالُ واحدٌ في الحالتَين: «ما الذي عليّ، ومتى؟». والبياناتُ موجودةٌ
   كاملةً منذ زمن (`CohortAssessment.dueAt` و`CohortSession.startsAt`)
   **ولا شاشةَ تجمعها بالوقت**: المتعلّمُ يفتح كلَّ تسجيلٍ على حدةٍ ليرى
   واجباته، والمدرّبُ يفتح كلَّ شعبةٍ على حدةٍ ليرى جلساتِه. فمن له ثلاثُ
   شعبٍ لا يعرف أنّ جلستَي الثلاثاء تتزاحمان إلّا يومَ الثلاثاء.

   ─────────── وما لا تفعله هذه الخدمة ───────────

   لا تُنشئ بيانا ولا تُخمّن موعدا: تقييمٌ بلا `dueAt` **ليس موعدا**، فلا
   يُعرض بموعدٍ مُختلَق. ومن لا موعدَ عليه يُقال له ذلك صريحا لا يُترك أمام
   لوحٍ فارغٍ يظنّه عطبا. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import {
  AR_CARDS, AR_COHORTS, AR_SESSIONS, AR_SUBMISSIONS,
  DAY_MS, HORIZON_DAYS, countAr, dueLabelAr, urgencyOf,
} from '../../src/application/student/deadlines'

export interface LearnerDeadline {
  assessmentId: string
  title: string
  /** assignment | quiz | project — نوعُ ما يُسلَّم */
  type: string
  dueAt: string
  dueLabelAr: string
  urgency: string
  enrollmentId: string
  cohortId: string
  cohortTitle: string
  /** معرّفُ الدورة — به يفتح اللوحُ المرحلةَ الصحيحةَ في «تعلّمي» (`?stage=`)
      حيث نموذجُ التسليم، لا صفحةً عامّةً يبحث فيها عن واجبه */
  courseId: string
  courseTitle: string
  /** أُعيد إليه للتسليم مرّةً أخرى — فالكرةُ في ملعبه وإن سلّم قبلا */
  resubmitRequested: boolean
}

/* عبارتان تُبنيان لا تُلصَقان: «منها ١ فات موعدُه» عربيّةٌ مكسورة، ولا يكفي
   جدولُ الصيغ لأنّ الفعلَ يتبع العددَ أيضا (فات · فاتا · فاتت). */
function overduePhraseAr(n: number): string {
  if (n === 0) return ''
  if (n === 1) return '، وواحدٌ منها فات موعدُه'
  if (n === 2) return '، واثنان منها فات موعدُهما'
  return `، و${n} منها فات موعدُها`
}

/** التزاحمُ لا يقع بأقلَّ من جلستَين — فالواحدُ حالةٌ لا تُصاغ */
function clashPhraseAr(n: number): string {
  if (n === 0) return ''
  if (n === 2) return ' — واثنتان منها تتزاحمان، فراجِعهما مع الإدارة'
  return ` — و${n} منها تتزاحم، فراجِعها مع الإدارة`
}

export class DeadlinesService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** مواعيدُ المتعلّم — تقييماتٌ منشورةٌ بموعدٍ لم يُسلّمها بعد */
  async forLearner(userId: string, now = new Date()) {
    const horizonEnd = new Date(now.getTime() + HORIZON_DAYS * DAY_MS)
    const enrollments = await this.prisma.enrollment.findMany({
      /* المنسحبُ لا يُطالَب، والمنتظرُ في القائمة لا وصولَ له أصلا،
         والمكتملُ فرغ — فالمطالبةُ للمسجَّل وحدَه */
      where: { userId, status: 'enrolled' },
      select: {
        id: true, cohortId: true,
        cohort: {
          select: {
            id: true, title: true, courseId: true,
            /* عنوانُ الدورة في إصدارها لا في الدورة نفسِها — فالمعرّفُ ثابتٌ
               والعنوانُ يتغيّر بالإصدار، والأحدثُ هو ما يقرؤه المتعلّم */
            course: { select: { versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } } },
            assessments: {
              where: { status: 'published', dueAt: { not: null, lte: horizonEnd } },
              select: { id: true, title: true, type: true, dueAt: true },
            },
          },
        },
        submissions: { select: { assessmentId: true, status: true } },
        attempts: { select: { assessmentId: true } },
      },
    })

    const items: LearnerDeadline[] = []
    for (const e of enrollments) {
      /* ما سلّمه لا يُطالَب به — إلّا ما رُدَّ إليه لإعادة التسليم */
      const submitted = new Map(e.submissions.map((s) => [s.assessmentId, s.status]))
      const attempted = new Set(e.attempts.map((a) => a.assessmentId))
      for (const a of e.cohort.assessments) {
        if (!a.dueAt) continue
        const sub = submitted.get(a.id)
        const resubmitRequested = sub === 'resubmit_requested'
        if ((sub && !resubmitRequested) || attempted.has(a.id)) continue
        items.push({
          assessmentId: a.id, title: a.title, type: a.type,
          dueAt: a.dueAt.toISOString(),
          dueLabelAr: dueLabelAr(a.dueAt, now),
          urgency: urgencyOf(a.dueAt, now),
          enrollmentId: e.id, cohortId: e.cohortId,
          cohortTitle: e.cohort.title,
          courseId: e.cohort.courseId,
          courseTitle: e.cohort.course.versions[0]?.titleAr ?? e.cohort.title,
          resubmitRequested,
        })
      }
    }
    items.sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))

    /* البطاقاتُ تُذكَر ولا تُعرَض: ليست مواعيدَ نهائيّةً، وشاشتُها «مراجعتي».
       عددٌ واحدٌ وسطرٌ يشير إلى موضعها — لا خمسون سطرا تُغرق واجبا واحدا. */
    const retrievalDue = await this.prisma.retrievalCard.count({
      where: { userId, dueAt: { lte: now } },
    })

    const overdue = items.filter((i) => i.urgency === 'overdue').length
    return {
      now: now.toISOString(),
      horizonDays: HORIZON_DAYS,
      items,
      overdue,
      retrievalDue,
      /* ما يقوله اللوحُ عن نفسه — فلا يُقرأ الفراغُ عطبا ولا العددُ تهديدا */
      meaningAr: items.length === 0
        ? (retrievalDue > 0
            ? `لا تسليمَ عليك في ${HORIZON_DAYS} يوما — وعندك ${countAr(retrievalDue, AR_CARDS)} استُحقّت في «مراجعتي»`
            : `لا تسليمَ عليك في ${HORIZON_DAYS} يوما القادمة`)
        : `${countAr(items.length, AR_SUBMISSIONS)} بموعد${overduePhraseAr(overdue)}`,
    }
  }

  /** جدولُ المدرّب — جلساتُه في شعبه كلِّها في خطٍّ زمنيٍّ واحد */
  async forTrainer(userId: string, now = new Date(), days = 30) {
    const profile = await this.prisma.trainerProfile.findUnique({ where: { userId } })
    if (!profile || profile.suspendedAt) {
      throw new AuthError('not_trainer', 'لا ملف مدرب نشطا لهذا الحساب', 403)
    }
    const until = new Date(now.getTime() + days * DAY_MS)
    const links = await this.prisma.cohortTrainer.findMany({
      where: { profileId: profile.id },
      select: {
        role: true,
        cohort: {
          select: {
            id: true, title: true,
            /* عنوانُ الدورة في إصدارها لا في الدورة نفسِها — فالمعرّفُ ثابتٌ
               والعنوانُ يتغيّر بالإصدار، والأحدثُ هو ما يقرؤه المتعلّم */
            course: { select: { versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } } },
            sessions: {
              where: { startsAt: { gte: now, lte: until }, status: { notIn: ['cancelled'] } },
              select: { id: true, title: true, startsAt: true, endsAt: true, status: true },
            },
          },
        },
      },
    })

    const sessions = links.flatMap((l) => l.cohort.sessions.map((s) => ({
      sessionId: s.id, title: s.title,
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt ? s.endsAt.toISOString() : null,
      status: s.status,
      role: l.role,
      cohortId: l.cohort.id, cohortTitle: l.cohort.title,
      courseTitle: l.cohort.course.versions[0]?.titleAr ?? l.cohort.title,
      /* تزاحمٌ مع جلسةٍ أخرى من جلساته — يُحسَب أدناه */
      clashesWith: [] as string[],
    })))
    sessions.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))

    /* التزاحمُ **بين شعبه هو**: الحارسُ في الإسناد يمنع الجديدَ المتعارض،
       ولا يمنع أن تتعارض جلستان أُضيفتا بعد الإسناد إلى شعبتَين قائمتَين.
       فالمدرّبُ يعرف قبل الأسبوع لا صباحَه. وجلسةٌ بلا نهايةٍ تُقدَّر ساعةً
       — تقديرٌ يُقال، ولا يُترك ضمنيّا. */
    const ASSUMED_MS = 60 * 60_000
    const endOf = (s: { startsAt: string; endsAt: string | null }) =>
      s.endsAt ? Date.parse(s.endsAt) : Date.parse(s.startsAt) + ASSUMED_MS
    for (let i = 0; i < sessions.length; i++) {
      for (let j = i + 1; j < sessions.length; j++) {
        if (Date.parse(sessions[j].startsAt) >= endOf(sessions[i])) break
        sessions[i].clashesWith.push(sessions[j].sessionId)
        sessions[j].clashesWith.push(sessions[i].sessionId)
      }
    }

    const clashing = sessions.filter((s) => s.clashesWith.length > 0).length
    return {
      now: now.toISOString(),
      days,
      cohorts: links.length,
      sessions,
      clashing,
      meaningAr: sessions.length === 0
        ? `لا جلسةَ لك في ${days} يوما القادمة`
        : `${countAr(sessions.length, AR_SESSIONS)} في ${countAr(links.length, AR_COHORTS)}${clashPhraseAr(clashing)}`,
    }
  }
}
