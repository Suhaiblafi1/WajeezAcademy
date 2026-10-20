/* خدمة الحضور والتقدم وقواعد الإكمال —
   التقدم يُشتق من أدلة حقيقية: حضور الجلسات، إكمال الوحدات، قبول التسليمات، اجتياز التقييمات.
   لا «فتح صفحة» يُحسب تقدما. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { resolveCompletionRules } from '../../src/application/learning/completion-rules'
import { recordAudit } from './audit'
import { EnrollmentService } from './enrollment.service'
import { LEARNER_SESSION_WHERE } from './session-visibility'

const ATTENDANCE_STATUSES = ['present', 'late', 'absent', 'excused'] as const
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number]

/** محاورُ اللقاء — `moduleIds` منذ صار اللقاءُ لمحورٍ أو محورين (٢٧ سبتمبر ٢٠٢٦)،
    و`moduleId` وحدَه لما جُدول قبل ذلك ولم يُنقل. فمن حضر لقاءً لمحورين
    حضرهما معا — لا أوّلَهما وحدَه كما كان يُقرأ من العمود القديم. */
function sessionAxes(s: { moduleId: string | null; moduleIds?: readonly string[] | null }): readonly string[] {
  if (s.moduleIds && s.moduleIds.length > 0) return s.moduleIds
  return s.moduleId ? [s.moduleId] : []
}

