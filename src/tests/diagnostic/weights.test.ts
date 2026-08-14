import { describe, expect, it } from 'vitest'
import { CONFIDENCE_WEIGHTS, FIT_WEIGHTS, TEMPLATE_WEIGHTS, UTILITY_WEIGHTS } from '../../domain/diagnostic/config'

const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0)

describe('أوزان المحرك', () => {
  it('أوزان الملاءمة الخماسية تساوي 1', () => {
    expect(sum(FIT_WEIGHTS)).toBeCloseTo(1, 6)
  })
  it('أوزان الثقة الخماسية تساوي 1', () => {
    expect(sum(CONFIDENCE_WEIGHTS)).toBeCloseTo(1, 6)
  })
  it('أوزان القوالب الستة تساوي 1', () => {
    expect(sum(TEMPLATE_WEIGHTS)).toBeCloseTo(1, 6)
  })
  it('منفعة السؤال: الموجب 1 والسالب تكلفة', () => {
    const positive =
      UTILITY_WEIGHTS.decisionImpact +
      UTILITY_WEIGHTS.uncertaintyReduction +
      UTILITY_WEIGHTS.tieBreakPower +
      UTILITY_WEIGHTS.contradictionResolution +
      UTILITY_WEIGHTS.requiredCoverage +
      UTILITY_WEIGHTS.riskReduction
    expect(positive).toBeCloseTo(1, 6)
    expect(UTILITY_WEIGHTS.answerCost).toBeLessThan(0)
    expect(UTILITY_WEIGHTS.sensitivity).toBeLessThan(0)
    expect(UTILITY_WEIGHTS.redundancy).toBeLessThan(0)
  })
})
