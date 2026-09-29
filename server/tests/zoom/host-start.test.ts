/* المدرّبُ يبدأ لقاءه مضيفا من بوّابته (٢٩ سبتمبر ٢٠٢٦).

   قال صاحبُ المنصّة: «link it to trainer admin where they can use it to set
   live sessions directly as host». واختار أن تبقى الاجتماعاتُ في حساب
   الأكاديميّة. وكانت الشاشةُ تعطي المدرّبَ رابطَ المشارك — فيدخل مشاركا لا
   مضيفا، والغرفةُ بلا مضيف.

   والحارسُ هنا على ما يجعل رابطَ المضيف آمنا:
   ① يُطلب من Zoom **طازجا** لكلّ ضغطة، ولا يُحفظ في صفٍّ ولا في أثر.
   ② ولمدرّب الشعبة وحدَه — لا لمدرّبٍ غيرِه ولا لمتعلّم.
   ③ وللمعتمَد وحدَه، ولاجتماعٍ أنشأته المنصّة وحدَه.
   ④ وما يرفضه Zoom يُقال باسمه.
   ⑤ ودخولُ المضيف بحساب الأكاديميّة يُكتب دخولا للمضيف — لا يُقرأ «تأخّر».

   ولا شبكةَ هنا: `fetch` مُلتقَط، وطلباتُ Zoom تُعدّ. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { CohortService } from '../../services/cohort.service'
import { ZoomEventService } from '../../services/zoom-events.service'
import { AuthError } from '../../services/auth.service'
import { forgetZoomToken } from '../../services/zoom.service'

let prisma: PrismaClient
let cohorts: CohortService
let trainerUserId = ''
let otherTrainerUserId = ''
let learnerId = ''
const STAMP = Date.now()
const H = 3_600_000

const SAVED = { ...process.env }
/** طلباتُ القراءة إلى Zoom — `GET /meetings/:id` */
const reads: string[] = []
let issued = 0
/** ما يردّه Zoom على القراءة — ٢٠٠ افتراضا */
let readStatus = 200

function stubZoom() {
  process.env.ZOOM_ACCOUNT_ID = 'acc'
  process.env.ZOOM_CLIENT_ID = 'cid'
  process.env.ZOOM_CLIENT_SECRET = 'sec'
  process.env.ZOOM_HOST_EMAIL = 'lessons@wajeez.test'
  globalThis.fetch = (async (url: string, init?: { method?: string }) => {
    if (String(url).includes('/oauth/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 't', expires_in: 3600 }) }
    }
    if (!init?.method || init.method === 'GET') {
      const meetingId = decodeURIComponent(String(url).split('/meetings/')[1] ?? '')
      reads.push(meetingId)
      issued += 1
      if (readStatus !== 200) return { ok: false, status: readStatus, json: async () => ({}) }
      return { ok: true, status: 200, json: async () => ({ start_url: `https://zoom.us/s/${meetingId}?zak=SECRET-${issued}` }) }
    }
    return { ok: false, status: 404, json: async () => ({}) }
  }) as unknown as typeof fetch
  forgetZoomToken()
}

let seq = 0
async function session(cohortId: string, over: Record<string, unknown> = {}, zoom: Record<string, unknown> | null = { provider: 'zoom_api' }) {
  seq += 1
  const startsAt = new Date(Date.now() + 24 * H)
  const s = await prisma.cohortSession.create({
    data: { cohortId, title: `لقاء ${seq}`, startsAt, endsAt: new Date(startsAt.getTime() + 2 * H), ...over },
  })
  if (zoom) {
    await prisma.zoomMeeting.create({
      data: {
        sessionId: s.id, joinUrl: `https://zoom.us/j/${seq}`,
        meetingId: zoom.provider === 'zoom_api' ? `mtg-${STAMP}-${seq}` : null, ...zoom,
      },
    })
  }
  return s
}

let cohortId = ''
beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  cohorts = new CohortService(prisma)
  stubZoom()

  const mkTrainer = async (tag: string) => {
    const u = await prisma.user.create({ data: { email: `hs-${tag}-${STAMP}@wajeez.test`, displayName: `مدرّب ${tag}`, passwordHash: 'x' } })
    const application = await prisma.trainerApplication.create({
      data: { reference: `WJ-TR-HS-${tag}-${STAMP}`, fullName: `مدرّب ${tag}`, email: u.email, status: 'active' },
    })
    const profile = await prisma.trainerProfile.create({ data: { userId: u.id, applicationId: application.id } })
    return { userId: u.id, profileId: profile.id }
  }
  const mine = await mkTrainer('mine')
  const other = await mkTrainer('other')
  trainerUserId = mine.userId
  otherTrainerUserId = other.userId

  cohortId = (await prisma.cohort.create({
    data: { courseId: 'C-BIZ-101', title: 'شعبةُ المضيف', status: 'active', capacity: 10 },
  })).id
  await prisma.cohortTrainer.create({ data: { cohortId, profileId: mine.profileId, role: 'lead' } })
  const elsewhere = await prisma.cohort.create({ data: { courseId: 'C-BIZ-101', title: 'شعبةٌ أخرى', status: 'active', capacity: 10 } })
  await prisma.cohortTrainer.create({ data: { cohortId: elsewhere.id, profileId: other.profileId, role: 'lead' } })

  learnerId = (await prisma.user.create({ data: { email: `hs-learner-${STAMP}@wajeez.test`, displayName: 'متعلّم', passwordHash: 'x' } })).id
  await prisma.enrollment.create({ data: { userId: learnerId, cohortId, status: 'enrolled' } })
}, 180_000)

