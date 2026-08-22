/* محرك التشخيص B2C — V2.1 Final Architecture.
   الرحلة: Current Situation → Goal → Real Need → Domain Discovery → Evidence
           → Standard + Composite Candidates → Differentiation → Recommendation.

   فروق جوهرية عن V2 (موثقة في docs/QUESTION_DECISION_CARDS_AR.md):
   - لا موافقة كسؤال: diagnostic_consent إقرار واجهة قبل البدء — لا سؤال، لا ثقة، لا أثر.
   - لا أسئلة مؤسسية/لغة/ميزانية/سلوك إكمال دورات في B2C أبدًا (Hard Exclusion بالخطة).
   - Career Stage (10) منفصلة عن Employment State (5) — لا school_student ولا parent_guardian.
   - Goal ≠ Need ≠ Domain ≠ Track: الاحتياج هو محرك اكتشاف المجال.
   - دليل المهارة يُسأل مبكرًا عندما يفصل بين مرشحين — بمقياس الدليل لا الثقة بالنفس.
   - القوالب المركبة في فضاء التوصية من البداية — لا تفوز لمجرد احتوائها دورات أكثر.
   حتمي بالكامل: نفس الإجابات → نفس السؤال التالي والنتيجة. */

import { compositeTemplates, launchPathways, optionIdAt, questionById } from '../catalog'
import { detectContradictions } from '../contradictions'
import { buildChangeMakers } from '../explanation'
import { applyDerivedRules, decisionCriticalMissing, reduceAnswer } from '../facts'
import { matchTrainer } from '../instructor-match'
import { buildCoursePlan } from '../composite'
import type { TriggerContext } from '../triggers'
import { DISCLAIMER_AR, WEEKLY_LOAD_ORDER } from '../config'
import type {
  Answer,
  BankQuestion,
  CompositeSelection,
  Contradiction,
  DeepeningComparison,
  DeepeningPlanItem,
  DeepeningSnapshot,
  DiagnosticState,
  NextQuestionResult,
  PathwayCandidate,
  PlanVariant,
  Recommendation,
} from '../types'
import { computeConfidenceV2 } from '../v2/confidence'
import { DOMAIN_CONFIDENCE_MIN } from '../v2/domains'
import { personalizePlan, assessPathwayByCourses, courseLevelOf, type PersonalPlan, type PathwayCourseFit } from './course-fit'
import { catalogCourses } from '../catalog'
import { buildExplanation } from '../v2/explain'
import { buildAdvisorHandoff } from '../v2/handoff'
import { buildSkillStates, personalizationNotes } from '../v2/skills'
import { domainLabelAr, goalDomainsV2, functionDomainsV2 } from '../v2/data'
import type {
  ConfidenceV2,
  DecisionContext,
  DomainAssessment,
  DomainId,
  PathwayEligibility,
  PersonaResult,
  V2Candidate,
} from '../v2/types'
import { planOf } from './data'
import { recommendationUniverse, gateDomainsOf } from './universe'
import { competeEntities, decisiveSkills, appliedHandoffFilter, type CompetitionResult, type EntityCandidate } from './compete'
import {
  goalByCode,
  needByCode,
  stageToPersonaKey,
  goalsForStage,
  needsForStage,
  Q,
  STAGE_NEEDS_EMPLOYMENT_QUESTION,
  RIASEC_DIMS,
  RIASEC_DOMAINS,
  type CareerStage,
  type RiasecDim,
} from './maps'

export const CONFIRMATION_MIN_QUESTIONS = 2
export const CONFIRMATION_MAX_QUESTIONS = 6

/** سياسة التوقف — نفس ثوابت خط الأساس لقابلية المقارنة */
export const V21_STOP = {
  minQuestions: 6,
  targetMin: 8,
  hardCap: 14,
  minOverallConfidence: 0.55,
  strongConfidence: 0.65,
  comfortableMargin: 0.15,
  minSeparation: 0.08,
} as const

/* أوزان أدلة المجال في V2.1 — الاحتياج هو المحرك، الهدف إسهامه أضعف متعمد (Goal ≠ Domain) */
const W_NEED = 1.2
const W_GOAL = 0.8
const W_INTEREST = 0.55
const W_FUNCTION = 0.35
const W_SECTOR_GOV = 0.3
/* كتلة الميول (RIASEC) كلها — دون الهدف (0.8) وفوق الوظيفة (0.35).
   سقفٌ للكتلة لا لكل بعد: ستة أبعاد بوزن مستقل كانت ستطغى على الاحتياج (1.2). */
const W_RIASEC = 0.5
const DOMAIN_CONTEST_MARGIN = 0.15

/** تقييم المجالات V2.1 — الاحتياج أولًا، ثم الهدف، ثم الوظيفة والقطاع */
export function assessDomainsV21(
  facts: DiagnosticState['facts'],
  interestVector: Record<string, number> = {},
): DomainAssessment {
  const scores: Partial<Record<DomainId, number>> = {}
  const add = (id: DomainId, w: number) => {
    scores[id] = (scores[id] ?? 0) + w
  }

  const needCode = facts['need_id']?.value as string | undefined
  const need = needCode ? needByCode(needCode) : undefined
  if (need && need.domains.length > 0) {
    const w = W_NEED / need.domains.length
    need.domains.forEach((d) => add(d, w))
  }

  const goalCode = facts['goal_code_v21']?.value as string | undefined
  const goalDef = goalCode ? goalByCode(goalCode) : undefined
  const legacyGoal = facts['primary_goal']?.value as string | undefined
  /* تعريف V2.1 مرجع عند وجوده — حتى لو كانت مجالاته فارغة عمدًا (مثل «غير متأكد»
     أو «ترقية»): Goal ≠ Domain، والاحتياج هو محرك اكتشاف المجال. جدول V2 القديم
     يُستخدم فقط لجلسات لم تسجّل goal_code_v21 (ترحيل) */
  const goalDomains = goalDef ? goalDef.domains : legacyGoal ? (goalDomainsV2[legacyGoal] ?? []) : []
  if (goalDomains.length > 0) {
    const w = W_GOAL / goalDomains.length
    goalDomains.forEach((d) => add(d, w))
  }

  const fns = facts['function_specialization']?.value
  const fnList = Array.isArray(fns) ? (fns as string[]) : typeof fns === 'string' ? [fns] : []
  for (const f of fnList) {
    const ds = functionDomainsV2[f] ?? []
    const w = ds.length > 0 ? W_FUNCTION / ds.length : 0
    ds.forEach((d) => add(d, w))
  }
  if (facts['sector']?.value === 'public') add('gov_services', W_SECTOR_GOV)

  /* ميول المستكشف (QB-M3E-002) — تغذي قائمة المجالات المختصرة بوزن أدنى من الهدف.
     تُسأل فقط عندما يكون الهدف/الاحتياج غير محسومين، فلا تلوث المستخدم المحسوم */
  const interests = facts['interest_domains']?.value
  const interestList = Array.isArray(interests) ? (interests as string[]) : typeof interests === 'string' ? [interests] : []
  for (const d of interestList) add(d as DomainId, W_INTEREST)

  /* ميول هولاند (M5) — تُسأل فقط للمستكشف (هدف/احتياج غير محسومين)، فلا تلوّث
     المحسوم. كانت إجاباتها تُخزَّن في interestVector ولا يقرؤها أحد: 185 مقعدًا
     في 300 جلسة لا يغيّر أيٌّ منها شيئًا (audit-question-waste). توصيلها هنا
     يجعل للاستكشاف معنى لمن قال «غير متأكد» — وهو أحوج من يحتاج التشخيص.

     الإسهام موجب فقط: صيغة ثقة المجال نسبةٌ (الأول ÷ الأول + الثاني)، والقيم
     السالبة تكسرها. فالنفور لا يخصم — غيابُ الميل يكفي ألا يرجّح.
     والكتلة كلها محدودة بـW_RIASEC موزّعة بالتناسب، فلا يطغى ستة أبعاد على
     الاحتياج مهما ارتفعت درجاتها. */
  const riasecSignal = new Map<RiasecDim, number>()
  let riasecTotal = 0
  for (const dim of RIASEC_DIMS) {
    const score = interestVector[dim]
    if (score === undefined) continue
    /* ليكرت 1..5، والحياد 3 — الإشارة (score-3)/2 في المدى 0..1 للموجب */
    const signal = Math.max(0, (score - 3) / 2)
    if (signal > 0) {
      riasecSignal.set(dim, signal)
      riasecTotal += signal
    }
  }
  if (riasecTotal > 0) {
    for (const [dim, signal] of riasecSignal) {
      const ds = RIASEC_DOMAINS[dim]
      if (ds.length === 0) continue
      const share = (W_RIASEC * signal) / riasecTotal / ds.length
      ds.forEach((d) => add(d, share))
    }
  }

  const hasSignal = Boolean(need || legacyGoal || interestList.length > 0 || riasecTotal > 0)

  const ranked = (Object.entries(scores) as [DomainId, number][])
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([id]) => id)
  const top = ranked[0] ?? null
  const topScore = top ? scores[top]! : 0
  const second = ranked[1] ?? null
  const secondScore = second ? scores[second]! : 0
  const confidence = !hasSignal || topScore === 0 ? 0 : topScore / (topScore + secondScore + 1e-9)
  const contested: [DomainId, DomainId] | null =
    top && second && topScore - secondScore < DOMAIN_CONTEST_MARGIN && secondScore > 0 ? [top, second] : null
  return { scores, ranked, top, confidence, contested }
}

/** اشتقاق شخصية V2.1 — من المرحلة المهنية وحالة العمل مباشرة، حتمي وموثق */
export function derivePersonaV21(facts: DiagnosticState['facts']): PersonaResult {
  const stage = facts['career_stage']?.value as CareerStage | undefined
  const evidence: string[] = []
  if (!stage) return { key: 'unknown', confidence: 0, evidence, isMinor: false }
  evidence.push(`career_stage=${stage}`)
  const ctx = {
    employment_state: facts['employment_state']?.value as string | undefined,
    business_stage: facts['business_stage']?.value as string | undefined,
    sector: facts['sector']?.value as string | undefined,
  }
  if (ctx.employment_state) evidence.push(`employment_state=${ctx.employment_state}`)
  if (ctx.sector) evidence.push(`sector=${ctx.sector}`)
  if (ctx.business_stage) evidence.push(`business_stage=${ctx.business_stage}`)
  const key = stageToPersonaKey(stage, ctx)
  /* غير المحسوم شخصية أولية — لا اختراع يقين */
  const confidence = stage === 'other_unsure' ? 0.5 : ctx.sector === undefined && ['early_career', 'experienced', 'manager', 'senior_manager'].includes(stage) ? 0.8 : 0.9
  return { key, confidence, evidence, isMinor: false }
}

/* ─── تدفق النواة V2.1 — مشروط بالحقائق لا قائمة ثابتة للجميع ─── */
interface CoreStepV21 {
  questionId: string
  neededWhen: (facts: DiagnosticState['facts']) => boolean
  reason_ar: string
}
const has = (facts: DiagnosticState['facts'], k: string) => facts[k] !== undefined

