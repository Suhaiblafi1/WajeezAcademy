/* عقود منظومة التشخيص V2 — نظام قرار لا استبيان درجات.
   الرحلة: Persona → Goal → Domain → Evidence → Skills → Eligible Tracks.
   حتمي بالكامل: لا LLM ولا عشوائية غير مزروعة في أي قرار. */

import type { BankQuestion, FactBag } from '../types'

/* ─── الشخصيات الدقيقة ─── */
export type PersonaKey =
  | 'school_student'
  | 'university_student'
  | 'graduate'
  | 'job_seeker'
  | 'junior_employee'
  | 'experienced_employee'
  | 'new_manager'
  | 'leader'
  | 'gov_employee'
  | 'gov_manager'
  | 'founder_idea'
  | 'founder_operating'
  | 'freelancer'
  | 'ld_professional'
  | 'parent_guardian'
  | 'personal_development'
  | 'unsure_explorer'
  | 'b2b_sponsor'
  | 'b2g_sponsor'
  | 'unknown'

export interface PersonaResult {
  key: PersonaKey
  /** 0..1 — كم دليلًا يدعم هذا التصنيف */
  confidence: number
  /** الحقائق التي بُني عليها التصنيف — للتفسير */
  evidence: string[]
  /** هل المتعلم قاصر (منطق أمان خاص) */
  isMinor: boolean
}

/* ─── المجالات ─── */
export type DomainId =
  | 'career_direction'
  | 'employment_readiness'
  | 'ai_productivity'
  | 'data_decision'
  | 'project_management'
  | 'people_leadership'
  | 'gov_services'
  | 'entrepreneurship'
  | 'marketing_growth'
  | 'sales'
  | 'finance_mgmt'
  | 'product_mgmt'
  | 'operations'
  | 'cyber_risk'
  | 'communication_influence'
  | 'learning_design'
  | 'family_parenting'
  | 'personal_development'

export interface DomainAssessment {
  scores: Partial<Record<DomainId, number>>
  ranked: DomainId[]
  top: DomainId | null
  /** 0..1 — وضوح المجال المتصدر (1 = مجال واحد بلا منازع) */
  confidence: number
  /** مجالان متصدران متقاربان يحتاجان سؤالًا فاصلًا */
  contested: [DomainId, DomainId] | null
}

/* ─── المهارات — لا قيمة افتراضية للمجهول أبدًا ─── */
export type SkillLayer =
  | 'diagnostic'
  | 'pathway_requirement'
  | 'learning_outcome'
  | 'personalization_signal'
  | 'context_signal'

export interface SkillState {
  slug: string
  /** unknown = غير مقاسة: لا ترفع ولا تخفض ولا فجوة ولا تفسير */
  state: 'measured' | 'unknown'
  level?: number
  sourceQuestionId?: string
}

/* ─── ميتا السؤال (طبقة V2 فوق البنك) ─── */
export type QuestionLayer = 'core' | 'adaptive' | 'deepening' | 'verification' | 'institutional' | 'retire_candidate'
export type QuestionPhase = 'core' | 'adaptive' | 'confirmation' | 'deep_only'
export type DecisionImpact = 'fact' | 'skill_evidence' | 'separation' | 'personalization' | 'safety' | 'verification' | 'none'

export interface QuestionMetaV2 {
  layer: QuestionLayer
  phase: QuestionPhase
  allowed_personas: PersonaKey[] | 'all'
  excluded_personas: PersonaKey[]
  domains: DomainId[]
  decision_impact: DecisionImpact
  measures: string[]
  reason_ar?: string
}

/* ─── أهلية المسار الصارمة ─── */
export interface PathwayEligibility {
  pathwayId: string
  eligible: boolean
  /** أسباب الاستبعاد الصارم — تظهر في التدقيق والتفسير */
  excludedReasons_ar: string[]
}

