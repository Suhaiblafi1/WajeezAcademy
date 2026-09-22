/* خصمُ المدرّب — الحلقةُ كاملةً في الخادم: يُصدره، فيُستعمَل، فيُحسم منه.

   قرارُ صاحب المنصّة (٢١ سبتمبر ٢٠٢٦): «لا يتحمّل أيّ خصوماتٍ تطرحها
   الأكاديميّةُ من نفسها، ولكن يتحمّل هو أيَّ خصوماتٍ قرّر إعطاءها لأشخاصٍ
   معيّنين من نفسه باستخدام الكود الخاصّ به… لتُخصم من حسابه في مستحقّاتي
   لاحقا». وهو في العقد بندان: 4-9 و4-10.

   ─────────── والمقيسُ هنا ما لا تراه القواعدُ وحدَها ───────────

   `src/tests/trainer/issued-discount.test.ts` يقيس الحسابَ: السقفَ والتسوية.
   وهذا يقيس **أنّ المالَ يتحرّك فعلا في الاتّجاه الصحيح**، وهو ما لا يُثبته
   حسابٌ صحيحٌ في وحدةٍ نقيّة:

   ① الرمزُ يخصم من المشتري حقّا (لا رقمٌ يُعرض ولا يُقتطع).
   ② ولا يُقيَّد مستعمَلا إلّا حين **يُدفع** — لا حين يُنشأ الطلب. وهذا هو
      العطبُ الذي يحسم من مدرّبٍ مالا لم يُقبَض من أحد، ولا يظهر إلّا في
      طلبٍ مهجورٍ أُلغي.
   ③ وخصمُ الأكاديميّة نفسِها لا يمسّ أتعابَه (البند 4-9): كشفُه واحدٌ سواءٌ
      اشترى المتعلّمُ بكوبونِ حملةٍ أو بلا كوبون.
   ④ وما حُسم لا يُحسم ثانيةً في الكشف الذي يليه. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerApplicationService, type AvailabilityInput } from '../../services/trainer-application.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { CommerceService } from '../../services/commerce.service'
import { EarningsService } from '../../services/earnings.service'
import { TrainerDiscountService } from '../../services/trainer-discount.service'
import { makeReadyForApproval } from '../helpers/trainer-ready'

let prisma: PrismaClient
let commerce: CommerceService
let earnings: EarningsService
let discounts: TrainerDiscountService
let adminId = ''
let trainerUserId = ''
let profileId = ''
let cohortId = ''

const phase1 = (email: string, name: string) => ({
  fullName: name, email, country: 'الأردن', timezone: 'Asia/Amman', phoneCountryCode: '+962', phone: '790000004',
  specialties: ['تحليل البيانات والمالية'], domainYears: '8-12' as const, trainingYears: 'formal_teaching',
  trainingLanguages: ['العربية'], deliveryMode: 'both' as const,
  motivation: 'أريد الانضمام إلى وجيز لأنني درّبت فرقا حقيقية في بيئات عمل عربية، وأعرف الفرق بين من يعرف المادة ومن يستطيع تعليمها. سأقدّم للمتعلمين مهمة تطبيقية من واقع عملهم.',
  privacyConsent: true as const, password: 'Trainer#12345',
})

/** مشترٍ جديدٌ يدفع فاتورتَه كاملةً — فالتسويةُ هي اللحظةُ التي تهمّ هنا */
async function buyAndPay(userId: string, couponCode?: string) {
  const order = await commerce.checkout(userId, [cohortId], couponCode)
  const invoice = await prisma.invoice.findFirstOrThrow({ where: { orderId: order.orderId } })
  if (invoice.status !== 'paid') {
    await commerce.recordManualPayment(invoice.id, adminId, { methodNote: 'تحويل بنكي اختباري' })
  }
  return order
}

