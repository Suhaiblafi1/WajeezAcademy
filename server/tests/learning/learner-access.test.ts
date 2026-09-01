/* الطلبةُ المسجَّلون — كلُّ دورٍ يرى نطاقَه، ولا شيءَ في الطلب يوسّعه.

   قرارُ صاحب المنصّة: «أضف لبوابات السوبر، والمدير الأكاديميّ، والمدرّب
   (طلابه فقط)، والمستشار (حالاته فقط) وصولا لقائمة الطلبة المسجَّلين مع
   صلاحية حذف/إضافة طالب أو تعديل حسابه — كلُّ دورٍ يرى نطاقَه فقط».

   والبابُ واحد لأربعة أدوار. ولو أخذ معامِلا يقول «أرِني طلبةَ فلان» لصار
   حدُّ كلِّ دورٍ في يد العميل: يكفي أن يبدّل المدرّبُ معرّفا ليرى طلبةَ
   غيره. فالنطاقُ يُشتقّ من صلاحيّات صاحب الجلسة، وهذا ما يحرسه الملفّ —
   على HTTP لا على الخدمة وحدَها، لأنّ الثغرةَ لو وقعت فهناك تقع.

   وفرقٌ ثانٍ يُحرَس: **الرؤيةُ لا تُعطي التعديل**. المدرّبُ يرى طلبتَه ولا
   يسجّل أحدا ولا يحذفه، والمستشارُ يتابع ولا يعدّل حسابا. ولو جاز غيرُ ذلك
   لصار من يرى قادرا على أن يغيّر. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { EnrollmentService } from '../../services/enrollment.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let auth: AuthService
let app: FastifyInstance

let adminCookie = ''
let trainerCookie = ''
let advisorCookie = ''
let learnerCookie = ''

let mineId = ''      // طالبٌ في شعبة المدرّب، وعميلُ حالة المستشار
let othersId = ''    // طالبٌ في شعبةٍ أخرى، ولا حالةَ له
let mineEnrollment = ''
let freeCohortId = ''

const cookieFor = async (email: string, password: string) =>
  `${SESSION_COOKIE}=${(await auth.login(email, password)).token}`

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)
  const enrollments = new EnrollmentService(prisma)

  const admin = await auth.register('la-admin@test.local', 'Admin#12345', 'مدير العمليات')
  await auth.setRoles(admin.userId, ['operations_manager'])
  adminCookie = await cookieFor('la-admin@test.local', 'Admin#12345')

  const trainerUser = await auth.register('la-trainer@test.local', 'Trainer#12345', 'المدرّب')
  await auth.setRoles(trainerUser.userId, ['trainer'])
  trainerCookie = await cookieFor('la-trainer@test.local', 'Trainer#12345')

  const advisorUser = await auth.register('la-advisor@test.local', 'Advisor#12345', 'المستشار')
  await auth.setRoles(advisorUser.userId, ['advisor'])
  advisorCookie = await cookieFor('la-advisor@test.local', 'Advisor#12345')

  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-LA-${Date.now()}`, fullName: 'المدرّب', email: 'la-trainer@test.local',
      status: 'active', motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  const profile = await prisma.trainerProfile.create({
    data: { applicationId: application.id, userId: trainerUser.userId, isVerified: true },
  })

  const mkCohort = async (title: string) => prisma.cohort.create({
    data: {
      courseId: 'C-BIZ-101', title, status: 'open', registrationOpen: true,
      financialReady: true, price: 100, currency: 'USD', capacity: 30,
      startsAt: new Date(Date.now() + 30 * 86_400_000),
    },
  })

  const mine = await mkCohort('شعبةُ المدرّب')
  await prisma.cohortTrainer.create({ data: { cohortId: mine.id, profileId: profile.id, role: 'lead' } })
  const others = await mkCohort('شعبةُ غيره')
  freeCohortId = (await mkCohort('شعبةٌ للتسجيل الإداريّ')).id

  const m = await auth.register('la-mine@test.local', 'Learner#12345', 'طالبُ الشعبة')
  mineId = m.userId
  learnerCookie = await cookieFor('la-mine@test.local', 'Learner#12345')
  mineEnrollment = (await enrollments.enroll(mine.id, mineId, null, {})).id

  const o = await auth.register('la-others@test.local', 'Learner#12345', 'طالبُ شعبةٍ أخرى')
  othersId = o.userId
  await enrollments.enroll(others.id, othersId, null, {})

  /* حالةٌ مسندةٌ للمستشار، عميلُها طالبُ الشعبة */
  const c = await prisma.advisorCase.create({ data: { clientId: mineId, status: 'enrolled' } })
  await prisma.advisorAssignment.create({ data: { caseId: c.id, advisorId: advisorUser.userId } })
}, 240_000)

