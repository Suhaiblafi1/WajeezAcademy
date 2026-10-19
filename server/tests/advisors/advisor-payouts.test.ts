/* كشوفُ عمولة المستشار الشهريّة (١٩ أكتوبر ٢٠٢٦) — قرارُ صاحب المنصّة: «A»، والعلّةُ في رأس
   `advisor-payout.service.ts`.

   ① **كشفٌ للشهر ببندٍ لكلّ دفعةٍ في نوبته** — بنسبته يومَ وُلّد، ولا شيءَ لمن لا نسبةَ له.
   ② **ولا تدخل دفعةٌ كشفين** — ولو وُلّد الشهرُ مرّتين معا، ولا يعيدها كشفُ الشهر التالي.
   ③ **والاستردادُ بندٌ سالبٌ في كشفه** — بالنسبة التي قُبضت بها، والصافي السالبُ ينتظر.
   ④ **ودورتُه: يُعتمد ثمّ يُصرف، أو يُلغى فتعود دفعاتُه** — ولا يعتمد أحدٌ كشفَه.
   ⑤ **وما صُرف وما ينتظر وما لم يدخل كشفا** — في «عمولتي» وفي التقرير.
   ⑥ **والعاملُ يولّد الشهرَ الذي انتهى.** */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { AdvisorService, attributedRevenue } from '../../services/advisor.service'
import { AdvisorPayoutService, lastClosedPeriod } from '../../services/advisor-payout.service'
import { ReportsService } from '../../services/reports.service'
import { runJob } from '../../worker/jobs'

let prisma: PrismaClient
let auth: AuthService
let payouts: AdvisorPayoutService
let financeId = ''
let seq = 0

const DAY = 86_400_000
const now = new Date()
/** منتصفُ الشهر الذي قبل هذا بـ`back` شهرا، ورمزُه */
const month = (back: number) => {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 15))
  return { mid: d, period: d.toISOString().slice(0, 7) }
}
const [P3, P2, P1] = [month(3), month(2), month(1)] // P1 الشهرُ الذي انتهى للتوّ

async function advisor(pct: number | null) {
  const { userId } = await auth.register(`payout-adv-${++seq}@test.local`, 'Advisor#12345', `مستشار الكشف ${seq}`)
  await auth.setRoles(userId, ['advisor'])
  if (pct !== null) await prisma.advisorProfile.create({ data: { userId, commissionPct: pct } })
  return userId
}
/** طالبٌ عند `advisorId` منذ مئتي يوم — بإسنادٍ إداريّ فنوبتُه من يومها */
async function student(advisorId: string) {
  const { userId } = await auth.register(`payout-student-${++seq}@test.local`, 'Client#12345', `طالب ${seq}`)
  const kase = await prisma.advisorCase.create({ data: { clientId: userId, status: 'contacted' } })
  await prisma.advisorAssignment.create({ data: { caseId: kase.id, advisorId, assignedAt: new Date(now.getTime() - 200 * DAY), assignedBy: financeId } })
  return userId
}
async function paid(userId: string, total: number, at: Date) {
  const n = ++seq
  const order = await prisma.order.create({ data: { userId, status: 'paid', subtotal: total, total, currency: 'USD', paidAt: at, createdAt: at } })
  const invoice = await prisma.invoice.create({ data: { number: `WJ-INV-T-${n}`, orderId: order.id, amount: total, status: 'paid', paidAt: at } })
  const payment = await prisma.payment.create({
    data: { invoiceId: invoice.id, provider: 'test', amount: total, status: 'succeeded', idempotencyKey: `payout-test-${n}`, succeededAt: at },
  })
  return { orderId: order.id, paymentId: payment.id, total }
}
async function refund(p: { orderId: string; paymentId: string; total: number }, amount: number, at: Date) {
  await prisma.refund.create({ data: { paymentId: p.paymentId, amount, reason: 'استرداد', status: 'processed', processedAt: at, createdAt: at } })
  await prisma.order.update({ where: { id: p.orderId }, data: { status: amount >= p.total ? 'refunded' : 'partially_refunded' } })
}
const live = (advisorId: string, period: string) =>
  prisma.advisorPayout.findMany({ where: { advisorId, period, status: { not: 'cancelled' } }, include: { items: true } })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  payouts = new AdvisorPayoutService(prisma)
  financeId = (await auth.register('payout-finance@test.local', 'Finance#12345', 'المالية')).userId
  await auth.setRoles(financeId, ['finance'])
}, 240_000)

