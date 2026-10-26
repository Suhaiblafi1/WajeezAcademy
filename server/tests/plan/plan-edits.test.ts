/* تعديلاتٌ تقترحها الإدارةُ على خطّة المدرّب — يقبل كلًّا أو يرفضه (٨ أكتوبر ٢٠٢٦).

   «التعديلُ معقّدٌ وقد يطول على المدرّب… ألا تكون التعديلاتُ منّا وهو يوافق أو يرفض لكلّ
   تعديل؟» (صاحب المنصّة). وهنا على قاعدةٍ حقيقيّة:

   ١) **الرفعُ للمعتمِد وحدَه، ويُقبل كلُّه أو يُردّ كلُّه ببنوده** — لا يصل المدرّبَ ما لا يقع.
   ٢) **الردُّ بالتعديلات وحدَها يكفي سببا**، ويقول الجرسُ كم هي وكم منها مطلوب.
   ٣) **القبولُ حفظٌ منه بأبوابه**: يُكتب في الخطّة والمهمّة واللقاء — ولا يُقبل وهي بانتظار القرار.
   ٤) **لا يُكتب فوق ما كتبه بيده بلا علمه** — يختار أن يُكتب فوقه، أو يرفض.
   ٥) **الرفضُ لا يمسّ شيئا**، ولا يُقرَّر في بندٍ مرّتين، ولا يقرّر فيه غيرُ مدرّب الشعبة.
   ٦) **السحبُ والاعتماد** يُسقطان ما لم يُقرَّر فيه.
   ٧) **ولا يصل المدرّبَ ما لم تعتمده الإدارة** (١٠ أكتوبر ٢٠٢٦): المرفوعُ مسوّدةٌ لا يراها
      ولا يقرّر فيها، تعتمدها الإدارةُ بندا بندا أو تحذفها — ولا تُعدّ سببا للردّ. */

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
let cohortId = ''
let planId = ''
let trainerUserId = ''
let profileId = ''
let taskId = ''
let sessionId = ''
let adminUserId = ''

const login = async (email: string) => `${SESSION_COOKIE}=${(await auth.login(email, PASS)).token}`
const call = (method: 'GET' | 'POST' | 'DELETE', url: string, who: string, payload?: unknown) =>
  app.inject({ method, url, headers: { cookie: cookies[who] }, ...(payload !== undefined ? { payload: payload as never } : {}) })

const PERIOD = { startsOn: '2026-12-06', endsOn: '2027-01-30' }
const content = {
  kind: 'trainer',
  modules: [
    { moduleId: 'M1', titleAr: 'الجمهور', outcomeAr: 'يحلّل جمهوره', artifactAr: 'خريطة' },
    { moduleId: 'M2', titleAr: 'الرسالة', outcomeAr: 'يصوغ رسالته', artifactAr: null },
  ],
  resources: [{ title: 'CIPR', url: 'https://cipr.co.uk/a', category: 'public', kind: 'link', moduleId: 'M1' }],
  ...PERIOD,
}

async function register(tag: string) {
  const email = `pe-${tag}-${STAMP}@test.local`
  const u = await auth.register(email, PASS, `مدرّب ${tag}`)
  await auth.setRoles(u.userId, ['trainer'])
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `WJ-TR-PE-${tag}-${STAMP}`, email, fullName: `مدرّب ${tag}`,
      phoneCountryCode: '+962', phone: `79${tag === 'a' ? 5 : 6}${STAMP % 1000000}`, country: 'الأردن', status: 'active',
    },
  })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: application.id, userId: u.userId } })
  cookies[tag] = await login(email)
  return { userId: u.userId, profileId: profile.id }
}

async function submittedPlan() {
  const course = await prisma.course.findFirstOrThrow({ select: { id: true } })
  const cohort = await prisma.cohort.create({
    data: {
      courseId: course.id, title: 'شعبةُ العلاقات العامّة — تعديلاتٌ مقترحة', status: 'draft', capacity: 20,
      scheduleWindowStart: new Date('2026-12-05T21:00:00.000Z'), scheduleWindowEnd: new Date('2027-01-30T20:59:59.999Z'),
    },
  })
  await prisma.cohortTrainer.create({ data: { cohortId: cohort.id, profileId, role: 'lead' } })
  const plan = await prisma.cohortDeliveryPlan.create({
    data: { cohortId: cohort.id, trainerId: profileId, status: 'submitted', submittedAt: new Date(), content: content as never },
  })
  return { cohortId: cohort.id, planId: plan.id }
}

