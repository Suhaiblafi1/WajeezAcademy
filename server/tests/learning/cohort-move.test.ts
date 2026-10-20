/* نقلُ الشعبة إلى فصلٍ آخر — المدرّبُ يطلب والإدارةُ تعتمد (١٧ أكتوبر ٢٠٢٦).

   وما يُحرس هنا:
   ١) الطلبُ لا يحرّك موعدا — ولا يُطلب لشعبةٍ ليست له، ولا طلبان معلَّقان معا.
   ٢) الاعتمادُ يزيح الشعبةَ ولقاءاتِها القائمة بأسابيعَ كاملة، ويربطها بفصلها، ويبلّغ المتعلّمين.
   ٣) الردُّ يُبقي كلَّ شيء، ويصل المدرّبَ. والسحبُ من صاحبه وحدَه. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CohortMoveService } from '../../services/cohort-move.service'
import { EnrollmentService } from '../../services/enrollment.service'
import { moveReminderAt, nextTerm } from '../../../src/application/trainer/cohort-move'
import { termBounds, termOf } from '../../../src/application/terms/season'
import type { TrainingSeason } from '../../../src/application/trainer/application-options'
import { forgetZoomToken } from '../../services/zoom.service'
import { periodBounds } from '../../../src/application/trainer/cohort-period'
import { daysBetween, shiftDay } from '../../../src/application/trainer/plan-copy'

/* ولا شبكةَ: `fetch` مُلتقَط، وطلباتُ نقل الاجتماع إلى Zoom تُعدّ */
const SAVED_ENV = { ...process.env }
const SAVED_FETCH = globalThis.fetch
const patches: { meetingId: string; body: { start_time?: string; duration?: number } }[] = []
function stubZoom() {
  process.env.ZOOM_ACCOUNT_ID = 'acc'
  process.env.ZOOM_CLIENT_ID = 'cid'
  process.env.ZOOM_CLIENT_SECRET = 'sec'
  process.env.ZOOM_HOST_EMAIL = 'lessons@wajeez.test'
  globalThis.fetch = (async (url: string, init?: { method?: string; body?: string }) => {
    if (String(url).includes('/oauth/token')) return { ok: true, status: 200, json: async () => ({ access_token: 't', expires_in: 3600 }) }
    if (init?.method === 'PATCH') {
      patches.push({ meetingId: decodeURIComponent(String(url).split('/meetings/')[1] ?? ''), body: JSON.parse(init.body ?? '{}') })
      return { ok: true, status: 204, json: async () => ({}) }
    }
    return { ok: false, status: 404, json: async () => ({}) }
  }) as unknown as typeof fetch
  forgetZoomToken()
}
afterAll(() => {
  globalThis.fetch = SAVED_FETCH
  for (const k of ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET', 'ZOOM_HOST_EMAIL']) {
    if (SAVED_ENV[k] === undefined) delete process.env[k]
    else process.env[k] = SAVED_ENV[k]
  }
})

const DAY = 86_400_000
let prisma: PrismaClient
let svc: CohortMoveService
let trainerId = ''
let otherTrainerId = ''
let adminId = ''
let learnerId = ''

/* شعبةٌ تبدأ في الفصل القادم بلقاءين — والهدفُ الفصلُ الذي بعده */
const upcoming = nextTerm(termOf(new Date()))
const target = nextTerm(upcoming)

async function mkCohort(title: string, profileId: string, opts: { termOf?: { year: number; season: TrainingSeason } } = {}) {
  /* أوّلُ لقاءٍ داخلَ الفصل القادم أيّا كان يومُ الجولة — ففصلُ الشعبة يُقرأ من أوّل لقائها */
  const first = new Date(termBounds(upcoming.year, upcoming.season).startsOn.getTime() + 10 * DAY)
  first.setUTCHours(16, 0, 0, 0)
  const named = opts.termOf ?? upcoming
  const term = await prisma.term.upsert({
    where: { year_season: { year: named.year, season: named.season } },
    update: {},
    create: { year: named.year, season: named.season, titleAr: 'الفصل القادم', startsOn: new Date(), endsOn: new Date(Date.now() + 90 * DAY) },
  })
  const c = await prisma.cohort.create({
    data: {
      courseId: 'C-BIZ-101', title, status: 'open', capacity: 10, termId: term.id,
      startsAt: first, endsAt: new Date(first.getTime() + 7 * DAY), joinClosesAt: new Date(first.getTime() - DAY),
    },
  })
  await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead' } })
  await prisma.cohortSession.create({ data: { cohortId: c.id, title: 'اللقاء الأول', startsAt: first, endsAt: new Date(first.getTime() + 2 * 3_600_000) } })
  await prisma.cohortSession.create({ data: { cohortId: c.id, title: 'اللقاء الثاني', startsAt: new Date(first.getTime() + 7 * DAY) } })
  return c.id
}

