/* خرائط بنية تشخيص B2C — V2.1 Final Architecture.
   الفصل الجوهري: Career Stage ≠ Employment State ≠ Goal ≠ Need ≠ Domain ≠ Track.
   كل ربط هنا حتمي وموثق — لا LLM ولا ارتجال.
   مصدر الحقيقة الوحيد لهذه الرموز: هذا الملف + question-plan.v2_1.json المولّد منه. */

import type { DomainId, PersonaKey } from '../v2/types'

/* ─── المرحلة المهنية (Career Stage) — منفصلة عن حالة العمل ─── */
export type CareerStage =
  | 'university_student'
  | 'fresh_graduate'
  | 'early_career'
  | 'experienced'
  | 'manager'
  | 'senior_manager'
  | 'founder'
  | 'freelancer'
  | 'trainer_ld'
  | 'other_unsure'

export type EmploymentStateV21 = 'not_working' | 'job_seeking' | 'employed' | 'self_employed' | 'business_owner'

export const CAREER_STAGE_LABELS_AR: Record<CareerStage, string> = {
  university_student: 'طالب جامعي',
  fresh_graduate: 'خريج حديث',
  early_career: 'موظف في بداية مساره',
  experienced: 'موظف ذو خبرة',
  manager: 'مدير / قائد فريق',
  senior_manager: 'مدير أول / تنفيذي',
  founder: 'مؤسس / صاحب عمل',
  freelancer: 'مستقل (عمل حر)',
  trainer_ld: 'مدرب / معلم / مختص تعلم وتطوير',
  other_unsure: 'غير ذلك / غير متأكد',
}

/* المراحل التي تُسأل عن حالة العمل — المؤسس والمستقل تُشتق حالتهما من مرحلتهما */
export const STAGE_NEEDS_EMPLOYMENT_QUESTION: CareerStage[] = [
  'university_student',
  'fresh_graduate',
  'early_career',
  'experienced',
  'manager',
  'senior_manager',
  'trainer_ld',
  'other_unsure',
]

/* مرحلة → رمز شخصية V2 (للأهلية والتفسير) */
export function stageToPersonaKey(stage: CareerStage, facts: { employment_state?: string; business_stage?: string; sector?: string }): PersonaKey {
  switch (stage) {
    case 'university_student':
      return 'university_student'
    case 'fresh_graduate':
      return facts.employment_state === 'job_seeking' || facts.employment_state === 'not_working' ? 'job_seeker' : 'graduate'
    case 'early_career':
      return facts.sector === 'public' ? 'gov_employee' : 'junior_employee'
    case 'experienced':
      return facts.sector === 'public' ? 'gov_employee' : 'experienced_employee'
    case 'manager':
      return facts.sector === 'public' ? 'gov_manager' : 'new_manager'
    case 'senior_manager':
      return facts.sector === 'public' ? 'gov_manager' : 'leader'
    case 'founder':
      return facts.business_stage && !['idea', 'validation', 'pre_revenue'].includes(facts.business_stage)
        ? 'founder_operating'
        : 'founder_idea'
    case 'freelancer':
      return 'freelancer'
    case 'trainer_ld':
      return 'ld_professional'
    case 'other_unsure':
      return 'unsure_explorer'
  }
}

/* ─── الأهداف (Goal ≠ Domain ≠ Track) ─── */
export interface GoalDefV21 {
  code: string
  label_ar: string
  /** المراحل التي يُعرض عليها هذا الهدف — خيار لا يناسب المرحلة لا يُعرض أصلًا */
  stages: CareerStage[] | 'all'
  /** رمز الهدف القديم المكافئ — جسر لبروفايلات المسارات (لا اختراع ملاءمة) */
  legacy_goal: string
  /** إسهام مجالي ضعيف متعمد — المجال يُحسم من الاحتياج والدليل لا من الهدف */
  domains: DomainId[]
}

