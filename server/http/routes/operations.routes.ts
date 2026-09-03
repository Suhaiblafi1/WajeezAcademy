/* مسارات العمليات — المستشارون والسير الذاتية والتجارة وwebhook الدفع.
   المستشار يرى المسند إليه فقط؛ السيرة بموافقة وسجل مشاهدة؛
   الدفع اليدوي بصلاحية مالية؛ webhook موقَّت وidempotent. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { AdvisorService } from '../../services/advisor.service'
import { AdvisorRequestService } from '../../services/advisor-request.service'
import { CalendarService } from '../../services/calendar/calendar.service'
import { CvService } from '../../services/cv.service'
import { CommerceService } from '../../services/commerce.service'
import { requireAuth, requirePermission } from '../auth-plugin'

export function registerOperationsRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const advisors = new AdvisorService(prisma)
  const advisorRequests = new AdvisorRequestService(prisma)
  const calendar = new CalendarService(prisma)
  const cvs = new CvService(prisma)
  const commerce = new CommerceService(prisma)

  /* ════ ربط التشخيص بالحساب — أي مستخدم موثق ════ */
  app.post('/api/learner/diagnostic-attach', {
    preHandler: requireAuth,
    schema: { tags: ['operations'], summary: 'إرفاق نتيجة التشخيص بالحساب — ينشئ ملف متعلم وعميلا محتملا وحالة مستشار' },
  }, async (req) => {
    const body = z.object({ snapshot: z.record(z.string(), z.unknown()) }).parse(req.body)
    return advisors.attachDiagnostic(req.auth!.userId, body.snapshot, req.ip)
  })

  /* ════ بوابة المستشار — المسند إليه فقط ════ */
  app.get('/api/advisor/cases', {
    preHandler: requirePermission('advisor.cases.view'),
    schema: { tags: ['advisor-portal'], summary: 'حالاتي المسندة — مع أقرب متابعة' },
  }, async (req) => {
    const { status } = z.object({ status: z.string().optional() }).parse(req.query)
    return advisors.myCases(req.auth!.userId, status)
  })

  app.get('/api/advisor/cases/:id', {
    preHandler: requirePermission('advisor.cases.view'),
    schema: { tags: ['advisor-portal'], summary: 'ملف الحالة: العميل والتشخيص والنتيجة وأثر القرار والسيرة والتواصل والملاحظات والمهام' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return advisors.caseDetail(req.auth!.userId, id)
  })

  app.post('/api/advisor/cases/:id/status', {
    preHandler: requirePermission('advisor.cases.operate'),
    schema: { tags: ['advisor-portal'], summary: 'تغيير حالة الحالة — ثماني حالات موثقة' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ status: z.string(), note: z.string().optional() }).parse(req.body)
    return advisors.setStatus(req.auth!.userId, id, body.status, body.note)
  })

  app.post('/api/advisor/cases/:id/next-action', {
    preHandler: requirePermission('advisor.cases.operate'),
    schema: { tags: ['advisor-portal'], summary: 'تحديد الإجراء التالي وموعد المتابعة القادم' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ nextAction: z.string().min(3), nextFollowUpAt: z.coerce.date().optional() }).parse(req.body)
    return advisors.setNextAction(req.auth!.userId, id, body.nextAction, body.nextFollowUpAt)
  })

  app.post('/api/advisor/cases/:id/notes', {
    preHandler: requirePermission('advisor.cases.operate'),
    schema: { tags: ['advisor-portal'], summary: 'ملاحظة داخلية — لا تظهر للعميل' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ body: z.string().min(3) }).parse(req.body)
    return reply.status(201).send(await advisors.addNote(req.auth!.userId, id, body.body))
  })

  app.post('/api/advisor/cases/:id/tasks', {
    preHandler: requirePermission('advisor.cases.operate'),
    schema: { tags: ['advisor-portal'], summary: 'مهمة على الحالة بموعد استحقاق' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ title: z.string().min(3), dueAt: z.coerce.date().optional() }).parse(req.body)
    return reply.status(201).send(await advisors.addTask(req.auth!.userId, id, body.title, body.dueAt))
  })

  app.post('/api/advisor/tasks/:taskId/complete', {
    preHandler: requirePermission('advisor.cases.operate'),
    schema: { tags: ['advisor-portal'], summary: 'إنجاز مهمة' },
  }, async (req) => {
    const { taskId } = z.object({ taskId: z.string().uuid() }).parse(req.params)
    return advisors.completeTask(req.auth!.userId, taskId)
  })

  app.post('/api/advisor/cases/:id/follow-ups', {
    preHandler: requirePermission('advisor.cases.operate'),
    schema: { tags: ['advisor-portal'], summary: 'جدولة متابعة — تنعكس على الحالة' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ scheduledAt: z.coerce.date(), channel: z.enum(['whatsapp', 'email', 'phone']).optional(), note: z.string().optional() }).parse(req.body)
    return reply.status(201).send(await advisors.addFollowUp(req.auth!.userId, id, body))
  })

  app.post('/api/advisor/follow-ups/:followUpId/complete', {
    preHandler: requirePermission('advisor.cases.operate'),
    schema: { tags: ['advisor-portal'], summary: 'إنجاز متابعة بنتيجة' },
  }, async (req) => {
    const { followUpId } = z.object({ followUpId: z.string().uuid() }).parse(req.params)
    const body = z.object({ outcome: z.string().min(2), note: z.string().optional() }).parse(req.body)
    return advisors.completeFollowUp(req.auth!.userId, followUpId, body.outcome, body.note)
  })

  app.post('/api/advisor/cases/:id/contact', {
    preHandler: requirePermission('advisor.cases.operate'),
    schema: { tags: ['advisor-portal'], summary: 'تسجيل تواصل — أول تواصل ينقل الحالة إلى contacted' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      channel: z.enum(['whatsapp', 'email', 'phone', 'in_app']),
      direction: z.enum(['out', 'in']).optional(), summary: z.string().min(3),
    }).parse(req.body)
    return reply.status(201).send(await advisors.addContactEvent(req.auth!.userId, id, body))
  })

  /* ── عمولتي — ما تراه الإدارة عن المستشار الآن يراه هو عن نفسه ── */
  app.get('/api/advisor/earnings', {
    preHandler: requirePermission('advisor.cases.view'),
    schema: { tags: ['advisor-portal'], summary: 'عمولتي المستحقّة من عملائي الدافعين، وتقييمي' },
  }, async (req) => advisors.myEarnings(req.auth!.userId))

  /* ── الوجه الأكاديميّ: المستشار يتابع من أُسند إليه ── */
  app.get('/api/advisor/cases/:id/learner', {
    preHandler: requirePermission('advisor.learner.view'),
    schema: { tags: ['advisor-portal'], summary: 'الصورة الأكاديمية لعميلٍ مسند — تسجيلاته وتقدّمها وجلساته القادمة وخطّته' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return advisors.learnerSnapshot(req.auth!.userId, id)
  })

  /* ── ما لا يملكه المستشار وحده: خصمٌ وتعديلُ خطّة ── */
  app.get('/api/advisor/cases/:id/requests', {
    preHandler: requirePermission('advisor.request.submit'),
    schema: { tags: ['advisor-portal'], summary: 'طلباتي على هذه الحالة وحالة كلٍّ منها' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return advisorRequests.byCase(req.auth!.userId, id)
  })

  app.post('/api/advisor/cases/:id/requests', {
    preHandler: requirePermission('advisor.request.submit'),
    schema: { tags: ['advisor-portal'], summary: 'رفع طلب خصم أو تعديل خطّة — يبتّ فيه غيرُك' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      kind: z.enum(['discount', 'plan_add', 'plan_remove']),
      percentOff: z.number().int().optional(),
      amountOff: z.number().optional(),
      currency: z.string().max(8).optional(),
      courseId: z.string().max(64).optional(),
      reasonAr: z.string().min(1).max(2000),
    }).parse(req.body)
    return reply.status(201).send(await advisorRequests.submit(req.auth!.userId, id, body))
  })

  app.post('/api/advisor/requests/:requestId/cancel', {
    preHandler: requirePermission('advisor.request.submit'),
    schema: { tags: ['advisor-portal'], summary: 'سحب طلبٍ معلّق رفعتَه أنت' },
  }, async (req) => {
    const { requestId } = z.object({ requestId: z.string().uuid() }).parse(req.params)
    return advisorRequests.cancel(req.auth!.userId, requestId)
  })

  /* ── طابور الإدارة ── */
  app.get('/api/admin/advisor-requests', {
    preHandler: requirePermission('advisor.request.review'),
    schema: { tags: ['admin-operations'], summary: 'طلبات المستشارين المعلّقة — أقدمُها أوّلا' },
  }, async () => advisorRequests.pending())

  app.post('/api/admin/advisor-requests/:requestId/decision', {
    preHandler: requirePermission('advisor.request.review'),
    schema: { tags: ['admin-operations'], summary: 'اعتماد طلب أو رفضه — والرفض يلزمه سبب' },
  }, async (req) => {
    const { requestId } = z.object({ requestId: z.string().uuid() }).parse(req.params)
    const body = z.object({
      decision: z.enum(['approved', 'rejected']),
      noteAr: z.string().max(2000).optional(),
    }).parse(req.body)
    return advisorRequests.decide(requestId, req.auth!.userId, body.decision, body.noteAr)
  })

  /* ════ إدارة حالات المستشارين ════ */
  app.get('/api/admin/advisor-cases/unassigned', {
    preHandler: requirePermission('advisor.assign'),
    schema: { tags: ['admin-operations'], summary: 'الحالات بلا مستشار — للإسناد' },
  }, async () => advisors.listUnassigned())

  app.post('/api/admin/advisor-cases/:id/assign', {
    preHandler: requirePermission('advisor.assign'),
    schema: { tags: ['admin-operations'], summary: 'إسناد حالة لمستشار — تاريخ الإسناد محفوظ' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ advisorId: z.string().uuid() }).parse(req.body)
    return reply.status(201).send(await advisors.assign(id, body.advisorId, req.auth!.userId))
  })

  /* ════ دعوات التقويم — ملفّ ICS يفتحه قوقل وآبل وأوتلوك ════

     ولماذا ملفٌّ لا واجهةُ قوقل: الواجهةُ تلزمها OAuth وموافقةُ كلّ
     مستخدمٍ على حدة، وتربطنا بمزوّدٍ واحد. والملفُّ معيارٌ يفتحه الجميع.
     والصلاحيةُ محروسةٌ في الخدمة: الجلسةُ لمن سجّل فيها، والمقابلةُ
     لصاحبها أو لمن يراجع الطلبات. */
  app.get('/api/calendar/cohort-sessions/:sessionId.ics', {
    preHandler: requireAuth,
    schema: { tags: ['calendar'], summary: 'دعوة تقويم لجلسة شعبة — لمن سجّل فيها' },
  }, async (req, reply) => {
    const { sessionId } = z.object({ sessionId: z.string().uuid() }).parse(req.params)
    const { filename, content } = await calendar.cohortSessionIcs(sessionId, req.auth!.userId, {
      manageAll: req.auth!.permissions.includes('cohort.manage'),
      trainerOperate: req.auth!.permissions.includes('trainer.cohort.operate'),
    })
    return reply
      .header('content-type', 'text/calendar; charset=utf-8')
      .header('content-disposition', `attachment; filename="${filename}"`)
      .send(content)
  })

  app.get('/api/calendar/trainer-interviews/:interviewId.ics', {
    preHandler: requireAuth,
    schema: { tags: ['calendar'], summary: 'دعوة تقويم لمقابلة مدرّب — لصاحبها أو لمن يراجع' },
  }, async (req, reply) => {
    const { interviewId } = z.object({ interviewId: z.string().uuid() }).parse(req.params)
    const me = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { email: true } })
    const { filename, content } = await calendar.trainerInterviewIcs(interviewId, {
      email: me?.email,
      canReview: req.auth!.permissions.includes('trainer.applications.review'),
    })
    return reply
      .header('content-type', 'text/calendar; charset=utf-8')
      .header('content-disposition', `attachment; filename="${filename}"`)
      .send(content)
  })

  /* ════ بوّاباتي ════

     مديرُ النظام يملك صلاحيّاتِ المدرّب والمستشار، فيدخل بوّابتيهما — ثمّ
     تقول له كلُّ شاشةٍ «لا ملف مدرب مرتبطا بهذا الحساب». والصلاحيّةُ ليست
     الجواب: السؤالُ هل لهذا الحساب ملفٌّ في تلك البوّابة. فيُسأل مرّةً
     واحدةً في الإطار بدل أن تسقط كلُّ شاشةٍ على حدة. */
  app.get('/api/me/portals', {
    preHandler: requireAuth,
    schema: { tags: ['portal'], summary: 'هل لحسابي ملفُّ مدرّبٍ أو مستشار؟ — يقرؤه إطارُ البوّابة' },
  }, async (req) => {
    const userId = req.auth!.userId
    const [trainer, advisor] = await Promise.all([
      prisma.trainerProfile.findFirst({ where: { userId }, select: { id: true } }),
      prisma.advisorProfile.findUnique({ where: { userId }, select: { id: true } }),
    ])
    return { trainer: trainer !== null, advisor: advisor !== null }
  })

  /* ════ السير الذاتية ════ */
  app.post('/api/learner/cv', {
    preHandler: requirePermission('cv.upload'),
    schema: { tags: ['cv'], summary: 'رفع سيرة — موافقة صريحة إلزامية، تحقق نوع وحجم، رابط رفع موقع' },
  }, async (req, reply) => {
    const body = z.object({
      originalName: z.string().min(1).max(200), mime: z.string(),
      sizeBytes: z.number().int().positive(), consent: z.literal(true),
    }).parse(req.body)
    return reply.status(201).send(await cvs.upload(req.auth!.userId, body, req.ip))
  })

  app.get('/api/learner/cv', {
    preHandler: requireAuth,
    schema: { tags: ['cv'], summary: 'سيري الذاتية الفعالة' },
  }, async (req) => cvs.listMine(req.auth!.userId))

  app.get('/api/cv/:id/read-url', {
    preHandler: requireAuth,
    schema: { tags: ['cv'], summary: 'رابط قراءة موقع — مالك أو مستشار مسند أو إدارة؛ كل مشاهدة مسجلة' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const url = await cvs.readUrl(id, req.auth!.userId, req.auth!.permissions, req.ip)
    return { url }
  })

  app.post('/api/cv/:id/delete', {
    preHandler: requireAuth,
    schema: { tags: ['cv'], summary: 'حذف سيرة وفق السياسة — سبب موثق، حذف منطقي' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ reason: z.string().min(5) }).parse(req.body)
    return cvs.remove(id, req.auth!.userId, req.auth!.permissions, body.reason)
  })

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
