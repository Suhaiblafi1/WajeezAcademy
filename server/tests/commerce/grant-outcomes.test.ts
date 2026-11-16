/* «ما ستخرج به» بما يخرج به حقّا (١٦ نوفمبر ٢٠٢٦) — والعلّةُ في `src/application/commerce/grant-landing.ts`.

   قرارُ صاحب المنصّة: «لا داعي لهذا لأنّه غير مفيد للبيع، إلّا إذا لديك اقتراحٌ يوضّح لهم ماذا يخرج حقيقةً بمشاريع ومهام
   وتقييم وشهادة»، فاختار ما يخرج به حقّا. وهنا أنّ صفحةَ المنحة تحمل لكلّ دورةٍ ما في صفوفها وحدَه:

   ① **مشروعُها** من `PracticalProject` لآخر نسخةٍ من الدورة، سطرا قصيرا بلا تشكيل — وبلا مشروعٍ لا شيء.
   ② **ومهامُّها** ما يراه المسجَّلُ نفسُه: المنشورةُ وحدَها — لا مسودّةٌ (ما لم تعتمده الإدارةُ بعد) ولا مغلقة —
      والاختباراتُ وحدَها.
   ③ **وشرطُ شهادتها** قواعدُ الإكمال السارية على الشعبة كما يُصدِر بها الإصدار: الدورةُ أرضيّةٌ تشدّها الشعبة،
      وبلا قاعدةٍ الافتراضيّ. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { GrantLandingService } from '../../services/grant-landing.service'
import { approvedPlanBy } from '../helpers/approved-trainer'
import { MEMBER_GRANT_SLUG } from '../../../src/application/commerce/grant'

let prisma: PrismaClient
let ownerId = ''
let profileId = ''
let pool: string[] = []
let seq = 0
const STAMP = Date.now()
const DAY = 86_400_000

/** دورةٌ منشورةٌ بشعبةٍ تُشترى ومدرّبٍ منشور — فتظهر في صفحة المنحة (كما في `grant-course-choice.test.ts`) */
async function course(): Promise<{ courseId: string; cohortId: string }> {
  const courseId = pool.shift()!
  const c = await prisma.cohort.create({
    data: {
      plans: { create: approvedPlanBy(profileId) }, courseId, title: `شعبة ما يخرج به ${++seq}`,
      status: 'open', registrationOpen: true, financialReady: true,
      price: 100, currency: 'USD', capacity: 50, startsAt: new Date(Date.now() + 30 * DAY),
    } as never,
  })
  await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead', assignedBy: ownerId } })
  return { courseId, cohortId: c.id }
}
const latestVersion = (courseId: string) =>
  prisma.courseVersion.findFirstOrThrow({ where: { courseId }, orderBy: { version: 'desc' }, select: { id: true } })
const shownOf = async (cohortId: string) => {
  const v = await new GrantLandingService(prisma, MEMBER_GRANT_SLUG).view()
  const row = v.openCourses.find((c) => c.cohortId === cohortId)
  expect(row, 'لم تظهر الشعبة في صفحة المنحة').toBeTruthy()
  return row!
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  ownerId = (await auth.register(`gout-owner-${STAMP}@test.local`, 'Owner#123456', 'صاحب المنصة')).userId
  const user = await prisma.user.create({ data: { email: `gout-tr-${STAMP}@wajeez.test`, displayName: 'مدرب المنحة', passwordHash: 'x' } })
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-GOUT-${STAMP}`, fullName: 'مدرب المنحة', email: user.email, status: 'active' },
  })
  profileId = (await prisma.trainerProfile.create({
    data: { userId: user.id, applicationId: application.id, publicVisibility: true, isVerified: true, publishApprovedAt: new Date() },
  })).id
  pool = (await prisma.course.findMany({ where: { status: 'published' }, select: { id: true }, orderBy: { id: 'asc' } })).map((c) => c.id)
}, 240_000)

describe('① مشروعها من آخر نسخة', () => {
  it('⚠️ سطر قصير بلا تشكيل من PracticalProject — وبلا مشروع لا شيء', async () => {
    const withProject = await course()
    const v = await latestVersion(withProject.courseId)
    await prisma.practicalProject.upsert({
      where: { courseVersionId: v.id },
      create: { courseVersionId: v.id, descriptionAr: 'مَلفُّ قرارٍ مهني:  بيان قرار وجرد أدلة. ثم دفاع شفهي' },
      update: { descriptionAr: 'مَلفُّ قرارٍ مهني:  بيان قرار وجرد أدلة. ثم دفاع شفهي' },
    })
    expect((await shownOf(withProject.cohortId)).projectAr).toBe('ملفّ قرار مهني: بيان قرار وجرد أدلة')

    const without = await course()
    await prisma.practicalProject.deleteMany({ where: { courseVersionId: (await latestVersion(without.courseId)).id } })
    expect((await shownOf(without.cohortId)).projectAr, 'اخترع مشروعا لدورة بلا مشروع').toBeNull()
  })
})

describe('② مهامها ما يراه المسجل نفسه', () => {
  it('⚠️ المنشورة وحدها يصححها المدرب، والاختبارات وحدها — لا مسودة لم تعتمد ولا مغلقة', async () => {
    const c = await course()
    const task = (type: string, status: string) =>
      ({ cohortId: c.cohortId, title: `مهمة ${type} ${status} ${++seq}`, type, status, maxScore: 100 })
    await prisma.cohortAssessment.createMany({
      data: [
        task('assignment', 'published'), task('assignment', 'published'), task('project', 'published'), task('quiz', 'published'),
        task('assignment', 'draft'), task('assignment', 'closed'), task('quiz', 'draft'),
      ],
    })
    expect(await shownOf(c.cohortId)).toMatchObject({ tasks: 3, quizzes: 1 })
    const none = await course()
    expect(await shownOf(none.cohortId), 'مهام لشعبة بلا مهام').toMatchObject({ tasks: 0, quizzes: 0 })
  })
})

describe('③ شرط شهادتها كما يصدر بها', () => {
  it('⚠️ قاعدة الدورة أرضية تشدها الشعبة، ونوع تضيفه الشعبة يسري — وبلا قاعدة الافتراضي', async () => {
    const c = await course()
    await prisma.completionRule.createMany({
      data: [
        { courseId: c.courseId, cohortId: null, type: 'attendance_pct', threshold: 70 },
        { courseId: c.courseId, cohortId: c.cohortId, type: 'attendance_pct', threshold: 80 },
        { courseId: c.courseId, cohortId: c.cohortId, type: 'assignment_accepted', threshold: 2 },
      ],
    })
    expect((await shownOf(c.cohortId)).certificate).toEqual({
      rules: [{ type: 'assignment_accepted', threshold: 2 }, { type: 'attendance_pct', threshold: 80 }],
    })
    /* ودورةٌ لا قاعدةَ عليها ولا على شعبتها: الافتراضيُّ مهمّةٌ واحدةٌ مقبولة — وقواعدُ غيرها لا تسري عليها */
    const bare = await course()
    expect((await shownOf(bare.cohortId)).certificate, 'سرت قاعدة دورة على غيرها').toEqual({ rules: [{ type: 'assignment_accepted', threshold: 1 }] })
  })
})
