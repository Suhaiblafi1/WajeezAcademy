/* حسابُ المدرّب البنكيّ — ما يُحفظ، وما لا يخرج أبدا.

   ═══ وخمسةُ أعطابٍ يقيسها هذا الملفّ، وكلُّها تقع صامتة ═══

   ① **نصٌّ صريحٌ يُخزَّن حين يغيب المفتاح.** «تعميةٌ إن أمكن» تكتب الرقمَ
      كما هو ولا تقول شيئا — فيُقرأ من نسخةٍ احتياطيّةٍ بعد سنة.
   ② **وظرفٌ يُنقل من صفٍّ إلى صفّ.** بلا رباطٍ بصاحبه يُفكّ فيُعطي رقمَ
      حسابِ رجلٍ باسم رجلٍ آخر — وتُحوَّل الأموالُ إليه بلا خطإٍ ظاهر.
   ③ **والرقمُ يخرج في جوابٍ أو في أثر.** تعميةُ عمودٍ لا تنفع إن كان
      المسارُ يعيد الصريحَ إلى الشاشة أو يكتبه السجلُّ.
   ④ **وصفّان فعّالان لرجلٍ واحد.** فلا يُعرف إلى أيّهما يُصرَف.
   ⑤ **وصرفٌ يُؤكَّد على حسابٍ بُدِّل بعد كشفه** — بابُ الاحتيال في هذا
      الموضع بعينه.

   والفحصُ على **ما في القاعدة وما يخرج من الدوالّ** لا على ورودِ نصٍّ في
   ملفّ: يُقرأ العمودُ الخامُّ، ويُقابَل بالرقم الأصليّ. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { TrainerBankService } from '../../services/trainer-bank.service'
import { EarningsService } from '../../services/earnings.service'
import {
  BANK_KEY_ENV, bankAad, bankVaultEnabled, openBankValue, resetBankKeyCacheForTests, sealBankValue,
} from '../../services/bank-crypto'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let bank: TrainerBankService
let earnings: EarningsService
let adminId = ''

const KEY = 'a'.repeat(64)
const OTHER_KEY = 'b'.repeat(64)
const IBAN = 'JO94CBJO0010000000000131000302'
const BODY = 'نصُّ اتفاقيّةٍ للاختبار — البند 1 وما بعده.'
let savedKey: string | undefined

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  bank = new TrainerBankService(prisma)
  earnings = new EarningsService(prisma)
  savedKey = process.env[BANK_KEY_ENV]
  process.env[BANK_KEY_ENV] = KEY
  resetBankKeyCacheForTests()

  const admin = await auth.register('bank-admin@test.local', 'Admin#12345', 'المدير')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
}, 240_000)

afterAll(() => {
  if (savedKey === undefined) delete process.env[BANK_KEY_ENV]
  else process.env[BANK_KEY_ENV] = savedKey
  resetBankKeyCacheForTests()
})

let seq = 0

/** مدرّبٌ نشطٌ بعقدٍ نافذٍ باسمٍ قانونيٍّ معلوم */
async function mkTrainer(legalName = 'محمد علي حسن') {
  seq += 1
  const email = `bank-${seq}-${Date.now()}@test.local`
  const user = await auth.register(email, 'Pass#12345', `مدرّبٌ ${seq}`)
  const app = await prisma.trainerApplication.create({
    data: {
      reference: `TR-BK-${Date.now()}-${seq}`, fullName: `مدرّبٌ ${seq}`, email,
      status: 'contract_pending', motivation: 'اختبار', privacyConsentAt: new Date(),
      userId: user.userId,
    },
  })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: app.id } })
  const contract = await prisma.trainerContract.create({
    data: {
      profileId: profile.id, title: `اتفاقيّةٌ ${seq}`, status: 'signed',
      bodyVersion: 'v-test', bodyAr: BODY, signerEmail: email,
      signerLegalName: legalName, signedAt: new Date(), gatesActivation: true,
    },
  })
  await review.countersignContract(contract.id, adminId, {})
  return { app, profile, userId: user.userId }
}

const GOOD = { iban: IBAN, holderName: 'محمد علي حسن', bankNameAr: 'البنك العربيّ' }

/* ═══════════ ① الظرفُ نفسُه ═══════════ */

