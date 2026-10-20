/* «انقلها إلى فصل آخر» يقول أوّلَ لقاءٍ بعد النقل قبل الإرسال — بنيةٌ لا نصّ (١٩ أكتوبر ٢٠٢٦).

   نُقلت شعبةٌ إلى «موسم الشتاء 2027» على أنّه الشتاءُ القادم، فصار أوّلُ لقائها بعد سنة. فالصندوقُ يحسب الموعدَ الجديد
   بما يحسبه الخادمُ عند الاعتماد (`moveShiftMs` من فصل أوّل لقائها) ويقوله. والتعليقاتُ تُنزع قبل الفحص. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import CohortMoveBox from '@/components/trainer/CohortMoveBox'

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
    expect(box).toMatch(/includes\(status\) \|\| \(begun && begun <= now\)\) \{/)
    expect(box).not.toMatch(/\(start && start <= now\)/)
  })
})

/* ═══ وحيث لا يُنقل يُقال لماذا — لا يختفي الزرّ صامتا (٢٠ أكتوبر ٢٠٢٦) ═══
   «لا يظهر» (صاحب المنصّة على بطاقةٍ بلا زرّ). ويُصيَّر الصندوقُ نفسُه لا يُقرأ ملفُّه.
   ورُئي ساقطا: أُعيد `return null` لكلّ ما لا يُنقل، فسقط الأوّل. */
describe('صندوق النقل حيث لا ينقل', () => {
  const box = (status: string, startsAt: string | null = null) => renderToStaticMarkup(createElement(CohortMoveBox, {
    cohortId: 'c-1', status, startsAt, pending: null, onChange: () => undefined,
  }))

  it('⚠️ الجارية والتي بدأت تقول لماذا لا تنقل', () => {
    expect(box('active')).toContain('الشعبة جارية — لا تنقل إلى فصل آخر')
    expect(box('open', '2000-01-01T10:00:00.000Z')).toContain('بدأت الشعبة — لا تنقل إلى فصل آخر')
    expect(box('active')).not.toContain('انقلها إلى فصل آخر')
  })

  it('والقابلة للنقل زرها — والمنتهية والملغاة بلا سطر', () => {
    expect(box('draft')).toContain('انقلها إلى فصل آخر')
    expect(box('completed')).toBe('')
    expect(box('cancelled')).toBe('')
  })
})

/* ٢٠ أكتوبر ٢٠٢٦: الطلبُ المعلّقُ يُرى لشريكه في الشعبة — والسحبُ لطالبه وحدَه (`CohortMoveService.mine`).
   ورُئي ساقطا: أُعيد زرُّ السحب بلا شرط `mine` فسقط. */
describe('طلب النقل المعلّق من الشريك', () => {
  const pendingBox = (mine: boolean) => renderToStaticMarkup(createElement(CohortMoveBox, {
    cohortId: 'c-1', status: 'draft', startsAt: null, onChange: () => undefined,
    pending: { id: 'm-1', cohortId: 'c-1', status: 'pending', toYear: 2027, toSeason: 'feb_apr', mine },
  }))

  it('⚠️ يقال لمن الطلب — ولا زرّ سحب لغير طالبه', () => {
    expect(pendingBox(true)).toContain('اسحب الطلب')
    const partner = pendingBox(false)
    expect(partner).toContain('طلب شريكك نقلها إلى')
    expect(partner, 'زرّ سحب لا يملكه').not.toContain('اسحب الطلب')
  })
})
