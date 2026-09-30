/* من التحق بعد أن اعتُمدت لقاءاتُ شعبته — ومن تركها (٢٩ سبتمبر ٢٠٢٦).

   قال صاحبُ المنصّة: «and also this invitiation goes to each student in the class
   or jon later directly». ووصفُ ما اختاره («Our email + calendar»): من التحق لاحقا
   تصله رسالةٌ واحدةٌ بكلّ ما بقي من لقاءاته.

   ودعوةُ الاعتماد نفسُها في `session-invites.test.ts`، وما تقوله الرسالةُ في
   `calendar/session-invite.test.ts`؛ وهنا على قاعدةٍ حقيقيّة:

   ① الملتحقُ بعد الاعتماد — بالشراء أو بيد الإدارة — تصله رسالةٌ واحدةٌ بما بقي،
      برابطه هو، وملفٌّ واحدٌ بمواعيدها ومعرّفاتها. ولا تُكتب لأحدٍ سواه.
   ② وما لا يُدعى إليه لا يدخل جدولَه: المنتظِرُ والمبدئيُّ والملغى وما مضى.
   ③ ومن التحق قبل أيّ اعتمادٍ لا تصله رسالةٌ فارغة — ولا المنتظِرُ في القائمة.
   ④ والمرقّى من قائمة الانتظار يُسجَّل في Zoom ويصله جدولُه برابطه.
   ⑤ ومن أُسقط تسجيلُه تُرفع لقاءاتُه المقبلة من تقويمه وحدَه، كلٌّ برسالته.
   ⑥ ومن انتقل إلى شعبةٍ أخرى: تُرفع لقاءاتُ المغادَرة، ويصله جدولُ الوجهة برابطه.

   ولا شبكةَ هنا: `fetch` مُلتقَط، وتسجيلاتُ Zoom تُعدّ. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { CohortService } from '../../services/cohort.service'
import { EnrollmentService } from '../../services/enrollment.service'
import { SESSION_GUESTS } from '../../services/session-invite.service'
import { sessionInviteUid } from '../../services/calendar/session-invite'
import { forgetZoomToken } from '../../services/zoom.service'
import { whenAr } from '../../../src/application/learning/cohort-gate'

let prisma: PrismaClient
let cohorts: CohortService
let enrollments: EnrollmentService
let adminId = ''
let courseId = ''
let profileId = ''
const STAMP = Date.now()
const H = 3_600_000

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
      const id = `8${STAMP % 1000}${meetingSeq}`
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
/** معرّفاتُ الأحداث في الملفّ **سطرا كاملا** — لا ورودُ حرفٍ في سطرٍ أطول */
const uids = (ics: string | null) => [...unfold(ics).matchAll(/^UID:(.*?)\r?$/gm)].map((m) => m[1])
const schedulesTo = (email: string) => prisma.outboxMail.findMany({
  where: { to: email, purpose: 'session.invite.schedule' }, orderBy: { createdAt: 'asc' },
})
const cancelsTo = (email: string) => prisma.outboxMail.findMany({
  where: { to: email, purpose: 'session.invite.cancel' }, orderBy: { createdAt: 'asc' },
})

let seq = 0
async function learner(key: string) {
  seq += 1
  const email = `join-${key}-${seq}-${STAMP}@wajeez.test`
  const u = await prisma.user.create({ data: { email, displayName: `ملتحق ${key}`, passwordHash: 'x' } })
  return { id: u.id, email }
}

/** شعبةٌ مفتوحةٌ للتسجيل بمدرّبها */
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