/* ─── مرشح مسار V2 ─── */
export interface V2Candidate {
  pathwayId: string
  total: number
  /** تغطية المهارات المقاسة من متطلبات المسار: measuredRequired/required — 0 إن لم يقس شيء */
  measuredSkillCoverage: number
  /** المقيسُ ممّا **يستطيع البنكُ قياسَه** من مهارات المسار — سقفُها المئة.
      عليها وحدَها يُعاير مانعُ «التطابق القويّ»: قياسٌ بمسطرةٍ نملكها. */
  measurableSkillCoverage: number
  /** هل بين المقيس مهارةٌ **مقيسةٌ مباشرةً** لا مستدَلّةٌ من عائلتها؟
      شرطُ فتح الدرجة العليا: الترجيحُ يرفع التغطية ولا يفتح ادّعاءَ المعرفة. */
  hasDirectSkillEvidence: boolean
  /** كم مهارةً من مهارات المسار يملك البنكُ سؤالا يقيسها */
  measurableRequiredCount: number
  /** وكم منها قِيست مباشرةً فعلا */
  measurableMeasuredCount: number
  /** مهارات مقاسة دون المستوى المستهدف — مقاسة فقط، لا مفترضة */
  gapSkillSlugs: string[]
  masteredSkillSlugs: string[]
  /** مهارات متطلبة غير مقاسة — تُعرض كمجهولة صراحة */
  unknownSkillSlugs: string[]
  reasons_ar: string[]
  breakdown: {
    persona: number
    goal: number
    domain: number
    skillGap: number | null // null = لا مهارات مقاسة — لا يدخل الحساب
    feasibility: number
    motivation: number
  }
}

/* ─── الثقة المركبة (٨ مكونات) ─── */
export interface ConfidenceV2 {
  persona: number
  goal: number
  domain: number
  skillEvidenceCoverage: number
  trackFit: number
  separation: number
  consistency: number
  evidenceQuality: number
  overall: number
  /** مخرجات صادقة — لا اختلاق دقة */
  outputKind: 'strong_match' | 'best_current_match' | 'exploratory_direction' | 'advisor_review'
  outputKind_ar: string
  /** لماذا لم تكن التوصية قوية — للتفسير */
  strongBlockers_ar: string[]
  /** أساسُ الدرجة رقما: كم مهارةً قِيست من كم يمكن قياسُها، وكم بقي مجهولا.
      العبارةُ قد يُهمَل قيدُها؛ والرقمُ لا يُهمَل. */
  evidenceBasis: { measured: number; measurable: number; unknown: number }
}

/* ─── التفسير الكامل ─── */
export interface V2Explanation {
  persona_key: PersonaKey
  persona_label_ar: string
  /** ما فهمناه — ٣ إلى ٥ حقائق بلغة المتعلم */
  understood_facts_ar: string[]
  domain_top: DomainId | null
  domain_label_ar: string | null
  domain_reason_ar: string
  pathway_reasons_ar: string[]
  measured_skills: { slug: string; name_ar: string; level: number }[]
  unknown_skills: { slug: string; name_ar: string }[]
  not_known_ar: string[]
  why_not_second_ar: string | null
  change_makers_ar: string[]
  confidence_human_ar: string
  output_kind: ConfidenceV2['outputKind']
  catalog_gap_ar: string | null
  personalization_notes_ar: string[]
}

/* ─── تسليم المستشار ─── */
export interface AdvisorHandoff {
  persona: PersonaResult
  goal: { code: string | null; clarity: string | null }
  domains: DomainAssessment
  measuredSkills: { slug: string; level: number }[]
  unknowns_ar: string[]
  topCandidates: { pathwayId: string; total: number }[]
  rejectedWithReasons: { pathwayId: string; reasons_ar: string[] }[]
  confidence: ConfidenceV2
  contradictions: { id: string; severity: string; resolved: boolean }[]
  remainingEngineQuestions_ar: string[]
  answersCount: number
}

/* سؤال مع خيارات مفلترة حسب الشخصية — option_ids تحفظ هوية الخيار الأصلية */
export type V2Question = BankQuestion & { active_option_ids?: string[] }

/* سياق قرار محرك V2 — يُشتق من الحالة في كل خطوة (حتمي) */
export interface DecisionContext {
  facts: FactBag
  persona: PersonaResult
  domains: DomainAssessment
  skillStates: Map<string, SkillState>
  /** تقييمُ المتعلّم لعائلات مهاراته — ترجيحٌ يُستدَلّ منه مستوى، لا قياس.

      كان يصل إلى **موضعٍ واحدٍ**: تركيبُ قائمة الدورات. فيُقيّم المتعلّمُ
      عائلاتِه فتتغيّر القائمةُ المعروضة، **ولا يتغيّر الترتيبُ ولا التغطيةُ
      ولا الثقة** — وأُثبت ذلك بثمانِ مئةِ جلسةٍ بتقييمٍ كامل: معدّلُ المانع
      بقي مئةً بالمئة. فصار في السياق ليبلغ حيث يُقرَّر. */
  familyRatings?: Record<string, number>
}
