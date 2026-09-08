/* ما يُكتب حين يبلّغ Zoom.

   الحدثُ خبرٌ عن الماضي، فيُكتب في `ZoomMeeting` ما وقع فعلا: بدايةٌ ونهايةٌ
   ومدّةٌ ومتى دخل المضيف. والمجدولُ يبقى كما هو — نيّةٌ في `CohortSession`،
   وخبرٌ هنا، ولا يُخلط بينهما فيُقرأ التأخّرُ التزاما.

   ── والجلسةُ تُطابَق بالرقم لا تُصدَّق ──

   جسمُ الحدث يقول `id`، فيُبحث عنه في `ZoomMeeting.meetingId`. وما لا
   يُطابَق يُتجاهَل بصمت: قد يكون اجتماعا أنشأه أحدٌ في حساب Zoom نفسِه من
   خارج المنصّة، وليس ذلك خطأً يُصرَخ منه. */

import type { PrismaClient } from '@prisma/client'
import { fetchZoomParticipants, getZoomConfig, zoomReady } from './zoom.service'
import { recordAudit } from './audit'

export interface ZoomEventObject {
  id?: number | string
  uuid?: string
  start_time?: string
  end_time?: string
  duration?: number
  participant?: { user_name?: string; email?: string; join_time?: string; leave_time?: string }
}