const listFor = async (cookie: string) =>
  app.inject({ method: 'GET', url: '/api/staff/learners', headers: { cookie } })

describe('كلُّ دورٍ يرى نطاقَه', () => {
  it('من يدير التسجيل يرى الطلبة كلَّهم', async () => {
    const r = await listFor(adminCookie)
    expect(r.statusCode, r.body).toBe(200)
    const ids = r.json().learners.map((l: { user: { id: string } }) => l.user.id)
    expect(r.json().scope).toBe('all')
    expect(ids).toContain(mineId)
    expect(ids).toContain(othersId)
  })

  it('والمدرّبُ يرى طلبةَ شعبه وحدَهم — لا كلَّ الطلبة', async () => {
    const r = await listFor(trainerCookie)
    expect(r.statusCode, r.body).toBe(200)
    const ids = r.json().learners.map((l: { user: { id: string } }) => l.user.id)
    expect(r.json().scope).toBe('trainer')
    expect(ids).toContain(mineId)
    expect(ids, 'رأى المدرّبُ طالبَ شعبةٍ ليست له').not.toContain(othersId)
  })

  it('والمستشارُ عملاءَ حالاته وحدَهم', async () => {
    const r = await listFor(advisorCookie)
    expect(r.statusCode, r.body).toBe(200)
    const ids = r.json().learners.map((l: { user: { id: string } }) => l.user.id)
    expect(r.json().scope).toBe('advisor')
    expect(ids).toEqual([mineId])
  })

  it('والمتعلّمُ لا يرى قائمةَ الطلبة أصلا', async () => {
    expect((await listFor(learnerCookie)).statusCode).toBe(403)
  })

  it('والزائرُ بلا جلسة يُردّ ٤٠١', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/staff/learners' })).statusCode).toBe(401)
  })
})

describe('والنطاقُ يحرس التفصيلَ لا القائمةَ وحدَها', () => {
  /* القائمةُ تُرشَّح، والتفصيلُ يُنادى بمعرّفٍ صريح — فلو حُرست الأولى وحدَها
     كفى أن ينسخ المدرّبُ معرّفا ليقرأ ما لا يخصّه. */
  it('المدرّبُ يقرأ طالبَه', async () => {
    const r = await app.inject({ method: 'GET', url: `/api/staff/learners/${mineId}`, headers: { cookie: trainerCookie } })
    expect(r.statusCode, r.body).toBe(200)
    expect(r.json().user.id).toBe(mineId)
  })

  it('ولا يقرأ طالبَ غيره ولو عرف معرّفه', async () => {
    const r = await app.inject({ method: 'GET', url: `/api/staff/learners/${othersId}`, headers: { cookie: trainerCookie } })
    expect(r.statusCode, 'قُرئ طالبٌ خارج النطاق بمعرّفه').toBe(403)
  })

  it('والمستشارُ كذلك', async () => {
    const r = await app.inject({ method: 'GET', url: `/api/staff/learners/${othersId}`, headers: { cookie: advisorCookie } })
    expect(r.statusCode).toBe(403)
  })
})

