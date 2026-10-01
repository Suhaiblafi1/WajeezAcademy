/* ═══ كلُّ رابطٍ يقول حالَ عقده بدقّة — حيّا كان أو قديما (١ أكتوبر ٢٠٢٦) ═══

   طلبُ صاحب المنصّة: «when someone has expired link, they know the exact
   reason whether expired or signed… for the signed ones, they should still
   see the contract locked for reading».

   وكان رابطُ العقد يُقرأ من `tokenHash` الحيّ وحدَه، فكلُّ رابطٍ قديمٍ يُقال له
   «غيرُ صالح»، وكلُّ عقدٍ جاوز «وُقّع» — اعتمدناه، أو أزاحه أحدثُ منه، أو
   انتهى — يُقال لرابطه «انتهى هذا الرابط: إمّا اعتُذر أو سُحب أو…».

   ① كلُّ بابٍ يصرف رمزا يحفظه — فالقديمُ بعده يقول «أرسلنا أحدث» لا «غيرُ صالح».
   ② والقديمُ لا يُفتَح للتوقيع أبدا.
   ③ والأجلُ المنقضي يُقال بتاريخه — وأبعد التذكير الأخير هو أم لا.
   ④ وما وُقّع يُقرأ مقفلا في كلّ حالٍ بعده: ينتظرنا، ونافذٌ، وأزاحه أحدث، وانتهى.
   ⑤ والرابطُ القديمُ يقرأ النسخةَ إن ذهب إلى بريد صاحبها — وإلّا فالحالُ وحدَها.
   ⑥ والملغى يقول من جاء بعده — ولا متنَ ولا سببَ على بابٍ لم يُوقَّع.
   ⑦ والإلغاءُ بعد التوقيع يقول لماذا: إعادةٌ على نصٍّ محدَّث، أو توقيعٌ لم يُعتمَد.
   ⑧ وكلُّ `mintContractToken` في الخدمة يتبعه حفظُه — على البنية. */

import { beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { contractAcks } from '../../../src/application/trainer/contract-body'
import { RESIGN_REVOKE_REASON_AR } from '../../../src/application/trainer/contract-resign'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let adminId = ''
let seq = 0

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const tokenOf = (url: string) => decodeURIComponent(url.split('/c/')[1])
const BODY = 'نصُّ اتفاقيّةٍ للاختبار — البند 1 وما بعده، وله سطرٌ ثانٍ.'
const ACKS = contractAcks(false).map((a) => a.key)

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  adminId = (await auth.register('linkstate-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')).userId
  await auth.setRoles(adminId, ['academic_manager'])
}, 240_000)

/** عرضٌ مرسَلٌ برمزه الحيّ — على مدرّبٍ نشط، فلا شرطَ ولا مهلةَ موادّ */
async function sentContract() {
  seq += 1
  const email = `linkstate-${seq}-${Date.now()}@test.local`
  const app = await prisma.trainerApplication.create({
    data: {
      reference: `TR-LS-${Date.now()}-${seq}`, fullName: `مدرّبٌ ${seq}`, email,
      status: 'active', motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: app.id, isVerified: true } })
  const contract = await prisma.trainerContract.create({
    data: {
      profileId: profile.id, title: `اتفاقيّةُ اختبارٍ ${seq}`, status: 'draft',
      bodyVersion: 'v-test', bodyAr: BODY, bodyHash: sha256(BODY),
      requiredDocuments: [], signerEmail: email, gatesActivation: false,
    },
  })
  const sent = await review.sendContract(contract.id, adminId)
  return { contract, profile, email, token: tokenOf(sent.signingUrl) }
}

const sign = (token: string) => review.signContractByToken(token, {
  legalName: 'سارة عبد الله الحربي', addressAr: 'عمّان — الدوّار السابع', phone: '+962790000000',
  bodyHash: sha256(BODY), acks: [...ACKS],
})

/** وقّعه من رمزه الحيّ — ويُعاد ذلك الرمز */
async function signedContract() {
  const s = await sentContract()
  await sign(s.token)
  return s
}

