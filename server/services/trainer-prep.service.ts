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
      موادَّه إليه وتُستأنف مهلتُه. فإذا اعتُمدت له **دورةٌ واحدة** **فُعِّل
      تلقائيّا** — قرارُ صاحب المنصّة («2-b»، ثمّ ٢٠ أكتوبر ٢٠٢٦: «one cohort is enough»):
      يُوقَّع العقدُ من جهتنا ويصير نشطا، وتصير شعبةُ الإعداد شعبتَه الأولى تُفتح
      للتسجيل بقرارٍ منفصل. وما بقي من دوراته يُعِدّه وهو نشط.
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
import { readContractCourses } from '../../src/application/trainer/contract-body'
import { PLAN_MAX, PLAN_TITLE_MIN } from '../../src/application/trainer/plan-limits'
import { prepTallyOf, type PrepTally } from '../../src/application/trainer/prep-tally'
import { REVIEW_OPEN_STATUSES } from '../../src/application/trainer/approval'
import { TrainerApplicationService, transitionProblemAr, type TrainerStatus } from './trainer-application.service'

/** خطّةُ شعبةٍ اعتمدناها — وهي وحدَها ما يفعّل المدرّبَ ويوقّع عقدَه (٢٠ أكتوبر ٢٠٢٦، رأسُ `activateIfQualified`) */
const APPROVED_PLAN = ['approved', 'published']

/** عقدٌ اعتُمد توقيعُه — خُتم معه أم لم يُختم بعد */
const SIGNATURE_APPROVED = ['signature_approved', 'countersigned']

/** جرسُ «اعتمدت دورة لمدرّب ولم يفعّل» مرّةً في الأسبوع للمدرّب الواحد — والمحاولةُ تُعاد في العامل كلَّ ربع ساعة */
const BLOCKED_NOTICE_EVERY_MS = 7 * 86_400_000

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
  approved: boolean  /** أُجّلت خطّتُها إلى موسمٍ قادم — أوّلُ يومٍ فيه (`postpone`، ٨ أكتوبر ٢٠٢٦). وحالُها `returned`
      كما في الخادم، والعدّادُ والشاشةُ يقولانها مؤجّلةً لا مردودة (١٨ أكتوبر ٢٠٢٦) */
  postponedTo?: string | null
}

/** شعبةُ إعدادٍ وقائدُها — كما يقرؤها `prepContext` */
export type PrepContext = NonNullable<Awaited<ReturnType<TrainerPrepService['prepContext']>>>

/** نصُّ الاعتذار في ملحوظة التأهيل — ومنه يُعرف أنّ `retired` اعتذارٌ منه لا سحبٌ منّا */
export const DECLINED_NOTE_PREFIX = 'اعتذر عنها المدرّب: '

/** طلبُ تأهيلٍ بشعبته قرارُه للإدارة — لا يُقبل من هنا ولا يُعتذر عنه */
function requestNotYours() {
  return new AuthError('awaiting_admin', 'طلبت الإدارة إسنادك إلى شعبة في هذه الدورة — القرار لها، ويصلك خبره', 409)
}

/** موسمُ التأجيل لدورةٍ رُدّت خطّتُها مؤجَّلة — `YYYY-MM-DD`، أو لا شيء */
const postponedOf = (state: PrepState, plan: { postponedTo: Date | null } | null): string | null =>
  state === 'returned' && plan?.postponedTo ? plan.postponedTo.toISOString().slice(0, 10) : null

