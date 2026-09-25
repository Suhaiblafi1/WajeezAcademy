/* ملحقُ الدورات المعتمدة — وعدٌ في المتن الموقَّع يُوفى.
 *
 * ── العطبُ الذي يحرسه ──
 *
 * البندُ 2-11 من المتن الذي يوقّعه المدرّبُ يقول بحرفه: «وتوقع الأكاديمية هذا
 * العرض من جهتها يوم يتحقق الشرط… **ويعاد إلى المدرب مع ملحق يبين الدورات
 * المعتمدة له**».
 *
 * فالملحقُ **التزامٌ وقّعه الطرفان**، ولم يكن يُبنى: العقدُ يُختَم، وتُحسب
 * أسماءُ الدورات للبريد وحدَه ثمّ تُنسى — والصفُّ يحفظ عددَها في الأثر لا
 * أسماءَها. فوثيقةٌ تَعِد بملحقٍ لا يصل تُقرأ على كاتبها لا له.
 *
 * ── وأوّلُ ما يُحرَس: أنّ الوعدَ في المتن أصلا ──
 *
 * الحارسُ يقرأ **المتنَ الحيَّ** لا نصّا مختلَقا: لو حُذفت جملةُ الوعد من
 * القالب يوما لصار الملحقُ زينةً لا وفاءً — ولو بقيت وحُذف الملحقُ عاد العطب.
 * فالطرفان يُقاسان معا.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ContractApproval from '@/components/ContractApproval'
import { readApprovedCourses } from '@/application/trainer/contract-execution'
import {
  renderContractBodyAr, APPROVAL_ANNEX_CLAUSE, APPROVAL_ANNEX_PROMISE,
  type ConditionalTerms,
} from '@/application/trainer/contract-body'
import { ACADEMY_LEGAL, academyPartyLineAr } from '@/data/academy-legal'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

const CONDITIONAL: ConditionalTerms = {
  orientationOnAr: '١ أكتوبر ٢٠٢٦',
  deadlineOnAr: '٨ أكتوبر ٢٠٢٦',
  windowDays: 7,
  extensionDays: 2,
}

/** المتنُ الحيُّ بحروفه — لا نصٌّ مختلَقٌ يجامل الحارس */
const liveBody = (conditional: ConditionalTerms | null) => renderContractBodyAr({
  academyPartyLineAr: academyPartyLineAr(),
  academyLegalNameAr: ACADEMY_LEGAL.legalNameAr ?? '',
  academyTradingNameAr: ACADEMY_LEGAL.tradingNameAr ?? 'أكاديمية وجيز',
  governingLawAr: ACADEMY_LEGAL.governingLawAr ?? '',
  disputeVenueAr: ACADEMY_LEGAL.disputeVenueAr ?? '',
  trainerFullName: 'اسمٌ قانونيّ',
  trainerEmail: 'trainer@example.com',
  applicationReference: 'WJ-TR-2026-00000',
  issuedOnAr: '٢٥ سبتمبر ٢٠٢٦',
  courses: [{ courseId: 'C-1', titleAr: 'دورةٌ أولى' }],
  compensation: { type: 'per_seat', rate: '30', currency: 'USD', minSeats: 8, referralRate: '45' },
  rateWaivedReasonAr: null,
  hoursNoteAr: 'أربعُ وحدات',
  requiredDocuments: [{ kind: 'id', labelAr: 'الهوية', required: true }],
  conditional,
})

const SNAPSHOT = [
  { courseId: 'C-A', titleAr: 'أساسيّاتُ المحاسبة' },
  { courseId: 'C-B', titleAr: 'إدارةُ المشاريع' },
]

const render = (snapshot: unknown, approvedAt: string | null = '2026-09-22T10:00:00.000Z') =>
  renderToStaticMarkup(createElement(ContractApproval, { snapshot, approvedAt }))

