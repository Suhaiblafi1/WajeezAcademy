/* ═══ آخرُ المسار — من «أرسِلها» إلى «مفتوحة للتسجيل» (٣ أكتوبر ٢٠٢٦) ═══

   سار صاحبُ المنصّة في مسار اعتماد الخطط من أوّله إلى آخره، واختار من مقترحاته
   ستّة («1, 2, 3a, 4a, 5a, 6»). وهذا ما يقوم منها على الخادم ويُحرَس هنا:

   ① نصوصُ التسجيل تقول حالَ الشعبة: شعبةُ الإعداد مسوّدةٌ علمُها منزول —
      لا «شعبتك جاهزة بمن التحق فيها» ولا «يُفتح باعتمادك».
   ② «التالي» في بطاقة «شعبي» يتبع حالَ الخطّة: أُرسلت ← انتظار، رُدّت ←
      الملاحظة، اعتُمدت والشعبةُ مغلقة ← تفتحها الأكاديمية، مفتوحة ← لا شيء.
   ③ ما بقي بعد الاعتماد الأخير: شعبُه المعتمَدةُ المغلقة ونواقصُ فتحها،
      وظهورُه العامّ.
   ⑤ خبرٌ واحدٌ لكلّ قرار، وخبرٌ للتفعيل: الردُّ لا يكتب «أُعيدت موادُّك»
      بجانب «طُلبت تعديلات» — ويقول موعدَ المهلة؛ والاعتمادُ لا يكتب
      «أُهِّلتَ» بجانب «اعتُمدت» — ويقول التأهيل؛ والتفعيلُ يكتب جرسَه.

   وكلٌّ رُئي ساقطا بنقض ما يحرسه — والنقوضُ في رسالة الالتزام. */
import { beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { TrainerPrepService } from '../../services/trainer-prep.service'
import { CohortPlanService } from '../../services/cohort-plan.service'
import { contractAcks, CONDITION_CLAUSE_MARK } from '../../../src/application/trainer/contract-body'
import { OPEN_GAP, tabForGap } from '../../../src/application/learning/open-gaps'
import { adminRegistrationLine, lineText } from '../../../src/application/learning/registration-state'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let prep: TrainerPrepService
let plans: CohortPlanService
let adminId = ''

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const BODY = `نصُّ اتفاقيّةٍ للاختبار — البند 1 وما بعده.
${CONDITION_CLAUSE_MARK} لا عقد نهائي. ونفاذه معلق على قبول الأكاديمية لمواد المدرب.`
const C1 = 'C-LASTM-101'
const C2 = 'C-LASTM-202'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  prep = new TrainerPrepService(prisma)
  plans = new CohortPlanService(prisma)
  const admin = await auth.register('lastm-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
  for (const [id, t] of [[C1, 'دورةُ آخرِ المسار'], [C2, 'دورةٌ ثانيةٌ لآخر المسار']] as const) {
    await prisma.course.create({ data: { id, status: 'published', currentVersion: 1 } })
    await prisma.courseVersion.create({ data: { courseId: id, version: 1, titleAr: t, totalHours: 10 } })
    for (const n of [1, 2]) {
      await prisma.courseModule.create({ data: { id: `${id}-M${n}`, courseId: id, createdAt: new Date(Date.UTC(2026, 0, n)) } })
      await prisma.courseModuleVersion.create({
        data: { moduleId: `${id}-M${n}`, version: 1, sequence: n, hours: 2, titleAr: `محورُ الكتالوج ${n}`, outcomeAr: `مخرجُ الكتالوج ${n}` },
      })
    }
  }
}, 240_000)

let seq = 0

