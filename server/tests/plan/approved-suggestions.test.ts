/* «اعتمدها» يُبقي ما اعتمدته الإدارةُ للمدرّب — اقتراحا يقبله أو يرفضه (١٧ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «when I press اعتمدها, the changes still appear for the trainer… I don't mind if he
   accept or reject them… They should see it as a recommendation… from my side it's already معتمدة…
   I don't want to make it as a pending… no need for a new button». وهنا على قاعدةٍ حقيقيّة:

   ١) **الاعتمادُ يُبقي المعتمَدَ للمدرّب** اختياريّا، ويُسقط المسوّدةَ التي لم تُعتمد — ويقول له الخبرُ أين يجدها.
   ٢) **وقبولُه على الخطّة المعتمدة يُكتب فيها مباشرة** — بلا مراجعةٍ تُفتح، ولا مهمّةٍ أو لقاءٍ يعود
      إلى انتظار الإدارة. ورفضُه لا يمسّ شيئا.
   ٣) **والجدولُ بحدوده** يمدّ مدّةَ الشعبة المعتمدة ثمّ ينقل — كما يقبله على خطّةٍ في يده.
   ٤) **ومراجعةٌ يفتحها بعد الاعتماد تحمل ما بقي** — فلا يغيب عنه، ولا يبقى على خطّةٍ تنزل. */

import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect as vexpect, it } from 'vitest'
import { plainExpect } from '../helpers/plain-expect'
/* يُقارَن بلا تشكيلٍ إعرابيّ — العلّةُ في `helpers/plain-expect.ts` */
const expect = plainExpect(vexpect)
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let auth: AuthService
let app: FastifyInstance
const STAMP = Date.now()
const PASS = 'Pass#12345'
const cookies: Record<string, string> = {}
const users: Record<string, { userId: string; profileId: string }> = {}

const login = async (email: string) => `${SESSION_COOKIE}=${(await auth.login(email, PASS)).token}`
const call = (method: 'GET' | 'POST' | 'PUT', url: string, who: string, payload?: unknown) =>
  app.inject({ method, url, headers: { cookie: cookies[who] }, ...(payload !== undefined ? { payload: payload as never } : {}) })

const MODS = ['M1', 'M2', 'M3', 'M4']
/** أسبوعٌ لكلّ محور — والرابعُ أسبوعان */
const WEEKS = [['2026-12-06', '2026-12-11'], ['2026-12-12', '2026-12-18'], ['2026-12-19', '2026-12-24'], ['2026-12-26', '2027-01-08']]
const h = (iso: string, n: number) => new Date(Date.parse(iso) + n * 3_600_000)

type Item = { id: string; kind: string; status: string; view: { titleAr: string } }

/** شعبةٌ بخطّةٍ بانتظار القرار، ولقاءٌ معتمَدٌ لكلّ محور، ومهمّةٌ منشورةٌ بعده بأربعة أيّام.
    و`slots` اختياريّة: بلا مواعيد محاور يعود اللقاءُ المنقولُ إلى انتظار الإدارة (`keepsApprovalOnMove`) */
