/* رابطُ دعوة المدرّب — الحلقةُ كاملةً في الخادم.

   قرارُ صاحب المنصّة (٨ سبتمبر ٢٠٢٦): سعرٌ واحدٌ للطالب وأجران للمدرّب.
   ١) الرابطُ يُنشأ مرّةً لكلّ (شعبة، مدرّب) ويُعاد كما هو — ولا يبلغه غيرُ صاحبه.
   ٢) الدفعُ برمزٍ صحيحٍ يحمله على الحجز؛ والسعرُ لا يتغيّر.
   ٣) ورمزٌ لا يخصّ الشعبةَ يُهمَل ولا يوقف الدفع.
   ٤) والتسجيلُ يُختم بمصدره ولا يُكتب فوقَه.
   ٥) والكشفُ بندان: عامٌّ بـ`rate` وعبر الرابط بـ`referralRate`. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerApplicationService, type AvailabilityInput } from '../../services/trainer-application.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { ReferralService } from '../../services/referral.service'
import { CommerceService } from '../../services/commerce.service'
import { EnrollmentService } from '../../services/enrollment.service'
import { EarningsService } from '../../services/earnings.service'

let prisma: PrismaClient
let referrals: ReferralService
let commerce: CommerceService
let enrollments: EnrollmentService
let earnings: EarningsService
let adminId = ''
let trainerUserId = ''
let profileId = ''
let otherTrainerUserId = ''
let cohortId = ''
let otherCohortId = ''
let buyerA = ''
let buyerB = ''
let code = ''

const phase1 = (email: string, name: string) => ({
  fullName: name, email, country: 'الأردن', timezone: 'Asia/Amman', phoneCountryCode: '+962', phone: '790000003',
  specialties: ['تحليل البيانات والمالية'], domainYears: '8-12' as const, trainingYears: 'formal_teaching',
  trainingLanguages: ['العربية'], deliveryMode: 'both' as const,
  motivation: 'أريد الانضمام إلى وجيز لأنني درّبت فرقا حقيقية في بيئات عمل عربية، وأعرف الفرق بين من يعرف المادة ومن يستطيع تعليمها. سأقدّم للمتعلمين مهمة تطبيقية من واقع عملهم.',
  privacyConsent: true as const, password: 'Trainer#12345',
})

describe('رابطُ دعوة المدرّب', () => {
  beforeAll(async () => {
    await setupTestDb()
    prisma = await testPrisma()
    const auth = new AuthService(prisma)
    const apps = new TrainerApplicationService(prisma)
    const review = new TrainerReviewService(prisma)
    referrals = new ReferralService(prisma)
    commerce = new CommerceService(prisma)
    enrollments = new EnrollmentService(prisma)
    earnings = new EarningsService(prisma)

    adminId = (await auth.register('admin-referral@test.local', 'Admin#12345', 'المدير')).userId
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
    const t1 = await mk('trainer-referral@test.local', 'مدرب الإحالة')
    const t2 = await mk('trainer-referral-other@test.local', 'مدرب آخر')
    trainerUserId = t1.userId; profileId = t1.profileId; otherTrainerUserId = t2.userId

    const mkCohort = async (title: string) => (await prisma.cohort.create({
      data: { courseId: 'C-BIZ-101', title, status: 'open', registrationOpen: true, financialReady: true, price: 100, currency: 'USD', capacity: 20 },
    })).id
    cohortId = await mkCohort('شعبة الإحالة')
    otherCohortId = await mkCohort('شعبة أخرى')
    await prisma.cohortTrainer.create({ data: { cohortId, profileId, role: 'lead', assignedBy: adminId } })

    buyerA = (await auth.register('buyer-ref-a@test.local', 'Buyer#12345', 'مشترٍ أ')).userId
    buyerB = (await auth.register('buyer-ref-b@test.local', 'Buyer#12345', 'مشترٍ ب')).userId
  })

  it('الرابطُ يُنشأ مرّةً ويُعاد كما هو — ولا يبلغه غيرُ صاحبه', async () => {
    const first = await referrals.linkFor(trainerUserId, cohortId)
    const again = await referrals.linkFor(trainerUserId, cohortId)
    expect(again.code).toBe(first.code)
    expect(first.url).toContain(`ref=${encodeURIComponent(first.code)}`)
    code = first.code
    await expect(referrals.linkFor(otherTrainerUserId, cohortId)).rejects.toMatchObject({ code: 'not_your_cohort' })
  })

  it('الدفعُ برمزٍ صحيحٍ يحمله على الحجز — والسعرُ واحد', async () => {
    const withoutCode = await commerce.checkout(buyerB, [cohortId])
    const withCode = await commerce.checkout(buyerA, [cohortId], undefined, code)
    expect(withCode.total).toBe(withoutCode.total)
    const req = await prisma.enrollmentRequest.findUniqueOrThrow({ where: { userId_cohortId: { userId: buyerA, cohortId } } })
    expect(req.referralCode).toBe(code)
    const reqB = await prisma.enrollmentRequest.findUniqueOrThrow({ where: { userId_cohortId: { userId: buyerB, cohortId } } })
    expect(reqB.referralCode).toBeNull()
  })

  it('ورمزٌ لا يخصّ الشعبةَ يُهمَل بأثرٍ ولا يوقف الدفع', async () => {
    const buyerC = (await new AuthService(prisma).register('buyer-ref-c@test.local', 'Buyer#12345', 'مشترٍ ج')).userId
    const r = await commerce.checkout(buyerC, [otherCohortId], undefined, code)
    expect(r.orderId).toBeTruthy()
    const req = await prisma.enrollmentRequest.findUniqueOrThrow({ where: { userId_cohortId: { userId: buyerC, cohortId: otherCohortId } } })
    expect(req.referralCode).toBeNull()
    const audit = await prisma.auditEvent.findFirst({ where: { action: 'checkout.referral_ignored', actorId: buyerC } })
    expect(audit).not.toBeNull()
  })

  it('والتسجيلُ يُختم بمصدره ولا يُكتب فوقَه', async () => {
    const a = await enrollments.enroll(cohortId, buyerA, null, { referralCode: code })
    expect(a.referralProfileId).toBe(profileId)
    expect(a.referralCode).toBe(code)
    const b = await enrollments.enroll(cohortId, buyerB, null, {})
    expect(b.referralProfileId).toBeNull()
    /* إعادةُ تسجيلٍ بلا رمزٍ لا تمحو الختم */
    const again = await enrollments.enroll(cohortId, buyerA, null, {}).catch(() => null)
    const row = await prisma.enrollment.findFirstOrThrow({ where: { cohortId, userId: buyerA } })
    void again
    expect(row.referralProfileId).toBe(profileId)
  })

  it('والكشفُ بندان: عامٌّ بأجره وعبر الرابط بأجره', async () => {
    await earnings.setRule(adminId, { profileId, type: 'per_seat', rate: 50, referralRate: 80 })
    const computed = await earnings.computeCohort(cohortId)
    const general = computed.items.find((i) => i.sourceRef === `cohort:${cohortId}`)
    const referred = computed.items.find((i) => i.sourceRef === `cohort:${cohortId}:referral`)
    expect(general?.amount).toBe(50)
    expect(referred?.amount).toBe(80)
    expect(computed.total).toBe(130)
    expect(computed.rule.referralRate).toBe(80)
  })

  it('وكشفُ المدرّب يقول عن كلّ شعبة: كم عامّا وكم عبر رابطه', async () => {
    const mine = await earnings.listForTrainer(trainerUserId)
    const c = mine.cohorts.find((x) => x.cohortId === cohortId)
    expect(c).toMatchObject({ general: 1, referred: 1, rate: 50, referralRate: 80, projected: 130 })
  })
})
