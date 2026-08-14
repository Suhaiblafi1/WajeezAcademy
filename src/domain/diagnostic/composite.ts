/* محرك القوالب المركبة — 16 قالبا مركبا، ليست مسارات.
   التفعيل فقط عند حاجة ثنائية المجال؛ السمات: «خطة مركبة مخصصة». */

import { compositeTemplates, courseById, pathwaySkills } from './catalog'
import type { CompositeTemplate } from './catalog'
import { TEMPLATE_THRESHOLDS, TEMPLATE_WEIGHTS, WEEKLY_LOAD_ORDER } from './config'
import type {
  CompositeSelection,
  CoursePlanItem,
  FactBag,
  FactValue,
  PathwayCandidate,
  PlanVariant,
} from './types'

function evalOperator(op: string, fact: FactValue | undefined, values: (string | number)[]): boolean {
  if (op === 'exists') return fact !== undefined
  if (op === 'not_exists') return fact === undefined
  if (fact === undefined) return false
  const v = fact.value
  const target = values[0]
  const num = typeof v === 'number' ? v : NaN
  const tnum = typeof target === 'number' ? target : NaN
  switch (op) {
    case 'eq':
      return v === target
    case 'neq':
      return v !== target
    case 'in':
      return values.includes(v as string | number)
    case 'not_in':
      return !values.includes(v as string | number)
    case 'lt':
      return !isNaN(num) && num < tnum
    case 'lte':
      return !isNaN(num) && num <= tnum
    case 'gt':
      return !isNaN(num) && num > tnum
    case 'gte':
      return !isNaN(num) && num >= tnum
    case 'between':
      return !isNaN(num) && num >= tnum && num <= (values[1] as number)
    case 'contains':
      return Array.isArray(v) && v.includes(target as string)
    case 'not_contains':
      return Array.isArray(v) && !v.includes(target as string)
    case 'contains_any':
      return Array.isArray(v) && values.some((x) => (v as (string | number)[]).includes(x))
    case 'not_contains_any':
      return Array.isArray(v) && !values.some((x) => (v as (string | number)[]).includes(x))
    default:
      return false
  }
}

interface TemplateScore {
  template: CompositeTemplate
  fit: number
  missingRequiredFacts: string[]
  rationale_ar: string[]
  /** كتلة الأدلة: مجموع أوزان الإشارات الإيجابية المطابقة — فاصل حتمي عند تقارب الملاءمة */
  signalMass: number
}

