/* لمن هذه الشعبة، وماذا يريد متعلّمُها منها — بمفردات التشخيص نفسِها.

   ═══ القرار (٦ أكتوبر ٢٠٢٦) ═══

   سأل صاحبُ المنصّة: «أهناك سؤالٌ آخرُ نسأله المدرّبين عن هدف كلّ دورة، يساعد
   أداةَ التشخيص أن تصل إلى المتعلّم الصحيح؟». فعُرضت عليه الخياراتُ بفروقها،
   واختار: **سؤالان** — لمن هي (المرحلةُ المهنيّة) وماذا يريد المتعلّمُ منها
   (الهدف) — و**يُجمعان الآن ولا يُوصَلان بالتشخيص بعد** (الخيار C): يراهما
   المدرّبُ والمعتمِدُ، ويُقرَّر كيف يُقرأان في المطابقة حين تتراكم إجاباتٌ.

   ═══ ولماذا قوائمُ التشخيص لا نصٌّ حرّ ═══

   المطابقُ لا يقرأ نصّا. والمتعلّمُ يجيب في التشخيص عن مرحلته من عشرٍ وعن هدفه
   من ستّةَ عشر (`domain/diagnostic/v2_1/maps.ts`) — فإن أجاب المدرّبُ بالرموز
   نفسِها صار الوصلُ يوما ما مقابلةَ رمزٍ برمز، بلا ترجمةٍ ولا تخمين. فالقوائمُ
   تُقرأ من هناك ولا تُنسخ: رمزٌ يُضاف إلى التشخيص يظهر هنا وحدَه.

   ثمّ اختار في تفاصيلهما (اليومَ نفسَه): **إلزاميّان كالمستوى** — ما دامت الخطّةُ في
   يد المدرّب، ومن أرسل قبل القرار يمضي (`levelRequired`) — و**بحدٍّ**: ثلاثُ مراحلَ
   وهدفان، و**الأهدافُ تضيق بالمراحل المختارة**.

   وسقط من كلٍّ خيارُ «غير متأكد»: سؤالٌ للمتعلّم الحائر، لا وصفٌ لشعبة.
   والأهدافُ تُعرض بما يناسب المراحلَ المختارة (حقلُ `stages` في كلّ هدف) — فمن
   قال «طالب جامعي» لا يُعرض عليه «تنمية مشروعي القائم». */

import { CAREER_STAGE_LABELS_AR, GOALS_V21, type CareerStage } from '../../domain/diagnostic/v2_1/maps'
import { levelRequired } from './cohort-level'

/** المراحلُ التي تُعرض — مراحلُ التشخيص بترتيبها، بلا «غير ذلك / غير متأكد» */
export const AUDIENCE_STAGES = (Object.keys(CAREER_STAGE_LABELS_AR) as CareerStage[])
  .filter((s) => s !== 'other_unsure')

/** الأهدافُ التي تُعرض — أهدافُ التشخيص بترتيبها، بلا «غير متأكد» */
export const AUDIENCE_GOALS = GOALS_V21.filter((g) => g.code !== 'unsure_goal')

/** أقصى ما يُختار: ثلاثُ مراحل وهدفان — الشعبةُ التي «لكلّ أحد» لا تصف أحدا */
export const MAX_AUDIENCE_STAGES = 3
export const MAX_AUDIENCE_GOALS = 2

export interface CohortAudience { stages: CareerStage[]; goals: string[] }

const stageSet = new Set<string>(AUDIENCE_STAGES)
const goalSet = new Set<string>(AUDIENCE_GOALS.map((g) => g.code))

/** ما حُفظ إن كان صالحا — رموزٌ معروفةٌ بلا تكرارٍ وفي حدّها، وما عداها يسقط */
export function asAudience(v: unknown): CohortAudience {
  const raw = (v && typeof v === 'object' ? v : {}) as { stages?: unknown; goals?: unknown }
  const pick = (list: unknown, ok: Set<string>, max: number) =>
    [...new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string' && ok.has(x)) : [])].slice(0, max)
  return {
    stages: pick(raw.stages, stageSet, MAX_AUDIENCE_STAGES) as CareerStage[],
    goals: pick(raw.goals, goalSet, MAX_AUDIENCE_GOALS),
  }
}

/** الأهدافُ التي تناسب المراحلَ المختارة — وبلا مرحلةٍ مختارةٍ كلُّها */
export function goalsFor(stages: readonly CareerStage[]) {
  if (stages.length === 0) return AUDIENCE_GOALS
  return AUDIENCE_GOALS.filter((g) => g.stages === 'all' || g.stages.some((s) => stages.includes(s)))
}

/* ═══ النقرُ — والحدُّ يُقال ولا يُبتلع ═══

   نقرُ المختار ينزعه. ونقرُ غيره يضيفه ما بقي في الحدّ متّسع؛ وإلّا بقي كما
   هو والشاشةُ تقول «انزع واحدا لتختار غيره» — لا يُستبدل الأقدمُ صامتا. */
export function toggleIn<T extends string>(list: readonly T[], v: T, max: number): T[] {
  if (list.includes(v)) return list.filter((x) => x !== v)
  return list.length >= max ? [...list] : [...list, v]
}

/** المراحلُ تتبدّل — فيسقط من الأهداف ما لم يعد يناسبها */
export function withStages(a: CohortAudience, stages: CareerStage[]): CohortAudience {
  const fit = new Set(goalsFor(stages).map((g) => g.code))
  return { stages, goals: a.goals.filter((g) => fit.has(g)) }
}

export const stageLabelAr = (s: string) => CAREER_STAGE_LABELS_AR[s as CareerStage] ?? s
export const goalLabelAr = (code: string) => AUDIENCE_GOALS.find((g) => g.code === code)?.label_ar ?? code

/** «طالب جامعي · خريج حديث» — أو `null` بلا شيء */
export const stagesAr = (a: CohortAudience) => (a.stages.length ? a.stages.map(stageLabelAr).join(' · ') : null)
export const goalsAr = (a: CohortAudience) => (a.goals.length ? a.goals.map(goalLabelAr).join(' · ') : null)

/** ما ينقص الخطوةَ الأولى من جهة الجمهور — بلغة من يصحّحه، أو `null`.
    والإلزامُ إلزامُ المستوى نفسُه: ما دامت الخطّةُ في يده (`levelRequired`). */
export function audienceProblem(content: { audience?: unknown } | null | undefined, planStatus: string): string | null {
  if (!levelRequired(planStatus)) return null
  const a = asAudience(content?.audience)
  if (a.stages.length === 0 && a.goals.length === 0) return 'اختر لمن هذه الشعبة، وماذا يريد متعلّمُها أن يحقّق بها'
  if (a.stages.length === 0) return 'اختر لمن هذه الشعبة — مرحلةً واحدةً على الأقلّ'
  if (a.goals.length === 0) return 'اختر ماذا يريد متعلّمُها أن يحقّق بها — هدفا واحدا على الأقلّ'
  return null
}
