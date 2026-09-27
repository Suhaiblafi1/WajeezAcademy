/* خطُّ المحاور — المواعيدُ وما يُفتح في كلٍّ منها.

   قرارُ صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦) وقراراتُه العشرة بكلمة «go». والعلّةُ
   كاملةً في رأس `src/application/trainer/axis-timeline.ts`.

   والتواريخُ هي مثالُ العرض نفسُه: دورةٌ بثمانية محاور من ٤ أكتوبر إلى
   ٨ نوفمبر ٢٠٢٦. وعمّانُ على +٣ طوالَ السنة، فمنتصفُ ليلها التاسعةُ مساءَ
   أمسه بغرينتش. */

import { describe, expect, it } from 'vitest'
import {
  appendToSlots, buildTimeline, canMerge, dayInSlot, defaultSlots, dropFromSlots, mergeSlots, minSlots,
  reflowSlots, sessionProblems, slotProblems, splitSlot, workbookDone, workbookProblems, type PlanSlot,
} from '@/application/trainer/axis-timeline'

const EIGHT = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8']
const PERIOD = { startsOn: '2026-10-04', endsOn: '2026-11-08' }
const shape = (slots: PlanSlot[]) => slots.map((s) => `${s.startsOn}..${s.endsOn}:${s.moduleIds.join('+')}`)

describe('التوزيعُ الأوّل — مواعيدُ أسبوعيّةٌ من يوم البدء', () => {
  it('ثمانيةُ محاورَ في خمسة أسابيع: المثالُ الذي عُرض بنصّه', () => {
    expect(shape(defaultSlots(EIGHT, PERIOD))).toEqual([
      '2026-10-04..2026-10-10:m1+m2',
      '2026-10-11..2026-10-17:m3',
      '2026-10-18..2026-10-24:m4+m5',
      '2026-10-25..2026-10-31:m6',
      '2026-11-01..2026-11-08:m7+m8',
    ])
  })

  it('وأربعةُ محاورَ في ثمانية أسابيع: أربعةُ مواعيدَ تتقاسم المدّة — لا أربعةُ أسابيعَ وفراغ', () => {
    const slots = defaultSlots(['a', 'b', 'c', 'd'], { startsOn: '2026-10-04', endsOn: '2026-11-28' })
    expect(shape(slots)).toEqual([
      '2026-10-04..2026-10-17:a', '2026-10-18..2026-10-31:b', '2026-11-01..2026-11-14:c', '2026-11-15..2026-11-28:d',
    ])
  })

  it('ولا ينزل عن الحدّ في مدّةٍ قصيرة، ولا يتداخل، ولا يخرج من المدّة', () => {
    const p = { startsOn: '2026-10-04', endsOn: '2026-10-13' }
    const slots = defaultSlots(['a', 'b', 'c', 'd'], p)
    expect(slots).toHaveLength(4)
    expect(slotProblems(slots, ['a', 'b', 'c', 'd'], p)).toEqual([])
  })

  it('ولا يزيد على المحاور — وعشرةُ محاورَ في ثلاثة أسابيع أربعةُ مواعيد', () => {
    const ten = Array.from({ length: 10 }, (_, i) => `x${i + 1}`)
    const p = { startsOn: '2026-10-04', endsOn: '2026-10-24' }
    const slots = defaultSlots(ten, p)
    expect(slots.map((s) => s.moduleIds.length)).toEqual([3, 2, 3, 2])
    expect(slotProblems(slots, ten, p)).toEqual([])
  })

  it('والحدُّ أربعة — أو عددُ المحاور إن قلّت', () => {
    expect(minSlots(8)).toBe(4)
    expect(minSlots(4)).toBe(4)
    expect(minSlots(3)).toBe(3)
  })
})

