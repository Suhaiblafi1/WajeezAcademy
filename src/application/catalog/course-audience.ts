/* ═══ «لمن هذه الدورة» — من الكتالوج ومن مدرّبي شعبها (٢٠ أكتوبر ٢٠٢٦) ═══

   طلبُ صاحب المنصّة: «طوّر قسم "لمن هذه الدورة" ليكون أكثر احترافا وجاذبيّة، واستعن بما كتبه
   المدرّبون بشعبهم.. لكلّ الدورات سواءٌ لها شعبٌ أو لا». وكان القسمُ سطرَ الكتالوج وحدَه بلونٍ باهت.

   فصار يُبنى من مصدرين:
   · **الكتالوج** — لكلّ دورة: وصفُ من تناسبه، ومستواها (`level_ar`)، وما يلزم قبلها. فلا دورةَ يفرغ قسمُها.
   · **مدرّبو شعبها المعروضة** — ما اختاروه في الخطوة الأولى لكلّ شعبة: مراحلُ متعلّمها وأهدافُه
     (`cohort-audience.ts`) ومستواها (`cohort-level.ts`). وكانا «يراهما المدرّبُ والمعتمِدُ وحدَهما»؛
     وطلبُ اليوم يرفع ذلك — ومن الخطّة المعتمَدة وحدَها، كما تُعلَن النبذة (`cohort-summary.ts`).

   والمستوى من المدرّبين أوّلا: هو أعلمُ بمن يخاطب في شعبته، والكتالوجُ احتياطٌ حين لا شعبةَ قالت.
   وشعبتان بمستويين يُجمع مداهما — «من مبتدئ إلى متقدّم» أصدقُ من اختيار إحداهما.

   والمراحلُ والأهدافُ مرتّبةٌ بعدد الشعب التي اختارتها، ثمّ بترتيب التشخيص — ولها سقف: قائمةٌ
   تعدّ الناسَ كلَّهم لا تصف أحدا. والنصُّ يمرّ بـ`plainAr`: الكتالوجُ كُتب قبل قرار التشكيل. */

import { plainAr } from '../text/plain-ar'
import { AUDIENCE_GOALS, AUDIENCE_STAGES, goalLabelAr, stageLabelAr, type CohortAudience } from '../trainer/cohort-audience'
import { COHORT_LEVELS, levelRangeAr, type CohortLevel, type LevelRange } from '../trainer/cohort-level'

/** أقصى ما يُعرض: أربعُ مراحلَ وثلاثةُ أهداف */
export const MAX_SHOWN_STAGES = 4
export const MAX_SHOWN_GOALS = 3

/** مستوى الكتالوج على سلّم الشعبة — الصيغُ الأربعُ كما في `course-fit.ts`، بشرطتيها */
const CATALOG_LEVEL: Record<string, LevelRange> = {
  'تأسيسي': { from: 'beginner', to: 'beginner' },
  'تأسيسي–تطبيقي': { from: 'beginner', to: 'intermediate' },
  'تأسيسي-تطبيقي': { from: 'beginner', to: 'intermediate' },
  'تأسيسي إلى ممارس': { from: 'beginner', to: 'intermediate' },
  'تطبيقي': { from: 'intermediate', to: 'intermediate' },
  'ممارس': { from: 'advanced', to: 'advanced' },
}

/** ما يقرؤه القسمُ من الدورة — حقولُ `CourseFull` نفسُها */
export interface CourseAudienceSource { targetAudience: string; prerequisites: string; level: string }

/** وما يقرؤه من الشعبة — `CohortOption` يحملهما */
export interface CohortAudienceSource { level: LevelRange | null; audience: CohortAudience }

export interface CourseAudienceView {
  /** وصفُ من تناسبه — من الكتالوج */
  lead: string | null
  /** مراحلُ متعلّمها كما اختارها المدرّبون — بالعربيّة */
  stages: string[]
  /** وأهدافُه */
  goals: string[]
  /** «متوسّط» أو «من مبتدئ إلى متوسّط» */
  level: string | null
  prerequisites: string | null
  /** كم شعبةً أسهمت بشيء — صفرٌ حين القسمُ كلُّه من الكتالوج */
  fromCohorts: number
}

const rank = (lv: CohortLevel) => COHORT_LEVELS.indexOf(lv)

/** الرموزُ مرتّبةً بعدد من اختارها ثمّ بترتيبها في التشخيص، في حدّها */
function ranked(lists: readonly (readonly string[])[], order: readonly string[], max: number): string[] {
  const count = new Map<string, number>()
  for (const list of lists) for (const code of new Set(list)) count.set(code, (count.get(code) ?? 0) + 1)
  return [...count.keys()]
    .sort((a, b) => (count.get(b)! - count.get(a)!) || (order.indexOf(a) - order.indexOf(b)))
    .slice(0, max)
}

/** مدى الشعب مجموعا — أدنى بدايةٍ إلى أعلى نهاية — أو `null` حين لم تقل شعبة */
function mergedLevel(ranges: readonly (LevelRange | null)[]): LevelRange | null {
  const known = ranges.filter((r): r is LevelRange => r !== null)
  if (known.length === 0) return null
  return {
    from: known.reduce((lo, r) => (rank(r.from) < rank(lo) ? r.from : lo), known[0].from),
    to: known.reduce((hi, r) => (rank(r.to) > rank(hi) ? r.to : hi), known[0].to),
  }
}

const text = (s: string) => (s.trim() ? plainAr(s.trim()) : null)

export function courseAudienceView(course: CourseAudienceSource, cohorts: readonly CohortAudienceSource[]): CourseAudienceView {
  const fromCohorts = cohorts.filter((c) => c.level || c.audience.stages.length || c.audience.goals.length).length
  const level = mergedLevel(cohorts.map((c) => c.level)) ?? CATALOG_LEVEL[course.level.trim()] ?? null
  return {
    lead: text(course.targetAudience),
    stages: ranked(cohorts.map((c) => c.audience.stages), AUDIENCE_STAGES, MAX_SHOWN_STAGES).map(stageLabelAr),
    goals: ranked(cohorts.map((c) => c.audience.goals), AUDIENCE_GOALS.map((g) => g.code), MAX_SHOWN_GOALS).map(goalLabelAr),
    level: levelRangeAr(level) ?? text(course.level),
    prerequisites: text(course.prerequisites),
    fromCohorts,
  }
}