afterAll(() => {
  for (const k of ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET', 'ZOOM_HOST_EMAIL']) {
    if (SAVED[k] === undefined) delete process.env[k]
    else process.env[k] = SAVED[k]
  }
  forgetZoomToken()
})

const refused = async (p: Promise<unknown>) => {
  const e = await p.then(() => null, (x: unknown) => x)
  expect(e, 'مرّ ما كان يجب أن يُردّ').toBeInstanceOf(AuthError)
  return e as AuthError
}

describe('① رابطُ المضيف طازجٌ من Zoom — ولا يُحفظ', () => {
  it('⚠️ مدرّبُ الشعبة يأخذ رابطَ المضيف الذي ردّه Zoom لاجتماعه بعينه', async () => {
    const s = await session(cohortId)
    const meeting = await prisma.zoomMeeting.findUniqueOrThrow({ where: { sessionId: s.id } })
    const before = reads.length
    const r = await cohorts.trainerHostStart(trainerUserId, s.id)
    expect(reads.slice(before)).toEqual([meeting.meetingId])
    expect(r.startUrl).toMatch(new RegExp(`^https://zoom\\.us/s/${meeting.meetingId}\\?zak=SECRET-`))
  })

  it('⚠️ وكلُّ ضغطةٍ تسأل Zoom من جديد — عمرُ الرابط ساعتان', async () => {
    const s = await session(cohortId)
    const a = await cohorts.trainerHostStart(trainerUserId, s.id)
    const b = await cohorts.trainerHostStart(trainerUserId, s.id)
    expect(a.startUrl).not.toBe(b.startUrl)
  })

  it('⚠️ ولا يُكتب في صفٍّ ولا في أثر: الأثرُ يقول «بدأ» لا «بماذا»', async () => {
    const s = await session(cohortId)
    await cohorts.trainerHostStart(trainerUserId, s.id)
    const meeting = await prisma.zoomMeeting.findUniqueOrThrow({ where: { sessionId: s.id } })
    expect(JSON.stringify(meeting)).not.toContain('zak=')
    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'zoom.host_start', entityId: s.id } })
    expect(audit.actorId).toBe(trainerUserId)
    expect(audit.meta).toMatchObject({ cohortId, meetingId: meeting.meetingId })
    expect(JSON.stringify(audit.meta)).not.toContain('zak=')
  })
})

