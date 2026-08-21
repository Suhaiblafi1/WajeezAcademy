import { describe, expect, it } from 'vitest'
import {
  COURSE_HOURS_MAX, COURSE_HOURS_MIN, MIN_JUSTIFICATION, PLAN_GROWTH_CAP, PLAN_HOURS_CEILING, RELATIVE_CAP,
  checkHoursProposal, planHoursWarnings,
} from '../../application/catalog/hours-policy'

const LONG = 'سبب مكتوب بطول كافٍ يقرؤه المعتمِد ويحكم عليه'

describe('ب-٥ حدود الساعات', () => {
  it('داخل المدى وبلا تغيير كبير: يمرّ بلا تحذير', () => {
    const r = checkHoursProposal(10, 12, 'سبب قصير')
    expect(r.ok).toBe(true)
    expect(r.warningsAr).toEqual([])
    expect(r.deltaHours).toBe(2)
  })

  it('خارج المدى يُرفض بحدّه مكتوبا', () => {
    expect(checkHoursProposal(10, COURSE_HOURS_MAX + 1, LONG).ok).toBe(false)
    expect(checkHoursProposal(10, COURSE_HOURS_MIN - 1, LONG).ok).toBe(false)
    expect(checkHoursProposal(10, 120, LONG).errorsAr[0]).toContain(String(COURSE_HOURS_MAX))
  })

  it('الكسور والقيم غير المنتهية تُرفض', () => {
    expect(checkHoursProposal(10, 12.5, LONG).ok).toBe(false)
    expect(checkHoursProposal(10, Number.NaN, LONG).ok).toBe(false)
  })

  it('تجاوز ±٥٠٪ بلا مبرر يُرفض — والمبرر يحوّله تحذيرا لا منعا', () => {
    const bad = checkHoursProposal(10, 20, 'قصير')
    expect(bad.ok).toBe(false)
    expect(bad.errorsAr[0]).toContain(String(MIN_JUSTIFICATION))
    const good = checkHoursProposal(10, 20, LONG)
    expect(good.ok).toBe(true)
    expect(good.warningsAr[0]).toContain('تغيير كبير')
  })

  it('التخفيض الكبير يخضع للقاعدة نفسها — الحدّ على المقدار لا على الاتجاه', () => {
    expect(checkHoursProposal(20, 8, 'قصير').ok).toBe(false)
    expect(checkHoursProposal(20, 8, LONG).ok).toBe(true)
    expect(checkHoursProposal(20, 8, LONG).deltaHours).toBe(-12)
  })

  it('الحدّ النسبي عند الحافة بالضبط لا يستوجب مبررا', () => {
    /* ±٥٠٪ بالضبط مسموح؛ ما فوقه يحتاج مبررا */
    expect(checkHoursProposal(10, 15, 'قصير').ok).toBe(true)
    expect(checkHoursProposal(10, 16, 'قصير').ok).toBe(false)
    expect(RELATIVE_CAP).toBe(0.5)
  })

  it('أصل صفر لا يرمي ويُعدّ تغييرا لا نهائيا', () => {
    const r = checkHoursProposal(0, 10, 'قصير')
    expect(r.ratio).toBe(Infinity)
    expect(r.ok).toBe(false)
  })
})

describe('ب-٥ أثر الخطط المركبة', () => {
  const P = (over = {}) => ({
    templateId: 'TPL-X', templateNameAr: 'خطة', beforeHours: 60, afterHours: 60, deltaHours: 0, ...over,
  })

  it('بلا تغيير: لا تحذير', () => {
    expect(planHoursWarnings([P()])).toEqual([])
  })

  it('نمو يتجاوز الخُمس يُنبَّه عليه بنسبته', () => {
    const w = planHoursWarnings([P({ afterHours: 75, deltaHours: 15 })])
    expect(w).toHaveLength(1)
    expect(w[0]).toContain('25٪')
    expect(w[0]).toContain('أثقل من المسار المفرد')
  })

  it('نمو دون الحدّ لا يُنبَّه عليه', () => {
    expect(planHoursWarnings([P({ afterHours: 66, deltaHours: 6 })])).toEqual([])
    expect(PLAN_GROWTH_CAP).toBe(0.2)
  })

  it('تجاوز السقف المطلق يُنبَّه عليه ولو كان النمو صغيرا', () => {
    const w = planHoursWarnings([P({ beforeHours: 78, afterHours: 82, deltaHours: 4 })])
    expect(w[0]).toContain(String(PLAN_HOURS_CEILING))
  })

  it('التخفيض لا يُنبَّه عليه — الخطر في الثقل لا في الخفة', () => {
    expect(planHoursWarnings([P({ afterHours: 40, deltaHours: -20 })])).toEqual([])
  })
})
