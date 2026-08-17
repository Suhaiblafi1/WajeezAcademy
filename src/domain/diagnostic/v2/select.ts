/* اختيار السؤال التالي في V2 — نواة دنيا ثم توجيه تكيفي حقيقي.
   أولوية الاختيار (Maximum Information Gain):
   حقيقة حاسمة مفقودة ← غموض المجال ← فصل المتصدرين ← دليل مهارة مفقود ←
   تناقض قائم ← حاجة تخصيص ← كلفة الإجابة.
   لا سؤال يُعرف جوابه، ولا سؤالان لنفس الشيء بعد كفاية الدليل. */

import { decisionCriticalMissing } from '../facts'
import type { BankQuestion, Contradiction, FactBag } from '../types'
import { questionMetaV2 } from './data'
import { DOMAIN_CONFIDENCE_MIN } from './domains'
import type { DecisionContext, PersonaKey, V2Candidate } from './types'

/* ─── النواة الدنيا — «أقل ما يلزم» ─── */
export interface CoreStep {
  questionId: string
  /** متى تُطرح — شرط حتمي على الحقائق والشخصية */
  neededWhen: (facts: FactBag, persona: PersonaKey) => boolean
  reason_ar: string
}

const has = (facts: FactBag, k: string) => facts[k] !== undefined

export const CORE_SEQUENCE: CoreStep[] = [
  {
    questionId: 'QB-M0-006',
    neededWhen: (f) => !has(f, 'diagnostic_consent'),
    reason_ar: 'الموافقة المستنيرة تسبق أي جمع بيانات تشخيصية.',
  },
  {
    questionId: 'QB-M0-001',
    neededWhen: (f) => has(f, 'diagnostic_consent') && !has(f, 'decision_owner'),
    reason_ar: 'صاحب القرار يحدد لغة الرحلة كلها — فرد أم جهة.',
  },
  {
    questionId: 'QB-M1-001',
    neededWhen: (f) => !has(f, 'persona_type') && !has(f, 'persona_branch'),
    reason_ar: 'من أنت؟ — أساس كل ما بعده.',
  },
  {
    questionId: 'QB-M1-002',
    neededWhen: (f, p) =>
      (p === 'unknown' || p === 'school_student' || p === 'university_student') && !has(f, 'education_state') && has(f, 'persona_type'),
    reason_ar: 'المرحلة التعليمية تفرّق طالب المدرسة عن الجامعة — وتغيّر الأسئلة كلها.',
  },
  {
    questionId: 'QB-M1-003',
    neededWhen: (f, p) =>
      p !== 'school_student' &&
      !has(f, 'employment_state') &&
      ['graduate', 'university_student', 'unknown'].includes(p),
    reason_ar: 'وضعك العملي يحسم «أول وظيفة أم ترقية» — لا نخمّنه.',
  },
  {
    questionId: 'QB-M2-001',
    neededWhen: (f) => !has(f, 'primary_goal'),
    reason_ar: 'ماذا تريد؟ — الهدف يحدد فضاء المشكلة قبل أي مسار.',
  },
  {
    questionId: 'QB-M2-005',
    neededWhen: (f) => has(f, 'primary_goal') && !has(f, 'goal_clarity'),
    reason_ar: 'وضوح هدفك يحدد هل نحتاج استكشافًا أعمق أم ننتقل للأدلة.',
  },
  {
    questionId: 'QB-M3B-012',
    neededWhen: (f, p) =>
      ['junior_employee', 'experienced_employee', 'gov_employee'].includes(p) && !has(f, 'leadership_context'),
    reason_ar: 'هل تدير أشخاصًا؟ — يفصل مسار الموظف عن مسار المدير فصلًا تامًا.',
  },
  {
    questionId: 'QB-M3C-001',
    neededWhen: (f, p) => ['founder_idea', 'founder_operating', 'freelancer'].includes(p) && !has(f, 'business_stage'),
    reason_ar: 'مرحلة مشروعك تحسم «إطلاق أم نمو» — جوهري للمسار.',
  },
  {
    questionId: 'QB-M3B-001',
    neededWhen: (f, p) =>
      ['junior_employee', 'experienced_employee', 'new_manager', 'leader'].includes(p) && !has(f, 'sector'),
    reason_ar: 'القطاع (عام/خاص) يفلتر مسارات حكومية بأكملها.',
  },
  {
    questionId: 'QB-M2-015',
    neededWhen: (f) => has(f, 'primary_goal') && !has(f, 'application_readiness'),
    reason_ar: 'استعدادك للتطبيق العملي يضبط طبيعة الخطة.',
  },
  {
    questionId: 'QB-M7-001',
    neededWhen: (f) => !has(f, 'weekly_load'),
    reason_ar: 'وقتك الأسبوعي الواقعي يحدد جدوى أي مسار.',
  },
]

/* ─── التوجيه التكيفي ─── */
export interface AdaptiveScore {
  questionId: string
  utility: number
  reason_ar: string
  components: Record<string, number>
}

