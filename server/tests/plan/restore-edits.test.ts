/* «أعِد ما سحبته» — ما سُحب من التعديلات المقترحة يعود كما كان (١٢ أكتوبر ٢٠٢٦، `restore`).

   سحب صاحبُ المنصّة تعديلاتِ خطّةٍ بـ«اسحب ما لم يقرّر» ثمّ سأل: «أين التعديلات؟ كانت موجودةً وأعتقد
   أنّي سحبتها.. كيف أعيدها؟» — واختار زرّا يعيدها. وهنا على قاعدةٍ حقيقيّة:

   ١) **تعود كما كانت**: ما اعتمده للمدرّب يصله ثانية، والمسوّدةُ مسوّدة — ويُكتب الأثر.
   ٢) **ولا تعود فوق ما جاء بعدها** على موضعها: ملفٌّ رُفع ثانيةً، أو مسوّدةٌ استُبدلت — ويعود أحدثُ المسحوب.
   ٣) **ولا يحجبها ما كان قبلها** — مسوّدةٌ حذفها المعتمِدُ ثمّ رفع غيرَها وسحبها.
   ٤) **ولمن يسحب وحدَه، وعلى خطّةٍ مفتوحة** — والمعتمَدةُ لا يعود عليها شيء. */

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
let profileId = ''

const login = async (email: string) => `${SESSION_COOKIE}=${(await auth.login(email, PASS)).token}`
const call = (method: 'GET' | 'POST' | 'DELETE', url: string, who: string, payload?: unknown) =>
  app.inject({ method, url, headers: { cookie: cookies[who] }, ...(payload !== undefined ? { payload: payload as never } : {}) })

const content = {
  kind: 'trainer',
  modules: [
    { moduleId: 'M1', titleAr: 'الجمهور', outcomeAr: 'يحلّل جمهوره', artifactAr: 'خريطة' },
    { moduleId: 'M2', titleAr: 'الرسالة', outcomeAr: 'يصوغ رسالته', artifactAr: null },
  ],
  resources: [],
  startsOn: '2026-12-06', endsOn: '2027-01-30',
}

async function openPlan(status = 'submitted') {
  const course = await prisma.course.findFirstOrThrow({ select: { id: true } })
  const cohort = await prisma.cohort.create({
    data: {
      courseId: course.id, title: `شعبةُ الإعادة ${Math.random()}`, status: 'draft', capacity: 20,
      scheduleWindowStart: new Date('2026-12-05T21:00:00.000Z'), scheduleWindowEnd: new Date('2027-01-30T20:59:59.999Z'),
    },
  })
  await prisma.cohortTrainer.create({ data: { cohortId: cohort.id, profileId, role: 'lead' } })
  const plan = await prisma.cohortDeliveryPlan.create({
    data: { cohortId: cohort.id, trainerId: profileId, status, submittedAt: new Date(), content: content as never },
  })
  return { cohortId: cohort.id, planId: plan.id }
}

const ITEMS = [
  { kind: 'plan', reasonAr: 'نبذةٌ أوضح', set: { summaryAr: 'نبذةٌ أولى' } },
  { kind: 'module', moduleId: 'M1', reasonAr: 'تطبيقٌ أوضح', set: { activityAr: 'تمرينٌ على خريطة الجمهور' } },
  { kind: 'module', moduleId: 'M2', reasonAr: 'مخرجٌ يُرى', set: { outcomeAr: 'يكتب رسالةً في صفحة' } },
]

/** «نوع:حقل:حال» بترتيب الرفع — ومعها النصّ لما يُفرَّق به بين نسختين */
const statuses = async (planId: string) => (await prisma.planEditSuggestion.findMany({
  where: { planId }, orderBy: [{ createdAt: 'asc' }, { seq: 'asc' }], select: { kind: true, status: true, edit: true },
})).map((x) => {
  const set = (x.edit as { set?: Record<string, string> }).set ?? {}
  return `${x.kind}:${Object.entries(set).map(([k, v]) => `${k}=${v}`).join(',')}:${x.status}`
})

