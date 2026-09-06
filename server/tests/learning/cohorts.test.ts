/* اختبار E2E لدورة حياة الشعبة:
   إنشاء → تعيين مدرب (تأهيل إلزامي) → منع تعارض الجدول →
   فتح مرفوض بلا شروط ثم ناجح بعدها → تسجيل بسعة محروسة →
   قائمة انتظار عند الامتلاء → تجاوز موثق بصلاحية. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService, RUBRIC_CRITERIA } from '../../services/trainer-review.service'
import { CohortService } from '../../services/cohort.service'
import { EnrollmentService } from '../../services/enrollment.service'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let cohorts: CohortService
let enrollments: EnrollmentService
let managerId: string
let profileId = ''
const COURSE = 'C-BIZ-101'

const scores = () => Object.fromEntries(RUBRIC_CRITERIA.map((k) => [k, 5])) as Record<string, number>

/** مدرب معتمد ونشط عبر الدورة الرسمية نفسها */
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
  const m = await auth.register('cohort-manager@test.local', 'Manager#12345', 'مدير أكاديمي')
  managerId = m.userId
  await auth.setRoles(managerId, ['academic_manager'])
  const t = await makeActiveTrainer('cohort-trainer@test.local', 'مدرب الشعب')
  profileId = t.profileId
}, 240_000)

