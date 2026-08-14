import { describe, expect, it } from 'vitest'
import { createEngine } from '../../domain/diagnostic/engine'
import { GOV_EMPLOYEE } from './helpers'

describe('الفجوات غير المتاحة تجاريا', () => {
  it('مهارة ضعيفة لا تغطيها الدورات تبقى ظاهرة ولا تُخفى', () => {
    const engine = createEngine('u1')
    // جلسة واضحة المعالم + مهارة creative_thinking (لا تغطيها دورات المسارات العشرين) بمستوى ضعيف
    const base = { ...GOV_EMPLOYEE }
    for (let i = 0; i < 40; i++) {
      const next = engine.nextQuestion()
      if (!next.question) break
      const q = next.question
      const scripted = base[q.question_id as keyof typeof base]
      const value =
        scripted !== undefined
          ? scripted
          : q.options_ar.length > 0
            ? q.options_ar[0]
            : 'لا ينطبق'
      engine.answer({ questionId: q.question_id, value })
    }
    // حقن معرفة مباشرة بإجابة سؤال مهارة غير مغطاة (محاكاة إجابة المستخدم في وضع عميق)
    engine.answer({ questionId: 'QB-M4-002', value: 'مبتدئ جدا' })
    const rec = engine.recommend()
    const slugs = rec.unavailable_skills.map((u) => u.skill)
    expect(slugs).toContain('creative_thinking')
  })

  it('الفجوة غير المتاحة تحمل ملاحظة صريحة بعدم التغطية', () => {
    const engine = createEngine('u2')
    engine.answer({ questionId: 'QB-M0-006', value: 'نعم' })
    engine.answer({ questionId: 'QB-M1-001', value: 'موظف' })
    engine.answer({ questionId: 'QB-M2-001', value: 'وظيفة أو ترقية' })
    engine.answer({ questionId: 'QB-M1-003', value: 'دوام كامل' })
    engine.answer({ questionId: 'QB-M4-002', value: 'مبتدئ جدا' })
    const rec = engine.recommend()
    const item = rec.unavailable_skills.find((u) => u.skill === 'creative_thinking')
    expect(item?.note_ar).toContain('لا تغطيها الدورات الحالية')
  })
})