const upload = async (planId: string, items: unknown[]) =>
  expect((await call('POST', `/api/admin/cohort-plans/${planId}/edits`, 'admin', { items })).statusCode).toBe(201)
const withdraw = async (planId: string) =>
  expect((await call('DELETE', `/api/admin/cohort-plans/${planId}/edits`, 'admin')).statusCode).toBe(200)
const restore = (planId: string, who = 'admin') => call('POST', `/api/admin/cohort-plans/${planId}/edits/restore`, who, {})
const countOf = async (cohortId: string) =>
  ((await call('GET', `/api/admin/cohorts/${cohortId}/plan-edits/withdrawn`, 'admin')).json() as { count: number; skipped: number })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)
  const admin = await auth.register(`re-admin-${STAMP}@test.local`, PASS, 'المعتمِد')
  await auth.setRoles(admin.userId, ['academic_manager'])
  cookies.admin = await login(`re-admin-${STAMP}@test.local`)

  const email = `re-a-${STAMP}@test.local`
  const u = await auth.register(email, PASS, 'مدرّب الإعادة')
  await auth.setRoles(u.userId, ['trainer'])
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `WJ-TR-RE-${STAMP}`, email, fullName: 'مدرّب الإعادة',
      phoneCountryCode: '+962', phone: `797${STAMP % 1000000}`, country: 'الأردن', status: 'active',
    },
  })
  profileId = (await prisma.trainerProfile.create({ data: { applicationId: application.id, userId: u.userId } })).id
  cookies.a = await login(email)
}, 240_000)

describe('١ — تعود كما كانت', () => {
  it('⚠️ ما اعتُمد للمدرّب يصله ثانية، والمسوّدة مسوّدة — ويقال العدد ويكتب الأثر', async () => {
    const { cohortId, planId } = await openPlan()
    await upload(planId, ITEMS)
    const m1 = await prisma.planEditSuggestion.findFirstOrThrow({ where: { planId, kind: 'module', edit: { path: ['moduleId'], equals: 'M1' } } })
    expect((await call('POST', `/api/admin/plan-edits/${m1.id}/approve`, 'admin', {})).statusCode).toBe(200)
    await withdraw(planId)
    expect(await countOf(cohortId)).toMatchObject({ count: 3, skipped: 0 })

    const r = await restore(planId)
    expect(r.statusCode, r.body).toBe(200)
    expect(r.json()).toMatchObject({ restored: 3, toTrainer: 1, skipped: 0 })
    expect(await statuses(planId)).toEqual([
      'plan:summaryAr=نبذةٌ أولى:proposed', 'module:activityAr=تمرينٌ على خريطة الجمهور:pending', 'module:outcomeAr=يكتب رسالةً في صفحة:proposed',
    ])
    const back = await prisma.planEditSuggestion.findMany({ where: { planId }, select: { decidedAt: true, decidedBy: true } })
    expect(back.every((x) => x.decidedAt === null && x.decidedBy === null), 'بقي ختم السحب').toBe(true)
    /* والمدرّبُ يرى ما وصله قبل السحب — لا المسوّدات */
    const seen = (await call('GET', `/api/trainer/cohorts/${cohortId}/plan-edits`, 'a')).json() as { status: string }[]
    expect(seen.map((x) => x.status)).toEqual(['pending'])
    expect(await countOf(cohortId)).toMatchObject({ count: 0 })
    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'cohort.plan.edits.restore', entityId: cohortId } })
    expect(audit.meta).toMatchObject({ planId, count: 3, toTrainer: 1, drafts: 2, skipped: 0 })
  })
})

