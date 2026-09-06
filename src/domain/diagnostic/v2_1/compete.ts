/* المنافسة الموحدة — V2.1 المرحلة الثالثة.
   خط الأنابيب الصارم (البند 6):
     All Entities → Status Filter → Hard Persona/Stage → Goal/Need/Domain Eligibility
     → Context Eligibility → Evidence Availability → Scoring.
   لا Score لكيان غير مؤهل ثم تخفضه — غير المؤهل لا يدخل المنافسة أصلًا.

   قواعد فوز المركب (البنود 3-5):
   - Fit يُقاس بنفس المكونات الستة للقياسي والمركب؛ Breadth لا يدخل Fit أبدًا.
   - المركب يدفع تكلفة التعقيد (Burden) قبل المقارنة: Simplest sufficient pathway wins.
   - لا يفوز إلا بـ incremental_value_over_best_standard: حاجة متعددة المجالات حقيقية
     + فجوة مجال يتركها أفضل قياسي + تجاوز عتبة ذات معنى + جدوى.
   حتمي بالكامل: نفس الحقائق → نفس الترتيب. */

import { WEEKLY_LOAD_ORDER } from '../config'
import type { FactBag } from '../types'
import { DOMAIN_CONFIDENCE_MIN } from '../v2/domains'
import { basePersonaCode } from '../v2/personas'
import { TARGET_LEVEL } from '../v2/skills'
import { resolveSkillLevels, evidenceCoverage } from './skill-families'
import { measurableSkills } from './universe'
import { layersOfSkill, isDiagnosticSkillActive, functionDomainsV2, domainLabelAr } from '../v2/data'
import type { DecisionContext, DomainId, SkillState } from '../v2/types'
import type { CareerStage } from './maps'
import {
  REACHABLE_LEGACY_GOALS,
  activeDomainsOf,
  gateDomainsOf,
  recommendationUniverse,
  type RecommendationEntity,
} from './universe'

/* أوزان الملاءمة الستة — نفس أوزان V2 للقياسي، وتطبق بحذفها نفسه على المركب */
const W = {
  persona: 0.2,
  goal: 0.2,
  domain: 0.15,
  skillGap: 0.25,
  feasibility: 0.1,
  motivation: 0.1,
} as const

/* تكلفة التعقيد للمركب — موثقة وقابلة للمراجعة (البند 5).
   دورة إضافية = التزام متابعة؛ ساعة إضافية فوق أول 24 = أسبوع عمل إضافي؛ مجال جوهري
   إضافي = تبديل سياق معرفي. عُايرت لتكون كلفة بساطة حقيقية لا مانعًا رياضيًا:
   مركب نموذجي (6 دورات، ~52 ساعة، 3 مجالات) يدفع ≈ 0.08 — يخسر عند التعادل،
   ولا يستحيل فوزه عندما يغطي فعلًا مجالين مُثبتين من حاجة المستخدم. */
const BURDEN_PER_COURSE = 0.006
const BURDEN_PER_HOUR_OVER_24 = 0.0006
const BURDEN_PER_CORE_DOMAIN = 0.012

/* عتبة القيمة الإضافية: ميزة الملاءمة الخام المطلوبة فوق أفضل قياسي بعد البوابات
   البنيوية (البند 4). 0.02: فوق ضجيج التقريب (0.001) ودون هامش الفصل (0.08) —
   فوز المركب قرار متقارب بطبيعته، لذا تلازمه إشارة مراجعة مستشار عبر مكوّن الفصل. */
export const INCREMENT_THRESHOLD = 0.02
/** إجابة «أبني مجموعة مهارات مترابطة» تخفض العتبة — تفضيل المستخدم موثق ويغيّر النتيجة (البند 12) */
export const INCREMENT_THRESHOLD_PORTFOLIO_PREF = 0.01

/** أدنى ملاءمة لعرض كيان نهائي على مستكشف غير محسوم — دونها لا نفرض مسارًا (البند 10) */
export const EXPLORATION_FIT_FLOOR = 0.55
/** أدنى ملاءمة لأي كيان قبل إعلان فجوة كتالوج/إحالة مستشار (البند 15) */
export const CATALOG_GAP_FIT_FLOOR = 0.35

export interface EntitySkillAssessment {
  measuredCoverage: number
  /** المقيسُ ممّا **يستطيع البنكُ قياسَه** — المقاسُ بوزنٍ كامل والمستدَلُّ بنصفه.
      سقفُها المئة، وعليها وحدَها يُعاير مانعُ «التطابق القويّ». */
  measurableCoverage: number
  /** أبينَ مهاراتِ هذا الكيان مهارةٌ **قِيست مباشرةً**؟ */
  hasDirectSkillEvidence: boolean
  gapScore: number | null
  gapSkillSlugs: string[]
  masteredSkillSlugs: string[]
  unknownSkillSlugs: string[]
}

/* ═══════════ ما يُقاس، وما يُرجَّح، وما يبقى مجهولا ═══════════

   `gap` و`mastered` و`measuredCoverage` تبقى **على المقاس مباشرةً وحدَه**:
   هذه ادّعاءاتٌ عن المتعلّم تُعرض له وتدخل حسابَ الفجوة، وتقييمُه الذاتيَّ
   لعائلةٍ ترجيحٌ لا يجوز أن يصير «فجوةً مقيسة».

   والجديدةُ `measurableCoverage` تجيب سؤالا آخر: **هل استوفينا ما نملك؟**
   وفيها يُحتسب المستدَلُّ بنصف وزنٍ — وهو رقمٌ موثَّقٌ في `skill-families`،
   إعلانُ أنّ الترجيح لا يساوي القياس. */
