/* ═══ خطُّ المحاور في الخادم — مواعيدُ تُحفظ، ولقاءاتٌ بمحاورها، ومهامُّ بمواعيدها ═══

   قرارُ صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦) وقراراتُه العشرة بكلمة «go». والقاعدةُ
   المحضةُ في `src/application/trainer/axis-timeline.ts`؛ وهنا ما يقع فعلا على
   قاعدةٍ حقيقيّةٍ وعبر المسالك:

   ① الخطّةُ تحفظ مواعيدَها وكرّاساتِها ومحاورَ مصادرها — لا يُسقطها المخطّطُ صامتا.
   ② اللقاءُ يُنشأ بمحوره، والأوّلُ في العمود القديم — ومحاورُ من مواعيدَ مختلفةٍ تُردّ.
   ③ الربطُ لا يُسقط المعتمَدَ إلى الانتظار، ولا يمسّ المبدئيَّ ولا الملغى.

   ⚠️ وسقط سقفُ «محورٍ أو محورين» (٤ أكتوبر ٢٠٢٦): اللقاءُ لمحورٍ أو أكثر، والحدُّ
   الباقي وقتُه — محاورُه في موعدٍ واحدٍ وهو داخلَه. ولكلّ موعدٍ هنا محورٌ واحد،
   فاللقاءُ متعدّدُ المحاور في `session-axes-time.test.ts` بمواعيدَ تحمل أكثرَ من محور.
   ④ المهمّةُ بمحورها تأخذ آخرَ موعده موعدا ما لم يُكتب غيرُه (⑥).
   ⑤ والإرسالُ يحجبه محورٌ بلا لقاءٍ مباشر — ويسمّيه.
   ⑧ وبعد الاعتماد يسري الربطُ فورا بلا اعتماد — ويصل المتعلّمَ في طلبه التالي.
   ⑨ والجلسةُ المسجّلةُ كذلك: موضعُها — محورُها ويومُ فتحها — يُكتب في المعتمَدة لحظةَ
      الحفظ، وما سواه مراجعة. */

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
  /* وكرّاسةُ الدورة الواحدة، وموضعُ كلّ محورٍ فيها (٣٠ سبتمبر ٢٠٢٦) */
  workbook: { title: 'كرّاسةُ الدورة', url: 'https://x.test/wb.pdf', parts: IDS.map((moduleId, i) => ({ moduleId, whereAr: `ص ${i * 5 + 1}` })) },
  /* ومستواها — شرطُ الخطوة الأولى ما دامت الخطّةُ في يده (٦ أكتوبر ٢٠٢٦) */
  level: { from: 'intermediate', to: 'intermediate' },
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
    expect(ws.plan?.content?.workbook, 'سقطت كرّاسةُ الدورة أو خريطتُها في المخطّط').toEqual(content.workbook)
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

describe('② اللقاءُ بمحوره', () => {
  it('⚠️ يُنشأ بمحوره، والأوّلُ في العمود القديم', async () => {
    const res = await post(`/api/trainer/cohorts/${cohortId}/sessions`, { title: 'لقاءُ المحور', ...when(0), moduleIds: ['AX-M1'] })
    expect(res.statusCode, res.body).toBe(201)
    const id = (res.json() as { session: { id: string } }).session.id
    const row = await prisma.cohortSession.findUniqueOrThrow({ where: { id } })
    expect(row.moduleIds).toEqual(['AX-M1'])
    expect(row.moduleId, 'العمودُ القديمُ لا يحمل محورَه').toBe('AX-M1')
    await prisma.cohortSession.delete({ where: { id } })
  })

  it('⚠️ ومحاورُ من مواعيدَ مختلفةٍ للقاءٍ واحدٍ تُردّ — والمكرّرُ كذلك', async () => {
    const three = await post(`/api/trainer/cohorts/${cohortId}/sessions`, { title: 'ثلاثيّ', ...when(0), moduleIds: ['AX-M1', 'AX-M2', 'AX-M3'] })
    expect(three.statusCode).toBe(422)
    expect(three.json()).toMatchObject({ error: { message_ar: expect.stringContaining('من مواعيدَ مختلفة') } })
    const twice = await post(`/api/trainer/cohorts/${cohortId}/sessions`, { title: 'مكرّر', ...when(0), moduleIds: ['AX-M1', 'AX-M1'] })
    expect(twice.statusCode).toBe(422)
    expect(await prisma.cohortSession.count({ where: { cohortId } }), 'حُفظ ما رُدّ').toBe(0)
  })
})