describe('① كلُّ بابٍ يصرف رمزا يحفظه — فالقديمُ يقول «أرسلنا أحدث»', () => {
  const PATHS: { name: string; renew: (s: Awaited<ReturnType<typeof sentContract>>) => Promise<unknown> }[] = [
    { name: '«جدِّدِ الرابط»', renew: (s) => review.resendContract(s.contract.id, adminId) },
    { name: 'التذكيرُ الأخير', renew: (s) => review.sendFinalReminder(s.contract.id, adminId) },
    { name: 'طلبُه ببريده', renew: (s) => review.requestContractLink(s.email) },
    {
      name: 'جوابُ طلب التعديل',
      renew: async (s) => {
        await review.requestContractAmendment(s.token, 'أرجو مراجعةَ البند الرابع فالمهلةُ قصيرة')
        await review.replyToAmendment(s.contract.id, adminId, 'البندُ يبقى كما هو — وهذا سببُه')
      },
    },
  ]
  for (const p of PATHS) {
    it(`⚠️ بعد ${p.name}: الرابطُ القديمُ «أرسلنا أحدث» برقم العقد — لا «غيرُ صالح»`, async () => {
      const s = await sentContract()
      await p.renew(s)
      const view = await review.contractByToken(s.token)
      expect(view.state, `بعد ${p.name} قيل للرابط القديم غيرُ حاله`).toBe('replaced')
      if (view.state !== 'replaced') return
      expect(view.number, 'لا رقمَ على الباب').toBe(s.contract.number)
      expect(view.newerLinkAt, 'لا يقول متى أُرسل الأحدث').toBeTruthy()
      expect(view.bodyAr, 'عُرض نصُّ عرضٍ مفتوحٍ على رابطٍ قديم').toBeNull()
    })
  }
})

describe('② والقديمُ لا يُفتَح للتوقيع أبدا', () => {
  it('⚠️ لا يُوقَّع منه — فالكتابةُ من الحيّ وحدَه', async () => {
    const s = await sentContract()
    await review.resendContract(s.contract.id, adminId)
    await expect(sign(s.token), 'وُقّع من رابطٍ استُبدل').rejects.toMatchObject({ code: 'invalid_token' })
    const row = await prisma.trainerContract.findUniqueOrThrow({ where: { id: s.contract.id } })
    expect(row.status).toBe('sent')
  })

  it('ورمزٌ لا يعرفه السجلُّ يبقى «غيرَ صالح»', async () => {
    await expect(review.contractByToken('x'.repeat(43))).rejects.toMatchObject({ code: 'invalid_token' })
  })
})

describe('③ والأجلُ المنقضي يُقال بتاريخه', () => {
  it('⚠️ الحيُّ بعد أجله: «انقضى» بتاريخه — ولم يسبقه تذكيرٌ أخير', async () => {
    const s = await sentContract()
    const at = new Date(Date.now() - 60_000)
    await prisma.trainerContract.update({ where: { id: s.contract.id }, data: { tokenExpiresAt: at } })
    const view = await review.contractByToken(s.token)
    expect(view.state).toBe('expired')
    if (view.state !== 'expired') return
    expect(view.expiredAt?.getTime(), 'لا يقول متى انقضى').toBe(at.getTime())
    expect(view.afterFinalReminder).toBe(false)
    expect(view.number).toBe(s.contract.number)
  })

  it('⚠️ وبعد التذكير الأخير يقول ذلك — فلا يُدعى إلى طلب رابطٍ لن يصله', async () => {
    const s = await sentContract()
    const r = await review.sendFinalReminder(s.contract.id, adminId)
    await prisma.trainerContract.update({
      where: { id: s.contract.id }, data: { tokenExpiresAt: new Date(Date.now() - 60_000) },
    })
    const live = await review.contractByToken(tokenOf(r.signingUrl))
    expect(live.state === 'expired' && live.afterFinalReminder, 'لم يُقَل إنّه سقط بعد التذكير الأخير').toBe(true)
    /* ورابطُه الأوّلُ كذلك: العرضُ نفسُه سقط، لا أنّ رابطا أحدثَ بُعث فحسب */
    const old = await review.contractByToken(s.token)
    expect(old.state, 'قيل للرابط الأوّل «أرسلنا أحدث» وقد سقط العرضُ كلُّه').toBe('expired')
  })
})

