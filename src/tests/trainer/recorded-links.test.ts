/* موضعُ الجلسة المسجّلة بعد الاعتماد — محورُها ويومُ فتحها — ما يسري لحظتَه وما ينتظر (`recorded-links.ts`).

   قرارا صاحب المنصّة (٢٨ سبتمبر ٢٠٢٦) في الجلسة المسجّلة بعد اعتماد الخطّة:
   «no need for approval for this!» عن محورها، ثمّ «free the recording's opening
   day too». وكان هذا الملفُّ يحرس أنّ يومَ الفتح ينتظر المراجعة (#330) — فتغيّر
   القرارُ فتغيّر حارسُه (④). وحفظُ الخطّة يكتب الموضعَ في المعتمَدة
   (`server/tests/trainer/axis-plan.test.ts` ⑨)؛ وهنا القاعدة:

   ① يُعرف ما تغيّر موضعُه من الجلسات المسجّلة — محورُها أو يومُ فتحها — لا غيرُه.
   ② والجلسةُ تُعرف برابطها: ما تكرّر رابطُه أو تغيّر لا يُخمَّن.
   ③ والموضعُ كلُّه صحيحٌ في المعتمَدة أو لا شيء منه: محورٌ له موعدٌ فيها، ويومٌ داخله.
   ④ والكتابةُ تمسّ الموضعَ وحدَه — لا اسمَها ولا رابطَها.
   ⑤ والمحتوى نفسُه لا يفتح مراجعة — وأدنى فرقٍ يفتحها. */

import { describe, expect, it } from 'vitest'
import { applyRecordedPlacements, recordedPlacements, samePlanContent } from '@/application/trainer/recorded-links'

/** مصدرٌ في الخطّة كما يُحفظ */
interface Res {
  title: string; url?: string; bodyFileKey?: string; category: string; kind?: string
  moduleId: string | null; opensAt?: string | null
}
/* موعدان بعمّان (+٣): الأوّلُ من منتصف ليل ٧ مارس (٦ مارس ٢١:٠٠ بغرينتش) إلى آخر ثانيةٍ من ١٣ */
const SLOTS = [
  { startsOn: '2027-03-07', endsOn: '2027-03-13', moduleIds: ['M1', 'M2'] },
  { startsOn: '2027-03-14', endsOn: '2027-03-20', moduleIds: ['M3'] },
]
const MODULES = [{ moduleId: 'M1' }, { moduleId: 'M2' }, { moduleId: 'M3' }]
const IN_FIRST = '2027-03-08T06:00:00.000Z'
const IN_SECOND = '2027-03-15T06:00:00.000Z'
const rec = (url: string, moduleId: string | null, over: Partial<Res> = {}): Res => ({
  title: `مسجّلة ${url.slice(-1)}`, url, category: 'recorded', kind: 'video', moduleId, opensAt: IN_FIRST, ...over,
})
const A = 'https://v.test/a'
const B = 'https://v.test/b'
const reading: Res = { title: 'مرجع', url: 'https://x.test/ref', category: 'reading', moduleId: 'M1' }
const plan = (resources: Res[]) => ({ modules: MODULES, slots: SLOTS, resources })

describe('① ما تغيّر موضعُه من الجلسات المسجّلة', () => {
  it('⚠️ محورٌ تغيّر داخلَ موعده — بموضعه في المعتمَدة، وبما كان وما صار', () => {
    const approved = plan([reading, rec(A, 'M1'), rec(B, 'M2')])
    const incoming = plan([reading, rec(A, 'M2'), rec(B, 'M2')])
    expect(recordedPlacements(approved, incoming)).toEqual([{ index: 1, title: 'مسجّلة a', moduleId: { from: 'M1', to: 'M2' } }])
  })

  it('⚠️ ويومُ فتحها وحدَه داخلَ موعد محورها — يسري (وكان ينتظر المراجعةَ قبل القرار)', () => {
    const later = '2027-03-10T06:00:00.000Z'
    expect(recordedPlacements(plan([rec(A, 'M1')]), plan([rec(A, 'M1', { opensAt: later })])))
      .toEqual([{ index: 0, title: 'مسجّلة a', opensAt: { from: IN_FIRST, to: later } }])
  })

  it('⚠️ ونقلُها إلى موعدٍ آخر: محورُها ويومُها معا', () => {
    expect(recordedPlacements(plan([rec(A, 'M1')]), plan([rec(A, 'M3', { opensAt: IN_SECOND })]))).toEqual([{
      index: 0, title: 'مسجّلة a', moduleId: { from: 'M1', to: 'M3' }, opensAt: { from: IN_FIRST, to: IN_SECOND },
    }])
  })

  it('⚠️ ولا يُعدّ غيرُ المسجَّل — محورُ مرجعٍ تحريرٌ في الخطّة ينتظر', () => {
    expect(recordedPlacements(plan([reading]), plan([{ ...reading, moduleId: 'M2' }]))).toEqual([])
  })

  it('ولا ما لم يتغيّر — واللحظةُ الواحدةُ بصيغتين لحظةٌ واحدة', () => {
    expect(recordedPlacements(plan([reading, rec(A, 'M1')]), plan([reading, rec(A, 'M1')]))).toEqual([])
    expect(recordedPlacements(plan([rec(A, 'M1')]), plan([rec(A, 'M1', { opensAt: '2027-03-08T09:00:00+03:00' })]))).toEqual([])
  })

  it('⚠️ وموضعُها من المعتمَدة ولو تغيّر ترتيبُها في المراجعة أو أُضيف قبلها مصدر', () => {
    const approved = plan([rec(A, 'M1'), rec(B, 'M2')])
    const incoming = plan([reading, rec(B, 'M2'), rec(A, 'M2')])
    expect(recordedPlacements(approved, incoming)).toEqual([{ index: 0, title: 'مسجّلة a', moduleId: { from: 'M1', to: 'M2' } }])
  })
})

