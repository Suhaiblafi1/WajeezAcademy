/* التخصّصُ الذي يسمّيه المتعلّم، والمستوى في المجال الذي اختاره.

   ═══ ١) أسئلةٌ فرعيّةٌ داخل احتياجٍ قائم (قرارُ صاحب المنصّة، ٨ أكتوبر ٢٠٢٦) ═══

   الشبكاتُ والسحابةُ وبيعُ التجزئة دوراتٌ مرشَّحةٌ وحدَها ولا يصلها أحد: لا
   جوابَ في التشخيص يميّز جمهورَها. فخُيّر صاحبُ المنصّة بين خياراتٍ جديدةٍ في
   القائمة الأمّ وأسئلةٍ فرعيّةٍ داخل ما فيها، فاختار الفرعيّة — القائمةُ تبقى
   قصيرة، ولا يُسأل السؤالَ الزائدَ إلّا من في المجال:

     الأمنُ السيبرانيّ ← حمايةُ البيانات · الشبكات · السحابة
     المبيعات        ← بين الشركات · متجرٌ أو صالة عرض · عبر الإنترنت

   وبابٌ واحدٌ جديدٌ في القائمة الأمّ: «البرمجة وتطوير الويب».

   ── ومن سمّى تخصّصا له دورتُه، فله دورتُه ──

   الخيارُ الذي له دورةٌ يحسم النتيجة: لا يُسأل بعده عن مهاراتِ مسارٍ لن يفوز،
   ويُعرض المسارُ الأوسعُ بديلا لمن أراد أكثر. وما لا دورةَ له (حمايةُ البيانات،
   والبيعُ بين الشركات) يمضي إلى السباق كما كان.

   ── ولا يُعرض خيارٌ لا يصل ──

   جمهورُ كلّ دورةٍ معلَنٌ بقرار صاحب المنصّة (`diagnostic_stages`). فخيارُ
   الشبكات لا يُعرض على مديرٍ ليست دورتُه لجمهوره — وإن لم يبقَ للمتعلّم خيارٌ
   له دورة، لم يُسأل السؤالُ أصلا: سؤالٌ كلُّ أجوبته تؤدّي إلى الشيء نفسِه
   مقعدٌ ميّتٌ من وقته (`audit-question-waste`).

   ═══ ٢) المستوى في المجال — لا مستوى واحدٌ لكلّ شيء ═══

   كان «مستوى المتعلّم» واحدا: مرحلتُه المهنيّة، يرفعه درجةً متوسّطُ ما قيّم
   به مهاراته كلَّها. فمديرُ مبيعاتٍ متقدّمٌ مبتدئٌ في البيانات يُعطى دوراتِ
   بياناتٍ متقدّمة. فقرّر صاحبُ المنصّة (٨ أكتوبر ٢٠٢٦) سؤالا قصيرا داخل المجال
   الذي اختاره، بأوصافٍ يتعرّف فيها على نفسه — ووراءها درجاتُ الكتالوج الأربع
   (تأسيسيّ · تأسيسيّ–تطبيقيّ · تطبيقيّ · ممارس). ودوراتُ ذلك المجال تُطابَق
   عليه، وما خارجه يبقى على مرحلته. */

import { courseById } from '../catalog'
import { needByCode, Q, type CareerStage } from './maps'

export interface FocusOption {
  value: string
  label_ar: string
  /** الدورةُ التي يحسمها هذا الخيار — null: يمضي إلى السباق */
  course_id: string | null
}

export interface SubFocus {
  questionId: string
  needCode: string
  factKey: string
  text_ar: string
  options: FocusOption[]
}

export const SUB_FOCUS: SubFocus[] = [
  {
    questionId: Q.CYBER_FOCUS,
    needCode: 'need_cyber',
    factKey: 'cyber_focus',
    text_ar: 'أيُّ جانبٍ من الأمن والتقنية تريده أوّلا؟',
    options: [
      { value: 'data_protection', label_ar: 'حمايةُ البيانات وأمنُ المؤسّسة', course_id: null },
      { value: 'networks', label_ar: 'الشبكاتُ وأمنُها', course_id: 'C-CYB-106' },
      { value: 'cloud', label_ar: 'الحوسبةُ السحابيّة', course_id: 'C-CYB-107' },
    ],
  },
  {
    questionId: Q.SALES_CHANNEL,
    needCode: 'need_sales',
    factKey: 'sales_channel',
    text_ar: 'أين تبيع، أو أين تريد أن تبيع؟',
    options: [
      { value: 'b2b', label_ar: 'لشركاتٍ وحسابات — بيعٌ بين الشركات', course_id: null },
      { value: 'retail', label_ar: 'في متجرٍ أو صالة عرض', course_id: 'C-SAL-106' },
      { value: 'online', label_ar: 'عبر الإنترنت ووسائل التواصل', course_id: 'C-MKT-106' },
    ],
  },
]