export function assessEntitySkills(
  entity: RecommendationEntity,
  skillStates: Map<string, SkillState>,
  familyRatings: Record<string, number> = {},
): EntitySkillAssessment {
  const required = entity.skill_slugs.filter((slug) => {
    const meta = layersOfSkill(slug)
    return isDiagnosticSkillActive(meta)
  })
  const measured: number[] = []
  const gap: string[] = []
  const mastered: string[] = []
  const unknown: string[] = []
  const measuredSlugs = new Set<string>()
  for (const slug of required) {
    const st = skillStates.get(slug)
    if (st?.state === 'measured' && st.level !== undefined) {
      measured.push(st.level)
      measuredSlugs.add(slug)
      if (st.level < 3) gap.push(slug)
      else if (st.level >= TARGET_LEVEL) mastered.push(slug)
    } else {
      unknown.push(slug)
    }
  }
  const measuredCoverage = required.length === 0 ? 1 : measured.length / required.length

  /* التغطيةُ على المسطرة التي نملكها */
  const canMeasure = measurableSkills()
  const measurableRequired = required.filter((slug) => canMeasure.has(slug))
  const resolved = resolveSkillLevels(measurableRequired, skillStates, familyRatings)
  const measurableCoverage = measurableRequired.length === 0 ? 1 : evidenceCoverage(resolved)

  const gapScore =
    measured.length === 0 ? null : measured.reduce((s, l) => s + Math.max(0, TARGET_LEVEL - l) / TARGET_LEVEL, 0) / measured.length
  return {
    measuredCoverage,
    measurableCoverage,
    hasDirectSkillEvidence: measuredSlugs.size > 0,
    gapScore,
    gapSkillSlugs: gap,
    masteredSkillSlugs: mastered,
    unknownSkillSlugs: unknown,
  }
}

/* ─── الأهلية الصارمة (Hard Eligibility) ─── */
export interface EntityEligibility {
  entityId: string
  entityType: 'standard' | 'composite'
  eligible: boolean
  /** المرحلة التي أقصته — للتدقيق: status | persona_stage | domain | context | evidence | feasibility */
  stage_ar?: string
  excludedReasons_ar: string[]
}

function evalCondition(op: string, fact: { value: unknown } | undefined, values: (string | number)[]): boolean {
  if (op === 'exists') return fact !== undefined
  if (op === 'not_exists') return fact === undefined
  if (fact === undefined) return false
  const v = fact.value as string | number | (string | number)[]
  switch (op) {
    case 'eq':
      return v === values[0]
    case 'neq':
      return v !== values[0]
    case 'in':
      return values.includes(v as string | number)
    case 'not_in':
      return !values.includes(v as string | number)
    case 'contains':
      return Array.isArray(v) && v.includes(values[0])
    case 'contains_any':
      return Array.isArray(v) && values.some((x) => (v as (string | number)[]).includes(x))
    /* عوامل عددية — إشارات القوالب على المهارات المقيسة (lte/gte/between) */
    case 'lte':
      return typeof v === 'number' && v <= Number(values[0])
    case 'gte':
      return typeof v === 'number' && v >= Number(values[0])
    case 'between':
      return typeof v === 'number' && v >= Number(values[0]) && v <= Number(values[1])
    default:
      return false
  }
}