const goodFile = () => ({
  format: 'wajeez.plan-edits/1', planId,
  items: [
    { kind: 'module', moduleId: 'M2', required: true, reasonAr: 'المحور 2 بلا مُسلَّم', set: { artifactAr: 'رسالةٌ أساسيّةٌ في صفحةٍ واحدة' } },
    { kind: 'resource_add', required: true, reasonAr: 'المحور 2 بلا مصدر', resource: { title: 'الرسالة الإعلانية', url: 'https://hbrarabic.com/x', moduleId: 'M2' } },
    { kind: 'task_change', assessmentId: taskId, reasonAr: 'الواجبُ قبل لقائه', set: { dueAt: '2026-12-12T20:59:00.000Z' } },
    { kind: 'session_move', sessionId, reasonAr: 'بعد الدوام', startsAt: '2026-12-07T16:00:00.000Z', endsAt: '2026-12-07T18:00:00.000Z' },
    /* وبندٌ تحذفه الإدارةُ قبل أن يصل المدرّب (٧) */
    { kind: 'resource_add', reasonAr: 'مصدرٌ ثانٍ للمحور 1', resource: { title: 'مقالٌ لا يناسب', url: 'https://example.com/x', moduleId: 'M1' } },
  ],
})

const editsOf = async (who = 'a') => (await call('GET', `/api/trainer/cohorts/${cohortId}/plan-edits`, who)).json() as {
  id: string; kind: string; status: string; stale: boolean; view: { titleAr: string; rows: { beforeAr: string | null; afterAr: string | null }[] }
}[]
const byKind = async (kind: string) => (await editsOf()).find((x) => x.kind === kind)!

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)

  const admin = await auth.register(`pe-admin-${STAMP}@test.local`, PASS, 'المعتمِد')
  await auth.setRoles(admin.userId, ['academic_manager'])
  cookies.admin = await login(`pe-admin-${STAMP}@test.local`)
  adminUserId = admin.userId
  /* مديرُ العمليّات يدير الشعبَ ولا يراجع التعديلات (٧) */
  const ops = await auth.register(`pe-ops-${STAMP}@test.local`, PASS, 'مدير العمليّات')
  await auth.setRoles(ops.userId, ['operations_manager'])
  cookies.ops = await login(`pe-ops-${STAMP}@test.local`)

  ;({ userId: trainerUserId, profileId } = await register('a'))
  await register('b')
  ;({ cohortId, planId } = await submittedPlan())
  taskId = (await prisma.cohortAssessment.create({
    data: { cohortId, moduleId: 'M1', title: 'خريطةُ أصحاب المصلحة', type: 'assignment', maxScore: 20, dueAt: new Date('2026-12-07T20:59:00.000Z') },
  })).id
  sessionId = (await prisma.cohortSession.create({
    data: { cohortId, moduleId: 'M1', title: 'اللقاء الأوّل', startsAt: new Date('2026-12-07T10:00:00.000Z'), endsAt: new Date('2026-12-07T12:00:00.000Z'), approvalState: 'pending' },
  })).id
}, 240_000)

