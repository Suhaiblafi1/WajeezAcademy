/* آخرُ دوراته يفعّله من أيّ باب اعتُمد — و«ينتظرك» يعرف من اعتُمدت دوراتُه ولم يُفعَّل (١٧ أكتوبر ٢٠٢٦).

   سأل صاحبُ المنصّة عن مدرّبٍ دوراتُه الثلاثُ «معتمدة» وعقدُه يقول «لم يستوف الشروط بعد — انقضت
   مهلته»، ولا يظهر في «ينتظرك». والعلّةُ أنّ التفعيلَ — وبه نوقّع العقدَ ويتحقّق شرطُه — كان على
   مسلك اعتماد الخطّة وحدَه. وما يُقاس هنا على صفوف القاعدة:

   ① التأهيلُ المباشرُ لآخر دوراته («التأهيل والإسناد») يفعّله ويختم عقدَه — وما دام له معلّقٌ لا.
   ② ومن اعتُمدت دوراتُه كلُّها ولم يُفعَّل (عقدٌ عالقٌ من قبل هذا اليوم): القائمةُ تقول `coursesReady`
      — وما دام له معلّقٌ، أو فُعِّل، لا تقوله.
   ③ وللإدارة كيف اعتُمدت كلُّ دورة: تأهيلٌ مباشرٌ بلا شعبة، أو خطّةُ شعبةٍ اعتُمدت — ومن أهّله. */

import { beforeAll, describe, expect as vexpect, it } from 'vitest'
import { plainExpect } from '../helpers/plain-expect'
const expect = plainExpect(vexpect)
import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { TrainerPrepService } from '../../services/trainer-prep.service'
import { TrainerMaterialsService } from '../../services/trainer-materials.service'
import { CohortPlanService } from '../../services/cohort-plan.service'
import { contractAcks, CONDITION_CLAUSE_MARK } from '../../../src/application/trainer/contract-body'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let prep: TrainerPrepService
let plans: CohortPlanService
let adminId = ''

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const BODY = `نصُّ اتفاقيّةٍ للاختبار — البند 1 وما بعده.
${CONDITION_CLAUSE_MARK} لا عقد نهائي. ونفاذه معلق على قبول الأكاديمية لمواد المدرب.`
const C1 = 'C-QACT-101'
const C2 = 'C-QACT-202'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  prep = new TrainerPrepService(prisma)
  plans = new CohortPlanService(prisma)
  const admin = await auth.register('qact-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
  for (const [id, t] of [[C1, 'دورةُ التفعيل'], [C2, 'دورةٌ ثانيةٌ للتفعيل']] as const) {
    await prisma.course.create({ data: { id, status: 'published', currentVersion: 1 } })
    await prisma.courseVersion.create({ data: { courseId: id, version: 1, titleAr: t, totalHours: 10 } })
    await prisma.courseModule.create({ data: { id: `${id}-M1`, courseId: id } })
    await prisma.courseModuleVersion.create({
      data: { moduleId: `${id}-M1`, version: 1, sequence: 1, hours: 2, titleAr: 'محورُ الكتالوج', outcomeAr: 'مخرجُه' },
    })
  }
}, 240_000)

let seq = 0

