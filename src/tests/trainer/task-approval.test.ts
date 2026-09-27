/* مهامُّ بعد الاعتماد — القاعدةُ محضةً (٣ج-٣).

   العلّةُ كاملةً في رأس `application/trainer/task-approval.ts`. وأثرُها في الخادم
   — المسودّةُ والطلبُ والقرارُ واعتمادُ الخطّة وما لا يراه المتعلّم — في
   `server/tests/learning/task-approval.test.ts`. */

import { describe, expect, it } from 'vitest'
import {
  TASK_FIELDS, TASK_FIELD_LABELS, applyTaskPatch, awaitsDecision, changeLines, diffTask, formatTaskValue,
  nextEditChange, planApprovalApplies, proposedTask, readTaskChange, taskReview, taskValues, toTaskPatch,
  type TaskChange, type TaskValueFormat,
} from '@/application/trainer/task-approval'

const now = new Date('2027-02-10T09:00:00.000Z')
const live = taskValues({
  title: 'اكتب خطّةَ مشروعك', briefAr: 'صفحةٌ واحدة', type: 'assignment', maxScore: 100,
  dueAt: new Date('2027-02-13T20:59:59.999Z'), moduleId: 'm1',
  attachments: [{ title: 'نموذج', url: 'https://x.test/a.pdf', kind: 'file' }],
})
const fmt: TaskValueFormat = {
  type: (t) => ({ assignment: 'واجب', quiz: 'اختبار', project: 'مشروع' })[t] ?? t,
  date: (v) => `يوم ${v.slice(0, 10)}`,
  axis: (id) => `المحور ${id.slice(1)}`,
}

describe('حالُ المهمّة في الاعتماد', () => {
  it('⚠️ المسودّةُ قبل أوّل اعتمادٍ ليست «جديدةً تنتظر» — وبعده هي', () => {
    expect(taskReview({ status: 'draft' }, false)).toBe('draft')
    expect(taskReview({ status: 'draft' }, true)).toBe('new')
  })

  it('⚠️ والمنشورةُ بطلبها — تعديلا أو حذفا', () => {
    expect(taskReview({ status: 'published', pendingChange: { kind: 'edit', fields: { title: 'جديد' } } }, true)).toBe('edit')
    expect(taskReview({ status: 'published', pendingChange: { kind: 'remove' } }, true)).toBe('remove')
    expect(taskReview({ status: 'published', pendingChange: null }, true)).toBe('live')
  })

  it('⚠️ والمردودةُ مردودة — مسودّةً أو طلبا على منشورة، والطلبُ الجديدُ يسبق الردَّ القديم', () => {
    expect(taskReview({ status: 'draft', reviewerNote: 'مكرّرة' }, true)).toBe('declined')
    expect(taskReview({ status: 'published', reviewerNote: 'لا' }, true)).toBe('declined')
    expect(taskReview({ status: 'published', reviewerNote: 'لا', pendingChange: { kind: 'remove' } }, true)).toBe('remove')
    expect(taskReview({ status: 'closed', pendingChange: { kind: 'remove' } }, true)).toBe('closed')
  })

  it('⚠️ ما ينتظر القرارَ ثلاثة — واعتمادُ الخطّة يزيد عليها مسودّاتِ ما قبله، لا المردود', () => {
    const all = ['live', 'draft', 'new', 'edit', 'remove', 'declined', 'closed'] as const
    expect(all.filter(awaitsDecision)).toEqual(['new', 'edit', 'remove'])
    expect(all.filter(planApprovalApplies)).toEqual(['draft', 'new', 'edit', 'remove'])
  })
})

describe('الطلبُ محفوظا يُقرأ دفاعيّا', () => {
  it('⚠️ الحقلُ المشوّهُ يسقط وحدَه — لا الطلبُ كلُّه', () => {
    const c = readTaskChange({
      kind: 'edit', requestedAt: 'x',
      fields: { title: 'جديد', maxScore: 0, type: 'essay', dueAt: 'ليس تاريخا', moduleId: 'm2', briefAr: null, extra: 1 },
    })
    expect(c).toEqual({ kind: 'edit', requestedAt: 'x', fields: { title: 'جديد', moduleId: 'm2', briefAr: null } })
  })

  it('⚠️ وطلبُ تعديلٍ لم يبقَ فيه حقلٌ ليس طلبا', () => {
    expect(readTaskChange({ kind: 'edit', fields: { maxScore: -3 } })).toBeNull()
    expect(readTaskChange({ kind: 'edit' })).toBeNull()
    expect(readTaskChange({ kind: 'rename' })).toBeNull()
    expect(readTaskChange('remove')).toBeNull()
    expect(readTaskChange(null)).toBeNull()
  })
})

