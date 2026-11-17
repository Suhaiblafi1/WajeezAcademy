/* رقمُ واتساب في نماذج المنح دوليٌّ ولازم (١٧ نوفمبر ٢٠٢٦، قرارُ صاحب المنصّة: «هناك من يكتب رقمه بدون مفتاح الدولة..
   اجعل رقم الواتس اب اجباري ويختار الدولة لكافة المنح سواء العادية او الشركاء»). */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { intlPhone, normalizeIntlPhone } from '@/application/advisor/guest-contact'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('رقم واتساب الدولي', () => {
  it('⚠️ يركب رمز الدولة والرقم المحلي — وصفر البداية يسقط', () => {
    expect(intlPhone('+962', '0791234567')).toBe('+962791234567')
    expect(intlPhone('+962', '79 123 4567')).toBe('+962791234567')
    expect(intlPhone('+966', '٠٥٥١٢٣٤٥٦٧')).toBe('+966551234567')
    expect(intlPhone('+962', '')).toBeNull()
    expect(intlPhone('', '0791234567')).toBeNull()
  })

  it('⚠️ والخادم لا يقبل رقما بلا رمز دولة', () => {
    expect(normalizeIntlPhone('0791234567'), 'قبل رقما محليا').toBeNull()
    expect(normalizeIntlPhone('+962791234567')).toBe('+962791234567')
    expect(normalizeIntlPhone('00962791234567')).toBe('+962791234567')
    expect(normalizeIntlPhone(null)).toBeNull()
  })

  it('⚠️ وكل نموذج منحة يختار الدولة — العادية والشركاء', () => {
    for (const page of ['src/pages/MemberGrantPage.tsx', 'src/pages/PartnerGrantPage.tsx']) {
      const src = read(page)
      expect(src, `${page} بلا اختيار الدولة`).toMatch(/<PhoneCodePicker /)
      expect(src, `${page} يرسل الرقم بلا رمز الدولة`).toMatch(/intlPhone\(dial, form\.phone\)/)
    }
    expect(read('src/pages/PartnerGrantPage.tsx'), 'واتساب اختياري في نموذج الشريك').not.toMatch(/رقم واتساب <span[^>]*>\(اختياري\)/)
  })
})