/** مدرّبٌ في طور الموادّ: وقّع واعتُمد توقيعُه، ودوراتُه معلَّقة */
async function onboarding(courses: string[]) {
  seq += 1
  const email = `qact-${seq}-${Date.now()}@test.local`
  const user = await auth.register(email, 'Trainer#12345', `مرشّحٌ ${seq}`)
  await auth.setRoles(user.userId, ['trainer_applicant'])
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-QACT-${Date.now()}-${seq}`, fullName: `مرشّحٌ ${seq}`, email,
      status: 'conditionally_approved', motivation: 'اختبار', privacyConsentAt: new Date(), userId: user.userId,
    },
  })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: application.id, isVerified: true } })
  for (const courseId of courses) {
    await prisma.trainerCourseQualification.create({ data: { profileId: profile.id, courseId, status: 'pending' } })
  }
  await prisma.trainerCompensationRule.create({
    data: { profileId: profile.id, type: 'per_seat', rate: 25, currency: 'USD', minSeats: 0 },
  })
  const contract = await prisma.trainerContract.create({
    data: {
      profileId: profile.id, title: `عقدُ ${seq}`, status: 'draft',
      bodyVersion: 'v-test', bodyAr: BODY, bodyHash: sha256(BODY),
      requiredDocuments: [], signerEmail: email, gatesActivation: true,
    },
  })
  const sent = await review.sendContract(contract.id, adminId)
  await review.signContractByToken(decodeURIComponent(sent.signingUrl.split('/c/')[1]), {
    legalName: 'الاسمُ القانونيُّ الكامل', addressAr: 'عمّان — بناية ١٢',
    phone: '+962790000000', bodyHash: sha256(BODY), acks: contractAcks(true).map((a) => a.key),
  })
  await review.approveSignature(contract.id, adminId)
  return { applicationId: application.id, profileId: profile.id, contractId: contract.id, userId: user.userId }
}

const statusOf = async (applicationId: string) =>
  (await prisma.trainerApplication.findUniqueOrThrow({ where: { id: applicationId } })).status
const readyOf = async (contractId: string) =>
  (await review.listContracts()).contracts.find((c) => c.id === contractId)?.coursesReady

describe('① التأهيلُ المباشرُ لآخر دوراته يفعّله', () => {
  it('ما دام له معلّقٌ لا يُفعَّل — وآخرُها يفعّله ويختم عقدَه', async () => {
    const t = await onboarding([C1, C2])
    expect(await statusOf(t.applicationId)).toBe('onboarding')

    await review.qualifyForCourse(t.profileId, C1, adminId, 'من التأهيل والإسناد')
    expect(await statusOf(t.applicationId), 'فُعِّل ودورتُه الثانيةُ معلّقة').toBe('onboarding')

    await review.qualifyForCourse(t.profileId, C2, adminId, 'من التأهيل والإسناد')
    expect(await statusOf(t.applicationId), 'اعتُمدت دوراتُه كلُّها ولم يُفعَّل').toBe('active')
    const contract = await prisma.trainerContract.findUniqueOrThrow({ where: { id: t.contractId } })
    expect(contract.status, 'فُعِّل ولم نوقّع عقدَه').toBe('countersigned')
    expect(contract.conditionMetAt, 'فُعِّل وشرطُه مفتوح').not.toBeNull()
  })

  it('ومسلكُ الخطّة يفعّله مرّةً واحدة — بعد خبر الاعتماد لا قبله', async () => {
    const t = await onboarding([C1])
    const cohort = await prep.accept(t.userId, C1)
    const plan = await prisma.cohortDeliveryPlan.create({
      data: { cohortId: cohort.id, trainerId: t.profileId, status: 'submitted', submittedAt: new Date(), content: { kind: 'trainer', modules: [], resources: [] } },
    })
    const r = await plans.decide(adminId, plan.id, true)
    expect(r, 'التفعيلُ وقع في التأهيل قبل خبر الاعتماد فقال مسلكُ الخطّة إنّه لم يفعّل')
      .toMatchObject({ status: 'approved', prep: { activated: true } })
    expect(await statusOf(t.applicationId)).toBe('active')
    /* والتفعيلُ مرّةٌ واحدة: الانتقالُ إلى الحالة نفسِها يُقبل، فتفعيلٌ ثانٍ يُعيد الخَتمَ وبريدَه */
    const activations = await prisma.auditEvent.count({
      where: { action: 'trainer.prep.auto_activate', entityType: 'trainer_profile', entityId: t.profileId },
    })
    expect(activations, 'فُعِّل مرّتين: في التأهيل وبعد خبر الاعتماد').toBe(1)
  })
})

describe('② «اعتُمدت دوراتُه كلُّها ولم يُفعَّل» — في قائمة العقود', () => {
  it('عقدٌ عالق: دوراتُه معتمَدةٌ وحالُه في التهيئة — `coursesReady`', async () => {
    const t = await onboarding([C1, C2])
    /* كما وقع قبل هذا اليوم: تأهيلٌ كُتب بغير بابٍ يفعّل */
    await prisma.trainerCourseQualification.updateMany({ where: { profileId: t.profileId, courseId: C1 }, data: { status: 'qualified' } })
    expect(await readyOf(t.contractId), 'له دورةٌ معلّقة وقيل إنّ دوراته اكتملت').toBe(false)

    await prisma.trainerCourseQualification.updateMany({ where: { profileId: t.profileId }, data: { status: 'qualified' } })
    expect(await statusOf(t.applicationId)).toBe('onboarding')
    expect(await readyOf(t.contractId), 'دوراتُه كلُّها معتمَدة ولم يقل الخادمُ ذلك').toBe(true)

    /* والتفعيلُ من الشاشة يختم العقدَ — فلا يبقى «جاهزا» */
    await review.decide(t.applicationId, adminId, 'activate', 'اعتمدت دوراته كلها — فعّل من شاشة العقود')
    const contract = await prisma.trainerContract.findUniqueOrThrow({ where: { id: t.contractId } })
    expect(contract.conditionMetAt).not.toBeNull()
    expect(await readyOf(t.contractId), 'فُعِّل وبقي «جاهزا»').toBe(false)
  })

  it('ومن لا دورةَ معتمَدةً له لا يُقال إنّ دوراته اكتملت', async () => {
    const t = await onboarding([C1])
    await prisma.trainerCourseQualification.updateMany({ where: { profileId: t.profileId }, data: { status: 'retired' } })
    expect(await readyOf(t.contractId)).toBe(false)
  })
})

describe('③ كيف اعتُمدت كلُّ دورة — للإدارة', () => {
  it('تأهيلٌ مباشرٌ بلا شعبة، أو خطّةُ شعبةٍ اعتُمدت — ومن أهّله', async () => {
    const t = await onboarding([C1, C2])
    const cohort = await prep.accept(t.userId, C1)
    const plan = await prisma.cohortDeliveryPlan.create({
      data: { cohortId: cohort.id, trainerId: t.profileId, status: 'submitted', submittedAt: new Date(), content: { kind: 'trainer', modules: [], resources: [] } },
    })
    await plans.decide(adminId, plan.id, true)
    await review.qualifyForCourse(t.profileId, C2, adminId, 'من التأهيل والإسناد')

    const how = await new TrainerMaterialsService(prisma).approvalsOf(t.profileId)
    expect(how[C1], 'اعتُمدت خطّةُ شعبتها ولم تُذكر شعبتُها').toMatchObject({ cohortId: cohort.id, byAr: 'المدير الأكاديمي' })
    expect(how[C2], 'أُهِّل لها مباشرة وقيل إنّ لها شعبة').toMatchObject({ cohortId: null, byAr: 'المدير الأكاديمي' })
    expect(how[C2].at, 'لا يقال متى').not.toBeNull()
  })
})
