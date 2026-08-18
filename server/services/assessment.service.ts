/* خدمة الواجبات والتقييم — إنشاء، تسليم، مراجعة المدرب على شعبه فقط،
   إعادة تسليم، قبول/رفض بسبب، درجة بالروبرك، تغذية راجعة، وسجل تعديل درجة لا يُمحى. */

import type { PrismaClient, Prisma } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { EnrollmentService } from './enrollment.service'
import { newStorageKey, signKey, SIGNED_URL_TTL_MS } from './storage.service'

const MAX_SUBMISSION_BYTES = 100 * 1024 * 1024 // 100MB

export class AssessmentService {
  private prisma: PrismaClient
  private enrollments: EnrollmentService
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.enrollments = new EnrollmentService(prisma)
  }

  /* ── الروبرك ── */

  async createRubric(actorId: string, title: string, criteria: { title: string; maxScore: number }[]) {
    if (!criteria.length) throw new AuthError('no_criteria', 'الروبرك بلا محاور غير مقبول')
    const rubric = await this.prisma.gradingRubric.create({
      data: {
        title, createdBy: actorId,
        criteria: { create: criteria.map((c, i) => ({ sequence: i + 1, title: c.title, maxScore: c.maxScore })) },
      },
      include: { criteria: true },
    })
    await recordAudit(this.prisma, { actorId, action: 'rubric.create', entityType: 'grading_rubric', entityId: rubric.id })
    return rubric
  }

  /* ── إنشاء الواجبات/التقييمات (إدارة أو مدرب الشعبة) ── */

  async createAssessment(actorId: string, input: {
    cohortId: string; title: string; type: 'assignment' | 'quiz' | 'project'
    moduleId?: string; maxScore?: number; passScore?: number; dueAt?: Date; rubricId?: string
    items?: { prompt: string; kind?: string; maxScore?: number }[]
  }) {
    const cohort = await this.prisma.cohort.findUnique({ where: { id: input.cohortId } })
    if (!cohort) throw new AuthError('not_found', 'الشعبة غير موجودة', 404)
    if (input.rubricId) {
      const rubric = await this.prisma.gradingRubric.findUnique({ where: { id: input.rubricId } })
      if (!rubric || rubric.status !== 'active') throw new AuthError('unknown_rubric', 'الروبرك غير موجود أو مؤرشف', 404)
    }
    const assessment = await this.prisma.cohortAssessment.create({
      data: {
        cohortId: input.cohortId, title: input.title, type: input.type, moduleId: input.moduleId,
        maxScore: input.maxScore ?? 100, passScore: input.passScore, dueAt: input.dueAt,
        rubricId: input.rubricId, createdBy: actorId,
        items: input.items ? { create: input.items.map((it, i) => ({ sequence: i + 1, prompt: it.prompt, kind: it.kind ?? 'text', maxScore: it.maxScore ?? 10 })) } : undefined,
      },
      include: { items: true },
    })
    await recordAudit(this.prisma, { actorId, action: 'assessment.create', entityType: 'cohort_assessment', entityId: assessment.id, meta: { cohortId: input.cohortId, type: input.type } })
    return assessment
  }

  /* ── تسليم المتعلم ── */

  /** تسليم واجب — نص أو ملف خاص؛ المتعلم المسجل فقط */
  async submitAssignment(userId: string, assessmentId: string, input: {
    textAnswer?: string; file?: { originalName: string; mime: string; sizeBytes: number }
  }) {
    const assessment = await this.prisma.cohortAssessment.findUnique({ where: { id: assessmentId } })
    if (!assessment || assessment.status !== 'published') throw new AuthError('not_open', 'هذا التكليف غير متاح للتسليم', 404)
    const enrollment = await this.enrollments.assertEnrolled(userId, assessment.cohortId)
    if (!input.textAnswer && !input.file) throw new AuthError('empty_submission', 'التسليم فارغ — نص أو ملف مطلوب')

    let storageKey: string | undefined
    let uploadUrl: string | undefined
    if (input.file) {
      if (input.file.sizeBytes <= 0 || input.file.sizeBytes > MAX_SUBMISSION_BYTES) throw new AuthError('too_large', 'ملف التسليم يتجاوز الحد', 413)
      storageKey = newStorageKey()
      const exp = Date.now() + SIGNED_URL_TTL_MS
      uploadUrl = `/api/v1/uploads/${storageKey}?exp=${exp}&sig=${signKey(storageKey, exp, 'write')}`
    }
    const submission = await this.prisma.assignmentSubmission.create({
      data: { assessmentId, enrollmentId: enrollment.id, textAnswer: input.textAnswer, storageKey },
    })
    await recordAudit(this.prisma, { actorId: userId, action: 'submission.create', entityType: 'assignment_submission', entityId: submission.id, meta: { assessmentId } })
    return { submission, uploadUrl }
  }

  /** إعادة التسليم بعد طلب المراجعة — محاولة جديدة والقديمة تبقى في الأثر */
  async resubmit(userId: string, assessmentId: string, input: { textAnswer?: string; file?: { originalName: string; mime: string; sizeBytes: number } }) {
    const assessment = await this.prisma.cohortAssessment.findUnique({ where: { id: assessmentId } })
    if (!assessment) throw new AuthError('not_found', 'التكليف غير موجود', 404)
    const enrollment = await this.enrollments.assertEnrolled(userId, assessment.cohortId)
    const last = await this.prisma.assignmentSubmission.findFirst({
      where: { assessmentId, enrollmentId: enrollment.id }, orderBy: { submittedAt: 'desc' },
    })
    if (!last || last.status !== 'resubmit_requested') {
      throw new AuthError('resubmit_not_requested', 'إعادة التسليم متاحة فقط بعد طلبها من المدرب', 409)
    }
    return this.submitAssignment(userId, assessmentId, input)
  }

  /** محاولة تقييم (quiz) — إجابات على البنود */
  async submitAttempt(userId: string, assessmentId: string, responses: { itemId: string; answer: unknown }[]) {
    const assessment = await this.prisma.cohortAssessment.findUnique({ where: { id: assessmentId }, include: { items: true } })
    if (!assessment || assessment.status !== 'published') throw new AuthError('not_open', 'هذا التقييم غير متاح', 404)
    const enrollment = await this.enrollments.assertEnrolled(userId, assessment.cohortId)
    const itemIds = new Set(assessment.items.map((i) => i.id))
    for (const r of responses) if (!itemIds.has(r.itemId)) throw new AuthError('bad_item', 'بند لا ينتمي لهذا التقييم')

    const attempt = await this.prisma.assessmentAttempt.create({
      data: {
        assessmentId, enrollmentId: enrollment.id,
        responses: { create: responses.map((r) => ({ itemId: r.itemId, answer: r.answer as Prisma.InputJsonValue })) },
      },
      include: { responses: true },
    })
    await recordAudit(this.prisma, { actorId: userId, action: 'attempt.create', entityType: 'assessment_attempt', entityId: attempt.id, meta: { assessmentId } })
    return attempt
  }

  /* ── مراجعة المدرب — طلاب شعبه فقط ── */

  /** يتحقق أن التسليم يخص شعبة يدربها هذا المستخدم */
  private async assertTrainerOfSubmission(trainerUserId: string, submissionId: string) {
    const submission = await this.prisma.assignmentSubmission.findUnique({
      where: { id: submissionId }, include: { assessment: true },
    })
    if (!submission) throw new AuthError('not_found', 'التسليم غير موجود', 404)
    await this.enrollments.assertCohortTrainer(trainerUserId, submission.assessment.cohortId)
    return submission
  }

  async reviewSubmission(trainerUserId: string, submissionId: string, action: 'start_review' | 'request_resubmit' | 'accept' | 'reject', note?: string) {
    const submission = await this.assertTrainerOfSubmission(trainerUserId, submissionId)
    const targets: Record<typeof action, string> = {
      start_review: 'under_review', request_resubmit: 'resubmit_requested', accept: 'accepted', reject: 'rejected',
    }
    const allowed: Record<string, string[]> = {
      submitted: ['under_review'],
      under_review: ['resubmit_requested', 'accepted', 'rejected'],
      resubmit_requested: [],
      accepted: [], rejected: [],
    }
    const to = targets[action]
    if (!allowed[submission.status]?.includes(to)) {
      throw new AuthError('bad_state', `لا يمكن الانتقال من «${submission.status}» إلى «${to}»`, 409)
    }
    if (action === 'reject' && !note?.trim()) throw new AuthError('no_reason', 'الرفض يتطلب سببا مكتوبا يفهمه المتعلم')
    if (action === 'request_resubmit' && !note?.trim()) throw new AuthError('no_reason', 'طلب إعادة التسليم يتطلب توضيح ما ينقص')
    const updated = await this.prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: { status: to, reviewNote: note, reviewedAt: new Date(), reviewedBy: trainerUserId },
    })
    await recordAudit(this.prisma, {
      actorId: trainerUserId, action: `submission.${action}`, entityType: 'assignment_submission', entityId: submissionId, meta: { note },
    })
    return updated
  }

  /** تقدير بالدرجة — اختياري بالروبرك؛ كل تعديل لاحق يُسجل في GradeHistory */
  async grade(trainerUserId: string, input: {
    submissionId?: string; attemptId?: string
    score: number; maxScore: number; rubricScores?: { criterionId: string; score: number }[]
  }) {
    if (!input.submissionId && !input.attemptId) throw new AuthError('no_target', 'حدد تسليما أو محاولة')
    if (input.score < 0 || input.score > input.maxScore) throw new AuthError('bad_score', 'الدرجة خارج النطاق')

    let cohortId: string
    if (input.submissionId) {
      const s = await this.assertTrainerOfSubmission(trainerUserId, input.submissionId)
      cohortId = s.assessment.cohortId
      /* الدرجة تتطلب قبولا أو مراجعة قائمة */
      if (!['under_review', 'accepted'].includes(s.status)) {
        throw new AuthError('bad_state', 'راجع التسليم أولا قبل الدرجة', 409)
      }
    } else {
      const attempt = await this.prisma.assessmentAttempt.findUnique({ where: { id: input.attemptId! }, include: { assessment: true } })
      if (!attempt) throw new AuthError('not_found', 'المحاولة غير موجودة', 404)
      await this.enrollments.assertCohortTrainer(trainerUserId, attempt.assessment.cohortId)
      cohortId = attempt.assessment.cohortId
    }

    const existing = await this.prisma.grade.findFirst({
      where: input.submissionId ? { submissionId: input.submissionId } : { attemptId: input.attemptId! },
    })

    if (existing) {
      /* تعديل درجة — يُسجل في التاريخ ولا يُمحى */
      const updated = await this.prisma.grade.update({
        where: { id: existing.id },
        data: { score: input.score, maxScore: input.maxScore, rubricScores: input.rubricScores as Prisma.InputJsonValue, gradedBy: trainerUserId },
      })
      await this.prisma.gradeHistory.create({
        data: { gradeId: existing.id, oldScore: existing.score, newScore: input.score, reason: 'تعديل درجة من المدرب', changedBy: trainerUserId },
      })
      await recordAudit(this.prisma, { actorId: trainerUserId, action: 'grade.update', entityType: 'grade', entityId: existing.id, meta: { old: Number(existing.score), new: input.score } })
      return updated
    }

    const grade = await this.prisma.grade.create({
      data: {
        submissionId: input.submissionId, attemptId: input.attemptId,
        score: input.score, maxScore: input.maxScore,
        rubricScores: input.rubricScores as Prisma.InputJsonValue, gradedBy: trainerUserId,
        history: { create: { oldScore: null, newScore: input.score, reason: 'تقدير أول', changedBy: trainerUserId } },
      },
    })
    if (input.attemptId) {
      await this.prisma.assessmentAttempt.update({ where: { id: input.attemptId }, data: { status: 'graded', gradedAt: new Date() } })
    }
    await recordAudit(this.prisma, { actorId: trainerUserId, action: 'grade.create', entityType: 'grade', entityId: grade.id, meta: { cohortId, score: input.score } })
    return grade
  }

  async addFeedback(trainerUserId: string, submissionId: string, body: string) {
    if (body.trim().length < 3) throw new AuthError('empty_feedback', 'التغذية الراجعة فارغة')
    await this.assertTrainerOfSubmission(trainerUserId, submissionId)
    const fb = await this.prisma.trainerFeedback.create({ data: { submissionId, authorId: trainerUserId, body } })
    await recordAudit(this.prisma, { actorId: trainerUserId, action: 'feedback.add', entityType: 'assignment_submission', entityId: submissionId })
    return fb
  }

  /** طابور مراجعة المدرب — تسليمات شعبه فقط */
  async trainerQueue(trainerUserId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({ where: { userId: trainerUserId } })
    if (!profile) throw new AuthError('not_trainer', 'لا ملف مدرب لهذا الحساب', 403)
    return this.prisma.assignmentSubmission.findMany({
      where: { assessment: { cohort: { trainers: { some: { profileId: profile.id } } } }, status: { in: ['submitted', 'under_review'] } },
      include: {
        assessment: { include: { cohort: { select: { title: true } } } },
        enrollment: true, grades: { include: { history: true } }, feedback: true,
      },
      orderBy: { submittedAt: 'asc' },
    })
  }
}