async function cohortOf(tag: string, who: string, opts: { end?: string; slots?: boolean; inPerson?: boolean } = {}) {
  const end = opts.end ?? '2027-01-30'
  const content = {
    kind: 'trainer',
    modules: MODS.map((id) => ({ moduleId: id, titleAr: `محور ${id}`, outcomeAr: 'يحلّل حالةً', activityAr: 'يحلّ حالةً من سوقٍ أردنيّ', artifactAr: 'ورقةُ تحليل' })),
    resources: [],
    ...(opts.slots ? { slots: MODS.map((id, i) => ({ moduleIds: [id], startsOn: WEEKS[i]![0], endsOn: WEEKS[i]![1] })) } : {}),
    startsOn: '2026-12-06', endsOn: end,
  }
  const course = await prisma.course.findFirstOrThrow({ select: { id: true } })
  const cohort = await prisma.cohort.create({
    data: {
      courseId: course.id, title: `شعبةُ الاقتراحات ${tag} ${STAMP}`, status: 'draft', capacity: 20,
      /* حضوريّةٌ: لقاؤها الجديدُ يُعتمد بلا اجتماع Zoom — فلا يقف الاختبارُ على مفاتيحه */
      ...(opts.inPerson ? { deliveryMode: 'in_person' } : {}),
      scheduleWindowStart: new Date('2026-12-05T21:00:00.000Z'), scheduleWindowEnd: new Date(`${end}T20:59:59.999Z`),
    },
  })
  await prisma.cohortTrainer.create({ data: { cohortId: cohort.id, profileId: users[who]!.profileId, role: 'lead' } })
  const plan = await prisma.cohortDeliveryPlan.create({
    data: { cohortId: cohort.id, trainerId: users[who]!.profileId, status: 'submitted', submittedAt: new Date(), content: content as never },
  })
  /* الأحد ١٩:٠٠ بتوقيت عمّان كلَّ أسبوع */
  const starts = ['2026-12-06T16:00:00.000Z', '2026-12-14T16:00:00.000Z', '2026-12-20T16:00:00.000Z', '2026-12-27T16:00:00.000Z']
  const sessions = []
  const tasks = []
  for (const [i, s] of starts.entries()) {
    sessions.push(await prisma.cohortSession.create({
      data: { cohortId: cohort.id, moduleId: MODS[i]!, moduleIds: [MODS[i]!], title: `لقاء المحور ${i + 1}`, startsAt: new Date(s), endsAt: h(s, 2), approvalState: 'approved' },
    }))
    tasks.push(await prisma.cohortAssessment.create({
      data: { cohortId: cohort.id, moduleId: MODS[i]!, title: `واجب المحور ${i + 1}`, type: 'assignment', maxScore: 10, dueAt: h(s, 24 * 4) },
    }))
  }
  return { cohortId: cohort.id, planId: plan.id, sessions, tasks, content }
}

/** يرفع البنودَ ويعتمد للمدرّب ما لم يُستثنَ منها — ويعيدها بترتيبها */
async function upload(planId: string, items: Record<string, unknown>[], keepDraft: number[] = []) {
  const up = await call('POST', `/api/admin/cohort-plans/${planId}/edits`, 'admin', { format: 'wajeez.plan-edits/1', planId, items })
  expect(up.statusCode, up.body).toBe(201)
  const rows = await prisma.planEditSuggestion.findMany({ where: { planId }, orderBy: [{ createdAt: 'asc' }, { seq: 'asc' }] })
  for (const [i, row] of rows.entries()) {
    if (keepDraft.includes(i)) continue
    expect((await call('POST', `/api/admin/plan-edits/${row.id}/approve`, 'admin', {})).statusCode).toBe(200)
  }
  return rows.map((x) => x.id)
}

const approve = async (planId: string) => {
  const r = await call('POST', `/api/admin/cohort-plans/${planId}/decide`, 'admin', { approve: true })
  expect(r.statusCode, r.body).toBe(200)
}
const accept = (id: string, who: string) => call('POST', `/api/trainer/plan-edits/${id}/accept`, who, {})
const statusOf = async (id: string) => (await prisma.planEditSuggestion.findUniqueOrThrow({ where: { id } })).status

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)
  const admin = await auth.register(`as-admin-${STAMP}@test.local`, PASS, 'المعتمِد')
  await auth.setRoles(admin.userId, ['academic_manager'])
  cookies.admin = await login(`as-admin-${STAMP}@test.local`)
  /* مدرّبٌ لكلّ شعبة — فلا تتعارض لقاءاتُ الشعب في الاختبار نفسِه */
  for (const [i, who] of ['a', 'b', 'c'].entries()) {
    const email = `as-${who}-${STAMP}@test.local`
    const u = await auth.register(email, PASS, `مدرّب الاقتراحات ${who}`)
    await auth.setRoles(u.userId, ['trainer'])
    const application = await prisma.trainerApplication.create({
      data: {
        reference: `WJ-TR-AS-${who}-${STAMP}`, email, fullName: `مدرّب الاقتراحات ${who}`,
        phoneCountryCode: '+962', phone: `77${i + 4}${STAMP % 1000000}`, country: 'الأردن', status: 'active',
      },
    })
    users[who] = { userId: u.userId, profileId: (await prisma.trainerProfile.create({ data: { applicationId: application.id, userId: u.userId } })).id }
    cookies[who] = await login(email)
  }
}, 240_000)