const DECISIVE_FACTS = [
  'primary_goal', 'persona_type', 'weekly_load', 'goal_clarity', 'function_specialization', 'sector',
  'leadership_context', 'business_stage', 'offer_clarity', 'revenue_signal', 'application_readiness',
  'public_facing', 'employment_state', 'education_state',
]
const DOMAIN_SEPARATOR_FACTS = ['function_specialization', 'sector', 'leadership_context', 'business_stage', 'public_facing']
const PERSONALIZATION_FACTS = ['budget_profile', 'learning_format', 'cohort_preference', 'content_language']

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

export function scoreAdaptiveQuestion(
  q: BankQuestion,
  facts: FactBag,
  contradictions: Contradiction[],
  ctx: DecisionContext,
  candidates: V2Candidate[],
): AdaptiveScore {
  const meta = questionMetaV2[q.question_id]
  const measures = meta?.measures ?? q.measures.filter((m) => m !== 'skill_vector')

  const criticalMissing = decisionCriticalMissing(facts)
  const missingCritical = measures.some((m) => criticalMissing.includes(m)) ? 1 : 0

  const domainUncertainty =
    ctx.domains.confidence < DOMAIN_CONFIDENCE_MIN && measures.some((m) => DOMAIN_SEPARATOR_FACTS.includes(m))
      ? 1
      : 0

  const margin = candidates.length >= 2 ? candidates[0].total - candidates[1].total : 1
  const topTwoSeparation = margin < 0.08 && measures.some((m) => DECISIVE_FACTS.includes(m)) ? 1 : 0

  const top2Skills = new Set(candidates.slice(0, 2).flatMap((c) => c.unknownSkillSlugs))
  const skillEvidence =
    meta?.decision_impact === 'skill_evidence' && measures.some((m) => top2Skills.has(m)) ? 1 : 0

  const contradiction = contradictions.some(
    (c) => !c.resolved && c.factKeys.some((fk) => measures.includes(fk)),
  )
    ? 1
    : 0

  const personalization = measures.some((m) => PERSONALIZATION_FACTS.includes(m) && facts[m] === undefined) ? 1 : 0

  const cost = COST_BY_TYPE[q.answer_type] ?? 0.4
  const sensitivity = SENSITIVITY[q.sensitivity_level] ?? 0.5
  const redundancy = measures.every((m) => facts[m] !== undefined) ? 1 : 0

  /* الأوزان تعكس ترتيب الأولوية الموثق أعلاه */
  const utility =
    missingCritical * 1.0 +
    domainUncertainty * 0.8 +
    topTwoSeparation * 0.7 +
    contradiction * 0.65 +
    skillEvidence * 0.6 +
    personalization * 0.2 +
    (measures.some((m) => facts[m] === undefined) ? 0.25 : 0) +
    cost * -0.12 +
    sensitivity * -0.1 +
    redundancy * -1.0

  const reasons: [string, number][] = [
    ['حقيقة حاسمة للقرار مفقودة', missingCritical],
    ['غموض المجال يحتاج فصلًا', domainUncertainty * 0.8],
    ['يفصل بين المتصدرين المتقاربين', topTwoSeparation * 0.7],
    ['يحسم تناقضًا قائمًا', contradiction * 0.65],
    ['يقيس مهارة مطلوبة للمتصدرين', skillEvidence * 0.6],
    ['يخصّص خطتك', personalization * 0.2],
  ]
  const top = reasons.sort((a, b) => b[1] - a[1])[0]
  const reason_ar = top && top[1] > 0 ? `فاز أساسًا بسبب: ${top[0]}.` : 'يكمل الصورة العامة.'

  return {
    questionId: q.question_id,
    utility,
    reason_ar,
    components: {
      missingCritical,
      domainUncertainty,
      topTwoSeparation,
      contradiction,
      skillEvidence,
      personalization,
      cost,
      sensitivity,
      redundancy,
    },
  }
}

/** يرتب الأسئلة التكيفية — التعادل يحسم أبجديًا (حتمية) */
export function rankAdaptiveQuestions(
  questions: BankQuestion[],
  facts: FactBag,
  contradictions: Contradiction[],
  ctx: DecisionContext,
  candidates: V2Candidate[],
): AdaptiveScore[] {
  const scored = questions.map((q) => scoreAdaptiveQuestion(q, facts, contradictions, ctx, candidates))
  scored.sort((a, b) => b.utility - a.utility || a.questionId.localeCompare(b.questionId))
  return scored
}

/* ─── سياسة التوقف V2 ─── */
export const V2_STOP = {
  /** أقل جلسة مفيدة — النواة الدنيا نحو ٥ + سؤال تكيفي واحد على الأقل */
  minQuestions: 6,
  /** غالبًا ٨–١٤؛ التوقف المبكر مشروط باكتمال الصورة */
  targetMin: 8,
  /** السقف الصارم — لا سؤال خامس عشر أبدًا */
  hardCap: 14,
  /** أدنى ثقة كلية للتوقف الطبيعي */
  minOverallConfidence: 0.55,
  /** ثقة مرتفعة تبيح التوقف المبكر */
  strongConfidence: 0.65,
  /** فارق مريح يبيح التوقف المبكر */
  comfortableMargin: 0.15,
  /** أدنى فارق مقبول */
  minSeparation: 0.08,
} as const
