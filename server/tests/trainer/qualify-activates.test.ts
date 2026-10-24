/* آخرُ دوراته يفعّله من أيّ باب اعتُمد — و«ينتظرك» يعرف من اعتُمدت دوراتُه ولم يُفعَّل (١٧ أكتوبر ٢٠٢٦).

   سأل صاحبُ المنصّة عن مدرّبٍ دوراتُه الثلاثُ «معتمدة» وعقدُه يقول «لم يستوف الشروط بعد — انقضت
   مهلته»، ولا يظهر في «ينتظرك». والعلّةُ أنّ التفعيلَ — وبه نوقّع العقدَ ويتحقّق شرطُه — كان على
   مسلك اعتماد الخطّة وحدَه. وما يُقاس هنا على صفوف القاعدة:

   ① التأهيلُ المباشرُ لآخر دوراته («التأهيل والإسناد») يفعّله ويختم عقدَه — وما دام له معلّقٌ لا.
   ② ومن اعتُمدت دوراتُه كلُّها ولم يُفعَّل (عقدٌ عالقٌ من قبل هذا اليوم): القائمةُ تقول `coursesReady`
      — وما دام له معلّقٌ، أو فُعِّل، لا تقوله.
   ③ وللإدارة كيف اعتُمدت كلُّ دورة: تأهيلٌ مباشرٌ بلا شعبة، أو خطّةُ شعبةٍ اعتُمدت — ومن أهّله.
   ⑤ وعدّادُ الشعب بجانب اسمه في «العقود»: كم دورةً أعدّ شعبتَها كاملةً أو جزءا منها (١٨ أكتوبر).
   ⑥ والمؤجّلةُ لا تحبس تفعيلَه ولا توقيعَ عقده («Don't wait»، ١٨ أكتوبر).
   ⑧ وعقدُ النشط المعتمَدُ كالعقود الجديدة يوقَّع بأوّل دورةٍ تُعتمَد له بعد اعتماد توقيعه (٢٠ أكتوبر ٢٠٢٦،
      «Also sign active trainers' contracts at first course») — في ④ و⑥، والعاملُ يلحق ما فات.
   ⑦ ثمّ صارت دورةٌ معتمَدةٌ واحدةٌ تكفي لتفعيله (٢٠ أكتوبر ٢٠٢٦، «one cohort is enough for them to be
      active»): التأهيلُ والاعتمادُ وقائمةُ العقود يقولونها، والعاملُ يلحق من بقي في الطور وله معتمَدة،
      وما يمنع التفعيلَ يُقال للإدارة مرّةً في الأسبوع لا في كلّ محاولة.

   والقاعدةُ الأولى («آخرُ دوراته يفعّله») نُسخت في ①②⑥ بالثانية، وبقي ما يحرس الباقي منها.

   ⑨ ثمّ صارت «المعتمَدةُ» خطّةَ شعبةٍ اعتمدناها لا تأهيلا وحدَه (٢٠ أكتوبر ٢٠٢٦، «Approved cohort only»):
      رأى صاحبُ المنصّة «الشعب: 0 من 3» وبجانبه «اعتمدت له دورة — فعّله ووقّع العقد». فالتأهيلُ المباشرُ
      لا يفعّل ولا يوقّع ولا يُقال به «جاهز» — في ① و② و④ و⑦. */

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
import { postponeChoices } from '../../../src/application/trainer/plan-postpone'
import { runJob } from '../../worker/jobs'

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
  /* والأجرُ بعد اعتماد التوقيع: فيبقى في «تهيئة» — بابُها الباقي لمن لم يُضبط أجرُه حين اعتُمد توقيعُه.
     ومن ضُبط أجرُه قبله يصير نشطا بالاعتماد (٢١ أكتوبر ٢٠٢٦، `onboarding-removed.test.ts`) */
  await prisma.trainerCompensationRule.create({
    data: { profileId: profile.id, type: 'per_seat', rate: 25, currency: 'USD', minSeats: 0 },
  })
  return { applicationId: application.id, profileId: profile.id, contractId: contract.id, userId: user.userId }
}

