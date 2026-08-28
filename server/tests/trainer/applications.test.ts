/* اختبار E2E لدورة طلب المدرب الكاملة:
   تقديم → تحقق بريد → منع تكرار → ظهور للإدارة → طلب معلومات → مرحلة ثانية →
   رفع خاص → مقابلة → ديمو → قبول مشروط → عقد → دعوة آمنة → حساب بدور trainer →
   منع المتقدم من منح نفسه الدور → دخول المدرب → توثيق كل الانتقالات. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerApplicationService } from '../../services/trainer-application.service'
import { TrainerReviewService, RUBRIC_CRITERIA } from '../../services/trainer-review.service'
import { buildApp } from '../../http/app'

let prisma: PrismaClient
let auth: AuthService
let apps: TrainerApplicationService
let review: TrainerReviewService
let adminId: string

const scores = () => Object.fromEntries(RUBRIC_CRITERIA.map((k) => [k, 4])) as Record<string, number>

const phase1 = {
  fullName: 'مدرب الاختبار الشامل', email: 'trainer-e2e@test.local',
  phoneCountryCode: '+962', phone: '771052222', country: 'الأردن', timezone: 'Asia/Amman',
  jobTitle: 'مدير تحليل بيانات', specialties: ['تحليل البيانات والمالية'],
  domainYears: '8-12' as const, trainingYears: 'formal_teaching',
  bio: 'خبير بيانات', linkedinUrl: 'https://linkedin.com/in/test',
  trainingLanguages: ['العربية'], deliveryMode: 'both' as const,
  motivation: 'أريد تدريب مهارات حقيقية بمنهجية موثقة', privacyConsent: true as const,
}

let reference = ''
let verifyToken = ''
let candidateToken = ''
let applicationId = ''
let profileId = ''
let contractId = ''
let invitationToken = ''
let trainerUserId = ''

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  apps = new TrainerApplicationService(prisma)
  review = new TrainerReviewService(prisma)
  const admin = await auth.register('admin-trainer-e2e@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
  /* قناة البريد مفعّلة بمضيف لا يستجيب: الإرسال يخفق، والبوابة تبقى قائمة —
     وهذا بالضبط ما تفحصه هذه الدورة. أما قناةٌ غير مفعّلة فلها اختبارها المستقل
     أدناه، لأن سلوكها مختلف عمدا. */
  await prisma.integrationSetting.upsert({
    where: { provider: 'email' },
    update: { enabled: true, config: { host: '127.0.0.1', port: 1, secure: false, fromEmail: 'no-reply@test.local' } },
    create: { provider: 'email', enabled: true, config: { host: '127.0.0.1', port: 1, secure: false, fromEmail: 'no-reply@test.local' } },
  })
}, 180_000)

