/* ═══ الحضورُ وحدَه لا يُتِمُّ محورا له عمل — والإتمامُ يكفّ عن كونه آليّا (م٤) ═══

   عطبان يصنعان معا شهادةً بلا ما يقف خلفها:

     ① الحضورُ كان دليلا مساويا للتسليم المقبول والتقييم المُجتاز. فمن جلس
        في اللقاء تمَّ محورُه — ولو لم يُنتج شيئا ولم ينظر فيه أحد.
     ② وشعبةٌ لا قاعدةَ إكمالٍ عليها كانت تُصدِر شهادةً لكلّ ملتحق: الحكمُ
        «تمّ إن لم يسقط شرط»، ولا شرطَ يسقط.

   والقسمةُ الثانيةُ مفحوصةٌ نقيّةً في `src/tests/learning/completion-rules`.
   وهذا يحرس **الأثر الحقيقيّ**: أنّ `recomputeProgress` تفرّق بين الدليلَين،
   وأنّ `evaluateCompletion` لا تُصدِر بلا شيء. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { ProgressService } from '../../services/progress.service'

let prisma: PrismaClient
let progress: ProgressService
let cohortId = ''
/** محورٌ عليه مهمّةٌ منشورة — الحضورُ فيه لا يكفي */
let withWorkId = ''
/** محورٌ لا عملَ عليه أصلا — الحضورُ فيه دليلُه الوحيد */
let bareId = ''
let assessmentId = ''
const STAMP = Date.now()
const COURSE = `C-EVID-${STAMP}`

/** تسجيلٌ جديدٌ في كلّ حالةٍ — فلا تتسرّب حالةُ واحدةٍ إلى أختها */
async function freshEnrollment(email: string) {
  const auth = new AuthService(prisma)
  const u = await auth.register(email, 'Learner#12345', 'متعلّمُ الدليل')
  const e = await prisma.enrollment.create({ data: { userId: u.userId, cohortId, status: 'enrolled' } })
  return e.id
}

async function attend(enrollmentId: string, sessionId: string) {
  await prisma.attendance.create({ data: { enrollmentId, sessionId, status: 'present' } })
}

const completedModules = (enrollmentId: string) =>
  prisma.moduleProgress.findMany({ where: { enrollmentId, status: 'completed' } })

let sessionWithWork = ''
let sessionBare = ''

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  progress = new ProgressService(prisma)

  await prisma.course.create({ data: { id: COURSE, status: 'published', currentVersion: 1 } })
  await prisma.courseVersion.create({
    data: { courseId: COURSE, version: 1, titleAr: 'دورةُ الدليل', totalHours: 10, status: 'approved' },
  })
  /* والمعرّفُ ثابتٌ يُكتب — `CourseModule.id` ليس مولَّدا */
  const withWork = await prisma.courseModule.create({
    data: { id: `${COURSE}-M1`, courseId: COURSE, status: 'published' },
  })
  withWorkId = withWork.id
  const bare = await prisma.courseModule.create({
    data: { id: `${COURSE}-M2`, courseId: COURSE, status: 'published' },
  })
  bareId = bare.id

  const cohort = await prisma.cohort.create({
    data: {
      courseId: COURSE, title: `شعبةُ الدليل ${STAMP}`, status: 'active',
      registrationOpen: false, financialReady: true, price: 100, currency: 'USD', capacity: 20,
      startsAt: new Date(Date.now() - 30 * 86_400_000),
    },
  })
  cohortId = cohort.id

  /* لقاءان منتهيان، كلٌّ لمحوره — والمعتمَدُ وحدَه يُعَدّ في الحضور */
  const s1 = await prisma.cohortSession.create({
    data: {
      cohortId, title: 'لقاءُ المحور الأوّل', moduleId: withWorkId, status: 'done',
      startsAt: new Date(Date.now() - 9 * 86_400_000), endsAt: new Date(Date.now() - 9 * 86_400_000 + 7_200_000),
    },
  })
  sessionWithWork = s1.id
  const s2 = await prisma.cohortSession.create({
    data: {
      cohortId, title: 'لقاءُ المحور الثاني', moduleId: bareId, status: 'done',
      startsAt: new Date(Date.now() - 8 * 86_400_000), endsAt: new Date(Date.now() - 8 * 86_400_000 + 7_200_000),
    },
  })
  sessionBare = s2.id

  /* مهمّةٌ منشورةٌ على المحور الأوّل وحدَه */
  const a = await prisma.cohortAssessment.create({
    data: { cohortId, moduleId: withWorkId, type: 'assignment', title: 'مهمّةُ المحور', maxScore: 10, status: 'published' },
  })
  assessmentId = a.id
}, 240_000)

