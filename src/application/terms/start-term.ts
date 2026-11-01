/* فصلُ الشعبة من يوم بدئها بتوقيت عمّان — «2026-nov_jan».

   يقرؤه الخادمُ ليقول فصولَ الدورات المعروضة (`listedCourses`)، والواجهةُ لتقترح بديلا في فصل المسار
   (`pathway-swap.ts`). واليومُ بتوقيت عمّان لا UTC: منتصفُ ليل أوّل نوفمبر في عمّان ما زال أكتوبرَ في UTC. */

import { termKey, termOf } from './season'
import { zonedDay } from '../trainer/cohort-period'

export function startTermKey(startsAt: Date | string): string {
  const { year, season } = termOf(new Date(`${zonedDay(startsAt)}T12:00:00Z`))
  return termKey(year, season)
}

/* ═══ وموسمُ البيع: ما تُعرض له المساراتُ العامّة (١ نوفمبر ٢٠٢٦) ═══
   كان فصلُ المسارات مكتوبا («2026-nov_jan»)، فإذا انتهى الشتاءُ غابت كلُّها حتّى يُكتب غيرُه. فصار يُحسب: فصلُ
   **أقربِ شعبةٍ معروضةٍ لم تبدأ بعد** — ما يستطيع الزائرُ أن يبدأه. فمن أكتوبر إلى أن تبدأ آخرُ شعب الشتاء فهو الشتاء،
   ثمّ ينتقل وحدَه إلى ما بعده حين تُفتح شعبُه. وبلا شعبةٍ قادمةٍ ففصلُ اليوم: ما يجري الآن. */
export function sellingSeason(startDates: readonly (Date | null)[], now: Date): string {
  const next = startDates
    .filter((d): d is Date => d !== null && d.getTime() > now.getTime())
    .sort((a, b) => a.getTime() - b.getTime())[0]
  return startTermKey(next ?? now)
}
