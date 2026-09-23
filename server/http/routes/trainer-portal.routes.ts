/* مسارات بوابة المدرب — ملفي، تأهيلي وإسناداتي، مخطط دورة مؤهل لها،
   اقتراح تعديل، وسحب اقتراح. كلها تتطلب صلاحيات دور trainer الفعلية. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { TrainerChangeService } from '../../services/trainer-change.service'
import {
  CourseProposalService, MAX_PROPOSAL_QUESTION, MAX_PROPOSAL_SUMMARY,
  MAX_PROPOSAL_TITLE, MIN_PROPOSAL_TITLE,
} from '../../services/course-proposal.service'
import { TrainerPathService } from '../../services/trainer-path.service'
import { MAX_PATH_BLURB, MAX_PATH_COURSES, MAX_PATH_TITLE } from '../../../src/application/trainer/path-rules'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { TrainerOfferService } from '../../services/trainer-offer.service'
import { TrainerBankService, MAX_ACCOUNT_LEN } from '../../services/trainer-bank.service'
import { EarningsService } from '../../services/earnings.service'
import { TrainerAvailabilityService } from '../../services/trainer-availability.service'
import { TermService } from '../../services/term.service'
import { requirePermission } from '../auth-plugin'
import { AuthError } from '../../services/auth.service'

/* جسمُ المسار — واحدٌ للإنشاء والتعديل، فلا يفترق حدّان لشيءٍ واحد */
const pathBody = z.object({
  titleAr: z.string().trim().min(1).max(MAX_PATH_TITLE),
  blurbAr: z.string().trim().max(MAX_PATH_BLURB).nullish(),
  termId: z.string().uuid().nullish(),
  courseIds: z.array(z.string().min(2).max(64)).max(MAX_PATH_COURSES),
})

