/* خطُّ المحاور — المواعيدُ وما يُفتح في كلٍّ منها.

   قرارُ صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦) وقراراتُه العشرة بكلمة «go». والعلّةُ
   كاملةً في رأس `src/application/trainer/axis-timeline.ts`.

   والتواريخُ هي مثالُ العرض نفسُه: دورةٌ بثمانية محاور من ٤ أكتوبر إلى
   ٨ نوفمبر ٢٠٢٦. وعمّانُ على +٣ طوالَ السنة، فمنتصفُ ليلها التاسعةُ مساءَ
   أمسه بغرينتش. */

import { describe, expect, it } from 'vitest'
import {
  addAxisToSlots, appendToSlots, axisTimeProblem, buildTimeline, canMerge, crowdedSlots, dayInSlot, defaultSlots,
  dropFromSlots, joinClosesAt, mergeSlots, minSlots, reflowSlots, respreadSlots, sameSlots, sessionProblems,
  slotProblems, slotSessionTips, splitSlot, workbookDone, workbookProblems, type PlanSlot,
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

  /* ═══ نُسخ السقف (٤ أكتوبر ٢٠٢٦): «يربطها بمحورٍ أو اثنين أو أكثر… لكن لا تدعه يضع
     لقاءً لمحورٍ في غير وقته» — فالعددُ حرٌّ، والوقتُ حدٌّ ═══ */
  it('⚠️ واللقاءُ لمحورٍ أو أكثر من موعده بلا سقف — ولا لمحاورَ من مواعيدَ مختلفة', () => {
    /* الموعدان الأوّلان مجموعان: ١+٢+٣ في موعدٍ واحد، فلقاءٌ واحدٌ لها ثلاثتها */
    const merged = mergeSlots(slots, 0)
    const rest = full.filter((x) => !x.moduleIds.includes('m1') && !x.moduleIds.includes('m3'))
    const three = sessionProblems({ slots: merged, moduleIds: EIGHT, sessions: [at('2026-10-05', ['m1', 'm2', 'm3'], 'ثلاثي'), ...rest] })
    expect(three).toEqual({ blocking: [], warnings: [] })
    const across = sessionProblems({ slots, moduleIds: EIGHT, sessions: [...full, at('2026-10-05', ['m2', 'm3'], 'عابر')] })
    expect(across.blocking.join()).toContain('«عابر» يجمع محاورَ من مواعيدَ مختلفة')
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

  /* ═══ وما انعقد واقعةٌ لا مسودّة ═══
     لقاءٌ انتهى لا يُنقل ولا يُحذف إن حضره أحد — فلو حُوسب بالربط والموعد
     لبقيت شعبةٌ جاريةٌ حبيسةً خطوتَها لا تستطيع إصلاحَه ولا التخلّصَ منه. */
  it('⚠️ لقاءٌ انعقد بلا محورٍ أو خارجَ موعده لا يمنع — ويُحسب لمحوره إن رُبط', () => {
    const held = { title: 'انعقد', startsAt: '2026-09-01T17:00:00.000Z', endsAt: '2026-09-01T19:00:00.000Z', moduleIds: [] as string[] }
    const NOW = new Date('2026-10-20T12:00:00.000Z')
    expect(sessionProblems({ slots, moduleIds: EIGHT, sessions: [...full, held], now: NOW }).blocking, 'حُوسب ما انعقد').toEqual([])
    /* وبلا لحظةٍ يُحكم بها لا يُعفى شيء — فالإعفاءُ لما مضى فعلا لا لكلّ لقاء */
    expect(sessionProblems({ slots, moduleIds: EIGHT, sessions: [...full, held] }).blocking.join()).toContain('«انعقد» غيرُ مربوطٍ بمحور')
    /* والمنعقدُ المربوطُ يُحسب لمحوره: لقاءُ ١+٢ مضى فلا يُطلب لهما لقاءٌ جديد */
    const heldFirst = { ...full[0], startsAt: '2026-10-04T17:00:00.000Z', endsAt: '2026-10-04T19:00:00.000Z' }
    expect(sessionProblems({ slots, moduleIds: EIGHT, sessions: [heldFirst, ...full.slice(1)], now: NOW }).blocking).toEqual([])
    /* والقادمُ بلا محورٍ يُحاسَب وإن حُكم بلحظة */
    const soon = { ...held, title: 'قادم', startsAt: '2026-10-21T17:00:00.000Z', endsAt: '2026-10-21T19:00:00.000Z' }
    expect(sessionProblems({ slots, moduleIds: EIGHT, sessions: [...full, soon], now: NOW }).blocking.join()).toContain('«قادم» غيرُ مربوطٍ بمحور')
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

/* ═══ اللقاءُ في وقت محاوره — القاعدةُ التي يردّ بها الخادمُ الإضافةَ والربط ═══ */
describe('اللقاءُ في وقت محاوره (`axisTimeProblem`)', () => {
  const slots = defaultSlots(EIGHT, PERIOD)
  const pos = new Map(EIGHT.map((id, i) => [id, i + 1]))
  const s = (day: string, moduleIds: string[]) => ({ startsAt: `${day}T17:00:00.000Z`, endsAt: `${day}T19:00:00.000Z`, moduleIds })

  it('في وقته: لا شيء — محورا كان أو محاورَ موعده كلَّها', () => {
    expect(axisTimeProblem(s('2026-10-05', ['m1']), slots, pos)).toBeNull()
    expect(axisTimeProblem(s('2026-10-05', ['m1', 'm2']), slots, pos)).toBeNull()
  })

  it('⚠️ ومن مواعيدَ مختلفة: يُسمّى كلُّ محورٍ بموعده', () => {
    expect(axisTimeProblem(s('2026-10-05', ['m2', 'm3', 'm4']), slots, pos)).toBe(
      'اللقاء يجمع محاورَ من مواعيدَ مختلفة (المحور 2 في الموعد 1، والمحور 3 في الموعد 2، والمحور 4 في الموعد 3) — اللقاءُ في وقت محاوره: اربطه بمحاور موعدٍ واحد، أو اجمع مواعيدَها في «المحاور ومواعيدها»',
    )
  })

  it('⚠️ وخارجَ موعدها: يُقال الموعدُ بحدّيه — ونهايتُه بعد آخره خروجٌ كذلك', () => {
    expect(axisTimeProblem(s('2026-10-12', ['m1', 'm2']), slots, pos)).toBe('اللقاء خارجَ موعد المحوران 1+2 (4 أكتوبر – 10 أكتوبر)')
    /* العاشرةُ ليلا بعمّان آخرَ يوم، ساعتان: ينتهي بعد منتصف الليل */
    const late = { startsAt: '2026-10-10T19:00:00.000Z', endsAt: '2026-10-10T21:30:00.000Z', moduleIds: ['m1'] }
    expect(axisTimeProblem(late, slots, pos)).toContain('خارجَ موعد')
  })

  it('ولا يُحكم بما لا يُعرف وقتُه: بلا محور، أو محورٌ ليس في الخطّة، أو محورٌ بلا موعد', () => {
    expect(axisTimeProblem(s('2026-10-05', []), slots, pos)).toBeNull()
    expect(axisTimeProblem(s('2026-10-05', ['zz']), slots, pos)).toBeNull()
    expect(axisTimeProblem(s('2026-10-05', ['m1']), dropFromSlots(slots, 'm1'), pos)).toBeNull()
  })
})

/* ═══ «+ محور» لا يكدّس في آخر موعد — العطبُ الذي رفعه صاحبُ المنصّة (٤ أكتوبر ٢٠٢٦) ═══ */
describe('المحورُ الجديدُ لا يُكدَّس في آخر موعد', () => {
  const FOUR = ['c1', 'c2', 'c3', 'c4']
  const MONTH = { startsOn: '2026-10-18', endsOn: '2026-11-14' }

  it('⚠️ الحالةُ المرفوعة: أربعةُ محاورِ الكتالوج ثمّ اثنا عشر — لا «4+5+…+16» في الموعد الرابع', () => {
    let ids = [...FOUR]
    let slots = defaultSlots(ids, MONTH)
    for (let k = 5; k <= 16; k++) {
      ids = [...ids, `t${k}`]
      slots = addAxisToSlots(slots, ids, MONTH)
    }
    expect(slots.map((x) => x.moduleIds.length), 'كُدّست المحاورُ في موعدٍ واحد').toEqual([4, 4, 4, 4])
    expect(sameSlots(slots, defaultSlots(ids, MONTH))).toBe(true)
    expect(slotProblems(slots, ids, MONTH)).toEqual([])
    /* وما كان يقع قبلُ: الإلحاقُ بآخر موعد — وهو ما يُقال عنه «مزدحم» */
    let piled = defaultSlots(FOUR, MONTH)
    for (let k = 5; k <= 16; k++) piled = appendToSlots(piled, `t${k}`)
    expect(piled.at(-1)!.moduleIds).toHaveLength(13)
    expect(crowdedSlots(piled)).toEqual([3])
  })

  it('⚠️ وما رتّبه المدرّبُ بيده لا يُمسّ — يلحق الجديدُ آخرَه كما كان', () => {
    const custom = splitSlot(defaultSlots(EIGHT, PERIOD), 0, 1)
    const next = addAxisToSlots(custom, [...EIGHT, 'm9'], PERIOD)
    expect(next.slice(0, -1)).toEqual(custom.slice(0, -1))
    expect(next.at(-1)!.moduleIds).toEqual(['m7', 'm8', 'm9'])
  })

  it('وبلا مدّةٍ أو بلا مواعيد: كما كان', () => {
    const slots = defaultSlots(EIGHT, PERIOD)
    expect(addAxisToSlots(slots, [...EIGHT, 'm9'], null).at(-1)!.moduleIds).toEqual(['m7', 'm8', 'm9'])
    expect(addAxisToSlots([], [...EIGHT, 'm9'], PERIOD)).toEqual([])
  })

  it('والتوزيعُ من جديدٍ يحمل الكرّاسةَ القديمةَ مع أوّل محاور موعدها', () => {
    const old = defaultSlots(EIGHT, PERIOD).map((x, i) => ({ ...x, workbook: { url: `https://x.org/${i}` } }))
    const next = respreadSlots(old, [...EIGHT, 'm9'], PERIOD)
    expect(next[0].workbook).toEqual({ url: 'https://x.org/0' })
    expect(next.every((x) => x.moduleIds.length > 0)).toBe(true)
  })

  it('والمزدحمُ: ثلاثةٌ فأكثر، وضعفُ النصيب العادل فأكثر — والتوزيعُ الأوّلُ لا يزدحم', () => {
    expect(crowdedSlots(defaultSlots(EIGHT, PERIOD))).toEqual([])
    const ten = Array.from({ length: 10 }, (_, i) => `x${i + 1}`)
    expect(crowdedSlots(defaultSlots(ten, { startsOn: '2026-10-04', endsOn: '2026-10-24' }))).toEqual([])
    /* ١ · ٢ · ٣ · ٤+٥+٦+٧: النصيبُ اثنان، والرابعُ أربعة */
    const seven = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    let s = defaultSlots(seven.slice(0, 4), PERIOD)
    for (const id of seven.slice(4)) s = appendToSlots(s, id)
    expect(crowdedSlots(s)).toEqual([3])
    expect(crowdedSlots([s[0]])).toEqual([])
  })
})

/* ═══ نصائحُ لا موانع — «لا تُكثر من اللقاءات، أو اجمعها» (٤ أكتوبر ٢٠٢٦) ═══ */
describe('نصائحُ الموعد', () => {
  const at = (iso: string) => ({ startsAt: iso })

  it('لقاءٌ لكلّ محور: لا نصيحة', () => {
    expect(slotSessionTips({ axes: 2, sessions: [at('2026-10-04T17:00:00Z'), at('2026-10-05T17:00:00Z')] })).toEqual([])
    expect(slotSessionTips({ axes: 1, sessions: [at('2026-10-04T17:00:00Z')] })).toEqual([])
  })

  it('⚠️ لقاءاتٌ أكثرُ من محاوره: تُقال بصيغة العدد، ولا تمنع', () => {
    const tips = slotSessionTips({ axes: 1, sessions: [at('2026-10-04T17:00:00Z'), at('2026-10-06T17:00:00Z'), at('2026-10-08T17:00:00Z')] })
    expect(tips.map((t) => t.kind)).toEqual(['many'])
    expect(tips[0].textAr).toContain('3 لقاءات لمحورٍ واحد')
    expect(slotSessionTips({ axes: 2, sessions: [1, 2, 3].map((d) => at(`2026-10-0${d}T17:00:00Z`)) })[0].textAr).toContain('3 لقاءات لمحورين')
  })

  it('⚠️ ولقاءان في يومٍ واحدٍ بعمّان: يُقترح جمعُهما', () => {
    /* الحادية عشرة ليلا بغرينتش يومَ ٤ هي الثانيةُ فجرَ ٥ بعمّان — يومٌ آخر */
    expect(slotSessionTips({ axes: 3, sessions: [at('2026-10-04T08:00:00Z'), at('2026-10-04T23:00:00Z')] })).toEqual([])
    const same = slotSessionTips({ axes: 3, sessions: [at('2026-10-04T08:00:00Z'), at('2026-10-04T17:00:00Z')] })
    expect(same.map((t) => t.kind)).toEqual(['same_day'])
    expect(same[0].textAr).toContain('4 أكتوبر')
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

/* آخرُ الالتحاق — «التسجيلُ يُغلق يومَ البدء، والالتحاقُ المتأخّرُ حتّى الموعد
   الثاني» (٣ج). وأثرُه في المواضع الستّة في `registration-window.test.ts` */
describe('آخرُ الالتحاق — بدءُ الموعد الثاني', () => {
  const slots = defaultSlots(EIGHT, PERIOD)

  it('⚠️ منتصفُ ليل أوّلِ يومٍ في الموعد الثاني بعمّان', () => {
    /* الموعدُ الثاني يبدأ الأحد ١١ أكتوبر — وعمّانُ +٣، فمنتصفُ ليلها ٢١:٠٠ يومَ ١٠ */
    expect(joinClosesAt(PERIOD, slots)?.toISOString()).toBe('2026-10-10T21:00:00.000Z')
  })

  it('⚠️ بترتيب البدء لا بترتيب الحفظ', () => {
    const shuffled = [slots[3], slots[0], slots[4], slots[1], slots[2]]
    expect(joinClosesAt(PERIOD, shuffled)?.toISOString()).toBe('2026-10-10T21:00:00.000Z')
  })

  it('⚠️ وموعدٌ واحدٌ لا ثانيَ له يُغلقه يومَ البدء', () => {
    const one: PlanSlot[] = [{ startsOn: PERIOD.startsOn, endsOn: PERIOD.endsOn, moduleIds: ['m1'] }]
    expect(joinClosesAt(PERIOD, one)?.toISOString()).toBe('2026-10-03T21:00:00.000Z')
  })

  it('وبلا مواعيدَ لا حدّ — وموعدٌ بلا تاريخٍ صحيحٍ لا يُعدّ', () => {
    expect(joinClosesAt(PERIOD, [])).toBeNull()
    expect(joinClosesAt(PERIOD, undefined)).toBeNull()
    /* والمعطوبُ يقع بعد الصحيح في الترتيب — فلو عُدّ لكان هو «الثاني» */
    const broken: PlanSlot[] = [slots[0], { startsOn: '2026-10-40', endsOn: '2026-10-41', moduleIds: ['m3'] }]
    expect(joinClosesAt(PERIOD, broken)?.toISOString(), 'موعدٌ معطوبٌ عُدّ ثانيا').toBe('2026-10-03T21:00:00.000Z')
  })
})