describe('١ — الرفعُ للمعتمِد، ويُقبل كلُّه أو يُردّ كلُّه', () => {
  it('⚠️ المدرّبُ لا يرفع تعديلاتٍ على خطّته', async () => {
    expect((await call('POST', `/api/admin/cohort-plans/${planId}/edits`, 'a', goodFile())).statusCode).toBe(403)
  })

  it('⚠️ بندٌ لا يقع يردّ الملفَّ كلَّه ببنده وسببه — ولا يُحفظ شيء', async () => {
    const f = goodFile()
    f.items.push({ kind: 'module', moduleId: 'M9', reasonAr: 'محورٌ مجهول', set: { artifactAr: 'x' } } as never)
    const r = await call('POST', `/api/admin/cohort-plans/${planId}/edits`, 'admin', f)
    expect(r.statusCode).toBe(422)
    expect(r.json().error.message_ar).toMatch(/البند 6: لا محورَ «M9»/)
    expect(await prisma.planEditSuggestion.count({ where: { planId } })).toBe(0)
  })

  it('⚠️ وبندان على موضعٍ واحدٍ لا يُرفعان معا', async () => {
    const f = goodFile()
    f.items.push({ kind: 'module', moduleId: 'M2', reasonAr: 'مرّةً ثانية', set: { artifactAr: 'غيرُه' } } as never)
    const r = await call('POST', `/api/admin/cohort-plans/${planId}/edits`, 'admin', f)
    expect(r.statusCode).toBe(422)
    expect(r.json().error.message_ar).toMatch(/البند 6: يقع على ما يقع عليه البند 1/)
  })

  it('⚠️ وملفٌّ كُتب لخطّةٍ أخرى يُردّ', async () => {
    const r = await call('POST', `/api/admin/cohort-plans/${planId}/edits`, 'admin', { ...goodFile(), planId: cohortId })
    expect(r.statusCode).toBe(422)
  })

  it('والملفُّ السليمُ يُحفظ ببنوده — ومع كلٍّ ما كان في موضعه', async () => {
    const r = await call('POST', `/api/admin/cohort-plans/${planId}/edits`, 'admin', goodFile())
    expect(r.statusCode, r.body).toBe(201)
    const rows = await prisma.planEditSuggestion.findMany({ where: { planId }, orderBy: { seq: 'asc' } })
    expect(rows.map((x) => [x.kind, x.step, x.required])).toEqual([
      ['module', 'modules', true], ['resource_add', 'assignments', true],
      ['task_change', 'assignments', false], ['session_move', 'sessions', false], ['resource_add', 'assignments', false],
    ])
    expect(rows[0].before).toEqual({ artifactAr: null })
    expect(rows[2].before).toEqual({ dueAt: '2026-12-07T20:59:00.000Z' })
    expect(await prisma.auditEvent.count({ where: { action: 'cohort.plan.edits.propose', entityId: cohortId } })).toBe(1)
  })

  /* الرفعُ دفعةً واحدةً (١٠ أكتوبر ٢٠٢٦) يجعل إعادةَ الملفّ نفسِه أيسر — فلا يتكرّر ولا يُردّ (٢٦ أكتوبر ٢٠٢٦، ٨) */
  it('⚠️ وإعادةُ رفعه لا تكرّر بنودَه على المعتمِد ولا على المدرّب — ويُقال إنّه مرفوعٌ قبلُ', async () => {
    const r = await call('POST', `/api/admin/cohort-plans/${planId}/edits`, 'admin', goodFile())
    expect(r.statusCode, r.body).toBe(201)
    expect(r.json()).toMatchObject({ added: 0, repeated: 5, replaced: 0, fromTrainer: 0 })
    expect(await prisma.planEditSuggestion.count({ where: { planId } })).toBe(5)
    expect(await prisma.auditEvent.count({ where: { action: 'cohort.plan.edits.propose', entityId: cohortId } }), 'ولا أثرَ لرفعٍ لم يكتب شيئا').toBe(1)
  })

  it('⚠️ وما رُفع منه قبلُ يُتجاهَل وحدَه — والجديدُ يُرفع، والمهمّةُ الجديدةُ (ولا موضعَ لها قبل أن تُقبل) باسمها', async () => {
    const task = { kind: 'task_add', reasonAr: 'مهمّةٌ للمحور 2', task: { title: 'رسالةٌ في صفحة', type: 'assignment', moduleId: 'M2' } }
    expect((await call('POST', `/api/admin/cohort-plans/${planId}/edits`, 'admin', { items: [task] })).statusCode).toBe(201)
    const mixed = { items: [task, { kind: 'plan', reasonAr: 'نبذةٌ أوضح', set: { summaryAr: 'نبذةٌ جديدة' } }] }
    const again = await call('POST', `/api/admin/cohort-plans/${planId}/edits`, 'admin', mixed)
    expect(again.statusCode, again.body).toBe(201)
    expect(again.json()).toMatchObject({ added: 1, repeated: 1 })
    expect(await prisma.planEditSuggestion.count({ where: { planId, kind: 'task_add' } }), 'تكرّرت المهمّة').toBe(1)
    expect(await prisma.planEditSuggestion.count({ where: { planId, kind: 'plan' } })).toBe(1)
    /* ولا تبقى لما بعدها — الأقسامُ التالية تعدّ بنودَ الملفّ السليم */
    await prisma.planEditSuggestion.deleteMany({ where: { planId, kind: { in: ['task_add', 'plan'] } } })
  })
})