describe('① كشفُ الشهر ببنوده', () => {
  it('⚠️ بندٌ لكلّ دفعةٍ في نوبته حتّى نهاية الشهر — وبنسبته يومَ وُلّد', async () => {
    const a = await advisor(10)
    const s = await student(a)
    await paid(s, 200, P2.mid)
    await paid(s, 100, P1.mid)
    await paid(s, 999, new Date(now.getTime() - 60_000)) // هذا الشهر — لم ينته
    const other = (await auth.register(`payout-other-${++seq}@test.local`, 'Client#12345', 'ليس طالبه')).userId
    await paid(other, 500, P1.mid)

    await payouts.generate(P1.period, financeId)
    const [p] = await live(a, P1.period)
    expect(p, 'لا كشف').toBeDefined()
    expect(p!.items.map((i) => Number(i.amount)).sort((x, y) => x - y), 'بنودٌ غيرُ ما في نوبته حتّى نهاية الشهر').toEqual([10, 20])
    expect(Number(p!.total)).toBe(30)
    expect(Number(p!.commissionPct)).toBe(10)

    await prisma.advisorProfile.update({ where: { userId: a }, data: { commissionPct: 50 } })
    expect(Number((await prisma.advisorPayout.findUniqueOrThrow({ where: { id: p!.id } })).total), 'غيّرت النسبةُ كشفا وُلّد').toBe(30)
  })

  it('⚠️ ولا كشفَ لمن لا نسبةَ له — ولا لشهرٍ لم ينته', async () => {
    const none = await advisor(null)
    const zero = await advisor(0)
    for (const a of [none, zero]) await paid(await student(a), 100, P1.mid)
    await payouts.generate(P1.period, financeId)
    expect(await prisma.advisorPayout.count({ where: { advisorId: { in: [none, zero] } } })).toBe(0)
    await expect(payouts.generate(now.toISOString().slice(0, 7), financeId)).rejects.toMatchObject({ code: 'period_open' })
  })
})

describe('② لا تدخل دفعةٌ كشفين', () => {
  it('⚠️ دورتان معا لشهرٍ واحد — كشفٌ واحد', async () => {
    const a = await advisor(10)
    await paid(await student(a), 100, P1.mid)
    await Promise.all([payouts.generate(P1.period, financeId), payouts.generate(P1.period, financeId)])
    expect(await live(a, P1.period)).toHaveLength(1)
  })

  it('⚠️ ودورةٌ لم ترَ كشفَ أختها يردّها الفهرسُ — فلا كشفَ ثانيا ولا تسقط', async () => {
    /* السباقُ لا يُضمن بـ`Promise.all` — فتُعمى الدورةُ عن الكشف الحيّ عمدا، فتبلغ الفهرسَ الفريد */
    const a = await advisor(10)
    await paid(await student(a), 100, P1.mid)
    await payouts.generate(P1.period, financeId)
    const blind = prisma.$extends({
      query: { advisorPayout: { findFirst: async () => null }, advisorPayoutItem: { findMany: async () => [] } },
    }) as unknown as PrismaClient
    await expect(new AdvisorPayoutService(blind).generate(P1.period, financeId)).resolves.toBeDefined()
    expect(await live(a, P1.period)).toHaveLength(1)
  })

  it('⚠️ وكشفُ شهرٍ تالٍ لا يعيد ما في كشفٍ قبله — ويأخذ ما فاته', async () => {
    const a = await advisor(10)
    const s = await student(a)
    await paid(s, 100, P3.mid)
    await payouts.generate(P3.period, financeId)
    await paid(s, 40, P2.mid)
    await payouts.generate(P2.period, financeId)
    const [p2] = await live(a, P2.period)
    expect(p2!.items.map((i) => Number(i.base)), 'أعاد كشفُ الشهر التالي دفعةً في كشفٍ قبله').toEqual([40])
  })
})