describe('«اعتمدها» يُبقي ما اعتمدته الإدارةُ للمدرّب — ويُكتب ما يقبله في الخطّة المعتمدة', () => {
  let c: Awaited<ReturnType<typeof cohortOf>>
  let ids: string[] = []

  it('⚠️ ١) الاعتمادُ يُبقي المعتمَدَ عنده اختياريّا، ويُسقط المسوّدة — والخبرُ يقول أين يجدها', async () => {
    c = await cohortOf('أ', 'a', { inPerson: true })
    ids = await upload(c.planId, [
      { kind: 'module', moduleId: 'M1', required: true, reasonAr: 'تطبيقٌ أوضح', set: { activityAr: 'يحلّل حالةَ متجرٍ في إربد' } },
      { kind: 'task_change', assessmentId: c.tasks[0]!.id, reasonAr: 'موعدٌ أقرب', set: { dueAt: '2026-12-09T16:00:00.000Z' } },
      { kind: 'session_move', sessionId: c.sessions[1]!.id, reasonAr: 'الأحد كغيره', startsAt: '2026-12-13T16:00:00.000Z', endsAt: '2026-12-13T18:00:00.000Z' },
      { kind: 'task_add', reasonAr: 'مهمّةٌ للمحور 2', task: { title: 'رسالةٌ في صفحة', type: 'assignment', moduleId: 'M2', dueAt: '2026-12-17T16:00:00.000Z' } },
      { kind: 'task_remove', assessmentId: c.tasks[3]!.id, reasonAr: 'يغني عنه المشروع' },
      { kind: 'resource_add', reasonAr: 'مصدرٌ للمحور 1', resource: { title: 'دليلُ التحليل', url: 'https://example.com/guide', moduleId: 'M1' } },
      /* ومسوّدةٌ لا يعتمدها المعتمِد */
      { kind: 'plan', reasonAr: 'نبذةٌ أوضح', set: { summaryAr: 'نبذةٌ لم تُعتمد' } },
      { kind: 'session_add', reasonAr: 'لقاءُ مراجعة', session: { title: 'لقاءُ مراجعةٍ للمحور 3', startsAt: '2026-12-22T16:00:00.000Z', endsAt: '2026-12-22T18:00:00.000Z', moduleIds: ['M3'] } },
    ], [6])
    await approve(c.planId)

    const rows = await prisma.planEditSuggestion.findMany({ where: { id: { in: ids } } })
    const byId = new Map(rows.map((x) => [x.id, x]))
    expect([...ids.slice(0, 6), ids[7]!].map((id) => byId.get(id)!.status), 'سقط ما اعتمدته الإدارةُ للمدرّب').toEqual(Array(7).fill('pending'))
    expect(byId.get(ids[6]!)!.status, 'وصلت المدرّبَ مسوّدةٌ لم تُعتمد').toBe('lapsed')
    expect(rows.some((x) => x.required), 'بقي «مطلوبٌ» على خطّةٍ معتمدة').toBe(false)
    const mine = (await call('GET', `/api/trainer/cohorts/${c.cohortId}/plan-edits`, 'a')).json() as Item[]
    expect(mine.filter((x) => x.status === 'pending')).toHaveLength(7)

    const told = await prisma.notification.findFirstOrThrow({
      where: { userId: users.a!.userId, templateKey: 'cohort.plan.decision', title: { contains: 'اعتمدت خطّة' } },
      orderBy: { queuedAt: 'desc' },
    })
    expect(told.body).toContain('وبقيت لك في «المراجعة» اقتراحات من الإدارة (7)، اختيارية')
    expect(told.data, 'الجرسُ لا يفتح «المراجعة»').toMatchObject({ step: 'review' })
  })

  it('⚠️ ٢) قبولُ المحتوى يُكتب في الخطّة المعتمدة نفسِها — ولا تُفتح مراجعةٌ تنتظر', async () => {
    const r = await accept(ids[0]!, 'a')
    expect(r.statusCode, r.body).toBe(200)
    const plans = await prisma.cohortDeliveryPlan.findMany({ where: { cohortId: c.cohortId } })
    expect(plans.map((p) => [p.id, p.status]), 'فتح القبولُ مراجعةً تنتظر الإدارة').toEqual([[c.planId, 'approved']])
    const m1 = (plans[0]!.content as typeof c.content).modules.find((m) => m.moduleId === 'M1')!
    expect(m1.activityAr).toBe('يحلّل حالةَ متجرٍ في إربد')
    const ev = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'cohort.plan.edit.accept', entityId: c.cohortId }, orderBy: { createdAt: 'desc' } })
    expect(ev.meta).toMatchObject({ suggestionId: ids[0], onApprovedPlan: true })
  })

  it('⚠️ والمهمّةُ تُكتب ولا تُطلب — لا طلبَ ينتظر الإدارة', async () => {
    expect((await accept(ids[1]!, 'a')).statusCode).toBe(200)
    const t = await prisma.cohortAssessment.findUniqueOrThrow({ where: { id: c.tasks[0]!.id } })
    expect(t.dueAt!.toISOString()).toBe('2026-12-09T16:00:00.000Z')
    expect(t.pendingChange, 'صار القبولُ طلبا ينتظر الإدارة').toBeNull()
  })

  it('⚠️ واللقاءُ المنقولُ يبقى معتمَدا عند متعلّميه', async () => {
    expect((await accept(ids[2]!, 'a')).statusCode).toBe(200)
    const s = await prisma.cohortSession.findUniqueOrThrow({ where: { id: c.sessions[1]!.id } })
    expect(s.startsAt.toISOString()).toBe('2026-12-13T16:00:00.000Z')
    expect(s.approvalState, 'عاد اللقاءُ إلى انتظار الإدارة').toBe('approved')
  })

  it('⚠️ والمهمّةُ الجديدةُ تُنشر، والمحذوفةُ تُحذف', async () => {
    expect((await accept(ids[3]!, 'a')).statusCode).toBe(200)
    const added = await prisma.cohortAssessment.findFirstOrThrow({ where: { cohortId: c.cohortId, title: 'رسالةٌ في صفحة' } })
    expect(added.status, 'بقيت مسوّدةً تنتظر الإدارة').toBe('published')
    expect((await accept(ids[4]!, 'a')).statusCode).toBe(200)
    expect(await prisma.cohortAssessment.findUnique({ where: { id: c.tasks[3]!.id } }), 'صار الحذفُ طلبا ينتظر').toBeNull()
  })

  it('⚠️ واللقاءُ الجديدُ يُعتمد باسم من اعتمد البطاقة — يصل متعلّميه بلا انتظار', async () => {
    expect((await accept(ids[7]!, 'a')).statusCode).toBe(200)
    const s = await prisma.cohortSession.findFirstOrThrow({ where: { cohortId: c.cohortId, title: 'لقاءُ مراجعةٍ للمحور 3' } })
    expect([s.approvalState, s.approvedBy], 'بقي اللقاءُ ينتظر الإدارة').toEqual(['approved', (await prisma.planEditSuggestion.findUniqueOrThrow({ where: { id: ids[7]! } })).reviewedBy])
  })

  it('⚠️ والرفضُ لا يمسّ شيئا — ثمّ لا شيءَ ينتظره', async () => {
    const r = await call('POST', `/api/trainer/plan-edits/${ids[5]!}/reject`, 'a', {})
    expect(r.statusCode, r.body).toBe(200)
    const plan = await prisma.cohortDeliveryPlan.findUniqueOrThrow({ where: { id: c.planId } })
    expect((plan.content as typeof c.content).resources).toHaveLength(0)
    expect(plan.status).toBe('approved')
    const mine = (await call('GET', `/api/trainer/cohorts/${c.cohortId}/plan-edits`, 'a')).json() as Item[]
    expect(mine.filter((x) => x.status === 'pending')).toHaveLength(0)
  })
})