const asDate = (v?: string): Date | null => {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

export class ZoomEventService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** يردّ `false` حين لا يخصّ الحدثُ اجتماعا نعرفه — لا خطأً */
  async handle(event: string, object: ZoomEventObject): Promise<boolean> {
    const meetingId = object.id == null ? '' : String(object.id)
    if (!meetingId) return false
    const meeting = await this.prisma.zoomMeeting.findFirst({ where: { meetingId } })
    if (!meeting) return false

    switch (event) {
      case 'meeting.started':
        await this.prisma.zoomMeeting.update({
          where: { sessionId: meeting.sessionId },
          data: { actualStartAt: asDate(object.start_time) ?? new Date() },
        })
        return true

      case 'meeting.ended': {
        await this.prisma.zoomMeeting.update({
          where: { sessionId: meeting.sessionId },
          data: {
            actualEndAt: asDate(object.end_time) ?? new Date(),
            durationMin: typeof object.duration === 'number' ? object.duration : undefined,
          },
        })
        /* وتقريرُ من حضر بعده. ولا يُسقط الحدثَ إن تعذّر: النهايةُ كُتبت
           أعلاه، والسببُ يُكتب في `syncError` فيُقرأ في الشاشة. */
        const uuid = object.uuid ?? ''
        if (uuid) {
          await this.syncAttendance(meeting.sessionId, uuid).catch(async (e: unknown) => {
            await this.prisma.zoomMeeting.update({
              where: { sessionId: meeting.sessionId },
              data: { syncState: 'failed', syncError: e instanceof Error ? e.message : 'تعذّرت مزامنةُ الحضور' },
            })
          })
        }
        return true
      }

      case 'meeting.participant_joined': {
        /* دخولُ المضيف يُكتب وحدَه: منه تُقرأ «تأخّر المدرّبُ عن لقائه».
           والمشاركون يُقرأون من تقرير ما بعد اللقاء لا من هذه الأحداث —
           فهي تصل مبعثرةً ويُخطئ رصفُها، والتقريرُ يعطيها مجموعةً. */
        const email = object.participant?.email?.toLowerCase()
        if (!email) return false
        const isHost = await this.isHostEmail(meeting.sessionId, email)
        if (!isHost) return false
        await this.prisma.zoomMeeting.update({
          where: { sessionId: meeting.sessionId },
          data: { hostJoinedAt: asDate(object.participant?.join_time) ?? new Date() },
        })
        return true
      }

      default:
        return false
    }
  }

  /* ══════════ من الدقائق إلى الحكم ══════════

     الواقعةُ تُحفظ كما جاءت (`SessionParticipation`)، ثمّ يُشتقّ منها
     `Attendance`. وفصلُهما مقصود: من راجع بعد شهرٍ رأى على أيّ دقائقَ بُني
     الحكم، ولا يجد رقما بلا أصل.

     ── والمطابقةُ بالبريد ──

     Zoom يبلّغ ببريد **المسجَّل**، فيُطابَق بحساب المتعلّم. ومن لم يُطابَق
     يُحفظ صفُّه بـ`enrollmentId` فارغ: ضيفٌ أو المدرّبُ نفسُه أو من دخل
     ببريدٍ آخر — والواقعةُ تبقى، ولا يُصنع لها حكم.

     ── وحدُّ الحضور ──

       · حاضرٌ إن بقي نصفَ المدّة فأكثر
       · متأخّرٌ إن دخل بعد البداية بأكثرَ من عشر دقائق (وقد بقي نصفَها)
       · وغائبٌ إن لم يبلغ النصف — أو لم يظهر أصلا

     والدقائقُ تُجمع لمن دخل وخرج مرّاتٍ: انقطاعُ الاتّصال ثلاثَ مرّاتٍ
     ليس ثلاثةَ أشخاصٍ ولا غيابا.

     ── وما لا يفعله هذا أبدا ──

     **لا يمسح حكما وضعه إنسان.** المدرّبُ يعرف ما لا يعرفه العدّاد: من
     استأذن، ومن حضر بجهازٍ ثانٍ، ومن انقطع لعطبٍ في الشبكة. فما كان
     `source = 'manual'` يبقى كما هو — والمشتقُّ يكتب ما لم يُحكَم فيه،
     ويُحدّث ما كتبه هو نفسُه من قبل. */
  private async syncAttendance(sessionId: string, meetingUuid: string) {
    const config = await getZoomConfig(this.prisma)
    if (!zoomReady(config)) return

    const session = await this.prisma.cohortSession.findUnique({
      where: { id: sessionId },
      select: { startsAt: true, zoom: { select: { durationMin: true } } },
    })
    if (!session) return

    const people = await fetchZoomParticipants(config, meetingUuid)

    /* الوقائعُ أوّلا: تُمحى وتُكتب من جديد فلا تتراكم على إعادة إرسالٍ من Zoom */
    await this.prisma.sessionParticipation.deleteMany({ where: { sessionId } })

    const links = await this.prisma.sessionJoinLink.findMany({
      where: { sessionId },
      select: { enrollmentId: true, enrollment: { select: { user: { select: { email: true } } } } },
    })
    const byEmail = new Map<string, string>()
    for (const l of links) {
      const em = l.enrollment.user?.email?.toLowerCase()
      if (em) byEmail.set(em, l.enrollmentId)
    }

    /* الدقائقُ تُجمع لصاحبها: من انقطع اتّصالُه وعاد صفّان في التقرير */
    interface Tally { minutes: number; firstJoin: Date; enrollmentId: string | null }
    const tally = new Map<string, Tally>()
    for (const p of people) {
      const enrollmentId = p.email ? byEmail.get(p.email) ?? null : null
      const key = p.email ?? `name:${p.name}`
      await this.prisma.sessionParticipation.create({
        data: {
          sessionId, enrollmentId, email: p.email, displayName: p.name,
          joinedAt: p.joinedAt, leftAt: p.leftAt, minutes: p.minutes,
        },
      })
      const prev = tally.get(key)
      tally.set(key, {
        minutes: (prev?.minutes ?? 0) + p.minutes,
        firstJoin: prev && prev.firstJoin < p.joinedAt ? prev.firstJoin : p.joinedAt,
        enrollmentId,
      })
    }

    const durationMin = session.zoom?.durationMin ?? 0
    const halfway = durationMin > 0 ? durationMin / 2 : 0

    /* والغائبُ يُحكم له كذلك: من لم يظهر في التقرير أصلا لا يبقى بلا حكم */
    const enrolled = await this.prisma.enrollment.findMany({
      where: { cohort: { sessions: { some: { id: sessionId } } }, status: 'enrolled' },
      select: { id: true },
    })

    let written = 0
    for (const e of enrolled) {
      const row = [...tally.values()].find((t) => t.enrollmentId === e.id)
      const minutes = row?.minutes ?? 0
      const lateBy = row ? (row.firstJoin.getTime() - session.startsAt.getTime()) / 60_000 : 0
      const status = !row || (halfway > 0 && minutes < halfway)
        ? 'absent'
        : lateBy > 10 ? 'late' : 'present'

      const existing = await this.prisma.attendance.findUnique({
        where: { sessionId_enrollmentId: { sessionId, enrollmentId: e.id } },
      })
      /* يدُ المدرّب أعلى: هو يعرف من استأذن ومن حضر بجهازٍ ثانٍ */
      if (existing && existing.source === 'manual') continue
      await this.prisma.attendance.upsert({
        where: { sessionId_enrollmentId: { sessionId, enrollmentId: e.id } },
        update: { status, source: 'zoom', markedBy: null },
        create: { sessionId, enrollmentId: e.id, status, source: 'zoom' },
      })
      written += 1
    }

    await this.prisma.zoomMeeting.update({
      where: { sessionId },
      data: { participantCount: people.length, syncState: 'synced', syncError: null },
    })
    await recordAudit(this.prisma, {
      actorId: null, action: 'zoom.attendance_sync', entityType: 'cohort_session', entityId: sessionId,
      meta: { participants: people.length, written, durationMin },
    })
  }

  /** أمضيفُ هذه الجلسة؟ — مدرّبُها المُسنَد أو بريدُ المضيف في الإعداد */
  private async isHostEmail(sessionId: string, email: string): Promise<boolean> {
    const session = await this.prisma.cohortSession.findUnique({
      where: { id: sessionId },
      select: {
        cohort: {
          select: {
            trainers: { select: { profile: { select: { user: { select: { email: true } } } } } },
          },
        },
      },
    })
    return (session?.cohort.trainers ?? []).some(
      (t) => t.profile.user?.email?.toLowerCase() === email,
    )
  }
}
