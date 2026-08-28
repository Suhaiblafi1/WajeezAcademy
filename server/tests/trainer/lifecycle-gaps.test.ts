/* الثغرات التي كانت تقطع الطريق بين «قدّمتُ طلبا» و«صرتُ مدربا يدرّس».

   ثلاث منها قِيست في الشيفرة قبل إصلاحها:
   ١) رمز تحقق البريد كان يُعاد في التطوير وحده ولا يُرسل بريدا أبدا، فالمتقدم
      في الإنتاج يقف عند «بانتظار تحقق البريد» إلى الأبد.
   ٢) رمز الدعوة كان يُحجب في الإنتاج، فتُنشأ الدعوة ولا يملك أحد رمزها — أي أن
      الحساب لا يُفتح أبدا.
   ٣) الإسناد من شاشة المدربين كان يكتب TrainerCourseAssignment وحده، بينما كل
      سطح المدرب يقرأ CohortTrainer — فيُسنَد المدرب ويفتح منصته فيجدها فارغة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerApplicationService } from '../../services/trainer-application.service'
import { TrainerReviewService, RUBRIC_CRITERIA } from '../../services/trainer-review.service'
import { CohortService } from '../../services/cohort.service'

let prisma: PrismaClient
let apps: TrainerApplicationService
let review: TrainerReviewService
let adminId: string

const scores = () => Object.fromEntries(RUBRIC_CRITERIA.map((k) => [k, 4])) as Record<string, number>

const base = {
  phoneCountryCode: '+962', phone: '770000000', country: 'الأردن',
  jobTitle: 'مدرب', specialties: ['تحليل البيانات والمالية'],
  domainYears: '8-12' as const, trainingYears: 'formal_teaching',
  bio: 'خبرة', trainingLanguages: ['العربية'], deliveryMode: 'both' as const,
  motivation: 'أريد الانضمام إلى وجيز لأنني درّبت فرقا حقيقية في بيئات عمل عربية، وأعرف الفرق بين من يعرف المادة ومن يستطيع تعليمها. سأقدّم للمتعلمين مهمة تطبيقية من واقع عملهم في كل وحدة، وأراجع مخرجاتهم بنفسي وأكتب لكل واحد ما ينقصه تحديدا لا تقييما عاما.', privacyConsent: true as const,
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  apps = new TrainerApplicationService(prisma)
  review = new TrainerReviewService(prisma)
  const auth = new AuthService(prisma)
  const admin = await auth.register('admin-gaps@test.local', 'Admin#12345', 'مدير')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
  /* القناة معطّلة صراحة — هذا هو الفرع المفحوص هنا */
  await prisma.integrationSetting.upsert({
    where: { provider: 'email' },
    update: { enabled: false, config: {} },
    create: { provider: 'email', enabled: false, config: {} },
  })
}, 180_000)

describe('قناة البريد غير مفعّلة — الطلب لا يُحبس عند بوابة لا تعمل', () => {
  it('يمضي إلى «مقدَّم» ويعيد رمز وصول المرشح بدل الوقوف عند التحقق', async () => {
    const res = await apps.submitPhase1({ ...base, fullName: 'متقدم بلا بريد', email: 'nomail@test.local' })
    expect(res.emailDelivery).toBe('not_configured')
    expect(res.candidateToken, 'لم يُصدر رمز وصول فبقي المتقدم بلا طريق').toBeTruthy()
    const row = await prisma.trainerApplication.findUnique({ where: { reference: res.reference } })
    expect(row!.status).toBe('submitted')
    expect(row!.accessTokenHash).not.toBeNull()
  })

  it('لا يدّعي تحققا لم يقع: emailVerifiedAt فارغ والسبب مكتوب في سجل الحالة', async () => {
    const row = await prisma.trainerApplication.findFirst({
      where: { email: 'nomail@test.local' }, include: { statusHistory: true },
    })
    expect(row!.emailVerifiedAt, 'وُسم بريد لم يُتحقق منه كأنه تحقق').toBeNull()
    const notes = row!.statusHistory.map((h) => h.note ?? '').join(' | ')
    expect(notes).toContain('قناة البريد غير مفعّلة')
  })

  it('رمز المرشح المُعاد يفتح المرحلة الثانية فعلا — لا رمزا لا يعمل', async () => {
    const teachable = await prisma.course.findFirst({ select: { id: true } })
    const res = await apps.submitPhase1({ ...base, fullName: 'متقدم ثان', email: 'nomail2@test.local' })
    const row = await prisma.trainerApplication.findUnique({ where: { reference: res.reference } })
    /* المرحلة الثانية تُفتح بقرار إدارة؛ نصل بالحالة إليها ثم نستخدم الرمز */
    await review.decide(row!.id, adminId, 'move_to_review')
    await review.decide(row!.id, adminId, 'request_info', 'أرسل نموذج تدريب')
    const saved = await apps.completePhase2(res.reference, res.candidateToken!, {
      previousCourses: [{ title: 'التفاوض التجاري', org: 'جهة سابقة', year: 2025, link: 'https://example.test/course' }],
      teachableCourseIds: [teachable!.id],
      availability: { hoursPerWeek: 6 },
      demoConsent: true,
    })
    expect(saved.phase2CompletedAt).toBeInstanceOf(Date)
  })
})

