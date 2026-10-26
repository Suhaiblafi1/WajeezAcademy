/* طريقُ الدورة — `stage-path.ts` ورسمُه في `StageWork` (٢٦ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: طريقُ محطّاتٍ تعلوه «خطوتك التالية»، ونجومُ المحطّة،
   و«حصادك»، والشهادةُ آخرَ الطريق. وهنا ما يُحرس منه:
     ① رقمُ المحطّة ترتيبُها في شعبته — لا «المحور ١ ثمّ ٩»
     ② الجلسةُ في محطّة موعدها، والمهمّةُ في محطّة محورها
     ③ النجمةُ أثرٌ مسجَّل، وما لا يوجد في المحطّة لا نجمةَ له تُحسب عليه
     ④ «أنت هنا» أوّلُ محطّةٍ مفتوحةٍ لم تكتمل — لا المقفلة
     ⑤ الخطوةُ التالية بترتيبها: جلسةٌ الآن ثمّ إعادةٌ ثمّ تسليمٌ ثمّ قراءة…
     ⑥ والشاشةُ ترسم ذلك: بطاقةٌ واحدة، والمحطّاتُ بترتيبها، والحصادُ للمقبول وحدَه */

import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { buildStagePath, nextStep, type NextStepInput, type PathInput } from '@/application/student/stage-path'
import type { LearnerSlot } from '@/application/trainer/plan-overlay'
import type { EnrollmentDetail } from '@/services/enrollment-detail'
import type { JourneyStage } from '@/application/student/journey'

vi.mock('@/services/cohort-prices', () => ({ useCourseCohorts: () => ({ cohorts: new Map() }) }))
const { default: StageWork } = await import('@/components/journey/StageWork')

const PAST = '2020-01-01T00:00:00.000Z'
const FUTURE = '2099-02-20T21:00:00.000Z'

const slot = (startsOn: string, endsOn: string, moduleIds: string[], locked = false): LearnerSlot => ({
  startsOn, endsOn, moduleIds,
  opensAt: `${startsOn}T00:00:00.000Z`, closesAt: `${endsOn}T23:59:59.000Z`,
  locked, hasWorkbook: false, workbook: null,
} as unknown as LearnerSlot)

/* شعبةٌ كالتي في لقطة صاحب المنصّة: محورٌ من الكتالوج ثمّ محاورُ مدرّبها بأرقامٍ بعيدة */
const modules = [
  { id: 'M1', title: 'أساسيات الخطابة' },
  { id: 'M9', title: 'هندسة الأفكار' },
  { id: 'M10', title: 'قوة الصوت', locked: true, opensAt: FUTURE },
]
const slots = [
  slot('2026-12-01', '2026-12-05', ['M1']),
  slot('2026-12-06', '2026-12-12', ['M9']),
  slot('2099-02-21', '2099-02-27', ['M10'], true),
]
const base = (over: Partial<PathInput> = {}): PathInput => ({
  modules, slots,
  sessions: [
    { id: 'S1', startsAt: '2026-12-03T17:00:00.000Z' },
    { id: 'S2', startsAt: '2026-12-10T17:00:00.000Z' },
    { id: 'S-out', startsAt: '2026-11-01T17:00:00.000Z' },
  ],
  assessments: [
    { id: 'A1', moduleId: 'M1' },
    { id: 'A9', moduleId: 'M9' },
    { id: 'A-none', moduleId: null },
  ],
  doneModules: new Set(), attended: new Set(), accepted: new Set(),
  ...over,
})

describe('① رقم المحطّة ترتيبها في الشعبة', () => {
  it('⚠️ ١ و٢ و٣ — لا رقم المحور في الكتالوج', () => {
    const p = buildStagePath(base())
    expect(p.stops.map((s) => s.seq)).toEqual([1, 2, 3])
    expect(p.stops.map((s) => s.title)).toEqual(['أساسيات الخطابة', 'هندسة الأفكار', 'قوة الصوت'])
  })

  it('وبلا مواعيد: كلّ محور محطّة بترتيبه، ولا محاور «أخرى»', () => {
    const p = buildStagePath(base({ slots: [] }))
    expect(p.stops.map((s) => [s.seq, s.moduleIds[0]])).toEqual([[1, 'M1'], [2, 'M9'], [3, 'M10']])
    expect(p.looseModuleIds).toEqual([])
    expect(p.stops[2].locked).toBe(true)
  })
})

describe('② كلّ شيء في محطّته', () => {
  const p = buildStagePath(base())
  it('⚠️ الجلسة في الموعد الذي يحتوي بدءها، وما خرج عن المواعيد يقال خارجها', () => {
    expect(p.stops[0].sessionIds).toEqual(['S1'])
    expect(p.stops[1].sessionIds).toEqual(['S2'])
    expect(p.looseSessionIds).toEqual(['S-out'])
  })
  it('⚠️ والمهمّة في محطّة محورها، وما لا محور له لا يدسّ في محطّة', () => {
    expect(p.stops[0].assessmentIds).toEqual(['A1'])
    expect(p.stops[1].assessmentIds).toEqual(['A9'])
    expect(p.looseAssessmentIds).toEqual(['A-none'])
  })
})

