/* «ما ينتظرك» — عملُ الموظّف مجموعا في مكانٍ واحد.

   المشكلةُ التي يحلّها (جولة ٢٠٢٦-٠٩): عشرونَ شاشةً في لوحة الإدارة، وما
   ينتظر قرارا موزَّعٌ عليها كلِّها — اقتراحُ تأجيلٍ داخلَ بطاقةِ شعبةٍ لا
   يُرى إلّا بفتحها، وطلبُ شهادةٍ في شاشةٍ أخرى، وشعبةٌ جلستُها غدا بلا
   مدرّبٍ لا يُنبّه عليها شيء. فالموظّفُ يحتاج أن يعرف **أيَّ شاشةٍ يفتح**
   قبل أن يعمل — وهذه معرفةٌ لا يجب أن تكون شرطا للعمل.

   والقاعدةُ هنا: لا يُعرض بندٌ لا يملك صاحبُ الجلسة صلاحيّتَه. فالمالية لا
   ترى طابورَ المحتوى، والدعمُ لا يرى اقتراحاتِ التأجيل — وإلّا صار اللوحُ
   قائمةَ إحباطٍ لا قائمةَ عمل.

   ولا حالةَ جديدةً تُخزَّن: كلُّ بندٍ محسوبٌ من الحقيقة القائمة في القاعدة.
   فلا طابورَ يبلى، ولا عدّادَ يفترق عمّا في الشاشة. */

import type { PrismaClient } from '@prisma/client'
import type { TrainerStatus } from './trainer-application.service'
import { PENDING_PLAN_WHERE } from './cohort-plan.service'
import { SLOW_REVIEW_DAYS, waitingAr, waitingDays } from '../../src/application/trainer/plan-timeline'
import { CatalogAdminService } from './catalog-admin.service'
import { TrainerDraftingBundleService } from './trainer-drafting-bundle.service'
import { TrainerSuggestionService } from './trainer-suggestion.service'

/* ═══ الحالاتُ التي تنتظرك أنت في طلبات الانضمام (٢٦ سبتمبر ٢٠٢٦) ═══

   ─────────── عطبان أُصلحا معا ───────────

   ① **اسمان لا وجودَ لهما.** كان المرشِّحُ يقرأ `'in_review'` و
     `'demo_scheduled'` — وليستا من حالات طلب المدرّب في شيء: الصحيحُ
     `under_review` و`demo_requested`. و`in_review` حالةٌ صحيحةٌ **لنماذجَ
     أخرى** (طلبُ المتعلّم، وطلبُ تعديل المحتوى، ومسوّدةُ التأليف)، وتُقرأ
     في هذا الملفّ نفسِه على بُعد عشرين سطرا — فالأرجحُ أنّها نُسخت من هناك.

     وأثرُه أنّ **«قيد المراجعة» — أكثرَ حالات الطابور ورودا — لم تكن تُعَدّ
     أصلا**. بطاقةٌ تقول «ثلاثة» والطابورُ فيه أربعون.

   ② **وما تعدّه البطاقةُ صار ما يعنيه عنوانُها.** «في مرحلةٍ تنتظرك»:
     فخرجت `demo_requested` — تنتظر المتقدّمَ أن يقدّم ديمو، لا تنتظرك —
     ودخلت `conditionally_approved`: هي عندك فعلا (أتعابُه ودوراتُه وعقدُه).
     قرارُ صاحب المنصّة، ٢٦ سبتمبر ٢٠٢٦.

   ─────────── ولمَ مُنَمَّطة ───────────

   `TrainerStatus` يجعل اسما مخترَعا يسقط في `tsc`. ومصفوفةُ نصوصٍ حرّةٍ لا
   يحرسها شيء: تُكتب مرّةً وتُقرأ سنةً وهي تنقص، ولا أحدَ يرى نقصَها — فبطاقةٌ
   تعدّ أقلَّ ممّا في الطابور لا تصرخ، بل تُطمئن كذبا. */
/* ورُفعت `shortlisted` منها في ٢٦ سبتمبر ٢٠٢٦ بحذف الحالة نفسِها — والتنميطُ
   المذكورُ فوقَه هو الذي يجعل ذلك خطأً يُمسَك في `tsc` لا نقصا يُطمئن كذبا. */
