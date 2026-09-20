/* مسارات إدارة المدربين — مراجعة الطلبات، قرارات، عقود، دعوات،
   تأهيل، إسناد، شعب، نشر عام، إيقاف، ومراجعة اقتراحات التعديل. */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { TrainerReviewService, RUBRIC_CRITERIA } from '../../services/trainer-review.service'
import { TrainerOfferService } from '../../services/trainer-offer.service'
import { TrainerDossierLinkService } from '../../services/trainer-dossier-link.service'
import { TrainerChangeService } from '../../services/trainer-change.service'
import { CourseProposalService } from '../../services/course-proposal.service'
import { TrainerPathService } from '../../services/trainer-path.service'
import { TrainerDepartureService } from '../../services/trainer-departure.service'
import { TrainerApplicationService } from '../../services/trainer-application.service'
import { EarningsService } from '../../services/earnings.service'
import { requirePermission } from '../auth-plugin'
import { blastRadiusSentenceAr, courseBlastRadius } from '../../services/catalog-impact.service'
import { analyzeImpact } from '../../services/impact.service'
import { COURSE_PREP_MIN_DAYS } from '../../../src/application/trainer/notice-periods'
import { INTERVIEW_OUTCOME_KEYS } from '../../../src/application/trainer/interview-outcome'

/* اختياريّةٌ: النقصُ جائزٌ كما في `assertRubric`. وصارمةٌ: المفتاحُ المجهولُ
   يُرَدّ في الحاجز كما يُرَدّ في الخدمة — ولا يُقبل صامتا فيضيع. */
const rubricSchema = z.object(
  Object.fromEntries(RUBRIC_CRITERIA.map((k) => [k, z.number().int().min(1).max(5)])),
).partial().strict()

/* الفاعلُ برتبته لا بمعرّفه وحدَه — تصنيفُ الاقتراح يفتح مهمّةً قائمة،
   و`StaffTaskService` تقيس الرتبةَ قبل أن تُكلّف. */
function actorOf(req: { auth: { userId: string; roles: string[] } | null }) {
  return { userId: req.auth!.userId, roles: req.auth!.roles }
}

