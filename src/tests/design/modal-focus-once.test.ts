/* ═══ النافذةُ تُهيَّأ مرّةً عند فتحها — لا مع كلّ رسمٍ لأبيها (١ أكتوبر ٢٠٢٦) ═══

   بلاغُ صاحب المنصّة على نافذة الإعادة للتوقيع وقبول التعديل: «إذا كتبتُ حرفا في
   النصوص أدناه ينتقل المؤشّر إلى العنوان بعد كلّ حرف». والعلّةُ في
   `src/components/Modal.tsx`: مفعولُ التهيئة — وهو ينقل التركيزَ إلى أوّل عنصرٍ
   في النافذة — كان معلَّقا بـ`[onClose]`، و`onClose` دالّةٌ جديدةٌ في كلّ رسم
   (`onClose={() => setX(null)}`). فكلُّ حرفٍ يُعيد رسمَ الأب فيُعيد المفعولَ فيُعيد
   التركيزَ إلى أوّل خانة. والعطبُ في كلّ نافذةٍ فيها نموذجٌ حالُه عند أبيها.

   ═══ ولماذا شجرةُ النحو ═══

   لا بيئةَ DOM في اختبارات هذا المستودَع. فقيس السلوكُ في متصفّحٍ حقيقيّ مرّةً
   على المكوّن نفسِه (`abc` في الخانة الثانية: قبله «a» فيها و«bc» في العنوان،
   وبعده «abc» فيها و Escape يُغلق)، وهذا الحارسُ يقرأ **البنية** التي تمنع
   عودتَه — لا ورودَ حرفٍ في الملفّ (`CLAUDE.md`: «الفحصُ على البنية»):

   ① مفعولُ التهيئة — الذي يضع `inert` على جذر التطبيق وينقل التركيز — قائمةُ
      اعتماده فارغة: يجري عند الفتح ويُفكّ عند الإغلاق، لا مع كلّ رسم.
   ② ولا يقرأ `onClose` بنفسه: لو قرأه وقائمتُه فارغةٌ لَأمسك أوّلَ دالّةٍ مُرّرت،
      ولو أُضيف إلى قائمته لَعاد العطب. فيقرؤه من مرجع.
   ③ والمرجعُ يُحدَّث كلّما تغيّرت `onClose` — فـEscape يبلغ أحدثَها. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const FILE = 'src/components/Modal.tsx'

const source = ts.createSourceFile(
  FILE,
  readFileSync(join(root, FILE), 'utf8'),
  ts.ScriptTarget.Latest,
  /* setParentNodes */ true,
  ts.ScriptKind.TSX,
)

/** كلُّ عقدةٍ تحت هذه تحقّق الشرط */
function all(node: ts.Node, ok: (n: ts.Node) => boolean, out: ts.Node[] = []): ts.Node[] {
  if (ok(node)) out.push(node)
  ts.forEachChild(node, (child) => { all(child, ok, out) })
  return out
}

/** استدعاءُ تابعٍ باسمه — `panel.focus()` و`root?.setAttribute(…)` */
function methodCalls(node: ts.Node, method: string): ts.CallExpression[] {
  return all(node, (n) => ts.isCallExpression(n)
    && ts.isPropertyAccessExpression(n.expression)
    && n.expression.name.text === method) as ts.CallExpression[]
}

/** معرِّفٌ باسمه يُقرأ قيمةً — لا اسمَ خاصّيّةٍ بعد نقطة */
function reads(node: ts.Node, name: string): boolean {
  return all(node, (n) => ts.isIdentifier(n) && n.text === name
    && !(ts.isPropertyAccessExpression(n.parent) && n.parent.name === n)).length > 0
}

const modal = all(source, (n) => ts.isFunctionDeclaration(n) && n.name?.text === 'Modal')[0] as
  ts.FunctionDeclaration | undefined

const effects = modal
  ? all(modal, (n) => ts.isCallExpression(n) && ts.isIdentifier(n.expression)
    && n.expression.text === 'useEffect') as ts.CallExpression[]
  : []

/** مفعولُ التهيئة: يضع `inert` على الجذر — وبه يُعرَف، لا بترتيبه في الملفّ */
const setup = effects.filter((e) => methodCalls(e.arguments[0], 'setAttribute')
  .some((c) => ts.isStringLiteral(c.arguments[0]) && c.arguments[0].text === 'inert'))

describe('النافذةُ تُهيَّأ مرّةً عند فتحها', () => {
  it('الدالّةُ ومفعولُ تهيئتها مقروءان — وإلّا فالحارسُ يقيس الفراغ', () => {
    expect(modal, 'لا دالّةَ Modal في الملفّ').toBeDefined()
    expect(setup.length, 'لا مفعولَ يضع inert — أو اثنان').toBe(1)
    expect(methodCalls(setup[0].arguments[0], 'focus').length, 'مفعولُ التهيئة لا ينقل التركيز').toBeGreaterThan(0)
  })

  it('⚠️ ① قائمةُ اعتماده فارغة — يجري عند الفتح لا مع كلّ رسم', () => {
    const deps = setup[0]?.arguments[1]
    expect(deps && ts.isArrayLiteralExpression(deps), 'بلا قائمة اعتمادٍ يجري مع كلّ رسم').toBe(true)
    expect((deps as ts.ArrayLiteralExpression).elements.map((e) => e.getText(source)),
      'في قائمته ما يتغيّر مع الرسم — فيعود التركيزُ إلى أوّل خانةٍ مع كلّ حرف').toEqual([])
  })

  it('⚠️ ② ولا يقرأ `onClose` بنفسه — بل من مرجع', () => {
    expect(reads(setup[0].arguments[0], 'onClose'),
      'مفعولُ التهيئة يقرأ onClose — فإمّا قديمةٌ أُمسكت أو عاد العطبُ بإضافتها إلى قائمته').toBe(false)
    expect(reads(setup[0].arguments[0], 'onCloseRef'), 'Escape لا يبلغ onClose من مرجعها').toBe(true)
  })

  it('⚠️ ③ والمرجعُ يُحدَّث كلّما تغيّرت `onClose`', () => {
    const updater = effects.find((e) => all(e.arguments[0], (n) => ts.isBinaryExpression(n)
      && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && n.left.getText(source) === 'onCloseRef.current'
      && n.right.getText(source) === 'onClose').length > 0)
    expect(updater, 'لا مفعولَ يكتب أحدثَ onClose في مرجعها').toBeDefined()
    const deps = updater!.arguments[1]
    expect(deps && ts.isArrayLiteralExpression(deps)
      && deps.elements.some((e) => e.getText(source) === 'onClose'),
    'المرجعُ لا يُحدَّث حين تتغيّر onClose').toBe(true)
  })
})
