/* دوراتُ صفحة كلّ منحة — القاعدةُ الواحدة (١٥ نوفمبر ٢٠٢٦). والعلّةُ في رأس `src/application/commerce/grant-scope.ts`،
   وما على الخادم في `server/tests/commerce/grant-course-choice.test.ts`. */

import { describe, expect, it } from 'vitest'
import { liveGrantScope, scopeOfIds } from '@/application/commerce/grant-scope'

const ids = (s: ReadonlySet<string> | null) => (s === null ? null : [...s].sort())

describe('النطاق', () => {
  it('⚠️ القائمة الفارغة تلقائية — والمؤثر داخل حملته لا يزيد عليها', () => {
    expect(scopeOfIds([])).toBeNull()
    expect(liveGrantScope([], [])).toBeNull()
    expect(ids(liveGrantScope([], ['A']))).toEqual(['A'])
    expect(ids(liveGrantScope(['A', 'B'], []))).toEqual(['A', 'B'])
    expect(ids(liveGrantScope(['A', 'B'], ['B', 'C'])), 'زاد المؤثر على قائمة حملته').toEqual(['B'])
  })

  it('⚠️ وإن لم يبق له شيء منها فقائمة الحملة كلها — «Full grant list»', () => {
    expect(ids(liveGrantScope(['A', 'B'], ['C'])), 'صفحة فارغة بعد أن أسقطت الحملة دوراته').toEqual(['A', 'B'])
  })
})
