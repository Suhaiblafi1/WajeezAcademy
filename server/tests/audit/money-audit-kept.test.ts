/* أثرُ المال لا يُقلَّم — كأثر العقد (١٠ نوفمبر ٢٠٢٦، قرارُ صاحب المنصّة «a»).

   كان التقليمُ يحذف بعد سنتين كلَّ أثرٍ إلّا العقودَ والعروض، ومنه ما لا يُكتب في غيره: من أكّد صرفَ مستحقّ المدرّب
   والمستشار، ومن كشف رقمَ حسابه وغيّره، ومن نفّذ ردّا أو رفضه، ومن سجّل دفعةً يدويّة. والعلّةُ في
   `src/application/audit/retention.ts`. ويُشيَّخ هنا صفٌّ من كلّ عائلةٍ وشاهدٌ من خارجها، ويُجرى التقليمُ فعلا. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { enforceRetention, RETENTION_DAYS } from '../../worker/jobs'
import { isPermanentAuditAction } from '../../../src/application/audit/retention'

let prisma: PrismaClient
const STAMP = Date.now()

const MONEY = [
  'payment.record_manual', 'payment.charge', 'refund.process', 'refund.reject',
  'trainer_payout.pay', 'trainer_payout.approve', 'advisor_payout.pay',
  'trainer.bank.reveal', 'trainer.bank.set', 'advisor.bank.reveal', 'influencer.payout',
]

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
}, 240_000)

describe('أثر المال يبقى أبدا', () => {
  it('⚠️ بعد سنتين: يبقى أثر المال كله — ويقلم ما سواه', async () => {
    const old = new Date(Date.now() - (RETENTION_DAYS.audit + 30) * 86_400_000)
    const entity = `money-audit-${STAMP}`
    for (const action of [...MONEY, 'cohort.update']) {
      await prisma.auditEvent.create({ data: { action, entityType: 'test', entityId: entity, createdAt: old } })
    }
    await enforceRetention(prisma)
    const left = (await prisma.auditEvent.findMany({ where: { entityId: entity }, select: { action: true } })).map((r) => r.action)
    for (const action of MONEY) expect(left, `قلم أثر ${action}`).toContain(action)
    expect(left, 'لم يقلم الشاهد — فالتقليم لم يجر').not.toContain('cohort.update')
  })

  it('والبادئة لا تبتلع ما يشبه اسمها', () => {
    expect(isPermanentAuditAction('influencer.payout')).toBe(true)
    expect(isPermanentAuditAction('influencer.payouts_viewed')).toBe(false)
    expect(isPermanentAuditAction('influencer.update')).toBe(false)
    expect(isPermanentAuditAction('payment.extra')).toBe(true)
  })
})
