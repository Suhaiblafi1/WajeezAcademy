/* ═══ الإرسالُ بلا موافقةٍ يأخذ المدرّبَ إلى مربّعها (٤ أكتوبر ٢٠٢٦، ⑧) ═══
 *
 * سار صاحبُ المنصّة في مسار الاعتماد فضغط «أرسِلها للاعتماد» قبل أن يعلّم مربّعَ
 * الموافقة: قال الشريطُ «المربّعُ أسفلَ هذه الخطوة» ولم تأخذه الصفحةُ إليه —
 * والمربّعُ تحت المنهج كلِّه. واختار («do») أن يُنزَل إليه ويُبرَز. فيُحرَس:
 *
 *   ① فرعُ «confirm» في الإرسال يَعُدّ الضغطةَ ولا يُرسل شيئا، والإنزالُ إلى
 *      المربّع في **وسط** الشاشة والتركيزُ فيه بلا قفزةٍ ثانيةٍ **بعد** الرسم —
 *      أثرٌ يتبع العدّ. وكان الإنزالُ في الفرع نفسِه فوقف دون المربّع: رُسم سطرُ
 *      «ما ينقص» وإطارُ المربّع بعد حسابه فطالت الصفحة، وقُصّ أسفلُه على الهاتف.
 *   ② وما يُنزَل إليه هو المربّعُ نفسُه، ويُبرَز ما دام لم يُعلَّم — بسطحٍ من
 *      نظام الأسطح (`Card` بنغمة «warn») خلفه، لا صيغةٍ مكتوبةٍ في وسمه
 *      (`design-system.test.ts`)، والوسمُ لا يتبدّل فلا يضيع التركيزُ من المربّع.
 *   ③ وتعليمُه يرفع الإبراز.
 *
 * ويُقرأ بمحلّل TypeScript على الاستدعاءات والوسوم — لا على ورود حرفٍ قد يكون
 * في تعليق.
 */
