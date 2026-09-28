/* رصيدُ كود المدرّب — يُسقَف بما له عندنا (قرارُ صاحب المنصّة، ٢٨ سبتمبر ٢٠٢٦:
   «capped with the amount he has»).

   القاعدةُ محضةٌ في `src/tests/trainer/trainer-code.test.ts` (⑥)؛ وهنا أنّها
   تُجمع من القاعدة وتقع في موضعها:

   ① **الشراءُ من رصيده**: مقعدٌ يغطّي أجرُه خصمَه يمرّ ولو كان الرصيدُ قبله صفرا —
      وإلّا لم يعمل كودٌ لمدرّبٍ جديدٍ قطّ.
   ② **وما لا يسعه يُردّ في التسعير** بجملةٍ لا تكشف مستحقّاتِ أحد — والسعرُ بلا
      كودٍ باقٍ، ولا يُحجز استعمال.
   ③ **وما تغيّر بين التسعير والطلب يُفحص ثانيةً في المعاملة**: شراءٌ سبقه إلى آخر
      الرصيد يُردّه، ولو مرّ تسعيرُه.
   ④ **وبقفلٍ لكلّ مدرّب**: كودان له على رصيدٍ واحد لا يمرّان معا — ولا يصفّهما
      قفلُ الكوبون، فلكلٍّ كوبونُه.
   ⑤ **وأرقامُه من مصادرها كلِّها** — وما ليس له لا يُعدّ له. */

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { EarningsService } from '../../services/earnings.service'
import { CartService } from '../../services/commerce/cart.service'
import { TrainerCodeBudgetService } from '../../services/trainer-code-budget'
import { reserveCouponUse } from '../../services/commerce/coupon-ledger'
import { CODE_UNAVAILABLE_AR } from '../../../src/application/trainer/trainer-code'

let prisma: PrismaClient
let auth: AuthService
let commerce: CommerceService
let earnings: EarningsService
let budgets: TrainerCodeBudgetService
let adminId = ''
let courseId = ''
const STAMP = Date.now()