describe('وعدُ الملحق في المتن الموقَّع — والطرفان يُقاسان معا', () => {
  /* ولو حُذفت جملةُ الوعد من القالب لصار الملحقُ زينةً لا وفاءً بالتزام.
     فيُقاس على المتن الحيّ: أيَعِد العرضُ المشروطُ بملحقٍ يبيّن المعتمَد؟ */
  it('العرضُ المشروطُ يَعِد بملحقٍ يبيّن الدوراتَ المعتمدة', () => {
    const body = liveBody(CONDITIONAL)
    expect(body, 'لا وعدَ بملحقٍ في المتن — فعلى أيِّ شيءٍ يقوم الملحق؟')
      .toContain(APPROVAL_ANNEX_PROMISE)
  })

  /* ═══ وموضعُ الوعد بندُه بعينه لا إحالةٌ إليه ═══

     كُتب هذا الفحصُ أوّلا `lastIndexOf('2-11')` فيما قبل الوعد — **فنجا نقضُ
     إعادة الترقيم**: «2-11» تُذكَر ثلاثَ مرّاتٍ قبل البند نفسِه (في الإقرار،
     وفي الخلاصة، وفي الديباجة)، فوجد الفحصُ إحالةً وحسِبها بندا.

     فالمقيسُ **آخرُ ترقيمِ بندٍ في أوّل سطرٍ** قبل الوعد: ذاك هو البندُ الذي
     يسكنه الوعدُ، وما عداه ذكرٌ في جملة. */
  it('وموضعُه البندُ الذي يُطبَع في رأس الملحق — لا إحالةٌ إليه في جملة', () => {
    const body = liveBody(CONDITIONAL)
    const at = body.indexOf(APPROVAL_ANNEX_PROMISE)
    expect(at, 'لا وعدَ أصلا').toBeGreaterThan(0)
    const marks = [...body.slice(0, at).matchAll(/^(\d+-\d+) /gm)].map((m) => m[1])
    expect(marks.length, 'لم يُقرأ ترقيمُ بندٍ واحد — أفسدَ النمطُ القراءةَ؟').toBeGreaterThan(5)
    expect(marks[marks.length - 1], 'الوعدُ في بندٍ غيرِ الذي يُحيل إليه الملحق')
      .toBe(APPROVAL_ANNEX_CLAUSE)
  })

  /* والعرضُ غيرُ المشروطِ لا شرطَ فيه ولا اعتمادَ موادّ — فلا يَعِد بملحق */
  /* ═══ وترقيمُ البنود متّصلٌ بلا فجوة ═══

     رقمُ البند صار ثابتا واحدا يقرؤه المتنُ والملحق. وهو صوابٌ — يمنع أن
     يفترقا — ويفتح بابا آخر: من بدّل الثابتَ وحدَه بلا إعادة ترقيمِ ما حوله
     أخرج وثيقةً تقول «2-10» ثمّ «2-12» وتُسقط ما بينهما. والفجوةُ في ترقيم
     وثيقةٍ قانونيّةٍ تُقرأ بندا محذوفا، وهي أوّلُ ما يُسأل عنه.

     والحارسُ على الوثيقة كلِّها لا على بندي وحدَه: القياسُ واحدٌ، والحمايةُ
     تعمّ عشرين بندا بلا زيادة كلفة. وقد قيس أنّ الصورةَ اليومَ متّصلةٌ في
     الأقسام العشرين كلِّها قبل كتابة الحارس. */
  it('وترقيمُ البنود متّصلٌ في كلِّ قسمٍ — فلا يُقرأ بندٌ محذوف', () => {
    for (const body of [liveBody(CONDITIONAL), liveBody(null)]) {
      const bySection = new Map<number, number[]>()
      for (const m of body.matchAll(/^(\d+)-(\d+) /gm)) {
        const sec = Number(m[1])
        if (!bySection.has(sec)) bySection.set(sec, [])
        bySection.get(sec)!.push(Number(m[2]))
      }
      expect(bySection.size, 'لم يُقرأ قسمٌ واحد — أفسدَ النمطُ القراءةَ؟').toBeGreaterThan(10)
      for (const [sec, nums] of bySection) {
        expect(nums, `فجوةٌ أو تكرارٌ في ترقيم القسم ${sec}: ${nums.join('،')}`)
          .toEqual(nums.map((_, i) => i + 1))
      }
    }
  })

  it('وغيرُ المشروطِ لا يَعِد به — فلا يُنتظَر له ملحق', () => {
    expect(liveBody(null)).not.toContain(APPROVAL_ANNEX_PROMISE)
  })

  it('ورأسُ الملحق يحيل إلى بنده — فيُعرَف على أيِّ شيءٍ يقوم', () => {
    expect(render(SNAPSHOT)).toContain(`البند ${APPROVAL_ANNEX_CLAUSE}`)
  })
})

