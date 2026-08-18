/* فضاء التوصيات الموحد — V2.1 المرحلة الثالثة.
   RecommendationEntity: تجريد واحد يجمع المسارات القياسية (20) والقوالب المركبة (16)
   في فضاء منافسة واحد — لا محرك للقياسية وآخر للمركبة.

   مصادر الحقيقة (لا تكرار):
   - المسارات: core-catalog.v2.json + pathway-profiles.v1.json + pathway-domains.v2.json
   - القوالب: composite-templates.v1.json
   - الدورات: مراجع course_id إلى الكتالوج المركزي فقط — تعديل الدورة ينعكس تلقائيًا هنا.
   حتمي بالكامل: نفس الكتالوج → نفس الفضاء. */

import {
  compositeTemplates,
  courseById,
  launchPathways,
  optionEffects,
  pathwayProfiles,
  questionById,
  type CompositeTemplate,
} from '../catalog'
import { WEEKLY_LOAD_ORDER } from '../config'
import type { FactBag } from '../types'
import { pathwayDomainsV2 } from '../v2/data'
import type { DomainId } from '../v2/types'
import { GOALS_V21, NEEDS_V21, type CareerStage } from './maps'
import { planOf } from './data'

/* ─── أنواع الفضاء ─── */
export type EntityType = 'standard' | 'composite'
export type EntityStatus =
  | 'approved_active'
  | 'needs_revision'
  | 'duplicate_candidate'
  | 'academically_weak'
  | 'inactive'
  | 'needs_academic_review'

export interface EntitySignal {
  fact_key: string
  operator: string
  values: (string | number)[]
  weight: number
  rationale_ar?: string
}

export interface EntityHardExclusion {
  id: string
  condition: { fact_key: string; operator: string; values: (string | number)[] }
  action: 'exclude' | 'advisor_handoff'
  rationale_ar: string
}

export interface RecommendationEntity {
  entity_id: string
  entity_type: EntityType
  title_ar: string
  status: EntityStatus
  /** أسباب حالة المراجعة — فارغة للنشط */
  status_reasons_ar: string[]
  transformation: { before_ar: string; after_ar: string; capstone_ar?: string; success_metric_ar?: string }
  best_for: string
  not_for: string
  /** مراحل مهنية مستهدفة — فارغة = بلا قيد مرحلي */
  career_stages: CareerStage[]
  /** رموز أهداف V2 القديمة المطابقة (قد لا تكون كلها قابلة للوصول في V2.1) */
  goals: string[]
  /** رموز الأهداف القابلة للوصول فعلًا في تدفق B2C الحالي */
  reachable_goals: string[]
  /** رموز احتياجات V2.1 التي تفتح هذا الكيان (مجالاتها تتقاطع مع مجالاته الجوهرية) */
  needs: string[]
  /** المجالات الجوهرية — للمركب: مجالات المسارات الممثلة في الدورات المطلوبة فقط */
  domains: DomainId[]
  /** كل المجالات الممثلة (للمركب — أوسع من الجوهرية، توثيقي) */
  extended_domains: DomainId[]
  functions: string[]
  sectors: string[]
  business_stages: string[]
  leadership_context: string[]
  positive_signals: EntitySignal[]
  negative_signals: EntitySignal[]
  hard_exclusions: EntityHardExclusion[]
  required_facts: { fact_key: string; question_ids: string[]; importance: string; minimum_confidence: number }[]
  /** حقائق مطلوبة لا يمكن إنتاجها في B2C الحالي — موثقة من التدقيق */
  unproducible_facts: string[]
  /** مهارات الكيان القابلة للقياس بأسئلة M4 النشطة — أدوات الفصل بين المرشحين */
  diagnostic_skills: string[]
  /** كل مهارات الكيان (من الدورات المركزية) */
  skill_slugs: string[]
  /** المسارات الممثلة: [self] للقياسي، represented_pathway_ids للمركب */
  pathway_requirements: string[]
  learning_outcomes: string[]
  minimum_evidence: { fact_coverage: number; domain_confidence: number }
  minimum_skill_evidence: { measured_coverage_floor: number }
  feasibility: { min_weekly_load_order: number; estimated_hours: number; duration_weeks: number }
  /** مراجع مركزية فقط — لا نسخ لبيانات الدورات */
  required_courses: string[]
  conditional_courses: string[]
  optional_courses: string[]
  estimated_hours: number
  differentiators: { against_entity_ids: string[]; question_id: string; question_ar?: string }[]
  explanation_rules: { why_not_single_ar?: string; removes_ar?: string }
}

