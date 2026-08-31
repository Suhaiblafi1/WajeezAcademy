/* مسارات خطّة المتعلّم (التوصية ١) — خطّةٌ فعّالة واحدة لكلّ حساب.

   الصلاحية `learner.portal`: الخطّة جزءٌ من بوابته لا امتيازٌ مستقل. ولا يقرأ
   أحدٌ خطّة غيره: المعرّف من الجلسة دائما، ولا يُقبل من الطلب. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { PlanService } from '../../services/plan.service'
import { requirePermission } from '../auth-plugin'

const courseIds = z.array(z.string().trim().min(1).max(60)).min(1).max(12)

export function registerPlanRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const plans = new PlanService(prisma)

  app.get('/api/learner/plan', {
    preHandler: requirePermission('learner.portal'),
    schema: { tags: ['plan'], summary: 'الخطّة الفعّالة — بحالة مشتقّة لكل دورة' },
  }, async (req) => ({ plan: await plans.active(req.auth!.userId) }))

  app.post('/api/learner/plan', {
    preHandler: requirePermission('learner.portal'),
    config: { rateLimit: { max: 20, timeWindow: '10 minutes' } },
    schema: {
      tags: ['plan'], summary: 'اعتماد خطّة — تُؤرشَف السابقة',
      body: {
        type: 'object', required: ['nameAr', 'courseIds'],
        properties: {
          nameAr: { type: 'string' }, composed: { type: 'boolean' },
          hostPathwayId: { type: 'string' }, giftCourseId: { type: 'string' },
          courseIds: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  }, async (req, reply) => {
    const body = z.object({
      nameAr: z.string().trim().min(1).max(120),
      composed: z.boolean().optional(),
      hostPathwayId: z.string().trim().max(60).optional(),
      giftCourseId: z.string().trim().max(60).optional(),
      courseIds,
    }).parse(req.body)
    const plan = await plans.adopt(req.auth!.userId, {
      nameAr: body.nameAr,
      composed: body.composed ?? false,
      hostPathwayId: body.hostPathwayId ?? null,
      giftCourseId: body.giftCourseId ?? null,
      courseIds: body.courseIds,
    })
    return reply.status(201).send({ plan })
  })

  /* ── الدورة التي لا شعبة لها: ثلاثة أبواب ──

     كانت تُعرض ويُقال «نُعلمك عند فتحها» — صادقٌ لكنّه لا يترك للمتعلّم شيئا
     يفعله، وقد ينتظر شهورا. فالأبواب: بدائلُ لها شعبةٌ الآن · حذفُها ·
     إبقاؤها بإشعارٍ أو بلا إشعار. والمعرّف من الجلسة دائما. */

  app.get('/api/learner/plan/items/:courseId/alternatives', {
    preHandler: requirePermission('learner.portal'),
    schema: { tags: ['plan'], summary: 'بدائلُ دورةٍ لا شعبةَ لها — بما تشاركه من مهارات' },
  }, async (req) => {
    const { courseId } = req.params as { courseId: string }
    return { alternatives: await plans.alternativesFor(req.auth!.userId, courseId) }
  })

  app.put('/api/learner/plan/items/:courseId/replace', {
    preHandler: requirePermission('learner.portal'),
    config: { rateLimit: { max: 30, timeWindow: '10 minutes' } },
    schema: { tags: ['plan'], summary: 'يستبدل دورةً بأخرى في موضعها نفسِه' },
  }, async (req) => {
    const { courseId } = req.params as { courseId: string }
    const body = z.object({ withCourseId: z.string().trim().min(1).max(60) }).parse(req.body)
    return { plan: await plans.replaceItem(req.auth!.userId, courseId, body.withCourseId) }
  })

  app.delete('/api/learner/plan/items/:courseId', {
    preHandler: requirePermission('learner.portal'),
    config: { rateLimit: { max: 30, timeWindow: '10 minutes' } },
    schema: { tags: ['plan'], summary: 'يحذف دورةً من الخطّة — ولا تبقى فارغة' },
  }, async (req) => {
    const { courseId } = req.params as { courseId: string }
    return { plan: await plans.removeItem(req.auth!.userId, courseId) }
  })

  app.put('/api/learner/plan/items/:courseId/notify', {
    preHandler: requirePermission('learner.portal'),
    config: { rateLimit: { max: 60, timeWindow: '10 minutes' } },
    schema: { tags: ['plan'], summary: 'يُبقيها منتظرةً — بإشعارٍ عند الفتح أو بلا' },
  }, async (req) => {
    const { courseId } = req.params as { courseId: string }
    const body = z.object({ on: z.boolean() }).parse(req.body)
    return { plan: await plans.setNotify(req.auth!.userId, courseId, body.on) }
  })

  app.put('/api/learner/plan/courses', {
    preHandler: requirePermission('learner.portal'),
    config: { rateLimit: { max: 60, timeWindow: '10 minutes' } },
    schema: {
      tags: ['plan'], summary: 'تبديل دورات الخطّة الفعّالة — الاسم والهوية يبقيان',
      body: {
        type: 'object', required: ['courseIds'],
        properties: { courseIds: { type: 'array', items: { type: 'string' } }, giftCourseId: { type: 'string' } },
      },
    },
  }, async (req) => {
    const body = z.object({ courseIds, giftCourseId: z.string().trim().max(60).nullable().optional() }).parse(req.body)
    return { plan: await plans.replaceCourses(req.auth!.userId, body.courseIds, body.giftCourseId ?? null) }
  })
}
