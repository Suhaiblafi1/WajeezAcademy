/* مساراتُ المستشارين — بوّابتُهم وإدارةُ حالاتهم.

   المستشارُ يرى المسندَ إليه وحدَه؛ والصلاحيّةُ محروسةٌ في الخدمة لا في
   المسار، فلا ينفع تخطّي المسار.

   وُلد هذا الملفّ من قطعِ `operations.routes` (كان خمسَ مئةٍ وسبعةَ عشرَ
   سطرا يجمع أربعةَ مجالاتٍ لا يجمعها إلّا أنّها «عمليّات»: المستشارون،
   ودعواتُ التقويم، والسيرُ الذاتيّة، والتجارةُ وخطّافُ الدفع). واسمُ
   «العمليّات» لا يقول لقارئه أين يبحث — والقطعُ بحسب المجال يقول. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { AdvisorService } from '../../services/advisor.service'
import { AdvisorRequestService } from '../../services/advisor-request.service'
import { requirePermission } from '../auth-plugin'

export function registerAdvisorRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const advisors = new AdvisorService(prisma)
  const advisorRequests = new AdvisorRequestService(prisma)

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
    /* النتيجةُ مجموعةٌ مغلقة، لا أيَّ نصٍّ بحرفَين.

       كانت `z.string().min(2)`: فأيُّ نصٍّ يُقبل ويُكتب في القاعدة. والمخطّطُ
       يعدّ ثلاثَ نتائجَ في تعليقه، واختبارُ المنصّة نفسُه كان يكتب رابعةً
       (`answered`) — ثلاثُ طبقاتٍ تقول ثلاثةَ أشياءَ مختلفة، ولا واحدةَ
       منها تمنع. وقيدُ القاعدة الجديد يمنع، فيُقال السببُ هنا قبله بالعربيّة
       لا برمزِ قيدٍ لا يفهمه أحد. */
    const body = z.object({
      outcome: z.enum(['reached', 'no_answer', 'rescheduled']),
      note: z.string().optional(),
    }).parse(req.body)
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
}