describe('③ الربطُ بنيةُ منهجٍ لا موعدُ حضور', () => {
  it('⚠️ لا يُسقط المعتمَدَ إلى الانتظار — ويُكتب أثرُه', async () => {
    /* لقاءٌ جُدول بلا محور (كما قبل المواعيد) ثمّ اعتُمد — وربطُه بمحور موعده */
    const made = await post(`/api/trainer/cohorts/${cohortId}/sessions`, { title: 'لقاءُ الأوّل', ...when(0) })
    const id = (made.json() as { session: { id: string } }).session.id
    await prisma.cohortSession.update({ where: { id }, data: { approvalState: 'approved', approvedAt: new Date() } })

    const res = await patch(`/api/trainer/sessions/${id}/axes`, { moduleIds: ['AX-M1'] })
    expect(res.statusCode, res.body).toBe(200)
    const row = await prisma.cohortSession.findUniqueOrThrow({ where: { id } })
    expect(row.approvalState, 'أُسقط المعتمَدُ إلى الانتظار لأجل رقم محور').toBe('approved')
    expect(row.moduleIds).toEqual(['AX-M1'])
    const audit = await prisma.auditEvent.findFirst({ where: { action: 'cohort.session.axes', entityId: id } })
    expect(audit, 'الربطُ بلا أثر').toBeTruthy()

    /* وبلا محورٍ يُردّ، ومحورٌ في غير وقته يُردّ (٤ أكتوبر ٢٠٢٦) — ولا يُحفظ شيء */
    expect((await patch(`/api/trainer/sessions/${id}/axes`, { moduleIds: [] })).statusCode).toBe(422)
    expect((await patch(`/api/trainer/sessions/${id}/axes`, { moduleIds: ['AX-M1', 'AX-M2'] })).statusCode).toBe(422)
    expect((await prisma.cohortSession.findUniqueOrThrow({ where: { id } })).moduleIds, 'حُفظ ربطٌ مردود').toEqual(['AX-M1'])
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
    /* ومشروعُ التخرّج صفٌّ إلزاميّ (٣٠ سبتمبر ٢٠٢٦) — يحجب حتّى يوضع */
    await expect(plans.submit(trainerUserId, cohortId, true)).rejects.toMatchObject({ code: 'stages_incomplete', message: expect.stringContaining('مشروعَ التخرّج') })
    const project = await post(`/api/trainer/cohorts/${cohortId}/assessments`, { title: 'مشروعُ التخرّج', type: 'project', moduleId: 'AX-M4' })
    expect(project.statusCode, project.body).toBe(201)
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
    const row = await prisma.cohort.findUniqueOrThrow({ where: { id: cohortId }, select: { joinClosesAt: true, registrationOpen: true } })
    expect(row.joinClosesAt?.toISOString()).toBe(periodBounds(SLOTS[1]).from.toISOString())
    const after = await plans.latestForCohort(cohortId)
    /* وعلمُ الشعبة معهما كما هو في صفّها (٣ أكتوبر ٢٠٢٦) — الاعتمادُ لا يرفعه، ومنه
       تقول المراجعةُ «مفتوح» أو «مغلقٌ حتّى تفتحها» (`registration-state.ts`) */
    expect(after!.registration).toEqual({ awaitingPlan: false, joinClosesAt: row.joinClosesAt, registrationOpen: row.registrationOpen })
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
    const latest = () => prisma.cohortDeliveryPlan.findFirstOrThrow({ where: { cohortId }, orderBy: { createdAt: 'desc' } })
    expect((await latest()).status).toBe('approved')
    const plansBefore = await prisma.cohortDeliveryPlan.count({ where: { cohortId } })
    /* لقاءٌ معتمَدٌ أوّلَ يومٍ في موعد الرابع بلا محورٍ بعد. وكان هذا الاختبارُ يربط لقاءَ
       الثالث بالرابع، ثمّ صار الربطُ في وقت المحور وحدَه (٤ أكتوبر ٢٠٢٦، الاختبارُ التالي) */
    const session = await prisma.cohortSession.create({
      data: {
        cohortId, title: 'لقاءٌ أوّلَ موعد الرابع', startsAt: new Date('2027-03-28T17:00:00.000Z'), endsAt: new Date('2027-03-28T19:00:00.000Z'),
        approvalState: 'approved', approvedAt: new Date(), moduleIds: [],
      },
    })

    /* قبل الربط: مهامُّ الرابع بعد لقائه هو، في يومه الثاني */
    const before = (await loadLearnerGate(prisma, cohortId))!.gate
    expect(assessmentOpensAt(before, 'AX-M4')?.toISOString()).toBe(new Date(when(3).endsAt).toISOString())

    const res = await patch(`/api/trainer/sessions/${session.id}/axes`, { moduleIds: ['AX-M4'] })
    expect(res.statusCode, res.body).toBe(200)

    const row = await prisma.cohortSession.findUniqueOrThrow({ where: { id: session.id } })
    expect(row.approvalState, 'أُسقط لقاءٌ معتمَدٌ إلى الانتظار لأجل ربط').toBe('approved')
    expect(row.approvedAt?.toISOString()).toBe(session.approvedAt?.toISOString())
    expect(await prisma.cohortDeliveryPlan.count({ where: { cohortId } }), 'فتح الربطُ مراجعةً للخطّة').toBe(plansBefore)
    expect((await latest()).status, 'أعاد الربطُ الخطّةَ إلى الاعتماد').toBe('approved')

    /* وبعده: لقاءُ اليوم الأوّل يغطّي الرابع — فمهامُّه تُفتح بانتهائه لا بعد لقاء يومه الثاني */
    const after = (await loadLearnerGate(prisma, cohortId))!.gate
    expect(assessmentOpensAt(after, 'AX-M4')?.toISOString(), 'لم يصل الربطُ المتعلّمَ')
      .toBe('2027-03-28T19:00:00.000Z')
  })

  it('⚠️ ولا يضع لقاءً في غير وقت محوره — ولو بعد الاعتماد بلا عينٍ تراه (٤ أكتوبر ٢٠٢٦)', async () => {
    const session = await prisma.cohortSession.findFirstOrThrow({ where: { cohortId, title: 'لقاءُ AX-M3' } })
    const res = await patch(`/api/trainer/sessions/${session.id}/axes`, { moduleIds: ['AX-M3', 'AX-M4'] })
    expect(res.statusCode, res.body).toBe(422)
    expect(res.json()).toMatchObject({ error: { code: 'outside_axis_time', message_ar: expect.stringContaining('الموعد 4') } })
    expect((await prisma.cohortSession.findUniqueOrThrow({ where: { id: session.id } })).moduleIds, 'حُفظ ربطٌ في غير وقته').toEqual(['AX-M3'])
  })
})