describe('٧ — ولا يصل المدرّبَ ما لم تعتمده الإدارة', () => {
  it('⚠️ المرفوعُ مسوّدةٌ: لا يراها المدرّبُ ولا يقرّر فيها', async () => {
    const rows = await prisma.planEditSuggestion.findMany({ where: { planId }, select: { id: true, status: true } })
    expect(new Set(rows.map((x) => x.status))).toEqual(new Set(['proposed']))
    expect(await editsOf()).toEqual([])
    const r = await call('POST', `/api/trainer/plan-edits/${rows[0].id}/accept`, 'a', {})
    expect(r.statusCode, 'لا وجودَ له عنده').toBe(404)
  })

  it('⚠️ والمراجعةُ لمن يملك صلاحيّتَها — لا المدرّب ولا مديرُ العمليّات', async () => {
    const id = (await prisma.planEditSuggestion.findFirstOrThrow({ where: { planId, kind: 'module' } })).id
    expect((await call('POST', `/api/admin/plan-edits/${id}/approve`, 'a', {})).statusCode).toBe(403)
    expect((await call('POST', `/api/admin/plan-edits/${id}/approve`, 'ops', {})).statusCode).toBe(403)
    expect((await call('POST', `/api/admin/cohort-plans/${planId}/edits/approve-all`, 'ops', {})).statusCode).toBe(403)
    expect((await prisma.planEditSuggestion.findUniqueOrThrow({ where: { id } })).status).toBe('proposed')
  })

  it('⚠️ والمسوّدةُ لا تكفي سببا للردّ — ما لم يُعتمَد لا يصل', async () => {
    const r = await call('POST', `/api/admin/cohort-plans/${planId}/decide`, 'admin', { approve: false })
    expect(r.statusCode).toBe(400)
    expect(r.json().error.code).toBe('reason_required')
  })

  it('تحذف الإدارةُ بندا فلا يصله أبدا — ويُكتب من حذفه', async () => {
    const id = (await prisma.planEditSuggestion.findFirstOrThrow({ where: { planId, kind: 'resource_add', seq: 5 } })).id
    const r = await call('POST', `/api/admin/plan-edits/${id}/drop`, 'admin', {})
    expect(r.statusCode, r.body).toBe(200)
    const row = await prisma.planEditSuggestion.findUniqueOrThrow({ where: { id } })
    expect([row.status, row.reviewedBy]).toEqual(['dropped', adminUserId])
    expect((await call('POST', `/api/admin/plan-edits/${id}/approve`, 'admin', {})).statusCode, 'رُوجع من قبل').toBe(409)
  })

  it('وتعتمد الباقيَ كلَّه — فيصله', async () => {
    const r = await call('POST', `/api/admin/cohort-plans/${planId}/edits/approve-all`, 'admin', {})
    expect(r.statusCode, r.body).toBe(200)
    const rows = await prisma.planEditSuggestion.findMany({ where: { planId }, orderBy: { seq: 'asc' }, select: { status: true } })
    expect(rows.map((x) => x.status)).toEqual(['pending', 'pending', 'pending', 'pending', 'dropped'])
    expect(await prisma.auditEvent.count({ where: { action: 'cohort.plan.edits.approve_all', entityId: cohortId } })).toBe(1)
    expect(await prisma.auditEvent.count({ where: { action: 'cohort.plan.edit.drop', entityId: cohortId } })).toBe(1)
  })
})

describe('٢ — الردُّ بالتعديلات وحدَها', () => {
  it('⚠️ لا يُقبل قبل أن تعود الخطّةُ إليه — ولا ما يقع خارج محتواها (لقاءٌ لا يمرّ بحفظ الخطّة)', async () => {
    const id = (await byKind('session_move')).id
    const r = await call('POST', `/api/trainer/plan-edits/${id}/accept`, 'a', {})
    expect(r.statusCode).toBe(409)
    expect(r.json().error.code).toBe('plan_submitted')
    expect((await prisma.cohortSession.findUniqueOrThrow({ where: { id: sessionId } })).startsAt.toISOString()).toBe('2026-12-07T10:00:00.000Z')
  })

  it('يكفي سببا — ويقول الجرسُ كم هي وكم منها مطلوب', async () => {
    const r = await call('POST', `/api/admin/cohort-plans/${planId}/decide`, 'admin', { approve: false })
    expect(r.statusCode, r.body).toBe(200)
    const bell = await prisma.notification.findFirst({
      where: { userId: trainerUserId, templateKey: 'cohort.plan.decision' }, orderBy: { queuedAt: 'desc' },
    })
    /* والجرسُ سطرٌ بعدد ما ينتظره في «المراجعة» لا الملاحظاتُ بنصوصها (١١ أكتوبر ٢٠٢٦، «فيها كلامٌ كثير»،
       `returnBellAr`) — والنصوصُ بنودٌ هناك */
    expect(bell?.body).toBe('تنتظرك في «المراجعة» 4 تعديلات مقترحة (منها اثنان مطلوبان) — قرّر فيها ثمّ أرسل مراجعتك.')
  })

  it('ويراها مدرّبُها بما قبلها وما بعدها — وغيرُه لا يراها', async () => {
    const items = await editsOf()
    expect(items).toHaveLength(4)
    const m = items.find((x) => x.kind === 'module')!
    expect(m.view.titleAr).toBe('المحور 2 — ما يسلّمه المتعلّم')
    expect(m.view.rows[0]).toMatchObject({ beforeAr: null, afterAr: 'رسالةٌ أساسيّةٌ في صفحةٍ واحدة' })
    expect((await call('GET', `/api/trainer/cohorts/${cohortId}/plan-edits`, 'b')).statusCode).toBe(403)
  })
})

