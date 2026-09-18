/* ═══ طابورُ التصحيح يحمل ما يحتاجه الحكم — لا ما يسهل جلبُه (م٤) ═══

   ثلاثةُ أعطابٍ في الشاشة التي يتكرّر عملُها مئةَ مرّةٍ في الشعبة:

     ١ · اسمُ المتعلّم يصل معرّفا ويُهمَل — فيصحّح المدرّبُ عملا لا يعرف
         صاحبَه، وهو يحكم على إنسانٍ بعينه لا على صفٍّ في قاعدة.
     ٢ · المسطرةُ لا تُجلَب أصلا، وأعمدتُها قائمةٌ ومسلكُ الدرجة يقبلها.
     ٣ · مفتاحُ التخزين يخرج خاما إلى المتصفّح، ولا مسارَ يفتح الملفَّ أصلا.

   ── ولمَ الحارسُ على الخادم لا في البنية وحدَها ──

   الثالثُ إذنُ قراءةٍ على ملفِّ إنسان. وفحصٌ بنيويٌّ يثبت أنّ السطرَ مكتوبٌ
   ولا يثبت أنّه يمنع. فمن لا يملك يُجرَّب هنا فعلا. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { AssessmentService } from '../../services/assessment.service'

let prisma: PrismaClient
let assess: AssessmentService
let learnerId = ''
let strangerId = ''
let trainerUserId = ''
let otherTrainerUserId = ''
let assessmentId = ''
let enrollmentId = ''
let rubricId = ''
const KEY = 'sub/grading-queue-test-object.pdf'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  assess = new AssessmentService(prisma)

  const mkTrainer = async (email: string, name: string) => {
    const u = await auth.register(email, 'Trainer#12345', name)
    await auth.setRoles(u.userId, ['trainer'])
    const application = await prisma.trainerApplication.create({
      data: {
        reference: `TR-GQ-${email}`, fullName: name, email,
        phone: '0790000011', status: 'active', motivation: 'اختبار', privacyConsentAt: new Date(),
      },
    })
    const profile = await prisma.trainerProfile.create({
      data: { applicationId: application.id, userId: u.userId, isVerified: true },
    })
    return { userId: u.userId, profileId: profile.id }
  }

  const mine = await mkTrainer('gq-trainer@test.local', 'مدرّبُ الشعبة')
  trainerUserId = mine.userId
  const other = await mkTrainer('gq-other@test.local', 'مدرّبٌ آخر')
  otherTrainerUserId = other.userId

  const cohort = await prisma.cohort.create({
    data: {
      courseId: 'C-BIZ-101', title: 'شعبةُ الطابور', status: 'active', registrationOpen: false,
      financialReady: true, price: 100, currency: 'JOD', capacity: 10,
    },
  })
  await prisma.cohortTrainer.create({ data: { cohortId: cohort.id, profileId: mine.profileId, role: 'lead' } })

  const l = await auth.register('gq-learner@test.local', 'Learner#12345', 'ريم الدوسري')
  learnerId = l.userId
  const s = await auth.register('gq-stranger@test.local', 'Learner#12345', 'غريب')
  strangerId = s.userId

  const e = await prisma.enrollment.create({ data: { userId: learnerId, cohortId: cohort.id, status: 'enrolled' } })
  enrollmentId = e.id

  /* مسطرةٌ بمعيارَين — الأعمدةُ قائمةٌ في القاعدة منذ زمنٍ بلا قارئ */
  const rubric = await prisma.gradingRubric.create({
    data: {
      title: 'مسطرةُ التحرير',
      criteria: {
        create: [
          { sequence: 1, title: 'وضوحُ الفكرة', maxScore: 6 },
          { sequence: 2, title: 'سلامةُ اللغة', maxScore: 4 },
        ],
      },
    },
  })
  rubricId = rubric.id

  const a = await prisma.cohortAssessment.create({
    data: { cohortId: cohort.id, type: 'assignment', title: 'تكليفُ المحطّة', maxScore: 10, rubricId },
  })
  assessmentId = a.id

  await prisma.assignmentSubmission.create({
    data: { assessmentId, enrollmentId, textAnswer: 'إجابتي', status: 'submitted', storageKey: KEY },
  })
}, 240_000)

