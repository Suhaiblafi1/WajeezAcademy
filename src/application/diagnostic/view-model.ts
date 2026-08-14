/* محوّل نتيجة المحرك الجديد إلى شكل DiagResult الذي تعرضه الواجهة الحالية */

import { goalLabel, skillLabel } from '../../domain/diagnostic/explanation'
import type { Recommendation } from '../../domain/diagnostic/types'
import type { DiagResult, GapDetail } from '../../data/diagnostic'
import { pathwayById, pathways } from '../../data/pathways'
import { courseById, pathwayCourses, pathwayPriceFor } from '../../data/courses'

const LEGACY_PERSONA: Record<string, string> = {
  student: 'student',
  early_career: 'graduate',
  employee: 'employee',
  manager: 'employee',
  founder: 'entrepreneur',
  freelancer: 'entrepreneur',
  trainer: 'employee',
  organization: 'employee',
}

const LEGACY_GOAL: Record<string, string> = {
  first_job: 'job',
  promotion: 'job',
  business_launch: 'project',
  first_customer: 'project',
  revenue_growth: 'project',
  launch_service_business: 'project',
  career_direction: 'change',
  personal_growth: 'skill',
  family_wellbeing: 'family',
  lead_team: 'performance',
  operational_improvement: 'performance',
  digital_transformation: 'skill',
  financial_decision: 'performance',
  personal_brand: 'skill',
  explore: 'change',
}

const LEGACY_GAP_SLUGS: Record<string, string> = {
  data_literacy: 'data',
  arabic_business_writing: 'writing',
  public_speaking: 'communication',
  communication_persuasion: 'communication',
  project_management: 'projects',
  ai_literacy: 'ai',
  ai_applied_use: 'ai',
}

const LEVEL_AR = ['لا يعرفها', 'مبتدئ', 'يستخدمها أحيانا', 'جيد عمليا', 'متقدم']

export function recommendationToDiagResult(
  rec: Recommendation,
  skillVector: Record<string, number>,
  facts?: Record<string, { value: unknown }>,
  factsRaw?: Record<string, string>,
): DiagResult {
  const topPathway = rec.primaryPathway ? pathwayById(rec.primaryPathway.pathwayId) : undefined
  const top = topPathway ?? pathways[0]

  // البديلان: أسرع وأقل تكلفة
  const altPathways = rec.alternatives
    .map((a) => ({ cand: a, p: pathwayById(a.pathwayId) }))
    .filter((x): x is { cand: NonNullable<Recommendation['alternatives'][number]>; p: NonNullable<typeof topPathway> } => Boolean(x.p))
  const faster = altPathways.find((x) => x.p.durationWeeks < top.durationWeeks)?.p ?? altPathways[0]?.p ?? null
  const cheaperEntry =
    altPathways
      .filter((x) => x.p.id !== faster?.id)
      .map((x) => ({ p: x.p, price: pathwayPriceFor((pathwayCourses[x.p.id] ?? []).length || 6) }))
      .sort((a, b) => a.price - b.price)[0] ?? null

  const pid = rec.primaryPathway?.pathwayId ?? top.id
  const gapSlugs = rec.primaryPathway?.gapSkillSlugs ?? []
  const gaps = [...new Set(gapSlugs.map((s) => LEGACY_GAP_SLUGS[s]).filter((g): g is string => Boolean(g)))]
  const gapDetails: GapDetail[] = gapSlugs.slice(0, 6).map((slug) => {
    const level = skillVector[slug] ?? 0
    const coveredBy = (pathwayCourses[pid] ?? [])
      .map((cid) => courseById(cid))
      .filter((c) => c && (c.skill || '').includes(skillLabel(slug, pid).split(' ')[0]))
      .map((c) => c!.name)
      .slice(0, 2)
    return {
      skill: skillLabel(slug, pid),
      current: level > 0 ? LEVEL_AR[Math.min(4, level - 1)] : 'لم يُقيَّم بعد',
      target: 'مستوى تطبيقي واثق',
      priority: level <= 2 ? ('عالية' as const) : ('متوسطة' as const),
      coveredBy,
    }
  })

  const goalCode = rec.primaryPathway ? undefined : undefined
  void goalCode

  const storyLines = facts && factsRaw ? storyFromFacts(facts, factsRaw) : undefined
  const skillBars = skillBarsFromEngine(skillVector, gapSlugs, pid)

  return {
    top,
    faster,
    cheaper: cheaperEntry,
    confidence: Math.round(rec.confidence.total * 100),
    confidenceBand: rec.confidence.band_ar,
    needsAdvisor: rec.kind === 'advisor_referral',
    reasons: rec.reasons_ar,
    gaps,
    gapDetails,
    unavailableSkills: rec.unavailable_skills.map((u) => skillLabel(u.skill)),
    priorOverlap: (rec.primaryPathway?.masteredSkillSlugs ?? []).map((s) => skillLabel(s, pid)),
    changeMakers: rec.change_makers_ar,
    reconciled: true,
    secondGoal: null,
    resultJson: {
      kind: rec.kind,
      pathway_id: rec.primaryPathway?.pathwayId ?? null,
      composite: rec.composite
        ? {
            template_id: rec.composite.templateId,
            name_ar: rec.composite.nameAr,
            variant: rec.composite.variant,
            label_ar: 'خطة مركبة مخصصة',
            courses: rec.composite.courses,
            fit: rec.composite.fit,
          }
        : null,
      confidence: rec.confidence,
      reasons_ar: rec.reasons_ar,
      change_makers_ar: rec.change_makers_ar,
      unavailable_skills: rec.unavailable_skills,
      trainer: rec.trainer,
      disclaimer_ar: rec.disclaimer_ar,
      decision_trace: rec.trace,
      story_ar: storyLines ?? [],
      skill_bars: skillBars ?? [],
    },
  }
}

