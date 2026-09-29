/* مسارات بوابة المدرب — ملفي، تأهيلي وإسناداتي، دوراتي المقترحة، مساراتي،
   عقدي، حسابي البنكي، وإرسالُ اقتراحِ تعديلٍ على دورةٍ مؤهَّلٍ لها وقائمتُه
   وسحبُه. كلها تتطلب صلاحيات دور trainer الفعلية.

   وكان هذا الرأسُ يَعِد بـ«مخطط دورة» لا مسلكَ له — حُذف يومَ حُذفت مسالكُه
   ولم يُحذف من الرأس. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { CHANGE_TYPES, TrainerChangeService } from '../../services/trainer-change.service'
import {
  CourseProposalService, MAX_PROPOSAL_QUESTION, MAX_PROPOSAL_SUMMARY,
  MAX_PROPOSAL_TITLE, MIN_PROPOSAL_TITLE,
} from '../../services/course-proposal.service'
import { TrainerPathService } from '../../services/trainer-path.service'
import { MAX_PATH_BLURB, MAX_PATH_COURSES, MAX_PATH_TITLE } from '../../../src/application/trainer/path-rules'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { TrainerOfferService } from '../../services/trainer-offer.service'
import { TrainerBankService, MAX_ACCOUNT_LEN, BANK_ACCOUNT_KINDS } from '../../services/trainer-bank.service'
import { EarningsService } from '../../services/earnings.service'
import { requirePermission } from '../auth-plugin'
import { AuthError } from '../../services/auth.service'

/* حدودُ اقتراح التعديل — والأدنى في السبب هو حدُّ الخدمة نفسِها (١٠) فلا
   يفترق ما يردّه المسلكُ عمّا تردّه هي، ولا يُقال للمدرّب حدّان. */
