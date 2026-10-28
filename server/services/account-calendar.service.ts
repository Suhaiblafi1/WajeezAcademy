/* حسابٌ يُوقَف أو يُؤرشَف — لا يبقى منّا شيءٌ في تقويمه، ولا رابطُه في Zoom (٢٨ أكتوبر ٢٠٢٦).

   كان إيقافُ الحساب من شاشة المستخدمين وأرشفتُه يغلقان الدخولَ وحدَه: تبقى دعواتُ لقاءاته في تقويمه، ويصله ما
   يُعتمَد بعدها وما يتغيّر، ورابطُه الخاصُّ في Zoom يُدخله — فمن أُوقف يحضر لقاءً بالرابط الذي في بريده. فخُيّر صاحبُ
   المنصّة فاختار: تُرفع لقاءاتُه من تقويمه، ولا يُدعى بعدها، ويُلغى رابطُه في Zoom — ويعود ذلك كلُّه حين يعود حسابُه.

   ═══ يُغلَق ويعود ═══

   · **يُغلَق** (`CLOSED_ACCOUNT`): يُلغى تسجيلُه في كلّ اجتماعٍ لم يبدأ (`releaseSessionJoinLinks`)، ويُرفع من تقويمه
     ما بقي من لقاءات كلِّ شعبةٍ له فيها مقعد (`release`)، وما بقي من لقاءات شعبه مدرّبا (`trainerAccountClosed`). ويُكتب
     متى (`User.calendarClosedAt`) — فلا يُرفع منه شيءٌ مرّتين، ولا يرفع منه تركُ مقعدٍ بعدها شيئا (`seatLeft`).
   · **ولا يُدعى بينهما إلى شيء**: `CLOSED_ACCOUNT` في `send` و`welcome` و`trainersOf` و`trainerJoined` وفي التسجيل
     عند Zoom (`linkRegistrants`).
   · **ويعود**: يُعاد تسجيلُه برابطه نفسِه ويصله جدولُ ما بقي من كلّ شعبةٍ له فيها مقعد (`seatTaken`)، ويُمحى
     التاريخ. وجدولُ شعبه مدرّبا يرسله العامل (`sweepTrainerCalendars`): إسنادُه بلا `calendarSentAt` منذ أُغلق.

   ═══ ومن أين ═══

   يُنادى بعد كلّ ما يغيّر حالَ الحساب في `AuthService`: الإيقافُ والإيقافُ الذاتيُّ والأرشفةُ ورفعُهما. وما يغيّرها بغير
   بابه يلحقه العامل (`account_calendars`) — مغلقٌ لم يُكتب له تاريخ، ومفتوحٌ بقي له تاريخ: إيقافُ التدريب يوقف دخولَ من
   لا موقعَ له سواه ورفعُه يعيده، وإعادةُ المؤسِّسين عند الإقلاع، ومحوُ الحسابات، وما أُغلق قبل هذا اليوم.

   والعنوانُ المعمّى عند المحو لا يُراسَل (`mailable`): يُلغى رابطُه ويُكتب التاريخُ بلا رسالة. */

import type { PrismaClient } from '@prisma/client'
import { CohortService } from './cohort.service'
import { EnrollmentService } from './enrollment.service'
import {
  ACCOUNT_ARCHIVED_AR, ACCOUNT_SUSPENDED_AR, CLOSED_ACCOUNT, SEATED, SessionInviteService, mailable,
} from './session-invite.service'

/** ما وقع على تقويم الحساب — أُغلق، أو عاد، أو لا شيء */
export type AccountCalendarSync = 'closed' | 'reopened' | null

export class AccountCalendarService {
  private prisma: PrismaClient
  private invites: SessionInviteService
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.invites = new SessionInviteService(prisma)
  }

  /** يجعل تقويمَه على حال حسابه: مغلقٌ لم يُغلَق تقويمُه يُغلَق، ومفتوحٌ أُغلق تقويمُه يعود */
  async sync(userId: string, now = new Date()): Promise<AccountCalendarSync> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { status: true, calendarClosedAt: true } })
    if (!user) return null
    const closed = CLOSED_ACCOUNT.includes(user.status)
    if (closed && !user.calendarClosedAt) {
      await this.close(userId, now)
      return 'closed'
    }
    if (!closed && user.calendarClosedAt) {
      await this.reopen(userId)
      return 'reopened'
    }
    return null
  }

  /** ومن العامل: حسابٌ تغيّر حالُه بغير باب `AuthService`، أو فاته ذلك بخطأٍ ابتُلع — مئتان من كلٍّ في كلّ مرّة */
  async sweep(now = new Date()): Promise<{ closed: number; reopened: number }> {
    const due = await Promise.all([
      this.prisma.user.findMany({
        where: { status: { in: CLOSED_ACCOUNT }, calendarClosedAt: null }, select: { id: true }, orderBy: { createdAt: 'asc' }, take: 200,
      }),
      this.prisma.user.findMany({
        where: { status: { notIn: CLOSED_ACCOUNT }, calendarClosedAt: { not: null } }, select: { id: true }, orderBy: { createdAt: 'asc' }, take: 200,
      }),
    ])
    let closed = 0
    let reopened = 0
    for (const u of due.flat()) {
      const done = await this.sync(u.id, now)
      if (done === 'closed') closed += 1
      if (done === 'reopened') reopened += 1
    }
    return { closed, reopened }
  }

  private async close(userId: string, now: Date): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        status: true, suspendedAt: true, email: true, displayName: true,
        enrollments: { where: { status: { in: SEATED } }, select: { cohortId: true } },
        trainerProfile: { select: { id: true } },
      },
    })
    const why = user.status === 'archived' ? ACCOUNT_ARCHIVED_AR : ACCOUNT_SUSPENDED_AR
    /* الرابطُ أوّلا: هو ما يُدخله، والتقويمُ ما يذكّره. وما أبى فيه Zoom تُعيده دورةُ العامل (`revoke_left_registrants`) */
    const zoom = await new CohortService(this.prisma).releaseSessionJoinLinks({ userId }, now)
    if (zoom.failed > 0) console.error(`[zoom] بقي ${zoom.failed} من تسجيلات حسابٍ أُغلق قائما (${userId}): ${zoom.reason}`)
    if (mailable(user.email)) {
      const to = { email: user.email, name: user.displayName }
      for (const e of user.enrollments) await this.invites.release(to, e.cohortId, why, now)
    }
    if (user.trainerProfile) await this.invites.trainerAccountClosed(user.trainerProfile.id, user.suspendedAt ?? now, why, now)
    await this.prisma.user.update({ where: { id: userId }, data: { calendarClosedAt: now } })
  }

  /* وإسنادُه مدرّبا لا يُمسّ هنا: أُغلق فمُحي عنه `calendarSentAt` (`trainerAccountClosed`)، ولا يُكتب له وهو مغلق
     (`trainerJoined`) — فيرسل العاملُ جدولَه حين يعود (`sweepTrainerCalendars`) */
  private async reopen(userId: string): Promise<void> {
    const seats = await this.prisma.enrollment.findMany({
      where: { userId, status: { in: SEATED } }, select: { id: true, cohortId: true },
    })
    /* والتاريخُ يُمحى أوّلا: ما يصله الآن صار في تقويمه، فيرفعه تركُ مقعدٍ بعدها (`seatLeft`) */
    await this.prisma.user.update({ where: { id: userId }, data: { calendarClosedAt: null } })
    const enrollments = new EnrollmentService(this.prisma)
    for (const e of seats) await enrollments.seatTaken(e.id, e.cohortId)
  }
}
