/* «انقلها إلى فصل آخر» يقول أوّلَ لقاءٍ بعد النقل قبل الإرسال — بنيةٌ لا نصّ (١٩ أكتوبر ٢٠٢٦).

   نُقلت شعبةٌ إلى «موسم الشتاء 2027» على أنّه الشتاءُ القادم، فصار أوّلُ لقائها بعد سنة. فالصندوقُ يحسب الموعدَ الجديد
   بما يحسبه الخادمُ عند الاعتماد (`moveShiftMs` من فصل أوّل لقائها) ويقوله. والتعليقاتُ تُنزع قبل الفحص. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const box = readFileSync(join(process.cwd(), 'src/components/trainer/CohortMoveBox.tsx'), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('صندوق النقل', () => {
  it('يحسب أول لقاء بعد النقل كما يحسبه الخادم', () => {
    expect(box).toMatch(/moveShiftMs\(termOf\(start\), target\)/)
  })

  it('ويقوله قبل الإرسال', () => {
    expect(box).toMatch(/\{firstAfter && \([\s\S]*?\{begun \? "أول لقاء بعد النقل" : "تبدأ بعد النقل"\}: \{cohortDayAr\(firstAfter/)
  })
})

/* ═══ وشعبةُ الإعداد يقاس فصلُها من بدئها المقترح — ولا يعدّ بدءا مضى (٢٠ أكتوبر ٢٠٢٦) ═══
   رُئي ساقطا: جُعل المقترحُ في شرط «بدأت فلا تنقل»، فسقط الثاني. */
describe('صندوق النقل في شعبة الإعداد', () => {
  it('⚠️ الفصل من أول لقائها أو بدئها المقترح', () => {
    expect(box).toMatch(/const start = begun \?\? \(proposedStartsOn \?/)
  })
  it('⚠️ والمقترح لا يخفي الصندوق — «بدأت» من أول لقائها وحده', () => {
    expect(box).toMatch(/\(begun && begun <= now\)\) return null/)
    expect(box).not.toMatch(/\(start && start <= now\)/)
  })
})