describe('التعميةُ تعمي فعلا وتُربَط بصاحبها', () => {
  it('⚠️ لا يظهر الرقمُ في العمود الخامّ — ولا جزءٌ منه', async () => {
    const t = await mkTrainer()
    await bank.setMine(t.userId, GOOD)
    const raw = await prisma.trainerBankAccount.findFirstOrThrow({
      where: { profileId: t.profile.id, status: 'active' },
    })
    expect(raw.ibanSealed, 'الرقمُ مكتوبٌ صريحا في العمود').not.toContain(IBAN)
    expect(raw.ibanSealed).not.toContain(IBAN.slice(4, 20))
    expect(raw.ibanSealed.startsWith('v1.'), 'ظرفٌ بلا إصدارٍ لا يُقرأ بعد تدوير').toBe(true)
    /* والطرفُ الأخيرُ وحدَه صريحٌ بقصد — يُعرَض ولا يكفي لحوالة */
    expect(raw.tail4).toBe(IBAN.slice(-4))
    expect(openBankValue(raw.ibanSealed, bankAad(t.profile.id))).toBe(IBAN)
  })

  it('⚠️ وظرفٌ نُقل إلى صفِّ غيره لا يُفكّ — ولا يُعطي رقمَ رجلٍ باسم آخر', async () => {
    const a = await mkTrainer()
    const b = await mkTrainer()
    const sealed = sealBankValue(IBAN, bankAad(a.profile.id))
    expect(() => openBankValue(sealed, bankAad(b.profile.id))).toThrow()
  })

  it('⚠️ ومفتاحٌ آخرُ لا يفكّ ما عُمّي بالأوّل', () => {
    const sealed = sealBankValue(IBAN, bankAad('p-1'))
    process.env[BANK_KEY_ENV] = OTHER_KEY
    resetBankKeyCacheForTests()
    expect(() => openBankValue(sealed, bankAad('p-1'))).toThrow()
    process.env[BANK_KEY_ENV] = KEY
    resetBankKeyCacheForTests()
  })

  it('وكلُّ كتابةٍ ظرفٌ جديد — فلا يُستدلّ بتكرار النصّ على تكرار الرقم', () => {
    const one = sealBankValue(IBAN, bankAad('p-1'))
    const two = sealBankValue(IBAN, bankAad('p-1'))
    expect(one).not.toBe(two)
  })

  it('⚠️ وبلا مفتاحٍ تُطفأ الخانةُ ولا يُخزَّن صريحٌ قطّ', async () => {
    const t = await mkTrainer()
    delete process.env[BANK_KEY_ENV]
    resetBankKeyCacheForTests()
    expect(bankVaultEnabled()).toBe(false)
    await expect(bank.setMine(t.userId, GOOD)).rejects.toThrow()
    expect(await prisma.trainerBankAccount.count({ where: { profileId: t.profile.id } })).toBe(0)
    process.env[BANK_KEY_ENV] = KEY
    resetBankKeyCacheForTests()
  })

  it('ومفتاحٌ بصيغةٍ خاطئةٍ كغيابه — لا يُقبَل نصفُ مفتاح', () => {
    process.env[BANK_KEY_ENV] = 'abc123'
    resetBankKeyCacheForTests()
    expect(bankVaultEnabled()).toBe(false)
    process.env[BANK_KEY_ENV] = KEY
    resetBankKeyCacheForTests()
  })
})

/* ═══════════ ② ما يخرج إلى الشاشة وإلى الأثر ═══════════ */

