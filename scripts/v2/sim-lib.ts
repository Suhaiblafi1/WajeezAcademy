/* مكتبة محاكاة V2 — شخصيات حتمية ومُجيب حتمي.
   لا عشوائية هنا: كل شخصية تُجيب بنفس الطريقة دائمًا (المتغيرات معلنة في spec). */

import { optionIdAt, questionById } from '../../src/domain/diagnostic/catalog'
import { createEngineV2, derivePersona, type DiagnosticEngineV2, type RecommendationV2 } from '../../src/domain/diagnostic/v2'
import { questionMetaV2 } from '../../src/domain/diagnostic/v2/data'
import type { PersonaKey } from '../../src/domain/diagnostic/v2/types'

export interface PersonaSpec {
  id: string
  category: 'students' | 'employees' | 'business' | 'other'
  label_ar: string
  /** حقائق مستهدفة برموزها (مثل primary_goal: 'career_direction') */
  facts: Record<string, string>
  /** تثبيت خيار بنصه الصريح — يتغلب على المطابقة بالرمز (طالب مدرسة ≠ طالب جامعة) */
  optionText?: Record<string, string>
  /** إجابات نصية للأسئلة الحرة (مثل مرحلة المشروع) */
  textAnswers?: Record<string, string>
  /** مستويات المهارات الذاتية 1..5 لأسئلة M4 */
  skillLevels?: Record<string, number>
  /** مستويات ليكرت الافتراضية */
  likertDefault?: number
}

export interface AskedRecord {
  questionId: string
  personaAtAsk: PersonaKey
  eligibleForPersona: boolean
}

export interface SessionResult {
  personaId: string
  variant: string
  asked: AskedRecord[]
  answersCount: number
  stopReason_ar: string
  kind: string
  topPathwayId: string | null
  compositeTemplateId: string | null
  outputKind: string | null
  confidenceOverall: number | null
  domainTop: string | null
  measuredSkillCoverage: number | null
  gapSkillSlugs: string[]
  /** أعلى ٣ مرشحين بترتيبهم — لتوزيع Top3 */
  top3PathwayIds: string[]
  unknownSkillSlugs: string[]
  invalidPersonaQuestions: string[]
  unmeasuredInfluence: string[]
  duplicateQuestions: string[]
  guardrailStop: string | null
}

const SKILL_FACT_FALLBACK_LEVEL = 3

/** يختار ترتيب الخيار المطابق للحقيقة المستهدفة عبر optionEffects — حتمي */
import optionEffectsJson from '../../src/data/overlays/option-effects.v2.json'
const OPTION_EFFECTS = (optionEffectsJson as unknown as { option_effects: Record<string, Record<string, Record<string, string>>> }).option_effects

function pickOptionIndex(qid: string, optionIds: string[], spec: PersonaSpec, measures: string[]): number {
  const effects = OPTION_EFFECTS[qid]
  if (effects) {
    for (const m of measures) {
      const target = spec.facts[m]
      if (!target) continue
      for (const oid of optionIds) {
        if (effects[oid]?.[m] === target) return optionIds.indexOf(oid)
      }
    }
  }
  /* أسئلة المهارات: مستوى ذاتي من الشخصية */
  const q = questionById.get(qid)
  if (q && q.answer_type === 'skill_level_5') {
    const slug = measures[0]
    const lvl = spec.skillLevels?.[slug] ?? SKILL_FACT_FALLBACK_LEVEL
    return Math.min(Math.max(lvl - 1, 0), optionIds.length - 1)
  }
  if (q && q.answer_type === 'likert_5') {
    const lvl = spec.likertDefault ?? 3
    return Math.min(Math.max(lvl - 1, 0), optionIds.length - 1)
  }
  /* افتراضي حتمي: الخيار الأوسط */
  return Math.floor(optionIds.length / 2)
}

