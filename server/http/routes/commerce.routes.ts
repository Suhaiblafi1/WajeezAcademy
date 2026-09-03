/* مساراتُ التجارة — سلّةُ المتعلّم وطلباتُه، وعملياتُ التسجيل، والمالية،
   وخطّافُ الدفع.

   والخطّافُ موقَّتٌ وidempotent: رجوعُ المتصفّح ليس دليلا على الدفع، ودليلُه
   رسالةُ المزوّد الموقَّعة. والدفعُ اليدويُّ بصلاحيّةٍ ماليّةٍ لا أكاديميّة —
   من يسجّل التسجيلَ لا يسجّل دفعتَه.

   وُلد هذا الملفّ من قطعِ `operations.routes` (كان خمسَ مئةٍ وسبعةَ عشرَ
   سطرا يجمع أربعةَ مجالاتٍ لا يجمعها إلّا أنّها «عمليّات»: المستشارون،
   ودعواتُ التقويم، والسيرُ الذاتيّة، والتجارةُ وخطّافُ الدفع). واسمُ
   «العمليّات» لا يقول لقارئه أين يبحث — والقطعُ بحسب المجال يقول. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { CommerceService } from '../../services/commerce.service'
import { requireAuth, requirePermission } from '../auth-plugin'

export function registerCommerceRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const commerce = new CommerceService(prisma)

  /* ════ التجارة — المتعلم ════ */
  app.post('/api/learner/enrollment-requests', {
    preHandler: requirePermission('enrollment.request'),
    schema: { tags: ['commerce'], summary: 'طلب تسجيل في شعبة مفتوحة' },
  }, async (req, reply) => {
    const body = z.object({ cohortId: z.string().uuid(), note: z.string().max(500).optional() }).parse(req.body)
    return reply.status(201).send(await commerce.requestEnrollment(req.auth!.userId, body.cohortId, body.note))
  })

  /* الخطّة كاملةً في نداءٍ واحد (التوصيتان ٢ و٣): يطلب المتعلّم التسجيل في
     دورات خطّته التي لها شعبة، وما لا شعبة له يعود باسمه لا صامتا. */
  app.post('/api/learner/plan/enrollment-request', {
    preHandler: requirePermission('enrollment.request'),
    config: { rateLimit: { max: 10, timeWindow: '10 minutes' } },
    schema: { tags: ['commerce'], summary: 'طلب التسجيل في دورات الخطّة كلها — وما لا شعبة له يُقال' },
  }, async (req, reply) => reply.status(201).send(await commerce.requestPlanEnrollment(req.auth!.userId)))

  app.get('/api/learner/orders', {
    preHandler: requireAuth,
    schema: { tags: ['commerce'], summary: 'طلباتي وفواتيري ودفعاتي' },
  }, async (req) => commerce.myOrders(req.auth!.userId))

  /* مقاعدي المحجوزة قبل أن تصير تسجيلا — تُقرأ في «تعلّمي» و«مساري» فلا
     يُعرَض على من دفع أن يدفع مرّةً أخرى وهو ينتظر تأكيد البنك. */
  app.get('/api/learner/held-seats', {
    preHandler: requireAuth,
    schema: { tags: ['commerce'], summary: 'مقاعدي المحجوزة بانتظار تأكيد الدفع — النافذة بين الدفع والتسجيل' },
  }, async (req) => commerce.myHeldSeats(req.auth!.userId))

  /* إلغاءُ طلبٍ لم يكتمل دفعُه — يفكّ حجوزَه فلا يبقى مقعدٌ مقفلا بطلبٍ متروك */
  app.post('/api/learner/orders/:id/cancel', {
    preHandler: requireAuth,
    schema: { tags: ['commerce'], summary: 'إلغاء طلبي قبل الدفع — تُبطل فاتورتُه وتُفكّ حجوزُه' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return commerce.cancelOrder(id, req.auth!.userId)
  })

  /* الشراء المباشر — لا طلبَ ولا انتظارَ موافقة.

     التسجيل متاحٌ دائما مهما كان موعد بدء الشعبة: التسجيل شيء والبدء شيء
     آخر. والذي يحجب قرارٌ إداريّ (إغلاق التسجيل) أو نفادُ المقاعد — لا
     التقويم. */
  app.post('/api/learner/checkout', {
    preHandler: requireAuth,
    schema: { tags: ['commerce'], summary: 'شراء مباشر لشعبة أو أكثر — يُنشئ طلبا وفاتورة ويحجز المقاعد' },
  }, async (req, reply) => {
    const body = z.object({
      cohortIds: z.array(z.string().uuid()).min(1).max(10),
      couponCode: z.string().trim().min(2).max(40).optional(),
    }).parse(req.body)
    return reply.status(201).send(await commerce.checkout(req.auth!.userId, body.cohortIds, body.couponCode))
  })

  /* تسعيرٌ بلا كتابة — الرقمُ الذي يراه المشتري قبل أن يضغط.

     ولا يُحسب في الواجهة: خصمُ الباقة والهديّة والكوبون كلُّها من
     `priceCart` نفسِها التي يناديها `checkout`. فما يُعرض هو ما يُصدَر —
     بنيةً لا باتّفاق. */
  app.post('/api/learner/checkout/quote', {
    preHandler: requireAuth,
    schema: { tags: ['commerce'], summary: 'تسعير السلّة كما ستُصدرها الفاتورة — بلا حجزٍ ولا كتابة' },
  }, async (req) => {
    const body = z.object({
      cohortIds: z.array(z.string().uuid()).min(1).max(10),
      couponCode: z.string().trim().min(2).max(40).optional(),
    }).parse(req.body)
    return commerce.quote(req.auth!.userId, body.cohortIds, body.couponCode)
  })

  app.post('/api/learner/orders/:id/pay', {
    preHandler: requireAuth,
    schema: { tags: ['commerce'], summary: 'دفع الطلب بالمزود المضبوط — idempotent؛ يعيد redirectUrl عند المزود المستضاف' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    /* `presentment` عملةُ البطاقة لا عملةُ الدفتر — والقائمةُ مغلقة عمدا:
       ما لا يقبله المزوّد لا يُرسَل إليه، فلا يُكتشف الرفضُ عند صفحة الدفع. */
    const body = z.object({
      idempotencyKey: z.string().min(8).max(80),
      presentment: z.enum(['USD', 'AED', 'SAR']).optional(),
    }).parse(req.body)
    return commerce.payOrder(id, req.auth!.userId, body.idempotencyKey, body.presentment)
  })

  /* ════ التجارة — العمليات ════ */
  app.get('/api/admin/enrollment-requests', {
    preHandler: requirePermission('enrollment.request.review'),
    schema: { tags: ['admin-commerce'], summary: 'طلبات التسجيل للمراجعة' },
  }, async (req) => {
    const { status } = z.object({ status: z.string().optional() }).parse(req.query)
    return commerce.listEnrollmentRequests(status)
  })

  app.post('/api/admin/enrollment-requests/:id/approve', {
    preHandler: requirePermission('enrollment.request.review'),
    schema: { tags: ['admin-commerce'], summary: 'موافقة: حجز مقعد + طلب وفاتورة — بكوبون اختياري' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ couponCode: z.string().optional() }).parse(req.body ?? {})
    return reply.status(201).send(await commerce.approveEnrollmentRequest(id, req.auth!.userId, body.couponCode))
  })

  app.post('/api/admin/plans/:planId/approve-requests', {
    preHandler: requirePermission('enrollment.request.review'),
    schema: { tags: ['admin-commerce'], summary: 'موافقة على طلبات خطّة كاملة: حجز كل المقاعد + طلب وفاتورة واحدة' },
  }, async (req, reply) => {
    const { planId } = z.object({ planId: z.string().uuid() }).parse(req.params)
    const body = z.object({ couponCode: z.string().optional() }).parse(req.body ?? {})
    return reply.status(201).send(await commerce.approvePlanRequests(planId, req.auth!.userId, body.couponCode))
  })

  app.post('/api/admin/enrollment-requests/:id/reject', {
    preHandler: requirePermission('enrollment.request.review'),
    schema: { tags: ['admin-commerce'], summary: 'رفض طلب تسجيل بسبب مفهوم' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ reason: z.string().min(5) }).parse(req.body)
    return commerce.rejectEnrollmentRequest(id, req.auth!.userId, body.reason)
  })

  app.post('/api/admin/coupons', {
    preHandler: requirePermission('commerce.manage'),
    schema: { tags: ['admin-commerce'], summary: 'إنشاء كوبون خصم' },
  }, async (req, reply) => {
    const body = z.object({
      code: z.string().min(3).max(40), percentOff: z.number().int().min(1).max(100).optional(),
      amountOff: z.number().min(0.5).optional(), currency: z.string().optional(),
      maxUses: z.number().int().min(1).optional(), expiresAt: z.coerce.date().optional(),
    }).parse(req.body)
    return reply.status(201).send(await commerce.createCoupon(req.auth!.userId, body))
  })

  app.get('/api/admin/coupons', {
    preHandler: requirePermission('commerce.manage'),
    schema: { tags: ['admin-commerce'], summary: 'كل الكوبونات' },
  }, async () => commerce.listCoupons())

  app.post('/api/admin/subscription-plans', {
    preHandler: requirePermission('commerce.manage'),
    schema: { tags: ['admin-commerce'], summary: 'إنشاء خطة اشتراك' },
  }, async (req, reply) => {
    const body = z.object({
      code: z.string().min(2), nameAr: z.string().min(3), descriptionAr: z.string().optional(),
      price: z.number().min(0), currency: z.string().optional(),
      intervalMonths: z.number().int().min(1).optional(), features: z.array(z.string()).optional(),
    }).parse(req.body)
    return reply.status(201).send(await commerce.createPlan(req.auth!.userId, body))
  })

  app.get('/api/public/subscription-plans', {
    schema: { tags: ['public-catalog'], summary: 'خطط الاشتراك الفعالة — عام' },
  }, async () => commerce.listPlans(true))

  /* ════ المالية ════ */
  app.get('/api/admin/invoices', {
    preHandler: requirePermission('finance.view'),
    schema: { tags: ['finance'], summary: 'الفواتير مع طلباتها ودفعاتها' },
  }, async (req) => {
    const { status } = z.object({ status: z.string().optional() }).parse(req.query)
    return commerce.listInvoices(status)
  })

  app.post('/api/admin/invoices/:id/manual-payment', {
    preHandler: requirePermission('finance.payment.record'),
    schema: { tags: ['finance'], summary: 'تسجيل دفعة يدوية موثقة — تحويل/كاش، تطابق قيمة الفاتورة' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ methodNote: z.string().min(3), amount: z.number().min(0.5).optional() }).parse(req.body)
    return reply.status(201).send(await commerce.recordManualPayment(id, req.auth!.userId, body))
  })

  app.get('/api/admin/refunds', {
    preHandler: requirePermission('finance.view'),
    schema: { tags: ['finance'], summary: 'طلبات الاسترداد' },
  }, async (req) => {
    const { status } = z.object({ status: z.string().optional() }).parse(req.query)
    return commerce.listRefunds(status)
  })

  app.post('/api/admin/payments/:id/refund', {
    preHandler: requirePermission('finance.refund.process'),
    schema: { tags: ['finance'], summary: 'طلب استرداد لدفعة ناجحة — سبب موثق' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ amount: z.number().positive(), reason: z.string().min(5) }).parse(req.body)
    return reply.status(201).send(await commerce.requestRefund(id, req.auth!.userId, body))
  })

  app.post('/api/admin/refunds/:id/process', {
    preHandler: requirePermission('finance.refund.process'),
    schema: { tags: ['finance'], summary: 'تنفيذ أو رفض الاسترداد — يحدّث الدفعة والطلب' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ approve: z.boolean(), note: z.string().optional() }).parse(req.body)
    return commerce.processRefund(id, req.auth!.userId, body.approve, body.note)
  })

  /* ════ webhook الدفع — موقَّت وidempotent؛ رجوع المتصفح ليس دليلا ════ */
  app.post('/api/webhooks/payments/:provider', {
    schema: { tags: ['webhooks'], summary: 'أحداث مزود الدفع — توقيع إلزامي والحدث المكرر يُتجاهل' },
  }, async (req) => {
    const { provider } = z.object({ provider: z.string().max(30) }).parse(req.params)
    /* التوقيع، بترتيب المصادر: ترويسة Stripe الرسمية أولا، ثم ترويسة العقد
       العام، ثم رمز مشترك في الجسم لأسلوب Moyasar. كانت ترويسة Stripe غير
       مقروءة أصلا، فحدثُه الحقيقي يصل بلا توقيع يُعرَف فيُرفض. */
    const bodyToken = (req.body as Record<string, unknown> | null)?.secret_token
    const signature = String(
      req.headers['stripe-signature'] ?? req.headers['x-payment-signature'] ?? bodyToken ?? '',
    )
    /* الجسم الخام كما وصل — لا إعادة تسلسل. مُلتقَط في محلّل المحتوى (app.ts).
       والرجوع إلى JSON.stringify احتياطٌ للمسارات التي لا تمرّ بالمحلّل. */
    const rawBody = (req as unknown as { rawBody?: string }).rawBody ?? JSON.stringify(req.body)
    return commerce.handleWebhook(provider, rawBody, signature)
  })
}
