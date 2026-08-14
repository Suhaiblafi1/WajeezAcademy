import { describe, expect, it } from 'vitest'
import {
  EMPLOYEE_DATA,
  FOUNDER_IDEA,
  GOV_EMPLOYEE,
  GRAD_INTERVIEWS,
  NEW_MANAGER,
  runSession,
  STUDENT_LOST,
} from './helpers'

describe('الشخصيات المرجعية', () => {
  it('طالب ضائع → مسار الاستكشاف PW-STU-003', () => {
    const { recommendation } = runSession(STUDENT_LOST)
    expect(recommendation.primaryPathway?.pathwayId).toBe('PW-STU-003')
  })

  it('خريج جديد يبحث عن عمل → أول وظيفة PW-STU-002 لا ترقية', () => {
    const { recommendation, state } = runSession(GRAD_INTERVIEWS)
    expect(state.facts['primary_goal']?.value).toBe('first_job')
    expect(recommendation.primaryPathway?.pathwayId).toBe('PW-STU-002')
  })

  it('موظف حكومي يطلب ترقية → PW-GOV-002', () => {
    const { recommendation } = runSession(GOV_EMPLOYEE)
    expect(recommendation.primaryPathway?.pathwayId).toBe('PW-GOV-002')
  })

  it('مدير جديد بسياق قيادي → قيادة الفريق PW-EMP-005 لا التواصل', () => {
    const { recommendation, state } = runSession(NEW_MANAGER)
    expect(state.facts['persona_type']?.value).toBe('manager')
    expect(recommendation.primaryPathway?.pathwayId).toBe('PW-EMP-005')
  })

  it('رائد أعمال بفكرة مبكرة → قالب الإطلاق المركب أو مسار ريادة الأعمال', () => {
    const { recommendation } = runSession(FOUNDER_IDEA)
    if (recommendation.kind === 'composite_template') {
      expect(recommendation.composite?.templateId).toBe('TPL-VENTURE-001')
    } else {
      expect(recommendation.primaryPathway?.pathwayId).toBe('PW-BIZ-001')
    }
  })

  it('موظف عمليات يطلب ترقية → يبقى ضمن مسارات الموظفين لا الطلبة', () => {
    const { recommendation } = runSession(EMPLOYEE_DATA)
    expect(recommendation.primaryPathway?.pathwayId).not.toMatch(/^PW-STU/)
  })
})
