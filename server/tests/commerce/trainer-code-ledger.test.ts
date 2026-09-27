/* كودُ المدرّب ودفترُه — الحلقةُ كاملةً في الخادم (المرحلة ٤أ).

   قرارُ صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦): كودٌ بنسبةٍ على دوراته وحدَها، سقفُه
   ٣٠٪، يُحسم ما منحه من مستحقّاته — «والطلبُ المهجورُ لا يحرق الكود، والردُّ
   يعكس الحسم». والقواعدُ المحضة في `src/tests/trainer/trainer-code.test.ts`
   و`src/tests/commerce/scoped-coupon.test.ts`؛ وهنا **أنّ المالَ يتحرّك فعلا**:

   ① الكودُ يقع على دورته وحدَها في السلّة، ويُردّ حيث لا دورةَ له.
   ② يُحجز مع الطلب، ولا يصير دَينا عليه إلّا حين يُدفع.
   ③ مرّةً لكلّ متعلّم — والقيدُ في القاعدة لا في الفحص وحدَه.
   ④ الطلبُ المهجورُ لا يحرقه، ولا يمرّ شراءان متزامنان على آخر استعمال.
   ⑤ الكشفُ يحسمه بندا باسمه، وإلغاءُ الكشف يُعيده إلى الانتظار.
   ⑥ والردُّ بعد الحسم يُعيد إليه ما حُسم بقدر ما رُدّ.
   ⑦ والردُّ قبل الحسم ينقص ما يُحسم.
   ⑧ والخصمُ القديمُ بالمبلغ: الإلغاءُ لا يحرقه، والردُّ يُسقطه، وإلغاءُ الكشف يُعيده.
   ⑨ ولا يُقبل الكودُ في موافقة الطلبات — لا نطاقَ فيها ولا دفتر.
   ⓪ والسقفُ (٣٠٪) قيدٌ في القاعدة لا في الشاشة وحدَها. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { EarningsService } from '../../services/earnings.service'
import { reclaimAbandonedOrders } from '../../worker/jobs'
import { reserveCouponUse } from '../../services/commerce/coupon-ledger'

let prisma: PrismaClient
let auth: AuthService
let commerce: CommerceService
let earnings: EarningsService
let adminId = ''
let profileA = ''
let profileB = ''
const cohort: Record<string, string> = {}
const STAMP = Date.now()

async function trainer(tag: string) {
  const user = await prisma.user.create({ data: { email: `tcl-${tag}-${STAMP}@wajeez.test`, displayName: `مدرّب ${tag}`, passwordHash: 'x' } })
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-TCL-${tag}-${STAMP}`, fullName: `مدرّب ${tag}`, email: user.email, status: 'active' },
  })
  return (await prisma.trainerProfile.create({ data: { userId: user.id, applicationId: application.id } })).id
}

async function openCohort(key: string, courseId: string, price: number, lead: string) {
  const c = await prisma.cohort.create({
    data: {
      courseId, title: `شعبة ${key}`, status: 'open', registrationOpen: true,
      financialReady: true, price, currency: 'USD', capacity: 20,
    },
  })
  await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId: lead, role: 'lead', assignedBy: adminId } })
  cohort[key] = c.id
}

/** كودٌ لمدرّبٍ كما سيُصدره بابُ المدرّب (٤ب): كوبونٌ يفعل الخصم، وصفٌّ يقول من يتحمّله */
async function code(codeText: string, profileId: string, percentOff: number, maxUses: number | null = null) {
  const coupon = await prisma.coupon.create({ data: { code: codeText, percentOff, maxUses, active: true } })
  return prisma.trainerCode.create({ data: { profileId, couponId: coupon.id, percentOff, labelAr: `جمهور ${codeText}` } })
}

const learner = async (tag: string) => (await auth.register(`tcl-l-${tag}-${STAMP}@test.local`, 'Learner#12345', `متعلّم ${tag}`)).userId

async function pay(orderId: string) {
  const invoice = await prisma.invoice.findFirstOrThrow({ where: { orderId } })
  if (invoice.status !== 'paid') await commerce.recordManualPayment(invoice.id, adminId, { methodNote: 'تحويل بنكي اختباري' })
}

async function refund(orderId: string, amount: number) {
  const payment = await prisma.payment.findFirstOrThrow({ where: { invoice: { orderId }, status: { in: ['succeeded', 'partially_refunded'] } } })
  const r = await commerce.requestRefund(payment.id, adminId, { amount, reason: 'ردٌّ اختباريٌّ موثَّق' })
  await commerce.processRefund(r.id, adminId, true)
}