export const CORE_FLOW_V21: CoreStepV21[] = [
  {
    questionId: Q.STAGE,
    neededWhen: (f) => !has(f, 'career_stage'),
    reason_ar: 'المرحلة المهنية أول حقيقة — تفلتر الأهداف والاحتياجات والأسئلة كلها.',
  },
  {
    questionId: Q.EMPLOYMENT,
    neededWhen: (f) => {
      const stage = f['career_stage']?.value as CareerStage | undefined
      return Boolean(stage && STAGE_NEEDS_EMPLOYMENT_QUESTION.includes(stage)) && !has(f, 'employment_state')
    },
    reason_ar: 'حالة العمل منفصلة عن المرحلة — تفصل «أول وظيفة» عن «ترقية».',
  },
  {
    questionId: Q.GOAL,
    neededWhen: (f) => !has(f, 'primary_goal'),
    reason_ar: 'ماذا تريد؟ — الهدف يحدد فضاء المشكلة بخيارات تناسب مرحلتك.',
  },
  {
    questionId: Q.NEED,
    neededWhen: (f) => has(f, 'primary_goal') && !has(f, 'need_id'),
    reason_ar: 'أين المشكلة الفعلية؟ — الاحتياج يكتشف المجال قبل أي مسار.',
  },
  {
    questionId: 'QB-M2-005',
    neededWhen: (f) => has(f, 'primary_goal') && f['primary_goal']?.value !== 'explore' && !has(f, 'goal_clarity'),
    reason_ar: 'وضوح هدفك يقرر: انتقال سريع للأدلة أم استكشاف أعمق.',
  },
  {
    questionId: 'QB-M3C-001',
    neededWhen: (f) => {
      const goal = f['primary_goal']?.value
      const founder = f['career_stage']?.value === 'founder' || f['career_stage']?.value === 'freelancer'
      return (founder || goal === 'business_launch' || goal === 'revenue_growth') && !has(f, 'business_stage')
    },
    reason_ar: 'مرحلة مشروعك تحسم «إطلاق أم نمو» — جوهري للمسار.',
  },
  {
    questionId: 'QB-M3B-001',
    neededWhen: (f) => {
      const stage = f['career_stage']?.value as CareerStage | undefined
      const employed = stage && ['early_career', 'experienced', 'manager', 'senior_manager', 'trainer_ld'].includes(stage)
      return Boolean(employed) && !has(f, 'sector')
    },
    reason_ar: 'القطاع (عام/خاص) يفلتر مسارات حكومية بأكملها.',
  },
  {
    questionId: Q.TIME,
    neededWhen: (f) => !has(f, 'weekly_load'),
    reason_ar: 'وقتك الأسبوعي الواقعي يحدد جدوى الخطة وطولها — لا يحدد المجال.',
  },
]

/* ─── أهلية السؤال في V2.1 — الخطة هي القانون ─── */
export interface QuestionEligibilityCtxV21 extends TriggerContext {
  askedIds: Set<string>
  phase: 'core' | 'adaptive' | 'confirmation'
  stage: CareerStage | null
  compositeAmbiguous: boolean
}

export function isQuestionEligibleV21(q: BankQuestion, ctx: QuestionEligibilityCtxV21): boolean {
  if (ctx.askedIds.has(q.question_id)) return false
  const plan = planOf(q.question_id)
  /* سؤال بلا خطة أو ليس سطحه B2C — لا يُطرح أبدًا (تسرب مؤسسي = مستحيل بنيويًا) */
  if (!plan || plan.surface !== 'b2c') return false
  /* أهلية المرحلة — صارمة */
  if (plan.stages !== 'all' && ctx.stage && !plan.stages.includes(ctx.stage)) return false
  if (plan.stages !== 'all' && !ctx.stage) return false
  /* سؤال الإتقان/المنظومة مشروط بغموض قياسي/مركب فعلي */
  if (q.question_id === Q.MASTERY && !ctx.compositeAmbiguous) return false
  /* مرحلة السؤال */
  if (ctx.phase === 'core' && plan.phase !== 'core') return false
  if (ctx.phase === 'adaptive' && plan.phase === 'core') return false
  if (ctx.phase === 'confirmation' && plan.phase === 'none') return false
  return true
}

/* ─── التوجيه التكيفي V2.1 ─── */
export interface AdaptiveScoreV21 {
  questionId: string
  utility: number
  reason_ar: string
  components: Record<string, number>
}

const CONTEXT_FACTS = ['sector', 'leadership_context', 'function_specialization', 'public_facing', 'business_stage', 'offer_clarity', 'revenue_signal', 'team_context']

const COST_BY_TYPE: Record<string, number> = {
  single_choice: 0.2,
  likert_5: 0.2,
  skill_level_5: 0.25,
  multi_choice: 0.35,
  single_choice_or_text: 0.5,
  rank_top3: 0.5,
  short_text: 0.6,
}
const SENSITIVITY: Record<string, number> = { low: 0, medium: 0.5, high: 1 }

export function scoreAdaptiveQuestionV21(
  q: BankQuestion,
  facts: DiagnosticState['facts'],
  contradictions: Contradiction[],
  ctx: DecisionContext,
  candidates: V2Candidate[],
  decisive?: Map<string, number>,
  criticalFacts?: Set<string>,
  lateEvidence = false,
): AdaptiveScoreV21 {
  const plan = planOf(q.question_id)!
  const measures = q.measures.filter((m) => m !== 'skill_vector' && m !== 'interest_vector' && m !== 'work_style_vector')
  const margin = candidates.length >= 2 ? candidates[0].total - candidates[1].total : 1

  /* ١) سياق حاسم مفقود: حقائق القرار للمجموعة المعقولة (criticalFactsOf: مطلوبة +
     إشارات + استبعادات + محاذاة وظيفة/قطاع/قيادة) — إصلاح أسلاك موثق: حقيقة يتوقف
     عليها فوز مرشح معقول ولا تُنتجها أي إجابة مُعطاة بعد يجب أن ترفع أولوية
     سؤالها، وإلا تعمل بوابة تغطية الأدلة في فحص الفوز ضد مرشح لم تُتح له فرصة
     جمع دليله أصلًا.
     المرحلة 4 (أسئلة المهارات للفصل لا للتعزيز): سؤال قياس مهارة لا يأخذ دفعة
     «الحقيقة الحاسمة» في سباق مريح الهامش إلا إذا كانت المهارة حقيقة مطلوبة
     لمتحدٍّ مركب من الصدارة — فوز المركب يتوقف بنيويًا على تغطيتها (بوابة 0.8)،
     فقياسها هنا فصلٌ مشروع لا تعزيز لمتصدر قياسي مرتاح. */
  const isSkillQuestion = plan.layer21 === 'evidence_skill'
  const compositeCriticalFacts = new Set<string>()
  if (isSkillQuestion && criticalFacts && margin >= 0.15) {
    for (const c of candidates.slice(0, 3)) {
      /* المتحدي المركب الحي فقط — ضمن هامش الفصل من المتصدر. مركب بعيد في
         سباق مريح لا يبرر استهلاك مقعد لجمع دليله (تعزيز مقنّع) */
      if (candidates[0] && candidates[0].total - c.total >= 0.15) continue
      const ent = recommendationUniverse().byId.get(c.pathwayId)
      if (ent?.entity_type === 'composite') {
        for (const rf of ent.required_facts) if (rf.importance !== 'optional') compositeCriticalFacts.add(rf.fact_key)
      }
    }
  }
  /* الطبقة الأولى — حقيقة مطلوبة (غير اختيارية) لأحد مرشحي الصدارة الحاليين:
     أولوية قصوى، لأن فحص الفوز ضد مرشح لم تُتح له فرصة جمع دليله حسمٌ غير عادل */
  const missingContext = measures.some((m) => {
    if (facts[m] !== undefined) return false
    if (!criticalFacts?.has(m)) return false
    if (!isSkillQuestion) return true
    return margin < 0.15 || compositeCriticalFacts.has(m)
  })
    ? 1
    : 0
  /* الطبقة الثانية — سياق عام من القائمة الثابتة لا يتطلبه أي مرشح من الصدارة:
     مفيد لكنه دون أدلة الفصل والحقائق المطلوبة. موثق (إغلاق منطق V2.1): رحلة
     «موظف بداية + هدف ذكاء اصطناعي» بلغت السقف الصلب 14 وأسئلة M3B الروتينية
     تأكل المقاعد بوزن 1.0 بينما ظلت ai_literacy الحاسمة للمتصدر بلا قياس رغم
     هامش 0.000 — فوقعت النتيجة تحت حارس الصمت. السياق العام لا يمنح وزن الحقيقة
     المطلوبة بعد الآن، فيتقدم عليه فصل المهارات (0.9) وحد الدليل الأدنى (0.85) */
  const genericContext =
    missingContext === 0 && measures.some((m) => facts[m] === undefined && CONTEXT_FACTS.includes(m) && !criticalFacts?.has(m))
      ? 1
      : 0

  /* ٢) غموض المجال — سؤال يخدم مجالًا متنازعًا عليه */
  const domainUncertainty =
    ctx.domains.confidence < DOMAIN_CONFIDENCE_MIN && plan.domains.length > 0 &&
    (plan.domains.includes(ctx.domains.top as DomainId) ||
      (ctx.domains.contested && plan.domains.includes(ctx.domains.contested[1])))
      ? 1
      : 0

  /* ٣) فصل المرشحين بدليل مهارة — الأولوية لقيمة الفصل (decisive_unmeasured_skills)،
        لا لامتلاك المتصدر المهارة: كسر الدائرية موثق في البند 11.
        المرحلة 4: الفصل يُحسب في السباق الحي فقط (هامش < 0.15) — في سباق مريح
        لا يمكن لدليل مهارة أن يقلب النتيجة، فقياسها هناك تعزيز لا فصل */
  const skillSlug = q.measures[0]
  const sepVal = decisive?.get(skillSlug) ?? 0
  const evidenceSeparation = plan.layer21 === 'evidence_skill' && sepVal > 0 && margin < 0.15 ? sepVal : 0

  /* ٤) تغطية دليل — مهارة متطلبة للمتصدر ولم تُقس لكنها لا تفرّق بين المرشحين.
        المرحلة 4: سباق مريح الهامش لا يحتاج تغطية إضافية للمتصدر (تعزيز مقنّع) —
        تُحسب في السباق الحي فقط أسوة بالمكوّنين ٣ و٤ب */
  const top1Unknown = candidates[0] ? new Set(candidates[0].unknownSkillSlugs) : new Set<string>()
  const evidenceCoverage =
    plan.layer21 === 'evidence_skill' && sepVal === 0 && top1Unknown.has(skillSlug) && margin < 0.15 ? 1 : 0

  /* ٤ب) حد الدليل الأدنى المتمايز (موثق — المرحلة 4): في الجولات المتأخرة فقط
     (lateEvidence = بعد بلوغ targetMin + 2) وفي سباق حي فقط (هامش < 0.15):
     مهارة حاسمة للمتصدر ما زالت مجهولة والفارق ضيق بما يمكن معه لدليل المهارة
     أن يقلب النتيجة، فيرتفع سؤال قياسها فوق الروتين ويبقى دون الحقائق
     المطلوبة (missingContext). سباق مريح الهامش لا يعتمد على المهارات أصلًا
     فلا تُستهلك ميزانيته (البند: أسئلة المهارات للفصل لا للتعزيز).
     إغلاق منطق V2.1: بوابة «كل الحاسمات مجهولة» كانت تسكت متى قيست حاسمة
     واحدة — فبقيت negotiation بلا قياس في رحلة FREELANCE رغم ضيق الهامش
     ووجود QB-M4-013. الصيغة: السؤال يقيس حاسمة مجهولة للمتصدر — يكفي */
  const topEntity = candidates[0] ? recommendationUniverse().byId.get(candidates[0].pathwayId) : undefined
  const topDecisive = topEntity?.skill_roles.decisive ?? []
  const unsureExplore = facts['primary_goal']?.value === 'explore' || facts['need_id']?.value === 'need_unsure'
  const minimumEvidence =
    lateEvidence &&
    margin < 0.15 &&
    plan.layer21 === 'evidence_skill' &&
    !unsureExplore &&
    topDecisive.length > 0 &&
    topDecisive.includes(skillSlug) &&
    top1Unknown.has(skillSlug)
      ? 1
      : 0

  /* ٥) تناقض قائم */
  const contradiction = contradictions.some((c) => !c.resolved && c.factKeys.some((fk) => q.measures.includes(fk))) ? 1 : 0

  /* ٦) استكشاف الميول — فقط عندما الهدف/الاحتياج غير محسومين.
     M5 (RIASEC) + QB-M3E-002 (قائمة الميول → مجالات) + QB-M3E-004 (دليل التجربة) */
  const unsureNow = facts['primary_goal']?.value === 'explore' || facts['need_id']?.value === 'need_unsure'
  const exploratory =
    unsureNow && (q.module_id === 'M5' || q.measures.includes('interest_shortlist') || q.measures.includes('exploration_evidence'))
      ? 1
      : 0

  const cost = COST_BY_TYPE[q.answer_type] ?? 0.4
  const sensitivity = SENSITIVITY[q.sensitivity_level] ?? 0.5
  const redundancy = measures.length > 0 && measures.every((m) => facts[m] !== undefined) ? 1 : 0
  const skillKnown = q.answer_type === 'skill_level_5' && facts['__sv__'] === undefined && false // الحالة تُفحص في الأهلية

  const utility =
    missingContext * 1.0 +
    domainUncertainty * 0.9 +
    evidenceSeparation * 0.9 +
    minimumEvidence * 0.85 + // متأخر فقط (lateEvidence) — دون الحقائق المطلوبة (1.0) وفوق الروتين، بلا أولوية مطلقة
    contradiction * 0.65 +
    exploratory * 0.6 +
    genericContext * 0.5 + // سياق عام لا تتطلبه الصدارة — فوق الروتين ودون أدلة الفصل
    /* إغلاق منطق V2.1: رُفعت تغطية الدليل من 0.35 إلى 0.55 لتسبق السياق العام —
       رحلة FREELANCE انتهت بnegotiation مجهولة رغم سباق 0.008 لأن أسئلة سياق
       عامة (0.5) تقدمت على قياس حاسمة المتصدر (0.35). في سباق حي، قياس حاسمة
       المتصدر أثمن قراريًا من أي سياق عام، ويبقى دون الحقائق الحاسمة (1.0) */
    evidenceCoverage * 0.55 +
    (measures.some((m) => facts[m] === undefined) || q.answer_type === 'skill_level_5' ? 0.25 : 0) +
    cost * -0.12 +
    sensitivity * -0.1 +
    redundancy * -1.0 +
    (skillKnown ? -1 : 0)

  const reasons: [string, number][] = [
    ['يكمل سياقًا حاسمًا للقرار', missingContext],
    ['يفصل غموض المجال', domainUncertainty * 0.9],
    ['يفصل بين المرشحين المتصدرين بدليل مهارة', evidenceSeparation * 0.9],
    ['يقيس مهارة حاسمة للمتصدر قبل أي اكتفاء', minimumEvidence * 0.8],
    ['يحسم تناقضًا قائمًا', contradiction * 0.65],
    ['يستكشف ميولك لأن الهدف غير محسوم', exploratory * 0.6],
    ['يستكمل سياقك العام', genericContext * 0.5],
    ['يقيس مهارة يتطلبها المرشح المتصدر', evidenceCoverage * 0.55],
  ]
  const top = reasons.sort((a, b) => b[1] - a[1])[0]
  const reason_ar = top && top[1] > 0 ? `فاز أساسًا بسبب: ${top[0]}.` : 'يكمل الصورة العامة.'

  return {
    questionId: q.question_id,
    utility,
    reason_ar,
    components: { missingContext, genericContext, domainUncertainty, evidenceSeparation, minimumEvidence, contradiction, exploratory, evidenceCoverage, cost, sensitivity, redundancy },
  }
}

