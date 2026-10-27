/* من يُدعى إلى لقاءٍ مباشر، ومتى (٢٩ سبتمبر ٢٠٢٦).

   الرسالةُ وموعدُ التقويم يُبنيان في `calendar/session-invite.ts`؛ وهنا المدعوّون
   واللحظات.

   ═══ المدعوّون ═══

   · **مسجَّلو الشعبة** — من له مقعدٌ قائم، برابطه الخاصّ في Zoom إن كان له
     (`SessionJoinLink`): به يُعرف حضورُه.
   · **والعنوانان** (`SESSION_GUESTS`) — قرارُ صاحب المنصّة: suhaib@wajeez.co
     وAcademy@wajeez.co يُدعيان إلى كلّ لقاءٍ يُعتمَد، حاضرَين لا مضيفَين
     («Invited to attend»). ولكلٍّ منهما رابطُه في Zoom (`SessionGuestLink`):
     الاجتماعُ بتسجيلٍ مسبق، ورابطُه المشتركُ يفتح صفحةَ تسجيلٍ في كلّ مرّة.
   · **ومدرّبو الشعبة** (٢٧ أكتوبر ٢٠٢٦) — قال صاحبُ المنصّة: «كل شعبه تغيرت مواعيدها يجب ان
     يحدث التغيير في الكلندر عند الجميع». وكان المدرّبُ وحدَه لا تصله دعوة: لقاؤه في بوّابته ولا
     شيءَ في تقويمه، فما نُقل لا يتحرّك عنده. فيُدعى مع الجميع بلا رابط: يبدأ اللقاءَ مضيفا من صفحة
     شعبته، ورابطُ المشارك يُدخله مشاركا لا مضيفا. والموقوفُ لا يُدعى.

   ═══ اللحظات ═══

   · يُعتمَد لقاءٌ، أو تجدوله الإدارةُ باجتماعه — دعوة (`announce(…, 'new')`).
   · يُنقل وهو معتمَد، أو يصير له رابط — تحديثٌ بالمعرّف نفسِه (`'update'`).
   · يُحذف، أو يعود لانتظار الإدارة — رفعٌ من التقويم (`withdraw`).
   · يصير لمتعلّمٍ مقعدٌ بعد أن اعتُمدت لقاءاتُ شعبته — رسالةٌ واحدةٌ بما بقي
     منها (`welcome`). ويتركه أو ينتقل منه — تُرفع من تقويمه وحدَه (`release`).
   · ويدخلها مدرّبٌ — يُسنَد إليها أو يحلّ محلّ من رحل — رسالةٌ واحدةٌ بما بقي
     (`trainerJoined`)، ويخرج منها — تُرفع من تقويمه وحدَه (`trainerLeft`).
   · ويُوقَف تدريبُه — تُرفع لقاءاتُ شعبه من تقويمه (`trainerSuspended`)، ويصله جدولُها حين يعود.

   ولا يُدعى إلى ما مضى، ولا إلى المبدئيّ — مثالُ الإدارة يُرفع حين يضع المدرّبُ
   جدولَه، فدعوتُه موعدٌ في تقويم إنسانٍ يُمحى بعد أيّام.

   ═══ ولمَ طابورُ البريد الخارج لا طابورُ الإشعارات ═══

   الإشعارُ يُرسَل في الطلب نفسِه. ومسجَّلو شعبةٍ كلُّهم ساعةَ يُعتمَد لقاءٌ دفعةٌ
   تتجاوز حدَّ المزوّد (طلبان في الثانية) فيُحرَق ما زاد؛ والدعوةُ تحمل مرفقا لا
   يحمله صفُّ الإشعار. فتُكتب في `OutboxMail` ويُفرّغها العاملُ مُمَهَّلا — والجرسُ
   في المنصّة يبقى في `Notification` كما كان.

   ═══ ولا يُسكتها كتمُ الجرس ═══

   كتمُ «مواعيد الجلسات» يُسكت الجرسَ و«الموعدُ يبقى في جدوله على كلّ حال»
   (`categories.ts`). والدعوةُ موعدٌ في تقويمه، ولا مفتاحَ بريدٍ في تفضيلاته
   اليوم (`notifications.routes.ts`) — فلا تفضيلَ تكذبه. */