describe('ما يمنع المواعيد — بلغة من يصحّحها', () => {
  const good = defaultSlots(EIGHT, PERIOD)

  it('التوزيعُ الأوّل سليم', () => {
    expect(slotProblems(good, EIGHT, PERIOD)).toEqual([])
  })

  it('لا مواعيدَ بعد: يُقال ما يُفعل', () => {
    expect(slotProblems([], EIGHT, PERIOD).join()).toContain('وزّع المحاور')
  })

  it('أقلُّ من أربعة مواعيد مردود — وإن ضمّت كلَّ المحاور', () => {
    const three = mergeSlots(mergeSlots(good, 0), 0)
    expect(three).toHaveLength(3)
    expect(slotProblems(three, EIGHT, PERIOD).join()).toContain('4 مواعيد')
  })

  it('ودورةٌ بأربعة محاورَ لا يُجمع منها شيء', () => {
    const slots = defaultSlots(['a', 'b', 'c', 'd'], PERIOD)
    expect(slotProblems(mergeSlots(slots, 1), ['a', 'b', 'c', 'd'], PERIOD).join()).toContain('لا يُجمع منها شيء')
  })

  it('ولا يُجمع إلّا متجاوران: ١+٣ مردود', () => {
    const broken = good.map((s) => ({ ...s, moduleIds: [...s.moduleIds] }))
    broken[0].moduleIds = ['m1', 'm3']
    broken[1].moduleIds = ['m2']
    expect(slotProblems(broken, EIGHT, PERIOD).join()).toContain('متجاوران')
  })

  it('والمحورُ الذي لا موعدَ له يُسمّى برقمه', () => {
    const missing = good.map((s, i) => (i === 1 ? { ...s, moduleIds: [] } : s))
    const out = slotProblems(missing, EIGHT, PERIOD).join(' · ')
    expect(out).toContain('المحور 3')
    expect(out).toContain('بلا محور')
  })

  it('والمتداخلُ مردود — والفجوةُ جائزة', () => {
    const overlap = good.map((s, i) => (i === 1 ? { ...s, startsOn: '2026-10-09' } : s))
    expect(slotProblems(overlap, EIGHT, PERIOD).join()).toContain('متداخلة')
    /* ⚠️ والحدُّ نفسُه: موعدٌ يبدأ في يوم انتهاء سابقه يتقاسمان يوما — متداخلان */
    const touching = good.map((s, i) => (i === 1 ? { ...s, startsOn: '2026-10-10' } : s))
    expect(slotProblems(touching, EIGHT, PERIOD).join(), 'موعدان يتقاسمان يوما مرّا').toContain('متداخلة')
    const gap = good.map((s, i) => (i === 1 ? { ...s, startsOn: '2026-10-13' } : s))
    expect(slotProblems(gap, EIGHT, PERIOD)).toEqual([])
  })

  it('والخارجُ من مدّة الشعبة مردود', () => {
    const out = good.map((s, i) => (i === 4 ? { ...s, endsOn: '2026-11-10' } : s))
    expect(slotProblems(out, EIGHT, PERIOD).join()).toContain('خارجَ مدّة الشعبة')
  })
})

describe('الجمعُ والفصل — والمحاورُ تتغيّر فتتبعها المواعيد', () => {
  const good = defaultSlots(EIGHT, PERIOD)

  it('الجمعُ يأخذ من أوّل الأوّل إلى آخر الثاني — ويقف عند الحدّ', () => {
    const merged = mergeSlots(good, 1)
    expect(shape(merged)[1]).toBe('2026-10-11..2026-10-24:m3+m4+m5')
    expect(canMerge(good, 1, 8)).toBe(true)
    expect(canMerge(merged, 0, 8)).toBe(false)
  })

  it('والفصلُ يقسم الأيّامَ بقدر المحاور — ولكلٍّ يومٌ على الأقلّ', () => {
    const split = splitSlot(good, 0, 1)
    expect(shape(split).slice(0, 2)).toEqual(['2026-10-04..2026-10-07:m1', '2026-10-08..2026-10-10:m2'])
    expect(splitSlot(good, 1, 1)).toEqual(good)
  })

  it('نقلُ محورٍ يُبقي الأحجامَ والتواريخ', () => {
    const order = ['m1', 'm3', 'm2', 'm4', 'm5', 'm6', 'm7', 'm8']
    expect(shape(reflowSlots(good, order)).slice(0, 2)).toEqual(['2026-10-04..2026-10-10:m1+m3', '2026-10-11..2026-10-17:m2'])
  })

  it('والجديدُ يلحق آخرَ موعد، والمحذوفُ يخرج ويسقط موعدُه إن فرغ', () => {
    expect(appendToSlots(good, 'm9').at(-1)!.moduleIds).toEqual(['m7', 'm8', 'm9'])
    const dropped = dropFromSlots(good, 'm3')
    expect(dropped).toHaveLength(4)
    expect(dropped[1].startsOn).toBe('2026-10-18')
  })
})

