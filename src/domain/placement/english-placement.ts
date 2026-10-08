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
import { climbLadder, type LevelScore as LadderLevelScore } from './ladder'

export const PLACEMENT_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const
export type PlacementCefr = (typeof PLACEMENT_LEVELS)[number]

export { PASS_RATIO } from './ladder'
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

export type LevelScore = LadderLevelScore<PlacementCefr>

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

/** يصحّح الأجوبة (معرّفُ السؤال ← رقمُ الخيار) ويحدّد المستوى. ما لم يُجب عنه خطأ.
    والقاعدةُ في `ladder.ts` — واحدةٌ لهذا الاختبار ولفحوص المجالات. */
export function scorePlacement(items: readonly PlacementItem[], answers: Readonly<Record<string, number>>): PlacementResult {
  const { level: cefr, correct, total, per_level } = climbLadder(PLACEMENT_LEVELS, 'A1' as const, items, answers)
  return { cefr, level: CODE[cefr], correct, total, per_level }
}

/** ما يُرسَل إلى المتعلّم — بلا الجواب الصحيح */
export function publicItem(i: PlacementItem): Omit<PlacementItem, 'answer_index'> {
  const { answer_index: _hidden, ...rest } = i
  void _hidden
  return rest
}
