/* «تتخرّج بـ» في إطارٍ ناعمٍ خفيف — قرارُ صاحب المنصّة (٢٧ أكتوبر ٢٠٢٦).

   ═══ وما يُحرَس ═══
   ١) الإطارُ درجةُ `Inset` من سلّم الأسطح، لا صيغةٌ تُكتب باليد.
   ٢) ومواضعُه الثلاثة — البطاقةُ المميّزة وشريطُ الرئيسة وصفحةُ المسارات — تمرّ به، ولا يبقى
      سطرُ مخرَجٍ عارٍ في شيفرتها.

   ═══ وكيف رُئي ساقطا ═══
   أُعيد سطرُ الكتالوج عاريا فسقط الثاني، وأُبدل `Inset` بـ`p` فسقط الأوّل. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, ' ')

describe('ما تتخرج به في إطار ناعم', () => {
  it('⚠️ الإطار درجة Inset من سلم الأسطح', () => {
    expect(code('src/components/PathOutput.tsx'), 'الإطار ليس Inset').toMatch(/<Inset as="p" tone="accent"[\s\S]*?تتخرّج بـ: \{output\}[\s\S]*?<\/Inset>/)
  })

  it('⚠️ ومواضعه الثلاثة تمر به — ولا سطر مخرج عار', () => {
    const best = code('src/pages/home/Bestsellers.tsx')
    const cat = code('src/pages/Catalog.tsx')
    expect(best, 'البطاقة المميّزة بلا إطار').toMatch(/<PathOutput output=\{spotlight\.p\.output\}/)
    expect(best, 'شريط الرئيسة بلا إطار').toMatch(/<PathOutput output=\{b\.item\.output\}/)
    expect(cat, 'صفحة المسارات بلا إطار').toMatch(/<PathOutput output=\{p\.output\}/)
    for (const [name, src] of [['الرئيسة', best], ['الكتالوج', cat]] as const) {
      expect(src, `سطر مخرج عار في ${name}`).not.toContain('تتخرّج بـ')
    }
  })
})
