/* أوزان وعتبات المحرك — من engine-defaults.v1.json وcomposite-engine-defaults.v1.json
   مضمنة هنا لتكون واضحة قابلة للمراجعة. أي تغيير يجب أن يمر على التدقيق. */

export const UTILITY_WEIGHTS = {
  decisionImpact: 0.3,
  uncertaintyReduction: 0.2,
  tieBreakPower: 0.15,
  contradictionResolution: 0.15,
  requiredCoverage: 0.1,
  riskReduction: 0.1,
  answerCost: -0.12,
  sensitivity: -0.1,
  redundancy: -0.18,
} as const

export const FIT_WEIGHTS = {
  persona: 0.2,
  goal: 0.25,
  skillGap: 0.3,
  feasibility: 0.15,
  motivation: 0.1,
} as const

export const CONFIDENCE_WEIGHTS = {
  coverage: 0.3,
  consistency: 0.25,
  separation: 0.2,
  evidenceQuality: 0.15,
  stability: 0.1,
} as const

export const STOP_RULES = {
  quickTargetMin: 8,
  quickTargetMax: 14,
  hardCapQuick: 18,
  hardCapDeep: 35,
  minTopFit: 0.7,
  minSeparation: 0.1,
  minConfidence: 0.8,
  minUsefulUtility: 0.18,
} as const

export const CONFIDENCE_BANDS = [
  { min: 0.8, band: 'strong', band_ar: 'قوية' },
  { min: 0.65, band: 'good', band_ar: 'جيدة' },
  { min: 0.5, band: 'preliminary', band_ar: 'أولية' },
  { min: 0, band: 'advisor_referral', band_ar: 'تحتاج مراجعة مستشار' },
] as const

export const TEMPLATE_WEIGHTS = {
  persona_match: 0.15,
  goal_match: 0.25,
  context_stage_match: 0.15,
  cross_path_skill_gap_match: 0.2,
  feasibility_match: 0.15,
  application_readiness: 0.1,
} as const

export const TEMPLATE_THRESHOLDS = {
  minimum_template_fit: 0.72,
  strong_template_fit: 0.82,
  minimum_evidence_confidence: 0.75,
  top_two_margin: 0.08,
  minimum_required_fact_coverage: 0.8,
  maximum_missing_required_facts: 1,
  /** تفعيل طبقة القوالب: مساران أساسيان يتجاوزان هذا الحد */
  dual_pathway_activation_fit: 0.65,
  max_conditional_courses_full: 2,
  max_conditional_courses_extended: 3,
  max_plan_hours: 80,
} as const

export const TRAINER_WEIGHTS = {
  skillCoverage: 0.35,
  levelPersona: 0.2,
  formatLanguage: 0.15,
  availability: 0.15,
  quality: 0.1,
  continuity: 0.05,
} as const

/** ترتيب عتادي للأحمال الأسبوعية */
export const WEEKLY_LOAD_ORDER: Record<string, number> = {
  lt_3: 1,
  '3_4': 2,
  '5_6': 3,
  '7_plus': 4,
}

/** إصدارات القرار — تُخزن مع كل جلسة ونتيجة لضمان قابلية المراجعة والتدقيق */
export const CATALOG_VERSION = 'core-catalog.v2'
export const RULES_VERSION = 'diagnostic-rules.v1'
export const DECISION_VERSION = 'decision-engine.2.0.0'

export const DISCLAIMER_AR =
  'هذا التشخيص تعليمي مهني مبني على إجاباتك، وليس تشخيصا نفسيا أو طبيا، ولا وعدا بوظيفة أو دخل.'

/** الحقائق الأساسية المطلوب تغطيتها قبل توصية عالية الثقة */
export const REQUIRED_CORE_FACTS = [
  'persona_type',
  'primary_goal',
  'goal_clarity',
  'weekly_load',
] as const
