/* اجتماعاتُ Zoom للشعبة الملغاة تُحذف، وإعادةُ فتحها تُنشئها (٢٨ أكتوبر ٢٠٢٦، «yes delete them»).

   ① الإلغاءُ يحذف عند Zoom اجتماعَ كلِّ لقاءٍ آتٍ ويمحو صفَّه — ولا يمسّ ما انعقد.
   ② وما أبى فيه Zoom يبقى صفُّه، فيحذفه العاملُ في دورته التالية.
   ③ وإعادةُ الفتح تُنشئ اجتماعا لكلّ لقاءٍ آتٍ معتمَد، والدعوةُ العائدةُ تحمل رابطَه.
   ④ وشعبةٌ أُلغيت بغير بابه يحذف العاملُ اجتماعاتِها.

   ولا شبكةَ هنا: `fetch` مُلتقَط. */

import { afterAll, beforeAll, describe, expect as vexpect, it } from 'vitest'
import { plainExpect } from '../helpers/plain-expect'
const expect = plainExpect(vexpect)
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { CohortService } from '../../services/cohort.service'
import { forgetZoomToken } from '../../services/zoom.service'
import { runCancelledCohortMeetings } from '../../worker/jobs'

let prisma: PrismaClient
let cohorts: CohortService
let adminId = ''
let courseId = ''
const STAMP = Date.now()
const H = 3_600_000
const SAVED = { ...process.env }

/** ما طُلب من Zoom — والحذفُ يأبى لمعرّفٍ في `refuse` */
const deletedIds: string[] = []
const refuse = new Set<string>()
let meetingSeq = 0

function stubZoom() {
  process.env.ZOOM_ACCOUNT_ID = 'acc'
  process.env.ZOOM_CLIENT_ID = 'cid'
  process.env.ZOOM_CLIENT_SECRET = 'sec'
  process.env.ZOOM_HOST_EMAIL = 'lessons@wajeez.test'
  globalThis.fetch = (async (url: string, init?: { method?: string; body?: string }) => {
    const u = String(url)
    const ok = (json: unknown, status = 200) => ({ ok: true, status, json: async () => json })
    if (u.includes('/oauth/token')) return ok({ access_token: 't', expires_in: 3600 })
    if (init?.method === 'POST' && /\/users\/[^/]+\/meetings$/.test(u)) {
      meetingSeq += 1
      const id = `8${STAMP % 1000}${meetingSeq}`
      return ok({ id, join_url: `https://zoom.us/j/${id}`, start_url: `https://zoom.us/s/${id}`, password: 'p' }, 201)
    }
    if (init?.method === 'POST' && u.includes('/registrants')) {
      const { email } = JSON.parse(init.body ?? '{}') as { email: string }
      return ok({ registrant_id: `r-${email}`, join_url: `https://zoom.us/w/x?tk=${encodeURIComponent(email)}` }, 201)
    }
    if (init?.method === 'DELETE') {
      const id = decodeURIComponent(u.split('/meetings/')[1]!.split(/[/?]/)[0]!)
      if (refuse.has(id)) return { ok: false, status: 500, json: async () => ({}) }
      deletedIds.push(id)
      return { ok: true, status: 204, json: async () => ({}) }
    }
    if (init?.method === 'PATCH') return { ok: true, status: 204, json: async () => ({}) }
    return { ok: false, status: 404, json: async () => ({}) }
  }) as unknown as typeof fetch
  forgetZoomToken()
}

let seq = 0
async function makeCohort() {
  seq += 1
  const c = await prisma.cohort.create({
    data: { courseId, title: `شعبة زووم ${seq}`, status: 'open', capacity: 20, price: 100, currency: 'USD', timezone: 'Asia/Amman' },
  })
  const u = await prisma.user.create({ data: { email: `cz-l${seq}-${STAMP}@wajeez.test`, displayName: 'متعلّم', passwordHash: 'x' } })
  await prisma.enrollment.create({ data: { userId: u.id, cohortId: c.id, status: 'enrolled' } })
  return c.id
}

