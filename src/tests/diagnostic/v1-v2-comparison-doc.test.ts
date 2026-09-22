/* مقارنةُ V1↔V2 تصف الكتالوجَ القائم — لا كتالوجا مضى.

   ─────────── العطبُ الذي وُضع له هذا الحارس ───────────

   بقيت الوثيقةُ سبعةَ أيّامٍ تصف كتالوجا من **عشرين** مسارا والكتالوجُ صار
   **ستّا وعشرين**. ولم يحمرَّ شيء: لا بوّابةَ لها، فمن لم يشغّل المولّدَ
   بيده لم يعلم. وهي العلّةُ نفسُها التي أبادت وثيقةَ الفجوات قبلها.

   وليست وثيقةً تُقرأ وتُنسى: **V1 ما زال بابَ تراجعٍ خلف علمٍ** في
   `assessment-service.ts` (`VITE_DIAGNOSTIC_ENGINE_VERSION=v1|v2`). فمن سأل
   يوما «لمَ لا نعيد العلمَ إلى v1؟» يقرؤها — وسندُ قرارٍ له بابٌ يُفتح يلزم
   أن يبقى صادقا.

   وكشف تجديدُها صفّا يُقرأ بعين: «طالب مدرسة — هدف personal_growth» صار
   يُوصى له بـ`PW-ENGR-001` (الهندسة والتنفيذ) في المحرّكَين معا، بعد أن كان
   `PW-FND-003`. وذاك أثرُ نموّ الكتالوج لا عطبٌ في محرّك — لكنّه لا يُرى
   إلّا بتجديدٍ يُقارَن.

   ─────────── والمقيسُ بنيةٌ لا ورودُ حرف ───────────

   المقيس: أنّ الوثيقةَ **مربوطةٌ ببوّابةٍ تقارنها**، وأنّ البوّابةَ تقارن ولا
   تكتب، وأنّها منادَاةٌ في `verify` — فأمرٌ معرَّفٌ لا يناديه أحدٌ ليس بوّابة،
   وذاك عطبٌ موثَّقٌ في `ci.yml` نفسِه. */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const GEN = 'scripts/report-v2-docs.ts'
const DOC = 'docs/DIAGNOSTIC_V1_V2_COMPARISON_AR.md'

describe('وثيقةُ مقارنة V1↔V2 لا تبيد صامتةً', () => {
  it('لها بوّابةٌ تقارن ولا تكتب، ومنادَاةٌ في `verify`', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> }
    const gate = pkg.scripts['ci:v1-v2-comparison']
    expect(gate, 'لا أمرَ `ci:v1-v2-comparison`').toBeTruthy()
    expect(gate, 'البوّابةُ تكتب بدل أن تقارن').toContain('--check')
    expect(pkg.scripts['verify'], '`verify` لا تستدعي البوّابة').toContain('ci:v1-v2-comparison')
  })

  it('والمولّدُ لا يكتب في وضع المقارنة — وإلّا «قارنَ» ما كتبه للتوّ', () => {
    const src = read(GEN)
    const at = src.indexOf('if (CHECK)')
    expect(at, 'لا وضعَ مقارنةٍ في المولّد').toBeGreaterThan(-1)
    /* جسمُ الفرع حتّى `} else {` — فالكتابةُ تقع في الفرع الآخر لا فيه */
    const branch = src.slice(at, src.indexOf('} else {', at))
    expect(branch, 'يكتب ثمّ يقارن — فلا يحمرّ أبدا').not.toContain('writeFileSync')
    expect(branch, 'لا يُفشل شيئا عند الاختلاف').toContain('process.exit(1)')
  })

  it('وتُعلن أنّها مولَّدة وتسمّي مولّدَها — فلا تُحرَّر باليد فتُمحى', () => {
    const doc = read(DOC)
    expect(doc).toMatch(/وُلّدت آليًا/)
    expect(doc, 'لا تدلّ على مولّدها').toContain('report-v2-docs.ts')
  })

  /* وV1 هو سببُ بقائها: لو رُفع البابُ لصارت تاريخا لا سندَ قرار */
  it('وV1 ما زال بابَ تراجعٍ خلف علم — فالمقارنةُ تسند قرارا حيّا', () => {
    const svc = read('src/application/diagnostic/assessment-service.ts')
    expect(svc, 'تعطّل الفحص: لا علمَ لاختيار المحرّك').toContain('VITE_DIAGNOSTIC_ENGINE_VERSION')
    expect(svc, 'بابُ التراجع إلى v1 رُفع — فالوثيقةُ صارت تاريخا').toMatch(/'v1'/)
  })
})
