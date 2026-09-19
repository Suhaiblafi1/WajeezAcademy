/* عروضُ الإسناد — «ويحقّ للإدارة إسنادُ دورةٍ واحدةٍ أو لا دورةَ أو كافّةَ
   الدورات لهذا الشخص، لكي لا يُلزِمَنا في عقدٍ ثابت».

   ولمَ نموذجٌ ثالثٌ لا صفٌّ في جدولٍ قائم — وهو سؤالٌ يُسأل، لأنّ في القاعدة
   جدولين يشبهانه:

   ① `CohortTrainer` هو **الربطُ التشغيليّ**: منه يُقرأ «شعبي» وطابورُ
      التصحيح والحضورُ والجدول، ويحرسه `assertCohortTrainer`. فصفٌّ فيه
      لعرضٍ لم يُقبل بعدُ يجعل المدرّبَ مشتغلا بشعبةٍ لم يوافق عليها.

   ② `TrainerCourseAssignment` هو **الإسنادُ الإداريّ**، ومنه يقرأ
      `publicCourseTrainer` أسماءَ مدرّبي الدورة **فتُنشَر على الصفحة
      العامّة**، ومنه يقع `cohortLeadTrainer` حين لا قائدَ للشعبة **فيصير
      مستحِقّا للمال**، و`generateForCohort` يجري من العامل تلقائيّا.
      فصفٌّ فيه لعرضٍ معلَّقٍ ينشر اسمَ من لم يقبل ويجعله طرفا في كشفِ
      مستحقّات.

   فالعرضُ ليس أيَّهما: هو **دعوةٌ قابلةٌ للردّ**، ولا أثرَ لها في التشغيل ولا
   في النشر ولا في المال حتّى تُقبَل. وحين تُقبَل تمرّ من بابِ الإسناد نفسِه
   (`TrainerReviewService.assignToCohort`) لا من نسخةٍ عنه — فتُعاد عنده كلُّ
   الحرّاس: الشعبةُ قائمة، والملفُّ نشطٌ غيرُ موقوف، والتأهيلُ قائم، ولا
   تعارضَ في الجدول، والربطُ التشغيليُّ يُكتب. وقبولٌ اليومَ على عرضِ الشهر
   الماضي لا يُصدَّق على لقطةٍ قديمة.

   والتصميمُ في docs/superpowers/specs/2026-09-19-trainer-contract-design.md */

import type { PrismaClient, Prisma } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { notifyRole, safeNotify } from './notification.service'
import { CohortService } from './cohort.service'
import { TrainerReviewService } from './trainer-review.service'
import { fmtDateWith } from '../../src/application/text/format-ar'
import {
  ASSIGNMENT_OFFER_RESPONSE_DAYS, COURSE_PREP_DEFAULT_DAYS, COURSE_PREP_MIN_DAYS,
} from '../../src/application/trainer/notice-periods'

const DAY_MS = 24 * 60 * 60 * 1000
const addDays = (from: Date, days: number) => new Date(from.getTime() + days * DAY_MS)

export interface OfferInput {
  profileId: string
  courseId: string
  cohortId?: string | null
  sessionsCount?: number | null
  startsAt?: Date | null
  feeNoteAr?: string | null
  noteAr?: string | null
  prepDays?: number | null
  /** مهلةُ الردّ بالأيّام — وبلا قيمةٍ فـ`ASSIGNMENT_OFFER_RESPONSE_DAYS` */
  responseDays?: number | null
}

