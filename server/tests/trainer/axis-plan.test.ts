/* ═══ خطُّ المحاور في الخادم — مواعيدُ تُحفظ، ولقاءاتٌ بمحاورها، ومهامُّ بمواعيدها ═══

   قرارُ صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦) وقراراتُه العشرة بكلمة «go». والقاعدةُ
   المحضةُ في `src/application/trainer/axis-timeline.ts`؛ وهنا ما يقع فعلا على
   قاعدةٍ حقيقيّةٍ وعبر المسالك:

   ① الخطّةُ تحفظ مواعيدَها وكرّاساتِها ومحاورَ مصادرها — لا يُسقطها المخطّطُ صامتا.
   ② اللقاءُ يُنشأ بمحوره أو محوريه، والأوّلُ في العمود القديم — وثلاثةٌ تُردّ.
   ③ الربطُ لا يُسقط المعتمَدَ إلى الانتظار، ولا يمسّ المبدئيَّ ولا الملغى.
   ④ المهمّةُ بمحورها تأخذ آخرَ موعده موعدا ما لم يُكتب غيرُه (⑥).
   ⑤ والإرسالُ يحجبه محورٌ بلا لقاءٍ مباشر — ويسمّيه.
   ⑧ وبعد الاعتماد يسري الربطُ فورا بلا اعتماد — ويصل المتعلّمَ في طلبه التالي.
   ⑨ والجلسةُ المسجّلةُ كذلك: محورُها يُكتب في المعتمَدة لحظةَ الحفظ، وما سواه مراجعة. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CohortPlanService, type TrainerPlanContent } from '../../services/cohort-plan.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import { periodBounds } from '../../../src/application/trainer/cohort-period'

let prisma: PrismaClient
let app: FastifyInstance
let plans: CohortPlanService
let trainerUserId = ''
let cookie = ''
let cohortId = ''

/* أربعةُ محاورَ في أربعة أسابيع — والمدّةُ في مستقبلٍ لا يمضي */
const PERIOD = { startsOn: '2027-03-07', endsOn: '2027-04-03' }
const IDS = ['AX-M1', 'AX-M2', 'AX-M3', 'AX-M4']
const SLOTS = [
  { startsOn: '2027-03-07', endsOn: '2027-03-13', moduleIds: ['AX-M1'], workbook: { url: 'https://x.test/wb-1.pdf' } },
  { startsOn: '2027-03-14', endsOn: '2027-03-20', moduleIds: ['AX-M2'], workbook: { url: 'https://x.test/wb-2.pdf' } },
  { startsOn: '2027-03-21', endsOn: '2027-03-27', moduleIds: ['AX-M3'], workbook: { url: 'https://x.test/wb-3.pdf' } },
  { startsOn: '2027-03-28', endsOn: '2027-04-03', moduleIds: ['AX-M4'], workbook: { bodyFileKey: 'wb-4-key', bodyFileName: 'wb-4.pdf' } },
]
const body = 'الشرحُ المكتوب الذي يقرؤه المتعلّمُ قبل اللقاء، وفيه ما يكفيه ليبدأ عملَه في هذا المحور.'
const content: TrainerPlanContent = {
  kind: 'trainer', summaryAr: 'شعبةٌ على خطّ المحاور', ...PERIOD,
  modules: IDS.map((moduleId, i) => ({ moduleId, titleAr: `المحور ${i + 1}`, bodyAr: body })),
  resources: [
    { title: 'مرجعُ المحور الثالث', url: 'https://x.test/ref-3', category: 'reading', moduleId: 'AX-M3' },
    { title: 'قراءةٌ قبل لقاء الرابع', url: 'https://x.test/pre-4', category: 'reading', moduleId: 'AX-M4', preReading: true },
  ],
  slots: SLOTS,
}
/** اليومُ الثاني من الموعد، الثامنةَ مساءً بعمّان (الخامسة بغرينتش) — ساعتان */
const when = (slot: number) => ({
  startsAt: `${SLOTS[slot].startsOn.slice(0, 8)}${String(Number(SLOTS[slot].startsOn.slice(8)) + 1).padStart(2, '0')}T17:00:00.000Z`,
  endsAt: `${SLOTS[slot].startsOn.slice(0, 8)}${String(Number(SLOTS[slot].startsOn.slice(8)) + 1).padStart(2, '0')}T19:00:00.000Z`,
})
const post = (url: string, payload: unknown) => app.inject({ method: 'POST', url, payload: payload as object, headers: { cookie } })
const patch = (url: string, payload: unknown) => app.inject({ method: 'PATCH', url, payload: payload as object, headers: { cookie } })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  plans = new CohortPlanService(prisma)
  const auth = new AuthService(prisma)

  const t = await auth.register('axis-trainer@test.local', 'Trainer#12345', 'مدرّبُ المحاور')
  trainerUserId = t.userId
  await auth.setRoles(trainerUserId, ['trainer'])
  cookie = `${SESSION_COOKIE}=${(await auth.login('axis-trainer@test.local', 'Trainer#12345')).token}`
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-AX-${Date.now()}`, fullName: 'مدرّبُ المحاور', email: 'axis-trainer@test.local', status: 'active', userId: trainerUserId },
  })
  const profile = await prisma.trainerProfile.create({ data: { userId: trainerUserId, applicationId: application.id } })

  const course = await prisma.course.findFirst({ select: { id: true } })
  /* حضوريّةٌ عمدا: الاعتمادُ لا يُنشئ اجتماعَ Zoom فلا شبكةَ في الاختبار */
  const cohort = await prisma.cohort.create({
    data: { courseId: course!.id, title: 'شعبةُ خطّ المحاور', status: 'draft', price: 100, currency: 'USD', deliveryMode: 'in_person', timezone: 'Asia/Amman' },
  })
  cohortId = cohort.id
  await prisma.cohortTrainer.create({ data: { cohortId, profileId: profile.id, role: 'lead', assignedBy: trainerUserId } })
})

afterAll(async () => { await app.close() })

describe('① الخطّةُ تحفظ مواعيدَها', () => {
  it('⚠️ المواعيدُ والكرّاساتُ ومحاورُ المصادر تمرّ من المسلك كما هي', async () => {
    const res = await app.inject({ method: 'PUT', url: `/api/trainer/cohorts/${cohortId}/plan`, payload: content as object, headers: { cookie } })
    expect(res.statusCode, res.body).toBe(200)
    const ws = await plans.workspace(trainerUserId, cohortId)
    expect(ws.plan?.content?.slots, 'سقطت المواعيدُ في المخطّط').toEqual(SLOTS)
    const [ref, pre] = ws.plan!.content!.resources
    expect(ref.moduleId).toBe('AX-M3')
    expect(pre.preReading, 'سقطت القراءةُ المسبقة').toBe(true)
    /* والمحاورُ ومواعيدُها وكرّاساتُها تامّةٌ في القائمة */
    const byKey = new Map(ws.checklist.map((c) => [c.key, c.done]))
    expect(byKey.get('modules')).toBe(true)
    expect(byKey.get('workbooks')).toBe(true)
    expect(byKey.get('sessions'), 'تمّت اللقاءاتُ بلا لقاء').toBe(false)
  })
})

describe('② اللقاءُ بمحوره أو محوريه', () => {
  it('⚠️ يُنشأ بمحوريه، والأوّلُ في العمود القديم', async () => {
    const res = await post(`/api/trainer/cohorts/${cohortId}/sessions`, { title: 'لقاءُ المحورين', ...when(0), moduleIds: ['AX-M1', 'AX-M2'] })
    expect(res.statusCode, res.body).toBe(201)
    const id = (res.json() as { session: { id: string } }).session.id
    const row = await prisma.cohortSession.findUniqueOrThrow({ where: { id } })
    expect(row.moduleIds).toEqual(['AX-M1', 'AX-M2'])
    expect(row.moduleId, 'العمودُ القديمُ لا يحمل أوّلَهما').toBe('AX-M1')
    await prisma.cohortSession.delete({ where: { id } })
  })

  it('⚠️ وثلاثةُ محاورَ للقاءٍ واحدٍ تُردّ — والمكرّرُ كذلك', async () => {
    const three = await post(`/api/trainer/cohorts/${cohortId}/sessions`, { title: 'ثلاثيّ', ...when(0), moduleIds: ['AX-M1', 'AX-M2', 'AX-M3'] })
    expect(three.statusCode).toBe(422)
    const twice = await post(`/api/trainer/cohorts/${cohortId}/sessions`, { title: 'مكرّر', ...when(0), moduleIds: ['AX-M1', 'AX-M1'] })
    expect(twice.statusCode).toBe(422)
    expect(await prisma.cohortSession.count({ where: { cohortId } }), 'حُفظ ما رُدّ').toBe(0)
  })
})

describe('③ الربطُ بنيةُ منهجٍ لا موعدُ حضور', () => {
  it('⚠️ لا يُسقط المعتمَدَ إلى الانتظار — ويُكتب أثرُه', async () => {
    const made = await post(`/api/trainer/cohorts/${cohortId}/sessions`, { title: 'لقاءُ الأوّل', ...when(0), moduleIds: ['AX-M1'] })
    const id = (made.json() as { session: { id: string } }).session.id
    await prisma.cohortSession.update({ where: { id }, data: { approvalState: 'approved', approvedAt: new Date() } })

    const res = await patch(`/api/trainer/sessions/${id}/axes`, { moduleIds: ['AX-M1', 'AX-M2'] })
    expect(res.statusCode, res.body).toBe(200)
    const row = await prisma.cohortSession.findUniqueOrThrow({ where: { id } })
    expect(row.approvalState, 'أُسقط المعتمَدُ إلى الانتظار لأجل رقم محور').toBe('approved')
    expect(row.moduleIds).toEqual(['AX-M1', 'AX-M2'])
    const audit = await prisma.auditEvent.findFirst({ where: { action: 'cohort.session.axes', entityId: id } })
    expect(audit, 'الربطُ بلا أثر').toBeTruthy()

    /* وبلا محورٍ يُردّ — «لكلّ لقاءٍ محورٌ أو محوران» — وثلاثةٌ كذلك */
    expect((await patch(`/api/trainer/sessions/${id}/axes`, { moduleIds: [] })).statusCode).toBe(422)
    expect((await patch(`/api/trainer/sessions/${id}/axes`, { moduleIds: ['AX-M1', 'AX-M2', 'AX-M3'] })).statusCode).toBe(422)
    expect((await prisma.cohortSession.findUniqueOrThrow({ where: { id } })).moduleIds, 'حُفظ ربطٌ مردود').toEqual(['AX-M1', 'AX-M2'])
    await patch(`/api/trainer/sessions/${id}/axes`, { moduleIds: ['AX-M1'] })
  })

  it('⚠️ والمبدئيُّ لا يُربط من باب المدرّب، ولا الملغى', async () => {
    const ph = await prisma.cohortSession.create({ data: { cohortId, title: 'الجلسة ١', startsAt: new Date('2027-03-08T17:00:00.000Z'), placeholder: true } })
    const r1 = await patch(`/api/trainer/sessions/${ph.id}/axes`, { moduleIds: ['AX-M1'] })
    expect(r1.statusCode).toBe(409)
    expect(r1.json()).toMatchObject({ error: { code: 'placeholder_session' } })
    const gone = await prisma.cohortSession.create({ data: { cohortId, title: 'مردود', startsAt: new Date('2027-03-09T17:00:00.000Z'), status: 'cancelled', approvalState: 'rejected' } })
    expect((await patch(`/api/trainer/sessions/${gone.id}/axes`, { moduleIds: ['AX-M1'] })).statusCode).toBe(409)
    await prisma.cohortSession.deleteMany({ where: { id: { in: [ph.id, gone.id] } } })
  })
})

describe('④ آخرُ موعد المهمّة آخرُ موعد محورها', () => {
  it('⚠️ بلا موعدٍ مكتوبٍ يُفترض آخرُ ثانيةٍ في موعد محورها بعمّان — والمكتوبُ يبقى', async () => {
    const res = await post(`/api/trainer/cohorts/${cohortId}/assessments`, { title: 'مهمّةُ المحور الثالث', type: 'assignment', moduleId: 'AX-M3' })
    expect(res.statusCode, res.body).toBe(201)
    const due = (res.json() as { dueAt: string }).dueAt
    expect(new Date(due).toISOString()).toBe(periodBounds(SLOTS[2]).to.toISOString())
    expect(new Date(due).toISOString()).toBe('2027-03-27T20:59:59.999Z')

    const mine = await post(`/api/trainer/cohorts/${cohortId}/assessments`, { title: 'بموعدٍ مكتوب', type: 'assignment', moduleId: 'AX-M3', dueAt: '2027-03-24T20:00:00.000Z' })
    expect(new Date((mine.json() as { dueAt: string }).dueAt).toISOString(), 'كُتب فوق ما كتبه بيده').toBe('2027-03-24T20:00:00.000Z')
  })

  it('وربطُ مهمّةٍ بلا موعدٍ بمحورها يمنحها آخرَ موعده — وما كُتب بيدٍ لا يُمسّ', async () => {
    const a = await prisma.cohortAssessment.create({ data: { cohortId, title: 'بلا محور', type: 'assignment' } })
    const r = await patch(`/api/trainer/assessments/${a.id}`, { moduleId: 'AX-M2' })
    expect(r.statusCode, r.body).toBe(200)
    const row = await prisma.cohortAssessment.findUniqueOrThrow({ where: { id: a.id } })
    expect(row.moduleId).toBe('AX-M2')
    expect(row.dueAt?.toISOString()).toBe(periodBounds(SLOTS[1]).to.toISOString())

    const hand = await prisma.cohortAssessment.create({ data: { cohortId, title: 'بموعده', type: 'assignment', dueAt: new Date('2027-03-15T10:00:00.000Z') } })
    await patch(`/api/trainer/assessments/${hand.id}`, { moduleId: 'AX-M2' })
    expect((await prisma.cohortAssessment.findUniqueOrThrow({ where: { id: hand.id } })).dueAt?.toISOString()).toBe('2027-03-15T10:00:00.000Z')
    await prisma.cohortAssessment.deleteMany({ where: { id: { in: [a.id, hand.id] } } })
  })
})

describe('⑤ الإرسالُ على خطّ المحاور', () => {
  it('⚠️ محورٌ بلا لقاءٍ مباشرٍ يحجب الإرسالَ ويُسمّى — وبلقائه يُرسَل', async () => {
    /* لقاءُ الأوّل قائمٌ من قبل؛ ولقاءان للثاني والثالث — والرابعُ بلا لقاء */
    for (const [slot, id] of [[1, 'AX-M2'], [2, 'AX-M3']] as const) {
      const r = await post(`/api/trainer/cohorts/${cohortId}/sessions`, { title: `لقاءُ ${id}`, ...when(slot), moduleIds: [id] })
      expect(r.statusCode, r.body).toBe(201)
    }
    await expect(plans.submit(trainerUserId, cohortId, true)).rejects.toMatchObject({
      code: 'stages_incomplete', message: expect.stringContaining('لقاءٌ لكلّ محورٍ في موعده (3/4)'),
    })

    const last = await post(`/api/trainer/cohorts/${cohortId}/sessions`, { title: 'لقاءُ الرابع', ...when(3), moduleIds: ['AX-M4'] })
    expect(last.statusCode, last.body).toBe(201)
    const sent = await plans.submit(trainerUserId, cohortId, true)
    expect(sent.status).toBe('submitted')
  })
})

/* ═══ ⑥ والمعتمِدُ يقرأ المنهجَ كاملا (المرحلة ٣) ═══

   «وهو ما سنقرؤه عند الموافقة». بطاقتُه كانت تقرأ الخطّةَ وحدَها — لا لقاءً
   ولا مهمّة. فصار مسلكُها يحمل لقاءاتِ الشعبة ومهامَّها ومدّتَها، وتُبنى منها
   الصفحةُ نفسُها التي قرأها المدرّبُ قبل الإرسال (`curriculumView`). */
describe('⑥ بطاقةُ المعتمِد تحمل المنهجَ كاملا', () => {
  it('⚠️ الخطّةُ ولقاءاتُها ومهامُّها ومدّتُها — وتُبنى منها الصفحةُ بمواعيدها', async () => {
    const { curriculumView } = await import('../../../src/application/trainer/curriculum-view')
    const card = await plans.latestForCohort(cohortId)
    expect(card).not.toBeNull()
    expect(card!.status).toBe('submitted')
    expect(card!.cohortTitle).toBe('شعبةُ خطّ المحاور')
    expect(card!.period).toEqual(PERIOD)
    expect(card!.sessions.length, 'البطاقةُ بلا لقاءات').toBeGreaterThanOrEqual(4)
    expect(card!.assessments.some((a) => a.moduleId === 'AX-M3'), 'البطاقةُ بلا مهامّ').toBe(true)

    const view = curriculumView({ title: card!.cohortTitle, period: card!.period, content: card!.content, sessions: card!.sessions, assessments: card!.assessments })
    expect(view.groups.map((g) => g.label)).toEqual(['المحور 1', 'المحور 2', 'المحور 3', 'المحور 4'])
    expect(view.groups.every((g) => g.meetings.length > 0), 'موعدٌ بلا لقاءٍ في صفحة المعتمِد').toBe(true)
    expect(view.groups[2].tasks.length).toBeGreaterThan(0)
  })
})

/* ═══ ⑦ والاعتمادُ يفتح التسجيلَ ويحدّ الالتحاق — والمراجعةُ لا تنقل النافذة (٣ج) ═══

   «التسجيلُ يُفتح بعد الاعتماد، ويُغلق يومَ البدء، والالتحاقُ المتأخّرُ حتّى
   الموعد الثاني» — و«بعد الاعتماد كلُّ تغييرٍ باعتماد». */
describe('⑦ الاعتمادُ يفتح التسجيلَ ويحدّ الالتحاق', () => {
  let adminId = ''
  beforeAll(async () => {
    adminId = (await prisma.user.create({ data: { email: `axis-admin-${Date.now()}@test.local`, displayName: 'المعتمِد', passwordHash: 'x' } })).id
  })

  it('⚠️ قبل الاعتماد لا تُفتح الشعبة — وتقول البطاقةُ لماذا', async () => {
    const { CohortService } = await import('../../services/cohort.service')
    const check = await new CohortService(prisma).openChecklist(cohortId)
    expect(check.missing, 'فُتحت شعبةٌ خطّةُ مدرّبها بانتظار الاعتماد').toContain('خطّةُ المدرّب لم تُعتمَد بعد — تُفتح الشعبةُ للتسجيل باعتمادها')
    expect((await plans.latestForCohort(cohortId))!.registration.awaitingPlan).toBe(true)
  })

  it('⚠️ وبالاعتماد يُكتب آخرُ الالتحاق — بدءُ الموعد الثاني بعمّان', async () => {
    const card = await plans.latestForCohort(cohortId)
    const r = await plans.decide(adminId, card!.id, true)
    expect(r.status).toBe('approved')
    const row = await prisma.cohort.findUniqueOrThrow({ where: { id: cohortId }, select: { joinClosesAt: true } })
    expect(row.joinClosesAt?.toISOString()).toBe(periodBounds(SLOTS[1]).from.toISOString())
    const after = await plans.latestForCohort(cohortId)
    expect(after!.registration).toEqual({ awaitingPlan: false, joinClosesAt: row.joinClosesAt })
    const { CohortService } = await import('../../services/cohort.service')
    expect((await new CohortService(prisma).openChecklist(cohortId)).missing).not.toContain('خطّةُ المدرّب لم تُعتمَد بعد — تُفتح الشعبةُ للتسجيل باعتمادها')
  })

  it('⚠️ والمراجعةُ لا تنقل نافذةَ الجدولة قبل اعتمادها — واعتمادُها ينقلها', async () => {
    const before = await prisma.cohort.findUniqueOrThrow({ where: { id: cohortId }, select: { scheduleWindowEnd: true } })
    /* مراجعةٌ تمدّ المدّةَ أسبوعا — وموعدُها الأخيرُ معها */
    const longer = { ...PERIOD, endsOn: '2027-04-10' }
    const revision: TrainerPlanContent = {
      ...content, ...longer,
      slots: SLOTS.map((x, i) => (i === SLOTS.length - 1 ? { ...x, endsOn: longer.endsOn } : x)),
    }
    await plans.savePlan(trainerUserId, cohortId, revision)
    const saved = await prisma.cohort.findUniqueOrThrow({ where: { id: cohortId }, select: { scheduleWindowEnd: true } })
    expect(saved.scheduleWindowEnd?.toISOString(), 'نقلت المراجعةُ النافذةَ قبل أن تُقرأ').toBe(before.scheduleWindowEnd?.toISOString())

    /* ويُختصر الإرسالُ هنا إلى حاله — قائمتُه محروسةٌ في ⑤ */
    const draft = await prisma.cohortDeliveryPlan.findFirstOrThrow({ where: { cohortId, status: 'draft' }, orderBy: { createdAt: 'desc' } })
    await prisma.cohortDeliveryPlan.update({ where: { id: draft.id }, data: { status: 'submitted' } })
    await plans.decide(adminId, draft.id, true)
    const approved = await prisma.cohort.findUniqueOrThrow({ where: { id: cohortId }, select: { scheduleWindowEnd: true } })
    expect(approved.scheduleWindowEnd?.toISOString()).toBe(periodBounds(longer).to.toISOString())
  })
})

/* ═══ ⑧ وبعد الاعتماد: الربطُ يسري فورا بلا اعتماد (٢٨ سبتمبر ٢٠٢٦) ═══

   سُئل صاحبُ المنصّة: أيحتاج تغييرُ محاور لقاءٍ بعد اعتماد الخطّة اعتمادَ
   الإدارة؟ فقال: «no need for admin approval for links… access to whatever».
   و③ يقيس الربطَ قبل الاعتماد؛ وهنا بعده، على خطّةٍ معتمَدةٍ ولقاءاتٍ اعتمدها
   اعتمادُها (⑦): لا انتظار، ولا مراجعة، والمتعلّمُ يرى أثرَه في طلبه التالي. */
describe('⑧ بعد الاعتماد: الربطُ يسري فورا بلا اعتماد', () => {
  it('⚠️ لا يُسقط المعتمَدَ ولا يفتح مراجعة — ومهامُّ المحور تُفتح للمتعلّم بلقائه الجديد', async () => {
    const { loadLearnerGate } = await import('../../services/learner-gate')
    const { assessmentOpensAt } = await import('../../../src/application/learning/cohort-gate')
    const session = await prisma.cohortSession.findFirstOrThrow({ where: { cohortId, title: 'لقاءُ AX-M3' } })
    expect(session.approvalState, 'لم يعتمد اعتمادُ الخطّة لقاءَها').toBe('approved')
    const latest = () => prisma.cohortDeliveryPlan.findFirstOrThrow({ where: { cohortId }, orderBy: { createdAt: 'desc' } })
    expect((await latest()).status).toBe('approved')
    const plansBefore = await prisma.cohortDeliveryPlan.count({ where: { cohortId } })

    /* قبل الربط: مهامُّ الرابع بعد لقائه هو، في يومه الثاني */
    const before = (await loadLearnerGate(prisma, cohortId))!.gate
    expect(assessmentOpensAt(before, 'AX-M4')?.toISOString()).toBe(new Date(when(3).endsAt).toISOString())

    const res = await patch(`/api/trainer/sessions/${session.id}/axes`, { moduleIds: ['AX-M3', 'AX-M4'] })
    expect(res.statusCode, res.body).toBe(200)

    const row = await prisma.cohortSession.findUniqueOrThrow({ where: { id: session.id } })
    expect(row.approvalState, 'أُسقط لقاءٌ معتمَدٌ إلى الانتظار لأجل ربط').toBe('approved')
    expect(row.approvedAt?.toISOString()).toBe(session.approvedAt?.toISOString())
    expect(await prisma.cohortDeliveryPlan.count({ where: { cohortId } }), 'فتح الربطُ مراجعةً للخطّة').toBe(plansBefore)
    expect((await latest()).status, 'أعاد الربطُ الخطّةَ إلى الاعتماد').toBe('approved')

    /* وبعده: لقاءُ الثالث يغطّي الرابعَ أيضا — فمهامُّه تُفتح أوّلَ موعده لا بعد لقائه هو */
    const after = (await loadLearnerGate(prisma, cohortId))!.gate
    expect(assessmentOpensAt(after, 'AX-M4')?.toISOString(), 'لم يصل الربطُ المتعلّمَ')
      .toBe(periodBounds(SLOTS[3]).from.toISOString())
  })
})

/* ═══ ⑨ والجلسةُ المسجّلةُ كذلك — محورُها يسري بلا اعتماد (٢٨ سبتمبر ٢٠٢٦) ═══

   ثمّ سُئل صاحبُ المنصّة عن الجلسة المسجّلة — ومحورُها في محتوى الخطّة لا على
   صفّ لقاء، فكان تغييرُه بعد الاعتماد مراجعةً تنتظر — فقال: «no need for
   approval for this!». فحفظُ الخطّة يكتب محورَها في المعتمَدة لحظتَه، وما سواه
   في الحفظ نفسِه مراجعةٌ كما كان — ويومُ فتحها منه: موعدٌ كموعد اللقاء
   (`recorded-links.ts`). */
describe('⑨ محورُ الجلسة المسجّلة يسري بلا اعتماد', () => {
  const REC = {
    title: 'تسجيلُ المحور الثالث', url: 'https://x.test/rec-3', category: 'recorded', kind: 'video',
    moduleId: 'AX-M3', opensAt: '2027-03-21T09:00:00.000Z',
  }
  const approvedContent = async () =>
    (await prisma.cohortDeliveryPlan.findFirstOrThrow({ where: { cohortId, status: 'approved' } })).content as unknown as TrainerPlanContent
  const recOf = (c: TrainerPlanContent) => c.resources.find((r) => r.url === REC.url)!
  const withRec = (c: TrainerPlanContent, patch: Partial<typeof REC>) =>
    ({ ...c, resources: c.resources.map((r) => (r.url === REC.url ? { ...r, ...patch } : r)) })
  /** متى تُفتح للمتعلّم — من بوّابته هو، بالخطّة التي يراها */
  const opensForLearner = async () => {
    const { loadLearnerGate } = await import('../../services/learner-gate')
    const loaded = (await loadLearnerGate(prisma, cohortId))!
    return loaded.gate.timeline!.resourceOpensAt(recOf(loaded.plan!.content as TrainerPlanContent))?.toISOString()
  }

  beforeAll(async () => {
    /* خطّةٌ معتمَدةٌ فيها جلسةٌ مسجّلة — بالمسلك نفسِه: مراجعةٌ تُرسَل فتُعتمَد */
    const adminId = (await prisma.user.create({ data: { email: `axis-admin-rec-${Date.now()}@test.local`, displayName: 'المعتمِد', passwordHash: 'x' } })).id
    const base = await approvedContent()
    await plans.savePlan(trainerUserId, cohortId, { ...base, resources: [...base.resources, REC] })
    const draft = await prisma.cohortDeliveryPlan.findFirstOrThrow({ where: { cohortId, status: 'draft' }, orderBy: { createdAt: 'desc' } })
    await prisma.cohortDeliveryPlan.update({ where: { id: draft.id }, data: { status: 'submitted' } })
    await plans.decide(adminId, draft.id, true)
  })

  it('⚠️ محورُها وحدَه: يُكتب في المعتمَدة، ولا تُفتح مراجعة، والمتعلّمُ يراها في موعد محورها الجديد', async () => {
    const before = await approvedContent()
    expect(recOf(before).moduleId).toBe('AX-M3')
    expect(await opensForLearner(), 'تُفتح في يومها داخلَ موعدها').toBe(REC.opensAt)
    const plansBefore = await prisma.cohortDeliveryPlan.count({ where: { cohortId } })

    await plans.savePlan(trainerUserId, cohortId, withRec(before, { moduleId: 'AX-M4' }))

    expect(await prisma.cohortDeliveryPlan.count({ where: { cohortId } }), 'فتح ربطُ الجلسة المسجّلة مراجعةً').toBe(plansBefore)
    const after = await approvedContent()
    expect(recOf(after).moduleId, 'لم يُكتب المحورُ في المعتمَدة').toBe('AX-M4')
    expect(recOf(after).opensAt).toBe(REC.opensAt)
    /* وتُفتح أوّلَ موعد محورها الجديد — لا قبله */
    expect(await opensForLearner(), 'لم يصل الربطُ المتعلّمَ').toBe(periodBounds(SLOTS[3]).from.toISOString())
    const audit = await prisma.auditEvent.findFirst({ where: { action: 'cohort.plan.recorded_axes', entityId: cohortId }, orderBy: { createdAt: 'desc' } })
    expect((audit?.meta as { relinks?: unknown[] } | null)?.relinks, 'الربطُ بلا أثر')
      .toEqual([expect.objectContaining({ title: REC.title, from: 'AX-M3', to: 'AX-M4' })])
  })

  it('⚠️ ومعه تغييرٌ آخر: المحورُ يسري لحظتَه، والآخرُ مراجعةٌ تنتظر — لا يُقرأ فيها الربط', async () => {
    const { planDiff } = await import('../../../src/application/trainer/plan-diff')
    const before = await approvedContent()
    const renamed = 'المحورُ الأوّل بعنوانٍ جديد'
    const edited = withRec({ ...before, modules: before.modules.map((m, i) => (i === 0 ? { ...m, titleAr: renamed } : m)) }, { moduleId: 'AX-M3' })

    await plans.savePlan(trainerUserId, cohortId, edited)

    const after = await approvedContent()
    expect(recOf(after).moduleId, 'انتظر الربطُ مع غيره').toBe('AX-M3')
    expect(after.modules[0].titleAr, 'سرى تعديلٌ غيرُ الربط بلا اعتماد').toBe(before.modules[0].titleAr)
    const draft = await prisma.cohortDeliveryPlan.findFirstOrThrow({ where: { cohortId, status: 'draft' }, orderBy: { createdAt: 'desc' } })
    const lines = planDiff(after, draft.content, { date: String }).flatMap((s) => s.lines)
    expect(lines.join(' · ')).toContain(renamed)
    expect(lines.join(' · '), 'قرأ المعتمِدُ ربطا سرى من قبل').not.toContain(REC.title)
  })

  it('⚠️ ويومُ فتحها موعدٌ — ينتظر المراجعةَ كنقل اللقاء، ولو جاء مع ربطها في حفظٍ واحد', async () => {
    const draft = await prisma.cohortDeliveryPlan.findFirstOrThrow({ where: { cohortId, status: 'draft' }, orderBy: { createdAt: 'desc' } })
    const later = '2027-03-22T09:00:00.000Z'

    await plans.savePlan(trainerUserId, cohortId, withRec(draft.content as unknown as TrainerPlanContent, { moduleId: 'AX-M4', opensAt: later }))

    const approved = recOf(await approvedContent())
    expect(approved.moduleId, 'انتظر الربطُ مراجعةً مفتوحة').toBe('AX-M4')
    expect(approved.opensAt, 'سرى يومُ الفتح مع الربط بلا اعتماد').toBe(REC.opensAt)
    const kept = recOf((await prisma.cohortDeliveryPlan.findUniqueOrThrow({ where: { id: draft.id } })).content as unknown as TrainerPlanContent)
    expect(kept).toMatchObject({ moduleId: 'AX-M4', opensAt: later })
  })
})
