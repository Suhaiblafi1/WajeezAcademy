/* اختبار E2E لدورة طلب المدرب الكاملة:
   قسم أوّل (مسودّة + حساب) → استئناف المسودّة → إكمال (مقدَّم + بريد تأكيد) →
   توثيق البريد من رابطه → منع تكرار → الحالة بالبريد → ظهور للإدارة → طلب
   معلومات → تحديث الملف → رفع خاص → مقابلة → ديمو → قبول مشروط → عقد →
   تفعيلٌ يربط حساب المتقدّم ويمنحه دور trainer → دخول المدرب → توثيق الانتقالات. */

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
  motivation: 'أريد الانضمام إلى وجيز لأنني درّبت فرقا حقيقية في بيئات عمل عربية، وأعرف الفرق بين من يعرف المادة ومن يستطيع تعليمها. سأقدّم للمتعلمين مهمة تطبيقية من واقع عملهم في كل وحدة، وأراجع مخرجاتهم بنفسي وأكتب لكل واحد ما ينقصه تحديدا لا تقييما عاما.', privacyConsent: true as const,
  password: 'Trainer#12345',
}

let reference = ''
let candidateToken = ''
let applicationId = ''
let profileId = ''
let contractId = ''
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
  /* قناة البريد مفعّلة ووجهتُها لا تستجيب: الإرسال يخفق، والبوابة تبقى قائمة —
     وهذا بالضبط ما تفحصه هذه الدورة. أما قناةٌ غير مفعّلة فلها اختبارها المستقل
     أدناه، لأن سلوكها مختلف عمدا.

     وكانت الإعدادات هنا بشكل SMTP (`host`/`port`)، فلمّا انتقل الإرسال إلى
     Resend صارت القناةُ تُقرأ «غير مهيّأة» لا «تخفق» — فسقطت ثلاثةُ فحوصٍ على
     فرقٍ في شكل الإعداد لا في السلوك المقصود. والشكلُ الآن شكلُ Resend،
     والإخفاقُ يأتي من وجهةٍ ميّتة (`RESEND_BASE_URL`) لا من مفتاحٍ خاطئ —
     فلا يخرج الفحصُ إلى الشبكة أصلا. */
  process.env.RESEND_BASE_URL = 'http://127.0.0.1:1'
  const emailConfig = { apiKey: 're_test_key', fromName: 'أكاديمية وجيز', fromEmail: 'no-reply@test.local' }
  await prisma.integrationSetting.upsert({
    where: { provider: 'email' },
    update: { enabled: true, config: emailConfig },
    create: { provider: 'email', enabled: true, config: emailConfig },
  })
}, 180_000)

