/* مرشِّحا الطابور — بُعدان لا بُعد، وشاراتٌ تُبنى ممّا فيه لا ممّا كُتب.

   ═══ ما شُكي منه (٢١ سبتمبر ٢٠٢٦) ═══

   «أشعر أنّ الفرزَ معقّد… اجعلْ ليبلاتِ الفرز الرئيسيّة تخرج ممّا استعملناه
   فعلا: إن كان عندنا نشطٌ فضعْه في الأعلى، وإن كان مرفوضٌ فضعْه، وهكذا».
   و«أحتاج ترشيحَين: واحدٌ للّيبل الرئيسيّ وهو نشط أو مرفوض، والثاني لنتيجة
   التقييم» — فالمتقدّمُ قد يكون نشطا وتقييمُنا يقول «غير مناسب».

   ═══ وما كان قبلها ═══

   أربعُ شاراتٍ مكتوبةٍ بيدها (`QUICK_STATUSES`) لا تتبدّل. فتخطئ من الطرفين:
   «موقوف» في الطابور بلا شارة، وشارةٌ تُعرض لحالةٍ لا أحدَ فيها فتُنقَر
   وتُخرج لا شيء. وبُعدٌ واحدٌ يخلط الحالةَ بالنتيجة، فلا سبيلَ إلى سؤال
   «من هو نشطٌ ولم نوصِ به؟».

   ═══ وما يُحرَس ═══

   ① **لا قائمةَ شاراتٍ مكتوبةٌ في وحدة الحالات** — تُحسب من الصفوف.
   ② **وتُحسب من الطابور بأعدادها، ويُسقَط ما خلا منه** — في دالّةٍ واحدة.
   ③ **وبُعدان يجتمعان بالواو** — لا يُلغي أحدُهما الآخر.
   ④ **والطابورُ يُجلَب كلُّه** — فلا يُعَدّ ما لم يصل.
   ⑤ **ومفتاحُ النتيجة من الشارات نفسِها** — فلا مرشِّحٌ يُخرج ما يخالفه. */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { STATUS_LABELS } from '@/application/trainer/application-status'
import * as statusModule from '@/application/trainer/application-status'
import { facetsOf, resultKey, RESULT_CONTESTED, RESULT_NONE } from '@/application/trainer/queue-labels'
import { INTERVIEW_OUTCOMES } from '@/application/trainer/interview-outcome'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const SCREEN = 'src/pages/admin/TrainerApplications.tsx'

describe('① ولا قائمةَ شاراتٍ مكتوبةٌ بيدها', () => {
  it('`QUICK_STATUSES` ذهبت — والشاراتُ تُحسب لا تُكتب', () => {
    expect(Object.keys(statusModule), 'عادت قائمةُ الشارات المكتوبة')
      .not.toContain('QUICK_STATUSES')
  })

  it('ومعجمُ الحالات باقٍ — هو عنوانُها وترتيبُها معا', () => {
    expect(STATUS_LABELS.active).toBe('نشط')
    expect(STATUS_LABELS.suspended, '«موقوف» ليست في المعجم — وهي في الطابور').toBe('موقوف')
  })
})

/* ═══ ولمَ يُفحَص الحسابُ لا نصُّ الشاشة (٢١ سبتمبر ٢٠٢٦) ═══

   كان هنا حارسٌ يقرأ نصَّ الشاشة بـ`regex`: «بعد `statusFacets` بأربعمئة
   حرفٍ يقع `filter((f) => f.n > 0)`». ونُقض إسقاطُ الخالي من شاراتِ الحالة
   فخضرّ الحارس — لأنّ `resultFacets` تحته بسطرَين فيها الشرطُ نفسُه، فوقع
   المطابِقُ على جارِ ما يحرسه. وهو المحذورُ بعينه: «الفحصُ على البنية لا
   على ورودِ حرفٍ في ملفّ».

   فخرج الحسابُ إلى `facetsOf`، وصار المحروسُ سلوكَها: العدُّ، وإسقاطُ
   الخالي، وترتيبُ المفاتيح كما أُعطيت. ويبقى على الشاشة شيءٌ واحدٌ لا
   يُفحَص إلّا فيها: أنّ صفَّيها كليهما يُبنيان بها لا بيدٍ ثالثة. */
