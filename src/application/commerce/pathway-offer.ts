/* عرض المسار قبل التسجيل — مصدرٌ واحد لكل رقمٍ يُقرأ على الشاشة.

   ثلاثة أرقام تُعرض للزائر قبل أن يسجّل: من كم تبدأ الدورة، وكم يكسب في أول
   شراء، وكم يكسب إن أخذ المسار كاملا. وكلٌّ منها وعدٌ تُطالَب به الفاتورة —
   فمصدره واحد هنا لا ثلاثة في ثلاث صفحات.

   ولا رقم مُختلَق: «تبدأ من» تُقرأ من أرخص سعر قائمةٍ في دورات المسار نفسه،
   وسعرُ القائمة يُعلَن في الكتالوج وترثه الشعبة عند فتحها (cohort.service.ts)
   — فما يُعرض هنا هو ما تُصدره الفاتورة، لا تقديرٌ ولا تحويل عملة. */

import { courseById } from '../../data/courses'
import { FIRST_TIME_PROMO } from './first-time-promo'

/** أقصى ما يبلغه خصم المسار كاملا — يُعلَن «يصل إلى» لا «هو» */
export const PATHWAY_BUNDLE_MAX_PCT = 25

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

/** صياغة السعر بعملته — بلا تحويل. العملة تُكتب كما هي، فالتحويل يُخرج رقما
    ثالثا لا يُطالَب به أحد. */
export function formatOfferPrice(amount: number, currency: string): string {
  if (currency === 'USD') return `$${amount}`
  if (currency === 'JOD') return `${amount} د.أ`
  return `${amount} ${currency}`
}
