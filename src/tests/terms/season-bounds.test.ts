/* حدودُ الفصل من موسمه (البندان ٤٦ · ٥٢).

   المواسمُ الأربعةُ في المنصّة منذ زمنٍ بحدودها المكتوبة، **وتُخزَّن في عمود
   JSON** — فلا تُربَط ولا يُستعلَم عنها ولا تعرف الشعبةُ عنها شيئا. وحين
   تصير فصولا لها تواريخ يصير الحسابُ عقدا: موسمُ الشتاء يعبر رأسَ السنة
   (نوفمبر ← يناير)، فسنةُ الفصل سنةُ **بدايته** ونهايتُه في التي تليها.
   وخطأٌ في هذا يضع شعبةً في فصلٍ ليست فيه. */

import { describe, expect, it } from 'vitest'
import { TRAINING_SEASONS } from '../../application/trainer/application-options'
import {
  SEASON_MONTHS, crossesYearEnd, termBounds, termMonths, termOf, monthWithinTerm, termTitleAr,
} from '../../application/terms/season'

describe('الأربعةُ تغطّي السنة — لا شهرَ بلا فصل ولا شهرَ في فصلين', () => {
  it('كلُّ شهرٍ من الاثني عشر يقع في فصلٍ واحدٍ لا غير', () => {
    for (let m = 1; m <= 12; m++) {
      const owners = TRAINING_SEASONS.filter((s) => {
        const { start, end } = SEASON_MONTHS[s.value]
        return crossesYearEnd(s.value) ? m >= start || m <= end : m >= start && m <= end
      })
      expect(owners.map((o) => o.value), `الشهر ${m} — عددُ الفصول التي تدّعيه`).toHaveLength(1)
    }
  })

  it('ولكلّ فصلٍ ثلاثةُ أشهرٍ بالضبط', () => {
    for (const s of TRAINING_SEASONS) {
      expect(termMonths(2026, s.value), s.value).toHaveLength(3)
    }
  })
})

describe('موسمُ الشتاء يعبر رأسَ السنة — وهذا مصدرُ كلّ خطأٍ محتمَل', () => {
  it('شتاءُ ٢٠٢٦ يبدأ نوفمبر ٢٠٢٦ وينتهي آخرَ يناير ٢٠٢٧', () => {
    const b = termBounds(2026, 'nov_jan')
    expect(b.startsOn.toISOString().slice(0, 10)).toBe('2026-11-01')
    expect(b.endsOn.toISOString().slice(0, 10)).toBe('2027-01-31')
  })

  it('ويناير يقع في شتاء السنة **السابقة** لا الحاليّة', () => {
    expect(termOf(new Date(Date.UTC(2026, 0, 15)))).toEqual({ year: 2025, season: 'nov_jan' })
    expect(termOf(new Date(Date.UTC(2026, 10, 15)))).toEqual({ year: 2026, season: 'nov_jan' })
  })

  it('وأشهرُه تحمل سنتَيها الصحيحتين', () => {
    expect(termMonths(2026, 'nov_jan')).toEqual([
      { month: 11, year: 2026 }, { month: 12, year: 2026 }, { month: 1, year: 2027 },
    ])
  })
})

describe('حدودُ بقيّة الفصول — آخرُ يومٍ لا أوّلُ الشهر التالي', () => {
  it.each([
    ['feb_apr', '2026-02-01', '2026-04-30'],
    ['may_jul', '2026-05-01', '2026-07-31'],
    ['aug_oct', '2026-08-01', '2026-10-31'],
  ] as const)('%s: %s → %s', (season, from, to) => {
    const b = termBounds(2026, season)
    expect(b.startsOn.toISOString().slice(0, 10)).toBe(from)
    expect(b.endsOn.toISOString().slice(0, 10)).toBe(to)
  })

  it('والسنةُ الكبيسةُ تُشتقّ من التقويم لا من جدولٍ مكتوب', () => {
    expect(termBounds(2024, 'feb_apr').endsOn.toISOString().slice(0, 10)).toBe('2024-04-30')
    expect(termBounds(2024, 'nov_jan').endsOn.toISOString().slice(0, 10)).toBe('2025-01-31')
  })
})

describe('الشهرُ داخل الفصل — يقرؤه المخطِّطُ والتقويم', () => {
  it('١ و٢ و٣ لأشهر الفصل، و`null` لما خارجه', () => {
    expect(monthWithinTerm(new Date(Date.UTC(2026, 1, 10)), 2026, 'feb_apr')).toBe(1)
    expect(monthWithinTerm(new Date(Date.UTC(2026, 3, 10)), 2026, 'feb_apr')).toBe(3)
    expect(monthWithinTerm(new Date(Date.UTC(2026, 4, 10)), 2026, 'feb_apr')).toBeNull()
  })

  it('ويناير هو الشهرُ الثالثُ من شتاء السنة السابقة', () => {
    expect(monthWithinTerm(new Date(Date.UTC(2027, 0, 10)), 2026, 'nov_jan')).toBe(3)
  })
})

describe('والعنوانُ من المصدر نفسِه — لا جدولَ أسماءٍ ثانٍ', () => {
  it('اسمُ الفصل يُبنى من اسم الموسم المعرَّف في المنصّة', () => {
    for (const s of TRAINING_SEASONS) {
      expect(termTitleAr(2026, s.value)).toBe(`${s.label} 2026`)
    }
  })
})