const redemptionOf = (orderId: string) => prisma.trainerCodeRedemption.findUniqueOrThrow({ where: { orderId } })
const usedCount = async (codeText: string) => (await prisma.coupon.findUniqueOrThrow({ where: { code: codeText } })).usedCount
const n = (d: unknown) => Number(d)

async function complete(key: string) {
  await prisma.cohort.update({ where: { id: cohort[key] }, data: { status: 'completed', endsAt: new Date() } })
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  commerce = new CommerceService(prisma)
  earnings = new EarningsService(prisma)
  adminId = (await auth.register(`tcl-admin-${STAMP}@test.local`, 'Admin#12345', 'المالية')).userId
  await auth.setRoles(adminId, ['academic_manager'])

  profileA = await trainer('A')
  profileB = await trainer('B')
  const courses = await prisma.course.findMany({ take: 3, select: { id: true }, orderBy: { id: 'asc' } })
  await openCohort('A1', courses[0].id, 100, profileA)
  await openCohort('B1', courses[1].id, 200, profileB)
  await openCohort('A2', courses[2].id, 150, profileA)
  await openCohort('A3', courses[0].id, 100, profileA)
  await openCohort('A4', courses[1].id, 100, profileA)
  /* مئةٌ لكلّ مقعد — فيُقرأ الحسمُ في الكشف بلا حساب */
  await earnings.setRule(adminId, { profileId: profileA, type: 'per_seat', rate: 100 })

  await code(`TC20-${STAMP}`, profileA, 20)
  await code(`TC10-${STAMP}`, profileA, 10, 1)
}, 240_000)

const C20 = () => `TC20-${STAMP}`
const C10 = () => `TC10-${STAMP}`

const state = { l1: '', l1Order: '', l6Order: '' }