/** لقاءٌ معتمَدٌ باجتماعه في Zoom */
async function sessionWithMeeting(cohortId: string, hours: number) {
  seq += 1
  const startsAt = new Date(Date.now() + hours * H)
  const s = await prisma.cohortSession.create({
    data: { cohortId, title: `لقاء ${seq}`, startsAt, endsAt: new Date(startsAt.getTime() + 2 * H), approvalState: 'approved', wantsMeeting: true },
  })
  const zoom = await cohorts.attachApiZoom(adminId, s.id, undefined, false)
  return { id: s.id, meetingId: zoom.meetingId! }
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  cohorts = new CohortService(prisma)
  stubZoom()
  adminId = (await prisma.user.create({ data: { email: `cz-admin-${STAMP}@wajeez.test`, displayName: 'الإدارة', passwordHash: 'x' } })).id
  courseId = (await prisma.course.findFirst({ select: { id: true } }))!.id
}, 240_000)

afterAll(() => {
  for (const k of ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET', 'ZOOM_HOST_EMAIL']) {
    if (SAVED[k] === undefined) delete process.env[k]
    else process.env[k] = SAVED[k]
  }
  forgetZoomToken()
})

describe('اجتماعاتُ الشعبة الملغاة', () => {
  it('① الإلغاءُ يحذف اجتماعاتها الآتية — لا ما انعقد — ② وما أبى فيه Zoom يحذفه العامل — ③ والفتحُ يُنشئها', async () => {
    const cohortId = await makeCohort()
    const a = await sessionWithMeeting(cohortId, 48)
    const b = await sessionWithMeeting(cohortId, 72)
    const held = await sessionWithMeeting(cohortId, 96)
    await prisma.zoomMeeting.update({ where: { sessionId: held.id }, data: { actualStartAt: new Date() } })
    refuse.add(b.meetingId)

    await cohorts.transition(cohortId, 'cancelled', adminId, 'اختبار', { reasonAr: 'اختبار' })
    expect(deletedIds).toContain(a.meetingId)
    expect(await prisma.zoomMeeting.findUnique({ where: { sessionId: a.id } })).toBeNull()
    expect(deletedIds).not.toContain(held.meetingId)
    expect(await prisma.zoomMeeting.findUnique({ where: { sessionId: held.id } }), 'ما انعقد يبقى').not.toBeNull()
    expect(await prisma.zoomMeeting.findUnique({ where: { sessionId: b.id } }), 'أبى Zoom فبقي صفّه').not.toBeNull()

    refuse.delete(b.meetingId)
    await runCancelledCohortMeetings(prisma)
    expect(deletedIds).toContain(b.meetingId)
    expect(await prisma.zoomMeeting.findUnique({ where: { sessionId: b.id } })).toBeNull()

    const reopened = await cohorts.reopen(cohortId, adminId)
    expect(reopened.meetingsCreated).toBe(2)
    const restored = await prisma.zoomMeeting.findUnique({ where: { sessionId: a.id } })
    expect(restored?.provider).toBe('zoom_api')
    expect(restored?.meetingId).not.toBe(a.meetingId)
  })

  it('④ شعبةٌ أُلغيت بغير بابه يحذف العاملُ اجتماعاتِها', async () => {
    const cohortId = await makeCohort()
    const s = await sessionWithMeeting(cohortId, 30)
    await prisma.cohort.update({ where: { id: cohortId }, data: { status: 'cancelled' } })
    expect(await prisma.zoomMeeting.findUnique({ where: { sessionId: s.id } })).not.toBeNull()
    await runCancelledCohortMeetings(prisma)
    expect(deletedIds).toContain(s.meetingId)
    expect(await prisma.zoomMeeting.findUnique({ where: { sessionId: s.id } })).toBeNull()
  })
})
