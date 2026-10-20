/* بابُ الاسترداد في «فواتيري» (٢٠ أكتوبر ٢٠٢٦، الخطوة ك).

   كان الطلبُ المدفوعُ بلا بابٍ للاسترداد، وصفحةُ الدعم لا تعرف أيَّ دفعةٍ يقصد. فلكلّ مدفوعٍ زرٌّ
   يفتح تذكرةً برقم فاتورته، ومن له طلبٌ مفتوحٌ يُقال له ذلك ولا يُعرض عليه زرٌّ ثانٍ
   (`src/application/student/refund-request.ts`). والفحصُ على السلوك حيث تُنادى الدالّة، وعلى البنية
   بمحلّل TypeScript حيث تُركَّب. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { openRefundTicket, refundable, refundInvoiceOf, refundRequestHref, refundTicketDraft } from '@/application/student/refund-request'

function callees(p: string): string[] {
  const sf = ts.createSourceFile(p, readFileSync(join(process.cwd(), p), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const out: string[] = []
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n)) out.push(n.expression.getText(sf))
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return out
}

describe('رقمُ الفاتورة من الرابط', () => {
  it('⚠️ يُقبل بشكله — ويُردّ ما سواه فلا يُكتب في الموضوع', () => {
    expect(refundInvoiceOf('WJ-INV-2026-90001')).toBe('WJ-INV-2026-90001')
    for (const bad of ['', null, '<b>x</b>', 'رقم', 'a b c', '-x1', 'X'.repeat(41)]) {
      expect(refundInvoiceOf(bad), String(bad)).toBeNull()
    }
  })

  it('⚠️ والبابُ تذكرةٌ مصنّفةٌ برقمها في موضوعها — والسببُ يكتبه هو', () => {
    expect(refundRequestHref('WJ-INV-2026-90001')).toBe('/student/support?topic=refund&invoice=WJ-INV-2026-90001')
    expect(refundTicketDraft('WJ-INV-2026-90001')).toEqual({ subject: 'طلب استرداد — WJ-INV-2026-90001', category: 'billing', body: '' })
  })
})

describe('من يُعرض عليه الزرّ', () => {
  it('⚠️ المدفوعُ وما رُدّ بعضُه — لا ما لم يُدفع ولا ما رُدّ كلُّه', () => {
    expect(refundable('paid')).toBe(true)
    expect(refundable('partially_refunded')).toBe(true)
    for (const s of ['pending_payment', 'cancelled', 'refunded']) expect(refundable(s), s).toBe(false)
  })

  it('⚠️ ومن له طلبٌ مفتوحٌ لهذه الفاتورة يُقال له — والمحلولُ لا يحجب طلبا جديدا', () => {
    const n = 'WJ-INV-2026-90001'
    expect(openRefundTicket(n, [{ subject: `طلب استرداد — ${n}`, status: 'open' }])).not.toBeNull()
    expect(openRefundTicket(n, [{ subject: `طلب استرداد — ${n}`, status: 'reopened' }])).not.toBeNull()
    expect(openRefundTicket(n, [{ subject: `طلب استرداد — ${n}`, status: 'resolved' }])).toBeNull()
    expect(openRefundTicket(n, [{ subject: 'طلب استرداد — WJ-INV-2026-90002', status: 'open' }])).toBeNull()
  })
})

describe('وهو مركّبٌ حيث يُرى', () => {
  it('⚠️ «فواتيري» تعرض الزرّ برقم الفاتورة، وتقرأ التذاكر', () => {
    const billing = callees('src/pages/student/Billing.tsx')
    expect(billing).toContain('refundable')
    expect(billing).toContain('refundRequestHref')
    expect(billing).toContain('openRefundTicket')
  })

  it('⚠️ والدعمُ يكتب الرقمَ في الموضوع — بعد أن يقبل شكلَه', () => {
    expect(callees('src/pages/student/Support.tsx')).toContain('refundInvoiceOf')
  })
})
