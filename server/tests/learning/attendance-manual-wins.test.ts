/* تصحيحُ المدرّب لا تدوسه مزامنةُ Zoom (٨ نوفمبر ٢٠٢٦) — والعلّةُ في `ProgressService.markAttendance`.

   Zoom يكتب الحضورَ بعد اللقاء ولا يمسّ ما وضعه إنسان (`source = 'manual'`). لكنّ المدرّبَ إذا **صحّح** صفّا كتبه Zoom
   بقي الصفُّ `zoom`: فلقاءٌ أُعيد فتحُه ثمّ أُنهي (إنهاءٌ بالخطأ ثمّ رجوع) يعيد «غائبا» على من جعله المدرّبُ «معذورا». */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { ZoomEventService } from '../../services/zoom-events.service'
import { ProgressService } from '../../services/progress.service'
import { forgetZoomToken } from '../../services/zoom.service'

const MEETING_ID = '7170717071'
const START = new Date('2027-02-10T09:00:00Z')

let prisma: PrismaClient
let events: ZoomEventService
let sessionId = ''
let learner = ''
let trainerUserId = ''

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  events = new ZoomEventService(prisma)
  const auth = new AuthService(prisma)
  const config = { accountId: 'a', clientId: 'c', clientSecret: 's', hostEmail: 'h@wajeez.test', webhookSecret: 'w' }
  await prisma.integrationSetting.upsert({ where: { provider: 'zoom' }, update: { enabled: true, config }, create: { provider: 'zoom', enabled: true, config } })

  const cohort = await prisma.cohort.create({ data: { courseId: 'C-BIZ-101', title: 'شعبة التصحيح', status: 'active', capacity: 20 } })
  sessionId = (await prisma.cohortSession.create({ data: { cohortId: cohort.id, title: 'لقاء التصحيح', startsAt: START, status: 'scheduled' } })).id
  await prisma.zoomMeeting.create({ data: { sessionId, provider: 'zoom_api', joinUrl: 'https://zoom.us/j/7170717071', meetingId: MEETING_ID, durationMin: 90 } })

  const t = await auth.register('amw-trainer@wajeez.test', 'Trainer#12345', 'مدرب الشعبة')
  trainerUserId = t.userId
  const application = await prisma.trainerApplication.create({
    data: { reference: 'TR-AMW-1', fullName: 'مدرب الشعبة', email: 'amw-trainer@wajeez.test', phone: '0790000098', status: 'active', motivation: 'اختبار', privacyConsentAt: new Date() },
  })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: application.id, userId: trainerUserId, isVerified: true } })
  await prisma.cohortTrainer.create({ data: { cohortId: cohort.id, profileId: profile.id, role: 'lead' } })

  const u = await auth.register('amw-learner@wajeez.test', 'Learner#12345', 'متعلم استأذن')
  learner = (await prisma.enrollment.create({ data: { userId: u.userId, cohortId: cohort.id, status: 'enrolled' } })).id
  await prisma.sessionJoinLink.create({ data: { sessionId, enrollmentId: learner, registrantId: 'r-amw', joinUrl: 'https://zoom.us/w/1' } })
}, 240_000)

beforeEach(() => {
  forgetZoomToken()
  /* تقريرُ Zoom فارغ: المتعلّمُ لم يدخل — فيُكتب غائبا */
  globalThis.fetch = (async (url: string) => {
    const u = String(url)
    if (u.includes('/oauth/token')) return { ok: true, status: 200, json: async () => ({ access_token: 'tok', expires_in: 3600 }) }
    if (u.includes('/past_meetings/')) return { ok: true, status: 200, json: async () => ({ participants: [] }) }
    return { ok: true, status: 200, json: async () => ({}) }
  }) as unknown as typeof fetch
})

const mark = () => prisma.attendance.findUniqueOrThrow({ where: { sessionId_enrollmentId: { sessionId, enrollmentId: learner } } })

describe('تصحيح المدرب لا تدوسه المزامنة', () => {
  it('⚠️ Zoom كتب «غائب»، والمدرب صححه «معذور»، ثم أنهي اللقاء ثانية: يبقى «معذور»', async () => {
    await events.handle('meeting.ended', { id: MEETING_ID, uuid: 'first/uuid==', end_time: '2027-02-10T10:30:00Z', duration: 90 })
    expect(await mark()).toMatchObject({ status: 'absent', source: 'zoom' })

    await new ProgressService(prisma).markAttendance(trainerUserId, sessionId, learner, 'excused', 'استأذن مسبقا')
    expect((await mark()).source, 'بقي التصحيح باسم Zoom').toBe('manual')

    /* أعيد فتح اللقاء ثم أنهي — تقرير جديد ومزامنة جديدة */
    await events.handle('meeting.ended', { id: MEETING_ID, uuid: 'second/uuid==', end_time: '2027-02-10T10:45:00Z', duration: 90 })
    expect((await mark()).status, 'داست المزامنة تصحيح المدرب').toBe('excused')
  })
})
