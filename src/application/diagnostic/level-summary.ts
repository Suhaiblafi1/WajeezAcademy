/* مستواك كما فهمناه — وسببُه، وبابُ تعديله (قرارُ صاحب المنصّة، ٨ أكتوبر ٢٠٢٦).

   قرّر صاحبُ المنصّة أن تُعرض في النتيجة ثلاثةٌ معا: **المستوى** («مستواك في
   تحليل البيانات: مبتدئ»)، و**سببُه** (جوابُك الذي بُني عليه)، و**بابٌ لتعديله**
   («ليس دقيقا؟ غيّر مستواي») يحدّث الدوراتِ في مكانها — بلا إعادة التشخيص كلِّه.
   فالمتعلّمُ يرى ما فهمناه عنه ولماذا، ويبقى القرارُ له.

   والتعديلُ رابطٌ لا حالةٌ في الصفحة: صفحةُ المسار وصفحةُ الدورة لا تحملان جلسةً
   حيّة. فالرابطُ يعود إلى التشخيص بالسؤال والخيار، فيُستأنف من الجهاز ويُعدَّل
   الجوابُ ويُعاد بناءُ النتيجة — وهي الحتميّةُ نفسُها: نفسُ الأجوبة ← نفسُ النتيجة. */

import { Q, needByCode } from '../../domain/diagnostic/v2_1/maps'
import { ENGLISH_LEVELS } from '../../domain/diagnostic/v2_1/english'
import { FIELD_LEVELS } from '../../domain/diagnostic/v2_1/focus'

export interface LevelOption {
  option_id: string
  label_ar: string
  name_ar: string
}

export interface LevelSummary {
  question_id: string
  field_ar: string
  level_name_ar: string
  /** الجوابُ الذي بُني عليه — بنصّه كما اختاره */
  answer_ar: string
  current_option_id: string
  options: LevelOption[]
}

/** الأسئلةُ التي يُعدَّل بها المستوى من النتيجة — لا غيرُها */
export const REVISABLE_LEVEL_QUESTIONS: readonly string[] = [Q.FIELD_LEVEL, Q.ENGLISH_LEVEL]
export const REVISE_PARAM = 'revise'
export const REVISE_TO_PARAM = 'to'

type Facts = Record<string, { value: unknown } | undefined>

export function levelSummaryOf(facts: Facts): LevelSummary | null {
  const english = facts['english_level']?.value
  if (facts['need_id']?.value === 'need_english' && typeof english === 'string') {
    const i = ENGLISH_LEVELS.findIndex((l) => l.code === english)
    if (i < 0) return null
    return {
      question_id: Q.ENGLISH_LEVEL,
      field_ar: 'اللغة الإنجليزية',
      level_name_ar: ENGLISH_LEVELS[i].cefr,
      answer_ar: ENGLISH_LEVELS[i].label_ar,
      current_option_id: `o${i + 1}`,
      options: ENGLISH_LEVELS.map((l, k) => ({ option_id: `o${k + 1}`, label_ar: l.label_ar, name_ar: l.cefr })),
    }
  }
  const field = facts['field_level']?.value
  const need = facts['need_id']?.value
  if (typeof field !== 'string' || typeof need !== 'string') return null
  const i = FIELD_LEVELS.findIndex((l) => l.code === field)
  const label = needByCode(need)?.label_ar
  if (i < 0 || !label) return null
  return {
    question_id: Q.FIELD_LEVEL,
    field_ar: label,
    level_name_ar: FIELD_LEVELS[i].name_ar,
    answer_ar: FIELD_LEVELS[i].label_ar,
    current_option_id: `o${i + 1}`,
    options: FIELD_LEVELS.map((l, k) => ({ option_id: `o${k + 1}`, label_ar: l.label_ar, name_ar: l.name_ar })),
  }
}

/** رابطُ تعديل المستوى — يعود إلى التشخيص بالسؤال والخيار */
export function reviseLevelHref(questionId: string, optionId: string): string {
  return `/diagnostic?${REVISE_PARAM}=${encodeURIComponent(questionId)}&${REVISE_TO_PARAM}=${encodeURIComponent(optionId)}`
}

/** يقرأ طلبَ التعديل من الرابط — وما ليس سؤالَ مستوى أو خيارا صحيحا يُتجاهَل */
export function parseReviseRequest(params: { get(name: string): string | null }): { questionId: string; optionId: string } | null {
  const questionId = params.get(REVISE_PARAM)
  const optionId = params.get(REVISE_TO_PARAM)
  if (!questionId || !optionId) return null
  if (!REVISABLE_LEVEL_QUESTIONS.includes(questionId)) return null
  if (!/^o\d{1,2}$/.test(optionId)) return null
  return { questionId, optionId }
}

/** نصُّ الخيار الذي يُعدَّل إليه — من مصدر السؤال نفسِه، لا من الرابط */
export function levelLabelOf(questionId: string, optionId: string): string | null {
  const i = Number(optionId.slice(1)) - 1
  const list = questionId === Q.ENGLISH_LEVEL ? ENGLISH_LEVELS : questionId === Q.FIELD_LEVEL ? FIELD_LEVELS : []
  return list[i]?.label_ar ?? null
}

/** نصُّ السطر: «مستواك في X: Y — بناءً على جوابك: «Z»» */
export function levelLineText(s: LevelSummary): { level_ar: string; why_ar: string } {
  return {
    level_ar: `مستواك في «${s.field_ar}»: ${s.level_name_ar}`,
    why_ar: `بناءً على جوابك: «${s.answer_ar}»`,
  }
}

/** سطرُ المستوى لصفحة دورةٍ — حين كانت نتيجةُ التشخيص هذه الدورةَ أو أحدَ خيارَي
    خطّة الإنجليزيّة. ولغيرها لا سطر: صفحةُ دورةٍ فتحها من الكتالوج لا تقول له
    «مستواك» عن تشخيصٍ لم يقُدها إليها. */
export function levelSummaryForCourse(courseId: string, resultJson: Record<string, unknown> | null | undefined): LevelSummary | null {
  if (!resultJson || resultJson.kind !== 'single_course') return null
  const plan = resultJson.english_plan as { options?: { course_ids: string[] }[] } | null | undefined
  const mine = resultJson.pathway_id === courseId || (plan?.options ?? []).some((o) => o.course_ids.includes(courseId))
  return mine ? ((resultJson.level_summary as LevelSummary | null | undefined) ?? null) : null
}
