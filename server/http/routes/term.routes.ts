/* مساراتُ الفصول — الإدارةُ تُنشئ وتضبط، والعامّةُ تقرأ «الفصل القادم».

   الفصلُ عمودُ الجدولة، وشرطُ وجوده أن يوجد **قبل الشعب**: قائمةُ المدرّبين
   المتاحين له لا يمكن أن تُبنى على شعبٍ لم تُنشأ بعد. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { TermService } from '../../services/term.service'
import { requirePermission } from '../auth-plugin'
import { TRAINING_SEASON_VALUES } from '../../../src/application/trainer/application-options'

export function registerTermRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const terms = new TermService(prisma)

  /* ─── العامّة: «متى تبدأ؟» صار له جواب (البند ٥٢) ───

     كان الجوابُ الصادقُ الوحيدُ «يُعلَن الموعدُ مع فتح الشعبة». وهذا يقول
     اسمَ الفصل وأشهرَه ونافذةَ تسجيله — بلا مصادقة، فالزائرُ هو المقصود. */
  app.get('/api/public/upcoming-term', {
    schema: { tags: ['public'], summary: 'الفصلُ القادم وأشهرُه ونافذةُ تسجيله' },
  }, async () => ({ term: await terms.publicUpcoming() }))

  app.get('/api/admin/terms', {
    preHandler: requirePermission('cohort.manage'),
    schema: { tags: ['admin-terms'], summary: 'الفصولُ مرتَّبةً بالبداية' },
  }, async (req) => {
    const { all } = z.object({ all: z.coerce.boolean().optional() }).parse(req.query)
    return terms.list({ includeClosed: all })
  })

  app.post('/api/admin/terms', {
    preHandler: requirePermission('cohort.manage'),
    schema: { tags: ['admin-terms'], summary: 'إنشاءُ فصلٍ — حدودُه تُحسب من موسمه لا تُكتب باليد' },
  }, async (req, reply) => {
    const body = z.object({
      year: z.number().int().min(2020).max(2100),
      season: z.enum(TRAINING_SEASON_VALUES),
    }).parse(req.body)
    return reply.status(201).send(await terms.create(req.auth!.userId, body))
  })

  /* نافذةُ التسجيل — بديلُ الدعوة الدائمة (البند ٥١) */
  app.post('/api/admin/terms/:id/registration-window', {
    preHandler: requirePermission('cohort.open'),
    schema: { tags: ['admin-terms'], summary: 'نافذةُ التسجيل — للفصل موعدٌ يُعلَن لا دعوةٌ دائمة' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      opensAt: z.coerce.date().nullable().optional(),
      closesAt: z.coerce.date().nullable().optional(),
    }).parse(req.body)
    return terms.setRegistrationWindow(id, req.auth!.userId, {
      opensAt: body.opensAt ?? null,
      closesAt: body.closesAt ?? null,
    })
  })

  /* السؤالُ الذي لم يكن له جوابٌ بالبناء: «من يستطيع التدريسَ في هذا الفصل؟» */
  app.get('/api/admin/terms/:id/available-trainers', {
    preHandler: requirePermission('trainer.assign'),
    schema: { tags: ['admin-terms'], summary: 'المدرّبون المتاحون لهذا الفصل — قبل أن تُنشأ شعبةٌ واحدة' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const { courseId } = z.object({ courseId: z.string().optional() }).parse(req.query)
    return terms.availableTrainers(id, { courseId })
  })

  app.post('/api/admin/terms/:id/trainers/:profileId', {
    preHandler: requirePermission('trainer.assign'),
    schema: { tags: ['admin-terms'], summary: 'إتاحةُ مدرّبٍ في فصل — إعلانٌ أو تأكيدٌ أو اعتذار' },
  }, async (req) => {
    const { id, profileId } = z.object({
      id: z.string().uuid(), profileId: z.string().uuid(),
    }).parse(req.params)
    const body = z.object({
      status: z.enum(['declared', 'confirmed', 'declined']),
      maxCohorts: z.number().int().min(1).max(20).nullable().optional(),
      note: z.string().max(500).nullable().optional(),
    }).parse(req.body)
    return terms.setTrainerAvailability(profileId, id, req.auth!.userId, body)
  })
}
