/* webhook Calendly — يكتب الموعد الحقيقيّ من المصدر الموقّع. */

import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import {
  CalendlyWebhookService,
  type CalendlyWebhookEvent,
  verifyCalendlyWebhookSignature,
} from '../../services/calendly-webhook.service'

export function registerCalendlyWebhookRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const calendly = new CalendlyWebhookService(prisma)

  app.post('/api/webhooks/calendly', {
    schema: { tags: ['webhooks'], summary: 'أحداث Calendly — توقيع إلزامي ومزامنة موعد المقابلة' },
  }, async (req, reply) => {
    const rawBody = (req as unknown as { rawBody?: string }).rawBody ?? JSON.stringify(req.body ?? {})
    const signature = String(req.headers['calendly-webhook-signature'] ?? '')
    if (!verifyCalendlyWebhookSignature(rawBody, signature, process.env.CALENDLY_WEBHOOK_SIGNING_KEY)) {
      return reply.status(401).send({ error: 'bad_signature' })
    }
    return calendly.handle((req.body ?? {}) as CalendlyWebhookEvent)
  })
}
