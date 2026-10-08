/* تقريرُ المراجعة — يرفعه المعتمِدُ مع قراره، ويُحفظ مع الخطّة، ويقرؤه مدرّبُها (٨ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: التقريرُ يصل المدرّبَ من المنصّة نفسِها لا بريدا من خارجها. وهنا على
   قاعدةٍ ومخزنٍ حقيقيّين:

   ١) **المعتمِدُ يرفعه** برابطٍ موقَّتٍ كأيّ ملفّ شعبة، والبايتاتُ تصل المخزن، وتراه بطاقتُه.
   ٢) **ومن يقرؤه**: مدرّبُ الشعبة والإدارة — لا المتعلّمُ الملتحق ولا مدرّبٌ آخر.
   ٣) **والمدرّبُ لا يرفع تقريرا** باسم خطّته من بابه.
   ٤) **ورسالةُ القرار تذكره** وتدلّ على موضعه، وصفحةُ المدرّب تحمله.
   ٥) **ولا يُرفع بعد القرار** — لا تذكره رسالةٌ ولا يدري به أحد. */

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
let reportKey = ''
const REPORT = Buffer.from('%PDF-1.4\n% تقريرُ مراجعة\n%%EOF\n')

const login = async (email: string) => `${SESSION_COOKIE}=${(await auth.login(email, PASS)).token}`
const call = (method: 'GET' | 'POST' | 'DELETE' | 'PUT', url: string, who?: string, payload?: unknown, headers: Record<string, string> = {}) =>
  app.inject({ method, url, headers: { ...(who ? { cookie: cookies[who] } : {}), ...headers }, ...(payload === undefined ? {} : { payload: payload as never }) })

async function trainerFor(tag: string) {
  const email = `rr-${tag}-${STAMP}@test.local`
  const u = await auth.register(email, PASS, `مدرّب ${tag}`)
  await auth.setRoles(u.userId, ['trainer'])
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `WJ-TR-RR-${tag}-${STAMP}`, email, fullName: `مدرّب ${tag}`,
      phoneCountryCode: '+962', phone: `77900${tag.length}${STAMP % 1000}`, country: 'الأردن', status: 'active',
    },
  })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: application.id, userId: u.userId } })
  cookies[tag] = await login(email)
  return { userId: u.userId, profileId: profile.id }
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)

  const admin = await auth.register(`rr-admin-${STAMP}@test.local`, PASS, 'المعتمِد')
  await auth.setRoles(admin.userId, ['academic_manager'])
  cookies.admin = await login(`rr-admin-${STAMP}@test.local`)

  const owner = await trainerFor('owner')
  trainerUserId = owner.userId
  await trainerFor('other')
  const learner = await auth.register(`rr-learner-${STAMP}@test.local`, PASS, 'متعلّم')
  cookies.learner = await login(`rr-learner-${STAMP}@test.local`)

  const course = await prisma.course.findFirstOrThrow({ select: { id: true } })
  const cohort = await prisma.cohort.create({ data: { courseId: course.id, title: 'شعبةُ التقرير', status: 'active', capacity: 20 } })
  cohortId = cohort.id
  await prisma.cohortTrainer.create({ data: { cohortId, profileId: owner.profileId, role: 'lead' } })
  await prisma.enrollment.create({ data: { cohortId, userId: learner.userId, status: 'enrolled' } })
  const plan = await prisma.cohortDeliveryPlan.create({
    data: {
      cohortId, trainerId: owner.profileId, status: 'submitted', submittedAt: new Date(),
      content: { kind: 'trainer', modules: [{ moduleId: 'M1', titleAr: 'محور' }], resources: [] } as never,
    },
  })
  planId = plan.id
}, 240_000)

