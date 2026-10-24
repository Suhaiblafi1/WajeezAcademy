/* الانضمام — محطّةٌ واحدةٌ لكلّ طلب، وخطوةٌ تاليةٌ واحدةٌ بصاحبها وزرّها (٢٤ أكتوبر ٢٠٢٦، `joining.ts`).

   ① المحطّة: الطلبُ ثمّ المقابلةُ ثمّ الاتفاقية، و«لاحقا» و«مغلق» جانبا — ومن عبر إلى «المدربون» لا محطّةَ له هنا.
   ② والخطوة: من عليه الدور، وما هي، وزرُّها — من مصادرها (الدعوةُ وخطوةُ العقد) لا نسخةٍ ثانية.
   ③ والعدد: مجموعُ المحطّات عددُ من لم يعبر. والنصوصُ بلا تشكيلٍ إلّا الشدّة.
   ④ والشاشة: كلُّ صفٍّ يقول خطوتَه من الدالّة، وزرُّه بندُ قائمته نفسُه — ومن عبر لا يُعدّ إلّا بلسانه.
   ⑤ وخطُّ الملفّ: ما مضى بتاريخه، والتي هو فيها «الآن» — ولو بلغ ما بعدها ثمّ رُدّ — و«لاحقا» و«مغلق» جانبه. */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { joiningCounts, joiningLineOf, joiningNextOf, joiningStopOf, JOINING_ACT_AR, type JoiningFacts, type LineFacts } from '@/application/trainer/joining'
import { plainAr } from '@/application/text/plain-ar'

const NOW = new Date('2026-10-24T12:00:00Z')
const base: JoiningFacts = {
  status: 'submitted', operating: false, interviewsCount: 0, interviewInvitedAt: null,
  pendingInterviewAt: null, interviewOutcome: null, contract: null,
}
const at = (over: Partial<JoiningFacts>): JoiningFacts => ({ ...base, ...over })
const contract = (status: string, extra: Partial<NonNullable<JoiningFacts['contract']>> = {}) => ({
  status, tokenExpiresAt: null, gatesActivation: true, documentNameAr: 'سارة الخطيب', signedNameAr: null, ...extra,
})

describe('① المحطّة', () => {
  it('⚠️ لكلّ حالة محطّة واحدة', () => {
    expect(joiningStopOf(at({ status: 'draft' }))).toBe('application')
    expect(joiningStopOf(at({ status: 'submitted' }))).toBe('application')
    expect(joiningStopOf(at({ status: 'under_review' }))).toBe('application')
    expect(joiningStopOf(at({ status: 'academic_review' }))).toBe('application')
    expect(joiningStopOf(at({ status: 'interview_scheduled' }))).toBe('interview')
    expect(joiningStopOf(at({ status: 'conditionally_approved' }))).toBe('agreement')
    expect(joiningStopOf(at({ status: 'contract_pending' }))).toBe('agreement')
    expect(joiningStopOf(at({ status: 'waitlisted' }))).toBe('later')
    expect(joiningStopOf(at({ status: 'deferred' }))).toBe('later')
    expect(joiningStopOf(at({ status: 'rejected' }))).toBe('closed')
    expect(joiningStopOf(at({ status: 'withdrawn' }))).toBe('closed')
  })

  it('⚠️ ومن دعوناه أو قابلناه في المقابلة — ولو عاد طلبه إلى «قيد المراجعة»', () => {
    expect(joiningStopOf(at({ status: 'under_review', interviewInvitedAt: '2026-10-20T00:00:00Z' }))).toBe('interview')
    expect(joiningStopOf(at({ status: 'under_review', interviewsCount: 1, interviewOutcome: 'pass' }))).toBe('interview')
  })

  it('⚠️ ومن عبر إلى «المدربون» لا محطة له هنا', () => {
    for (const status of ['onboarding', 'active', 'suspended', 'contract_pending']) {
      expect(joiningStopOf(at({ status, operating: true })), status).toBeNull()
      expect(joiningNextOf(at({ status, operating: true }), NOW), status).toBeNull()
    }
  })
})