export function registerTrainerPortalRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const changes = new TrainerChangeService(prisma)
  const proposals = new CourseProposalService(prisma)
  const paths = new TrainerPathService(prisma)
  const review = new TrainerReviewService(prisma)
  const offers = new TrainerOfferService(prisma)
  const bank = new TrainerBankService(prisma)
  const earnings = new EarningsService(prisma)
  const availability = new TrainerAvailabilityService(prisma)
  const terms = new TermService(prisma)

  /* ═══ مهلةُ العرض المشروط — ما يفعله المدرّبُ بها ═══

     ولا صلاحيّةَ جديدة: `trainer.portal` بابُ بوّابته، والملفُّ يُستخرَج من
     حسابه لا من جسم الطلب — فلا يُعلن أحدٌ عن موادّ غيره ولا يمدّد مهلتَه. */
  app.post('/api/trainer/condition/declare-complete', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'أعلنتُ اكتمالَ موادّي — تتجمّد المهلةُ وتصل الطابور' },
  }, async (req) => review.declareMaterialsComplete(req.auth!.userId))

  app.post('/api/trainer/condition/extend', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'امنحني يومين — مرّةً واحدةً، والثانيةُ تُردّ بنصّها' },
  }, async (req) => review.requestConditionExtension(req.auth!.userId))

  app.get('/api/trainer/earnings', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'كشوف مستحقاتي وبنودها وملخصها — للمدرب نفسه فقط' },
  }, async (req) => earnings.listForTrainer(req.auth!.userId))

  /* ═══ عروضُ الإسناد — والجوابُ له وحدَه ═══

     ولا صلاحيةَ جديدةً لها: `trainer.portal` هي بابُ بوّابته كلِّها، والعرضُ
     يُقرأ ويُجاب فيها. والملفُّ يُستخرَج من حسابه لا من جسمِ الطلب — فلا
     يُجيب أحدٌ عن عرضِ غيره. */
  /* ═══ حسابي البنكيّ — يكتبه بنفسه، ولا يُعاد إليه إلّا مقنَّعا ═══

     والبندُ ٤-٤ من عقده يقول إنّ موضعَه هنا: «في بوّابته على المنصّة تحت
     مستحقّاتي بعد تفعيل حسابه» — لا في الوثيقة الموقَّعة، بمشورةٍ قانونيّة. */
  app.get('/api/trainer/bank-account', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'حسابي البنكيُّ مقنَّعا — ولا يُعاد الرقمُ أبدا' },
  }, async (req) => bank.mine(req.auth!.userId))

  app.put('/api/trainer/bank-account', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'كتابةُ الحساب البنكيّ أو تبديلُه — يُخزَّن معمّى ويصله خبرُه' },
  }, async (req) => {
    const body = z.object({
      iban: z.string().trim().min(8).max(MAX_ACCOUNT_LEN + 8),
      holderName: z.string().trim().min(4).max(160),
      bankNameAr: z.string().trim().min(2).max(120),
      branchAr: z.string().trim().max(120).nullish(),
      swiftBic: z.string().trim().max(16).nullish(),
    }).parse(req.body)
    return bank.setMine(req.auth!.userId, body)
  })

  app.get('/api/trainer/offers', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'عروضُ الإسناد التي عُرضت عليّ — وما قبِلتُه وينتظر إعدادي' },
  }, async (req) => offers.listForTrainer(req.auth!.userId))

  app.post('/api/trainer/offers/:offerId/accept', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'قبولُ عرضٍ — ويُعاد عنده فحصُ التأهيل والجدول والحالة' },
  }, async (req) => {
    const { offerId } = z.object({ offerId: z.string().uuid() }).parse(req.params)
    return offers.accept(offerId, req.auth!.userId)
  })

  app.post('/api/trainer/offers/:offerId/decline', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'الاعتذارُ عن عرض — جوابٌ مشروعٌ لا عطب' },
  }, async (req) => {
    const { offerId } = z.object({ offerId: z.string().uuid() }).parse(req.params)
    const { reasonAr } = z.object({ reasonAr: z.string().trim().min(5).max(500) }).parse(req.body)
    return offers.decline(offerId, req.auth!.userId, reasonAr)
  })

  app.post('/api/trainer/offers/:offerId/prep-confirm', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'الإقرارُ بالجاهزيّة — يطوي أجلَ الإعداد' },
  }, async (req) => {
    const { offerId } = z.object({ offerId: z.string().uuid() }).parse(req.params)
    return offers.confirmPrep(offerId, req.auth!.userId)
  })

  app.get('/api/trainer/me', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'ملف المدرب الحالي — تأهيله وإسناداته ومهام التهيئة' },
  }, async (req) => {
    const profile = await changes.profileForUser(req.auth!.userId)
    const full = await prisma.trainerProfile.findUnique({
      where: { id: profile.id },
      include: {
        application: { select: { fullName: true, email: true, status: true, reference: true } },
        qualifications: true, assignments: { include: { cohort: true } }, onboardingTasks: true,
        /* ═══ وعقدُه يُنتقى حقلا حقلا ═══

           كان `contracts: { ... take: 1 }` بلا `select`، فيخرج الصفُّ كاملا
           إلى بوّابته: متنُ العقد كلُّه، وعنوانُ شبكته ومتصفّحُه لحظةَ
           التوقيع، وملحوظةُ المعتمِد، وسببُ الإلغاء — ومعها منذ اليومَ
           **سببُ الفسخ**، وهو نصُّ موظّفٍ عن رحيله يُكتب لعينِ موظّفٍ آخر.

           ولا شاشةَ في بوّابته تقرأ منه حرفا اليوم (لا مستهلِكَ له في
           `src/pages/trainer/`)، فالخارجُ كلُّه فائضٌ يُسرَّب ولا يُعرَض.
           فيُنتقى ما يصلح أن يُقرأ: ما اسمُه، وأين صار، ومتى. */
        contracts: {
          orderBy: { createdAt: 'desc' }, take: 1,
          select: {
            id: true, title: true, status: true, kind: true, revision: true,
            sentAt: true, signedAt: true, countersignedAt: true,
            terminatedAt: true, createdAt: true,
          },
        },
      },
    })
    /* ── عددُ ما ينتظر تصحيحَه ──

       الإشعارُ يُقرأ مرّةً ثمّ يُنسى؛ والرقمُ في القائمة يبقى ما بقي العمل.
       فهو الإشارةُ الأولى لا الثانية: يُرى بلا فتحِ شيء، ويصير صفرا وحدَه
       حين يفرغ الطابور. */
    const pendingGrading = await prisma.assignmentSubmission.count({
      where: {
        status: { in: ['submitted', 'under_review'] },
        assessment: { cohort: { trainers: { some: { profileId: profile.id } } } },
      },
    })
    return { ...full, pendingGrading }
  })

  /* مهام التهيئة تُكمَل من صاحبها.

     أربع مهام تُزرع عند القبول المشروط، ويُغلَق «توقيع العقد» تلقائيا عند
     التوقيع — والثلاث الباقية لم يكن لها طريق إغلاق في الشيفرة كلها: لا مسار
     ولا زر ولا حتى نداء إداري. فتبقى معلّقة في ملف كل مدرب إلى الأبد.
     الإغلاق هنا للمدرب على مهامّه هو وحدها؛ و«توقيع العقد» مستثنى لأنه يُغلَق
     بواقعة موثقة لا بإقرار صاحبه. */
  app.post('/api/trainer/me/onboarding-tasks/:key/complete', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'إتمام مهمة تهيئة من مهامي' },
  }, async (req) => {
    const { key } = z.object({ key: z.string().min(2).max(64) }).parse(req.params)
    if (key === 'sign_contract') {
      throw new AuthError('not_self_completable', 'توقيع العقد يُغلق بتوقيعه لا بإقرارك', 409)
    }
    const profile = await changes.profileForUser(req.auth!.userId)
    const task = await prisma.trainerOnboardingTask.findUnique({
      where: { profileId_key: { profileId: profile.id, key } },
    })
    if (!task) throw new AuthError('not_found', 'لا مهمة بهذا المفتاح في ملفك', 404)
    if (task.doneAt) return task
    return prisma.trainerOnboardingTask.update({
      where: { profileId_key: { profileId: profile.id, key } },
      data: { doneAt: new Date() },
    })
  })

  app.get('/api/trainer/me/qualifications', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'الدورات المؤهل لها مع عناوينها' },
  }, async (req) => {
    const profile = await changes.profileForUser(req.auth!.userId)
    /* من اعتُمد قبل التأهيل التلقائيّ يلحق هنا — والنداءُ لا يكتب شيئا إن لم يكن ما يُضاف */
    await review.syncQualificationsFromApplication(profile.id, null)
    const quals = await prisma.trainerCourseQualification.findMany({
      where: { profileId: profile.id, status: 'qualified' },
      include: { course: { include: { versions: { orderBy: { version: 'desc' }, take: 1 } } } },
    })
    return quals.map((q) => ({
      courseId: q.courseId, title: q.course.versions[0]?.titleAr ?? '',
      currentVersion: q.course.currentVersion, qualifiedAt: q.createdAt,
    }))
  })

  /* حُذفت هنا أربعةُ مساراتٍ بلا شاشة (٨ سبتمبر ٢٠٢٦): مخطّطُ الدورة، وإرسالُ
     اقتراحِ تعديلٍ وقائمتُه وسحبُه. وأمّا جانبُ الإدارة من `TrainerChangeService`
     فباقٍ في `admin-trainer.routes.ts` بشاشته.

     ═══ ثمّ عاد منها بابُ الاسم بشاشته (ح-٣)، ثمّ أُغلق (ق٥) ═══

     عاد `/api/trainer/course-title-proposals` — إرسالا وقائمةً وسحبا — ليكون
     للمدرّب بابٌ إلى اسم دورته في قناةٍ صحيحة: maker-checker وإصدارٌ جديدٌ لا
     كتابةٌ فوق القائم. وأغلقه صاحبُ المنصّة (١٧ سبتمبر ٢٠٢٦): «بابُ اسم
     الدورة يُغلق» — قناةٌ لا يملكها أحدٌ أسوأُ من لا قناة.

     فلا مسلكَ اسمٍ هنا، ولا نوعَ `course_title_edit` في `CHANGE_TYPES`
     أصلا — والإغلاقُ من الجذر لا من الشاشة وحدَها. */

  /* ═══ دوراتي المقترحة — ما أقدر عليه وليس في كتالوجكم (ح-٢) ═══

     كتبها يومَ تقدّم (أ-٣) فحُفظت في طلبه، وبُذرت إلى جدولها يومَ اعتُمد.
     وهنا يملكها: يضيف ويعدّل ويحذف **ما لم يُبتّ فيه**. وما بُتّ فيه يقرؤه
     ولا يكتبه — اقتراحٌ صار دورةً في الكتالوج لا يُحذف من تحت قرارِ من
     اعتمده.

     والصلاحيّةُ `trainer.portal`: هذا بابُه إلى ما كتبه عن نفسه، لا تصرّفٌ
     في كتالوجٍ ولا في مال. والكتالوجُ لا يُمسّ من هنا البتّة — التصنيفُ
     وحدَه يُدخله، وبابُه عند الإدارة. */
  app.get('/api/trainer/course-proposals', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'دوراتي المقترحةُ وحالُ كلٍّ منها (ح-٢)' },
  }, async (req) => proposals.mine(req.auth!.userId))

  app.post('/api/trainer/course-proposals', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'إضافةُ دورةٍ أقدر عليها وليست في الكتالوج' },
  }, async (req, reply) => {
    const body = z.object({
      titleAr: z.string().trim().min(MIN_PROPOSAL_TITLE).max(MAX_PROPOSAL_TITLE),
      summaryAr: z.string().trim().max(MAX_PROPOSAL_SUMMARY).nullish(),
    }).parse(req.body)
    return reply.status(201).send(await proposals.add(req.auth!.userId, body))
  })

  app.patch('/api/trainer/course-proposals/:id', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'تعديلُ اقتراحي ما لم يُبتّ فيه' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      titleAr: z.string().trim().min(MIN_PROPOSAL_TITLE).max(MAX_PROPOSAL_TITLE),
      summaryAr: z.string().trim().max(MAX_PROPOSAL_SUMMARY).nullish(),
    }).parse(req.body)
    return proposals.edit(req.auth!.userId, id, body)
  })

  /* جوابُ سؤالِ الإدارة — بابٌ مستقلٌّ عن التعديل بقصد.

     لو كان الجوابُ حقلا في `PATCH` لَجاز أن يُحفظ التعديلُ بلا جواب، فيعود
     الاقتراحُ إلى الطابور وسؤالُه معلّقٌ كما هو. وبابٌ وحدَه يجعل «أجاب»
     فعلا يقع أو لا يقع. */
  app.post('/api/trainer/course-proposals/:id/answer', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'جوابُ سؤالِ الإدارة عن اقتراحي — يعيده إلى الطابور' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = z.object({
      answerAr: z.string().trim().min(2).max(MAX_PROPOSAL_QUESTION),
    }).parse(req.body)
    return proposals.answer(req.auth!.userId, id, body.answerAr)
  })

  app.delete('/api/trainer/course-proposals/:id', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'حذفُ اقتراحي ما لم يُبتّ فيه' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return proposals.remove(req.auth!.userId, id)
  })

  /* ═══ مساراتي — أبنيها من دوراتي وتُعرض على الرفّ العامّ (ن-١) ═══

     والصلاحيّةُ `trainer.portal`: البناءُ والإرسالُ فعلُه هو. **والنشرُ ليس
     منها** — بابُه عند الإدارة بـ`trainer.publish`، فلا يُدرج أحدٌ نفسَه
     على رفٍّ عامٍّ باسمه. */
  app.get('/api/trainer/paths', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'مساراتي وحالُ كلٍّ منها وما ينقصه (ن-١)' },
  }, async (req) => paths.mine(req.auth!.userId))

  app.get('/api/trainer/paths/courses', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'دوراتي التي أبني منها مسارا — بعناوينها' },
  }, async (req) => paths.myCourses(req.auth!.userId))

  app.get('/api/trainer/paths/terms', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'المواسمُ التي يصلح إعلانُ مسارٍ فيها — ما لم ينتهِ (ن-٣)' },
  }, async () => paths.upcomingTerms())

  app.post('/api/trainer/paths', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'مسارٌ جديدٌ مسوّدةً' },
  }, async (req, reply) => {
    return reply.status(201).send(await paths.create(req.auth!.userId, pathBody.parse(req.body)))
  })

  app.patch('/api/trainer/paths/:id', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'تعديلُ مساري ما دام بيدي' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return paths.update(req.auth!.userId, id, pathBody.parse(req.body))
  })

  app.delete('/api/trainer/paths/:id', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'حذفُ مساري ما دام بيدي' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return paths.remove(req.auth!.userId, id)
  })

  app.post('/api/trainer/paths/:id/submit', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'إرسالُ المسار للمراجعة — ويُردّ بما ينقص لا بـ«غير صالح»' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return paths.submit(req.auth!.userId, id)
  })

  app.get('/api/trainer/catalog-scope', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'أهليتي لنطاق الكتالوج — تُقرأ قبل كتابة اقتراح (هـ-١)' },
  }, async (req) => changes.myCatalogScope(req.auth!.userId))

  /* ═══ إتاحتي: ساعاتٌ أسبوعيّةٌ وغياب (المهمّة ٧١) ═══
     الصلاحيّةُ `trainer.portal` نفسُها: هذا إعلانُ المدرّبِ عن وقتِه، لا
     تصرّفٌ في شعبةٍ ولا في مال. والحكمُ على ما يُعلنه في `cohort.service.ts`:
     الغيابُ يردّ الإسناد، والساعاتُ تُعَدُّ للمُسنِد ولا تمنعه. */
  app.get('/api/trainer/me/availability', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'ساعاتي المعلنة وفترات غيابي' },
  }, async (req) => availability.mine(req.auth!.userId))

  app.put('/api/trainer/me/availability', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'إعلانُ ساعات الأسبوع — استبدالٌ كامل لا إضافة' },
  }, async (req) => {
    const body = z.object({
      windows: z.array(z.object({
        weekday: z.number().int().min(0).max(6),
        startMinute: z.number().int().min(0).max(1440),
        endMinute: z.number().int().min(0).max(1440),
      })).max(21),
    }).parse(req.body)
    return availability.replaceWindows(req.auth!.userId, body.windows)
  })

  app.post('/api/trainer/me/blackouts', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'تسجيلُ فترة غياب — تردُّ إسنادَ أيّ جلسةٍ تقع فيها' },
  }, async (req, reply) => {
    const body = z.object({
      startsAt: z.coerce.date(), endsAt: z.coerce.date(),
      reason: z.string().trim().max(120).optional(),
    }).parse(req.body)
    const created = await availability.addBlackout(req.auth!.userId, body)
    return reply.status(201).send(created)
  })

  app.delete('/api/trainer/me/blackouts/:id', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'حذفُ فترة غياب سجّلها المدرّب' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return availability.removeBlackout(req.auth!.userId, id)
  })

  /* ═══ فصولي — الطرفُ الغائبُ من الجدول (البند ٥٣) ═══

     `TrainerTermAvailability` لها ثلاثُ حالاتٍ منذ أُنشئت، والمسلكُ الوحيدُ
     الذي يكتبها محروسٌ بـ`trainer.assign`: **الإدارةُ تُعلن نيابةً عن
     المدرّب**، وهو لا يملك أن يؤكّد ولا أن يعتذر. فبقيت القائمةُ ما ورّثه
     الترحيلُ من مواسمَ أعلنها في طلبه قبل شهور.

     والصلاحيّةُ هنا `trainer.portal` كإعلان ساعاته وغيابه: هذا قولُ المدرّب
     عن وقتِه، لا تصرّفٌ في شعبةٍ ولا في مال. **والملفُّ يُشتقّ من الجلسة لا
     من الطلب** — فلا يُعلن أحدٌ نيابةً عن غيره من هنا. */
  app.get('/api/trainer/me/terms', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'فصولي — موقفي من كلّ فصلٍ حيّ وما خُطِّط لي فيه' },
  }, async (req) => {
    const profile = await changes.profileForUser(req.auth!.userId)
    return terms.trainerTerms(profile.id)
  })

  app.post('/api/trainer/me/terms/:termId', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'أتاحُ في هذا الفصل — أو أعتذر عنه' },
  }, async (req) => {
    const { termId } = z.object({ termId: z.string().uuid() }).parse(req.params)
    const body = z.object({
      /* و`declared` ليست خيارا هنا: هي ما يكتبه الترحيلُ والإدارة. وما يقوله
         المدرّبُ بنفسه تأكيدٌ أو اعتذار — لا حالةٌ ثالثةٌ ملتبسة. */
      status: z.enum(['confirmed', 'declined']),
      maxCohorts: z.number().int().min(1).max(20).nullable().optional(),
      note: z.string().trim().max(500).nullable().optional(),
    }).parse(req.body)
    const profile = await changes.profileForUser(req.auth!.userId)
    return terms.setTrainerAvailability(profile.id, termId, req.auth!.userId, body)
  })

  /* عام: صفحة المدربين بالموقع واسم مدرب الدورة */
  app.get('/api/trainers/public', {
    schema: { tags: ['trainer-portal'], summary: 'المدربون الظاهرون للعامة — موثقون وبموافقة نشر فقط' },
  }, async () => review.listPublicTrainers())

  app.get('/api/courses/:courseId/trainer', {
    schema: { tags: ['trainer-portal'], summary: 'مدرب الدورة المعلن — أو عبارة «يُعلن عند اعتماد الشعبة»' },
  }, async (req) => {
    const { courseId } = z.object({ courseId: z.string() }).parse(req.params)
    return review.publicCourseTrainer(courseId)
  })
}
