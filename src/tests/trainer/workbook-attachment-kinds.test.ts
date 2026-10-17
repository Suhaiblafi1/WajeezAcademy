/* عنوانُ الكرّاسة ومواضعُ محاورها، ومرفقُ المهمّة — القاعدةُ والعرض (١٧ أكتوبر ٢٠٢٦).

   «وما لا تحمله البطاقاتُ بعدُ يُبنى له بابُها، لا يُحال على المدرّب» (قرارُ ١٢ أكتوبر). والخادمُ من الرفع إلى
   القبول في `server/tests/plan/workbook-attachment-cards.test.ts`؛ وهنا القاعدةُ نفسُها بلا قاعدة بيانات:
   ما يُقرأ «قبل»، وما يصير «بعد»، وما يُردّ — وأنّ ما يراه المدرّبُ لغةٌ بيضاءُ بلا تشكيل. */

import { describe, expect, it } from 'vitest'
import {
  applyContentEdit, attachmentSnapshot, attachmentsAfter, contentBefore, editsContent, planEditStep, planEditView,
  rowEditProblem, type EditableContent, type PlanEdit,
} from '@/application/trainer/plan-edits'

const c: EditableContent = {
  modules: [{ moduleId: 'M1', titleAr: 'أ' }, { moduleId: 'M2', titleAr: 'ب' }, { moduleId: 'M3', titleAr: 'ج' }],
  resources: [],
  workbookMode: 'course',
  workbook: { title: 'نصّ ملصوق', bodyFileKey: 'k-course', parts: [{ moduleId: 'M2', whereAr: 'ص 27–30٠' }, { moduleId: 'M1', whereAr: 'ص 3' }] },
}
const ctx = { moduleIds: ['M1', 'M2', 'M3'], taskTitle: () => 'المشروع' }
type WB = Extract<PlanEdit, { kind: 'workbook_change' }>
type TA = Extract<PlanEdit, { kind: 'task_attachment' }>
const wb = (set: WB['set'], moduleId: string | null = null): WB => ({ kind: 'workbook_change', moduleId, set })

