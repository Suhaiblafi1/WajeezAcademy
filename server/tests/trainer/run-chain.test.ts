/* سلسلةُ التشغيل: من مدرّبٍ معتمَدٍ إلى مقعدٍ قابلٍ للبيع.

   خمسةُ مساراتٍ في الخادم كانت بلا شاشةٍ تصل إليها — البتُّ في طلبات التأهيل،
   والتأهيلُ المباشر، والإسنادُ لشعبة، واعتمادُ الظهور العامّ، والإيقاف.
   وبناءُ الشاشة كشف عطبين لم يكونا في القائمة:

   ① **قائمةُ المدرّبين نفسُها وراء صلاحيةِ المستحقّات.** `trainer-profiles`
      يشترط `trainer.compensation.manage`، وهي ليست للمدير الأكاديميّ. فمن
      يملك التأهيلَ والإسنادَ والإيقاف **لا يستطيع أن يرى من يؤهّله** — شاشةٌ
      لا يمكن أن تُبنى، لا لعطبٍ في المنطق بل لبابٍ مقفلٍ على من يملك المفتاح.

   ② **المتعلّمُ المدعوُّ لا يمكن تسجيلُه أبدا.** التسجيلُ كان يشترط
      `status === 'active'`، والحسابُ الذي ينشئه الإداريُّ يبقى `invited` حتّى
      يقبل صاحبُه دعوتَه. فيُردّ بـ«المستخدم غير موجود أو موقوف» — وهو موجودٌ
      وليس موقوفا.

   وهذا الملفُّ يمشي السلسلةَ كما يمشيها إنسان، ويحرس البابين. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerApplicationService } from '../../services/trainer-application.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { EnrollmentService } from '../../services/enrollment.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let auth: AuthService
let app: FastifyInstance
let apps: TrainerApplicationService
let review: TrainerReviewService
let managerId = ''
let managerCookie = ''
let profileId = ''
let courseId = ''
let cohortId = ''

const base = {
  phoneCountryCode: '+962', phone: '771051111', country: 'الأردن', timezone: 'Asia/Amman',
  jobTitle: 'مدرّب', specialties: ['التسويق الرقمي'],
  domainYears: '8-12' as const, trainingYears: 'formal_teaching',
  bio: 'خبرة', trainingLanguages: ['العربية'], deliveryMode: 'both' as const,
  motivation: 'درّبتُ فرقا حقيقيّةً في بيئات عملٍ عربيّة، وأعرف الفرقَ بين من يعرف المادّة ومن يستطيع تعليمها. سأعطي كلَّ متعلّمٍ مهمّةً من واقع عمله في كلّ وحدة، وأراجع مخرجاته بنفسي وأكتب له ما ينقصه تحديدا لا تقييما عاما.',
  privacyConsent: true as const, password: 'Trainer#12345',
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  apps = new TrainerApplicationService(prisma)
  review = new TrainerReviewService(prisma)
  app = await buildApp(prisma)

  const m = await auth.register('run-chain-manager@test.local', 'Admin#12345', 'المدير الأكاديمي')
  managerId = m.userId
  await auth.setRoles(managerId, ['academic_manager'])
  const { token } = await auth.login('run-chain-manager@test.local', 'Admin#12345')
  managerCookie = `${SESSION_COOKIE}=${token}`

  /* مدرّبٌ معتمَدٌ بنقرة — نقطةُ البداية الواقعيّة لهذه السلسلة */
  const res = await apps.submitPhase1({ ...base, email: 'run-chain-trainer@test.local', fullName: 'سلمى المدرّبة' })
  const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference: res.reference } })
  await apps.completePhase2(res.reference, res.candidateToken, {
    previousCourses: [], teachableCourseIds: [], availability: { seasons: ['nov_jan'] },
    demoConsent: true, contact: { channel: 'email' },
  })
  await prisma.trainerApplication.update({ where: { id: row.id }, data: { emailVerifiedAt: new Date() } })
  await review.decide(row.id, managerId, 'approve')
  profileId = (await prisma.trainerProfile.findUniqueOrThrow({ where: { applicationId: row.id } })).id

  const course = await prisma.course.findFirstOrThrow({ orderBy: { id: 'asc' } })
  courseId = course.id
  const cohort = await prisma.cohort.create({
    data: { courseId, title: 'شعبةُ فحصِ السلسلة', status: 'open', capacity: 10, registrationOpen: true },
  })
  cohortId = cohort.id
}, 180_000)

