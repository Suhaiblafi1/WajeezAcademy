/* أيستحقّ المدرّبُ الصرفَ الآن؟ — وحسابُه يُكشف قبل الصرف في الشاشة (١٩ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «ندفع للمدرّب بعد أن ينتهي من تقديم الدورات … خاصّيّةٌ تقول لي إنّه انتهى
   من تقديم كافّة اللقاءات الحيّة على الأقلّ، أو انتهت الدورةُ كاملةً وأُغلقت — يستحقّ الدفعَ الآن».
   والعلّةُ في رأس `src/application/trainer/pay-readiness.ts`.

   ① **بقي لقاءٌ حيّ — لم يحن.** ② **انتهت لقاءاتُه كلُّها — يستحقّ، ولو لم تُغلق الشعبة.**
   ③ **أُغلقت الشعبة — يستحقّ.** ④ **والكشفُ اليدويّ يُقال إنّه يدويّ.**
   ⑤ **ومتى يُعتمد بعد مهلة الاعتراض.** ⑥ **وحسابُه مقنَّعا، وهل كُشف لهذا الكشف — بلا رقمٍ صريح.** */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { EarningsService } from '../../services/earnings.service'
import { TrainerBankService } from '../../services/trainer-bank.service'
import { BANK_KEY_ENV, resetBankKeyCacheForTests } from '../../services/bank-crypto'
import { PAYOUT_OBJECTION_DAYS } from '../../../src/application/trainer/notice-periods'

let prisma: PrismaClient
let earnings: EarningsService
let adminId = ''
let savedKey: string | undefined
let seq = 0

const DAY = 86_400_000
const IBAN = 'JO94CBJO0010000000000131000302'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  earnings = new EarningsService(prisma)
  const auth = new AuthService(prisma)
  adminId = (await auth.register('ready-admin@test.local', 'Admin#12345', 'المالية')).userId
  await auth.setRoles(adminId, ['finance'])
  savedKey = process.env[BANK_KEY_ENV]
  process.env[BANK_KEY_ENV] = 'e'.repeat(64)
  resetBankKeyCacheForTests()
}, 240_000)

afterAll(() => {
  if (savedKey === undefined) delete process.env[BANK_KEY_ENV]
  else process.env[BANK_KEY_ENV] = savedKey
  resetBankKeyCacheForTests()
})

async function profile() {
  seq += 1
  const app = await prisma.trainerApplication.create({
    data: {
      reference: `TR-RDY-${Date.now()}-${seq}`, fullName: `مدرب ${seq}`, email: `ready-${seq}-${Date.now()}@test.local`,
      status: 'active', motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  return prisma.trainerProfile.create({ data: { applicationId: app.id } })
}
/** شعبةٌ بلقاءاتٍ بحالاتها — `done` انتهى، `scheduled` لم يبدأ، `cancelled` أُلغي */
async function cohort(status: string, sessions: string[]) {
  const c = await prisma.cohort.create({
    data: {
      courseId: 'C-BIZ-101', title: `شعبة الصرف ${++seq}`, status, registrationOpen: false, financialReady: true,
      price: 100, currency: 'USD', capacity: 20, startsAt: new Date(Date.now() - 30 * DAY),
    },
  })
  for (const [i, st] of sessions.entries()) {
    await prisma.cohortSession.create({ data: { cohortId: c.id, title: `لقاء ${i + 1}`, startsAt: new Date(Date.now() - (20 - i) * DAY), status: st } })
  }
  return c
}
async function payout(profileId: string, sourceRef: string | null, status = 'pending') {
  return prisma.trainerPayout.create({
    data: {
      profileId, period: '2026-09', status, total: 100, currency: 'USD',
      items: { create: [{ description: 'أتعاب الشعبة', amount: 100, sourceRef }] },
    },
  })
}
const row = async (id: string) => (await earnings.listAll()).find((p) => p.id === id)!

describe('أيستحقّ الصرفَ الآن', () => {
  it('⚠️ ① بقي لقاءٌ حيّ والشعبةُ لم تُغلق — لم يحن', async () => {
    const c = await cohort('active', ['done', 'done', 'scheduled', 'cancelled'])
    const p = await payout((await profile()).id, `cohort:${c.id}`)
    const r = await row(p.id)
    expect(r.ready).toBe(false)
    expect(r.readiness[0]).toMatchObject({ sessionsTotal: 3, sessionsDone: 2, sessionsLeft: 1, ready: false })
    expect(r.readiness[0]!.saidAr).toContain('لم يحن الصرف')
  })

  it('⚠️ ② انتهت لقاءاتُه الحيّةُ كلُّها — يستحقّ ولو لم تُغلق الشعبة', async () => {
    const c = await cohort('active', ['done', 'done', 'cancelled'])
    const p = await payout((await profile()).id, `cohort:${c.id}:referral`)
    const r = await row(p.id)
    expect(r.ready).toBe(true)
    expect(r.readiness[0]!.saidAr).toContain('يستحق الصرف الآن')
  })

  it('⚠️ ③ أُغلقت الشعبة — يستحقّ', async () => {
    const c = await cohort('completed', ['done', 'scheduled'])
    const p = await payout((await profile()).id, `cohort:${c.id}`)
    expect((await row(p.id)).ready).toBe(true)
  })

  it('⚠️ ④ والكشفُ اليدويُّ بلا شعبة لا يُحكم عليه', async () => {
    const p = await payout((await profile()).id, null)
    const r = await row(p.id)
    expect(r.ready).toBeNull()
    expect(r.readiness).toEqual([])
  })

  it('⚠️ ⑤ ومتى يُعتمد — بعد مهلة الاعتراض من ظهوره', async () => {
    const p = await payout((await profile()).id, null)
    expect(new Date((await row(p.id)).approvableFrom).getTime()).toBe(p.createdAt.getTime() + PAYOUT_OBJECTION_DAYS * DAY)
  })
})

describe('⑥ وحسابُه في الشاشة قبل الصرف', () => {
  it('⚠️ مقنَّعا بلا رقم، ثمّ «كُشف» بعد كشفه لهذا الكشف', async () => {
    const prof = await profile()
    const app = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: prof.applicationId } })
    const auth = new AuthService(prisma)
    const { userId } = await auth.register(app.email, 'Trainer#12345', app.fullName)
    await prisma.trainerProfile.update({ where: { id: prof.id }, data: { userId } })
    await new TrainerBankService(prisma).setMine(userId, { iban: IBAN, holderName: app.fullName, bankNameAr: 'البنك العربي', ownNameConfirmed: true })
    const p = await payout(prof.id, null, 'approved')

    const before = await row(p.id)
    expect(before.bankAccount?.maskedAr).toBe('JO ····0302')
    expect(before.revealed).toBe(false)
    expect(JSON.stringify(before)).not.toContain(IBAN)

    await new TrainerBankService(prisma).revealForPayout(p.id, adminId)
    const after = await row(p.id)
    expect(after.revealed, 'لم يقل إنّه كُشف').toBe(true)
    expect(JSON.stringify(after)).not.toContain(IBAN)
    await earnings.markPaid(p.id, adminId)
    expect((await prisma.trainerPayout.findUniqueOrThrow({ where: { id: p.id } })).status).toBe('paid')
  })
})
