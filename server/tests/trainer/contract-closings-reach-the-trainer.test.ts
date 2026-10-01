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
    /* والرمزُ يبقى (٣٠ سبتمبر ٢٠٢٦): ما يمنع التوقيعَ شرطُ الحالة لا مسحُ
       الرمز، والمسحُ كان يمنع قراءةً فيُقال «انتهى هذا الرابط» بدل تسميةِ
       البابِ. وتفصيلُه في `closed-doors-say-which.test.ts`. */
    expect(after.tokenHash, 'مُسح الرمزُ فصار بابُ الملغى صامتا').toBeTruthy()
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

/* ═══ والجوابُ الثالث (قبولُ التعديل) انتقل (١ أكتوبر ٢٠٢٦) ═══

   صار يُرسل العقدَ المصحَّحَ في رسالة الجواب نفسِها، فلا يكفيه عرضٌ بلا
   مؤهّلاتٍ ولا أتعاب كالذي يُصنع هنا. وحارسُه بقاعدةٍ تامّةٍ في
   `contract-amendment-accept.test.ts`. */
