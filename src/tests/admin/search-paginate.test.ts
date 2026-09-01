/* البحثُ والترقيم — الطبقةُ النقيّة تُختبر وحدَها.

   ولا تُختبر بمثالٍ واحد: كلُّ فرعٍ من فروع التطبيع بابُ «لا نتائج» كاذبة. */

import { describe, expect, it } from 'vitest'
import { matchesQuery, normalizeAr } from '@/application/text/search-ar'
import { paginate } from '@/application/admin/paginate'

describe('التطبيع العربيّ قبل المقارنة', () => {
  it('يوحّد الهمزةَ والألفَ المقصورة والتاءَ المربوطة', () => {
    expect(normalizeAr('أحمد')).toBe(normalizeAr('احمد'))
    expect(normalizeAr('مصطفى')).toBe(normalizeAr('مصطفي'))
    expect(normalizeAr('دورة')).toBe(normalizeAr('دوره'))
  })

  it('ويحذف التشكيلَ والتطويل', () => {
    expect(normalizeAr('مُحَمَّد')).toBe(normalizeAr('محمد'))
    expect(normalizeAr('محـــمد')).toBe(normalizeAr('محمد'))
  })

  it('ويُلاتِن الأرقامَ العربيّة-الهنديّة', () => {
    expect(normalizeAr('١٢٣')).toBe('123')
  })
})

describe('مطابقةُ الاستعلام', () => {
  const row = ['أحمد الشمري', 'ahmad@wajeez.co', 'أمين المالية']

  it('تجد الاسمَ بلا همزة', () => {
    expect(matchesQuery('احمد', row)).toBe(true)
  })

  it('وتجمع كلمتين من حقلين مختلفين', () => {
    expect(matchesQuery('احمد المالية', row)).toBe(true)
  })

  it('وترفض ما ليس فيها', () => {
    expect(matchesQuery('سارة', row)).toBe(false)
  })

  it('واستعلامٌ فارغ يطابق الكلّ — لا يُخفي القائمة', () => {
    expect(matchesQuery('   ', row)).toBe(true)
  })
})

describe('الترقيم', () => {
  const rows = Array.from({ length: 23 }, (_, i) => i + 1)

  it('يقطع الصفحةَ بمداها ويقول من أين إلى أين', () => {
    const p = paginate(rows, 2, 10)
    expect(p.rows).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20])
    expect([p.page, p.pages, p.from, p.to, p.total]).toEqual([2, 3, 11, 20, 23])
  })

  it('ويلجم صفحةً أبعدَ من الآخر — فلا فراغٌ يُقرأ «لا نتائج»', () => {
    const p = paginate(rows, 99, 10)
    expect(p.page).toBe(3)
    expect(p.rows).toEqual([21, 22, 23])
  })

  it('وقائمةٌ فارغة صفحةٌ واحدة بلا صفوف — لا صفرٌ ولا سالب', () => {
    const p = paginate([], 1, 10)
    expect([p.page, p.pages, p.from, p.to, p.total]).toEqual([1, 1, 0, 0, 0])
  })
})
