/* الفصلُ في معالج فتح الشعبة اختياريّ (٣ج-٥).

   صارت المدّةُ للمدرّب يحدّدها في خطّته، والفصلُ يُشتقّ من تاريخ بدئها حين
   تُعتمَد — «الفصلُ لا يُسأل عنه المدرّب» (صاحب المنصّة، ٢٧ سبتمبر ٢٠٢٦). وكان
   المعالجُ يمنع «التالي» بلا فصلٍ ويقول إنّ الشعبةَ بدونه «تحبس مدرّبَها» — ولم
   يعد ذلك صحيحا. وأثرُه في الخادم في `server/tests/learning/cohort-term-ownership.test.ts` (⑤).

   والفحصُ على الشيفرة بلا تعليقات — كي لا يمرّ حارسٌ بذكرِ كلمةٍ في شرح. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const code = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const WIZ = code('src/pages/admin/CohortWizard.tsx')

describe('معالجُ فتح الشعبة — الفصلُ اختياريّ', () => {
  it('⚠️ الفصلُ ليس ممّا ينقص الخطوةَ الأولى — لا يمنع «التالي»', () => {
    const missing = WIZ.slice(WIZ.indexOf('const stepMissing'), WIZ.indexOf('const canNext'))
    expect(missing, 'لا قائمةَ نقصٍ أصلا').toContain('m.push(')
    expect(missing, 'الفصلُ ما زال شرطا للخطوة').not.toMatch(/termId/)
  })

  it('⚠️ وبلا فصلٍ خيارٌ مسمّى بما يقع — لا «اختر» يوحي بالإلزام', () => {
    expect(WIZ).toMatch(/<option value="">بلا فصل — يُشتقّ من تاريخ البدء<\/option>/)
    expect(WIZ, 'بقي القولُ إنّ الشعبةَ بلا فصلٍ تحبس مدرّبَها').not.toMatch(/يُحبَس مدرّبُها|تحبس مدرّبَها/)
  })

  it('والإنشاءُ يرسل الفصلَ إن اختير وحدَه', () => {
    expect(WIZ).toMatch(/termId: termId \|\| undefined,/)
  })
})