export function rankAdaptiveQuestionsV21(
  questions: BankQuestion[],
  facts: DiagnosticState['facts'],
  contradictions: Contradiction[],
  ctx: DecisionContext,
  candidates: V2Candidate[],
  decisive?: Map<string, number>,
  criticalFacts?: Set<string>,
  lateEvidence = false,
): AdaptiveScoreV21[] {
  const scored = questions.map((q) => scoreAdaptiveQuestionV21(q, facts, contradictions, ctx, candidates, decisive, criticalFacts, lateEvidence))
  scored.sort((a, b) => b.utility - a.utility || a.questionId.localeCompare(b.questionId))
  return scored
}

/** توصية V2.1 = توصية V2 + معرفات النسخ الموثقة */
export type RecommendationV21 = Recommendation & {
  /** الخطة المشخصنة — مقررات الفائز مقيسة كلٌّ على مهاراته، مع ما استُبدل منها.
      إضافةٌ لا تغيير: منافسة المسارات تبقى كما هي، والتشخيص يقع داخل الفائز. */
  personalPlan?: PersonalPlan
  /** المسار كما صُمم — يُعرض خيارا ثانيا حين شخصنّا الخطة الأولى */
  originalPlan?: PathwayCourseFit
  /** بديل واحد متباين مع سبب تباينه — لا قائمة مرتّبة بلا معنى */
  alternativeContrast_ar?: string
  v2?: {
    explanation: unknown
    confidence: ConfidenceV2
    eligibility: PathwayEligibility[]
    advisorHandoff?: unknown
    versions: { engine: string; question_plan: string; question_bank: string; catalog: string; skill_taxonomy: string }
  }
}


/* ─── البديل المتباين ─── */

/** متوسط موضع مقررات المسار على سلّم المستوى — لوصف التباين لا لتقييمه */
function meanCourseLevel(pathwayId: string): number {
  const cs = catalogCourses.filter((c) => c.pathway_id === pathwayId)
  if (cs.length === 0) return 1
  const ord: Record<string, number> = { foundational: 0, foundational_applied: 1, applied: 2, practitioner: 3 }
  return cs.reduce((sum, c) => sum + (ord[courseLevelOf(c)] ?? 1), 0) / cs.length
}
function totalHoursOf(pathwayId: string): number {
  return catalogCourses.filter((c) => c.pathway_id === pathwayId).reduce((s, c) => s + c.total_hours, 0)
}

/** لماذا هذا البديل مختلف — نصٌّ يقرؤه المتعلم، وnull إن لم يختلف اختلافا مفيدا.
    بديلٌ لا يختلف عن الأول إلا بالترتيب لا يستحق مقعدا على الشاشة. */
function contrastOf(primaryId: string, altId: string): string | null {
  const dh = totalHoursOf(altId) - totalHoursOf(primaryId)
  const dl = meanCourseLevel(altId) - meanCourseLevel(primaryId)
  if (dh <= -8) return 'أقصر — ساعات أقل إن كان وقتك أضيق'
  if (dl <= -0.5) return 'أكثر تأسيسا — يبدأ من قاعدة أوسع'
  if (dl >= 0.5) return 'أكثر تقدما — إن كنت تريد سقفا أعلى'
  if (dh >= 8) return 'أوسع — ساعات أكثر وتغطية أشمل'
  return null
}

export class DiagnosticEngineV21 {
  private state: DiagnosticState
  private confirmation: {
    started: boolean
    completed: boolean
    plan: DeepeningPlanItem[]
    cursor: number
    before: DeepeningSnapshot | null
  } = { started: false, completed: false, plan: [], cursor: 0, before: null }

  constructor(sessionId?: string) {
    this.state = {
      sessionId: sessionId ?? `dg21-${Date.now()}`,
      startedAt: new Date().toISOString(),
      answers: [],
      askedQuestionIds: [],
      facts: {},
      factsRaw: {},
      skillVector: {},
      interestVector: {},
      contradictions: [],
      /* الموافقة إقرار واجهة قبل البدء (صفحة التشخيص) — ليست سؤالًا في المحرك أبدًا */
      consentGiven: true,
      minorFlag: false,
      guardrailStop: null,
      trace: [],
    }
    this.traceEntry('consent_ui_ack', 'الموافقة سُجّلت كإقرار واجهة قبل بدء التشخيص — لا تُحسب سؤالًا ولا تدخل الثقة ولا تغيّر التوصية.')
  }

  getState(): DiagnosticState {
    return this.state
  }

  seedFacts(facts: DiagnosticState['facts'], sourceLabel_ar: string) {
    const seeded: string[] = []
    for (const [key, fact] of Object.entries(facts)) {
      if (this.state.facts[key]) continue
      this.state.facts[key] = fact
      if (fact.raw) this.state.factsRaw[key] = fact.raw
      seeded.push(key)
    }
    if (seeded.length > 0) {
      this.traceEntry('facts_seeded', `حقائق منقولة من ${sourceLabel_ar}: ${seeded.length} — لن تُسأل مجددًا.`, {
        source: sourceLabel_ar,
        factKeys: seeded,
      })
    }
  }

  private traceEntry(kind: DiagnosticState['trace'][number]['kind'], summary_ar: string, data?: Record<string, unknown>) {
    this.state.trace.push({ step: this.state.trace.length + 1, kind, summary_ar, data })
  }

  private decisionContext(): DecisionContext {
    const persona = derivePersonaV21(this.state.facts)
    const domains = assessDomainsV21(this.state.facts, this.state.interestVector)
    const skillStates = buildSkillStates(this.state.skillVector)
    return { facts: this.state.facts, persona, domains, skillStates }
  }

  private stage(): CareerStage | null {
    return (this.state.facts['career_stage']?.value as CareerStage | undefined) ?? null
  }

  private triggerContext(confidenceTotal = 0.5): TriggerContext {
    return {
      facts: this.state.facts,
      confidenceTotal,
      askedCount: this.state.askedQuestionIds.length,
      topTwoMargin: null,
      recommendationGenerated: false,
      recommendationRejected: false,
      userRequestedDeep: false,
      sensitiveAnswersPresent: Object.values(this.state.facts).some(
        (f) => questionById.get(f.sourceQuestionId)?.sensitivity_level === 'high',
      ),
    }
  }

  /** المنافسة الموحدة — المصدر الوحيد للأهلية والترتيب لكل الكيانات (قياسي + مركب) */
  private eligibilityAndCandidates(ctx: DecisionContext): { eligibility: PathwayEligibility[]; candidates: V2Candidate[]; comp: CompetitionResult } {
    const comp = competeEntities(this.state.facts, ctx)
    const eligibility: PathwayEligibility[] = comp.eligibility.map((e) => ({
      pathwayId: e.entityId,
      eligible: e.eligible,
      excludedReasons_ar: e.excludedReasons_ar,
    }))
    return { eligibility, candidates: comp.candidates.map(toV2Candidate), comp }
  }