export function assessEntityEligibility(
  entity: RecommendationEntity,
  facts: FactBag,
  ctx: DecisionContext,
): EntityEligibility {
  const reasons: string[] = []
  let stage_ar: string | undefined

  /* ١) الحالة — غير المعتمد لا يدخل المنافسة أبدًا */
  if (entity.status !== 'approved_active') {
    return { entityId: entity.entity_id, entityType: entity.entity_type, eligible: false, stage_ar: 'الحالة', excludedReasons_ar: [`الكيان بحالة «${entity.status}» — لا ينافس حتى تكتمل مراجعته.`] }
  }

  /* ٢) المرحلة/الشخصية — صارمة عندما تُعرف والكيان يحدد جمهورًا */
  const base = basePersonaCode(ctx.persona.key)
  if (entity.entity_type === 'standard') {
    const profilePersonas = entity.hard_exclusions.find((h) => h.id === 'persona_mismatch')?.condition.values as string[] | undefined
    if (base && profilePersonas?.length && !profilePersonas.includes(base)) {
      reasons.push('جمهور هذا المسار لا يشمل وصفك الحالي.')
      stage_ar = 'الشخصية/المرحلة'
    }
  } else if (entity.career_stages.length > 0) {
    const userStage = facts['career_stage']?.value as CareerStage | undefined
    if (userStage && !entity.career_stages.includes(userStage)) {
      reasons.push('هذه الخطة صُممت لمرحلة مهنية مختلفة عن وضعك.')
      stage_ar = 'الشخصية/المرحلة'
    }
  } else {
    /* لا جمهور معلن: يفشل مغلقا لا مفتوحا.
       كان غياب الإعلان يعني القبول الشامل، فينافس الكيانُ كلَّ متعلم بلا قيد —
       وهكذا كان «العلامة المهنية» يُعرض على خريج حديث بينما نصّه يستثني من لا
       يملك أدلة يمكن التحقق منها. عقوبة الصمت أن تخرج من المنافسة لا أن تدخل
       كل منافسة. ويكشفها تدقيق الفضاء بالاسم فلا تختفي بصمت. */
    reasons.push('لم يُعلَن جمهور هذه الخطة بعد — لا تنافس حتى يُحدَّد.')
    stage_ar = 'الشخصية/المرحلة'
  }

  /* ٣) الهدف/الاحتياج/المجال — صارم بعد وضوح المجال فقط (لا استبعاد مبكر متسرع) */
  const goal = facts['primary_goal']?.value as string | undefined
  const domainReady = ctx.domains.confidence >= DOMAIN_CONFIDENCE_MIN && goal !== undefined
  const activeDomains = domainReady ? activeDomainsOf(facts, ctx.domains) : []
  if (domainReady && activeDomains.length > 0 && !entity.domains.some((d) => activeDomains.includes(d))) {
    reasons.push('الكيان خارج مجال حاجتك التي ظهرت من إجاباتك.')
    stage_ar = stage_ar ?? 'المجال'
  }

  /* ٤) السياق — مرحلة المشروع/القيادة/الاحتكاك/القطاع + المرشحات الصارمة للقوالب */
  const businessStage = facts['business_stage']?.value as string | undefined
  if (entity.business_stages.length > 0 && businessStage && !entity.business_stages.includes(businessStage)) {
    reasons.push('مرحلة مشروعك لا تناسب ما صُمم له هذا الكيان.')
    stage_ar = stage_ar ?? 'السياق'
  }
  const leadership = facts['leadership_context']?.value as string | undefined
  if (entity.leadership_context.length > 0 && leadership && !entity.leadership_context.includes(leadership)) {
    reasons.push('الكيان مصمم لسياق قيادي مختلف عن واقعك.')
    stage_ar = stage_ar ?? 'السياق'
  }
  for (const h of entity.hard_exclusions) {
    if (h.id === 'persona_mismatch') continue // عولجت أعلاه
    if (h.id === 'gov_sector_required') {
      const sector = facts['sector']?.value as string | undefined
      if (sector && sector !== 'public') {
        reasons.push(h.rationale_ar)
        stage_ar = stage_ar ?? 'السياق'
      }
      continue
    }
    if (evalCondition(h.condition.operator, facts[h.condition.fact_key], h.condition.values)) {
      if (h.action === 'exclude') {
        reasons.push(h.rationale_ar || 'مرشح صارم يستبعد هذا الكيان.')
        stage_ar = stage_ar ?? 'السياق'
      }
      /* advisor_handoff لا يستبعد — يُوسم عند الفوز */
    }
  }

  /* ٥) الجدوى الصارمة للمركب — خطة تتجاوز وقت المستخدم لا تفوز (البند: infeasible by time → cannot win) */
  if (entity.entity_type === 'composite') {
    const load = facts['weekly_load']?.value as string | undefined
    if (load) {
      const userOrder = WEEKLY_LOAD_ORDER[load] ?? 2
      if (userOrder < entity.feasibility.min_weekly_load_order) {
        reasons.push(`الخطة تتطلب ${entity.feasibility.estimated_hours} ساعة إجمالًا — وقتك الأسبوعي الحالي دون حدها الأدنى.`)
        stage_ar = stage_ar ?? 'الجدوى'
      }
    }
  }

  return { entityId: entity.entity_id, entityType: entity.entity_type, eligible: reasons.length === 0, stage_ar, excludedReasons_ar: reasons }
}

/* ─── التسجيل الموحد — نفس المكونات الستة للنوعين ─── */
export interface EntityCandidate {
  entity: RecommendationEntity
  fit: number
  /** تكلفة التعقيد — صفر للقياسي */
  burden: number
  /** fit − burden — أساس المقارنة النهائية */
  netFit: number
  skills: EntitySkillAssessment
  /** دليل إشارات القالب (مركب فقط) — موثق للتدقيق */
  signals?: SignalEvidence
  reasons_ar: string[]
  breakdown: {
    persona: number
    goal: number
    domain: number
    skillGap: number | null
    feasibility: number
    motivation: number
  }
}

function scorePersonaComponent(entity: RecommendationEntity, facts: FactBag, ctx: DecisionContext): { score: number; reason?: string } {
  const isComposite = entity.entity_type === 'composite'
  if (isComposite) {
    const signal = entity.positive_signals.find((s) => s.fact_key === 'persona_type')
    if (!signal) return { score: 0.5 }
    const personaFact = facts['persona_type']?.value as string | undefined
    if (!personaFact) return { score: 0.4 }
    return evalCondition(signal.operator, facts['persona_type'], signal.values)
      ? { score: 1, reason: 'وصفك الحالي يناسب جمهور هذه الخطة.' }
      : { score: 0.1 }
  }
  const profilePersonas = entity.hard_exclusions.find((h) => h.id === 'persona_mismatch')?.condition.values as string[] | undefined
  if (!profilePersonas || profilePersonas.length === 0) return { score: 0.5 }
  const base = basePersonaCode(ctx.persona.key)
  if (!base) return { score: 0.4 }
  return profilePersonas.includes(base) ? { score: 1, reason: 'وصفك الحالي يناسب جمهور هذا المسار.' } : { score: 0.1 }
}

