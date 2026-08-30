/* شراء الخطّة كاملةً — التوصيات ٢ و٣ و٥.

   ثلاثة أعطال كانت تقطع الطريق بين خطّةٍ بناها المتعلّم وبين جلوسه في قاعة:

   ١) لم يكن للخطّة بابٌ على الخادم أصلا. زرّ الشراء يفتح نافذةً تحيله إلى
      «تصفّح الشعب المفتوحة» — فيبدأ اختياره من الصفر، دورةً دورة.
   ٢) `settleOrder` كان يحوّل **أوّل** طلبٍ محجوز فقط (findFirst). فمن دفع عن
      أربع دورات كان يُسجَّل في واحدة، والطلب «مدفوع» والفاتورة «مدفوعة»
      ولا يحمرّ شيء — النقص لا يظهر إلا في شاشة المتعلّم.
   ٣) ودورةٌ بلا شعبةٍ مفتوحة كانت تُباع صامتة، فيكتشفها بعد أن دفع.

   وهذه الاختبارات تُحرّك الواقع كما يقع: تفتح شعبا، تترك دورةً بلا شعبة،
   تطلب، توافق، تدفع — ثم تسأل: أفي كل دوراته صار مسجَّلا؟ */

import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { PlanService } from '../../services/plan.service'
import { CommerceService } from '../../services/commerce.service'

let prisma: PrismaClient
let auth: AuthService
let plans: PlanService
let commerce: CommerceService

/* دورات مختلفة لكل اختبار: الشعب تتراكم في قاعدة واحدة، و`viewOf` تختار
   أقرب شعبةٍ للدورة — فدورةٌ استعملها اختبارٌ سابق تُعطي شعبته لا شعبتنا،
   فيخضرّ الاختبار أو يحمرّ لسببٍ لا علاقة له بالمقيس.

   والمعرّفات تُقرأ من الكتالوج لا تُكتب يدا. كانت اثني عشر معرّفا مكتوبا،
   فلمّا دُمجت أوّل دورتين من كل مسار زالت أربعةٌ منها (C-*-102) — فسقطت
   أربعة اختبارات بـ«Foreign key constraint violated on Cohort_courseId_fkey»:
   حمرةٌ سببها معرّفٌ متقادم لا خللٌ في الشراء الذي تقيسه. */
const POOL: string[] = (
  JSON.parse(
    readFileSync(join(process.cwd(), 'src/data/catalog/core-catalog.v2.json'), 'utf8'),
  ) as { courses: { course_id: string }[] }
).courses.map((c) => c.course_id).sort()

/** الدورة رقم n من الكتالوج — مختلفةٌ عن سائرها بحكم البناء */
const at = (n: number): string => {
  const id = POOL[n]
  if (!id) throw new Error(`الكتالوج فيه ${POOL.length} دورة فقط — لا دورة بالفهرس ${n}`)
  return id
}
const [A, B, C, D, E, F, G, H, I, J, K, L, M, N, O] = Array.from({ length: 15 }, (_, i) => at(i))

let seq = 0
async function learner() {
  seq += 1
  const { userId } = await auth.register(`planbuy-${seq}@test.local`, 'Learner#12345', `مشترٍ ${seq}`)
  return userId
}
async function openCohort(courseId: string, opts: { capacity?: number; price?: number; currency?: string } = {}) {
  return prisma.cohort.create({
    data: {
      courseId, title: `شعبة ${courseId} ${Date.now()}-${Math.random()}`,
      status: 'open', registrationOpen: true, financialReady: true,
      price: opts.price ?? 100, currency: opts.currency ?? 'JOD',
      capacity: opts.capacity ?? 10, startsAt: new Date(Date.now() + 7 * 86_400_000),
    },
  })
}
async function admin() {
  seq += 1
  const { userId } = await auth.register(`planops-${seq}@test.local`, 'Ops#123456789', `عمليات ${seq}`)
  return userId
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  plans = new PlanService(prisma)
  commerce = new CommerceService(prisma)
}, 240_000)

describe('طلب الخطّة كاملةً — التوصية ٢', () => {
  it('يطلب ما له شعبة، ويسمّي ما لا شعبة له بدل السكوت عنه', async () => {
    const u = await learner()
    await openCohort(A)
    await openCohort(B)
    /* C بلا شعبة مفتوحة — هذا هو محلّ الاختبار */
    await plans.adopt(u, { nameAr: 'خطّتي', composed: true, courseIds: [A, B, C] })

    const res = await commerce.requestPlanEnrollment(u)
    expect(res.requested.map((r) => r.courseId).sort()).toEqual([A, B].sort())
    expect(res.awaiting).toEqual([C])

    const reqs = await prisma.enrollmentRequest.findMany({ where: { userId: u } })
    expect(reqs).toHaveLength(2)
    expect(reqs.every((r) => r.status === 'pending')).toBe(true)
    expect(new Set(reqs.map((r) => r.planId)).size).toBe(1)
  })

  it('نداءٌ ثانٍ لا يكرّر الطلبات — القائم يبقى قائما', async () => {
    const u = await learner()
    await openCohort(D)
    await plans.adopt(u, { nameAr: 'خطّتي', composed: false, courseIds: [D] })
    await commerce.requestPlanEnrollment(u)
    const second = await commerce.requestPlanEnrollment(u)
    expect(second.requested).toHaveLength(0)
    expect(second.alreadyRequested).toEqual([D])
    expect(await prisma.enrollmentRequest.count({ where: { userId: u } })).toBe(1)
  })

  it('بلا خطّة فعّالة لا طلب — ولا انهيار', async () => {
    const u = await learner()
    await expect(commerce.requestPlanEnrollment(u)).rejects.toMatchObject({ code: 'no_plan' })
  })
})