export const GOALS_V21: GoalDefV21[] = [
  { code: 'first_job', label_ar: 'الحصول على أول وظيفة', stages: ['university_student', 'fresh_graduate'], legacy_goal: 'first_job', domains: ['employment_readiness'] },
  { code: 'choose_field', label_ar: 'تحديد المجال الأنسب لي', stages: ['university_student', 'fresh_graduate', 'other_unsure'], legacy_goal: 'career_direction', domains: ['career_direction'] },
  { code: 'practical_skills', label_ar: 'بناء مهارات عملية يطلبها سوق العمل', stages: ['university_student', 'fresh_graduate', 'early_career'], legacy_goal: 'employment_advancement', domains: ['employment_readiness'] },
  { code: 'build_portfolio', label_ar: 'بناء ملف أعمال يثبت قدراتي', stages: ['university_student', 'fresh_graduate', 'early_career', 'freelancer'], legacy_goal: 'personal_brand', domains: ['employment_readiness', 'communication_influence'] },
  { code: 'start_business', label_ar: 'بدء مشروع أو مصدر دخل مستقل', stages: ['fresh_graduate', 'early_career', 'experienced', 'manager', 'senior_manager', 'freelancer', 'other_unsure'], legacy_goal: 'business_launch', domains: ['entrepreneurship'] },
  { code: 'specific_skill', label_ar: 'تطوير مهارة محددة أعرفها', stages: 'all', legacy_goal: 'personal_growth', domains: [] },
  { code: 'promotion', label_ar: 'التقدم أو الترقية في عملي', stages: ['early_career', 'experienced', 'manager', 'senior_manager'], legacy_goal: 'promotion', domains: [] },
  { code: 'improve_performance', label_ar: 'تحسين أدائي في عملي الحالي', stages: ['early_career', 'experienced', 'manager', 'senior_manager', 'trainer_ld'], legacy_goal: 'employment_advancement', domains: [] },
  { code: 'career_change', label_ar: 'الانتقال إلى مجال جديد', stages: ['early_career', 'experienced', 'manager', 'senior_manager', 'freelancer', 'trainer_ld'], legacy_goal: 'career_direction', domains: ['career_direction'] },
  { code: 'leadership_prep', label_ar: 'الاستعداد لدور قيادي', stages: ['experienced', 'manager', 'senior_manager'], legacy_goal: 'lead_team', domains: ['people_leadership'] },
  { code: 'ai_better', label_ar: 'استخدام الذكاء الاصطناعي بفعالية أكبر', stages: 'all', legacy_goal: 'digital_transformation', domains: ['ai_productivity'] },
  { code: 'grow_business', label_ar: 'تنمية مشروعي القائم وزيادة إيراداته', stages: ['founder'], legacy_goal: 'revenue_growth', domains: ['entrepreneurship'] },
  { code: 'grow_freelance', label_ar: 'زيادة دخلي وعملائي في العمل الحر', stages: ['freelancer'], legacy_goal: 'revenue_growth', domains: ['entrepreneurship', 'marketing_growth'] },
  { code: 'design_training', label_ar: 'تصميم تدريب أو برامج تعليمية', stages: ['trainer_ld', 'manager', 'senior_manager'], legacy_goal: 'design_training', domains: ['learning_design'] },
  { code: 'unsure_goal', label_ar: 'غير متأكد — أريد أن يساعدني التشخيص', stages: 'all', legacy_goal: 'explore', domains: [] },
]

export function goalByCode(code: string): GoalDefV21 | undefined {
  return GOALS_V21.find((g) => g.code === code)
}

/** أهداف مرحلة بعينها — بترتيبها الثابت في القائمة الأم */
export function goalsForStage(stage: CareerStage): GoalDefV21[] {
  return GOALS_V21.filter((g) => g.stages === 'all' || g.stages.includes(stage))
}

/* ─── الاحتياجات (Real Need → Domain Discovery) ─── */
export interface NeedDefV21 {
  code: string
  label_ar: string
  stages: CareerStage[] | 'all'
  /** الاحتياج هو المحرك الرئيس لاكتشاف المجال */
  domains: DomainId[]
}

const EMPLOYED_LIKE: CareerStage[] = ['early_career', 'experienced', 'manager', 'senior_manager']

