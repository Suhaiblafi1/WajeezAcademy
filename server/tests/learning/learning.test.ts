/* اختبار E2E للتشغيل التعليمي الكامل:
   حراسة الوصول (غير المسجل ممنوع) → Zoom يدوي (https فقط) → تسجيلات ومواد خاصة →
   حضور بيد مدرب الشعبة فقط → تسليم واجب → مراجعة → طلب إعادة → إعادة تسليم →
   قبول ودرجة → تعديل درجة في سجل لا يُمحى → تقدم يُعاد حسابه من أدلة →
   شهادة مرفوضة قبل القواعد ثم صادرة → تحقق عام → إلغاء بسبب موثق. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService, RUBRIC_CRITERIA } from '../../services/trainer-review.service'
import { CohortService } from '../../services/cohort.service'
import { EnrollmentService } from '../../services/enrollment.service'
import { AssessmentService } from '../../services/assessment.service'
import { ProgressService } from '../../services/progress.service'
import { CertificateService } from '../../services/certificate.service'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let cohorts: CohortService
let enrollments: EnrollmentService
let assessments: AssessmentService
let progress: ProgressService
let certificates: CertificateService
let managerId: string
let trainerUserId = ''
let profileId = ''
let outsiderTrainerUserId = ''
let learnerId = ''
let outsiderId = ''
const COURSE = 'C-BIZ-101'

const scores = () => Object.fromEntries(RUBRIC_CRITERIA.map((k) => [k, 5])) as Record<string, number>

async function makeActiveTrainer(email: string, name: string) {
  const apps = new (await import('../../services/trainer-application.service')).TrainerApplicationService(prisma)
  const p1 = await apps.submitPhase1({
    fullName: name, email, specialties: ['إدارة المشاريع والعمليات'],
    domainYears: '8-12', trainingYears: 'formal_teaching',
    trainingLanguages: ['العربية'], deliveryMode: 'remote',
    motivation: 'أريد الانضمام إلى وجيز لأنني درّبت فرقا حقيقية في بيئات عمل عربية، وأعرف الفرق بين من يعرف المادة ومن يستطيع تعليمها. سأقدّم للمتعلمين مهمة تطبيقية من واقع عملهم في كل وحدة، وأراجع مخرجاتهم بنفسي وأكتب لكل واحد ما ينقصه تحديدا لا تقييما عاما.', privacyConsent: true,
    password: 'Trainer#12345',
  })
  /* الطلبُ مسودّةٌ حتّى يُكمَل — الإكمالُ يجعله مقدَّما */
  await apps.completePhase2(p1.reference, p1.candidateToken, {
    previousCourses: [], teachableCourseIds: [], availability: {}, demoConsent: true, contact: { channel: 'email' },
  })
  const app = await prisma.trainerApplication.findUnique({ where: { reference: p1.reference } })
  await review.decide(app!.id, managerId, 'move_to_review')
  await review.decide(app!.id, managerId, 'shortlist')
  await review.scheduleInterview(app!.id, managerId, { scheduledAt: new Date() })
  await review.decide(app!.id, managerId, 'request_demo')
  await review.recordDemoEvaluation(app!.id, managerId, scores(), 'pass')
  await review.decide(app!.id, managerId, 'academic_review')
  await review.decide(app!.id, managerId, 'conditionally_approve')
  const contract = await review.createContract(app!.id, managerId, { title: 'عقد اختبار' })
  await review.signContract(contract.id, managerId)
  /* للمتقدّم حسابٌ منذ تقديمه — التفعيلُ يربطه بملفّه ويمنحه دورَ المدرّب */
  await review.decide(app!.id, managerId, 'activate')
  const profile = await prisma.trainerProfile.findUnique({ where: { applicationId: app!.id } })
  return { userId: profile!.userId!, profileId: profile!.id }
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  /* قناة البريد مفعّلة بمضيف لا يستجيب — البوابة البريدية تبقى قائمة كما صُمّمت.
     (قناة غير مفعّلة تُسقط البوابة عمدا؛ لها اختبارها في trainer/lifecycle-gaps.) */
  /* إعدادُ Resend لا SMTP: انتقل الإرسالُ إلى Resend، فبقاءُ `host`/`port` هنا
     يجعل القناةَ تُقرأ «غير مهيّأة» لا «مفعّلةً تخفق». والوجهةُ الميّتة تأتي من
     `RESEND_BASE_URL` فلا يخرج الفحصُ إلى الشبكة. */
  process.env.RESEND_BASE_URL = 'http://127.0.0.1:1'
  await prisma.integrationSetting.upsert({
    where: { provider: 'email' },
    update: { enabled: true, config: { apiKey: 're_test_key', fromName: 'أكاديمية وجيز', fromEmail: 'no-reply@test.local' } },
    create: { provider: 'email', enabled: true, config: { apiKey: 're_test_key', fromName: 'أكاديمية وجيز', fromEmail: 'no-reply@test.local' } },
  })
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  cohorts = new CohortService(prisma)
  enrollments = new EnrollmentService(prisma)
  assessments = new AssessmentService(prisma)
  progress = new ProgressService(prisma)
  certificates = new CertificateService(prisma)

  const m = await auth.register('learning-manager@test.local', 'Manager#12345', 'مدير أكاديمي')
  managerId = m.userId
  await auth.setRoles(managerId, ['academic_manager'])

  const t = await makeActiveTrainer('learning-trainer@test.local', 'مدرب التشغيل')
  trainerUserId = t.userId
  profileId = t.profileId
  await review.qualifyForCourse(profileId, COURSE, managerId)

  const outsider = await makeActiveTrainer('outsider-trainer@test.local', 'مدرب خارجي')
  outsiderTrainerUserId = outsider.userId

  const l = await auth.register('learning-learner@test.local', 'Learner#12345', 'متعلم التشغيل')
  learnerId = l.userId
  /* ١هـ — الشهادة لا تصدر لبريد غير موثَّق. المتعلم هنا يمرّ بالمسار الحقيقي:
     يوثّق بريده كما يفعل صاحب الحساب، فلا يُضعَّف الحاجز من أجل الاختبار. */
  const verify = await auth.issueEmailVerification(learnerId)
  await auth.verifyEmail(verify!.token)
  const o = await auth.register('learning-outsider@test.local', 'Learner#12345', 'متطفل')
  outsiderId = o.userId
}, 300_000)

