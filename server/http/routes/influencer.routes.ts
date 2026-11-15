/* المؤثّرون — بابُ صاحب المنصّة إليهم، وبابُ المؤثّر إلى كشفه (٢٦ أكتوبر ٢٠٢٦). والعلّةُ في `influencer.service.ts`.
   وإعداداتُ حملتَي المؤثّرين هنا: «منحة مؤثرين وجيز» و«بلاك فرايدي وجيز» (١٥ نوفمبر ٢٠٢٦).

   الإدارةُ بصلاحيّة الكوبونات (`commerce.manage`) كإعدادات المنحة: منحةُ المؤثّرين كوبونٌ بحملة، ومن يملك نسبتَها
   يملك من ينشرها وعمولتَه. ويملكها المديرُ والماليّة — والماليّةُ تسجّل ما دُفع له. والمؤثّرُ يرى كشفَه وحدَه:
   الخدمةُ تقرؤه بحسابه لا بمعرّفٍ يُرسَل. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { requirePermission } from '../auth-plugin'
import { InfluencerService } from '../../services/influencer.service'
import { GrantService } from '../../services/grant.service'
import { GrantCourseChoiceService } from '../../services/grant-scope.service'
import { BLACK_FRIDAY_GRANT_SLUG, INFLUENCER_GRANT_SLUG } from '../../../src/application/commerce/grant'
import { INFLUENCER_COMMISSION_DEFAULT } from '../../../src/application/commerce/influencer'

export function registerInfluencerRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const influencers = new InfluencerService(prisma)
  const grant = new GrantService(prisma, INFLUENCER_GRANT_SLUG)
  const canManage = requirePermission('commerce.manage')
  const id = z.object({ id: z.string().uuid() })

  const settingsBody = z.object({
    percentOff: z.number().int().min(1).max(100).optional(),
    maxCodes: z.number().int().min(1).nullable().optional(),
    maxCourses: z.number().int().min(1).max(20).optional(),
    closesAt: z.coerce.date().nullable().optional(),
    active: z.boolean().optional(),
  })

  /* ═══ إعداداتُ حملتَي المؤثّرين — «منحة مؤثرين وجيز» و«بلاك فرايدي وجيز» (١٥ نوفمبر ٢٠٢٦)، كلٌّ بصفّه هو ═══ */
  for (const [path, svc, nameAr] of [
    ['/api/admin/influencer-grant', grant, 'منحة المؤثرين'],
    ['/api/admin/black-friday-grant', new GrantService(prisma, BLACK_FRIDAY_GRANT_SLUG), 'بلاك فرايدي وجيز'],
  ] as const) {
    app.get(path, {
      preHandler: canManage,
      schema: { tags: ['admin-commerce'], summary: `إعدادات ${nameAr} وما جرى بها` },
    }, async () => svc.settings())

    app.put(path, {
      preHandler: canManage,
      schema: { tags: ['admin-commerce'], summary: `تغيير نسبة ${nameAr} أو عددها أو نهايتها أو تشغيلها` },
    }, async (req) => svc.update(settingsBody.parse(req.body ?? {}), req.auth!.userId))

    /* والهامشُ بعد عمولة المؤثّر — بأعلى عمولةٍ لمؤثّرٍ نشط، فلا يُرى هامشٌ أحسنُ ممّا يقع */
    app.get(`${path}/margins`, {
      preHandler: canManage,
      schema: { tags: ['admin-commerce'], summary: `سعر كل شعبة بعد ${nameAr} مقابل أجر مقعدها وعمولة المؤثر` },
    }, async (req) => {
      const { percentOff } = z.object({ percentOff: z.coerce.number().int().min(1).max(100).optional() }).parse(req.query)
      const top = await prisma.influencer.aggregate({ where: { active: true }, _max: { commissionPercent: true } })
      return svc.margins(percentOff, top._max.commissionPercent ?? INFLUENCER_COMMISSION_DEFAULT)
    })
  }

  /* ═══ المؤثّرون ═══ */
  app.get('/api/admin/influencers', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'المؤثرون وأكوادهم ومن جاء بكل منهم وعمولتهم' },
  }, async () => influencers.list())

  app.post('/api/admin/influencers', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'إضافة مؤثر باسمه وكوده وعمولته وبريده — حسابه وبريد ترحيبه كقبول طلبه' },
  }, async (req, reply) => {
    /* والبريدُ لازم — لكلّ مؤثّرٍ حسابٌ وصفحة (١٥ نوفمبر ٢٠٢٦). والخدمةُ تردّه بسببه (`email_required`، ٤٠٠) */
    const body = z.object({
      nameAr: z.string().trim().min(2).max(120),
      code: z.string().trim().min(3).max(40),
      commissionPercent: z.number().int().min(0).max(100),
      percentOff: z.number().int().min(0).max(100).nullable().optional(),
      email: z.string().trim().max(200).nullable().optional(),
    }).parse(req.body)
    return reply.status(201).send(await influencers.create({ ...body, email: body.email ?? '' }, req.auth!.userId))
  })

  app.patch('/api/admin/influencers/:id', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'اسم المؤثر وعمولته وخصم متابعيه وكوده وإيقافه — والرابط القديم يبقى يعمل' },
  }, async (req) => {
    const body = z.object({
      nameAr: z.string().trim().min(2).max(120).optional(),
      commissionPercent: z.number().int().min(0).max(100).optional(),
      /* خصمُ متابعيه — و`null` يعيده إلى نسبة الحملة (١٥ نوفمبر ٢٠٢٦) */
      percentOff: z.number().int().min(0).max(100).nullable().optional(),
      code: z.string().trim().min(3).max(40).optional(),
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
    /* وما زاد على رصيده يُردّ بخيارَيه حتّى يُرسَل `advance: true` — والعلّةُ في `recordPayout` */
    const body = z.object({
      amount: z.number().positive().max(1_000_000), noteAr: z.string().max(300).nullable().optional(), advance: z.boolean().optional(),
    }).parse(req.body)
    return reply.status(201).send(await influencers.recordPayout(id.parse(req.params).id, body, req.auth!.userId))
  })

  /* ═══ ودوراتُه من دورات حملته (١٥ نوفمبر ٢٠٢٦) ═══
     بعضُ قائمة «منحة مؤثرين وجيز» تُعرض في صفحته — والفارغةُ قائمتُها كلُّها. وكودُ من جاء به يخصم على أيّ دورةٍ حتى حدّه (`grant-scope.service.ts`) */
  const choice = new GrantCourseChoiceService(prisma)
  app.get('/api/admin/influencers/:id/courses', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'دورات المؤثر: ما اختير له من دورات منحة المؤثرين، وما يختار منه' },
  }, async (req) => choice.influencerChoice(id.parse(req.params).id))

  app.put('/api/admin/influencers/:id/courses', {
    preHandler: canManage,
    schema: { tags: ['admin-commerce'], summary: 'اختيار دورات المؤثر من دورات منحة المؤثرين — والفارغة تعيده إليها كلها' },
  }, async (req) => {
    const { courseIds } = z.object({ courseIds: z.array(z.string().trim().min(1).max(64)).max(500) }).parse(req.body ?? {})
    return choice.setInfluencerCourses(id.parse(req.params).id, courseIds, req.auth!.userId)
  })

  /* ═══ حسابُ المؤثّر ═══ */
  app.get('/api/influencer/me', {
    preHandler: requirePermission('influencer.portal'),
    schema: { tags: ['influencer'], summary: 'كشف المؤثر: كوده ورابطه ومن جاء به وعمولته وما دفع له' },
  }, async (req) => influencers.portal(req.auth!.userId))
}
