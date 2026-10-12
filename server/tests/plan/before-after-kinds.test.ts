/* ما كان يُطلب من المدرّب أن يعمله بنفسه — بطاقاتٌ «قبل/بعد» يقبلها أو يرفضها (١٢ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «i don't need any suggestions that would ask him to do something himself.. all must be
   before and after and he accept or reject». وهنا على قاعدةٍ حقيقيّة، كلُّ بابٍ جديدٍ من الرفع إلى القبول:

   ١) **عنوانُ الشعبة** (`cohort_title`) يُكتب على الشعبة حين يقبله.
   ٢) **نوعُ المهمّة** صار من حقول `task_change`، و**حذفُها** (`task_remove`) بابُ الحذف نفسُه.
   ٣) **لقاءٌ جديد** (`session_add`) يُجدوَل منتظِرا كما يُجدوله المدرّبُ بيده — ولا يقع على لقاءٍ قائم.
   ٤) **عنوانُ اللقاء وملاحظتُه** (`session_change`) — ويُكتب الأثر.
   ٥) **والرفضُ لا يمسّ شيئا**، وبندان على موضعٍ واحدٍ لا يُرفعان معا. */

import { beforeAll, describe, expect as vexpect, it } from 'vitest'
import { plainExpect } from '../helpers/plain-expect'
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
let profileId = ''

const login = async (email: string) => `${SESSION_COOKIE}=${(await auth.login(email, PASS)).token}`
const call = (method: 'GET' | 'POST', url: string, who: string, payload?: unknown) =>
  app.inject({ method, url, headers: { cookie: cookies[who] }, ...(payload !== undefined ? { payload: payload as never } : {}) })

const content = {
  kind: 'trainer',
  modules: [
    { moduleId: 'M1', titleAr: 'الجمهور', outcomeAr: 'يحلّل جمهوره' },
    { moduleId: 'M2', titleAr: 'الرسالة', outcomeAr: 'يصوغ رسالته' },
  ],
  resources: [],
  startsOn: '2026-12-06', endsOn: '2027-01-30',
}

/** شعبةٌ خطّتُها في يد مدرّبها، ومعها مهمّتان ولقاء */
async function inHand() {
  const course = await prisma.course.findFirstOrThrow({ select: { id: true } })
  const cohort = await prisma.cohort.create({
    data: {
      courseId: course.id, title: 'دورة العلاقات العامة — شعبة ١', status: 'draft', capacity: 20,
      scheduleWindowStart: new Date('2026-12-05T21:00:00.000Z'), scheduleWindowEnd: new Date('2027-01-30T20:59:59.999Z'),
    },
  })
  await prisma.cohortTrainer.create({ data: { cohortId: cohort.id, profileId, role: 'lead' } })
  const plan = await prisma.cohortDeliveryPlan.create({
    data: { cohortId: cohort.id, trainerId: profileId, status: 'changes_requested', submittedAt: new Date(), content: content as never },
  })
  const quiz = await prisma.cohortAssessment.create({ data: { cohortId: cohort.id, moduleId: 'M1', title: 'تحليل الجمهور', type: 'quiz', maxScore: 20 } })
  const twice = await prisma.cohortAssessment.create({ data: { cohortId: cohort.id, moduleId: 'M2', title: 'المشروع مرة ثانية', type: 'assignment', maxScore: 30 } })
  const session = await prisma.cohortSession.create({
    data: {
      cohortId: cohort.id, moduleIds: ['M1'], title: 'اللقاء الأول', noteAr: 'احضر وحدة التدريب على موقع آخر',
      startsAt: new Date('2026-12-07T16:00:00.000Z'), endsAt: new Date('2026-12-07T18:00:00.000Z'),
    },
  })
  return { cohortId: cohort.id, planId: plan.id, quizId: quiz.id, twiceId: twice.id, sessionId: session.id }
}

const upload = (planId: string, items: unknown[]) => call('POST', `/api/admin/cohort-plans/${planId}/edits`, 'admin', { items })
const approveAll = async (planId: string) =>
  expect((await call('POST', `/api/admin/cohort-plans/${planId}/edits/approve-all`, 'admin', {})).statusCode).toBe(200)