describe('سلسلةُ تشغيل المدرّب', () => {
  it('المديرُ الأكاديميُّ يرى قائمةَ المدرّبين — البابُ الذي كان مقفلا عليه', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/trainers/ops', headers: { cookie: managerCookie } })
    expect(res.statusCode, 'من يملك التأهيلَ لا يستطيع رؤيةَ من يؤهّله').toBe(200)
    const rows = res.json() as { profileId: string; name: string; hasAccount: boolean; qualifications: unknown[] }[]
    const me = rows.find((r) => r.profileId === profileId)
    expect(me, 'المدرّبُ المعتمَدُ ليس في القائمة').toBeTruthy()
    expect(me!.hasAccount, 'اعتمادٌ بلا حساب — بوّابةٌ لا تُفتح').toBe(true)
    expect(me!.qualifications).toEqual([])
  })

  it('ولا يراها من لا يملك التأهيل — الحمولةُ ليست عامّة', async () => {
    const l = await auth.register('run-chain-learner@test.local', 'Learn#12345', 'متعلّم')
    const { token } = await auth.login('run-chain-learner@test.local', 'Learn#12345')
    void l
    const res = await app.inject({
      method: 'GET', url: '/api/admin/trainers/ops', headers: { cookie: `${SESSION_COOKIE}=${token}` },
    })
    expect(res.statusCode).toBe(403)
  })

  it('التأهيلُ ثمّ الإسناد — والإسنادُ بلا تأهيلٍ مرفوض', async () => {
    /* الترتيبُ محروس: الإسنادُ قبل التأهيل يُردّ */
    await expect(review.assignToCohort(profileId, courseId, cohortId, managerId))
      .rejects.toMatchObject({ code: 'not_qualified' })

    const qual = await app.inject({
      method: 'POST', url: `/api/admin/trainers/${profileId}/qualifications`,
      headers: { cookie: managerCookie }, payload: { courseId },
    })
    expect(qual.statusCode).toBe(201)

    const assign = await app.inject({
      method: 'POST', url: `/api/admin/trainers/${profileId}/assignments`,
      headers: { cookie: managerCookie }, payload: { courseId, cohortId },
    })
    expect(assign.statusCode).toBe(201)

    /* والإسنادُ يكتب الجدولين معا — وإلّا فتح المدرّبُ بوّابتَه فوجدها فارغة */
    const link = await prisma.cohortTrainer.findFirst({ where: { cohortId, profileId } })
    expect(link, 'أُسنِد إداريّا ولم يُربط بالشعبة تشغيليّا').not.toBeNull()
  })

  it('واللوحُ يعكس ما جرى — لا شاشةً تقرأ غيرَ ما كُتب', async () => {
    const rows = (await app.inject({
      method: 'GET', url: '/api/admin/trainers/ops', headers: { cookie: managerCookie },
    })).json() as { profileId: string; qualifications: { status: string }[]; assignments: { cohortId: string | null }[] }[]
    const me = rows.find((r) => r.profileId === profileId)!
    expect(me.qualifications.some((q) => q.status === 'qualified')).toBe(true)
    expect(me.assignments.some((a) => a.cohortId === cohortId)).toBe(true)
  })

  it('واعتمادُ الظهور العامّ يُظهره في الصفحة العامّة — وقبله لا يظهر أحد', async () => {
    expect(await review.listPublicTrainers(), 'ظهر بلا اعتمادِ نشر').toEqual([])
    const res = await app.inject({
      method: 'POST', url: `/api/admin/trainers/${profileId}/publish-approval`, headers: { cookie: managerCookie },
    })
    expect(res.statusCode).toBe(200)
    const publics = await review.listPublicTrainers()
    expect(publics.map((p) => p.id), 'اعتُمد نشرُه ولم يظهر').toContain(profileId)
  })

  it('والإيقافُ يخفيه فورا', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/admin/trainers/${profileId}/suspend`,
      headers: { cookie: managerCookie }, payload: { note: 'فحص' },
    })
    expect(res.statusCode).toBe(200)
    expect((await review.listPublicTrainers()).map((p) => p.id)).not.toContain(profileId)
  })
})

describe('المتعلّمُ المدعوُّ يُسجَّل', () => {
  it('حسابٌ حالتُه «مدعوّ» يُسجَّل في شعبة — وكان يُردّ «غير موجود أو موقوف»', async () => {
    const u = await auth.register('invited-learner@test.local', 'Learn#12345', 'مدعوّ')
    await prisma.user.update({ where: { id: u.userId }, data: { status: 'invited' } })
    const enrollment = await new EnrollmentService(prisma).enroll(cohortId, u.userId, managerId, {})
    expect(enrollment.status).toBe('enrolled')
  })

  it('والموقوفُ يبقى مرفوضا — والرسالةُ تقول أيَّ حالةٍ رُدَّت', async () => {
    const u = await auth.register('suspended-learner@test.local', 'Learn#12345', 'موقوف')
    await prisma.user.update({ where: { id: u.userId }, data: { status: 'suspended' } })
    await expect(new EnrollmentService(prisma).enroll(cohortId, u.userId, managerId, {}))
      .rejects.toMatchObject({ code: 'unknown_user', message: expect.stringContaining('suspended') })
  })

  it('وحسابٌ لا وجودَ له يُردّ بـ٤٠٤ لا بخلطٍ مع الموقوف', async () => {
    await expect(new EnrollmentService(prisma).enroll(cohortId, '00000000-0000-4000-8000-000000000000', managerId, {}))
      .rejects.toMatchObject({ code: 'unknown_user', status: 404 })
  })
})
