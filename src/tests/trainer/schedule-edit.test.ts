/* الجدولُ بندا واحدا بسلسلته — نوعُ `schedule` في التعديلات المقترحة (١١ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «في حال قمنا بتعديل شيءٍ قد يؤثّر على توقيتاتٍ أخرى يجب أن يكون التعديلُ كاملا
   بسلسلة، لكي لا نخرّب بدلَ ما نُصلح».

   ① البندُ يُقرأ: كلُّ لقاءٍ بما كان وما نقترح، ثمّ مواعيدُ المهامّ التي تتبعه — تحت «جدولٌ ثابت».
   ② ويُفحص قبل أن يُحفظ: لا جدولَ فارغ، ولا لقاءَ مرّتين، ولا نهايةَ قبل بداية.
   ③ واللقطةُ مسطّحةٌ تُقارَن — وما حُذف من الشعبة لا يُقترح عليه.
   ④ ونقلُ لقاءٍ وحدَه يُردّ إن كسر ما حوله — والجدولُ يُقرأ كلُّه بعد نقله، فما نقله معه لا يُعدّ كسرا.
   ⑤ والإدارةُ تطلبه بزرٍّ حين تكون في الإيقاع نصيحة — والقيدُ في القاعدة يتّسع له. */

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  planEditStep, planEditView, rowEditProblem, scheduleChainProblem, schedulePlanContent, scheduleSnapshot, sessionMoveChainProblem,
  type PlanEdit,
} from '@/application/trainer/plan-edits'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

/* عمّانُ على +٣: ١٨:٠٠ فيها ١٥:٠٠ بغرينتش */
const sessions = [
  { id: 's1', title: 'اللقاء الأوّل', startsAt: '2026-12-05T15:00:00.000Z', endsAt: '2026-12-05T17:00:00.000Z', moduleIds: ['M1'] },
  { id: 's2', title: 'اللقاء الثاني', startsAt: '2026-12-14T16:00:00.000Z', endsAt: '2026-12-14T18:00:00.000Z', moduleIds: ['M2'] },
  { id: 's3', title: 'اللقاء الثالث', startsAt: '2026-12-19T15:00:00.000Z', endsAt: '2026-12-19T17:00:00.000Z', moduleIds: ['M3'] },
]
const tasks = [
  { id: 't2', title: 'واجب المحور الثاني', type: 'assignment', moduleId: 'M2', dueAt: '2026-12-16T20:59:00.000Z' },
  { id: 'p', title: 'مشروع التخرّج', type: 'project', moduleId: null, dueAt: '2027-01-20T20:59:00.000Z' },
]
const schedule = (over: Partial<Extract<PlanEdit, { kind: 'schedule' }>> = {}): Extract<PlanEdit, { kind: 'schedule' }> => ({
  kind: 'schedule', weekday: 6, clock: '18:00',
  moves: [{ sessionId: 's2', startsAt: '2026-12-12T15:00:00.000Z', endsAt: '2026-12-12T17:00:00.000Z' }],
  tasks: [{ assessmentId: 't2', dueAt: '2026-12-14T20:59:00.000Z' }],
  ...over,
})
const C = { modules: [{ moduleId: 'M1', titleAr: 'أ' }, { moduleId: 'M2', titleAr: 'ب' }, { moduleId: 'M3', titleAr: 'ج' }], resources: [] }
const ctx = {
  moduleIds: ['M1', 'M2', 'M3'],
  sessionTitle: (id: string) => sessions.find((s) => s.id === id)?.title ?? null,
  taskTitle: (id: string) => tasks.find((t) => t.id === id)?.title ?? null,
}

