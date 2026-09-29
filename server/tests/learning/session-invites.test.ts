/* دعواتُ اللقاءات المباشرة — من يُدعى ومتى (٢٩ سبتمبر ٢٠٢٦).

   قال صاحبُ المنصّة: «invite suhaib@wajeez.co and suhaib@wajeez.co to each
   meeting he sit once it approved and also this invitiation goes to each student
   in the class». واختار العنوانَ الثاني Academy@wajeez.co، وللمتعلّمين بريدا
   ودعوةَ تقويم.

   وما تقوله الدعوةُ نفسُها في `calendar/session-invite.test.ts`؛ وهنا على قاعدةٍ
   حقيقيّة:

   ① الاعتمادُ يدعو المسجَّلين والعنوانَين — لا المنسحبَ ولا المنتظِرَ في القائمة —
      وكلٌّ برابطه في Zoom.
   ② والمدعوُّ بعنوانه يُسجَّل في Zoom مرّةً، وتحديثُ الدعوة يحمل رابطَه نفسَه.
   ③ والنقلُ داخلَ الموعد يحدّث الدعوةَ بالمعرّف نفسِه ورقمٍ أعلى.
   ④ والعودةُ لانتظار الإدارة ترفعها من التقويم بموعدها القديم.
   ⑤ والحذفُ يرفعها قبل أن يُمحى صفُّه — والمنتظِرُ لم يُدعَ إليه أحدٌ فلا يُرفع.
   ⑥ ولا دعوةَ لمثالٍ مبدئيّ ولا لما مضى.
   ⑦ وما جدولته الإدارةُ، واعتمادُ تأجيلها، ورابطٌ أُلصق — كلٌّ يدعو أو يحدّث.
   ⑧ والعاملُ يُرسل الدعوةَ مرفقةً بمنهجها، ثمّ يمحوها.

   ولا شبكةَ هنا: `fetch` مُلتقَط، وتسجيلاتُ Zoom تُعدّ. */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { CohortService } from '../../services/cohort.service'
import { CohortMessageService } from '../../services/cohort-message.service'
import { SESSION_GUESTS, SessionInviteService } from '../../services/session-invite.service'
import { drainOutbox, type OutboxIcs } from '../../services/outbox.service'
import { forgetZoomToken } from '../../services/zoom.service'
import { whenAr } from '../../../src/application/learning/cohort-gate'

let prisma: PrismaClient
let cohorts: CohortService
let adminId = ''
let trainerUserId = ''
let cohortId = ''
const STAMP = Date.now()
const H = 3_600_000
const learner: Record<'a' | 'b' | 'dropped' | 'waiting', { id: string; email: string; enrollmentId: string }> = {} as never

const SAVED = { ...process.env }
/** تسجيلاتُ Zoom — بريدُ كلِّ من سُجّل */
const registered: string[] = []
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
      const id = `9${STAMP % 1000}${meetingSeq}`
      return ok({ id, join_url: `https://zoom.us/j/${id}`, start_url: `https://zoom.us/s/${id}`, password: 'p' }, 201)
    }
    if (init?.method === 'POST' && u.includes('/registrants')) {
      const meetingId = decodeURIComponent(u.split('/meetings/')[1]!.split('/')[0]!)
      const { email } = JSON.parse(init.body ?? '{}') as { email: string }
      registered.push(email)
      return ok({ registrant_id: `r-${email}`, join_url: `https://zoom.us/w/${meetingId}?tk=${encodeURIComponent(email)}` }, 201)
    }
    if (init?.method === 'PATCH' || init?.method === 'DELETE') return { ok: true, status: 204, json: async () => ({}) }
    return { ok: false, status: 404, json: async () => ({}) }
  }) as unknown as typeof fetch
  forgetZoomToken()
}

/** الأسطرُ تُطوى عند ٧٥ ثمانيّة — فتُفرَد قبل أن يُطابَق سطرٌ طويل */
const unfold = (ics: string | null) => (ics ?? '').replace(/\r\n /g, '')
/** معرّفاتُ الأحداث سطرا كاملا — لا ورودُ حرفٍ في سطرٍ أطول */
const uids = (ics: string | null) => [...unfold(ics).matchAll(/^UID:(.*?)\r?$/gm)].map((m) => m[1])
const invitesFor = (sessionId: string, purpose?: string) => prisma.outboxMail.findMany({
  where: { batchId: sessionId, ...(purpose ? { purpose } : {}) }, orderBy: { createdAt: 'asc' },
})
const GUESTS = SESSION_GUESTS.map((g) => g.email)

