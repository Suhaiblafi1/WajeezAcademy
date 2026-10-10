/* بطاقةُ المعايير (٨ أكتوبر ٢٠٢٦) — المُلزِمُ أقلُّه، والنصيحةُ تُقال بسببها.

   تُبنى خطّةٌ تامّةٌ تمرّ بكلّ معيار، ثمّ يُنقض منها شيءٌ واحدٌ في كلّ اختبار
   فيُرى المعيارُ الذي يسقط وحالتُه: `blocked` للمُلزِم و`advice` للنصيحة —
   ولا يسقط معه غيرُه. وعمّانُ على +٣ طوالَ الشتاء: ١٨:٠٠ فيها ١٥:٠٠ بغرينتش. */

import { describe, expect, it } from 'vitest'
import {
  artifactGaps, blockedItems, daysAr, hoursAr, planScorecard, practiceGaps, projectDeadlineProblem, scorecardNotes, seasonEndProblem,
  seasonLastDay, sourceGaps, type ScorecardInput, type ScorecardSession, type ScorecardTask,
} from '@/application/trainer/plan-scorecard'
import { REVIEW_NOTE_MAX } from '@/application/trainer/review-notes'

/** مدخلٌ يُعدَّل في الاختبار — والبطاقةُ تقرؤه للقراءة وحدَها */
type Draft = Omit<ScorecardInput, 'sessions' | 'assessments'> & { sessions: ScorecardSession[]; assessments: ScorecardTask[] }

const MODS = ['M1', 'M2', 'M3', 'M4']
/** أربعةُ سبوت، السادسة مساءً بعمّان، ساعتان — بدءا من ٥ ديسمبر */
const SATURDAYS = ['2026-12-05', '2026-12-12', '2026-12-19', '2026-12-26']
const at = (day: string, clock = '15:00') => `${day}T${clock}:00.000Z`
const plus = (iso: string, h: number) => new Date(new Date(iso).getTime() + h * 3_600_000).toISOString()

function good(): Draft {
  return {
    period: { startsOn: '2026-11-29', endsOn: '2027-01-30' },
    now: new Date('2026-10-08T09:00:00Z'),
    content: {
      modules: MODS.map((id) => ({
        moduleId: id, titleAr: `محور ${id}`,
        activityAr: 'يحلّ المتعلّمُ حالةً من سوقٍ أردنيّ', artifactAr: 'ورقةُ تحليلٍ من صفحتين',
      })),
      resources: MODS.flatMap((id) => [
        { title: `ملخّص كتاب ${id}`, url: 'https://example.com/book', category: 'reading', moduleId: id },
        { title: `محاضرة TEDx ${id}`, url: 'https://youtube.com/x', category: 'public', moduleId: id },
      ]),
    },
    sessions: SATURDAYS.map((d, i) => ({ startsAt: at(d), endsAt: plus(at(d), 2), moduleIds: [MODS[i]!] })),
    assessments: [
      ...SATURDAYS.map((d, i) => ({
        title: `واجب ${i + 1}`, type: 'assignment', moduleId: MODS[i]!, maxScore: 10,
        briefAr: 'حلّل الحالةَ المرفقة وسلّم ورقةً من صفحتين بنتائجك', dueAt: plus(at(d), 24 * 5),
      })),
      { title: 'مشروع التخرّج', type: 'project', dueAt: '2027-01-25T20:59:00.000Z', maxScore: 100, briefAr: 'مشروعٌ يجمع المحاورَ كلَّها في خطّةٍ واحدة' },
    ],
  }
}

const card = (input: ScorecardInput) => new Map(planScorecard(input).map((i) => [i.key, i]))
const failing = (input: ScorecardInput) => planScorecard(input).filter((i) => i.status !== 'ok').map((i) => `${i.key}:${i.status}`)

describe('الخطّةُ التامّة', () => {
  it('تمرّ بكلّ معيار — ولا شيءَ يُنصَح به ولا يمنع', () => {
    expect(failing(good())).toEqual([])
  })

  it('وتُقاس ساعاتُها ومهامُّها ولا تُفترَض', () => {
    const c = card(good())
    expect(c.get('live_hours')!.measuredAr).toBe('4 لقاءات — 8 ساعات')
    expect(c.get('graded_tasks')!.measuredAr).toContain('4 مهامَّ مقيَّمة')
  })
})

