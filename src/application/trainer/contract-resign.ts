/* «حُدّث النصُّ — أعِدْه للتوقيع» — ما يتقاسمه الخادمُ والشاشة.
 *
 * ═══ السؤالُ الذي يجيب عنه ═══
 *
 * مدرّبٌ وقّع إصدارا سابقا من المتن ولم نعتمده بعد. فنسحب عرضَه ونعرض عليه
 * الحاضر — برسالةٍ **يكتبها صاحبُ المنصّة لكلّ مدرّبٍ كما يشاء**. وقولُه
 * (١ أكتوبر ٢٠٢٦): «اعطني فرصة تعديل النص وعنوانها كما اشاء فهناك اضافات قد
 * اضيفها لكل مدرب خصيصا بحسب ما اريده ان يركز عليه».
 *
 * فالعنوانُ والنصُّ هنا **مسوّدتان** تُملآن بهما الخانتان ثمّ تُحرَّران.
 * وما لا يُحرَّر قائمةُ التغييرات وحدَها — تُلحق بالرسالة في الخادم
 * (`contractResignMail`)، وعلّتُها هناك.
 */

import { feeBasisAr, type ContractCompensation } from './contract-body'

export const RESIGN_SUBJECT_MIN = 3
export const RESIGN_SUBJECT_MAX = 200
export const RESIGN_BODY_MIN = 10
export const RESIGN_BODY_MAX = 6000

/** سببُ الإغلاق. ولا يبدأ بـ«رُفض التوقيع» بقصد: شاشةُ العقود تبني لوحَ رفض
 *  التوقيع على تلك البادئة، وهذا سحبٌ لا رفض. ولا يحمل رمزَي الإصدارين
 *  (١ أكتوبر ٢٠٢٦: «no need») — فهو يُعرَض، والإصداران في الأثر
 *  (`fromVersion` و`toVersion`). */
export const RESIGN_REVOKE_REASON_AR = 'أُعيد للتوقيع على نصٍّ محدَّث'

/** عنوانُ القسم الذي لا يُحذَف من الرسالة */
export const RESIGN_CHANGES_HEADING_AR = 'ما تغيّر في نصّ عقدك'

export const DEFAULT_RESIGN_SUBJECT_AR = 'شكرا لتوقيعك — وعقدُك عاد إليك محدَّثا'

/** النصُّ المقترَح. والفقرةُ الأخيرةُ تبقى فيه بقصد: تقول للمدرّب إنّ له
 *  أن يعتذر بلا تبعة (البند 2-11) — وهي ما يحمي الأكاديميّةَ من قولٍ بعدُ
 *  إنّه حُمل على التوقيع ثانيةً. */
export function defaultResignBodyAr(title: string): string {
  return [
    `شكرا لك على توقيع «${title}». ولم تكن الأكاديميّةُ قد اعتمدت توقيعَها بعد، فلم تصر الاتفاقيّةُ نافذةً بيننا (البند 2-6). ولا شيءَ في توقيعك: هو صحيحٌ ومسجَّلٌ عندنا بتاريخه.`,
    'وقد راجعنا نصَّ الاتفاقيّة على ملاحظاتٍ وصلتنا من مدرّبين ومن مختصّين، فحدّثناه ليكون أوضحَ للطرفين. ونعرض عليك النسخةَ المحدَّثةَ لتوقّعها، وما تغيّر فيها مبيَّنٌ أدناه.',
    'ولك أن توقّع المحدَّثةَ أو تعتذر عنها، ولا يترتّب على أيٍّ منهما شيءٌ عليك ولا لنا (البند 2-11). ورابطُ النسخة الجديدة يصلك في رسالةٍ تالية.',
  ].join('\n\n')
}

/** نصُّ الموظّف فقراتٍ — يفصل بينها سطرٌ فارغ، كما يُكتب في الخانة */
export function resignParagraphs(bodyAr: string): string[] {
  return bodyAr.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
}

/* ═══ وما تغيّر في شروطه هو — لا في القالب وحدَه (١ أكتوبر ٢٠٢٦) ═══

   صارت الإعادةُ تقبل تغييرَ أتعابه ودوراتِه وبنودِه الخاصّة. والقسمُ الذي لا
   يُحذَف من الرسالة («ما تغيّر في نصّ عقدك») كان يعدّ تغييرَ القالب وحدَه —
   فلو خُفّض أجرُه في الإعادة لَوصلته رسالةٌ تعدّ تحسينَ الصياغة وتسكت عن
   أجره. وهي العلّةُ نفسُها التي جعلت القسمَ لا يُحذَف أصلا.

   فيُحسب هنا ما تغيّر **فيه هو** ويتقدّم القائمة. والدالّةُ خالصةٌ يقرؤها
   الخادمُ لما يُرسَل والشاشةُ لما تُعاينه — فما يُعايَن هو ما يُرسَل. */

export interface ResignTerms {
  compensation: ContractCompensation | null
  courses: readonly { courseId: string; titleAr: string }[]
  specialTermsAr: string | null
}

/* والأجرُ يُقابَل بأرقامه لا بنصّه: «25» و«25.00» أجرٌ واحد */
function sameFee(a: ContractCompensation | null, b: ContractCompensation | null): boolean {
  if (!a || !b) return a === b
  return a.type === b.type
    && Number(a.rate) === Number(b.rate)
    && a.currency === b.currency
    && (a.minSeats ?? 0) === (b.minSeats ?? 0)
    && Number(a.referralRate ?? 0) === Number(b.referralRate ?? 0)
}

const NO_FEE_AR = 'بلا أجرٍ متّفقٍ عليه'

/** ما تغيّر في شروطه هو — جملةً لكلّ تغيير، و`[]` لما لم يتغيّر فيه شيء */
export function personalChangesAr(before: ResignTerms, after: ResignTerms): string[] {
  const out: string[] = []
  if (!sameFee(before.compensation, after.compensation)) {
    const was = before.compensation ? feeBasisAr(before.compensation) : NO_FEE_AR
    const now = after.compensation ? feeBasisAr(after.compensation) : NO_FEE_AR
    out.push(`تغيّر أساسُ أتعابك (الملحق ب) — كان: ${was} وصار: ${now}`)
  }
  const had = new Set(before.courses.map((c) => c.courseId))
  const has = new Set(after.courses.map((c) => c.courseId))
  const added = after.courses.filter((c) => !had.has(c.courseId)).map((c) => c.titleAr)
  const removed = before.courses.filter((c) => !has.has(c.courseId)).map((c) => c.titleAr)
  if (added.length > 0) out.push(`أُضيف إلى الدورات المؤهَّل لها (الملحق أ): ${added.join('، ')}.`)
  if (removed.length > 0) out.push(`ورُفع من الدورات المؤهَّل لها (الملحق أ): ${removed.join('، ')}.`)
  const sb = (before.specialTermsAr ?? '').trim()
  const sa = (after.specialTermsAr ?? '').trim()
  if (!sb && sa) out.push('وأُضيفت إلى عقدك بنودٌ خاصّةٌ بك (البند 21) — اقرأها في العقد.')
  else if (sb && !sa) out.push('ورُفعت من عقدك البنودُ الخاصّةُ بك (البند 21).')
  else if (sb !== sa) out.push('وتغيّرت البنودُ الخاصّةُ بك (البند 21) — اقرأها في العقد.')
  return out
}
