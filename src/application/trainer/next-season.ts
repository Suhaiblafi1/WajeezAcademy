/* ═══ ما يقدّمه المدرّبُ في الموسم القادم — لا كلُّ دوراته (١٩ أكتوبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة وهو ينظر في بطاقة مدرّبةٍ بثماني دورات: «لماذا تظهر كلُّ الدورات للمدرّب وليس للموسم
   القادم؟ يجب أن تكون العبارةُ مثل: سيقدّم "المدرّب" للفصل القادم دورةَ كذا وكذا، وفق ما تمّت الموافقةُ عليه
   ونُشر للفصل القادم».

   وكانت «دوراتُه» اتّحادَ ثلاثة: شعبٌ يقودها منشورةٌ أو جاريةٌ أو انتهت هذا الفصل، وكلُّ إسنادٍ نشطٍ ولو بلا شعبةٍ
   تُباع، وكلُّ دورات مساره المنشور. فصارت ما يُشترى للموسم القادم وحدَه، بموسمه:
   · شعبةٌ يقودها **مفتوحةٌ للتسجيل أو ممتلئة** — اعتُمدت خطّتُها ونُشرت — في موسمها.
   · وإسنادٌ نشطٌ على شعبةٍ كذلك.
   · ومسارُه المنشورُ لموسمٍ مسمّى لم ينتهِ — في موسمه. وما لا موسمَ له لا يُخمَّن.
   وكلُّ دورةٍ مرّةً، في أقرب مواسمها. والجاريةُ والمنتهيةُ ليستا «سيقدّم». */

import { termTitleAr } from '../terms/season'
import type { TrainingSeason } from './application-options'

export interface SeasonItem {
  courseId: string
  term: { year: number; season: string; startsOn: string | Date } | null
  /** بدءُ الشعبة — يرتّب دوراتِ الموسم الواحد */
  at?: string | Date | null
}

export interface SeasonGroup { termAr: string | null; courseIds: string[] }

const iso = (d: string | Date | null | undefined) => (d == null ? '' : typeof d === 'string' ? d : d.toISOString())

/** دوراتُه بمواسمها — الأقربُ أوّلا، وما لا موسمَ له آخرا، وكلُّ دورةٍ في أقرب مواسمها */
export function groupBySeason(items: SeasonItem[]): SeasonGroup[] {
  const sorted = [...items].sort((a, b) => {
    if (!a.term !== !b.term) return a.term ? -1 : 1
    return iso(a.term?.startsOn).localeCompare(iso(b.term?.startsOn)) || iso(a.at).localeCompare(iso(b.at))
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

/** رأسُ كلّ موسم: «سيقدم فلان في موسم الشتاء 2026» */
export function seasonHeadingAr(name: string, termAr: string | null): string {
  return termAr ? `سيقدم ${name} في ${termAr}` : `سيقدم ${name} قريبا`
}

export const NO_NEXT_SEASON_AR = 'لا دورة منشورة له للموسم القادم بعد.'
