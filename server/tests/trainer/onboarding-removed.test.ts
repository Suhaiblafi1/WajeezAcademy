/* «تهيئة» أُلغيت — اعتمادُ التوقيع يفعّله (٢١ أكتوبر ٢٠٢٦).

   بلاغُ مدرّبتين لا تريان في «دوراتي» شيئا، و«دوراتي» تقول لهما «حسابك التدريبي موقوف»: اعتُمد توقيعُهما فصارتا
   «تهيئة»، ثمّ ضُغط عليهما «اقبله داخليّا» فرجعتا وأُغلقت بوّابتُهما. فقال صاحبُ المنصّة: «الغِ تهيئة كليا لملفات
   المدربين.. لا داعي لما هو يحدث تلقائي.. بدون أي مخاطرة على الحسابات الفعالة»، واختار «B»: تبقى المهلةُ وتذكيرُها.
   وما يُقاس هنا على صفوف القاعدة:

   ① اعتمادُ التوقيع — وله حسابٌ وأجر — يجعله نشطا، ولا يوقّع عنّا ولا ينشر اسمَه، والمهلةُ تجري، و«دوراتي» تُفتح.
   ② وبلا أجرٍ مضبوطٍ يبقى في «تهيئة» وبوّابتُه مفتوحة — والعاملُ يفعّله حين يُضبط.
   ③ والعاملُ يلحق من سبق: من في «تهيئة» ومن رُدّ عنها. ولا يمسّ من أُرسل إليه عقدٌ بعده، ولا الموقوفَ، ولا من لم
      يُعتمَد توقيعُه، ولا النشطَ.
   ④ وأوّلُ خطّةِ شعبةٍ تُعتمَد له توقّع عقدَه ويتحقّق بها شرطُه — كما كانت تفعل حين تخرجه من «تهيئة».
   ⑤ ومهلتُه ما دام شرطُه لم يتحقّق: يُبلَغ بانقضائها وهو نشط («B»). */

import { beforeAll, describe, expect as vexpect, it } from 'vitest'
import { plainExpect } from '../helpers/plain-expect'
const expect = plainExpect(vexpect)
import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { TrainerPrepService } from '../../services/trainer-prep.service'
import { CohortPlanService } from '../../services/cohort-plan.service'
import { contractAcks, CONDITION_CLAUSE_MARK } from '../../../src/application/trainer/contract-body'
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
const COURSE = 'C-NOONB-1'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  prep = new TrainerPrepService(prisma)
  plans = new CohortPlanService(prisma)
  const admin = await auth.register('noonb-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
  await prisma.course.create({ data: { id: COURSE, status: 'published', currentVersion: 1 } })
  await prisma.courseVersion.create({ data: { courseId: COURSE, version: 1, titleAr: 'دورة بلا تهيئة', totalHours: 10 } })
}, 240_000)

let seq = 0

const fees = (profileId: string) => prisma.trainerCompensationRule.create({
  data: { profileId, type: 'per_seat', rate: 25, currency: 'USD', minSeats: 0 },
})

/** عقدٌ مشروطٌ يُرسَل إليه — ويوقّعه إن طُلب */
async function contractFor(profileId: string, email: string, sign: boolean) {
  const contract = await prisma.trainerContract.create({
    data: {
      profileId, title: `عقدُ ${seq}`, status: 'draft',
      bodyVersion: 'v-test', bodyAr: BODY, bodyHash: sha256(BODY),
      requiredDocuments: [], signerEmail: email, gatesActivation: true,
    },
  })
  const sent = await review.sendContract(contract.id, adminId)
  if (sign) {
    await review.signContractByToken(decodeURIComponent(sent.signingUrl.split('/c/')[1]), {
      legalName: 'الاسمُ القانونيُّ الكامل', addressAr: 'عمّان — بناية ١٢',
      phone: '+962790000000', bodyHash: sha256(BODY), acks: contractAcks(true).map((a) => a.key),
    })
  }
  return contract.id
}

