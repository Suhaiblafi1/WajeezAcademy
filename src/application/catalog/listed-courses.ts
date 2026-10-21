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

/* ═══ والمسارُ: يُعرض حين تكون لكلّ دوراته شعبة (٢١ أكتوبر ٢٠٢٦) ═══

   صاحبُ المنصّة: «ويظهر تلقائيّا إذا كانت كلُّ دوراته تفعّلت لدينا كشُعَب». فالمسارُ لا يُرشَّح
   بشرطٍ ثانٍ — بالجواب نفسِه: دورةٌ منه بلا شعبةٍ تُخفيه، وحين تُفتح يعود. والمجهولُ كالدورات:
   لا شيءَ قبل الجواب، والكلُّ إن تعذّر. */

/** المساراتُ التي لكلّ دوراتها شعبةٌ معروضة — والترتيبُ كما جاء */
export function listedWhole<T extends { courseIds: readonly string[] }>(items: readonly T[], listed: ListedCourses): T[] {
  if (listed.state === 'loading') return []
  if (listed.state === 'failed') return [...items]
  return items.filter((p) => p.courseIds.length > 0 && p.courseIds.every((id) => listed.ids.has(id)))
}

/* ═══ وما يُقال عن حجم الكتالوج: ما يُعرض، وأنّه دفعةٌ أولى (٢١ أكتوبر ٢٠٢٦) ═══

   كانت «من نحن» و«المنهجيّة» تقولان «في الكتالوج ٢٧ مسارا» والقسمُ يعرض ثمانية. فقرّر صاحبُ المنصّة
   أن يُعدّ ما يُعرض وحدَه، و«قل إنّها تجربةٌ وإنّ المزيد قادمٌ في الفصول القادمة». */

/** سطرُ الدفعة الأولى — واحدٌ في الصفحتين */
export const TRIAL_NOTE_AR = 'هذه دفعة أولى تجريبية، ونضيف مسارات ودورات في الفصول القادمة.'

/** عددُ ما يُعرض من المسارات والدورات — و`null` قبل الجواب: رقمٌ يومض ثمّ يتغيّر يُقرأ عطبا */
export function shownCounts(
  pathways: readonly { courseIds: readonly string[] }[],
  courses: readonly { id: string }[],
  listed: ListedCourses,
): { pathways: number; courses: number } | null {
  if (listed.state === 'loading') return null
  return { pathways: listedWhole(pathways, listed).length, courses: listedOnly(courses, listed).length }
}

/** رموزُ الجواب — وما ليس نصّا يسقط ولا يُختلَق */
export function listedFromResponse(raw: unknown): ReadonlySet<string> | null {
  const ids = (raw as { courseIds?: unknown } | null)?.courseIds
  if (!Array.isArray(ids)) return null
  return new Set(ids.filter((x): x is string => typeof x === 'string' && x.length > 0))
}

/* ═══ والتشخيصُ: ما يُشترى الآن أوّلا (٢١ أكتوبر ٢٠٢٦) ═══

   اختار صاحبُ المنصّة للتشخيص: «ما يُشترى أوّلا، والباقي "لم تفتح شعبتُه بعد"» — لا «المعروضُ
   وحدَه» (يختار من ثلاثين دورةً بدل مئةٍ وتسع وخمسين فتضعف التوصية)، ولا «بلا تغيير». فالمحرّكُ
   يرشّح كما كان، والعرضُ يقدّم ما له شعبة: في مقترحات الاستبدال والإضافة، وفي سطر كلّ دورة. */

/** ما له شعبةٌ أوّلا — بترتيبه بين المتساويين. والمجهولُ لا يُعاد ترتيبُه */
export function listedFirst<T extends { id: string }>(items: readonly T[], listed: ListedCourses): T[] {
  if (listed.state !== 'ready') return [...items]
  const on = items.filter((c) => listed.ids.has(c.id))
  const off = items.filter((c) => !listed.ids.has(c.id))
  return [...on, ...off]
}

/** سطرُ الحال تحت اقتراحٍ — و`null` حين لا يُعرف */
export function availabilityNoteAr(courseId: string, listed: ListedCourses): string | null {
  if (listed.state !== 'ready') return null
  return listed.ids.has(courseId) ? 'لها شعبة' : 'لم تفتح شعبتها بعد'
}
