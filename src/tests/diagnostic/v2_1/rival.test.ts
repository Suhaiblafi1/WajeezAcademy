/* المنافسُ الحقُّ للمتصدّر — امتدادٌ لا يؤهَّل له المتعلّمُ ليس منافسا.

   ═══ القرار (٣٠ سبتمبر ٢٠٢٦) ═══

   بعد دمج دورات «التحضير لأول وظيفة» صار القالبُ TPL-FIRST-JOB-001 — المسارُ
   PW-STU-002 كلُّه ودورةٌ فوقه — ثانيَ المرشّحين بفارقٍ ضيّق، فسُحبت «قوية بما
   قِسناه» من الخرّيج القويّ. وقرّر صاحبُ المنصّة إعادتَها: «Restore the label».
   والقاعدةُ في `rivalOfTop`، وسببُ حدودها مشروحٌ عندها.

   ═══ وما يُحرَس ═══

   ① القاعدةُ نفسُها على كياناتٍ حقيقيّة: يُتخطّى الامتدادُ الذي لا يؤهَّل له
      وحدَه — لا الذي يؤهَّل له، ولا مركّبٌ يشارك المسارَ بعضَ دوراته، ولا
      مسارٌ قياسيّ، ولا شيءَ إن تصدّر مركّب.
   ② وفي رحلةٍ حقيقيّةٍ يختلف فيها جوابٌ واحد: متعلّمٌ واحدٌ ووظيفتان — فيُتخطّى
      الامتدادُ مع الأولى، ويبقى منافسا مع الثانية التي تفتح مجالَه الثاني.
   ③ والثقةُ تقيس الفارقَ على المنافس الحقّ — وV2 بلا منافسٍ معيَّنٍ كما كان. */

import { describe, expect, it } from 'vitest'
import { createEngineV21 } from '../../../domain/diagnostic/v2_1'
import { Q } from '../../../domain/diagnostic/v2_1/maps'
import { recommendationUniverse } from '../../../domain/diagnostic/v2_1/universe'
import { extendsPathway, rivalOfTop, type EntityCandidate } from '../../../domain/diagnostic/v2_1/compete'
import { computeConfidenceV2 } from '../../../domain/diagnostic/v2/confidence'
import type { DecisionContext, V2Candidate } from '../../../domain/diagnostic/v2/types'

const universe = recommendationUniverse()
/** مرشّحٌ من كيانٍ حقيقيّ — والقاعدةُ لا تقرأ منه إلا الكيانَ وموضعَه */
const cand = (id: string, netFit: number): EntityCandidate => {
  const entity = universe.byId.get(id)
  if (!entity) throw new Error(`${id} غاب من فضاء التوصيات — يُراجَع الحارس`)
  return { entity, netFit } as unknown as EntityCandidate
}
const idOf = (c: EntityCandidate | null) => c?.entity.entity_id ?? null
const qualifiesNever = () => false
const qualifiesAlways = () => true

describe('① القاعدة: امتدادٌ لا يؤهَّل له ليس منافسا — وما عداه منافس', () => {
  const top = cand('PW-STU-002', 0.9)
  const extension = cand('TPL-FIRST-JOB-001', 0.85)
  const next = cand('PW-EMP-003', 0.6)

  it('امتدادٌ لا يؤهَّل له يُتخطّى إلى من بعده — وإن لم يبقَ أحدٌ فلا منافس', () => {
    expect(extendsPathway(extension, top), 'القالبُ لم يعد يحوي دوراتِ المسار — تغيّر الكتالوج').toBe(true)
    expect(idOf(rivalOfTop([top, extension, next], qualifiesNever))).toBe('PW-EMP-003')
    expect(rivalOfTop([top, extension], qualifiesNever)).toBeNull()
  })

  it('وامتدادٌ يؤهَّل له يبقى منافسا — «المسارُ وحدَه أم ومعه دورة؟» خيارٌ حقيقيّ', () => {
    expect(idOf(rivalOfTop([top, extension, next], qualifiesAlways))).toBe('TPL-FIRST-JOB-001')
  })

  it('ومركّبٌ يشارك المسارَ بعضَ دوراته ليس امتدادا — فيبقى منافسا ولو لم يؤهَّل له', () => {
    const partial = cand('TPL-PERSONAL-BRAND-001', 0.85)
    expect(partial.entity.required_courses.some((c) => top.entity.required_courses.includes(c)), 'لم يعد يشارك المسارَ دورة — يُختار غيرُه').toBe(true)
    expect(extendsPathway(partial, top)).toBe(false)
    expect(idOf(rivalOfTop([top, partial], qualifiesNever))).toBe('TPL-PERSONAL-BRAND-001')
  })

  it('والمسارُ القياسيُّ منافسٌ دائما — ولا يُتخطّى شيءٌ إن تصدّر مركّب', () => {
    expect(idOf(rivalOfTop([top, cand('PW-EMP-003', 0.85)], qualifiesNever))).toBe('PW-EMP-003')
    /* المركّبُ متصدّرا والمسارُ الذي يحويه ثانيا: القاعدةُ لامتداد المسار المتصدّر وحدَه */
    expect(idOf(rivalOfTop([cand('TPL-FIRST-JOB-001', 0.9), cand('PW-STU-002', 0.85)], qualifiesNever))).toBe('PW-STU-002')
  })

  it('والنوعان شرطٌ لا الدوراتُ وحدَها — مسارٌ يحوي مسارا، أو مركّبٌ يحوي مركّبا، منافسٌ', () => {
    /* لا زوجَ كهذا في الكتالوج اليوم، فيُصنع: لولا شرطُ النوع لتُخطّي مسارٌ قياسيٌّ
       يستطيع الفوزَ دائما، ولتُخطّي مركّبٌ تحت مركّبٍ متصدّر */
    const fake = (id: string, type: 'standard' | 'composite', courses: string[], netFit: number) =>
      ({ entity: { entity_id: id, entity_type: type, required_courses: courses }, netFit }) as unknown as EntityCandidate
    const small = ['C-X-1', 'C-X-2']
    const big = [...small, 'C-X-3']
    expect(idOf(rivalOfTop([fake('P1', 'standard', small, 0.9), fake('P2', 'standard', big, 0.85)], qualifiesNever))).toBe('P2')
    expect(idOf(rivalOfTop([fake('T1', 'composite', small, 0.9), fake('T2', 'composite', big, 0.85)], qualifiesNever))).toBe('T2')
    /* والضابط: الشكلُ نفسُه بنوعَي القاعدة يُتخطّى — فالسطران أعلاه يسقطان بالنوع لا بغيره */
    expect(rivalOfTop([fake('P1', 'standard', small, 0.9), fake('T2', 'composite', big, 0.85)], qualifiesNever)).toBeNull()
  })
})