describe('ولا يخرج الرقمُ في جوابٍ ولا في أثر', () => {
  it('⚠️ «حسابي» لا يحمل الرقمَ — ولا أيَّ حقلٍ يقاربه', async () => {
    const t = await mkTrainer()
    await bank.setMine(t.userId, GOOD)
    const mine = await bank.mine(t.userId)
    const asText = JSON.stringify(mine)
    expect(asText, 'خرج الرقمُ الصريحُ إلى بوّابته').not.toContain(IBAN)
    expect(mine.account?.maskedAr).toContain(IBAN.slice(-4))
    expect(mine.account?.maskedAr).not.toContain(IBAN.slice(0, 10))
  })

  it('⚠️ وأثرُ الكتابة بلا رقم', async () => {
    const t = await mkTrainer()
    await bank.setMine(t.userId, GOOD)
    const rows = await prisma.auditEvent.findMany({
      where: { action: 'trainer.bank.set', entityId: t.profile.id },
    })
    expect(rows.length).toBe(1)
    expect(JSON.stringify(rows[0].meta), 'كُتب الرقمُ في السجلّ').not.toContain(IBAN)
  })

  it('⚠️ ومفتاحٌ اسمُه iban في الأثر يُمحى وإن مرّ سهوا', async () => {
    const { recordAudit } = await import('../../services/audit')
    await recordAudit(prisma, {
      actorId: adminId, action: 'trainer.bank.set',
      entityType: 'trainer_profile', entityId: 'probe-forbidden',
      meta: { iban: IBAN, beneficiary: 'فلان', tail4: '0302' },
    })
    const row = await prisma.auditEvent.findFirstOrThrow({ where: { entityId: 'probe-forbidden' } })
    const meta = row.meta as Record<string, unknown>
    expect(String(meta.iban), 'مرّ الرقمُ إلى السجلّ من مفتاحٍ اسمُه iban').not.toContain(IBAN)
    expect(String(meta.beneficiary)).not.toContain('فلان')
    /* ولا يُمحى ما ليس سرّا — وإلّا صار السجلُّ فارغا لا محروسا */
    expect(meta.tail4).toBe('0302')
  })

  it('والقيمةُ المقنَّعةُ تُردّ كتابةً — فلا تُكتب فوق السرّ الحقيقيّ', async () => {
    const t = await mkTrainer()
    await bank.setMine(t.userId, GOOD)
    await expect(bank.setMine(t.userId, { ...GOOD, iban: 'JO ····0302' })).rejects.toThrow()
    const raw = await prisma.trainerBankAccount.findFirstOrThrow({
      where: { profileId: t.profile.id, status: 'active' },
    })
    expect(openBankValue(raw.ibanSealed, bankAad(t.profile.id))).toBe(IBAN)
  })
})

/* ═══════════ ③ نسخةٌ فعّالةٌ واحدة ═══════════ */

