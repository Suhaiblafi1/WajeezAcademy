/* تسجيل ملاءمة المسارات في V2 — للمسارات الأهلية فقط.
   الفروق الجوهرية عن V1:
   - لا UNKNOWN_LEVEL: فجوة المهارات تُحسب على المقاس فقط، والمجهول يُعرض صراحة.
   - وزن فجوة المهارات يتدرج مع measuredSkillCoverage، والباقي يُعاد توزيعه.
   - بُعد المجال (domain) صريح بدل أن يختبئ داخل الهدف. */

import { pathwayProfiles } from '../catalog'
import { WEEKLY_LOAD_ORDER } from '../config'
import type { FactBag } from '../types'
import { domainsOfPathway } from './data'
import { DOMAIN_CONFIDENCE_MIN } from './domains'
import { basePersonaCode } from './personas'
import { assessPathwaySkills } from './skills'
import type { DecisionContext, V2Candidate } from './types'

/* الأوزان الأساسية — مجموعها 1؛ وزن skillGap الفعلي يتدرج مع التغطية */
const W = {
  persona: 0.2,
  goal: 0.2,
  domain: 0.15,
  skillGap: 0.25,
  feasibility: 0.1,
  motivation: 0.1,
} as const

function scorePersona(pathwayId: string, ctx: DecisionContext): { score: number; reason?: string } {
  const profile = pathwayProfiles[pathwayId]
  if (!profile || profile.personas.length === 0) return { score: 0.5 }
  const base = basePersonaCode(ctx.persona.key)
  if (!base) return { score: 0.4 }
  if (!profile.personas.includes(base)) return { score: 0.1 }
  return { score: 1, reason: 'وصفك الحالي يناسب جمهور هذا المسار.' }
}

function scoreGoal(pathwayId: string, facts: FactBag): { score: number; reason?: string } {
  const profile = pathwayProfiles[pathwayId]
  const goal = facts['primary_goal']?.value as string | undefined
  if (!profile || profile.goals.length === 0) return { score: 0.5 }
  if (!goal) return { score: 0.4 }
  return profile.goals.includes(goal)
    ? { score: 1, reason: 'هدفك المعلن يطابق التحول الذي صُمم له هذا المسار.' }
    : { score: 0.05 }
}

function scoreDomain(pathwayId: string, ctx: DecisionContext): { score: number; reason?: string } {
  if (ctx.domains.confidence < DOMAIN_CONFIDENCE_MIN || !ctx.domains.top) return { score: 0.5 }
  const pds = domainsOfPathway(pathwayId)
  if (pds.length === 0) return { score: 0.4 }
  if (pds.includes(ctx.domains.top)) return { score: 1, reason: 'المسار في صميم المجال الذي ظهر من إجاباتك.' }
  if (ctx.domains.contested && pds.includes(ctx.domains.contested[1])) return { score: 0.6 }
  return { score: 0.2 }
}

function scoreFeasibility(pathwayId: string, facts: FactBag): { score: number; reason?: string } {
  const profile = pathwayProfiles[pathwayId]
  const load = facts['weekly_load']?.value as string | undefined
  if (!profile?.min_weekly_load || !load) return { score: 0.6 }
  const user = WEEKLY_LOAD_ORDER[load] ?? 2
  const need = WEEKLY_LOAD_ORDER[profile.min_weekly_load] ?? 2
  if (user >= need) return { score: 1, reason: 'وقتك الأسبوعي يكفي لعبء هذا المسار.' }
  if (user === need - 1) return { score: 0.5, reason: 'وقتك أقل قليلًا من عبء المسار المعتاد — سيحتاج وتيرة أبطأ.' }
  return { score: 0.15, reason: 'وقتك الحالي دون الحد الأدنى لهذا المسار.' }
}

function scoreMotivation(facts: FactBag): { score: number; reason?: string } {
  const readiness = facts['application_readiness']?.value as string | undefined
  if (readiness === 'high') return { score: 1, reason: 'استعدادك للتطبيق العملي مرتفع.' }
  if (readiness === 'medium') return { score: 0.6 }
  if (readiness === 'low') return { score: 0.3 }
  return { score: 0.5 }
}

/** يُسجّل المسارات الأهلية فقط — الترتيب حتمي: الملاءمة ثم المعرف الأبجدي */
export function scoreEligiblePathways(
  facts: FactBag,
  ctx: DecisionContext,
  eligibleIds: string[],
): V2Candidate[] {
  const candidates: V2Candidate[] = []
  for (const pathwayId of eligibleIds) {
    const persona = scorePersona(pathwayId, ctx)
    const goal = scoreGoal(pathwayId, facts)
    const domain = scoreDomain(pathwayId, ctx)
    const skills = assessPathwaySkills(pathwayId, ctx.skillStates)
    const feasibility = scoreFeasibility(pathwayId, facts)
    const motivation = scoreMotivation(facts)

    /* وزن فجوة المهارات الفعلي = الأساس × تغطية القياس؛ الباقي يُعاد توزيعه بالتساوي
       على الشخصية والهدف — لا عقوبة ولا مكافأة على مهارة لم تُقس */
    const skillWeight = W.skillGap * skills.measuredCoverage
    const redistributed = (W.skillGap - skillWeight) / 2
    const skillComponent = skills.gapScore ?? 0

    const total =
      persona.score * (W.persona + redistributed) +
      goal.score * (W.goal + redistributed) +
      domain.score * W.domain +
      skillComponent * skillWeight +
      feasibility.score * W.feasibility +
      motivation.score * W.motivation

    const reasons_ar = [persona.reason, goal.reason, domain.reason, feasibility.reason, motivation.reason].filter(
      (r): r is string => Boolean(r),
    )
    if (skills.gap.length > 0) reasons_ar.push(`لديك فجوة مقيسة في ${skills.gap.length} من مهاراته الأساسية.`)

    candidates.push({
      pathwayId,
      total,
      measuredSkillCoverage: skills.measuredCoverage,
      measurableSkillCoverage: skills.measurableCoverage,
      hasDirectSkillEvidence: skills.measured.length > 0,
      measurableRequiredCount: skills.measurableRequired.length,
      measurableMeasuredCount: skills.measured.filter((m) =>
        skills.measurableRequired.some((r) => r.slug === m.slug)).length,
      gapSkillSlugs: skills.gap.map((g) => g.slug),
      masteredSkillSlugs: skills.mastered.map((m) => m.slug),
      unknownSkillSlugs: skills.unknown.map((u) => u.slug),
      reasons_ar,
      breakdown: {
        persona: persona.score,
        goal: goal.score,
        domain: domain.score,
        skillGap: skills.gapScore,
        feasibility: feasibility.score,
        motivation: motivation.score,
      },
    })
  }
  candidates.sort((a, b) => b.total - a.total || a.pathwayId.localeCompare(b.pathwayId))
  return candidates
}