export class TrainerOfferService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** عنوانُ الدورة بالعربية — ولا رمزَ لاتينيٌّ يُعرض لمدرّب */
  private async courseTitleAr(courseId: string): Promise<string> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } },
    })
    return course?.versions[0]?.titleAr ?? courseId
  }

  private async profileForUser(userId: string) {
    const profile = await this.prisma.trainerProfile.findFirst({
      where: { userId }, include: { application: true },
    })
    if (!profile) throw new AuthError('no_profile', 'لا ملفَّ مدرّبٍ لحسابك', 404)
    return profile
  }

  /* ═══════════ العرض ═══════════ */

  /** تعرض الأكاديميّةُ دورةً على مدرّبٍ مؤهَّلٍ لها — دعوةً لا توجيها.

      **ولمَ دعوةً لا توجيها**: العقدُ عملٌ حرٌّ، وفيه مهلةُ انسحابٍ شهرٌ
      كامل. فلو كان الإسنادُ أمرا يقع عليه بلا قبولٍ لانهارت المهلةُ من
      أصلها — يُسنَد اليومَ فيلزمه شهرٌ قبل أن ينسحب ممّا لم يوافق عليه —
      ولقُرئ الترتيبُ كلُّه استخداما متخفّيا في ثوب عملٍ حرّ. */
  async offer(input: OfferInput, actorId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { id: input.profileId }, include: { application: true },
    })
    if (!profile) throw new AuthError('not_found', 'ملفُّ المدرّب غير موجود', 404)
    if (profile.suspendedAt || profile.application.status !== 'active') {
      throw new AuthError('not_active', 'لا يُعرَض على مدرّبٍ غيرِ نشط — فهو لا يفتح بوّابتَه ليرى العرض', 409)
    }
    const qual = await this.prisma.trainerCourseQualification.findUnique({
      where: { profileId_courseId: { profileId: input.profileId, courseId: input.courseId } },
    })
    if (!qual || qual.status !== 'qualified') {
      throw new AuthError('not_qualified', 'المدرّب غير مؤهَّل لهذه الدورة — أهّله أوّلا', 409)
    }

    let cohortStartsAt: Date | null = null
    if (input.cohortId) {
      const cohort = await this.prisma.cohort.findUnique({
        where: { id: input.cohortId }, select: { id: true, courseId: true, startsAt: true },
      })
      if (!cohort) throw new AuthError('unknown_cohort', 'الشعبة غير موجودة', 404)
      if (cohort.courseId !== input.courseId) {
        throw new AuthError('cohort_mismatch', 'الشعبةُ ليست من هذه الدورة', 409)
      }
      cohortStartsAt = cohort.startsAt
      /* تعارضُ الجدول يُقرأ **قبل** العرض لا بعد القبول: من يُعرض عليه ما لا
         يستطيع قبولَه يقرأ ويرتّب ويقبل ثمّ يُردّ بخطإٍ لا ذنبَ له فيه.
         ويُعاد الفحصُ عند القبول على كلّ حال — فالجدولُ يتحرّك بينهما. */
      await new CohortService(this.prisma).assertTrainerFreeFor(input.profileId, input.cohortId)
    }

    /* ولا عقدَ يُشترَط هنا وإن كان العرضُ فرعا عنه: التسلسلُ محروسٌ فوقَه —
       لا يبلغ مدرّبٌ حالةَ `active` على المسار الجديد إلّا باعتماد عقدٍ
       موقَّع (`countersignContract`). واشتراطُه ثانيةً هنا يطرد من صار
       مدرّبا قبل هذه المرحلة ولا عقدَ في القاعدة له، ويردّه إلى البابِ
       القديم — فيُفقَد الحارسُ ولا يُكسَب شيء. والعقدُ النافذُ يُربَط إن
       وُجد، ليُقرأ الأثرُ معه. */
    const contract = await this.prisma.trainerContract.findFirst({
      where: { profileId: input.profileId, status: 'countersigned' },
      orderBy: { countersignedAt: 'desc' },
      select: { id: true },
    })

    const prepDays = Math.max(COURSE_PREP_MIN_DAYS, input.prepDays ?? COURSE_PREP_DEFAULT_DAYS)
    const responseDays = Math.max(1, input.responseDays ?? ASSIGNMENT_OFFER_RESPONSE_DAYS)
    const expiresAt = addDays(new Date(), responseDays)

    const offer = await this.prisma.trainerAssignmentOffer.create({
      data: {
        profileId: input.profileId, courseId: input.courseId, cohortId: input.cohortId ?? null,
        contractId: contract?.id ?? null,
        sessionsCount: input.sessionsCount ?? null,
        startsAt: input.startsAt ?? cohortStartsAt,
        feeNoteAr: input.feeNoteAr?.trim() || null,
        noteAr: input.noteAr?.trim() || null,
        expiresAt, offeredBy: actorId, prepDays,
      },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.offer.create', entityType: 'trainer_profile', entityId: input.profileId,
      meta: {
        offerId: offer.id, courseId: input.courseId, cohortId: input.cohortId ?? null,
        contractId: contract?.id ?? null, expiresAt, prepDays,
      },
    })

    const titleAr = await this.courseTitleAr(input.courseId)
    if (profile.userId) {
      await safeNotify(this.prisma, {
        userId: profile.userId, channel: 'in_app', audience: 'trainer',
        templateKey: 'trainer.offer.received',
        title: 'عُرضت عليك دورة',
        body: `عُرضت عليك «${titleAr}» — تقبلها أو تعتذر عنها قبل `
          + `${fmtDateWith(expiresAt, { day: 'numeric', month: 'long', year: 'numeric' })}.`,
        data: { offerId: offer.id, courseId: input.courseId, cohortId: input.cohortId ?? null },
      })
    }
    return offer
  }

  /* ═══════════ الجواب — وهو له ═══════════ */

  /** القبولُ يعيد فحصَ الدنيا كلِّها، ثمّ يمرّ من بابِ الإسناد نفسِه. */
  async accept(offerId: string, userId: string) {
    const profile = await this.profileForUser(userId)
    const offer = await this.prisma.trainerAssignmentOffer.findFirst({
      where: { id: offerId, profileId: profile.id },
    })
    if (!offer) throw new AuthError('not_found', 'العرض غير موجود', 404)
    if (offer.status !== 'offered') {
      throw new AuthError('bad_state', 'هذا العرضُ لم يعد مفتوحا', 409)
    }
    const now = new Date()
    if (offer.expiresAt <= now) {
      /* والمنقضي يُغلَق هنا لا يُترك معلَّقا: العاملُ قد يتأخّر، والصفحةُ
         التي تقول «مفتوح» عن منقضٍ تكذب على من يقرؤها. */
      await this.prisma.trainerAssignmentOffer.updateMany({
        where: { id: offer.id, status: 'offered' },
        data: { status: 'lapsed', respondedAt: now },
      })
      throw new AuthError('offer_expired', 'انقضت مهلةُ هذا العرض — راسِل الإدارةَ إن كنت ما زلت ترغب فيه', 409)
    }

    /* قارنْ واضبطْ أوّلا: نقرتان متزامنتان تمرّان معا فيُكتب إسنادان.
       والقبولُ يُثبَّت قبل الإسناد كي لا يقبل اثنان عرضا واحدا — ثمّ إن
       سقط الإسنادُ في حارسٍ عاد العرضُ مفتوحا كما كان، فلا يضيع على صاحبه
       عرضٌ سقط لسببٍ لا يدَ له فيه. */
    const prepDueAt = addDays(now, offer.prepDays)
    const claimed = await this.prisma.trainerAssignmentOffer.updateMany({
      where: { id: offer.id, status: 'offered' },
      data: { status: 'accepted', respondedAt: now, prepDueAt },
    })
    if (claimed.count === 0) throw new AuthError('bad_state', 'هذا العرضُ لم يعد مفتوحا', 409)

    try {
      /* و`assignedBy` هو من عرض لا من قبل: الإسنادُ قرارُ الأكاديميّة،
         والقبولُ جوابُ المدرّب. والأثرُ أدناه يقول من قبِل ومتى. */
      await new TrainerReviewService(this.prisma).assignToCohort(
        profile.id, offer.courseId, offer.cohortId ?? undefined, offer.offeredBy ?? userId,
      )
    } catch (e) {
      await this.prisma.trainerAssignmentOffer.updateMany({
        where: { id: offer.id, status: 'accepted' },
        data: { status: 'offered', respondedAt: null, prepDueAt: null },
      })
      throw e
    }

    await recordAudit(this.prisma, {
      actorId: userId, action: 'trainer.offer.accept',
      entityType: 'trainer_profile', entityId: profile.id,
      meta: { offerId: offer.id, courseId: offer.courseId, cohortId: offer.cohortId, prepDueAt },
    })
    const titleAr = await this.courseTitleAr(offer.courseId)
    await notifyRole(this.prisma, ['academic_manager', 'super_admin'], {
      channel: 'in_app',
      templateKey: 'trainer.offer.accepted',
      title: 'قبِل مدرّبٌ عرضا',
      body: `قبِل ${profile.application.fullName} «${titleAr}» — وأجلُ إعداده `
        + `${fmtDateWith(prepDueAt, { day: 'numeric', month: 'long', year: 'numeric' })}.`,
      data: { offerId: offer.id, profileId: profile.id, courseId: offer.courseId },
    })
    return { ok: true, prepDueAt }
  }

  /** الاعتذارُ — جوابٌ مشروعٌ لا عطب، وهو نفسُ ما في العقد. */
  async decline(offerId: string, userId: string, reasonAr: string) {
    const profile = await this.profileForUser(userId)
    const reason = (reasonAr ?? '').trim()
    if (reason.length < 5) {
      throw new AuthError('no_reason', 'اكتب سببَ اعتذارك — سطرٌ واحدٌ يكفي، ويساعدنا أن نرتّب', 422)
    }
    const done = await this.prisma.trainerAssignmentOffer.updateMany({
      where: { id: offerId, profileId: profile.id, status: 'offered' },
      data: { status: 'declined', respondedAt: new Date(), declineReasonAr: reason.slice(0, 500) },
    })
    if (done.count === 0) throw new AuthError('bad_state', 'هذا العرضُ لم يعد مفتوحا', 409)
    const offer = await this.prisma.trainerAssignmentOffer.findUniqueOrThrow({ where: { id: offerId } })
    await recordAudit(this.prisma, {
      actorId: userId, action: 'trainer.offer.decline',
      entityType: 'trainer_profile', entityId: profile.id,
      meta: { offerId, courseId: offer.courseId, cohortId: offer.cohortId, reasonAr: reason.slice(0, 500) },
    })
    const titleAr = await this.courseTitleAr(offer.courseId)
    await notifyRole(this.prisma, ['academic_manager', 'super_admin'], {
      channel: 'in_app',
      templateKey: 'trainer.offer.declined',
      title: 'اعتذر مدرّبٌ عن عرض',
      body: `اعتذر ${profile.application.fullName} عن «${titleAr}» — وسببُه: ${reason.slice(0, 200)}`,
      data: { offerId, profileId: profile.id, courseId: offer.courseId },
    })
    return { ok: true }
  }

  /** وتسحب الأكاديميّةُ عرضَها قبل أن يُقبَل — وبسببٍ يصل صاحبَه. */
  async withdraw(offerId: string, actorId: string, reasonAr: string) {
    const reason = (reasonAr ?? '').trim()
    if (reason.length < 5) {
      throw new AuthError('no_reason', 'سببُ السحب يُكتب — يصل صاحبَه ويُقرأ بعد شهرٍ حين يُسأل عنه', 422)
    }
    const offer = await this.prisma.trainerAssignmentOffer.findUnique({
      where: { id: offerId }, include: { profile: { include: { application: true } } },
    })
    if (!offer) throw new AuthError('not_found', 'العرض غير موجود', 404)
    const done = await this.prisma.trainerAssignmentOffer.updateMany({
      where: { id: offerId, status: 'offered' },
      data: {
        status: 'withdrawn', respondedAt: new Date(),
        withdrawnBy: actorId, withdrawReasonAr: reason.slice(0, 500),
      },
    })
    if (done.count === 0) {
      throw new AuthError('bad_state', 'لا يُسحَب إلّا عرضٌ مفتوح — وما قُبِل يُنهى بمسار الانسحاب لا بالسحب', 409)
    }
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.offer.withdraw',
      entityType: 'trainer_profile', entityId: offer.profileId,
      meta: { offerId, courseId: offer.courseId, cohortId: offer.cohortId, reasonAr: reason.slice(0, 500) },
    })
    const titleAr = await this.courseTitleAr(offer.courseId)
    if (offer.profile.userId) {
      await safeNotify(this.prisma, {
        userId: offer.profile.userId, channel: 'in_app', audience: 'trainer',
        templateKey: 'trainer.offer.withdrawn',
        title: 'سُحب عرضٌ عُرض عليك',
        body: `سُحب عرضُ «${titleAr}» قبل قبولك إيّاه — وسببُه: ${reason.slice(0, 200)}`,
        data: { offerId, courseId: offer.courseId },
      })
    }
    return { ok: true }
  }

  /* ═══════════ أجلُ الإعداد — بعد القبول ═══════════

     «على الأقلّ ثلاثة أيّام إلى خمسة أيّام لكلّ دورة — لن نستعجل أكثر».
     ويجري من القبول لا من العرض: أجلٌ يجري على من لم يلتزم بعدُ ظلم. */

  /** يقرّ المدرّبُ بجاهزيّته — فعلُه هو، ولا يُفترَض عنه. */
  async confirmPrep(offerId: string, userId: string) {
    const profile = await this.profileForUser(userId)
    const now = new Date()
    const done = await this.prisma.trainerAssignmentOffer.updateMany({
      where: { id: offerId, profileId: profile.id, status: 'accepted', prepConfirmedAt: null },
      data: { prepConfirmedAt: now },
    })
    if (done.count === 0) {
      throw new AuthError('bad_state', 'لا إقرارَ إلّا على عرضٍ قبِلتَه ولم تقرّ بجاهزيّته بعد', 409)
    }
    await recordAudit(this.prisma, {
      actorId: userId, action: 'trainer.offer.prep_confirm',
      entityType: 'trainer_profile', entityId: profile.id, meta: { offerId, confirmedAt: now },
    })
    return { ok: true, prepConfirmedAt: now }
  }

  /* ═══════════ ما يجريه العامل ═══════════ */

  /** مهلةُ الردّ انقضت بلا جواب — والبندُ ٣-٣ يجعله ردّا لا إهمالا. */
  async lapseExpiredOffers(now = new Date()) {
    const due = await this.prisma.trainerAssignmentOffer.findMany({
      where: { status: 'offered', expiresAt: { lte: now } },
      include: { profile: { select: { userId: true } } },
      take: 200,
    })
    let lapsed = 0
    for (const offer of due) {
      const done = await this.prisma.trainerAssignmentOffer.updateMany({
        where: { id: offer.id, status: 'offered' },
        data: { status: 'lapsed', respondedAt: now },
      })
      if (done.count === 0) continue
      lapsed += 1
      await recordAudit(this.prisma, {
        actorId: null, action: 'trainer.offer.lapse',
        entityType: 'trainer_profile', entityId: offer.profileId,
        meta: { offerId: offer.id, courseId: offer.courseId, expiresAt: offer.expiresAt },
      })
      const titleAr = await this.courseTitleAr(offer.courseId)
      if (offer.profile.userId) {
        await safeNotify(this.prisma, {
          userId: offer.profile.userId, channel: 'in_app', audience: 'trainer',
          templateKey: 'trainer.offer.lapsed',
          title: 'انقضت مهلةُ عرض',
          body: `انقضت مهلةُ الردّ على «${titleAr}» فأُغلِق العرض — وهو ليس مأخذا عليك، `
            + 'وراسِل الإدارةَ إن كنت ما زلت ترغب فيه.',
          data: { offerId: offer.id, courseId: offer.courseId },
        })
      }
    }
    return { lapsed }
  }

  /** تذكيرٌ قبل انقضاء أجلِ الإعداد بيوم — ولا يُطرَق بابٌ مرّتين في يوم. */
  async remindPrepDue(now = new Date()) {
    const soon = new Date(now.getTime() + DAY_MS)
    const due = await this.prisma.trainerAssignmentOffer.findMany({
      where: {
        status: 'accepted', prepConfirmedAt: null, prepLapsedAt: null,
        prepDueAt: { not: null, lte: soon, gt: now },
        OR: [{ prepRemindedAt: null }, { prepRemindedAt: { lt: new Date(now.getTime() - DAY_MS) } }],
      },
      include: { profile: { select: { userId: true } } },
      take: 200,
    })
    let reminded = 0
    for (const offer of due) {
      if (!offer.profile.userId || !offer.prepDueAt) continue
      await this.prisma.trainerAssignmentOffer.update({
        where: { id: offer.id }, data: { prepRemindedAt: now },
      })
      reminded += 1
      const titleAr = await this.courseTitleAr(offer.courseId)
      await safeNotify(this.prisma, {
        userId: offer.profile.userId, channel: 'in_app', audience: 'trainer',
        templateKey: 'trainer.prep.reminder',
        title: 'يقترب أجلُ إعدادك',
        body: `أجلُ إعداد «${titleAr}» ينتهي `
          + `${fmtDateWith(offer.prepDueAt, { day: 'numeric', month: 'long', year: 'numeric' })} — `
          + 'أقرّ بجاهزيّتك من بوّابتك، أو أخبرنا بما تحتاجه.',
        data: { offerId: offer.id, courseId: offer.courseId },
      })
    }
    return { reminded }
  }

  /** انقضى الأجلُ ولم يُقَرّ بالجاهزيّة — **ولا يُسحب الإسنادُ آليّا**.

      شعبةٌ فيها متعلّمون دفعوا مقاعدَهم لا يُبَتّ أمرُها بمؤقّت: يُرفَع
      الخبرُ إلى إنسانٍ ينظر ويقرّر، وقد يكون السببُ عذرا مقبولا. */
  async lapsePrepDue(now = new Date()) {
    const due = await this.prisma.trainerAssignmentOffer.findMany({
      where: {
        status: 'accepted', prepConfirmedAt: null, prepLapsedAt: null,
        prepDueAt: { not: null, lte: now },
      },
      include: { profile: { include: { application: { select: { fullName: true } } } } },
      take: 200,
    })
    let raised = 0
    for (const offer of due) {
      const done = await this.prisma.trainerAssignmentOffer.updateMany({
        where: { id: offer.id, prepLapsedAt: null },
        data: { prepLapsedAt: now },
      })
      if (done.count === 0) continue
      raised += 1
      await recordAudit(this.prisma, {
        actorId: null, action: 'trainer.offer.prep_lapse',
        entityType: 'trainer_profile', entityId: offer.profileId,
        meta: { offerId: offer.id, courseId: offer.courseId, cohortId: offer.cohortId, prepDueAt: offer.prepDueAt },
      })
      const titleAr = await this.courseTitleAr(offer.courseId)
      await notifyRole(this.prisma, ['academic_manager', 'super_admin'], {
        channel: 'in_app',
        templateKey: 'trainer.prep.lapsed',
        title: 'انقضى أجلُ إعدادٍ بلا إقرار',
        body: `لم يقرّ ${offer.profile.application.fullName} بجاهزيّته لـ«${titleAr}» حتّى انقضاء أجله — `
          + 'والإسنادُ قائمٌ كما هو، فانظرْ وقرّر.',
        data: { offerId: offer.id, profileId: offer.profileId, courseId: offer.courseId },
      })
    }
    return { raised }
  }

  /* ═══════════ القراءة ═══════════ */

  /** ما تحتاجه شاشةُ العرض قبل أن يختار الموظّفُ شيئا.

      ونقطةٌ مستقلّةٌ خلف `trainer.assign` لا نداءٌ لـ`/api/admin/cohorts`:
      تلك خلف `cohort.manage`، ومن يملك الإسنادَ قد لا يملكها — فتسقط
      شاشتُه بـ٤٠٣ في نصفها بلا سبب يفهمه. */
  async offerOptions() {
    const profiles = await this.prisma.trainerProfile.findMany({
      where: {
        suspendedAt: null,
        application: { status: 'active' },
        qualifications: { some: { status: 'qualified' } },
      },
      select: {
        id: true,
        application: { select: { fullName: true, email: true, reference: true } },
        qualifications: { where: { status: 'qualified' }, select: { courseId: true } },
        contracts: {
          where: { status: 'countersigned' }, orderBy: { countersignedAt: 'desc' }, take: 1,
          select: { id: true, title: true, countersignedAt: true },
        },
        assignmentOffers: {
          where: { status: { in: ['offered', 'accepted'] } },
          select: { courseId: true, cohortId: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    })

    const courseIds = [...new Set(profiles.flatMap((p) => p.qualifications.map((q) => q.courseId)))]
    const [titles, cohorts] = await Promise.all([
      this.prisma.course.findMany({
        where: { id: { in: courseIds } },
        select: { id: true, versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } },
      }),
      /* والملغاةُ والمنتهيةُ خارجَها: عرضُ شعبةٍ لن تُعقَد عبثٌ يُقبَل ثمّ
         يسقط عند الإسناد بحارس `assignTrainer`. */
      this.prisma.cohort.findMany({
        where: { courseId: { in: courseIds }, status: { in: ['draft', 'open', 'full', 'active'] } },
        select: {
          id: true, courseId: true, title: true, startsAt: true, status: true,
          trainers: { select: { profileId: true, role: true } },
        },
        orderBy: { startsAt: 'asc' },
        take: 500,
      }),
    ])
    const titleOf = new Map(titles.map((c) => [c.id, c.versions[0]?.titleAr ?? c.id]))

    return profiles.map((p) => ({
      profileId: p.id,
      fullName: p.application.fullName,
      email: p.application.email,
      reference: p.application.reference,
      contract: p.contracts[0] ?? null,
      courses: p.qualifications.map((q) => ({
        courseId: q.courseId,
        titleAr: titleOf.get(q.courseId) ?? q.courseId,
        /* وعرضٌ مفتوحٌ أو مقبولٌ على الدورة نفسِها يُقال للموظّف — فلا
           يُعرض على إنسانٍ ما هو قائمٌ عنده. */
        alreadyOpen: p.assignmentOffers.some((o) => o.courseId === q.courseId && o.status === 'offered'),
        alreadyAccepted: p.assignmentOffers.some((o) => o.courseId === q.courseId && o.status === 'accepted'),
        cohorts: cohorts.filter((c) => c.courseId === q.courseId).map((c) => ({
          id: c.id, title: c.title, startsAt: c.startsAt, status: c.status,
          hasLead: c.trainers.some((t) => t.role === 'lead'),
          mine: c.trainers.some((t) => t.profileId === p.id),
        })),
      })),
    })).filter((p) => p.courses.length > 0)
  }

  /** عروضي — ما يَنتظر جوابي، وما قبِلتُه وينتظر إعدادي */
  async listForTrainer(userId: string) {
    const profile = await this.profileForUser(userId)
    const rows = await this.prisma.trainerAssignmentOffer.findMany({
      where: { profileId: profile.id },
      orderBy: [{ status: 'asc' }, { offeredAt: 'desc' }],
      take: 100,
      include: { cohort: { select: { id: true, title: true, startsAt: true } } },
    })
    return Promise.all(rows.map(async (o) => ({
      ...o, courseTitleAr: await this.courseTitleAr(o.courseId),
    })))
  }

  /** العروضُ كلُّها للإدارة — والمفتوحةُ أوّلا */
  async listForAdmin(filter?: { profileId?: string; status?: string }) {
    const where: Prisma.TrainerAssignmentOfferWhereInput = {}
    if (filter?.profileId) where.profileId = filter.profileId
    if (filter?.status) where.status = filter.status
    const rows = await this.prisma.trainerAssignmentOffer.findMany({
      where, orderBy: [{ status: 'asc' }, { offeredAt: 'desc' }], take: 200,
      include: {
        cohort: { select: { id: true, title: true, startsAt: true } },
        profile: { select: { id: true, application: { select: { id: true, fullName: true, email: true } } } },
      },
    })
    return Promise.all(rows.map(async (o) => ({
      ...o, courseTitleAr: await this.courseTitleAr(o.courseId),
    })))
  }
}
