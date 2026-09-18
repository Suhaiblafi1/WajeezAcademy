/* خريطةُ الموقع — تُولَّد من السجلّ، فلا تفترق عمّا يُخدَم فعلا.

   كانت `public/sitemap.xml` ملفّا ساكنا يُحرَّر بيد، فافترق عن الموقع:
   أعلن `/verify` صفحةً لا `SeoHead` فيها أصلا (فتُقدَّم بعنوان الرئيسة
   وcanonicalها)، وأغفل `/mirror` و`/calendar` وهما صفحتان عامّتان.

   وخريطةٌ تدعو إلى عنوانٍ لا يُفهرَس، وتسكت عن عنوانٍ يستحقّ — كلاهما ضياع. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PUBLIC_PAGES } from '../../application/site/public-pages'
import { sitemap } from '../../../scripts/prerender-seo'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const XML = sitemap()
const locs = [...XML.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])

describe('خريطةُ الموقع', () => {
  it('تُعلن كلَّ صفحةٍ عامّةٍ ولا تزيد', () => {
    const expected = PUBLIC_PAGES.map((p) => `https://www.wajeezacademy.com${p.path}`)
    expect([...locs].sort()).toEqual([...expected].sort())
  })

  it('ولا عنوانَ مكرّر', () => {
    expect(new Set(locs).size).toBe(locs.length)
  })

  it('وكلُّ عنوانٍ مطلقٌ صالح', () => {
    for (const loc of locs) expect(() => new URL(loc)).not.toThrow()
    expect(locs.length).toBeGreaterThan(10)
  })

  it('ولا تبقى علامةُ الأصل حرفيّةً — خريطةٌ فيها علامةٌ تُرفض كلُّها', () => {
    expect(XML).not.toContain('%VITE_SITE_ORIGIN%')
    expect(XML.startsWith('<?xml')).toBe(true)
    expect(XML).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
  })

  it('والنطاقُ لا يُكتب حرفا في السكربت — يُسأل وحدةُ الأصل', () => {
    const src = readFileSync(join(root, 'scripts/prerender-seo.ts'), 'utf8')
    const live = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')
    expect(live, 'نطاقٌ مكتوبٌ حرفا يفترق عن مصدره').not.toContain('wajeezacademy.com')
    expect(live).toContain('CANONICAL_ORIGIN')
  })

  it('ولم يعد في المستودَع ملفُّ خريطةٍ ساكنٌ ينافسها', () => {
    /* مصدران للخريطة يعني واحدا مهجورا يُنسخ إلى `dist/` فيُقدَّم للزاحف */
    expect(() => readFileSync(join(root, 'public/sitemap.xml'), 'utf8')).toThrow()
  })
})