describe('٣ — القبولُ حفظٌ منه بأبوابه', () => {
  it('⚠️ غيرُ مدرّب الشعبة لا يقبل ولا يرفض', async () => {
    const id = (await byKind('module')).id
    expect((await call('POST', `/api/trainer/plan-edits/${id}/accept`, 'b', {})).statusCode).toBe(403)
    expect((await call('POST', `/api/trainer/plan-edits/${id}/reject`, 'b', {})).statusCode).toBe(403)
    expect((await prisma.planEditSuggestion.findUniqueOrThrow({ where: { id } })).status).toBe('pending')
  })

  it('حقلُ المحور يُكتب في الخطّة — ويُكتب الأثر', async () => {
    const id = (await byKind('module')).id
    const r = await call('POST', `/api/trainer/plan-edits/${id}/accept`, 'a', {})
    expect(r.statusCode, r.body).toBe(200)
    const plan = await prisma.cohortDeliveryPlan.findUniqueOrThrow({ where: { id: planId } })
    const mods = (plan.content as { modules: { moduleId: string; artifactAr: string | null }[] }).modules
    expect(mods.find((x) => x.moduleId === 'M2')?.artifactAr).toBe('رسالةٌ أساسيّةٌ في صفحةٍ واحدة')
    expect(plan.status, 'تبقى في يده').toBe('changes_requested')
    expect(await prisma.auditEvent.count({ where: { action: 'cohort.plan.edit.accept', entityId: cohortId } })).toBe(1)
  })

  it('⚠️ ولا يُقرَّر فيه مرّتين', async () => {
    const id = (await prisma.planEditSuggestion.findFirstOrThrow({ where: { planId, kind: 'module' } })).id
    expect((await call('POST', `/api/trainer/plan-edits/${id}/accept`, 'a', {})).statusCode).toBe(409)
    expect((await call('POST', `/api/trainer/plan-edits/${id}/reject`, 'a', {})).statusCode).toBe(409)
  })

  it('ونقلُ اللقاء يقع على اللقاء', async () => {
    const id = (await byKind('session_move')).id
    const r = await call('POST', `/api/trainer/plan-edits/${id}/accept`, 'a', {})
    expect(r.statusCode, r.body).toBe(200)
    const s = await prisma.cohortSession.findUniqueOrThrow({ where: { id: sessionId } })
    expect(s.startsAt.toISOString()).toBe('2026-12-07T16:00:00.000Z')
  })
})

describe('٤ — لا يُكتب فوق ما كتبه بيده بلا علمه', () => {
  it('⚠️ عدّل موعدَ الواجب بنفسه بعد الاقتراح — فيُقال له ولا يُكتب', async () => {
    await prisma.cohortAssessment.update({ where: { id: taskId }, data: { dueAt: new Date('2026-12-10T20:59:00.000Z') } })
    const item = await byKind('task_change')
    expect(item.stale, 'تُرى في القائمة قبل النقر').toBe(true)
    const r = await call('POST', `/api/trainer/plan-edits/${item.id}/accept`, 'a', {})
    expect(r.statusCode).toBe(409)
    expect(r.json().error.message_ar).toMatch(/تغيّر هذا الموضعُ/)
    expect((await prisma.cohortAssessment.findUniqueOrThrow({ where: { id: taskId } })).dueAt?.toISOString()).toBe('2026-12-10T20:59:00.000Z')
  })

  it('ويختار أن يُكتب فوقه — فيُكتب', async () => {
    const item = await byKind('task_change')
    const r = await call('POST', `/api/trainer/plan-edits/${item.id}/accept`, 'a', { force: true })
    expect(r.statusCode, r.body).toBe(200)
    expect((await prisma.cohortAssessment.findUniqueOrThrow({ where: { id: taskId } })).dueAt?.toISOString()).toBe('2026-12-12T20:59:00.000Z')
  })
})

