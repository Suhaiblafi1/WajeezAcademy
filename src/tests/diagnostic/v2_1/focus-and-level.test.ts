/* التخصّصُ داخل المجال، والمستوى في المجال — قراراتُ صاحب المنصّة (٨ أكتوبر ٢٠٢٦).

   ١) السؤالُ الفرعيُّ لا يَعرض خيارا دورتُه لا تخدم مرحلةَ المتعلّم، ولا يُسأل
      أصلا حين لا يبقى له خيارٌ يحسم دورة — سؤالٌ أجوبتُه كلُّها واحدٌ مقعدٌ ميّت.
   ٢) الخيارُ الذي له دورةٌ يحسم النتيجة دورةً واحدة، وبديلُها من مجال احتياجه لا
      من خارجه. وما لا دورةَ له يمضي إلى السباق.
   ٣) المستوى في المجال: يُسأل باسم المجال، ومقرّراتُ المجال تُطابَق عليه لا على
      المرحلة، ويحرّك الثقةَ — ولا يختار المسار (بقرار صاحب المنصّة: «المستوى داخل
      المسار»).
   ٤) والأسئلةُ الجديدةُ خارجَ ميزانيّة الأربعة عشر.
   ٥) ومعرّفاتُ خيارات الاحتياج ثابتة: الجديدُ يُلحق في الآخر، و«غير متأكد» آخرٌ
      في العرض وحدَه.

   ⚠ أُثبت سقوطُه: (أ) نُزعت تصفيةُ الخيارات بالجمهور فسقط ١، (ب) أُعيد البديلُ
   إلى أوّل السباق بلا شرط المجال فسقط ٢، (ج) أُعيدت المطابقةُ على المرحلة وحدَها
   فسقط ٣، (د) حُسب سؤالُ المستوى من الميزانيّة فسقط ٤، (هـ) أُدرج احتياجٌ قبل
   «غير متأكد» في البنك فسقط ٥ — ثمّ أُعيد كلٌّ فخضرّ. */

import { describe, expect, it } from 'vitest'
import { createEngineV21, OUTSIDE_BUDGET, Q, NEEDS_V21 } from '../../../domain/diagnostic/v2_1'
import { FIELD_LEVELS, SUB_FOCUS, focusCourseOf } from '../../../domain/diagnostic/v2_1/focus'
import { learnerLevel } from '../../../domain/diagnostic/v2_1/course-fit'
import type { FactBag } from '../../../domain/diagnostic/types'

type Answers = Record<string, string>

function run(stage: string, goal: string, need: string, answers: Answers = {}) {
  const engine = createEngineV21(`focus-${stage}-${need}`)
  const asked: string[] = []
  const shown: Record<string, string[]> = {}
  const texts: Record<string, string> = {}
  for (let i = 0; i < 25; i++) {
    const step = engine.nextQuestion()
    if (step.stop.shouldStop || !step.question) break
    const q = step.question
    asked.push(q.question_id)
    shown[q.question_id] = q.options_ar
    texts[q.question_id] = q.text_ar
    let label: string | undefined = answers[q.question_id]
    if (q.question_id === Q.STAGE) label = stage
    else if (q.question_id === Q.GOAL) label = goal
    else if (q.question_id === Q.NEED) label = need
    const idx = label === undefined ? 0 : q.options_ar.indexOf(label)
    expect(idx, `${q.question_id}: «${label}» ليس بين الخيارات`).toBeGreaterThanOrEqual(0)
    engine.answer({ questionId: q.question_id, value: q.options_ar[idx], optionIds: [q.active_option_ids?.[idx] ?? `o${idx + 1}`] })
  }
  return { engine, asked, shown, texts, rec: engine.recommend() }
}

const CYBER = 'الأمن السيبراني وحماية البيانات'
const SALES = 'المبيعات والتعامل مع العملاء'
const opt = (qid: string, value: string) => SUB_FOCUS.find((s) => s.questionId === qid)!.options.find((o) => o.value === value)!.label_ar

describe('١) السؤالُ الفرعيُّ يحترم جمهورَ الدورات', () => {
  it('الخرّيجُ يرى الشبكاتِ والسحابة — جمهورُهما بقرار صاحب المنصّة', () => {
    const { shown } = run('خريج حديث', 'بناء مهارات عملية يطلبها سوق العمل', CYBER, { [Q.CYBER_FOCUS]: opt(Q.CYBER_FOCUS, 'networks') })
    expect(shown[Q.CYBER_FOCUS]).toEqual([opt(Q.CYBER_FOCUS, 'data_protection'), opt(Q.CYBER_FOCUS, 'networks'), opt(Q.CYBER_FOCUS, 'cloud')])
  })

  it('والمديرُ لا يُسأل أصلا — لا خيارَ له دورةٌ تخدمه، فكلُّ أجوبته واحد', () => {
    const { asked } = run('مدير / قائد فريق', 'تحسين أدائي في عملي الحالي', CYBER)
    expect(asked).not.toContain(Q.CYBER_FOCUS)
  })
})

