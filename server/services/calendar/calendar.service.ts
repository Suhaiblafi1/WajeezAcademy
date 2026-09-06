/* دعواتُ التقويم للمواعيد الحقيقية — جلسةُ شعبة، ومقابلةُ مدرّب.

   ما يقرّره هذا الملفّ: كيف يصير صفٌّ في القاعدة موعدا في تقويم إنسان.
   والمعرّفُ (UID) يُشتقّ من معرّف الصفّ لا يُولَّد عشوائيا — فتعديلُ
   الموعد يُحدِّث ما في التقويم بدل أن يُنتج نسخةً ثانية.

   والصلاحية تُفحص هنا لا في المسار وحده: جلسةُ الشعبة لمن سجّل فيها أو
   لمن يشغّلها، ومقابلةُ المدرّب لصاحبها أو لمن يراجع الطلبات.

   و«يشغّلها» ليست صلاحيةً عامّة: مديرُ الشعب يصل إلى كلّ شعبة، أمّا
   المدرّبُ فإلى شعبه المسنَدة إليه وحدها. وكانت الصلاحيتان مجموعتين في
   رايةٍ واحدة تتخطّى الفحص كلَّه — فمرّت شعبةٌ ليست له. */

import { ACADEMY_EMAILS } from '../integrations.service'
import type { PrismaClient } from '@prisma/client'
import { AuthError } from '../auth.service'
import { buildIcs } from './ics'

/** المنظِّمُ واحدٌ في كلّ دعواتنا — ويُقرأ من إعدادات البريد حين تُضبط */
const ORGANIZER = { name: 'أكاديمية وجيز', email: ACADEMY_EMAILS.calendar }

/** ساعةٌ افتراضية للجلسة التي لا نهايةَ لها في القاعدة */
const DEFAULT_MINUTES = 60

export class CalendarService {
  private prisma: PrismaClient
  private siteUrl: string
  constructor(prisma: PrismaClient, siteUrl = 'https://wajeez-academy.vercel.app') {
    this.prisma = prisma
    this.siteUrl = siteUrl
  }

  /** جلسةُ شعبة — لمن سجّل فيها، أو لمديرِ الشعب، أو لمدرّبها المسنَد */
  async cohortSessionIcs(
    sessionId: string,
    userId: string,
    access: { manageAll: boolean; trainerOperate: boolean },
  ) {
    const s = await this.prisma.cohortSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true, title: true, startsAt: true, endsAt: true, status: true,
        cohort: {
          select: {
            id: true, title: true,
            enrollments: { where: { userId, status: 'enrolled' }, select: { id: true } },
          },
        },
      },
    })
    if (!s) throw new AuthError('not_found', 'الجلسة غير موجودة', 404)

    let allowed = access.manageAll || s.cohort.enrollments.length > 0
    /* المدرّبُ يصل إلى شعبه المسنَدة إليه وحدها — لا إلى كلّ شعبة */
    if (!allowed && access.trainerOperate) {
      const profile = await this.prisma.trainerProfile.findUnique({
        where: { userId }, select: { id: true, suspendedAt: true },
      })
      if (profile && !profile.suspendedAt) {
        const link = await this.prisma.cohortTrainer.findUnique({
          where: { cohortId_profileId: { cohortId: s.cohort.id, profileId: profile.id } },
          select: { cohortId: true },
        })
        allowed = link !== null
      }
    }
    if (!allowed) throw new AuthError('not_enrolled', 'هذه الجلسة ليست في شعبك', 403)

    const minutes = s.endsAt
      ? Math.max(15, Math.round((s.endsAt.getTime() - s.startsAt.getTime()) / 60_000))
      : DEFAULT_MINUTES

    return {
      filename: `wajeez-session-${s.id}.ics`,
      content: buildIcs({
        uid: `session-${s.id}@wajeez-academy`,
        title: `${s.title} — ${s.cohort.title}`,
        startsAt: s.startsAt,
        durationMinutes: minutes,
        description: 'جلسةٌ من شعبتك في أكاديمية وجيز. رابط الحضور في بوّابتك.',
        url: `${this.siteUrl}/student/learning`,
        organizer: ORGANIZER,
        cancelled: s.status === 'cancelled',
      }),
    }
  }

  /** مقابلةُ مدرّب — لصاحب الطلب أو لمن يراجع الطلبات */
  async trainerInterviewIcs(interviewId: string, opts: { email?: string; canReview: boolean }) {
    const iv = await this.prisma.trainerInterview.findUnique({
      where: { id: interviewId },
      select: {
        id: true, scheduledAt: true, mode: true, outcome: true,
        application: { select: { fullName: true, email: true, reference: true } },
      },
    })
    if (!iv) throw new AuthError('not_found', 'المقابلة غير موجودة', 404)
    const isOwner = !!opts.email && opts.email.toLowerCase() === iv.application.email.toLowerCase()
    if (!opts.canReview && !isOwner) throw new AuthError('forbidden', 'هذه المقابلة ليست لك', 403)

    return {
      filename: `wajeez-interview-${iv.id}.ics`,
      content: buildIcs({
        uid: `interview-${iv.id}@wajeez-academy`,
        title: 'مقابلة انضمام إلى نخبة مدرّبي وجيز',
        startsAt: iv.scheduledAt,
        durationMinutes: 45,
        description: `مقابلةٌ بشأن طلبك رقم ${iv.application.reference}. ${
          iv.mode === 'in_person' ? 'حضوريّة.' : 'عن بُعد — يصلك الرابط قبل الموعد.'
        }`,
        url: `${this.siteUrl}/join-trainer`,
        organizer: ORGANIZER,
        attendee: { name: iv.application.fullName, email: iv.application.email },
        cancelled: iv.outcome === 'failed',
      }),
    }
  }
}
