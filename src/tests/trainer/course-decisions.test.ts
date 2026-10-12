/* ملفُّ قراراتِ الدورات — القراءةُ والرسم (`course-decisions.ts`).

   ═══ ما يُحرَس ═══

   ① **الملفُّ الخاطئُ يُقال خطؤه كلُّه** — لا أوّلُه وحدَه، ولا يُرسَم منه شيء.
   ② **ما طُبّق يُعرف فلا يُعاد** — المربوطُ بالرمز نفسِه «طُبّق من قبل».
   ③ **وقرارُ إنسانٍ قائمٌ لا يُكتب فوقه** — ولا تُطبَّق خطوةٌ على غير صاحبها.
   ④ **والترتيبُ للمدرّب الواحد** — الاقتراحاتُ ثمّ التأهيلُ ثمّ القراراتُ ثمّ حالُه.
   ⑤ **ولا خطوةَ بلا صلاحيّة زرّها.**
   ⑥ **والمدرّبُ الواحدُ قرارٌ واحد — ولا يمسك غيرَه.**

   والتنفيذُ على قاعدةٍ حقيقيّة — أنّ كلَّ خطوةٍ تقع من باب زرّها — في
   `server/tests/trainer/course-decisions.test.ts`. */

import { describe, expect, it } from 'vitest'
import {
  DECISIONS_KIND, DECISIONS_VERSION, STEP_KINDS, STEP_PERMISSION, parseDecisionsFile, planDecisions,
  type DecisionsFile, type DecisionsWorld, type ProposalState, type TrainerState,
} from '../../application/trainer/course-decisions'

const ALL = new Set(Object.values(STEP_PERMISSION))

const fileOf = (trainers: unknown[]) => ({ kind: DECISIONS_KIND, version: DECISIONS_VERSION, titleAr: 'قرارات', trainers })

function parsed(trainers: unknown[]): DecisionsFile {
  const r = parseDecisionsFile(fileOf(trainers))
  if (!r.ok) throw new Error(r.errorsAr.join(' | '))
  return r.file
}

const proposal = (over: Partial<ProposalState>): ProposalState => ({
  id: 'p1', titleAr: 'دوره الخطابه', summaryAr: null, status: 'submitted', courseId: null, questionAr: null, ...over,
})

const trainer = (over: Partial<TrainerState> & { proposals?: ProposalState[]; quals?: { courseId: string; status: string }[] } = {}): TrainerState => {
  const { proposals = [], quals = [], ...rest } = over
  return {
    reference: 'WJ-TR-2026-00041', fullName: 'إيناس عاهد', applicationId: 'app-1', status: 'conditionally_approved',
    profile: { id: 'prof-1', userId: 'u-trainer', suspended: false, proposals, qualifications: quals },
    ...rest,
  }
}

function world(trainers: TrainerState[], over: Partial<DecisionsWorld> = {}): DecisionsWorld {
  return {
    trainers: new Map(trainers.map((t) => [t.reference, t])),
    courses: new Map([['C-COM-101', 'published'], ['C-COM-102', 'published'], ['C-OLD-101', 'archived']]),
    actorUserId: 'u-admin',
    permissions: ALL,
    permissionLabelAr: (k) => `«${k}»`,
    qualifiableStatuses: ['conditionally_approved', 'contract_pending', 'onboarding', 'active'],
    withdrawProblem: (from) => (from === 'active' ? 'لا يسحب نشط' : null),
    ...over,
  }
}

const entry = (over: Record<string, unknown>) => ({ reference: 'WJ-TR-2026-00041', fullName: 'إيناس عاهد', ...over })

describe('① الملفّ الخاطئ يقال خطؤه كلّه', () => {
  it('غير ملفّ قرارات يردّ بسببه — ولا يقرأ على أنّه ملفّ فارغ', () => {
    expect(parseDecisionsFile({ kind: 'x', version: 1, trainers: [] })).toMatchObject({ ok: false })
    expect(parseDecisionsFile({ kind: DECISIONS_KIND, version: 2, trainers: [] })).toMatchObject({ ok: false })
    expect(parseDecisionsFile(fileOf([]))).toMatchObject({ ok: false })
    expect(parseDecisionsFile([])).toMatchObject({ ok: false })
  })

  it('أخطاء البنود كلّها معا — فيصلح الملفّ مرّة لا مرّات', () => {
    const r = parseDecisionsFile(fileOf([
      { reference: 'WJ-TR-2026-00001', proposals: [{ verdict: 'link' }] },
      entry({ proposals: [{ proposalId: 'p1', verdict: 'ask', questionAr: 'ما؟' }], status: 'suspend' }),
      entry({ qualify: [] }),
    ]))
    expect(r.ok).toBe(false)
    const errs = r.ok ? [] : r.errorsAr
    for (const said of ['بلا «fullName»', 'اقتراح جديد بلا عنوان', 'بلا «courseId»', 'السؤال خمسة أحرف',
      'تغيير الحال بسبب', 'مكرّر في الملفّ', 'لا قرار له']) {
      expect(errs.some((e) => e.includes(said)), `لم يقل: ${said}\n${errs.join('\n')}`).toBe(true)
    }
  })

  it('وقرار مجهول يسمّى ولا يقرأ «بلا قرار»', () => {
    const r = parseDecisionsFile(fileOf([entry({ proposals: [{ proposalId: 'p1', verdict: 'merge' }] })]))
    expect(r.ok ? [] : r.errorsAr).toEqual([expect.stringContaining('قرار مجهول «merge»')])
  })
})