describe('③ والجدولُ بحدوده على خطّةٍ معتمدة — يمدّ مدّتَها ثمّ ينقل', () => {
  it('⚠️ آخرُ يومٍ يمتدّ في الشعبة نفسِها، واللقاءُ يُنقل ويبقى معتمَدا', async () => {
    const d = await cohortOf('ب', 'b', { end: '2027-01-08', slots: true })
    const [id] = await upload(d.planId, [{
      kind: 'schedule', reasonAr: 'بحدودها', weekday: 0, clock: '19:00',
      moves: [{ sessionId: d.sessions[3]!.id, startsAt: '2027-01-17T16:00:00.000Z', endsAt: '2027-01-17T18:00:00.000Z' }],
      tasks: [{ assessmentId: d.tasks[3]!.id, dueAt: '2027-01-21T16:00:00.000Z' }],
      plan: { endsOn: '2027-01-24', slots: [{ moduleIds: ['M4'], startsOn: '2027-01-17', endsOn: '2027-01-24' }] },
    }])
    await approve(d.planId)
    expect(await statusOf(id!)).toBe('pending')
    const r = await accept(id!, 'b')
    expect(r.statusCode, r.body).toBe(200)
    const plan = await prisma.cohortDeliveryPlan.findUniqueOrThrow({ where: { id: d.planId } })
    expect([plan.status, (plan.content as { endsOn: string }).endsOn]).toEqual(['approved', '2027-01-24'])
    const cohort = await prisma.cohort.findUniqueOrThrow({ where: { id: d.cohortId } })
    expect(cohort.endsAt!.toISOString() >= '2027-01-24', 'لم تمتدّ مدّةُ الشعبة المعتمدة').toBe(true)
    const s = await prisma.cohortSession.findUniqueOrThrow({ where: { id: d.sessions[3]!.id } })
    expect([s.startsAt.toISOString(), s.approvalState]).toEqual(['2027-01-17T16:00:00.000Z', 'approved'])
    expect((await prisma.cohortAssessment.findUniqueOrThrow({ where: { id: d.tasks[3]!.id } })).dueAt!.toISOString()).toBe('2027-01-21T16:00:00.000Z')
  })
})