  /** مهارات الفصل غير المقيسة بين مرشحي الصدارة — قيمة الفصل لا التعزيز (البند 11) */
  private decisiveMap(comp: CompetitionResult, ctx: DecisionContext): Map<string, number> {
    return new Map(decisiveSkills(comp.candidates, ctx.skillStates).filter((d) => !d.measured).map((d) => [d.slug, d.separationValue]))
  }

  /** حقائق القرار للمجموعة المعقولة — المصدر الوحيد لوزن «السياق الحاسم».
     المعقول = أول 3 أو ضمن 0.20 من المتصدر. لكل مرشح معقول نجمع كل حقيقة
     تغيّر فوزه فعلًا: المطلوبة غير الاختيارية، إشاراته الموجبة والسالبة،
     شروط استبعاده، وحقول المحاذاة (وظيفة/قطاع/مرحلة عمل/سياق قيادي) عندما
     يعلن قوائم لها. موثق (إغلاق منطق V2.1): قصر الحرج على «مطلوبة أول 3»
     حرم مركبًا معقولًا من سؤال الوظيفة الذي يفتح بوابة تعدد المجالات،
     فخسر TPL-STRATEGY/TPL-B2B بلا دليل؛ وفي المقابل منح القائمة الثابتة
     وزن 1.0 لكل سياق أكل مقاعد قياس ai_literacy الحاسمة (رحلة FND-003).
     القاعدة: لا وزن كاملًا إلا لحقيقة يرتبط بها فوز مرشح معقول فعلًا */
  private criticalFactsOf(comp: CompetitionResult, ctx: DecisionContext): Set<string> {
    const out = new Set<string>()
    const top = comp.candidates[0]?.netFit ?? 0
    const activeDomains = gateDomainsOf(this.state.facts, ctx.domains)
    const plausible = comp.candidates.filter((c, i) => i < 3 || top - c.netFit < 0.2)
    for (const c of plausible) {
      /* مركب لا يستطيع الفوز بنيويًا في هذه الجلسة — مجالاته المغطاة من حاجة
         المستخدم أقل من اثنين وهو ليس في سباق الفوز المباشر: حقائقه المطلوبة
         وإشاراته لا تُمنح وزن القرار الآن (موثق: TPL-DIGITAL-TRANSFORM ظل
         معقولًا بحساب المسافة في رحلة موظف AI مبكر، فأكلت حقائقه الثمانية
         المقاعد حتى السقف الصلب رغم استحالة اجتيازه بوابة تعدد المجالات).
         نُبقي فقط «فاتح البوابة»: سؤال الوظيفة إن كان يعلن وظائف — إجابته
         قد تصرّح بمجال ثانٍ يعيده إلى المنافسة، فيعود عندها بكامل حقائقه */
      if (c.entity.entity_type === 'composite') {
        const covered = c.entity.domains.filter((d) => activeDomains.includes(d))
        const nearLeader = top - c.netFit < 0.05
        if (covered.length < 2 && !nearLeader) {
          if (c.entity.functions.length > 0) out.add('function_specialization')
          continue
        }
      }
      for (const rf of c.entity.required_facts) {
        if (rf.importance !== 'optional') out.add(rf.fact_key)
      }
      for (const s of [...(c.entity.positive_signals ?? []), ...(c.entity.negative_signals ?? [])]) out.add(s.fact_key)
      for (const h of c.entity.hard_exclusions ?? []) out.add(h.condition.fact_key)
      if (c.entity.functions.length > 0) out.add('function_specialization')
      if (c.entity.sectors.length > 0) out.add('sector')
      if (c.entity.business_stages.length > 0) out.add('business_stage')
      if (c.entity.leadership_context.length > 0) out.add('leadership_context')
    }
    return out
  }

  /** لقطة منافسة كاملة للتدقيق والاختبارات والمحاكاة — للقراءة فقط، حتمية من الحالة الحالية */
  competeSnapshot(): CompetitionResult {
    return this.eligibilityAndCandidates(this.decisionContext()).comp
  }

  /** غموض قياسي/مركب فعلي — شرط سؤال الإتقان/المنظومة: مركب مؤهل قريب من أفضل قياسي */
  private compositeAmbiguity(comp: CompetitionResult): boolean {
    if (this.state.facts['mastery_portfolio_pref'] !== undefined) return false
    const { bestStandard, bestComposite } = comp
    if (!bestStandard || !bestComposite) return false
    return Math.abs(bestComposite.fit - bestStandard.fit) < 0.15
  }

  /* سؤال حد الدليل الأدنى: في سباق حي فقط (هامش أول اثنين < 0.15) — هنا يمكن
     لدليل المهارة أن يقلب النتيجة فعلًا. يجمع المهارات الحاسمة المجهولة كليًا
     لدى مرشحي الصدارة الثلاثة في مجموعة أهداف واحدة، ثم يختار أعلى سؤال مرتّب
     يقيس أيًّا منها. سباق مريح الهامش لا يعتمد على المهارات فلا يُقاس لأجله شيء */
  private minimumEvidenceQuestion(
    comp: CompetitionResult,
    ranked: AdaptiveScoreV21[],
    due: boolean,
  ): AdaptiveScoreV21 | null {
    if (!due) return null
    const margin = comp.candidates.length >= 2 ? comp.candidates[0].netFit - comp.candidates[1].netFit : 1
    if (margin >= 0.15) return null
    const targets = new Set<string>()
    /* إغلاق منطق V2.1: الصدارة الثلاثة ضيقة جدًا — الفائز النهائي في الجلسات
       الصامتة الثماني كان رابعًا وقت الإنقاذ (هامش 0.099)، فقِيست حاسمات من
       سبقوه ثم قفز هو للصدارة بلا دليل. المجموعة العادلة: كل مرشح ضمن هامش
       حي (0.15) من المتصدر هو فائز محتمل، وحاسمته المجهولة هدف مشروع —
       بسقف ستة مرشحين حتى لا تذوب الأولوية */
    const topNet = comp.candidates[0]?.netFit ?? 0
    const plausible = comp.candidates.filter((c, i) => i < 6 && topNet - c.netFit < 0.15)
    for (const cand of plausible) {
      const decisiveSlugs = cand.entity.skill_roles.decisive
      if (decisiveSlugs.length === 0) continue
      /* إغلاق منطق V2.1: بوابة «every مجهولة» كانت تتخطى مرشحًا قيست إحدى
         حاسمتيه وبقيت الأخرى بلا قياس رغم وجود سؤال نشط يقيسها — فانتهت رحلة
         FREELANCE بnegotiation مجهولة في سباق 0.008 رغم أن QB-M4-013 متاح.
         الصيغة المُحكَّمة: أي مهارة حاسمة مجهولة قابلة للقياس تدخل الأهداف —
         قياسها أرخص وأصدق من إحالة مستشار كان يمكن الاستغناء عنها */
      const unknownDecisive = decisiveSlugs.filter((s) => cand.skills.unknownSkillSlugs.includes(s))
      for (const s of unknownDecisive) targets.add(s)
    }
    if (targets.size === 0) return null
    return (
      ranked.find((r) => {
        const q = questionById.get(r.questionId)
        return q?.answer_type === 'skill_level_5' && targets.has(q.measures[0])
      }) ?? null
    )
  }

