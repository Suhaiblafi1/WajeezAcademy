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
      titleAr: 'مهامٌّ أُسندت إليك',
      whyAr: 'أسندها إليك زميلٌ باسمك',
      count: myTaskCount,
      href: '/admin/tasks',
      severity: myTasks.some((t) => t.dueAt && t.dueAt < now) ? 'urgent' : 'attention',
      sample: myTasks.map((t) => `${t.title}${t.dueAt && t.dueAt < now ? ' (تأخّرت)' : ''}`),
    })

    /* ── اقتراحاتُ تأجيلٍ من المدرّبين ──
       الاقتراحُ لا يحرّك موعدا حتّى يُعتمَد، والمتعلّمُ ينتظر جوابا. */
    if (can('cohort.manage')) {
      const proposals = await this.prisma.sessionRescheduleRequest.findMany({
        where: { status: 'pending' },
        orderBy: { createdAt: 'asc' },
        take: 5,
        select: { proposedStartsAt: true, session: { select: { title: true, cohort: { select: { title: true } } } } },
      })
      push({
        key: 'reschedules',
        titleAr: 'اقتراحاتُ تأجيلٍ تنتظر قرارك',
        whyAr: 'الموعدُ لا يتغيّر عند المتعلّمين حتّى تعتمده',
        count: await this.prisma.sessionRescheduleRequest.count({ where: { status: 'pending' } }),
        href: '/admin/cohorts',
        severity: 'urgent',
        sample: proposals.map((r) => `${r.session.cohort.title} — ${r.session.title}`),
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
        titleAr: 'جلساتٌ هذا الأسبوع بلا مدرّبٍ أو بلا رابط',
        whyAr: 'المتعلّمُ يفتح الجلسةَ في وقتها فلا يجد شيئا',
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
        titleAr: 'شعبٌ مفتوحةٌ بلا سعر',
        whyAr: 'تُعرض للتسجيل ولا يمكن إصدارُ فاتورتها',
        count: unpriced,
        href: '/admin/cohorts',
        severity: 'attention',
        sample: [],
      })
    }

    /* ── طلباتُ التسجيل ── */
    if (can('enrollment.request.review')) {
      const pending = await this.prisma.enrollmentRequest.count({ where: { status: 'pending' } })
      push({
        key: 'enrollment_requests',
        titleAr: 'طلباتُ تسجيلٍ تنتظر مراجعة',
        whyAr: 'مقعدٌ محجوزٌ لا يُثبَّت حتّى تُراجَع',
        count: pending,
        href: '/admin/exceptions',
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
        course_certificate: 'شهادةُ دورة',
        pathway_certificate: 'شهادةُ مسار',
        recommendation: 'توصية',
      }
      push({
        key: 'learner_requests',
        titleAr: 'طلباتُ متعلّمين: شهادةٌ أو توصية',
        whyAr: 'المتعلّمُ أنهى ويطلب ما يُثبته',
        count: await this.prisma.learnerRequest.count({ where: { status: { in: ['pending', 'in_review'] } } }),
        href: '/admin/learner-requests',
        severity: 'attention',
        sample: rows.map((r) => `${KIND_AR[r.kind] ?? r.kind} — ${r.user.displayName}`),
      })
    }

    /* ── طلباتُ انضمام المدرّبين ── */
    if (can('trainer.applications.review')) {
      const waiting = await this.prisma.trainerApplication.count({
        where: { status: { in: ['submitted', 'in_review', 'shortlisted', 'demo_scheduled', 'academic_review'] } },
      })
      push({
        key: 'trainer_applications',
        titleAr: 'طلباتُ انضمامٍ في مرحلةٍ تنتظرك',
        whyAr: 'كلُّ يومٍ انتظارٍ يخسّرنا مدرّبا جيّدا',
        count: waiting,
        href: '/admin/trainers',
        severity: 'info',
        sample: [],
      })
    }

    /* ── طلباتُ المستشارين ── */
    if (can('advisor.request.review')) {
      const pending = await this.prisma.advisorRequest.count({ where: { status: 'pending' } })
      push({
        key: 'advisor_requests',
        titleAr: 'طلباتُ مستشارين: خصمٌ أو تعديلُ خطّة',
        whyAr: 'المستشارُ وعد المتعلّمَ بجوابٍ منك',
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
        titleAr: 'تعليقاتُ تقييمٍ تنتظر مراجعة',
        whyAr: 'لا يُنشر تعليقٌ قبل قراءته',
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
        titleAr: 'تذاكرُ دعمٍ مفتوحة',
        whyAr: 'سؤالٌ بلا جوابٍ يصير شكوى',
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
        titleAr: 'إشعاراتٌ فشل إرسالها',
        whyAr: 'المنصّةُ وعدت بإعلامٍ لم يصل',
        count: failed,
        href: '/admin/notifications',
        severity: 'attention',
        sample: [],
      })
    }

    /* ── محتوًى في المراجعة ── */
    if (can('catalog.course.review') || can('catalog.content.final_approve')) {
      const inReview = await this.prisma.contentChangeRequest.count({ where: { status: 'in_review' } })
      push({
        key: 'content_review',
        titleAr: 'تغييراتُ محتوًى تنتظر مراجعة',
        whyAr: 'كاتبٌ ينتظر مراجعا — والنشرُ محكوم',
        count: inReview,
        href: '/admin/publishing',
        severity: 'info',
        sample: [],
      })
    }

    /* الأعجلُ أوّلا، ثمّ الأكثرُ عددا — فترتيبُ القائمة هو ترتيبُ العمل */
    const weight = { urgent: 0, attention: 1, info: 2 }
    return items.sort((a, b) => weight[a.severity] - weight[b.severity] || b.count - a.count)
  }
}
