/* خطّة المتعلّم على الخادم (التوصية ١).

   القيمة كلّها في **الحالة المشتقّة**: أيّ دورة مسجَّلٌ فيها، وأيّها لها شعبة
   يستطيع طلبها الآن، وأيّها بلا شعبة أصلا. وهذا آخِرُه هو جواب سؤال المالك —
   «لا تبِع خطّةً فيها دورة لا يستطيع حضورها». فالاختبارات هنا تُحرّك الواقع
   (تفتح شعبة، تُغلقها، تُسجّل المتعلّم) وتتأكّد أن الخطّة تتبعه بلا كتابةٍ فيها. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { PlanService } from '../../services/plan.service'

let prisma: PrismaClient
let auth: AuthService
let plans: PlanService
const A = 'C-BIZ-101'
const B = 'C-MGR-105'
const C = 'C-MKT-101'

let seq = 0
async function learner() {
  seq += 1
  const { userId } = await auth.register(`plan-${seq}@test.local`, 'Learner#12345', `متعلّم ${seq}`)
  return userId
}
async function openCohort(courseId: string, opts: { capacity?: number; open?: boolean } = {}) {
  return prisma.cohort.create({
    data: {
      courseId, title: `شعبة ${courseId} ${Date.now()}`,
      status: opts.open === false ? 'draft' : 'open',
      registrationOpen: opts.open !== false,
      financialReady: true, price: 100, currency: 'JOD',
      capacity: opts.capacity ?? 10, startsAt: new Date(Date.now() + 7 * 86_400_000),
    },
  })
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  plans = new PlanService(prisma)
}, 240_000)

describe('الاعتماد', () => {
  it('يحفظ الاسم والترتيب والهديّة', async () => {
    const u = await learner()
    const p = await plans.adopt(u, { nameAr: 'مسارك الشخصي', composed: true, hostPathwayId: 'PW-X', giftCourseId: B, courseIds: [A, B, C] })
    expect(p.nameAr).toBe('مسارك الشخصي')
    expect(p.composed).toBe(true)
    expect(p.items.map((i) => i.courseId)).toEqual([A, B, C])
    expect(p.items.map((i) => i.sequence)).toEqual([1, 2, 3])
    expect(p.items.find((i) => i.courseId === B)?.isGift).toBe(true)
  })

  it('الخطّة تبقى بعد إغلاق المتصفّح — تُقرأ بنداءٍ جديد', async () => {
    const u = await learner()
    await plans.adopt(u, { nameAr: 'خطّتي', composed: false, courseIds: [A, B] })
    const again = await plans.active(u)
    expect(again?.items).toHaveLength(2)
    expect(again?.nameAr).toBe('خطّتي')
  })

  it('اعتمادٌ ثانٍ يؤرشف الأوّل — خطّةٌ فعّالة واحدة', async () => {
    const u = await learner()
    await plans.adopt(u, { nameAr: 'الأولى', composed: false, courseIds: [A] })
    await plans.adopt(u, { nameAr: 'الثانية', composed: false, courseIds: [B, C] })
    expect((await plans.active(u))?.nameAr).toBe('الثانية')
    expect(await prisma.learnerPlan.count({ where: { userId: u, status: 'archived' } })).toBe(1)
  })

  it('لا خطّة لمن لم يعتمد', async () => {
    expect(await plans.active(await learner())).toBeNull()
  })

  it('التكرار يُزال، والفارغة تُرفض، وهديّةٌ خارج الخطّة تُهمَل', async () => {
    const u = await learner()
    const p = await plans.adopt(u, { nameAr: 'خطّة', composed: false, giftCourseId: 'C-NOT-IN', courseIds: [A, A, B] })
    expect(p.items.map((i) => i.courseId)).toEqual([A, B])
    expect(p.giftCourseId).toBeNull()
    await expect(plans.adopt(u, { nameAr: 'خطّة', composed: false, courseIds: [] })).rejects.toMatchObject({ code: 'empty_plan' })
  })
})

describe('الحالة تُشتقّ من الواقع لا تُخزَّن', () => {
  it('بلا شعبة مفتوحة: awaiting_cohort — وهذه الدورة لا تُباع', async () => {
    const u = await learner()
    await openCohort(A, { open: false }) // مسوّدة: لا تُحتسب
    const p = await plans.adopt(u, { nameAr: 'خطّة', composed: false, courseIds: [A] })
    expect(p.items[0].state).toBe('awaiting_cohort')
    expect(p.items[0].cohort).toBeNull()
    expect(p.counts.awaitingCohort).toBe(1)
  })

  it('فتحُ شعبةٍ بعد الاعتماد يقلب الحالة بلا لمس الخطّة', async () => {
    const u = await learner()
    await plans.adopt(u, { nameAr: 'خطّة', composed: false, courseIds: [A] })
    expect((await plans.active(u))?.items[0].state).toBe('awaiting_cohort')
    const c = await openCohort(A)
    const after = await plans.active(u)
    expect(after?.items[0].state).toBe('schedulable')
    expect(after?.items[0].cohort?.id).toBe(c.id)
    /* ولم يُكتب في الخطّة شيء — الجدول يحفظ القصد وحده */
    const rows = await prisma.learnerPlanItem.findMany({ where: { plan: { userId: u, status: 'active' } } })
    expect(Object.keys(rows[0])).not.toContain('state')
  })

  it('التسجيل يقلبها إلى enrolled', async () => {
    const u = await learner()
    const c = await openCohort(B)
    await plans.adopt(u, { nameAr: 'خطّة', composed: false, courseIds: [B] })
    await prisma.enrollment.create({ data: { userId: u, cohortId: c.id, status: 'enrolled' } })
    const p = await plans.active(u)
    expect(p?.items[0].state).toBe('enrolled')
    expect(p?.counts.enrolled).toBe(1)
  })

  it('العدّادات تصف الخطّة كاملةً — بها يُعرف أتُباع أم لا', async () => {
    const u = await learner()
    const cA = await openCohort(A)
    await openCohort(B)
    await plans.adopt(u, { nameAr: 'خطّة', composed: false, courseIds: [A, B, C] })
    await prisma.enrollment.create({ data: { userId: u, cohortId: cA.id, status: 'enrolled' } })
    const p = await plans.active(u)
    expect(p?.counts).toEqual({ total: 3, enrolled: 1, schedulable: 1, awaitingCohort: 1 })
  })

  it('الطلب القائم يُعلَم — فلا يُعرض «اطلب» ثم يُردّ ٤٠٩', async () => {
    const u = await learner()
    const c = await openCohort(C)
    await plans.adopt(u, { nameAr: 'خطّة', composed: false, courseIds: [C] })
    expect((await plans.active(u))?.items[0].requestPending).toBe(false)
    await prisma.enrollmentRequest.create({ data: { userId: u, cohortId: c.id, status: 'pending' } })
    expect((await plans.active(u))?.items[0].requestPending).toBe(true)
  })

  it('أقرب شعبة هي المعروضة حين تتعدّد', async () => {
    const u = await learner()
    const far = await prisma.cohort.create({
      data: { courseId: A, title: 'بعيدة', status: 'open', registrationOpen: true, financialReady: true,
        price: 100, currency: 'JOD', capacity: 5, startsAt: new Date(Date.now() + 90 * 86_400_000) },
    })
    const near = await prisma.cohort.create({
      data: { courseId: A, title: 'قريبة', status: 'open', registrationOpen: true, financialReady: true,
        price: 100, currency: 'JOD', capacity: 5, startsAt: new Date(Date.now() + 2 * 86_400_000) },
    })
    await plans.adopt(u, { nameAr: 'خطّة', composed: false, courseIds: [A] })
    const p = await plans.active(u)
    expect(p?.items[0].cohort?.id).toBe(near.id)
    expect(p?.items[0].cohort?.id).not.toBe(far.id)
  })

  it('لا تتسرّب خطّةُ متعلّمٍ إلى آخر', async () => {
    const u1 = await learner()
    const u2 = await learner()
    await plans.adopt(u1, { nameAr: 'خطّة الأوّل', composed: false, courseIds: [A, B] })
    expect(await plans.active(u2)).toBeNull()
  })
})

describe('التعديل', () => {
  it('تبديل الدورات يبقي الاسم والهوية', async () => {
    const u = await learner()
    const p1 = await plans.adopt(u, { nameAr: 'مسارك الشخصي', composed: true, courseIds: [A, B] })
    const p2 = await plans.replaceCourses(u, [A, C, B], B)
    expect(p2.id).toBe(p1.id)
    expect(p2.nameAr).toBe('مسارك الشخصي')
    expect(p2.items.map((i) => i.courseId)).toEqual([A, C, B])
    expect(p2.giftCourseId).toBe(B)
  })

  it('تعديل بلا خطّة فعّالة يُرفض ولا يُنشئ شيئا', async () => {
    const u = await learner()
    await expect(plans.replaceCourses(u, [A])).rejects.toMatchObject({ code: 'no_plan' })
    expect(await prisma.learnerPlan.count({ where: { userId: u } })).toBe(0)
  })
})