export function registerAdminTrainerRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const review = new TrainerReviewService(prisma)
  const offers = new TrainerOfferService(prisma)
  const links = new TrainerDossierLinkService(prisma)
  const changes = new TrainerChangeService(prisma)
  const proposals = new CourseProposalService(prisma)
  const trainerPaths = new TrainerPathService(prisma)
  const departures = new TrainerDepartureService(prisma)
  const applications = new TrainerApplicationService(prisma)

  app.get('/api/admin/trainer-applications', {
    preHandler: requirePermission('trainer.applications.view'),
    schema: { tags: ['admin-trainers'], summary: 'كل طلبات انضمام المدربين — قابلة للترشيح بالحالة' },
  }, async (req) => {
    const { status } = z.object({ status: z.string().optional() }).parse(req.query)
    return review.listApplications(status)
  })

  /* ── الحذف النهائيّ ──

     الطلبُ المنتهي كان يبقى في القاعدة أبدا. وهو صحيحٌ للطلبات الحقيقية،
     ويترك كلَّ طلبِ اختبارٍ في الإنتاج بلا سبيلٍ إلى إزالته.

     وحبّتُه منفصلة (`trainer.applications.purge`) لا تُمنح بالمراجعة: من
     يراجع ليس بالضرورة من يمحو. وهي عند مدير النظام وحده — ويستطيع أن
     يفوّضها لغيره من شاشة الصلاحيات إن أراد. */
  app.delete('/api/admin/trainer-applications/:reference', {
    preHandler: requirePermission('trainer.applications.purge'),
    config: { rateLimit: { max: 20, timeWindow: '10 minutes' } },
    schema: { tags: ['admin-trainers'], summary: 'حذفُ طلبٍ منتهٍ نهائيّا — بسببٍ يُسجَّل قبل الحذف' },
  }, async (req) => {
    const { reference } = z.object({ reference: z.string().trim().min(3).max(60) }).parse(req.params)
    const { reasonAr } = z.object({ reasonAr: z.string().trim().min(5).max(500) }).parse(req.body)
    return applications.purge(reference, req.auth!.userId, reasonAr)
  })

  /* ── روابطُ سجلِّ المتقدّم — تُنشأ باسمٍ وتُلغى باسم ──

     الرمزُ يُردّ **مرّةً واحدةً عند الإنشاء** ولا يُقرأ بعدها أبدا: لا يُحفظ
     منه إلّا هاشُه. فمن أضاع الرابطَ أنشأ غيرَه وألغى الأوّل — ولا سبيلَ إلى
     استرجاعه، وهو المقصود. */
  app.post('/api/admin/trainer-applications/:id/dossier-links', {
    preHandler: requirePermission('trainer.applications.review'),
    schema: { tags: ['admin-trainers'], summary: 'رابطُ سجلٍّ باسمِ قارئ — يُردّ رمزُه مرّةً واحدة' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      reviewerName: z.string().trim().min(2).max(120),
      reviewerEmail: z.string().trim().email().max(200).optional(),
      days: z.number().int().min(1).max(180).optional(),
      /* الإرسالُ هنا أو لا يُرسَل أبدا: الرمزُ لا يُحفظ، فهذه لحظتُه الوحيدة */
      sendEmail: z.boolean().optional(),
    }).parse(req.body ?? {})
    const made = await links.create(id, req.auth!.userId, {
      reviewerName: body.reviewerName,
      reviewerEmail: body.reviewerEmail ?? null,
      sendEmail: body.sendEmail ?? false,
      ...(body.days ? { ttlMs: body.days * 24 * 3600_000 } : {}),
    })
    return reply.status(201).send({ url: made.url, link: made.link, emailDelivery: made.emailDelivery })
  })

  app.get('/api/admin/trainer-applications/:id/dossier-links', {
    preHandler: requirePermission('trainer.applications.review'),
    schema: { tags: ['admin-trainers'], summary: 'روابطُ السجلّ وحالُها — مَن، ومتى فُتح، وهل أُلغي' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return links.list(id)
  })

  /* تجديدُ رابطٍ قائم — رمزٌ جديدٌ على الصفّ نفسِه، لا صفٌّ ثانٍ للقارئ الواحد.
     و`POST` لا `GET`: فعلٌ يُبطل القديمَ ويكتب في القاعدة، لا قراءةٌ تُعاد. */
  app.post('/api/admin/trainer-applications/:id/dossier-links/:linkId/rotate', {
    preHandler: requirePermission('trainer.applications.review'),
    schema: { tags: ['admin-trainers'], summary: 'تجديدُ رابطِ قارئ — يبطل القديمُ ويبقى تقييمُه وسجلُّ فتحه' },
  }, async (req) => {
    const { id, linkId } = z.object({
      id: z.string().uuid(), linkId: z.string().uuid(),
    }).parse(req.params)
    const { sendEmail } = z.object({ sendEmail: z.boolean().optional() }).parse(req.body ?? {})
    const made = await links.rotate(id, linkId, req.auth!.userId, { sendEmail })
    return { url: made.url, link: made.link, emailDelivery: made.emailDelivery }
  })

  app.delete('/api/admin/trainer-applications/:id/dossier-links/:linkId', {
    preHandler: requirePermission('trainer.applications.review'),
    schema: { tags: ['admin-trainers'], summary: 'إلغاءُ رابطِ سجلّ — لا حذفُه، فالتقييمُ المكتوبُ به معلَّقٌ باسمه' },
  }, async (req) => {
    const { id, linkId } = z.object({ id: z.string().uuid(), linkId: z.string().uuid() }).parse(req.params)
    return links.revoke(id, linkId, req.auth!.userId)
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

  /* دعوةٌ إلى الحجز — لا جدولةٌ تفرض ساعة. تُستعمل حين نريد لقاءً ثانيا
     ولا نعرف فراغَه: يختار هو من التقويم الذي يحجب ما حُجز. */
  app.post('/api/admin/trainer-applications/:id/interview-invite', {
    preHandler: requirePermission('trainer.applications.review'),
    schema: { tags: ['admin-trainers'], summary: 'دعوةُ المتقدّم إلى حجز موعدِ مقابلةٍ بنفسه' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return reply.status(201).send(await review.inviteToBookInterview(id, req.auth!.userId))
  })

  /* تذكيرٌ لمن وصل طلبُه ولم يحجز — غيرُ الدعوة فوقَها: تلك للقاءٍ ثانٍ،
     وهذه تقول «بقيت خطوةٌ واحدة» وتردّه إلى صفحة طلبه ليحجز منها. */
  app.post('/api/admin/trainer-applications/:id/booking-reminder', {
    preHandler: requirePermission('trainer.applications.review'),
    schema: { tags: ['admin-trainers'], summary: 'تذكيرُ متقدّمٍ لم يحجز موعدَ لقاء التعارف' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return reply.status(201).send(await review.remindToBookInterview(id, req.auth!.userId))
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
    /* والقائمةُ من المعجم المشترك: زرٌّ في الشاشة لا يقبله الخادمُ عطبٌ
       يُرى عند أوّل ضغطة، وقيمةٌ يقبلها الخادمُ بلا عنوانٍ عربيٍّ تُعرض
       لاتينيّةً في بطاقة المقابلة. */
    const body = z.object({
      outcome: z.enum(INTERVIEW_OUTCOME_KEYS), notes: z.string().max(1000).optional(),
    }).parse(req.body)
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
    schema: { tags: ['admin-trainers'], summary: 'قرار بشري — اعتمادٌ بنقرة، أو خطوةٌ من السلسلة التفصيلية' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      action: z.enum([
        /* الاعتمادُ بنقرةٍ واحدة — يُنشئ الملفَّ ويربط الحسابَ ويمنح الدورَ
           ويُعلم صاحبَه، من أيّ حالةٍ حيّة. وما بعده السلسلةُ التفصيليّةُ
           لمن أرادها: لم يُحذف منها زرّ. */
        'approve',
        'move_to_review', 'request_info', 'shortlist', 'request_demo', 'academic_review',
        'conditionally_approve', 'waitlist', 'reject',
        /* والتراجعُ عن الردّ — يردّ الطلبَ إلى المراجعة، وسببُه إلزاميٌّ
           يصل المتقدّمَ بنصّه. تفصيلُه في `decide` وفي خريطة الانتقالات. */
        'undo_reject',
        'start_onboarding', 'activate', 'reinstate']),
      note: z.string().max(1000).optional(),
    }).parse(req.body)
    /* وحالُ بريد القرار يُعاد كما ردّه الإرسالُ — لا تُكتب الشاشةُ «أُبلغ»
       على ظنٍّ (`src/application/notifications/delivery.ts`). */
    const outcome = await review.decide(id, req.auth!.userId, body.action, body.note)
    return { ok: true, ...outcome }
  })

  /* ─────────── تعيينُ مدرّبٍ داخليّا ───────────

     الحارسُ `admin.users.manage` — وهو للمدير الأعلى وحدَه — لأنّ هذا المسار
     يُنشئ حسابا ويمنح دورا، وذاك بابُ الصلاحيّات لا بابُ الأكاديمية.

     ويُشترط معه `trainer.applications.decide`: من يعيّن مدرّبا يجب أن يملك
     قرارَ المدرّبين أصلا، فلا يصير البابُ طريقا جانبيّا حول الطابور. */
  app.post('/api/admin/trainers/direct', {
    preHandler: requirePermission('admin.users.manage'),
    schema: { tags: ['admin-trainers'], summary: 'تعيينُ مدرّبٍ داخليّا — حسابٌ وطلبٌ نشطٌ وملفٌّ ودورٌ في معاملةٍ واحدة' },
  }, async (req, reply) => {
    if (!req.auth!.permissions.includes('trainer.applications.decide')) {
      return reply.status(403).send({
        error: {
          code: 'forbidden',
          message_ar: 'تعيينُ مدرّبٍ يحتاج قرارَ المدرّبين أيضا — لا صلاحيةَ الحسابات وحدَها',
        },
      })
    }
    const body = z.object({
      fullName: z.string().trim().min(2).max(120),
      email: z.string().trim().toLowerCase().email('صيغة البريد غير صحيحة'),
      headline: z.string().trim().max(160).optional(),
    }).parse(req.body)
    return reply.status(201).send(await review.createTrainerDirectly(req.auth!.userId, body))
  })

  /* ═══════════ العقود — تركيبٌ ومعاينةٌ وإلغاء ═══════════

     خلف `trainer.contract.manage` لا `trainer.compensation.manage`: من يقرّر
     «هذا الشخصُ أريده» هو من يتعاقد، والماليّةُ تبقى وحدَها من يضبط الأجر.
     والتصميمُ في docs/superpowers/specs/2026-09-19-trainer-contract-design.md */

  const requiredDocumentsSchema = z.array(z.object({
    kind: z.string().min(1).max(40),
    labelAr: z.string().trim().min(1).max(120),
    required: z.boolean(),
  })).max(12)

  const composeBody = z.object({
    title: z.string().trim().min(3).max(160),
    courseIds: z.array(z.string()).optional(),
    requiredDocuments: requiredDocumentsSchema,
    hoursNoteAr: z.string().trim().max(500).nullish(),
    rateWaivedReasonAr: z.string().trim().max(500).nullish(),
  })

  app.get('/api/admin/trainer-contracts', {
    preHandler: requirePermission('trainer.contract.manage'),
    schema: { tags: ['admin-trainers'], summary: 'قائمةُ العقود، ومن ينتظر عقدا ولا عقدَ له' },
  }, async () => review.listContracts())

  /* المتنُ في نداءٍ مستقلّ: القائمةُ تحمل عشراتِ الصفوف، ومتنُ العقد آلافُ
     الأحرف. فحملُه في القائمة يجعل كلَّ فتحةِ شاشةٍ تنقل ما لا يُقرأ. */
  app.get('/api/admin/trainer-contracts/:contractId/body', {
    preHandler: requirePermission('trainer.contract.manage'),
    schema: { tags: ['admin-trainers'], summary: 'متنُ العقد المجمَّد كما وُقّع عليه' },
  }, async (req) => {
    const { contractId } = z.object({ contractId: z.string().uuid() }).parse(req.params)
    return review.contractBody(contractId)
  })

  app.get('/api/admin/trainer-applications/:id/contract-prefill', {
    preHandler: requirePermission('trainer.contract.manage'),
    schema: { tags: ['admin-trainers'], summary: 'معطياتُ شاشة تركيب العقد — الأجرُ والدوراتُ المؤهَّل لها وما ينقص من هويّة الأكاديميّة' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return review.contractPrefill(id)
  })

  /* المعاينةُ لا تُحفَظ ولا تُغيّر حالةً — ولذلك تعمل ولو نقصت هويّةُ
     الأكاديميّة: الموظّفُ يرى الوثيقةَ ويرى مواضعَ النقص قبل أن يُطلب سدُّها. */
  app.post('/api/admin/trainer-applications/:id/contract-preview', {
    preHandler: requirePermission('trainer.contract.manage'),
    schema: { tags: ['admin-trainers'], summary: 'معاينةُ متن العقد كما يراه المدرّب — بلا حفظ' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = composeBody.parse(req.body)
    return { bodyAr: await review.previewContract(id, body) }
  })

  app.post('/api/admin/trainer-applications/:id/contracts/compose', {
    preHandler: requirePermission('trainer.contract.manage'),
    schema: { tags: ['admin-trainers'], summary: 'تركيبُ العقد وتجميدُ متنه — ينقل غيرَ النشط إلى contract_pending' },
  }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = composeBody.parse(req.body)
    return reply.status(201).send(await review.composeContract(id, req.auth!.userId, body))
  })

  /* والرابطُ يُعاد للموظّف مع الردّ لا في التطوير وحدَه — كما في الدعوة
     الآمنة: قناةُ البريد قد تتعثّر، ومن يملك الصلاحيّةَ يحتاج نسخةً يسلّمها
     بيده. وبلا ذلك يُنشأ رابطٌ لا يملك أحدٌ رمزَه، أي عقدٌ لا يُوقَّع أبدا. */
  app.post('/api/admin/trainer-contracts/:contractId/send', {
    preHandler: requirePermission('trainer.contract.manage'),
    schema: { tags: ['admin-trainers'], summary: 'إرسالُ العقد للتوقيع — يسكّ الرابطَ وينقل غيرَ النشط إلى contract_pending' },
  }, async (req) => {
    const { contractId } = z.object({ contractId: z.string().uuid() }).parse(req.params)
    return review.sendContract(contractId, req.auth!.userId)
  })

  app.post('/api/admin/trainer-contracts/:contractId/resend', {
    preHandler: requirePermission('trainer.contract.manage'),
    schema: { tags: ['admin-trainers'], summary: 'تجديدُ رابط التوقيع — والقديمُ يموت لحظتَها' },
  }, async (req) => {
    const { contractId } = z.object({ contractId: z.string().uuid() }).parse(req.params)
    return review.resendContract(contractId, req.auth!.userId)
  })

  app.post('/api/admin/trainer-contracts/:contractId/revoke', {
    preHandler: requirePermission('trainer.contract.manage'),
    schema: { tags: ['admin-trainers'], summary: 'إلغاءُ عقدٍ مفتوح — لا يُحذف، والسببُ يُكتب' },
  }, async (req) => {
    const { contractId } = z.object({ contractId: z.string().uuid() }).parse(req.params)
    const { reasonAr } = z.object({ reasonAr: z.string().trim().min(5).max(500) }).parse(req.body)
    return review.revokeContract(contractId, req.auth!.userId, reasonAr)
  })

  /* وثيقةُ الهويّة تُفتَح قبل الاعتماد — فالاعتمادُ مطابقةٌ بها.
     والرابطُ موقَّتٌ لعشر دقائق كوثائق الطلب، وكلُّ فتحةٍ تُكتب في الأثر. */
  app.get('/api/admin/trainer-contracts/:contractId/documents/:documentId/url', {
    preHandler: requirePermission('trainer.contract.manage'),
    schema: { tags: ['admin-trainers'], summary: 'رابطُ قراءةٍ موقَّتٌ لوثيقةِ هويّةٍ مع عقد' },
  }, async (req) => {
    const { contractId, documentId } = z.object({
      contractId: z.string().uuid(), documentId: z.string().uuid(),
    }).parse(req.params)
    return review.contractDocumentUrl(contractId, documentId, req.auth!.userId)
  })

  /* ═══════════ الاعتماد — ويحتاج صلاحيّتين ═══════════

     `trainer.contract.manage` تكفي لتركيب عقدٍ وإرساله وإلغائه: تلك أفعالُ
     وثيقة. والاعتمادُ ليس كذلك — هو **يفعّل حسابا ويمنح دورَ مدرّب**، وذاك
     بابُ `trainer.applications.decide`. فمن ملك التعاقدَ وحدَه لا يصير به
     طريقا جانبيّا حول قرارِ المدرّبين، كما في `/api/admin/trainers/direct`.

     ولا يُستبدَل الحارسُ بـ`decide` وحدَها: من يعتمد عقدا يقرأ متنَه
     ووثائقَه، وذلك خلف `trainer.contract.manage`. فالاثنتان معا. */
  const requireDecideToo = (req: FastifyRequest, reply: FastifyReply): true | undefined => {
    if (!req.auth!.permissions.includes('trainer.applications.decide')) {
      reply.status(403).send({
        error: {
          code: 'forbidden',
          message_ar: 'اعتمادُ عقدٍ يفتح حسابا ويمنح دورا — ويحتاج قرارَ المدرّبين أيضا، لا صلاحيةَ العقود وحدَها',
        },
      })
      return undefined
    }
    return true
  }

  app.post('/api/admin/trainer-contracts/:contractId/countersign', {
    preHandler: requirePermission('trainer.contract.manage'),
    schema: { tags: ['admin-trainers'], summary: 'اعتمادُ توقيعِ المدرّب — ينفذ العقدُ ويُفعَّل حسابُه إن كان يحبسه' },
  }, async (req, reply) => {
    if (!requireDecideToo(req, reply)) return reply
    const { contractId } = z.object({ contractId: z.string().uuid() }).parse(req.params)
    const { noteAr } = z.object({ noteAr: z.string().trim().max(500).nullish() }).parse(req.body ?? {})
    return review.countersignContract(contractId, req.auth!.userId, { noteAr })
  })

  app.post('/api/admin/trainer-contracts/:contractId/reject-signature', {
    preHandler: requirePermission('trainer.contract.manage'),
    schema: { tags: ['admin-trainers'], summary: 'رفضُ توقيعٍ لا يطابق وثيقةَ الهويّة — يُغلَق العقدُ ولا يُمحى دليلُه' },
  }, async (req, reply) => {
    if (!requireDecideToo(req, reply)) return reply
    const { contractId } = z.object({ contractId: z.string().uuid() }).parse(req.params)
    const { reasonAr } = z.object({ reasonAr: z.string().trim().min(5).max(500) }).parse(req.body)
    return review.rejectSignature(contractId, req.auth!.userId, reasonAr)
  })

  /* ═══════════ عروضُ الإسناد ═══════════

     خلف `trainer.assign` لا `trainer.contract.manage`: العرضُ إسنادٌ مؤجَّلٌ
     إلى قبولِ صاحبه، وحارسُه حارسُ الإسناد. ومن يملك أن يُسنِد رأسا يملك
     أن يعرض — والعكسُ ليس لازما. */

  app.get('/api/admin/trainer-offers', {
    preHandler: requirePermission('trainer.assign'),
    schema: { tags: ['admin-trainers'], summary: 'عروضُ الإسناد — والمفتوحةُ أوّلا' },
  }, async (req) => {
    const q = z.object({
      profileId: z.string().uuid().optional(),
      status: z.enum(['offered', 'accepted', 'declined', 'lapsed', 'withdrawn']).optional(),
    }).parse(req.query)
    return offers.listForAdmin(q)
  })

  app.get('/api/admin/trainer-offers/options', {
    preHandler: requirePermission('trainer.assign'),
    schema: { tags: ['admin-trainers'], summary: 'من يصلح أن يُعرَض عليه، وما يصلح أن يُعرَض — ومن عنده عرضٌ قائم' },
  }, async () => offers.offerOptions())

  app.post('/api/admin/trainer-offers', {
    preHandler: requirePermission('trainer.assign'),
    schema: { tags: ['admin-trainers'], summary: 'عرضُ دورةٍ على مدرّبٍ مؤهَّلٍ لها — دعوةٌ تُقبَل وتُردّ' },
  }, async (req, reply) => {
    const body = z.object({
      profileId: z.string().uuid(),
      courseId: z.string().min(2).max(64),
      cohortId: z.string().uuid().nullish(),
      sessionsCount: z.number().int().min(1).max(500).nullish(),
      startsAt: z.coerce.date().nullish(),
      feeNoteAr: z.string().trim().max(500).nullish(),
      noteAr: z.string().trim().max(1000).nullish(),
      prepDays: z.number().int().min(COURSE_PREP_MIN_DAYS).max(60).nullish(),
      responseDays: z.number().int().min(1).max(60).nullish(),
    }).parse(req.body)
    return reply.status(201).send(await offers.offer(body, req.auth!.userId))
  })

  app.post('/api/admin/trainer-offers/:offerId/withdraw', {
    preHandler: requirePermission('trainer.assign'),
    schema: { tags: ['admin-trainers'], summary: 'سحبُ عرضٍ قبل قبوله — والسببُ يصل صاحبَه' },
  }, async (req) => {
    const { offerId } = z.object({ offerId: z.string().uuid() }).parse(req.params)
    const { reasonAr } = z.object({ reasonAr: z.string().trim().min(5).max(500) }).parse(req.body)
    return offers.withdraw(offerId, req.auth!.userId, reasonAr)
  })

  app.post('/api/admin/trainer-applications/:id/contracts', {
    preHandler: requirePermission('trainer.compensation.manage'),
    schema: { tags: ['admin-trainers'], summary: '⚠️ مهجور — البابُ القديم بلا متن. يُحذف في المرحلة الثانية' },
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
    /* الرابط يُعاد للمسؤول دائما لا في التطوير وحده.
       كان يُحجب في الإنتاج انتظارا لقناة بريد لا وجود لها في الشيفرة، فتُنشأ
       الدعوة ولا يملك أحد رمزها — أي أن الحساب لا يُفتح أبدا. والبريد يُرسل
       الآن فعلا، لكن المسؤول (وله صلاحية trainer.invite) يحتاج نسخةً يسلّمها
       بيده حين تتعذّر القناة أو لا تصل الرسالة. */
    return reply.status(201).send({
      expiresAt: result.expiresAt,
      acceptUrl: result.acceptUrl,
      emailDelivery: result.emailDelivery,
      invitationToken: result.tokenForDelivery,
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

  /* ─────────── طلبُ التأهيل من الشعبة ───────────

     بوّابةُ نزاهة التأهيل تبقى قائمة: **من يطلب ليس من يقرّر**. فالطلبُ
     بصلاحية إدارة الشعب (`cohort.manage`) — وهي صلاحيةُ من يجدول ويُسند —
     والقرارُ بصلاحية التأهيل (`trainer.qualify`) وحدَها. ولو جاز للطالب أن
     يقرّر لصارت الموافقةُ ختما لا مراجعة، وسقط معنى التأهيل كلُّه. */
  app.post('/api/admin/cohorts/:cohortId/qualification-requests', {
    preHandler: requirePermission('cohort.manage'),
    schema: { tags: ['admin-trainers'], summary: 'طلب تأهيل مدرّب لدورة هذه الشعبة — الموافقة تؤهّل وتُسند معا' },
  }, async (req, reply) => {
    const { cohortId } = z.object({ cohortId: z.string().uuid() }).parse(req.params)
    const body = z.object({
      profileId: z.string().uuid(),
      courseId: z.string(),
      note: z.string().trim().max(500).optional(),
    }).parse(req.body)
    return reply.status(201).send(
      await review.requestQualification(body.profileId, body.courseId, cohortId, req.auth!.userId, body.note),
    )
  })

  /* قائمةُ المدرّبين للتشغيل — بصلاحية التأهيل لا بصلاحية المستحقّات.

     `‎/api/admin/trainer-profiles` وراء `trainer.compensation.manage`، وهي
     ليست للمدير الأكاديميّ. فمن يملك التأهيلَ والإسنادَ والإيقاف كان **لا
     يستطيع أن يرى من يؤهّله** — والمسارُ موجودٌ والشاشةُ لا تُبنى عليه.
     وحمولةُ هذه ما يلزم القرارَ: لا مبالغَ ولا قواعدَ تعويض. */
  app.get('/api/admin/trainers/ops', {
    preHandler: requirePermission('trainer.qualify'),
    schema: { tags: ['admin-trainers'], summary: 'المدرّبون وحالاتُهم التشغيلية — تأهيلا وإسنادا وظهورا' },
  }, async () => review.listForOps())

  app.get('/api/admin/qualification-requests', {
    preHandler: requirePermission('trainer.qualify'),
    schema: { tags: ['admin-trainers'], summary: 'طلبات التأهيل المعلّقة — بانتظار قرار المدير الأكاديميّ' },
  }, async () => review.pendingQualifications())

  app.post('/api/admin/qualification-requests/:id/decide', {
    preHandler: requirePermission('trainer.qualify'),
    schema: { tags: ['admin-trainers'], summary: 'البتّ في طلب تأهيل — الموافقة تؤهّل وتُسند للشعبة المطلوبة' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      approve: z.boolean(),
      note: z.string().trim().max(500).optional(),
    }).parse(req.body)
    return review.decideQualification(id, body.approve, req.auth!.userId, body.note)
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

  /* ═══ الملفُّ العامُّ — الصلاحيّةُ `trainer.publish` ═══

     لأنّ ما يُكتب هنا هو **بعينه** ما تعرضه صفحةُ الفريق للعامّة: عنوانُه
     ونبذتُه وصورتُه. فمن يملك اعتمادَ الظهور يملك تحريرَ ما يَظهر، ولا
     يُفتح بابٌ ثالثٌ حول القرار نفسِه. */
  app.put('/api/admin/trainers/:profileId/public-profile', {
    preHandler: requirePermission('trainer.publish'),
    schema: { tags: ['admin-trainers'], summary: 'عنوانُ المدرّب ونبذتُه وصورتُه — ما تعرضه صفحةُ الفريق' },
  }, async (req) => {
    const { profileId } = z.object({ profileId: z.string().uuid() }).parse(req.params)
    const body = z.object({
      headline: z.string().trim().max(160).nullish(),
      bioPublic: z.string().trim().max(1200).nullish(),
      photoUrl: z.string().trim().max(500).nullish(),
    }).parse(req.body ?? {})
    return review.savePublicProfile(profileId, req.auth!.userId, body)
  })

  app.post('/api/admin/trainers/:profileId/photo-upload', {
    preHandler: requirePermission('trainer.publish'),
    schema: { tags: ['admin-trainers'], summary: 'رابطُ رفعٍ موقّتٌ لصورة المدرّب — يحتاج FILE_UPLOADS' },
  }, async (req, reply) => {
    const { profileId } = z.object({ profileId: z.string().uuid() }).parse(req.params)
    const { mime } = z.object({ mime: z.string().max(60) }).parse(req.body ?? {})
    return reply.status(201).send(await review.startPhotoUpload(profileId, req.auth!.userId, mime))
  })

  /* اعتمادُ صورةٍ رفعها المدرّبُ لنفسه — أو ردُّها.

     وبصلاحيّة `trainer.publish` لا `trainer.qualify`: هذا قرارُ **عرضٍ
     عامّ**، فيملكه من يملك النشرَ لا من يملك التأهيل. */
  app.post('/api/admin/trainers/:profileId/photo/approve', {
    preHandler: requirePermission('trainer.publish'),
    schema: { tags: ['admin-trainers'], summary: 'اعتمادُ الصورة المعلّقة — تصير صورةَ الصفحة العامّة' },
  }, async (req) => {
    const { profileId } = z.object({ profileId: z.string().uuid() }).parse(req.params)
    return review.approvePendingPhoto(profileId, req.auth!.userId)
  })

  app.post('/api/admin/trainers/:profileId/photo/reject', {
    preHandler: requirePermission('trainer.publish'),
    schema: { tags: ['admin-trainers'], summary: 'ردُّ الصورة المعلّقة — تبقى صورةَ حسابه ولا تُعرض عامّة' },
  }, async (req) => {
    const { profileId } = z.object({ profileId: z.string().uuid() }).parse(req.params)
    const { reasonAr } = z.object({ reasonAr: z.string().trim().max(300).optional() }).parse(req.body ?? {})
    return review.rejectPendingPhoto(profileId, req.auth!.userId, reasonAr)
  })

  /* اقتراحاتُ الدورات يحرّرها الأدمن — بصلاحيّة مراجعة الطلبات نفسِها،
     فمن يقرّر في الطلب يصحّح ما يُقرَّر عليه. والسقفُ سقفُ `MAX_PROPOSALS`. */
  app.put('/api/admin/trainer-applications/:id/teachable-proposals', {
    preHandler: requirePermission('trainer.applications.review'),
    schema: { tags: ['admin-trainers'], summary: 'تحريرُ اقتراحات الدورات — إضافةً وتسميةً وحذفا' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      proposals: z.array(z.object({
        titleAr: z.string().max(200),
        summaryAr: z.string().max(1500).optional().default(''),
      })).max(20),
    }).parse(req.body)
    return { proposals: await review.saveTeachableProposals(id, req.auth!.userId, body.proposals) }
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

  /* ═══ رحيلُ مدرّب — شيءٌ واحدٌ يُتتبَّع (ن-٩ · ن-١٠) ═══

     والصلاحيّةُ `trainer.assign`: هذا إسنادٌ ونقلٌ في شعب، وهي صلاحيّتُهما.
     ولا صلاحيّةَ جديدةٌ تعني منحَها من جديدٍ لكلّ من يُسنِد اليوم.

     **ولا مالَ يتحرّك من هنا**: الردُّ طلبٌ يُرفع إلى الماليّة فتقرّه
     بصلاحيّتها المستقلّة، والرصيدُ كوبونٌ مقصورٌ على صاحبه. */
  app.get('/api/admin/trainer-departures', {
    preHandler: requirePermission('trainer.assign'),
    schema: { tags: ['admin-trainers'], summary: 'ملفّاتُ رحيلِ المدرّبين (ن-٩)' },
  }, async (req) => {
    const { scope } = z.object({ scope: z.enum(['open', 'all']).optional() }).parse(req.query)
    return departures.list(scope ?? 'open')
  })

  app.post('/api/admin/trainer-departures', {
    preHandler: requirePermission('trainer.assign'),
    schema: { tags: ['admin-trainers'], summary: 'فتحُ ملفِّ رحيل — تُجمَع شعبُه ويُفتح لكلّ متعلّمٍ صفّ' },
  }, async (req, reply) => {
    const body = z.object({
      profileId: z.string().uuid(),
      reasonAr: z.string().trim().min(5).max(2000),
    }).parse(req.body)
    return reply.status(201).send(await departures.open(req.auth!.userId, body.profileId, body.reasonAr))
  })

  app.get('/api/admin/trainer-departures/:id', {
    preHandler: requirePermission('trainer.assign'),
    schema: { tags: ['admin-trainers'], summary: 'ملفُّ رحيلٍ بكلّ اسمٍ فيه وما يمنع إغلاقَه' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return departures.detail(id)
  })

  app.get('/api/admin/cohorts/:cohortId/substitutes', {
    preHandler: requirePermission('trainer.assign'),
    schema: { tags: ['admin-trainers'], summary: 'من يصلح بديلا لهذه الشعبة — تُنتجها المنصّةُ لا الذاكرة' },
  }, async (req) => {
    const { cohortId } = z.object({ cohortId: z.string().uuid() }).parse(req.params)
    return departures.substitutesFor(cohortId)
  })

  app.post('/api/admin/trainer-departures/:id/substitute', {
    preHandler: requirePermission('trainer.assign'),
    schema: { tags: ['admin-trainers'], summary: 'بديلٌ يأخذ مكانَه — فلا يتحرّك إلّا الاسم (الطريقُ الأوّل)' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      cohortId: z.string().uuid(), profileId: z.string().uuid(),
    }).parse(req.body)
    return departures.substitute(req.auth!.userId, id, body.cohortId, body.profileId)
  })

  app.get('/api/admin/departure-cases/:caseId/equivalents', {
    preHandler: requirePermission('trainer.assign'),
    schema: { tags: ['admin-trainers'], summary: 'الشعبُ النظيرة — على الرمز نفسِه، مجموعةٌ معرَّفةٌ لا اجتهاد (ح-٣)' },
  }, async (req) => {
    const { caseId } = z.object({ caseId: z.string().uuid() }).parse(req.params)
    return departures.equivalentCohorts(caseId)
  })

  app.post('/api/admin/departure-cases/:caseId/move', {
    preHandler: requirePermission('trainer.assign'),
    schema: { tags: ['admin-trainers'], summary: 'نقلُ متعلّمٍ إلى نظير (الطريقُ الثاني)' },
  }, async (req) => {
    const { caseId } = z.object({ caseId: z.string().uuid() }).parse(req.params)
    const body = z.object({
      toCohortId: z.string().uuid(), noteAr: z.string().trim().max(2000).nullish(),
    }).parse(req.body)
    return departures.moveLearner(req.auth!.userId, caseId, body.toCohortId, body.noteAr)
  })

  app.post('/api/admin/departure-cases/:caseId/offer-choice', {
    preHandler: requirePermission('trainer.assign'),
    schema: { tags: ['admin-trainers'], summary: 'عرضُ الاختيار على صاحبه — ولا يُختار عنه (ن-١٠)' },
  }, async (req) => {
    const { caseId } = z.object({ caseId: z.string().uuid() }).parse(req.params)
    const body = z.object({ noteAr: z.string().trim().max(2000).nullish() }).parse(req.body ?? {})
    return departures.offerChoice(req.auth!.userId, caseId, body.noteAr)
  })

  app.get('/api/admin/departure-cases/:caseId/refundable', {
    preHandler: requirePermission('trainer.assign'),
    schema: { tags: ['admin-trainers'], summary: 'دفعاتُ هذه الشعبة التي يُردّ منها — لا تُخمَّن' },
  }, async (req) => {
    const { caseId } = z.object({ caseId: z.string().uuid() }).parse(req.params)
    return departures.refundablePayments(caseId)
  })

  app.post('/api/admin/departure-cases/:caseId/settle', {
    preHandler: requirePermission('trainer.assign'),
    schema: { tags: ['admin-trainers'], summary: 'تنفيذُ ما اختاره — طلبُ ردٍّ إلى الماليّة أو رصيدٌ باسمه' },
  }, async (req) => {
    const { caseId } = z.object({ caseId: z.string().uuid() }).parse(req.params)
    const body = z.object({
      amount: z.number().min(0), bonus: z.number().min(0).optional(),
      currency: z.string().max(8).optional(),
      /* الدفعةُ التي يُردّ منها — تُشترط في الردّ ويتجاهلها الرصيد */
      paymentId: z.string().uuid().optional(),
    }).parse(req.body)
    return departures.settleChoice(req.auth!.userId, caseId, body)
  })

  app.post('/api/admin/departure-cases/:caseId/notify', {
    preHandler: requirePermission('trainer.assign'),
    schema: { tags: ['admin-trainers'], summary: 'إبلاغُ صاحبه — ويُردّ على صفٍّ لم يُقرَّر (قاعدةُ السمعة)' },
  }, async (req) => {
    const { caseId } = z.object({ caseId: z.string().uuid() }).parse(req.params)
    return departures.notify(req.auth!.userId, caseId)
  })

  app.post('/api/admin/trainer-departures/:id/close', {
    preHandler: requirePermission('trainer.assign'),
    schema: { tags: ['admin-trainers'], summary: 'إغلاقُ الملفّ — ولا يُغلق واسمٌ معلَّق' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return departures.close(req.auth!.userId, id)
  })

  /* ═══ مساراتُ المدرّبين — مراجعةُ ما يُعرض على الرفّ العامّ (ن-١ · ن-٧) ═══

     والصلاحيّةُ `trainer.publish` بنصّها «الموافقة على ظهور المدرب للعامة» —
     وهذا عينُه: إدراجٌ عامٌّ يحمل اسمَه. ولا صلاحيّةَ جديدةٌ تعني منحَها من
     جديدٍ لكلّ من يوافق اليوم.

     **والاسمُ يُعتمد مع المسار في المراجعة نفسِها** (ن-٧): اسمٌ على رفٍّ عامٍّ
     نصُّ تسويقٍ يحمل مصداقيّةَ الأكاديميّة، ولا يُنشر ادّعاءٌ عامٌّ بلا نظرة. */
  app.get('/api/admin/trainer-paths', {
    preHandler: requirePermission('trainer.publish'),
    schema: { tags: ['admin-trainers'], summary: 'مساراتُ المدرّبين — طابورُ المراجعة (ن-١)' },
  }, async (req) => {
    const { scope } = z.object({ scope: z.enum(['open', 'all']).optional() }).parse(req.query)
    return trainerPaths.queue(scope ?? 'open')
  })

  app.post('/api/admin/trainer-paths/:id/approve', {
    preHandler: requirePermission('trainer.publish'),
    schema: { tags: ['admin-trainers'], summary: 'نشرُ المسار على الرفّ — يُردّ لمن لم يُعتمد ظهورُه (ن-٢)' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return trainerPaths.approve(req.auth!.userId, id)
  })

  app.post('/api/admin/trainer-paths/:id/reject', {
    preHandler: requirePermission('trainer.publish'),
    schema: { tags: ['admin-trainers'], summary: 'ردُّ المسار بسببٍ يقرؤه صاحبُه' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ noteAr: z.string().trim().min(5).max(2000) }).parse(req.body)
    return trainerPaths.reject(req.auth!.userId, id, body.noteAr)
  })

  app.post('/api/admin/trainer-paths/:id/retire', {
    preHandler: requirePermission('trainer.publish'),
    schema: { tags: ['admin-trainers'], summary: 'سحبُ المسار من الرفّ — ولا يمسّ من التحق (ن-٤)' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ noteAr: z.string().trim().max(2000).nullish() }).parse(req.body ?? {})
    return trainerPaths.retire(req.auth!.userId, id, body.noteAr)
  })

  /* ═══ طابورُ الدورات المقترحة — تُصنَّف قبل أن تدخل الكتالوج (ح-٤) ═══

     الصلاحيّةُ `trainer.change.review` نفسُها لا صلاحيّةٌ جديدة: هي بنصّها
     «مراجعة اقتراحات تعديل الدورات من المدربين»، وهذا منها — ومن يراجع
     اقتراحَ تعديلٍ على دورةٍ قائمةٍ هو من يحكم في دورةٍ يقترحها. وصلاحيّةٌ
     جديدةٌ تعني منحَها لكلِّ من يراجع اليوم، وذلك عملٌ بلا مقابل.

     وثلاثةُ أبوابٍ لا رابع:
     · **نسخةٌ من رمزٍ قائم** — يُربط الاقتراحُ بالرمز ولا يُنشأ إصدار. بابُ
       الإصدار بعدها بيدِ المدرّب (ح-٣)، فلا يُكتب باسمه ما لم يكتبه.
     · **دورةٌ جديدة** — تُنشأ في شاشة الكتالوج بنموذجها الكامل (مسارٌ
       وتسلسلٌ وساعاتٌ ومهارات)، ثمّ يُربط الاقتراحُ بها هنا.
     · **رفضٌ بسبب** — والسببُ يلزم: من رُفض اقتراحُه بلا سببٍ أعاده كما هو. */
  app.get('/api/admin/course-proposals', {
    preHandler: requirePermission('trainer.change.review'),
    schema: { tags: ['admin-trainers'], summary: 'دوراتٌ اقترحها المدرّبون — طابورُ التصنيف (ح-٤)' },
  }, async (req) => {
    const { scope } = z.object({ scope: z.enum(['open', 'all']).optional() }).parse(req.query)
    return proposals.queue(scope ?? 'open')
  })

  app.post('/api/admin/course-proposals/:id/link', {
    preHandler: requirePermission('trainer.change.review'),
    schema: { tags: ['admin-trainers'], summary: 'تصنيفُ اقتراحٍ نسخةً من رمزٍ قائم — يُربط ولا يُنشأ إصدار' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      courseId: z.string().min(2).max(64),
      noteAr: z.string().trim().max(2000).nullish(),
    }).parse(req.body)
    return proposals.linkToCourse(actorOf(req), id, body.courseId, body.noteAr)
  })

  app.post('/api/admin/course-proposals/:id/became-course', {
    preHandler: requirePermission('trainer.change.review'),
    schema: { tags: ['admin-trainers'], summary: 'ربطُ اقتراحٍ بالدورة الجديدة التي أُنشئت منه' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      courseId: z.string().min(2).max(64),
      noteAr: z.string().trim().max(2000).nullish(),
    }).parse(req.body)
    return proposals.markBecameCourse(actorOf(req), id, body.courseId, body.noteAr)
  })

  /* بابٌ ثالثٌ قبل القرار: اسأل صاحبَه.

     ومن صنّف اقتراحا لا يفهمه خمّن أو رفض — والرفضُ لسؤالٍ لم يُسأل يُفقد
     المنصّةَ دورةً ويُفقد المدرّبَ ثقتَه. */
  app.post('/api/admin/course-proposals/:id/ask', {
    preHandler: requirePermission('trainer.change.review'),
    schema: { tags: ['admin-trainers'], summary: 'سؤالُ صاحبِ الاقتراح قبل تصنيفه — يصله في بوّابته' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ questionAr: z.string().trim().min(5).max(2000) }).parse(req.body)
    return proposals.askTrainer(req.auth!.userId, id, body.questionAr)
  })

  app.post('/api/admin/course-proposals/:id/reject', {
    preHandler: requirePermission('trainer.change.review'),
    schema: { tags: ['admin-trainers'], summary: 'رفضُ اقتراحِ دورةٍ بسببٍ يقرؤه صاحبُه' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({ noteAr: z.string().trim().min(5).max(2000) }).parse(req.body)
    return proposals.reject(req.auth!.userId, id, body.noteAr)
  })

  /* ── مراجعة اقتراحات تعديل الدورات من المدربين ── */

  app.get('/api/admin/trainer-change-requests', {
    preHandler: requirePermission('trainer.change.review'),
    schema: { tags: ['admin-trainers'], summary: 'اقتراحات تعديل الدورات من المدربين' },
  }, async (req) => {
    const { status } = z.object({ status: z.string().optional() }).parse(req.query)
    return changes.listForReview(status)
  })

  app.post('/api/admin/trainers/:profileId/catalog-scope', {
    preHandler: requirePermission('trainer.change.review'),
    schema: { tags: ['admin-trainers'], summary: 'منح أو سحب نطاق الكتالوج لمدرب — قرار مسجَّل بتاريخه ومانحه (هـ-١)' },
  }, async (req) => {
    const { profileId } = z.object({ profileId: z.string().uuid() }).parse(req.params)
    const body = z.object({ grant: z.boolean() }).parse(req.body)
    return changes.grantCatalogScope(profileId, req.auth!.userId, body.grant)
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

  app.get('/api/admin/trainer-change-requests/:id/hours-impact', {
    preHandler: requirePermission('trainer.change.review'),
    schema: { tags: ['admin-trainers'], summary: 'أثر ساعات الاقتراح — الحدّ النسبي وكل خطة مركبة تضمّ الدورة (ب-٥)' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return changes.hoursImpact(id)
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

  /* الشعبُ لنماذج الأتعاب — قراءةٌ ضيّقةٌ خلف صلاحيّة الأتعاب نفسِها.
     و`‎/api/admin/cohorts` وراء `cohort.manage` ولا تملكها المالية، فكان
     الطلبُ يُردّ ٤٠٣ ويُسقط الشاشةَ كلَّها. */
  app.get('/api/admin/trainer-payouts/cohort-options', {
    preHandler: requirePermission('trainer.compensation.manage'),
    schema: { tags: ['admin-trainers'], summary: 'الشعبُ باختصار — لقصر قاعدة الأتعاب وتوليد الكشف' },
  }, async () => earnings.listCohortOptions())

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

  app.get('/api/admin/trainer-compensation/summary', {
    preHandler: requirePermission('trainer.compensation.manage'),
    schema: { tags: ['admin-trainers'], summary: 'كلُّ مدرّبٍ في سطر: قاعدتُه السارية وما يُنتظر له وما اعتُمد وما دُفع' },
  }, async () => earnings.trainerSummaries())

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
      referralRate: z.number().positive().optional(),
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
