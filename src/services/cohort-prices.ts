/* السعر الحقيقيّ — من الشعبة لا من المتصفّح (التوصية ٤).

   كانت الأسعار المعروضة **مُختلَقة في الواجهة**: `coursePriceOf` يقدّر ١٣٠–١٨٠
   دولارا بمطابقة كلماتٍ في عنوان الدورة، و`pathwayPriceFor` يعطي ٥٠٠/٥٥٠/٦٠٠
   بحسب العدد وحده. والفاتورة تُصدر بسعر الشعبة الحقيقيّ — **وبعملة أخرى**
   (الدينار افتراضا). فالرقم الذي وعدنا به ليس الرقم الذي نُطالب به.

   والمعيار الذي يتبعه هذا المستودع في صفحة المدرّبين — «لا أرقام توضيحية» —
   يُطبَّق هنا: سعرٌ من شعبةٍ حقيقية، أو لا سعر.

   ولا تحويل عملة: الشعبة مسعَّرة بعملتها، وتحويلُها للعرض يُخرج رقما ثالثا لا
   يُطالَب به أحد. تُعرض كما تُفوتَر. */

import { useEffect, useState } from 'react'

const API_BASE: string = import.meta.env.VITE_API_URL ?? ''

export interface CoursePrice {
  amount: number
  currency: string
  /** الشعبة التي جاء منها السعر — أقربها بدءا */
  cohortId: string
}

interface PublicCohort {
  id: string
  courseId: string
  price: number | string | null
  currency: string | null
  startsAt: string | null
}

/** أقرب شعبة مفتوحة لكل دورة، بسعرها وعملتها. فارغة حين لا شعب أو تعذّر الجلب. */
export function useCoursePrices(): { prices: Map<string, CoursePrice>; loaded: boolean } {
  const [prices, setPrices] = useState<Map<string, CoursePrice>>(new Map())
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let on = true
    fetch(`${API_BASE}/api/public/cohorts`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: PublicCohort[]) => {
        if (!on) return
        const map = new Map<string, CoursePrice>()
        /* القائمة مرتّبة بالبدء من الخادم، فأوّل ظهورٍ لدورةٍ هو أقرب شعبها */
        for (const c of Array.isArray(rows) ? rows : []) {
          if (map.has(c.courseId)) continue
          const amount = Number(c.price)
          if (!Number.isFinite(amount) || amount <= 0 || !c.currency) continue
          map.set(c.courseId, { amount, currency: c.currency, cohortId: c.id })
        }
        setPrices(map)
      })
      .catch(() => undefined)
      .finally(() => { if (on) setLoaded(true) })
    return () => { on = false }
  }, [])

  return { prices, loaded }
}

/** تنسيق بعملة الشعبة نفسها — بلا تحويل */
export function formatCohortPrice(p: CoursePrice): string {
  return `${p.amount.toLocaleString('en-US')} ${p.currency}`
}

/** أرخص دورة معلومة السعر في مجموعة — «تبدأ من». null حين لا سعر معلوم. */
export function cheapestOf(courseIds: readonly string[], prices: Map<string, CoursePrice>): CoursePrice | null {
  let best: CoursePrice | null = null
  for (const id of courseIds) {
    const p = prices.get(id)
    if (!p) continue
    /* لا تُقارَن عملتان مختلفتان: أوّل عملة تُصادَف هي المرجع، وما خالفها يُترك.
       مقارنةُ ١٠٠ دينار بـ٣٠٠ ريال تعطي «الأرخص» خطأ. */
    if (!best) { best = p; continue }
    if (p.currency === best.currency && p.amount < best.amount) best = p
  }
  return best
}

/** كم دورةً في المجموعة لها سعر معلوم — الواجهة تقول الحقيقة حين ينقص */
export function pricedCount(courseIds: readonly string[], prices: Map<string, CoursePrice>): number {
  return courseIds.filter((id) => prices.has(id)).length
}