describe('٥ — الرفضُ لا يمسّ شيئا', () => {
  it('يُرفض بكلمته، ولا يُضاف المصدر', async () => {
    const item = await byKind('resource_add')
    const r = await call('POST', `/api/trainer/plan-edits/${item.id}/reject`, 'a', { noteAr: 'عندي مصدرٌ أنسب' })
    expect(r.statusCode, r.body).toBe(200)
    const row = await prisma.planEditSuggestion.findUniqueOrThrow({ where: { id: item.id } })
    expect([row.status, row.noteAr]).toEqual(['rejected', 'عندي مصدرٌ أنسب'])
    const plan = await prisma.cohortDeliveryPlan.findUniqueOrThrow({ where: { id: planId } })
    expect((plan.content as { resources: unknown[] }).resources).toHaveLength(1)
  })
})

describe('٦ — السحبُ والاعتماد يُسقطان ما لم يُقرَّر فيه', () => {
  const one = () => ({ items: [{ kind: 'plan', reasonAr: 'نبذةٌ أوضح', set: { summaryAr: 'نبذةٌ جديدة' } }] })

  it('يسحب المعتمِدُ ما رفعه خطأً — فيغيب عن المدرّب', async () => {
    expect((await call('POST', `/api/admin/cohort-plans/${planId}/edits`, 'admin', one())).statusCode).toBe(201)
    const r = await call('DELETE', `/api/admin/cohort-plans/${planId}/edits`, 'admin')
    expect(r.statusCode, r.body).toBe(200)
    expect((await editsOf()).some((x) => x.kind === 'plan')).toBe(false)
  })

  it('⚠️ وما لم يُقرَّر فيه حين تُعتمَد الخطّةُ يسقط', async () => {
    expect((await call('POST', `/api/admin/cohort-plans/${planId}/edits`, 'admin', one())).statusCode).toBe(201)
    await prisma.cohortDeliveryPlan.update({ where: { id: planId }, data: { status: 'submitted' } })
    const r = await call('POST', `/api/admin/cohort-plans/${planId}/decide`, 'admin', { approve: true })
    expect(r.statusCode, r.body).toBe(200)
    const left = await prisma.planEditSuggestion.findMany({ where: { planId, kind: 'plan' }, select: { status: true } })
    expect(left.map((x) => x.status).sort()).toEqual(['lapsed', 'withdrawn'])
    expect((await editsOf()).some((x) => x.status === 'lapsed'), 'لا يراها المدرّب').toBe(false)
  })

  it('⚠️ ولا يُقترح على خطّةٍ اعتُمدت', async () => {
    expect((await call('POST', `/api/admin/cohort-plans/${planId}/edits`, 'admin', one())).statusCode).toBe(409)
  })
})

/* ═══ ٨ — الرفعُ يتجاهل المكرّر، والأحدثُ مكانَ ما لم يُقرَّر فيه (٢٦ أكتوبر ٢٠٢٦) ═══
   «فقط تحميل ورفع» (صاحب المنصّة). وكان الملفُّ يُردّ كلُّه إن وقع بندٌ منه على ما رُفع، ويُدلّ على «استبدل المسودات»
   و«ابدأ من جديد» — ثمّ بُني لما تكرّر «احذف المكرر» و«أعد ما سحبته». فصار الرفعُ العاديُّ يقضي في ذلك وحدَه،
   وذهبت تلك الأبواب. */
