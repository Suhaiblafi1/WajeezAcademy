/* البند ب-٢: منطق فروق الأثر — الأوجه الثلاثة (المسار · الثقة · الأسئلة).
   الاختبار على الدالة النقية التي تبني الفروق من نتائج قبل/بعد، لا على
   المحرك: تشغيل ١٢ شخصية مرتين يخصّ اختبارات الخادم، وهذا يخصّ الحساب. */

import { describe, expect, it } from 'vitest'
import { diffOutcomes, type PersonaOutcome } from '../../../server/services/impact.service'

const P = (over: Partial<PersonaOutcome> = {}): PersonaOutcome => ({
  name: 'شخصية', questions: 3, kind: 'single_pathway', top: 'PW-A', tpl: null, conf: 0.7,
  asked: ['Q1', 'Q2', 'Q3'], ...over,
})

describe('ب-٢ أوجه الأثر الثلاثة', () => {
  it('لا فرق: الحكم صريح بأن التشخيص لم يُمَس', () => {
    const d = diffOutcomes([P()], [P()])
    expect(d.touchesDiagnostic).toBe(false)
    expect(d.verdictAr).toContain('لا يمس التشخيص')
    expect(d.changedWinners).toEqual([])
    expect(d.changedConfidence).toEqual([])
    expect(d.changedQuestions).toEqual([])
  })

  it('تغيّر المسار يُرصد بما كان وما صار', () => {
    const d = diffOutcomes([P()], [P({ top: 'PW-B' })])
    expect(d.changedWinners).toEqual([{ name: 'شخصية', beforeTop: 'PW-A', afterTop: 'PW-B' }])
    expect(d.verdictAr).toContain('تغيّر ترشيحها')
  })

  it('تغيّر الثقة يُرصد بفرقه ولو بقي المسار', () => {
    const d = diffOutcomes([P()], [P({ conf: 0.66 })])
    expect(d.changedWinners).toEqual([])
    expect(d.changedConfidence).toHaveLength(1)
    expect(d.changedConfidence[0].delta).toBeCloseTo(-0.04, 10)
    expect(d.touchesDiagnostic).toBe(true)
  })

  it('اختفاء سؤال وظهور آخر يُرصدان منفصلين', () => {
    const d = diffOutcomes([P()], [P({ asked: ['Q1', 'Q9', 'Q3'] })])
    expect(d.changedQuestions).toHaveLength(1)
    expect(d.changedQuestions[0].removed).toEqual(['Q2'])
    expect(d.changedQuestions[0].added).toEqual(['Q9'])
    expect(d.changedQuestions[0].reordered).toBe(false)
  })

  it('⚠ الوجه الذي كان يمرّ صامتا: تغيّر الأسئلة والمسار كما هو', () => {
    /* هذا سبب البند: قبله كان الحكم «لا أثر» لأن المسار والثقة لم يتغيّرا */
    const d = diffOutcomes([P()], [P({ asked: ['Q1', 'Q7', 'Q8'] })])
    expect(d.changedWinners).toEqual([])
    expect(d.changedConfidence).toEqual([])
    expect(d.touchesDiagnostic).toBe(true)
    expect(d.verdictAr).toContain('تغيّرت أسئلتها')
  })

  it('الترتيب وحده أثرٌ في الحوار — يُرصد ولا يُخلط بالاختفاء', () => {
    const d = diffOutcomes([P()], [P({ asked: ['Q3', 'Q1', 'Q2'] })])
    expect(d.changedQuestions[0].reordered).toBe(true)
    expect(d.changedQuestions[0].removed).toEqual([])
    expect(d.changedQuestions[0].added).toEqual([])
  })

  it('تغيّر نوع المخرَج (مسار ← قالب) يُعدّ تغيّر ترشيح', () => {
    const d = diffOutcomes([P()], [P({ kind: 'composite', top: null, tpl: 'TPL-X' })])
    expect(d.changedWinners[0]).toEqual({ name: 'شخصية', beforeTop: 'PW-A', afterTop: 'TPL-X' })
  })

  it('شخصية ناقصة في «بعد» لا ترمي ولا تُحتسب فرقا مختلقا', () => {
    const d = diffOutcomes([P({ name: 'أ' }), P({ name: 'ب' })], [P({ name: 'أ' })])
    expect(d.changedQuestions).toEqual([])
    expect(d.touchesDiagnostic).toBe(false)
  })

  it('الحكم يجمع الأوجه الثلاثة في سطر واحد', () => {
    const d = diffOutcomes(
      [P({ name: 'أ' }), P({ name: 'ب' }), P({ name: 'ج' })],
      [P({ name: 'أ', top: 'PW-B' }), P({ name: 'ب', conf: 0.5 }), P({ name: 'ج', asked: ['Q1'] })],
    )
    expect(d.verdictAr).toContain('يغيّر التشخيص')
    expect(d.verdictAr).toContain('1 شخصية تغيّر ترشيحها')
    expect(d.verdictAr).toContain('تغيّرت ثقتها')
    expect(d.verdictAr).toContain('تغيّرت أسئلتها')
  })
})
