/* ═══ مواعيدُ المحاور من لقاءاتها — عبر المسالك نفسِها التي تناديها الشاشة (١٧ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «خذ التوقيتَ من اللقاءات». والقاعدةُ المحضةُ في
   `src/application/trainer/axis-timeline.ts` ويحرسها `src/tests/trainer/meeting-timing.test.ts`؛
   وهنا أنّ الخادمَ يحكم بها:

   ① الخطّةُ تُحفظ معلَّمةً بلا مواعيد — وقائمةُ تجهيزها لا تطلبها.
   ② لقاءٌ يُضاف في غير ترتيب محاوره يُردّ لحظتَه — وبين جاريه يُقبل.
   ③ والربطُ بعد الإضافة بالحدّ نفسِه.
   ④ وآخرُ تسليمٍ افتراضيٌّ للمهمّة: اليومُ الذي يسبق أوّلَ لقاءٍ لما بعد محورها. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { AssessmentService } from '../../services/assessment.service'
import { CohortPlanService, type TrainerPlanContent } from '../../services/cohort-plan.service'
import { periodBounds } from '../../../src/application/trainer/cohort-period'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let app: FastifyInstance
let plans: CohortPlanService
let trainerUserId = ''
let cookie = ''
let cohortId = ''

const PERIOD = { startsOn: '2027-05-02', endsOn: '2027-05-29' }
const IDS = ['MT-M1', 'MT-M2', 'MT-M3', 'MT-M4']
const body = 'الشرحُ المكتوب الذي يقرؤه المتعلّمُ قبل اللقاء، وفيه ما يكفيه ليبدأ عملَه في هذا المحور.'
const content: TrainerPlanContent = {
  kind: 'trainer', timing: 'meetings', summaryAr: 'شعبةٌ تأخذ مواعيدَها من لقاءاتها', ...PERIOD,
  modules: IDS.map((moduleId, i) => ({ moduleId, titleAr: `المحور ${i + 1}`, bodyAr: body, activityAr: 'تطبيقٌ عمليٌّ قصير' })),
  resources: [{ title: 'مرجع', url: 'https://x.test/ref', category: 'reading', moduleId: 'MT-M1' }],
  workbook: { title: 'كرّاسةُ الدورة', url: 'https://x.test/wb.pdf', onTemplate: true },
}
/** الثامنةُ مساءً بعمّان (الخامسةُ بغرينتش) يومَ `day` — ساعتان */
const on = (day: string) => ({ startsAt: `${day}T17:00:00.000Z`, endsAt: `${day}T19:00:00.000Z` })
const post = (url: string, payload: unknown) => app.inject({ method: 'POST', url, payload: payload as object, headers: { cookie } })
const patch = (url: string, payload: unknown) => app.inject({ method: 'PATCH', url, payload: payload as object, headers: { cookie } })
const addSession = (title: string, day: string, moduleIds: string[]) =>
  post(`/api/trainer/cohorts/${cohortId}/sessions`, { title, ...on(day), moduleIds })
