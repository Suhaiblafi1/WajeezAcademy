/* ═══ مدرّبٌ يُحذف وفي شعبه طلاب — يُنذَر قبل الحذف، ثمّ تُرفع لقاءاتُها القادمة من كلّ تقويم (٢٨ أكتوبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة: «if we delete the trainer, then all the sessions should be deleted, but with a warning that
   there's a student in this class before you deleted the sessions»، واختار «Warn, remove for all». وهنا على قاعدةٍ
   حقيقيّة:

   ① الإنذارُ قبل الحذف (`purgeImpact`): كلُّ شعبةٍ له فيها طلاب — كم طالبا، وكم لقاءً قادما يُرفع، وأيبقى فيها
      مدرّبٌ غيرُه فتبقى لقاءاتُها. ولا يقرؤه إلّا من يملك الحذف.
   ② والحذفُ يرفع لقاءاتِها القادمة: رسالةُ رفعٍ لكلّ معتمَدٍ إلى الطلاب والمدرّب والعنوانين بسببها، ويُحذف اجتماعُه في
      Zoom وصفُّه — والمنتظِرُ يُحذف بلا رسالة، وما مضى والمبدئيُّ وما انعقد لا تُمسّ، والطلابُ يبقون مسجَّلين.
      وما يقوله الإنذارُ عددا هو ما يقع (`trainer-delete-sessions.ts`). وشعبةٌ بلا طلابٍ لا تُذكر فيه، وتُرفع لقاءاتُها.
   ③ وجرسٌ واحدٌ لطلابها — بلا بريدٍ ثانٍ لمن وصلته رسالةُ الرفع («One email»)، والمنتظِرُ في القائمة يبقى له بريدُه.
   ④ وشعبةٌ يبقى فيها مدرّبٌ غيرُه تبقى لقاءاتُها — ويُرفع منها من تقويمه هو وحدَه. */

import { afterAll, beforeAll, describe, expect as vexpect, it } from 'vitest'
import { plainExpect } from '../helpers/plain-expect'
const expect = plainExpect(vexpect)
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerApplicationService } from '../../services/trainer-application.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { SESSION_GUESTS, TRAINER_LEFT_AR } from '../../services/session-invite.service'
import { forgetZoomToken } from '../../services/zoom.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let auth: AuthService
let apps: TrainerApplicationService
let review: TrainerReviewService
let app: FastifyInstance
const STAMP = Date.now()
const H = 3_600_000
const DAY = 24 * H
const ACTOR = '00000000-0000-0000-0000-0000000000c7'
const GUESTS = SESSION_GUESTS.map((g) => g.email)
const cookies: Record<string, string> = {}

/* ولا شبكةَ: Zoom مُلتقَط، وما يُحذف من اجتماعاته يُعدّ */
const SAVED = { ...process.env }
const SAVED_FETCH = globalThis.fetch
const deleted: string[] = []

async function session(email: string, role: string) {
  const password = 'Session#12345'
  const u = await auth.register(email, password, role)
  await auth.setRoles(u.userId, [role])
  return `${SESSION_COOKIE}=${(await auth.login(email, password)).token}`
}

let n = 0
async function learner(cohortId: string, status: string) {
  n += 1
  const email = `pts-l${n}-${STAMP}@test.local`
  const u = await prisma.user.create({ data: { email, displayName: `متعلّم ${n}`, passwordHash: 'x' } })
  await prisma.enrollment.create({ data: { userId: u.id, cohortId, status } })
  return { userId: u.id, email }
}
const session_ = (cohortId: string, startsAt: Date, over: Record<string, unknown> = {}) => prisma.cohortSession.create({
  data: { cohortId, title: `لقاء ${startsAt.toISOString()}`, startsAt, endsAt: new Date(startsAt.getTime() + 2 * H), ...over },
})
const cancels = (sessionId: string) => prisma.outboxMail.findMany({ where: { batchId: sessionId, purpose: 'session.invite.cancel' } })
const bells = (userId: string, channel: 'in_app' | 'email') =>
  prisma.notification.findMany({ where: { userId, channel, templateKey: 'cohort.schedule_changed' } })

