/* تحذيرُ الطالب من شعبتين متعارضتين (`application/learning/cohort-overlap.ts`، ٢٤ أكتوبر ٢٠٢٦).

   يحرس: أنّ التداخلَ يُعدّ لقاءً لقاءً ولا يُعدّ التماسّ، وأنّ شعبةً من الدورة نفسِها بديلٌ لا تعارض، وأنّ الموعدَ
   البديلَ أوّلُ ما لا يتعارض، وأنّ النصَّ ينصح ولا يمنع — بلا تشكيل. */

import { describe, expect, it } from 'vitest'
import { clashWarnAr, clashesOf, freeAlternative, sessionsOverlap, type TimedCohort } from '@/application/learning/cohort-overlap'

const H = 3_600_000
/** لقاءاتٌ أسبوعيّة — بداياتٌ بغرينتش وساعتان لكلّ لقاء */
const weekly = (first: string, n = 4, hours = 2) =>
  Array.from({ length: n }, (_, i) => {
    const at = Date.parse(first) + i * 7 * 24 * H
    return { startsAt: new Date(at).toISOString(), endsAt: new Date(at + hours * H).toISOString() }
  })
const cohort = (cohortId: string, courseId: string, first: string, n = 4): TimedCohort =>
  ({ cohortId, courseId, titleAr: `دورة ${courseId}`, sessions: weekly(first, n) })

describe('شعبتان متعارضتان', () => {
  it('يعدّ ما تداخل لقاء لقاء ويقول أوّله — والمتتالي بلا تداخل ليس تعارضا', () => {
    expect(sessionsOverlap(weekly('2026-12-06T16:00:00Z'), weekly('2026-12-06T17:00:00Z'))).toEqual({ count: 4, firstAt: '2026-12-06T17:00:00.000Z' })
    expect(sessionsOverlap(weekly('2026-12-06T16:00:00Z'), weekly('2026-12-06T18:00:00Z'))).toBeNull()
  })

  it('واللقاء بلا نهاية مكتوبة ساعتان', () => {
    expect(sessionsOverlap([{ startsAt: '2026-12-06T16:00:00Z', endsAt: null }], [{ startsAt: '2026-12-06T17:30:00Z', endsAt: null }])?.count).toBe(1)
  })

  it('وشعبة من الدورة نفسها بديل لا تعارض', () => {
    const a = cohort('a1', 'A', '2026-12-06T16:00:00Z')
    expect(clashesOf(a, [cohort('a2', 'A', '2026-12-06T16:00:00Z')])).toEqual([])
    expect(clashesOf(a, [cohort('b1', 'B', '2026-12-06T16:00:00Z')]).map((x) => x.with.cohortId)).toEqual(['b1'])
  })

  it('والموعد البديل أوّل شعبة من دورته لا تتعارض', () => {
    const busy = [cohort('b1', 'B', '2026-12-06T16:00:00Z')]
    const options = [cohort('a1', 'A', '2026-12-06T16:00:00Z'), cohort('a2', 'A', '2026-12-06T17:00:00Z'), cohort('a3', 'A', '2026-12-08T16:00:00Z')]
    expect(freeAlternative(options, busy)?.cohortId).toBe('a3')
    expect(freeAlternative(options.slice(0, 2), busy)).toBeNull()
    /* وشعبةٌ لم يُعتمد جدولُها لا لقاءاتِ لها تُقاس — فلا يقال إنّها لا تتعارض */
    expect(freeAlternative([{ ...options[2]!, sessions: [] }], busy)).toBeNull()
  })

  it('والنص يسمّي الدورة وعدد اللقاءات وأوّلها بتوقيت عمّان، وينصح ولا يمنع — بلا تشكيل', () => {
    const clashes = clashesOf(cohort('a1', 'A', '2026-12-06T16:00:00Z'), [cohort('b1', 'B', '2026-12-06T16:00:00Z', 3)])
    const withAlt = clashWarnAr(clashes, true)!
    const noAlt = clashWarnAr(clashes, false)!
    expect(withAlt).toContain('تتعارض مع «دورة B» في 3 لقاءات، أولها الأحد 6 ديسمبر')
    expect(withAlt).toContain('موعد آخر لا يتعارض')
    expect(noAlt).toContain('ولك أن تكمل إن أردت')
    expect(clashWarnAr([], true)).toBeNull()
    for (const t of [withAlt, noAlt]) expect(t).not.toMatch(/[ً-ِْ]/)
  })
})
