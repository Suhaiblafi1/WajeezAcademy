/* تسجيل ملاءمة المسارات العشرين — خماسي الأبعاد بأوزان config.
   بُعد الشخصية مركب داخليا وموثق: 0.5 وصف شخصي + 0.2 قطاع + 0.2 تخصص وظيفي + 0.1 مرحلة/سياق. */

import { launchPathways, pathwayProfiles, pathwaySkills } from './catalog'
import { FIT_WEIGHTS, WEEKLY_LOAD_ORDER } from './config'
import type { FactBag, FitBreakdown, PathwayCandidate } from './types'

const TARGET_LEVEL = 4
const UNKNOWN_LEVEL = 2.5

function scorePersona(pathwayId: string, facts: FactBag): { score: number; reason?: string } {
  const profile = pathwayProfiles[pathwayId]
  if (!profile) return { score: 0.5 }
  const persona = facts['persona_type']?.value as string | undefined
  const sector = facts['sector']?.value as string | undefined
  const fn = facts['function_specialization']?.value as string | string[] | undefined
  const stage = facts['business_stage']?.value as string | undefined
  const leadership = facts['leadership_context']?.value as string | undefined
  const publicFacing = facts['public_facing']?.value as string | undefined

  const personaPart =
    profile.personas.length === 0 ? 0.5 : !persona ? 0.4 : profile.personas.includes(persona) ? 1 : 0.1
  const sectorPart =
    profile.sectors.length === 0 ? 0.5 : !sector ? 0.4 : profile.sectors.includes(sector) ? 1 : 0.1
  const fnList = Array.isArray(fn) ? fn : fn ? [fn] : []
  const functionPart =
    profile.functions.length === 0 ? 0.5 : fnList.length === 0 ? 0.4 : fnList.some((f) => profile.functions.includes(f)) ? 1 : 0.15
  let contextPart = 0.5
  if (profile.business_stages && profile.business_stages.length > 0) {
    contextPart = !stage ? 0.4 : profile.business_stages.includes(stage) ? 1 : 0.2
  } else if (profile.leadership_fit && profile.leadership_fit.length > 0) {
    contextPart = !leadership ? 0.4 : profile.leadership_fit.includes(leadership) ? 1 : 0.2
  } else if (profile.public_facing_fit && profile.public_facing_fit.length > 0) {
    contextPart = !publicFacing ? 0.4 : profile.public_facing_fit.includes(publicFacing) ? 1 : 0.3
  }

  const score = personaPart * 0.5 + sectorPart * 0.2 + functionPart * 0.2 + contextPart * 0.1
  const reason =
    personaPart === 1
      ? sectorPart === 1 || functionPart === 1
        ? 'وصفك وقطاعك وتخصصك كلها تناسب جمهور هذا المسار.'
        : 'وصفك الحالي يناسب جمهور هذا المسار.'
      : undefined
  return { score, reason }
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

/* المهارة تختار **المسار** لا الدورة — وهذا ما يخفى على من يقرأ الملف مسرعا.

   `skillVector` يدخل هنا بمعرّف مسار، و`pathwaySkills` تجمع مهارات كل دورات
   ذلك المسار في سلّة واحدة (catalog.ts). فمهارةُ الدورة تُغذّي درجةَ مسارها
   ولا تُستعمل لانتقاء الدورة نفسها. والدورات تأتي بعد ذلك من قائمة المسار أو
   من القالب المركّب، لا من مطابقةٍ مهارية.

   ولمهارات الدورة استعمالٌ واحد على مستوى الدورة، وهو في composite.ts وللحذف
   لا للاختيار: `c.skill_slugs.every((s) => mastered.has(s))` — تُزال الدورة
   من الخطة إن ثبت إتقان **كل** مهاراتها بدليل موثّق، كي لا يدفع ثمن ما يتقنه.

   ويترتّب على ذلك أمرٌ عمليّ: «دورة لا تحمل مهارةً يقيسها التشخيص» ليست
   دورةً محجوبة عن المتعلّم — تُسلَّم كغيرها. أثرها الوحيد أنها لا تُسهم في
   درجة فجوة مسارها (وللمسار عشرون مهارة فأكثر، فأثر الواحدة ضئيل)، وأنها لا
   تُحذف أبدا ولو أتقن محتواها، لأن شرط `every` لا يتحقّق على ما لا يُقاس.
   قِيست هذه الحقيقة في 2026-08-30 بعد أن بُني عليها تحليلٌ خاطئ ظنّ أن
   المطابقة مهاريةٌ على مستوى الدورة. */
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
  // ترتيب حتمي: الأعلى ملاءمة؛ عند التعادل التام يُفضَّل مسار تطابق ملاءمته القيادية
  // سياق المستخدم (موثق: حقيقة leadership_context مدخلة من المستخدم نفسه)، ثم المعرف الأبجدي.
  const leadership = facts['leadership_context']?.value as string | undefined
  const leadAffinity = (pid: string): number => {
    const prof = pathwayProfiles[pid]
    return leadership && prof?.leadership_fit?.includes(leadership) ? 1 : 0
  }
  candidates.sort(
    (a, b) =>
      b.fit.total - a.fit.total ||
      leadAffinity(b.pathwayId) - leadAffinity(a.pathwayId) ||
      a.pathwayId.localeCompare(b.pathwayId),
  )
  return candidates
}