describe('③ب ومدّةٌ بلا لقاءٍ ينقله — تمتدّ لمهامَّ بعد نهايتها (٣١ أكتوبر ٢٠٢٦)', () => {
  it('⚠️ يُرفع بلا لقاء، وقبولُه يمدّ آخرَ يومٍ في الخطّة والشعبة — ولا لقاءَ يتحرّك', async () => {
    const d = await cohortOf('د', 'b', { end: '2027-01-08' })
    const [id] = await upload(d.planId, [{
      kind: 'schedule', reasonAr: 'مهامّ بعد نهاية الشعبة', weekday: 0, clock: '19:00',
      moves: [], tasks: [], plan: { endsOn: '2027-01-30' },
    }])
    await approve(d.planId)
    const r = await accept(id!, 'b')
    expect(r.statusCode, r.body).toBe(200)
    const plan = await prisma.cohortDeliveryPlan.findUniqueOrThrow({ where: { id: d.planId } })
    expect((plan.content as { endsOn: string }).endsOn).toBe('2027-01-30')
    const cohort = await prisma.cohort.findUniqueOrThrow({ where: { id: d.cohortId } })
    expect(cohort.endsAt!.toISOString() >= '2027-01-30', 'لم تمتدّ مدّةُ الشعبة').toBe(true)
    const moved = await prisma.cohortSession.findMany({ where: { cohortId: d.cohortId } })
    expect(moved.map((s) => s.startsAt.toISOString()).sort()).toEqual(d.sessions.map((s) => s.startsAt.toISOString()).sort())
  })

  it('⚠️ وبلا لقاءٍ ولا حدود خطّةٍ يُردّ الملفّ كلُّه', async () => {
    const d = await cohortOf('ه', 'b')
    const r = await call('POST', `/api/admin/cohort-plans/${d.planId}/edits`, 'admin', {
      items: [{ kind: 'schedule', reasonAr: 'فارغ', weekday: 0, clock: '19:00', moves: [], tasks: [] }],
    })
    expect(r.statusCode).toBe(422)
    expect(r.body).toMatch(/بلا لقاء/)
  })
})

