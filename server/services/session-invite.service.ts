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

   ═══ اللحظات ═══

   · يُعتمَد لقاءٌ، أو تجدوله الإدارةُ باجتماعه — دعوة (`announce(…, 'new')`).
   · يُنقل وهو معتمَد، أو يصير له رابط — تحديثٌ بالمعرّف نفسِه (`'update'`).
   · يُحذف، أو يعود لانتظار الإدارة — رفعٌ من التقويم (`withdraw`).
   · يصير لمتعلّمٍ مقعدٌ بعد أن اعتُمدت لقاءاتُ شعبته — رسالةٌ واحدةٌ بما بقي
     منها (`welcome`). ويتركه أو ينتقل منه — تُرفع من تقويمه وحدَه (`release`).

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
import { sessionInviteMail, sessionScheduleMail, type InviteKind } from './calendar/session-invite'

/** المدعوّان إلى كلّ لقاءٍ يُعتمَد — بقرار صاحب المنصّة (٢٩ سبتمبر ٢٠٢٦) */
export const SESSION_GUESTS: readonly { email: string; name: string }[] = [
  { email: 'suhaib@wajeez.co', name: 'إدارة أكاديمية وجيز' },
  { email: ACADEMY_CONTACT_EMAIL, name: 'أكاديمية وجيز' },
]

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

  /** دعوةُ لقاءٍ معتمَد أو تحديثُها — لمسجَّليه وللعنوانَين. يعود بعدد ما كُتب */
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
    const snap: InvitedSession = {
      id: s.id, cohortId: s.cohortId, cohortTitle: s.cohort.title,
      title: s.title, startsAt: s.startsAt, endsAt: s.endsAt,
    }
    return this.send(snap, kind, s.zoom, undefined, now)
  }

  /** رفعُه من تقاويم من دُعي — يُنادى قبل حذف صفّه، فبعد الحذف لا مرجع */
  async withdraw(snap: InvitedSession, whyAr: string, now = new Date()): Promise<number> {
    if (snap.startsAt.getTime() <= now.getTime()) return 0
    return this.send(snap, 'cancel', null, whyAr, now)
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
    const sessions = await this.upcoming(seat.cohortId, now)
    if (sessions.length === 0) return 0

    const links = await this.prisma.sessionJoinLink.findMany({
      where: { enrollmentId: seat.id, sessionId: { in: sessions.map((s) => s.id) } },
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
  ): Promise<number> {
    const pageUrl = `${publicSiteUrl()}/student/learning`
    let queued = 0
    for (const s of await this.upcoming(cohortId, now)) {
      const snap: InvitedSession = {
        id: s.id, cohortId, cohortTitle: s.cohort.title, title: s.title, startsAt: s.startsAt, endsAt: s.endsAt,
      }
      await this.enqueueInvite(snap, 'cancel', to, null, pageUrl, whyAr, now)
      queued += 1
    }
    return queued
  }

  /** ما بقي من لقاءات الشعبة ممّا يُدعى إليه — بقاعدة `invitable` نفسِها لا بنسخةٍ منها */
  private async upcoming(cohortId: string, now: Date) {
    const rows = await this.prisma.cohortSession.findMany({
      where: { cohortId, startsAt: { gt: now } },
      orderBy: { startsAt: 'asc' },
      select: {
        id: true, title: true, startsAt: true, endsAt: true, status: true, approvalState: true, placeholder: true,
        cohort: { select: { title: true } },
        zoom: { select: { joinUrl: true } },
      },
    })
    return rows.filter((s) => SessionInviteService.invitable(s, now))
  }

  private async enqueueInvite(
    snap: InvitedSession, kind: InviteKind, to: { email: string; name?: string | null },
    join: { url: string; personal: boolean } | null, pageUrl: string, whyAr: string | undefined, now: Date,
  ): Promise<void> {
    const mail = sessionInviteMail({
      kind, session: snap, cohortTitle: snap.cohortTitle, to, join, pageUrl, cancelWhyAr: whyAr, now,
    })
    await enqueueMail(this.prisma, {
      to: to.email, subject: mail.subject, text: mail.text, html: mail.html,
      purpose: `session.invite.${kind}`, batchId: snap.id,
      ics: { content: mail.ics, method: mail.icsMethod, filename: mail.icsFilename },
    })
  }

  private async send(
    snap: InvitedSession, kind: InviteKind, zoom: MeetingRef | null, whyAr: string | undefined, now: Date,
  ): Promise<number> {
    const site = publicSiteUrl()
    let queued = 0
    const enqueue = async (to: { email: string; name?: string | null }, join: { url: string; personal: boolean } | null, pageUrl: string) => {
      await this.enqueueInvite(snap, kind, to, join, pageUrl, whyAr, now)
      queued += 1
    }

    const seats = await this.prisma.enrollment.findMany({
      where: { cohortId: snap.cohortId, status: { in: SEATED } },
      select: { id: true, user: { select: { email: true, displayName: true } } },
    })
    const links = await this.prisma.sessionJoinLink.findMany({
      where: { sessionId: snap.id }, select: { enrollmentId: true, joinUrl: true },
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

    for (const guest of SESSION_GUESTS) {
      const join = kind === 'cancel' ? null : await this.guestLink(snap.id, guest, zoom)
      await enqueue(guest, join, `${site}/admin`)
    }
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