describe('المُلزِمُ الأربعة — تسقط `blocked`', () => {
  it('① شعبةُ الشتاء تنتهي في ٣٠ يناير على الأكثر', () => {
    const i = good()
    i.period = { startsOn: '2026-11-29', endsOn: '2027-01-31' }
    expect(failing(i)).toEqual(['end_date:blocked'])
    expect(seasonLastDay('2026-12-10')).toBe('2027-01-30')
    expect(seasonLastDay('2027-01-03')).toBe('2027-01-30')
    /* والمواسمُ الأخرى بلا حدٍّ حتّى يُقرَّر لها */
    expect(seasonLastDay('2027-02-15')).toBeNull()
    expect(seasonEndProblem({ startsOn: '2027-02-15', endsOn: '2027-04-30' })).toBeNull()
  })

  it('② مشروعُ التخرّج بموعدٍ، والموعدُ داخلَ الشعبة', () => {
    const none = good()
    none.assessments = none.assessments.map((t) => (t.type === 'project' ? { ...t, dueAt: null } : t))
    expect(failing(none)).toContain('project:blocked')

    const late = good()
    late.period = { startsOn: '2026-11-29', endsOn: '2027-01-20' }
    expect(failing(late)).toEqual(['project:blocked'])
    expect(projectDeadlineProblem([{ dueAt: '2027-01-25T20:59:00.000Z' }], late.period)).toContain('بعد نهاية الشعبة')

    const missing = good()
    missing.assessments = missing.assessments.filter((t) => t.type !== 'project')
    expect(failing(missing)).toEqual(['project:blocked'])
  })

  it('③ لكلّ محورٍ تطبيقٌ عمليّ — جملةٌ لا حرف', () => {
    const i = good()
    const mods = (i.content as { modules: { activityAr: string; artifactAr: string }[] }).modules
    mods[1]!.activityAr = 'x'
    expect(failing(i)).toEqual(['practice:blocked'])
    expect(practiceGaps(mods as never)).toEqual(['المحور 2: بلا تطبيقٍ عمليّ'])
  })

  it('③ب والمُسلَّمُ نصيحةٌ لا تمنع (١٠ أكتوبر ٢٠٢٦) — حقلُه «اختياريّ» في الشاشة', () => {
    const i = good()
    const mods = (i.content as { modules: { activityAr: string; artifactAr: string }[] }).modules
    mods[2]!.artifactAr = ''
    mods[3]!.artifactAr = 'تقرير'
    expect(failing(i)).toEqual(['artifact:advice'])
    expect(blockedItems(planScorecard(i))).toEqual([])
    expect(artifactGaps(mods as never)).toEqual(['المحور 3: بلا مُسلَّم', 'المحور 4: بلا مُسلَّم'])
    expect(practiceGaps(mods as never)).toEqual([])
  })

  it('④ لكلّ محورٍ مصدر — والمسجَّلُ والمصدرُ بلا رابطٍ لا يُحسبان', () => {
    const i = good()
    const c = i.content as { modules: { moduleId: string }[]; resources: Record<string, unknown>[] }
    c.resources = c.resources.filter((r) => r.moduleId !== 'M3')
    c.resources.push({ title: 'جلسةٌ مسجّلة', url: 'https://v', category: 'recorded', moduleId: 'M3' })
    c.resources.push({ title: 'بلا رابط', url: '', category: 'reading', moduleId: 'M3' })
    expect(failing(i)).toEqual(['sources:blocked'])
    expect(sourceGaps(c.modules, c.resources)).toEqual(['المحور 3: بلا مصدر'])
  })

  it('وما كان مُلزِما قبلها: لقاءٌ لكلّ محور', () => {
    const i = good()
    i.sessions = i.sessions.map((s, n) => (n === 3 ? { ...s, moduleIds: ['M3'] } : s))
    expect(failing(i)).toContain('live_per_module:blocked')
  })

  it('والمانعُ من البطاقة هو المُلزِمُ الساقطُ وحدَه', () => {
    const i = good()
    i.period = { startsOn: '2026-11-29', endsOn: '2027-02-10' }
    i.sessions = i.sessions.slice(0, 1).map((s) => ({ ...s, moduleIds: MODS }))
    expect(blockedItems(planScorecard(i)).map((x) => x.key)).toEqual(['end_date'])
  })
})