const TRAINER_INBOX_STATUSES: TrainerStatus[] = [
  'submitted', 'under_review', 'academic_review', 'conditionally_approved',
]

/** بندٌ واحدٌ في اللوح: ما هو، كم، وأين يُعمَل */
export interface InboxItem {
  key: string
  titleAr: string
  /** لماذا يستحقّ انتباها الآن */
  whyAr: string
  count: number
  href: string
  severity: 'urgent' | 'attention' | 'info'
  /** أمثلةٌ قليلةٌ تُغني عن فتح الشاشة للتحقّق */
  sample: string[]
}

const NEXT_WEEK_MS = 7 * 86_400_000

export class StaffInboxService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** بنودُ هذا الموظّف — بحسب صلاحيّاته لا بحسب دوره المعلَن */
  async forStaff(userId: string, permissions: readonly string[], now = new Date()): Promise<InboxItem[]> {
    const can = (key: string) => permissions.includes(key)
    const items: InboxItem[] = []
    const push = (item: InboxItem) => { if (item.count > 0) items.push(item) }

    /* ── مهامٌّ أُسندت إليك بالاسم ── */
    const myTasks = await this.prisma.staffTask.findMany({
      where: { assigneeId: userId, status: 'open' },
      orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }],
      take: 5,
      select: { title: true, dueAt: true, priority: true },
    })
    const myTaskCount = await this.prisma.staffTask.count({ where: { assigneeId: userId, status: 'open' } })
    push({
      key: 'my_tasks',
      titleAr: 'مهامّ أسندت إليك',
      whyAr: 'أسندها إليك زميل باسمك',
      count: myTaskCount,
      href: '/admin/tasks',
      severity: myTasks.some((t) => t.dueAt && t.dueAt < now) ? 'urgent' : 'attention',
      sample: myTasks.map((t) => `${t.title}${t.dueAt && t.dueAt < now ? ' (تأخّرت)' : ''}`),
    })

    /* ── طلباتُ الانضمام مستشارا (٢٧ أكتوبر ٢٠٢٦، المرحلة السابعة) ──
       المتقدّمُ ينتظر قبولا أو اعتذارا، والقبولُ خطوةٌ واحدة بنسبته — فالبندُ لمن يملك النسبة. */
    if (can('advisor.manage')) {
      const waiting = await this.prisma.advisorApplication.findMany({
        where: { status: 'submitted' }, orderBy: { createdAt: 'asc' }, take: 5, select: { fullName: true },
      })
      push({
        key: 'advisor_applications',
        titleAr: 'طلبات انضمام مستشارين',
        whyAr: 'من تقدم ليكون مستشارا ينتظر قبوله أو الاعتذار له',
        count: await this.prisma.advisorApplication.count({ where: { status: 'submitted' } }),
        href: '/admin/advisor-applications',
        severity: 'attention',
        sample: waiting.map((w) => w.fullName),
      })
    }

    /* «اقتراحاتُ تأجيلٍ تنتظر قرارك» ذهبت مع طابورها (٢٧ أكتوبر ٢٠٢٦، المرحلة السادسة — ج):
       لا يُقترح تأجيلُ لقاءٍ منذ ١٧ سبتمبر ٢٠٢٦ — المدرّبُ ينقله بنفسه. */
    if (can('cohort.manage')) {
      /* ── طلباتُ نقل شعبةٍ إلى فصلٍ آخر — لا يتغيّر موعدٌ حتّى تُعتمد ── */
      const moves = await this.prisma.cohortMoveRequest.findMany({
        where: { status: 'pending' }, orderBy: { createdAt: 'asc' }, take: 5,
        select: { cohort: { select: { title: true } } },
      })
      push({
        key: 'cohort_moves',
        titleAr: 'طلبات نقل شعب تنتظر قرارك',
        whyAr: 'المدرّب طلب نقل شعبته إلى فصل آخر — لا يتغيّر شيء حتّى تعتمده',
        count: await this.prisma.cohortMoveRequest.count({ where: { status: 'pending' } }),
        href: '/admin/cohorts',
        severity: 'urgent',
        sample: moves.map((m) => m.cohort.title),
      })

      /* ── شعبٌ جلستُها قريبةٌ وناقصةٌ ──
         مدرّبٌ غائبٌ أو رابطٌ غائبٌ يومَ الجلسة عطبٌ يراه المتعلّم لا نحن. */
      const soon = await this.prisma.cohortSession.findMany({
        where: {
          startsAt: { gte: now, lte: new Date(now.getTime() + NEXT_WEEK_MS) },
          cohort: { status: { in: ['open', 'full', 'active'] } },
        },
        orderBy: { startsAt: 'asc' },
        select: {
          title: true, startsAt: true,
          zoom: { select: { id: true } },
          cohort: { select: { id: true, title: true, trainers: { select: { profileId: true } } } },
        },
      })
      const blocked = soon.filter((s) => s.zoom === null || s.cohort.trainers.length === 0)
      push({
        key: 'sessions_at_risk',
        titleAr: 'جلسات هذا الأسبوع بلا مدرّب أو بلا رابط',
        whyAr: 'المتعلّم يفتح الجلسة في وقتها فلا يجد شيئا',
        count: blocked.length,
        href: '/admin/cohorts',
        severity: 'urgent',
        sample: blocked.slice(0, 5).map((s) => {
          const missing = [s.cohort.trainers.length === 0 ? 'بلا مدرّب' : null, s.zoom === null ? 'بلا رابط' : null]
            .filter(Boolean).join(' و')
          return `${s.cohort.title} — ${s.title} (${missing})`
        }),
      })

      /* ── شعبٌ مفتوحةٌ بلا سعر ── */
      const unpriced = await this.prisma.cohort.count({
        where: { status: { in: ['open', 'full', 'active'] }, price: null },
      })
      push({
        key: 'cohorts_unpriced',
        titleAr: 'شعب مفتوحة بلا سعر',
        whyAr: 'تعرض للتسجيل ولا يمكن إصدار فاتورتها',
        count: unpriced,
        href: '/admin/cohorts',
        severity: 'attention',
        sample: [],
      })

      /* ═══ وسقط «شعبٌ أُسنِد مدرّبُها ولم يُسمَّ فصلُها» (٢٧ سبتمبر ٢٠٢٦) ═══

         كان بندا عاجلا: مدرّبٌ محبوسٌ لا يستطيع جدولةَ لقاءٍ حتّى تُسمّي
         الإدارةُ الفصل. وصار المدرّبُ يحدّد مدّةَ شعبته بنفسه فتُفتح جدولتُه
         داخلها، والفصلُ يُشتقّ من تاريخ البدء حين تُعتمَد خطّتُه — فلا حبسَ
         يُرى، وبندٌ عاجلٌ عن حبسٍ لا يقع يُعلّم قارئَه أن يتجاهل العاجل. */
    }

    /* ── طلباتُ التسجيل ── */
    if (can('enrollment.request.review')) {
      const pending = await this.prisma.enrollmentRequest.count({ where: { status: 'pending' } })
      push({
        key: 'enrollment_requests',
        titleAr: 'طلبات تسجيل تنتظر مراجعة',
        whyAr: 'مقعد محجوز لا يثبّت حتّى تراجع',
        count: pending,
        /* لسانُها الأوّلُ «طلبات التسجيل» — وكان يفتح «حالات بلا مستشار» بصلاحيّة `advisor.assign` (٢٤ أكتوبر ٢٠٢٦) */
        href: '/admin/finance',
        severity: 'attention',
        sample: [],
      })
    }

    /* ── طلباتُ المتعلّمين: شهادةٌ وتوصية ── */
    if (can('certificate.issue')) {
      const rows = await this.prisma.learnerRequest.findMany({
        where: { status: { in: ['pending', 'in_review'] } },
        orderBy: { createdAt: 'asc' },
        take: 5,
        select: { kind: true, user: { select: { displayName: true } } },
      })
      const KIND_AR: Record<string, string> = {
        course_certificate: 'شهادة دورة',
        pathway_certificate: 'شهادة مسار',
        recommendation: 'توصية',
      }
      push({
        key: 'learner_requests',
        titleAr: 'طلبات متعلّمين: شهادة أو توصية',
        whyAr: 'المتعلّم أنهى ويطلب ما يثبته',
        count: await this.prisma.learnerRequest.count({ where: { status: { in: ['pending', 'in_review'] } } }),
        href: '/admin/learner-requests',
        severity: 'attention',
        sample: rows.map((r) => `${KIND_AR[r.kind] ?? r.kind} — ${r.user.displayName}`),
      })
    }

    /* ── طلباتُ انضمام المدرّبين ── */
    if (can('trainer.applications.review')) {
      const waiting = await this.prisma.trainerApplication.count({
        where: { status: { in: TRAINER_INBOX_STATUSES } },
      })
      push({
        key: 'trainer_applications',
        titleAr: 'طلبات انضمام في مرحلة تنتظرك',
        whyAr: 'كلّ يوم انتظار يخسّرنا مدرّبا جيّدا',
        count: waiting,
        href: '/admin/trainers',
        severity: 'info',
        sample: [],
      })
    }

    /* ── عقودٌ وقّعها أصحابُها وتنتظر ختمَنا (٢٤ أكتوبر ٢٠٢٦) ──
       كانت شارةً على «العقود» وحدَها ولا بندَ لها هنا. فلمّا صار عددُ «اليوم» في سكّة الإدارة يجمع
       ما ينتظرك كلَّه (`waitingCounts` في `nav-map.ts`)، قال اللوحُ عددا وقالت السكّةُ غيرَه بعدد العقود.
       وبالختم يُفعَّل المدرّب. والعدُّ عدُّ الشارة نفسِه (`countAwaitingCountersign`: الحالةُ `signed`)
       لا نسخةٌ منه، وبصلاحيّتها نفسِها. */
    if (can('trainer.contract.manage')) {
      const signed = await this.prisma.trainerContract.findMany({
        where: { status: 'signed' },
        orderBy: { signedAt: 'asc' },
        take: 5,
        select: { number: true, profile: { select: { application: { select: { fullName: true } } } } },
      })
      push({
        key: 'contracts_to_countersign',
        titleAr: 'عقود موقّعة تنتظر ختمك',
        whyAr: 'بختمك يفعّل المدرّب ويبدأ إعداد دوراته',
        count: await this.prisma.trainerContract.count({ where: { status: 'signed' } }),
        href: '/admin/trainer-contracts',
        severity: 'attention',
        sample: signed.map((c) => `${c.profile.application.fullName} — ${c.number}`),
      })
    }

    /* ── خططُ شعبٍ أرسلها مدرّبوها وأكّدوها (٣ أكتوبر ٢٠٢٦) ──
       كانت تُعتمَد من بطاقة كلّ شعبةٍ وحدَها، ولا بندَ هنا يقول إنّ أحدا
       ينتظر: لا يُفتح تسجيلُ الشعبة قبل اعتمادها، ومدرّبُ الإعداد لا يُفعَّل
       ولا يُوقَّع عقدُه حتّى تُعتمَد خططُ دوراته. فبابُها شاشتُها الواحدة.

       وعدُّه عدُّ الطابور نفسِه (`PENDING_PLAN_WHERE`) لا نسخةٌ منه: علّم #426
       الطابورَ وشارتَه ألّا يعدّا خطّةَ مدرّبٍ حُذف أو شعبةٍ أُلغيت، وبقي هذا البندُ
       يعدّ كلَّ `submitted` — فيقول اللوحُ «١» لخطّةٍ حُذف صاحبُها، و«افتح»
       يُفضي إلى طابورٍ فارغ. */
    if (can('cohort.plan.approve')) {
      const plans = await this.prisma.cohortDeliveryPlan.findMany({
        where: PENDING_PLAN_WHERE,
        orderBy: { submittedAt: 'asc' },
        take: 5,
        select: { submittedAt: true, cohort: { select: { title: true } }, trainer: { select: { application: { select: { fullName: true } } } } },
      })
      /* ═══ وكم تنتظر — والبطيئةُ تعلو (٢٦ أكتوبر ٢٠٢٦، المرحلة الخامسة) ═══
         «الجولةُ ووقتُ الانتظار في الأعلى، فتظهر المراجعةُ البطيئةُ في «اليوم»» (خطّة لوحة الإدارة، ٣د). فكلُّ سطرٍ
         بانتظاره، والبندُ عاجلٌ حين ينتظر أقدمُها ثلاثةَ أيّامٍ فأكثر (`SLOW_REVIEW_DAYS`) — وسببُه يقول كم. */
      const oldest = plans[0]?.submittedAt ?? null
      const slow = oldest !== null && waitingDays(oldest, now) >= SLOW_REVIEW_DAYS
      push({
        key: 'cohort_plans',
        titleAr: 'خطط شعب تنتظر اعتمادك',
        whyAr: slow
          ? `أقدمها ${waitingAr(oldest!, now)} — ولا يفتح تسجيل الشعبة قبلها`
          : 'لا يفتح تسجيل الشعبة قبلها — ومدرّب الإعداد لا يفعّل حتّى تعتمد خططه',
        count: await this.prisma.cohortDeliveryPlan.count({ where: PENDING_PLAN_WHERE }),
        href: '/admin/pending-plans',
        severity: slow ? 'urgent' : 'attention',
        sample: plans.map((p) => [
          `${p.cohort.title} — ${p.trainer?.application.fullName ?? '—'}`,
          ...(p.submittedAt ? [waitingAr(p.submittedAt, now)] : []),
        ].join(' · ')),
      })
    }

    /* ── طلباتُ المستشارين ── */
    if (can('advisor.request.review')) {
      const pending = await this.prisma.advisorRequest.count({ where: { status: 'pending' } })
      push({
        key: 'advisor_requests',
        titleAr: 'طلبات مستشارين: خصم أو تعديل خطّة',
        whyAr: 'المستشار وعد المتعلّم بجواب منك',
        count: pending,
        href: '/admin/advisor-requests',
        severity: 'attention',
        sample: [],
      })
    }

    /* ── تعليقاتُ التقييم ── */
    if (can('rating.moderate')) {
      const pending = await this.prisma.rating.count({ where: { publishStatus: 'pending', commentAr: { not: null } } })
      push({
        key: 'ratings',
        titleAr: 'تعليقات تقييم تنتظر مراجعة',
        whyAr: 'لا ينشر تعليق قبل قراءته',
        count: pending,
        href: '/admin/ratings',
        severity: 'info',
        sample: [],
      })
    }

    /* ── تذاكرُ الدعم ── */
    if (can('support.operate')) {
      const open = await this.prisma.supportTicket.count({ where: { status: { in: ['open', 'reopened'] } } })
      const rows = await this.prisma.supportTicket.findMany({
        where: { status: { in: ['open', 'reopened'] } },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        take: 5,
        select: { subject: true, priority: true },
      })
      push({
        key: 'support',
        titleAr: 'تذاكر دعم مفتوحة',
        whyAr: 'سؤال بلا جواب يصير شكوى',
        count: open,
        href: '/admin/support',
        severity: rows.some((t) => t.priority === 'urgent') ? 'urgent' : 'attention',
        sample: rows.map((t) => t.subject),
      })
    }

    /* ── إشعاراتٌ فشل إرسالها ──
       «سنُعلمك» وعدٌ مكتوبٌ في المنصّة، وفشلُه صامتٌ اليوم. */
    if (can('notifications.manage')) {
      const failed = await this.prisma.notification.count({ where: { status: 'failed' } })
      push({
        key: 'failed_notifications',
        titleAr: 'إشعارات فشل إرسالها',
        whyAr: 'المنصّة وعدت بإعلام لم يصل',
        count: failed,
        href: '/admin/notifications',
        severity: 'attention',
        sample: [],
      })
    }

    /* ── محتوًى في المراجعة ──
       يصل طابورَه في «الكتالوج» مفتوحا (`?requests=1`) — كان يفتح «النشر» ولا طابورَ فيه. ويراه من يملك القرارَ
       وحدَه: حبّةُ مسار القرار نفسُها (`catalog.pathway.review`)، وكان يراه من يُردّ عن الزرّ ٤٠٣. */
    if (can('catalog.pathway.review')) {
      const inReview = await this.prisma.contentChangeRequest.count({ where: { status: 'in_review' } })
      push({
        key: 'content_review',
        titleAr: 'تغييرات محتوى تنتظر مراجعة',
        whyAr: 'كاتب ينتظر مراجعا — والنشر محكوم',
        count: inReview,
        href: '/admin/catalog?requests=1',
        severity: 'info',
        sample: [],
      })
    }

    /* ── اسمُ دورةٍ تقترحه شعبُها (٢٠ أكتوبر ٢٠٢٦) ──
       «هل سيكون هذا العملُ تلقائيّا لكلّ دورةٍ جديدةٍ يُفتح لها شعبة؟ افعله».
       فشعبةٌ تُفتح باسمٍ يختلف عن اسم دورتها تأتي هنا بنفسها، وما اعتُمد أو قيل
       فيه «أبقِ الاسم» لا يعود. الحسابُ في `CatalogAdminService.courseNames`. */
    if (can('catalog.course.edit')) {
      const named = await new CatalogAdminService(this.prisma).coursesWithNewNameSuggestions()
      push({
        key: 'course_names',
        titleAr: 'اقتراحات أسماء لدورات',
        whyAr: 'شعب فتحت بأسماء تختلف عن اسم دورتها — اختر اسما أو أبق الحالي',
        count: named.length,
        href: '/admin/catalog?names=1',
        severity: 'info',
        sample: named.slice(0, 3).map((r) => `${r.titleAr} ← ${r.suggestions.find((sg) => sg.isNew)?.titleAr ?? ''}`),
      })
    }

    /* ── واقتراحاتُنا على بطاقات المدرّبين — خطوتان تنتظرانه (٢٠ أكتوبر ٢٠٢٦) ──
       قرارُ صاحب المنصّة: «أبقِ ظاهرا للإدارة أنّ جددا ينتظرونه». فالكتابةُ ليست آليّة (اختار أن يرسل
       ملفّاتِهم إلى Claude)، ولا شيءَ كان يقول إنّ مدرّبا جديدا اعتُمدت دورتُه ولم يُكتب له، أو إنّ ما كُتب لم
       يُرسَل. وكلاهما محسوبٌ بشرط شاشته نفسِه: حزمةُ الملفّات (`TrainerDraftingBundleService`) وزرُّ الإرسال
       (`TrainerSuggestionService.unsentDrafts`) — فالعدّادُ عدُّ الزرّ. */
    if (can('trainer.applications.view')) {
      const names = await new TrainerDraftingBundleService(this.prisma).waitingNames()
      push({
        key: 'trainer_suggestions_to_write',
        titleAr: 'مدربون جدد بلا اقتراحات',
        whyAr: 'مؤهلون لدورة ولم نكتب لهم «لماذا نفتخر» ولا نبذة — نزّل ملفاتهم من «تشغيل المدربين» لنكتب لهم',
        count: names.length,
        href: '/admin/trainer-run',
        severity: 'info',
        sample: names.slice(0, 3),
      })
    }
    if (can('trainer.publish')) {
      const unsent = await new TrainerSuggestionService(this.prisma).unsentDrafts()
      push({
        key: 'trainer_suggestions_unsent',
        titleAr: 'اقتراحات جاهزة لم ترسل للمدربين',
        whyAr: 'كتبناها وتنتظر ضغطة «أرسل» في «تشغيل المدربين»',
        count: unsent.count,
        href: '/admin/trainer-run',
        severity: 'attention',
        sample: unsent.names.slice(0, 3),
      })
    }

    /* الأعجلُ أوّلا، ثمّ الأكثرُ عددا — فترتيبُ القائمة هو ترتيبُ العمل */
    const weight = { urgent: 0, attention: 1, info: 2 }
    return items.sort((a, b) => weight[a.severity] - weight[b.severity] || b.count - a.count)
  }
}
