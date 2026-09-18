/* صيغةُ يومٍ في رسائل الرفض — الرسالةُ تقول الحدَّ لا «ممنوع» مجرَّدةً */
const fmtDay = (d: Date) => d.toISOString().slice(0, 10)

/* خدمة الشعب — إنشاء، جدولة، فتح مشروط، منع تعارض المدرب، سعة.
   شروط الفتح الخمسة: دورة منشورة + جدول + سعة + خطة تقديم + إعداد مالي.
   (والمدرّب ليس منها — يُسنَد دفعةً واحدةً لاحقا؛ التعليل عند `openChecklist`.)
   الحالات: draft | open | full | active | completed | cancelled. */

import { notifyPlanWaiters } from './catalog-readiness.service'
import type { PrismaClient, Prisma } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { EarningsService } from './earnings.service'
import { newStorageKey, signKey, SIGNED_URL_TTL_MS, assertFileUploadsEnabled, MAX_COHORT_MEDIA_BYTES } from './storage.service'
import { assertMeetingSdkEnabled, meetingSdkKey, signMeetingSdkJwt, type ZoomSdkRole } from './zoom/meeting-sdk'
import { safeNotify, notifyRole } from './notification.service'
import { fmtDateWith } from '../../src/application/text/format-ar'
import { createZoomMeeting, deleteZoomMeeting, getZoomConfig, registerZoomParticipant, zoomMissing, zoomReady } from './zoom.service'
import { LEDGER_CURRENCY } from '../../src/application/commerce/presentment'
import { DAY_CODES } from '../../src/application/schedule/days'
import { windowOpen, capReached, remainingSessions } from '../../src/application/trainer/schedule-window'

/** ترتيبُ اليوم في الأسبوع — الأحدُ صفر، كما في `Date.getUTCDay` */
const DAY_INDEX: Record<string, number> = Object.fromEntries(DAY_CODES.map((d, i) => [d, i]))

