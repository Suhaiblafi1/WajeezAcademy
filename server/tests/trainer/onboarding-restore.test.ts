/* من رُدّ عن التهيئة وتوقيعُه معتمَدٌ يعود إليها (٢١ أكتوبر ٢٠٢٦) — `restoreSentBackOnboarding`.

   بلاغُ صاحب المنصّة عن مدرّبةٍ لا ترى في «دوراتي» شيئا، و«دوراتي» تقول لها «حسابك التدريبي موقوف». وسجلُّ
   حالتها: اعتُمد توقيعُها فصارت «تهيئة»، ثمّ ضُغط عليها «اقبله داخليّا» فرجعت «قبولا داخليّا» وأُغلقت بوّابتُها.
   واختار «A for everyone has the same case». وما يُقاس هنا على صفوف القاعدة:

   ① من رُدّ كذلك يعود إلى «تهيئة» — ومعه في سجلّ حالته لمَ عاد — وتُفتح «دوراتي» له.
   ② ومن أُرسل إليه عقدٌ بعده لم يُوقَّع، أو أُوقف، أو لم يُعتمَد توقيعُه أصلا — لا يُمَسّ.
   ③ والعاملُ يعيده ويقولها في خلاصته. */

import { beforeAll, describe, expect as vexpect, it } from 'vitest'
import { plainExpect } from '../helpers/plain-expect'
const expect = plainExpect(vexpect)
import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { TrainerPrepService } from '../../services/trainer-prep.service'
import { contractAcks, CONDITION_CLAUSE_MARK } from '../../../src/application/trainer/contract-body'
import { runJob } from '../../worker/jobs'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let prep: TrainerPrepService
let adminId = ''

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const BODY = `نصُّ اتفاقيّةٍ للاختبار — البند 1 وما بعده.
${CONDITION_CLAUSE_MARK} لا عقد نهائي. ونفاذه معلق على قبول الأكاديمية لمواد المدرب.`
const COURSE = 'C-RESTORE-1'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  prep = new TrainerPrepService(prisma)
  const admin = await auth.register('restore-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
  await prisma.course.create({ data: { id: COURSE, status: 'published', currentVersion: 1 } })
  await prisma.courseVersion.create({ data: { courseId: COURSE, version: 1, titleAr: 'دورةُ الإعادة', totalHours: 10 } })
}, 240_000)

let seq = 0

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

/** مدرّبٌ قُبل داخليّا ووقّع — ويُعتمَد توقيعُه إن طُلب */
async function trainer(opts: { approve: boolean }) {
  seq += 1
  const email = `restore-${seq}-${Date.now()}@test.local`
  const user = await auth.register(email, 'Trainer#12345', `مرشّحٌ ${seq}`)
  await auth.setRoles(user.userId, ['trainer_applicant'])
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-RESTORE-${Date.now()}-${seq}`, fullName: `مرشّحٌ ${seq}`, email,
      status: 'conditionally_approved', motivation: 'اختبار', privacyConsentAt: new Date(), userId: user.userId,
    },
  })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: application.id, isVerified: true } })
  await prisma.trainerCourseQualification.create({ data: { profileId: profile.id, courseId: COURSE, status: 'qualified' } })
  await prisma.trainerCompensationRule.create({
    data: { profileId: profile.id, type: 'per_seat', rate: 25, currency: 'USD', minSeats: 0 },
  })
  const contractId = await contractFor(profile.id, email, true)
  if (opts.approve) await review.approveSignature(contractId, adminId)
  return { applicationId: application.id, profileId: profile.id, userId: user.userId, email }
}

/** ما وقع لها: اعتُمد توقيعُها فصارت «تهيئة»، ثمّ ضُغط «اقبله داخليّا» */
async function sentBack() {
  const t = await trainer({ approve: true })
  expect((await prisma.trainerApplication.findUniqueOrThrow({ where: { id: t.applicationId } })).status).toBe('onboarding')
  await review.decide(t.applicationId, adminId, 'conditionally_approve')
  expect((await prisma.trainerApplication.findUniqueOrThrow({ where: { id: t.applicationId } })).status).toBe('conditionally_approved')
  return t
}

const statusOf = async (applicationId: string) =>
  (await prisma.trainerApplication.findUniqueOrThrow({ where: { id: applicationId } })).status

describe('من رد عن التهيئة وتوقيعه معتمد يعود إليها', () => {
  it('⚠️ ① يعود إلى التهيئة، وسجل حالته يقول لم، وتفتح «دوراتي» له', async () => {
    const t = await sentBack()
    await expect(prep.mine(t.userId)).rejects.toThrow(/موقوف/)

    const restored = await prep.restoreSentBackOnboarding()
    expect(restored).toContain(t.profileId)
    expect(await statusOf(t.applicationId)).toBe('onboarding')
    const last = await prisma.trainerStatusHistory.findFirstOrThrow({
      where: { applicationId: t.applicationId }, orderBy: { createdAt: 'desc' },
    })
    expect(last.toStatus).toBe('onboarding')
    expect(last.note).toMatch(/توقيعه معتمد/)

    const mine = await prep.mine(t.userId)
    expect(mine.map((c) => c.courseId)).toContain(COURSE)

    /* ومرّةً ثانيةً لا شيء: عاد فلا يُعاد */
    expect(await prep.restoreSentBackOnboarding()).not.toContain(t.profileId)
  })

  it('⚠️ ② ومن أرسل إليه عقد بعده لم يوقع، أو أوقف، أو لم يعتمد توقيعه — لا يمس', async () => {
    const renewed = await sentBack()
    await contractFor(renewed.profileId, renewed.email, false)

    const suspended = await sentBack()
    await prisma.trainerProfile.update({ where: { id: suspended.profileId }, data: { suspendedAt: new Date() } })

    const unapproved = await trainer({ approve: false })

    const restored = await prep.restoreSentBackOnboarding()
    for (const t of [renewed, suspended, unapproved]) {
      expect(restored).not.toContain(t.profileId)
      expect(await statusOf(t.applicationId)).not.toBe('onboarding')
    }
  })

  it('③ والعامل يعيده ويقولها في خلاصته', async () => {
    const t = await sentBack()
    const r = await runJob(prisma, 'publish_live_trainers')
    expect(r.summaryAr).toMatch(/أعاد \d+ مدرب إلى التهيئة/)
    expect(await statusOf(t.applicationId)).toBe('onboarding')
  })
})