describe('فاتورةٌ واحدة للخطّة — التوصية ٣', () => {
  it('الموافقة تحجز كل المقاعد وتصدر طلبا وفاتورة واحدة بمجموع الأسعار', async () => {
    const u = await learner()
    const ops = await admin()
    await openCohort(E, { price: 120 })
    await openCohort(F, { price: 80 })
    await plans.adopt(u, { nameAr: 'خطّتي', composed: true, courseIds: [E, F] })
    const req = await commerce.requestPlanEnrollment(u)

    const order = await commerce.approvePlanRequests(req.planId, ops)
    expect(Number(order.subtotal)).toBe(200)
    expect(Number(order.total)).toBe(200)

    const items = await prisma.orderItem.findMany({ where: { orderId: order.id } })
    expect(items).toHaveLength(2)
    const invoices = await prisma.invoice.findMany({ where: { orderId: order.id } })
    expect(invoices).toHaveLength(1)
    expect(Number(invoices[0].amount)).toBe(200)

    const held = await prisma.enrollmentRequest.findMany({ where: { planId: req.planId } })
    expect(held.every((r) => r.status === 'seat_held' && r.orderId === order.id)).toBe(true)
  })

  it('الدفعة الواحدة تُسجّل في كل دورات الخطّة — لا في أولاها وحدها', async () => {
    const u = await learner()
    const ops = await admin()
    await openCohort(G)
    await openCohort(H)
    await openCohort(I)
    await plans.adopt(u, { nameAr: 'خطّتي', composed: true, courseIds: [G, H, I] })
    const req = await commerce.requestPlanEnrollment(u)
    expect(req.requested).toHaveLength(3)
    const order = await commerce.approvePlanRequests(req.planId, ops)

    await commerce.payOrderTest(order.id, u, `plan-pay-${order.id}`)

    const enrolled = await prisma.enrollment.findMany({
      where: { userId: u, status: 'enrolled' }, include: { cohort: { select: { courseId: true } } },
    })
    expect(
      enrolled.map((e) => e.cohort.courseId).sort(),
      'دُفع عن ثلاث دورات وسُجّل في أقلّ منها',
    ).toEqual([G, H, I].sort())

    const after = await prisma.enrollmentRequest.findMany({ where: { planId: req.planId } })
    expect(after.every((r) => r.status === 'converted')).toBe(true)

    /* والخطّة نفسها تقرأ الواقع الجديد بلا كتابةٍ فيها */
    const view = await plans.active(u)
    expect(view?.counts.enrolled).toBe(3)
  })

  it('شعبة بلا سعر توقف الموافقة كلها — لا فاتورة ناقصة', async () => {
    const u = await learner()
    const ops = await admin()
    await openCohort(J, { price: 100 })
    const noPrice = await openCohort(K)
    await prisma.cohort.update({ where: { id: noPrice.id }, data: { price: null } })
    await plans.adopt(u, { nameAr: 'خطّتي', composed: true, courseIds: [J, K] })
    const req = await commerce.requestPlanEnrollment(u)
    await expect(commerce.approvePlanRequests(req.planId, ops)).rejects.toMatchObject({ code: 'no_price' })
    expect(await prisma.order.count({ where: { userId: u } })).toBe(0)
  })

  it('عملتان مختلفتان لا تُجمعان في فاتورة واحدة', async () => {
    const u = await learner()
    const ops = await admin()
    await openCohort(L, { currency: 'JOD' })
    await openCohort(M, { currency: 'SAR' })
    await plans.adopt(u, { nameAr: 'خطّتي', composed: true, courseIds: [L, M] })
    const req = await commerce.requestPlanEnrollment(u)
    await expect(commerce.approvePlanRequests(req.planId, ops)).rejects.toMatchObject({ code: 'mixed_currency' })
    expect(await prisma.order.count({ where: { userId: u } })).toBe(0)
  })

  it('شعبةٌ ممتلئة توقف الحجز كلّه — لا مقاعد محجوزة لطلبٍ لن يُنشأ', async () => {
    const u = await learner()
    const other = await learner()
    const ops = await admin()
    await openCohort(N)
    const tight = await openCohort(O, { capacity: 1 })
    await prisma.enrollment.create({ data: { cohortId: tight.id, userId: other, status: 'enrolled' } })
    await plans.adopt(u, { nameAr: 'خطّتي', composed: true, courseIds: [N, O] })
    const req = await commerce.requestPlanEnrollment(u)
    await expect(commerce.approvePlanRequests(req.planId, ops)).rejects.toMatchObject({ code: 'capacity_full' })
    const still = await prisma.enrollmentRequest.findMany({ where: { planId: req.planId } })
    expect(still.every((r) => r.status === 'pending'), 'حُجزت مقاعد رغم فشل الموافقة').toBe(true)
    expect(await prisma.order.count({ where: { userId: u } })).toBe(0)
  })
})
