/* خدمة التسجيل — إلحاق المتعلمين بالشعب مع حراسة السعة والوصول.
   القاعدة الذهبية: لا يرى المتعلم محتوى شعبة غير مسجل فيها. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { projectPlanForLearner, PLAN_VISIBLE_STATUSES } from '../../src/application/trainer/plan-overlay'
import { recordAudit } from './audit'
import { NotificationService, safeNotify } from './notification.service'
import { cohortAcceptsRegistration, PLAN_GATE_SELECT, TERM_WINDOW_SELECT } from './registration-window'
import { CohortService } from './cohort.service'
import { SEATED, SessionInviteService } from './session-invite.service'
import { LEARNER_SESSION_WHERE } from './session-visibility'
import { assessmentOpensAt, cohortDayAr, gateAssessment, learnerGate, meetingOver } from '../../src/application/learning/cohort-gate'

/* ═══ مدرّبُ الشعبة كما يراه متعلّمُها: اسمُه، لا ملفُّه ═══

   كان الاستعلامُ `include: { profile: … }` — فيخرج صفُّ `TrainerProfile`
   كاملا إلى متصفّح كلّ متعلّم: اسمُه القانونيّ، ومعرّفُ حسابه، ومفتاحُ صورةٍ
   لم تُعتمد بعد، وحالةُ إيقافه. والشاشةُ لا تقرأ منه إلّا الاسم. فصار انتقاءً
   لا تضمينا — وحقلٌ يُضاف إلى الملفّ غدا لا يصل متعلّما. */
const LEARNER_TRAINER_SELECT = {
  select: { role: true, profile: { select: { application: { select: { fullName: true } } } } },
} as const

/* ═══ والمهمّةُ كما يراها متعلّمُها: المعتمَدُ وحدَه (٣ج-٣) ═══

   طلبُ المدرّب على مهمّةٍ منشورةٍ يُحفظ في صفّها نفسِه (`pendingChange`) حتّى
   تقرّره الإدارة، وسببُ ردّها بجانبه (`reviewerNote`). والصفُّ يخرج إلى المتعلّم
   كاملا — فلو لم يُستثنَ العمودان لقرأ في متصفّحه عنوانا لم يُعتمَد، وخلافا بين
   مدرّبه والإدارة لا شأنَ له به. */
const LEARNER_ASSESSMENT_OMIT = { pendingChange: true, reviewerNote: true } as const