export const NEEDS_V21: NeedDefV21[] = [
  { code: 'need_employability', label_ar: 'الجاهزية لسوق العمل — سيرة ومقابلات وملف أعمال', stages: ['university_student', 'fresh_graduate', 'early_career'], domains: ['employment_readiness'] },
  { code: 'need_direction', label_ar: 'تحديد اتجاهي المهني أصلًا', stages: ['university_student', 'fresh_graduate', 'early_career', 'other_unsure'], domains: ['career_direction'] },
  { code: 'need_data', label_ar: 'تحليل البيانات واتخاذ القرار', stages: [...EMPLOYED_LIKE, 'founder', 'freelancer'], domains: ['data_decision'] },
  { code: 'need_projects', label_ar: 'إدارة المشاريع', stages: 'all', domains: ['project_management'] },
  { code: 'need_leadership', label_ar: 'القيادة وإدارة الفرق', stages: ['experienced', 'manager', 'senior_manager', 'founder'], domains: ['people_leadership'] },
  { code: 'need_communication', label_ar: 'التواصل والعرض والتأثير', stages: 'all', domains: ['communication_influence'] },
  { code: 'need_ai', label_ar: 'الذكاء الاصطناعي وتطبيقاته العملية', stages: 'all', domains: ['ai_productivity'] },
  { code: 'need_operations', label_ar: 'العمليات وتحسين الإجراءات', stages: [...EMPLOYED_LIKE, 'founder'], domains: ['operations'] },
  /* مدخل قالب تجربة العميل (TPL-CX-001): الاحتياج ينتج حقيقة current_pain القابلة للاستخدام
     عبر قاعدة اشتقاق موثقة (facts.ts) — لا سؤال «ما ألمك؟» نصي عام */
  { code: 'need_customer_experience', label_ar: 'تجربة العميل / المستفيد وجودة الخدمة', stages: [...EMPLOYED_LIKE, 'founder'], domains: ['operations'] },
  { code: 'need_sales', label_ar: 'المبيعات والتعامل مع العملاء', stages: [...EMPLOYED_LIKE, 'founder', 'freelancer'], domains: ['sales'] },
  { code: 'need_marketing', label_ar: 'التسويق والنمو', stages: ['early_career', 'experienced', 'manager', 'founder', 'freelancer', 'other_unsure'], domains: ['marketing_growth'] },
  { code: 'need_negotiation', label_ar: 'التفاوض وإغلاق الصفقات', stages: ['experienced', 'manager', 'senior_manager', 'founder', 'freelancer'], domains: ['sales', 'communication_influence'] },
  { code: 'need_product', label_ar: 'إدارة المنتج وتجربة المستخدم', stages: ['early_career', 'experienced', 'manager', 'founder', 'freelancer'], domains: ['product_mgmt'] },
  { code: 'need_cyber', label_ar: 'الأمن السيبراني وحماية البيانات', stages: ['experienced', 'manager', 'senior_manager', 'founder'], domains: ['cyber_risk'] },
  { code: 'need_supply', label_ar: 'سلسلة الإمداد والمشتريات', stages: ['experienced', 'manager', 'senior_manager', 'founder'], domains: ['operations'] },
  { code: 'need_finance', label_ar: 'المالية وفهم الأرقام', stages: [...EMPLOYED_LIKE, 'founder', 'freelancer'], domains: ['finance_mgmt'] },
  { code: 'need_learning_design', label_ar: 'تصميم التعلم والتدريب', stages: ['trainer_ld', 'manager', 'senior_manager'], domains: ['learning_design'] },
  { code: 'need_business', label_ar: 'بناء مشروعي من الصفر', stages: ['founder', 'freelancer', 'other_unsure', 'experienced'], domains: ['entrepreneurship'] },
  { code: 'need_unsure', label_ar: 'غير متأكد — أريد اقتراحًا مبنيًا على إجاباتي', stages: 'all', domains: [] },
]

export function needByCode(code: string): NeedDefV21 | undefined {
  return NEEDS_V21.find((n) => n.code === code)
}

export function needsForStage(stage: CareerStage): NeedDefV21[] {
  return NEEDS_V21.filter((n) => n.stages === 'all' || n.stages.includes(stage))
}

/* ─── الطبقات الست الوحيدة لأسئلة B2C ─── */
export type QuestionLayerV21 =
  | 'orientation'
  | 'goal_need'
  | 'domain_differentiation'
  | 'evidence_skill'
  | 'feasibility'
  | 'confirmation_deep'