import type { PrismaClient } from '@prisma/client'
import { enqueueMail } from './outbox.service'
import { ACADEMY_CONTACT_EMAIL } from './integrations.service'
import { publicSiteUrl } from './site-url'
import { getZoomConfig, registerZoomParticipant, zoomReady } from './zoom.service'
import { sessionInviteMail, sessionScheduleMail, type InviteAudience, type InviteKind } from './calendar/session-invite'

/** المدعوّان إلى كلّ لقاءٍ يُعتمَد — بقرار صاحب المنصّة (٢٩ سبتمبر ٢٠٢٦) */
export const SESSION_GUESTS: readonly { email: string; name: string }[] = [
  { email: 'suhaib@wajeez.co', name: 'إدارة أكاديمية وجيز' },
  { email: ACADEMY_CONTACT_EMAIL, name: 'أكاديمية وجيز' },
]

/** ما يُقال في رسالة الرفع حين تُلغى الشعبةُ أو تُؤجَّل */
export const COHORT_CANCELLED_AR = 'ألغيت الشعبة، فلن يعقد هذا اللقاء.'
export const COHORT_POSTPONED_AR = 'تأجلت الشعبة إلى موسم قادم، فلن يعقد هذا اللقاء في موعده. تصلك مواعيدها الجديدة حين تعتمد.'
/** وما يُقال للمدرّب حين تنتقل شعبتُه إلى غيره */
export const TRAINER_LEFT_AR = 'انتقلت الشعبة إلى مدرب آخر، فلن تقدم هذا اللقاء.'
/** وحين يُوقَف تدريبُه — وما بقي له يصله حين يعود (`trainerSuspended`) */
export const TRAINER_SUSPENDED_AR = 'أوقف تدريبك. وتصلك مواعيد شعبك حين يرفع الإيقاف.'

/** سببُ الرفع — واحدٌ للجميع، أو للمدرّب غيرُ ما للمتعلّم: «نقله مدرّبك» لا تُقال للمدرّب */
export type WithdrawWhy = string | { learnerAr: string; trainerAr: string }

/** ما يُدعى إليه المسجَّل: مقعدٌ قائم — لا منتظرٌ في القائمة ولا من ترك */
export const SEATED = ['enrolled', 'completed']

/** لقاءٌ كما كان ساعةَ دُعي إليه — يُحفظ قبل حذفه لتُكتب رسالةُ رفعه */
export interface InvitedSession {
  id: string
  cohortId: string
  cohortTitle: string
  title: string
  startsAt: Date
  endsAt: Date | null
}

interface MeetingRef { provider: string; meetingId: string | null; joinUrl: string }

