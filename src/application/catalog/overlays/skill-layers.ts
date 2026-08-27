/* ج-٢ · مولّد طبقات المهارات (كان scripts/build-v2-overlays.mjs).
   منطقٌ منقول كما هو، بما فيه الحوكمة الأكاديمية: مهارة محكومة هنا لا تدخل
   التشخيص ولا الفجوة ولا التفسير، حتى لو رُبطت بمسار أو سؤال — التفعيل يكون
   فقط بإزالة قيدها بسبب موثق. */

import type { OverlaySource } from './source'

/* أدوار موثقة للمهارات المقاسة غير المغطاة بمسار — لكل منها فعل تخصيص مبرمج فعلي
   في personalizationNotes (src/domain/diagnostic/v2/skills.ts). */
const UNCOVERED_ROLES: Record<string, string> = {
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

interface Governance {
  academic_status: string
  reason_ar: string
  expected_measured?: boolean
}

export const ACADEMIC_GOVERNANCE: Record<string, Governance> = {
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
  /* QB-M4-009 متقاعد ووجهته هنا: السؤال باق في البنك للتاريخ ولا يُسأل، فقياسه
     غير حيّ ولا يستدعي تحذير تفعيل. يُرفع هذا البند ويُستأنف السؤال يوم تُضاف
     دورة إنجليزية — عندها يصير القياس حيّا ويجب أن يُفعَّل أكاديميا فعلا. */
  english_for_work: {
    academic_status: 'future_catalog_skill',
    expected_measured: true,
    reason_ar: FUTURE_CATALOG_REASON,
  },
  /* مقاسة بلا فعل تخصيص مبرمج — لا تُسأل لمجرد جمع البيانات (قرار 2026-08-19) */
  creative_thinking: {
    academic_status: 'future_personalization_signal',
    expected_measured: true, // QB-M4-002 يبقى في البنك لكنه متقاعد في خطة V2.1 — القياس غير الحي متوقع ولا يستدعي تحذيرا
    reason_ar: 'موقوفة بقرار أكاديمي (2026-08-19): فحص الكود أثبت عدم وجود أي فعل تخصيص مبرمج يستهلك قياسها — تُستأنف حين يوجد استخدام حقيقي.',
  },
}

export interface SkillLayerEntry {
  layers: string[]
  active: boolean
  diagnostic_active: boolean
  academic_status: string
  merged_into?: string
  decision_role_ar: string
  pathway_ids?: string[]
  measured_by?: string
}

export interface SkillLayersResult {
  skills: Record<string, SkillLayerEntry>
  /** مهارات محكومة اكتسبت قياسا أو ربطا — تحتاج تفعيلا أكاديميا صريحا */
  activationNeeded: string[]
  /** المهارات المقاسة فعلا (سؤال M4 يقيسها وهي في القاموس) */
  measured: string[]
  /** المقاسة التي لا يتطلبها أي مسار */
  measuredUncovered: string[]
}

export function buildSkillLayers(src: OverlaySource): SkillLayersResult {
  /* مهارات الكتالوج الأساسية + امتدادات المهارات في كتالوج الدورات (نفس مصدر catalog.ts) */
  const allSkills = [...src.skills, ...src.skillExtensions]
  const allSkillSlugs = new Set(allSkills.map((s) => s.slug))
  const measured = new Set<string>()
  for (const q of src.questions) {
    if (q.module_id !== 'M4') continue
    const slug = (q.measures ?? []).find((m) => m !== 'skill_vector')
    if (slug && allSkillSlugs.has(slug)) measured.add(slug)
  }

  const courseBySlug = new Map(src.courses.map((c) => [c.course_id, c]))
  const pathwaySkill = new Map<string, Set<string>>() // slug → pathwayIds
  for (const p of src.pathways) {
    for (const cid of p.course_ids) {
      const c = courseBySlug.get(cid)
      if (!c) continue
      for (const slug of c.skill_slugs ?? []) {
        if (!pathwaySkill.has(slug)) pathwaySkill.set(slug, new Set())
        pathwaySkill.get(slug)!.add(p.id)
      }
    }
  }

  const skillLayers: Record<string, SkillLayerEntry> = {}
  const activationNeeded: string[] = []

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
      if (inPathways || (isMeasured && !gov.expected_measured)) activationNeeded.push(s.slug)
      skillLayers[s.slug] = {
        layers: ['learning_outcome'],
        active: false,
        diagnostic_active: false,
        academic_status: gov.academic_status,
        decision_role_ar: gov.reason_ar,
      }
      continue
    }

    const layers: string[] = []
    let decision_role_ar: string
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
      ...(inPathways ? { pathway_ids: [...pathwaySkill.get(s.slug)!].sort() } : {}),
      ...(isMeasured ? { measured_by: src.questions.find((q) => q.module_id === 'M4' && (q.measures ?? []).includes(s.slug))?.question_id } : {}),
    }
  }

  return {
    skills: skillLayers,
    activationNeeded,
    measured: [...measured],
    measuredUncovered: [...measured].filter((s) => !pathwaySkill.has(s)),
  }
}