describe('النصيحة — تسقط `advice` ولا تمنع', () => {
  it('ساعاتٌ أقلُّ من ساعتين لكلّ محور', () => {
    const i = good()
    i.sessions = [{ startsAt: at('2026-12-05'), endsAt: plus(at('2026-12-05'), 3), moduleIds: MODS }]
    const f = failing(i)
    expect(f).toContain('live_hours:advice')
    expect(card(i).get('live_hours')!.gaps).toEqual(['ينقصها 5 ساعات'])
  })

  it('لقاءٌ أطولُ من ثلاث ساعات', () => {
    const i = good()
    i.sessions[0] = { ...i.sessions[0]!, endsAt: plus(at(SATURDAYS[0]!), 4) }
    expect(failing(i)).toEqual(['session_length:advice'])
  })

  it('فاصلٌ أقلُّ من أسبوع، وفاصلٌ أطولُ من ثلاثة أسابيع', () => {
    const near = good()
    near.sessions[1] = { ...near.sessions[1]!, startsAt: at('2026-12-08'), endsAt: plus(at('2026-12-08'), 2) }
    expect(failing(near)).toContain('session_gaps:advice')
    expect(card(near).get('session_gaps')!.gaps.join()).toContain('بعد 3 أيّام من سابقه')

    const far = good()
    far.sessions[3] = { ...far.sessions[3]!, startsAt: at('2027-01-23'), endsAt: plus(at('2027-01-23'), 2) }
    expect(failing(far)).toContain('session_gaps:advice')
  })

  it('أكثرُ من أربع ساعاتٍ في سبعة أيّام', () => {
    const i = good()
    i.sessions.push({ startsAt: at('2026-12-07'), endsAt: plus(at('2026-12-07'), 3), moduleIds: ['M1'] })
    expect(failing(i)).toContain('weekly_load:advice')
  })

  it('في ساعات العمل، أو ينتهي بعد العاشرة والنصف', () => {
    const work = good()
    /* الأحدُ ٦ ديسمبر العاشرةَ صباحا بعمّان */
    work.sessions.push({ startsAt: at('2026-12-06', '07:00'), endsAt: plus(at('2026-12-06', '07:00'), 2), moduleIds: ['M1'] })
    expect(failing(work)).toContain('session_times:advice')

    const late = good()
    /* السبتُ التاسعةَ مساءً إلى الحادية عشرة */
    late.sessions[0] = { ...late.sessions[0]!, startsAt: at(SATURDAYS[0]!, '18:00'), endsAt: plus(at(SATURDAYS[0]!, '18:00'), 2) }
    expect(card(late).get('session_times')!.gaps.join()).toContain('ينتهي في 23:00')
  })

  it('عيدُ الميلاد عطلةٌ رسميّة، وثلاثةُ مواعيدَ أسبوعيّةٍ ليست إيقاعا', () => {
    const i = good()
    i.sessions[2] = { ...i.sessions[2]!, startsAt: at('2026-12-25'), endsAt: plus(at('2026-12-25'), 2) }
    expect(card(i).get('rhythm')!.gaps.join()).toContain('عيد الميلاد')

    const mixed = good()
    mixed.sessions[1] = { ...mixed.sessions[1]!, startsAt: at('2026-12-12', '16:00'), endsAt: plus(at('2026-12-12', '16:00'), 2) }
    mixed.sessions[2] = { ...mixed.sessions[2]!, startsAt: at('2026-12-18', '15:00'), endsAt: plus(at('2026-12-18', '15:00'), 2) }
    expect(card(mixed).get('rhythm')!.gaps[0]).toMatch(/^3 مواعيدَ مختلفة/)
  })

  it('مشروعٌ بعد آخر لقاءٍ بأقلَّ من أسبوع', () => {
    const i = good()
    i.assessments = i.assessments.map((t) => (t.type === 'project' ? { ...t, dueAt: '2026-12-29T20:59:00.000Z' } : t))
    expect(failing(i)).toEqual(['project_time:advice'])
  })

  it('محورٌ بلا مهمّةٍ مقيَّمة، ومهمّةٌ قبل أن يُشرح محورُها أو بلا وصف', () => {
    const i = good()
    i.assessments = i.assessments.filter((t) => t.moduleId !== 'M4')
    expect(failing(i)).toEqual(['graded_tasks:advice'])

    const early = good()
    early.assessments[0] = { ...early.assessments[0]!, dueAt: plus(at(SATURDAYS[0]!), 24), briefAr: 'حلّ' }
    expect(card(early).get('task_timing')!.gaps).toEqual([
      '«واجب 1»: بلا وصفٍ يكفي ليُنجَز',
      expect.stringContaining('قبل أن يمضي 3 أيّامٍ على لقاء محورها'),
    ])
  })

  it('مصدرٌ واحدٌ للمحور، أو كلُّها من صنفٍ واحد', () => {
    const one = good()
    const c = one.content as { resources: Record<string, unknown>[] }
    c.resources = c.resources.filter((r) => !(r.moduleId === 'M1' && r.category === 'public'))
    expect(failing(one)).toEqual(['sources_mix:advice'])
    expect(card(one).get('sources_mix')!.gaps).toEqual(['المحور 1: مصدرٌ واحد'])
  })

  it('ونصيحةُ البدء الموسميّة: قبل أواخر نوفمبر', () => {
    const i = good()
    i.period = { startsOn: '2026-11-10', endsOn: '2027-01-30' }
    expect(failing(i)).toEqual(['start_date:advice'])
    /* وبعد أن يحلّ ديسمبر تسكت — نصيحةٌ عن موسمٍ مضى تُربك ولا تنفع */
    i.now = new Date('2026-12-02T09:00:00Z')
    expect(card(i).has('start_date')).toBe(false)
  })
})