describe('٨ — الرفعُ يتجاهل المكرّر، والأحدثُ مكانَ ما لم يُقرَّر فيه', () => {
  let p = ''
  let c = ''
  const up = (items: unknown[]) => call('POST', `/api/admin/cohort-plans/${p}/edits`, 'admin', { items })
  const statuses = async () => (await prisma.planEditSuggestion.findMany({ where: { planId: p }, orderBy: [{ createdAt: 'asc' }, { seq: 'asc' }], select: { kind: true, status: true, edit: true } }))
    .map((x) => `${x.kind}:${Object.values((x.edit as { set?: Record<string, string> }).set ?? {}).join(',')}:${x.status}`)
  const first = [
    { kind: 'plan', reasonAr: 'نبذةٌ أوضح', set: { summaryAr: 'نبذةٌ أولى' } },
    { kind: 'module', moduleId: 'M1', reasonAr: 'تطبيقٌ أوضح', set: { activityAr: 'تمرينٌ على خريطة الجمهور' } },
    { kind: 'module', moduleId: 'M2', reasonAr: 'مخرجٌ أوضح', set: { artifactAr: 'رسالةٌ في صفحة' } },
  ]

  beforeAll(async () => {
    ;({ planId: p, cohortId: c } = await submittedPlan())
    expect((await up(first)).statusCode).toBe(201)
    /* بندُ المحور 1 يصل المدرّب ولا يقرّر فيه، وبندُ المحور 2 يصله فيرفضه */
    for (const id of ['M1', 'M2']) {
      const row = (await prisma.planEditSuggestion.findMany({ where: { planId: p, kind: 'module' } }))
        .find((x) => (x.edit as { moduleId?: string }).moduleId === id)!
      expect((await call('POST', `/api/admin/plan-edits/${row.id}/approve`, 'admin', {})).statusCode).toBe(200)
    }
    const m2 = (await prisma.planEditSuggestion.findMany({ where: { planId: p, kind: 'module' } }))
      .find((x) => (x.edit as { moduleId?: string }).moduleId === 'M2')!
    await prisma.planEditSuggestion.update({ where: { id: m2.id }, data: { status: 'rejected', decidedAt: new Date() } })
  })

  it('⚠️ الملفُّ نفسُه ثانيةً لا يكتب شيئا — وما رفضه المدرّبُ لا يعود إليه بعينه', async () => {
    const r = await up(first)
    expect(r.statusCode, r.body).toBe(201)
    expect(r.json()).toMatchObject({ added: 0, required: 0, repeated: 3, replaced: 0, fromTrainer: 0 })
    expect(await statuses()).toEqual(['plan:نبذةٌ أولى:proposed', 'module:تمرينٌ على خريطة الجمهور:pending', 'module:رسالةٌ في صفحة:rejected'])
  })

  it('⚠️ ملفٌّ يُردّ لا يسحب شيئا — وبندٌ مرفوعٌ قبلُ لا يجعل ما فيه من خطأ مقبولا', async () => {
    const r = await up([first[0], { kind: 'module', moduleId: 'M9', reasonAr: 'مجهول', set: { activityAr: 'x' } }])
    expect(r.statusCode).toBe(422)
    expect(r.json().error.message_ar).toMatch(/البند 2: /)
    expect(await statuses()).toEqual(['plan:نبذةٌ أولى:proposed', 'module:تمرينٌ على خريطة الجمهور:pending', 'module:رسالةٌ في صفحة:rejected'])
  })

  it('⚠️ وبندان في الملفّ على موضعٍ واحدٍ يُردّان — ولو كان أحدُهما مرفوعا قبلُ', async () => {
    const r = await up([first[0], { kind: 'plan', reasonAr: 'نبذةٌ أوضح', set: { summaryAr: 'غيرُها' } }])
    expect(r.statusCode).toBe(422)
    expect(r.json().error.message_ar).toMatch(/البند 2: يقع على ما يقع عليه البند 1/)
  })

  it('⚠️ ونسخةٌ أحدثُ مكانَ مسوّدةٍ لم تعتمدها تحلّ محلّها — في معاملةٍ واحدة، ويُكتب الأثر', async () => {
    const r = await up([{ kind: 'plan', reasonAr: 'نبذةٌ أوضح', set: { summaryAr: 'نبذةٌ ثانية' } }])
    expect(r.statusCode, r.body).toBe(201)
    expect(r.json()).toMatchObject({ added: 1, repeated: 0, replaced: 1, fromTrainer: 0 })
    expect(await statuses()).toEqual([
      'plan:نبذةٌ أولى:withdrawn', 'module:تمرينٌ على خريطة الجمهور:pending', 'module:رسالةٌ في صفحة:rejected', 'plan:نبذةٌ ثانية:proposed',
    ])
    const audit = await prisma.auditEvent.findMany({ where: { action: 'cohort.plan.edits.withdraw', entityId: c }, select: { meta: true } })
    expect(audit.some((a) => (a.meta as { replacedBy?: string; count?: number }).replacedBy && (a.meta as { count?: number }).count === 1)).toBe(true)
  })

  it('⚠️ ونسخةٌ أحدثُ مكانَ بطاقةٍ عند المدرّب لم يقرّر فيها: تغيب عنه، وتصله الأحدثُ حين تعتمدها', async () => {
    const r = await up([{ kind: 'module', moduleId: 'M1', reasonAr: 'تطبيقٌ أوضح', set: { activityAr: 'تمرينٌ ثانٍ' } }])
    expect(r.statusCode, r.body).toBe(201)
    expect(r.json()).toMatchObject({ added: 1, replaced: 0, fromTrainer: 1 })
    const mine = (await call('GET', `/api/trainer/cohorts/${c}/plan-edits`, 'a')).json() as { kind: string; status: string; view: { rows: { afterAr: string | null }[] } }[]
    expect(mine.some((x) => x.status === 'pending'), 'بقيت القديمةُ عنده').toBe(false)
    const fresh = await prisma.planEditSuggestion.findFirstOrThrow({ where: { planId: p, status: 'proposed', kind: 'module' } })
    expect((await call('POST', `/api/admin/plan-edits/${fresh.id}/approve`, 'admin', {})).statusCode).toBe(200)
    const after = (await call('GET', `/api/trainer/cohorts/${c}/plan-edits`, 'a')).json() as { status: string; view: { rows: { afterAr: string | null }[] } }[]
    expect(after.filter((x) => x.status === 'pending').flatMap((x) => x.view.rows.map((row) => row.afterAr))).toEqual(['تمرينٌ ثانٍ'])
  })

  it('⚠️ وما قرّر فيه المدرّبُ لا يُمسّ ولا يحجب — ونسخةٌ غيرُه تُرفع بجانبه', async () => {
    const r = await up([{ kind: 'module', moduleId: 'M2', reasonAr: 'مخرجٌ أوضح', set: { artifactAr: 'رسالةٌ في سطرين' } }])
    expect(r.statusCode, r.body).toBe(201)
    expect(r.json()).toMatchObject({ added: 1, replaced: 0, fromTrainer: 0 })
    expect((await statuses()).filter((x) => x.startsWith('module:رسالة'))).toEqual(['module:رسالةٌ في صفحة:rejected', 'module:رسالةٌ في سطرين:proposed'])
  })

  it('⚠️ وما سحبتَه بيدك يعود برفع ملفّه — مسوّداتٍ تراجعها', async () => {
    expect((await call('DELETE', `/api/admin/cohort-plans/${p}/edits`, 'admin')).statusCode).toBe(200)
    const r = await up([{ kind: 'plan', reasonAr: 'نبذةٌ أوضح', set: { summaryAr: 'نبذةٌ ثانية' } }])
    expect(r.statusCode, r.body).toBe(201)
    expect(r.json()).toMatchObject({ added: 1, repeated: 0 })
    expect((await statuses()).at(-1)).toBe('plan:نبذةٌ ثانية:proposed')
  })

  it('⚠️ ولا أبوابَ للاستبدال ولا للتنظيف بعد اليوم', async () => {
    const body = { items: [{ kind: 'plan', reasonAr: 'س', set: { summaryAr: 'ن' } }] }
    for (const path of ['replace-drafts', 'replace-all', 'keep-latest', 'restore']) {
      expect((await call('POST', `/api/admin/cohort-plans/${p}/edits/${path}`, 'admin', body)).statusCode, path).toBe(404)
    }
    expect((await call('POST', '/api/admin/plan-edits/keep-latest-all', 'admin', {})).statusCode).toBe(404)
    expect((await call('GET', `/api/admin/cohorts/${c}/plan-edits/withdrawn`, 'admin')).statusCode).toBe(404)
  })

  it('⚠️ ولا على خطّةٍ اعتُمدت', async () => {
    await prisma.cohortDeliveryPlan.update({ where: { id: p }, data: { status: 'approved' } })
    const r = await up([{ kind: 'plan', reasonAr: 'نبذةٌ أوضح', set: { summaryAr: 'نبذةٌ رابعة' } }])
    expect(r.statusCode, r.body).toBe(409)
    await prisma.cohortDeliveryPlan.update({ where: { id: p }, data: { status: 'submitted' } })
  })
})
