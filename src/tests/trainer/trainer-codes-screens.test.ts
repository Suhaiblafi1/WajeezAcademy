/* كودُ المدرّب في الشاشات — ما يقوله للمدرّب وللمشتري وللماليّة (٤ب).

   القواعدُ محضةٌ في `trainer-code.test.ts`، والنصُّ في `trainer-code-terms.test.ts`،
   والمالُ في `server/tests/commerce/trainer-code-ledger.test.ts`. وهنا ما تقوله
   الشاشاتُ منها — على البنية لا على ورود عبارة، والتعليقُ يُنزع قبل القياس:

   ① «دعوتي»: لا يُصدَر كودٌ قبل قبول البند، والبندُ المعروضُ نصُّ الخادم لا نسخةٌ
      مكتوبةٌ في الشاشة، والقبولُ لا يُنقر بلا إقرار.
   ② لوحُ الدفع: خطأُ الكود لا يمحو السعر — يُقال تحت خانته ويُسعَّر بلا كود،
      وأسبابُ الردّ هي التي يرمي بها الخادمُ فعلا.
   ③ صفحةُ الدورة: الكودُ الذي لا تعرفه يُحمل إلى اللوح — لا «لم نتعرّف عليه».
   ④ «مستحقّاتي» تقول ما يُعاد إليه، والماليّةُ ترى كودَ المدرّب باسمه. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const code = (p: string) => read(p).replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const REFERRAL = code('src/pages/trainer/Referral.tsx')
const MY_CODES = REFERRAL.slice(REFERRAL.indexOf('function MyCodes'), REFERRAL.indexOf('function LegacyDiscounts'))

describe('① «دعوتي»: القبولُ أوّلا، وبنصّ الخادم', () => {
  it('⚠️ اللوحتان في الصفحة — الأكوادُ، والخصومُ القديمةُ بعدها', () => {
    expect(REFERRAL).toMatch(/<MyCodes \/>\s*<LegacyDiscounts \/>/)
  })

  it('⚠️ لا زرَّ إصدارٍ قبل القبول', () => {
    const gate = MY_CODES.indexOf('!terms.accepted ? (')
    const issue = MY_CODES.indexOf('أصدِرْ كودا')
    expect(gate, 'لا شرطَ قبولٍ يسبق الإصدار').toBeGreaterThan(-1)
    expect(issue, 'زرُّ الإصدار غائب').toBeGreaterThan(gate)
  })

  it('⚠️ والبندُ المعروضُ نصُّ الخادم — لا نسخةٌ في الشاشة تفترق عمّا يُطبع', () => {
    expect(MY_CODES).toContain('{terms.clauseAr}')
    expect(REFERRAL, 'نُسخ نصُّ البند في الشاشة').not.toContain('4-10 ويتحمل')
  })

  it('⚠️ والقبولُ لا يُنقر بلا إقرارٍ صريح', () => {
    expect(MY_CODES).toMatch(/disabled=\{!agree\}[\s\S]{0,200}"\/api\/trainer\/me\/codes\/terms\/accept"/)
  })

  it('⚠️ ورصيدُ أكواده يُقال له — رقمُ الخادم لا حسابٌ في الشاشة', () => {
    /* المشتري يرى «بلغ حدَّه الآن» بلا سبب؛ فالسببُ يُقال لصاحبه هنا */
    expect(MY_CODES).toMatch(/const \{ terms, codes, budget \} = state/)
    expect(MY_CODES, 'الرصيدُ غائبٌ عن اللوحة').toMatch(/\{terms\.accepted && \([\s\S]{0,300}\{budget\.remaining\} \{budget\.currency\}/)
  })
})

describe('② لوحُ الدفع: خطأُ الكود لا يمحو السعر', () => {
  const PANEL = code('src/components/BuyPanel.tsx')

  it('⚠️ يُقال السببُ تحت الخانة ويُعاد التسعيرُ بلا كود — قبل أن يُمحى السعر', () => {
    const branch = PANEL.indexOf('COUPON_ERRORS.has(e.code)')
    expect(branch, 'لا فرعَ لخطأ الكود').toBeGreaterThan(-1)
    const body = PANEL.slice(branch, PANEL.indexOf('setQuote(null)', branch))
    expect(body, 'فرعُ الكود لا يقول السبب').toContain('setCouponError(e.message)')
    expect(body, 'فرعُ الكود لا يُعيد التسعيرَ بلا كود').toContain('setApplied("")')
    expect(body, 'فرعُ الكود يسقط إلى محو السعر').toContain('return;')
  })

  it('⚠️ وأسبابُ الردّ هي التي يرمي بها الخادمُ فعلا', () => {
    const set = /COUPON_ERRORS[^=]*=\s*new Set\(\[([^\]]*)\]\)/.exec(PANEL)
    expect(set, 'قائمةُ أسباب الكود غائبة').toBeTruthy()
    const codes = [...set![1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1])
    const server = [
      code('server/services/commerce/cart-types.ts'),
      code('server/services/commerce/cart.service.ts'),
      code('server/services/commerce/coupon-ledger.ts'),
    ].join('\n')
    for (const c of codes) {
      expect(server, `«${c}» في اللوح ولا يرمي به الخادم`).toContain(`AuthError('${c}'`)
    }
    /* و«بلغ حدَّه الآن» منها: رصيدُ صاحب الكود لا يسعه (٢٨ سبتمبر ٢٠٢٦) — فيُسعَّر بلا كودٍ لا يُمحى السعر */
    expect(codes).toEqual(expect.arrayContaining(['bad_coupon', 'code_used', 'code_not_applicable', 'code_unavailable']))
  })
})

describe('③ صفحةُ الدورة تحمل الكودَ ولا تُسقطه', () => {
  const PAGE = code('src/pages/CoursePath.tsx')

  it('⚠️ ما لا تعرفه يُحمل إلى اللوح — ولا يُقال «لم نتعرّف عليه»', () => {
    expect(PAGE).toContain('initialCoupon={promoApplied ?? pendingCode ?? ""}')
    expect(PAGE).toContain('setPendingCode(code)')
    expect(PAGE, 'عاد ردُّ الكود المجهول').not.toContain('لم نتعرّف على هذا الكود')
  })
})

describe('④ «مستحقّاتي» والماليّة', () => {
  it('⚠️ ما يُعاد إليه يُقال قبل أن يقع', () => {
    expect(code('src/pages/trainer/Earnings.tsx')).toMatch(/\(awaitingDiscounts\?\.credits \?\? \[\]\)\.map/)
  })

  it('⚠️ وكودُ المدرّب يُسمّى في قائمة الكوبونات — لا يُقرأ حملةً منّا', () => {
    const finance = code('src/pages/admin/Finance.tsx')
    expect(finance).toMatch(/\{c\.trainerCode && <Chip/)
    expect(code('server/services/commerce.service.ts')).toMatch(/trainerCode: \{ select: \{ percentOff: true, status: true \} \}/)
  })
})
