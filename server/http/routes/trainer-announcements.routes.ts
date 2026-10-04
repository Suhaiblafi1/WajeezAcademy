/* إعلانُ الإدارة إلى المدرّبين — بابان: الإدارةُ ترسل وتتابع، والمدرّبُ يقرأ.

   والإرسالُ بحبّة `staff.notify` — «من يبثّ الإعلانات» — لا بحبّةٍ جديدة: هي نفسُ
   القدرة، وجمهورُها صار المدرّبين كذلك. وقراءتُه بحبّة البوّابة (`trainer.portal`).
   والعلّةُ كاملةً في `services/trainer-announcement.service.ts`. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { requirePermission } from '../auth-plugin'
import { AuthError } from '../../services/auth.service'
import { TrainerAnnouncementService } from '../../services/trainer-announcement.service'
import {
  ANNOUNCEMENT_BODY_MAX, ANNOUNCEMENT_TITLE_MAX, lateUntilInstant, lateUntilProblem,
} from '../../../src/application/trainer/announcement'
import { zonedDay } from '../../../src/application/trainer/cohort-period'

export function registerTrainerAnnouncementRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const svc = new TrainerAnnouncementService(prisma)
  const canAnnounce = requirePermission('staff.notify')
  const portal = requirePermission('trainer.portal')
  const idParam = z.object({ id: z.string().uuid() })

  app.get('/api/admin/trainer-announcements', {
    preHandler: canAnnounce,
    schema: { tags: ['trainer-announcements'], summary: 'إعلاناتُ المدرّبين — ما أُرسل، ومن قرأ، ومن يصله لو أُرسل الآن' },
  }, async () => svc.list())

  app.post('/api/admin/trainer-announcements', {
    preHandler: canAnnounce,
    schema: { tags: ['trainer-announcements'], summary: 'إرسالُ إعلانٍ إلى المدرّبين — نافذةٌ في بوّابتهم وإشعارٌ في الجرس' },
  }, async (req, reply) => {
    const body = z.object({
      titleAr: z.string().trim().min(3).max(ANNOUNCEMENT_TITLE_MAX),
      bodyAr: z.string().trim().min(10).max(ANNOUNCEMENT_BODY_MAX),
      /* آخرُ يومٍ يُكتب فيه من صار مدرّبا بعد الإرسال (بعمّان) — أو فارغٌ: الآن وحدَهم */
      lateJoinersUntil: z.string().nullable().optional(),
    }).parse(req.body)
    const day = body.lateJoinersUntil ?? null
    if (day) {
      const problem = lateUntilProblem(day, zonedDay(new Date()))
      if (problem) throw new AuthError('bad_late_until', problem, 422)
    }
    return reply.status(201).send(await svc.send(req.auth!.userId, {
      titleAr: body.titleAr, bodyAr: body.bodyAr, lateJoinersUntil: day ? lateUntilInstant(day) : null,
    }))
  })

  app.get('/api/admin/trainer-announcements/:id', {
    preHandler: canAnnounce,
    schema: { tags: ['trainer-announcements'], summary: 'من أُرسل إليه الإعلان — ومتى رآه ومتى أكّد قراءتَه' },
  }, async (req) => svc.recipients(idParam.parse(req.params).id))

  app.get('/api/trainer/announcements', {
    preHandler: portal,
    schema: { tags: ['trainer-announcements'], summary: 'إعلاناتُ الإدارة إلى هذا المدرّب — أحدثُها أوّلا' },
  }, async (req) => svc.mine(req.auth!.userId))

  app.post('/api/trainer/announcements/:id/seen', {
    preHandler: portal,
    schema: { tags: ['trainer-announcements'], summary: 'ظهرت له نافذةُ الإعلان — أوّلَ مرّة' },
  }, async (req) => svc.seen(req.auth!.userId, idParam.parse(req.params).id))

  app.post('/api/trainer/announcements/:id/read', {
    preHandler: portal,
    schema: { tags: ['trainer-announcements'], summary: '«قرأتُه» — ويصير بندُ الجرس مقروءا معه' },
  }, async (req) => svc.read(req.auth!.userId, idParam.parse(req.params).id))
}