describe('الكرّاسة — لكلّ موعدٍ واحدة، ملفٌّ أو رابط', () => {
  it('الملفُّ أو الرابطُ يكفي — والنصُّ ليس رابطا', () => {
    expect(workbookDone({ bodyFileKey: 'k1' })).toBe(true)
    expect(workbookDone({ url: 'https://example.org/wb.pdf' })).toBe(true)
    expect(workbookDone({ url: 'كرّاسة المحور' })).toBe(false)
    expect(workbookDone(null)).toBe(false)
  })

  it('والناقصُ يُسمّى بموعده ومحاوره', () => {
    const slots = defaultSlots(EIGHT, PERIOD).map((s, i) => (i === 0 ? s : { ...s, workbook: { url: 'https://x.org' } }))
    expect(workbookProblems(slots, EIGHT)).toEqual(['الموعد 1 (المحوران 1+2) بلا كرّاسة — ارفع ملفّا أو ألصِق رابطا'])
  })
})

describe('اللقاءاتُ على المواعيد', () => {
  const slots = defaultSlots(EIGHT, PERIOD)
  /* الأحدُ الثامنة مساءً بتوقيت عمّان = الخامسة بغرينتش، ساعتان */
  const at = (day: string, moduleIds: string[], title = 'لقاء') =>
    ({ title, startsAt: `${day}T17:00:00.000Z`, endsAt: `${day}T19:00:00.000Z`, moduleIds })
  const full = [
    at('2026-10-04', ['m1', 'm2']), at('2026-10-11', ['m3']), at('2026-10-18', ['m4', 'm5']),
    at('2026-10-25', ['m6']), at('2026-11-01', ['m7', 'm8']),
  ]

  it('لقاءٌ لكلّ محورٍ في أوّل موعده: لا مانعَ ولا تنبيه', () => {
    expect(sessionProblems({ slots, moduleIds: EIGHT, sessions: full })).toEqual({ blocking: [], warnings: [] })
  })

  it('والمحورُ بلا لقاءٍ مباشرٍ مردود — والمسجَّلُ لا يُغني عنه', () => {
    const r = sessionProblems({
      slots, moduleIds: EIGHT, sessions: full.slice(0, 4),
      recordings: [{ title: 'مسجّل', moduleId: 'm7', opensAt: '2026-11-01T06:00:00.000Z' }],
    })
    expect(r.blocking.join()).toContain('المحور 7، المحور 8')
  })

  it('واللقاءُ لمحورٍ أو محورين — لا ثلاثة، ولا لمحورين من موعدين', () => {
    const three = sessionProblems({ slots, moduleIds: EIGHT, sessions: [...full, at('2026-10-05', ['m1', 'm2', 'm3'], 'ثلاثي')] })
    expect(three.blocking.join()).toContain('أكثرَ من محورين')
    const across = sessionProblems({ slots, moduleIds: EIGHT, sessions: [...full, at('2026-10-05', ['m2', 'm3'], 'عابر')] })
    expect(across.blocking.join()).toContain('من موعدين')
  })

  it('واللقاءُ خارجَ موعد محوره مردود', () => {
    const r = sessionProblems({ slots, moduleIds: EIGHT, sessions: [...full.slice(1), at('2026-10-12', ['m1', 'm2'], 'متأخّر')] })
    expect(r.blocking.join()).toContain('خارجَ موعد المحوران 1+2')
  })

  it('وبعد اليوم الثالث تنبيهٌ لا منع', () => {
    const late = [at('2026-10-08', ['m1', 'm2'], 'الخميس'), ...full.slice(1)]
    const r = sessionProblems({ slots, moduleIds: EIGHT, sessions: late })
    expect(r.blocking).toEqual([])
    expect(r.warnings.join()).toContain('اليوم 5')
    expect(dayInSlot('2026-10-08T17:00:00.000Z', slots[0])).toBe(5)
  })

  it('والمسجَّلةُ بلا محورٍ أو خارجَ موعده مردودة', () => {
    const r = sessionProblems({
      slots, moduleIds: EIGHT, sessions: full,
      recordings: [
        { title: 'يتيمة', moduleId: null, opensAt: '2026-10-05T06:00:00.000Z' },
        { title: 'مبكّرة', moduleId: 'm3', opensAt: '2026-10-05T06:00:00.000Z' },
      ],
    })
    expect(r.blocking.join()).toContain('«يتيمة» بلا محور')
    expect(r.blocking.join()).toContain('«مبكّرة» تُفتح خارجَ موعد المحور 3')
  })
})

