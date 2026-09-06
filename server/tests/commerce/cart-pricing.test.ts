/* ثلاثةُ وعودٍ كانت الصفحةُ تقولها والخادمُ لا يفي بها — وهذا حارسُها.

   العطبُ كان **مستورا** لأنّ الشراء يمرّ بنموذج «طلب تسجيل» يراجعه إنسانٌ
   ويُصدر الفاتورة بيده. وفي اللحظة التي يصير فيها الدفعُ مباشرا تُقتطع
   الأرقامُ من البطاقة، فيرى المشتري على صفحة المزوّد رقما غيرَ الموعود.

   والحارسُ هنا ليس على مثالٍ واحد بل على **المطابقة على مدى الأعداد ١…٦**:
   لأنّ خطأ السلّم لا يظهر عند عددٍ بعينه، بل عند العدد الذي لم يُجرَّب. */

import { describe, expect, it } from 'vitest'
import { priceCart, type CartLine } from '../../../src/application/commerce/cart-pricing'
import { buildDiscountPct, MAX_BUILT_COURSES, MAX_BUNDLE_TOTAL } from '../../../src/application/commerce/discount-policy'
import { PATHWAY_BUNDLE_MAX_PCT } from '../../../src/application/commerce/pathway-offer'

const lines = (n: number, price = 100): CartLine[] =>
  Array.from({ length: n }, (_, i) => ({
    cohortId: `co-${i}`, courseId: `C-${i}`, titleAr: `دورة ${i}`, listPrice: price,
  }))

describe('سلّمُ الباقة يُطبَّق لا يُعرض وحدَه', () => {
  /* الوعدُ على الشاشة: «خصم بناء المسار — ٢٠٪» و«كلما زادت دوراتك ارتفع
     خصمك». والخادمُ كان يحسب `subtotal − كوبون` ولا شيءَ غير ذلك. */
  it('على مدى ١…٦ يطابق الخصمُ المحسوبُ السلّمَ المعلَن — لا مثالا واحدا', () => {
    for (let n = 1; n <= 6; n += 1) {
      const p = priceCart(lines(n), null, null)
      const pct = buildDiscountPct(n)
      expect(p.bundlePct, `العدد ${n}`).toBe(pct)
      expect(p.subtotal, `العدد ${n}`).toBe(n * 100)
      expect(p.bundleDiscount, `العدد ${n}`).toBe((n * 100 * pct) / 100)
      expect(p.total, `العدد ${n}`).toBe(n * 100 - (n * 100 * pct) / 100)
    }
  })

  it('ودورةٌ واحدة بلا خصمِ باقة — الباقةُ باقةٌ لا اسمٌ لدورة', () => {
    expect(priceCart(lines(1), null, null).bundlePct).toBe(0)
  })

  it('ولا يهبط الخصمُ بإضافة دورة — وإلّا عاقبنا من زاد', () => {
    let prev = -1
    for (let n = 1; n <= 8; n += 1) {
      const pct = priceCart(lines(n), null, null).bundlePct
      expect(pct, `العدد ${n} أقلّ ممّا قبله`).toBeGreaterThanOrEqual(prev)
      prev = pct
    }
  })

  it('ويثبت عند السقف — ما بعد الخمس لا يزيد', () => {
    const cap = priceCart(lines(MAX_BUILT_COURSES), null, null).bundlePct
    expect(priceCart(lines(9), null, null).bundlePct).toBe(cap)
  })

  /* كان في الشيفرة رقمان لشيءٍ واحد: صفحةُ المسار تُعلن «يصل إلى ٢٥٪»
     (PATHWAY_BUNDLE_MAX_PCT) والسلّمُ يبلغ ٢٧ عند سقفه. وأحدُهما وعدٌ على
     الشاشة والآخر ما كان **سيُحسب** لو حُسب. */
  it('والمعلَنُ في صفحة المسار هو المطبَّق نفسُه — لا رقمان', () => {
    expect(PATHWAY_BUNDLE_MAX_PCT).toBe(buildDiscountPct(MAX_BUILT_COURSES))
    expect(priceCart(lines(MAX_BUILT_COURSES), null, null).bundlePct).toBe(PATHWAY_BUNDLE_MAX_PCT)
  })
})

describe('الهديّةُ تُحسم لا تُشار إليها', () => {
  /* `giftCourseId` كان رايةَ عرضٍ تُظهر شارةً في شاشة الخطّة، والدورةُ
     تُحاسَب بسعرها الكامل — أي أنّ «هديّة» كانت كلمةً في واجهةٍ فقط. */
  it('بندُ الهديّة بصفر، ولا يدخل المجموع', () => {
    const p = priceCart(lines(4), 'C-3', null)
    expect(p.lines.find((l) => l.courseId === 'C-3')!.unitPrice).toBe(0)
    expect(p.subtotal).toBe(300)
    expect(p.listTotal, 'سعرُ القائمة يبقى ظاهرا ليُرى ما وُفِّر').toBe(400)
  })

  it('ويبقى بندا في الفاتورة لا يُحذف — فالفاتورةُ ورقةُ الوعد الباقية', () => {
    const p = priceCart(lines(4), 'C-3', null)
    expect(p.lines).toHaveLength(4)
    expect(p.lines.filter((l) => l.isGift)).toHaveLength(1)
  })

  it('والسلّمُ على المدفوع لا على البنود — وإلّا خُصم مرّتين عن شيءٍ واحد', () => {
    /* أربعةُ بنودٍ أحدُها هديّة = ثلاثٌ مدفوعة، فالسلّمُ سلّمُ الثلاث */
    const p = priceCart(lines(4), 'C-3', null)
    expect(p.paidCount).toBe(3)
    expect(p.bundlePct).toBe(buildDiscountPct(3))
  })
})

