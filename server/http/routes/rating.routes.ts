/* مسارات التقييم (١و).

   ثلاثة أسطح لا تتداخل صلاحياتها:
   · المتعلّم: يرى ما يستطيع تقييمه، ويرسل درجةً وتعليقا (rating.submit)
   · صاحب الشأن — مدرّبا كان أو مستشارا: يرى ما قيل عنه مجمّعا وفوق عتبة
     إخفاء الهوية، ولا يرى مُقيِّما (rating.view.subject)
   · الإدارة: تراجع التعليقات وتعتمد نشرها (rating.moderate)

   ولا يقرأ أحدٌ ما قيل عن غيره: معرّف الهدف يُشتقّ من الجلسة لا من الطلب. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { RatingService, SUBJECT_TYPES } from '../../services/rating.service'
import { AuthError } from '../../services/auth.service'
import { requirePermission } from '../auth-plugin'

export function registerRatingRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const ratings = new RatingService(prisma)

  /* ════ المتعلّم ════ */

  app.get('/api/learner/rateable', {
    preHandler: requirePermission('rating.submit'),
    schema: { tags: ['rating'], summary: 'ما يستطيع المتعلّم تقييمه ودرجاته السابقة' },
  }, async (req) => ratings.rateableFor(req.auth!.userId))

  app.post('/api/learner/ratings', {
    preHandler: requirePermission('rating.submit'),
    config: { rateLimit: { max: 30, timeWindow: '10 minutes' } },
    schema: {
      tags: ['rating'], summary: 'إرسال تقييم أو تعديله — واحد لكل تسجيل لكل هدف',
      body: {
        type: 'object', required: ['enrollmentId', 'subjectType', 'subjectId', 'score'],
        properties: {
          enrollmentId: { type: 'string' }, subjectType: { type: 'string' },
          subjectId: { type: 'string' }, score: { type: 'integer', minimum: 1, maximum: 5 },
          commentAr: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const body = z.object({
      enrollmentId: z.string().uuid(),
      subjectType: z.enum(SUBJECT_TYPES),
      subjectId: z.string().min(1).max(120),
      score: z.number().int().min(1).max(5),
      commentAr: z.string().max(1500).optional(),
    }).parse(req.body)
    return reply.status(201).send(await ratings.submit(req.auth!.userId, body))
  })

  /* ════ صاحب الشأن — عمّا قيل عنه هو وحده ════ */

  app.get('/api/me/ratings', {
    preHandler: requirePermission('rating.view.subject'),
    schema: { tags: ['rating'], summary: 'التقييمات الواردة عنّي — مجمّعة ومجهولة المُقيِّم' },
  }, async (req) => {
    const userId = req.auth!.userId
    /* المدرّب يُقيَّم بمعرّف ملفّه، والمستشار بمعرّف مستخدمه. ومن كان الاثنين
       يرى الاثنين. والمعرّف من الجلسة دائما — لا يأتي من الطلب. */
    const profile = await prisma.trainerProfile.findUnique({ where: { userId }, select: { id: true } })
    const roles = req.auth!.roles
    const out: Record<string, unknown> = {}
    if (profile) out.trainer = await ratings.forSubject('trainer', profile.id)
    if (roles.includes('advisor')) out.advisor = await ratings.forSubject('advisor', userId)
    if (!profile && !roles.includes('advisor')) {
      throw new AuthError('no_subject', 'لا تقييمات تخصّك — هذا السطح للمدرّبين والمستشارين', 404)
    }
    return out
  })

  /* ════ الإدارة ════ */

  app.get('/api/admin/ratings/queue', {
    preHandler: requirePermission('rating.moderate'),
    schema: {
      tags: ['rating'], summary: 'تعليقات التقييم بانتظار المراجعة — مجهولة المُقيِّم',
      querystring: { type: 'object', properties: { status: { type: 'string' } } },
    },
  }, async (req) => {
    const q = z.object({ status: z.enum(['pending', 'approved', 'rejected']).optional() }).parse(req.query)
    return ratings.moderationQueue(q.status ?? 'pending')
  })

  app.post('/api/admin/ratings/:id/moderate', {
    preHandler: requirePermission('rating.moderate'),
    schema: {
      tags: ['rating'], summary: 'اعتماد نشر تعليق أو رفضه — الدرجة لا تتأثّر',
      body: {
        type: 'object', required: ['approve'],
        properties: { approve: { type: 'boolean' }, reason: { type: 'string' } },
      },
    },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ approve: z.boolean(), reason: z.string().max(500).optional() }).parse(req.body)
    return ratings.moderate(id, req.auth!.userId, body.approve, body.reason)
  })
}
