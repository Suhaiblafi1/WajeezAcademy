/* أربعةُ تعديلاتٍ أمر بها صاحبُ المنصّة (٣٠ سبتمبر ٢٠٢٦).
 *
 * ── ① التدريبُ عن بُعد يُقال ولا يُترَك يُفهَم ──
 *
 * «يجب توضيح بأن التدريب سيكون اونلاين عن بعد لأن هذا غير موجود في العقد».
 * وكان محقّا: مسحُ المتن كلِّه لا يجد «عن بعد» ولا «أونلاين» ولا موضعا ولا
 * قاعة. و«مباشرة» في هذا العقد تقابل «مسجّلة» — حيٌّ في وقته لا حضوريٌّ في
 * مكان — فليست جوابا. والبند 3-2 يذكر «نمط التقديم» فيجعله متغيّرا لكلّ
 * إسناد، ولا يقرّر الأصل. فالوثيقةُ ساكتةٌ لا مخالِفة، والسكوتُ هو الخطر.
 *
 * ── ② الساعاتُ إرشادٌ يتحرّك في الاتّجاهين، والمالُ لا يتبعه ──
 *
 * «لا أريد أن يكون هذا شرط قطعيا لهم… يحق للمدرب تقليل عدد الساعات أو
 * زيادتها بالاتفاق مع الإدارة»، ثمّ: «لن تتأثر المبالغ المادية له فلن تقل
 * أم او تزيد وايضا اذكر ان وجود جلسات مسجلة يشجع لتقليل عدد ساعات المباشرة».
 *
 * وقولُه في المال حقٌّ يُثبَت: أنواعُ الأتعاب `per_seat` و`fixed_per_cohort`،
 * وليس فيها ساعة. فالجملةُ تقرير لواقعٍ قائمٍ لا وعدٌ جديد.
 *
 * ── ③ مدّةُ الشعبة يقترحها المدرّب ──
 *
 * «الموضوع بيدي هو يحدد متى تبدأ متى تنتهي… أقترح نحن بأنها لا تقل عن شهر
 * ولا تزيد عن ستة أسابيع فهذا كم مقترح فقط». ثمّ صريحا: «نعم ارشاديه فقط لا
 * قانون لا لا تعقد الأمور لن نرفض أكثر من ستة أسابيع ولا نرفض اقل من شهر
 * اتركها توضيحيه» — فلا حاجزَ في شيفرةٍ يردّ عند الرقمين.
 *
 * ── ④ الحدُّ الأعلى للمقاعد يحدّده المدرّب ──
 *
 * «الحد الأعلى للقاعة يحددها المدرب بنفسه»، ومعه اقتراحٌ: «نقترح بأن يكون
 * العدد لا يقل عن 20 اقتراح». وأنّه لا ينزل عن الحدّ الأدنى المضمون «واضحة
 * للجميع» — فتُقال في الوثيقة صراحةً، إذ ما كان بيّنا لصاحبه قد لا يكون
 * بيّنا لمن يوقّع.
 *
 * ── وتُقاس على المتن المصيَّر لا على الشيفرة ──
 *
 * على نمط `contract-language-review`: فحصٌ يطابق سطرا في ملفّ مصدرٍ يخضرّ
 * ولو لم يبلغ ذلك السطرُ الوثيقة.
 */

import { describe, expect, it } from 'vitest'
import {
  renderContractBodyAr, type ContractBodyInput, CONTRACT_BODY_VERSION,
} from '@/application/trainer/contract-body'
import {
  COHORT_SPAN_GUIDE_MAX_WEEKS, GUIDE_SESSIONS, MIN_LIVE_HOURS_GUIDE,
  GUIDE_SESSION_HOURS, SEAT_CAP_SUGGESTED_MIN,
} from '@/application/catalog/course-hours'
import { ACADEMY_LEGAL, academyPartyLineAr } from '@/data/academy-legal'

