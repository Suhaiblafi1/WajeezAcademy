/* مهامُّ بعد الاعتماد — ما تقوله الشاشاتُ الثلاث (٣ج-٣).

   القاعدةُ محضةٌ في `task-approval.test.ts`، وأثرُها في الخادم في
   `server/tests/learning/task-approval.test.ts`. وهنا أنّ الشاشات تقول ما يحكم
   به الخادم: قائمةُ المعتمِد بما تغيّر سطرا سطرا، والمنهجُ بما سيُعتمَد، وورشةُ
   المدرّب بحال كلّ مهمّةٍ وبرسالةٍ ممّا عاد لا ثابتة. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PendingTasks, type PendingTaskRow } from '@/components/PendingTasks'
import { awaitingTasks } from '@/application/trainer/task-approval'
import CurriculumReview from '@/components/CurriculumReview'
import { curriculumView } from '@/application/trainer/curriculum-view'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const WORKSPACE = code('src/pages/trainer/CohortWorkspace.tsx')
const COHORT_OPS = code('src/pages/admin/CohortOps.tsx')

const base = { type: 'assignment', maxScore: 100, moduleId: 'm1', dueAt: '2027-02-13T20:59:59.999Z', briefAr: 'صفحةٌ واحدة' }
const ROWS: PendingTaskRow[] = [
  { id: 'live', title: 'منشورةٌ بلا طلب', status: 'published', ...base },
  { id: 'new', title: 'جديدةٌ بعد الاعتماد', status: 'draft', ...base, briefAr: 'ارسم خريطةَ المشروع' },
  { id: 'edit', title: 'عنوانٌ معتمَد', status: 'published', ...base, pendingChange: { kind: 'edit', fields: { title: 'عنوانٌ مقترَح' } } },
  { id: 'remove', title: 'تُحذف', status: 'published', ...base, pendingChange: { kind: 'remove' } },
  { id: 'declined', title: 'مردودة', status: 'draft', ...base, reviewerNote: 'مكرّرة' },
]
const axisNo = new Map([['m1', 1]])
const render = (tasks: PendingTaskRow[]) =>
  renderToStaticMarkup(createElement(PendingTasks, { tasks, axisNo, busy: false, onDecide: async () => true }))

describe('قائمةُ المعتمِد — ما ينتظر قرارَه', () => {
  it('⚠️ ما ينتظر ثلاثة — ولا شيءَ قبل أوّل اعتماد', () => {
    expect(awaitingTasks(ROWS, true).map((r) => r.id)).toEqual(['new', 'edit', 'remove'])
    expect(awaitingTasks(ROWS, false)).toEqual([])
    expect(render([])).toBe('')
  })

  it('⚠️ المعدَّلةُ بما تغيّر فيها سطرا سطرا — القديمُ مشطوبٌ والجديدُ بعده', () => {
    const html = render(awaitingTasks(ROWS, true))
    expect(html).toContain('مهامُّ تنتظر قرارك (3)')
    expect(html).toMatch(/<dt[^>]*>العنوان:<\/dt><dd[^>]*><s[^>]*>عنوانٌ معتمَد<\/s> ← <span[^>]*>عنوانٌ مقترَح<\/span><\/dd>/)
    expect(html).toContain('اعتمِد التعديل')
  })

  it('⚠️ والجديدةُ بتعليماتها، والمطلوبُ حذفُها مشطوبةٌ بزرّها', () => {
    const html = render(awaitingTasks(ROWS, true))
    expect(html).toContain('مهمّةٌ جديدة')
    expect(html).toContain('ارسم خريطةَ المشروع')
    expect(html).toMatch(/class="[^"]*line-through[^"]*">تُحذف</)
    expect(html).toContain('اعتمِد الحذف')
    expect(html, 'المردودةُ عادت إلى القائمة').not.toContain('مردودة')
  })
})

describe('والمنهجُ ما سيُعتمَد', () => {
  const view = (approvedOnce: boolean) => curriculumView({
    title: 'شعبة', period: null, approvedOnce,
    content: { modules: [{ moduleId: 'm1', titleAr: 'الأوّل' }] },
    sessions: [],
    assessments: ROWS.map((r) => ({ ...r, status: r.status ?? 'published' })),
  })

  it('⚠️ المعدَّلةُ بقيمها المقترَحة وعلامتها — والمردودةُ قبل نشرها ليست منه', () => {
    const tasks = view(true).groups[0].tasks
    expect(tasks.map((t) => [t.id, t.title, t.review ?? null])).toEqual([
      ['live', 'منشورةٌ بلا طلب', null],
      ['new', 'جديدةٌ بعد الاعتماد', 'new'],
      ['edit', 'عنوانٌ مقترَح', 'edit'],
      ['remove', 'تُحذف', 'remove'],
    ])
    expect(view(true).counts.tasks).toBe(4)
  })

  it('⚠️ وقبل أوّل اعتمادٍ لا علامة — الخطّةُ كلُّها تنتظر', () => {
    const tasks = view(false).groups[0].tasks
    expect(tasks.find((t) => t.id === 'new')?.review).toBeUndefined()
  })

  it('والصفحةُ تقول العلامة — والمطلوبُ حذفُها مشطوبة', () => {
    const html = renderToStaticMarkup(createElement(CurriculumReview, { view: view(true) }))
    expect(html).toContain('معدَّلةٌ — تنتظر الاعتماد')
    expect(html).toContain('جديدةٌ — تنتظر الاعتماد')
    expect(html).toMatch(/class="[^"]*line-through[^"]*">تُحذف</)
  })
})

describe('وورشةُ المدرّب تقول ما حكم به الخادم', () => {
  it('⚠️ حالُ كلّ مهمّةٍ بالقاعدة وبحال خطّته — لا بحالها وحدَها', () => {
    /* والقائمةُ صارت قائمةَ اللسان المفتوح (٣٠ سبتمبر ٢٠٢٦) — والقاعدةُ هي هي */
    expect(WORKSPACE).toMatch(/\{shownTasks\.map\(\(a\) => \{\s*\/\*[^*]*\*\/\s*const review = taskReview\(a, ws\.approvedOnce \?\? false\);/)
    expect(WORKSPACE).toMatch(/\{review === "remove" \? \(\s*<Button[^>]*onClick=\{\(\) => withdrawChange\(a\)\}>تراجَع عن الحذف<\/Button>/)
  })

  it('⚠️ و«عدّل» يفتح الطلبَ لا المعتمَد — فتعديلُه يعدّل الطلب', () => {
    const edit = WORKSPACE.slice(WORKSPACE.indexOf('const editAssessment ='))
    const body = edit.slice(0, edit.indexOf('\n  };'))
    expect(body).toMatch(/const v = proposedTask\(taskValues\(a\), readTaskChange\(a\.pendingChange\)\);/)
    expect(body, 'النموذجُ يُملأ من المعتمَد').not.toMatch(/setTaskForm\(\{ title: a\.title/)
  })

  it('⚠️ ورسالةُ الحفظ والحذف ممّا عاد — لا «يراه المسجّلون» عن تعديلٍ ينتظر', () => {
    expect(WORKSPACE).toMatch(/\}, \(r\) => savedTaskMsg\(\(r as \{ review\?: string \} \| null\)\?\.review, Boolean\(editingId\)\)\);/)
    expect(WORKSPACE, 'بقيت الرسالةُ الثابتة').not.toMatch(/\}, editingId \? "حُفظ التعديل/)
    expect(WORKSPACE).toMatch(/\}, \(r\) => \(\(r as \{ review\?: string \} \| null\)\?\.review === "remove"/)
  })

  it('وسحبُ الطلب بمسلكه، والمنهجُ بعلاماته', () => {
    expect(WORKSPACE).toMatch(/apiPost\(`\/api\/trainer\/assessments\/\$\{a\.id\}\/withdraw-change`, \{\}\)/)
    expect(WORKSPACE).toMatch(/assessments: ws\.assessments,\s*approvedOnce: ws\.approvedOnce,/)
  })
})

describe('وبطاقةُ المعتمِد', () => {
  it('⚠️ قائمتُه بالقاعدة التي يحكم بها الخادم، وقرارُه بمسلكه', () => {
    expect(COHORT_OPS).toMatch(/const waitingTasks = trainerPlan \? awaitingTasks\(trainerPlan\.assessments, trainerPlan\.approvedOnce \?\? false\) : \[\];/)
    expect(COHORT_OPS).toMatch(/<PendingTasks\s+tasks=\{waitingTasks\}/)
    expect(COHORT_OPS).toMatch(/apiPost\(`\/api\/admin\/cohort-assessments\/\$\{id\}\/decide`, \{ approve, note \}\)/)
    expect(COHORT_OPS).toMatch(/assessments: trainerPlan\.assessments,\s*approvedOnce: trainerPlan\.approvedOnce,/)
  })

  it('⚠️ واعتمادُ الخطّة يقول مهامَّها — وما بقي منها بسببه', () => {
    const msg = COHORT_OPS.slice(COHORT_OPS.indexOf('function approvedMsg('), COHORT_OPS.indexOf('function taskDecisionMsg('))
    expect(msg).toMatch(/const t = r\.tasks;/)
    expect(msg).toMatch(/return `اعتُمدت خطّةُ المدرّب\$\{withMeetings\}\$\{withTasks\}\$\{failed\}\$\{tasksLeft\}`;/)
  })
})
