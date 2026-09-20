/* ترتيبُ الطابور — الحكمُ وحدَه، بلا شاشةٍ ولا قاعدة.

   ═══ وكلُّ حارسٍ هنا نُقض ما يحرسه مرّةً ليُرى وهو يسقط ═══

   والثلاثةُ التي من أجلها كُتب الملفّ ليست «هل يرتّب؟» — بل:

   ① الرقمُ عدديٌّ لا حرفيّ (`TR-9` قبل `TR-10`)
   ② والحالةُ بدورة حياتها لا بحروفها
   ③ وللمتساوين فاصلٌ ثابتٌ لا يتبدّل بين تصييرٍ وآخر */

import { describe, expect, it } from 'vitest'
import {
  SORT_KEYS, SORT_OPTIONS, sortApplications,
  type SortableApp, type SortKey,
} from '@/application/trainer/application-sort'

/** ترتيبُ دورة الحياة كما يمرّره الطابور */
const ORDER = ['submitted', 'under_review', 'interview_scheduled', 'active', 'rejected']

const app = (over: Partial<SortableApp> & { reference: string }): SortableApp => ({
  fullName: 'فلان', status: 'submitted', createdAt: '2026-09-01T00:00:00.000Z', ...over,
})

const refs = (rows: SortableApp[]) => rows.map((r) => r.reference)

describe('ترتيبُ طابور الطلبات', () => {
  it('ولا يُرتَّب في مكانه — فالقائمةُ الأصلُ لا تُمسّ', () => {
    const rows = [app({ reference: 'TR-2' }), app({ reference: 'TR-1' })]
    const out = sortApplications(rows, 'reference', 'asc', ORDER)
    expect(refs(rows), 'رُتّبت القائمةُ الأصلُ في مكانها').toEqual(['TR-2', 'TR-1'])
    expect(refs(out)).toEqual(['TR-1', 'TR-2'])
  })

  /* ═══ ① وهذا أوّلُ ما من أجله كُتب الملفّ ═══

     المقارنةُ الحرفيّةُ تضع `TR-10` قبل `TR-9` لأنّ «١» قبل «٩». فيُقرأ
     الطابورُ مرتَّبا وهو ليس مرتَّبا. */
  it('① والرقمُ يُقارَن عدديّا — فـ«٩» قبل «١٠» لا بعدها', () => {
    const rows = [app({ reference: 'TR-10' }), app({ reference: 'TR-9' }), app({ reference: 'TR-100' })]
    expect(refs(sortApplications(rows, 'reference', 'asc', ORDER)))
      .toEqual(['TR-9', 'TR-10', 'TR-100'])
  })

  it('وينقلب بالنزول', () => {
    const rows = [app({ reference: 'TR-9' }), app({ reference: 'TR-100' }), app({ reference: 'TR-10' })]
    expect(refs(sortApplications(rows, 'reference', 'desc', ORDER)))
      .toEqual(['TR-100', 'TR-10', 'TR-9'])
  })

  /* ═══ ② والحالةُ بدورة حياتها ═══

     «مرفوض» قبل «مُقدَّم» حرفيّا، وذلك لا يعني شيئا لمن يفرز. */
  it('② والحالةُ تتبع رحلةَ الطلب لا حروفَ اسمها', () => {
    const rows = [
      app({ reference: 'TR-1', status: 'rejected' }),
      app({ reference: 'TR-2', status: 'submitted' }),
      app({ reference: 'TR-3', status: 'interview_scheduled' }),
    ]
    expect(refs(sortApplications(rows, 'status', 'asc', ORDER)))
      .toEqual(['TR-2', 'TR-3', 'TR-1'])
  })

  it('وحالةٌ لا يعرفها الترتيبُ تقع آخرا لا أوّلا', () => {
    const rows = [
      app({ reference: 'TR-1', status: 'شيءٌ طارئ' }),
      app({ reference: 'TR-2', status: 'submitted' }),
    ]
    expect(refs(sortApplications(rows, 'status', 'asc', ORDER)))
      .toEqual(['TR-2', 'TR-1'])
  })

  /* ═══ ③ وللمتساوين فاصلٌ — وإلّا قفز الصفُّ تحت يد قارئه ═══ */
  it('③ والمتساوون في الحالة يُفصَلون بالرقم — لا بما اتّفق', () => {
    const rows = [
      app({ reference: 'TR-3', status: 'submitted' }),
      app({ reference: 'TR-1', status: 'submitted' }),
      app({ reference: 'TR-2', status: 'submitted' }),
    ]
    expect(refs(sortApplications(rows, 'status', 'asc', ORDER)))
      .toEqual(['TR-1', 'TR-2', 'TR-3'])
  })

  it('والفاصلُ لا ينقلب مع الاتّجاه — هو ثباتٌ لا ترتيب', () => {
    const rows = [
      app({ reference: 'TR-3', status: 'submitted' }),
      app({ reference: 'TR-1', status: 'submitted' }),
    ]
    /* الحالةُ واحدة، فلا فرقَ بين الصعود والنزول: الفاصلُ هو الحاكم */
    expect(refs(sortApplications(rows, 'status', 'asc', ORDER))).toEqual(['TR-1', 'TR-3'])
    expect(refs(sortApplications(rows, 'status', 'desc', ORDER))).toEqual(['TR-1', 'TR-3'])
  })

  it('والتاريخُ يُرتَّب، والأقدمُ أوّلا في الصعود — كما كان الطابورُ دائما', () => {
    const rows = [
      app({ reference: 'TR-2', createdAt: '2026-09-05T00:00:00.000Z' }),
      app({ reference: 'TR-1', createdAt: '2026-09-01T00:00:00.000Z' }),
    ]
    expect(refs(sortApplications(rows, 'created', 'asc', ORDER))).toEqual(['TR-1', 'TR-2'])
    expect(refs(sortApplications(rows, 'created', 'desc', ORDER))).toEqual(['TR-2', 'TR-1'])
  })

  it('والاسمُ يُرتَّب عربيّا — فالألفُ قبل الياء', () => {
    const rows = [
      app({ reference: 'TR-1', fullName: 'ياسر' }),
      app({ reference: 'TR-2', fullName: 'أحمد' }),
    ]
    expect(refs(sortApplications(rows, 'name', 'asc', ORDER))).toEqual(['TR-2', 'TR-1'])
  })

  it('ولكلّ مفتاحٍ معروضٍ عنوانٌ عربيّ — ولا مفتاحَ بلا خيار', () => {
    expect(SORT_KEYS).toEqual(SORT_OPTIONS.map((o) => o.key))
    for (const o of SORT_OPTIONS) {
      expect(o.labelAr, `«${o.key}» بلا عنوانٍ عربيّ`).toMatch(/[؀-ۿ]/)
    }
  })

  it('وكلُّ مفتاحٍ يرتّب فعلا — فلا مفتاحٌ يُعرض ولا يفعل', () => {
    const rows = [
      app({ reference: 'TR-2', fullName: 'ياسر', status: 'active', createdAt: '2026-09-09T00:00:00.000Z' }),
      app({ reference: 'TR-1', fullName: 'أحمد', status: 'submitted', createdAt: '2026-09-01T00:00:00.000Z' }),
    ]
    for (const key of SORT_KEYS as SortKey[]) {
      expect(refs(sortApplications(rows, key, 'asc', ORDER)), `«${key}» لا يرتّب`)
        .toEqual(['TR-1', 'TR-2'])
    }
  })
})