describe('② الجلسةُ برابطها', () => {
  it('⚠️ رابطٌ مكرّرٌ لا يُخمَّن أيُّهما — يبقى في المراجعة', () => {
    expect(recordedPlacements(plan([rec(A, 'M1'), rec(A, 'M1')]), plan([rec(A, 'M2'), rec(A, 'M1')]))).toEqual([])
    expect(recordedPlacements(plan([rec(A, 'M1')]), plan([rec(A, 'M2'), rec(A, 'M1')]))).toEqual([])
  })

  it('⚠️ ورابطٌ تغيّر مع موضعه لا يُعرف — يبقى في المراجعة', () => {
    expect(recordedPlacements(plan([rec(A, 'M1')]), plan([rec(B, 'M2')]))).toEqual([])
  })

  it('والمرفوعةُ تُعرف بملفّها', () => {
    const file = (moduleId: string): Res => ({ title: 'ملفّ', bodyFileKey: 'rec-key', category: 'recorded', moduleId, opensAt: IN_FIRST })
    expect(recordedPlacements(plan([file('M1')]), plan([file('M2')]))).toEqual([{ index: 0, title: 'ملفّ', moduleId: { from: 'M1', to: 'M2' } }])
  })

  it('⚠️ والرابطُ هو الهُويّة: اسمٌ عُدّل معها لا يُضيّعها — ويبقى تعديلُه في المراجعة', () => {
    expect(recordedPlacements(plan([rec(A, 'M1')]), plan([rec(A, 'M2', { title: 'اسمٌ جديد' })])))
      .toEqual([{ index: 0, title: 'مسجّلة a', moduleId: { from: 'M1', to: 'M2' } }])
  })
})

