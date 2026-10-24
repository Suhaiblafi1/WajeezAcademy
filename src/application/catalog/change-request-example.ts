/* مثالُ «طلب تعديل على كيان موجود» — يُرى في الخانة ولا يُرسَل (٢٤ أكتوبر ٢٠٢٦).

   كانت خانةُ التعديلات تُفتح وفيها `{"titleAr": "الاسم الجديد"}` قيمةً لا مثالا. فمن اختار دورةً وضغط «تقديم الطلب»
   ولم يمسّها قدّم طلبا يسمّي دورتَه «الاسم الجديد» حرفا، ويقع الاسمُ عند الاعتماد (`renameTitleOf` في
   `catalog-admin.service.ts`). ظهر في دراسة لوحة الإدارة.

   فالمثالُ نصٌّ يُرى في الخانة الفارغة، والخادمُ يردّ طلبا يحمله اسما — عند التقديم وعند الاعتماد، فما قُدّم قبل
   اليوم بالمثال لا يقع. */

export const CHANGE_REQUEST_EXAMPLE_TITLE = 'الاسم الجديد'

/** ما يُرى في الخانة الفارغة */
export const CHANGE_REQUEST_EXAMPLE = `{\n  "titleAr": "${CHANGE_REQUEST_EXAMPLE_TITLE}"\n}`

/** هل يسمّي الطلبُ الكيانَ بالمثال نفسِه؟ */
export function carriesExampleTitle(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false
  const t = (payload as Record<string, unknown>).titleAr
  return typeof t === 'string' && t.trim() === CHANGE_REQUEST_EXAMPLE_TITLE
}