describe('خصمُ المدرّب — من جيبه لا من إيرادنا', () => {
  beforeAll(async () => {
    await setupTestDb()
    prisma = await testPrisma()
    const auth = new AuthService(prisma)
    const apps = new TrainerApplicationService(prisma)
    const review = new TrainerReviewService(prisma)
    commerce = new CommerceService(prisma)
    earnings = new EarningsService(prisma)
    discounts = new TrainerDiscountService(prisma)

    adminId = (await auth.register('admin-tdisc@test.local', 'Admin#12345', 'المدير')).userId
    await auth.setRoles(adminId, ['academic_manager'])

    const res = await apps.submitPhase1(phase1('trainer-tdisc@test.local', 'مدرب الخصم'))
    await apps.completePhase2(res.reference, res.candidateToken, {
      previousCourses: [], teachableCourseIds: ['C-BIZ-101'],
      availability: { seasons: ['nov_jan'] } as AvailabilityInput, demoConsent: true as const, contact: { channel: 'email' },
    })
    const app = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference: res.reference } })
    await review.decide(app.id, adminId, 'move_to_review')
    await makeReadyForApproval(prisma, app.id, adminId)
    await review.decide(app.id, adminId, 'approve')
    const profile = await prisma.trainerProfile.findUniqueOrThrow({ where: { applicationId: app.id } })
    trainerUserId = app.userId!; profileId = profile.id

    cohortId = (await prisma.cohort.create({
      data: {
        courseId: 'C-BIZ-101', title: 'شعبة الخصم', status: 'open', registrationOpen: true,
        financialReady: true, price: 100, currency: 'USD', capacity: 20,
      },
    })).id
    await prisma.cohortTrainer.create({ data: { cohortId, profileId, role: 'lead', assignedBy: adminId } })
    /* مئةٌ لكلّ مقعدٍ عامّ — رقمٌ يجعل الحسمَ مقروءا في الكشف بلا حساب */
    await earnings.setRule(adminId, { profileId, type: 'per_seat', rate: 100 })
  })

  it('رصيدُه يُبنى ممّا له عندنا — ولا يُصدر فوقه', async () => {
    const budget = await discounts.budgetFor(trainerUserId)
    expect(budget.remaining, 'رصيدٌ بلا شعبةٍ ولا كشف').toBe(0)
    await expect(
      discounts.issue(trainerUserId, { amount: 20, forWhomAr: 'أحمد' }),
    ).rejects.toMatchObject({ code: 'bad_amount' })
  })

  it('ويُصدره حين يكون له متوقَّعٌ من شعبه — والرمزُ يخصم من المشتري فعلا', async () => {
    const auth = new AuthService(prisma)
    /* مشترٍ أوّلُ بلا رمز: يصير للمدرّب متوقَّعٌ فيتّسع رصيدُه */
    const first = (await auth.register('tdisc-buyer-1@test.local', 'Buyer#12345', 'مشترٍ أوّل')).userId
    await buyAndPay(first)

    const budget = await discounts.budgetFor(trainerUserId)
    expect(budget.remaining, 'لم يتّسع رصيدُه بمقعدٍ اشتُري').toBeGreaterThanOrEqual(20)

    const issued = await discounts.issue(trainerUserId, { amount: 20, forWhomAr: 'ابن الجيران' })
    expect(issued.code, 'الرمزُ لا يتميّز عن رمز الدعوة').toMatch(/^WD-/)

    const second = (await auth.register('tdisc-buyer-2@test.local', 'Buyer#12345', 'مشترٍ ثانٍ')).userId
    const order = await buyAndPay(second, issued.code)
    expect(order.total, 'الرمزُ عُرض ولم يُقتطع').toBe(80)

    const row = await prisma.trainerIssuedDiscount.findUniqueOrThrow({ where: { id: issued.id } })
    expect(row.status, 'الخصمُ دُفع ولم يُقيَّد مستعمَلا').toBe('used')
    expect(row.usedOrderId).toBe(order.orderId)
  })

  /* ② العطبُ الذي يحسم مالا لم يُقبَض: طلبٌ يُنشأ ثمّ يُهجَر */
  it('ولا يُقيَّد مستعمَلا بإنشاء طلبٍ لم يُدفَع', async () => {
    const auth = new AuthService(prisma)
    const issued = await discounts.issue(trainerUserId, { amount: 10, forWhomAr: 'من لم يدفع' })
    const buyer = (await auth.register('tdisc-buyer-3@test.local', 'Buyer#12345', 'مشترٍ ثالث')).userId
    const order = await commerce.checkout(buyer, [cohortId], issued.code)
    const invoice = await prisma.invoice.findFirstOrThrow({ where: { orderId: order.orderId } })

    /* في بيئةٍ بمزوّدٍ اختباريٍّ تُسوَّى الفاتورةُ فورا — وحينها لا معنى
       للقياس. والحارسُ يقيس ما يخصّه: قبل الدفع لا يُقيَّد. */
    if (invoice.status === 'paid') return

    const row = await prisma.trainerIssuedDiscount.findUniqueOrThrow({ where: { id: issued.id } })
    expect(row.status, 'قُيّد مستعمَلا وما دفع أحدٌ شيئا').toBe('live')
    expect(row.usedAt).toBeNull()
  })

  it('وما لم يُستعمَل يُلغى، وما استُعمل لا يُلغى — فالمالُ نقص فعلا', async () => {
    const live = await discounts.issue(trainerUserId, { amount: 5, forWhomAr: 'من سيُلغى له' })
    await discounts.revoke(trainerUserId, live.id)
    const after = await prisma.trainerIssuedDiscount.findUniqueOrThrow({ where: { id: live.id } })
    expect(after.status).toBe('revoked')
    /* والكوبونُ يُطفأ معه — وإلّا بقي رمزٌ يخصم وصفٌّ يقول إنّه ملغى */
    const coupon = await prisma.coupon.findUniqueOrThrow({ where: { id: after.couponId } })
    expect(coupon.active, 'كوبونٌ يعمل تحت خصمٍ ملغى').toBe(false)

    const used = await prisma.trainerIssuedDiscount.findFirstOrThrow({ where: { profileId, status: 'used' } })
    await expect(discounts.revoke(trainerUserId, used.id)).rejects.toMatchObject({ code: 'bad_state' })
  })

  it('والكشفُ يحمل بندَ حسمٍ باسمه، والصافي أقلُّ من الإجماليّ بقدره', async () => {
    const before = await earnings.computeCohort(cohortId)
    const awaiting = await prisma.trainerIssuedDiscount.findMany({ where: { profileId, status: 'used', settledItemId: null } })
    const owed = awaiting.reduce((s, d) => s + Number(d.amount), 0)
    expect(owed, 'لا خصمَ ينتظر الحسمَ أصلا').toBeGreaterThan(0)

    await prisma.cohort.update({ where: { id: cohortId }, data: { status: 'completed', endsAt: new Date() } })
    const payout = await earnings.generateForCohort(adminId, cohortId)

    const deduction = payout.items.filter((i) => i.sourceRef?.startsWith('trainer_discount:'))
    expect(deduction.length, 'لا بندَ حسمٍ في الكشف').toBeGreaterThan(0)
    for (const d of deduction) {
      expect(Number(d.amount), 'بندُ الحسم موجبٌ فيزيد الكشفَ بدل أن ينقصه').toBeLessThan(0)
      expect(d.description, 'البندُ لا يقول لمن صدر').toMatch(/حسم خصم/)
    }
    expect(Number(payout.total), 'الصافي لا يقلّ عن الإجماليّ بقدر ما حُسم')
      .toBe(before.total - owed)

    /* ④ وما حُسم لا يُحسم ثانيةً: الوسمُ يقع مع الكشف لا بعده */
    const settled = await prisma.trainerIssuedDiscount.findMany({ where: { profileId, status: 'settled' } })
    expect(settled.length).toBe(awaiting.length)
    for (const s of settled) expect(s.settledItemId, 'حُسم بلا بندٍ يشير إليه').toBeTruthy()
    const stillPending = await prisma.trainerIssuedDiscount.findMany({ where: { profileId, status: 'used', settledItemId: null } })
    expect(stillPending, 'خصمٌ حُسم وما زال ينتظر — يُحسم مرّتين').toHaveLength(0)
  })

  /* ③ البند 4-9: خصمُ الأكاديميّة لا يمسّ أتعابَه */
  it('وخصمُ الأكاديميّة نفسِها لا يُنقص أتعابَه بشيء', async () => {
    const auth = new AuthService(prisma)
    const other = (await prisma.cohort.create({
      data: {
        courseId: 'C-BIZ-101', title: 'شعبة خصم الأكاديمية', status: 'open', registrationOpen: true,
        financialReady: true, price: 100, currency: 'USD', capacity: 20,
      },
    })).id
    await prisma.cohortTrainer.create({ data: { cohortId: other, profileId, role: 'lead', assignedBy: adminId } })

    /* كوبونُ حملةٍ من عندنا — لا يخصّ مدرّبا ولا يُقابله صفٌّ في جدول خصومه */
    await prisma.coupon.create({
      data: { code: 'ACADEMY40', amountOff: 40, currency: 'USD', maxUses: 5, active: true },
    })
    const buyer = (await auth.register('tdisc-buyer-4@test.local', 'Buyer#12345', 'مشترٍ رابع')).userId
    const order = await commerce.checkout(buyer, [other], 'ACADEMY40')
    expect(order.total, 'كوبونُ الحملة لم يُقتطع').toBe(60)
    const invoice = await prisma.invoice.findFirstOrThrow({ where: { orderId: order.orderId } })
    if (invoice.status !== 'paid') {
      await commerce.recordManualPayment(invoice.id, adminId, { methodNote: 'تحويل بنكي اختباري' })
    }

    const computed = await earnings.computeCohort(other)
    expect(computed.total, 'نقصت أتعابُ المدرّب بخصمٍ طرحته الأكاديميّةُ من عندها').toBe(100)
    /* ولا صفَّ خصمٍ نشأ لمدرّبٍ من كوبونِ حملة */
    const spawned = await prisma.trainerIssuedDiscount.findFirst({ where: { coupon: { code: 'ACADEMY40' } } })
    expect(spawned, 'كوبونُ حملةٍ صار خصما على مدرّب').toBeNull()
  })
})