export class SessionInviteService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** أيُدعى إليه؟ — المعتمَدُ غيرُ الملغى ولا المبدئيّ، وما لم يبدأ بعد */
  static invitable(s: { approvalState: string; status: string; placeholder: boolean; startsAt: Date }, now: Date): boolean {
    return s.approvalState === 'approved' && s.status !== 'cancelled' && !s.placeholder && s.startsAt.getTime() > now.getTime()
  }

  /* ═══ والشعبةُ الملغاةُ أو المؤجَّلةُ لا تبقى لقاءاتُها في التقاويم (٢٦ أكتوبر ٢٠٢٦) ═══

     بلاغُ صاحب المنصّة: «لماذا لا تحذف الجلسات من الكلندر للدورات التي تم تأجيلها أو إلغاؤها؟». كان
     إلغاءُ الشعبة (`CohortService.transition`) يُبلغ متعلّميها ومدرّبَها بالجرس، ولا يرفع من تقاويمهم
     شيئا: دعواتُ لقاءاتها باقيةٌ عند المسجَّلين وعند العنوانَين بروابطَ تعمل. وكذلك تأجيلُ خطّتها إلى موسمٍ
     قادم (`CohortPlanService.postpone`): تنتقل الشعبةُ ولقاءاتُها بمواعيدها القديمة في التقاويم.

     فما وقع قبل هذا اليوم لا يحضره أحد:
     · **الملغاةُ** — كلُّ لقاءاتها.
     · **والمؤجَّلةُ** (أحدثُ خطّةٍ لمدرّبها `postponedTo` ولم تُعتمَد) — ما قبل أوّل يومٍ في موسمها الجديد.

     ولا يُدعى إلى ما وقع (`announce` و`welcome`)، ويُرفع ما دُعي إليه (`withdrawCohort`). وإعادةُ الفتح
     تُرجعه (`reannounceCohort`). */
  private async voidBefore(cohortId: string): Promise<Date | null> {
    const c = await this.prisma.cohort.findUnique({
      where: { id: cohortId },
      select: {
        status: true,
        plans: { where: { trainerId: { not: null } }, orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, postponedTo: true } },
      },
    })
    if (!c) return null
    if (c.status === 'cancelled') return new Date(8.64e15)
    const latest = c.plans[0]
    return latest?.postponedTo && latest.status !== 'approved' ? latest.postponedTo : null
  }

  /* ═══ أفي التقاويم هو؟ — على اللقاء لا في طابور البريد (٢٧ أكتوبر ٢٠٢٦) ═══

     كان يُقرأ من آخر صفٍّ في طابور البريد عن اللقاء، فأخطأ مرّتين:
     · ما خرج من الطابور يُحذف بعد أربعة عشر يوما (`RETENTION_DAYS.outboxSent`) — فلقاءٌ دُعي إليه قبل
       أسبوعين لا أثرَ له، فلا يُرفع حين تُلغى شعبتُه أو تُؤجَّل، ويبقى في تقاويم الجميع.
     · ورفعُه من تقويم من ترك الشعبة (`release`) صفٌّ عن اللقاء نفسِه — فيُقرأ رفعا للجميع: لا يُرفع بعده
       من تقويم أحد، و«إعادةُ الفتح» تدعو إليه من لم يُرفع عنه.
     فيكتب `send` على اللقاء متى دُعي إليه الجميعُ (`calendarAnnouncedAt`) ومتى رُفع (`calendarWithdrawnAt`)،
     وما يُكتب لواحدٍ لا يمسّهما. */

  /** يرفع من التقاويم ما وقع من لقاءات الشعبة ممّا دُعي إليه ولم يُرفع. يعود بعدد اللقاءات */
  async withdrawCohort(cohortId: string, whyAr: string, now = new Date()): Promise<number> {
    const before = await this.voidBefore(cohortId)
    if (!before) return 0
    let withdrawn = 0
    for (const s of await this.upcoming(cohortId, now)) {
      if (s.startsAt.getTime() >= before.getTime()) continue
      if (!s.calendarAnnouncedAt || s.calendarWithdrawnAt) continue
      await this.withdraw({
        id: s.id, cohortId, cohortTitle: s.cohort.title, title: s.title, startsAt: s.startsAt, endsAt: s.endsAt,
      }, whyAr, now)
      withdrawn += 1
    }
    return withdrawn
  }

  /** وإعادةُ فتحها تُرجع إلى التقاويم ما رُفع منها — بالمعرّف نفسِه. يعود بعدد اللقاءات */
  async reannounceCohort(cohortId: string, now = new Date()): Promise<number> {
    let restored = 0
    for (const s of await this.upcoming(cohortId, now)) {
      if (!s.calendarWithdrawnAt) continue
      if ((await this.announce(s.id, 'new', now)) > 0) restored += 1
    }
    return restored
  }

  /* ومن العامل: ما فات الرفعَ — شعبٌ أُلغيت قبل هذا الإصلاح، أو بغير بابه (`retireOrphanPrepCohorts`
     يكتب الإلغاءَ مباشرة). والرفعُ لا يتكرّر: ما رُفع يُتخطّى (`calendarWithdrawnAt`) */
  async sweepVoided(now = new Date()): Promise<{ cohorts: number; sessions: number }> {
    const cohorts = await this.prisma.cohort.findMany({
      where: {
        sessions: { some: { startsAt: { gt: now }, approvalState: 'approved', placeholder: false, status: { not: 'cancelled' } } },
        OR: [{ status: 'cancelled' }, { plans: { some: { trainerId: { not: null }, postponedTo: { not: null } } } }],
      },
      select: { id: true, status: true },
    })
    let touched = 0
    let sessions = 0
    for (const c of cohorts) {
      const n = await this.withdrawCohort(c.id, c.status === 'cancelled' ? COHORT_CANCELLED_AR : COHORT_POSTPONED_AR, now)
      if (n > 0) { touched += 1; sessions += n }
    }
    return { cohorts: touched, sessions }
  }

  /** دعوةُ لقاءٍ معتمَد أو تحديثُها — لمسجَّليه ومدرّبيه وللعنوانَين. يعود بعدد ما كُتب */
  async announce(sessionId: string, kind: Exclude<InviteKind, 'cancel'>, now = new Date()): Promise<number> {
    const s = await this.prisma.cohortSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true, cohortId: true, title: true, startsAt: true, endsAt: true,
        status: true, approvalState: true, placeholder: true,
        cohort: { select: { title: true } },
        zoom: { select: { provider: true, meetingId: true, joinUrl: true } },
      },
    })
    if (!s || !SessionInviteService.invitable(s, now)) return 0
    const before = await this.voidBefore(s.cohortId)
    if (before && s.startsAt.getTime() < before.getTime()) return 0
    const snap: InvitedSession = {
      id: s.id, cohortId: s.cohortId, cohortTitle: s.cohort.title,
      title: s.title, startsAt: s.startsAt, endsAt: s.endsAt,
    }
    return this.send(snap, kind, s.zoom, undefined, now)
  }

  /** رفعُه من تقاويم من دُعي — يُنادى قبل حذف صفّه، فبعد الحذف لا مرجع */
  async withdraw(snap: InvitedSession, why: WithdrawWhy, now = new Date()): Promise<number> {
    if (snap.startsAt.getTime() <= now.getTime()) return 0
    return this.send(snap, 'cancel', null, why, now)
  }

  /* ═══ ومن التحق بعد الاعتماد — رسالةٌ واحدةٌ بما بقي (`sessionScheduleMail`) ═══

     يُنادى حين يصير لمتعلّمٍ مقعد: التحاقٌ (بالشراء أو بيد الإدارة)، وترقيةٌ
     من قائمة الانتظار، وانتقالٌ من شعبةٍ أخرى. ومن التحق قبل الاعتماد لا جدولَ
     له بعدُ فلا يُكتب له شيء — دعوةُ كلِّ لقاءٍ تصله ساعةَ يُعتمَد.

     ويُنادى بعد أن يُسجَّل في Zoom (`ensureSessionJoinLinks`)، فيحمل الجدولُ
     رابطَه الخاصَّ لا المشترك. يعود بعدد ما كُتب — واحدٌ أو لا شيء. */
  async welcome(enrollmentId: string, now = new Date()): Promise<number> {
    const seat = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: {
        id: true, status: true, cohortId: true,
        cohort: { select: { title: true } },
        user: { select: { email: true, displayName: true } },
      },
    })
    if (!seat || !SEATED.includes(seat.status) || !seat.user?.email) return 0
    const before = await this.voidBefore(seat.cohortId)
    const sessions = (await this.upcoming(seat.cohortId, now))
      .filter((s) => !before || s.startsAt.getTime() >= before.getTime())
    if (sessions.length === 0) return 0

    /* والملغى لا يُعطى: رابطٌ أُلغي تسجيلُه عند Zoom لا يُدخل صاحبَه (`releaseSessionJoinLinks`) */
    const links = await this.prisma.sessionJoinLink.findMany({
      where: { enrollmentId: seat.id, sessionId: { in: sessions.map((s) => s.id) }, cancelledAt: null },
      select: { sessionId: true, joinUrl: true },
    })
    const own = new Map(links.map((l) => [l.sessionId, l.joinUrl]))
    const mail = sessionScheduleMail({
      cohortId: seat.cohortId, cohortTitle: seat.cohort.title,
      to: { email: seat.user.email, name: seat.user.displayName },
      sessions: sessions.map((s) => {
        const mine = own.get(s.id)
        const join = mine ? { url: mine, personal: true } : s.zoom?.joinUrl ? { url: s.zoom.joinUrl, personal: false } : null
        return { id: s.id, title: s.title, startsAt: s.startsAt, endsAt: s.endsAt, join }
      }),
      pageUrl: `${publicSiteUrl()}/student/learning`,
      now,
    })
    await enqueueMail(this.prisma, {
      to: seat.user.email, subject: mail.subject, text: mail.text, html: mail.html,
      purpose: 'session.invite.schedule', batchId: seat.id,
      ics: { content: mail.ics, method: mail.icsMethod, filename: mail.icsFilename },
    })
    return 1
  }

  /* ═══ ومن ترك الشعبة أو انتقل منها — تُرفع لقاءاتُها المقبلة من تقويمه ═══

     دُعي إليها وهو فيها، فبقيت في تقويمه بروابطَ تعمل. ومن انتقل يرى لقاءاتِ
     شعبتَين في أسبوعٍ واحد فيحضر ما ليس له. فيُرفع كلُّ لقاءٍ برسالته — الرفعُ
     عن موعدٍ واحدٍ بمعرّفه كالدعوة — ولا يُكتب لأحدٍ سواه. */
  async release(
    to: { email: string; name?: string | null }, cohortId: string, whyAr: string, now = new Date(),
    audience: InviteAudience = 'learner',
  ): Promise<number> {
    const pageUrl = `${publicSiteUrl()}${audience === 'trainer' ? '/trainer' : '/student/learning'}`
    let queued = 0
    for (const s of await this.upcoming(cohortId, now)) {
      const snap: InvitedSession = {
        id: s.id, cohortId, cohortTitle: s.cohort.title, title: s.title, startsAt: s.startsAt, endsAt: s.endsAt,
      }
      await this.enqueueInvite(snap, 'cancel', to, null, pageUrl, whyAr, now, audience)
      queued += 1
    }
    return queued
  }

  /* ═══ ومدرّبٌ يدخل شعبةً اعتُمدت لقاءاتُها — رسالةٌ واحدةٌ بما بقي (٢٧ أكتوبر ٢٠٢٦) ═══

     يُسنَد إليها (`CohortService.assignTrainer`)، أو يحلّ محلّ مدرّبٍ رحل (`TrainerDepartureService.substitute`).
     وما يُعتمَد بعده تصله دعوتُه مع الجميع (`send`). ويُكتب على إسناده متى وصله جدولُها (`calendarSentAt`) —
     برسالةٍ أو بلا شيءٍ يُرسَل — فلا يكرّره العامل. يعود بعدد ما كُتب: واحدٌ أو لا شيء. */
  async trainerJoined(cohortId: string, profileId: string, now = new Date()): Promise<number> {
    const link = await this.prisma.cohortTrainer.findUnique({
      where: { cohortId_profileId: { cohortId, profileId } },
      select: {
        id: true,
        cohort: { select: { title: true } },
        profile: { select: { suspendedAt: true, user: { select: { email: true, displayName: true } } } },
      },
    })
    const user = link?.profile.user
    if (!link || link.profile.suspendedAt || !user?.email) return 0
    const before = await this.voidBefore(cohortId)
    const sessions = (await this.upcoming(cohortId, now))
      .filter((s) => !before || s.startsAt.getTime() >= before.getTime())
    let queued = 0
    if (sessions.length > 0) {
      const mail = sessionScheduleMail({
        cohortId, cohortTitle: link.cohort.title,
        to: { email: user.email, name: user.displayName },
        sessions: sessions.map((s) => ({ id: s.id, title: s.title, startsAt: s.startsAt, endsAt: s.endsAt, join: null })),
        pageUrl: this.trainerPage(cohortId), audience: 'trainer', now,
      })
      await enqueueMail(this.prisma, {
        to: user.email, subject: mail.subject, text: mail.text, html: mail.html,
        purpose: 'session.invite.schedule', batchId: link.id,
        ics: { content: mail.ics, method: mail.icsMethod, filename: mail.icsFilename },
      })
      queued = 1
    }
    await this.prisma.cohortTrainer.update({ where: { id: link.id }, data: { calendarSentAt: now } })
    return queued
  }

  /** ومدرّبٌ خرج من الشعبة — تُرفع لقاءاتُها المقبلة من تقويمه وحدَه */
  async trainerLeft(cohortId: string, profileId: string, now = new Date()): Promise<number> {
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { id: profileId }, select: { suspendedAt: true, user: { select: { email: true, displayName: true } } },
    })
    /* والموقوفُ رُفعت لقاءاتُ شعبه من تقويمه حين أُوقف (`trainerSuspended`) — فلا تُرفع ثانيةً */
    if (!profile?.user?.email || profile.suspendedAt) return 0
    return this.release({ email: profile.user.email, name: profile.user.displayName }, cohortId, TRAINER_LEFT_AR, now, 'trainer')
  }

  /* ═══ ومدرّبٌ يُوقَف — تُرفع لقاءاتُ شعبه من تقويمه، ويصله جدولُها حين يعود (٢٧ أكتوبر ٢٠٢٦) ═══

     كان الإيقافُ (`TrainerReviewService.suspendTrainer`) لا يمسّ التقويم: تبقى دعواتُه فيه، ولا يصله بعدها تحديثٌ
     ولا رفع — `trainersOf` لا تعدّ الموقوف — فما نُقل أو أُلغي يبقى في تقويمه على غير حقيقته، ومنه شعبُه التي تُلغى
     في نافذة الإيقاف نفسِها. وحين يعود لا يعود جدولُها: `calendarSentAt` مكتوبٌ فلا يرسله العامل. فخُيّر صاحبُ
     المنصّة فاختار: تُرفع لقاءاتُه حين يُوقَف، ويصله جدولُ ما بقي من شعبه حين يعود.

     فيُرفع من تقويمه وحدَه ما بقي من لقاءات كلِّ شعبةٍ وصله جدولُها، ويُمحى `calendarSentAt` عن إسنادها — فلا يُرفع
     منه شيءٌ مرّتين، ويرسل العاملُ جدولَها إن عاد (`sweepTrainerCalendars`). وما رُفع من تقاويم الجميع قبل إيقافه لا
     يُرفع ثانيةً: وصله رفعُه يومئذ. وما رُفع بعده يُرفع: لم يصله. يعود بعدد ما كُتب */
  async trainerSuspended(profileId: string, now = new Date()): Promise<number> {
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { id: profileId },
      select: {
        suspendedAt: true,
        user: { select: { email: true, displayName: true } },
        cohortTrainers: { where: { calendarSentAt: { not: null } }, select: { id: true, cohortId: true } },
      },
    })
    if (!profile?.suspendedAt) return 0
    const suspendedAt = profile.suspendedAt.getTime()
    const to = profile.user?.email ? { email: profile.user.email, name: profile.user.displayName } : null
    const pageUrl = `${publicSiteUrl()}/trainer`
    let queued = 0
    for (const link of profile.cohortTrainers) {
      if (to) {
        for (const s of await this.upcoming(link.cohortId, now)) {
          if (s.calendarWithdrawnAt && s.calendarWithdrawnAt.getTime() < suspendedAt) continue
          const snap: InvitedSession = {
            id: s.id, cohortId: link.cohortId, cohortTitle: s.cohort.title, title: s.title, startsAt: s.startsAt, endsAt: s.endsAt,
          }
          await this.enqueueInvite(snap, 'cancel', to, null, pageUrl, TRAINER_SUSPENDED_AR, now, 'trainer')
          queued += 1
        }
      }
      await this.prisma.cohortTrainer.update({ where: { id: link.id }, data: { calendarSentAt: null } })
    }
    return queued
  }

  /* ومن العامل: مدرّبٌ لم يصله جدولُ شعبته — من سبق هذا اليوم ولم تصله دعوةٌ قطّ، أو فاته `trainerJoined`
     بخطأٍ ابتُلع، أو رُفع إيقافُه. مرّةً لكلّ إسناد، والموقوفُ يُترك حتّى يعود.
     وموقوفٌ بقي جدولُ شعبته في تقويمه — أُوقف قبل أن يُرفع عند الإيقاف شيء، أو فاته `trainerSuspended` بخطأٍ
     ابتُلع — تُرفع منه لقاءاتُها */
  async sweepTrainerCalendars(now = new Date()): Promise<{ links: number; mails: number; held: number; withdrawn: number }> {
    const held = await this.prisma.cohortTrainer.findMany({
      where: { calendarSentAt: { not: null }, profile: { suspendedAt: { not: null } } },
      select: { profileId: true },
      orderBy: { createdAt: 'asc' },
      take: 200,
    })
    let withdrawn = 0
    for (const profileId of new Set(held.map((h) => h.profileId))) withdrawn += await this.trainerSuspended(profileId, now)

    const links = await this.prisma.cohortTrainer.findMany({
      where: { calendarSentAt: null, profile: { suspendedAt: null, user: { isNot: null } } },
      select: { cohortId: true, profileId: true },
      orderBy: { createdAt: 'asc' },
      take: 200,
    })
    let mails = 0
    for (const l of links) mails += await this.trainerJoined(l.cohortId, l.profileId, now)
    return { links: links.length, mails, held: held.length, withdrawn }
  }

  /** صفحةُ الشعبة في بوّابة المدرّب — منها يبدأ اللقاءَ مضيفا */
  private trainerPage(cohortId: string): string {
    return `${publicSiteUrl()}/trainer/cohort/${cohortId}`
  }

  /** مدرّبو الشعبة — من لم يُوقَف، ببريد حسابه */
  private async trainersOf(cohortId: string): Promise<{ email: string; name: string | null }[]> {
    const rows = await this.prisma.cohortTrainer.findMany({
      where: { cohortId, profile: { suspendedAt: null } },
      orderBy: { createdAt: 'asc' },
      select: { profile: { select: { user: { select: { email: true, displayName: true } } } } },
    })
    return rows.flatMap((r) => (r.profile.user?.email ? [{ email: r.profile.user.email, name: r.profile.user.displayName }] : []))
  }

  /** ما بقي من لقاءات الشعبة ممّا يُدعى إليه — بقاعدة `invitable` نفسِها لا بنسخةٍ منها */
  private async upcoming(cohortId: string, now: Date) {
    const rows = await this.prisma.cohortSession.findMany({
      where: { cohortId, startsAt: { gt: now } },
      orderBy: { startsAt: 'asc' },
      select: {
        id: true, title: true, startsAt: true, endsAt: true, status: true, approvalState: true, placeholder: true,
        calendarAnnouncedAt: true, calendarWithdrawnAt: true,
        cohort: { select: { title: true } },
        zoom: { select: { joinUrl: true } },
      },
    })
    return rows.filter((s) => SessionInviteService.invitable(s, now))
  }

  private async enqueueInvite(
    snap: InvitedSession, kind: InviteKind, to: { email: string; name?: string | null },
    join: { url: string; personal: boolean } | null, pageUrl: string, whyAr: string | undefined, now: Date,
    audience: InviteAudience = 'learner',
  ): Promise<void> {
    const mail = sessionInviteMail({
      kind, session: snap, cohortTitle: snap.cohortTitle, to, join, pageUrl, cancelWhyAr: whyAr, audience, now,
    })
    await enqueueMail(this.prisma, {
      to: to.email, subject: mail.subject, text: mail.text, html: mail.html,
      purpose: `session.invite.${kind}`, batchId: snap.id,
      ics: { content: mail.ics, method: mail.icsMethod, filename: mail.icsFilename },
    })
  }

  private async send(
    snap: InvitedSession, kind: InviteKind, zoom: MeetingRef | null, why: WithdrawWhy | undefined, now: Date,
  ): Promise<number> {
    const site = publicSiteUrl()
    let queued = 0
    const enqueue = async (
      to: { email: string; name?: string | null }, join: { url: string; personal: boolean } | null, pageUrl: string,
      audience: InviteAudience = 'learner',
    ) => {
      const whyAr = typeof why === 'object' ? (audience === 'trainer' ? why.trainerAr : why.learnerAr) : why
      await this.enqueueInvite(snap, kind, to, join, pageUrl, whyAr, now, audience)
      queued += 1
    }

    const seats = await this.prisma.enrollment.findMany({
      where: { cohortId: snap.cohortId, status: { in: SEATED } },
      select: { id: true, user: { select: { email: true, displayName: true } } },
    })
    const links = await this.prisma.sessionJoinLink.findMany({
      where: { sessionId: snap.id, cancelledAt: null }, select: { enrollmentId: true, joinUrl: true },
    })
    const personal = new Map(links.map((l) => [l.enrollmentId, l.joinUrl]))
    for (const seat of seats) {
      if (!seat.user?.email) continue
      const own = personal.get(seat.id)
      const join = kind === 'cancel'
        ? null
        : own ? { url: own, personal: true } : zoom?.joinUrl ? { url: zoom.joinUrl, personal: false } : null
      await enqueue({ email: seat.user.email, name: seat.user.displayName }, join, `${site}/student/learning`)
    }

    /* ومدرّبو الشعبة بلا رابط: يبدأ اللقاءَ مضيفا من صفحة شعبته */
    for (const trainer of await this.trainersOf(snap.cohortId)) {
      await enqueue(trainer, null, this.trainerPage(snap.cohortId), 'trainer')
    }

    for (const guest of SESSION_GUESTS) {
      const join = kind === 'cancel' ? null : await this.guestLink(snap.id, guest, zoom)
      await enqueue(guest, join, `${site}/admin`)
    }

    /* وما كُتب للجميع يُكتب على اللقاء — به يُعرف أفي التقاويم هو (`withdrawCohort`). و`updateMany`: الرفعُ
       قبل الحذف يجد صفَّه، ولا يُسقط الكتابةَ صفٌّ لم يعد */
    await this.prisma.cohortSession.updateMany({
      where: { id: snap.id },
      data: kind === 'cancel' ? { calendarWithdrawnAt: now } : { calendarAnnouncedAt: now, calendarWithdrawnAt: null },
    })
    return queued
  }

  /* ═══ رابطُ المدعوّ في Zoom — يُسجَّل مرّةً ويُحفظ ═══

     الاجتماعُ بتسجيلٍ مسبق، فرابطُه المشتركُ يفتح صفحةَ تسجيلٍ في كلّ مرّة.
     فيُسجَّل المدعوُّ باسم الأكاديميّة ويُحفظ رابطُه — والتحديثُ بعده يحمل
     الرابطَ نفسَه بلا تسجيلٍ ثانٍ. وما تعذّر تسجيلُه أخذ الرابطَ المشترك: دعوةٌ
     برابطٍ فيه خطوةٌ زائدة خيرٌ من دعوةٍ لا تصل. */
  private async guestLink(
    sessionId: string, guest: { email: string; name: string }, zoom: MeetingRef | null,
  ): Promise<{ url: string; personal: boolean } | null> {
    if (!zoom) return null
    const shared = { url: zoom.joinUrl, personal: false }
    if (zoom.provider !== 'zoom_api' || !zoom.meetingId) return shared
    const email = guest.email.toLowerCase()
    const kept = await this.prisma.sessionGuestLink.findUnique({
      where: { sessionId_email: { sessionId, email } }, select: { joinUrl: true },
    })
    if (kept) return { url: kept.joinUrl, personal: true }
    const cfg = await getZoomConfig(this.prisma)
    if (!zoomReady(cfg)) return shared
    try {
      const r = await registerZoomParticipant(cfg, zoom.meetingId, { email, firstName: guest.name })
      if (!r.ok) return shared
      await this.prisma.sessionGuestLink.create({
        data: { sessionId, email, registrantId: r.registrant.registrantId, joinUrl: r.registrant.joinUrl },
      })
      return { url: r.registrant.joinUrl, personal: true }
    } catch {
      return shared
    }
  }
}