const BASE: ContractBodyInput = {
  academyPartyLineAr: academyPartyLineAr(),
  academyLegalNameAr: ACADEMY_LEGAL.legalNameAr,
  academyTradingNameAr: ACADEMY_LEGAL.tradingNameAr,
  governingLawAr: ACADEMY_LEGAL.governingLawAr,
  disputeVenueAr: ACADEMY_LEGAL.disputeVenueAr,
  trainerFullName: 'اسمٌ قانونيّ',
  trainerEmail: 'trainer@example.com',
  applicationReference: 'WJ-TR-2026-00000',
  issuedOnAr: '٣٠ سبتمبر ٢٠٢٦',
  courses: [{ courseId: 'C-1', titleAr: 'دورةٌ أولى' }],
  compensation: { type: 'per_seat', rate: '25', currency: 'USD', minSeats: 12, referralRate: '30' },
  rateWaivedReasonAr: null,
  hoursNoteAr: null,
  requiredDocuments: [{ kind: 'id', labelAr: 'الهوية', required: true }],
  conditional: null,
}
const body = renderContractBodyAr(BASE)
/** والمشروطُ كذلك: بنودُ 2-6..2-12 تُطبَع فيه، فيُتحقَّق أنّ الترقيمَ لم يصطدم */
const conditionalBody = renderContractBodyAr({
  ...BASE,
  conditional: { orientationOnAr: '٥ أكتوبر ٢٠٢٦', deadlineOnAr: '١٠ أكتوبر ٢٠٢٦', windowDays: 5, extensionDays: 2 },
})

const clause = (no: string, src = body): string => {
  const l = src.split('\n').find((x) => x.trimStart().startsWith(`${no} `))
  if (!l) throw new Error(`لا بندَ بالرقم «${no}» في المتن`)
  return l
}

describe('① التدريبُ عن بُعد مكتوبٌ في الوثيقة', () => {
  it('البند 1-7 يقرّر أنّ الخدمةَ كلَّها أونلاين، ولا حضورَ ولا انتقال', () => {
    const c = clause('1-7')
    expect(c, 'لم يُقَل إنّها عن بعد').toContain('عن بعد')
    expect(c, 'لم تُسمَّ أونلاين بلفظها الذي يعرفه المدرّب').toContain('أونلاين')
    expect(c, 'لم يُنفَ التدريبُ الحضوريّ').toContain('ولا يلتزم أي من الطرفين بتدريب حضوري')
    expect(c, 'لم يُنفَ الانتقالُ ونفقةُ السفر').toMatch(/انتقال/)
  })

  it('والمعجمُ يفرّق «المباشرة» عن «الحضوريّة» — وهي علّةُ اللبس', () => {
    expect(body, 'لا تعريفَ للجلسة المباشرة').toContain('· الجلسة المباشرة:')
    const line = body.split('\n').find((l) => l.startsWith('· الجلسة المباشرة:'))!
    expect(line, 'لم يُقَل إنّها أونلاين').toContain('أونلاين')
    expect(line, 'لم تُميَّز عن الحضوريّة، وهي علّةُ التعريف').toContain('لا مقابل جلسة حضورية')
  })

  it('والخلاصةُ تقوله في سطرها — فهي ما يُقرأ قبل البنود', () => {
    const line = body.split('\n').find((l) => l.startsWith('· والتقديم:'))
    expect(line, 'لا سطرَ للتقديم في الخلاصة').toBeTruthy()
    expect(line!, 'الخلاصةُ لا تقول إنّه عن بعد').toContain('عن بعد')
    expect(line!, 'الخلاصةُ لا تحيل إلى بنودها').toContain('1-7')
  })
})

