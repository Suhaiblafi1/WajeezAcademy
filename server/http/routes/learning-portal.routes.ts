/* مسارات بوابة المتعلم وبوابة المدرب التشغيلية والتحقق العام من الشهادات.
   القاعدة الذهبية: المتعلم لا يرى محتوى شعبة غير مسجل فيها،
   والمدرب لا يرى شعبا ولا تسليمات خارج شعبه.
   مفاتيح التخزين لا تكشف أبدا — تُحوَّل إلى روابط قراءة موقعة قصيرة العمر. */

import type { FastifyInstance } from 'fastify'
import { TrainerDepartureService } from '../../services/trainer-departure.service'
import { LEARNER_CHOICES } from '../../../src/application/trainer/departure-rules'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { CohortService } from '../../services/cohort.service'
import { EnrollmentService } from '../../services/enrollment.service'
import { AssessmentService } from '../../services/assessment.service'
import { ProgressService } from '../../services/progress.service'
import { CertificateService } from '../../services/certificate.service'
import { LearnerRequestService, LEARNER_REQUEST_KINDS } from '../../services/learner-request.service'
import { SkillGrowthService } from '../../services/skill-growth.service'
import { RetrievalService } from '../../services/retrieval.service'
import { ScenarioService } from '../../services/scenario.service'
import { MAX_BODY_CHARS } from '../../services/module-authoring.service'
import { DeadlinesService } from '../../services/deadlines.service'
import { CohortMessageService } from '../../services/cohort-message.service'
import { CohortPlanService, TRAINER_EDITABLE_COHORT_FIELDS } from '../../services/cohort-plan.service'
import { resourceSourceBlockerAr } from '../../../src/application/trainer/module-body'
import { ReferralService } from '../../services/referral.service'
import { RESOURCE_KINDS, RESOURCE_CATEGORIES } from '../../../src/application/trainer/plan-overlay'
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
        externalUrl: (r as { externalUrl?: string | null }).externalUrl ?? null,
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
  const departures = new TrainerDepartureService(prisma)
  const cohorts = new CohortService(prisma)
  const enrollments = new EnrollmentService(prisma)
  const messages = new CohortMessageService(prisma)
  const assessments = new AssessmentService(prisma)
  const progress = new ProgressService(prisma)
  const certificates = new CertificateService(prisma)
  const learnerRequests = new LearnerRequestService(prisma)
  const skillGrowth = new SkillGrowthService(prisma)
  const retrieval = new RetrievalService(prisma)
  const scenarios = new ScenarioService(prisma)
  const deadlines = new DeadlinesService(prisma)

  /* ══════════ بوابة المتعلم ══════════ */

  app.get('/api/learner/my-learning', {
    preHandler: requirePermission('learner.portal'),
    schema: { tags: ['learner-portal'], summary: 'تسجيلاتي — الشعب والتقدم والشهادات' },
  }, async (req) => {
    const rows = await enrollments.myEnrollments(req.auth!.userId)
    /* لا مفاتيح تخزين في قائمة النظرة العامة */
    return rows.map((r) => ({ ...r, cohort: { ...r.cohort } }))
  })

  /* مواعيدي — والبياناتُ موجودةٌ منذ زمنٍ ولا شاشةَ تجمعها بالوقت:
     من له ثلاثةُ تسجيلاتٍ يفتح كلَّ واحدٍ على حدةٍ ليرى واجباته. */
  app.get('/api/learner/deadlines', {
    preHandler: requirePermission('learner.portal'),
    schema: { tags: ['learner-portal'], summary: 'مواعيدي النهائيّة — تسليماتٌ بموعدٍ لم تُسلَّم بعد' },
  }, async (req) => deadlines.forLearner(req.auth!.userId))

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

  /* تذكرةُ فتحِ الجلسة داخلَ الموقع.

     `learner.portal` تفتح البابَ، والخدمةُ تقرّر الدور: مدرّبُ الشعبة مضيف
     ومتعلّمُها المسجَّل مشارك، ومن سواهما يُردّ ٤٠٣. ولا يُقبل دورٌ من الجسم.

     وهي POST لا GET بقصد: التوقيعُ سرٌّ قصيرُ العمر، وGET يستقرّ في سجلّات
     الوسطاء وتاريخِ المتصفّح. */
  app.post('/api/learner/sessions/:sessionId/meeting-ticket', {
    preHandler: requirePermission('learner.portal'),
    schema: { tags: ['learner-portal'], summary: 'تذكرةُ Meeting SDK لفتح جلسة شعبتي داخل الموقع' },
  }, async (req) => {
    const { sessionId } = z.object({ sessionId: z.string().uuid() }).parse(req.params)
    return cohorts.meetingSdkTicket(req.auth!.userId, sessionId)
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

  /* ═══ الاختيارُ لصاحبه حين رحل مدرّبُه (ن-١٠) ═══

     «لا المنصّةُ تختار نيابةً عنه، ولا رصيدٌ يُفرَض على من أراد مالَه». فهذا
     بابُه هو: يقرأ ما عُرض عليه، ويختار. والإدارةُ تعرض ولا تختار — ولذلك
     البابُ هنا في بوّابته لا هناك. */
  app.get('/api/learner/departure-choices', {
    preHandler: requirePermission('learner.portal'),
    schema: { tags: ['learner-portal'], summary: 'ما عُرض عليّ من اختيارٍ بعد رحيل مدرّبي (ن-١٠)' },
  }, async (req) => departures.myOpenChoices(req.auth!.userId))

  app.post('/api/learner/departure-choices/:caseId', {
    preHandler: requirePermission('learner.portal'),
    schema: { tags: ['learner-portal'], summary: 'أختار: ردُّ ما تبقّى أو رصيدٌ باسمي' },
  }, async (req) => {
    const { caseId } = z.object({ caseId: z.string().uuid() }).parse(req.params)
    const body = z.object({ choice: z.enum(LEARNER_CHOICES) }).parse(req.body)
    return departures.chooseAsLearner(req.auth!.userId, caseId, body.choice)
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

  /* ══════════ طلباتُ آخر الرحلة — شهادةٌ أو توصية ══════════

     الشهادةُ تبقى بيد الإدارة: وثيقةٌ تُنسب إلى الأكاديميّة وتُتحقَّق علنا
     برقمها، فلا تُسكّها ضغطةٌ من صاحبها. وهذه المساراتُ بابُ الطلب وقراءةُ
     حالته — والأهليّةُ تُقرأ قبل الضغط لا بعده، فلا زرَّ يَعِد بما يُرفض. */

  app.get('/api/learner/requests', {
    preHandler: requirePermission('learner.portal'),
    schema: { tags: ['learner-portal'], summary: 'طلباتي — شهادةُ دورة أو مسار أو توصية، بحالتها' },
  }, async (req) => learnerRequests.mine(req.auth!.userId))

  app.get('/api/learner/enrollments/:id/certificate-eligibility', {
    preHandler: requirePermission('learner.portal'),
    schema: { tags: ['learner-portal'], summary: 'أهليّة شهادة الدورة — وأسبابُ المنع بالنصّ' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return learnerRequests.courseEligibility(req.auth!.userId, id)
  })

  app.get('/api/learner/pathways/:pathwayId/completion', {
    preHandler: requirePermission('learner.portal'),
    schema: { tags: ['learner-portal'], summary: 'إنجازُ المسار كاملا — كم دورةً أنجز من كم' },
  }, async (req) => {
    const { pathwayId } = z.object({ pathwayId: z.string().min(3).max(64) }).parse(req.params)
    return learnerRequests.pathwayEligibility(req.auth!.userId, pathwayId)
  })

  app.post('/api/learner/requests', {
    preHandler: requirePermission('learner.portal'),
    schema: { tags: ['learner-portal'], summary: 'طلبُ شهادةِ دورةٍ أو شهادةِ مسارٍ كاملا أو توصية' },
  }, async (req) => {
    const body = z.object({
      kind: z.enum(LEARNER_REQUEST_KINDS),
      enrollmentId: z.string().uuid().optional(),
      pathwayId: z.string().min(3).max(64).optional(),
      audienceAr: z.string().max(300).optional(),
      noteAr: z.string().max(2_000).optional(),
    }).parse(req.body)
    return learnerRequests.create(req.auth!.userId, body)
  })

  /* ══════════ بوابة المدرب التشغيلية — شعبه فقط ══════════ */

  /* ═══ ورشةُ الشعبة — ملكُ مدرّبها ═══

     قرارُ صاحب المنصّة (٨ سبتمبر ٢٠٢٦): يعدّل كلَّ شيءٍ عدا السعر، ويقول
     «أوافق» ويرسلها، فيعتمدها الأكاديميُّ أو الأعلى. الخدمةُ في
     `cohort-plan.service.ts`، وهذه أبوابُها. */
  const plans = new CohortPlanService(prisma)
  const referrals = new ReferralService(prisma)

  app.get('/api/trainer/cohorts/:id/referral-link', {
    preHandler: requirePermission('trainer.cohort.plan'),
    schema: { tags: ['trainer-ops'], summary: 'رابطُ دعوتي لهذه الشعبة — يُنشأ مرّةً ويبقى' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return referrals.linkFor(req.auth!.userId, id)
  })
  /* رابطُه الواسعُ وأثرُه — نداءٌ واحدٌ للوحة: الرابطُ وكم سجّل منه.
     وهما معا لأنّ الرابطَ بلا رقمٍ دعوةٌ لا يُعرف أنفعت، والرقمُ بلا رابطٍ
     خبرٌ لا يُعمل به. */
  /* روابطُ شعبي المفتوحة — تُقرأ في «دعوتي» دفعةً واحدة (١٥ سبتمبر ٢٠٢٦) */
  app.get('/api/trainer/me/referral-links', {
    preHandler: requirePermission('trainer.cohort.operate'),
    schema: { tags: ['trainer-ops'], summary: 'رابطُ دعوتي لكلّ شعبةٍ مفتوحةٍ أدرّبها' },
  }, async (req) => referrals.cohortLinksFor(req.auth!.userId))

  app.get('/api/trainer/me/referral', {
    preHandler: requirePermission('trainer.cohort.plan'),
    schema: { tags: ['trainer-ops'], summary: 'رابطي العامُّ على كامل ما أدرّب، ومن سجّل عبره' },
  }, async (req) => {
    const [link, reach] = await Promise.all([
      referrals.wideLinkFor(req.auth!.userId),
      referrals.reachOf(req.auth!.userId),
    ])
    return { ...link, ...reach }
  })

  const planContent = z.object({
    kind: z.literal('trainer'),
    summaryAr: z.string().max(2000).nullish(),
    /* المعرّفُ لا يتكرّر في خطّةٍ واحدة.

       كان المعرّفُ يُشتقُّ من الموضع في الواجهة (`T${length + 1}`)، فمع
       الحذفِ يُعاد رقمٌ قائمٌ ويصير في الخطّة محوران بمعرّفٍ واحد — والخادمُ
       يقبلهما. والواجهةُ صارت تشتقّه من أكبرِ ما أُعطي، لكنّ الحدَّ يُثبَّت
       هنا أيضا: عميلٌ قديمٌ أو طلبٌ يدويٌّ لا يكسر خطّةً بصمت. */
    modules: z.array(z.object({
      moduleId: z.string().max(64), titleAr: z.string().min(2).max(200),
      outcomeAr: z.string().max(1000).nullish(), activityAr: z.string().max(2000).nullish(),
      /* ═══ ولماذا سقفُ المتن هو سقفُ التأليف نفسُه ═══

         كان هنا ٦٠٠٠ وحدَه في المنصّة كلِّها: التأليفُ واستيرادُ الكتالوج على
         ٤٠٠٠٠ (`MAX_BODY_CHARS`)، وخطّةُ المدرّب على ٦٠٠٠. ومتونُ الكتالوج
         تُحمَّل في الخطّة بدءا (`modules: w.course.baseModules`) ثمّ تُرسَل مع
         كلّ حفظ — فكان كلُّ حفظٍ يسقط ٤٢٢ على «modules.0.bodyAr» في كلّ دورةٍ
         لها متونٌ مؤلَّفة. وهي مئةٌ وواحدٌ وتسعون متنا من مئةٍ وواحدٍ وتسعين:
         **لا متنَ واحدٌ تحت السقف**، ومتوسّطُها ٢٣ ألفا وأطولُها ٣٥ ألفا.

         فلم يكن المدرّبُ يعجز عن حفظ المتن وحدَه، بل عن حفظ **أيّ** مرحلةٍ من
         مراحل التجهيز: الحفظُ يرسل `content` كاملا، فيسقط كلُّه بمتنٍ لم يمسّه.

         والسقفُ يُستورَد ولا يُكتب رقما: رقمان يقولان الشيءَ نفسَه يفترقان،
         وهذا افتراقُهما. */
      artifactAr: z.string().max(1000).nullish(), bodyAr: z.string().max(MAX_BODY_CHARS).nullish(),
      /* ع-٢: مفتاحُ ملفِّ المحتوى النظريّ. والصفُّ يُنشأ قبل الرفع، فما
         يصل هنا إشارةٌ إليه لا ملفّ — ويُقابَل بالصفوف عند العرض، فمفتاحٌ
         لا صفَّ له لا يعرض شيئا. */
      bodyFileKey: z.string().trim().max(120).nullish(),
      bodyFileName: z.string().trim().max(200).nullish(),
      bodyFileMime: z.string().trim().max(120).nullish(),
    })).max(40).superRefine((mods, ctx) => {
      const seen = new Set<string>()
      for (const [i, m] of mods.entries()) {
        if (seen.has(m.moduleId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [i, 'moduleId'],
            message: `معرّفُ المحور «${m.moduleId}» مكرّرٌ في الخطّة`,
          })
        }
        seen.add(m.moduleId)
      }
    }),
    /* نوعُ المصدر — يُقرأ في شاشة المتعلّم فيُعرَض بأيقونته واسمه. والقائمةُ
       بيضاءُ لا حرّة: نوعٌ مخترَعٌ يصير «رابطا» عند القراءة، ويُردّ هنا كي
       لا يُحفظ أصلا. */
    /* ═══ د-٣: ورابطٌ **أو** ملفٌّ مرفوع ═══

       كان `url` إلزاميّا بصيغةِ رابط. و«ملفّ» نوعٌ يُختار من القائمة منذ
       البداية — فكان المدرّبُ يختاره ثمّ يُطالَب برابطٍ لا يملكه، فيلصق
       رابطا ويسمّيه ملفّا أو يدع النوعَ كذبا.

       فصار أحدُهما يكفي، ويُردّ ما ليس فيه شيءٌ يُفتح: مصدرٌ بلا رابطٍ ولا
       ملفٍّ سطرٌ في شاشة المتعلّم لا يقود إلى شيء. */
    resources: z.array(z.object({
      title: z.string().min(2).max(200),
      url: z.string().max(500).nullish(),
      kind: z.enum(RESOURCE_KINDS).nullish(), noteAr: z.string().max(500).nullish(),
      /* الصنفُ الذي اختاره المدرّب — والقائمةُ بيضاءُ كالأنواع: صنفٌ
         مخترَعٌ يُقرأ «عامّا» عند العرض، ويُردّ هنا كي لا يُحفظ أصلا. */
      category: z.enum(RESOURCE_CATEGORIES).nullish(),
      /* «ويحدّد متى تفتح للطالب طيلةَ الفصل» — للمسجَّل وحدَه، وفارغٌ يعني
         «مع أوّل يوم». ولا يُفحص هنا أنّه داخلَ الفصل: حدودُ الفصل تتبدّل
         باختيارِ فصلٍ آخر، ومصدرٌ يُردُّ حفظُه لتاريخٍ صار خارجَ المدى
         يَحبِس المدرّبَ عن حفظ خطّته كلِّها — والعرضُ يحكم لا الحفظ. */
      opensAt: z.string().datetime().nullish(),
      bodyFileKey: z.string().trim().max(120).nullish(),
      bodyFileName: z.string().trim().max(200).nullish(),
      bodyFileMime: z.string().trim().max(120).nullish(),
    }).superRefine((r, ctx) => {
      const blocker = resourceSourceBlockerAr(r)
      if (blocker) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `«${r.title}» ${blocker}`, path: ['url'] })
      }
    })).max(60),
    liveNoteAr: z.string().max(2000).nullish(),
    /* وسقط `proposals` من المخطّط (د-٦): اسمُ الدورة يمرّ بـ
       `/api/trainer/course-title-proposals` فيصير إصدارا جديدا (ح-٣)، ولا
       يُكتب على النسخة القائمة من داخل خطّة شعبة. والمحفوظُ قبلَه في
       `content` لا يُمسّ — والمخطّطُ يُسقط المفتاحَ الزائدَ ولا يردّ الحفظ. */
  })

  app.get('/api/trainer/cohorts/:id/workspace', {
    preHandler: requirePermission('trainer.cohort.plan'),
    schema: { tags: ['trainer-ops'], summary: 'ورشةُ شعبتي — كلُّ ما أعدّله وقائمةُ ما بقي عليّ' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return plans.workspace(req.auth!.userId, id)
  })

  app.put('/api/trainer/cohorts/:id/plan', {
    preHandler: requirePermission('trainer.cohort.plan'),
    schema: { tags: ['trainer-ops'], summary: 'حفظُ محتوى شعبتي مسودّةً: المحاورُ والتطبيقُ والمصادر' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return plans.savePlan(req.auth!.userId, id, planContent.parse(req.body))
  })

  app.patch('/api/trainer/cohorts/:id', {
    preHandler: requirePermission('trainer.cohort.plan'),
    schema: { tags: ['trainer-ops'], summary: 'تعديلُ بيانات شعبتي — الاسمُ والمواعيدُ واللغةُ والنمط، لا السعر' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    /* لا `strict`: المفتاحُ الماليُّ يصل الخدمةَ فتردّه باسمه، لا يُبتلع بصمت */
    const body = z.object({
      title: z.string().min(3).max(200).optional(), startsAt: z.coerce.date().optional(), endsAt: z.coerce.date().optional(),
      daysOfWeek: z.array(z.string()).optional(), startTime: z.string().max(5).optional(), timezone: z.string().max(64).optional(),
      language: z.string().max(40).optional(), deliveryMode: z.enum(['remote', 'in_person', 'hybrid']).optional(),
    }).passthrough().parse(req.body)
    void TRAINER_EDITABLE_COHORT_FIELDS
    return plans.updateCohort(req.auth!.userId, id, body as Record<string, unknown>)
  })

  /* فصلُ الشعبة — يختاره مدرّبُها، وحدودُه تصير نافذةَ جدولته (١٥ سبتمبر ٢٠٢٦) */
  app.get('/api/trainer/cohorts/:id/terms', {
    preHandler: requirePermission('trainer.cohort.plan'),
    schema: { tags: ['trainer-ops'], summary: 'الفصولُ التي يسعني اختيارُها لهذه الشعبة' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return plans.selectableTerms(req.auth!.userId, id)
  })

  app.post('/api/trainer/cohorts/:id/term', {
    preHandler: requirePermission('trainer.cohort.plan'),
    schema: { tags: ['trainer-ops'], summary: 'اختيارُ فصل الشعبة — ومنه تُشتقّ حدودُها ونافذةُ جدولتها' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const { termId } = z.object({ termId: z.string().uuid() }).parse(req.body)
    return plans.setTerm(req.auth!.userId, id, termId)
  })

  app.post('/api/trainer/cohorts/:id/plan/submit', {
    preHandler: requirePermission('trainer.cohort.plan'),
    schema: { tags: ['trainer-ops'], summary: '«أوافق على كلّ ما في الشعبة» — وتُرسَل للاعتماد' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const { confirm } = z.object({ confirm: z.boolean() }).parse(req.body ?? {})
    return reply.status(201).send(await plans.submit(req.auth!.userId, id, confirm))
  })

  app.post('/api/trainer/sessions/:sessionId/recording-link', {
    preHandler: requirePermission('trainer.cohort.plan'),
    schema: { tags: ['trainer-ops'], summary: 'تسجيلُ جلسةٍ من رابط — لا ملفَّ يُرفع' },
  }, async (req, reply) => {
    const { sessionId } = z.object({ sessionId: z.string().uuid() }).parse(req.params)
    const body = z.object({ title: z.string().min(2).max(200), url: z.string().url().max(500), moduleId: z.string().max(64).optional() }).parse(req.body)
    return reply.status(201).send(await plans.addRecordingLink(req.auth!.userId, sessionId, body))
  })

  app.get('/api/trainer/my-cohorts', {
    preHandler: requirePermission('trainer.cohort.operate'),
    schema: { tags: ['trainer-ops'], summary: 'شعبي — جلساتها ومسجلوها وتقدمهم ومحتواها بروابط موقعة' },
  }, async (req) => {
    const rows = await enrollments.trainerCohorts(req.auth!.userId)
    return rows.map((r) => ({ role: r.role, cohort: signCohortContent(r.cohort, cohorts, { revealPasscode: true }) }))
  })

  /* صفحةُ الشعبة الواحدة (٨ سبتمبر ٢٠٢٦): التجهيزُ من الورشة، والتشغيلُ من
     هنا — الشعبةُ بعينها لا القائمةُ كلُّها. والبطاقاتُ في «شعبي» من الموجز. */
  app.get('/api/trainer/cohorts/summary', {
    preHandler: requirePermission('trainer.cohort.operate'),
    schema: { tags: ['trainer-ops'], summary: 'شعبي موجزةً — حالةُ كلٍّ وما أُنجز من تجهيزها وما يليه' },
  }, async (req) => plans.summaries(req.auth!.userId))

  app.get('/api/trainer/cohorts/:id/ops', {
    preHandler: requirePermission('trainer.cohort.operate'),
    schema: { tags: ['trainer-ops'], summary: 'تشغيلُ شعبةٍ واحدة — جلساتُها ومسجَّلوها وموادُّها وتكاليفُها' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const r = await enrollments.trainerCohort(req.auth!.userId, id)
    return { role: r.role, cohort: signCohortContent(r.cohort, cohorts, { revealPasscode: true }) }
  })

  /* جدولي عبر شعبي — خطٌّ زمنيٌّ واحدٌ ومعه التزاحمُ بين شعبه هو.
     وحارسُ الإسناد يمنع الجديدَ المتعارض، ولا يمنع جلستَين أُضيفتا بعد
     الإسناد إلى شعبتَين قائمتَين — فهذه الشاشةُ هي التي تُظهرهما. */
  app.get('/api/trainer/me/schedule', {
    preHandler: requirePermission('trainer.cohort.operate'),
    schema: { tags: ['trainer-ops'], summary: 'جدولي — جلساتُ شعبي كلِّها في خطٍّ زمنيٍّ واحد' },
  }, async (req) => {
    const { days } = z.object({ days: z.coerce.number().int().min(1).max(120).optional() }).parse(req.query)
    return deadlines.forTrainer(req.auth!.userId, new Date(), days ?? 30)
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

  /* ═══ ورفعُ «موادّ الشعبة» من المدرّب أُغلق (١٥ سبتمبر ٢٠٢٦) ═══

     قرارُ صاحب المنصّة: تُغلَق الخانةُ والمسلكُ معا، وتُحذف اختباراتُه —
     «nothing is real for now».

     والعلّةُ أنّه كان يكتب `LearningMaterial` بحالة `active`، ولا حالةَ
     انتظارٍ في ذلك الصفّ أصلا، فيصل المسجَّلين من `learnerCohortView`
     لحظتَه. فكان البابَ الوحيدَ الذي ينشر به المدرّبُ على طلبته بلا أن
     تراه الإدارة — وسائرُ ما يصلهم يمرّ باعتمادٍ: المصادرُ في الخطّة،
     واللقاءاتُ في طابور الإدارة.

     وما كان يحمله له بابُه المعتمَد: ملفٌّ للمتعلّم في «كتبٌ وملفّات»،
     وملفُّ لقاءٍ بعينه يُرفق باللقاء في خطوته.

     ⚠️ وقد حذفتُه أوّلَ مرّةٍ من عندي فسقطت أربعةُ اختباراتٍ في CI، فرَدَدتُه
     ورفعتُ الأمرَ. وهذه المرّةُ بقرارٍ — والاختباراتُ تذهب معه لأنّ المحروسَ
     نفسَه أُزيل، لا لتُخضَرَّ الجولة.

     ورفعُ الإدارة باقٍ (`/api/admin/cohorts/:id/materials`): لها شاشتُها
     وصلاحيّتُها، وهي من تعتمد أصلا. */

  app.post('/api/trainer/cohorts/:id/assessments', {
    preHandler: requirePermission('trainer.cohort.operate'),
    schema: { tags: ['trainer-ops'], summary: 'إنشاء واجب أو اختبار أو مشروع لشعبتي' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      title: z.string().min(3), type: z.enum(['assignment', 'quiz', 'project']),
      moduleId: z.string().optional(), briefAr: z.string().max(4000).optional(), maxScore: z.number().int().min(1).optional(),
      passScore: z.number().int().optional(), dueAt: z.coerce.date().optional(), rubricId: z.string().uuid().optional(),
      /* المرفقات — نموذجٌ يُملأ أو مرجعٌ يُقرأ قبل التسليم */
      attachments: z.array(z.object({
        title: z.string().min(2).max(200), url: z.string().url().max(500),
        kind: z.enum(RESOURCE_KINDS).nullish(),
      })).max(10).optional(),
      items: z.array(z.object({ prompt: z.string().min(2), kind: z.enum(['text', 'choice', 'file']).optional(), maxScore: z.number().int().optional() })).optional(),
    }).parse(req.body)
    await enrollments.assertCohortTrainer(req.auth!.userId, id)
    return reply.status(201).send(await assessments.createAssessment(req.auth!.userId, { ...body, cohortId: id }))
  })

  /* ── تعديلُ تكليفٍ وحذفُه ──

     المعرّفُ في المسار هو معرّفُ التكليف لا الشعبة: الخدمةُ تستخرج شعبتَه
     منه ثمّ تتحقّق أنّها من شعب المنادي (`assertAssessmentTrainer`) — فلا
     يُعدَّل تكليفُ شعبةٍ ليست له بمعرّفٍ يُخمَّن. */

  app.patch('/api/trainer/assessments/:assessmentId', {
    preHandler: requirePermission('trainer.cohort.operate'),
    schema: { tags: ['trainer-ops'], summary: 'تعديل تكليفٍ في شعبتي' },
  }, async (req) => {
    const { assessmentId } = z.object({ assessmentId: z.string().uuid() }).parse(req.params)
    const body = z.object({
      title: z.string().min(3).optional(),
      /* النصُّ الفارغ يعني «امحُ التعليمات» — فيصير null لا سلسلةً فارغة */
      briefAr: z.string().max(4000).nullable().optional(),
      type: z.enum(['assignment', 'quiz', 'project']).optional(),
      maxScore: z.number().int().min(1).optional(),
      dueAt: z.coerce.date().nullable().optional(),
      /* المصفوفةُ الفارغةُ تعني «امحُ المرفقات» — كالنصّ الفارغ للتعليمات */
      attachments: z.array(z.object({
        title: z.string().min(2).max(200), url: z.string().url().max(500),
        kind: z.enum(RESOURCE_KINDS).nullish(),
      })).max(10).optional(),
    }).parse(req.body)
    return assessments.updateAssessment(req.auth!.userId, assessmentId, body)
  })

  app.delete('/api/trainer/assessments/:assessmentId', {
    preHandler: requirePermission('trainer.cohort.operate'),
    schema: { tags: ['trainer-ops'], summary: 'حذف تكليفٍ لم يُسلَّم فيه' },
  }, async (req) => {
    const { assessmentId } = z.object({ assessmentId: z.string().uuid() }).parse(req.params)
    return assessments.deleteAssessment(req.auth!.userId, assessmentId)
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
      audience: z.enum(['cohort', 'learner', 'advisors']),
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

  /* ══════ جدولةُ المدرّب — داخلَ نافذة الإدارة ══════

     كان المدرّبُ يملك `reschedule` وحدَه: **اقتراحا** يُرفع إلى طابور
     موافقاتٍ على شاشة الإدارة. وهو طابورٌ بُني ليعوّض صلاحيّةً لم تُمنح.

     فصار له بابان: هذان — يقعان الآن داخلَ حدّ الإدارة — وذاك الاقتراحُ
     الباقي أسفلَه لما يقع **خارجَ** الحدّ. فالإدارةُ على الاستثناء لا
     على الروتين. */

  app.get('/api/trainer/cohorts/:id/schedule-window', {
    preHandler: requirePermission('trainer.cohort.schedule'),
    schema: { tags: ['trainer-ops'], summary: 'حدودي في هذه الشعبة — تُقرأ قبل المحاولة لا بعد الرفض' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return cohorts.scheduleWindowFor(req.auth!.userId, id)
  })

  app.post('/api/trainer/cohorts/:id/sessions', {
    preHandler: requirePermission('trainer.cohort.schedule'),
    schema: { tags: ['trainer-ops'], summary: 'إضافةُ لقاءٍ في شعبتي — داخلَ نافذة الإدارة وسقفِها' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      title: z.string().min(2).max(160),
      startsAt: z.coerce.date(),
      /* والنهايةُ صارت مطلوبةً: «يحدّد أيَّ ساعةٍ وإلى أيّ ساعة» (١٥ سبتمبر
         ٢٠٢٦). وكانت تُترك فتُفترض ساعتان في Zoom — رقمٌ يُخمَّن على وقتِ
         عشرين إنسانا، ويُقفَل الاجتماعُ عليهم وهم فيه. */
      endsAt: z.coerce.date(),
      timezone: z.string().max(64).optional(),
      moduleId: z.string().max(64).optional(),
      /* نبذةُ اللقاء — صارت لكلّ لقاءٍ لا للشعبة كلِّها */
      noteAr: z.string().max(2000).nullish(),
      /* وملفٌّ اختياريٌّ يُرفق به */
      attachmentKey: z.string().trim().max(120).nullish(),
      attachmentName: z.string().trim().max(200).nullish(),
      attachmentMime: z.string().trim().max(120).nullish(),
      /* المدرّبُ ينشئ اجتماعَه بنفسه — لا ينتظر مديرا يلصق رابطا */
      withZoom: z.boolean().optional(),
    }).superRefine((b, ctx) => {
      if (b.endsAt <= b.startsAt) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'نهايةُ اللقاء قبل بدايته', path: ['endsAt'] })
      }
    }).parse(req.body)
    return reply.status(201).send(await cohorts.trainerAddSessionWithMeeting(req.auth!.userId, id, body))
  })

  app.patch('/api/trainer/sessions/:sessionId', {
    preHandler: requirePermission('trainer.cohort.schedule'),
    schema: { tags: ['trainer-ops'], summary: 'نقلُ لقاءٍ في شعبتي — داخلَ النافذة، بلا طابور موافقات' },
  }, async (req) => {
    const { sessionId } = z.object({ sessionId: z.string().uuid() }).parse(req.params)
    const body = z.object({
      startsAt: z.coerce.date(),
      endsAt: z.coerce.date().optional(),
    }).parse(req.body)
    return cohorts.trainerMoveSession(req.auth!.userId, sessionId, body)
  })

  /* ═══ حذفُ لقاء — لأنّ الشاشةَ كانت تأمر به ولا بابَ له ═══

     «احذف لقاءً أو راجعها لتوسيعه» في شاشة الجدولة، و«انقلها أو احذفها ثمّ
     اختر الفصل» في خطإ الفصل — وكلاهما يأمر بفعلٍ ليس في الواجهة البرمجيّة
     كلِّها. وهو كذلك مخرجُ الحلقة المغلقة: لقاءاتٌ ولّدتها الإدارةُ خارجَ
     الفصل لا تُنقل (النقلُ يمرّ بالنافذة التي يحاول فتحَها) — فتُحذف. */
  app.delete('/api/trainer/sessions/:sessionId', {
    preHandler: requirePermission('trainer.cohort.schedule'),
    schema: { tags: ['trainer-ops'], summary: 'حذفُ لقاءٍ لم ينعقد من شعبتي' },
  }, async (req) => {
    const { sessionId } = z.object({ sessionId: z.string().uuid() }).parse(req.params)
    return cohorts.trainerDeleteSession(req.auth!.userId, sessionId)
  })

  /* والاقتراحُ باقٍ لما يقع خارجَ النافذة — لا بديلا عمّا صار داخلها */
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
