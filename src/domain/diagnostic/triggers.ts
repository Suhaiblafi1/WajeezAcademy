/* سجل محفزات الأسئلة — 12 محفزا فقط من البنك الأصلي.
   التقييم حتمي بأسماء مسجلة، لا eval ولا نصوص تنفيذية. */

import type { FactBag } from './types'

export interface TriggerContext {
  facts: FactBag
  confidenceTotal: number
  askedCount: number
  topTwoMargin: number | null
  recommendationGenerated: boolean
  recommendationRejected: boolean
  userRequestedDeep: boolean
  sensitiveAnswersPresent: boolean
}

export const KNOWN_TRIGGERS = [
  'always',
  'organization_campaign',
  'confidence_medium_or_user_request',
  'enough_for_basic_result',
  'goal_clarity_low AND pathway_selected',
  'goal_urgent AND weekly_load_low',
  'low_confidence OR user_flagged_uncertainty',
  'many_high_skills AND low_evidence',
  'recommendation_generated',
  'recommendation_rejected',
  'sensitive_answers_present',
  'top_two_pathways_close',
] as const

export type TriggerName = (typeof KNOWN_TRIGGERS)[number]

export function isKnownTrigger(t: string): t is TriggerName {
  return (KNOWN_TRIGGERS as readonly string[]).includes(t)
}

function manyHighSkillsLowEvidence(ctx: TriggerContext): boolean {
  // مهارات عالية التقييم الذاتي (≥4) — جودة دليلها تُقاس من أسئلة M8 لاحقا
  const highSkills = Object.entries(ctx.facts).filter(
    ([k, v]) => k.endsWith('_self') && typeof v.value === 'number' && v.value >= 4,
  )
  const evidenceLow = ctx.facts['evidence_strength']?.value === 'low'
  return highSkills.length >= 2 && evidenceLow
}

export function evaluateTrigger(trigger: string, ctx: TriggerContext): boolean {
  switch (trigger) {
    case 'always':
      return true
    case 'organization_campaign':
      return ctx.facts['payer_type']?.value === 'employer'
    case 'confidence_medium_or_user_request':
      return (ctx.confidenceTotal >= 0.5 && ctx.confidenceTotal < 0.8) || ctx.userRequestedDeep
    case 'enough_for_basic_result':
      return ctx.askedCount >= 8 && ctx.confidenceTotal >= 0.65
    case 'goal_clarity_low AND pathway_selected':
      return ctx.facts['goal_clarity']?.value === 'low' && ctx.facts['pathway_selected'] !== undefined
    case 'goal_urgent AND weekly_load_low':
      return ctx.facts['goal_urgency']?.value === 'urgent' && ctx.facts['weekly_load']?.value === 'lt_3'
    case 'low_confidence OR user_flagged_uncertainty':
      return ctx.confidenceTotal < 0.5 || ctx.facts['low_confidence_flag'] !== undefined
    case 'many_high_skills AND low_evidence':
      return manyHighSkillsLowEvidence(ctx)
    case 'recommendation_generated':
      return ctx.recommendationGenerated
    case 'recommendation_rejected':
      return ctx.recommendationRejected
    case 'sensitive_answers_present':
      return ctx.sensitiveAnswersPresent
    case 'top_two_pathways_close':
      return ctx.topTwoMargin !== null && ctx.topTwoMargin < 0.08
    default:
      return false
  }
}
