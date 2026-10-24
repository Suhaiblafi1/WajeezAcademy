/* ألسنةُ الصفحات في العنوان (٢٤ أكتوبر ٢٠٢٦، `useTabParam.ts`).

   كان اللسانُ حالةً في الذاكرة: رابطُ «الاستردادات» يفتح «طلبات التسجيل»، و«رجوع» بعد تبديل اللسان
   يُخرج من الصفحة كلِّها.

   ① الحساب: ما يقوله العنوانُ يُفتح — والأوّلُ بلا سؤال، وما ليس من الألسنة يفتح الأوّل.
   ② والتبديل: الأوّلُ يُمحى من العنوان فلا يتغيّر رابطٌ قديم، وبقيّةُ السؤال تبقى.
   ③ والصفحاتُ الأربع تقرأ لسانَها من العنوان لا من الذاكرة. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { paramsWithTab, tabFromParams } from '@/hooks/useTabParam'

const bare = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
const TABS = ['requests', 'invoices', 'refunds'] as const

describe('① ما يقوله العنوان يفتح', () => {
  it('⚠️ اللسان المسمّى — والأوّل بلا سؤال', () => {
    expect(tabFromParams(new URLSearchParams('tab=refunds'), TABS, 'requests')).toBe('refunds')
    expect(tabFromParams(new URLSearchParams(''), TABS, 'requests')).toBe('requests')
  })

  it('⚠️ وما ليس من ألسنتها يفتح الأوّل — لا لوحا فارغا', () => {
    expect(tabFromParams(new URLSearchParams('tab=coupons'), TABS, 'requests'), 'فتح لسانا لا يملكه').toBe('requests')
    expect(tabFromParams(new URLSearchParams('tab='), TABS, 'requests')).toBe('requests')
  })
})

describe('② والتبديل', () => {
  it('⚠️ يكتب اللسان — والأوّل يمحى فلا يتغيّر رابط قديم', () => {
    expect(paramsWithTab(new URLSearchParams(''), 'invoices', 'requests').toString()).toBe('tab=invoices')
    expect(paramsWithTab(new URLSearchParams('tab=invoices'), 'requests', 'requests').toString(), 'بقي الأوّل في العنوان').toBe('')
  })

  it('⚠️ وبقيّة السؤال تبقى', () => {
    expect(paramsWithTab(new URLSearchParams('trainer=t1&tab=invoices'), 'refunds', 'requests').toString())
      .toBe('trainer=t1&tab=refunds')
  })
})

describe('③ والصفحات تقرأ لسانها من العنوان', () => {
  const PAGES: [string, RegExp][] = [
    ['src/pages/admin/Finance.tsx', /const \[tab, setTab\] = useTabParam<Tab>\(/],
    ['src/pages/admin/AdminCohorts.tsx', /const \[list, setList\] = useTabParam<CohortList>\(/],
    ['src/pages/admin/RatingModeration.tsx', /const \[status, setStatus\] = useTabParam\(/],
    ['src/pages/admin/Users.tsx', /const \[box, setBox\] = useTabParam<[^>]+>\(/],
  ]
  it.each(PAGES)('⚠️ %s', (path, hook) => {
    const page = bare(path)
    expect(page, 'اللسان حالة في الذاكرة — لا يفتحه رابط ولا يعود إليه «رجوع»').toMatch(hook)
    expect(page).toContain('import { useTabParam } from "@/hooks/useTabParam";')
  })
})