describe('② ما طبّق يعرف فلا يعاد', () => {
  it('المربوط بالرمز نفسه، والمؤهّل، والمسحوب — «طبّقت من قبل»', () => {
    const t = trainer({
      status: 'withdrawn',
      proposals: [proposal({ status: 'linked', courseId: 'C-COM-101' })],
      quals: [{ courseId: 'C-COM-101', status: 'qualified' }],
    })
    const plan = planDecisions(parsed([entry({
      proposals: [{ proposalId: 'p1', verdict: 'link', courseId: 'C-COM-101' }],
      qualify: ['C-COM-101'], status: 'withdraw', statusNoteAr: 'ملفّ مكرّر للتجربة',
    })]), world([t]))
    expect(plan.steps.map((s) => [s.kind, s.state])).toEqual([
      ['qualify', 'done'], ['link', 'done'], ['withdraw', 'done'],
    ])
    expect(plan.applicable, 'ملفّ طبّق كلّه يعرض قابلا للتطبيق').toBe(false)
  })

  it('واقتراح جديد أدخل من قبل يعرف بعنوانه — ولو اختلف الرسم', () => {
    const t = trainer({ proposals: [proposal({ id: 'p9', titleAr: 'إدارة المشاريع لرواد الأعمال' })] })
    const plan = planDecisions(parsed([entry({
      proposals: [{ titleAr: 'ادارة المشاريع لرواد الاعمال', verdict: 'ask', questionAr: 'أيّ إدارة مشاريع تقصد؟' }],
    })]), world([t]))
    const [create, ask] = plan.steps
    expect(create).toMatchObject({ kind: 'create_proposal', state: 'done', proposalId: 'p9' })
    expect(ask).toMatchObject({ kind: 'ask', state: 'todo', proposalId: 'p9', createdByStep: null })
  })

  it('والتصحيح يقاس بالحرف لا بالتطبيع — فالهمزة والتاء المربوطة تصحيح حقيقيّ', () => {
    const t = trainer({ proposals: [proposal({ titleAr: 'دوره الخطابه' })] })
    const [edit] = planDecisions(parsed([entry({
      proposals: [{ proposalId: 'p1', titleAr: 'دورة الخطابة' }],
    })]), world([t])).steps
    expect(edit).toMatchObject({ kind: 'edit_proposal', state: 'todo', titleAr: 'دورة الخطابة' })
  })
})

describe('③ قرار إنسان قائم لا يكتب فوقه', () => {
  it('اقتراح ربط برمز آخر، ومردود — «لا تطبّق» وسببها', () => {
    const t = trainer({
      proposals: [
        proposal({ id: 'p1', status: 'linked', courseId: 'C-COM-102' }),
        proposal({ id: 'p2', status: 'rejected' }),
      ],
    })
    const plan = planDecisions(parsed([entry({
      proposals: [
        { proposalId: 'p1', verdict: 'link', courseId: 'C-COM-101' },
        { proposalId: 'p2', verdict: 'ask', questionAr: 'ما جمهورها؟' },
      ],
    })]), world([t]))
    expect(plan.steps.map((s) => s.state)).toEqual(['blocked', 'blocked'])
    expect(plan.steps[0].reasonAr).toContain('C-COM-102')
    expect(plan.applicable, 'ملفّ فيه ممتنع يعرض قابلا للتطبيق').toBe(false)
  })

  it('ورمز لا دورة به، أو مؤرشف — لا يربط به ولا يؤهّل له', () => {
    const plan = planDecisions(parsed([entry({
      proposals: [{ proposalId: 'p1', verdict: 'became_course', courseId: 'C-NEW-101' }],
      qualify: ['C-OLD-101'],
    })]), world([trainer({ proposals: [proposal({})] })]))
    expect(plan.steps.map((s) => [s.kind, s.state])).toEqual([['qualify', 'blocked'], ['became_course', 'blocked']])
    expect(plan.steps[1].reasonAr).toContain('في الكتالوج بعد')
  })

  it('والمرجع لغير الاسم يمنع خطوات صاحبه كلّها — ولا يربط اقتراح أحد باسم غيره', () => {
    const plan = planDecisions(parsed([{ ...entry({ qualify: ['C-COM-101'] }), fullName: 'ماريا الخوالدة' }]),
      world([trainer({})]))
    expect(plan.steps).toHaveLength(1)
    expect(plan.steps[0]).toMatchObject({ state: 'blocked' })
    expect(plan.steps[0].reasonAr).toContain('إيناس عاهد')
  })

  it('ومن ليس في طور يؤهّل فيه لا يؤهّل — والموقوف مثله', () => {
    const asked = planDecisions(parsed([entry({ qualify: ['C-COM-101'] })]),
      world([trainer({ status: 'under_review' })]))
    const suspended = planDecisions(parsed([entry({ qualify: ['C-COM-101'] })]),
      world([trainer({ profile: { id: 'prof-1', userId: null, suspended: true, proposals: [], qualifications: [] } })]))
    expect(asked.steps[0].state).toBe('blocked')
    expect(suspended.steps[0].state).toBe('blocked')
  })

  it('ولا يوقف أحد نفسه من الملفّ', () => {
    const plan = planDecisions(parsed([entry({ status: 'suspend', statusNoteAr: 'ملفّ تجريبيّ' })]),
      world([trainer({})], { actorUserId: 'u-trainer' }))
    expect(plan.steps[0]).toMatchObject({ kind: 'suspend', state: 'blocked' })
    expect(plan.steps[0].reasonAr).toContain('ملفّك أنت')
  })
})

