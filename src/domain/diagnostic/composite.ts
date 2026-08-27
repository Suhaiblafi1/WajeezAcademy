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

interface HardFilterHit {
  filterId: string
  action: 'exclude' | 'recommend_bridge' | 'advisor_handoff'
  rationale_ar: string
}

/** تقييم المرشحات الصارمة للقالب — أول مرشح منطبق يقرر المصير، موثقا بالمعرف والسبب */
function evalHardFilters(tpl: CompositeTemplate, facts: FactBag): HardFilterHit | null {
  for (const f of tpl.diagnostic.hard_filters ?? []) {
    if (evalOperator(f.condition.operator, facts[f.condition.fact_key], f.condition.values)) {
      return { filterId: f.filter_id, action: f.action, rationale_ar: f.rationale_ar ?? '' }
    }
  }
  return null
}

interface TemplateScore {
  template: CompositeTemplate
  fit: number
  missingRequiredFacts: string[]
  rationale_ar: string[]
  /** تغطية الحقائق المطلوبة 0..1 — حد صارم لا عقوبة نقاط */
  factCoverage: number
  /** مرشح صارم منطبق إن وُجد — exclude/recommend_bridge يستبعدان القالب من الأهلية */
  hardFilter: HardFilterHit | null
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
    factCoverage: coverage,
    hardFilter: evalHardFilters(tpl, facts),
  }
}

/** مجال المسار من معرفه (PW-EMP-005 → EMP) — التفعيل يتطلب مجالين مختلفين فعلا */
function pathwayDomain(pathwayId: string): string {
  return pathwayId.split('-')[1] ?? pathwayId
}

/** هل تُفعل طبقة القوالب؟ فقط عند حاجة تمتد فعلا إلى مجالين:
    مساران قويان من مجالين مختلفين — لا مجرد وجود مسارين مرتفعي النقاط */