describe('② الخطوة التالية', () => {
  const next = (over: Partial<JoiningFacts>) => joiningNextOf(at(over), NOW)!

  it('⚠️ الطلب: منك أن تقرأه وتقرر — ومنه إكمال المسودة أو ما طلبته', () => {
    expect(next({ status: 'submitted' })).toEqual({ turn: 'you', ar: 'اقرأ طلبه وقرر', act: 'open', focus: 'decision' })
    expect(next({ status: 'draft' })).toMatchObject({ turn: 'them', act: 'remind_draft' })
    expect(next({ status: 'information_requested' })).toMatchObject({ turn: 'them', ar: 'يرسل ما طلبته' })
  })

  it('⚠️ المقابلة: يحجز فيذكَّر، وموعد قادم لا دور فيه، وماض بلا نتيجة عليك، وبعد النتيجة قرارك', () => {
    expect(next({ status: 'under_review', interviewInvitedAt: '2026-10-20T00:00:00Z' }))
      .toEqual({ turn: 'them', ar: 'يحجز موعد المقابلة', act: 'remind_booking' })
    expect(next({ status: 'interview_scheduled', interviewsCount: 1, pendingInterviewAt: '2026-10-26T10:00:00Z' }))
      .toMatchObject({ turn: 'none', act: 'open' })
    expect(next({ status: 'interview_scheduled', interviewsCount: 1, pendingInterviewAt: '2026-10-22T10:00:00Z' }))
      .toEqual({ turn: 'you', ar: 'سجل نتيجة المقابلة', act: 'open', focus: 'interviews' })
    expect(next({ status: 'under_review', interviewsCount: 1, interviewOutcome: 'pass' }))
      .toEqual({ turn: 'you', ar: 'قرر بعد المقابلة', act: 'open', focus: 'decision' })
    expect(next({ status: 'under_review', interviewsCount: 1, interviewOutcome: 'no_show' }))
      .toMatchObject({ turn: 'you', act: 'open' })
  })

  it('⚠️ الاتفاقية: بلا عقد أو بعقد منته تجهزها، والعقد يقول خطوته كما تقولها شاشة العقود', () => {
    expect(next({ status: 'conditionally_approved' })).toEqual({ turn: 'you', ar: 'جهز الاتفاقية وأرسلها', act: 'contract_new' })
    expect(next({ status: 'contract_pending', contract: contract('declined') })).toMatchObject({ turn: 'you', act: 'contract_new' })
    expect(next({ status: 'conditionally_approved', contract: contract('draft') })).toMatchObject({ turn: 'you', act: 'contract' })
    expect(next({ status: 'contract_pending', contract: contract('sent', { tokenExpiresAt: '2026-11-01T00:00:00Z' }) }))
      .toMatchObject({ turn: 'them', act: 'contract' })
    expect(next({ status: 'contract_pending', contract: contract('sent', { tokenExpiresAt: '2026-10-01T00:00:00Z' }) }))
      .toMatchObject({ turn: 'you', act: 'contract' })
    expect(next({ status: 'contract_pending', contract: contract('signed', { signedNameAr: 'سارة الخطيب' }) }))
      .toMatchObject({ turn: 'you', act: 'contract' })
    expect(next({ status: 'contract_pending', contract: contract('amendment_requested') })).toMatchObject({ turn: 'you' })
  })

  it('⚠️ وكل ما عليك بلا باب غير الملف يقول أين يعمل فيه — القرار أو المقابلات', () => {
    const yours: Partial<JoiningFacts>[] = [
      { status: 'submitted' }, { status: 'under_review', interviewsCount: 1, interviewOutcome: 'passed' },
      { status: 'under_review', interviewsCount: 1, interviewOutcome: 'no_show' },
      { status: 'interview_scheduled', interviewsCount: 1, pendingInterviewAt: '2026-10-22T10:00:00Z' },
    ]
    for (const f of yours) {
      const n = next(f)
      expect(n.act, n.ar).toBe('open')
      expect(n.focus, n.ar).toBeDefined()
    }
  })

  it('لاحقا ومغلق: لا دور — إلا مؤجلا سألناه عن اهتمامه', () => {
    expect(next({ status: 'waitlisted' })).toMatchObject({ turn: 'none' })
    expect(next({ status: 'deferred', deferredFollowUpAt: '2027-01-10T00:00:00Z' })).toMatchObject({ turn: 'none' })
    expect(next({ status: 'deferred', deferredInterestAskedAt: '2026-10-20T00:00:00Z' })).toMatchObject({ turn: 'them' })
    expect(next({ status: 'rejected' })).toMatchObject({ turn: 'none', act: 'open' })
  })

  it('والنصوص بلا تشكيل إلا الشدة', () => {
    const samples: Partial<JoiningFacts>[] = [
      { status: 'submitted' }, { status: 'draft' }, { status: 'information_requested' },
      { status: 'under_review', interviewInvitedAt: '2026-10-20T00:00:00Z' },
      { status: 'interview_scheduled', interviewsCount: 1, pendingInterviewAt: '2026-10-26T10:00:00Z' },
      { status: 'under_review', interviewsCount: 1, interviewOutcome: 'no_show' },
      { status: 'conditionally_approved' }, { status: 'contract_pending', contract: contract('sent') },
      { status: 'contract_pending', contract: contract('signed', { signedNameAr: 'سارة الخطيب' }) },
      { status: 'deferred' }, { status: 'waitlisted' }, { status: 'rejected' }, { status: 'withdrawn' },
    ]
    for (const s of samples) {
      const n = next(s)
      expect(n.ar, n.ar).toBe(plainAr(n.ar))
    }
    for (const label of Object.values(JOINING_ACT_AR)) expect(label).toBe(plainAr(label))
  })
})

