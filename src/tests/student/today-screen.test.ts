/* الرئيسيّةُ شاشةُ يومه — ولا تعود تسعةَ ألواح (٢٠ أكتوبر ٢٠٢٦، الخطوة ط).

   كانت اللوحةُ تبني «بانتظار تسليمك» بنفسها من مهامّ الشعبة، ولا تقرأ `locked` — فتطالب
   بمهمّةٍ لم يُعقد لقاءُ محورها. والمهامُّ الآن من `/api/learner/deadlines` وحدَه، والخادمُ لا
   يعرض إلّا ما يُقبل تسليمُه (`server/tests/learning/learner-timeline-gate.test.ts`). وطلبٌ
   لم يكتمل دفعُه كان لا يُرى لمن له شعبة.

   والفحصُ على البنية لا على ورود حرف: تُقرأ الشيفرةُ بمحلّل TypeScript، فتعليقٌ يذكر
   `assessments` لا يُسقطه، ووصولٌ حقيقيٌّ إليها يُسقطه. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const FILE = join(process.cwd(), 'src/pages/student/Dashboard.tsx')
const sf = ts.createSourceFile(FILE, readFileSync(FILE, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

function fn(name: string): ts.FunctionDeclaration {
  const found = sf.statements.find((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === name)
  if (!found) throw new Error(`لا دالّةَ باسم ${name}`)
  return found
}

function walk(node: ts.Node, visit: (n: ts.Node) => void) {
  visit(node)
  ts.forEachChild(node, (c) => walk(c, visit))
}

const real = fn('RealDashboard')

describe('الرئيسيّةُ لمن له شعبة — شاشةُ يومه', () => {
  it('⚠️ لا تبني قائمةَ مهامّ بنفسها — المهامُّ من الخادم الذي يعرف ما فُتح', () => {
    const reads: string[] = []
    walk(real, (n) => {
      if (ts.isPropertyAccessExpression(n) && n.name.text === 'assessments') reads.push(n.getText(sf))
    })
    expect(reads, 'عادت اللوحةُ تقرأ مهامَّ الشعبة — ولا تعرف المقفلة').toEqual([])
  })

  it('⚠️ وطلبٌ لم يكتمل دفعُه يُقرأ لمن له شعبةٌ أيضا', () => {
    const calls: string[] = []
    walk(real, (n) => {
      if (ts.isCallExpression(n) && /^apiGet\b/.test(n.expression.getText(sf))) {
        const a = n.arguments[0]
        if (a && ts.isStringLiteralLike(a)) calls.push(a.text)
      }
    })
    expect(calls).toContain('/api/learner/orders')
  })

  it('⚠️ وما عليه من مالٍ ولقاءٍ ورسائل يدخل قائمةً واحدة', () => {
    const attrs: string[] = []
    walk(real, (n) => {
      if ((ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) && n.tagName.getText(sf) === 'MyDeadlines') {
        for (const p of n.attributes.properties) if (ts.isJsxAttribute(p)) attrs.push(p.name.getText(sf))
      }
    })
    expect(attrs).toEqual(expect.arrayContaining(['before', 'after']))
  })
})
