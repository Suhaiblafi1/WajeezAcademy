import { describe, expect, it } from 'vitest'
import { createEngine } from '../../domain/diagnostic/engine'
import { CONSENT_YES, GOV_EMPLOYEE, runSession } from './helpers'

describe('حواجز الحماية', () => {
  it('رفض الموافقة يوقف التشخيص فورا بنوع guardrail_stop', () => {
    const engine = createEngine('g1')
    engine.answer({ questionId: 'QB-M0-006', value: 'لا' })
    const next = engine.nextQuestion()
    expect(next.question).toBeNull()
    expect(next.stop?.shouldStop).toBe(true)
    const rec = engine.recommend()
    expect(rec.kind).toBe('guardrail_stop')
    expect(rec.primaryPathway).toBeNull()
  })

  it('قاصر يقرر بنفسه يوجَّه لولي الأمر', () => {
    const engine = createEngine('g2')
    engine.answer({ questionId: 'QB-M0-006', value: 'نعم' })
    engine.answer({ questionId: 'QB-M0-008', value: 'نعم' })
    // decision_owner=self يأتي من إجابة «أنا المتعلم» على QB-M0-001
    engine.answer({ questionId: 'QB-M0-001', value: 'أنا المتعلم' })
    const rec = engine.recommend()
    expect(rec.kind).toBe('guardrail_stop')
    expect(rec.reasons_ar.join(' ')).toContain('قاصر')
  })

  it('قاصر مع ولي أمر يكمل التشخيص بشكل طبيعي', () => {
    const engine = createEngine('g3')
    engine.answer({ questionId: 'QB-M0-006', value: 'نعم' })
    engine.answer({ questionId: 'QB-M0-008', value: 'نعم' })
    engine.answer({ questionId: 'QB-M0-001', value: 'أحد الوالدين' })
    expect(engine.getState().guardrailStop).toBeNull()
  })

  it('كل توصية تحمل إخلاء المسؤولية التعليمي', () => {
    const { recommendation } = runSession({ ...CONSENT_YES })
    expect(recommendation.disclaimer_ar).toContain('ليس تشخيصا نفسيا أو طبيا')
    expect(recommendation.disclaimer_ar).toContain('لا وعدا بوظيفة أو دخل')
  })

  it('جلسة الموظف الحكومي تكتمل بلا حاجز حماية', () => {
    const { recommendation } = runSession(GOV_EMPLOYEE)
    expect(recommendation.kind).not.toBe('guardrail_stop')
  })
})
