/* «أعِد ما سحبته» على بطاقة الخطّة — السحبُ بنقرةٍ يُردّ بنقرة (١٢ أكتوبر ٢٠٢٦).

   سأل صاحبُ المنصّة: «أين التعديلات؟ كانت موجودةً وأعتقد أنّي سحبتها.. كيف أعيدها؟» — ولم يكن لها باب.
   والسلوكُ على قاعدةٍ حقيقيّة في `server/tests/plan/restore-edits.test.ts`؛ وهنا الشاشة:

   ① تقرأ كم يعود مع القائمة، ② وتعرض الزرَّ بعدده حين يكون شيءٌ يعود، ③ وتنادي مسارَه وتقول ما عاد،
   ④ ورسالةُ السحب تدلّ عليه وعلى شرطه.

   ومنذ ٢٠ أكتوبر ٢٠٢٦ يعود آخرُ سحبٍ بـ«اسحب ما لم يقرّر» كلُّه أو لا شيء — فلا سطرَ لما بقي مسحوبا،
   ولا يعيد ما سحبه رفعُ ملفٍّ ولا «احذف المكرر»، ولا يعيد شيئا بعد ملفٍّ رُفع بعده. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
const ui = code('src/components/PlanEdits.tsx')

describe('«أعد ما سحبته»', () => {
  it('⚠️ تقرأ البطاقة كم يعود مع القائمة', () => {
    expect(ui).toMatch(/const w = await apiGet<\{ count: number; older\?: number \}>\(`\/api\/admin\/cohorts\/\$\{cohortId\}\/plan-edits\/withdrawn`\);\s*setWithdrawn\(w\.count\);/)
  })

  it('⚠️ والزرّ بعدده حين يعود شيء — ينادي مسار الإعادة', () => {
    expect(ui).toMatch(/\{withdrawn > 0 && \(\s*<Button[^>]*onClick=\{\(\) => void restore\(\)\}>\s*أعد ما سحبته \(\{withdrawn\}\)/)
    expect(ui).toMatch(/const restore = async \(\) => \{[\s\S]{0,300}apiPost<[^>]+>\(\s*`\/api\/admin\/cohort-plans\/\$\{planId\}\/edits\/restore`/)
  })

  it('⚠️ ويقول ما عاد وأين — ولا سطرَ لما بقي مسحوبا: يعود كلّه أو لا شيء', () => {
    const body = ui.slice(ui.indexOf('const restore = async'), ui.indexOf('const restore = async') + 1200)
    expect(body).toMatch(/`أعاد \$\{r\.restored\} كما كانت`/)
    expect(body).toMatch(/`\$\{r\.toTrainer\} عند المدرّب`/)
    expect(body).not.toMatch(/skipped/)
  })

  it('ورسالة السحب تدلّ عليه وعلى شرطه — والعدد يقرأ بعده', () => {
    expect(ui).toMatch(/setMsg\("سحب ما لم يقرّر فيه — وتعيده كما كان بـ«أعد ما سحبته» ما لم ترفع ملفا بعده\."\);\s*await load\(\);/)
  })
})