let seq = 0
async function pendingSession(hours: number, over: Record<string, unknown> = {}) {
  seq += 1
  const startsAt = new Date(Date.now() + hours * H)
  return prisma.cohortSession.create({
    data: {
      cohortId, title: `لقاءٌ ${seq}`, startsAt, endsAt: new Date(startsAt.getTime() + 2 * H),
      approvalState: 'pending', wantsMeeting: true, ...over,
    },
  })
}
/** لقاءٌ يُعتمَد من طابور الإدارة — فيُنشأ اجتماعُه وتُسجَّل روابطُه وتخرج دعوتُه */
async function approvedSession(hours: number) {
  const s = await pendingSession(hours)
  await cohorts.decideSession(adminId, s.id, true)
  return s
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  cohorts = new CohortService(prisma)
  stubZoom()

  adminId = (await prisma.user.create({ data: { email: `inv-admin-${STAMP}@wajeez.test`, displayName: 'المعتمِد', passwordHash: 'x' } })).id
  await prisma.userRole.create({ data: { userId: adminId, roleId: 'academic_manager' } })
  const tUser = await prisma.user.create({ data: { email: `inv-trainer-${STAMP}@wajeez.test`, displayName: 'المدرّب', passwordHash: 'x' } })
  trainerUserId = tUser.id
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-INV-${STAMP}`, fullName: 'المدرّب', email: tUser.email, status: 'active' },
  })
  const profile = await prisma.trainerProfile.create({ data: { userId: tUser.id, applicationId: application.id } })
  const course = await prisma.course.findFirst({ select: { id: true } })
  cohortId = (await prisma.cohort.create({
    data: {
      courseId: course!.id, title: 'شعبةُ الدعوات', status: 'active', capacity: 20, price: 100, currency: 'USD', timezone: 'Asia/Amman',
      scheduleWindowStart: new Date(Date.now() - 2 * 24 * H), scheduleWindowEnd: new Date(Date.now() + 60 * 24 * H), maxSessions: 60,
    },
  })).id
  await prisma.cohortTrainer.create({ data: { cohortId, profileId: profile.id, role: 'lead' } })

  for (const [key, status] of [['a', 'enrolled'], ['b', 'enrolled'], ['dropped', 'dropped'], ['waiting', 'waitlisted']] as const) {
    const email = `inv-${key}-${STAMP}@wajeez.test`
    const u = await prisma.user.create({ data: { email, displayName: `متعلّم ${key}`, passwordHash: 'x' } })
    const e = await prisma.enrollment.create({ data: { userId: u.id, cohortId, status } })
    learner[key] = { id: u.id, email, enrollmentId: e.id }
  }
}, 240_000)

afterAll(() => {
  for (const k of ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET', 'ZOOM_HOST_EMAIL']) {
    if (SAVED[k] === undefined) delete process.env[k]
    else process.env[k] = SAVED[k]
  }
  forgetZoomToken()
  vi.useRealTimers()
})

describe('① الاعتمادُ يدعو المسجَّلين والعنوانَين — كلٌّ برابطه', () => {
  it('⚠️ المسجَّلان والعنوانان — لا المنسحبُ ولا المنتظِرُ في القائمة', async () => {
    const s = await approvedSession(48)
    const rows = await invitesFor(s.id)
    expect(rows.map((r) => r.to).sort()).toEqual([learner.a.email, learner.b.email, ...GUESTS].sort())
    for (const r of rows) {
      expect(r.purpose).toBe('session.invite.new')
      expect(r.icsMethod).toBe('REQUEST')
      expect(uids(r.icsContent)).toEqual([`session-${s.id}@wajeez-academy`])
      expect(unfold(r.icsContent)).toContain('RSVP=FALSE')
    }
  })

  it('⚠️ والمتعلّمُ برابطه الخاصّ في Zoom — الذي به يُعرف حضورُه', async () => {
    const s = await approvedSession(49)
    const link = await prisma.sessionJoinLink.findUniqueOrThrow({
      where: { sessionId_enrollmentId: { sessionId: s.id, enrollmentId: learner.a.enrollmentId } },
    })
    const mine = (await invitesFor(s.id)).find((r) => r.to === learner.a.email)!
    expect(unfold(mine.icsContent)).toContain(`LOCATION:${link.joinUrl}`)
    expect(mine.text).toContain('الرابطُ لك وحدَك')
    const other = (await invitesFor(s.id)).find((r) => r.to === learner.b.email)!
    expect(unfold(other.icsContent), 'وصل متعلّما رابطُ غيره').not.toContain(link.joinUrl)
  })
})

describe('② المدعوُّ بعنوانه يُسجَّل في Zoom مرّةً', () => {
  it('⚠️ برابطه هو لا بالرابط المشترك — وتحديثُ الدعوة يحمله بلا تسجيلٍ ثانٍ', async () => {
    const s = await approvedSession(50)
    const guestRows = (await invitesFor(s.id)).filter((r) => GUESTS.includes(r.to))
    for (const r of guestRows) {
      expect(unfold(r.icsContent)).toContain(`tk=${encodeURIComponent(r.to.toLowerCase())}`)
    }
    expect(await prisma.sessionGuestLink.count({ where: { sessionId: s.id } })).toBe(2)
    const before = registered.length
    await new SessionInviteService(prisma).announce(s.id, 'update')
    expect(registered.length, 'سُجّل المدعوُّ ثانيةً').toBe(before)
    const updates = (await invitesFor(s.id, 'session.invite.update')).filter((r) => GUESTS.includes(r.to))
    expect(updates).toHaveLength(2)
    for (const r of updates) expect(unfold(r.icsContent)).toContain(`tk=${encodeURIComponent(r.to.toLowerCase())}`)
  })
})

describe('③ النقلُ داخلَ الموعد يحدّث الدعوةَ — لا يكرّرها', () => {
  it('⚠️ بالمعرّف نفسِه وموعده الجديد ورقمٍ أعلى', async () => {
    const s = await approvedSession(24)
    const [first] = await invitesFor(s.id, 'session.invite.new')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(Date.now() + 60_000))
    const to = new Date(s.startsAt.getTime() + 2 * H)
    try {
      const moved = await cohorts.trainerMoveSession(trainerUserId, s.id, { startsAt: to, endsAt: new Date(to.getTime() + 2 * H) })
      expect(moved.approvalState, 'التأجيلُ القريبُ بلا موعدٍ لمحوره يبقى معتمَدا (٣ج)').toBe('approved')
    } finally { vi.useRealTimers() }
    const updates = await invitesFor(s.id, 'session.invite.update')
    expect(updates.map((r) => r.to).sort()).toEqual([learner.a.email, learner.b.email, ...GUESTS].sort())
    const seqOf = (ics: string | null) => Number(/SEQUENCE:(\d+)/.exec(ics ?? '')?.[1])
    for (const r of updates) {
      expect(uids(r.icsContent), 'التحديثُ بمعرّفٍ آخر — موعدٌ ثانٍ في التقويم').toEqual([`session-${s.id}@wajeez-academy`])
      expect(r.icsContent).toContain(`DTSTART:${to.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`)
      expect(seqOf(r.icsContent)).toBeGreaterThan(seqOf(first!.icsContent))
    }
  })
})

describe('④ العودةُ لانتظار الإدارة ترفعها من التقويم', () => {
  it('⚠️ `CANCEL` لكلّ من دُعي — بموعدها القديم وسببِه', async () => {
    const s = await approvedSession(72)
    const to = new Date(s.startsAt.getTime() + 2 * H)
    const moved = await cohorts.trainerMoveSession(trainerUserId, s.id, { startsAt: to, endsAt: new Date(to.getTime() + 2 * H) })
    expect(moved.approvalState, 'البعيدُ بلا موعدٍ لمحوره يعود للانتظار (٣ج)').toBe('pending')
    const cancels = await invitesFor(s.id, 'session.invite.cancel')
    expect(cancels.map((r) => r.to).sort()).toEqual([learner.a.email, learner.b.email, ...GUESTS].sort())
    for (const r of cancels) {
      expect(r.icsMethod).toBe('CANCEL')
      expect(r.icsContent).toContain('STATUS:CANCELLED')
      expect(uids(r.icsContent)).toEqual([`session-${s.id}@wajeez-academy`])
      expect(r.text).toContain(whenAr(s.startsAt))
      expect(r.text).toContain('يُراجَع الآن عند الإدارة')
    }
  })
})

describe('⑤ الحذفُ يرفعها قبل أن يُمحى صفُّه', () => {
  it('⚠️ المعتمَدُ المحذوفُ يُرفع من تقويم كلّ من دُعي — والرسائلُ تبقى بعد الصفّ', async () => {
    const s = await approvedSession(96)
    await cohorts.trainerDeleteSession(trainerUserId, s.id)
    expect(await prisma.cohortSession.findUnique({ where: { id: s.id } })).toBeNull()
    const cancels = await invitesFor(s.id, 'session.invite.cancel')
    expect(cancels.map((r) => r.to).sort()).toEqual([learner.a.email, learner.b.email, ...GUESTS].sort())
    expect(cancels[0]!.text).toContain('ويصلك بديلُه إن جُدوِل')
  })

  it('والمنتظِرُ لم يُدعَ إليه أحد — فلا يُرفع من تقويم أحد', async () => {
    const s = await pendingSession(97)
    await cohorts.trainerDeleteSession(trainerUserId, s.id)
    expect(await invitesFor(s.id)).toHaveLength(0)
  })
})

describe('⑥ لا دعوةَ لمثالٍ ولا لما مضى', () => {
  it('⚠️ المبدئيُّ مثالٌ يُرفع — والماضي لا يُضاف إلى تقويم', async () => {
    const invites = new SessionInviteService(prisma)
    const example = await prisma.cohortSession.create({
      data: { cohortId, title: 'الجلسة ١ (مثال)', startsAt: new Date(Date.now() + 100 * H), placeholder: true },
    })
    expect(await invites.announce(example.id, 'new')).toBe(0)
    const past = await prisma.cohortSession.create({
      data: { cohortId, title: 'لقاءٌ مضى', startsAt: new Date(Date.now() - 5 * H) },
    })
    expect(await invites.announce(past.id, 'new')).toBe(0)
    expect(await invitesFor(example.id)).toHaveLength(0)
    expect(await invitesFor(past.id)).toHaveLength(0)
  })
})

describe('⑦ وما يُعلن موعدا من غير الاعتماد', () => {
  it('⚠️ ما جدولته الإدارةُ باجتماعه يدعو في الحال', async () => {
    const startsAt = new Date(Date.now() + 120 * H)
    const { session } = await cohorts.addSessionWithMeeting(adminId, cohortId, {
      title: 'لقاءُ الإدارة', startsAt, endsAt: new Date(startsAt.getTime() + 2 * H), withZoom: true,
    })
    const rows = await invitesFor(session.id, 'session.invite.new')
    expect(rows.map((r) => r.to).sort()).toEqual([learner.a.email, learner.b.email, ...GUESTS].sort())
  })

  it('⚠️ واعتمادُ تأجيلٍ اقتُرح يحدّث الدعوة', async () => {
    const s = await approvedSession(130)
    const req = await prisma.sessionRescheduleRequest.create({
      data: {
        sessionId: s.id, requestedBy: trainerUserId, currentStartsAt: s.startsAt,
        proposedStartsAt: new Date(s.startsAt.getTime() + 24 * H), reason: 'اختبار',
      },
    })
    await new CohortMessageService(prisma).review(adminId, req.id, { action: 'approve' })
    const updates = await invitesFor(s.id, 'session.invite.update')
    expect(updates.map((r) => r.to).sort()).toEqual([learner.a.email, learner.b.email, ...GUESTS].sort())
  })

  it('⚠️ ورابطٌ أُلصق بلقاءٍ معتمَد يحدّث الدعوةَ فتحمله — مشتركا لا «لك وحدَك»', async () => {
    const startsAt = new Date(Date.now() + 140 * H)
    const s = await prisma.cohortSession.create({
      data: { cohortId, title: 'لقاءٌ برابطٍ يدويّ', startsAt, endsAt: new Date(startsAt.getTime() + 2 * H), wantsMeeting: false },
    })
    await cohorts.attachManualZoom(adminId, s.id, { joinUrl: 'https://zoom.us/j/555000111' })
    const updates = await invitesFor(s.id, 'session.invite.update')
    expect(updates.map((r) => r.to).sort()).toEqual([learner.a.email, learner.b.email, ...GUESTS].sort())
    const mine = updates.find((r) => r.to === learner.a.email)!
    expect(unfold(mine.icsContent)).toContain('LOCATION:https://zoom.us/j/555000111')
    expect(mine.text).not.toContain('لك وحدَك')
  })
})

describe('⑧ والعاملُ يُرسلها مرفقةً — ثمّ يمحوها', () => {
  it('⚠️ المرفقُ يصل المُرسِلَ بمنهجه، ويُمحى من الصفّ ساعةَ يخرج', async () => {
    const s = await approvedSession(150)
    const sent: { to: string; ics?: OutboxIcs }[] = []
    await drainOutbox(prisma, {
      limit: 500, gapMs: 0,
      send: async (to, _s, _t, _h, ics) => { sent.push({ to, ics }); return { status: 'sent' } },
    })
    const mine = sent.find((x) => x.to === learner.a.email && x.ics?.content.includes(`session-${s.id}@`))
    expect(mine?.ics?.method).toBe('REQUEST')
    expect(mine?.ics?.filename).toBe(`wajeez-session-${s.id}.ics`)
    const row = (await invitesFor(s.id)).find((r) => r.to === learner.a.email)!
    expect(row.status).toBe('sent')
    expect(row.icsContent, 'بقيت الدعوةُ برابطه في القاعدة بعد أن خرجت').toBeNull()
  })
})
