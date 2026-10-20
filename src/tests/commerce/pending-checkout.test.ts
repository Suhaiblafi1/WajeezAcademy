/* شراءٌ واحدٌ لا يضيع عند التوثيق (٢٠ أكتوبر ٢٠٢٦، الخطوة ل).

   كان الزائرُ يختار دورةً وشعبتَها، فيسجّل، فيُطلب منه توثيقُ بريده — ورابطُ التوثيق ينتهي إلى «منصّتي»،
   واللوحُ في التبويب الأوّل باقٍ على «بريدك غير موثّق». فضاع ما اختاره. فصار يُحفظ على الجهاز
   (`pending-checkout.ts`) ويُعاد إليه. ويُحرس هنا:

   ① ما يُقرأ من التخزين يُفحص — صفحتا الشراء وحدَهما، وأسبوعٌ ثمّ يُنسى، فلا يصير بابا إلى غيرهما.
   ② وهو مركّبٌ حيث يُحتاج: يُحفظ عند الشراء، ويُعرض في صفحة التوثيق، ويُعاد به اللوح، ويُمحى بالطلب،
      واللوحُ يعيد التسعيرَ حين يعود صاحبُه، و«رحلتي» تقترح شعبتَه.
   والفحصُ الثاني بمحلّل TypeScript — على ما يُنادى لا على ورود اسمٍ في تعليق. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import {
  PENDING_CHECKOUT_TTL_MS, parsePendingCheckout, resumeHref, type PendingCheckout,
} from '@/application/commerce/pending-checkout'

const NOW = Date.UTC(2026, 9, 20, 12)
const good: PendingCheckout = {
  path: '/build/C-BIZ-101',
  intent: { title: 'دورة «اكتشاف العملاء»', amount: 200, kind: 'course', courseIds: ['C-BIZ-101'] },
  cohortByCourse: { 'C-BIZ-101': 'b667a3e2-0000-4000-8000-000000000001' },
  at: NOW - 3_600_000,
}
const raw = (o: unknown) => JSON.stringify(o)

describe('① ما يُقرأ من التخزين يُفحص', () => {
  it('المحفوظُ الصحيحُ يعود كما هو — ورابطُ العودة إلى صفحته', () => {
    expect(parsePendingCheckout(raw(good), NOW)).toEqual(good)
    expect(resumeHref(good)).toBe('/build/C-BIZ-101?resume=1')
  })

  it('⚠️ ولا مسارَ إلّا صفحتا الشراء — لا بابَ إلى غيرهما', () => {
    for (const path of ['/admin', '//evil.example/x', 'https://evil.example', '/build/../admin', '/pathways/a b', '/student/billing']) {
      expect(parsePendingCheckout(raw({ ...good, path }), NOW), path).toBeNull()
    }
    expect(parsePendingCheckout(raw({ ...good, path: '/pathways/P-ENT-01' }), NOW)?.path).toBe('/pathways/P-ENT-01')
  })

  it('⚠️ وأسبوعٌ ثمّ يُنسى — ولا يُقبل تاريخٌ من المستقبل', () => {
    expect(parsePendingCheckout(raw({ ...good, at: NOW - PENDING_CHECKOUT_TTL_MS - 1 }), NOW)).toBeNull()
    expect(parsePendingCheckout(raw({ ...good, at: NOW + 3_600_000 }), NOW)).toBeNull()
  })

  it('والمعرّفاتُ بشكلها، وما سواها يسقط — وبلا دورةٍ لا شيءَ يُعاد', () => {
    const p = parsePendingCheckout(raw({
      ...good,
      intent: { ...good.intent, courseIds: ['C-BIZ-101', '<x>'] },
      cohortByCourse: { 'C-BIZ-101': 'ok-1', '<x>': 'ok-2', 'C-AI-101': '"><script>' },
    }), NOW)
    expect(p?.intent.courseIds).toEqual(['C-BIZ-101'])
    expect(p?.cohortByCourse).toEqual({ 'C-BIZ-101': 'ok-1' })
    expect(parsePendingCheckout(raw({ ...good, intent: { ...good.intent, courseIds: [] } }), NOW)).toBeNull()
    expect(parsePendingCheckout(raw({ ...good, intent: { ...good.intent, kind: 'admin' } }), NOW)).toBeNull()
    expect(parsePendingCheckout('{not json', NOW)).toBeNull()
  })
})

const parse = (p: string) =>
  ts.createSourceFile(p, readFileSync(join(process.cwd(), p), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

function walk(n: ts.Node, visit: (n: ts.Node) => void) {
  visit(n)
  ts.forEachChild(n, (c) => walk(c, visit))
}

function callees(p: string): string[] {
  const sf = parse(p)
  const out: string[] = []
  walk(sf, (n) => { if (ts.isCallExpression(n)) out.push(n.expression.getText(sf)) })
  return out
}

function jsxTags(p: string): string[] {
  const sf = parse(p)
  const out: string[] = []
  walk(sf, (n) => { if (ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) out.push(n.tagName.getText(sf)) })
  return out
}

/** النداءاتُ بمُناداها ونصِّ أوّلِ معطياتها */
function calls(p: string): { callee: string; firstArg: string | null }[] {
  const sf = parse(p)
  const out: { callee: string; firstArg: string | null }[] = []
  walk(sf, (n) => {
    if (ts.isCallExpression(n)) {
      const a = n.arguments[0]
      out.push({ callee: n.expression.getText(sf), firstArg: a && ts.isStringLiteralLike(a) ? a.text : null })
    }
  })
  return out
}

/** ما يُنادى داخل دالّةٍ مسمّاة (`const name = …`) */
function calleesIn(p: string, name: string): string[] {
  const sf = parse(p)
  const out: string[] = []
  walk(sf, (n) => {
    if (ts.isVariableDeclaration(n) && n.name.getText(sf) === name && n.initializer) {
      walk(n.initializer, (m) => { if (ts.isCallExpression(m)) out.push(m.expression.getText(sf)) })
    }
  })
  return out
}

describe('② وهو مركّبٌ حيث يُحتاج', () => {
  it('⚠️ صفحتا الشراء تحفظان عند الشراء وتعيدان اللوحَ عند العودة', () => {
    for (const page of ['src/pages/CoursePath.tsx', 'src/pages/Pathway.tsx']) {
      expect(callees(page), page).toContain('savePendingCheckout')
      expect(callees(page), page).toContain('resumedCheckoutFor')
      expect(jsxTags(page), page).toContain('ResumeCheckout')
    }
  })

  it('⚠️ وصفحةُ التوثيق تعرض «أكمل شراءك» إلى صفحته', () => {
    expect(callees('src/pages/VerifyEmail.tsx')).toEqual(expect.arrayContaining(['readPendingCheckout', 'resumeHref']))
  })

  it('⚠️ واللوحُ يمحوه حين يُنشأ الطلب — ويعيد التسعيرَ حين يعود صاحبُه', () => {
    const pay = calleesIn('src/components/BuyPanel.tsx', 'pay')
    expect(pay, 'لا يُمحى بالطلب').toContain('clearPendingCheckout')
    const listens = calls('src/components/BuyPanel.tsx').filter((c) => /addEventListener$/.test(c.callee)).map((c) => c.firstArg)
    expect(listens, 'لا يعيد التسعيرَ حين يعود').toEqual(expect.arrayContaining(['focus', 'visibilitychange']))
  })

  it('و«رحلتي» تقترح الشعبةَ التي اختارها لا أقربَ شعبة', () => {
    expect(callees('src/pages/student/Journey.tsx')).toContain('readPendingCheckout')
  })
})
