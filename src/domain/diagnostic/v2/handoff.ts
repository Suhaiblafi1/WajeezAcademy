/* تسليم المستشار V2 — عندما تتحول الجلسة لإنسان، يستلم كل شيء:
   الإجابات، الحقائق، الشخصية، الهدف، المجالات، المقاس والمجهول،
   المتصدرون والمرفوضون بأسبابهم، الثقة، التناقضات، وأسئلة المحرك المتبقية. */

import type { Contradiction, FactBag } from '../types'
import { rankAdaptiveQuestions } from './select'
import { questionMetaV2 } from './data'
import { questionBank } from '../catalog'
import type {
  AdvisorHandoff,
  ConfidenceV2,
  DecisionContext,
  PathwayEligibility,
  V2Candidate,
} from './types'

export function buildAdvisorHandoff(
  facts: FactBag,
  contradictions: Contradiction[],
  ctx: DecisionContext,
  candidates: V2Candidate[],
  eligibility: PathwayEligibility[],
  confidence: ConfidenceV2,
  askedIds: Set<string>,
): AdvisorHandoff {
  /* أسئلة المحرك المتبقية: أعلى الأسئلة الأهلية منفعة لم تُطرح */
  const remaining = rankAdaptiveQuestions(
    questionBank.filter((q) => {
      if (askedIds.has(q.question_id)) return false
      const meta = questionMetaV2[q.question_id]
      if (!meta || meta.layer === 'retire_candidate') return false
      if (meta.allowed_personas !== 'all' && !meta.allowed_personas.includes(ctx.persona.key)) return false
      if (meta.excluded_personas.includes(ctx.persona.key)) return false
      return q.measures.some((m) => m !== 'skill_vector' && facts[m] === undefined)
    }),
    facts,
    contradictions,
    ctx,
    candidates,
  )
    .filter((s) => s.utility >= 0.5)
    .slice(0, 5)
    .map((s) => questionBank.find((q) => q.question_id === s.questionId)?.text_ar ?? s.questionId)

  return {
    persona: ctx.persona,
    goal: {
      code: (facts['primary_goal']?.value as string) ?? null,
      clarity: (facts['goal_clarity']?.value as string) ?? null,
    },
    domains: ctx.domains,
    measuredSkills: [...ctx.skillStates.values()]
      .filter((s) => s.state === 'measured' && s.level !== undefined)
      .map((s) => ({ slug: s.slug, level: s.level! })),
    unknowns_ar: confidence.strongBlockers_ar,
    topCandidates: candidates.slice(0, 3).map((c) => ({ pathwayId: c.pathwayId, total: c.total })),
    rejectedWithReasons: eligibility
      .filter((e) => !e.eligible)
      .map((e) => ({ pathwayId: e.pathwayId, reasons_ar: e.excludedReasons_ar })),
    confidence,
    contradictions: contradictions.map((c) => ({ id: c.id, severity: c.severity, resolved: c.resolved })),
    remainingEngineQuestions_ar: remaining,
    answersCount: askedIds.size,
  }
}
