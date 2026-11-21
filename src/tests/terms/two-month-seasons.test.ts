/* شهران عملٌ وشهرٌ راحة — المواسمُ الجديدة (٢١ نوفمبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «يجب أن نبدأ الفصل القادم ... لنبتعد عن شهر رمضان»، و«اجعلها تبدأ من 1 أبريل إلى نهاية
   مايو، شهرين فقط». فالمواسمُ أبريل–مايو ويوليو–أغسطس وأكتوبر–نوفمبر ويناير–فبراير، وأوّلُها ربيعُ ٢٠٢٧، ولا يُعاد
   كتابةُ ما مضى: شتاءُ ٢٠٢٦/٢٠٢٧ (نوفمبر–يناير) يبقى كما هو. والحسابُ في `src/application/terms/season.ts`.

   ① الحدودُ والأسماء. ② `termOf` وأشهرُ الراحة وحدُّ ٢٠٢٧. ③ سلسلةُ المواسم. ④ عددُ الأشهر و`plannedMonth`.
   ⑤ ما يُعرض للاختيار. ⑥ وما حُفظ قبل القرار يُقرأ باسمه. */

import { describe, expect, it } from 'vitest'
import { OFFERED_SEASONS, TRAINING_SEASONS, isOfferedSeason } from '@/application/trainer/application-options'
import {
  inRhythm, latestStartedTerm, monthWithinTerm, nextSeason, plannedMonthOk, seasonAfter, termAtOrAfter, termBounds,
  termMonthCount, termMonths, termOf, termStartingOn, termTitleAr,
} from '@/application/terms/season'

const day = (iso: string) => new Date(`${iso}T12:00:00Z`)
const ymd = (d: Date) => d.toISOString().slice(0, 10)

describe('① حدود المواسم الجديدة وأسماؤها', () => {
  it.each([
    ['apr_may', 2027, '2027-04-01', '2027-05-31', 'موسم الربيع 2027'],
    ['jul_aug', 2027, '2027-07-01', '2027-08-31', 'موسم الصيف 2027'],
    ['oct_nov', 2027, '2027-10-01', '2027-11-30', 'موسم الخريف 2027'],
    ['jan_feb', 2028, '2028-01-01', '2028-02-29', 'موسم الشتاء 2028'],
  ] as const)('%s %i: %s → %s «%s»', (season, year, from, to, title) => {
    const b = termBounds(year, season)
    expect(ymd(b.startsOn)).toBe(from)
    expect(ymd(b.endsOn)).toBe(to)
    expect(termTitleAr(year, season)).toBe(title)
  })

  it('⚠️ أول موسم جديد: من 1 أبريل إلى نهاية مايو 2027 — كما قال صاحب المنصة', () => {
    const b = termBounds(2027, 'apr_may')
    expect(ymd(b.startsOn)).toBe('2027-04-01')
    expect(ymd(b.endsOn)).toBe('2027-05-31')
  })

  it('والقديمة تقرأ كما كانت — شتاء 2026/2027 بحدوده واسمه', () => {
    const b = termBounds(2026, 'nov_jan')
    expect(ymd(b.startsOn)).toBe('2026-11-01')
    expect(ymd(b.endsOn)).toBe('2027-01-31')
    expect(termTitleAr(2026, 'nov_jan')).toBe('موسم الشتاء 2026/2027')
    expect(termTitleAr(2027, 'feb_apr')).toBe('موسم الربيع 2027')
  })
})

describe('② أي موسم في أي يوم — وأشهر الراحة', () => {
  it('⚠️ ما قبل فبراير 2027 بالتقويم القديم: نوفمبر 2026 ويناير 2027 شتاء 2026/2027', () => {
    expect(termOf(day('2026-11-21'))).toEqual({ year: 2026, season: 'nov_jan' })
    expect(termOf(day('2026-12-31'))).toEqual({ year: 2026, season: 'nov_jan' })
    expect(termOf(day('2027-01-31'))).toEqual({ year: 2026, season: 'nov_jan' })
    expect(termOf(day('2026-03-10'))).toEqual({ year: 2026, season: 'feb_apr' })
  })

  it('⚠️ فبراير ومارس 2027 فراغ — لا «شتاء 2027» ولا «ربيع» قديم', () => {
    expect(termOf(day('2027-02-01'))).toBeNull()
    expect(termOf(day('2027-02-15'))).toBeNull()
    expect(termOf(day('2027-03-31'))).toBeNull()
  })

  it('⚠️ ومن أبريل 2027 بالتقويم الجديد', () => {
    expect(termOf(day('2027-04-01'))).toEqual({ year: 2027, season: 'apr_may' })
    expect(termOf(day('2027-05-31'))).toEqual({ year: 2027, season: 'apr_may' })
    expect(termOf(day('2027-07-15'))).toEqual({ year: 2027, season: 'jul_aug' })
    expect(termOf(day('2027-11-30'))).toEqual({ year: 2027, season: 'oct_nov' })
    expect(termOf(day('2028-01-05'))).toEqual({ year: 2028, season: 'jan_feb' })
    expect(termOf(day('2028-02-29'))).toEqual({ year: 2028, season: 'jan_feb' })
  })

  it('⚠️ وأشهر الراحة كل سنة: يونيو وسبتمبر وديسمبر ومارس', () => {
    for (const year of [2027, 2028, 2031]) {
      const rest = Array.from({ length: 12 }, (_, i) => i + 1)
        .filter((m) => termOf(new Date(Date.UTC(year, m - 1, 15))) === null)
      expect(rest, String(year)).toEqual(year === 2027 ? [2, 3, 6, 9, 12] : [3, 6, 9, 12])
    }
  })

  it('وفي الراحة: القادم والجاري', () => {
    expect(termAtOrAfter(day('2027-06-10'))).toEqual({ year: 2027, season: 'jul_aug' })
    expect(latestStartedTerm(day('2027-06-10'))).toEqual({ year: 2027, season: 'apr_may' })
    expect(termAtOrAfter(day('2027-03-01'))).toEqual({ year: 2027, season: 'apr_may' })
    expect(latestStartedTerm(day('2027-03-01'))).toEqual({ year: 2026, season: 'nov_jan' })
    expect(termAtOrAfter(day('2027-12-24'))).toEqual({ year: 2028, season: 'jan_feb' })
  })
})