export class EnrollmentService {
  private prisma: PrismaClient
  private notifications: NotificationService
  /* كسولٌ لا في الباني: `CohortService` يستورد هذه الخدمة، فبناؤها هنا
     مباشرةً حلقةُ استيرادٍ تُفرغ أحدَ الطرفَين وقتَ التحميل. */
  private _cohorts: CohortService | null = null
  private get cohorts(): CohortService {
    if (!this._cohorts) this._cohorts = new CohortService(this.prisma)
    return this._cohorts
  }
  private invites: SessionInviteService
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.notifications = new NotificationService(prisma)
    this.invites = new SessionInviteService(prisma)
  }

  /** الرمزُ الذي يُختم على تسجيل هذه الشعبة — أو لا شيء */
  private async referralFor(code: string, cohortId: string): Promise<{ profileId: string; code: string } | null> {
    const link = await this.prisma.trainerReferralLink.findUnique({
      where: { code }, select: { profileId: true, code: true, cohortId: true },
    })
    if (!link) return null
    if (link.cohortId === cohortId) return { profileId: link.profileId, code: link.code }
    if (link.cohortId !== null) return null
    const teaches = await this.prisma.cohortTrainer.findFirst({ where: { cohortId, profileId: link.profileId }, select: { id: true } })
    return teaches ? { profileId: link.profileId, code: link.code } : null
  }

  /** تسجيل متعلم — يملأ السعة ثم يحوّل الفائض لقائمة انتظار؛ التجاوز يتطلب override موثقا */
  /* و`announce` رايةٌ صريحة: مسارُ الشراء يُبلّغ بنفسه («تأكد دفعك ✓ …
     مقاعدك صارت تسجيلاً فعلياً») بعد التسوية، فلا رسالتان عن شيءٍ واحد. */
  async enroll(
    cohortId: string, userId: string, actorId: string | null,
    opts: { overrideCapacity?: boolean; referralCode?: string; announce?: boolean } = {},
  ) {
    /* مصدرُ التسجيل يُختم مرّةً: رمزٌ صحيحٌ يخصّ هذه الشعبةَ — وإلّا عامّ.

       والرمزُ نوعان (١٣ سبتمبر ٢٠٢٦): رمزُ شعبةٍ بعينها، ورمزُ المدرّب على
       كامل ما يدرّب (`cohortId = null`). والثاني يُختم هنا **بشرط أن يكون
       صاحبُه مدرّبَ هذه الشعبة** — فالختمُ حجّةُ الأجر، ولا يُختم لمن لم
       يدرّب. والفحصُ في هذا الموضع لا في المتصل به وحدَه: `enroll` يُنادى
       من التسوية ومن الإدارة معا. */
    const referral = opts.referralCode
      ? await this.referralFor(opts.referralCode, cohortId)
      : null
    const cohort = await this.prisma.cohort.findUnique({
      where: { id: cohortId },
      include: { term: TERM_WINDOW_SELECT, plans: PLAN_GATE_SELECT },
    })
    if (!cohort) throw new AuthError('not_found', 'الشعبة غير موجودة', 404)
    if (!['open', 'full', 'active'].includes(cohort.status)) {
      throw new AuthError('closed', 'التسجيل في هذه الشعبة غير مفتوح', 409)
    }
    const window = cohortAcceptsRegistration(cohort)
    if (!window.open) throw new AuthError('closed', window.reasonAr, 409)
    /* حالاتُ الحساب التي يجوز التسجيلُ فيها.

       كان الشرطُ `status !== 'active'` فيرفض، فكان **المتعلّمُ المدعوُّ لا
       يمكن تسجيلُه أبدا**: الإداريُّ ينشئ له حسابا (فيصير `invited` حتّى يقبل
       الدعوةَ ويضع كلمتَه) ثمّ يحاول وضعَه في شعبةٍ فيُردّ بـ«المستخدم غير
       موجود أو موقوف» — وهو موجودٌ وليس موقوفا. فبقي المسارُ الوحيدُ أن يسجّل
       الطالبُ نفسَه، وهو نقيضُ الغاية من إنشاء الحساب له.

       والمقعدُ يُحجَز قبل أوّل دخوله عمدا: يقبل دعوتَه فيجد شعبتَه في
       انتظاره، لا شاشةً فارغةً ورسالةً ثانيةً تُطلب.

       و`suspended` و`archived` تبقيان مرفوضتين — والرسالةُ تقول أيَّهما وقع
       بدل أن تجمعهما في «غير موجود أو موقوف». */
    const ENROLLABLE_STATUSES = ['active', 'invited']
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { roles: true } })
    if (!user) throw new AuthError('unknown_user', 'المستخدم غير موجود', 404)
    if (!ENROLLABLE_STATUSES.includes(user.status)) {
      throw new AuthError('unknown_user', `لا يُسجَّل حسابٌ حالتُه «${user.status}» — ارفع الإيقافَ أوّلا`, 409)
    }

    const existing = await this.prisma.enrollment.findUnique({ where: { cohortId_userId: { cohortId, userId } } })
    if (existing && existing.status !== 'dropped') throw new AuthError('already_enrolled', 'المتعلم مسجل في هذه الشعبة مسبقا', 409)

    const enrolledCount = await this.prisma.enrollment.count({ where: { cohortId, status: 'enrolled' } })
    const capacity = cohort.capacity ?? 0
    let status: 'enrolled' | 'waitlisted' = 'enrolled'
    let override = false
    if (capacity > 0 && enrolledCount >= capacity) {
      if (!opts.overrideCapacity) status = 'waitlisted'
      else override = true
    }

    const stamp = referral ? { referralProfileId: referral.profileId, referralCode: referral.code } : {}
    const enrollment = existing
      ? await this.prisma.enrollment.update({
          where: { id: existing.id },
          /* ولا يُكتب فوق مصدرٍ مختوم: أوّلُ ختمٍ هو الحجّة */
          data: { status, overrideCapacity: override, enrolledBy: actorId, ...(existing.referralProfileId ? {} : stamp) },
        })
      : await this.prisma.enrollment.create({
          data: { cohortId, userId, status, overrideCapacity: override, enrolledBy: actorId, ...stamp },
        })

    /* امتلاء السعة يقلب حالة الشعبة إلى full */
    const nowEnrolled = await this.prisma.enrollment.count({ where: { cohortId, status: 'enrolled' } })
    if (capacity > 0 && nowEnrolled >= capacity && cohort.status === 'open') {
      await this.prisma.cohort.update({ where: { id: cohortId }, data: { status: 'full' } })
    }

    /* تجهيز سجل التقدم الفارغ */
    await this.prisma.courseProgress.upsert({
      where: { enrollmentId: enrollment.id },
      update: {},
      create: { enrollmentId: enrollment.id, percent: 0, evidence: {} },
    })

    await recordAudit(this.prisma, {
      actorId, action: 'enrollment.create', entityType: 'enrollment', entityId: enrollment.id,
      meta: { cohortId, userId, status, overrideCapacity: override },
    })

    /* ═══ ويعلم من سُجّل أنّه سُجّل (ي-٤) ═══

       كان يُخبَر به على مسار الشراء وحدَه — `settleOrder` يرسل «تأكد دفعك».
       أمّا مسارُ الإدارة (تسجيلُ موظّفٍ لمتعلّم) فصامت، **وقائمةُ الانتظار
       أصمتُ منه**: من امتلأت الشعبةُ دونه يُوضع في الطابور ولا يُقال له —
       فيظنّ نفسَه مسجَّلا حتّى يُفاجأ، أو يظنّ أنّ شيئا لم يقع.
       (والترقيةُ من الطابور كانت تُخبَر من قبلُ — فكان يُبشَّر بالخروج من
       صفٍّ لم يعلم أنّه دخله.) */
    if (opts.announce !== false) {
      const title = cohort.title
      await safeNotify(this.prisma, {
        userId, channel: 'in_app', audience: 'learner',
        templateKey: status === 'waitlisted' ? 'enrollment.waitlisted' : 'enrollment.confirmed',
        title: status === 'waitlisted' ? `أُضفتَ إلى قائمة انتظار «${title}»` : `سُجّلت في «${title}»`,
        body: status === 'waitlisted'
          ? `امتلأت «${title}»، فأُضفتَ إلى قائمة انتظارها — ونُعلمك فورَ أن يشغر مقعد. ولا يلزمك شيءٌ الآن.`
          : `سُجّلت في «${title}» — تجد جلساتِها وموادَّها في «تعلُّمي».`,
        data: { cohortId, enrollmentId: enrollment.id, status },
      })
    }

    /* ورابطُه في كلّ لقاءٍ لم يُعقد، ثمّ جدولُه (`seatTaken`). والملتحقُ وحدَه: من
       في قائمة الانتظار لم يستحقّ مقعدا بعد.

       ولا يُسكته `announce: false`: ذاك جرسُ «سُجّلت» يُغني عنه «تأكّد دفعك» على
       مسار الشراء، والجدولُ لا يرسله أحدٌ سواه — والشراءُ أكثرُ من يلتحق بعد
       الاعتماد. */
    if (status === 'enrolled') await this.seatTaken(enrollment.id, cohortId)
    return enrollment
  }

  /* ─────────── مقعدٌ صار له — رابطُه في Zoom ثمّ جدولُه ───────────

     الروابطُ تُنشأ حين يُنشأ الاجتماع، ومن التحق **بعد** ذلك لا رابطَ له —
     فيدخل بالرابط المشترك ولا يُطابَق في تقرير الحضور، ويُقرأ غائبا وهو
     حاضر. فيؤخذ له رابطُه هنا.

     ثمّ رسالةٌ واحدةٌ بما بقي من لقاءات شعبته، كلٌّ برابطه وفي ملفّ تقويم
     (`SessionInviteService.welcome`) — «or jon later directly».

     وكان الرابطُ في `enroll` وحدَه: فالمرقّى من قائمة الانتظار والمنتقلُ من شعبةٍ
     أخرى يدخلان بلا رابطٍ خاصّ، ويُقرآن غائبَين وهما حاضران.

     والسقوطُ يُبتلع — مقعدٌ يسقط لأنّ Zoom أو البريدَ لم يردّ عطبٌ أكبرُ من
     غياب الرابط أو الرسالة، والسببُ مكتوبٌ في `syncState` وفي السجلّ. */
  private async seatTaken(enrollmentId: string, cohortId: string) {
    const upcoming = await this.prisma.cohortSession.findMany({
      where: { ...LEARNER_SESSION_WHERE, cohortId, startsAt: { gte: new Date() }, zoom: { provider: 'zoom_api' } },
      select: { id: true },
    })
    for (const s of upcoming) {
      await this.cohorts.ensureSessionJoinLinks(s.id).catch(() => { /* الرابطُ رفاهيةٌ لا شرطُ التحاق */ })
    }
    await this.invites.welcome(enrollmentId).catch((e: unknown) => {
      console.error(`[invite] تعذّرت كتابةُ جدول الملتحق (${enrollmentId})`, e)
    })
  }

  /* ─────────── ومن ترك مقعدَه — رابطُه عند Zoom ثمّ تقويمُه ───────────

     رابطُه الخاصُّ يُلغى عند Zoom أوّلا (`CohortService.releaseSessionJoinLinks`):
     هو في بريده منذ الدعوات، ويُدخله لقاءاتِ شعبةٍ لم تعد شعبتَه ما بقي تسجيلُه.
     ثمّ تُرفع لقاءاتُها المقبلة من تقويمه (`SessionInviteService.release`).

     ولا يُسقط إخفاقُهما تركا وقع: ما أبى فيه Zoom تُعيده دورةُ العامل
     (`revoke_left_registrants`)، والسببُ في السجلّ. */
  private async seatLeft(enrollmentId: string, userId: string, cohortId: string, whyAr: string) {
    await this.cohorts.releaseSessionJoinLinks({ enrollmentId })
      .then((r) => {
        if (r.failed > 0) console.error(`[zoom] بقي ${r.failed} من تسجيلات من ترك قائما (${enrollmentId}): ${r.reason}`)
      })
      .catch((e: unknown) => { console.error(`[zoom] تعذّر إلغاءُ تسجيل من ترك (${enrollmentId})`, e) })
    const who = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, displayName: true } })
    if (!who?.email) return
    await this.invites.release({ email: who.email, name: who.displayName }, cohortId, whyAr).catch((e: unknown) => {
      console.error(`[invite] تعذّر رفعُ لقاءات الشعبة من تقويم من تركها (${cohortId})`, e)
    })
  }

  /* تبديلُ الشعبة قبل أن تبدأ — الدورةُ نفسُها، والمقعدُ يُنقل لا يُشترى.

     قرارُ صاحب المنصّة: «لا يحقّ له تغيير مساره بعد الدفع. فقط التنقّل بين
     الشعب ما دامت لم تبدأ بالفعل».

     وقيدُ **الدورة نفسِها** هو تطبيقُ الشقّ الأوّل: لو جاز الانتقال إلى شعبة
     دورةٍ أخرى لصار «تبديلُ شعبة» بابا خلفيّا لتبديل المسار كلِّه، دورةً
     دورة، بلا فاتورةٍ ولا فرقِ سعر.

     وقيدُ **قبل البدء** هو الشقّ الثاني، ويُقاس بموعد الشعبة **المغادَرة**
     أيضا: من حضر جلستين ثمّ انتقل يأخذ محتوى شعبةٍ لم يبدأها ويترك أثرَه في
     أخرى — والحضورُ والتسليماتُ معلَّقةٌ بالتسجيل لا بالشعبة، فتنتقل معه إلى
     شعبةٍ لم تُعقد جلساتُها.

     والسعرُ لا يُتجاوَز صامتا: شعبةٌ أغلى تُرفض برسالةٍ تقول لماذا، لا
     تُقبَل فتُؤخذ قيمةٌ لم تُدفع. والأرخصُ يُقبَل — فالدورةُ هي هي، والفرقُ
     تاريخُ تسعير الشعبة لا ما يناله المتعلّم. */
  async switchCohort(userId: string, enrollmentId: string, toCohortId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { cohort: true, _count: { select: { attendance: true, submissions: true, attempts: true } } },
    })
    if (!enrollment || enrollment.userId !== userId) {
      throw new AuthError('not_found', 'هذا التسجيل ليس لك', 404)
    }
    if (enrollment.status !== 'enrolled') {
      throw new AuthError('not_switchable', 'لا يُبدَّل إلا تسجيلٌ قائم', 409)
    }
    if (enrollment.cohortId === toCohortId) {
      throw new AuthError('same_cohort', 'هذه شعبتك الحالية', 409)
    }

    const now = new Date()
    if (enrollment.cohort.startsAt && enrollment.cohort.startsAt <= now) {
      throw new AuthError('already_started', 'شعبتك بدأت — راسلنا لترتيب نقلك', 409)
    }
    const { attendance, submissions, attempts } = enrollment._count
    if (attendance + submissions + attempts > 0) {
      /* أثرٌ في شعبةٍ «لم تبدأ» بحسب التقويم: جلسةٌ قُدّمت أو تسليمٌ مبكّر.
         والأثرُ معلَّقٌ بالتسجيل، فينتقل معه إلى شعبةٍ لم تُعقد جلساتُها. */
      throw new AuthError('has_activity', 'لك نشاطٌ مسجَّل في هذه الشعبة — راسلنا لترتيب نقلك', 409)
    }

    const to = await this.prisma.cohort.findUnique({
      where: { id: toCohortId },
      include: { term: TERM_WINDOW_SELECT, plans: PLAN_GATE_SELECT },
    })
    if (!to) throw new AuthError('not_found', 'الشعبة غير موجودة', 404)
    if (to.courseId !== enrollment.cohort.courseId) {
      throw new AuthError('other_course', 'التبديل بين شعب الدورة نفسها — ولا يُغيَّر المسار بعد الدفع', 409)
    }
    if (!['open', 'full'].includes(to.status)) {
      throw new AuthError('closed', `التسجيل مغلق في «${to.title}»`, 409)
    }
    const toWindow = cohortAcceptsRegistration(to, now)
    if (!toWindow.open) throw new AuthError('closed', toWindow.reasonAr, 409)
    if (to.startsAt && to.startsAt <= now) {
      throw new AuthError('already_started', `«${to.title}» بدأت — اختر شعبةً لم تبدأ`, 409)
    }
    if (to.price !== null && enrollment.cohort.price !== null && Number(to.price) > Number(enrollment.cohort.price)) {
      throw new AuthError('price_higher', `«${to.title}» أعلى سعرا ممّا دفعت — راسلنا لتسوية الفرق`, 409)
    }
    if (to.capacity) {
      const [enrolled, held] = await Promise.all([
        this.prisma.enrollment.count({ where: { cohortId: to.id, status: 'enrolled' } }),
        this.prisma.enrollmentRequest.count({ where: { cohortId: to.id, status: 'seat_held' } }),
      ])
      if (enrolled + held >= to.capacity) throw new AuthError('capacity_full', `لا مقاعد متاحة في «${to.title}»`, 409)
    }
    /* مقعدٌ في الوجهة من قبل — لا يُنشأ تسجيلان لدورةٍ واحدة */
    const clash = await this.prisma.enrollment.findUnique({
      where: { cohortId_userId: { cohortId: to.id, userId } },
    })
    if (clash && clash.status !== 'dropped') {
      throw new AuthError('already_enrolled', `أنت مسجّل في «${to.title}» بالفعل`, 409)
    }

    const from = enrollment.cohort
    const moved = await this.prisma.$transaction(async (tx) => {
      /* المقعدُ المتروكُ في الوجهة يُحذف ليخلو الطريقُ للقيد الفريد
         (cohortId, userId). وقد يكون له تاريخٌ لا يُمحى — شهادةٌ صادرة —
         فالقاعدةُ ترفض المحوَ بـ`Restrict` وتُلقي خطأً لا يفهمه أحد. فيُقال
         السببُ قبل أن يقع، بالعربيّة، وباسم الشيء لا برمزِ قيد. */
      if (clash) {
        const issued = await tx.certificate.count({ where: { enrollmentId: clash.id } })
        if (issued > 0) {
          throw new AuthError(
            'certificate_on_dropped_seat',
            `لك في «${to.title}» مقعدٌ سابقٌ صدرت عنه ${issued === 1 ? 'شهادة' : `${issued} شهادات`} — ولا تُمحى الشهادةُ لتحويلِ مقعد. راسلنا لنعيد فتح مقعدك هناك.`,
            409,
          )
        }
        await tx.enrollment.delete({ where: { id: clash.id } })
      }
      const e = await tx.enrollment.update({ where: { id: enrollmentId }, data: { cohortId: to.id } })
      /* سجلُّ حجز المقعد ينتقل معه: تركُه على الشعبة المغادَرة يُبقيها تُحسب
         ممتلئةً بمقعدٍ لا أحد فيه، ويُخرج الوجهةَ من عدّ المقاعد. */
      const req = await tx.enrollmentRequest.findUnique({
        where: { userId_cohortId: { userId, cohortId: from.id } },
      })
      if (req) {
        const atTarget = await tx.enrollmentRequest.findUnique({
          where: { userId_cohortId: { userId, cohortId: to.id } },
        })
        if (atTarget) await tx.enrollmentRequest.delete({ where: { id: atTarget.id } })
        await tx.enrollmentRequest.update({ where: { id: req.id }, data: { cohortId: to.id } })
      }
      /* الشعبةُ المغادَرة تعود مفتوحةً إن كانت أُغلقت بالامتلاء وحدَه */
      if (from.status === 'full' && from.capacity) {
        const left = await tx.enrollment.count({ where: { cohortId: from.id, status: 'enrolled' } })
        if (left < from.capacity) await tx.cohort.update({ where: { id: from.id }, data: { status: 'open' } })
      }
      if (to.status === 'open' && to.capacity) {
        const filled = await tx.enrollment.count({ where: { cohortId: to.id, status: 'enrolled' } })
        if (filled >= to.capacity) await tx.cohort.update({ where: { id: to.id }, data: { status: 'full' } })
      }
      return e
    })

    await recordAudit(this.prisma, {
      actorId: userId, action: 'enrollment.switch_cohort', entityType: 'enrollment', entityId: enrollmentId,
      meta: {
        courseId: from.courseId,
        from: from.id, fromTitle: from.title, fromStartsAt: from.startsAt,
        to: to.id, toTitle: to.title, toStartsAt: to.startsAt,
      },
    })
    /* وصاحبُ المقعد هو الفاعلُ هنا ويرى الجوابَ في الحال — فهذا أخفُّ ما في
       الباب. لكنّ المقعدَ والموعدَ تحرّكا فعلا، وهو ما يصفه صنفُ «تغييرٌ في
       شعبتك» حرفا. وصفٌّ في جرسه يبقى مرجعا حين يُسأل بعد شهر: متى نُقلت؟ */
    await safeNotify(this.prisma, {
      userId, channel: 'in_app', audience: 'learner',
      templateKey: 'enrollment.switched',
      title: `نُقل مقعدُك إلى «${to.title}»`,
      body: `نُقل مقعدُك من «${from.title}» إلى «${to.title}»`
        + (to.startsAt ? ` — وتبدأ ${cohortDayAr(to.startsAt)}.` : '.')
        + ' تجد جلساتِها ومادّتها في «تعلُّمي».',
      data: { enrollmentId, from: from.id, to: to.id },
    })
    /* وتقويمُه ينتقل معه: لقاءاتُ المغادَرة تُرفع — وإلّا رأى شعبتَين في أسبوعٍ
       فحضر ما ليس له — ولقاءاتُ الوجهة تصله برابطه. */
    await this.seatLeft(enrollmentId, userId, from.id, `انتقل مقعدُك إلى «${to.title}» — وتصلك مواعيدُها في رسالتها.`)
    await this.seatTaken(enrollmentId, to.id)
    return moved
  }

  async drop(enrollmentId: string, actorId: string | null, note?: string) {
    /* الحالُ قبل الإسقاط: من كان في قائمة الانتظار لم يُدعَ إلى شيءٍ فلا يُرفع له شيء */
    const before = await this.prisma.enrollment.findUnique({ where: { id: enrollmentId }, select: { status: true } })
    const e = await this.prisma.enrollment.update({ where: { id: enrollmentId }, data: { status: 'dropped' } })
    await recordAudit(this.prisma, { actorId, action: 'enrollment.drop', entityType: 'enrollment', entityId: enrollmentId, meta: { note } })

    /* ═══ ويُخبَر من أُسقط تسجيلُه، لا من أخذ مقعدَه وحدَه (ي-٤) ═══

       كان في هذه الطريقة إشعارٌ واحدٌ يخرج — `fillSeatFromWaitlist` أدناه
       يُبشّر **من دخل المقعدَ الشاغر**. فالفعلُ يبدو مُخبِرا وهو يُخبر إنسانا
       آخر: صاحبُ المقعد يجد شعبتَه اختفت من «رحلتي» بلا كلمة.

       وهذا بعينه حدُّ حارس ي-٣: يثبت أنّ **أحدا** يُخبَر، ولا يعرف المرسَلَ
       إليه ولا يُخمّنه — ولذلك لا يُصلَح في الحارس بل هنا. */
    const cohort = await this.prisma.cohort.findUnique({ where: { id: e.cohortId }, select: { title: true } })
    try {
      await this.notifications.notify({
        userId: e.userId,
        channel: 'in_app',
        templateKey: 'enrollment.dropped',
        title: 'أُسقط تسجيلُك',
        body: `أُسقط تسجيلُك في «${cohort?.title ?? 'شعبتك'}»، فلم تعد جلساتُها ولا موادُّها تظهر في «تعلُّمي»${note ? `. والسببُ المسجَّل: ${note}` : ''}. راسِلنا إن كان في الأمر خطأ.`,
        data: { cohortId: e.cohortId, enrollmentId },
        audience: 'learner',
      })
    } catch { /* الإشعارُ خدمةٌ مساندة — لا يُبطل إسقاطا وقع */ }
    if (before && SEATED.includes(before.status)) {
      await this.seatLeft(enrollmentId, e.userId, e.cohortId, `أُسقط تسجيلُك في «${cohort?.title ?? 'شعبتك'}»، فرُفعت لقاءاتُها من تقويمك.`)
    }

    const promoted = await this.fillSeatFromWaitlist(e.cohortId, actorId)
    return { ...e, promotedEnrollmentId: promoted?.id ?? null }
  }

  /* ─────────── المقعدُ الشاغرُ يُملأ من الطابور ───────────

     قرارُ صاحب المنصّة: «ترقيةٌ تلقائيّة من قائمة الانتظار عند انسحاب أحدهم».

     وكان المقعدُ يُخلى فيبقى خاليا: قائمةُ الانتظار تنتظر فعلا من يقرأها،
     والشعبةُ تبقى موسومةً `full` وإن شغرت — فلا هي تُشترى ولا هي تُرقّي.

     والترتيبُ بأقدميّة الانتظار (`createdAt`) لا بشيءٍ آخر: من انتظر أوّلا
     يدخل أوّلا، وأيُّ ترتيبٍ غيره يحتاج قرارا بشريّا لا تلقائيّا.

     والحسابُ داخل معاملةٍ واحدة: انسحابان متزامنان على مقعدين قد يرقّيان
     ثلاثةً لو عُدّ المسجَّلون خارجها. */
  private async fillSeatFromWaitlist(cohortId: string, actorId: string | null) {
    const promoted = await this.prisma.$transaction(async (tx) => {
      const cohort = await tx.cohort.findUnique({ where: { id: cohortId } })
      if (!cohort) return null
      const capacity = cohort.capacity ?? 0
      const enrolled = await tx.enrollment.count({ where: { cohortId, status: 'enrolled' } })
      /* سعةٌ بلا حدّ (0) لا طابورَ لها أصلا: كلُّ داخلٍ يُسجَّل مباشرة */
      if (capacity > 0 && enrolled >= capacity) return null

      const next = await tx.enrollment.findFirst({
        where: { cohortId, status: 'waitlisted' },
        orderBy: { createdAt: 'asc' },
      })
      if (!next) {
        /* لا منتظِر: الشعبةُ الموسومةُ ممتلئةً تعود مفتوحةً — وإلّا بقي
           المقعدُ شاغرا على الورق مغلقا على الشاشة. */
        if (cohort.status === 'full') {
          await tx.cohort.update({ where: { id: cohortId }, data: { status: 'open' } })
        }
        return null
      }

      const moved = await tx.enrollment.update({ where: { id: next.id }, data: { status: 'enrolled' } })
      await tx.courseProgress.upsert({
        where: { enrollmentId: moved.id },
        update: {},
        create: { enrollmentId: moved.id, percent: 0, evidence: {} },
      })
      /* وإن كان المرقَّى آخرَ ما تسعه: تبقى ممتلئة. وإن بقي مقعدٌ: تُفتح. */
      const after = await tx.enrollment.count({ where: { cohortId, status: 'enrolled' } })
      const nextStatus = capacity > 0 && after >= capacity ? 'full' : 'open'
      if (cohort.status !== nextStatus && ['open', 'full'].includes(cohort.status)) {
        await tx.cohort.update({ where: { id: cohortId }, data: { status: nextStatus } })
      }
      return { moved, cohortTitle: cohort.title }
    })

    if (!promoted) return null

    await recordAudit(this.prisma, {
      actorId, action: 'enrollment.waitlist.promote', entityType: 'enrollment', entityId: promoted.moved.id,
      meta: { cohortId, userId: promoted.moved.userId, reason: 'seat_freed_by_drop' },
    })

    /* ولا تُبتلع خيبةُ الإشعار: من رُقّي وهو لا يعلم يظنّ نفسَه منتظِرا،
       فيُسجَّل الفشلُ ولا يُسقط الترقيةَ نفسَها. */
    try {
      await this.notifications.notify({
        userId: promoted.moved.userId,
        channel: 'in_app',
        templateKey: 'enrollment.waitlist.promoted',
        title: `دخلتَ الشعبة: ${promoted.cohortTitle}`,
        body: `شغر مقعدٌ في «${promoted.cohortTitle}» فانتقلتَ من قائمة الانتظار إلى المسجَّلين. تجد جلساتها ومادّتها في «تعلُّمي».`,
        data: { cohortId, enrollmentId: promoted.moved.id },
        audience: 'learner',
      })
    } catch { /* الإشعارُ خدمةٌ مساندة — لا يُبطل ترقيةً وقعت */ }
    await this.seatTaken(promoted.moved.id, cohortId)

    return promoted.moved
  }

  /** حارس الوصول: هل هذا المستخدم مسجل (وليس منسحبا) في شعبة هذا المحتوى؟ */
  async assertEnrolled(userId: string, cohortId: string) {
    const e = await this.prisma.enrollment.findUnique({ where: { cohortId_userId: { cohortId, userId } } })
    if (!e || e.status === 'dropped' || e.status === 'waitlisted') {
      throw new AuthError('not_enrolled', 'لا تملك وصولا لهذا المحتوى — أنت غير مسجل في هذه الشعبة', 403)
    }
    return e
  }

  /** هل المستخدم مدرب لهذه الشعبة؟ — حارس بوابة المدرب التشغيلية */
  async assertCohortTrainer(userId: string, cohortId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({ where: { userId } })
    if (!profile || profile.suspendedAt) throw new AuthError('not_trainer', 'لا ملف مدرب نشطا لهذا الحساب', 403)
    const link = await this.prisma.cohortTrainer.findUnique({
      where: { cohortId_profileId: { cohortId, profileId: profile.id } },
    })
    if (!link) throw new AuthError('not_cohort_trainer', 'هذه الشعبة ليست من شعبك', 403)
    return { profile, link }
  }

  /** محتوى المتعلم لشعبة — جلسات + روابط zoom + تسجيلات ومواد بروابط موقعة + حضوره */
  async learnerCohortView(enrollmentId: string, now = new Date()) {
    const e = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        cohort: {
          include: {
            course: { include: { versions: { orderBy: { version: 'desc' }, take: 1 } } },
            sessions: {
              where: LEARNER_SESSION_WHERE,
              orderBy: { startsAt: 'asc' },
              include: { zoom: true, recordings: { where: { status: 'active' } } },
            },
            materials: { where: { status: 'active' } },
            assessments: { where: { status: 'published' }, omit: LEARNER_ASSESSMENT_OMIT, include: { items: true, rubric: { include: { criteria: true } } } },
            trainers: LEARNER_TRAINER_SELECT,
            /* خطّةُ مدرّبِ الشعبة المعتمَدة — أحدثُها. والترشيحُ هنا على
               الحالة كذلك لا على الانتقاء وحدَه: لو عاد المشروعُ يوما بلا
               بوّابة، لم يصل هذا الاستعلامُ مسودّةً أصلا. */
            plans: {
              where: { trainerId: { not: null }, status: { in: [...PLAN_VISIBLE_STATUSES] } },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { status: true, content: true },
            },
          },
        },
        attendance: true,
        courseProgress: true,
        moduleProgress: true,
        submissions: { include: { grades: { include: { history: true } }, feedback: true, assessment: { omit: LEARNER_ASSESSMENT_OMIT } } },
        attempts: { include: { grades: true, assessment: { omit: LEARNER_ASSESSMENT_OMIT } } },
        certificates: { include: { revocation: true } },
      },
    })
    if (!e) throw new AuthError('not_found', 'التسجيل غير موجود', 404)
    /* الخطّةُ تخرج **مشروعةً** لا خاما: `content` يحمل اقتراحاتِ المدرّب
       على الإدارة وملاحظتَه على اللقاءات، وليستا للمتعلّم. والصفُّ نفسُه
       يُنزع من الحمولة كي لا يخرج من بابٍ آخرَ غدا. */
    const { plans, ...cohort } = e.cohort
    const plan = plans[0] ?? null

    /* ═══ لكلّ شيءٍ وقتُه — والخادمُ يحجب لا الشاشة (٢(ب-٢)) ═══

       قراراتُ صاحب المنصّة بكلمة «go»: المتنُ والكرّاسةُ أوّلَ يوم الموعد،
       والمهامُّ والمصادرُ بعد أوّل لقاءٍ للمحور، وبعد انتهاء الشعبة ستّةُ
       أشهرٍ للقراءة ثمّ ينتهي الوصول. والقاعدةُ في `cohort-gate.ts`، وما
       اعتُمد بلا مواعيد لا بوّابةَ فيه — يمضي كما بدأ. */
    const gate = learnerGate({ content: plan?.content ?? null, cohort, sessions: cohort.sessions, now })
    const ended = gate.access === 'ended'
    return {
      ...e,
      cohort: {
        ...cohort,
        /* ولقاءٌ انتهى لا يُدخَل: يسقط رابطُه ورمزُه، ويبقى موعدُه وحضورُه
           وتسجيلُه. وبعد انتهاء الوصول لا تسجيلَ ولا مادّة. */
        sessions: cohort.sessions.map((s) => ({
          ...s,
          zoom: ended || meetingOver(s, s.zoom, now) ? null : s.zoom,
          recordings: ended ? [] : s.recordings,
        })),
        materials: ended ? [] : cohort.materials,
        assessments: cohort.assessments.map((a) => gateAssessment(a, assessmentOpensAt(gate, a.moduleId), gate.access, now)),
        trainerPlan: projectPlanForLearner(plan, now, gate),
      },
      /* ما يقوله للمتعلّم عن وقته في الشعبة — والشاشةُ تشرحه ولا تحسبه */
      access: {
        state: gate.access,
        closesAt: gate.window?.closesAt.toISOString() ?? null,
        accessEndsAt: gate.window?.accessEndsAt.toISOString() ?? null,
      },
    }
  }

  /** نواتج المتعلم — كلُّ ما سلّمه عبر تسجيلاته، مرتّبا بالأحدث.
      خزانةُ النواتج تُبنى عليها، وهي قراءةٌ محضة لما حدث فعلا: لا يظهر فيها
      ناتجٌ لم يُسلَّم، ولا يُوصف بالاعتماد ما لم يعتمده مدرّب. */
  async myArtifacts(userId: string) {
    const rows = await this.prisma.assignmentSubmission.findMany({
      where: { enrollment: { userId } },
      orderBy: { submittedAt: 'desc' },
      include: {
        assessment: {
          include: {
            cohort: { include: { course: { include: { versions: { orderBy: { version: 'desc' }, take: 1 } } } } },
          },
        },
        grades: { orderBy: { createdAt: 'asc' }, take: 1 },
        feedback: { orderBy: { createdAt: 'asc' }, take: 1 },
      },
    })
    /* لا مفاتيح تخزين إلى المتصفّح — الملف يُقرأ برابط موقّع عند طلبه */
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      submittedAt: r.submittedAt,
      reviewedAt: r.reviewedAt,
      hasFile: !!r.storageKey,
      textAnswer: r.textAnswer,
      reviewNote: r.reviewNote,
      moduleId: r.assessment.moduleId,
      assessmentTitle: r.assessment.title,
      assessmentType: r.assessment.type,
      cohortTitle: r.assessment.cohort.title,
      courseId: r.assessment.cohort.courseId,
      courseTitleAr: r.assessment.cohort.course.versions[0]?.titleAr ?? '',
      grade: r.grades[0] ? { score: Number(r.grades[0].score), maxScore: Number(r.grades[0].maxScore) } : null,
      feedbackAr: r.feedback[0]?.body ?? null,
    }))
  }

  async myEnrollments(userId: string) {
    return this.prisma.enrollment.findMany({
      where: { userId, status: { not: 'dropped' } },
      include: {
        cohort: {
          include: {
            course: { include: { versions: { orderBy: { version: 'desc' }, take: 1 } } },
            trainers: LEARNER_TRAINER_SELECT,
          },
        },
        courseProgress: true,
        certificates: true,
      },
      orderBy: { createdAt: 'asc' },
    })
  }

  /** شعب المدرب — لا يرى شعب غيره أبدا */
  async trainerCohorts(userId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({ where: { userId } })
    if (!profile || profile.suspendedAt) throw new AuthError('not_trainer', 'لا ملف مدرب نشطا لهذا الحساب', 403)
    const links = await this.prisma.cohortTrainer.findMany({
      where: { profileId: profile.id },
      include: {
        cohort: {
          include: {
            course: { include: { versions: { orderBy: { version: 'desc' }, take: 1 } } },
            sessions: { orderBy: { startsAt: 'asc' }, include: { zoom: true, recordings: true } },
            enrollments: {
              where: { status: { not: 'dropped' } },
              include: {
                courseProgress: true, attendance: true,
                /* الاسمُ وحدَه: المدرّبُ يراسل متعلّمَه من رسائل الشعبة لا من
                   بريده — فالبريدُ والرقمُ ملكُ المتعلّم، والمنصّةُ هي القناة. */
                user: { select: { displayName: true } },
              },
            },
            materials: true,
            assessments: { include: { submissions: true, items: true } },
          },
        },
      },
    })
    /* «ليتأكّد أنّنا لم نغشّ»: كلُّ متعلّمٍ يحمل علامةَ مصدره — عبر رابط هذا
       المدرّب أو عامّ. والمعرّفُ نفسُه لا يخرج؛ العلامةُ وحدَها. */
    return links.map((l) => ({
      role: l.role,
      cohort: {
        ...l.cohort,
        enrollments: l.cohort.enrollments.map((e) => ({ ...e, referredByMe: e.referralProfileId === profile.id, referralProfileId: undefined })),
      },
    }))
  }

  /** شعبةٌ واحدةٌ من شعبه — لصفحة الشعبة، بالشكل نفسِه الذي يعطيه `trainerCohorts` */
  async trainerCohort(userId: string, cohortId: string) {
    const row = (await this.trainerCohorts(userId)).find((r) => r.cohort.id === cohortId)
    if (!row) throw new AuthError('not_your_cohort', 'هذه الشعبة ليست مُسنَدةً إليك', 403)
    return row
  }
}
