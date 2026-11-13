/* من حضر يُكتب حاضرا ولو لم يكن له رابطُ تسجيلٍ عند Zoom (١٣ نوفمبر ٢٠٢٦، قرارُ صاحب المنصّة «Fix both»).

   كانت المطابقةُ في `syncAttendance` بروابط التسجيل وحدَها. فمن لا رابطَ له — التحق بعد إنشاء اللقاء، أو أبى Zoom
   تسجيلَه لنوع الحساب — يُكتب غائبا وقد حضر: جُرّب ٥٥ دقيقةً من ٦٠، «غائب». ومن دخل من داخل الموقع دخل بالاسم
   وحدَه، فلا بريدَ في صفّه يُطابَق. فصارت المطابقةُ ببريد حساب كلّ من له مقعد، والتذكرةُ تحمل البريدَ إلى الدخول.

   ولا شبكة: `fetch` مُلتقَط، والقاعدةُ حقيقيّة. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { ZoomEventService } from '../../services/zoom-events.service'
import { CohortService } from '../../services/cohort.service'
import { forgetZoomToken } from '../../services/zoom.service'

const STAMP = Date.now()
const MEETING_ID = `88${String(STAMP).slice(-8)}`
const START = new Date('2027-03-10T09:00:00Z')
const realFetch = globalThis.fetch
const savedEnv = { key: process.env.ZOOM_SDK_KEY, secret: process.env.ZOOM_SDK_SECRET }

let prisma: PrismaClient
let auth: AuthService
let cohortId = ''
let sessionId = ''
let report: unknown[] = []

const seat = async (tag: string, status = 'enrolled') => {
  const email = `zanl-${tag}-${STAMP}@test.local`
  const { userId } = await auth.register(email, 'Learner#12345', `متعلم ${tag}`)
  const e = await prisma.enrollment.create({ data: { userId, cohortId, status } })
  return { email, userId, enrollmentId: e.id }
}
const mark = (enrollmentId: string) =>
  prisma.attendance.findUnique({ where: { sessionId_enrollmentId: { sessionId, enrollmentId } } }).then((a) => a?.status ?? null)

beforeAll(async () => {
  process.env.ZOOM_SDK_KEY = 'sdk_key_no_link'
  process.env.ZOOM_SDK_SECRET = 'sdk_secret_no_link'
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  const zoomConfig = { accountId: 'a', clientId: 'c', clientSecret: 's', hostEmail: 'h@wajeez.test', webhookSecret: 'w' }
  await prisma.integrationSetting.upsert({
    where: { provider: 'zoom' }, update: { enabled: true, config: zoomConfig }, create: { provider: 'zoom', enabled: true, config: zoomConfig },
  })
  cohortId = (await prisma.cohort.create({ data: { courseId: 'C-BIZ-101', title: 'شعبة بلا روابط', status: 'active', capacity: 20 } })).id
  sessionId = (await prisma.cohortSession.create({
    data: { cohortId, title: 'لقاء بلا روابط', startsAt: START, endsAt: new Date(START.getTime() + 3_600_000), status: 'scheduled', approvalState: 'approved' },
  })).id
  await prisma.zoomMeeting.create({
    data: { sessionId, provider: 'zoom_api', joinUrl: `https://zoom.us/j/${MEETING_ID}`, meetingId: MEETING_ID, durationMin: 60 },
  })
  forgetZoomToken()
  globalThis.fetch = (async (url: string) => {
    const u = String(url)
    if (u.includes('/oauth/token')) return { ok: true, status: 200, json: async () => ({ access_token: 'tok', expires_in: 3600 }) }
    if (u.includes('/past_meetings/')) return { ok: true, status: 200, json: async () => ({ participants: report }) }
    return { ok: true, status: 200, json: async () => ({}) }
  }) as unknown as typeof fetch
}, 240_000)

afterAll(() => {
  globalThis.fetch = realFetch
  process.env.ZOOM_SDK_KEY = savedEnv.key
  process.env.ZOOM_SDK_SECRET = savedEnv.secret
})

describe('الحضور بلا رابط تسجيل', () => {
  it('⚠️ من لا رابط له وحضر يكتب حاضرا — ومن غاب غائبا، والمنسحب لا يكتب له شيء', async () => {
    const noLink = await seat('nolink')
    const absent = await seat('absent')
    const dropped = await seat('dropped', 'dropped')
    report = [
      /* ٥٥ دقيقةً من ٦٠ — وبريدُه بحروفٍ كبيرةٍ كما قد يكتبه في Zoom */
      { name: 'بلا رابط', user_email: noLink.email.toUpperCase(), join_time: START.toISOString(), duration: 55 * 60 },
      { name: 'منسحب', user_email: dropped.email, join_time: START.toISOString(), duration: 55 * 60 },
    ]
    await new ZoomEventService(prisma).handle('meeting.ended', { id: MEETING_ID, uuid: `u-${STAMP}`, end_time: '2027-03-10T10:00:00Z', duration: 60 })

    expect(await mark(noLink.enrollmentId), 'كتب غائبا من حضر بلا رابط').toBe('present')
    expect(await mark(absent.enrollmentId)).toBe('absent')
    expect(await mark(dropped.enrollmentId), 'كتب حضورا لمنسحب').toBeNull()
    const row = await prisma.sessionParticipation.findFirst({ where: { sessionId, displayName: 'بلا رابط' } })
    expect(row?.enrollmentId, 'لم تنسب واقعته إلى صاحبها').toBe(noLink.enrollmentId)
  })

  it('⚠️ وتذكرة الدخول من داخل الموقع تحمل بريد حسابه — فيطابق في التقرير', async () => {
    const live = (await prisma.cohortSession.create({
      data: {
        cohortId, title: 'لقاء قادم', startsAt: new Date(Date.now() + 86_400_000),
        endsAt: new Date(Date.now() + 86_400_000 + 3_600_000), status: 'scheduled', approvalState: 'approved',
      },
    })).id
    await prisma.zoomMeeting.create({ data: { sessionId: live, provider: 'zoom_api', joinUrl: 'https://zoom.us/j/1', meetingId: `9${MEETING_ID}` } })
    const learner = await seat('embed')
    const ticket = await new CohortService(prisma).meetingSdkTicket(learner.userId, live)
    expect(ticket.userEmail, 'دخل بالاسم وحده').toBe(learner.email)
  })
})
