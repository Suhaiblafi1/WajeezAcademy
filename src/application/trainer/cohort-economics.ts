/* ═══ أغطّت الشعبةُ حقَّ مدرّبها؟ — رقمان بجانب كلّ شعبة (٢٢ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «أحتاج لافتةً تقول كم الحدُّ الأدنى الذي سنعطيه للمدرّب، وكم حصّلنا — فقرارُ
   الحذف يُبنى على: هل غطّينا أتعابَ المدرّب، وهي الحدُّ الأدنى من المقاعد الذي وعدناه به».

   فالرقمان من مصدرين لا يُخمَّنان:
   · **ما وعدناه** من قاعدة أتعاب المدرّب السارية على الشعبة (`activeRule`)، بالمعادلة نفسِها التي
     يُكتب بها كشفُه (`perSeatBreakdown`) — فلا يقول هذا رقما ويدفع الكشفُ غيرَه.
   · **وما حصّلنا** من الطلبات المدفوعة لهذه الشعبة بعينها، بعد خصمها وما رُدّ منها.

   ═══ ولمَ «لو انعقدت الآن» لا «الحدّ الأدنى» وحدَه ═══

   الأرضيّةُ لا تلزم إلّا شعبةً بدأت (`cohortStartedForFloor`، قرارُ ١ أكتوبر): «لو لم يسجّل أحدٌ لن
   نعقد الدورة». فالسؤالُ قبل البدء: كم ندفع **إن عقدناها** بمن سجّل الآن؟ وهو أكبرُ الاثنين: ما
   احتُسب من مقاعد، أو الأرضيّة. فيُحسب بـ`cohortStarted: true` عمدا — هو سؤالُ «ماذا لو بدأت».
   وإلغاؤها قبل البدء لا يلزمنا للمدرّب بشيء، وبعده يبقى حقُّه.

   والنوعان الآخران: الأجرُ الثابتُ هو الحدُّ وهو الكلفة، ونسبةُ الإيراد لا حدَّ لها — تُغطّى دائما. */

import { perSeatBreakdown } from './seat-fee'

export type FeeRuleType = 'per_seat' | 'fixed_per_cohort' | 'revenue_share'

export interface EconomicsRule {
  type: string
  rate: number
  minSeats: number
  referralRate: number | null
}

export interface EconomicsInput {
  /** لا مدرّبَ تُحتسب له الشعبة */
  hasTrainer: boolean
  /** قاعدةُ أتعابه السارية — أو `null` إن لم تُعيَّن */
  rule: EconomicsRule | null
  /** المقاعدُ المحتسبةُ بمصدرها — `countedSeats` */
  seats: { general: number; referred: number }
  /** صافي ما حُصّل لهذه الشعبة */
  collected: number
  /** أبدأت؟ — فيلزم حقُّ المدرّب ولو أُلغيت */
  started: boolean
}

export type EconomicsVerdict = 'covered' | 'short' | 'no_trainer' | 'no_rule'

export interface CohortEconomics {
  /** ما وعدناه حدّا أدنى — `null` بلا قاعدة */
  minimum: number | null
  /** كيف يُقرأ الحدّ: «15 مقعدا × 15» */
  minimumBasisAr: string | null
  /** ما ندفعه للمدرّب لو انعقدت بمن سجّل الآن */
  costIfRun: number | null
  collected: number
  /** المحصّلُ ناقصا كلفةَ المدرّب — سالبٌ حين لا يغطّي */
  margin: number | null
  verdict: EconomicsVerdict
  started: boolean
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function cohortEconomics(input: EconomicsInput): CohortEconomics {
  const collected = round2(input.collected)
  const base = { collected, started: input.started }
  if (!input.hasTrainer) {
    return { ...base, minimum: null, minimumBasisAr: null, costIfRun: null, margin: null, verdict: 'no_trainer' }
  }
  const rule = input.rule
  if (!rule) {
    return { ...base, minimum: null, minimumBasisAr: null, costIfRun: null, margin: null, verdict: 'no_rule' }
  }

  let minimum: number
  let minimumBasisAr: string
  let costIfRun: number
  if (rule.type === 'per_seat') {
    minimum = round2(rule.minSeats * rule.rate)
    minimumBasisAr = rule.minSeats > 0
      ? `${rule.minSeats} مقعدا × ${rule.rate}`
      : `بلا حد أدنى — ${rule.rate} لكل مقعد`
    costIfRun = perSeatBreakdown({
      general: input.seats.general, referred: input.seats.referred,
      rate: rule.rate, referralRate: rule.referralRate, minSeats: rule.minSeats,
      cohortStarted: true,
    }).total
  } else if (rule.type === 'fixed_per_cohort') {
    minimum = rule.rate
    minimumBasisAr = 'أجر ثابت للشعبة'
    costIfRun = rule.rate
  } else {
    minimum = 0
    minimumBasisAr = `${rule.rate}٪ من المحصل — بلا حد أدنى`
    costIfRun = round2((collected * rule.rate) / 100)
  }
  const margin = round2(collected - costIfRun)
  return { ...base, minimum, minimumBasisAr, costIfRun, margin, verdict: margin >= 0 ? 'covered' : 'short' }
}

/** حصّةُ بندٍ من صافي طلبه — الخصمُ والمردودُ يقعان على الطلب كلّه فيُقسمان بنسبة البند */
export function lineNet(line: { unitPrice: number; quantity: number }, order: { subtotal: number; total: number; refunded: number }): number {
  if (order.subtotal <= 0) return 0
  const net = Math.max(0, order.total - order.refunded)
  return (line.unitPrice * line.quantity / order.subtotal) * net
}
