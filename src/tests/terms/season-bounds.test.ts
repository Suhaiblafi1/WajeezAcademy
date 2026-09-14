/* حدودُ الفصل من موسمه (البندان ٤٦ · ٥٢).

   المواسمُ الأربعةُ في المنصّة منذ زمنٍ بحدودها المكتوبة، **وتُخزَّن في عمود
   JSON** — فلا تُربَط ولا يُستعلَم عنها ولا تعرف الشعبةُ عنها شيئا. وحين
   تصير فصولا لها تواريخ يصير الحسابُ عقدا: موسمُ الشتاء يعبر رأسَ السنة
   (نوفمبر ← يناير)، فسنةُ الفصل سنةُ **بدايته** ونهايتُه في التي تليها.
   وخطأٌ في هذا يضع شعبةً في فصلٍ ليست فيه. */

import { describe, expect, it } from 'vitest'
import { TRAINING_SEASONS } from '../../application/trainer/application-options'
import {
  SEASON_MONTHS, crossesYearEnd, termBounds, termHorizon, termMonths, termOf, monthWithinTerm, termTitleAr,
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

/* ═══ أفقُ العرض في «المواسم والتقويم» ═══

   ثمانيةُ مواسمَ في شاشةٍ واحدة عملٌ لا يُقرأ: لكلٍّ نافذةُ تسجيلٍ وتوزيعٌ
   وزرُّ نشر. وشكا صاحبُ المنصّة (١٣ سبتمبر ٢٠٢٦): «ضع الموسمَ القادمَ
   والذي يليه فقط». والخطرُ في التنفيذ أن يُخفى معها الموسمُ **الجاري** —
   وفيه الشعبُ التي تعمل اليوم. */
describe('أفقُ عرض المواسم — الجاري وما يليه، ولا يُحذف شيء', () => {
  const term = (startsOn: string, endsOn: string) => ({ startsOn, endsOn })
  /* المواسمُ الثمانيةُ التي كانت في الشاشة يومَ الشكوى */
  const all = [
    term('2026-02-01', '2026-04-30'), term('2026-05-01', '2026-07-31'),
    term('2026-08-01', '2026-10-31'), term('2026-11-01', '2027-01-31'),
    term('2027-02-01', '2027-04-30'), term('2027-05-01', '2027-07-31'),
    term('2027-08-01', '2027-10-31'), term('2027-11-01', '2028-01-31'),
  ]
  const day = (iso: string) => new Date(`${iso}T12:00:00Z`)

  it('⚠️ ثمانيةٌ تصير ثلاثا: الجاري ثمّ اثنان — ولا يضيع منها واحد', () => {
    const { shown, hidden } = termHorizon(all, day('2026-09-13'))
    expect(shown.map((t) => t.startsOn)).toEqual(['2026-08-01', '2026-11-01', '2027-02-01'])
    expect(shown.length + hidden.length, 'ضاع فصلٌ في القسمة').toBe(all.length)
  })

  it('⚠️ والجاري لا يُخفى مع المخفيّ — فيه شعبٌ تعمل اليوم', () => {
    /* ١٣ سبتمبر داخلَ موسم أغسطس–أكتوبر: لو حُسب بـ«ما بدأ بعد اليوم»
       وحدَه لسقط، ولوجد المديرُ شعبَه الجاريةَ خلفَ إفصاح. */
    const { shown, hidden } = termHorizon(all, day('2026-09-13'))
    expect(shown[0].startsOn).toBe('2026-08-01')
    expect(hidden.some((t) => t.startsOn === '2026-08-01'), 'الجاري خلفَ الإفصاح').toBe(false)
  })

  it('⚠️ والجاري لا يأكل نصيبَ المستقبل — يبقى القادمُ والذي يليه كاملَين', () => {
    /* لو عُدّ الجاري من الاثنين لظهر واحدٌ فقط بعده — وهو ما طُلب ضدُّه */
    const inside = termHorizon(all, day('2026-09-13')).shown.filter((t) => t.startsOn > '2026-09-13')
    expect(inside.length).toBe(2)
  })

  it('وما بين موسمَين — لا جاريَ — فالمعروضُ اثنان لا ثلاثة', () => {
    const gapped = [term('2026-02-01', '2026-04-30'), term('2026-11-01', '2027-01-31'), term('2027-02-01', '2027-04-30')]
    const { shown } = termHorizon(gapped, day('2026-09-13'))
    expect(shown.map((t) => t.startsOn)).toEqual(['2026-11-01', '2027-02-01'])
  })

  it('والماضي كلُّه خلفَ الإفصاح، ولا يُرتَّب العرضُ إلا بالبداية', () => {
    const shuffled = [all[7], all[0], all[3], all[2]]
    const { shown, hidden } = termHorizon(shuffled, day('2026-09-13'))
    expect(shown.map((t) => t.startsOn)).toEqual(['2026-08-01', '2026-11-01', '2027-11-01'])
    expect(hidden.map((t) => t.startsOn)).toEqual(['2026-02-01'])
  })

  it('ولا مواسمَ أصلا فلا شيءَ يُعرض ولا شيءَ يُخفى', () => {
    expect(termHorizon([], day('2026-09-13'))).toEqual({ shown: [], hidden: [] })
  })
})
