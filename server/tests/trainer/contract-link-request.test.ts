/* ═══ من فقد رابطَ عرضه يطلبه ببريده ═══
 *
 * رمزُ التوقيع لا يُحفَظ نصّا — `tokenHash` وحدَه في الجدول. فرسالةُ «حُدّث
 * نصُّ عرضك» لا تحمل رابطا، إذ لا سبيلَ إلى إعادة بنائه؛ ولو سُكّ رمزٌ
 * جديدٌ ليُوضَع فيها لَمات الذي بيد صاحبه — وهو العطبُ الذي شكاه صاحبُ
 * المنصّة («ضغط على فتح العقد فلم يُفتح») وأُصلح في #351 و#353.
 *
 * فصار زرُّ الرسالة يقصد بابا يطلب فيه رابطَه بنفسه. وقياساتُه هنا.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { contractAcks } from '../../../src/application/trainer/contract-body'

let prisma: PrismaClient
let review: TrainerReviewService
let adminId = ''
let seq = 0

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const ALL_ACKS = contractAcks(true).map((a) => a.key)

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  const admin = await auth.register('linkreq-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
}, 240_000)

async function openContract(status: 'sent' | 'amendment_requested' | 'signed' = 'sent') {
  seq += 1
  /* ═══ وحالةُ حرفِ المحفوظِ تُخالف حالةَ المسؤولِ به ═══

     لو خُزّن صغيرا وسُئل كبيرا لَكفى تصغيرُ الداخل، ولم يُقَس
     `mode: 'insensitive'` أصلا — فمرّ القياسُ الأوّلُ خضراءَ على نمطٍ
     حسّاسٍ للحالة. فيُخزَّن بحرفٍ كبيرٍ ويُسأل بالصغير. */
  const email = `LinkReq-${seq}-${Date.now()}@Test.Local`
  const app = await prisma.trainerApplication.create({
    data: {
      reference: `TR-LR-${Date.now()}-${seq}`, fullName: `مرشّحٌ ${seq}`, email,
      status: 'conditionally_approved', motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  await prisma.trainerProfile.create({ data: { applicationId: app.id } })
  const composed = await review.composeContract(app.id, adminId, {
    title: `اتفاقيّةُ اختبارٍ ${seq}`,
    courseIds: undefined,
    compensation: { type: 'per_seat', rate: 25, currency: 'USD', minSeats: 12, referralRate: 30 },
    rateWaivedReasonAr: null,
    hoursNoteAr: null,
    requiredDocuments: [{ kind: 'national_id', labelAr: 'الهوية الوطنية', required: true }],
  } as never)
  const contractId = (composed as { contractId?: string; id?: string }).contractId
    ?? (composed as { id: string }).id
  const sent = await review.sendContract(contractId, adminId)
  const token = decodeURIComponent(sent.signingUrl.split('/c/')[1])
  await prisma.trainerContractDocument.create({
    data: {
      contractId, kind: 'national_id', storageKey: `lr-${contractId}`,
      originalName: 'id.pdf', mime: 'application/pdf', sizeBytes: 1024,
    },
  })
  if (status === 'amendment_requested') {
    await review.requestContractAmendment(token, 'أرجو مراجعةَ البند الرابع')
  }
  if (status === 'signed') {
    const row = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contractId } })
    await review.signContractByToken(token, {
      legalName: 'سارة عبد الله الحربي', addressAr: 'عمّان — الدوّار السابع',
      phone: '+962790000000', bodyHash: row.bodyHash!, acks: [...ALL_ACKS],
      ip: '198.51.100.7', userAgent: 'vitest',
    })
  }
  const row = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contractId } })
  return { app, contractId, token, email, before: row }
}

const auditOf = (contractId: string) => prisma.auditEvent.findFirst({
  where: { action: 'trainer.contract.link_requested', entityId: contractId },
})