describe('② الساعاتُ إرشادٌ يتحرّك، ولا يتبعه مال', () => {
  /* على العنوان لا على أوّل ورود: «الملحق (أ)» تَرِد في الخلاصة وفي البند
     2-1 قبل الملحق نفسِه، فقصٌّ من أوّلها يقيس موضعا آخر ويخضرّ عليه. */
  const annexA = () => {
    const head = body.indexOf('الملحق (أ) — ')
    const next = body.indexOf('الملحق (ب) — ')
    expect(head, 'لم يُوجَد عنوانُ الملحق (أ)').toBeGreaterThan(-1)
    expect(next, 'لم يُوجَد عنوانُ الملحق (ب)').toBeGreaterThan(head)
    return body.slice(head, next)
  }

  it('والمقطعُ المقيسُ هو الملحقُ (أ) نفسُه — وإلّا قيس موضعٌ آخر', () => {
    expect(annexA(), 'المقطعُ ليس الملحقَ (أ)').toContain('الدورات المؤهل لها')
    expect(annexA().length, 'المقطعُ أقصرُ من أن يكون ملحقا').toBeGreaterThan(200)
  })

  it('تتحرّك في الاتّجاهين بالاتّفاق — لا «لا تقل» وحدَها', () => {
    const a = annexA()
    expect(a, 'بقيت صيغةُ الحدّ الأدنى التي تُقرأ شرطا').not.toContain('لما لا يقل عن')
    expect(a, 'لم يُقَل إنّه إرشادٌ لا شرط').toContain('بيان استرشادي لا شرط')
    expect(a, 'لم يُذكَر النقصُ والزيادةُ معا').toContain('أن ينقص هذا العدد أو يزيده')
    expect(a, 'لم يُقَل بالاتّفاق مع الأكاديمية').toContain('بالاتفاق مع الأكاديمية')
  })

  it('ولا تتغيّر أتعابُه بنقصها ولا بزيادتها', () => {
    const a = annexA()
    expect(a, 'لم يُطمأنْ أنّ المالَ لا يتبع الساعة').toContain('ولا يترتب على نقصه ولا على زيادته تغير في أتعاب المدرب')
    expect(a, 'لم يُقَل إنّ الأتعابَ لا تُحتسب على الساعة').toContain('ولا تحتسب على الساعة')
  })

  it('والمسجَّلُ يعين على تقليل المباشر — وهو ما تشجّع عليه', () => {
    expect(annexA(), 'لم تُذكَر المسجّلةُ معينةً على تقليل المباشرة')
      .toContain('ووجود مواد مسجلة يعين على تقليل الساعات المباشرة')
  })

  it('والرقمُ وجلساتُه يُطبعان من مصدرٍ واحدٍ فلا يفترقان', () => {
    const a = annexA()
    expect(a).toContain(`${MIN_LIVE_HOURS_GUIDE} ساعة مباشرة`)
    expect(a, 'عددُ الجلسات لا يوافق الساعاتِ على طول الجلسة').toContain(`${GUIDE_SESSIONS} جلسات`)
    expect(GUIDE_SESSIONS * GUIDE_SESSION_HOURS, 'انفصل عددُ الجلسات عن الساعات').toBe(MIN_LIVE_HOURS_GUIDE)
  })
})

describe('③ مدّةُ الشعبة يقترحها المدرّب', () => {
  it('البند 3-6 يجعل الاقتراحَ له، والرقمان إرشادٌ لا يُردّ عنده', () => {
    const c = clause('3-6')
    expect(c, 'لم يُقَل إنّ المدرّبَ هو المقترح').toContain('ويقترح المدرب مدة الشعبة')
    expect(c, 'لم يُذكَر المدى بين الجلسات، وهو ما يطيل الدورةَ أو يقصرها').toContain('والمدى بين الجلسة والتي تليها')
    expect(c, 'لم يُقَل إنّه استرشاديّ').toContain('بيان استرشادي لا شرط')
    expect(c, 'لم يُطمأنْ أنّ الخروجَ عنه لا يُردّ').toContain('لا ترد الأكاديمية اقتراحه لخروجه عنه')
    expect(c).toContain(`${COHORT_SPAN_GUIDE_MAX_WEEKS} أسابيع`)
  })

  it('ويُقال القيدُ الحقيقيُّ وحدَه: لا تنتهي الشعبةُ بعد الفصل (17-9)', () => {
    expect(clause('3-6'), 'تُرك المدرّبُ يقترح مدّةً تتجاوز الفصلَ ثمّ تُردّ عليه').toContain('17-9')
  })

  it('ولا حاجزَ في الشيفرة يردُّ عند الرقمين — «لا قانون»', () => {
    /* الأمرُ صريح: «ارشاديه فقط… اتركها توضيحيه». فلو رُدَّ طلبٌ لخروجه عن
       المدى لَخُولف الأمرُ ولو طابق الرقمُ. والمقيسُ أنّ الرقمَ لا يُستعمل
       إلّا نصّا: `COHORT_SPAN_GUIDE_MAX_WEEKS` لا يظهر في مسلكِ ردّ. */
    expect(clause('3-6'), 'صار المدى شرطا في المتن').not.toMatch(/يجب|يشترط|ولا يقبل|ترد الأكاديمية اقتراحه(?! لخروجه)/)
  })
})

