/* أدوات الدورة في يد مدربها — وحدود تلك اليد.

   المدرب كان يصحّح الواجب ولا يؤلّفه، ويرفع تسجيل الجلسة ولا يرفع كرّاستها،
   لأن الفعلين كانا خلف صلاحية إدارية عامة تُعطي حاملها كل الشعب. فالمفحوص هنا
   شيئان معا: أنه يستطيع الآن في شعبته، وأنه لا يستطيع في شعبة غيره. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { buildApp } from '../../http/app'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CohortService } from '../../services/cohort.service'
import { TrainerApplicationService } from '../../services/trainer-application.service'
import { TrainerReviewService, RUBRIC_CRITERIA } from '../../services/trainer-review.service'

let app: FastifyInstance
let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let adminId = ''
/* مدربان وشعبتان: كلٌّ في شعبته، ولا أحد في شعبة الآخر */
let mineCohortId = ''
let othersCohortId = ''
let myToken = ''
let myProfileId = ''

const scores = () => Object.fromEntries(RUBRIC_CRITERIA.map((k) => [k, 4])) as Record<string, number>

const applicant = (email: string, name: string) => ({
  fullName: name, email,
  phoneCountryCode: '+962', phone: '770000001', country: 'الأردن',
  jobTitle: 'مدرب', specialties: ['تحليل البيانات والمالية'],
  domainYears: '8-12' as const, trainingYears: 'formal_teaching',
  bio: 'خبرة', trainingLanguages: ['العربية'], deliveryMode: 'both' as const,
  motivation: 'أريد الانضمام إلى وجيز لأنني درّبت فرقا حقيقية في بيئات عمل عربية، وأعرف الفرق بين من يعرف المادة ومن يستطيع تعليمها. سأقدّم للمتعلمين مهمة تطبيقية من واقع عملهم في كل وحدة، وأراجع مخرجاتهم بنفسي وأكتب لكل واحد ما ينقصه تحديدا لا تقييما عاما.', privacyConsent: true as const,
})

/** يمضي بمتقدم حتى يصير مدربا فعالا بحساب، ويعيد ملفه ورمز جلسته */
async function makeTrainer(email: string, name: string, password: string) {
  const apps = new TrainerApplicationService(prisma)
  const res = await apps.submitPhase1(applicant(email, name))
  const row = await prisma.trainerApplication.findUnique({ where: { reference: res.reference } })
  const id = row!.id
  await review.decide(id, adminId, 'move_to_review')
  await review.addReview(id, adminId, scores(), 'مؤهل')
  await review.decide(id, adminId, 'shortlist')
  await review.decide(id, adminId, 'request_demo')
  await review.recordDemoEvaluation(id, adminId, scores(), 'pass')
  await review.decide(id, adminId, 'academic_review')
  await review.decide(id, adminId, 'conditionally_approve')
  const contract = await review.createContract(id, adminId, { title: 'عقد', terms: {} })
  await review.signContract(contract.id, adminId)
  const inv = await review.createInvitation(id, adminId)
  await review.consumeInvitation(inv.tokenForDelivery, password, name)
  const session = await auth.login(email, password, '127.0.0.1', 'test')
  const profile = await prisma.trainerProfile.findFirst({ where: { applicationId: id } })
  return { profileId: profile!.id, token: session.token }
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  await prisma.integrationSetting.upsert({
    where: { provider: 'email' },
    update: { enabled: false, config: {} },
    create: { provider: 'email', enabled: false, config: {} },
  })
  app = await buildApp(prisma)
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  const admin = await auth.register('admin-tools@test.local', 'Admin#12345', 'مدير')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])

  const mine = await makeTrainer('tools-mine@test.local', 'مدرب شعبتي', 'TrainerA#1')
  const other = await makeTrainer('tools-other@test.local', 'مدرب آخر', 'TrainerB#1')
  myToken = mine.token
  myProfileId = mine.profileId

  const course = await prisma.course.findFirst({ select: { id: true } })
  const cohorts = new CohortService(prisma)
  for (const [profileId, label] of [[mine.profileId, 'شعبتي'], [other.profileId, 'شعبة غيري']] as const) {
    await review.qualifyForCourse(profileId, course!.id, adminId)
    const c = await cohorts.create(adminId, {
      courseId: course!.id, title: label,
      startsAt: new Date(Date.now() + 30 * 86400_000), capacity: 10,
    })
    await cohorts.assignTrainer(c.id, profileId, adminId, 'lead')
    if (profileId === mine.profileId) mineCohortId = c.id
    else othersCohortId = c.id
  }
}, 240_000)

const asMe = (url: string, payload: unknown) =>
  app.inject({ method: 'POST', url, payload: payload as never, cookies: { wajeez_session: myToken } })