describe('② والشاشةُ تحسبها من الطابور', () => {
  /* والطابورُ المصطنَعُ هنا مقصودُ الشكل: «قيد المراجعة» أقدمُ في دورة
     الحياة وأقلُّ عددا من «نشط». فلو رُتّبت الشاراتُ بالعدد لَسبق «نشطٌ»
     «قيدَ المراجعة» — وبهذا يُنقَض ترتيبٌ بالعدد ويُرى ساقطا. */
  const rows = [
    { status: 'under_review' }, { status: 'active' }, { status: 'active' },
    { status: 'rejected' }, { status: 'suspended' },
  ]

  it('تُعَدّ من الصفوف — لا رقمٌ مكتوبٌ ولا رقمٌ ناقص', () => {
    const facets = facetsOf(['active', 'rejected', 'suspended'], rows, (r) => r.status)
    expect(facets.map((f) => f.n), 'العدُّ لا يطابق الصفوف').toEqual([2, 1, 1])
  })

  it('وما خلا من الصفوف لا يُعرض — فلا شارةٌ تُنقَر وتُخرج لا شيء', () => {
    const facets = facetsOf(Object.keys(STATUS_LABELS), rows, (r) => r.status)
    expect(facets.map((f) => f.key), 'عُرضت شارةٌ لحالةٍ لا أحدَ فيها')
      .toEqual(['under_review', 'active', 'rejected', 'suspended'])
  })

  it('و«موقوف» تُعرض وإن لم تكن في الأربع المكتوبة قبلُ', () => {
    const facets = facetsOf(Object.keys(STATUS_LABELS), rows, (r) => r.status)
    expect(facets.find((f) => f.key === 'suspended'), 'حالةٌ في الطابور بلا شارة').toBeTruthy()
  })

  it('وترتيبُها ترتيبُ المفاتيح المعطاة لا الأكثرَ عددا — فلا تقفز تحت اليد', () => {
    const order = Object.keys(STATUS_LABELS)
    const facets = facetsOf(order, rows, (r) => r.status)
    const asGiven = facets.map((f) => order.indexOf(f.key))
    expect(asGiven, 'الشاراتُ تُرتَّب بغير ترتيب المفاتيح')
      .toEqual([...asGiven].sort((a, b) => a - b))
    /* وشرطُ صحّةِ النقض: الأقدمُ في الدورة أقلُّ عددا من التالي له. فلو
       اختلّ هذا في المعجم يوما لَخضرّ الفحصُ بلا أن يفحص شيئا. */
    expect(order.indexOf('under_review'), 'المعجمُ نفسُه تبدّل فبطل الفحص')
      .toBeLessThan(order.indexOf('active'))
    expect(facets.find((f) => f.key === 'under_review')!.n, 'الطابورُ المصطنَعُ تبدّل فبطل الفحص')
      .toBeLessThan(facets.find((f) => f.key === 'active')!.n)
  })

  it('وصفّا الشاشة كلاهما يُبنيان بها — فلا حسابٌ ثالثٌ ينحرف', () => {
    const screen = code(SCREEN)
    expect(screen.match(/facetsOf\(/g) ?? [], 'صفٌّ يحسب شاراتِه بيده').toHaveLength(2)
    expect(screen, 'شاراتُ الحالة لا تُحسب من الصفوف')
      .toMatch(/statusFacets = facetsOf\(Object\.keys\(STATUS_LABELS\), apps,/)
    expect(screen, 'شاراتُ النتيجة لا تُحسب من الصفوف')
      .toMatch(/resultFacets = facetsOf\(/)
  })

  it('وعددُ كلٍّ مكتوبٌ عليها — فيُعرف ما تُخرجه قبل نقرها', () => {
    const screen = code(SCREEN)
    expect(screen, 'شارةُ حالةٍ بلا عدد').toMatch(/statusFacets\.map\(\(f\) =>[\s\S]{0,600}?\{f\.n\}/)
    expect(screen, 'شارةُ نتيجةٍ بلا عدد').toMatch(/resultFacets\.map\(\(f\) =>[\s\S]{0,600}?\{f\.n\}/)
  })
})

describe('③ وبُعدان يجتمعان بالواو', () => {
  const screen = code(SCREEN)

  it('لكلٍّ حالتُه — ولا يُكتبان في واحدة', () => {
    expect(screen, 'مرشِّحُ النتيجة مفقود').toContain('const [resultFilter, setResultFilter]')
    expect(screen, 'مرشِّحُ الحالة مفقود').toContain('const [filter, setFilter]')
  })

  it('ويُرشَّحان معا لا بدلا — «نشطٌ» و«غير مناسب» نقرتان لسؤالٍ واحد', () => {
    expect(screen, 'الحالةُ لا تُرشِّح الصفوف').toContain('!filter || a.status === filter')
    expect(screen, 'النتيجةُ لا تُرشِّح الصفوف').toContain('!resultFilter || resultKey(a) === resultFilter')
  })

  it('وكلٌّ منهما يُنقَر ثانيةً فيُفرَج عنه', () => {
    expect(screen).toContain('setFilter(filter === f.key ? "" : f.key)')
    expect(screen).toContain('setResultFilter(resultFilter === f.key ? "" : f.key)')
  })
})

describe('④ والطابورُ يُجلَب كلُّه', () => {
  it('لا حالةَ في النداء — وإلّا عُدّ ما وصل لا ما في الطابور', () => {
    const screen = code(SCREEN)
    expect(screen, 'النداءُ ما زال يُرشَّح بالحالة في الخادم')
      .not.toMatch(/trainer-applications\$\{filter/)
    expect(screen, 'الطابورُ لا يُجلَب كلُّه')
      .toContain('apiGet<AppRow[]>("/api/admin/trainer-applications")')
  })
})

describe('⑤ ومفتاحُ النتيجة من الشارات نفسِها', () => {
  it('لكلّ نتيجةٍ يقبلها الخادمُ مفتاحٌ يُرشَّح به', () => {
    for (const o of INTERVIEW_OUTCOMES) {
      expect(resultKey({ interviewOutcome: o.key, reviewVerdicts: [] }), o.key).toBe(o.key)
    }
  })

  it('ومعهما حالتان محسوبتان: بلا نتيجة، ومختلَفٌ عليه', () => {
    expect(resultKey({ interviewOutcome: null, reviewVerdicts: [] })).toBe(RESULT_NONE)
    expect(resultKey({
      interviewOutcome: null,
      reviewVerdicts: [{ verdict: 'passed', reviewerName: 'سارة' }, { verdict: 'failed', reviewerName: 'أحمد' }],
    })).toBe(RESULT_CONTESTED)
  })

  it('ولكلّ مفتاحٍ لفظٌ في الشاشة — فلا يُقرأ `contested` حرفا لاتينيّا', () => {
    const screen = code(SCREEN)
    const labels = /const RESULT_LABEL_AR: Record<string, string> = \{([\s\S]*?)\n\};/.exec(screen)?.[1] ?? ''
    expect(labels, 'معجمُ المحسوبتين مفقود').toBeTruthy()
    expect(labels, '«بلا نتيجة» بلا لفظ').toContain('RESULT_NONE')
    expect(labels, '«مختلَفٌ عليه» بلا لفظ').toContain('RESULT_CONTESTED')
    /* وما عداهما من المعجم — لا يُكتب هنا ثانيةً */
    expect(screen, 'ألفاظُ النتائج تُكتب بيد الشاشة').toContain('outcomeLabelAr(f.key)')
  })
})
