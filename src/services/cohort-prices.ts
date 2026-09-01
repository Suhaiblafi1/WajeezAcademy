/* السعر الحقيقيّ — من الشعبة لا من المتصفّح (التوصية ٤).

   كانت الأسعار المعروضة **مُختلَقة في الواجهة**: `coursePriceOf` يقدّر ١٣٠–١٨٠
   دولارا بمطابقة كلماتٍ في عنوان الدورة، و`pathwayPriceFor` يعطي ٥٠٠/٥٥٠/٦٠٠
   بحسب العدد وحده. والفاتورة تُصدر بسعر الشعبة الحقيقيّ — **وبعملة أخرى**
   (الدينار افتراضا). فالرقم الذي وعدنا به ليس الرقم الذي نُطالب به.

   والمعيار الذي يتبعه هذا المستودع في صفحة المدرّبين — «لا أرقام توضيحية» —
   يُطبَّق هنا: سعرٌ من شعبةٍ حقيقية، أو لا سعر.

   ولا تحويل عملة: الشعبة مسعَّرة بعملتها، وتحويلُها للعرض يُخرج رقما ثالثا لا
   يُطالَب به أحد. تُعرض كما تُفوتَر. */

import { useEffect, useMemo, useState } from 'react'

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
  title?: string | null
  status: string | null
  price: number | string | null
  currency: string | null
  startsAt: string | null
  daysOfWeek?: string[] | null
  startTime?: string | null
  timezone?: string | null
  seatsLeft?: number | null
}

/** شعبةٌ يستطيع المتعلّم أن يختارها — بموعدها وسعرها ومقاعدها */
export interface CohortOption {
  id: string
  courseId: string
  title: string
  startsAt: string | null
  daysOfWeek: string[]
  startTime: string | null
  timezone: string | null
  amount: number
  currency: string
  seatsLeft: number | null
}

/* الحالات التي يستطيع المتعلّم أن يلتحق بها — وهي عينها التي تعدّها
   `PlanService` على الخادم `schedulable`. والشعبة `active` بدأت فعلا: عرضُ
   سعرها «تبدأ من» يَعِد برقمٍ لشيءٍ لا يُشترى، وهو الخطأ نفسه من بابٍ آخر.
   ومصدرا الرقم والحالة يجب أن يتّفقا، وإلا قالت الصفحة سعرا وقالت الخطّة
   «بانتظار شعبة» عن الدورة نفسها. */
const JOINABLE = new Set(['open', 'full'])

/* كلُّ الشعب القابلة للالتحاق لكلّ دورة — لا أقربُها وحدها.

   كان هذا الملفّ يحتفظ بأوّل شعبةٍ لكلّ دورة ويُسقط الباقي، فلا يستطيع
   المتعلّم أن يختار موعدا يناسبه. وقرار صاحب المنتج: «يحقّ له اختيار الشعبة
   التي يريد بحسب المتوفّر وما يناسبه». فصار المصدر يحمل القائمة كاملةً
   مرتّبةً بالبدء، و«أقرب موعد» أوّلها لا كلّها.

   ونداءُ شبكةٍ واحد: `useCoursePrices` تُشتقّ من هذه، فلا يُجلب الشيء مرّتين
   ولا يفترق ما تعرضه صفحةٌ عمّا تعرضه أختها. */
export function useCourseCohorts(): { cohorts: Map<string, CohortOption[]>; loaded: boolean } {
  const [cohorts, setCohorts] = useState<Map<string, CohortOption[]>>(new Map())
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let on = true
    fetch(`${API_BASE}/api/public/cohorts`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: PublicCohort[]) => {
        if (!on) return
        const map = new Map<string, CohortOption[]>()
        for (const c of Array.isArray(rows) ? rows : []) {
          if (c.status && !JOINABLE.has(c.status)) continue
          const amount = Number(c.price)
          if (!Number.isFinite(amount) || amount <= 0 || !c.currency) continue
          /* لا مقعد = لا خيار: عرضُها يَعِد بما لا يُشترى */
          if (typeof c.seatsLeft === 'number' && c.seatsLeft <= 0) continue
          const list = map.get(c.courseId) ?? []
          list.push({
            id: c.id, courseId: c.courseId, title: c.title ?? '',
            startsAt: c.startsAt ?? null,
            daysOfWeek: Array.isArray(c.daysOfWeek) ? c.daysOfWeek : [],
            startTime: c.startTime ?? null, timezone: c.timezone ?? null,
            amount, currency: c.currency,
            seatsLeft: typeof c.seatsLeft === 'number' ? c.seatsLeft : null,
          })
          map.set(c.courseId, list)
        }
        /* الترتيب هنا لا على الخادم: الأقرب أوّلا، وما بلا تاريخٍ في الآخر */
        for (const list of map.values()) {
          list.sort((a, b) => {
            if (!a.startsAt) return 1
            if (!b.startsAt) return -1
            return a.startsAt.localeCompare(b.startsAt)
          })
        }
        setCohorts(map)
      })
      .catch(() => undefined)
      .finally(() => { if (on) setLoaded(true) })
    return () => { on = false }
  }, [])

  return { cohorts, loaded }
}

/** أقرب شعبة مفتوحة لكل دورة، بسعرها وعملتها — مشتقّة من القائمة الكاملة */
export function useCoursePrices(): { prices: Map<string, CoursePrice>; loaded: boolean } {
  const { cohorts, loaded } = useCourseCohorts()
  const prices = useMemo(() => {
    const map = new Map<string, CoursePrice>()
    for (const [courseId, list] of cohorts) {
      const first = list[0]
      if (first) map.set(courseId, { amount: first.amount, currency: first.currency, cohortId: first.id })
    }
    return map
  }, [cohorts])
  return { prices, loaded }
}

export function formatCohortPrice(p: { amount: number; currency: string }): string {
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

/** مجموعُ أسعار المجموعة — **أو null إن نقص سعرُ دورةٍ واحدة**.

    قرارُ صاحب المنصّة: «سعر المسار يجب أن يظهر كاملا، ليس تبدأ من — فهذا أمرٌ
    قديم تراجعتُ عنه». و«تبدأ من» وُضعت يوم كانت أكثرُ الشعب بلا سعر، فصارت
    اليومَ تُخفي الرقمَ الذي يُقتطع فعلا.

    والمجموعُ لا يُعرض ناقصا أبدا: مجموعُ ثلاثٍ من أربعٍ يُقرأ سعرَ الأربع،
    وهو أسوأُ من لا رقم. والعملاتُ المختلطة تُبطله كذلك — الخادمُ نفسُه يرفض
    خلطها في طلبٍ واحد (commerce.service.ts). */
export interface PriceSum { amount: number; currency: string }

export function totalOf(courseIds: readonly string[], prices: Map<string, CoursePrice>): PriceSum | null {
  if (courseIds.length === 0) return null
  let sum = 0
  let currency: string | null = null
  for (const id of courseIds) {
    const p = prices.get(id)
    if (!p) return null // سعرٌ ناقص — لا مجموع
    if (currency === null) currency = p.currency
    else if (p.currency !== currency) return null // عملتان — لا يُجمعان
    sum += p.amount
  }
  return currency ? { amount: sum, currency } : null
}

/** كم دورةً في المجموعة لها سعر معلوم — الواجهة تقول الحقيقة حين ينقص */
export function pricedCount(courseIds: readonly string[], prices: Map<string, CoursePrice>): number {
  return courseIds.filter((id) => prices.has(id)).length
}