describe('الرؤيةُ لا تُعطي التعديل', () => {
  it('المدرّبُ لا يسجّل طالبا', async () => {
    const r = await app.inject({
      method: 'POST', url: `/api/staff/learners/${mineId}/enrollments`,
      headers: { cookie: trainerCookie }, payload: { cohortId: freeCohortId },
    })
    expect(r.statusCode, 'سجّل المدرّبُ طالبا — والرؤيةُ ليست تسجيلا').toBe(403)
  })

  it('ولا يحذف تسجيلا', async () => {
    const r = await app.inject({
      method: 'DELETE', url: `/api/staff/learners/enrollments/${mineEnrollment}`,
      headers: { cookie: trainerCookie }, payload: {},
    })
    expect(r.statusCode).toBe(403)
  })

  it('ولا يعدّل حسابا', async () => {
    const r = await app.inject({
      method: 'PATCH', url: `/api/staff/learners/${mineId}`,
      headers: { cookie: trainerCookie }, payload: { displayName: 'اسمٌ جديد' },
    })
    expect(r.statusCode).toBe(403)
  })

  it('والمستشارُ لا يعدّل حسابا كذلك', async () => {
    const r = await app.inject({
      method: 'PATCH', url: `/api/staff/learners/${mineId}`,
      headers: { cookie: advisorCookie }, payload: { status: 'suspended' },
    })
    expect(r.statusCode).toBe(403)
  })
})

describe('ومن يملك التعديلَ يعدّل — بأثرٍ يُقرأ', () => {
  it('يسجّل طالبا في شعبة', async () => {
    const r = await app.inject({
      method: 'POST', url: `/api/staff/learners/${othersId}/enrollments`,
      headers: { cookie: adminCookie }, payload: { cohortId: freeCohortId },
    })
    expect(r.statusCode, r.body).toBe(201)
    expect(await prisma.enrollment.count({ where: { userId: othersId, cohortId: freeCohortId } })).toBe(1)
  })

  it('ويُخرجه انسحابا موثَّقا — لا محوا للسجلّ', async () => {
    const e = await prisma.enrollment.findFirst({ where: { userId: othersId, cohortId: freeCohortId } })
    const r = await app.inject({
      method: 'DELETE', url: `/api/staff/learners/enrollments/${e!.id}`,
      headers: { cookie: adminCookie }, payload: { note: 'بطلب الطالب' },
    })
    expect(r.statusCode, r.body).toBe(200)
    const after = await prisma.enrollment.findUnique({ where: { id: e!.id } })
    expect(after, 'مُحي الصفُّ — ومعه الحضورُ والتسليماتُ وأثرُ من درس').not.toBeNull()
    expect(after!.status).toBe('dropped')
  })

  it('ويعدّل الاسم، وتبديلُ البريد يُسقط توثيقَه', async () => {
    await prisma.user.update({ where: { id: othersId }, data: { emailVerifiedAt: new Date() } })
    const r = await app.inject({
      method: 'PATCH', url: `/api/staff/learners/${othersId}`,
      headers: { cookie: adminCookie }, payload: { displayName: 'اسمٌ مصحَّح', email: 'la-others-new@test.local' },
    })
    expect(r.statusCode, r.body).toBe(200)
    const u = await prisma.user.findUnique({ where: { id: othersId } })
    expect(u!.displayName).toBe('اسمٌ مصحَّح')
    expect(u!.email).toBe('la-others-new@test.local')
    expect(u!.emailVerifiedAt, 'بقي البريدُ الجديد «موثَّقا» ولم يُثبت أحدٌ ملكيّته').toBeNull()
  })

  it('والإيقافُ يُبطل جلساتِه فورا — لا حتّى تنتهي كعكتُه', async () => {
    const victim = await auth.register('la-victim@test.local', 'Victim#12345', 'موقوف')
    const cookie = await cookieFor('la-victim@test.local', 'Victim#12345')
    await new EnrollmentService(prisma).enroll(freeCohortId, victim.userId, null, {})
    expect((await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } })).json().user).toBeTruthy()

    await app.inject({
      method: 'PATCH', url: `/api/staff/learners/${victim.userId}`,
      headers: { cookie: adminCookie }, payload: { status: 'suspended' },
    })
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } })
    expect(me.json().user, 'الموقوفُ ما زال داخلا بجلسته القديمة').toBeNull()
  })

  it('ولا يُسند بريدٌ مستعمَل لحسابٍ آخر', async () => {
    const r = await app.inject({
      method: 'PATCH', url: `/api/staff/learners/${mineId}`,
      headers: { cookie: adminCookie }, payload: { email: 'la-others-new@test.local' },
    })
    expect(r.statusCode).toBe(409)
  })
})
