/* من ترك الشعبة يُلغى تسجيلُه عند Zoom — ويُعاد إن عاد (٣٠ سبتمبر ٢٠٢٦).

   لكلّ متعلّمٍ رابطٌ خاصٌّ في كلّ اجتماع (`SessionJoinLink`)، وهو في بريده وتقويمه
   منذ الدعوات. ومن أُسقط تسجيلُه أو انتقل إلى شعبةٍ أخرى كان رابطُه يبقى يُدخله:
   لا شيءَ يُلغي تسجيلَه عند Zoom. وهنا على قاعدةٍ حقيقيّة:

   ① من أُسقط تسجيلُه يُلغى تسجيلُه في كلّ اجتماعٍ مقبلٍ لشعبته — ولا يُمسّ غيرُه،
      ولا ما مضى، ولا من كان في قائمة الانتظار.
   ② ومن انتقل يُلغى تسجيلُه في المغادَرة ويبقى في الوجهة.
   ③ وما أبى فيه Zoom لا يُسقط التركَ ولا يُكتب ملغى — ودورةُ العامل تُلغيه، وتُلغي
      تسجيلَ من ترك قبل أن يوجد هذا. والاجتماعُ المحذوفُ عند Zoom تمّ.
   ④ ومن عاد إلى شعبته يُعاد تسجيلُه نفسُه برابطه — وإن أبى Zoom سُجّل من جديد.
   ⑤ والرابطُ الملغى لا تحمله دعوةٌ ولا جدول.

   ولا شبكةَ هنا: `fetch` مُلتقَط، وكلُّ نداءٍ لحالة مسجَّلٍ يُعدّ. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { CohortService } from '../../services/cohort.service'
import { EnrollmentService } from '../../services/enrollment.service'
import { SessionInviteService } from '../../services/session-invite.service'
import { forgetZoomToken } from '../../services/zoom.service'
import { runJob } from '../../worker/jobs'

let prisma: PrismaClient
let cohorts: CohortService
let enrollments: EnrollmentService
let adminId = ''
let courseId = ''
let profileId = ''
const STAMP = Date.now()
const H = 3_600_000

const SAVED = { ...process.env }
/** نداءاتُ حالة المسجَّل — أيُّ اجتماع، وأيُّ فعل، ولمن */
const statusCalls: { meetingId: string; action: string; ids: string[] }[] = []
/** وما يقوله Zoom عنها: معطَّل، أو اجتماعٌ حُذف من لوحته، أو إعادةٌ مرفوضة */
const zoom = { down: false, approveRefused: false, gone: new Set<string>() }
let meetingSeq = 0
let regSeq = 0

function stubZoom() {
  process.env.ZOOM_ACCOUNT_ID = 'acc'
  process.env.ZOOM_CLIENT_ID = 'cid'
  process.env.ZOOM_CLIENT_SECRET = 'sec'
  process.env.ZOOM_HOST_EMAIL = 'lessons@wajeez.test'
  globalThis.fetch = (async (url: string, init?: { method?: string; body?: string }) => {
    const u = String(url)
    const reply = (status: number, json: unknown = {}) => ({ ok: status < 300, status, json: async () => json })
    if (u.includes('/oauth/token')) return reply(200, { access_token: 't', expires_in: 3600 })
    if (init?.method === 'POST' && /\/users\/[^/]+\/meetings$/.test(u)) {
      meetingSeq += 1
      const id = `7${STAMP % 1000}${meetingSeq}`
      return reply(201, { id, join_url: `https://zoom.us/j/${id}`, start_url: `https://zoom.us/s/${id}`, password: 'p' })
    }
    const meetingId = u.includes('/meetings/') ? decodeURIComponent(u.split('/meetings/')[1]!.split('/')[0]!) : ''
    if (init?.method === 'PUT' && u.endsWith('/registrants/status')) {
      const body = JSON.parse(init.body ?? '{}') as { action: string; registrants: { id: string }[] }
      statusCalls.push({ meetingId, action: body.action, ids: body.registrants.map((r) => r.id) })
      if (zoom.down) return reply(500)
      if (zoom.gone.has(meetingId)) return reply(404, { code: 3001 })
      if (body.action === 'approve' && zoom.approveRefused) return reply(400)
      return reply(204)
    }
    if (init?.method === 'POST' && u.includes('/registrants')) {
      regSeq += 1
      const { email } = JSON.parse(init.body ?? '{}') as { email: string }
      return reply(201, { registrant_id: `r-${regSeq}`, join_url: `https://zoom.us/w/${meetingId}?tk=${encodeURIComponent(email)}&n=${regSeq}` })
    }
    if (init?.method === 'PATCH' || init?.method === 'DELETE') return reply(204)
    return reply(404)
  }) as unknown as typeof fetch
  forgetZoomToken()
}

