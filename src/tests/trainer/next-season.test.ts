/* ما يقدّمه المدرّبُ في الموسم القادم — لا كلُّ دوراته (١٩ أكتوبر ٢٠٢٦).

   «لماذا تظهر كلُّ الدورات للمدرّب وليس للموسم القادم؟ يجب أن تكون العبارةُ مثل: سيقدّم المدرّبُ للفصل القادم
   دورةَ كذا وكذا» (صاحب المنصّة).
   ① الأقربُ موسما أوّلا، وما لا موسمَ له آخرا.
   ② وكلُّ دورةٍ مرّةً، في أقرب مواسمها.
   ③ والرأسُ «سيقدم فلان في موسم كذا» — بلا تشكيل. */

import { describe, expect, it } from 'vitest'
import { groupBySeason, NO_NEXT_SEASON_AR, seasonHeadingAr } from '@/application/trainer/next-season'

const winter = { year: 2026, season: 'nov_jan', startsOn: '2026-11-01' }
const spring = { year: 2027, season: 'feb_apr', startsOn: '2027-02-01' }
const TASHKEEL = /[ً-ِْ]/

describe('ما يقدمه للموسم القادم', () => {
  it('① الأقرب موسما أولا، وما لا موسم له آخرا', () => {
    const g = groupBySeason([
      { courseId: 'C', term: null },
      { courseId: 'B', term: spring, at: '2027-02-10' },
      { courseId: 'A', term: winter, at: '2026-11-05' },
    ])
    expect(g).toEqual([
      { termAr: 'موسم الشتاء 2026', courseIds: ['A'] },
      { termAr: 'موسم الربيع 2027', courseIds: ['B'] },
      { termAr: null, courseIds: ['C'] },
    ])
  })

  it('② وكل دورة مرة في أقرب مواسمها — وبترتيب بدء شعبها', () => {
    const g = groupBySeason([
      { courseId: 'A', term: spring, at: '2027-02-10' },
      { courseId: 'B', term: winter, at: '2026-12-01' },
      { courseId: 'A', term: winter, at: '2026-11-05' },
    ])
    expect(g).toEqual([{ termAr: 'موسم الشتاء 2026', courseIds: ['A', 'B'] }])
  })

  it('③ والرأس يسمي المدرب وموسمه — بلا تشكيل', () => {
    expect(seasonHeadingAr('ريم', 'موسم الشتاء 2026')).toBe('سيقدم ريم في موسم الشتاء 2026')
    expect(seasonHeadingAr('ريم', null)).toBe('سيقدم ريم قريبا')
    for (const s of [seasonHeadingAr('ريم', 'موسم الشتاء 2026'), seasonHeadingAr('ريم', null), NO_NEXT_SEASON_AR]) {
      expect(s, s).not.toMatch(TASHKEEL)
    }
  })
})
