/* حارسُ السطر تحت دعوة الصدر — على البنية لا على الحرف.

   ═══ ما يُحرَس ═══

   دعوةُ الصدر «اعرف من أين تبدأ» يتبعها سطرٌ يقول ما يقع بعد النقر
   («مجاناً · بلا حساب»). والسطرُ ليس زينة: بغيره لا يعرف الزائرُ الجديدُ كم
   يُطلب منه ولا إلامَ يُفضي، فيدفع ثمنَ القرار قبل أن يعرف سعرَه.

   ═══ ولماذا شجرةُ النحو لا `toMatch` ═══

   القاعدةُ في `CLAUDE.md`: «فالفحصُ على **البنية** لا على ورودِ حرفٍ في
   ملفّ» — وقد مرّ في هذا المستودَع ثلاثةُ حرّاسٍ خضراءَ لأسبابٍ خاطئة
   (طابقوا نصّا في **تعليق**، أو اسما جزءا من اسم).

   و`expect(home).toMatch(/مجاناً · بلا حساب/)` يقع في الفخّ نفسِه بأربع طرق:
   يخضرّ والجملةُ في تعليقٍ فوق الشيفرة لا في شاشة؛ ويخضرّ ولو نُقل السطرُ
   **قبل** الزرّ فلا يشرحه؛ ويخضرّ ولو صار في قسمٍ آخرَ من الملفّ بعيدا عن
   الصدر؛ ويحمرّ إن غُيِّرت كلمةٌ في الجملة، وتغييرُ النصّ حقُّ صاحب المنصّة
   لا عطبٌ يُمنع.

   فالمقروءُ هنا **شجرةُ النحو** (`typescript`): يُفتَّش عن دالّة `Hero`،
   ثمّ عن المرساة التي `href="#diagnostic"` داخلَها — وهي الدعوةُ نفسُها —
   ثمّ يُنظر في إخوتها: أوّلُ عنصرٍ بعدها يجب أن يكون `<p>` وفيه نصٌّ.

   والتعاليقُ لا وجودَ لها في الشجرة، فلا تُطابَق. والنصُّ لا يُقاس بحرفه بل
   بوجوده. والموضعُ يُقاس بالأخوّة والترتيب لا بقربِ السطور. */

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

/** أوّلُ عقدةٍ في الشجرة تحقّق الشرط */
function find(node: ts.Node, ok: (n: ts.Node) => boolean): ts.Node | undefined {
  if (ok(node)) return node
  return ts.forEachChild(node, (child) => find(child, ok))
}

/** اسمُ وسمِ العنصر — `a` و`p` وأمثالُهما */
function tagOf(node: ts.Node): string | null {
  if (ts.isJsxElement(node)) return node.openingElement.tagName.getText(source)
  if (ts.isJsxSelfClosingElement(node)) return node.tagName.getText(source)
  return null
}

/** قيمةُ خاصّيّةٍ نصّيّة على العنصر — أو `null` إن لم تكن نصّا ساكنا */
function attr(node: ts.JsxElement, name: string): string | null {
  const found = node.openingElement.attributes.properties.find(
    (p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(source) === name,
  )
  const init = found?.initializer
  return init && ts.isStringLiteral(init) ? init.text : null
}

/** أهلُ العنصر من العناصر وحدَها — يسقط الفراغُ بين الوسوم والتعاليق */
function elementSiblings(node: ts.Node): ts.Node[] {
  const parent = node.parent
  if (!parent || !ts.isJsxElement(parent)) return []
  return parent.children.filter((c) => tagOf(c) !== null)
}

describe('السطرُ تحت دعوة الصدر', () => {
  const hero = find(source, (n) => ts.isFunctionDeclaration(n) && n.name?.getText(source) === 'Hero')

  it('ودالّةُ الصدر موجودة — وإلّا فالحارسُ يحرس العدم', () => {
    expect(hero).toBeDefined()
  })

  const cta = hero && find(hero, (n) => ts.isJsxElement(n) && tagOf(n) === 'a' && attr(n, 'href') === '#diagnostic')

  it('وفيها الدعوةُ — مرساةٌ إلى «مؤشر وجيز»', () => {
    expect(cta).toBeDefined()
  })

  it('ويتبعها عنصرُ `p` مباشرةً — لا قبلَها ولا عنصرٌ آخرُ بينهما', () => {
    const siblings = elementSiblings(cta!)
    const at = siblings.indexOf(cta!)
    expect(at).toBeGreaterThanOrEqual(0)

    const next = siblings[at + 1]
    expect(next, 'لا عنصرَ بعد الدعوة').toBeDefined()
    expect(tagOf(next!)).toBe('p')
  })

  it('وفي السطرِ نصٌّ يُقرأ — لا وسمٌ فارغ', () => {
    const siblings = elementSiblings(cta!)
    const next = siblings[siblings.indexOf(cta!) + 1] as ts.JsxElement
    const text = next.children
      .filter(ts.isJsxText)
      .map((t) => t.text.trim())
      .join('')
    expect(text.length).toBeGreaterThan(0)
  })
})
