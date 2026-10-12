/* «احذف المكرر» — يبقى آخرُ ملفٍّ رُفع على الخطّة، ويُسحب ما لم يقرّر فيه من الأقدم (١٢ أكتوبر ٢٠٢٦، `keepLatest`).

   رفع صاحبُ المنصّة الملفَّ الجديد ثمّ ضغط «أعد ما سحبته»، فعادت بنودٌ من رفعاتٍ سابقةٍ فوق الجديد —
   خمسون بندا عند مدرّبٍ وملفُّه خمسةَ عشر. وقال: «give me a button to remove duplication». وهنا على
   قاعدةٍ حقيقيّة:

   ١) **ما عاد فوق الملفّ الجديد يُسحب**، ويبقى الجديدُ وحدَه — ويُكتب الأثر، ويقول العدّادُ كم قبلُ وبعد.
   ٢) **وما قرّر فيه المدرّبُ لا يُمسّ** — وآخرُ ملفٍّ آخرُه وإن قرّر المدرّبُ في بنوده كلِّها.
   ٣) **وملاحظاتُ الردّ ليست ملفّا** — لا تُعدّ آخرَه ولا تُسحب.
   ٤) **ولمن يعتمد وحدَه، وعلى خطّةٍ مفتوحة** — ولا مكرّرَ يقال بسببه. */

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
      courseId: course.id, title: `شعبةُ المكرّر ${Math.random()}`, status: 'draft', capacity: 20,
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
const restore = (planId: string, who = 'admin') => call('POST', `/api/admin/cohort-plans/${planId}/edits/restore`, who, {})
const countOf = async (cohortId: string) =>
  ((await call('GET', `/api/admin/cohorts/${cohortId}/plan-edits/withdrawn`, 'admin')).json() as { count: number; skipped: number; older: number })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)
  const admin = await auth.register(`kl-admin-${STAMP}@test.local`, PASS, 'المعتمِد')
  await auth.setRoles(admin.userId, ['academic_manager'])
  cookies.admin = await login(`kl-admin-${STAMP}@test.local`)

  const email = `kl-a-${STAMP}@test.local`
  const u = await auth.register(email, PASS, 'مدرّب المكرّر')
  await auth.setRoles(u.userId, ['trainer'])
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `WJ-TR-KL-${STAMP}`, email, fullName: 'مدرّب المكرّر',
      phoneCountryCode: '+962', phone: `796${STAMP % 1000000}`, country: 'الأردن', status: 'active',
    },
  })
  profileId = (await prisma.trainerProfile.create({ data: { applicationId: application.id, userId: u.userId } })).id
  cookies.a = await login(email)
}, 240_000)

const keepLatest = (planId: string, who = 'admin') => call('POST', `/api/admin/cohort-plans/${planId}/edits/keep-latest`, who, {})
const B = [{ kind: 'plan', reasonAr: 'نبذةٌ أوضح', set: { summaryAr: 'نبذةٌ ثانية' } }]
const setStatus = (planId: string, kind: string, moduleId: string | null, status: string) =>
  prisma.planEditSuggestion.updateMany({
    where: { planId, kind, ...(moduleId ? { edit: { path: ['moduleId'], equals: moduleId } } : {}) }, data: { status },
  })

