/* مساراتُ اختبارات المستوى — الإنجليزيّةُ وفحوصُ المجالات (٨ أكتوبر ٢٠٢٦). والموضوعُ في
   المسار (`english` · `data` · `marketing` · `cyber` · `ai`)، وما سواه يُردّ.

   · العامّة: الأسئلةُ المعتمَدة بلا أجوبتها، والتصحيح. بلا دخول — فالتشخيصُ نفسُه بلا
     دخول، والاختبارُ اختياريٌّ من صفحة نتيجته. وحارسُ التصحيح سقفُه وفخُّه.
   · المراجعة: خلف `placement.review` — مدرّبُ الإنجليزيّة بمنحٍ فرديّ، أو الإدارة. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { PlacementService, isPlacementSubject, type PlacementSubject } from '../../services/placement.service'
import { requirePermission } from '../auth-plugin'
import { assertNotBot } from '../honeypot'

const subjectParam = (params: unknown) =>
  z.object({ subject: z.string().refine(isPlacementSubject, 'موضوعٌ لا اختبارَ له') }).parse(params).subject as PlacementSubject

export function registerPlacementRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const placement = new PlacementService(prisma)

  /* ════ المتعلّم ════ */

  app.get('/api/public/placement/:subject', {
    schema: { tags: ['placement'], summary: 'أسئلةُ الاختبار المعتمَدة — بلا أجوبتها، أو لا شيء قبل فتحه' },
  }, async (req) => placement.publicBank(subjectParam(req.params)))

  app.post('/api/public/placement/:subject/score', {
    config: { rateLimit: { max: 20, timeWindow: '10 minutes' } },
    schema: {
      tags: ['placement'], summary: 'تصحيحُ الأجوبة وتحديدُ المستوى',
      body: { type: 'object', required: ['answers'], properties: { answers: { type: 'object' } } },
    },
  }, async (req) => {
    assertNotBot(req.body)
    const subject = subjectParam(req.params)
    const body = z.object({
      answers: z.record(z.string().max(40), z.number().int().min(0).max(9))
        .refine((a) => Object.keys(a).length <= 200, 'أجوبةٌ أكثرُ من الأسئلة'),
    }).parse(req.body)
    return placement.score(subject, body.answers)
  })

  /* ════ المراجعة ════ */

  app.get('/api/placement/:subject/review', {
    preHandler: requirePermission('placement.review'),
    schema: { tags: ['placement'], summary: 'كلُّ أسئلة الموضوع بأجوبتها وحالاتها' },
  }, async (req) => placement.reviewList(subjectParam(req.params)))

  app.patch('/api/placement/:subject/review/:id', {
    preHandler: requirePermission('placement.review'),
    schema: { tags: ['placement'], summary: 'تعديلُ نصّ سؤالٍ أو خياراته أو جوابه' },
  }, async (req) => {
    const subject = subjectParam(req.params)
    const { id } = z.object({ id: z.string().min(1).max(40) }).parse(req.params)
    const body = z.object({
      stem: z.string().trim().min(1).max(600).optional(),
      passage: z.string().max(2000).nullable().optional(),
      options: z.array(z.string().trim().min(1).max(200)).length(4).optional(),
      answerIndex: z.number().int().min(0).max(3).optional(),
    }).parse(req.body)
    return placement.edit(subject, id, req.auth!.userId, body)
  })

  app.post('/api/placement/:subject/review/:id/decide', {
    preHandler: requirePermission('placement.review'),
    schema: {
      tags: ['placement'], summary: 'اعتمادُ سؤالٍ أو إسقاطُه',
      body: { type: 'object', required: ['approve'], properties: { approve: { type: 'boolean' }, note: { type: 'string' } } },
    },
  }, async (req) => {
    const subject = subjectParam(req.params)
    const { id } = z.object({ id: z.string().min(1).max(40) }).parse(req.params)
    const body = z.object({ approve: z.boolean(), note: z.string().max(500).optional() }).parse(req.body)
    return placement.decide(subject, id, req.auth!.userId, body.approve, body.note)
  })
}
