/* مسارات إدارة التشغيل الأكاديمي — شعب، جلسات، روابط Zoom يدوية،
   مواد وتسجيلات خاصة، تسجيل متعلمين، روبرك، تقييمات، قواعد إكمال، شهادات. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { isDayCode } from '../../../src/application/schedule/days'
import type { PrismaClient } from '@prisma/client'
import { CohortService } from '../../services/cohort.service'
import { openAllCohorts, alignCohortPrices } from '../../services/catalog-readiness.service'
import { EnrollmentService } from '../../services/enrollment.service'
import { AssessmentService } from '../../services/assessment.service'
import { ProgressService } from '../../services/progress.service'
import { CertificateService } from '../../services/certificate.service'
import { requirePermission } from '../auth-plugin'

/* الأيّامُ رموزٌ معروفةٌ لا نصٌّ حرّ.

   كانت `z.array(z.string())` تقبل «الأحد» كما تقبل `sun`، فتُخزَّن الشعبةُ
   بتمثيلٍ لا يعرفه العارضُ ولا الفارز. والمنتقي في الواجهة يمنع ذلك بالنقر،
   لكنّ الواجهة ليست الحدّ — من ينادي الـAPI مباشرةً يتجاوزها. */
const dayCodes = z.array(z.string()).refine(
  (days) => days.every(isDayCode),
  { message: 'يومٌ غير معروف — الأيّام رموز: sun mon tue wed thu fri sat' },
)