const MIN_CHANGE_REASON = 10
const MAX_CHANGE_REASON = 4000
const MAX_CHANGE_NOTE = 2000
const MAX_CHANGE_ITEMS = 40

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

  /* ═══ عقدي — نسختي الموقَّعة، أقرؤها وأطبعها ═══

     والصلاحيّةُ `trainer.portal` كسائر بوّابته، **والملفُّ يُستخرَج من جلسته
     لا من جسم الطلب** — فلا يقرأ أحدٌ عقدَ غيره من هنا. ولا معرّفَ في المسار
     أصلا: «عقدي» لا «عقدُ كذا»، فلا يُجرَّب رقمٌ بعد رقم.

     وموضعُه بعد «مستحقاتي» بقصد — قال صاحبُ المنصّة: «الملف يكون في منصته
     ضمن قسم المستحقات والعقد»، فهما بابان متجاوران لا بابٌ يُبحث عنه. */
  app.get('/api/trainer/me/contract', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'نسختي الموقَّعة من العقد وسجلُّ تنفيذها — للمدرب نفسه' },
  }, async (req) => review.myContract(req.auth!.userId))

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
      iban: z.string().trim().min(6).max(MAX_ACCOUNT_LEN + 8),
      holderName: z.string().trim().min(4).max(160),
      bankNameAr: z.string().trim().min(2).max(120),
      branchAr: z.string().trim().max(120).nullish(),
      swiftBic: z.string().trim().max(16).nullish(),
      accountKind: z.enum(BANK_ACCOUNT_KINDS).optional(),
      countryCode: z.string().trim().max(2).nullish(),
      routingCode: z.string().trim().max(34).nullish(),
      ownNameConfirmed: z.boolean().optional(),
    }).parse(req.body)
    return bank.setMine(req.auth!.userId, body)
  })

  /* وإلغاؤه بيده — قرارُ صاحب المنصّة (٢٩ سبتمبر ٢٠٢٦): «اسمح له بإلغائه
     أو تبديله». يُزاح ولا يُمحى، والعلّةُ في `removeMine`. */
  app.delete('/api/trainer/bank-account', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'إلغاءُ حسابي البنكيّ — يُزاح ولا يُمحى، ويصله خبرُه' },
  }, async (req) => bank.removeMine(req.auth!.userId))

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
           فيُنتقى ما يصلح أن يُقرأ: ما اسمُه، وأين صار، ومتى.

           ── وأعمدةُ الشرط الأربعة تلحق ──

           وقد صار له مستهلِك: شريطُ العرض المشروط (`ConditionStrip`) يقرأ
           منها طورَ المدرّب وما بقي من مهلته — وبدونها تسير على إنسانٍ
           مهلةٌ لا يراها. وهي تواريخُ عن عقدِه هو، يقرؤها في بوّابته هو.

           و`conditionRemindedAt` ليس منها: دفترُ العامل كي لا يُذكّر
           مرّتين، ولا شأنَ للمدرّب بمتى طُرِق بابُه. */
        contracts: {
          orderBy: { createdAt: 'desc' }, take: 1,
          select: {
            id: true, title: true, status: true, kind: true, revision: true,
            sentAt: true, signedAt: true, countersignedAt: true,
            terminatedAt: true, createdAt: true,
            conditionDeadlineAt: true, conditionPausedAt: true,
            conditionExtendedAt: true, conditionMetAt: true,
            conditionExtensionsUsed: true,
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
      include: {
        course: {
          include: {
            versions: { orderBy: { version: 'desc' }, take: 1 },
            /* ومحاورُها من القاعدة الحيّة لا من اللقطة المنشورة: دورةٌ أُدخلت
               لهذا المدرّب قبل قليلٍ ليست في اللقطة بعد، **وهي بعينها ما يعمل
               عليه** في طور الموادّ. فلقطةٌ هنا تعرض له صفرَ محاورَ لدورةٍ
               له فيها محاور. */
            modules: {
              where: { status: { not: 'archived' } },
              include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
            },
          },
        },
      },
    })
    /* وحكمُ البوّابة لكلّ دورةٍ يُقرأ هنا لا في الشاشة: الشاشةُ تعرضه ولا
       تحكمه، فلا يفترق ما تقوله عمّا يردّه الإرسال. ومجمَّعٌ لا لكلّ سطر. */
    const scopes = await changes.catalogScopeForCourses(profile.id, quals.map((q) => q.courseId))
    return quals.map((q) => ({
      courseId: q.courseId, title: q.course.versions[0]?.titleAr ?? '',
      currentVersion: q.course.currentVersion, qualifiedAt: q.createdAt,
      scope: scopes.get(q.courseId) ?? null,
      modules: q.course.modules
        .map((m) => ({
          id: m.id,
          titleAr: m.versions[0]?.titleAr ?? m.id,
          sequence: m.versions[0]?.sequence ?? 0,
        }))
        .sort((a, b) => a.sequence - b.sequence),
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

  /* ═══ وعاد بابُ اقتراحِ التعديل — بشاشته (٢٧ سبتمبر ٢٠٢٦) ═══

     حُذف في ٨ سبتمبر لأنّه كان بلا شاشة، وكان الحذفُ صحيحا يومَه. ثمّ وعد
     العقدُ الذي يوقّعه المدرّب، في طوره المشروط، بحرفه: «خمسةُ أيّامٍ لوضع
     محاور دوراتك ومصادرها» — فصار الوعدُ منشورا والبابُ مغلقا. وقِيس: لا
     `submit` ولا `listMine` ولا `withdraw` ينادِيها مسلكٌ واحد، وجانبُ
     الإدارة موصولٌ كاملا يراجع اقتراحاتٍ لا سبيلَ لأحدٍ أن يرسلها.

     ولم يُعَد البابُ وحدَه: كانت شاشتُه `MyCourseEdits.tsx` في الدفعة نفسها.

     ═══ ثمّ ذهبت الشاشةُ وبقي البابُ (٢٩ سبتمبر ٢٠٢٦) ═══

     قال صاحبُ المنصّة عن «تعديلاتي على دوراتي»: «لا داعيَ لهذا القسم
     كلّيّا». فحُذفت الشاشةُ وبندُها وتحوّل مسارُها إلى «مؤهّلاتي». وبقيت
     هذه المسالكُ ومعها `catalog-scope`: جانبُ الإدارة يراجع ما وصل منها،
     وحارسُها في `server/tests/trainer/own-course-authoring.test.ts`. فإن
     تقرّر ألّا يعود البابُ حُذفت بحارسها معا.

     والصلاحيّةُ `trainer.portal` كما لسائر بوّابته، والملفُّ يُستخرَج من
     حسابه لا من جسم الطلب. والنطاقُ يُحكَم في الخدمة عن **الدورة** لا عن
     المدرّب (هـ-١): من أُهِّل لدورةٍ لا يستخدمها مسارٌ ولا قالبٌ ولا شعبةٌ
     فتعديلُه لا يصل أحدا. */
  const changeItemBody = z.object({
    changeType: z.enum(CHANGE_TYPES),
    targetKey: z.string().trim().min(1).max(200).optional(),
    beforeValue: z.unknown().optional(),
    afterValue: z.unknown().optional(),
    note: z.string().trim().max(MAX_CHANGE_NOTE).optional(),
  })

  app.get('/api/trainer/changes', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'اقتراحاتي على دوراتي وقرارُ الإدارة في كلٍّ منها' },
  }, async (req) => changes.listMine(req.auth!.userId))

  app.post('/api/trainer/changes', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'إرسالُ اقتراحِ تعديلٍ على دورةٍ مؤهَّلٍ لها' },
  }, async (req, reply) => {
    const body = z.object({
      courseId: z.string().trim().min(2).max(64),
      scope: z.enum(['cohort', 'catalog']),
      cohortId: z.string().uuid().optional(),
      reason: z.string().trim().min(MIN_CHANGE_REASON).max(MAX_CHANGE_REASON),
      evidence: z.string().trim().max(MAX_CHANGE_REASON).optional(),
      items: z.array(changeItemBody).min(1).max(MAX_CHANGE_ITEMS),
    }).parse(req.body)
    return reply.status(201).send(await changes.submit(req.auth!.userId, body))
  })

  app.post('/api/trainer/changes/:id/withdraw', {
    preHandler: requirePermission('trainer.portal'),
    schema: { tags: ['trainer-portal'], summary: 'سحبُ اقتراحي ما لم يُبتّ فيه' },
  }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    return changes.withdraw(req.auth!.userId, id)
  })

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
      /* أسئلةُ الفورم — تُنظَّف في الخدمة بمصدرها الواحد، فلا يُكرَّر شكلُها هنا */
      details: z.record(z.string(), z.unknown()).nullish(),
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
      /* أسئلةُ الفورم — تُنظَّف في الخدمة بمصدرها الواحد، فلا يُكرَّر شكلُها هنا */
      details: z.record(z.string(), z.unknown()).nullish(),
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

  /* ═══ وذهبت «إتاحتي» و«فصولي» (٢٧ سبتمبر ٢٠٢٦) ═══

     كانت هنا ستّةُ مساراتٍ يُعلن بها المدرّبُ ساعاتِه الأسبوعيّةَ وغيابَه
     وموقفَه من كلّ فصل. وقرارُ صاحب المنصّة: «احذف ساعاتي وفصولي وفترات
     غيابي.. لأنه هو من يتحكم بكل شي» — لقاءاتُه بيده داخلَ مدّة شعبته،
     فلا وقتَ يُعلنه لغيره كي لا يُجدوَل فيه. والعلّةُ كاملةً في رأس
     `src/pages/trainer/Qualifications.tsx`. */

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
