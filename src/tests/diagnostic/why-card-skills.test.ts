/* بطاقةُ «لماذا هذا المسار»: الشريطُ يُسمّى بما يقيسه، والسطرُ الأخيرُ لا يقول
   «مستقرة» بلا أساسها ولا يَعِد بما لا يُوفى.

   قرارُ صاحب المنصّة (٤ أكتوبر ٢٠٢٦) بعد أن رأى البطاقةَ حيّةً على صفحة المسار:
   «افعل الاثنين» — اسمُ الشريط، والسطرُ الأخير.

   ① الشريطُ الخامسُ اسمُه «ثبات النتيجة» ورقمُه **ما قِسناه من كلّ مهارات
      المسار**: يملؤه V2 وV2.1 بـ`skillEvidenceCoverage` في `toLegacyConfidence`.
      فقرأ المتعلّمُ «ثبات النتيجة ٢٦٪» وتحتها «النتيجة مستقرة». والرقمُ صادقٌ
      وباقٍ كما قرّره المحرّك (سقفُه دون النصف بالبنية — يحرسه
      `strong-match-reachable.test.ts`)؛ الاسمُ وحدَه كان كاذبا. ونتيجةُ V1 — بلا
      `evidence_basis` — رقمُها ثباتُها هي (عددُ الإجابات على ١٢)، فيبقى لها اسمُها.

   ② و«النتيجة مستقرة» كانت تُقال لمن لم يُقَس فيه شيء: الخبيرُ والمدرّبُ في رحلات
      المحرّك أدناه يُقاس فيهما **صفرٌ من أربع** مهاراتٍ يمكن قياسُها، والمانعُ في
      البطاقة نفسِها يقول «لم نقس ما نستطيع قياسه» — والسطرُ تحته «مستقرة».
      فصار:
      · دون عتبة المحرّك نفسِه (`STRONG_MEASURABLE_COVERAGE_MIN` من الممكن قياسُه):
        «قياسُ ما بقي … قد يقوّي التوصيةَ أو يغيّرها» — وهو المانعُ الذي يحجب
        الدرجةَ العليا، فالقولُ صادق.
      · ومن قِيس فيه كلُّ ما نستطيع (٥ من ٥، كالطالب): لا يُوعَد بأنّ مهاراتٍ أكثر
        تقوّيها — فالباقي لا يقيسه التشخيصُ أصلا — بل يُقال أساسُ الاستقرار:
        «مستقرة بما قِسناه»، عبارةُ المحرّك نفسِه في «تطابق قوي بما قِسناه».

   والفحصُ على المرسوم وعلى مخرَج المحرّك لا على المصدر. */

import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createEngineV21, type RecommendationV21 } from '../../domain/diagnostic/v2_1'
import { Q, NEEDS_V21, type CareerStage } from '../../domain/diagnostic/v2_1/maps'
import { STRONG_MEASURABLE_COVERAGE_MIN } from '../../domain/diagnostic/v2/confidence'
import { buildChangeMakers } from '../../domain/diagnostic/explanation'
import { WhyThisPathway } from '../../pages/diagnostic/ResultPlanCards'

const STABLE = 'النتيجة مستقرة؛ تغييرها يتطلب تغيير هدفك أو وقتك أو أدلة مهاراتك.'
const STABLE_BY_MEASURED = 'النتيجة مستقرة بما قِسناه؛ تغييرها يتطلب تغيير هدفك أو وقتك أو أدلة مهاراتك.'
const MEASURE_REST = 'قياسُ ما بقي من مهارات المسار ممّا نستطيع قياسَه قد يقوّي التوصيةَ أو يغيّرها.'
const SKILL_BLOCKER = 'لم نقس ما نستطيع قياسه من مهارات المسار المتصدر بعد.'
const SKILLS_LABEL = 'ما قِسناه من مهارات المسار'

/** «مستقرة» بلا أساسها — بالبنية لا بنصٍّ حرفيّ: يسقط على أيّ صياغةٍ تحذف القيد */
const bareStable = (m: string) => m.startsWith('النتيجة مستقرة') && !m.includes('بما قِسناه')

