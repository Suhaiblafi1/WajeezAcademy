/* «أكمل مسارك» — ما يلي الدورةَ التي اشتراها في مسارها (١٣ نوفمبر ٢٠٢٦).

   قال صاحبُ المنصّة: «أرى الناس تستصعب شراء أربع دورات» — فدورةٌ واحدةٌ أوّلا، والكودُ يبقى لباقي المسار حتى آخر يوم.
   فشاشةُ الشكر بعد الدفع تقترح ما يلي ما اشتراه في مساره نفسِه: بترتيب المسار، بدءا ممّا بعده ثمّ ما قبله، بلا ما
   اشتراه، وممّا يُشترى الآن وحدَه (`available`، موسمُ البيع في `listed-courses.ts`). ولا مسارَ له = لا اقتراح. */

/** ما يلي ما اشتراه في مساره — معرّفاتُ دوراتٍ بترتيب المسار، حتى `limit` */
export function nextInPath(
  bought: readonly string[],
  pathways: readonly { courseIds: readonly string[] }[],
  available: (courseId: string) => boolean,
  limit = 2,
): string[] {
  const have = new Set(bought)
  for (const id of bought) {
    const path = pathways.find((p) => p.courseIds.includes(id))
    if (!path) continue
    const at = path.courseIds.indexOf(id)
    const order = [...path.courseIds.slice(at + 1), ...path.courseIds.slice(0, at)]
    const next = order.filter((c) => !have.has(c) && available(c)).slice(0, limit)
    if (next.length > 0) return next
  }
  return []
}

/** دوراتُ طلبٍ مدفوع — بندُ الدورة بمعرّفه، وبندُ الشعبة بدورتها إن عُرفت شعبتُها */
export function boughtCourseIds(
  items: readonly { kind?: string; refId?: string }[],
  courseOfCohort: (cohortId: string) => string | undefined,
): string[] {
  const out: string[] = []
  for (const it of items) {
    const id = it.kind === 'course' ? it.refId : it.kind === 'cohort' && it.refId ? courseOfCohort(it.refId) : undefined
    if (id && !out.includes(id)) out.push(id)
  }
  return out
}
