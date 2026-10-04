/* ═══ اللقاءُ لمحورٍ أو أكثر — في وقت محاوره (٤ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «يضيف ما شاء من اللقاءات المباشرة، ويربطها بمحورٍ أو اثنين
   أو أكثر — اجعلها مرنةً سهلة… لكن لا تدعه يضع لقاءً لمحورٍ في غير وقته».

   والقاعدةُ المحضةُ في `src/application/trainer/axis-timeline.ts` (`axisTimeProblem`)؛
   وهنا أنّ الخادمَ يحكم بها عبر المسالك نفسِها التي تناديها الشاشة:

   ① ثلاثةُ محاورَ من موعدٍ واحدٍ للقاءٍ واحد تُقبل — وكان السقفُ اثنين.
   ② محاورُ من مواعيدَ مختلفةٍ تُردّ عند الإنشاء — ويُسمّى كلُّ محورٍ بموعده.
   ③ ويومٌ خارجَ موعد محوره يُردّ — ولو داخلَ مدّة الشعبة.
   ④ والربطُ بعد الإنشاء بالحدّ نفسِه — وما انعقد يُربط بأيّ محور: واقعةٌ لا مسودّة.
   ⑤ واللقاءُ الواحدُ يغطّي محاورَه كلَّها في قائمة التجهيز. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CohortPlanService, type TrainerPlanContent } from '../../services/cohort-plan.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let app: FastifyInstance
let plans: CohortPlanService
let trainerUserId = ''
let cookie = ''
let cohortId = ''

/* ستّةُ محاورَ على أربعة مواعيد: الأوّلُ يحمل ثلاثةً — والمدّةُ في مستقبلٍ لا يمضي */
const PERIOD = { startsOn: '2027-05-02', endsOn: '2027-05-29' }
const IDS = ['ST-M1', 'ST-M2', 'ST-M3', 'ST-M4', 'ST-M5', 'ST-M6']
const SLOTS = [
  { startsOn: '2027-05-02', endsOn: '2027-05-08', moduleIds: ['ST-M1', 'ST-M2', 'ST-M3'] },
  { startsOn: '2027-05-09', endsOn: '2027-05-15', moduleIds: ['ST-M4'] },
  { startsOn: '2027-05-16', endsOn: '2027-05-22', moduleIds: ['ST-M5'] },
  { startsOn: '2027-05-23', endsOn: '2027-05-29', moduleIds: ['ST-M6'] },
]
const body = 'الشرحُ المكتوب الذي يقرؤه المتعلّمُ قبل اللقاء، وفيه ما يكفيه ليبدأ عملَه في هذا المحور.'
const content: TrainerPlanContent = {
  kind: 'trainer', summaryAr: 'شعبةٌ بلقاءاتٍ مرنة', ...PERIOD,
  modules: IDS.map((moduleId, i) => ({ moduleId, titleAr: `المحور ${i + 1}`, bodyAr: body })),
  resources: [{ title: 'مرجع', url: 'https://x.test/ref', category: 'reading', moduleId: 'ST-M1' }],
  slots: SLOTS,
  workbook: { title: 'كرّاسةُ الدورة', url: 'https://x.test/wb.pdf', parts: IDS.map((moduleId, i) => ({ moduleId, whereAr: `ص ${i + 1}` })) },
}
/** الثامنةُ مساءً بعمّان (الخامسةُ بغرينتش) يومَ `day` — ساعتان */
const on = (day: string) => ({ startsAt: `${day}T17:00:00.000Z`, endsAt: `${day}T19:00:00.000Z` })
const post = (url: string, payload: unknown) => app.inject({ method: 'POST', url, payload: payload as object, headers: { cookie } })
const patch = (url: string, payload: unknown) => app.inject({ method: 'PATCH', url, payload: payload as object, headers: { cookie } })
const addSession = (payload: unknown) => post(`/api/trainer/cohorts/${cohortId}/sessions`, payload)

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  plans = new CohortPlanService(prisma)
  const auth = new AuthService(prisma)

  const t = await auth.register('flex-trainer@test.local', 'Trainer#12345', 'مدرّبُ اللقاءات المرنة')
  trainerUserId = t.userId
  await auth.setRoles(trainerUserId, ['trainer'])
  cookie = `${SESSION_COOKIE}=${(await auth.login('flex-trainer@test.local', 'Trainer#12345')).token}`
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-ST-${Date.now()}`, fullName: 'مدرّبُ اللقاءات المرنة', email: 'flex-trainer@test.local', status: 'active', userId: trainerUserId },
  })
  const profile = await prisma.trainerProfile.create({ data: { userId: trainerUserId, applicationId: application.id } })
  const course = await prisma.course.findFirst({ select: { id: true } })
  /* حضوريّةٌ عمدا: لا اجتماعَ Zoom فلا شبكةَ في الاختبار */
  const cohort = await prisma.cohort.create({
    data: { courseId: course!.id, title: 'شعبةُ اللقاءات المرنة', status: 'draft', price: 100, currency: 'USD', deliveryMode: 'in_person', timezone: 'Asia/Amman' },
  })
  cohortId = cohort.id
  await prisma.cohortTrainer.create({ data: { cohortId, profileId: profile.id, role: 'lead', assignedBy: trainerUserId } })
  const saved = await app.inject({ method: 'PUT', url: `/api/trainer/cohorts/${cohortId}/plan`, payload: content as object, headers: { cookie } })
  expect(saved.statusCode, saved.body).toBe(200)
})

afterAll(async () => { await app.close() })

describe('① اللقاءُ لمحورٍ أو أكثر من موعده', () => {
  it('⚠️ ثلاثةُ محاورَ من الموعد الأوّل للقاءٍ واحد تُقبل — والأوّلُ في العمود القديم', async () => {
    const res = await addSession({ title: 'لقاءُ الأسبوع الأوّل', ...on('2027-05-03'), moduleIds: ['ST-M1', 'ST-M2', 'ST-M3'] })
    expect(res.statusCode, res.body).toBe(201)
    const id = (res.json() as { session: { id: string } }).session.id
    const row = await prisma.cohortSession.findUniqueOrThrow({ where: { id } })
    expect(row.moduleIds).toEqual(['ST-M1', 'ST-M2', 'ST-M3'])
    expect(row.moduleId).toBe('ST-M1')
  })
})

describe('② ③ ولا لقاءَ لمحورٍ في غير وقته', () => {
  it('⚠️ محاورُ من مواعيدَ مختلفةٍ تُردّ — ويُسمّى كلُّ محورٍ بموعده', async () => {
    const count = await prisma.cohortSession.count({ where: { cohortId } })
    const res = await addSession({ title: 'عابرُ المواعيد', ...on('2027-05-04'), moduleIds: ['ST-M3', 'ST-M4'] })
    expect(res.statusCode, res.body).toBe(422)
    expect(res.json()).toMatchObject({ error: { code: 'outside_axis_time' } })
    const msg = (res.json() as { error: { message_ar: string } }).error.message_ar
    expect(msg).toContain('المحور 3 في الموعد 1')
    expect(msg).toContain('المحور 4 في الموعد 2')
    expect(await prisma.cohortSession.count({ where: { cohortId } }), 'حُفظ ما رُدّ').toBe(count)
  })

  it('⚠️ ويومٌ خارجَ موعد محوره يُردّ — ولو داخلَ مدّة الشعبة', async () => {
    const res = await addSession({ title: 'مبكّرٌ عن موعده', ...on('2027-05-04'), moduleIds: ['ST-M4'] })
    expect(res.statusCode, res.body).toBe(422)
    expect((res.json() as { error: { message_ar: string } }).error.message_ar).toContain('خارجَ موعد المحور 4')
    /* وفي موعده يُقبل — والحدُّ الوقتُ لا المحور */
    const ok = await addSession({ title: 'لقاءُ الرابع', ...on('2027-05-10'), moduleIds: ['ST-M4'] })
    expect(ok.statusCode, ok.body).toBe(201)
  })
})

describe('④ والربطُ بالحدّ نفسِه', () => {
  it('⚠️ يُضاف ما شاء من محاور موعده — ولا يُضاف محورٌ من موعدٍ آخر', async () => {
    const made = await addSession({ title: 'لقاءٌ ثانٍ للأسبوع الأوّل', ...on('2027-05-05'), moduleIds: ['ST-M1'] })
    expect(made.statusCode, made.body).toBe(201)
    const id = (made.json() as { session: { id: string } }).session.id

    const more = await patch(`/api/trainer/sessions/${id}/axes`, { moduleIds: ['ST-M1', 'ST-M2', 'ST-M3'] })
    expect(more.statusCode, more.body).toBe(200)
    const across = await patch(`/api/trainer/sessions/${id}/axes`, { moduleIds: ['ST-M1', 'ST-M5'] })
    expect(across.statusCode, across.body).toBe(422)
    const elsewhere = await patch(`/api/trainer/sessions/${id}/axes`, { moduleIds: ['ST-M6'] })
    expect(elsewhere.statusCode, elsewhere.body).toBe(422)
    expect((await prisma.cohortSession.findUniqueOrThrow({ where: { id } })).moduleIds, 'حُفظ ربطٌ مردود').toEqual(['ST-M1', 'ST-M2', 'ST-M3'])
  })

  it('⚠️ وما انعقد يُربط بأيّ محور — واقعةٌ لا مسودّة، كما في قائمة التجهيز', async () => {
    const held = await prisma.cohortSession.create({
      data: { cohortId, title: 'انعقد قبل المواعيد', startsAt: new Date('2026-01-10T17:00:00.000Z'), endsAt: new Date('2026-01-10T19:00:00.000Z') },
    })
    const res = await patch(`/api/trainer/sessions/${held.id}/axes`, { moduleIds: ['ST-M6'] })
    expect(res.statusCode, res.body).toBe(200)
    await prisma.cohortSession.delete({ where: { id: held.id } })
  })
})

describe('⑤ واللقاءُ الواحدُ يغطّي محاورَه كلَّها', () => {
  it('⚠️ لقاءُ الأسبوع الأوّل يُحسب لمحاوره الثلاثة — فالباقي اثنان', async () => {
    const ws = await plans.workspace(trainerUserId, cohortId)
    const row = ws.checklist.find((c) => c.key === 'sessions')!
    expect(row.labelAr).toContain('(4/6)')
    expect(row.done).toBe(false)
  })
})