describe('③ المواسم تدور', () => {
  it('⚠️ شتاء 2026/2027 يتلوه ربيع 2027 — بلا فبراير ولا مارس', () => {
    expect(nextSeason({ year: 2026, season: 'nov_jan' })).toEqual({ year: 2027, season: 'apr_may' })
  })

  it('⚠️ ثمّ الربيع فالصيف فالخريف فشتاء السنة التالية فربيعها', () => {
    const chain = [{ year: 2027, season: 'apr_may' as const }]
    for (let i = 0; i < 8; i++) chain.push(nextSeason(chain[chain.length - 1]!) as (typeof chain)[number])
    expect(chain.map((t) => `${t.season} ${t.year}`)).toEqual([
      'apr_may 2027', 'jul_aug 2027', 'oct_nov 2027', 'jan_feb 2028',
      'apr_may 2028', 'jul_aug 2028', 'oct_nov 2028', 'jan_feb 2029', 'apr_may 2029',
    ])
  })

  it('والقادم من اليوم أول ما يبدأ بعده', () => {
    expect(seasonAfter(day('2026-11-21'))).toEqual({ year: 2027, season: 'apr_may' })
    expect(seasonAfter(day('2027-04-10'))).toEqual({ year: 2027, season: 'jul_aug' })
    expect(seasonAfter(day('2027-09-30'))).toEqual({ year: 2027, season: 'oct_nov' })
  })

  it('وموسم من التقويم الساري أو لا', () => {
    expect(inRhythm({ year: 2026, season: 'nov_jan' })).toBe(true)
    expect(inRhythm({ year: 2027, season: 'apr_may' })).toBe(true)
    expect(inRhythm({ year: 2028, season: 'jan_feb' })).toBe(true)
    expect(inRhythm({ year: 2027, season: 'feb_apr' })).toBe(false)
    expect(inRhythm({ year: 2027, season: 'jan_feb' })).toBe(false)
    expect(inRhythm({ year: 2026, season: 'apr_may' })).toBe(false)
  })
})

describe('④ عدد الأشهر — والشهر داخل الفصل', () => {
  it('⚠️ الجديد شهران والقديم ثلاثة', () => {
    expect(termMonthCount('apr_may')).toBe(2)
    expect(termMonthCount('jan_feb')).toBe(2)
    expect(termMonthCount('nov_jan')).toBe(3)
    expect(termMonths(2027, 'oct_nov')).toEqual([{ month: 10, year: 2027 }, { month: 11, year: 2027 }])
    expect(termMonths(2026, 'nov_jan')).toHaveLength(3)
  })

  it('⚠️ و`plannedMonth` 1 أو 2 للجديد، و1 إلى 3 للقديم', () => {
    expect(plannedMonthOk('apr_may', 1)).toBe(true)
    expect(plannedMonthOk('apr_may', 2)).toBe(true)
    expect(plannedMonthOk('apr_may', 3)).toBe(false)
    expect(plannedMonthOk('apr_may', 0)).toBe(false)
    expect(plannedMonthOk('nov_jan', 3)).toBe(true)
    expect(plannedMonthOk('nov_jan', 4)).toBe(false)
  })

  it('وما بعد الشهر الثاني خارج الفصل', () => {
    expect(monthWithinTerm(day('2027-05-20'), 2027, 'apr_may')).toBe(2)
    expect(monthWithinTerm(day('2027-06-02'), 2027, 'apr_may')).toBeNull()
  })
})

describe('⑤ ما يعرض للاختيار', () => {
  it('⚠️ الجديدة وحدها — والقديمة باقية تقرأ', () => {
    expect(OFFERED_SEASONS.map((s) => s.value)).toEqual(['apr_may', 'jul_aug', 'oct_nov', 'jan_feb'])
    expect(isOfferedSeason('nov_jan')).toBe(false)
    expect(isOfferedSeason('feb_apr')).toBe(false)
    expect(TRAINING_SEASONS.map((s) => s.value)).toEqual(expect.arrayContaining(['nov_jan', 'feb_apr', 'may_jul', 'aug_oct']))
  })
})

describe('⑥ وما حفظ قبل القرار يقرأ باسمه', () => {
  it('⚠️ أول يوم لموسم قديم حفظ قبل القرار يبقى موسمه — لا «لا موسم»', () => {
    expect(termStartingOn(new Date('2027-02-01T00:00:00Z'))).toEqual({ year: 2027, season: 'feb_apr' })
    expect(termStartingOn(new Date('2027-05-01T00:00:00Z'))).toEqual({ year: 2027, season: 'may_jul' })
  })

  it('وأول يوم في التقويم الساري موسمه الساري — ولا يخترع ما لم يكن', () => {
    expect(termStartingOn(new Date('2027-04-01T00:00:00Z'))).toEqual({ year: 2027, season: 'apr_may' })
    expect(termStartingOn(new Date('2026-11-01T00:00:00Z'))).toEqual({ year: 2026, season: 'nov_jan' })
    expect(termStartingOn(new Date('2026-04-01T00:00:00Z'))).toBeNull()
    expect(termStartingOn(new Date('2027-04-02T00:00:00Z'))).toBeNull()
  })
})
