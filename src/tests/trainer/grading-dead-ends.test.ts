/* ═══ لا نهايةَ صمّاء في التقييم (٢٠ أكتوبر ٢٠٢٦) ═══

   ① المرفوضُ كان يخرج من كلّ شاشة، والمتعلّمُ يُقال له إنّ مدرّبه يفتح بابَ الإعادة — فصار تحت الطابور قسمٌ مطويٌّ
      بآخر تسليمٍ مرفوضٍ لكلّ متعلّم، ومعه «اطلب إعادة التسليم» بسببٍ يصله (`trainerRejected`).
   ② و«سلّم N من M» يعدّ المتعلّمين لا صفوفَ التسليم — كلُّ إعادةٍ صفٌّ، فكان يُقرأ «سلّم 13 من 10».

   والفحصُ على الشيفرة بلا تعليقاتها. ورُئي ساقطا: أُسقط نداءُ المرفوضة فسقط ①، وأُعيد `a.submissions.length` فسقط ②. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('لا نهاية صمّاء في التقييم', () => {
  it('⚠️ ① المرفوض يعرض تحت الطابور ويعاد فتحه بسبب', () => {
    const page = code('src/pages/trainer/GradingQueue.tsx')
    expect(page).toContain('apiGet<RejectedItem[]>("/api/trainer/grading-queue/rejected")')
    const section = page.slice(page.indexOf('{rejected.length > 0 && ('))
    expect(section).toMatch(/<summary[^>]*>مرفوضة لم يعد أصحابها \(\{rejected\.length\}\)<\/summary>/)
    expect(section).toMatch(/disabled=\{busy \|\| !\(reviewNote\[r\.id\] \?\? ""\)\.trim\(\)\} onClick=\{\(\) => void reviewAction\(r\.id, "request_resubmit"\)\}/)
  })

  it('⚠️ ② وسلّم يعدّ المتعلّمين لا صفوف التسليم', () => {
    const page = code('src/pages/trainer/CohortAssignments.tsx')
    expect(page).toMatch(/سلّم \{new Set\(a\.submissions\.map\(\(s\) => s\.enrollmentId\)\)\.size\} من \{learners\}/)
    expect(page).not.toContain('سلّم {a.submissions.length}')
  })
})
