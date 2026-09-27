/* مُهَلُ العرض المشروط: يومان للتوقيع، وخمسةٌ للموادّ من التوقيع.
 *
 * قرارُ صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦): «مدّةُ توقيع الاتفاقيّة يومان فقط!
 * وبعد أن هو يوقّع ونحن نوقّع يفتح المنصّة ليقوم بتعبئة الموارد كافّة…
 * معه ٥ أيّام من بعد التوقيع لإتمام الموادّ التعليميّة الخاصّة بدوراته،
 * وأبلغهم أنّ هناك ستكون جلسةُ توتوريال تُحدَّد بعد التوقيع للتعريف بآليّة
 * وضع المناهج وغيرها».
 *
 * ── وما الذي تغيّر في المبدأ لا في الرقم ──
 *
 * كانت المهلةُ تبدأ من **جلسة التهيئة**، فلزم أن يُعرَف موعدُها قبل تركيب
 * العرض — وكان ذلك شرطا يردّ التركيب (٢٦ سبتمبر). وصار أصلُها **التوقيعَ**،
 * وهو فعلُ المدرّب نفسِه: يقع ويُكتب في الصفّ لحظتَه، فلا يحتاج إلى وعدٍ من
 * أحد. فسقط الشرطُ لسقوط علّته، لا نقضا لحكمه.
 *
 * وهذا يحرس الأثرَ القانونيَّ لا الرقمَ وحدَه: متنٌ يُجمَّد ويُوقَّع لا يُكتب
 * فيه أجلٌ محسوبٌ على تاريخٍ مفترَض.
 */

import { describe, expect, it } from 'vitest'
import {
  renderContractBodyAr, CONTRACT_BODY_VERSION, type ContractBodyInput,
} from '@/application/trainer/contract-body'
import { DEFAULT_REQUIRED_DOCUMENTS } from '@/application/trainer/contract-documents'
import { CONTRACT_SIGNING_LINK_DAYS } from '@/application/trainer/notice-periods'
import { MATERIALS_WINDOW_DAYS, deadlineFrom } from '@/application/trainer/conditional-offer'

/* والأتعابُ نصوصٌ لا أرقام (`ContractCompensation.rate: string`): تُنسَّق قبل
   أن تصل إلى وحدةٍ تعمل في المتصفّح، فلا `Decimal` فيها. وتنميطُ المُعِدّ
   يمسك ذلك — والقالبُ الذي يُصَبُّ بـ`as` يُخفيه. */
const base: Omit<ContractBodyInput, 'conditional'> = {
  academyPartyLineAr: 'أكاديمية وجيز للتدريب', academyLegalNameAr: 'أكاديمية وجيز للتدريب',
  academyTradingNameAr: 'أكاديمية وجيز', governingLawAr: 'القانون الأردني', disputeVenueAr: 'محاكم عمّان',
  trainerFullName: 'سعادُ المدرّبة', trainerEmail: 't@example.com',
  applicationReference: 'WJ-TR-2026-00042', issuedOnAr: '27 سبتمبر 2026',
  courses: [{ courseId: 'C-ACC-101', titleAr: 'أساسيات المحاسبة', totalHours: 20, recordedHours: 4 }],
  compensation: { type: 'per_seat', rate: '15', referralRate: '25', minSeats: 5, currency: 'USD' },
  rateWaivedReasonAr: null, hoursNoteAr: null, requiredDocuments: DEFAULT_REQUIRED_DOCUMENTS,
}

/** عرضٌ مشروطٌ كما يُركَّب فعلا: بلا أجلِ انتهاءٍ — فالتوقيعُ لم يقع بعد */
const offer = (orientationOnAr: string | null = null) => renderContractBodyAr({
  ...base,
  conditional: {
    orientationOnAr, deadlineOnAr: null,
    windowDays: MATERIALS_WINDOW_DAYS, extensionDays: 2,
  },
})