let profileId = ''

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  svc = new CohortMoveService(prisma)

  trainerId = (await auth.register('move-trainer@test.local', 'Trainer#12345', 'مدرّب النقل')).userId
  await auth.setRoles(trainerId, ['trainer'])
  otherTrainerId = (await auth.register('move-other@test.local', 'Trainer#12345', 'مدرّب آخر')).userId
  await auth.setRoles(otherTrainerId, ['trainer'])
  adminId = (await auth.register('move-admin@test.local', 'Admin#12345', 'مدير الشعب')).userId
  await auth.setRoles(adminId, ['academic_manager'])
  learnerId = (await auth.register('move-learner@test.local', 'Learner#12345', 'متعلّم النقل')).userId

  const app = await prisma.trainerApplication.create({
    data: { reference: `TR-MOVE-${Date.now()}`, fullName: 'مدرّب النقل', email: 'move-trainer@test.local', status: 'active', motivation: 'اختبار', privacyConsentAt: new Date() },
  })
  profileId = (await prisma.trainerProfile.create({ data: { applicationId: app.id, userId: trainerId, isVerified: true } })).id
})

describe('① الطلب', () => {
  it('لا يحرّك موعدا — ويُحفظ فصلُها وأوّلُ لقاء', async () => {
    const cohortId = await mkCohort('شعبة الطلب', profileId)
    const before = await prisma.cohortSession.findMany({ where: { cohortId }, orderBy: { startsAt: 'asc' } })
    const r = await svc.request(trainerId, cohortId, { toYear: target.year, toSeason: target.season, reason: 'الطلب قليل هذا الفصل' })
    expect(r.status).toBe('pending')
    expect(r.fromSeason).toBe(upcoming.season)
    expect(r.fromStartsAt?.toISOString()).toBe(before[0]!.startsAt.toISOString())
    const after = await prisma.cohortSession.findMany({ where: { cohortId }, orderBy: { startsAt: 'asc' } })
    expect(after.map((s) => s.startsAt.toISOString())).toEqual(before.map((s) => s.startsAt.toISOString()))

    await expect(svc.request(trainerId, cohortId, { toYear: target.year, toSeason: target.season, reason: 'طلب ثان للشعبة نفسها' }))
      .rejects.toMatchObject({ status: 409 })
  })

  it('لا يُطلب لشعبةٍ ليست له — والحارسُ في الطريق نفسِه', async () => {
    const cohortId = await mkCohort('شعبة غيره', profileId)
    await expect(new EnrollmentService(prisma).assertCohortTrainer(otherTrainerId, cohortId)).rejects.toBeTruthy()
  })

  it('ولا إلى فصلها، ولا بلا سبب', async () => {
    const cohortId = await mkCohort('شعبة الرفض', profileId)
    await expect(svc.request(trainerId, cohortId, { toYear: upcoming.year, toSeason: upcoming.season, reason: 'إلى الفصل نفسه' }))
      .rejects.toThrow(/غير فصلها/)
    await expect(svc.request(trainerId, cohortId, { toYear: target.year, toSeason: target.season, reason: 'قصير' }))
      .rejects.toThrow(/السبب/)
  })
})

