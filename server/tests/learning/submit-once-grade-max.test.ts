/* تسليمٌ واحدٌ ينتظر، والدرجةُ من مجموع المهمّة (٨ نوفمبر ٢٠٢٦) — والعلّةُ في `AssessmentService`.

   ① **لا تسليمَ ثانيا إلّا بطلب المدرّب** — بابُ «سلّم» كان يقبل أيَّ عدد، ولو بعد القبول.
   ② **والدرجةُ من مجموع المهمّة** — مهمّةٌ من ١٠ كانت تُكتب درجتُها «٥٠ من ٥٠». */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { AssessmentService } from '../../services/assessment.service'

let prisma: PrismaClient
let auth: AuthService
let assess: AssessmentService
let cohortId = ''
let trainerUserId = ''
let seq = 0

const learner = async () => {
  seq += 1
  const { userId } = await auth.register(`sogm-${seq}@test.local`, 'Learner#12345', `متعلم ${seq}`)
  await prisma.enrollment.create({ data: { userId, cohortId, status: 'enrolled' } })
  return userId
}
const task = async (maxScore: number, rubric?: number[]) => {
  const rubricId = rubric
    ? (await prisma.gradingRubric.create({
        data: { title: `مسطرة ${seq}`, criteria: { create: rubric.map((m, i) => ({ sequence: i + 1, title: `معيار ${i + 1}`, maxScore: m })) } },
      })).id
    : undefined
  return (await prisma.cohortAssessment.create({ data: { cohortId, type: 'assignment', title: `مهمة ${seq}`, maxScore, rubricId } })).id
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  assess = new AssessmentService(prisma)
  const t = await auth.register('sogm-trainer@test.local', 'Trainer#12345', 'مدرب الشعبة')
  trainerUserId = t.userId
  await auth.setRoles(trainerUserId, ['trainer'])
  const application = await prisma.trainerApplication.create({
    data: { reference: 'TR-SOGM-1', fullName: 'مدرب الشعبة', email: 'sogm-trainer@test.local', phone: '0790000099', status: 'active', motivation: 'اختبار', privacyConsentAt: new Date() },
  })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: application.id, userId: trainerUserId, isVerified: true } })
  cohortId = (await prisma.cohort.create({
    data: { courseId: 'C-BIZ-101', title: 'شعبة التسليم مرة', status: 'active', registrationOpen: false, financialReady: true, price: 100, currency: 'USD', capacity: 10 },
  })).id
  await prisma.cohortTrainer.create({ data: { cohortId, profileId: profile.id, role: 'lead' } })
}, 240_000)

describe('① لا تسليم ثانيا إلا بطلب المدرب', () => {
  it('⚠️ ينتظر أو قبل: يرد — وطلب الإعادة يفتح واحدا', async () => {
    const me = await learner()
    const id = await task(10)
    const first = await assess.submitAssignment(me, id, { textAnswer: 'الأول' })
    await expect(assess.submitAssignment(me, id, { textAnswer: 'مكرر' }), 'قبل تسليما ثانيا وهو ينتظر').rejects.toMatchObject({ code: 'already_submitted' })

    await assess.reviewSubmission(trainerUserId, first.submission.id, 'start_review')
    await assess.reviewSubmission(trainerUserId, first.submission.id, 'request_resubmit', 'أضف مثالا')
    const again = await assess.resubmit(me, id, { textAnswer: 'بعد الطلب' })
    await assess.reviewSubmission(trainerUserId, again.submission.id, 'start_review')
    await assess.reviewSubmission(trainerUserId, again.submission.id, 'accept')
    await expect(assess.submitAssignment(me, id, { textAnswer: 'بعد القبول' }), 'قبل تسليما بعد القبول').rejects.toMatchObject({ code: 'already_submitted' })
    expect(await prisma.assignmentSubmission.count({ where: { assessmentId: id } })).toBe(2)
  })

  it('⚠️ ضغطتان معا على «سلم»: تسليم واحد', async () => {
    const me = await learner()
    const id = await task(10)
    const out = await Promise.allSettled([
      assess.submitAssignment(me, id, { textAnswer: 'أ' }),
      assess.submitAssignment(me, id, { textAnswer: 'ب' }),
    ])
    expect(out.filter((r) => r.status === 'fulfilled'), 'سلم مرتين').toHaveLength(1)
    expect(await prisma.assignmentSubmission.count({ where: { assessmentId: id } })).toBe(1)
  })
})

describe('② والدرجة من مجموع المهمة', () => {
  const reviewed = async (maxScore: number, rubric?: number[]) => {
    const me = await learner()
    const id = await task(maxScore, rubric)
    const { submission } = await assess.submitAssignment(me, id, { textAnswer: 'عمل' })
    await assess.reviewSubmission(trainerUserId, submission.id, 'start_review')
    return submission.id
  }

  it('⚠️ مهمة من ١٠ لا تكتب درجتها «٥٠ من ٥٠» — وتكتب من ١٠', async () => {
    const id = await reviewed(10)
    await expect(assess.grade(trainerUserId, { submissionId: id, score: 50, maxScore: 50 }), 'كتب الدرجة من مجموع غير مجموعها').rejects.toMatchObject({ code: 'bad_max' })
    const g = await assess.grade(trainerUserId, { submissionId: id, score: 8, maxScore: 10 })
    expect(Number(g.maxScore)).toBe(10)
  })

  it('وبمسطرة: المجموع مجموع معاييرها — كما تحسبه شاشة التصحيح', async () => {
    const id = await reviewed(100, [6, 4])
    await expect(assess.grade(trainerUserId, { submissionId: id, score: 50, maxScore: 100 })).rejects.toMatchObject({ code: 'bad_max' })
    const g = await assess.grade(trainerUserId, { submissionId: id, score: 9, maxScore: 10 })
    expect(Number(g.score)).toBe(9)
  })
})
