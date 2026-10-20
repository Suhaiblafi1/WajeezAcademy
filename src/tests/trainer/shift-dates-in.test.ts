/* كلُّ موعدٍ في بطاقة «قبل/بعد» يُزاح مع الشعبة المنقولة — `shiftDatesIn` (٢٠ أكتوبر ٢٠٢٦).

   البطاقاتُ بثمانية عشر شكلا، ولقطاتُها مسطّحة. فالدالّةُ تمشي في البنية كلِّها وتزيح كلَّ نصٍّ هو تاريخٌ كاملٌ لا
   غيرُه — ولا تمسّ عنوانا فيه تاريخٌ ولا رقما ولا مفتاحا.
   ورُئي ساقطا: قُصرت على الجذر فسقط الأوّل، وأُزيح كلُّ نصٍّ يبدأ بتاريخ فسقط الثاني. */

import { describe, expect, it } from 'vitest'
import { shiftDatesIn } from '@/application/trainer/plan-copy'

describe('shiftDatesIn', () => {
  it('⚠️ يزيح الأيام واللحظات حيث كانت — في الكائنات والمصفوفات المتداخلة', () => {
    const schedule = {
      kind: 'schedule', weekday: 2, clock: '18:00',
      moves: [{ sessionId: 's-1', startsAt: '2026-11-03T15:00:00.000Z', endsAt: '2026-11-03T17:00:00.000Z' }],
      tasks: [{ assessmentId: 't-1', dueAt: '2026-11-10T20:59:00.000Z' }],
      plan: { endsOn: '2026-12-01', slots: [{ moduleIds: ['m-1'], startsOn: '2026-11-01', endsOn: '2026-11-07' }] },
    }
    expect(shiftDatesIn(schedule, 91)).toEqual({
      kind: 'schedule', weekday: 2, clock: '18:00',
      moves: [{ sessionId: 's-1', startsAt: '2027-02-02T15:00:00.000Z', endsAt: '2027-02-02T17:00:00.000Z' }],
      tasks: [{ assessmentId: 't-1', dueAt: '2027-02-09T20:59:00.000Z' }],
      plan: { endsOn: '2027-03-02', slots: [{ moduleIds: ['m-1'], startsOn: '2027-01-31', endsOn: '2027-02-06' }] },
    })
    /* واللقطةُ المسطّحةُ بمفاتيحها كما هي */
    expect(shiftDatesIn({ 's:s-1:startsAt': '2026-11-03T15:00:00.000Z', 'p:endsOn': '2026-12-01' }, 7))
      .toEqual({ 's:s-1:startsAt': '2026-11-10T15:00:00.000Z', 'p:endsOn': '2026-12-08' })
  })

  it('⚠️ ولا يمسّ نصا فيه تاريخ ولا رقما ولا فراغا', () => {
    const card = {
      kind: 'cohort_title', titleAr: 'شعبة 2026-11-03 المسائية', textAr: 'من 2026-11-03 إلى الأحد',
      /* نصٌّ يبدأ بتاريخٍ ويقرؤه `Date` لحظةً — وليس لحظةً بصيغتها */
      whenAr: '2026-11-03 18:00',
      maxScore: 100, noteAr: null, empty: '', when: '18:00',
    }
    expect(shiftDatesIn(card, 7)).toEqual(card)
  })

  it('ولا يغيّر الأصل', () => {
    const edit = { kind: 'session_move', startsAt: '2026-11-03T15:00:00.000Z' }
    shiftDatesIn(edit, 7)
    expect(edit.startsAt).toBe('2026-11-03T15:00:00.000Z')
  })
})
