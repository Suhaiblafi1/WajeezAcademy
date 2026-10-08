/* أين يهبط المتعلّمُ حين تكون نتيجتُه دورةً واحدة.

   ── ما وقع (٨ أكتوبر ٢٠٢٦) ──

   صار التشخيصُ يرشّح دورةً قائمةً بنفسها (#466)، ونوعُ نتيجتها `single_course`
   ومعرّفُها في `pathway_id` معرّفُ دورةٍ لا مسار. والواجهةُ تبني «المسارَ
   الأوّل» بـ`pathwayById` — فلا تجده، فيبقى `top` فارغا. وكلُّ نتيجةٍ بلا
   `top` تقع في الفرع الذي بُني للاستكشاف ولإحالة المستشار، فقرأ من رُشّحت له
   دورةٌ: «حالتك تستحق مستشارًا بشريًا قبل الترشيح». أي أنّ المحرّك حسم
   النتيجة وصدقت، والشاشةُ قالت عكسها.

   والمحفوظةُ منها كانت تُحذف كذلك: `referencesAlive` لا تعرف هذا النوع،
   فتطلب مسارا لا يوجد، فتُرمى النتيجةُ ويُطلب من صاحبها أن يعيد التشخيص.

   ── والوجهة ──

   صفحةُ الدورة الواحدة `/build/:courseId` — وهي ما يفتحه الكتالوجُ نفسُه حين
   يُختار منه دورةٌ بعينها: تفاصيلُها كاملة، وسعرُها، وما يُبنى عليها. فمن
   رشّح له التشخيصُ دورةً يصل حيث يصل من اختارها بنفسه. */

import { courseById } from '../../data/courses'

/** معرّفُ الدورة إن كانت النتيجةُ دورةً واحدةً موجودةً في الكتالوج الحيّ، وإلّا null */
export function singleCourseOf(resultJson: Record<string, unknown>): string | null {
  if (resultJson.kind !== 'single_course') return null
  /* خطّةٌ بخيارين لا تختار عنه دورةً واحدة — انظر `englishChoiceOf` أدناه */
  if (englishChoiceOf(resultJson)) return null
  const id = resultJson.pathway_id
  return typeof id === 'string' && courseById(id) !== undefined ? id : null
}

/* ── وخطّةُ الإنجليزيّة ذاتُ الخيارين تبقى في شاشة النتيجة (٨ أكتوبر ٢٠٢٦) ──

   قرّر صاحبُ المنصّة للمبتدئ الذي يريد الإنجليزيّةَ للعمل أو للاختبار أن يُعرض
   عليه **الخياران معا** ويختار هو — المستوى العامّ أوّلا ثمّ دورةُ غرضه، أو دورةُ
   غرضه مباشرةً. والهبوطُ على صفحة دورةٍ واحدةٍ يختار عنه. فحين تحمل الخطّةُ أكثرَ
   من خيارٍ أو خيارا من دورتين تبقى النتيجةُ شاشةً يُقرأ فيها الفرق. */
export interface EnglishPlanView {
  purpose: string
  cefr: string
  above_general: boolean
  headline_ar: string
  placement_note_ar: string
  options: { course_ids: string[]; title_ar: string; difference_ar: string; suggested: boolean }[]
}

export function englishChoiceOf(resultJson: Record<string, unknown>): EnglishPlanView | null {
  const plan = resultJson.english_plan as EnglishPlanView | null | undefined
  if (!plan || !Array.isArray(plan.options) || plan.options.length === 0) return null
  const choice = plan.options.length > 1 || plan.options.some((o) => o.course_ids.length > 1)
  return choice ? plan : null
}