describe('١ — ما عاد فوق الملفّ الجديد يُسحب، ويبقى الجديد وحده', () => {
  it('⚠️ «ابدأ من جديد» ثمّ «أعد ما سحبته» — والزرّ يسحب ما عاد من الأقدم، وما وصل المدرّب منه يختفي عنده', async () => {
    const { cohortId, planId } = await openPlan()
    await upload(planId, ITEMS)
    const m1 = await prisma.planEditSuggestion.findFirstOrThrow({ where: { planId, kind: 'module', edit: { path: ['moduleId'], equals: 'M1' } } })
    expect((await call('POST', `/api/admin/plan-edits/${m1.id}/approve`, 'admin', {})).statusCode).toBe(200)
    expect((await call('POST', `/api/admin/cohort-plans/${planId}/edits/replace-all`, 'admin', { items: B })).statusCode).toBe(201)
    expect((await restore(planId)).json()).toMatchObject({ restored: 2, skipped: 1 })
    expect(await countOf(cohortId)).toMatchObject({ older: 2 })

    const r = await keepLatest(planId)
    expect(r.statusCode, r.body).toBe(200)
    expect(r.json()).toMatchObject({ withdrawn: 2 })
    expect(await statuses(planId)).toEqual([
      'plan:summaryAr=نبذةٌ أولى:withdrawn', 'module:activityAr=تمرينٌ على خريطة الجمهور:withdrawn',
      'module:outcomeAr=يكتب رسالةً في صفحة:withdrawn', 'plan:summaryAr=نبذةٌ ثانية:proposed',
    ])
    expect(await countOf(cohortId)).toMatchObject({ older: 0 })
    const seen = (await call('GET', `/api/trainer/cohorts/${cohortId}/plan-edits`, 'a')).json() as unknown[]
    expect(seen, 'بقي عند المدرّب ما سحب').toEqual([])
    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { action: 'cohort.plan.edits.withdraw', entityId: cohortId, meta: { path: ['older'], equals: true } },
    })
    expect(audit.meta).toMatchObject({ planId, count: 2, older: true })
  })
})

describe('٢ — وما قرّر فيه المدرّب لا يُمسّ', () => {
  it('⚠️ المقبول من الأقدم يبقى ولا يعدّ، والمرفوض من الأحدث لا يجعله غير آخر ملف', async () => {
    const { cohortId, planId } = await openPlan()
    await upload(planId, ITEMS)
    await upload(planId, [{ kind: 'module', moduleId: 'M2', reasonAr: 'مخرجٌ يُرى', set: { artifactAr: 'رسالةٌ في صفحة' } }])
    await setStatus(planId, 'module', 'M1', 'accepted')
    await prisma.planEditSuggestion.updateMany({ where: { planId, edit: { path: ['set', 'artifactAr'], equals: 'رسالةٌ في صفحة' } }, data: { status: 'rejected' } })
    expect(await countOf(cohortId), 'عدّ المقبول مكررا').toMatchObject({ older: 2 })

    const r = await keepLatest(planId)
    expect(r.statusCode, r.body).toBe(200)
    expect(r.json()).toMatchObject({ withdrawn: 2 })
    expect(await statuses(planId)).toEqual([
      'plan:summaryAr=نبذةٌ أولى:withdrawn', 'module:activityAr=تمرينٌ على خريطة الجمهور:accepted',
      'module:outcomeAr=يكتب رسالةً في صفحة:withdrawn', 'module:artifactAr=رسالةٌ في صفحة:rejected',
    ])
  })
})

describe('٣ — وملاحظات الردّ ليست ملفّا', () => {
  it('⚠️ ملاحظة أحدث من الملف لا تجعله «أقدم» — ولا تسحب', async () => {
    const { cohortId, planId } = await openPlan()
    await upload(planId, ITEMS)
    await prisma.planEditSuggestion.create({
      data: {
        cohortId, planId, batchId: randomUUID(), seq: 1, kind: 'note', step: 'modules', required: true, reasonAr: '',
        edit: { kind: 'note', step: 'modules', textAr: 'اكتب المحتوى النظري' } as never, status: 'pending',
        createdBy: randomUUID(), createdAt: new Date(Date.now() + 60_000),
      },
    })
    const r = await keepLatest(planId)
    expect(r.statusCode, r.body).toBe(409)
    expect(r.json().error.code).toBe('no_duplicates')
    expect(await prisma.planEditSuggestion.count({ where: { planId, status: 'withdrawn' } })).toBe(0)
  })

  it('⚠️ ومع ملفّين: يسحب الأقدم وتبقى الملاحظة', async () => {
    const { cohortId, planId } = await openPlan()
    await upload(planId, [ITEMS[1]])
    await upload(planId, B)
    await prisma.planEditSuggestion.create({
      data: {
        cohortId, planId, batchId: randomUUID(), seq: 1, kind: 'note', step: 'modules', required: true, reasonAr: '',
        edit: { kind: 'note', step: 'modules', textAr: 'اكتب المحتوى النظري' } as never, status: 'pending',
        createdBy: randomUUID(), createdAt: new Date(Date.now() + 60_000),
      },
    })
    expect((await keepLatest(planId)).json()).toMatchObject({ withdrawn: 1 })
    expect(await statuses(planId)).toEqual([
      'module:activityAr=تمرينٌ على خريطة الجمهور:withdrawn', 'plan:summaryAr=نبذةٌ ثانية:proposed', 'note::pending',
    ])
  })
})