/** يجيب عن السؤال المعروض حسب الشخصية — يعيد true إن سُجلت إجابة */
export function answerCurrent(engine: DiagnosticEngineV2, spec: PersonaSpec): boolean {
  const r = engine.nextQuestion()
  const q = r.question
  if (!q) return false
  if (q.answer_type === 'single_choice_or_text' || q.answer_type === 'short_text') {
    engine.answer({ questionId: q.question_id, value: spec.textAnswers?.[q.question_id] ?? 'لست متأكدا حاليا' })
    return true
  }
  const ids = q.active_option_ids ?? q.options_ar.map((_, i) => optionIdAt(q, i))
  /* الموافقة دائمًا نعم في المحاكاة */
  if (q.question_id === 'QB-M0-006') {
    engine.answer({ questionId: q.question_id, value: q.options_ar[0], optionIds: [ids[0]] })
    return true
  }
  /* تثبيت بالنص الصريح أولًا */
  const pinned = spec.optionText?.[q.question_id]
  if (pinned) {
    const pi = q.options_ar.indexOf(pinned)
    if (pi >= 0) {
      engine.answer({ questionId: q.question_id, value: pinned, optionIds: [ids[pi]] })
      return true
    }
  }
  const idx = pickOptionIndex(q.question_id, ids, spec, q.measures.filter((m) => m !== 'skill_vector'))
  engine.answer({ questionId: q.question_id, value: q.options_ar[idx], optionIds: [ids[idx]] })
  return true
}

/** يشغّل جلسة كاملة ويجمع النتائج والمخالفات */
export function runSession(spec: PersonaSpec, variant: string, maxSteps = 30): SessionResult {
  const engine = createEngineV2(`sim-${spec.id}-${variant}`)
  const asked: AskedRecord[] = []
  let stopReason = ''
  let guardrail: string | null = null

  for (let i = 0; i < maxSteps; i++) {
    const r = engine.nextQuestion()
    if (!r.question) {
      stopReason = r.stop.reason_ar
      break
    }
    const q = r.question
    const personaAtAsk = derivePersona(engine.getState().facts).key
    const meta = questionMetaV2[q.question_id]
    const eligible = meta
      ? (meta.allowed_personas === 'all' || meta.allowed_personas.includes(personaAtAsk) || personaAtAsk === 'unknown') &&
        !meta.excluded_personas.includes(personaAtAsk)
      : false
    asked.push({ questionId: q.question_id, personaAtAsk, eligibleForPersona: eligible })
    if (!answerCurrent(engine, spec)) break
  }

  const state = engine.getState()
  guardrail = state.guardrailStop
  const rec: RecommendationV2 = engine.recommend()
  const v2 = rec.v2
  const measured = new Set(Object.keys(state.skillVector))
  const gap = rec.primaryPathway?.gapSkillSlugs ?? []
  const unmeasuredInfluence = gap.filter((s) => !measured.has(s))
  const invalidPersonaQuestions = asked.filter((a) => !a.eligibleForPersona).map((a) => `${a.questionId}@${a.personaAtAsk}`)
  const seen = new Set<string>()
  const dupes: string[] = []
  for (const a of asked) {
    if (seen.has(a.questionId)) dupes.push(a.questionId)
    seen.add(a.questionId)
  }

  return {
    personaId: spec.id,
    variant,
    asked,
    answersCount: asked.length,
    stopReason_ar: stopReason,
    kind: rec.kind,
    topPathwayId: rec.primaryPathway?.pathwayId ?? null,
    compositeTemplateId: rec.composite?.templateId ?? null,
    outputKind: v2?.confidence.outputKind ?? null,
    confidenceOverall: v2?.confidence.overall ?? null,
    domainTop: v2?.explanation.domain_top ?? null,
    measuredSkillCoverage: v2 ? v2.confidence.skillEvidenceCoverage : null,
    gapSkillSlugs: gap,
    top3PathwayIds: [rec.primaryPathway?.pathwayId, ...rec.alternatives.map((a) => a.pathwayId)].filter((x): x is string => Boolean(x)),
    unknownSkillSlugs: rec.primaryPathway ? (v2?.explanation.unknown_skills ?? []).map((s) => s.slug) : [],
    invalidPersonaQuestions,
    unmeasuredInfluence,
    duplicateQuestions: dupes,
    guardrailStop: guardrail,
  }
}

/* ═══ مصفوفة الشخصيات — ٧٥ شخصية في أربع فئات ═══ */

