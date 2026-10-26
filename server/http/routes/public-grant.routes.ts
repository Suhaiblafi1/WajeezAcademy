/* صفحةُ «منحة أعضاء وجيز» — أبوابُها العامّة (٢٠ أكتوبر ٢٠٢٦). والعلّةُ في `grant-landing.service.ts`.

   بلا حساب: الزائرُ يعبّئ النموذج فيأخذ كودَه ويرى الدورات، والحسابُ حين يدفع. وسقفُ النموذج
   خمسٌ لكلّ شبكةٍ في ربع ساعة — تتّسع لمن أخطأ فأعاد، ولا تتّسع لمن يجمع أكوادا بأرقامٍ مختلَقة؛
   وسقفُ «تواصل مع مستشار» ثلاث: كلُّ طلبٍ حالةٌ يقرؤها إنسان. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { assertNotBot } from '../honeypot'
import { GrantLandingService } from '../../services/grant-landing.service'
import { INFLUENCER_GRANT_SLUG } from '../../../src/application/commerce/grant'

const applyBody = z.object({
  fullName: z.string().trim().min(2, 'اكتب اسمك').max(120),
  phone: z.string().trim().min(5, 'اكتب رقم واتساب').max(30),
  email: z.string().trim().toLowerCase().email('صيغة البريد غير صحيحة').max(200),
  workField: z.string().trim().min(2).max(60),
  careerLevel: z.string().trim().max(60).nullable().optional(),
  interests: z.array(z.string().trim().max(80)).max(10).optional(),
  channel: z.string().max(40).nullable().optional(),
  wave: z.string().max(40).nullable().optional(),
})

export function registerPublicGrantRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const landing = new GrantLandingService(prisma)
  const influencers = new GrantLandingService(prisma, INFLUENCER_GRANT_SLUG)

  app.get('/api/public/grant', {
    schema: { tags: ['public'], summary: 'حال منحة أعضاء وجيز ودوراتها بفصلها' },
  }, async () => landing.view())

  app.post('/api/public/grant', {
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    schema: { tags: ['public'], summary: 'نموذج المنحة: عميل محتمل وكوده، والدورات' },
  }, async (req, reply) => {
    assertNotBot(req.body)
    const body = applyBody.parse(req.body)
    return reply.status(201).send(await landing.apply(body, req.ip))
  })

  /* ═══ «منحة مؤثرين وجيز» — صفحتُها غيرُ صفحة الأولى، وكودُ المؤثّر لازمٌ في نموذجها (`grant-landing.service.ts`) ═══ */
  app.get('/api/public/grant/influencer', {
    schema: { tags: ['public'], summary: 'حال منحة المؤثرين ودوراتها، واسم المؤثر إن كان كوده صحيحا' },
  }, async (req) => {
    const { code } = z.object({ code: z.string().max(40).optional() }).parse(req.query)
    return influencers.influencerView(code)
  })

  app.post('/api/public/grant/influencer', {
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    schema: { tags: ['public'], summary: 'نموذج منحة المؤثرين: كود المؤثر لازم، وعميل محتمل وكوده' },
  }, async (req, reply) => {
    assertNotBot(req.body)
    const body = applyBody.extend({ influencerCode: z.string().trim().min(1, 'اكتب كود المؤثر').max(40) }).parse(req.body)
    return reply.status(201).send(await influencers.apply(body, req.ip))
  })

  app.post('/api/public/grant/advisor', {
    config: { rateLimit: { max: 3, timeWindow: '15 minutes' } },
    schema: { tags: ['public'], summary: 'من عبأ نموذج المنحة يطلب مستشارا' },
  }, async (req, reply) => {
    assertNotBot(req.body)
    const body = z.object({ ref: z.string().uuid(), noteAr: z.string().max(500).nullable().optional() }).parse(req.body)
    return reply.status(201).send(await landing.askAdvisor(body.ref, body.noteAr, req.ip))
  })
}
