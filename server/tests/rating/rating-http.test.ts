/* صلاحيات التقييم على HTTP الفعلي (١و).

   اختبارات الخدمة تثبت المنطق، ولا تثبت أن المسار محميّ. وهنا بالضبط يقع
   التسريب: نقطةٌ تُضاف بلا preHandler فيقرأ متعلّمٌ ما قيل عن مدرّبه، أو
   يعتمد تعليقا للنشر. فكل مسار يُطرَق زائرا ومتعلّما ومدرّبا وإدارة. */

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
let learnerCookie = ''
let trainerCookie = ''
let adminCookie = ''
let ratingId = ''

async function cookieFor(email: string, password: string): Promise<string> {
  const { token } = await auth.login(email, password)
  return `${SESSION_COOKIE}=${token}`
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)
  await app.ready()

  const admin = await auth.register('rh-admin@test.local', 'Admin#12345', 'مدير')
  await auth.setRoles(admin.userId, ['academic_manager'])
  adminCookie = await cookieFor('rh-admin@test.local', 'Admin#12345')

  /* مدرّب له حساب وملفّ */
  const tUser = await auth.register('rh-trainer@test.local', 'Trainer#12345', 'مدرّب')
  await auth.setRoles(tUser.userId, ['trainer'])
  trainerCookie = await cookieFor('rh-trainer@test.local', 'Trainer#12345')
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-HTTP-${Date.now()}`, fullName: 'مدرّب HTTP', email: 'rh-trainer@test.local',
      phone: '0790000009', status: 'active', motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  const profile = await prisma.trainerProfile.create({
    data: { applicationId: application.id, userId: tUser.userId, isVerified: true },
  })

  const cohort = await prisma.cohort.create({
    data: {
      courseId: 'C-BIZ-101', title: 'شعبة HTTP', status: 'active', registrationOpen: false,
      financialReady: true, price: 10, currency: 'JOD', capacity: 20,
      startsAt: new Date(Date.now() - 86_400_000),
    },
  })
  await prisma.cohortTrainer.create({ data: { cohortId: cohort.id, profileId: profile.id, role: 'lead' } })

  const learner = await auth.register('rh-learner@test.local', 'Learner#12345', 'متعلّم')
  learnerCookie = await cookieFor('rh-learner@test.local', 'Learner#12345')
  const enrollment = await prisma.enrollment.create({ data: { userId: learner.userId, cohortId: cohort.id, status: 'enrolled' } })

  const res = await app.inject({
    method: 'POST', url: '/api/learner/ratings', headers: { cookie: learnerCookie },
    payload: { enrollmentId: enrollment.id, subjectType: 'trainer', subjectId: profile.id, score: 4, commentAr: 'تعليق للمراجعة' },
  })
  expect(res.statusCode).toBe(201)
  ratingId = (await prisma.rating.findFirstOrThrow({ where: { enrollmentId: enrollment.id } })).id
}, 240_000)

describe('الزائر لا يصل شيئا', () => {
  it.each([
    ['GET', '/api/learner/rateable'],
    ['GET', '/api/me/ratings'],
    ['GET', '/api/admin/ratings/queue'],
  ])('%s %s → 401', async (method, url) => {
    const res = await app.inject({ method: method as 'GET', url })
    expect(res.statusCode).toBe(401)
  })
})

describe('المتعلّم', () => {
  it('يرى ما يستطيع تقييمه', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/learner/rateable', headers: { cookie: learnerCookie } })
    expect(res.statusCode).toBe(200)
    expect(res.json().length).toBeGreaterThan(0)
  })

  it('لا يقرأ سطح «ما قيل عنّي» — ليس مدرّبا ولا مستشارا', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/ratings', headers: { cookie: learnerCookie } })
    expect(res.statusCode).toBe(403)
  })

  it('لا يفتح طابور المراجعة ولا يعتمد تعليقا', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/admin/ratings/queue', headers: { cookie: learnerCookie } })).statusCode).toBe(403)
    const res = await app.inject({
      method: 'POST', url: `/api/admin/ratings/${ratingId}/moderate`,
      headers: { cookie: learnerCookie }, payload: { approve: true },
    })
    expect(res.statusCode).toBe(403)
  })

  it('درجة خارج المدى تُرفض على الحدّ لا في الخدمة وحدها', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/learner/rateable', headers: { cookie: learnerCookie } })
    const first = list.json()[0]
    const res = await app.inject({
      method: 'POST', url: '/api/learner/ratings', headers: { cookie: learnerCookie },
      payload: { enrollmentId: first.enrollmentId, subjectType: first.subjectType, subjectId: first.subjectId, score: 9 },
    })
    expect(res.statusCode).toBeGreaterThanOrEqual(400)
    expect(res.statusCode).toBeLessThan(500)
  })
})

describe('المدرّب', () => {
  it('يقرأ ما قيل عنه — ودون العتبة لا يُكشف شيء', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/ratings', headers: { cookie: trainerCookie } })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.trainer.revealed).toBe(false)
    expect(JSON.stringify(body)).not.toContain('تعليق للمراجعة')
  })

  it('لا يعتمد تعليقا لنشره عن نفسه', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/admin/ratings/${ratingId}/moderate`,
      headers: { cookie: trainerCookie }, payload: { approve: true },
    })
    expect(res.statusCode).toBe(403)
  })

  it('لا يرسل تقييما — ليس متعلّما', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/learner/ratings', headers: { cookie: trainerCookie },
      payload: { enrollmentId: crypto.randomUUID(), subjectType: 'course', subjectId: 'C-BIZ-101', score: 5 },
    })
    expect(res.statusCode).toBe(403)
  })
})

describe('الإدارة', () => {
  it('تفتح الطابور وتراه بلا معرّف مُقيِّم', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/ratings/queue', headers: { cookie: adminCookie } })
    expect(res.statusCode).toBe(200)
    const rows = res.json()
    expect(rows.length).toBeGreaterThan(0)
    expect(JSON.stringify(rows)).not.toContain('raterId')
  })

  it('تعتمد التعليق، والحالة تنتقل', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/admin/ratings/${ratingId}/moderate`,
      headers: { cookie: adminCookie }, payload: { approve: true },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().publishStatus).toBe('approved')
  })
})
