/* الجدولُ الثابتُ بندا واحدا بسلسلته — على قاعدةٍ حقيقيّة (١١ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «في حال قمنا بتعديل شيءٍ قد يؤثّر على توقيتاتٍ أخرى يجب أن يكون التعديلُ كاملا
   بسلسلة، لكي لا نخرّب بدلَ ما نُصلح». ثمّ اختار بطاقةً واحدةً بالجدول الجديد كلِّه.

   ١) **الإدارةُ تطلبه فتبنيه المنصّة** من لقاءات الشعبة ومهامّها — مسوّدةً لا يراها المدرّب حتّى تُعتمد،
      ولا تتكرّر بنقرةٍ ثانية، ولا يطلبه غيرُ المعتمِد.
   ٢) **ونقلُ لقاءٍ وحدَه يكسر ما حوله يُردّ** في الرفع — ويُقال: اكتبه جدولا واحدا.
   ٣) **وقبولُه ينقل الكلَّ**: اللقاءاتِ ومواعيدَ المهامّ التي تتبعها، معا.
   ٤) **أو لا شيء**: إن سقط نقلٌ في وسطه أُعيد ما نُقل قبله — فلا يبقى نصفُ جدول. */

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
const profiles: Record<string, string> = {}

const login = async (email: string) => `${SESSION_COOKIE}=${(await auth.login(email, PASS)).token}`
const call = (method: 'GET' | 'POST', url: string, who: string, payload?: unknown) =>
  app.inject({ method, url, headers: { cookie: cookies[who] }, ...(payload !== undefined ? { payload: payload as never } : {}) })

const MODS = ['M1', 'M2', 'M3', 'M4']
/** أسبوعٌ لكلّ محور — والرابعُ أسبوعان يمرّان بعطلة ١ يناير */
const WEEKS = [['2026-12-06', '2026-12-11'], ['2026-12-12', '2026-12-18'], ['2026-12-19', '2026-12-24'], ['2026-12-26', '2027-01-08']]
const content = {
  kind: 'trainer',
  modules: MODS.map((id) => ({ moduleId: id, titleAr: `محور ${id}`, outcomeAr: 'يحلّل حالةً', activityAr: 'يحلّ حالةً من سوقٍ أردنيّ', artifactAr: 'ورقةُ تحليل' })),
  resources: [],
  slots: MODS.map((id, i) => ({ moduleIds: [id], startsOn: WEEKS[i]![0], endsOn: WEEKS[i]![1] })),
  startsOn: '2026-12-06', endsOn: '2027-01-30',
}
const h = (iso: string, n: number) => new Date(Date.parse(iso) + n * 3_600_000)

type Item = { id: string; kind: string; status: string; stale: boolean; view: { titleAr: string; rows: { labelAr: string; beforeAr: string | null; afterAr: string | null }[] } }