describe('① البند يقرأ: ما كان وما نقترح — لكلّ لقاء ولكلّ مهمّة تتبعه', () => {
  it('⚠️ عنوانه اليوم والساعة، وصفّ لكلّ لقاء منقول، ثمّ صفّ لكلّ موعد مهمّة — في «اللقاءات»', () => {
    const edit = schedule()
    const snap = scheduleSnapshot(edit, sessions, tasks)
    if (!snap.ok) throw new Error(snap.problemAr)
    const v = planEditView(edit, snap.value, ctx)
    expect(v.titleAr).toBe('جدول ثابت: السبت 18:00 كلّ أسبوع')
    expect(planEditStep(edit)).toBe('sessions')
    expect(v.rows.map((r) => r.labelAr)).toEqual(['اللقاء الثاني', 'موعد «واجب المحور الثاني»'])
    /* ما كان: الاثنين ١٩:٠٠ — وما نقترح: السبت ١٨:٠٠ */
    expect(v.rows[0]!.beforeAr).toBe('الاثنين، 14 ديسمبر في 7:00 م حتّى 9:00 م')
    expect(v.rows[0]!.afterAr).toBe('السبت، 12 ديسمبر في 6:00 م حتّى 8:00 م')
    expect(v.rows[1]!.beforeAr).not.toBe(v.rows[1]!.afterAr)
    expect(v.rows[1]!.beforeAr).toBeTruthy()
  })
})

describe('①ب وعنوانه من أيّام لقاءاته المنقولة — لا من يومٍ واحد (١٣ أكتوبر ٢٠٢٦)', () => {
  /* «سبت وأربعاء فقط» (مدرّبٌ طلب لقاءين في الأسبوع): كان العنوانُ «السبت 19:00 كلّ أسبوع» ونصفُ لقاءاته أربعاء */
  const twice = (wedClock: string) => schedule({
    weekday: 6, clock: '19:00',
    moves: [
      { sessionId: 's1', startsAt: '2026-12-05T16:00:00.000Z', endsAt: '2026-12-05T18:00:00.000Z' },
      { sessionId: 's2', startsAt: `2026-12-09T${wedClock}:00.000Z`, endsAt: '2026-12-09T19:00:00.000Z' },
      { sessionId: 's3', startsAt: '2026-12-12T16:00:00.000Z', endsAt: '2026-12-12T18:00:00.000Z' },
    ],
    tasks: [],
  })
  const title = (edit: Extract<PlanEdit, { kind: 'schedule' }>) => {
    const snap = scheduleSnapshot(edit, sessions, tasks)
    if (!snap.ok) throw new Error(snap.problemAr)
    return planEditView(edit, snap.value, ctx).titleAr
  }
  it('⚠️ يومان بساعةٍ واحدة: «السبت والأربعاء 19:00» — بترتيب وقوعهما', () => {
    expect(title(twice('16:00'))).toBe('جدول ثابت: السبت والأربعاء 19:00 كلّ أسبوع')
  })
  it('⚠️ وإن اختلفت الساعة قيلت لكلّ يوم', () => {
    expect(title(twice('15:00'))).toBe('جدول ثابت: السبت 19:00 والأربعاء 18:00 كلّ أسبوع')
  })
})