function scoreGoalComponent(entity: RecommendationEntity, facts: FactBag, needDomainMatch: boolean): { score: number; reason?: string } {
  const goal = facts['primary_goal']?.value as string | undefined
  if (entity.goals.length === 0) return { score: 0.5 }
  if (!goal) return { score: 0.4 }
  if (entity.goals.includes(goal)) return { score: 1, reason: 'هدفك المعلن يطابق التحول الذي صُمم له.' }
  /* البند 7: الهدف وحده لا يكفي ولا يُقصي — كيان لا رمز هدف قابلًا للوصول له يدخل من الاحتياج/المجال */
  if (entity.goals.every((g) => !REACHABLE_LEGACY_GOALS.has(g))) return { score: 0.5, reason: 'يدخل من احتياجك ومجاله — لا من رمز الهدف.' }
  /* هدف مختلف لكن الاحتياج أثبت المجال — الحاجة الموثقة أقوى من تسمية الهدف */
  if (needDomainMatch) return { score: 0.45 }
  return { score: 0.05 }
}

function scoreDomainComponent(entity: RecommendationEntity, facts: FactBag, ctx: DecisionContext): { score: number; reason?: string } {
  const activeDomains = activeDomainsOf(facts, ctx.domains)
  if (activeDomains.length === 0) return { score: 0.5 }
  const hit = entity.domains.filter((d) => activeDomains.includes(d))
  if (hit.length === 0) return { score: 0.2 }
  /* تغطية حاجة المستخدم المُثبتة — لا اتساع الكيان الداخلي (البند 3):
     قوة كل مجال نشط مُغطى (معيارية بسقف 1) نسبة إلى مجموع قوة كل المجالات النشطة.
     حاجة أحادية المجال: من يغطيها ينل 1.0 كاملة — سلوك مطابق للسابق.
     حاجة متعددة: من يغطي مجالين مُثبتين يتفوق فعلًا على من يغطي واحدًا. */
  const norm = (d: DomainId) => Math.min(1, (ctx.domains.scores[d] ?? 0) / 1.2)
  const coveredStrength = hit.reduce((s, d) => s + norm(d), 0)
  const totalStrength = activeDomains.reduce((s, d) => s + norm(d), 0)
  const coverage = totalStrength > 0 ? coveredStrength / totalStrength : 0
  const score = 0.2 + 0.8 * coverage
  return {
    score,
    reason:
      hit.length >= 2
        ? `يغطي ${hit.length} من مجالات حاجتك المُثبتة — لا مجالًا واحدًا فقط.`
        : 'مجاله في صميم حاجتك التي ظهرت من إجاباتك.',
  }
}

/* الجدوى الزمنية — تُقاس فقط إذا وُجدت الحقيقة. بعد تقاعد سؤال الوقت لا تُقاس
   أبدًا، فيُعاد توزيع وزنها كما يُعاد وزن فجوة المهارات غير المقيسة: المجهول
   لا يعاقب ولا يكافئ. وإعادتها كـ0.6 ثابتة كانت تخصم 0.04 من ملاءمة كل كيان
   بلا استثناء — فتنخفض trackFit والثقة، فيطلب المحرك أسئلة أكثر بحثًا عن
   يقين لا ينقصه شيء أصلًا. */
function scoreFeasibilityComponent(
  entity: RecommendationEntity,
  facts: FactBag,
): { score: number; measured: boolean; reason?: string } {
  const load = facts['weekly_load']?.value as string | undefined
  if (!load) return { score: 0, measured: false }
  const user = WEEKLY_LOAD_ORDER[load] ?? 2
  const need = entity.feasibility.min_weekly_load_order
  if (user >= need) return { score: 1, measured: true, reason: 'وقتك الأسبوعي يكفي لعبء هذه الخطة.' }
  if (user === need - 1) return { score: 0.5, measured: true, reason: 'وقتك أقل قليلًا من العبء المعتاد — وتيرة أبطأ.' }
  return { score: 0.15, measured: true, reason: 'وقتك الحالي دون الحد الأدنى لهذه الخطة.' }
}

function scoreMotivationComponent(facts: FactBag): { score: number; reason?: string } {
  const readiness = facts['application_readiness']?.value as string | undefined
  if (readiness === 'high') return { score: 1, reason: 'استعدادك للتطبيق العملي مرتفع.' }
  if (readiness === 'medium') return { score: 0.6 }
  if (readiness === 'low') return { score: 0.3 }
  return { score: 0.5 }
}

/* ─── مُفاضلات الأدلة المعلنة — V2.1 المرحلة 4 (موثقة، لا ضبط يدوي لنتيجة بعينها) ─── */

/* ١) مطابقة الاحتياج المعلن مباشرة: الكيان يعلن قائمة احتياجاته (needs) من بيانات الكتالوج،
   والمستخدم يعلن need_id صراحة — المطابقة دليل حقيقي يفصل توأمين مجاليين (عمليات/إمداد، مبيعات/تفاوض).
   الوزن صغير متعمد: يحسم التقارب ولا يقلب فجوة حقيقية. */
export const NEED_DIRECT_BONUS = 0.03

/* ٢) محاذاة الوظيفة للمسارات القياسية: بروفايل المسار يعلن وظائفه (functions) —
   تطابق function_specialization المقيسة يؤيد، وتناقضها ينفي. محايد عند غياب الدليل. */
export const FUNCTION_ALIGN_WEIGHT = 0.03

/* ٢ب) محاذاة السياق القيادي: بروفايل المسار يعلن leadership_fit (مثل «مدير جديد») —
   يفصل «مديرًا يقود فريقه أول مرة» عن «متخصص مواهب» عند تقاسم المجال نفسه. */
export const LEADERSHIP_ALIGN_WEIGHT = 0.03

