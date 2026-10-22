/* تقريرُ «المتابعة» للإدارة — من حضر، ومن سلّم، ومشروعُ التخرّج، ورسائلُ المدرّب (٢٢ أكتوبر ٢٠٢٦).

   للقراءة وحدَها: الإدارةُ مطّلعةٌ لا مديرة — اللقاءاتُ والحضورُ والتصحيحُ يد المدرّب. والعلّةُ
   والعتباتُ في `src/application/learning/cohort-monitor.ts`.

   وما يُعدّ:
   · **اللقاء** ما اعتُمد ولم يُلغَ وليس حجزا (`placeholder`). ومضى = بدأ قبل الآن.
   · **الحضور** نسبةُ ما حضره (حاضرٌ أو متأخّر) من اللقاءات التي سُجّل حضورُها — فلقاءٌ لم يُسجَّل
     لا يُحسب غيابا على المتعلّم؛ يُحسب تنبيها على المدرّب.
   · **التسليم** صفُّ تسليمٍ أو محاولةُ اختبار. وينتظر التصحيحَ ما كان `submitted | under_review`. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { ATTENDED_STATUSES } from '../../src/application/trainer/counted-seat'
import { attendancePct, monitorAlerts } from '../../src/application/learning/cohort-monitor'

const WAITING = new Set(['submitted', 'under_review'])
const DONE_SUBMISSION = new Set(['submitted', 'under_review', 'accepted', 'rejected'])

export class CohortMonitorService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) { this.prisma = prisma }

  async report(cohortId: string, now = new Date()) {
    const c = await this.prisma.cohort.findUnique({
      where: { id: cohortId },
      select: {
        id: true, title: true, status: true,
        trainers: { select: { role: true, profile: { select: { userId: true, application: { select: { fullName: true } } } } } },
        sessions: {
          where: { status: { not: 'cancelled' }, placeholder: false, approvalState: 'approved' },
          orderBy: { startsAt: 'asc' },
          select: { id: true, title: true, startsAt: true, attendance: { select: { enrollmentId: true, status: true } } },
        },
        enrollments: {
          where: { status: { in: ['enrolled', 'completed', 'dropped'] } },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true, status: true,
            user: { select: { displayName: true } },
            courseProgress: { select: { percent: true } },
            certificates: { where: { status: 'active' }, select: { id: true } },
          },
        },
        assessments: {
          where: { status: { not: 'draft' } },
          orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true, title: true, type: true, dueAt: true,
            submissions: { select: { enrollmentId: true, status: true, submittedAt: true } },
            attempts: { select: { enrollmentId: true, status: true, submittedAt: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' }, take: 30,
          select: {
            id: true, audience: true, body: true, recipients: true, createdAt: true, authorId: true,
            author: { select: { displayName: true } },
            enrollment: { select: { user: { select: { displayName: true } } } },
          },
        },
      },
    })
    if (!c) throw new AuthError('not_found', 'الشعبة غير موجودة', 404)

    const active = c.enrollments.filter((e) => e.status !== 'dropped')
    const nameOf = new Map(c.enrollments.map((e) => [e.id, e.user.displayName]))
    const past = c.sessions.filter((s) => s.startsAt.getTime() <= now.getTime())
    const upcoming = c.sessions.filter((s) => s.startsAt.getTime() > now.getTime())

    const sessions = past.map((s) => {
      const of = (st: string) => s.attendance.filter((a) => a.status === st && nameOf.has(a.enrollmentId)).length
      const markedIds = new Set(s.attendance.map((a) => a.enrollmentId))
      return {
        id: s.id, title: s.title, startsAt: s.startsAt,
        marked: s.attendance.length > 0,
        present: of('present'), late: of('late'), absent: of('absent'), excused: of('excused'),
        /* الغائبُ من سُجّل غائبا — ومن لم يُسجَّل له شيءٌ في لقاءٍ سُجّل حضورُه يُعدّ غائبا كذلك */
        absentNames: s.attendance.length === 0 ? [] : active
          .filter((e) => !markedIds.has(e.id) || s.attendance.some((a) => a.enrollmentId === e.id && a.status === 'absent'))
          .map((e) => e.user.displayName),
      }
    })
    const markedSessions = past.filter((s) => s.attendance.length > 0)

    const tasks = c.assessments.map((a) => {
      const rows = [...a.submissions, ...a.attempts]
      const by = new Map<string, { statuses: string[]; at: Date[] }>()
      for (const r of rows) {
        const cur = by.get(r.enrollmentId) ?? { statuses: [], at: [] }
        cur.statuses.push(r.status); cur.at.push(r.submittedAt)
        by.set(r.enrollmentId, cur)
      }
      const done = active.filter((e) => (by.get(e.id)?.statuses ?? []).some((st) => DONE_SUBMISSION.has(st) || st === 'graded' || st === 'returned'))
      const accepted = active.filter((e) => (by.get(e.id)?.statuses ?? []).some((st) => st === 'accepted' || st === 'graded'))
      const waitingRows = rows.filter((r) => WAITING.has(r.status) && nameOf.has(r.enrollmentId))
      const oldest = waitingRows.length ? new Date(Math.min(...waitingRows.map((r) => r.submittedAt.getTime()))) : null
      const overdue = a.dueAt !== null && a.dueAt.getTime() < now.getTime()
      return {
        id: a.id, title: a.title, type: a.type, isProject: a.type === 'project', dueAt: a.dueAt, overdue,
        submitted: done.length, accepted: accepted.length, waiting: waitingRows.length, total: active.length,
        oldestWaitingAt: oldest,
        missingIds: active.filter((e) => !done.includes(e)).map((e) => e.id),
        missingNames: active.filter((e) => !done.includes(e)).map((e) => e.user.displayName),
      }
    })

    const learners = c.enrollments.map((e) => {
      const attended = markedSessions.filter((s) => s.attendance.some((a) => a.enrollmentId === e.id
        && (ATTENDED_STATUSES as readonly string[]).includes(a.status))).length
      const tasksDone = tasks.filter((t) => !t.missingIds.includes(e.id)).length
      return {
        enrollmentId: e.id, name: e.user.displayName, status: e.status,
        attended, held: markedSessions.length,
        attendancePct: attendancePct(attended, markedSessions.length),
        tasksDone: e.status === 'dropped' ? 0 : tasksDone, tasksTotal: tasks.length,
        progressPct: e.courseProgress?.percent ?? 0,
        certified: e.certificates.length > 0,
      }
    })

    const trainerUserIds = new Set(c.trainers.map((t) => t.profile.userId).filter(Boolean))
    const lastTrainerMessage = c.messages.find((m) => trainerUserIds.has(m.authorId))
    const messages = c.messages.map((m) => ({
      id: m.id, at: m.createdAt, audience: m.audience, body: m.body, recipients: m.recipients,
      author: m.author.displayName, byTrainer: trainerUserIds.has(m.authorId),
      toName: m.enrollment?.user.displayName ?? null,
    }))

    const alerts = monitorAlerts({
      status: c.status, now,
      pastSessions: past.map((s) => ({ startsAt: s.startsAt, marked: s.attendance.length > 0 })),
      waitingSince: tasks.map((t) => t.oldestWaitingAt).filter((d): d is Date => d !== null),
      learners: learners.filter((l) => l.status !== 'dropped'),
      lastTrainerMessageAt: lastTrainerMessage?.createdAt ?? null,
      startedAt: past[0]?.startsAt ?? null,
    })

    const totalAttended = learners.filter((l) => l.status !== 'dropped').reduce((s, l) => s + l.attended, 0)
    return {
      cohort: { id: c.id, title: c.title, status: c.status },
      trainers: c.trainers.map((t) => t.profile.application.fullName),
      counts: {
        learners: active.length,
        sessionsHeld: past.length, sessionsTotal: c.sessions.length,
        attendancePct: attendancePct(totalAttended, markedSessions.length * active.length),
        tasks: tasks.length,
        waitingReview: tasks.reduce((s, t) => s + t.waiting, 0),
        messages: c.messages.length,
      },
      alerts,
      sessions,
      upcoming: upcoming.slice(0, 3).map((s) => ({ id: s.id, title: s.title, startsAt: s.startsAt })),
      tasks: tasks.map(({ missingIds: _ids, ...t }) => t),
      learners,
      messages,
    }
  }
}

export type CohortMonitorReport = Awaited<ReturnType<CohortMonitorService['report']>>
