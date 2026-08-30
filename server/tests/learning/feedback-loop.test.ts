/* حلقة الواجب تُغلَق (التوصية ٦).

   كان المتعلّم يرسل واجبه ثم لا يُخبَر بشيء أبدا: لا عند القبول ولا الرفض ولا
   طلب الإعادة ولا عند الدرجة. يفتح الصفحة كل يوم يتفقّد. والتغذية الراجعة هي
   المنتَج نفسه — التعلّم يقع فيها لا في المشاهدة — وتأخّرُها يُفقدها أثرها.

   و«مرفوض» كانت حالةً نهائية صمّاء: لا إشعار ولا طريق للعودة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { AssessmentService } from '../../services/assessment.service'

let prisma: PrismaClient
let auth: AuthService
let assess: AssessmentService
let learnerId = ''
let trainerUserId = ''
let cohortId = ''
let assessmentId = ''
let enrollmentId = ''

async function freshSubmission() {
  return prisma.assignmentSubmission.create({
    data: { assessmentId, enrollmentId, textAnswer: 'إجابتي', status: 'submitted' },
  })
}
const notifsFor = (userId: string) =>
  prisma.notification.findMany({ where: { userId }, orderBy: { queuedAt: 'desc' } })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  assess = new AssessmentService(prisma)

  const t = await auth.register('fb-trainer@test.local', 'Trainer#12345', 'مدرّب')
  trainerUserId = t.userId
  await auth.setRoles(trainerUserId, ['trainer'])
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-FB-${Date.now()}`, fullName: 'مدرّب الحلقة', email: 'fb-trainer@test.local',
      phone: '0790000010', status: 'active', motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  const profile = await prisma.trainerProfile.create({
    data: { applicationId: application.id, userId: trainerUserId, isVerified: true },
  })
  const cohort = await prisma.cohort.create({
    data: {
      courseId: 'C-BIZ-101', title: 'شعبة الحلقة', status: 'active', registrationOpen: false,
      financialReady: true, price: 100, currency: 'JOD', capacity: 10,
    },
  })
  cohortId = cohort.id
  await prisma.cohortTrainer.create({ data: { cohortId, profileId: profile.id, role: 'lead' } })

  const l = await auth.register('fb-learner@test.local', 'Learner#12345', 'متعلّم')
  learnerId = l.userId
  const e = await prisma.enrollment.create({ data: { userId: learnerId, cohortId, status: 'enrolled' } })
  enrollmentId = e.id
  const a = await prisma.cohortAssessment.create({
    data: { cohortId, type: 'assignment', title: 'واجب المحطّة الأولى', maxScore: 10 },
  })
  assessmentId = a.id
}, 240_000)

describe('نتيجة المراجعة تصل المتعلّم', () => {
  it('القبول يصله بإشعار يقول ما يفعل بعده', async () => {
    const s = await freshSubmission()
    await assess.reviewSubmission(trainerUserId, s.id, 'start_review')
    await assess.reviewSubmission(trainerUserId, s.id, 'accept')
    const n = await notifsFor(learnerId)
    expect(n[0].templateKey).toBe('submission.accept')
    expect(n[0].title).toContain('قُبل')
    expect(n[0].body).toContain('شعبة الحلقة')
  })

  it('طلب الإعادة يصله ومعه ما ينقص', async () => {
    const s = await freshSubmission()
    await assess.reviewSubmission(trainerUserId, s.id, 'start_review')
    await assess.reviewSubmission(trainerUserId, s.id, 'request_resubmit', 'ينقص المثال العملي')
    const n = await notifsFor(learnerId)
    expect(n[0].templateKey).toBe('submission.request_resubmit')
    expect(n[0].body).toContain('ينقص المثال العملي')
  })

  it('الرفض يصله ومعه سببه', async () => {
    const s = await freshSubmission()
    await assess.reviewSubmission(trainerUserId, s.id, 'start_review')
    await assess.reviewSubmission(trainerUserId, s.id, 'reject', 'الإجابة خارج موضوع الواجب')
    const n = await notifsFor(learnerId)
    expect(n[0].templateKey).toBe('submission.reject')
    expect(n[0].body).toContain('الإجابة خارج موضوع الواجب')
  })

  it('بدء المراجعة حالةٌ داخلية لا تُزعج المتعلّم', async () => {
    const before = (await notifsFor(learnerId)).length
    const s = await freshSubmission()
    await assess.reviewSubmission(trainerUserId, s.id, 'start_review')
    expect((await notifsFor(learnerId)).length).toBe(before)
  })
})

describe('«مرفوض» لم تعد نهاية', () => {
  it('المدرّب يفتح بابا للإعادة بعد الرفض', async () => {
    const s = await freshSubmission()
    await assess.reviewSubmission(trainerUserId, s.id, 'start_review')
    await assess.reviewSubmission(trainerUserId, s.id, 'reject', 'ناقص')
    await assess.reviewSubmission(trainerUserId, s.id, 'request_resubmit', 'أضف الجزء الثاني وأعد')
    const row = await prisma.assignmentSubmission.findUnique({ where: { id: s.id } })
    expect(row?.status).toBe('resubmit_requested')
  })

  it('والقبول يبقى نهائيّا — لا يُعاد فتحه', async () => {
    const s = await freshSubmission()
    await assess.reviewSubmission(trainerUserId, s.id, 'start_review')
    await assess.reviewSubmission(trainerUserId, s.id, 'accept')
    await expect(assess.reviewSubmission(trainerUserId, s.id, 'request_resubmit', 'أعد'))
      .rejects.toMatchObject({ code: 'bad_state' })
  })

  it('الرفض بلا سبب مرفوض — لا يصل المتعلّم خبرٌ بلا تفسير', async () => {
    const s = await freshSubmission()
    await assess.reviewSubmission(trainerUserId, s.id, 'start_review')
    await expect(assess.reviewSubmission(trainerUserId, s.id, 'reject')).rejects.toMatchObject({ code: 'no_reason' })
  })
})

describe('الدرجة تصل صاحبها', () => {
  it('الدرجة الأولى تصله بالرقم والمكان', async () => {
    const s = await freshSubmission()
    await assess.reviewSubmission(trainerUserId, s.id, 'start_review')
    await assess.grade(trainerUserId, { submissionId: s.id, score: 8, maxScore: 10 })
    const n = await notifsFor(learnerId)
    expect(n[0].templateKey).toBe('grade.create')
    expect(n[0].body).toContain('8 من 10')
    expect(n[0].body).toContain('شعبة الحلقة')
  })

  it('تعديلها يصله أيضا — لا تتغيّر درجته بلا علمه', async () => {
    const s = await freshSubmission()
    await assess.reviewSubmission(trainerUserId, s.id, 'start_review')
    await assess.grade(trainerUserId, { submissionId: s.id, score: 6, maxScore: 10 })
    await assess.grade(trainerUserId, { submissionId: s.id, score: 9, maxScore: 10 })
    const n = await notifsFor(learnerId)
    expect(n[0].templateKey).toBe('grade.update')
    expect(n[0].body).toContain('9 من 10')
  })
})
