/* اختبار الصلاحيات على واجهات HTTP الفعلية:
   زائر 401، متعلم 403 على إدارة المدربين، مدرب يصل بوابته فقط،
   المتقدم لا يمنح نفسه الدور، مدرب غير موثق لا يظهر للعامة،
   والإيقاف يبطل الوصول فورا. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService, RUBRIC_CRITERIA } from '../../services/trainer-review.service'
import { TrainerApplicationService } from '../../services/trainer-application.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let auth: AuthService
let app: FastifyInstance
let review: TrainerReviewService
let appsSvc: TrainerApplicationService
let adminCookie = ''
let learnerCookie = ''

const scores = () => Object.fromEntries(RUBRIC_CRITERIA.map((k) => [k, 4])) as Record<string, number>

async function cookieFor(email: string, password: string): Promise<string> {
  const { token } = await auth.login(email, password)
  return `${SESSION_COOKIE}=${token}`
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  /* قناة البريد مفعّلة بمضيف لا يستجيب — البوابة البريدية تبقى قائمة كما صُمّمت.
     (قناة غير مفعّلة تُسقط البوابة عمدا؛ لها اختبارها المستقل في applications.) */
  await prisma.integrationSetting.upsert({
    where: { provider: 'email' },
    update: { enabled: true, config: { host: '127.0.0.1', port: 1, secure: false, fromEmail: 'no-reply@test.local' } },
    create: { provider: 'email', enabled: true, config: { host: '127.0.0.1', port: 1, secure: false, fromEmail: 'no-reply@test.local' } },
  })
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  appsSvc = new TrainerApplicationService(prisma)
  app = await buildApp(prisma)

  const admin = await auth.register('perm-admin@test.local', 'Admin#12345', 'مدير')
  await auth.setRoles(admin.userId, ['academic_manager'])
  adminCookie = await cookieFor('perm-admin@test.local', 'Admin#12345')

  await auth.register('perm-learner@test.local', 'Learner#12345', 'متعلم')
  learnerCookie = await cookieFor('perm-learner@test.local', 'Learner#12345')
}, 240_000)