/* ٣) دليل إشارات القالب المركب: إشاراته الموجبة/السالبة المعلنة في الكتالوج (وضوح العرض،
   إشارة الإيراد، السياق القيادي…) بقيت بيانات ميتة لا تدخل التسجيل — فهيمن قالب على آخر
   رغم إشاراته السالبة. هنا تُوزن الإشارات (عدا persona_type/primary_goal — لهما مكوناهما)
   وتعدّل ملاءمة المركب بمقدار ±نصف الوزن. المهارة المقيسة تُقرأ من skillStates لا الحقائق. */
export const SIGNAL_EVIDENCE_WEIGHT = 0.08

/** قيمة حقيقة أو مهارة مقيسة لغرض تقييم الإشارة — الحقائق أولًا ثم مخزن المهارات */
function signalFactOf(key: string, facts: FactBag, skillStates: Map<string, SkillState>): { value: unknown } | undefined {
  const f = facts[key]
  if (f !== undefined) return f
  const st = skillStates.get(key)
  if (st?.state === 'measured' && st.level !== undefined) return { value: st.level }
  return undefined
}

export interface SignalEvidence {
  adjustment: number
  matchedPositive: string[]
  matchedNegative: string[]
  totalPositive: number
  totalNegative: number
}

export function compositeSignalEvidence(
  entity: RecommendationEntity,
  facts: FactBag,
  skillStates: Map<string, SkillState>,
): SignalEvidence {
  const pos = entity.positive_signals.filter((s) => s.fact_key !== 'persona_type' && s.fact_key !== 'primary_goal')
  const neg = entity.negative_signals
  /* المجهول لا يعاقب ولا يكافأ (نفس فلسفة المهارات): النسبة تُحسب على الإشارات
     المعروفة فقط — حقيقة لم تُجمع بعد ليست دليل نفي. بلا هذا يُدان كل مركب
     بإشارات لم تُتح جلسة الأسئلة فرصة قياسها أصلًا */
  let posHit = 0
  let posKnown = 0
  const matchedPositive: string[] = []
  for (const s of pos) {
    const w = s.weight || 1
    const fact = signalFactOf(s.fact_key, facts, skillStates)
    if (fact === undefined) continue
    posKnown += w
    if (evalCondition(s.operator, fact, s.values)) {
      posHit += w
      matchedPositive.push(s.fact_key)
    }
  }
  let negHit = 0
  let negKnown = 0
  const matchedNegative: string[] = []
  for (const s of neg) {
    const w = s.weight || 1
    const fact = signalFactOf(s.fact_key, facts, skillStates)
    if (fact === undefined) continue
    negKnown += w
    if (evalCondition(s.operator, fact, s.values)) {
      negHit += w
      matchedNegative.push(s.fact_key)
    }
  }
  const posRatio = posKnown > 0 ? posHit / posKnown : 0.5
  const negRatio = negKnown > 0 ? negHit / negKnown : 0
  /* السالبة المطابقة تخصم بثلاثة أرباع وزنها — إشارة نفي واحدة قوية تكفي لكبح قالب */
  const evidence = Math.min(1, Math.max(0, posRatio - 0.75 * negRatio))
  return {
    adjustment: Math.round(SIGNAL_EVIDENCE_WEIGHT * (evidence - 0.5) * 1000) / 1000,
    matchedPositive,
    matchedNegative,
    totalPositive: pos.length,
    totalNegative: neg.length,
  }
}

/** تكلفة تعقيد المركب — من حجم الخطة لا من محتواها (البند 5) */
export function compositeBurden(entity: RecommendationEntity): number {
  if (entity.entity_type !== 'composite') return 0
  const coursesTerm = BURDEN_PER_COURSE * Math.max(0, entity.required_courses.length - 1)
  const hoursTerm = BURDEN_PER_HOUR_OVER_24 * Math.max(0, entity.estimated_hours - 24)
  const domainsTerm = BURDEN_PER_CORE_DOMAIN * Math.max(0, entity.domains.length - 1)
  return Math.round((coursesTerm + hoursTerm + domainsTerm) * 1000) / 1000
}