describe('متى يُفتح كلُّ شيء', () => {
  const slots = defaultSlots(EIGHT, PERIOD)
  const live = { startsAt: '2026-10-13T17:00:00.000Z', endsAt: '2026-10-13T19:00:00.000Z', moduleIds: ['m3'] }

  it('المتنُ والكرّاسةُ منتصفَ ليل أوّل الموعد بعمّان — وآخرُ موعدٍ للتسليم آخرُ ثانيةٍ فيه', () => {
    const t = buildTimeline({ slots, sessions: [live], period: PERIOD })!
    expect(t.theoryOpensAt('m3')!.toISOString()).toBe('2026-10-10T21:00:00.000Z')
    expect(t.defaultDueAt('m3')!.toISOString()).toBe('2026-10-17T20:59:59.999Z')
  })

  it('والمهامُّ حين ينتهي أوّلُ لقاءٍ للمحور', () => {
    const t = buildTimeline({ slots, sessions: [live], period: PERIOD })!
    expect(t.workOpensAt('m3')!.toISOString()).toBe('2026-10-13T19:00:00.000Z')
  })

  it('والمسجَّلُ «ينتهي» لحظةَ فتحه — فإن سبق المباشرَ فتح المهامّ', () => {
    const t = buildTimeline({
      slots, sessions: [live], period: PERIOD,
      resources: [{ category: 'recorded', moduleId: 'm3', opensAt: '2026-10-11T06:00:00.000Z' }],
    })!
    expect(t.workOpensAt('m3')!.toISOString()).toBe('2026-10-11T06:00:00.000Z')
  })

  it('ولا قبل أوّل الموعد — لقاءٌ نُقل قبل موعده لا يفتح محورَه قبل أوانه', () => {
    const early = { ...live, startsAt: '2026-10-05T17:00:00.000Z', endsAt: '2026-10-05T19:00:00.000Z' }
    const t = buildTimeline({ slots, sessions: [early], period: PERIOD })!
    expect(t.workOpensAt('m3')!.toISOString()).toBe('2026-10-10T21:00:00.000Z')
  })

  it('ومحورٌ بلا لقاء: مع أوّل موعده، لا محبوسا إلى الأبد', () => {
    const t = buildTimeline({ slots, sessions: [], period: PERIOD })!
    expect(t.workOpensAt('m6')!.toISOString()).toBe('2026-10-24T21:00:00.000Z')
  })

  it('والمصادر: المسبقةُ مع الكرّاسة، والتي بلا محورٍ مع أوّل الشعبة، وغيرُها بعد اللقاء', () => {
    const t = buildTimeline({ slots, sessions: [live], period: PERIOD })!
    expect(t.resourceOpensAt({ category: 'reading', moduleId: 'm3', preReading: true })!.toISOString()).toBe('2026-10-10T21:00:00.000Z')
    expect(t.resourceOpensAt({ category: 'public', moduleId: 'm3' })!.toISOString()).toBe('2026-10-13T19:00:00.000Z')
    expect(t.resourceOpensAt({ category: 'reading', moduleId: null })!.toISOString()).toBe('2026-10-03T21:00:00.000Z')
  })

  it('واللقاءُ بلا نهايةٍ مكتوبةٍ ساعتان', () => {
    const t = buildTimeline({ slots, sessions: [{ startsAt: '2026-10-13T17:00:00.000Z', moduleIds: ['m3'] }], period: PERIOD })!
    expect(t.workOpensAt('m3')!.toISOString()).toBe('2026-10-13T19:00:00.000Z')
  })

  it('وخطّةٌ بلا مواعيد لا خطَّ لها — تمضي كما بدأت', () => {
    expect(buildTimeline({ slots: [], sessions: [live] })).toBeNull()
    expect(buildTimeline({ slots: undefined, sessions: [] })).toBeNull()
  })
})
