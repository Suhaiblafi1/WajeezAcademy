/* اختيارُ دورةٍ من ١١٣ — الترشيحُ وحدَه، ثمّ موضعاه.

   ═══ وما يُحرس ═══

   ① **الاثنان يعملان معا** — مرشِّحُ المجال والبحثُ يضيقان الواحدَ بعد
      الآخر، لا يلغي أحدُهما الآخرَ.
   ② **والبحثُ يُطبِّع العربيّة** — «تمويل» تجد «تموﻳل»، والهمزةُ على
      صورها. وهي علّةُ `matchesQuery` لا `includes`.
   ③ **ويُبحَث بالرمز كما بالاسم** — من نسخ `C-MKT-101` يلصقه ويجد.
   ④ **والمكوّنُ واحدٌ لموضعَين** — ولو أُصلح أحدُهما وحدَه لَافترقا. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ALL_GROUPS, courseGroups, filterCourses, type PickableCourse,
} from '@/application/catalog/course-picker'

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')

const CATALOG: PickableCourse[] = [
  { id: 'C-MKT-101', title: 'دورة تمويل المشاريع الناشئة', pathwayNames: ['مسار التسويق'] },
  { id: 'C-MKT-102', title: 'دورة اكتشاف العملاء', pathwayNames: ['مسار التسويق'] },
  { id: 'C-AI-201', title: 'دورة أساسيات الذكاء الاصطناعي', pathwayNames: ['مسار الذكاء الاصطناعي'] },
  /* دورةٌ قائمةٌ بنفسها: لا مسارَ لها ومجالُها معلَن */
  { id: 'C-SOLO-901', title: 'دورة أتمتة سير العمل', diagnosticDomains: ['العمليات'] },
  { id: 'C-NONE-999', title: 'دورةٌ بلا انتماء' },
]

const ids = (rows: PickableCourse[]) => rows.map((r) => r.id)

describe('مجالاتُ الترشيح', () => {
  it('تجمع المساراتِ والمجالاتِ معا — فمن يفرز لا يفرّق بينهما', () => {
    expect(courseGroups(CATALOG)).toEqual(
      ['العمليات', 'مسار التسويق', 'مسار الذكاء الاصطناعي'].sort((a, b) => a.localeCompare(b, 'ar')),
    )
  })

  it('ولا تكرارَ فيها وإن تشاركتها دوراتٌ كثيرة', () => {
    const groups = courseGroups(CATALOG)
    expect(new Set(groups).size).toBe(groups.length)
  })

  it('وكتالوجٌ بلا انتماءٍ لا مجالاتِ له — فلا يُعرض مرشِّحٌ بخيارٍ واحد', () => {
    expect(courseGroups([{ id: 'C-1', title: 'دورة' }])).toEqual([])
  })
})

describe('ترشيحُ الدورات', () => {
  it('وبلا شيءٍ يُرشَّح به تعود كلُّها', () => {
    expect(ids(filterCourses(CATALOG, {}))).toHaveLength(CATALOG.length)
    expect(ids(filterCourses(CATALOG, { group: ALL_GROUPS, q: '' }))).toHaveLength(CATALOG.length)
  })

  it('والمجالُ يحصرها — والقائمةُ بنفسها تُعرف بمجالها لا بمسار', () => {
    expect(ids(filterCourses(CATALOG, { group: 'مسار التسويق' })))
      .toEqual(['C-MKT-101', 'C-MKT-102'])
    expect(ids(filterCourses(CATALOG, { group: 'العمليات' }))).toEqual(['C-SOLO-901'])
  })

  it('② والبحثُ يُطبِّع العربيّة — لا يُطابق حرفا بحرف', () => {
    /* «الأتمتة» بأل التعريف وهمزةِ قطع، والعنوانُ «أتمتة» مجرّدةً */
    expect(ids(filterCourses(CATALOG, { q: 'اتمتة' })), 'لم تُطبَّع الهمزة')
      .toEqual(['C-SOLO-901'])
  })

  it('③ ويُبحَث بالرمز كما بالاسم — فمن نسخه يلصقه ويجد', () => {
    expect(ids(filterCourses(CATALOG, { q: 'C-AI-201' }))).toEqual(['C-AI-201'])
  })

  /* ═══ ① وهذا هو الحارسُ الذي من أجله كُتب الملفّ ═══

     اختار صاحبُ المنصّة «الاثنين معا». فلو ألغى أحدُهما الآخرَ لَعاد
     الطلبُ منقوصا وهو يبدو تامّا. */
  it('① والاثنان يضيقان معا — لا يلغي أحدُهما الآخر', () => {
    /* «دورة» تطابق الخمسَ جميعا، والمجالُ يحصرها في اثنتين */
    expect(ids(filterCourses(CATALOG, { q: 'دورة' })), 'البحثُ وحدَه')
      .toHaveLength(5)
    expect(ids(filterCourses(CATALOG, { group: 'مسار التسويق', q: 'دورة' })), 'المجالُ أُلغي')
      .toEqual(['C-MKT-101', 'C-MKT-102'])
    /* ثمّ يضيق البحثُ داخلَ المجال */
    expect(ids(filterCourses(CATALOG, { group: 'مسار التسويق', q: 'تمويل' })), 'البحثُ أُلغي')
      .toEqual(['C-MKT-101'])
    /* وما لا يجتمعان عليه لا يُعاد */
    expect(ids(filterCourses(CATALOG, { group: 'العمليات', q: 'تمويل' })))
      .toEqual([])
  })
})

/* ═══ ④ ومكوّنٌ واحدٌ لموضعَين ═══

   كانت القائمةُ الخامّةُ في شاشتَين، فلو أُصلحت إحداهما لَبقيت الأخرى
   على حالها ولَافترقتا عند أوّل تحسين. */
describe('وموضعا الاختيار يقرآن مكوّنا واحدا', () => {
  const SCREENS = [
    'src/pages/admin/CourseProposals.tsx',
    'src/pages/admin/PreparationSteps.tsx',
  ]

  it('وكلتاهما تستورد `CoursePicker`', () => {
    for (const f of SCREENS) {
      expect(read(f), `${f}: لا تستورد المكوّن المشترك`)
        .toContain('@/components/admin/CoursePicker')
    }
  })

  it('ولا تبني إحداهما قائمةَ دوراتٍ بيدها ثانيةً', () => {
    for (const f of SCREENS) {
      expect(read(f), `${f}: بقيت قائمةٌ خامّةٌ تصبّ الكتالوجَ كلَّه`)
        .not.toMatch(/courses\.map\(\(c\) => <option/)
      expect(read(f), `${f}: بقيت قائمةٌ خامّةٌ تصبّ الكتالوجَ كلَّه`)
        .not.toMatch(/\{courses\.map\(\(c\) => \(\s*<option/)
    }
  })

  it('والمكوّنُ يعرض المرشِّحَ والبحثَ معا — لا أحدَهما', () => {
    const cmp = read('src/components/admin/CoursePicker.tsx')
    expect(cmp, 'لا مرشِّحَ مجال').toContain('رشّحْ بالمجال أو المسار')
    expect(cmp, 'لا بحثَ بالكتابة').toContain('ابحث بالاسم أو الرمز')
    /* والعددُ مكتوبٌ: صندوقٌ خالٍ بلا تفسيرٍ يُقرأ عطبا */
    expect(cmp, 'لا يقول كم بقي من كم').toMatch(/من \$\{courses\.length\}/)
  })
})
