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
   تعدّ الناسَ كلَّهم لا تصف أحدا. والنصُّ يمرّ بـ`plainAr`: الكتالوجُ كُتب قبل قرار التشكيل. */

import { plainAr } from '../text/plain-ar'
import { AUDIENCE_GOALS, AUDIENCE_STAGES, goalLabelAr, stageLabelAr, type CohortAudience } from '../trainer/cohort-audience'

/** أقصى ما يُعرض: أربعُ مراحلَ وثلاثةُ أهداف */
export const MAX_SHOWN_STAGES = 4
export const MAX_SHOWN_GOALS = 3

/** ما يقرؤه القسمُ من الدورة — حقلُ `CourseFull` نفسُه */
export interface CourseAudienceSource { targetAudience: string }

/** وما يقرؤه من الشعبة — `CohortOption` يحمله */
export interface CohortAudienceSource { audience: CohortAudience }

export interface CourseAudienceView {
  /** وصفُ من تناسبه — من الكتالوج */
  lead: string | null
  /** مراحلُ متعلّمها كما اختارها المدرّبون — بالعربيّة */
  stages: string[]
  /** وأهدافُه */
  goals: string[]
  /** كم شعبةً أسهمت بشيء — صفرٌ حين القسمُ كلُّه من الكتالوج */
  fromCohorts: number
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
  return {
    lead: lead ? plainAr(lead) : null,
    stages: ranked(cohorts.map((c) => c.audience.stages), AUDIENCE_STAGES, MAX_SHOWN_STAGES).map(stageLabelAr),
    goals: ranked(cohorts.map((c) => c.audience.goals), AUDIENCE_GOALS.map((g) => g.code), MAX_SHOWN_GOALS).map(goalLabelAr),
    fromCohorts: cohorts.filter((c) => c.audience.stages.length || c.audience.goals.length).length,
  }
}