describe('② لمدرّب الشعبة وحدَه', () => {
  it('⚠️ والمسلكُ بصلاحيّة تشغيل الشعبة، وPOST — رابطُ المضيف لا يستقرّ في سجلّ وسيط', () => {
    const routes = readFileSync(join(process.cwd(), 'server/http/routes/learning-portal.routes.ts'), 'utf8')
    expect(routes).toMatch(/app\.post\('\/api\/trainer\/sessions\/:sessionId\/host-start', \{\s*preHandler: requirePermission\('trainer\.cohort\.operate'\)/)
    expect(routes).not.toMatch(/app\.get\('\/api\/trainer\/sessions\/:sessionId\/host-start'/)
  })

  it('⚠️ لا لمدرّبِ شعبةٍ أخرى ولا لمتعلّمِها — ولا يُسأل Zoom عنهما', async () => {
    const s = await session(cohortId)
    const before = reads.length
    expect((await refused(cohorts.trainerHostStart(otherTrainerUserId, s.id))).status).toBe(403)
    expect((await refused(cohorts.trainerHostStart(learnerId, s.id))).status).toBe(403)
    expect(reads.length, 'سُئل Zoom عن رابطِ مضيفٍ لمن لا يملكه').toBe(before)
  })
})

describe('③ للمعتمَد وحدَه، ولاجتماع المنصّة وحدَه', () => {
  it('⚠️ المنتظِرُ لا يُبدأ — لا يراه متعلّموه بعد', async () => {
    const s = await session(cohortId, { approvalState: 'pending' })
    expect((await refused(cohorts.trainerHostStart(trainerUserId, s.id))).code).toBe('not_approved')
  })

  it('والملغى لا يُبدأ', async () => {
    const s = await session(cohortId, { status: 'cancelled' })
    expect((await refused(cohorts.trainerHostStart(trainerUserId, s.id))).code).toBe('session_cancelled')
  })

  it('⚠️ والرابطُ الملصَقُ بيدٍ لا مضيفَ له عندنا — يُفتح كما هو، ولو حمل رقما', async () => {
    const manual = await session(cohortId, {}, { provider: 'manual', meetingId: '987654321' })
    const before = reads.length
    expect((await refused(cohorts.trainerHostStart(trainerUserId, manual.id))).code).toBe('no_api_meeting')
    expect(reads.length, 'سُئل Zoom عن اجتماعٍ لم تُنشئه المنصّة').toBe(before)
    const none = await session(cohortId, {}, null)
    expect((await refused(cohorts.trainerHostStart(trainerUserId, none.id))).code).toBe('no_api_meeting')
  })
})

describe('④ وما يرفضه Zoom يُقال باسمه', () => {
  it('⚠️ صلاحيّةُ القراءة الناقصة تُسمّى — لا «تعذّر»', async () => {
    const s = await session(cohortId)
    readStatus = 400
    try {
      const e = await refused(cohorts.trainerHostStart(trainerUserId, s.id))
      expect(e.status).toBe(502)
      expect(e.message).toContain('meeting:read:admin')
    } finally { readStatus = 200 }
  })

  it('والاجتماعُ المحذوفُ من لوحة Zoom يُقال', async () => {
    const s = await session(cohortId)
    readStatus = 404
    try {
      expect((await refused(cohorts.trainerHostStart(trainerUserId, s.id))).message).toContain('حُذف')
    } finally { readStatus = 200 }
  })

  it('وبلا مفاتيح Zoom يُقال ما ينقص — ولا يُطلب رمز', async () => {
    const s = await session(cohortId)
    const saved = process.env.ZOOM_CLIENT_SECRET
    delete process.env.ZOOM_CLIENT_SECRET
    try {
      expect((await refused(cohorts.trainerHostStart(trainerUserId, s.id))).code).toBe('zoom_not_configured')
    } finally { process.env.ZOOM_CLIENT_SECRET = saved; forgetZoomToken() }
  })
})

describe('⑤ ومن دخل بحساب المضيف فهو المضيف — أيّا كان بريدُه', () => {
  const joined = (meetingId: string, participant: Record<string, unknown>) =>
    new ZoomEventService(prisma).handle('meeting.participant_joined', {
      id: meetingId, host_id: 'HOST-USER-ID', participant: { join_time: new Date().toISOString(), ...participant },
    })

  it('⚠️ رابطُ المضيف يُدخله بحساب الأكاديميّة لا ببريده — ويُكتب دخولُه', async () => {
    const s = await session(cohortId)
    const m = await prisma.zoomMeeting.findUniqueOrThrow({ where: { sessionId: s.id } })
    expect(await joined(m.meetingId!, { id: 'HOST-USER-ID', email: 'lessons@wajeez.test' })).toBe(true)
    expect((await prisma.zoomMeeting.findUniqueOrThrow({ where: { sessionId: s.id } })).hostJoinedAt).toBeInstanceOf(Date)
  })

  it('⚠️ ومشاركٌ بحسابٍ آخرَ لا يُكتب مضيفا', async () => {
    const s = await session(cohortId)
    const m = await prisma.zoomMeeting.findUniqueOrThrow({ where: { sessionId: s.id } })
    expect(await joined(m.meetingId!, { id: 'SOMEONE-ELSE', email: 'guest@example.com' })).toBe(false)
    expect((await prisma.zoomMeeting.findUniqueOrThrow({ where: { sessionId: s.id } })).hostJoinedAt).toBeNull()
  })

  it('وبريدُ مدرّب الشعبة يبقى يُعرف كما كان', async () => {
    const s = await session(cohortId)
    const m = await prisma.zoomMeeting.findUniqueOrThrow({ where: { sessionId: s.id } })
    const email = (await prisma.user.findUniqueOrThrow({ where: { id: trainerUserId } })).email
    expect(await joined(m.meetingId!, { id: 'TRAINER-OWN-ZOOM', email })).toBe(true)
  })
})
