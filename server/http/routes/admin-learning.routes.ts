/* مسارات إدارة التشغيل الأكاديمي — شعب، جلسات، روابط Zoom يدوية،
   مواد وتسجيلات خاصة، تسجيل متعلمين، روبرك، تقييمات، قواعد إكمال، شهادات. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { isDayCode } from '../../../src/application/schedule/days'
import { REVIEW_NOTE_MAX } from '../../../src/application/trainer/review-notes'
import { TRAINING_SEASONS, type TrainingSeason } from '../../../src/application/trainer/application-options'
import type { PrismaClient } from '@prisma/client'
import { CohortService } from '../../services/cohort.service'
import { openAllCohorts, alignCohortPrices } from '../../services/catalog-readiness.service'
import { EnrollmentService } from '../../services/enrollment.service'
import { AssessmentService } from '../../services/assessment.service'
import { ProgressService } from '../../services/progress.service'
import { CertificateService } from '../../services/certificate.service'
import { LearnerRequestService } from '../../services/learner-request.service'
import { CohortPlanService } from '../../services/cohort-plan.service'
import { PlanReviewBundleService, type ReviewBundle } from '../../services/plan-review-bundle.service'
import { AuthError } from '../../services/auth.service'
import { CohortFileService } from '../../services/cohort-file.service'
import { PlanEditService } from '../../services/plan-edit.service'
import { planEditsFile } from '../plan-edits-schema'
import { assertSafeKey } from '../../services/object-store'
import { requirePermission } from '../auth-plugin'

/* الأيّامُ رموزٌ معروفةٌ لا نصٌّ حرّ.

   كانت `z.array(z.string())` تقبل «الأحد» كما تقبل `sun`، فتُخزَّن الشعبةُ
   بتمثيلٍ لا يعرفه العارضُ ولا الفارز. والمنتقي في الواجهة يمنع ذلك بالنقر،
   لكنّ الواجهة ليست الحدّ — من ينادي الـAPI مباشرةً يتجاوزها. */
const dayCodes = z.array(z.string()).refine(
  (days) => days.every(isDayCode),
  { message: 'يومٌ غير معروف — الأيّام رموز: sun mon tue wed thu fri sat' },
)


/** رموزُ المواسم الأربعة — من `TRAINING_SEASONS` لا قائمةٌ ثانيةٌ تفترق عنها */
const TRAINING_SEASON_VALUES = TRAINING_SEASONS.map((x) => x.value) as [TrainingSeason, ...TrainingSeason[]]

