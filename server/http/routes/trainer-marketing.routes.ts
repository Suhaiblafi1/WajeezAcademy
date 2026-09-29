/* «التسويق» — بابا المدرّب والإدارة معا، والعلّةُ في رأس
   `server/services/trainer-marketing.service.ts`.

   المدرّبُ بـ`trainer.portal` كسائر بوّابته، والملفُّ من حسابه لا من جسم
   الطلب. والإدارةُ بـ`trainer.publish` — «الموافقة على ظهور المدرّب
   للعامّة»، والملصقُ ظهورُه للعامّة بعينه. ولا بابَ للإدارة يكتب
   `approved`: الموافقةُ فعلُ المدرّب وحدَه. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { TrainerMarketingService } from '../../services/trainer-marketing.service'
import { requirePermission } from '../auth-plugin'
import {
  MARKETING_TARGET_KINDS, MAX_MARKETING_NOTE, MAX_MARKETING_URL,
} from '../../../src/application/trainer/marketing'

export function registerTrainerMarketingRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const svc = new TrainerMarketingService(prisma)
  const note = z.string().trim().max(MAX_MARKETING_NOTE).nullish()
  const link = z.string().trim().max(MAX_MARKETING_URL).nullish()

  /* ═══════════ المدرّب ═══════════ */

  app.get('/api/trainer/marketing', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'التسويق: فيديوهاتي وصوري وملصقاتي وحالُ كلٍّ منها' },
  }, async (req) => svc.mine(req.auth!.userId))

  app.put('/api/trainer/marketing/videos', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'رابطُ فيديو — تعريفٌ بي أو بدورةٍ أو مسار. والرابطُ الفارغُ يمحوه' },
  }, async (req) => {
    const body = z.object({
      targetKind: z.enum(MARKETING_TARGET_KINDS),
      targetId: z.string().trim().max(64).nullish(),
      url: link,
      noteAr: note,
    }).parse(req.body)
    return svc.setVideo(req.auth!.userId, { ...body, url: body.url ?? null })
  })

  app.post('/api/trainer/marketing/photos', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'صورةٌ للملصقات — رابطُ رفعٍ موقّت، أو رابطُ صورةٍ جاهز' },
  }, async (req, reply) => {
    const body = z.object({
      mime: z.string().max(60).nullish(), url: link, captionAr: note,
    }).parse(req.body ?? {})
    return reply.status(201).send(await svc.addPhoto(req.auth!.userId, body))
  })

  app.delete('/api/trainer/marketing/photos/:id', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'حذفُ صورةٍ من صوري' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return svc.removePhoto(req.auth!.userId, id)
  })

  app.post('/api/trainer/marketing/posters/:id/decision', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'موافقتي على الملصق أو طلبُ تعديله — ولا استعمالَ عامًّا قبلها' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ decision: z.enum(['approve', 'changes']), noteAr: note }).parse(req.body)
    return svc.decidePoster(req.auth!.userId, id, body.decision, body.noteAr)
  })

  /* ═══════════ الإدارة ═══════════ */

  app.get('/api/admin/trainer-marketing', {
    preHandler: requirePermission('trainer.publish'),
    schema: { tags: ['admin-trainers'], summary: 'التسويق: المدرّبون وما قدّموه وحالُ ملصقاتهم' },
  }, async () => svc.adminList())

  app.get('/api/admin/trainer-marketing/:profileId', {
    preHandler: requirePermission('trainer.publish'),
    schema: { tags: ['admin-trainers'], summary: 'التسويق لمدرّبٍ بعينه — فيديوهاتُه وصورُه وملصقاتُه' },
  }, async (req) => {
    const { profileId } = z.object({ profileId: z.string().uuid() }).parse(req.params)
    return svc.adminDetail(profileId)
  })

  app.post('/api/admin/trainer-marketing/:profileId/posters', {
    preHandler: requirePermission('trainer.publish'),
    schema: { tags: ['admin-trainers'], summary: 'نسخةُ ملصقٍ جديدة — مسوّدةٌ برابطِ رفعٍ أو رابطِ تصميم' },
  }, async (req, reply) => {
    const { profileId } = z.object({ profileId: z.string().uuid() }).parse(req.params)
    const body = z.object({
      targetKind: z.enum(['course', 'path']), targetId: z.string().trim().min(1).max(64),
      mime: z.string().max(60).nullish(), url: link, staffNoteAr: note,
    }).parse(req.body)
    return reply.status(201).send(await svc.createPoster(req.auth!.userId, profileId, body))
  })

  app.post('/api/admin/trainer-marketing/posters/:id/submit', {
    preHandler: requirePermission('trainer.publish'),
    schema: { tags: ['admin-trainers'], summary: 'إرسالُ الملصق إلى المدرّب ليوافق — ويُزيح ما قبله' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return svc.submitPoster(req.auth!.userId, id)
  })

  app.delete('/api/admin/trainer-marketing/posters/:id', {
    preHandler: requirePermission('trainer.publish'),
    schema: { tags: ['admin-trainers'], summary: 'حذفُ مسوّدةِ ملصقٍ لم تُرسَل' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return svc.deleteDraftPoster(req.auth!.userId, id)
  })
}
