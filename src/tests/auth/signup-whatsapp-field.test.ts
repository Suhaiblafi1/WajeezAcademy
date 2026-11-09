/* رقمُ واتساب في نموذج التسجيل — اختياريّ (٩ نوفمبر ٢٠٢٦، قرارُ صاحب المنصّة «Optional»).

   الحقلُ في «حساب جديد» وحدَه لا في «دخول»، ولا يُطلب (`required`)، ورقمٌ خاطئٌ يوقف الإرسالَ بسببه، ويصل الخادمَ مع
   التسجيل. والخادمُ يحفظه ويردّ الخاطئ (`server/tests/auth/signup-whatsapp.test.ts`). والفحصُ على الشيفرة بلا تعليقاتها. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const GATE = code('src/components/AuthGate.tsx')
const AUTH = code('src/services/auth.ts')

describe('نموذج التسجيل · رقم واتساب', () => {
  it('⚠️ الحقل في «حساب جديد» وحده، ولا يطلب', () => {
    const at = GATE.indexOf('id="auth-phone"')
    expect(at, 'غاب حقل واتساب').toBeGreaterThan(0)
    const block = GATE.slice(GATE.lastIndexOf('{mode === "signup" && (', at), GATE.indexOf('/>', at))
    expect(block, 'الحقل خارج «حساب جديد»').toMatch(/^\{mode === "signup" && \(/)
    expect(block).toMatch(/رقم واتساب \(اختياري\)/)
    expect(block, 'صار الحقل مطلوبا').not.toMatch(/\brequired\b/)
  })

  it('⚠️ رقم خاطئ يوقف الإرسال — والفارغ لا', () => {
    expect(GATE).toMatch(/const phoneValid = mode === "login" \|\| phone\.trim\(\) === "" \|\| normalizePhone\(phone\) !== null;/)
    expect(GATE).toMatch(/const formValid = [^;]*\bphoneValid\b[^;]*;/)
  })

  it('⚠️ والرقم يصل الخادم مع التسجيل', () => {
    expect(GATE).toMatch(/signUp\(name, email, pass, hp\.value, phone\)/)
    expect(AUTH).toMatch(/\.\.\.\(phone\?\.trim\(\) \? \{ phone: phone\.trim\(\) \} : \{\}\)/)
  })
})
