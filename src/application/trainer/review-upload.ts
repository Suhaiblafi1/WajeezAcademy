/* ═══ رفعٌ واحدٌ لما رجع من المراجعة — «فقط تحميل ورفع» (صاحب المنصّة، ٢٦ أكتوبر ٢٠٢٦) ═══

   كان في «خطط تنتظر اعتمادك» خمسُ أدواتٍ للجملة: حزمتان للتنزيل، وصندوقان للرفع بثلاث طرقٍ وخانةِ استبدال،
   وزرُّ «احذف المكرر من كل الخطط». وقال صاحبُ المنصّة: «هذا لا داعي له.. فقط تحميل ورفع.. باقي الأمور كانت لحلّ
   مشكلةٍ ظهرت في وقتها لا أكثر». فتنزيلٌ واحد (المنتظِرة)، وصندوقُ رفعٍ واحدٌ يأخذ ما رجع كلَّه، ويُرسل كلَّ ملفٍّ إلى بابه:

   · ملفُّ التعديلات (JSON) إلى خطّته مسوّداتٍ — بالرفع العاديّ: لا يُستبدل ما قبله ولا يُسحب.
   · والـPDF الذي سمّاه ملفُّ تعديلاتٍ في الدفعة نفسِها كرّاستُه المصحّحة — يُرفع مع بنده.
   · وما بقي (PDF أو Word أو zip) تقاريرُ مراجعةٍ تُطابَق خطّتُها باسمها — ولا يُحذف ما رُفع قبلها.

   بلا React — يقرؤه الصندوق (`ReviewUpload.tsx`)، ويحرسه `src/tests/trainer/review-upload.test.ts`. */

import { countAr } from '../text/count-ar'
import { isPdfName, pdfKey } from './plan-edits-bulk'

/** ملفُّ تعديلات؟ — JSON باسمه أو بنوعه */
export const isEditsFile = (f: { name: string; type?: string }): boolean =>
  /\.json$/i.test(f.name.trim()) || f.type === 'application/json'

/** ما ليس ملفَّ تعديلات: كرّاساتُ ما سمّاه ملفٌّ منها في الدفعة نفسِها، والباقي تقارير */
export function splitReviewFiles<F extends { name: string }>(
  rest: readonly F[], neededWorkbooks: Iterable<string>,
): { workbooks: F[]; reports: F[] } {
  const needed = new Set([...neededWorkbooks].map(pdfKey))
  const workbooks: F[] = []
  const reports: F[] = []
  for (const f of rest) (isPdfName(f.name) && needed.has(pdfKey(f.name)) ? workbooks : reports).push(f)
  return { workbooks, reports }
}

const FILE_FORMS = { one: 'ملف', two: 'ملفين', few: 'ملفات', many: 'ملفا' }

/** خلاصةُ الدفعة — كم رُفع، وكم كان مرفوعا، وكم رُدّ. ولا يُقال «كلّها» وفيها ما رُدّ */
export function reviewUploadSummaryAr(done: number, already: number, failed: number): string {
  const total = done + already + failed
  if (failed === 0 && already === 0) return `رفعت الملفات كلها (${total}).`
  if (done === 0 && failed === 0) return `كانت الملفات كلها (${total}) مرفوعة من قبل — لم يكرر شيء.`
  if (done === 0 && already === 0) return `لم يرفع شيء — ردت الملفات كلها (${total}) بأسبابها أدناه.`
  const parts = [
    done > 0 ? `رفع ${done} من ${total}` : 'لم يرفع شيء جديد',
    failed > 0 ? `وردّ ${failed} بسببه أدناه` : '',
    already > 0 ? `و${countAr(already, FILE_FORMS)} كان مرفوعا من قبل` : '',
  ]
  return parts.filter(Boolean).join('، ') + '.'
}