/* ─── خرائط اشتقاق موثقة ─── */

/** شخصية V2 الأساسية → مراحل V2.1 (توسعة مشروعة: الموظف يشمل بداية المسار وذو الخبرة) */
export const PERSONA_BASE_TO_STAGES: Record<string, CareerStage[]> = {
  student: ['university_student', 'fresh_graduate'],
  early_career: ['fresh_graduate', 'early_career'],
  employee: ['early_career', 'experienced'],
  manager: ['manager', 'senior_manager'],
  founder: ['founder'],
  freelancer: ['freelancer'],
  trainer: ['trainer_ld'],
}

/** رموز الأهداف القديمة القابلة للوصول في B2C الحالي — من GOALS_V21 حصرًا */
export const REACHABLE_LEGACY_GOALS = new Set(GOALS_V21.map((g) => g.legacy_goal))

/** الحقائق القابلة للإنتاج في B2C: من تأثيرات خيارات الأسئلة النشطة + مقاييسها + الحقائق المحورية المشتقة */
export function b2cProducibleFacts(): Set<string> {
  const out = new Set<string>()
  for (const [qid, effects] of Object.entries(optionEffects)) {
    const plan = planOf(qid)
    if (!plan || plan.surface !== 'b2c') continue
    for (const eff of Object.values(effects)) for (const k of Object.keys(eff)) out.add(k)
  }
  for (const [qid, q] of questionById) {
    const plan = planOf(qid)
    if (!plan || plan.surface !== 'b2c') continue
    for (const m of q.measures) if (!m.endsWith('_vector')) out.add(m)
  }
  /* حقائق محورية تُشتق داخل المحرك (قواعد facts.ts + أسئلة القرار) */
  for (const k of ['persona_type', 'primary_goal', 'goal_code_v21', 'need_id', 'career_stage', 'employment_state', 'goal_clarity']) out.add(k)
  return out
}

/** المهارات القابلة للقياس بأسئلة نشطة (M4 بمقياس الدليل وما يماثلها) */
export function measurableSkills(): Set<string> {
  const out = new Set<string>()
  for (const [qid, q] of questionById) {
    const plan = planOf(qid)
    if (!plan || plan.surface !== 'b2c') continue
    if (q.answer_type === 'skill_level_5' && q.measures[0]) out.add(q.measures[0])
  }
  return out
}

/* ─── أدوات الدورات/المهارات ─── */
export function skillsOfCourses(courseIds: string[]): string[] {
  const seen = new Set<string>()
  for (const cid of courseIds) {
    const c = courseById.get(cid)
    if (!c) continue
    for (const s of c.skill_slugs) seen.add(s)
  }
  return [...seen].sort()
}

function hoursOfCourses(courseIds: string[]): number {
  return courseIds.reduce((s, cid) => s + (courseById.get(cid)?.total_hours ?? 0), 0)
}

function weeklyOrderFromHours(minHours: number): number {
  return minHours <= 3 ? 1 : minHours <= 4 ? 2 : minHours <= 6 ? 3 : 4
}

/** مجالات مجموعة مسارات */
function domainsOfPathways(ids: string[]): DomainId[] {
  const out = new Set<DomainId>()
  for (const id of ids) for (const d of pathwayDomainsV2[id] ?? []) out.add(d)
  return [...out].sort()
}

/** احتياجات V2.1 التي تتقاطع مجالاتها مع مجالات معطاة */
function needsCovering(domains: DomainId[]): string[] {
  if (domains.length === 0) return []
  const set = new Set(domains)
  return NEEDS_V21.filter((n) => n.domains.some((d) => set.has(d))).map((n) => n.code)
}

