/* المرحلةُ المُجابةُ مسبقا — جسرُ الرئيسيّة إلى التشخيص (البند ٣١).

   شبكةُ «أين أنت الآن؟» في الرئيسيّة تسأل السؤالَ الأوّلَ في التشخيص نفسِه
   (`QC-S1-001`). ولو أُعيد سؤالُه بعد النقر لكانت الشبكةُ زينةً: يجيب الزائرُ
   مرّتين عن الشيء نفسِه في نقرتين متتاليتين، فيتعلّم أنّ ما ينقره لا يُحسب.

   فالجوابُ يُمرَّر في العنوان ويُسلَّم للمحرّك **قبل أوّل سؤالٍ يُعرض**.

   ── ولا خياراتٍ مكتوبةً هنا ──

   العشرُ تُقرأ من بنك الأسئلة لا من قائمةٍ في هذا الملفّ: جدولان يفترقان
   عاجلا أو آجلا، وقد رأينا ذلك في تصنيف المسارات (البند ٢٨) حيث سقط ثلاثةَ
   عشرَ مسارا في تصنيفٍ خاطئٍ لأنّ جدولا ثانيا لم يعرفها.

   ── والمجهولُ يُتجاهَل بلا ضجّة ──

   عنوانٌ يحمل مرحلةً لا يعرفها البنكُ (رابطٌ قديم، أو حرفٌ سقط) لا يُسقط
   التشخيصَ ولا يُنبّه: يُبدأ من أوّله كما لو لم يُمرَّر شيء. */

import { diagQuestionById } from './assessment-service'
import type { DiagOption, DiagQuestion } from '../../data/diagnostic'

/* خياراتُ `DiagQuestion` اتّحادٌ: مصفوفةٌ، أو دالّةٌ تبنيها من الأجوبة السابقة
   (شرطيّاتُ بنك V1). وبنكُ V2.1 لا يبني دالّةً قطّ — `toDiagQuestion` يضع
   مصفوفةً أو `undefined`. فالتضييقُ هنا صريحٌ لا افتراضٌ صامت. */
const optionsOf = (q: DiagQuestion | null | undefined): DiagOption[] =>
  Array.isArray(q?.options) ? q.options : []

/** معرّف سؤال المرحلة في بنك V2.1 */
export const STAGE_QUESTION_ID = 'QC-S1-001'

/** اسم المعامل في العنوان */
export const STAGE_PARAM = 'stage'

/** خيارات المرحلة كما يسألها التشخيص — من البنك لا من جدولٍ ثانٍ */
export const STAGE_OPTIONS_AR: readonly string[] =
  optionsOf(diagQuestionById(STAGE_QUESTION_ID)).map((o) => o.label)

/** الخيارُ المطابق لما في العنوان — أو `null` لما لا يعرفه البنك */
export function resolveEntryStage(
  raw: string | null,
): { value: string; optionIds?: string[] } | null {
  const wanted = raw?.trim()
  if (!wanted) return null
  const question = diagQuestionById(STAGE_QUESTION_ID)
  const match = optionsOf(question).find((o) => o.label === wanted)
  if (!match) return null
  return { value: match.value, optionIds: match.optionId ? [match.optionId] : undefined }
}
