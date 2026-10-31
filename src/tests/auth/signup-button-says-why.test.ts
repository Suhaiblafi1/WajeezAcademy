/* نافذةُ إنشاء الحساب في لحظة الشراء: الزرُّ يقول ما ينقص، والشروطُ لا تُضيع ما كُتب (٣١ أكتوبر ٢٠٢٦).

   ١) كان زرُّ «أنشئ حسابي» مطفأً ما لم يكتمل النموذج — فمن لم يعلّم الموافقةَ رأى زرّا باهتا بلا سبب، ورسائلُ `submit`
      لا تُبلَغ أبدا. فيُطفأ في الإرسال وحدَه.
   ٢) ورابطا الشروط والخصوصية كانا يفتحان مكانَ النافذة، فيضيع الاسمُ والبريدُ وكلمةُ المرور والشراءُ الذي جاء منه.
   ٣) وبوّابةُ صفحة المسار تبدأ بـ«حساب جديد» كصفحة الدورة وصفحة المنحة.

   والفحصُ على الشيفرة بلا تعليقاتها. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const GATE = code('src/components/AuthGate.tsx')

describe('نافذة الحساب · الزر يقول ما ينقص', () => {
  it('⚠️ زر الإرسال يطفأ في الإرسال وحده — لا لنموذج ناقص', () => {
    const label = GATE.indexOf('"أنشئ حسابي وابدأ"')
    const submit = GATE.slice(GATE.lastIndexOf('type="submit"', label), label)
    expect(submit).toMatch(/disabled=\{busy\}/)
    expect(submit, 'عاد الزر الباهت بلا سبب').not.toMatch(/formValid/)
    expect(GATE, 'رسائل ما ينقص لا تبلغ').toMatch(/if \(!formValid\) \{\s*setErr\(/)
  })

  it('⚠️ الشروط والخصوصية في لسان جديد — لا يضيع ما كتب', () => {
    for (const page of ['terms', 'privacy']) {
      expect(GATE).toMatch(new RegExp(`<Link to="/p/${page}" target="_blank" rel="noopener noreferrer"`))
    }
  })

  it('⚠️ بوابة صفحة المسار تبدأ بحساب جديد', () => {
    const pathway = code('src/pages/Pathway.tsx')
    const gate = pathway.slice(pathway.indexOf('<AuthGate'), pathway.indexOf('<AuthGate') + 300)
    expect(gate).toMatch(/initialMode="signup"/)
  })
})