describe('④ ومراجعةٌ تُفتح بعد الاعتماد تحمل ما بقي', () => {
  let e: Awaited<ReturnType<typeof cohortOf>>
  let id = ''

  it('⚠️ يحفظ المدرّبُ تعديلا بيده — فتنتقل الاقتراحاتُ إلى مراجعته، ويقبلها فيها', async () => {
    e = await cohortOf('ج', 'c')
    ;[id] = await upload(e.planId, [{ kind: 'plan', reasonAr: 'نبذةٌ أوضح', set: { summaryAr: 'نبذةٌ مقترحة' } }])
    await approve(e.planId)
    const saved = await call('PUT', `/api/trainer/cohorts/${e.cohortId}/plan`, 'c', { ...e.content, liveNoteAr: 'لقاءاتٌ تفاعليّة' })
    expect(saved.statusCode, saved.body).toBe(200)
    const draft = await prisma.cohortDeliveryPlan.findFirstOrThrow({ where: { cohortId: e.cohortId, status: 'draft' } })
    const row = await prisma.planEditSuggestion.findUniqueOrThrow({ where: { id } })
    expect([row.planId, row.status], 'بقي الاقتراحُ على خطّةٍ ستنزل').toEqual([draft.id, 'pending'])
    const mine = (await call('GET', `/api/trainer/cohorts/${e.cohortId}/plan-edits`, 'c')).json() as Item[]
    expect(mine.map((x) => x.status)).toEqual(['pending'])
    expect((await accept(id, 'c')).statusCode).toBe(200)
    expect(((await prisma.cohortDeliveryPlan.findUniqueOrThrow({ where: { id: draft.id } })).content as { summaryAr: string }).summaryAr).toBe('نبذةٌ مقترحة')
  })

  it('⚠️ وما بقي على خطّةٍ نزلت يسقط حين تُعتمد التي بعدها', async () => {
    const left = await prisma.planEditSuggestion.create({
      data: {
        cohortId: e.cohortId, planId: e.planId, batchId: randomUUID(), seq: 9, kind: 'plan', step: 'identity', required: false,
        reasonAr: 'بقي على الأولى', edit: { kind: 'plan', set: { liveNoteAr: 'س' } }, status: 'pending', createdBy: users.c!.userId,
      },
    })
    const draft = await prisma.cohortDeliveryPlan.findFirstOrThrow({ where: { cohortId: e.cohortId, status: 'draft' } })
    await prisma.cohortDeliveryPlan.update({ where: { id: draft.id }, data: { status: 'submitted', submittedAt: new Date() } })
    await approve(draft.id)
    expect((await prisma.cohortDeliveryPlan.findUniqueOrThrow({ where: { id: e.planId } })).status).toBe('superseded')
    expect(await statusOf(left.id), 'بقي اقتراحٌ على خطّةٍ نزلت').toBe('lapsed')
  })
})
