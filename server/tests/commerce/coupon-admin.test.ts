/* تعديلُ الكوبون وإيقافُه وحذفُه (٢٦ أكتوبر ٢٠٢٦).

   «لماذا لا أستطيع أن أعدّل أو أحذف كودا معيّنا؟» (صاحب المنصّة). وكان الكوبونُ يُنشأ ولا يُمسّ بعدها.
   ① كوبونُنا يُعدَّل: نسبتُه أو مبلغُه وسقفُه وانتهاؤه — نسبةٌ أو مبلغٌ لا الاثنان، والسقفُ لا يقلّ عمّا استُعمل.
   ② وأيُّ كوبونٍ يُوقَف ويُشغَّل — وكودُ المنحة لا تُعدَّل نسبتُه من هنا.
   ③ ويُحذف ما لم يُستعمل، وما استُعمل يُردّ حذفُه. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { CommerceService } from '../../services/commerce.service'

const ACTOR = '00000000-0000-0000-0000-000000000009'
let prisma: PrismaClient
let commerce: CommerceService

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  commerce = new CommerceService(prisma)
}, 240_000)

const coupon = (code: string, extra: Record<string, unknown> = {}) =>
  commerce.createCoupon(ACTOR, { code, percentOff: 20, ...extra })

describe('① كوبوننا يعدل', () => {
  it('⚠️ نسبته وسقفه وانتهاؤه — ويقرأ بعدها كما عدل', async () => {
    const c = await coupon('EDIT-ME-1')
    const out = await commerce.updateCoupon(ACTOR, c.id, { percentOff: 35, maxUses: 10, expiresAt: new Date('2099-01-01') })
    expect(out.percentOff).toBe(35)
    expect(out.maxUses).toBe(10)
    expect(out.expiresAt?.toISOString().slice(0, 10)).toBe('2099-01-01')
  })

  it('ومن النسبة إلى المبلغ — لا الاثنان معا', async () => {
    const c = await coupon('EDIT-ME-2')
    const out = await commerce.updateCoupon(ACTOR, c.id, { percentOff: null, amountOff: 15 })
    expect(out.percentOff).toBeNull()
    expect(Number(out.amountOff)).toBe(15)
    await expect(commerce.updateCoupon(ACTOR, c.id, { percentOff: 10 })).rejects.toMatchObject({ code: 'bad_coupon' })
  })

  it('والسقف لا يقل عما استعمل', async () => {
    const c = await coupon('EDIT-ME-3')
    await prisma.coupon.update({ where: { id: c.id }, data: { usedCount: 4 } })
    await expect(commerce.updateCoupon(ACTOR, c.id, { maxUses: 3 })).rejects.toMatchObject({ code: 'bad_coupon' })
    expect((await commerce.updateCoupon(ACTOR, c.id, { maxUses: 4 })).maxUses).toBe(4)
  })
})

describe('② ويوقف ويشغل', () => {
  it('⚠️ أي كوبون — وكود المنحة لا تعدل نسبته من هنا', async () => {
    const c = await coupon('GRANT-LIKE-1', { percentOff: 60 })
    await prisma.grantCode.create({ data: { couponId: c.id, ...(await grantFields()) } })
    expect((await commerce.updateCoupon(ACTOR, c.id, { active: false })).active).toBe(false)
    expect((await commerce.updateCoupon(ACTOR, c.id, { active: true })).active).toBe(true)
    await expect(commerce.updateCoupon(ACTOR, c.id, { percentOff: 90 })).rejects.toMatchObject({ code: 'coupon_linked' })
    await expect(commerce.deleteCoupon(ACTOR, c.id)).rejects.toMatchObject({ code: 'coupon_linked' })
  })
})

describe('③ ويحذف ما لم يستعمل', () => {
  it('⚠️ لم يستعمل: يحذف ويسجل أثره', async () => {
    const c = await coupon('DELETE-ME-1')
    await commerce.deleteCoupon(ACTOR, c.id)
    expect(await prisma.coupon.findUnique({ where: { id: c.id } })).toBeNull()
    expect(await prisma.auditEvent.count({ where: { action: 'coupon.delete', entityId: c.id } })).toBe(1)
  })

  it('⚠️ واستعمل: يرد حذفه ويبقى', async () => {
    const c = await coupon('DELETE-ME-2')
    await prisma.coupon.update({ where: { id: c.id }, data: { usedCount: 1 } })
    await expect(commerce.deleteCoupon(ACTOR, c.id)).rejects.toMatchObject({ code: 'coupon_used' })
    expect(await prisma.coupon.findUnique({ where: { id: c.id } })).not.toBeNull()
  })
})

/** كودُ المنحة يلزمه حملتُه — حملةٌ للاختبار وحدَه */
async function grantFields() {
  const campaign = await prisma.grantCampaign.create({ data: { slug: `coupon-admin-${Date.now()}`, nameAr: 'حملة اختبار' } })
  return { campaignId: campaign.id }
}