describe('الدعوة تصل إلى يدٍ ما', () => {
  it('تُعيد رابط القبول ورمزه للمسؤول مهما كانت البيئة', async () => {
    const res = await apps.submitPhase1({ ...base, fullName: 'مرشح للاعتماد', email: 'invite-gap@test.local' })
    const app = await prisma.trainerApplication.findUnique({ where: { reference: res.reference } })
    await review.decide(app!.id, adminId, 'move_to_review')
    await review.addReview(app!.id, adminId, scores(), 'مؤهل')
    await review.decide(app!.id, adminId, 'shortlist')
    await review.decide(app!.id, adminId, 'request_demo')
    await review.recordDemoEvaluation(app!.id, adminId, scores(), 'pass')
    await review.decide(app!.id, adminId, 'academic_review')
    await review.decide(app!.id, adminId, 'conditionally_approve')
    const contract = await review.createContract(app!.id, adminId, { title: 'عقد تدريب', terms: {} })
    await review.signContract(contract.id, adminId)
    const inv = await review.createInvitation(app!.id, adminId)
    expect(inv.tokenForDelivery.length).toBeGreaterThan(20)
    expect(inv.acceptUrl).toContain('/trainer/accept-invite?token=')
    expect(inv.acceptUrl).toContain(inv.tokenForDelivery)
    /* والرمز يعمل: حساب حقيقي بدور مدرب */
    const { userId } = await review.consumeInvitation(inv.tokenForDelivery, 'TrainerPass#1', 'مدرب معتمد')
    const roles = await prisma.userRole.findMany({ where: { userId }, select: { roleId: true } })
    expect(roles.map((r) => r.roleId)).toContain('trainer')
  })
})

describe('الإسناد إلى شعبة يُنتج الرابط التشغيلي لا سجلا إداريا وحده', () => {
  it('assignToCohort يكتب CohortTrainer أيضا — وإلا فتح المدرب منصته فارغة', async () => {
    const profile = await prisma.trainerProfile.findFirst({ where: { application: { email: 'invite-gap@test.local' } } })
    expect(profile, 'لا ملف مدرب — الاختبار السابق لم يكتمل').toBeTruthy()
    const course = await prisma.course.findFirst({ select: { id: true } })
    await review.qualifyForCourse(profile!.id, course!.id, adminId)
    const cohort = await new CohortService(prisma).create(adminId, {
      courseId: course!.id,
      title: 'شعبة فحص الإسناد',
      startsAt: new Date(Date.now() + 7 * 86400_000),
      capacity: 10,
    })
    await review.assignToCohort(profile!.id, course!.id, cohort.id, adminId)
    const link = await prisma.cohortTrainer.findUnique({
      where: { cohortId_profileId: { cohortId: cohort.id, profileId: profile!.id } },
    })
    expect(link, 'أُسند المدرب بلا رابط تشغيلي — منصته ستكون فارغة').toBeTruthy()
    const admin = await prisma.trainerCourseAssignment.findFirst({ where: { profileId: profile!.id, cohortId: cohort.id } })
    expect(admin, 'ضاع السجل الإداري').toBeTruthy()
  })

  it('إسناد بلا شعبة يبقى سجلا إداريا وحده — لا يخترع ربطا تشغيليا', async () => {
    const profile = await prisma.trainerProfile.findFirst({ where: { application: { email: 'invite-gap@test.local' } } })
    const courses = await prisma.course.findMany({ take: 2, select: { id: true } })
    const other = courses[1]!
    await review.qualifyForCourse(profile!.id, other.id, adminId)
    await review.assignToCohort(profile!.id, other.id, undefined, adminId)
    const links = await prisma.cohortTrainer.count({ where: { profileId: profile!.id } })
    expect(links, 'أُنشئ ربط شعبة بلا شعبة').toBe(1)
  })
})
