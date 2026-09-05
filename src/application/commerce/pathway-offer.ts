/* عرض المسار قبل التسجيل — مصدرٌ واحد لكل رقمٍ يُقرأ على الشاشة.

   ثلاثة أرقام تُعرض للزائر قبل أن يسجّل: من كم تبدأ الدورة، وكم يكسب في أول
   شراء، وكم يكسب إن أخذ المسار كاملا. وكلٌّ منها وعدٌ تُطالَب به الفاتورة —
   فمصدره واحد هنا لا ثلاثة في ثلاث صفحات.

   ولا رقم مُختلَق: «تبدأ من» تُقرأ من أرخص سعر قائمةٍ في دورات المسار نفسه،
   وسعرُ القائمة يُعلَن في الكتالوج وترثه الشعبة عند فتحها (cohort.service.ts)
   — فما يُعرض هنا هو ما تُصدره الفاتورة، لا تقديرٌ ولا تحويل عملة. */

import { courseById } from '../../data/courses'
import { FIRST_TIME_PROMO } from './first-time-promo'
import { buildDiscountPct, bundlePayable, MAX_BUILT_COURSES } from './discount-policy'

/** أقصى ما يبلغه خصم المسار كاملا — يُعلَن «يصل إلى» لا «هو».

    وكان رقما مكتوبا هنا (٢٥) بينما سلّمُ البناء يبلغ ٢٧ عند سقفه
    (`discount-policy.ts`) — رقمان لشيءٍ واحد، وأحدهما وعدٌ على الشاشة والآخر
    ما يُحسب. ومنذ صار الخادمُ يطبّق السلّم فعلا (`cart-pricing.ts`) لم يعد
    للاختلاف موضع: المعلَن هو المطبَّق، فيُشتقّ منه. */
export const PATHWAY_BUNDLE_MAX_PCT = buildDiscountPct(MAX_BUILT_COURSES)

export interface PathwayOffer {
  /** أرخص سعر قائمة بين دورات المسار — null حين لا سعر لأيٍّ منها */
  fromPrice: number | null
  currency: string
  /** مجموع أسعار القائمة — null إن نقص سعر دورةٍ واحدة، فلا مجموع ناقص يُعرض */
  fullPrice: number | null
  firstTimePct: number
  bundleMaxPct: number
}

/** يبني عرض المسار من دوراته المعروضة — الأساسية والمساندة معا */
export function pathwayOffer(courseIds: readonly string[]): PathwayOffer {
  const prices: number[] = []
  let currency = 'USD'
  let complete = true
  for (const id of courseIds) {
    const c = courseById(id)
    const p = c?.listPrice
    if (typeof p === 'number' && p > 0) {
      prices.push(p)
      if (c?.listCurrency) currency = c.listCurrency
    } else {
      complete = false
    }
  }
  return {
    fromPrice: prices.length > 0 ? Math.min(...prices) : null,
    currency,
    /* المجموع لا يُعرض إلا إن عُرف سعر كل دورة: مجموعٌ ناقصٌ يُقرأ كاملا */
    fullPrice: complete && prices.length > 0 ? prices.reduce((a, b) => a + b, 0) : null,
    firstTimePct: FIRST_TIME_PROMO.percentOff,
    bundleMaxPct: PATHWAY_BUNDLE_MAX_PCT,
  }
}

/* ─────────── سعرُ المسار الجاهز — رقمُ الشاشة ورقمُ الفاتورة واحد ─────────── */

/** سعرُ شعبةٍ كما يصل الشاشة — أو null حين لا يُعرف */
export interface OfferPrice { amount: number; currency: string }
export type OfferPriceOf = (courseId: string) => OfferPrice | null

export interface PathwayPrice {
  /** مجموعُ أسعار القائمة شاملا الهديّة — وهو المشطوب على الشاشة */
  list: number
  /** ما يُدفع فعلا: الهديّةُ مطروحة، ثمّ سلّمُ الباقة، ثمّ سقفُ المبلغ */
  payable: number
  /** الوفرُ نسبةً — مشتقٌّ من الرقمين لا معلَنٌ قبلهما */
  savedPct: number
  currency: string
}

/** سعرُ المسار الجاهز كما يُعرض وكما يُصدَر.

    ولماذا هنا لا في الصفحة: كانت `Pathway.tsx` تضرب **مجموعَ الستّ** في نسبة
    الباقة، والخادمُ يفي بالهديّة (بندٌ بصفر، والسلّمُ على المدفوع وحدَه) —
    فتعرض الشاشةُ ٦١٨ والفاتورةُ تُصدر ٥٢٠ على مسارٍ نموذجيّ. والخطأُ في جهة
    «أكثر»، فلا شكوى تصل ولذلك بقي؛ لكنّه يبيع العرضَ بأضعفَ ممّا هو ويجعل
    السطرَ «وهو ما تُصدره الفاتورة» غيرَ صحيح.

    فصار الحسابُ واحدا، ويحرس `pathway-price-parity` مطابقتَه لـ`priceCart`
    على المسارات كلِّها — مطابقةً بنيةً لا باتّفاق.

    و`null` حين ينقص سعرُ دورةٍ واحدة أو تختلف العملات: مجموعٌ ناقصٌ يُقرأ
    كاملا. */
export function readyPathwayPrice(
  courseIds: readonly string[],
  giftCourseId: string | null,
  priceOf: OfferPriceOf,
): PathwayPrice | null {
  if (courseIds.length === 0) return null
  let list = 0
  let paid = 0
  let paidCount = 0
  let currency: string | null = null
  for (const id of courseIds) {
    const p = priceOf(id)
    if (!p) return null
    if (currency === null) currency = p.currency
    else if (p.currency !== currency) return null
    list += p.amount
    if (id !== giftCourseId) {
      paid += p.amount
      paidCount += 1
    }
  }
  if (currency === null) return null
  const payable = bundlePayable(paid, paidCount, currency)
  return {
    list,
    payable,
    savedPct: list > 0 ? Math.round((1 - payable / list) * 100) : 0,
    currency,
  }
}

/** صياغة السعر بعملته — بلا تحويل. العملة تُكتب كما هي، فالتحويل يُخرج رقما
    ثالثا لا يُطالَب به أحد. */
export function formatOfferPrice(amount: number, currency: string): string {
  if (currency === 'USD') return `$${amount}`
  if (currency === 'JOD') return `${amount} د.أ`
  return `${amount} ${currency}`
}
