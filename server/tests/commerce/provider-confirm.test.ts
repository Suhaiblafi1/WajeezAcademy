/* سؤالُ المزوّد: أدُفع؟ — والطلبُ لا يُلغى ومالُه وصل (٢٦ أكتوبر ٢٠٢٦).

   شكوى صاحب المنصّة: «لماذا لا يأخذ الدفعات تلقائيّا إن دُفع ببطاقة؟». كانت التسويةُ بحدث
   المزوّد (webhook) وحدَه، فإن لم يصل بقيت الدفعةُ معلّقة، ثمّ ألغى المشغّلُ الطلبَ بعد ساعةٍ
   «مهجورا» وأبطل فاتورتَه — والبطاقةُ مقتطَعة. فيُحرس هنا (`confirmWithProvider`):

   ١) المزوّدُ يقول «دُفع» ⇒ يُسوّى الطلبُ ويُسجَّل صاحبُه — بلا حدث.
   ٢) والمشغّلُ يسأل قبل أن يُلغي: المدفوعُ يُسوّى لا يُلغى.
   ٣) وما لم يُدفع يُلغى كما كان.
   ٤) وتعذّرُ السؤال لا يُلغي — المالُ قبل المقعد.
   ٥) وحدثٌ يصل بعد التأكيد لا يُسجّل دفعةً ثانية.

   ولا شبكةَ: `fetch` مُلتقَط، وStripe يُجيب بما يضبطه كلُّ اختبار. */

import { createHmac } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect as vexpect, it } from 'vitest'
import { plainExpect } from '../helpers/plain-expect'
const expect = plainExpect(vexpect)
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { reclaimAbandonedOrders } from '../../worker/jobs'
import { approvedTrainerPlan } from '../helpers/approved-trainer'

let prisma: PrismaClient
let auth: AuthService
let commerce: CommerceService
const realFetch = globalThis.fetch
const WEBHOOK_SECRET = 'confirm-webhook-secret'

/* ما يقوله Stripe عن الجلسة: مدفوعة، أو لا، أو لا يُجيب */
let stripeSays: 'paid' | 'unpaid' | 'down' = 'unpaid'
let sessionSeq = 0

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  commerce = new CommerceService(prisma)
  process.env.PAYMENT_WEBHOOK_SECRET = WEBHOOK_SECRET
  await prisma.integrationSetting.upsert({
    where: { provider: 'payment' },
    update: { enabled: true, config: { driver: 'stripe', secretKey: 'sk_test_confirm' } },
    create: { provider: 'payment', enabled: true, config: { driver: 'stripe', secretKey: 'sk_test_confirm' } },
  })
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const u = String(url)
    if (u.endsWith('/v1/checkout/sessions') && init?.method === 'POST') {
      const id = `cs_test_confirm_${++sessionSeq}`
      return { ok: true, status: 200, json: async () => ({ id, url: `https://checkout.stripe.com/c/pay/${id}` }) }
    }
    if (u.includes('/v1/checkout/sessions/')) {
      if (stripeSays === 'down') throw new Error('ECONNRESET')
      return { ok: true, status: 200, json: async () => ({ payment_status: stripeSays }) }
    }
    throw new Error(`نداءٌ غير متوقَّع: ${u}`)
  }) as unknown as typeof fetch
}, 240_000)

afterAll(async () => {
  globalThis.fetch = realFetch
  delete process.env.PAYMENT_WEBHOOK_SECRET
  await prisma.integrationSetting.deleteMany({ where: { provider: 'payment' } })
})

beforeEach(() => { stripeSays = 'unpaid' })

/** مشترٍ بلغ صفحةَ الدفع المستضافة — طلبٌ ينتظر ودفعةٌ معلّقة بمرجع الجلسة */
const atCheckout = async (tag: string) => {
  const userId = (await auth.register(`confirm-${tag}@test.local`, 'Buyer#12345', 'مشترٍ')).userId
  const cohortId = (await prisma.cohort.create({
    data: {
      plans: { create: await approvedTrainerPlan(prisma) },
      courseId: 'C-BIZ-101', title: `شعبة ${tag}`, status: 'open', registrationOpen: true,
      financialReady: true, price: 200, currency: 'USD', capacity: 20,
    },
  })).id
  const out = await commerce.checkout(userId, [cohortId])
  const pay = await commerce.payOrder(out.orderId, userId, `confirm-${tag}`)
  return { userId, cohortId, orderId: out.orderId, paymentId: pay.id }
}

const orderOf = (id: string) => prisma.order.findUniqueOrThrow({ where: { id }, include: { invoice: { include: { payments: true } } } })
/** طلبٌ قديم — وصفحةُ دفعه فُتحت معه، فهي مغلقةٌ عند Stripe بعد ساعة (`expires_at`) */
const age = async (orderId: string, hours: number) => {
  const at = new Date(Date.now() - hours * 3_600_000)
  await prisma.payment.updateMany({ where: { invoice: { orderId } }, data: { createdAt: at } })
  return prisma.order.update({ where: { id: orderId }, data: { createdAt: at } })
}

