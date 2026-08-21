import { describe, expect, it } from 'vitest'
import { countAr } from '../../../server/services/catalog-impact.service'

const F = { one: 'مسار', two: 'مساران', few: 'مسارات', many: 'مسارا' }

describe('ب-١ صيغة العدد في العربية', () => {
  it('المفرد والمثنى والجمع والمنصوب — كل صيغة في موضعها', () => {
    expect(countAr(1, F)).toBe('1 مسار')
    expect(countAr(2, F)).toBe('2 مساران')
    expect(countAr(3, F)).toBe('3 مسارات')
    expect(countAr(10, F)).toBe('10 مسارات')
    expect(countAr(11, F)).toBe('11 مسارا')
    expect(countAr(100, F)).toBe('100 مسارا')
  })

  it('الصفر يأخذ صيغة المنصوب لا المفرد — «0 مسار» ليست عربية', () => {
    expect(countAr(0, F)).toBe('0 مسارا')
  })
})
