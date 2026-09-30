/* البابُ المغلَقُ يقول أيُّ بابٍ هو — لا «انتهى هذا الرابط» لكلِّ حال.

   ═══ رأسُ `byToken` كتب المقصدَ، والشيفرةُ كانت تخالفه ═══

   «فرسائلُ الردّ تفرّق بين «لم يعد صالحا» و«وُقّع» و«أُلغي»، لأنّ من يقف
   أمام بابٍ مغلقٍ يحتاج أن يعرف أيَّ بابٍ هو».

   وكانت أربعةُ مسالكَ تمسح `tokenHash`: الاعتذارُ، والإلغاءُ، وردُّ التعديل
   بعقدٍ جديد، وإعادةُ التركيب باسمٍ مصحَّح. فيسقط `byToken` على
   `invalid_token` **قبل** أن يُقرأ فرعُ `declined` أو `revoked` — فيُقال
   للجميع «انتهى هذا الرابط»، والفرعان مكتوبان لا يُبلَغان.

   وقد بقي رمزُ التوقيع حيّا (٢٩ سبتمبر)، وهذه بقيّتُها.

   ═══ وما يُقاس هنا ثلاثةٌ معا ═══

   ① أنّ البابَ يُسمّي نفسَه: `declined` للمعتذِر، و`revoked` لمن سُحب عقدُه
     أو أزاحه أحدثُ منه.
   ② وأنّ الإبقاءَ لا يفتح ما أُغلق: لا توقيعَ بعد اعتذارٍ ولا بعد إلغاء —
     يردُّه شرطُ الحالة لا مسحُ الرمز.
   ③ وأنّه لا يُسكب بالبقاء ما لا يُعرَض: لا متنَ في البابين، ولا سببَ
     إلغاءٍ — وهو ملاحظتُنا نحن تُكتب لنا لا له. */

import { beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { CONDITION_CLAUSE_MARK } from '../../../src/application/trainer/contract-body'

let prisma: PrismaClient
let review: TrainerReviewService
let adminId = ''
let seq = 0

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const BODY = `متنُ اتفاقيّةٍ للاختبار — البند 1 وما بعده.

${CONDITION_CLAUSE_MARK} لا عقد نهائي. ونفاذه معلق على قبول الأكاديمية لمواد المدرب.`

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  const admin = await auth.register('cdoor-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
}, 240_000)

/** عقدٌ مرسَلٌ ورمزُه — ويُعاد معه معرّفُه لقراءة صفّه */
async function sentContract() {
  seq += 1
  const app = await prisma.trainerApplication.create({
    data: {
      reference: `TR-CD-${Date.now()}-${seq}`, fullName: `مرشّحٌ ${seq}`,
      email: `cdoor-${seq}-${Date.now()}@test.local`,
      status: 'conditionally_approved', motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: app.id } })
  const contract = await prisma.trainerContract.create({
    data: {
      profileId: profile.id, title: `اتفاقيّةُ اختبارٍ ${seq}`, status: 'draft',
      bodyVersion: 'v-test', bodyAr: BODY, bodyHash: sha256(BODY),
      requiredDocuments: [], signerEmail: app.email, gatesActivation: true,
    },
  })
  await prisma.trainerOnboardingTask.create({
    data: { profileId: profile.id, key: 'sign_contract', title: 'توقيع العقد' },
  })
  const sent = await review.sendContract(contract.id, adminId)
  return { contract, token: decodeURIComponent(sent.signingUrl.split('/c/')[1]) }
}

