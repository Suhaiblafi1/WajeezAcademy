/* خدمة التجارة — طلب تسجيل → حجز مقعد → طلب → فاتورة → دفعة → تسجيل فعلي.
   وضع اختبار فقط حتى قرار المالك بالمزود؛ الدفع اليدوي بصلاحية مالية موثقة؛
   webhook موقَّت وidempotent؛ رجوع المتصفح ليس دليل دفع أبدا. */

import { randomUUID } from 'node:crypto'
import type { PrismaClient, Prisma } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { EnrollmentService } from './enrollment.service'
import { getPaymentProvider, verifyPaymentWebhook } from './payments/provider'

const num = (d: Prisma.Decimal | number | null | undefined) => Number(d ?? 0)

export class CommerceService {
  private prisma: PrismaClient
  private enrollments: EnrollmentService
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.enrollments = new EnrollmentService(prisma)
  }

  /* ── طلب التسجيل وحجز المقعد ── */

  async requestEnrollment(userId: string, cohortId: string, note?: string) {
    const cohort = await this.prisma.cohort.findUnique({ where: { id: cohortId } })
    if (!cohort) throw new AuthError('not_found', 'الشعبة غير موجودة', 404)
    if (!['open', 'full'].includes(cohort.status) || !cohort.registrationOpen) {
      throw new AuthError('closed', 'التسجيل في هذه الشعبة غير مفتوح حاليا', 409)
    }
    const existing = await this.prisma.enrollmentRequest.findUnique({ where: { userId_cohortId: { userId, cohortId } } })
    if (existing && !['rejected', 'cancelled'].includes(existing.status)) {
      throw new AuthError('already_requested', 'لديك طلب قائم لهذه الشعبة', 409)
    }
    const req = existing
      ? await this.prisma.enrollmentRequest.update({ where: { id: existing.id }, data: { status: 'pending', note, decidedBy: null, decidedAt: null } })
      : await this.prisma.enrollmentRequest.create({ data: { userId, cohortId, note } })
    await recordAudit(this.prisma, { actorId: userId, action: 'enrollment_request.create', entityType: 'enrollment_request', entityId: req.id, meta: { cohortId } })
    return req
  }

  async listEnrollmentRequests(status?: string) {
    return this.prisma.enrollmentRequest.findMany({
      where: status ? { status } : undefined,
      include: {
        user: { select: { displayName: true, email: true } },
        cohort: { include: { course: { include: { versions: { orderBy: { version: 'desc' }, take: 1 } } } } },
      },
      orderBy: { createdAt: 'asc' },
    })
  }

  /** موافقة العمليات: حجز مقعد + إنشاء طلب وفاتورة بسعر الشعبة — لا تسجيل فعليا قبل الدفع */
  async approveEnrollmentRequest(requestId: string, actorId: string, couponCode?: string) {
    const req = await this.prisma.enrollmentRequest.findUnique({
      where: { id: requestId },
      include: { cohort: { include: { course: { include: { versions: { orderBy: { version: 'desc' }, take: 1 } } } } } },
    })
    if (!req) throw new AuthError('not_found', 'الطلب غير موجود', 404)
    if (req.status !== 'pending') throw new AuthError('bad_state', 'الطلب ليس بانتظار المراجعة', 409)
    if (req.cohort.price === null) throw new AuthError('no_price', 'سعر الشعبة غير محدد — أكمل الإعداد المالي أولا', 409)

    /* حجز المقعد: المقاعد المحجوزة + المسجلة لا تتجاوز السعة */
    if (req.cohort.capacity) {
      const [enrolled, held] = await Promise.all([
        this.prisma.enrollment.count({ where: { cohortId: req.cohortId, status: 'enrolled' } }),
        this.prisma.enrollmentRequest.count({ where: { cohortId: req.cohortId, status: 'seat_held' } }),
      ])
      if (enrolled + held >= req.cohort.capacity) {
        throw new AuthError('capacity_full', 'لا مقاعد متاحة — المقاعد محجوزة أو مسجلة بالكامل', 409)
      }
    }

    /* الكوبون */
    let discount = 0
    let couponId: string | undefined
    if (couponCode) {
      const coupon = await this.prisma.coupon.findUnique({ where: { code: couponCode.trim().toUpperCase() } })
      if (!coupon || !coupon.active) throw new AuthError('bad_coupon', 'الكوبون غير صالح')
      if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new AuthError('bad_coupon', 'الكوبون منتهي')
      if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) throw new AuthError('bad_coupon', 'استنفد الكوبون عدد استخداماته')
      const price = num(req.cohort.price)
      discount = coupon.percentOff ? Math.round(price * coupon.percentOff / 100 * 100) / 100 : num(coupon.amountOff)
      if (discount > price) discount = price
      couponId = coupon.id
    }

    const subtotal = num(req.cohort.price)
    const total = Math.max(0, subtotal - discount)
    const title = req.cohort.course.versions[0]?.titleAr ?? req.cohort.title

    const order = await this.prisma.$transaction(async (tx) => {
      const o = await tx.order.create({
        data: {
          userId: req.userId, subtotal, discount, total, currency: req.cohort.currency, couponId,
          items: { create: [{ kind: 'cohort', refId: req.cohortId, titleAr: `${title} — ${req.cohort.title}`, unitPrice: subtotal }] },
        },
      })
      const count = await tx.invoice.count()
      const year = new Date().getFullYear()
      await tx.invoice.create({
        data: { number: `WJ-INV-${year}-${String(count + 1).padStart(5, '0')}`, orderId: o.id, amount: total, currency: req.cohort.currency },
      })
      if (couponId) await tx.coupon.update({ where: { id: couponId }, data: { usedCount: { increment: 1 } } })
      await tx.enrollmentRequest.update({
        where: { id: requestId }, data: { status: 'seat_held', orderId: o.id, decidedBy: actorId, decidedAt: new Date() },
      })
      return o
    })
    await recordAudit(this.prisma, {
      actorId, action: 'enrollment_request.approve', entityType: 'enrollment_request', entityId: requestId,
      meta: { orderId: order.id, total, discount },
    })
    return order
  }

  async rejectEnrollmentRequest(requestId: string, actorId: string, reason: string) {
    if (reason.trim().length < 5) throw new AuthError('no_reason', 'الرفض يتطلب سببا يفهمه المتعلم')
    const req = await this.prisma.enrollmentRequest.findUnique({ where: { id: requestId } })
    if (!req || req.status !== 'pending') throw new AuthError('bad_state', 'الطلب ليس بانتظار المراجعة', 409)
    const updated = await this.prisma.enrollmentRequest.update({
      where: { id: requestId }, data: { status: 'rejected', note: reason, decidedBy: actorId, decidedAt: new Date() },
    })
    await recordAudit(this.prisma, { actorId, action: 'enrollment_request.reject', entityType: 'enrollment_request', entityId: requestId, reason })
    return updated
  }

  /* ── الدفع ── */

  /** دفع اختباري عبر المزود — idempotent بمفتاح العميل */
  async payOrderTest(orderId: string, userId: string, idempotencyKey: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { invoice: true } })
    if (!order || order.userId !== userId) throw new AuthError('not_found', 'الطلب غير موجود', 404)
    if (order.status === 'paid') {
      const paid = await this.prisma.payment.findFirst({ where: { idempotencyKey } })
      if (paid) return paid
      throw new AuthError('already_paid', 'الطلب مدفوع مسبقا', 409)
    }
    if (!order.invoice) throw new AuthError('no_invoice', 'لا فاتورة لهذا الطلب', 409)

    const existing = await this.prisma.payment.findUnique({ where: { idempotencyKey } })
    if (existing) return existing // idempotent — نفس المفتاح يعيد نفس الدفعة

    const provider = getPaymentProvider()
    const charge = await provider.createCharge({
      invoiceNumber: order.invoice.number, amount: num(order.total),
      currency: order.currency, descriptionAr: `طلب وجيز ${order.id}`,
    })

    const payment = await this.prisma.payment.create({
      data: {
        invoiceId: order.invoice.id, provider: provider.name, amount: num(order.total), currency: order.currency,
        status: charge.status, providerRef: charge.providerRef, idempotencyKey,
        succeededAt: charge.status === 'succeeded' ? new Date() : null,
      },
    })
    if (charge.status === 'succeeded') await this.settleOrder(orderId, null)
    await recordAudit(this.prisma, {
      actorId: userId, action: 'payment.test_charge', entityType: 'payment', entityId: payment.id,
      meta: { orderId, providerRef: charge.providerRef },
    })
    return payment
  }

  /** دفعة يدوية — صلاحية مالية مستقلة (تحويل بنكي/كاش) */
  async recordManualPayment(invoiceId: string, actorId: string, input: { methodNote: string; amount?: number }) {
    if (input.methodNote.trim().length < 3) throw new AuthError('no_method', 'اذكر طريقة الدفع اليدوي')
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId }, include: { order: true } })
    if (!invoice) throw new AuthError('not_found', 'الفاتورة غير موجودة', 404)
    if (invoice.status === 'paid') throw new AuthError('already_paid', 'الفاتورة مدفوعة مسبقا', 409)
    const amount = input.amount ?? num(invoice.amount)
    if (amount !== num(invoice.amount)) throw new AuthError('amount_mismatch', 'الدفعة اليدوية يجب أن تطابق قيمة الفاتورة')

    const payment = await this.prisma.payment.create({
      data: {
        invoiceId, provider: 'manual', amount, currency: invoice.currency,
        status: 'succeeded', methodNote: input.methodNote, recordedBy: actorId,
        idempotencyKey: `manual-${invoiceId}-${randomUUID()}`, succeededAt: new Date(),
      },
    })
    await this.settleOrder(invoice.orderId, actorId)
    await recordAudit(this.prisma, {
      actorId, action: 'payment.record_manual', entityType: 'payment', entityId: payment.id,
      meta: { invoiceNumber: invoice.number, amount }, reason: input.methodNote,
    })
    return payment
  }

  /** webhook مزود الدفع — موقَّت وidempotent؛ الحدث المكرر يُتجاهل بصمت */
  async handleWebhook(provider: string, rawBody: string, signature: string) {
    if (!verifyPaymentWebhook(rawBody, signature)) {
      throw new AuthError('bad_signature', 'توقيع الحدث غير صالح', 401)
    }
    const payload = JSON.parse(rawBody) as { eventId?: string; invoiceNumber?: string; status?: string; providerRef?: string }
    if (!payload.eventId) throw new AuthError('bad_payload', 'الحدث بلا معرف')

    const seen = await this.prisma.paymentWebhookEvent.findUnique({
      where: { provider_eventId: { provider, eventId: payload.eventId } },
    })
    if (seen) return { duplicate: true } // idempotency — لا أثر مزدوج

    await this.prisma.paymentWebhookEvent.create({ data: { provider, eventId: payload.eventId, payload: payload as object } })

    if (payload.status === 'succeeded' && payload.invoiceNumber) {
      const invoice = await this.prisma.invoice.findUnique({ where: { number: payload.invoiceNumber } })
      if (invoice && invoice.status !== 'paid') {
        await this.prisma.payment.create({
          data: {
            invoiceId: invoice.id, provider, amount: num(invoice.amount), currency: invoice.currency,
            status: 'succeeded', providerRef: payload.providerRef, idempotencyKey: `wh-${provider}-${payload.eventId}`,
            succeededAt: new Date(),
          },
        })
        await this.settleOrder(invoice.orderId, null)
      }
    }
    await this.prisma.paymentWebhookEvent.update({
      where: { provider_eventId: { provider, eventId: payload.eventId } }, data: { processedAt: new Date() },
    })
    await recordAudit(this.prisma, { actorId: null, action: 'payment.webhook', entityType: 'payment_webhook_event', entityId: payload.eventId, meta: { provider, status: payload.status } })
    return { duplicate: false }
  }

  /** تسوية الطلب بعد دفع مؤكد — فاتورة مدفوعة + طلب مدفوع + تحويل حجز المقعد إلى تسجيل فعلي */
  private async settleOrder(orderId: string, actorId: string | null) {
    await this.prisma.$transaction(async (tx) => {
      await tx.invoice.update({ where: { orderId }, data: { status: 'paid', paidAt: new Date() } })
      await tx.order.update({ where: { id: orderId }, data: { status: 'paid', paidAt: new Date() } })
    })
    /* تحويل طلب التسجيل المرتبط */
    const req = await this.prisma.enrollmentRequest.findFirst({ where: { orderId, status: 'seat_held' } })
    if (req) {
      try {
        await this.enrollments.enroll(req.cohortId, req.userId, actorId, {})
      } catch (err) {
        /* مسجل مسبقا (مثل إعادة معالجة) — لا يمنع التحويل */
        if (!(err instanceof AuthError && err.code === 'already_enrolled')) throw err
      }
      await this.prisma.enrollmentRequest.update({ where: { id: req.id }, data: { status: 'converted' } })
    }
  }

  /* ── الاسترداد ── */

  async requestRefund(paymentId: string, actorId: string, input: { amount: number; reason: string }) {
    if (input.reason.trim().length < 5) throw new AuthError('no_reason', 'الاسترداد يتطلب سببا موثقا')
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId }, include: { refunds: true } })
    if (!payment || !['succeeded', 'partially_refunded'].includes(payment.status)) {
      throw new AuthError('bad_state', 'لا استرداد إلا لدفعة ناجحة أو مستردة جزئيا', 409)
    }
    const refunded = payment.refunds.filter((r) => r.status === 'processed').reduce((s, r) => s + num(r.amount), 0)
    if (input.amount <= 0 || refunded + input.amount > num(payment.amount)) {
      throw new AuthError('bad_amount', 'مبلغ الاسترداد يتجاوز المتبقي من الدفعة')
    }
    const refund = await this.prisma.refund.create({
      data: { paymentId, amount: input.amount, reason: input.reason, requestedBy: actorId },
    })
    await recordAudit(this.prisma, { actorId, action: 'refund.request', entityType: 'refund', entityId: refund.id, reason: input.reason, meta: { paymentId, amount: input.amount } })
    return refund
  }

  /** تنفيذ الاسترداد — صلاحية مالية؛ يحدّث الدفعة والطلب */
  async processRefund(refundId: string, actorId: string, approve: boolean, note?: string) {
    const refund = await this.prisma.refund.findUnique({ where: { id: refundId }, include: { payment: { include: { invoice: true } } } })
    if (!refund) throw new AuthError('not_found', 'الاسترداد غير موجود', 404)
    if (refund.status !== 'pending') throw new AuthError('bad_state', 'الاسترداد بُت فيه مسبقا', 409)
    if (!approve) {
      const r = await this.prisma.refund.update({ where: { id: refundId }, data: { status: 'rejected', approvedBy: actorId } })
      await recordAudit(this.prisma, { actorId, action: 'refund.reject', entityType: 'refund', entityId: refundId, reason: note })
      return r
    }
    const result = await this.prisma.$transaction(async (tx) => {
      const r = await tx.refund.update({ where: { id: refundId }, data: { status: 'processed', approvedBy: actorId, processedAt: new Date() } })
      const processed = await tx.refund.findMany({ where: { paymentId: refund.paymentId, status: 'processed' } })
      const totalRefunded = processed.reduce((s, x) => s + num(x.amount), 0)
      const fully = totalRefunded >= num(refund.payment.amount)
      await tx.payment.update({ where: { id: refund.paymentId }, data: { status: fully ? 'refunded' : 'partially_refunded' } })
      await tx.order.update({ where: { id: refund.payment.invoice.orderId }, data: { status: fully ? 'refunded' : 'partially_refunded' } })
      return r
    })
    await recordAudit(this.prisma, { actorId, action: 'refund.process', entityType: 'refund', entityId: refundId, meta: { amount: num(refund.amount) } })
    return result
  }

  /* ── الكوبونات وخطط الاشتراك ── */

  async createCoupon(actorId: string, input: { code: string; percentOff?: number; amountOff?: number; currency?: string; maxUses?: number; expiresAt?: Date }) {
    if (!input.percentOff && !input.amountOff) throw new AuthError('bad_coupon', 'حدد نسبة أو مبلغ خصم')
    if (input.percentOff && (input.percentOff < 1 || input.percentOff > 100)) throw new AuthError('bad_coupon', 'نسبة الخصم خارج النطاق')
    const coupon = await this.prisma.coupon.create({
      data: {
        code: input.code.trim().toUpperCase(), percentOff: input.percentOff, amountOff: input.amountOff,
        currency: input.currency, maxUses: input.maxUses, expiresAt: input.expiresAt,
      },
    })
    await recordAudit(this.prisma, { actorId, action: 'coupon.create', entityType: 'coupon', entityId: coupon.id, meta: { code: coupon.code } })
    return coupon
  }

  async listCoupons() {
    return this.prisma.coupon.findMany({ orderBy: { id: 'desc' } })
  }

  async createPlan(actorId: string, input: { code: string; nameAr: string; descriptionAr?: string; price: number; currency?: string; intervalMonths?: number; features?: string[] }) {
    const plan = await this.prisma.subscriptionPlan.create({
      data: {
        code: input.code, nameAr: input.nameAr, descriptionAr: input.descriptionAr, price: input.price,
        currency: input.currency ?? 'JOD', intervalMonths: input.intervalMonths ?? 1, features: (input.features ?? []) as unknown as Prisma.InputJsonValue,
      },
    })
    await recordAudit(this.prisma, { actorId, action: 'plan.create', entityType: 'subscription_plan', entityId: plan.id })
    return plan
  }

  async listPlans(activeOnly = true) {
    return this.prisma.subscriptionPlan.findMany({ where: activeOnly ? { active: true } : undefined })
  }

  /* ── استعلامات المتعلم والمالية ── */

  async myOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId }, include: { items: true, invoice: { include: { payments: { include: { refunds: true } } } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  async listInvoices(status?: string) {
    return this.prisma.invoice.findMany({
      where: status ? { status } : undefined,
      include: { order: { include: { items: true, user: { select: { displayName: true, email: true } } } }, payments: { include: { refunds: true } } },
      orderBy: { issuedAt: 'desc' },
    })
  }

  async listRefunds(status?: string) {
    return this.prisma.refund.findMany({
      where: status ? { status } : undefined,
      include: { payment: { include: { invoice: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }
}