describe('① المُهَل بأرقامها', () => {
  it('نافذةُ التوقيع يومان', () => {
    expect(CONTRACT_SIGNING_LINK_DAYS).toBe(2)
  })

  it('ومهلةُ الموادّ خمسةُ أيّام', () => {
    expect(MATERIALS_WINDOW_DAYS).toBe(5)
  })

  it('وتُحسَب من تاريخٍ يُعطى — فالأصلُ معطى لا مفترَض', () => {
    const signedAt = new Date('2026-09-27T10:00:00.000Z')
    const due = deadlineFrom(signedAt)!
    expect(due.getTime() - signedAt.getTime()).toBe(MATERIALS_WINDOW_DAYS * 86_400_000)
    /* ولا أجلَ بلا أصل: من لم يوقّع لا مهلةَ له */
    expect(deadlineFrom(null)).toBeNull()
  })
})

describe('② والمتنُ يقول المبدأ: المهلةُ من التوقيع', () => {
  const body = offer()

  /* ═══ وانتقل الأصلُ مرّةً ثالثة (٢٧ سبتمبر ٢٠٢٦) ═══

     الجلسةُ ← التوقيعُ ← **اعتمادُ التوقيع**. وخطواتُ صاحب المنصّة: «② نراجع
     توقيعَك ونعتمده … ④ بعدها لديك ٥ أيّام». وعلّتُه العمليّةُ أنّ بوّابةَ
     الموادّ لا تُفتح قبل أن يُمنَح دورَ المدرّب، ولا يُمنَحه إلّا بالاعتماد —
     فكانت ساعةٌ تدور على بابٍ مقفل. */
  it('البند 2-8 يردّ المهلةَ إلى اعتماد التوقيع لا إلى التوقيع ولا إلى الجلسة', () => {
    expect(body, 'البند 2-8 غائب').toMatch(/^2-8 /m)
    const clause = /^2-8 .*$/m.exec(body)![0]
    expect(clause, 'المهلةُ لا تُردّ إلى الاعتماد').toContain('تبدأ من تاريخ اعتماد الأكاديمية لتوقيعه')
    expect(clause, 'عادت تُحسَب من جلسة التهيئة').not.toMatch(/تبدأ من تاريخ جلسة/)
    expect(clause, 'عادت تُحسَب من توقيعه وحدَه').not.toContain('تبدأ من تاريخ توقيعه هذا العرض')
  })

  it('والبوّابةُ تُفتح باعتماد توقيعه بعد مطابقة اسمه', () => {
    const clause = /^2-8 .*$/m.exec(body)![0]
    expect(clause, 'لا يُقال له متى تُفتح بوّابتُه').toContain('فتحت له بوابته على المنصة')
    expect(clause, 'لا تُذكَر مطابقةُ الاسم — وهي ما ينتظره').toContain('تطابق اسمه القانوني')
    expect(clause, 'عادت تُفتح بتوقيعه وحدَه').not.toContain('فور توقيعه')
  })

  it('والخلاصةُ تقول ما يقوله البند — لا تاريخا آخر', () => {
    const line = body.split('\n').find((l) => l.startsWith('· وما يلزمك الآن:'))
    expect(line, 'سطرُ المهلة غائبٌ من الخلاصة').toBeDefined()
    expect(line!, 'الخلاصةُ تُحيل المهلةَ إلى غير الاعتماد')
      .toContain('بعد أن نعتمد توقيعك')
  })
})

describe('③ وجلسةُ التهيئة وعدٌ على الأكاديميّة لا شرطٌ على المدرّب', () => {
  it('بلا موعدٍ: يُوعَد بها ولا يُدَّعى تاريخ', () => {
    const clause = /^2-8 .*$/m.exec(offer())![0]
    expect(clause).toContain('وتعقد له الأكاديمية جلسة تعريفية')
    expect(clause).toContain('ويبلغ المدرب بموعدها كتابة بعد اعتماد توقيعه')
    /* ولا يُخترَع تاريخٌ لمن لا تاريخَ له */
    expect(clause, 'ادُّعي موعدٌ لجلسةٍ لم تُحدَّد').not.toMatch(/\d{4}/)
  })

  it('وبموعدٍ: يُطبَع', () => {
    const clause = /^2-8 .*$/m.exec(offer('30 سبتمبر 2026، 12:30'))![0]
    expect(clause).toContain('وموعدها 30 سبتمبر 2026، 12:30')
  })

  it('وحضورُها لا يوقف المهلةَ ولا يمدّها — فلا يُعلَّق أجلٌ على موعدٍ منّا', () => {
    expect(/^2-8 .*$/m.exec(offer())![0])
      .toContain('ولا يترتب على عدم حضورها وقف المهلة ولا امتدادها')
  })
})

