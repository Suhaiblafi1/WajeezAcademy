/* ═══ مهامُّ بعد الاعتماد تنتظر قرارَ الإدارة (٣ج-٣) ═══

   «وبعد الاعتماد كلُّ تغييرٍ باعتماد» و«يحقّ للمدرّب لاحقا أن يضيف ويعدّل كلَّ
   شيءٍ براحته بموافقة الإدارة» (قراراتُ صاحب المنصّة، ٢٧ سبتمبر ٢٠٢٦). والقاعدةُ
   محضةٌ في `task-approval.ts` (`src/tests/trainer/task-approval.test.ts`)؛ وهنا
   ما يقع على قاعدةٍ حقيقيّة:

   ① قبل أوّل اعتمادٍ لا انتظار: المهمّةُ تُنشر وتُعدَّل وتُحذف كما كانت.
   ② وبعده: الجديدةُ مسودّةٌ لا يراها المتعلّم، وتعديلُ المنشورة وحذفُها طلبٌ
      بجانبها والمتعلّمُ على المعتمَد — ولا يصله الطلبُ في حمولته. والإدارةُ
      تُخبَر مرّةً حين تمتلئ قائمتُها.
   ③ وقرارُ الإدارة: الاعتمادُ يُنفذ، والردُّ بسببه يُبقي المعتمَد، وما سلّم فيه
      أحدٌ بعد طلب حذفه لا يُحذف.
   ④ واعتمادُ الخطّة يعتمد ما ينتظر من مهامّها — ومسودّاتِ ما قبل أوّل اعتماد.
   ⑤ والمسالكُ بصلاحيّاتها — المدرّبُ ينشئ ويسحب، والمعتمِدُ يقرّر.
   ⑥ والحمولتان تحملان ما تحكم به الشاشتان. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AssessmentService } from '../../services/assessment.service'
import { CohortPlanService } from '../../services/cohort-plan.service'
import { EnrollmentService } from '../../services/enrollment.service'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let assessments: AssessmentService
let plans: CohortPlanService
let enrollments: EnrollmentService
let adminId = ''
let trainerUserId = ''
let profileId = ''
const STAMP = Date.now()

/** شعبةٌ بمدرّبها ومتعلّمٍ مسجَّل — وخطّتُه بالحال المطلوبة، أو بلا خطّة */
async function makeCohort(tag: string, planStatus: string | null) {
  const course = await prisma.course.findFirst({ select: { id: true } })
  const cohort = await prisma.cohort.create({
    data: {
      courseId: course!.id, title: `شعبةُ المهامّ ${tag}`, status: 'active',
      capacity: 20, price: 100, currency: 'USD', timezone: 'Asia/Amman',
    },
  })
  await prisma.cohortTrainer.create({ data: { cohortId: cohort.id, profileId, role: 'lead' } })
  /* بلا مواعيد: لا بوّابةَ على المهامّ — فتخرج إلى المتعلّم صفًّا كاملا، وهو ما
     يُفحص عليه أنّ الطلبَ لا يخرج معها */
  const plan = planStatus
    ? await prisma.cohortDeliveryPlan.create({
        data: { cohortId: cohort.id, trainerId: profileId, status: planStatus, content: { kind: 'trainer', modules: [], resources: [] } },
      })
    : null
  const learner = await prisma.user.create({
    data: { email: `ta-learner-${tag}-${STAMP}@wajeez.test`, displayName: `متعلّمُ ${tag}`, passwordHash: 'x' },
  })
  const enrollment = await prisma.enrollment.create({ data: { cohortId: cohort.id, userId: learner.id, status: 'enrolled' } })
  return { cohortId: cohort.id, planId: plan?.id ?? '', enrollmentId: enrollment.id }
}

const create = (cohortId: string, title: string, extra: Record<string, unknown> = {}) =>
  assessments.createAssessment(trainerUserId, { cohortId, title, type: 'assignment', ...extra }, { byTrainer: true })