describe('④ الترتيب للمدرّب الواحد', () => {
  it('الإدخال والتصحيح، ثمّ التأهيل، ثمّ القرارات، ثمّ حاله — والقرار على جديد يتبع إدخاله', () => {
    const plan = planDecisions(parsed([entry({
      proposals: [
        { proposalId: 'p1', titleAr: 'دورة الخطابة', verdict: 'link', courseId: 'C-COM-101' },
        { titleAr: 'التسويق العملي للمشاريع الصغيرة', verdict: 'link', courseId: 'C-COM-102' },
      ],
      qualify: ['C-COM-101', 'C-COM-102'],
      status: 'suspend', statusNoteAr: 'يوقف بعد تأهيله لغرض الاختبار',
    })]), world([trainer({ proposals: [proposal({})] })]))
    expect(plan.steps.map((s) => s.kind)).toEqual([
      'edit_proposal', 'create_proposal', 'qualify', 'qualify', 'link', 'link', 'suspend',
    ])
    const create = plan.steps.find((s) => s.kind === 'create_proposal')!
    const onNew = plan.steps.filter((s) => s.kind === 'link')[1]
    expect(onNew).toMatchObject({ proposalId: null, createdByStep: create.n, state: 'todo' })
    /* والقرارُ يُقرأ بالعنوان بعد تصحيحه */
    expect(plan.steps.filter((s) => s.kind === 'link')[0].labelAr).toContain('دورة الخطابة')
    expect(plan.applicable).toBe(true)
  })

  it('وقرار على جديد لا يدخل يمتنع بامتناع إدخاله', () => {
    const noProfile = trainer({ profile: null })
    const plan = planDecisions(parsed([entry({
      proposals: [{ titleAr: 'فكرة من الفقرة الحرّة', verdict: 'ask', questionAr: 'لمن هي؟ ولكم ساعة؟' }],
    })]), world([noProfile]))
    expect(plan.steps.map((s) => s.state)).toEqual(['blocked', 'blocked'])
  })
})

describe('⑤ ولا خطوة بلا صلاحيّة زرّها', () => {
  it('لكلّ خطوة صلاحيّة — والتأهيل بلا صلاحيّته يمتنع ويسمّيها', () => {
    for (const k of STEP_KINDS) expect(STEP_PERMISSION[k], k).toBeTruthy()
    const plan = planDecisions(parsed([entry({ qualify: ['C-COM-101'] })]), world([trainer({})], {
      permissions: new Set(['trainer.change.review']),
    }))
    expect(plan.steps.map((s) => [s.kind, s.state])).toEqual([['qualify', 'blocked']])
    expect(plan.steps[0].reasonAr).toContain('«trainer.qualify»')
    expect(plan.applicable).toBe(false)
  })
})

describe('⑥ والمدرّب الواحد قرار واحد — ولا يمسك غيره', () => {
  it('خطوة ممتنعة تبقي خطوات صاحبها كلّها — ويطبّق مدرّب آخر سلمت خطواته', () => {
    const other = trainer({ reference: 'WJ-TR-2026-00009', fullName: 'ماريا الخوالدة', applicationId: 'app-2' })
    const plan = planDecisions(parsed([
      entry({
        proposals: [{ proposalId: 'p1', verdict: 'link', courseId: 'C-COM-101' }],
        qualify: ['C-COM-102'],
      }),
      { reference: 'WJ-TR-2026-00009', fullName: 'ماريا الخوالدة', qualify: ['C-COM-101'] },
    ]), world([trainer({ proposals: [proposal({ status: 'rejected' })] }), other]))
    expect(plan.steps.map((s) => [s.reference.slice(-2), s.kind, s.state])).toEqual([
      ['41', 'qualify', 'blocked'], ['41', 'link', 'blocked'], ['09', 'qualify', 'todo'],
    ])
    /* والمتروكُ يقول لمَ تُرك — والممتنعُ يقول لمَ امتنع */
    expect(plan.steps[0].reasonAr).toContain('الخطوة 2')
    expect(plan.steps[1].reasonAr).toContain('رفض')
    expect(plan.applicable, 'مدرّب ممتنع أمسك غيره').toBe(true)
  })
})
