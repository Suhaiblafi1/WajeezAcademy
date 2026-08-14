import { describe, expect, it } from 'vitest'
import { createEngine } from '../../domain/diagnostic/engine'
import { applyDerivedRules, decisionCriticalMissing, reduceAnswer } from '../../domain/diagnostic/facts'
import { questionById } from '../../domain/diagnostic/catalog'
import type { FactBag } from '../../domain/diagnostic/types'

function reduce(qid: string, value: string | string[], facts: FactBag = {}) {
  const q = questionById.get(qid)!
  reduceAnswer(q, { questionId: qid, value }, facts, {}, {}, {})
  applyDerivedRules(facts)
  return facts
}

describe('اختزال الحقائق', () => {
  it('تأثير صريح: «خريج جديد» يعطي persona early_career', () => {
    const facts = reduce('QB-M1-001', 'خريج جديد')
    expect(facts['persona_type']?.value).toBe('early_career')
  })

  it('تأثير صريح: «موظف حكومي» يعطي قطاعا عاما', () => {
    const facts = reduce('QB-M1-003', 'موظف حكومي')
    expect(facts['employment_state']?.value).toBe('employed')
    expect(facts['sector']?.value).toBe('public')
  })

  it('قاعدة مشتقة: خريج يبحث عن عمل ← أول وظيفة لا ترقية', () => {
    const facts: FactBag = {}
    reduce('QB-M1-001', 'خريج جديد', facts)
    reduce('QB-M2-001', 'وظيفة أو ترقية', facts)
    reduce('QB-M1-003', 'أبحث عن عمل', facts)
    expect(facts['primary_goal']?.value).toBe('first_job')
  })

  it('القاعدة المشتقة إعادة-تقييمية: حالة العمل اللاحقة تصحح الحسم المبكر', () => {
    const facts: FactBag = {}
    reduce('QB-M2-001', 'وظيفة أو ترقية', facts)
    reduce('QB-M1-001', 'موظف', facts)
    reduce('QB-M1-003', 'دوام كامل', facts)
    expect(facts['primary_goal']?.value).toBe('promotion')
  })

  it('الحقائق الحاسمة: خريج بلا حالة عمل يجب أن تُجمع حالته قبل التوقف', () => {
    const facts: FactBag = {}
    reduce('QB-M1-001', 'خريج جديد', facts)
    reduce('QB-M2-001', 'وظيفة أو ترقية', facts)
    expect(decisionCriticalMissing(facts)).toContain('employment_state')
    reduce('QB-M1-003', 'أبحث عن عمل', facts)
    expect(decisionCriticalMissing(facts)).not.toContain('employment_state')
  })

  it('مستوى المهارة من سؤال M4 يدخل متجه المهارات', () => {
    const engine = createEngine('f1')
    engine.answer({ questionId: 'QB-M0-006', value: 'نعم' })
    engine.answer({ questionId: 'QB-M4-002', value: 'مبتدئ' })
    expect(engine.getState().skillVector['creative_thinking']).toBeGreaterThanOrEqual(1)
  })

  it('إجابة غير متأكد تحمل جودة أدلة منخفضة', () => {
    const q = questionById.get('QB-M2-005')!
    const facts: FactBag = {}
    reduceAnswer(q, { questionId: 'QB-M2-005', value: 'غير متأكد' }, facts, {}, {}, {})
    const key = Object.keys(facts)[0]
    if (key) expect(facts[key].evidenceQuality).toBeLessThan(0.5)
  })
})