export function registerAdminLearningRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const cohorts = new CohortService(prisma)
  const enrollments = new EnrollmentService(prisma)
  const assessments = new AssessmentService(prisma)
  const progress = new ProgressService(prisma)
  const certificates = new CertificateService(prisma)
  const learnerRequests = new LearnerRequestService(prisma)

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
    schema: { tags: ['admin-cohorts'], summary: 'يفتح شعبةً لكلّ دورة منشورة بلا شعبةٍ حيّة — موزّعةً على الفصل الأوّل (weeks = أقلّ مهلةٍ للتسجيل بالأسابيع)' },
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

  /* خطّةُ التقديم — الشرطُ الذي لم يكن يُوفَّى من المنصّة.

     صفوفُ `CohortDeliveryPlan` كانت تُكتب في موضعٍ واحدٍ فقط: نشرُ اقتراحِ
     تعديلٍ من مدرّبٍ بنطاق شعبة. فكلُّ شعبةٍ يدويّةٍ عالقةٌ في المسوّدة أبدا،
     لأنّ الشرطَ قائمٌ ولا بابَ إليه. */
  /* ═══ خطّةُ المدرّب — اعتمادٌ أو ردٌّ بتعديلات، وتذكير ═══ */
  const plans = new CohortPlanService(prisma)

  app.get('/api/admin/cohort-plans/pending', {
    preHandler: requirePermission('cohort.plan.approve'),
    schema: { tags: ['admin-cohorts'], summary: 'خططُ المدرّبين بانتظار الاعتماد' },
  }, async () => plans.pending())

  /* وعددُها وحدَه — شارةٌ إلى جانب «خططٌ تنتظر اعتمادك» تُجلب مع كلّ شاشة
     إدارة، فلا تجلب الخططَ وسياقَ إعدادها لتعدّها (`AdminLayout.tsx`) */
  app.get('/api/admin/cohort-plans/pending-count', {
    preHandler: requirePermission('cohort.plan.approve'),
    schema: { tags: ['admin-cohorts'], summary: 'عددُ خطط المدرّبين بانتظار الاعتماد' },
  }, async () => ({ count: await plans.pendingCount() }))

  app.get('/api/admin/cohorts/:cohortId/trainer-plan', {
    preHandler: requirePermission('cohort.manage'),
    schema: { tags: ['admin-cohorts'], summary: 'آخرُ خطّةِ مدرّبٍ لهذه الشعبة — حالتُها ومحتواها' },
  }, async (req) => {
    const { cohortId } = z.object({ cohortId: z.string().uuid() }).parse(req.params)
    return plans.latestForCohort(cohortId)
  })

  /* ═══ وحزمتُها للمراجعة خارجَ المنصّة (٧ أكتوبر ٢٠٢٦) ═══

     قرارُ صاحب المنصّة: زرُّ تنزيلٍ في شاشة الإدارة. ZIP فيه الخطّةُ نصّا مقروءا
     (`خطة-الشعبة.md`) وأصلُها (`plan.json`) وكلُّ ملفٍّ رفعه المدرّبُ فيها
     (`plan-review-bundle.service.ts`). والصلاحيّةُ صلاحيّةُ قراءتها في الشاشة:
     من يقرأ الخطّةَ في البطاقة يقرؤها في حزمة، ومن يقرأ الطابورَ ينزّله كلَّه. */
  const bundles = new PlanReviewBundleService(prisma)
  const sendZip = (reply: import('fastify').FastifyReply, b: ReviewBundle) => reply
    .header('content-type', 'application/zip')
    .header('content-disposition', `attachment; filename="plan-review.zip"; filename*=UTF-8''${encodeURIComponent(b.fileName)}`)
    .header('cache-control', 'no-store')
    .send(b.zip)

  app.get('/api/admin/cohorts/:cohortId/trainer-plan/review-bundle', {
    preHandler: requirePermission('cohort.manage'),
    schema: { tags: ['admin-cohorts'], summary: 'خطّةُ مدرّب الشعبة حزمةً للمراجعة — نصُّها وأصلُها وملفّاتُها' },
  }, async (req, reply) => {
    const { cohortId } = z.object({ cohortId: z.string().uuid() }).parse(req.params)
    const b = await bundles.forCohort(req.auth!.userId, cohortId)
    if (!b) throw new AuthError('not_found', 'لم يبدأ المدرّبُ خطّةَ هذه الشعبة بعد — فلا شيءَ يُنزَّل', 404)
    return sendZip(reply, b)
  })

  /* ═══ وتقريرُ المراجعة — يُرفع مع القرار ويُحفظ مع الخطّة (٨ أكتوبر ٢٠٢٦) ═══

     قرارُ صاحب المنصّة: التقريرُ يصل المدرّبَ من المنصّة لا من خارجها. يُطلب رابطُ رفعه
     هنا، ويُرفع إلى المخزن مباشرةً كأيّ ملفّ شعبة (`/api/v1/uploads`)، وتذكره رسالةُ القرار.
     والصلاحيّةُ صلاحيّةُ القرار نفسِه. */
  const reportFiles = new CohortFileService(prisma)
  app.post('/api/admin/cohort-plans/:id/review-report', {
    preHandler: requirePermission('cohort.plan.approve'),
    schema: { tags: ['admin-cohorts'], summary: 'رابطُ رفعِ تقرير مراجعةٍ لخطّةٍ بانتظار القرار (PDF أو Word)' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      mime: z.string().trim().min(3).max(120),
      originalName: z.string().trim().min(1).max(200),
    }).parse(req.body)
    return reply.status(201).send(await reportFiles.startReviewReportUpload(req.auth!.userId, id, body))
  })

  app.delete('/api/admin/cohort-plans/:id/review-report/:storageKey', {
    preHandler: requirePermission('cohort.plan.approve'),
    schema: { tags: ['admin-cohorts'], summary: 'حذفُ تقرير مراجعةٍ قبل القرار' },
  }, async (req) => {
    const { id, storageKey } = z.object({ id: z.string().uuid(), storageKey: z.string().min(10) }).parse(req.params)
    assertSafeKey(storageKey)
    return reportFiles.removeReviewReport(req.auth!.userId, id, storageKey)
  })

  /* ═══ وتعديلاتٌ مقترحةٌ على الخطّة — يقبل المدرّبُ كلًّا أو يرفضه (٨ أكتوبر ٢٠٢٦) ═══

     قرارُ صاحب المنصّة: «التعديلُ يطول على المدرّب — نكتبه نحن ويختار هو». يُرفع ملفًّا
     (JSON) على بطاقة المراجعة، ويُفحص كلُّه أو يُردّ كلُّه ببنوده (`plan-edit.service.ts`).
     والصلاحيّةُ صلاحيّةُ القرار نفسِه: من يردّ الخطّةَ يقترح عليها. */
  const planEdits = new PlanEditService(prisma)

  app.get('/api/admin/cohorts/:cohortId/plan-edits', {
    preHandler: requirePermission('cohort.manage'),
    schema: { tags: ['admin-cohorts'], summary: 'التعديلاتُ المقترحةُ على آخر خطّةٍ للشعبة — وحالُ كلٍّ منها' },
  }, async (req) => {
    const { cohortId } = z.object({ cohortId: z.string().uuid() }).parse(req.params)
    return planEdits.forCohort(cohortId)
  })

  app.post('/api/admin/cohort-plans/:id/edits', {
    preHandler: requirePermission('cohort.plan.approve'),
    schema: { tags: ['admin-cohorts'], summary: 'رفعُ تعديلاتٍ مقترحةٍ على خطّة مدرّب — ملفٌّ يُفحص كلُّه أو يُردّ كلُّه' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const file = planEditsFile.parse(req.body)
    if (file.planId && file.planId !== id) {
      throw new AuthError('wrong_plan', 'هذا الملفُّ كُتب لخطّةٍ أخرى — افتح بطاقةَ خطّته وارفعه هناك', 422)
    }
    return reply.status(201).send(await planEdits.propose(req.auth!.userId, id, file.items))
  })

  /* ═══ وكلُّ بندٍ يُعتمَد للمدرّب أو يُحذف قبل أن يصله (١٠ أكتوبر ٢٠٢٦) ═══
     «كلُّ ما يُطلب من المدرّب قبولُه يقبله المديرُ أو المديرُ الأكاديميُّ أو مديرُ المحتوى
     أوّلا» (صاحب المنصّة). وصلاحيّتُه مستقلّةٌ عن الرفع: `cohort.plan.edits.review`. */
  app.post('/api/admin/plan-edits/:editId/approve', {
    preHandler: requirePermission('cohort.plan.edits.review'),
    schema: { tags: ['admin-cohorts'], summary: 'اعتمادُ تعديلٍ مقترحٍ للمدرّب — يصله بعدها ليقبله أو يرفضه' },
  }, async (req) => {
    const { editId } = z.object({ editId: z.string().uuid() }).parse(req.params)
    return planEdits.review(req.auth!.userId, editId, true)
  })

  app.post('/api/admin/plan-edits/:editId/drop', {
    preHandler: requirePermission('cohort.plan.edits.review'),
    schema: { tags: ['admin-cohorts'], summary: 'حذفُ تعديلٍ مقترحٍ قبل أن يصل المدرّب' },
  }, async (req) => {
    const { editId } = z.object({ editId: z.string().uuid() }).parse(req.params)
    return planEdits.review(req.auth!.userId, editId, false)
  })

  app.post('/api/admin/cohort-plans/:id/edits/approve-all', {
    preHandler: requirePermission('cohort.plan.edits.review'),
    schema: { tags: ['admin-cohorts'], summary: 'اعتمادُ كلِّ ما بقي من التعديلات المقترحة للمدرّب' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return planEdits.reviewAll(req.auth!.userId, id)
  })

  app.delete('/api/admin/cohort-plans/:id/edits', {
    preHandler: requirePermission('cohort.plan.approve'),
    schema: { tags: ['admin-cohorts'], summary: 'سحبُ ما لم يُقرَّر فيه من التعديلات المقترحة' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return planEdits.withdraw(req.auth!.userId, id)
  })

  app.get('/api/admin/cohort-plans/pending/review-bundle', {
    preHandler: requirePermission('cohort.plan.approve'),
    schema: { tags: ['admin-cohorts'], summary: 'الخططُ المنتظِرةُ كلُّها حزمةً واحدةً للمراجعة' },
  }, async (req, reply) => sendZip(reply, await bundles.allPending(req.auth!.userId)))

  /* ═══ وما بقي بعد الاعتماد الأخير (٣ أكتوبر ٢٠٢٦) ═══
     شعبُ مدرّب هذه الشعبة المعتمَدةُ التي لم تُفتح، ونواقصُ فتح كلٍّ، وظهورُه العامّ —
     للّوح الذي يظهر حيث فُعِّل (`TrainerPlanReview`). يقرؤه من يعتمد الخطط؛ والفتحُ
     والنشرُ بعدُ بأبوابهما وصلاحيّتيهما (`cohort.open` · `trainer.publish`). */
  app.get('/api/admin/cohorts/:cohortId/next-steps', {
    preHandler: requirePermission('cohort.plan.approve'),
    schema: { tags: ['admin-cohorts'], summary: 'ما بقي بعد اعتماد خطط مدرّب الإعداد — فتحُ شعبه وظهورُه العامّ' },
  }, async (req) => {
    const { cohortId } = z.object({ cohortId: z.string().uuid() }).parse(req.params)
    return plans.nextStepsAfterApproval(cohortId)
  })

  app.post('/api/admin/cohort-plans/:id/decide', {
    preHandler: requirePermission('cohort.plan.approve'),
    schema: { tags: ['admin-cohorts'], summary: 'اعتمادُ خطّة مدرّبٍ ولقاءاتِها معا، أو ردُّها بملاحظةٍ لكلّ خطوة' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const text = z.string().max(REVIEW_NOTE_MAX).optional()
    const body = z.object({
      approve: z.boolean(),
      /* نصٌّ واحدٌ كما كان — أو لكلّ خطوةٍ ملاحظتُها، والمفاتيحُ خطواتُ المدرّب
         (`review-notes.ts`) ولا مفتاحَ غيرُها */
      note: z.union([
        z.string().max(REVIEW_NOTE_MAX),
        z.object({
          general: text, identity: text, modules: text, workbooks: text, sessions: text, assignments: text,
        }).strict(),
      ]).optional(),
    }).parse(req.body)
    return plans.decide(req.auth!.userId, id, body.approve, body.note)
  })

  /* ═══ التأجيلُ إلى موسمٍ قادم — قرارٌ ثالثٌ بجانب الاعتماد والردّ (٨ أكتوبر ٢٠٢٦) ═══
     «لم تُقبل لهذا الفصل»: تعود الخطّةُ إلى مدرّبها بموسمها الجديد، ولا تُرسَل قبله.
     والعلّةُ في `cohort-plan.service.ts` (`postpone`) و`plan-postpone.ts`. */
  app.post('/api/admin/cohort-plans/:id/postpone', {
    preHandler: requirePermission('cohort.plan.approve'),
    schema: { tags: ['admin-cohorts'], summary: 'تأجيلُ خطّة مدرّبٍ إلى موسمٍ قادم — لم تُقبل لهذا الفصل' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      year: z.number().int().min(2026).max(2100),
      season: z.enum(TRAINING_SEASON_VALUES),
      note: z.string().max(REVIEW_NOTE_MAX).optional(),
    }).parse(req.body)
    return plans.postpone(req.auth!.userId, id, { year: body.year, season: body.season }, body.note)
  })

  /* ═══ اللقاءاتُ المنتظِرةُ قرارا — في الطابور الذي تراجع فيه الإدارةُ خطّةَ
     الشعبة نفسِها (١٥ سبتمبر ٢٠٢٦) ═══

     «وبعدها الإدارةُ توافق، ويصبح هناك جلسةُ زووم لايف تُنشَر في منصّة
     الطلبة بتاريخها، ويُرسَل إيميلٌ للطلاب بالاجتماع وللإدارة» — وموضعُ
     القرار: «الموافقةُ في طابور الإدارة الحالي» (صاحب المنصّة).

     والصلاحيّةُ `cohort.plan.approve` نفسُها: من يعتمد خطّةَ الشعبة يعتمد
     لقاءاتِها — وصلاحيّةٌ ثانيةٌ لعملٍ واحدٍ تُمنح لأحدهما وتُنسى للآخر. */
  app.get('/api/admin/cohort-sessions/pending', {
    preHandler: requirePermission('cohort.plan.approve'),
    schema: { tags: ['admin-cohorts'], summary: 'اللقاءاتُ المباشرةُ بانتظار الاعتماد' },
  }, async (req) => {
    const { cohortId } = z.object({ cohortId: z.string().uuid().optional() }).parse(req.query ?? {})
    return cohorts.pendingSessions(cohortId)
  })

  app.post('/api/admin/cohort-sessions/:id/decide', {
    preHandler: requirePermission('cohort.plan.approve'),
    schema: { tags: ['admin-cohorts'], summary: 'اعتمادُ لقاءٍ مباشرٍ أو ردُّه — وبالاعتماد يُنشأ اجتماعُه ويُبلَّغ المسجَّلون' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ approve: z.boolean(), note: z.string().max(2000).optional() }).parse(req.body)
    return cohorts.decideSession(req.auth!.userId, id, body.approve, body.note)
  })

  /* ═══ ومهامُّ ما بعد الاعتماد — جديدةٌ أو تعديلٌ أو حذفٌ ينتظر (٣ج-٣) ═══

     «وبعد الاعتماد كلُّ تغييرٍ باعتماد». وبالصلاحيّة نفسِها التي تُعتمَد بها
     الخطّةُ ولقاءاتُها: من اعتمد المنهجَ يعتمد ما يُغيَّر فيه. والردُّ بسببه. */
  app.post('/api/admin/cohort-assessments/:id/decide', {
    preHandler: requirePermission('cohort.plan.approve'),
    schema: { tags: ['admin-cohorts'], summary: 'اعتمادُ مهمّةٍ جديدةٍ أو تعديلِها أو حذفِها بعد اعتماد الخطّة، أو ردُّه بسبب' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ approve: z.boolean(), note: z.string().max(2000).optional() }).parse(req.body)
    return assessments.decideTask(req.auth!.userId, id, body.approve, body.note)
  })

  app.post('/api/admin/cohorts/:cohortId/remind-trainer', {
    preHandler: requirePermission('cohort.manage'),
    schema: { tags: ['admin-cohorts'], summary: 'تذكيرُ مدرّب الشعبة بإكمال تجهيزها — جرسٌ وبريد' },
  }, async (req) => {
    const { cohortId } = z.object({ cohortId: z.string().uuid() }).parse(req.params)
    const body = z.object({ note: z.string().max(1000).optional() }).parse(req.body ?? {})
    return plans.remindTrainer(req.auth!.userId, cohortId, body.note)
  })

  app.get('/api/admin/cohorts/:cohortId/delivery-plans', {
    preHandler: requirePermission('cohort.manage'),
    schema: { tags: ['admin-learning'], summary: 'خطط تقديم الشعبة — الأساسية وما جاء من اقتراحات المدربين' },
  }, async (req) => {
    const { cohortId } = z.object({ cohortId: z.string().uuid() }).parse(req.params)
    return cohorts.deliveryPlans(cohortId)
  })

  app.put('/api/admin/cohorts/:cohortId/delivery-plan', {
    preHandler: requirePermission('cohort.manage'),
    schema: { tags: ['admin-learning'], summary: 'كتابة خطة التقديم الأساسية — أحد شروط فتح الشعبة' },
  }, async (req) => {
    const { cohortId } = z.object({ cohortId: z.string().uuid() }).parse(req.params)
    const body = z.object({
      notesAr: z.string().min(1).max(4000),
      deliveryMode: z.string().max(40).optional(),
    }).parse(req.body)
    return cohorts.setDeliveryPlan(cohortId, req.auth!.userId, body)
  })

  /* الاسمُ الافتراضيُّ للشعبة التالية — يملأ به المعالجُ خانتَه فيُرى قبل الإنشاء */
  app.get('/api/admin/cohorts/next-title', {
    preHandler: requirePermission('cohort.manage'),
    schema: { tags: ['admin-learning'], summary: 'اسمُ الشعبة التالية في الدورة: «اسمُ الدورة — شعبة N»' },
  }, async (req) => {
    const { courseId } = z.object({ courseId: z.string().min(2).max(64) }).parse(req.query)
    return { title: await cohorts.nextTitle(courseId) }
  })

  app.post('/api/admin/cohorts', {
    preHandler: requirePermission('cohort.manage'),
    schema: { tags: ['admin-learning'], summary: 'إنشاء شعبة — مسودة حتى تكتمل شروط الفتح' },
  }, async (req, reply) => {
    const body = z.object({
      /* وبلا عنوانٍ تُسمّى «اسمُ الدورة — شعبة N» (٢ أكتوبر ٢٠٢٦) */
      courseId: z.string(), pathwayId: z.string().optional(), title: z.string().trim().min(3).optional(),
      /* والفصلُ حقيقةٌ إداريّةٌ منذ ١٧ سبتمبر ٢٠٢٦ — تُكتب هنا لا في شاشة المدرّب */
      termId: z.string().uuid().nullish(),
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

  app.get('/api/admin/courses/:courseId/eligible-trainers', {
    preHandler: requirePermission('cohort.manage'),
    schema: { tags: ['admin-learning'], summary: 'مؤهَّلو دورةٍ — يقرؤها معالجُ إنشاء الشعبة قبل وجودها' },
  }, async (req) => {
    const { courseId } = z.object({ courseId: z.string().min(3).max(40) }).parse(req.params)
    return cohorts.eligibleTrainers(courseId)
  })

  app.post('/api/admin/cohorts/:id/trainers', {
    preHandler: requirePermission('trainer.assign'),
    schema: { tags: ['admin-learning'], summary: 'تعيين مدرب للشعبة — تأهيل إلزامي ومنع تعارض جدول' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ profileId: z.string().uuid(), role: z.enum(['lead', 'assistant']).default('lead') }).parse(req.body)
    return reply.status(201).send(await cohorts.assignTrainer(id, body.profileId, req.auth!.userId, body.role))
  })

  /* ═══ «افتح شعبةً لمدرّب» — الفعلُ الذي يسمّي الفصلَ ويفتح الشعبة ═══

     صياغةُ صاحب المنصّة (١٧ سبتمبر ٢٠٢٦): «عندما نقوم بإسناد دورةٍ لمدرّب
     نحدّد لأيّ فصلٍ ستكون، وبهذا نكون فتحنا شعبةً له ليقوم هو بتغيير
     تفاصيلها وتحديد ساعات اللقاء المباشر ووضع المصادر».

     فالإنشاءُ والفصلُ والإسنادُ فعلٌ واحدٌ في معاملةٍ واحدة — لا ثلاثةُ
     نداءاتٍ تُنسى إحداها، وأكثرُها نسيانا الفصلُ لأنّ غيابَه لا يُشتكى منه
     فورا: يُشتكى منه المدرّبُ بعد أسبوعٍ حين يعجز عن الجدولة. */
  app.post('/api/admin/cohorts/open-for-trainer', {
    preHandler: requirePermission('trainer.assign'),
    schema: { tags: ['admin-learning'], summary: 'فتحُ شعبةٍ لمدرّب — دورةٌ ومدرّبٌ في فعلٍ واحد، والفصلُ اختياريٌّ يُشتقّ من مدّته عند الاعتماد' },
  }, async (req, reply) => {
    const body = z.object({
      courseId: z.string().min(3).max(40),
      profileId: z.string().uuid(),
      /* اختياريّ (٣ج-٥): بلا فصلٍ يُشتقّ من تاريخ البدء الذي يحدّده المدرّبُ حين تُعتمَد خطّتُه */
      termId: z.string().uuid().optional(),
      title: z.string().min(3).max(200),
      pathwayId: z.string().optional(),
      capacity: z.number().int().min(1).optional(),
      price: z.number().min(0).optional(),
      currency: z.string().optional(),
      language: z.string().optional(),
      deliveryMode: z.enum(['remote', 'in_person', 'hybrid']).optional(),
    }).parse(req.body)
    return reply.status(201).send(await cohorts.openForTrainer(req.auth!.userId, body))
  })

  /* وتسميةُ فصلِ شعبةٍ قائمة — للشعب التي وُلدت قبل هذا القرار */
  app.post('/api/admin/cohorts/:id/term', {
    preHandler: requirePermission('cohort.manage'),
    schema: { tags: ['admin-learning'], summary: 'تسميةُ فصلِ شعبة — ومنه حدودُها ونافذةُ جدولة مدرّبها' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ termId: z.string().uuid() }).parse(req.body)
    return cohorts.setTerm(req.auth!.userId, id, body.termId)
  })

  /* ═══ الطابورُ الذي يمنع الحبسَ الصامت ═══

     شعبةٌ لها مدرّبٌ ولا فصلَ لها = مدرّبٌ يرى شعبةً لا يستطيع جدولتَها،
     ولا أحدَ في الإدارة يعلم. فتُعرض هنا مرتّبةً، والمحبوسُ فيها موسوم. */
  app.get('/api/admin/cohorts/without-term', {
    preHandler: requirePermission('cohort.manage'),
    schema: { tags: ['admin-learning'], summary: 'شعبٌ لم يُسمَّ فصلُها بعد — ومن أُسنِد إليها محبوسٌ عن الجدولة' },
  }, async () => cohorts.cohortsWithoutTerm())

  /* توليدُ الجلسات من النمط — والافتراضُ عرضٌ لا كتابة */
  app.post('/api/admin/cohorts/:id/sessions/generate', {
    preHandler: requirePermission('cohort.manage'),
    schema: { tags: ['admin-learning'], summary: 'يولّد جلساتِ الشعبة من جدولها الأسبوعيّ — apply=false يعرض أوّلا' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      weeks: z.coerce.number().int().min(1).max(52),
      from: z.coerce.date().optional(),
      durationMinutes: z.coerce.number().int().min(15).max(600).optional(),
      daysOfWeek: z.array(z.string()).optional(),
      startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      titlePrefix: z.string().max(60).optional(),
      apply: z.boolean().default(false),
    }).parse(req.body ?? {})
    return cohorts.generateSessions(req.auth!.userId, id, body)
  })

  /* تكرارُ شعبةٍ من فصلٍ سابق — بلا تسجيلاتٍ ولا حضورٍ ولا اجتماعات */
  /* مزامنةُ الحالات بالتواريخ — عرضٌ أوّلا، ثمّ تطبيقٌ بطلبٍ صريح.
     ويُنادى الآن من الشاشة، ومن العامل الخلفيّ يومَ يوجد. */
  app.post('/api/admin/cohorts/sync-statuses', {
    preHandler: requirePermission('cohort.manage'),
    schema: { tags: ['admin-learning'], summary: 'يُصلح حالاتَ الشعب المتأخّرةَ عن تواريخها — apply=false يعرض أوّلا' },
  }, async (req) => {
    const body = z.object({ apply: z.boolean().default(false) }).parse(req.body ?? {})
    return cohorts.syncStatusesByDate(req.auth!.userId, { apply: body.apply })
  })

  app.post('/api/admin/cohorts/:id/duplicate', {
    preHandler: requirePermission('cohort.manage'),
    schema: { tags: ['admin-learning'], summary: 'ينسخ إعدادَ الشعبة ومحتواها إلى مسودّةٍ جديدة' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      title: z.string().max(160).optional(),
      shiftWeeks: z.coerce.number().int().min(0).max(104).optional(),
      withSessions: z.boolean().default(false),
      withMaterials: z.boolean().default(true),
      withAssessments: z.boolean().default(true),
    }).parse(req.body ?? {})
    return reply.status(201).send(await cohorts.duplicate(req.auth!.userId, id, body))
  })

  /* ── نافذةُ جدولةِ المدرّب: تفتحها الإدارة، ويجدول المدرّبُ داخلها ──

     وإفراغُ الحدّين إغلاقٌ صريح: تعود الشعبةُ إلى أن تُجدوَل من الإدارة
     وحدَها. ولا حالةَ ثالثة — نصفُ نافذةٍ لا يُفتح بابا.

     وسقطُ سقفِ اللقاءات (٤ أكتوبر ٢٠٢٦): «لا حاجةَ لسقف الشعبة — يضيفون ما
     شاؤوا، وساعاتٌ أكثرُ جودةٌ أعلى». ومن أرسله من عميلٍ قديمٍ أُسقط صامتا (`z.object`
     يُسقط ما لا يعرف) — فلا يُردّ حفظُ النافذة لأجل حقلٍ لم يعد له معنى. */
  app.put('/api/admin/cohorts/:id/schedule-window', {
    preHandler: requirePermission('cohort.manage'),
    schema: { tags: ['admin-learning'], summary: 'فتحُ نافذةِ جدولةٍ للمدرّب أو إغلاقُها — مدًى بلا سقف' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      start: z.coerce.date().nullish(),
      end: z.coerce.date().nullish(),
    }).parse(req.body ?? {})
    return cohorts.setScheduleWindow(req.auth!.userId, id, body)
  })

  app.get('/api/admin/cohorts/:id/sessions', {
    preHandler: requirePermission('cohort.manage'),
    schema: { tags: ['admin-learning'], summary: 'جلساتُ الشعبة لاختيارها بالعنوان والتاريخ — بديلُ لصق المعرّف' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return cohorts.sessionsFor(id)
  })

  app.get('/api/admin/learners/search', {
    preHandler: requirePermission('enrollment.manage'),
    schema: { tags: ['admin-learning'], summary: 'بحثُ متعلّمٍ بالاسم أو البريد للتسجيل — بديلُ لصق المعرّف' },
  }, async (req) => {
    const { q, cohortId } = z.object({ q: z.string().min(2).max(80), cohortId: z.string().uuid().optional() }).parse(req.query)
    return cohorts.searchLearners(cohortId, q)
  })

  app.get('/api/admin/cohorts/:id/open-checklist', {
    preHandler: requirePermission('cohort.manage'),
    schema: { tags: ['admin-learning'], summary: 'فحص شروط الفتح الخمسة — يعيد النواقص دون تغيير حالة' },
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
    schema: { tags: ['admin-learning'], summary: 'إضافة جلسة — واجتماعُها وتبليغُ المسجَّلين معها' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      title: z.string().min(2), startsAt: z.coerce.date(), endsAt: z.coerce.date().optional(),
      timezone: z.string().optional(), moduleId: z.string().optional(),
      /* `withZoom` يُنشئ اجتماعا حقيقيّا على Zoom — وغيابُه يُبقي السلوكَ القديم
         حرفيّا: جلسةٌ بلا اجتماعٍ وبلا تبليغ، كما تعتمده الشاشاتُ القائمة. */
      withZoom: z.boolean().optional(),
    }).parse(req.body)
    return reply.status(201).send(await cohorts.addSessionWithMeeting(req.auth!.userId, id, body))
  })

  /* اجتماعٌ حقيقيٌّ لجلسةٍ قائمة — للجلسات التي وُلّدت مع الشعبة بلا اجتماع */
  app.post('/api/admin/sessions/:sessionId/zoom/create', {
    preHandler: requirePermission('cohort.manage'),
    schema: { tags: ['admin-learning'], summary: 'إنشاءُ اجتماع Zoom حقيقيٍّ لجلسةٍ قائمة' },
  }, async (req, reply) => {
    const { sessionId } = z.object({ sessionId: z.string().uuid() }).parse(req.params)
    return reply.status(201).send(await cohorts.attachApiZoom(req.auth!.userId, sessionId))
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

  /* محتوى الشعبة بأسمائه — يُقرأ قبل الأرشفة لا بعدها */
  app.get('/api/admin/cohorts/:id/content', {
    preHandler: requirePermission('cohort.manage'),
    schema: { tags: ['admin-learning'], summary: 'موادُّ الشعبة وتسجيلاتُها بأسمائها — بديلُ لصق معرّف المحتوى' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return cohorts.contentFor(id)
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

  /* مسجَّلو الشعبة بأسمائهم — تُقرأ قبل الإسقاط لا بعده */
  app.get('/api/admin/cohorts/:id/enrollments', {
    preHandler: requirePermission('enrollment.manage'),
    schema: { tags: ['admin-learning'], summary: 'مسجَّلو الشعبة لاختيارهم بالاسم — بديلُ لصق معرّف التسجيل' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return cohorts.roster(id)
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

  /* ── طلباتُ المتعلّمين: شهادةُ دورةٍ أو مسارٍ أو توصية ──

     الطلبُ يصل من البوابة مستوفيا قواعدَ الإكمال (تُفحَص قبل إنشائه)، فما في
     هذا الطابور مؤهَّلٌ بحساب النظام لا بدعوى صاحبه. والقرارُ هنا فعلٌ إداريّ
     يُسجَّل ويُبلَّغ صاحبُه: «أُنجز» بعد إصدار الشهادة أو كتابة التوصية،
     و«اعتذار» بسببٍ يُقرأ — لا صمتٌ يُبقيه منتظرا. */
  app.get('/api/admin/learner-requests', {
    preHandler: requirePermission('certificate.issue'),
    schema: { tags: ['admin-learning'], summary: 'طلباتُ المتعلّمين المفتوحة — الأقدمُ أوّلا' },
  }, async (req) => {
    const q = z.object({ status: z.enum(['pending', 'in_review', 'fulfilled', 'declined']).optional() }).parse(req.query)
    return learnerRequests.queue(q.status)
  })

  app.post('/api/admin/learner-requests/:id/decide', {
    preHandler: requirePermission('certificate.issue'),
    schema: { tags: ['admin-learning'], summary: 'قرارٌ على طلب متعلّم — والاعتذار بسببٍ إلزاميّ' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      status: z.enum(['in_review', 'fulfilled', 'declined']),
      decisionAr: z.string().max(2_000).optional(),
    }).parse(req.body)
    return learnerRequests.decide(id, req.auth!.userId, body.status, body.decisionAr)
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
