/* مراجعةُ مسار الدفع (٤ نوفمبر ٢٠٢٦) — خمسةُ أعطابٍ ثبتت بتجربةٍ على القاعدة، والعلّةُ في مواضعها من `commerce.service.ts`.

   ① **لا يُدفع طلبٌ ملغى** — من فتح «الفواتير» ثمّ عاد بعد أن أُلغي طلبُه دفع عنه، وقد فُكّ مقعدُه وكودُه.
   ② **ولا طلبٌ رُدّ بعضُ ثمنه** — كان يُدفع ثانيةً كاملا.
   ③ **والردُّ يُرسَل إلى المزوّد مرّةً واحدة** — نقرتان على «اعتمد» كانتا ترسلانه مرّتين.
   ④ **ولا يتجاوز ما يُردّ ما دُفع** — طلبا ردٍّ بمئةٍ لكلٍّ منهما على دفعةٍ بمئة كانا يُنفَّذان.
   ⑤ **وآخرُ مقعدٍ لمشترٍ واحد** — مشتريان في اللحظة نفسِها كانا يحجزان مقعدين في شعبةٍ سعتُها واحد. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { approvedTrainerPlan } from '../helpers/approved-trainer'

let prisma: PrismaClient
let auth: AuthService
let commerce: CommerceService
let finance = ''
let pool: string[] = []
let seq = 0
const STAMP = Date.now()

async function cohort(capacity = 20) {
  const id = pool.shift()
  if (!id) throw new Error('نفدت الدوراتُ المنشورة')
  return (await prisma.cohort.create({
    data: {
      plans: { create: await approvedTrainerPlan(prisma) }, courseId: id, title: `شعبة مسار الدفع ${++seq}`,
      status: 'open', registrationOpen: true, financialReady: true, price: 100, currency: 'USD', capacity,
      startsAt: new Date(Date.now() + 30 * 86_400_000),
    } as never,
  })).id
}
const learner = async () => (await auth.register(`pay-race-${++seq}-${STAMP}@test.local`, 'Learner#12345', `مشتر ${seq}`)).userId
async function paid() {
  const u = await learner()
  const o = await commerce.checkout(u, [await cohort()])
  const p = await commerce.payOrder(o.orderId, u, `race-${o.orderId}`)
  return { u, orderId: o.orderId, payment: p }
}
const REASON = 'سبب الاسترداد الموثق'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  commerce = new CommerceService(prisma)
  finance = await learner()
  /* من آخر القائمة — فلا تأخذ دوراتِ ملفّاتٍ أخرى تبدأ من أوّلها */
  pool = (await prisma.course.findMany({ where: { status: 'published' }, select: { id: true }, orderBy: { id: 'desc' } })).map((c) => c.id)
}, 240_000)

describe('① لا يدفع طلب ملغى', () => {
  it('⚠️ يرد بسببه — ولا دفعة ولا تسوية، ويبقى ملغى', async () => {
    const u = await learner()
    const o = await commerce.checkout(u, [await cohort()])
    await commerce.cancelOrder(o.orderId, u)
    await expect(commerce.payOrder(o.orderId, u, `cancelled-${o.orderId}`)).rejects.toMatchObject({ code: 'order_cancelled' })
    const after = await prisma.order.findUniqueOrThrow({ where: { id: o.orderId }, include: { invoice: { include: { payments: true } } } })
    expect(after.status, 'سوي طلب ملغى').toBe('cancelled')
    expect(after.invoice!.payments, 'أنشئت دفعة عن طلب ملغى').toHaveLength(0)
  })
})

describe('② ولا طلب رد بعض ثمنه', () => {
  it('⚠️ لا يدفع ثانية', async () => {
    const { u, orderId, payment } = await paid()
    const r = await commerce.requestRefund(payment.id, finance, { amount: 10, reason: REASON })
    await commerce.processRefund(r.id, finance, true)
    await expect(commerce.payOrder(orderId, u, `again-${orderId}`)).rejects.toMatchObject({ code: 'already_paid' })
    expect(await prisma.payment.count({ where: { invoice: { orderId } } }), 'دفع مرتين').toBe(1)
  })
})

describe('③ والرد يرسل إلى المزود مرة', () => {
  it('⚠️ نقرتان على «اعتمد»: تنفذ إحداهما وترد الأخرى', async () => {
    const { payment } = await paid()
    const r = await commerce.requestRefund(payment.id, finance, { amount: 40, reason: REASON })
    const out = await Promise.allSettled([commerce.processRefund(r.id, finance, true), commerce.processRefund(r.id, finance, true)])
    expect(out.filter((x) => x.status === 'fulfilled'), 'نفذ الرد مرتين').toHaveLength(1)
    expect((out.find((x) => x.status === 'rejected') as PromiseRejectedResult).reason).toMatchObject({ code: 'bad_state' })
    expect(await prisma.auditEvent.count({ where: { action: 'refund.process', entityId: r.id } }), 'أرسل إلى المزود مرتين').toBe(1)
  })
})

describe('④ ولا يتجاوز ما يرد ما دفع', () => {
  it('⚠️ طلب رد ثان فوق ما بقي يرد — والمعلق يعد', async () => {
    const { payment } = await paid()
    await commerce.requestRefund(payment.id, finance, { amount: 100, reason: REASON })
    await expect(commerce.requestRefund(payment.id, finance, { amount: 100, reason: REASON })).rejects.toMatchObject({ code: 'bad_amount' })
  })

  it('⚠️ وعند التنفيذ يفحص ثانية — فلا يقيد رد فوق الدفعة', async () => {
    const { payment } = await paid()
    const a = await commerce.requestRefund(payment.id, finance, { amount: 70, reason: REASON })
    /* طلبٌ قديمٌ كُتب قبل أن يُعدّ المعلَّق — ما زال في القاعدة */
    const b = await prisma.refund.create({ data: { paymentId: payment.id, amount: 70, reason: REASON, requestedBy: finance } })
    await commerce.processRefund(a.id, finance, true)
    await expect(commerce.processRefund(b.id, finance, true)).rejects.toMatchObject({ code: 'bad_amount' })
    const total = (await prisma.refund.findMany({ where: { paymentId: payment.id, status: 'processed' } })).reduce((s, x) => s + Number(x.amount), 0)
    expect(total, 'رد أكثر مما دفع').toBe(70)
  })
})

describe('⑤ وآخر مقعد لمشتر واحد', () => {
  it('⚠️ مشتريان في اللحظة نفسها: يحجز أحدهما ويرد الآخر', async () => {
    const c = await cohort(1)
    const [a, b] = [await learner(), await learner()]
    const out = await Promise.allSettled([commerce.checkout(a, [c]), commerce.checkout(b, [c])])
    expect(out.filter((x) => x.status === 'fulfilled'), 'بيع آخر مقعد مرتين').toHaveLength(1)
    expect((out.find((x) => x.status === 'rejected') as PromiseRejectedResult).reason).toMatchObject({ code: 'capacity_full' })
    expect(await prisma.enrollmentRequest.count({ where: { cohortId: c, status: 'seat_held' } })).toBe(1)
  })
})