describe('③ الموضعُ كلُّه صحيحٌ في المعتمَدة — أو لا شيء منه', () => {
  it('⚠️ محورٌ جديدٌ في المراجعة لم يُعتمَد — يسري ربطُها إليه حين تُعتمَد', () => {
    expect(recordedPlacements(plan([rec(A, 'M1')]), plan([rec(A, 'M9')]))).toEqual([])
  })

  it('⚠️ ومحورٌ بلا موعدٍ في خطّةٍ لها مواعيد لا يُربط به', () => {
    const approved = { modules: [...MODULES, { moduleId: 'M4' }], slots: SLOTS, resources: [rec(A, 'M1')] }
    expect(recordedPlacements(approved, { ...approved, resources: [rec(A, 'M4')] })).toEqual([])
  })

  it('⚠️ ويومٌ خارجَ موعد محورها يبقى في المراجعة — بقاعدة الإرسال نفسِها', () => {
    expect(recordedPlacements(plan([rec(A, 'M1')]), plan([rec(A, 'M1', { opensAt: IN_SECOND })]))).toEqual([])
  })

  it('⚠️ ومحورٌ نُقل إلى موعدٍ آخرَ ويومُه باقٍ في الأوّل — يبقى كلُّه، لا نصفُه', () => {
    expect(recordedPlacements(plan([rec(A, 'M1')]), plan([rec(A, 'M3')]))).toEqual([])
  })

  it('⚠️ ومحوُ يومها يبقى في المراجعة — الإرسالُ يحجب جلسةً بلا موعدِ فتح', () => {
    expect(recordedPlacements(plan([rec(A, 'M1')]), plan([rec(A, 'M1', { opensAt: null })]))).toEqual([])
    expect(recordedPlacements(plan([rec(A, 'M1')]), plan([rec(A, 'M1', { opensAt: 'ليس تاريخا' })]))).toEqual([])
  })

  it('وحدودُ الموعد بعمّان: أوّلُ لحظةٍ فيه وآخرُها داخلَه، وما بعدها خارجَه', () => {
    const at = (opensAt: string) => recordedPlacements(plan([rec(A, 'M1')]), plan([rec(A, 'M1', { opensAt })]))
    expect(at('2027-03-06T21:00:00.000Z')).toHaveLength(1)
    expect(at('2027-03-13T20:59:59.999Z')).toHaveLength(1)
    expect(at('2027-03-13T21:00:00.000Z'), 'يومٌ من الموعد التالي عُدّ في محورٍ من الأوّل').toEqual([])
    expect(at('2027-03-06T20:59:59.999Z')).toEqual([])
  })

  it('⚠️ ولا تُفكّ من محورها هنا', () => {
    expect(recordedPlacements(plan([rec(A, 'M1')]), plan([rec(A, null)]))).toEqual([])
    expect(recordedPlacements(plan([rec(A, 'M1')]), plan([rec(A, '  ')]))).toEqual([])
  })

  it('وتُربط ما لم يكن لها محور — الجلسةُ «التي لم تُربط بعد» — بيومٍ داخل موعده', () => {
    expect(recordedPlacements(plan([rec(A, null)]), plan([rec(A, 'M3', { opensAt: IN_SECOND })]))).toEqual([{
      index: 0, title: 'مسجّلة a', moduleId: { from: null, to: 'M3' }, opensAt: { from: IN_FIRST, to: IN_SECOND },
    }])
  })

  it('وخطّةٌ قبل المواعيد: محورٌ منها، ويومٌ صحيحٌ أو لا يوم', () => {
    const approved = { modules: MODULES, resources: [rec(A, 'M1')] }
    const saved = (over: Partial<Res>) => recordedPlacements(approved, { ...approved, resources: [rec(A, 'M1', over)] })
    expect(saved({ moduleId: 'M3', opensAt: '2030-01-01T00:00:00.000Z' })).toHaveLength(1)
    expect(saved({ opensAt: null })).toEqual([{ index: 0, title: 'مسجّلة a', opensAt: { from: IN_FIRST, to: null } }])
    expect(saved({ opensAt: 'ليس تاريخا' })).toEqual([])
    expect(saved({ moduleId: 'M9' })).toEqual([])
  })
})

describe('④ الكتابةُ تمسّ الموضعَ وحدَه', () => {
  it('⚠️ يسري المحورُ ويومُ الفتح — واسمُها ورابطُها كما في المعتمَدة، وما سواها كما كان', () => {
    const approved = plan([reading, rec(A, 'M1')])
    const later = '2027-03-09T06:00:00.000Z'
    const incoming = plan([{ ...reading, title: 'مرجعٌ جديد' }, rec(A, 'M2', { title: 'اسمٌ جديد', opensAt: later })])
    const out = applyRecordedPlacements(approved, recordedPlacements(approved, incoming))
    expect(out.resources[1], 'سرى ما ليس موضعا أو لم يسرِ يومُ الفتح').toEqual({ ...approved.resources[1], moduleId: 'M2', opensAt: later })
    expect(out.resources[0]).toBe(approved.resources[0])
    expect(approved.resources[1], 'كُتب فوق المعتمَدة في مكانها').toMatchObject({ moduleId: 'M1', opensAt: IN_FIRST })
  })

  it('⚠️ والمحورُ وحدَه لا يمسّ يومَ الفتح', () => {
    const approved = plan([rec(A, 'M1')])
    const out = applyRecordedPlacements(approved, recordedPlacements(approved, plan([rec(A, 'M2')])))
    expect(out.resources[0], 'مُحي يومُ الفتح بنقل المحور').toEqual({ ...approved.resources[0], moduleId: 'M2' })
  })

  it('ويومُ الفتح وحدَه لا يمسّ المحور', () => {
    const approved = plan([rec(A, 'M1')])
    const out = applyRecordedPlacements(approved, recordedPlacements(approved, plan([rec(A, 'M1', { opensAt: '2027-03-11T06:00:00.000Z' })])))
    expect(out.resources[0]).toMatchObject({ moduleId: 'M1', opensAt: '2027-03-11T06:00:00.000Z' })
  })

  it('وبلا تغييرٍ تُعاد كما هي', () => {
    const approved = plan([rec(A, 'M1')])
    expect(applyRecordedPlacements(approved, [])).toBe(approved)
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