describe('① الشريطُ الخامسُ يُسمّى بما يقيسه — في البطاقة المرسومة', () => {
  const conf = { coverage: 0.9, consistency: 1, separation: 1, evidenceQuality: 0.9, stability: 5 / 19, total: 0.83 }
  const card = (basis: { measured: number; measurable: number; unknown: number } | null) =>
    renderToStaticMarkup(
      createElement(WhyThisPathway, {
        reasons: ['هدفك: أول فرصة مهنية.'], confidence: conf, bandAr: 'جيدة', basis, changeMakers: [],
      }),
    )
  /** رقمُ الشريط الذي اسمُه `label`: الاسمُ عقدةُ نصٍّ تامّة، ثمّ أوّلُ نسبةٍ بعده */
  const bar = (html: string, label: string): number | null => {
    const at = html.indexOf(`>${label}<`)
    if (at < 0) return null
    const m = html.slice(at).match(/(\d+)(?:<!-- -->)?٪/)
    return m ? Number(m[1]) : null
  }

  it('نتيجةُ V2.1: «ما قِسناه من مهارات المسار ٢٦٪» — لا «ثبات النتيجة»', () => {
    const html = card({ measured: 5, measurable: 5, unknown: 14 })
    expect(bar(html, SKILLS_LABEL), 'الشريطُ لا يحمل اسمَ ما يقيسه').toBe(26)
    expect(bar(html, 'ثبات النتيجة'), 'ما زال «ثبات النتيجة» اسما لنسبة المهارات المقيسة').toBeNull()
  })

  it('ونتيجةُ V1 بلا أساسٍ يبقى لها اسمُها — فرقمُها ثباتُها هي', () => {
    const html = card(null)
    expect(bar(html, 'ثبات النتيجة')).toBe(26)
    expect(bar(html, SKILLS_LABEL), 'سُمّي رقمُ V1 بما لا يقيسه').toBeNull()
  })
})

describe('② السطرُ الأخير: العتبةُ عتبةُ المحرّك نفسُها', () => {
  const rec = {
    confidence: { coverage: 0.9, consistency: 1, separation: 1, evidenceQuality: 0.9, stability: 0.2, total: 0.8, band: 'good', band_ar: 'جيدة' },
    primaryPathway: null,
  } as unknown as Parameters<typeof buildChangeMakers>[0]
  const measurable = 5
  const atGate = [...Array(measurable + 1).keys()].find((m) => m / measurable >= STRONG_MEASURABLE_COVERAGE_MIN)!

  it('دون العتبة بمهارةٍ واحدة: قياسُ الباقي — ولا «مستقرة»', () => {
    const makers = buildChangeMakers(rec, { measured: atGate - 1, measurable, unknown: 14 })
    expect(makers[0]).toBe(MEASURE_REST)
    expect(makers.filter((m) => m.startsWith('النتيجة مستقرة'))).toEqual([])
  })

  it('وعند العتبة فما فوقها: «مستقرة بما قِسناه» — بلا وعدٍ بمهاراتٍ أكثر', () => {
    expect(buildChangeMakers(rec, { measured: atGate, measurable, unknown: 14 })).toEqual([STABLE_BY_MEASURED])
    expect(buildChangeMakers(rec, { measured: measurable, measurable, unknown: 14 })).toEqual([STABLE_BY_MEASURED])
  })

  it('ومسارٌ لا يقيس التشخيصُ شيئا من مهاراته: لا وعدَ بقياس، والاستقرارُ بأساسه', () => {
    expect(buildChangeMakers(rec, { measured: 0, measurable: 0, unknown: 9 })).toEqual([STABLE_BY_MEASURED])
  })

  it('ونتيجةُ V1 بلا أساسٍ يبقى سطرُها كما كان', () => {
    expect(buildChangeMakers(rec)).toEqual([STABLE])
  })
})

/* ── رحلاتُ المحرّك الحيّ (V2.1) — المشغّلُ نفسُه في `human-journeys.test.ts` ── */

const STAGE_LABEL: Record<CareerStage, string> = {
  university_student: 'طالب جامعي',
  fresh_graduate: 'خريج حديث',
  early_career: 'موظف في بداية مساري المهني',
  experienced: 'موظف ذو خبرة',
  manager: 'مدير / قائد فريق',
  senior_manager: 'مدير أول / تنفيذي',
  founder: 'مؤسس / صاحب عمل',
  freelancer: 'مستقل — أعمل لحسابي',
  trainer_ld: 'مدرب / معلم / مختص تعلم وتطوير',
  other_unsure: 'غير ذلك / غير متأكد',
}
const needLabel = (code: string): string => NEEDS_V21.find((n) => n.code === code)!.label_ar

interface Journey { stage: CareerStage; employment?: string; goal: string; need: string; skillLevel: number }

function runJourney(name: string, j: Journey): RecommendationV21 {
  const engine = createEngineV21(`why-skills-${name}`)
  for (let i = 0; i < 20; i++) {
    const step = engine.nextQuestion()
    if (step.stop.shouldStop || !step.question) break
    const q = step.question
    const byLabel = (l: string): number => q.options_ar.indexOf(l)
    let idx: number
    if (q.question_id === Q.STAGE) idx = byLabel(STAGE_LABEL[j.stage])
    else if (q.question_id === Q.EMPLOYMENT) idx = byLabel(j.employment ?? 'أعمل لدى جهة')
    else if (q.question_id === Q.GOAL) idx = byLabel(j.goal)
    else if (q.question_id === Q.NEED) idx = byLabel(j.need)
    else if (q.question_id === Q.MASTERY) idx = byLabel('غير متأكد')
    else if (q.answer_type === 'skill_level_5' || q.answer_type === 'likert_5') idx = j.skillLevel - 1
    else idx = 0
    if (idx < 0) idx = 0
    engine.answer({ questionId: q.question_id, value: q.options_ar[idx], optionIds: [q.active_option_ids?.[idx] ?? `o${idx + 1}`] })
  }
  return engine.recommend()
}

