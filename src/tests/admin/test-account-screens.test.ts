/* حسابُ التجربة — الحكمُ والشاشتان (١٧ أكتوبر ٢٠٢٦).

   «اخفي هذه القائمة اذا كان الطلب من حساب تجريبي» (صاحب المنصّة). والخادمُ في
   `server/tests/admin/test-account.test.ts`؛ وهنا:

   ① الحكمُ نفسُه بلا قاعدة: من يعمل في المنصّة وحساباتُ البذر تجريبيّةٌ من نفسها، والمتعلّمُ بالمفتاح وحدَه.
   ② ومفتاحُ «حساب تجريبي» في بطاقة الحساب — لمن يدير الحسابات، ولا يُعرض لمن يُعرف من نفسه.
   ③ و«من ينتظر دورة بلا شعبة» لا تُعرض حين لا ينتظر أحدٌ حقيقيّ.
   ④ ومن في خططهم بأسمائهم، وبجانب كلٍّ «حساب تجريبي» لمن يدير الحسابات — ثمّ تُقرأ القائمةُ ثانية (١٨ أكتوبر ٢٠٢٦).

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

describe('④ «من في خططهم؟» في القائمة نفسِها', () => {
  const panel = code('src/pages/admin/CourseDemand.tsx')

  it('⚠️ يقرأ الأسماء من الخادم ويعرضها مرّةً لكلّ متعلّم', () => {
    expect(panel).toMatch(/\.then\(\(r\) => \{ setRows\(r\.rows\); setLearners\(r\.learners \?\? \[\]\); \}\)/)
    expect(panel).toMatch(/\{learners\.length > 0 && \(\s*<details[^>]*>\s*<summary[^>]*>من في خططهم؟ \(\{learners\.length\}\)<\/summary>/)
    expect(panel).toMatch(/\{learners\.map\(\(l\) => \(/)
  })

  it('⚠️ والزرُّ لمن يدير الحسابات — يعلّمه ثمّ يعيد قراءة القائمة', () => {
    expect(panel).toMatch(/const canMark = viewer\?\.permissions\.includes\("admin\.users\.manage"\) \?\? false;/)
    expect(panel).toMatch(/\{canMark && \(\s*<Button[^>]*onClick=\{\(\) => void markTest\(l\)\}>\s*حساب تجريبي\s*<\/Button>/)
    const mark = panel.slice(panel.indexOf('const markTest = async'), panel.indexOf('if (error ||'))
    expect(mark).toMatch(/await apiPost\(`\/api\/admin\/users\/\$\{l\.id\}\/test-account`, \{ value: true \}\);/)
    expect(mark.indexOf('await load();'), 'لا تعاد القائمة بعد التعليم').toBeGreaterThan(mark.indexOf('/test-account'))
  })

  it('⚠️ ويقول ما يقع وكيف يرجع — بلا تشكيل إعرابيّ', () => {
    const block = panel.slice(panel.indexOf('{learners.length > 0 && ('), panel.indexOf('{!rows ? ('))
    expect(block).toMatch(/«حساب تجريبي» يخرج طلبه من هذا العد، ولا يغير دخوله ولا ما يملك\. وترجعه من «المستخدمون والأدوار»\./)
    expect(block).not.toMatch(/[ً-ِْ]/)
  })
})
