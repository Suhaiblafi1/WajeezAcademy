/* إغلاقُ العقد يصل صاحبَه — بقاعدةٍ حقيقيّة.
 *
 * ── العطبُ الذي يحرسه ──
 *
 * `revokeContract` كانت تحدّث الصفَّ وتكتب أثرَه وتميت رمزَه ثمّ **تسكت**.
 * فمن ينتظر عقدا يفتح رابطَه فلا يعمل، ولا خبرَ عنده أنّه أُلغي ولا لماذا.
 * وبلاغُ صاحب المنصّة (٢٦ سبتمبر ٢٠٢٦): «يجب أن يكون زرُّ إلغاء العقد فيرسل
 * للمدرّب أنّ العقد قد أُلغي ولماذا».
 *
 * ومعه بابٌ ثالثٌ لم يكن له زرّ: «سنعدّل ونرسل عقدا جديدا». وكان يُؤدَّى
 * بالإلغاء ثمّ التركيب — فيصل صاحبَه (لو وصل) أنّ عقدَه أُلغي، وهو عكسُ ما
 * وقع: طلبُه قُبل.
 *
 * ── وما يُقاس هنا: الوصلُ لا النصّ ──
 *
 * نصُّ الرسائل يُقاس في `src/tests/trainer/contract-mail-truth.test.ts`
 * باستدعاء الدوالّ الخالصة. وهذه الجولةُ تقيس ما لا تقيسه تلك: أنّ الخدمةَ
 * **تستحقّ رسالةً وتطلبها** في المواضع الصحيحة، وأنّها لا تطلبها لمسودّةٍ لم
 * يرَها أحد. و`emailDelivery: null` تعني «لا رسالةَ مستحقّة» — تُفرَّق عن
 * `not_configured` التي تعني «قناةٌ مغلقة».
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { CONDITION_CLAUSE_MARK } from '../../../src/application/trainer/contract-body'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let adminId = ''

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const BODY = `نصُّ اتفاقيّةٍ للاختبار — البند 1 وما بعده.

${CONDITION_CLAUSE_MARK} لا عقد نهائي. ونفاذه معلق على قبول الأكاديمية لمواد المدرب.`

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  const admin = await auth.register('close-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
}, 240_000)

let seq = 0

/** عقدٌ مسودّةٌ — ويُرسَل بطلبٍ فيصير له رمزٌ وصاحبٌ رآه */
async function makeContract() {
  seq += 1
  const email = `close-${seq}-${Date.now()}@test.local`
  const user = await auth.register(email, 'Trainer#12345', `مرشّحٌ ${seq}`)
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-CLS-${Date.now()}-${seq}`, fullName: `مرشّحٌ ${seq}`, email,
      status: 'conditionally_approved', motivation: 'اختبار',
      privacyConsentAt: new Date(), userId: user.userId,
    },
  })
  const profile = await prisma.trainerProfile.create({
    data: { applicationId: application.id, userId: user.userId, isVerified: true },
  })
  const contract = await prisma.trainerContract.create({
    data: {
      profileId: profile.id, title: `عرضٌ مشروطٌ ${seq}`, status: 'draft',
      bodyVersion: 'v-test', bodyAr: BODY, bodyHash: sha256(BODY),
      requiredDocuments: [], signerEmail: email, gatesActivation: true,
    },
  })
  return { application, profile, contract }
}

async function sentContract() {
  const made = await makeContract()
  const sent = await review.sendContract(made.contract.id, adminId)
  return { ...made, token: decodeURIComponent(sent.signingUrl.split('/c/')[1]) }
}

describe('الإلغاءُ يصل صاحبَه بسببه', () => {
  it('عقدٌ خرج إليه: تُطلَب رسالتُه، ويموت رمزُه', async () => {
    const { contract } = await sentContract()
    const out = await review.revokeContract(contract.id, adminId, 'أُلغي لخطأٍ في أساس الأتعاب')

    expect(out.emailDelivery, 'أُلغي عقدٌ رآه صاحبُه ولم تُطلَب له رسالة').not.toBeNull()
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(after.status).toBe('revoked')
    expect(after.revokeReasonAr, 'ضاع سببُ الإلغاء').toContain('أساس الأتعاب')
    expect(after.tokenHash, 'بقي رابطٌ حيٌّ على عقدٍ أُلغي').toBeNull()
  })

  it('ومسودّةٌ لم تخرج إليه: لا رسالةَ مستحقّة', async () => {
    /* ═══ وهذا ليس تحسينا بل صدقا ═══

       رسالةٌ عن مسودّةٍ تُخبره بوجود عقدٍ ثمّ بإلغائه في نفَسٍ واحد — خبرٌ
       لا يعنيه ويُقلقه. والتركيبُ يُخرج صفّا مجمَّدا لم يرَه أحد: لا رابطَ،
       ولا بريدَ خرج، ولا حالةَ طلبٍ تحرّكت. */
    const { contract } = await makeContract()
    const out = await review.revokeContract(contract.id, adminId, 'رُكّبت بالخطأ على الطلب الخطأ')

    expect(out.emailDelivery, 'أُرسل إليه خبرُ إلغاءِ مسودّةٍ لم يرَها').toBeNull()
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(after.status, 'لم تُلغَ المسودّةُ أصلا — فالفحصُ يقيس لا شيء').toBe('revoked')
  })
})

describe('الجوابُ الثالث: قبولُ التعديل وإعادةُ التركيب', () => {
  /** عقدٌ مرسَلٌ طلب صاحبُه تعديلَه */
  async function amendmentRequested() {
    const made = await sentContract()
    await review.requestContractAmendment(made.token, 'أرجو تعديلَ البند 4-1: الأتعاب ٣٠ لا ٢٥')
    return made
  }

  it('يُغلق العرضَ، ويحفظ الجوابَ، ويميت الرمزَ، وتُطلَب رسالتُه', async () => {
    const { contract } = await amendmentRequested()
    const REPLY = 'قبلنا تعديلَ البند 4-1 ليصير أساسُ الأتعاب ٣٠ دولارا للمقعد'

    const out = await review.answerAmendmentWithNewContract(contract.id, adminId, REPLY)
    expect(out.emailDelivery, 'قُبل طلبُه ولم تُطلَب رسالةٌ تقول ذلك').not.toBeNull()

    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(after.status).toBe('revoked')
    /* والسببُ يقول إنّ طلبَه قُبل — لا «أُلغي» مجرّدةً تُقرأ عكسَ ما وقع */
    expect(after.revokeReasonAr ?? '', 'سببُ الإغلاق لا يقول إنّ التعديلَ قُبل')
      .toContain('قُبل طلبُ التعديل')
    expect(after.revokeReasonAr ?? '').toContain(REPLY)
    /* والجوابُ في خانته هو كذلك: خطُّ زمنِ الطلب يُقرأ كاملا بعد الإغلاق */
    expect(after.amendmentReplyAr, 'لم يُحفَظ الجوابُ في خانته').toBe(REPLY)
    expect(after.amendmentRepliedAt).not.toBeNull()
    expect(after.tokenHash, 'بقي رابطٌ حيٌّ على متنٍ قبلنا تعديلَه').toBeNull()
  })

  it('ويُكتب فعلُه في الأثر مميَّزا عن الإلغاء المجرّد', async () => {
    /* فمن سأل بعد سنةٍ «لمَ أُغلق هذا العرض؟» يفرّق بين إلغاءٍ وبين قبولِ
       تعديلٍ مهّد لعقدٍ آخر. */
    const { contract } = await amendmentRequested()
    await review.answerAmendmentWithNewContract(contract.id, adminId, 'قبلنا تعديلَ البند 7-2')

    const rows = await prisma.auditEvent.findMany({
      where: { entityType: 'trainer_contract', entityId: contract.id },
      select: { action: true },
    })
    const actions = rows.map((r) => r.action)
    expect(actions, 'لا أثرَ لقبول التعديل').toContain('trainer.contract.amendment_reissue')
    expect(actions, 'كُتب إلغاءً مجرّدا فضاع تمييزُه').not.toContain('trainer.contract.revoke')
  })

  it('ولا يُقبَل تعديلٌ لا طلبَ له — والصفُّ لا يُمَسّ', async () => {
    const { contract } = await sentContract()
    await expect(review.answerAmendmentWithNewContract(contract.id, adminId, 'قبلنا تعديلا لم يُطلَب'))
      .rejects.toMatchObject({ code: 'bad_state' })
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(after.status, 'أُغلق عرضٌ لا طلبَ تعديلٍ عليه').toBe('sent')
    expect(after.tokenHash, 'مات رابطُ عقدٍ لم يُمَسّ').not.toBeNull()
  })
})
