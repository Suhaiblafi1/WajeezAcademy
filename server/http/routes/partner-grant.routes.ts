/* منحُ الشركاء — أبوابُها العامّةُ وأبوابُ المدير (١٥ نوفمبر ٢٠٢٦). والعلّةُ في `server/services/partner-grant.service.ts`.

   · **للزائر بلا حساب**: صفحةُ الشريك، وطلبُ رابط التأكيد ببريد الجامعة، وفتحُه. وسقفُ طلب الرابط عشرٌ لكلّ شبكةٍ في ربع
     ساعة — كلُّ طلبٍ بريدٌ يخرج من نطاقنا، ومع السقف ثلاثةُ روابطَ في الساعة لكلّ بريد (`PARTNER_LINKS_PER_HOUR`).
   · **وشعارُه للعامّة** بلا توقيع ما دام الشريكُ مشغَّلا — كصورة المدرّب، فالحارسُ حالُه لا التوقيع.
   · **وللمدير بصلاحيّة إعدادات المنح** (`commerce.manage`): الشركاءُ وإعداداتُهم وشعارُهم ودوراتُهم ومن أكّد بريدَه. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { assertNotBot } from '../honeypot'
import { requirePermission } from '../auth-plugin'
import { PartnerGrantService } from '../../services/partner-grant.service'
import { PartnerRevenueService } from '../../services/partner-revenue.service'
import { GrantCourseChoiceService } from '../../services/grant-scope.service'
import { assertSafeKey, getObject, getObjectMeta } from '../../services/object-store'
import { partnerCampaignSlug } from '../../../src/application/commerce/partner-grant'
import { zonedDay } from '../../../src/application/trainer/cohort-period'

/** سقفُ طلب رابط التأكيد لكلّ شبكةٍ في ربع ساعة */
export const PARTNER_LINK_RATE_MAX = 10

const partnerBody = z.object({
  nameAr: z.string().trim().min(2, 'اكتب اسم الشريك').max(120),
  nameEn: z.string().trim().max(120).nullable().optional(),
  type: z.enum(['university', 'company']),
  domains: z.array(z.string().trim().max(100)).min(1, 'اكتب نطاقا واحدا على الأقل').max(10),
  percentOff: z.number().int().min(1).max(100),
  maxCourses: z.number().int().min(1).max(20),
  maxCodes: z.number().int().min(1).nullable().optional(),
  closesAt: z.coerce.date().nullable().optional(),
  active: z.boolean().optional(),
  /* حصّتُه ممّا يُدفع قبل أجور المدرّبين (١٦ نوفمبر ٢٠٢٦) — وفارغةٌ: بلا حصّة */
  sharePercent: z.number().int().min(0).max(100).nullable().optional(),
})

