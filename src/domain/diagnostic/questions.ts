/* أهلية السؤال ومنفعته واختيار السؤال التالي — حتمي بالكامل */

import { questionBank } from './catalog'
import { REQUIRED_CORE_FACTS, UTILITY_WEIGHTS } from './config'
import { evaluateTrigger, type TriggerContext } from './triggers'
import type {
  BankQuestion,
  Contradiction,
  FactBag,
  PathwayCandidate,
  QuestionUtilityBreakdown,
  UtilityScore,
} from './types'

/** وسوم نطاق الشخصية المستمدة من الحقائق */
export function scopeTags(facts: FactBag): Set<string> {
  const tags = new Set<string>()
  const persona = facts['persona_type']?.value as string | undefined
  const branch = facts['persona_branch']?.value as string | undefined
  const sector = facts['sector']?.value as string | undefined
  const goal = facts['primary_goal']?.value as string | undefined
  const payer = facts['payer_type']?.value as string | undefined
  const owner = facts['decision_owner']?.value as string | undefined

  if (persona === 'student') tags.add('student')
  if (persona === 'early_career') tags.add('graduate')
  if (persona === 'employee' || persona === 'manager') tags.add('employee')
  if (persona === 'employee' && sector === 'public') tags.add('gov_employee')
  if (persona === 'manager' && sector === 'public') tags.add('gov_employee')
  if (persona === 'founder') tags.add('entrepreneur')
  if (persona === 'freelancer') tags.add('freelancer')
  if (branch === 'family') {
    tags.add('parent')
    tags.add('wellbeing')
  }
  if (branch === 'unsure') tags.add('unclear')
  if (goal === 'career_direction') tags.add('career_changer')
  if (payer === 'employer' || owner === 'employer') {
    tags.add('b2b')
    if (sector === 'public') tags.add('b2g')
  }
  return tags
}

export interface EligibilityContext extends TriggerContext {
  askedIds: Set<string>
  mode: 'quick' | 'deep'
  /** مهارات المرشحين الأوائل — أسئلة قياسها (M4) تصبح أهلية حتى في الوضع السريع */
  boostSkillSlugs?: Set<string>
}

export function eligibleQuestions(ctx: EligibilityContext): BankQuestion[] {
  const tags = scopeTags(ctx.facts)
  // بوابة الموافقة: قبل معرفة موقف الموافقة على التشخيص لا يُسأل إلا أسئلة الاستقبال M0
  // (موثق: الموافقة المستنيرة تسبق أي جمع بيانات تشخيصية)
  const consentKnown = ctx.facts['diagnostic_consent'] !== undefined
  return questionBank.filter((q) => {
    if (ctx.askedIds.has(q.question_id)) return false
    if (!consentKnown && q.module_id !== 'M0') return false
    // الوضع السريع: أسئلة core + أسئلة مهارات M4 المرتبطة بالمرشحين الأوائل فقط
    if (ctx.mode === 'quick' && q.required_level !== 'core') {
      const isTargetedSkill =
        q.module_id === 'M4' && q.measures[0] !== undefined && ctx.boostSkillSlugs?.has(q.measures[0])
      if (!isTargetedSkill) return false
    }
    // نطاق الشخصية
    const scope = q.persona_scope ?? ['all']
    if (!scope.includes('all') && !scope.some((s) => tags.has(s))) return false
    // المحفز
    return evaluateTrigger(q.trigger_condition, ctx)
  })
}

const SENSITIVITY_SCORE: Record<string, number> = { low: 0, medium: 0.5, high: 1 }
const COST_BY_TYPE: Record<string, number> = {
  single_choice: 0.2,
  likert_5: 0.2,
  skill_level_5: 0.25,
  multi_choice: 0.35,
  single_choice_or_text: 0.5,
  rank_top3: 0.5,
  short_text: 0.6,
}

function measuresMissingCore(q: BankQuestion, facts: FactBag, extraRequiredFacts: string[]): number {
  const required = [...(REQUIRED_CORE_FACTS as readonly string[]), ...extraRequiredFacts]
  return q.measures.some((m) => required.includes(m) && facts[m] === undefined) ? 1 : 0
}

function measuresContradiction(q: BankQuestion, contradictions: Contradiction[]): number {
  return contradictions.some((c) => !c.resolved && q.measures.some((m) => c.factKeys.includes(m))) ? 1 : 0
}

function measuresTopTwoSeparator(q: BankQuestion, candidates: PathwayCandidate[]): number {
  if (candidates.length < 2) return 0
  const [a, b] = candidates
  if (a.fit.total - b.fit.total >= 0.08) return 0
  // السؤال فاصل إذا كان يقيس حقيقة يختلف عليها المرشحان (هدف/شخصية/عبء/سياق)
  const decisive = [
    'primary_goal', 'persona_type', 'goal_clarity', 'function_specialization', 'sector',
    'leadership_context', 'team_context', 'business_stage', 'offer_clarity', 'revenue_signal',
    'application_readiness', 'public_facing',
  ]
  return q.measures.some((m) => decisive.includes(m)) ? 1 : 0.3
}