import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const REL = 'src/pages/trainer/CohortWorkspace.tsx'
const sf = ts.createSourceFile(REL, readFileSync(join(root, REL), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

function all(node: ts.Node, pred: (n: ts.Node) => boolean): ts.Node[] {
  const out: ts.Node[] = []
  const visit = (n: ts.Node) => { if (pred(n)) out.push(n); ts.forEachChild(n, visit) }
  visit(node)
  return out
}
/** نصُّ قيمة الخاصّيّة في وسمٍ — أو `null` إن لم تكن */
function attr(el: ts.JsxOpeningLikeElement, name: string): string | null {
  const a = el.attributes.properties.find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(sf) === name)
  return a ? (a.initializer?.getText(sf) ?? '') : null
}
/** خاصّيّةٌ في كائنٍ حرفيّ بقيمتها نصّا */
function prop(o: ts.Expression | undefined, key: string): string | null {
  if (!o || !ts.isObjectLiteralExpression(o)) return null
  const p = o.properties.find((x): x is ts.PropertyAssignment => ts.isPropertyAssignment(x) && x.name.getText(sf) === key)
  return p ? p.initializer.getText(sf) : null
}
const methodCall = (calls: ts.CallExpression[], name: string) =>
  calls.find((c) => ts.isPropertyAccessExpression(c.expression) && c.expression.name.text === name)

/** فرعُ «confirm» في `submitNow` — حيث يقف الإرسالُ بلا موافقة */
function confirmBranch(): ts.IfStatement {
  const submit = all(sf, (n) => ts.isVariableDeclaration(n) && n.name.getText(sf) === 'submitNow')
  expect(submit.length, 'لا `submitNow` — تغيّر بناءُ الإرسال فتغيّر الحارس').toBe(1)
  const ifs = all(submit[0], (n) => ts.isIfStatement(n) && n.expression.getText(sf) === 'stop === "confirm"') as ts.IfStatement[]
  expect(ifs.length, 'لا فرعَ «confirm» في الإرسال').toBe(1)
  return ifs[0]
}

describe('⑧ الإرسالُ بلا موافقةٍ يأخذه إلى المربّع', () => {
  it('① الفرعُ يَعُدّ الضغطةَ ولا يُرسل — والإنزالُ إلى وسط الشاشة والتركيزُ بعد الرسم', () => {
    const branch = confirmBranch()
    const inBranch = all(branch.thenStatement, ts.isCallExpression) as ts.CallExpression[]
    const count = inBranch.find((c) => c.expression.getText(sf) === 'setConfirmNudge')
    expect(count?.arguments[0]?.getText(sf), 'الضغطةُ لا تُعَدّ — فالثانيةُ لا تُنزل إليه').toBe('(n) => n + 1')
    expect(methodCall(inBranch, 'scrollIntoView'), 'الإنزالُ يُحسب ساعةَ الضغط قبل الرسم — فيقف دون المربّع').toBeUndefined()
    const stmts = ts.isBlock(branch.thenStatement) ? branch.thenStatement.statements : []
    expect(stmts.length > 0 && ts.isReturnStatement(stmts[stmts.length - 1]), 'يُرسل بلا موافقة').toBe(true)

    /* والأثرُ الذي يتبع العدّ */
    const effects = (all(sf, (n) => ts.isCallExpression(n) && n.expression.getText(sf) === 'useEffect') as ts.CallExpression[])
      .filter((c) => c.arguments[1]?.getText(sf) === '[confirmNudge]')
    expect(effects.length, 'لا أثرَ يتبع الضغطة — فلا إنزالَ بعد الرسم').toBe(1)
    const body = effects[0].arguments[0]
    const calls = all(body, ts.isCallExpression) as ts.CallExpression[]
    const guard = all(body, (n) => ts.isIfStatement(n) && n.expression.getText(sf) === '!confirmNudge')
    expect(guard.length, 'يُنزل عند فتح الصفحة بلا ضغطة').toBe(1)

    const scroll = methodCall(calls, 'scrollIntoView')
    expect(scroll, 'لا يُنزَل إلى المربّع — يُقال «أسفلَ هذه الخطوة» والصفحةُ مكانها').toBeDefined()
    expect((scroll!.expression as ts.PropertyAccessExpression).expression.getText(sf), 'يُنزَل إلى غير المربّع').toBe('confirmBoxRef.current')
    expect(prop(scroll!.arguments[0], 'block'), 'يُلصَق المربّعُ بحافّة الشاشة لا في وسطها').toBe('"center"')

    const focus = methodCall(calls, 'focus')
    expect(focus, 'لا تركيزَ في المربّع').toBeDefined()
    expect(prop(focus!.arguments[0], 'preventScroll'), 'التركيزُ يقفز ثانيةً فوق الإنزال').toBe('true')
  })

  it('② وما يُنزَل إليه هو المربّعُ نفسُه — ويُبرَز بسطحٍ من نظام الأسطح ما دام لم يُعلَّم', () => {
    const holders = all(sf, (n) => (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n))
      && attr(n, 'ref') === '{confirmBoxRef}') as ts.JsxOpeningElement[]
    expect(holders.length, 'لا وسمَ يحمل `confirmBoxRef` — فالإنزالُ إلى لا شيء').toBe(1)
    const holder = holders[0].parent
    const box = all(holder, (n) => ts.isJsxSelfClosingElement(n) && n.tagName.getText(sf) === 'input'
      && attr(n, 'id') === '"plan-confirm"')
    expect(box.length, 'الوسمُ المُنزَلُ إليه لا يحوي مربّعَ الموافقة').toBe(1)

    const decl = all(sf, (n) => ts.isVariableDeclaration(n) && n.name.getText(sf) === 'consentNudged') as ts.VariableDeclaration[]
    expect(decl.length).toBe(1)
    expect(decl[0].initializer?.getText(sf), 'الإبرازُ لا يتبع «ضُغط ولم يُعلَّم بعد»').toBe('confirmNudge > 0 && !confirm')

    /* والإبرازُ سطحٌ من النظام (بطاقةٌ بنغمة «انتبه») — لا صيغةٌ مكتوبةٌ في الوسم */
    const shown = all(holder, (n) => ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
      && n.left.getText(sf) === 'consentNudged') as ts.BinaryExpression[]
    expect(shown.length, 'المربّعُ لا يُبرَز').toBe(1)
    const card = shown[0].right
    expect(ts.isJsxSelfClosingElement(card) && card.tagName.getText(sf) === 'Card', 'الإبرازُ ليس من نظام الأسطح').toBe(true)
    expect(attr(card as ts.JsxSelfClosingElement, 'tone'), 'الإبرازُ بغير نغمة «انتبه»').toBe('"warn"')
    expect(attr(holders[0], 'data-nudge') ?? '').toMatch(/^\{consentNudged \?/)
  })

  it('③ وتعليمُه يرفع الإبراز', () => {
    const boxes = all(sf, (n) => ts.isJsxSelfClosingElement(n) && n.tagName.getText(sf) === 'input'
      && attr(n, 'id') === '"plan-confirm"') as ts.JsxSelfClosingElement[]
    expect(boxes.length).toBe(1)
    const change = attr(boxes[0], 'onChange') ?? ''
    expect(change, 'المربّعُ لا يُعلَّم').toContain('setConfirm(e.target.checked)')
    expect(change, 'الإبرازُ يبقى بعد التعليم').toMatch(/if \(e\.target\.checked\) setConfirmNudge\(0\)/)
  })
})
