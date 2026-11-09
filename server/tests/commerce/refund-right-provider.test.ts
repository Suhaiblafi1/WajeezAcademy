/* مراجعةُ مسار الدفع والاسترداد (٩ نوفمبر ٢٠٢٦) — أربعةُ أعطابٍ ثبتت بتجربةٍ على القاعدة، والعلّةُ في مواضعها من
   `commerce.service.ts`.

   ① **صفحتا دفعٍ دُفعتا لطلبٍ واحد** — كانت الثانيةُ تبقى «معلّقة» ومالُها مقتطَع، لا تُرى ولا يُردّ منها شيء. فتُقيَّد
      زائدة وتُخبَر الماليّة (قرارُ صاحب المنصّة «a»)، وردُّها لا يمسّ الطلب. بالحدث وبسؤال المزوّد.
   ② **دفعةٌ بتحويلٍ بنكيّ وStripe مفعّل** — كان ردُّها يُطلب من Stripe بلا مرجع.
   ③ **دفعةٌ ببطاقة والقناةُ موقوفة** — كان ردُّها «ينجح» عند المزوّد الاختباريّ والبطاقةُ لم يصلها شيء.
   ④ **نقرتان على «تسجيل دفعة يدوية»** — كانتا تكتبان دفعتين ناجحتين لفاتورةٍ واحدة.

   ولا شبكةَ: `fetch` مُلتقَط، ويُقيَّد كلُّ نداءٍ لـStripe. */

import { createHmac } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { approvedTrainerPlan } from '../helpers/approved-trainer'
import { GrantService } from '../../services/grant.service'
import { GrantLandingService } from '../../services/grant-landing.service'
import { InfluencerService } from '../../services/influencer.service'
import { CohortEconomicsService } from '../../services/cohort-economics.service'
import { INFLUENCER_GRANT_SLUG } from '../../../src/application/commerce/grant'

let prisma: PrismaClient
let auth: AuthService
let commerce: CommerceService
let finance = ''
const realFetch = globalThis.fetch
const SECRET = 'refund-provider-secret'
const STAMP = Date.now()
let seq = 0
const stripeCalls: string[] = []
const REASON = 'سبب الاسترداد الموثق'

const stripe = (enabled: boolean) => prisma.integrationSetting.upsert({
  where: { provider: 'payment' },
  update: { enabled, config: { driver: 'stripe', secretKey: 'sk_test_refund' } },
  create: { provider: 'payment', enabled, config: { driver: 'stripe', secretKey: 'sk_test_refund' } },
})

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  commerce = new CommerceService(prisma)
  process.env.PAYMENT_WEBHOOK_SECRET = SECRET
  const f = await auth.register(`refund-finance-${STAMP}@test.local`, 'Staff#12345', 'الماليّة')
  await auth.setRoles(f.userId, ['finance'])
  finance = f.userId
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const u = String(url)
    stripeCalls.push(u)
    if (u.endsWith('/v1/checkout/sessions') && init?.method === 'POST') {
      const id = `cs_test_refund_${++seq}`
      return { ok: true, status: 200, json: async () => ({ id, url: `https://checkout.stripe.com/c/pay/${id}` }) }
    }
    if (u.includes('/v1/checkout/sessions/')) return { ok: true, status: 200, json: async () => ({ payment_status: 'paid', payment_intent: 'pi_test_refund' }) }
    if (u.endsWith('/v1/refunds')) return { ok: true, status: 200, json: async () => ({ id: `re_test_${++seq}` }) }
    throw new Error(`نداءٌ غير متوقَّع: ${u}`)
  }) as unknown as typeof fetch
}, 240_000)

afterAll(async () => {
  globalThis.fetch = realFetch
  delete process.env.PAYMENT_WEBHOOK_SECRET
  await prisma.integrationSetting.deleteMany({ where: { provider: 'payment' } })
})

beforeEach(async () => { await stripe(true); stripeCalls.length = 0 })

/** مشترٍ بطلبٍ ينتظر الدفع — وStripe مفعّل فلا يُسوّى فورا */
const order = async (tag: string) => {
  const userId = (await auth.register(`refund-${tag}-${STAMP}@test.local`, 'Buyer#12345', `مشتر ${tag}`)).userId
  const cohortId = (await prisma.cohort.create({
    data: {
      plans: { create: await approvedTrainerPlan(prisma) }, courseId: 'C-BIZ-101', title: `شعبة الرد ${tag}`,
      status: 'open', registrationOpen: true, financialReady: true, price: 200, currency: 'USD', capacity: 20,
    },
  })).id
  const { orderId } = await commerce.checkout(userId, [cohortId])
  const invoice = await prisma.invoice.findFirstOrThrow({ where: { orderId } })
  return { userId, cohortId, orderId, invoice }
}

