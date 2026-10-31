/* «فواتيري وطلباتي»: الملغى يُطوى ولا يُمحى (٣١ أكتوبر ٢٠٢٦).

   قال صاحبُ المنصّة: «الغِ الفواتيرَ الملغاة أو أخفِها للترتيب». فتُطوى خلف زرٍّ بعددها ولا تُحذف — الفاتورةُ
   قيدٌ ماليٌّ برقمٍ متسلسل (`src/application/student/billing-view.ts`).

   ① القائمُ والملغى يفترقان، وكلٌّ بترتيبه.
   ② والشاشةُ ترسم القائمَ وحدَه، والملغى مطويٌّ عند الفتح ولا يُرسم إلّا إذا فُتح، والزرُّ يقول عددَه.
   ③ ونصوصُها بلا تشكيل. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isCancelledOrder, splitOrders } from '@/application/student/billing-view'
import { markedTexts } from '../helpers/marked-text'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
/* الشيفرةُ بلا تعليقاتها — فلا يُطابَق نصٌّ في شرح */
const code = (p: string) => read(p).replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
const PAGE = code('src/pages/student/Billing.tsx')

describe('① القائم والملغى', () => {
  it('⚠️ الملغى وحده يطوى — والمسترد والمدفوع وما ينتظر الدفع قائمة، وكل بترتيبه', () => {
    const rows = [
      { id: 'a', status: 'cancelled' }, { id: 'b', status: 'paid' }, { id: 'c', status: 'pending_payment' },
      { id: 'd', status: 'cancelled' }, { id: 'e', status: 'refunded' }, { id: 'f', status: 'partially_refunded' },
    ]
    const { live, cancelled } = splitOrders(rows)
    expect(live.map((o) => o.id)).toEqual(['b', 'c', 'e', 'f'])
    expect(cancelled.map((o) => o.id)).toEqual(['a', 'd'])
    expect(isCancelledOrder('pending_payment')).toBe(false)
  })
})

describe('② الشاشة', () => {
  it('⚠️ ترسم القائم وحده — والملغى مطوي عند الفتح ولا يرسم إلا إذا فتح', () => {
    expect(PAGE).toMatch(/const \[showCancelled, setShowCancelled\] = useState\(false\);/)
    expect(PAGE).toMatch(/const \{ live, cancelled \} = splitOrders\(rows\);/)
    expect(PAGE).toMatch(/\{live\.map\(orderCard\)\}/)
    expect(PAGE).toMatch(/\{showCancelled && cancelled\.map\(orderCard\)\}/)
    expect(PAGE, 'رسمت الطلبات كلها').not.toMatch(/rows\.map\(/)
  })

  it('⚠️ والزر يقول عدد الملغاة — ويفتحها ويطويها', () => {
    expect(PAGE).toMatch(/`الطلبات الملغاة \(\$\{cancelled\.length\}\)`/)
    expect(PAGE).toMatch(/aria-expanded=\{showCancelled\} onClick=\{\(\) => setShowCancelled\(!showCancelled\)\}/)
  })
})

describe('③ بلا تشكيل', () => {
  for (const f of ['src/pages/student/Billing.tsx', 'src/application/student/billing-view.ts']) {
    it(f, () => expect(markedTexts(f, read(f))).toEqual([]))
  }
})
