/* الدليلُ المطبوعُ بصوره (٣٠ سبتمبر ٢٠٢٦).

   في رأس الدليل «اطبعه أو احفظه PDF» — وخرج المطبوعُ نصّا بلا صورةٍ واحدة:
   كلُّ لقطةٍ داخلَ زرِّ التكبير، و`index.css` يُخفي في الطباعة كلَّ
   `button:not([aria-expanded])`. فوجب أن يعيدها الدليلُ بمحدِّدٍ أثقل.

   والفحصُ على البنية: القاعدتان تُقرآن من كتلة `@media print` بعد نزع
   التعليقات، ويُوزن المحدِّدان بالخصوصيّة — لا بورود اسمٍ في الملفّ.
   ولُقط العطبُ بطباعةٍ حقيقيّةٍ إلى PDF لا بقراءة شيفرة. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

/** كتلُ `@media print` بأقواسها المتوازنة */
function printBlocks(css: string): string[] {
  const out: string[] = []
  let at = css.indexOf('@media print')
  while (at >= 0) {
    const open = css.indexOf('{', at)
    let depth = 0, i = open
    for (; i < css.length; i++) {
      if (css[i] === '{') depth++
      else if (css[i] === '}' && --depth === 0) break
    }
    out.push(css.slice(open + 1, i))
    at = css.indexOf('@media print', i)
  }
  return out
}

/** قواعدُ الكتلة: [محدِّد، إعلانات] — ولكلّ محدِّدٍ في قائمةٍ مفصولةٍ بفواصل سطرُه */
function rules(block: string): [string, string][] {
  return [...block.matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap((m) =>
    m[1].split(',').map((s) => [s.trim(), m[2]] as [string, string]),
  )
}

/** خصوصيّةٌ تكفي هذه المحدِّدات: [مُعرِّفات، أصنافٌ وسماتٌ وأشباه، عناصر] */
function specificity(sel: string): [number, number, number] {
  const ids = (sel.match(/#[\w-]+/g) ?? []).length
  const cls = (sel.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) ?? []).filter((t) => !t.startsWith(':not')).length
  const els = (sel.replace(/\[[^\]]+\]|:[\w-]+|\.[\w-]+|#[\w-]+/g, ' ').match(/[a-z][\w-]*/gi) ?? []).length
  return [ids, cls, els]
}
const heavier = (a: number[], b: number[]) => {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]
  return false
}

/* والدليلُ ملفّان منذ ٥ أكتوبر ٢٠٢٦: صفحتُه بلقطاتها، وعُدّتُه (أنماطُه وطباعتُها)
   في `components/guide/GuideKit.tsx` — يقرؤها معه «التدريبُ معنا». فيُقرآن معا */
const GUIDE = read('src/pages/trainer/Guide.tsx') + '\n' + read('src/components/guide/GuideKit.tsx')
const INDEX = read('src/index.css')
const guidePrint = printBlocks(GUIDE).flatMap(rules)
const sitePrint = printBlocks(INDEX).flatMap(rules)

describe('الدليلُ المطبوعُ بصوره', () => {
  it('اللقطةُ داخلَ زرٍّ — وهو سببُ الحاجة', () => {
    expect(GUIDE).toMatch(/<button[^>]*className="guide-shot"[\s\S]{0,300}?<img/)
  })

  it('وقاعدةُ الموقع التي تُخفي الأزرارَ في الطباعة قائمة — وإلّا فالحارسُ بلا موضوع', () => {
    const hide = sitePrint.find(([s, d]) => /^button/.test(s) && /display:\s*none\s*!important/.test(d))
    expect(hide, 'تغيّرت قاعدةُ إخفاء الأزرار في index.css — راجع هذا الحارس').toBeDefined()
  })

  it('والدليلُ يعيد اللقطةَ بمحدِّدٍ أثقلَ منها', () => {
    const hide = sitePrint.find(([s, d]) => /^button/.test(s) && /display:\s*none\s*!important/.test(d))!
    const show = guidePrint.filter(([s, d]) => /button\.guide-shot$/.test(s) && /display:\s*block\s*!important/.test(d))
    expect(show.length, 'لا قاعدةَ في طباعة الدليل تُظهر زرَّ اللقطة — فيُطبع بلا صور').toBeGreaterThan(0)
    expect(
      show.some(([s]) => heavier(specificity(s), specificity(hide[0]))),
      `«${show.map(([s]) => s).join('، ')}» ليس أثقلَ من «${hide[0]}»`,
    ).toBe(true)
  })

  it('ولا يُمنع قسمٌ كاملٌ من الانقسام — فيدفع نفسَه ويترك صفحةً بيضاء', () => {
    const avoid = guidePrint.filter(([, d]) => /break-inside:\s*avoid/.test(d)).map(([s]) => s)
    expect(avoid).not.toContain('.guide-section')
    expect(avoid).toContain('.guide-figure')
  })
})

/* ═══ والمطبوعُ ملوّنٌ كالمثال (٣٠ سبتمبر ٢٠٢٦) ═══

   أعاد صاحبُ المنصّة تصميمَ الدليل على مثالٍ أرسله: ورقٌ كريميٌّ وغلافٌ
   ملوّنٌ ومربّعاتُ أرقامٍ بألوانها. و`index.css` يُسطِّح في الطباعة كلَّ خلفيّةٍ
   بقاعدة `*` — فخرج المطبوعُ الأوّلُ أبيضَ كلُّه، الغلافُ والأشرطةُ والمربّعات.
   فكلُّ سطحٍ ملوّنٍ في الدليل تعيده قاعدةٌ في طباعته، بـ`!important` وخصوصيّةٍ
   تغلب `*`. */
describe('والمطبوعُ بألوانه', () => {
  const flatten = sitePrint.find(([s, d]) => s === '*' && /background-color:\s*transparent\s*!important/.test(d))

  it('قاعدةُ التسطيح قائمة — وإلّا فالحارسُ بلا موضوع', () => {
    expect(flatten, 'تغيّرت قاعدةُ تسطيح الطباعة في index.css — راجع هذا الحارس').toBeDefined()
  })

  it.each(['[data-hue="amber"]', '[data-hue="coral"]', '[data-hue="sky"]', '[data-hue="blush"]', '.guide-deep', '.guide-blush'])(
    '«%s» يُطبع بلونه',
    (surface) => {
      const restore = guidePrint.filter(([s, d]) => s.endsWith(surface) && /background-color:[^;]*!important/.test(d))
      expect(restore.length, `لا قاعدةَ تعيد خلفيّةَ ${surface} في الطباعة — فيخرج أبيض`).toBeGreaterThan(0)
      expect(restore.some(([s]) => heavier(specificity(s), specificity(flatten![0])))).toBe(true)
    },
  )

  it('وكلُّ قسمٍ يبدأ صفحتَه', () => {
    const page = guidePrint.find(([s]) => s === '.guide-page')
    expect(page?.[1]).toMatch(/break-before:\s*page/)
    expect(GUIDE).toMatch(/<section id=\{s\.id\}[^>]*className="[^"]*\bguide-page\b/)
  })
})