const paidEvent = (eventId: string, session: string, invoiceNumber: string) => {
  const raw = JSON.stringify({ id: eventId, type: 'checkout.session.completed', data: { object: { id: session, metadata: { invoiceNumber } } } })
  const t = Math.floor(Date.now() / 1000)
  return commerce.handleWebhook('stripe', raw, `t=${t},v1=${createHmac('sha256', SECRET).update(`${t}.${raw}`).digest('hex')}`)
}

describe('① صفحتا دفع دفعتا لطلب واحد', () => {
  it('⚠️ بالحدث: الثانية تقيد زائدة ويصل الماليةَ جرسها — والطلب مدفوع مرة', async () => {
    const { userId, orderId, invoice } = await order('two-pages')
    const a = await commerce.payOrder(orderId, userId, `two-a-${STAMP}`)
    const b = await commerce.payOrder(orderId, userId, `two-b-${STAMP}`, 'AED')
    await paidEvent(`evt_two_a_${STAMP}`, a.providerRef!, invoice.number)
    await paidEvent(`evt_two_b_${STAMP}`, b.providerRef!, invoice.number)

    const second = await prisma.payment.findUniqueOrThrow({ where: { id: b.id } })
    expect(second.status, 'بقيت الدفعة الثانية معلقة ومالها مقتطع').toBe('succeeded')
    expect(await prisma.auditEvent.count({ where: { action: 'payment.extra', entityId: b.id } }), 'لم يقيد أثر الزائدة').toBe(1)
    expect(await prisma.notification.count({ where: { userId: finance, templateKey: 'admin.payment_extra' } }), 'لم يصل الماليةَ جرس').toBe(1)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('paid')
    expect(await prisma.enrollment.count({ where: { userId } }), 'سجل مرتين').toBe(1)

    /* والزائدةُ معلَّمةٌ وحدَها — بها تعرضها الشاشة ويتخطّاها كلُّ حسابٍ للمال */
    const marked = await prisma.payment.findMany({ where: { invoiceId: invoice.id, extra: true }, select: { id: true } })
    expect(marked.map((p) => p.id)).toEqual([b.id])
  })

  it('⚠️ وردها لا يمس الطلب ولا مقعده', async () => {
    const { userId, orderId, invoice } = await order('extra-refund')
    const a = await commerce.payOrder(orderId, userId, `xr-a-${STAMP}`)
    const b = await commerce.payOrder(orderId, userId, `xr-b-${STAMP}`)
    await paidEvent(`evt_xr_a_${STAMP}`, a.providerRef!, invoice.number)
    await paidEvent(`evt_xr_b_${STAMP}`, b.providerRef!, invoice.number)
    const r = await commerce.requestRefund(b.id, finance, { amount: 200, reason: REASON })
    await commerce.processRefund(r.id, finance, true, undefined, { dropSeat: true })

    expect((await prisma.payment.findUniqueOrThrow({ where: { id: b.id } })).status).toBe('refunded')
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status, 'رد الزائدة جعل الطلب مستردا').toBe('paid')
    expect(await prisma.enrollment.count({ where: { userId, status: 'enrolled' } }), 'أسقط مقعده برد الزائدة').toBe(1)
  })

  it('⚠️ وبسؤال المزود: الصفحتان مدفوعتان ولا حدث — تسوي الأولى وتقيد الثانية زائدة', async () => {
    const { userId, orderId, invoice } = await order('confirm-two')
    const a = await commerce.payOrder(orderId, userId, `ct-a-${STAMP}`)
    const b = await commerce.payOrder(orderId, userId, `ct-b-${STAMP}`)
    expect(await commerce.confirmWithProvider(orderId, finance)).toBe('paid')

    const pays = await prisma.payment.findMany({ where: { invoiceId: invoice.id } })
    expect(pays.filter((p) => p.status === 'pending'), 'بقيت صفحة مدفوعة معلقة').toHaveLength(0)
    expect(await prisma.auditEvent.count({ where: { action: 'payment.extra', entityId: { in: [a.id, b.id] } } })).toBe(1)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('paid')
  })
})

