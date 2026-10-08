/* سلّمُ المستويات — قاعدةُ التصحيح الواحدة لكلّ اختبار مستوى (٨ أكتوبر ٢٠٢٦).

   يُجتاز المستوى بثلثي أسئلته، والمستوى المحدَّد **أعلى ما اجتيز وكلُّ ما دونه
   مجتاز**: القفزةُ صدفةٌ لا تُحتسب. ومن لم يجتز الأوّلَ فهو «الأرضيّة» — A1 في
   الإنجليزيّة، و«مبتدئ» في فحص المجال. وما لم يُجب عنه خطأ.

   وكانت في `english-placement.ts` وحدَها؛ ثمّ جاءت فحوصُ المجالات بالقاعدة نفسِها،
   فخرجت إلى هنا كي لا يكون للقاعدة الواحدة نصّان يفترقان يوما. */

/** نسبةُ اجتياز المستوى — أربعةٌ من ستّة، أو ثلاثةٌ من أربعة تقريبا */
export const PASS_RATIO = 2 / 3

export interface LevelScore<L extends string> {
  level: L
  correct: number
  total: number
  passed: boolean
}

export interface LadderScore<R extends string, L extends string> {
  level: R
  correct: number
  total: number
  per_level: LevelScore<L>[]
}

export function climbLadder<L extends string, F extends string>(
  levels: readonly L[],
  floor: F,
  items: readonly { id: string; level: string; answer_index: number }[],
  answers: Readonly<Record<string, number>>,
): LadderScore<L | F, L> {
  const per_level = levels.map((level) => {
    const mine = items.filter((i) => i.level === level)
    const correct = mine.filter((i) => answers[i.id] === i.answer_index).length
    return { level, correct, total: mine.length, passed: mine.length > 0 && correct / mine.length >= PASS_RATIO - 1e-9 }
  })
  let reached: L | F = floor
  for (const s of per_level) {
    if (!s.passed) break
    reached = s.level
  }
  return {
    level: reached,
    correct: per_level.reduce((a, s) => a + s.correct, 0),
    total: per_level.reduce((a, s) => a + s.total, 0),
    per_level,
  }
}
