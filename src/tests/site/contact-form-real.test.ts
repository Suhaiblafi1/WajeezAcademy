/* «تواصل معنا» يُرسل فعلا — ولا يعود إلى المحاكاة (١٩ أكتوبر ٢٠٢٦).

   كان النموذجُ ينتظر `setTimeout` ثمّ يعرض رقما مرجعيّا من `Math.random` — فمن كتب ظنّ أنّه وصل.
   والفحصُ على البنية لا على ورود حرفٍ في تعليق: تُقرأ الشيفرةُ بمحلّل TypeScript، فتعليقٌ يذكر
   `setTimeout` لا يُسقطه، ونداءٌ حقيقيٌّ له يُسقطه. والسلوكُ على الخادم في
   `server/tests/support/contact-messages.test.ts`. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const FILE = join(process.cwd(), 'src/pages/Contact.tsx')
const sf = ts.createSourceFile(FILE, readFileSync(FILE, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

/** نداءاتُ الملفّ بنصّ مُناداها: «apiPost» و«window.setTimeout» و«Math.random» */
function calls(): { callee: string; firstArg: string | null }[] {
  const out: { callee: string; firstArg: string | null }[] = []
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n)) {
      const a = n.arguments[0]
      out.push({ callee: n.expression.getText(sf), firstArg: a && ts.isStringLiteralLike(a) ? a.text : null })
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return out
}

describe('«تواصل معنا» يُرسل فعلا', () => {
  it('ينادي الخادمَ برسالته', () => {
    expect(calls().some((c) => /^apiPost\b/.test(c.callee) && c.firstArg === '/api/public/contact')).toBe(true)
  })

  it('ولا محاكاةَ إرسالٍ ولا رقمَ يُخترع في المتصفّح', () => {
    const names = calls().map((c) => c.callee)
    expect(names.filter((n) => /setTimeout$/.test(n)), 'عادت المحاكاة').toEqual([])
    expect(names.filter((n) => n === 'Math.random'), 'رقمٌ مرجعيٌّ يُخترع في المتصفّح').toEqual([])
  })
})
