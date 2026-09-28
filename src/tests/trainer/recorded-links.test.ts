/* محورُ الجلسة المسجّلة بعد الاعتماد — ما يسري لحظتَه وما ينتظر (`recorded-links.ts`).

   قرارُ صاحب المنصّة (٢٨ سبتمبر ٢٠٢٦) عن محور الجلسة المسجّلة بعد اعتماد
   الخطّة: «no need for approval for this!». وحفظُ الخطّة يكتبه في المعتمَدة
   (`server/tests/trainer/axis-plan.test.ts` ⑨)؛ وهنا القاعدة:

   ① يُعرف ما تغيّر محورُه من الجلسات المسجّلة — لا غيرُه.
   ② والجلسةُ تُعرف برابطها: ما تكرّر رابطُه أو تغيّر لا يُخمَّن.
   ③ ولا تُربط إلّا بمحورٍ له موعدٌ في المعتمَدة — ولا تُفكّ.
   ④ والكتابةُ تمسّ المحورَ وحدَه.
   ⑤ والمحتوى نفسُه لا يفتح مراجعة — وأدنى فرقٍ يفتحها. */

import { describe, expect, it } from 'vitest'
import { applyRecordedRelinks, recordedRelinks, samePlanContent } from '@/application/trainer/recorded-links'

/** مصدرٌ في الخطّة كما يُحفظ — ويومُ الفتح فيه وإن لم تقرأه القاعدة */
interface Res {
  title: string; url?: string; bodyFileKey?: string; category: string; kind?: string
  moduleId: string | null; opensAt?: string
}
const SLOTS = [{ moduleIds: ['M1', 'M2'] }, { moduleIds: ['M3'] }]
const MODULES = [{ moduleId: 'M1' }, { moduleId: 'M2' }, { moduleId: 'M3' }]
const rec = (url: string, moduleId: string | null, over: Partial<Res> = {}): Res => ({
  title: `مسجّلة ${url.slice(-1)}`, url, category: 'recorded', kind: 'video', moduleId,
  opensAt: '2027-03-08T06:00:00.000Z', ...over,
})
const A = 'https://v.test/a'
const B = 'https://v.test/b'
const reading: Res = { title: 'مرجع', url: 'https://x.test/ref', category: 'reading', moduleId: 'M1' }
const plan = (resources: Res[]) => ({ modules: MODULES, slots: SLOTS, resources })

describe('① ما تغيّر محورُه من الجلسات المسجّلة', () => {
  it('⚠️ يُعرف بموضعه في المعتمَدة وبما كان وما صار', () => {
    const approved = plan([reading, rec(A, 'M1'), rec(B, 'M2')])
    const incoming = plan([reading, rec(A, 'M2'), rec(B, 'M2')])
    expect(recordedRelinks(approved, incoming)).toEqual([{ index: 1, title: 'مسجّلة a', from: 'M1', to: 'M2' }])
  })

  it('⚠️ ولا يُعدّ غيرُ المسجَّل — محورُ مرجعٍ تحريرٌ في الخطّة ينتظر', () => {
    expect(recordedRelinks(plan([reading]), plan([{ ...reading, moduleId: 'M2' }]))).toEqual([])
  })

  it('ولا ما لم يتغيّر', () => {
    const same = plan([reading, rec(A, 'M1')])
    expect(recordedRelinks(same, plan([reading, rec(A, 'M1')]))).toEqual([])
  })

  it('⚠️ وموضعُها من المعتمَدة ولو تغيّر ترتيبُها في المراجعة أو أُضيف قبلها مصدر', () => {
    const approved = plan([rec(A, 'M1'), rec(B, 'M2')])
    const incoming = plan([reading, rec(B, 'M2'), rec(A, 'M2')])
    expect(recordedRelinks(approved, incoming)).toEqual([{ index: 0, title: 'مسجّلة a', from: 'M1', to: 'M2' }])
  })
})

