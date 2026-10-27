/* طلباتُ الانضمام مستشارا — نموذجٌ عامّ، وطابورٌ يُقبَل منه في خطوةٍ أو يُعتذَر (٢٧ أكتوبر ٢٠٢٦، المرحلة السابعة).

   والقواعدُ في `advisor-application.service.ts`، والقيمُ في `src/application/advisor/application.ts` يقرؤها النموذجُ
   والخادمُ معا — فلا تفترق قائمتان. والبابُ العامّ محدودُ المعدّل وفيه حقلُ الفخّ كطلب المدرّب (`honeypot.ts`). */

import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { requirePermission } from '../auth-plugin'
import { assertNotBot } from '../honeypot'
import { AdvisorApplicationService } from '../../services/advisor-application.service'
import { normalizeApplicantLink } from '../../../src/application/trainer/applicant-link'
import {
  ADVISOR_AUDIENCES, ADVISOR_COMMUNITY_KINDS, ADVISOR_EMPLOYMENT, ADVISOR_EXPERIENCE, ADVISOR_HOURS, ADVISOR_PLATFORMS,
  MAX_ADVISOR_ACCOUNTS, MAX_ADVISOR_COMMUNITIES, valuesOf,
} from '../../../src/application/advisor/application'

/* رابطُ الحساب يُطبَّع كروابط المدرّب: يُقبل بلا «https» ويُردّ `javascript:` — والحكمُ في `normalizeApplicantLink` */
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
  country: z.string().max(80).optional(),
  employment: z.enum(valuesOf(ADVISOR_EMPLOYMENT)),
  experienceYears: z.enum(valuesOf(ADVISOR_EXPERIENCE)),
  experienceAr: z.string().trim().min(10).max(300),
  hoursPerWeek: z.enum(valuesOf(ADVISOR_HOURS)),
  audiences: z.array(z.enum(valuesOf(ADVISOR_AUDIENCES))).min(1).max(ADVISOR_AUDIENCES.length),
  accounts: z.array(z.object({
    platform: z.enum(valuesOf(ADVISOR_PLATFORMS)),
    url: accountLink,
    followers: z.number().int().min(0).max(1_000_000_000),
  })).max(MAX_ADVISOR_ACCOUNTS),
  communities: z.array(z.object({
    kind: z.enum(valuesOf(ADVISOR_COMMUNITY_KINDS)),
    name: z.string().trim().min(2).max(80),
    members: z.number().int().min(0).max(100_000_000),
  })).max(MAX_ADVISOR_COMMUNITIES),
  promotedBefore: z.boolean(),
  promotedAr: z.string().trim().max(300).optional(),
  motivationAr: z.string().trim().min(40).max(500),
  /* الشروطُ تُقبل صراحةً — بلا علامتها لا طلب */
  termsAccepted: z.literal(true),
})

export function registerAdvisorApplicationRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const svc = new AdvisorApplicationService(prisma)
  const canManage = requirePermission('advisor.manage')

  app.post('/api/v1/advisor-applications', {
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    schema: { tags: ['advisor-applications'], summary: 'طلب انضمام مستشار — من النموذج العامّ' },
  }, async (req, reply) => {
    assertNotBot(req.body)
    /* علامةُ الشروط شرطٌ للمرور هنا ولا تُحفظ هي: الخدمةُ تكتب ساعةَ قبولها (`termsAcceptedAt`) */
    return reply.status(201).send(await svc.submit(applicationBody.parse(req.body)))
  })

  app.get('/api/admin/advisor-applications', {
    preHandler: canManage,
    schema: { tags: ['admin-advisors'], summary: 'طلبات الانضمام مستشارا — بوصول كلّ متقدّم' },
  }, async () => svc.list())

  app.post('/api/admin/advisor-applications/:id/approve', {
    preHandler: canManage,
    schema: { tags: ['admin-advisors'], summary: 'قبول مستشار بنسبة عمولته — ينشئ حسابه ويرسل تفعيله' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const { commissionPct } = z.object({ commissionPct: z.number().min(0).max(100) }).parse(req.body)
    return svc.approve(req.auth!.userId, id, commissionPct)
  })

  app.post('/api/admin/advisor-applications/:id/reject', {
    preHandler: canManage,
    schema: { tags: ['admin-advisors'], summary: 'الاعتذار عن طلب مستشار — وسببه إن كتب يصله' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const { noteAr } = z.object({ noteAr: z.string().trim().max(500).optional() }).parse(req.body ?? {})
    return svc.reject(req.auth!.userId, id, noteAr)
  })
}
