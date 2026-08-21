/* مسارات إدارة المدربين — مراجعة الطلبات، قرارات، عقود، دعوات،
   تأهيل، إسناد، شعب، نشر عام، إيقاف، ومراجعة اقتراحات التعديل. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { TrainerReviewService, RUBRIC_CRITERIA } from '../../services/trainer-review.service'
import { TrainerChangeService } from '../../services/trainer-change.service'
import { EarningsService } from '../../services/earnings.service'
import { requirePermission } from '../auth-plugin'
import { blastRadiusSentenceAr, courseBlastRadius } from '../../services/catalog-impact.service'
import { analyzeImpact } from '../../services/impact.service'

const rubricSchema = z.object(
  Object.fromEntries(RUBRIC_CRITERIA.map((k) => [k, z.number().int().min(1).max(5)])),
)

export function registerAdminTrainerRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const review = new TrainerReviewService(prisma)
  const changes = new TrainerChangeService(prisma)

  app.get('/api/admin/trainer-applications', {
    preHandler: requirePermission('trainer.applications.view'),
    schema: { tags: ['admin-trainers'], summary: 'كل طلبات انضمام المدربين — قابلة للترشيح بالحالة' },
  }, async (req) => {
    const { status } = z.object({ status: z.string().optional() }).parse(req.query)
    return review.listApplications(status)
  })

  app.get('/api/admin/trainer-applications/:id', {
    preHandler: requirePermission('trainer.applications.view'),
    schema: { tags: ['admin-trainers'], summary: 'تفاصيل طلب كاملة مع روابط وثائق موقعة مؤقتة' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return review.getApplication(id)
  })

  app.post('/api/admin/trainer-applications/:id/reviews', {
    preHandler: requirePermission('trainer.applications.review'),
    schema: { tags: ['admin-trainers'], summary: 'تسجيل تقييم روبرك بشري — تسعة محاور من 1 إلى 5' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ scores: rubricSchema, overallNote: z.string().max(2000).optional() }).parse(req.body)
    const r = await review.addReview(id, req.auth!.userId, body.scores, body.overallNote)
    return reply.status(201).send(r)
  })

  app.post('/api/admin/trainer-applications/:id/interviews', {
    preHandler: requirePermission('trainer.applications.review'),
    schema: { tags: ['admin-trainers'], summary: 'جدولة مقابلة — تنقل الطلب إلى interview_scheduled' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      scheduledAt: z.coerce.date(), mode: z.enum(['remote', 'in_person']).default('remote'),
      notes: z.string().max(1000).optional(),
    }).parse(req.body)
    const r = await review.scheduleInterview(id, req.auth!.userId, body)
    return reply.status(201).send(r)
  })

  app.post('/api/admin/trainer-interviews/:interviewId/outcome', {
    preHandler: requirePermission('trainer.applications.review'),
    schema: { tags: ['admin-trainers'], summary: 'تسجيل نتيجة مقابلة' },
  }, async (req) => {
    const { interviewId } = z.object({ interviewId: z.string().uuid() }).parse(req.params)
    const body = z.object({ outcome: z.enum(['passed', 'hold', 'failed']), notes: z.string().max(1000).optional() }).parse(req.body)
    return review.recordInterviewOutcome(interviewId, req.auth!.userId, body.outcome, body.notes)
  })

  app.post('/api/admin/trainer-applications/:id/demo-evaluations', {
    preHandler: requirePermission('trainer.applications.review'),
    schema: { tags: ['admin-trainers'], summary: 'تقييم الدرس التجريبي (Demo) بالروبرك نفسه' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      scores: rubricSchema, decision: z.enum(['pass', 'retry', 'fail']),
      notes: z.string().max(2000).optional(),
    }).parse(req.body)
    const r = await review.recordDemoEvaluation(id, req.auth!.userId, body.scores, body.decision, body.notes)
    return reply.status(201).send(r)
  })

  app.post('/api/admin/trainer-applications/:id/references', {
    preHandler: requirePermission('trainer.applications.review'),
    schema: { tags: ['admin-trainers'], summary: 'إضافة مرجع مهني' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      name: z.string().min(2), relation: z.string().optional(),
      contact: z.string().optional(), note: z.string().optional(),
    }).parse(req.body)
    return reply.status(201).send(await review.addReference(id, body))
  })

  app.post('/api/admin/trainer-references/:referenceId/verify', {
    preHandler: requirePermission('trainer.applications.review'),
    schema: { tags: ['admin-trainers'], summary: 'توثيق مرجع مهني بعد التحقق منه' },
  }, async (req) => {
    const { referenceId } = z.object({ referenceId: z.string().uuid() }).parse(req.params)
    return review.verifyReference(referenceId, req.auth!.userId)
  })

  app.post('/api/admin/trainer-applications/:id/decision', {
    preHandler: requirePermission('trainer.applications.decide'),
    schema: { tags: ['admin-trainers'], summary: 'قرار بشري — مراجعة/طلب معلومات/اختصار/ديمو/قبول مشروط/انتظار/رفض' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      action: z.enum(['move_to_review', 'request_info', 'shortlist', 'request_demo', 'academic_review',
        'conditionally_approve', 'waitlist', 'reject']),
      note: z.string().max(1000).optional(),
    }).parse(req.body)
    await review.decide(id, req.auth!.userId, body.action, body.note)
    return { ok: true }
  })

  app.post('/api/admin/trainer-applications/:id/contracts', {
    preHandler: requirePermission('trainer.compensation.manage'),
    schema: { tags: ['admin-trainers'], summary: 'إنشاء عقد وإرساله — ينقل الطلب إلى contract_pending' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ title: z.string().min(3), terms: z.record(z.string(), z.unknown()).optional() }).parse(req.body)
    return reply.status(201).send(await review.createContract(id, req.auth!.userId, body))
  })

  app.post('/api/admin/trainer-contracts/:contractId/sign', {
    preHandler: requirePermission('trainer.compensation.manage'),
    schema: { tags: ['admin-trainers'], summary: 'تسجيل توقيع العقد — ينقل الطلب إلى onboarding' },
  }, async (req) => {
    const { contractId } = z.object({ contractId: z.string().uuid() }).parse(req.params)
    await review.signContract(contractId, req.auth!.userId)
    return { ok: true }
  })

  app.post('/api/admin/trainer-applications/:id/invitations', {
    preHandler: requirePermission('trainer.invite'),
    schema: { tags: ['admin-trainers'], summary: 'إرسال دعوة آمنة لإنشاء الحساب — بعد الاعتماد والعقد' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const result = await review.createInvitation(id, req.auth!.userId)
    return reply.status(201).send({
      expiresAt: result.expiresAt,
      ...(process.env.NODE_ENV === 'production' ? {} : { devInvitationToken: result.tokenForDelivery }),
    })
  })

  /* ── التأهيل والإسناد والشعب والنشر العام والإيقاف ── */

  app.post('/api/admin/trainers/:profileId/qualifications', {
    preHandler: requirePermission('trainer.qualify'),
    schema: { tags: ['admin-trainers'], summary: 'تأهيل مدرب لدورة — سابق لأي إسناد' },
  }, async (req, reply) => {
    const { profileId } = z.object({ profileId: z.string().uuid() }).parse(req.params)
    const body = z.object({ courseId: z.string(), note: z.string().optional() }).parse(req.body)
    return reply.status(201).send(await review.qualifyForCourse(profileId, body.courseId, req.auth!.userId, body.note))
  })

  app.post('/api/admin/trainers/:profileId/assignments', {
    preHandler: requirePermission('trainer.assign'),
    schema: { tags: ['admin-trainers'], summary: 'إسناد مدرب إلى دورة/شعبة — يتطلب تأهيلا قائما' },
  }, async (req, reply) => {
    const { profileId } = z.object({ profileId: z.string().uuid() }).parse(req.params)
    const body = z.object({ courseId: z.string(), cohortId: z.string().uuid().optional() }).parse(req.body)
    return reply.status(201).send(await review.assignToCohort(profileId, body.courseId, body.cohortId, req.auth!.userId))
  })

  /* إنشاء الشعب انتقل إلى admin-learning.routes — نسخة أشمل بشروط الفتح والسعة والجدولة.
     يبقى هنا مسار النشر فقط لأنه يحمل دلالة الظهور العام لإسنادات المدربين. */

  app.post('/api/admin/cohorts/:cohortId/publish', {
    preHandler: requirePermission('trainer.assign'),
    schema: { tags: ['admin-trainers'], summary: 'نشر شعبة — تجعل إسناداتها قابلة للظهور العام' },
  }, async (req) => {
    const { cohortId } = z.object({ cohortId: z.string().uuid() }).parse(req.params)
    return review.publishCohort(cohortId, req.auth!.userId)
  })

  app.post('/api/admin/trainers/:profileId/publish-approval', {
    preHandler: requirePermission('trainer.publish'),
    schema: { tags: ['admin-trainers'], summary: 'موافقة الظهور العام — توثيق الملف وإظهاره للعامة' },
  }, async (req) => {
    const { profileId } = z.object({ profileId: z.string().uuid() }).parse(req.params)
    await review.approvePublicVisibility(profileId, req.auth!.userId)
    return { ok: true }
  })

  app.post('/api/admin/trainers/:profileId/suspend', {
    preHandler: requirePermission('trainer.suspend'),
    schema: { tags: ['admin-trainers'], summary: 'إيقاف مدرب — يبطل جلساته ويخفيه فورا' },
  }, async (req) => {
    const { profileId } = z.object({ profileId: z.string().uuid() }).parse(req.params)
    const body = z.object({ note: z.string().max(500).optional() }).parse(req.body ?? {})
    await review.suspendTrainer(profileId, req.auth!.userId, body.note)
    return { ok: true }
  })

  /* ── مراجعة اقتراحات تعديل الدورات من المدربين ── */

  app.get('/api/admin/trainer-change-requests', {
    preHandler: requirePermission('trainer.change.review'),
    schema: { tags: ['admin-trainers'], summary: 'اقتراحات تعديل الدورات من المدربين' },
  }, async (req) => {
    const { status } = z.object({ status: z.string().optional() }).parse(req.query)
    return changes.listForReview(status)
  })

  app.get('/api/admin/catalog/courses/:courseId/blast-radius', {
    preHandler: requirePermission('trainer.change.review'),
    schema: { tags: ['admin-trainers'], summary: 'دائرة أثر دورة — المسارات والقوالب والشعب والمتعلمون الذين يصلهم التعديل' },
  }, async (req) => {
    const { courseId } = z.object({ courseId: z.string().min(3).max(80) }).parse(req.params)
    const radii = await courseBlastRadius(prisma, [courseId])
    const radius = radii.get(courseId)!
    return { ...radius, sentenceAr: blastRadiusSentenceAr(radius) }
  })

  app.post('/api/admin/trainer-change-requests/:id/decision', {
    preHandler: requirePermission('trainer.change.review'),
    schema: { tags: ['admin-trainers'], summary: 'قرار مراجعة اقتراح — maker-checker مطبق' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      action: z.enum(['request_changes', 'reject', 'approve_for_cohort', 'approve_for_catalog']),
      comment: z.string().max(2000).optional(),
      scheduledPublishAt: z.coerce.date().optional(),
    }).parse(req.body)
    return changes.decide(id, req.auth!.userId, body.action, body.comment, body.scheduledPublishAt)
  })

  app.post('/api/admin/trainer-change-requests/:id/impact', {
    preHandler: requirePermission('trainer.change.review'),
    schema: { tags: ['admin-trainers'], summary: 'فحص الأثر التشخيصي — يشغّل ١٢ شخصية على المنشور مقابل المنشور+المعتمد ويقارن المسار والثقة والأسئلة' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return analyzeImpact(prisma, TrainerChangeService.impactRef(id), req.auth!.userId)
  })

  app.get('/api/admin/trainer-change-requests/:id/impact', {
    preHandler: requirePermission('trainer.change.review'),
    schema: { tags: ['admin-trainers'], summary: 'هل فُحص الأثر بعد الاعتماد؟ — شرط النشر بنطاق الكتالوج' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return changes.impactChecked(id)
  })

  app.post('/api/admin/trainer-change-requests/:id/publish', {
    preHandler: requirePermission('trainer.change.review'),
    schema: { tags: ['admin-trainers'], summary: 'نشر اقتراح معتمد في نطاقه — شعبة أو إصدار كتالوج جديد' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    await changes.publish(id, req.auth!.userId)
    return { ok: true }
  })

  /* ── مستحقات المدربين (كشوف الصرف) ── */
  const earnings = new EarningsService(prisma)

  app.get('/api/admin/trainer-profiles', {
    preHandler: requirePermission('trainer.compensation.manage'),
    schema: { tags: ['admin-trainers'], summary: 'ملفات المدربين النشطين — لنماذج الإنشاء' },
  }, async () => earnings.listProfiles())

  app.get('/api/admin/trainer-payouts', {
    preHandler: requirePermission('trainer.compensation.manage'),
    schema: { tags: ['admin-trainers'], summary: 'كل كشوف المستحقات مع أسماء المدربين — فلتر حالة اختياري' },
  }, async (req) => {
    const { status } = z.object({ status: z.string().optional() }).parse(req.query)
    return earnings.listAll(status)
  })

  app.post('/api/admin/trainer-payouts', {
    preHandler: requirePermission('trainer.compensation.manage'),
    schema: { tags: ['admin-trainers'], summary: 'إنشاء كشف مستحقات ببنوده — يولد بحالة «بانتظار الاعتماد»' },
  }, async (req, reply) => {
    const body = z.object({
      profileId: z.string().uuid(),
      period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'صيغة الفترة مثل 2026-08'),
      currency: z.string().length(3).optional(),
      items: z.array(z.object({
        description: z.string().min(3).max(300),
        amount: z.number().positive(),
        sourceRef: z.string().max(120).optional(),
      })).min(1).max(50),
    }).parse(req.body)
    const payout = await earnings.create(req.auth!.userId, body)
    return reply.status(201).send(payout)
  })

  app.post('/api/admin/trainer-payouts/:id/approve', {
    preHandler: requirePermission('trainer.compensation.manage'),
    schema: { tags: ['admin-trainers'], summary: 'اعتماد كشف — من «بانتظار الاعتماد» إلى «معتمد»' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return earnings.approve(id, req.auth!.userId)
  })

  app.post('/api/admin/trainer-payouts/:id/pay', {
    preHandler: requirePermission('trainer.compensation.manage'),
    schema: { tags: ['admin-trainers'], summary: 'تأكيد صرف كشف معتمد — يسجل وقت الصرف' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return earnings.markPaid(id, req.auth!.userId)
  })

  app.post('/api/admin/trainer-payouts/:id/cancel', {
    preHandler: requirePermission('trainer.compensation.manage'),
    schema: { tags: ['admin-trainers'], summary: 'إلغاء كشف لم يُصرف — بسبب موثق' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const { reason } = z.object({ reason: z.string().min(5).max(500) }).parse(req.body)
    return earnings.cancel(id, req.auth!.userId, reason)
  })

  /* ── قواعد الأتعاب والتوليد التلقائي من الشعب المكتملة ── */

  app.get('/api/admin/trainer-compensation-rules', {
    preHandler: requirePermission('trainer.compensation.manage'),
    schema: { tags: ['admin-trainers'], summary: 'قواعد أتعاب المدربين — كلها أو لمدرب محدد' },
  }, async (req) => {
    const { profileId } = z.object({ profileId: z.string().uuid().optional() }).parse(req.query)
    return earnings.listRules(profileId)
  })

  app.post('/api/admin/trainer-compensation-rules', {
    preHandler: requirePermission('trainer.compensation.manage'),
    schema: { tags: ['admin-trainers'], summary: 'تعيين قاعدة أتعاب — تُغلق السارية الحالية تلقائياً' },
  }, async (req, reply) => {
    const body = z.object({
      profileId: z.string().uuid(),
      type: z.enum(['per_seat', 'fixed_per_cohort', 'revenue_share']),
      rate: z.number().positive(),
      currency: z.string().length(3).optional(),
      effectiveFrom: z.coerce.date().optional(),
      minSeats: z.number().int().min(0).max(10000).optional(),
      courseId: z.string().min(1).optional(),
      cohortId: z.string().uuid().optional(),
    }).parse(req.body)
    const rule = await earnings.setRule(req.auth!.userId, body)
    return reply.status(201).send(rule)
  })

  app.get('/api/admin/trainer-payouts/preview-cohort/:cohortId', {
    preHandler: requirePermission('trainer.compensation.manage'),
    schema: { tags: ['admin-trainers'], summary: 'معاينة محسوبة لمستحقات شعبة — قبل التوليد، دون إنشاء شيء' },
  }, async (req) => {
    const { cohortId } = z.object({ cohortId: z.string().uuid() }).parse(req.params)
    return earnings.computeCohort(cohortId)
  })

  app.post('/api/admin/trainer-payouts/generate', {
    preHandler: requirePermission('trainer.compensation.manage'),
    schema: { tags: ['admin-trainers'], summary: 'توليد كشف من شعبة مكتملة — مفرد أو دفعي لكل المكتملة' },
  }, async (req, reply) => {
    const body = z.object({
      cohortId: z.string().uuid().optional(),
      period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
      batch: z.boolean().optional(),
    }).parse(req.body ?? {})
    if (body.batch) return earnings.generateBatch(req.auth!.userId, body.period)
    if (!body.cohortId) throw Object.assign(new Error('حدد cohortId أو batch=true'), { statusCode: 400 })
    const payout = await earnings.generateForCohort(req.auth!.userId, body.cohortId, body.period)
    return reply.status(201).send(payout)
  })
}