  /* ─── السؤال التالي ─── */
  nextQuestion(): NextQuestionResult {
    const askedCount = this.state.askedQuestionIds.length
    if (this.state.guardrailStop) {
      return { question: null, utility: null, stop: { shouldStop: true, reason_ar: this.state.guardrailStop, askedCount } }
    }
    if (this.confirmation.started && !this.confirmation.completed) return this.nextConfirmationQuestion()
    if (this.confirmation.completed) {
      return { question: null, utility: null, stop: { shouldStop: true, reason_ar: 'اكتملت جولة التأكيد.', askedCount } }
    }
    if (askedCount >= V21_STOP.hardCap) {
      const stop = {
        shouldStop: true,
        reason_ar: 'بلغنا الحد الأقصى للأسئلة (١٤) — نبني نتيجتك بما جمعناه، وإن لم تكفِ الأدلة نحيلك لمستشار.',
        askedCount,
      }
      this.traceEntry('stop_evaluated', stop.reason_ar, { askedCount, hardCap: true })
      return { question: null, utility: null, stop }
    }

    const ctx = this.decisionContext()
    const askedIds = new Set(this.state.askedQuestionIds)
    const stage = this.stage()

    /* ١) نواة التدفق المشروطة */
    for (const step of CORE_FLOW_V21) {
      if (askedIds.has(step.questionId)) continue
      if (!step.neededWhen(this.state.facts)) continue
      const q = questionById.get(step.questionId)
      if (!q) continue
      const eligible = isQuestionEligibleV21(q, {
        ...this.triggerContext(),
        askedIds,
        phase: 'core',
        stage,
        compositeAmbiguous: false,
      })
      if (!eligible) continue
      const question = this.withStageFilteredOptions(q, stage)
      this.traceEntry('question_selected', `نواة — ${q.question_id}: ${q.text_ar}`, { core: true, winnerReason_ar: step.reason_ar })
      return { question, utility: null, stop: { shouldStop: false, reason_ar: 'نبني صورتك الأساسية.', askedCount } }
    }

    /* ٢) التوجيه التكيفي */
    const { candidates, comp } = this.eligibilityAndCandidates(ctx)
    const confidence = computeConfidenceV2(this.state.facts, this.state.contradictions, ctx, candidates)
    const compositeAmbiguous = this.compositeAmbiguity(comp)
    const trigCtx = this.triggerContext(confidence.overall)
    trigCtx.topTwoMargin = candidates.length >= 2 ? candidates[0].total - candidates[1].total : null
    const decisive = this.decisiveMap(comp, ctx)
    const criticalFacts = this.criticalFactsOf(comp, ctx)

    const eligible = [...questionById.values()].filter((q) => {
      if (!isQuestionEligibleV21(q, { ...trigCtx, askedIds, phase: 'adaptive', stage, compositeAmbiguous })) return false
      /* لا سؤال يُعرف جوابه */
      if (q.answer_type === 'skill_level_5') return this.state.skillVector[q.measures[0]] === undefined
      const measures = q.measures.filter((m) => m !== 'skill_vector' && m !== 'interest_vector')
      if (q.module_id === 'M5') return this.state.interestVector[q.measures[0]] === undefined
      return measures.some((m) => this.state.facts[m] === undefined)
    })
    const ranked = rankAdaptiveQuestionsV21(eligible, this.state.facts, this.state.contradictions, ctx, candidates, decisive, criticalFacts, askedCount >= V21_STOP.targetMin + 2)
    const best = ranked[0]
    const hasDecisionQuestion = ranked.some(
      (r) => r.components.missingContext > 0 || r.components.domainUncertainty > 0 || r.components.evidenceSeparation > 0 || r.components.contradiction > 0,
    )
    const hasDomainSeparator = ranked.some((r) => r.components.domainUncertainty > 0)

    const stop = this.evaluateStop(askedCount, ctx, candidates, confidence, hasDecisionQuestion, hasDomainSeparator)

    /* عدالة الدليل عند التوقف (موثق — المرحلة 4):
       ١) متحدٍّ مركب حي (ضمن 0.15 من أفضل قياسي) تنقصه حقيقة مطلوبة منتَجة —
          لا توقف قبل منحه فرصة جمع دليله، وإلا حُسم السباق لصالح من اكتمل دليله
          لا لصالح الأجدر (انزياح TPL-STRATEGY الموثق).
       ٢) حد الدليل الأدنى — مرشحو الصدارة بلا أي مهارة حاسمة مقاسة:
          يُسأل سؤال دليل واحد بدل إنهاء صامت */
    /* الإنقاذ يعمل عند التوقف وعند اقتراب السقف الصلب (آخر مقعدين) — موثق:
       رحلات وصلت 14/14 وأفضل مركب منافس ناقصه سؤال واحد منتَج بينما ذهبت
       المقاعد الأخيرة لأسئلة أقل قيمة قرارية (حالة TPL-SMART-OPS) */
    if ((stop.shouldStop || askedCount >= V21_STOP.hardCap - 2) && askedCount < V21_STOP.hardCap) {
      const bestStd = comp.bestStandard
      /* إغلاق منطق V2.1: أرضية الدليل تسبق عدالة المتحدين في السباق الحي —
         8 جلسات مونت كارلو (20260818/10k) بلغت السقف وفائزوها (PW-NEG/PW-MKT)
         بحاسمتهم مجهولة: كان الفائز النهائي ثانيًا/ثالثًا وقت الإنقاذ، فالتهمت
         حقائق المتحدين (QB-M4-011 لصالح مركب) مقاعد قياس حاسمته (QB-M4-013/016).
         الحد الأدنى يجمع حاسمات الصدارة الثلاثة المجهولة كلها، فيقيس دليلًا
         يخدم الفائز المحتمل أيًّا كان — أسبق من فرصة متحدٍّ إضافية */
      const floorFirst = this.minimumEvidenceQuestion(comp, ranked, true)
      if (floorFirst) {
        const question = questionById.get(floorFirst.questionId)!
        this.traceEntry('question_selected', `أرضية الدليل — ${question.question_id}: ${question.text_ar}`, {
          winner: question.question_id,
          winnerReason_ar: 'مهارة حاسمة لأحد مرشحي الصدارة ما زالت مجهولة في سباق حي — قياسها يسبق منح المتحدين فرصًا إضافية.',
          utility: floorFirst.utility,
          utilityComponents: floorFirst.components,
        })
        return { question, utility: null, stop: { shouldStop: false, reason_ar: 'نقيس مهارة حاسمة للصدارة قبل الاكتفاء.', askedCount } }
      }
      /* كل مركب منافس شرعي (ضمن 0.15 من أفضل قياسي ويجتاز البوابتين البنيويتين)
         يستحق فرصة إكمال دليله قبل الاكتفاء — لا الأعلى صافًا فقط. موثق (إغلاق
         منطق V2.1): TPL-SMART-OPS كان متقدمًا على أفضل قياسي بصافيه لكنه ثالث
         الترتيب، فلم يشمله إنقاذ «المتحدي الأعلى» وتوقفت الجلسة بتغطية 0.5 —
         حُسم السباق لصالح من اكتمل دليله لا لصالح الأجدر */
      const activeDoms = gateDomainsOf(this.state.facts, ctx.domains)
      const bestStdDoms = bestStd?.entity.domains ?? []
      const challengers = bestStd
        ? comp.candidates.filter((c) => {
            if (c.entity.entity_type !== 'composite') return false
            if (bestStd.netFit - c.netFit >= 0.15) return false
            const covered = c.entity.domains.filter((d) => activeDoms.includes(d))
            return covered.length >= 2 && covered.some((d) => !bestStdDoms.includes(d))
          })
        : []
      let fairnessAsked = false
      for (const challenger of challengers) {
        const missingKeys = challenger.entity.required_facts
          .filter((rf) => rf.importance !== 'optional')
          .map((rf) => rf.fact_key)
          .filter((k) => this.state.facts[k] === undefined && ctx.skillStates.get(k)?.state !== 'measured')
        const challengerQ =
          missingKeys.length > 0
            ? ranked.find((r) => {
                const q = questionById.get(r.questionId)
                return q !== undefined && q.measures.some((m) => missingKeys.includes(m))
              })
            : undefined
        if (challengerQ) {
          const question = questionById.get(challengerQ.questionId)!
          this.traceEntry('question_selected', `عدالة الدليل — ${question.question_id}: ${question.text_ar}`, {
            winner: question.question_id,
            winnerReason_ar: `خطة مركبة منافسة (${challenger.entity.entity_id}) تنقصها حقيقة مطلوبة — تُمنح فرصة الدليل قبل الاكتفاء.`,
            utility: challengerQ.utility,
            utilityComponents: challengerQ.components,
          })
          fairnessAsked = true
          return { question, utility: null, stop: { shouldStop: false, reason_ar: 'نمنح الخطة المركبة المنافسة فرصة إكمال دليلها.', askedCount } }
        }
      }
      if (!fairnessAsked) {
        const rescue = this.minimumEvidenceQuestion(comp, ranked, true)
        if (rescue) {
          const question = questionById.get(rescue.questionId)!
          this.traceEntry('question_selected', `حد الدليل الأدنى — ${question.question_id}: ${question.text_ar}`, {
            winner: question.question_id,
            winnerReason_ar: 'مهارة حاسمة للمرشح المتصدر ما زالت مجهولة — لا توصية بلا أي دليل مهاري مقاس.',
            utility: rescue.utility,
            utilityComponents: rescue.components,
          })
          return { question, utility: null, stop: { shouldStop: false, reason_ar: 'نقيس مهارة حاسمة للمتصدر قبل الاكتفاء.', askedCount } }
        }
      }
    }

    if (stop.shouldStop || !best) {
      const finalStop = stop.shouldStop ? stop : { shouldStop: true, reason_ar: 'لا سؤال ذا منفعة حقيقية متبقٍ — الصورة اكتملت.', askedCount }
      this.traceEntry('stop_evaluated', finalStop.reason_ar, { askedCount })
      return { question: null, utility: null, stop: finalStop }
    }

    const question = questionById.get(best.questionId)!
    this.traceEntry('question_selected', `تكيفي — ${question.question_id}: ${question.text_ar}`, {
      winner: question.question_id,
      winnerReason_ar: best.reason_ar,
      utility: best.utility,
      utilityComponents: best.components,
      top3: ranked.slice(0, 3).map((r) => ({ questionId: r.questionId, utility: r.utility })),
    })
    return { question, utility: null, stop: { shouldStop: false, reason_ar: stop.reason_ar, askedCount } }
  }

  private evaluateStop(
    askedCount: number,
    ctx: DecisionContext,
    candidates: V2Candidate[],
    confidence: ConfidenceV2,
    hasDecisionQuestion: boolean,
    hasDomainSeparator: boolean,
  ): { shouldStop: boolean; reason_ar: string; askedCount: number } {
    if (askedCount < V21_STOP.minQuestions) {
      return { shouldStop: false, reason_ar: 'نحتاج أسئلة إضافية قبل أي توصية مسؤولة.', askedCount }
    }
    const criticalMissing = decisionCriticalMissing(this.state.facts)
    if (criticalMissing.length > 0 && askedCount < V21_STOP.hardCap) {
      return { shouldStop: false, reason_ar: 'ما زالت حقيقة حاسمة للقرار لم تُجمع بعد.', askedCount }
    }
    const margin = candidates.length >= 2 ? candidates[0].total - candidates[1].total : 1
    const domainReady =
      ctx.domains.confidence >= DOMAIN_CONFIDENCE_MIN || (askedCount >= V21_STOP.targetMin && !hasDomainSeparator)

    if (
      askedCount >= V21_STOP.targetMin &&
      domainReady &&
      margin >= V21_STOP.comfortableMargin &&
      confidence.overall >= V21_STOP.strongConfidence &&
      !hasDecisionQuestion
    ) {
      return { shouldStop: true, reason_ar: 'اكتملت الأدلة: مجال واضح وفارق مريح وثقة قوية ولا سؤال يغيّر النتيجة.', askedCount }
    }
    if (
      askedCount >= V21_STOP.targetMin + 2 &&
      domainReady &&
      margin >= V21_STOP.minSeparation &&
      confidence.overall >= V21_STOP.minOverallConfidence &&
      !hasDecisionQuestion
    ) {
      return { shouldStop: true, reason_ar: 'الصورة واضحة بما يكفي لتوصية مسؤولة — الأسئلة المتبقية تخصيصية.', askedCount }
    }
    if (askedCount >= V21_STOP.targetMin + 2 && domainReady && margin >= 0.25 && confidence.overall >= 0.7) {
      return { shouldStop: true, reason_ar: 'فارق واسع وثقة عالية — الأسئلة المتبقية لن تبدّل النتيجة.', askedCount }
    }
    if (askedCount >= V21_STOP.hardCap - 2 && !hasDecisionQuestion) {
      return { shouldStop: true, reason_ar: 'لم يعد هناك سؤال يغيّر النتيجة جوهريًا.', askedCount }
    }
    return { shouldStop: false, reason_ar: 'ما زالت أسئلة ذات منفعة.', askedCount }
  }

  /** فلترة خيارات الهدف/الاحتياج حسب المرحلة — خيار لا يناسب المرحلة لا يُعرض أصلًا */
  private withStageFilteredOptions(q: BankQuestion, stage: CareerStage | null): BankQuestion {
    if (!stage) return q
    if (q.question_id === Q.GOAL) {
      const allowed = new Set(goalsForStage(stage).map((g) => g.label_ar))
      const keptIdx = q.options_ar.map((_, i) => i).filter((i) => allowed.has(q.options_ar[i]))
      return { ...q, options_ar: keptIdx.map((i) => q.options_ar[i]), active_option_ids: keptIdx.map((i) => optionIdAt(q, i)) } as BankQuestion
    }
    if (q.question_id === Q.NEED) {
      const allowed = new Set(needsForStage(stage).map((n) => n.label_ar))
      const keptIdx = q.options_ar.map((_, i) => i).filter((i) => allowed.has(q.options_ar[i]))
      return { ...q, options_ar: keptIdx.map((i) => q.options_ar[i]), active_option_ids: keptIdx.map((i) => optionIdAt(q, i)) } as BankQuestion
    }
    return q
  }

  /* ─── تسجيل الإجابة ─── */
  answer(answer: Answer) {
    const question = questionById.get(answer.questionId)
    if (!question) throw new Error(`سؤال غير معروف: ${answer.questionId}`)

    const existing = this.state.answers.findIndex((a) => a.questionId === answer.questionId)
    if (existing >= 0) {
      this.state.answers[existing] = answer
      this.rebuild()
      return
    }

    this.state.answers.push(answer)
    if (!this.state.askedQuestionIds.includes(answer.questionId)) {
      this.state.askedQuestionIds.push(answer.questionId)
    }
    const beforeFacts = { ...this.state.facts }
    reduceAnswer(question, answer, this.state.facts, this.state.factsRaw, this.state.skillVector, this.state.interestVector)
    applyDerivedRules(this.state.facts)
    this.state.contradictions = detectContradictions(this.state.facts, this.state.contradictions, this.state.skillVector)

    const factsAdded = Object.keys(this.state.facts).filter((k) => beforeFacts[k] === undefined)
    const factsChanged = Object.keys(this.state.facts).filter(
      (k) => beforeFacts[k] !== undefined && JSON.stringify(beforeFacts[k].value) !== JSON.stringify(this.state.facts[k].value),
    )
    this.traceEntry('answer_reduced', `اختزال إجابة ${answer.questionId}`, {
      questionId: answer.questionId,
      optionIds: answer.optionIds ?? [],
      factsAdded,
      factsChanged,
      persona: derivePersonaV21(this.state.facts).key,
    })
  }