describe('③ العدد', () => {
  it('⚠️ مجموع المحطات عدد من لم يعبر', () => {
    const rows = [
      at({ status: 'draft' }), at({ status: 'submitted' }), at({ status: 'interview_scheduled' }),
      at({ status: 'conditionally_approved' }), at({ status: 'deferred' }), at({ status: 'rejected' }),
      at({ status: 'active', operating: true }), at({ status: 'contract_pending', operating: true }),
    ]
    const counts = joiningCounts(rows)
    expect(counts).toEqual({ application: 2, interview: 1, agreement: 1, later: 1, closed: 1 })
    expect(Object.values(counts).reduce((n, c) => n + c, 0)).toBe(rows.filter((r) => !r.operating).length)
  })
})

/* ═══ ④ والشاشة — من الدالّتين لا بنسخةٍ منهما ═══

   ما يُفحص هنا لا يُرى إلّا في الشاشة: أنّ الصفَّ يقرأ `joiningNextOf` لا حكما يكتبه، وأنّ زرَّه بندُ قائمة
   أفعاله نفسُه (فلا يفترق التذكيرُ في الزرّ عنه في القائمة شرطا أو رسالة)، وأنّ من عبر لا يُعدّ في الطابور. */
describe('④ والشاشة', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
  /* بلا التعليقات: شرحُ ما كان ليس عودةً له */
  const screen = readFileSync(join(root, 'src/pages/admin/TrainerApplications.tsx'), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')

  it('⚠️ كل صف يقول من عليه الدور وما هو — من `joiningNextOf`', () => {
    expect(screen, 'الصف لا يقول خطوته')
      .toMatch(/const next = joiningNextOf\(a, renderedAt\);[\s\S]{0,300}?\{TURN_AR\[next\.turn\]\}\{next\.ar\}/)
  })

  it('⚠️ وزره بلفظ المعجم — ولا زر لما ينتظر غيرك بلا فعل', () => {
    expect(screen, 'الزر لا يقرأ لفظه من المعجم').toContain('{JOINING_ACT_AR[next.act]}')
    expect(screen, 'زر لكل صف ولو لم يكن فيه فعل')
      .toContain('if (!next || (next.act === "open" && next.turn !== "you")) return null;')
  })

  it('⚠️ والتذكير وفتح الملف بندا القائمة بعينهما — لا نسخة ثانية', () => {
    const run = /const runJoiningAct = [\s\S]*?\n {2}\};/.exec(screen)?.[0] ?? ''
    expect(run, 'زر الصف مفقود').toBeTruthy()
    expect(run, 'الزر لا يمر ببند القائمة').toContain('rowActions(a).find((i) => i.key === key)?.run()')
    expect(run, 'الزر يرسل بنفسه — فيفترق عن القائمة').not.toContain('apiPost')
  })

  it('⚠️ ومن عبر لا يعد في الطابور إلا بلسانه — والمحطة في العنوان', () => {
    expect(screen, 'من عبر عاد إلى الطابور')
      .toContain('stop === "crossed" ? a.operating : stop ? joiningStopOf(a) === stop : !a.operating')
    expect(screen, 'المحطة ليست في العنوان').toMatch(/useTabParam<JoiningStop \| "crossed" \| "">\([\s\S]{0,120}?"stop"\)/)
  })
})