describe('الملحقُ يعرض ما اعتُمد ولا يُعرَض فارغا', () => {
  it('كلُّ دورةٍ في اللقطة تخرج باسمها العربيّ', () => {
    const html = render(SNAPSHOT)
    for (const c of SNAPSHOT) expect(html, `لا تُعرَض: ${c.titleAr}`).toContain(c.titleAr)
    /* ولا رمزَ لاتينيٌّ في وثيقةٍ يقرؤها إنسان */
    expect(html, 'خرج معرّفُ الدورة إلى الوثيقة').not.toContain('C-A')
  })

  it('وتاريخُ تحقّق الشرط يُطبَع معه', () => {
    expect(render(SNAPSHOT)).toContain('2026')
  })

  /* ═══ وملحقٌ فارغٌ أسوأُ من لا ملحق ═══
     «الدوراتُ المعتمدة: (لا شيء)» تحت وعدٍ بملحقٍ يبيّنها تُقرأ إلغاءً
     للاعتماد. وعقودُ ما قبل العمود، وغيرُ المشروط، لا لقطةَ لهما. */
  it('ولا يُعرَض ملحقٌ بلا دورة — ولا لعقدٍ لا لقطةَ له', () => {
    expect(render([]), 'عُرِض ملحقٌ خاوٍ').toBe('')
    expect(render(null), 'عُرِض ملحقٌ لعقدٍ لا لقطةَ له').toBe('')
    expect(render(undefined)).toBe('')
  })

  /* والبندُ 2-7: القبولُ لكلّ دورةٍ على حدة. وهو أهمُّ ما يُقرأ في الملحق —
     «ما ليس هنا لا يُدرَّس» — فبدونه يُقرأ الملحقُ قائمةَ اقتراحاتٍ لا حدّا. */
  it('ويقول إنّ ما ليس فيه لا يُقدَّم — وهو حدُّ الملحق لا زينتُه', () => {
    const html = render(SNAPSHOT)
    expect(html).toContain('البند 2-7')
    expect(html).toContain('لا تُقدَّم إلّا ما اعتُمد لك بعينه')
  })
})

describe('قراءةُ اللقطة — عمودُ JSON لا نوعَ له', () => {
  it('الفراغُ وما لا يُفهَم يُقرأ قائمةً فارغةً لا انهيارا', () => {
    for (const bad of [null, undefined, 'نصّ', 7, {}, [null], [7], [{}]]) {
      expect(readApprovedCourses(bad)).toEqual([])
    }
  })

  /* وعنوانٌ فارغٌ يسقط: سطرٌ خاوٍ في ملحقٍ قانونيٍّ يُقرأ نقصا في الاعتماد */
  it('وصفٌّ بلا عنوانٍ عربيٍّ يسقط وحدَه ولا يُسقط ما معه', () => {
    expect(readApprovedCourses([
      { courseId: 'C-1', titleAr: 'دورةٌ تامّة' },
      { courseId: 'C-2' },
      { titleAr: 'بلا معرّف' },
      { courseId: 'C-3', titleAr: '   ' },
      { courseId: 'C-4', titleAr: 'دورةٌ أخرى' },
    ])).toEqual([
      { courseId: 'C-1', titleAr: 'دورةٌ تامّة' },
      { courseId: 'C-4', titleAr: 'دورةٌ أخرى' },
    ])
  })
})

describe('والملحقُ لا يدخل المتنَ الموقَّعَ عليه', () => {
  /* المتنُ مهشَّشٌ، والملحقُ يُبنى **بعد** التوقيع بطبيعته — فلا تُعرَف
     الدوراتُ المعتمدةُ قبل تقييم موادّها. فمولِّدُ المتن لا يراه. */
  it('مولِّدُ المتن لا يستورد قارئَ اللقطة ولا يذكر عمودَها', () => {
    const code = liveBodySource().replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(code).not.toMatch(/readApprovedCourses/)
    expect(code, 'مولِّدُ المتن يذكر عمودَ اللقطة — أدخلَه في الموقَّع عليه؟')
      .not.toContain('approvedCoursesSnapshot')
  })
})

function liveBodySource(): string {
  return readFileSync(join(root, 'src/application/trainer/contract-body.ts'), 'utf8')
}
