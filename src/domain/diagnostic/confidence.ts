/* حساب الثقة — خماسي الأبعاد بأوزان config */

import { CONFIDENCE_BANDS, CONFIDENCE_WEIGHTS, REQUIRED_CORE_FACTS } from './config'
import type { ConfidenceBreakdown, Contradiction, FactBag, PathwayCandidate } from './types'

export function computeConfidence(
  facts: FactBag,
  contradictions: Contradiction[],
  candidates: PathwayCandidate[],
): ConfidenceBreakdown {
  // التغطية: كم حقيقة أساسية جمعت
  const covered = REQUIRED_CORE_FACTS.filter((k) => facts[k] !== undefined).length
  const coverage = covered / REQUIRED_CORE_FACTS.length

  // الاتساق: التناقضات غير المحسومة تخفضه
  const unresolved = contradictions.filter((c) => !c.resolved)
  const highSev = unresolved.filter((c) => c.severity === 'high').length
  const consistency = Math.max(0, 1 - (unresolved.length - highSev) * 0.15 - highSev * 0.35)

  // الفصل: الفارق بين أول مسارين
  const separation =
    candidates.length >= 2
      ? Math.min(1, Math.max(0, (candidates[0].fit.total - candidates[1].fit.total) / 0.15))
      : 0.5

  // جودة الأدلة: متوسط جودة أدلة الحقائق المقيسة
  const values = Object.values(facts)
  const evidenceQuality =
    values.length === 0 ? 0 : values.reduce((s, v) => s + v.evidenceQuality, 0) / values.length

  // الثبات: تقريب مبدئي — يتحسن مع عدد الإجابات (المراجعات تعيد الحساب)
  const stability = Math.min(1, values.length / 12)

  const total =
    coverage * CONFIDENCE_WEIGHTS.coverage +
    consistency * CONFIDENCE_WEIGHTS.consistency +
    separation * CONFIDENCE_WEIGHTS.separation +
    evidenceQuality * CONFIDENCE_WEIGHTS.evidenceQuality +
    stability * CONFIDENCE_WEIGHTS.stability

  const band = CONFIDENCE_BANDS.find((b) => total >= b.min) ?? CONFIDENCE_BANDS[CONFIDENCE_BANDS.length - 1]

  return {
    coverage,
    consistency,
    separation,
    evidenceQuality,
    stability,
    total,
    band: band.band as ConfidenceBreakdown['band'],
    band_ar: band.band_ar,
  }
}