export function scoreEntity(entity: RecommendationEntity, facts: FactBag, ctx: DecisionContext): EntityCandidate {
  const skills = assessEntitySkills(entity, ctx.skillStates, ctx.familyRatings ?? {})
  const activeDomains = activeDomainsOf(facts, ctx.domains)
  const needDomainMatch = entity.domains.some((d) => activeDomains.includes(d))

  const persona = scorePersonaComponent(entity, facts, ctx)
  const goal = scoreGoalComponent(entity, facts, needDomainMatch)
  const domain = scoreDomainComponent(entity, facts, ctx)
  const feasibility = scoreFeasibilityComponent(entity, facts)
  const motivation = scoreMotivationComponent(facts)

  /* وزن فجوة المهارات يتدرج مع تغطية القياس؛ الباقي يُعاد توزيعه — المجهول لا يعاقب ولا يكافئ */
  const skillWeight = W.skillGap * skills.measuredCoverage
  const redistributed = (W.skillGap - skillWeight) / 2
  const skillComponent = skills.gapScore ?? 0
  /* والجدوى الزمنية بالقاعدة نفسها — لا تُقاس بعد تقاعد سؤال الوقت */
  const feasibilityWeight = feasibility.measured ? W.feasibility : 0
  const feasibilityRedistributed = (W.feasibility - feasibilityWeight) / 2

  let fit =
    persona.score * (W.persona + redistributed + feasibilityRedistributed) +
    goal.score * (W.goal + redistributed + feasibilityRedistributed) +
    domain.score * W.domain +
    skillComponent * skillWeight +
    feasibility.score * feasibilityWeight +
    motivation.score * W.motivation

  const reasons_ar = [persona.reason, goal.reason, domain.reason, feasibility.reason, motivation.reason].filter(
    (r): r is string => Boolean(r),
  )

  /* مُفاضلة الاحتياج المعلن (المرحلة 4): need_id المستخدم ضمن احتياجات الكيان المعلنة */
  const needId = facts['need_id']?.value
  const needDirect = typeof needId === 'string' && entity.needs.includes(needId)
  if (needDirect) {
    fit += NEED_DIRECT_BONUS
    reasons_ar.push('احتياجك المعلن هو بالضبط ما صُمم لهذا الكيان — ليس مجرد تقاطع مجال.')
  }

  /* مُفاضلة محاذاة الوظيفة: تطابق/تناقض function_specialization مع وظائف الكيان المعلنة
     (للقياسي من بروفايله، وللمركب اتحاد وظائف مساراته الممثلة).
     التناقض يُحسب بمستوى المجال لا الرمز: وظيفة من نفس أسرة مجالات الكيان (مشتريات ⊂ عمليات)
     ليست تناقضًا — محايدة؛ التناقض الحقيقي = وظيفة خارج مجالات الكيان كلها */
  const fnFact = facts['function_specialization']?.value
  const fnList = Array.isArray(fnFact) ? (fnFact as string[]) : typeof fnFact === 'string' ? [fnFact] : []
  if (entity.functions.length > 0 && fnList.length > 0) {
    if (fnList.some((f) => entity.functions.includes(f))) {
      fit += FUNCTION_ALIGN_WEIGHT
      reasons_ar.push('وظيفتك الحالية من الوظائف التي صُمم لها هذا الكيان.')
    } else {
      const fnDomains = fnList.flatMap((f) => functionDomainsV2[f] ?? [])
      const sameFamily = fnDomains.some((d) => entity.domains.includes(d) || entity.extended_domains.includes(d))
      if (!sameFamily) fit -= FUNCTION_ALIGN_WEIGHT
    }
  }

  /* مُفاضلة السياق القيادي (قياسي فقط): leadership_fit المعلن مقابل leadership_context المقيس */
  const leadCtx = facts['leadership_context']?.value
  if (entity.entity_type === 'standard' && entity.leadership_context.length > 0 && typeof leadCtx === 'string') {
    if (entity.leadership_context.includes(leadCtx)) {
      fit += LEADERSHIP_ALIGN_WEIGHT
      reasons_ar.push('سياقك القيادي الحالي هو ما صُمم لهذا المسار بالضبط.')
    } else {
      fit -= LEADERSHIP_ALIGN_WEIGHT
    }
  }

  /* مُفاضلة دليل الإشارات (مركب فقط): إشارات القالب الموجبة والسالبة تُوزن فتدخل الملاءمة */
  let signals: SignalEvidence | undefined
  if (entity.entity_type === 'composite') {
    signals = compositeSignalEvidence(entity, facts, ctx.skillStates)
    fit += signals.adjustment
  }

  fit = Math.round(fit * 1000) / 1000
  if (skills.gapSkillSlugs.length > 0) reasons_ar.push(`لديك فجوة مقيسة في ${skills.gapSkillSlugs.length} من مهاراته الأساسية.`)

  const burden = compositeBurden(entity)

  return {
    entity,
    fit,
    burden,
    netFit: Math.round((fit - burden) * 1000) / 1000,
    skills,
    signals,
    reasons_ar,
    breakdown: {
      persona: persona.score,
      goal: goal.score,
      domain: domain.score,
      skillGap: skills.gapScore,
      feasibility: feasibility.score,
      motivation: motivation.score,
    },
  }
}

/* ─── شروط فوز المركب — incremental value over best standard (البند 4) ─── */
export interface CompositeVictory {
  passes: boolean
  multiDomainNeed: boolean
  coversGapBeyondBestStandard: boolean
  exceedsThreshold: boolean
  factCoverage: number
  thresholdUsed: number
  reasons_ar: string[]
}

/* عدّ عربي سليم في نص يقرؤه المتعلم: «مجال واحد» و«مجالين» لا «2 مجالات».
   المثنى في العربية صيغة مستقلة، وكتابته جمعا يقرأ كخطأ آلة لا كجملة كُتبت له. */
function countAr(n: number, one: string, two: string, many: string): string {
  if (n === 1) return `${one} واحد`
  if (n === 2) return two
  if (n <= 10) return `${n} ${many}`
  return `${n} ${one}`
}

