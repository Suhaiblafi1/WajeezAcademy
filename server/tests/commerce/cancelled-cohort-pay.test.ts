/* لا يُدفع عن شعبةٍ أُلغيت — وحجزُها يُفكّ ساعةَ إلغائها (١٣ نوفمبر ٢٠٢٦، قرارُ صاحب المنصّة «yes»).

   من حُجز مقعدُه ثمّ أُلغيت الشعبة كان يفتح صفحةَ الدفع ويدفع، ثمّ لا يُسجَّل — مالٌ عن لا شيء. وجُرّب فمرّ. فصار:
   ① إلغاءُ الشعبة يفكّ حجوزَها التي لم تُدفع ويُخبر أصحابَها (`releaseCancelledCohortHolds`) — والطلبُ الذي ليس فيه
      غيرُها يُلغى كلُّه.
   ② والدفعُ يردّ طلبا فيه شعبةٌ ملغاة (`payOrder`) — ولو أُلغيت بغير باب الإلغاء.

   ولا شبكة: Stripe مُلتقَط، فالحجزُ يبقى «ينتظر الدفع» ولا يُسوّى وحدَه. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { CohortService } from '../../services/cohort.service'
import { approvedTrainerPlan } from '../helpers/approved-trainer'

let prisma: PrismaClient
let auth: AuthService
let commerce: CommerceService
let adminId = ''
const realFetch = globalThis.fetch
const STAMP = Date.now()
let seq = 0
let stripeCalls = 0

const learner = async () => (await auth.register(`ccp-${++seq}-${STAMP}@test.local`, 'Learner#12345', `متعلم ${seq}`)).userId
async function cohort() {
  const course = (await prisma.course.findMany({ where: { status: 'published' }, select: { id: true }, orderBy: { id: 'desc' }, skip: seq % 10, take: 1 }))[0].id
  return (await prisma.cohort.create({
    data: {
      plans: { create: await approvedTrainerPlan(prisma) }, courseId: course, title: `شعبة الإلغاء ${++seq}`,
      status: 'open', registrationOpen: true, financialReady: true, price: 100, currency: 'USD', capacity: 10,
      startsAt: new Date(Date.now() + 20 * 86_400_000),
    } as never,
  })).id
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  commerce = new CommerceService(prisma)
  adminId = await learner()
  await prisma.integrationSetting.upsert({
    where: { provider: 'payment' },
    update: { enabled: true, config: { driver: 'stripe', secretKey: 'sk_test_ccp' } },
    create: { provider: 'payment', enabled: true, config: { driver: 'stripe', secretKey: 'sk_test_ccp' } },
  })
  globalThis.fetch = (async () => {
    stripeCalls += 1
    return { ok: true, status: 200, json: async () => ({ id: `cs_ccp_${stripeCalls}`, url: `https://checkout.stripe.com/c/pay/cs_ccp_${stripeCalls}` }) }
  }) as unknown as typeof fetch
}, 240_000)

afterAll(async () => {
  globalThis.fetch = realFetch
  await prisma.integrationSetting.deleteMany({ where: { provider: 'payment' } })
})

describe('شعبة ألغيت قبل الدفع', () => {
  it('⚠️ طلب ليس فيه غيرها: يلغى ويفك حجزه ويخبر صاحبه — ولا تفتح صفحة الدفع', async () => {
    const [u, c] = [await learner(), await cohort()]
    const { orderId } = await commerce.checkout(u, [c])
    await new CohortService(prisma).transition(c, 'cancelled', adminId)

    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status, 'بقي الطلب ينتظر الدفع').toBe('cancelled')
    expect(await prisma.enrollmentRequest.count({ where: { cohortId: c, status: 'seat_held' } }), 'بقي المقعد محجوزا').toBe(0)
    expect(await prisma.notification.count({ where: { userId: u, templateKey: 'order.cohort_cancelled' } }), 'لم يخبر صاحبه').toBeGreaterThan(0)

    stripeCalls = 0
    await expect(commerce.payOrder(orderId, u, `ccp-a-${STAMP}`)).rejects.toMatchObject({ status: 409 })
    expect(stripeCalls, 'فتحت صفحة دفع عن شعبة ملغاة').toBe(0)
  })

  it('⚠️ طلب فيه دورة أخرى: يفك حجز الملغاة وحدها — والدفع يرد ويقول لماذا', async () => {
    const u = await learner()
    const [gone, kept] = [await cohort(), await cohort()]
    const { orderId } = await commerce.checkout(u, [gone, kept])
    await new CohortService(prisma).transition(gone, 'cancelled', adminId)

    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('pending_payment')
    expect(await prisma.enrollmentRequest.count({ where: { cohortId: gone, status: 'seat_held' } })).toBe(0)
    expect(await prisma.enrollmentRequest.count({ where: { cohortId: kept, status: 'seat_held' } }), 'فك حجز الدورة الباقية').toBe(1)

    stripeCalls = 0
    await expect(commerce.payOrder(orderId, u, `ccp-b-${STAMP}`)).rejects.toMatchObject({ code: 'cohort_cancelled', status: 409 })
    expect(stripeCalls).toBe(0)
    expect(await prisma.payment.count({ where: { invoice: { orderId } } }), 'أنشئت دفعة عن طلب فيه شعبة ملغاة').toBe(0)
  })

  it('⚠️ وشعبة ألغيت بغير باب الإلغاء: الدفع يردها أيضا', async () => {
    const [u, c] = [await learner(), await cohort()]
    const { orderId } = await commerce.checkout(u, [c])
    await prisma.cohort.update({ where: { id: c }, data: { status: 'cancelled' } })
    stripeCalls = 0
    await expect(commerce.payOrder(orderId, u, `ccp-c-${STAMP}`)).rejects.toMatchObject({ code: 'cohort_cancelled' })
    expect(stripeCalls).toBe(0)
  })
})
