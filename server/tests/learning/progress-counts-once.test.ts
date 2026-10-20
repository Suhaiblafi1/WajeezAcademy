/* ═══ كلُّ مهمّةٍ تُعدّ مرّةً في بابها — والمسودّةُ لا تُعدّ (٢٠ أكتوبر ٢٠٢٦) — `progress.service.ts` ═══

   كان المشروعُ يُعدّ في البابين: في «التقييمات» ولا يُجتاز فيها إلّا بمحاولة اختبار، وفي «التكليفات». فمن أتمّ
   كلَّ شيءٍ وفي شعبته مشروعٌ وقف عند ٨٥٪ أبدا، ولا يظهر له ختامُ الدورة (`percent >= 100`). وكانت المسودّةُ
   تُعدّ — طلبُ مهمّةٍ ينتظر الاعتماد أو رُدّ — فتنقص نسبةُ الجميع بمهمّةٍ لم يرها أحد. وتسليمان مقبولان للمهمّة
   الواحدة كانا يُعدّان اثنين.

   ورُئي ساقطا: أُعيد المشروعُ إلى البابين فسقط ①، وأُعيدت المسودّةُ إلى العدّ فسقط ②، وعُدّ كلُّ تسليمٍ
   مقبولٍ فسقط ③. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { ProgressService } from '../../services/progress.service'

let prisma: PrismaClient
let progress: ProgressService
let cohortId = ''
let sessionId = ''
let assignmentId = ''
let projectId = ''
const STAMP = Date.now()
const COURSE = `C-ONCE-${STAMP}`
const MODULE = `${COURSE}-M1`

async function learnerWithEverythingDone(email: string) {
  const u = await new AuthService(prisma).register(email, 'Learner#12345', 'متعلّم أتمّ كلّ شيء')
  const e = await prisma.enrollment.create({ data: { userId: u.userId, cohortId, status: 'enrolled' } })
  await prisma.attendance.create({ data: { enrollmentId: e.id, sessionId, status: 'present' } })
  for (const assessmentId of [assignmentId, projectId]) {
    await prisma.assignmentSubmission.create({ data: { assessmentId, enrollmentId: e.id, textAnswer: 'عملي', status: 'accepted' } })
  }
  return e.id
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  progress = new ProgressService(prisma)

  await prisma.course.create({ data: { id: COURSE, status: 'published', currentVersion: 1 } })
  await prisma.courseVersion.create({ data: { courseId: COURSE, version: 1, titleAr: 'دورة العدّ', totalHours: 10, status: 'approved' } })
  await prisma.courseModule.create({ data: { id: MODULE, courseId: COURSE, status: 'published' } })
  const cohort = await prisma.cohort.create({
    data: {
      courseId: COURSE, title: `شعبة العدّ ${STAMP}`, status: 'active', registrationOpen: false,
      financialReady: true, price: 100, currency: 'USD', capacity: 20, startsAt: new Date(Date.now() - 30 * 86_400_000),
    },
  })
  cohortId = cohort.id
  sessionId = (await prisma.cohortSession.create({
    data: {
      cohortId, title: 'اللقاء', moduleId: MODULE, status: 'done',
      startsAt: new Date(Date.now() - 9 * 86_400_000), endsAt: new Date(Date.now() - 9 * 86_400_000 + 7_200_000),
    },
  })).id
  assignmentId = (await prisma.cohortAssessment.create({
    data: { cohortId, moduleId: MODULE, type: 'assignment', title: 'واجب المحور', maxScore: 10, status: 'published' },
  })).id
  projectId = (await prisma.cohortAssessment.create({
    data: { cohortId, type: 'project', title: 'مشروع التخرّج', maxScore: 100, status: 'published' },
  })).id
}, 240_000)

describe('كلّ مهمّة تعدّ مرّة في بابها', () => {
  it('⚠️ ① من أتمّ كلّ شيء وفي شعبته مشروع يبلغ ١٠٠٪ — لا ٨٥٪', async () => {
    const enrollmentId = await learnerWithEverythingDone(`once-1-${STAMP}@test.local`)
    const row = await progress.recomputeProgress(enrollmentId)
    expect(row.percent, 'المشروع عُدّ في البابين').toBe(100)
  })

  it('⚠️ ② ومهمّة مسودّة — تنتظر الاعتماد أو ردّت — لا تنقص نسبته', async () => {
    await prisma.cohortAssessment.create({
      data: { cohortId, moduleId: MODULE, type: 'assignment', title: 'مهمّة تنتظر الاعتماد', maxScore: 10, status: 'draft' },
    })
    const enrollmentId = await learnerWithEverythingDone(`once-2-${STAMP}@test.local`)
    const row = await progress.recomputeProgress(enrollmentId)
    expect(row.percent, 'عدّت المسودّة على المتعلّم').toBe(100)
  })

  it('⚠️ ③ وتسليمان مقبولان لمهمّة واحدة يعدّان واحدا', async () => {
    const enrollmentId = await learnerWithEverythingDone(`once-3-${STAMP}@test.local`)
    await prisma.assignmentSubmission.create({ data: { assessmentId: assignmentId, enrollmentId, textAnswer: 'مرّة ثانية', status: 'accepted' } })
    await prisma.assignmentSubmission.deleteMany({ where: { enrollmentId, assessmentId: projectId } })
    const row = await progress.recomputeProgress(enrollmentId)
    const evidence = row.evidence as { assignmentsAccepted: number; assignmentsTotal: number }
    expect(evidence.assignmentsAccepted, 'عدّ تسليمين لمهمّة واحدة').toBe(1)
    expect(evidence.assignmentsTotal).toBe(2)
  })
})
