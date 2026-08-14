/* تسجيل ملاءمة المسارات العشرين — خماسي الأبعاد بأوزان config */

import { launchPathways, pathwayProfiles, pathwaySkills } from './catalog'
import { FIT_WEIGHTS, WEEKLY_LOAD_ORDER } from './config'
import type { FactBag, FitBreakdown, PathwayCandidate } from './types'

const TARGET_LEVEL = 4
const UNKNOWN_LEVEL = 2.5

function scorePersona(pathwayId: string, facts: FactBag): { score: number; reason?: string } {
  const profile = pathwayProfiles[pathwayId]
  const persona = facts['persona_type']?.value as string | undefined
  if (!profile || profile.personas.length === 0) return { score: 0.5 }
  if (!persona) return { score: 0.4 }
  return profile.personas.includes(persona)
    ? { score: 1, reason: `وصفك الحالي يناسب جمهور هذا المسار.` }
    : { score: 0.1 }
}

function scoreGoal(pathwayId: string, facts: FactBag): { score: number; reason?: string } {
  const profile = pathwayProfiles[pathwayId]
  const goal = facts['primary_goal']?.value as string | undefined
  if (!profile || profile.goals.length === 0) return { score: 0.5 }
  if (!goal) return { score: 0.4 }
  return profile.goals.includes(goal)
    ? { score: 1, reason: `هدفك المعلن يطابق التحول الذي صمم لهذا المسار.` }
    : { score: 0.05 }
}

function scoreSkillGap(
  pathwayId: string,
  skillVector: Record<string, number>,
): { score: number; gap: string[]; mastered: string[]; reason?: string } {
  const skills = pathwaySkills(pathwayId)
  if (skills.length === 0) return { score: 0.4, gap: [], mastered: [] }
  const gap: string[] = []
  const mastered: string[] = []
  let sum = 0
  for (const s of skills) {
    const current = skillVector[s.slug] ?? UNKNOWN_LEVEL
    const g = Math.max(0, TARGET_LEVEL - current) / TARGET_LEVEL
    sum += g
    if (current < 3) gap.push(s.slug)
    else if (current >= 4) mastered.push(s.slug)
  }
  const score = sum / skills.length
  return {
    score,
    gap,
    mastered,
    reason: gap.length > 0 ? `لديك فجوة حقيقية في ${gap.length} من مهاراته الأساسية.` : undefined,
  }
}

function scoreFeasibility(pathwayId: string, facts: FactBag): { score: number; reason?: string } {
  const profile = pathwayProfiles[pathwayId]
  const load = facts['weekly_load']?.value as string | undefined
  if (!profile?.min_weekly_load || !load) return { score: 0.6 }
  const user = WEEKLY_LOAD_ORDER[load] ?? 2
  const need = WEEKLY_LOAD_ORDER[profile.min_weekly_load] ?? 2
  if (user >= need) return { score: 1, reason: 'وقتك الأسبوعي يكفي لعبء هذا المسار.' }
  if (user === need - 1) return { score: 0.5, reason: 'وقتك أقل قليلا من عبء المسار المعتاد — سيحتاج وتيرة أبطأ.' }
  return { score: 0.15, reason: 'وقتك الحالي دون الحد الأدنى لهذا المسار.' }
}

function scoreMotivation(facts: FactBag): { score: number; reason?: string } {
  const readiness = facts['application_readiness']?.value as string | undefined
  if (readiness === 'high') return { score: 1, reason: 'استعدادك للتطبيق العملي مرتفع.' }
  if (readiness === 'medium') return { score: 0.6 }
  if (readiness === 'low') return { score: 0.3 }
  return { score: 0.5 }
}

export function scorePathways(
  facts: FactBag,
  skillVector: Record<string, number>,
): PathwayCandidate[] {
  const candidates: PathwayCandidate[] = []
  for (const p of launchPathways) {
    const persona = scorePersona(p.id, facts)
    const goal = scoreGoal(p.id, facts)
    const gap = scoreSkillGap(p.id, skillVector)
    const feasibility = scoreFeasibility(p.id, facts)
    const motivation = scoreMotivation(facts)
    const total =
      persona.score * FIT_WEIGHTS.persona +
      goal.score * FIT_WEIGHTS.goal +
      gap.score * FIT_WEIGHTS.skillGap +
      feasibility.score * FIT_WEIGHTS.feasibility +
      motivation.score * FIT_WEIGHTS.motivation
    const reasons_ar = [persona.reason, goal.reason, gap.reason, feasibility.reason, motivation.reason].filter(
      (r): r is string => Boolean(r),
    )
    const fit: FitBreakdown = {
      persona: persona.score,
      goal: goal.score,
      skillGap: gap.score,
      feasibility: feasibility.score,
      motivation: motivation.score,
      total,
      reasons_ar,
    }
    candidates.push({ pathwayId: p.id, fit, gapSkillSlugs: gap.gap, masteredSkillSlugs: gap.mastered })
  }
  // ترتيب حتمي: الأعلى ملاءمة، وعند التعادل المعرف الأبجدي
  candidates.sort((a, b) => b.fit.total - a.fit.total || a.pathwayId.localeCompare(b.pathwayId))
  return candidates
}