describe('٢) الخيارُ الذي له دورةٌ يحسمها — وبديلُه من مجاله', () => {
  it('الشبكات ← دورةُ الشبكات، ولا بديلَ من خارج الأمن السيبراني', () => {
    const { rec } = run('خريج حديث', 'بناء مهارات عملية يطلبها سوق العمل', CYBER, { [Q.CYBER_FOCUS]: opt(Q.CYBER_FOCUS, 'networks') })
    expect(rec.kind).toBe('single_course')
    expect(rec.primaryPathway?.pathwayId).toBe('C-CYB-106')
    for (const a of rec.alternatives) expect(a.pathwayId.includes('CYB'), `بديلٌ من خارج المجال: ${a.pathwayId}`).toBe(true)
  })

  it('بيعُ التجزئة ← دورتُه، والبيعُ بين الشركات يمضي إلى السباق', () => {
    const retail = run('خريج حديث', 'الحصول على أول وظيفة', SALES, { [Q.SALES_CHANNEL]: opt(Q.SALES_CHANNEL, 'retail') })
    expect(retail.rec.primaryPathway?.pathwayId).toBe('C-SAL-106')
    const b2b = run('خريج حديث', 'الحصول على أول وظيفة', SALES, { [Q.SALES_CHANNEL]: opt(Q.SALES_CHANNEL, 'b2b') })
    expect(b2b.rec.primaryPathway?.pathwayId).not.toBe('C-SAL-106')
  })

  it('والبرمجةُ وتطويرُ الويب بابُ دورتها', () => {
    const { rec } = run('طالب جامعي', 'بناء مهارات عملية يطلبها سوق العمل', 'البرمجة وتطوير الويب')
    expect(rec.primaryPathway?.pathwayId).toBe('C-WEB-101')
  })
})

describe('٣) المستوى في المجال', () => {
  it('يُسأل باسم المجال الذي اختاره', () => {
    const { texts } = run('موظف ذو خبرة', 'تحسين أدائي في عملي الحالي', 'تحليل البيانات واتخاذ القرار')
    expect(texts[Q.FIELD_LEVEL]).toContain('«تحليل البيانات واتخاذ القرار»')
  })

  it('مقرّراتُ المجال تُطابَق على مستواه هناك — وما خارجه يبقى على مرحلته', () => {
    const facts = {
      career_stage: { value: 'manager', sourceQuestionId: Q.STAGE, evidenceQuality: 1 },
      need_id: { value: 'need_data', sourceQuestionId: Q.NEED, evidenceQuality: 1 },
      field_level: { value: 'none', sourceQuestionId: Q.FIELD_LEVEL, evidenceQuality: 1 },
    } as FactBag
    expect(learnerLevel(facts, new Map(), ['data_decision'])).toBe(0)
    expect(learnerLevel(facts, new Map(), ['people_leadership'])).toBe(3)
  })

  it('ويحرّك الثقةَ — ولا يختار المسار', () => {
    const lv = (i: number) => run('مدير / قائد فريق', 'تحسين أدائي في عملي الحالي', 'تحليل البيانات واتخاذ القرار', { [Q.FIELD_LEVEL]: FIELD_LEVELS[i].label_ar }).rec
    const none = lv(0)
    const lead = lv(3)
    expect(none.primaryPathway?.pathwayId).toBe(lead.primaryPathway?.pathwayId)
    expect(none.confidence.total).not.toBe(lead.confidence.total)
  })
})

describe('٤) الأسئلةُ الجديدةُ خارجَ ميزانيّة الأربعة عشر', () => {
  it('سؤالُ المستوى والسؤالُ الفرعيُّ لا يُنقصان الرحلةَ سؤالا تكيّفيّا', () => {
    expect([...OUTSIDE_BUDGET].sort()).toEqual([Q.CYBER_FOCUS, Q.FIELD_LEVEL, Q.SALES_CHANNEL].sort())
    const { asked } = run('مستقل — أعمل لحسابي', 'زيادة دخلي وعملائي في العمل الحر', SALES, { [Q.SALES_CHANNEL]: opt(Q.SALES_CHANNEL, 'b2b') })
    expect(asked.filter((id) => !OUTSIDE_BUDGET.has(id)).length).toBeLessThanOrEqual(14)
  })
})

describe('٥) معرّفاتُ خيارات الاحتياج ثابتة', () => {
  /* معرّفُ الخيار موضعُه (o1…): هذه الرموزُ الأربعةُ والعشرون في مواضعها منذ
     V2.1، وجلساتٌ محفوظةٌ تحمل معرّفاتِها. فالجديدُ يُلحق بعدها لا بينها. */
  const FROZEN = [
    'need_employability', 'need_direction', 'need_data', 'need_projects', 'need_leadership', 'need_communication',
    'need_ai', 'need_operations', 'need_customer_experience', 'need_sales', 'need_marketing', 'need_negotiation',
    'need_product', 'need_cyber', 'need_supply', 'need_finance', 'need_learning_design', 'need_business',
    'need_visual_design', 'need_interior_design', 'need_construction', 'need_self_understanding', 'need_family', 'need_unsure',
  ]
  it('الأربعةُ والعشرون في مواضعها — والجديدُ بعدها', () => {
    expect(NEEDS_V21.slice(0, FROZEN.length).map((n) => n.code)).toEqual(FROZEN)
  })

  it('و«غير متأكد» آخرٌ في العرض — بمعرّفه الأصليّ', () => {
    const engine = createEngineV21('order')
    engine.answer({ questionId: Q.STAGE, value: 'موظف ذو خبرة', optionIds: ['o4'] })
    engine.answer({ questionId: Q.GOAL, value: 'تطوير مهارة محددة أعرفها', optionIds: ['o6'] })
    engine.answer({ questionId: Q.EMPLOYMENT, value: 'أعمل لدى جهة', optionIds: ['o3'] })
    const q = engine.nextQuestion().question!
    expect(q.question_id).toBe(Q.NEED)
    expect(q.options_ar.at(-1)).toContain('غير متأكد')
    expect(q.active_option_ids?.at(-1)).toBe('o24')
    expect(focusCourseOf({})).toBeNull()
  })
})
