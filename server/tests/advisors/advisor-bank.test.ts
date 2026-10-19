/* حسابُ المستشار البنكيّ لعمولته (١٩ أكتوبر ٢٠٢٦) — قرارُ صاحب المنصّة: «A»، والعلّةُ في رأس
   `advisor-bank.service.ts`.

   ① **يُحفظ معمّى** — لا رقمَ صريحا في الصفّ ولا في الجواب ولا في الأثر.
   ② **ومطابقةُ الاسم تُقال ولا تمنع** — اسمُه في المنصّة.
   ③ **ولا يُكتب بلا إقرار، ولا بقيمةٍ مقنَّعة، ولا لغير مستشار، ولا لموقوف.**
   ④ **وفعّالٌ واحدٌ لكلّ مستشار** — ولو كُتب مرّتين معا.
   ⑤ **والظرفُ مربوطٌ بصاحبه** — لا يُفكّ على غيره ولا بباب المدرّب.
   ⑥ **والكشفُ لكشفٍ معتمَدٍ وحدَه** — ويُكتب بلا رقم.
   ⑦ **ولا صرفَ قبل كشف، ولا بعد تبديل.**
   ⑧ **والإلغاءُ يُزيحه ولا يمحوه.** */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { AdvisorBankService } from '../../services/advisor-bank.service'
import { AdvisorPayoutService } from '../../services/advisor-payout.service'
import {
  BANK_KEY_ENV, advisorBankAad, bankAad, openBankValue, resetBankKeyCacheForTests, sealBankValue,
} from '../../services/bank-crypto'

let prisma: PrismaClient
let auth: AuthService
let bank: AdvisorBankService
let payouts: AdvisorPayoutService
let financeId = ''
let savedKey: string | undefined
let seq = 0

const KEY = 'c'.repeat(64)
const IBAN = 'JO94CBJO0010000000000131000302'
const input = (over: Record<string, unknown> = {}) => ({
  iban: IBAN, holderName: 'سارة أحمد المصري', bankNameAr: 'البنك العربي', ownNameConfirmed: true, ...over,
})

async function advisor(name = 'سارة أحمد المصري') {
  const { userId } = await auth.register(`bank-adv-${++seq}@test.local`, 'Advisor#12345', name)
  await auth.setRoles(userId, ['advisor'])
  return userId
}
/** كشفٌ لمستشارٍ بحاله — بلا دفعات: ما يُختبر هنا الحسابُ لا البنود */
const payout = (advisorId: string, status = 'approved') =>
  prisma.advisorPayout.create({ data: { advisorId, period: `2025-${String((++seq % 12) + 1).padStart(2, '0')}`, status, commissionPct: 10, total: 25 } })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  bank = new AdvisorBankService(prisma)
  payouts = new AdvisorPayoutService(prisma)
  savedKey = process.env[BANK_KEY_ENV]
  process.env[BANK_KEY_ENV] = KEY
  resetBankKeyCacheForTests()
  financeId = (await auth.register('bank-finance@test.local', 'Finance#12345', 'المالية')).userId
  await auth.setRoles(financeId, ['finance'])
}, 240_000)

afterAll(() => {
  if (savedKey === undefined) delete process.env[BANK_KEY_ENV]
  else process.env[BANK_KEY_ENV] = savedKey
  resetBankKeyCacheForTests()
})

describe('① يُحفظ معمّى', () => {
  it('⚠️ لا رقمَ صريحا في الصفّ ولا في الجواب ولا في الأثر', async () => {
    const a = await advisor()
    const out = await bank.setMine(a, input())
    expect(JSON.stringify(out)).not.toContain(IBAN)
    expect(out.maskedAr).toBe('JO ····0302')
    const row = await prisma.advisorBankAccount.findFirstOrThrow({ where: { userId: a, status: 'active' } })
    expect(JSON.stringify(row)).not.toContain(IBAN)
    expect(openBankValue(row.ibanSealed, advisorBankAad(a))).toBe(IBAN)
    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'advisor.bank.set', entityId: a } })
    expect(JSON.stringify(audit)).not.toContain(IBAN)
    expect(JSON.stringify(await bank.mine(a))).not.toContain(IBAN)
  })
})

describe('② مطابقةُ الاسم تُقال ولا تمنع', () => {
  it('⚠️ باسمه في المنصّة يطابق، وبغيره يُحفظ ويُقال', async () => {
    const same = await advisor('سارة أحمد المصري')
    expect((await bank.setMine(same, input())).outcome).toBe('matches')
    const other = await advisor('ليلى خالد')
    const out = await bank.setMine(other, input({ holderName: 'شركة النور للتجارة' }))
    expect(out.outcome).toBe('differs')
    expect(out.outcomeSaidAr).toContain('يختلف')
  })
})

describe('③ ما لا يُكتب', () => {
  it('⚠️ بلا إقرار، وبقيمةٍ مقنَّعة، ولغير مستشار، ولموقوف', async () => {
    const a = await advisor()
    await expect(bank.setMine(a, input({ ownNameConfirmed: false }))).rejects.toMatchObject({ code: 'not_own_name' })
    await expect(bank.setMine(a, input({ iban: 'JO ····0302' }))).rejects.toMatchObject({ code: 'masked_value' })
    const { userId: learner } = await auth.register(`bank-learner-${++seq}@test.local`, 'Learner#12345', 'متعلم')
    await expect(bank.setMine(learner, input())).rejects.toMatchObject({ code: 'not_advisor' })
    await prisma.user.update({ where: { id: a }, data: { status: 'suspended' } })
    await expect(bank.setMine(a, input())).rejects.toMatchObject({ code: 'not_active' })
    await expect(bank.removeMine(a)).rejects.toMatchObject({ code: 'not_active' })
    expect((await bank.mine(a)).writeProblemAr).toBeTruthy()
    expect(await prisma.advisorBankAccount.count({ where: { userId: a } })).toBe(0)
  })
})