export function registerAdminLearningRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const cohorts = new CohortService(prisma)
  const enrollments = new EnrollmentService(prisma)
  const assessments = new AssessmentService(prisma)
  const progress = new ProgressService(prisma)
  const certificates = new CertificateService(prisma)

  /* ── الشعب ── */
  app.get('/api/admin/cohorts', {
    preHandler: requirePermission('cohort.manage'),
    schema: { tags: ['admin-learning'], summary: 'كل الشعب مع حالاتها ومدربيها وعداداتها' },
  }, async (req) => {
    const { status } = z.object({ status: z.string().optional() }).parse(req.query)
    return cohorts.list(status)
  })

  /* ── جاهزيّة العرض: فتحُ الشعب ومحاذاةُ الأسعار من اللوحة ──

     كانت العمليّتان في `scripts/` وحدهما، فلا تُنفَّذان إلّا من طرفيّةٍ تملك
     `DATABASE_URL` الإنتاج — فبقيت ٨١ دورةً معروضةً بلا سعر لأنّ أحدا لم
     يفتح طرفيّة. والمنطق مشترك مع السكربتين فلا يفترق الزرّ عن السطر.

     و`apply=false` هو الافتراض: تُعرض النتيجة أوّلا ولا يُكتب شيء. */
  app.post('/api/admin/cohorts/open-all', {
    preHandler: requirePermission('cohort.open'),
    schema: { tags: ['admin-cohorts'], summary: 'يفتح شعبةً لكلّ دورة منشورة بلا شعبةٍ حيّة' },
  }, async (req) => {
    const b = (req.body ?? {}) as { apply?: boolean; weeks?: number; capacity?: number }
    return openAllCohorts(prisma, {
      apply: b.apply === true, weeks: b.weeks, capacity: b.capacity, actorId: req.auth!.userId,
    })
  })

  app.post('/api/admin/cohorts/align-prices', {
    preHandler: requirePermission('cohort.open'),
    schema: { tags: ['admin-cohorts'], summary: 'يوحّد أسعار الشعب على سعر قائمة دورتها' },
  }, async (req) => {
    const b = (req.body ?? {}) as { apply?: boolean }
    return alignCohortPrices(prisma, { apply: b.apply === true, actorId: req.auth!.userId })
  })

  app.post('/api/admin/cohorts', {
    preHandler: requirePermission('cohort.manage'),
    schema: { tags: ['admin-learning'], summary: 'إنشاء شعبة — مسودة حتى تكتمل شروط الفتح' },
  }, async (req, reply) => {
    const body = z.object({
      courseId: z.string(), pathwayId: z.string().optional(), title: z.string().min(3),
      startsAt: z.coerce.date().optional(), endsAt: z.coerce.date().optional(),
      daysOfWeek: dayCodes.optional(), startTime: z.string().optional(), timezone: z.string().optional(),
      capacity: z.number().int().min(1).optional(), price: z.number().min(0).optional(), currency: z.string().optional(),
      language: z.string().optional(), deliveryMode: z.enum(['remote', 'in_person', 'hybrid']).optional(),
    }).parse(req.body)
    return reply.status(201).send(await cohorts.create(req.auth!.userId, body))
  })

  app.patch('/api/admin/cohorts/:id', {
    preHandler: requirePermission('cohort.manage'),
    schema: { tags: ['admin-learning'], summary: 'تعديل شعبة غير منتهية — جدولة وسعة وسعر وتقديم' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      title: z.string().min(3).optional(), startsAt: z.coerce.date().optional(), endsAt: z.coerce.date().optional(),
      daysOfWeek: dayCodes.optional(), startTime: z.string().optional(), timezone: z.string().optional(),
      capacity: z.number().int().min(1).optional(), price: z.number().min(0).optional(), currency: z.string().optional(),
      language: z.string().optional(), deliveryMode: z.enum(['remote', 'in_person', 'hybrid']).optional(),
      registrationOpen: z.boolean().optional(), financialReady: z.boolean().optional(),
    }).parse(req.body)
    return cohorts.update(req.auth!.userId, id, body)
  })

  /* مدرّبو الشعبة المحتمَلون وحالُ تأهيل كلٍّ منهم.

     كانت الشاشة تعرض «المدرّبين المعلَنين» بلا أن تقول أيُّهم مؤهَّل لدورة
     هذه الشعبة، فيُجرَّب الإسنادُ ويُردّ بـ409 «غير مؤهل». والفرقُ بين
     «أسنده» و«أهّله وأسنده» قرارٌ يُتّخذ قبل النقر لا بعده. */
  app.get('/api/admin/cohorts/:id/eligible-trainers', {
    preHandler: requirePermission('cohort.manage'),
    schema: { tags: ['admin-learning'], summary: 'مدرّبو هذه الشعبة المحتمَلون — بحال تأهيل كلٍّ منهم لدورتها' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return cohorts.eligibleTrainersFor(id)
  })

  app.post('/api/admin/cohorts/:id/trainers', {
    preHandler: requirePermission('trainer.assign'),
    schema: { tags: ['admin-learning'], summary: 'تعيين مدرب للشعبة — تأهيل إلزامي ومنع تعارض جدول' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ profileId: z.string().uuid(), role: z.enum(['lead', 'assistant']).default('lead') }).parse(req.body)
    return reply.status(201).send(await cohorts.assignTrainer(id, body.profileId, req.auth!.userId, body.role))
  })

  app.get('/api/admin/cohorts/:id/open-checklist', {
    preHandler: requirePermission('cohort.manage'),
    schema: { tags: ['admin-learning'], summary: 'فحص شروط الفتح الستة — يعيد النواقص دون تغيير حالة' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return cohorts.openChecklist(id)
  })

  app.post('/api/admin/cohorts/:id/open', {
    preHandler: requirePermission('cohort.open'),
    schema: { tags: ['admin-learning'], summary: 'فتح الشعبة — يرفض بقائمة النواقص إن نقص شرط' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return cohorts.open(id, req.auth!.userId)
  })

  app.post('/api/admin/cohorts/:id/transition', {
    preHandler: requirePermission('cohort.manage'),
    schema: { tags: ['admin-learning'], summary: 'انتقال حالة الشعبة — active/completed/cancelled' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ to: z.enum(['active', 'completed', 'cancelled', 'open']), note: z.string().optional() }).parse(req.body)
    await cohorts.transition(id, body.to, req.auth!.userId, body.note)
    return { ok: true }
  })

  /* ── الجلسات وZoom ── */
  app.post('/api/admin/cohorts/:id/sessions', {
    preHandler: requirePermission('cohort.manage'),
    schema: { tags: ['admin-learning'], summary: 'إضافة جلسة — تفحص تعارض مدربي الشعبة' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      title: z.string().min(2), startsAt: z.coerce.date(), endsAt: z.coerce.date().optional(),
      timezone: z.string().optional(), moduleId: z.string().optional(),
    }).parse(req.body)
    return reply.status(201).send(await cohorts.addSession(req.auth!.userId, id, body))
  })

  app.post('/api/admin/sessions/:sessionId/zoom', {
    preHandler: requirePermission('cohort.manage'),
    schema: { tags: ['admin-learning'], summary: 'ربط اجتماع Zoom يدوي — رابط ومعرف ورمز مرور محمي' },
  }, async (req, reply) => {
    const { sessionId } = z.object({ sessionId: z.string().uuid() }).parse(req.params)
    const body = z.object({
      joinUrl: z.string().url(), meetingId: z.string().optional(), passcode: z.string().optional(),
      learnerUrl: z.string().url().optional(), hostProfileId: z.string().uuid().optional(),
    }).parse(req.body)
    return reply.status(201).send(await cohorts.attachManualZoom(req.auth!.userId, sessionId, body))
  })

  /* ── المواد والتسجيلات ── */
  app.post('/api/admin/cohorts/:id/materials', {
    preHandler: requirePermission('material.manage'),
    schema: { tags: ['admin-learning'], summary: 'تسجيل مادة — ملف خاص برابط رفع موقع أو رابط خارجي' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      title: z.string().min(2), kind: z.enum(['file', 'link', 'summary_audio', 'summary_text']),
      moduleId: z.string().optional(), externalUrl: z.string().url().optional(),
      file: z.object({ originalName: z.string(), mime: z.string(), sizeBytes: z.number().int().positive() }).optional(),
    }).parse(req.body)
    return reply.status(201).send(await cohorts.registerMaterial(req.auth!.userId, id, body))
  })

  app.post('/api/admin/sessions/:sessionId/recordings', {
    preHandler: requirePermission('material.manage'),
    schema: { tags: ['admin-learning'], summary: 'تسجيل تسجيل جلسة — ملف خاص مرتبط بالجلسة والوحدة' },
  }, async (req, reply) => {
    const { sessionId } = z.object({ sessionId: z.string().uuid() }).parse(req.params)
    const body = z.object({
      title: z.string().min(2), moduleId: z.string().optional(),
      mime: z.string(), sizeBytes: z.number().int().positive(), durationSec: z.number().int().optional(),
    }).parse(req.body)
    return reply.status(201).send(await cohorts.registerRecording(req.auth!.userId, sessionId, body))
  })

  app.post('/api/admin/content/:kind/:id/status', {
    preHandler: requirePermission('material.manage'),
    schema: { tags: ['admin-learning'], summary: 'أرشفة أو تعطيل مادة/تسجيل' },
  }, async (req) => {
    const { kind, id } = z.object({ kind: z.enum(['material', 'recording']), id: z.string().uuid() }).parse(req.params)
    const body = z.object({ status: z.enum(['active', 'archived', 'disabled']) }).parse(req.body)
    await cohorts.setContentStatus(req.auth!.userId, kind, id, body.status)
    return { ok: true }
  })

  /* ── التسجيل ── */
  app.post('/api/admin/cohorts/:id/enrollments', {
    preHandler: requirePermission('enrollment.manage'),
    schema: { tags: ['admin-learning'], summary: 'تسجيل متعلم — سعة محروسة، الفائض قائمة انتظار' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ userId: z.string().uuid(), overrideCapacity: z.boolean().default(false) }).parse(req.body)
    /* تجاوز السعة صلاحية مستقلة */
    if (body.overrideCapacity && !req.auth!.permissions.includes('cohort.override_capacity')) {
      return reply.status(403).send({ error: { code: 'forbidden', message_ar: 'تجاوز السعة يتطلب صلاحية مستقلة' } })
    }
    return reply.status(201).send(await enrollments.enroll(id, body.userId, req.auth!.userId, { overrideCapacity: body.overrideCapacity }))
  })

  app.post('/api/admin/enrollments/:id/drop', {
    preHandler: requirePermission('enrollment.manage'),
    schema: { tags: ['admin-learning'], summary: 'إسقاط تسجيل متعلم' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ note: z.string().optional() }).parse(req.body ?? {})
    return enrollments.drop(id, req.auth!.userId, body.note)
  })

  /* ── الروبرك والتقييمات وقواعد الإكمال ── */
  app.post('/api/admin/rubrics', {
    preHandler: requirePermission('cohort.manage'),
    schema: { tags: ['admin-learning'], summary: 'إنشاء روبرك تقييم قابل لإعادة الاستخدام' },
  }, async (req, reply) => {
    const body = z.object({
      title: z.string().min(3),
      criteria: z.array(z.object({ title: z.string().min(2), maxScore: z.number().int().min(1) })).min(1),
    }).parse(req.body)
    return reply.status(201).send(await assessments.createRubric(req.auth!.userId, body.title, body.criteria))
  })

  app.post('/api/admin/cohorts/:id/assessments', {
    preHandler: requirePermission('cohort.manage'),
    schema: { tags: ['admin-learning'], summary: 'إنشاء واجب/اختبار/مشروع للشعبة' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      title: z.string().min(3), type: z.enum(['assignment', 'quiz', 'project']),
      moduleId: z.string().optional(), maxScore: z.number().int().min(1).optional(),
      passScore: z.number().int().optional(), dueAt: z.coerce.date().optional(), rubricId: z.string().uuid().optional(),
      items: z.array(z.object({ prompt: z.string().min(2), kind: z.enum(['text', 'choice', 'file']).optional(), maxScore: z.number().int().optional() })).optional(),
    }).parse(req.body)
    return reply.status(201).send(await assessments.createAssessment(req.auth!.userId, { ...body, cohortId: id }))
  })

  app.post('/api/admin/completion-rules', {
    preHandler: requirePermission('cohort.manage'),
    schema: { tags: ['admin-learning'], summary: 'قاعدة إكمال — لدورة عامة أو لشعبة محددة' },
  }, async (req, reply) => {
    const body = z.object({
      courseId: z.string(), cohortId: z.string().uuid().optional(),
      type: z.enum(['attendance_pct', 'modules_completed', 'assignment_accepted', 'project_accepted', 'assessment_passed']),
      threshold: z.number().int().min(1), required: z.boolean().optional(),
    }).parse(req.body)
    return reply.status(201).send(await progress.setCompletionRule(req.auth!.userId, body))
  })

  /* ── الشهادات ── */
  /* مرشَّحو الشهادة — بدل «الصق معرّف التسجيل (UUID)».

     والأهليّةُ محسوبةٌ بالقواعد نفسِها التي يفحصها الإصدار، فلا تقول القائمةُ
     «مؤهَّل» ثمّ يرفض الزرّ. */
  app.get('/api/admin/cohorts/:id/certificate-candidates', {
    preHandler: requirePermission('certificate.issue'),
    schema: { tags: ['admin-learning'], summary: 'مَن أنهى فعلا في هذه الشعبة — بأهليّته وأسبابِ تعثّرها' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return certificates.candidates(id)
  })

  app.post('/api/admin/enrollments/:id/certificate', {
    preHandler: requirePermission('certificate.issue'),
    schema: { tags: ['admin-learning'], summary: 'إصدار شهادة — يرفض بقائمة القواعد غير المحققة' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return reply.status(201).send(await certificates.issue(id, req.auth!.userId))
  })

  app.post('/api/admin/certificates/:id/revoke', {
    preHandler: requirePermission('certificate.revoke'),
    schema: { tags: ['admin-learning'], summary: 'إلغاء شهادة — سبب موثق إلزامي' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ reason: z.string().min(5) }).parse(req.body)
    return certificates.revoke(id, req.auth!.userId, body.reason)
  })
}
