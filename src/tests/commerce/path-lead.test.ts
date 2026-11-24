/* نموذجُ «لم تقرر بعد؟ اترك رقمك» وبكسلُ Meta في `/go/BF80` (٢٤ نوفمبر ٢٠٢٦) — والخادمُ في
   `server/tests/commerce/path-lead.test.ts`. والفحصُ على البنية، والتعليقاتُ تُنزع. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { PATH_CONTACT_CONSENT_AR } from '@/application/advisor/guest-contact'
import { plainAr } from '@/application/text/plain-ar'

const code = (p: string) => readFileSync(p, 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const PAGE = code('src/pages/PrivatePath.tsx')
const FORM = code('src/components/PathLeadForm.tsx')

describe('نموذج المسار العام وبكسله', () => {
  it('⚠️ النموذج والبكسل في المسار العام وحده — لا في مسار باسم إنسان', () => {
    expect(PAGE).toMatch(/\{isPublic && <PathLeadForm code=\{v\.code\} \/>\}/)
    expect(PAGE).toMatch(/if \(!isPublic\) return;\s*loadMetaPixel\(\{ quiet: true \}\);\s*trackPixel\("PageView"/)
    expect(PAGE.match(/loadMetaPixel\(/g)?.length).toBe(1)
    expect(PAGE).toMatch(/if \(isPublic && current\.price\) \{\s*trackPixel\("InitiateCheckout"/)
  })

  it('⚠️ Lead بعد قبول الخادم — وبلا اسم ولا رقم', () => {
    expect(FORM).toMatch(/await apiPost\([^;]+;\s*trackPixel\("Lead", \{ content_name: code \}\);/)
    expect(FORM.match(/trackPixel\(/g)?.length).toBe(1)
  })

  it('⚠️ الموافقة تعرض تحت الزر، ونصها بلا تشكيل', () => {
    expect(FORM).toMatch(/<p [^>]*>\{PATH_CONTACT_CONSENT_AR\}<\/p>/)
    expect(PATH_CONTACT_CONSENT_AR).toBe(plainAr(PATH_CONTACT_CONSENT_AR))
  })

  it('⚠️ وسياسة الخصوصية تقول البكسل — لا «لا كوكيز إعلانية» بلا استثناء', () => {
    const line = /'([^'\n]*كوكيز تتبع إعلانية[^'\n]*)'/.exec(code('src/data/siteContent.ts'))?.[1] ?? ''
    expect(line).toMatch(/إلا في صفحات إعلاناتنا.*بكسل Meta/)
  })

  it('⚠️ يحمل هنا هادئا: لا يتبع تبدل العنوان ولا يلتقط الأزرار — فصفحات الأكاديمية بعده لا ترسل', async () => {
    const g = globalThis as Record<string, unknown>
    const had = { window: g.window, document: g.document }
    try {
      g.window = {}
      g.document = { createElement: () => ({}), head: { appendChild: () => undefined } }
      const { loadMetaPixel, META_PIXEL_ID } = await import('@/pages/ai-jobs/meta-pixel')
      loadMetaPixel({ quiet: true })
      const fbq = (g.window as { fbq: { queue: unknown[][]; disablePushState?: boolean } }).fbq
      expect(fbq.disablePushState).toBe(true)
      expect(fbq.queue).toEqual([['set', 'autoConfig', false, META_PIXEL_ID], ['init', META_PIXEL_ID]])
    } finally {
      g.window = had.window
      g.document = had.document
    }
  })
})
