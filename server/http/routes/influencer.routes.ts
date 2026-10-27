/* المؤثّرون — بابُ صاحب المنصّة إليهم، وبابُ المؤثّر إلى كشفه (٢٦ أكتوبر ٢٠٢٦). والعلّةُ في `influencer.service.ts`.

   الإدارةُ بصلاحيّة الكوبونات (`commerce.manage`) كإعدادات المنحة: منحةُ المؤثّرين كوبونٌ بحملة، ومن يملك نسبتَها
   يملك من ينشرها وعمولتَه. ويملكها المديرُ والماليّة — والماليّةُ تسجّل ما دُفع له. والمؤثّرُ يرى كشفَه وحدَه:
   الخدمةُ تقرؤه بحسابه لا بمعرّفٍ يُرسَل. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { requirePermission } from '../auth-plugin'
import { InfluencerService } from '../../services/influencer.service'
import { GrantService } from '../../services/grant.service'
import { INFLUENCER_GRANT_SLUG } from '../../../src/application/commerce/grant'
import { grantRegistrants } from '../../services/grant-followup.service'
import { INFLUENCER_COMMISSION_DEFAULT } from '../../../src/application/commerce/influencer'

export function registerInfluencerRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const influencers = new InfluencerService(prisma)
  const grant = new GrantService(prisma, INFLUENCER_GRANT_SLUG)
  const canManage = requirePermission('commerce.manage')
  const id = z.object({ id: z.string().uuid() })

  /* ═══ إعداداتُ «منحة مؤثرين وجيز» — كإعدادات الأولى بصفّها هي ═══ */
  app.get('/api/admin/influencer-grant', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'إعدادات منحة المؤثرين وما جرى بها' },
  }, async () => grant.settings())

  app.put('/api/admin/influencer-grant', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'تغيير نسبة منحة المؤثرين أو عددها أو نهايتها أو تشغيلها' },
  }, async (req) => {
    const body = z.object({
      percentOff: z.number().int().min(1).max(100).optional(),
      maxCodes: z.number().int().min(1).nullable().optional(),
      maxCourses: z.number().int().min(1).max(20).optional(),
      closesAt: z.coerce.date().nullable().optional(),
      active: z.boolean().optional(),
    }).parse(req.body ?? {})
    return grant.update(body, req.auth!.userId)
  })

  /* والهامشُ بعد عمولة المؤثّر — بأعلى عمولةٍ لمؤثّرٍ نشط، فلا يُرى هامشٌ أحسنُ ممّا يقع */
  /* ومن عبّأ نموذجَها — كقائمة المنحة الأولى (`grantRegistrants`) */
  app.get('/api/admin/influencer-grant/registrants', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'من عبأ نموذج منحة المؤثرين: بياناته وكود مؤثره وما فعل ومستشاره' },
  }, async () => grantRegistrants(prisma, INFLUENCER_GRANT_SLUG))

  app.get('/api/admin/influencer-grant/margins', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'سعر كل شعبة بعد منحة المؤثرين مقابل أجر مقعدها وعمولة المؤثر' },
  }, async (req) => {
    const { percentOff } = z.object({ percentOff: z.coerce.number().int().min(1).max(100).optional() }).parse(req.query)
    const top = await prisma.influencer.aggregate({ where: { active: true }, _max: { commissionPercent: true } })
    return grant.margins(percentOff, top._max.commissionPercent ?? INFLUENCER_COMMISSION_DEFAULT)
  })

  /* ═══ المؤثّرون ═══ */
  app.get('/api/admin/influencers', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'المؤثرون وأكوادهم ومن جاء بكل منهم وعمولتهم' },
  }, async () => influencers.list())

  app.post('/api/admin/influencers', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'إضافة مؤثر باسمه وكوده وعمولته — وببريده حسابه' },
  }, async (req, reply) => {
    const body = z.object({
      nameAr: z.string().trim().min(2).max(120),
      code: z.string().trim().min(3).max(40),
      commissionPercent: z.number().int().min(0).max(100),
      email: z.string().trim().max(200).nullable().optional(),
    }).parse(req.body)
    return reply.status(201).send(await influencers.create(body, req.auth!.userId))
  })

  app.patch('/api/admin/influencers/:id', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'اسم المؤثر وعمولته وإيقافه — والكود لا يتغير' },
  }, async (req) => {
    const body = z.object({
      nameAr: z.string().trim().min(2).max(120).optional(),
      commissionPercent: z.number().int().min(0).max(100).optional(),
      active: z.boolean().optional(),
    }).parse(req.body ?? {})
    return influencers.update(id.parse(req.params).id, body, req.auth!.userId)
  })

  app.post('/api/admin/influencers/:id/account', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'ربط المؤثر بحساب ببريده، أو إنشاء حساب له بدعوة' },
  }, async (req) => {
    const { email } = z.object({ email: z.string().trim().max(200) }).parse(req.body)
    return influencers.attachAccount(id.parse(req.params).id, email, req.auth!.userId)
  })

  app.get('/api/admin/influencers/:id/statement', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'كشف المؤثر: من اشترى بكوده وعمولة كل طلب وما دفع له' },
  }, async (req) => influencers.statement(id.parse(req.params).id))

  app.post('/api/admin/influencers/:id/payouts', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'تسجيل دفعة دفعت للمؤثر من عمولته' },
  }, async (req, reply) => {
    const body = z.object({ amount: z.number().positive().max(1_000_000), noteAr: z.string().max(300).nullable().optional() }).parse(req.body)
    return reply.status(201).send(await influencers.recordPayout(id.parse(req.params).id, body, req.auth!.userId))
  })

  /* ═══ حسابُ المؤثّر ═══ */
  app.get('/api/influencer/me', {
    preHandler: requirePermission('influencer.portal'),
    schema: { tags: ['influencer'], summary: 'كشف المؤثر: كوده ورابطه ومن جاء به وعمولته وما دفع له' },
  }, async (req) => influencers.portal(req.auth!.userId))
}