export function compositeVictoryCheck(
  composite: EntityCandidate,
  bestStandard: EntityCandidate | undefined,
  facts: FactBag,
  ctx: DecisionContext,
): CompositeVictory {
  const reasons: string[] = []
  const entity = composite.entity

  /* تغطية الحقائق المطلوبة القابلة للإنتاج (البند: Evidence Availability).
     إصلاح أسلاك موثق: المهارة المقيسة بسؤال M4 تُحتسب حقيقة مغطاة — دليلها يعيش في
     مخزن المهارات (skillStates) لا في حقيبة الحقائق، وتعريف «القابلية للإنتاج» في
     التدقيق (b2cProducibleFacts) يشمل measures أسئلة المهارات أصلًا. بلا هذا الحسبان
     تفشل كل خطة مركبة تتطلب دليلًا مهاريًا مهما سُئلت أسئلته. */
  const producibleRequired = entity.required_facts.filter((rf) => rf.importance !== 'optional')
  const isCovered = (key: string) =>
    facts[key] !== undefined || ctx.skillStates.get(key)?.state === 'measured'
  const missing = producibleRequired.filter((rf) => !isCovered(rf.fact_key))
  const factCoverage = producibleRequired.length === 0 ? 1 : 1 - missing.length / producibleRequired.length

  /* ١) حاجة متعددة المجالات حقيقية — مجالان نشطان من مجالاته الجوهرية على الأقل.
     تُقرأ المجالات بمستوى البوابة (قوة موزونة + تصريح وظيفة/ميول مباشر) لا بعتبة التسجيل */
  const activeDomains = gateDomainsOf(facts, ctx.domains)
  const coveredByComposite = entity.domains.filter((d) => activeDomains.includes(d))
  const multiDomainNeed = coveredByComposite.length >= 2

  /* ٢) أفضل قياسي يترك فجوة مجال مرتبطة بحاجة المستخدم */
  const bestStandardDomains = bestStandard?.entity.domains ?? []
  const gapDomains = coveredByComposite.filter((d) => !bestStandardDomains.includes(d))
  const coversGap = gapDomains.length > 0

  /* ٣) القيمة الإضافية = ميزة الملاءمة الخام بعد البوابات البنيوية (البند 4).
       تكلفة التعقيد لا تدخل هذه المقارنة — هي تخصم في الترتيب الصافي netFit ويظهر
       أثرها في مكوّن الفصل بالثقة: فوز مركب متقارب يُعلَّم تلقائيًا لمراجعة مستشار.
       الإجابة الصريحة «منظومة مترابطة» تخفض العتبة — تفضيل موثق يغيّر النتيجة (البند 12) */
  const masteryPref = facts['mastery_portfolio_pref']?.value as string | undefined
  const threshold = masteryPref === 'skill_set' ? INCREMENT_THRESHOLD_PORTFOLIO_PREF : INCREMENT_THRESHOLD
  const exceeds = bestStandard ? composite.fit > bestStandard.netFit + threshold : composite.fit > threshold

  const passes =
    factCoverage >= entity.minimum_evidence.fact_coverage &&
    multiDomainNeed &&
    coversGap &&
    exceeds &&
    masteryPref !== 'master_one'

  if (!multiDomainNeed) reasons.push('حاجتك أحادية المجال — الأبسط الكافي يفوز.')
  if (multiDomainNeed && !coversGap) reasons.push('أفضل مسار قياسي يغطي مجالات حاجتك كاملة — لا قيمة تركيبية.')
  if (multiDomainNeed && coversGap && !exceeds) {
    reasons.push(`ميزة الملاءمة فوق أفضل مسار قياسي دون العتبة (${Math.round(threshold * 100)}٪) — التعادل يحسمه الأبسط الكافي.`)
  }
  if (factCoverage < entity.minimum_evidence.fact_coverage) reasons.push('حقائق مطلوبة لم تُجمع بعد بما يكفي للحسم.')
  if (masteryPref === 'master_one') reasons.push('اخترت صراحة إتقان مهارة واحدة — المركب مستبعد بقرارك.')
  if (passes) {
    reasons.push(
      `حاجتك تمتد إلى ${countAr(coveredByComposite.length, 'مجال', 'مجالين', 'مجالات')}، وأفضل مسار جاهز واحد يترك «${domainLabelAr(gapDomains[0])}» خارج خطتك — فركّبنا لك خطة تغطيها معا.`,
    )
  }

  return { passes, multiDomainNeed, coversGapBeyondBestStandard: coversGap, exceedsThreshold: exceeds, factCoverage, thresholdUsed: threshold, reasons_ar: reasons }
}

/* ─── الفصل بالمهارات — decisive_unmeasured_skills (البند 11) ───
   الأولوية لقيمة الفصل بين المرشحين، لا لامتلاك المتصدر المهارة:
   Top Candidates → find discriminating evidence → measure → rescore all. */
export interface DecisiveSkill {
  slug: string
  /** عدد مرشحي الصدارة الذين يتطلبونها */
  requiredByTop: number[]
  /** قيمة الفصل: عالية إذا فرّقت بين المتصدرين، متوسطة داخل أول 3 */
  separationValue: number
  measured: boolean
}

export function decisiveSkills(candidates: EntityCandidate[], skillStates: Map<string, SkillState>): DecisiveSkill[] {
  const top = candidates.slice(0, 3)
  if (top.length < 2) return []
  const reqSets = top.map((c) => new Set(c.entity.skill_slugs))
  const all = new Set<string>()
  reqSets.forEach((s) => s.forEach((x) => all.add(x)))
  const out: DecisiveSkill[] = []
  for (const slug of all) {
    const requiredBy = top.map((_, i) => (reqSets[i].has(slug) ? i : -1)).filter((i) => i >= 0)
    if (requiredBy.length === 0 || requiredBy.length === top.length) continue // مشتركة بين الجميع = لا فصل
    const measured = skillStates.get(slug)?.state === 'measured'
    /* يفرّق المتصدر عن الثاني = 1 ؛ يفرّق داخل أول 3 = 0.6 */
    const separatesTop2 = reqSets[0].has(slug) !== reqSets[1].has(slug)
    out.push({ slug, requiredByTop: requiredBy, separationValue: separatesTop2 ? 1 : 0.6, measured })
  }
  return out.sort((a, b) => b.separationValue - a.separationValue || a.slug.localeCompare(b.slug))
}

/* ─── وضع الاستكشاف (البند 10) ─── */
export interface ExplorationDecision {
  exploratory: boolean
  /** قائمة المجالات المختصرة من إشارات الميول/الاحتياج */
  domainShortlist: DomainId[]
  reasons_ar: string[]
}

