/* اختزال الإجابات إلى حقائق — حتمي وموثق.
   الأولوية: تأثير صريح في option-effects ← معالج نوعي موثق في question-policy ← حفظ خام. */

import { keywordClassifiers, optionEffects, questionById, skillSlugs } from './catalog'
import type { Answer, BankQuestion, FactBag, FactValue } from './types'

const UNCERTAIN_MARKERS = ['لست متأكدا', 'لا أعرف', 'غير متأكد', 'أفضل عدم الإجابة']

function normAr(s: string): string {
  return s
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim()
}

function classifyByKeywords(questionId: string, text: string): string | null {
  const classifier = keywordClassifiers[questionId]
  if (!classifier) return null
  const n = normAr(text)
  for (const rule of classifier.rules) {
    if (rule.any.some((kw) => n.includes(normAr(kw)))) return rule.code
  }
  return null
}

function putFact(
  facts: FactBag,
  key: string,
  value: string | string[] | number,
  questionId: string,
  evidenceQuality: number,
  raw?: string,
) {
  const prev = facts[key]
  const next: FactValue = { value, sourceQuestionId: questionId, evidenceQuality, raw }
  // متعدد القيم (مثل function_specialization) يتجمع كمصفوفة
  if (prev && typeof prev.value !== typeof next.value) return
  if (prev && Array.isArray(prev.value)) {
    const arr = prev.value as (string | number)[]
    const v = next.value as string | number
    if (!arr.includes(v)) arr.push(v)
    prev.evidenceQuality = Math.max(prev.evidenceQuality, evidenceQuality)
    return
  }
  // القيمة الأحدث بجودة أدلة أعلى أو تساويها تغلب
  if (!prev || prev.evidenceQuality <= evidenceQuality) facts[key] = next
}

/** يختزل إجابة واحدة إلى حقائق ويحدث المتجهات */
export function reduceAnswer(
  question: BankQuestion,
  answer: Answer,
  facts: FactBag,
  factsRaw: Record<string, string>,
  skillVector: Record<string, number>,
  interestVector: Record<string, number>,
) {
  const qid = question.question_id
  const values = Array.isArray(answer.value) ? answer.value : [answer.value]
  const primary = values[0] ?? ''
  const isUncertain = UNCERTAIN_MARKERS.some((m) => normAr(primary).includes(normAr(m)))
  const eq = isUncertain ? 0.4 : question.answer_type === 'short_text' ? 0.6 : 0.9

  // 1) تأثيرات صريحة لكل خيار
  const effects = optionEffects[qid]
  if (effects) {
    for (const v of values) {
      const eff = effects[v]
      if (!eff) {
        factsRaw[`${qid}:${v}`] = v
        continue
      }
      for (const [key, code] of Object.entries(eff)) {
        putFact(facts, key, code, qid, eq, v)
      }
    }
    return
  }

  // 2) معالجات نوعية موثقة
  switch (question.answer_type) {
    case 'likert_5': {
      const idx = question.options_ar.indexOf(primary)
      const score = idx >= 0 ? idx + 1 : 3
      const key = question.measures[0]
      if (key) interestVector[key] = score
      return
    }
    case 'skill_level_5': {
      const idx = question.options_ar.indexOf(primary)
      const score = idx >= 0 ? idx + 1 : 1
      const key = question.measures[0]
      if (key && skillSlugs.has(key)) {
        skillVector[key] = score
      } else if (key) {
        putFact(facts, key, score, qid, eq, primary)
      }
      return
    }
    case 'rank_top3': {
      const key = question.measures[0]
      if (key) putFact(facts, key, values.slice(0, 3), qid, eq)
      return
    }
    case 'single_choice_or_text':
    case 'short_text': {
      const code = classifyByKeywords(qid, primary)
      if (code) {
        const key = keywordClassifiers[qid].fact_key
        putFact(facts, key, code, qid, 0.7, primary)
      }
      for (const key of question.measures) factsRaw[key] = primary
      return
    }
    case 'single_choice':
    case 'multi_choice': {
      // خيار بلا تأثير صريح: رتبي عام (ترتيب الخيار كمقياس 1..n) أو خام
      const key = question.measures[0]
      if (!key) return
      if (question.answer_type === 'single_choice') {
        const idx = question.options_ar.indexOf(primary)
        if (idx >= 0) putFact(facts, key, idx + 1, qid, eq, primary)
        else factsRaw[key] = primary
      } else {
        putFact(facts, key, values, qid, eq)
      }
      return
    }
  }
}