export class TrainerPrepService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  private async profileForUser(userId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { userId }, include: { application: { select: { status: true, fullName: true } } },
    })
    if (!profile) throw new AuthError('no_profile', 'لا ملفّ مدرّب مرتبطا بهذا الحساب', 404)
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

  /* ═══ وملحقُ العقد (أ) هو المرجع (٣ أكتوبر ٢٠٢٦) ═══

     قولُ صاحب المنصّة: «أهّلتُهم، والدليلُ عقدُهم: فيه أنّهم مؤهَّلون لـ١ و٢ و٣
     و٤». والملحقُ يُبنى يومَ يُركَّب العقدُ من صفوف التأهيل — لكنّ الصفَّ قد
     يتبدّل بعده (اقتراحٌ يُدمج، أو تأهيلٌ يُكتب بغير بابه) فيغيب عن «مؤهّلاتي»
     ما وقّع عليه. فتُقرأ دوراتُ الملحق من آخر عقدٍ وقّعه، وما لا صفَّ له منها
     يُعرض معلّقا، ويُكتب صفُّه حين يقبله. */
  private async annexCourses(profileId: string) {
    const contract = await this.prisma.trainerContract.findFirst({
      where: { profileId, status: { in: ['signed', 'signature_approved', 'countersigned'] } },
      orderBy: { signedAt: { sort: 'desc', nulls: 'last' } },
      select: { qualifiedSnapshot: true },
    })
    return readContractCourses(contract?.qualifiedSnapshot)
  }

  /** دوراتُ الطور وحالُ كلٍّ — لـ«مؤهّلاتي» ولشاشة العقود */
  /* ═══ وطلبُ التأهيل ليس دورةَ إعداد (٢٠ أكتوبر ٢٠٢٦) ═══
     صفٌّ معلّقٌ بشعبته (`requestedCohortId`) طلبَه من يجدول شعبةً، وقرارُه للإدارة (`pending-kind.ts`). وكان يُعدّ
     هنا «لم يقرّر فيها» فيرى المدرّبُ «اقبلها» — وقبولُه يُنشئ شعبةً ثانيةً غيرَ المطلوبة. فلا يُقرأ هنا، ويُرى
     في «دوراتي» سطرا بلا زرّ (`requestsOf`). */
  async coursesOf(profileId: string): Promise<PrepCourse[]> {
    const quals = await this.prisma.trainerCourseQualification.findMany({
      where: { profileId, OR: [{ status: 'pending', requestedCohortId: null }, { status: 'retired', note: { startsWith: DECLINED_NOTE_PREFIX } }] },
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
      let plan: { status: string; postponedTo: Date | null } | null = null
      if (cohort) {
        plan = await this.prisma.cohortDeliveryPlan.findFirst({
          where: { cohortId: cohort.id, trainerId: { not: null } }, orderBy: { createdAt: 'desc' }, select: { status: true, postponedTo: true },
        })
        if (plan?.status === 'submitted') state = 'submitted'
        else if (plan?.status === 'changes_requested') state = 'returned'
      }
      out.push({
        courseId: q.courseId, titleAr, state, cohortId: cohort?.id ?? null, cohortTitle: cohort?.title ?? null, declineReasonAr: null, approved: false,
        postponedTo: postponedOf(state, plan),
      })
    }
    /* ودوراتُ الملحق التي لا صفَّ تأهيلٍ لها أصلا — معلّقةٌ تنتظر قرارَه */
    const known = new Set((await this.prisma.trainerCourseQualification.findMany({
      where: { profileId }, select: { courseId: true },
    })).map((q) => q.courseId))
    const fromAnnex: PrepCourse[] = []
    for (const c of await this.annexCourses(profileId)) {
      if (known.has(c.courseId)) continue
      const exists = await this.prisma.course.findUnique({ where: { id: c.courseId }, select: { id: true } })
      if (!exists) continue
      known.add(c.courseId)
      fromAnnex.push({
        courseId: c.courseId, titleAr: c.titleAr, state: 'to_decide', cohortId: null, cohortTitle: null,
        declineReasonAr: null, approved: false,
      })
    }
    return [...out, ...fromAnnex, ...await this.approvedWithoutCohort(profileId)]
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
          where: { cohortId: draft.id, trainerId: { not: null } }, orderBy: { createdAt: 'desc' }, select: { status: true, postponedTo: true },
        })
        if (plan?.status === 'approved' || plan?.status === 'published') continue
        const state: PrepState = plan?.status === 'submitted' ? 'submitted' : plan?.status === 'changes_requested' ? 'returned' : 'preparing'
        out.push({
          courseId: q.courseId, titleAr, state, cohortId: draft.id, cohortTitle: draft.title, declineReasonAr: null, approved: true,
          postponedTo: postponedOf(state, plan),
        })
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

  /** طلباتُ تأهيله التي تنتظر قرار الإدارة — يقرؤها ولا يقرّر فيها */
  async requestsOf(userId: string): Promise<{ courseId: string; titleAr: string; cohortTitle: string | null; requestedAt: Date | null }[]> {
    const profile = await this.profileForUser(userId)
    const rows = await this.prisma.trainerCourseQualification.findMany({
      where: { profileId: profile.id, status: 'pending', requestedCohortId: { not: null } },
      orderBy: { createdAt: 'asc' },
      include: { course: { select: { currentVersion: true, versions: { select: { version: true, titleAr: true } } } } },
    })
    const cohorts = await this.prisma.cohort.findMany({
      where: { id: { in: rows.map((r) => r.requestedCohortId!) } }, select: { id: true, title: true },
    })
    const title = new Map(cohorts.map((c) => [c.id, c.title]))
    return rows.map((r) => ({
      courseId: r.courseId,
      titleAr: r.course.versions.find((v) => v.version === r.course.currentVersion)?.titleAr ?? r.courseId,
      cohortTitle: title.get(r.requestedCohortId!) ?? null,
      requestedAt: r.requestedAt,
    }))
  }

  /* ─────────── ① القبولُ والاعتذار ─────────── */

  /** «اقبلها وابدأ إعدادها» — تُنشأ شعبةُ الإعداد ويُنقل إليها ما كتبه من قبل */
  async accept(userId: string, courseId: string) {
    const profile = await this.profileForUser(userId)
    let qual = await this.prisma.trainerCourseQualification.findUnique({
      where: { profileId_courseId: { profileId: profile.id, courseId } },
    })
    /* دورةٌ في ملحق عقده بلا صفِّ تأهيل: يُكتب صفُّها معلّقا الآن (`annexCourses`) */
    if (!qual && (await this.annexCourses(profile.id)).some((c) => c.courseId === courseId)) {
      qual = await this.prisma.trainerCourseQualification.create({
        data: { profileId: profile.id, courseId, status: 'pending', note: 'من ملحق العقد (أ)' },
      })
    }
    /* وتُقبَل المعتمَدةُ كذلك (٣ أكتوبر ٢٠٢٦) — إن لم يكن له فيها عرضٌ مفتوح:
       من عُرضت عليه شعبةٌ يجيب عرضَها، ولا تُنشأ له ثانية */
    if (!qual || (qual.status !== 'pending' && qual.status !== 'qualified')) {
      throw new AuthError('not_pending', 'هذه الدورة ليست بانتظار قرارك', 409)
    }
    if (qual.status === 'pending' && qual.requestedCohortId) throw requestNotYours()
    const existing = await this.prepCohortOf(profile.id, courseId)
    if (existing) return existing
    if (qual.status === 'qualified') {
      const open = await this.prisma.trainerAssignmentOffer.count({
        where: { profileId: profile.id, courseId, status: 'offered' },
      })
      if (open > 0) throw new AuthError('open_offer', 'لهذه الدورة عرض ينتظر جوابك في «دوراتي» — أجبه بدل أن تنشئ شعبة ثانية', 409)
    }
    /* وشعبةٌ قائمةٌ له في الدورة تمنع الثانية — معتمَدا كان أو معلّقا (٢٠ أكتوبر ٢٠٢٦) */
    const live = await this.prisma.cohortTrainer.count({
      where: { profileId: profile.id, cohort: { courseId, status: { not: 'cancelled' } } },
    })
    if (live > 0) throw new AuthError('has_cohort', 'لك شعبة في هذه الدورة في «شعبي» — والشعب الزائدة تنشئها الإدارة', 409)

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

  /* ═══ وما عُرض من «جهّز شعب التعبئة» يحمل موادَّه كذلك (١٨ أكتوبر ٢٠٢٦) ═══
     كان القبولُ من «مؤهّلاتي» ينقل ما اعتُمد من اللوح القديم إلى الشعبة، وقبولُ عرضٍ أنشأت
     الإدارةُ شعبتَه لا ينقل شيئا — فيجد المدرّبُ شعبةً فارغةً لدورةٍ اعتُمدت موادُّها. فيُنقل
     هنا ما لم تكن للشعبة خطّةُ مدرّبٍ قبله. */
  async carryOnOfferAccept(userId: string, profileId: string, courseId: string, cohortId: string): Promise<boolean> {
    const qual = await this.prisma.trainerCourseQualification.findUnique({
      where: { profileId_courseId: { profileId, courseId } }, select: { materials: true },
    })
    if (!qual?.materials) return false
    const written = await this.prisma.cohortDeliveryPlan.count({ where: { cohortId, trainerId: { not: null } } })
    if (written > 0) return false
    await this.carryMaterials(userId, cohortId, courseId, cleanCourseMaterials(qual.materials))
    return true
  }

  /** «اعتذرْ عنها» — تخرج من دوراته، ويُقال للإدارة لماذا */
  async decline(userId: string, courseId: string, reasonAr: string) {
    const reason = reasonAr.trim()
    if (reason.length < 3) throw new AuthError('no_reason', 'اكتب سببا قصيرا — يقرؤه من اختار لك الدورة', 400)
    const profile = await this.profileForUser(userId)
    let qual = await this.prisma.trainerCourseQualification.findUnique({
      where: { profileId_courseId: { profileId: profile.id, courseId } },
    })
    if (!qual && (await this.annexCourses(profile.id)).some((c) => c.courseId === courseId)) {
      qual = await this.prisma.trainerCourseQualification.create({
        data: { profileId: profile.id, courseId, status: 'pending', note: 'من ملحق العقد (أ)' },
      })
    }
    if (!qual || qual.status !== 'pending') {
      throw new AuthError('not_pending', 'هذه الدورة ليست بانتظار قرارك', 409)
    }
    if (qual.requestedCohortId) throw requestNotYours()
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
      title: 'اعتذر مدرّب عن دورة',
      body: `اعتذر ${profile.application.fullName} عن دورة اخترناها له — السبب: ${reason.slice(0, 200)}`,
      data: { profileId: profile.id, courseId },
    }).catch(() => undefined)
    /* ومن لم يبقَ له ما ينتظر — اعتُمد ما قبِله واعتذر عن الباقي — يُقال
       لمن يفعّله: فالتفعيلُ التلقائيُّ يقع عند اعتماد خطّة، ولا خطّةَ هنا. */
    await this.tellIfReady(profile.id)
    return { declined: true }
  }

  /** ما كتبه في «موادّ دوراتك» قبل هذا اليوم يُنقل إلى شعبته — لا يُعاد كتابتُه

      ═══ ولا يُكتب ما يردّه الحفظ (٥ أكتوبر ٢٠٢٦) ═══

      الخطّةُ هنا تُكتب بالخدمة مباشرةً لا بالمسلك، فلا يمرّ بها مخطّطُ الحفظ. وكان
      اللوحُ القديمُ يقبل مخرَجا بألفين وسطرَ مصدرٍ بألفين، والخطّةُ بألفٍ ومئتين —
      فتُنقل خطّةٌ **يردّ الخادمُ كلَّ حفظٍ بعدها**، ولا يعرف صاحبُها لماذا. فيُقصّ
      ما يُنقل إلى حدود الخطّة نفسِها (`plan-limits.ts`)، ويُترك عنوانٌ أقصرُ من
      حدّه لعنوان الكتالوج. والمصدرُ بلا رابطٍ يُنقل كما هو: يُحفظ، ويُسمّى في
      قائمة التجهيز ليُكمَل — والعلّةُ عند مخطّط `resources`. */
  private async carryMaterials(userId: string, cohortId: string, courseId: string, m: CourseMaterials) {
    const { CohortPlanService, baseModulesFor } = await import('./cohort-plan.service')
    const base = await baseModulesFor(this.prisma, courseId)
    const M = PLAN_MAX
    const written = m.modules.filter((x) => x.titleAr.trim())
    /* المحاورُ بترتيبها: كلُّ محورٍ كتبه يأخذ موضعَ محور الكتالوج المقابل له،
       وما زاد على الكتالوج لا موضعَ له في الخطّة فيُذكر في ملخّصها. */
    const modules = base.map((b, i) => {
      const w = written[i]
      if (!w) return b
      const title = w.titleAr.trim().slice(0, M.moduleTitle)
      return {
        ...b,
        titleAr: title.length >= PLAN_TITLE_MIN ? title : b.titleAr,
        outcomeAr: w.outcomeAr.trim().slice(0, M.outcomeAr) || b.outcomeAr,
      }
    })
    const extra = written.slice(base.length).map((x) => `${x.titleAr}: ${x.outcomeAr}`)
    const resources = m.sourcesAr.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
      const found = /https?:\/\/\S+/.exec(line)?.[0] ?? null
      /* ورابطٌ أطولُ من حدّ الخطّة لا يُقصّ: المقصوصُ لا يُفتح — فيبقى في الاسم */
      const url = found && found.length <= M.resourceUrl ? found : null
      const title = (line.replace(url ?? '', '').trim() || line).slice(0, M.resourceTitle)
      return { title, url, category: 'reading', kind: url ? 'link' : null }
    }).filter((r) => r.title.length >= PLAN_TITLE_MIN).slice(0, M.resources)
    const summary = extra.length ? `محاور كتبتها زيادة على محاور الدورة: ${extra.join(' · ')}` : null
    const content = {
      kind: 'trainer' as const,
      /* مواعيدُ المحاور من لقاءاتها لا تُكتب (١٧ أكتوبر ٢٠٢٦، `planSlots`) */
      timing: 'meetings' as const,
      summaryAr: summary ? summary.slice(0, M.summaryAr) : null,
      modules,
      resources,
      ...(m.materialsUrl ? { workbook: { title: 'كرّاسة الدورة', url: m.materialsUrl, parts: [] } } : {}),
    }
    const plans = new CohortPlanService(this.prisma)
    await plans.savePlan(userId, cohortId, content as unknown as Parameters<typeof plans.savePlan>[2])
      .catch(() => undefined)
    if (m.taskAr.trim()) {
      const { AssessmentService } = await import('./assessment.service')
      await new AssessmentService(this.prisma).createAssessment(userId, {
        cohortId, title: 'مشروع الدورة', type: 'project', briefAr: m.taskAr.trim().slice(0, 4000),
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
    /* ═══ ومن في الطور ودورتُه معتمَدةٌ أصلا (٣ أكتوبر ٢٠٢٦) ═══
       بلاغٌ من مدرّبٍ في طور الإعداد: دورتاه من اقتراحاته، أُضيفت إحداهما إلى
       الكتالوج ودُمجت الأخرى، فأُهِّل لهما (`qualified`) لا «اخترناها له»
       (`pending`). فلم يجد زرَّ القبول، ولا كانت شعبتُه تجمّد مهلتَه ولا
       تفعّله. فشعبتُه شعبةُ إعدادٍ ما دام في الطور، معلّقةً دورتُها أو معتمَدة. */
    const onboarding = lead.application.status === 'onboarding'
    /* وفي الطور أيضا: نشطٌ مهلةُ عرضه المشروط تجري — اعتمادُ التوقيع صار يفعّله (٢١ أكتوبر ٢٠٢٦) */
    const inPrep = onboarding || (await this.prisma.trainerContract.count({
      where: { profileId: lead.id, gatesActivation: true, conditionMetAt: null, conditionDeadlineAt: { not: null }, status: { in: SIGNATURE_APPROVED } },
    })) > 0
    if (qual?.status !== 'pending' && !(inPrep && qual?.status === 'qualified')) return null
    return {
      cohortId, courseId: cohort.courseId, profileId: lead.id, userId: lead.userId,
      applicationId: lead.applicationId, onboarding, inPrep, pending: qual?.status === 'pending',
    }
  }

  /** بعد إرسال الخطّة: إن لم يبقَ ما ينقص أُعلن اكتمالُ موادّه بنفسه (البند 2-10) */
  async afterSubmit(cohortId: string) {
    const ctx = await this.prepContext(cohortId)
    if (!ctx?.userId || !ctx.inPrep) return
    const { TrainerReviewService } = await import('./trainer-review.service')
    await new TrainerReviewService(this.prisma).declareMaterialsComplete(ctx.userId).catch(() => undefined)
  }

  /* ═══ بعد القرار في الخطّة — ثلاثُ خطواتٍ لا نداءٌ واحد (٣ أكتوبر ٢٠٢٦) ═══

     كان `afterDecision` واحدا يؤهّل ويفعّل ويعيد الموادَّ، وكلٌّ منها يكتب
     جرسَه — فيصل المدرّبَ عن القرار الواحد خبران: «اعتُمدت خطّةُ…» و«أُهِّلتَ
     لتدريس دورة»، أو «طُلبت تعديلات…» و«أُعيدت موادُّك بملاحظات». وسار صاحبُ
     المنصّة في المسار فاختار: خبرٌ واحدٌ لكلّ قرار، وخبرٌ للتفعيل.

     فصار القرارُ (`CohortPlanService.decide`) ينادي الخطواتِ بترتيبها: التأهيلُ
     صامتا، ثمّ خبرُ الاعتماد بما وقع فعلا (`planApprovedTrainerMsg`)، ثمّ التفعيلُ
     بخبره — فيقرأ المدرّبُ في جرسه التفعيلَ أعلى، والاعتمادَ تحته. و`quiet`
     للمسلك هذا وحدَه: التأهيلُ من «التأهيلُ والإسناد» وإعادةُ الموادّ من شاشة
     العقود يبقى لكلٍّ جرسُه، فهما قراران لا خبرَ غيرُهما عنهما. */

  /** ① بعد الاعتماد: يؤهّله لدورتها إن كانت معلّقة — ويقول أوقع ذلك */
  async qualifyOnApproval(cohortId: string, actorId: string, opts: { quiet?: boolean } = {}) {
    const ctx = await this.prepContext(cohortId)
    if (!ctx) return null
    if (!ctx.pending) return { ctx, qualified: false }
    const { TrainerReviewService } = await import('./trainer-review.service')
    await new TrainerReviewService(this.prisma)
      .qualifyForCourse(ctx.profileId, ctx.courseId, actorId, 'اعتمدت خطّة شعبة إعدادها', { quiet: opts.quiet, activate: false })
    return { ctx, qualified: true }
  }

  /** ② ثمّ التفعيلُ — أوّلُ دورةٍ تُعتمَد له تكفي (`activateIfQualified`). لمن في الطور وحدَه */
  async activateOnApproval(ctx: PrepContext, actorId: string) {
    if (!ctx.onboarding) return null
    return this.activateIfQualified(ctx.profileId, ctx.applicationId, actorId)
  }

  /** وبعد الردّ: تُعاد موادُّه وتُستأنف مهلتُه إن كانت موقوفةً لمراجعتنا — ويُرجَع موعدُها */
  async returnOnChanges(cohortId: string, actorId: string, noteAr: string | null, opts: { quiet?: boolean } = {}) {
    const ctx = await this.prepContext(cohortId)
    if (!ctx) return null
    const paused = await this.prisma.trainerContract.findFirst({
      where: { profileId: ctx.profileId, conditionPausedAt: { not: null }, conditionMetAt: null },
      select: { id: true },
    })
    if (!paused) return null
    const { TrainerReviewService } = await import('./trainer-review.service')
    return new TrainerReviewService(this.prisma).returnMaterialsWithNotes(
      paused.id, actorId,
      noteAr && noteAr.length >= 5 ? noteAr : 'ردّت خطّة شعبتك بملاحظات تجدها في خطواتها',
      new Date(), { quiet: opts.quiet },
    )
  }

  /* ═══ دورةٌ واحدةٌ معتمَدةٌ تكفي لتفعيله (٢٠ أكتوبر ٢٠٢٦) ═══

     كان يُفعَّل حين تُعتمَد دوراتُه المقبولةُ كلُّها (١٧–١٨ أكتوبر). فبقيت مدرّبةٌ في الطور وثلاثٌ من
     شعبها مفتوحةٌ تُباع بلا اسمها — دوراتُها الأخرى تُعَدّ بعدُ، والنشرُ الآليُّ لا يمسّ من لم ينشط
     (`trainer-auto-publish.ts`). فقال صاحبُ المنصّة: «if any one has at least one approved cohort, then
     they are live.. they keep adding courses afterward.. one cohort is enough for them to be active».

     فأوّلُ دورةٍ تُعتمَد له — بخطّة شعبتها أو بتأهيلٍ مباشر — تفعّله ويُوقَّع عقدُه، وما بقي يُعِدّه وهو
     نشط: يُعتمَد بخطّة شعبته كما تُعتمَد دورةٌ أُضيفت لنشط (`prepContext`). وما يمنع التفعيلَ يُقال
     للإدارة جرسا مرّةً في الأسبوع لا في كلّ محاولة — فالعاملُ يعيدها كلَّ ربع ساعة (`activateQualifiedOnboarding`).

     ═══ و«المعتمَدةُ» شعبةٌ اعتُمدت خطّتُها، لا تأهيلٌ وحدَه (٢٠ أكتوبر ٢٠٢٦) ═══
     رأى صاحبُ المنصّة مدرّبين «الشعب: 0 من 3» وبجانبهم «اعتمدت له دورة — فعّله ووقّع العقد»، فسأل: «كنت
     أقصد أن تكون له دورةٌ معتمدةٌ موادُّها وفُتحت». وكانت «المعتمَدةُ» أيَّ تأهيلٍ قائم — من «التأهيل والإسناد»
     أو تصنيفِ اقتراحٍ — ولم يُحكم في موادّه بعد، والعاملُ يُمنع عن بعضهم فيُسأل هو. فاختار: «Approved cohort only» —
     خطّةُ شعبةٍ اعتمدناها (`APPROVED_PLAN`)، ولا يُسأل قبلها شيئا. */
  async activateIfQualified(profileId: string, applicationId: string, actorId: string) {
    const qualified = await this.approvedPlans(profileId)
    if (qualified === 0) return { activated: false as const }
    const { TrainerReviewService } = await import('./trainer-review.service')
    try {
      await new TrainerReviewService(this.prisma).decide(applicationId, actorId, 'activate', 'اعتمدت له دورة — فعّل تلقائيّا')
      await recordAudit(this.prisma, {
        actorId, action: 'trainer.prep.auto_activate', entityType: 'trainer_profile', entityId: profileId, meta: { qualified },
      })
      return { activated: true as const }
    } catch (e) {
      const why = e instanceof AuthError ? e.message : 'خطأ غير متوقّع'
      const told = await this.prisma.auditEvent.count({
        where: {
          action: 'trainer.prep.activation_blocked', entityType: 'trainer_profile', entityId: profileId,
          createdAt: { gte: new Date(Date.now() - BLOCKED_NOTICE_EVERY_MS) },
        },
      })
      if (told === 0) {
        await recordAudit(this.prisma, {
          actorId, action: 'trainer.prep.activation_blocked', entityType: 'trainer_profile', entityId: profileId,
          meta: { whyAr: why.slice(0, 300) },
        })
        await notifyRole(this.prisma, ['academic_manager', 'super_admin'], {
          channel: 'in_app', templateKey: 'trainer.prep.activation_blocked',
          title: 'اعتمدت دورة لمدرّب ولم يفعّل',
          body: `لم يفعّل تلقائيّا: ${why.slice(0, 300)} — أصلح ذلك ثمّ فعّله من ملفّه.`,
          data: { profileId, applicationId },
        }).catch(() => undefined)
      }
      return { activated: false as const, blockedAr: why, told: told === 0 }
    }
  }

  /** كم خطّةَ شعبةٍ اعتمدناها له */
  async approvedPlans(profileId: string): Promise<number> {
    return this.prisma.cohortDeliveryPlan.count({ where: { trainerId: profileId, status: { in: APPROVED_PLAN } } })
  }

  /** يلحق من في الطور واعتُمدت له خطّةُ شعبة ولم يُفعَّل — من منعه مانعٌ ثمّ أُصلح.
      والفاعلُ مَن اعتمد آخرَ خططه: هو صاحبُ القرار الذي فعّله. والموقوفُ لا يُمسّ. */
  async activateQualifiedOnboarding(): Promise<{ activated: string[]; blocked: number }> {
    const rows = await this.prisma.trainerProfile.findMany({
      where: {
        suspendedAt: null,
        application: { status: 'onboarding' },
        cohortPlans: { some: { status: { in: APPROVED_PLAN }, reviewedBy: { not: null } } },
      },
      select: {
        id: true, applicationId: true,
        cohortPlans: {
          where: { status: { in: APPROVED_PLAN }, reviewedBy: { not: null } },
          orderBy: { reviewedAt: { sort: 'desc', nulls: 'last' } },
          take: 1, select: { reviewedBy: true },
        },
      },
    })
    const activated: string[] = []
    let blocked = 0
    for (const r of rows) {
      const r2 = await this.activateIfQualified(r.id, r.applicationId, r.cohortPlans[0]!.reviewedBy!)
      if (r2.activated) activated.push(r.id)
      else if ('told' in r2 && r2.told) blocked++
    }
    return { activated, blocked }
  }

  /* ═══ ومن توقيعُه معتمَدٌ صار نشطا — «تهيئة» أُلغيت (٢١ أكتوبر ٢٠٢٦) ═══

     كانت «تهيئة» طورا بين اعتماد التوقيع والتفعيل. فضُغط على مدرّبةٍ فيها «اقبله داخليّا» فرجعت «قبولا داخليّا»:
     أُغلقت بوّابتُها، وقالت لها «دوراتي» «حسابك التدريبي موقوف». فأُعيد من هذا حالُه إليها أوّلا («A for everyone
     has the same case»)، ثمّ قال صاحبُ المنصّة: «الغِ تهيئة كليا لملفات المدربين.. بدون أي مخاطرة على الحسابات
     الفعالة». فاعتمادُ التوقيع صار يفعّله (`approveSignature`)، وهذا يلحق من سبق: من في «تهيئة»، ومن رُدّ عنها.

     وحالُه: طلبُه حيٌّ لم ينشط، وآخرُ عقدٍ له غيرُ مُزاحٍ عقدٌ مشروطٌ اعتُمد توقيعُه — فمن أُرسل إليه عقدٌ جديدٌ
     بعده لا يُمَسّ، وطريقُه توقيعُ الجديد. والموقوفُ لا يُمَسّ، والنشطُ لا يُمَسّ.
     · وله حسابٌ وأجرٌ متّفقٌ عليه: يصير نشطا. وتوقيعُنا العقدَ بأوّل شعبةٍ تُعتمَد له (`sealIfDue`).
     · وما سوى ذلك يبقى في «تهيئة» أو يعود إليها — بوّابتُه مفتوحة، ويُقال للإدارة ما ينقصه. */
  async activateSignatureApproved(): Promise<{ activated: string[]; reopened: string[]; blocked: number }> {
    const rows = await this.prisma.trainerProfile.findMany({
      where: {
        suspendedAt: null,
        application: { status: { in: [...REVIEW_OPEN_STATUSES] } },
        contracts: { some: { gatesActivation: true, status: { in: SIGNATURE_APPROVED }, signatureApprovedAt: { not: null } } },
      },
      select: {
        id: true, userId: true, applicationId: true, application: { select: { status: true } },
        contracts: {
          where: { status: { not: 'superseded' } }, orderBy: { createdAt: 'desc' }, take: 1,
          select: { status: true, gatesActivation: true, signatureApprovedAt: true },
        },
      },
    })
    const apps = new TrainerApplicationService(this.prisma)
    const { TrainerReviewService } = await import('./trainer-review.service')
    const review = new TrainerReviewService(this.prisma)
    const activated: string[] = []
    const reopened: string[] = []
    let blocked = 0
    for (const r of rows) {
      const last = r.contracts[0]
      if (!last?.gatesActivation || !last.signatureApprovedAt || !SIGNATURE_APPROVED.includes(last.status)) continue
      const from = r.application.status as TrainerStatus
      const fees = (await review.readinessFor(r.id)).steps.find((x) => x.key === 'compensation')?.done ?? false
      if (r.userId && fees && transitionProblemAr(from, 'active') === null) {
        await apps.transition(r.applicationId, 'active', null, 'توقيعه معتمد — صار نشطا (ألغيت التهيئة)')
        activated.push(r.id)
        continue
      }
      blocked++
      if (from !== 'onboarding' && transitionProblemAr(from, 'onboarding') === null) {
        await apps.transition(r.applicationId, 'onboarding', null, 'توقيعه معتمد — أعيد إلى التهيئة بعد أن رد عنها')
        reopened.push(r.id)
      }
    }
    return { activated, reopened, blocked }
  }

  /* ═══ وعقدُ النشط المعتمَدُ كالعقود الجديدة يوقَّع حين تكتمل دوراتُه (١٧ أكتوبر ٢٠٢٦) ═══

     سأل صاحبُ المنصّة عن عقدِ مدرّبةٍ نشطةٍ اعتُمد توقيعُه «كالعقود الجديدة» (`likeNew`) — «وقِّعْه
     حين تعتمد دوراتِه» — وعن مدرّبٍ في الطور زرُّه «فعّله ووقّع العقد»: ما الفرقُ ولمَ هما كذلك.
     ثمّ اختار للنشط: «Sign automatically» — يُوقَّع عقدُه حين تُعتمَد آخرُ خطّةٍ بدأها، كما يُفعَّل
     من في الطور حين تُعتمَد آخرُ دوراته. وكان لا يُوقَّع إلّا بزرّ «اعتمدتُ دوراتِه — وقِّعْه الآن».

     وما «اكتملت»: قائمةُ الطور (`coursesOf`) لا تحمل ما يُعَدّ ولا ما ينتظر قرارا ولا دورةً معلّقة
     لم يقرّر فيها — لا يبقى فيها إلّا ما اعتذر عنه، ومعتمَدٌ لم يقبل شعبتَه — وفي يده معتمَد. */
  async prepDone(profileId: string): Promise<boolean> {
    const qualified = await this.prisma.trainerCourseQualification.count({ where: { profileId, status: 'qualified' } })
    if (qualified === 0) return false
    const rows = await this.coursesOf(profileId)
    return rows.every((r) => r.state === 'declined' || (r.approved && r.state === 'to_decide') || Boolean(r.postponedTo))
  }

  /** عدّادُ الشعب بجانب اسمه في «العقود» — من `coursesOf` نفسِها، وما خرج منها بشعبةٍ قائمةٍ يُعدّ معتمَدا
      (`prep-tally.ts`، ١٨ أكتوبر ٢٠٢٦) */
  async tallyOf(profileId: string): Promise<PrepTally> {
    const rows = await this.coursesOf(profileId)
    const left = (await this.prisma.trainerCourseQualification.findMany({
      where: { profileId, status: 'qualified', courseId: { notIn: rows.map((r) => r.courseId) } },
      select: { courseId: true },
    })).map((q) => q.courseId)
    const live = left.length === 0 ? [] : await this.prisma.cohortTrainer.findMany({
      where: { profileId, cohort: { courseId: { in: left }, status: { not: 'cancelled' } } },
      select: { cohort: { select: { courseId: true } } },
    })
    const withCohort = new Set(live.map((l) => l.cohort.courseId))
    return prepTallyOf([
      ...rows.map((r) => (r.postponedTo ? 'postponed' as const : r.state)),
      ...left.map((c) => (withCohort.has(c) ? 'done' as const : 'to_decide' as const)),
    ])
  }

  /* ═══ وبأوّل دورةٍ تُعتمَد له بعد اعتماد توقيعه (٢٠ أكتوبر ٢٠٢٦) ═══

     ثمّ قال صاحبُ المنصّة: «Also sign active trainers' contracts at first course» — كما يُفعَّل من في الطور
     بأوّل دورة (`activateIfQualified`). والنشطُ في يده معتمَداتٌ من عقده السابق، فالأولى هنا أوّلُ ما يُعتمَد
     له **بعد** اعتماد توقيعه: خطّةُ شعبةٍ اعتُمدت، أو تأهيلٌ مباشر. ولو عُدّ ما قبله لوُقّع كلُّ عقدٍ
     «كالعقود الجديدة» ساعةَ اعتماده — وهو ما اختار المعتمِدُ ألّا يقع. وما كان يوقّعه («اكتملت دوراتُه») باقٍ.
     والتأهيلُ المباشرُ بلا خطّةٍ لم يعد منها («Approved cohort only»، رأسُ `activateIfQualified`). */
  async firstApprovalSince(profileId: string, since: Date): Promise<{ at: Date; by: string | null } | null> {
    const plan = await this.prisma.cohortDeliveryPlan.findFirst({
      where: { trainerId: profileId, status: { in: APPROVED_PLAN }, reviewedAt: { gte: since } },
      orderBy: { reviewedAt: 'asc' }, select: { reviewedAt: true, reviewedBy: true },
    })
    return plan?.reviewedAt ? { at: plan.reviewedAt, by: plan.reviewedBy } : null
  }

  /** أيوقَّع الآن؟ — اعتُمدت له خطّةُ شعبةٍ بعد اعتماد توقيعه، أو اكتملت دوراتُه وفيها خطّةٌ معتمَدة. ويُقال بأيّهما */
  async sealDue(profileId: string, signatureApprovedAt: Date | null): Promise<'first_course' | 'prep_done' | null> {
    if (signatureApprovedAt && await this.firstApprovalSince(profileId, signatureApprovedAt)) return 'first_course'
    if (await this.approvedPlans(profileId) === 0) return null
    return (await this.prepDone(profileId)) ? 'prep_done' : null
  }

  /** يوقّع عقدَ النشط المعتمَدَ كالعقود الجديدة إن حان (`sealDue`) — وما يمنع يُقال للإدارة مرّةً في الأسبوع
      ولا يُسقط ما قبله */
  async sealIfDue(profileId: string, actorId: string) {
    /* والعرضُ المشروطُ للنشط يوقَّع بأوّل شعبةٍ تُعتمَد له — كان يقع بخروجه من «تهيئة»، وذهبت (٢١ أكتوبر ٢٠٢٦) */
    const conditional = await this.prisma.trainerContract.findFirst({
      where: {
        profileId, gatesActivation: true, conditionMetAt: null, signatureApprovedAt: { not: null },
        status: { in: SIGNATURE_APPROVED }, profile: { application: { status: 'active' } },
      },
      select: { id: true },
    })
    if (conditional) {
      if (await this.approvedPlans(profileId) === 0) return { sealed: false as const }
      const { TrainerReviewService } = await import('./trainer-review.service')
      try {
        await new TrainerReviewService(this.prisma).meetConditionalOffer(profileId, actorId)
        await recordAudit(this.prisma, {
          actorId, action: 'trainer.prep.auto_seal', entityType: 'trainer_contract', entityId: conditional.id,
          meta: { profileId, due: 'first_course', conditional: true },
        })
        return { sealed: true as const }
      } catch (e) {
        return { sealed: false as const, blockedAr: e instanceof AuthError ? e.message : 'خطأ غير متوقّع' }
      }
    }
    const contract = await this.prisma.trainerContract.findFirst({
      where: { profileId, status: 'signature_approved', gatesActivation: false },
      orderBy: { signedAt: { sort: 'desc', nulls: 'last' } },
      select: { id: true, signatureApprovedAt: true },
    })
    if (!contract) return null
    const due = await this.sealDue(profileId, contract.signatureApprovedAt)
    if (!due) return { sealed: false as const }
    const { TrainerReviewService } = await import('./trainer-review.service')
    try {
      await new TrainerReviewService(this.prisma).countersignApproved(contract.id, actorId, {
        noteAr: due === 'first_course' ? 'اعتمدت له دورة — وقع تلقائيا' : 'اكتملت دوراته — وقع تلقائيا',
      })
      await recordAudit(this.prisma, {
        actorId, action: 'trainer.prep.auto_seal', entityType: 'trainer_contract', entityId: contract.id, meta: { profileId, due },
      })
      return { sealed: true as const }
    } catch (e) {
      const why = e instanceof AuthError ? e.message : 'خطأ غير متوقّع'
      const told = await this.prisma.auditEvent.count({
        where: {
          action: 'trainer.prep.seal_blocked', entityType: 'trainer_contract', entityId: contract.id,
          createdAt: { gte: new Date(Date.now() - BLOCKED_NOTICE_EVERY_MS) },
        },
      })
      if (told === 0) {
        await recordAudit(this.prisma, {
          actorId, action: 'trainer.prep.seal_blocked', entityType: 'trainer_contract', entityId: contract.id,
          meta: { profileId, whyAr: why.slice(0, 300) },
        })
        await notifyRole(this.prisma, ['academic_manager', 'super_admin'], {
          channel: 'in_app', templateKey: 'trainer.prep.seal_blocked',
          title: 'اعتمدت دورة لمدرّب ولم يوقّع عقده',
          body: `لم يوقّع تلقائيّا: ${why.slice(0, 300)} — وقّعه من صفّه في «العقود».`,
          data: { profileId, contractId: contract.id },
        }).catch(() => undefined)
      }
      return { sealed: false as const, blockedAr: why, told: told === 0 }
    }
  }

  /** يلحق عقدَ النشط المعتمَدَ كالعقود الجديدة وقد اعتُمدت له دورةٌ بعد اعتماد توقيعه — من قبل قرار ٢٠ أكتوبر.
      والفاعلُ من اعتمد تلك الدورة. ولا يلحق «اكتملت دوراتُه» وحدَه: ذاك كان يُقال للإدارة «وقِّعْه الآن» فتركته */
  async sealFirstCourseActive(): Promise<{ sealed: string[]; blocked: number }> {
    /* والعرضُ المشروطُ للنشط وله شعبةٌ معتمَدة — يلحقه العاملُ (٢١ أكتوبر ٢٠٢٦). والفاعلُ من اعتمد آخرَ خططه */
    const conditional = await this.prisma.trainerProfile.findMany({
      where: {
        suspendedAt: null, application: { status: 'active' },
        contracts: { some: { gatesActivation: true, conditionMetAt: null, signatureApprovedAt: { not: null }, status: { in: SIGNATURE_APPROVED } } },
        cohortPlans: { some: { status: { in: APPROVED_PLAN }, reviewedBy: { not: null } } },
      },
      select: {
        id: true,
        cohortPlans: {
          where: { status: { in: APPROVED_PLAN }, reviewedBy: { not: null } },
          orderBy: { reviewedAt: { sort: 'desc', nulls: 'last' } }, take: 1, select: { reviewedBy: true },
        },
      },
    })
    const sealedConditional: string[] = []
    let blockedConditional = 0
    for (const p of conditional) {
      const r = await this.sealIfDue(p.id, p.cohortPlans[0]!.reviewedBy!)
      if (r?.sealed) sealedConditional.push(p.id)
      else if (r && 'blockedAr' in r) blockedConditional++
    }
    const rest = await this.sealFirstCourseActiveUnconditional()
    return { sealed: [...sealedConditional, ...rest.sealed], blocked: blockedConditional + rest.blocked }
  }

  private async sealFirstCourseActiveUnconditional(): Promise<{ sealed: string[]; blocked: number }> {
    const contracts = await this.prisma.trainerContract.findMany({
      where: {
        status: 'signature_approved', gatesActivation: false, signatureApprovedAt: { not: null },
        profile: { suspendedAt: null, application: { status: 'active' } },
      },
      select: { id: true, profileId: true, signatureApprovedAt: true, signatureApprovedBy: true },
    })
    const sealed: string[] = []
    let blocked = 0
    for (const c of contracts) {
      const first = await this.firstApprovalSince(c.profileId, c.signatureApprovedAt!)
      const actorId = first?.by ?? c.signatureApprovedBy
      if (!first || !actorId) continue
      const r = await this.sealIfDue(c.profileId, actorId)
      if (r?.sealed) sealed.push(c.id)
      else if (r && 'told' in r && r.told) blocked++
    }
    return { sealed, blocked }
  }

  /** بعد اعتذارٍ: لا شيءَ ينتظر وفي يده معتمَد — يُقال للإدارة إنّه جاهز.
      ولمن في الطور وحدَه: النشطُ يُعِدّ ما بقي له بعد تفعيله (٢٠ أكتوبر ٢٠٢٦)، فلا يُقال عنه «جاهز للتفعيل» */
  private async tellIfReady(profileId: string) {
    const [pending, qualified, profile] = await Promise.all([
      this.prisma.trainerCourseQualification.count({ where: { profileId, status: 'pending' } }),
      this.prisma.trainerCourseQualification.count({ where: { profileId, status: 'qualified' } }),
      this.prisma.trainerProfile.findUnique({ where: { id: profileId }, select: { application: { select: { status: true } } } }),
    ])
    if (pending > 0 || profile?.application.status !== 'onboarding') return
    /* و«جاهز» لمن اعتُمدت له خطّةُ شعبة («Approved cohort only»): من أُهِّل بلا خطّةٍ يُعِدّ شعبتَه، لا عليك فيه شيء */
    if (qualified > 0 && await this.approvedPlans(profileId) === 0) return
    await notifyRole(this.prisma, ['academic_manager', 'super_admin'], {
      channel: 'in_app', templateKey: 'trainer.prep.nothing_pending',
      title: qualified > 0 ? 'مدرّب جاهز للتفعيل' : 'مدرّب اعتذر عن دوراته كلّها',
      body: qualified > 0
        ? 'اعتمدت دوراته التي قبلها واعتذر عن الباقي — فعّله من ملفّه.'
        : 'لم يبق له دورة في طور الإعداد — راجع ملفّه.',
      data: { profileId },
    }).catch(() => undefined)
  }
}
