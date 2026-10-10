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

import { beforeAll, describe, expect, it } from 'vitest'
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

  /* الرفعُ دفعةً واحدةً (١٠ أكتوبر ٢٠٢٦) يجعل إعادةَ الملفّ نفسِه أيسر */
  it('⚠️ وإعادةُ رفعه وبنودُه لم يُقرَّر فيها تُردّ بسطرٍ واحد — فلا تتكرّر على المعتمِد ولا على المدرّب', async () => {
    const r = await call('POST', `/api/admin/cohort-plans/${planId}/edits`, 'admin', goodFile())
    expect(r.statusCode).toBe(409)
    expect(r.json().error.message_ar).toMatch(/^رُفع هذا الملفُّ قبلُ ولم يُقرَّر في بنوده/)
    expect(await prisma.planEditSuggestion.count({ where: { planId } })).toBe(5)
  })

  it('⚠️ وما وقع منه على ما رُفع يُسمّى ببنده — والمهمّةُ الجديدةُ (ولا موضعَ لها قبل أن تُقبل) باسمها', async () => {
    const task = { kind: 'task_add', reasonAr: 'مهمّةٌ للمحور 2', task: { title: 'رسالةٌ في صفحة', type: 'assignment', moduleId: 'M2' } }
    expect((await call('POST', `/api/admin/cohort-plans/${planId}/edits`, 'admin', { items: [task] })).statusCode).toBe(201)
    const mixed = { items: [task, { kind: 'plan', reasonAr: 'نبذةٌ أوضح', set: { summaryAr: 'نبذةٌ جديدة' } }] }
    const again = await call('POST', `/api/admin/cohort-plans/${planId}/edits`, 'admin', mixed)
    expect(again.statusCode).toBe(422)
    expect(again.json().error.message_ar, 'ولا يُقال ما يُصنع').toMatch(/البند 1: نسختُها السابقة مسوّدةٌ لم تعتمدها بعد — اختر «استبدل المسودات التي لم تعتمدها بعد»/)
    expect(again.json().error.message_ar).not.toMatch(/البند 2/)
    expect(await prisma.planEditSuggestion.count({ where: { planId, kind: 'plan' } }), 'ولا يُحفظ منه شيء').toBe(0)
    /* ولا تبقى لما بعدها — الأقسامُ التالية تعدّ بنودَ الملفّ السليم */
    await prisma.planEditSuggestion.deleteMany({ where: { planId, kind: 'task_add' } })
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
    expect(bell?.body).toContain('واقترحنا على خطّتك 4 تعديلات (منها اثنان مطلوبان)')
    expect(bell?.body.match(/واقترحنا على خطّتك/g)?.length, 'السطرُ مرّةً واحدة').toBe(1)
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

/* ═══ ٨ — ملفٌّ جديدٌ مكانَ مسوّداتٍ لم تُعتمد (١٠ أكتوبر ٢٠٢٦) ═══
   الصيغةُ الجديدةُ لملفّات التعديلات تُرفع من صندوق الرفع دفعةً والقديمةُ ما زالت مسوّدات. */
describe('٨ — الاستبدالُ يسحب المسوّداتِ وحدَها، وفي معاملةٍ واحدة', () => {
  let p = ''
  const url = () => `/api/admin/cohort-plans/${p}/edits/replace-drafts`
  const statuses = async () => (await prisma.planEditSuggestion.findMany({ where: { planId: p }, orderBy: [{ createdAt: 'asc' }, { seq: 'asc' }], select: { kind: true, status: true, edit: true } }))
    .map((x) => `${x.kind}:${Object.keys((x.edit as { set?: object }).set ?? {}).join(',')}:${x.status}`)

  beforeAll(async () => {
    ;({ planId: p } = await submittedPlan())
    const first = { items: [
      { kind: 'plan', reasonAr: 'نبذةٌ أوضح', set: { summaryAr: 'نبذةٌ أولى' } },
      { kind: 'module', moduleId: 'M1', reasonAr: 'تطبيقٌ أوضح', set: { activityAr: 'تمرينٌ على خريطة الجمهور' } },
    ] }
    expect((await call('POST', `/api/admin/cohort-plans/${p}/edits`, 'admin', first)).statusCode).toBe(201)
    /* ويُعتمد بندُ المحور 1 للمدرّب — فلا يُمسّ */
    const m1 = await prisma.planEditSuggestion.findFirstOrThrow({ where: { planId: p, kind: 'module' } })
    expect((await call('POST', `/api/admin/plan-edits/${m1.id}/approve`, 'admin', {})).statusCode).toBe(200)
  })

  it('⚠️ لمن يعتمد وحدَه', async () => {
    expect((await call('POST', url(), 'a', { items: [{ kind: 'plan', reasonAr: 'س', set: { summaryAr: 'ن' } }] })).statusCode).toBe(403)
  })

  it('⚠️ ملفٌّ يُردّ لا يسحب شيئا', async () => {
    const r = await call('POST', url(), 'admin', { items: [{ kind: 'module', moduleId: 'M9', reasonAr: 'مجهول', set: { activityAr: 'x' } }] })
    expect(r.statusCode).toBe(422)
    expect(await statuses()).toEqual(['plan:summaryAr:proposed', 'module:activityAr:pending'])
  })

  it('⚠️ وما اعتُمد للمدرّب لا يُستبدل — يُردّ الملفُّ الواقعُ عليه', async () => {
    const r = await call('POST', url(), 'admin', { items: [{ kind: 'module', moduleId: 'M1', reasonAr: 'مرّةً ثانية', set: { activityAr: 'غيرُه' } }] })
    expect(r.statusCode).toBe(409)
    expect(r.json().error.message_ar).toMatch(/واعتُمدت بنودُه للمدرّب/)
    expect(await statuses()).toEqual(['plan:summaryAr:proposed', 'module:activityAr:pending'])
  })

  it('⚠️ وما وصل المدرّبَ يُقال بسببه وعلاجِه — والبنودُ على سببٍ واحدٍ في سطرٍ واحد', async () => {
    const r = await call('POST', url(), 'admin', { items: [
      { kind: 'module', moduleId: 'M1', reasonAr: 'مرّةً ثانية', set: { activityAr: 'غيرُه' } },
      { kind: 'module', moduleId: 'M2', reasonAr: 'جديد', set: { artifactAr: 'رسالةٌ في صفحة' } },
    ] })
    expect(r.statusCode).toBe(422)
    const msg: string = r.json().error.message_ar
    expect(msg).toMatch(/البند 1: نسختُها السابقة اعتمدتَها فوصلت المدرّبَ ولم يقرّر فيها بعد — فلا تُستبدل\. إن أردتَ الجديدةَ فاسحب القديمة بـ«اسحب ما لم يُقرَّر»/)
    expect(msg, 'البندُ الجديدُ لا يُردّ بسبب غيره').not.toMatch(/البند 2|البنود/)
    expect(await statuses()).toEqual(['plan:summaryAr:proposed', 'module:activityAr:pending'])
  })

  it('⚠️ وبلا استبدالٍ: المسوّداتُ بسطرٍ واحدٍ يدلّ على الاستبدال، وما وصل المدرّبَ بسطره', async () => {
    const r = await call('POST', `/api/admin/cohort-plans/${p}/edits`, 'admin', { items: [
      { kind: 'plan', reasonAr: 'نبذةٌ أوضح', set: { summaryAr: 'نبذةٌ ثالثة' } },
      { kind: 'module', moduleId: 'M1', reasonAr: 'مرّةً ثانية', set: { activityAr: 'غيرُه' } },
      { kind: 'module', moduleId: 'M2', reasonAr: 'جديد', set: { artifactAr: 'رسالةٌ في صفحة' } },
    ] })
    expect(r.statusCode).toBe(422)
    const lines = (r.json().error.message_ar as string).split('\n').slice(1)
    expect(lines).toEqual([
      'البند 1: نسختُها السابقة مسوّدةٌ لم تعتمدها بعد — اختر «استبدل المسودات التي لم تعتمدها بعد» وارفع الملفَّ من جديد',
      'البند 2: نسختُها السابقة اعتمدتَها فوصلت المدرّبَ ولم يقرّر فيها بعد — فلا تُستبدل. إن أردتَ الجديدةَ فاسحب القديمة بـ«اسحب ما لم يُقرَّر» في بطاقة الخطّة ثمّ ارفع الملفّ',
    ])
  })

  it('يسحب المسوّدةَ ويرفع الجديدَ مكانها — ويبقى المعتمَد، ويُكتب الأثر', async () => {
    const next = { items: [
      { kind: 'plan', reasonAr: 'نبذةٌ أوضح', set: { summaryAr: 'نبذةٌ ثانية' } },
      { kind: 'module', moduleId: 'M2', reasonAr: 'مخرجٌ يُرى', set: { outcomeAr: 'يكتب رسالةً في صفحة' } },
    ] }
    const r = await call('POST', url(), 'admin', next)
    expect(r.statusCode, r.body).toBe(201)
    expect(r.json().replacedDrafts).toBe(1)
    expect(await statuses()).toEqual([
      'plan:summaryAr:withdrawn', 'module:activityAr:pending', 'plan:summaryAr:proposed', 'module:outcomeAr:proposed',
    ])
    const audit = await prisma.auditEvent.findMany({ where: { action: 'cohort.plan.edits.withdraw' }, select: { meta: true } })
    expect(audit.some((a) => (a.meta as { planId?: string; replacedBy?: string }).planId === p && (a.meta as { replacedBy?: string }).replacedBy)).toBe(true)
  })

  it('⚠️ والرفعُ العاديُّ بلا استبدالٍ ما زال يردّ الملفَّ المرفوعَ نفسَه', async () => {
    const r = await call('POST', `/api/admin/cohort-plans/${p}/edits`, 'admin', { items: [{ kind: 'plan', reasonAr: 'نبذةٌ أوضح', set: { summaryAr: 'نبذةٌ ثانية' } }] })
    expect(r.statusCode).toBe(409)
  })
})
