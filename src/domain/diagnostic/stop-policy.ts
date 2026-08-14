/* سياسة التوقف التكيفي — غالبا 8–14 سؤالا، حد أقصى 18 (سريع) / 35 (عميق) */

import { STOP_RULES } from './config'
import type { ConfidenceBreakdown, PathwayCandidate, StopDecision, UtilityScore } from './types'

export interface StopInput {
  askedCount: number
  mode: 'quick' | 'deep'
  candidates: PathwayCandidate[]
  confidence: ConfidenceBreakdown
  rankedUtilities: UtilityScore[]
}

export function evaluateStop(input: StopInput): StopDecision {
  const { askedCount, mode, candidates, confidence, rankedUtilities } = input
  const hardCap = mode === 'quick' ? STOP_RULES.hardCapQuick : STOP_RULES.hardCapDeep

  if (askedCount >= hardCap) {
    return { shouldStop: true, reason_ar: 'بلغنا الحد الأقصى للأسئلة — نكتفي بما جمعناه.', askedCount }
  }

  if (askedCount < STOP_RULES.quickTargetMin) {
    return { shouldStop: false, reason_ar: 'نحتاج أسئلة إضافية قبل التوصية.', askedCount }
  }

  const top = candidates[0]
  const second = candidates[1]
  const separation = top && second ? top.fit.total - second.fit.total : 1
  const bestUtility = rankedUtilities[0]?.utility.total ?? 0

  const allMet =
    top !== undefined &&
    top.fit.total >= STOP_RULES.minTopFit &&
    separation >= STOP_RULES.minSeparation &&
    confidence.total >= STOP_RULES.minConfidence &&
    bestUtility < STOP_RULES.minUsefulUtility

  if (allMet) {
    return {
      shouldStop: true,
      reason_ar: 'اكتملت الأدلة: ملاءمة واضحة وفارق مريح وثقة كافية ولا سؤال ذا منفعة حقيقية.',
      askedCount,
    }
  }

  // توقف ناعم: تجاوزنا الهدف الأعلى (14) ولا سؤال ذا منفعة
  if (askedCount >= STOP_RULES.quickTargetMax && bestUtility < STOP_RULES.minUsefulUtility) {
    return {
      shouldStop: true,
      reason_ar: 'استوفينا نطاق الأسئلة المعتاد ولم يعد هناك سؤال يغير النتيجة جوهريا.',
      askedCount,
    }
  }

  return { shouldStop: false, reason_ar: 'ما زالت هناك أسئلة ذات منفعة.', askedCount }
}
