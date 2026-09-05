/* سقفُ مبلغ الباقة — «إمّا ٣٠٪ أو ٦٠٠، أيّهما أقلّ».

   وأخطرُ ما فيه ليس الحسابَ بل **أين يُطبَّق**. فسقفٌ على المسارات الجاهزة
   وحدَها يقلب المعنى: خمسُ دوراتٍ غاليةٍ يبنيها المتعلّم بنفسه = ٦٣٠، ومسارٌ
   جاهزٌ بستِّ دوراتٍ = ٦٠٠ — **فمن اشترى أقلَّ دفع أكثر**. فالسقفُ على كلّ
   سلّة بقرار صاحب المنصّة، وهو ما يحرسه هذا الملفّ.

   ومعه حارسان لا يمسّان الحساب:
     · أنّ السقفَ مبلغٌ لا نسبة، فلا معنى له بلا عملة — وأنّ الكتالوجَ كلَّه
       بعملته، وإلّا فالرقمُ يُطبَّق على عملةٍ أخرى فيصير ضعفَ السعر أو عُشرَه.
     · وأنّ الصعودَ باقٍ بعد نزول السلّم إلى ٣٠: إضافةُ دورةٍ لا تُخفض ما
       يُدفع، على مدى أسعار الكتالوج كلِّه لا على مثال. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  MAX_BUNDLE_TOTAL, MAX_BUNDLE_TOTAL_CURRENCY, bundlePayable, buildDiscountPct, MAX_BUILT_COURSES,
} from '../../application/commerce/discount-policy'

const CORE = JSON.parse(
  readFileSync(join(process.cwd(), 'src/data/catalog/core-catalog.v2.json'), 'utf8'),
) as { courses: { course_id: string; list_price: number; list_currency: string }[] }

const PRICES = [...new Set(CORE.courses.map((c) => c.list_price))].sort((a, b) => a - b)
const CHEAPEST = PRICES[0]
const DEAREST = PRICES[PRICES.length - 1]

describe('سقفُ مبلغ الباقة', () => {
  it('لا سلّةَ تتجاوز السقفَ مهما بلغ مجموعُها', () => {
    for (let n = 1; n <= 12; n += 1) {
      const separate = DEAREST * n
      expect(bundlePayable(separate, n), `${n} دورة`).toBeLessThanOrEqual(MAX_BUNDLE_TOTAL)
    }
  })

  it('ويُطبَّق على السلّة الحرّة كما على المسار الجاهز — وإلّا دفع من اشترى أقلَّ أكثر', () => {
    /* أغلى ما يبنيه المتعلّم بنفسه (خمس دورات) في مقابل مسارٍ جاهزٍ بستّ */
    const topFive = PRICES.slice().reverse()
    const free = topFive[0] * 1 + DEAREST * (MAX_BUILT_COURSES - 1)
    const built = bundlePayable(free, MAX_BUILT_COURSES)
    const ready = bundlePayable(DEAREST * 6, 6)
    expect(built, 'بناءٌ حرٌّ من خمسٍ يتجاوز مسارا جاهزا من ستّ').toBeLessThanOrEqual(ready)
  })

  it('ولا يمسّ ما دونه — فالسلّمُ يبقى هو القاعدةَ لجمهور السلال', () => {
    const separate = CHEAPEST * 3
    expect(bundlePayable(separate, 3)).toBe(Math.round(separate * (1 - buildDiscountPct(3) / 100)))
  })

  it('ولا يُطبَّق على عملةٍ غير عملته — «٦٠٠» في عملةٍ أخرى رقمٌ بلا معنى', () => {
    const separate = DEAREST * 10
    expect(bundlePayable(separate, 10, MAX_BUNDLE_TOTAL_CURRENCY)).toBe(MAX_BUNDLE_TOTAL)
    expect(bundlePayable(separate, 10, 'SAR'), 'طُبِّق سقفُ دولارٍ على عملةٍ أخرى')
      .toBeGreaterThan(MAX_BUNDLE_TOTAL)
  })

  it('والكتالوجُ كلُّه بعملة السقف — وإلّا فالسقفُ يسقط صامتا عن بعضه', () => {
    const others = [...new Set(CORE.courses.map((c) => c.list_currency))].filter((c) => c !== MAX_BUNDLE_TOTAL_CURRENCY)
    expect(others, 'دوراتٌ بعملةٍ لا يشملها السقف').toEqual([])
  })

  it('وإضافةُ دورةٍ لا تُخفض ما يُدفع — على مدى أسعار الكتالوج كلِّه', () => {
    /* أسوأُ حالةٍ ممكنة: سلّةٌ كلُّها أغلى دورة، ثمّ تُضاف أرخصُ دورة */
    for (let n = 1; n <= 8; n += 1) {
      const before = bundlePayable(DEAREST * n, n)
      const after = bundlePayable(DEAREST * n + CHEAPEST, n + 1)
      expect(after, `${n} ← ${n + 1}: من زاد دورةً دفع أقلّ`).toBeGreaterThanOrEqual(before)
    }
  })
})
