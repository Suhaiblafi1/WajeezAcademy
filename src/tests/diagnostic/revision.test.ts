import { describe, expect, it } from 'vitest'
import { createEngine } from '../../domain/diagnostic/engine'
import { GRAD_INTERVIEWS, NEW_MANAGER, runSession } from './helpers'

describe('تعديل الإجابات والرجوع', () => {
  it('تعديل هدف الخريج من «وظيفة أو ترقية» إلى «مشروع أو دخل» يغير التوصية', () => {
    const first = runSession(GRAD_INTERVIEWS)
    expect(first.recommendation.primaryPathway?.pathwayId).toBe('PW-STU-002')

    const engine = createEngine('rev1')
    // نعيد نفس الجلسة لكن بهدف مختلف
    const script = { ...GRAD_INTERVIEWS, 'QB-M2-001': 'مشروع أو دخل' }
    for (let i = 0; i < 40; i++) {
      const next = engine.nextQuestion()
      if (!next.question) break
      const q = next.question
      const scripted = script[q.question_id as keyof typeof script]
      const value =
        scripted !== undefined
          ? scripted
          : q.options_ar.length > 0
            ? q.options_ar[0]
            : 'لا ينطبق'
      engine.answer({ questionId: q.question_id, value })
    }
    const rec = engine.recommend()
    expect(rec.primaryPathway?.pathwayId).not.toBe('PW-STU-002')
  })

  it('reviseAnswer يعيد بناء الحالة كاملة ويحسم الهدف من جديد', () => {
    const engine = createEngine('rev2')
    engine.answer({ questionId: 'QB-M0-006', value: 'نعم' })
    engine.answer({ questionId: 'QB-M1-001', value: 'خريج جديد' })
    engine.answer({ questionId: 'QB-M2-001', value: 'وظيفة أو ترقية' })
    expect(engine.getState().facts['primary_goal']?.value).toBe('employment_advancement')
    engine.answer({ questionId: 'QB-M1-003', value: 'أبحث عن عمل' })
    expect(engine.getState().facts['primary_goal']?.value).toBe('first_job')
    // تعديل: صار يعمل دواما كاملا — يجب أن يعاد الحسم إلى ترقية
    engine.reviseAnswer({ questionId: 'QB-M1-003', value: 'دوام كامل' })
    expect(engine.getState().facts['primary_goal']?.value).toBe('promotion')
  })

  it('popAnswer يحذف آخر إجابة ويعيد الحالة لما قبلها', () => {
    const engine = createEngine('rev3')
    engine.answer({ questionId: 'QB-M0-006', value: 'نعم' })
    engine.answer({ questionId: 'QB-M1-001', value: 'خريج جديد' })
    const before = Object.keys(engine.getState().facts).length
    engine.answer({ questionId: 'QB-M2-001', value: 'وظيفة أو ترقية' })
    const popped = engine.popAnswer()
    expect(popped).toBe('QB-M2-001')
    expect(Object.keys(engine.getState().facts).length).toBe(before)
    expect(engine.getState().facts['primary_goal']).toBeUndefined()
  })

  it('جلسة المدير تبقى حتمية بعد التعديل', () => {
    const a = runSession(NEW_MANAGER)
    const b = runSession(NEW_MANAGER)
    expect(a.recommendation.primaryPathway?.pathwayId).toBe(b.recommendation.primaryPathway?.pathwayId)
  })
})
