/* خدمة الشعب — إنشاء، جدولة، فتح مشروط، منع تعارض المدرب، سعة.
   شروط الفتح الستة: دورة منشورة + مدرب معتمد مؤهل + جدول + سعة + خطة تقديم + إعداد مالي.
   الحالات: draft | open | full | active | completed | cancelled. */

import { notifyPlanWaiters } from './catalog-readiness.service'
import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { EarningsService } from './earnings.service'
import { newStorageKey, signKey, SIGNED_URL_TTL_MS, assertFileUploadsEnabled, MAX_COHORT_MEDIA_BYTES } from './storage.service'
import { LEDGER_CURRENCY } from '../../src/application/commerce/presentment'
import { DAY_CODES } from '../../src/application/schedule/days'

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
      trainers: c.trainers.map((t) => ({ profileId: t.profileId, name: t.profile.application.fullName, role: t.role })),
    }))
  }

  async create(actorId: string, input: {
    courseId: string; pathwayId?: string; title: string
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
  async assignTrainer(cohortId: string, profileId: string, actorId: string, role: 'lead' | 'assistant' = 'lead') {
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
    return profiles.map((p) => {
      const q = p.qualifications[0]
      return {
        profileId: p.id,
        name: p.application.fullName,
        qualification: (q?.status ?? 'none') as 'qualified' | 'pending' | 'rejected' | 'retired' | 'none',
        qualificationId: q?.id ?? null,
        assignedRole: (cohortId ? p.cohortTrainers[0]?.role : null) ?? null,
      }
    })
  }

  /** تعارض جدول المدرب: جلستان متداخلتان في شعبتين غير ملغاتين/منتهيتين */
  private async assertNoScheduleConflict(profileId: string, sessions: { startsAt: Date; endsAt: Date | null }[], ignoreCohortId?: string) {
    if (!sessions.length) return
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

  /** فحص شروط الفتح الستة — يعيد قائمة النواقص دون تغيير حالة */
  async openChecklist(cohortId: string) {
    const cohort = await this.prisma.cohort.findUnique({
      where: { id: cohortId },
      include: { course: true, trainers: true, sessions: true, plans: true },
    })
    if (!cohort) throw new AuthError('not_found', 'الشعبة غير موجودة', 404)
    const missing: string[] = []
    if (cohort.course.status !== 'published') missing.push('الدورة ليست منشورة')
    const leadOk = await this.hasQualifiedLead(cohort)
    if (!leadOk) missing.push('لا مدرب معتمدا ومؤهلا للدورة')
    if (!cohort.sessions.length) missing.push('لا جدول جلسات')
    if (!cohort.capacity || cohort.capacity < 1) missing.push('لا سعة محددة')
    if (!cohort.plans.some((p) => ['approved', 'published'].includes(p.status)) && !cohort.plans.length) {
      missing.push('لا خطة تقديم للشعبة')
    }
    if (!cohort.financialReady || cohort.price === null) missing.push('الإعداد المالي غير مكتمل (السعر والعملة)')
    return { ready: missing.length === 0, missing }
  }

  private async hasQualifiedLead(cohort: { courseId: string; trainers: { profileId: string; role: string }[] }): Promise<boolean> {
    for (const t of cohort.trainers.filter((x) => x.role === 'lead')) {
      const profile = await this.prisma.trainerProfile.findUnique({
        where: { id: t.profileId }, include: { application: true },
      })
      if (!profile || profile.suspendedAt || profile.application.status !== 'active') continue
      const qual = await this.prisma.trainerCourseQualification.findUnique({
        where: { profileId_courseId: { profileId: t.profileId, courseId: cohort.courseId } },
      })
      if (qual?.status === 'qualified') return true
    }
    return false
  }

  /** فتح الشعبة — يرفض بقائمة النواقص إن لم تكتمل الشروط */
  async open(cohortId: string, actorId: string) {
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

     وما لا تفعله بقصد: لا تفتح شعبةً — الفتحُ يمرّ بشروطه الستّة وبقرار
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
  }) {
    const cohort = await this.prisma.cohort.findUnique({ where: { id: cohortId }, include: { trainers: true } })
    if (!cohort) throw new AuthError('not_found', 'الشعبة غير موجودة', 404)
    if (['completed', 'cancelled'].includes(cohort.status)) throw new AuthError('bad_state', 'لا جلسات لشعبة منتهية', 409)
    /* الجلسة الجديدة لا تتعارض مع جداول مدربي الشعبة في شعب أخرى */
    for (const t of cohort.trainers) {
      await this.assertNoScheduleConflict(t.profileId, [{ startsAt: input.startsAt, endsAt: input.endsAt ?? null }], cohortId)
    }
    const session = await this.prisma.cohortSession.create({
      data: { cohortId, title: input.title, startsAt: input.startsAt, endsAt: input.endsAt, timezone: input.timezone, moduleId: input.moduleId },
    })
    await recordAudit(this.prisma, { actorId, action: 'cohort.session.add', entityType: 'cohort', entityId: cohortId, meta: { sessionId: session.id } })
    return session
  }

  /* ═══ توليدُ الجلسات من الجدول الأسبوعيّ ═══

     الجدولُ كان محفوظا مرّتين بلا رابط: حقولُ النمط في الشعبة (`daysOfWeek`
     و`startTime`) وصفوفُ الجلسات. فالموظّفُ يعبّئ النمطَ ثمّ يضيف ستّةَ عشرَ
     صفًّا بيده، وأيُّ اختلافٍ بينهما لا يكشفه شيء. والحقيقةُ صفوفُ الجلسات —
     لأنّها ما يراه المتعلّمُ ويُربَط باجتماعه وحضورِه — والنمطُ مولِّدُها.

     ولا يُكتب شيءٌ إلّا بطلبٍ صريح: `preview` يعرض ما سيُنشأ أوّلا. */
  async generateSessions(actorId: string, cohortId: string, input: {
    weeks: number
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
        startsAt.setUTCDate(weekStart.getUTCDate() + w * 7 + DAY_INDEX[day])
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
  }) {
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
    return zoom
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
