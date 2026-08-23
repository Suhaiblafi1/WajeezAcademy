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
  /** V2 فقط: معرفات الخيارات الأصلية الموازية لـ options_ar بعد فلترة الشخصية —
      يحفظ هوية الخيار (o1..on) حين تُحذف خيارات لا تناسب مرحلة المتعلم */
  active_option_ids?: string[]
}

export interface SkillEntry {
  skill_id: string
  slug: string
  name_ar?: string
  family_id?: string
  /** اسم العائلة العربي — تُسأل به عائلات المهارات في الواجهة */
  family_ar?: string
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
  /** معرفات الخيارات الثابتة (o1..on) — أساس القرار. النص العربي لعرض وتدقيق فقط */
  optionIds?: string[]
  /** نص الخيار المختار (خام، للعرض والتدقيق)، أو قائمة للخيارات المتعددة/الترتيب، أو النص الحر */
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
  kind: 'question_selected' | 'answer_reduced' | 'candidates_scored' | 'stop_evaluated' | 'recommendation' | 'template_selected' | 'template_layer' | 'trainer_match' | 'contradiction' | 'guardrail' | 'facts_seeded' | 'deepening_started' | 'deepening_completed' | 'consent_ui_ack'
  summary_ar: string
  data?: Record<string, unknown>
}

/* ─────────── جولة تدقيق الخطة (التشخيص الإضافي الاختياري) ─────────── */

/** لقطة التوصية قبل/بعد التدقيق — للمقارنة الموثقة */
export interface DeepeningSnapshot {
  kind: Recommendation['kind']
  /** معرف المسار الأول أو القالب المركب */
  topId: string | null
  topLabel_ar: string
  confidenceTotal: number
  confidenceBand: ConfidenceBreakdown['band']
  confidenceBand_ar: string
}

/** سؤال مخطط في جولة التدقيق — مع سبب اختياره وأثر إجابته */
export interface DeepeningPlanItem {
  questionId: string
  /** مناطق عدم اليقين التي يعالجها: tie | weak_skill | missing_constraint | goal_unclear | contradiction | coverage */
  targets: string[]
  /** لماذا اختير هذا السؤال وكيف ستؤثر إجابته في التوصية */
  reason_ar: string
}

/** نتيجة المقارنة قبل/بعد التدقيق */
export interface DeepeningComparison {
  before: DeepeningSnapshot
  after: DeepeningSnapshot
  /** هل تغيرت التوصية نفسها (نوعها أو هويتها)؟ */
  changed: boolean
  /** «دعمت إجاباتك الإضافية التوصية الحالية.» أو «ظهرت معلومات إضافية جعلت هذا الاختيار أكثر ملاءمة.» */
  note_ar: string
  /** أسباب التغيير أو عدمه بلغة المتعلم */
  reasons_ar: string[]
  answeredCount: number
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
  /** دورات أُزيلت بدليل إتقان موثق — مع سبب كل إزالة */
  removedCourses: { courseId: string; titleAr: string; reason_ar: string }[]
  /** الدورات المطلوبة وحدها تتجاوز 80 ساعة — تُحال لمستشار ولا تُصدر آليا */
  requiredHoursOverflow: boolean
  missingRequiredFacts: string[]
  rationale_ar: string[]
  /** المسارات الأساسية التي استُمدت منها الخطة */
  representedPathwayIds: string[]
  capstone_ar?: string
  success_metric_ar?: string
  /** أقرب قالب بديل ولماذا لم يُختر */
  nearestAlternative?: { templateId: string; nameAr: string; fit: number; whyNot_ar: string }
  /** مرشح صارم من نوع advisor_handoff انطبق على القالب الفائز — التوصية تُحال لمستشار */
  advisorHandoff?: { filterId: string; rationale_ar: string }
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
  /** التوثيق — شروط إلزامية للترشيح، لا يُرشَّح مدرب غير موثق أبدا */
  verified: boolean
  verified_source?: string
  /** تاريخ التوثيق ISO — صلاحيته 12 شهرا ثم يجب التجديد */
  verified_at?: string
  /** حالة العقد — «active» شرط للترشيح */
  contract_status?: 'active' | 'suspended' | 'ended'
  /** السعة — لا يُرشَّح من بلغ سقف متعلميه */
  capacity_active_learners?: number
  capacity_max_learners?: number
  /** المستويات التي يدرّسها (مبتدئ/متوسط/متقدم...) */
  levels?: string[]
  /** النوافذ الأسبوعية المتاحة — لفحص تعارض المواعيد */
  weekly_schedule?: { day: string; start: string; end: string }[]
}

export interface TrainerMatch {
  status: 'assigned' | 'unassigned'
  trainerId?: string
  nameAr?: string
  score?: number
  note_ar: string
}

export interface Recommendation {
  kind: 'single_pathway' | 'composite_template' | 'advisor_referral' | 'guardrail_stop' | 'exploratory_direction'
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
  /** مخرج الاستكشاف (البند 10): حاضر فقط عندما kind = exploratory_direction — لا كيان نهائي مفروض */
  exploration?: {
    /** قائمة مجالات مختصرة من إشارات المستخدم نفسه */
    domain_shortlist: { id: string; label_ar: string }[]
    evidence_suggestions_ar: string[]
    /** مرشحون داخليون للتدقيق فقط — لا يُعرضون كنتيجة */
    internal_top_candidates: { entity_id: string; entity_type: string; fit: number }[]
  } | null
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