/** شعبةٌ بخطّةٍ بانتظار القرار، ولقاءاتٌ على أربعة مواعيدَ مختلفة، ومهمّةٌ لكلّ محورٍ بعد لقائه بأربعة أيّام */
async function messyCohort(tag: string, who: string, end = '2027-01-30') {
  const profileId = profiles[who]!
  const course = await prisma.course.findFirstOrThrow({ select: { id: true } })
  const cohort = await prisma.cohort.create({
    data: {
      courseId: course.id, title: `شعبةُ الجدول ${tag} ${STAMP}`, status: 'draft', capacity: 20,
      scheduleWindowStart: new Date('2026-12-05T21:00:00.000Z'), scheduleWindowEnd: new Date(`${end}T20:59:59.999Z`),
    },
  })
  await prisma.cohortTrainer.create({ data: { cohortId: cohort.id, profileId, role: 'lead' } })
  const plan = await prisma.cohortDeliveryPlan.create({
    data: { cohortId: cohort.id, trainerId: profileId, status: 'submitted', submittedAt: new Date(), content: { ...content, endsOn: end } as never },
  })
  /* الأحد ١٩:٠٠ · الاثنين ١٩:٠٠ · الأربعاء ١٩:٠٠ · الأحد ١٨:٠٠ — بتوقيت عمّان (+٣) */
  const starts = ['2026-12-06T16:00:00.000Z', '2026-12-14T16:00:00.000Z', '2026-12-23T16:00:00.000Z', '2026-12-27T15:00:00.000Z']
  const sessions = []
  for (const [i, s] of starts.entries()) {
    sessions.push(await prisma.cohortSession.create({
      data: { cohortId: cohort.id, moduleId: MODS[i]!, moduleIds: [MODS[i]!], title: `لقاء المحور ${i + 1}`, startsAt: new Date(s), endsAt: h(s, 2) },
    }))
  }
  const tasks = []
  for (const [i, s] of starts.entries()) {
    tasks.push(await prisma.cohortAssessment.create({
      data: { cohortId: cohort.id, moduleId: MODS[i]!, title: `واجب المحور ${i + 1}`, type: 'assignment', maxScore: 10, dueAt: h(s, 24 * 4) },
    }))
  }
  return { cohortId: cohort.id, planId: plan.id, sessions, tasks }
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)
  const admin = await auth.register(`sc-admin-${STAMP}@test.local`, PASS, 'المعتمِد')
  await auth.setRoles(admin.userId, ['academic_manager'])
  cookies.admin = await login(`sc-admin-${STAMP}@test.local`)
  /* مدرّبٌ لكلّ شعبة — فلا تتعارض لقاءاتُ الشعب في الاختبار نفسِه */
  for (const [i, who] of ['a', 'b', 'c', 'd', 'e', 'f'].entries()) {
    const email = `sc-${who}-${STAMP}@test.local`
    const u = await auth.register(email, PASS, `مدرّب الجدول ${who}`)
    await auth.setRoles(u.userId, ['trainer'])
    const application = await prisma.trainerApplication.create({
      data: {
        reference: `WJ-TR-SC-${who}-${STAMP}`, email, fullName: `مدرّب الجدول ${who}`,
        phoneCountryCode: '+962', phone: `78${i + 7}${STAMP % 1000000}`, country: 'الأردن', status: 'active',
      },
    })
    profiles[who] = (await prisma.trainerProfile.create({ data: { applicationId: application.id, userId: u.userId } })).id
    cookies[who] = await login(email)
  }
}, 240_000)

