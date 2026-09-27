/* نافذةُ الشعبة للمتعلّم — القاعدةُ المحضة (٢(ب-٢)).

   قراراتُ صاحب المنصّة بكلمة «go» (٢٧ سبتمبر ٢٠٢٦): ④ بعد انتهاء الشعبة
   تتوقّف اللقاءاتُ والتسليمات وستّةُ أشهرٍ للقراءة، ⑤ المهامُّ بعد أوّل لقاءٍ
   للمحور، ⑥ المتأخّرُ يُقبل ويُعلَّم. والقاعدةُ في
   `src/application/learning/cohort-gate.ts`، وأثرُها الحقيقيُّ على الخادم في
   `server/tests/learning/learner-timeline-gate.test.ts`. */

import { describe, expect, it } from 'vitest'
import {
  ACCESS_MONTHS, accessState, addMonths, assessmentOpensAt, cohortWindow, gateAssessment,
  learnerGate, learnerPeriod, meetingOver, MEETING_GRACE_MS, MEETING_MAX_LIVE_MS, submitVerdict, whenAr,
} from '@/application/learning/cohort-gate'
import { overlayModules, projectPlanForLearner } from '@/application/trainer/plan-overlay'
import { canSubmitNow, pendingAssessmentCount, type EnrollmentDetail } from '@/services/enrollment-detail'

const PERIOD = { startsOn: '2027-02-07', endsOn: '2027-03-13' }
const SLOTS = [
  { startsOn: '2027-02-07', endsOn: '2027-02-13', moduleIds: ['M1'], workbook: { url: 'https://x.test/wb1' } },
  { startsOn: '2027-02-14', endsOn: '2027-02-20', moduleIds: ['M2'], workbook: { bodyFileKey: 'k-wb2', bodyFileName: 'wb2.pdf' } },
  { startsOn: '2027-02-21', endsOn: '2027-02-27', moduleIds: ['M3'], workbook: { url: 'javascript:alert(1)', bodyFileKey: 'k-wb3' } },
  { startsOn: '2027-02-28', endsOn: '2027-03-13', moduleIds: ['M4'], workbook: { url: 'https://x.test/wb4' } },
]
/* عمّانُ +3 طوالَ السنة: منتصفُ ليلها ٢١:٠٠ بغرينتش من اليوم السابق */
const SESSIONS = [
  { startsAt: '2027-02-08T15:00:00.000Z', endsAt: '2027-02-08T17:00:00.000Z', moduleIds: ['M1'] },
  { startsAt: '2027-02-15T15:00:00.000Z', endsAt: '2027-02-15T17:00:00.000Z', moduleIds: ['M2'] },
]
const content = {
  kind: 'trainer',
  startsOn: PERIOD.startsOn,
  endsOn: PERIOD.endsOn,
  slots: SLOTS,
  modules: ['M1', 'M2', 'M3', 'M4'].map((moduleId, i) => ({ moduleId, titleAr: `المحور ${i + 1}`, bodyAr: `متنُ ${moduleId}`, bodyFileKey: `k-body-${moduleId}` })),
  resources: [
    { title: 'بعد لقاء الثاني', url: 'https://x.test/r2', moduleId: 'M2' },
    { title: 'قراءةٌ مسبقةٌ للثالث', url: 'https://x.test/pre3', moduleId: 'M3', preReading: true },
    { title: 'للشعبة كلِّها', url: 'https://x.test/all' },
  ],
}
const cohort = { startsAt: null, endsAt: null }
const gateAt = (iso: string, sessions: typeof SESSIONS = SESSIONS) =>
  learnerGate({ content, cohort, sessions, now: new Date(iso) })