describe('طلبُ التعديل — ما يفترق عن المعتمَد وحدَه', () => {
  it('⚠️ حقلٌ واحدٌ تغيّر يُطلب وحدَه', () => {
    expect(nextEditChange(live, null, { title: 'خطّةٌ في صفحتين' }, now))
      .toEqual({ kind: 'edit', fields: { title: 'خطّةٌ في صفحتين' }, requestedAt: now.toISOString() })
  })

  it('⚠️ ومن أعاد القيمَ إلى المعتمَد سحب طلبَه — لا «تعديلٌ» فارغٌ يصل الإدارة', () => {
    expect(nextEditChange(live, null, { title: live.title, maxScore: 100 }, now)).toBeNull()
    const prev: TaskChange = { kind: 'edit', fields: { title: 'مؤقّت' }, requestedAt: 'x' }
    expect(nextEditChange(live, prev, { title: live.title }, now)).toBeNull()
  })

  it('⚠️ وتعديلُ الطلب يعدّل الطلبَ — لا يبدأ من المعتمَد فيمحو ما طُلب قبلُ', () => {
    const prev: TaskChange = { kind: 'edit', fields: { title: 'مؤقّت' }, requestedAt: 'x' }
    expect(nextEditChange(live, prev, { maxScore: 50 }, now))
      .toMatchObject({ kind: 'edit', fields: { title: 'مؤقّت', maxScore: 50 } })
    /* والحذفُ المطلوبُ يحلّ محلَّه التعديلُ — آخرُ ما أراده صاحبُه */
    expect(nextEditChange(live, { kind: 'remove', requestedAt: 'x' }, { maxScore: 80 }, now))
      .toMatchObject({ kind: 'edit', fields: { maxScore: 80 } })
  })

  it('⚠️ والقيمةُ نفسُها بصيغةٍ أخرى ليست تعديلا — تاريخٌ ونصٌّ فارغٌ ونوعُ مرفق', () => {
    const same = toTaskPatch({
      dueAt: '2027-02-13T20:59:59.999Z', briefAr: 'صفحةٌ واحدة',
      attachments: [{ title: 'نموذج', url: 'https://x.test/a.pdf', kind: 'file' }],
    })
    expect(diffTask(live, applyTaskPatch(live, same))).toEqual({})
    const blank = taskValues({ title: 't', briefAr: '', type: 'quiz', maxScore: 5 })
    expect(diffTask(blank, applyTaskPatch(blank, toTaskPatch({ briefAr: '   ' })))).toEqual({})
    const plain = taskValues({ title: 't', type: 'quiz', maxScore: 5, attachments: [{ title: 'أ', url: 'https://x.test/1' }] })
    expect(diffTask(plain, applyTaskPatch(plain, toTaskPatch({ attachments: [{ title: 'أ', url: 'https://x.test/1', kind: 'link' }] })))).toEqual({})
  })

  it('⚠️ والمحوُ المقصودُ تعديلٌ — `null` ليس «لم يُرسَل»', () => {
    expect(toTaskPatch({})).toEqual({})
    expect(nextEditChange(live, null, toTaskPatch({ briefAr: null, dueAt: null, moduleId: '' }), now))
      .toMatchObject({ fields: { briefAr: null, dueAt: null, moduleId: null } })
    expect(nextEditChange(live, null, toTaskPatch({ attachments: [] }), now)).toMatchObject({ fields: { attachments: [] } })
  })

  it('والحذفُ لا يغيّر قيمَها حتّى يُعتمَد', () => {
    expect(proposedTask(live, { kind: 'remove', requestedAt: 'x' })).toEqual(live)
  })
})

describe('ما يقرؤه المعتمِد — «العنوان: قديم ← جديد»', () => {
  it('⚠️ سطرٌ لكلّ حقلٍ تغيّر بترتيب الحقول وأسمائها', () => {
    const change: TaskChange = {
      kind: 'edit', requestedAt: 'x',
      fields: { moduleId: 'm2', title: 'جديد', dueAt: null, briefAr: 'س'.repeat(200) },
    }
    const lines = changeLines(live, change, fmt)
    expect(lines.map((l) => l.field)).toEqual(['title', 'briefAr', 'dueAt', 'moduleId'])
    expect(lines[0]).toEqual({ field: 'title', label: 'العنوان', before: 'اكتب خطّةَ مشروعك', after: 'جديد' })
    expect(lines[2]).toMatchObject({ before: 'يوم 2027-02-13', after: 'بلا موعد' })
    expect(lines[3]).toMatchObject({ before: 'المحور 1', after: 'المحور 2' })
    expect(lines[1].after.endsWith('…')).toBe(true)
    expect(lines[1].after.length).toBeLessThan(200)
  })

  it('والحذفُ لا سطورَ له — ما يُحذف يُسمّى لا يُفصَّل', () => {
    expect(changeLines(live, { kind: 'remove', requestedAt: 'x' }, fmt)).toEqual([])
    expect(changeLines(live, null, fmt)).toEqual([])
  })

  it('والفارغُ يُسمّى — لا يُترك بياضا', () => {
    expect(formatTaskValue('briefAr', null, fmt)).toBe('بلا تعليمات')
    expect(formatTaskValue('attachments', [], fmt)).toBe('بلا مرفقات')
    expect(formatTaskValue('attachments', live.attachments, fmt)).toBe('نموذج')
    expect(formatTaskValue('type', 'quiz', fmt)).toBe('اختبار')
    expect(formatTaskValue('maxScore', 30, fmt)).toBe('30')
  })

  it('ولكلّ حقلٍ اسمٌ عربيّ', () => {
    for (const f of TASK_FIELDS) expect(TASK_FIELD_LABELS[f], f).toMatch(/^[^a-z]+$/)
  })
})
