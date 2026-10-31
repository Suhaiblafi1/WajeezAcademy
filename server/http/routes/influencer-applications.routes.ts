/* طلباتُ الانضمام مؤثّرا — صفحةُ الاتّفاق ونموذجُها، وطابورٌ يُقبَل منه بكودٍ وعمولة أو يُعتذَر (٣١ أكتوبر ٢٠٢٦).

   والقواعدُ في `influencer-application.service.ts`، ونصوصُ الاتّفاق في `src/application/commerce/influencer-application.ts`.
   والبابُ العامّ محدودُ المعدّل وفيه حقلُ الفخّ كطلب المستشار (`advisor-applications.routes.ts`). والإدارةُ بصلاحيّة
   المؤثّرين نفسِها (`commerce.manage`، `influencer.routes.ts`): من يضيف المؤثّرَ بكوده يقبل من تقدّم ليكونه. */

import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { requirePermission } from '../auth-plugin'
import { assertNotBot } from '../honeypot'
import { InfluencerApplicationService } from '../../services/influencer-application.service'
import { normalizeApplicantLink } from '../../../src/application/trainer/applicant-link'
import { valuesOf } from '../../../src/application/advisor/application'
import { INFLUENCER_PLATFORMS, MAX_INFLUENCER_ACCOUNTS } from '../../../src/application/commerce/influencer-application'

/* رابطُ الحساب يُطبَّع كروابط المستشار: يُقبل بلا «https» ويُردّ `javascript:` */
const accountLink = z.string().max(300)
  .transform((v) => v.trim())
  .superRefine((v, ctx) => {
    if (!v) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'اكتب رابط الحساب' }); return }
    const r = normalizeApplicantLink(v)
    if (!r.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message: r.messageAr })
  })
  .transform((v) => {
    const r = normalizeApplicantLink(v)
    return r.ok ? r.url : v
  })

const applicationBody = z.object({
  fullName: z.string().trim().min(3).max(120),
  email: z.string().trim().toLowerCase().email('صيغة البريد غير صحيحة'),
  phoneCountryCode: z.string().max(6).optional(),
  phone: z.string().trim().min(6).max(20),
  /* المؤثّرُ بحساباته — حسابٌ واحدٌ على الأقلّ */
  accounts: z.array(z.object({
    platform: z.enum(valuesOf(INFLUENCER_PLATFORMS)),
    url: accountLink,
    followers: z.number().int().min(0).max(1_000_000_000),
  })).min(1, 'اكتب حسابا واحدا على الأقل').max(MAX_INFLUENCER_ACCOUNTS),
  pitchAr: z.string().trim().min(10).max(300),
  /* الشروطُ تُقبل صراحةً — بلا علامتها لا طلب */
  termsAccepted: z.literal(true),
})

export function registerInfluencerApplicationRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const svc = new InfluencerApplicationService(prisma)
  const canManage = requirePermission('commerce.manage')
  const id = z.object({ id: z.string().uuid() })

  app.get('/api/v1/influencer-applications/deal', {
    schema: { tags: ['influencer-applications'], summary: 'أرقام اتفاق المؤثر الآن: نسبة الخصم وعدد الدورات والعمولة' },
  }, async () => svc.deal())

  app.post('/api/v1/influencer-applications', {
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    schema: { tags: ['influencer-applications'], summary: 'طلب انضمام مؤثر — من صفحة الاتفاق' },
  }, async (req, reply) => {
    assertNotBot(req.body)
    /* علامةُ الشروط شرطٌ للمرور هنا ولا تُحفظ هي: الخدمةُ تكتب ساعةَ قبولها ونصَّ ما قبله */
    return reply.status(201).send(await svc.submit(applicationBody.parse(req.body)))
  })

  app.get('/api/admin/influencer-applications', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'طلبات الانضمام مؤثرا — الأوسع وصولا أولا' },
  }, async () => svc.list())

  app.post('/api/admin/influencer-applications/:id/approve', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'قبول مؤثر بكوده وعمولته — ينشئ ملفه وحسابه ويرسل تفعيله' },
  }, async (req) => {
    const body = z.object({
      code: z.string().trim().min(3).max(40),
      commissionPercent: z.number().int().min(0).max(100),
    }).parse(req.body)
    return svc.approve(req.auth!.userId, id.parse(req.params).id, body)
  })

  app.post('/api/admin/influencer-applications/:id/reject', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'الاعتذار عن طلب مؤثر — وسببه إن كتب يصله' },
  }, async (req) => {
    const { noteAr } = z.object({ noteAr: z.string().trim().max(500).optional() }).parse(req.body ?? {})
    return svc.reject(req.auth!.userId, id.parse(req.params).id, noteAr)
  })
}