describe('② الجلسةُ برابطها', () => {
  it('⚠️ رابطٌ مكرّرٌ لا يُخمَّن أيُّهما — يبقى في المراجعة', () => {
    expect(recordedRelinks(plan([rec(A, 'M1'), rec(A, 'M1')]), plan([rec(A, 'M2'), rec(A, 'M1')]))).toEqual([])
    expect(recordedRelinks(plan([rec(A, 'M1')]), plan([rec(A, 'M2'), rec(A, 'M1')]))).toEqual([])
  })

  it('⚠️ ورابطٌ تغيّر مع محوره لا يُعرف — يبقى في المراجعة', () => {
    expect(recordedRelinks(plan([rec(A, 'M1')]), plan([rec(B, 'M2')]))).toEqual([])
  })

  it('والمرفوعةُ تُعرف بملفّها', () => {
    const file = (moduleId: string): Res => ({ title: 'ملفّ', bodyFileKey: 'rec-key', category: 'recorded', moduleId })
    expect(recordedRelinks(plan([file('M1')]), plan([file('M2')]))).toEqual([{ index: 0, title: 'ملفّ', from: 'M1', to: 'M2' }])
  })

  it('⚠️ والرابطُ هو الهُويّة: اسمٌ عُدّل معها لا يُضيّعها — ويبقى تعديلُه في المراجعة', () => {
    const relinks = recordedRelinks(plan([rec(A, 'M1')]), plan([rec(A, 'M2', { title: 'اسمٌ جديد' })]))
    expect(relinks).toEqual([{ index: 0, title: 'مسجّلة a', from: 'M1', to: 'M2' }])
  })
})

describe('③ إلى محورٍ له موعدٌ في المعتمَدة — ولا فكّ', () => {
  it('⚠️ محورٌ جديدٌ في المراجعة لم يُعتمَد — يسري ربطُها إليه حين تُعتمَد', () => {
    expect(recordedRelinks(plan([rec(A, 'M1')]), plan([rec(A, 'M9')]))).toEqual([])
  })

  it('⚠️ ومحورٌ بلا موعدٍ في خطّةٍ لها مواعيد لا يُربط به', () => {
    const approved = { modules: [...MODULES, { moduleId: 'M4' }], slots: SLOTS, resources: [rec(A, 'M1')] }
    expect(recordedRelinks(approved, { ...approved, resources: [rec(A, 'M4')] })).toEqual([])
  })

  it('وخطّةٌ قبل المواعيد: محاورُها', () => {
    const approved = { modules: MODULES, resources: [rec(A, 'M1')] }
    expect(recordedRelinks(approved, { ...approved, resources: [rec(A, 'M3')] })).toHaveLength(1)
  })

  it('⚠️ ولا تُفكّ من محورها هنا', () => {
    expect(recordedRelinks(plan([rec(A, 'M1')]), plan([rec(A, null)]))).toEqual([])
    expect(recordedRelinks(plan([rec(A, 'M1')]), plan([rec(A, '  ')]))).toEqual([])
  })

  it('وتُربط ما لم يكن لها محور — الجلسةُ «التي لم تُربط بعد»', () => {
    expect(recordedRelinks(plan([rec(A, null)]), plan([rec(A, 'M3')]))).toEqual([{ index: 0, title: 'مسجّلة a', from: null, to: 'M3' }])
  })
})

describe('④ الكتابةُ تمسّ المحورَ وحدَه', () => {
  it('⚠️ يومُ الفتح واسمُها ورابطُها كما في المعتمَدة — وما سواها كما كان', () => {
    const approved = plan([reading, rec(A, 'M1')])
    const incoming = plan([{ ...reading, title: 'مرجعٌ جديد' }, rec(A, 'M2', { title: 'اسمٌ جديد', opensAt: '2027-03-09T06:00:00.000Z' })])
    const out = applyRecordedRelinks(approved, recordedRelinks(approved, incoming))
    expect(out.resources[1], 'سرى مع المحور ما ليس ربطا').toEqual({ ...approved.resources[1], moduleId: 'M2' })
    expect(out.resources[0]).toBe(approved.resources[0])
    expect(approved.resources[1].moduleId, 'كُتب فوق المعتمَدة في مكانها').toBe('M1')
  })

  it('وبلا ربطٍ تُعاد كما هي', () => {
    const approved = plan([rec(A, 'M1')])
    expect(applyRecordedRelinks(approved, [])).toBe(approved)
  })
})

describe('⑤ المحتوى نفسُه', () => {
  it('⚠️ لا يفرّق ترتيبُ المفاتيح ولا مفتاحٌ بلا قيمة — كما يحفظه JSON', () => {
    expect(samePlanContent({ a: 1, b: { c: 2, d: undefined } }, { b: { c: 2 }, a: 1 })).toBe(true)
  })

  it('⚠️ وأدنى فرقٍ فرق — `null` ليس غيابا، وترتيبُ القائمة معنًى', () => {
    expect(samePlanContent({ a: null }, {})).toBe(false)
    expect(samePlanContent({ a: [1, 2] }, { a: [2, 1] })).toBe(false)
    expect(samePlanContent({ t: 'أ' }, { t: 'ب' })).toBe(false)
    expect(samePlanContent({ n: 1 }, { n: '1' })).toBe(false)
  })
})