  private rebuild() {
    const answers = [...this.state.answers]
    const asked = [...this.state.askedQuestionIds]
    this.state.facts = {}
    this.state.factsRaw = {}
    this.state.skillVector = {}
    this.state.interestVector = {}
    this.state.contradictions = []
    this.state.guardrailStop = null
    this.state.minorFlag = false
    for (const a of answers) {
      const q = questionById.get(a.questionId)
      if (!q) continue
      reduceAnswer(q, a, this.state.facts, this.state.factsRaw, this.state.skillVector, this.state.interestVector)
      applyDerivedRules(this.state.facts)
      this.state.contradictions = detectContradictions(this.state.facts, this.state.contradictions, this.state.skillVector)
    }
    this.state.askedQuestionIds = asked
    this.traceEntry('answer_reduced', 'أُعيد بناء الحالة بعد تعديل إجابة — كل الدرجات أعيد حسابها.')
  }

  popAnswer(): string | null {
    const last = this.state.answers.pop()
    if (!last) return null
    this.state.askedQuestionIds = this.state.askedQuestionIds.filter((id) => id !== last.questionId)
    if (this.confirmation.started && !this.confirmation.completed) {
      const idx = this.confirmation.plan.findIndex((p) => p.questionId === last.questionId)
      if (idx >= 0) this.confirmation.cursor = Math.min(this.confirmation.cursor, idx)
    }
    this.rebuild()
    return last.questionId
  }

  reviseAnswer(answer: Answer) {
    this.answer(answer)
  }

  /* ─── جولة التأكيد — تُبنى على مشغلات الغموض لا على «المزيد من الأسئلة» ─── */

  private snapshot(): DeepeningSnapshot {
    const ctx = this.decisionContext()
    const { candidates, comp } = this.eligibilityAndCandidates(ctx)
    const confidence = computeConfidenceV2(this.state.facts, this.state.contradictions, ctx, candidates)
    /* الفائز الفعلي: مركب مستوفٍ للشروط، وإلا أفضل قياسي — نفس قاعدة recommend() */
    const winner = comp.compositeVictory?.passes && comp.bestComposite ? comp.bestComposite : comp.bestStandard
    const legacy = toLegacyConfidence(confidence)
    return {
      kind: comp.exploration.exploratory
        ? 'exploratory_direction'
        : winner
          ? winner.entity.entity_type === 'composite'
            ? 'composite_template'
            : 'single_pathway'
          : 'advisor_referral',
      topId: winner?.entity.entity_id ?? null,
      topLabel_ar: winner?.entity.title_ar ?? (comp.exploration.exploratory ? 'اتجاه استكشافي' : 'إحالة لمستشار'),
      confidenceTotal: confidence.overall,
      confidenceBand: legacy.band,
      confidenceBand_ar: confidence.outputKind_ar,
    }
  }

  startDeepening(): { reason_ar: string; plan: DeepeningPlanItem[]; before: DeepeningSnapshot } | null {
    if (this.confirmation.started || this.state.guardrailStop) return null
    const ctx = this.decisionContext()
    const { candidates, comp } = this.eligibilityAndCandidates(ctx)
    const top = candidates[0]
    const confidence = computeConfidenceV2(this.state.facts, this.state.contradictions, ctx, candidates)
    const margin = candidates.length >= 2 ? candidates[0].total - candidates[1].total : 1
    const decisive = this.decisiveMap(comp, ctx)

    /* مشغلات موثقة — لا جولة بلا سبب */
    const triggers: string[] = []
    if (margin < 0.08 && candidates.length >= 2) triggers.push('top_two_ambiguity')
    if (this.compositeAmbiguity(comp)) triggers.push('standard_vs_composite_ambiguity')
    if (decisive.size > 0) triggers.push('missing_decisive_evidence')
    else if ((top?.unknownSkillSlugs.length ?? 0) > 0) triggers.push('missing_decisive_evidence')
    if (this.state.contradictions.some((c) => !c.resolved)) triggers.push('contradiction')
    if (ctx.domains.confidence < DOMAIN_CONFIDENCE_MIN) triggers.push('low_domain_confidence')
    if (confidence.overall < V21_STOP.minOverallConfidence) triggers.push('low_recommendation_confidence')
    if (triggers.length === 0) return null

    const askedIds = new Set(this.state.askedQuestionIds)
    const pool = [...questionById.values()].filter((q) => {
      if (!isQuestionEligibleV21(q, {
        ...this.triggerContext(confidence.overall),
        userRequestedDeep: true,
        askedIds,
        phase: 'confirmation',
        stage: this.stage(),
        compositeAmbiguous: this.compositeAmbiguity(comp),
      })) return false
      if (q.answer_type === 'skill_level_5') return this.state.skillVector[q.measures[0]] === undefined
      const measures = q.measures.filter((m) => m !== 'skill_vector' && m !== 'interest_vector')
      if (q.module_id === 'M5') return this.state.interestVector[q.measures[0]] === undefined
      return measures.some((m) => this.state.facts[m] === undefined)
    })
    const ranked = rankAdaptiveQuestionsV21(pool, this.state.facts, this.state.contradictions, ctx, candidates, decisive, this.criticalFactsOf(comp, ctx))

    const plan: DeepeningPlanItem[] = []
    for (const r of ranked) {
      if (plan.length >= CONFIRMATION_MAX_QUESTIONS) break
      const q = questionById.get(r.questionId)!
      const targets: string[] = []
      const reasons: string[] = []
      const decisiveHit = decisive.has(q.measures[0])
      const skillHit = decisiveHit || top?.unknownSkillSlugs.includes(q.measures[0])
      if (skillHit) {
        targets.push('weak_skill')
        reasons.push(
          decisiveHit
            ? 'يقيس مهارة تفصل بين المرشحين المتصدرين — إجابتها قد تعيد ترتيب التوصية كلها'
            : 'يقيس مهارة متطلبة للمسار المرشح بسؤال مباشر بدل تركها مجهولة',
        )
      }
      if (r.components.contradiction > 0) {
        targets.push('contradiction')
        reasons.push('يحسم تناقضًا ظهر بين إجاباتك')
      }
      if (r.components.domainUncertainty > 0) {
        targets.push('domain')
        reasons.push('يفصل بين مجالين متقاربين')
      }
      if (q.question_id === Q.MASTERY) {
        targets.push('composite_choice')
        reasons.push('يفصل بين مسار واحد متعمق وخطة مركبة')
      }
      if (targets.length === 0) {
        targets.push('coverage')
        reasons.push('يرفع اكتمال الصورة وجودة الأدلة')
      }
      plan.push({ questionId: r.questionId, targets, reason_ar: reasons.join('؛ ') + '.' })
    }
    if (plan.length < CONFIRMATION_MIN_QUESTIONS) return null

    const before = this.snapshot()
    this.confirmation = { started: true, completed: false, plan, cursor: 0, before }
    const reason_ar = `لديك دقيقة أخرى لنتأكد أكثر (اختياري): ${triggers.length} مؤشرات عدم يقين ما زالت قائمة.`
    this.traceEntry('deepening_started', reason_ar, {
      triggers,
      plan: plan.map((p) => ({ questionId: p.questionId, targets: p.targets, reason_ar: p.reason_ar })),
      before,
    })
    return { reason_ar, plan, before }
  }

  private nextConfirmationQuestion(): NextQuestionResult {
    const askedIds = new Set(this.state.askedQuestionIds)
    while (this.confirmation.cursor < this.confirmation.plan.length) {
      const item = this.confirmation.plan[this.confirmation.cursor]
      this.confirmation.cursor += 1
      const q = questionById.get(item.questionId)
      if (!q) continue
      if (askedIds.has(q.question_id)) continue
      this.traceEntry('question_selected', `سؤال تأكيد ${q.question_id}: ${q.text_ar}`, {
        confirmation: true,
        winnerReason_ar: item.reason_ar,
      })
      return {
        question: q,
        utility: null,
        stop: { shouldStop: false, reason_ar: 'جولة تأكيد اختيارية جارية.', askedCount: this.state.askedQuestionIds.length },
      }
    }
    this.confirmation.completed = true
    return {
      question: null,
      utility: null,
      stop: { shouldStop: true, reason_ar: 'اكتملت أسئلة التأكيد.', askedCount: this.state.askedQuestionIds.length },
    }
  }

  deepeningStatus(): { index: number; total: number; currentReason_ar: string | null } | null {
    if (!this.confirmation.started || this.confirmation.completed) return null
    const current = this.confirmation.plan[this.confirmation.cursor - 1]
    return { index: this.confirmation.cursor, total: this.confirmation.plan.length, currentReason_ar: current?.reason_ar ?? null }
  }

  finishDeepening(): { recommendation: Recommendation; comparison: DeepeningComparison } {
    if (!this.confirmation.started || !this.confirmation.before) {
      throw new Error('لا جولة تأكيد مفتوحة لإنهائها.')
    }
    this.confirmation.completed = true
    const before = this.confirmation.before
    const recommendation = this.recommend()
    const v2 = (recommendation as RecommendationV21).v2
    const legacyAfter = toLegacyConfidence(v2?.confidence ?? computeConfidenceV2(this.state.facts, this.state.contradictions, this.decisionContext(), []))
    const after: DeepeningSnapshot = {
      kind: recommendation.kind,
      topId: recommendation.composite?.templateId ?? recommendation.primaryPathway?.pathwayId ?? null,
      topLabel_ar:
        recommendation.composite?.nameAr ??
        (recommendation.primaryPathway
          ? (launchPathways.find((p) => p.id === recommendation.primaryPathway!.pathwayId)?.title ?? recommendation.primaryPathway.pathwayId)
          : 'إحالة لمستشار'),
      confidenceTotal: v2?.confidence.overall ?? recommendation.confidence.total,
      confidenceBand: legacyAfter.band,
      confidenceBand_ar: v2?.confidence.outputKind_ar ?? recommendation.confidence.band_ar,
    }
    const changed = before.topId !== after.topId || before.kind !== after.kind
    const reasons: string[] = []
    if (changed) reasons.push(`تغيّرت التوصية من «${before.topLabel_ar}» إلى «${after.topLabel_ar}».`)
    else reasons.push('بقي المسار نفسه — إجاباتك الإضافية أكّدت التوصية أو حسّنت تفاصيلها.')
    if (after.confidenceBand !== before.confidenceBand) {
      reasons.push(`انتقل مستوى الثقة من «${before.confidenceBand_ar}» إلى «${after.confidenceBand_ar}».`)
    } else if (Math.abs(after.confidenceTotal - before.confidenceTotal) >= 0.03) {
      reasons.push(after.confidenceTotal > before.confidenceTotal ? 'ارتفعت قوة الأدلة.' : 'انخفضت قوة الأدلة قليلًا — الصورة صارت أدق.')
    }
    const answeredCount = this.state.askedQuestionIds.filter((id) => this.confirmation.plan.some((p) => p.questionId === id)).length
    const comparison: DeepeningComparison = {
      before,
      after,
      changed,
      note_ar: changed ? 'ظهرت معلومات إضافية جعلت هذا الاختيار أكثر ملاءمة.' : 'دعمت إجاباتك الإضافية التوصية الحالية.',
      reasons_ar: reasons,
      answeredCount,
    }
    this.traceEntry('deepening_completed', comparison.note_ar, { before, after, changed, reasons_ar: reasons, answeredCount })
    return { recommendation, comparison }
  }