describe('التشغيل التعليمي الكامل', () => {
  let cohortId = ''
  let sessionId = ''
  let enrollmentId = ''
  let assignmentId = ''
  let submissionId = ''

  it('1) شعبة جاهزة ومفتوحة بجدول ومدرب', async () => {
    const c = await cohorts.create(managerId, {
      courseId: COURSE, title: 'شعبة التشغيل الكامل', capacity: 10, price: 500, currency: 'JOD',
    })
    cohortId = c.id
    await cohorts.assignTrainer(cohortId, profileId, managerId, 'lead')
    const s = await cohorts.addSession(managerId, cohortId, {
      title: 'جلسة الافتتاح', startsAt: new Date('2026-10-05T18:00:00Z'), endsAt: new Date('2026-10-05T20:00:00Z'),
    })
    sessionId = s.id
    await prisma.cohortDeliveryPlan.create({
      data: { cohortId, content: { note: 'خطة' }, status: 'approved', createdBy: managerId },
    })
    await cohorts.open(cohortId, managerId)
    const check = await cohorts.openChecklist(cohortId)
    expect(check.ready).toBe(true)
  })

  it('2) غير المسجل ممنوع من محتوى الشعبة', async () => {
    await expect(enrollments.assertEnrolled(outsiderId, cohortId))
      .rejects.toMatchObject({ code: 'not_enrolled' })
    const e = await enrollments.enroll(cohortId, learnerId, managerId)
    enrollmentId = e.id
    const ok = await enrollments.assertEnrolled(learnerId, cohortId)
    expect(ok.id).toBe(enrollmentId)
    /* المنسحب يفقد الوصول */
    const temp = await auth.register('temp-learner@test.local', 'Learner#12345', 'مؤقت')
    const te = await enrollments.enroll(cohortId, temp.userId, managerId)
    await enrollments.drop(te.id, managerId, 'انسحاب اختبار')
    await expect(enrollments.assertEnrolled(temp.userId, cohortId))
      .rejects.toMatchObject({ code: 'not_enrolled' })
  })

  it('3) Zoom اليدوي: رابط غير https مرفوض، والربط الثاني مرفوض', async () => {
    await expect(cohorts.attachManualZoom(managerId, sessionId, { joinUrl: 'http://zoom.us/j/123' }))
      .rejects.toMatchObject({ code: 'bad_url' })
    const zoom = await cohorts.attachManualZoom(managerId, sessionId, {
      joinUrl: 'https://zoom.us/j/123456789', meetingId: '123456789', passcode: 'abc123',
    })
    expect(zoom.provider).toBe('manual')
    await expect(cohorts.attachManualZoom(managerId, sessionId, { joinUrl: 'https://zoom.us/j/999' }))
      .rejects.toMatchObject({ code: 'already_linked' })
  })

  it('4) التسجيلات والمواد خاصة — مفاتيح تخزين وروابط رفع موقعة', async () => {
    const rec = await cohorts.registerRecording(managerId, sessionId, {
      title: 'تسجيل جلسة الافتتاح', mime: 'video/mp4', sizeBytes: 50 * 1024 * 1024, durationSec: 5400,
    })
    expect(rec.recording.storageKey).toBeTruthy()
    expect(rec.uploadUrl).toContain('sig=')
    const mat = await cohorts.registerMaterial(managerId, cohortId, {
      title: 'ملخص الجلسة الأولى', kind: 'file',
      file: { originalName: 'summary.pdf', mime: 'application/pdf', sizeBytes: 1024 * 1024 },
    })
    expect(mat.material.storageKey).toBeTruthy()
    /* رابط القراءة الموقع يُبنى فقط بعد فحص الوصول في طبقة المسارات */
    const readUrl = cohorts.signedReadUrl(rec.recording.storageKey!)
    expect(readUrl).toContain('/api/v1/documents/')
    expect(readUrl).toContain('sig=')
    /* عرض المتعلم المسجل يتضمن التسجيل والمادة */
    const view = await enrollments.learnerCohortView(enrollmentId)
    expect(view.cohort.sessions[0].recordings.length).toBe(1)
    expect(view.cohort.materials.length).toBe(1)
  })

  it('5) الحضور: مدرب شعبة أخرى مرفوض، ومدرب الشعبة يسجل ويعاد حساب التقدم', async () => {
    await expect(progress.markAttendance(outsiderTrainerUserId, sessionId, enrollmentId, 'present'))
      .rejects.toMatchObject({ code: 'not_cohort_trainer' })
    /* الجلسة تُنهى ثم يُسجل الحضور — الحضور يُحسب على الجلسات المنتهية فقط */
    await prisma.cohortSession.update({ where: { id: sessionId }, data: { status: 'done' } })
    const att = await progress.markAttendance(trainerUserId, sessionId, enrollmentId, 'present')
    expect(att.status).toBe('present')
    const p = await prisma.courseProgress.findUnique({ where: { enrollmentId } })
    expect((p!.evidence as Record<string, number>).attendancePct).toBe(100)
    /* تسجيل حضور لمتعلم منسحب مرفوض */
    await expect(progress.markAttendance(trainerUserId, sessionId, '00000000-0000-0000-0000-000000000000', 'present'))
      .rejects.toMatchObject({ code: 'not_enrolled' })
  })

  it('6) الواجب: تسليم → مراجعة → طلب إعادة بلا سبب مرفوض → إعادة تسليم → قبول', async () => {
    const a = await assessments.createAssessment(managerId, {
      cohortId, title: 'واجب الوحدة الأولى', type: 'assignment', maxScore: 100,
    })
    assignmentId = a.id
    /* المتطفل لا يسلم */
    await expect(assessments.submitAssignment(outsiderId, assignmentId, { textAnswer: 'محاولة تطفل' }))
      .rejects.toMatchObject({ code: 'not_enrolled' })
    const s1 = await assessments.submitAssignment(learnerId, assignmentId, { textAnswer: 'حل الواجب الأول' })
    expect(s1.submission.status).toBe('submitted')

    await assessments.reviewSubmission(trainerUserId, s1.submission.id, 'start_review')
    await expect(assessments.reviewSubmission(trainerUserId, s1.submission.id, 'request_resubmit'))
      .rejects.toMatchObject({ code: 'no_reason' })
    await assessments.reviewSubmission(trainerUserId, s1.submission.id, 'request_resubmit', 'أضف تحليلا للحالة')
    /* إعادة التسليم متاحة الآن فقط */
    const s2 = await assessments.resubmit(learnerId, assignmentId, { textAnswer: 'حل محسّن مع تحليل الحالة' })
    submissionId = s2.submission.id
    expect(s2.submission.id).not.toBe(s1.submission.id)
    /* القديمة بقيت في الأثر */
    const all = await prisma.assignmentSubmission.findMany({ where: { assessmentId: assignmentId } })
    expect(all.length).toBe(2)

    await assessments.reviewSubmission(trainerUserId, submissionId, 'start_review')
    const accepted = await assessments.reviewSubmission(trainerUserId, submissionId, 'accept')
    expect(accepted.status).toBe('accepted')
    /* مدرب خارجي لا يراجع تسليمات هذه الشعبة */
    await expect(assessments.reviewSubmission(outsiderTrainerUserId, submissionId, 'accept'))
      .rejects.toMatchObject({ code: 'not_cohort_trainer' })
  })

  it('7) الدرجة وتعديلها — كل تعديل في سجل لا يُمحى', async () => {
    const g1 = await assessments.grade(trainerUserId, { submissionId, score: 85, maxScore: 100 })
    expect(Number(g1.score)).toBe(85)
    const g2 = await assessments.grade(trainerUserId, { submissionId, score: 90, maxScore: 100 })
    expect(g2.id).toBe(g1.id)
    const history = await prisma.gradeHistory.findMany({ where: { gradeId: g1.id }, orderBy: { createdAt: 'asc' } })
    expect(history.length).toBe(2)
    expect(Number(history[1].oldScore)).toBe(85)
    expect(Number(history[1].newScore)).toBe(90)
    /* درجة خارج النطاق مرفوضة */
    await expect(assessments.grade(trainerUserId, { submissionId, score: 120, maxScore: 100 }))
      .rejects.toMatchObject({ code: 'bad_score' })
  })

  it('8) اختبار قصير: محاولة وتقدير واجتياز', async () => {
    const quiz = await assessments.createAssessment(managerId, {
      cohortId, title: 'اختبار قصير', type: 'quiz', passScore: 50,
      items: [{ prompt: 'ما تعريف العملية؟', kind: 'text', maxScore: 10 }],
    })
    const attempt = await assessments.submitAttempt(learnerId, quiz.id, [
      { itemId: quiz.items[0].id, answer: 'سلسلة أنشطة تحول المدخلات لمخرجات' },
    ])
    await assessments.grade(trainerUserId, { attemptId: attempt.id, score: 90, maxScore: 100 })
    const graded = await prisma.assessmentAttempt.findUnique({ where: { id: attempt.id } })
    expect(graded!.status).toBe('graded')
  })

  it('9) التقدم يُشتق من أدلة حقيقية ويتجاوز الصفر', async () => {
    const p = await progress.recomputeProgress(enrollmentId)
    expect(p.percent).toBeGreaterThan(0)
    const ev = p.evidence as Record<string, number>
    expect(ev.attendancePct).toBe(100)
    expect(ev.assignmentsAccepted).toBe(1)
    expect(ev.assessmentsPassed).toBe(1)
  })

  it('10) الشهادة: مرفوضة قبل تحقق القواعد ثم صادرة بعدها', async () => {
    /* قاعدة على مستوى الدورة يستحيل تحققها الآن */
    await progress.setCompletionRule(managerId, { courseId: COURSE, type: 'assessment_passed', threshold: 99 })
    await expect(certificates.issue(enrollmentId, managerId))
      .rejects.toMatchObject({ code: 'rules_unmet' })
    /* قاعدة الشعبة تتقدم على قاعدة الدورة */
    await progress.setCompletionRule(managerId, { courseId: COURSE, cohortId, type: 'attendance_pct', threshold: 80 })
    const cert = await certificates.issue(enrollmentId, managerId)
    expect(cert.number).toMatch(/^WJ-CERT-\d{4}-\d{5}$/)
    expect(cert.learnerName).toBe('متعلم التشغيل')
    /* التسجيل أصبح مكتملا */
    const e = await prisma.enrollment.findUnique({ where: { id: enrollmentId } })
    expect(e!.status).toBe('completed')
    /* لا إصدار مكرر */
    await expect(certificates.issue(enrollmentId, managerId))
      .rejects.toMatchObject({ code: 'already_issued' })
  })

  it('11) التحقق العام محدود البيانات ويُسجل، والإلغاء يتطلب سببا', async () => {
    const cert = await prisma.certificate.findFirst({ where: { enrollmentId } })
    const v = await certificates.verify(cert!.number, '127.0.0.1')
    expect(v.status).toBe('active')
    expect(v.learnerName).toBe('متعلم التشغيل')
    expect(v).not.toHaveProperty('enrollmentId')
    const logs = await prisma.certificateVerification.count({ where: { certificateId: cert!.id } })
    expect(logs).toBe(1)
    await expect(certificates.verify('WJ-CERT-0000-99999')).rejects.toMatchObject({ code: 'not_found' })

    await expect(certificates.revoke(cert!.id, managerId, 'لا')).rejects.toMatchObject({ code: 'no_reason' })
    await certificates.revoke(cert!.id, managerId, 'إصدار بالخطأ لشعبة غير مكتملة')
    const v2 = await certificates.verify(cert!.number)
    expect(v2.status).toBe('revoked')
    expect(v2.revokedReason).toContain('إصدار بالخطأ')
    await expect(certificates.revoke(cert!.id, managerId, 'محاولة ثانية'))
      .rejects.toMatchObject({ code: 'bad_state' })
  })
})