describe('① الاسمُ يصل الطابورَ — لا معرّفٌ يُهمَل', () => {
  it('⚠️ اسمُ المتعلّم في الصفّ', async () => {
    const q = await assess.trainerQueue(trainerUserId)
    expect(q).toHaveLength(1)
    expect(q[0].enrollment.user?.displayName, 'الاسمُ لا يصل الشاشة').toBe('ريم الدوسري')
  })

  it('والبريدُ لا يصل — ملكُ المتعلّم، والمنصّةُ هي القناة', async () => {
    const q = await assess.trainerQueue(trainerUserId)
    expect(Object.keys(q[0].enrollment.user ?? {})).toEqual(['displayName'])
  })
})

describe('② المسطرةُ تُجلَب — وكانت ترقد بلا قارئ', () => {
  it('⚠️ معاييرُها في الصفّ مرتَّبةً بتسلسلها', async () => {
    const q = await assess.trainerQueue(trainerUserId)
    expect(q[0].assessment.rubric, 'المسطرةُ لا تُجلَب').not.toBeNull()
    expect(q[0].assessment.rubric!.criteria.map((c) => c.title)).toEqual(['وضوحُ الفكرة', 'سلامةُ اللغة'])
    expect(q[0].assessment.rubric!.criteria.map((c) => c.maxScore)).toEqual([6, 4])
  })

  it('ودرجاتُ المعايير تُحفظ مع الدرجة', async () => {
    const q = await assess.trainerQueue(trainerUserId)
    const sub = q[0]
    await assess.reviewSubmission(trainerUserId, sub.id, 'start_review')
    const criteria = sub.assessment.rubric!.criteria
    await assess.grade(trainerUserId, {
      submissionId: sub.id, score: 8, maxScore: 10,
      rubricScores: [
        { criterionId: criteria[0].id, score: 5 },
        { criterionId: criteria[1].id, score: 3 },
      ],
    })
    const g = await prisma.grade.findFirst({ where: { submissionId: sub.id } })
    expect(g, 'لا درجة').not.toBeNull()
    expect(g!.rubricScores, 'درجاتُ المعايير لم تُحفظ').toEqual([
      { criterionId: criteria[0].id, score: 5 },
      { criterionId: criteria[1].id, score: 3 },
    ])
  })
})

describe('③ مفتاحُ التخزين لا يخرج — وبابُه محروس', () => {
  it('⚠️ الصفُّ يحمل مسارا لا مفتاحا', async () => {
    const q = await assess.trainerQueue(trainerUserId)
    expect(q[0], 'المفتاحُ ما زال يخرج إلى المتصفّح').not.toHaveProperty('storageKey')
    expect(q[0].fileUrl, 'لا بابَ لملفّ التسليم').toBe(`/api/v1/submission-files/${encodeURIComponent(KEY)}`)
  })

  it('⚠️ ومن لا يملكه يُردّ — مدرّبُ شعبةٍ أخرى وغريبٌ ومتعلّمٌ ليس صاحبَه', async () => {
    for (const [who, userId] of [
      ['مدرّبٌ لا يدرّب هذه الشعبة', otherTrainerUserId],
      ['غريبٌ لا شأنَ له', strangerId],
    ] as const) {
      await expect(
        assess.assertCanReadSubmissionFile(KEY, { userId }),
        who,
      ).rejects.toMatchObject({ status: 404 })
    }
  })

  it('ويملكه صاحبُه ومدرّبُ شعبته', async () => {
    await expect(assess.assertCanReadSubmissionFile(KEY, { userId: learnerId })).resolves.toBeTruthy()
    await expect(assess.assertCanReadSubmissionFile(KEY, { userId: trainerUserId })).resolves.toBeTruthy()
  })

  it('ومفتاحٌ لا تسليمَ له يُردّ بأربعمئةٍ وأربعة — لا بثلاثمئةٍ وثلاثة', async () => {
    /* وجودُ ملفٍّ بمفتاحٍ بعينه خبرٌ في نفسه */
    await expect(assess.assertCanReadSubmissionFile('sub/لا-وجود-له.pdf', { userId: trainerUserId }))
      .rejects.toMatchObject({ status: 404 })
  })
})
