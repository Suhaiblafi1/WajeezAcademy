/* خدمة الواجبات والتقييم — إنشاء، تسليم، مراجعة المدرب على شعبه فقط،
   إعادة تسليم، قبول/رفض بسبب، درجة بالروبرك، تغذية راجعة، وسجل تعديل درجة لا يُمحى. */

import { Prisma, type CohortAssessment, type PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import type { TypedLink } from '../../src/application/trainer/plan-overlay'
import { recordAudit } from './audit'
import { EnrollmentService } from './enrollment.service'
import { assertFileUploadsEnabled, newStorageKey, signKey, SIGNED_URL_TTL_MS } from './storage.service'
import { notifyRole, safeNotify } from './notification.service'
import { PLAN_GATE_SELECT, planApprovedOnce } from './registration-window'
import { slotIndexOf, type PlanSlot } from '../../src/application/trainer/axis-timeline'
import { periodBounds, realDate } from '../../src/application/trainer/cohort-period'
import { assessmentOpensAt, submitVerdict } from '../../src/application/learning/cohort-gate'
import { loadLearnerGate } from './learner-gate'
import {
  cleanFileName, SUBMISSION_FILE_MAX_BYTES, submissionFileProblemAr, submissionFileType, withSubmissionFileView,
} from '../../src/application/learning/submission-file'
import {
  awaitsDecision, nextEditChange, planApprovalApplies, proposedTask, readTaskChange, taskReview, taskValues, toTaskPatch,
  type TaskChange, type TaskPatch, type TaskReview, type TaskValues,
} from '../../src/application/trainer/task-approval'

/** ما يطلبه المتعلّمُ قبل رفع ملفّ تسليمه — والنوعُ الذي يقوله متصفّحُه لا يُؤخذ به */
export interface SubmissionFileInput { originalName: string; mime?: string; sizeBytes: number }

/* ملفُّ التسليم يُفحص قبل أن يُصدَر رابطُه: النوعُ من الامتداد (`submission-file.ts`)، والسقفُ
   سقفُ التسليم، والسببُ يُقال بكلامٍ يفهمه المتعلّم. والرفعُ إلى مسار البثّ: الملفُّ الكبيرُ لا
   يُقرأ في الذاكرة. */
function checkSubmissionFile(input: SubmissionFileInput): { name: string; mime: string; sizeBytes: number } {
  assertFileUploadsEnabled('اكتب إجابتك نصّا.')
  const name = cleanFileName(input.originalName)
  const problem = submissionFileProblemAr(name, input.sizeBytes)
  if (problem) throw new AuthError(input.sizeBytes > SUBMISSION_FILE_MAX_BYTES ? 'too_large' : 'bad_file', problem, input.sizeBytes > SUBMISSION_FILE_MAX_BYTES ? 413 : 422)
  return { name, mime: submissionFileType(name)!.mime, sizeBytes: input.sizeBytes }
}

function submissionUploadUrl(storageKey: string): string {
  const exp = Date.now() + SIGNED_URL_TTL_MS
  return `/api/v1/uploads/${storageKey}/stream?exp=${exp}&sig=${signKey(storageKey, exp, 'write')}`
}

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

  /* ═══ آخرُ موعدٍ افتراضيٌّ للمهمّة: آخرُ موعدِ محورها (٢٧ سبتمبر ٢٠٢٦) ═══

     «موعدُ التسليم الافتراضيُّ نهايةُ الموعد، والمتأخّرُ يُقبل ويُعلَّم» —
     من قرارات صاحب المنصّة. والخطّةُ المقروءةُ آخرُ خطّةٍ كتبها المدرّب:
     هي ما يرتّبه الآن، والمهمّةُ تُكتب في الخطوة نفسِها. ومهمّةٌ بلا محورٍ أو
     محورٌ بلا موعدٍ لا موعدَ يُفترَض لها — يُترك لمن يكتبه. */
  private async slotDueAt(cohortId: string, moduleId: string | null | undefined): Promise<Date | null> {
    if (!moduleId) return null
    const plan = await this.prisma.cohortDeliveryPlan.findFirst({
      where: { cohortId, trainerId: { not: null } }, orderBy: { createdAt: 'desc' }, select: { content: true },
    })
    const slots = ((plan?.content ?? null) as { slots?: PlanSlot[] | null } | null)?.slots ?? []
    const slot = slots[slotIndexOf(slots, moduleId)]
    if (!slot || !realDate(slot.startsOn) || !realDate(slot.endsOn)) return null
    return periodBounds(slot).to
  }

  /* ═══ وبعد الاعتماد كلُّ تغييرٍ باعتماد — والمهامُّ منه (٣ج-٣) ═══

     القاعدةُ ومآلاتُها في رأس `application/trainer/task-approval.ts`. وهنا
     ما تحتاجه الخدمة: أاعتُمدت للشعبة خطّةٌ قطّ، وكم ينتظر فيها، ومن يُخبَر. */

  /** اعتُمدت لمدرّب الشعبة خطّةٌ قطّ؟ — منه تنتظر المهامُّ الإدارة */
  private async approvedOnce(cohortId: string): Promise<boolean> {
    const plans = await this.prisma.cohortDeliveryPlan.findMany({
      where: { cohortId, ...PLAN_GATE_SELECT.where }, select: PLAN_GATE_SELECT.select,
    })
    return planApprovedOnce(plans)
  }

  /** ما ينتظر قرارَ الإدارة في الشعبة — بالقاعدة نفسِها التي تعرض بها قائمتَها */
  private async awaitingCount(cohortId: string): Promise<number> {
    const rows = await this.prisma.cohortAssessment.findMany({
      where: { cohortId, status: { in: ['draft', 'published'] } },
      select: { status: true, pendingChange: true, reviewerNote: true },
    })
    return rows.filter((r) => awaitsDecision(taskReview(r, true))).length
  }

  /* الخبرُ عند انتقال قائمة الشعبة من فارغةٍ إلى غيرِ فارغة — كطابور التصحيح:
     مدرّبٌ يعدّل خمسَ مهامّ متتاليةً لا يُرسل إلى الإدارة خمسةَ أخبار، فتتعلّم
     أن تتجاوزها كلَّها. ويعود الخبرُ إن فرغت القائمةُ ثمّ امتلأت. */
  private async notifyAdminsOfTaskQueue(cohortId: string, assessmentId: string) {
    const cohort = await this.prisma.cohort.findUnique({ where: { id: cohortId }, select: { title: true } })
    await notifyRole(this.prisma, ['academic_manager', 'super_admin'], {
      channel: 'in_app',
      title: 'مهامُّ تنتظر قرارك',
      body: `أضاف مدرّبُ «${cohort?.title ?? 'الشعبة'}» مهمّةً أو طلب تعديلَها أو حذفَها بعد اعتماد خطّته — ولا يصل المتعلّمين شيءٌ منها حتّى تعتمده. راجِعها من بطاقة الشعبة.`,
      templateKey: 'cohort.assessment.pending',
      data: { cohortId, assessmentId },
    })
  }

  /* ── إنشاء الواجبات/التقييمات (إدارة أو مدرب الشعبة) ── */

  async createAssessment(actorId: string, input: {
    cohortId: string; title: string; type: 'assignment' | 'quiz' | 'project'
    moduleId?: string; briefAr?: string; maxScore?: number; passScore?: number; dueAt?: Date; rubricId?: string
    attachments?: TypedLink[]
    items?: { prompt: string; kind?: string; maxScore?: number }[]
  }, opts: { byTrainer?: boolean } = {}) {
    const cohort = await this.prisma.cohort.findUnique({ where: { id: input.cohortId } })
    if (!cohort) throw new AuthError('not_found', 'الشعبة غير موجودة', 404)
    if (input.rubricId) {
      const rubric = await this.prisma.gradingRubric.findUnique({ where: { id: input.rubricId } })
      if (!rubric || rubric.status !== 'active') throw new AuthError('unknown_rubric', 'الروبرك غير موجود أو مؤرشف', 404)
    }
    const dueAt = input.dueAt ?? (await this.slotDueAt(input.cohortId, input.moduleId)) ?? undefined
    /* ومهمّةٌ يضيفها المدرّبُ بعد اعتماد خطّته تُنشأ مسودّةً تنتظر الإدارة (٣ج-٣) —
       والإدارةُ إن أنشأت نشرت: هي المعتمِد */
    const awaiting = opts.byTrainer === true && (await this.approvedOnce(input.cohortId))
    const queueWasEmpty = awaiting && (await this.awaitingCount(input.cohortId)) === 0
    const assessment = await this.prisma.cohortAssessment.create({
      data: {
        cohortId: input.cohortId, title: input.title, type: input.type, moduleId: input.moduleId,
        briefAr: input.briefAr, maxScore: input.maxScore ?? 100, passScore: input.passScore, dueAt,
        rubricId: input.rubricId, createdBy: actorId,
        ...(awaiting ? { status: 'draft' } : {}),
        /* عمودُ JSON: Prisma يطلب `InputJsonValue` لا نوعَنا — والتحويلُ
           هنا صريحٌ في موضعٍ واحد، لا `any` ينتشر في الخدمة. */
        attachments: (input.attachments ?? undefined) as Prisma.InputJsonValue | undefined,
        items: input.items ? { create: input.items.map((it, i) => ({ sequence: i + 1, prompt: it.prompt, kind: it.kind ?? 'text', maxScore: it.maxScore ?? 10 })) } : undefined,
      },
      include: { items: true },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'assessment.create', entityType: 'cohort_assessment', entityId: assessment.id,
      meta: { cohortId: input.cohortId, type: input.type, ...(awaiting ? { awaitingApproval: true } : {}) },
    })
    if (queueWasEmpty) await this.notifyAdminsOfTaskQueue(input.cohortId, assessment.id)
    return { ...assessment, review: taskReview(assessment, awaiting) }
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
    moduleId?: string | null
  }) {
    const before = await this.assertAssessmentTrainer(actorId, assessmentId)
    /* ═══ وبعد الاعتماد: تعديلُ المنشورة طلبٌ ينتظر الإدارة (٣ج-٣) ═══

       المتعلّمون يقرؤون الصفَّ نفسَه — فلا يُكتب فيه ما لم يُعتمَد. والطلبُ
       يُحفظ بجانبه (`pendingChange`)، وتعديلُ الطلب يعدّل الطلبَ لا المعتمَد.
       والمسودّةُ تُعدَّل كما كانت: لا يراها أحدٌ بعد. */
    const approved = await this.approvedOnce(before.cohortId)
    const gated = approved && before.status === 'published'
    const live = taskValues(before)
    const previous = gated ? readTaskChange(before.pendingChange) : null
    /* ومهمّةٌ رُبطت بمحورها ولا موعدَ لها يُفترض لها آخرُ موعده — وما كتبه
       صاحبُها بيده لا يُمسّ، ولا ما محاه قصدا في النداء نفسِه */
    const fallbackDue = patch.moduleId && patch.dueAt === undefined && proposedTask(live, previous).dueAt === null
      ? await this.slotDueAt(before.cohortId, patch.moduleId)
      : null
    /* الدرجةُ العظمى لا تنزل تحت درجةٍ رُصدت فعلا — ويُفحص عند الطلب كما عند
       تطبيقه: لا يُرسَل إلى الإدارة ما لا يُطبَّق */
    if (patch.maxScore !== undefined) await this.assertMaxScoreFits(assessmentId, before.maxScore, patch.maxScore)
    if (gated) {
      return this.requestEdit(actorId, before, live, previous, toTaskPatch({ ...patch, ...(fallbackDue ? { dueAt: fallbackDue } : {}) }))
    }
    const updated = await this.prisma.cohortAssessment.update({
      where: { id: assessmentId },
      data: {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.briefAr !== undefined ? { briefAr: patch.briefAr } : {}),
        ...(patch.type !== undefined ? { type: patch.type } : {}),
        ...(patch.maxScore !== undefined ? { maxScore: patch.maxScore } : {}),
        ...(patch.dueAt !== undefined ? { dueAt: patch.dueAt } : fallbackDue ? { dueAt: fallbackDue } : {}),
        ...(patch.moduleId !== undefined ? { moduleId: patch.moduleId } : {}),
        /* المصفوفةُ الفارغةُ محوٌ مقصودٌ لا إهمال — ولذلك `!== undefined` */
        ...(patch.attachments !== undefined ? { attachments: patch.attachments as unknown as Prisma.InputJsonValue } : {}),
        /* ومسودّةٌ ردّتها الإدارةُ فعدّلها صاحبُها تعود تنتظرها — بلا السبب القديم */
        reviewerNote: null,
      },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'assessment.update', entityType: 'cohort_assessment', entityId: assessmentId,
      meta: { cohortId: before.cohortId, fields: Object.keys(patch) },
    })
    if (approved && before.status === 'draft' && before.reviewerNote && (await this.awaitingCount(before.cohortId)) === 1) {
      await this.notifyAdminsOfTaskQueue(before.cohortId, assessmentId)
    }
    return { ...updated, review: taskReview(updated, approved) }
  }

  /** الدرجةُ العظمى لا تنزل تحت درجةٍ رُصدت فعلا — وإلّا صار متعلّمٌ حاصلا على أكثرَ من النهاية */
  private async assertMaxScoreFits(assessmentId: string, currentMax: number, nextMax: number) {
    if (nextMax >= currentMax) return
    const top = await this.prisma.grade.aggregate({
      where: { submission: { assessmentId } },
      _max: { score: true },
    })
    /* `Grade.score` عشريٌّ في القاعدة — يُقارَن رقما لا كائنا */
    const highest = Number(top._max.score ?? 0)
    if (highest > nextMax) {
      throw new AuthError('score_below_awarded', `درجةٌ مرصودةٌ تبلغ ${highest} — لا تُخفَض النهايةُ دونها`)
    }
  }

  /** طلبُ تعديلٍ على منشورةٍ بعد الاعتماد — يُحفظ بجانبها، ولا يمسّ ما يقرؤه المتعلّم */
  private async requestEdit(
    actorId: string, before: CohortAssessment, live: TaskValues, previous: TaskChange | null, requested: TaskPatch,
  ) {
    const change = nextEditChange(live, previous, requested, new Date())
    /* لا شيءَ يُطلب ولا طلبَ تعديلٍ يُسحب — ومن طلب الحذفَ ثمّ حفظ بلا تغييرٍ لم يسحبه */
    if (!change && previous?.kind !== 'edit') return { ...before, review: taskReview(before, true) }
    const queueWasEmpty = change !== null && (await this.awaitingCount(before.cohortId)) === 0
    const updated = await this.prisma.cohortAssessment.update({
      where: { id: before.id },
      data: change
        ? { pendingChange: change as unknown as Prisma.InputJsonValue, reviewerNote: null }
        /* أعاد القيمَ إلى المعتمَد: سحب طلبَه */
        : { pendingChange: Prisma.DbNull },
    })
    await recordAudit(this.prisma, {
      actorId, action: change ? 'assessment.change.request' : 'assessment.change.withdraw',
      entityType: 'cohort_assessment', entityId: before.id,
      meta: { cohortId: before.cohortId, kind: 'edit', ...(change?.kind === 'edit' ? { fields: Object.keys(change.fields) } : {}) },
    })
    if (queueWasEmpty) await this.notifyAdminsOfTaskQueue(before.cohortId, before.id)
    return { ...updated, review: taskReview(updated, true) }
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
    /* وبعد الاعتماد: حذفُ المنشورة طلبٌ ينتظر الإدارة (٣ج-٣) — تبقى عند
       المتعلّمين حتّى يُعتمَد. والمسودّةُ تُحذف كما كانت: لا يراها أحد */
    if (before.status === 'published' && (await this.approvedOnce(before.cohortId))) {
      return this.requestRemoval(actorId, before)
    }
    await this.prisma.cohortAssessment.delete({ where: { id: assessmentId } })
    await recordAudit(this.prisma, {
      actorId, action: 'assessment.delete', entityType: 'cohort_assessment', entityId: assessmentId,
      meta: { cohortId: before.cohortId, title: before.title },
    })
    return { deleted: true }
  }

  /** طلبُ حذفِ منشورةٍ بعد الاعتماد — تبقى عند المتعلّمين حتّى يُعتمَد */
  private async requestRemoval(actorId: string, before: CohortAssessment) {
    if (readTaskChange(before.pendingChange)?.kind === 'remove') return { deleted: false, review: 'remove' as const }
    const queueWasEmpty = (await this.awaitingCount(before.cohortId)) === 0
    const change: TaskChange = { kind: 'remove', requestedAt: new Date().toISOString() }
    await this.prisma.cohortAssessment.update({
      where: { id: before.id },
      data: { pendingChange: change as unknown as Prisma.InputJsonValue, reviewerNote: null },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'assessment.change.request', entityType: 'cohort_assessment', entityId: before.id,
      meta: { cohortId: before.cohortId, kind: 'remove', title: before.title },
    })
    if (queueWasEmpty) await this.notifyAdminsOfTaskQueue(before.cohortId, before.id)
    return { deleted: false, review: 'remove' as const }
  }

  /** سحبُ المدرّب طلبَه — والمعتمَدُ باقٍ كما هو */
  async withdrawChange(actorId: string, assessmentId: string) {
    const before = await this.assertAssessmentTrainer(actorId, assessmentId)
    const change = readTaskChange(before.pendingChange)
    if (!change) throw new AuthError('nothing_pending', 'لا طلبَ على هذه المهمّة يُسحب', 409)
    const updated = await this.prisma.cohortAssessment.update({
      where: { id: assessmentId }, data: { pendingChange: Prisma.DbNull },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'assessment.change.withdraw', entityType: 'cohort_assessment', entityId: assessmentId,
      meta: { cohortId: before.cohortId, kind: change.kind },
    })
    return { ...updated, review: taskReview(updated, true) }
  }

  /* ═══ قرارُ الإدارة في مهمّةٍ تنتظر (٣ج-٣) ═══

     الجديدةُ تُنشر، والتعديلُ يُكتب في الصفّ الذي يقرؤه المتعلّمون، والحذفُ
     يقع. والردُّ لا يمسّ المعتمَد: يُمحى الطلبُ ويصل المدرّبَ سببُه، والمسودّةُ
     المردودةُ تبقى عنده — يعدّلها فتعود إلى الإدارة، أو يحذفها. ولا ردَّ بلا
     سبب: من رُدّ عليه بلا سببٍ يخمّن. */
  async decideTask(actorId: string, assessmentId: string, approve: boolean, note?: string) {
    const task = await this.prisma.cohortAssessment.findUnique({
      where: { id: assessmentId }, include: { _count: { select: { submissions: true } } },
    })
    if (!task) throw new AuthError('not_found', 'هذه المهمّة غير موجودة', 404)
    const review = taskReview(task, await this.approvedOnce(task.cohortId))
    if (!awaitsDecision(review)) throw new AuthError('nothing_pending', 'لا شيءَ في هذه المهمّة ينتظر قرارا', 409)
    const said = note?.trim() || null
    if (!approve && !said) {
      throw new AuthError('reason_required', 'قل للمدرّب لماذا — الردُّ بلا سببٍ يتركه يخمّن', 400)
    }
    if (approve) await this.applyReview(task, review)
    else {
      await this.prisma.cohortAssessment.update({
        where: { id: task.id }, data: { pendingChange: Prisma.DbNull, reviewerNote: said },
      })
    }
    await recordAudit(this.prisma, {
      actorId, action: approve ? 'assessment.change.approve' : 'assessment.change.reject',
      entityType: 'cohort_assessment', entityId: task.id,
      meta: { cohortId: task.cohortId, kind: review, title: task.title, ...(said ? { note: said } : {}) },
    })
    await this.tellTrainersOfDecision(task, review, approve, said)
    return { status: approve ? ('approved' as const) : ('declined' as const), kind: review }
  }

  /** يُنفذ ما ينتظر — وما يمنعه يُقال بسببه، لا يُتجاوَز */
  private async applyReview(task: CohortAssessment & { _count: { submissions: number } }, review: TaskReview) {
    if (review === 'new' || review === 'draft') {
      await this.prisma.cohortAssessment.update({ where: { id: task.id }, data: { status: 'published', reviewerNote: null } })
      return
    }
    const change = readTaskChange(task.pendingChange)
    if (change?.kind === 'remove') {
      /* سلّم فيها أحدٌ بعد الطلب — وعملُه ليس ملكَ المدرّب ولا الإدارة */
      if (task._count.submissions > 0) {
        throw new AuthError(
          'has_submissions',
          `سلّم فيها ${task._count.submissions} بعد طلب حذفها — لا تُحذف مهمّةٌ فيها عملُ متعلّمين. ردَّ الطلبَ بسببه.`,
          409,
        )
      }
      await this.prisma.cohortAssessment.delete({ where: { id: task.id } })
      return
    }
    if (change?.kind !== 'edit') return
    const f = change.fields
    if (f.maxScore !== undefined) await this.assertMaxScoreFits(task.id, task.maxScore, f.maxScore)
    await this.prisma.cohortAssessment.update({
      where: { id: task.id },
      data: {
        ...(f.title !== undefined ? { title: f.title } : {}),
        ...(f.briefAr !== undefined ? { briefAr: f.briefAr } : {}),
        ...(f.type !== undefined ? { type: f.type } : {}),
        ...(f.maxScore !== undefined ? { maxScore: f.maxScore } : {}),
        ...(f.dueAt !== undefined ? { dueAt: f.dueAt === null ? null : new Date(f.dueAt) } : {}),
        ...(f.moduleId !== undefined ? { moduleId: f.moduleId } : {}),
        ...(f.attachments !== undefined ? { attachments: f.attachments as unknown as Prisma.InputJsonValue } : {}),
        pendingChange: Prisma.DbNull,
        reviewerNote: null,
      },
    })
  }

  /** المدرّبُ يعلم ما قُرّر في طلبه — ولماذا إن رُدّ */
  private async tellTrainersOfDecision(
    task: { id: string; cohortId: string; title: string }, review: TaskReview, approve: boolean, note: string | null,
  ) {
    const cohort = await this.prisma.cohort.findUnique({
      where: { id: task.cohortId },
      select: { title: true, trainers: { select: { profile: { select: { userId: true } } } } },
    })
    if (!cohort) return
    const approvedTitle: Partial<Record<TaskReview, string>> = {
      new: `اعتُمدت مهمّتُك «${task.title}»`,
      edit: `اعتُمد تعديلُ «${task.title}»`,
      remove: `اعتُمد حذفُ «${task.title}»`,
    }
    const approvedBody = review === 'remove'
      ? `حُذفت من «${cohort.title}» ولم تعد تظهر لمتعلّميك.`
      : `صارت في منهج «${cohort.title}» كما كتبتَها — وتُفتح لمتعلّميك في موعدها.`
    const declinedBody = review === 'new'
      ? `${note} — ولا تظهر لمتعلّميك: عدّلها فتعود إلى الإدارة، أو احذفها.`
      : `${note} — وما اعتُمد قبلُ باقٍ كما هو عند متعلّميك.`
    for (const t of cohort.trainers) {
      /* ملفٌّ بلا حسابٍ مربوطٍ لا صندوقَ له */
      if (!t.profile.userId) continue
      await safeNotify(this.prisma, {
        userId: t.profile.userId, channel: 'in_app', audience: 'trainer',
        templateKey: 'cohort.assessment.decision',
        title: approve ? (approvedTitle[review] ?? `اعتُمد ما طلبتَه في «${task.title}»`) : `ردّت الإدارةُ ما طلبتَه في «${task.title}»`,
        body: approve ? approvedBody : declinedBody,
        data: { cohortId: task.cohortId, assessmentId: task.id },
      })
    }
  }

  /* ═══ واعتمادُ الخطّة يعتمد ما ينتظر من مهامّها — الاعتمادُ واحد (٣ج-٣) ═══

     المعتمِدُ قرأ المنهجَ كلَّه قبل أن يعتمد، ومهامُّه فيه بما طُلب فيها. فكما
     يعتمد اعتمادُها لقاءاتِها المنتظِرة، يعتمد ما ينتظر من مهامّها — بالمسلك
     نفسِه الذي تمرّ به المهمّةُ وحدَها (`applyReview`) — ومسودّاتِ ما قبل أوّل
     اعتماد. وما يمنعه مانعٌ (سلّم فيها أحدٌ بعد طلب حذفها) يبقى منتظِرا ويُسمّى. */
  async applyPendingForPlan(actorId: string, cohortId: string, planId: string) {
    const rows = await this.prisma.cohortAssessment.findMany({
      where: { cohortId, status: { in: ['draft', 'published'] } },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { submissions: true } } },
    })
    const out = { applied: 0, failed: [] as { id: string; title: string; reason: string }[] }
    for (const row of rows) {
      /* تُقرأ بعد الاعتماد — فمسودّةُ ما قبله «جديدة»، وكلتاهما تُعتمَد */
      const review = taskReview(row, true)
      if (!planApprovalApplies(review)) continue
      try {
        await this.applyReview(row, review)
        out.applied += 1
        await recordAudit(this.prisma, {
          actorId, action: 'assessment.change.approve', entityType: 'cohort_assessment', entityId: row.id,
          meta: { cohortId, kind: review, title: row.title, planId },
        })
      } catch (e) {
        out.failed.push({ id: row.id, title: row.title, reason: e instanceof AuthError ? e.message : 'خطأ غير متوقّع' })
      }
    }
    return out
  }

  /* ── تسليم المتعلم ── */

  /* ═══ متى يُقبل التسليم — ومتى يُعلَّم متأخّرا (٢(ب-٢)) ═══

     قراراتُ صاحب المنصّة بكلمة «go»: المهمّةُ تُفتح بعد أوّل لقاءٍ لمحورها،
     والتسليمُ يتوقّف بانتهاء الشعبة، و«المتأخّرُ يُقبل ويُعلَّم». والحكمُ في
     `submitVerdict` — القاعدةُ نفسُها التي تقول بها شاشةُ المتعلّم «تُفتح
     الثلاثاء»، فلا تقول الشاشةُ «مفتوحة» ويردّ الخادم. وما اعتُمد بلا مواعيد
     لا بوّابةَ فيه: يُقبل كما كان ويُعلَّم متأخّرا بعد موعده. */
  private async submitGate(
    assessment: { cohortId: string; moduleId: string | null; dueAt: Date | null },
    resubmitRequested: boolean,
    now = new Date(),
  ): Promise<{ late: boolean }> {
    const loaded = await loadLearnerGate(this.prisma, assessment.cohortId, now)
    const gate = loaded?.gate ?? null
    const verdict = submitVerdict({
      opensAt: gate ? assessmentOpensAt(gate, assessment.moduleId) : null,
      dueAt: assessment.dueAt,
      window: gate?.window ?? null,
      now,
      resubmitRequested,
    })
    if (!verdict.ok) throw new AuthError(verdict.code, verdict.messageAr, 409)
    return { late: verdict.late }
  }

  /** تسليم واجب — نص أو ملف خاص؛ المتعلم المسجل فقط */
  async submitAssignment(userId: string, assessmentId: string, input: {
    textAnswer?: string; file?: SubmissionFileInput
  }) {
    const assessment = await this.prisma.cohortAssessment.findUnique({ where: { id: assessmentId } })
    if (!assessment || assessment.status !== 'published') throw new AuthError('not_open', 'هذا التكليف غير متاح للتسليم', 404)
    const enrollment = await this.enrollments.assertEnrolled(userId, assessment.cohortId)
    const textAnswer = input.textAnswer?.trim() || undefined
    if (!textAnswer && !input.file) throw new AuthError('empty_submission', 'التسليم فارغ — اكتب إجابتك أو أرفق ملفّا')
    /* إعادةٌ طلبها المدرّبُ تُقبل بعد انتهاء الشعبة ولا تُعلَّم متأخّرة — تُعرف
       بآخر تسليمٍ له على المهمّة، أيّا كان البابُ الذي جاء منه */
    const last = await this.prisma.assignmentSubmission.findFirst({
      where: { assessmentId, enrollmentId: enrollment.id }, orderBy: { submittedAt: 'desc' }, select: { status: true },
    })
    const { late } = await this.submitGate(assessment, last?.status === 'resubmit_requested')

    const file = input.file ? checkSubmissionFile(input.file) : null
    const storageKey = file ? newStorageKey() : undefined
    const uploadUrl = storageKey ? submissionUploadUrl(storageKey) : undefined
    /* الطابورُ قبل الإضافة — الخبرُ عند انتقاله من فارغٍ إلى غيرِ فارغ */
    const pendingBefore = await this.prisma.assignmentSubmission.count({
      where: { assessmentId, status: { in: ['submitted', 'under_review'] } },
    })
    const submission = await this.prisma.assignmentSubmission.create({
      data: {
        assessmentId, enrollmentId: enrollment.id, textAnswer, storageKey, late,
        ...(file && { fileName: file.name, fileMime: file.mime, fileSize: file.sizeBytes }),
      },
    })
    await recordAudit(this.prisma, { actorId: userId, action: 'submission.create', entityType: 'assignment_submission', entityId: submission.id, meta: { assessmentId, late } })
    if (pendingBefore === 0) await this.notifyTrainersOfQueue(assessment)
    /* والمفتاحُ لا يخرج في الردّ — الرفعُ برابطه الموقَّع، والقراءةُ من بابه المحروس */
    const shown: Partial<typeof submission> = { ...submission }
    delete shown.storageKey
    return { submission: shown as Omit<typeof submission, 'storageKey'>, uploadUrl }
  }

  /* ═══ رفعٌ انقطع — يُعاد على التسليم نفسِه (١٠ أكتوبر ٢٠٢٦) ═══

     التسليمُ يُحفظ ثمّ يُرفع ملفُّه. فإن انقطع الرفعُ (شبكةٌ ضعيفة، أو صفحةٌ أُغلقت) بقي تسليمٌ
     بلا ملفّ، ولا تسليمَ ثانيا بلا طلبٍ من المدرّب. فلصاحبه أن يرفع ملفَّه من جديد ما دام لم
     يصل ولم يبدأ مدرّبُه مراجعتَه — بالمفتاح نفسِه، وبفحص الملفّ نفسِه. */
  async renewSubmissionUpload(userId: string, submissionId: string, input: SubmissionFileInput) {
    const row = await this.prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      select: { storageKey: true, fileUploadedAt: true, status: true, enrollment: { select: { userId: true } } },
    })
    if (!row || row.enrollment.userId !== userId) throw new AuthError('not_found', 'التسليم غير موجود', 404)
    if (!row.storageKey) throw new AuthError('no_file', 'لم يُرفق بهذا التسليم ملفّ', 409)
    if (row.fileUploadedAt) throw new AuthError('file_arrived', 'وصل الملفُّ كاملا — لا حاجة لرفعه ثانية', 409)
    if (row.status !== 'submitted') throw new AuthError('under_review', 'بدأ مدرّبك مراجعةَ التسليم', 409)
    const file = checkSubmissionFile(input)
    await this.prisma.assignmentSubmission.update({
      where: { id: submissionId }, data: { fileName: file.name, fileMime: file.mime, fileSize: file.sizeBytes },
    })
    return { uploadUrl: submissionUploadUrl(row.storageKey) }
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
  async resubmit(userId: string, assessmentId: string, input: { textAnswer?: string; file?: SubmissionFileInput }) {
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
    /* ولا «إعادةَ بطلب» في الاختبار: المحاولةُ محاولة */
    const { late } = await this.submitGate(assessment, false)

    const attempt = await this.prisma.assessmentAttempt.create({
      data: {
        assessmentId, enrollmentId: enrollment.id, late,
        responses: { create: responses.map((r) => ({ itemId: r.itemId, answer: r.answer as Prisma.InputJsonValue })) },
      },
      include: { responses: true },
    })
    await recordAudit(this.prisma, { actorId: userId, action: 'attempt.create', entityType: 'assessment_attempt', entityId: attempt.id, meta: { assessmentId, late } })
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
    return rows.map(withSubmissionFileView)
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