describe('④ وما وُقّع يُقرأ مقفلا في كلّ حالٍ بعده', () => {
  it('⚠️ ينتظر اعتمادَنا: «وُقّع» ونسختُه', async () => {
    const s = await signedContract()
    const view = await review.contractByToken(s.token)
    expect(view.state).toBe('signed')
    if (view.state !== 'signed') return
    expect(view.bodyAr, 'لا نسخةَ على باب الموقَّع').toBe(BODY)
    expect(view.number).toBe(s.contract.number)
  })

  it('⚠️ اعتمدناه: «نافذ» ونسختُه — لا «انتهى هذا الرابط»', async () => {
    const s = await signedContract()
    await review.countersignContract(s.contract.id, adminId)
    const view = await review.contractByToken(s.token)
    expect(view.state, 'من خُتم عقدُه قيل له إنّ رابطه انتهى').toBe('countersigned')
    if (view.state !== 'countersigned') return
    expect(view.countersignedAt, 'لا يقول متى اعتُمد').toBeTruthy()
    expect(view.bodyAr, 'لا نسخةَ على باب العقد النافذ').toBe(BODY)
  })

  it('⚠️ أزاحه أحدثُ منه: يقول رقمَ الأحدث، ونسختُه باقيةٌ له', async () => {
    const s = await signedContract()
    await review.countersignContract(s.contract.id, adminId)
    const newer = await prisma.trainerContract.create({
      data: { profileId: s.profile.id, title: 'العقدُ الأحدث', status: 'countersigned', sentAt: new Date() },
    })
    await prisma.trainerContract.update({
      where: { id: s.contract.id },
      data: { status: 'superseded', supersededAt: new Date(), supersededByContractId: newer.id },
    })
    const view = await review.contractByToken(s.token)
    expect(view.state).toBe('superseded')
    if (view.state !== 'superseded') return
    expect(view.successor?.number, 'لا يقول أيُّ عقدٍ حلّ محلَّه').toBe(newer.number)
    expect(view.bodyAr).toBe(BODY)
  })

  it('⚠️ وانتهى: يقول متى، ونسختُه باقيةٌ له', async () => {
    const s = await signedContract()
    await review.countersignContract(s.contract.id, adminId)
    const at = new Date()
    await prisma.trainerContract.update({
      where: { id: s.contract.id }, data: { status: 'terminated', terminatedAt: at },
    })
    const view = await review.contractByToken(s.token)
    expect(view.state).toBe('terminated')
    if (view.state !== 'terminated') return
    expect(view.terminatedAt?.getTime()).toBe(at.getTime())
    expect(view.bodyAr).toBe(BODY)
  })
})

describe('⑤ والرابطُ القديمُ بعد التوقيع', () => {
  it('⚠️ إلى بريد صاحبه: يقول «وُقّع» ويعرض نسختَه، ويقول إنّه قديم', async () => {
    const s = await sentContract()
    const renewed = await review.resendContract(s.contract.id, adminId)
    await sign(tokenOf(renewed.signingUrl))
    const view = await review.contractByToken(s.token)
    expect(view.state, 'من نقر رسالتَه الأولى بعد التوقيع قيل له غيرُ حاله').toBe('signed')
    if (view.state !== 'signed') return
    expect(view.newerLinkAt, 'لم يُقَل إنّه رابطٌ قديم').toBeTruthy()
    expect(view.detailed).toBe(true)
    expect(view.bodyAr, 'لا نسخةَ على رابطه الأوّل وهو صاحبُها').toBe(BODY)
  })

  it('⚠️ إلى بريدٍ غيرِ بريده: الحالُ وحدَها — لا نسخةَ ولا اسم', async () => {
    const s = await sentContract()
    const renewed = await review.resendContract(s.contract.id, adminId)
    await sign(tokenOf(renewed.signingUrl))
    /* الرابطُ الأوّلُ ذهب إلى بريدٍ صُحّح بعده — كمن كُتب بريدُه خطأً أوّلَ مرّة */
    await prisma.trainerContractLink.update({
      where: { tokenHash: sha256(s.token) }, data: { sentTo: 'typo-of-the-first-address@test.local' },
    })
    const view = await review.contractByToken(s.token)
    expect(view.state).toBe('signed')
    if (view.state !== 'signed') return
    expect(view.detailed).toBe(false)
    expect(view.bodyAr, 'قرأ عقدَه من وصله البريدُ الخطأ').toBeNull()
    expect(view.signerLegalName, 'قرأ اسمَه القانونيَّ من وصله البريدُ الخطأ').toBeNull()
  })
})

