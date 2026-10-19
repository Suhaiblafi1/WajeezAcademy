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
    expect(box).toMatch(/\{firstAfter && \([\s\S]*?أول لقاء بعد النقل: \{cohortDayAr\(firstAfter/)
  })
})