const COHORT_TRANSITIONS: Record<string, string[]> = {
  draft: ['open', 'cancelled'],
  open: ['full', 'active', 'cancelled'],
  full: ['active', 'open', 'cancelled'], // open للتراجع إن أُلغي تسجيل
  active: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

export class CohortService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  async list(status?: string) {
    const rows = await this.prisma.cohort.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        course: { include: { versions: { orderBy: { version: 'desc' }, take: 1 } } },
        trainers: { include: { profile: { include: { application: { select: { fullName: true } } } } } },
        sessions: true,
        _count: { select: { enrollments: { where: { status: 'enrolled' } } } },
      },
    })
    return rows.map((c) => ({
      id: c.id, title: c.title, status: c.status, courseId: c.courseId,
      courseTitle: c.course.versions[0]?.titleAr ?? '', startsAt: c.startsAt, endsAt: c.endsAt,
      daysOfWeek: c.daysOfWeek, startTime: c.startTime, timezone: c.timezone,
      capacity: c.capacity, enrolled: c._count.enrollments,
      price: c.price, currency: c.currency, language: c.language, deliveryMode: c.deliveryMode,
      registrationOpen: c.registrationOpen, financialReady: c.financialReady,
      sessionsCount: c.sessions.length,
      /* نافذةُ جدولةِ المدرّب — تُقرأ في الشاشة لتُعرَض مفتوحةً أو مغلقة */
      scheduleWindowStart: c.scheduleWindowStart, scheduleWindowEnd: c.scheduleWindowEnd,
      maxSessions: c.maxSessions,
      trainers: c.trainers.map((t) => ({ profileId: t.profileId, name: t.profile.application.fullName, role: t.role })),
    }))
  }

  async create(actorId: string, input: {
    courseId: string; pathwayId?: string; title: string; termId?: string | null
    startsAt?: Date; endsAt?: Date; daysOfWeek?: string[]; startTime?: string; timezone?: string
    capacity?: number; price?: number; currency?: string; language?: string
    deliveryMode?: 'remote' | 'in_person' | 'hybrid'
  }) {
    const course = await this.prisma.course.findUnique({ where: { id: input.courseId } })
    if (!course) throw new AuthError('unknown_course', 'الدورة غير موجودة', 404)
    /* الشعبة ترث سعر قائمة الدورة حين لا يُملى عليها سعر.

       صفحةُ المسار تعلن «تبدأ من …» من سعر القائمة، والفاتورة تُصدَر بسعر
       الشعبة. فلو فُتحت شعبةٌ بسعرٍ آخر بلا قصد لافترق المُعلَن عن المُطالَب
       به — وهو الوعد المكسور الذي أُزيل من هذه المنصّة مرّة. والإملاء يبقى
       متاحا: من يكتب سعرا صراحةً يكتبه، والوراثة للصمت لا للتجاوز. */
    const price = input.price ?? (course.listPrice !== null ? Number(course.listPrice) : undefined)
    const currency = input.currency ?? course.listCurrency ?? LEDGER_CURRENCY
    const cohort = await this.prisma.cohort.create({
      data: {
        courseId: input.courseId, pathwayId: input.pathwayId, title: input.title,
        /* والفصلُ يُكتب عند الإنشاء متى عُرف — وشعبةٌ بلا فصلٍ «لم تُفتَح بعد» */
        termId: input.termId ?? null,
        startsAt: input.startsAt, endsAt: input.endsAt,
        daysOfWeek: input.daysOfWeek ?? [], startTime: input.startTime, timezone: input.timezone,
        capacity: input.capacity, price, currency,
        language: input.language ?? 'العربية', deliveryMode: input.deliveryMode ?? 'remote',
        financialReady: price !== undefined && price !== null,
      },
    })
    await recordAudit(this.prisma, { actorId, action: 'cohort.create', entityType: 'cohort', entityId: cohort.id, meta: { title: input.title } })
    return cohort
  }

  async update(actorId: string, cohortId: string, patch: Partial<{
    title: string; startsAt: Date; endsAt: Date; daysOfWeek: string[]; startTime: string; timezone: string
    capacity: number; price: number; currency: string; language: string; deliveryMode: string
    registrationOpen: boolean; financialReady: boolean
  }>) {
    const cohort = await this.prisma.cohort.findUnique({ where: { id: cohortId } })
    if (!cohort) throw new AuthError('not_found', 'الشعبة غير موجودة', 404)
    if (['completed', 'cancelled'].includes(cohort.status)) throw new AuthError('bad_state', 'شعبة منتهية أو ملغاة لا تُعدل', 409)
    const updated = await this.prisma.cohort.update({ where: { id: cohortId }, data: patch })
    await recordAudit(this.prisma, { actorId, action: 'cohort.update', entityType: 'cohort', entityId: cohortId, meta: patch as object })

    /* صارت قابلةً للتسجيل الآن؟ فمن كان ينتظرها في خطّته يُعلَم.

       الوعد «نُعلمك عند فتحها» مكتوبٌ في بوابة المتعلّم منذ زمن، ولم يكن له
       منفّذ — فمن انتظر لم يكن يعلم إلّا إن عاد وفحص بنفسه. */
    const becameOpen = patch.registrationOpen === true && !cohort.registrationOpen
    if (becameOpen) {
      await notifyPlanWaiters(this.prisma, [cohort.courseId])
    }
    return updated
  }

  /** تعيين مدرب على الشعبة — يتطلب ملفا نشطا وتأهيلا للدورة، ويمنع تعارض الجدول */
  /* و`announce` رايةٌ صريحة: `assignToCohort` في مراجعة المدرّبين ينادي هذه
     الطريقةَ ثمّ يُبلّغ بنفسه في حالةِ الدورةِ بلا شعبة. فمن يعرف الحدثَ
     يملك رسالتَه، ولا تخرج رسالتان عن إسنادٍ واحد. */
  async assignTrainer(
    cohortId: string, profileId: string, actorId: string,
    role: 'lead' | 'assistant' = 'lead', announce = true,
  ) {
    const cohort = await this.prisma.cohort.findUnique({
      where: { id: cohortId }, include: { sessions: true },
    })
    if (!cohort) throw new AuthError('not_found', 'الشعبة غير موجودة', 404)
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { id: profileId }, include: { application: true },
    })
    if (!profile || profile.suspendedAt || profile.application.status !== 'active') {
      throw new AuthError('not_active', 'المدرب ليس في حالة active', 409)
    }
    const qual = await this.prisma.trainerCourseQualification.findUnique({
      where: { profileId_courseId: { profileId, courseId: cohort.courseId } },
    })
    if (!qual || qual.status !== 'qualified') {
      throw new AuthError('not_qualified', 'المدرب غير مؤهل لدورة هذه الشعبة', 409)
    }
    await this.assertNoScheduleConflict(profileId, cohort.sessions.map((s) => ({ startsAt: s.startsAt, endsAt: s.endsAt })), cohortId)

    const link = await this.prisma.cohortTrainer.upsert({
      where: { cohortId_profileId: { cohortId, profileId } },
      update: { role },
      create: { cohortId, profileId, role, assignedBy: actorId },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'cohort.trainer.assign', entityType: 'cohort', entityId: cohortId, meta: { profileId, role },
    })
    /* ═══ ويعلم من أُسنِدت إليه (ي-٤) ═══

       كان الإسنادُ يُخبَر به من بابٍ ولا يُخبَر به من باب: مسارُ المراجعة
       يرسل `trainer.assigned`، وطريقُ الإدارة المباشر (`POST /api/admin/
       cohorts/:id/trainers`) ينادي هذه الطريقةَ رأسا فلا يرسل شيئا. فمن
       أُسنِدت إليه شعبةٌ من ذلك الباب يكتشفها في بوّابته مصادفةً — وعليه أن
       يحضر جلساتِها.

       واسمُ الشعبة وحدَه في النصّ: عنوانُها عربيٌّ يكتبه إنسان، ورمزُ
       الدورة لاتينيٌّ لا يُعرض لمدرّبٍ (وحارسُه قائم). */
    if (announce && profile.userId) {
      await safeNotify(this.prisma, {
        userId: profile.userId, channel: 'in_app', audience: 'trainer',
        templateKey: 'trainer.assigned',
        title: 'أُسنِدت إليك شعبة',
        body: `أُسنِدت إليك شعبةُ «${cohort.title}»`
          + (cohort.startsAt
            ? ` — تبدأ ${fmtDateWith(cohort.startsAt, { day: 'numeric', month: 'long', year: 'numeric' })}.`
            : '.')
          + ' تجد جلساتِها ومتعلّميها في بوّابتك.',
        data: { cohortId, role },
      })
    }
    return link
  }

  /* فحصُ التعارض قبل الطلب لا بعد الموافقة.

     الحارسُ نفسُه الذي يمنع الإسناد، مكشوفا ليُنادى مبكّرا: من يطلب تأهيل
     مدرّبٍ لشعبةٍ يستحقّ أن يُردّ الآن إن كان جدولُه مشغولا، لا بعد يومين من
     انتظار قرارٍ لا يقبل التنفيذ. */
  async assertTrainerFreeFor(profileId: string, cohortId: string) {
    const cohort = await this.prisma.cohort.findUnique({
      where: { id: cohortId }, include: { sessions: true },
    })
    if (!cohort) throw new AuthError('not_found', 'الشعبة غير موجودة', 404)
    await this.assertNoScheduleConflict(
      profileId,
      cohort.sessions.map((s) => ({ startsAt: s.startsAt, endsAt: s.endsAt })),
      cohortId,
    )
  }

  /* مدرّبو هذه الشعبة المحتمَلون — وحالُ تأهيل كلٍّ منهم لدورتها.

     كانت الشاشة تعرض «المدرّبين المعلَنين» بلا أن تقول أيُّهم مؤهَّل، فيُجرَّب
     الإسنادُ ويُردّ بـ409. والفرقُ بين «أسنده» و«أهّله وأسنده» قرارٌ يُتّخذ
     قبل النقر لا بعده. */
  /* جلساتُ الشعبةِ لاختيارها بالعنوان والتاريخ — لا بلصق معرّفٍ من ٣٦ حرفا.

     كان ربطُ Zoom يطلب «معرف الجلسة (UUID)»، والمعرّفُ لا يظهر على أيّ شاشة
     أصلا: فالموظّفُ إمّا يفتح القاعدة أو يستسلم (شُوهد في جولة ٢٠٢٦-٠٩). */
  async sessionsFor(cohortId: string) {
    const cohort = await this.prisma.cohort.findUnique({ where: { id: cohortId }, select: { id: true } })
    if (!cohort) throw new AuthError('not_found', 'الشعبة غير موجودة', 404)
    const sessions = await this.prisma.cohortSession.findMany({
      where: { cohortId },
      orderBy: { startsAt: 'asc' },
      select: {
        id: true, title: true, startsAt: true, endsAt: true, status: true,
        zoom: { select: { joinUrl: true } },
      },
    })
    return sessions.map((s) => ({
      id: s.id, title: s.title, startsAt: s.startsAt, endsAt: s.endsAt, status: s.status,
      hasZoom: s.zoom !== null,
    }))
  }

  /* مسجَّلو الشعبة — بديلُ حقلِ «معرف التسجيل للإسقاط (UUID)».

     الإسقاطُ كان يطلب معرّفَ تسجيلٍ من ستّةٍ وثلاثين حرفا لا يظهر على أيّ
     شاشة، فوق زرٍّ أحمرَ اسمُه «إسقاط». فخطأُ لصقٍ واحدٌ يُسقط الطالبَ
     الخطأ، **ولا اسمَ في الشاشة يُراجَع قبل الضغط**.

     والقائمةُ تُرجع المسجَّلين وقائمةَ الانتظار وحدَهم: المُسقَطُ سابقا لا
     يُسقَط مرّتين، والمكتملُ إسقاطُه محوُ إنجازٍ لا تصحيحُ قيد. */
  async roster(cohortId: string) {
    const cohort = await this.prisma.cohort.findUnique({ where: { id: cohortId }, select: { id: true } })
    if (!cohort) throw new AuthError('not_found', 'الشعبة غير موجودة', 404)
    const rows = await this.prisma.enrollment.findMany({
      where: { cohortId, status: { in: ['enrolled', 'waitlisted'] } },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true, status: true, createdAt: true,
        user: { select: { displayName: true, email: true } },
      },
    })
    return rows.map((r) => ({
      enrollmentId: r.id,
      learnerName: r.user.displayName,
      email: r.user.email,
      status: r.status,
      enrolledAt: r.createdAt,
    }))
  }

  /* بحثُ متعلّمٍ بالاسم أو البريد — بديلُ حقلِ «معرف المستخدم (UUID)».

     يُقصَر على المتعلّمين النشطين، ويقول من هو مسجَّلٌ في هذه الشعبة أصلا
     كي لا يُسجَّل مرّتين. وعشرةُ نتائجَ تكفي لاختيارِ اسم. */
  async searchLearners(cohortId: string | undefined, q: string) {
    const term = q.trim()
    if (term.length < 2) return []
    const users = await this.prisma.user.findMany({
      where: {
        status: 'active',
        roles: { some: { roleId: 'learner' } },
        OR: [
          { displayName: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
        ],
      },
      orderBy: { displayName: 'asc' },
      take: 10,
      select: { id: true, displayName: true, email: true },
    })
    if (!cohortId || users.length === 0) return users.map((u) => ({ ...u, enrolled: false }))
    const enrolled = await this.prisma.enrollment.findMany({
      where: { cohortId, userId: { in: users.map((u) => u.id) } },
      select: { userId: true },
    })
    const inCohort = new Set(enrolled.map((e) => e.userId))
    return users.map((u) => ({ ...u, enrolled: inCohort.has(u.id) }))
  }

  /* ═══ الغيابُ المعلن مانعٌ كالتعارض (المهمّة ٧١) ═══

     المدرّبُ أعلن أنّه غيرُ موجودٍ في مدّةٍ بعينها. وإسنادُ جلسةٍ فيها ليس
     خطأَ جدولٍ في المنصّة بل موعدٌ لن يحضره أحد — فيُردّ الآن لا يوم الجلسة.
     والرسالةُ تسمّي المدّةَ وسببَها إن كتبه، كي يعرف المُسنِدُ ما يفعل. */
  private async assertNotOnLeave(profileId: string, sessions: { startsAt: Date; endsAt: Date | null }[]) {
    const spanStart = new Date(Math.min(...sessions.map((s) => s.startsAt.getTime())))
    const lastEnd = Math.max(...sessions.map((s) => (s.endsAt ?? new Date(s.startsAt.getTime() + 3600_000)).getTime()))
    const blackouts = await this.prisma.trainerBlackout.findMany({
      where: { profileId, endsAt: { gte: spanStart }, startsAt: { lte: new Date(lastEnd) } },
    })
    if (blackouts.length === 0) return
    for (const s of sessions) {
      const sEnd = s.endsAt ?? new Date(s.startsAt.getTime() + 3600_000)
      const hit = blackouts.find((b) => s.startsAt < b.endsAt && b.startsAt < sEnd)
      if (hit) {
        const from = hit.startsAt.toISOString().slice(0, 10)
        const to = hit.endsAt.toISOString().slice(0, 10)
        const why = hit.reason ? ` (${hit.reason})` : ''
        throw new AuthError('trainer_on_leave',
          `المدرب أعلن غيابه من ${from} إلى ${to}${why} — وهذا الموعد يقع فيه`, 409)
      }
    }
  }

  /* والساعاتُ الأسبوعيّةُ إرشادٌ لا منع: من لم يُعلن شيئا لا يُمنَع من شيء،
     وإلّا صار الحقلُ الفارغُ قفلا. ومن أعلنها يُعَدُّ له ما يقع خارجَها
     فيَراه المُسنِدُ رقما ويقرّر. */
  async sessionsOutsideDeclaredHours(profileId: string, sessions: { startsAt: Date; endsAt: Date | null }[]): Promise<number | null> {
    const windows = await this.prisma.trainerAvailability.findMany({ where: { profileId } })
    if (windows.length === 0) return null
    let outside = 0
    for (const s of sessions) {
      const day = s.startsAt.getDay()
      const startMin = s.startsAt.getHours() * 60 + s.startsAt.getMinutes()
      const end = s.endsAt ?? new Date(s.startsAt.getTime() + 3600_000)
      const endMin = end.getHours() * 60 + end.getMinutes()
      const fits = windows.some((w) => w.weekday === day && w.startMinute <= startMin && endMin <= w.endMinute)
      if (!fits) outside += 1
    }
    return outside
  }

  async eligibleTrainersFor(cohortId: string) {
    const cohort = await this.prisma.cohort.findUnique({ where: { id: cohortId } })
    if (!cohort) throw new AuthError('not_found', 'الشعبة غير موجودة', 404)
    return this.eligibleTrainers(cohort.courseId, cohortId)
  }

  /* المؤهَّلون لدورةٍ — يُسأل عنهم قبل وجود الشعبة أيضا: معالجُ الإنشاء يعرض
     المدرّبَ في خطوته الرابعة، ولا شعبةَ بعد. والتأهيلُ للدورة لا للشعبة. */
  async eligibleTrainers(courseId: string, cohortId?: string) {
    const profiles = await this.prisma.trainerProfile.findMany({
      where: { suspendedAt: null, application: { status: 'active' } },
      include: {
        application: { select: { fullName: true } },
        qualifications: { where: { courseId } },
        cohortTrainers: cohortId ? { where: { cohortId }, select: { role: true } } : false,
      },
      orderBy: { createdAt: 'asc' },
    })
    /* إشاراتُ الإتاحة تُقرأ مع القائمة لا في شاشةٍ ثانية (المهمّة ٧١): من
       يُسنِد يحتاج أن يرى **قبل الضغط** أنّ المدرّبَ معتذرٌ في تلك المدّة أو
       أنّ الجلساتَ خارج ساعاته المعلنة. واستعلامان لكلّ القائمة لا استعلامان
       لكلّ مدرّب. */
    const ids = profiles.map((p) => p.id)
    const sessions = cohortId
      ? await this.prisma.cohortSession.findMany({
          where: { cohortId, status: { not: 'cancelled' } },
          select: { startsAt: true, endsAt: true },
        })
      : []
    let blackouts: { profileId: string; startsAt: Date; endsAt: Date; reason: string | null }[] = []
    let windows: { profileId: string; weekday: number; startMinute: number; endMinute: number }[] = []
    if (sessions.length > 0 && ids.length > 0) {
      const spanStart = new Date(Math.min(...sessions.map((s) => s.startsAt.getTime())))
      const spanEnd = new Date(Math.max(...sessions.map((s) => (s.endsAt ?? new Date(s.startsAt.getTime() + 3600_000)).getTime())))
      ;[blackouts, windows] = await Promise.all([
        this.prisma.trainerBlackout.findMany({
          where: { profileId: { in: ids }, endsAt: { gte: spanStart }, startsAt: { lte: spanEnd } },
          select: { profileId: true, startsAt: true, endsAt: true, reason: true },
        }),
        this.prisma.trainerAvailability.findMany({
          where: { profileId: { in: ids } },
          select: { profileId: true, weekday: true, startMinute: true, endMinute: true },
        }),
      ])
    }

    return profiles.map((p) => {
      const q = p.qualifications[0]
      const mine = blackouts.filter((b) => b.profileId === p.id)
      const onLeave = sessions.some((s) => {
        const sEnd = s.endsAt ?? new Date(s.startsAt.getTime() + 3600_000)
        return mine.some((b) => s.startsAt < b.endsAt && b.startsAt < sEnd)
      })
      const myWindows = windows.filter((w) => w.profileId === p.id)
      /* `null` تعني «لم يُعلن ساعاته» — وهي ليست صفرا: الصفرُ يقول «كلُّ
         الجلسات داخل ساعاته»، والغيابُ يقول «لا علم لنا». */
      const outsideDeclaredHours = myWindows.length === 0 || sessions.length === 0
        ? null
        : sessions.filter((s) => {
            const day = s.startsAt.getDay()
            const startMin = s.startsAt.getHours() * 60 + s.startsAt.getMinutes()
            const end = s.endsAt ?? new Date(s.startsAt.getTime() + 3600_000)
            const endMin = end.getHours() * 60 + end.getMinutes()
            return !myWindows.some((w) => w.weekday === day && w.startMinute <= startMin && endMin <= w.endMinute)
          }).length
      return {
        profileId: p.id,
        name: p.application.fullName,
        qualification: (q?.status ?? 'none') as 'qualified' | 'pending' | 'rejected' | 'retired' | 'none',
        qualificationId: q?.id ?? null,
        assignedRole: (cohortId ? p.cohortTrainers[0]?.role : null) ?? null,
        onLeave,
        outsideDeclaredHours,
      }
    })
  }

  /** تعارض جدول المدرب: جلستان متداخلتان في شعبتين غير ملغاتين/منتهيتين — ومعه الغياب المعلن */
  private async assertNoScheduleConflict(profileId: string, sessions: { startsAt: Date; endsAt: Date | null }[], ignoreCohortId?: string) {
    if (!sessions.length) return
    await this.assertNotOnLeave(profileId, sessions)
    const otherCohorts = await this.prisma.cohortTrainer.findMany({
      where: { profileId, cohortId: ignoreCohortId ? { not: ignoreCohortId } : undefined,
        cohort: { status: { in: ['draft', 'open', 'full', 'active'] } } },
      include: { cohort: { include: { sessions: true } } },
    })
    for (const s of sessions) {
      const sEnd = s.endsAt ?? new Date(s.startsAt.getTime() + 3600_000)
      for (const tc of otherCohorts) {
        for (const o of tc.cohort.sessions) {
          const oEnd = o.endsAt ?? new Date(o.startsAt.getTime() + 3600_000)
          if (o.status !== 'cancelled' && s.startsAt < oEnd && o.startsAt < sEnd) {
            throw new AuthError('trainer_conflict', `تعارض جدول: للمدرب جلسة في شعبة «${tc.cohort.title}» تتداخل مع هذا الموعد`, 409)
          }
        }
      }
    }
  }

  /* ═══ شروطُ الفتح — والمدرّبُ ليس منها ═══

     كان المدرّبُ المؤهَّلُ شرطا سادسا يمنع الفتح، وكان صوابا حين تُسنَد
     الأسماءُ واحدا واحدا. وقرارُ صاحب الأكاديميّة أن تُفتح الشعبُ كلُّها
     الآن على الفصل الأوّل، وأن يُسنَد المدرّبون **دفعةً واحدةً لاحقا** —
     فبقاءُ الشرط يعني كتالوجا كاملا محبوسا في المسوّدة بانتظار إسنادٍ
     لم يحن، ومتعلّما لا يستطيع الحجزَ لفصلٍ يبدأ بعد أسابيع.

     وما يُحفظ مقابلَ ذلك أن **لا يُوعَد بما لا يوجد**: الشعبةُ تُفتح بجدولها
     وسعرها ومقاعدها، والمدرّبُ يُقال عنه في وجه المتعلّم «سيتم تعيين المدرب
     قريبا» لا اسمٌ مختلَق ولا صمت. وحين تُسنَد الأسماء تظهر مكانَها.

     والشروطُ الخمسةُ الباقيةُ على حالها: دورةٌ منشورة، جدولُ جلسات، سعة،
     خطّةُ تقديم، وإعدادٌ ماليّ. فما يُباع له موعدٌ وسعرٌ ومقعد. */

  /** فحص شروط الفتح الخمسة — يعيد قائمة النواقص دون تغيير حالة */
  async openChecklist(cohortId: string) {
    const cohort = await this.prisma.cohort.findUnique({
      where: { id: cohortId },
      include: { course: true, sessions: true, plans: true },
    })
    if (!cohort) throw new AuthError('not_found', 'الشعبة غير موجودة', 404)
    const missing: string[] = []
    if (cohort.course.status !== 'published') missing.push('الدورة ليست منشورة')
    if (!cohort.sessions.length) missing.push('لا جدول جلسات')
    if (!cohort.capacity || cohort.capacity < 1) missing.push('لا سعة محددة')
    if (!cohort.plans.some((p) => ['approved', 'published'].includes(p.status)) && !cohort.plans.length) {
      missing.push('لا خطة تقديم للشعبة — اكتبها من بطاقة الشعبة')
    }
    if (!cohort.financialReady || cohort.price === null) missing.push('الإعداد المالي غير مكتمل (السعر والعملة)')
    return { ready: missing.length === 0, missing }
  }

  /* ─────────── خطّةُ التقديم — الشرطُ الذي لم يكن يُوفَّى ───────────

     من شروط الفتح الخمسة «خطّةُ تقديمٍ للشعبة». وصفوفُ `CohortDeliveryPlan`
     كانت تُكتب **في موضعٍ واحدٍ في المستودَع كلِّه**: حين يُنشر اقتراحُ تعديلٍ
     من مدرّبٍ بنطاق شعبة. فلا مسارَ إداريّ ولا شاشة.

     والنتيجةُ أنّ كلَّ شعبةٍ تُنشأ يدويّا **عالقةٌ في المسوّدة إلى الأبد**:
     الشرطُ قائمٌ ولا سبيلَ إلى إيفائه إلّا بأن يقترح مدرّبٌ تعديلا ثمّ يُعتمَد
     ويُنشَر — وهو طريقٌ لا علاقةَ له بأن تقول «هكذا تُقدَّم هذه الشعبة».

     فهذه خطّةٌ أساسيّةٌ يكتبها من يدير الشعبة. وهي `approved` لا `draft`:
     كاتبُها هو صاحبُ قرار الفتح نفسِه، فحلقةُ اعتمادٍ ثانيةٌ عليه من نفسه
     مراسمُ لا حراسة.

     ولا تمسّ خطّةً جاءت من اقتراح مدرّب: تلك أثرُ قرارٍ في سجلّه، وهذه
     أساسٌ يُحرَّر. */

  /** خطّةُ التقديم الأساسية — تُكتب أو تُحدَّث، ولا تُكرَّر */
  async setDeliveryPlan(cohortId: string, actorId: string | null, input: { notesAr: string; deliveryMode?: string }) {
    const cohort = await this.prisma.cohort.findUnique({ where: { id: cohortId } })
    if (!cohort) throw new AuthError('not_found', 'الشعبة غير موجودة', 404)
    const notesAr = input.notesAr.trim()
    if (notesAr.length < 20) {
      throw new AuthError('plan_too_short', 'خطّةُ التقديم أقصرُ من أن تُقرأ — اكتب كيف تُقدَّم هذه الشعبة فعلا (٢٠ حرفا فأكثر)')
    }
    const content = {
      kind: 'baseline',
      notesAr,
      deliveryMode: input.deliveryMode ?? cohort.deliveryMode ?? null,
      authoredBy: 'admin',
    }
    const existing = await this.prisma.cohortDeliveryPlan.findFirst({
      where: { cohortId, sourceChangeRequestId: null },
      orderBy: { createdAt: 'desc' },
    })
    const plan = existing
      ? await this.prisma.cohortDeliveryPlan.update({
          where: { id: existing.id },
          data: { content: content as unknown as Prisma.InputJsonValue, status: 'approved' },
        })
      : await this.prisma.cohortDeliveryPlan.create({
          data: {
            cohortId, content: content as unknown as Prisma.InputJsonValue,
            status: 'approved', createdBy: actorId,
          },
        })
    await recordAudit(this.prisma, {
      actorId, action: 'cohort.delivery_plan.set', entityType: 'cohort', entityId: cohortId,
      meta: { planId: plan.id, updated: Boolean(existing) },
    })
    return plan
  }

  /** خططُ الشعبة — الأساسيّةُ وما جاء من اقتراحات المدرّبين */
  async deliveryPlans(cohortId: string) {
    return this.prisma.cohortDeliveryPlan.findMany({
      where: { cohortId }, orderBy: { createdAt: 'desc' },
    })
  }

  /** فتح الشعبة — يرفض بقائمة النواقص إن لم تكتمل الشروط */
  async open(cohortId: string, actorId: string | null) {
    const check = await this.openChecklist(cohortId)
    if (!check.ready) {
      throw new AuthError('open_blocked', `لا يمكن فتح الشعبة: ${check.missing.join(' — ')}`, 409)
    }
    await this.transition(cohortId, 'open', actorId, 'فتح الشعبة بعد اكتمال الشروط')
    return this.prisma.cohort.update({ where: { id: cohortId }, data: { registrationOpen: true } })
  }

  /* ═══ الحالةُ تتبع التواريخَ لا الضغطات ═══

     كانت الإدارةُ تُحرّك الشعبةَ بيدها: زرٌّ يفتح، وزرٌّ يبدأ، وزرٌّ ينهي.
     فمن نسي زرَّ «انتهت» بقيت شعبتُه «جارية» شهورا، ومستحقّاتُ مدرّبها لا
     تُولَّد (فهي تُولَّد عند الإكمال)، ولوحاتُ التقارير تعدّ ما انتهى جاريا.

     والحقيقةُ في الجلسات: شعبةٌ بدأت أوّلُ جلساتها «جارية»، وانتهت آخرُها
     «منتهية». فهذه الدالّةُ تُصلح ما تأخّر، وتُنادى من الشاشة الآن ومن
     العامل الخلفيّ يومَ يوجد (المهمّة ٥٤ في خطّة التنفيذ).

     وما لا تفعله بقصد: لا تفتح شعبةً — الفتحُ يمرّ بشروطه الخمسة وبقرار
     إنسان؛ ولا تلمس ملغاةً؛ ولا تُنهي شعبةً بلا جلسة. */
  async syncStatusesByDate(actorId: string | null, options: { apply?: boolean; now?: Date } = {}) {
    const now = options.now ?? new Date()
    const candidates = await this.prisma.cohort.findMany({
      where: { status: { in: ['open', 'full', 'active'] } },
      select: {
        id: true, title: true, status: true,
        sessions: { select: { startsAt: true, endsAt: true }, orderBy: { startsAt: 'asc' } },
      },
    })
    const changes: { cohortId: string; title: string; from: string; to: string; reason: string }[] = []
    for (const c of candidates) {
      if (c.sessions.length === 0) continue
      const first = c.sessions[0].startsAt
      const last = c.sessions.reduce<Date>((max, sn) => {
        const end = sn.endsAt ?? sn.startsAt
        return end > max ? end : max
      }, c.sessions[0].endsAt ?? c.sessions[0].startsAt)

      if (last < now) {
        changes.push({ cohortId: c.id, title: c.title, from: c.status, to: 'completed', reason: 'انتهت آخرُ جلساتها' })
      } else if (first <= now && c.status !== 'active') {
        changes.push({ cohortId: c.id, title: c.title, from: c.status, to: 'active', reason: 'بدأت أوّلُ جلساتها' })
      }
    }
    if (options.apply !== true) return { applied: false, changed: 0, changes }

    let changed = 0
    for (const ch of changes) {
      try {
        await this.transition(ch.cohortId, ch.to, actorId, `آليّا: ${ch.reason}`)
        changed += 1
      } catch {
        /* انتقالٌ غيرُ مسموحٍ لشعبةٍ بعينها لا يوقف الباقي — ويظهر في القائمة بلا تطبيق */
      }
    }
    await recordAudit(this.prisma, {
      actorId, action: 'cohort.status.sync', entityType: 'cohort', entityId: 'batch',
      meta: { considered: candidates.length, changed },
    })
    return { applied: true, changed, changes }
  }

  async transition(cohortId: string, to: string, actorId: string | null, note?: string) {
    const cohort = await this.prisma.cohort.findUnique({ where: { id: cohortId } })
    if (!cohort) throw new AuthError('not_found', 'الشعبة غير موجودة', 404)
    if (cohort.status === to) return
    if (!COHORT_TRANSITIONS[cohort.status]?.includes(to)) {
      throw new AuthError('bad_transition', `لا يمكن الانتقال من «${cohort.status}» إلى «${to}»`, 409)
    }
    await this.prisma.cohort.update({ where: { id: cohortId }, data: { status: to } })
    await recordAudit(this.prisma, { actorId, action: 'cohort.status', entityType: 'cohort', entityId: cohortId, meta: { from: cohort.status, to, note } })

    /* اكتمال الشعبة يولّد كشف مستحقات مدربها تلقائياً إن كانت له قاعدة أتعاب سارية.
       عدم وجود قاعدة أو تكرار التوليد لا يعيقان إكمال الشعبة — يُرصدان في سجل التدقيق فقط */
    if (to === 'completed') {
      try {
        await new EarningsService(this.prisma).generateForCohort(actorId, cohortId)
      } catch (e) {
        await recordAudit(this.prisma, {
          actorId, action: 'trainer_payout.generate_skipped', entityType: 'cohort', entityId: cohortId,
          meta: { reason: e instanceof AuthError ? e.message : 'خطأ غير متوقع' },
        })
      }
    }
  }

  /* ── الجلسات وZoom اليدوي ── */

  async addSession(actorId: string, cohortId: string, input: {
    title: string; startsAt: Date; endsAt?: Date; timezone?: string; moduleId?: string
    /* ما يجدوله المدرّبُ ينتظر قرارا، وما تجدوله الإدارةُ معتمَدٌ بحكم من
       جدوله — والافتراضُ هو الثاني، فالنداءاتُ الإداريّةُ لا تُبدّل. */
    noteAr?: string | null
    attachmentKey?: string | null; attachmentName?: string | null; attachmentMime?: string | null
    approvalState?: 'pending' | 'approved'
    /** نيّةُ الاجتماع تُحفظ حتّى الاعتماد — لا يُنشأ اجتماعٌ لموعدٍ قد يُردّ */
    wantsZoom?: boolean
  }) {
    const cohort = await this.prisma.cohort.findUnique({ where: { id: cohortId }, include: { trainers: true } })
    if (!cohort) throw new AuthError('not_found', 'الشعبة غير موجودة', 404)
    if (['completed', 'cancelled'].includes(cohort.status)) throw new AuthError('bad_state', 'لا جلسات لشعبة منتهية', 409)
    /* الجلسة الجديدة لا تتعارض مع جداول مدربي الشعبة في شعب أخرى */
    for (const t of cohort.trainers) {
      await this.assertNoScheduleConflict(t.profileId, [{ startsAt: input.startsAt, endsAt: input.endsAt ?? null }], cohortId)
    }
    const session = await this.prisma.cohortSession.create({
      data: {
        cohortId, title: input.title, startsAt: input.startsAt, endsAt: input.endsAt,
        timezone: input.timezone, moduleId: input.moduleId,
        noteAr: input.noteAr?.trim() || null,
        attachmentKey: input.attachmentKey ?? null,
        attachmentName: input.attachmentName ?? null,
        attachmentMime: input.attachmentMime ?? null,
        approvalState: input.approvalState ?? 'approved',
        /* والنيّةُ عمودٌ صريح: لقاءٌ «حضوريّ» يُطفئها فلا يُنشأ له اجتماعٌ
           عند الاعتماد، والافتراضُ أنّ اللقاءَ المباشرَ يريد اجتماعا. */
        wantsMeeting: input.wantsZoom ?? true,
      },
    })
    await recordAudit(this.prisma, { actorId, action: 'cohort.session.add', entityType: 'cohort', entityId: cohortId, meta: { sessionId: session.id } })
    return session
  }

  /* ═════════ نافذةُ جدولةِ المدرّب ═════════

     العطبُ الذي تزيله، بنصّه: في `src/pages/trainer/CohortBoard.tsx` كان
     يُقال للمدرّب «لا جلسات مجدولة — **الإدارة تضيف الجدول**». فمن يقف في
     اللقاء ويعرف متى يستطيع ومتى لا، يُمنع من جدولة لقاءاته ويُقال له
     انتظر. وما يملكه بدلا منها أن **يقترح** تأجيلا لجلسةٍ قائمة، فيصير
     الاقتراحُ صفًّا في طابورٍ على شاشة الإدارة يُقبل أو يُردّ.

     أي أنّ المنصّةَ بنت طابورَ موافقاتٍ لتعويض صلاحيّةٍ لم تُمنح، والإداريُّ
     يقضي يومَه في عملٍ كتابيّ لا قرارَ فيه.

     وقرارُ صاحب المنصّة (٨ سبتمبر ٢٠٢٦): **يملك المدرّبُ جدولَ شعبته ضمن
     حدودٍ تضعها الإدارة**، وتبقى الإدارةُ على الاستثناء لا على الروتين.

     ═══ وتصحيحٌ لقاعدةٍ كانت هنا (١٧ سبتمبر ٢٠٢٦) ═══

     كُتب هنا أنّ «الحدَّ ثلاثةٌ تُقرأ معا — مدًى يبدأ، ومدًى ينتهي، وسقفُ
     لقاءات، وغيابُ أيٍّ منها بابٌ مغلَق». وكان ذلك صحيحا يومَ كانت الإدارةُ
     وحدَها تفتح النافذة بالثلاثة. ثمّ صار الفصلُ يفتحها (`setTerm` يكتب
     المدى من حدوده ولا يكتب سقفا) — فبقيت القاعدةُ الثلاثيّةُ تغلق البابَ
     على من فتح فصلَه، وهو الحصارُ الذي شكا منه صاحبُ المنصّة.

     **فالبابُ حدّان، والسقفُ حدٌّ اختياريٌّ فوقه.** والقاعدةُ في موضعٍ واحدٍ
     يقرؤه الخادمُ وشاشةُ المدرّب معا: `src/application/trainer/schedule-window.ts`،
     وفي رأسه العلّةُ كاملةً. */

  /** الإدارةُ تفتح النافذة أو تغلقها — والإغلاق بإفراغ الثلاثة */
  async setScheduleWindow(actorId: string, cohortId: string, input: {
    start?: Date | null; end?: Date | null; maxSessions?: number | null
  }) {
    const cohort = await this.prisma.cohort.findUnique({ where: { id: cohortId }, select: { id: true } })
    if (!cohort) throw new AuthError('not_found', 'الشعبة غير موجودة', 404)
    if (input.start && input.end && input.start >= input.end) {
      throw new AuthError('bad_request', 'نهايةُ النافذة قبل بدايتها', 400)
    }
    if (input.maxSessions != null && input.maxSessions < 1) {
      throw new AuthError('bad_request', 'سقفُ اللقاءات واحدٌ فأكثر', 400)
    }
    const updated = await this.prisma.cohort.update({
      where: { id: cohortId },
      data: {
        scheduleWindowStart: input.start ?? null,
        scheduleWindowEnd: input.end ?? null,
        maxSessions: input.maxSessions ?? null,
      },
      select: { scheduleWindowStart: true, scheduleWindowEnd: true, maxSessions: true },
    })
    /* والسجلُّ يقول ما وقع فعلا: نافذةٌ بمدًى بلا سقفٍ **مفتوحة**، وكان
       يُكتب لها «أُغلقت» فيفترق الأثرُ عمّا يستطيعه المدرّب. */
    const opened = windowOpen(updated)
    await recordAudit(this.prisma, {
      actorId,
      action: opened ? 'cohort.schedule_window.open' : 'cohort.schedule_window.close',
      entityType: 'cohort',
      entityId: cohortId,
      meta: { ...updated },
    })
    return updated
  }

  /* ═══════════ فصلُ الشعبة — حقيقةٌ إداريّةٌ تُسمَّى عند الإسناد ═══════════

     ── انعكاسُ ملكيّةٍ، لا نقلُ دالّة ──

     في ١٥ سبتمبر ٢٠٢٦ قال صاحبُ المنصّة: «يجب أن يكون هنا تحديدُ الفصل
     أوّلا، ويتمّ تقييدُ المدرّب بتحديد الأوقات ضمنَ أشهر الفصل نفسِه».
     فقُرئت «تحديد» اختيارا، وبُنيت للمدرّب شبكةُ فصولٍ ينقر فيها. وفي ١٧
     سبتمبر صحّح: المقصودُ أنّ الإدارةَ **قد اعتمدت** الدورةَ في فصلٍ فيتقيّد
     به. والنصفُ الثاني من جملته كان مبنيّا للمجهول — «ويتمّ تقييدُ المدرّب»
     — وهو وصفُ قيدٍ يُفرَض لا اختيارٍ يُمارَس. الإشارةُ كانت هناك ولم تُقرأ.

     ── ولمَ صار هنا ──

     الفصلُ يحكم نافذةَ التسجيل والتقويمَ المنشورَ وموسمَ الإيراد، ويكتب
     `startsAt` الذي يقرؤه الكتالوجُ العامُّ وصفحةُ التسجيل. فهو القرارُ
     الإداريُّ المحضُ الوحيدُ في تلك الشاشة — وكان الوحيدَ المفوَّض، ويُكتب
     بنقرةٍ بلا بوّابة، بينما كلُّ ما عداه يمرّ باعتماد.

     ── وصياغةُ صاحب المنصّة للفعل ──

     «عندما نقوم بإسناد دورةٍ لمدرّب نحدّد لأيّ فصلٍ ستكون، وبهذا نكون فتحنا
     شعبةً له ليقوم هو بتغيير تفاصيلها». فالإسنادُ والفصلُ فعلٌ واحدٌ يفتح
     الشعبة — لا خطوتان تُنسى إحداهما. و«شعبةٌ بلا فصل» ليست معطوبةً بل
     **لم تُفتَح بعد**، وهي حالةٌ نظيفةٌ لم يكن لها اسم. */

  /** الإدارةُ تسمّي فصلَ الشعبة — ومنه تُشتقّ حدودُها ونافذةُ جدولتها */
  async setTerm(actorId: string, cohortId: string, termId: string) {
    const cohort = await this.prisma.cohort.findUnique({
      where: { id: cohortId }, select: { id: true, status: true },
    })
    if (!cohort) throw new AuthError('not_found', 'الشعبة غير موجودة', 404)
    if (['completed', 'cancelled'].includes(cohort.status)) {
      throw new AuthError('bad_state', 'شعبةٌ منتهيةٌ أو ملغاةٌ لا يُبدَّل فصلُها', 409)
    }
    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      select: { id: true, titleAr: true, startsOn: true, endsOn: true, status: true },
    })
    if (!term) throw new AuthError('not_found', 'الفصل غير موجود', 404)
    if (['closed', 'cancelled'].includes(term.status)) {
      throw new AuthError('term_closed', `فصلُ «${term.titleAr}» أُغلق — اختر فصلا مفتوحا`, 409)
    }

    /* ولقاءٌ خارجَ الفصل يمنع النسبة: الصامتُ هنا يترك جلسةً معلَنةً
       لمتعلّمين في شهرٍ لا تغطّيه الشعبة.

       والرسالةُ تخاطب الإدارةَ الآن لا المدرّب — وهي التي تملك حذفَ تلك
       الصفوف، وهي التي ولّدتها أصلا. وكانت تقول للمدرّب «انقلها أو احذفها»
       وهو لا يملك واحدةً منهما. */
    const strays = await this.prisma.cohortSession.findMany({
      where: { cohortId, OR: [{ startsAt: { lt: term.startsOn } }, { startsAt: { gt: term.endsOn } }] },
      orderBy: { startsAt: 'asc' },
      select: { id: true, title: true, startsAt: true },
    })
    if (strays.length) {
      const when = strays.slice(0, 3).map((x) => fmtDay(x.startsAt)).join('، ')
      throw new AuthError(
        'sessions_outside_term',
        `في هذه الشعبة ${strays.length === 1 ? 'لقاءٌ واحدٌ' : `${strays.length} لقاءاتٍ`}`
        + ` خارجَ أشهر «${term.titleAr}» (${when}${strays.length > 3 ? ' وغيرُها' : ''}).`
        + ` احذفها أو انقلها إلى داخل الفصل، أو اختر فصلا يغطّيها.`,
        409,
      )
    }

    const row = await this.prisma.cohort.update({
      where: { id: cohortId },
      data: {
        termId: term.id,
        startsAt: term.startsOn,
        endsAt: term.endsOn,
        /* والفصلُ هو الإذن: أشهرُه نافذةُ جدولة المدرّب. والسقفُ يبقى
           للإدارة إن وضعته — حدٌّ اختياريٌّ فوق الباب لا شرطٌ معه. */
        scheduleWindowStart: term.startsOn,
        scheduleWindowEnd: term.endsOn,
      },
      select: { id: true, title: true, termId: true, startsAt: true, endsAt: true },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'cohort.term.assign', entityType: 'cohort', entityId: cohortId,
      meta: { termId: term.id, termTitle: term.titleAr, startsAt: term.startsOn, endsAt: term.endsOn },
    })
    return { ...row, term }
  }

  /* ═══ «افتح شعبةً لمدرّب» — فعلٌ واحدٌ لا ثلاثة ═══

     ثلاثةُ نداءاتٍ متتابعةٍ (أنشئ · سمِّ الفصل · أسنِد) تُنسى إحداها، وأكثرُها
     نسيانا الفصلُ لأنّه الوحيدُ الذي لا يُشتكى من غيابه فورا — بل يُشتكى
     منه المدرّبُ بعد أسبوعٍ حين يعجز عن الجدولة.

     فالثلاثةُ في معاملةٍ واحدة: ما لم يتمّ كلُّه لم يقع منه شيء. */
  async openForTrainer(actorId: string, input: {
    courseId: string; profileId: string; termId: string; title: string
    pathwayId?: string; capacity?: number; price?: number; currency?: string
    language?: string; deliveryMode?: 'remote' | 'in_person' | 'hybrid'
  }) {
    const term = await this.prisma.term.findUnique({
      where: { id: input.termId },
      select: { id: true, titleAr: true, startsOn: true, endsOn: true, status: true },
    })
    if (!term) throw new AuthError('not_found', 'الفصل غير موجود', 404)
    if (['closed', 'cancelled'].includes(term.status)) {
      throw new AuthError('term_closed', `فصلُ «${term.titleAr}» أُغلق — اختر فصلا مفتوحا`, 409)
    }

    /* والتأهيلُ يُفحص **قبل** أن تُنشأ الشعبة: `assignTrainer` يردّ غيرَ
       المؤهَّل بـ409، ولو أُنشئت قبله لبقيت شعبةٌ يتيمةٌ بلا مدرّبٍ ولا
       اسمَ لحالتها. */
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { id: input.profileId }, include: { application: true },
    })
    if (!profile || profile.suspendedAt || profile.application.status !== 'active') {
      throw new AuthError('not_active', 'المدرب ليس في حالة active', 409)
    }
    const qual = await this.prisma.trainerCourseQualification.findUnique({
      where: { profileId_courseId: { profileId: input.profileId, courseId: input.courseId } },
    })
    if (!qual || qual.status !== 'qualified') {
      throw new AuthError('not_qualified', 'المدرب غير مؤهل لهذه الدورة', 409)
    }

    const cohort = await this.create(actorId, {
      courseId: input.courseId, pathwayId: input.pathwayId, title: input.title,
      termId: term.id,
      startsAt: term.startsOn, endsAt: term.endsOn,
      capacity: input.capacity, price: input.price, currency: input.currency,
      language: input.language, deliveryMode: input.deliveryMode,
    })
    /* والنافذةُ تُفتح من حدود الفصل في الصفّ نفسِه — لا بنداءٍ ثانٍ يُنسى */
    await this.prisma.cohort.update({
      where: { id: cohort.id },
      data: { scheduleWindowStart: term.startsOn, scheduleWindowEnd: term.endsOn },
    })
    await this.assignTrainer(cohort.id, input.profileId, actorId, 'lead')
    await recordAudit(this.prisma, {
      actorId, action: 'cohort.open_for_trainer', entityType: 'cohort', entityId: cohort.id,
      meta: { courseId: input.courseId, profileId: input.profileId, termId: term.id, termTitle: term.titleAr },
    })
    return { cohortId: cohort.id, title: cohort.title, term }
  }

  /** شعبٌ لها مدرّبٌ ولا فصلَ لها — «لم تُفتَح بعد»، لا معطوبة */
  async cohortsWithoutTerm() {
    const rows = await this.prisma.cohort.findMany({
      where: { termId: null, status: { notIn: ['completed', 'cancelled'] } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, startsAt: true, createdAt: true,
        /* واسمُ الدورة في نسختها الأحدث لا في صفّها — فالصفُّ معرّفٌ وتاريخ */
        course: { select: { id: true, versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } } },
        _count: { select: { enrollments: true, sessions: true } },
        trainers: { select: { profile: { select: { application: { select: { fullName: true } } } } } },
      },
    })
    return rows.map((c) => ({
      id: c.id, title: c.title, courseTitleAr: c.course.versions[0]?.titleAr ?? c.course.id, startsAt: c.startsAt,
      learners: c._count.enrollments, sessions: c._count.sessions,
      trainers: c.trainers.map((t) => t.profile.application.fullName),
      /* ومن أُسنِد إليه مدرّبٌ فهو محبوس: يرى شعبةً لا يستطيع جدولتَها */
      blocksTrainer: c.trainers.length > 0,
    }))
  }

  /** ما يراه المدرّبُ عن حدوده — يُقرأ قبل المحاولة لا بعد الرفض */
  async scheduleWindowFor(userId: string, cohortId: string) {
    const cohort = await this.prisma.cohort.findUnique({
      where: { id: cohortId },
      select: {
        id: true, status: true, scheduleWindowStart: true, scheduleWindowEnd: true,
        maxSessions: true, trainers: { select: { profileId: true } },
        _count: { select: { sessions: true } },
      },
    })
    if (!cohort) throw new AuthError('not_found', 'الشعبة غير موجودة', 404)
    const mine = await this.isCohortTrainer(userId, cohortId)
    return {
      mine,
      open: windowOpen(cohort),
      start: cohort.scheduleWindowStart,
      end: cohort.scheduleWindowEnd,
      maxSessions: cohort.maxSessions,
      used: cohort._count.sessions,
      /* و`null` تعني «بلا سقف» لا صفرا — وكان الصفرُ يعنيهما معا */
      remaining: remainingSessions(cohort.maxSessions, cohort._count.sessions),
    }
  }

  /** أهذا مدرّبُ الشعبة فعلا؟ — الإسنادُ لا الدور */
  private async isCohortTrainer(userId: string, cohortId: string) {
    const link = await this.prisma.cohortTrainer.findFirst({
      where: { cohortId, profile: { userId } },
      select: { id: true },
    })
    return link !== null
  }

  /* الحدُّ يُفحص في موضعٍ واحد — فلا يفترق فحصُ الإضافة عن فحص النقل */
  private async assertWithinWindow(cohortId: string, when: { startsAt: Date; endsAt?: Date | null }, opts: { counts: boolean }) {
    const cohort = await this.prisma.cohort.findUnique({
      where: { id: cohortId },
      select: {
        status: true, scheduleWindowStart: true, scheduleWindowEnd: true, maxSessions: true,
        _count: { select: { sessions: true } },
      },
    })
    if (!cohort) throw new AuthError('not_found', 'الشعبة غير موجودة', 404)
    if (['completed', 'cancelled'].includes(cohort.status)) {
      throw new AuthError('bad_state', 'لا جدولةَ لشعبةٍ منتهية', 409)
    }
    const { scheduleWindowStart: from, scheduleWindowEnd: to, maxSessions: cap } = cohort
    /* البابُ يفتحه الفصلُ وحدَه؛ والسقفُ حدٌّ اختياريٌّ يُفحص بعدَه لا معه.
       وكانا مضمومَين بـ«و» فأُغلق البابُ على من فتح فصلَه — والعلّةُ كاملةً
       في رأس `schedule-window.ts`. */
    if (!windowOpen(cohort) || !from || !to) {
      throw new AuthError('forbidden', 'لم تُفتح لهذه الشعبة نافذةُ جدولةٍ بعد — تُسمّي الإدارةُ فصلَها عند الإسناد', 403)
    }
    if (when.startsAt < from || when.startsAt > to) {
      throw new AuthError('forbidden', `الموعدُ خارجَ نافذة الجدولة (${fmtDay(from)} — ${fmtDay(to)})`, 403)
    }
    if (when.endsAt && when.endsAt > to) {
      throw new AuthError('forbidden', `نهايةُ اللقاء بعد نافذة الجدولة (${fmtDay(to)})`, 403)
    }
    if (opts.counts && capReached(cap, cohort._count.sessions)) {
      throw new AuthError('forbidden', `بلغتَ سقفَ اللقاءات (${cap}) — احذف لقاءً أو راجع الإدارة`, 403)
    }
  }

  /** المدرّبُ يضيف لقاءً في شعبته — بالحدّ نفسِه الذي تُفحص به إضافةُ الإدارة */
  async trainerAddSession(userId: string, cohortId: string, input: {
    title: string; startsAt: Date; endsAt?: Date; timezone?: string; moduleId?: string
    noteAr?: string | null
  }) {
    if (!(await this.isCohortTrainer(userId, cohortId))) {
      throw new AuthError('forbidden', 'لستَ مدرّبَ هذه الشعبة', 403)
    }
    await this.assertWithinWindow(cohortId, input, { counts: true })
    /* وفحصُ التعارض هو فحصُ الإدارة نفسُه — `addSession` تحمله */
    /* ═══ وهذا البابُ ينتظر الاعتمادَ كأخيه ═══

       لا مسلكَ ينادي هذه اليومَ (`/api/trainer/cohorts/:id/sessions` يمرّ
       بـ`trainerAddSessionWithMeeting`)، لكنّها **بابُ مدرّبٍ** بحكم اسمها
       وفحصِها. ولو تركت تكتب `approved` لصار في الخدمة بابان لمدرّبٍ واحد:
       أحدُهما ينتظر قرارا والآخرُ يُعلن لحظتَه — ومن وصل الثاني بمسلكٍ يوما
       لم يكن ليعلم أنّه تخطّى بوّابةً.

       والافتراضُ يبقى `approved` في `addSession` نفسِها: تلك بابُ الإدارة،
       وما جدولته الإدارةُ معتمَدٌ بحكم من جدوله. */
    return this.addSession(userId, cohortId, { ...input, approvalState: 'pending', wantsZoom: false })
  }

  /** المدرّبُ ينقل لقاءَه — لا يقترح نقله */
  async trainerMoveSession(userId: string, sessionId: string, input: { startsAt: Date; endsAt?: Date }) {
    const session = await this.prisma.cohortSession.findUnique({
      where: { id: sessionId },
      select: { id: true, cohortId: true, title: true, startsAt: true, approvalState: true },
    })
    if (!session) throw new AuthError('not_found', 'اللقاء غير موجود', 404)
    if (!(await this.isCohortTrainer(userId, session.cohortId))) {
      throw new AuthError('forbidden', 'لستَ مدرّبَ هذه الشعبة', 403)
    }
    /* النقلُ لا يزيد العددَ فلا يُفحص السقف — يُفحص المدى وحدَه */
    await this.assertWithinWindow(session.cohortId, input, { counts: false })

    const trainers = await this.prisma.cohortTrainer.findMany({
      where: { cohortId: session.cohortId }, select: { profileId: true },
    })
    for (const t of trainers) {
      /* `ignoreCohortId` يستثني الشعبةَ كلَّها، فاللقاءُ المنقولُ لا يتعارض
         مع نفسِه ولا مع إخوته — والتعارضُ المقصودُ ما في شعبةٍ أخرى. */
      await this.assertNoScheduleConflict(
        t.profileId,
        [{ startsAt: input.startsAt, endsAt: input.endsAt ?? null }],
        session.cohortId,
      )
    }
    /* ═══ والمنقولُ يرجع إلى الانتظار ═══

       قرارُ صاحب المنصّة (١٧ سبتمبر ٢٠٢٦): «يغيّرُه فيرجع لانتظار الإدارة».
       فاللقاءُ المعتمَدُ صار في تقاويم عشرين إنسانا وله اجتماعُ زووم قائم،
       ونقلُه يُسقطه إلى `pending` فيغيب عن شاشات المتعلّمين حتّى تعتمده
       الإدارةُ ثانيةً — فلا يصل الناسَ موعدٌ لم يُراجَع.

       ولأنّه يرجع إلى الانتظار سقط بابُ «اقترح موعدا» كلُّه: من يملك النقلَ
       لا يستأذن فيه، والاعتمادُ يقع بعدَه لا قبلَه. */
    const wasApproved = session.approvalState === 'approved'
    const moved = await this.prisma.cohortSession.update({
      where: { id: sessionId },
      data: {
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        ...(wasApproved ? { approvalState: 'pending', approvedAt: null, approvedBy: null } : {}),
      },
    })
    await recordAudit(this.prisma, {
      actorId: userId, action: 'cohort.session.move', entityType: 'cohort_session', entityId: sessionId,
      meta: { from: session.startsAt, to: input.startsAt, cohortId: session.cohortId, backToPending: wasApproved },
    })
    /* والإدارةُ تُعلَم أنّ في طابورها صفًّا جديدا — وإلّا بقي اللقاءُ محجوبا
       عن متعلّميه ولا أحدَ يعلم أنّه ينتظر. */
    if (wasApproved) {
      await this.notifyAdminsOfPendingSession(moved.id, session.cohortId, session.title)
      await this.tellCohortScheduleChanged(session.cohortId, session,
        'نقله مدرّبُك ويُراجَع الآن عند الإدارة. ويصلك موعدُه الجديدُ حين يُعتمَد.')
    }
    return moved
  }

  /* ═══ وما كان في تقويمه ثمّ لم يعد — يُقال له ═══

     قرارُ ١٧ سبتمبر يُسقط اللقاءَ المنقولَ إلى الانتظار، فيغيب عن شاشات
     متعلّميه. والحذفُ يغيّبه كذلك. وكلاهما **تغيّرٌ في موعدٍ أُعلن**، فلو
     مرّ صامتا لَحضر متعلّمٌ في وقتٍ لا أحدَ فيه — وهو بعينه العطبُ الذي
     بُنيت له بوّابةُ `session-visibility.ts`: لا يسقط شيء، بل يُعرض موعدٌ
     زائدٌ أو يختفي موعدٌ منتظَر.

     والمفتاحُ `cohort.schedule_changed` قائمٌ ومسجَّلٌ في الوجهات والأصناف
     معا — وهو موضوعُه بالحرف: «تحرّكُ جدولِ الشعبة». فلا يُخترَع مفتاحٌ
     جديدٌ لِما له مفتاح. */
  private async tellCohortScheduleChanged(
    cohortId: string,
    session: { id: string; title: string },
    whyAr: string,
  ): Promise<number> {
    const cohort = await this.prisma.cohort.findUnique({ where: { id: cohortId }, select: { title: true } })
    const recipients = await this.prisma.enrollment.findMany({
      where: { cohortId, status: { not: 'dropped' } },
      select: { userId: true },
    })
    for (const r of recipients) {
      await safeNotify(this.prisma, {
        userId: r.userId, channel: 'in_app', audience: 'learner',
        templateKey: 'cohort.schedule_changed',
        title: `تغيّر موعدٌ في ${cohort?.title ?? 'شعبتك'}`,
        body: `${session.title} — ${whyAr}`,
        data: { cohortId, sessionId: session.id },
      })
    }
    return recipients.length
  }

  /* الطابورُ يُنبَّه من موضعٍ واحد: يدخله لقاءٌ جديدٌ يُجدوَل، ويدخله لقاءٌ
     معتمَدٌ نُقل فسقط إلى الانتظار. ولو كُتب النداءُ في كلٍّ بيده لَنُسي في
     أحدهما، وبقي اللقاءُ محجوبا عن متعلّميه ولا أحدَ يعلم أنّه ينتظر. */
  private async notifyAdminsOfPendingSession(sessionId: string, cohortId: string, title: string) {
    await notifyRole(this.prisma, ['academic_manager', 'super_admin'], {
      channel: 'in_app',
      title: 'لقاءٌ مباشرٌ بانتظار اعتمادك',
      body: `جدول مدرّبُ الشعبة «${title}» — راجِعه واعتمِده ليصل المسجَّلين.`,
      templateKey: 'cohort.session.pending',
      data: { cohortId, sessionId },
    })
  }

  /* ═══ حذفُ لقاء — فعلٌ كانت الشاشةُ تأمر به ولا بابَ له ═══

     كانت `TrainerSchedule` تقول عند السقف «احذف لقاءً أو راجعها لتوسيعه»،
     وكان خطأُ `sessions_outside_term` يقول «انقلها أو احذفها ثمّ اختر
     الفصل» — **ولا مسلكَ حذفِ لقاءٍ في الواجهة البرمجيّة كلِّها**. فالمدرّبُ
     يُؤمَر بفعلٍ لا يستطيعه، وهو المبدأُ الرابع في موجز المنصّة.

     وهو كذلك ما يفكّ الحلقةَ المغلقة: اللقاءاتُ الخارجةُ عن الفصل ولّدتها
     الإدارةُ آليّا قبل إسناد المدرّب، ونقلُها يمرّ بالنافذة التي يحاول
     فتحَها — فالحذفُ مخرجُه الوحيد.

     والحراسةُ على الأثر لا على الحالة: ما حضره أحدٌ أو انعقد اجتماعُه فهو
     واقعةٌ لا مسودّة، وحذفُه يمحو حضورا مسجَّلا. */
  async trainerDeleteSession(userId: string, sessionId: string) {
    const session = await this.prisma.cohortSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true, cohortId: true, title: true, startsAt: true, approvalState: true,
        zoom: { select: { meetingId: true, actualStartAt: true } },
        _count: { select: { attendance: true } },
      },
    })
    if (!session) throw new AuthError('not_found', 'اللقاء غير موجود', 404)
    if (!(await this.isCohortTrainer(userId, session.cohortId))) {
      throw new AuthError('forbidden', 'لستَ مدرّبَ هذه الشعبة', 403)
    }
    if (session._count.attendance > 0 || session.zoom?.actualStartAt) {
      throw new AuthError('bad_state', 'لقاءٌ انعقد ولا يُحذف — سُجِّل فيه حضور. راجع الإدارة إن أردت إلغاءه', 409)
    }
    /* واجتماعُ زووم يُلغى معه، وإلّا بقي في حساب الأكاديميّة موعدٌ لا شعبةَ
       له ويفتحه من وصله رابطُه. والإخفاقُ لا يمنع الحذفَ: صفٌّ يشير إلى
       اجتماعٍ محذوفٍ أهونُ من شعبةٍ لا تُنظَّف. */
    if (session.zoom?.meetingId) {
      try {
        const cfg = await getZoomConfig(this.prisma)
        if (zoomReady(cfg)) await deleteZoomMeeting(cfg, session.zoom.meetingId)
      } catch (e) {
        console.error('[zoom] تعذّر إلغاءُ الاجتماع مع لقائه', session.zoom.meetingId, e)
      }
    }
    /* والمُعلَنُ يُبلَّغ قبل أن يُمحى صفُّه — فبعد الحذف لا مرجعَ يُقرأ منه */
    const wasAnnounced = session.approvalState === 'approved'
    const told = wasAnnounced
      ? await this.tellCohortScheduleChanged(session.cohortId, session, 'أُلغي هذا اللقاء. ويصلك بديلُه إن جُدوِل.')
      : 0

    await this.prisma.cohortSession.delete({ where: { id: sessionId } })
    await recordAudit(this.prisma, {
      actorId: userId, action: 'cohort.session.delete', entityType: 'cohort_session', entityId: sessionId,
      meta: { cohortId: session.cohortId, title: session.title, startsAt: session.startsAt, announced: wasAnnounced, told },
    })
    return { deleted: true as const, told }
  }

  /* ═══ توليدُ الجلسات من الجدول الأسبوعيّ ═══

     الجدولُ كان محفوظا مرّتين بلا رابط: حقولُ النمط في الشعبة (`daysOfWeek`
     و`startTime`) وصفوفُ الجلسات. فالموظّفُ يعبّئ النمطَ ثمّ يضيف ستّةَ عشرَ
     صفًّا بيده، وأيُّ اختلافٍ بينهما لا يكشفه شيء. والحقيقةُ صفوفُ الجلسات —
     لأنّها ما يراه المتعلّمُ ويُربَط باجتماعه وحضورِه — والنمطُ مولِّدُها.

     ولا يُكتب شيءٌ إلّا بطلبٍ صريح: `preview` يعرض ما سيُنشأ أوّلا. */
  async generateSessions(actorId: string | null, cohortId: string, input: {
    weeks: number
    /**
     * التباعدُ بين موجةٍ وأخرى بالأسابيع — الافتراضُ ١، أي أسبوعيّا كما كان.
     *
     * وأُضيف لأنّ الجلسةَ المباشرة ليست كلَّ التعلّم: بينها يقرأ المتدرّبُ
     * المادّةَ وملخّصاتِ وجيز، ويشاهد المسجَّل، ويؤدّي مهامَّه. فجدولٌ
     * أسبوعيٌّ متلاحقٌ يجعل اللقاءَ يسبق العمل، ويحضر المتدرّبُ ولم يعمل.
     *
     * ولا يغيّر شيئا لمن لم يمرّره: `weeks` تبقى عددَ الموجات، والتباعدُ ١.
     */
    intervalWeeks?: number
    /** أوّلُ أسبوعٍ يُولَّد منه — الافتراضُ بدايةُ الشعبة أو اليوم */
    from?: Date
    durationMinutes?: number
    /** نمطٌ يُملى لهذه المرّة، وإلّا فنمطُ الشعبة المحفوظ */
    daysOfWeek?: string[]
    startTime?: string
    titlePrefix?: string
    apply?: boolean
  }) {
    const cohort = await this.prisma.cohort.findUnique({
      where: { id: cohortId },
      include: { trainers: true, sessions: { select: { id: true, startsAt: true } } },
    })
    if (!cohort) throw new AuthError('not_found', 'الشعبة غير موجودة', 404)
    if (['completed', 'cancelled'].includes(cohort.status)) throw new AuthError('bad_state', 'لا جلسات لشعبة منتهية', 409)

    const days = (input.daysOfWeek ?? cohort.daysOfWeek).filter((d) => DAY_INDEX[d] !== undefined)
    if (days.length === 0) throw new AuthError('no_pattern', 'لا أيّامَ في جدول الشعبة — اختر أيّامَ الأسبوع أوّلا')
    const time = input.startTime ?? cohort.startTime
    if (!time || !/^\d{2}:\d{2}$/.test(time)) throw new AuthError('no_time', 'وقتُ البدء غير محدّد — اضبطه بصيغة 18:00')
    if (input.weeks < 1 || input.weeks > 52) throw new AuthError('bad_weeks', 'عددُ الأسابيع بين ١ و٥٢')
    /* التباعدُ يُحدُّ كما تُحدُّ الأسابيع — ولا يُقبل كسرٌ ولا صفرٌ ولا مدًى
       يقذف آخرَ جلسةٍ إلى سنةٍ أخرى. */
    const gap = input.intervalWeeks ?? 1
    if (!Number.isInteger(gap) || gap < 1 || gap > 8) {
      throw new AuthError('bad_interval', 'التباعدُ بين الجلسات أسبوعٌ إلى ثمانية')
    }
    if ((input.weeks - 1) * gap + 1 > 52) {
      throw new AuthError('bad_span', 'الجدولُ بهذا التباعد يتجاوز ٥٢ أسبوعا')
    }

    const [hh, mm] = time.split(':').map(Number)
    const duration = input.durationMinutes && input.durationMinutes > 0 ? input.durationMinutes : 120
    const from = input.from ?? cohort.startsAt ?? new Date()
    /* أوّلُ أحدٍ في أسبوع البداية — كي تكون الأيّامُ منسوبةً إلى أسبوعٍ لا إلى اليوم */
    const weekStart = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() - from.getUTCDay()))

    const taken = new Set(cohort.sessions.map((s) => s.startsAt.getTime()))
    const planned: { title: string; startsAt: Date; endsAt: Date; duplicate: boolean }[] = []
    const prefix = input.titlePrefix?.trim() || 'الجلسة'
    let n = cohort.sessions.length
    for (let w = 0; w < input.weeks; w += 1) {
      for (const day of [...days].sort((a, b) => DAY_INDEX[a] - DAY_INDEX[b])) {
        const startsAt = new Date(weekStart)
        startsAt.setUTCDate(weekStart.getUTCDate() + w * 7 * gap + DAY_INDEX[day])
        startsAt.setUTCHours(hh, mm, 0, 0)
        /* ما مضى لا يُجدَّل: الأسبوعُ الأوّلُ قد يبدأ بعد يومٍ فات */
        if (startsAt < from) continue
        const duplicate = taken.has(startsAt.getTime())
        if (!duplicate) n += 1
        planned.push({
          title: duplicate ? `${prefix} (موجودة)` : `${prefix} ${n}`,
          startsAt,
          endsAt: new Date(startsAt.getTime() + duration * 60_000),
          duplicate,
        })
      }
    }
    const fresh = planned.filter((p) => !p.duplicate)
    if (input.apply !== true) {
      return { applied: false, created: 0, skipped: planned.length - fresh.length, sessions: planned }
    }
    if (fresh.length === 0) throw new AuthError('nothing_to_create', 'لا جلسةَ جديدةً في هذا النطاق — كلُّها موجودةٌ أصلا', 409)

    /* تعارضُ جدول المدرّب يُفحص للمجموعة كلِّها قبل كتابةِ أيٍّ منها */
    for (const t of cohort.trainers) {
      await this.assertNoScheduleConflict(t.profileId, fresh.map((f) => ({ startsAt: f.startsAt, endsAt: f.endsAt })), cohortId)
    }
    await this.prisma.cohortSession.createMany({
      data: fresh.map((f) => ({ cohortId, title: f.title, startsAt: f.startsAt, endsAt: f.endsAt, timezone: cohort.timezone })),
    })
    /* بدايةُ الشعبة ونهايتُها تتبعان جلساتِها لا العكس */
    const bounds = await this.prisma.cohortSession.aggregate({
      where: { cohortId }, _min: { startsAt: true }, _max: { endsAt: true },
    })
    await this.prisma.cohort.update({
      where: { id: cohortId },
      data: { startsAt: bounds._min.startsAt ?? undefined, endsAt: bounds._max.endsAt ?? undefined },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'cohort.sessions.generate', entityType: 'cohort', entityId: cohortId,
      meta: { weeks: input.weeks, days, startTime: time, created: fresh.length },
    })
    return { applied: true, created: fresh.length, skipped: planned.length - fresh.length, sessions: planned }
  }

  /* ═══ تكرارُ شعبةٍ من فصلٍ سابق ═══

     إعدادُ الفصل الجديد كان يُعاد من الصفر في كلّ مرّة: النمطُ والسعرُ والسعةُ
     والموادُّ والتكاليفُ كلُّها تُكتب ثانيةً، وأيُّ سهوٍ يُكتشَف بعد الفتح.
     والنسخُ لا يحمل ما يخصّ أشخاصا: لا تسجيلاتٍ ولا حضورَ ولا تسليماتٍ ولا
     اجتماعاتِ Zoom — الشعبةُ الجديدةُ مسودّةٌ نظيفة. */
  async duplicate(actorId: string, cohortId: string, input: {
    title?: string
    /** تُنقل الجلساتُ بإزاحةِ هذا العدد من الأسابيع (الافتراض: تُولَّد لاحقا) */
    shiftWeeks?: number
    withSessions?: boolean
    withMaterials?: boolean
    withAssessments?: boolean
  }) {
    const source = await this.prisma.cohort.findUnique({
      where: { id: cohortId },
      include: {
        sessions: { orderBy: { startsAt: 'asc' } },
        materials: true,
        assessments: true,
      },
    })
    if (!source) throw new AuthError('not_found', 'الشعبة غير موجودة', 404)

    const shift = (input.shiftWeeks ?? 0) * 7 * 86_400_000
    const created = await this.prisma.cohort.create({
      data: {
        courseId: source.courseId, pathwayId: source.pathwayId,
        title: input.title?.trim() || `${source.title} — نسخة`,
        status: 'draft', registrationOpen: false, financialReady: false,
        daysOfWeek: source.daysOfWeek, startTime: source.startTime, timezone: source.timezone,
        capacity: source.capacity, price: source.price, currency: source.currency,
        language: source.language, deliveryMode: source.deliveryMode,
        startsAt: input.withSessions && source.startsAt ? new Date(source.startsAt.getTime() + shift) : null,
        endsAt: input.withSessions && source.endsAt ? new Date(source.endsAt.getTime() + shift) : null,
      },
    })

    if (input.withSessions && source.sessions.length) {
      await this.prisma.cohortSession.createMany({
        data: source.sessions.map((sn) => ({
          cohortId: created.id, title: sn.title, moduleId: sn.moduleId, timezone: sn.timezone,
          startsAt: new Date(sn.startsAt.getTime() + shift),
          endsAt: sn.endsAt ? new Date(sn.endsAt.getTime() + shift) : null,
        })),
      })
    }
    /* الموادُّ تُنسخ روابطَها ووصفَها؛ وملفُّها الخاصُّ لا يُنسخ (مفتاحُ تخزينٍ
       واحدٌ لا يُشارَك بين شعبتَين) */
    if (input.withMaterials && source.materials.length) {
      await this.prisma.learningMaterial.createMany({
        data: source.materials
          .filter((m) => m.externalUrl !== null)
          .map((m) => ({
            cohortId: created.id, title: m.title, kind: m.kind, moduleId: m.moduleId,
            externalUrl: m.externalUrl, createdBy: actorId,
          })),
      })
    }
    if (input.withAssessments && source.assessments.length) {
      await this.prisma.cohortAssessment.createMany({
        data: source.assessments.map((a) => ({
          cohortId: created.id, title: a.title, type: a.type, maxScore: a.maxScore,
          passScore: a.passScore, rubricId: a.rubricId,
          status: 'draft', createdBy: actorId,
        })),
      })
    }
    await recordAudit(this.prisma, {
      actorId, action: 'cohort.duplicate', entityType: 'cohort', entityId: created.id,
      meta: { sourceCohortId: cohortId, shiftWeeks: input.shiftWeeks ?? 0 },
    })
    return created
  }

  /** ربط اجتماع Zoom يدوي — لا اجتماع حقيقي دون مفاتيح */
  async attachManualZoom(actorId: string, sessionId: string, input: {
    joinUrl: string; meetingId?: string; passcode?: string; learnerUrl?: string; hostProfileId?: string
  }, announce = true) {
    const session = await this.prisma.cohortSession.findUnique({ where: { id: sessionId }, include: { zoom: true, cohort: { include: { trainers: true } } } })
    if (!session) throw new AuthError('not_found', 'الجلسة غير موجودة', 404)
    if (session.zoom) throw new AuthError('already_linked', 'الجلسة مرتبطة باجتماع مسبقا', 409)
    if (!/^https:\/\/.+/.test(input.joinUrl)) throw new AuthError('bad_url', 'رابط الاجتماع يجب أن يكون https')
    if (input.hostProfileId && !session.cohort.trainers.some((t) => t.profileId === input.hostProfileId)) {
      throw new AuthError('not_cohort_trainer', 'مضيف الاجتماع ليس مدربا لهذه الشعبة', 409)
    }
    const zoom = await this.prisma.zoomMeeting.create({
      data: {
        sessionId, provider: 'manual', joinUrl: input.joinUrl, meetingId: input.meetingId,
        passcodeEnc: input.passcode ?? null, learnerUrl: input.learnerUrl,
        hostProfileId: input.hostProfileId, createdBy: actorId,
      },
    })
    await recordAudit(this.prisma, { actorId, action: 'zoom.attach_manual', entityType: 'cohort_session', entityId: sessionId })
    if (announce) await this.notifyMeetingLinked(sessionId)
    return zoom
  }

  /** تذكرةُ دخولٍ إلى الجلسة داخلَ الموقع — والدورُ يُشتقّ هنا لا يُطلب.

     الحدُّ نفسُه الذي في رأس مسارات البوّابة: «المتعلّم لا يرى محتوى شعبةٍ غير
     مسجَّلٍ فيها، والمدرّب لا يرى شعبا خارجَ شعبه». فمن ليس مدرّبَ الشعبة ولا
     متعلّمَها المسجَّل لا يُوقَّع له شيء.

     ولا يُقبل دورٌ من جسم الطلب: لو قُبل لصار كلُّ متعلّمٍ مضيفا بتعديل حقلٍ
     في متصفّحه — يُخرج غيرَه ويفتح الاجتماعَ قبل مدرّبه. */
  async meetingSdkTicket(userId: string, sessionId: string) {
    assertMeetingSdkEnabled()

    const session = await this.prisma.cohortSession.findUnique({
      where: { id: sessionId },
      include: {
        zoom: true,
        cohort: {
          select: {
            id: true,
            trainers: { select: { profile: { select: { userId: true } } } },
            enrollments: { where: { userId }, select: { status: true } },
          },
        },
      },
    })
    if (!session) throw new AuthError('not_found', 'الجلسة غير موجودة', 404)
    if (session.status === 'cancelled') throw new AuthError('session_cancelled', 'هذه الجلسة ملغاة', 409)
    if (!session.zoom) throw new AuthError('no_meeting', 'الجلسة بلا اجتماع بعد', 409)

    /* التضمينُ يحتاج رقمَ الاجتماع لا رابطَه. والربطُ اليدويُّ قد يُدخل الرابطَ
       بلا رقم — فتلك جلسةٌ تُفتح في تطبيق Zoom لا داخلَ الموقع، ويقال ذلك. */
    if (!session.zoom.meetingId) {
      throw new AuthError('no_meeting_number', 'هذه الجلسة بلا رقم اجتماع — افتح رابطها في تطبيق Zoom', 409)
    }

    const isTrainer = session.cohort.trainers.some((t) => t.profile.userId === userId)
    const enrollment = session.cohort.enrollments[0]
    const isActiveLearner = enrollment !== undefined && (enrollment.status === 'enrolled' || enrollment.status === 'completed')
    if (!isTrainer && !isActiveLearner) {
      throw new AuthError('forbidden', 'هذه الجلسة ليست من شعبك', 403)
    }

    const role: ZoomSdkRole = isTrainer ? 1 : 0
    return {
      signature: signMeetingSdkJwt({ meetingNumber: session.zoom.meetingId, role }),
      sdkKey: meetingSdkKey(),
      meetingNumber: session.zoom.meetingId.replace(/[\s-]/g, ''),
      passcode: session.zoom.passcodeEnc ?? '',
      role,
    }
  }

  /* ═══════════ اللقاءُ يُنشأ من هنا لا من موقع Zoom ═══════════

     ثلاثةُ أفعالٍ كانت تُفعل في ثلاثة أمكنة — تُنشأ الجلسةُ هنا، ويُنشأ
     الاجتماعُ في تبويبِ Zoom، ويُبلَّغ الطلبةُ في واتساب أو لا يُبلَّغون —
     صارت فعلا واحدا. ومن أخطأ في أحدها لم يكن شيءٌ يقابله بالآخرَين.

     **ولا يُبلَّغ أحدٌ من `addSession` نفسِها**: مولّدُ الجدول ينشئ ستَّ عشرةَ
     جلسةً دفعةً واحدة، فإشعارٌ في كلّ واحدةٍ ستَّ عشرةَ رسالةً في ثانية. فالتبليغُ
     هنا وحدَه — حيث يُجدوَل **لقاءٌ واحدٌ بقصد**. */

  /** اللقاءُ واجتماعُه وتبليغُ المسجَّلين — فعلٌ واحدٌ للإدارة */
  async addSessionWithMeeting(actorId: string, cohortId: string, input: {
    title: string; startsAt: Date; endsAt?: Date; timezone?: string; moduleId?: string; withZoom?: boolean
  }) {
    /* الجاهزيّةُ تُفحص **قبل** أن تُنشأ الجلسة: فمن طلب اجتماعا ولا مفاتيحَ
       للمنصّة يُردّ ولا يجد جلسةً نصفَ مجدولةٍ بلا رابط. */
    const config = input.withZoom ? await getZoomConfig(this.prisma) : null
    if (config && !zoomReady(config)) {
      throw new AuthError(
        'zoom_not_configured',
        `تكاملُ Zoom غير مكتمل — ينقصه: ${zoomMissing(config).join(' · ')}. `
        + 'اضبطه من «التكاملات»، أو أنشئ اللقاءَ بلا اجتماعٍ وألصق رابطا يدويّا.',
        409,
      )
    }
    const session = await this.addSession(actorId, cohortId, input)

    let zoom: Awaited<ReturnType<typeof this.attachApiZoom>> | null = null
    if (config) {
      try {
        zoom = await this.attachApiZoom(actorId, session.id, config, false)
      } catch (e) {
        /* تعويضٌ صريح: الجلسةُ وُلدت قبل لحظةٍ ولا شيءَ معلَّقٌ بها، فتُحذف كي
           لا يبقى في الجدول لقاءٌ طُلب له اجتماعٌ ولم يُنشأ — وهو ما يراه
           الطالبُ موعدا بلا باب. */
        await this.prisma.cohortSession.delete({ where: { id: session.id } }).catch(() => {})
        await recordAudit(this.prisma, {
          actorId, action: 'zoom.create_failed', entityType: 'cohort', entityId: cohortId,
          meta: { reason: e instanceof AuthError ? e.message : 'خطأ غير متوقّع', rolledBack: true },
        })
        throw e
      }
    }
    const notified = await this.notifyCohortOfSession(cohortId, session, zoom)
    return { session, zoom, notified }
  }

  /** المدرّبُ يجدول لقاءه واجتماعَه — بالحدّ نفسِه الذي تُفحص به جدولةُ الإدارة */
  async trainerAddSessionWithMeeting(userId: string, cohortId: string, input: {
    title: string; startsAt: Date; endsAt?: Date; timezone?: string; moduleId?: string
    noteAr?: string | null
    attachmentKey?: string | null; attachmentName?: string | null; attachmentMime?: string | null
  }) {
    if (!(await this.isCohortTrainer(userId, cohortId))) {
      throw new AuthError('forbidden', 'لستَ مدرّبَ هذه الشعبة', 403)
    }
    await this.assertWithinWindow(cohortId, input, { counts: true })

    /* ═══ يُجدوَل منتظِرا، ولا يُعلَن حتّى تعتمده الإدارة ═══

       قرارُ صاحب المنصّة (١٥ سبتمبر ٢٠٢٦): «وبعدها الإدارةُ توافق، ويصبح
       هناك جلسةُ زووم لايف تُنشَر في منصّة الطلبة بتاريخها، ويُرسَل إيميلٌ
       للطلاب بالاجتماع وللإدارة».

       وكان `addSessionWithMeeting` يُنشئ الاجتماعَ ويُبلّغ في النداء نفسِه —
       فخطأٌ في تاريخٍ يصل عشرين إنسانا قبل أن يُقرأ، ولا سبيلَ إلى سحبه.

       **والاجتماعُ لا يُنشأ هنا**: اجتماعُ Zoom لموعدٍ قد يُردّ صفٌّ في
       حسابنا لا يحضره أحد، ورابطٌ حيٌّ قبل الاعتماد يُنسَخ من شاشة المدرّب
       ويُنشَر. فيُنشأ عند الاعتماد، ونيّتُه تُحفظ حتّى حينه. */
    /* ═══ ونيّةُ الاجتماع تُقرأ من الشعبة لا تُسأل من المدرّب ═══

       كانت خانةَ اختيارٍ في الشاشة. وقال صاحبُ المنصّة (١٧ سبتمبر ٢٠٢٦):
       الجوابُ مكتوبٌ عندنا في `deliveryMode` — فلمَ يُسأل عنه؟ وضرَرُها لم
       يكن سؤالا زائدا: من قرأها إذنا ماليّا فأطفأها، اعتُمدت جلستُه
       بـ`wantsMeeting: false` — لقاءٌ «مباشرٌ» بلا اجتماعٍ أصلا. */
    const cohort = await this.prisma.cohort.findUniqueOrThrow({
      where: { id: cohortId }, select: { deliveryMode: true },
    })
    const session = await this.addSession(userId, cohortId, {
      ...input,
      approvalState: 'pending',
      wantsZoom: cohort.deliveryMode !== 'in_person',
    })
    await this.notifyAdminsOfPendingSession(session.id, cohortId, session.title)
    await recordAudit(this.prisma, {
      actorId: userId, action: 'cohort.session.propose', entityType: 'cohort_session', entityId: session.id,
      meta: { cohortId, startsAt: session.startsAt, deliveryMode: cohort.deliveryMode },
    })
    /* ولا عددَ مبلَّغين يُقال: لم يُبلَّغ أحد، وقولُ «بُلِّغ ٠» يُقرأ عطبا */
    return { session, zoom: null, notified: 0, pending: true as const }
  }

  /* ═══ قرارُ الإدارة على لقاءٍ منتظِر ═══

     الاعتمادُ هو اللحظةُ التي يقع فيها كلُّ شيء: يُنشأ اجتماعُ Zoom، ويُنشَر
     اللقاءُ في منصّة الطلبة بتاريخه، ويصلهم البريدُ وتصل الإدارةَ نسختُه.

     وإنشاءُ الاجتماع قد يسقط (مفاتيحُ ناقصةٌ أو Zoom لا يستجيب). فلا يُكتب
     الاعتمادُ قبله: لقاءٌ «معتمَدٌ» بلا اجتماعٍ موعدٌ بلا باب، ويراه
     المسجَّلون فيقفون عنده. فتُرتَّب: الاجتماعُ أوّلا، ثمّ الختمُ، ثمّ
     التبليغ. */
  async decideSession(actorId: string, sessionId: string, approve: boolean, note?: string) {
    const session = await this.prisma.cohortSession.findUnique({
      where: { id: sessionId },
      select: { id: true, cohortId: true, title: true, startsAt: true, approvalState: true, wantsMeeting: true, zoom: { select: { id: true } } },
    })
    if (!session) throw new AuthError('not_found', 'اللقاء غير موجود', 404)
    if (session.approvalState !== 'pending') {
      throw new AuthError('already_decided', 'هذا اللقاء لا ينتظر قرارا', 409)
    }

    if (!approve) {
      const rejected = await this.prisma.cohortSession.update({
        where: { id: sessionId },
        data: { approvalState: 'rejected', approvedBy: actorId, approvedAt: new Date(), reviewNote: note?.trim() || null, status: 'cancelled' },
      })
      await recordAudit(this.prisma, {
        actorId, action: 'cohort.session.reject', entityType: 'cohort_session', entityId: sessionId,
        meta: { cohortId: session.cohortId, note: note?.trim() || null },
      })
      await this.notifyCohortTrainers(session.cohortId, {
        templateKey: 'cohort.session.rejected',
        title: `لم يُعتمَد لقاءُ «${session.title}»`,
        body: note?.trim()
          ? `راجِع الملاحظةَ ثمّ أعِد جدولتَه: ${note.trim()}`
          : 'راجِع الإدارةَ لمعرفة السبب ثمّ أعِد جدولتَه.',
        data: { cohortId: session.cohortId, sessionId },
      })
      return { session: rejected, zoom: null, notified: 0 }
    }

    /* نيّةُ الاجتماع محفوظةٌ منذ الجدولة — و`zoom` قائمٌ يعني لقاءً حضوريًّا
       جُدول باجتماعٍ من قبل، فلا يُنشأ ثانٍ. */
    let zoom: { joinUrl: string } | null = session.zoom
      ? await this.prisma.zoomMeeting.findUnique({ where: { sessionId } })
      : null
    if (!zoom && session.wantsMeeting) {
      zoom = await this.attachApiZoom(actorId, sessionId, undefined, false)
    }

    const approved = await this.prisma.cohortSession.update({
      where: { id: sessionId },
      data: { approvalState: 'approved', approvedBy: actorId, approvedAt: new Date(), reviewNote: null },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'cohort.session.approve', entityType: 'cohort_session', entityId: sessionId,
      meta: { cohortId: session.cohortId, hasMeeting: Boolean(zoom) },
    })
    const notified = await this.notifyCohortOfSession(session.cohortId, approved, zoom)
    await this.notifyCohortTrainers(session.cohortId, {
      templateKey: 'cohort.session.approved',
      title: `اعتُمد لقاءُ «${session.title}»`,
      body: `وصل المسجَّلين في تقويمهم وبالبريد${zoom ? '، ومعه رابطُ الاجتماع' : ''}.`,
      data: { cohortId: session.cohortId, sessionId },
    })
    return { session: approved, zoom, notified }
  }

  /** اللقاءاتُ المنتظِرةُ قرارا — للطابور الذي تراجع فيه الإدارةُ الشعبة */
  async pendingSessions(cohortId?: string) {
    return this.prisma.cohortSession.findMany({
      where: { approvalState: 'pending', ...(cohortId ? { cohortId } : {}) },
      orderBy: { startsAt: 'asc' },
      select: {
        id: true, title: true, startsAt: true, endsAt: true, noteAr: true,
        attachmentKey: true, attachmentName: true, attachmentMime: true, createdAt: true,
        cohort: { select: { id: true, title: true } },
      },
    })
  }

  /** مدرّبو الشعبة — يُبلَّغون بقرار الإدارة على لقاءاتهم */
  private async notifyCohortTrainers(
    cohortId: string,
    msg: { templateKey: string; title: string; body: string; data: Record<string, unknown> },
  ) {
    const trainers = await this.prisma.cohortTrainer.findMany({
      where: { cohortId },
      select: { profile: { select: { userId: true } } },
    })
    for (const t of trainers) {
      if (!t.profile?.userId) continue
      await safeNotify(this.prisma, { userId: t.profile.userId, channel: 'in_app', audience: 'trainer', ...msg })
    }
  }

  /** اجتماعٌ حقيقيٌّ على Zoom لجلسةٍ قائمة — `zoom_api` لا `manual` */
  /* و`announce` رايةٌ صريحة: `addSessionWithMeeting` يُبلّغ بنفسه بعد النداء
     («لقاءٌ جديد… ورابطُ الانضمام») فلا تُرسَل رسالتان عن شيءٍ واحد. */
  async attachApiZoom(
    actorId: string, sessionId: string,
    preloaded?: Awaited<ReturnType<typeof getZoomConfig>>,
    announce = true,
  ) {
    const session = await this.prisma.cohortSession.findUnique({
      where: { id: sessionId },
      include: { zoom: true, cohort: { select: { title: true, timezone: true } } },
    })
    if (!session) throw new AuthError('not_found', 'الجلسة غير موجودة', 404)
    if (session.zoom) throw new AuthError('already_linked', 'الجلسة مرتبطة باجتماع مسبقا', 409)

    const config = preloaded ?? await getZoomConfig(this.prisma)
    if (!zoomReady(config)) {
      throw new AuthError('zoom_not_configured', `تكاملُ Zoom غير مكتمل — ينقصه: ${zoomMissing(config).join(' · ')}`, 409)
    }
    /* المدّةُ من الجلسة نفسِها، وساعتان حين لا نهايةَ لها — لا رقمٌ يُخمَّن في Zoom */
    const durationMinutes = session.endsAt
      ? Math.max(15, Math.round((session.endsAt.getTime() - session.startsAt.getTime()) / 60_000))
      : 120
    const meeting = await createZoomMeeting(config, {
      topic: `${session.cohort.title} — ${session.title}`,
      startsAt: session.startsAt,
      durationMinutes,
      timezone: session.timezone ?? session.cohort.timezone ?? undefined,
    })
    const zoom = await this.prisma.zoomMeeting.create({
      data: {
        sessionId, provider: 'zoom_api',
        joinUrl: meeting.joinUrl,
        meetingId: meeting.meetingId || null,
        passcodeEnc: meeting.passcode,
        /* `startUrl` **لا يُحفظ**: من يملكه يبدأ الاجتماعَ مضيفا، وهو أخطرُ من
           الرمز. والمضيفُ يبدأ من حسابه أو من الرابط نفسِه بصلاحيّته. */
        learnerUrl: null,
        createdBy: actorId,
      },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'zoom.create_api', entityType: 'cohort_session', entityId: sessionId,
      meta: { meetingId: meeting.meetingId, durationMinutes, autoRecording: meeting.autoRecording },
    })
    /* ورابطٌ لكلّ مسجَّلٍ بعد الإنشاء — لا يُسقط الجلسةَ إن تعذّر */
    if (meeting.meetingId) await this.linkRegistrants(sessionId, meeting.meetingId, config)
    if (announce) await this.notifyMeetingLinked(sessionId)
    return zoom
  }

  /* ── رابطُ دخولٍ لكلّ متعلّم ──

     وهو ما يجعل الحضورَ قابلا للقياس: تقريرُ Zoom بعد اللقاء يحمل بريدَ
     **المسجَّل**، فيُطابَق بصاحبه. وبلا تسجيلٍ يعود اسمٌ كتبه صاحبُه بيده
     ولا يُطابَق بأحد.

     ولا يرمي: التسجيلُ المسبق ليس في كلّ حساب، والاجتماعُ قائمٌ يعمل بلا.
     فيُكتب ما جرى في `syncState` و`syncError` — والشاشةُ تقول «الحضورُ هنا
     يدويّ، وهذا سببه» بدل صمتٍ يُظنّ معه أنّ العدّ يجري. */
  /** يُنادى بعد إنشاء الاجتماع، وبعد كلّ التحاقٍ جديدٍ بشعبةٍ لها جلساتٌ قائمة */
  async ensureSessionJoinLinks(sessionId: string) {
    const zoom = await this.prisma.zoomMeeting.findUnique({ where: { sessionId } })
    /* لا اجتماعَ آليّا: لا مسجَّلين أصلا — واليدويُّ رابطٌ واحدٌ مشترك */
    if (!zoom || zoom.provider !== 'zoom_api' || !zoom.meetingId) return { linked: 0, reason: null }
    const config = await getZoomConfig(this.prisma)
    if (!zoomReady(config)) return { linked: 0, reason: null }
    return this.linkRegistrants(sessionId, zoom.meetingId, config)
  }

  private async linkRegistrants(
    sessionId: string, meetingId: string, config: Awaited<ReturnType<typeof getZoomConfig>>,
  ): Promise<{ linked: number; reason: string | null }> {
    const learners = await this.prisma.enrollment.findMany({
      where: { cohort: { sessions: { some: { id: sessionId } } }, status: { notIn: ['dropped', 'waitlisted'] } },
      select: { id: true, user: { select: { email: true, displayName: true } } },
    })
    let linked = 0
    let reason: string | null = null
    for (const e of learners) {
      if (!e.user?.email) continue
      /* الموجودُ لا يُعاد تسجيلُه: تُستدعى هذه عند الإنشاء وعند كلّ التحاقٍ جديد */
      const already = await this.prisma.sessionJoinLink.findUnique({
        where: { sessionId_enrollmentId: { sessionId, enrollmentId: e.id } },
      })
      if (already) continue
      const r = await registerZoomParticipant(config, meetingId, {
        email: e.user.email,
        firstName: e.user.displayName || e.user.email.split('@')[0],
      })
      if (!r.ok) {
        /* أوّلُ سببٍ يكفي: الرفضُ من نوع الحساب لا من هذا المتعلّم، فمحاولةُ
           الثلاثين تعطي ثلاثين نداءً وسببا واحدا مكرَّرا. */
        reason = r.reason
        break
      }
      await this.prisma.sessionJoinLink.create({
        data: {
          sessionId, enrollmentId: e.id,
          registrantId: r.registrant.registrantId,
          joinUrl: r.registrant.joinUrl,
        },
      })
      linked += 1
    }
    await this.prisma.zoomMeeting.update({
      where: { sessionId },
      data: reason ? { syncState: 'failed', syncError: reason } : { syncState: 'synced', syncError: null },
    })
    return { linked, reason }
  }

  /* ═══ ورابطٌ أُلصق بلقاءٍ قائمٍ خبرٌ لمن يحضره (ي-٤) ═══

     `addSessionWithMeeting` يولد الجلسةَ ورابطَها معا فيُخبر عنهما رسالةٌ
     واحدة. أمّا **الإلصاقُ على لقاءٍ أُعلن من قبلُ بلا رابط** — وهو ما تفعله
     طريقا الإدارة — فكان يقع صامتا تماما: يُفتح بابُ الغرفة ولا يعلم به من
     يحضرها. ولم تكن في المنصّة كلِّها رسالةُ «صار للقاء رابط»: تذكيرا
     اليومِ والساعةِ يقولان «رابطُ الانضمام في صفحة الجلسة» ولا يحملانه،
     ولا يقعان إلّا قبل الموعد.

     والعددُ ليس صغيرا: كلُّ مسجَّلٍ غيرِ منسحبٍ في الشعبة — عشرون في الوسطى
     — ومعهم مدرّبوها.

     ولمَ مفتاحان لا واحد: المتعلّمُ يُبلَّغ في صنف «مواعيدُ الجلسات» ويجوز
     كتمُه (والموعدُ يبقى في جدوله على كلّ حال)، والمدرّبُ في «عملي» ولا
     يُكتَم — «حصّةُ المتعلّم موعدٌ له، وحصّةُ المدرّب موعدٌ عليه»، وهي
     القسمةُ نفسُها التي فرّقت `session.reminder` عن `session.reminder.trainer`. */
  private async notifyMeetingLinked(sessionId: string): Promise<void> {
    const session = await this.prisma.cohortSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true, title: true, startsAt: true, cohortId: true,
        cohort: { select: { title: true, trainers: { select: { profile: { select: { userId: true } } } } } },
      },
    })
    if (!session) return
    const when = fmtDateWith(session.startsAt, {
      weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit',
    })
    const learners = await this.prisma.enrollment.findMany({
      where: { cohortId: session.cohortId, status: { not: 'dropped' } },
      select: { userId: true },
    })
    const data = { cohortId: session.cohortId, sessionId: session.id }
    for (const r of learners) {
      await safeNotify(this.prisma, {
        userId: r.userId, channel: 'in_app', audience: 'learner',
        templateKey: 'cohort.meeting.linked',
        title: `صار للقاء رابطُ انضمام — ${session.cohort.title}`,
        body: `${session.title} — ${when}. تجد رابطَ الانضمام في صفحة رحلتك قبل موعده.`,
        data,
      })
    }
    for (const t of session.cohort.trainers) {
      if (!t.profile?.userId) continue
      await safeNotify(this.prisma, {
        userId: t.profile.userId, channel: 'in_app', audience: 'trainer',
        templateKey: 'cohort.meeting.linked.trainer',
        title: `صار للقاء رابطُ انضمام — ${session.cohort.title}`,
        body: `${session.title} — ${when}. تجد رابطَ الانضمام في جدولك.`,
        data,
      })
    }
  }

  /** يُبلَّغ كلُّ مسجَّلٍ في الشعبة — والعددُ يعود كي تقوله الشاشةُ لا تخمّنه */
  private async notifyCohortOfSession(
    cohortId: string,
    session: { id: string; title: string; startsAt: Date },
    zoom: { joinUrl: string } | null,
  ): Promise<number> {
    const cohort = await this.prisma.cohort.findUnique({ where: { id: cohortId }, select: { title: true } })
    const recipients = await this.prisma.enrollment.findMany({
      where: { cohortId, status: { not: 'dropped' } },
      select: { userId: true },
    })
    /* التنسيقُ من الطبقة المشتركة لا بلغةٍ تُسمّى هنا — وبوّابةُ `audit-locale`
       تمنع أن يعود الاختيارُ إلى الملفّات، وقد أمسكت هذا السطرَ بعينه. */
    const when = fmtDateWith(session.startsAt, {
      weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit',
    })
    for (const r of recipients) {
      await safeNotify(this.prisma, {
        userId: r.userId, channel: 'in_app', audience: 'learner',
        templateKey: 'cohort.session.scheduled',
        title: `لقاءٌ جديدٌ في ${cohort?.title ?? 'شعبتك'}`,
        body: zoom
          ? `${session.title} — ${when}. رابطُ الانضمام في صفحة رحلتك.`
          : `${session.title} — ${when}.`,
        data: { cohortId, sessionId: session.id, hasMeeting: Boolean(zoom) },
      })
    }
    return recipients.length
  }

  /* ── المواد والتسجيلات — تخزين خاص وروابط موقعة ── */

  async registerMaterial(actorId: string, cohortId: string, input: {
    title: string; kind: string; moduleId?: string; externalUrl?: string
    file?: { originalName: string; mime: string; sizeBytes: number }
  }) {
    const cohort = await this.prisma.cohort.findUnique({ where: { id: cohortId } })
    if (!cohort) throw new AuthError('not_found', 'الشعبة غير موجودة', 404)
    let storageKey: string | undefined
    let uploadUrl: string | undefined
    if (input.file) {
      assertFileUploadsEnabled('أضف المادّة برابطٍ خارجيّ حتّى يجهز مخزنُ الملفّات.')
      const max = MAX_COHORT_MEDIA_BYTES
      if (input.file.sizeBytes <= 0 || input.file.sizeBytes > max) throw new AuthError('too_large', 'الملف يتجاوز الحد المسموح', 413)
      storageKey = newStorageKey()
      const exp = Date.now() + SIGNED_URL_TTL_MS
      uploadUrl = `/api/v1/uploads/${storageKey}?exp=${exp}&sig=${signKey(storageKey, exp, 'write')}`
    }
    const material = await this.prisma.learningMaterial.create({
      data: {
        cohortId, title: input.title, kind: input.kind, moduleId: input.moduleId,
        storageKey, externalUrl: input.externalUrl, createdBy: actorId,
      },
    })
    await recordAudit(this.prisma, { actorId, action: 'material.register', entityType: 'cohort', entityId: cohortId, meta: { materialId: material.id } })
    return { material, uploadUrl }
  }

  async registerRecording(actorId: string, sessionId: string, input: {
    title: string; moduleId?: string; mime: string; sizeBytes: number; durationSec?: number
  }) {
    const session = await this.prisma.cohortSession.findUnique({ where: { id: sessionId } })
    if (!session) throw new AuthError('not_found', 'الجلسة غير موجودة', 404)
    assertFileUploadsEnabled('الصق رابطَ التسجيل من Zoom أو منصّةِ الفيديو كمادّةٍ للشعبة.')
    if (input.sizeBytes <= 0 || input.sizeBytes > MAX_COHORT_MEDIA_BYTES) {
      throw new AuthError('too_large', 'الملف يتجاوز الحد المسموح', 413)
    }
    const storageKey = newStorageKey()
    const recording = await this.prisma.recording.create({
      data: {
        sessionId, moduleId: input.moduleId, title: input.title, storageKey,
        mime: input.mime, sizeBytes: input.sizeBytes, durationSec: input.durationSec, createdBy: actorId,
      },
    })
    const exp = Date.now() + SIGNED_URL_TTL_MS
    await recordAudit(this.prisma, { actorId, action: 'recording.register', entityType: 'cohort_session', entityId: sessionId, meta: { recordingId: recording.id } })
    return { recording, uploadUrl: `/api/v1/uploads/${storageKey}?exp=${exp}&sig=${signKey(storageKey, exp, 'write')}` }
  }

  /** أرشفة/تعطيل مادة أو تسجيل */
  /* محتوى الشعبة — الموادُّ والتسجيلاتُ بأسمائها وحالاتها.

     الأرشفةُ كانت تطلب «معرّف المحتوى (UUID)» ونوعَه، ولا شاشةَ تعرض
     محتوى الشعبة أصلا: فالإداريُّ يضيف مادّةً ولا يراها بعدها أبدا، ولا
     سبيلَ إلى أرشفةِ واحدةٍ إلّا بمعرّفٍ يُستخرج من القاعدة.

     والتسجيلاتُ تُقرأ عبر جلساتها لأنّها معلَّقةٌ بالجلسة لا بالشعبة —
     ويُذكَر معها عنوانُ جلستها كي يُعرف أيُّ لقاءٍ هو. */
  async contentFor(cohortId: string) {
    const cohort = await this.prisma.cohort.findUnique({ where: { id: cohortId }, select: { id: true } })
    if (!cohort) throw new AuthError('not_found', 'الشعبة غير موجودة', 404)
    const [materials, recordings] = await Promise.all([
      this.prisma.learningMaterial.findMany({
        where: { cohortId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, kind: true, status: true, createdAt: true },
      }),
      this.prisma.recording.findMany({
        where: { session: { cohortId } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, title: true, status: true, durationSec: true, createdAt: true,
          session: { select: { title: true, startsAt: true } },
        },
      }),
    ])
    return {
      materials: materials.map((m) => ({
        id: m.id, title: m.title, kind: m.kind, status: m.status, createdAt: m.createdAt,
      })),
      recordings: recordings.map((r) => ({
        id: r.id, title: r.title, status: r.status, durationSec: r.durationSec,
        createdAt: r.createdAt, sessionTitle: r.session.title, sessionStartsAt: r.session.startsAt,
      })),
    }
  }

  async setContentStatus(actorId: string, kind: 'material' | 'recording', id: string, status: 'active' | 'archived' | 'disabled') {
    if (kind === 'material') await this.prisma.learningMaterial.update({ where: { id }, data: { status } })
    else await this.prisma.recording.update({ where: { id }, data: { status } })
    await recordAudit(this.prisma, { actorId, action: `content.${status}`, entityType: kind, entityId: id })
  }

  /** رابط قراءة موقع للمحتوى — يُستدعى بعد فحص حق الوصول في طبقة المسارات */
  signedReadUrl(storageKey: string): string {
    const exp = Date.now() + SIGNED_URL_TTL_MS
    return `/api/v1/documents/${storageKey}?exp=${exp}&sig=${signKey(storageKey, exp, 'read')}`
  }
}
