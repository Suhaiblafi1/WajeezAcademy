/* صندوقُ «شعبٌ بلا فصل» في «المواسم» — بنيةٌ لا نصّ (١٩ أكتوبر ٢٠٢٦).

   كان يعرض كلَّ شعبةٍ بلا فصلٍ بزرّ «سمّ الفصل» كأنّه عملٌ ينتظرك — وأكثرُها يتحدّد فصلُه وحدَه عند اعتماد
   خطّة مدرّبه. فالصندوقُ المنبِّهُ لما يحتاجك وحدَه، وما يتحدّد وحدَه مطويٌّ بخياره. والتعليقاتُ تُنزع قبل الفحص. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const screen = readFileSync(join(process.cwd(), 'src/pages/admin/Terms.tsx'), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('صندوق الشعب بلا فصل', () => {
  it('المنبه لما يحتاجك وحده', () => {
    const warn = screen.slice(screen.indexOf('<Panel as="section" tone="warn"'), screen.indexOf('</Panel>', screen.indexOf('<Panel as="section" tone="warn"')))
    expect(warn, 'الصندوق المنبه يعرض ما يتحدد وحده').toMatch(/termless\.filter\(\(c\) => c\.kind === "needs"\)\.map/)
    expect(warn).not.toMatch(/c\.kind === "auto"/)
  })

  it('وما يتحدد وحده مطوي — والاختيار باق فيه', () => {
    expect(screen).toMatch(/<Panel as="details"[^>]*>\s*<summary[\s\S]*?termlessAutoAr\(termless\.filter\(\(c\) => c\.kind === "auto"\)\.length\)/)
    expect(screen).toMatch(/termless\.filter\(\(c\) => c\.kind === "auto"\)\.map\(\(c\) => termlessCard\(c, termlessWaitAr\(c, fmtDateAr\)\)\)/)
    expect(screen, 'سقط زر التسمية — والاختيار حق لا يسلب').toMatch(/onClick=\{\(\) => void nameTerm\(c\)\}/)
  })
})
