/* طلبُ الشهادة يُرى لمن استوفى قواعد إكمالها — لا عند ١٠٠٪ وحدَها (٢٠ أكتوبر ٢٠٢٦).

   كان المربّعُ في «رحلتي» يظهر عند ١٠٠٪ أو بعد صدور الشهادة. والنسبةُ تزن المحاورَ والحضورَ كاملا
   والمهامَّ معا، وقاعدةُ الإكمال الافتراضيّة تكليفٌ واحدٌ مقبول (`completion-rules.ts`) — فمن استوفاها
   عند ٤٣٪ لم يرَ بابَ شهادته. فصار يُعرض قبل آخر الدورة لمن قال الخادمُ إنّه مستوفٍ، ولا شيءَ لسواه.

   والفحصُ على البنية بمحلّل TypeScript: العنصرُ مركّبٌ بـ`onlyIfEligible` خارجَ شرط آخر الدورة،
   والمكوّنُ يعود بلا شيءٍ لغير المستوفي. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const parse = (p: string) =>
  ts.createSourceFile(p, readFileSync(join(process.cwd(), p), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

function walk(n: ts.Node, visit: (n: ts.Node) => void) {
  visit(n)
  ts.forEachChild(n, (c) => walk(c, visit))
}

describe('طلبُ الشهادة قبل ١٠٠٪', () => {
  it('⚠️ «رحلتي» تركّبه لمن لم يبلغ آخرَ الدورة — مقصورا على المستوفي', () => {
    const sf = parse('src/components/journey/StageWork.tsx')
    const uses: { onlyIfEligible: boolean }[] = []
    walk(sf, (n) => {
      if (ts.isJsxSelfClosingElement(n) && n.tagName.getText(sf) === 'CourseCertificate') {
        uses.push({ onlyIfEligible: n.attributes.properties.some((p) => ts.isJsxAttribute(p) && p.name.getText(sf) === 'onlyIfEligible') })
      }
    })
    expect(uses.length, 'مربّعان: لآخر الدورة، وللمستوفي قبله').toBe(2)
    expect(uses.filter((u) => u.onlyIfEligible), 'لا مربّعَ للمستوفي قبل ١٠٠٪').toHaveLength(1)
  })

  it('⚠️ والمكوّنُ يعود بلا شيءٍ لغير المستوفي حين يُطلب منه ذلك', () => {
    const sf = parse('src/components/journey/CourseCertificate.tsx')
    const guards: string[] = []
    walk(sf, (n) => {
      if (ts.isIfStatement(n) && /onlyIfEligible/.test(n.expression.getText(sf))) {
        const ret = ts.isReturnStatement(n.thenStatement) ? n.thenStatement : null
        if (ret && ret.expression?.kind === ts.SyntaxKind.NullKeyword) guards.push(n.expression.getText(sf))
      }
    })
    expect(guards).toEqual(['onlyIfEligible && !eligibility?.eligible'])
  })
})