describe('كودُ المدرّب — على دوراته، من جيبه، بقدر ما مُنح', () => {
  it('⓪ ⚠️ السقفُ (٣٠٪) في القاعدة — لا يمرّ فوقه كودٌ من أيّ باب', async () => {
    const coupon = await prisma.coupon.create({ data: { code: `TC31-${STAMP}`, percentOff: 31, active: true } })
    await expect(prisma.trainerCode.create({ data: { profileId: profileA, couponId: coupon.id, percentOff: 31, labelAr: 'فوق السقف' } }),
      'قُبل كودٌ فوق الثلاثين').rejects.toThrow()
    await expect(prisma.trainerCode.create({ data: { profileId: profileA, couponId: coupon.id, percentOff: 0, labelAr: 'صفر' } }),
      'قُبل كودٌ بصفر').rejects.toThrow()
    await prisma.coupon.delete({ where: { id: coupon.id } })
  })

  it('① ⚠️ يقع على دورته وحدَها في السلّة — ويُردّ حيث لا دورةَ له', async () => {
    state.l1 = await learner('1')
    const q = await commerce.quote(state.l1, [cohort.A1, cohort.B1], C20())
    /* ٣٠٠ ← الباقةُ ٨٪ = ٢٤ ← ٢٧٦، وحصّةُ دورته منه ٩٢، وعشرون بالمئة منها ١٨٫٤٠ */
    expect(q.couponDiscount, 'الكودُ وقع على دورةِ مدرّبٍ آخر').toBe(18.4)
    expect(q.total).toBe(257.6)
    expect(q.items.find((i) => i.cohortId === cohort.A1)!.couponApplies).toBe(true)
    expect(q.items.find((i) => i.cohortId === cohort.B1)!.couponApplies, 'دورةُ غيره معلَّمةٌ مخصومة').toBe(false)

    await expect(commerce.quote(state.l1, [cohort.B1], C20()), 'قُبل الكودُ على سلّةٍ ليس فيها من دوراته شيء')
      .rejects.toMatchObject({ code: 'code_not_applicable' })

    /* والنسبةُ من صفّ الكود لا من الكوبون: عليه قيدُ السقف (١–٣٠)، والكوبونُ
       عامٌّ يقبل المئة. فكوبونٌ عُدّل من بابٍ آخر لا يرفع ما يُحسم من المدرّب. */
    await prisma.coupon.update({ where: { code: C20() }, data: { percentOff: 90 } })
    const tampered = await commerce.quote(state.l1, [cohort.A1, cohort.B1], C20())
    expect(tampered.couponDiscount, 'سُعّر كودُ المدرّب من الكوبون لا من صفّه').toBe(18.4)
    await prisma.coupon.update({ where: { code: C20() }, data: { percentOff: 20 } })
  })

  it('② ⚠️ يُحجز مع الطلب — ولا يصير دَينا عليه إلّا حين يُدفع', async () => {
    const order = await commerce.checkout(state.l1, [cohort.A1, cohort.B1], C20())
    state.l1Order = order.orderId
    expect(order.total).toBe(257.6)

    const held = await redemptionOf(order.orderId)
    expect(held.status).toBe('held')
    expect(n(held.amount), 'حُفظ في الاستعمال غيرُ ما مُنح').toBe(18.4)
    expect(n(held.owed), 'صار دَينا عليه قبل أن يدفع أحدٌ شيئا').toBe(0)
    expect(n(held.pending)).toBe(0)
    expect(held.profileId).toBe(profileA)
    expect(await usedCount(C20())).toBe(1)

    await pay(order.orderId)
    const paid = await redemptionOf(order.orderId)
    expect(paid.status, 'دُفع الطلبُ ولم يُقيَّد الاستعمال').toBe('paid')
    expect(n(paid.owed)).toBe(18.4)
    expect(n(paid.pending), 'دُفع ولا حسمَ ينتظر').toBe(18.4)
    expect(await prisma.auditEvent.findFirst({ where: { action: 'trainer_code.use', entityId: profileA } })).not.toBeNull()
  })

  it('③ ⚠️ مرّةً لكلّ متعلّم — والقيدُ في القاعدة لا في الفحص وحدَه', async () => {
    await expect(commerce.quote(state.l1, [cohort.A2], C20()), 'استعمله مرّتين')
      .rejects.toMatchObject({ code: 'code_used' })

    /* ونقرتان متزامنتان تتجاوزان الفحصَ المسبق — فالقيدُ الجزئيُّ هو الحارس */
    const trainerCode = await prisma.trainerCode.findFirstOrThrow({ where: { coupon: { code: C20() } } })
    const other = await prisma.order.create({ data: { userId: state.l1, subtotal: 1, total: 1, currency: 'USD' } })
    await expect(prisma.trainerCodeRedemption.create({
      data: { codeId: trainerCode.id, profileId: profileA, orderId: other.id, userId: state.l1, amount: 1, status: 'held' },
    }), 'استعمالان حيّان لمتعلّمٍ واحدٍ بكودٍ واحد').rejects.toMatchObject({ code: 'P2002' })
    await prisma.order.delete({ where: { id: other.id } })
  })

  it('④ ⚠️ الطلبُ المهجورُ لا يحرقه — ولا يمرّ شراءان على آخر استعمال', async () => {
    const l2 = await learner('2')
    const l3 = await learner('3')
    const first = await commerce.checkout(l2, [cohort.A2], C10())
    expect(await usedCount(C10())).toBe(1)
    await expect(commerce.quote(l3, [cohort.A2], C10())).rejects.toMatchObject({ code: 'bad_coupon' })

    /* يُهجَر: بعد ساعةٍ يُلغيه المُشغِّلُ الخلفيّ — فيعود الاستعمال */
    await reclaimAbandonedOrders(prisma, new Date(Date.now() + 2 * 3600_000))
    expect((await prisma.order.findUniqueOrThrow({ where: { id: first.orderId } })).status).toBe('cancelled')
    expect((await redemptionOf(first.orderId)).status, 'أُلغي الطلبُ وبقي الاستعمالُ محجوزا').toBe('released')
    expect(await usedCount(C10()), 'طلبٌ مهجورٌ أحرق الكود').toBe(0)

    /* ويُلغيه صاحبُه — والأثرُ نفسُه */
    const second = await commerce.checkout(l3, [cohort.A2], C10())
    await commerce.cancelOrder(second.orderId, l3)
    expect((await redemptionOf(second.orderId)).status).toBe('released')
    expect(await usedCount(C10()), 'ألغاه صاحبُه وبقي الكودُ محروقا').toBe(0)

    /* ═══ وآخرُ استعمالٍ لا يأخذه اثنان ═══

       الفحصُ المسبقُ (`assertCouponUsable`) يقرأ «بقي استعمال» لكلٍّ من
       شراءين متزامنين. فالحارسُ هو شرطُ الحدّ في كتابة العدّ نفسِها: من سبقه
       غيرُه بين الفحص والكتابة يُردّ. ويُقاس هنا بلا تزامنٍ حقيقيّ — شراءان
       متزامنان يصطدمان قبل الكوبون برقم الفاتورة (`count + 1`)، فلا يبلغ
       الثاني هذا الموضعَ أصلا. فيُصنَع السبقُ صنعا: غيرُه أخذ الاستعمالَ
       الأخير بعد أن فُحص. */
    const l4 = await learner('4')
    const c10 = await prisma.trainerCode.findFirstOrThrow({ where: { coupon: { code: C10() } }, include: { coupon: true } })
    await prisma.coupon.update({ where: { id: c10.couponId }, data: { usedCount: 1 } })
    const late = await prisma.order.create({ data: { userId: l4, subtotal: 150, total: 135, currency: 'USD' } })
    await expect(prisma.$transaction((tx) => reserveCouponUse(tx, {
      couponId: c10.couponId, maxUses: c10.coupon.maxUses, orderId: late.id, userId: l4,
      trainerCode: { id: c10.id, profileId: profileA }, discount: 15, currency: 'USD',
    })), 'أخذ اثنان الاستعمالَ الأخير').rejects.toMatchObject({ code: 'bad_coupon' })
    expect(await usedCount(C10()), 'تجاوز العدُّ حدَّ الكود').toBe(1)
    expect(await prisma.trainerCodeRedemption.findUnique({ where: { orderId: late.id } }), 'حُجز استعمالٌ فوق الحدّ').toBeNull()
    await prisma.order.delete({ where: { id: late.id } })
    await prisma.coupon.update({ where: { id: c10.couponId }, data: { usedCount: 0 } })
  })

  it('⑤ ⚠️ الكشفُ يحسمه بندا باسمه — وإلغاءُ الكشف يُعيده إلى الانتظار', async () => {
    await complete('A1')
    const payout = await earnings.generateForCohort(adminId, cohort.A1)
    const r = await redemptionOf(state.l1Order)
    const item = payout.items.find((i) => i.sourceRef === `trainer_code:${r.id}`)
    expect(item, 'لا بندَ حسمٍ للكود في الكشف').toBeTruthy()
    expect(n(item!.amount)).toBe(-18.4)
    expect(item!.description, 'البندُ لا يقول أيَّ كودٍ حُسم').toContain(C20())
    expect(n(payout.total), 'الصافي لا يقلّ عن الإجماليّ بقدر ما حُسم').toBe(100 - 18.4)
    expect(n(r.pending), 'حُسم وما زال ينتظر — يُحسم مرّتين').toBe(0)

    await earnings.cancel(payout.id, adminId, 'كشفٌ خاطئٌ يُعاد')
    expect(n((await redemptionOf(state.l1Order)).pending), 'أُلغي الكشفُ وضاع الحسم').toBe(18.4)

    const again = await earnings.generateForCohort(adminId, cohort.A1)
    expect(again.items.some((i) => i.sourceRef === `trainer_code:${r.id}`), 'لم يُحسم في الكشف التالي').toBe(true)
    expect(n((await redemptionOf(state.l1Order)).pending)).toBe(0)
  })

  it('⑥ ⚠️ والردُّ بعد الحسم يُعيد إليه ما حُسم بقدر ما رُدّ', async () => {
    await refund(state.l1Order, 128.8)
    let r = await redemptionOf(state.l1Order)
    expect(n(r.owed), 'رُدّ نصفُ الثمن وبقي الحسمُ كاملا').toBe(9.2)
    expect(n(r.pending), 'لا إعادةَ تنتظر عمّا حُسم زيادة').toBe(-9.2)
    expect(r.status).toBe('paid')

    await refund(state.l1Order, 128.8)
    r = await redemptionOf(state.l1Order)
    expect(r.status).toBe('refunded')
    expect(n(r.owed)).toBe(0)
    expect(n(r.pending), 'رُدّ الثمنُ كلُّه ولا يُعاد إليه كلُّ ما حُسم').toBe(-18.4)
    expect(await usedCount(C20()), 'شراءٌ رُدّ ثمنُه كلُّه ما زال يأكل من حدّ الكود').toBe(0)

    /* والإعادةُ في الكشف التالي — ولو كان إجماليُّه صفرا */
    await complete('A3')
    const payout = await earnings.generateForCohort(adminId, cohort.A3)
    const credit = payout.items.find((i) => i.sourceRef === `trainer_code:${r.id}`)
    expect(credit, 'لا بندَ إعادة').toBeTruthy()
    expect(n(credit!.amount)).toBe(18.4)
    expect(n(payout.total)).toBe(18.4)
    expect(n((await redemptionOf(state.l1Order)).pending)).toBe(0)
  })

  it('⑦ ⚠️ والردُّ قبل الحسم ينقص ما يُحسم — لا حسمَ كاملٌ عن شراءٍ رُدّ نصفُه', async () => {
    const l6 = await learner('6')
    const order = await commerce.checkout(l6, [cohort.A2], C20())
    state.l6Order = order.orderId
    expect(order.total, 'عشرون بالمئة من مئةٍ وخمسين').toBe(120)
    await pay(order.orderId)
    await refund(order.orderId, 60)
    const r = await redemptionOf(order.orderId)
    expect(n(r.owed)).toBe(15)
    expect(n(r.pending)).toBe(15)

    await complete('A2')
    const payout = await earnings.generateForCohort(adminId, cohort.A2)
    const item = payout.items.find((i) => i.sourceRef === `trainer_code:${r.id}`)!
    expect(n(item.amount), 'حُسم الخصمُ كاملا عن شراءٍ رُدّ نصفُه').toBe(-15)
    expect(item.description).toContain('بعد ردّ جزءٍ من الثمن')
  })

  it('⑧ ⚠️ والخصمُ القديمُ بالمبلغ: الإلغاءُ لا يحرقه، والردُّ يُسقطه، وإلغاءُ الكشف يُعيده', async () => {
    const legacy = async (codeText: string, amount: number) => {
      const coupon = await prisma.coupon.create({ data: { code: codeText, amountOff: amount, currency: 'USD', maxUses: 1, active: true } })
      return prisma.trainerIssuedDiscount.create({ data: { profileId: profileA, couponId: coupon.id, amount, forWhomAr: 'قديم' } })
    }
    const one = await legacy(`WD-OLD1-${STAMP}`, 10)
    const l7 = await learner('7')
    const abandoned = await commerce.checkout(l7, [cohort.A4], `WD-OLD1-${STAMP}`)
    await commerce.cancelOrder(abandoned.orderId, l7)
    expect(await usedCount(`WD-OLD1-${STAMP}`), 'طلبٌ أُلغي أحرق الخصمَ القديم').toBe(0)

    const l8 = await learner('8')
    const bought = await commerce.checkout(l8, [cohort.A4], `WD-OLD1-${STAMP}`)
    await pay(bought.orderId)
    expect((await prisma.trainerIssuedDiscount.findUniqueOrThrow({ where: { id: one.id } })).status).toBe('used')
    await refund(bought.orderId, 90)
    expect((await prisma.trainerIssuedDiscount.findUniqueOrThrow({ where: { id: one.id } })).status, 'رُدّ الثمنُ كلُّه ويبقى الخصمُ ينتظر الحسم').toBe('refunded')

    const two = await legacy(`WD-OLD2-${STAMP}`, 5)
    const l9 = await learner('9')
    const kept = await commerce.checkout(l9, [cohort.A4], `WD-OLD2-${STAMP}`)
    await pay(kept.orderId)
    await complete('A4')
    const payout = await earnings.generateForCohort(adminId, cohort.A4)
    expect(payout.items.some((i) => i.sourceRef === `trainer_discount:${one.id}`), 'حُسم خصمٌ رُدّ ثمنُ شرائه').toBe(false)
    const settled = await prisma.trainerIssuedDiscount.findUniqueOrThrow({ where: { id: two.id } })
    expect(settled.status).toBe('settled')

    await earnings.cancel(payout.id, adminId, 'كشفٌ يُعاد')
    const back = await prisma.trainerIssuedDiscount.findUniqueOrThrow({ where: { id: two.id } })
    expect(back.status, 'أُلغي الكشفُ وبقي الخصمُ «محسوما» في كشفٍ لن يُصرف').toBe('used')
    expect(back.settledItemId).toBeNull()
  })

  it('⑨ ⚠️ ولا يُقبل الكودُ في موافقة الطلبات — لا نطاقَ فيها ولا دفتر', async () => {
    await openCohort('A5', (await prisma.course.findFirstOrThrow({ select: { id: true } })).id, 100, profileA)
    const l10 = await learner('10')
    const req = await prisma.enrollmentRequest.create({ data: { userId: l10, cohortId: cohort.A5, status: 'pending' } })
    await expect(commerce.approveEnrollmentRequest(req.id, adminId, C20()))
      .rejects.toMatchObject({ code: 'trainer_code_checkout_only' })

    /* وطلبُ الخطّة كذلك — المسلكُ الثاني الذي يحسب الكوبونَ على المجموع الخام */
    const l11 = await learner('11')
    const planId = (await prisma.learnerPlan.create({ data: { userId: l11, nameAr: 'خطّةٌ اختباريّة', status: 'active' } })).id
    await prisma.enrollmentRequest.create({ data: { userId: l11, cohortId: cohort.A5, status: 'pending', planId } })
    await expect(commerce.approvePlanRequests(planId, adminId, C20()))
      .rejects.toMatchObject({ code: 'trainer_code_checkout_only' })
  })
})