/* ─── بناء كيان قياسي ─── */
function buildStandardEntity(pathwayId: string): RecommendationEntity {
  const p = launchPathways.find((x) => x.id === pathwayId)!
  const profile = pathwayProfiles[pathwayId]
  const domains = [...(pathwayDomainsV2[pathwayId] ?? [])].sort()
  const stages = [...new Set((profile?.personas ?? []).flatMap((b) => PERSONA_BASE_TO_STAGES[b] ?? []))] as CareerStage[]
  const courses = p.course_ids
  const skills = skillsOfCourses(courses)
  const goals = profile?.goals ?? []
  const hard: EntityHardExclusion[] = []
  if (profile?.personas?.length) {
    hard.push({
      id: 'persona_mismatch',
      condition: { fact_key: 'persona_base', operator: 'not_in', values: profile.personas },
      action: 'exclude',
      rationale_ar: 'جمهور هذا المسار لا يشمل وصفك الحالي.',
    })
  }
  if (pathwayId === 'PW-GOV-002') {
    hard.push({
      id: 'gov_sector_required',
      condition: { fact_key: 'sector', operator: 'neq', values: ['public'] },
      action: 'exclude',
      rationale_ar: 'هذا المسار مخصص للقطاع الحكومي.',
    })
  }
  return {
    entity_id: pathwayId,
    entity_type: 'standard',
    title_ar: p.title,
    status: 'approved_active',
    status_reasons_ar: [],
    transformation: { before_ar: p.before, after_ar: p.after, capstone_ar: p.capstone },
    best_for: p.audience,
    not_for: p.not_for ?? '',
    career_stages: stages,
    goals,
    reachable_goals: goals.filter((g) => REACHABLE_LEGACY_GOALS.has(g)),
    needs: needsCovering(domains),
    domains,
    extended_domains: domains,
    functions: profile?.functions ?? [],
    sectors: profile?.sectors ?? [],
    business_stages: profile?.business_stages ?? [],
    leadership_context: profile?.leadership_fit ?? [],
    positive_signals: [
      { fact_key: 'primary_goal', operator: 'in', values: goals, weight: 1, rationale_ar: 'هدفك يطابق التحول المصمم للمسار.' },
      { fact_key: 'need_domains', operator: 'contains_any', values: domains, weight: 1.2, rationale_ar: 'احتياجك في صميم مجال المسار.' },
    ],
    negative_signals: [],
    hard_exclusions: hard,
    required_facts: [
      { fact_key: 'career_stage', question_ids: ['QC-S1-001'], importance: 'required', minimum_confidence: 0.65 },
      { fact_key: 'primary_goal', question_ids: ['QC-G2-001'], importance: 'required', minimum_confidence: 0.65 },
      { fact_key: 'need_id', question_ids: ['QC-N3-001'], importance: 'required', minimum_confidence: 0.65 },
    ],
    unproducible_facts: [],
    diagnostic_skills: [],
    skill_slugs: skills,
    pathway_requirements: [pathwayId],
    learning_outcomes: skills,
    minimum_evidence: { fact_coverage: 1, domain_confidence: 0.55 },
    minimum_skill_evidence: { measured_coverage_floor: 0 },
    feasibility: {
      min_weekly_load_order: WEEKLY_LOAD_ORDER[profile?.min_weekly_load ?? '3_4'] ?? 2,
      estimated_hours: hoursOfCourses(courses),
      duration_weeks: p.duration_weeks,
    },
    required_courses: courses,
    conditional_courses: [],
    optional_courses: [],
    estimated_hours: hoursOfCourses(courses),
    differentiators: [],
    explanation_rules: {},
  }
}

/* ─── تدقيق قالب مركب (البند ٢) — قواعد حتمية موثقة، لا حكم انطباعي ─── */
export interface CompositeAudit {
  template_id: string
  name_ar: string
  metrics: {
    transformation_complete: boolean
    audience_defined: boolean
    courses_valid: boolean
    invalid_courses: string[]
    core_domains: DomainId[]
    extended_domains: DomainId[]
    incremental_skill_value: number
    duplicate_course_pairs: { a: string; b: string; jaccard: number }[]
    unproducible_required_facts: string[]
    reachable_goals: string[]
    needs_entry: string[]
  }
  status: EntityStatus
  reasons_ar: string[]
}