describe('③ الاستردادُ بندٌ سالبٌ في كشفه', () => {
  it('⚠️ بعد كشفٍ صُرف: يُحسم في التالي بالنسبة التي قُبضت بها', async () => {
    const a = await advisor(10)
    const s = await student(a)
    const first = await paid(s, 200, P3.mid)
    await payouts.generate(P3.period, financeId)
    const [p3] = await live(a, P3.period)
    await payouts.approve(p3!.id, financeId)
    await payouts.markPaid(p3!.id, financeId, 'TR-1')

    await prisma.advisorProfile.update({ where: { userId: a }, data: { commissionPct: 20 } })
    await refund(first, 50, P2.mid)
    await refund(first, 20, P1.mid) // بعد نهاية الشهر — لكشفه هو
    await paid(s, 300, P2.mid)
    await payouts.generate(P2.period, financeId)
    const [p2] = await live(a, P2.period)
    const items = p2!.items.map((i) => [i.kind, Number(i.amount)]).sort()
    expect(items, 'حُسم الاستردادُ بنسبة اليوم، أو لم يُحسم، أو حُسم ما بعد الشهر').toEqual([['commission', 60], ['refund', -5]])
    expect(Number(p2!.total)).toBe(55)

    await paid(s, 100, P1.mid)
    await payouts.generate(P1.period, financeId)
    const [p1] = await live(a, P1.period)
    expect(p1!.items.map((i) => Number(i.amount)).sort((x, y) => x - y), 'أُعيد حسمُ استردادٍ في كشفٍ قبله').toEqual([-2, 20])
  })

  it('⚠️ وصافٍ سالبٌ لا يُولَّد — ينتظر عمولةً تغطّيه', async () => {
    const a = await advisor(10)
    const s = await student(a)
    const first = await paid(s, 100, P3.mid)
    await payouts.generate(P3.period, financeId)
    await refund(first, 100, P2.mid)
    await payouts.generate(P2.period, financeId)
    expect(await live(a, P2.period), 'وُلّد كشفٌ صافيه سالب').toHaveLength(0)

    await paid(s, 500, P1.mid)
    await payouts.generate(P1.period, financeId)
    const [p1] = await live(a, P1.period)
    expect(Number(p1!.total), 'ضاع الحسمُ الذي انتظر').toBe(40)
  })

  it('والدفعةُ المستردّةُ جزئيّا يُحسب ما بقي منها — لا تسقط كلُّها', async () => {
    const a = await advisor(10)
    const p = await paid(await student(a), 100, P2.mid)
    await refund(p, 30, P2.mid)
    expect(await attributedRevenue(prisma, a)).toBe(70)
  })
})