/** رحلةُ موظّفٍ في بداية مساره يحتاج إدارةَ المشاريع — ولا يختلف فيها إلا جوابُ الوظيفة */
function projectJourney(fn: string) {
  const engine = createEngineV21(`rival-${fn}`)
  const byLabel: Record<string, string> = {
    [Q.STAGE]: 'موظف في بداية مساري المهني',
    [Q.GOAL]: 'بناء مهارات عملية يطلبها سوق العمل',
    [Q.NEED]: 'إدارة المشاريع',
    'QB-M3B-011': fn,
  }
  const asked: string[] = []
  for (let i = 0; i < 25; i++) {
    const step = engine.nextQuestion()
    if (step.stop.shouldStop || !step.question) break
    const q = step.question
    const label = byLabel[q.question_id]
    const idx = label !== undefined ? q.options_ar.indexOf(label) : q.answer_type === 'skill_level_5' || q.answer_type === 'likert_5' ? 2 : 0
    if (idx < 0) throw new Error(`${q.question_id}: «${label}» ليس بين خياراته — تغيّر البنك`)
    asked.push(q.question_id)
    engine.answer({ questionId: q.question_id, value: q.options_ar[idx], optionIds: [q.active_option_ids?.[idx] ?? `o${idx + 1}`] })
  }
  return { asked, comp: engine.competeSnapshot() }
}

describe('② في رحلةٍ حقيقيّة: جوابٌ واحدٌ يفتح المجالَ الثاني فيعود الامتدادُ منافسا', () => {
  it('وظيفةٌ في خدمة الجمهور: الامتدادُ ثانٍ ولا يؤهَّل له — فالمنافسُ من بعده', () => {
    const { asked, comp } = projectJourney('خدمة جمهور')
    expect(asked, 'لم يُسأل سؤالُ الوظيفة — فالرحلةُ لا تمتحن الفرق').toContain('QB-M3B-011')
    const [top, second] = comp.candidates
    expect([top?.entity.entity_id, second?.entity.entity_id]).toEqual(['PW-EMP-003', 'TPL-STRATEGY-001'])
    expect(extendsPathway(second!, top!), 'TPL-STRATEGY-001 لم يعد امتدادا للمسار').toBe(true)
    expect(comp.rival, 'الامتدادُ الذي لا يؤهَّل له عُدّ منافسا').not.toBe(second)
    expect(comp.rival).toBe(comp.candidates[2] ?? null)
  })

  it('ووظيفةٌ في الموارد البشرية: مجالُ القيادة يُفتح فيؤهَّل للامتداد — فيبقى المنافس', () => {
    const { asked, comp } = projectJourney('موارد بشرية')
    expect(asked).toContain('QB-M3B-011')
    const [top, second] = comp.candidates
    expect([top?.entity.entity_id, second?.entity.entity_id]).toEqual(['PW-EMP-003', 'TPL-STRATEGY-001'])
    expect(comp.rival, 'امتدادٌ يؤهَّل له تُخطّي').toBe(second)
  })
})

describe('③ والثقةُ تقيس الفارقَ على المنافس الحقّ', () => {
  const v2 = (id: string, total: number) => ({
    pathwayId: id, total, measuredSkillCoverage: 0, measurableSkillCoverage: 0, hasDirectSkillEvidence: false,
    measurableRequiredCount: 0, measurableMeasuredCount: 0, gapSkillSlugs: [], masteredSkillSlugs: [], unknownSkillSlugs: [],
    reasons_ar: [], breakdown: { persona: 0, goal: 0, domain: 0, skillGap: null, feasibility: 0, motivation: 0 },
  }) as V2Candidate
  const ctx = { facts: {}, persona: { key: 'student', confidence: 1 }, domains: { confidence: 1, scores: {} }, skillStates: new Map() } as unknown as DecisionContext
  const top = v2('A', 0.9)
  const close = v2('B', 0.85)
  const further = v2('C', 0.8)
  const separation = (rival?: V2Candidate | null) => computeConfidenceV2({}, [], ctx, [top, close, further], rival).separation

  it('بلا منافسٍ معيَّن فالثاني في القائمة — كما كان في V2', () => {
    expect(separation()).toBeCloseTo(0.05 / 0.15, 6)
  })
  it('ومنافسٌ معيَّنٌ يُقاس عليه — و`null` سباقٌ بلا منافس', () => {
    expect(separation(further)).toBeCloseTo(0.1 / 0.15, 6)
    expect(separation(null)).toBe(1)
  })
})