describe('٤ — لمن يعتمد، وعلى خطّة مفتوحة', () => {
  it('⚠️ ولا مكرر: يقال بسببه', async () => {
    const { cohortId, planId } = await openPlan()
    await upload(planId, ITEMS)
    expect(await countOf(cohortId)).toMatchObject({ older: 0 })
    const r = await keepLatest(planId)
    expect(r.statusCode).toBe(409)
    expect(r.json().error.message_ar).toMatch(/لا مكرر/)
  })

  it('⚠️ المدرّب لا يسحب', async () => {
    const { planId } = await openPlan()
    await upload(planId, [ITEMS[1]])
    await upload(planId, B)
    expect((await keepLatest(planId, 'a')).statusCode).toBe(403)
  })

  it('⚠️ والخطّة المعتمدة لا يسحب منها شيء — ولا يعرض الزرّ عددا', async () => {
    const { cohortId, planId } = await openPlan()
    await upload(planId, [ITEMS[1]])
    await upload(planId, B)
    await prisma.cohortDeliveryPlan.update({ where: { id: planId }, data: { status: 'approved' } })
    expect(await countOf(cohortId)).toMatchObject({ older: 0 })
    const r = await keepLatest(planId)
    expect(r.statusCode).toBe(409)
    expect(r.json().error.code).toBe('plan_closed')
  })
})

describe('٥ — وللخطط المفتوحة كلّها: ما ينتظر القرار وما رُدّ إلى مدرّبه', () => {
  it('⚠️ يمرّ على ما رُدّ إلى مدرّبه — وكان الزرّ يمرّ على قائمة المنتظِرة وحدها فيقول «لا مكرر»', async () => {
    const sent = await openPlan('submitted')
    const back = await openPlan('changes_requested')
    const done = await openPlan('submitted')
    for (const p of [sent, back, done]) { await upload(p.planId, [ITEMS[1]]); await upload(p.planId, B) }
    await prisma.cohortDeliveryPlan.update({ where: { id: done.planId }, data: { status: 'approved' } })

    const r = await call('POST', '/api/admin/plan-edits/keep-latest-all', 'admin', {})
    expect(r.statusCode, r.body).toBe(200)
    const body = r.json() as { checked: number; cleaned: string[]; withdrawn: number }
    expect(body.cleaned).toEqual(expect.arrayContaining([sent.planId, back.planId]))
    expect(body.cleaned, 'سحب من خطة معتمدة').not.toContain(done.planId)
    for (const p of [sent, back]) {
      expect(await statuses(p.planId)).toEqual(['module:activityAr=تمرينٌ على خريطة الجمهور:withdrawn', 'plan:summaryAr=نبذةٌ ثانية:proposed'])
    }
    expect(await statuses(done.planId)).toEqual(['module:activityAr=تمرينٌ على خريطة الجمهور:proposed', 'plan:summaryAr=نبذةٌ ثانية:proposed'])
    const again = (await call('POST', '/api/admin/plan-edits/keep-latest-all', 'admin', {})).json() as { cleaned: string[] }
    expect(again.cleaned, 'سحب مرتين').not.toEqual(expect.arrayContaining([sent.planId]))
  })

  it('⚠️ والمدرّب لا يسحب', async () => {
    expect((await call('POST', '/api/admin/plan-edits/keep-latest-all', 'a', {})).statusCode).toBe(403)
  })
})