describe('workbook_change — عنوان الكرّاسة ومواضع محاورها', () => {
  it('⚠️ «قبل» العنوانُ والمواضعُ المسمّاةُ وحدَها — ويقع في خطوة الكرّاسات ومحتوى الخطّة', () => {
    const e = wb({ title: 'الكراسة', parts: [{ moduleId: 'M2', whereAr: 'ص 27–30' }, { moduleId: 'M3', whereAr: 'ص 31' }] })
    expect(contentBefore(e, c)).toEqual({ ok: true, value: { title: 'نصّ ملصوق', 'part:M2': 'ص 27–30٠', 'part:M3': null } })
    expect([planEditStep(e), editsContent(e)]).toEqual(['workbooks', true])
  })

  it('⚠️ «بعد»: العنوانُ مكانَ العنوان، والمواضعُ بترتيب المحاور، والفارغُ يمحو، وما لم يُسمَّ يبقى — والملفُّ كما هو', () => {
    const r = applyContentEdit(c, wb({ title: ' الكراسة ', parts: [{ moduleId: 'M2', whereAr: null }, { moduleId: 'M3', whereAr: ' ص 31 ' }] }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.workbook).toEqual({ title: 'الكراسة', bodyFileKey: 'k-course', parts: [{ moduleId: 'M1', whereAr: 'ص 3' }, { moduleId: 'M3', whereAr: 'ص 31' }] })
    expect(c.workbook!.title, 'مسّ الأصل').toBe('نصّ ملصوق')
  })

  it('⚠️ ويردّ: بلا حقل، أو محورا مجهولا أو مكرّرا، أو موضعا في كرّاسة محور، أو عنوانا فارغا', () => {
    const no = (e: WB, cc: EditableContent = c) => { const r = contentBefore(e, cc); return r.ok ? null : r.problemAr }
    expect(no(wb({}))).toBe('تعديل كرّاسة بلا حقل يعدّل')
    expect(no(wb({ parts: [{ moduleId: 'M9', whereAr: 'ص 1' }] }))).toBe('لا محور «M9» في الخطّة')
    expect(no(wb({ parts: [{ moduleId: 'M1', whereAr: 'ص 1' }, { moduleId: 'M1', whereAr: 'ص 2' }] }))).toBe('محور مكرّر في المواضع')
    expect(no(wb({ title: ' ' }))).toBe('عنوان الكرّاسة قصير أو فارغ')
    const modules: EditableContent = { ...c, workbookMode: 'modules', workbooks: [{ moduleIds: ['M1'], title: 'ك' }] }
    expect(no(wb({ parts: [{ moduleId: 'M1', whereAr: 'ص 1' }] }, 'M1'), modules)).toBe('مواضع المحاور في كرّاسة الدورة وحدها')
    expect(no(wb({ title: 'كراسة المحور' }, 'M1'), modules)).toBeNull()
  })

  it('⚠️ والعرض: «كرّاسة الدورة» وصفٌّ لكلّ ما تغيّر', () => {
    const e = wb({ title: 'الكراسة', parts: [{ moduleId: 'M2', whereAr: 'ص 27–30' }] })
    const before = contentBefore(e, c)
    const v = planEditView(e, before.ok ? before.value : null, ctx)
    expect(v.titleAr).toBe('كرّاسة الدورة')
    expect(v.rows.map((r) => [r.labelAr, r.beforeAr, r.afterAr])).toEqual([['العنوان', 'نصّ ملصوق', 'الكراسة'], ['موضع المحور 2', 'ص 27–30٠', 'ص 27–30']])
  })
})

describe('task_attachment — مرفق المهمّة بعنوانه', () => {
  const list = [
    { title: 'موذج التقييم', url: '', bodyFileKey: 'old', bodyFileName: 'قديم.pdf', bodyFileMime: 'application/pdf' },
    { title: 'دليل', url: 'https://example.com/g' },
  ]
  const ta = (x: Partial<TA>): TA => ({ kind: 'task_attachment', assessmentId: 't', match: { title: 'موذج التقييم' }, ...x })
  const file = { key: 'new-key-123', name: 'جديد.pdf', mime: 'application/pdf' }

  it('⚠️ «قبل» عنوانُه، وملفُّه إن كان التعديلُ يبدّله — وما لا يُعرف بعنوانه يُقال', () => {
    expect(attachmentSnapshot(list, ta({ title: 'نموذج التقييم' }))).toEqual({ ok: true, value: { title: 'موذج التقييم' } })
    expect(attachmentSnapshot(list, ta({ file }))).toEqual({ ok: true, value: { title: 'موذج التقييم', fileKey: 'old', fileName: 'قديم.pdf', url: null } })
    expect(attachmentSnapshot(list, ta({ match: { title: 'غيره' }, title: 'س' }))).toEqual({ ok: false, problemAr: 'لا مرفق بعنوان «غيره» في هذه المهمّة' })
  })

  it('⚠️ «بعد»: العنوانُ أو الملفُّ مكانَ ما كان، والملفُّ يُسقط الرابط — والآخرُ كما هو', () => {
    const r = attachmentsAfter(list, ta({ title: ' نموذج التقييم ', file }))
    expect(r).toEqual({ ok: true, value: [
      { title: 'نموذج التقييم', url: '', bodyFileKey: 'new-key-123', bodyFileName: 'جديد.pdf', bodyFileMime: 'application/pdf' },
      list[1],
    ] })
    const onlyTitle = attachmentsAfter(list, ta({ title: 'نموذج التقييم' }))
    expect(onlyTitle.ok && onlyTitle.value[0]).toEqual({ ...list[0], title: 'نموذج التقييم' })
  })

  it('⚠️ ويردّ: بلا عنوان جديد ولا ملفّ، أو ملفّا ليس PDF', () => {
    expect(rowEditProblem(ta({}), c)).toBe('تعديل مرفق بلا عنوان جديد ولا ملفّ')
    expect(rowEditProblem(ta({ file: { ...file, mime: 'image/png' } }), c)).toBe('المرفق الجديد يرفع PDF')
    expect(rowEditProblem(ta({ title: 'نموذج التقييم' }), c)).toBeNull()
  })

  it('⚠️ والعرض يفتح الملفين — ليقرأ الجديد قبل أن يقبله', () => {
    const e = ta({ file })
    const before = attachmentSnapshot(list, e)
    const v = planEditView(e, before.ok ? before.value : null, ctx)
    expect(v.titleAr).toBe('مرفق مهمّة: «المشروع»')
    expect(v.rows[0]).toMatchObject({ labelAr: 'ملفّ المرفق', beforeAr: 'قديم.pdf', afterAr: 'جديد.pdf', beforeHref: '/api/v1/cohort-files/old', afterHref: '/api/v1/cohort-files/new-key-123' })
  })
})

it('⚠️ وما يراه المدرّب بلا تشكيل إعرابيّ — الشدّة وحدها تبقى', () => {
  const e1 = wb({ title: 'الكراسة', parts: [{ moduleId: 'M2', whereAr: 'ص 2' }] })
  const e2: TA = { kind: 'task_attachment', assessmentId: 't', match: { title: 'م' }, title: 'ن', file: { key: 'k-1234567890', name: 'ف.pdf', mime: 'application/pdf' } }
  const text = [planEditView(e1, null, ctx), planEditView(e2, null, ctx)].flatMap((v) => [v.titleAr, ...v.rows.map((r) => r.labelAr)]).join(' ')
  expect(text).not.toMatch(/[ً-ِْ]/)
})
