/* ج-٢ · مولّد ميتا الأسئلة (كان scripts/build-v2-overlays.mjs).
   منطقٌ منقول كما هو — القواعد موثقة وقابلة للمراجعة، وأي استثناء يدوي
   يُسجَّل في MANUAL_OVERRIDES بسبب مكتوب.

   نُقل إلى الطبقة المشتركة كي يعمل في موضعين بالنتيجة نفسها: السكربت المحلي
   الذي يكتب الملف، وباني اللقطة الذي يولّده من الصفوف المنشورة. فسؤالٌ يُضاف
   بعد النشر يصبح مرئيا للمحرك بلا نشر كود. */

import type { OverlaySource } from './source'

/* ---------- شخصيات V2 (مرجعها src/domain/diagnostic/v2/personas.ts) ---------- */
export const ALL_PERSONAS = [
  'school_student', 'university_student', 'graduate', 'job_seeker',
  'junior_employee', 'experienced_employee', 'new_manager', 'leader',
  'gov_employee', 'gov_manager', 'founder_idea', 'founder_operating',
  'freelancer', 'ld_professional', 'parent_guardian', 'personal_development',
  'unsure_explorer', 'b2b_sponsor', 'b2g_sponsor', 'unknown',
]

/* وسوم نطاق V1 → شخصيات V2 (الأهلية الصارمة تُبنى على هذا) */
const SCOPE_TO_PERSONAS: Record<string, string[]> = {
  student: ['school_student', 'university_student'],
  graduate: ['graduate', 'job_seeker', 'junior_employee'],
  employee: ['junior_employee', 'experienced_employee', 'new_manager', 'leader'],
  gov_employee: ['gov_employee', 'gov_manager'],
  entrepreneur: ['founder_idea', 'founder_operating'],
  freelancer: ['freelancer'],
  parent: ['parent_guardian'],
  wellbeing: ['parent_guardian', 'personal_development'],
  unclear: ['unsure_explorer', 'personal_development'],
  career_changer: ['job_seeker', 'junior_employee', 'experienced_employee', 'unsure_explorer'],
  b2b: ['b2b_sponsor'],
  b2g: ['b2g_sponsor'],
  all: ALL_PERSONAS,
}

/* الحقائق الثابتة التي يستهلكها القرار — تُضاف إليها حقائق القوالب من المصدر */
const BASE_DECISION_FACTS = [
  // الهوية والموافقة والأمان
  'decision_owner', 'age_band', 'minor_flag', 'diagnostic_consent', 'marketing_consent',
  'privacy_comfort', 'language', 'save_preference',
  // الشخصية V2
  'persona_type', 'persona_branch', 'education_state', 'employment_state',
  'sector', 'payer_type', 'leadership_context', 'business_stage', 'function_specialization',
  // الهدف والدوافع
  'primary_goal', 'goal_clarity', 'goal_urgency', 'application_readiness',
  'first_job_clarity', 'offer_clarity', 'revenue_signal', 'public_facing',
  'operations_maturity', 'breadth_depth_preference', 'practical_exposure',
  'interview_confidence', 'career_assets',
  // القيود والتفضيلات
  'weekly_load', 'learning_format', 'cohort_preference', 'content_language', 'budget_profile',
  // التحقق
  'evidence_strength', 'low_confidence_flag', 'pathway_selected',
  /* industry_note حُذفت: كانت تُكتب من أربعة خيارات في سؤال القطاع (تقني/تجاري/
     صحي/مالي) ولا يقرؤها أحد — لا كيان يعلن مجالا صناعيا. وكانت تكلفتها أعلى من
     صفر: من يعمل في صحة خاصة كان مخيَّرا بين «خاص» و«صحي» وكلاهما صادق، فيخسر
     أحدهما — والخاسر دائما هو الذي لا يُقرأ. */
]

/* حقيقة → مجالات تساعد على فصلها */
const FACT_DOMAINS: Record<string, string[] | '*'> = {
  primary_goal: '*', // الهدف يقود المجال كله
  function_specialization: ['gov_services', 'communication_influence', 'operations', 'finance_mgmt', 'people_leadership', 'learning_design', 'marketing_growth', 'sales', 'ai_productivity', 'data_decision'],
  sector: ['gov_services'],
  leadership_context: ['people_leadership'],
  business_stage: ['entrepreneurship'],
  offer_clarity: ['entrepreneurship'],
  revenue_signal: ['entrepreneurship', 'marketing_growth', 'sales'],
  public_facing: ['communication_influence'],
  operations_maturity: ['operations', 'entrepreneurship'],
  first_job_clarity: ['career_direction', 'employment_readiness'],
  practical_exposure: ['career_direction', 'employment_readiness'],
  interview_confidence: ['employment_readiness'],
  career_assets: ['employment_readiness'],
}

/* قواعد الطبقة والمرحلة من الوحدة — موثقة */
const CORE_IDS = new Set([
  'QB-M0-006', // الموافقة على التشخيص
  'QB-M1-001', // من أنت (الشخصية)
  'QB-M1-002', // المرحلة التعليمية
  'QB-M1-003', // الوضع العملي (مشروط: لا يُسأل لطالب مدرسة)
  'QB-M2-001', // الهدف الأساسي
  'QB-M2-005', // وضوح الهدف
  'QB-M7-001', // الوقت الأسبوعي
  'QB-M3B-012', // سياق قيادي (نواة مشروطة للموظفين)
  'QB-M3B-001', // القطاع (نواة مشروطة للموظفين)
  'QB-M3C-001', // مرحلة المشروع (نواة مشروطة للرواد)
])

