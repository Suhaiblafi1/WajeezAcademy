import { describe, expect, it } from 'vitest'
import { compositeTemplates } from '../../domain/diagnostic/catalog'
import { TEMPLATE_THRESHOLDS } from '../../domain/diagnostic/config'
import { FOUNDER_IDEA, runSession } from './helpers'

describe('القوالب المركبة', () => {
  it('القوالب الستة عشر ليست مسارات: معرفاتها TPL لا PW', () => {
    expect(compositeTemplates.length).toBe(16)
    for (const t of compositeTemplates) {
      expect(t.template_id).toMatch(/^TPL-/)
      expect(t.template_id).not.toMatch(/^PW-/)
    }
  })

  it('قالب الرائد يظهر كخطة مركبة مخصصة لا كمسار جديد', () => {
    const { recommendation } = runSession(FOUNDER_IDEA)
    expect(recommendation.kind).toBe('composite_template')
    expect(recommendation.composite).not.toBeNull()
    // المسار الأساسي يبقى معروضا بجانب القالب
    expect(recommendation.primaryPathway).not.toBeNull()
  })

  it('خطة القالب تحترم السقف: لا تتجاوز 80 ساعة دون مستشار', () => {
    const { recommendation } = runSession(FOUNDER_IDEA)
    const total = (recommendation.composite?.courses ?? []).reduce((s, c) => s + c.hours, 0)
    expect(total).toBeLessThanOrEqual(TEMPLATE_THRESHOLDS.max_plan_hours)
  })

  it('المقررات الشرطية لا تتجاوز الحد الموثق لكل نسخة', () => {
    const { recommendation } = runSession(FOUNDER_IDEA)
    const conditional = (recommendation.composite?.courses ?? []).filter((c) => c.type === 'conditional')
    expect(conditional.length).toBeLessThanOrEqual(TEMPLATE_THRESHOLDS.max_conditional_courses_extended)
  })

  it('لا دورة تتكرر في خطة القالب', () => {
    const { recommendation } = runSession(FOUNDER_IDEA)
    const ids = (recommendation.composite?.courses ?? []).map((c) => c.courseId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('كل دورة في الخطة تحمل سبب اختيار عربيا', () => {
    const { recommendation } = runSession(FOUNDER_IDEA)
    for (const c of recommendation.composite?.courses ?? []) {
      expect(c.reason_ar.length).toBeGreaterThan(0)
    }
  })
})
