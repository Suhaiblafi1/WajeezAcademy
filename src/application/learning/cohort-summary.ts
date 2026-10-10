/* ═══ نبذةُ المدرّب عن شعبته — يقرؤها المتعلّمُ قبل أن يدفع وبعد أن يلتحق (١٠ أكتوبر ٢٠٢٦) ═══

   تطلبها خطوةُ «المعلومات الأساسيّة» من المدرّب بوعدٍ صريح: «سطران يقرؤهما المتعلّم قبل أن
   يدفع». ولم تكن تظهر في أيّ صفحةٍ للمتعلّم — فوجدها صاحبُ المنصّة وعدا لا يُوفى، وقال:
   «solve it». فتُقرأ هنا من الخطّة المعتمَدة وحدَها: ما لم تعتمده الإدارةُ لا يُعلَن.

   وتُقصّ عند حدٍّ يُقرأ في بطاقة اختيار الموعد، بلا قطعِ كلمة. */

/** أقصى ما يُعرض من النبذة في بطاقة الشعبة العامّة */
export const COHORT_SUMMARY_PUBLIC_MAX = 600

/** النبذةُ من محتوى الخطّة كما تُعرض — `null` إن لم تُكتب */
export function cohortSummaryAr(content: unknown, max = COHORT_SUMMARY_PUBLIC_MAX): string | null {
  if (!content || typeof content !== 'object') return null
  const raw = (content as { summaryAr?: unknown }).summaryAr
  if (typeof raw !== 'string') return null
  const text = raw.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  if (!text) return null
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}
