/* إد-١ · اتجاه المؤشر ومقارنته — منطق نقي قابل للاختبار، بلا React وبلا شبكة.

   القاعدة الحاكمة: **لا نصنع معنى من لا شيء.** «٠» بلا سياق لا يعني «كل شيء
   بخير» ولا «كل شيء متوقف» — فالمطلوب أن نقول أيّهما، أو نقول صراحة أننا
   لا نعرف. من هنا تفريقان لا يجوز إسقاطهما:

   ١) **الحصيلة (flow) مقابل اللحظة (stock).** «١٢ طلبا وصل هذا الأسبوع» حصيلة
      فترة، تُقارن بفترة سابقة. «٣ شعب نشطة الآن» رقمُ لحظة: لا سجل تاريخي
      لعددها الأسبوع الماضي، فأي «مقارنة» له اختلاق. تُعرض بلا اتجاه ومعها
      سبب صريح — لا سهم رمادي يوهم بثبات لم نقسه.

   ٢) **القسمة على صفر ليست ١٠٠٪.** الانتقال من ٠ إلى ٣ ليس «+٣٠٠٪» ولا
      «+∞٪» — هو «ثلاثة، ولا شيء قبلها». تُعاد النسبة null ويُقال ذلك بالنص. */

import { countAr, type CountForms } from '../text/count-ar'

/** حصيلة فترة (تُقارن) أم رقم لحظة (لا يُقارن) */
export type MetricKind = 'flow' | 'stock'

export type TrendDirection =
  | 'up'      // ارتفاع عن الفترة السابقة
  | 'down'    // انخفاض
  | 'flat'    // العدد نفسه وكلاهما فوق الصفر
  | 'new'     // من صفر إلى عدد — لا نسبة صادقة
  | 'gone'    // من عدد إلى صفر
  | 'quiet'   // صفر في الفترتين — سكونٌ معلوم لا فراغ مجهول
  | 'none'    // رقم لحظة: لا مقارنة ممكنة

export interface Trend {
  direction: TrendDirection
  /** الفرق بالعدد — 0 لرقم اللحظة */
  delta: number
  /** النسبة المئوية الصحيحة، أو null حين لا قسمة صادقة (الأساس صفر) */
  percent: number | null
  /** جملة «كذا مقابل كذا» — تُقرأ بعد بادئة تسمّي المقيس («الوارد»، «المحصَّل»)
      فتصلح لكل اتجاه بلا تكرار ولا تكلّف. تقول ما جرى لا ما نتمناه. */
  sentenceAr: string
  /** هل يُعرض سهم؟ رقم اللحظة والسكون بلا سهم */
  showArrow: boolean
}

export const WINDOW_DAYS = 7
const DAY_MS = 86_400_000

/** الفترتان المتقابلتان: الأيام السبعة الأخيرة، والسبعة التي قبلها */
export function windowBounds(now: number): { currentFrom: number; previousFrom: number } {
  return { currentFrom: now - WINDOW_DAYS * DAY_MS, previousFrom: now - 2 * WINDOW_DAYS * DAY_MS }
}

/** عدّ صفوف في الفترتين بحسب طابع زمني — الصفوف الأقدم من أسبوعين تُهمل.
    الطابع غير الصالح يُهمل ولا يُحسب في أي فترة (تاريخ فاسد ليس حركة). */
export function countWindows<T>(
  rows: T[],
  at: (row: T) => string | Date | null | undefined,
  now: number,
): { current: number; previous: number } {
  const { currentFrom, previousFrom } = windowBounds(now)
  let current = 0
  let previous = 0
  for (const row of rows) {
    const raw = at(row)
    if (raw === null || raw === undefined) continue
    const t = raw instanceof Date ? raw.getTime() : Date.parse(raw)
    if (Number.isNaN(t)) continue
    if (t > now) continue // طابع في المستقبل: لا يُحسب حركةً وقعت
    if (t >= currentFrom) current++
    else if (t >= previousFrom) previous++
  }
  return { current, previous }
}

/** الاتجاه من حصيلتين — `forms` لصياغة العدد في الجملة */
export function flowTrend(current: number, previous: number, forms: CountForms): Trend {
  const delta = current - previous
  if (current === 0 && previous === 0) {
    return {
      direction: 'quiet', delta: 0, percent: null, showArrow: false,
      sentenceAr: 'لا حركة في الأسبوعين',
    }
  }
  if (previous === 0) {
    return {
      direction: 'new', delta, percent: null, showArrow: true,
      sentenceAr: `${countAr(current, forms)}، مقابل لا شيء الأسبوع الماضي`,
    }
  }
  if (current === 0) {
    return {
      direction: 'gone', delta, percent: -100, showArrow: true,
      sentenceAr: `لا شيء، مقابل ${countAr(previous, forms)} الأسبوع الماضي`,
    }
  }
  const percent = Math.round((delta / previous) * 100)
  if (delta === 0) {
    return {
      direction: 'flat', delta: 0, percent: 0, showArrow: false,
      sentenceAr: `${countAr(current, forms)} — العدد نفسه كالأسبوع الماضي`,
    }
  }
  return {
    direction: delta > 0 ? 'up' : 'down', delta, percent, showArrow: true,
    sentenceAr: `${countAr(current, forms)}، مقابل ${previous} الأسبوع الماضي`,
  }
}

/** رقم لحظة: لا اتجاه — والسبب معروض لا مخفي */
export function stockTrend(): Trend {
  return {
    direction: 'none', delta: 0, percent: null, showArrow: false,
    sentenceAr: 'رقمُ لحظة — لا سجل لعدده الأسبوع الماضي',
  }
}

/** نص الشارة: «+3» أو «−2» أو «+40٪». يُعرض داخل dir="ltr" دائما —
    «+4» في سياق عربي يُقلب إلى «4+» بلا ذلك (قاعدة ثنائية الاتجاه). */
export function trendBadgeAr(t: Trend): string | null {
  if (t.direction === 'none' || t.direction === 'quiet' || t.direction === 'flat') return null
  if (t.percent === null) return `+${t.delta}`
  const sign = t.percent > 0 ? '+' : '−'
  return `${sign}${Math.abs(t.percent)}٪`
}
