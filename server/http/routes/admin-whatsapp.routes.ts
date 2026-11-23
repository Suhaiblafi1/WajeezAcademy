/* «واتساب» في الإدارة وبابُ Meta إليه (٢٤ نوفمبر ٢٠٢٦) — والعلّةُ في `server/services/whatsapp/`.
   الإرسالُ بصلاحيّة الكوبونات (`commerce.manage`) كالبريد الجماعيّ، والربطُ بصلاحيّة الإعدادات كسائر التكاملات. */

import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { requirePermission } from '../auth-plugin'
import { hookTokenMatches } from '../../services/whatsapp-hook.service'
import { cloudConfig, cloudSignatureOk, cloudTemplates, cloudView, saveCloudConfig } from '../../services/whatsapp/cloud'
import {
  AUDIENCES, audienceCounts, checkSend, handleHook, importConsents, listCampaigns, listThreads, readThread, reply, sendCampaign, stopCampaign,
  type AudienceKey, type HookBody,
} from '../../services/whatsapp/send.service'
import { WA_IMPORT_MAX, WA_PARAM_MAX, WA_REPLY_MAX } from '../../../src/application/marketing/whatsapp-send'

const idParam = z.object({ id: z.string().uuid() })
const tailParam = z.object({ tail: z.string().regex(/^\d{7,9}$/) })
const send = z.object({
  template: z.string().min(1).max(512),
  language: z.string().min(2).max(20),
  /* Meta تردّ خانةً فيها سطرٌ جديد */
  params: z.array(z.string().max(WA_PARAM_MAX).regex(/^[^\n\t]*$/)).max(20),
  audience: z.enum(Object.keys(AUDIENCES) as [AudienceKey, ...AudienceKey[]]),
})

export function registerAdminWhatsAppRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const can = requirePermission('commerce.manage')
  const settings = requirePermission('settings.manage')
  const tags = ['admin-whatsapp']

  app.get('/api/admin/whatsapp/config', { preHandler: can, schema: { tags, summary: 'حال ربط واتساب — الأسرار مقنعة' } }, async () => cloudView(prisma))

  app.put('/api/admin/whatsapp/config', { preHandler: settings, schema: { tags, summary: 'حفظ ربط واتساب وفتح الإرسال أو إغلاقه' } }, async (req) => {
    const secret = z.string().max(1000).optional()
    const body = z.object({
      enabled: z.boolean(), phoneNumberId: z.string().max(30).optional(), wabaId: z.string().max(30).optional(),
      token: secret, appSecret: secret, verifyToken: secret, dailyCap: z.number().int().min(1).max(100_000).optional(),
    }).parse(req.body ?? {})
    return saveCloudConfig(prisma, req.auth!.userId, body, req.ip)
  })

  app.get('/api/admin/whatsapp/templates', { preHandler: can, schema: { tags, summary: 'القوالب المعتمدة عند Meta' } }, async () => ({ templates: await cloudTemplates(prisma) }))
  app.get('/api/admin/whatsapp/audiences', { preHandler: can, schema: { tags, summary: 'القوائم بعدد من تصلهم' } }, async () => ({ audiences: await audienceCounts(prisma) }))

  app.post('/api/admin/whatsapp/consents', { preHandler: can, schema: { tags, summary: 'تسجيل موافقات أرقام بنص موافقتهم' } }, async (req) => {
    const body = z.object({
      phones: z.array(z.string().max(40)).min(1).max(WA_IMPORT_MAX), kind: z.enum(['utility', 'marketing']), textAr: z.string().max(500),
    }).parse(req.body ?? {})
    return importConsents(prisma, body, req.auth!.userId, req.ip)
  })

  app.post('/api/admin/whatsapp/check', { preHandler: can, schema: { tags, summary: 'من تصله الرسالة ومن لا تصله ولماذا' } }, async (req) => checkSend(prisma, send.parse(req.body ?? {})))

  app.post('/api/admin/whatsapp/send', { preHandler: can, schema: { tags, summary: 'إرسال قالب إلى قائمة — بالعدد الذي رآه المرسل' } }, async (req, reply) => {
    const { confirmCount, ...input } = send.extend({ confirmCount: z.number().int().min(1) }).parse(req.body ?? {})
    return reply.status(201).send(await sendCampaign(prisma, input, confirmCount, req.auth!.userId, req.ip))
  })

  app.get('/api/admin/whatsapp/campaigns', { preHandler: can, schema: { tags, summary: 'ما أرسل وحاله' } }, async () => ({ campaigns: await listCampaigns(prisma) }))
  app.post('/api/admin/whatsapp/campaigns/:id/stop', { preHandler: can, schema: { tags, summary: 'إيقاف إرسال جار' } }, async (req) => stopCampaign(prisma, idParam.parse(req.params).id, req.auth!.userId, req.ip))

  app.get('/api/admin/whatsapp/threads', { preHandler: can, schema: { tags, summary: 'من راسلنا' } }, async () => ({ threads: await listThreads(prisma) }))
  app.get('/api/admin/whatsapp/threads/:tail', { preHandler: can, schema: { tags, summary: 'محادثة' } }, async (req) => ({ messages: await readThread(prisma, tailParam.parse(req.params).tail) }))
  app.post('/api/admin/whatsapp/threads/:tail/reply', { preHandler: can, schema: { tags, summary: 'رد حر خلال 24 ساعة من رسالته' } }, async (req) => {
    const { body } = z.object({ body: z.string().trim().min(1).max(WA_REPLY_MAX) }).parse(req.body ?? {})
    return reply(prisma, tailParam.parse(req.params).tail, body, req.auth!.userId, req.ip)
  })

  /* ═══ باب Meta ═══ */
  app.get('/api/webhooks/whatsapp-cloud', { schema: { tags: ['webhooks'], summary: 'تحقق Meta من العنوان' } }, async (req, res) => {
    const q = (req.query ?? {}) as Record<string, string | undefined>
    const c = await cloudConfig(prisma)
    if (q['hub.mode'] !== 'subscribe' || !hookTokenMatches(q['hub.verify_token'], c.verifyToken)) return res.status(403).send({ error: 'forbidden' })
    return res.type('text/plain').send(String(q['hub.challenge'] ?? '').replace(/[^\w-]/g, ''))
  })

  app.post('/api/webhooks/whatsapp-cloud', {
    config: { rateLimit: { max: 1200, timeWindow: '1 minute' } },
    schema: { tags: ['webhooks'], summary: 'رسائل واتساب وحالها — توقيع إلزامي' },
  }, async (req, res) => {
    const raw = (req as unknown as { rawBody?: string }).rawBody ?? ''
    const c = await cloudConfig(prisma)
    if (!cloudSignatureOk(raw, req.headers['x-hub-signature-256'] as string | undefined, c.appSecret)) return res.status(401).send({ error: 'bad_signature' })
    await handleHook(prisma, (req.body ?? {}) as HookBody)
    return { ok: true }
  })
}
