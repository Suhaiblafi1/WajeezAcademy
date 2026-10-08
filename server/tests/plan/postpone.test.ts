/* تأجيلُ الشعبة إلى موسمٍ قادم — قرارٌ ثالثٌ بجانب الاعتماد والردّ (٨ أكتوبر ٢٠٢٦).

   «أختار أفضلَ اثنتين أو ثلاث… وأقول لهم أن يؤجّلوا الباقية — ويجب أن يعرفوا أنّي لا أقبلها
   لهذا الفصل» (صاحب المنصّة). وهنا على قاعدةٍ حقيقيّة:

   ١) **من يؤجّل**: المعتمِدُ وحدَه، وإلى موسمٍ بعد موسمها لا إليه.
   ٢) **ما يقع**: تعود إلى يد المدرّب بموسمها الجديد، وتنتقل الشعبةُ إلى فصله، ويُقال له
      بالجرس إنّها لم تُقبل لهذا الفصل، ويُكتب الأثر.
   ٣) **ولا تُرسَل لهذا الفصل ثانيةً** — يُسمّى السببُ في صفّ خطوتها الأولى وفي ردّ الإرسال.
   ٤) **ولا تُؤجَّل شعبةٌ تعمل**، ولا ما ليس بانتظار قرار. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import { CohortPlanService } from '../../services/cohort-plan.service'

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
let springTermId = ''

const login = async (email: string) => `${SESSION_COOKIE}=${(await auth.login(email, PASS)).token}`
const post = (url: string, who: string, payload: unknown) =>
  app.inject({ method: 'POST', url, headers: { cookie: cookies[who] }, payload: payload as never })

const WINTER = { startsOn: '2026-12-06', endsOn: '2027-01-30' }
const winterContent = { kind: 'trainer', modules: [{ moduleId: 'M1', titleAr: 'محور' }], resources: [], ...WINTER }

async function submittedCohort(title: string) {
  const course = await prisma.course.findFirstOrThrow({ select: { id: true } })
  const cohort = await prisma.cohort.create({ data: { courseId: course.id, title, status: 'active', capacity: 20 } })
  await prisma.cohortTrainer.create({ data: { cohortId: cohort.id, profileId, role: 'lead' } })
  const plan = await prisma.cohortDeliveryPlan.create({
    data: { cohortId: cohort.id, trainerId: profileId, status: 'submitted', submittedAt: new Date(), content: winterContent as never },
  })
  return { cohortId: cohort.id, planId: plan.id }
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)

  const admin = await auth.register(`pp-admin-${STAMP}@test.local`, PASS, 'المعتمِد')
  await auth.setRoles(admin.userId, ['academic_manager'])
  cookies.admin = await login(`pp-admin-${STAMP}@test.local`)

  const email = `pp-trainer-${STAMP}@test.local`
  const u = await auth.register(email, PASS, 'مدرّبٌ بستّ دورات')
  await auth.setRoles(u.userId, ['trainer'])
  trainerUserId = u.userId
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `WJ-TR-PP-${STAMP}`, email, fullName: 'مدرّبٌ بستّ دورات',
      phoneCountryCode: '+962', phone: `7955${STAMP % 100000}`, country: 'الأردن', status: 'active',
    },
  })
  profileId = (await prisma.trainerProfile.create({ data: { applicationId: application.id, userId: u.userId } })).id
  cookies.trainer = await login(email)

  /* فصلُ الربيع موجود — فتنتقل إليه الشعبة */
  const spring = await prisma.term.upsert({
    where: { year_season: { year: 2027, season: 'feb_apr' } },
    update: {},
    create: { year: 2027, season: 'feb_apr', titleAr: 'موسم الربيع 2027', startsOn: new Date('2027-02-01'), endsOn: new Date('2027-04-30') },
  })
  springTermId = spring.id
  ;({ cohortId, planId } = await submittedCohort('شعبةُ التفاوض — تُؤجَّل'))
}, 240_000)

describe('١ — من يؤجّل، وإلى أين', () => {
  it('⚠️ المدرّبُ لا يؤجّل', async () => {
    expect((await post(`/api/admin/cohort-plans/${planId}/postpone`, 'trainer', { year: 2027, season: 'feb_apr' })).statusCode).toBe(403)
  })

  it('⚠️ ولا يُؤجَّل إلى موسمها نفسِه', async () => {
    const r = await post(`/api/admin/cohort-plans/${planId}/postpone`, 'admin', { year: 2026, season: 'nov_jan' })
    expect(r.statusCode).toBe(400)
    expect((await prisma.cohortDeliveryPlan.findUniqueOrThrow({ where: { id: planId } })).status).toBe('submitted')
  })
})

