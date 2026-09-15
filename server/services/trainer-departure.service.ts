/* رحيلُ مدرّب — بديلٌ أوّلا، ونقلٌ ثانيا، والاختيارُ لصاحبه ثالثا (ن-٩ · ن-١٠).

   ═══ الفرضيّةُ التي بُني عليها ═══

   «البرمجيّةُ تسجّل التزاما ولا تمنع إنسانا من الرحيل». فلا يدّعي هذا منعَ
   الرحيل — يفترض وقوعَه ويجعل التسليمَ لطيفا.

   ═══ ولا يُحرَّك مالٌ من هنا ═══

   الخدمةُ **تسجّل قرارا وتُحيل**: الردُّ يُرفع طلبا إلى الماليّة عبر
   `requestRefund` القائم، فيبقى إقرارُه بصلاحيّته المستقلّة (`processRefund`)
   كما هو. والرصيدُ كوبونٌ مقصورٌ على صاحبه — و`Coupon` تحمل `amountOff`
   و`restrictedToUserId` أصلا، فلا محفظةَ جديدة. وقد قال البندُ نفسُه: «آليّةُ
   الردّ قائمة، والناقصُ قاعدةُ من يقرّر».

   ═══ ولمَ لا يُعاد استعمالُ `switchCohort` في الطريق الثاني ═══

   ذاك بابُ المتعلّم إلى نفسِه: يشترط ألّا تكون الشعبةُ بدأت وألّا يكون له
   أثرٌ مسجَّل. وهو صوابٌ هناك — تبديلٌ بمزاجه قبل أن يبدأ شيء. وهذا غيرُه:
   الأكاديميّةُ تنقله لأنّ مدرّبَه رحل، ورّبما في منتصف الموسم وله حضورٌ
   وتسليمات. فإعادةُ استعماله تعني إضعافَ حرّاسه — ويُفتح بذلك بابُ المتعلّم
   لنقلٍ في منتصف الموسم. فبابان لفعلَين مختلفَين، ولكلٍّ أثرُه في السجلّ.

   ═══ والنظيرُ معرَّفٌ لا مجتهَدٌ فيه ═══

   ح-٣ يثمر هنا: النسخُ تتشارك `courseId`، فـ«شعبةٌ على الرمز نفسِه» هي
   مجموعةُ النظائر بالتعريف. «انقلهم إلى ما يشبهه» تكفّ عن كونها اجتهادا. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { NotificationService, notifyRole } from './notification.service'
import { CommerceService } from './commerce.service'
import {
  canClose, CHOICE_LABEL_AR, closeBlockersAr, isResolved, LEARNER_CHOICES, needsLearnerChoice,
  notifyBlockerAr, OUTCOME_OF_CHOICE, settleBlockerAr,
  type LearnerChoice, type ResolvedOutcome,
} from '../../src/application/trainer/departure-rules'

/* ═══ نصُّ كلِّ مآلٍ — و`Record` لا `switch` ═══

   كان `switch` بـ`default` يردّ «هناك تغييرٌ … سنوافيك بتفصيله» — وهي بعينها
   الجملةُ التي تمنعها القاعدةُ ①: خبرٌ بلا ما بعده. لم تكن تُبلَغ اليومَ،
   لكنّها كانت تنتظر مآلا خامسا يُضاف بلا نصّ، فتخرج حينها بلا أن يحمرّ شيء.

   و`Record<ResolvedOutcome, …>` يجعل المترجِمَ نفسَه هو الحارس: من زاد مآلا
   في `RESOLVED_OUTCOMES` ولم يكتب نصَّه لم يُبنَ المشروع. وحارسٌ في المترجِم
   لا يُنسى تشغيلُه. */
/** رمزُ رصيدِ الرحيل — يُشتقّ من معرّف الصفّ، ومالكُه واحد.

    وكان يُكتب في الكوبون هنا ولا يُقال لصاحبه: نصُّ `credited` أدناه لا
    يأخذ وسيطا أصلا، فيُخبَر أنّ له رصيدا ولا يُخبَر بما يستعمله. */
export function creditCouponCode(caseId: string): string {
  return `WJZ-CR-${caseId.slice(0, 8).toUpperCase()}`
}

const RESOLVED_MESSAGE: Record<ResolvedOutcome, (cohortTitle: string, caseId: string) => string> = {
  substituted: (t) => `تغيّر مدرّبُ «${t}». مقعدُك وجدولُك ومدفوعاتُك كما هي — ولم يتغيّر إلّا الاسم.`,
  moved: (t) => `نُقلت إلى شعبةٍ أخرى من الدورة نفسِها بعد تغيّرٍ في «${t}». جدولُك الجديدُ في «رحلتي».`,
  refund_requested: (t) => `بناءً على اختيارك، رُفع طلبُ ردِّ ما تبقّى من قيمة «${t}» إلى الماليّة.`,
  credited: (_t, caseId) => `بناءً على اختيارك، صُرف لك رصيدٌ باسمك يُخصَم من أيّ مسارٍ تختاره — ومعه زيادةٌ لأجلِ ما سبّبناه. ورمزُه: ${creditCouponCode(caseId)}`,
}