describe('①ج ويحمل حدود الخطّة التي يحتاجها — آخر يوم في المدّة ومواعيد المحاور (١٣ أكتوبر ٢٠٢٦)', () => {
  /* «سبت وأربعاء فقط» على ستّة عشر لقاءً: ثمانية أسابيع تتجاوز مدّة الشعبة، وكلّ لقاءٍ يخرج من موعد محوره */
  const P = {
    modules: C.modules, resources: [], startsOn: '2026-12-05', endsOn: '2026-12-20',
    slots: [
      { moduleIds: ['M1'], startsOn: '2026-12-05', endsOn: '2026-12-06' },
      { moduleIds: ['M2'], startsOn: '2026-12-12', endsOn: '2026-12-14' },
      { moduleIds: ['M3'], startsOn: '2026-12-19', endsOn: '2026-12-20' },
    ],
  }
  const wide = (over: Partial<NonNullable<Extract<PlanEdit, { kind: 'schedule' }>['plan']>> = {}) => schedule({
    moves: [{ sessionId: 's3', startsAt: '2026-12-26T16:00:00.000Z', endsAt: '2026-12-26T18:00:00.000Z' }],
    tasks: [],
    plan: { endsOn: '2027-01-02', slots: [{ moduleIds: ['M3'], startsOn: '2026-12-26', endsOn: '2027-01-02' }], ...over },
  })
  it('⚠️ يقرأ: آخر يوم في المدّة، وموعد كلّ محور ينقله — بما كان وما نقترح', () => {
    const edit = wide()
    const snap = scheduleSnapshot(edit, sessions, tasks, P)
    if (!snap.ok) throw new Error(snap.problemAr)
    expect(snap.value).toMatchObject({ 'p:endsOn': '2026-12-20', 'slot:M3:startsOn': '2026-12-19', 'slot:M3:endsOn': '2026-12-20' })
    const v = planEditView(edit, snap.value, ctx)
    const end = v.rows.find((r) => r.labelAr === 'آخر يوم في مدة الشعبة')
    expect(end?.beforeAr).toBe('20 ديسمبر')
    expect(end?.afterAr).toBe('2 يناير')
    const slot = v.rows.find((r) => r.labelAr === 'موعد المحور 3')
    expect(slot?.beforeAr).toBe('19 ديسمبر — 20 ديسمبر')
    expect(slot?.afterAr).toBe('26 ديسمبر — 2 يناير')
  })
  it('⚠️ والخطّة بعده: المدّة أطول وموعد المحور الثالث نُقل — وما سواه كما هو', () => {
    const next = schedulePlanContent(P, wide())
    if (!next.ok) throw new Error(next.problemAr)
    expect(next.value.endsOn).toBe('2027-01-02')
    expect(next.value.slots.map((s) => `${s.startsOn}..${s.endsOn}`)).toEqual(['2026-12-05..2026-12-06', '2026-12-12..2026-12-14', '2026-12-26..2027-01-02'])
    expect(rowEditProblem(wide(), P)).toBeNull()
  })
  it('⚠️ ويردّ: محورا لا موعد له، وموعدا خارج المدّة، ونهاية قبل البداية', () => {
    expect(rowEditProblem(wide({ slots: [{ moduleIds: ['M9'], startsOn: '2026-12-26', endsOn: '2027-01-02' }] }), P)).toMatch(/لا موعد له في الخطة/)
    expect(rowEditProblem(wide({ endsOn: '2026-12-28' }), P)).toMatch(/خارج مدة الشعبة/)
    expect(rowEditProblem(wide({ endsOn: '2026-11-01' }), P)).toMatch(/قبل أولها/)
    expect(rowEditProblem(wide({ slots: [{ moduleIds: ['M3'], startsOn: '2027-01-02', endsOn: '2026-12-26' }] }), P)).toMatch(/قبل بدايته/)
  })
})

describe('② ويفحص قبل أن يحفظ', () => {
  it('⚠️ لا جدول فارغ، ولا لقاء مرّتين، ولا لحظة غير مقروءة، ولا نهاية قبل بداية', () => {
    expect(rowEditProblem(schedule(), C)).toBeNull()
    expect(rowEditProblem(schedule({ moves: [] }), C)).toMatch(/بلا لقاء/)
    const m = schedule().moves[0]!
    expect(rowEditProblem(schedule({ moves: [m, m] }), C)).toMatch(/مرّتين/)
    expect(rowEditProblem(schedule({ moves: [{ ...m, startsAt: 'السبت' }] }), C)).toMatch(/ليس لحظة/)
    expect(rowEditProblem(schedule({ moves: [{ ...m, endsAt: m.startsAt }] }), C)).toMatch(/قبل بدايته/)
    expect(rowEditProblem(schedule({ tasks: [{ assessmentId: 't2', dueAt: 'غدا' }] }), C)).toMatch(/مهمّة في الجدول/)
  })
})

