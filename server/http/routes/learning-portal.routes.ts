/* مسارات بوابة المتعلم وبوابة المدرب التشغيلية والتحقق العام من الشهادات.
   القاعدة الذهبية: المتعلم لا يرى محتوى شعبة غير مسجل فيها،
   والمدرب لا يرى شعبا ولا تسليمات خارج شعبه.
   مفاتيح التخزين لا تكشف أبدا — تُحوَّل إلى روابط قراءة موقعة قصيرة العمر. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { CohortService } from '../../services/cohort.service'
import { EnrollmentService } from '../../services/enrollment.service'
import { AssessmentService } from '../../services/assessment.service'
import { ProgressService } from '../../services/progress.service'
import { CertificateService } from '../../services/certificate.service'
import { SkillGrowthService } from '../../services/skill-growth.service'
import { RetrievalService } from '../../services/retrieval.service'
import { ScenarioService } from '../../services/scenario.service'
import { CohortMessageService } from '../../services/cohort-message.service'
import { AuthError } from '../../services/auth.service'
import { requirePermission } from '../auth-plugin'

/* يحوّل محتوى شعبة خاما إلى نسخة آمنة للعرض: روابط موقعة بدل مفاتيح التخزين */
function signCohortContent<T extends {
  sessions: { zoom: { passcodeEnc: string | null } | null; recordings: { storageKey: string | null }[] }[]
  materials: { storageKey: string | null }[]
}>(cohort: T, cohorts: CohortService, opts: { revealPasscode: boolean }) {
  const sign = (key: string | null) => (key ? cohorts.signedReadUrl(key) : null)
  return {
    ...cohort,
    sessions: cohort.sessions.map((s) => ({
      ...s,
      zoom: s.zoom
        ? {
            id: (s.zoom as { id?: string }).id,
            provider: (s.zoom as { provider?: string }).provider,
            joinUrl: (s.zoom as { joinUrl?: string }).joinUrl,
            learnerUrl: (s.zoom as { learnerUrl?: string | null }).learnerUrl ?? null,
            meetingId: (s.zoom as { meetingId?: string | null }).meetingId ?? null,
            passcode: opts.revealPasscode ? s.zoom.passcodeEnc : null,
          }
        : null,
      recordings: s.recordings.map((r) => ({
        ...r,
        readUrl: sign(r.storageKey),
        storageKey: undefined,
      })),
    })),
    materials: cohort.materials.map((m) => ({
      ...m,
      readUrl: sign(m.storageKey),
      storageKey: undefined,
    })),
  }
}

