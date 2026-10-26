/* نقلُ الشعبة إلى دورةٍ أخرى — على قاعدةٍ حقيقيّة (٢٦ أكتوبر ٢٠٢٦).

   شعبةُ «علامتك الشخصية» فُتحت على «كتابة المحتوى الاستراتيجي»، فاختار صاحبُ المنصّة دورةً جديدةً
   تُنقل إليها الشعبةُ بزرّ (`cohort-course-move.service.ts`). وما يُحرس هنا حدّاه: أنّ كلَّ ما يحمل
   الدورةَ والشعبةَ معا ينتقل، وتأهيلُ مدرّبها يُكتب في الجديدة بموادّه — وأنّ شعبةً فيها أثرُ متعلّمٍ
   أو مالٌ لا تنتقل أبدا. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { CohortCourseMoveService } from '../../services/cohort-course-move.service'

let prisma: PrismaClient
const ACTOR = '00000000-0000-0000-0000-000000000009'
const FROM = 'C-MKT-106'
const TO = 'C-MKT-101'
let profileId = ''
let seq = 0

const svc = () => new CohortCourseMoveService(prisma)
const cohort = (title: string, status = 'draft') => prisma.cohort.create({ data: { courseId: FROM, title, status } })
const learner = () => prisma.user.create({ data: { email: `ccmv-${++seq}@test.local`, passwordHash: 'x', displayName: 'متعلم' } })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  profileId = (await new TrainerReviewService(prisma)
    .createTrainerDirectly(ACTOR, { fullName: 'لين للاختبار', email: 'ccmv-trainer@test.local' })).profileId
  await prisma.trainerCourseQualification.upsert({
    where: { profileId_courseId: { profileId, courseId: FROM } },
    create: { profileId, courseId: FROM, status: 'qualified', materials: { modules: ['تدقيق حضورك'] } },
    update: { status: 'qualified', materials: { modules: ['تدقيق حضورك'] } },
  })
}, 240_000)

describe('ما ينتقل مع الشعبة', () => {
  it('⚠️ الشعبة وإسنادها وعرضها وقواعد أجرها وإتمامها — وتأهيل مدربها بمواده، وخطته كما هي', async () => {
    const c = await cohort('علامتك الشخصية')
    await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead' } })
    const plan = await prisma.cohortDeliveryPlan.create({
      data: { cohortId: c.id, trainerId: profileId, content: { kind: 'trainer', modules: [{ moduleId: `${FROM}-T1`, titleAr: 'تدقيق حضورك' }] } },
    })
    await prisma.trainerCourseAssignment.create({ data: { profileId, courseId: FROM, cohortId: c.id } })
    await prisma.trainerAssignmentOffer.create({ data: { profileId, courseId: FROM, cohortId: c.id, expiresAt: new Date(Date.now() + 86_400_000) } })
    await prisma.trainerCompensationRule.create({ data: { profileId, courseId: FROM, cohortId: c.id, type: 'fixed_per_cohort', rate: 500 } })
    await prisma.completionRule.create({ data: { courseId: FROM, cohortId: c.id, type: 'attendance_pct' } })
    /* وما لشعبةٍ أخرى على الدورة نفسها لا يُمسّ */
    const other = await cohort('شعبة أخرى على الدورة القديمة')
    await prisma.trainerCourseAssignment.create({ data: { profileId, courseId: FROM, cohortId: other.id } })

    const p = await svc().preview(c.id, TO)
    expect(p).toMatchObject({ canMove: true, blockedAr: null, from: { id: FROM }, to: { id: TO } })
    expect(p.trainers).toEqual([{ name: 'لين للاختبار', qualification: 'created' }])

    const r = await svc().move(ACTOR, c.id, TO)
    expect(r.carried).toEqual({
      assignments: 1, offers: 1, compensationRules: 1, completionRules: 1, changeRequests: 0, qualificationsCreated: 1,
    })
    const after = await prisma.cohort.findUniqueOrThrow({ where: { id: c.id } })
    expect(after.courseId).toBe(TO)
    expect(after.pathwayId).toBe(p.pathwayAfter)
    for (const n of [
      await prisma.trainerCourseAssignment.count({ where: { cohortId: c.id, courseId: TO } }),
      await prisma.trainerAssignmentOffer.count({ where: { cohortId: c.id, courseId: TO } }),
      await prisma.trainerCompensationRule.count({ where: { cohortId: c.id, courseId: TO } }),
      await prisma.completionRule.count({ where: { cohortId: c.id, courseId: TO } }),
    ]) expect(n).toBe(1)
    expect(await prisma.trainerCourseAssignment.count({ where: { cohortId: other.id, courseId: FROM } })).toBe(1)

    const q = await prisma.trainerCourseQualification.findUniqueOrThrow({ where: { profileId_courseId: { profileId, courseId: TO } } })
    expect(q).toMatchObject({ status: 'qualified', qualifiedBy: ACTOR, requestedCohortId: c.id, materials: { modules: ['تدقيق حضورك'] } })
    /* وتأهيلُه القديمُ باقٍ — سحبُه قرارٌ آخر */
    expect((await prisma.trainerCourseQualification.findUniqueOrThrow({ where: { profileId_courseId: { profileId, courseId: FROM } } })).status).toBe('qualified')
    expect((await prisma.cohortDeliveryPlan.findUniqueOrThrow({ where: { id: plan.id } })).content).toEqual(plan.content)

    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'cohort.course_move', entityId: c.id } })
    expect(audit).toMatchObject({ actorId: ACTOR, before: { courseId: FROM }, after: { courseId: TO } })
  })

  it('ومدرّب مؤهل للجديدة أصلا لا يكتب له تأهيل ثان', async () => {
    const c = await cohort('شعبة مدربها مؤهل للجديدة')
    await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead' } })
    expect((await svc().preview(c.id, TO)).trainers).toEqual([{ name: 'لين للاختبار', qualification: 'has' }])
    expect((await svc().move(ACTOR, c.id, TO)).carried.qualificationsCreated).toBe(0)
  })
})