const message = (res: { json: () => unknown }) => (res.json() as { error: { message_ar: string } }).error.message_ar

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  plans = new CohortPlanService(prisma)
  const auth = new AuthService(prisma)

  const t = await auth.register('meeting-timing@test.local', 'Trainer#12345', 'مدرّبُ المواعيد من اللقاءات')
  trainerUserId = t.userId
  await auth.setRoles(trainerUserId, ['trainer'])
  cookie = `${SESSION_COOKIE}=${(await auth.login('meeting-timing@test.local', 'Trainer#12345')).token}`
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-MT-${Date.now()}`, fullName: 'مدرّبُ المواعيد من اللقاءات', email: 'meeting-timing@test.local', status: 'active', userId: trainerUserId },
  })
  const profile = await prisma.trainerProfile.create({ data: { userId: trainerUserId, applicationId: application.id } })
  const course = await prisma.course.findFirst({ select: { id: true } })
  /* حضوريّةٌ عمدا: لا اجتماعَ Zoom فلا شبكةَ في الاختبار */
  const cohort = await prisma.cohort.create({
    data: { courseId: course!.id, title: 'شعبةُ المواعيد من اللقاءات', status: 'draft', price: 100, currency: 'USD', deliveryMode: 'in_person', timezone: 'Asia/Amman' },
  })
  cohortId = cohort.id
  await prisma.cohortTrainer.create({ data: { cohortId, profileId: profile.id, role: 'lead', assignedBy: trainerUserId } })
}, 240_000)

afterAll(async () => { await app.close() })

describe('① تُحفظ معلّمة بلا مواعيد', () => {
  it('⚠️ العلامة تُحفظ — ولا مواعيد مكتوبة', async () => {
    const saved = await app.inject({ method: 'PUT', url: `/api/trainer/cohorts/${cohortId}/plan`, payload: content as object, headers: { cookie } })
    expect(saved.statusCode, saved.body).toBe(200)
    const row = await prisma.cohortDeliveryPlan.findFirstOrThrow({ where: { cohortId }, orderBy: { createdAt: 'desc' } })
    const c = row.content as { timing?: string; slots?: unknown }
    expect(c.timing, 'سقطت العلامة عند الحفظ').toBe('meetings')
    expect(c.slots ?? null).toBeNull()
    const ws = await plans.workspace(trainerUserId, cohortId)
    expect(ws.checklist.find((x) => x.key === 'modules')?.done, 'طلبت خطوة المحاور مواعيد').toBe(true)
  })
})

describe('② لقاء في غير ترتيب محاوره يُردّ لحظته', () => {
  it('⚠️ بعد لقاء لمحور لاحق يُردّ — وبين جاريه يُقبل', async () => {
    expect((await addSession('لقاء الأوّل', '2027-05-03', ['MT-M1'])).statusCode).toBe(201)
    expect((await addSession('لقاء الثالث', '2027-05-17', ['MT-M3'])).statusCode).toBe(201)
    const count = await prisma.cohortSession.count({ where: { cohortId } })
    const late = await addSession('لقاء الثاني متأخّرا', '2027-05-20', ['MT-M2'])
    expect(late.statusCode, late.body).toBe(422)
    expect(late.json()).toMatchObject({ error: { code: 'outside_axis_time' } })
    expect(message(late)).toContain('بعد لقاء في المحور 3')
    expect(await prisma.cohortSession.count({ where: { cohortId } }), 'حُفظ ما رُدّ').toBe(count)

    expect((await addSession('لقاء الثاني', '2027-05-10', ['MT-M2'])).statusCode).toBe(201)
    expect((await addSession('لقاء الرابع', '2027-05-24', ['MT-M4'])).statusCode).toBe(201)
    const ws = await plans.workspace(trainerUserId, cohortId)
    expect(ws.checklist.find((x) => x.key === 'sessions')?.done, 'لقاءات بترتيبها لم تتمّ الخطوة').toBe(true)
  })
})

describe('③ والربط بالحدّ نفسه', () => {
  it('⚠️ لقاء الرابع لا يُربط بالأوّل — فبعده لقاءا الثاني والثالث', async () => {
    const fourth = await prisma.cohortSession.findFirstOrThrow({ where: { cohortId, title: 'لقاء الرابع' } })
    const res = await patch(`/api/trainer/sessions/${fourth.id}/axes`, { moduleIds: ['MT-M1'] })
    expect(res.statusCode, res.body).toBe(422)
    expect(message(res)).toContain('بعد لقاء في المحور 2')
    expect((await prisma.cohortSession.findUniqueOrThrow({ where: { id: fourth.id } })).moduleIds).toEqual(['MT-M4'])
  })
})

describe('④ وآخر التسليم الافتراضيّ من اللقاءات', () => {
  it('⚠️ مهمّة المحور الثاني: آخر اليوم الذي يسبق لقاء الثالث', async () => {
    const task = await new AssessmentService(prisma).createAssessment(trainerUserId, {
      cohortId, title: 'مهمّة المحور الثاني', type: 'assignment', moduleId: 'MT-M2',
    }, { byTrainer: true })
    expect(task.dueAt?.toISOString()).toBe(periodBounds({ startsOn: '2027-05-16', endsOn: '2027-05-16' }).to.toISOString())
  })
})