describe('⑤ ورد الزائدة لا ينقص أجر المدرب ولا عمولة المؤثر', () => {
  it('⚠️ ما حصلته الشعبة وعمولة المؤثر قبل الرد وبعده سواء', async () => {
    await new GrantService(prisma, INFLUENCER_GRANT_SLUG).update({ active: true }, finance)
    const influencers = new InfluencerService(prisma)
    const inf = (await influencers.create({ nameAr: 'مؤثر الزائدة', code: `XTRA${STAMP % 100000}`, commissionPercent: 15 }, finance)).id
    const applied = await new GrantLandingService(prisma, INFLUENCER_GRANT_SLUG).apply({
      fullName: 'متابع الزائدة', phone: `0793${String(STAMP).slice(-6)}`, email: `extra-follower-${STAMP}@test.local`,
      workField: 'الموارد البشرية', influencerCode: `XTRA${STAMP % 100000}`,
    })
    const code = applied.grant!.code!
    const userId = (await auth.register(`extra-buyer-${STAMP}@test.local`, 'Buyer#12345', 'مشتري الزائدة')).userId
    const cohortId = (await prisma.cohort.create({
      data: {
        plans: { create: await approvedTrainerPlan(prisma) }, courseId: 'C-BIZ-101', title: 'شعبة رد الزائدة',
        status: 'open', registrationOpen: true, financialReady: true, price: 200, currency: 'USD', capacity: 20,
        startsAt: new Date(Date.now() + 30 * 86_400_000),
      } as never,
    })).id
    const { orderId } = await commerce.checkout(userId, [cohortId], code)
    const invoice = await prisma.invoice.findFirstOrThrow({ where: { orderId } })
    const a = await commerce.payOrder(orderId, userId, `xg-a-${STAMP}`)
    const b = await commerce.payOrder(orderId, userId, `xg-b-${STAMP}`)
    await paidEvent(`evt_xg_a_${STAMP}`, a.providerRef!, invoice.number)
    await paidEvent(`evt_xg_b_${STAMP}`, b.providerRef!, invoice.number)

    const economics = new CohortEconomicsService(prisma)
    const before = { collected: (await economics.collected([cohortId])).get(cohortId), st: await influencers.statement(inf) }
    expect(before.st.totals.earned).toBeGreaterThan(0)

    const r = await commerce.requestRefund(b.id, finance, { amount: Number(b.amount), reason: REASON })
    await commerce.processRefund(r.id, finance, true)

    expect((await economics.collected([cohortId])).get(cohortId), 'رد الزائدة نقص ما حصلته الشعبة — أجر المدرب').toBe(before.collected)
    const after = await influencers.statement(inf)
    expect(after.totals.earned, 'رد الزائدة نقص عمولة المؤثر').toBe(before.st.totals.earned)
  })
})

describe('② دفعة بتحويل بنكي وStripe مفعل', () => {
  it('⚠️ ترد يدويا — لا يسأل Stripe عنها', async () => {
    const { invoice } = await order('bank')
    const p = await commerce.recordManualPayment(invoice.id, finance, { methodNote: 'تحويل بنكي' })
    const r = await commerce.requestRefund(p.id, finance, { amount: 50, reason: REASON })
    stripeCalls.length = 0
    await commerce.processRefund(r.id, finance, true)
    expect(stripeCalls, 'طلب رد تحويل بنكي من Stripe').toEqual([])
    expect((await prisma.refund.findUniqueOrThrow({ where: { id: r.id } })).status).toBe('processed')
  })
})

describe('③ دفعة ببطاقة والقناة موقوفة', () => {
  it('⚠️ لا يقيد ردها ولا يقال للمتعلم «رد إليك» — ويقال لماذا', async () => {
    const { userId, orderId, invoice } = await order('card-off')
    const a = await commerce.payOrder(orderId, userId, `off-${STAMP}`)
    await paidEvent(`evt_off_${STAMP}`, a.providerRef!, invoice.number)
    const r = await commerce.requestRefund(a.id, finance, { amount: 50, reason: REASON })
    await stripe(false)

    await expect(commerce.processRefund(r.id, finance, true)).rejects.toMatchObject({ code: 'refund_provider_off', status: 409 })
    expect((await prisma.refund.findUniqueOrThrow({ where: { id: r.id } })).status, 'قيد رد لم يصل البطاقة').toBe('pending')
    expect(await prisma.notification.count({ where: { userId, templateKey: 'payment.refunded' } }), 'قيل له رد إليك').toBe(0)

    /* وبعد تفعيله يرد عند Stripe */
    await stripe(true)
    await commerce.processRefund(r.id, finance, true)
    expect(stripeCalls.some((u) => u.endsWith('/v1/refunds'))).toBe(true)
  })
})

describe('④ نقرتان على «تسجيل دفعة يدوية»', () => {
  it('⚠️ تسجل إحداهما وترد الأخرى', async () => {
    const { invoice } = await order('manual-twice')
    const out = await Promise.allSettled([
      commerce.recordManualPayment(invoice.id, finance, { methodNote: 'تحويل بنكي 1' }),
      commerce.recordManualPayment(invoice.id, finance, { methodNote: 'تحويل بنكي 2' }),
    ])
    expect(out.filter((x) => x.status === 'fulfilled')).toHaveLength(1)
    expect((out.find((x) => x.status === 'rejected') as PromiseRejectedResult).reason).toMatchObject({ code: 'already_paid' })
    expect(await prisma.payment.count({ where: { invoiceId: invoice.id, status: 'succeeded' } }), 'دفعتان لفاتورة واحدة').toBe(1)
  })
})
