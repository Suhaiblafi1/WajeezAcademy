/* مسارات الإشعارات — in_app يصل فورا؛ القنوات الخارجية تفشل بأمان
   حتى يُوصَل مزود حقيقي بقرار من المالك. لا إرسال حقيقي في التطوير.
   القوالب والسجل والمحاولات الفاشلة محكومة بصلاحية notifications.manage. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { NOTIFICATION_AUDIENCES, NotificationService } from '../../services/notification.service'
import { requireAuth, requirePermission } from '../auth-plugin'
import { NOTIFICATION_CATEGORIES } from '../../../src/application/notifications/categories'
import { recordAudit } from '../../services/audit'

/* البوابة التي يسأل منها الجرس. والافتراضي `learner` لأنّه ما كانت عليه
   النقطة قبل الفصل — فقارئٌ قديم لا يُكسَر، ويرى ما كان يخصّه أصلا. */
const audienceQuery = z.object({
  audience: z.enum(NOTIFICATION_AUDIENCES as unknown as [string, ...string[]]).default('learner'),
})

export function registerNotificationRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const notifications = new NotificationService(prisma)

  /* ════ المستخدم ════ */
  app.get('/api/learner/notifications', {
    preHandler: requireAuth,
    schema: { tags: ['notifications'], summary: 'إشعاراتي الداخلية — بجمهور البوابة السائلة' },
  }, async (req) => {
    const { audience } = audienceQuery.parse(req.query)
    return notifications.myNotifications(req.auth!.userId, audience as 'learner' | 'trainer' | 'staff')
  })

  app.get('/api/learner/notifications/unread-count', {
    preHandler: requireAuth,
    schema: { tags: ['notifications'], summary: 'عدد غير المقروء — لشارة بوابةٍ بعينها' },
  }, async (req) => {
    const { audience } = audienceQuery.parse(req.query)
    return { unread: await notifications.unreadCount(req.auth!.userId, audience as 'learner' | 'trainer' | 'staff') }
  })

  app.post('/api/learner/notifications/:id/read', {
    preHandler: requireAuth,
    schema: { tags: ['notifications'], summary: 'تعليم إشعار كمقروء' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return notifications.markRead(req.auth!.userId, id)
  })

  /* ════ تفضيلاتي (المهمّة ٧٢) ════

     الشاشةُ تُبنى من الخادم لا من ثابتٍ في المتصفّح: الأصنافُ وأسماؤها
     وحدُّ ما يُكتَم منها وسببُ قفلِ ما لا يُكتَم — كلُّها من مصدرٍ واحد.
     ولو أُضيف صنفٌ غدا ظهر في الشاشة بلا نشرِ واجهة.

     ولا يُعرَض مفتاحُ بريدٍ اليوم: البريدُ غيرُ موصول، ومفتاحٌ لا يفعل شيئا
     هو نفسُه العطبُ الذي عالجته المرحلةُ ١ — زرٌّ يَعِد بما لا يفعل. */
  app.get('/api/me/notification-preferences', {
    preHandler: requireAuth,
    schema: { tags: ['notifications'], summary: 'أصنافُ الإشعارات وتفضيلي في كلٍّ منها' },
  }, async (req) => {
    const rows = await prisma.notificationPreference.findMany({
      where: { userId: req.auth!.userId, channel: 'in_app' },
    })
    const byCategory = new Map(rows.map((r) => [r.category, r.enabled]))
    return {
      channel: 'in_app',
      categories: NOTIFICATION_CATEGORIES.map((c) => ({
        key: c.key, labelAr: c.labelAr, whatAr: c.whatAr,
        silenceable: c.silenceable, lockedWhyAr: c.lockedWhyAr ?? null,
        /* الغيابُ يعني «مُفعَّل» */
        enabled: byCategory.get(c.key) ?? true,
      })),
      emailNoteAr: 'تفضيلاتُ البريد تظهر هنا يومَ يُوصَل مزوّدُ بريد — ولا يُعرض اليوم مفتاحٌ لا يفعل شيئا.',
    }
  })

  app.put('/api/me/notification-preferences', {
    preHandler: requireAuth,
    schema: { tags: ['notifications'], summary: 'كتمُ صنفٍ أو إعادتُه — وما لا يُكتَم يُردّ صريحا' },
  }, async (req) => {
    const body = z.object({ category: z.string(), enabled: z.boolean() }).parse(req.body)
    const category = NOTIFICATION_CATEGORIES.find((c) => c.key === body.category)
    if (!category) {
      return { error: { code: 'unknown_category', message_ar: 'صنفٌ غيرُ معروف' } }
    }
    /* الحدُّ يُقال صريحا لا يُتجاهَل صامتا: من طلب كتمَ إيصالِ دفعٍ يستحقّ
       جوابا يفهمه، لا مفتاحا يرتدّ بلا كلمة. */
    if (!category.silenceable && !body.enabled) {
      return {
        error: {
          code: 'not_silenceable',
          message_ar: category.lockedWhyAr ?? 'هذا الصنفُ لا يُكتَم',
        },
      }
    }
    await prisma.notificationPreference.upsert({
      where: { userId_category_channel: { userId: req.auth!.userId, category: category.key, channel: 'in_app' } },
      update: { enabled: body.enabled },
      create: { userId: req.auth!.userId, category: category.key, channel: 'in_app', enabled: body.enabled },
    })
    /* أثرٌ يُقرأ: كتمُ صنفٍ يُفسّر لاحقا «لم يصلني إشعار» */
    await recordAudit(prisma, {
      actorId: req.auth!.userId, action: body.enabled ? 'notification.pref.enable' : 'notification.pref.mute',
      entityType: 'user', entityId: req.auth!.userId, meta: { category: category.key, channel: 'in_app' },
    })
    return { ok: true, category: category.key, enabled: body.enabled }
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