export class ProgressService {
  private prisma: PrismaClient
  private enrollments: EnrollmentService
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.enrollments = new EnrollmentService(prisma)
  }

  /** تسجيل حضور — مدرب الشعبة فقط، وعلى مسجليها فقط */
  async markAttendance(trainerUserId: string, sessionId: string, enrollmentId: string, status: AttendanceStatus, note?: string) {
    if (!ATTENDANCE_STATUSES.includes(status)) throw new AuthError('bad_status', 'حالة حضور غير معروفة')
    const session = await this.prisma.cohortSession.findUnique({ where: { id: sessionId } })
    if (!session) throw new AuthError('not_found', 'الجلسة غير موجودة', 404)
    await this.enrollments.assertCohortTrainer(trainerUserId, session.cohortId)
    const enrollment = await this.prisma.enrollment.findUnique({ where: { id: enrollmentId } })
    if (!enrollment || enrollment.cohortId !== session.cohortId || enrollment.status === 'dropped') {
      throw new AuthError('not_enrolled', 'هذا التسجيل لا ينتمي لشعبة الجلسة', 404)
    }
    const row = await this.prisma.attendance.upsert({
      where: { sessionId_enrollmentId: { sessionId, enrollmentId } },
      update: { status, note, markedBy: trainerUserId },
      create: { sessionId, enrollmentId, status, note, markedBy: trainerUserId },
    })
    await recordAudit(this.prisma, {
      actorId: trainerUserId, action: 'attendance.mark', entityType: 'cohort_session', entityId: sessionId,
      meta: { enrollmentId, status },
    })
    await this.recomputeProgress(enrollmentId)
    return row
  }

  /** يعيد حسابَ تقدّم من له مقعدٌ في الشعبة — ولا يُسقط الدفعةَ متعلّمٌ واحدٌ يتعثّر.
      يناديه انتهاءُ اللقاء (الدورةُ وحدثُ Zoom) ومزامنةُ الحضور من Zoom: كلاهما
      يغيّر الحضورَ لكلّ من في الشعبة، لا لمتعلّمٍ بعينه كتسجيل المدرّب. */
  async recomputeCohort(cohortId: string): Promise<{ recomputed: number; failed: number }> {
    const seats = await this.prisma.enrollment.findMany({
      where: { cohortId, status: { in: ['enrolled', 'completed'] } },
      select: { id: true },
    })
    let recomputed = 0
    let failed = 0
    for (const e of seats) {
      try { await this.recomputeProgress(e.id); recomputed += 1 } catch { failed += 1 }
    }
    return { recomputed, failed }
  }

  /** إكمال وحدة — بدليل حقيقي: تسليم مقبول أو تقييم مجتاز أو حضور جلسة الوحدة */
  async recomputeProgress(enrollmentId: string) {
    const e = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        cohort: {
          include: {
            sessions: { where: { ...LEARNER_SESSION_WHERE, status: { not: 'cancelled' } } },
            course: { include: { modules: true } },
            assessments: { include: { _count: { select: { items: true } } } },
          },
        },
        attendance: true,
        submissions: true,
        attempts: { include: { grades: true, assessment: true } },
        moduleProgress: true,
      },
    })
    if (!e) throw new AuthError('not_found', 'التسجيل غير موجود', 404)

    /* حضور: حاضر/متأخر يحتسب، معذور نصف، غائب صفر */
    /* ═══ والمنعقدُ الذي أُخذ فيه الحضور — لا كلُّ ما انتهى (٢٧ سبتمبر ٢٠٢٦) ═══

       صار اللقاءُ يُكتب `done` حين تمضي نهايتُه (دورةُ «انتهاءُ اللقاءات»)،
       وكان لا يُكتب أبدا فالحضورُ صفرٌ لكلّ متعلّم. ولو عُدّ كلُّ منتهٍ لنقص
       حضورُ الجميع بلقاءٍ لم يُسجِّل فيه أحدٌ حضورا — تعثّرت مزامنةُ Zoom أو
       نسي المدرّب. فالمقامُ ما انعقد **وأُخذ فيه الحضور**: من غاب عنه غاب،
       وما لم يُسأل فيه أحدٌ لا يُحسب على أحد. */
    const ended = e.cohort.sessions.filter((s) => s.status === 'done')
    const taken = ended.length
      ? new Set((await this.prisma.attendance.findMany({
          where: { sessionId: { in: ended.map((s) => s.id) } },
          distinct: ['sessionId'],
          select: { sessionId: true },
        })).map((a) => a.sessionId))
      : new Set<string>()
    const doneSessions = ended.filter((s) => taken.has(s.id))
    const attendedWeight = e.attendance.reduce((sum, a) => {
      if (!doneSessions.some((s) => s.id === a.sessionId)) return sum
      return sum + (a.status === 'present' ? 1 : a.status === 'late' ? 0.75 : a.status === 'excused' ? 0.5 : 0)
    }, 0)
    const attendancePct = doneSessions.length ? Math.round((attendedWeight / doneSessions.length) * 100) : 0

    /* الوحدات: مكتملة بدليل — تسليم مقبول أو تقييم مجتاز مرتبط بها أو حضور جلستها */
    const acceptedSubs = e.submissions.filter((s) => s.status === 'accepted')
    const passedAttempts = e.attempts.filter((a) => {
      const g = a.grades[0]
      return g && a.assessment.passScore !== null && Number(g.score) >= (a.assessment.passScore ?? 0)
    })
    /* ═══ والحضورُ وحدَه لا يُتِمُّ محورا له عملٌ ═══

       كان الحضورُ دليلا مساويا للتسليم المقبول والتقييم المُجتاز. فمن جلس
       في اللقاء تمَّ محورُه — ولو لم يُنتج شيئا ولم ينظر فيه أحد. وذاك
       يناقض ما تبيعه المنصّة: «سيَنظر مختصٌّ فيما أنتجتَه أنت».

       ── ولمَ لم يسقط الحضورُ كلَّه ──

       محورٌ **لا عملَ عليه أصلا** لا دليلَ منتَجا فيه، فاشتراطُ ما لا وجودَ
       له يجعل «مكتمل» حالةً لا تُبلَغ أبدا. فالقاعدة: حيث يوجد عملٌ فالعملُ
       هو الدليل، وحيث لا عملَ فالحضورُ دليلُه.

       والدليلُ يُكتب بما هو — `submission` أو `assessment` أو `attendance` —
       لا «أحدُهما» كما كان. فمن قرأ الصفَّ بعد سنةٍ عرف على أيِّ شيءٍ تمَّ.

       ولا يُنقض ما مضى: الصفوفُ لا تُردّ من «مكتمل»، والحسابُ على ما يأتي. */
    const publishedFor = (moduleId: string) =>
      e.cohort.assessments.some((a) => a.moduleId === moduleId && a.status !== 'draft')
    for (const m of e.cohort.course.modules) {
      const byWork = acceptedSubs.some((s) => e.cohort.assessments.find((a) => a.id === s.assessmentId)?.moduleId === m.id)
      const byAssessment = passedAttempts.some((a) => a.assessment.moduleId === m.id)
      const attended = e.attendance.some((att) => {
        const session = e.cohort.sessions.find((s) => s.id === att.sessionId)
        return session !== undefined && sessionAxes(session).includes(m.id) && ['present', 'late'].includes(att.status)
      })
      const via = byWork ? 'submission'
        : byAssessment ? 'assessment'
        : attended && !publishedFor(m.id) ? 'attendance'
        : null
      const current = e.moduleProgress.find((mp) => mp.moduleId === m.id)
      if (via && (!current || current.status !== 'completed')) {
        await this.prisma.moduleProgress.upsert({
          where: { enrollmentId_moduleId: { enrollmentId, moduleId: m.id } },
          update: { status: 'completed', completedAt: new Date(), evidence: { via } },
          create: { enrollmentId, moduleId: m.id, status: 'completed', completedAt: new Date(), evidence: { via } },
        })
      }
    }
    const modulesCompleted = await this.prisma.moduleProgress.count({ where: { enrollmentId, status: 'completed' } })
    const totalModules = e.cohort.course.modules.length || 1

    /* النسبة الكلية: 40٪ وحدات + 30٪ حضور + 30٪ تقييمات مجتازة */
    /* ═══ وكلُّ مهمّةٍ تُعدّ مرّةً في بابها (٢٠ أكتوبر ٢٠٢٦) ═══
       كان المشروعُ يُعدّ في البابين — في «التقييمات» ولا يُجتاز فيها إلّا بمحاولة اختبار، وفي «التكليفات» — فمن
       أتمّ كلَّ شيءٍ وفي شعبته مشروعٌ وقف عند ٨٥٪ أبدا، ولا يظهر له ختامُ الدورة. وكانت المسودّةُ تُعدّ (طلبُ مهمّةٍ
       ينتظر الاعتماد أو رُدّ) فتنقص نسبةُ الجميع بمهمّةٍ لم يرها أحد. فالاختبارُ بأسئلته يُجتاز بمحاولة، وما سواه —
       الواجبُ والمشروعُ واختبارٌ بلا أسئلة يُجاب كتابة — يُقبل تسليمُه؛ وكلٌّ مرّةً ولو تكرّر تسليمُه أو محاولتُه. */
    const counted = e.cohort.assessments.filter((a) => a.status !== 'draft')
    const byAttempt = new Set(counted.filter((a) => a.type === 'quiz' && a._count.items > 0).map((a) => a.id))
    const bySubmission = new Set(counted.filter((a) => !byAttempt.has(a.id)).map((a) => a.id))
    const assessmentsTotal = byAttempt.size
    const assessmentsPassed = new Set(passedAttempts.map((a) => a.assessmentId).filter((id) => byAttempt.has(id))).size
    const assignmentsAccepted = new Set(acceptedSubs.map((s) => s.assessmentId).filter((id) => bySubmission.has(id))).size
    const assignmentsTotal = bySubmission.size

    const modulePct = Math.round((modulesCompleted / totalModules) * 100)
    const assessPct = assessmentsTotal ? Math.round((assessmentsPassed / assessmentsTotal) * 100) : 100
    const assignPct = assignmentsTotal ? Math.round((assignmentsAccepted / assignmentsTotal) * 100) : 100

    const percent = Math.round(modulePct * 0.4 + attendancePct * 0.3 + ((assessPct + assignPct) / 2) * 0.3)
    const evidence = { attendancePct, modulesCompleted, totalModules, assignmentsAccepted, assignmentsTotal, assessmentsPassed, assessmentsTotal }
    return this.prisma.courseProgress.upsert({
      where: { enrollmentId },
      update: { percent, evidence },
      create: { enrollmentId, percent, evidence },
    })
  }

  /* ── قواعد الإكمال ── */

  async setCompletionRule(actorId: string, input: {
    courseId: string; cohortId?: string; type: string; threshold: number; required?: boolean
  }) {
    if (!['attendance_pct', 'modules_completed', 'assignment_accepted', 'project_accepted', 'assessment_passed'].includes(input.type)) {
      throw new AuthError('bad_rule', 'نوع قاعدة إكمال غير مدعوم')
    }
    const rule = await this.prisma.completionRule.create({
      data: { courseId: input.courseId, cohortId: input.cohortId, type: input.type, threshold: input.threshold, required: input.required ?? true, createdBy: actorId },
    })
    await recordAudit(this.prisma, { actorId, action: 'completion_rule.set', entityType: 'course', entityId: input.courseId, meta: input as object })
    return rule
  }

  /** تقييم قواعد الإكمال لتسجيل — قواعد الشعبة تتقدم على قواعد الدورة */
  async evaluateCompletion(enrollmentId: string) {
    const e = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId }, include: { cohort: true, courseProgress: true },
    })
    if (!e) throw new AuthError('not_found', 'التسجيل غير موجود', 404)
    const progress = e.courseProgress ?? (await this.recomputeProgress(enrollmentId))
    const ev = (progress.evidence ?? {}) as Record<string, number>

    /* ك-١٤: قاعدةُ الدورة أرضيّةٌ لا تُمحى بقاعدةِ شعبة.

       كان السطرُ هنا `cohortRules.length ? cohortRules : courseRules` — فقاعدةٌ
       واحدةٌ تُضاف على شعبةٍ تُسقط قواعدَ الدورة كلَّها، ومنها الحضورُ
       والتكاليفُ والتقييم. فتصير «شهادة من وجيز» عن الرمز نفسِه تعني شيئا في
       شعبةٍ وشيئا آخرَ في جارتها.

       والقسمةُ صارت في وحدةٍ نقيّةٍ تُفحَص بلا قاعدةِ بيانات، والإرخاءُ بابُه
       واحدٌ صريح: قاعدةُ شعبةٍ بـ`required: false`. و**لذلك يُقرأ غيرُ اللازم
       أيضا** — فالمرفوعُ إشارةُ إسقاطٍ لا صفٌّ مهمَل. */
    const [cohortRules, courseRules] = await Promise.all([
      this.prisma.completionRule.findMany({ where: { cohortId: e.cohortId } }),
      this.prisma.completionRule.findMany({ where: { courseId: e.cohort.courseId, cohortId: null } }),
    ])
    const rules = resolveCompletionRules(courseRules, cohortRules)

    const failures: string[] = []
    for (const r of rules) {
      const failed =
        (r.type === 'attendance_pct' && (ev.attendancePct ?? 0) < r.threshold) ||
        (r.type === 'modules_completed' && (ev.modulesCompleted ?? 0) < r.threshold) ||
        (r.type === 'assignment_accepted' && (ev.assignmentsAccepted ?? 0) < r.threshold) ||
        (r.type === 'project_accepted' && (ev.assignmentsAccepted ?? 0) < r.threshold) ||
        (r.type === 'assessment_passed' && (ev.assessmentsPassed ?? 0) < r.threshold)
      if (failed) failures.push(`${r.type}: المطلوب ${r.threshold} والمتحقق ${this.evidenceValue(ev, r.type)}`)
    }
    return { complete: failures.length === 0, failures, percent: progress.percent, rulesChecked: rules.length }
  }

  private evidenceValue(ev: Record<string, number>, type: string): number {
    if (type === 'attendance_pct') return ev.attendancePct ?? 0
    if (type === 'modules_completed') return ev.modulesCompleted ?? 0
    if (type === 'assignment_accepted' || type === 'project_accepted') return ev.assignmentsAccepted ?? 0
    return ev.assessmentsPassed ?? 0
  }
}