describe('دورة حياة الشعبة', () => {
  let cohortId = ''
  const sessionStart = new Date('2026-09-01T18:00:00Z')
  const sessionEnd = new Date('2026-09-01T20:00:00Z')

  it('1) إنشاء شعبة — مسودة افتراضا', async () => {
    const c = await cohorts.create(managerId, { courseId: COURSE, title: 'شعبة اختبار أكتوبر' })
    cohortId = c.id
    expect(c.status).toBe('draft')
    await expect(cohorts.create(managerId, { courseId: 'NOPE', title: 'شعبة وهمية' }))
      .rejects.toMatchObject({ code: 'unknown_course' })
  })

  it('2) تعيين مدرب غير مؤهل مرفوض — وبعد التأهيل ينجح', async () => {
    await expect(cohorts.assignTrainer(cohortId, profileId, managerId))
      .rejects.toMatchObject({ code: 'not_qualified' })
    await review.qualifyForCourse(profileId, COURSE, managerId)
    const link = await cohorts.assignTrainer(cohortId, profileId, managerId, 'lead')
    expect(link.role).toBe('lead')
  })

  it('3) تعارض جدول المدرب ممنوع بين شعبتين', async () => {
    await cohorts.addSession(managerId, cohortId, { title: 'الجلسة الأولى', startsAt: sessionStart, endsAt: sessionEnd })
    const other = await cohorts.create(managerId, { courseId: COURSE, title: 'شعبة متداخلة الموعد' })
    /* جلسة الشعبة الأخرى تتداخل مع جلسة المدرب القائمة */
    await cohorts.addSession(managerId, other.id, {
      title: 'جلسة متزامنة', startsAt: new Date('2026-09-01T19:00:00Z'), endsAt: new Date('2026-09-01T21:00:00Z'),
    })
    await expect(cohorts.assignTrainer(other.id, profileId, managerId))
      .rejects.toMatchObject({ code: 'trainer_conflict' })
    /* موعد غير متداخل ينجح */
    const far = await cohorts.create(managerId, { courseId: COURSE, title: 'شعبة موعد بعيد' })
    await cohorts.addSession(managerId, far.id, {
      title: 'جلسة لاحقة', startsAt: new Date('2026-09-03T18:00:00Z'), endsAt: new Date('2026-09-03T20:00:00Z'),
    })
    const link = await cohorts.assignTrainer(far.id, profileId, managerId)
    expect(link.cohortId).toBe(far.id)
  })

  it('4) الفتح مرفوض بقائمة النواقص قبل اكتمال الشروط الخمسة', async () => {
    const empty = await cohorts.create(managerId, { courseId: COURSE, title: 'شعبة ناقصة الشروط' })
    const check = await cohorts.openChecklist(empty.id)
    expect(check.ready).toBe(false)
    expect(check.missing.join(' ')).toContain('جدول')
    await expect(cohorts.open(empty.id, managerId)).rejects.toMatchObject({ code: 'open_blocked' })
  })

  it('5) بعد اكتمال الشروط يفتح ويصبح التسجيل متاحا', async () => {
    /* شروط الفتح: دورة منشورة ✓ + جدول ✓ (خطوة 3) + سعة + خطة تقديم
       + إعداد مالي. والمدرّبُ خارجَها — يُسنَد لاحقا. */
    await cohorts.update(managerId, cohortId, { capacity: 1, price: 500, currency: 'JOD', financialReady: true })
    await prisma.cohortDeliveryPlan.create({
      data: { cohortId, content: { note: 'خطة تقديم الشعبة' }, status: 'approved', createdBy: managerId },
    })
    const check = await cohorts.openChecklist(cohortId)
    expect(check.ready).toBe(true)
    const opened = await cohorts.open(cohortId, managerId)
    expect(opened.status).toBe('open')
    expect(opened.registrationOpen).toBe(true)
  })

  it('6) السعة محروسة: الأول مسجل والثاني في قائمة الانتظار والحالة تقلب full', async () => {
    const l1 = await auth.register('learner-one@test.local', 'Learner#12345', 'متعلم أول')
    const l2 = await auth.register('learner-two@test.local', 'Learner#12345', 'متعلم ثان')
    const e1 = await enrollments.enroll(cohortId, l1.userId, managerId)
    expect(e1.status).toBe('enrolled')
    const e2 = await enrollments.enroll(cohortId, l2.userId, managerId)
    expect(e2.status).toBe('waitlisted')
    const cohort = await prisma.cohort.findUnique({ where: { id: cohortId } })
    expect(cohort!.status).toBe('full')
    /* تسجيل مكرر لنفس المتعلم مرفوض */
    await expect(enrollments.enroll(cohortId, l1.userId, managerId))
      .rejects.toMatchObject({ code: 'already_enrolled' })
  })

  it('7) تجاوز السعة موثق ويحمل علما', async () => {
    const l3 = await auth.register('learner-three@test.local', 'Learner#12345', 'متعلم ثالث')
    const e3 = await enrollments.enroll(cohortId, l3.userId, managerId, { overrideCapacity: true })
    expect(e3.status).toBe('enrolled')
    expect(e3.overrideCapacity).toBe(true)
  })

  it('8) شعبة مسودة أو مغلقة التسجيل ترفض التسجيل', async () => {
    const draft = await cohorts.create(managerId, { courseId: COURSE, title: 'شعبة غير مفتوحة' })
    const l4 = await auth.register('learner-four@test.local', 'Learner#12345', 'متعلم رابع')
    await expect(enrollments.enroll(draft.id, l4.userId, managerId))
      .rejects.toMatchObject({ code: 'closed' })
  })

  it('9) الانسحاب من شعبة ممتلئة يرقّي أوّل قائمة الانتظار تلقائيا', async () => {
    const promo = await cohorts.create(managerId, { courseId: COURSE, title: 'شعبة ترقية قائمة الانتظار' })
    await cohorts.addSession(managerId, promo.id, {
      title: 'جلسة الترقية', startsAt: new Date('2026-09-05T18:00:00Z'), endsAt: new Date('2026-09-05T20:00:00Z'),
    })
    await cohorts.assignTrainer(promo.id, profileId, managerId)
    await cohorts.update(managerId, promo.id, { capacity: 1, price: 500, currency: 'JOD', financialReady: true })
    await prisma.cohortDeliveryPlan.create({
      data: { cohortId: promo.id, content: { note: 'خطة تقديم' }, status: 'approved', createdBy: managerId },
    })
    await cohorts.open(promo.id, managerId)

    const p1 = await auth.register('promo-learner-one@test.local', 'Learner#12345', 'متعلم أول للترقية')
    const p2 = await auth.register('promo-learner-two@test.local', 'Learner#12345', 'متعلم ثان للترقية')
    const first = await enrollments.enroll(promo.id, p1.userId, managerId)
    const second = await enrollments.enroll(promo.id, p2.userId, managerId)
    expect(first.status).toBe('enrolled')
    expect(second.status).toBe('waitlisted')
    expect((await prisma.cohort.findUnique({ where: { id: promo.id } }))!.status).toBe('full')

    await enrollments.drop(first.id, managerId, 'انسحاب اختباري')

    const promoted = await prisma.enrollment.findUnique({ where: { id: second.id } })
    expect(promoted!.status).toBe('enrolled')
    expect((await prisma.cohort.findUnique({ where: { id: promo.id } }))!.status).toBe('full')
    const progress = await prisma.courseProgress.findUnique({ where: { enrollmentId: second.id } })
    expect(progress).not.toBeNull()
  })

  it('10) انتقالات الحالة غير المشروعة مرفوضة', async () => {
    await expect(cohorts.transition(cohortId, 'completed', managerId))
      .rejects.toMatchObject({ code: 'bad_transition' })
    await cohorts.transition(cohortId, 'active', managerId, 'بدء التقديم')
    await cohorts.transition(cohortId, 'completed', managerId, 'اختتام')
    /* شعبة منتهية لا تُعدل */
    await expect(cohorts.update(managerId, cohortId, { title: 'تعديل متأخر' }))
      .rejects.toMatchObject({ code: 'bad_state' })
  })
})