let trainer: { reference: string; profileId: string; userId: string; email: string }
let partner: { profileId: string }
let solo = ''
let shared = ''
let empty = ''
const s: Record<string, string> = {}
const people: Record<string, { userId: string; email: string }> = {}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  apps = new TrainerApplicationService(prisma)
  review = new TrainerReviewService(prisma)
  app = await buildApp(prisma)
  await app.ready()
  cookies.super = await session(`pts-super-${STAMP}@test.local`, 'super_admin')
  cookies.manager = await session(`pts-manager-${STAMP}@test.local`, 'academic_manager')

  process.env.ZOOM_ACCOUNT_ID = 'acc'
  process.env.ZOOM_CLIENT_ID = 'cid'
  process.env.ZOOM_CLIENT_SECRET = 'sec'
  process.env.ZOOM_HOST_EMAIL = 'lessons@wajeez.test'
  globalThis.fetch = (async (url: string, init?: { method?: string }) => {
    const u = String(url)
    if (u.includes('/oauth/token')) return { ok: true, status: 200, json: async () => ({ access_token: 't', expires_in: 3600 }) }
    if (init?.method === 'DELETE' && u.includes('/meetings/')) {
      deleted.push(decodeURIComponent(u.split('/meetings/')[1]!.split(/[/?]/)[0]!))
      return { ok: true, status: 204, json: async () => ({}) }
    }
    return { ok: false, status: 404, json: async () => ({}) }
  }) as unknown as typeof fetch
  forgetZoomToken()

  const email = `pts-trainer-${STAMP}@test.local`
  const made = await review.createTrainerDirectly(ACTOR, { fullName: 'مدرّب يحذف', email })
  trainer = { reference: made.reference, profileId: made.profileId, userId: made.userId, email }
  partner = { profileId: (await review.createTrainerDirectly(ACTOR, { fullName: 'مدرّب يبقى', email: `pts-partner-${STAMP}@test.local` })).profileId }

  const course = await prisma.course.findFirstOrThrow({ select: { id: true } })
  const cohort = (title: string) => prisma.cohort.create({
    data: { courseId: course.id, title, status: 'open', capacity: 20, price: 100, currency: 'USD', timezone: 'Asia/Amman' },
  })
  /* شعبةٌ يقودها وحدَه — فيها صاحبُ مقعدٍ ومنتظِرٌ في القائمة ومن ترك */
  solo = (await cohort('شعبة يقودها وحده')).id
  await prisma.cohortTrainer.create({ data: { cohortId: solo, profileId: trainer.profileId, role: 'lead' } })
  people.seated = await learner(solo, 'enrolled')
  people.waiting = await learner(solo, 'waitlisted')
  people.dropped = await learner(solo, 'dropped')
  s.approved = (await session_(solo, new Date(Date.now() + 5 * DAY), { approvalState: 'approved' })).id
  s.withZoom = (await session_(solo, new Date(Date.now() + 12 * DAY), { approvalState: 'approved' })).id
  await prisma.zoomMeeting.create({
    data: { sessionId: s.withZoom, provider: 'zoom_api', meetingId: `pts-${STAMP}`, joinUrl: 'https://zoom.us/j/1' },
  })
  s.pending = (await session_(solo, new Date(Date.now() + 19 * DAY), { approvalState: 'pending' })).id
  /* ومضى ولم يُكتب «انعقد» — فحالُه وحدَها لا تحرسه */
  s.past = (await session_(solo, new Date(Date.now() - 3 * DAY), { approvalState: 'approved' })).id
  s.placeholder = (await session_(solo, new Date(Date.now() + 26 * DAY), { approvalState: 'approved', placeholder: true })).id
  /* وبدأه مضيفُه قبل موعده — انعقد فهو واقعةٌ لا مسودّة */
  s.started = (await session_(solo, new Date(Date.now() + H), { approvalState: 'approved' })).id
  await prisma.zoomMeeting.create({
    data: { sessionId: s.started, provider: 'zoom_api', meetingId: `pts-started-${STAMP}`, joinUrl: 'https://zoom.us/j/2', actualStartAt: new Date(Date.now() - 5 * 60_000) },
  })

  /* وشعبةٌ يشاركه فيها مدرّبٌ يبقى */
  shared = (await cohort('شعبة يشاركه فيها غيره')).id
  await prisma.cohortTrainer.create({ data: { cohortId: shared, profileId: trainer.profileId, role: 'lead' } })
  await prisma.cohortTrainer.create({ data: { cohortId: shared, profileId: partner.profileId, role: 'assistant' } })
  people.sharedLearner = await learner(shared, 'enrolled')
  s.shared = (await session_(shared, new Date(Date.now() + 7 * DAY), { approvalState: 'approved' })).id

  /* وشعبةٌ يقودها بلا طلاب — لا يُنذَر بها، وتُرفع لقاءاتُها */
  empty = (await cohort('شعبة بلا طلاب')).id
  await prisma.cohortTrainer.create({ data: { cohortId: empty, profileId: trainer.profileId, role: 'lead' } })
  s.empty = (await session_(empty, new Date(Date.now() + 9 * DAY), { approvalState: 'approved' })).id
}, 240_000)

