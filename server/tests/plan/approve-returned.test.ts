/* «اعتمدها» على الخطّة المردودة إلى مدرّبها — بما حفظه فيها الآن (١٧ أكتوبر ٢٠٢٦).

   «اريد ان اعتمد التعديلات واعتمد الدوره نفسها.. ولكن اريد ان تبقى تعديلاتي ظاهره امامه ليقوم هو بقبولها او رفضها»
   (صاحب المنصّة) — واختار «Yes, for returned plans». وهنا على قاعدةٍ حقيقيّة:

   ١) **المردودةُ تُعتمد** بما حفظه المدرّب، وبطاقاتُك تبقى عنده اقتراحاتٍ — ويقول الأثرُ إنّها اعتُمدت مردودة.
   ٢) **وتُعرض في قائمتها** لمن يعتمد، وتخرج منها حين تُعتمد.
   ٣) **ولا يُعتمد ما لم يُرسَل قطّ، ولا المؤجَّلة**، ولا تُردّ المردودةُ مرّةً ثانية. */

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
let trainerUserId = ''
let profileId = ''

const login = async (email: string) => `${SESSION_COOKIE}=${(await auth.login(email, PASS)).token}`
const call = (method: 'GET' | 'POST', url: string, who: string, payload?: unknown) =>
  app.inject({ method, url, headers: { cookie: cookies[who] }, ...(payload !== undefined ? { payload: payload as never } : {}) })

const content = {
  kind: 'trainer',
  modules: [{ moduleId: 'M1', titleAr: 'التحضير', outcomeAr: 'يحضّر', activityAr: 'يحلّ حالةً من سوقٍ أردنيّ', artifactAr: 'ورقة' }],
  resources: [],
  startsOn: '2026-12-06', endsOn: '2027-01-30',
}