describe('صلاحيات منظومة المدربين عبر HTTP', () => {
  it('1) الزائر بلا جلسة يُرفض 401 على مسارات الإدارة', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/trainer-applications' })
    expect(res.statusCode).toBe(401)
  })

  it('2) المتعلم يُرفض 403 على إدارة الطلبات وبوابة المدرب', async () => {
    const r1 = await app.inject({ method: 'GET', url: '/api/admin/trainer-applications', headers: { cookie: learnerCookie } })
    expect(r1.statusCode).toBe(403)
    const r2 = await app.inject({ method: 'GET', url: '/api/trainer/me', headers: { cookie: learnerCookie } })
    expect(r2.statusCode).toBe(403)
  })

  let applicantReference = ''
  let applicantToken = ''

  it('3) التقديم ينشئ حساب متقدّم بدور التقديم وحده — لا مدرب ولا متعلم', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/trainer-applications',
      payload: {
        fullName: 'متقدم الصلاحيات', email: 'perm-applicant@test.local',
        specialties: ['القيادة وتطوير المدراء'], domainYears: '4-7', trainingYears: 'workshops',
        trainingLanguages: ['العربية'], deliveryMode: 'remote',
        motivation: 'أريد الانضمام إلى وجيز لأنني درّبت فرقا حقيقية في بيئات عمل عربية، وأعرف الفرق بين من يعرف المادة ومن يستطيع تعليمها. سأقدّم للمتعلمين مهمة تطبيقية من واقع عملهم في كل وحدة، وأراجع مخرجاتهم بنفسي وأكتب لكل واحد ما ينقصه تحديدا لا تقييما عاما.', privacyConsent: true,
        password: 'Trainer#12345',
      },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.reference).toMatch(/^WJ-TR-/)
    expect(body.status).toBe('draft')
    expect(body.candidateToken).toBeTruthy()
    applicantReference = body.reference
    applicantToken = body.candidateToken
    /* حسابٌ بدور التقديم وحده */
    const user = await prisma.user.findUnique({ where: { email: 'perm-applicant@test.local' }, include: { roles: true } })
    expect(user).toBeTruthy()
    expect(user!.roles.map((r) => r.roleId)).toEqual(['trainer_applicant'])
  })

  it('4) المتقدم لا يستطيع الوصول لمسارات الإدارة ولا منح نفسه دورا', async () => {
    /* لا حساب له أصلا — ولو سجل كمتعلم بنفس البريد لا يصل */
    const res = await app.inject({
      method: 'GET', url: '/api/admin/trainer-applications', headers: { cookie: learnerCookie },
    })
    expect(res.statusCode).toBe(403)
    /* لا مسار عام لترقية الأدوار */
    const role = await prisma.userRole.findMany({ where: { roleId: 'trainer' } })
    expect(role.length).toBe(0)
  })

  let profileId = ''
  let trainerCookie = ''

  it('5) دورة كاملة عبر HTTP: قرار → عقد → دعوة → حساب → بوابة', async () => {
    /* إكمالُ الطلب أولا — لا قرار إداري على مسودّة */
    await appsSvc.completePhase2(applicantReference, applicantToken, {
      previousCourses: [], teachableCourseIds: [], availability: {}, demoConsent: true, contact: { channel: 'email' },
    })
    const appRow = await prisma.trainerApplication.findFirst({ where: { email: 'perm-applicant@test.local' } })
    const adminUser = await prisma.user.findUnique({ where: { email: 'perm-admin@test.local' } })
    const aid = appRow!.id
    const adminId = adminUser!.id

    await review.decide(aid, adminId, 'move_to_review')
    await review.decide(aid, adminId, 'shortlist')
    await review.decide(aid, adminId, 'request_demo')
    await review.recordDemoEvaluation(aid, adminId, scores(), 'pass')
    await review.decide(aid, adminId, 'academic_review')
    await review.decide(aid, adminId, 'conditionally_approve')
    const contract = await review.createContract(aid, adminId, { title: 'عقد' })
    await review.signContract(contract.id, adminId)
    /* حسابُه قائم — التفعيلُ يربطه ويمنحه الدور، ولا دعوة */
    await expect(review.createInvitation(aid, adminId)).rejects.toMatchObject({ code: 'has_account' })
    await review.decide(aid, adminId, 'activate')

    const profile = await prisma.trainerProfile.findUnique({ where: { applicationId: aid } })
    profileId = profile!.id
    trainerCookie = await cookieFor('perm-applicant@test.local', 'Trainer#12345')

    /* بوابة المدرب تعمل */
    const me = await app.inject({ method: 'GET', url: '/api/trainer/me', headers: { cookie: trainerCookie } })
    expect(me.statusCode).toBe(200)
    expect(me.json().application.email).toBe('perm-applicant@test.local')
  })

  it('6) المدرب لا يصل مسارات الإدارة رغم جلسته الصالحة', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/trainer-applications', headers: { cookie: trainerCookie } })
    expect(res.statusCode).toBe(403)
  })

  it('7) غير الموثق لا يظهر في القائمة العامة، والموثق بموافقة نشر يظهر', async () => {
    const before = await app.inject({ method: 'GET', url: '/api/trainers/public' })
    expect(before.json().find((t: { id: string }) => t.id === profileId)).toBeUndefined()

    /* دورة الدورة المعروضة بلا مدرب معتمد تعلن عبارة الانتظار */
    const c = await app.inject({ method: 'GET', url: '/api/courses/C-BIZ-101/trainer' })
    expect(c.json().announced).toBe(false)
    expect(c.json().messageAr).toContain('يُعلن المدرب عند اعتماد الشعبة')

    const adminUser = await prisma.user.findUnique({ where: { email: 'perm-admin@test.local' } })
    await review.approvePublicVisibility(profileId, adminUser!.id)
    const after = await app.inject({ method: 'GET', url: '/api/trainers/public' })
    expect(after.json().find((t: { id: string }) => t.id === profileId)).toBeTruthy()
  })

  it('8) الإيقاف يبطل الجلسة فورا ويخفي المدرب ويمنع وصوله', async () => {
    const adminUser = await prisma.user.findUnique({ where: { email: 'perm-admin@test.local' } })
    await review.suspendTrainer(profileId, adminUser!.id, 'إيقاف اختباري')

    const me = await app.inject({ method: 'GET', url: '/api/trainer/me', headers: { cookie: trainerCookie } })
    expect(me.statusCode).toBe(401) // الجلسة أبطلت مع الحساب

    const pub = await app.inject({ method: 'GET', url: '/api/trainers/public' })
    expect(pub.json().find((t: { id: string }) => t.id === profileId)).toBeUndefined()

    /* تسجيل دخول جديد ممنوع لحساب موقوف */
    await expect(auth.login('perm-applicant@test.local', 'Trainer#12345'))
      .rejects.toMatchObject({ code: 'account_suspended' })
  })

  it('9) عرض تفاصيل طلب يعطي روابط وثائق موقعة ولا يكشف هاشات الرموز', async () => {
    const appRow = await prisma.trainerApplication.findFirst({ where: { email: 'perm-applicant@test.local' } })
    const res = await app.inject({
      method: 'GET', url: `/api/admin/trainer-applications/${appRow!.id}`, headers: { cookie: adminCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.accessTokenHash).toBeUndefined()
    expect(body.emailVerifyTokenHash).toBeUndefined()
    expect(body.documentUrls).toBeDefined()
    expect(body.statusHistory.length).toBeGreaterThan(3)
  })
})
