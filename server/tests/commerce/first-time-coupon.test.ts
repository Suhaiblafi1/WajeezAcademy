/* كود التشجيع WA2026 — رقمان في ملفين يجب ألا يفترقا.

   الواجهة تعرض النسبة من FIRST_TIME_PROMO، والفوترة تقرؤها من صفّ Coupon في
   القاعدة. ولا شيء يربطهما إلا هذا الاختبار: لو غُيِّرت نسبة الواجهة وحدها لصار
   المعروض على الشاشة غير المخصوم في الفاتورة، ولو حُذف الصفّ لرفض
   approveEnrollmentRequest الكودَ بـ«الكوبون غير صالح» بعد أن وعدت به الصفحة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { FIRST_TIME_PROMO, priceAfterPromo, isFirstTimePromo } from '../../../src/application/commerce/first-time-promo'

let prisma: PrismaClient

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
}, 180_000)

describe('كود أول عملية شراء', () => {
  it('موجود في القاعدة وفعّال', async () => {
    const c = await prisma.coupon.findUnique({ where: { code: FIRST_TIME_PROMO.code } })
    expect(c, `لا صفّ Coupon بالرمز ${FIRST_TIME_PROMO.code} — الواجهة تعرض كودا لا تعرفه الفوترة`).not.toBeNull()
    expect(c!.active).toBe(true)
    expect(c!.expiresAt).toBeNull()
  })

  it('نسبته في القاعدة تطابق نسبته في الواجهة', async () => {
    const c = await prisma.coupon.findUniqueOrThrow({ where: { code: FIRST_TIME_PROMO.code } })
    expect(c.percentOff).toBe(FIRST_TIME_PROMO.percentOff)
  })

  it('حساب الواجهة يطابق حساب الفوترة على نفس المبلغ', async () => {
    const c = await prisma.coupon.findUniqueOrThrow({ where: { code: FIRST_TIME_PROMO.code } })
    for (const price of [391, 500, 550, 600, 103]) {
      /* صيغة commerce.service: round(price * percentOff / 100 * 100) / 100 خصمًا */
      const billingDiscount = Math.round((price * c.percentOff!) / 100 * 100) / 100
      expect(priceAfterPromo(price)).toBe(Math.round(price - billingDiscount))
    }
  })

  it('المطابقة بلا حساسية للحالة ولا للفراغات', () => {
    expect(isFirstTimePromo(' wa2026 ')).toBe(true)
    expect(isFirstTimePromo('WA-2026')).toBe(false)
  })
})