describe('سؤالُ المزوّد حين لا يصل حدثُه', () => {
  it('المزوّدُ يقول «دُفع» ⇒ يُسوّى الطلبُ ويُسجَّل صاحبُه', async () => {
    const { userId, cohortId, orderId } = await atCheckout('paid')
    expect((await orderOf(orderId)).status).toBe('pending_payment')
    stripeSays = 'paid'
    expect(await commerce.confirmWithProvider(orderId, userId)).toBe('paid')
    const order = await orderOf(orderId)
    expect(order.status, 'دفع ببطاقته ولم يُسوَّ طلبُه').toBe('paid')
    expect(order.invoice!.status).toBe('paid')
    expect(order.invoice!.payments.filter((p) => p.status === 'succeeded')).toHaveLength(1)
    const enrolled = await prisma.enrollment.findFirst({ where: { userId, cohortId } })
    expect(enrolled, 'دفع ولم يُسجَّل في شعبته').not.toBeNull()
  })

  it('وما لم يُدفع يبقى كما هو', async () => {
    const { userId, orderId } = await atCheckout('unpaid')
    expect(await commerce.confirmWithProvider(orderId, userId)).toBe('unpaid')
    expect((await orderOf(orderId)).status).toBe('pending_payment')
  })

  it('وحدثٌ يصل بعد التأكيد لا يُسجّل دفعةً ثانية', async () => {
    const { userId, orderId } = await atCheckout('late-webhook')
    stripeSays = 'paid'
    await commerce.confirmWithProvider(orderId, userId)
    const order = await orderOf(orderId)
    const t = Math.floor(Date.now() / 1000)
    const body = JSON.stringify({
      id: `evt_late_${orderId}`, type: 'checkout.session.completed',
      data: { object: { id: order.invoice!.payments[0].providerRef, metadata: { invoiceNumber: order.invoice!.number } } },
    })
    const sig = `t=${t},v1=${createHmac('sha256', WEBHOOK_SECRET).update(`${t}.${body}`).digest('hex')}`
    await commerce.handleWebhook('stripe', body, sig)
    const after = await orderOf(orderId)
    expect(after.invoice!.payments.filter((p) => p.status === 'succeeded'), 'دفعتان عن مالٍ واحد').toHaveLength(1)
  })
})

describe('الحدثُ يُسوّي الدفعةَ بما اقتُطع — لا بعملة الفاتورة', () => {
  it('⚠️ دفع ٢٠٠ دولار بالدرهم: الدفعةُ الناجحةُ بالدرهم، ودفعةٌ واحدةٌ لا اثنتان', async () => {
    const userId = (await auth.register('confirm-aed@test.local', 'Buyer#12345', 'مشترٍ')).userId
    const cohortId = (await prisma.cohort.create({
      data: {
        plans: { create: await approvedTrainerPlan(prisma) },
        courseId: 'C-BIZ-101', title: 'شعبة بالدرهم', status: 'open', registrationOpen: true,
        financialReady: true, price: 200, currency: 'USD', capacity: 20,
      },
    })).id
    const out = await commerce.checkout(userId, [cohortId])
    const charged = await commerce.payOrder(out.orderId, userId, 'confirm-aed', 'AED')
    expect(charged.currency).toBe('AED')
    const order = await orderOf(out.orderId)
    const t = Math.floor(Date.now() / 1000)
    const body = JSON.stringify({
      id: `evt_aed_${out.orderId}`, type: 'checkout.session.completed',
      data: { object: { id: charged.providerRef, metadata: { invoiceNumber: order.invoice!.number } } },
    })
    const sig = `t=${t},v1=${createHmac('sha256', WEBHOOK_SECRET).update(`${t}.${body}`).digest('hex')}`
    await commerce.handleWebhook('stripe', body, sig)
    const after = await orderOf(out.orderId)
    expect(after.status).toBe('paid')
    const ok = after.invoice!.payments.filter((p) => p.status === 'succeeded')
    expect(ok, 'دفعتان عن مالٍ واحد').toHaveLength(1)
    expect(ok[0].currency, 'سُجّلت بعملة الفاتورة لا بما اقتُطع').toBe('AED')
    expect(Number(ok[0].amount)).toBe(Number(charged.amount))
    expect(after.invoice!.payments.filter((p) => p.status === 'pending'), 'بقيت المعلّقةُ معلّقة').toHaveLength(0)
  })
})

describe('المشغّلُ يسأل قبل أن يُلغي «المهجور»', () => {
  it('المدفوعُ عند المزوّد يُسوّى لا يُلغى', async () => {
    const { orderId } = await atCheckout('worker-paid')
    await age(orderId, 3)
    stripeSays = 'paid'
    await reclaimAbandonedOrders(prisma)
    expect((await orderOf(orderId)).status, 'أُلغي طلبٌ دفعه صاحبُه ببطاقته').toBe('paid')
  })

  it('⚠️ وطلبٌ قديمٌ فتح صاحبُه صفحةَ دفعه للتوّ («أكمل الدفع») لا يُلغى وصفحتُه مفتوحة', async () => {
    const { userId, orderId } = await atCheckout('worker-resumed')
    await age(orderId, 3)
    await commerce.payOrder(orderId, userId, `confirm-worker-resumed-again`)
    await reclaimAbandonedOrders(prisma)
    expect((await orderOf(orderId)).status, 'أُلغي طلبٌ صفحةُ دفعه مفتوحة').toBe('pending_payment')
  })

  it('وما لم يُدفع يُلغى كما كان — ويؤرشف طلبُه وفاتورتُه', async () => {
    const { orderId } = await atCheckout('worker-unpaid')
    await age(orderId, 3)
    await reclaimAbandonedOrders(prisma)
    const order = await orderOf(orderId)
    expect(order.status).toBe('cancelled')
    expect(order.invoice!.status).toBe('void')
  })

  it('وتعذّرُ السؤال لا يُلغي — المالُ قبل المقعد', async () => {
    const { orderId } = await atCheckout('worker-down')
    await age(orderId, 3)
    stripeSays = 'down'
    await reclaimAbandonedOrders(prisma)
    expect((await orderOf(orderId)).status, 'أُلغي ولم نعرف أدُفع أم لا').toBe('pending_payment')
  })
})