const idOf = async (planId: string, kind: string) => (await prisma.planEditSuggestion.findFirstOrThrow({ where: { planId, kind } })).id
const accept = (id: string) => call('POST', `/api/trainer/plan-edits/${id}/accept`, 'a', {})

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)
  const admin = await auth.register(`ba-admin-${STAMP}@test.local`, PASS, 'المعتمِد')
  await auth.setRoles(admin.userId, ['academic_manager'])
  cookies.admin = await login(`ba-admin-${STAMP}@test.local`)
  const email = `ba-a-${STAMP}@test.local`
  const u = await auth.register(email, PASS, 'مدرّب البطاقات')
  await auth.setRoles(u.userId, ['trainer'])
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `WJ-TR-BA-${STAMP}`, email, fullName: 'مدرّب البطاقات',
      phoneCountryCode: '+962', phone: `794${STAMP % 1000000}`, country: 'الأردن', status: 'active',
    },
  })
  profileId = (await prisma.trainerProfile.create({ data: { applicationId: application.id, userId: u.userId } })).id
  cookies.a = await login(email)
}, 240_000)

describe('من الرفع إلى القبول — كلّ باب جديد', () => {
  it('⚠️ عنوان الشعبة، ونوع المهمّة، وحذفها، ولقاء جديد، وملاحظة لقاء — تكتب حين يقبلها', async () => {
    const x = await inHand()
    const r = await upload(x.planId, [
      { kind: 'cohort_title', required: true, reasonAr: 'العنوان لا يطابق المحاور', titleAr: 'دورة التواصل المؤسسي — شعبة ١' },
      { kind: 'task_change', assessmentId: x.quizId, reasonAr: 'يقيم بعمل مكتوب لا باختبار', set: { type: 'assignment' } },
      { kind: 'task_remove', assessmentId: x.twiceId, required: true, reasonAr: 'تقيم مشروع التخرج مرة ثانية' },
      {
        kind: 'session_add', required: true, reasonAr: 'ساعات اللقاء أقل من المطلوب',
        session: { title: 'لقاء المحور 2', startsAt: '2026-12-14T16:00:00.000Z', endsAt: '2026-12-14T18:00:00.000Z', moduleIds: ['M2'], noteAr: 'أحضر رسالتك' },
      },
      { kind: 'session_change', sessionId: x.sessionId, required: true, reasonAr: 'الملاحظة ترسل المتعلم إلى موقع آخر', set: { noteAr: 'أحضر خريطة جمهورك' } },
    ])
    expect(r.statusCode, r.body).toBe(201)
    const views = (await call('GET', `/api/admin/cohorts/${x.cohortId}/plan-edits`, 'admin')).json() as { kind: string; view: { titleAr: string; rows: { beforeAr: string | null; afterAr: string | null }[] } }[]
    const v = (k: string) => views.find((e) => e.kind === k)!.view
    expect(v('cohort_title').rows[0]).toEqual(vexpect.objectContaining({ beforeAr: 'دورة العلاقات العامة — شعبة ١', afterAr: 'دورة التواصل المؤسسي — شعبة ١' }))
    expect(v('task_change').rows[0]).toEqual(vexpect.objectContaining({ beforeAr: 'اختبار', afterAr: 'واجب' }))
    expect(v('task_remove').titleAr).toBe('حذف مهمّة: «المشروع مرة ثانية»')
    expect(v('session_add').titleAr).toBe('لقاء جديد — المحور 2')
    expect(v('session_change').rows[0]).toEqual(vexpect.objectContaining({ beforeAr: 'احضر وحدة التدريب على موقع آخر', afterAr: 'أحضر خريطة جمهورك' }))

    await approveAll(x.planId)
    for (const k of ['cohort_title', 'task_change', 'task_remove', 'session_add', 'session_change']) {
      const a = await accept(await idOf(x.planId, k))
      expect(a.statusCode, `${k}: ${a.body}`).toBe(200)
    }
    expect((await prisma.cohort.findUniqueOrThrow({ where: { id: x.cohortId } })).title).toBe('دورة التواصل المؤسسي — شعبة ١')
    expect((await prisma.cohortAssessment.findUniqueOrThrow({ where: { id: x.quizId } })).type).toBe('assignment')
    expect(await prisma.cohortAssessment.findUnique({ where: { id: x.twiceId } }), 'بقيت المهمة المحذوفة').toBeNull()
    const added = await prisma.cohortSession.findFirstOrThrow({ where: { cohortId: x.cohortId, title: 'لقاء المحور 2' } })
    expect(added).toMatchObject({ approvalState: 'pending', noteAr: 'أحضر رسالتك', moduleIds: ['M2'] })
    expect(added.startsAt.toISOString()).toBe('2026-12-14T16:00:00.000Z')
    expect((await prisma.cohortSession.findUniqueOrThrow({ where: { id: x.sessionId } })).noteAr).toBe('أحضر خريطة جمهورك')
    expect(await prisma.auditEvent.count({ where: { action: 'cohort.session.details', entityId: x.sessionId } })).toBe(1)
  })
})