const linksOf = (enrollmentId: string) => prisma.sessionJoinLink.findMany({
  where: { enrollmentId }, orderBy: { createdAt: 'asc' },
  select: { sessionId: true, registrantId: true, joinUrl: true, cancelledAt: true, meeting: { select: { meetingId: true } } },
})
/** ما جرى على Zoom منذ لحظةٍ بعينها — مرتّبا فلا يحكم فيه ترتيبُ الحلقة */
const callsSince = (n: number) => statusCalls.slice(n).map((c) => `${c.action}:${c.meetingId}:${c.ids.join(',')}`).sort()

let seq = 0
async function learner(key: string) {
  seq += 1
  const email = `rel-${key}-${seq}-${STAMP}@wajeez.test`
  const u = await prisma.user.create({ data: { email, displayName: `متعلّم ${key}`, passwordHash: 'x' } })
  return { id: u.id, email }
}

async function openCohort(title: string, over: Record<string, unknown> = {}) {
  const c = await prisma.cohort.create({
    data: {
      courseId, title, status: 'open', registrationOpen: true, capacity: 20, price: 100, currency: 'USD', timezone: 'Asia/Amman',
      scheduleWindowStart: new Date(Date.now() - 2 * 24 * H), scheduleWindowEnd: new Date(Date.now() + 60 * 24 * H), maxSessions: 60,
      ...over,
    },
  })
  await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead' } })
  return c.id
}

