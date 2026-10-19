/* WA2026 «لأول عملية شراء» — والقيدُ في الفوترة لا في النصّ وحدَه (١٩ أكتوبر ٢٠٢٦).

   كان الكودُ يُقبل من كلّ حسابٍ في كلّ شراء، والصفحاتُ الأربع تقول «لأول عملية شراء». واختار
   صاحبُ المنصّة أن يُقيَّد كما يقول نصُّه (`first-purchase.ts`). فيُحرس هنا:

   ١) أوّلُ شراءٍ يُخصم — وما بعد شراءٍ دُفع لا يُخصم، ولو رُدّ المال.
   ٢) وما دُفع بصفرٍ ليس شراءً.
   ٣) وطلبٌ ينتظر الدفعَ بالكود يحجزه — فلا يُستعمل في طلبين معا.
   ٤) وموافقةُ الفريق على طلبٍ أو خطّةٍ تخضع للقيد نفسِه — لا بابَ ثانٍ يتجاوزه.
   ٥) والقيدُ على هذا الكود وحدَه: كوبونٌ آخر لا يمسّه. */

import { beforeAll, describe, expect as vexpect, it } from 'vitest'
import { plainExpect } from '../helpers/plain-expect'
const expect = plainExpect(vexpect)
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { firstPurchasePromoFor } from '../../services/commerce/first-purchase'
import { approvedTrainerPlan } from '../helpers/approved-trainer'
import { PlanService } from '../../services/plan.service'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

let prisma: PrismaClient
let auth: AuthService
let commerce: CommerceService
let managerId = ''
const CODE = 'WA2026'

const learner = async (tag: string) => (await auth.register(`fp-${tag}@test.local`, 'Learner#12345', 'متعلّم')).userId

const cohort = async (title: string) => (await prisma.cohort.create({
  data: {
    plans: { create: await approvedTrainerPlan(prisma) },
    courseId: 'C-BIZ-101', title, status: 'open', registrationOpen: true,
    financialReady: true, price: 100, currency: 'USD', capacity: 50,
  },
})).id

/** شراءٌ كاملٌ بلا كود — يصير به الحسابُ مشتريا سابقا */
const buyOnce = async (userId: string) => {
  const out = await commerce.checkout(userId, [await cohort(`شعبةُ ${userId.slice(0, 6)}`)])
  await commerce.payOrder(out.orderId, userId, `k-${out.orderId}`)
  return out.orderId
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  commerce = new CommerceService(prisma)
  const m = await auth.register('fp-manager@test.local', 'Manager#12345', 'مدير')
  managerId = m.userId
  await auth.setRoles(managerId, ['academic_manager'])
}, 240_000)

describe('أوّلُ شراءٍ يُخصم، وما بعده لا', () => {
  it('حسابٌ لم يشترِ قطّ يُخصم له', async () => {
    const userId = await learner('new')
    const out = await commerce.checkout(userId, [await cohort('شعبةُ أوّل شراء')], CODE)
    const order = await prisma.order.findUniqueOrThrow({ where: { id: out.orderId } })
    expect(Number(order.discount)).toBeGreaterThan(0)
  })

  it('ومن اشترى من قبل يُردّ بجملةٍ تقول السبب', async () => {
    const userId = await learner('returning')
    await buyOnce(userId)
    await expect(commerce.checkout(userId, [await cohort('شعبةُ الشراء الثاني')], CODE))
      .rejects.toThrow(/لأول عملية شراء فقط/)
  })

  it('والردُّ لا يجعل الشراءَ الثاني أوّلا', async () => {
    const userId = await learner('refunded')
    const orderId = await buyOnce(userId)
    await prisma.order.update({ where: { id: orderId }, data: { status: 'refunded' } })
    await expect(commerce.checkout(userId, [await cohort('شعبةُ بعد الردّ')], CODE))
      .rejects.toThrow(/لأول عملية شراء فقط/)
  })

  it('وما دُفع بصفرٍ ليس شراءً', async () => {
    const userId = await learner('free')
    await prisma.order.create({ data: { userId, status: 'paid', subtotal: 0, total: 0, paidAt: new Date() } })
    const out = await commerce.checkout(userId, [await cohort('شعبةُ بعد الهديّة')], CODE)
    expect(Number((await prisma.order.findUniqueOrThrow({ where: { id: out.orderId } })).discount)).toBeGreaterThan(0)
  })
})