describe('٢ — ما يقع بالتأجيل', () => {
  it('تعود إليه بموسمها الجديد، وتنتقل الشعبةُ إلى فصله', async () => {
    const r = await post(`/api/admin/cohort-plans/${planId}/postpone`, 'admin', { year: 2027, season: 'feb_apr', note: 'اخترنا لك ثلاثا هذا الفصل.' })
    expect(r.statusCode, r.body).toBe(200)
    expect(r.json()).toEqual({ status: 'postponed', postponedTo: '2027-02-01' })
    const plan = await prisma.cohortDeliveryPlan.findUniqueOrThrow({ where: { id: planId } })
    expect(plan.status).toBe('changes_requested')
    expect(plan.postponedTo?.toISOString().slice(0, 10)).toBe('2027-02-01')
    expect((await prisma.cohort.findUniqueOrThrow({ where: { id: cohortId } })).termId).toBe(springTermId)
  })

  it('⚠️ ويقول له الجرسُ صراحةً إنّها لم تُقبل لهذا الفصل — ومعه كلمةُ الإدارة', async () => {
    const bell = await prisma.notification.findFirst({
      where: { userId: trainerUserId, templateKey: 'cohort.plan.decision' }, orderBy: { queuedAt: 'desc' },
    })
    expect(bell?.title).toBe('«شعبةُ التفاوض — تُؤجَّل» مؤجّلةٌ إلى موسم الربيع 2027')
    expect(bell?.body).toContain('لم تُقبل «شعبةُ التفاوض — تُؤجَّل» لموسم الشتاء 2026، وأُجّلت إلى موسم الربيع 2027')
    expect(bell?.body).toContain('وكلمةُ الإدارة: اخترنا لك ثلاثا هذا الفصل.')
  })

  it('ويُكتب الأثر', async () => {
    const row = await prisma.auditEvent.findFirst({ where: { action: 'cohort.plan.postpone', entityId: cohortId } })
    expect(row).not.toBeNull()
  })
})

describe('٣ — ولا تُرسَل لهذا الفصل ثانيةً', () => {
  it('⚠️ صفُّ خطوتها الأولى يسمّي موسمَها، والإرسالُ يُردّ به', async () => {
    const plans = new CohortPlanService(prisma)
    const ws = await plans.workspace(trainerUserId, cohortId)
    expect(ws.plan?.postponedTo).toBe('2027-02-01')
    const identity = ws.checklist.find((c) => c.key === 'identity')!
    expect(identity.done).toBe(false)
    expect(identity.labelAr).toContain('مؤجّلةٌ إلى موسم الربيع 2027')
    await expect(plans.submit(trainerUserId, cohortId, true)).rejects.toMatchObject({
      code: 'stages_incomplete', message: expect.stringContaining('مؤجّلةٌ إلى موسم الربيع 2027'),
    })
  })

  it('وحين يجعل بدايتَها في موسمها يرتفع السببُ من صفّها', async () => {
    const plans = new CohortPlanService(prisma)
    await plans.savePlan(trainerUserId, cohortId, { ...winterContent, startsOn: '2027-02-07', endsOn: '2027-04-10' } as never)
    const identity = (await plans.workspace(trainerUserId, cohortId)).checklist.find((c) => c.key === 'identity')!
    expect(identity.labelAr).not.toContain('مؤجّلةٌ')
    /* والحفظُ لا يمحو التأجيل — يبقى حتّى يُقرَّر فيها لموسمها */
    expect((await prisma.cohortDeliveryPlan.findUniqueOrThrow({ where: { id: planId } })).postponedTo).not.toBeNull()
  })
})

describe('٤ — ما لا يُؤجَّل', () => {
  it('⚠️ ما ليس بانتظار قرار — ٤٠٩', async () => {
    expect((await post(`/api/admin/cohort-plans/${planId}/postpone`, 'admin', { year: 2027, season: 'feb_apr' })).statusCode).toBe(409)
  })

  it('⚠️ وشعبةٌ اعتُمدت من قبل وتعمل — مراجعتُها لا تُؤجَّل', async () => {
    const running = await submittedCohort('شعبةٌ تعمل')
    await prisma.cohortDeliveryPlan.create({
      data: { cohortId: running.cohortId, trainerId: profileId, status: 'approved', content: winterContent as never, createdAt: new Date(Date.now() - 86_400_000) },
    })
    const r = await post(`/api/admin/cohort-plans/${running.planId}/postpone`, 'admin', { year: 2027, season: 'feb_apr' })
    expect(r.statusCode).toBe(409)
    expect(r.json().error.code).toBe('running_cohort')
  })
})