describe('والرفض لا يمسّ شيئا، والتعارض يردّ الملف', () => {
  it('⚠️ رفض عنوان الشعبة يبقيه كما هو', async () => {
    const x = await inHand()
    expect((await upload(x.planId, [{ kind: 'cohort_title', reasonAr: 'العنوان لا يطابق المحاور', titleAr: 'عنوان آخر للشعبة' }])).statusCode).toBe(201)
    await approveAll(x.planId)
    const r = await call('POST', `/api/trainer/plan-edits/${await idOf(x.planId, 'cohort_title')}/reject`, 'a', { noteAr: 'العنوان مناسب' })
    expect(r.statusCode, r.body).toBe(200)
    expect((await prisma.cohort.findUniqueOrThrow({ where: { id: x.cohortId } })).title).toBe('دورة العلاقات العامة — شعبة ١')
  })

  it('⚠️ حذف مهمة وتعديلها في ملف واحد يردّان — يقعان على موضع واحد', async () => {
    const x = await inHand()
    const r = await upload(x.planId, [
      { kind: 'task_remove', assessmentId: x.twiceId, reasonAr: 'مكررة' },
      { kind: 'task_change', assessmentId: x.twiceId, reasonAr: 'موعد أوضح', set: { dueAt: '2026-12-20T20:59:00.000Z' } },
    ])
    expect(r.statusCode).toBe(422)
    expect(r.json().error.message_ar).toMatch(/يقع على ما يقع عليه البند 1/)
  })

  it('⚠️ ولقاء جديد على لقاء قائم يردّ بسببه', async () => {
    const x = await inHand()
    const r = await upload(x.planId, [{
      kind: 'session_add', reasonAr: 'لقاء إضافي',
      session: { title: 'لقاء متعارض', startsAt: '2026-12-07T17:00:00.000Z', endsAt: '2026-12-07T19:00:00.000Z' },
    }])
    expect(r.statusCode).toBe(422)
    expect(r.json().error.message_ar).toMatch(/يقع اللقاء الجديد على لقاء «اللقاء الأول»/)
  })
})

describe('ولا يكتب على خطة تغيّرت بعد أن نزّلت (basedOn)', () => {
  it('⚠️ البند يحمل ما كتب عليه — يرفع ما دام الموضع كما هو', async () => {
    const x = await inHand()
    const r = await upload(x.planId, [{
      kind: 'module', moduleId: 'M1', reasonAr: 'مخرج أوضح', set: { outcomeAr: 'يرسم خريطة جمهوره' }, basedOn: { outcomeAr: 'يحلّل جمهوره' },
    }])
    expect(r.statusCode, r.body).toBe(201)
    const stored = await prisma.planEditSuggestion.findFirstOrThrow({ where: { planId: x.planId } })
    expect(stored.edit, 'حفظ ما كتب عليه في البند').not.toHaveProperty('basedOn')
  })

  it('⚠️ وعدّله المدرب بعد التنزيل — يردّ البند باسمه ولا يرفع شيء', async () => {
    const x = await inHand()
    const now = { ...content, modules: content.modules.map((m) => (m.moduleId === 'M1' ? { ...m, outcomeAr: 'نص كتبه المدرب بعد التنزيل' } : m)) }
    await prisma.cohortDeliveryPlan.update({ where: { id: x.planId }, data: { content: now as never } })
    const r = await upload(x.planId, [
      { kind: 'module', moduleId: 'M1', reasonAr: 'مخرج أوضح', set: { outcomeAr: 'يرسم خريطة جمهوره' }, basedOn: { outcomeAr: 'يحلّل جمهوره' } },
      { kind: 'task_change', assessmentId: x.quizId, reasonAr: 'موعد أوضح', set: { dueAt: '2026-12-20T20:59:00.000Z' }, basedOn: { dueAt: null } },
    ])
    expect(r.statusCode).toBe(422)
    expect(r.json().error.message_ar).toMatch(/البند 1: عدّل المدرب هذا الموضع بعد تنزيل الخطة/)
    expect(r.json().error.message_ar, 'ردّ ما لم يتغيّر').not.toMatch(/البند 2:/)
    expect(await prisma.planEditSuggestion.count({ where: { planId: x.planId } })).toBe(0)
  })
})