describe('③ اللقطة مسطّحة — وما حذف لا يقترح عليه', () => {
  it('⚠️ موعد كلّ لقاء ينقله وموعد كلّ مهمّة تتبعه — بمفاتيح مسطّحة', () => {
    const snap = scheduleSnapshot(schedule(), sessions, tasks)
    expect(snap).toEqual({
      ok: true,
      value: { 's:s2:startsAt': '2026-12-14T16:00:00.000Z', 's:s2:endsAt': '2026-12-14T18:00:00.000Z', 't:t2:dueAt': '2026-12-16T20:59:00.000Z' },
    })
  })

  it('⚠️ لقاء أو مهمّة لا وجود لها في الشعبة — يردّ البند ولا يحفظ', () => {
    expect(scheduleSnapshot(schedule(), sessions.filter((s) => s.id !== 's2'), tasks)).toMatchObject({ ok: false, problemAr: expect.stringMatching(/لقاء لا وجود له/) })
    expect(scheduleSnapshot(schedule(), sessions, tasks.filter((t) => t.id !== 't2'))).toMatchObject({ ok: false, problemAr: expect.stringMatching(/مهمّة لا وجود لها/) })
  })
})

describe('④ ونقل لقاء وحده لا يكسر ما حوله', () => {
  const move = (sessionId: string, startsAt: string, endsAt: string) => ({ kind: 'session_move' as const, sessionId, startsAt, endsAt })

  it('⚠️ يقع على لقاء آخر في الوقت نفسه — يردّ باسمه', () => {
    expect(sessionMoveChainProblem(move('s2', '2026-12-19T16:00:00.000Z', '2026-12-19T18:00:00.000Z'), sessions, tasks))
      .toMatch(/يقع على لقاء «اللقاء الثالث»/)
  })

  it('⚠️ يتأخّر بعد موعد مهمّة محوره — فتصير المهمّة قبل اللقاء الذي تشرح فيه', () => {
    expect(sessionMoveChainProblem(move('s2', '2026-12-17T15:00:00.000Z', '2026-12-17T17:00:00.000Z'), sessions, tasks))
      .toMatch(/«واجب المحور الثاني» يصير قبل اللقاء/)
  })

  it('ويتقدّم أو يتأخّر بلا أن يمسّ شيئا — يمرّ، والمشروع بلا محور لا يتبع لقاء', () => {
    expect(sessionMoveChainProblem(move('s2', '2026-12-12T15:00:00.000Z', '2026-12-12T17:00:00.000Z'), sessions, tasks)).toBeNull()
    expect(sessionMoveChainProblem(move('s3', '2026-12-21T16:00:00.000Z', '2026-12-21T18:00:00.000Z'), sessions, tasks)).toBeNull()
  })

  it('⚠️ والجدول يقرأ كلّه بعد نقله: لقاءان يتبادلان موعديهما معا يمرّان، ونقل أحدهما وحده يردّ', () => {
    const swap = schedule({
      moves: [
        { sessionId: 's2', startsAt: '2026-12-19T15:00:00.000Z', endsAt: '2026-12-19T17:00:00.000Z' },
        { sessionId: 's3', startsAt: '2026-12-14T16:00:00.000Z', endsAt: '2026-12-14T18:00:00.000Z' },
      ],
      tasks: [{ assessmentId: 't2', dueAt: '2026-12-21T20:59:00.000Z' }],
    })
    expect(scheduleChainProblem(swap, sessions, tasks)).toBeNull()
    expect(sessionMoveChainProblem(move('s2', '2026-12-19T15:00:00.000Z', '2026-12-19T17:00:00.000Z'), sessions, tasks)).toMatch(/يقع على لقاء/)
  })

  it('⚠️ وجدول نسي مهمّة تتبع لقاء نقله — يردّ باسم اللقاء والمهمّة', () => {
    const late = schedule({ moves: [{ sessionId: 's2', startsAt: '2026-12-17T15:00:00.000Z', endsAt: '2026-12-17T17:00:00.000Z' }], tasks: [] })
    expect(scheduleChainProblem(late, sessions, tasks)).toMatch(/«اللقاء الثاني»: موعد مهمّة «واجب المحور الثاني»/)
    expect(scheduleChainProblem({ ...late, tasks: [{ assessmentId: 't2', dueAt: '2026-12-19T20:59:00.000Z' }] }, sessions, tasks)).toBeNull()
  })
})