export function registerLearningPortalRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const cohorts = new CohortService(prisma)
  const enrollments = new EnrollmentService(prisma)
  const messages = new CohortMessageService(prisma)
  const assessments = new AssessmentService(prisma)
  const progress = new ProgressService(prisma)
  const certificates = new CertificateService(prisma)
  const skillGrowth = new SkillGrowthService(prisma)
  const retrieval = new RetrievalService(prisma)
  const scenarios = new ScenarioService(prisma)

  /* ══════════ بوابة المتعلم ══════════ */

  app.get('/api/learner/my-learning', {
    preHandler: requirePermission('learner.portal'),
    schema: { tags: ['learner-portal'], summary: 'تسجيلاتي — الشعب والتقدم والشهادات' },
  }, async (req) => {
    const rows = await enrollments.myEnrollments(req.auth!.userId)
    /* لا مفاتيح تخزين في قائمة النظرة العامة */
    return rows.map((r) => ({ ...r, cohort: { ...r.cohort } }))
  })

  app.get('/api/learner/artifacts', {
    preHandler: requirePermission('learner.portal'),
    schema: { tags: ['learner-portal'], summary: 'نواتجي — ما سلّمته عبر تسجيلاتي كلها، بحالته واعتماده' },
  }, async (req) => enrollments.myArtifacts(req.auth!.userId))

  app.get('/api/learner/enrollments/:id', {
    preHandler: requirePermission('learner.portal'),
    schema: { tags: ['learner-portal'], summary: 'محتوى شعبتي — جلسات وروابط Zoom وتسجيلات ومواد بروابط موقعة وحضوري وتقدمي' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const view = await enrollments.learnerCohortView(id)
    if (view.userId !== req.auth!.userId) {
      throw new AuthError('forbidden', 'هذا التسجيل ليس لك', 403)
    }
    if (view.status === 'dropped' || view.status === 'waitlisted') {
      throw new AuthError('not_enrolled', 'لا تملك وصولا لهذا المحتوى — تسجيلك منسحب أو في قائمة الانتظار', 403)
    }
    /* المتعلم المسجل يرى رمز المرور — يحتاجه للدخول؛ غير المسجل لا يصل هنا أصلا */
    return { ...view, cohort: signCohortContent(view.cohort, cohorts, { revealPasscode: true }) }
  })

  /* تبديلُ الشعبة قبل أن تبدأ.

     قرارُ صاحب المنصّة: «لا يحقّ له تغيير مساره بعد الدفع. فقط التنقّل بين
     الشعب ما دامت لم تبدأ بالفعل». والقيدان يُطبَّقان في الخدمة:
     الدورةُ نفسُها (فلا يصير التبديلُ بابا خلفيّا لتغيير المسار)، وقبل
     البدء (وقبل أيّ أثرٍ في الشعبة المغادَرة). */
  app.post('/api/learner/enrollments/:id/switch-cohort', {
    preHandler: requirePermission('learner.portal'),
    schema: { tags: ['learner-portal'], summary: 'تبديل شعبتي إلى شعبةٍ أخرى من الدورة نفسها لم تبدأ بعد' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ cohortId: z.string().uuid() }).parse(req.body)
    return enrollments.switchCohort(req.auth!.userId, id, body.cohortId)
  })

  app.post('/api/learner/assessments/:id/submissions', {
    preHandler: requirePermission('learner.submit'),
    schema: { tags: ['learner-portal'], summary: 'تسليم واجب — نص أو ملف خاص حتى 100MB' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      textAnswer: z.string().max(20000).optional(),
      file: z.object({ originalName: z.string(), mime: z.string(), sizeBytes: z.number().int().positive() }).optional(),
    }).parse(req.body)
    return reply.status(201).send(await assessments.submitAssignment(req.auth!.userId, id, body))
  })

  app.post('/api/learner/assessments/:id/resubmit', {
    preHandler: requirePermission('learner.submit'),
    schema: { tags: ['learner-portal'], summary: 'إعادة تسليم — بعد طلب المدرب فقط' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      textAnswer: z.string().max(20000).optional(),
      file: z.object({ originalName: z.string(), mime: z.string(), sizeBytes: z.number().int().positive() }).optional(),
    }).parse(req.body)
    return reply.status(201).send(await assessments.resubmit(req.auth!.userId, id, body))
  })

  app.post('/api/learner/assessments/:id/attempts', {
    preHandler: requirePermission('learner.submit'),
    schema: { tags: ['learner-portal'], summary: 'محاولة تقييم — إجابات على بنود الاختبار' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      responses: z.array(z.object({ itemId: z.string().uuid(), answer: z.unknown() })).min(1),
    }).parse(req.body)
    return reply.status(201).send(await assessments.submitAttempt(req.auth!.userId, id, body.responses))
  })

  /* ── القياس البعديّ للمهارة بعد إتمام الدورة (ح-٧) ── */

  app.get('/api/learner/enrollments/:id/skill-remeasure', {
    preHandler: requirePermission('learner.portal'),
    schema: { tags: ['learner-portal'], summary: 'أهلية القياس البعديّ واستمارته — مهارات الدورة ومستوياتي قبلها' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return skillGrowth.eligibility(req.auth!.userId, id)
  })

  app.post('/api/learner/enrollments/:id/skill-remeasure', {
    preHandler: requirePermission('learner.submit'),
    schema: { tags: ['learner-portal'], summary: 'تسجيل القياس البعديّ — مرة واحدة، بعد إتمام حقيقي، على مهارات الدورة فقط' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      /* السلّم يُتحقق في الوحدة النقية المشتركة، فلا يتباعد حدّ الخادم عن حدّ الشاشة */
      levels: z.record(z.string().min(1).max(120), z.number()).refine((r) => Object.keys(r).length > 0, 'لا إجابات في القياس'),
    }).parse(req.body)
    return reply.status(201).send(await skillGrowth.submit(req.auth!.userId, id, body.levels))
  })

  app.get('/api/learner/skill-growth', {
    preHandler: requirePermission('learner.portal'),
    schema: { tags: ['learner-portal'], summary: 'نموي المقيس — سجلات القياس البعديّ ودعوات القياس المستحقة' },
  }, async (req) => {
    const [growth, invites] = await Promise.all([
      skillGrowth.myGrowth(req.auth!.userId),
      skillGrowth.pendingInvites(req.auth!.userId),
    ])
    return { ...growth, invites }
  })

  /* ── الاسترجاع المتباعد (ح-٤) ── */

  app.get('/api/learner/retrieval', {
    preHandler: requirePermission('learner.portal'),
    schema: { tags: ['learner-portal'], summary: 'بطاقات الاسترجاع — البيانات خاما، والاشتقاق في العميل بوحدة نقية' },
  }, async (req) => ({ cards: await retrieval.myCards(req.auth!.userId) }))

  app.post('/api/learner/retrieval/modules/:moduleId', {
    preHandler: requirePermission('learner.portal'),
    schema: { tags: ['learner-portal'], summary: 'فتح بطاقات وحدة بعد إتمام تمرينها — لا يُعاد جدولة الموجود' },
  }, async (req, reply) => {
    const { moduleId } = z.object({ moduleId: z.string().min(3).max(80) }).parse(req.params)
    return reply.status(201).send(await retrieval.openCards(req.auth!.userId, moduleId))
  })

  app.post('/api/learner/retrieval/answer', {
    preHandler: requirePermission('learner.portal'),
    schema: { tags: ['learner-portal'], summary: 'تسجيل نتيجة استرجاع — الصحيح يتقدم خطوة والخطأ يعيد إلى أول السلّم' },
  }, async (req) => {
    const body = z.object({
      moduleId: z.string().min(3).max(80),
      checkIndex: z.number().int().min(0).max(20),
      correct: z.boolean(),
    }).parse(req.body)
    return retrieval.answer(req.auth!.userId, body.moduleId, body.checkIndex, body.correct)
  })

  /* ── سيناريو القرار المتفرّع (ح-٥) ── */

  app.get('/api/learner/scenarios/:moduleId/runs', {
    preHandler: requirePermission('learner.portal'),
    schema: { tags: ['learner-portal'], summary: 'جولاتي في سيناريو وحدة — مساري السابق وتأملي' },
  }, async (req) => {
    const { moduleId } = z.object({ moduleId: z.string().min(3).max(80) }).parse(req.params)
    return { runs: await scenarios.myRuns(req.auth!.userId, moduleId) }
  })

  app.post('/api/learner/scenarios/:moduleId/runs', {
    preHandler: requirePermission('learner.portal'),
    schema: { tags: ['learner-portal'], summary: 'حفظ جولة مكتملة — المسار يُتحقَّق على السيناريو المنشور' },
  }, async (req, reply) => {
    const { moduleId } = z.object({ moduleId: z.string().min(3).max(80) }).parse(req.params)
    const body = z.object({
      path: z.array(z.object({
        node: z.string().min(1).max(200),
        optionIndex: z.number().int().min(0).max(9),
      })).min(1).max(24),
      reflectionAr: z.string().max(4_000).optional(),
    }).parse(req.body)
    return reply.status(201).send(
      await scenarios.saveRun(req.auth!.userId, moduleId, body.path, body.reflectionAr ?? null),
    )
  })

  app.post('/api/learner/scenario-runs/:id/reflection', {
    preHandler: requirePermission('learner.portal'),
    schema: { tags: ['learner-portal'], summary: 'كتابة التأمل على جولة محفوظة' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ reflectionAr: z.string().max(4_000) }).parse(req.body)
    return scenarios.setReflection(req.auth!.userId, id, body.reflectionAr)
  })

  app.get('/api/learner/certificates', {
    preHandler: requirePermission('learner.portal'),
    schema: { tags: ['learner-portal'], summary: 'شهاداتي — أرقام التحقق وحالاتها' },
  }, async (req) => certificates.myCertificates(req.auth!.userId))

  /* ══════════ بوابة المدرب التشغيلية — شعبه فقط ══════════ */

  app.get('/api/trainer/my-cohorts', {
    preHandler: requirePermission('trainer.cohort.operate'),
    schema: { tags: ['trainer-ops'], summary: 'شعبي — جلساتها ومسجلوها وتقدمهم ومحتواها بروابط موقعة' },
  }, async (req) => {
    const rows = await enrollments.trainerCohorts(req.auth!.userId)
    return rows.map((r) => ({ role: r.role, cohort: signCohortContent(r.cohort, cohorts, { revealPasscode: true }) }))
  })

  app.post('/api/trainer/sessions/:sessionId/attendance', {
    preHandler: requirePermission('trainer.cohort.operate'),
    schema: { tags: ['trainer-ops'], summary: 'تسجيل حضور متعلم في جلسة من شعبي — يعيد حساب تقدمه' },
  }, async (req) => {
    const { sessionId } = z.object({ sessionId: z.string().uuid() }).parse(req.params)
    const body = z.object({
      enrollmentId: z.string().uuid(),
      status: z.enum(['present', 'late', 'absent', 'excused']),
      note: z.string().max(500).optional(),
    }).parse(req.body)
    return progress.markAttendance(req.auth!.userId, sessionId, body.enrollmentId, body.status, body.note)
  })

  app.post('/api/trainer/sessions/:sessionId/recordings', {
    preHandler: requirePermission('trainer.cohort.operate'),
    schema: { tags: ['trainer-ops'], summary: 'رفع تسجيل جلسة من شعبي — ملف خاص برابط رفع موقع' },
  }, async (req, reply) => {
    const { sessionId } = z.object({ sessionId: z.string().uuid() }).parse(req.params)
    const body = z.object({
      title: z.string().min(2), moduleId: z.string().optional(),
      mime: z.string(), sizeBytes: z.number().int().positive(), durationSec: z.number().int().optional(),
    }).parse(req.body)
    const session = await prisma.cohortSession.findUnique({ where: { id: sessionId } })
    if (!session) throw new AuthError('not_found', 'الجلسة غير موجودة', 404)
    /* لا تسجيلات في شعب لا يدربها */
    await enrollments.assertCohortTrainer(req.auth!.userId, session.cohortId)
    return reply.status(201).send(await cohorts.registerRecording(req.auth!.userId, sessionId, body))
  })

  /* ── أدوات الدورة في يد مدربها ──

     المدرب كان يستطيع تصحيح الواجب ولا يستطيع تأليفه، ويستطيع رفع تسجيل الجلسة
     ولا يستطيع رفع كرّاستها. السبب أن كلا الفعلين كان خلف صلاحية إدارية عامة
     (material.manage و cohort.manage) تُعطي حاملها كل الشعب — فمنحُها للمدرب
     يفتح له شعب غيره. فالفعلان هنا بصلاحيته هو (trainer.cohort.operate) خلف
     assertCohortTrainer: شعبته وحدها، لا شعبة سواه. */

  app.post('/api/trainer/cohorts/:id/materials', {
    preHandler: requirePermission('trainer.cohort.operate'),
    schema: { tags: ['trainer-ops'], summary: 'رفع مادة لشعبتي — فيديو أو كرّاسة أو ملخص أو رابط' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      title: z.string().min(2), kind: z.enum(['file', 'link', 'summary_audio', 'summary_text']),
      moduleId: z.string().optional(), externalUrl: z.string().url().optional(),
      file: z.object({ originalName: z.string(), mime: z.string(), sizeBytes: z.number().int().positive() }).optional(),
    }).parse(req.body)
    await enrollments.assertCohortTrainer(req.auth!.userId, id)
    return reply.status(201).send(await cohorts.registerMaterial(req.auth!.userId, id, body))
  })

  app.post('/api/trainer/cohorts/:id/assessments', {
    preHandler: requirePermission('trainer.cohort.operate'),
    schema: { tags: ['trainer-ops'], summary: 'إنشاء واجب أو اختبار أو مشروع لشعبتي' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      title: z.string().min(3), type: z.enum(['assignment', 'quiz', 'project']),
      moduleId: z.string().optional(), maxScore: z.number().int().min(1).optional(),
      passScore: z.number().int().optional(), dueAt: z.coerce.date().optional(), rubricId: z.string().uuid().optional(),
      items: z.array(z.object({ prompt: z.string().min(2), kind: z.enum(['text', 'choice', 'file']).optional(), maxScore: z.number().int().optional() })).optional(),
    }).parse(req.body)
    await enrollments.assertCohortTrainer(req.auth!.userId, id)
    return reply.status(201).send(await assessments.createAssessment(req.auth!.userId, { ...body, cohortId: id }))
  })

  /* ── مخاطبة الشعبة، واقتراح تأجيل جلسة ──

     الفعلان بصلاحيته هو خلف assertCohortTrainer: شعبته وحدها لا شعبة سواه.
     ومعرّف الشعبة في المسار لا في الجسم — فلا يُخاطب شعبةً بمعرّفٍ يُخمَّن. */

  app.post('/api/trainer/cohorts/:id/messages', {
    preHandler: requirePermission('trainer.cohort.operate'),
    schema: { tags: ['trainer-ops'], summary: 'رسالة إلى الشعبة كلّها أو إلى متعلّم فيها — تُسجَّل وتُوصَّل' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      audience: z.enum(['cohort', 'learner']),
      enrollmentId: z.string().uuid().optional(),
      body: z.string().min(2).max(2000),
    }).parse(req.body)
    await enrollments.assertCohortTrainer(req.auth!.userId, id)
    return reply.status(201).send(await messages.send(req.auth!.userId, id, body))
  })

  app.get('/api/trainer/cohorts/:id/messages', {
    preHandler: requirePermission('trainer.cohort.operate'),
    schema: { tags: ['trainer-ops'], summary: 'سجلّ ما أُرسل في شعبتي' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    await enrollments.assertCohortTrainer(req.auth!.userId, id)
    return messages.list(id)
  })

  app.post('/api/trainer/sessions/:sessionId/reschedule', {
    preHandler: requirePermission('trainer.cohort.operate'),
    schema: { tags: ['trainer-ops'], summary: 'اقتراح موعد جديد لجلسة من شعبي — الإدارة تعتمد' },
  }, async (req, reply) => {
    const { sessionId } = z.object({ sessionId: z.string().uuid() }).parse(req.params)
    const body = z.object({
      proposedStartsAt: z.coerce.date(),
      reason: z.string().min(10).max(500),
    }).parse(req.body)
    const session = await prisma.cohortSession.findUnique({ where: { id: sessionId }, select: { cohortId: true } })
    if (!session) throw new AuthError('not_found', 'الجلسة غير موجودة', 404)
    await enrollments.assertCohortTrainer(req.auth!.userId, session.cohortId)
    return reply.status(201).send(await messages.propose(req.auth!.userId, sessionId, body))
  })

  app.get('/api/trainer/reschedules', {
    preHandler: requirePermission('trainer.cohort.operate'),
    schema: { tags: ['trainer-ops'], summary: 'اقتراحاتي لتأجيل الجلسات وأين وقفت' },
  }, async (req) => messages.mine(req.auth!.userId))

  app.post('/api/trainer/reschedules/:id/withdraw', {
    preHandler: requirePermission('trainer.cohort.operate'),
    schema: { tags: ['trainer-ops'], summary: 'سحب اقتراح تأجيل معلّق' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return messages.withdraw(req.auth!.userId, id)
  })

  /* ── قرار الإدارة: الاعتماد وحده يحرّك الموعد عند المتعلّمين ── */

  app.get('/api/admin/session-reschedules', {
    preHandler: requirePermission('cohort.manage'),
    schema: { tags: ['admin-cohorts'], summary: 'اقتراحات تأجيل الجلسات المعلّقة' },
  }, async () => messages.pending())

  app.post('/api/admin/session-reschedules/:id/review', {
    preHandler: requirePermission('cohort.manage'),
    schema: { tags: ['admin-cohorts'], summary: 'اعتماد اقتراح تأجيل أو ردّه بسبب' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      action: z.enum(['approve', 'reject']),
      comment: z.string().max(500).optional(),
    }).parse(req.body)
    return messages.review(req.auth!.userId, id, body)
  })

  app.get('/api/trainer/grading-queue', {
    preHandler: requirePermission('trainer.cohort.operate'),
    schema: { tags: ['trainer-ops'], summary: 'طابور المراجعة — تسليمات شعبي المعلقة فقط' },
  }, async (req) => assessments.trainerQueue(req.auth!.userId))

  app.post('/api/trainer/submissions/:id/review', {
    preHandler: requirePermission('trainer.cohort.operate'),
    schema: { tags: ['trainer-ops'], summary: 'مراجعة تسليم — بدء/طلب إعادة/قبول/رفض بسبب' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      action: z.enum(['start_review', 'request_resubmit', 'accept', 'reject']),
      note: z.string().max(2000).optional(),
    }).parse(req.body)
    return assessments.reviewSubmission(req.auth!.userId, id, body.action, body.note)
  })

  app.post('/api/trainer/grade', {
    preHandler: requirePermission('trainer.cohort.operate'),
    schema: { tags: ['trainer-ops'], summary: 'تقدير درجة — كل تعديل لاحق يُسجل في سجل لا يُمحى' },
  }, async (req, reply) => {
    const body = z.object({
      submissionId: z.string().uuid().optional(), attemptId: z.string().uuid().optional(),
      score: z.number().min(0), maxScore: z.number().min(1),
      rubricScores: z.array(z.object({ criterionId: z.string().uuid(), score: z.number().min(0) })).optional(),
    }).parse(req.body)
    return reply.status(201).send(await assessments.grade(req.auth!.userId, body))
  })

  app.post('/api/trainer/submissions/:id/feedback', {
    preHandler: requirePermission('trainer.cohort.operate'),
    schema: { tags: ['trainer-ops'], summary: 'تغذية راجعة مكتوبة على تسليم من شعبي' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ body: z.string().min(3).max(3000) }).parse(req.body)
    return reply.status(201).send(await assessments.addFeedback(req.auth!.userId, id, body.body))
  })

  /* ══════════ التحقق العام من الشهادات — بلا دخول ══════════ */

  app.get('/api/v1/certificates/verify/:number', {
    schema: { tags: ['public'], summary: 'تحقق عام من شهادة برقمها — بيانات محدودة ويُسجل كل تحقق' },
  }, async (req) => {
    const { number } = z.object({ number: z.string().min(6).max(40) }).parse(req.params)
    return certificates.verify(number, req.ip)
  })
}