export function auditComposite(tpl: CompositeTemplate, producible: Set<string>): CompositeAudit {
  const reasons: string[] = []
  const tr = tpl.transformation ?? {}
  const transformationComplete = Boolean(tr.before_ar && tr.after_ar && tr.capstone_ar && tr.success_metric_ar)
  const audienceDefined = Boolean(tpl.persona?.best_for_ar && tpl.persona?.not_for_ar)

  const reqIds = (tpl.required_courses ?? []).map((c) => c.course_id)
  const condIds = (tpl.conditional_courses ?? []).map((c) => c.course_id)
  const bridgeIds = (tpl.bridge_courses ?? []).map((c) => c.course_id)
  const startIds = (tpl.starter_courses ?? []).map((c) => c.course_id)
  /* الدورة نفسها قد تظهر في أكثر من قائمة (مطلوبة + شرطية مثلًا) — نُفردها قبل فحص
     التشابه حتى لا تُقارن الدورة بنفسها فتُوسم الخطة بالازدواج زورًا */
  const allIds = [...new Set([...reqIds, ...condIds, ...bridgeIds, ...startIds])]
  const invalidCourses = allIds.filter((id) => !courseById.has(id))
  const coursesValid = invalidCourses.length === 0

  /* المجالات الجوهرية = مجالات المسارات التي تمد الدورات المطلوبة */
  const corePathways = [...new Set((tpl.required_courses ?? []).map((c) => c.pathway_id).filter((x): x is string => Boolean(x)))]
  const represented = tpl.plan?.represented_pathway_ids ?? []
  const coreDomains = domainsOfPathways(corePathways.length > 0 ? corePathways : represented)
  const extendedDomains = domainsOfPathways(represented)

  /* القيمة الإضافية: مهارات لا يغطيها أي مسار جوهري مفرد */
  const unionSkills = new Set(skillsOfCourses(reqIds))
  const bestSingle = Math.max(
    0,
    ...corePathways.map((pid) => {
      const pw = launchPathways.find((x) => x.id === pid)
      const pwSkills = pw ? skillsOfCourses(pw.course_ids).filter((s) => unionSkills.has(s)) : []
      return pwSkills.length
    }),
  )
  const incrementalValue = unionSkills.size - bestSingle

  /* ازدواجية الدورات داخل القالب — تشابه مهاري ≥ 0.6 (البند 13) */
  const dupPairs: CompositeAudit['metrics']['duplicate_course_pairs'] = []
  const skillSets = new Map(allIds.map((id) => [id, new Set(courseById.get(id)?.skill_slugs ?? [])]))
  for (let i = 0; i < allIds.length; i++) {
    for (let j = i + 1; j < allIds.length; j++) {
      const a = skillSets.get(allIds[i])!
      const b = skillSets.get(allIds[j])!
      if (a.size === 0 || b.size === 0) continue
      const inter = [...a].filter((s) => b.has(s)).length
      const jac = inter / (a.size + b.size - inter)
      if (jac >= 0.6) dupPairs.push({ a: allIds[i], b: allIds[j], jaccard: Math.round(jac * 100) / 100 })
    }
  }

  const unproducible = (tpl.diagnostic?.required_facts ?? [])
    .filter((rf) => rf.importance === 'required' && !producible.has(rf.fact_key))
    .map((rf) => rf.fact_key)
  const goals = tpl.diagnostic?.primary_goal_codes ?? []
  const reachableGoals = goals.filter((g) => REACHABLE_LEGACY_GOALS.has(g))
  const needsEntry = needsCovering(coreDomains)

  /* التصنيف — الترتيب مقصود: البنية أولًا ثم الإنتاجية ثم الأكاديمية */
  let status: EntityStatus
  if (!transformationComplete || !audienceDefined) {
    status = 'needs_academic_review'
    if (!transformationComplete) reasons.push('التحول غير مكتمل (قبل/بعد/تتويج/مقياس نجاح) — لا يمكن تحديد قيمته من البيانات.')
    if (!audienceDefined) reasons.push('الجمهور (لمن هو/لمن لا يناسب) غير محدد — لا يمكن بناء أهلية صارمة.')
  } else if (!coursesValid) {
    status = 'needs_revision'
    reasons.push(`مراجع دورات غير موجودة في الكتالوج المركزي: ${invalidCourses.join('، ')}.`)
  } else if (unproducible.length > 0) {
    status = 'needs_revision'
    reasons.push(
      `حقائق مطلوبة (importance=required) لا يستطيع تدفق B2C الحالي إنتاجها: ${unproducible.join('، ')} — لا تُنتجها أي إجابة ممكنة، فينافس القالب بعجز دائم في تغطية الأدلة حتى تُراجع أكاديميًا.`,
    )
  } else if (coreDomains.length < 2) {
    status = 'academically_weak'
    reasons.push('دوراته المطلوبة تخدم مجالًا واحدًا — ليس مركبًا حقيقيًا؛ مسار قياسي يغطيه.')
  } else if (incrementalValue <= 0) {
    status = 'duplicate_candidate'
    reasons.push('لا مهارة إضافية فوق أفضل مسار جوهري مفرد — لا قيمة تركيبية مثبتة.')
  } else if (dupPairs.length > 0) {
    status = 'duplicate_candidate'
    reasons.push(`دورتان متشابهتان مهاريًا داخل الخطة: ${dupPairs.map((d) => `${d.a}~${d.b}`).join('، ')}.`)
  } else {
    status = 'approved_active'
    if (reachableGoals.length === 0) {
      reasons.push('دخوله من الاحتياج/المجال لا من رمز هدف (البند 7) — أهدافه القديمة غير قابلة للوصول في B2C الحالي.')
    }
  }

  return {
    template_id: tpl.template_id,
    name_ar: tpl.name_ar,
    metrics: {
      transformation_complete: transformationComplete,
      audience_defined: audienceDefined,
      courses_valid: coursesValid,
      invalid_courses: invalidCourses,
      core_domains: coreDomains,
      extended_domains: extendedDomains,
      incremental_skill_value: incrementalValue,
      duplicate_course_pairs: dupPairs,
      unproducible_required_facts: unproducible,
      reachable_goals: reachableGoals,
      needs_entry: needsEntry,
    },
    status,
    reasons_ar: reasons,
  }
}