describe('④ فعّالٌ واحدٌ لكلّ مستشار', () => {
  it('⚠️ التبديلُ يُزيح القديم — ونقرتان معا لا تتركان حسابين', async () => {
    const a = await advisor()
    await bank.setMine(a, input())
    await bank.setMine(a, input({ iban: 'JO71CBJO0000000000001234567890' }))
    expect(await prisma.advisorBankAccount.count({ where: { userId: a, status: 'active' } })).toBe(1)
    expect(await prisma.advisorBankAccount.count({ where: { userId: a, status: 'superseded' } })).toBe(1)

    const b = await advisor()
    await Promise.allSettled([bank.setMine(b, input()), bank.setMine(b, input()), bank.setMine(b, input())])
    expect(await prisma.advisorBankAccount.count({ where: { userId: b, status: 'active' } })).toBe(1)
  })
})

describe('⑤ الظرفُ مربوطٌ بصاحبه', () => {
  it('⚠️ ظرفُ مستشارٍ نُقل إلى غيره لا يُفكّ — ولا ظرفُ المدرّب ببابه', async () => {
    const a = await advisor()
    const b = await advisor()
    await bank.setMine(a, input())
    await bank.setMine(b, input({ iban: 'JO71CBJO0000000000001234567890' }))
    const sealedA = (await prisma.advisorBankAccount.findFirstOrThrow({ where: { userId: a, status: 'active' } })).ibanSealed
    await prisma.advisorBankAccount.updateMany({ where: { userId: b, status: 'active' }, data: { ibanSealed: sealedA } })
    const p = await payout(b)
    await expect(bank.revealForPayout(p.id, financeId)).rejects.toMatchObject({ code: 'bank_open_failed' })

    expect(() => openBankValue(sealBankValue(IBAN, bankAad(a)), advisorBankAad(a))).toThrow()
  })
})

describe('⑥ الكشفُ لكشفٍ معتمَدٍ وحدَه', () => {
  it('⚠️ لا على كشفٍ ينتظر الاعتماد، ولا بلا حساب — ويُكتب بلا رقم', async () => {
    const a = await advisor()
    const noAccount = await payout(a)
    await expect(bank.revealForPayout(noAccount.id, financeId)).rejects.toMatchObject({ code: 'no_bank_account' })
    await bank.setMine(a, input())
    const pending = await payout(a, 'pending')
    await expect(bank.revealForPayout(pending.id, financeId)).rejects.toMatchObject({ code: 'bad_state' })

    const out = await bank.revealForPayout(noAccount.id, financeId)
    expect(out.iban).toBe(IBAN)
    const row = await prisma.advisorBankAccount.findFirstOrThrow({ where: { userId: a, status: 'active' } })
    expect(row.lastRevealAt).not.toBeNull()
    expect((await prisma.advisorPayout.findUniqueOrThrow({ where: { id: noAccount.id } })).bankAccountId).toBe(row.id)
    expect(Object.keys(out)).not.toContain('ibanSealed')
    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'advisor.bank.reveal', entityId: a } })
    expect(JSON.stringify(audit)).not.toContain(IBAN)
    expect((audit.meta as { payoutId?: string }).payoutId).toBe(noAccount.id)
  })
})

describe('⑦ لا صرفَ قبل كشف، ولا بعد تبديل', () => {
  it('⚠️ يُردّ التأكيدُ بلا كشف، ثمّ بعد تبديل الحساب — ويُقبل بعد كشفٍ جديد', async () => {
    const a = await advisor()
    await bank.setMine(a, input())
    const p = await payout(a)
    await expect(payouts.markPaid(p.id, financeId)).rejects.toMatchObject({ code: 'no_reveal' })
    await bank.revealForPayout(p.id, financeId)
    await bank.setMine(a, input({ iban: 'JO71CBJO0000000000001234567890' }))
    await expect(payouts.markPaid(p.id, financeId)).rejects.toMatchObject({ code: 'bank_account_changed' })
    await bank.revealForPayout(p.id, financeId)
    await payouts.markPaid(p.id, financeId, 'TR-9')
    expect((await prisma.advisorPayout.findUniqueOrThrow({ where: { id: p.id } })).status).toBe('paid')
  })
})

describe('⑧ الإلغاءُ يُزيحه ولا يمحوه', () => {
  it('⚠️ لا حسابَ فعّالا بعده، والصفُّ باقٍ — ولا يُصرف حتّى يكتب غيرَه', async () => {
    const a = await advisor()
    await bank.setMine(a, input())
    const p = await payout(a)
    await bank.revealForPayout(p.id, financeId)
    expect(await bank.removeMine(a)).toEqual({ removed: true })
    expect((await bank.mine(a)).account).toBeNull()
    expect(await prisma.advisorBankAccount.count({ where: { userId: a, status: 'superseded' } })).toBe(1)
    expect(await prisma.auditEvent.count({ where: { action: 'advisor.bank.remove', entityId: a } })).toBe(1)
    await expect(payouts.markPaid(p.id, financeId)).rejects.toMatchObject({ code: 'bank_account_changed' })
  })
})