describe('ولا يُستعمل في طلبين معا', () => {
  it('طلبٌ ينتظر الدفعَ بالكود يحجزه، ويدلّ على «فواتيري»', async () => {
    const userId = await learner('pending')
    await commerce.checkout(userId, [await cohort('شعبةُ الطلب الأوّل')], CODE)
    await expect(commerce.checkout(userId, [await cohort('شعبةُ الطلب الثاني')], CODE))
      .rejects.toThrow(/لم يكتمل دفعه/)
  })
})

describe('وموافقةُ الفريق لا تتجاوزه', () => {
  it('ولا خطّةٌ كاملةٌ لمشترٍ سابق', async () => {
    /* دورةٌ غيرُ دورة سائر الاختبارات: الخطّةُ تختار أقربَ شعبةٍ مفتوحةٍ لدورتها */
    const courseId = (JSON.parse(readFileSync(join(process.cwd(), 'src/data/catalog/core-catalog.v2.json'), 'utf8')) as
      { courses: { course_id: string }[] }).courses.map((c) => c.course_id).sort()[3]
    await prisma.cohort.create({
      data: {
        plans: { create: await approvedTrainerPlan(prisma) },
        courseId, title: 'شعبةُ الخطّة', status: 'open', registrationOpen: true,
        financialReady: true, price: 100, currency: 'USD', capacity: 10,
        startsAt: new Date(Date.now() + 7 * 86_400_000),
      },
    })
    const userId = await learner('plan')
    await buyOnce(userId)
    /* والدورةُ المشتراةُ في الخطّة — فالخطّةُ لا تُسقط ما اشتُري (`assertKeepsCommitted`) */
    await new PlanService(prisma).adopt(userId, { nameAr: 'خطّتي', composed: true, courseIds: ['C-BIZ-101', courseId] })
    const req = await commerce.requestPlanEnrollment(userId)
    await expect(commerce.approvePlanRequests(req.planId, managerId, CODE)).rejects.toThrow(/لأول عملية شراء فقط/)
  })

  it('طلبُ تسجيلٍ لمشترٍ سابق لا يُعتمد بالكود', async () => {
    const userId = await learner('approve')
    await buyOnce(userId)
    const req = await commerce.requestEnrollment(userId, await cohort('شعبةُ الموافقة'))
    await expect(commerce.approveEnrollmentRequest(req.id, managerId, CODE)).rejects.toThrow(/لأول عملية شراء فقط/)
  })
})

describe('والقيدُ على هذا الكود وحدَه', () => {
  it('كوبونٌ عامٌّ آخر يقبله المشتري السابق', async () => {
    await prisma.coupon.create({ data: { code: 'OTHER10', percentOff: 10, active: true } })
    const userId = await learner('other-code')
    await buyOnce(userId)
    const out = await commerce.checkout(userId, [await cohort('شعبةُ الكوبون الآخر')], 'OTHER10')
    expect(Number((await prisma.order.findUniqueOrThrow({ where: { id: out.orderId } })).discount)).toBeGreaterThan(0)
  })
})

describe('وصفحةُ الدورة تسأل قبل أن تطرح الخصم', () => {
  it('الجديدُ يُخصم له، والمشتري السابقُ يُقال له السبب', async () => {
    const fresh = await learner('ask-new')
    expect(await firstPurchasePromoFor(prisma, fresh)).toEqual({ eligible: true })
    const back = await learner('ask-returning')
    await buyOnce(back)
    const r = await firstPurchasePromoFor(prisma, back)
    expect(r.eligible).toBe(false)
    expect(!r.eligible && r.reasonAr).toMatch(/لأول عملية شراء فقط/)
  })
})
