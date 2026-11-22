/* صفحةُ المنحة تقول نسبةَ كوده الآن لا ما حُفظ في جهازه (٢٢ نوفمبر ٢٠٢٦) — والعلّةُ في `grant-landing.ts#grantPercentShown`.

   رفع صاحبُ المنصّة خصمَ كاسيت من 40% إلى 65% فارتفعت أكوادُ متابعيه القائمة («Raise to 65%»)، والصفحةُ كانت تسعّر بما حُفظ
   يومَ أخذ كودَه. فنسبةُ كوده من الخادم (`myPercentOff`) تغلب المحفوظة، ثمّ نسبةُ الحملة. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { grantPercentShown } from '@/application/commerce/grant-landing'

const root = join(__dirname, '..', '..', '..')
const PAGE = readFileSync(join(root, 'src/pages/MemberGrantPage.tsx'), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')

describe('نسبة كوده في صفحته', () => {
  it('⚠️ نسبة الخادم تغلب المحفوظة — 65 لا 40', () => {
    expect(grantPercentShown(65, 40, 45), 'غلبت النسبة المحفوظة نسبة كوده الآن').toBe(65)
  })

  it('وبلا نسبة من الخادم: المحفوظة، ثم نسبة الحملة، ثم صفر', () => {
    expect(grantPercentShown(null, 40, 45)).toBe(40)
    expect(grantPercentShown(undefined, null, 45)).toBe(45)
    expect(grantPercentShown(undefined, undefined, undefined)).toBe(0)
  })

  it('⚠️ والصفحة تسعر بها', () => {
    expect(PAGE).toMatch(/const pct = grantOn \? grantPercentShown\(view\?\.myPercentOff, stored\?\.percentOff, view\?\.campaign\.percentOff\) : 0;/)
  })
})
