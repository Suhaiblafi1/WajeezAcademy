/* الكوبونات: تُعدَّل وتُوقَف وتُحذف — وذهب صندوقُ «خطة اشتراك جديدة» (٢٦ أكتوبر ٢٠٢٦).

   «لماذا لا أستطيع أن أعدّل أو أحذف كودا معيّنا؟.. وما الصندوق الذي على يسار الأكواد؟» (صاحب المنصّة).
   ① ما يُعدَّل هنا كوبوناتُنا وحدَها، ويُحذف منها ما لم يُستعمل — وأكوادُ المدرّبين والمنحة تُدار من صفحاتها.
   ② والصفحةُ تنادي التعديلَ والحذفَ فعلا، ولا تعرض «خطة اشتراك». والتعليقاتُ تُنزع قبل الفحص. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { couponKind, deletable, editableHere, type AdminCoupon } from '@/application/admin/coupons'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const base: AdminCoupon = { id: 'x', code: 'A', percentOff: 20, amountOff: null, currency: null, maxUses: null, usedCount: 0, active: true, expiresAt: null, _count: { orders: 0 } }

describe('① ما يعدل وما يحذف', () => {
  it('⚠️ كوبوننا يعدل ويحذف ما لم يستعمل', () => {
    expect(editableHere(base)).toBe(true)
    expect(deletable(base)).toBe(true)
    expect(deletable({ ...base, usedCount: 1 }), 'حذف مستعمل').toBe(false)
    expect(deletable({ ...base, _count: { orders: 1 } }), 'حذف ما في طلب').toBe(false)
  })

  it('⚠️ وأكواد المدربين والمنحة لا تعدل ولا تحذف هنا', () => {
    for (const c of [
      { ...base, grantCode: { id: 'g' } },
      { ...base, trainerCode: { percentOff: 15, amountOff: null, status: 'active' } },
      { ...base, trainerShareCode: { id: 's' } },
    ]) {
      expect(couponKind(c)).not.toBe('ours')
      expect(editableHere(c)).toBe(false)
      expect(deletable(c)).toBe(false)
    }
  })
})

describe('② الصفحة', () => {
  it('⚠️ تنادي التعديل والحذف فعلا', () => {
    const panel = code('src/components/admin/CouponsPanel.tsx')
    expect(panel).toMatch(/apiPatch\(`\/api\/admin\/coupons\/\$\{c\.id\}`/)
    expect(panel).toMatch(/apiDelete\(`\/api\/admin\/coupons\/\$\{c\.id\}`/)
    expect(code('src/pages/admin/Finance.tsx')).toMatch(/<CouponsPanel coupons=\{coupons\}/)
  })

  it('⚠️ ولا صندوق «خطة اشتراك»', () => {
    const finance = code('src/pages/admin/Finance.tsx')
    expect(finance).not.toContain('خطة اشتراك')
    expect(finance).not.toContain('/api/admin/subscription-plans')
  })
})