describe('الأجلُ بعد الشعبة — ستّةُ أشهرٍ بتقويمٍ لا بأيّام', () => {
  it('⚠️ يُقصّ إلى آخر الشهر: ٣١ أغسطس + ٦ = آخرُ فبراير — وفي الكبيسة ٢٩', () => {
    expect(ACCESS_MONTHS).toBe(6)
    expect(addMonths('2026-08-31', 6)).toBe('2027-02-28')
    expect(addMonths('2027-08-31', 6)).toBe('2028-02-29')
    expect(addMonths('2026-03-15', 6)).toBe('2026-09-15')
    expect(addMonths('2026-12-10', 6)).toBe('2027-06-10')
    expect(addMonths('2026-10-31', 1)).toBe('2026-11-30')
  })

  it('⚠️ الحدّان آخرُ ثانيةٍ من اليوم بتوقيت عمّان — لا منتصفُ ليل غرينتش', () => {
    const w = cohortWindow(PERIOD)!
    expect(w.closesAt.toISOString()).toBe('2027-03-13T20:59:59.999Z')
    expect(w.accessEndsAt.toISOString()).toBe('2027-09-13T20:59:59.999Z')
    expect(cohortWindow(null)).toBeNull()
    expect(cohortWindow({ startsOn: '2027-02-07', endsOn: '2027-02-31' })).toBeNull()
  })

  it('⚠️ «مفتوحة» حتّى آخر ثانية، ثمّ «للقراءة» حتّى أجلها، ثمّ «انتهى الوصول»', () => {
    const w = cohortWindow(PERIOD)!
    const t = (d: Date, ms: number) => new Date(d.getTime() + ms)
    expect(accessState(w, w.closesAt)).toBe('open')
    expect(accessState(w, t(w.closesAt, 1))).toBe('readonly')
    expect(accessState(w, w.accessEndsAt)).toBe('readonly')
    expect(accessState(w, t(w.accessEndsAt, 1))).toBe('ended')
    expect(accessState(null, new Date('2099-01-01'))).toBe('open')
  })
})

describe('مدّةُ الشعبة وبوّابتُها', () => {
  it('المدّةُ من الخطّة، وإلّا من تاريخَي الشعبة بيوم عمّان', () => {
    expect(learnerPeriod(content, { startsAt: new Date('2020-01-01'), endsAt: new Date('2020-02-01') })).toEqual(PERIOD)
    /* ٢٢:٠٠ بغرينتش يومَ ٦ هي الأولى بعد منتصف الليل يومَ ٧ في عمّان */
    expect(learnerPeriod({}, { startsAt: new Date('2027-02-06T22:00:00Z'), endsAt: new Date('2027-03-13T10:00:00Z') }))
      .toEqual({ startsOn: '2027-02-07', endsOn: '2027-03-13' })
    expect(learnerPeriod(null, cohort)).toBeNull()
  })

  it('⚠️ ما اعتُمد بلا مواعيدَ لا خطَّ له ولا أجل — وإن انقضت تواريخُه', () => {
    const g = learnerGate({
      content: { kind: 'trainer', modules: [] },
      cohort: { startsAt: new Date('2020-01-01'), endsAt: new Date('2020-02-01') },
      sessions: [],
      now: new Date('2027-01-01'),
    })
    expect(g.timeline).toBeNull()
    expect(g.window).toBeNull()
    expect(g.access).toBe('open')
  })

  it('⚠️ المهمّةُ بعد أوّل لقاءٍ لمحورها — والمبدئيُّ والملغى لا يفتحانها', () => {
    const g = gateAt('2027-02-10T00:00:00Z')
    expect(assessmentOpensAt(g, 'M2')!.toISOString()).toBe('2027-02-15T17:00:00.000Z')
    expect(assessmentOpensAt(g, null)).toBeNull()
    const early = [{ startsAt: '2027-02-14T09:00:00.000Z', endsAt: '2027-02-14T11:00:00.000Z', moduleIds: ['M2'] }]
    const withDead = learnerGate({
      content, cohort, now: new Date('2027-02-10T00:00:00Z'),
      sessions: [
        ...SESSIONS,
        { ...early[0], placeholder: true },
        { ...early[0], status: 'cancelled' },
      ],
    })
    expect(assessmentOpensAt(withDead, 'M2')!.toISOString(), 'فتح المبدئيُّ أو الملغى المهمّة').toBe('2027-02-15T17:00:00.000Z')
    /* واللقاءُ القديمُ بعمود `moduleId` وحدَه يُحسب لمحوره */
    const legacyRow = learnerGate({ content, cohort, now: new Date(), sessions: [{ ...early[0], moduleIds: [], moduleId: 'M2' }] })
    expect(assessmentOpensAt(legacyRow, 'M2')!.toISOString()).toBe('2027-02-14T11:00:00.000Z')
  })
})

describe('اللحظةُ بلغة المتعلّم', () => {
  it('⚠️ منتصفُ ليل عمّان يومٌ لا ساعة — وما سواه بساعته', () => {
    /* ٢١:٠٠ بغرينتش منتصفُ الليل في عمّان: موعدٌ يُفتح أوّلَ يومه */
    expect(whenAr('2027-02-20T21:00:00.000Z'), '«في ١٢:٠٠ ص» على موعدِ يوم').not.toMatch(/\d:\d\d/)
    expect(whenAr('2027-02-20T21:00:00.000Z')).toContain('21')
    /* ونهايةُ لقاءٍ في الثامنة مساءً تُقال بساعتها — فهي ما يُنتظر */
    expect(whenAr('2027-02-15T17:00:00.000Z')).toMatch(/\d:\d\d/)
  })
})