export function explorationDecision(facts: FactBag, ctx: DecisionContext, topFit: number | null): ExplorationDecision {
  const goal = facts['primary_goal']?.value as string | undefined
  const needCode = facts['need_id']?.value as string | undefined
  const unsure = goal === 'explore' || needCode === 'need_unsure'
  if (!unsure) return { exploratory: false, domainShortlist: [], reasons_ar: [] }

  const activeDomains = activeDomainsOf(facts, ctx.domains)
  /* أدلة كافية = مجال واضح الثقة أو ميول صريحة + كيان يتجاوز حد الملاءمة */
  const domainClear = ctx.domains.confidence >= DOMAIN_CONFIDENCE_MIN
  const hasInterestSignal = activeDomains.length > 0
  const fitSufficient = topFit !== null && topFit >= EXPLORATION_FIT_FLOOR

  if ((domainClear || hasInterestSignal) && fitSufficient) {
    return { exploratory: false, domainShortlist: activeDomains, reasons_ar: ['رغم عدم حسمك، أشارت إجاباتك إلى مجال وكيان كافٍ — التوصية مبنية على دليل لا على افتراض.'] }
  }
  return {
    exploratory: true,
    domainShortlist: activeDomains.slice(0, 3),
    reasons_ar: [
      'هدفك واحتياجك غير محسومين، والأدلة المجمعة لا تكفي لفرض مسار نهائي بمسؤولية.',
      'نعرض اتجاهات استكشافية قصيرة بدل ترشيح مُقنَّع — لا أحد يفوز بلا دليل.',
    ],
  }
}

/* ─── نقطة الدخول الموحدة للمنافسة ─── */
export interface CompetitionResult {
  eligibility: EntityEligibility[]
  candidates: EntityCandidate[]
  bestStandard: EntityCandidate | null
  /** أفضل مركب يجتاز البوابتين البنيويتين (تعدد مجالات مُثبت + تغطية فجوة) — المتحدي الشرعي الوحيد */
  bestComposite: EntityCandidate | null
  /** أعلى مركب صافٍ بغض النظر عن البوابات — للتدقيق والتتبع فقط */
  topComposite: EntityCandidate | null
  compositeVictory: CompositeVictory | null
  exploration: ExplorationDecision
  catalogGap: boolean
}

export function competeEntities(facts: FactBag, ctx: DecisionContext): CompetitionResult {
  const universe = recommendationUniverse()
  const eligibility = universe.entities.map((e) => assessEntityEligibility(e, facts, ctx))
  const eligibleIds = new Set(eligibility.filter((e) => e.eligible).map((e) => e.entityId))
  const candidates = universe.entities
    .filter((e) => eligibleIds.has(e.entity_id))
    .map((e) => scoreEntity(e, facts, ctx))
    .sort((a, b) => b.netFit - a.netFit || a.entity.entity_id.localeCompare(b.entity.entity_id))

  const bestStandard = candidates.find((c) => c.entity.entity_type === 'standard') ?? null
  const compositeCandidates = candidates.filter((c) => c.entity.entity_type === 'composite')
  const topComposite = compositeCandidates[0] ?? null

  /* المتحدي المركب الشرعي: يجتاز البوابتين البنيويتين أولًا — حاجة متعددة المجالات مُثبتة
     + يغطي مجالًا نشطًا يتركه أفضل قياسي (البند 4). لا يكفي أن يكون الأعلى صافًا.
     المجالات بمستوى البوابة: قوة موزونة + تصريح وظيفة مباشر (المرحلة 4) */
  const activeDomains = gateDomainsOf(facts, ctx.domains)
  const bestStandardDomains = bestStandard?.entity.domains ?? []
  const bestComposite =
    compositeCandidates.find((c) => {
      const covered = c.entity.domains.filter((d) => activeDomains.includes(d))
      return covered.length >= 2 && covered.some((d) => !bestStandardDomains.includes(d))
    }) ?? null
  const compositeVictory = bestComposite ? compositeVictoryCheck(bestComposite, bestStandard ?? undefined, facts, ctx) : null

  /* الفائز الفعلي: مركب يستوفي الشروط، وإلا أفضل قياسي */
  const effectiveTop = compositeVictory?.passes ? bestComposite : bestStandard
  const exploration = explorationDecision(facts, ctx, effectiveTop?.netFit ?? null)

  /* فجوة كتالوج: هدف/احتياج حقيقي ولا كيان مؤهلًا بملاءمة ذات معنى (البند 15) */
  const goalOrNeedReal = facts['primary_goal'] !== undefined || facts['need_id'] !== undefined
  const catalogGap = goalOrNeedReal && (candidates.length === 0 || (effectiveTop?.netFit ?? 0) < CATALOG_GAP_FIT_FLOOR)

  return { eligibility, candidates, bestStandard, bestComposite, topComposite, compositeVictory, exploration, catalogGap }
}

/** مرشح advisor_handoff منطبق على الكيان الفائز — لا يستبعده من المنافسة لكنه يُحيل التوصية لمستشار */
export function appliedHandoffFilter(entity: RecommendationEntity, facts: FactBag): { filterId: string; rationale_ar: string } | null {
  for (const h of entity.hard_exclusions) {
    if (h.action !== 'advisor_handoff') continue
    if (evalCondition(h.condition.operator, facts[h.condition.fact_key], h.condition.values)) {
      return { filterId: h.id, rationale_ar: h.rationale_ar }
    }
  }
  return null
}
