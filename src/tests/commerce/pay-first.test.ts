/* الدفعُ أوّلا والتوثيقُ بعده — قرارُ صاحب المنصّة (٢٦ أكتوبر ٢٠٢٦).

   سأل: «هل من الضروري أن يقوم الشخص بتوثيق بريده؟»، وخُيّر بين إبقاء التوثيق قبل الدفع ورمزٍ في الصفحة نفسِها
   والدفعِ أوّلا، فاختار **الدفعَ أوّلا**: من ترك الصفحةَ ليفتح بريدَه قد لا يعود. والخادمُ يحرسه
   `server/tests/auth/email-verification.test.ts`، وهذا يحرس الشاشات: زرُّ الدفع لا ينتظر البريد، ولحظةُ الدفع
   بلا شاشة «تفقّد بريدك»، والشهادةُ وحدَها تُقال موقوفةً على التوثيق. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')

/** كتلُ `<AuthGate … />` في ملفّ — كلٌّ بخصائصها */
const gates = (p: string) => code(p).match(/<AuthGate\b[\s\S]*?\/>/g) ?? []
const sourceOf = (g: string) => g.match(/source="([^"]+)"/)?.[1] ?? null
const laterOf = (g: string) => /\sverifyLater(\s|\/|>)/.test(g)

describe('الدفع أولا والتوثيق بعده', () => {
  it('⚠️ زر الدفع لا ينتظر البريد — ولا بلاغ توثيق في لوح الشراء', () => {
    const buy = code('src/components/BuyPanel.tsx')
    const pay = buy.match(/<Button tone="primary" onClick=\{\(\) => void pay\(\)\}\s*disabled=\{([^}]*)\}/)?.[1]
    expect(pay, 'زر الدفع لم يوجد').toBeTruthy()
    expect(pay, 'زر الدفع ينتظر توثيق البريد').not.toMatch(/email/i)
    expect(buy, 'عاد لوح الشراء يطلب التوثيق').not.toMatch(/VerifyEmailNotice|emailVerified/)
  })

  it('⚠️ لحظة الدفع بلا شاشة «تفقد بريدك» — والمفضلة وصفحة الدخول تبقيانها', () => {
    expect(code('src/components/AuthGate.tsx')).toMatch(/if \(result\.verificationSent && !verifyLater\) \{\s*setView\("verify"\);/)
    const checkout = ['src/pages/Pathway.tsx', 'src/pages/CoursePath.tsx', 'src/pages/MemberGrantPage.tsx'].flatMap(gates)
    expect(checkout.map(sourceOf).sort()).toEqual(['checkout_gate', 'course_path_checkout', 'grant_checkout'])
    for (const g of checkout) expect(laterOf(g), `${sourceOf(g)} يوقف المشتري عند «تفقد بريدك»`).toBe(true)
    for (const g of ['src/components/FavoriteButton.tsx', 'src/pages/Auth.tsx'].flatMap(gates)) {
      expect(laterOf(g), 'خارج الدفع تبقى شاشة التوثيق').toBe(false)
    }
  })

  it('⚠️ رسائل التوثيق تقول إن الشهادة وحدها تنتظره — لا الشراء', () => {
    const mail = code('server/services/account-mail.ts')
    expect(mail.match(/التوثيق مطلوب للشهادة فقط/g), 'رسالة التوثيق وتذكيرها').toHaveLength(2)
    expect(mail, 'عادت رسالة تقول إن الشراء ينتظر التوثيق').not.toMatch(/للشراء|تفعيل الشراء/)
    expect(code('src/pages/VerifyEmail.tsx')).toContain('التوثيق شرط لاستلام الشهادة فقط.')
    expect(code('src/components/LearnersPanel.tsx')).toContain('ويلزم توثيق الجديد قبل الشهادة.')
  })
})
