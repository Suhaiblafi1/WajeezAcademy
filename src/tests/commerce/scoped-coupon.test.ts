/* كودُ المدرّب على دوراته وحدَها — ما يحسبه `priceCart` حين يكون للكوبون نطاق.

   قرارُ صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦): «السقفُ ٣٠٪، لدوراته وحدَها، إن اشترى
   أحدٌ دوراتٍ أخرى مع مدرّبين غيره». والكودُ يُحسم من مستحقّاته — فكلُّ قرشٍ
   يخصمه على دورةِ غيره قرشٌ يدفعه عن مالٍ لا يقبضه.

   والمقيسُ ثلاثةٌ تقع صامتةً لو انكسرت:
   ① **النطاقُ يُحترم** — دوراتُ غيره في السلّة نفسِها لا يمسّها.
   ② **والكودُ بعد خصوم الأكاديميّة** — على حصّة دورته ممّا بقي بعد الباقة
      والسقف، لا على سعر القائمة: وإلّا خصم المتعلّمُ مرّتين عن الشيء نفسِه،
      وحُسم من المدرّب ما لم يمنحه.
   ③ **والكوبونُ العامُّ كما كان حرفا بحرف** — النطاقُ بابٌ جديدٌ لا تغييرٌ
      في القديم. */

import { describe, expect, it } from 'vitest'
import { priceCart, type CartLine } from '@/application/commerce/cart-pricing'

const line = (cohortId: string, listPrice: number, courseId = `C-${cohortId}`): CartLine => ({
  cohortId, courseId, titleAr: `دورة ${cohortId}`, listPrice,
})

describe('① النطاقُ يُحترم — دوراتُ غيره لا يمسّها', () => {
  it('⚠️ دورتُه ودورةُ غيره: الخصمُ على حصّة دورته وحدَها', () => {
    /* ٣٠٠ مجموعُ دورتين ← الباقةُ ٨٪ = ٢٤ ← يبقى ٢٧٦. حصّةُ دورته (١٠٠ من ٣٠٠)
       منه ٩٢، وعشرون بالمئة منها ١٨٫٤٠ — لا ستّون (٢٠٪ من ٣٠٠) ولا ٥٥٫٢٠
       (٢٠٪ من الباقي كلِّه). */
    const p = priceCart([line('his', 100), line('other', 200)], null, { percentOff: 20, amountOff: null, cohortIds: ['his'] })
    expect(p.bundleDiscount).toBe(24)
    expect(p.couponDiscount, 'الكودُ وقع على دورةِ غيره').toBe(18.4)
    expect(p.total).toBe(257.6)
    expect(p.couponLines).toBe(1)
    expect(p.lines.find((l) => l.cohortId === 'his')!.couponApplies).toBe(true)
    expect(p.lines.find((l) => l.cohortId === 'other')!.couponApplies, 'عُلّمت دورةُ غيره مخصومة').toBe(false)
  })

  it('⚠️ ولا شيءَ من دوراته في السلّة: لا خصم — ويُقال ذلك لا يُسكَت', () => {
    const p = priceCart([line('a', 100), line('b', 200)], null, { percentOff: 30, amountOff: null, cohortIds: ['his'] })
    expect(p.couponDiscount).toBe(0)
    expect(p.couponLines, 'الخادمُ يقرأ هذا الصفرَ فيردّ الكود بجملة').toBe(0)
  })

  it('⚠️ والهديّةُ لا يقع عليها — سعرُها صفرٌ فلا شيءَ يُخصم منه', () => {
    const p = priceCart(
      [line('his', 100, 'C-GIFT'), line('paid', 100)],
      'C-GIFT',
      { percentOff: 20, amountOff: null, cohortIds: ['his'] },
    )
    expect(p.couponLines, 'عُدّت الهديّةُ دورةً مخصومة').toBe(0)
    expect(p.couponDiscount).toBe(0)
    /* والعلامةُ نفسُها تُقرأ في لوح الدفع — هديّةٌ معلَّمةٌ «خصمها الكود»
       تقول للمشتري إنّ الكودَ عمل وهو لم يخصم شيئا */
    expect(p.lines.find((l) => l.cohortId === 'his')!.couponApplies, 'عُلّمت الهديّةُ مخصومةً بالكود').toBe(false)
  })
})

describe('② والكودُ بعد خصوم الأكاديميّة — لا على سعر القائمة', () => {
  it('⚠️ والسقفُ المبلغيُّ يُوزَّع على الدورات بنسبة أسعارها', () => {
    /* خمسُ دوراتٍ بمئتين = ١٠٠٠ ← الباقةُ ٣٠٪ = ٣٠٠ ← ٧٠٠ ← السقفُ (٦٠٠) يقتطع
       ١٠٠ ← يبقى ٦٠٠. حصّةُ دورته (٢٠٠ من ١٠٠٠) منه ١٢٠، وثلاثون بالمئة منها
       ٣٦ — لا ستّون (٣٠٪ من سعر قائمتها). */
    const lines = ['his', 'b', 'c', 'd', 'e'].map((id) => line(id, 200))
    const p = priceCart(lines, null, { percentOff: 30, amountOff: null, cohortIds: ['his'] })
    expect(p.bundleDiscount).toBe(300)
    expect(p.capDiscount).toBe(100)
    expect(p.couponDiscount, 'الكودُ حُسب على سعر القائمة لا على ما بقي').toBe(36)
    expect(p.total).toBe(1000 - 300 - 100 - 36)
  })

  it('ودوراتُه كلُّها في السلّة: حصّتُها ما بقي كلُّه', () => {
    const p = priceCart([line('h1', 100), line('h2', 100)], null, { percentOff: 10, amountOff: null, cohortIds: ['h1', 'h2'] })
    /* ٢٠٠ ← الباقةُ ٨٪ = ١٦ ← ١٨٤ ← عشرةٌ بالمئة ١٨٫٤٠ */
    expect(p.couponDiscount).toBe(18.4)
    expect(p.couponLines).toBe(2)
  })
})

describe('③ والكوبونُ العامُّ كما كان', () => {
  it('⚠️ بلا نطاقٍ يعمّ ما بقي بعد الباقة والسقف — والرقمُ نفسُه', () => {
    const p = priceCart([line('a', 100), line('b', 200)], null, { percentOff: 20, amountOff: null })
    /* ٢٠٪ من ٢٧٦ = ٥٥٫٢٠ — كما كان يُحسب قبل أن يكون للكوبون نطاق */
    expect(p.couponDiscount).toBe(55.2)
    expect(p.couponLines).toBe(2)
    expect(p.lines.every((l) => l.couponApplies)).toBe(true)
  })

  it('والمبلغُ لا يتجاوز ما بقي', () => {
    const p = priceCart([line('a', 50)], null, { percentOff: null, amountOff: 80 })
    expect(p.couponDiscount).toBe(50)
    expect(p.total).toBe(0)
  })

  it('وبلا كوبونٍ لا يُعلَّم بندٌ مخصوما', () => {
    const p = priceCart([line('a', 100)], null, null)
    expect(p.couponLines).toBe(0)
    expect(p.lines[0].couponApplies).toBe(false)
  })
})