afterAll(() => {
  globalThis.fetch = SAVED_FETCH
  for (const k of ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET', 'ZOOM_HOST_EMAIL']) {
    if (SAVED[k] === undefined) delete process.env[k]
    else process.env[k] = SAVED[k]
  }
})

describe('① الإنذارُ قبل الحذف', () => {
  it('⚠️ كلُّ شعبةٍ فيها طلاب: كم طالبا، وكم لقاءً قادما يُرفع — وأيبقى فيها مدرّبٌ غيرُه', async () => {
    const impact = await apps.purgeImpact(trainer.reference)
    const byId = new Map(impact.cohorts.map((c) => [c.id, c]))
    /* صاحبُ المقعد والمنتظِر — لا من ترك. والقادمُ: المعتمَدان والمنتظِر — لا ما مضى ولا المبدئيّ */
    expect(byId.get(solo)).toMatchObject({ title: 'شعبة يقودها وحده', learners: 2, upcoming: 3, keepsSessions: false })
    expect(byId.get(shared)).toMatchObject({ learners: 1, upcoming: 1, keepsSessions: true })
    expect(byId.has(empty), 'أُنذر بشعبةٍ لا طالبَ فيها').toBe(false)
    expect(await prisma.cohortSession.count({ where: { id: { in: Object.values(s) } } }), 'قرأ الإنذارُ فكتب').toBe(8)
  })

  it('⚠️ ولا يقرؤه إلّا من يملك الحذف', async () => {
    const url = `/api/admin/trainer-applications/${encodeURIComponent(trainer.reference)}/purge-impact`
    const denied = await app.inject({ method: 'GET', url, headers: { cookie: cookies.manager } })
    expect(denied.statusCode).toBe(403)
    const ok = await app.inject({ method: 'GET', url, headers: { cookie: cookies.super } })
    expect(ok.statusCode, ok.body).toBe(200)
    expect((ok.json() as { cohorts: { id: string }[] }).cohorts.map((c) => c.id).sort()).toEqual([solo, shared].sort())
  })
})

