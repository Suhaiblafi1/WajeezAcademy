/* عقود محرك التشخيص التكيفي v1 — أنواع مشتركة لكل الطبقات.
   حتمي بالكامل: لا LLM ولا عشوائية في أي قرار. */

export type AnswerType =
  | 'single_choice'
  | 'multi_choice'
  | 'likert_5'
  | 'skill_level_5'
  | 'rank_top3'
  | 'short_text'
  | 'single_choice_or_text'

export type SensitivityLevel = 'low' | 'medium' | 'high'
export type RequiredLevel = 'core' | 'deep'

export interface BankQuestion {
  question_id: string
  module_id: string
  module_name?: string
  text_ar: string
  answer_type: AnswerType
  options_ar: string[]
  options_key: string | null
  persona_scope: string[]
  trigger_condition: string
  measures: string[]
  decision_impact: string
  sensitivity_level: SensitivityLevel
  required_level: RequiredLevel
  weight: number
  active: boolean
}

export interface SkillEntry {
  skill_id: string
  slug: string
  name_ar?: string
  family_id?: string
}

export interface CatalogCourse {
  course_id: string
  pathway_id: string
  sequence: number
  title_ar: string
  subtitle_ar?: string
  level_ar?: string
  total_hours: number
  skill_slugs: string[]
  skill_ids: string[]
  skill_names_ar: string[]
}

export interface CatalogPathway {
  id: string
  title: string
  short_title?: string
  audience: string
  not_for?: string
  entry?: string
  before: string
  after: string
  duration_weeks: number
  weekly_hours: string
  level: string
  delivery?: string
  capstone: string
  outcome_metric?: string
  course_ids: string[]
  total_hours?: number
}

export interface PathwayProfile {
  personas: string[]
  goals: string[]
  sectors: string[]
  functions: string[]
  min_weekly_load?: string
  goal_clarity_fit?: string[]
  leadership_fit?: string[]
  public_facing_fit?: string[]
  business_stages?: string[]
  notes_ar?: string
}

/** قيمة حقيقة مسجلة مع مصدرها وجودة دليلها */
export interface FactValue {
  value: string | string[] | number
  sourceQuestionId: string
  evidenceQuality: number // 0..1
  raw?: string
}

export type FactBag = Record<string, FactValue>

export interface Answer {
  questionId: string
  /** نص الخيار المختار، أو قائمة للخيارات المتعددة/الترتيب، أو النص الحر */
  value: string | string[]
}

export interface Contradiction {
  id: string
  factKeys: string[]
  detail_ar: string
  severity: 'low' | 'medium' | 'high'
  resolved: boolean
}

export interface FitBreakdown {
  persona: number
  goal: number
  skillGap: number
  feasibility: number
  motivation: number
  total: number
  reasons_ar: string[]
}

export interface PathwayCandidate {
  pathwayId: string
  fit: FitBreakdown
  /** مهارات المسار التي يحتاجها المتعلم فعلا (فجوة) */
  gapSkillSlugs: string[]
  /** مهارات المسار المتقنة سلفا */
  masteredSkillSlugs: string[]
}

export interface ConfidenceBreakdown {
  coverage: number
  consistency: number
  separation: number
  evidenceQuality: number
  stability: number
  total: number
  band: 'strong' | 'good' | 'preliminary' | 'advisor_referral'
  band_ar: string
}

export interface QuestionUtilityBreakdown {
  decisionImpact: number
  uncertaintyReduction: number
  tieBreakPower: number
  contradictionResolution: number
  requiredCoverage: number
  riskReduction: number
  answerCost: number
  sensitivity: number
  redundancy: number
  total: number
}

export interface UtilityScore {
  questionId: string
  utility: QuestionUtilityBreakdown
}

export interface DecisionTraceEntry {
  step: number
  kind: 'question_selected' | 'answer_reduced' | 'candidates_scored' | 'stop_evaluated' | 'recommendation' | 'template_selected' | 'contradiction' | 'guardrail'
  summary_ar: string
  data?: Record<string, unknown>
}

export interface StopDecision {
  shouldStop: boolean
  reason_ar: string
  askedCount: number
}

export interface CoursePlanItem {
  courseId: string
  titleAr: string
  hours: number
  sequence: number
  type: 'required' | 'conditional' | 'bridge'
  reason_ar: string
}

export type PlanVariant = 'starter' | 'full' | 'extended'

export interface CompositeSelection {
  templateId: string
  nameAr: string
  fit: number
  variant: PlanVariant
  courses: CoursePlanItem[]
  missingRequiredFacts: string[]
  rationale_ar: string[]
}

export interface TrainerProfile {
  trainer_id: string
  name_ar: string
  skill_slugs: string[]
  personas: string[]
  formats: string[]
  languages: string[]
  availability_weekly_hours: number
  quality_score: number
  verified_source?: string
}

export interface TrainerMatch {
  status: 'assigned' | 'unassigned'
  trainerId?: string
  nameAr?: string
  score?: number
  note_ar: string
}

export interface Recommendation {
  kind: 'single_pathway' | 'composite_template' | 'advisor_referral' | 'guardrail_stop'
  primaryPathway: PathwayCandidate | null
  alternatives: PathwayCandidate[]
  composite: CompositeSelection | null
  confidence: ConfidenceBreakdown
  reasons_ar: string[]
  unavailable_skills: { skill: string; note_ar: string }[]
  change_makers_ar: string[]
  trainer: TrainerMatch
  disclaimer_ar: string
  trace: DecisionTraceEntry[]
}

export interface DiagnosticState {
  sessionId: string
  startedAt: string
  answers: Answer[]
  askedQuestionIds: string[]
  facts: FactBag
  factsRaw: Record<string, string>
  skillVector: Record<string, number>
  interestVector: Record<string, number>
  contradictions: Contradiction[]
  consentGiven: boolean
  minorFlag: boolean
  guardrailStop: string | null
  trace: DecisionTraceEntry[]
}

export interface NextQuestionResult {
  question: BankQuestion | null
  utility: QuestionUtilityBreakdown | null
  stop: StopDecision
}