describe('③ النجمة أثر مسجّل', () => {
  it('⚠️ قرأ وحضر وقبل عمله = ثلاث من ثلاث، والمحطّة منجزة', () => {
    const p = buildStagePath(base({ doneModules: new Set(['M1']), attended: new Set(['S1']), accepted: new Set(['A1']) }))
    expect(p.stops[0].stars).toEqual({ earned: 3, total: 3 })
    expect(p.stops[0].state).toBe('done')
  })
  it('⚠️ وعمل ينتظر المراجعة ليس نجمة', () => {
    const p = buildStagePath(base({ doneModules: new Set(['M1']), attended: new Set(['S1']) }))
    expect(p.stops[0].stars).toEqual({ earned: 2, total: 3 })
    expect(p.stops[0].marks.submit).toBe('todo')
  })
  it('⚠️ ومحطّة بلا جلسة نجمتان لا ثلاث — لا يحسب عليه ما لا يوجد', () => {
    const p = buildStagePath(base({ sessions: [], doneModules: new Set(['M1']), accepted: new Set(['A1']) }))
    expect(p.stops[0].marks.attend).toBe('none')
    expect(p.stops[0].stars).toEqual({ earned: 2, total: 2 })
    expect(p.stops[0].state).toBe('done')
  })
})

describe('④ «أنت هنا»', () => {
  it('⚠️ أوّل محطّة مفتوحة لم تكتمل', () => {
    const p = buildStagePath(base({ doneModules: new Set(['M1']), attended: new Set(['S1']), accepted: new Set(['A1']) }))
    expect(p.currentIndex).toBe(1)
    expect(p.stops.map((s) => s.state)).toEqual(['done', 'current', 'locked'])
  })
  it('⚠️ والمقفلة لا تكون «أنت هنا» وإن كان كلّ ما قبلها منجزا', () => {
    const all = { doneModules: new Set(['M1', 'M9']), attended: new Set(['S1', 'S2']), accepted: new Set(['A1', 'A9']) }
    const p = buildStagePath(base(all))
    expect(p.currentIndex).toBe(-1)
    expect(p.stops[2].state).toBe('locked')
  })
})

describe('⑤ الخطوة التالية بترتيبها', () => {
  const NOW = Date.parse('2026-12-08T12:00:00.000Z')
  const path = buildStagePath(base({ doneModules: new Set(['M1']) }))
  const input = (over: Partial<NextStepInput> = {}): NextStepInput => ({
    path, modules,
    sessions: [
      { id: 'S1', title: 'اللقاء الأوّل', startsAt: '2026-12-03T17:00:00.000Z', endsAt: null, status: 'done' },
      { id: 'S2', title: 'اللقاء الثاني', startsAt: '2026-12-10T17:00:00.000Z', endsAt: null, status: 'scheduled' },
    ],
    assessments: [
      { id: 'A1', title: 'تسجيل البداية', dueAt: null },
      { id: 'A9', title: 'بطاقة الفكرة', dueAt: '2026-12-12T21:00:00.000Z' },
    ],
    submittable: new Set(), resubmit: new Set(), inReview: new Set(),
    readable: new Set(['M1', 'M9']), doneModules: new Set(['M1']), now: NOW,
    ...over,
  })

  it('⚠️ جلسة تجري الآن قبل كلّ شيء', () => {
    const s = nextStep(input({ now: Date.parse('2026-12-10T17:30:00.000Z'), submittable: new Set(['A9']) }))
    expect(s).toMatchObject({ kind: 'live', sessionId: 'S2' })
  })
  it('⚠️ ثمّ ما طلب مدرّبه إعادته — قبل مهمّة جديدة', () => {
    const s = nextStep(input({ submittable: new Set(['A1', 'A9']), resubmit: new Set(['A9']) }))
    expect(s).toMatchObject({ kind: 'resubmit', assessmentId: 'A9', stopKey: 'slot-1' })
  })
  it('⚠️ ثمّ مهمّة مفتوحة بترتيب المحطّات، ومحطّتها معها لتفتح', () => {
    const s = nextStep(input({ submittable: new Set(['A9', 'A1']) }))
    expect(s).toMatchObject({ kind: 'submit', assessmentId: 'A1', stopKey: 'slot-0' })
  })
  it('⚠️ ثمّ أوّل محور مقروء لم يكتمل — لا محور يكتب الآن', () => {
    expect(nextStep(input())).toMatchObject({ kind: 'read', moduleId: 'M9' })
    expect(nextStep(input({ readable: new Set(['M1']) }))).toMatchObject({ kind: 'session', sessionId: 'S2' })
  })
  it('⚠️ وعمل عند مدرّبه يقال — لا بطاقة فارغة', () => {
    const s = nextStep(input({ readable: new Set(), sessions: [], inReview: new Set(['A9']) }))
    expect(s).toMatchObject({ kind: 'review', title: 'بطاقة الفكرة' })
  })
  it('⚠️ ثمّ المحطّة المقفلة ومتى تفتح، وبعد الطريق كلّه الشهادة', () => {
    expect(nextStep(input({ readable: new Set(), sessions: [] }))).toMatchObject({ kind: 'wait', opensAt: `2099-02-21T00:00:00.000Z` })
    const done = buildStagePath(base({ slots: slots.slice(0, 2), modules: modules.slice(0, 2), doneModules: new Set(['M1', 'M9']), attended: new Set(['S1', 'S2']), accepted: new Set(['A1', 'A9']) }))
    expect(nextStep(input({ path: done, readable: new Set(), sessions: [] }))).toEqual({ kind: 'finish' })
  })
})