async function planIn(status: string, extra: Record<string, unknown> = {}) {
  const course = await prisma.course.findFirstOrThrow({ select: { id: true } })
  const cohort = await prisma.cohort.create({
    data: {
      courseId: course.id, title: `شعبةُ المردودة ${Math.random().toString(36).slice(2)}`, status: 'draft', capacity: 20,
      scheduleWindowStart: new Date('2026-12-05T21:00:00.000Z'), scheduleWindowEnd: new Date('2027-01-30T20:59:59.999Z'),
    },
  })
  await prisma.cohortTrainer.create({ data: { cohortId: cohort.id, profileId, role: 'lead' } })
  const plan = await prisma.cohortDeliveryPlan.create({
    data: { cohortId: cohort.id, trainerId: profileId, status, ...(status !== 'draft' ? { submittedAt: new Date(), trainerConfirmedAt: new Date() } : {}), content: content as never, ...extra },
  })
  return { cohortId: cohort.id, planId: plan.id }
}
const returnedList = async () => (await call('GET', '/api/admin/cohort-plans/returned', 'admin')).json() as { id: string }[]

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)
  const admin = await auth.register(`ar-admin-${STAMP}@test.local`, PASS, 'المعتمِد')
  await auth.setRoles(admin.userId, ['academic_manager'])
  cookies.admin = await login(`ar-admin-${STAMP}@test.local`)
  const email = `ar-a-${STAMP}@test.local`
  const u = await auth.register(email, PASS, 'مدرّب المردودة')
  await auth.setRoles(u.userId, ['trainer'])
  trainerUserId = u.userId
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-AR-${STAMP}`, email, fullName: 'مدرّب المردودة', phoneCountryCode: '+962', phone: `792${STAMP % 1000000}`, country: 'الأردن', status: 'active' },
  })
  profileId = (await prisma.trainerProfile.create({ data: { applicationId: application.id, userId: u.userId } })).id
  cookies.a = await login(email)
}, 240_000)

describe('١ و٢ — المردودة تعتمد بما حفظه، وبطاقاتك تبقى عنده', () => {
  let x: Awaited<ReturnType<typeof planIn>>
  let cardId = ''

  it('⚠️ تردّ ببطاقتها فتظهر في «رددتها إلى مدربيها»', async () => {
    x = await planIn('submitted')
    const up = await call('POST', `/api/admin/cohort-plans/${x.planId}/edits`, 'admin', {
      items: [{ kind: 'module', moduleId: 'M1', required: true, reasonAr: 'مخرجٌ أوضح', set: { outcomeAr: 'يحضّر ملفّ تفاوضٍ كاملا' } }],
    })
    expect(up.statusCode, up.body).toBe(201)
    cardId = (await prisma.planEditSuggestion.findFirstOrThrow({ where: { planId: x.planId } })).id
    expect((await call('POST', `/api/admin/cohort-plans/${x.planId}/edits/approve-all`, 'admin', {})).statusCode).toBe(200)
    expect((await call('POST', `/api/admin/cohort-plans/${x.planId}/decide`, 'admin', { approve: false })).statusCode).toBe(200)
    expect((await returnedList()).map((r) => r.id)).toContain(x.planId)
  })

  it('⚠️ وتعتمد وهي عنده — والبطاقة تبقى اقتراحا، والأثر يقول إنها اعتمدت مردودة', async () => {
    const r = await call('POST', `/api/admin/cohort-plans/${x.planId}/decide`, 'admin', { approve: true })
    expect(r.statusCode, r.body).toBe(200)
    expect((await prisma.cohortDeliveryPlan.findUniqueOrThrow({ where: { id: x.planId } })).status).toBe('approved')
    const card = await prisma.planEditSuggestion.findUniqueOrThrow({ where: { id: cardId } })
    expect([card.status, card.required], 'سقطت البطاقة أو بقيت مطلوبة').toEqual(['pending', false])
    const ev = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'cohort.plan.approve', entityId: x.cohortId } })
    expect(ev.meta).toMatchObject({ planId: x.planId, fromReturned: true })
    expect((await returnedList()).map((r) => r.id), 'بقيت في قائمة المردودة').not.toContain(x.planId)
    const told = await prisma.notification.findFirstOrThrow({ where: { userId: trainerUserId, templateKey: 'cohort.plan.decision', title: { contains: 'اعتمدت خطّة' } } })
    expect(told.body).toContain('اقتراح واحد من الإدارة')
  })

  it('ويقبلها المدرّب فتكتب في الخطّة المعتمدة', async () => {
    expect((await call('POST', `/api/trainer/plan-edits/${cardId}/accept`, 'a', {})).statusCode).toBe(200)
    const plan = await prisma.cohortDeliveryPlan.findUniqueOrThrow({ where: { id: x.planId } })
    expect([plan.status, (plan.content as typeof content).modules[0]!.outcomeAr]).toEqual(['approved', 'يحضّر ملفّ تفاوضٍ كاملا'])
  })
})

describe('٣ — ولا يعتمد ما لم يرسل قطّ، ولا المؤجّلة، ولا تردّ المردودة مرّة ثانية', () => {
  it('⚠️ مسوّدة لم يرسلها قطّ — لا تعتمد ولا تعرض', async () => {
    const d = await planIn('draft')
    expect((await call('POST', `/api/admin/cohort-plans/${d.planId}/decide`, 'admin', { approve: true })).statusCode).toBe(409)
    expect((await returnedList()).map((r) => r.id)).not.toContain(d.planId)
    expect((await prisma.cohortDeliveryPlan.findUniqueOrThrow({ where: { id: d.planId } })).status).toBe('draft')
  })

  it('⚠️ والمؤجّلة إلى موسم قادم — لا تعتمد ولا تعرض', async () => {
    const p = await planIn('changes_requested', { postponedTo: new Date('2027-03-01T00:00:00.000Z') })
    expect((await call('POST', `/api/admin/cohort-plans/${p.planId}/decide`, 'admin', { approve: true })).statusCode).toBe(409)
    expect((await returnedList()).map((r) => r.id)).not.toContain(p.planId)
  })

  it('⚠️ والمردودة لا تردّ مرّة ثانية', async () => {
    const r = await planIn('changes_requested')
    expect((await call('POST', `/api/admin/cohort-plans/${r.planId}/decide`, 'admin', { approve: false })).statusCode).toBe(409)
  })

  it('⚠️ والقائمة لمن يعتمد وحده', async () => {
    expect((await call('GET', '/api/admin/cohort-plans/returned', 'a')).statusCode).toBe(403)
  })
})