/** مدرّبٌ في طور الموادّ: وقّع واعتُمد توقيعُه، ودوراتُه معلَّقة */
async function onboarding(courses: string[] = [C1]) {
  seq += 1
  const email = `lastm-${seq}-${Date.now()}@test.local`
  const user = await auth.register(email, 'Trainer#12345', `مرشّحٌ ${seq}`)
  await auth.setRoles(user.userId, ['trainer_applicant'])
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-LASTM-${Date.now()}-${seq}`, fullName: `مرشّحٌ ${seq}`, email,
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

/** خطّةٌ مرسَلةٌ للاعتماد — اختصارُ ستِّ خطواتٍ لا تفحصها هذه الجولة */
async function submitted(cohortId: string, trainerId: string) {
  return prisma.cohortDeliveryPlan.create({
    data: { cohortId, trainerId, status: 'submitted', submittedAt: new Date(), content: { kind: 'trainer', modules: [], resources: [] } },
  })
}

/** ما وصل جرسَ المدرّب بعد لحظةٍ بعينها — بترتيب وصوله */
async function bellSince(userId: string, since: Date) {
  return prisma.notification.findMany({
    where: { userId, channel: 'in_app', queuedAt: { gte: since } },
    orderBy: { queuedAt: 'asc' },
    select: { templateKey: true, title: true, body: true, queuedAt: true },
  })
}

/** بطاقةُ هذه الشعبة في «شعبي» */
async function card(userId: string, cohortId: string) {
  return (await plans.summaries(userId)).find((c) => c.id === cohortId)!
}

describe('⑤ خبرٌ واحدٌ لكلّ قرار، وخبرٌ للتفعيل', () => {
  it('الردُّ خبرٌ واحد — ويقول أنّ المهلةَ عادت تعدّ ومتى تنتهي', async () => {
    const t = await onboarding()
    const made = await prep.accept(t.userId, C1)
    const plan = await submitted(made.id, t.profileId)
    await prep.afterSubmit(made.id)
    const since = new Date()
    await plans.decide(adminId, plan.id, false, 'المحورُ الثاني بلا مخرجٍ يُقاس')
    const bell = await bellSince(t.userId, since)
    expect(bell.map((n) => n.templateKey), 'وصله عن الردّ الواحد غيرُ خبرٍ واحد').toEqual(['cohort.plan.decision'])
    expect(bell[0]!.body).toContain('المحورُ الثاني بلا مخرجٍ يُقاس')
    expect(bell[0]!.body).toContain('وعادت مهلتُك تعدّ')
    /* والمهلةُ عادت فعلا — الخبرُ يقول ما وقع */
    expect((await prisma.trainerContract.findUniqueOrThrow({ where: { id: t.contractId } })).conditionPausedAt).toBeNull()
  })

  it('الاعتمادُ خبرٌ واحدٌ يقول التأهيل — والتفعيلُ خبرُه بعده', async () => {
    const t = await onboarding([C1, C2])
    const one = await prep.accept(t.userId, C1)
    const two = await prep.accept(t.userId, C2)

    const s1 = new Date()
    const r1 = await plans.decide(adminId, (await submitted(one.id, t.profileId)).id, true)
    expect(r1).toMatchObject({ status: 'approved', prep: { activated: false, waiting: 1 } })
    const b1 = await bellSince(t.userId, s1)
    expect(b1.map((n) => n.templateKey), 'وصله عن الاعتماد الواحد خبران').toEqual(['cohort.plan.decision'])
    expect(b1[0]!.body).toContain('صرتَ مؤهَّلا لتدريس «دورةُ آخرِ المسار»')
    /* ① والشعبةُ مسوّدةٌ علمُها منزول — لا «بمن التحق فيها» ولا «وصلت المسجَّلين» */
    expect(b1[0]!.body).toContain('لم تُفتح للتسجيل بعد')
    expect(b1[0]!.body).not.toMatch(/التحق|المسجَّلين/)
    expect((await prisma.trainerCourseQualification.findFirstOrThrow({ where: { profileId: t.profileId, courseId: C1 } })).status)
      .toBe('qualified')

    const p2 = await submitted(two.id, t.profileId)
    await prep.afterSubmit(two.id)
    const s2 = new Date()
    const r2 = await plans.decide(adminId, p2.id, true)
    expect(r2).toMatchObject({ status: 'approved', prep: { activated: true } })
    const b2 = await bellSince(t.userId, s2)
    expect(b2.map((n) => n.templateKey), 'التفعيلُ لا جرسَ له — أو الاعتمادُ خبران')
      .toEqual(['cohort.plan.decision', 'trainer.activated'])
    expect(b2[1]!.title).toBe('اعتُمدت موادُّك — وتمّ قبولُك')
    /* والخَتمُ كما وقع: وقّعناه الآن مع التفعيل */
    expect(b2[1]!.body).toContain('وقّعنا العقدَ من جهتنا')
  })
})

describe('① و② حالُ التسجيل و«التالي» على شعبة الإعداد', () => {
  it('من الإرسال إلى الفتح: كلُّ لحظةٍ تقول ما هي', async () => {
    const t = await onboarding()
    const made = await prep.accept(t.userId, C1)

    const plan = await submitted(made.id, t.profileId)
    expect((await card(t.userId, made.id)).next, 'أُرسلت والبطاقةُ تقول «أرسلها»')
      .toMatchObject({ key: 'awaiting_decision', waiting: true })

    /* ومراجعةُ الإدارة قبل الاعتماد: لا «يُفتح باعتمادك» عن مسوّدةٍ علمُها منزول */
    const before = await plans.latestForCohort(made.id)
    expect(before!.registration).toMatchObject({ awaitingPlan: true, registrationOpen: false })
    const said = lineText(adminRegistrationLine(before!.registration, new Date())!)
    expect(said).toContain('لا يفتحه اعتمادُك')
    expect(said).not.toContain('يُفتح باعتمادك')

    await plans.decide(adminId, plan.id, false, 'المحورُ الأوّل يحتاج مثالا')
    expect((await card(t.userId, made.id)).next, 'رُدّت والبطاقةُ لا تقول الملاحظة')
      .toMatchObject({ key: 'address_notes' })

    const again = await prisma.cohortDeliveryPlan.update({ where: { id: plan.id }, data: { status: 'submitted', submittedAt: new Date() } })
    await plans.decide(adminId, again.id, true)
    const approved = await card(t.userId, made.id)
    expect(approved.next, 'اعتُمدت والبطاقةُ تقول «في التشغيل» ولم تُفتح')
      .toMatchObject({ key: 'awaiting_open', waiting: true })
    const after = await plans.latestForCohort(made.id)
    expect(lineText(adminRegistrationLine(after!.registration, new Date())!)).toContain('لم تُفتح بعد')

    /* وحين يُرفع علمُها — لا شيءَ يُنتظَر */
    await prisma.cohort.update({ where: { id: made.id }, data: { registrationOpen: true } })
    expect((await card(t.userId, made.id)).next).toBeNull()
  })
})

describe('③ ما بقي بعد الاعتماد الأخير', () => {
  it('شعبُه المعتمَدةُ المغلقةُ بنواقصها، وسعةٌ تُملأ سلفا، وظهورُه — ثمّ تخرج ما فُتح', async () => {
    const t = await onboarding([C1, C2])
    const one = await prep.accept(t.userId, C1)
    const two = await prep.accept(t.userId, C2)
    await plans.decide(adminId, (await submitted(one.id, t.profileId)).id, true)
    const p2 = await submitted(two.id, t.profileId)
    await prep.afterSubmit(two.id)
    await plans.decide(adminId, p2.id, true)

    const steps = await plans.nextStepsAfterApproval(two.id)
    expect(steps!.trainer).toMatchObject({ profileId: t.profileId, active: true, publiclyVisible: false })
    expect(steps!.suggestedCapacity).toBe(20)
    expect(steps!.cohorts.map((c) => c.id).sort()).toEqual([one.id, two.id].sort())
    /* والسعةُ الناقصةُ بنصّ الشروط نفسِها — ولسانُها «التسجيل والمال» */
    for (const c of steps!.cohorts) {
      expect(c.missing).toContain(OPEN_GAP.capacity)
      expect(tabForGap(OPEN_GAP.capacity)).toBe('enrollment')
    }

    /* وما فُتح يخرج من اللوح — لا يُعرض قرارا قد وقع */
    await prisma.cohort.update({ where: { id: one.id }, data: { status: 'open', registrationOpen: true } })
    expect((await plans.nextStepsAfterApproval(two.id))!.cohorts.map((c) => c.id)).toEqual([two.id])
  })
})
