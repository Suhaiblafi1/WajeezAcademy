/* الثقة المركبة V2 — ثمانية مكونات، ومخرجات صادقة بلا اختلاق دقة:
   Strong Match / Best Current Match / Exploratory Direction / Advisor Review. */

import type { Contradiction, FactBag } from '../types'
import { DOMAIN_CONFIDENCE_MIN } from './domains'
import type { ConfidenceV2, DecisionContext, V2Candidate } from './types'

const WEIGHTS = {
  persona: 0.15,
  goal: 0.15,
  domain: 0.15,
  skillEvidenceCoverage: 0.15,
  trackFit: 0.1,
  separation: 0.1,
  consistency: 0.1,
  evidenceQuality: 0.1,
} as const

/* عتبات المخرجات — موثقة وقابلة للمراجعة */
export const OUTPUT_THRESHOLDS = {
  strong: 0.78,
  bestCurrent: 0.6,
  exploratory: 0.4,
} as const

const GOAL_CLARITY_SCORE: Record<string, number> = { high: 1, medium: 0.65, low: 0.25 }

export function computeConfidenceV2(
  facts: FactBag,
  contradictions: Contradiction[],
  ctx: DecisionContext,
  candidates: V2Candidate[],
): ConfidenceV2 {
  const persona = ctx.persona.confidence
  const goalClarity = facts['goal_clarity']?.value as string | undefined
  const goal = facts['primary_goal'] === undefined ? 0 : GOAL_CLARITY_SCORE[goalClarity ?? 'medium'] ?? 0.5
  const domain = ctx.domains.confidence
  const top = candidates[0]
  const skillEvidenceCoverage = top ? top.measuredSkillCoverage : 0
  const trackFit = top ? Math.min(1, top.total / 0.85) : 0
  const separation =
    candidates.length >= 2 ? Math.min(1, Math.max(0, (candidates[0].total - candidates[1].total) / 0.15)) : 0.5
  const unresolved = contradictions.filter((c) => !c.resolved)
  const highSev = unresolved.filter((c) => c.severity === 'high').length
  const consistency = Math.max(0, 1 - (unresolved.length - highSev) * 0.15 - highSev * 0.35)
  const values = Object.values(facts)
  const evidenceQuality = values.length === 0 ? 0 : values.reduce((s, v) => s + v.evidenceQuality, 0) / values.length

  /* معايرة إغلاق منطق V2.1: في سباق مريح (separation = 1) لا يمكن لدليل مهارة
     أن يقلب النتيجة، فلا تُقاس المهارات عمدًا — احتساب تغطيتها صفرًا في المجموع
     جعل «تطابق قوي» مستحيلًا في 10 آلاف جلسة (حتى مع blocker معاير). العلاج
     المطابق للعقيدة: وزن التغطية يُستثنى من المقام في السباق المريح ويُعاد
     التطبيع — لا مكافأة ولا عقوبة على مكوّن غير قراري هناك */
  const skillWeightApplicable = separation < 1
  const raw =
    persona * WEIGHTS.persona +
    goal * WEIGHTS.goal +
    domain * WEIGHTS.domain +
    (skillWeightApplicable ? skillEvidenceCoverage * WEIGHTS.skillEvidenceCoverage : 0) +
    trackFit * WEIGHTS.trackFit +
    separation * WEIGHTS.separation +
    consistency * WEIGHTS.consistency +
    evidenceQuality * WEIGHTS.evidenceQuality
  const weightSum = skillWeightApplicable ? 1 : 1 - WEIGHTS.skillEvidenceCoverage
  const overall = raw / weightSum

  /* التوصية القوية مشروطة بكل مكون واضح — نسجل مانعاتها صراحة.
     معايرة إغلاق منطق V2.1: مانع الدليل المهاري كان يطلق في السباقات المريحة
     أيضًا — حيث لا تُقاس المهارات عمدًا لأنها لا تقلب النتيجة (عقيدة «المهارة
     للفصل لا للتعزيز») — فاستحال «تطابق قوي» في 10 آلاف جلسة محاكاة كاملة.
     المعايرة: المانع يعمل في السباق الحي فقط (separation < 1 أي هامش < 0.15)
     حيث يمكن لمهارة مجهولة أن تقلب الفائز؛ السباق المريح فوزه مبني على
     هدف/مجال/سياق، وحجب «قوية» عنه يعاقب المحرك على انضباطه لا على نقصه */
  const blockers: string[] = []
  if (ctx.persona.key === 'unknown' || persona < 0.6) blockers.push('لم تتضح شخصيتك التعليمية بما يكفي.')
  if (facts['primary_goal'] === undefined || goal < 0.5) blockers.push('هدفك ما زال غير واضح بما يكفي.')
  if (domain < DOMAIN_CONFIDENCE_MIN) blockers.push('المجال الأنسب لم يُحسم بعد بين أكثر من اتجاه.')
  /* معايرة إغلاق منطق V2.1 (المرحلة الثانية): المانع كان يعمل حيث separation < 1
     (هامش < 0.15) — لكن المحرك نفسه يعلن عند هامش ≥ 0.08 أن «الأسئلة المتبقية
     تخصيصية لا تغيّر النتيجة» ويتوقف. حجب «قوية» هناك يناقض قرار التوقف نفسه
     ويجعل النطاق الأعلى زخرفة لا تظهر أبدًا (صفر من 10 آلاف جلسة). الحد
     المتماسك: المانع يعمل فقط حيث يصر المحرك على المزيد من الدليل
     (هامش < 0.08 أي separation < 0.533) — هناك يمكن لمهارة مجهولة أن تقلب
     الفائز فعلًا */
  if (skillEvidenceCoverage < 0.5 && separation < 0.08 / 0.15) blockers.push('أغلب مهارات المسار المتصدر لم تُقس بدليل مباشر.')
  if (separation < 0.5) blockers.push('الفارق بين أول مرشحين ضيق.')
  if (highSev > 0) blockers.push('يوجد تناقض جوهري غير محسوم بين إجاباتك.')

  let outputKind: ConfidenceV2['outputKind']
  if (overall >= OUTPUT_THRESHOLDS.strong && blockers.length === 0) outputKind = 'strong_match'
  else if (overall >= OUTPUT_THRESHOLDS.bestCurrent) outputKind = 'best_current_match'
  else if (overall >= OUTPUT_THRESHOLDS.exploratory) outputKind = 'exploratory_direction'
  else outputKind = 'advisor_review'

  const outputKind_ar = {
    strong_match: 'تطابق قوي',
    best_current_match: 'أفضل تطابق حالي',
    exploratory_direction: 'اتجاه استكشافي',
    advisor_review: 'يستحق مراجعة مستشار',
  }[outputKind]

  return {
    persona,
    goal,
    domain,
    skillEvidenceCoverage,
    trackFit,
    separation,
    consistency,
    evidenceQuality,
    overall,
    outputKind,
    outputKind_ar,
    strongBlockers_ar: blockers,
  }
}
