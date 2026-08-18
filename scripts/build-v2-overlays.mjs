#!/usr/bin/env node
/* مولّد طبقات بيانات التشخيص V2 — حتمي بالكامل.
   يقرأ بنك الأسئلة والمهارات والكتالوج والقوالب، ويولّد:
   1) src/data/catalog/v2/question-meta.v2.json — طبقة/مرحلة/أهلية شخصية/أثر قرار لكل سؤال
   2) src/data/catalog/v2/skill-layers.v2.json — الطبقات الخمس لكل مهارة + دورها في القرار
   القواعد هنا موثقة وقابلة للمراجعة؛ أي استثناء يدوي يُسجَّل في MANUAL_OVERRIDES بسبب مكتوب. */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'))

const bank = read('src/data/catalog/questions.v1.ar.json').questions
const skills = read('src/data/catalog/skills.v1.ar.json').skills
const core = read('src/data/catalog/core-catalog.v2.json')
const templates = read('src/data/catalog/composite-templates.v1.json').templates
const optionEffects = read('src/data/overlays/option-effects.v2.json').option_effects

/* ---------- شخصيات V2 (مرجعها src/domain/diagnostic/v2/personas.ts) ---------- */
const ALL_PERSONAS = [
  'school_student', 'university_student', 'graduate', 'job_seeker',
  'junior_employee', 'experienced_employee', 'new_manager', 'leader',
  'gov_employee', 'gov_manager', 'founder_idea', 'founder_operating',
  'freelancer', 'ld_professional', 'parent_guardian', 'personal_development',
  'unsure_explorer', 'b2b_sponsor', 'b2g_sponsor', 'unknown',
]

