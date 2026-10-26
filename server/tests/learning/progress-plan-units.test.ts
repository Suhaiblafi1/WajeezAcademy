/* ═══ التقدّمُ يُقاس على محاور الخطّة لا الكتالوج (٢٦ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «count only plan units». كان `totalModules` عددَ وحدات
   الكتالوج: شعبةٌ من محورِ كتالوجٍ ومحاورَ كتبها مدرّبُها لا تُعدّ محاورُ مدرّبها
   أصلا، ومحاورُ الكتالوج المتروكةُ تُعدّ ولا تُبلغ — فلا يقرب أحدٌ من المائة.
   وشاشةُ المتعلّم صارت تُخفي المتروك («hide them»)، فلا يُحسب عليه ما لا يراه.

     ① مع خطّةٍ معتمَدة: المقامُ محاورُها، ومحورُ المدرّب يكتمل ويُعدّ
     ② وما اكتمل خارجها لا يُعدّ — لا يرفع نسبةً ولا يفي بشرط
     ③ وخطّةٌ لم تُعتمَد بعد لا تُقرأ — والكتالوجُ هو الدورةُ حينئذ */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { fixtureTrainerId } from '../helpers/approved-trainer'
import { AuthService } from '../../services/auth.service'
import { ProgressService } from '../../services/progress.service'

let prisma: PrismaClient
let progress: ProgressService
const STAMP = Date.now()
const COURSE = `C-PLANU-${STAMP}`
const M1 = `${COURSE}-M1`
const M2 = `${COURSE}-M2`
const M3 = `${COURSE}-M3`
/** محورٌ كتبه المدرّبُ — ليس في الكتالوج */
const T9 = `trainer-${STAMP}-9`

async function cohortWith(status: 'approved' | 'submitted' | null) {
  const cohort = await prisma.cohort.create({
    data: {
      courseId: COURSE, title: `شعبةُ المحاور ${status ?? 'بلا خطّة'} ${STAMP}`, status: 'active',
      registrationOpen: false, financialReady: true, price: 100, currency: 'USD', capacity: 20,
      startsAt: new Date(Date.now() - 30 * 86_400_000),
    },
  })
  if (status) {
    await prisma.cohortDeliveryPlan.create({
      data: {
        cohortId: cohort.id, trainerId: await fixtureTrainerId(prisma), status,
        content: { kind: 'trainer', modules: [{ moduleId: M1, titleAr: 'محور الكتالوج' }, { moduleId: T9, titleAr: 'محور المدرّب' }], resources: [] },
      },
    })
  }
  return cohort.id
}

let n = 0
async function enrolledWithWork(cohortId: string, moduleIds: string[]) {
  n += 1
  const auth = new AuthService(prisma)
  const u = await auth.register(`planu-${STAMP}-${n}@test.local`, 'Learner#12345', 'متعلّمُ المحاور')
  const e = await prisma.enrollment.create({ data: { userId: u.userId, cohortId, status: 'enrolled' } })
  for (const moduleId of moduleIds) {
    const a = await prisma.cohortAssessment.create({
      data: { cohortId, moduleId, type: 'assignment', title: `مهمّة ${moduleId}`, maxScore: 10, status: 'published' },
    })
    await prisma.assignmentSubmission.create({ data: { assessmentId: a.id, enrollmentId: e.id, textAnswer: 'عملي', status: 'accepted' } })
  }
  return e.id
}

const evidenceOf = async (enrollmentId: string) =>
  ((await progress.recomputeProgress(enrollmentId)).evidence ?? {}) as { modulesCompleted: number; totalModules: number }

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  progress = new ProgressService(prisma)
  await prisma.course.create({ data: { id: COURSE, status: 'published', currentVersion: 1 } })
  await prisma.courseVersion.create({ data: { courseId: COURSE, version: 1, titleAr: 'دورةُ المحاور', totalHours: 10, status: 'approved' } })
  for (const id of [M1, M2, M3]) await prisma.courseModule.create({ data: { id, courseId: COURSE, status: 'published' } })
}, 240_000)

describe('① مع خطّة معتمدة: المقام محاورها', () => {
  it('⚠️ محوران في الخطّة = المقام ٢ لا ٣ — ومحور المدرّب يكتمل ويعدّ', async () => {
    const cohortId = await cohortWith('approved')
    const enrollmentId = await enrolledWithWork(cohortId, [M1, T9])
    const ev = await evidenceOf(enrollmentId)
    expect(ev.totalModules, 'المقام ما زال عدد الكتالوج').toBe(2)
    expect(ev.modulesCompleted, 'محور المدرّب لم يعدّ').toBe(2)
    const rows = await prisma.moduleProgress.findMany({ where: { enrollmentId, status: 'completed' } })
    expect(rows.map((r) => r.moduleId).sort()).toEqual([M1, T9].sort())
  })

  it('⚠️ وما اكتمل خارجها لا يعدّ — محور تركه المدرّب لا يرفع نسبة ولا يفي بشرط', async () => {
    const cohortId = await cohortWith('approved')
    const enrollmentId = await enrolledWithWork(cohortId, [M1])
    await prisma.moduleProgress.create({ data: { enrollmentId, moduleId: M2, status: 'completed', completedAt: new Date() } })
    const ev = await evidenceOf(enrollmentId)
    expect(ev.modulesCompleted, 'عدّ محور ليس في الخطّة').toBe(1)
    expect(ev.totalModules).toBe(2)
  })
})

describe('③ وبلا خطّة معتمدة: الكتالوج', () => {
  it('⚠️ خطّة مرسلة لم تعتمد لا تقرأ', async () => {
    const cohortId = await cohortWith('submitted')
    const ev = await evidenceOf(await enrolledWithWork(cohortId, [M1]))
    expect(ev.totalModules).toBe(3)
    expect(ev.modulesCompleted).toBe(1)
  })

  it('وبلا خطّة أصلا: محاور الكتالوج كلّها', async () => {
    const cohortId = await cohortWith(null)
    const ev = await evidenceOf(await enrolledWithWork(cohortId, [M1, M3]))
    expect(ev.totalModules).toBe(3)
    expect(ev.modulesCompleted).toBe(2)
  })
})
