/* تركيبُ العقد لا يبدّل نوعَ الأجر ولا يكتب قاعدةً ثانيةً بأرقامها (`contract-fee.ts`، ٢٤ أكتوبر ٢٠٢٦).

   كانت الشاشةُ ترسل `per_seat` دائما، والخادمُ يكتب ما يصله قاعدةً جديدة: مدرّبٌ أجرُه «ثابتٌ لكلّ شعبة: 400» يُركَّب
   له عقدٌ والخاناتُ كما مُلئت، فيصير «400 لكلّ متعلّم» ويُطبَع ذلك في متن عقده. والخادمُ يقيس الآن بمقياس الشاشة
   نفسِه، فلا تمرّ صفحةٌ قديمةٌ في متصفّح أحد.

   ① تبديلُ النوع من العقد يُردّ، وتبقى القاعدةُ السارية كما هي.
   ② والأرقامُ نفسُها لا تُكتب قاعدةً ثانية — والعقدُ يحمل معرّفَ القاعدة السارية.
   ③ وما تغيّر رقمُه يُكتب بنوعه. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { EarningsService } from '../../services/earnings.service'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let adminId = ''
const COURSE = 'C-CONTRACT-FEE-101'
const DAY = 86_400_000
const INPUT = {
  title: 'اتفاقية تقديم خدمات تدريبية',
  requiredDocuments: [{ kind: 'national_id', labelAr: 'الهويّة', required: true }],
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  adminId = (await auth.register('contract-fee-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')).userId
  await auth.setRoles(adminId, ['academic_manager'])
  await prisma.course.create({ data: { id: COURSE, status: 'published', currentVersion: 1 } })
  await prisma.courseVersion.create({ data: { courseId: COURSE, version: 1, titleAr: 'أساسيات المحاسبة', totalHours: 10 } })
}, 240_000)

let seq = 0
/** مقبولٌ داخليّا له قاعدةُ أتعابٍ بنوعها — جاهزٌ لأن يُركَّب له عقد */
async function candidate(rule: { type: string; rate: number; minSeats?: number; referralRate?: number }) {
  const n = ++seq
  const email = `contract-fee-${n}-${Date.now()}@test.local`
  const user = await auth.register(email, 'Trainer#12345', 'مدرب الأجر')
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-FEE-${Date.now()}-${n}`, fullName: 'مدرب الأجر', email,
      status: 'conditionally_approved', motivation: 'اختبار', privacyConsentAt: new Date(), userId: user.userId,
    },
  })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: application.id, userId: user.userId, isVerified: true } })
  await prisma.trainerCourseQualification.create({ data: { profileId: profile.id, courseId: COURSE, status: 'qualified' } })
  const r = await new EarningsService(prisma).setRule(adminId, { profileId: profile.id, ...rule })
  return { applicationId: application.id, profileId: profile.id, ruleId: r.id }
}

const compose = (applicationId: string, compensation?: { type: string; rate: number; minSeats?: number; referralRate?: number | null }) =>
  review.composeContract(applicationId, adminId, {
    ...INPUT, orientationAt: new Date(Date.now() + 3 * DAY).toISOString(), ...(compensation ? { compensation } : {}),
  })

const rulesOf = (profileId: string) => prisma.trainerCompensationRule.findMany({ where: { profileId }, orderBy: { createdAt: 'asc' } })

describe('① تبديل النوع من العقد يرد', () => {
  it('⚠️ أجر ثابت لكل شعبة لا يكتب أجرا بالمقعد', async () => {
    const c = await candidate({ type: 'fixed_per_cohort', rate: 400, minSeats: 6 })
    await expect(compose(c.applicationId, { type: 'per_seat', rate: 400, minSeats: 6 }), 'كتب أجر الشعبة أجرا بالمقعد')
      .rejects.toMatchObject({ code: 'fee_type_changed' })
    const rules = await rulesOf(c.profileId)
    expect(rules.map((r) => [r.type, Number(r.rate), r.effectiveTo])).toEqual([['fixed_per_cohort', 400, null]])
    expect(await prisma.trainerContract.count({ where: { profileId: c.profileId } }), 'ركب العقد مع الرد').toBe(0)
  })
})

describe('② والأرقام نفسها لا تكتب قاعدة ثانية', () => {
  it('⚠️ أجر الشعبة كما هو: لا قاعدة جديدة، والعقد يحمل القاعدة السارية', async () => {
    const c = await candidate({ type: 'fixed_per_cohort', rate: 400, minSeats: 6 })
    const made = await compose(c.applicationId, { type: 'fixed_per_cohort', rate: 400, minSeats: 6, referralRate: null })
    expect((await rulesOf(c.profileId)).length, 'قاعدة ثانية بالأرقام نفسها').toBe(1)
    expect(made.compensationRuleId).toBe(c.ruleId)
    expect(made.compensationType).toBe('fixed_per_cohort')
  })
  it('⚠️ وبالمقعد كما هو: لا قاعدة جديدة', async () => {
    const c = await candidate({ type: 'per_seat', rate: 25, minSeats: 8, referralRate: 40 })
    await compose(c.applicationId, { type: 'per_seat', rate: 25, minSeats: 8, referralRate: 40 })
    expect((await rulesOf(c.profileId)).length).toBe(1)
  })
})

describe('③ وما تغير رقمه يكتب بنوعه', () => {
  it('أجر الشعبة الجديد قاعدة أجر شعبة', async () => {
    const c = await candidate({ type: 'fixed_per_cohort', rate: 400, minSeats: 6 })
    const made = await compose(c.applicationId, { type: 'fixed_per_cohort', rate: 450, minSeats: 6 })
    const rules = await rulesOf(c.profileId)
    expect(rules.length).toBe(2)
    expect([rules[1].type, Number(rules[1].rate)]).toEqual(['fixed_per_cohort', 450])
    expect(made.compensationRuleId).toBe(rules[1].id)
  })
})