/* ─── بناء كيان مركب ─── */
function buildCompositeEntity(tpl: CompositeTemplate, audit: CompositeAudit): RecommendationEntity {
  const reqIds = (tpl.required_courses ?? []).map((c) => c.course_id)
  const condIds = (tpl.conditional_courses ?? []).map((c) => c.course_id)
  const bridgeIds = (tpl.bridge_courses ?? []).map((c) => c.course_id)
  const startIds = (tpl.starter_courses ?? []).map((c) => c.course_id)
  const personaSignal = (tpl.diagnostic?.positive_signals ?? []).find((s) => s.fact_key === 'persona_type')
  const stages = personaSignal
    ? ([...new Set(personaSignal.values.flatMap((v) => PERSONA_BASE_TO_STAGES[String(v)] ?? []))] as CareerStage[])
    : []
  const goals = tpl.diagnostic?.primary_goal_codes ?? []
  const measurable = measurableSkills()
  const skills = skillsOfCourses(reqIds)

  return {
    entity_id: tpl.template_id,
    entity_type: 'composite',
    title_ar: tpl.name_ar,
    status: audit.status,
    status_reasons_ar: audit.reasons_ar,
    transformation: {
      before_ar: tpl.transformation?.before_ar ?? '',
      after_ar: tpl.transformation?.after_ar ?? '',
      capstone_ar: tpl.transformation?.capstone_ar,
      success_metric_ar: tpl.transformation?.success_metric_ar,
    },
    best_for: tpl.persona?.best_for_ar ?? '',
    not_for: tpl.persona?.not_for_ar ?? '',
    career_stages: stages,
    goals,
    reachable_goals: audit.metrics.reachable_goals,
    needs: audit.metrics.needs_entry,
    domains: audit.metrics.core_domains,
    extended_domains: audit.metrics.extended_domains,
    functions: [],
    sectors: [],
    business_stages: [],
    leadership_context: [],
    positive_signals: tpl.diagnostic?.positive_signals ?? [],
    negative_signals: tpl.diagnostic?.negative_signals ?? [],
    hard_exclusions: (tpl.diagnostic?.hard_filters ?? [])
      .filter((f) => f.action !== 'recommend_bridge')
      .map((f) => ({
        id: f.filter_id,
        condition: f.condition,
        action: f.action === 'advisor_handoff' ? ('advisor_handoff' as const) : ('exclude' as const),
        rationale_ar: f.rationale_ar ?? '',
      })),
    required_facts: tpl.diagnostic?.required_facts ?? [],
    unproducible_facts: audit.metrics.unproducible_required_facts,
    diagnostic_skills: skills.filter((s) => measurable.has(s)),
    skill_slugs: skills,
    pathway_requirements: tpl.plan?.represented_pathway_ids ?? [],
    learning_outcomes: skills,
    minimum_evidence: { fact_coverage: 0.8, domain_confidence: 0.55 },
    minimum_skill_evidence: { measured_coverage_floor: 0 },
    feasibility: {
      min_weekly_load_order: weeklyOrderFromHours(tpl.plan?.minimum_weekly_hours ?? 4),
      estimated_hours: hoursOfCourses(reqIds),
      duration_weeks: tpl.plan?.recommended_duration_weeks ?? 12,
    },
    required_courses: reqIds,
    conditional_courses: condIds,
    optional_courses: [...bridgeIds, ...startIds],
    estimated_hours: hoursOfCourses(reqIds),
    differentiators: (tpl.diagnostic?.differentiators ?? []).map((d) => ({
      against_entity_ids: d.against_template_ids,
      question_id: d.question_id,
      question_ar: d.question_ar,
    })),
    explanation_rules: {},
  }
}