describe('أيُقبل التسليم؟ — وأمتأخّرٌ هو؟', () => {
  const w = cohortWindow(PERIOD)!
  const base = { opensAt: new Date('2027-02-15T17:00:00Z'), dueAt: '2027-02-20T20:59:59.999Z', window: w, resubmitRequested: false }
  const at = (iso: string, over: Partial<typeof base> = {}) => submitVerdict({ ...base, ...over, now: new Date(iso) })

  it('⚠️ قبل أن تُفتح يُردّ — ويُقال متى', () => {
    const v = at('2027-02-15T16:59:59Z')
    expect(v.ok).toBe(false)
    if (!v.ok) {
      expect(v.code).toBe('not_open_yet')
      expect(v.messageAr).toContain('تُفتح')
    }
    expect(at('2027-02-15T17:00:00Z').ok).toBe(true)
    /* والإعادةُ بطلبٍ لا تُحبس خلف موعد فتحٍ تأخّر بعد تسليمه الأوّل — قرأ
       التعليماتِ وسلّم، والمدرّبُ طلب منه تتمّة */
    expect(at('2027-02-15T16:59:59Z', { resubmitRequested: true }).ok).toBe(true)
  })

  it('⚠️ وبعد آخر موعده يُقبل ويُعلَّم — وقبله لا يُعلَّم', () => {
    expect(at('2027-02-20T20:59:59.999Z')).toEqual({ ok: true, late: false })
    expect(at('2027-02-20T21:00:00Z')).toEqual({ ok: true, late: true })
    expect(at('2027-03-01T00:00:00Z', { dueAt: null as never })).toEqual({ ok: true, late: false })
  })

  it('⚠️ وبعد انتهاء الشعبة يُردّ — إلّا إعادةً طلبها المدرّب، ولا تُعلَّم', () => {
    const closed = at('2027-03-14T00:00:00Z')
    expect(closed.ok).toBe(false)
    if (!closed.ok) expect(closed.code).toBe('cohort_closed')
    expect(at('2027-03-14T00:00:00Z', { resubmitRequested: true })).toEqual({ ok: true, late: false })
  })

  it('⚠️ وبعد انتهاء الوصول لا شيء — ولا الإعادة', () => {
    const v = at('2027-09-14T00:00:00Z', { resubmitRequested: true })
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.code).toBe('access_ended')
  })

  it('وما لا أجلَ له لا يُقفل — ويُعلَّم متأخّرا بعد موعده', () => {
    expect(at('2030-01-01T00:00:00Z', { window: null as never, opensAt: null as never })).toEqual({ ok: true, late: true })
  })
})

describe('المهمّةُ كما تصل المتعلّم', () => {
  const task = {
    id: 'a1', title: 'تطبيق', type: 'quiz', moduleId: 'M2', dueAt: '2027-02-20T20:59:59.999Z', maxScore: 10, passScore: 5,
    briefAr: 'التعليمات', attachments: [{ title: 'نموذج', url: 'https://x.test/n' }], items: [{ id: 'i1', prompt: 'سؤالٌ قبل أوانه' }],
    rubric: { id: 'r' }, createdBy: 'u-1', internalColumnTomorrow: 'سرّ',
  }
  const opens = new Date('2027-02-15T17:00:00Z')

  it('⚠️ قبل أن تُفتح: حقولٌ مسمّاةٌ وحدَها — لا تعليماتِ ولا أسئلةَ ولا عمودَ الغد', () => {
    const out = gateAssessment(task, opens, 'open', new Date('2027-02-15T16:00:00Z'))
    expect(out.locked).toBe(true)
    expect(Object.keys(out).sort()).toEqual([
      'attachments', 'briefAr', 'dueAt', 'id', 'items', 'locked', 'maxScore', 'moduleId', 'opensAt', 'passScore', 'rubric', 'title', 'type',
    ])
    expect(JSON.stringify(out)).not.toContain('سؤالٌ قبل أوانه')
    expect(JSON.stringify(out)).not.toContain('سرّ')
    expect(out.opensAt).toBe('2027-02-15T17:00:00.000Z')
  })

  it('وبعد أن تُفتح تصل كما هي', () => {
    const out = gateAssessment(task, opens, 'open', new Date('2027-02-15T17:00:00Z'))
    expect(out.locked).toBe(false)
    expect(out).toMatchObject({ briefAr: 'التعليمات', items: task.items })
    expect(gateAssessment(task, null, 'open', new Date()).locked).toBe(false)
  })

  it('⚠️ وبعد انتهاء الوصول تُطوى وإن فُتحت قديما — بلا موعدِ فتح', () => {
    const out = gateAssessment(task, opens, 'ended', new Date('2028-01-01'))
    expect(out.locked).toBe(true)
    expect(out.opensAt).toBeNull()
    expect(out.briefAr).toBeNull()
  })
})