/** لقب عربي للشخصية من حقائق المحرك */
const PERSONA_AR: Record<string, string> = {
  student: 'طالب يستعد لسوق العمل',
  early_career: 'خريج جديد يبحث عن فرصته الأولى',
  employee: 'موظف يطمح للأفضل',
  manager: 'مدير يقود فريقا',
  founder: 'رائد أعمال يبني مشروعه',
  freelancer: 'مستقل يبني عمله الحر',
  trainer: 'مدرب أو مصمم تعلم',
  organization: 'جهة عمل',
}

const LOAD_AR: Record<string, string> = {
  lt_3: 'أقل من 3 ساعات أسبوعيا',
  '3_4': '3 إلى 4 ساعات أسبوعيا',
  '5_6': '5 إلى 6 ساعات أسبوعيا',
  '7_plus': '7 ساعات فأكثر أسبوعيا',
}

const FORMAT_AR: Record<string, string> = {
  self_video: 'فيديو ذاتي',
  live_trainer: 'مباشر مع مدرب',
  applied_projects: 'تطبيق ومشاريع',
  reading: 'قراءة وملخصات',
  mixed: 'مزيج مرن',
}

/** ملخص قصة المتعلم من حقائق المحرك — يحل محل storySummary القديم */
export function storyFromFacts(facts: Record<string, { value: unknown }>, factsRaw: Record<string, string>): string[] {
  const lines: string[] = []
  const persona = facts['persona_type']?.value as string | undefined
  const branch = facts['persona_branch']?.value as string | undefined
  const goal = facts['primary_goal']?.value as string | undefined
  const sector = facts['sector']?.value as string | undefined
  const who = persona ? PERSONA_AR[persona] : branch === 'family' ? 'والد/والدة يقود تعلم أسرته' : branch === 'unsure' ? 'مستكشف يبحث عن اتجاهه' : undefined
  if (who) {
    lines.push(
      `أنت ${who}${sector === 'public' ? ' في القطاع الحكومي' : sector === 'private' ? ' في القطاع الخاص' : ''}، وغايتك ${goal ? goalLabel(goal) : 'أن يختلف شيء حقيقي في حياتك بعد أشهر'}.`,
    )
  }
  const pain = factsRaw['current_pain']
  if (pain) lines.push(`ما يبطئك فعلا بلسانك: «${pain.slice(0, 120)}» — ومسارك مبني ليعالج هذا أولا.`)
  const load = facts['weekly_load']?.value as string | undefined
  const format = facts['learning_format']?.value as string | undefined
  if (load || format) {
    lines.push(
      `إيقاعك الواقعي: ${load ? LOAD_AR[load] ?? load : 'وقت مرن'}${format ? `، وتتعلم أفضل عبر ${FORMAT_AR[format] ?? format}` : ''}.`,
    )
  }
  return lines
}

export interface SkillBar {
  slug: string
  label: string
  level: number
  measured: boolean
  isGap: boolean
}

/** خريطة المهارات المرئية من متجه مهارات المحرك وفجوات المسار الأول */
export function skillBarsFromEngine(
  skillVector: Record<string, number>,
  gapSlugs: string[],
  pathwayId?: string,
): SkillBar[] {
  const gapSet = new Set(gapSlugs)
  const bars: SkillBar[] = []
  for (const [slug, level] of Object.entries(skillVector)) {
    bars.push({ slug, label: skillLabel(slug, pathwayId), level, measured: true, isGap: gapSet.has(slug) })
  }
  // فجوات المسار غير المقيسة تظهر كـ«لم تُقس»
  for (const slug of gapSlugs) {
    if (!bars.some((b) => b.slug === slug)) {
      bars.push({ slug, label: skillLabel(slug, pathwayId), level: 0, measured: false, isGap: true })
    }
  }
  return bars.slice(0, 8)
}

export function factsToLegacyAnswers(
  rec: Recommendation,
  facts: Record<string, { value: unknown }>,
  factsRaw: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {}
  const persona = facts['persona_type']?.value as string | undefined
  const branch = facts['persona_branch']?.value as string | undefined
  if (persona) out.persona = LEGACY_PERSONA[persona] ?? 'employee'
  else if (branch === 'family') out.persona = 'family'
  else if (branch === 'unsure') out.persona = 'unsure'
  const goal = facts['primary_goal']?.value as string | undefined
  if (goal) out.goal = LEGACY_GOAL[goal] ?? 'skill'
  const gapSlugs = rec.primaryPathway?.gapSkillSlugs ?? []
  const legacy = [...new Set(gapSlugs.map((s) => LEGACY_GAP_SLUGS[s]).filter(Boolean))] as string[]
  if (legacy.length) out.sk_gaps = legacy.join(',')
  const notes = factsRaw['current_pain'] ?? factsRaw['current_responsibility'] ?? ''
  if (notes) out.notes = notes
  // لقب الهدف العربي الجديد متاح أيضا للتقرير
  if (goal) out.goal_ar = goalLabel(goal)
  return out
}