describe('② الاعتماد', () => {
  it('يزيح الشعبةَ ولقاءاتِها بأسابيعَ كاملة، ويربطها بفصلها، ويبلّغ المتعلّم', async () => {
    const cohortId = await mkCohort('شعبة الاعتماد', profileId)
    await prisma.enrollment.create({ data: { userId: learnerId, cohortId, status: 'enrolled' } })
    const newTerm = await prisma.term.upsert({
      where: { year_season: { year: target.year, season: target.season } }, update: {},
      create: { year: target.year, season: target.season, titleAr: 'الفصل الذي بعده', startsOn: new Date(), endsOn: new Date() },
    })
    const before = await prisma.cohortSession.findMany({ where: { cohortId }, orderBy: { startsAt: 'asc' } })
    const cBefore = await prisma.cohort.findUniqueOrThrow({ where: { id: cohortId } })
    const r = await svc.request(trainerId, cohortId, { toYear: target.year, toSeason: target.season, reason: 'الطلب قليل هذا الفصل' })

    const pending = await svc.pending()
    expect(pending.find((p) => p.id === r.id)?.learners).toBe(1)

    await svc.review(adminId, r.id, { action: 'approve' })
    const after = await prisma.cohortSession.findMany({ where: { cohortId }, orderBy: { startsAt: 'asc' } })
    const shift = after[0]!.startsAt.getTime() - before[0]!.startsAt.getTime()
    expect(shift).toBeGreaterThan(0)
    expect(shift % (7 * DAY), 'الإزاحة ليست أسابيع كاملة').toBe(0)
    after.forEach((s, i) => expect(s.startsAt.getTime() - before[i]!.startsAt.getTime()).toBe(shift))
    expect(after[0]!.endsAt!.getTime() - after[0]!.startsAt.getTime()).toBe(2 * 3_600_000)
    expect(termOf(after[0]!.startsAt)).toEqual(target)

    const c = await prisma.cohort.findUniqueOrThrow({ where: { id: cohortId } })
    expect(c.termId).toBe(newTerm.id)
    expect(c.startsAt!.getTime() - cBefore.startsAt!.getTime()).toBe(shift)
    expect(c.joinClosesAt!.getTime() - cBefore.joinClosesAt!.getTime()).toBe(shift)

    const bell = await prisma.notification.findFirst({ where: { userId: learnerId, channel: 'in_app' }, orderBy: { queuedAt: 'desc' } })
    expect(bell?.title).toContain('شعبة الاعتماد')
    expect(await prisma.cohortMoveRequest.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({ status: 'approved', reviewedBy: adminId })
    /* وقائمةُ الإدارة تسمّي نقلَها وأوّلَ لقاءٍ فيها الآن */
    const { CohortService } = await import('../../services/cohort.service')
    const row = (await new CohortService(prisma).list()).find((x) => x.id === cohortId)
    expect(row?.moved).toMatchObject({ toYear: target.year, toSeason: target.season })
    expect(row?.moved?.firstAt?.toISOString()).toBe(after[0]!.startsAt.toISOString())
    await expect(svc.review(adminId, r.id, { action: 'approve' })).rejects.toMatchObject({ status: 409 })
  })
})

/* ═══ وفصلُها من أوّل لقائها لا من صفّ فصلها (١٩ أكتوبر ٢٠٢٦) ═══
   صفُّ الفصل قد يفترق عن المواعيد — التأجيلُ يكتبه قبل أن تتحرّك. وكان النقلُ يقيس منه: فيُردّ طلبٌ إلى فصلٍ
   غيرِ فصلها الحقيقيّ «إلى فصلها نفسِه»، وتُزاح المواعيدُ بمسافةٍ بين فصلين لا بين موعدها والفصل المختار. */
describe('②أ فصل الشعبة من أول لقائها', () => {
  it('⚠️ صف فصلها يقول الفصل الذي بعده ولقاءاتها في القادم — تنقل إليه، وتقع فيه', async () => {
    const cohortId = await mkCohort('شعبة صفها يفترق', profileId, { termOf: target })
    const r = await svc.request(trainerId, cohortId, { toYear: target.year, toSeason: target.season, reason: 'الطلب قليل هذا الفصل' })
    expect(r.fromSeason, 'قيس فصلها من صفه لا من لقاءاتها').toBe(upcoming.season)
    await svc.review(adminId, r.id, { action: 'approve' })
    const first = await prisma.cohortSession.findFirstOrThrow({ where: { cohortId }, orderBy: { startsAt: 'asc' } })
    expect(termOf(first.startsAt), 'وقعت المواعيد في غير الفصل المختار').toEqual(target)
  })
})

/* ═══ وشعبةُ الإعداد — لا موعدَ عليها، ومدّتُها المقترحةُ في خطّتها (٢٠ أكتوبر ٢٠٢٦) ═══
   «أين خيار التأجيل للفصول القادمة؟» (صاحب المنصّة) — وكانت بطاقتُها بلا صندوق، والاعتمادُ يُردّ «لا موعد للشعبة
   يقاس منه النقل». فصار فصلُها من بدئها المقترح، وتنتقل خطّتُها ونافذةُ جدولتها معها.
   ورُئي ساقطا: أُسقطت إزاحةُ الخطّة فسقط الأوّل، وأُعيد الردُّ بلا موعدٍ فسقط الثاني. */
describe('②د شعبة الإعداد', () => {
  async function prep(title: string) {
    const c = await prisma.cohort.create({ data: { courseId: 'C-BIZ-101', title, status: 'draft', capacity: 20 } })
    await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead' } })
    return c.id
  }

  it('⚠️ فصلها من بدئها المقترح — وخطتها ونافذتها تنتقل معها بأسابيع كاملة', async () => {
    const startsOn = new Date(termBounds(upcoming.year, upcoming.season).startsOn.getTime() + 10 * DAY).toISOString().slice(0, 10)
    const endsOn = shiftDay(startsOn, 27)
    const opensAt = new Date(`${shiftDay(startsOn, 7)}T09:00:00.000Z`).toISOString()
    const cohortId = await prep('شعبة الإعداد المنقولة')
    const window = periodBounds({ startsOn, endsOn })
    await prisma.cohort.update({ where: { id: cohortId }, data: { scheduleWindowStart: window.from, scheduleWindowEnd: window.to } })
    const plan = await prisma.cohortDeliveryPlan.create({
      data: {
        cohortId, trainerId: profileId, status: 'draft',
        content: {
          kind: 'trainer', modules: [], startsOn, endsOn,
          slots: [{ startsOn, endsOn: shiftDay(startsOn, 6), moduleIds: ['m-1'] }],
          resources: [{ title: 'قراءة', opensAt }, { title: 'بلا موعد' }],
        },
      },
    })

    const r = await svc.request(trainerId, cohortId, { toYear: target.year, toSeason: target.season, reason: 'أؤجلها للفصل الذي بعده' })
    expect(r.fromSeason, 'فصلها لم يقرأ من بدئها المقترح').toBe(upcoming.season)
    expect(r.fromStartsAt?.toISOString()).toBe(window.from.toISOString())
    await svc.review(adminId, r.id, { action: 'approve' })

    const content = (await prisma.cohortDeliveryPlan.findUniqueOrThrow({ where: { id: plan.id } })).content as {
      startsOn: string; endsOn: string; slots: { startsOn: string; endsOn: string }[]; resources: { opensAt?: string }[]
    }
    const days = daysBetween(startsOn, content.startsOn)!
    expect(days, 'الخطة لم تنتقل').toBeGreaterThan(0)
    expect(days % 7, 'الإزاحة ليست أسابيع كاملة').toBe(0)
    expect(termOf(new Date(`${content.startsOn}T12:00:00Z`)), 'وقعت في غير الفصل المختار').toEqual(target)
    expect(content.endsOn).toBe(shiftDay(endsOn, days))
    expect(content.slots[0]).toMatchObject({ startsOn: shiftDay(startsOn, days), endsOn: shiftDay(startsOn, 6 + days) })
    expect(new Date(content.resources[0]!.opensAt!).getTime() - new Date(opensAt).getTime()).toBe(days * DAY)
    expect(content.resources[1]!.opensAt).toBeUndefined()

    const c = await prisma.cohort.findUniqueOrThrow({ where: { id: cohortId }, include: { term: true } })
    expect(c.term).toMatchObject({ year: target.year, season: target.season })
    expect(c.startsAt, 'كتب للإعداد بدءا لم يعتمد').toBeNull()
    expect(c.scheduleWindowStart!.getTime() - window.from.getTime()).toBe(days * DAY)
    expect(c.scheduleWindowEnd!.getTime() - window.to.getTime()).toBe(days * DAY)
  })

  it('⚠️ وبلا مدة ولا موعد ولا فصل — تربط بفصلها الجديد وحده، لا ترد', async () => {
    const cohortId = await prep('شعبة إعداد بلا مدة')
    const r = await svc.request(trainerId, cohortId, { toYear: target.year, toSeason: target.season, reason: 'أؤجلها للفصل الذي بعده' })
    expect(r.fromSeason).toBeNull()
    await svc.review(adminId, r.id, { action: 'approve' })
    const c = await prisma.cohort.findUniqueOrThrow({ where: { id: cohortId }, include: { term: true } })
    expect(c.term).toMatchObject({ year: target.year, season: target.season })
    expect(c.startsAt).toBeNull()
  })
})

/* ═══ وكلُّ موعدٍ فيها ينتقل معها — خطّتُها المعتمدةُ ومهامُّها (٢٠ أكتوبر ٢٠٢٦) ═══
   كانت المعتمدةُ لا تُمسّ ومهامُّها على مواعيدها القديمة: فشعبةٌ نُقلت تفتح موادَّها ويحلّ آخرُ موعدٍ
   لمهامّها قبل أوّل لقاءٍ فيها بفصل. فسأل صاحبُ المنصّة أن تنتقل كلُّها.
   ورُئي ساقطا: أُبقيت المعتمدةُ على حالها فسقط الأوّل، وأُسقطت إزاحةُ المهامّ فسقط الثاني. */
describe('②هـ خطتها المعتمدة ومهامها تنتقل معها', () => {
  async function moved(title: string) {
    const cohortId = await mkCohort(title, profileId)
    const before = await prisma.cohortSession.findFirstOrThrow({ where: { cohortId }, orderBy: { startsAt: 'asc' } })
    return {
      cohortId,
      approve: async () => {
        const r = await svc.request(trainerId, cohortId, { toYear: target.year, toSeason: target.season, reason: 'الطلب قليل هذا الفصل' })
        await svc.review(adminId, r.id, { action: 'approve' })
        const after = await prisma.cohortSession.findFirstOrThrow({ where: { cohortId }, orderBy: { startsAt: 'asc' } })
        const shift = after.startsAt.getTime() - before.startsAt.getTime()
        expect(shift).toBeGreaterThan(0)
        return { shift, days: Math.round(shift / DAY) }
      },
    }
  }

  it('⚠️ الخطة المعتمدة وما رُدّ ومهلة تأجيلها — والمنسوخة سجلٌّ لا يمسّ', async () => {
    const m = await moved('شعبة خطتها معتمدة')
    const content = (startsOn: string) => ({
      kind: 'trainer', modules: [], startsOn, endsOn: shiftDay(startsOn, 27),
      slots: [{ startsOn, endsOn: shiftDay(startsOn, 6), moduleIds: ['m-1'] }],
      resources: [{ title: 'تسجيل', opensAt: `${shiftDay(startsOn, 3)}T15:00:00.000Z` }],
    })
    const startsOn = '2099-01-04'
    const approved = await prisma.cohortDeliveryPlan.create({
      data: { cohortId: m.cohortId, trainerId: profileId, status: 'approved', content: content(startsOn) },
    })
    const old = await prisma.cohortDeliveryPlan.create({
      data: { cohortId: m.cohortId, trainerId: profileId, status: 'superseded', content: content(startsOn) },
    })
    const returned = await prisma.cohortDeliveryPlan.create({
      data: {
        cohortId: m.cohortId, trainerId: profileId, status: 'changes_requested', content: content(startsOn),
        returnedContent: content(startsOn), postponedTo: new Date('2099-02-01T00:00:00.000Z'),
      },
    })
    const { days } = await m.approve()

    const read = async (id: string) => prisma.cohortDeliveryPlan.findUniqueOrThrow({ where: { id } })
    type C = { startsOn: string; endsOn: string; slots: { startsOn: string }[]; resources: { opensAt: string }[] }
    const a = (await read(approved.id)).content as C
    expect(a.startsOn, 'الخطة المعتمدة بقيت في الفصل القديم').toBe(shiftDay(startsOn, days))
    expect(a.endsOn).toBe(shiftDay(startsOn, 27 + days))
    expect(a.slots[0]!.startsOn).toBe(shiftDay(startsOn, days))
    expect(new Date(a.resources[0]!.opensAt).getTime() - new Date(`${shiftDay(startsOn, 3)}T15:00:00.000Z`).getTime()).toBe(days * DAY)

    const back = await read(returned.id)
    expect((back.content as C).startsOn).toBe(shiftDay(startsOn, days))
    expect((back.returnedContent as C).startsOn, 'ما رُدّ يقابَل به بقي قديما — فيقرأ تعديلا لم يقع').toBe(shiftDay(startsOn, days))
    expect(back.postponedTo!.toISOString().slice(0, 10)).toBe(shiftDay('2099-02-01', days))

    expect(((await read(old.id)).content as C).startsOn, 'مُسّ سجلّ المنسوخة').toBe(startsOn)
  })

  it('⚠️ آخر موعد كل مهمة — وما يطلبه المدرّب عليها ولم يعتمد', async () => {
    const m = await moved('شعبة مهامها تنتقل')
    const due = new Date(Date.now() + 40 * DAY)
    const asked = new Date(Date.now() + 47 * DAY).toISOString()
    const task = await prisma.cohortAssessment.create({
      data: {
        cohortId: m.cohortId, title: 'مهمة المحور الأول', dueAt: due,
        pendingChange: { kind: 'edit', fields: { dueAt: asked, title: 'عنوان أوضح' }, requestedAt: new Date().toISOString() },
      },
    })
    const open = await prisma.cohortAssessment.create({ data: { cohortId: m.cohortId, title: 'مهمة بلا موعد' } })
    const { shift } = await m.approve()

    const t = await prisma.cohortAssessment.findUniqueOrThrow({ where: { id: task.id } })
    expect(t.dueAt!.getTime() - due.getTime(), 'آخر موعد المهمة بقي في الفصل القديم').toBe(shift)
    const change = t.pendingChange as { fields: { dueAt: string; title: string } }
    expect(new Date(change.fields.dueAt).getTime() - new Date(asked).getTime()).toBe(shift)
    expect(change.fields.title).toBe('عنوان أوضح')
    expect((await prisma.cohortAssessment.findUniqueOrThrow({ where: { id: open.id } })).dueAt).toBeNull()
  })
})

/* ═══ وبطاقاتُ «قبل/بعد» التي لم يُحسم أمرُها تنتقل معها (٢٠ أكتوبر ٢٠٢٦) ═══
   بطاقةٌ تنقل لقاءً إلى موعدٍ في الفصل القديم، لو قُبلت بعد النقل أعادته إليه. ولقطتُها لو بقيت لقرأت
   «تغيّر موضعُها بعدك». ورُئي ساقطا: أُسقطت إزاحةُ البطاقات فسقط الأوّل، وأُزيحت المحسومةُ معها فسقط الثاني. */
describe('②و بطاقات التعديل المنتظرة', () => {
  it('⚠️ موعدها ولقطتها ينتقلان — فتبقى قائمةً لا «تغيّر موضعها»، والمحسومة لا تمسّ', async () => {
    const { PlanEditService } = await import('../../services/plan-edit.service')
    const { sessionSnapshot } = await import('../../../src/application/trainer/plan-edits')
    const cohortId = await mkCohort('شعبة بطاقاتها تنتقل', profileId)
    const plan = await prisma.cohortDeliveryPlan.create({
      data: { cohortId, trainerId: profileId, status: 'approved', content: { kind: 'trainer', modules: [], resources: [] } },
    })
    const session = await prisma.cohortSession.findFirstOrThrow({ where: { cohortId }, orderBy: { startsAt: 'asc' } })
    const to = new Date(session.startsAt.getTime() + 3 * DAY)
    const edit = { kind: 'session_move', sessionId: session.id, startsAt: to.toISOString(), endsAt: new Date(to.getTime() + 2 * 3_600_000).toISOString() }
    const card = (status: string, seq: number) => prisma.planEditSuggestion.create({
      data: {
        cohortId, planId: plan.id, batchId: plan.id, seq, kind: 'session_move', step: 'sessions', reasonAr: 'موعد أنسب',
        edit, before: sessionSnapshot(session) as object, status, createdBy: adminId,
      },
    })
    const waiting = await card('pending', 1)
    const decided = await card('rejected', 2)
    const edits = new PlanEditService(prisma)
    expect((await edits.forCohort(cohortId)).find((x) => x.id === waiting.id)?.stale).toBe(false)

    const r = await svc.request(trainerId, cohortId, { toYear: target.year, toSeason: target.season, reason: 'الطلب قليل هذا الفصل' })
    await svc.review(adminId, r.id, { action: 'approve' })
    const after = await prisma.cohortSession.findUniqueOrThrow({ where: { id: session.id } })
    const shift = after.startsAt.getTime() - session.startsAt.getTime()
    expect(shift).toBeGreaterThan(0)

    const moved = await prisma.planEditSuggestion.findUniqueOrThrow({ where: { id: waiting.id } })
    const e = moved.edit as { startsAt: string; endsAt: string }
    expect(new Date(e.startsAt).getTime() - to.getTime(), 'البطاقة تعيد اللقاء إلى الفصل القديم').toBe(shift)
    expect(termOf(new Date(e.startsAt))).toEqual(target)
    expect((moved.before as { startsAt: string }).startsAt).toBe(after.startsAt.toISOString())
    expect((await edits.forCohort(cohortId)).find((x) => x.id === waiting.id)?.stale, 'البطاقة تقرأ «تغيّر موضعها»').toBe(false)

    const kept = await prisma.planEditSuggestion.findUniqueOrThrow({ where: { id: decided.id } })
    expect((kept.edit as { startsAt: string }).startsAt, 'مُسّت بطاقة محسومة').toBe(edit.startsAt)
  })
})

/* ═══ والملغاةُ ليست من «شعبي» (٢٠ أكتوبر ٢٠٢٦) ═══
   شعبةُ إعدادٍ لدورةٍ اعتذر عنها تُلغى، وكانت تبقى في موجز المدرّب «في التجهيز» بخطوتها التالية — في «شعبي»
   و«ما عليك الآن» — بلا «انقلها إلى فصل آخر». ورُئي ساقطا: أُعيد الموجزُ بلا شرط الحالة فسقط. */
describe('②ز الملغاة خارج موجز المدرّب', () => {
  it('⚠️ الموجز بلا ملغاة — وشعبة الإعداد الحيّة فيه', async () => {
    const { CohortPlanService } = await import('../../services/cohort-plan.service')
    const mk = async (title: string, status: string) => {
      const c = await prisma.cohort.create({ data: { courseId: 'C-BIZ-101', title, status, capacity: 20 } })
      await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead' } })
      return c.id
    }
    const live = await mk('شعبة إعداد حيّة', 'draft')
    const gone = await mk('شعبة دورة اعتذر عنها', 'cancelled')
    const ids = (await new CohortPlanService(prisma).summaries(trainerId)).map((r) => r.id)
    expect(ids).toContain(live)
    expect(ids, 'الملغاة في «شعبي» تنتظر تجهيزا').not.toContain(gone)
  })
})

describe('②ب اجتماعات Zoom', () => {
  it('تنتقل مع لقاءاتها إلى الموعد الجديد — بمدّتها', async () => {
    stubZoom()
    const cohortId = await mkCohort('شعبة Zoom', profileId)
    const sessions = await prisma.cohortSession.findMany({ where: { cohortId }, orderBy: { startsAt: 'asc' } })
    await prisma.zoomMeeting.create({ data: { sessionId: sessions[0]!.id, provider: 'zoom_api', meetingId: `mv-${cohortId}`, joinUrl: 'https://zoom.us/j/1' } })
    const r = await svc.request(trainerId, cohortId, { toYear: target.year, toSeason: target.season, reason: 'الطلب قليل هذا الفصل' })
    patches.length = 0
    await svc.review(adminId, r.id, { action: 'approve' })
    const moved = await prisma.cohortSession.findUniqueOrThrow({ where: { id: sessions[0]!.id } })
    expect(patches).toHaveLength(1)
    expect(patches[0]!.meetingId).toBe(`mv-${cohortId}`)
    expect(patches[0]!.body.start_time).toBe(moved.startsAt.toISOString())
    expect(patches[0]!.body.duration).toBe(120)
    const a = await prisma.auditEvent.findFirst({ where: { action: 'cohort.move.zoom', entityId: cohortId } })
    expect(a?.meta).toMatchObject({ moved: 1, failed: 0 })
  })
})

describe('②ج التذكير قبل الفصل الجديد بشهر', () => {
  it('لمدرّبي آخر نقل معتمد، مرة واحدة، حين يحل موعده', async () => {
    const cohortId = await mkCohort('شعبة التذكير', profileId)
    const r = await svc.request(trainerId, cohortId, { toYear: target.year, toSeason: target.season, reason: 'الطلب قليل هذا الفصل' })
    await svc.review(adminId, r.id, { action: 'approve' })
    const at = moveReminderAt(target)
    const bells = () => prisma.notification.count({ where: { userId: trainerId, title: { contains: 'راجع «شعبة التذكير»' } } })

    expect((await svc.remindDue(new Date(at.getTime() - 3_600_000))).reminded, 'ذكّر قبل موعده').toBe(0)
    expect(await bells()).toBe(0)
    await svc.remindDue(new Date(at.getTime() + 60_000))
    expect(await bells()).toBe(2) // جرسٌ وبريد
    await svc.remindDue(new Date(at.getTime() + 2 * 3_600_000))
    expect(await bells(), 'ذكّر مرتين').toBe(2)
    expect((await prisma.cohortMoveRequest.findUniqueOrThrow({ where: { id: r.id } })).reminderSentAt).not.toBeNull()
  })
})

describe('③ الردّ والسحب', () => {
  it('الردّ يبقي المواعيد ويصل المدرّب بتعليقه', async () => {
    const cohortId = await mkCohort('شعبة الردّ', profileId)
    const before = await prisma.cohortSession.findMany({ where: { cohortId }, orderBy: { startsAt: 'asc' } })
    const r = await svc.request(trainerId, cohortId, { toYear: target.year, toSeason: target.season, reason: 'الطلب قليل هذا الفصل' })
    await svc.review(adminId, r.id, { action: 'reject', comment: 'نحتاجها هذا الفصل' })
    const after = await prisma.cohortSession.findMany({ where: { cohortId }, orderBy: { startsAt: 'asc' } })
    expect(after.map((s) => s.startsAt.toISOString())).toEqual(before.map((s) => s.startsAt.toISOString()))
    const n = await prisma.notification.findFirst({ where: { userId: trainerId }, orderBy: { queuedAt: 'desc' } })
    expect(n?.body).toBe('نحتاجها هذا الفصل')
  })

  it('السحب من صاحبه وحده — ثمّ يُطلب من جديد', async () => {
    const cohortId = await mkCohort('شعبة السحب', profileId)
    const r = await svc.request(trainerId, cohortId, { toYear: target.year, toSeason: target.season, reason: 'الطلب قليل هذا الفصل' })
    await expect(svc.withdraw(otherTrainerId, r.id)).rejects.toMatchObject({ status: 404 })
    await svc.withdraw(trainerId, r.id)
    const again = await svc.request(trainerId, cohortId, { toYear: target.year, toSeason: target.season, reason: 'بعد السحب أطلب ثانية' })
    expect(again.status).toBe('pending')
  })

  /* ٢٠ أكتوبر ٢٠٢٦: كان المساعدُ لا يرى طلبَ الرئيس، فيرى «انقلها» ويُردّ بـ«اسحبه أوّلا» وهو لا يراه. ورُئي ساقطا:
     أُعيد `mine` إلى طالبه وحدَه فسقط */
  it('⚠️ وشريكه في الشعبة يرى الطلب المعلّق — ولا يسحبه', async () => {
    const cohortId = await mkCohort('شعبة الشريكين', profileId)
    const app2 = await prisma.trainerApplication.create({
      data: { reference: `TR-MOVE-2-${Date.now()}`, fullName: 'مدرّب آخر', email: 'move-other@test.local', status: 'active', motivation: 'اختبار', privacyConsentAt: new Date() },
    })
    const other = await prisma.trainerProfile.upsert({
      where: { userId: otherTrainerId }, update: {},
      create: { applicationId: app2.id, userId: otherTrainerId, isVerified: true },
    })
    await prisma.cohortTrainer.create({ data: { cohortId, profileId: other.id, role: 'assistant' } })
    const r = await svc.request(trainerId, cohortId, { toYear: target.year, toSeason: target.season, reason: 'الطلب قليل هذا الفصل' })
    const seen = (await svc.mine(otherTrainerId)).find((x) => x.id === r.id)
    expect(seen, 'لم ير الشريك طلب النقل المعلّق').toBeTruthy()
    expect(seen!.mine).toBe(false)
    expect((await svc.mine(trainerId)).find((x) => x.id === r.id)?.mine).toBe(true)
    await expect(svc.withdraw(otherTrainerId, r.id)).rejects.toMatchObject({ status: 404 })
  })
})