const row = (id: string) => prisma.cohortAssessment.findUnique({ where: { id } })
const pendingNotices = () => prisma.notification.count({ where: { templateKey: 'cohort.assessment.pending', userId: adminId } })
const decisionsTold = (assessmentId: string) => prisma.notification.findMany({
  where: { templateKey: 'cohort.assessment.decision', userId: trainerUserId, data: { path: ['assessmentId'], equals: assessmentId } },
})
const learnerTasks = async (enrollmentId: string) =>
  (await enrollments.learnerCohortView(enrollmentId)).cohort.assessments as { id: string; title: string }[]

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  assessments = new AssessmentService(prisma)
  plans = new CohortPlanService(prisma)
  enrollments = new EnrollmentService(prisma)

  adminId = (await prisma.user.create({ data: { email: `ta-admin-${STAMP}@wajeez.test`, displayName: 'المعتمِد', passwordHash: 'x' } })).id
  /* ودورُه يُسنَد فعلا: `notifyRole` يقرأ حاملي الدور — ومعتمِدٌ بلا دورٍ يمرّ
     عليه «أُخبِر مرّةً» صفرا كاذبا */
  await prisma.userRole.create({ data: { userId: adminId, roleId: 'academic_manager' } })
  const tUser = await prisma.user.create({ data: { email: `ta-trainer-${STAMP}@wajeez.test`, displayName: 'مدرّبُ الشعبة', passwordHash: 'x' } })
  trainerUserId = tUser.id
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-TA-${STAMP}`, fullName: 'مدرّبُ الشعبة', email: tUser.email, status: 'active' },
  })
  profileId = (await prisma.trainerProfile.create({ data: { userId: tUser.id, applicationId: application.id } })).id
}, 240_000)

describe('① قبل أوّل اعتمادٍ لا انتظار', () => {
  it('⚠️ خطّةٌ لم تُعتمَد بعد — المهمّةُ تُنشر وتُعدَّل وتُحذف كما كانت', async () => {
    const C = await makeCohort('قبل', 'submitted')
    const a = await create(C.cohortId, 'واجبُ ما قبل الاعتماد')
    expect(a.status).toBe('published')
    expect(a.review).toBe('live')
    const edited = await assessments.updateAssessment(trainerUserId, a.id, { title: 'واجبٌ معدَّل' })
    expect(edited.title, 'تعديلٌ قبل الاعتماد صار طلبا').toBe('واجبٌ معدَّل')
    expect((await row(a.id))?.pendingChange).toBeNull()
    await assessments.deleteAssessment(trainerUserId, a.id)
    expect(await row(a.id), 'حذفٌ قبل الاعتماد صار طلبا').toBeNull()
  })

  it('وشعبةٌ لا خطّةَ لمدرّبها تبقى كما كانت', async () => {
    const C = await makeCohort('بلا-خطّة', null)
    const a = await create(C.cohortId, 'واجبُ شعبةٍ قديمة')
    expect(a.status).toBe('published')
  })
})

describe('② وبعد الاعتماد — المتعلّمُ على المعتمَد', () => {
  let C = { cohortId: '', planId: '', enrollmentId: '' }
  beforeAll(async () => { C = await makeCohort('بعد', 'approved') })

  it('⚠️ الجديدةُ مسودّةٌ لا يراها المتعلّم — والإدارةُ تُخبَر مرّةً حين تمتلئ قائمتُها', async () => {
    const before = await pendingNotices()
    const a = await create(C.cohortId, 'مهمّةٌ أُضيفت بعد الاعتماد')
    expect(a.status, 'الجديدةُ بعد الاعتماد نُشرت بلا قرار').toBe('draft')
    expect(a.review).toBe('new')
    expect((await learnerTasks(C.enrollmentId)).map((t) => t.id)).not.toContain(a.id)
    expect(await pendingNotices(), 'لم تُخبَر الإدارة').toBe(before + 1)

    await create(C.cohortId, 'مهمّةٌ ثانيةٌ في القائمة نفسِها')
    expect(await pendingNotices(), 'خبرٌ لكلّ مهمّة — والقائمةُ ممتلئةٌ أصلا').toBe(before + 1)
  })

  it('⚠️ تعديلُ المنشورة طلبٌ بجانبها — والمتعلّمُ يقرأ المعتمَد، ولا يصله الطلبُ في حمولته', async () => {
    const live = await assessments.createAssessment(adminId, { cohortId: C.cohortId, title: 'مهمّةٌ معتمَدة', type: 'assignment', maxScore: 100 })
    expect(live.status, 'ما تنشئه الإدارةُ يُنشر — هي المعتمِد').toBe('published')

    const r = await assessments.updateAssessment(trainerUserId, live.id, { title: 'عنوانٌ لم يُعتمَد', maxScore: 100 })
    expect(r.review).toBe('edit')
    const stored = await row(live.id)
    expect(stored?.title, 'كُتب التعديلُ في الصفّ الذي يقرؤه المتعلّم').toBe('مهمّةٌ معتمَدة')
    expect(stored?.pendingChange, 'الطلبُ يحمل ما تغيّر وحدَه').toMatchObject({ kind: 'edit', fields: { title: 'عنوانٌ لم يُعتمَد' } })
    expect(Object.keys((stored?.pendingChange as { fields: object }).fields)).toEqual(['title'])

    /* وتسليمٌ عليها ومحاولة — فتخرج المهمّةُ ثانيةً وثالثةً من بابيهما */
    await prisma.assignmentSubmission.create({ data: { assessmentId: live.id, enrollmentId: C.enrollmentId, textAnswer: 'حلّي' } })
    await prisma.assessmentAttempt.create({ data: { assessmentId: live.id, enrollmentId: C.enrollmentId } })
    const view = await enrollments.learnerCohortView(C.enrollmentId)
    const seen = (view.cohort.assessments as { id: string; title: string }[]).find((t) => t.id === live.id)
    expect(seen?.title).toBe('مهمّةٌ معتمَدة')
    const payload = JSON.stringify(view)
    expect(payload, 'العنوانُ المطلوبُ وصل المتعلّم').not.toContain('عنوانٌ لم يُعتمَد')
    expect(payload).not.toContain('pendingChange')
    expect(payload).not.toContain('reviewerNote')
  })

  it('⚠️ وتعديلُ الطلب يعدّل الطلب — ومن أعاد القيمَ إلى المعتمَد سحبه', async () => {
    const t = await assessments.createAssessment(adminId, { cohortId: C.cohortId, title: 'مهمّةُ الطلب المتراكم', type: 'quiz', maxScore: 20 })
    await assessments.updateAssessment(trainerUserId, t.id, { title: 'عنوانٌ مقترَح' })
    await assessments.updateAssessment(trainerUserId, t.id, { maxScore: 30 })
    expect((await row(t.id))?.pendingChange, 'الطلبُ الثاني محا الأوّل').toMatchObject({ fields: { title: 'عنوانٌ مقترَح', maxScore: 30 } })

    const back = await assessments.updateAssessment(trainerUserId, t.id, { title: 'مهمّةُ الطلب المتراكم', maxScore: 20 })
    expect(back.review).toBe('live')
    expect((await row(t.id))?.pendingChange).toBeNull()
    const withdrawn = await prisma.auditEvent.findFirst({ where: { action: 'assessment.change.withdraw', entityId: t.id } })
    expect(withdrawn, 'سحبٌ بلا أثر').not.toBeNull()
  })

  it('⚠️ وحذفُ المنشورة طلبٌ — تبقى عند المتعلّم حتّى يُعتمَد، ويُسحب', async () => {
    const t = await assessments.createAssessment(adminId, { cohortId: C.cohortId, title: 'مهمّةٌ يُطلب حذفُها', type: 'assignment' })
    const r = await assessments.deleteAssessment(trainerUserId, t.id)
    expect(r).toEqual({ deleted: false, review: 'remove' })
    expect(await row(t.id), 'حُذفت بلا قرار').not.toBeNull()
    expect((await learnerTasks(C.enrollmentId)).map((x) => x.id)).toContain(t.id)

    const w = await assessments.withdrawChange(trainerUserId, t.id)
    expect(w.review).toBe('live')
    await expect(assessments.withdrawChange(trainerUserId, t.id)).rejects.toMatchObject({ code: 'nothing_pending' })
  })

  it('⚠️ والمسودّةُ تُعدَّل وتُحذف بلا طلب — لا يراها أحدٌ بعد', async () => {
    const d = await create(C.cohortId, 'مسودّةٌ تُعدَّل')
    const e = await assessments.updateAssessment(trainerUserId, d.id, { title: 'مسودّةٌ عُدّلت' })
    expect(e.title).toBe('مسودّةٌ عُدّلت')
    expect((await row(d.id))?.pendingChange).toBeNull()
    await assessments.deleteAssessment(trainerUserId, d.id)
    expect(await row(d.id)).toBeNull()
  })

  it('⚠️ ولا يُطلب ما لا يُطبَّق — نهايةٌ تحت درجةٍ رُصدت تُردّ عند الطلب', async () => {
    const t = await assessments.createAssessment(adminId, { cohortId: C.cohortId, title: 'مهمّةٌ مصحَّحة', type: 'assignment', maxScore: 100 })
    const sub = await prisma.assignmentSubmission.create({ data: { assessmentId: t.id, enrollmentId: C.enrollmentId, textAnswer: 'ج' } })
    await prisma.grade.create({ data: { submissionId: sub.id, score: 90, maxScore: 100, gradedBy: adminId } })
    await expect(assessments.updateAssessment(trainerUserId, t.id, { maxScore: 50 })).rejects.toMatchObject({ code: 'score_below_awarded' })
    expect((await row(t.id))?.pendingChange).toBeNull()
  })
})

describe('③ قرارُ الإدارة', () => {
  let C = { cohortId: '', planId: '', enrollmentId: '' }
  beforeAll(async () => { C = await makeCohort('قرار', 'approved') })

  it('⚠️ اعتمادُ الجديدة ينشرها للمتعلّم — ويعلم مدرّبُها', async () => {
    const a = await create(C.cohortId, 'جديدةٌ تُعتمَد')
    const r = await assessments.decideTask(adminId, a.id, true)
    expect(r).toEqual({ status: 'approved', kind: 'new' })
    expect((await row(a.id))?.status).toBe('published')
    expect((await learnerTasks(C.enrollmentId)).map((t) => t.id)).toContain(a.id)
    const told = await decisionsTold(a.id)
    expect(told).toHaveLength(1)
    expect(told[0].title).toContain('اعتُمدت مهمّتُك')
  })

  it('⚠️ واعتمادُ التعديل يكتبه في الصفّ الذي يقرؤه المتعلّم — التاريخُ تاريخا والمرفقاتُ مرفقات', async () => {
    const t = await assessments.createAssessment(adminId, { cohortId: C.cohortId, title: 'قبل التعديل', type: 'assignment' })
    const due = new Date('2027-05-01T20:59:59.999Z')
    await assessments.updateAssessment(trainerUserId, t.id, {
      title: 'بعد التعديل', dueAt: due, attachments: [{ title: 'النموذج', url: 'https://x.test/n.pdf', kind: 'file' }],
    })
    await assessments.decideTask(adminId, t.id, true)
    const after = await row(t.id)
    expect(after?.title).toBe('بعد التعديل')
    expect(after?.dueAt?.toISOString()).toBe(due.toISOString())
    expect(after?.attachments).toEqual([{ title: 'النموذج', url: 'https://x.test/n.pdf', kind: 'file' }])
    expect(after?.pendingChange).toBeNull()
  })

  it('⚠️ واعتمادُ الحذف يحذف — إلّا ما سلّم فيه أحدٌ بعد الطلب', async () => {
    const gone = await assessments.createAssessment(adminId, { cohortId: C.cohortId, title: 'تُحذف', type: 'assignment' })
    await assessments.deleteAssessment(trainerUserId, gone.id)
    await assessments.decideTask(adminId, gone.id, true)
    expect(await row(gone.id)).toBeNull()

    const kept = await assessments.createAssessment(adminId, { cohortId: C.cohortId, title: 'سُلّم فيها بعد الطلب', type: 'assignment' })
    await assessments.deleteAssessment(trainerUserId, kept.id)
    await prisma.assignmentSubmission.create({ data: { assessmentId: kept.id, enrollmentId: C.enrollmentId, textAnswer: 'عملي' } })
    await expect(assessments.decideTask(adminId, kept.id, true)).rejects.toMatchObject({ code: 'has_submissions' })
    expect(await prisma.assignmentSubmission.count({ where: { assessmentId: kept.id } }), 'سقط عملُ المتعلّم مع المهمّة').toBe(1)
  })

  it('⚠️ والردُّ بسببه: يُبقي المعتمَد، والمسودّةُ المردودةُ تبقى عند صاحبها', async () => {
    const t = await assessments.createAssessment(adminId, { cohortId: C.cohortId, title: 'معتمَدٌ يبقى', type: 'assignment' })
    await assessments.updateAssessment(trainerUserId, t.id, { title: 'تعديلٌ يُردّ' })
    await expect(assessments.decideTask(adminId, t.id, false)).rejects.toMatchObject({ code: 'reason_required' })
    await expect(assessments.decideTask(adminId, t.id, false, '   ')).rejects.toMatchObject({ code: 'reason_required' })
    const r = await assessments.decideTask(adminId, t.id, false, 'العنوانُ الأوّلُ أوضح')
    expect(r).toEqual({ status: 'declined', kind: 'edit' })
    const after = await row(t.id)
    expect(after).toMatchObject({ title: 'معتمَدٌ يبقى', pendingChange: null, reviewerNote: 'العنوانُ الأوّلُ أوضح' })
    expect((await decisionsTold(t.id))[0].body).toContain('العنوانُ الأوّلُ أوضح')

    const d = await create(C.cohortId, 'جديدةٌ تُردّ')
    await assessments.decideTask(adminId, d.id, false, 'مكرّرةٌ مع مهمّة المحور الأوّل')
    expect(await row(d.id)).toMatchObject({ status: 'draft', reviewerNote: 'مكرّرةٌ مع مهمّة المحور الأوّل' })
  })

  it('⚠️ والمردودةُ إذا عُدّلت عادت إلى الإدارة — بلا سببها القديم، وتُخبَر إن فرغت قائمتُها', async () => {
    const X = await makeCohort('عودة', 'approved')
    const d = await create(X.cohortId, 'تُردّ ثمّ تعود')
    await assessments.decideTask(adminId, d.id, false, 'اربطها بمحورها')
    const before = await pendingNotices()
    const e = await assessments.updateAssessment(trainerUserId, d.id, { title: 'عادت بعد التعديل' })
    expect(e.review).toBe('new')
    expect((await row(d.id))?.reviewerNote).toBeNull()
    expect(await pendingNotices(), 'عادت ولم تُخبَر الإدارة').toBe(before + 1)
  })

  it('⚠️ ولا قرارَ على ما لا ينتظر', async () => {
    const t = await assessments.createAssessment(adminId, { cohortId: C.cohortId, title: 'منشورةٌ بلا طلب', type: 'assignment' })
    await expect(assessments.decideTask(adminId, t.id, true)).rejects.toMatchObject({ code: 'nothing_pending' })
    /* ومسودّةُ ما قبل أوّل اعتمادٍ يعتمدها اعتمادُ الخطّة، لا بابُ المهمّة */
    const P = await makeCohort('مسودّةٌ-قبل', 'draft')
    const d = await prisma.cohortAssessment.create({ data: { cohortId: P.cohortId, title: 'مسودّةٌ منسوخة', status: 'draft' } })
    await expect(assessments.decideTask(adminId, d.id, true)).rejects.toMatchObject({ code: 'nothing_pending' })
  })
})

describe('④ واعتمادُ الخطّة يعتمد ما ينتظر من مهامّها', () => {
  it('⚠️ مراجعةٌ تُعتمَد: الجديدةُ تُنشر، والتعديلُ يُكتب، والحذفُ يقع — والمردودةُ تبقى', async () => {
    const C = await makeCohort('مراجعة', 'approved')
    const fresh = await create(C.cohortId, 'جديدةٌ مع المراجعة')
    const edited = await assessments.createAssessment(adminId, { cohortId: C.cohortId, title: 'قديمةٌ تُعدَّل', type: 'assignment' })
    await assessments.updateAssessment(trainerUserId, edited.id, { title: 'عُدّلت مع المراجعة' })
    const removed = await assessments.createAssessment(adminId, { cohortId: C.cohortId, title: 'تُحذف مع المراجعة', type: 'assignment' })
    await assessments.deleteAssessment(trainerUserId, removed.id)
    const declined = await create(C.cohortId, 'مردودةٌ لم تُعدَّل')
    await assessments.decideTask(adminId, declined.id, false, 'ليست من الدورة')

    const revision = await prisma.cohortDeliveryPlan.create({
      data: { cohortId: C.cohortId, trainerId: profileId, status: 'submitted', content: { kind: 'trainer', modules: [], resources: [] } },
    })
    const r = await plans.decide(adminId, revision.id, true)
    expect(r.tasks).toEqual({ applied: 3, failed: [] })

    expect((await row(fresh.id))?.status).toBe('published')
    expect(await row(edited.id)).toMatchObject({ title: 'عُدّلت مع المراجعة', pendingChange: null })
    expect(await row(removed.id)).toBeNull()
    expect(await row(declined.id), 'اعتمادُ الخطّة نشر ما ردّه المعتمِدُ نفسُه').toMatchObject({ status: 'draft' })
    const viaPlan = await prisma.auditEvent.count({
      where: { action: 'assessment.change.approve', meta: { path: ['planId'], equals: revision.id } },
    })
    expect(viaPlan).toBe(3)
  })

  it('⚠️ وأوّلُ اعتمادٍ ينشر مسودّاتِ ما قبله — قرأها المعتمِدُ في المنهج', async () => {
    const C = await makeCohort('أوّل', 'submitted')
    const copied = await prisma.cohortAssessment.create({ data: { cohortId: C.cohortId, title: 'منسوخةٌ من شعبةٍ سابقة', status: 'draft' } })
    await plans.decide(adminId, C.planId, true)
    expect((await row(copied.id))?.status).toBe('published')
  })

  it('⚠️ وما يمنعه مانعٌ يبقى منتظِرا ويُسمّى — لا يُسقط الاعتماد', async () => {
    const C = await makeCohort('مانع', 'approved')
    const t = await assessments.createAssessment(adminId, { cohortId: C.cohortId, title: 'سُلّم فيها قبل الاعتماد', type: 'assignment' })
    await assessments.deleteAssessment(trainerUserId, t.id)
    await prisma.assignmentSubmission.create({ data: { assessmentId: t.id, enrollmentId: C.enrollmentId, textAnswer: 'عملي' } })
    const revision = await prisma.cohortDeliveryPlan.create({
      data: { cohortId: C.cohortId, trainerId: profileId, status: 'submitted', content: { kind: 'trainer', modules: [], resources: [] } },
    })
    const r = await plans.decide(adminId, revision.id, true)
    expect(r.status).toBe('approved')
    expect(r.tasks?.failed.map((f) => f.id)).toEqual([t.id])
    expect((await row(t.id))?.pendingChange).toMatchObject({ kind: 'remove' })
  })
})

describe('⑤ والمسالكُ بصلاحيّاتها', () => {
  let app: FastifyInstance
  let adminCookie = ''
  let learnerCookie = ''
  let trainerCookie = ''
  let routeProfileId = ''

  beforeAll(async () => {
    app = await buildApp(prisma)
    const auth = new AuthService(prisma)
    const sa = await auth.register(`ta-super-${STAMP}@test.local`, 'Super#12345', 'مديرُ النظام')
    await auth.setRoles(sa.userId, ['super_admin'])
    adminCookie = `${SESSION_COOKIE}=${(await auth.login(`ta-super-${STAMP}@test.local`, 'Super#12345')).token}`
    await auth.register(`ta-plain-${STAMP}@test.local`, 'Plain#12345', 'متعلّمٌ عاديّ')
    learnerCookie = `${SESSION_COOKIE}=${(await auth.login(`ta-plain-${STAMP}@test.local`, 'Plain#12345')).token}`
    /* ومدرّبٌ يدخل بكلمة سرّه — ليُنادي مسلكَيه كما تناديهما شاشتُه */
    const tr = await auth.register(`ta-route-trainer-${STAMP}@test.local`, 'Trainer#12345', 'مدرّبُ المسلك')
    await auth.setRoles(tr.userId, ['trainer'])
    const application = await prisma.trainerApplication.create({
      data: { reference: `WJ-TR-TAR-${STAMP}`, fullName: 'مدرّبُ المسلك', email: `ta-route-trainer-${STAMP}@test.local`, status: 'active' },
    })
    routeProfileId = (await prisma.trainerProfile.create({ data: { userId: tr.userId, applicationId: application.id } })).id
    trainerCookie = `${SESSION_COOKIE}=${(await auth.login(`ta-route-trainer-${STAMP}@test.local`, 'Trainer#12345')).token}`
  }, 120_000)

  it('⚠️ مسلكُ المدرّب ينشئ بعد الاعتماد مسودّةً — والسحبُ بمسلكه', async () => {
    const C = await makeCohort('مسلك-المدرّب', 'approved')
    await prisma.cohortTrainer.create({ data: { cohortId: C.cohortId, profileId: routeProfileId, role: 'assistant' } })
    const made = await app.inject({
      method: 'POST', url: `/api/trainer/cohorts/${C.cohortId}/assessments`, headers: { cookie: trainerCookie },
      payload: { title: 'من شاشة المدرّب', type: 'assignment' },
    })
    expect(made.statusCode).toBe(201)
    expect(made.json()).toMatchObject({ status: 'draft', review: 'new' })

    const live = await assessments.createAssessment(adminId, { cohortId: C.cohortId, title: 'منشورةٌ يُطلب تعديلُها', type: 'assignment' })
    const asked = await app.inject({
      method: 'PATCH', url: `/api/trainer/assessments/${live.id}`, headers: { cookie: trainerCookie }, payload: { title: 'مطلوبٌ من الشاشة' },
    })
    expect(asked.json()).toMatchObject({ review: 'edit', title: 'منشورةٌ يُطلب تعديلُها' })
    const pulled = await app.inject({
      method: 'POST', url: `/api/trainer/assessments/${live.id}/withdraw-change`, headers: { cookie: trainerCookie }, payload: {},
    })
    expect(pulled.statusCode).toBe(200)
    expect((await row(live.id))?.pendingChange).toBeNull()
    const stranger = await app.inject({
      method: 'POST', url: `/api/trainer/assessments/${live.id}/withdraw-change`, headers: { cookie: learnerCookie }, payload: {},
    })
    expect(stranger.statusCode).toBe(403)
  })

  it('⚠️ قرارُ المهمّة لمن يعتمد الخطط — لا لغيره', async () => {
    const C = await makeCohort('مسلك', 'approved')
    const a = await create(C.cohortId, 'تُقرَّر من المسلك')
    const denied = await app.inject({
      method: 'POST', url: `/api/admin/cohort-assessments/${a.id}/decide`, headers: { cookie: learnerCookie }, payload: { approve: true },
    })
    expect(denied.statusCode).toBe(403)
    expect((await row(a.id))?.status).toBe('draft')
    const ok = await app.inject({
      method: 'POST', url: `/api/admin/cohort-assessments/${a.id}/decide`, headers: { cookie: adminCookie }, payload: { approve: true },
    })
    expect(ok.statusCode).toBe(200)
    expect((await row(a.id))?.status).toBe('published')
  })
})

describe('⑥ والحمولتان تحملان ما تحكم به الشاشتان', () => {
  it('⚠️ ورشةُ المدرّب وبطاقةُ المعتمِد: أاعتُمدت خطّتُه قطّ، وطلبُه وسببُ ردّه', async () => {
    const C = await makeCohort('حمولة', 'approved')
    const t = await assessments.createAssessment(adminId, { cohortId: C.cohortId, title: 'في الحمولة', type: 'assignment' })
    await assessments.updateAssessment(trainerUserId, t.id, { title: 'مطلوبٌ في الحمولة' })
    const d = await create(C.cohortId, 'مردودةٌ في الحمولة')
    await assessments.decideTask(adminId, d.id, false, 'سببُ الردّ')

    const ws = await plans.workspace(trainerUserId, C.cohortId)
    expect(ws.approvedOnce).toBe(true)
    expect(ws.assessments.find((a) => a.id === t.id)?.pendingChange).toMatchObject({ kind: 'edit', fields: { title: 'مطلوبٌ في الحمولة' } })
    expect(ws.assessments.find((a) => a.id === d.id)?.reviewerNote).toBe('سببُ الردّ')
    const card = await plans.latestForCohort(C.cohortId)
    expect(card?.approvedOnce).toBe(true)
    expect(card?.assessments.find((a) => a.id === t.id)?.pendingChange).toMatchObject({ kind: 'edit' })
    expect(card?.assessments.find((a) => a.id === d.id)?.reviewerNote).toBe('سببُ الردّ')

    const D = await makeCohort('حمولة-قبل', 'draft')
    expect((await plans.workspace(trainerUserId, D.cohortId)).approvedOnce).toBe(false)
    expect((await plans.latestForCohort(D.cohortId))?.approvedOnce).toBe(false)
  })
})