/* ─── الفضاء الكامل — مبني مرة واحدة من الكتالوج الفعال ─── */
export interface RecommendationUniverse {
  entities: RecommendationEntity[]
  audits: CompositeAudit[]
  byId: Map<string, RecommendationEntity>
  active: RecommendationEntity[]
}

let cached: RecommendationUniverse | null = null

export function recommendationUniverse(): RecommendationUniverse {
  if (cached) return cached
  const producible = b2cProducibleFacts()
  const audits = compositeTemplates.map((t) => auditComposite(t, producible))
  const auditById = new Map(audits.map((a) => [a.template_id, a]))
  const standards = launchPathways.map((p) => buildStandardEntity(p.id))
  const composites = compositeTemplates.map((t) => buildCompositeEntity(t, auditById.get(t.template_id)!))
  const entities = [...standards, ...composites]
  /* المهارات التشخيصية للمسارات القياسية — تقاس بالمقياس نفسه */
  const measurable = measurableSkills()
  for (const e of standards) e.diagnostic_skills = e.skill_slugs.filter((s) => measurable.has(s))
  cached = {
    entities,
    audits,
    byId: new Map(entities.map((e) => [e.entity_id, e])),
    active: entities.filter((e) => e.status === 'approved_active'),
  }
  return cached
}

/** إعادة البناء عند استبدال لقطة الكتالوج */
export function resetUniverseCache() {
  cached = null
}

/* ─── أدوات مساندة للمحرك ─── */

/** المجالات النشطة للمستخدم — العتبة نفسها المستخدمة في أهلية V2 */
export function activeDomainsOf(facts: FactBag, domains: { scores: Partial<Record<DomainId, number>> }, minScore = 0.25): DomainId[] {
  const interest = facts['interest_domains']?.value
  const interestList = Array.isArray(interest) ? (interest as string[]) : []
  const out = new Set<DomainId>(
    (Object.entries(domains.scores) as [DomainId, number][]).filter(([, s]) => s >= minScore).map(([d]) => d),
  )
  for (const d of interestList) out.add(d as DomainId)
  return [...out]
}