/* ═══ ⑨ والجلسةُ المسجّلةُ كذلك — موضعُها يسري بلا اعتماد (٢٨ سبتمبر ٢٠٢٦) ═══

   ثمّ سُئل صاحبُ المنصّة عن الجلسة المسجّلة — وموضعُها في محتوى الخطّة لا على
   صفّ لقاء، فكان تغييرُه بعد الاعتماد مراجعةً تنتظر — فقال: «no need for
   approval for this!» فسرى محورُها (#330)، ثمّ: «free the recording's opening
   day too». وكان ثالثُ اختباراتها يحرس أنّ يومَ الفتح ينتظر؛ فتغيّر القرارُ فتغيّر حارسُه.
   فحفظُ الخطّة يكتب موضعَها في المعتمَدة لحظتَه — إن كان موضعا صحيحا فيها — وما
   سواه في الحفظ نفسِه مراجعةٌ كما كان (`recorded-links.ts`). */
describe('⑨ موضعُ الجلسة المسجّلة يسري بلا اعتماد', () => {
  const REC = {
    title: 'تسجيلُ المحور الثالث', url: 'https://x.test/rec-3', category: 'recorded', kind: 'video',
    moduleId: 'AX-M3', opensAt: '2027-03-21T09:00:00.000Z',
  }
  const approvedContent = async () =>
    (await prisma.cohortDeliveryPlan.findFirstOrThrow({ where: { cohortId, status: 'approved' } })).content as unknown as TrainerPlanContent
  const latestDraft = () => prisma.cohortDeliveryPlan.findFirstOrThrow({ where: { cohortId, status: 'draft' }, orderBy: { createdAt: 'desc' } })
  const recOf = (c: unknown) => (c as TrainerPlanContent).resources.find((r) => r.url === REC.url)!
  const withRec = (c: unknown, patch: Partial<typeof REC>) => {
    const plan = c as TrainerPlanContent
    return { ...plan, resources: plan.resources.map((r) => (r.url === REC.url ? { ...r, ...patch } : r)) }
  }
  /** متى تُفتح للمتعلّم — من بوّابته هو، بالخطّة التي يراها */
  const opensForLearner = async () => {
    const { loadLearnerGate } = await import('../../services/learner-gate')
    const loaded = (await loadLearnerGate(prisma, cohortId))!
    return loaded.gate.timeline!.resourceOpensAt(recOf(loaded.plan!.content))?.toISOString()
  }

  beforeAll(async () => {
    /* خطّةٌ معتمَدةٌ فيها جلسةٌ مسجّلة — بالمسلك نفسِه: مراجعةٌ تُرسَل فتُعتمَد */
    const adminId = (await prisma.user.create({ data: { email: `axis-admin-rec-${Date.now()}@test.local`, displayName: 'المعتمِد', passwordHash: 'x' } })).id
    const base = await approvedContent()
    await plans.savePlan(trainerUserId, cohortId, { ...base, resources: [...base.resources, REC] })
    const draft = await latestDraft()
    await prisma.cohortDeliveryPlan.update({ where: { id: draft.id }, data: { status: 'submitted' } })
    await plans.decide(adminId, draft.id, true)
  })

  it('⚠️ نقلُها إلى محورٍ آخرَ بيومٍ في موعده: يُكتب في المعتمَدة، ولا تُفتح مراجعة، والمتعلّمُ يراها في يومها الجديد', async () => {
    const before = await approvedContent()
    expect(recOf(before).moduleId).toBe('AX-M3')
    expect(await opensForLearner(), 'تُفتح في يومها داخلَ موعدها').toBe(REC.opensAt)
    const plansBefore = await prisma.cohortDeliveryPlan.count({ where: { cohortId } })
    const inFourth = '2027-03-29T09:00:00.000Z'

    await plans.savePlan(trainerUserId, cohortId, withRec(before, { moduleId: 'AX-M4', opensAt: inFourth }))

    expect(await prisma.cohortDeliveryPlan.count({ where: { cohortId } }), 'فتح نقلُ الجلسة المسجّلة مراجعةً').toBe(plansBefore)
    expect(recOf(await approvedContent()), 'لم يُكتب الموضعُ في المعتمَدة').toMatchObject({ moduleId: 'AX-M4', opensAt: inFourth })
    expect(await opensForLearner(), 'لم يصل النقلُ المتعلّمَ').toBe(inFourth)
    const audit = await prisma.auditEvent.findFirst({ where: { action: 'cohort.plan.recorded_placement', entityId: cohortId }, orderBy: { createdAt: 'desc' } })
    expect((audit?.meta as { placements?: unknown[] } | null)?.placements, 'النقلُ بلا أثر').toEqual([expect.objectContaining({
      title: REC.title, moduleId: { from: 'AX-M3', to: 'AX-M4' }, opensAt: { from: REC.opensAt, to: inFourth },
    })])
  })

  it('⚠️ ومعه تغييرٌ آخر: الموضعُ يسري لحظتَه، والآخرُ مراجعةٌ تنتظر — لا يُقرأ فيها الموضع', async () => {
    const { planDiff } = await import('../../../src/application/trainer/plan-diff')
    const before = await approvedContent()
    const renamed = 'المحورُ الأوّل بعنوانٍ جديد'
    const edited = withRec(
      { ...before, modules: before.modules.map((m, i) => (i === 0 ? { ...m, titleAr: renamed } : m)) },
      { moduleId: 'AX-M3', opensAt: REC.opensAt },
    )

    await plans.savePlan(trainerUserId, cohortId, edited)

    const after = await approvedContent()
    expect(recOf(after), 'انتظر الموضعُ مع غيره').toMatchObject({ moduleId: 'AX-M3', opensAt: REC.opensAt })
    expect(after.modules[0].titleAr, 'سرى تعديلٌ غيرُ الموضع بلا اعتماد').toBe(before.modules[0].titleAr)
    const lines = planDiff(after, (await latestDraft()).content, { date: String }).flatMap((s) => s.lines)
    expect(lines.join(' · ')).toContain(renamed)
    expect(lines.join(' · '), 'قرأ المعتمِدُ موضعا سرى من قبل').not.toContain(REC.title)
  })

  it('⚠️ ويومُ فتحها وحدَه يسري كذلك — والمراجعةُ مفتوحة (وكان ينتظرها قبل القرار)', async () => {
    const draft = await latestDraft()
    const later = '2027-03-23T09:00:00.000Z'

    await plans.savePlan(trainerUserId, cohortId, withRec(draft.content, { opensAt: later }))

    expect(recOf(await approvedContent()).opensAt, 'انتظر يومُ الفتح اعتمادا').toBe(later)
    expect(await opensForLearner()).toBe(later)
    expect(recOf((await prisma.cohortDeliveryPlan.findUniqueOrThrow({ where: { id: draft.id } })).content).opensAt).toBe(later)
  })

  it('⚠️ ويومٌ خارجَ موعد محورها يبقى في المراجعة — بقاعدة الإرسال نفسِها', async () => {
    const draft = await latestDraft()
    const outside = '2027-03-30T09:00:00.000Z'

    await plans.savePlan(trainerUserId, cohortId, withRec(draft.content, { opensAt: outside }))

    expect(recOf(await approvedContent()).opensAt, 'سرى يومٌ خارجَ موعد محورها').toBe('2027-03-23T09:00:00.000Z')
    expect(recOf((await prisma.cohortDeliveryPlan.findUniqueOrThrow({ where: { id: draft.id } })).content).opensAt).toBe(outside)
  })
})