function scoreTemplate(
  tpl: CompositeTemplate,
  facts: FactBag,
  candidates: PathwayCandidate[],
): TemplateScore {
  const d = tpl.diagnostic
  const rationale: string[] = []

  // تغطية الحقائق المطلوبة
  const missing = d.required_facts
    .filter((rf) => facts[rf.fact_key] === undefined)
    .map((rf) => rf.fact_key)

  // الإشارات الإيجابية المطابقة
  const matchedSignals = d.positive_signals.filter((s) =>
    evalOperator(s.operator, facts[s.fact_key], s.values),
  )
  const signalTotal = d.positive_signals.reduce((s, x) => s + x.weight, 0)
  const signalScore = signalTotal > 0 ? matchedSignals.reduce((s, x) => s + x.weight, 0) / signalTotal : 0
  for (const s of matchedSignals) if (s.rationale_ar) rationale.push(s.rationale_ar)

  // الإشارات السالبة تخصم
  const negHits = (d.negative_signals ?? []).filter((s) =>
    evalOperator(s.operator, facts[s.fact_key], s.values),
  )

  const goal = facts['primary_goal']?.value as string | undefined
  const goalMatch = goal && d.primary_goal_codes?.includes(goal) ? 1 : goal ? 0.1 : 0.4

  const personaSignal = d.positive_signals.find((s) => s.fact_key === 'persona_type')
  const personaMatch = personaSignal
    ? evalOperator(personaSignal.operator, facts['persona_type'], personaSignal.values)
      ? 1
      : 0.1
    : 0.5

  const stageSignals = d.positive_signals.filter((s) =>
    ['business_stage', 'operations_maturity', 'revenue_signal', 'offer_clarity'].includes(s.fact_key),
  )
  const stageMatch =
    stageSignals.length === 0
      ? 0.5
      : stageSignals.filter((s) => evalOperator(s.operator, facts[s.fact_key], s.values)).length /
        stageSignals.length

  // فجوة مهارات عبر المسارات الممثلة
  const represented = tpl.plan?.represented_pathway_ids ?? []
  const gapScores = represented.map((pid) => {
    const cand = candidates.find((c) => c.pathwayId === pid)
    if (cand) return cand.fit.skillGap
    const skills = pathwaySkills(pid)
    return skills.length > 0 ? 0.5 : 0
  })
  const crossGap = gapScores.length > 0 ? gapScores.reduce((a, b) => a + b, 0) / gapScores.length : 0.3

  const load = facts['weekly_load']?.value as string | undefined
  const minHours = tpl.plan?.minimum_weekly_hours ?? 4
  const minOrder = minHours <= 3 ? 1 : minHours <= 4 ? 2 : minHours <= 6 ? 3 : 4
  const userOrder = load ? (WEEKLY_LOAD_ORDER[load] ?? 2) : 2
  const feasibility = userOrder >= minOrder ? 1 : userOrder === minOrder - 1 ? 0.5 : 0.2

  const readiness = facts['application_readiness']?.value as string | undefined
  const readinessScore = readiness === 'high' ? 1 : readiness === 'medium' ? 0.6 : readiness === 'low' ? 0.3 : 0.5

  let fit =
    personaMatch * TEMPLATE_WEIGHTS.persona_match +
    goalMatch * TEMPLATE_WEIGHTS.goal_match +
    stageMatch * TEMPLATE_WEIGHTS.context_stage_match +
    crossGap * TEMPLATE_WEIGHTS.cross_path_skill_gap_match +
    feasibility * TEMPLATE_WEIGHTS.feasibility_match +
    readinessScore * TEMPLATE_WEIGHTS.application_readiness

  // عقوبات موثقة
  const coverage = d.required_facts.length === 0 ? 1 : 1 - missing.length / d.required_facts.length
  if (coverage < TEMPLATE_THRESHOLDS.minimum_required_fact_coverage) {
    fit -= Math.min(0.18, (TEMPLATE_THRESHOLDS.minimum_required_fact_coverage - coverage) * 0.9)
  }
  if (negHits.length > 0) fit -= Math.min(0.2, negHits.length * 0.1)
  // دمج إشارة الدليل الموجبة
  fit = fit * 0.85 + signalScore * 0.15

  return {
    template: tpl,
    fit: Math.max(0, Math.min(1, fit)),
    missingRequiredFacts: missing,
    rationale_ar: rationale,
    signalMass: matchedSignals.reduce((s, x) => s + x.weight, 0),
  }
}

/** هل تُفعل طبقة القوالب؟ فقط عند حاجة ثنائية المجال */
export function templatesActive(candidates: PathwayCandidate[]): boolean {
  const strong = candidates.filter((c) => c.fit.total >= TEMPLATE_THRESHOLDS.dual_pathway_activation_fit)
  if (strong.length < 2) return false
  // تحول واحد غير متعارض: المساران ليسا من نفس البادئة الوظيفية المتطابقة تماما
  return true
}

export function scoreTemplates(
  facts: FactBag,
  candidates: PathwayCandidate[],
): TemplateScore[] {
  const scored = compositeTemplates
    .filter((t) => t.status !== 'draft')
    .map((t) => scoreTemplate(t, facts, candidates))
  scored.sort((a, b) => b.fit - a.fit || a.template.template_id.localeCompare(b.template.template_id))
  return scored
}

function planVariant(facts: FactBag, evidenceConfidence: number): PlanVariant {
  const load = facts['weekly_load']?.value as string | undefined
  const order = load ? (WEEKLY_LOAD_ORDER[load] ?? 2) : 2
  if (order <= 2 || evidenceConfidence < 0.8) return 'starter'
  if (order === 3) return 'full'
  return 'extended'
}