async function trainer(tag: string) {
  const user = await prisma.user.create({ data: { email: `tcb-${tag}-${STAMP}@wajeez.test`, displayName: `مدرّب ${tag}`, passwordHash: 'x' } })
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-TCB-${tag}-${STAMP}`, fullName: `مدرّب ${tag}`, email: user.email, status: 'active' },
  })
  return (await prisma.trainerProfile.create({ data: { userId: user.id, applicationId: application.id } })).id
}

async function cohortOf(profileId: string, title: string, status = 'open') {
  const c = await prisma.cohort.create({
    data: {
      courseId, title, status, registrationOpen: status === 'open',
      financialReady: true, price: 100, currency: 'USD', capacity: 20,
    },
  })
  await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead', assignedBy: adminId } })
  return c.id
}

async function code(text: string, profileId: string, percentOff: number) {
  const coupon = await prisma.coupon.create({ data: { code: text, percentOff, active: true } })
  const row = await prisma.trainerCode.create({ data: { profileId, couponId: coupon.id, percentOff, labelAr: `جمهور ${text}` } })
  return { text, id: row.id, couponId: coupon.id }
}

const learner = async (tag: string) => (await auth.register(`tcb-l-${tag}-${STAMP}@test.local`, 'Learner#12345', `متعلّم ${tag}`)).userId
const usedCount = async (text: string) => (await prisma.coupon.findUniqueOrThrow({ where: { code: text } })).usedCount
const remaining = async (profileId: string) => (await budgets.budgetFor(profileId)).remaining

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  commerce = new CommerceService(prisma)
  earnings = new EarningsService(prisma)
  budgets = new TrainerCodeBudgetService(prisma)
  adminId = (await auth.register(`tcb-admin-${STAMP}@test.local`, 'Admin#12345', 'المالية')).userId
  await auth.setRoles(adminId, ['academic_manager'])
  courseId = (await prisma.course.findFirstOrThrow({ select: { id: true } })).id
}, 240_000)

afterEach(() => { vi.restoreAllMocks() })

describe('① الشراءُ من رصيده', () => {
  it('⚠️ مقعدٌ يغطّي أجرُه خصمَه يمرّ — والرصيدُ قبله صفر', async () => {
    const t = await trainer('seat')
    const cohort = await cohortOf(t, 'شعبةُ مدرّبٍ جديد')
    await earnings.setRule(adminId, { profileId: t, type: 'per_seat', rate: 40 })
    const c = await code(`TCB-SEAT-${STAMP}`, t, 30)
    expect(await remaining(t), 'رصيدٌ قبل أيّ مقعد').toBe(0)

    const buyer = await learner('seat')
    /* ثلاثون من مئة، وأجرُ المقعد أربعون: يسعه */
    expect((await commerce.quote(buyer, [cohort], c.text)).couponDiscount).toBe(30)
    const out = await commerce.checkout(buyer, [cohort], c.text)
    expect((await prisma.trainerCodeRedemption.findUniqueOrThrow({ where: { orderId: out.orderId } })).status).toBe('held')
  })

  it('⚠️ ونصيبٌ من الإيراد كذلك — ثمنُ الشراء نفسِه يُعدّ له', async () => {
    const t = await trainer('share')
    const cohort = await cohortOf(t, 'شعبةٌ بنصيبٍ من الإيراد')
    /* أربعون بالمئة من مئة: أربعون، والخصمُ ثلاثون */
    await earnings.setRule(adminId, { profileId: t, type: 'revenue_share', rate: 40 })
    const c = await code(`TCB-SHARE-${STAMP}`, t, 30)
    expect(await remaining(t)).toBe(0)
    expect((await commerce.quote(await learner('share'), [cohort], c.text)).couponDiscount, 'لم يُعدّ ثمنُ الشراء في نصيبه').toBe(30)
  })
})

describe('② وما لا يسعه يُردّ في التسعير', () => {
  it('⚠️ أجرُ مقعدٍ دون الخصم — يُردّ الكودُ بجملةٍ لا تكشف شيئا، والسعرُ بلا كودٍ باقٍ', async () => {
    const t = await trainer('thin')
    const cohort = await cohortOf(t, 'شعبةٌ بأجرٍ قليل')
    await earnings.setRule(adminId, { profileId: t, type: 'per_seat', rate: 20 })
    const c = await code(`TCB-THIN-${STAMP}`, t, 30)
    const buyer = await learner('thin')

    await expect(commerce.quote(buyer, [cohort], c.text), 'وقع كودٌ يزيد خصمُه على ما له')
      .rejects.toMatchObject({ code: 'code_unavailable', status: 409, message: CODE_UNAVAILABLE_AR })
    await expect(commerce.checkout(buyer, [cohort], c.text)).rejects.toMatchObject({ code: 'code_unavailable' })
    expect(await usedCount(c.text), 'حُجز استعمالٌ لكودٍ رُدّ').toBe(0)
    expect(await prisma.order.count({ where: { userId: buyer } }), 'كُتب طلبٌ بكودٍ رُدّ').toBe(0)

    /* والشراءُ بلا كودٍ يمضي بسعره */
    expect((await commerce.quote(buyer, [cohort])).total).toBe(100)
    /* والجملةُ لا تقول «مستحقّات» ولا رقما — المشتري لا يعرف عن المدرّب شيئا */
    expect(CODE_UNAVAILABLE_AR).not.toMatch(/مستحق|رصيد|[0-9٠-٩]/)
  })

  it('⚠️ ومدرّبٌ بلا قاعدة أتعابٍ سارية لا يُتوقَّع له شيء — لا يُبنى رصيدٌ على أجرٍ لم يُتّفق عليه', async () => {
    const t = await trainer('norule')
    const cohort = await cohortOf(t, 'شعبةٌ بلا قاعدة')
    const c = await code(`TCB-NORULE-${STAMP}`, t, 5)
    await expect(commerce.quote(await learner('norule'), [cohort], c.text)).rejects.toMatchObject({ code: 'code_unavailable' })
  })
})

describe('③ ما تغيّر بين التسعير والطلب يُفحص في المعاملة', () => {
  it('⚠️ شراءٌ سبقه إلى آخر الرصيد يُردّه — ولو مرّ تسعيرُه', async () => {
    const t = await trainer('race')
    const cohort = await cohortOf(t, 'شعبةٌ بأجرٍ ثابت')
    /* ثلاثون ثابتةٌ للشعبة، لا يزيدها مقعد: رصيدٌ يسع خصما واحدا */
    await earnings.setRule(adminId, { profileId: t, type: 'fixed_per_cohort', rate: 30 })
    const first = await code(`TCB-R1-${STAMP}`, t, 30)
    const second = await code(`TCB-R2-${STAMP}`, t, 30)
    const [late, early] = [await learner('race-late'), await learner('race-early')]

    /* يُسعَّر طلبُ «المتأخّر» ثمّ يقف قبل معاملته — حتّى يمرّ «المبكّر» كاملا */
    let release!: () => void
    const gate = new Promise<void>((r) => { release = r })
    let priced!: () => void
    const pricedOnce = new Promise<void>((r) => { priced = r })
    const priceFor = CartService.prototype.priceFor
    vi.spyOn(CartService.prototype, 'priceFor').mockImplementation(async function (this: CartService, ...args) {
      const out = await priceFor.apply(this, args)
      if (args[0] === late) { priced(); await gate }
      return out
    })

    const pending = commerce.checkout(late, [cohort], first.text)
    await pricedOnce
    await commerce.checkout(early, [cohort], second.text)
    release()
    await expect(pending, 'مرّ شراءان على رصيدٍ يسع واحدا').rejects.toMatchObject({ code: 'code_unavailable' })
    expect(await usedCount(first.text), 'بقي استعمالُ الطلب المردود محجوزا').toBe(0)
    expect(await remaining(t)).toBe(0)
  })
})

describe('④ وبقفلٍ لكلّ مدرّب', () => {
  it('⚠️ كودان له على رصيدٍ واحد، في معاملتين متزامنتين — يمرّ أحدُهما', async () => {
    const t = await trainer('lock')
    await cohortOf(t, 'شعبةُ القفل')
    await earnings.setRule(adminId, { profileId: t, type: 'fixed_per_cohort', rate: 30 })
    const codes = [await code(`TCB-L1-${STAMP}`, t, 30), await code(`TCB-L2-${STAMP}`, t, 30)]
    const users = [await learner('lock-1'), await learner('lock-2')]
    const orders = await Promise.all(users.map((userId) =>
      prisma.order.create({ data: { userId, subtotal: 100, discount: 30, total: 70, currency: 'USD' } })))

    /* يقرأ الرصيدَ ثمّ يتمهّل قبل أن يحجز — فبلا قفلٍ يقرأ كلاهما «يسع» قبل أن يكتب أحدُهما */
    const cart = new CartService(prisma)
    const results = await Promise.allSettled(codes.map((c, i) => prisma.$transaction((tx) =>
      reserveCouponUse(tx, {
        couponId: c.couponId, maxUses: null, orderId: orders[i].id, userId: users[i],
        trainerCode: { id: c.id, profileId: t }, discount: 30, currency: 'USD',
        budgetCovers: async (locked) => {
          const ok = await cart.codeBudgetCovers(t, [], 30, locked)
          await new Promise((r) => setTimeout(r, 300))
          return ok
        },
      }), { timeout: 15_000 })))

    const refused = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]
    expect(refused.map((r) => (r.reason as { code?: string }).code), 'مرّ الكودان على رصيدٍ يسع واحدا').toEqual(['code_unavailable'])
    expect(await prisma.trainerCodeRedemption.count({ where: { profileId: t, status: 'held' } })).toBe(1)
  })
})

describe('⑤ أرقامُه من مصادرها كلِّها', () => {
  it('⚠️ ما له وما التزم به — كلُّ مصدرٍ يُعدّ، وما ليس له لا يُعدّ', async () => {
    const t = await trainer('sources')
    await earnings.setRule(adminId, { profileId: t, type: 'fixed_per_cohort', rate: 100 })
    const open = await cohortOf(t, 'مفتوحة')
    await cohortOf(t, 'مسودّة', 'draft')
    await cohortOf(t, 'مكتملة', 'completed')
    await cohortOf(t, 'ملغاة', 'cancelled')
    /* مفتوحةٌ واحدةٌ تُتوقَّع: المسودّةُ قد لا تُقدَّم، والمكتملةُ أجرُها كشف، والملغاةُ لا أجرَ لها */
    expect(await budgets.budgetFor(t), 'عُدّت شعبةٌ ليست مفتوحة').toMatchObject({ allowance: 100, committed: 0, remaining: 100 })
    expect(open).toBeTruthy()

    /* كشوفٌ لم تُصرف تُعدّ له، والمصروفُ والملغى لا */
    for (const [status, total] of [['pending', 40], ['approved', 15], ['paid', 500], ['cancelled', 700]] as const) {
      await prisma.trainerPayout.create({ data: { profileId: t, period: '2026-09', status, total } })
    }
    expect((await budgets.budgetFor(t)).allowance, 'عُدّ مصروفٌ أو ملغى').toBe(155)

    /* وما حجزته أكوادُه أو منحته ولم يُحسم يُلتزم به — وما يُعاد إليه له */
    const c = await code(`TCB-SRC-${STAMP}`, t, 10)
    const redemption = async (tag: string, data: { status: string; amount: number; owed: number; pending: number }) => {
      const userId = await learner(`src-${tag}`)
      const order = await prisma.order.create({ data: { userId, subtotal: 100, discount: data.amount, total: 100 - data.amount, currency: 'USD' } })
      await prisma.trainerCodeRedemption.create({ data: { codeId: c.id, profileId: t, orderId: order.id, userId, currency: 'USD', ...data } })
    }
    await redemption('held', { status: 'held', amount: 12, owed: 0, pending: 0 })
    await redemption('paid', { status: 'paid', amount: 9, owed: 9, pending: 9 })
    await redemption('settled', { status: 'paid', amount: 7, owed: 7, pending: 0 })
    await redemption('released', { status: 'released', amount: 50, owed: 0, pending: 0 })
    await redemption('credit', { status: 'refunded', amount: 6, owed: 0, pending: -6 })

    /* والخصمُ القديمُ بالمبلغ: الصالحُ والمستعمَلُ ما لم يُحسم */
    const legacy = async (status: string, amount: number, settled = false) => {
      const coupon = await prisma.coupon.create({ data: { code: `TCB-WD-${status}-${settled}-${STAMP}`, amountOff: amount, currency: 'USD', active: status === 'live' } })
      await prisma.trainerIssuedDiscount.create({
        data: {
          profileId: t, couponId: coupon.id, status, amount, forWhomAr: 'قديم',
          ...(settled ? { settledItemId: '00000000-0000-4000-8000-000000000000', settledAt: new Date() } : {}),
        },
      })
    }
    await legacy('live', 5)
    await legacy('used', 4)
    await legacy('used', 300, true)
    await legacy('revoked', 200)

    const b = await budgets.budgetFor(t)
    expect(b.allowance, 'ما يُعاد إليه لم يُعدّ له').toBe(161)
    /* ١٢ محجوز + ٩ ينتظر الحسم + ٥ قديمٌ صالح + ٤ قديمٌ مستعمَل */
    expect(b.committed, 'مصدرٌ مما التزم به سقط أو زاد').toBe(30)
    expect(b.remaining).toBe(131)
  })

  it('⚠️ وشعبُه بالقاعدة التي يُحتسب بها أجرُها — الإسنادُ حيث لا أصيل، ولا شعبةُ أصيلٍ غيره', async () => {
    const t = await trainer('assign')
    const other = await trainer('assign-other')
    await earnings.setRule(adminId, { profileId: t, type: 'fixed_per_cohort', rate: 25 })
    const bare = async (title: string) => (await prisma.cohort.create({
      data: { courseId, title, status: 'open', registrationOpen: true, financialReady: true, price: 100, currency: 'USD', capacity: 20 },
    })).id
    const assign = (cohortId: string, status = 'active') =>
      prisma.trainerCourseAssignment.create({ data: { profileId: t, courseId, cohortId, status, assignedBy: adminId } })

    /* شعبةٌ بلا أصيلٍ أُسندت إليه: له */
    await assign(await bare('بلا أصيل'))
    /* وشعبةٌ أصيلُها غيرُه ولو أُسندت إليه: لغيره — كما يُحتسب أجرُها */
    await assign(await cohortOf(other, 'أصيلُها غيرُه'))
    /* وإسنادٌ ملغى لا يُحتسب */
    await assign(await bare('إسنادٌ ملغى'), 'cancelled')

    expect((await budgets.budgetFor(t)).allowance, 'شعبُه في الرصيد غيرُ شعبه في الأجر').toBe(25)
  })

  it('⚠️ وشاشتُه تقرأ الرصيدَ نفسَه', async () => {
    const { TrainerCodeService } = await import('../../services/trainer-code.service')
    const t = await trainer('screen')
    const { userId } = await prisma.trainerProfile.findUniqueOrThrow({ where: { id: t }, select: { userId: true } })
    if (!userId) throw new Error('مدرّبٌ بلا مستخدم')
    await earnings.setRule(adminId, { profileId: t, type: 'fixed_per_cohort', rate: 70 })
    await cohortOf(t, 'شعبةُ الشاشة')
    expect((await new TrainerCodeService(prisma).listFor(userId)).budget).toEqual(await budgets.budgetFor(t))
    expect((await budgets.budgetFor(t)).remaining).toBe(70)
  })
})