function layerPhase(moduleId: string, questionId: string): { layer: string; phase: string } {
  if (moduleId === 'M0') return { layer: 'institutional', phase: 'core' }
  if (CORE_IDS.has(questionId)) return { layer: 'core', phase: 'core' }
  if (moduleId === 'M8') return { layer: 'verification', phase: 'confirmation' }
  if (moduleId === 'M9') return { layer: 'institutional', phase: 'adaptive' }
  if (moduleId === 'M4') return { layer: 'adaptive', phase: 'adaptive' }
  return { layer: 'adaptive', phase: 'adaptive' }
}

/* استثناءات يدوية موثقة — لكل واحدة سبب */
const MANUAL_OVERRIDES: Record<string, Record<string, unknown>> = {
  'QB-M1-003': {
    excluded_personas: ['school_student'],
    reason_ar: 'طالب المدرسة لا يُسأل عن وضعه العملي — سؤال غير مناسب للمرحلة (استبعاد صارم).',
  },
  'QB-M2-015': { layer: 'core', phase: 'core', reason_ar: 'الاستعداد للتطبيق يدخل تقييم الدافعية منذ النواة.' },
}

export interface QuestionMetaEntry {
  layer: string
  phase: string
  allowed_personas: string[]
  excluded_personas: string[]
  domains: string[]
  decision_impact: string
  measures: string[]
  reason_ar?: string
}

/** الحقائق التي يستهلكها القرار: الثابتة + ما تستهلكه القوالب في المصدر */
export function decisionFactsOf(templates: OverlaySource['templates']): Set<string> {
  return new Set([
    ...BASE_DECISION_FACTS,
    ...templates.flatMap((t) => [
      ...(t.diagnostic?.required_facts ?? []).map((f) => f.fact_key),
      ...(t.diagnostic?.positive_signals ?? []).map((s) => s.fact_key),
      ...(t.diagnostic?.negative_signals ?? []).map((s) => s.fact_key),
      ...(t.diagnostic?.hard_filters ?? []).map((f) => f.condition?.fact_key),
    ]).filter((k): k is string => typeof k === 'string'),
  ])
}

export function buildQuestionMeta(src: OverlaySource): Record<string, QuestionMetaEntry> {
  const decisionFacts = decisionFactsOf(src.templates)
  const questionMeta: Record<string, QuestionMetaEntry> = {}

  for (const q of src.questions) {
    const { layer, phase } = layerPhase(q.module_id, q.question_id)
    const scope = q.persona_scope?.length ? q.persona_scope : ['all']
    const allowed = scope.includes('all')
      ? [...ALL_PERSONAS]
      : [...new Set(scope.flatMap((s) => SCOPE_TO_PERSONAS[s] ?? []))]
    const excluded: string[] = []
    // أمان القاصرين: سؤال عالي الحساسية لا يُطرح على طالب مدرسة مهما كان النطاق
    if (q.sensitivity_level === 'high' && !excluded.includes('school_student')) excluded.push('school_student')

    const measuresFact = (q.measures ?? []).filter((m) => m !== 'skill_vector')
    const isSkillEvidence = q.module_id === 'M4' && measuresFact.length > 0
    const impactsDecision = measuresFact.some((m) => decisionFacts.has(m))
    let decision_impact: string
    if (isSkillEvidence) decision_impact = 'skill_evidence'
    else if (q.module_id === 'M0') decision_impact = 'safety'
    else if (q.module_id === 'M8') decision_impact = 'verification'
    else if (q.module_id === 'M9') decision_impact = 'fact' // طبقة مؤسسية — تُدار بعقود B2B/B2G
    else if (q.module_id === 'M5') decision_impact = 'separation' // ميول RIASEC تفصل المجالات عند التردد
    else if (impactsDecision) decision_impact = 'fact'
    else if (q.module_id === 'M6' || q.module_id === 'M7') decision_impact = 'personalization'
    else decision_impact = 'none'

    // مرشح التقاعد يقتصر على الطبقات التكيفية/النواة بلا أثر قرار —
    // المؤسسية والتحقق والسلامة تبقى بطبقتها مهما كانت حقائقها (دورها وظيفي لا تسجيلي)

    const domains = new Set<string>()
    for (const m of measuresFact) {
      const d = FACT_DOMAINS[m]
      if (d === '*') continue // الهدف يقود كل المجالات — لا يوسم بمجال بعينه
      if (Array.isArray(d)) d.forEach((x) => domains.add(x))
    }

    const meta: QuestionMetaEntry = {
      layer: decision_impact === 'none' && (layer === 'adaptive' || layer === 'core') ? 'retire_candidate' : layer,
      phase,
      allowed_personas: allowed,
      excluded_personas: excluded,
      domains: [...domains].sort(),
      decision_impact,
      measures: measuresFact,
    }
    const ov = MANUAL_OVERRIDES[q.question_id]
    if (ov) {
      Object.assign(meta, ov)
      if (Array.isArray(ov.excluded_personas)) {
        meta.excluded_personas = [...new Set([...excluded, ...(ov.excluded_personas as string[])])]
      }
    }
    questionMeta[q.question_id] = meta
  }
  return questionMeta
}