describe('المدرب يرفع مواد شعبته', () => {
  it('يقبل كرّاسة (ملف) ويعيد رابط رفع موقعا', async () => {
    const res = await asMe(`/api/trainer/cohorts/${mineCohortId}/materials`, {
      title: 'كرّاسة التمارين', kind: 'file',
      file: { originalName: 'workbook.pdf', mime: 'application/pdf', sizeBytes: 240_000 },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json() as { material?: { id: string }; uploadUrl?: string; id?: string }
    const materialId = body.material?.id ?? body.id
    expect(materialId).toBeTruthy()
    const row = await prisma.learningMaterial.findFirst({ where: { cohortId: mineCohortId } })
    expect(row?.title).toBe('كرّاسة التمارين')
  })

  it('يقبل رابطا خارجيا بلا ملف', async () => {
    const res = await asMe(`/api/trainer/cohorts/${mineCohortId}/materials`, {
      title: 'فيديو تمهيدي', kind: 'link', externalUrl: 'https://example.com/v',
    })
    expect(res.statusCode).toBe(201)
  })

  it('يُمنع في شعبة لا يدرّبها — الحارس لا الصلاحية', async () => {
    const res = await asMe(`/api/trainer/cohorts/${othersCohortId}/materials`, {
      title: 'مادة في شعبة غيري', kind: 'link', externalUrl: 'https://example.com/x',
    })
    expect([401, 403, 404]).toContain(res.statusCode)
    const leaked = await prisma.learningMaterial.count({ where: { cohortId: othersCohortId } })
    expect(leaked, 'كتب في شعبة غيره').toBe(0)
  })

  it('غير الموثق لا يرفع شيئا', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/trainer/cohorts/${mineCohortId}/materials`,
      payload: { title: 'بلا جلسة', kind: 'link', externalUrl: 'https://example.com/y' },
    })
    expect([401, 403]).toContain(res.statusCode)
  })
})

describe('المدرب يؤلّف ما سيصححه', () => {
  it('ينشئ واجبا لشعبته', async () => {
    const res = await asMe(`/api/trainer/cohorts/${mineCohortId}/assessments`, {
      title: 'واجب تحليل حالة', type: 'assignment', maxScore: 100,
      items: [{ prompt: 'حلّل الحالة المرفقة', kind: 'text', maxScore: 100 }],
    })
    expect(res.statusCode).toBe(201)
    const row = await prisma.cohortAssessment.findFirst({ where: { cohortId: mineCohortId } })
    expect(row?.title).toBe('واجب تحليل حالة')
  })

  it('ينشئ مشروع تخرج لشعبته', async () => {
    const res = await asMe(`/api/trainer/cohorts/${mineCohortId}/assessments`, {
      title: 'مشروع التخرج', type: 'project', maxScore: 100,
    })
    expect(res.statusCode).toBe(201)
  })

  it('لا يؤلّف في شعبة غيره', async () => {
    const res = await asMe(`/api/trainer/cohorts/${othersCohortId}/assessments`, {
      title: 'واجب في شعبة غيري', type: 'assignment',
    })
    expect([401, 403, 404]).toContain(res.statusCode)
    expect(await prisma.cohortAssessment.count({ where: { cohortId: othersCohortId } })).toBe(0)
  })
})

describe('مهام التهيئة تُكمَل من صاحبها', () => {
  it('المهمة تُغلق ويُختم وقتها', async () => {
    const open = await prisma.trainerOnboardingTask.findFirst({
      where: { profileId: myProfileId, doneAt: null, key: { not: 'sign_contract' } },
    })
    expect(open, 'لا مهام تهيئة مفتوحة — تغيّرت البذرة').toBeTruthy()
    const res = await app.inject({
      method: 'POST', url: `/api/trainer/me/onboarding-tasks/${open!.key}/complete`,
      cookies: { wajeez_session: myToken },
    })
    expect(res.statusCode).toBe(200)
    const after = await prisma.trainerOnboardingTask.findUnique({
      where: { profileId_key: { profileId: myProfileId, key: open!.key } },
    })
    expect(after!.doneAt).not.toBeNull()
  })

  it('توقيع العقد لا يُغلق بإقرار صاحبه', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/trainer/me/onboarding-tasks/sign_contract/complete',
      cookies: { wajeez_session: myToken },
    })
    expect(res.statusCode).toBe(409)
  })

  it('مفتاح لا يخصّ ملفه يُرفض بـ404 لا يُنشأ', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/trainer/me/onboarding-tasks/la-youjad/complete',
      cookies: { wajeez_session: myToken },
    })
    expect(res.statusCode).toBe(404)
  })
})
