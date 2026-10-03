/* ═══ شعبةُ الإعداد — طورُ الموادّ في «شعبي» (٢ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «هذا تكرارٌ للعمل! دعهم يقبلون الدورةَ ثمّ يذهبون إلى
   «شعبي» ليعبّئوا كلَّ شيءٍ مرّةً واحدة». كان المدرّبُ في طور العرض المشروط
   يكتب موادَّ كلِّ دورةٍ في «مؤهّلاتي» («موادّ دوراتك»)، فإذا اعتُمد كتبها
   ثانيةً مفصّلةً في «شعبي». فصار الطورُ كلُّه في «شعبي»:

   ① **يقبل الدورةَ أو يعتذر عنها** في «مؤهّلاتي». والقبولُ يُنشئ لها **شعبةَ
      إعداد**: مسوّدةً باسم «الدورة — شعبة N»، هو قائدُها. لا متعلّمَ فيها ولا
      أتعابَ عنها ولا ظهورَ لاسمه — فالكتالوجُ العامُّ لا يعرض المسوّدة،
      وظهورُ المدرّب معلّقٌ على `publishApprovedAt` (`trainer-visibility.ts`).
      وما كتبه في اللوح القديم يُنقل إليها، فلا يضيع منه سطر.
   ② **يعبّئها ويرسلها للاعتماد** كأيّ شعبة. وإرسالُ آخرِ دوراته يُعلن اكتمالَ
      موادّه بنفسه — فتتجمّد مهلتُه (البند 2-10) بلا زرٍّ ثانٍ.
   ③ **واعتمادُ خطّتها يعتمد الدورة** (`qualified`). وردُّها بملاحظات يُعيد
      موادَّه إليه وتُستأنف مهلتُه. فإذا اعتُمدت دوراتُه المقبولةُ كلُّها
      **فُعِّل تلقائيّا** — قرارُ صاحب المنصّة («2-b»): يُوقَّع العقدُ من جهتنا
      ويصير نشطا، وتصير شعبةُ الإعداد شعبتَه الأولى تُفتح للتسجيل بقرارٍ منفصل.
      وما يمنع التفعيلَ (أجرٌ لم يُتّفق عليه مثلا) يُقال للإدارة ولا يُسقط
      اعتمادَ الخطّة.

   ولمَ خدمةٌ وحدَها: `CohortPlanService` يناديها بعد الإرسال والقرار، وهي
   تنادي `TrainerReviewService` للإعلان والتفعيل — ولو ضُمّت إلى إحداهما
   لاستورد كلٌّ منهما الآخر. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { notifyRole } from './notification.service'
import { CohortService } from './cohort.service'
import { portalDoorProblemAr } from '../../src/application/trainer/portal-access'
import { cleanCourseMaterials, type CourseMaterials } from '../../src/application/trainer/course-materials'

/** حالُ الدورة في طور الإعداد كما تُعرض للمدرّب وللإدارة */
export type PrepState =
  | 'to_decide'        // لم يقبلها ولم يعتذر
  | 'preparing'        // قبِلها وشعبتُها مسوّدةٌ لم تُرسَل
  | 'submitted'        // أُرسلت خطّتُها وتنتظر الاعتماد
  | 'returned'         // رُدّت بملاحظات
  | 'approved'         // اعتُمدت — فهي مؤهَّلٌ لها
  | 'declined'         // اعتذر عنها

export interface PrepCourse {
  courseId: string
  titleAr: string
  state: PrepState
  cohortId: string | null
  cohortTitle: string | null
  declineReasonAr: string | null
  /** دورةٌ معتمَدةٌ له أصلا (`qualified`) — يقبلها فتُنشأ شعبتُها، ولا يعتذر عنها:
      الاعتذارُ عن دورةٍ اعتُمدت له ليس بابا هنا (٣ أكتوبر ٢٠٢٦) */
  approved: boolean
}

