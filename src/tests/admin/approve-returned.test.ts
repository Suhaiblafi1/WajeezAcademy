/* «اعتمدها» على الخطّة المردودة إلى مدرّبها — بما حفظه فيها الآن (١٧ أكتوبر ٢٠٢٦).

   «اريد ان اعتمد التعديلات واعتمد الدوره نفسها.. ولكن اريد ان تبقى تعديلاتي ظاهره امامه ليقوم هو بقبولها او رفضها»
   (صاحب المنصّة) — واختار «Yes, for returned plans». والخادمُ في `server/tests/plan/approve-returned.test.ts`؛
   وهنا الشاشتان:

   ① البطاقةُ تعتمد المردودةَ كالمنتظِرة — والردُّ والتأجيلُ وتقريرُ المراجعة للمنتظِرة وحدَها، والمؤجَّلةُ لا تُعتمد.
   ② ويُقال قبل النقر ما يُعتمد: ما حفظه، بلا انتظار إرسالها.
   ③ و«خطط تنتظر اعتمادك» تعرض المردودةَ في قائمتها، ببطاقتها نفسِها.

   والفحصُ على الشيفرة بلا تعليقاتها: حارسٌ طابق جملةً في تعليقٍ مرّ أخضرَ لسببٍ خاطئ. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('بطاقة الخطّة', () => {
  const card = code('src/components/admin/TrainerPlanReview.tsx')

  it('⚠️ ① المردودة تعتمد كالمنتظرة — والمؤجّلة لا', () => {
    expect(card).toMatch(/const returnedNow = trainerPlan\?\.status === "changes_requested" && !trainerPlan\.postponedTo;/)
    expect(card).toMatch(/const approvable = canApprovePlan && \(trainerPlan\?\.status === "submitted" \|\| returnedNow\);/)
    expect(card).toMatch(/\{approvable && trainerPlan && \(\s*<>\s*<Button tone="confirm"[\s\S]{0,300}\/decide`, approvalBody\(approveNote\)\)/)
  })

  it('⚠️ والردّ والتأجيل للمنتظرة وحدها', () => {
    expect(card).toMatch(/\{trainerPlan\.status === "submitted" && \(\s*<Button tone="danger"[\s\S]{0,200}\/decide`, \{ approve: false \}\)/)
    expect(card).toMatch(/\{trainerPlan\.status === "submitted" && !trainerPlan\.approvedOnce && \(\s*<Button[^>]*aria-expanded=\{postponing\}/)
  })

  it('⚠️ ② ويقال قبل النقر ما يعتمد — ما حفظه، بلا انتظار إرسالها', () => {
    expect(card).toMatch(/\{returnedNow && canApprovePlan && \(\s*<p[^>]*>\s*الخطة عند المدرب الآن، رددتها إليه بتعديلات\. «اعتمدها» يعتمد ما حفظه فيها حتى الآن ولا ينتظر أن يرسلها/)
  })
})

describe('③ خطط تنتظر اعتمادك', () => {
  const page = code('src/pages/admin/PendingPlans.tsx')

  it('⚠️ تجلب المردودة وتعرضها ببطاقتها نفسها', () => {
    expect(page).toMatch(/apiGet<PendingPlan\[\]>\("\/api\/admin\/cohort-plans\/returned"\)\s*\.then\(\(r\) => \{ if \(alive\) setReturned\(r\); \}\)/)
    expect(page).toMatch(/\{returnedScoped\.length > 0 && \(\s*<section aria-label="خطط رددتها إلى مدربيها"/)
    const at = page.indexOf('aria-label="خطط رددتها إلى مدربيها"')
    expect(page.slice(at, at + 4000)).toMatch(/<TrainerPlanReview\s+cohortId=\{r\.cohort\.id\}/)
  })

  it('ونصوصها بلا تشكيل إعرابيّ — اللغة البيضاء', () => {
    const at = page.indexOf('aria-label="خطط رددتها إلى مدربيها"')
    const block = page.slice(at, at + 1200)
    expect(block).not.toMatch(/[ً-ِْ]/)
  })
})