describe('دورة طلب المدرب', () => {
  it('1) تقديم المرحلة الأولى ينشئ رقما مرجعيا ويحجب الحساب', async () => {
    const res = await apps.submitPhase1(phase1)
    reference = res.reference
    verifyToken = res.verificationTokenForDelivery
    expect(reference).toMatch(/^WJ-TR-\d{4}-\d{5}$/)
    const row = await prisma.trainerApplication.findUnique({ where: { reference } })
    applicationId = row!.id
    expect(row!.status).toBe('email_verification_pending')
    expect(row!.accessTokenHash).toBeNull()
  })

  it('2) تكرار نفس البريد ممنوع ما دام الطلب حيا', async () => {
    await expect(apps.submitPhase1(phase1)).rejects.toMatchObject({ code: 'duplicate_application' })
  })

  it('3) رمز تحقق خاطئ مرفوض، والصحيح ينقل إلى submitted ويصدر رمز مرشح', async () => {
    await expect(apps.verifyEmail(reference, 'wrong-token-xx')).rejects.toMatchObject({ code: 'invalid_token' })
    const res = await apps.verifyEmail(reference, verifyToken)
    candidateToken = res.candidateToken
    expect(res.status).toBe('submitted')
    /* إعادة النقر على الرابط لا تكشف ولا تُصدر */
    await expect(apps.verifyEmail(reference, verifyToken)).rejects.toMatchObject({ code: 'already_verified' })
  })

  it('4) الحالة العامة تتطلب البريد المطابق وتكشف الحالة فقط', async () => {
    await expect(apps.getPublicStatus(reference, 'someone-else@test.local')).rejects.toMatchObject({ code: 'not_found' })
    const s = await apps.getPublicStatus(reference, phase1.email)
    expect(s.status).toBe('submitted')
  })

  it('5) الطلب يظهر في قائمة الإدارة', async () => {
    const list = await review.listApplications()
    const mine = list.find((a) => a.reference === reference)
    expect(mine).toBeTruthy()
    expect(mine!.emailVerified).toBe(true)
    expect(mine!.fullName).toBe(phase1.fullName)
  })

  it('6) المرحلة الثانية مغلقة قبل قرار الإدارة، وتُفتح بعد طلب المعلومات', async () => {
    const p2 = {
      previousCourses: [{ title: 'أساسيات SQL', org: 'جهة سابقة', year: 2023, learnersCount: 120 }],
      totalLearners: 300, teachableCourseIds: ['C-BIZ-101'],
      availability: { days: ['السبت', 'الثلاثاء'], hoursPerWeek: 6 },
      demoConsent: true as const,
    }
    await expect(apps.completePhase2(reference, candidateToken, p2)).rejects.toMatchObject({ code: 'phase2_closed' })

    await review.decide(applicationId, adminId, 'move_to_review')
    await review.decide(applicationId, adminId, 'request_info', 'نحتاج سيرتك وأدلة خبرتك')

    const done = await apps.completePhase2(reference, candidateToken, p2)
    expect(done.phase2CompletedAt).toBeTruthy()
  })

  it('7) رفع وثيقة خاصة برابط موقع، وقراءتها برابط موقع، ورفض توقيع مزور', async () => {
    const content = Buffer.from('سيرة ذاتية تجريبية — محتوى خاص')
    const doc = await apps.requestDocumentUpload(reference, candidateToken, {
      kind: 'cv', originalName: 'cv.txt', mime: 'text/plain', sizeBytes: content.length,
    })
    expect(doc.uploadUrl).toContain('/api/v1/uploads/')

    const app = await buildApp(prisma)
    const put = await app.inject({
      method: 'PUT', url: doc.uploadUrl,
      headers: { 'content-type': 'application/octet-stream' }, payload: content,
    })
    expect(put.statusCode).toBe(200)

    const urls = apps.signedDocumentUrls([{ storageKey: doc.storageKey }])
    const get = await app.inject({ method: 'GET', url: urls[doc.storageKey] })
    expect(get.statusCode).toBe(200)
    expect(get.body).toBe(content.toString())

    /* توقيع مزور يرفض */
    const bad = await app.inject({
      method: 'GET', url: `/api/v1/documents/${doc.storageKey}?exp=${Date.now() + 60000}&sig=forged`,
    })
    expect(bad.statusCode).toBe(403)
    await app.close()
  })

  it('8) روبريك ناقص المحاور مرفوض، والكامل يُسجل', async () => {
    await expect(review.addReview(applicationId, adminId, { domain_expertise: 4 } as never))
      .rejects.toMatchObject({ code: 'bad_rubric' })
    const r = await review.addReview(applicationId, adminId, scores(), 'مرشح واعد')
    expect(r.id).toBeTruthy()
  })

  it('9) مقابلة ثم ديمو ثم مراجعة أكاديمية', async () => {
    await review.decide(applicationId, adminId, 'shortlist')
    const interview = await review.scheduleInterview(applicationId, adminId, { scheduledAt: new Date(Date.now() + 86400000) })
    await review.recordInterviewOutcome(interview.id, adminId, 'passed')
    await review.decide(applicationId, adminId, 'request_demo')
    await review.recordDemoEvaluation(applicationId, adminId, scores(), 'pass')
    await review.decide(applicationId, adminId, 'academic_review')
    const row = await prisma.trainerApplication.findUnique({ where: { id: applicationId } })
    expect(row!.status).toBe('academic_review')
  })

  it('10) القبول المشروط ينشئ الملف ومهام التهيئة — دون حساب ودون دور', async () => {
    await review.decide(applicationId, adminId, 'conditionally_approve')
    const profile = await prisma.trainerProfile.findUnique({ where: { applicationId }, include: { onboardingTasks: true } })
    expect(profile).toBeTruthy()
    expect(profile!.userId).toBeNull()
    expect(profile!.onboardingTasks.length).toBe(4)
    profileId = profile!.id
    /* لا مستخدم بهذا البريد بعد */
    expect(await prisma.user.findUnique({ where: { email: phase1.email } })).toBeNull()
  })

  it('11) الدعوة قبل العقد مرفوضة — وبعد توقيعه تُصدر وتُستهلك مرة واحدة', async () => {
    await expect(review.createInvitation(applicationId, adminId)).rejects.toMatchObject({ code: 'bad_state' })

    const contract = await review.createContract(applicationId, adminId, { title: 'عقد تدريب 2026' })
    contractId = contract.id
    await review.signContract(contractId, adminId)

    const inv = await review.createInvitation(applicationId, adminId)
    invitationToken = inv.tokenForDelivery

    const res = await review.consumeInvitation(invitationToken, 'Trainer#12345')
    trainerUserId = res.userId
    const user = await prisma.user.findUnique({ where: { id: trainerUserId }, include: { roles: true } })
    expect(user!.roles.map((r) => r.roleId)).toContain('trainer')

    /* الدعوة لا تُستهلك مرتين */
    await expect(review.consumeInvitation(invitationToken, 'Trainer#12345')).rejects.toMatchObject({ code: 'invalid_token' })

    const profile = await prisma.trainerProfile.findUnique({ where: { id: profileId } })
    expect(profile!.userId).toBe(trainerUserId)
    const appRow = await prisma.trainerApplication.findUnique({ where: { id: applicationId } })
    expect(appRow!.status).toBe('active')
  })

  it('12) المدرب يدخل بجلسة تحمل صلاحيات بوابة المدرب فقط', async () => {
    const login = await auth.login(phase1.email, 'Trainer#12345')
    const ctx = await auth.resolve(login.token)
    expect(ctx!.permissions).toContain('trainer.portal')
    expect(ctx!.permissions).not.toContain('trainer.applications.decide')
    expect(ctx!.permissions).not.toContain('catalog.course.publish')
  })

  it('13) لا أحد يبت في طلب مرتبط ببريده هو', async () => {
    /* المتقدم صار مستخدما — لو مُنح صلاحية قرار لاحقا لا يبت في طلب نفسه */
    await auth.setRoles(trainerUserId, ['academic_manager'])
    await expect(review.decide(applicationId, trainerUserId, 'reject')).rejects.toMatchObject({ code: 'self_decision' })
    await auth.setRoles(trainerUserId, ['trainer'])
  })

  it('14) كل الانتقالات موثقة في سجل الحالة وسجل التدقيق', async () => {
    const history = await prisma.trainerStatusHistory.findMany({ where: { applicationId }, orderBy: { createdAt: 'asc' } })
    const statuses = history.map((h) => h.toStatus)
    expect(statuses).toEqual(expect.arrayContaining([
      'email_verification_pending', 'submitted', 'under_review', 'information_requested',
      'shortlisted', 'interview_scheduled', 'demo_requested', 'academic_review',
      'conditionally_approved', 'contract_pending', 'onboarding', 'active',
    ]))
    const audits = await prisma.auditEvent.findMany({
      where: { entityType: 'trainer_application', entityId: applicationId },
    })
    const actions = audits.map((a) => a.action)
    expect(actions).toContain('trainer.application.submit')
    expect(actions).toContain('trainer.application.verify_email')
    expect(actions).toContain('trainer.status.transition')
  })

  it('15) الانتقالات غير المشروعة مرفوضة', async () => {
    await expect(apps.transition(applicationId, 'onboarding', adminId)).rejects.toMatchObject({ code: 'bad_transition' })
  })
})
