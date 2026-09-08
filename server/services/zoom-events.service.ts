/* ما يُكتب حين يبلّغ Zoom.

   الحدثُ خبرٌ عن الماضي، فيُكتب في `ZoomMeeting` ما وقع فعلا: بدايةٌ ونهايةٌ
   ومدّةٌ ومتى دخل المضيف. والمجدولُ يبقى كما هو — نيّةٌ في `CohortSession`،
   وخبرٌ هنا، ولا يُخلط بينهما فيُقرأ التأخّرُ التزاما.

   ── والجلسةُ تُطابَق بالرقم لا تُصدَّق ──

   جسمُ الحدث يقول `id`، فيُبحث عنه في `ZoomMeeting.meetingId`. وما لا
   يُطابَق يُتجاهَل بصمت: قد يكون اجتماعا أنشأه أحدٌ في حساب Zoom نفسِه من
   خارج المنصّة، وليس ذلك خطأً يُصرَخ منه. */

import type { PrismaClient } from '@prisma/client'

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

      case 'meeting.ended':
        await this.prisma.zoomMeeting.update({
          where: { sessionId: meeting.sessionId },
          data: {
            actualEndAt: asDate(object.end_time) ?? new Date(),
            durationMin: typeof object.duration === 'number' ? object.duration : undefined,
          },
        })
        return true

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
