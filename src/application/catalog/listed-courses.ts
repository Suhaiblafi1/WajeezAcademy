/* أيُّ الدورات تُعرض في قوائم الموقع — ما له شعبةٌ أُعلنت ولم تنتهِ.

   ═══ القرار (٢١ أكتوبر ٢٠٢٦) ═══

   صاحبُ المنصّة: «أريد أن تظهر هذه الدورات فقط في قسم الدورات في الموقع، وأن تخفى من لا شعبةَ لها..
   ويكون الأمرُ تلقائيّا: لأيّ شعبةٍ تتفعّل تظهر في الموقع مباشرةً دورتُها وتفاصيلُها». ثمّ اختار:
     · **تظهر حتّى تنتهي شعبتُها** — الممتلئةُ والجاريةُ تُبقيانها، وصفحتُها تقول «نخبرك بالشعبة التالية».
     · **والمخفيّةُ تبقى صفحتُها لمن يملك رابطَها** — بلا قائمةٍ ولا بحث، وفيها «أخبرني حين تُفتح».
       فلا رابطَ قديمٌ ينكسر، ولا تضيع إشارةُ الطلب التي يُقرأ منها أيُّ دورةٍ تُفتح بعدها.

   والشرطُ في الخادم وحدَه (`listedCohortWhere` في `server/services/registration-window.ts`)، وهنا
   ما تفعله الواجهةُ بجوابه — في كلّ قائمةٍ عامّةٍ بالدالّة نفسِها، فلا تُخفي صفحةٌ ما تُظهره أختُها.

   ═══ وحين لا يُعرف الجواب ═══

   · **قبل أن يصل** لا يُعرض شيء: كتالوجٌ كاملٌ يومض ثمّ ينكمش إلى ثلاثين يُقرأ عطبا.
   · **وإن تعذّر** — من أوّل إخفاق، والإعادةُ ماضيةٌ في الخلفيّة (`services/listed-courses.ts`) — يُعرض
     الكتالوجُ كلُّه: قسمُ دوراتٍ فارغٌ أسوأُ من دورةٍ بلا شعبةٍ تقول صفحتُها ذلك. */

/** جوابُ الخادم كما تقرؤه الواجهة */
export type ListedCourses =
  | { state: 'loading' }
  | { state: 'failed' }
  | { state: 'ready'; ids: ReadonlySet<string> }

/** القائمةُ العامّةُ بلا ما لا شعبةَ له — والترتيبُ كما جاء */
export function listedOnly<T extends { id: string }>(items: readonly T[], listed: ListedCourses): T[] {
  if (listed.state === 'loading') return []
  if (listed.state === 'failed') return [...items]
  return items.filter((c) => listed.ids.has(c.id))
}

/** رموزُ الجواب — وما ليس نصّا يسقط ولا يُختلَق */
export function listedFromResponse(raw: unknown): ReadonlySet<string> | null {
  const ids = (raw as { courseIds?: unknown } | null)?.courseIds
  if (!Array.isArray(ids)) return null
  return new Set(ids.filter((x): x is string => typeof x === 'string' && x.length > 0))
}
