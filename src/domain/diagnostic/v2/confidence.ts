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

/** أدنى نسبةٍ من **الممكن قياسُه** لفتح «تطابق قوي».
    ستّون لا خمسون: العتبةُ ترتفع لأنّ المسطرةَ صارت أقصرَ وأصدق — ومن قِيس
    ستّون بالمئة ممّا يمكن قياسُه فيه، قِيس فيه ما يُعتدّ به. */
export const STRONG_MEASURABLE_COVERAGE_MIN = 0.6

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
  /* المسطرةُ التي يُعاير عليها المانعُ وحدَه — لا حسابُ الثقة، فذاك يبقى على
     التغطية الكاملة: الرقمُ المعروضُ لا يتضخّم بتغيير مقامه. */
  const measurableCoverage = top ? top.measurableSkillCoverage : 0
  const hasDirectEvidence = top ? top.hasDirectSkillEvidence : false
  const trackFit = top ? Math.min(1, top.total / 0.85) : 0
  /* لا منافس = فصلٌ تام لا نصف غموض.
     كان المرشح المنفرد يُحتسب 0.5 — أي أن أقوى دليل ممكن على وضوح التوصية (ألا
     ينجو منافس أصلا) يُسجَّل عدمَ يقين. وظل العيب مستترا لأن كيانا بلا جمهور
     معلن كان ينافس الجميع فيملأ المقعد الثاني؛ فلما أُغلق ذلك الباب انكشف أن
     معايرة «تطابق قوي» كانت قائمة على منافس وهمي. */
  const uncontested = candidates.length < 2
  const separation = uncontested
    ? 1
    : Math.min(1, Math.max(0, (candidates[0].total - candidates[1].total) / 0.15))
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
  /* ═══════ «تطابق قوي» — قياسٌ بمسطرةٍ نملكها ═══════

     الشرطُ كان: نصفُ **كلّ** مهارات المسار مقيسٌ بدليل مباشر. وهو ادّعاءُ
     معرفةٍ لا يُمنح بأقلَّ منه — لكنّه قياسٌ بمسطرةٍ لا نملكها: البنكُ يقيس
     تسعا وثلاثين مهارة، ولو أجاب المتعلّمُ عن **كلّ** سؤالٍ فيه لبلغ أعلى
     مسارٍ من العشرين **٤٤٪**، ومتوسّطُ العشرين **٢٦٪**. **ولا مسارَ واحدٌ
     يبلغ الخمسين.** فكانت الدرجةُ العليا غيرَ موجودةٍ لا صعبةَ المنال:
     صفرٌ من عشرة آلاف جلسة، والمانعُ يُطلَق في مئةٍ بالمئة منها.

     والعلاجُ ليس تخفيضَ العتبة إرضاءً للرقم — بل تغييرَ ما تُقاس عليه:
     **ستّون بالمئة ممّا نستطيع قياسَه** لهذا المسار. سؤالٌ له جوابٌ صادق،
     وسقفُه المئة، ويُعاقِب التفريطَ فيما نملك لا الفقرَ فيما لا نملك.

     ── وشرطان لا واحد ──

     ورفعُ التغطية بالترجيح وحدَه (تقييمُ المتعلّم لعائلات مهاراته) لا يفتح
     الدرجةَ العليا: «قويّ» ادّعاءُ **معرفة**، ومن قيّم نفسَه لم يُقَس. فلا
     تُفتح إلّا ومعها **مهارةٌ واحدةٌ مقيسةٌ مباشرةً على الأقلّ**.

     ── وما يُقال للمتعلّم ──

     العبارةُ تصف ما فُعل لا ما يُدَّعى: «قِسنا ما نستطيع قياسَه» — لا
     «نعرفك». والفرقُ بينهما هو الفرقُ بين وعدٍ يُوفى وآخرَ لا يُوفى. */
  if (measurableCoverage < STRONG_MEASURABLE_COVERAGE_MIN) {
    blockers.push('لم نقس ما نستطيع قياسه من مهارات المسار المتصدر بعد.')
  } else if (!hasDirectEvidence) {
    blockers.push('تقديرك لعائلات مهاراتك رجّح ولم يَقِس — سؤالُ مهارةٍ واحدٌ يفتح الدرجةَ العليا.')
  }
  if (separation < 0.5) blockers.push('الفارق بين أول مرشحين ضيق.')
  if (highSev > 0) blockers.push('يوجد تناقض جوهري غير محسوم بين إجاباتك.')

  let outputKind: ConfidenceV2['outputKind']
  if (overall >= OUTPUT_THRESHOLDS.strong && blockers.length === 0) outputKind = 'strong_match'
  else if (overall >= OUTPUT_THRESHOLDS.bestCurrent) outputKind = 'best_current_match'
  else if (overall >= OUTPUT_THRESHOLDS.exploratory) outputKind = 'exploratory_direction'
  else outputKind = 'advisor_review'

  /* ═══ العبارةُ تقول أساسَها ═══

     «تطابق قوي» تُقرأ «نعرفك». وهي بهذا المعنى غيرُ صحيحةٍ اليوم مهما
     عايرنا: البنكُ يقيس سبعا وعشرين مهارةً، ومتوسّطُ ما يمكن قياسُه من
     مهارات المسار الواحد **٢٠٪**. فمن قِيس فيه كلُّ ما نستطيع قياسَه ما
     زال ثلاثةُ أرباع مهارات مساره مجهولةً عندنا.

     فإمّا أن تبقى الدرجةُ العليا خانةً ميّتةً لا تُمنح أبدا — وهو ما كان،
     صفرٌ من عشرة آلاف — وإمّا أن تُقال بمعناها الصحيح: **«تطابقٌ قويّ بما
     قِسناه»**. الثانيةُ أصدق: الرقمُ يقول ما قِيس، والعبارةُ تقول على أيّ
     أساس، ولا يُدَّعى علمٌ بما لم يُقَس. */
  const outputKind_ar = {
    strong_match: 'تطابق قوي بما قِسناه',
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
    evidenceBasis: {
      measured: top?.measurableMeasuredCount ?? 0,
      measurable: top?.measurableRequiredCount ?? 0,
      unknown: top?.unknownSkillSlugs.length ?? 0,
    },
  }
}
