/* حسابُ الموعد — بالأيّام التقويميّة لا بالساعات (المهمّة ٧٢).

   العطبُ الذي يُتجنَّب هنا معروفُ الشكل: `(due - now) / 86400000` ثمّ
   `Math.floor`. فموعدٌ في العاشرة مساءَ **اليوم** يُقرأ «صفرُ أيّام» إن
   سُئل صباحا و«فات» إن سُئل ليلا — والاثنان صحيحان بالساعات وأحدُهما كاذبٌ
   بالتقويم. والمتعلّمُ يقرأ التقويمَ لا الساعات: «اليوم» و«غدا» و«فات
   أمس». فالحسابُ من بداية اليوم إلى بداية اليوم. */

import { describe, expect, it } from 'vitest'
import {
  AR_CARDS, AR_COHORTS, AR_SESSIONS, AR_SUBMISSIONS,
  HORIZON_DAYS, byDueAt, countAr, daysUntil, dueLabelAr, urgencyOf,
} from '../application/student/deadlines'

const at = (s: string) => new Date(s)

describe('أيّامٌ تقويميّةٌ حتّى الموعد', () => {
  it('موعدٌ آخرَ اليوم هو «اليوم» صباحا وليلا — لا يتغيّر بساعة السؤال', () => {
    const due = at('2026-09-04T22:00:00')
    expect(daysUntil(due, at('2026-09-04T07:00:00'))).toBe(0)
    expect(daysUntil(due, at('2026-09-04T21:59:00'))).toBe(0)
    expect(urgencyOf(due, at('2026-09-04T07:00:00'))).toBe('today')
  })

  it('وموعدُ أمسِ فائتٌ ولو كان بعد ساعاتٍ قليلة', () => {
    /* بالساعات: ثلاثُ ساعاتٍ فقط. وبالتقويم: يومٌ فات. والثاني هو الصحيح. */
    expect(daysUntil(at('2026-09-03T23:00:00'), at('2026-09-04T02:00:00'))).toBe(-1)
    expect(urgencyOf(at('2026-09-03T23:00:00'), at('2026-09-04T02:00:00'))).toBe('overdue')
    expect(dueLabelAr(at('2026-09-03T23:00:00'), at('2026-09-04T02:00:00'))).toBe('فات أمس')
  })

  it('والدرجاتُ أربع: فائتٌ · اليوم · قريبٌ (٣ أيّام) · بعيد', () => {
    const now = at('2026-09-04T10:00:00')
    expect(urgencyOf(at('2026-09-05T09:00:00'), now)).toBe('soon')
    expect(urgencyOf(at('2026-09-07T09:00:00'), now)).toBe('soon')
    expect(urgencyOf(at('2026-09-08T09:00:00'), now)).toBe('later')
  })

  it('والنصُّ العربيُّ يفرّق الفائتَ عن القادم بلفظه لا بلونه', () => {
    const now = at('2026-09-04T10:00:00')
    expect(dueLabelAr(at('2026-09-04T18:00:00'), now)).toBe('اليوم')
    expect(dueLabelAr(at('2026-09-05T18:00:00'), now)).toBe('غدا')
    expect(dueLabelAr(at('2026-09-06T18:00:00'), now)).toBe('بعد يومين')
    expect(dueLabelAr(at('2026-09-09T18:00:00'), now)).toBe('بعد 5 أيّام')
    expect(dueLabelAr(at('2026-09-01T18:00:00'), now)).toBe('فات قبل 3 أيّام')
    /* والمثنّى مثنّى في الاتّجاهَين — «فات قبل ٢ أيّام» ليست عربيّة */
    expect(dueLabelAr(at('2026-09-02T18:00:00'), now)).toBe('فات قبل يومين')
    expect(dueLabelAr(at('2026-09-05T18:00:00'), now)).toBe('غدا')
  })

  it('والعددُ العربيُّ أربعُ صيغٍ لا اثنتان — وشاشةٌ تكتب «٢ جلسة» تُقرأ آلة', () => {
    const f = { one: 'جلسةٌ واحدةٌ', two: 'جلستان', few: 'جلسات', many: 'جلسةً' }
    expect(countAr(1, f)).toBe('جلسةٌ واحدةٌ')
    expect(countAr(2, f)).toBe('جلستان')
    expect(countAr(3, f)).toBe('3 جلسات')
    expect(countAr(10, f)).toBe('10 جلسات')
    expect(countAr(11, f)).toBe('11 جلسةً')
    expect(countAr(100, f)).toBe('100 جلسةً')
    /* والصفرُ يأخذ الجمعَ بلا رقم — «لا جلسات» لا «٠ جلسة» */
    expect(countAr(0, f)).toBe('جلسات')
  })

  it('وصيغُ ما يُعَدّ في موضعٍ واحدٍ — فلا تفترق شاشتان في لفظِ الشيء نفسِه', () => {
    expect(countAr(2, AR_SUBMISSIONS)).toBe('تسليمان')
    expect(countAr(2, AR_CARDS)).toBe('بطاقتا استرجاعٍ')
    expect(countAr(2, AR_SESSIONS)).toBe('جلستان')
    expect(countAr(2, AR_COHORTS)).toBe('شعبتين')
  })

  it('والترتيبُ بالموعد: الفائتُ أوّلا لأنّه الأقربُ حسابا', () => {
    const rows = [
      { dueAt: '2026-09-10T00:00:00.000Z', id: 'c' },
      { dueAt: '2026-09-01T00:00:00.000Z', id: 'a' },
      { dueAt: '2026-09-05T00:00:00.000Z', id: 'b' },
    ]
    expect(byDueAt(rows).map((r) => r.id)).toEqual(['a', 'b', 'c'])
    /* ولا يُغيّر المصفوفةَ الأصليّة — ترتيبٌ في مكانه يفسد حالةَ React */
    expect(rows[0].id).toBe('c')
  })

  it('والأفقُ ثلاثون يوما — رقمٌ واحدٌ يقرؤه الخادمُ والواجهةُ معا', () => {
    expect(HORIZON_DAYS).toBe(30)
  })
})