describe('١ — المعتمِدُ يرفعه، والبايتاتُ تصل، وتراه بطاقتُه', () => {
  it('رابطُ رفعٍ موقَّت، ثمّ البايتاتُ إليه، ثمّ يُرى في الخطّة', async () => {
    const start = await call('POST', `/api/admin/cohort-plans/${planId}/review-report`, 'admin', { mime: 'application/pdf', originalName: 'تقرير مراجعة الخطة.pdf' })
    expect(start.statusCode, start.body).toBe(201)
    const { uploadUrl, storageKey } = JSON.parse(start.body) as { uploadUrl: string; storageKey: string }
    reportKey = storageKey
    const put = await call('PUT', uploadUrl, undefined, REPORT, { 'content-type': 'application/pdf' })
    expect(put.statusCode, put.body).toBeLessThan(300)

    const view = JSON.parse((await call('GET', `/api/admin/cohorts/${cohortId}/trainer-plan`, 'admin')).body) as { reviewReports: { storageKey: string; originalName: string }[] }
    expect(view.reviewReports.map((r) => r.originalName)).toEqual(['تقرير مراجعة الخطة.pdf'])
  })

  it('ولا تُقبل شرائح — PDF أو Word وحدَهما', async () => {
    const r = await call('POST', `/api/admin/cohort-plans/${planId}/review-report`, 'admin', {
      mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', originalName: 'x.pptx',
    })
    expect(r.statusCode).toBe(422)
  })
})

describe('٢ — من يقرؤه', () => {
  it('مدرّبُ الشعبة يقرؤه ببايتاته، والإدارةُ كذلك', async () => {
    const t = await call('GET', `/api/v1/cohort-files/${reportKey}`, 'owner')
    expect(t.statusCode).toBe(200)
    expect(t.rawPayload.equals(REPORT)).toBe(true)
    expect((await call('GET', `/api/v1/cohort-files/${reportKey}`, 'admin')).statusCode).toBe(200)
  })

  it('⚠️ والمتعلّمُ الملتحقُ لا يقرؤه، ولا مدرّبٌ آخر — ٤٠٤ لا ٤٠٣', async () => {
    expect((await call('GET', `/api/v1/cohort-files/${reportKey}`, 'learner')).statusCode).toBe(404)
    expect((await call('GET', `/api/v1/cohort-files/${reportKey}`, 'other')).statusCode).toBe(404)
  })
})

describe('٣ — والمدرّبُ لا يرفع تقريرا', () => {
  it('⚠️ بابُ المدرّب يردّ الغرضَ — وبابُ المعتمِد يردّ المدرّب', async () => {
    const own = await call('POST', `/api/trainer/cohorts/${cohortId}/files`, 'owner', {
      purpose: 'review_report', refId: planId, mime: 'application/pdf', originalName: 'تقريري.pdf',
    })
    expect(own.statusCode, 'صار المدرّبُ يرفع تقريرَ مراجعة خطّته').toBe(400)
    expect((await call('POST', `/api/admin/cohort-plans/${planId}/review-report`, 'owner', { mime: 'application/pdf', originalName: 'x.pdf' })).statusCode).toBe(403)
  })
})

describe('٤ — رسالةُ القرار تذكره، وصفحةُ المدرّب تحمله', () => {
  it('الردُّ بتعديلاتٍ يقول في الجرس إنّ التقريرَ في صفحة الشعبة', async () => {
    const r = await call('POST', `/api/admin/cohort-plans/${planId}/decide`, 'admin', { approve: false, note: { workbooks: 'ضع كرّاسةَ المحور الأوّل.' } })
    expect(r.statusCode, r.body).toBe(200)
    const bell = await prisma.notification.findFirst({
      where: { userId: trainerUserId, templateKey: 'cohort.plan.decision' }, orderBy: { queuedAt: 'desc' },
    })
    expect(bell?.body).toContain('«تقرير مراجعة الخطة.pdf»')
    expect(bell?.body).toContain('تجده في صفحة شعبتك تحت «تقرير المراجعة»')
  })

  it('وصفحةُ المدرّب تحمل التقرير', async () => {
    const ws = await new CohortPlanService(prisma).workspace(trainerUserId, cohortId)
    expect(ws.reviewReports.map((r) => r.originalName)).toEqual(['تقرير مراجعة الخطة.pdf'])
  })
})

describe('٥ — ولا يُرفع ولا يُحذف بعد القرار', () => {
  it('الخطّةُ ليست بانتظار قرارٍ — ٤٠٩ بسببه', async () => {
    expect((await call('POST', `/api/admin/cohort-plans/${planId}/review-report`, 'admin', { mime: 'application/pdf', originalName: 'متأخّر.pdf' })).statusCode).toBe(409)
    expect((await call('DELETE', `/api/admin/cohort-plans/${planId}/review-report/${reportKey}`, 'admin')).statusCode).toBe(409)
  })
})
