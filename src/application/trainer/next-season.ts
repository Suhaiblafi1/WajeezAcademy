/* ═══ ما يقدّمه المدرّبُ في الموسم القادم — لا كلُّ دوراته (١٩ أكتوبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة وهو ينظر في بطاقة مدرّبةٍ بثماني دورات: «لماذا تظهر كلُّ الدورات للمدرّب وليس للموسم
   القادم؟ يجب أن تكون العبارةُ مثل: سيقدّم "المدرّب" للفصل القادم دورةَ كذا وكذا، وفق ما تمّت الموافقةُ عليه
   ونُشر للفصل القادم».

   وكانت «دوراتُه» اتّحادَ ثلاثة: شعبٌ يقودها منشورةٌ أو جاريةٌ أو انتهت هذا الفصل، وكلُّ إسنادٍ نشطٍ ولو بلا شعبةٍ
   تُباع، وكلُّ دورات مساره المنشور. فصارت ما يُشترى للموسم القادم وحدَه، بموسمه:
   · شعبةٌ يقودها **مفتوحةٌ للتسجيل أو ممتلئة** — اعتُمدت خطّتُها ونُشرت — في موسمها.
   · وإسنادٌ نشطٌ على شعبةٍ كذلك.
   · ومسارُه المنشورُ لموسمٍ مسمّى لم ينتهِ — في موسمه. وما لا موسمَ له لا يُخمَّن.
   وكلُّ دورةٍ مرّةً، في أقرب مواسمها. والجاريةُ والمنتهيةُ ليستا «سيقدّم».

   ═══ وموسمُ الشعبة من أوّل لقائها — ما يراه المشتري (١٩ أكتوبر ٢٠٢٦) ═══
   «انظر شيئا معتمدا للفصل القادم وأنت تكتبه في صفحة المدرّب خطأ» (صاحب المنصّة). فالموسمُ يُقرأ من أوّل لقاءٍ قائمٍ
   في الشعبة (`termOf`) لا من صفّ فصلها، فلا يفترقان؛ والشتاءُ بسنتيه (`termTitleAr`). */

import { termBounds, termOf, termTitleAr } from '../terms/season'
import type { TrainingSeason } from './application-options'

export interface SeasonItem {
  courseId: string
  term: { year: number; season: string } | null
  /** بدءُ الشعبة — يرتّب دوراتِ الموسم الواحد */
  at?: string | Date | null
}

/** موسمُ الشعبة: من أوّل لقائها إن كان، وإلّا من فصلها المسمّى */
export function cohortSeason(firstAt: Date | null, term: { year: number; season: string } | null): { year: number; season: string } | null {
  return firstAt ? termOf(firstAt) : term
}

export interface SeasonGroup { termAr: string | null; courseIds: string[] }

const iso = (d: string | Date | null | undefined) => (d == null ? '' : typeof d === 'string' ? d : d.toISOString())
const startOf = (t: SeasonItem['term']) => (t ? termBounds(t.year, t.season as TrainingSeason).startsOn : null)

/** دوراتُه بمواسمها — الأقربُ أوّلا، وما لا موسمَ له آخرا، وكلُّ دورةٍ في أقرب مواسمها */
export function groupBySeason(items: SeasonItem[]): SeasonGroup[] {
  const sorted = [...items].sort((a, b) => {
    if (!a.term !== !b.term) return a.term ? -1 : 1
    return iso(startOf(a.term)).localeCompare(iso(startOf(b.term))) || iso(a.at).localeCompare(iso(b.at))
  })
  const seen = new Set<string>()
  const groups = new Map<string, SeasonGroup>()
  for (const it of sorted) {
    if (seen.has(it.courseId)) continue
    seen.add(it.courseId)
    const key = it.term ? `${it.term.year}:${it.term.season}` : ''
    const termAr = it.term ? termTitleAr(it.term.year, it.term.season as TrainingSeason) : null
    const g = groups.get(key) ?? { termAr, courseIds: [] }
    g.courseIds.push(it.courseId)
    groups.set(key, g)
  }
  return [...groups.values()]
}

/* ═══ رأسُ كلّ موسم: اسمُ الموسم وحدَه (٢٠ أكتوبر ٢٠٢٦) ═══

   كان «سيقدم فلان في موسم الشتاء 2026» — وقال صاحبُ المنصّة: «طويلة.. اجعلها فقط اسم الموسم!». والاسمُ
   مكتوبٌ في رأس البطاقة نفسها، فتكرارُه فوق كلّ موسمٍ حشو. وما لا موسمَ له «موسم لاحق». */

/* ═══ وما بعد الموسم القادم «المواسم القادمة» بلا أسمائها (٢٤ أكتوبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة على بطاقةٍ بأربعة مواسم: «لا داعي أن أذكر اسم الفصل، فقط أذكر للمواسم القادمة.. لأنه سيتم
   تغيير هذه الدورات، ولا أريد أن يرى المستهلك بأن هناك دوراتٍ بعد سنة». فالأقربُ وحدَه باسمه — هو ما يُشترى الآن —
   وما بعده كلُّه موسمٌ واحدٌ بلا اسم (`upcomingOffer`). ويُطوى على الخادم، فلا يحمل الردُّ اسمَ موسمٍ بعده. */
export const LATER_SEASON_AR = 'المواسم القادمة'

/** الأقربُ باسمه، وما بعده كلُّه «المواسم القادمة» — دوراتُه بترتيب مواسمها */
export function upcomingOffer(groups: SeasonGroup[]): SeasonGroup[] {
  if (groups.length <= 1) return groups
  const [next, ...rest] = groups
  return [next!, { termAr: null, courseIds: rest.flatMap((g) => g.courseIds) }]
}

/** رأسُ الموسم: «موسم الشتاء 2026/2027» — أو «المواسم القادمة» لما بعده ولما لا موسمَ له */
export function seasonHeadingAr(termAr: string | null): string {
  return termAr ?? LATER_SEASON_AR
}

export const NO_NEXT_SEASON_AR = 'لا دورة منشورة له للموسم القادم بعد.'
