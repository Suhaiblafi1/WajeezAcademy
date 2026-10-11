/* جدولٌ ثابتٌ مقترحٌ بسلسلته (١١ أكتوبر ٢٠٢٦) — `schedule-proposal.ts`.

   قرارُ صاحب المنصّة: «في حال قمنا بتعديل شيءٍ قد يؤثّر على توقيتاتٍ أخرى يجب أن يكون التعديلُ كاملا
   بسلسلة، لكي لا نخرّب بدلَ ما نُصلح». وعمّانُ على +٣: ١٨:٠٠ فيها ١٥:٠٠ بغرينتش.

   ① يومٌ وساعةٌ ثابتان من لقاءاته نفسِها — وكلُّ لقاءٍ في موعد محوره.
   ② والسلسلة: مهمّةُ المحور تتبع لقاءَه، والمشروعُ يبقى بعد آخر لقاءٍ بأسبوع.
   ③ ولا يُقترح ما يُفسد — ولا ما لا حاجةَ إليه. */

import { describe, expect, it } from 'vitest'
import { planScorecard, type ScorecardSession, type ScorecardTask } from '@/application/trainer/plan-scorecard'
import { proposeSchedule, type ScheduleInput } from '@/application/trainer/schedule-proposal'
import { zonedClock, zonedDay } from '@/application/trainer/cohort-period'

const MODS = ['M1', 'M2', 'M3', 'M4']
/** أسبوعٌ لكلّ محور: من السبت إلى الجمعة */
const WEEKS = [['2026-12-05', '2026-12-11'], ['2026-12-12', '2026-12-18'], ['2026-12-19', '2026-12-24'], ['2026-12-26', '2027-01-08']]
const at = (day: string, clock = '15:00') => `${day}T${clock}:00.000Z`
const plus = (iso: string, h: number) => new Date(new Date(iso).getTime() + h * 3_600_000).toISOString()

/** لقاءاتٌ على أربعة مواعيدَ مختلفة: سبت ١٨، اثنين ١٩، أربعاء ١٩، جمعة ١٨ — إيقاعٌ غيرُ ثابت */
function messy(): ScheduleInput & { sessions: (ScorecardSession & { id: string })[]; tasks: (ScorecardTask & { id: string })[] } {
  const starts = [at('2026-12-05'), at('2026-12-14', '16:00'), at('2026-12-23', '16:00'), at('2027-01-01')]
  return {
    period: { startsOn: '2026-11-29', endsOn: '2027-01-30' },
    now: new Date('2026-10-08T09:00:00Z'),
    content: {
      modules: MODS.map((id) => ({ moduleId: id, titleAr: `محور ${id}`, activityAr: 'يحلّ المتعلّمُ حالةً من سوقٍ أردنيّ', artifactAr: 'ورقةُ تحليل' })),
      resources: [{ title: 'ملخّص كتاب', url: 'https://example.com/book', category: 'reading' }, { title: 'TEDx', url: 'https://youtube.com/x', category: 'public' }],
      slots: MODS.map((id, i) => ({ moduleIds: [id], startsOn: WEEKS[i]![0], endsOn: WEEKS[i]![1] })),
    },
    sessions: starts.map((s, i) => ({ id: `s${i + 1}`, startsAt: s, endsAt: plus(s, 2), moduleIds: [MODS[i]!] })),
    tasks: [
      ...starts.map((s, i) => ({
        id: `t${i + 1}`, title: `واجب ${i + 1}`, type: 'assignment', moduleId: MODS[i]!, maxScore: 10,
        briefAr: 'حلّل الحالةَ وسلّم ورقةً من صفحتين', dueAt: plus(s, 24 * 4),
      })),
      { id: 'p', title: 'مشروع التخرّج', type: 'project', dueAt: '2027-01-25T20:59:00.000Z', maxScore: 100, briefAr: 'مشروعٌ يجمع المحاورَ كلَّها' },
    ],
  }
}

const applied = (input: ReturnType<typeof messy>, edit: { moves: { sessionId: string; startsAt: string; endsAt: string }[]; tasks: { assessmentId: string; dueAt: string }[] }) => ({
  ...input,
  sessions: input.sessions.map((s) => { const m = edit.moves.find((x) => x.sessionId === s.id); return m ? { ...s, startsAt: m.startsAt, endsAt: m.endsAt } : s }),
  tasks: input.tasks.map((t) => { const m = edit.tasks.find((x) => x.assessmentId === t.id); return m ? { ...t, dueAt: m.dueAt } : t }),
})

