/* فصلُ الشعبة من يوم بدئها بتوقيت عمّان — «2026-nov_jan».

   يقرؤه الخادمُ ليقول فصولَ الدورات المعروضة (`listedCourses`)، والواجهةُ لتقترح بديلا في فصل المسار
   (`pathway-swap.ts`). واليومُ بتوقيت عمّان لا UTC: منتصفُ ليل أوّل نوفمبر في عمّان ما زال أكتوبرَ في UTC. */

import { termKey, termOf } from './season'
import { zonedDay } from '../trainer/cohort-period'

export function startTermKey(startsAt: Date | string): string {
  const { year, season } = termOf(new Date(`${zonedDay(startsAt)}T12:00:00Z`))
  return termKey(year, season)
}
