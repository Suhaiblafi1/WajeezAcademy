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

/* ═══ وترتيبٌ بتاريخ المقابلة (٢١ سبتمبر ٢٠٢٦) ═══

   «أحتاج ترتيبا إضافيّا للأسماء من خلال تاريخ المقابلة، من الأقدم للأحدث
   مثلا». وكان الطابورُ يُرتَّب بتاريخ التقديم أو الاسم أو الرقم أو الحالة
   — ولا شيءَ فيها يقول متى يلتقيه.

   ═══ وحكمان فيه ليسا بديهيَّين ═══

   ① **من لا موعدَ له يقع آخرا في الاتّجاهَين.** لو عُومل الفراغُ تاريخا
      لَتصدّر النازلَ أو الصاعدَ، فيُقرأ ترتيبٌ بالمقابلة نصفُه بلا مقابلة.
   ② **والمجهولُ يُقاس بوجوده لا بقيمته.** صفٌّ لم يُرسِل الحقلَ
      (`undefined`) وصفٌّ أرسله فارغا (`null`) كلاهما «بلا موعد» —
      ومقارنتُهما بالمساواة تُنتج مقارِنا متناقضا يُفسد الترتيبَ كلَّه. */
describe('الترتيبُ بتاريخ المقابلة', () => {
  const row = (reference: string, interviewAt: string | null | undefined) => ({
    fullName: `متقدّمُ ${reference}`, reference, status: 'submitted',
    createdAt: '2026-09-01T00:00:00.000Z', interviewAt,
  })

  const ORDER = ['submitted', 'under_review', 'rejected']

  it('هو خيارٌ معروضٌ في الشاشة — لا مفتاحٌ لا يصل إليه أحد', () => {
    expect(SORT_OPTIONS.map((o) => o.key)).toContain('interview')
    expect(SORT_OPTIONS.find((o) => o.key === 'interview')!.labelAr).toContain('المقابلة')
  })

  it('صاعدا: الأقدمُ أوّلا — وهو ما طُلب بنصّه', () => {
    const rows = [
      row('TR-2', '2026-09-20T10:00:00.000Z'),
      row('TR-1', '2026-09-10T10:00:00.000Z'),
      row('TR-3', '2026-09-25T10:00:00.000Z'),
    ]
    expect(sortApplications(rows, 'interview', 'asc', ORDER).map((r) => r.reference))
      .toEqual(['TR-1', 'TR-2', 'TR-3'])
  })

  it('ونازلا: الأحدثُ أوّلا', () => {
    const rows = [
      row('TR-1', '2026-09-10T10:00:00.000Z'),
      row('TR-3', '2026-09-25T10:00:00.000Z'),
      row('TR-2', '2026-09-20T10:00:00.000Z'),
    ]
    expect(sortApplications(rows, 'interview', 'desc', ORDER).map((r) => r.reference))
      .toEqual(['TR-3', 'TR-2', 'TR-1'])
  })

  it('① ومن لا موعدَ له يقع آخرا — صعد الترتيبُ أم نزل', () => {
    const rows = [
      row('TR-9', null),
      row('TR-2', '2026-09-20T10:00:00.000Z'),
      row('TR-1', '2026-09-10T10:00:00.000Z'),
    ]
    for (const dir of ['asc', 'desc'] as const) {
      const out = sortApplications(rows, 'interview', dir, ORDER).map((r) => r.reference)
      expect(out[out.length - 1], `«بلا موعد» تصدّر الترتيبَ ${dir}`).toBe('TR-9')
    }
  })

  /* ═══ ② ويُقاس بوجوده لا بقيمته — والفحصُ على التناظر لا على ترتيبٍ واحد ═══

     مقارِنٌ يقول «أ بعد ب» **و**«ب بعد أ» متناقض. وناتجُ `sort` وحدَه لا
     يكشفه: المحرّكُ يستعمل الإدراجَ في المصفوفات القصيرة فيخرج ترتيبٌ
     يبدو سليما. (وقد جُرّب: حارسٌ يفحص ناتجَ أربعة صفوفٍ مرّ على النسخة
     المعطوبة — فكان زينةً لا حارسا.)

     فالفحصُ على ما يُعرّف التناقضَ نفسَه: المدخلُ المقلوبُ يُنتج المخرجَ
     نفسَه. ومقارِنٌ متناقضٌ يقلب مخرجَه بقلب مدخله. */
  it('② والمجهولُ مجهولٌ سواءٌ أُرسل فارغا أم لم يُرسَل — ولا يُفسد المقارِن', () => {
    const missing = row('TR-8', undefined)
    const empty = row('TR-9', null)
    const forward = sortApplications([missing, empty], 'interview', 'asc', ORDER)
    const backward = sortApplications([empty, missing], 'interview', 'asc', ORDER)
    expect(forward.map((r) => r.reference), 'ترتيبُ المجهولَين يتبع ترتيبَ المدخل — مقارِنٌ متناقض')
      .toEqual(backward.map((r) => r.reference))

    /* ومعهما من له موعدٌ: يتصدّران أم يتذيّلان؟ */
    const out = sortApplications(
      [missing, row('TR-1', '2026-09-10T10:00:00.000Z'), empty, row('TR-2', '2026-09-20T10:00:00.000Z')],
      'interview', 'asc', ORDER,
    ).map((r) => r.reference)
    expect(out.slice(0, 2), 'من له موعدٌ لم يتصدّر').toEqual(['TR-1', 'TR-2'])
  })

  it('ولا يُبدَّل ترتيبُ المتساوين بين تصييرٍ وآخر — الفاصلُ هو الرقم', () => {
    const same = '2026-09-20T10:00:00.000Z'
    const rows = [row('TR-3', same), row('TR-1', same), row('TR-2', same)]
    expect(sortApplications(rows, 'interview', 'asc', ORDER).map((r) => r.reference))
      .toEqual(['TR-1', 'TR-2', 'TR-3'])
  })
})