  /* ─── التوصية النهائية ─── */
  recommend(): RecommendationV21 {
    const ctx = this.decisionContext()
    const { eligibility, candidates, comp } = this.eligibilityAndCandidates(ctx)
    const confidence = computeConfidenceV2(this.state.facts, this.state.contradictions, ctx, candidates)

    if (this.state.guardrailStop) {
      return {
        kind: 'guardrail_stop',
        primaryPathway: null,
        alternatives: [],
        composite: null,
        confidence: toLegacyConfidence(confidence),
        reasons_ar: [this.state.guardrailStop],
        unavailable_skills: [],
        change_makers_ar: [],
        trainer: { status: 'unassigned', note_ar: 'لا مطابقة مدرب قبل اكتمال التشخيص.' },
        disclaimer_ar: DISCLAIMER_AR,
        trace: this.state.trace,
      }
    }

    /* ١) الاستكشاف — مستكشف غير محسوم والأدلة دون حد الفرض: اتجاه استكشافي لا كيان مفروض (البند 10).
       لا PW-STU-003 ولا أي مسار افتراضي — مَن لا دليل لديه لا تُفرض عليه نتيجة. */
    if (comp.exploration.exploratory) {
      const shortlist = comp.exploration.domainShortlist.map((id) => ({ id, label_ar: domainLabelAr(id) }))
      const evidenceSuggestions = [
        ...(shortlist[0]
          ? [`خطوة عملية: جرّب مهمة صغيرة في «${shortlist[0].label_ar}» — ساعات معدودة تكشف الميل الحقيقي أكثر من أي سؤال.`]
          : []),
        ...(shortlist[1] ? [`قارنها بمهمة من «${shortlist[1].label_ar}»: أيهما تستمر فيه بلا ملل؟ إجابتك تفتح التشخيص من جديد بصورة أوضح.`] : []),
        'إن أردت حسمًا أسرع: جلسة واحدة مع مستشار مهني تختصر أسابيع من التخمين.',
      ]
      const handoff = buildAdvisorHandoff(this.state.facts, this.state.contradictions, ctx, candidates, eligibility, confidence, new Set(this.state.askedQuestionIds))
      const explorationExplanation = buildExplanation(this.state.facts, ctx, candidates, eligibility, confidence, {
        catalogGap_ar: null,
        personalizationNotes_ar: [],
      })
      this.traceEntry('recommendation', 'اتجاه استكشافي — هدف/احتياج غير محسوم والأدلة دون حد فرض كيان.', {
        domainShortlist: shortlist.map((s) => s.id),
        internalTop: comp.candidates.slice(0, 3).map((c) => c.entity.entity_id),
      })
      return {
        kind: 'exploratory_direction',
        primaryPathway: null,
        alternatives: [],
        composite: null,
        confidence: toLegacyConfidence(confidence),
        reasons_ar: comp.exploration.reasons_ar,
        unavailable_skills: [],
        change_makers_ar: [],
        trainer: { status: 'unassigned', note_ar: 'لا مطابقة مدرب قبل حسم الاتجاه.' },
        disclaimer_ar: DISCLAIMER_AR,
        trace: this.state.trace,
        exploration: {
          domain_shortlist: shortlist,
          evidence_suggestions_ar: evidenceSuggestions,
          internal_top_candidates: comp.candidates
            .slice(0, 3)
            .map((c) => ({ entity_id: c.entity.entity_id, entity_type: c.entity.entity_type, fit: c.netFit })),
        },
        v2: { explanation: explorationExplanation, confidence, eligibility, advisorHandoff: handoff, versions: engineVersions() },
      }
    }

    /* ٢) فجوة كتالوج أو لا مرشحين — إحالة مسؤولة موثقة بدل «أقرب مسار» (البند 15) */
    if (candidates.length === 0 || comp.catalogGap) {
      const topDomain = ctx.domains.top
      const gapNote = topDomain
        ? `مجالك الظاهر («${domainLabelAr(topDomain)}») لا يغطيه كتالوج المسارات الحالي بملاءمة كافية — سجّلناه فجوة موثقة، ونحيلك لمستشار يرسم لك بداية مخصصة.`
        : 'الأدلة المجمعة لا تكفي لترشيح مسار مسؤول — مستشار يكمل الصورة معك.'
      const handoff = buildAdvisorHandoff(this.state.facts, this.state.contradictions, ctx, candidates, eligibility, confidence, new Set(this.state.askedQuestionIds))
      const explanation = buildExplanation(this.state.facts, ctx, candidates, eligibility, confidence, {
        catalogGap_ar: topDomain ? gapNote : null,
        personalizationNotes_ar: [],
      })
      this.traceEntry('recommendation', 'إحالة لمستشار — فجوة كتالوج موثقة أو أدلة ناقصة.', { catalogGap: comp.catalogGap, topDomain: topDomain ?? null })
      return {
        kind: 'advisor_referral',
        primaryPathway: null,
        alternatives: [],
        composite: null,
        confidence: toLegacyConfidence(confidence),
        reasons_ar: [gapNote],
        unavailable_skills: [],
        change_makers_ar: [],
        trainer: { status: 'unassigned', note_ar: 'لا مسار أساسي — تُرسم البداية مع مستشار.' },
        disclaimer_ar: DISCLAIMER_AR,
        trace: this.state.trace,
        v2: { explanation, confidence, eligibility, advisorHandoff: handoff, versions: engineVersions() },
      }
    }

    /* ٣) المركب كيان منافس أولًا — يفوز فقط بقيمة إضافية مثبتة فوق أفضل قياسي (البنود 3-5) */
    const masteryFact = this.state.facts['verified_mastery']
    const verifiedMastered =
      masteryFact && masteryFact.evidenceQuality >= 0.8 && Array.isArray(masteryFact.value) ? (masteryFact.value as string[]) : []
    /* اختيار المستخدم الصريح «إتقان واحد» يُطفئ المركب — قراره موثق لا مخترع */
    const masteryPref = this.state.facts['mastery_portfolio_pref']?.value

    let composite: CompositeSelection | null = null
    if (comp.compositeVictory?.passes && comp.bestComposite && masteryPref !== 'master_one') {
      const winner = comp.bestComposite
      const tpl = compositeTemplates.find((t) => t.template_id === winner.entity.entity_id)
      if (tpl) {
        const variant = planVariantV21(this.state.facts, winner.fit)
        const plan = buildCoursePlan(tpl, variant, verifiedMastered)
        const secondComposite = comp.candidates.find(
          (c) => c.entity.entity_type === 'composite' && c.entity.entity_id !== tpl.template_id,
        )
        const handoffFilter = appliedHandoffFilter(winner.entity, this.state.facts)
        composite = {
          templateId: tpl.template_id,
          nameAr: tpl.name_ar,
          fit: winner.netFit,
          variant,
          courses: plan.items,
          removedCourses: plan.removed,
          requiredHoursOverflow: plan.requiredOverflow,
          missingRequiredFacts: winner.entity.required_facts
            .filter((rf) => rf.importance !== 'optional' && this.state.facts[rf.fact_key] === undefined)
            .map((rf) => rf.fact_key),
          /* المركب يشرح نفسه: لماذا فاز وما قيمته الإضافية فوق أفضل مسار منفرد (البند 14) */
          rationale_ar: comp.compositeVictory.reasons_ar,
          representedPathwayIds: tpl.plan?.represented_pathway_ids ?? [],
          capstone_ar: tpl.transformation?.capstone_ar,
          success_metric_ar: tpl.transformation?.success_metric_ar,
          nearestAlternative: secondComposite
            ? {
                templateId: secondComposite.entity.entity_id,
                nameAr: secondComposite.entity.title_ar,
                fit: secondComposite.netFit,
                whyNot_ar: 'الخطة المختارة غطت مجالات حاجتك بقيمة إضافية أعلى بعد تكلفة التعقيد.',
              }
            : undefined,
          advisorHandoff: handoffFilter ?? undefined,
        }
        this.traceEntry(
          'template_layer',
          'فازت خطة مركبة: حاجة متعددة المجالات + قيمة إضافية فوق أفضل قياسي بعد تكلفة التعقيد.',
          {
            templateId: tpl.template_id,
            fit: winner.fit,
            burden: winner.burden,
            netFit: winner.netFit,
            victory: {
              multiDomainNeed: comp.compositeVictory.multiDomainNeed,
              coversGap: comp.compositeVictory.coversGapBeyondBestStandard,
              threshold: comp.compositeVictory.thresholdUsed,
              factCoverage: comp.compositeVictory.factCoverage,
            },
          },
        )
      }
    } else if (!comp.compositeVictory?.passes && comp.topComposite) {
      /* توثيق دائم لقرار المنافسة — حتى عند خسارة المركب: لماذا لم يفز؟ (البند 14 وقابلية التدقيق) */
      const lossReasons = comp.compositeVictory
        ? comp.compositeVictory.reasons_ar
        : ['لا حاجة متعددة المجالات مُثبتة تبرر خطة مركبة، أو أفضل مسار قياسي يغطي مجالات حاجتك كاملة.']
      this.traceEntry('template_layer', 'خطة مركبة مؤهلة لكنها لم تستوفِ شروط الفوز — الأبسط الكافي يتقدم.', {
        templateId: comp.topComposite.entity.entity_id,
        fit: comp.topComposite.fit,
        burden: comp.topComposite.burden,
        netFit: comp.topComposite.netFit,
        victory: comp.compositeVictory
          ? {
              passes: comp.compositeVictory.passes,
              multiDomainNeed: comp.compositeVictory.multiDomainNeed,
              coversGap: comp.compositeVictory.coversGapBeyondBestStandard,
              exceedsThreshold: comp.compositeVictory.exceedsThreshold,
              threshold: comp.compositeVictory.thresholdUsed,
              factCoverage: comp.compositeVictory.factCoverage,
            }
          : null,
        reasons_ar: lossReasons,
      })
    }

    const standardCandidates = comp.candidates.filter((c) => c.entity.entity_type === 'standard')
    const primary = standardCandidates[0] ?? null
    /* بديل واحد متباين لا اثنان بالترتيب: الأول خطةٌ شخصناها، والبديل مسارٌ سليم
       كما صُمم لمن لا يريد الاستبدال. وثلاثة خيارات على شاشة قرار تُربك ولا تُعين. */
    let alternativeContrast_ar: string | undefined
    let alternatives: typeof standardCandidates = []
    if (primary) {
      /* ١) مسار قياسي آخر يختلف اختلافا مفيدا */
      for (const cand of standardCandidates.slice(1)) {
        const contrast = contrastOf(primary.entity.entity_id, cand.entity.entity_id)
        if (contrast) {
          alternatives = [cand]
          alternativeContrast_ar = contrast
          break
        }
      }
      /* ٢) وإلا فأقرب مركب مؤهل — خطةٌ أوسع تجمع أكثر من مجال */
      if (alternatives.length === 0) {
        const composites = comp.candidates.filter((c) => c.entity.entity_type === 'composite')
        if (composites.length > 0) {
          alternatives = [composites[0]]
          alternativeContrast_ar = 'خطة أوسع تجمع أكثر من مجال — إن أردت تغطية أشمل'
        }
      }
      /* ٣) وإلا فالمسار نفسه كما صُمم — البديل الصادق حين شخصنّا خطته:
         من لا يريد استبدالا يأخذ المسار الأصلي بمقرراته الخمسة وشهادته كما هي.
         ولا يُعرض حين لم نستبدل شيئا: عرضُ الشيء بديلا عن نفسه عبث. */
      if (alternatives.length === 0 && standardCandidates.length > 1) alternatives = [standardCandidates[1]]
    }

    const unavailable: { skill: string; note_ar: string }[] = []
    const coveredSlugs = new Set(candidates.flatMap((c) => c.gapSkillSlugs.concat(c.masteredSkillSlugs)))
    for (const [slug, level] of Object.entries(this.state.skillVector)) {
      if (level < 3 && !coveredSlugs.has(slug)) {
        unavailable.push({ skill: slug, note_ar: 'مهارة مقيسة منخفضة لا تغطيها الدورات الحالية — تبقى ظاهرة ولا تُخفى.' })
      }
    }

    /* حارس صمت الدليل (موثق — المرحلة 4، ومُحكَّم مرتين في إغلاق منطق V2.1):
       في سباق حي (هامش < 0.15) فائزٌ بلا أي مهارة حاسمة مقاسة يعني أن دليلًا
       كان يمكن أن يقلب النتيجة لم يُجمع — لا توصية صامتة بل وسم مستشار مع سبب
       صريح وخطة مرفقة. التحكيم الثاني: الفحص الشامل أثبت أن كل حاسمة في الفضاء
       النشط قابلة للقياس بسؤال نشط، فشرط «غير قابلة للإنتاج» وحده لا يكفي —
       5 جلسات مونت كارلو (20260818/10k) قفز فائزها (PW-NEG/PW-MKT) للصدارة بعد
       استنفاد مقاعد الإنقاذ على حاسمات منافسيه، فبقيت حاسمته مجهولة رغم أنها
       قابلة للقياس. المعيار العادل: صفر حاسمات مقاسة في سباق حي = وسم، بغض
       النظر عن سبب بقائها مجهولة. فائز قيست إحدى حاسمتيه (رحلة FREELANCE)
       يملك دليلًا مهاريًا ولا يُوسم. أما السباق المريح ففوزه مبني على
       هدف/مجال/سياق لا على مهارات مجهولة */
    const winnerForEvidence = composite && comp.bestComposite ? comp.bestComposite : primary
    const winnerDecisive = winnerForEvidence?.entity.skill_roles.decisive ?? []
    const raceMargin = comp.candidates.length >= 2 ? comp.candidates[0].netFit - comp.candidates[1].netFit : 1
    const measuredDecisiveCount = winnerForEvidence
      ? winnerDecisive.filter((s) => !winnerForEvidence.skills.unknownSkillSlugs.includes(s)).length
      : 0
    const silentOnDecisive =
      winnerForEvidence !== null &&
      raceMargin < 0.15 &&
      winnerDecisive.length > 0 &&
      measuredDecisiveCount === 0

    const needsAdvisor =
      confidence.outputKind === 'advisor_review' ||
      this.state.contradictions.some((c) => !c.resolved && c.severity === 'high') ||
      composite?.requiredHoursOverflow === true ||
      composite?.advisorHandoff !== undefined ||
      silentOnDecisive

    const kind: Recommendation['kind'] = needsAdvisor ? 'advisor_referral' : composite ? 'composite_template' : 'single_pathway'

    const trainer = primary
      ? matchTrainer(primary.entity.entity_id, this.state.facts, primary.skills.gapSkillSlugs)
      : { status: 'unassigned' as const, note_ar: 'لا مسار أساسي — تُرسم البداية مع مستشار.' }
    const personalization = personalizationNotes(ctx.skillStates, ctx.domains.ranked.length > 0 ? [ctx.domains.ranked[0]] : [])
    /* الشرح يُبنى على الفائز الفعلي أولًا — مركبًا كان أو قياسيًا — حتى لا يصف كيانًا غير المعروض */
    const winnerCandidate = composite && comp.bestComposite ? comp.bestComposite : primary
    const explanationCandidates = winnerCandidate
      ? [toV2Candidate(winnerCandidate), ...candidates.filter((c) => c.pathwayId !== winnerCandidate.entity.entity_id)]
      : candidates
    const explanation = buildExplanation(this.state.facts, ctx, explanationCandidates, eligibility, confidence, {
      catalogGap_ar: null,
      personalizationNotes_ar: personalization,
    })
    const handoff = needsAdvisor
      ? buildAdvisorHandoff(this.state.facts, this.state.contradictions, ctx, candidates, eligibility, confidence, new Set(this.state.askedQuestionIds))
      : undefined

    this.traceEntry('candidates_scored', `أفضل الكيانات الأهلية: ${comp.candidates.slice(0, 3).map((c) => c.entity.entity_id).join(' ← ')}`, {
      top5: comp.candidates.slice(0, 5).map((c) => ({
        entityId: c.entity.entity_id,
        type: c.entity.entity_type,
        netFit: c.netFit,
        measuredSkillCoverage: c.skills.measuredCoverage,
      })),
      excluded: eligibility.filter((e) => !e.eligible).map((e) => ({ entityId: e.pathwayId, reasons: e.excludedReasons_ar })),
    })

    const personalPlan = primary ? personalizePlan(primary.entity.entity_id, ctx) : undefined
    /* شخصنّا الخطة ولا بديل خارجي: البديل هو المسار كما صُمم — خيارٌ ثانٍ حقيقي
       لمن يفضّل تماسك المسار الأصلي وشهادته على خطةٍ فُصّلت له. */
    let originalPlan: PathwayCourseFit | undefined
    if (alternatives.length === 0 && personalPlan?.personalized && primary) {
      originalPlan = assessPathwayByCourses(primary.entity.entity_id, ctx)
      alternativeContrast_ar = 'المسار كما صُمم — بمقرراته الخمسة الأصلية بلا استبدال'
    }

    const partial = {
      kind,
      primaryPathway: primary ? toLegacyCandidate(toV2Candidate(primary)) : null,
      alternatives: alternatives.map((c) => toLegacyCandidate(toV2Candidate(c))),
      personalPlan,
      originalPlan,
      alternativeContrast_ar,
      composite,
      confidence: toLegacyConfidence(confidence),
      reasons_ar: [
        ...explanation.understood_facts_ar.slice(0, 2),
        explanation.domain_reason_ar,
        ...(composite && comp.compositeVictory ? comp.compositeVictory.reasons_ar.slice(-1) : explanation.pathway_reasons_ar.slice(0, 2)),
        ...(composite?.requiredHoursOverflow ? ['مجموع ساعات الخطة يتجاوز 80 ساعة — تُراجَع مع مستشار.'] : []),
        ...(composite?.advisorHandoff ? [composite.advisorHandoff.rationale_ar] : []),
        ...(silentOnDecisive
          ? ['مهارة حاسمة للمسار المرشح بقيت بلا قياس ضمن ميزانية الأسئلة — تُراجَع النتيجة مع مستشار قبل الاعتماد.']
          : []),
      ],
      unavailable_skills: unavailable,
      trainer,
      disclaimer_ar: DISCLAIMER_AR,
      trace: this.state.trace,
    }
    const recommendation: RecommendationV21 = {
      ...partial,
      change_makers_ar: buildChangeMakers(partial),
      v2: { explanation, confidence, eligibility, ...(handoff ? { advisorHandoff: handoff } : {}), versions: engineVersions() },
    }
    this.traceEntry('recommendation', `توصية V2.1: ${kind} — ${confidence.outputKind_ar} (${(confidence.overall * 100).toFixed(0)}٪)`, {
      top: composite?.templateId ?? primary?.entity.entity_id ?? null,
      outputKind: confidence.outputKind,
      strongBlockers: confidence.strongBlockers_ar,
      measuredSkillCoverage: primary?.skills.measuredCoverage ?? 0,
      unknownSkills: primary?.skills.unknownSkillSlugs.length ?? 0,
    })
    return recommendation
  }
}