describe('① العرضُ المفتوحُ يُستعاد رابطُه', () => {
  it('يُسكّ رمزٌ جديدٌ ويموت القديم — فلا رابطان لوثيقةٍ واحدة', async () => {
    const { contractId, token, email, before } = await openContract('sent')
    const res = await review.requestContractLink(email)
    expect(res.ok).toBe(true)

    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contractId } })
    expect(after.tokenHash, 'لم يُسكّ رمزٌ جديد — فالطلبُ لا يُجدي صاحبَه').not.toBe(before.tokenHash)
    expect(after.tokenHash, 'بقي الرمزُ القديمُ حيّا مع الجديد').not.toBe(sha256(token))
    expect(after.tokenExpiresAt, 'رمزٌ بلا أجل').toBeTruthy()
    /* ═══ والقديمُ يُجرَّب فعلا ═══
       ثباتُ `tokenHash` لا يكفي: المقيسُ أن يُردّ حاملُ القديم — فلا يُوقَّع منه.
       وصار يقول حالَه بدل «غيرُ صالح» (١ أكتوبر ٢٠٢٦، `contract-link-states`):
       «أرسلنا إليك رابطا أحدث» — للقراءة لا للتوقيع. */
    expect((await review.contractByToken(token)).state, 'بقي الرابطُ القديمُ يفتح العرضَ للتوقيع').toBe('replaced')
    await expect(review.signContractByToken(token, {
      legalName: 'سارة عبد الله الحربي', addressAr: 'عمّان — الدوّار السابع', phone: '+962790000000',
      bodyHash: after.bodyHash!, acks: [...ALL_ACKS],
    }), 'وُقّع من الرابط القديم').rejects.toMatchObject({ code: 'invalid_token' })
  })

  it('ونصُّ العرض وحالتُه لا يُمَسّان — الطلبُ رابطٌ لا تعديل', async () => {
    const { contractId, email, before } = await openContract('sent')
    await review.requestContractLink(email)
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contractId } })
    expect(after.bodyAr, 'تبدّل نصُّ العرض بطلب رابط').toBe(before.bodyAr)
    expect(after.bodyHash).toBe(before.bodyHash)
    expect(after.status, 'تبدّلت حالةُ العرض بطلب رابط').toBe(before.status)
    expect(after.signedAt, 'كُتب توقيعٌ بطلب رابط').toBeNull()
  })

  it('ومن طلب تعديلا يُستعاد رابطُه كذلك — بأمرِ صاحب المنصّة «both»', async () => {
    const { contractId, email, before } = await openContract('amendment_requested')
    await review.requestContractLink(email)
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contractId } })
    expect(after.tokenHash, 'حُرم صاحبُ طلب التعديل من استعادة رابطه').not.toBe(before.tokenHash)
    expect(after.status, 'أُخرج من طور طلب التعديل').toBe(before.status)
  })

  it('ويُكتب الأثرُ بلا فاعلٍ — فالطالبُ هو المدرّبُ لا موظّف', async () => {
    const { contractId, email } = await openContract('sent')
    await review.requestContractLink(email)
    const ev = await auditOf(contractId)
    expect(ev, 'سُكّ رمزٌ بلا أثر — فلا يُعرَف من طلبه ولا متى').toBeTruthy()
    expect(ev!.actorId, 'نُسب طلبُ المدرّب إلى موظّف').toBeNull()
  })

  it('والبريدُ يُطابَق بلا نظرٍ إلى حالة حرفه محفوظا ولا مسؤولا به', async () => {
    const { contractId, email, before } = await openContract('sent')
    await review.requestContractLink(email.toLowerCase())
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contractId } })
    expect(after.tokenHash, 'رُدّ صاحبُ الحقّ لأنّه كتب بريدَه بحرفٍ كبير').not.toBe(before.tokenHash)
  })
})

describe('① (ب) والبابُ المغلقُ لا يُفتَح بطلب رابط', () => {
  /* ═══ ولمَ هذا قياسٌ قائمٌ بنفسه ═══

     `isUntouchableContract` يحرس الموقَّعَ والمُوقَّعَ عليه فقط — لا
     المعتذَرَ عنه ولا الملغى. فشرطُ الحالة في الاستعلام هو الحارسُ
     **الوحيد** لهما. ولولاه لَسكّ من أُلغي عرضُه رمزا جديدا بنقرةٍ
     وعاد إلى بابٍ أُغلق في وجهه — وتلك الأبوابُ كُتبت بعنايةٍ في #353. */
  for (const closed of ['declined', 'revoked'] as const) {
    it(`⚠️ عرضٌ حالتُه «${closed}» لا يُسكّ له رمزٌ جديد`, async () => {
      const { contractId, email, before } = await openContract('sent')
      await prisma.trainerContract.update({
        where: { id: contractId },
        data: { status: closed, ...(closed === 'declined' ? { declinedAt: new Date() } : {}) },
      })

      const res = await review.requestContractLink(email)
      expect(res.ok, 'رُدّ بخطأٍ يكشف أنّ للبريد عقدا مغلقا').toBe(true)

      const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contractId } })
      expect(after.tokenHash, 'فُتح بابٌ أُغلق: سُكّ رمزٌ جديدٌ لعرضٍ منتهٍ').toBe(before.tokenHash)
      expect(after.status, 'أُخرج العرضُ من حالته المغلقة').toBe(closed)
      expect(await auditOf(contractId), 'كُتب أثرُ استعادةٍ لعرضٍ مغلق').toBeNull()
    })
  }
})