describe('الفعّالُ واحدٌ، والقديمُ يُزاح ولا يُمحى', () => {
  it('⚠️ التبديلُ يترك صفّا فعّالا واحدا — والسابقُ يبقى مُزاحا', async () => {
    const t = await mkTrainer()
    await bank.setMine(t.userId, GOOD)
    await bank.setMine(t.userId, { ...GOOD, iban: 'JO94CBJO0010000000000131009999' })
    const rows = await prisma.trainerBankAccount.findMany({ where: { profileId: t.profile.id } })
    expect(rows.length, 'مُحي القديمُ — ولا يُعرف إلى أين ذهب مستحقٌّ قديم').toBe(2)
    expect(rows.filter((r) => r.status === 'active').length).toBe(1)
    expect(rows.find((r) => r.status === 'superseded')?.supersededAt).toBeTruthy()
  })

  it('⚠️ والفهرسُ الجزئيُّ قائمٌ في القاعدة فعلا — لا في المخطَّط وحدَه', async () => {
    /* Prisma لا تعبّر عن `WHERE` في `@@unique`، فالفهرسُ في الهجرة يدا.
       و`prisma migrate dev` تُسقطه صامتةً — فيُقرأ من `pg_indexes` لا
       من الملفّ، وإلّا مرّ الحارسُ على ضمانٍ لم يعد موجودا. */
    const idx = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'TrainerBankAccount' AND indexname = 'TrainerBankAccount_one_active'
    `
    expect(idx.length, 'سقط الفهرسُ الجزئيُّ — ويصير لرجلٍ واحدٍ حسابان فعّالان').toBe(1)
  })
})

/* ═══════════ ④ مطابقةُ الاسم — تُقال ولا تمنع ═══════════ */

describe('اسمُ المستفيد يُقابَل باسم الموقِّع', () => {
  it('المطابقُ يُعلَن مطابقا', async () => {
    const t = await mkTrainer('محمد علي حسن')
    const saved = await bank.setMine(t.userId, GOOD)
    expect(saved.outcome).toBe('matches')
  })

  it('⚠️ والمختلفُ يُعلَن مختلفا ولا يُمنع — فالحفظُ يقع', async () => {
    const t = await mkTrainer('محمد علي حسن')
    const saved = await bank.setMine(t.userId, { ...GOOD, holderName: 'شركةُ فلانٍ للتجارة' })
    expect(saved.outcome).toBe('differs')
    expect(await prisma.trainerBankAccount.count({
      where: { profileId: t.profile.id, status: 'active' },
    }), 'مُنع الحفظُ — والمنعُ يظلم من تغيّر اسمُه').toBe(1)
  })

  it('واختلافُ الهمزةِ والتاءِ المربوطة ليس اختلافَ اسم', async () => {
    const t = await mkTrainer('أحمد إبراهيم خليفة')
    const saved = await bank.setMine(t.userId, { ...GOOD, holderName: 'احمد ابراهيم خليفه' })
    expect(saved.outcome, 'حُسب اختلافا وهو رسمُ حرفٍ لا اسمٌ آخر').toBe('matches')
  })
})

/* ═══════════ ⑤ الكشفُ والصرف ═══════════ */

describe('لا صرفَ إلّا على حسابٍ كُشف لهذا المستحقّ', () => {
  async function mkPayout(profileId: string, status = 'approved') {
    return prisma.trainerPayout.create({
      data: { profileId, period: '2026-09', status, total: 100, currency: 'USD' },
    })
  }

  /** يُقاس **أيُّ** حارسٍ ردَّ، لا أنّ شيئا ردّ: حارسان متجاوران هنا
      (لا كشفَ · تبدّل الحساب)، ومن قاس الرميةَ وحدَها يمرّ عليه تعطيلُ
      أحدهما لأنّ الآخرَ التقطها — وهو نقضٌ جُرّب فمرّ فشُدّ الفحص. */
  async function codeOf(work: Promise<unknown>): Promise<string> {
    try { await work; return 'لم يُردّ' } catch (e) { return (e as { code?: string }).code ?? 'بلا رمز' }
  }

  it('⚠️ لا يُؤكَّد صرفٌ بلا كشف — وبالرمز الذي يخصّه', async () => {
    const t = await mkTrainer()
    await bank.setMine(t.userId, GOOD)
    const p = await mkPayout(t.profile.id)
    expect(await codeOf(earnings.markPaid(p.id, adminId))).toBe('no_reveal')
    const after = await prisma.trainerPayout.findUniqueOrThrow({ where: { id: p.id } })
    expect(after.status, 'أُكِّد صرفٌ إلى حسابٍ لم يُفتَح').toBe('approved')
  })

  it('والكشفُ يفتح الرقمَ مرّةً ويربطه بالمستحقّ ويكتب أثرَه', async () => {
    const t = await mkTrainer()
    await bank.setMine(t.userId, GOOD)
    const p = await mkPayout(t.profile.id)
    const shown = await bank.revealForPayout(p.id, adminId)
    expect(shown.iban).toBe(IBAN)
    const after = await prisma.trainerPayout.findUniqueOrThrow({ where: { id: p.id } })
    expect(after.bankAccountId).toBeTruthy()
    const trail = await prisma.auditEvent.findMany({
      where: { action: 'trainer.bank.reveal', entityId: t.profile.id },
    })
    expect(trail.length).toBe(1)
    expect((trail[0].meta as Record<string, unknown>).payoutId).toBe(p.id)
    expect(JSON.stringify(trail[0].meta), 'كُتب الرقمُ في أثر الكشف').not.toContain(IBAN)
    await earnings.markPaid(p.id, adminId)
    expect((await prisma.trainerPayout.findUniqueOrThrow({ where: { id: p.id } })).status).toBe('paid')
  })

  it('⚠️ ومن بدّل حسابَه بعد الكشف لا يُؤكَّد صرفُه على ما كُشف', async () => {
    const t = await mkTrainer()
    await bank.setMine(t.userId, GOOD)
    const p = await mkPayout(t.profile.id)
    await bank.revealForPayout(p.id, adminId)
    await bank.setMine(t.userId, { ...GOOD, iban: 'JO94CBJO0010000000000131007777' })
    expect(await codeOf(earnings.markPaid(p.id, adminId))).toBe('bank_account_changed')
  })

  it('ولا يُكشف حسابٌ لمستحقٍّ لم يُعتمَد بعد', async () => {
    const t = await mkTrainer()
    await bank.setMine(t.userId, GOOD)
    const p = await mkPayout(t.profile.id, 'pending')
    await expect(bank.revealForPayout(p.id, adminId)).rejects.toThrow()
  })

  it('ولا يُكشف ما لا وجودَ له — ويُقال إنّ المدرّبَ لم يُدخِلْه', async () => {
    const t = await mkTrainer()
    const p = await mkPayout(t.profile.id)
    await expect(bank.revealForPayout(p.id, adminId)).rejects.toThrow(/بوّابته/)
  })
})