describe('متى ينتهي اللقاءُ فلا يُدخَل', () => {
  const s = { startsAt: '2027-02-15T15:00:00.000Z', endsAt: '2027-02-15T17:00:00.000Z' }
  const end = Date.parse(s.endsAt)

  it('⚠️ بلا خبرٍ من Zoom: ساعةٌ بعد نهايته ثمّ يُغلق', () => {
    expect(MEETING_GRACE_MS).toBe(3_600_000)
    expect(meetingOver(s, null, new Date(end + MEETING_GRACE_MS))).toBe(false)
    expect(meetingOver(s, null, new Date(end + MEETING_GRACE_MS + 1))).toBe(true)
  })

  it('⚠️ أنهاه Zoom فانتهى — وإن كانت الساعةُ قبل موعده', () => {
    const zoom = { actualStartAt: '2027-02-15T15:00:00Z', actualEndAt: '2027-02-15T16:00:00Z' }
    expect(meetingOver(s, zoom, new Date('2027-02-15T16:10:00Z'))).toBe(true)
  })

  it('⚠️ وجارٍ بعد موعده لا ينتهي — ومن أُعيد فتحُه بعد إنهائه جارٍ', () => {
    const live = { actualStartAt: '2027-02-15T16:30:00Z' }
    expect(meetingOver(s, live, new Date('2027-02-15T19:30:00Z'))).toBe(false)
    const reopened = { actualStartAt: '2027-02-15T17:10:00Z', actualEndAt: '2027-02-15T17:00:00Z' }
    expect(meetingOver(s, reopened, new Date('2027-02-15T18:30:00Z'))).toBe(false)
  })

  it('⚠️ و«بدأ» بلا خبرِ نهايةٍ لا يبقى مفتوحا أبدا', () => {
    const lost = { actualStartAt: '2027-02-15T15:00:00Z' }
    expect(meetingOver(s, lost, new Date(Date.parse(lost.actualStartAt) + MEETING_MAX_LIVE_MS + 1))).toBe(true)
  })
})

describe('الخطّةُ كما تصل المتعلّم على خطّ المحاور', () => {
  const plan = { status: 'approved', content }
  const view = (iso: string) => projectPlanForLearner(plan, new Date(iso), gateAt(iso))!

  it('⚠️ المحورُ قبل موعده عنوانٌ وموعدٌ — بلا متنٍ ولا ملفّ', () => {
    const v = view('2027-02-16T00:00:00Z')
    const m3 = v.modules.find((m) => m.moduleId === 'M3')!
    expect(m3).toMatchObject({ locked: true, bodyAr: null, bodyFileKey: null, titleAr: 'المحور 3' })
    expect(m3.opensAt).toBe('2027-02-20T21:00:00.000Z')
    expect(v.modules.find((m) => m.moduleId === 'M2')).toMatchObject({ locked: false, bodyAr: 'متنُ M2', bodyFileKey: 'k-body-M2' })
  })

  it('⚠️ والكرّاسةُ قبل موعدها لا يصل رابطُها — والرابطُ غيرُ http لا يصل أبدا', () => {
    const before = view('2027-02-16T00:00:00Z').slots!
    expect(before[1].workbook?.bodyFileKey).toBe('k-wb2')
    expect(before[2]).toMatchObject({ locked: true, hasWorkbook: true, workbook: null })
    const after = view('2027-02-22T00:00:00Z').slots!
    expect(after[2].workbook).toMatchObject({ bodyFileKey: 'k-wb3', url: null })
  })

  it('⚠️ والمصادرُ على الخطّ نفسِه', () => {
    const titles = (iso: string) => view(iso).resources.map((r) => r.title)
    expect(titles('2027-02-15T16:00:00Z')).toEqual(['للشعبة كلِّها'])
    expect(titles('2027-02-15T17:00:00Z')).toEqual(['بعد لقاء الثاني', 'للشعبة كلِّها'])
    expect(titles('2027-02-21T00:00:00Z')).toContain('قراءةٌ مسبقةٌ للثالث')
  })

  it('⚠️ وبعد انتهاء الوصول: العناوينُ وحدَها', () => {
    const v = view('2027-09-14T00:00:00Z')
    expect(v.modules.every((m) => m.locked && m.bodyAr === null && m.opensAt === null)).toBe(true)
    expect(v.slots!.every((s) => s.workbook === null)).toBe(true)
    expect(v.resources).toEqual([])
  })

  it('وبلا بوّابةٍ تخرج كما كانت — لا مواعيدَ ولا حجب', () => {
    const v = projectPlanForLearner(plan, new Date('2027-02-10T00:00:00Z'))!
    expect(v.slots).toEqual([])
    expect(v.modules.every((m) => !m.locked && m.bodyAr)).toBe(true)
    expect(v.resources).toHaveLength(3)
  })

  it('⚠️ والعلوُّ لا يملأ المحجوبَ من متن الكتالوج', () => {
    const v = view('2027-02-16T00:00:00Z')
    const catalog = [{ id: 'M3', title: 'عنوانُ الكتالوج', body: 'متنُ الكتالوج العامّ' }]
    const [m] = overlayModules(catalog, v)
    expect(m.locked).toBe(true)
    expect(m.body, 'قُرئ متنُ الكتالوج مكانَ المحجوب').toBeNull()
    expect(m.opensAt).toBe('2027-02-20T21:00:00.000Z')
  })
})