export function buildCoursePlan(
  tpl: CompositeTemplate,
  variant: PlanVariant,
  masteredSkillSlugs: string[],
): CoursePlanItem[] {
  const mastered = new Set(masteredSkillSlugs)
  const isMastered = (courseId: string) => {
    const c = courseById.get(courseId)
    if (!c) return false
    return c.skill_slugs.length > 0 && c.skill_slugs.every((s) => mastered.has(s))
  }
  const items: CoursePlanItem[] = []
  const push = (
    courseId: string,
    sequence: number,
    type: CoursePlanItem['type'],
    titleAr?: string,
    hours?: number,
  ) => {
    if (items.some((i) => i.courseId === courseId)) return // منع التكرار
    if (isMastered(courseId)) return // تخطي المتقن
    const c = courseById.get(courseId)
    items.push({
      courseId,
      titleAr: titleAr ?? c?.title_ar ?? courseId,
      hours: hours ?? c?.total_hours ?? 0,
      sequence,
      type,
      reason_ar:
        type === 'required'
          ? 'مقرر أساسي في هذه الخطة.'
          : type === 'conditional'
            ? 'مقرر شرطي أضيف لملاءمته حالتك.'
            : 'مقرر جسري يربط مجالي الخطة.',
    })
  }

  if (variant === 'starter') {
    for (const s of tpl.starter_courses ?? []) push(s.course_id, s.sequence, 'required', s.course_title_ar, s.hours)
  } else {
    for (const r of tpl.required_courses ?? []) push(r.course_id, r.sequence, 'required', r.course_title_ar, r.hours)
    const maxCond =
      variant === 'extended'
        ? TEMPLATE_THRESHOLDS.max_conditional_courses_extended
        : TEMPLATE_THRESHOLDS.max_conditional_courses_full
    let cond = 0
    for (const cc of tpl.conditional_courses ?? []) {
      if (cond >= maxCond) break
      const before = items.length
      push(cc.course_id, 100 + cond, 'conditional', cc.course_title_ar, cc.hours)
      if (items.length > before) cond++
    }
    if (variant === 'extended') {
      for (const bc of tpl.bridge_courses ?? []) push(bc.course_id, 200, 'bridge', bc.course_title_ar, bc.hours)
    }
  }

  // سقف 80 ساعة دون مستشار
  let total = 0
  const capped: CoursePlanItem[] = []
  for (const item of items.sort((a, b) => a.sequence - b.sequence)) {
    if (total + item.hours > TEMPLATE_THRESHOLDS.max_plan_hours && item.type !== 'required') break
    total += item.hours
    capped.push(item)
  }
  return capped
}

export function selectTemplate(
  facts: FactBag,
  candidates: PathwayCandidate[],
  masteredSkillSlugs: string[],
): CompositeSelection | null {
  if (!templatesActive(candidates)) return null
  const scored = scoreTemplates(facts, candidates)
  const best = scored[0]
  if (!best) return null
  if (best.fit < TEMPLATE_THRESHOLDS.minimum_template_fit) return null
  if (best.missingRequiredFacts.length > TEMPLATE_THRESHOLDS.maximum_missing_required_facts) return null
  const second = scored[1]
  if (second && best.fit - second.fit < TEMPLATE_THRESHOLDS.top_two_margin) {
    // قالبان متقاربان: فاصل حتمي موثق بكتلة الأدلة المطابقة (مجموع أوزان الإشارات
    // الإيجابية المطابقة)؛ عند استمرار التعادل يحسم المعرف الأبجدي.
    if (second.signalMass > best.signalMass) {
      const resolved = second
      const variant = planVariant(facts, resolved.fit)
      const courses = buildCoursePlan(resolved.template, variant, masteredSkillSlugs)
      return {
        templateId: resolved.template.template_id,
        nameAr: resolved.template.name_ar,
        fit: resolved.fit,
        variant,
        courses,
        missingRequiredFacts: resolved.missingRequiredFacts,
        rationale_ar: [
          ...resolved.rationale_ar,
          'حُسم التقارب مع قالب آخر بكتلة الأدلة المطابقة من إجاباتك.',
        ],
      }
    }
  }
  const variant = planVariant(facts, best.fit)
  const courses = buildCoursePlan(best.template, variant, masteredSkillSlugs)
  return {
    templateId: best.template.template_id,
    nameAr: best.template.name_ar,
    fit: best.fit,
    variant,
    courses,
    missingRequiredFacts: best.missingRequiredFacts,
    rationale_ar: best.rationale_ar,
  }
}
