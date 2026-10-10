/* ملفّاتُ التعديلات دفعةً واحدة (١٠ أكتوبر ٢٠٢٦) — يُقرأ كلُّ ملفٍّ قبل رفعه: أيُّ خطّةٍ هو،
   وكم بندا فيه. وما لا يُقرأ يعود بسببه لا يرمي — فلا يوقف ما بعده من الدفعة. */

import { describe, expect, it } from 'vitest'
import { bulkSummaryAr, readEditsFile, uploadedLineAr } from '@/application/trainer/plan-edits-bulk'

const PLAN = '7c1a3a52-2a7e-4a36-9a43-0d1d2b6b8f10'
const file = (over: Record<string, unknown> = {}) => JSON.stringify({
  format: 'wajeez.plan-edits/1', planId: PLAN, titleAr: 'دورة الإقناع — ماريا',
  items: [
    { kind: 'plan', required: true, reasonAr: 'س', set: { summaryAr: 'ن' } },
    { kind: 'plan', reasonAr: 'س', set: { titleAr: 'ع' } },
    { kind: 'plan', required: false, reasonAr: 'س', set: { audienceAr: 'ج' } },
  ],
  ...over,
})

describe('قراءةُ الملفّ', () => {
  it('يعرف خطّتَه وعددَ بنوده وكم منها مطلوب — ويحمل ما يُرفع كما هو', () => {
    const r = readEditsFile('06.json', file())
    expect(r).toMatchObject({ ok: true, planId: PLAN, titleAr: 'دورة الإقناع — ماريا', count: 3, required: 1 })
    expect(r.ok && r.body).toEqual(JSON.parse(file()))
  })

  it('⚠️ ملفٌّ لا يذكر خطّتَه يُردّ بسببه — لا يُخمَّن موضعُه', () => {
    expect(readEditsFile('x.json', file({ planId: undefined }))).toEqual({
      name: 'x.json', ok: false, problemAr: 'لا يذكر الملفُّ خطّتَه (planId) — ارفعه من بطاقة خطّته',
    })
    expect(readEditsFile('x.json', file({ planId: '  ' })).ok).toBe(false)
  })

  it('⚠️ وما ليس JSON أو ليس ملفَّ تعديلات يعود بسببه ولا يرمي', () => {
    expect(readEditsFile('a.pdf', '%PDF-1.7')).toMatchObject({ ok: false, problemAr: 'ليس ملفَّ JSON مقروءا' })
    expect(readEditsFile('b.json', '[1,2]')).toMatchObject({ ok: false, problemAr: 'ليس ملفَّ تعديلات' })
    expect(readEditsFile('c.json', 'null')).toMatchObject({ ok: false, problemAr: 'ليس ملفَّ تعديلات' })
    expect(readEditsFile('d.json', file({ items: [] }))).toMatchObject({ ok: false, problemAr: 'الملفُّ بلا تعديلات' })
  })

  it('والعنوانُ الفارغُ لا يُعرض اسما', () => {
    expect(readEditsFile('e.json', file({ titleAr: ' ' }))).toMatchObject({ ok: true, titleAr: null })
  })
})

describe('ما يُقال بعد الرفع', () => {
  it('العددُ بصيغته العربيّة، والمطلوبُ إن وُجد', () => {
    expect(uploadedLineAr(19, 3)).toBe('رُفع مسوّدةً: 19 بندا، 3 منها مطلوبة')
    expect(uploadedLineAr(5, 1)).toBe('رُفع مسوّدةً: 5 بنود، 1 منها مطلوب')
    expect(uploadedLineAr(13, 0)).toBe('رُفع مسوّدةً: 13 بندا')
  })

  it('⚠️ ولا يُقال «كلُّها» وفي الدفعة ما رُدّ', () => {
    expect(bulkSummaryAr(8, 0)).toMatch(/^رُفعت الملفّاتُ كلُّها \(8\)/)
    expect(bulkSummaryAr(7, 1)).toBe('رُفع 7 من 8 — ورُدّ 1 بسببه أدناه، وما رُدّ لم يُحفظ منه شيء.')
    expect(bulkSummaryAr(0, 2)).toMatch(/^لم يُرفع شيء/)
  })
})
