/* عطبان في معادلة المستحقّات، كشفهما فحصُ مثالٍ حسابيٍّ عُرض إدراجُه في العقد.

   ١) **الأتعابُ كانت تُحسب للمساعد لا للأصيل.** `cohortLeadTrainer` كان يرتّب
      `role: 'asc'` وفي تعليقه «lead قبل assistant أبجدياً» — والتعليقُ خاطئ،
      فـ`'assistant' < 'lead'`. فشعبةٌ فيها مساعدٌ تُحتسب بقاعدته هو، ومقاعدُ
      رابطِ الأصيل تُقاس بمعيارِ غيرِه فتُحسب «عامّة».

   ٢) **وشاشةُ «مستحقّاتي» كانت لا تطبّق الحدَّ الأدنى** بينما يطبّقه الكشف —
      فيُعرض للمدرّب رقمٌ ويُدفع له آخرُ أكبرُ منه.

   والمقيسُ هنا **تطابقُ المصدرين** لا ورودُ رقمٍ بعينه: أنّ الكشفَ ينسب
   للأصيل، وأنّ التوقّعَ والكشفَ يخرجان من معادلةٍ واحدة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerApplicationService, type AvailabilityInput } from '../../services/trainer-application.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { ReferralService } from '../../services/referral.service'
import { EnrollmentService } from '../../services/enrollment.service'
import { EarningsService } from '../../services/earnings.service'

let prisma: PrismaClient
let earnings: EarningsService
let adminId = ''
let leadUserId = ''
let leadProfileId = ''
let assistantProfileId = ''
let cohortId = ''
let floorCohortId = ''

const phase1 = (email: string, name: string) => ({
  fullName: name, email, country: 'الأردن', timezone: 'Asia/Amman', phoneCountryCode: '+962', phone: '790000004',
  specialties: ['تحليل البيانات والمالية'], domainYears: '8-12' as const, trainingYears: 'formal_teaching',
  trainingLanguages: ['العربية'], deliveryMode: 'both' as const,
  motivation: 'أريد الانضمام إلى وجيز لأنني درّبت فرقا حقيقية في بيئات عمل عربية، وأعرف الفرق بين من يعرف المادة ومن يستطيع تعليمها. سأقدّم للمتعلمين مهمة تطبيقية من واقع عملهم.',
  privacyConsent: true as const, password: 'Trainer#12345',
})

describe('الأصيلُ والحدُّ الأدنى — معادلةٌ واحدةٌ ومستحقٌّ لصاحبه', () => {
  beforeAll(async () => {
    await setupTestDb()
    prisma = await testPrisma()
    const auth = new AuthService(prisma)
    const apps = new TrainerApplicationService(prisma)
    const review = new TrainerReviewService(prisma)
    const referrals = new ReferralService(prisma)
    const enrollments = new EnrollmentService(prisma)
    earnings = new EarningsService(prisma)

    adminId = (await auth.register('admin-lead@test.local', 'Admin#12345', 'المدير')).userId
    await auth.setRoles(adminId, ['academic_manager'])

    const mk = async (email: string, name: string) => {
      const res = await apps.submitPhase1(phase1(email, name))
      await apps.completePhase2(res.reference, res.candidateToken, {
        previousCourses: [], teachableCourseIds: ['C-BIZ-101'],
        availability: { seasons: ['nov_jan'] } as AvailabilityInput, demoConsent: true as const, contact: { channel: 'email' },
      })
      const app = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference: res.reference } })
      await review.decide(app.id, adminId, 'move_to_review')
      await review.decide(app.id, adminId, 'approve')
      const profile = await prisma.trainerProfile.findUniqueOrThrow({ where: { applicationId: app.id } })
      return { userId: app.userId!, profileId: profile.id }
    }
    const lead = await mk('trainer-lead@test.local', 'المدرّب الأصيل')
    const assistant = await mk('trainer-assistant@test.local', 'المساعد')
    leadUserId = lead.userId; leadProfileId = lead.profileId; assistantProfileId = assistant.profileId

    const mkCohort = async (title: string) => (await prisma.cohort.create({
      data: { courseId: 'C-BIZ-101', title, status: 'open', registrationOpen: true, financialReady: true, price: 100, currency: 'USD', capacity: 20 },
    })).id
    cohortId = await mkCohort('شعبةٌ فيها مساعد')
    floorCohortId = await mkCohort('شعبةٌ دون الحدّ الأدنى')

    /* والمساعدُ يُكتب أوّلا بقصد: لو كان الترتيبُ هو الحَكَم لَفاز */
    await prisma.cohortTrainer.create({ data: { cohortId, profileId: assistantProfileId, role: 'assistant', assignedBy: adminId } })
    await prisma.cohortTrainer.create({ data: { cohortId, profileId: leadProfileId, role: 'lead', assignedBy: adminId } })
    await prisma.cohortTrainer.create({ data: { cohortId: floorCohortId, profileId: leadProfileId, role: 'lead', assignedBy: adminId } })

    /* قاعدتان مختلفتان: الأصيلُ 25/30 بحدٍّ أدنى 8، والمساعدُ 10 بلا حدّ */
    await earnings.setRule(adminId, { profileId: leadProfileId, type: 'per_seat', rate: 25, referralRate: 30, minSeats: 8 })
    await earnings.setRule(adminId, { profileId: assistantProfileId, type: 'per_seat', rate: 10 })

    const code = (await referrals.linkFor(leadUserId, cohortId)).code
    const buyer = async (email: string) => (await auth.register(email, 'Buyer#12345', 'مشترٍ')).userId
    /* شعبةُ المساعد: مقعدان عبر رابط الأصيل ومقعدٌ عامّ */
    await enrollments.enroll(cohortId, await buyer('b-lead-1@test.local'), null, { referralCode: code })
    await enrollments.enroll(cohortId, await buyer('b-lead-2@test.local'), null, { referralCode: code })
    await enrollments.enroll(cohortId, await buyer('b-lead-3@test.local'), null, {})

    /* وشعبةُ الحدّ الأدنى: اثنان بالإحالة وثلاثةٌ عامّون — خمسةٌ دون الثمانية */
    const floorCode = (await referrals.linkFor(leadUserId, floorCohortId)).code
    await enrollments.enroll(floorCohortId, await buyer('b-floor-1@test.local'), null, { referralCode: floorCode })
    await enrollments.enroll(floorCohortId, await buyer('b-floor-2@test.local'), null, { referralCode: floorCode })
    for (const n of [3, 4, 5]) {
      await enrollments.enroll(floorCohortId, await buyer(`b-floor-${n}@test.local`), null, {})
    }
  })

  it('الكشفُ يُحتسب بقاعدة الأصيل لا بقاعدة المساعد — ولو كُتب المساعدُ أوّلا', async () => {
    const computed = await earnings.computeCohort(cohortId)
    expect(computed.profile.id, 'الشعبةُ نُسبت إلى غير الأصيل').toBe(leadProfileId)
    expect(computed.rule.rate, 'احتُسبت بقاعدة غيرِ الأصيل').toBe(25)
  })

  it('ومقاعدُ رابط الأصيل تُقاس بمعياره هو — وإلّا قُرئت عامّة', async () => {
    const computed = await earnings.computeCohort(cohortId)
    const referral = computed.items.find((i) => i.sourceRef === `cohort:${cohortId}:referral`)
    expect(referral, 'لا بندَ إحالةٍ أصلا — قِيست المقاعدُ بمعيار غيرِ صاحب الرابط').toBeTruthy()
    expect(referral!.amount).toBe(60)
  })

  it('والحدُّ الأدنى يُكمَّل من العامّ: خمسةُ مسجّلين تُحتسب ثمانيةَ مقاعد', async () => {
    const computed = await earnings.computeCohort(floorCohortId)
    /* 6 عامّا × 25 + 2 إحالة × 30 = 210، وهي ثمانيةُ مقاعدَ لا خمسة */
    expect(computed.total).toBe(210)
  })

  it('وتوقّعُ الشاشة يطابق الكشفَ في الشعبة نفسِها — وإلّا رقمان لشيءٍ واحد', async () => {
    const mine = await earnings.listForTrainer(leadUserId)
    const row = mine.cohorts.find((c: { cohortId: string }) => c.cohortId === floorCohortId)
    const computed = await earnings.computeCohort(floorCohortId)
    expect(row, 'الشعبةُ غائبةٌ عن شاشة المدرّب').toBeTruthy()
    expect(row!.projected, 'التوقّعُ يخالف الكشفَ — معادلتان لا واحدة').toBe(computed.total)
  })

  it('وتقول الشاشةُ إنّ الاحتسابَ جرى على الحدّ الأدنى — فلا يُقرأ الفرقُ خطأً', async () => {
    const mine = await earnings.listForTrainer(leadUserId)
    const row = mine.cohorts.find((c: { cohortId: string }) => c.cohortId === floorCohortId)
    expect(row!.floorApplied).toBe(true)
    expect(row!.billedSeats).toBe(8)
  })
})