/** نصُّ الاعتذار في ملحوظة التأهيل — ومنه يُعرف أنّ `retired` اعتذارٌ منه لا سحبٌ منّا */
export const DECLINED_NOTE_PREFIX = 'اعتذر عنها المدرّب: '

export class TrainerPrepService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  private async profileForUser(userId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { userId }, include: { application: { select: { status: true, fullName: true } } },
    })
    if (!profile) throw new AuthError('no_profile', 'لا ملفَّ مدرّبٍ مرتبطا بهذا الحساب', 404)
    const problem = portalDoorProblemAr('materials', { status: profile.application.status, suspendedAt: profile.suspendedAt })
    if (problem) throw new AuthError('suspended', problem, 403)
    return profile
  }

  /** شعبةُ الإعداد لهذه الدورة إن قامت: مسوّدةٌ هو قائدُها */
  private prepCohortOf(profileId: string, courseId: string) {
    return this.prisma.cohort.findFirst({
      where: { courseId, status: 'draft', trainers: { some: { profileId, role: 'lead' } } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, title: true },
    })
  }

  /** دوراتُ الطور وحالُ كلٍّ — لـ«مؤهّلاتي» ولشاشة العقود */
  async coursesOf(profileId: string): Promise<PrepCourse[]> {
    const quals = await this.prisma.trainerCourseQualification.findMany({
      where: { profileId, OR: [{ status: 'pending' }, { status: 'retired', note: { startsWith: DECLINED_NOTE_PREFIX } }] },
      orderBy: { createdAt: 'asc' },
      include: { course: { select: { currentVersion: true, versions: { select: { version: true, titleAr: true } } } } },
    })
    const out: PrepCourse[] = []
    for (const q of quals) {
      const titleAr = q.course.versions.find((v) => v.version === q.course.currentVersion)?.titleAr ?? q.courseId
      if (q.status === 'retired') {
        out.push({
          courseId: q.courseId, titleAr, state: 'declined', cohortId: null, cohortTitle: null,
          declineReasonAr: q.note?.slice(DECLINED_NOTE_PREFIX.length) || null, approved: false,
        })
        continue
      }
      const cohort = await this.prepCohortOf(profileId, q.courseId)
      let state: PrepState = cohort ? 'preparing' : 'to_decide'
      if (cohort) {
        const plan = await this.prisma.cohortDeliveryPlan.findFirst({
          where: { cohortId: cohort.id, trainerId: { not: null } }, orderBy: { createdAt: 'desc' }, select: { status: true },
        })
        if (plan?.status === 'submitted') state = 'submitted'
        else if (plan?.status === 'changes_requested') state = 'returned'
      }
      out.push({ courseId: q.courseId, titleAr, state, cohortId: cohort?.id ?? null, cohortTitle: cohort?.title ?? null, declineReasonAr: null, approved: false })
    }
    return [...out, ...await this.approvedWithoutCohort(profileId)]
  }

  /* ═══ والمعتمَدةُ بلا شعبة — يقبلها المدرّبُ النشطُ بنفسه (٣ أكتوبر ٢٠٢٦) ═══

     قرارُ صاحب المنصّة («B»): كانت الإدارةُ تُنشئ لكلّ مدرّبٍ نشطٍ شعبةَ دورته
     المعتمَدة وتعرضها عليه («جهّز شعبَ التعبئة»). فصار يراها في «مؤهّلاتي» كما
     يرى دوراتِ الطور، ويقبلها فتُنشأ له مسوّدتُها. وتبقى البطاقةُ للشعب الزائدة.

     · **ما يُعرض**: دورةٌ معتمَدةٌ ليس له فيها شعبةٌ قائمةٌ ولا عرضٌ مفتوح — فمن
       عُرضت عليه شعبةٌ يجيب عرضَها، ولا تُنشأ له ثانية.
     · **وما قبِله** يبقى هنا حتّى تُعتمَد خطّتُه، ثمّ يخرج: شعبتُه في «شعبي»
       وتُفتح للتسجيل بقرار الإدارة.
     · **ولا اعتذار**: الدورةُ معتمَدةٌ له، وتركُها بلا قبولٍ هو الجواب. */
  private async approvedWithoutCohort(profileId: string): Promise<PrepCourse[]> {
    const quals = await this.prisma.trainerCourseQualification.findMany({
      where: { profileId, status: 'qualified' },
      orderBy: { createdAt: 'asc' },
      include: { course: { select: { currentVersion: true, versions: { select: { version: true, titleAr: true } } } } },
    })
    const out: PrepCourse[] = []
    for (const q of quals) {
      const titleAr = q.course.versions.find((v) => v.version === q.course.currentVersion)?.titleAr ?? q.courseId
      const open = await this.prisma.trainerAssignmentOffer.count({
        where: { profileId, courseId: q.courseId, status: 'offered' },
      })
      if (open > 0) continue
      const draft = await this.prepCohortOf(profileId, q.courseId)
      if (draft) {
        const plan = await this.prisma.cohortDeliveryPlan.findFirst({
          where: { cohortId: draft.id, trainerId: { not: null } }, orderBy: { createdAt: 'desc' }, select: { status: true },
        })
        if (plan?.status === 'approved' || plan?.status === 'published') continue
        const state: PrepState = plan?.status === 'submitted' ? 'submitted' : plan?.status === 'changes_requested' ? 'returned' : 'preparing'
        out.push({ courseId: q.courseId, titleAr, state, cohortId: draft.id, cohortTitle: draft.title, declineReasonAr: null, approved: true })
        continue
      }
      /* شعبةٌ قائمةٌ له في هذه الدورة (غيرُ ملغاة) — فهي في «شعبي» أصلا */
      const live = await this.prisma.cohortTrainer.count({
        where: { profileId, cohort: { courseId: q.courseId, status: { not: 'cancelled' } } },
      })
      if (live > 0) continue
      out.push({ courseId: q.courseId, titleAr, state: 'to_decide', cohortId: null, cohortTitle: null, declineReasonAr: null, approved: true })
    }
    return out
  }

  async mine(userId: string) {
    const profile = await this.profileForUser(userId)
    return this.coursesOf(profile.id)
  }

  /* ─────────── ① القبولُ والاعتذار ─────────── */

  /** «اقبلها وابدأ إعدادها» — تُنشأ شعبةُ الإعداد ويُنقل إليها ما كتبه من قبل */
  async accept(userId: string, courseId: string) {
    const profile = await this.profileForUser(userId)
    const qual = await this.prisma.trainerCourseQualification.findUnique({
      where: { profileId_courseId: { profileId: profile.id, courseId } },
    })
    /* وتُقبَل المعتمَدةُ كذلك (٣ أكتوبر ٢٠٢٦) — إن لم يكن له فيها عرضٌ مفتوح:
       من عُرضت عليه شعبةٌ يجيب عرضَها، ولا تُنشأ له ثانية */
    if (!qual || (qual.status !== 'pending' && qual.status !== 'qualified')) {
      throw new AuthError('not_pending', 'هذه الدورةُ ليست بانتظار قرارك', 409)
    }
    const existing = await this.prepCohortOf(profile.id, courseId)
    if (existing) return existing
    if (qual.status === 'qualified') {
      const open = await this.prisma.trainerAssignmentOffer.count({
        where: { profileId: profile.id, courseId, status: 'offered' },
      })
      if (open > 0) throw new AuthError('open_offer', 'لهذه الدورة عرضٌ ينتظر جوابَك في «مؤهّلاتي» — أجِبه بدلَ أن تُنشئ شعبةً ثانية', 409)
      const live = await this.prisma.cohortTrainer.count({
        where: { profileId: profile.id, cohort: { courseId, status: { not: 'cancelled' } } },
      })
      if (live > 0) throw new AuthError('has_cohort', 'لك شعبةٌ في هذه الدورة في «شعبي» — والشعبُ الزائدةُ تُنشئها الإدارة', 409)
    }

    const cohorts = new CohortService(this.prisma)
    const cohort = await cohorts.create(userId, { courseId })
    await this.prisma.cohortTrainer.create({
      data: { cohortId: cohort.id, profileId: profile.id, role: 'lead', assignedBy: userId },
    })
    await recordAudit(this.prisma, {
      actorId: userId, action: 'trainer.prep.accept', entityType: 'cohort', entityId: cohort.id,
      meta: { profileId: profile.id, courseId },
    })
    const materials = qual.materials ? cleanCourseMaterials(qual.materials) : null
    if (materials) await this.carryMaterials(userId, cohort.id, courseId, materials)
    return { id: cohort.id, title: cohort.title }
  }

  /** «اعتذرْ عنها» — تخرج من دوراته، ويُقال للإدارة لماذا */
  async decline(userId: string, courseId: string, reasonAr: string) {
    const reason = reasonAr.trim()
    if (reason.length < 3) throw new AuthError('no_reason', 'اكتب سببا قصيرا — يقرؤه من اختار لك الدورة', 400)
    const profile = await this.profileForUser(userId)
    const qual = await this.prisma.trainerCourseQualification.findUnique({
      where: { profileId_courseId: { profileId: profile.id, courseId } },
    })
    if (!qual || qual.status !== 'pending') {
      throw new AuthError('not_pending', 'هذه الدورةُ ليست بانتظار قرارك', 409)
    }
    /* وشعبةُ إعدادٍ قامت لها تُلغى — لا تبقى مسوّدةٌ بلا صاحب */
    const cohort = await this.prepCohortOf(profile.id, courseId)
    if (cohort) await this.prisma.cohort.update({ where: { id: cohort.id }, data: { status: 'cancelled' } })
    await this.prisma.trainerCourseQualification.update({
      where: { id: qual.id },
      data: { status: 'retired', note: `${DECLINED_NOTE_PREFIX}${reason.slice(0, 500)}`, decidedAt: new Date() },
    })
    await recordAudit(this.prisma, {
      actorId: userId, action: 'trainer.prep.decline', entityType: 'trainer_profile', entityId: profile.id,
      meta: { courseId, reasonAr: reason.slice(0, 500), cohortId: cohort?.id ?? null },
    })
    await notifyRole(this.prisma, ['academic_manager', 'super_admin'], {
      channel: 'in_app', templateKey: 'trainer.prep.declined',
      title: 'اعتذر مدرّبٌ عن دورة',
      body: `اعتذر ${profile.application.fullName} عن دورةٍ اخترناها له — السبب: ${reason.slice(0, 200)}`,
      data: { profileId: profile.id, courseId },
    }).catch(() => undefined)
    /* ومن لم يبقَ له ما ينتظر — اعتُمد ما قبِله واعتذر عن الباقي — يُقال
       لمن يفعّله: فالتفعيلُ التلقائيُّ يقع عند اعتماد خطّة، ولا خطّةَ هنا. */
    await this.tellIfReady(profile.id)
    return { declined: true }
  }

  /** ما كتبه في «موادّ دوراتك» قبل هذا اليوم يُنقل إلى شعبته — لا يُعاد كتابتُه */
  private async carryMaterials(userId: string, cohortId: string, courseId: string, m: CourseMaterials) {
    const { CohortPlanService, baseModulesFor } = await import('./cohort-plan.service')
    const base = await baseModulesFor(this.prisma, courseId)
    const written = m.modules.filter((x) => x.titleAr.trim())
    /* المحاورُ بترتيبها: كلُّ محورٍ كتبه يأخذ موضعَ محور الكتالوج المقابل له،
       وما زاد على الكتالوج لا موضعَ له في الخطّة فيُذكر في ملخّصها. */
    const modules = base.map((b, i) => written[i]
      ? { ...b, titleAr: written[i]!.titleAr.trim(), outcomeAr: written[i]!.outcomeAr.trim() || b.outcomeAr }
      : b)
    const extra = written.slice(base.length).map((x) => `${x.titleAr}: ${x.outcomeAr}`)
    const resources = m.sourcesAr.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
      const url = /https?:\/\/\S+/.exec(line)?.[0] ?? null
      return { title: line.replace(url ?? '', '').trim() || line, url, category: 'reading', kind: url ? 'link' : null }
    })
    const content = {
      kind: 'trainer' as const,
      summaryAr: extra.length ? `محاورُ كتبتَها زيادةً على محاور الدورة: ${extra.join(' · ')}` : null,
      modules,
      resources,
      ...(m.materialsUrl ? { workbook: { title: 'كرّاسةُ الدورة', url: m.materialsUrl, parts: [] } } : {}),
    }
    const plans = new CohortPlanService(this.prisma)
    await plans.savePlan(userId, cohortId, content as unknown as Parameters<typeof plans.savePlan>[2])
      .catch(() => undefined)
    if (m.taskAr.trim()) {
      const { AssessmentService } = await import('./assessment.service')
      await new AssessmentService(this.prisma).createAssessment(userId, {
        cohortId, title: 'مشروعُ الدورة', type: 'project', briefAr: m.taskAr.trim().slice(0, 4000),
      } as Parameters<InstanceType<typeof AssessmentService>['createAssessment']>[1], { byTrainer: true }).catch(() => undefined)
    }
    await recordAudit(this.prisma, {
      actorId: userId, action: 'trainer.prep.materials_carried', entityType: 'cohort', entityId: cohortId,
      meta: { courseId, modules: written.length, resources: resources.length, task: Boolean(m.taskAr.trim()) },
    })
  }

  /* ─────────── ② و③ الإرسالُ والقرار ─────────── */

  /** أهي شعبةُ إعداد؟ — مسوّدةٌ ودورتُها بانتظار اعتمادها عند قائدها.
      والنشطُ معنيٌّ كذلك: دورةٌ أُضيفت له بعد تفعيله تُعتمَد بخطّة شعبتها
      كما تُعتمَد دوراتُ الطور — والتفعيلُ وحدَه لمن في الطور. */
  async prepContext(cohortId: string) {
    const cohort = await this.prisma.cohort.findUnique({
      where: { id: cohortId },
      select: {
        id: true, courseId: true, status: true,
        trainers: {
          where: { role: 'lead' },
          select: { profile: { select: { id: true, userId: true, applicationId: true, application: { select: { status: true } } } } },
        },
      },
    })
    if (!cohort || cohort.status !== 'draft') return null
    const lead = cohort.trainers[0]?.profile
    if (!lead || !['onboarding', 'active'].includes(lead.application.status)) return null
    const qual = await this.prisma.trainerCourseQualification.findUnique({
      where: { profileId_courseId: { profileId: lead.id, courseId: cohort.courseId } },
      select: { status: true },
    })
    if (qual?.status !== 'pending') return null
    return {
      cohortId, courseId: cohort.courseId, profileId: lead.id, userId: lead.userId,
      applicationId: lead.applicationId, onboarding: lead.application.status === 'onboarding',
    }
  }

  /** بعد إرسال الخطّة: إن لم يبقَ ما ينقص أُعلن اكتمالُ موادّه بنفسه (البند 2-10) */
  async afterSubmit(cohortId: string) {
    const ctx = await this.prepContext(cohortId)
    if (!ctx?.userId || !ctx.onboarding) return
    const { TrainerReviewService } = await import('./trainer-review.service')
    await new TrainerReviewService(this.prisma).declareMaterialsComplete(ctx.userId).catch(() => undefined)
  }

  /** بعد القرار في الخطّة: الاعتمادُ يؤهّل ويُفعّل حين يكتمل، والردُّ يُعيد موادَّه */
  async afterDecision(cohortId: string, approved: boolean, actorId: string, noteAr: string | null) {
    const ctx = await this.prepContext(cohortId)
    if (!ctx) return null
    const { TrainerReviewService } = await import('./trainer-review.service')
    const review = new TrainerReviewService(this.prisma)
    if (!approved) {
      const paused = await this.prisma.trainerContract.findFirst({
        where: { profileId: ctx.profileId, conditionPausedAt: { not: null }, conditionMetAt: null },
        select: { id: true },
      })
      if (paused) {
        await review.returnMaterialsWithNotes(paused.id, actorId, noteAr && noteAr.length >= 5 ? noteAr : 'رُدّت خطّةُ شعبتك بملاحظاتٍ تجدها في خطواتها')
          .catch(() => undefined)
      }
      return null
    }
    await review.qualifyForCourse(ctx.profileId, ctx.courseId, actorId, 'اعتُمدت خطّةُ شعبة إعدادها')
    if (!ctx.onboarding) return null
    return this.activateIfComplete(ctx.profileId, ctx.applicationId, actorId)
  }

  /** دوراتُه المقبولةُ كلُّها معتمَدة؟ — فيُفعَّل. وإلّا يُقال ما يمنع */
  private async activateIfComplete(profileId: string, applicationId: string, actorId: string) {
    const [pending, qualified] = await Promise.all([
      this.prisma.trainerCourseQualification.count({ where: { profileId, status: 'pending' } }),
      this.prisma.trainerCourseQualification.count({ where: { profileId, status: 'qualified' } }),
    ])
    if (pending > 0 || qualified === 0) return { activated: false as const, waiting: pending }
    const { TrainerReviewService } = await import('./trainer-review.service')
    try {
      await new TrainerReviewService(this.prisma).decide(applicationId, actorId, 'activate', 'اعتُمدت دوراتُه كلُّها — فُعِّل تلقائيّا')
      await recordAudit(this.prisma, {
        actorId, action: 'trainer.prep.auto_activate', entityType: 'trainer_profile', entityId: profileId, meta: { qualified },
      })
      return { activated: true as const }
    } catch (e) {
      const why = e instanceof AuthError ? e.message : 'خطأٌ غير متوقّع'
      await notifyRole(this.prisma, ['academic_manager', 'super_admin'], {
        channel: 'in_app', templateKey: 'trainer.prep.activation_blocked',
        title: 'اعتُمدت دوراتُ مدرّبٍ كلُّها ولم يُفعَّل',
        body: `لم يُفعَّل تلقائيّا: ${why.slice(0, 300)} — أصلِحْ ذلك ثمّ فعّله من ملفّه.`,
        data: { profileId, applicationId },
      }).catch(() => undefined)
      return { activated: false as const, blockedAr: why }
    }
  }

  /** بعد اعتذارٍ: لا شيءَ ينتظر وفي يده معتمَد — يُقال للإدارة إنّه جاهز */
  private async tellIfReady(profileId: string) {
    const [pending, qualified] = await Promise.all([
      this.prisma.trainerCourseQualification.count({ where: { profileId, status: 'pending' } }),
      this.prisma.trainerCourseQualification.count({ where: { profileId, status: 'qualified' } }),
    ])
    if (pending > 0) return
    await notifyRole(this.prisma, ['academic_manager', 'super_admin'], {
      channel: 'in_app', templateKey: 'trainer.prep.nothing_pending',
      title: qualified > 0 ? 'مدرّبٌ جاهزٌ للتفعيل' : 'مدرّبٌ اعتذر عن دوراته كلِّها',
      body: qualified > 0
        ? 'اعتُمدت دوراتُه التي قبِلها واعتذر عن الباقي — فعّله من ملفّه.'
        : 'لم يبقَ له دورةٌ في طور الإعداد — راجِعْ ملفَّه.',
      data: { profileId },
    }).catch(() => undefined)
  }
}