/** نصُّ عرضِ الاختيار — يُبنى من `LEARNER_CHOICES` فلا يبقى خيارٌ بلا ذكرٍ فيه */
function offerMessage(cohortTitle: string, noteAr: string | null): string {
  const options = LEARNER_CHOICES.map((c) => `• ${CHOICE_LABEL_AR[c]}`).join('\n')
  const why = noteAr?.trim() ? `\n\n${noteAr.trim()}` : ''
  return `رحل مدرّبُ «${cohortTitle}»، ولم نجد له بديلا ولا شعبةً نظيرةً تصلح لك.`
    + ` فالقرارُ لك وحدك، بين:\n${options}`
    + `\n\nاختر من «رحلتي» في بوّابتك — ولا يُحسم شيءٌ قبل أن تختار.${why}`
}

const COURSE_TITLE = {
  select: { id: true, currentVersion: true, versions: { select: { version: true, titleAr: true } } },
} as const
const titleOf = (c: { id: string; currentVersion: number; versions: { version: number; titleAr: string }[] }) =>
  c.versions.find((v) => v.version === c.currentVersion)?.titleAr ?? c.id

export class TrainerDepartureService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** يُفتح ملفُّ الرحيل: تُجمَع شعبُه الحيّة، ويُفتح لكلّ متعلّمٍ فيها صفٌّ.
   *
   *  ولا يُترك أحدٌ خارجَ القائمة: من كان `enrolled` في شعبةٍ لم تنتهِ يدخل،
   *  فالقائمةُ هي الذاكرةُ ولا ذاكرةَ سواها. */
  async open(actorId: string, profileId: string, reasonAr: string) {
    const reason = reasonAr.trim()
    if (reason.length < 5) throw new AuthError('no_reason', 'اكتب سببَ الرحيل — يُقرأ بعد سنةٍ حين يُسأل', 400)

    const profile = await this.prisma.trainerProfile.findUnique({
      where: { id: profileId }, select: { id: true, application: { select: { fullName: true } } },
    })
    if (!profile) throw new AuthError('no_profile', 'لا مدرّبَ بهذا المعرّف', 404)

    const live = await this.prisma.cohortTrainer.findMany({
      where: { profileId, cohort: { status: { in: ['draft', 'open', 'full', 'active'] } } },
      include: { cohort: { select: { id: true } } },
    })
    const cohortIds = live.map((c) => c.cohortId)

    const enrollments = cohortIds.length === 0 ? [] : await this.prisma.enrollment.findMany({
      where: { cohortId: { in: cohortIds }, status: 'enrolled' },
      select: { id: true, cohortId: true },
    })

    const departure = await this.prisma.$transaction(async (tx) => {
      const d = await tx.trainerDeparture.create({
        data: { profileId, reasonAr: reason, openedBy: actorId },
      })
      for (const e of enrollments) {
        await tx.departureCase.create({
          data: { departureId: d.id, enrollmentId: e.id, cohortId: e.cohortId },
        })
      }
      return d
    })

    await recordAudit(this.prisma, {
      actorId, action: 'trainer.departure.open', entityType: 'trainer_departure', entityId: departure.id,
      reason, meta: { trainer: profile.application.fullName, cohorts: cohortIds.length, learners: enrollments.length },
    })
    return { ...departure, cohorts: cohortIds.length, learners: enrollments.length }
  }

  /** ملفُّ رحيلٍ بكلّ اسمٍ فيه — وهو الشيءُ الواحدُ الذي يُتتبَّع */
  async detail(departureId: string) {
    const d = await this.prisma.trainerDeparture.findUnique({
      where: { id: departureId },
      include: {
        profile: { select: { id: true, application: { select: { fullName: true, email: true } } } },
        cases: {
          orderBy: { createdAt: 'asc' },
          include: {
            cohort: { select: { id: true, title: true, courseId: true, startsAt: true } },
            enrollment: { select: { id: true, user: { select: { id: true, displayName: true, email: true } } } },
          },
        },
      },
    })
    if (!d) throw new AuthError('not_found', 'لا ملفَّ رحيلٍ بهذا المعرّف', 404)

    return {
      id: d.id,
      trainerName: d.profile.application.fullName,
      trainerEmail: d.profile.application.email,
      profileId: d.profileId,
      reasonAr: d.reasonAr,
      openedAt: d.openedAt,
      closedAt: d.closedAt,
      closeBlockersAr: closeBlockersAr({ cases: d.cases }),
      canClose: canClose({ cases: d.cases }),
      cases: d.cases.map((c) => ({
        id: c.id,
        outcome: c.outcome,
        learnerName: c.enrollment.user.displayName,
        learnerEmail: c.enrollment.user.email,
        cohortId: c.cohortId,
        cohortTitle: c.cohort.title,
        courseId: c.cohort.courseId,
        notifiedAt: c.notifiedAt,
        choiceOfferedAt: c.choiceOfferedAt,
        learnerChoice: c.learnerChoice,
        noteAr: c.noteAr,
        resolvedAt: c.resolvedAt,
      })),
    }
  }

  async list(scope: 'open' | 'all' = 'open') {
    const rows = await this.prisma.trainerDeparture.findMany({
      where: scope === 'open' ? { closedAt: null } : {},
      orderBy: { openedAt: 'desc' },
      include: {
        profile: { select: { application: { select: { fullName: true } } } },
        cases: { select: { outcome: true, notifiedAt: true } },
      },
    })
    return rows.map((d) => ({
      id: d.id,
      trainerName: d.profile.application.fullName,
      reasonAr: d.reasonAr,
      openedAt: d.openedAt,
      closedAt: d.closedAt,
      total: d.cases.length,
      pending: d.cases.filter((c) => !isResolved(c.outcome)).length,
    }))
  }

  /* ═══ الطريقُ الأوّل: بديلٌ يأخذ مكانَه ═══ */

  /** من يصلح بديلا لهذه الشعبة — **تُنتجها المنصّةُ ولا تُبحث من الذاكرة**.
   *
   *  «المنصّةُ تعرف من يستطيع تدريسَ هذه الدورة: تأهيلُ مدرّبٍ لدورةٍ مسجَّلٌ
   *  لكلّ مدرّبٍ ولكلّ دورة». فالقائمةُ استعلامٌ لا اجتهاد. */
  async substitutesFor(cohortId: string) {
    const cohort = await this.prisma.cohort.findUnique({
      where: { id: cohortId }, select: { id: true, courseId: true },
    })
    if (!cohort) throw new AuthError('not_found', 'لا شعبةَ بهذا المعرّف', 404)

    const rows = await this.prisma.trainerCourseQualification.findMany({
      where: {
        courseId: cohort.courseId,
        profile: { suspendedAt: null, application: { status: 'active' } },
      },
      include: {
        profile: {
          select: {
            id: true, hoursTaught: true, ratingAvg: true, ratingCount: true,
            application: { select: { fullName: true, email: true } },
            /* ما على كاهله الآن — فلا يُحمَّل من هو محمَّل */
            cohortTrainers: {
              where: { cohort: { status: { in: ['open', 'full', 'active'] } } },
              select: { cohortId: true },
            },
          },
        },
      },
    })

    /* والترتيبُ بالبيّنة نفسِها التي تعرضها شاشةُ الإسناد: ساعاتٌ درّسها،
       وتقييمٌ من خرّيجين، ثمّ الأخفُّ حملا. */
    return rows
      .map((q) => ({
        profileId: q.profile.id,
        name: q.profile.application.fullName,
        email: q.profile.application.email,
        hoursTaught: q.profile.hoursTaught ?? 0,
        ratingAvg: q.profile.ratingAvg,
        ratingCount: q.profile.ratingCount ?? 0,
        liveCohorts: q.profile.cohortTrainers.length,
      }))
      .sort((a, b) =>
        (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0)
        || b.hoursTaught - a.hoursTaught
        || a.liveCohorts - b.liveCohorts)
  }

  /** يُسنَد البديلُ فيُحَلّ **كلُّ** متعلّمٍ في تلك الشعبة دفعةً.
   *
   *  وهذا هو الفرقُ الذي يجعل الطريقَ الأوّلَ أوّلا: «يبقى للمتعلّمين مقاعدُهم
   *  وجدولُهم ومالُهم. لا يتحرّك إلّا الاسم». فلا قرارَ فرديًّا هنا — القرارُ
   *  واحدٌ على الشعبة، ونتيجتُه واحدةٌ لكلّ من فيها. */
  async substitute(actorId: string, departureId: string, cohortId: string, newProfileId: string) {
    const cohort = await this.prisma.cohort.findUnique({
      where: { id: cohortId }, select: { id: true, courseId: true, title: true },
    })
    if (!cohort) throw new AuthError('not_found', 'لا شعبةَ بهذا المعرّف', 404)

    const qualified = await this.prisma.trainerCourseQualification.findFirst({
      where: { profileId: newProfileId, courseId: cohort.courseId },
    })
    if (!qualified) {
      throw new AuthError('not_qualified', 'هذا المدرّبُ غيرُ مؤهَّلٍ لدورة هذه الشعبة — أهّله أوّلا', 409)
    }

    const departed = await this.prisma.trainerDeparture.findUnique({
      where: { id: departureId }, select: { profileId: true, closedAt: true },
    })
    if (!departed) throw new AuthError('not_found', 'لا ملفَّ رحيلٍ بهذا المعرّف', 404)
    if (departed.closedAt) throw new AuthError('closed', 'أُغلق ملفُّ الرحيل', 409)

    /* معرّفاتُ الصفوف تُقرأ **قبل** حلّها: `updateMany` يردّ عددا لا
       معرّفات، ومن حُلَّ أمرُه بلا معرّفٍ لا يُبلَّغ. */
    const pending = await this.prisma.departureCase.findMany({
      where: { departureId, cohortId, outcome: 'pending' },
      select: { id: true },
    })
    const n = await this.prisma.$transaction(async (tx) => {
      /* الراحلُ يخرج من الشعبة، والبديلُ يدخلها قائدا */
      await tx.cohortTrainer.deleteMany({ where: { cohortId, profileId: departed.profileId } })
      await tx.cohortTrainer.upsert({
        where: { cohortId_profileId: { cohortId, profileId: newProfileId } },
        update: { role: 'lead', assignedBy: actorId },
        create: { cohortId, profileId: newProfileId, role: 'lead', assignedBy: actorId },
      })
      const res = await tx.departureCase.updateMany({
        where: { departureId, cohortId, outcome: 'pending' },
        data: { outcome: 'substituted', resolvedBy: actorId, resolvedAt: new Date() },
      })
      return res.count
    })

    await recordAudit(this.prisma, {
      actorId, action: 'trainer.departure.substitute', entityType: 'trainer_departure', entityId: departureId,
      meta: { cohortId, cohortTitle: cohort.title, newProfileId, learners: n },
    })
    /* ويُبلَّغ كلُّ من حُلَّ أمرُه — لا يُنتظَر زرٌّ يُضغط عشرين مرّة */
    let told = 0
    for (const row of pending) if (await this.tellResolved(actorId, row.id)) told += 1
    return { resolved: n, told }
  }

  /* ═══ الطريقُ الثاني: يُنقل المتعلّم إلى نظير ═══ */

  /** الشعبُ النظيرةُ — على الرمز نفسِه، وهي مجموعةٌ معرَّفةٌ لا اجتهاد (ح-٣) */
  async equivalentCohorts(caseId: string) {
    const c = await this.prisma.departureCase.findUnique({
      where: { id: caseId }, include: { cohort: { select: { id: true, courseId: true } } },
    })
    if (!c) throw new AuthError('not_found', 'لا صفَّ بهذا المعرّف', 404)

    const rows = await this.prisma.cohort.findMany({
      where: {
        courseId: c.cohort.courseId,
        id: { not: c.cohortId },
        status: { in: ['open', 'full', 'active'] },
      },
      include: { course: COURSE_TITLE, _count: { select: { enrollments: true } } },
      orderBy: { startsAt: 'asc' },
    })
    return rows.map((x) => ({
      cohortId: x.id,
      title: x.title,
      courseTitleAr: titleOf(x.course),
      startsAt: x.startsAt,
      capacity: x.capacity,
      enrolled: x._count.enrollments,
    }))
  }

  /** يُنقل المتعلّمُ بقرارِ الأكاديميّة — لا بتبديله هو.
   *
   *  ولا تُعاد حرّاسُ `switchCohort` هنا: تلك تمنع النقلَ بعد البدء ومع وجود
   *  أثر، وهو صوابٌ لبابِ المتعلّم. وهذا نقلٌ لأنّ مدرّبَه رحل — قد يقع في
   *  منتصف الموسم، وله أثرُه. والأثرُ معلَّقٌ بالتسجيل فينتقل معه. */
  async moveLearner(actorId: string, caseId: string, toCohortId: string, noteAr?: string | null) {
    const c = await this.prisma.departureCase.findUnique({
      where: { id: caseId },
      include: { cohort: { select: { courseId: true } }, departure: { select: { closedAt: true } } },
    })
    if (!c) throw new AuthError('not_found', 'لا صفَّ بهذا المعرّف', 404)
    if (c.departure.closedAt) throw new AuthError('closed', 'أُغلق ملفُّ الرحيل', 409)
    if (isResolved(c.outcome)) throw new AuthError('resolved', 'حُلَّ أمرُ هذا المتعلّم من قبل', 409)

    const to = await this.prisma.cohort.findUnique({
      where: { id: toCohortId }, select: { id: true, courseId: true, title: true },
    })
    if (!to) throw new AuthError('not_found', 'لا شعبةَ بهذا المعرّف', 404)

    /* ح-٣ بنصّه: النظيرُ إصدارٌ من الرمز نفسِه. وشعبةٌ على رمزٍ آخرَ ليست
       نظيرا — هي مسارٌ آخرُ لم يشترِه، ونقلُه إليه تغييرٌ لما دفع لأجله. */
    if (to.courseId !== c.cohort.courseId) {
      throw new AuthError(
        'not_equivalent',
        'النظيرُ شعبةٌ على الرمز نفسِه — وهذه دورةٌ أخرى، ونقلُه إليها تغييرٌ لما دفع لأجله',
        409,
      )
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.enrollment.update({ where: { id: c.enrollmentId }, data: { cohortId: toCohortId } })
      await tx.departureCase.update({
        where: { id: caseId },
        data: {
          outcome: 'moved', resolvedBy: actorId, resolvedAt: new Date(),
          noteAr: noteAr?.trim() || null,
        },
      })
    })

    await recordAudit(this.prisma, {
      actorId, action: 'trainer.departure.move', entityType: 'departure_case', entityId: caseId,
      meta: { fromCohortId: c.cohortId, toCohortId, toTitle: to.title },
    })
    /* ومقعدُه انتقل في السطر فوقُ — فلا يبقى جدولُه يتغيّر وهو لا يعلم */
    const told = await this.tellResolved(actorId, caseId)
    return { moved: true, told }
  }

  /* ═══ الطريقُ الثالث: الاختيارُ لصاحبه (ن-١٠) ═══ */

  /** يُعرض الاختيارُ — ولا يُختار عنه */
  async offerChoice(actorId: string, caseId: string, noteAr?: string | null) {
    const c = await this.prisma.departureCase.findUnique({
      where: {  id: caseId },
      include: {
        cohort: { select: { title: true } },
        enrollment: { select: { userId: true } },
        departure: { select: { closedAt: true } },
      },
    })
    if (!c) throw new AuthError('not_found', 'لا صفَّ بهذا المعرّف', 404)
    if (c.departure.closedAt) throw new AuthError('closed', 'أُغلق ملفُّ الرحيل', 409)
    if (isResolved(c.outcome)) throw new AuthError('resolved', 'حُلَّ أمرُ هذا المتعلّم من قبل', 409)

    const note = noteAr?.trim() || c.noteAr
    const out = await this.prisma.departureCase.update({
      where: { id: caseId },
      data: { choiceOfferedAt: new Date(), noteAr: note },
    })

    /* ═══ ولمَ يخرج بريدٌ هنا والقاعدةُ ① تمنع البريدَ قبل القرار ═══

       لا تمنعه. تمنع «رحل مدرّبُك، وسنوافيك» — خبرا بلا ما بعده. وهذا
       البريدُ يحمل ما بعده كاملا: لا بديلَ ولا نظير، والقرارُ لك، وهذان
       خيارَاك. فهو **أشدُّ** ما توجبه ①: لا اعتذارٌ ولا انتظار، بل فعلٌ
       صاحبُه هو من يفعله.

       وبدونه يكون العرضُ صامتا: علامةٌ في قاعدةٍ لا يراها إلّا من دخل
       بوّابتَه مصادفةً. و«الاختيارُ لصاحبه» لا تتحقّق بخيارٍ لا يعلم به. */
    const notifications = new NotificationService(this.prisma)
    await notifications.notify({
      userId: c.enrollment.userId, channel: 'in_app',
      templateKey: 'departure.choice',
      title: `القرارُ لك في «${c.cohort.title}»`,
      body: offerMessage(c.cohort.title, note),
      data: { caseId },
      audience: 'learner',
    })

    await recordAudit(this.prisma, {
      actorId, action: 'trainer.departure.offer_choice', entityType: 'departure_case', entityId: caseId,
    })
    return out
  }

  /* ═══ ولمَ تُعرَض الدفعاتُ ولا تُخمَّن ═══

     «رُفع طلبُ الردّ» جملةٌ يقرؤها صاحبُ المال، فلا بدّ أن يقابلها طلبٌ
     قائمٌ فعلا. و`requestRefund` يأخذ **دفعةً بعينها** — فمن أين تُعرف؟

     `OrderItem` تحمل `kind` و`refId`: فبندُ `cohort` الذي `refId`ه شعبتُنا
     هو شراءُ هذه الشعبة بعينها، لا أقربُ دفعةٍ ولا آخرُها. فالرابطُ معرَّفٌ
     في المخطّط، ولا يُخمَّن — ويبقى الاختيارُ لمن يقرّر المبلغَ نفسَه. */
  async refundablePayments(caseId: string) {
    const c = await this.prisma.departureCase.findUnique({
      where: { id: caseId },
      select: { cohortId: true, enrollment: { select: { userId: true } } },
    })
    if (!c) throw new AuthError('not_found', 'لا صفَّ بهذا المعرّف', 404)

    const orders = await this.prisma.order.findMany({
      where: {
        userId: c.enrollment.userId,
        items: { some: { kind: 'cohort', refId: c.cohortId } },
      },
      select: {
        invoice: {
          select: {
            number: true,
            payments: {
              where: { status: { in: ['succeeded', 'partially_refunded'] } },
              select: { id: true, amount: true, currency: true, succeededAt: true,
                refunds: { select: { amount: true, status: true } } },
            },
          },
        },
      },
    })

    return orders.flatMap((o) => (o.invoice?.payments ?? []).map((p) => {
      const refunded = p.refunds
        .filter((r) => r.status !== 'rejected')
        .reduce((sum, r) => sum + Number(r.amount), 0)
      return {
        paymentId: p.id,
        invoiceNumber: o.invoice!.number,
        amount: Number(p.amount),
        currency: p.currency,
        refunded,
        /* المتبقّي هو سقفُ ما يُطلب — و`requestRefund` يردّ ما تجاوزه */
        remaining: Number(p.amount) - refunded,
        paidAt: p.succeededAt,
      }
    })).filter((p) => p.remaining > 0)
  }

  /** ما عُرض على هذا المتعلّم — يقرؤه في بوّابته */
  async myOpenChoices(userId: string) {
    const rows = await this.prisma.departureCase.findMany({
      where: {
        choiceOfferedAt: { not: null },
        learnerChoice: null,
        enrollment: { userId },
        departure: { closedAt: null },
      },
      include: { cohort: { select: { title: true, course: COURSE_TITLE } } },
    })
    /* ولا يُرسَل اسمُ المدرّب إلى هنا. بوّابةُ المتعلّم لا تسمّي مدرّبا في
       موضعٍ واحد — تقول «مدرّبك» — وقاعدةُ المستودَع تقصر عرضَ الأسماء على
       المعتمَدِ نشرُه. والراحلُ قد لا يكون منهم، وحاجةُ الشاشة لا تقتضيه:
       «رحل مدرّبُ «كذا»» تحدّد الخبرَ تماما. فالحقلُ الذي لا يُعرض لا يُرسَل. */
    return rows.map((c) => ({
      caseId: c.id,
      cohortTitle: c.cohort.title,
      courseTitleAr: titleOf(c.cohort.course),
      noteAr: c.noteAr,
      offeredAt: c.choiceOfferedAt,
    }))
  }

  /** يختار صاحبُه — **هو لا نحن** (ن-١٠) */
  async chooseAsLearner(userId: string, caseId: string, choice: LearnerChoice) {
    const c = await this.prisma.departureCase.findUnique({
      where: { id: caseId },
      include: { enrollment: { select: { userId: true } }, departure: { select: { closedAt: true } } },
    })
    if (!c || c.enrollment.userId !== userId) throw new AuthError('not_found', 'لا خيارَ بهذا المعرّف', 404)
    if (c.departure.closedAt) throw new AuthError('closed', 'أُغلق هذا الملفّ — راسِل الدعم', 409)
    if (!c.choiceOfferedAt) throw new AuthError('not_offered', 'لم يُعرض عليك اختيارٌ بعد', 409)
    if (c.learnerChoice) throw new AuthError('already_chosen', 'اخترتَ من قبل', 409)

    const out = await this.prisma.departureCase.update({
      where: { id: caseId }, data: { learnerChoice: choice, chosenAt: new Date() },
    })
    await recordAudit(this.prisma, {
      actorId: userId, action: 'trainer.departure.learner_choice',
      entityType: 'departure_case', entityId: caseId, meta: { choice },
    })
    /* ═══ واختيارٌ لا يُنفّذه أحدٌ ليس اختيارا (ي-٤) ═══

       هذا الفعلُ كان صامتا من طرفَيه: لا صاحبُ المقعد يُشكَر، **ولا أحدٌ في
       الإدارة يُستدعى**. فيبقى الخيارُ في عمودٍ حتّى يفتح موظّفٌ شاشةَ
       الرحيل مصادفةً فيرى زرَّ «نفِّذ ما اختاره». وصاحبُه اختار ردَّ ماله،
       فينتظر شيئا لا يعلم أنّه لم يبدأ.

       ولا مفتاحَ قائمٌ يصلح له: `departure.choice` عرضٌ خرج من قبل،
       و`departure.resolved` يخالف قاعدةَ السمعة ① — لا شيءَ حُلَّ بعد. */
    const cohort = await this.prisma.departureCase.findUnique({
      where: { id: caseId }, select: { cohort: { select: { title: true } } },
    })
    await notifyRole(this.prisma, ['super_admin', 'academic_manager'], {
      channel: 'in_app',
      templateKey: 'departure.chosen',
      title: 'اختار صاحبُ المقعد — ولم يُنفَّذ بعد',
      body: `اختار صاحبُ المقعد في «${cohort?.cohort.title ?? 'شعبته'}»: ${CHOICE_LABEL_AR[choice]}. ولا يقع شيءٌ حتّى يُنفَّذ — افتح ملفَّ الرحيل ونفِّذ ما اختاره.`,
      data: { caseId, choice },
    })
    return out
  }

  /** تنفيذُ ما اختاره — ولا يُنفَّذ مآلٌ يخالف اختيارَه (ن-١٠).
   *
   *  ولا مالَ يتحرّك هنا: الردُّ **طلبٌ** يُرفع إلى الماليّة فتقرّه بصلاحيّتها
   *  المستقلّة، والرصيدُ كوبونٌ مقصورٌ على صاحبه. */
  async settleChoice(
    actorId: string,
    caseId: string,
    input: { amount: number; bonus?: number; currency?: string; paymentId?: string },
  ) {
    const c = await this.prisma.departureCase.findUnique({
      where: { id: caseId },
      include: {
        enrollment: { select: { userId: true } },
        departure: { select: { closedAt: true } },
      },
    })
    if (!c) throw new AuthError('not_found', 'لا صفَّ بهذا المعرّف', 404)
    if (c.departure.closedAt) throw new AuthError('closed', 'أُغلق ملفُّ الرحيل', 409)
    if (isResolved(c.outcome)) throw new AuthError('resolved', 'حُلَّ أمرُ هذا المتعلّم من قبل', 409)

    /* والقاعدةُ في موضعٍ واحد (ن-١٠): `settleBlockerAr` تملكها وحدَها، فلا
       شرطَ هنا يسبقها فيجعلها لا تُبلَغ ثمّ يُظنّ أنّها تحرس. */
    const blocker = settleBlockerAr(c.learnerChoice)
    if (blocker) throw new AuthError('no_choice', blocker, 409)
    const choice = c.learnerChoice as LearnerChoice
    const outcome = OUTCOME_OF_CHOICE[choice]

    if (choice === 'credit') {
      const total = input.amount + (input.bonus ?? 0)
      if (total <= 0) throw new AuthError('bad_amount', 'مبلغُ الرصيد أكبرُ من صفر', 400)
      const code = creditCouponCode(caseId)
      await this.prisma.coupon.create({
        data: {
          code,
          amountOff: total,
          currency: input.currency ?? 'USD',
          maxUses: 1,
          /* مقصورٌ على صاحبه — رصيدٌ باسمه لا كوبونٌ يتداوله الناس */
          restrictedToUserId: c.enrollment.userId,
        },
      })
      await recordAudit(this.prisma, {
        actorId, action: 'trainer.departure.credit', entityType: 'departure_case', entityId: caseId,
        meta: { code, amount: input.amount, bonus: input.bonus ?? 0 },
      })
    } else {
      /* ═══ والرسالةُ تقول «رُفع الطلبُ إلى الماليّة» — فليُرفع ═══

         كان هنا سطرٌ في السجلّ وحدَه: لا `Refund` ولا شيءَ يصل الماليّة.
         ويقرأ صاحبُ المال «رُفع طلبُ ردِّ ما تبقّى … إلى الماليّة» وليس
         ثمّة طلب. وهو أسوأُ ما في هذا الملفّ كلِّه: رسالةٌ تَعِد بما لم
         يقع — وقد بُني هذا الملفُّ كلُّه على ألّا تقع هذه.

         و`processRefund` يبقى بصلاحيّته المستقلّة (ماليّة): يُرفع الطلبُ
         هنا، ويُقرّه من يملك إقرارَه. فلا يُصرف مالٌ من هذه الشاشة. */
      if (!input.paymentId) {
        throw new AuthError('no_payment',
          'اختر الدفعةَ التي يُردّ منها — ولا يُرفع طلبٌ بلا دفعةٍ خلفَه', 400)
      }
      const commerce = new CommerceService(this.prisma)
      const refund = await commerce.requestRefund(input.paymentId, actorId, {
        amount: input.amount,
        reason: `رحيلُ مدرّبٍ — اختار صاحبُ المقعد الردَّ (حالة ${caseId.slice(0, 8)})`,
      })
      await recordAudit(this.prisma, {
        actorId, action: 'trainer.departure.refund_requested',
        entityType: 'departure_case', entityId: caseId,
        meta: { amount: input.amount, paymentId: input.paymentId, refundId: refund.id },
      })
    }

    const out = await this.prisma.departureCase.update({
      where: { id: caseId },
      data: { outcome, resolvedBy: actorId, resolvedAt: new Date() },
    })
    /* والمآلُ وقع الآن — رصيدٌ صُرف أو طلبُ ردٍّ رُفع. فيُقال لصاحبه في
       الحال، ولا يُنتظَر أن يتذكّر أحدٌ زرًّا. */
    const told = await this.tellResolved(actorId, caseId)
    return { ...out, told }
  }

  /* ═══ والرسالةُ بعد القرار لا قبله ═══ */

  /** يُبلَّغ صاحبُه بما يجري — ويُردّ الإبلاغُ على صفٍّ لم يُقرَّر */
  async notify(actorId: string, caseId: string) {
    const c = await this.prisma.departureCase.findUnique({
      where: { id: caseId },
      include: {
        cohort: { select: { title: true } },
        enrollment: { select: { userId: true } },
        departure: { select: { profile: { select: { application: { select: { fullName: true } } } } } },
      },
    })
    if (!c) throw new AuthError('not_found', 'لا صفَّ بهذا المعرّف', 404)

    /* ═══ قاعدةُ السمعة ═══
       «لا ينبغي أن يقرأ متعلّمٌ «رحل مدرّبُك» بلا أن يكون البديلُ في الجملة
       نفسِها». فالرسالةُ لا تخرج على صفٍّ لم يُقرَّر. */
    const blocker = notifyBlockerAr(c)
    if (blocker) throw new AuthError('undecided', blocker, 409)
    if (c.notifiedAt) throw new AuthError('already', 'أُبلغ من قبل', 409)

    await this.tellResolved(actorId, caseId)
    return this.prisma.departureCase.findUniqueOrThrow({ where: { id: caseId } })
  }

  /* ونصُّ الرسالة يحمل ما يجري بعدها — لا اعتذارا وانتظارا */
  /* ═══ ولا يُنتظَر إنسانٌ ليضغط «أبلِغه» (ي-٤) ═══

     `departure.resolved` كان يصل صاحبَه فعلا — **بيدِ موظّفٍ يضغط زرًّا
     مرّةً لكلِّ متعلّم**. و`substitute` يحلّ صفوفَ الشعبة كلَّها في
     `updateMany` واحد: فالعبءُ يكبر بكِبَر الشعبة، وهو بعينه الموضعُ الذي
     يُترك فيه. ولا وظيفةَ تذكّر، ولا حدَّ للتأخير — وحدَه `close` يمنع
     إغلاقَ ملفٍّ فيه من قُرِّر أمرُه ولم يُبلَّغ، ولا شيءَ يوجب الإغلاق.

     فصار الإبلاغُ يقع مع القرار نفسِه. والزرُّ يبقى: من تعذّر إبلاغُه
     آليّا يُعاد إبلاغُه بيد، و`notifiedAt` يمنع التكرار.

     ويُبتلع خطؤه بقصد: قرارٌ وقع في القاعدة لا يُنقض لأنّ جرسا لم يُقرع. */
  private async tellResolved(actorId: string | null, caseId: string): Promise<boolean> {
    const c = await this.prisma.departureCase.findUnique({
      where: { id: caseId },
      include: {
        cohort: { select: { title: true } },
        enrollment: { select: { userId: true } },
        departure: { select: { profile: { select: { application: { select: { fullName: true } } } } } },
      },
    })
    /* صفٌّ لم يُقرَّر أمرُه لا تخرج عليه رسالة — قاعدةُ السمعة ①.
       ومن أُبلغ لا يُبلَّغ مرّتَين. */
    if (!c || c.notifiedAt || notifyBlockerAr(c)) return false
    try {
      await new NotificationService(this.prisma).notify({
        userId: c.enrollment.userId, channel: 'in_app',
        templateKey: 'departure.resolved',
        title: `تغييرٌ في «${c.cohort.title}»`,
        body: this.messageFor(c.outcome, c.cohort.title, caseId),
        data: { caseId, outcome: c.outcome },
        audience: 'learner',
      })
    } catch { return false }
    await this.prisma.departureCase.update({ where: { id: caseId }, data: { notifiedAt: new Date() } })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.departure.notify', entityType: 'departure_case', entityId: caseId,
      meta: { outcome: c.outcome },
    })
    return true
  }

  private messageFor(outcome: string, cohortTitle: string, caseId: string): string {
    return RESOLVED_MESSAGE[outcome as ResolvedOutcome](cohortTitle, caseId)
  }

  /** تُغلق الحالةُ ولا اسمَ معلَّق */
  async close(actorId: string, departureId: string) {
    const d = await this.prisma.trainerDeparture.findUnique({
      where: { id: departureId }, include: { cases: { select: { outcome: true, notifiedAt: true } } },
    })
    if (!d) throw new AuthError('not_found', 'لا ملفَّ رحيلٍ بهذا المعرّف', 404)
    if (d.closedAt) throw new AuthError('closed', 'أُغلق من قبل', 409)

    const blockers = closeBlockersAr({ cases: d.cases })
    if (blockers.length > 0) throw new AuthError('incomplete', blockers.join(' · '), 409)

    const out = await this.prisma.trainerDeparture.update({
      where: { id: departureId }, data: { closedAt: new Date(), closedBy: actorId },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.departure.close', entityType: 'trainer_departure', entityId: departureId,
      meta: { learners: d.cases.length },
    })
    return out
  }
}

export { needsLearnerChoice }