describe('بابُ من اعتذر يقول «اعتُذر»', () => {
  it('لا «انتهى هذا الرابط» — فالسهوُ يُصلَح بمن يعرف أنّه اعتذر', async () => {
    const { token } = await sentContract()
    await review.declineContractByToken(token, 'الأتعابُ لا تناسبني في هذا الوقت')
    const view = await review.contractByToken(token)
    expect(view.state, 'قيل للمعتذِر «انتهى رابطُك» فلا يدري أنّه هو أغلقه').toBe('declined')
    if (view.state !== 'declined') return
    expect(view.declinedAt).toBeTruthy()
  })

  it('ولا يُوقَّع ما اعتُذر عنه ولو بقي رمزُه', async () => {
    const { token } = await sentContract()
    await review.declineContractByToken(token, 'الأتعابُ لا تناسبني في هذا الوقت')
    await expect(review.signContractByToken(token, {
      addressAr: 'عمّان — الدوّار السابع', phone: '+962790000000',
      legalName: 'سارة عبد الله الحربي', bodyHash: sha256(BODY), acks: [],
    })).rejects.toMatchObject({ code: 'bad_state' })
  })
})

describe('وبابُ ما سُحب يقول «أُلغي»', () => {
  it('عقدٌ ألغته الأكاديميّةُ يُسمّي نفسَه', async () => {
    const { contract, token } = await sentContract()
    await review.revokeContract(contract.id, adminId, 'أُرسل إلى الشخص الخطأ')
    const view = await review.contractByToken(token)
    expect(view.state, 'قيل لمن سُحب عقدُه «انتهى رابطُك»').toBe('revoked')
  })

  it('وعقدٌ أزاحه أحدثُ منه يقول ذلك كذلك', async () => {
    const { contract, token } = await sentContract()
    await review.requestContractAmendment(token, 'أرجو مراجعةَ البند الرابع فالمهلةُ قصيرة')
    await review.answerAmendmentWithNewContract(contract.id, adminId, 'قبلنا طلبَك وأعدنا تركيبَه')
    const view = await review.contractByToken(token)
    expect(view.state, 'من طُلب تعديلُه فأُجيب بعقدٍ جديدٍ وجد بابا صامتا').toBe('revoked')
  })

  it('ولا يُوقَّع ملغًى ولو بقي رمزُه', async () => {
    const { contract, token } = await sentContract()
    await review.revokeContract(contract.id, adminId, 'أُرسل إلى الشخص الخطأ')
    await expect(review.signContractByToken(token, {
      addressAr: 'عمّان — الدوّار السابع', phone: '+962790000000',
      legalName: 'سارة عبد الله الحربي', bodyHash: sha256(BODY), acks: [],
    })).rejects.toMatchObject({ code: 'bad_state' })
  })
})

describe('ولا يُسكب بالبقاء ما لا يُعرَض', () => {
  it('لا متنَ ولا سببَ إلغاءٍ في البابين — والعنوانُ وحدَه يُقال', async () => {
    const { contract, token } = await sentContract()
    const REASON = 'أُرسل إلى الشخص الخطأ'
    await review.revokeContract(contract.id, adminId, REASON)
    const view = await review.contractByToken(token)
    const seen = JSON.stringify(view)
    expect(seen, 'سُكب المتنُ في بابٍ مغلق').not.toContain(BODY.slice(0, 40))
    expect(seen, 'سُرّبت ملاحظتُنا الداخليّةُ إلى من أمام الباب').not.toContain(REASON)
    /* والشاهدُ المضادّ: العنوانُ يُعرَض فعلا، وإلّا مرّ الفحصُ على ردٍّ فارغ */
    expect(seen, 'لا عنوانَ في الباب — فما الذي يُقرأ؟').toContain('اتفاقيّةُ اختبارٍ')
  })

  it('وبابُ المعتذِر مثلُه — لا متنَ فيه ولا سببُ اعتذاره', async () => {
    const { token } = await sentContract()
    const REASON = 'الأتعابُ لا تناسبني في هذا الوقت'
    await review.declineContractByToken(token, REASON)
    const seen = JSON.stringify(await review.contractByToken(token))
    expect(seen, 'سُكب المتنُ في باب المعتذِر').not.toContain(BODY.slice(0, 40))
    expect(seen, 'رُدّ سببُ اعتذاره إليه ولا حاجةَ به').not.toContain(REASON)
  })
})
