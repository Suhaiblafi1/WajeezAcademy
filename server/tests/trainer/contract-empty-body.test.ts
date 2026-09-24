/* لا يُوقَّع على لا شيء — بقاعدةٍ حقيقيّة.
 *
 * ── ولمَ لا تكفي قراءةُ المصدر ──
 *
 * حارسُ `src/tests` يرى `contractHasBodyAr` مكتوبةً في الدوالّ الثلاث.
 * ولا يُثبت أنّ عقدا بلا متنٍ **يُردّ فعلا**، ولا أنّ حالتَه تبقى كما كانت
 * بعد الردّ. وهذا ما يُقاس هنا: الفعلُ يقع أو لا يقع، والصفُّ بعده.
 *
 * وأدقُّ ما يُقاس: **المتنُ الخاوي لا الغائب**. كان المنعُ بالعرَض — إذ
 * يسقط `bodyHash` مع المتن. و`sha256('')` هاشٌ صحيحٌ تامّ، فصفٌّ متنُه `''`
 * وهاشُه هاشُ الخواء كان يمرّ المقابلةَ ويُوقَّع نظيفا.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { contractAcks, CONDITION_CLAUSE_MARK } from '../../../src/application/trainer/contract-body'

let prisma: PrismaClient
let review: TrainerReviewService
let adminId = ''

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const ALL_ACKS = contractAcks(true).map((a) => a.key)
const BODY = `نصُّ اتفاقيّةٍ للاختبار — البند 1 وما بعده.

${CONDITION_CLAUSE_MARK} لا عقد نهائي. ونفاذه معلق على قبول الأكاديمية لمواد المدرب.`

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  const admin = await auth.register('ceb-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
}, 240_000)

let seq = 0
async function mkContract(status: string, extra: Record<string, unknown> = {}) {
  seq += 1
  const app = await prisma.trainerApplication.create({
    data: {
      reference: `TR-CEB-${Date.now()}-${seq}`, fullName: `مرشّحٌ ${seq}`,
      email: `ceb-${seq}-${Date.now()}@test.local`,
      status: 'conditionally_approved', motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: app.id } })
  const contract = await prisma.trainerContract.create({
    data: {
      profileId: profile.id, title: `اتفاقيّةُ اختبارٍ ${seq}`, status,
      bodyVersion: 'v-test', bodyAr: BODY, bodyHash: sha256(BODY),
      requiredDocuments: [], signerEmail: app.email, gatesActivation: true,
      ...extra,
    },
  })
  return { app, profile, contract }
}

/** يرسل ويعيد الرمزَ من الرابط — فالرمزُ لا يُخزَّن ولا يُقرأ من القاعدة */
async function sendAndToken(contractId: string) {
  const r = await review.sendContract(contractId, adminId)
  return decodeURIComponent(r.signingUrl.split('/c/')[1])
}

describe('ما لا متنَ له لا يُوقَّع، والحالةُ لا تتحرّك', () => {
  /* ═══ الصورةُ التي كانت تمرّ ═══
     المتنُ خاوٍ لا غائب، وهاشُه هاشُ الخواء — فيطابق المحفوظَ ويمضي. */
  it('متنٌ خاوٍ وهاشُه صحيحٌ تامٌّ — يُردّ ولا يُوقَّع', async () => {
    const { contract } = await mkContract('draft')
    const token = await sendAndToken(contract.id)
    /* ويُفرَّغ بعد الإرسال: صورةُ صفٍّ من البابِ القديم برمزٍ حيّ */
    await prisma.trainerContract.update({
      where: { id: contract.id }, data: { bodyAr: '', bodyHash: sha256('') },
    })
    await expect(review.signContractByToken(token, {
      addressAr: 'عمّان — الدوّار السابع، بناية ١٢', phone: '+962790000000',
      legalName: 'سارة عبد الله الحربي', bodyHash: sha256(''), acks: [...ALL_ACKS],
    })).rejects.toMatchObject({ code: 'no_body' })

    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(after.status, 'وُقّع على وثيقةٍ خاوية').toBe('sent')
    expect(after.signedAt, 'كُتب تاريخُ توقيعٍ على لا شيء').toBeNull()
  })

  /* ومسافاتٌ ليست وثيقةً كذلك — والهاشُ لها صحيحٌ مثلُه */
  it('ومتنٌ من مسافاتٍ مثلُه', async () => {
    const { contract } = await mkContract('draft')
    const token = await sendAndToken(contract.id)
    await prisma.trainerContract.update({
      where: { id: contract.id }, data: { bodyAr: '   \n\t ', bodyHash: sha256('   \n\t ') },
    })
    await expect(review.signContractByToken(token, {
      addressAr: 'عمّان — الدوّار السابع، بناية ١٢', phone: '+962790000000',
      legalName: 'سارة عبد الله الحربي', bodyHash: sha256('   \n\t '), acks: [...ALL_ACKS],
    })).rejects.toMatchObject({ code: 'no_body' })
    expect((await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })).signedAt)
      .toBeNull()
  })

  /* ولا يُقال لمن لا نصَّ عنده «تغيّر النصُّ فأعِدْ التحميلَ واقرأ» */
  it('والردُّ يسمّي العلّةَ: لا متنَ — لا «تغيّر النصّ»', async () => {
    const { contract } = await mkContract('draft')
    const token = await sendAndToken(contract.id)
    await prisma.trainerContract.update({
      where: { id: contract.id }, data: { bodyAr: null, bodyHash: null },
    })
    await expect(review.signContractByToken(token, {
      addressAr: 'عمّان — الدوّار السابع، بناية ١٢', phone: '+962790000000',
      legalName: 'سارة عبد الله الحربي', bodyHash: sha256(BODY), acks: [...ALL_ACKS],
    })).rejects.toMatchObject({ code: 'no_body' })
  })
})

describe('وردُّ التعديل بابٌ يُرسِل، فيسأل ما يسأل عنه الإرسال', () => {
  it('عقدٌ بلا متنٍ لا يعود إلى التوقيع', async () => {
    const { contract } = await mkContract('amendment_requested', {
      bodyAr: null, bodyHash: null,
      amendmentRequestAr: 'أريد تعديلَ مدّة الإخطار',
      amendmentRequestedAt: new Date(),
    })
    await expect(review.replyToAmendment(contract.id, adminId, 'المدّةُ نظامٌ عامٌّ لا تُفرَد لعقد'))
      .rejects.toMatchObject({ code: 'no_body' })

    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(after.status, 'عاد إلى التوقيع بلا متن').toBe('amendment_requested')
    expect(after.tokenHash, 'سُكّ رمزٌ حيٌّ على وثيقةٍ خاوية').toBeNull()
    expect(after.amendmentReplyAr, 'كُتب جوابٌ على بابٍ لم يُفتَح').toBeNull()
  })

  /* وذو المتن يمرّ — فالقيدُ يمنع المعطوبَ لا كلَّ شيء */
  it('وذو المتنِ يعود كما كان', async () => {
    const { contract } = await mkContract('amendment_requested', {
      amendmentRequestAr: 'أريد تعديلَ مدّة الإخطار',
      amendmentRequestedAt: new Date(),
    })
    await review.replyToAmendment(contract.id, adminId, 'المدّةُ نظامٌ عامٌّ لا تُفرَد لعقد')
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(after.status).toBe('sent')
    expect(after.tokenHash, 'عاد بلا رمزٍ — فبأيّ رابطٍ يقرأ جوابَنا؟').toBeTruthy()
  })
})