describe('⑤ والإدارة تطلبه بزرّ — والقاعدة تتّسع له', () => {
  it('⚠️ الخادم يفحص كلّ نقل وكلّ جدول بسلسلته في الرفع — ويطبّق الجدول كلّه أو لا شيء', () => {
    const svc = code('server/services/plan-edit.service.ts')
    expect(svc).toMatch(/if \(edit\.kind === 'session_move'\) \{\s*const chain = sessionMoveChainProblem\(edit, /)
    expect(svc).toMatch(/if \(edit\.kind === 'schedule'\) \{\s*const chain = scheduleChainProblem\(edit, /)
    expect(svc).toMatch(/case 'schedule': return scheduleSnapshot\(edit, r\.sessions, r\.tasks, r\.content\)/)
    /* وحدودُ الخطّة تُحفظ قبل أن يُفحص نقل — ويُسجَّل ما يعيدها (١٣ أكتوبر ٢٠٢٦). وتُكتب في الخطّة المعتمدة
       مباشرةً إن كانت معتمدة، وإلّا بحفظه هو (١٧ أكتوبر ٢٠٢٦، `writeContent`) */
    expect(svc).toMatch(/await this\.writeContent\(userId, cohortId, next\.value, onApproved\)\s*done\.push\(\(\) => this\.writeContent\(userId, cohortId, r\.content, onApproved\)\)\s*\}\s*for \(const m of edit\.moves\) \{\s*await this\.cohorts\.assertTrainerMove/)
    expect(svc).toMatch(/return onApproved\s*\? this\.plans\.writeApprovedContent\(userId, cohortId, onApproved\.planId, content\)\s*: this\.plans\.savePlan\(userId, cohortId, content\)/)
    expect(svc).toMatch(/catch \(e\) \{\s*for \(const undo of done\.reverse\(\)\) await undo\(\)/)
    /* وكلُّ لقاءٍ يُفحص قبل أن يُنقل أوّلُها */
    expect(svc).toMatch(/\}\s*for \(const m of edit\.moves\) \{\s*await this\.cohorts\.assertTrainerMove\(userId, m\.sessionId, [^\n]*\n\s*\}\s*for \(const m of edit\.moves\) \{[^}]*trainerMoveSession/)
  })

  it('⚠️ زرّ «جهّز جدولا ثابتا مقترحا» يطلب مسلكه — ويظهر حين يكون في الإيقاع أو الأوقات نصيحة', () => {
    const ui = code('src/components/PlanEdits.tsx')
    expect(ui).toMatch(/apiPost<PlanEditItem\[\]>\(`\/api\/admin\/cohort-plans\/\$\{planId\}\/edits\/schedule`, \{\}\)/)
    expect(ui).toMatch(/\{offerSchedule && \(\s*<Button[^>]*onClick=\{\(\) => void schedule\(\)\}>\s*جهّز جدولا ثابتا مقترحا/)
    expect(code('src/components/admin/TrainerPlanReview.tsx'))
      .toMatch(/offerSchedule=\{scorecard\.some\(\(i\) => \(i\.key === "rhythm" \|\| i\.key === "session_times"\) && i\.status !== "ok"\)\}/)
    expect(code('server/http/routes/admin-learning.routes.ts'))
      .toMatch(/app\.post\('\/api\/admin\/cohort-plans\/:id\/edits\/schedule', \{\s*preHandler: requirePermission\('cohort\.plan\.approve'\)/)
  })

  it('⚠️ وقيد النوع في القاعدة يقبل `schedule` — آخر هجرة تمسّه', () => {
    const dir = join(process.cwd(), 'prisma/migrations')
    const last = readdirSync(dir).sort().reverse()
      .map((d) => { try { return readFileSync(join(dir, d, 'migration.sql'), 'utf8') } catch { return '' } })
      .find((s) => /ADD CONSTRAINT "PlanEditSuggestion_kind_allowed"/.test(s))
    expect(last).toMatch(/CHECK \("kind" IN \([^)]*'schedule'[^)]*\)\)/)
  })
})