describe('④ يُعتمد ثمّ يُصرف، أو يُلغى فتعود دفعاتُه', () => {
  it('⚠️ لا صرفَ قبل اعتماد، ولا إلغاءَ بعد صرف، ولا يعتمد أحدٌ كشفَه', async () => {
    const a = await advisor(10)
    await paid(await student(a), 100, P1.mid)
    await payouts.generate(P1.period, financeId)
    const [p] = await live(a, P1.period)
    await expect(payouts.markPaid(p!.id, financeId)).rejects.toMatchObject({ code: 'bad_transition' })
    await expect(payouts.approve(p!.id, a)).rejects.toMatchObject({ code: 'own_payout' })
    await payouts.approve(p!.id, financeId)
    await expect(payouts.approve(p!.id, financeId)).rejects.toMatchObject({ code: 'bad_transition' })
    await payouts.markPaid(p!.id, financeId, 'TR-77')
    await expect(payouts.cancel(p!.id, financeId, 'سبب كاف للإلغاء')).rejects.toMatchObject({ code: 'bad_transition' })
    const after = await prisma.advisorPayout.findUniqueOrThrow({ where: { id: p!.id } })
    expect(after).toMatchObject({ status: 'paid', paidRefAr: 'TR-77', paidBy: financeId, approvedBy: financeId })
    for (const action of ['advisor_payout.generate', 'advisor_payout.approve', 'advisor_payout.pay']) {
      expect(await prisma.auditEvent.count({ where: { action, entityId: p!.id } }), `بلا أثر: ${action}`).toBe(1)
    }
  })

  it('⚠️ الإلغاءُ يعيد دفعاتِه — فيُولَّد الشهرُ من جديدٍ بنسبته يومها', async () => {
    const a = await advisor(10)
    await paid(await student(a), 100, P1.mid)
    await payouts.generate(P1.period, financeId)
    const [p] = await live(a, P1.period)
    await expect(payouts.cancel(p!.id, financeId, 'قصير')).rejects.toMatchObject({ code: 'bad_reason' })
    await payouts.cancel(p!.id, financeId, 'النسبة كانت خطأ')
    await prisma.advisorProfile.update({ where: { userId: a }, data: { commissionPct: 15 } })
    await payouts.generate(P1.period, financeId)
    const [again] = await live(a, P1.period)
    expect(again?.id, 'لم يُولَّد من جديد').not.toBe(p!.id)
    expect(Number(again!.total)).toBe(15)
  })

  it('⚠️ ويُبلَّغ المستشارُ في كلّ خطوة — جرسُ مالٍ في بوّابته', async () => {
    const a = await advisor(10)
    await paid(await student(a), 100, P1.mid)
    await payouts.generate(P1.period, financeId)
    const [p] = await live(a, P1.period)
    await payouts.approve(p!.id, financeId)
    await payouts.markPaid(p!.id, financeId)
    const bells = await prisma.notification.findMany({ where: { userId: a, templateKey: 'advisor_payout' } })
    expect(bells.map((b) => b.audience)).toEqual(['staff', 'staff', 'staff'])
  })
})

describe('⑤ ما صُرف وما ينتظر وما لم يدخل كشفا', () => {
  it('⚠️ في «عمولتي» وفي التقرير — والمستحقُّ ما لم يُصرف', async () => {
    const a = await advisor(10)
    const s = await student(a)
    await paid(s, 100, P3.mid)
    await payouts.generate(P3.period, financeId)
    const [p3] = await live(a, P3.period)
    await payouts.approve(p3!.id, financeId)
    await payouts.markPaid(p3!.id, financeId)
    await paid(s, 200, P2.mid)
    await payouts.generate(P2.period, financeId)
    await paid(s, 400, new Date(now.getTime() - 60_000))

    const mine = await new AdvisorService(prisma).myEarnings(a)
    expect(mine).toMatchObject({ paid: 10, awaiting: 20, upcoming: 40, commissionOwed: 60 })
    expect(mine.payouts.map((p) => p.period)).toEqual([P2.period, P3.period])

    const name = (await prisma.user.findUniqueOrThrow({ where: { id: a } })).displayName
    const row = (await new ReportsService(prisma).run('advisor-performance')).rows.find((r) => r.advisor === name)
    expect(row).toMatchObject({ commissionOwed: 60, commissionPaid: 10 })
  })
})

describe('⑥ والعامل', () => {
  it('يولّد الشهرَ الذي انتهى ويسجّل أثرَه', async () => {
    const a = await advisor(10)
    await paid(await student(a), 100, P1.mid)
    const out = await runJob(prisma, 'advisor_payouts')
    expect(out.done).toBeGreaterThanOrEqual(1)
    expect(await live(a, lastClosedPeriod(now))).toHaveLength(1)
    expect(await prisma.auditEvent.findFirst({ where: { action: 'worker.advisor_payouts' } })).not.toBeNull()
  })
})
