/* ═══ واختبارٌ بلا أسئلةٍ يُجاب كتابةً (٢٠ أكتوبر ٢٠٢٦) — `StageWork.tsx` ═══

   المدرّبُ يختار «اختبار» ولا محرّرَ أسئلةٍ له بعد، فكانت بطاقتُه عند المتعلّم بلا نموذجٍ أبدا، وتبقى في «ما عليك»
   لأنّ `canSubmitNow` يعدّها. وقرارُ صاحب المنصّة «Treat as text» حتّى يُبنى المحرّر: يُسلَّم نصّا أو ملفّا ويقيّمه
   المدرّبُ في طابوره (`server/tests/learning/grading-queue.test.ts`). وبأسئلته يبقى نموذجَ الاختبار.

   والفحصُ على الشيفرة بلا تعليقاتها. ورُئي ساقطا: أُعيد الشرطُ `a.type !== "quiz"` وحدَه فسقط. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('اختبار بلا أسئلة', () => {
  it('⚠️ يعرض للمتعلّم نموذج النصّ — وبأسئلته نموذج الاختبار', () => {
    const work = code('src/components/journey/StageWork.tsx')
    expect(work).toMatch(/\{canSubmit && \(a\.type !== "quiz" \|\| a\.items\.length === 0\) && \(/)
    expect(work).toMatch(/\{canSubmit && a\.type === "quiz" && a\.items\.length > 0 && \(\s*<QuizAttemptForm/)
  })

  it('والمدرّب يقال له كيف يجاب', () => {
    expect(code('src/pages/trainer/CohortWorkspace.tsx'))
      .toContain('«واجب» و«اختبار» يجيبهما المتعلّم كتابة أو بملف، وتقيّمهما في طابور التقييم.')
  })
})
