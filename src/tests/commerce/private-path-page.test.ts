/* صفحةُ «مسار {الاسم الأوّل}» — `/go/<رمز>` (٥ نوفمبر ٢٠٢٦). والخادمُ في `server/tests/commerce/private-path.test.ts`.

   وهنا ما تقوله الصفحةُ وما لا تقوله: زرٌّ واحدٌ «أكمل التسجيل» يفتح لوحَ الدفع القائم بالدورات والكود نفسيهما ورمزِ مولّده،
   ولا اقتراحَ لغيرها ولا «ابنِ مسارك»، ولا تُفهرَس، والأرقامُ من الخادم لا من حسابٍ فيها. ومعاينةُ واتساب معاينةُ الموقع
   (`index.html`) — فلا اسمَ ولا كودَ فيها. والفحصُ على البنية، والتعليقاتُ تُنزع. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanReason, firstNameAr, goPath, GO_CODE_RE, PATH_REASON_MAX } from '@/application/commerce/private-path'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const PAGE = code('src/pages/PrivatePath.tsx')
const APP = code('src/App.tsx')
const BUILDER = code('src/components/BuyLinkBuilder.tsx')

describe('صفحة المسار الخاص', () => {
  it('⚠️ زر واحد «أكمل التسجيل» يفتح لوح الدفع القائم بالدورات والكود نفسيهما', () => {
    expect(PAGE.match(/أكمل التسجيل/g)?.length, 'أكثر من زر شراء أو بلا زر').toBe(1)
    expect(PAGE).toMatch(/<BuyPanel[\s\S]*?initialCoupon=\{v\.couponCode \?\? ""\}[\s\S]*?lines=\{v\.courses\.map\(\(c\) => \(\{ courseId: c\.courseId, name: c\.titleAr, cohortId: c\.cohortId \}\)\)\}/)
    expect(PAGE, 'لا ينسب الطلب إلى مولد الرابط').toMatch(/rememberBuyLink\(r\.buyLinkToken\)/)
  })

  it('⚠️ لا اقتراح لغيرها ولا «ابن مسارك» — ولا حساب للسعر فيها', () => {
    expect(PAGE).not.toMatch(/ابن(ِ)? مسارك|suggest|Suggested|priceCart|grantPrice/)
    expect(PAGE).toMatch(/apiGet<[^>]+>\(`\/api\/public\/go\/\$\{code\}`\)/)
  })

  it('⚠️ لا تفهرس — ومعاينة واتساب معاينة الموقع بلا اسم ولا كود', () => {
    expect(PAGE).toMatch(/<SeoHead[^>]*noindex/)
    const html = readFileSync(join(root, 'index.html'), 'utf8')
    expect(html).toMatch(/<meta property="og:site_name" content="أكاديمية وجيز" \/>/)
    expect(html).toMatch(/<meta property="og:image" content="%VITE_SITE_ORIGIN%\/og-image\.png\?v=2" \/>/)
  })

  it('⚠️ طريقها في التطبيق — والأداة تعطي الرابط القصير بسبب لكل دورة', () => {
    expect(APP).toMatch(/<Route path="\/go\/:code" element=\{<PrivatePathPage \/>\} \/>/)
    expect(BUILDER).toMatch(/const full = r\.goUrl \?\? /)
    expect(BUILDER).toMatch(/aria-label="سبب اختيار الدورة"[\s\S]*?maxLength=\{PATH_REASON_MAX\}/)
  })

  it('الاسم الأول وحده، والسبب سطر بحده، والرمز بشكله', () => {
    expect(firstNameAr('  صهيب عبد الله الخطيب ')).toBe('صهيب')
    expect(cleanReason('  سطر\n  ثان  ')).toBe('سطر ثان')
    expect(cleanReason('   ')).toBeNull()
    expect(cleanReason('أ'.repeat(500))?.length).toBe(PATH_REASON_MAX)
    expect(goPath('X7K2PQ9A')).toBe('/go/X7K2PQ9A')
    for (const bad of ['', 'abc', '../etc', 'X7K2PQ9A-', 'X'.repeat(13)]) expect(GO_CODE_RE.test(bad), bad).toBe(false)
  })
})