describe('الجدولُ الثابتُ بسلسلته', () => {
  let c: Awaited<ReturnType<typeof messyCohort>>

  it('⚠️ ١) الإدارةُ تطلبه فتبنيه المنصّةُ مسوّدة: كلُّ لقاءٍ بما كان وما نقترح، ومواعيدُ المهامّ التي تتبعه', async () => {
    c = await messyCohort('أ', 'a')
    expect((await call('POST', `/api/admin/cohort-plans/${c.planId}/edits/schedule`, 'a')).statusCode, 'المدرّبُ لا يطلبه').toBe(403)
    const r = await call('POST', `/api/admin/cohort-plans/${c.planId}/edits/schedule`, 'admin')
    expect(r.statusCode, r.body).toBe(201)
    const items = r.json() as Item[]
    expect(items).toHaveLength(1)
    const [x] = items
    expect(x!.kind).toBe('schedule')
    expect(x!.status, 'مسوّدةٌ قبل المدرّب').toBe('proposed')
    expect(x!.view.titleAr).toBe('جدولٌ ثابت: الأحد 19:00 كلَّ أسبوع')
    /* اللقاءاتُ الثلاثةُ التي ليست على الموعد، ثمّ مواعيدُ الواجبات التي انتقل يومُ لقائها
       (الرابعُ يبقى في يومه وتتغيّر ساعتُه — فواجبُه في موضعه) */
    expect(x!.view.rows.map((r) => r.labelAr)).toEqual([
      'لقاء المحور 2', 'لقاء المحور 3', 'لقاء المحور 4',
      'موعدُ «واجب المحور 2»', 'موعدُ «واجب المحور 3»',
    ])
    expect(x!.view.rows.every((r) => r.beforeAr && r.afterAr && r.beforeAr !== r.afterAr)).toBe(true)
    /* ولا يراه المدرّبُ قبل أن يُعتمد */
    const mine = (await call('GET', `/api/trainer/cohorts/${c.cohortId}/plan-edits`, 'a')).json() as Item[]
    expect(mine.filter((i) => i.kind === 'schedule')).toHaveLength(0)
  })

  it('⚠️ ونقرةٌ ثانيةٌ لا تكرّره — ويُقال لماذا بلغة الزرّ', async () => {
    const r = await call('POST', `/api/admin/cohort-plans/${c.planId}/edits/schedule`, 'admin')
    expect(r.statusCode).toBe(409)
    expect(r.json().error.message_ar).toBe('في البطاقة جدولٌ مقترحٌ لم يُقرَّر فيه — راجعه أو احذفه قبل أن يُجهَّز غيرُه')
    expect(await prisma.planEditSuggestion.count({ where: { planId: c.planId, kind: 'schedule' } })).toBe(1)
  })

  it('⚠️ ٢) ونقلُ لقاءٍ وحدَه يكسر ما حوله يُردّ في الرفع — ويُقال: اكتبه جدولا واحدا', async () => {
    const other = await messyCohort('ب', 'b')
    /* لقاءُ المحور الثاني من الاثنين ١٤ ديسمبر إلى الجمعة ١٨ مساءً — وواجبُه ظهرَ ١٨: يصير قبله */
    const late = { kind: 'session_move', sessionId: other.sessions[1]!.id, reasonAr: 'أبعد', startsAt: '2026-12-18T17:00:00.000Z', endsAt: '2026-12-18T19:00:00.000Z' }
    const r = await call('POST', `/api/admin/cohort-plans/${other.planId}/edits`, 'admin', { format: 'wajeez.plan-edits/1', planId: other.planId, items: [late] })
    expect(r.statusCode).toBe(422)
    expect(r.json().error.message_ar).toMatch(/البند 1: نقلُ هذا اللقاء وحدَه يمسّ توقيتاتٍ أخرى — موعدُ مهمّة «واجب المحور 2» يصير قبل اللقاء الذي تُشرح فيه/)
    expect(await prisma.planEditSuggestion.count({ where: { planId: other.planId } })).toBe(0)
    /* ومعه موعدُ واجبه في جدولٍ واحد — يُرفع */
    const chained = {
      kind: 'schedule', reasonAr: 'معا', weekday: 5, clock: '20:00',
      moves: [{ sessionId: late.sessionId, startsAt: late.startsAt, endsAt: late.endsAt }],
      tasks: [{ assessmentId: other.tasks[1]!.id, dueAt: '2026-12-22T16:00:00.000Z' }],
    }
    const ok = await call('POST', `/api/admin/cohort-plans/${other.planId}/edits`, 'admin', { format: 'wajeez.plan-edits/1', planId: other.planId, items: [chained] })
    expect(ok.statusCode, ok.body).toBe(201)
  })

  it('⚠️ ٣) وقبولُه ينقل الكلَّ — اللقاءاتِ ومواعيدَ المهامّ معا', async () => {
    const id = (await prisma.planEditSuggestion.findFirstOrThrow({ where: { planId: c.planId, kind: 'schedule' } })).id
    expect((await call('POST', `/api/admin/plan-edits/${id}/approve`, 'admin', {})).statusCode).toBe(200)
    expect((await call('POST', `/api/admin/cohort-plans/${c.planId}/decide`, 'admin', { approve: false })).statusCode).toBe(200)
    const r = await call('POST', `/api/trainer/plan-edits/${id}/accept`, 'a', {})
    expect(r.statusCode, r.body).toBe(200)
    const sessions = await prisma.cohortSession.findMany({ where: { cohortId: c.cohortId }, orderBy: { startsAt: 'asc' } })
    expect(sessions.map((s) => s.startsAt.toISOString())).toEqual([
      '2026-12-06T16:00:00.000Z', '2026-12-13T16:00:00.000Z', '2026-12-20T16:00:00.000Z', '2026-12-27T16:00:00.000Z',
    ])
    /* وكلُّ واجبٍ بعد لقائه بأيّامه الأربعة كما كان (والرابعُ تأخّر ساعةً فبقي واجبُه) */
    for (const s of sessions) {
      const t = await prisma.cohortAssessment.findFirstOrThrow({ where: { cohortId: c.cohortId, moduleId: s.moduleIds[0]! } })
      expect(Math.round((t.dueAt!.getTime() - s.startsAt.getTime()) / 86_400_000), t.title).toBe(4)
    }
    expect((await prisma.planEditSuggestion.findUniqueOrThrow({ where: { id } })).status).toBe('accepted')
  })

  it('⚠️ ٤) أو لا شيء: يسقط نقلٌ في وسطه فيُعاد ما نُقل قبله — ويبقى البندُ ينتظر قرارَه', async () => {
    const d = await messyCohort('ج', 'c')
    /* الأوّلُ يصحّ، والثاني خارجَ مدّة الشعبة — فيسقط في التطبيق بعد أن نُقل الأوّل */
    const schedule = {
      kind: 'schedule', reasonAr: 'جدولٌ يسقط في وسطه', weekday: 0, clock: '19:00',
      moves: [
        { sessionId: d.sessions[0]!.id, startsAt: '2026-12-07T16:00:00.000Z', endsAt: '2026-12-07T18:00:00.000Z' },
        { sessionId: d.sessions[3]!.id, startsAt: '2027-03-07T16:00:00.000Z', endsAt: '2027-03-07T18:00:00.000Z' },
      ],
      tasks: [{ assessmentId: d.tasks[3]!.id, dueAt: '2027-03-11T16:00:00.000Z' }],
    }
    const up = await call('POST', `/api/admin/cohort-plans/${d.planId}/edits`, 'admin', { format: 'wajeez.plan-edits/1', planId: d.planId, items: [schedule] })
    expect(up.statusCode, up.body).toBe(201)
    const id = (up.json() as Item[])[0]!.id
    expect((await call('POST', `/api/admin/plan-edits/${id}/approve`, 'admin', {})).statusCode).toBe(200)
    expect((await call('POST', `/api/admin/cohort-plans/${d.planId}/decide`, 'admin', { approve: false })).statusCode).toBe(200)
    const r = await call('POST', `/api/trainer/plan-edits/${id}/accept`, 'c', {})
    expect(r.statusCode).toBeGreaterThanOrEqual(400)
    expect(r.json().error.message_ar).toMatch(/^لم يُنقل شيءٌ من الجدول — /)
    const after = await prisma.cohortSession.findMany({ where: { cohortId: d.cohortId }, orderBy: { startsAt: 'asc' } })
    expect(after.map((s) => s.startsAt.toISOString()), 'بقي نصفُ جدول').toEqual(d.sessions.map((s) => s.startsAt.toISOString()))
    expect((await prisma.cohortAssessment.findUniqueOrThrow({ where: { id: d.tasks[3]!.id } })).dueAt!.toISOString()).toBe(d.tasks[3]!.dueAt!.toISOString())
    expect((await prisma.planEditSuggestion.findUniqueOrThrow({ where: { id } })).status).toBe('pending')
  })
})

