/* مراجعةُ مسار المدرّبين (٥ نوفمبر ٢٠٢٦) — عطبان ثبتا بتجربةٍ على القاعدة، والعلّةُ في `earnings.service.ts`.

   ① **نصيبُ الإيراد لا يسقط بردِّ دورةِ غيره** — طلبٌ فيه دورتان لمدرّبَين رُدّ بعضُه صار «مردودا جزئيّا»، فسقط نصيبُ
      الآخر كلُّه: ٤٠ دولارا صارت صفرا. والمردودُ كلُّه وحدَه يُخرجه — كما يقول البند 4-15 في المقاعد.
   ② **والكشفُ يُكتب مرّةً واحدة** — توليدان معا (اكتمالُ الشعبة ويدُ الماليّة) كانا يكتبان للشعبة كشفين.
   ③ **وخصمُ كوده يُحسم مرّةً واحدة** — كشفان لشعبتين له معا كانا يقرآن الدفترَ قبل أن يكتب أحدُهما. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { EarningsService } from '../../services/earnings.service'
import { approvedPlanBy } from '../helpers/approved-trainer'

let prisma: PrismaClient
let auth: AuthService
let earnings: EarningsService
let adminId = ''
let courses: string[] = []
let seq = 0
const STAMP = Date.now()

async function trainer(tag: string) {
  const user = await prisma.user.create({ data: { email: `pr-${tag}-${STAMP}@wajeez.test`, displayName: `مدرب ${tag}`, passwordHash: 'x' } })
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-PR-${tag}-${STAMP}`, fullName: `مدرب ${tag}`, email: user.email, status: 'active' },
  })
  return (await prisma.trainerProfile.create({ data: { userId: user.id, applicationId: application.id } })).id
}
async function cohortOf(profileId: string) {
  const courseId = courses[seq % courses.length]
  const c = await prisma.cohort.create({
    data: {
      plans: { create: approvedPlanBy(profileId) }, courseId, title: `شعبة الكشف ${++seq}`,
      status: 'completed', financialReady: true, price: 100, currency: 'USD', capacity: 20,
    } as never,
  })
  await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead', assignedBy: adminId } })
  return c.id
}
const buyer = async () => (await auth.register(`pr-buyer-${++seq}-${STAMP}@test.local`, 'Learner#12345', `مشتر ${seq}`)).userId

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  earnings = new EarningsService(prisma)
  adminId = (await auth.register(`pr-admin-${STAMP}@test.local`, 'Admin#12345', 'المالية')).userId
  courses = (await prisma.course.findMany({ select: { id: true }, take: 10 })).map((c) => c.id)
}, 240_000)

describe('① نصيب الإيراد لا يسقط برد دورة غيره', () => {
  it('⚠️ طلب فيه دورتان رد بعضه: نصيب كل مدرب باق — والمردود كله يخرجه', async () => {
    const [x, y] = [await trainer('x'), await trainer('y')]
    const [cx, cy] = [await cohortOf(x), await cohortOf(y)]
    await earnings.setRule(adminId, { profileId: x, type: 'revenue_share', rate: 40 })
    const order = await prisma.order.create({
      data: {
        userId: await buyer(), status: 'paid', subtotal: 200, total: 200, currency: 'USD',
        items: { create: [{ kind: 'cohort', refId: cx, titleAr: 'دورة س', unitPrice: 100 }, { kind: 'cohort', refId: cy, titleAr: 'دورة ص', unitPrice: 100 }] },
      },
    })
    expect((await earnings.computeCohort(cx)).total).toBe(40)
    await prisma.order.update({ where: { id: order.id }, data: { status: 'partially_refunded' } })
    expect((await earnings.computeCohort(cx)).total, 'سقط نصيبه برد دورة غيره').toBe(40)
    await prisma.order.update({ where: { id: order.id }, data: { status: 'refunded' } })
    expect((await earnings.computeCohort(cx)).total, 'حسب له طلب رد كله').toBe(0)
  })
})

describe('② والكشف يكتب مرة واحدة', () => {
  it('⚠️ توليدان معا: يمر أحدهما ويرد الآخر', async () => {
    const z = await trainer('z')
    const cz = await cohortOf(z)
    await earnings.setRule(adminId, { profileId: z, type: 'fixed_per_cohort', rate: 500 })
    const out = await Promise.allSettled([earnings.generateForCohort(adminId, cz), earnings.generateForCohort(null, cz)])
    expect(out.filter((r) => r.status === 'fulfilled'), 'كشفان للشعبة').toHaveLength(1)
    expect((out.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason).toMatchObject({ code: 'duplicate_cohort' })
    expect(await prisma.trainerPayout.count({ where: { profileId: z } })).toBe(1)
  })
})

describe('③ وخصم كوده يحسم مرة واحدة', () => {
  it('⚠️ كشفان لشعبتين له معا: يحسم الخصم في أحدهما وحده', async () => {
    const w = await trainer('w')
    const [c1, c2] = [await cohortOf(w), await cohortOf(w)]
    await earnings.setRule(adminId, { profileId: w, type: 'fixed_per_cohort', rate: 300 })
    const coupon = await prisma.coupon.create({ data: { code: `PR-${STAMP}`, percentOff: 20, active: true } })
    const code = await prisma.trainerCode.create({ data: { profileId: w, couponId: coupon.id, percentOff: 20, labelAr: 'جمهور الاختبار' } })
    const order = await prisma.order.create({ data: { userId: await buyer(), status: 'paid', subtotal: 100, total: 80, currency: 'USD' } })
    await prisma.trainerCodeRedemption.create({
      data: { codeId: code.id, profileId: w, orderId: order.id, userId: order.userId, amount: 20, owed: 20, pending: 20, currency: 'USD', status: 'paid', paidAt: new Date() },
    })
    await Promise.all([earnings.generateForCohort(adminId, c1), earnings.generateForCohort(adminId, c2)])
    const deducted = await prisma.trainerPayoutItem.findMany({ where: { payout: { profileId: w }, amount: { lt: 0 } }, select: { amount: true } })
    expect(deducted.map((i) => Number(i.amount)), 'حسم الخصم مرتين').toEqual([-20])
    expect(Number((await prisma.trainerCodeRedemption.findUniqueOrThrow({ where: { orderId: order.id } })).pending)).toBe(0)
  })
})