describe('دورة طلب المدرب', () => {
  it('1) القسم الأوّل ينشئ مسودّةً برقم مرجعي وحسابا ورمز متابعة', async () => {
    const res = await apps.submitPhase1(phase1)
    reference = res.reference
    candidateToken = res.candidateToken
    expect(reference).toMatch(/^WJ-TR-\d{4}-\d{5}$/)
    expect(candidateToken.length).toBeGreaterThan(20)
    const row = await prisma.trainerApplication.findUnique({ where: { reference } })
    applicationId = row!.id
    expect(row!.status).toBe('draft')
    expect(row!.accessTokenHash).not.toBeNull()
    expect(row!.userId).toBe(res.userId)
    trainerUserId = res.userId
  })

  it('2) المسودّة تُستأنف بنفس الكلمة لا تُكرَّر — وبكلمة أخرى تُردّ', async () => {
    await expect(apps.submitPhase1({ ...phase1, password: 'Wrong#12345' })).rejects.toMatchObject({ code: 'email_taken' })
    const again = await apps.submitPhase1(phase1)
    expect(again.resumed).toBe(true)
    expect(again.reference).toBe(reference)
    candidateToken = again.candidateToken
  })

  it('3) الإكمالُ يجعله مقدَّما ويُصدر رمزَ توثيق البريد — والخاطئ مرفوض والصحيح يوثّق مرة', async () => {
    const done = await apps.completePhase2(reference, candidateToken, {
      previousCourses: [], teachableCourseIds: [], availability: { seasons: ['nov_jan'] },
      demoConsent: true, contact: { channel: 'phone' },
    })
    expect(done.status).toBe('submitted')
    /* القناة مفعّلة بمضيف لا يستجيب: الإرسال يخفق، والطلب يمضي */
    expect(done.emailDelivery).toBe('failed')
    const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference } })
    expect(row.status).toBe('submitted')
    expect(row.contactChannel).toBe('phone')
    expect(row.emailVerifyTokenHash).not.toBeNull()

    /* الرمزُ يصل بالبريد — وإعادةُ الإرسال تُصدر رمزا جديدا يُفحص هنا */
    const resent = await apps.resendVerification(phase1.email)
    expect(resent.tokenForDelivery).toBeTruthy()
    await expect(apps.verifyEmail(reference, 'wrong-token-xx')).rejects.toMatchObject({ code: 'invalid_token' })
    const first = await apps.verifyEmail(reference, resent.tokenForDelivery!)
    expect(first).toEqual({ status: 'submitted', alreadyVerified: false })
    /* إعادة النقر على الرابط لا تُخطئ ولا تُغيّر */
    const second = await apps.verifyEmail(reference, resent.tokenForDelivery!)
    expect(second.alreadyVerified).toBe(true)

    /* وطلبٌ مكتمل لا يُقدَّم ثانية */
    await expect(apps.submitPhase1(phase1)).rejects.toMatchObject({ code: 'duplicate_application' })
  })

  it('4) الحالة العامة بالبريد وحده — والرقم إن أُعطي يُطابَق', async () => {
    await expect(apps.getPublicStatus('someone-else@test.local')).rejects.toMatchObject({ code: 'not_found' })
    await expect(apps.getPublicStatus(phase1.email, 'WJ-TR-2000-00001')).rejects.toMatchObject({ code: 'not_found' })
    const s = await apps.getPublicStatus(phase1.email)
    expect(s.status).toBe('submitted')
    expect(s.reference).toBe(reference)
    const withRef = await apps.getPublicStatus(phase1.email, reference.toLowerCase())
    expect(withRef.reference).toBe(reference)
  })

  it('5) الطلب يظهر في قائمة الإدارة', async () => {
    const list = await review.listApplications()
    const mine = list.find((a) => a.reference === reference)
    expect(mine).toBeTruthy()
    expect(mine!.emailVerified).toBe(true)
    expect(mine!.fullName).toBe(phase1.fullName)
  })

  /* تغيّرت السياسة 2026-08-28: الطلب نموذج واحد بأربعة أقسام، فالملف المهني
     يُستكمل فور التقديم لا بعد قرار إدارة. وكان الانتظار يعبر بالمتقدّم بابين
     بينهما رسالة بريد — ومن لم تصله توقّف طلبه عند نصفه ولا يعلم أحد.
     والحالات القديمة تبقى مفتوحة كي لا ينكسر طلبٌ في منتصف الدورة السابقة. */
  it('6) الملف المهني يُستكمل فور التقديم، وبعد قرار الإدارة أيضا', async () => {
    const p2 = {
      previousCourses: [{ title: 'أساسيات SQL', org: 'جهة سابقة', year: 2023, link: 'https://example.test/sql' }],
      teachableCourseIds: ['C-BIZ-101'],
      availability: { days: ['السبت', 'الثلاثاء'], hoursPerWeek: 6 },
      demoConsent: true as const,
    }
    const first = await apps.completePhase2(reference, candidateToken, p2)
    expect(first.phase2CompletedAt).toBeTruthy()

    await review.decide(applicationId, adminId, 'move_to_review')
    await review.decide(applicationId, adminId, 'request_info', 'نحتاج سيرتك وأدلة خبرتك')

    /* ويبقى قابلا للتحديث بعد طلب معلومات إضافية — لا يُقفل بأول إرسال */
    const again = await apps.completePhase2(reference, candidateToken, p2)
    expect(again.phase2CompletedAt).toBeTruthy()
  })

  it('6ب) الحقول المحذوفة لا تُكتب — ولو مرّرها متصل قديم', async () => {
    const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference } })
    expect(row.totalLearners).toBeNull()
    expect(row.previousOrgs).toBeNull()
    expect(row.evidenceNotes).toBeNull()
  })

  it('6ج) الدافع دون ٧٥ حرفا مرفوض، وفوق ٥٠٠ مرفوض', async () => {
    const base = { ...phase1, email: `short-${Date.now()}@wajeez.test` }
    await expect(apps.submitPhase1({ ...base, motivation: 'أحب التدريب' }))
      .rejects.toMatchObject({ code: 'invalid_motivation' })
    await expect(apps.submitPhase1({ ...base, motivation: 'م'.repeat(501) }))
      .rejects.toMatchObject({ code: 'invalid_motivation' })
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

  it('10) القبول المشروط ينشئ الملف ومهام التهيئة — بلا ربطٍ بالحساب وبلا دور مدرب بعد', async () => {
    await review.decide(applicationId, adminId, 'conditionally_approve')
    const profile = await prisma.trainerProfile.findUnique({ where: { applicationId }, include: { onboardingTasks: true } })
    expect(profile).toBeTruthy()
    expect(profile!.userId).toBeNull()
    expect(profile!.onboardingTasks.length).toBe(4)
    profileId = profile!.id
    /* الحسابُ قائم منذ التقديم — بدور التقديم وحده */
    const user = await prisma.user.findUniqueOrThrow({ where: { email: phase1.email }, include: { roles: true } })
    expect(user.roles.map((r) => r.roleId)).toEqual(['trainer_applicant'])
  })

  it('11) الدعوة قبل العقد مرفوضة — وبعده لا تلزم: التفعيلُ يربط حسابَ المتقدّم ويمنحه الدور', async () => {
    await expect(review.createInvitation(applicationId, adminId)).rejects.toMatchObject({ code: 'bad_state' })

    const contract = await review.createContract(applicationId, adminId, { title: 'عقد تدريب 2026' })
    contractId = contract.id
    await review.signContract(contractId, adminId)

    await expect(review.createInvitation(applicationId, adminId)).rejects.toMatchObject({ code: 'has_account' })
    await review.decide(applicationId, adminId, 'activate')

    const user = await prisma.user.findUniqueOrThrow({ where: { id: trainerUserId }, include: { roles: true } })
    expect(user.roles.map((r) => r.roleId)).toEqual(['trainer'])

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
      'draft', 'submitted', 'under_review', 'information_requested',
      'shortlisted', 'interview_scheduled', 'demo_requested', 'academic_review',
      'conditionally_approved', 'contract_pending', 'onboarding', 'active',
    ]))
    const audits = await prisma.auditEvent.findMany({
      where: { entityType: 'trainer_application', entityId: applicationId },
    })
    const actions = audits.map((a) => a.action)
    expect(actions).toContain('trainer.application.submit')
    expect(actions).toContain('trainer.application.phase2_complete')
    expect(actions).toContain('trainer.application.verify_email')
    expect(actions).toContain('trainer.status.transition')
  })

  it('15) الانتقالات غير المشروعة مرفوضة', async () => {
    await expect(apps.transition(applicationId, 'onboarding', adminId)).rejects.toMatchObject({ code: 'bad_transition' })
  })
})
