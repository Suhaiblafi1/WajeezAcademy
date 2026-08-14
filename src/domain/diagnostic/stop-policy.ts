/* سياسة التوقف التكيفي — غالبا 8–14 سؤالا، حد أقصى 18 (سريع) / 35 (عميق) */

import { STOP_RULES } from './config'
import type { ConfidenceBreakdown, PathwayCandidate, StopDecision, UtilityScore } from './types'

export interface StopInput {
  askedCount: number
  mode: 'quick' | 'deep'
  candidates: PathwayCandidate[]
  confidence: ConfidenceBreakdown
  rankedUtilities: UtilityScore[]
  /** حقائق حاسمة للقرار ما زالت مفقودة — تمنع التوقف قبل الحد الأقصى */
  missingDecisionCritical?: string[]
}

export function evaluateStop(input: StopInput): StopDecision {
  const { askedCount, mode, candidates, confidence, rankedUtilities } = input
  const hardCap = mode === 'quick' ? STOP_RULES.hardCapQuick : STOP_RULES.hardCapDeep
  const criticalMissing = input.missingDecisionCritical ?? []

  if (askedCount >= hardCap) {
    return { shouldStop: true, reason_ar: 'بلغنا الحد الأقصى للأسئلة — نكتفي بما جمعناه.', askedCount }
  }

  if (askedCount < STOP_RULES.quickTargetMin) {
    return { shouldStop: false, reason_ar: 'نحتاج أسئلة إضافية قبل التوصية.', askedCount }
  }

  // لا توقف مبكرا وحقيقة حاسمة للقرار مفقودة (مثل حالة العمل لخريج يطلب «وظيفة أو ترقية»)
  if (criticalMissing.length > 0) {
    return {
      shouldStop: false,
      reason_ar: 'ما زالت هناك حقيقة حاسمة للقرار لم تُجمع بعد.',
      askedCount,
    }
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

  // توقف متوسط: الصورة مكتملة تماما حتى لو بقيت أسئلة هامشية المنفعة
  if (
    askedCount >= 10 &&
    top !== undefined &&
    top.fit.total >= STOP_RULES.minTopFit &&
    separation >= STOP_RULES.minSeparation &&
    confidence.total >= STOP_RULES.minConfidence
  ) {
    return {
      shouldStop: true,
      reason_ar: 'اكتملت الصورة: ملاءمة وفارق وثقة كافية — الأسئلة المتبقية هامشية.',
      askedCount,
    }
  }

  // توقف ناعم: تجاوزنا نطاق «غالبا 8–14» وملاءمة وثقة مقبولتان
  if (askedCount >= STOP_RULES.quickTargetMax) {
    const acceptable = top !== undefined && top.fit.total >= 0.65 && confidence.total >= 0.65
    const noUseful = bestUtility < STOP_RULES.minUsefulUtility
    if (acceptable || noUseful) {
      return {
        shouldStop: true,
        reason_ar: acceptable
          ? 'استوفينا نطاق الأسئلة المعتاد والصورة واضحة بما يكفي لتوصية مسؤولة.'
          : 'استوفينا نطاق الأسئلة المعتاد ولم يعد هناك سؤال يغير النتيجة جوهريا.',
        askedCount,
      }
    }
  }

  return { shouldStop: false, reason_ar: 'ما زالت هناك أسئلة ذات منفعة.', askedCount }
}
