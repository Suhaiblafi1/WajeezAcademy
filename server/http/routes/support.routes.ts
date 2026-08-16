/* مسارات الدعم الفني — المتعلم يفتح تذكرة ويرد ويعيد فتحها؛
   الوكيل يرد ويحوّل الحالة ويغيّر الأولوية؛ الإسناد بصلاحية support.assign.
   الرسائل الداخلية internal لا تظهر لصاحب التذكرة؛ كل انتقال مسجل. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { SupportService } from '../../services/support.service'
import { requireAuth, requirePermission } from '../auth-plugin'

export function registerSupportRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const support = new SupportService(prisma)

  /* ════ المتعلم ════ */
  app.post('/api/learner/support/tickets', {
    preHandler: requireAuth,
    schema: { tags: ['support'], summary: 'فتح تذكرة دعم برسالة أولى' },
  }, async (req, reply) => {
    const body = z.object({
      subject: z.string().min(3).max(200),
      category: z.string().max(60).optional(),
      body: z.string().min(3),
    }).parse(req.body)
    return reply.status(201).send(await support.createTicket(req.auth!.userId, body))
  })

  app.get('/api/learner/support/tickets', {
    preHandler: requireAuth,
    schema: { tags: ['support'], summary: 'تذاكري — الرسائل الداخلية مخفية' },
  }, async (req) => support.myTickets(req.auth!.userId))

  app.post('/api/learner/support/tickets/:id/reply', {
    preHandler: requireAuth,
    schema: { tags: ['support'], summary: 'رد صاحب التذكرة' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ body: z.string().min(1) }).parse(req.body)
    return reply.status(201).send(await support.replyAsOwner(req.auth!.userId, id, body.body))
  })

  app.post('/api/learner/support/tickets/:id/reopen', {
    preHandler: requireAuth,
    schema: { tags: ['support'], summary: 'إعادة فتح تذكرة مغلقة أو محلولة' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ note: z.string().min(3) }).parse(req.body)
    return support.reopenAsOwner(req.auth!.userId, id, body.note)
  })

  /* ════ فريق الدعم ════ */
  app.get('/api/admin/support/tickets', {
    preHandler: requirePermission('support.operate'),
    schema: { tags: ['support-admin'], summary: 'قائمة التذاكر — ترشيح بالحالة أو الوكيل' },
  }, async (req) => {
    const q = z.object({ status: z.string().optional(), agentId: z.string().uuid().optional() }).parse(req.query)
    return support.listTickets(q)
  })

  app.get('/api/admin/support/tickets/:id', {
    preHandler: requirePermission('support.operate'),
    schema: { tags: ['support-admin'], summary: 'تفاصيل التذكرة مع الرسائل وسجل الحالات' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return support.ticketDetail(id)
  })

  app.post('/api/admin/support/tickets/:id/assign', {
    preHandler: requirePermission('support.assign'),
    schema: { tags: ['support-admin'], summary: 'إسناد التذكرة لوكيل بدور support' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ agentId: z.string().uuid() }).parse(req.body)
    return reply.status(201).send(await support.assign(id, body.agentId, req.auth!.userId))
  })

  app.post('/api/admin/support/tickets/:id/reply', {
    preHandler: requirePermission('support.operate'),
    schema: { tags: ['support-admin'], summary: 'رد الوكيل — internal:true يجعله داخليا مخفيا عن العميل' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ body: z.string().min(1), internal: z.boolean().optional() }).parse(req.body)
    return reply.status(201).send(await support.replyAsAgent(req.auth!.userId, id, body.body, body.internal ?? false))
  })

  app.post('/api/admin/support/tickets/:id/transition', {
    preHandler: requirePermission('support.operate'),
    schema: { tags: ['support-admin'], summary: 'تحويل حالة التذكرة وفق الخريطة المشروعة — مسجل بسابق ولاحق' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ to: z.string(), note: z.string().optional() }).parse(req.body)
    return support.transition(id, body.to, req.auth!.userId, body.note)
  })

  app.post('/api/admin/support/tickets/:id/priority', {
    preHandler: requirePermission('support.operate'),
    schema: { tags: ['support-admin'], summary: 'تغيير أولوية التذكرة' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ priority: z.enum(['low', 'normal', 'high', 'urgent']) }).parse(req.body)
    return support.setPriority(id, body.priority, req.auth!.userId)
  })
}