describe('① يومٌ وساعةٌ ثابتان — وكلُّ لقاءٍ في موعد محوره', () => {
  it('⚠️ أكثرُ موعدٍ يصلح — السبتُ ١٨:٠٠ — لكلّ لقاء، داخلَ أسبوع محوره وبلا عطلة', () => {
    const input = messy()
    const r = proposeSchedule(input)
    expect(r.ok, r.ok ? '' : r.reasonAr).toBe(true)
    if (!r.ok) return
    expect([r.edit.weekday, r.edit.clock]).toEqual([6, '18:00'])
    const after = applied(input, r.edit)
    const days = after.sessions.map((s) => zonedDay(s.startsAt))
    expect(days).toEqual(['2026-12-05', '2026-12-12', '2026-12-19', '2027-01-02'])
    expect(after.sessions.every((s) => zonedClock(s.startsAt) === '18:00')).toBe(true)
    /* ولا يُنقل ما هو على الموعد أصلا — ويبقى طولُ كلّ لقاء */
    expect(r.edit.moves.map((m) => m.sessionId)).toEqual(['s2', 's3', 's4'])
    expect(r.edit.moves.every((m) => Date.parse(m.endsAt) - Date.parse(m.startsAt) === 2 * 3_600_000)).toBe(true)
    /* و١ يناير عطلةٌ — فلقاءُ المحور الرابع في السبت بعده، داخلَ موعده */
    expect(days).not.toContain('2027-01-01')
  })
})

/** شعبةٌ بمواعيدِ محاورَ ولقاءاتٍ تُكتب بأيّامها وساعاتها (بتوقيت عمّان) — بلا مهامّ */
function shaped(slots: [string, string][], starts: [string, string][]): ReturnType<typeof messy> {
  const base = messy()
  const mods = slots.map((_, i) => `M${i + 1}`)
  const utc = (day: string, clock: string) => {
    const [h, m] = clock.split(':').map(Number)
    return new Date(Date.parse(`${day}T00:00:00.000Z`) + ((h! - 3) * 60 + m!) * 60_000).toISOString()
  }
  return {
    ...base,
    content: { ...(base.content as object), slots: slots.map(([a, b], i) => ({ moduleIds: [mods[i]!], startsOn: a, endsOn: b })) },
    sessions: starts.map(([d, c], i) => ({ id: `s${i + 1}`, startsAt: utc(d, c), endsAt: plus(utc(d, c), 2), moduleIds: [mods[i]!] })),
    tasks: [],
  }
}

describe('①ب الأكثرُ تكرارا لا الأوّل — والأقربُ لا الأبعد — وبلا عطلة', () => {
  it('⚠️ السبتُ ١٨:٠٠ مرّتين بعد أربعاءَ أوّل — فهو الموعد؛ وكلُّ لقاءٍ إلى أقرب سبتٍ في موعد محوره', () => {
    const input = shaped(
      [['2026-12-01', '2026-12-07'], ['2026-12-08', '2026-12-14'], ['2026-12-15', '2026-12-21'], ['2026-12-22', '2027-01-15']],
      [['2026-12-02', '19:00'], ['2026-12-12', '18:00'], ['2026-12-19', '18:00'], ['2026-12-27', '19:00']],
    )
    const r = proposeSchedule(input)
    if (!r.ok) throw new Error(r.reasonAr)
    expect([r.edit.weekday, r.edit.clock]).toEqual([6, '18:00'])
    /* محورُ الرابع إلى ١٥ يناير: فيه ٢٦ ديسمبر و٢ و٩ يناير — والأقربُ من ٢٧ ديسمبر أوّلُها */
    expect(applied(input, r.edit).sessions.map((s) => zonedDay(s.startsAt))).toEqual(['2026-12-05', '2026-12-12', '2026-12-19', '2026-12-26'])
    expect(r.edit.moves.map((m) => m.sessionId)).toEqual(['s1', 's4'])
  })

  it('⚠️ الجمعةُ موعدا: ٢٥ ديسمبر و١ يناير جمعتان وعطلتان — فلا يقع عليهما لقاء', () => {
    const input = shaped(
      [['2026-12-01', '2026-12-07'], ['2026-12-08', '2026-12-14'], ['2026-12-15', '2026-12-31'], ['2027-01-01', '2027-01-15']],
      [['2026-12-04', '18:00'], ['2026-12-11', '18:00'], ['2026-12-24', '19:00'], ['2027-01-04', '19:00']],
    )
    const r = proposeSchedule(input)
    if (!r.ok) throw new Error(r.reasonAr)
    expect([r.edit.weekday, r.edit.clock]).toEqual([5, '18:00'])
    /* أقربُ جمعةٍ إلى ٢٤ ديسمبر ٢٥ منه — عطلة؛ فالتي قبلها. وأقربُ جمعةٍ في المحور الرابع ١ يناير — عطلة؛ فالتي بعدها */
    expect(applied(input, r.edit).sessions.map((s) => zonedDay(s.startsAt))).toEqual(['2026-12-04', '2026-12-11', '2026-12-18', '2027-01-08'])
  })
})

