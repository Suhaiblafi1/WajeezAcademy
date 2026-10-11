/* تقاريرُ المراجعة دفعةً واحدة (١١ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «اريد ان ارفع كل شي مره واحده!» — وكان كلُّ تقريرٍ يُرفع من بطاقة
   خطّته، اثنان وأربعون ملفّا (تقريرٌ وملحقٌ لكلّ خطّة) في إحدى وعشرين بطاقة.

   فكلُّ ملفٍّ يحمل في اسمه معرّفَ خطّته (يُكتب فيه عند تجهيزه)، فيُعرف موضعُه بلا سؤال، ويُرفع
   إليها بمسلك البطاقة نفسِه. وما لا يُعرف موضعُه يُردّ بسببه ولا يُخمَّن: ملفٌّ يصل مدرّبا غيرَ
   مدرّبه أسوأُ من ملفٍّ لم يُرفع.

   بلا React — تقرؤه الشاشة، ويحرسه `src/tests/trainer/review-reports-bulk.test.ts`. */

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export type ReportMatch =
  | { name: string; ok: true; planId: string; labelAr: string; mime: string }
  | { name: string; ok: false; problemAr: string }

/** نوعُ الملفّ — من المتصفّح، وإلّا من امتداده (Word قد يصل بلا نوع) */
export function reportMime(name: string, type: string): string {
  if (type) return type
  if (/\.pdf$/i.test(name)) return 'application/pdf'
  if (/\.docx$/i.test(name)) return DOCX
  return ''
}

/** أيُّ خطّةٍ هذا الملفّ — من معرّفها في اسمه، وبين الخطط المعروضة وحدَها */
export function matchReportFile(
  name: string, type: string, plans: readonly { id: string; labelAr: string }[],
): ReportMatch {
  const mime = reportMime(name, type)
  if (mime !== 'application/pdf' && mime !== DOCX) {
    return { name, ok: false, problemAr: 'لا يُقبل إلّا PDF أو Word' }
  }
  const ids = [...new Set((name.match(UUID) ?? []).map((x) => x.toLowerCase()))]
  if (ids.length === 0) return { name, ok: false, problemAr: 'لا يذكر اسمُ الملفّ خطّتَه — ارفعه من بطاقة خطّته' }
  if (ids.length > 1) return { name, ok: false, problemAr: 'في اسم الملفّ أكثرُ من خطّة — ارفعه من بطاقة خطّته' }
  const plan = plans.find((p) => p.id.toLowerCase() === ids[0])
  if (!plan) {
    return { name, ok: false, problemAr: 'خطّتُه ليست في القائمة المعروضة الآن (قرّرتَ فيها، أو القائمةُ مصفّاةٌ بمدرّب) — ارفعه من بطاقة خطّته' }
  }
  return { name, ok: true, planId: plan.id, labelAr: plan.labelAr, mime }
}

/** خلاصةُ الدفعة — كم رُفع، وكم كان مرفوعا من قبل، وكم رُدّ */
export function reportsSummaryAr(done: number, already: number, failed: number): string {
  const parts = [`رُفع ${done}`]
  if (already > 0) parts.push(`وكان ${already} مرفوعا من قبل فلم يُكرَّر`)
  if (failed > 0) parts.push(`ورُدّ ${failed} بسببه أدناه`)
  const tail = failed === 0 ? ' — يراها كلُّ مدرّبٍ في صفحة شعبته من الآن، وتذكرها رسالةُ قرارك.' : '.'
  return parts.join('، ') + tail
}