describe('② والحذفُ يرفع لقاءاتِها القادمة من كلّ تقويم', () => {
  let res: Awaited<ReturnType<TrainerApplicationService['purge']>>

  it('⚠️ القادمُ يُحذف — وما مضى والمبدئيُّ يبقيان، والطلابُ مسجَّلون', async () => {
    res = await apps.purge(trainer.reference, ACTOR, 'حذف مدرب تجربة')
    /* وكما قال الإنذار: ثلاثةٌ من شعبته — وواحدٌ من شعبته التي بلا طلاب */
    expect(res).toMatchObject({ removedSessions: 4, clearedCohorts: 2 })
    const left = (await prisma.cohortSession.findMany({ where: { cohortId: solo }, select: { id: true } })).map((x) => x.id)
    expect(left.sort(), 'بقي لقاءٌ قادمٌ لشعبةٍ بلا مدرّب — أو حُذف ما مضى أو ما انعقد').toEqual([s.past, s.placeholder, s.started].sort())
    expect(await prisma.cohortSession.findUnique({ where: { id: s.empty } }), 'بقي لقاءُ شعبته التي بلا طلاب').toBeNull()
    expect((await cancels(s.empty!)).map((m) => m.to).sort()).toEqual([trainer.email, ...GUESTS].sort())
    expect(await prisma.enrollment.count({ where: { cohortId: solo, status: { not: 'dropped' } } }), 'أُسقط الطلاب').toBe(2)
    expect(deleted, 'بقي اجتماعُه في Zoom بلا لقاء').toEqual([`pts-${STAMP}`])
  })

  it('⚠️ ورسالةُ الرفع لكلّ معتمَد — للطلاب والمدرّب والعنوانين، لكلٍّ بلغته — والمنتظِرُ بلا رسالة', async () => {
    for (const id of [s.approved, s.withZoom]) {
      const out = await cancels(id!)
      expect(out.map((m) => m.to).sort(), 'لم تُرفع من تقويم أحدهم').toEqual([people.seated!.email, trainer.email, ...GUESTS].sort())
      expect(out.find((m) => m.to === people.seated!.email)!.text).toContain('رحل مدرّب الشعبة، فرفع هذا اللقاء. وتصلك مواعيدها الجديدة حين يسند إليها مدرّب.')
      expect(out.find((m) => m.to === trainer.email)!.text).toContain('لم تعد مدرّب هذه الشعبة، فرفع هذا اللقاء من تقويمك.')
    }
    expect(await cancels(s.pending!), 'رُفع من التقاويم ما لم يُدعَ إليه أحد').toHaveLength(0)
    const ev = await prisma.auditEvent.findMany({ where: { action: 'cohort.session.delete', entityId: { in: [s.approved!, s.withZoom!, s.pending!] } } })
    expect(ev).toHaveLength(3)
    expect(ev.every((e) => (e.meta as { trainerDeleted?: string }).trainerDeleted === trainer.profileId)).toBe(true)
  })

  it('⚠️ وجرسٌ واحدٌ لطلابها — بلا بريدٍ ثانٍ لصاحب المقعد، والمنتظِرُ يبقى له بريدُه', async () => {
    const [bell] = await bells(people.seated!.userId, 'in_app')
    expect(bell?.title).toBe('رفعت لقاءات «شعبة يقودها وحده» القادمة')
    expect(await bells(people.seated!.userId, 'in_app')).toHaveLength(1)
    expect(await bells(people.seated!.userId, 'email'), 'وصله الخبرُ مرّتين').toHaveLength(0)
    expect(await bells(people.waiting!.userId, 'email'), 'سكت عن المنتظِر بريدُه الوحيد').toHaveLength(1)
    expect(await bells(people.dropped!.userId, 'in_app'), 'بلغ من ترك').toHaveLength(0)
  })

  it('⚠️ وشعبةٌ يبقى فيها مدرّبٌ غيرُه تبقى لقاءاتُها — ويُرفع منها من تقويمه هو وحدَه', async () => {
    expect(await prisma.cohortSession.findUnique({ where: { id: s.shared } }), 'حُذف لقاءُ شعبةٍ فيها مدرّب').not.toBeNull()
    const out = await cancels(s.shared!)
    expect(out.map((m) => m.to), 'رُفع من تقويم غيره').toEqual([trainer.email])
    expect(out[0]!.text).toContain(TRAINER_LEFT_AR)
    expect(await bells(people.sharedLearner!.userId, 'in_app')).toHaveLength(0)
  })
})