/** لقاءٌ يُعتمَد من طابور الإدارة — فيُنشأ اجتماعُه وتُسجَّل روابطُ من فيها */
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

  adminId = (await prisma.user.create({ data: { email: `join-admin-${STAMP}@wajeez.test`, displayName: 'المعتمِد', passwordHash: 'x' } })).id
  await prisma.userRole.create({ data: { userId: adminId, roleId: 'academic_manager' } })
  const tUser = await prisma.user.create({ data: { email: `join-trainer-${STAMP}@wajeez.test`, displayName: 'المدرّب', passwordHash: 'x' } })
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-JOIN-${STAMP}`, fullName: 'المدرّب', email: tUser.email, status: 'active' },
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

describe('① الملتحقُ بعد الاعتماد — رسالةٌ واحدةٌ بما بقي', () => {
  it('⚠️ بالشراء (`announce: false`) — جدولُه كلُّه برابطه، في ملفٍّ واحدٍ بمعرّفات اللقاءات', async () => {
    const c = await openCohort('شعبةُ الملتحقين')
    const s1 = await approved(c, 30)
    const s2 = await approved(c, 54)
    const who = await learner('buyer')
    const e = await enrollments.enroll(c, who.id, null, { announce: false })

    const mails = await schedulesTo(who.email)
    expect(mails, 'رسالةٌ لكلّ لقاء — أو لا رسالة').toHaveLength(1)
    const [mail] = mails
    expect(mail!.icsMethod).toBe('PUBLISH')
    expect(uids(mail!.icsContent)).toEqual([sessionInviteUid(s1.id), sessionInviteUid(s2.id)])
    expect(mail!.text).toContain(whenAr(s1.startsAt))
    expect(mail!.text).toContain(whenAr(s2.startsAt))

    const links = await prisma.sessionJoinLink.findMany({ where: { enrollmentId: e.id } })
    expect(links, 'التحق بلا رابطٍ خاصّ — فيُقرأ غائبا وهو حاضر').toHaveLength(2)
    for (const l of links) {
      expect(unfold(mail!.icsContent)).toContain(`LOCATION:${l.joinUrl}`)
      expect(mail!.html).toContain(l.joinUrl.replace(/&/g, '&amp;'))
    }
    expect(mail!.text).toContain('الروابطُ لك وحدَك')
  })

  it('⚠️ ولا تُكتب لأحدٍ سواه — لا لمن سبقه ولا للعنوانَين، ولا دعوةَ لقاءٍ تتكرّر', async () => {
    const c = await openCohort('شعبةُ السابقين')
    await approved(c, 30)
    const early = await learner('early-bird')
    await enrollments.enroll(c, early.id, null)
    const invites = () => prisma.outboxMail.findMany({
      where: { purpose: { startsWith: 'session.invite.' } }, select: { id: true, to: true, purpose: true, batchId: true },
    })
    const before = new Set((await invites()).map((r) => r.id))
    const late = await learner('late')
    const e = await enrollments.enroll(c, late.id, adminId)
    const added = (await invites()).filter((r) => !before.has(r.id))
    expect(added.map((r) => [r.to, r.purpose, r.batchId])).toEqual([[late.email, 'session.invite.schedule', e.id]])
  })
})

describe('② ما لا يُدعى إليه لا يدخل جدولَه', () => {
  it('⚠️ لا المنتظِرُ قرارَ الإدارة ولا المبدئيُّ ولا الملغى ولا ما مضى', async () => {
    const c = await openCohort('شعبةُ الاستثناء')
    const real = await approved(c, 40)
    const at = (h: number) => new Date(Date.now() + h * H)
    await prisma.cohortSession.create({ data: { cohortId: c, title: 'ينتظر الإدارة', startsAt: at(50), approvalState: 'pending' } })
    await prisma.cohortSession.create({ data: { cohortId: c, title: 'الجلسة ١ (مثال)', startsAt: at(60), placeholder: true } })
    await prisma.cohortSession.create({ data: { cohortId: c, title: 'أُلغي', startsAt: at(70), status: 'cancelled' } })
    await prisma.cohortSession.create({ data: { cohortId: c, title: 'مضى', startsAt: at(-5) } })
    const who = await learner('filter')
    await enrollments.enroll(c, who.id, null)
    const [mail] = await schedulesTo(who.email)
    expect(uids(mail!.icsContent)).toEqual([sessionInviteUid(real.id)])
  })
})

describe('③ لا رسالةَ فارغة', () => {
  it('⚠️ من التحق قبل أيّ اعتمادٍ لا يُكتب له شيء — ودعوةُ الاعتماد تصله بعدُ', async () => {
    const c = await openCohort('شعبةٌ بلا لقاءات')
    const who = await learner('first')
    await enrollments.enroll(c, who.id, null)
    expect(await schedulesTo(who.email)).toHaveLength(0)
    const s = await approved(c, 30)
    expect(await prisma.outboxMail.count({ where: { to: who.email, batchId: s.id, purpose: 'session.invite.new' } })).toBe(1)
  })

  it('والمنتظِرُ في القائمة لا جدولَ له — لم يستحقّ مقعدا بعد', async () => {
    const c = await openCohort('شعبةٌ ممتلئة', { capacity: 1 })
    await approved(c, 30)
    await enrollments.enroll(c, (await learner('seated')).id, null)
    const waiting = await learner('queued')
    const w = await enrollments.enroll(c, waiting.id, null)
    expect(w.status).toBe('waitlisted')
    expect(await schedulesTo(waiting.email)).toHaveLength(0)
  })
})

describe('④ المرقّى من قائمة الانتظار', () => {
  it('⚠️ يُسجَّل في Zoom ويصله جدولُه برابطه — كان يدخل بلا رابطٍ خاصّ', async () => {
    const c = await openCohort('شعبةُ الطابور', { capacity: 1 })
    const s = await approved(c, 30)
    const seat = await learner('leaving')
    const se = await enrollments.enroll(c, seat.id, null)
    const next = await learner('next')
    const ne = await enrollments.enroll(c, next.id, null)
    expect(ne.status).toBe('waitlisted')
    expect(registered).not.toContain(next.email)

    const dropped = await enrollments.drop(se.id, adminId)
    expect(dropped.promotedEnrollmentId).toBe(ne.id)
    const link = await prisma.sessionJoinLink.findUnique({
      where: { sessionId_enrollmentId: { sessionId: s.id, enrollmentId: ne.id } },
    })
    expect(link, 'رُقّي بلا رابطٍ خاصّ — فيُقرأ غائبا وهو حاضر').not.toBeNull()
    const [mail] = await schedulesTo(next.email)
    expect(uids(mail!.icsContent)).toEqual([sessionInviteUid(s.id)])
    expect(unfold(mail!.icsContent)).toContain(`LOCATION:${link!.joinUrl}`)
  })
})

describe('⑤ من أُسقط تسجيلُه', () => {
  it('⚠️ تُرفع لقاءاتُه المقبلة من تقويمه وحدَه — كلٌّ برسالته', async () => {
    const c = await openCohort('شعبةُ الإسقاط')
    const s1 = await approved(c, 30)
    const s2 = await approved(c, 54)
    const stay = await learner('stay')
    await enrollments.enroll(c, stay.id, null)
    const gone = await learner('gone')
    const ge = await enrollments.enroll(c, gone.id, null)
    await enrollments.drop(ge.id, adminId)

    const cancels = await cancelsTo(gone.email)
    expect(cancels.map((r) => uids(r.icsContent)[0]).sort()).toEqual([sessionInviteUid(s1.id), sessionInviteUid(s2.id)].sort())
    for (const r of cancels) {
      expect(r.icsMethod).toBe('CANCEL')
      expect(r.icsContent).toContain('STATUS:CANCELLED')
      expect(r.text).toContain('أُسقط تسجيلُك في «شعبةُ الإسقاط»')
    }
    expect(await cancelsTo(stay.email), 'رُفعت لقاءاتُ من بقي').toHaveLength(0)
    const guestCancels = await prisma.outboxMail.count({
      where: { to: { in: SESSION_GUESTS.map((g) => g.email) }, purpose: 'session.invite.cancel', batchId: { in: [s1.id, s2.id] } },
    })
    expect(guestCancels, 'رُفع اللقاءُ من تقويم الإدارة لأنّ متعلّما تركه').toBe(0)
  })

  it('ومن أُسقط وهو في قائمة الانتظار لم يُدعَ إلى شيء — فلا يُرفع له شيء', async () => {
    const c = await openCohort('شعبةُ الانتظار', { capacity: 1 })
    await approved(c, 30)
    await enrollments.enroll(c, (await learner('holder')).id, null)
    const waiting = await learner('gave-up')
    const w = await enrollments.enroll(c, waiting.id, null)
    await enrollments.drop(w.id, adminId)
    expect(await cancelsTo(waiting.email)).toHaveLength(0)
  })
})

describe('⑥ من انتقل إلى شعبةٍ أخرى', () => {
  it('⚠️ تُرفع لقاءاتُ المغادَرة، ويصله جدولُ الوجهة برابطه فيها', async () => {
    const from = await openCohort('شعبةُ الصباح')
    const to = await openCohort('شعبةُ المساء')
    const f1 = await approved(from, 30)
    const t1 = await approved(to, 34)
    const t2 = await approved(to, 58)
    const who = await learner('switch')
    const e = await enrollments.enroll(from, who.id, null)
    await enrollments.switchCohort(who.id, e.id, to)

    const cancels = await cancelsTo(who.email)
    expect(cancels.map((r) => uids(r.icsContent)[0])).toEqual([sessionInviteUid(f1.id)])
    expect(cancels[0]!.text).toContain('انتقل مقعدُك إلى «شعبةُ المساء»')

    const schedules = await schedulesTo(who.email)
    expect(schedules.map((m) => uids(m.icsContent))).toEqual([
      [sessionInviteUid(f1.id)],
      [sessionInviteUid(t1.id), sessionInviteUid(t2.id)],
    ])
    const link = await prisma.sessionJoinLink.findUnique({
      where: { sessionId_enrollmentId: { sessionId: t1.id, enrollmentId: e.id } },
    })
    expect(link, 'انتقل بلا رابطٍ خاصّ في شعبته الجديدة').not.toBeNull()
    expect(unfold(schedules[1]!.icsContent)).toContain(`LOCATION:${link!.joinUrl}`)
  })
})