describe('الكودُ فوق الناتج لا فوق الأصل', () => {
  /* سياسةُ الخصومات تقول حرفيّا: «كود واحد فوق الناتج». وتطبيقُه على
     `subtotal` يعطي خصما أكبر ممّا كُتب — وهو فرقٌ صامت لا يُرمى له خطأ. */
  it('١٠٪ تُحسب بعد خصم الباقة', () => {
    /* الأرقامُ مشتقّةٌ من السلّم لا مكتوبة: كانت ٢٦٤ و٢٦٫٤ و٢٣٧٫٦ محسوبةً
       على ١٢٪، فرفعُ درجةِ الثلاث كسر الاختبارَ بلا أن تنكسر النيّة. والنيّةُ
       واحدة: الكودُ فوق الناتج لا فوق الأصل. */
    const p = priceCart(lines(3), null, { percentOff: 10, amountOff: null })
    const afterBundle = 300 - (300 * buildDiscountPct(3)) / 100
    expect(p.couponDiscount, `١٠٪ من ${afterBundle} لا من ٣٠٠`).toBe(Math.round(afterBundle * 10) / 100)
    expect(p.total).toBe(Math.round((afterBundle - afterBundle / 10) * 100) / 100)
    /* ولو حُسب على الأصل لكان الخصمُ ٣٠ — فالفرقُ يُفحَص لا يُفترض */
    expect(p.couponDiscount).toBeLessThan(30)
  })

  it('وخصمٌ مقطوع لا يتجاوز الباقي — فلا مجموعٌ سالب', () => {
    const p = priceCart(lines(2), null, { percentOff: null, amountOff: 9999 })
    expect(p.total).toBe(0)
    expect(p.discount).toBe(p.subtotal)
  })

  it('والمجموعُ يساوي دائما الأصلَ ناقصَ الخصم — لا كسرٌ ضائع', () => {
    for (let n = 1; n <= 6; n += 1) {
      const p = priceCart(lines(n, 133.33), n >= 3 ? 'C-0' : null, { percentOff: 10, amountOff: null })
      expect(Math.round((p.subtotal - p.discount) * 100) / 100, `العدد ${n}`).toBe(p.total)
    }
  })
})

describe('سقفُ سعر المسار — بندٌ باسمه لا نسبةٌ مدموجة', () => {
  /* «إمّا ٣٠٪ أو ٦٠٠، أيّهما أقلّ» بقرار صاحب المنصّة. وأهمُّ ما فيه أنّه
     يبقى بندا مستقلّا: دمجُه في نسبة الباقة يُخرج رقما (٣٣٪ · ٤١٪) لا
     يقابله شيءٌ في السياسة، فيقرؤه المشتري وعدا لا نفي به في سلّةٍ أخرى. */

  it('سلّةٌ فوق السقف تُقصّ إليه، والقصُّ بندٌ منفصلٌ عن خصم الباقة', () => {
    const p = priceCart(lines(9, 200), null, null)
    expect(p.total).toBe(MAX_BUNDLE_TOTAL)
    expect(p.capDiscount, 'القصُّ لم يظهر بندا').toBeGreaterThan(0)
    /* ونسبةُ الباقة تبقى نسبةَ السلّم — لا تُرفع لتبتلع القصّ */
    expect(p.bundlePct).toBe(buildDiscountPct(MAX_BUILT_COURSES))
  })

  it('وسلّةٌ دونه لا يمسّها — فلا قصَّ في جمهور السلال', () => {
    const p = priceCart(lines(3), null, null)
    expect(p.capDiscount).toBe(0)
  })

  it('والحسابُ يقفل: الأصلُ ناقصَ البنود الثلاثة هو المدفوع', () => {
    const p = priceCart(lines(9, 200), null, { percentOff: 10, amountOff: null })
    expect(p.discount).toBe(p.bundleDiscount + p.capDiscount + p.couponDiscount)
    expect(p.total).toBe(p.subtotal - p.discount)
  })

  it('والكودُ فوق السقف لا تحته — وإلّا ضاع خصمُ من استحقّه', () => {
    const p = priceCart(lines(9, 200), null, { percentOff: 10, amountOff: null })
    expect(p.couponDiscount, 'الكودُ حُسب ثمّ ابتلعه السقف').toBe(MAX_BUNDLE_TOTAL / 10)
    expect(p.total).toBe(MAX_BUNDLE_TOTAL - MAX_BUNDLE_TOTAL / 10)
  })
})