/** قواعد اشتقاق موثقة — تطبق بعد كل إجابة (idempotent) */
export function applyDerivedRules(facts: FactBag) {
  const g = (k: string) => facts[k]?.value
  // employment_advancement → first_job | promotion
  // القاعدة إعادة-تقييمية: تعمل أيضا على القيمتين المحسومتين لأن حالة العمل قد تصل
  // لاحقا (ترتيب الأسئلة تكيفي)، والقيمتان لا تأتيان إلا من هذه القاعدة.
  const goalVal = g('primary_goal')
  if (typeof goalVal === 'string' && ['employment_advancement', 'first_job', 'promotion'].includes(goalVal)) {
    const persona = g('persona_type')
    const emp = g('employment_state')
    const resolved =
      (persona === 'student' || persona === 'early_career') && (emp === 'not_working' || (emp === undefined && persona === 'student'))
        ? 'first_job'
        : emp === undefined
          ? goalVal // لا حسم بلا دليل — يبقى قابلا لإعادة التقييم
          : 'promotion'
    const src = facts.primary_goal
    facts.primary_goal = { ...src, value: resolved }
  }
  // business_launch → revenue_growth عند نضج المشروع
  if (g('primary_goal') === 'business_launch') {
    const stage = g('business_stage')
    if (stage === 'growing' || stage === 'established') {
      facts.primary_goal = { ...facts.primary_goal, value: 'revenue_growth' }
    }
  }
  // employee + قيادة → manager
  if (g('persona_type') === 'employee') {
    const lc = g('leadership_context')
    if (typeof lc === 'string' && lc !== 'none' && lc !== '') {
      facts.persona_type = { ...facts.persona_type, value: 'manager' }
    }
  }
  // founder + عمل حر → freelancer
  if (g('persona_type') === 'founder' && g('employment_state') === 'self_employed') {
    facts.persona_type = { ...facts.persona_type, value: 'freelancer' }
  }
}

/**
 * حقائق حاسمة للقرار: فقدانها يمنع التوقف المبكر (قبل الحد الأقصى).
 * موثق: هدف «وظيفة أو ترقية» لطالب/خريج لا يُحسم (أول وظيفة أم ترقية) دون حالة العمل،
 * وهدف «مشروع أو دخل» لا يُحسم (إطلاق أم نمو) دون مرحلة المشروع.
 */
export function decisionCriticalMissing(facts: FactBag): string[] {
  const missing: string[] = []
  const goal = facts['primary_goal']?.value
  const persona = facts['persona_type']?.value
  // القاعدة المشتقة تعيد كتابة employment_advancement إلى first_job/promotion فورا،
  // لذا نفحص القيم الثلاث — الأصل والمحسومان بلا دليل حالة عمل بعد.
  const advancementGoals = ['employment_advancement', 'first_job', 'promotion']
  if (
    typeof goal === 'string' &&
    advancementGoals.includes(goal) &&
    (persona === 'student' || persona === 'early_career') &&
    facts['employment_state'] === undefined
  ) {
    missing.push('employment_state')
  }
  if (goal === 'business_launch' && facts['business_stage'] === undefined) {
    missing.push('business_stage')
  }
  return missing
}

export function questionOf(answer: Answer): BankQuestion | null {
  return questionById.get(answer.questionId) ?? null
}
