/* ملكيّةُ الشعبة — المدرّبُ يجهّزها ويقول «أوافق»، والإدارةُ تعتمد.

   ═══ ما كان ═══

   للمدرّب أن **يقترح**: صفٌّ في `TrainerChangeRequest` يقول «غيّروا عنوانَ
   الوحدة الثانية»، ينتظر في طابورٍ عند الإدارة، ثمّ يُنشَر خطّةً. فمن يقف في
   اللقاء ويعرف مادّتَه لا يملك أن يرتّبها — يملك أن يطلب من غيره أن يرتّبها.

   ═══ القرار ═══

   قرارُ صاحب المنصّة (٨ سبتمبر ٢٠٢٦): الشعبةُ ملكُ مدرّبها. يعدّل كلَّ شيء —
   الاسمَ والمواعيدَ والمحاورَ والتطبيقَ العمليَّ والمصادرَ واللقاءاتِ
   والتسجيلات — **عدا السعر**. ثمّ يقول «أوافق على كلّ ما في الشعبة» ويرسلها،
   فيعتمدها المديرُ الأكاديميُّ أو المديرُ الأعلى — أيُّهما سبق. ولا اقتراحَ:
   «ليس اقتراحا بل واجبٌ عليه».

   ═══ أين تسكن ═══

   في `CohortDeliveryPlan` نفسِه — الصفُّ الذي كانت الاقتراحاتُ تُنشَر فيه،
   وشرطُ فتحِ الشعبة الخامس. فخطّةُ المدرّب المعتمَدةُ تُوفي الشرطَ الذي كان لا
   يُوفى إلّا باقتراحٍ يُنشَر. و`content` يحمل ما يعدّله: `{ kind: 'trainer',
   modules, resources, summaryAr, liveNoteAr }` — لا يمسّ الكتالوج، فالمحاورُ
   المعدَّلة تخصّ هذه الشعبةَ وحدَها.

   ═══ والسعرُ ليس «حقلا لا يُعرَض» بل حقلٌ يُردّ ═══

   لو اكتفت الشاشةُ بإخفائه لكتبه من عرف اسمَه في النداء. فالخدمةُ تردّ أيَّ
   مفتاحٍ ماليٍّ صراحةً — `price` و`currency` و`capacity` و`registrationOpen`
   و`financialReady` — والشاشةُ تقول إنّه بيد الإدارة. */

