/* اختبارُ تحديد مستوى الإنجليزيّة — التصحيحُ والمستوى (قرارُ صاحب المنصّة، ٨ أكتوبر ٢٠٢٦).

   قرّر صاحبُ المنصّة سؤالا سؤالا:
     · اختبارٌ على المنصّة يحدّد المستوى آليّا — لا مكالمةً ولا موعدا.
     · ثلاثون سؤالا تقريبا: قواعدُ ومفرداتٌ وقراءة، يُصحَّح فورا (١٥–٢٠ دقيقة).
     · أكتبه مسوّدةً ويراجعه مدرّبُ الإنجليزيّة في لوحة الإدارة، ولا يُعرض قبل
       اعتماده.
     · اختياريٌّ من صفحة النتيجة — ومن شاء سجّل بمستواه الموصوف بلا اختبار.

   ── قاعدةُ المستوى ──

   ستّةُ أسئلةٍ لكلّ مستوى من A1 إلى C1. يُعدّ المستوى مجتازا بأربعةٍ من ستّة
   (ثلثان) — فوق التخمين بكثير (ربعُ الصواب لمن يخمّن في أربعة خيارات) ودون
   الكمال الذي لا يطلبه أحد. والمستوى المحدَّد **أعلى مستوى اجتيز وكلُّ ما دونه
   مجتاز**: من أصاب أسئلةَ C1 حظّا وأخفق في B1 لا يُحسب في C1 — التسلسلُ هو
   الدليل، والقفزةُ صدفة. ومن لم يجتز A1 يُوضع في A1: لا مستوى دونه عندنا.

   والقاعدةُ تُطبَّق على **المعتمَد من الأسئلة وحدَه**، وعتبتُها نسبةٌ لا عدد —
   فإن حذف المدرّبُ سؤالا أو زاد بقي الحكمُ صادقا. ومستوى بلا أسئلةٍ معتمدة لا
   يُجتاز ولا يُحكم به: الاختبارُ لا يُفتح حتّى يكون لكلّ مستوى أسئلتُه. */

import type { EnglishLevel } from '../diagnostic/v2_1/english'

export const PLACEMENT_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const
export type PlacementCefr = (typeof PLACEMENT_LEVELS)[number]

/** نسبةُ اجتياز المستوى — أربعةٌ من ستّة */
export const PASS_RATIO = 2 / 3
/** أدنى عددٍ من الأسئلة المعتمدة لكلّ مستوى قبل أن يُفتح الاختبار */
export const MIN_APPROVED_PER_LEVEL = 3

export interface PlacementItem {
  id: string
  level: PlacementCefr
  skill: 'grammar' | 'vocabulary' | 'reading'
  passage: string | null
  stem: string
  options: string[]
  answer_index: number
}

export interface LevelScore {
  level: PlacementCefr
  correct: number
  total: number
  passed: boolean
}

export interface PlacementResult {
  cefr: PlacementCefr
  level: EnglishLevel
  correct: number
  total: number
  per_level: LevelScore[]
}

const CODE: Record<PlacementCefr, EnglishLevel> = { A1: 'a1', A2: 'a2', B1: 'b1', B2: 'b2', C1: 'c1' }

/** هل يكفي البنكُ المعتمَد لفتح الاختبار؟ — لكلّ مستوى أسئلتُه */
export function bankIsOpen(items: readonly Pick<PlacementItem, 'level'>[]): boolean {
  return PLACEMENT_LEVELS.every((l) => items.filter((i) => i.level === l).length >= MIN_APPROVED_PER_LEVEL)
}

/** يصحّح الأجوبة (معرّفُ السؤال ← رقمُ الخيار) ويحدّد المستوى. ما لم يُجب عنه خطأ. */
export function scorePlacement(items: readonly PlacementItem[], answers: Readonly<Record<string, number>>): PlacementResult {
  const per_level: LevelScore[] = PLACEMENT_LEVELS.map((level) => {
    const mine = items.filter((i) => i.level === level)
    const correct = mine.filter((i) => answers[i.id] === i.answer_index).length
    return { level, correct, total: mine.length, passed: mine.length > 0 && correct / mine.length >= PASS_RATIO - 1e-9 }
  })
  let cefr: PlacementCefr = 'A1'
  for (const s of per_level) {
    if (!s.passed) break
    cefr = s.level
  }
  return {
    cefr,
    level: CODE[cefr],
    correct: per_level.reduce((a, s) => a + s.correct, 0),
    total: per_level.reduce((a, s) => a + s.total, 0),
    per_level,
  }
}

/** ما يُرسَل إلى المتعلّم — بلا الجواب الصحيح */
export function publicItem(i: PlacementItem): Omit<PlacementItem, 'answer_index'> {
  const { answer_index: _hidden, ...rest } = i
  void _hidden
  return rest
}