/* وسوم نطاق V1 → شخصيات V2 (الأهلية الصارمة تُبنى على هذا) */
const SCOPE_TO_PERSONAS = {
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

/* الحقائق التي يستهلكها القرار فعلًا (تقييم مسارات/قوالب/محفزات/قواعد مشتقة/شخصية V2).
   سؤال يقيس حقيقة خارج هذه القائمة = بلا أثر قرار → مرشح تقاعد موثق. */
const DECISION_FACTS = new Set([
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
  'evidence_strength', 'low_confidence_flag', 'pathway_selected', 'industry_note',
  // القوالب المركبة تستهلك هذه الحقائق
  ...templates.flatMap((t) => [
    ...(t.diagnostic?.required_facts ?? []).map((f) => f.fact_key),
    ...(t.diagnostic?.positive_signals ?? []).map((s) => s.fact_key),
    ...(t.diagnostic?.negative_signals ?? []).map((s) => s.fact_key),
    ...(t.diagnostic?.hard_filters ?? []).map((f) => f.condition?.fact_key),
  ]),
])

/* حقيقة → مجالات تساعد على فصلها */
const FACT_DOMAINS = {
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
function layerPhase(q) {
  if (q.module_id === 'M0') return { layer: 'institutional', phase: 'core' }
  if (CORE_IDS.has(q.question_id)) return { layer: 'core', phase: 'core' }
  if (q.module_id === 'M8') return { layer: 'verification', phase: 'confirmation' }
  if (q.module_id === 'M9') return { layer: 'institutional', phase: 'adaptive' }
  if (q.module_id === 'M4') return { layer: 'adaptive', phase: 'adaptive' }
  return { layer: 'adaptive', phase: 'adaptive' }
}

/* استثناءات يدوية موثقة — لكل واحدة سبب */
const MANUAL_OVERRIDES = {
  'QB-M1-003': {
    excluded_personas: ['school_student'],
    reason_ar: 'طالب المدرسة لا يُسأل عن وضعه العملي — سؤال غير مناسب للمرحلة (استبعاد صارم).',
  },
  'QB-M2-015': { layer: 'core', phase: 'core', reason_ar: 'الاستعداد للتطبيق يدخل تقييم الدافعية منذ النواة.' },
}

/* ---------- 1) ميتا الأسئلة ---------- */
const questionMeta = {}
for (const q of bank) {
  const { layer, phase } = layerPhase(q)
  const scope = q.persona_scope?.length ? q.persona_scope : ['all']
  const allowed = scope.includes('all')
    ? [...ALL_PERSONAS]
    : [...new Set(scope.flatMap((s) => SCOPE_TO_PERSONAS[s] ?? []))]
  const excluded = []
  // أمان القاصرين: سؤال عالي الحساسية لا يُطرح على طالب مدرسة مهما كان النطاق
  if (q.sensitivity_level === 'high' && !excluded.includes('school_student')) excluded.push('school_student')

  const measuresFact = (q.measures ?? []).filter((m) => m !== 'skill_vector')
  const isSkillEvidence = q.module_id === 'M4' && measuresFact.length > 0
  const impactsDecision = measuresFact.some((m) => DECISION_FACTS.has(m))
  let decision_impact
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

  const domains = new Set()
  for (const m of measuresFact) {
    const d = FACT_DOMAINS[m]
    if (d === '*') continue // الهدف يقود كل المجالات — لا يوسم بمجال بعينه
    if (Array.isArray(d)) d.forEach((x) => domains.add(x))
  }

  const meta = {
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
    Object.assign(meta, { ...ov, reason_ar: ov.reason_ar })
    if (ov.excluded_personas) {
      meta.excluded_personas = [...new Set([...excluded, ...ov.excluded_personas])]
    }
  }
  questionMeta[q.question_id] = meta
}

/* ---------- 2) طبقات المهارات ---------- */
/* مهارات الكتالوج الأساسية + امتدادات المهارات في كتالوج الدورات (نفس مصدر catalog.ts) */
const allSkills = [...skills, ...(core.skill_extensions ?? [])]
const allSkillSlugs = new Set(allSkills.map((s) => s.slug))
const measured = new Set()
for (const q of bank) {
  if (q.module_id !== 'M4') continue
  const slug = (q.measures ?? []).find((m) => m !== 'skill_vector')
  if (slug && allSkillSlugs.has(slug)) measured.add(slug)
}
const pathwaySkill = new Map() // slug → [pathwayIds]
for (const p of core.launch_pathways) {
  for (const cid of p.course_ids) {
    const c = core.courses.find((x) => x.course_id === cid)
    if (!c) continue
    for (const slug of c.skill_slugs ?? []) {
      if (!pathwaySkill.has(slug)) pathwaySkill.set(slug, new Set())
      pathwaySkill.get(slug).add(p.id)
    }
  }
}
/* أدوار موثقة للمهارات الثلاث المقاسة غير المغطاة بمسار — لكل منها فعل تخصيص مبرمج فعلي
   في personalizationNotes (src/domain/diagnostic/v2/skills.ts). creative_thinking أُوقفت
   2026-08-19: لا فعل تخصيص مبرمج لها — أصبحت future_personalization_signal في ACADEMIC_GOVERNANCE. */
const UNCOVERED_ROLES = {
  digital_literacy: 'إشارة جاهزية رقمية: عند انخفاضها مع مسار رقمي تُضاف ملاحظة تمهيد رقمي في الخطة — لا تغيّر اختيار المسار.',
  learning_agility: 'إشارة تخصيص: توجّه وتيرة الخطة المقترحة — لا تغيّر اختيار المسار.',
  focus_management: 'إشارة تخصيص: توجّه توزيع العبء الأسبوعي داخل الخطة — لا تغيّر اختيار المسار.',
}

/* ─── الحوكمة الأكاديمية (قرار المالك 2026-08-19) ───
   قاعدة صارمة: مهارة محكومة هنا لا تدخل التشخيص ولا الفجوة ولا التفسير ولا دليل
   التوصية، حتى لو رُبطت مستقبلا بمسار أو دورة أو سؤال — التفعيل يكون فقط بإزالة
   قيدها هنا بسبب موثق (Academic Activation صريحة). دلالات الحقول:
   - active في هذا الملف = مشاركة في منطق التشخيص فقط (لا وجودها في القاموس).
   - academic_status يحمل سبب الإيقاف صراحة.
   - القاموس الأم (skills.v1.ar.json) يبقى المصدر الوحيد لوجود المهارة تصنيفيا. */
const FUTURE_CATALOG_REASON = 'مهارة قاموسية مستقبلية موقوفة بقرار أكاديمي (2026-08-19): لا قياس ولا تغطية دوراتية ولا متطلب مسار — تصبح مخرج تعلم فقط حين ترتبط بمنتج فعلي وبتفعيل أكاديمي صريح.'
const ACADEMIC_GOVERNANCE = {
  /* 75 مهارة — future_catalog_skill: صفر قياس/تغطية/متطلب (مؤكد من الكتالوج الحي) */
  ...Object.fromEntries([
  'ai_for_learning', 'competitive_analysis', 'social_media_strategy', 'ecommerce_basics',
  'legal_basics_business', 'career_transition', 'salary_negotiation', 'mentorship_use',
  'sensemaking', 'curiosity', 'innovation_methods', 'mental_models',
  'ambiguity_tolerance', 'english_for_work', 'report_writing', 'cross_cultural_communication',
  'media_literacy', 'dashboard_reading', 'business_intelligence', 'information_search',
  'digital_file_management', 'cloud_collaboration', 'online_meetings', 'digital_productivity',
  'basic_design_literacy', 'digital_wellbeing', 'remote_work_tools', 'parent_child_communication',
  'positive_discipline', 'child_learning_support', 'child_financial_literacy', 'child_digital_safety',
  'family_reading_culture', 'family_goal_setting', 'teen_confidence_support', 'family_dialogue',
  'role_modeling', 'personal_budgeting', 'saving_habits', 'debt_management',
  'emergency_fund', 'investment_basics', 'risk_return', 'financial_goal_setting',
  'consumer_awareness', 'tax_basics', 'public_economics_basics', 'family_financial_literacy',
  'public_service_mindset', 'government_correspondence', 'policy_literacy', 'public_finance_basics',
  'public_procurement', 'digital_government', 'public_sector_project_management', 'public_ethics',
  'policy_evaluation', 'government_ai_readiness', 'self_directed_learning', 'reading_strategies',
  'note_taking', 'summarization', 'memory_spaced_repetition', 'course_completion',
  'portfolio_learning', 'peer_learning', 'energy_management', 'habit_building',
  'distraction_reduction', 'stress_resilience_nonclinical', 'sleep_routine_awareness', 'mindful_technology_use',
  'motivation_systems', 'healthy_boundaries', 'recovery_planning',
  ].map((slug) => [slug, { academic_status: 'future_catalog_skill', reason_ar: FUTURE_CATALOG_REASON }])),
  /* مقاسة بلا فعل تخصيص مبرمج — لا تُسأل لمجرد جمع البيانات (قرار 2026-08-19) */
  creative_thinking: {
    academic_status: 'future_personalization_signal',
    expected_measured: true, // QB-M4-002 يبقى في البنك لكنه متقاعد في خطة V2.1 — القياس غير الحي متوقع ولا يستدعي تحذيرا
    reason_ar: 'موقوفة بقرار أكاديمي (2026-08-19): فحص الكود أثبت عدم وجود أي فعل تخصيص مبرمج يستهلك قياسها — تُستأنف حين يوجد استخدام حقيقي.',
  },
}
const skillLayers = {}
for (const s of allSkills) {
  const isMeasured = measured.has(s.slug)
  const inPathways = pathwaySkill.has(s.slug)

  /* دمج موثق: السجل المدموج لا يدخل التشخيص — مرجع تاريخي فقط */
  if (s.merged_into) {
    skillLayers[s.slug] = {
      layers: ['learning_outcome'],
      active: false,
      diagnostic_active: false,
      academic_status: 'merged',
      merged_into: s.merged_into,
      decision_role_ar: `مدموجة في ${s.merged_into} بقرار أكاديمي موثق (${s.merge_date}) — مرجع تاريخي فقط، لا تدخل التشخيص.`,
    }
    continue
  }

  /* حوكمة أكاديمية صريحة: تسبق أي اشتقاق — الربط المستقبلي لا يفعّلها تلقائيًا */
  const gov = ACADEMIC_GOVERNANCE[s.slug]
  if (gov) {
    if (inPathways || (isMeasured && !gov.expected_measured)) {
      console.warn(`⚠️  ACADEMIC ACTIVATION NEEDED: ${s.slug} محكومة (${gov.academic_status}) لكنها اكتسبت قياسًا أو ربطًا — أزِل قيدها بسبب موثق أو فك الربط.`)
    }
    skillLayers[s.slug] = {
      layers: ['learning_outcome'],
      active: false,
      diagnostic_active: false,
      academic_status: gov.academic_status,
      decision_role_ar: gov.reason_ar,
    }
    continue
  }

  const layers = []
  let decision_role_ar
  if (isMeasured && inPathways) {
    layers.push('diagnostic', 'pathway_requirement')
    decision_role_ar = 'تُقاس بسؤال M4 وتدخل حساب فجوة المهارات للمسارات التي تتطلبها.'
  } else if (isMeasured && !inPathways) {
    layers.push('diagnostic', 'personalization_signal')
    decision_role_ar = UNCOVERED_ROLES[s.slug] ?? 'مهارة مقاسة لا يتطلبها أي مسار حاليًا — إشارة تخصيص موثقة، لا تغيّر اختيار المسار.'
  } else if (!isMeasured && inPathways) {
    layers.push('pathway_requirement', 'learning_outcome')
    decision_role_ar = 'متطلب مسار غير مقاس: لا تُفترض ولا تدخل الفجوة ولا التفسير — تُعرض كمجهولة صراحة.'
  } else {
    layers.push('learning_outcome')
    decision_role_ar = 'مخرج تعلم مستقبلي — خارج نطاق التشخيص الحالي تمامًا.'
  }
  skillLayers[s.slug] = {
    layers,
    active: s.active !== false,
    diagnostic_active: s.active !== false,
    academic_status: 'approved_active',
    decision_role_ar,
    ...(inPathways ? { pathway_ids: [...pathwaySkill.get(s.slug)].sort() } : {}),
    ...(isMeasured ? { measured_by: bank.find((q) => q.module_id === 'M4' && (q.measures ?? []).includes(s.slug))?.question_id } : {}),
  }
}

/* ---------- كتابة حتمية ---------- */
const outDir = join(root, 'src/data/catalog/v2')
mkdirSync(outDir, { recursive: true })
const sortObj = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]))
writeFileSync(
  join(outDir, 'question-meta.v2.json'),
  JSON.stringify({ version: '2.0.0', generated_by: 'scripts/build-v2-overlays.mjs', questions: sortObj(questionMeta) }, null, 2) + '\n',
)
writeFileSync(
  join(outDir, 'skill-layers.v2.json'),
  JSON.stringify({ version: '2.0.0', generated_by: 'scripts/build-v2-overlays.mjs', skills: sortObj(skillLayers) }, null, 2) + '\n',
)
const retired = Object.entries(questionMeta).filter(([, m]) => m.layer === 'retire_candidate')
const uncoveredMeasured = [...measured].filter((s) => !pathwaySkill.has(s))
console.log(`questions: ${bank.length} | retire_candidates: ${retired.length} | skills: ${allSkills.length} | measured: ${measured.size} | measured-uncovered: ${uncoveredMeasured.join(', ')}`)
console.log('retire_candidates:', retired.map(([id]) => id).join(', '))