describe('⑤ والجدولُ يحمل حدودَ الخطّة التي يحتاجها — آخرَ يومٍ في المدّة ومواعيدَ المحاور (١٣ أكتوبر ٢٠٢٦)', () => {
  /* «سبتٌ وأربعاء فقط… وأرجو تعديل المواعيد من طرفكم» (مدرّب). وجدولُه يتجاوز آخرَ يومٍ في مدّة شعبته ومواعيدَ محاوره،
     ولا بطاقةَ كانت تحملهما. فمدّةٌ تنتهي ٨ يناير، ولقاءُ المحور الرابع يُنقل إلى ١٧ يناير */
  const move = (d: Awaited<ReturnType<typeof messyCohort>>) => ({
    moves: [{ sessionId: d.sessions[3]!.id, startsAt: '2027-01-17T16:00:00.000Z', endsAt: '2027-01-17T18:00:00.000Z' }],
    tasks: [{ assessmentId: d.tasks[3]!.id, dueAt: '2027-01-21T16:00:00.000Z' }],
  })
  const plan = { endsOn: '2027-01-24', slots: [{ moduleIds: ['M4'], startsOn: '2027-01-17', endsOn: '2027-01-24' }] }
  /** يُرفع البندُ ويُعتمد وتُردّ الخطّةُ إلى مدرّبها — ثمّ يقبله */
  const acceptOne = async (d: Awaited<ReturnType<typeof messyCohort>>, who: string, item: Record<string, unknown>) => {
    const up = await call('POST', `/api/admin/cohort-plans/${d.planId}/edits`, 'admin', { format: 'wajeez.plan-edits/1', planId: d.planId, items: [item] })
    expect(up.statusCode, up.body).toBe(201)
    const id = (up.json() as Item[])[0]!.id
    expect((await call('POST', `/api/admin/plan-edits/${id}/approve`, 'admin', {})).statusCode).toBe(200)
    expect((await call('POST', `/api/admin/cohort-plans/${d.planId}/decide`, 'admin', { approve: false })).statusCode).toBe(200)
    return { id, r: await call('POST', `/api/trainer/plan-edits/${id}/accept`, who, {}) }
  }
  const latestContent = async (cohortId: string) =>
    (await prisma.cohortDeliveryPlan.findFirstOrThrow({ where: { cohortId, trainerId: { not: null } }, orderBy: { createdAt: 'desc' } })).content as typeof content

  it('⚠️ بلا حدود الخطّة لا يقع: اللقاءُ خارج مدّة الشعبة — ولا يُنقل شيء', async () => {
    const d = await messyCohort('د', 'd', '2027-01-08')
    const { r } = await acceptOne(d, 'd', { kind: 'schedule', reasonAr: 'بلا حدود', weekday: 0, clock: '19:00', ...move(d) })
    expect(r.statusCode).toBeGreaterThanOrEqual(400)
    expect(r.json().error.message_ar).toMatch(/خارج مدّة الشعبة/)
    expect((await prisma.cohortSession.findUniqueOrThrow({ where: { id: d.sessions[3]!.id } })).startsAt.toISOString()).toBe(d.sessions[3]!.startsAt.toISOString())
  })

  it('⚠️ وبها يقع كلُّه: المدّةُ تمتدّ، وموعدُ المحور يُنقل، ثمّ اللقاءُ وواجبُه', async () => {
    const d = await messyCohort('هـ', 'e', '2027-01-08')
    const { id, r } = await acceptOne(d, 'e', { kind: 'schedule', reasonAr: 'بحدودها', weekday: 0, clock: '19:00', ...move(d), plan })
    expect(r.statusCode, r.body).toBe(200)
    const c = await latestContent(d.cohortId)
    expect(c.endsOn).toBe('2027-01-24')
    expect(c.slots.find((s) => s.moduleIds[0] === 'M4')).toMatchObject({ startsOn: '2027-01-17', endsOn: '2027-01-24' })
    expect(c.slots.find((s) => s.moduleIds[0] === 'M1')).toMatchObject({ startsOn: WEEKS[0]![0], endsOn: WEEKS[0]![1] })
    expect((await prisma.cohort.findUniqueOrThrow({ where: { id: d.cohortId } })).scheduleWindowEnd!.toISOString() >= '2027-01-24').toBe(true)
    expect((await prisma.cohortSession.findUniqueOrThrow({ where: { id: d.sessions[3]!.id } })).startsAt.toISOString()).toBe('2027-01-17T16:00:00.000Z')
    expect((await prisma.cohortAssessment.findUniqueOrThrow({ where: { id: d.tasks[3]!.id } })).dueAt!.toISOString()).toBe('2027-01-21T16:00:00.000Z')
    expect((await prisma.planEditSuggestion.findUniqueOrThrow({ where: { id } })).status).toBe('accepted')
  })

  it('⚠️ أو لا شيء: يسقط نقلٌ بعد أن كُتبت الحدود — فتعود الخطّةُ ومدّتُها كما كانت', async () => {
    const d = await messyCohort('و', 'f', '2027-01-08')
    const m = move(d)
    /* الثاني في مارس — خارجَ المدّة الجديدة نفسِها */
    m.moves.push({ sessionId: d.sessions[2]!.id, startsAt: '2027-03-07T16:00:00.000Z', endsAt: '2027-03-07T18:00:00.000Z' })
    m.tasks.push({ assessmentId: d.tasks[2]!.id, dueAt: '2027-03-11T16:00:00.000Z' })
    const { id, r } = await acceptOne(d, 'f', { kind: 'schedule', reasonAr: 'يسقط', weekday: 0, clock: '19:00', ...m, plan })
    expect(r.statusCode).toBeGreaterThanOrEqual(400)
    expect(r.json().error.message_ar).toMatch(/^لم يُنقل شيءٌ من الجدول — /)
    const c = await latestContent(d.cohortId)
    expect(c.endsOn, 'بقيت المدّةُ ممدودة').toBe('2027-01-08')
    expect(c.slots.find((s) => s.moduleIds[0] === 'M4')).toMatchObject({ startsOn: WEEKS[3]![0], endsOn: WEEKS[3]![1] })
    expect((await prisma.cohort.findUniqueOrThrow({ where: { id: d.cohortId } })).scheduleWindowEnd!.toISOString() < '2027-01-09').toBe(true)
    const after = await prisma.cohortSession.findMany({ where: { cohortId: d.cohortId }, orderBy: { startsAt: 'asc' } })
    expect(after.map((s) => s.startsAt.toISOString()), 'بقي نصفُ جدول').toEqual(d.sessions.map((s) => s.startsAt.toISOString()))
    expect((await prisma.planEditSuggestion.findUniqueOrThrow({ where: { id } })).status).toBe('pending')
  })
})
