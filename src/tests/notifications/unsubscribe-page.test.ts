/* صفحةُ إلغاء الاشتراك (١١ نوفمبر ٢٠٢٦) — والعلّةُ في رأس `src/pages/Unsubscribe.tsx`.

   ① **طريقُها في التطبيق** و**تُلغى بزرٍّ لا بفتح الرابط** — فاحصو الروابط يفتحون كلَّ رابطٍ قبل صاحبه.
   ② **وتقول ما يبقى**: رسائلُ حسابه ودوراته — ونصوصُها بلا تشكيل. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { plainAr } from '@/application/text/plain-ar'
import { UNSUBSCRIBE_ASK_AR, UNSUBSCRIBE_DONE_AR, UNSUBSCRIBE_KEEP_AR } from '@/pages/Unsubscribe'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const PAGE = code('src/pages/Unsubscribe.tsx')
const APP = code('src/App.tsx')

describe('صفحة إلغاء الاشتراك', () => {
  it('⚠️ طريقها في التطبيق — والإلغاء بزر لا بفتح الرابط', () => {
    expect(APP).toMatch(/<Route path="\/unsubscribe" element=\{<Unsubscribe \/>\} \/>/)
    expect(PAGE, 'يلغي عند فتح الصفحة — يلغيه فاحص الروابط').not.toMatch(/useEffect/)
    expect(PAGE).toMatch(/onClick=\{\(\) => void confirm\(\)\}>ألغ الاشتراك<\/Button>/)
    expect(PAGE).toMatch(/apiPost<[^>]*>\("\/api\/public\/unsubscribe", \{ t: token \}\)/)
  })

  it('⚠️ تقول ما يبقى — ونصوصها بلا تشكيل', () => {
    expect(UNSUBSCRIBE_KEEP_AR).toContain('حسابك ودوراتك')
    for (const t of [UNSUBSCRIBE_ASK_AR, UNSUBSCRIBE_KEEP_AR, UNSUBSCRIBE_DONE_AR, 'ألغ الاشتراك', 'أبق اشتراكي', 'لم نلغ الاشتراك']) {
      expect(plainAr(t), t).toBe(t)
    }
  })
})