export function templatesActive(candidates: PathwayCandidate[]): boolean {
  const strong = candidates.filter((c) => c.fit.total >= TEMPLATE_THRESHOLDS.dual_pathway_activation_fit)
  if (strong.length < 2) return false
  const domains = new Set(strong.slice(0, 4).map((c) => pathwayDomain(c.pathwayId)))
  return domains.size >= 2
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

/** القوالب المؤهلة: حدود صارمة — تغطية حقائق ≥ 80٪ ولا يغيب أكثر من حقل حاسم واحد،
    والمرشح الصارم exclude/recommend_bridge يستبعد القالب مهما بلغت ملاءمته */
function eligibleTemplates(scored: TemplateScore[]): TemplateScore[] {
  return scored.filter(
    (s) =>
      (s.hardFilter === null || s.hardFilter.action === 'advisor_handoff') &&
      s.fit >= TEMPLATE_THRESHOLDS.minimum_template_fit &&
      s.factCoverage >= TEMPLATE_THRESHOLDS.minimum_required_fact_coverage &&
      s.missingRequiredFacts.length <= TEMPLATE_THRESHOLDS.maximum_missing_required_facts,
  )
}

export interface PendingDifferentiator {
  questionId: string
  questionAr: string
  between: { templateId: string; nameAr: string }[]
  margin: number
}

/** سؤال فاصل مطلوب: أفضل قالبين مؤهلين متقاربان (< 0.08) ويوجد سؤال فاصل لم يُسأل بعد */
export function pendingDifferentiator(
  facts: FactBag,
  candidates: PathwayCandidate[],
  askedIds: Set<string>,
  bankQuestionIds: Set<string>,
): PendingDifferentiator | null {
  if (!templatesActive(candidates)) return null
  const eligible = eligibleTemplates(scoreTemplates(facts, candidates))
  if (eligible.length < 2) return null
  const [a, b] = eligible
  const margin = a.fit - b.fit
  if (margin >= TEMPLATE_THRESHOLDS.top_two_margin) return null
  /* ابحث في مميزات القالبين عن سؤال فاصل لم يُسأل وموجود فعلا في البنك */
  for (const tpl of [a.template, b.template]) {
    const other = tpl.template_id === a.template.template_id ? b : a
    for (const d of tpl.diagnostic.differentiators ?? []) {
      if (!d.against_template_ids.includes(other.template.template_id)) continue
      if (askedIds.has(d.question_id)) continue
      if (!bankQuestionIds.has(d.question_id)) continue
      return {
        questionId: d.question_id,
        questionAr: d.question_ar ?? '',
        between: [
          { templateId: a.template.template_id, nameAr: a.template.name_ar },
          { templateId: b.template.template_id, nameAr: b.template.name_ar },
        ],
        margin,
      }
    }
  }
  /* إن لم يوجد سؤال فاصل موثق: التقارب قد يكون وليد نقص دليل — اسأل السؤال الذي يغطي
     حقيقة مطلوبة ناقصة لأحد القالبين قبل أي توقف، فإجابته تعيد حساب الفارق كاملا */
  for (const s of [a, b]) {
    for (const rf of s.template.diagnostic.required_facts) {
      if (!s.missingRequiredFacts.includes(rf.fact_key)) continue
      const qid = rf.question_ids.find((id) => !askedIds.has(id) && bankQuestionIds.has(id))
      if (qid) {
        return {
          questionId: qid,
          questionAr: '',
          between: [
            { templateId: a.template.template_id, nameAr: a.template.name_ar },
            { templateId: b.template.template_id, nameAr: b.template.name_ar },
          ],
          margin,
        }
      }
    }
  }
  return null
}

function planVariant(facts: FactBag, evidenceConfidence: number): PlanVariant {
  const load = facts['weekly_load']?.value as string | undefined
  const order = load ? (WEEKLY_LOAD_ORDER[load] ?? 2) : 2
  if (order <= 2 || evidenceConfidence < 0.8) return 'starter'
  if (order === 3) return 'full'
  return 'extended'
}

export interface CoursePlan {
  items: CoursePlanItem[]
  /** دورات حُذفت بدليل إتقان قوي موثق — مع سبب كل حذف */
  removed: { courseId: string; titleAr: string; reason_ar: string }[]
  /** الدورات المطلوبة وحدها تتجاوز 80 ساعة — الخطة لا تُصدر آليا بل تُحال لمستشار */
  requiredOverflow: boolean
  /** المطلوبة وحدها فوق سقف المقررات — لا يُقتطع أساسي بصمت، ويُحسم في بيانات القالب */
  requiredOverCourseCap?: boolean
}

export function buildCoursePlan(
  tpl: CompositeTemplate,
  variant: PlanVariant,
  verifiedMasteredSkillSlugs: string[],
): CoursePlan {
  const mastered = new Set(verifiedMasteredSkillSlugs)
  const isVerifiedMastered = (courseId: string) => {
    const c = courseById.get(courseId)
    if (!c) return false
    return c.skill_slugs.length > 0 && c.skill_slugs.every((s) => mastered.has(s))
  }
  const items: CoursePlanItem[] = []
  const removed: CoursePlan['removed'] = []
  const push = (
    courseId: string,
    sequence: number,
    type: CoursePlanItem['type'],
  ) => {
    if (items.some((i) => i.courseId === courseId)) return // منع التكرار
    /* المصدر الوحيد للحقيقة: الكتالوج المركزي. الحقول المضمنة في القالب
       (course_title_ar / hours) توثيقية للمراجعة البشرية فقط، لا يعتمد عليها
       المحرك — ويضبط اتساقها تدقيقُ البيانات حتى لا تتقادم */
    const c = courseById.get(courseId)
    if (isVerifiedMastered(courseId)) {
      /* الحذف فقط بدليل إتقان موثق (ليس تقييما ذاتيا) — وكل قدرات الدورة متقنة
         بحكم الشرط نفسه، فتبقى القدرات المستهدفة مغطاة بعد الحذف */
      removed.push({
        courseId,
        titleAr: c?.title_ar ?? courseId,
        reason_ar: 'أُزيلت لأن إتقان مهاراتها كافة مثبت بدليل موثق — لا تدفع ثمن ما تتقنه.',
      })
      return
    }
    items.push({
      courseId,
      titleAr: c?.title_ar ?? courseId,
      hours: c?.total_hours ?? 0,
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
    for (const s of tpl.starter_courses ?? []) push(s.course_id, s.sequence, 'required')
  } else {
    for (const r of tpl.required_courses ?? []) push(r.course_id, r.sequence, 'required')
    const maxCond =
      variant === 'extended'
        ? TEMPLATE_THRESHOLDS.max_conditional_courses_extended
        : TEMPLATE_THRESHOLDS.max_conditional_courses_full
    let cond = 0
    for (const cc of tpl.conditional_courses ?? []) {
      if (cond >= maxCond) break
      const before = items.length
      push(cc.course_id, 100 + cond, 'conditional')
      if (items.length > before) cond++
    }
    if (variant === 'extended') {
      for (const bc of tpl.bridge_courses ?? []) push(bc.course_id, 200, 'bridge')
    }
  }

  /* سقفان: 80 ساعة، وستة مقررات.

     كان السقف على الساعات وحدها، فبلغت النسخة الكاملة ثمانية أو تسعة مقررات
     والموسّعة عشرة في القوالب الستة عشر كلها — بينما وعد المنتج للمتعلم خطة من
     ستة يستبدل منها ويحذف وفوقها الهدية. والزائد لا يزيده خيارا بل عبئا يقرأه
     ثم يقرأ مثله في البطاقة التالية.

     والترتيب: الأساسي أولا، فالشرطي، فالجسري — فما يُقتطع هو الأقل إلزاما.
     أما قالب مقرراته الأساسية وحدها فوق الستة (TPL-ECOM-001 بسبعة) فلا يُقتطع
     منه أساسي بصمت: خطة ناقصة الإلزام أسوأ من خطة طويلة. يُبقى كما هو ويُرفع
     في requiredOverCourseCap ليُحسم في بيانات القالب لا في المحرك. */
  const sorted = items.sort((a, b) => a.sequence - b.sequence)
  const requiredItems = sorted.filter((i) => i.type === 'required')
  const requiredHours = requiredItems.reduce((s, i) => s + i.hours, 0)
  if (requiredHours > TEMPLATE_THRESHOLDS.max_plan_hours) {
    return { items: [], removed, requiredOverflow: true }
  }
  const requiredOverCourseCap = requiredItems.length > TEMPLATE_THRESHOLDS.max_plan_courses
  let total = 0
  const capped: CoursePlanItem[] = []
  for (const item of sorted) {
    const optional = item.type !== 'required'
    if (optional && total + item.hours > TEMPLATE_THRESHOLDS.max_plan_hours) break
    if (optional && capped.length >= TEMPLATE_THRESHOLDS.max_plan_courses) break
    total += item.hours
    capped.push(item)
  }
  return { items: capped, removed, requiredOverflow: false, requiredOverCourseCap }
}

export function selectTemplate(
  facts: FactBag,
  candidates: PathwayCandidate[],
  verifiedMasteredSkillSlugs: string[],
): CompositeSelection | null {
  if (!templatesActive(candidates)) return null
  const eligible = eligibleTemplates(scoreTemplates(facts, candidates))
  const best = eligible[0]
  if (!best) return null
  const second = eligible[1]
  if (second && best.fit - second.fit < TEMPLATE_THRESHOLDS.top_two_margin) {
    /* قالبان متقاربان: لا حسم بالترتيب ولا بكتلة الإشارات. إن وُجد سؤال فاصل لم يُسأل
       فالمحرك يطرحه قبل الوصول هنا، وإن استُنفدت الأسئلة الفاصلة لا نختلق حسما —
       يعود القرار مسارا واحدا أو إحالة مستشار بحسب قوة الأدلة */
    return null
  }
  const variant = planVariant(facts, best.fit)
  const plan = buildCoursePlan(best.template, variant, verifiedMasteredSkillSlugs)
  const nearest = second
    ? {
        templateId: second.template.template_id,
        nameAr: second.template.name_ar,
        fit: second.fit,
        whyNot_ar: `فارق الملاءمة ${((best.fit - second.fit) * 100).toFixed(0)}٪ رجّح الخطة المختارة — إجاباتك عن ${second.missingRequiredFacts.length > 0 ? 'حقائقه الناقصة' : 'سياقك'} قد تقلب الترتيب.`,
      }
    : undefined
  return {
    templateId: best.template.template_id,
    nameAr: best.template.name_ar,
    fit: best.fit,
    variant,
    courses: plan.items,
    removedCourses: plan.removed,
    requiredHoursOverflow: plan.requiredOverflow,
    missingRequiredFacts: best.missingRequiredFacts,
    rationale_ar: best.rationale_ar,
    representedPathwayIds: best.template.plan?.represented_pathway_ids ?? [],
    capstone_ar: best.template.transformation?.capstone_ar,
    success_metric_ar: best.template.transformation?.success_metric_ar,
    nearestAlternative: nearest,
    advisorHandoff:
      best.hardFilter?.action === 'advisor_handoff'
        ? { filterId: best.hardFilter.filterId, rationale_ar: best.hardFilter.rationale_ar }
        : undefined,
  }
}
