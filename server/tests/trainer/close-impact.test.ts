/* أثرُ الإغلاق يُقرأ قبل النقرة — بقاعدةٍ حقيقيّة.
 *
 * ── البلاغُ الذي وُلد منه ──
 *
 * صاحبُ المنصّة (٢٦ سبتمبر ٢٠٢٦): «يجب أن يكون زرُّ إلغاء العقد فيرسل للمدرّب
 * أنّ العقد قد أُلغي ولماذا.. **والنظام يجب أن يحذّرني إذا كان للإلغاء أثر**».
 *
 * ── وأدقُّ ما يُقاس: أنّ الأرقامَ هي التي ستقع ──
 *
 * تحذيرٌ برقمٍ خاطئٍ أسوأُ من لا تحذير: من قرأ «شعبةٌ واحدةٌ» ونقر فوجد خمسا
 * لن يقرأ التحذيرَ بعدها أبدا. فتُقاس القراءةُ على المواضع الأربعة التي
 * يمسّها الرحيلُ فعلا، **وبضدّها معها**: شعبةٌ منتهيةٌ لا تُحسب، ومتعلّمٌ
 * منسحبٌ لا يُحسب، وعرضٌ أُجيب لا يُحسب، ومستحقٌّ صُرف لا يُحسب. فلو حسبت
 * القارئةُ كلَّ شيءٍ لَخضرّت على «حسبتُ شيئا» وهي تعدّ التاريخَ كلَّه.
 *
 * ── والعملةُ مع الرقم ──
 *
 * مجموعٌ واحدٌ لعملتَين رقمٌ لا معنى له: «١٢٥» لدولارٍ ودينارٍ ليست مبلغا في
 * الدنيا. فيُقاس أنّها تُجمَع بعملتها.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
const COURSE = 'C-IMPACT-101'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  await prisma.course.create({ data: { id: COURSE, status: 'published', currentVersion: 1 } })
  await prisma.courseVersion.create({
    data: { courseId: COURSE, version: 1, titleAr: 'أساسيّاتُ المحاسبة', totalHours: 10 },
  })
}, 240_000)

let seq = 0

/** مدرّبٌ بعقدٍ في الحالة المطلوبة، ولا شيءَ غيرُه بعد */
async function trainerWithContract(status: string) {
  seq += 1
  const email = `impact-${seq}-${Date.now()}@test.local`
  const user = await auth.register(email, 'Trainer#12345', `مدرّبٌ ${seq}`)
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-IMP-${Date.now()}-${seq}`, fullName: `مدرّبٌ ${seq}`, email,
      status: 'active', motivation: 'اختبار', privacyConsentAt: new Date(), userId: user.userId,
    },
  })
  const profile = await prisma.trainerProfile.create({
    data: { applicationId: application.id, isVerified: true },
  })
  const contract = await prisma.trainerContract.create({
    data: {
      profileId: profile.id, title: `عقدُ ${seq}`, status,
      ...(status === 'countersigned'
        ? { signedAt: new Date(), countersignedAt: new Date() }
        : {}),
    },
  })
  return { profileId: profile.id, contractId: contract.id, userId: user.userId }
}

/** شعبةٌ بحالةٍ بعينها، مُسنَدةٌ إلى هذا المدرّب */
async function cohortFor(profileId: string, status: string) {
  seq += 1
  const cohort = await prisma.cohort.create({
    data: { courseId: COURSE, title: `شعبةُ ${seq}`, status },
  })
  await prisma.cohortTrainer.create({ data: { cohortId: cohort.id, profileId } })
  return cohort.id
}

/** متعلّمٌ مسجَّلٌ بحالةٍ بعينها في شعبة */
async function learnerIn(cohortId: string, status: string) {
  seq += 1
  const u = await auth.register(`learner-${seq}-${Date.now()}@test.local`, 'Learn#12345', `متعلّمٌ ${seq}`)
  await prisma.enrollment.create({ data: { cohortId, userId: u.userId, status } })
}

describe('أثرُ الإغلاق يعدّ ما سيُمَسّ وحدَه', () => {
  it('الشعبُ الحيّةُ تُحسب والمنتهيةُ لا — ومعها متعلّموها', async () => {
    const t = await trainerWithContract('countersigned')
    const live = await cohortFor(t.profileId, 'active')
    const open = await cohortFor(t.profileId, 'open')
    const done = await cohortFor(t.profileId, 'completed')

    await learnerIn(live, 'enrolled')
    await learnerIn(live, 'enrolled')
    await learnerIn(open, 'enrolled')
    /* ═══ وهذان ضدُّ الفحص ═══
       منسحبٌ من شعبةٍ حيّة، ومسجَّلٌ في شعبةٍ منتهية. وكلاهما لا يُمَسّ
       برحيل: الأوّلُ خرج، والثانيةُ انتهت. فلو حُسبا لَقال التحذيرُ خمسةً
       والواقعُ ثلاثة. */
    await learnerIn(live, 'dropped')
    await learnerIn(done, 'enrolled')

    const i = await review.contractCloseImpact(t.contractId)
    expect(i.liveCohorts, 'حُسبت الشعبةُ المنتهيةُ مع الحيّتَين').toBe(2)
    expect(i.enrolledLearners, 'حُسب المنسحبُ أو مَن في المنتهية').toBe(3)
  })

  it('وعروضُ الإسناد المعلَّقةُ وحدَها', async () => {
    const t = await trainerWithContract('countersigned')
    const mk = (status: string) => prisma.trainerAssignmentOffer.create({
      data: {
        profileId: t.profileId, courseId: COURSE, status,
        expiresAt: new Date(Date.now() + 7 * 86_400_000),
      },
    })
    await mk('offered')
    await mk('offered')
    /* والمُجابُ عنه لا يُسحب ولا يُذكَر: من قبِل صار له شعبة، ومن اعتذر
       أُغلق بابُه. فحسابُهما يجعل التحذيرَ يعدّ تاريخَ المدرّب لا مستقبلَه. */
    await mk('accepted')
    await mk('declined')
    await mk('withdrawn')
    await mk('lapsed')

    const i = await review.contractCloseImpact(t.contractId)
    expect(i.openOffers, 'حُسب عرضٌ أُجيب عنه أو سُحب').toBe(2)
  })

  it('والمستحقُّ الذي لم يُصرَف — بعملته', async () => {
    const t = await trainerWithContract('countersigned')
    const mk = (status: string, total: string, currency: string) => prisma.trainerPayout.create({
      data: { profileId: t.profileId, period: '2026-08', status, total, currency },
    })
    await mk('pending', '100.00', 'USD')
    await mk('approved', '25.50', 'USD')
    await mk('pending', '40.00', 'JOD')
    /* والمصروفُ انتهى أمرُه، والملغى لا يُطالَب به */
    await mk('paid', '999.00', 'USD')
    await mk('cancelled', '888.00', 'USD')

    const i = await review.contractCloseImpact(t.contractId)
    expect(i.unpaidPayouts, 'حُسب المصروفُ أو الملغى').toBe(3)
    expect(i.owedByCurrency, 'جُمعت العملتان في رقمٍ واحدٍ لا معنى له')
      .toEqual({ USD: 125.5, JOD: 40 })
  })

  it('و`isLive` للنافذ وحدَه — فالتحذيرُ يختلف به', async () => {
    const live = await trainerWithContract('countersigned')
    const sent = await trainerWithContract('sent')
    expect((await review.contractCloseImpact(live.contractId)).isLive).toBe(true)
    expect((await review.contractCloseImpact(sent.contractId)).isLive).toBe(false)
  })

  it('ومدرّبٌ لا شيءَ له تُقرأ أصفارُه لا يُرمى', async () => {
    const t = await trainerWithContract('sent')
    const i = await review.contractCloseImpact(t.contractId)
    expect(i).toMatchObject({
      liveCohorts: 0, enrolledLearners: 0, openOffers: 0, unpaidPayouts: 0, owedByCurrency: {},
    })
  })

  it('وعقدٌ لا وجودَ له يُردّ 404 — لا أصفارا تُقرأ «لا أثر»', async () => {
    await expect(review.contractCloseImpact('00000000-0000-0000-0000-000000000000'))
      .rejects.toMatchObject({ code: 'not_found' })
  })

  it('وأرقامُ مدرّبٍ لا تُنسَب إلى مدرّبٍ آخر', async () => {
    /* القراءةُ بـ`profileId` المأخوذِ من العقد. ولو أُخذ من غيره — أو
       سقط الشرطُ — لَعدّ التحذيرُ شعبَ المنصّة كلَّها على كلّ إغلاق. */
    const a = await trainerWithContract('countersigned')
    const b = await trainerWithContract('countersigned')
    const c = await cohortFor(a.profileId, 'active')
    await learnerIn(c, 'enrolled')

    expect((await review.contractCloseImpact(b.contractId)).liveCohorts,
      'قرأ العقدُ شعبَ مدرّبٍ آخر').toBe(0)
    expect((await review.contractCloseImpact(a.contractId)).liveCohorts).toBe(1)
  })
})