const LOADS = ['3_4', '5_6', '7_plus', 'lt_3']
const CLARITY = ['high', 'medium', 'low']
const READINESS = ['high', 'medium', 'low']

function mk(id: string, category: PersonaSpec['category'], label_ar: string, facts: Record<string, string>, extra?: Partial<PersonaSpec>): PersonaSpec {
  return { id, category, label_ar, facts, ...extra }
}

export function buildPersonas(): PersonaSpec[] {
  const out: PersonaSpec[] = []
  let n = 0
  const next = (prefix: string) => `${prefix}-${String(++n).padStart(2, '0')}`

  /* طلبة — ١٥ */
  const schoolGoals = ['career_direction', 'personal_growth', 'explore', 'business_launch', 'career_direction']
  schoolGoals.forEach((goal, i) => {
    out.push(mk(next('sch'), 'students', `طالب مدرسة — هدف ${goal}`, {
      decision_owner: 'self', diagnostic_consent: 'yes',
      persona_type: 'student', education_state: 'school',
      primary_goal: goal, goal_clarity: CLARITY[i % 3],
      application_readiness: READINESS[i % 3], weekly_load: LOADS[i % 4],
    }, { optionText: { 'QB-M1-001': 'طالب مدرسة' } }))
  })
  const uniGoals = ['employment_advancement', 'business_launch', 'career_direction', 'lead_team', 'explore']
  uniGoals.forEach((goal, i) => {
    out.push(mk(next('uni'), 'students', `طالب جامعة — هدف ${goal}`, {
      decision_owner: 'self', diagnostic_consent: 'yes',
      persona_type: 'student', education_state: 'university',
      employment_state: i % 2 === 0 ? 'not_working' : 'employed',
      primary_goal: goal, goal_clarity: CLARITY[(i + 1) % 3],
      application_readiness: READINESS[i % 3], weekly_load: LOADS[(i + 1) % 4],
    }, { optionText: { 'QB-M1-001': 'طالب جامعة' } }))
  })
  const gradGoals = ['employment_advancement', 'employment_advancement', 'career_direction', 'business_launch', 'personal_growth']
  gradGoals.forEach((goal, i) => {
    out.push(mk(next('grd'), 'students', `خريج — هدف ${goal}`, {
      decision_owner: 'self', diagnostic_consent: 'yes',
      persona_type: 'early_career', education_state: 'graduate',
      employment_state: i === 3 ? 'self_employed' : i % 2 === 0 ? 'not_working' : 'employed',
      primary_goal: goal, goal_clarity: CLARITY[i % 3],
      application_readiness: READINESS[(i + 1) % 3], weekly_load: LOADS[(i + 2) % 4],
    }, { optionText: { 'QB-M1-001': 'خريج جديد' }, ...(i === 3 ? { textAnswers: { 'QB-M3C-001': 'أفكر بفكرة ولم أبدأ بعد' } } : {}) }))
  })

  /* موظفون — ٢٠ */
  const empGoals = ['employment_advancement', 'personal_growth', 'lead_team', 'career_direction', 'employment_advancement']
  empGoals.forEach((goal, i) => {
    out.push(mk(next('jnr'), 'employees', `موظف مبتدئ — ${goal}`, {
      decision_owner: 'self', diagnostic_consent: 'yes',
      persona_type: 'employee', employment_state: 'employed', sector: 'private',
      leadership_context: 'none',
      primary_goal: goal, goal_clarity: CLARITY[i % 3],
      application_readiness: READINESS[i % 3], weekly_load: LOADS[i % 4],
    }, { optionText: { 'QB-M1-001': 'موظف' } }))
  })
  const expGoals = ['employment_advancement', 'lead_team', 'business_launch', 'personal_growth', 'career_direction']
  expGoals.forEach((goal, i) => {
    out.push(mk(next('exp'), 'employees', `موظف خبرة — ${goal}`, {
      decision_owner: 'self', diagnostic_consent: 'yes',
      persona_type: 'employee', employment_state: 'employed', sector: i === 4 ? 'nonprofit' : 'private',
      leadership_context: 'none',
      primary_goal: goal, goal_clarity: CLARITY[(i + 1) % 3],
      application_readiness: READINESS[(i + 1) % 3], weekly_load: LOADS[(i + 1) % 4],
    }, { optionText: { 'QB-M1-001': 'موظف' }, ...(goal === 'business_launch' ? { textAnswers: { 'QB-M3C-001': 'عندي فكرة وأدرس الجدوى' } } : {}) }))
  })
  const mgrGoals = ['lead_team', 'employment_advancement', 'lead_team', 'personal_growth', 'lead_team']
  mgrGoals.forEach((goal, i) => {
    out.push(mk(next('mgr'), 'employees', `مدير جديد — ${goal}`, {
      decision_owner: 'self', diagnostic_consent: 'yes',
      persona_type: 'employee', employment_state: 'employed', sector: 'private',
      leadership_context: 'informal',
      primary_goal: goal, goal_clarity: CLARITY[i % 3],
      application_readiness: READINESS[i % 3], weekly_load: LOADS[(i + 2) % 4],
    }, { optionText: { 'QB-M1-001': 'موظف' } }))
  })
  const govGoals = ['employment_advancement', 'lead_team', 'personal_growth', 'employment_advancement', 'career_direction']
  govGoals.forEach((goal, i) => {
    out.push(mk(next('gov'), 'employees', `موظف حكومي — ${goal}`, {
      decision_owner: 'self', diagnostic_consent: 'yes',
      persona_type: 'employee', employment_state: 'employed', sector: 'public',
      leadership_context: i >= 3 ? 'informal' : 'none',
      primary_goal: goal, goal_clarity: CLARITY[i % 3],
      application_readiness: READINESS[i % 3], weekly_load: LOADS[i % 4],
    }, { optionText: { 'QB-M1-001': 'موظف' } }))
  })

  /* أعمال — ٢٠ */
  const ideaStages = [
    { t: 'عندي فكرة ولم أبدأ', code: 'idea' },
    { t: 'أتحقق وأختبر نموذجًا أوليًا', code: 'validation' },
    { t: 'لم أبع بعد — قبل الإيراد', code: 'pre_revenue' },
    { t: 'عندي فكرة وأدرس الجدوى', code: 'validation' },
    { t: 'تصور مبدئي وأفكر', code: 'idea' },
  ]
  ideaStages.forEach((s, i) => {
    out.push(mk(next('fnd'), 'business', `رائد فكرة — ${s.code}`, {
      decision_owner: 'self', diagnostic_consent: 'yes',
      persona_type: 'founder', employment_state: 'business_owner',
      primary_goal: 'business_launch', goal_clarity: CLARITY[i % 3],
      application_readiness: READINESS[i % 3], weekly_load: LOADS[i % 4],
    }, { optionText: { 'QB-M1-001': 'رائد أعمال/مستقل' }, textAnswers: { 'QB-M3C-001': s.t } }))
  })
  const opStages = [
    { t: 'بدأت أبيع وأول مبيعات', code: 'early_revenue' },
    { t: 'المشروع ينمو ويتوسع ومبيعات متكررة', code: 'growing' },
    { t: 'مشروع مستقر وقائم منذ سنوات', code: 'established' },
    { t: 'بدأ البيع وأول عميل', code: 'early_revenue' },
    { t: 'ينمو وزبائن دائمون', code: 'growing' },
  ]
  opStages.forEach((s, i) => {
    out.push(mk(next('fop'), 'business', `مشروع قائم — ${s.code}`, {
      decision_owner: 'self', diagnostic_consent: 'yes',
      persona_type: 'founder', employment_state: 'business_owner',
      primary_goal: 'business_launch', goal_clarity: CLARITY[(i + 1) % 3],
      application_readiness: READINESS[(i + 1) % 3], weekly_load: LOADS[(i + 1) % 4],
    }, { optionText: { 'QB-M1-001': 'رائد أعمال/مستقل' }, textAnswers: { 'QB-M3C-001': s.t } }))
  })
  const freeGoals = ['business_launch', 'personal_growth', 'business_launch', 'career_direction', 'personal_growth']
  freeGoals.forEach((goal, i) => {
    out.push(mk(next('fre'), 'business', `مستقل — ${goal}`, {
      decision_owner: 'self', diagnostic_consent: 'yes',
      persona_type: 'freelancer', employment_state: 'self_employed',
      primary_goal: goal, goal_clarity: CLARITY[i % 3],
      application_readiness: READINESS[(i + 2) % 3], weekly_load: LOADS[(i + 2) % 4],
    }, { optionText: { 'QB-M1-001': 'رائد أعمال/مستقل' }, textAnswers: { 'QB-M3C-001': 'أعمل بمشروعي الحر وبدأت أبيع' } }))
  })
  const mixFounder = ['lead_team', 'employment_advancement', 'personal_growth', 'business_launch', 'explore']
  mixFounder.forEach((goal, i) => {
    out.push(mk(next('fmx'), 'business', `رائد/مستقل — ${goal}`, {
      decision_owner: 'self', diagnostic_consent: 'yes',
      persona_type: i % 2 === 0 ? 'founder' : 'freelancer',
      employment_state: i % 2 === 0 ? 'business_owner' : 'self_employed',
      primary_goal: goal, goal_clarity: CLARITY[i % 3],
      application_readiness: READINESS[i % 3], weekly_load: LOADS[i % 4],
    }, { optionText: { 'QB-M1-001': 'رائد أعمال/مستقل' }, textAnswers: { 'QB-M3C-001': 'ينمو ويتوسع' } }))
  })

  /* أخرى — ٢٠ */
  for (let i = 0; i < 5; i++) {
    out.push(mk(next('par'), 'other', `ولي أمر — ${i}`, {
      decision_owner: 'self', diagnostic_consent: 'yes',
      persona_branch: 'family',
      primary_goal: 'family_wellbeing', goal_clarity: CLARITY[i % 3],
      application_readiness: READINESS[i % 3], weekly_load: LOADS[i % 4],
    }, { optionText: { 'QB-M1-001': 'أب/أم' } }))
  }
  for (let i = 0; i < 5; i++) {
    out.push(mk(next('uns'), 'other', `غير متأكد — ${i}`, {
      decision_owner: 'self', diagnostic_consent: 'yes',
      persona_branch: 'unsure',
      primary_goal: 'explore', goal_clarity: 'low',
      application_readiness: READINESS[i % 3], weekly_load: LOADS[(i + 1) % 4],
    }, { optionText: { 'QB-M1-001': 'غير متأكد' } }))
  }
  for (let i = 0; i < 5; i++) {
    out.push(mk(next('b2b'), 'other', `جهة خاصة — ${i}`, {
      decision_owner: 'employer', diagnostic_consent: 'yes', payer_type: 'employer',
      sector: 'private', weekly_load: LOADS[i % 4],
    }, { optionText: { 'QB-M1-001': 'موظف' } }))
  }
  for (let i = 0; i < 5; i++) {
    out.push(mk(next('b2g'), 'other', `جهة حكومية — ${i}`, {
      decision_owner: 'employer', diagnostic_consent: 'yes', payer_type: 'employer',
      sector: 'public', weekly_load: LOADS[(i + 2) % 4],
    }, { optionText: { 'QB-M1-001': 'موظف' } }))
  }

  return out
}

/* متغيرات حتمية لكل شخصية — ٧ صيغ: قاعدة + توليفات مهارات/وقت/وضوح */
const SKILL_POOL = ['analytical_thinking', 'digital_literacy', 'digital_marketing', 'sales', 'project_management', 'leadership_influence', 'public_speaking', 'financial_literacy']

export function buildVariants(spec: PersonaSpec): PersonaSpec[] {
  const variants: PersonaSpec[] = [{ ...spec }]
  const profiles = [2, 3, 4]
  const loads = ['lt_3', '3_4', '5_6', '7_plus']
  for (let v = 0; v < 6; v++) {
    const skillLevels: Record<string, number> = {}
    SKILL_POOL.forEach((s, i) => {
      skillLevels[s] = profiles[(v + i) % 3]
    })
    variants.push({
      ...spec,
      id: spec.id,
      facts: { ...spec.facts, weekly_load: loads[(v + spec.id.length) % 4] },
      skillLevels,
      likertDefault: 2 + (v % 3),
    })
  }
  return variants
}
