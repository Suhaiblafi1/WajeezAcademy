/* «انسخ من شعبةٍ أخرى» — المحضُ: إزاحةُ التواريخ وخريطةُ الملفّات (١١ أكتوبر ٢٠٢٦).
   والنسخُ على قاعدةٍ حقيقيّةٍ في `server/tests/trainer/plan-copy.test.ts`. */

import { describe, expect, it } from 'vitest'
import { daysBetween, planFileKeys, remapFileKeys, shiftDay, shiftInstant, shiftPlan } from '@/application/trainer/plan-copy'

describe('إزاحةُ التواريخ', () => {
  it('الفرقُ بالأيّام — عبر الشهر والسنة', () => {
    expect(daysBetween('2026-12-27', '2027-01-03')).toBe(7)
    expect(daysBetween('2027-01-03', '2026-12-27')).toBe(-7)
    expect(daysBetween('x', '2027-01-03')).toBeNull()
    expect(shiftDay('2026-12-29', 7)).toBe('2027-01-05')
    expect(shiftInstant('2026-12-01T15:00:00.000Z', 7)).toBe('2026-12-08T15:00:00.000Z')
    expect(shiftInstant(null, 7)).toBeNull()
  })

  it('المدّةُ والمواعيدُ ولحظاتُ الفتح تُزاح معا — وما سواها كما هو', () => {
    const out = shiftPlan({
      startsOn: '2026-12-01', endsOn: '2026-12-14', summaryAr: 'نبذة',
      slots: [{ startsOn: '2026-12-01', endsOn: '2026-12-07', moduleIds: ['M1'] }],
      resources: [{ title: 'a', opensAt: '2026-12-02T05:00:00.000Z' }, { title: 'b' }],
    }, '2027-01-05')
    expect(out!.days).toBe(35)
    expect(out!.plan).toMatchObject({
      startsOn: '2027-01-05', endsOn: '2027-01-18', summaryAr: 'نبذة',
      slots: [{ startsOn: '2027-01-05', endsOn: '2027-01-11', moduleIds: ['M1'] }],
      resources: [{ title: 'a', opensAt: '2027-01-06T05:00:00.000Z' }, { title: 'b' }],
    })
  })

  it('ولا مدّةَ للمنسوخ منها — لا يُعرف من أين تُزاح', () => {
    expect(shiftPlan({ resources: [] }, '2027-01-05')).toBeNull()
  })
})

describe('الملفّاتُ تُنسخ بمفاتيحَ جديدة', () => {
  const plan = {
    modules: [{ moduleId: 'M1', bodyFileKey: 'k-body' }],
    resources: [{ title: 'r', bodyFileKey: 'k-res', bodyFileName: 'r.pdf', bodyFileMime: 'application/pdf' }, { title: 'u', url: 'https://x' }],
    workbook: { bodyFileKey: 'k-wb' },
    workbooks: [{ moduleIds: ['M1'], bodyFileKey: 'k-res' }],
  }

  it('كلُّ مفتاحٍ مرّةً واحدة — حيثما كان في الخطّة', () => {
    expect(planFileKeys(plan).sort()).toEqual(['k-body', 'k-res', 'k-wb'])
  })

  it('يُستبدل المنسوخ — وما لم يُنسخ يسقط ملفُّه ويبقى صفُّه', () => {
    const out = remapFileKeys(plan, new Map([['k-res', 'n-res'], ['k-wb', 'n-wb']]))
    expect(out.resources[0]).toMatchObject({ title: 'r', bodyFileKey: 'n-res' })
    expect(out.workbooks[0]!.bodyFileKey).toBe('n-res')
    expect(out.workbook.bodyFileKey).toBe('n-wb')
    expect(out.modules[0]).toMatchObject({ moduleId: 'M1', bodyFileKey: null })
    expect(out.resources[1]).toEqual({ title: 'u', url: 'https://x' })
    expect(plan.resources[0]!.bodyFileKey, 'غيّر الأصل').toBe('k-res')
  })
})
