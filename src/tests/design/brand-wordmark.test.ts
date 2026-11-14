/* اسمُ الأكاديميّة بجانب العلامة — بخطّه القديم، وبترتيبه الصحيح (صاحب المنصّة، ١٤ نوفمبر ٢٠٢٦).

   قال وأرفق صورةَ التذييل: «الاسمُ هنا خطأ.. وأعِد الخطَّ كما كان سابقا للوقو فقط». فالمحروس:
   ١) كلُّ «أكاديمية وجيز» بجانب العلامة (`logo-mark.png`) بصنف `brand-wordmark` — وهو IBM Plex Sans Arabic، خطُّ الواجهة
      قبل Tajawal (#927). وبقيّةُ الموقع على Tajawal: «للوقو فقط».
   ٢) والخطُّ محمَّلٌ فعلا: رابطُ Google Fonts يطلبه بوزن 700 — وإلّا فالصنفُ اسمُ خطٍّ لا يصل فيرتدّ إلى Tajawal بلا أثر.
   ٣) والتذييلُ يقول «أكاديمية وجيز» كالرأس، لا «وجيز أكاديمي».
   والفحصُ على الشيفرة بلا تعاليقها، وعلى موضع الاسم من العلامة لا على ورود الكلمة في الملفّ. */

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
const bare = (s: string) => s.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, ' ')

function tsxFiles(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const p = join(dir, name)
    if (name === 'tests') return []
    return statSync(join(root, p)).isDirectory() ? tsxFiles(p) : p.endsWith('.tsx') ? [p] : []
  })
}

/** كلُّ اسمٍ «أكاديمية…» يلي العلامةَ مباشرة — ملفُّه وصنفُه */
function wordmarks(): { file: string; cls: string }[] {
  const out: { file: string; cls: string }[] = []
  for (const file of tsxFiles('src')) {
    const src = bare(read(file))
    let at = src.indexOf('logo-mark.png')
    while (at >= 0) {
      const after = src.slice(at, at + 500)
      const m = /\/>\s*(?:\{[^}]*\}\s*)?<(?:span|div) className="([^"]*)">(?:<span[^>]*>)?أكاديمية/.exec(after)
      if (m) out.push({ file: relative(root, join(root, file)), cls: m[1] })
      at = src.indexOf('logo-mark.png', at + 1)
    }
  }
  return out
}

describe('اسم الأكاديمية بجانب العلامة — بخطه القديم وحده', () => {
  it('⚠️ كل «أكاديمية وجيز» بجانب العلامة بصنف brand-wordmark', () => {
    const found = wordmarks()
    expect(found.length, 'لم يوجد اسمٌ بجانب العلامة — الحارس يحرس العدم').toBeGreaterThanOrEqual(8)
    const missing = found.filter((w) => !w.cls.split(/\s+/).includes('brand-wordmark')).map((w) => w.file)
    expect(missing, 'اسمٌ بجانب العلامة بخطّ الموقع لا بخطّه القديم').toEqual([])
  })

  it('⚠️ والصنف IBM Plex Sans Arabic أولا — والموقع كله على Tajawal', () => {
    const css = read('src/index.css')
    expect(css).toMatch(/\.brand-wordmark\s*\{\s*font-family:\s*"IBM Plex Sans Arabic",/)
    expect(css, 'تغيّر خطُّ الموقع كلِّه — والطلبُ للوقو وحدَه').toMatch(/body\s*\{[^}]*font-family:\s*"Tajawal",/)
  })

  it('⚠️ والخط محمّل فعلا — رابط Google Fonts يطلب IBM Plex Sans Arabic بوزن 700', () => {
    const href = /href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]+)"/.exec(read('index.html'))?.[1] ?? ''
    expect(href, 'لا يُحمَّل خطُّ الشعار').toMatch(/family=IBM\+Plex\+Sans\+Arabic:wght@[\d;]*700/)
  })

  it('⚠️ والتذييل يقول «أكاديمية وجيز» كالرأس — لا «وجيز أكاديمي»', () => {
    const footer = bare(read('src/components/SiteFooter.tsx'))
    expect(footer).toMatch(/<div className="brand-wordmark font-bold">أكاديمية <span className="text-teal-light-ink">وجيز<\/span><\/div>/)
    expect(footer, 'عاد «وجيز أكاديمي»').not.toMatch(/وجيز <span[^>]*>أكاديمي</)
  })
})