/* أولوية فصل أكاديمية بين الأسئلة متعادلة المنفعة (موثق — V2.1 المرحلة 4):
   الحقائق البنيوية (التخصص الوظيفي/القطاع/الهدف/الشخصية) تميز بين المسارات مباشرة،
   وتقدَّم على حقائق السياق، التي تقدَّم على الإشارات المعدِّلة (مثل التعامل مع الجمهور)
   لأن الإشارة المعدِّلة إذا طُرحت أولًا وسّعت الفارق وأطفأت بقية الفواصل قبل جمع دليلها */
const SEPARATOR_FACT_PRIORITY: Record<string, number> = {
  function_specialization: 3,
  sector: 3,
  primary_goal: 3,
  persona_type: 3,
  leadership_context: 2,
  team_context: 2,
  business_stage: 2,
  offer_clarity: 2,
  revenue_signal: 2,
  goal_clarity: 2,
  public_facing: 1,
  application_readiness: 1,
}

function separatorPriority(q: BankQuestion): number {
  return Math.max(0, ...q.measures.map((m) => SEPARATOR_FACT_PRIORITY[m] ?? 0))
}

export function questionUtility(
  q: BankQuestion,
  facts: FactBag,
  contradictions: Contradiction[],
  candidates: PathwayCandidate[],
  extraRequiredFacts: string[] = [],
): QuestionUtilityBreakdown {
  const decisionImpact = Math.min(1, (q.weight ?? 1) / 1.5)
  const uncertaintyReduction = q.measures.filter((m) => facts[m] === undefined).length > 0 ? 0.8 : 0.1
  const tieBreakPower = measuresTopTwoSeparator(q, candidates)
  const contradictionResolution = measuresContradiction(q, contradictions)
  const requiredCoverage = measuresMissingCore(q, facts, extraRequiredFacts)
  const riskReduction = q.sensitivity_level !== 'low' && q.trigger_condition !== 'always' ? 0.6 : 0.2
  /* السؤال الفاصل الحي لا تُخصم كلفة صيغته دون كلفة الاختيار المفرد (موثق — V2.1 المرحلة 4):
     عند تقارب المرشحين (< 8٪) جمع الدليل الفاصل أعلى قيمة من فرق كلفة الصيغة،
     وإلا أُقصيت أسئلة بنيوية متعددة الخيارات (كالتخصص الوظيفي) بسبب الصيغة لا القيمة */
  const rawCost = COST_BY_TYPE[q.answer_type] ?? 0.4
  const answerCost = tieBreakPower === 1 ? Math.min(rawCost, COST_BY_TYPE.single_choice) : rawCost
  const sensitivity = SENSITIVITY_SCORE[q.sensitivity_level] ?? 0.5
  const redundancy = q.measures.every((m) => facts[m] !== undefined) ? 1 : 0

  const total =
    decisionImpact * UTILITY_WEIGHTS.decisionImpact +
    uncertaintyReduction * UTILITY_WEIGHTS.uncertaintyReduction +
    tieBreakPower * UTILITY_WEIGHTS.tieBreakPower +
    contradictionResolution * UTILITY_WEIGHTS.contradictionResolution +
    requiredCoverage * UTILITY_WEIGHTS.requiredCoverage +
    riskReduction * UTILITY_WEIGHTS.riskReduction +
    answerCost * UTILITY_WEIGHTS.answerCost +
    sensitivity * UTILITY_WEIGHTS.sensitivity +
    redundancy * UTILITY_WEIGHTS.redundancy

  return {
    decisionImpact,
    uncertaintyReduction,
    tieBreakPower,
    contradictionResolution,
    requiredCoverage,
    riskReduction,
    answerCost,
    sensitivity,
    redundancy,
    total,
  }
}

/** يرتب الأسئلة الأهلية بالمنفعة؛ التعادل يحسم بأولوية الفصل الأكاديمية ثم بمعرف السؤال أبجديا (حتمية) */
export function rankQuestions(
  questions: BankQuestion[],
  facts: FactBag,
  contradictions: Contradiction[],
  candidates: PathwayCandidate[],
  extraRequiredFacts: string[] = [],
): UtilityScore[] {
  const scored = questions.map((q) => ({
    questionId: q.question_id,
    utility: questionUtility(q, facts, contradictions, candidates, extraRequiredFacts),
    sepPriority: separatorPriority(q),
  }))
  scored.sort(
    (a, b) => b.utility.total - a.utility.total || b.sepPriority - a.sepPriority || a.questionId.localeCompare(b.questionId),
  )
  return scored
}
