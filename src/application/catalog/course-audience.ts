/* ═══ «لمن هذه الدورة» — من الكتالوج ومن مدرّبي شعبها (٢٠ أكتوبر ٢٠٢٦) ═══

   طلبُ صاحب المنصّة: «طوّر قسم "لمن هذه الدورة" ليكون أكثر احترافا وجاذبيّة، واستعن بما كتبه
   المدرّبون بشعبهم.. لكلّ الدورات سواءٌ لها شعبٌ أو لا». وكان القسمُ سطرَ الكتالوج وحدَه بلونٍ باهت.

   فصار يُبنى من مصدرين:
   · **الكتالوج** — لكلّ دورة وصفُ من تناسبه. فلا دورةَ يفرغ قسمُها.
   · **مدرّبو شعبها المعروضة** — ما اختاروه في الخطوة الأولى لكلّ شعبة: مراحلُ متعلّمها وأهدافُه
     (`cohort-audience.ts`). وكانا «يراهما المدرّبُ والمعتمِدُ وحدَهما»؛ وطلبُ اليوم يرفع ذلك — ومن
     الخطّة المعتمَدة وحدَها، كما تُعلَن النبذة (`cohort-summary.ts`).

   وسقط منه المستوى و«قبلها» اليومَ نفسَه بقراره: «موجودٌ داخل تفاصيل الشعبة، ولكي لا يزيد النصّ هنا».
   فالمستوى باقٍ للمدرّب والمعتمِد كما كان (`cohort-level.ts`).

   والمراحلُ والأهدافُ مرتّبةٌ بعدد الشعب التي اختارتها، ثمّ بترتيب التشخيص — ولها سقف: قائمةٌ
   تعدّ الناسَ كلَّهم لا تصف أحدا. والنصُّ يمرّ بـ`plainAr`: الكتالوجُ كُتب قبل قرار التشكيل.

   ═══ ودورةٌ بلا شعبةٍ تحمل وسومَها أيضا (٢٠ أكتوبر ٢٠٢٦) ═══

   «افعلها لكلّ الدورات في الموقع حتّى بدون شعب» (صاحب المنصّة). فحين لا شعبةَ اختارت شيئا يُقرأ
   جمهورُ الدورة كما يقرؤه التشخيصُ نفسُه — لا مخترَعا هنا:
   · **المراحل**: ما أعلنه الكتالوجُ للدورة (`diagnostic_stages`) إن أعلن، وإلّا جمهورُ مسارها
     (`pathway-profiles.v1.json`) مترجَما بـ`PERSONA_BASE_TO_STAGES` — الجدولُ الذي يطابق به المحرّك.
   · **الأهداف**: أهدافُ مسارها برموزها القديمة، إلى أهداف التشخيص التي تحمل الرمزَ نفسَه
     (`legacy_goal`) وتناسب المراحلَ المعروضة.
   وبترتيب من كتبها، في الحدّ نفسِه. وسطرُ «من اختيار مدرّب الشعبة» لا يظهر معها: لم يخترها مدرّب. */

import { plainAr } from '../text/plain-ar'
import { AUDIENCE_GOALS, AUDIENCE_STAGES, goalLabelAr, stageLabelAr, type CohortAudience } from '../trainer/cohort-audience'
import { courseById as diagnosticCourse, pathwayProfiles } from '../../domain/diagnostic/catalog'
import { PERSONA_BASE_TO_STAGES, type CareerStage } from '../../domain/diagnostic/v2_1/maps'

/** أقصى ما يُعرض: أربعُ مراحلَ وثلاثةُ أهداف */
export const MAX_SHOWN_STAGES = 4
export const MAX_SHOWN_GOALS = 3

/** ما يقرؤه القسمُ من الدورة — حقولُ `CourseFull` نفسُها */
export interface CourseAudienceSource { id: string; targetAudience: string }

/** وما يقرؤه من الشعبة — `CohortOption` يحمله */
export interface CohortAudienceSource { audience: CohortAudience }

export interface CourseAudienceView {
  /** وصفُ من تناسبه — من الكتالوج */
  lead: string | null
  /** مراحلُ متعلّمها كما اختارها المدرّبون — بالعربيّة */
  stages: string[]
  /** وأهدافُه */
  goals: string[]
  /** كم شعبةً أسهمت بشيء — صفرٌ حين الوسومُ من الكتالوج */
  fromCohorts: number
}

const shownStages = new Set<string>(AUDIENCE_STAGES)

/** جمهورُ الدورة في الكتالوج برموز التشخيص — مراحلُها المعلَنة أو مراحلُ مسارها، وأهدافُ مسارها */
export function catalogAudienceOf(courseId: string): CohortAudience {
  const course = diagnosticCourse.get(courseId)
  if (!course) return { stages: [], goals: [] }
  const profile = pathwayProfiles[course.pathway_id]
  const declared = (course.diagnostic_stages ?? []) as CareerStage[]
  const stages = [...new Set(declared.length ? declared : (profile?.personas ?? []).flatMap((p) => PERSONA_BASE_TO_STAGES[p] ?? []))]
    .filter((st) => shownStages.has(st))
  const goals = [...new Set((profile?.goals ?? []).flatMap((legacy) => AUDIENCE_GOALS
    .filter((g) => g.legacy_goal === legacy && (g.stages === 'all' || g.stages.some((st) => stages.includes(st))))
    .map((g) => g.code)))]
  return { stages, goals }
}

/** الرموزُ مرتّبةً بعدد من اختارها ثمّ بترتيبها في التشخيص، في حدّها */
function ranked(lists: readonly (readonly string[])[], order: readonly string[], max: number): string[] {
  const count = new Map<string, number>()
  for (const list of lists) for (const code of new Set(list)) count.set(code, (count.get(code) ?? 0) + 1)
  return [...count.keys()]
    .sort((a, b) => (count.get(b)! - count.get(a)!) || (order.indexOf(a) - order.indexOf(b)))
    .slice(0, max)
}

export function courseAudienceView(course: CourseAudienceSource, cohorts: readonly CohortAudienceSource[]): CourseAudienceView {
  const lead = course.targetAudience.trim()
  const fromCohorts = cohorts.filter((c) => c.audience.stages.length || c.audience.goals.length).length
  /* المدرّبون أعلمُ بشعبهم — والكتالوجُ حين لم يقل أحدٌ منهم شيئا */
  const catalog = fromCohorts === 0 ? catalogAudienceOf(course.id) : null
  return {
    lead: lead ? plainAr(lead) : null,
    stages: (catalog ? catalog.stages.slice(0, MAX_SHOWN_STAGES)
      : ranked(cohorts.map((c) => c.audience.stages), AUDIENCE_STAGES, MAX_SHOWN_STAGES)).map(stageLabelAr),
    goals: (catalog ? catalog.goals.slice(0, MAX_SHOWN_GOALS)
      : ranked(cohorts.map((c) => c.audience.goals), AUDIENCE_GOALS.map((g) => g.code), MAX_SHOWN_GOALS)).map(goalLabelAr),
    fromCohorts,
  }
}