/** احتياجٌ يسمّي دورتَه بنفسه — بلا سؤالٍ فرعيّ */
export const NEED_FOCUS_COURSE: Readonly<Record<string, string>> = {
  need_programming: 'C-WEB-101',
}

export function subFocusById(questionId: string): SubFocus | undefined {
  return SUB_FOCUS.find((s) => s.questionId === questionId)
}

/** هل جمهورُ الدورة المعلَنُ يشمل هذه المرحلة؟ — قرارُ صاحب المنصّة لكلّ دورة */
export function courseServesStage(courseId: string, stage: CareerStage | null): boolean {
  if (!stage) return false
  const course = courseById.get(courseId)
  if (!course || course.recommendable_directly !== true) return false
  return (course.diagnostic_stages ?? []).includes(stage)
}

/** خياراتُ السؤال الفرعيّ لهذه المرحلة — ما له دورةٌ لا تخدمها يُحذف */
export function subFocusOptionsFor(sub: SubFocus, stage: CareerStage | null): FocusOption[] {
  return sub.options.filter((o) => o.course_id === null || courseServesStage(o.course_id, stage))
}

/** يُسأل السؤالُ الفرعيّ؟ — حين يبقى له خيارٌ يحسم دورة، وإلّا فكلُّ أجوبته واحد */
export function subFocusAsks(sub: SubFocus, stage: CareerStage | null): boolean {
  return subFocusOptionsFor(sub, stage).some((o) => o.course_id !== null)
}

type Facts = Record<string, { value: unknown } | undefined>

/** الدورةُ التي حسمها المتعلّمُ بتخصّصه — أو null حين يمضي إلى السباق */
export function focusCourseOf(facts: Facts): string | null {
  const need = facts['need_id']?.value
  const stage = (facts['career_stage']?.value as CareerStage | undefined) ?? null
  if (typeof need !== 'string') return null
  const direct = NEED_FOCUS_COURSE[need]
  if (direct) return courseServesStage(direct, stage) ? direct : null
  for (const sub of SUB_FOCUS) {
    if (sub.needCode !== need) continue
    const value = facts[sub.factKey]?.value
    const opt = sub.options.find((o) => o.value === value)
    if (opt?.course_id && courseServesStage(opt.course_id, stage)) return opt.course_id
  }
  return null
}

/* ═══ المستوى في المجال ═══ */

/** الأوصافُ الأربعة بترتيب درجات الكتالوج — الموضعُ هو الدرجة */
export const FIELD_LEVELS: { code: string; label_ar: string; name_ar: string }[] = [
  { code: 'none', label_ar: 'لم أمارسه بعد', name_ar: 'مبتدئ' },
  { code: 'basics', label_ar: 'أعرف أساسيّاته وأحتاج من يوجّهني', name_ar: 'أساسيّ' },
  { code: 'independent', label_ar: 'أمارسه وحدي بانتظام', name_ar: 'متوسّط' },
  { code: 'lead', label_ar: 'أقود غيري فيه أو أعلّمه', name_ar: 'متقدّم' },
]

/** درجةُ المتعلّم في مجاله (٠..٣) — أو null إن لم يُسأل */
export function fieldLevelOf(facts: Facts): number | null {
  const code = facts['field_level']?.value
  const i = FIELD_LEVELS.findIndex((l) => l.code === code)
  return i >= 0 ? i : null
}

/** مجالاتُ الاحتياج الذي سُئل عنه المستوى */
export function fieldDomainsOf(facts: Facts): string[] {
  const need = facts['need_id']?.value
  return typeof need === 'string' ? [...(needByCode(need)?.domains ?? [])] : []
}

/** يُسأل عن المستوى؟ — حين يكون للاحتياج مجالٌ تُطابَق دوراتُه عليه */
export function fieldLevelAsks(facts: Facts): boolean {
  const need = facts['need_id']?.value
  if (typeof need !== 'string' || need === 'need_english' || need === 'need_unsure') return false
  return fieldDomainsOf(facts).length > 0
}

/** نصُّ سؤال المستوى باسم المجال الذي اختاره — لا «المجال الذي اخترته» مجرّدا */
export function fieldLevelText(facts: Facts): string {
  const need = facts['need_id']?.value
  const label = typeof need === 'string' ? needByCode(need)?.label_ar : undefined
  return label ? `وفي «${label}»، أيُّ وصفٍ يقترب منك؟` : 'وفي المجال الذي اخترته، أيُّ وصفٍ يقترب منك؟'
}
