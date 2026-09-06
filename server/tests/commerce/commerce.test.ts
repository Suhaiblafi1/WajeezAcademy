/* اختبار E2E للتسجيل والمدفوعات:
   طلب تسجيل → موافقة بحجز مقعد + طلب وفاتورة بكوبون → دفع اختباري
   idempotent يحوّل الحجز إلى تسجيل فعلي → دفعة يدوية موثقة →
   webhook موقَّت والمكرر يُتجاهل → استرداد جزئي ثم كامل.
   لا مال حقيقي: المزود الاختباري فقط، ورجوع المتصفح ليس دليل دفع. */

import { createHmac } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'

let prisma: PrismaClient
let auth: AuthService
let commerce: CommerceService
let managerId: string
let learnerId: string
let cohortId: string

const WEBHOOK_SECRET = 'test-webhook-secret'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  commerce = new CommerceService(prisma)
  process.env.PAYMENT_WEBHOOK_SECRET = WEBHOOK_SECRET

  const m = await auth.register('com-manager@test.local', 'Manager#12345', 'مدير مالي')
  managerId = m.userId
  await auth.setRoles(managerId, ['academic_manager'])

  const l = await auth.register('com-learner@test.local', 'Learner#12345', 'متعلم التجارة')
  learnerId = l.userId

  /* شعبة مفتوحة بسعر وسعة — كتالوج الاختبار مستورد مسبقا */
  const cohort = await prisma.cohort.create({
    data: {
      courseId: 'C-BIZ-101', title: 'شعبة التجارة الاختبارية', status: 'open',
      registrationOpen: true, financialReady: true, price: 500, currency: 'JOD', capacity: 5,
    },
  })
  cohortId = cohort.id
}, 240_000)