describe('العددُ بالعربيّة', () => {
  it('الساعاتُ والأيّام', () => {
    expect([60, 120, 240, 150, 660].map(hoursAr)).toEqual(['ساعة', 'ساعتان', '4 ساعات', '2.5 ساعة', '11 ساعة'])
    expect([1, 2, 4, 12].map(daysAr)).toEqual(['يوم', 'يومين', '4 أيّام', '12 يوما'])
  })
})

describe('ملاحظاتُ الردّ من البطاقة', () => {
  it('كلٌّ في خطوته — المطلوبُ أوّلا ثمّ المقترَح، وما تحقّق لا يُكتب', () => {
    const i = good()
    i.period = { startsOn: '2026-11-29', endsOn: '2027-02-05' }
    i.sessions[0] = { ...i.sessions[0]!, endsAt: plus(at(SATURDAYS[0]!), 4) }
    i.sessions[1] = { ...i.sessions[1]!, moduleIds: ['M1'] }
    const notes = scorecardNotes(planScorecard(i))
    expect(Object.keys(notes).sort()).toEqual(['identity', 'sessions'])
    expect(notes.identity).toMatch(/^مطلوب — نهايةُ الشعبة: /)
    const lines = notes.sessions!.split('\n')
    expect(lines[0]).toMatch(/^مطلوب — لقاءٌ لكلّ محور: المحور 2: بلا لقاءٍ مباشر$/)
    expect(lines[1]).toMatch(/^مقترَح — طولُ اللقاء: /)
  })

  it('ولا تتجاوز حدَّ الصندوق', () => {
    const many = Array.from({ length: 400 }, (_, k) => `سطرٌ طويلٌ رقم ${k}`)
    const notes = scorecardNotes([{ key: 'x', labelAr: 'س', standardAr: '', measuredAr: '', gaps: many, required: false, status: 'advice', step: 'modules' }])
    expect(notes.modules!.length).toBe(REVIEW_NOTE_MAX)
    expect(notes.modules!.endsWith('…')).toBe(true)
  })
})