describe('الشاشةُ تعرض النموذجَ حيث يقبله الخادم', () => {
  const detail = (over: Partial<EnrollmentDetail> & { assessments?: EnrollmentDetail['cohort']['assessments'] } = {}) => ({
    id: 'e', status: 'enrolled',
    cohort: { assessments: over.assessments ?? [] },
    submissions: over.submissions ?? [],
    access: over.access,
  }) as unknown as EnrollmentDetail
  const a = (id: string, x: Record<string, unknown> = {}) => ({ id, title: id, type: 'assignment', dueAt: null, maxScore: 10, items: [], briefAr: null, attachments: null, ...x }) as never
  const sub = (assessmentId: string, status: string) => ({ id: `s-${assessmentId}`, assessmentId, status, reviewNote: null, submittedAt: '2027-02-10T00:00:00Z', grades: [], feedback: [] })
  const readonly = { state: 'readonly' as const, closesAt: '2027-03-13T20:59:59.999Z', accessEndsAt: '2027-09-13T20:59:59.999Z' }
  const now = new Date('2027-04-01T00:00:00Z')

  it('⚠️ المحجوبةُ لا نموذجَ لها ولا تُعدّ عليه', () => {
    const d = detail({ assessments: [a('locked', { locked: true, opensAt: '2027-02-15T17:00:00Z' }), a('open')] })
    expect(canSubmitNow(d, d.cohort.assessments[0])).toBe(false)
    expect(pendingAssessmentCount(d)).toBe(1)
  })

  it('⚠️ والشاشةُ تصدّق حجبَ الخادم ولو قالت ساعةُ الجهاز غيرَه', () => {
    /* جهازٌ ساعتُه متقدّمة: موعدُ الفتح «مضى» عنده ولم يمضِ عند الخادم. فلو
       حُكم بالساعة وحدَها لعُرض نموذجٌ يردّه الخادم — والحجبُ حكمُ الخادم */
    const d = detail({ assessments: [a('skewed', { locked: true, opensAt: '2027-02-15T17:00:00Z' })] })
    expect(canSubmitNow(d, d.cohort.assessments[0], new Date('2027-03-01T00:00:00Z')), 'عُرض نموذجُ مهمّةٍ محجوبة').toBe(false)
  })

  it('⚠️ وبعد انتهاء الشعبة: الإعادةُ بطلبٍ وحدَها', () => {
    const d = detail({ access: readonly, assessments: [a('new'), a('again')], submissions: [sub('again', 'resubmit_requested')] as never })
    expect(canSubmitNow(d, d.cohort.assessments[0], now)).toBe(false)
    expect(canSubmitNow(d, d.cohort.assessments[1], now)).toBe(true)
    expect(pendingAssessmentCount(d, now)).toBe(1)
  })

  it('ومن سلّم وينتظر لا يُعرض عليه نموذجٌ ثانٍ', () => {
    const d = detail({ assessments: [a('done')], submissions: [sub('done', 'submitted')] as never })
    expect(canSubmitNow(d, d.cohort.assessments[0])).toBe(false)
  })
})
