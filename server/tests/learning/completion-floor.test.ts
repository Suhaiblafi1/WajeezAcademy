/* قاعدةُ الدورة أرضيّةٌ لا تُمحى بقاعدةِ شعبة — بالقاعدة الحقيقيّة (ك-١٤).

   القسمةُ نفسُها مفحوصةٌ نقيّةً في `src/tests/learning/completion-rules`.
   وهذا يحرس **الوصل**: أنّ `evaluateCompletion` تقرأ صفوفَ النوعين وتمرّرها
   إلى القسمة، وأنّ الاستعلامَ صار يقرأ **غيرَ اللازم أيضا** — فالمرفوعُ
   (`required: false`) إشارةُ إسقاطٍ لا صفٌّ مهمَل، وكان الاستعلامُ القديمُ
   يحذفه بـ`required: true` فلا تصل الإشارةُ أصلا.

   والحالةُ المرويّة: دورةٌ تشترط حضورا وتكاليفَ، وشعبةٌ يُضاف عليها شرطٌ
   ثالثٌ لا يخصّهما. قبل هذا العمل كان الشرطُ الثالثُ يُسقط الأوّلَين، فيُصدَّر
   متعلّمٌ لم يحضر ولم يُسلّم. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { ProgressService } from '../../services/progress.service'

let prisma: PrismaClient
let progress: ProgressService
let cohortId = ''
let enrollmentId = ''
const STAMP = Date.now()
const COURSE = `C-FLOOR-${STAMP}`

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  progress = new ProgressService(prisma)
  const auth = new AuthService(prisma)

  await prisma.course.create({ data: { id: COURSE, status: 'published', currentVersion: 1 } })
  await prisma.courseVersion.create({
    data: { courseId: COURSE, version: 1, titleAr: 'دورةُ أرضيّةِ الإكمال', totalHours: 20, status: 'approved' },
  })
  const cohort = await prisma.cohort.create({
    data: {
      courseId: COURSE, title: `شعبةُ أرضيّةِ الإكمال ${STAMP}`, status: 'active',
      registrationOpen: false, financialReady: true, price: 100, currency: 'USD', capacity: 20,
      startsAt: new Date(Date.now() - 30 * 86_400_000),
    },
  })
  cohortId = cohort.id

  /* شرطا الدورة — الحضورُ والتكاليف */
  await prisma.completionRule.create({
    data: { courseId: COURSE, cohortId: null, type: 'attendance_pct', threshold: 70, required: true },
  })
  await prisma.completionRule.create({
    data: { courseId: COURSE, cohortId: null, type: 'assignment_accepted', threshold: 2, required: true },
  })

  const u = await auth.register(`floor-${STAMP}@test.local`, 'Learner#12345', 'متعلّمُ الأرضيّة')
  const e = await prisma.enrollment.create({ data: { userId: u.userId, cohortId, status: 'enrolled' } })
  enrollmentId = e.id

  /* أنهى المحاورَ ولم يحضر ولم يُسلّم — الحالةُ التي يفترق عندها الحكمان */
  await prisma.courseProgress.create({
    data: {
      enrollmentId, percent: 100,
      evidence: { modulesCompleted: 9, attendancePct: 10, assignmentsAccepted: 0 },
    },
  })
})

describe('شرطٌ يُضاف على الشعبة لا يُسقط شروطَ الدورة', () => {
  it('بلا قواعدِ شعبةٍ: شرطا الدورة يسريان ويسقط من لم يستوفهما', async () => {
    const out = await progress.evaluateCompletion(enrollmentId)
    expect(out.complete).toBe(false)
    expect(out.rulesChecked).toBe(2)
    expect(out.failures.join(' ')).toContain('attendance_pct')
    expect(out.failures.join(' ')).toContain('assignment_accepted')
  })

  it('وشرطٌ ثالثٌ على الشعبة يُضاف إليهما — ولا يحلّ محلَّهما', async () => {
    await prisma.completionRule.create({
      data: { courseId: COURSE, cohortId, type: 'modules_completed', threshold: 1, required: true },
    })
    const out = await progress.evaluateCompletion(enrollmentId)
    /* القديمُ كان يعيد هنا `complete: true` وقاعدةً واحدة — وهو العطب */
    expect(out.rulesChecked).toBe(3)
    expect(out.complete, 'أُسقطت شروطُ الدورة بإضافة شرطٍ على الشعبة').toBe(false)
  })

  it('والشعبةُ تُشدِّد فيُقرأ الأشدّ', async () => {
    await prisma.completionRule.create({
      data: { courseId: COURSE, cohortId, type: 'attendance_pct', threshold: 95, required: true },
    })
    const out = await progress.evaluateCompletion(enrollmentId)
    expect(out.failures.find((f) => f.startsWith('attendance_pct'))).toContain('95')
  })

  it('والإسقاطُ الصريحُ وحدَه يرفع الشرطَ — ويُقرأ رغم أنّه غيرُ لازم', async () => {
    await prisma.completionRule.create({
      data: { courseId: COURSE, cohortId, type: 'attendance_pct', threshold: 0, required: false },
    })
    await prisma.completionRule.create({
      data: { courseId: COURSE, cohortId, type: 'assignment_accepted', threshold: 0, required: false },
    })
    const out = await progress.evaluateCompletion(enrollmentId)
    /* بقي شرطُ المحاور وحدَه، وقد استوفاه */
    expect(out.rulesChecked).toBe(1)
    expect(out.complete).toBe(true)
  })
})