describe('التسجيل والدفع الاختباري', () => {
  let requestId = ''
  let orderId = ''
  let invoiceId = ''
  let paymentId = ''

  it('1) طلب تسجيل في شعبة مفتوحة — والتكرار ممنوع', async () => {
    const req = await commerce.requestEnrollment(learnerId, cohortId, 'أرغب بالالتحاق')
    requestId = req.id
    expect(req.status).toBe('pending')
    await expect(commerce.requestEnrollment(learnerId, cohortId))
      .rejects.toMatchObject({ code: 'already_requested' })
  })

  it('2) الموافقة بكوبون: حجز مقعد + طلب بخصم + فاتورة مرقمة', async () => {
    await commerce.createCoupon(managerId, { code: 'save10', percentOff: 10 })
    const order = await commerce.approveEnrollmentRequest(requestId, managerId, 'SAVE10')
    orderId = order.id
    expect(Number(order.subtotal)).toBe(500)
    expect(Number(order.discount)).toBe(50)
    expect(Number(order.total)).toBe(450)
    const invoice = await prisma.invoice.findUnique({ where: { orderId } })
    invoiceId = invoice!.id
    expect(invoice!.number).toMatch(/^WJ-INV-\d{4}-\d{5}$/)
    /* ── والمزوّدُ اختباريّ، فالموافقةُ تُسوّي ولا تترك دَينا ──

       كان الفحصُ يشترط `seat_held` و«لا تسجيلَ قبل الدفع» — أي **يحرس أن يبقى
       المتعلّمُ ينظر إلى «بانتظار الدفع» عن مالٍ لا وجودَ له**. ومسارُ موافقة
       العمليّات صحيحٌ مع مزوّدٍ حقيقيّ (يدفع لاحقا)، وفي التجريبيّ لا معنى
       لطلبٍ غيرِ مدفوعٍ إطلاقا: لا صفحةَ دفعٍ يُعاد منها ولا webhook يُسوّيه.

       فصار يشترط ما هو صواب: سُوّي الطلبُ وصار الحجزُ تسجيلا. */
    const req = await prisma.enrollmentRequest.findUnique({ where: { id: requestId } })
    expect(req?.status, 'المزوّدُ اختباريٌّ ولم يُسوَّ الطلب').toBe('converted')
    expect(await prisma.order.findUniqueOrThrow({ where: { id: orderId } }).then((o) => o.status)).toBe('paid')
    expect(await prisma.enrollment.count({ where: { cohortId, userId: learnerId } })).toBe(1)
  })

  it('3) كوبون غير صالح مرفوض عند الموافقة', async () => {
    const l2 = await auth.register('com-learner2@test.local', 'Learner#12345', 'متعلم ثان')
    const req2 = await commerce.requestEnrollment(l2.userId, cohortId)
    await expect(commerce.approveEnrollmentRequest(req2.id, managerId, 'NOPE'))
      .rejects.toMatchObject({ code: 'bad_coupon' })
    await commerce.rejectEnrollmentRequest(req2.id, managerId, 'اختبار الرفض بسبب مفهوم')
  })

  it('4) الدفعُ الاختباريُّ سوّى الطلبَ وحوّل الحجزَ إلى تسجيلٍ فعليّ', async () => {
    const payment = await prisma.payment.findFirstOrThrow({ where: { invoiceId, status: 'succeeded' } })
    paymentId = payment.id
    expect(payment.providerRef).toMatch(/^TEST-/)
    const order = await prisma.order.findUnique({ where: { id: orderId } })
    expect(order?.status).toBe('paid')
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } })
    expect(invoice?.status).toBe('paid')
    const req = await prisma.enrollmentRequest.findUnique({ where: { id: requestId } })
    expect(req?.status).toBe('converted')
    const enrollment = await prisma.enrollment.findUnique({ where: { cohortId_userId: { cohortId, userId: learnerId } } })
    expect(enrollment?.status).toBe('enrolled')
  })

  /* ونداءُ الدفع فوق طلبٍ سُوّي سلفا يعيد دفعتَه لا يرمي.

     كان يردّ ٤٠٩ حين لا يجد دفعةً بمفتاح العميل — فيرى المشتري خطأً على طلبٍ
     **نجح**، ويظنّ أنّ ماله ضاع. والتسويةُ التلقائيّةُ للمزوّد الاختباريّ
     أشهرُ مصادر هذه الحالة. */
  it('5) نداءُ الدفع فوق طلبٍ مسوًّى يعيد دفعتَه — ولا يرمي ولا يُنشئ ثانية', async () => {
    const before = await prisma.payment.count({ where: { invoiceId } })
    const again = await commerce.payOrder(orderId, learnerId, 'idem-key-0001')
    expect(again?.id).toBe(paymentId)
    expect(await prisma.payment.count({ where: { invoiceId } }), 'أُنشئت دفعةٌ ثانية').toBe(before)
  })

  it('6) webhook بلا توقيع صالح مرفوض', async () => {
    await expect(commerce.handleWebhook('stripe', JSON.stringify({ eventId: 'evt_x' }), 'bad'))
      .rejects.toMatchObject({ code: 'bad_signature' })
  })

  it('7) webhook موقَّت يُعالج مرة واحدة — المكرر يُتجاهل', async () => {
    const payload = JSON.stringify({ eventId: 'evt-100', invoiceNumber: 'WJ-INV-XXXX-00000', status: 'failed' })
    const sig = createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex')
    const first = await commerce.handleWebhook('stripe', payload, sig)
    expect(first.duplicate).toBe(false)
    const second = await commerce.handleWebhook('stripe', payload, sig)
    expect(second.duplicate).toBe(true)
  })

  it('8) الدفعة اليدوية: مبلغ مختلف مرفوض، والمطابق يُسجل ويسوّي', async () => {
    /* السائقُ اليدويُّ لا التجريبيّ: التحويلُ البنكيُّ يُسجَّل بيد المالية بعد
       أن يصل فعلا، فالطلبُ يبقى غيرَ مدفوعٍ حتّى تُسجَّل الحوالة — وهذا صحيحٌ
       هنا، بخلاف التجريبيّ الذي لا مالَ فيه ينتظر. */
    await prisma.integrationSetting.upsert({
      where: { provider: 'payment' },
      update: { enabled: true, config: { driver: 'manual' } },
      create: { provider: 'payment', enabled: true, config: { driver: 'manual' } },
    })
    const l3 = await auth.register('com-learner3@test.local', 'Learner#12345', 'متعلم يدوي')
    const req3 = await commerce.requestEnrollment(l3.userId, cohortId)
    const order3 = await commerce.approveEnrollmentRequest(req3.id, managerId)
    const invoice3 = await prisma.invoice.findUnique({ where: { orderId: order3.id } })
    await expect(commerce.recordManualPayment(invoice3!.id, managerId, { methodNote: 'تحويل بنكي', amount: 100 }))
      .rejects.toMatchObject({ code: 'amount_mismatch' })
    const payment = await commerce.recordManualPayment(invoice3!.id, managerId, { methodNote: 'تحويل بنكي — حوالة 123' })
    expect(payment.provider).toBe('manual')
    const req3After = await prisma.enrollmentRequest.findUnique({ where: { id: req3.id } })
    expect(req3After?.status).toBe('converted')
    await prisma.integrationSetting.deleteMany({ where: { provider: 'payment' } })
  })

  it('9) استرداد جزئي ثم كامل — الدفعة والطلب يتحدثان', async () => {
    const partial = await commerce.requestRefund(paymentId, managerId, { amount: 100, reason: 'انسحاب جزئي موثق' })
    await commerce.processRefund(partial.id, managerId, true)
    let payment = await prisma.payment.findUnique({ where: { id: paymentId } })
    expect(payment?.status).toBe('partially_refunded')
    /* المتبقي 350 — الزيادة مرفوضة */
    await expect(commerce.requestRefund(paymentId, managerId, { amount: 400, reason: 'مبلغ يتجاوز المتبقي' }))
      .rejects.toMatchObject({ code: 'bad_amount' })
    const rest = await commerce.requestRefund(paymentId, managerId, { amount: 350, reason: 'استكمال الاسترداد' })
    await commerce.processRefund(rest.id, managerId, true)
    payment = await prisma.payment.findUnique({ where: { id: paymentId } })
    expect(payment?.status).toBe('refunded')
    const order = await prisma.order.findUnique({ where: { id: orderId } })
    expect(order?.status).toBe('refunded')
  })

  it('10) خطط الاشتراك والطلبات تُعرض للمتعلم والمالية', async () => {
    await commerce.createPlan(managerId, { code: 'monthly', nameAr: 'اشتراك شهري', price: 30, features: ['ملخصات الكتب'] })
    expect((await commerce.listPlans()).some((p) => p.code === 'monthly')).toBe(true)
    const mine = await commerce.myOrders(learnerId)
    expect(mine.some((o) => o.id === orderId)).toBe(true)
    const invoices = await commerce.listInvoices('paid')
    expect(invoices.length).toBeGreaterThanOrEqual(1)
  })
})
