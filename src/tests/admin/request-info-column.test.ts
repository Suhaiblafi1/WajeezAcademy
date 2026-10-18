/* «اطلب معلومات إضافية» من عمود القرار يفتح خانتَه — لا يُرسل بلا نصّ (١٨ أكتوبر ٢٠٢٦).

   كان زرُّه في عمود القرار يُرسل `request_info` بـ`note` لا تصله خانةٌ أصلا — فيصل المتقدّمَ اسمُ حالةٍ لا طلب، والعطبُ
   الذي كُتبت لأجله الخانةُ في الشريط. فيفتح العمودُ الخانةَ نفسَها ويضع المؤشّر فيها، والخادمُ يردّ ما دون عشرة أحرف
   (`server/tests/trainer/info-request-return.test.ts`).

   والفحصُ على الشيفرة بلا تعليقاتها. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const page = readFileSync(join(process.cwd(), 'src/pages/admin/TrainerApplications.tsx'), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('عمودُ القرار و«اطلب معلومات إضافية»', () => {
  it('⚠️ يفتح خانةَ الطلب ولا يُرسل القرار', () => {
    const click = page.slice(page.indexOf('const decisionClick = '), page.indexOf('const decisionButton = '))
    expect(click).toMatch(/^const decisionClick = \(d: Decision, decisionNote\?: string\) =>\s*d\.action === "request_info"\s*\?\s*openAsk\(\)/)
  })

  it('⚠️ والخانةُ تُفتح ويوضع فيها المؤشّر', () => {
    expect(page).toMatch(/const openAsk = \(\) => \{\s*setAskOpen\(true\);\s*setTimeout\(\(\) => document\.getElementById\("ask-note"\)\?\.focus\(\), 0\);\s*\};/)
    expect(page).toMatch(/<textarea\s+id="ask-note"/)
  })

  it('والإرسالُ منها وحدَها — بنصّه، وعشرةُ أحرفٍ على الأقلّ', () => {
    expect(page).toMatch(/disabled=\{busy \|\| askNote\.trim\(\)\.length < 10\}/)
    expect(page).toMatch(/\{ action: "request_info", note: askNote\.trim\(\) \}/)
  })
})
