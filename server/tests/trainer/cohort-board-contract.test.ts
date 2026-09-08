/* لوحُ الشعبة يعرض ما ألّفه صاحبُه — والدرجةُ بعد المراجعة لا قبلها.

   ── العطبان اللذان فُتح لهما هذا الحارس ──

   ١) **المؤلِّفُ وحدَه لا يرى ما ألّف.** المدرّبُ يُنشئ تكليفا في لوح
      شعبته، فتصل رسالةُ «أُنشئ التكليف» ويصل المسجَّلين، ولا يظهر التكليفُ
      في اللوح — ولا بعد إعادة التحميل. فلا تأكيدَ أنّه أُنشئ، ولا ما يمنع
      تكرارَه مرّتَين، ولا عددَ من سلّم.

      والبياناتُ كانت تصله كاملةً: `trainerCohorts` تُضمّن `assessments`
      و`submissions` منذ البداية. فالنقصُ في الشاشة وحدَها — ولأنّ النقصَ
      هناك، يبقى هذا الحارسُ يحرس **مصدرَ** البيانات: من حذف التضمينَ
      طلبا للسرعة أطفأ القائمةَ بلا خطأ، وقالت الشاشةُ «لا تكليفَ بعد» —
      وهي جملةٌ كاذبة.

   ٢) **«سجّل الدرجة» مفعَّلٌ قبل أوانه.** الخادمُ يشترط مراجعةً قائمة،
      والشاشةُ كانت تعرض الحقلَ والزرَّ على `submitted` كذلك — فيكتب
      المدرّبُ الرقمَ ويضغط ويُردّ ٤٠٩. والشرطُ يُحرس هنا لأنّ تعطيلَ
      الزرّ في الشاشة يعكسه: لو رُخّص في الخادم يوما لَبقي الزرُّ معطَّلا
      بلا سبب. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { EnrollmentService } from '../../services/enrollment.service'
import { AssessmentService } from '../../services/assessment.service'

let prisma: PrismaClient
let enrollments: EnrollmentService
let assessments: AssessmentService
let trainerUserId = ''
let cohortId = ''
let assessmentId = ''
let submissionId = ''

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  enrollments = new EnrollmentService(prisma)
  assessments = new AssessmentService(prisma)
  const auth = new AuthService(prisma)

  const t = await auth.register('board-trainer@test.local', 'Trainer#12345', 'مدرّبُ اللوح')
  trainerUserId = t.userId
  await auth.setRoles(trainerUserId, ['trainer'])
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-BOARD-${Date.now()}`, fullName: 'مدرّبُ اللوح', email: 'board-trainer@test.local',
      status: 'active', motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  const profile = await prisma.trainerProfile.create({
    data: { applicationId: application.id, userId: trainerUserId, isVerified: true },
  })

  const cohort = await prisma.cohort.create({
    data: { courseId: 'C-BIZ-101', title: 'شعبةُ اللوح', status: 'active', capacity: 10 },
  })
  cohortId = cohort.id
  await prisma.cohortTrainer.create({ data: { cohortId, profileId: profile.id, role: 'lead' } })

  const l = await auth.register('board-learner@test.local', 'Learner#12345', 'متعلّمُ اللوح')
  const enrollment = await prisma.enrollment.create({
    data: { userId: l.userId, cohortId, status: 'enrolled' },
  })

  const a = await prisma.cohortAssessment.create({
    data: { cohortId, title: 'واجبُ الوحدة الأولى', type: 'assignment', maxScore: 100, createdBy: trainerUserId },
  })
  assessmentId = a.id
  const s = await prisma.assignmentSubmission.create({
    data: { assessmentId, enrollmentId: enrollment.id, textAnswer: 'إجابتي', status: 'submitted' },
  })
  submissionId = s.id
}, 240_000)

describe('ما يؤلّفه المدرّب يعود إليه', () => {
  it('شعبُه تحمل تكاليفَها — وإلّا قال اللوحُ «لا تكليفَ بعد» وهو كاذب', async () => {
    const rows = await enrollments.trainerCohorts(trainerUserId)
    const mine = rows.find((r) => r.cohort.id === cohortId)
    expect(mine, 'الشعبةُ لم تصل صاحبَها').toBeTruthy()
    const list = (mine!.cohort as { assessments?: { id: string }[] }).assessments ?? []
    expect(
      list.map((x) => x.id),
      'لا تكليفَ في ردّ `trainerCohorts` — فالمؤلِّفُ لا يرى ما ألّف، '
      + 'ويعيد تأليفَه لأنّ لا شيءَ يقول إنّه موجود.',
    ).toContain(assessmentId)
  })

  it('ومع كلِّ تكليفٍ تسليماتُه — فالعددُ «سلّم ٣ من ١٢» يُقرأ منها', async () => {
    const rows = await enrollments.trainerCohorts(trainerUserId)
    const mine = rows.find((r) => r.cohort.id === cohortId)!
    const all = (mine.cohort as { assessments?: { id: string; submissions?: { id: string; status: string }[] }[] }).assessments ?? []
    const a = all.find((x) => x.id === assessmentId)
    expect(a, 'التكليفُ نفسُه لم يصل — راجع الحارسَ الذي قبله').toBeTruthy()
    expect(
      (a!.submissions ?? []).map((s) => s.id),
      'التكليفُ يصل بلا تسليماته — فيقول اللوحُ «سلّم ٠» بينما الطابورُ ممتلئ.',
    ).toContain(submissionId)
    expect(a!.submissions![0].status).toBe('submitted')
  })
})

describe('والدرجةُ بعد المراجعة لا قبلها', () => {
  it('تسليمٌ لم تبدأ مراجعتُه تُردّ درجتُه — وهو ما تعكسه الشاشةُ بتعطيل الزرّ', async () => {
    await expect(
      assessments.grade(trainerUserId, { submissionId, score: 90, maxScore: 100 }),
    ).rejects.toMatchObject({ status: 409 })
  })

  it('وبعد «ابدأ المراجعة» تُقبل', async () => {
    await assessments.reviewSubmission(trainerUserId, submissionId, 'start_review')
    const g = await assessments.grade(trainerUserId, { submissionId, score: 90, maxScore: 100 })
    expect(Number(g.score)).toBe(90)
  })
})