describe('① الحضورُ وحدَه لا يُتِمُّ محورا له عمل', () => {
  it('⚠️ حضرَ المحورَ ولم يُسلّم — فلا يتمّ', async () => {
    const enrollmentId = await freshEnrollment(`evid-a-${STAMP}@test.local`)
    await attend(enrollmentId, sessionWithWork)
    await progress.recomputeProgress(enrollmentId)
    const done = await completedModules(enrollmentId)
    expect(done.map((m) => m.moduleId), 'الحضورُ أتمّ محورا له عملٌ لم يُنتَج').toEqual([])
  })

  it('⚠️ ومحورٌ لا عملَ عليه يتمّ بالحضور — فلا تُشترَط شهادةٌ لا وجودَ لها', async () => {
    /* اشتراطُ دليلٍ منتَجٍ حيث لا عملَ أصلا يجعل «مكتمل» حالةً لا تُبلَغ. */
    const enrollmentId = await freshEnrollment(`evid-b-${STAMP}@test.local`)
    await attend(enrollmentId, sessionBare)
    await progress.recomputeProgress(enrollmentId)
    const done = await completedModules(enrollmentId)
    expect(done.map((m) => m.moduleId)).toEqual([bareId])
    expect(done[0].evidence, 'الدليلُ لا يقول بمَ تمّ').toEqual({ via: 'attendance' })
  })

  it('⚠️ والتسليمُ المقبولُ يُتِمُّه — ودليلُه يُكتب بما هو', async () => {
    const enrollmentId = await freshEnrollment(`evid-c-${STAMP}@test.local`)
    await attend(enrollmentId, sessionWithWork)
    await prisma.assignmentSubmission.create({
      data: { assessmentId, enrollmentId, textAnswer: 'عملي', status: 'accepted' },
    })
    await progress.recomputeProgress(enrollmentId)
    const done = await completedModules(enrollmentId)
    expect(done.map((m) => m.moduleId)).toEqual([withWorkId])
    expect(done[0].evidence, 'الدليلُ يُكتب «أحدُهما» كما كان').toEqual({ via: 'submission' })
  })

  it('ومهمّةٌ مسوّدةٌ لا تحجب — لم تصل المتعلّمَ أصلا', async () => {
    const draftModule = await prisma.courseModule.create({
      data: { id: `${COURSE}-M3`, courseId: COURSE, status: 'published' },
    })
    const s = await prisma.cohortSession.create({
      data: {
        cohortId, title: 'لقاءُ المسوّدة', moduleId: draftModule.id, status: 'done',
        startsAt: new Date(Date.now() - 7 * 86_400_000), endsAt: new Date(Date.now() - 7 * 86_400_000 + 7_200_000),
      },
    })
    await prisma.cohortAssessment.create({
      data: { cohortId, moduleId: draftModule.id, type: 'assignment', title: 'مسوّدة', maxScore: 10, status: 'draft' },
    })
    const enrollmentId = await freshEnrollment(`evid-d-${STAMP}@test.local`)
    await attend(enrollmentId, s.id)
    await progress.recomputeProgress(enrollmentId)
    const done = await completedModules(enrollmentId)
    expect(done.map((m) => m.moduleId)).toEqual([draftModule.id])
  })
})

describe('② شعبةٌ بلا قواعدِ إكمالٍ لا تُصدِر لكلّ ملتحق', () => {
  it('⚠️ من لم يُسلّم شيئا لا يكتمل — وكان يكتمل', async () => {
    const enrollmentId = await freshEnrollment(`evid-e-${STAMP}@test.local`)
    await attend(enrollmentId, sessionWithWork)
    const out = await progress.evaluateCompletion(enrollmentId)
    expect(out.rulesChecked, 'لا قاعدةَ تُفحَص — فالصمتُ إذنٌ').toBe(1)
    expect(out.complete, 'اكتمل بلا مهمّةٍ مقبولةٍ واحدة').toBe(false)
    expect(out.failures.join(' ')).toContain('assignment_accepted')
  })

  it('ومن سلّم وقُبل تسليمُه يكتمل — فالحدُّ مبلوغٌ لا حاجز', async () => {
    const enrollmentId = await freshEnrollment(`evid-f-${STAMP}@test.local`)
    await prisma.assignmentSubmission.create({
      data: { assessmentId, enrollmentId, textAnswer: 'عملي', status: 'accepted' },
    })
    await progress.recomputeProgress(enrollmentId)
    const out = await progress.evaluateCompletion(enrollmentId)
    expect(out.complete, 'لم يكتمل ومهمّتُه مقبولة').toBe(true)
    expect(out.failures).toEqual([])
  })
})