describe('ما يمنع النقل', () => {
  it('⚠️ ملتحق بأي حال', async () => {
    const c = await cohort('فيها ملتحق', 'open')
    await prisma.enrollment.create({ data: { userId: (await learner()).id, cohortId: c.id, status: 'dropped' } })
    expect((await svc().preview(c.id, TO)).blockedAr).toBe('لا تنقل: فيها 1 ملتحق')
    await expect(svc().move(ACTOR, c.id, TO)).rejects.toThrow(/ملتحق/)
    expect((await prisma.cohort.findUniqueOrThrow({ where: { id: c.id } })).courseId).toBe(FROM)
  })

  it('⚠️ طلب تسجيل', async () => {
    const c = await cohort('فيها طلب تسجيل', 'open')
    await prisma.enrollmentRequest.create({ data: { userId: (await learner()).id, cohortId: c.id } })
    expect((await svc().preview(c.id, TO)).blockedAr).toBe('لا تنقل: فيها 1 طلب تسجيل')
  })

  it('⚠️ طلب شراء للشعبة — من اشترى دورة بعنوانها لا تبدل تحته', async () => {
    const c = await cohort('لها طلب شراء', 'open')
    await prisma.order.create({
      data: {
        userId: (await learner()).id, subtotal: 200, total: 200,
        items: { create: { kind: 'cohort', refId: c.id, titleAr: 'علامتك الشخصية', unitPrice: 200 } },
      },
    })
    expect((await svc().preview(c.id, TO)).blockedAr).toBe('لا تنقل: لها 1 طلب شراء')
    await expect(svc().move(ACTOR, c.id, TO)).rejects.toThrow(/طلب شراء/)
  })

  it('⚠️ ملغاة أو على الدورة نفسها', async () => {
    const c = await cohort('ملغاة', 'cancelled')
    expect((await svc().preview(c.id, TO)).blockedAr).toBe('لا تنقل: منتهية أو ملغاة')
    expect((await svc().preview(c.id, FROM)).blockedAr).toMatch(/هي على هذه الدورة أصلا/)
  })

  it('⚠️ مدرب له في الجديدة قرار غير التأهيل — لا يكتب فوقه', async () => {
    const other = (await new TrainerReviewService(prisma)
      .createTrainerDirectly(ACTOR, { fullName: 'مدرب مرفوض', email: 'ccmv-rejected@test.local' })).profileId
    await prisma.trainerCourseQualification.create({ data: { profileId: other, courseId: FROM, status: 'qualified' } })
    await prisma.trainerCourseQualification.create({ data: { profileId: other, courseId: TO, status: 'rejected' } })
    const c = await cohort('مدربها مرفوض في الجديدة')
    await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId: other, role: 'lead' } })
    const p = await svc().preview(c.id, TO)
    expect(p.canMove).toBe(false)
    expect(p.trainers).toEqual([{ name: 'مدرب مرفوض', qualification: 'blocked' }])
    expect((await prisma.trainerCourseQualification.findUniqueOrThrow({ where: { profileId_courseId: { profileId: other, courseId: TO } } })).status).toBe('rejected')
  })

  it('ودورة غير موجودة تقال باسمها', async () => {
    const c = await cohort('إلى دورة مخترعة')
    await expect(svc().preview(c.id, 'C-XXX-999')).rejects.toThrow(/غير موجودة في الكتالوج/)
  })
})