/** لقاءٌ يُعتمَد — فيُنشأ اجتماعُه عند Zoom ويُسجَّل من في الشعبة */
async function approved(cohortId: string, hours: number) {
  const startsAt = new Date(Date.now() + hours * H)
  const s = await prisma.cohortSession.create({
    data: {
      cohortId, title: `لقاءٌ بعد ${hours} ساعة`, startsAt, endsAt: new Date(startsAt.getTime() + 2 * H),
      approvalState: 'pending', wantsMeeting: true,
    },
  })
  await cohorts.decideSession(adminId, s.id, true)
  return s
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  cohorts = new CohortService(prisma)
  enrollments = new EnrollmentService(prisma)
  stubZoom()

  adminId = (await prisma.user.create({ data: { email: `rel-admin-${STAMP}@wajeez.test`, displayName: 'المعتمِد', passwordHash: 'x' } })).id
  await prisma.userRole.create({ data: { userId: adminId, roleId: 'academic_manager' } })
  const tUser = await prisma.user.create({ data: { email: `rel-trainer-${STAMP}@wajeez.test`, displayName: 'المدرّب', passwordHash: 'x' } })
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-REL-${STAMP}`, fullName: 'المدرّب', email: tUser.email, status: 'active' },
  })
  profileId = (await prisma.trainerProfile.create({ data: { userId: tUser.id, applicationId: application.id } })).id
  courseId = (await prisma.course.findFirstOrThrow({ select: { id: true } })).id
}, 240_000)

afterAll(() => {
  for (const k of ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET', 'ZOOM_HOST_EMAIL']) {
    if (SAVED[k] === undefined) delete process.env[k]
    else process.env[k] = SAVED[k]
  }
  forgetZoomToken()
})

describe('① من أُسقط تسجيلُه', () => {
  it('⚠️ يُلغى تسجيلُه في كلّ اجتماعٍ مقبلٍ لشعبته — ولا يُمسّ من بقي', async () => {
    const c = await openCohort('شعبةُ الإسقاط')
    await approved(c, 30)
    await approved(c, 54)
    const stay = await enrollments.enroll(c, (await learner('stay')).id, null)
    const gone = await enrollments.enroll(c, (await learner('gone')).id, null)
    const mine = await linksOf(gone.id)
    expect(mine, 'لا رابطَ له ليُلغى أصلا').toHaveLength(2)

    const n = statusCalls.length
    const out = await enrollments.drop(gone.id, adminId)
    expect(out.status).toBe('dropped')
    expect(callsSince(n)).toEqual(mine.map((l) => `cancel:${l.meeting.meetingId}:${l.registrantId}`).sort())
    for (const l of await linksOf(gone.id)) expect(l.cancelledAt, 'أُلغي عند Zoom ولم يُكتب').not.toBeNull()
    for (const l of await linksOf(stay.id)) expect(l.cancelledAt, 'أُلغي تسجيلُ من بقي').toBeNull()
  })

  it('⚠️ وما مضى لا يُمسّ — صفُّه يطابق حضورَه ببريده', async () => {
    const c = await openCohort('شعبةُ ما مضى')
    await approved(c, 30)
    const e = await enrollments.enroll(c, (await learner('past')).id, null)
    const past = await prisma.cohortSession.create({
      data: { cohortId: c, title: 'لقاءٌ مضى', startsAt: new Date(Date.now() - 5 * H), endsAt: new Date(Date.now() - 3 * H) },
    })
    await prisma.zoomMeeting.create({
      data: { sessionId: past.id, provider: 'zoom_api', meetingId: `past-${STAMP}`, joinUrl: 'https://zoom.us/j/past' },
    })
    await prisma.sessionJoinLink.create({
      data: { sessionId: past.id, enrollmentId: e.id, registrantId: 'r-past', joinUrl: 'https://zoom.us/w/past?tk=me' },
    })

    const n = statusCalls.length
    await enrollments.drop(e.id, adminId)
    expect(callsSince(n).some((c) => c.includes(`past-${STAMP}`)), 'أُلغي تسجيلُ لقاءٍ مضى').toBe(false)
    const kept = await prisma.sessionJoinLink.findUniqueOrThrow({
      where: { sessionId_enrollmentId: { sessionId: past.id, enrollmentId: e.id } },
    })
    expect(kept.cancelledAt).toBeNull()
  })

  it('ومن أُسقط وهو في قائمة الانتظار لم يُسجَّل في شيء — فلا نداءَ لـZoom', async () => {
    const c = await openCohort('شعبةٌ ممتلئة', { capacity: 1 })
    await approved(c, 30)
    await enrollments.enroll(c, (await learner('seat')).id, null)
    const waiting = await enrollments.enroll(c, (await learner('queue')).id, null)
    expect(waiting.status).toBe('waitlisted')
    const n = statusCalls.length
    await enrollments.drop(waiting.id, adminId)
    expect(callsSince(n)).toEqual([])
  })
})

describe('② من انتقل إلى شعبةٍ أخرى', () => {
  it('⚠️ يُلغى تسجيلُه في المغادَرة، ويُسجَّل في الوجهة ويبقى', async () => {
    const from = await openCohort('شعبةُ الصباح')
    const to = await openCohort('شعبةُ المساء')
    await approved(from, 30)
    const t1 = await approved(to, 34)
    const who = await learner('switch')
    const e = await enrollments.enroll(from, who.id, null)
    const old = await linksOf(e.id)
    expect(old).toHaveLength(1)

    const n = statusCalls.length
    await enrollments.switchCohort(who.id, e.id, to)
    expect(callsSince(n)).toEqual([`cancel:${old[0]!.meeting.meetingId}:${old[0]!.registrantId}`])
    const after = await linksOf(e.id)
    const oldRow = after.find((l) => l.sessionId === old[0]!.sessionId)
    const newRow = after.find((l) => l.sessionId === t1.id)
    expect(oldRow?.cancelledAt, 'بقي يدخل لقاءاتِ شعبته القديمة').not.toBeNull()
    expect(newRow?.cancelledAt, 'أُلغي تسجيلُه في شعبته الجديدة').toBeNull()
  })
})

describe('③ وما أبى فيه Zoom', () => {
  it('⚠️ لا يُسقط الإسقاطَ ولا يُكتب ملغى — ودورةُ العامل تُلغيه حين يقبل', async () => {
    const c = await openCohort('شعبةُ الإباء')
    await approved(c, 30)
    const e = await enrollments.enroll(c, (await learner('refused')).id, null)
    zoom.down = true
    try {
      const out = await enrollments.drop(e.id, adminId)
      expect(out.status, 'سقط الإسقاطُ لأنّ Zoom لم يقبل').toBe('dropped')
      for (const l of await linksOf(e.id)) expect(l.cancelledAt, 'كُتب ملغى ما لم يُلغَ').toBeNull()
    } finally { zoom.down = false }

    const r = await runJob(prisma, 'revoke_left_registrants')
    expect(r.done).toBeGreaterThanOrEqual(1)
    for (const l of await linksOf(e.id)) expect(l.cancelledAt).not.toBeNull()
  })

  it('⚠️ والاجتماعُ المحذوفُ من لوحة Zoom تمّ — لا تسجيلَ فيه يُدخل أحدا', async () => {
    const c = await openCohort('شعبةُ المحذوف')
    await approved(c, 30)
    const e = await enrollments.enroll(c, (await learner('gone-meeting')).id, null)
    const [link] = await linksOf(e.id)
    zoom.gone.add(link!.meeting.meetingId!)
    await enrollments.drop(e.id, adminId)
    expect((await linksOf(e.id))[0]!.cancelledAt).not.toBeNull()
  })

  it('⚠️ ومن ترك قبل أن يوجد الإلغاءُ تُلغيه الدورة — ولا تمسّ أحدا غيرَه', async () => {
    const c = await openCohort('شعبةُ ما قبل')
    await approved(c, 30)
    const stay = await enrollments.enroll(c, (await learner('still-here')).id, null)
    const e = await enrollments.enroll(c, (await learner('before')).id, null)
    /* إسقاطٌ كما كان يقع قبل اليوم: الحالةُ تتغيّر ولا شيءَ يُنادي Zoom */
    await prisma.enrollment.update({ where: { id: e.id }, data: { status: 'dropped' } })
    const [link] = await linksOf(e.id)
    expect(link!.cancelledAt).toBeNull()

    /* والدورةُ تمرّ على الروابط كلِّها لا على تسجيلٍ بعينه — فالحكمُ «من ترك» فيها
       وحدَها: لو أسقطته أُلغي تسجيلُ كلِّ جالسٍ في كلّ شعبة. فتُطابَق نداءاتُها كلُّها */
    const n = statusCalls.length
    await runJob(prisma, 'revoke_left_registrants')
    expect(callsSince(n), 'ألغت الدورةُ تسجيلَ من لم يترك').toEqual([`cancel:${link!.meeting.meetingId}:${link!.registrantId}`])
    expect((await linksOf(e.id))[0]!.cancelledAt).not.toBeNull()
    for (const l of await linksOf(stay.id)) expect(l.cancelledAt, 'أُلغي تسجيلُ جالسٍ في شعبته').toBeNull()
  })
})

describe('④ ومن عاد إلى شعبته', () => {
  it('⚠️ يُعاد تسجيلُه نفسُه — فرابطُه الذي في بريده يعمل، وجدولُه يحمله', async () => {
    const c = await openCohort('شعبةُ العائدين')
    await approved(c, 30)
    const who = await learner('back')
    const e = await enrollments.enroll(c, who.id, null)
    const [first] = await linksOf(e.id)
    await enrollments.drop(e.id, adminId)

    const n = statusCalls.length
    await enrollments.enroll(c, who.id, adminId)
    expect(callsSince(n)).toEqual([`approve:${first!.meeting.meetingId}:${first!.registrantId}`])
    const [again] = await linksOf(e.id)
    expect(again!.cancelledAt, 'عاد ورابطُه ملغًى').toBeNull()
    expect(again!.joinUrl).toBe(first!.joinUrl)
    const schedule = await prisma.outboxMail.findFirstOrThrow({
      where: { to: who.email, purpose: 'session.invite.schedule' }, orderBy: { createdAt: 'desc' },
    })
    expect((schedule.icsContent ?? '').replace(/\r\n /g, '')).toContain(`LOCATION:${first!.joinUrl}`)
  })

  it('وإن أبى Zoom الإعادةَ سُجّل من جديد — وحلّ الرابطُ الجديدُ محلَّ الملغى', async () => {
    const c = await openCohort('شعبةُ العودة المرفوضة')
    await approved(c, 30)
    const who = await learner('back-refused')
    const e = await enrollments.enroll(c, who.id, null)
    const [first] = await linksOf(e.id)
    await enrollments.drop(e.id, adminId)

    zoom.approveRefused = true
    try {
      await enrollments.enroll(c, who.id, adminId)
    } finally { zoom.approveRefused = false }
    const [again] = await linksOf(e.id)
    expect(again!.cancelledAt).toBeNull()
    expect(again!.registrantId, 'بقي على تسجيلٍ رفض Zoom إعادتَه').not.toBe(first!.registrantId)
    expect(again!.joinUrl).not.toBe(first!.joinUrl)
  })
})

describe('⑤ والرابطُ الملغى لا يُعطى أحدا', () => {
  it('⚠️ دعوةُ اللقاء وجدولُ الملتحق يحملان الرابطَ المشترك لا الملغى', async () => {
    const c = await openCohort('شعبةُ الرابط الملغى')
    const s = await approved(c, 30)
    const who = await learner('stale')
    const e = await enrollments.enroll(c, who.id, null)
    const [link] = await linksOf(e.id)
    /* حالٌ لا يبلغها المسارُ السليم: جالسٌ ورابطُه ملغًى (أبى Zoom إعادتَه وتسجيلَه معا) */
    await prisma.sessionJoinLink.update({
      where: { sessionId_enrollmentId: { sessionId: s.id, enrollmentId: e.id } }, data: { cancelledAt: new Date() },
    })
    const invites = new SessionInviteService(prisma)
    await invites.announce(s.id, 'update')
    await invites.welcome(e.id)
    const mails = await prisma.outboxMail.findMany({
      where: { to: who.email, purpose: { in: ['session.invite.update', 'session.invite.schedule'] } },
      orderBy: { createdAt: 'desc' }, take: 2,
    })
    expect(mails.map((m) => m.purpose).sort()).toEqual(['session.invite.schedule', 'session.invite.update'])
    const shared = (await prisma.zoomMeeting.findUniqueOrThrow({ where: { sessionId: s.id } })).joinUrl
    for (const m of mails) {
      const ics = (m.icsContent ?? '').replace(/\r\n /g, '')
      expect(ics, `${m.purpose} يحمل رابطا أُلغي عند Zoom`).not.toContain(link!.joinUrl)
      expect(ics).toContain(`LOCATION:${shared}`)
    }
  })
})
