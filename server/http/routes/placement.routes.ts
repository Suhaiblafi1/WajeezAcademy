/* مساراتُ اختبار تحديد مستوى الإنجليزيّة (٨ أكتوبر ٢٠٢٦).

   · العامّة: الأسئلةُ المعتمَدة بلا أجوبتها، والتصحيح. بلا دخول — فالتشخيصُ نفسُه بلا
     دخول، والاختبارُ اختياريٌّ من صفحة نتيجته. وحارسُ التصحيح سقفُه وفخُّه.
   · المراجعة: خلف `placement.review` — مدرّبُ الإنجليزيّة بمنحٍ فرديّ، أو الإدارة. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { PlacementService } from '../../services/placement.service'
import { requirePermission } from '../auth-plugin'
import { assertNotBot } from '../honeypot'

export function registerPlacementRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const placement = new PlacementService(prisma)

  /* ════ المتعلّم ════ */

  app.get('/api/public/placement/english', {
    schema: { tags: ['placement'], summary: 'أسئلةُ اختبار المستوى المعتمَدة — بلا أجوبتها، أو لا شيء قبل فتحه' },
  }, async () => placement.publicBank())

  app.post('/api/public/placement/english/score', {
    config: { rateLimit: { max: 20, timeWindow: '10 minutes' } },
    schema: {
      tags: ['placement'], summary: 'تصحيحُ الأجوبة وتحديدُ المستوى',
      body: { type: 'object', required: ['answers'], properties: { answers: { type: 'object' } } },
    },
  }, async (req) => {
    assertNotBot(req.body)
    const body = z.object({
      answers: z.record(z.string().max(40), z.number().int().min(0).max(9))
        .refine((a) => Object.keys(a).length <= 200, 'أجوبةٌ أكثرُ من الأسئلة'),
    }).parse(req.body)
    return placement.score(body.answers)
  })

  /* ════ المراجعة ════ */

  app.get('/api/placement/english/review', {
    preHandler: requirePermission('placement.review'),
    schema: { tags: ['placement'], summary: 'كلُّ أسئلة الاختبار بأجوبتها وحالاتها' },
  }, async () => placement.reviewList())

  app.patch('/api/placement/english/review/:id', {
    preHandler: requirePermission('placement.review'),
    schema: { tags: ['placement'], summary: 'تعديلُ نصّ سؤالٍ أو خياراته أو جوابه' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().min(1).max(40) }).parse(req.params)
    const body = z.object({
      stemEn: z.string().trim().min(1).max(600).optional(),
      passageEn: z.string().max(2000).nullable().optional(),
      options: z.array(z.string().trim().min(1).max(200)).length(4).optional(),
      answerIndex: z.number().int().min(0).max(3).optional(),
    }).parse(req.body)
    return placement.edit(id, req.auth!.userId, body)
  })

  app.post('/api/placement/english/review/:id/decide', {
    preHandler: requirePermission('placement.review'),
    schema: {
      tags: ['placement'], summary: 'اعتمادُ سؤالٍ أو إسقاطُه',
      body: { type: 'object', required: ['approve'], properties: { approve: { type: 'boolean' }, note: { type: 'string' } } },
    },
  }, async (req) => {
    const { id } = z.object({ id: z.string().min(1).max(40) }).parse(req.params)
    const body = z.object({ approve: z.boolean(), note: z.string().max(500).optional() }).parse(req.body)
    return placement.decide(id, req.auth!.userId, body.approve, body.note)
  })
}