/* ═══ ⑥ والشاشة ═══ — رسمٌ ساكنٌ كأخواته في `learner-timeline-screens.test.ts` */
describe('⑥ الشاشة ترسم الطريق', () => {
  const stage = { courseId: 'C-T', titleAr: 'دورة الطريق', hours: 0, percent: 0 } as unknown as JourneyStage
  const handlers = { answers: {}, setAnswers: () => undefined, busy: null, onSubmit: () => undefined, onSubmitQuiz: () => undefined, onChanged: () => undefined }
  const body = '## درس أوّل\nنصّ مكتوب بما يكفي ليعدّ درسا واحدا في هذه الوحدة.'
  const task = (id: string, moduleId: string, title: string) =>
    ({ id, title, type: 'assignment', moduleId, dueAt: null, maxScore: 10, briefAr: null, attachments: null, items: [], rubric: null, locked: false, opensAt: PAST })
  const detail = {
    id: 'e-1', status: 'enrolled',
    cohort: {
      id: 'c-1', title: 'الشعبة', startsAt: null, course: { id: 'C-T', versions: [] }, trainers: [],
      sessions: [], materials: [],
      assessments: [task('T1', 'K1', 'عمل مقبول'), task('T9', 'K9', 'عمل ينتظر')],
      trainerPlan: {
        summaryAr: null, resources: [],
        modules: [
          { moduleId: 'K1', titleAr: 'المحطة الأولى', bodyAr: body, locked: false, opensAt: PAST },
          { moduleId: 'K9', titleAr: 'المحطة الثانية', bodyAr: body, locked: false, opensAt: PAST },
        ],
        slots: [
          { startsOn: '2020-01-01', endsOn: '2020-01-07', moduleIds: ['K1'], opensAt: PAST, closesAt: PAST, locked: false, hasWorkbook: false, workbook: null },
          { startsOn: '2020-01-08', endsOn: '2020-01-14', moduleIds: ['K9'], opensAt: PAST, closesAt: PAST, locked: false, hasWorkbook: false, workbook: null },
        ],
      },
    },
    attendance: [],
    submissions: [
      { id: 's-1', assessmentId: 'T1', status: 'accepted', reviewNote: null, submittedAt: '2020-01-05T00:00:00Z', grades: [{ score: '9', maxScore: '10' }], feedback: [] },
      /* سلّمه وينتظر — ليس حصادا بعد */
      { id: 's-9', assessmentId: 'T9', status: 'submitted', reviewNote: null, submittedAt: '2020-01-10T00:00:00Z', grades: [], feedback: [] },
    ],
    moduleProgress: [{ moduleId: 'K1', status: 'completed', completedAt: PAST }],
    courseProgress: null, certificates: [],
  } as unknown as EnrollmentDetail
  const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(StageWork, { stage, detail, full: null, request: null, handlers })))

  it('⚠️ بطاقة «خطوتك التالية» واحدة، ولا ألسنة', () => {
    expect(html.split('aria-label="خطوتك التالية"').length - 1).toBe(1)
    expect(html).not.toContain('role="tablist"')
  })
  it('⚠️ المحطّات بترتيبها، والأولى منجزة والثانية «أنت هنا» مفتوحة', () => {
    const first = html.indexOf('id="slot-0"')
    const second = html.indexOf('id="slot-1"')
    expect(first).toBeGreaterThan(-1)
    expect(second).toBeGreaterThan(first)
    expect(html.slice(first, second)).toContain('أنجزتها')
    expect(html.slice(second)).toContain('أنت هنا')
    const tag = (id: string) => html.match(new RegExp(`<details[^>]*id="${id}"[^>]*>`))?.[0] ?? ''
    expect(tag('slot-1'), 'المحطّة الحاليّة مطويّة').toMatch(/\sopen=""/)
    expect(tag('slot-0'), 'المنجزة تفتح وحدها').not.toMatch(/\sopen=""/)
  })
  it('⚠️ والحصاد للمقبول وحده', () => {
    const harvest = html.slice(html.indexOf('aria-label="حصادك"'))
    expect(harvest).toContain('عمل مقبول')
    expect(harvest).toContain('9/10')
    expect(harvest).not.toContain('عمل ينتظر')
  })
  it('⚠️ والشهادة آخر الطريق — بعد آخر محطّة', () => {
    expect(html.indexOf('href="#certificate"')).toBeGreaterThan(html.indexOf('id="slot-1"'))
  })
})
