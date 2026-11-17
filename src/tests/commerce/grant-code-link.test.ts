/* زرُّ بريد الكود يحمل كودَه (١٧ نوفمبر ٢٠٢٦) — والعلّةُ في `grantCodeLink` (`application/commerce/grant-landing.ts`).

   «شخصٌ قام بالتسجيل ووصله إيميلٌ بكوده، وعندما نقر على الرابط أخذه للتسجيل مرّةً أخرى» (صاحب المنصّة).
   ① الرابطُ يحمل الكودَ بشكله وحدَه، ويُضاف إلى ما في الرابط قبله.
   ② والصفحةُ تقرؤه وتسأل الخادمَ عنه حين يختلف عن المحفوظ — في بلاك فرايدي. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { grantCodeLink, parseGrantCodeParam } from '@/application/commerce/grant-landing'

describe('① رابط بكوده', () => {
  it('⚠️ يضاف الكود بشكله، ويقرأ بشكله وحده', () => {
    expect(grantCodeLink('https://x.test/grant/bf', 'wg-ab12cd34')).toBe('https://x.test/grant/bf?code=WG-AB12CD34')
    expect(grantCodeLink('https://x.test/grant/bf?picks=C-1', 'WG-AB12CD34')).toBe('https://x.test/grant/bf?picks=C-1&code=WG-AB12CD34')
    expect(grantCodeLink('https://x.test/grant/bf', 'bad')).toBe('https://x.test/grant/bf')
    expect(grantCodeLink('https://x.test/grant/bf', null)).toBe('https://x.test/grant/bf')
    expect(parseGrantCodeParam('?code=wg-ab12cd34')).toBe('WG-AB12CD34')
    expect(parseGrantCodeParam('?code=<script>')).toBeNull()
    expect(parseGrantCodeParam('')).toBeNull()
  })
})

describe('② الصفحة تفتح على كوده', () => {
  it('⚠️ في بلاك فرايدي تسأل الخادم عن كود الرابط إن اختلف عن المحفوظ، وتحفظه', () => {
    const page = readFileSync(join(__dirname, '..', '..', 'pages', 'MemberGrantPage.tsx'), 'utf8')
    expect(page).toMatch(/useState\(\(\) => \(forBlackFriday \? parseGrantCodeParam\(window\.location\.search\) : null\)\)/)
    expect(page).toMatch(/if \(!mailedCode \|\| storedCode === mailedCode\) return;/)
    expect(page).toMatch(/`\/api\/public\/grant\/bf\/code\/\$\{encodeURIComponent\(mailedCode\)\}`/)
    expect(page).toMatch(/saveStoredGrant\(g, storeKey\);\s*setStored\(/)
  })
})