/* ─── محوّلات شكل V1 (جسور توافق — لا منطق فيها) ─── */

/** كيان المنافسة الموحدة → شكل مرشح V2 (للثقة والشرح والجسور) — pathwayId يحمل معرف الكيان أيًا كان نوعه */
function toV2Candidate(c: EntityCandidate): V2Candidate {
  return {
    pathwayId: c.entity.entity_id,
    total: c.netFit,
    measuredSkillCoverage: c.skills.measuredCoverage,
    gapSkillSlugs: c.skills.gapSkillSlugs,
    masteredSkillSlugs: c.skills.masteredSkillSlugs,
    unknownSkillSlugs: c.skills.unknownSkillSlugs,
    reasons_ar: c.reasons_ar,
    breakdown: c.breakdown,
  }
}

/** نسخة الخطة المركبة — نفس قاعدة V2 الموثقة: عبء أسبوعي خفيف أو دليل دون 0.8 → starter */
function planVariantV21(facts: DiagnosticState['facts'], fit: number): PlanVariant {
  const load = facts['weekly_load']?.value as string | undefined
  const order = load ? (WEEKLY_LOAD_ORDER[load] ?? 2) : 2
  if (order <= 2 || fit < 0.8) return 'starter'
  if (order === 3) return 'full'
  return 'extended'
}

function toLegacyCandidate(c: V2Candidate): PathwayCandidate {
  return {
    pathwayId: c.pathwayId,
    fit: {
      persona: c.breakdown.persona,
      goal: c.breakdown.goal,
      skillGap: c.breakdown.skillGap ?? 0,
      feasibility: c.breakdown.feasibility,
      motivation: c.breakdown.motivation,
      total: c.total,
      reasons_ar: c.reasons_ar,
    },
    gapSkillSlugs: c.gapSkillSlugs,
    masteredSkillSlugs: c.masteredSkillSlugs,
  }
}

function toLegacyConfidence(c: ConfidenceV2) {
  const bandMap = {
    strong_match: { band: 'strong', band_ar: 'قوية' },
    best_current_match: { band: 'good', band_ar: 'جيدة' },
    exploratory_direction: { band: 'preliminary', band_ar: 'أولية' },
    advisor_review: { band: 'advisor_referral', band_ar: 'تحتاج مراجعة مستشار' },
  } as const
  const b = bandMap[c.outputKind]
  return {
    coverage: c.persona,
    consistency: c.consistency,
    separation: c.separation,
    evidenceQuality: c.evidenceQuality,
    stability: c.skillEvidenceCoverage,
    total: c.overall,
    band: b.band as 'strong' | 'good' | 'preliminary' | 'advisor_referral',
    band_ar: b.band_ar,
  }
}

/** معرفات النسخ الخمسة — تُحفظ مع كل توصية */
export function engineVersions() {
  return {
    engine: 'v2.1',
    question_plan: '2.1.0',
    question_bank: 'v1.0+v2.1-overlay',
    catalog: 'bundled',
    skill_taxonomy: 'v2.1',
  }
}

export function createEngineV21(sessionId?: string): DiagnosticEngineV21 {
  return new DiagnosticEngineV21(sessionId)
}
