/* بريدٌ مقابل كود خصم — بديل صندوق التسجيل الكامل المحذوف من صفحتي المسار
   والتشخيص. لا حسابا يُنشئ، ولا كلمة مرور — بريدٌ يُلتقط والكود نفسُه
   (FIRST_TIME_PROMO) يُعاد، لا رقما مختلقا في هذه الخدمة وحدها. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { FIRST_TIME_PROMO } from '../../../src/application/commerce/first-time-promo'
import { captureDiscountLead } from '../../services/leads.service'

let prisma: PrismaClient

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
}, 180_000)

describe('التقاط بريدٍ مقابل كود الخصم', () => {
  it('يكتب صفّا في MarketingLead ويعيد الكود المشترك', async () => {
    const email = `lead-${Date.now()}@example.com`
    const result = await captureDiscountLead(prisma, { email: ` ${email.toUpperCase()} `, source: 'pathway_discount', pathwayId: 'PW-COM-001' })
    expect(result.code).toBe(FIRST_TIME_PROMO.code)
    expect(result.percentOff).toBe(FIRST_TIME_PROMO.percentOff)

    /* البريد يُطبَّع (trim + lowercase) قبل الحفظ — لا يُكتب كما أُدخل حرفيا */
    const row = await prisma.marketingLead.findUnique({ where: { email } })
    expect(row, 'لم يُكتب الصفّ بالبريد المطبَّع').not.toBeNull()
    expect(row!.source).toBe('pathway_discount')
    expect(row!.pathwayId).toBe('PW-COM-001')
  })

  it('نداءٌ ثانٍ بنفس البريد يُحدِّث الصفّ لا يكرِّره', async () => {
    const email = `lead-repeat-${Date.now()}@example.com`
    await captureDiscountLead(prisma, { email, source: 'pathway_discount' })
    await captureDiscountLead(prisma, { email, source: 'diagnostic_discount', pathwayId: 'PW-COM-002' })

    const rows = await prisma.marketingLead.findMany({ where: { email } })
    expect(rows).toHaveLength(1)
    expect(rows[0].source).toBe('diagnostic_discount')
    expect(rows[0].pathwayId).toBe('PW-COM-002')
  })
})
