/* صفحةُ شهادةٍ بعينها لا تُفهرس — وصفحةُ التحقّق العامّة تُفهرس (١٠ نوفمبر ٢٠٢٦).

   `/verify/<رقم>` تعرض الاسمَ الكاملَ لصاحب الشهادة، ورابطُها يُنشر في سيرةٍ أو منشور. وكانت بلا `noindex` — وخطابُ التوصية
   جارُها لا يُفهرس. والحكمُ في `verifySeo` (`public-pages.ts`)، والصفحةُ تأخذه برقمها. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { verifySeo } from '@/application/site/public-pages'

const PAGE = readFileSync(join(process.cwd(), 'src/pages/Verify.tsx'), 'utf8')

describe('صفحة التحقق', () => {
  it('⚠️ برقم شهادة: لا تفهرس — وبلا رقم: تفهرس', () => {
    expect(verifySeo('WJ-CERT-2026-00001').noindex, 'صفحة شهادة باسم صاحبها تفهرس').toBe(true)
    expect(verifySeo(undefined).noindex).toBe(false)
    expect(verifySeo('  ').noindex).toBe(false)
    expect(verifySeo('WJ-CERT-2026-00001').path, 'تبقى صورتها الرسمية صفحة التحقق العامة').toBe('/verify')
  })

  it('⚠️ والصفحة تأخذ الحكم برقمها من العنوان', () => {
    expect(PAGE).toMatch(/const \{ number \} = useParams\(\)/)
    expect(PAGE).toMatch(/<SeoHead \{\.\.\.verifySeo\(number\)\} \/>/)
  })
})
