/* من وقّع عقدَه ثمّ عاد إلى رابطه — أيَّ بابٍ يجد؟

   ═══ الشكوى التي وُلد منها هذا الملفّ ═══

   مدرّبٌ وقّع عقدَه، ثمّ نقر «افتح العقد» في بريده ليقرأ ما وقّعه، فلم
   يُفتح له شيء: «انتهى هذا الرابط · رابطُ التوقيع يُفتح مرّةً واحدة».

   والسببُ أنّ التوقيعَ يمسح `tokenHash`، فلا يجد `byToken` صفّا، فتُرمى
   `invalid_token` **قبل** أن يُقرأ فرعُ `signed` في `contractByToken`.
   فثلاثةُ أبوابٍ كُتبت بعنايةٍ لا يُطرَق أيٌّ منها، ورأسُ `byToken` يقول
   مقصدَها: «فمن يقف أمام بابٍ مغلقٍ يحتاج أن يعرف أيَّ بابٍ هو».

   وأسوأُ ما في الرسالة أنّها تطمئنه بما لا يقع: «ووصلتك نسختُك بالبريد» —
   وبريدُ التوقيع يحمل بصمةَ النصّ لا النصَّ، ولا رابطا. فقبل ختمِنا العقدَ
   لا حسابَ له في المنصّة ولا رابطَ يقرأ منه: نسختُه لا توجد في مكان.

   ولا يُخشى من إبقاء الرمز توقيعٌ ثانٍ: الكتابةُ مشروطةٌ بـ`status: 'sent'`
   داخل معاملةٍ، فالعقدُ الموقَّعُ يردّ `bad_state` ولو بقي رمزُه حيّا. وهو
   ما يقيسه الفحصُ الثاني هنا صراحةً. */

import { beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { CONDITION_CLAUSE_MARK, contractAcks } from '../../../src/application/trainer/contract-body'

let prisma: PrismaClient
let review: TrainerReviewService
let adminId = ''
let seq = 0

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const ALL_ACKS = contractAcks(true).map((a) => a.key)
const BODY = `متنُ اتفاقيّةٍ للاختبار — البند 1 وما بعده.

${CONDITION_CLAUSE_MARK} لا عقد نهائي. ونفاذه معلق على قبول الأكاديمية لمواد المدرب.`

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  const admin = await auth.register('clink-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
}, 240_000)

async function signedContract() {
  seq += 1
  const app = await prisma.trainerApplication.create({
    data: {
      reference: `TR-CL-${Date.now()}-${seq}`, fullName: `مرشّحٌ ${seq}`,
      email: `clink-${seq}-${Date.now()}@test.local`,
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
  const token = decodeURIComponent(sent.signingUrl.split('/c/')[1])
  await review.signContractByToken(token, {
    addressAr: 'عمّان — الدوّار السابع، بناية ١٢', phone: '+962790000000',
    legalName: 'سارة عبد الله الحربي', bodyHash: sha256(BODY), acks: [...ALL_ACKS],
    ip: '203.0.113.9', userAgent: 'Mozilla/5.0 (اختبار)',
  })
  return { contract, token }
}

describe('رابطُ من وقّع يبقى بابَ نسخته', () => {
  it('يُفتح على «وُقّع هذا العقد» لا على «انتهى هذا الرابط»', async () => {
    const { token } = await signedContract()
    const view = await review.contractByToken(token)
    expect(view.state, 'عاد الموقِّعُ إلى رابطه فوجد بابا منتهيا لا عقدَه').toBe('signed')
    if (view.state !== 'signed') return
    expect(view.signerLegalName).toBe('سارة عبد الله الحربي')
    expect(view.signedAt).toBeTruthy()
  })

  it('ويقرأ فيه المتنَ الذي وقّعه لا خبرَ توقيعه وحدَه', async () => {
    const { token } = await signedContract()
    const view = await review.contractByToken(token)
    if (view.state !== 'signed') throw new Error('لم يُفتح بابُ الموقَّع')
    expect(view.bodyAr, 'بابٌ اسمُه «افتح العقد» لا يُعرض فيه العقد').toBe(BODY)
    expect(view.bodyHash).toBe(sha256(BODY))
  })

  it('ولا يُوقَّع مرّتين ولو بقي رمزُه حيّا', async () => {
    const { token } = await signedContract()
    await expect(review.signContractByToken(token, {
      addressAr: 'عمّان — عنوانٌ آخر', phone: '+962790000001',
      legalName: 'سارة عبد الله الحربي', bodyHash: sha256(BODY), acks: [...ALL_ACKS],
    })).rejects.toMatchObject({ code: 'bad_state' })
  })

  it('والرمزُ يبقى في الصفّ بعد التوقيع — وإلّا فلا صفَّ يُوجَد به', async () => {
    const { contract } = await signedContract()
    const row = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(row.status).toBe('signed')
    expect(row.tokenHash, 'مُسح الرمزُ فمات بابُ الموقِّع إلى نسخته').toBeTruthy()
  })
})
