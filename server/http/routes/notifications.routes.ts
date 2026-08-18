/* مسارات الإشعارات — in_app يصل فورا؛ القنوات الخارجية تفشل بأمان
   حتى يُوصَل مزود حقيقي بقرار من المالك. لا إرسال حقيقي في التطوير.
   القوالب والسجل والمحاولات الفاشلة محكومة بصلاحية notifications.manage. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { NotificationService } from '../../services/notification.service'
import { requireAuth, requirePermission } from '../auth-plugin'

export function registerNotificationRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const notifications = new NotificationService(prisma)

  /* ════ المستخدم ════ */
  app.get('/api/learner/notifications', {
    preHandler: requireAuth,
    schema: { tags: ['notifications'], summary: 'إشعاراتي الداخلية' },
  }, async (req) => notifications.myNotifications(req.auth!.userId))

  app.get('/api/learner/notifications/unread-count', {
    preHandler: requireAuth,
    schema: { tags: ['notifications'], summary: 'عدد غير المقروء — لشارة الواجهة' },
  }, async (req) => ({ unread: await notifications.unreadCount(req.auth!.userId) }))

  app.post('/api/learner/notifications/:id/read', {
    preHandler: requireAuth,
    schema: { tags: ['notifications'], summary: 'تعليم إشعار كمقروء' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return notifications.markRead(req.auth!.userId, id)
  })

  /* ════ الإدارة ════ */
  app.get('/api/admin/notification-templates', {
    preHandler: requirePermission('notifications.manage'),
    schema: { tags: ['notifications-admin'], summary: 'قوالب الإشعارات' },
  }, async () => notifications.listTemplates())

  app.post('/api/admin/notification-templates', {
    preHandler: requirePermission('notifications.manage'),
    schema: { tags: ['notifications-admin'], summary: 'إنشاء أو تحديث قالب — متغيرات {{key}}' },
  }, async (req, reply) => {
    const body = z.object({
      key: z.string().min(2).max(80),
      channel: z.enum(['in_app', 'email', 'sms', 'whatsapp']),
      titleAr: z.string().min(1), bodyAr: z.string().min(1),
      active: z.boolean().optional(),
    }).parse(req.body)
    return reply.status(201).send(await notifications.upsertTemplate(req.auth!.userId, body))
  })

  app.get('/api/admin/notifications-log', {
    preHandler: requirePermission('notifications.manage'),
    schema: { tags: ['notifications-admin'], summary: 'سجل الإرسال — ترشيح بالحالة' },
  }, async (req) => {
    const { status } = z.object({ status: z.string().optional() }).parse(req.query)
    return notifications.listLog(status)
  })

  app.post('/api/admin/notifications/:id/retry', {
    preHandler: requirePermission('notifications.manage'),
    schema: { tags: ['notifications-admin'], summary: 'إعادة محاولة إشعار فاشل — حد ثلاث محاولات' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return notifications.retry(id)
  })
}