describe('⑤ خط الملف', () => {
  const SUBMITTED = '2026-10-02T09:00:00Z'
  const line = (over: Partial<LineFacts>) => joiningLineOf({ ...base, submittedAt: SUBMITTED, history: [], ...over })
  const states = (over: Partial<LineFacts>) => line(over).stops.map((s) => `${s.id}:${s.state}`)

  it('⚠️ طلب وصل: الطلب الآن بتاريخ تقديمه، وما بعده بلا تاريخ', () => {
    const l = line({ status: 'submitted' })
    expect(l.stops.map((s) => s.state)).toEqual(['now', 'ahead', 'ahead', 'ahead'])
    expect(l.stops[0].at).toBe(SUBMITTED)
    expect(l.stops.slice(1).every((s) => s.at === null)).toBe(true)
    expect(l.aside).toBeNull()
  })

  it('⚠️ ومن دعوناه: المقابلة الآن منذ دعوته', () => {
    const l = line({ status: 'under_review', interviewInvitedAt: '2026-10-05T00:00:00Z' })
    expect(l.stops.map((s) => s.state)).toEqual(['done', 'now', 'ahead', 'ahead'])
    expect(l.stops[1].at).toBe('2026-10-05T00:00:00Z')
    /* وإن حجز بعدها فدخولُه المحطّةَ يومَ دعوناه لا يومَ حجز */
    const booked = line({
      status: 'interview_scheduled', interviewsCount: 1, interviewInvitedAt: '2026-10-05T00:00:00Z',
      history: [{ toStatus: 'interview_scheduled', createdAt: '2026-10-08T00:00:00Z' }],
    })
    expect(booked.stops[1].at).toBe('2026-10-05T00:00:00Z')
  })

  it('⚠️ والاتفاقية بتاريخ القبول الداخلي — والمقابلة بتاريخ أول موعد', () => {
    const l = line({
      status: 'contract_pending', interviewsCount: 1, interviewOutcome: 'passed',
      history: [
        { toStatus: 'interview_scheduled', createdAt: '2026-10-09T00:00:00Z' },
        { toStatus: 'conditionally_approved', createdAt: '2026-10-21T00:00:00Z' },
        { toStatus: 'contract_pending', createdAt: '2026-10-22T00:00:00Z' },
      ],
    })
    expect(l.stops.map((s) => s.state)).toEqual(['done', 'done', 'now', 'ahead'])
    expect(l.stops.map((s) => s.at)).toEqual([SUBMITTED, '2026-10-09T00:00:00Z', '2026-10-21T00:00:00Z', null])
  })

  it('⚠️ ومن قبل بلا مقابلة لا يقال إنه قوبل', () => {
    expect(states({ status: 'conditionally_approved', history: [{ toStatus: 'conditionally_approved', createdAt: '2026-10-21T00:00:00Z' }] }))
      .toEqual(['application:done', 'interview:skipped', 'agreement:now', 'trainers:ahead'])
  })

  it('⚠️ ومن رد إلى المقابلة بعد قبوله: الآن حيث هو لا أبعد ما بلغ', () => {
    expect(states({
      status: 'under_review', interviewsCount: 1, interviewOutcome: 'passed',
      history: [{ toStatus: 'conditionally_approved', createdAt: '2026-10-21T00:00:00Z' }, { toStatus: 'under_review', createdAt: '2026-10-23T00:00:00Z' }],
    })).toEqual(['application:done', 'interview:now', 'agreement:ahead', 'trainers:ahead'])
  })

  it('⚠️ ومن رفض بعد مقابلته: جانبا بتاريخ رفضه، والخط يقول أين بلغ', () => {
    const l = line({
      status: 'rejected', interviewsCount: 1, interviewOutcome: 'failed',
      history: [{ toStatus: 'interview_scheduled', createdAt: '2026-10-09T00:00:00Z' }, { toStatus: 'rejected', createdAt: '2026-10-12T00:00:00Z' }],
    })
    expect(l.aside).toEqual({ stop: 'closed', ar: plainAr('مرفوض'), at: '2026-10-12T00:00:00Z' })
    expect(l.stops.map((s) => s.state)).toEqual(['done', 'done', 'ahead', 'ahead'])
    expect(l.stops.some((s) => s.state === 'now'), 'جانبا وعلى الخط معا').toBe(false)
  })

  it('⚠️ ومن عبر: المدربون الآن بتاريخ عبوره', () => {
    const l = line({
      status: 'active', operating: true, interviewsCount: 1,
      history: [
        { toStatus: 'interview_scheduled', createdAt: '2026-10-09T00:00:00Z' },
        { toStatus: 'conditionally_approved', createdAt: '2026-10-21T00:00:00Z' },
        { toStatus: 'active', createdAt: '2026-10-23T00:00:00Z' },
      ],
    })
    expect(l.stops.map((s) => s.state)).toEqual(['done', 'done', 'done', 'now'])
    expect(l.stops[3].at).toBe('2026-10-23T00:00:00Z')
  })

  it('والأسماء أسماء المحطات بلا تشكيل', () => {
    const l = line({ status: 'deferred', history: [{ toStatus: 'deferred', createdAt: '2026-10-12T00:00:00Z' }] })
    expect(l.stops.map((s) => s.ar)).toEqual(['الطلب', 'المقابلة', 'الاتفاقية', 'المدربون'])
    expect(l.aside!.ar).toBe(plainAr(l.aside!.ar))
  })
})