/** خطّةُ شعبةٍ اعتمدناها له — وهي وحدَها ما يفعّله ويوقّع عقدَه (⑨) */
async function approvedPlan(profileId: string, courseId: string, by = adminId, at = new Date()) {
  const cohort = await prisma.cohort.create({ data: { courseId, title: `شعبةٌ معتمَدة ${Date.now()}` } })
  await prisma.cohortDeliveryPlan.create({
    data: {
      cohortId: cohort.id, trainerId: profileId, status: 'approved', reviewedBy: by, reviewedAt: at,
      content: { kind: 'trainer', modules: [], resources: [] },
    },
  })
  return cohort
}

const statusOf = async (applicationId: string) =>
  (await prisma.trainerApplication.findUniqueOrThrow({ where: { id: applicationId } })).status
const readyOf = async (contractId: string) =>
  (await review.listContracts()).contracts.find((c) => c.id === contractId)?.coursesReady

describe('① التأهيلُ المباشرُ لا يفعّله — وخطّةُ الشعبة تفعّله', () => {
  it('⚠️ التأهيلُ المباشرُ وحدَه لا يفعّله ولا يختم عقدَه (⑨)', async () => {
    const t = await onboarding([C1, C2])
    await review.qualifyForCourse(t.profileId, C1, adminId, 'من التأهيل والإسناد')
    expect(await statusOf(t.applicationId), 'فُعِّل بتأهيلٍ لم تُعتمَد له شعبة').toBe('onboarding')
    const contract = await prisma.trainerContract.findUniqueOrThrow({ where: { id: t.contractId } })
    expect(contract.status, 'وُقّع عقدُه بتأهيلٍ لم تُعتمَد له شعبة').toBe('signature_approved')
    expect(contract.conditionMetAt).toBeNull()
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

describe('② «اعتُمدت له دورةٌ ولم يُفعَّل» — في قائمة العقود', () => {
  it('⚠️ عقدٌ عالق: له خطّةُ شعبةٍ معتمَدةٌ وأخرى معلّقة وحالُه في التهيئة — `coursesReady`', async () => {
    const t = await onboarding([C1, C2])
    expect(await readyOf(t.contractId), 'لا معتمَدةَ له وقيل جاهز').toBe(false)
    /* والتأهيلُ وحدَه لا يقول «جاهز» (⑨) — وهي حالُ «الشعب: 0 من 3» */
    await prisma.trainerCourseQualification.updateMany({ where: { profileId: t.profileId, courseId: C1 }, data: { status: 'qualified' } })
    expect(await readyOf(t.contractId), 'أُهِّل بلا شعبةٍ معتمَدة وقيل جاهز').toBe(false)
    /* كما يبقى من منعه مانع: اعتُمدت خطّتُه ولم يُفعَّل */
    await approvedPlan(t.profileId, C1)
    expect(await statusOf(t.applicationId)).toBe('onboarding')
    expect(await readyOf(t.contractId), 'له خطّةٌ معتمَدة ولم يقل الخادمُ إنّه جاهز').toBe(true)

    /* والتفعيلُ من الشاشة يختم العقدَ — فلا يبقى «جاهزا»، ودورتُه الثانيةُ معلّقةٌ بعدُ */
    await review.decide(t.applicationId, adminId, 'activate', 'اعتمدت خطة شعبته — فعّل من شاشة العقود')
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

/* ═══ ④ والنشطُ عقدُه المعتمَدُ كالعقود الجديدة — يوقَّع تلقائيّا (١٧ أكتوبر ٢٠٢٦) ═══
   سأل صاحبُ المنصّة عن عقدِ مدرّبةٍ نشطة «اعتُمد توقيعُه كالعقود الجديدة — وقِّعْه حين تعتمد دوراتِه»،
   واختار «Sign automatically»: يوقَّع حين تُعتمَد آخرُ خطّةٍ بدأها، ويصله بريدُ ذلك. ثمّ (٢٠ أكتوبر ٢٠٢٦):
   «Also sign active trainers' contracts at first course» — بأوّل خطّةٍ تُعتمَد له **بعد** اعتماد توقيعه. */
describe('④ عقدُ النشط المعتمَدُ كالعقود الجديدة يوقَّع تلقائيّا', () => {
  /** نشطٌ دوراتُه معتمَدة، وعقدُه غيرُ مشروطٍ اعتُمد توقيعُه ولم نوقّعه */
  async function activePlain(courses: string[]) {
    const t = await onboarding(courses)
    await prisma.trainerCourseQualification.updateMany({ where: { profileId: t.profileId }, data: { status: 'qualified' } })
    await prisma.trainerApplication.update({ where: { id: t.applicationId }, data: { status: 'active' } })
    await prisma.trainerContract.update({ where: { id: t.contractId }, data: { gatesActivation: false, status: 'signature_approved' } })
    return t
  }
  const submit = (cohortId: string, trainerId: string) => prisma.cohortDeliveryPlan.create({
    data: { cohortId, trainerId, status: 'submitted', submittedAt: new Date(), content: { kind: 'trainer', modules: [], resources: [] } },
  })
  const contractOf = (id: string) => prisma.trainerContract.findUniqueOrThrow({ where: { id } })

  it('⚠️ أوّلُ خطّةٍ تُعتمَد له توقّعه — ولو بقيت أخرى تُعَدّ', async () => {
    const t = await activePlain([C1, C2])
    const one = await prep.accept(t.userId, C1)
    const two = await prep.accept(t.userId, C2)
    expect(await readyOf(t.contractId), 'لم تُعتمَد له خطّةٌ وقيل جاهز').toBe(false)

    const r1 = await plans.decide(adminId, (await submit(one.id, t.profileId)).id, true)
    expect(r1, 'اعتُمدت أوّلُ خطّةٍ ولم يُقل إنّه وُقّع').toMatchObject({ status: 'approved', sealed: { sealed: true } })
    const c = await contractOf(t.contractId)
    expect(c.status, 'اعتُمدت أوّلُ خطّةٍ ولم يوقَّع عقدُه').toBe('countersigned')
    expect(c.countersignedBy).toBe(adminId)
    expect(await prisma.auditEvent.count({ where: { action: 'trainer.prep.auto_seal', entityId: t.contractId } })).toBe(1)

    /* والثانيةُ لا توقّع ما وُقّع */
    const r2 = await plans.decide(adminId, (await submit(two.id, t.profileId)).id, true)
    expect(r2).toMatchObject({ status: 'approved', sealed: null })
    expect(await prisma.auditEvent.count({ where: { action: 'trainer.prep.auto_seal', entityId: t.contractId } })).toBe(1)
  })

  /* والنشطُ في يده معتمَداتٌ من قبل: لو عُدّ ما اعتُمد قبل اعتماد توقيعه لوُقّع كلُّ عقدٍ «كالعقود الجديدة»
     ساعةَ اعتماده — وهو ما اختار المعتمِدُ ألّا يقع */
  it('⚠️ وما اعتُمد له قبل اعتماد توقيعه لا يوقّعه', async () => {
    const t = await activePlain([C1, C2])
    const one = await prep.accept(t.userId, C1)
    await prep.accept(t.userId, C2)
    await prisma.cohortDeliveryPlan.create({
      data: {
        cohortId: one.id, trainerId: t.profileId, status: 'approved', reviewedBy: adminId,
        reviewedAt: new Date(Date.now() - 60_000), content: { kind: 'trainer', modules: [], resources: [] },
      },
    })
    await prisma.trainerContract.update({ where: { id: t.contractId }, data: { signatureApprovedAt: new Date() } })
    expect(await readyOf(t.contractId), 'عُدّ ما اعتُمد قبل اعتماد توقيعه').toBe(false)
    await prep.sealFirstCourseActive()
    expect((await contractOf(t.contractId)).status, 'وُقّع بما اعتُمد قبل اعتماد توقيعه').toBe('signature_approved')
  })

  it('⚠️ والعاملُ يلحق عقدا اعتُمدت له بعد اعتماد توقيعه خطّةٌ ولم يوقَّع — بفاعلِ من اعتمدها', async () => {
    const t = await activePlain([C1, C2])
    const one = await prep.accept(t.userId, C1)
    await prep.accept(t.userId, C2)
    /* كما بقي قبل هذا اليوم: اعتُمدت خطّتُه الأولى والثانيةُ تُعَدّ — واعتمدها غيرُ من اعتمد توقيعَه */
    const reviewer = (await auth.register(`qact-reviewer-${Date.now()}@test.local`, 'Admin#12345', 'مراجعُ الخطط')).userId
    await prisma.cohortDeliveryPlan.create({
      data: {
        cohortId: one.id, trainerId: t.profileId, status: 'approved', reviewedBy: reviewer,
        reviewedAt: new Date(), content: { kind: 'trainer', modules: [], resources: [] },
      },
    })
    expect(await readyOf(t.contractId), 'اعتُمدت له خطّةٌ ولم يقل الخادمُ إنّه جاهز').toBe(true)

    expect((await prep.sealFirstCourseActive()).sealed, 'لم يلحقه العامل').toContain(t.contractId)
    const c = await contractOf(t.contractId)
    expect(c.status).toBe('countersigned')
    expect(c.countersignedBy, 'وُقّع بغير من اعتمد خطّتَه').toBe(reviewer)
    expect((await prep.sealFirstCourseActive()).sealed, 'وُقّع مرّتين').not.toContain(t.contractId)
  })

  it('عقدٌ من قبل هذا اليوم ودوراتُه مكتملة: القائمةُ تقول `coursesReady` — إن كانت فيها خطّةٌ معتمَدة (⑨)', async () => {
    const t = await activePlain([C1])
    expect(await readyOf(t.contractId), 'أُهِّل بلا شعبةٍ معتمَدة وقيل جاهز').toBe(false)
    await approvedPlan(t.profileId, C1, adminId, new Date(Date.now() - 86_400_000))
    expect(await readyOf(t.contractId), 'لا شيءَ يُعَدّ ولم يقل الخادمُ إنّ دوراته اكتملت').toBe(true)
  })

  it('⚠️ والتأهيلُ المباشرُ لدورةٍ بعد اعتماد توقيعه لا يوقّعه (⑨)', async () => {
    const t = await activePlain([C1, C2])
    await prisma.trainerCourseQualification.updateMany({ where: { profileId: t.profileId, courseId: C2 }, data: { status: 'pending' } })
    await review.qualifyForCourse(t.profileId, C2, adminId, 'من التأهيل والإسناد')
    expect((await contractOf(t.contractId)).status, 'وُقّع عقدُه بتأهيلٍ لم تُعتمَد له شعبة').toBe('signature_approved')
    expect(await readyOf(t.contractId), 'أُهِّل بلا شعبةٍ معتمَدة وقيل جاهز').toBe(false)
  })
})

/* ═══ ⑤ عدّادُ الشعب بجانب اسمه (١٨ أكتوبر ٢٠٢٦) ═══
   سؤالُ صاحب المنصّة: «كم دورةً أعدّ شعبَها كلَّها أو جزءا منها؟ ألا يكون عدّادٌ جانبَ اسمه؟». */
describe('⑤ عدّادُ الشعب في قائمة العقود', () => {
  const tallyOf = async (contractId: string) =>
    (await review.listContracts()).contracts.find((c) => c.id === contractId)?.prepTally

  it('لم يبدأ ← جزئيّة ← تنتظرك ← معتمدة — وما اعتذر عنه خارجَ العدد', async () => {
    const t = await onboarding([C1, C2])
    expect(await tallyOf(t.contractId)).toMatchObject({ total: 2, notStarted: 2, partial: 0 })

    const cohort = await prep.accept(t.userId, C1)
    expect(await tallyOf(t.contractId), 'قامت شعبتُه ولم تُعدّ جزئيّة').toMatchObject({ total: 2, partial: 1, notStarted: 1 })

    const plan = await prisma.cohortDeliveryPlan.create({
      data: { cohortId: cohort.id, trainerId: t.profileId, status: 'submitted', submittedAt: new Date(), content: { kind: 'trainer', modules: [], resources: [] } },
    })
    expect(await tallyOf(t.contractId), 'أرسلها ولم تُعدّ كاملة').toMatchObject({ total: 2, submitted: 1, partial: 0 })

    await prep.decline(t.userId, C2, 'لا أدرّسها الآن')
    expect(await tallyOf(t.contractId), 'اعتذر عنها وبقيت من دوراته').toMatchObject({ total: 1, submitted: 1, declined: 1, notStarted: 0 })

    await plans.decide(adminId, plan.id, true)
    expect(await tallyOf(t.contractId), 'اعتُمدت خطّتُها فخرجت من العدد')
      .toMatchObject({ total: 1, approved: 1, submitted: 0, declined: 1 })
  })

  it('والمؤجّلةُ تُعدّ مؤجّلةً لا جزئيّة («لا تنسَ أنّهم أجّلوا بعضها»)', async () => {
    const t = await onboarding([C1, C2])
    const one = await prep.accept(t.userId, C1)
    await prep.accept(t.userId, C2)
    const plan = await prisma.cohortDeliveryPlan.create({
      data: { cohortId: one.id, trainerId: t.profileId, status: 'submitted', submittedAt: new Date(), content: { kind: 'trainer', modules: [], resources: [] } },
    })
    const [to] = postponeChoices(null, new Date().toISOString().slice(0, 10))
    /* وموسمُها بلا صفٍّ في جدول الفصول — فيُنشأ ولا تسقط الشعبةُ «بلا فصل» (`term-ensure.ts`) */
    await prisma.term.deleteMany({ where: { year: to.year, season: to.season, cohorts: { none: {} } } })
    await plans.postpone(adminId, plan.id, to)
    const term = await prisma.cohort.findUniqueOrThrow({ where: { id: one.id }, select: { term: { select: { year: true, season: true } } } })
    expect(term.term, 'أُجّلت وبقيت بلا فصل').toEqual({ year: to.year, season: to.season })
    expect(await tallyOf(t.contractId), 'أُجّلت وعُدّت جزئيّة').toMatchObject({ total: 2, postponed: 1, partial: 1 })
    const rows = await prep.coursesOf(t.profileId)
    expect(rows.find((r) => r.courseId === C1)?.postponedTo, 'لم يُقل إلى أيّ موسمٍ أُجّلت').toBeTruthy()
  })
})

/* ═══ ⑥ والمؤجّلةُ لا تحبس التفعيلَ ولا التوقيع (١٨ أكتوبر ٢٠٢٦) ═══
   «لا تنسَ أنّهم أجّلوا بعضها» — ثمّ «Don't wait»: يُفعَّل ويوقَّع حين تُعتمَد كلُّ دورةٍ لم تؤجَّل. */
describe('⑥ المؤجّلةُ لا تحبس التفعيلَ ولا التوقيع', () => {
  const submit = (cohortId: string, trainerId: string) => prisma.cohortDeliveryPlan.create({
    data: { cohortId, trainerId, status: 'submitted', submittedAt: new Date(), content: { kind: 'trainer', modules: [], resources: [] } },
  })
  const season = () => postponeChoices(null, new Date().toISOString().slice(0, 10))[0]

  /* وكان: «اعتُمدت الأولى وأُجّلت الأخيرة — يُفعَّل بالتأجيل». ومنذ ٢٠ أكتوبر تفعّله الأولى، والتأجيلُ بعدها لا يمسّه */
  it('اعتُمدت الأولى ففُعِّل — والتأجيلُ بعدها لا يمسّه', async () => {
    const t = await onboarding([C1, C2])
    const one = await prep.accept(t.userId, C1)
    const two = await prep.accept(t.userId, C2)
    const r1 = await plans.decide(adminId, (await submit(one.id, t.profileId)).id, true)
    expect(r1, 'اعتُمدت أوّلُ دوراته ولم يُفعَّل').toMatchObject({ prep: { activated: true } })
    expect(await statusOf(t.applicationId)).toBe('active')
    expect((await prisma.trainerContract.findUniqueOrThrow({ where: { id: t.contractId } })).conditionMetAt).not.toBeNull()

    const r = await plans.postpone(adminId, (await submit(two.id, t.profileId)).id, season())
    expect(r).toMatchObject({ status: 'postponed' })
    expect(r, 'نشطٌ ففُعِّل ثانية').not.toHaveProperty('prep')
    expect(await statusOf(t.applicationId)).toBe('active')
  })

  it('وأُجّلت أوّلا ثمّ اعتُمدت الباقية — يُفعَّل بالاعتماد', async () => {
    const t = await onboarding([C1, C2])
    const one = await prep.accept(t.userId, C1)
    const two = await prep.accept(t.userId, C2)
    await plans.postpone(adminId, (await submit(two.id, t.profileId)).id, season())
    expect(await statusOf(t.applicationId), 'فُعِّل والأولى لم تُعتمَد').toBe('onboarding')

    const r = await plans.decide(adminId, (await submit(one.id, t.profileId)).id, true)
    expect(r, 'اعتُمدت الباقيةُ ولم يُفعَّل').toMatchObject({ prep: { activated: true } })
    expect(await statusOf(t.applicationId)).toBe('active')
  })

  /* وكان: «يوقَّع حين تؤجَّل آخرُ ما يُعِدّه». ومنذ ٢٠ أكتوبر توقّعه أوّلُ خطّةٍ تُعتمَد، والتأجيلُ ليس اعتمادا */
  it('والنشطُ عقدُه كالعقود الجديدة لا يوقّعه التأجيل — وأوّلُ خطّةٍ تُعتمَد توقّعه', async () => {
    const t = await onboarding([C1, C2])
    await prisma.trainerCourseQualification.updateMany({ where: { profileId: t.profileId }, data: { status: 'qualified' } })
    await prisma.trainerApplication.update({ where: { id: t.applicationId }, data: { status: 'active' } })
    await prisma.trainerContract.update({ where: { id: t.contractId }, data: { gatesActivation: false, status: 'signature_approved' } })
    const one = await prep.accept(t.userId, C1)
    const two = await prep.accept(t.userId, C2)
    const r2 = await plans.postpone(adminId, (await submit(two.id, t.profileId)).id, season())
    expect(r2, 'وُقّع بالتأجيل والأولى تُعَدّ').toMatchObject({ sealed: { sealed: false } })

    const r1 = await plans.decide(adminId, (await submit(one.id, t.profileId)).id, true)
    expect(r1, 'اعتُمدت أوّلُ خطّةٍ ولم يوقَّع').toMatchObject({ sealed: { sealed: true } })
    expect((await prisma.trainerContract.findUniqueOrThrow({ where: { id: t.contractId } })).status).toBe('countersigned')
  })
})

/* ═══ ⑦ دورةٌ معتمَدةٌ واحدةٌ تكفي (٢٠ أكتوبر ٢٠٢٦) ═══
   «if any one has at least one approved cohort, then they are live.. one cohort is enough for them to be active».
   والعلّةُ في `TrainerPrepService.activateIfQualified` و`activateQualifiedOnboarding`. */
describe('⑦ دورةٌ معتمَدةٌ واحدةٌ تكفي لتفعيله', () => {
  const blockedBells = (since: Date) => prisma.notification.count({
    where: { userId: adminId, templateKey: 'trainer.prep.activation_blocked', queuedAt: { gte: since } },
  })

  it('⚠️ والعاملُ يلحق من بقي في الطور وله خطّةٌ معتمَدة — بفاعلِ من اعتمدها', async () => {
    const t = await onboarding([C1, C2])
    /* والتأهيلُ وحدَه لا يلحقه العامل (⑨) */
    await prisma.trainerCourseQualification.updateMany({
      where: { profileId: t.profileId, courseId: C1 }, data: { status: 'qualified', qualifiedBy: adminId },
    })
    expect((await prep.activateQualifiedOnboarding()).activated, 'فُعِّل بتأهيلٍ لم تُعتمَد له شعبة').not.toContain(t.profileId)
    expect(await statusOf(t.applicationId)).toBe('onboarding')
    /* كما بقي من منعه مانع: اعتُمدت له شعبةٌ وأخرى تُعَدّ */
    await approvedPlan(t.profileId, C1)

    const r = await prep.activateQualifiedOnboarding()
    expect(r.activated, 'له دورةٌ معتمَدةٌ وبقي في الطور').toContain(t.profileId)
    expect(await statusOf(t.applicationId)).toBe('active')
    const audit = await prisma.auditEvent.findFirst({ where: { action: 'trainer.prep.auto_activate', entityId: t.profileId } })
    expect(audit?.actorId, 'فُعِّل بلا فاعلٍ أو بغير من اعتمد دورتَه').toBe(adminId)

    const again = await prep.activateQualifiedOnboarding()
    expect(again.activated, 'فُعِّل مرّتين').not.toContain(t.profileId)
  })

  /* حالُ حفصة كما قيست في الإنتاج: في الطور، وشعبتُها مفتوحةٌ تُباع بلا اسمها، ودورتُها الثانيةُ تُعَدّ */
  it('⚠️ وفي دورة العامل نفسِها يُفعَّل ثمّ يُنشر اسمُه على شعبته المفتوحة', async () => {
    const t = await onboarding([C1, C2])
    const cohort = await prep.accept(t.userId, C1)
    await prisma.trainerCourseQualification.updateMany({
      where: { profileId: t.profileId, courseId: C1 }, data: { status: 'qualified', qualifiedBy: adminId },
    })
    await prisma.cohortDeliveryPlan.create({
      data: {
        cohortId: cohort.id, trainerId: t.profileId, status: 'approved', reviewedBy: adminId, reviewedAt: new Date(),
        content: { kind: 'trainer', modules: [], resources: [] },
      },
    })
    await prisma.cohort.update({ where: { id: cohort.id }, data: { status: 'open' } })

    await runJob(prisma, 'publish_live_trainers')
    expect(await statusOf(t.applicationId)).toBe('active')
    const p = await prisma.trainerProfile.findUniqueOrThrow({ where: { id: t.profileId } })
    expect(p.publishApprovedAt, 'فُعِّل ولم يُنشر اسمُه في الدورة نفسِها').not.toBeNull()
  })

  it('ولا يُفعَّل من لا معتمَدةَ له', async () => {
    const t = await onboarding([C1])
    await prep.activateQualifiedOnboarding()
    expect(await statusOf(t.applicationId)).toBe('onboarding')
  })

  it('⚠️ وما يمنع التفعيلَ يُقال مرّةً في الأسبوع — والمحاولةُ تُعاد فتفعّله حين يُصلَح', async () => {
    const t = await onboarding([C1, C2])
    /* بلا اتّفاقٍ ماليٍّ لا يُفعَّل (`readinessFor`) */
    await prisma.trainerCompensationRule.deleteMany({ where: { profileId: t.profileId } })
    const since = new Date()

    const one = await prep.accept(t.userId, C1)
    const plan = await prisma.cohortDeliveryPlan.create({
      data: { cohortId: one.id, trainerId: t.profileId, status: 'submitted', submittedAt: new Date(), content: { kind: 'trainer', modules: [], resources: [] } },
    })
    await plans.decide(adminId, plan.id, true)
    expect(await statusOf(t.applicationId)).toBe('onboarding')
    expect(await blockedBells(since), 'منعه مانعٌ ولم يُقل').toBe(1)

    const r = await prep.activateQualifiedOnboarding()
    expect(r.blocked, 'عُدّ ممنوعا وقد قيل').toBe(0)
    await prep.activateQualifiedOnboarding()
    expect(await blockedBells(since), 'قيل في كلّ محاولة').toBe(1)

    /* وأُصلح: المحاولةُ التاليةُ تفعّله */
    await prisma.trainerCompensationRule.create({
      data: { profileId: t.profileId, type: 'per_seat', rate: 25, currency: 'USD', minSeats: 0 },
    })
    const fixed = await prep.activateQualifiedOnboarding()
    expect(fixed.activated).toContain(t.profileId)
    expect(await statusOf(t.applicationId)).toBe('active')
  })
})
