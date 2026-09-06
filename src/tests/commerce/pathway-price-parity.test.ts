/* رقمُ الشاشة ورقمُ الفاتورة واحد — على المسارات العشرين لا على مثال.

   ── العطبُ الذي وُجد هذا الحارسُ من أجله ──

   صفحةُ المسار كانت تضرب **مجموعَ الستّ دورات** في نسبة الباقة. والخادمُ يفي
   بالهديّة فعلا (`cart.service.ts#giftFor`): بندُها بصفر، والسلّمُ على المدفوع
   وحدَه. فعلى مسارٍ نموذجيّ تعرض الشاشةُ ٦١٨ وتُصدر الفاتورةُ ٥٢٠.

   وبقي مستورا لأنّ الخطأ في جهة «أكثر»: نطلب على الشاشة أغلى ممّا نأخذ، فلا
   يشتكي أحد. لكنّه يبيع العرضَ بأضعفَ ممّا هو، ويجعل السطرَ المكتوب تحت
   الرقم — «وهو ما تُصدره الفاتورة» — غيرَ صحيح.

   ── ولماذا المقارنةُ بـ`priceCart` نفسِها لا برقمٍ مكتوب ──

   لأنّ الرقمَ المكتوب يتقادم: تتغيّر نسبةُ السلّم أو يُضاف سقفٌ فيبقى الفحصُ
   يوافق على قِيَمٍ ماتت. والمقارنةُ بالدالّة التي يناديها `checkout` تُمسك أيَّ
   افتراقٍ يأتي، لا الافتراقَ الذي عرفناه. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readyPathwayPrice } from '../../application/commerce/pathway-offer'
import { priceCart, type CartLine } from '../../application/commerce/cart-pricing'
import { readyPathwayCourseIds, courseById } from '../../data/courses'

const CORE = JSON.parse(
  readFileSync(join(process.cwd(), 'src/data/catalog/core-catalog.v2.json'), 'utf8'),
) as { launch_pathways: { id: string }[] }

/** أسعارُ القائمة كما تصل الشاشةَ من الشعب */
const priceOf = (id: string) => {
  const c = courseById(id)
  return typeof c?.listPrice === 'number' && c.listPrice > 0
    ? { amount: c.listPrice, currency: c.listCurrency ?? 'USD' }
    : null
}

/** الهديّةُ الافتراضيّة في الصفحة: آخرُ دورةٍ في المسار الجاهز */
const defaultGift = (ids: readonly string[]) => (ids.length > 0 ? ids[ids.length - 1] : null)

const linesFor = (ids: readonly string[]): CartLine[] =>
  ids.map((id, i) => ({
    cohortId: `co-${i}`, courseId: id, titleAr: id, listPrice: priceOf(id)!.amount,
  }))

describe('سعرُ المسار: الشاشةُ والفاتورة', () => {
  it('المسارات تُقرأ فعلا — الفحصُ ليس فارغا', () => {
    expect(CORE.launch_pathways.length).toBeGreaterThan(10)
  })

  it('ما تعرضه الصفحةُ هو ما تُصدره الفاتورة — لكلّ مسار', () => {
    for (const p of CORE.launch_pathways) {
      const ids = readyPathwayCourseIds(p.id)
      const gift = defaultGift(ids)
      const screen = readyPathwayPrice(ids, gift, priceOf)
      expect(screen, p.id).not.toBeNull()
      const invoice = priceCart(linesFor(ids), gift, null)
      expect(screen!.payable, `${p.id}: الشاشةُ تعرض ${screen!.payable} والفاتورةُ تُصدر ${invoice.total}`)
        .toBe(invoice.total)
    }
  })

  it('والمشطوبُ هو مجموعُ القائمة شاملا الهديّة — فيُرى ما وُفِّر', () => {
    for (const p of CORE.launch_pathways) {
      const ids = readyPathwayCourseIds(p.id)
      const gift = defaultGift(ids)
      const screen = readyPathwayPrice(ids, gift, priceOf)!
      const invoice = priceCart(linesFor(ids), gift, null)
      expect(screen.list, p.id).toBe(invoice.listTotal)
      expect(screen.list, `${p.id}: الوفرُ صفر — فالهديّةُ لم تُطرح`).toBeGreaterThan(screen.payable)
    }
  })

  it('والنسبةُ المعروضةُ تطابق الرقمين — لا رقما ثالثا', () => {
    for (const p of CORE.launch_pathways) {
      const ids = readyPathwayCourseIds(p.id)
      const s = readyPathwayPrice(ids, defaultGift(ids), priceOf)!
      expect(s.savedPct, p.id).toBe(Math.round((1 - s.payable / s.list) * 100))
      expect(s.savedPct, `${p.id}: نسبةٌ خارج المعقول`).toBeGreaterThan(0)
      expect(s.savedPct, p.id).toBeLessThan(100)
    }
  })

  it('ودورةٌ بلا سعر تُسقط المجموعَ كلَّه — لا مجموعَ ناقصٍ يُقرأ كاملا', () => {
    const ids = readyPathwayCourseIds(CORE.launch_pathways[0].id)
    const missing = (id: string) => (id === ids[0] ? null : priceOf(id))
    expect(readyPathwayPrice(ids, defaultGift(ids), missing)).toBeNull()
  })

  it('وبلا هديّة: المدفوعُ كلُّ الدورات — والحسابُ يبقى مطابقا', () => {
    const ids = readyPathwayCourseIds(CORE.launch_pathways[0].id)
    const screen = readyPathwayPrice(ids, null, priceOf)!
    expect(screen.payable).toBe(priceCart(linesFor(ids), null, null).total)
    expect(screen.list).toBe(screen.list)
  })
})
