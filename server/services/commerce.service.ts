/* خدمة التجارة — طلب تسجيل → حجز مقعد → طلب → فاتورة → دفعة → تسجيل فعلي.
   وضع اختبار فقط حتى قرار المالك بالمزود؛ الدفع اليدوي بصلاحية مالية موثقة؛
   webhook موقَّت وidempotent؛ رجوع المتصفح ليس دليل دفع أبدا. */

import { randomUUID } from 'node:crypto'
import type { PrismaClient, Prisma } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { EnrollmentService } from './enrollment.service'
import { safeNotify, publicSiteUrl } from './notification.service'
import { getPaymentProvider, verifyPaymentWebhook } from './payments/provider'
import { getEmailConfig, getPaymentConfig } from './integrations.service'
import { PlanService } from './plan.service'

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
    /* حاجز توثيق البريد (١هـ). المال والمواعيد والفاتورة كلها تُرسل إلى عنوان
       لم يُثبت أنه يصل صاحبه — فالتوثيق شرطٌ قبل بدء الشراء لا بعده.

       واستثناءٌ واحد مقصود: حين تكون قناة البريد غير مفعّلة أصلا، فالحاجز
       قفلٌ لا مفتاح له — لا أحد يستطيع أن يوثّق فلا أحد يستطيع أن يشتري أبدا.
       وهذا بعينه ما وقع في مسار المدرب فوقف كل متقدّم عند «بانتظار تحقق
       البريد». فيمضي الطلب حينها بأثرٍ صريح يقرؤه المراجع قبل الموافقة، ولا
       يُكتب emailVerifiedAt: لم يتحقّق شيء. */
    const verified = await this.emailVerified(userId)
    if (!verified) {
      const channelUp = await this.emailChannelEnabled()
      if (channelUp) {
        throw new AuthError('email_unverified', 'وثّق بريدك أولا — اطلب رابط التوثيق من الشريط أعلى الصفحة، والشراء يُفتح بمجرّد فتحه', 403)
      }
    }

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
    await recordAudit(this.prisma, {
      actorId: userId, action: 'enrollment_request.create', entityType: 'enrollment_request', entityId: req.id,
      meta: { cohortId, ...(verified ? {} : { emailUnverified: true, reason: 'قناة البريد غير مفعّلة — مرّ الطلب بلا توثيق' }) },
    })
    return req
  }

  /** هل بريد صاحب الطلب موثَّق؟ — قراءةٌ واحدة، والحاجز يقرّر بها */
  private async emailVerified(userId: string): Promise<boolean> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { emailVerifiedAt: true } })
    return u?.emailVerifiedAt != null
  }

  /** هل تستطيع المنصّة إرسال بريد أصلا؟ — بها وحدها يصير الحاجز قفلا له مفتاح */
  private async emailChannelEnabled(): Promise<boolean> {
    const cfg = await getEmailConfig(this.prisma)
    return Boolean(cfg.enabled && cfg.host && cfg.fromEmail)
  }

  /* ── الخطّة كاملةً: طلبٌ واحد، وفاتورةٌ واحدة (التوصيتان ٢ و٣) ── */

  /**
   * يطلب التسجيل في كل دورات الخطّة الفعّالة التي لها شعبة مفتوحة، دفعةً واحدة.
   *
   * قبل هذا لم يكن للخطّة بابٌ على الخادم أصلا: زرُّ الشراء في صفحة المسار
   * يفتح نافذةً تحيل المتعلّم إلى «تصفّح الشعب المفتوحة» فيبدأ اختياره من
   * جديد، دورةً دورة. فالخطّة التي بناها بالتشخيص تموت عند الزر.
   *
   * وما لا شعبة له لا يُسكَت عنه: يعود باسمه في `awaiting` ليُقال للمتعلّم
   * قبل أن يدفع أيّ دورةٍ من خطّته لم تُفتح بعد — لا أن يكتشفها بعد الدفع.
   */
  async requestPlanEnrollment(userId: string) {
    const verified = await this.emailVerified(userId)
    if (!verified && (await this.emailChannelEnabled())) {
      throw new AuthError('email_unverified', 'وثّق بريدك أولا — اطلب رابط التوثيق من الشريط أعلى الصفحة، والشراء يُفتح بمجرّد فتحه', 403)
    }

    const plan = await new PlanService(this.prisma).active(userId)
    if (!plan) throw new AuthError('no_plan', 'لا خطّة فعّالة — اعتمد خطّتك أولا', 404)

    const schedulable = plan.items.filter((i) => i.state === 'schedulable' && i.cohort && !i.requestPending)
    const awaiting = plan.items.filter((i) => i.state === 'awaiting_cohort').map((i) => i.courseId)
    const alreadyRequested = plan.items.filter((i) => i.requestPending).map((i) => i.courseId)
    const alreadyEnrolled = plan.items.filter((i) => i.state === 'enrolled').map((i) => i.courseId)

    const created: { courseId: string; cohortId: string; requestId: string }[] = []
    for (const item of schedulable) {
      const cohortId = item.cohort!.id
      /* الفريد على (userId, cohortId) يمنع التكرار؛ والمرفوض أو الملغى يُحيا */
      const existing = await this.prisma.enrollmentRequest.findUnique({ where: { userId_cohortId: { userId, cohortId } } })
      const req = existing
        ? await this.prisma.enrollmentRequest.update({
            where: { id: existing.id },
            data: { status: 'pending', planId: plan.id, decidedBy: null, decidedAt: null, orderId: null },
          })
        : await this.prisma.enrollmentRequest.create({ data: { userId, cohortId, planId: plan.id } })
      created.push({ courseId: item.courseId, cohortId, requestId: req.id })
    }

    await recordAudit(this.prisma, {
      actorId: userId, action: 'plan.request_enrollment', entityType: 'learner_plan', entityId: plan.id,
      meta: { requested: created.length, awaiting: awaiting.length, alreadyRequested: alreadyRequested.length, ...(verified ? {} : { emailUnverified: true }) },
    })
    if (created.length > 0) {
      await safeNotify(this.prisma, {
        userId, channel: 'in_app',
        title: 'وصلنا طلبك — نراجع خطّتك',
        body: `طلبتَ التسجيل في ${created.length} من دورات «${plan.nameAr}». نراجعها ونحجز مقاعدك، ثم تصلك فاتورةٌ واحدة للخطّة كلها.${awaiting.length > 0 ? ` و${awaiting.length} من دوراتك لم تُفتح لها شعبة بعد — نُعلمك عند فتحها ولا تُحتسب عليك الآن.` : ''}`,
        templateKey: 'plan.requested',
        data: { planId: plan.id, requested: created.length, awaiting: awaiting.length },
      })
    }
    return { planId: plan.id, nameAr: plan.nameAr, requested: created, awaiting, alreadyRequested, alreadyEnrolled }
  }

  /**
   * موافقة العمليات على طلبات خطّةٍ واحدة: حجزُ كل المقاعد، وطلبُ شراءٍ واحد،
   * وفاتورةٌ واحدة بمجموع أسعار الشعب.
   *
   * ولماذا فاتورةٌ واحدة لا فاتورة لكل دورة: المتعلّم اشترى خطّة. وأربعُ
   * فواتير تعني أربع دفعاتٍ وأربع فرصٍ للتوقّف في منتصف الطريق — ومن دفع
   * ثلاثا من أربع لا هو مشترٍ خطّةً ولا هو تاركها.
   */
  async approvePlanRequests(planId: string, actorId: string, couponCode?: string) {
    const reqs = await this.prisma.enrollmentRequest.findMany({
      where: { planId, status: 'pending' },
      include: { cohort: { include: { course: { include: { versions: { orderBy: { version: 'desc' }, take: 1 } } } } } },
      orderBy: { createdAt: 'asc' },
    })
    if (reqs.length === 0) throw new AuthError('not_found', 'لا طلبات معلّقة على هذه الخطّة', 404)
    const userId = reqs[0].userId
    if (reqs.some((r) => r.userId !== userId)) throw new AuthError('mixed_users', 'طلبات الخطّة ليست لمتعلّم واحد', 409)

    const unpriced = reqs.filter((r) => r.cohort.price === null)
    if (unpriced.length > 0) {
      throw new AuthError('no_price', `${unpriced.length} من شعب الخطّة بلا سعر — أكمل الإعداد المالي أولا`, 409)
    }
    /* عملةٌ واحدة للفاتورة: جمعُ دينارٍ إلى ريالٍ في مبلغٍ واحد رقمٌ لا يُطالَب به */
    const currency = reqs[0].cohort.currency
    if (reqs.some((r) => r.cohort.currency !== currency)) {
      throw new AuthError('mixed_currency', 'شعب الخطّة بعملات مختلفة — لا تُجمع في فاتورة واحدة', 409)
    }

    /* السعة تُقاس لكل شعبة قبل أيّ حجز: حجزُ بعضها ثم الفشل يترك مقاعد
       محجوزةً لطلبٍ لن يُنشأ. فإمّا الكل وإمّا لا شيء. */
    for (const r of reqs) {
      if (!r.cohort.capacity) continue
      const [enrolled, held] = await Promise.all([
        this.prisma.enrollment.count({ where: { cohortId: r.cohortId, status: 'enrolled' } }),
        this.prisma.enrollmentRequest.count({ where: { cohortId: r.cohortId, status: 'seat_held' } }),
      ])
      if (enrolled + held >= r.cohort.capacity) {
        const title = r.cohort.course.versions[0]?.titleAr ?? r.cohort.title
        throw new AuthError('capacity_full', `لا مقاعد في «${title}» — أزل الدورة من الخطّة أو افتح شعبة أخرى`, 409)
      }
    }

    const subtotal = reqs.reduce((sum, r) => sum + num(r.cohort.price), 0)
    let discount = 0
    let couponId: string | undefined
    if (couponCode) {
      const coupon = await this.prisma.coupon.findUnique({ where: { code: couponCode.trim().toUpperCase() } })
      if (!coupon || !coupon.active) throw new AuthError('bad_coupon', 'الكوبون غير صالح')
      if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new AuthError('bad_coupon', 'الكوبون منتهي')
      if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) throw new AuthError('bad_coupon', 'استنفد الكوبون عدد استخداماته')
      discount = coupon.percentOff ? Math.round((subtotal * coupon.percentOff) / 100 * 100) / 100 : num(coupon.amountOff)
      if (discount > subtotal) discount = subtotal
      couponId = coupon.id
    }
    const total = Math.max(0, subtotal - discount)
    const plan = await this.prisma.learnerPlan.findUnique({ where: { id: planId }, select: { nameAr: true } })

    const order = await this.prisma.$transaction(async (tx) => {
      const o = await tx.order.create({
        data: {
          userId, subtotal, discount, total, currency, couponId,
          items: {
            create: reqs.map((r) => ({
              kind: 'cohort',
              refId: r.cohortId,
              titleAr: `${r.cohort.course.versions[0]?.titleAr ?? r.cohort.title} — ${r.cohort.title}`,
              unitPrice: num(r.cohort.price),
            })),
          },
        },
      })
      const count = await tx.invoice.count()
      const year = new Date().getFullYear()
      await tx.invoice.create({
        data: { number: `WJ-INV-${year}-${String(count + 1).padStart(5, '0')}`, orderId: o.id, amount: total, currency },
      })
      if (couponId) await tx.coupon.update({ where: { id: couponId }, data: { usedCount: { increment: 1 } } })
      await tx.enrollmentRequest.updateMany({
        where: { id: { in: reqs.map((r) => r.id) } },
        data: { status: 'seat_held', orderId: o.id, decidedBy: actorId, decidedAt: new Date() },
      })
      return o
    })

    await recordAudit(this.prisma, {
      actorId, action: 'plan.approve_requests', entityType: 'learner_plan', entityId: planId,
      meta: { orderId: order.id, cohorts: reqs.length, total, discount },
    })
    await safeNotify(this.prisma, {
      userId, channel: 'in_app',
      title: 'حُجزت مقاعد خطّتك — بقي الدفع',
      body: `حُجز لك ${reqs.length === 1 ? 'مقعد' : `${reqs.length} مقاعد`} في «${plan?.nameAr ?? 'خطّتك'}». أتمم الدفع (${total} ${currency}) دفعةً واحدة ليتحوّل حجزك إلى تسجيل فعليّ في دوراتك كلها.`,
      templateKey: 'plan.seats_held',
      data: { planId, orderId: order.id, total, cohorts: reqs.length },
    })
    return order
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
    await safeNotify(this.prisma, {
      userId: req.userId, channel: 'in_app',
      title: 'قُبِل طلب تسجيلك — بقي الدفع',
      body: `حُجز مقعدك في «${title} — ${req.cohort.title}». أتمم الدفع (${total} ${req.cohort.currency}) من صفحة الفواتير ليتحول حجزك إلى تسجيل فعلي.`,
      templateKey: 'enrollment.approved',
      data: { requestId, orderId: order.id, total },
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
    await safeNotify(this.prisma, {
      userId: req.userId, channel: 'in_app',
      title: 'اعتذرنا عن طلب التسجيل',
      body: `لم يُقبل طلب تسجيلك هذه المرة. السبب: ${reason}. شعباً جديدة تُفتتح دورياً — تابع صفحة الشعب المفتوحة.`,
      templateKey: 'enrollment.rejected',
      data: { requestId },
    })
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

    const config = await getPaymentConfig(this.prisma)
    const provider = getPaymentProvider(config)
    /* مصدر واحد لأصل الموقع: رابط عودة الدفع كان يسقط إلى localhost في الإنتاج
       متى غاب APP_URL، تماما كروابط الرسائل. */
    const appUrl = publicSiteUrl()
    const charge = await provider.createCharge({
      invoiceNumber: order.invoice.number, amount: num(order.total),
      currency: order.currency, descriptionAr: `طلب وجيز ${order.id}`,
      /* العودة إلى التعلّم لا إلى الفواتير (التوصية ٥): من أتمّ دفعه يريد أن
         يبدأ، لا أن يقرأ فاتورته. والصفحة تقرأ `paid` فتؤكّد وتوجّه. */
      callbackUrl: `${appUrl}/student/learning?paid=${order.id}`,
    })

    const payment = await this.prisma.payment.create({
      data: {
        invoiceId: order.invoice.id, provider: provider.name, amount: num(order.total), currency: order.currency,
        status: charge.status, providerRef: charge.providerRef, idempotencyKey,
        succeededAt: charge.status === 'succeeded' ? new Date() : null,
      },
    })
    /* مزود مستضاف: الدفعة pending ولا تسوية إلا بـ webhook موقَّت — رجوع المتصفح ليس دليلا */
    if (charge.status === 'succeeded') await this.settleOrder(orderId, null)
    await recordAudit(this.prisma, {
      actorId: userId, action: 'payment.charge', entityType: 'payment', entityId: payment.id,
      meta: { orderId, provider: provider.name, providerRef: charge.providerRef, mode: charge.redirectUrl ? 'hosted' : 'instant' },
    })
    /* redirectUrl يصل الواجهة لتحويل المتعلم لصفحة الدفع المستضافة */
    return Object.assign(payment, charge.redirectUrl ? { redirectUrl: charge.redirectUrl } : {})
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
    const config = await getPaymentConfig(this.prisma)
    if (!verifyPaymentWebhook(rawBody, signature, config.webhookSecret)) {
      throw new AuthError('bad_signature', 'توقيع الحدث غير صالح', 401)
    }
    const payload = normalizeWebhookPayload(provider, JSON.parse(rawBody))
    if (!payload.eventId) throw new AuthError('bad_payload', 'الحدث بلا معرف')

    const seen = await this.prisma.paymentWebhookEvent.findUnique({
      where: { provider_eventId: { provider, eventId: payload.eventId } },
    })
    if (seen) return { duplicate: true } // idempotency — لا أثر مزدوج

    await this.prisma.paymentWebhookEvent.create({ data: { provider, eventId: payload.eventId, payload: payload as object } })

    /* نجاح موقَّت: نجد الفاتورة برقمها، أو بالدفعة المعلقة التي تحمل مرجع المزود (فاتورة Moyasar المستضافة) */
    if (payload.status === 'succeeded') {
      const invoice = payload.invoiceNumber
        ? await this.prisma.invoice.findUnique({ where: { number: payload.invoiceNumber } })
        : (await this.prisma.payment.findFirst({
            where: { provider, providerRef: payload.providerRef ?? '', status: 'pending' }, include: { invoice: true },
          }))?.invoice ?? null
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
    /* تحويل **كل** طلبات التسجيل المرتبطة بالطلب — لا أوّلها (التوصية ٣).

       كان هنا `findFirst`: من اشترى خطّةً بأربع دورات ودفع مرّة واحدة كان
       يُسجَّل في دورةٍ واحدة ويبقى خارج الثلاث بلا أن يحمرّ شيء — فالطلب
       «مدفوع» والفاتورة «مدفوعة»، والنقص لا يظهر إلا في شاشة المتعلّم.
       والدفعة الواحدة تشتري الخطّة كلها، فتسويتها تحوّلها كلها. */
    const reqs = await this.prisma.enrollmentRequest.findMany({ where: { orderId, status: 'seat_held' } })
    const converted: string[] = []
    const failed: { requestId: string; reason: string }[] = []
    for (const req of reqs) {
      try {
        await this.enrollments.enroll(req.cohortId, req.userId, actorId, {})
      } catch (err) {
        /* مسجل مسبقا (مثل إعادة معالجة) — لا يمنع التحويل */
        if (!(err instanceof AuthError && err.code === 'already_enrolled')) {
          /* دورةٌ تعذّر تسجيلها (امتلأت بين الحجز والدفع مثلا) لا تُسقط أخواتها:
             المال قُبض عن الخطّة كلها، فمنعُ الباقي عقوبةٌ مضاعفة. تُقيَّد
             بأثرٍ صريح ويُنبَّه المتعلّم، ويبقى الطلب محجوزا لا مُحوَّلا. */
          failed.push({ requestId: req.id, reason: err instanceof Error ? err.message : String(err) })
          continue
        }
      }
      await this.prisma.enrollmentRequest.update({ where: { id: req.id }, data: { status: 'converted' } })
      converted.push(req.id)
    }
    if (failed.length > 0) {
      await recordAudit(this.prisma, {
        actorId, action: 'order.settle_partial', entityType: 'order', entityId: orderId,
        meta: { converted: converted.length, failed },
        reason: 'دفعةٌ سُوّيت وبقيت دورات لم يُسجَّل فيها — تدخّل يدويّ مطلوب',
      })
    }

    /* إشعار تأكيد الدفع — يصل الطالب سواء حُوّل طلبه أم دفع لغير شعبة */
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { items: true } })
    if (order) {
      const what = order.items.length > 1 ? `خطّتك (${order.items.length} دورات)` : `«${order.items[0]?.titleAr ?? 'طلبك'}»`
      const tail =
        failed.length > 0
          ? `وسُجّلت ${converted.length} من ${reqs.length}؛ تواصلنا جارٍ بشأن الباقي ولن تدفع عنه مرّة أخرى.`
          : converted.length > 0
            ? 'مقاعدك صارت تسجيلاً فعلياً — شعبك تظهر في «تعلّمي».'
            : 'تفاصيل طلبك في «الفواتير».'
      await safeNotify(this.prisma, {
        userId: order.userId, channel: 'in_app',
        title: 'تأكد دفعك ✓ — أهلاً بك',
        body: `استلمنا دفعتك (${num(order.total)} ${order.currency}) عن ${what}. ${tail}`,
        templateKey: 'payment.succeeded',
        data: { orderId, total: num(order.total), enrolled: converted.length, of: reqs.length },
      })
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
    /* ردّ المال عند المزود قبل القيد. كان القيد وحده: يُعلَّم الاسترداد
       «مُنفَّذا» وتُحدَّث الدفعة والطلب، ولا يُنادى المزود أبدا — فالمتعلم يرى
       «استُرد» وبطاقته لا تُرصَّد. والرمي هنا مقصود: استردادٌ لم يقع لا يُقيَّد. */
    const config = await getPaymentConfig(this.prisma)
    const provider = getPaymentProvider(config)
    let providerRefundRef: string | null = null
    try {
      const done = await provider.refund({
        providerRef: refund.payment.providerRef ?? '',
        amount: num(refund.amount),
        currency: refund.payment.currency,
        reasonAr: note,
      })
      providerRefundRef = done.providerRefundRef
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await recordAudit(this.prisma, {
        actorId, action: 'refund.provider_failed', entityType: 'refund', entityId: refundId, reason: msg,
      })
      throw new AuthError('refund_provider_failed', `تعذّر ردّ المبلغ عند المزود، فلم يُقيَّد الاسترداد: ${msg}`, 502)
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
    await recordAudit(this.prisma, {
      actorId, action: 'refund.process', entityType: 'refund', entityId: refundId,
      meta: { amount: num(refund.amount), provider: provider.name, providerRefundRef },
    })
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

/* تطبيع حمولات webhook إلى عقد واحد: { eventId, invoiceNumber?, status, providerRef? }.
   العقد العام صريح؛ Moyasar يرسل كائن الدفعة (id + status=paid + metadata.invoiceNumber)؛
   Stripe يرسل حدثا (type=checkout.session.completed + data.object.metadata.invoiceNumber). */
function normalizeWebhookPayload(provider: string, raw: unknown): { eventId?: string; invoiceNumber?: string; status?: string; providerRef?: string } {
  const p = (raw ?? {}) as Record<string, unknown>
  if (provider === 'moyasar') {
    const meta = (p.metadata ?? {}) as Record<string, unknown>
    return {
      eventId: String(p.id ?? p.eventId ?? ''), providerRef: String(p.id ?? p.providerRef ?? ''),
      status: p.status === 'paid' ? 'succeeded' : (p.status as string | undefined),
      invoiceNumber: (meta.invoiceNumber ?? p.invoiceNumber) as string | undefined,
    }
  }
  if (provider === 'stripe') {
    const obj = (((p.data ?? {}) as Record<string, unknown>).object ?? {}) as Record<string, unknown>
    const meta = (obj.metadata ?? {}) as Record<string, unknown>
    const hasStripeShape = p.type !== undefined || p.data !== undefined
    return {
      eventId: String(p.id ?? p.eventId ?? ''), providerRef: String(obj.id ?? p.providerRef ?? ''),
      status: hasStripeShape ? (p.type === 'checkout.session.completed' ? 'succeeded' : String(p.type ?? '')) : (p.status as string | undefined),
      invoiceNumber: (meta.invoiceNumber ?? p.invoiceNumber) as string | undefined,
    }
  }
  /* العقد العام — جسور مخصصة ومزودون آخرون */
  return {
    eventId: p.eventId as string | undefined,
    invoiceNumber: p.invoiceNumber as string | undefined,
    status: p.status as string | undefined,
    providerRef: p.providerRef as string | undefined,
  }
}
