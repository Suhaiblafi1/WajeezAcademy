/* صفحةُ جواب المؤجَّل — «أما زلتَ مهتمّا؟» (٦ أكتوبر ٢٠٢٦).

   عامّان لا يسألان عن جلسة: الرمزُ في رابط البريد وحدَه يفتحهما، ويُحَلّ بهاشِه.
   و`GET` يقرأ ولا يُجيب — برامجُ البريد تفتح الروابطَ لتفحصها، فالجوابُ `POST`
   بضغطةٍ في الصفحة. والعلّةُ في `src/application/trainer/deferral.ts`، والعملُ في
   `server/services/trainer-deferral.service.ts`.

   وحدٌّ للطرق: رمزٌ من ٢٥٦ بتّا لا يُخمَّن، والحدُّ لما لا يُحسب. و`noindex` على
   الردَّين: صفحةٌ تحمل اسمَ إنسانٍ لا تُفهرَس. */

import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { TrainerDeferralService } from '../../services/trainer-deferral.service'
import { INTEREST_ANSWERS } from '../../../src/application/trainer/deferral'

export function registerDeferralInterestRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const svc = new TrainerDeferralService(prisma)

  app.get('/api/trainer-interest/:token', {
    config: { rateLimit: { max: 30, timeWindow: '10 minutes' } },
    schema: { tags: ['trainer-applications'], summary: 'سؤالُ اهتمام المؤجَّل كما يراه صاحبُه' },
  }, async (req, reply) => {
    const { token } = z.object({ token: z.string().min(20).max(100) }).parse(req.params)
    reply.header('X-Robots-Tag', 'noindex, nofollow')
    return svc.view(token)
  })

  app.post('/api/trainer-interest/:token', {
    config: { rateLimit: { max: 10, timeWindow: '10 minutes' } },
    schema: { tags: ['trainer-applications'], summary: 'جوابُ المؤجَّل: ما زال مهتمّا أو لم يعد' },
  }, async (req, reply) => {
    const { token } = z.object({ token: z.string().min(20).max(100) }).parse(req.params)
    const { answer } = z.object({ answer: z.enum(INTEREST_ANSWERS) }).parse(req.body)
    reply.header('X-Robots-Tag', 'noindex, nofollow')
    return svc.answer(token, answer)
  })
}