describe('④ الحدُّ الأعلى للمقاعد يحدّده المدرّب', () => {
  it('البند 3-7 يعطيه التحديدَ، ويمنع فتحَ ما يتجاوزه', () => {
    const c = clause('3-7')
    expect(c, 'لم يُعطَ المدرّبُ تحديدَ الحدّ الأعلى').toContain('وللمدرب أن يحدد الحد الأعلى لعدد مقاعد الشعبة')
    expect(c, 'حُدّد ولا أثرَ له — فما فائدةُ حدٍّ يُتجاوز؟').toContain('فلا تفتح الأكاديمية مقاعد تتجاوزه')
    expect(c, 'لم يُثبَت في عرض الإسناد فلا يُعرَف لأيّ شعبة').toContain('عرض الإسناد')
  })

  it('ولا ينزل عن الحدّ الأدنى المضمون — والاقتراحُ اقتراح', () => {
    const c = clause('3-7')
    expect(c, 'تُرك السقفُ ينزل تحت ما نضمن دفعَه، فنُلزَم بمقاعد لا تُباع')
      .toContain('ولا ينزل هذا الحد عن الحد الأدنى المضمون')
    expect(c).toContain(`${SEAT_CAP_SUGGESTED_MIN} مقعدا`)
    expect(c, 'صار الاقتراحُ حدّا').toContain('اقتراح لا حد')
  })

  it('ولا يُقلَب الحدُّ الأدنى المضمون سقفا بهذا البند', () => {
    expect(clause('3-7'), 'خُلط الحدّان فصار المضمونُ يُقرأ سقفا')
      .toContain('لا سقف لأتعاب المدرب')
  })
})

describe('وترقيمُ البنود لم يصطدم، والإصدارُ رُفع', () => {
  it('البندان الجديدان لا يزاحمان بنودَ العرض المشروط (2-6 إلى 2-12)', () => {
    for (const no of ['2-6', '2-7', '2-8', '2-11', '2-12']) {
      expect(() => clause(no, conditionalBody), `اختفى البند ${no} من العرض المشروط`).not.toThrow()
    }
    /* والجديدان في موضعهما في الحالين */
    for (const src of [body, conditionalBody]) {
      expect(() => clause('1-7', src)).not.toThrow()
      expect(() => clause('3-6', src)).not.toThrow()
      expect(() => clause('3-7', src)).not.toThrow()
    }
  })

  it('ولا يبقى البندُ 3-5 آخرَ بنود الإسناد، ولا يتكرّر رقم', () => {
    const nos = body.split('\n')
      .map((l) => l.trimStart().match(/^(\d+-\d+) /)?.[1])
      .filter((x): x is string => !!x)
    expect(new Set(nos).size, 'تكرّر رقمُ بندٍ في المتن').toBe(nos.length)
  })

  it('والإصدارُ رُفع — فلا يُقرأ متنٌ جديدٌ ببصمةِ قديم', () => {
    expect(CONTRACT_BODY_VERSION, 'بقي الإصدارُ على v16 والمتنُ تغيّر').not.toContain('v16')
    expect(CONTRACT_BODY_VERSION).toMatch(/^v17-/)
  })
})
