/* ما يقدّمه المدرّبُ في الموسم القادم — لا كلُّ دوراته (١٩ أكتوبر ٢٠٢٦).

   «لماذا تظهر كلُّ الدورات للمدرّب وليس للموسم القادم؟ يجب أن تكون العبارةُ مثل: سيقدّم المدرّبُ للفصل القادم
   دورةَ كذا وكذا» (صاحب المنصّة).
   ① الأقربُ موسما أوّلا، وما لا موسمَ له آخرا.
   ② وكلُّ دورةٍ مرّةً، في أقرب مواسمها.
   ③ والرأسُ اسمُ الموسم وحدَه — بلا تشكيل. كان «سيقدم فلان في موسم كذا»، ثمّ قال صاحبُ المنصّة (٢٠ أكتوبر
      ٢٠٢٦): «طويلة.. اجعلها فقط اسم الموسم!». رُئي ساقطا على الرأس القديم.
   ④ وما بعد الأقرب «المواسم القادمة» بلا أسمائها — «لا أريد أن يرى المستهلك بأن هناك دوراتٍ بعد سنة» (صاحب
      المنصّة، ٢٤ أكتوبر ٢٠٢٦). رُئي ساقطا على أربعة مواسم بأسمائها. */

import { describe, expect, it } from 'vitest'
import { groupBySeason, LATER_SEASON_AR, NO_NEXT_SEASON_AR, seasonHeadingAr, upcomingOffer } from '@/application/trainer/next-season'

const winter = { year: 2026, season: 'nov_jan' }
const spring = { year: 2027, season: 'feb_apr' }
const TASHKEEL = /[ً-ِْ]/

describe('ما يقدمه للموسم القادم', () => {
  it('① الأقرب موسما أولا، وما لا موسم له آخرا', () => {
    const g = groupBySeason([
      { courseId: 'C', term: null },
      { courseId: 'B', term: spring, at: '2027-02-10' },
      { courseId: 'A', term: winter, at: '2026-11-05' },
    ])
    expect(g).toEqual([
      { termAr: 'موسم الشتاء 2026/2027', courseIds: ['A'] },
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
    expect(g).toEqual([{ termAr: 'موسم الشتاء 2026/2027', courseIds: ['A', 'B'] }])
  })

  it('⚠️ ③ والرأس اسم الموسم وحده — لا «سيقدم فلان في…»، بلا تشكيل', () => {
    expect(seasonHeadingAr('موسم الشتاء 2026/2027')).toBe('موسم الشتاء 2026/2027')
    expect(seasonHeadingAr(null)).toBe(LATER_SEASON_AR)
    for (const s of [seasonHeadingAr('موسم الشتاء 2026/2027'), seasonHeadingAr(null), NO_NEXT_SEASON_AR]) {
      expect(s, s).not.toMatch(TASHKEEL)
    }
  })

  it('⚠️ ④ الأقرب باسمه، وما بعده كله «المواسم القادمة» بلا اسم', () => {
    const g = upcomingOffer(groupBySeason([
      { courseId: 'A', term: winter, at: '2026-11-05' },
      { courseId: 'B', term: spring, at: '2027-02-10' },
      { courseId: 'C', term: { year: 2027, season: 'aug_oct' }, at: '2027-08-10' },
      { courseId: 'D', term: null },
    ]))
    expect(g).toEqual([
      { termAr: 'موسم الشتاء 2026/2027', courseIds: ['A'] },
      { termAr: null, courseIds: ['B', 'C', 'D'] },
    ])
    expect(seasonHeadingAr(g[1]!.termAr)).toBe('المواسم القادمة')
    expect(upcomingOffer([{ termAr: 'موسم الشتاء 2026/2027', courseIds: ['A'] }]), 'موسم واحد يبقى باسمه').toHaveLength(1)
  })
})
