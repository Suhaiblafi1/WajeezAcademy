/* خدمة الواجبات والتقييم — إنشاء، تسليم، مراجعة المدرب على شعبه فقط،
   إعادة تسليم، قبول/رفض بسبب، درجة بالروبرك، تغذية راجعة، وسجل تعديل درجة لا يُمحى. */

import type { PrismaClient, Prisma } from '@prisma/client'
import { AuthError } from './auth.service'
import type { TypedLink } from '../../src/application/trainer/plan-overlay'
import { recordAudit } from './audit'
import { EnrollmentService } from './enrollment.service'
import { assertFileUploadsEnabled, newStorageKey, signKey, SIGNED_URL_TTL_MS } from './storage.service'
import { safeNotify } from './notification.service'

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
    moduleId?: string; briefAr?: string; maxScore?: number; passScore?: number; dueAt?: Date; rubricId?: string
    attachments?: TypedLink[]
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
        briefAr: input.briefAr, maxScore: input.maxScore ?? 100, passScore: input.passScore, dueAt: input.dueAt,
        rubricId: input.rubricId, createdBy: actorId,
        /* عمودُ JSON: Prisma يطلب `InputJsonValue` لا نوعَنا — والتحويلُ
           هنا صريحٌ في موضعٍ واحد، لا `any` ينتشر في الخدمة. */
        attachments: (input.attachments ?? undefined) as Prisma.InputJsonValue | undefined,
        items: input.items ? { create: input.items.map((it, i) => ({ sequence: i + 1, prompt: it.prompt, kind: it.kind ?? 'text', maxScore: it.maxScore ?? 10 })) } : undefined,
      },
      include: { items: true },
    })
    await recordAudit(this.prisma, { actorId, action: 'assessment.create', entityType: 'cohort_assessment', entityId: assessment.id, meta: { cohortId: input.cohortId, type: input.type } })
    return assessment
  }

  /* ── تعديلُ التكليف وحذفُه — مدرّبُ الشعبة وحدَه ──

     كان التكليفُ يُنشأ ولا يُمسّ بعدها: خطأٌ مطبعيٌّ في عنوانٍ يقرؤه كلُّ
     مسجَّلٍ يبقى ما بقيت الشعبة، وتكليفٌ أُنشئ سهوا يبقى في قائمتهم. فصار
     له تعديلٌ وحذف.

     والحدُّ الذي لا يُتجاوَز: **ما سُلّم فيه لا يُحذف**. حذفُ التكليف
     يُسقط تسليماتِ المتعلّمين معه (`onDelete: Cascade`) — وعملُهم ليس
     ملكَ المدرّب. فيُمنع الحذفُ ويُقال له أن يُغلقه بدلا منه. */

  /** يتحقّق أنّ المنادي مدرّبُ شعبةِ هذا التكليف، ويعيد التكليفَ بعدد تسليماته */
  private async assertAssessmentTrainer(userId: string, assessmentId: string) {
    const assessment = await this.prisma.cohortAssessment.findUnique({
      where: { id: assessmentId },
      include: { _count: { select: { submissions: true } } },
    })
    if (!assessment) throw new AuthError('not_found', 'هذا التكليف غير موجود', 404)
    await this.enrollments.assertCohortTrainer(userId, assessment.cohortId)
    return assessment
  }

  async updateAssessment(actorId: string, assessmentId: string, patch: {
    title?: string; briefAr?: string | null; type?: 'assignment' | 'quiz' | 'project'
    maxScore?: number; dueAt?: Date | null; attachments?: TypedLink[]
  }) {
    const before = await this.assertAssessmentTrainer(actorId, assessmentId)
    /* الدرجةُ العظمى لا تنزل تحت درجةٍ رُصدت فعلا — وإلّا صار متعلّمٌ
       حاصلا على أكثرَ من النهاية. */
    if (patch.maxScore !== undefined && patch.maxScore < before.maxScore) {
      const top = await this.prisma.grade.aggregate({
        where: { submission: { assessmentId } },
        _max: { score: true },
      })
      /* `Grade.score` عشريٌّ في القاعدة — يُقارَن رقما لا كائنا */
      const highest = Number(top._max.score ?? 0)
      if (highest > patch.maxScore) {
        throw new AuthError('score_below_awarded', `درجةٌ مرصودةٌ تبلغ ${highest} — لا تُخفَض النهايةُ دونها`)
      }
    }
    const updated = await this.prisma.cohortAssessment.update({
      where: { id: assessmentId },
      data: {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.briefAr !== undefined ? { briefAr: patch.briefAr } : {}),
        ...(patch.type !== undefined ? { type: patch.type } : {}),
        ...(patch.maxScore !== undefined ? { maxScore: patch.maxScore } : {}),
        ...(patch.dueAt !== undefined ? { dueAt: patch.dueAt } : {}),
        /* المصفوفةُ الفارغةُ محوٌ مقصودٌ لا إهمال — ولذلك `!== undefined` */
        ...(patch.attachments !== undefined ? { attachments: patch.attachments as unknown as Prisma.InputJsonValue } : {}),
      },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'assessment.update', entityType: 'cohort_assessment', entityId: assessmentId,
      meta: { cohortId: before.cohortId, fields: Object.keys(patch) },
    })
    return updated
  }

  async deleteAssessment(actorId: string, assessmentId: string) {
    const before = await this.assertAssessmentTrainer(actorId, assessmentId)
    if (before._count.submissions > 0) {
      throw new AuthError(
        'has_submissions',
        `سلّم فيه ${before._count.submissions} — لا يُحذف تكليفٌ فيه عملُ متعلّمين. أغلِقه بدلا من حذفه.`,
        409,
      )
    }
    await this.prisma.cohortAssessment.delete({ where: { id: assessmentId } })
    await recordAudit(this.prisma, {
      actorId, action: 'assessment.delete', entityType: 'cohort_assessment', entityId: assessmentId,
      meta: { cohortId: before.cohortId, title: before.title },
    })
    return { deleted: true }
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
      assertFileUploadsEnabled('سلّم نصّا، أو ضع رابطَ ملفّك داخل النصّ.')
      if (input.file.sizeBytes <= 0 || input.file.sizeBytes > MAX_SUBMISSION_BYTES) throw new AuthError('too_large', 'ملف التسليم يتجاوز الحد', 413)
      storageKey = newStorageKey()
      const exp = Date.now() + SIGNED_URL_TTL_MS
      uploadUrl = `/api/v1/uploads/${storageKey}?exp=${exp}&sig=${signKey(storageKey, exp, 'write')}`
    }
    /* الطابورُ قبل الإضافة — الخبرُ عند انتقاله من فارغٍ إلى غيرِ فارغ */
    const pendingBefore = await this.prisma.assignmentSubmission.count({
      where: { assessmentId, status: { in: ['submitted', 'under_review'] } },
    })
    const submission = await this.prisma.assignmentSubmission.create({
      data: { assessmentId, enrollmentId: enrollment.id, textAnswer: input.textAnswer, storageKey },
    })
    await recordAudit(this.prisma, { actorId: userId, action: 'submission.create', entityType: 'assignment_submission', entityId: submission.id, meta: { assessmentId } })
    if (pendingBefore === 0) await this.notifyTrainersOfQueue(assessment)
    return { submission, uploadUrl }
  }

  /* ═══ التسليمُ يصل، والمدرّبُ لا يعلم ═══

     للمدرّب طابورُ تقييمٍ يعمل، ولم يكن شيءٌ يُخبره أنّ شيئا دخله. فالمتعلّمُ
     ينتظر جوابا والمدرّبُ لا يعرف أنّ أحدا ينتظره — ويُقرأ الصمتُ إهمالا وهو
     جهل.

     ── ولماذا مرّةً واحدةً لا مع كلّ تسليم ──

     شعبةٌ من ثلاثين تُرسل ثلاثين إشعارا عن عملٍ واحد، فيتعلّم المدرّبُ أن
     يتجاوزها كلَّها — وهو أسوأُ من الصمت. فالخبرُ عند **انتقال الطابور من
     فارغٍ إلى غيرِ فارغ** لهذا التكليف: «ثمّ عملٌ ينتظرك» يُقال مرّةً، ثمّ
     يحمل العدّادُ في القائمة الرقمَ الحيَّ بلا ضجيج. ويعود الخبرُ إن فرغ
     الطابورُ ثمّ امتلأ — ومنه إعادةُ التسليم بعد طلبِه. */
  private async notifyTrainersOfQueue(assessment: { id: string; cohortId: string; title: string }) {
    const cohort = await this.prisma.cohort.findUnique({
      where: { id: assessment.cohortId },
      select: { title: true, trainers: { select: { profile: { select: { userId: true } } } } },
    })
    if (!cohort) return
    for (const t of cohort.trainers) {
      /* ملفٌّ بلا حسابٍ مربوطٍ لا صندوقَ له — لا يُخترع له صفّ */
      if (!t.profile.userId) continue
      await safeNotify(this.prisma, {
        userId: t.profile.userId, channel: 'in_app', audience: 'trainer',
        templateKey: 'submission.queued',
        title: `تسليمٌ ينتظر تصحيحَك: ${cohort.title}`,
        body: `بدأ التسليمُ على «${assessment.title}». افتح «طابور التقييم».`,
        data: { assessmentId: assessment.id, cohortId: assessment.cohortId },
      })
    }
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
      accepted: [],
      /* «مرفوض» كانت نهايةً صمّاء: لا إشعار ولا طريق للعودة. صار المدرّب يستطيع
         إعادة فتحها بطلب تسليمٍ جديد — فالرفض تقويمٌ لا طرد. */
      rejected: ['resubmit_requested'],
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

    /* إغلاق الحلقة عند المتعلّم. كان يرسل واجبه ثم **لا يُخبَر بشيء أبدا** —
       لا عند القبول ولا الرفض ولا طلب الإعادة — فيفتح الصفحة كل يوم يتفقّد.
       والتغذية الراجعة هي المنتَج نفسه: التعلّم يقع فيها لا في المشاهدة، وتأخّرُها
       يُفقدها أثرها. أمّا `start_review` فحالةٌ داخلية لا تعني المتعلّم شيئا. */
    if (action !== 'start_review') {
      await this.notifyLearnerOfReview(submission.enrollmentId, submissionId, action, note)
    }
    return updated
  }

  /** نصّ الإشعار يقول ما حدث وما يُفعل الآن — لا «تغيّرت حالة تسليمك» */
  private async notifyLearnerOfReview(
    enrollmentId: string, submissionId: string,
    action: 'request_resubmit' | 'accept' | 'reject', note?: string,
  ) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { userId: true, cohort: { select: { title: true } } },
    })
    if (!enrollment) return
    const where = enrollment.cohort.title
    const reason = note?.trim() ? `\n\nملاحظة المدرّب: ${note.trim()}` : ''
    const copy: Record<typeof action, { title: string; body: string }> = {
      accept: {
        title: 'قُبل تسليمك ✅',
        body: `قُبل واجبك في «${where}» — احتُسبت المحطّة، وتستطيع المضيّ إلى التالية.${reason}`,
      },
      request_resubmit: {
        title: 'تسليمك يحتاج إضافة',
        body: `راجع المدرّب واجبك في «${where}» وطلب تسليما جديدا. ما ينقص مكتوبٌ لك، وتستطيع الإعادة الآن.${reason}`,
      },
      reject: {
        title: 'لم يُقبل تسليمك',
        body: `لم يُقبل واجبك في «${where}». السبب مكتوبٌ لك، وبابُ الإعادة يفتحه مدرّبك متى راجعتَه.${reason}`,
      },
    }
    await safeNotify(this.prisma, {
      userId: enrollment.userId, channel: 'in_app',
      title: copy[action].title, body: copy[action].body,
      templateKey: `submission.${action}`,
      data: { submissionId },
    })
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
      await this.notifyLearnerOfGrade(input, 'update')
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
    await this.notifyLearnerOfGrade(input, 'create')
    return grade
  }

  /** درجةٌ لا يعلم بها صاحبُها ليست تقويما. تصل مع اسم الشعبة ومكان التفصيل. */
  private async notifyLearnerOfGrade(
    input: { submissionId?: string; attemptId?: string; score: number; maxScore: number },
    kind: 'create' | 'update',
  ) {
    const owner = input.submissionId
      ? await this.prisma.assignmentSubmission.findUnique({
          where: { id: input.submissionId },
          select: { enrollment: { select: { userId: true, cohort: { select: { title: true } } } } },
        })
      : await this.prisma.assessmentAttempt.findUnique({
          where: { id: input.attemptId! },
          select: { enrollment: { select: { userId: true, cohort: { select: { title: true } } } } },
        })
    if (!owner?.enrollment) return
    const where = owner.enrollment.cohort.title
    await safeNotify(this.prisma, {
      userId: owner.enrollment.userId, channel: 'in_app',
      title: kind === 'create' ? 'وصلت درجتك' : 'عُدّلت درجتك',
      body:
        `${input.score} من ${input.maxScore} في «${where}»` +
        (kind === 'update' ? ' — راجعها مدرّبك وعدّلها.' : '.') +
        ' التفصيل في «تعلّمي».',
      templateKey: `grade.${kind}`,
      data: { submissionId: input.submissionId ?? null, attemptId: input.attemptId ?? null },
    })
  }

  async addFeedback(trainerUserId: string, submissionId: string, body: string) {
    if (body.trim().length < 3) throw new AuthError('empty_feedback', 'التغذية الراجعة فارغة')
    await this.assertTrainerOfSubmission(trainerUserId, submissionId)
    const fb = await this.prisma.trainerFeedback.create({ data: { submissionId, authorId: trainerUserId, body } })
    await recordAudit(this.prisma, { actorId: trainerUserId, action: 'feedback.add', entityType: 'assignment_submission', entityId: submissionId })
    return fb
  }

  /** طابور مراجعة المدرب — تسليمات شعبه فقط */
  /* ═══ طابورُ التصحيح — ما يحتاجه الحكمُ لا ما يسهل جلبُه ═══

     كان الطابورُ يُرجع `enrollment` كاملا ومعه `userId` **ولا اسم**: يصل
     المعرّفُ إلى الشاشة فيُهمَل، فيصحّح المدرّبُ عملا لا يعرف صاحبَه. وهو
     يحكم على إنسانٍ بعينه لا على صفٍّ في قاعدة.

     والمسطرةُ لم تكن تُجلَب أصلا — وأعمدتُها قائمةٌ منذ زمن (`rubricId`
     و`RubricCriterion`)، ومسلكُ الدرجة يقبل `rubricScores` ولا يرسلها أحد.
     فمساطرُ مؤلَّفةٌ ترقد بلا قارئ، والحكمُ يصير رقما بلا سببٍ مكتوب.

     ومفتاحُ التخزين **لا يخرج**: كان يصل الشاشةَ خاما — مفتاحُ ملفِّ متعلّمٍ
     في متنٍ يُقرأ من أدوات المتصفّح ويُنسخ في محادثة. فيخرج مسارُ قراءةٍ
     محروسٌ بدلَه، وحارسُه الجلسةُ لا توقيعٌ في العنوان: قارئُه مدرّبُ الشعبة
     أو صاحبُ التسليم، وكلاهما داخلٌ بحسابه — وهي القاعدةُ نفسُها المكتوبةُ
     في `cohort-file.routes.ts` لملفّات الشعبة. */
  async trainerQueue(trainerUserId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({ where: { userId: trainerUserId } })
    if (!profile) throw new AuthError('not_trainer', 'لا ملف مدرب لهذا الحساب', 403)
    const rows = await this.prisma.assignmentSubmission.findMany({
      where: { assessment: { cohort: { trainers: { some: { profileId: profile.id } } } }, status: { in: ['submitted', 'under_review'] } },
      include: {
        assessment: {
          include: {
            cohort: { select: { title: true } },
            rubric: { include: { criteria: { orderBy: { sequence: 'asc' } } } },
          },
        },
        /* الاسمُ وحدَه: البريدُ والرقمُ ملكُ المتعلّم، والمنصّةُ هي القناة */
        enrollment: { include: { user: { select: { displayName: true } } } },
        grades: { include: { history: true } }, feedback: true,
      },
      orderBy: { submittedAt: 'asc' },
    })
    return rows.map(({ storageKey, ...s }) => ({
      ...s,
      fileUrl: storageKey ? `/api/v1/submission-files/${encodeURIComponent(storageKey)}` : null,
    }))
  }

  /* ═══ من يقرأ ملفَّ تسليم ═══

     صاحبُه، ومدرّبُ شعبته. ولا ثالثَ من هذا الباب: من يعتمد الخطّةَ لا شأنَ
     له بمُخرَجِ متعلّمٍ بعينه، وبابُ الإدارة إلى أعمال المتعلّمين غيرُ هذا.

     وما لا يملكه يُردّ **بأربعمئةٍ وأربعة** لا بثلاثمئةٍ وثلاثة: وجودُ ملفٍّ
     بمفتاحٍ بعينه خبرٌ في نفسه. */
  async assertCanReadSubmissionFile(storageKey: string, auth: { userId: string }) {
    const row = await this.prisma.assignmentSubmission.findFirst({
      where: { storageKey },
      select: {
        id: true,
        enrollment: { select: { userId: true } },
        assessment: { select: { cohort: { select: { trainers: { select: { profile: { select: { userId: true } } } } } } } },
      },
    })
    if (!row) throw new AuthError('not_found', 'الملف غير موجود', 404)
    const mine = row.enrollment.userId === auth.userId
    const teaches = row.assessment.cohort.trainers.some((t) => t.profile.userId === auth.userId)
    if (!mine && !teaches) throw new AuthError('not_found', 'الملف غير موجود', 404)
    return row
  }
}