describe('٢ — ولا تعود فوق ما جاء بعدها', () => {
  it('⚠️ ملفّ رفع ثانية بعد السحب: ما يقع عليه يبقى مسحوبا، والباقي يعود', async () => {
    const { cohortId, planId } = await openPlan()
    await upload(planId, ITEMS)
    await withdraw(planId)
    await upload(planId, [{ kind: 'plan', reasonAr: 'نبذةٌ أوضح', set: { summaryAr: 'نبذةٌ ثانية' } }])
    expect(await countOf(cohortId)).toMatchObject({ count: 2, skipped: 1 })
    expect((await restore(planId)).json()).toMatchObject({ restored: 2, skipped: 1 })
    expect(await statuses(planId)).toEqual([
      'plan:summaryAr=نبذةٌ أولى:withdrawn', 'module:activityAr=تمرينٌ على خريطة الجمهور:proposed',
      'module:outcomeAr=يكتب رسالةً في صفحة:proposed', 'plan:summaryAr=نبذةٌ ثانية:proposed',
    ])
  })

  it('⚠️ ومسوّدة استبدلت ثمّ سحب بديلها: يعود البديل وحده — لا الاثنان', async () => {
    const { planId } = await openPlan()
    await upload(planId, [ITEMS[0]])
    const rep = await call('POST', `/api/admin/cohort-plans/${planId}/edits/replace-drafts`, 'admin', {
      items: [{ kind: 'plan', reasonAr: 'نبذةٌ أوضح', set: { summaryAr: 'نبذةٌ ثانية' } }],
    })
    expect(rep.statusCode, rep.body).toBe(201)
    await withdraw(planId)
    expect((await restore(planId)).json()).toMatchObject({ restored: 1, skipped: 1 })
    expect(await statuses(planId)).toEqual(['plan:summaryAr=نبذةٌ أولى:withdrawn', 'plan:summaryAr=نبذةٌ ثانية:proposed'])
  })

  it('ولا شيء يعود: يقال لماذا', async () => {
    const { planId } = await openPlan()
    await upload(planId, [ITEMS[0]])
    await withdraw(planId)
    await upload(planId, [{ kind: 'plan', reasonAr: 'نبذةٌ أوضح', set: { summaryAr: 'نبذةٌ ثالثة' } }])
    const r = await restore(planId)
    expect(r.statusCode).toBe(409)
    expect(r.json().error.message_ar).toMatch(/بنود أحدث/)
  })
})

describe('٣ — ولا يحجبها ما كان قبلها', () => {
  it('⚠️ حذف المعتمد مسوّدة، ثمّ رفع غيرها على موضعها وسحبها — تعود الأخيرة', async () => {
    const { planId } = await openPlan()
    await upload(planId, [ITEMS[0]])
    const first = await prisma.planEditSuggestion.findFirstOrThrow({ where: { planId } })
    expect((await call('POST', `/api/admin/plan-edits/${first.id}/drop`, 'admin', {})).statusCode).toBe(200)
    await upload(planId, [{ kind: 'plan', reasonAr: 'نبذةٌ أوضح', set: { summaryAr: 'نبذةٌ ثانية' } }])
    await withdraw(planId)
    expect((await restore(planId)).json()).toMatchObject({ restored: 1, skipped: 0 })
    expect(await statuses(planId)).toEqual(['plan:summaryAr=نبذةٌ أولى:dropped', 'plan:summaryAr=نبذةٌ ثانية:proposed'])
  })
})

describe('٤ — لمن يسحب، وعلى خطّة مفتوحة', () => {
  it('⚠️ المدرّب لا يعيد', async () => {
    const { planId } = await openPlan()
    await upload(planId, [ITEMS[0]])
    await withdraw(planId)
    expect((await restore(planId, 'a')).statusCode).toBe(403)
  })

  it('⚠️ والخطّة المعتمدة لا يعود عليها شيء — ولا يعرض الزرّ عددا', async () => {
    const { cohortId, planId } = await openPlan()
    await upload(planId, [ITEMS[0]])
    await withdraw(planId)
    await prisma.cohortDeliveryPlan.update({ where: { id: planId }, data: { status: 'approved' } })
    expect(await countOf(cohortId)).toMatchObject({ count: 0 })
    const r = await restore(planId)
    expect(r.statusCode).toBe(409)
    expect(r.json().error.code).toBe('plan_closed')
  })
})