describe('② (ب) وحارسُ الصفّ يمسك ما يفلت من الحالة', () => {
  /* شرطُ الحالة يقصر على المفتوح، فالموقَّعُ لا يبلغ الحارسَ الثاني —
     ولذلك لم يسقط شيءٌ حين رُفع في أوّل قياس. والصفُّ المرضيُّ الذي
     وُضع له: حالةٌ مفتوحةٌ وتاريخُ توقيعٍ مكتوب (هجرةٌ قديمة، أو كتابةٌ
     جزئيّةٌ سقطت بينهما). */
  it('⚠️ صفٌّ حالتُه مفتوحةٌ وفيه تاريخُ توقيعٍ لا يُسكّ له رمز', async () => {
    const { contractId, email, before } = await openContract('sent')
    await prisma.trainerContract.update({
      where: { id: contractId }, data: { signedAt: new Date() },
    })

    await review.requestContractLink(email)

    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contractId } })
    expect(after.tokenHash, 'سُكّ رمزٌ لصفٍّ مسّه توقيعٌ ولو كانت حالتُه مفتوحة')
      .toBe(before.tokenHash)
    expect(await auditOf(contractId), 'كُتب أثرُ استعادةٍ لصفٍّ مسّه توقيع').toBeNull()
  })
})

describe('② ولا يُكشَف بهذا الباب وجودُ عقدٍ من عدمه', () => {
  /* ولولا ذلك لَصار بابا يُسأل به «أهذا البريدُ لمدرّبٍ عندكم؟» عن ألفِ
     بريدٍ في دقيقة — فيُعرَف من تعاقدنا معه ومن لم نتعاقد. */
  it('⚠️ بريدٌ لا عقدَ له يُجاب بمثل ما يُجاب به صاحبُ العقد', async () => {
    const { email } = await openContract('sent')
    const known = await review.requestContractLink(email)
    const unknown = await review.requestContractLink(`ghost-${Date.now()}@test.local`)
    expect(Object.keys(unknown).sort(), 'شكلُ الجواب يفرّق بين الحالَين')
      .toEqual(Object.keys(known).sort())
    expect(unknown.ok, 'الجوابُ يقول «لا عقدَ لك» فيُعَدّ كشفا').toBe(true)
  })

  it('ولا يُكتب أثرٌ لبريدٍ لا عقدَ له — فلا سجلَّ يُبنى بالتخمين', async () => {
    await review.requestContractLink(`ghost2-${Date.now()}@test.local`)
    const evs = await prisma.auditEvent.findMany({
      where: { action: 'trainer.contract.link_requested', entityId: '' },
    })
    expect(evs.length).toBe(0)
  })
})

describe('③ والموقَّعُ لا يُسكّ له رمزٌ جديد', () => {
  /* ═══ ولمَ يُستثنى ═══

     رابطُ من وقّع باقٍ يفتح نسختَه الموقَّعة (#351). فسكُّ غيرِه يُميت
     الباقيَ بلا حاجة، ويُعطي حاملَ البريد بابا إلى وثيقةٍ تمّت. ومن ضاع
     رابطُه بعد التوقيع يقرأ عقدَه في بوّابته بعد التفعيل. */
  it('⚠️ عقدٌ وُقّع لا يتبدّل رمزُه ولا يُكتب له أثرُ استعادة', async () => {
    const { contractId, email, before } = await openContract('signed')
    expect(before.status, 'السقالةُ لم توقّع العقدَ — فالقياسُ لا يقول شيئا').toBe('signed')

    const res = await review.requestContractLink(email)
    expect(res.ok, 'رُدّ الطلبُ بخطأٍ يكشف أنّ للبريد عقدا موقَّعا').toBe(true)

    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contractId } })
    expect(after.tokenHash, 'سُكّ رمزٌ جديدٌ لعقدٍ وُقّع، فمات رابطُ نسخته').toBe(before.tokenHash)
    expect(await auditOf(contractId), 'كُتب أثرُ استعادةٍ لعقدٍ وُقّع').toBeNull()
  })

  it('ورابطُ الموقَّع يبقى يفتح نسختَه بعد طلبٍ كهذا', async () => {
    const { token, email } = await openContract('signed')
    await review.requestContractLink(email)
    const view = await review.contractByToken(token)
    expect((view as { state?: string }).state, 'مات رابطُ من وقّع بطلبٍ لا يخصّه').toBe('signed')
  })
})