export const LAYER_LABELS_AR: Record<QuestionLayerV21, string> = {
  orientation: 'التوجيه — أين أنت الآن',
  goal_need: 'الهدف والاحتياج الحقيقي',
  domain_differentiation: 'تمييز المجال',
  evidence_skill: 'الدليل والمهارة',
  feasibility: 'الجدوى الواقعية',
  confirmation_deep: 'تأكيد وتعميق',
}

/* سطح السؤال — أين يعيش */
export type QuestionSurface =
  | 'b2c' // تشخيص المتعلم على الموقع
  | 'b2b_b2g' // مسار المؤسسات المستقل (خارج رحلة B2C)
  | 'ui_ack' // إقرار واجهة قبل البدء — ليس سؤالًا تشخيصيًا
  | 'post_recommendation' // تخصيص ما بعد التوصية (متابعة والتزام) — لا يؤثر على المسار
  | 'retired_b2c' // خارج B2C (لغة/ميزانية/أسري…) — موثق بسبب

/* معرفات الأسئلة الجديدة */
export const Q = {
  STAGE: 'QC-S1-001',
  EMPLOYMENT: 'QC-S1-002',
  GOAL: 'QC-G2-001',
  NEED: 'QC-N3-001',
  TIME: 'QC-F7-001',
  MASTERY: 'QC-C8-001',
} as const

/** حقائق محظورة في B2C — ظهور أي منها في جلسة B2C = تسرب مؤسسي (تفشل الاختبارات) */
export const B2C_BANNED_FACTS = [
  'decision_owner',
  'payer_type',
  'budget_context',
  'budget_profile',
  'language',
  'content_language',
  'org_context',
  'organization_sector',
  'target_job_family',
  'job_level',
  'strategic_priority',
  'org_kpi',
  'management_hypothesis',
  'org_sensitivity',
  'cohort_size',
  'manager_involvement',
  'data_sharing_policy',
  'previous_training',
] as const

/** أسئلة محظورة في B2C (M0 المؤسسي + M9 كاملًا) */
export const B2C_BANNED_QUESTION_PREFIXES = ['QB-M0-001', 'QB-M0-009', 'QB-M9-'] as const

/* ─── الميول المهنية (RIASEC) → المجالات ─── */

/** أبعاد هولاند الستة كما تقيسها أسئلة M5 (ثلاثة أسئلة لكل بعد) */
export type RiasecDim =
  | 'riasec_realistic'
  | 'riasec_investigative'
  | 'riasec_artistic'
  | 'riasec_social'
  | 'riasec_enterprising'
  | 'riasec_conventional'

/** بعد الميل → المجالات التي يرجّحها.
    مخطَّط أكاديمي ثابت (هولاند) لا بيانات كتالوج، فموضعه هنا لا في اللقطة.
    الميل دليل غير مباشر: يرجّح ولا يحسم — والاحتياج يبقى محرّك اكتشاف المجال. */
export const RIASEC_DOMAINS: Record<RiasecDim, DomainId[]> = {
  /* أدوات وأجهزة ونتائج ملموسة، إصلاح وتحسين، مهام عملية واضحة */
  riasec_realistic: ['operations'],
  /* تحليل معلومات معقدة، بحث عميق، أسئلة بلا إجابة مباشرة */
  riasec_investigative: ['data_decision', 'cyber_risk'],
  /* صناعة محتوى وتصميم وسرد، مهام مفتوحة، لغة وصورة */
  riasec_artistic: ['marketing_growth', 'communication_influence'],
  /* مساعدة الآخرين على الفهم، الشرح والتدريب، التعاون */
  riasec_social: ['learning_design', 'people_leadership'],
  /* قيادة مبادرة وإقناع، بيع وتفاوض، منافسة ونتائج */
  riasec_enterprising: ['sales', 'entrepreneurship'],
  /* تنظيم المعلومات والملفات والخطوات بدقة */
  riasec_conventional: ['project_management', 'finance_mgmt'],
}

export const RIASEC_DIMS = Object.keys(RIASEC_DOMAINS) as RiasecDim[]
