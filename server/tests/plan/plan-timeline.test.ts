/* سجلُّ تواصل الخطّة ووسمُ جولتها — على قاعدةٍ حقيقيّة (١٧ أكتوبر ٢٠٢٦).

   ١) السجلُّ من أثر **هذه** الخطّة وحدَها — لا من خطّةٍ أخرى للشعبة نفسِها، ولا من شعبةٍ أخرى.
   ٢) وبأسماء من فعل.
   ٣) والطابورُ يقول «جديدة» أم كم مرّةً رُدّت.
   ٤) وللإدارة وحدَها — المدرّبُ لا يفتحه. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import { recordAudit } from '../../services/audit'
import { CohortPlanService } from '../../services/cohort-plan.service'

let prisma: PrismaClient
let auth: AuthService
let app: FastifyInstance
const STAMP = Date.now()
const PASS = 'Pass#12345'
const cookies: Record<string, string> = {}
let adminId = ''
let trainerUserId = ''
let profileId = ''

const login = async (email: string) => `${SESSION_COOKIE}=${(await auth.login(email, PASS)).token}`
const get = (url: string, who: string) => app.inject({ method: 'GET', url, headers: { cookie: cookies[who] } })

async function plan(title: string, status = 'submitted') {
  const course = await prisma.course.findFirstOrThrow({ select: { id: true } })
  const cohort = await prisma.cohort.create({ data: { courseId: course.id, title, status: 'draft', capacity: 20 } })
  await prisma.cohortTrainer.create({ data: { cohortId: cohort.id, profileId, role: 'lead' } })
  const p = await prisma.cohortDeliveryPlan.create({
    data: { cohortId: cohort.id, trainerId: profileId, status, submittedAt: new Date(), content: { kind: 'trainer', modules: [] } as never },
  })
  return { cohortId: cohort.id, planId: p.id }
}

const audit = (actorId: string, action: string, cohortId: string, meta: Record<string, unknown>) =>
  recordAudit(prisma, { actorId, action, entityType: 'cohort', entityId: cohortId, meta })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)

  const admin = await auth.register(`tl-admin-${STAMP}@test.local`, PASS, 'المعتمد')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
  cookies.admin = await login(`tl-admin-${STAMP}@test.local`)

  const email = `tl-trainer-${STAMP}@test.local`
  const u = await auth.register(email, PASS, 'مدرب السجل')
  trainerUserId = u.userId
  await auth.setRoles(trainerUserId, ['trainer'])
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-TL-${STAMP}`, email, fullName: 'مدرب السجل', phoneCountryCode: '+962', phone: `7966${STAMP % 100000}`, country: 'الأردن', status: 'active' },
  })
  profileId = (await prisma.trainerProfile.create({ data: { applicationId: application.id, userId: trainerUserId } })).id
  cookies.trainer = await login(email)
}, 240_000)

describe('السجل', () => {
  it('من أثر هذه الخطة وحدها، بالترتيب وبأسماء من فعل', async () => {
    const a = await plan('شعبة السجل')
    const other = await plan('شعبة أخرى')
    await audit(trainerUserId, 'cohort.plan.submit', a.cohortId, { planId: a.planId })
    await audit(adminId, 'cohort.plan.edits.propose', a.cohortId, { planId: a.planId, count: 3 })
    await audit(adminId, 'cohort.plan.changes_requested', a.cohortId, { planId: a.planId })
    await audit(trainerUserId, 'cohort.plan.edit.accept', a.cohortId, { planId: a.planId })
    await audit(trainerUserId, 'cohort.plan.submit', a.cohortId, { planId: a.planId })
    /* خطةٌ قديمةٌ للشعبة نفسِها، وشعبةٌ أخرى — لا يدخلان */
    await audit(adminId, 'cohort.plan.approve', a.cohortId, { planId: other.planId })
    await audit(adminId, 'cohort.plan.approve', other.cohortId, { planId: a.planId })

    const r = await get(`/api/admin/cohort-plans/${a.planId}/timeline`, 'admin')
    expect(r.statusCode, r.body).toBe(200)
    const body = r.json() as { returns: number; entries: { labelAr: string; by: string | null; side: string }[] }
    expect(body.entries.map((e) => e.labelAr)).toEqual([
      'أرسل الخطة للاعتماد', 'أرسلت 3 بطاقة تعديل', 'ردّت الخطة بتعديلات', 'قبل 1 بطاقة', 'أعاد إرسال الخطة بعد التعديلات',
    ])
    expect(body.entries[0]!.by).toBe('مدرب السجل')
    expect(body.entries[1]!.by).toBe('المعتمد')
    expect(body.returns).toBe(1)

    /* والطابورُ يقول جولتَها */
    const pending = await new CohortPlanService(prisma).pending()
    expect(pending.find((p) => p.id === a.planId)?.returns).toBe(1)
    expect(pending.find((p) => p.id === other.planId)?.returns).toBe(0)
  })

  it('وللإدارة وحدها — المدرب لا يفتحه', async () => {
    const a = await plan('شعبة المدرب')
    expect((await get(`/api/admin/cohort-plans/${a.planId}/timeline`, 'trainer')).statusCode).toBe(403)
  })
})
