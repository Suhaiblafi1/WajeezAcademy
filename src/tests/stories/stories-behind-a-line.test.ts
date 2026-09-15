/* حارسُ النماذج المطويّة — على شجرة النحو لا على ورودِ حرف.

   ═══ ما يُحرَس ═══

   قرارُ صاحب المنصّة (١٥ سبتمبر ٢٠٢٦): «هذه الخانة لا أريدها أن تظهر مباشرة،
   بل إذا نُقر على جملةٍ معيّنة تظهر النماذجُ أسفلها… لأنّها غير مهمّةٍ
   إطلاقا». فالقسمُ في الرئيسة **سطرٌ يُنقر**، والبطاقاتُ خلفه.

   ═══ ولمَ الشجرةُ لا `toContain` ═══

   القاعدةُ في `CLAUDE.md`: الفحصُ على البنية. و«القسمُ مطويّ» لا يُقاس بورودِ
   كلمةٍ في ملفّ: `useState(false)` قد تكون لشيءٍ آخرَ في الدالّة نفسِها،
   و`hidden` قد تُكتب في تعليق. والمحروسُ **علاقةُ ثلاثةِ أشياء**: زرٌّ يقول
   ما يفتحه، ولوحٌ يحمل ذلك المعرِّف ويُخفى بشرط، والبطاقاتُ **داخلَ** اللوح.

   فلو رُفعت البطاقاتُ من اللوح إلى الصفحة عادت تُعرض مباشرةً — ويسقط هذا
   الحارس. ولو ذهب `hidden` بقي اللوحُ مبسوطا — ويسقط. ولو افترق معرِّفُ الزرّ
   عن معرِّف اللوح لأشار الزرُّ إلى عدم — ويسقط. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const FILE = 'src/pages/Home.tsx'

const source = ts.createSourceFile(
  FILE,
  readFileSync(join(root, FILE), 'utf8'),
  ts.ScriptTarget.Latest,
  /* setParentNodes */ true,
  ts.ScriptKind.TSX,
)

function find(node: ts.Node, ok: (n: ts.Node) => boolean): ts.Node | undefined {
  if (ok(node)) return node
  return ts.forEachChild(node, (child) => find(child, ok))
}

function findAll(node: ts.Node, ok: (n: ts.Node) => boolean): ts.Node[] {
  const out: ts.Node[] = []
  const walk = (n: ts.Node) => {
    if (ok(n)) out.push(n)
    ts.forEachChild(n, walk)
  }
  walk(node)
  return out
}

const opening = (n: ts.Node): ts.JsxOpeningLikeElement | null =>
  ts.isJsxElement(n) ? n.openingElement : ts.isJsxSelfClosingElement(n) ? n : null

const tagOf = (n: ts.Node): string | null => opening(n)?.tagName.getText(source) ?? null

/** خاصّيّةٌ على عنصر — نصُّ قيمتها كما كُتبت، أو `''` إن كانت بلا قيمة */
function attr(n: ts.Node, name: string): string | null {
  const props = opening(n)?.attributes.properties ?? []
  const found = props.find((p) => ts.isJsxAttribute(p) && p.name.getText(source) === name)
  if (!found || !ts.isJsxAttribute(found)) return null
  return found.initializer?.getText(source) ?? ''
}

/** دالّةُ القسم — البحثُ داخلها وحدَها فلا يُطابَق قسمٌ آخرُ في الصفحة */
const stories = find(
  source,
  (n) => ts.isFunctionDeclaration(n) && n.name?.text === 'Stories',
)!

describe('نماذجُ الرحلات خلف سطرٍ يُنقر', () => {
  it('دالّةُ القسم مقروءة — وإلّا خضرَّ ما بعدها على الفراغ', () => {
    expect(stories, 'لم تُوجد دالّة Stories').toBeTruthy()
    expect(findAll(stories, (n) => opening(n) !== null).length).toBeGreaterThan(5)
  })

  const trigger = () =>
    findAll(stories, (n) => tagOf(n) === 'button' && attr(n, 'aria-controls') !== null)[0]

  it('سطرٌ يُنقر يقول ما يفتحه', () => {
    const btn = trigger()
    expect(btn, 'لا زرَّ يفتح النماذج').toBeTruthy()
    expect(attr(btn, 'aria-expanded'), 'الزرُّ لا يقول أمطويٌّ هو أم مفتوح').toBeTruthy()
    expect(attr(btn, 'onClick'), 'زرٌّ لا يفعل شيئا').toBeTruthy()
  })

  const panel = () => {
    const controls = attr(trigger(), 'aria-controls')!.replace(/["'{}]/g, '')
    return findAll(stories, (n) => (attr(n, 'id') ?? '').replace(/["'{}]/g, '') === controls)[0]
  }

  it('واللوحُ الذي يشير إليه موجودٌ ويُخفى بشرط', () => {
    const p = panel()
    expect(p, 'الزرُّ يشير إلى لوحٍ لا وجودَ له').toBeTruthy()
    const hidden = attr(p, 'hidden')
    expect(hidden, 'اللوحُ مبسوطٌ دائما — لا شيءَ يخفيه').toBeTruthy()
    /* والإخفاءُ مربوطٌ بحالةٍ لا ثابتٌ: `hidden` أو `hidden={true}` تُخفيه
       أبدا، فلا يفتحه الزرّ. */
    expect(hidden).toMatch(/\{[^}]*\w/)
    expect(hidden).not.toMatch(/\{true\}/)
  })

  it('والبطاقاتُ داخلَ اللوح لا في الصفحة', () => {
    const inPanel = findAll(panel(), (n) =>
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      n.expression.name.text === 'map' &&
      n.expression.expression.getText(source) === 'stories',
    )
    expect(inPanel.length, 'شريطُ النماذج خارجَ اللوح — فيُعرض مباشرة').toBe(1)
  })

  it('ولا يبقى فوقَ السطر عنوانُ قسمٍ يُغني عن طيّه', () => {
    /* العنوانُ «هكذا تُبنى الرحلة عندنا» نزل داخلَ اللوح: لو بقي فوقه لكان
       القسمُ مبسوطا في كلّ الأحوال — وهو الذي طُلب طيُّه. */
    const headings = findAll(stories, (n) => tagOf(n) === 'h2')
    expect(headings.length, 'لا عنوانَ للقسم أصلا').toBeGreaterThan(0)
    const inPanel = findAll(panel(), (n) => tagOf(n) === 'h2')
    expect(inPanel.length, 'عنوانُ القسم خارجَ اللوح').toBe(headings.length)
  })
})