import type { Prisma, PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { CohortService } from './cohort.service'
import { notifyRole, safeNotify, sendDirectEmail, publicSiteUrl } from './notification.service'
import { renderMail } from './mail-template'
import { readableModuleVersion } from '../catalog/module-version-visibility'

/* ─────────── ما يعدّله المدرّب في محتوى الشعبة ─────────── */

export interface TrainerPlanModule {
  moduleId: string
  titleAr: string
  outcomeAr?: string | null
  activityAr?: string | null
  artifactAr?: string | null
  bodyAr?: string | null
}
export interface TrainerPlanResource { title: string; url: string; noteAr?: string | null }
export interface TrainerPlanContent {
  kind: 'trainer'
  summaryAr?: string | null
  modules: TrainerPlanModule[]
  resources: TrainerPlanResource[]
  liveNoteAr?: string | null
}

/** ما يجوز للمدرّب تعديلُه في صفّ الشعبة نفسِه — والباقي بيد الإدارة */
export const TRAINER_EDITABLE_COHORT_FIELDS = [
  'title', 'startsAt', 'endsAt', 'daysOfWeek', 'startTime', 'timezone', 'language', 'deliveryMode',
] as const
export type TrainerCohortPatch = Partial<{
  title: string; startsAt: Date; endsAt: Date; daysOfWeek: string[]; startTime: string; timezone: string
  language: string; deliveryMode: string
}>

/** الحقولُ الماليّةُ التي تُردّ صراحةً لا تُهمَل بصمت */
const ADMIN_ONLY_FIELDS = ['price', 'currency', 'capacity', 'registrationOpen', 'financialReady'] as const

export const PLAN_STATUSES = ['draft', 'submitted', 'changes_requested', 'approved', 'published', 'superseded'] as const
export type PlanStatus = (typeof PLAN_STATUSES)[number]

export class CohortPlanService {
  private prisma: PrismaClient
  private cohorts: CohortService
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.cohorts = new CohortService(prisma)
  }

  /* ─────────── الملكيّة ─────────── */

  /** ملفُّ المدرّب النشط، أو ٤٠٣ */
  private async profileOf(userId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { userId },
      include: { application: { select: { fullName: true, email: true } } },
    })
    if (!profile || profile.suspendedAt) throw new AuthError('not_trainer', 'لا ملف مدرب نشطا لهذا الحساب', 403)
    return profile
  }

  /** الشعبةُ إن كان مُسنَدا إليها — وإلّا ٤٠٣ لا ٤٠٤: وجودُها ليس شأنَه */
  private async ownedCohort(userId: string, cohortId: string) {
    const profile = await this.profileOf(userId)
    const link = await this.prisma.cohortTrainer.findFirst({ where: { cohortId, profileId: profile.id } })
    if (!link) throw new AuthError('not_your_cohort', 'هذه الشعبة ليست مُسنَدةً إليك', 403)
    return { profile, link }
  }

  /** آخرُ خطّةٍ كتبها مدرّبٌ لهذه الشعبة — لا خطّةُ الإدارة الأساسيّة ولا أثرُ اقتراحٍ قديم */
  private latestTrainerPlan(cohortId: string) {
    return this.prisma.cohortDeliveryPlan.findFirst({
      where: { cohortId, trainerId: { not: null } },
      orderBy: { createdAt: 'desc' },
    })
  }

  /* ─────────── الورشة: كلُّ ما يحتاجه ليعرف ماذا يفعل ─────────── */

  async workspace(userId: string, cohortId: string) {
    const { profile, link } = await this.ownedCohort(userId, cohortId)
    const cohort = await this.prisma.cohort.findUniqueOrThrow({
      where: { id: cohortId },
      include: {
        course: {
          include: {
            versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true, version: true } },
            modules: {
              where: { status: { not: 'archived' } },
              orderBy: { createdAt: 'asc' },
              include: { versions: { ...readableModuleVersion(), take: 1 } },
            },
          },
        },
        sessions: { orderBy: { startsAt: 'asc' }, include: { zoom: { select: { joinUrl: true } }, recordings: { where: { status: 'active' } } } },
        materials: { where: { status: 'active' }, orderBy: { createdAt: 'asc' } },
        enrollments: {
          where: { status: { not: 'dropped' } },
          include: { user: { select: { displayName: true } }, courseProgress: { select: { percent: true } } },
        },
      },
    })
    const plan = await this.latestTrainerPlan(cohortId)
    const content = (plan?.content ?? null) as TrainerPlanContent | null

    /* المحاورُ الأساسيّة من الكتالوج — يبدأ منها المدرّبُ إن لم يكتب بعد */
    const baseModules: TrainerPlanModule[] = cohort.course.modules.map((m) => {
      const v = m.versions[0]
      return {
        moduleId: m.id, titleAr: v?.titleAr ?? m.id,
        outcomeAr: v?.outcomeAr ?? null, activityAr: v?.activityAr ?? null,
        artifactAr: v?.artifactAr ?? null, bodyAr: v?.bodyAr ?? null,
      }
    })

    /* ═══ قائمةُ «ماذا أفعل» — تُحسب لا تُكتب ═══

       كلُّ بندٍ حالتُه من الواقع: العنوانُ والمواعيدُ من صفّ الشعبة، والمحاورُ
       والمصادرُ من الخطّة، واللقاءاتُ من الجدول. فلا يُقال «تمّ» عن شيءٍ لم
       يقع، ولا يبقى «لم يتمّ» عن شيءٍ وقع. */
    const identityDone = cohort.title.trim().length >= 3 && Boolean(cohort.startsAt) && cohort.daysOfWeek.length > 0 && Boolean(cohort.startTime)
    const modulesDone = (content?.modules?.length ?? 0) > 0
    const resourcesDone = (content?.resources?.length ?? 0) > 0
    const sessionsDone = cohort.sessions.length > 0
    const recordingsDone = cohort.sessions.some((s) => s.recordings.length > 0)
    const status = (plan?.status ?? 'draft') as PlanStatus
    const approvalDone = status === 'approved' || status === 'published'
    const checklist = [
      { key: 'identity', labelAr: 'راجع اسمَ الشعبة ومواعيدها', done: identityDone, optional: false },
      { key: 'modules', labelAr: 'رتّب المحاورَ والتطبيقَ العمليّ', done: modulesDone, optional: false },
      { key: 'resources', labelAr: 'أضف المصادرَ التي يحتاجها المتعلّم', done: resourcesDone, optional: false },
      { key: 'sessions', labelAr: 'حدّد مواعيدَ اللقاءات المباشرة', done: sessionsDone, optional: false },
      { key: 'recordings', labelAr: 'ارفع الجلساتِ المسجّلة — إن وُجدت', done: recordingsDone, optional: true },
      { key: 'approval', labelAr: 'أكّد أنّك توافق على كلّ ما فيها وأرسلها للاعتماد', done: approvalDone, optional: false },
    ]

    return {
      role: link.role,
      trainer: { name: profile.application.fullName },
      cohort: {
        id: cohort.id, title: cohort.title, status: cohort.status,
        startsAt: cohort.startsAt, endsAt: cohort.endsAt, daysOfWeek: cohort.daysOfWeek, startTime: cohort.startTime,
        timezone: cohort.timezone, language: cohort.language, deliveryMode: cohort.deliveryMode,
        /* يُقرأ ولا يُكتب — ويُقال ذلك في الشاشة */
        readOnly: { price: cohort.price === null ? null : Number(cohort.price), currency: cohort.currency, capacity: cohort.capacity },
      },
      course: { id: cohort.course.id, titleAr: cohort.course.versions[0]?.titleAr ?? cohort.course.id, baseModules },
      plan: plan
        ? {
            id: plan.id, status, content, reviewerNote: plan.reviewerNote,
            submittedAt: plan.submittedAt, trainerConfirmedAt: plan.trainerConfirmedAt, reviewedAt: plan.reviewedAt,
          }
        : null,
      sessions: cohort.sessions.map((s) => ({
        id: s.id, title: s.title, startsAt: s.startsAt, endsAt: s.endsAt, status: s.status, moduleId: s.moduleId,
        joinUrl: s.zoom?.joinUrl ?? null,
        recordings: s.recordings.map((r) => ({
          id: r.id, title: r.title, externalUrl: r.externalUrl,
          readUrl: r.storageKey ? this.cohorts.signedReadUrl(r.storageKey) : null,
        })),
      })),
      materials: cohort.materials.map((m) => ({
        id: m.id, title: m.title, kind: m.kind, externalUrl: m.externalUrl,
        readUrl: m.storageKey ? this.cohorts.signedReadUrl(m.storageKey) : null,
      })),
      /* الاسمُ والتقدّم — لا بريدَ ولا رقما: المنصّةُ هي القناة */
      learners: cohort.enrollments.map((e) => ({
        enrollmentId: e.id, name: e.user.displayName, status: e.status, progress: e.courseProgress?.percent ?? 0,
      })),
      checklist,
    }
  }

  /* ─────────── الكتابة ─────────── */

  /** حفظُ المحتوى مسودّةً — ولا يُكتب فوق ما يُنتظر اعتمادُه */
  async savePlan(userId: string, cohortId: string, content: TrainerPlanContent) {
    const { profile } = await this.ownedCohort(userId, cohortId)
    const latest = await this.latestTrainerPlan(cohortId)
    if (latest?.status === 'submitted') {
      throw new AuthError('plan_submitted', 'خطّتك بانتظار الاعتماد — انتظر القرار، أو اطلب من الإدارة ردَّها إليك لتعديلها', 409)
    }
    const data = { content: content as unknown as Prisma.InputJsonValue }
    const plan = latest && (latest.status === 'draft' || latest.status === 'changes_requested')
      ? await this.prisma.cohortDeliveryPlan.update({ where: { id: latest.id }, data })
      : await this.prisma.cohortDeliveryPlan.create({
          data: { cohortId, trainerId: profile.id, status: 'draft', createdBy: userId, ...data },
        })
    await recordAudit(this.prisma, {
      actorId: userId, action: 'cohort.plan.save', entityType: 'cohort', entityId: cohortId,
      meta: { planId: plan.id, modules: content.modules.length, resources: content.resources.length },
    })
    return plan
  }

  /** تعديلُ صفّ الشعبة — بالمسموح وحدَه، والماليُّ يُردّ باسمه */
  async updateCohort(userId: string, cohortId: string, patch: Record<string, unknown>) {
    await this.ownedCohort(userId, cohortId)
    const forbidden = Object.keys(patch).filter((k) => (ADMIN_ONLY_FIELDS as readonly string[]).includes(k))
    if (forbidden.length) {
      throw new AuthError('admin_only_field', `السعرُ والسعةُ والإعدادُ الماليُّ بيد الإدارة — لا يعدّلها المدرّب (${forbidden.join('، ')})`, 403)
    }
    const allowed: Record<string, unknown> = {}
    for (const k of TRAINER_EDITABLE_COHORT_FIELDS) if (k in patch) allowed[k] = patch[k]
    if (Object.keys(allowed).length === 0) throw new AuthError('nothing_to_update', 'لا حقلَ يُعدَّل', 400)
    const row = await this.cohorts.update(userId, cohortId, allowed as TrainerCohortPatch)
    await recordAudit(this.prisma, {
      actorId: userId, action: 'cohort.trainer_update', entityType: 'cohort', entityId: cohortId,
      meta: { fields: Object.keys(allowed) },
    })
    return row
  }

  /** «أوافق على كلّ ما في الشعبة» — ثمّ تُرسَل */
  async submit(userId: string, cohortId: string, confirm: boolean) {
    const { profile } = await this.ownedCohort(userId, cohortId)
    if (!confirm) throw new AuthError('confirm_required', 'أكّد أنّك توافق على كلّ ما في الشعبة قبل إرسالها', 400)
    const latest = await this.latestTrainerPlan(cohortId)
    if (!latest) throw new AuthError('no_plan', 'لا محتوى بعد — رتّب المحاورَ والمصادرَ أوّلا', 409)
    if (latest.status === 'submitted') throw new AuthError('already_submitted', 'أُرسلت من قبل وهي بانتظار الاعتماد', 409)
    if (latest.status === 'approved' || latest.status === 'published') {
      throw new AuthError('already_approved', 'هذه الخطّة معتمَدة — عدّلها لتُنشأ نسخةٌ جديدة ثمّ أرسلها', 409)
    }
    const content = latest.content as unknown as TrainerPlanContent
    if (!content?.modules?.length) throw new AuthError('no_modules', 'لا محاورَ في الخطّة — رتّبها أوّلا', 409)

    const now = new Date()
    const plan = await this.prisma.cohortDeliveryPlan.update({
      where: { id: latest.id },
      data: { status: 'submitted', submittedAt: now, trainerConfirmedAt: now, reviewerNote: null },
    })
    const cohort = await this.prisma.cohort.findUniqueOrThrow({ where: { id: cohortId }, select: { title: true } })
    await recordAudit(this.prisma, {
      actorId: userId, action: 'cohort.plan.submit', entityType: 'cohort', entityId: cohortId, meta: { planId: plan.id },
    })
    /* من يملك الاعتمادَ يُخبَر — الأكاديميُّ والأعلى معا، وأيُّهما سبق قرّر */
    await notifyRole(this.prisma, ['academic_manager', 'super_admin'], {
      channel: 'in_app',
      title: 'خطّةُ شعبةٍ بانتظار اعتمادك',
      body: `${profile.application.fullName} أرسل خطّةَ «${cohort.title}» وأكّد موافقتَه على كلّ ما فيها — راجعها من بطاقة الشعبة.`,
      templateKey: 'cohort.plan.submitted',
      data: { cohortId, planId: plan.id },
    })
    return plan
  }

  /* ─────────── الاعتماد ─────────── */

  async pending() {
    const rows = await this.prisma.cohortDeliveryPlan.findMany({
      where: { status: 'submitted' },
      orderBy: { submittedAt: 'asc' },
      include: {
        cohort: { select: { id: true, title: true, courseId: true } },
        trainer: { select: { id: true, application: { select: { fullName: true } } } },
      },
    })
    return rows.map((p) => ({
      id: p.id, cohort: p.cohort, trainerName: p.trainer?.application.fullName ?? '—',
      submittedAt: p.submittedAt, trainerConfirmedAt: p.trainerConfirmedAt,
    }))
  }

  /** آخرُ خطّةِ مدرّبٍ لشعبةٍ — لبطاقة الشعبة عند الإدارة */
  async latestForCohort(cohortId: string) {
    const plan = await this.latestTrainerPlan(cohortId)
    if (!plan) return null
    const trainer = plan.trainerId
      ? await this.prisma.trainerProfile.findUnique({ where: { id: plan.trainerId }, select: { application: { select: { fullName: true } } } })
      : null
    return {
      id: plan.id, status: plan.status, content: plan.content, reviewerNote: plan.reviewerNote,
      submittedAt: plan.submittedAt, trainerConfirmedAt: plan.trainerConfirmedAt, reviewedAt: plan.reviewedAt,
      trainerName: trainer?.application.fullName ?? null,
    }
  }

  async decide(actorId: string, planId: string, approve: boolean, note?: string) {
    const plan = await this.prisma.cohortDeliveryPlan.findUnique({
      where: { id: planId },
      include: { cohort: { select: { id: true, title: true } }, trainer: { include: { application: { select: { fullName: true, email: true } } } } },
    })
    if (!plan) throw new AuthError('not_found', 'الخطّة غير موجودة', 404)
    if (plan.status !== 'submitted') throw new AuthError('not_submitted', 'هذه الخطّة ليست بانتظار قرار', 409)
    const now = new Date()

    if (!approve) {
      if (!note?.trim()) throw new AuthError('reason_required', 'قل له ما الذي يُعدَّل — الردُّ بلا سببٍ يترك المدرّبَ يخمّن', 400)
      await this.prisma.cohortDeliveryPlan.update({
        where: { id: planId }, data: { status: 'changes_requested', reviewedBy: actorId, reviewedAt: now, reviewerNote: note.trim() },
      })
      await recordAudit(this.prisma, {
        actorId, action: 'cohort.plan.changes_requested', entityType: 'cohort', entityId: plan.cohort.id, meta: { planId, note: note.trim() },
      })
      await this.tellTrainer(plan.trainer, plan.cohort, {
        title: `طُلبت تعديلاتٌ على «${plan.cohort.title}»`,
        body: note.trim(),
        heading: 'راجعنا خطّةَ شعبتك ونحتاج تعديلا قبل اعتمادها',
        cta: 'عدّل الخطّة وأعد إرسالها',
      })
      return { status: 'changes_requested' as const }
    }

    await this.prisma.$transaction(async (tx) => {
      /* المعتمَدُ الجديدُ يُنزل ما قبله — لا تُقرأ خطّتان معا */
      await tx.cohortDeliveryPlan.updateMany({
        where: { cohortId: plan.cohort.id, id: { not: planId }, status: { in: ['approved', 'published'] } },
        data: { status: 'superseded' },
      })
      await tx.cohortDeliveryPlan.update({
        where: { id: planId }, data: { status: 'approved', reviewedBy: actorId, reviewedAt: now, reviewerNote: note?.trim() || null },
      })
    })
    await recordAudit(this.prisma, {
      actorId, action: 'cohort.plan.approve', entityType: 'cohort', entityId: plan.cohort.id, meta: { planId },
    })
    await this.tellTrainer(plan.trainer, plan.cohort, {
      title: `اعتُمدت خطّةُ «${plan.cohort.title}»`,
      body: note?.trim() || 'شعبتك جاهزة — تظهر لك من «شعبي» بمن التحق فيها.',
      heading: 'اعتُمدت خطّةُ شعبتك — وهي جاهزةٌ الآن',
      cta: 'افتح شعبتك',
    })
    return { status: 'approved' as const }
  }

  /** تذكيرُ المدرّب بأن يُكمل تجهيزَ شعبته — إشعارٌ وبريدٌ معا */
  async remindTrainer(actorId: string, cohortId: string, note?: string) {
    const cohort = await this.prisma.cohort.findUnique({
      where: { id: cohortId },
      include: { trainers: { where: { role: 'lead' }, include: { profile: { include: { application: { select: { fullName: true, email: true } } } } } } },
    })
    if (!cohort) throw new AuthError('not_found', 'الشعبة غير موجودة', 404)
    const lead = cohort.trainers[0]?.profile
    if (!lead) throw new AuthError('no_trainer', 'لا مدرّبَ رئيسا لهذه الشعبة بعد', 409)
    await this.tellTrainer(lead, cohort, {
      title: `تذكير: أكمل تجهيزَ «${cohort.title}»`,
      body: note?.trim() || 'رتّب المحاورَ والمصادرَ ومواعيدَ اللقاءات، ثمّ أكّد موافقتَك وأرسلها للاعتماد.',
      heading: 'شعبتك تنتظر تجهيزَك',
      cta: 'افتح ورشة الشعبة',
    })
    await recordAudit(this.prisma, {
      actorId, action: 'cohort.remind_trainer', entityType: 'cohort', entityId: cohortId, meta: { note: note?.trim() || null },
    })
    return { ok: true }
  }

  /** تسجيلُ جلسةٍ من رابط — لا ملفَّ يُرفع */
  async addRecordingLink(userId: string, sessionId: string, input: { title: string; url: string; moduleId?: string }) {
    const session = await this.prisma.cohortSession.findUnique({ where: { id: sessionId }, select: { cohortId: true } })
    if (!session) throw new AuthError('not_found', 'الجلسة غير موجودة', 404)
    await this.ownedCohort(userId, session.cohortId)
    const rec = await this.prisma.recording.create({
      data: { sessionId, title: input.title.trim(), externalUrl: input.url, moduleId: input.moduleId ?? null, createdBy: userId },
    })
    await recordAudit(this.prisma, {
      actorId: userId, action: 'session.recording.link', entityType: 'cohort_session', entityId: sessionId, meta: { recordingId: rec.id },
    })
    return rec
  }

  /* ─────────── إخبارُ المدرّب — جرسٌ وبريد ─────────── */

  private async tellTrainer(
    trainer: { userId: string | null; application: { fullName: string; email: string } } | null,
    cohort: { id: string; title: string },
    msg: { title: string; body: string; heading: string; cta: string },
  ) {
    if (!trainer) return
    const url = `${publicSiteUrl()}/trainer/cohort/${cohort.id}`
    if (trainer.userId) {
      await safeNotify(this.prisma, {
        audience: 'trainer', userId: trainer.userId, channel: 'in_app',
        title: msg.title, body: msg.body, templateKey: 'cohort.plan.decision', data: { cohortId: cohort.id },
      })
    }
    await sendDirectEmail(this.prisma, {
      to: trainer.application.email,
      subject: `${msg.title} — أكاديمية وجيز`,
      ...renderMail({
        greetingName: trainer.application.fullName,
        heading: msg.heading,
        blocks: [
          { kind: 'facts', rows: [{ label: 'الشعبة', value: cohort.title }] },
          { kind: 'callout', text: msg.body },
          { kind: 'cta', label: msg.cta, href: url, caption: 'أو انسخ الرابط:' },
        ],
      }),
    })
  }
}