describe('② والسلسلة', () => {
  it('⚠️ مهمّةُ كلّ محورٍ تنتقل بقدر ما انتقل لقاؤه — فتبقى بعده بأيّامها', () => {
    const input = messy()
    const r = proposeSchedule(input)
    if (!r.ok) throw new Error(r.reasonAr)
    const after = applied(input, r.edit)
    for (let i = 0; i < 4; i++) {
      const s = after.sessions[i]!; const t = after.tasks[i]!
      expect(Math.round((Date.parse(t.dueAt as string) - Date.parse(s.startsAt as string)) / 86_400_000), `مهمّةُ المحور ${i + 1}`).toBe(4)
    }
    expect(r.edit.tasks.map((t) => t.assessmentId)).toEqual(['t2', 't3', 't4'])
  })

  it('⚠️ والمشروعُ يبقى بعد آخر لقاءٍ بأسبوع — يُؤخَّر معه إن لزم، داخلَ المدّة', () => {
    const input = messy()
    input.tasks = input.tasks.map((t) => (t.type === 'project' ? { ...t, dueAt: '2027-01-08T20:59:00.000Z' } : t))
    const r = proposeSchedule(input)
    if (!r.ok) throw new Error(r.reasonAr)
    const p = r.edit.tasks.find((t) => t.assessmentId === 'p')
    expect(p, 'المشروعُ لم يتبع آخرَ لقاء').toBeTruthy()
    expect(zonedDay(p!.dueAt)).toBe('2027-01-09')
  })

  it('⚠️ والبطاقةُ بعده أحسنُ في الإيقاع، ولا يسوء فيها معيارُ توقيت', () => {
    const input = messy()
    const r = proposeSchedule(input)
    if (!r.ok) throw new Error(r.reasonAr)
    const score = (x: ReturnType<typeof messy>) => new Map(planScorecard({ ...x, assessments: x.tasks }).map((i) => [i.key, i.gaps.length]))
    const b = score(input); const a = score(applied(input, r.edit))
    expect(a.get('rhythm')).toBe(0)
    expect(b.get('rhythm')).toBeGreaterThan(0)
    for (const k of ['session_times', 'session_gaps', 'weekly_load', 'task_timing', 'project_time']) expect(a.get(k)!, k).toBeLessThanOrEqual(b.get(k)!)
  })
})

describe('③ ولا يُقترح ما يُفسد ولا ما لا حاجةَ إليه', () => {
  it('⚠️ جدولٌ ثابتٌ أصلا — لا اقتراح، ويُقال لماذا', () => {
    const input = messy()
    input.sessions = input.sessions.map((s, i) => {
      const d = ['2026-12-05', '2026-12-12', '2026-12-19', '2027-01-02'][i]!
      return { ...s, startsAt: at(d), endsAt: plus(at(d), 2) }
    })
    const r = proposeSchedule(input)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reasonAr).toMatch(/ثابتين/)
  })

  it('⚠️ ولا يُخرج لقاءً من موعد محوره — إن لم يقع اليومُ فيه قيل ذلك ولم يُقترح شيء', () => {
    const input = messy()
    const slots = (input.content as { slots: { startsOn: string; endsOn: string; moduleIds: string[] }[] }).slots
    slots[1] = { ...slots[1]!, startsOn: '2026-12-13', endsOn: '2026-12-17' }
    const r = proposeSchedule(input)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reasonAr).toMatch(/رتّب مواعيدَ المحاور أوّلا/)
  })

  it('⚠️ ولا يُقترح جدولٌ يُسيء معيارَ توقيتٍ آخر — ولو أصلح الإيقاع: فاصلٌ يتجاوز ٢١ يوما', () => {
    const input = shaped(
      [['2026-12-01', '2026-12-07'], ['2026-12-08', '2026-12-14'], ['2026-12-15', '2026-12-31'], ['2027-01-09', '2027-01-15']],
      [['2026-12-04', '18:00'], ['2026-12-11', '18:00'], ['2026-12-24', '19:00'], ['2027-01-11', '19:00']],
    )
    /* الجمعةُ ١٨ ديسمبر ثمّ الجمعةُ ١٥ يناير: ٢٨ يوما — وكانت ١٨ */
    const r = proposeSchedule(input)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reasonAr).toMatch(/يُسيء «الفاصلُ بين اللقاءات»/)
  })

  it('ولقاءٌ واحدٌ لا جدولَ له — ولو في وقتٍ غيرِ مناسب: نقلُه بندٌ واحدٌ لا جدول', () => {
    const input = shaped([['2026-12-01', '2026-12-31']], [['2026-12-07', '15:00']])
    const r = proposeSchedule(input)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reasonAr).toMatch(/أقلُّ من لقاءين/)
  })
})
