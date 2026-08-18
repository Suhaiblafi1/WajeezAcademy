import { describe, expect, it } from 'vitest'
import { FOUNDER_IDEA, GOV_EMPLOYEE, runSession, STUDENT_LOST } from './helpers'

describe('الحتمية', () => {
  it('نفس الإجابات تعطي نفس تسلسل الأسئلة', () => {
    const a = runSession(GOV_EMPLOYEE)
    const b = runSession(GOV_EMPLOYEE)
    expect(a.askedOrder).toEqual(b.askedOrder)
  })

  it('نفس الإجابات تعطي نفس التوصية ونفس أثر القرار', () => {
    const a = runSession(FOUNDER_IDEA)
    const b = runSession(FOUNDER_IDEA)
    expect(a.recommendation.primaryPathway?.pathwayId).toBe(b.recommendation.primaryPathway?.pathwayId)
    expect(a.recommendation.confidence.total).toBe(b.recommendation.confidence.total)
    expect(JSON.stringify(a.recommendation.trace)).toBe(JSON.stringify(b.recommendation.trace))
  })

  it('لا سؤال يتكرر أبدا', () => {
    const { askedOrder } = runSession(STUDENT_LOST, 'deep')
    expect(new Set(askedOrder).size).toBe(askedOrder.length)
  })

  it('يتوقف ضمن الحدود: 8 أسئلة على الأقل ولا يتجاوز 14 أبدا في الوضع السريع', () => {
    const { askedOrder } = runSession(GOV_EMPLOYEE)
    expect(askedOrder.length).toBeGreaterThanOrEqual(8)
    expect(askedOrder.length).toBeLessThanOrEqual(14)
  })
})