describe('④ وأجلُ سقوط العرض مكتوبٌ في متنه', () => {
  const body = offer()

  it('البند 16-5 يقول الأجلَ ويقول بابَ التجديد', () => {
    expect(body, 'لا أجلَ لسقوط العرض — فيبقى مفتوحا شهورا').toMatch(/^16-5 /m)
    const clause = /^16-5 .*$/m.exec(body)![0]
    expect(clause).toContain('يومين')
    expect(clause, 'أجلٌ بلا بابِ تجديدٍ يحبس من فاته').toContain('أن تجدد العرض ورابطه')
    expect(clause, 'السقوطُ يُقرأ إخلالا').toContain('ولا يعد سقوط العرض إخلالا')
  })

  it('ولا يُكتب «2 يومين» — والمثنّى لا يحمل عددَه', () => {
    expect(body, 'لحنٌ في وثيقةٍ تُقرأ في نزاع').not.toMatch(/\b2 يومين/)
  })
})

describe('⑤ وما يلزمه قبل أن نوقّع — الفجوةُ التي كانت', () => {
  it('البند 17-1 يقول أيَّ البنود تسري بتوقيعه وحدَه', () => {
    const clause = /^17-1 .*$/m.exec(offer())![0]
    /* وبلا هذا يكون ملزَما بمهلةٍ في وثيقةٍ «تسري من تاريخ توقيع الطرفين»
       ولم نوقّعْ بعد — فيُسأل: بأيّ نصٍّ جرى عليه الأجل؟ */
    expect(clause, 'لا نصَّ يُسري شيئا بتوقيعه وحدَه').toContain('من تاريخ توقيعه هو')
    /* ═══ والاستثناءُ ضاق بانتقال المهلة (٢٧ سبتمبر ٢٠٢٦) ═══

       كان يشمل البنودَ 2-6 إلى 2-11 لأنّ مهلتَه كانت تجري بتوقيعه وحدَه —
       أي قبل أن تسري الاتفاقيّة. وقد صار أصلُ المهلة اعتمادَنا، فالعقدُ
       نافذٌ من الطرفين قبل أن تبدأ. فلم يبقَ للاستثناء إلّا ما يقع فعلا
       بتوقيعه: وثائقُه وبياناتُه والاعتدادُ بتوقيعه. */
    expect(clause, 'بقي بندُ الشرط في استثناءِ ما يسري بتوقيعه وحدَه')
      .not.toMatch(/2-6 إلى 2-1[12]/)
    expect(clause, 'لا يُقال ما الذي يسري بتوقيعه').toMatch(/10 و11 و12 و15 و16/)
    expect(clause, 'توقيعُه وحدَه يُقرأ التزاما علينا بالإسناد')
      .toContain('ولا يرتب توقيعه وحده على الأكاديمية التزاما بإسناد')
  })

  it('ولا يُقال ذلك في بندٍ يُوثَّق على مدرّبٍ نشط — لا شرطَ فيه أصلا', () => {
    const plain = renderContractBodyAr({ ...base, conditional: null })
    expect(/^17-1 .*$/m.exec(plain)![0]).not.toContain('من تاريخ توقيعه هو')
  })
})

describe('⑥ وصياغةُ المتن تُرفَع — فلا يُقرأ متنٌ جديدٌ بإصدارٍ قديم', () => {
  it('الإصدارُ بعد اليوم', () => {
    expect(CONTRACT_BODY_VERSION).toBe('v12-2026-09-27')
  })
})
