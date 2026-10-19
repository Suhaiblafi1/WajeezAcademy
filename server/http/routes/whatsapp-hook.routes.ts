/* بابُ منصّة محادثات واتساب — رمزٌ في الترويسة، وتواصلُ المستشار يُسجَّل في حالة الطالب.
   والعلّةُ في `server/services/whatsapp-hook.service.ts`. */

import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { getWhatsAppHookConfig } from '../../services/integrations.service'
import { WhatsAppHookService, hookTokenMatches, tokenFromHeaders } from '../../services/whatsapp-hook.service'

export function registerWhatsAppHookRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const hook = new WhatsAppHookService(prisma)

  app.post('/api/webhooks/whatsapp-contact', {
    /* منصّةٌ تُرسل مع كلّ رسالة مستشار — والسقفُ فوق ما يبلغه فريقٌ، ودون ما يبلغه سيل */
    config: { rateLimit: { max: 600, timeWindow: '1 minute' } },
    schema: { tags: ['webhooks'], summary: 'منصة محادثات واتساب — راسل المستشار طالبا فيسجل التواصل في حالته' },
  }, async (req, reply) => {
    const cfg = await getWhatsAppHookConfig(prisma)
    if (!cfg.enabled || !hookTokenMatches(tokenFromHeaders(req.headers), cfg.token)) {
      return reply.status(401).send({ error: 'bad_token' })
    }
    const body = z.object({
      studentPhone: z.string().min(5).max(40),
      advisorEmail: z.string().email().max(200),
      summary: z.string().max(2000).optional(),
    }).parse(req.body)
    return hook.handle(body)
  })
}
