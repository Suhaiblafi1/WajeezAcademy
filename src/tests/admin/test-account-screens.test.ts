/* حسابُ التجربة — الحكمُ والشاشتان (١٧ أكتوبر ٢٠٢٦).

   «اخفي هذه القائمة اذا كان الطلب من حساب تجريبي» (صاحب المنصّة). والخادمُ في
   `server/tests/admin/test-account.test.ts`؛ وهنا:

   ① الحكمُ نفسُه بلا قاعدة: من يعمل في المنصّة وحساباتُ البذر تجريبيّةٌ من نفسها، والمتعلّمُ بالمفتاح وحدَه.
   ② ومفتاحُ «حساب تجريبي» في بطاقة الحساب — لمن يدير الحسابات، ولا يُعرض لمن يُعرف من نفسه.
   ③ و«من ينتظر دورة بلا شعبة» لا تُعرض حين لا ينتظر أحدٌ حقيقيّ.

   والفحصُ على الشيفرة بلا تعليقاتها. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isTestAccount, testByItself } from '@/application/admin/test-account'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('① الحكم', () => {
  it('⚠️ من يعمل في المنصّة تجريبيٌّ من نفسه — والمتعلّمُ لا', () => {
    for (const r of ['super_admin', 'academic_manager', 'operations_manager', 'support', 'trainer', 'advisor']) {
      expect(testByItself({ email: 'a@example.com', roleIds: ['learner', r] }), r).toBe(true)
    }
    expect(testByItself({ email: 'a@example.com', roleIds: ['learner'] })).toBe(false)
    expect(testByItself({ email: 'a@example.com', roleIds: [] })).toBe(false)
  })

  it('⚠️ وحساباتُ البذر بنطاقها — أيًّا كانت حروفُه', () => {
    expect(testByItself({ email: ' Student.Demo@WAJEEZ.local ', roleIds: ['learner'] })).toBe(true)
    expect(testByItself({ email: 'x@wajeez.com', roleIds: ['learner'] })).toBe(false)
  })

  it('⚠️ والمفتاحُ يجعل المتعلّمَ تجريبيّا', () => {
    expect(isTestAccount({ email: 'a@example.com', roleIds: ['learner'], isTestAccount: true })).toBe(true)
    expect(isTestAccount({ email: 'a@example.com', roleIds: ['learner'], isTestAccount: false })).toBe(false)
  })
})

describe('② مفتاحُ «حساب تجريبي» في بطاقة الحساب', () => {
  const page = code('src/pages/admin/Users.tsx')

  it('⚠️ لمن يدير الحسابات، ولا يُعرض لمن يُعرف تجريبيّا من نفسه', () => {
    expect(page).toMatch(/\{canManage && !testByItself\(\{ email: u\.email, roleIds: u\.roles\.map\(\(r\) => r\.id\) \}\) && \(\s*<Button[^>]*aria-pressed=\{u\.isTestAccount\}/)
  })

  it('⚠️ يقلب المفتاحَ في الخادم — ويقول ما يقع', () => {
    expect(page).toMatch(/apiPost\(`\/api\/admin\/users\/\$\{u\.id\}\/test-account`, \{ value: !u\.isTestAccount \}\)/)
    expect(page).toMatch(/\{u\.isTestAccount \? "ليس تجريبيا" : "حساب تجريبي"\}/)
    expect(page).toMatch(/\{u\.isTestAccount && \(\s*<span[^>]*>حساب تجريبي<\/span>/)
  })

  it('⚠️ وما يقوله بلا تشكيل إعرابيّ', () => {
    const at = page.indexOf('/test-account`')
    const block = page.slice(at - 600, at + 700)
    expect(block).toMatch(/لا يعد طلبه في «من ينتظر دورة بلا شعبة»/)
    expect(block).not.toMatch(/[ً-ِْ]/)
  })
})

describe('③ «من ينتظر دورة بلا شعبة»', () => {
  const panel = code('src/pages/admin/CourseDemand.tsx')

  it('⚠️ لا تُعرض حين لا ينتظر أحدٌ حقيقيّ — ولا لوحةَ تقول «لا أحد»', () => {
    expect(panel).toMatch(/if \(error \|\| rows\?\.length === 0\) return null;/)
    expect(panel).not.toMatch(/لا أحد ينتظر/)
  })

  it('وتقول إنّ التجريبيّة لا تُعدّ', () => {
    expect(panel).toMatch(/دون الحسابات التجريبية/)
  })
})