const JOURNEYS: [string, Journey][] = [
  ['طالب', { stage: 'university_student', employment: 'لا أعمل حاليًا', goal: 'الحصول على أول وظيفة', need: needLabel('need_employability'), skillLevel: 2 }],
  ['خريج', { stage: 'fresh_graduate', employment: 'لا أعمل حاليًا', goal: 'الحصول على أول وظيفة', need: needLabel('need_employability'), skillLevel: 2 }],
  ['مبتدئ', { stage: 'early_career', goal: 'بناء مهارات عملية يطلبها سوق العمل', need: needLabel('need_ai'), skillLevel: 3 }],
  ['خبير', { stage: 'experienced', goal: 'التقدم أو الترقية في عملي', need: needLabel('need_projects'), skillLevel: 4 }],
  ['مدير', { stage: 'manager', goal: 'الاستعداد لدور قيادي', need: needLabel('need_leadership'), skillLevel: 4 }],
  ['مؤسس', { stage: 'founder', employment: 'لدي مشروعي الخاص', goal: 'بدء مشروع أو مصدر دخل مستقل', need: needLabel('need_business'), skillLevel: 3 }],
  ['مستقل', { stage: 'freelancer', employment: 'أعمل لحسابي (عمل حر)', goal: 'زيادة دخلي وعملائي في العمل الحر', need: needLabel('need_sales'), skillLevel: 3 }],
  ['مدرب', { stage: 'trainer_ld', goal: 'تطوير مهارة محددة أعرفها', need: needLabel('need_learning_design'), skillLevel: 4 }],
  ['غير-محسوم', { stage: 'other_unsure', employment: 'لا أعمل حاليًا', goal: 'غير متأكد — أريد أن يساعدني التشخيص', need: needLabel('need_unsure'), skillLevel: 2 }],
  ['محوّل-مسار', { stage: 'experienced', goal: 'تغيير مساري المهني', need: needLabel('need_data'), skillLevel: 2 }],
  ['تجربة-عميل', { stage: 'manager', goal: 'تحسين أدائي في عملي الحالي', need: needLabel('need_customer_experience'), skillLevel: 3 }],
  ['سيبراني', { stage: 'manager', goal: 'تطوير مهارة محددة أعرفها', need: needLabel('need_cyber'), skillLevel: 3 }],
]

describe('② السطرُ الأخيرُ في رحلات المحرّك الحيّ', () => {
  const runs = JOURNEYS.map(([name, j]) => ({ name, rec: runJourney(name, j) }))
  /** مخرَجُ V2 للتوصية — وغيابُه سقوطٌ صريحٌ لا تخطٍّ صامت */
  const v2Of = (rec: RecommendationV21) => {
    if (!rec.v2) throw new Error('توصيةٌ بلا مخرَج V2 — لا أساسَ يُقرأ ولا مانع')
    return rec.v2
  }
  const basisOf = (rec: RecommendationV21) => v2Of(rec).confidence.evidenceBasis

  it('ما بقي من مهارات المسار مجهولٌ: لا «مستقرة» بلا أساسها', () => {
    for (const { name, rec } of runs) {
      if (basisOf(rec).unknown === 0) continue
      expect(rec.change_makers_ar.filter(bareStable), `${name}: «مستقرة» و${basisOf(rec).unknown} مهارةً مجهولة`).toEqual([])
    }
  })

  it('وحيث يحجب المانعُ الدرجةَ العليا لنقص القياس، يقول السطرُ إنّ قياسَ الباقي قد يقوّيها', () => {
    for (const { name, rec } of runs) {
      const blocked = v2Of(rec).confidence.strongBlockers_ar.includes(SKILL_BLOCKER)
      expect(rec.change_makers_ar.includes(MEASURE_REST), `${name}: المانعُ ${blocked ? 'قائم' : 'غائب'} والسطرُ ${blocked ? 'لا يذكره' : 'يذكره'}`).toBe(blocked)
    }
  })

  it('والحالتان واقعتان فعلا أوّلَ سطرٍ يُعرض — لا حارسَ على فراغ', () => {
    const first = (name: string) => runs.find((r) => r.name === name)!.rec.change_makers_ar[0]
    const b = basisOf(runs.find((r) => r.name === 'طالب')!.rec)
    expect(b.measured, 'الطالبُ لم يعد يُقاس فيه كلُّ ما نستطيع — يُراجَع الحارس').toBe(b.measurable)
    expect(first('طالب')).toBe(STABLE_BY_MEASURED)
    expect(basisOf(runs.find((r) => r.name === 'خبير')!.rec).measured, 'صار الخبيرُ يُقاس — يُراجَع الحارس').toBe(0)
    expect(first('خبير')).toBe(MEASURE_REST)
  })
})