describe('⑥ والملغى يقول من جاء بعده — بلا متنٍ ولا سبب', () => {
  it('⚠️ يقول رقمَ العقد الذي أُرسل بعده', async () => {
    const s = await sentContract()
    const REASON = 'أُرسل بأجرٍ خاطئ'
    await review.revokeContract(s.contract.id, adminId, REASON)
    const next = await prisma.trainerContract.create({
      data: {
        profileId: s.profile.id, title: 'العقدُ المصحَّح', status: 'sent', sentAt: new Date(),
        replacesContractId: s.contract.id,
      },
    })
    const view = await review.contractByToken(s.token)
    expect(view.state).toBe('revoked')
    if (view.state !== 'revoked') return
    expect(view.successor?.number, 'لا يقول ما الذي يُعتمَد بعده').toBe(next.number)
    expect(view.revokedAt).toBeTruthy()
    const seen = JSON.stringify(view)
    expect(seen, 'سُكب متنُ عرضٍ لم يُوقَّع').not.toContain(BODY.slice(0, 30))
    expect(seen, 'سُرّب سببُ الإلغاء إلى الباب').not.toContain(REASON)
  })

  it('ولا يُذكَر بعده بديلٌ لم يخرج إليه بعد', async () => {
    const s = await sentContract()
    await review.revokeContract(s.contract.id, adminId, 'أُرسل بأجرٍ خاطئ')
    await prisma.trainerContract.create({
      data: { profileId: s.profile.id, title: 'مسوّدةٌ لم تُرسَل', status: 'draft', replacesContractId: s.contract.id },
    })
    const view = await review.contractByToken(s.token)
    expect(view.state === 'revoked' && view.successor, 'سُمّيت له مسوّدةٌ لم تصله').toBeNull()
  })
})

describe('⑦ والإلغاءُ بعد التوقيع يقول لماذا — ونسختُه باقيةٌ له', () => {
  it('⚠️ أُعيد إليه على نصٍّ محدَّث', async () => {
    const s = await signedContract()
    await prisma.trainerContract.update({
      where: { id: s.contract.id },
      data: { status: 'revoked', revokedAt: new Date(), revokeReasonAr: RESIGN_REVOKE_REASON_AR },
    })
    const view = await review.contractByToken(s.token)
    expect(view.state).toBe('revoked')
    if (view.state !== 'revoked') return
    expect(view.revokedForResign, 'لم يُقَل إنّه أُعيد على نصٍّ محدَّث').toBe(true)
    expect(view.bodyAr, 'لا نسخةَ لمن وقّع').toBe(BODY)
  })

  it('⚠️ ولم يُعتمَد توقيعُه: يُقال ذلك لا «أُعيد»', async () => {
    const s = await signedContract()
    await review.rejectSignature(s.contract.id, adminId, 'الاسمُ لا يطابق وثيقةَ الهويّة')
    const view = await review.contractByToken(s.token)
    expect(view.state).toBe('revoked')
    if (view.state !== 'revoked') return
    expect(view.revokedForResign).toBe(false)
    expect(view.signedAt, 'لا يُعرف أنّه وقّع').toBeTruthy()
    expect(view.bodyAr).toBe(BODY)
  })
})

describe('⑧ وكلُّ رمزٍ يُصرف يُحفَظ — على البنية', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
  const SRC = readFileSync(join(root, 'server/services/trainer-review.service.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  /** أجسامُ الدوالّ التي تصرف رمزا — من رأس الدالّة إلى رأس التي تليها */
  function minters(): { name: string; body: string }[] {
    const heads = [...SRC.matchAll(/^ {2}(?:private )?async (\w+)\(/gm)]
    return heads
      .map((m, i) => ({ name: m[1], body: SRC.slice(m.index!, heads[i + 1]?.index ?? SRC.length) }))
      .filter((f) => f.body.includes('this.mintContractToken('))
  }

  it('⚠️ كلُّ دالّةٍ تصرف رمزا تحفظه', () => {
    const found = minters()
    expect(found.length, 'لم يُقرأ موضعٌ يصرف رمزا — فالحارسُ يقيس الفراغ').toBeGreaterThanOrEqual(5)
    for (const f of found) {
      expect(f.body, `«${f.name}» يصرف رمزا ولا يحفظه — فيُقال لرابطه القديم «غيرُ صالح»`)
        .toContain('this.rememberContractLink(')
    }
  })
})