export function registerPartnerGrantRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const partners = new PartnerGrantService(prisma)
  const choice = new GrantCourseChoiceService(prisma)
  const revenue = new PartnerRevenueService(prisma)
  const canManage = requirePermission('commerce.manage')
  const slugParam = z.object({ slug: z.string().trim().min(1).max(40) })
  const idParam = z.object({ id: z.string().uuid() })

  /* ═══ للزائر ═══ */

  app.get('/api/public/grant/p/:slug', {
    schema: { tags: ['public'], summary: 'صفحة منحة الشريك: هو وشعاره وحال منحته ودوراتها' },
  }, async (req) => partners.view(slugParam.parse(req.params).slug))

  app.post('/api/public/grant/p/:slug/link', {
    config: { rateLimit: { max: PARTNER_LINK_RATE_MAX, timeWindow: '15 minutes' } },
    schema: { tags: ['public'], summary: 'طلب رابط تأكيد بريد الجامعة — والجواب واحد لكل بريد' },
  }, async (req, reply) => {
    assertNotBot(req.body)
    const body = z.object({
      fullName: z.string().trim().min(2, 'اكتب اسمك').max(120),
      email: z.string().trim().toLowerCase().email('صيغة البريد غير صحيحة').max(200),
      phone: z.string().trim().max(30).nullable().optional(),
      channel: z.string().max(40).nullable().optional(),
      wave: z.string().max(40).nullable().optional(),
    }).parse(req.body)
    return reply.status(202).send(await partners.requestLink(slugParam.parse(req.params).slug, body, req.ip))
  })

  app.post('/api/public/grant/p/:slug/confirm', {
    config: { rateLimit: { max: 30, timeWindow: '15 minutes' } },
    schema: { tags: ['public'], summary: 'فتح رابط التأكيد: يستعمل مرة، ويعطي كود المنحة' },
  }, async (req) => {
    const { token } = z.object({ token: z.string().trim().min(20).max(200) }).parse(req.body)
    return partners.confirm(slugParam.parse(req.params).slug, token, req.ip)
  })

  app.get('/api/v1/partner-logos/:storageKey', {
    schema: { tags: ['public'], summary: 'شعار شريك منحة مشغل — بلا توقيع، ويختفي بإيقافه' },
  }, async (req, reply) => {
    const { storageKey } = z.object({ storageKey: z.string().min(10) }).parse(req.params)
    assertSafeKey(storageKey)
    const content = (await partners.publicLogo(storageKey)) ? await getObject(storageKey) : null
    if (!content) return reply.status(404).send({ error: { code: 'not_found', message_ar: 'لا شعار' } })
    const meta = await getObjectMeta(storageKey)
    reply.header('content-type', meta?.mime || 'image/png')
    reply.header('x-content-type-options', 'nosniff')
    reply.header('cache-control', 'public, max-age=3600')
    return reply.send(content)
  })

  /* ═══ للمدير ═══ */

  app.get('/api/admin/partners', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'شركاء المنح: كل شريك بإعداداته وما جرى بمنحته' },
  }, async () => partners.list())

  app.post('/api/admin/partners', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'إضافة شريك — والرابط لا يتغير بعدها' },
  }, async (req, reply) => {
    const body = partnerBody.extend({ slug: z.string().trim().min(2).max(30) }).parse(req.body ?? {})
    return reply.status(201).send(await partners.create(body, req.auth!.userId))
  })

  app.get('/api/admin/partners/:id', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'شريك بإعداداته' },
  }, async (req) => partners.get(idParam.parse(req.params).id))

  app.put('/api/admin/partners/:id', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'تعديل شريك: الاسم والنطاقات والنسبة والحد والنهاية والتشغيل' },
  }, async (req) => {
    const body = partnerBody.partial().extend({ slug: z.string().optional() }).parse(req.body ?? {})
    return partners.update(idParam.parse(req.params).id, body, req.auth!.userId)
  })

  app.post('/api/admin/partners/:id/logo', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'رابط رفع شعار الشريك — صورة فقط' },
  }, async (req) => {
    const body = z.object({ mime: z.string().max(60), sizeBytes: z.number().int().positive() }).parse(req.body ?? {})
    return partners.requestLogo(idParam.parse(req.params).id, body, req.auth!.userId)
  })

  app.post('/api/admin/partners/:id/logo/commit', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'اعتماد الشعار بعد رفعه' },
  }, async (req) => partners.commitLogo(idParam.parse(req.params).id, req.auth!.userId))

  app.delete('/api/admin/partners/:id/logo', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'إزالة شعار الشريك — ويكتب اسمه مكانه' },
  }, async (req) => partners.removeLogo(idParam.parse(req.params).id, req.auth!.userId))

  /* الشعارُ للمدير ولو كان الشريكُ موقوفا — يراه قبل أن يشغّله */
  app.get('/api/admin/partners/:id/logo', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'شعار الشريك للمدير' },
  }, async (req, reply) => {
    const key = await partners.adminLogoKey(idParam.parse(req.params).id)
    const content = key ? await getObject(key) : null
    if (!key || !content) return reply.status(404).send({ error: { code: 'not_found', message_ar: 'لا شعار' } })
    const meta = await getObjectMeta(key)
    reply.header('content-type', meta?.mime || 'image/png')
    reply.header('x-content-type-options', 'nosniff')
    reply.header('cache-control', 'private, no-store')
    return reply.send(content)
  })

  /* دوراتُ صفحة الشريك — باختيار دورات المنح نفسِه (`GrantCourseChoice`) */
  app.get('/api/admin/partners/:id/courses', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'دورات صفحة الشريك: ما اختاره المدير، وما يختار منه' },
  }, async (req) => {
    const p = await partners.get(idParam.parse(req.params).id)
    return choice.campaignChoice(partnerCampaignSlug(p.slug))
  })

  app.put('/api/admin/partners/:id/courses', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'اختيار دورات صفحة الشريك — والقائمة الفارغة تعيدها تلقائية' },
  }, async (req) => {
    const p = await partners.get(idParam.parse(req.params).id)
    const { courseIds } = z.object({ courseIds: z.array(z.string().trim().min(1).max(64)).max(500) }).parse(req.body ?? {})
    return choice.setCampaignCourses(partnerCampaignSlug(p.slug), courseIds, req.auth!.userId)
  })

  app.get('/api/admin/partners/:id/claims', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'من أكد بريده في منحة الشريك: متى، وكوده، وما اشترى' },
  }, async (req) => partners.claims(idParam.parse(req.params).id))

  app.get('/api/admin/partners/:id/claims.xlsx', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'من أكد بريده في منحة الشريك في ملف Excel' },
  }, async (req, reply) => {
    const { buf, nameAr } = await partners.claimsXlsx(idParam.parse(req.params).id)
    const name = `منحة ${nameAr} ${zonedDay(new Date())}.xlsx`
    return reply
      .header('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('content-disposition', `attachment; filename="partner-claims.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}`)
      .send(buf)
  })

  /* ═══ حصّةُ الشريك من الإيراد — كشفُه وصرفُه وحسابُ ممثّله (١٦ نوفمبر ٢٠٢٦، `partner-revenue.service.ts`) ═══ */

  app.get('/api/admin/partners/:id/revenue', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'كشف حصة الشريك: من سجل ومن دفع وحصته عن كل طلب وما صرف له' },
  }, async (req) => revenue.statement(idParam.parse(req.params).id))

  app.get('/api/admin/partners/:id/revenue.csv', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'كشف حصة الشريك ملفا يدقق' },
  }, async (req, reply) => {
    const { text, nameAr } = await revenue.csv(null, idParam.parse(req.params).id)
    return csvReply(reply, text, nameAr)
  })

  app.post('/api/admin/partners/:id/payouts', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'تسجيل ما صرف للشريك من حصته' },
  }, async (req) => {
    const body = z.object({
      amount: z.number().positive().max(1_000_000),
      noteAr: z.string().trim().max(300).nullable().optional(),
      advance: z.boolean().optional(),
    }).parse(req.body)
    return revenue.recordPayout(idParam.parse(req.params).id, body, req.auth!.userId)
  })

  app.post('/api/admin/partners/:id/account', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'حساب ممثل الشريك الذي يرى لوحته — بريد له حساب أو جديد بدعوة' },
  }, async (req) => {
    const { email } = z.object({ email: z.string().trim().max(200) }).parse(req.body)
    return revenue.attachAccount(idParam.parse(req.params).id, email, req.auth!.userId)
  })

  /* ═══ لوحةُ ممثّل الشريك — كشفُ شريكه وحدَه ═══ */

  app.get('/api/partner/me', {
    preHandler: requirePermission('partner.portal'),
    schema: { tags: ['partner'], summary: 'لوحة الشريك: من سجل برابطه ومن دفع وحصته وما صرف له' },
  }, async (req) => revenue.portal(req.auth!.userId))

  app.get('/api/partner/me.csv', {
    preHandler: requirePermission('partner.portal'),
    schema: { tags: ['partner'], summary: 'كشف الشريك ملفا يدقق' },
  }, async (req, reply) => {
    const { text, nameAr } = await revenue.csv(req.auth!.userId)
    return csvReply(reply, text, nameAr)
  })
}

/** الكشفُ ملفّا باسم الشريك واليوم */
function csvReply(reply: import('fastify').FastifyReply, text: string, nameAr: string) {
  const name = `حصة ${nameAr} ${zonedDay(new Date())}.csv`
  return reply
    .header('content-type', 'text/csv; charset=utf-8')
    .header('content-disposition', `attachment; filename="partner-revenue.csv"; filename*=UTF-8''${encodeURIComponent(name)}`)
    .send(text)
}