/** مدرّبٌ قُبل داخليّا ووقّع عرضَه المشروط — ولا يُعتمَد توقيعُه هنا */
async function signed(opts: { fees: boolean }) {
  seq += 1
  const email = `noonb-${seq}-${Date.now()}@test.local`
  const user = await auth.register(email, 'Trainer#12345', `مرشّحٌ ${seq}`)
  await auth.setRoles(user.userId, ['trainer_applicant'])
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-NOONB-${Date.now()}-${seq}`, fullName: `مرشّحٌ ${seq}`, email,
      status: 'conditionally_approved', motivation: 'اختبار', privacyConsentAt: new Date(), userId: user.userId,
    },
  })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: application.id, isVerified: true } })
  await prisma.trainerCourseQualification.create({ data: { profileId: profile.id, courseId: COURSE, status: 'pending' } })
  if (opts.fees) await fees(profile.id)
  const contractId = await contractFor(profile.id, email, true)
  return { applicationId: application.id, profileId: profile.id, userId: user.userId, email, contractId }
}

const statusOf = async (applicationId: string) =>
  (await prisma.trainerApplication.findUniqueOrThrow({ where: { id: applicationId } })).status

describe('«تهيئة» أُلغيت — اعتماد التوقيع يفعّله', () => {
  it('⚠️ ① له حساب وأجر: يصير نشطا، ولا يوقّع عنّا ولا ينشر اسمه، والمهلة تجري، و«دوراتي» تفتح', async () => {
    const t = await signed({ fees: true })
    await review.approveSignature(t.contractId, adminId)
    expect(await statusOf(t.applicationId)).toBe('active')
    const c = await prisma.trainerContract.findUniqueOrThrow({ where: { id: t.contractId } })
    expect(c.status, 'وقّعنا العرض باعتماد توقيعه').toBe('signature_approved')
    expect(c.conditionMetAt).toBeNull()
    expect(c.conditionDeadlineAt, 'ذهبت المهلة مع «تهيئة» — واختير «B»').not.toBeNull()
    const p = await prisma.trainerProfile.findUniqueOrThrow({ where: { id: t.profileId } })
    expect(p.publishApprovedAt, 'نُشر اسمه بلا شعبة معتمدة').toBeNull()
    const mine = await prep.mine(t.userId)
    expect(mine.map((r) => r.courseId)).toContain(COURSE)
  })

  it('⚠️ ② بلا أجر مضبوط يبقى في «تهيئة» وبوابته مفتوحة — والعامل يفعّله حين يضبط', async () => {
    const t = await signed({ fees: false })
    await review.approveSignature(t.contractId, adminId)
    expect(await statusOf(t.applicationId)).toBe('onboarding')
    await expect(prep.mine(t.userId)).resolves.toBeDefined()

    expect((await prep.activateSignatureApproved()).activated).not.toContain(t.profileId)
    await fees(t.profileId)
    expect((await prep.activateSignatureApproved()).activated).toContain(t.profileId)
    expect(await statusOf(t.applicationId)).toBe('active')
  })

  it('⚠️ ③ والعامل يلحق من رُدّ عن «تهيئة» — ولا يمسّ من أُرسل إليه عقد بعده، ولا الموقوف، ولا من لم يُعتمد توقيعه، ولا النشط', async () => {
    /* ما وقع لدانية ولين: اعتُمد توقيعهما، ثمّ ضُغط «اقبله داخليّا» */
    const sentBack = await signed({ fees: false })
    await review.approveSignature(sentBack.contractId, adminId)
    await fees(sentBack.profileId)
    await review.decide(sentBack.applicationId, adminId, 'conditionally_approve')
    expect(await statusOf(sentBack.applicationId)).toBe('conditionally_approved')
    await expect(prep.mine(sentBack.userId)).rejects.toThrow(/موقوف/)

    const renewed = await signed({ fees: true })
    await review.approveSignature(renewed.contractId, adminId)
    await prisma.trainerApplication.update({ where: { id: renewed.applicationId }, data: { status: 'conditionally_approved' } })
    await contractFor(renewed.profileId, renewed.email, false)
    const renewedStatus = await statusOf(renewed.applicationId)

    const suspended = await signed({ fees: true })
    await review.approveSignature(suspended.contractId, adminId)
    await prisma.trainerApplication.update({ where: { id: suspended.applicationId }, data: { status: 'conditionally_approved' } })
    await prisma.trainerProfile.update({ where: { id: suspended.profileId }, data: { suspendedAt: new Date() } })

    const unapproved = await signed({ fees: true })
    const unapprovedStatus = await statusOf(unapproved.applicationId)

    const active = await signed({ fees: true })
    await review.approveSignature(active.contractId, adminId)
    const historyBefore = await prisma.trainerStatusHistory.count({ where: { applicationId: active.applicationId } })

    const r = await runJob(prisma, 'publish_live_trainers')
    expect(r.summaryAr).toMatch(/فعّل \d+ مدرب توقيعه معتمد/)
    expect(await statusOf(sentBack.applicationId)).toBe('active')
    const last = await prisma.trainerStatusHistory.findFirstOrThrow({
      where: { applicationId: sentBack.applicationId }, orderBy: { createdAt: 'desc' },
    })
    expect(last.note, 'لا يقول سجل حالته لم صار نشطا').toMatch(/ألغيت التهيئة/)
    await expect(prep.mine(sentBack.userId)).resolves.toBeDefined()

    expect(await statusOf(renewed.applicationId), 'مُسّ من أُرسل إليه عقد بعده').toBe(renewedStatus)
    expect(await statusOf(suspended.applicationId), 'مُسّ الموقوف').toBe('conditionally_approved')
    expect(await statusOf(unapproved.applicationId), 'مُسّ من لم يُعتمد توقيعه').toBe(unapprovedStatus)
    expect(await statusOf(active.applicationId)).toBe('active')
    expect(await prisma.trainerStatusHistory.count({ where: { applicationId: active.applicationId } }), 'مُسّ النشط')
      .toBe(historyBefore)
  })

  it('⚠️ ④ أوّل خطة شعبة تُعتمد له توقّع عقده ويتحقّق بها شرطه', async () => {
    const t = await signed({ fees: true })
    await review.approveSignature(t.contractId, adminId)
    const cohort = await prep.accept(t.userId, COURSE)
    const plan = await prisma.cohortDeliveryPlan.create({
      data: { cohortId: cohort.id, trainerId: t.profileId, status: 'submitted', submittedAt: new Date(), content: { kind: 'trainer', modules: [], resources: [] } },
    })
    const r = await plans.decide(adminId, plan.id, true)
    expect(r, 'اعتُمدت أوّل شعبة ولم يُوقّع عقده').toMatchObject({ sealed: { sealed: true } })
    const c = await prisma.trainerContract.findUniqueOrThrow({ where: { id: t.contractId } })
    expect(c.status).toBe('countersigned')
    expect(c.conditionMetAt, 'وُقّع ولم يتحقّق شرطه').not.toBeNull()
    expect(c.countersignedBy).toBe(adminId)

    /* ومرّة واحدة: الثانية لا توقّع ثانية */
    const again = await prep.sealIfDue(t.profileId, adminId)
    expect(again?.sealed ?? false).toBe(false)
  })

  it('⑤ ومهلته وهو نشط: يُبلَغ بانقضائها ما دام شرطه لم يتحقّق', async () => {
    const t = await signed({ fees: true })
    await review.approveSignature(t.contractId, adminId)
    const c = await prisma.trainerContract.findUniqueOrThrow({ where: { id: t.contractId } })
    await review.noticeLapsedConditions(new Date(c.conditionDeadlineAt!.getTime() + 86_400_000))
    const lapsed = await prisma.auditEvent.count({ where: { action: 'trainer.condition.lapsed', entityId: t.contractId } })
    expect(lapsed, 'لم يُبلَغ النشط بانقضاء مهلته').toBe(1)
  })
})
