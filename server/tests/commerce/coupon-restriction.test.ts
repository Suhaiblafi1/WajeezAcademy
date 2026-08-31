/* كوبونٌ أُعطي لواحدٍ لا يستعمله مئة.

   خصمُ المستشار المعتمَد يُنتج كوبونا مقصورا على عميلٍ بعينه. والقصرُ
   الذي لا يُفحص عند الاستعمال زينةٌ في القاعدة: يكفي أن يقرأ العميلُ
   رمزه — وهو يراه في فاتورته — ويرسله إلى عشرة، فيصير خصمٌ اعتمدته
   الإدارةُ لحالةٍ واحدة خصما عامّا لم يعتمده أحد.

   والفحصُ كان مكرّرا في ثلاثة مواضع (خطّة، سلّة، شعبةٌ واحدة) بثلاث نسخٍ
   متطابقة — فأيُّ شرطٍ يُضاف في واحدٍ منها يُنسى في اثنين. فوُحّد في
   دالّةٍ واحدة، وهذا الاختبار يحرس الثلاثة معا. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { assertCouponUsable } from '../../services/commerce.service'

let prisma: PrismaClient
let ownerId: string
let strangerId: string

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const owner = await prisma.user.create({
    data: { email: 'coupon-owner@test.local', passwordHash: 'x', displayName: 'صاحبة الكوبون' },
  })
  ownerId = owner.id
  const stranger = await prisma.user.create({
    data: { email: 'coupon-stranger@test.local', passwordHash: 'x', displayName: 'غريب' },
  })
  strangerId = stranger.id
})

const base = {
  id: 'c1', code: 'ADV-TEST', percentOff: 10, amountOff: null, currency: null,
  maxUses: 1, usedCount: 0, expiresAt: null, active: true, restrictedToUserId: null,
}

describe('صلاحية الكوبون', () => {
  it('١) الكوبون العامّ يمرّ لأيّ أحد — السلوك القديم لا يتغيّر', () => {
    expect(() => assertCouponUsable({ ...base }, strangerId)).not.toThrow()
  })

  it('٢) المقصورُ يمرّ لصاحبه', () => {
    expect(() => assertCouponUsable({ ...base, restrictedToUserId: ownerId }, ownerId)).not.toThrow()
  })

  it('٣) ولا يمرّ لغيره', () => {
    expect(() => assertCouponUsable({ ...base, restrictedToUserId: ownerId }, strangerId))
      .toThrowError(/ليس لحسابك/)
  })

  it('٤) والمعطَّل والمنتهي والمستنفَد كما كانوا', () => {
    expect(() => assertCouponUsable({ ...base, active: false }, ownerId)).toThrowError(/غير صالح/)
    expect(() => assertCouponUsable({ ...base, expiresAt: new Date(Date.now() - 1000) }, ownerId)).toThrowError(/منتهي/)
    expect(() => assertCouponUsable({ ...base, maxUses: 1, usedCount: 1 }, ownerId)).toThrowError(/استنفد/)
  })

  it('٥) وغيابُ الكوبون يُردّ برسالةٍ لا بانهيار', () => {
    expect(() => assertCouponUsable(null, ownerId)).toThrowError(/غير صالح/)
  })

  it('٦) الفحصُ موحَّدٌ في مواضع الشراء الثلاثة — لا ثلاث نسخ', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync('server/services/commerce.service.ts', 'utf8')
    const inline = src.match(/coupon\.expiresAt && coupon\.expiresAt < new Date\(\)/g) ?? []
    expect(inline.length, 'عاد الفحصُ منسوخا في موضعٍ آخر — فسيُنسى فيه شرط').toBe(1)
    expect((src.match(/assertCouponUsable\(coupon, /g) ?? []).length, 'ليست كلُّ مواضع الشراء تستدعي الفحص').toBe(3)
  })
})
