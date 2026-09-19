/* متنُ العقد — الفحصُ على بنيته لا على ورودِ عبارةٍ فيه.

   ── ولمَ لا يُفحَص بمطابقة نصّ ──

   العقدُ نصٌّ طويلٌ يُعاد صوغُه: تُحسَّن جملةٌ، ويُقدَّم بندٌ على بند. وحارسٌ
   يطابق عبارةً بعينها يحمرّ عند كلّ تحسينٍ لغويّ ويخضرّ عند كلّ عطبٍ حقيقيّ —
   فيُعطَّل بعد ثالث مرّة. وقد مرّ في هذه المنصّة ثلاثةُ حرّاسٍ خضراء لأسبابٍ
   خاطئة، أحدُها طابق نصّا في تعليق.

   فالمقيسُ هنا خصائصُ لا تتغيّر مهما أُعيدت الصياغة:

   · **لا أثرَ لقالبٍ لم يُعوَّض** — فوثيقةٌ فيها `{{…}}` أو `undefined` وصلت
     إنسانا هي أسوأُ ما يمكن أن يقع في هذا الباب.
   · **ترقيمُ البنود متّصلٌ من واحدٍ إلى آخره** — فبندٌ سقط أو تكرّر يجعل
     الإحالاتِ الداخليّة («وفق البند 3») تشير إلى غير ما تقصد.
   · **الملحقُ (أ) صورةٌ لما أُدخل، لا أقلَّ ولا أكثر** — وهو البندُ الذي
     يقوم عليه العقدُ كلُّه: ما أُدرج أُدرج، وما لم يُدرَج لا يظهر.
   · **واختلافُ أساس الأتعاب يُنتج نصّا مختلفا** — وإلّا فالأساسُ زينةٌ
     تُقرأ ولا تُحتسب. */

import { describe, expect, it } from 'vitest'
import {
  CONTRACT_BODY_VERSION, renderContractBodyAr,
  type ContractBodyInput, type ContractCompensation,
} from '@/application/trainer/contract-body'

const COURSES = [
  { courseId: 'C-A', titleAr: 'أساسيّاتُ تحليل البيانات' },
  { courseId: 'C-B', titleAr: 'إدارةُ المشاريع الرشيقة' },
]

const base = (over: Partial<ContractBodyInput> = {}): ContractBodyInput => ({
  academyPartyLineAr: 'شركةُ اختبارٍ، ذات مسؤولية محدودة، سجلّها 1 وضريبيّها 2، وعنوانها ش، ع',
  academyLegalNameAr: 'شركةُ اختبار',
  academyTradingNameAr: 'أكاديميّةُ اختبار',
  governingLawAr: 'المملكة الأردنية الهاشمية',
  disputeVenueAr: 'محاكم عمّان',
  trainerFullName: 'سارة عبد الله الحربي',
  trainerEmail: 'sara@example.com',
  applicationReference: 'WJ-TR-2026-00042',
  issuedOnAr: '19 سبتمبر 2026',
  courses: COURSES,
  compensation: { type: 'per_seat', rate: '25.00', currency: 'USD', minSeats: 8, referralRate: '30.00' },
  rateWaivedReasonAr: null,
  hoursNoteAr: null,
  requiredDocuments: [{ kind: 'national_id', labelAr: 'الهوية الوطنية', required: true }],
  ...over,
})

/** أرقامُ البنود كما وردت في المتن، بترتيب ورودها */
const clauseNumbers = (body: string) =>
  [...body.matchAll(/^البند (\d+) —/gm)].map((m) => Number(m[1]))

/** نصُّ بندٍ بعينه — من عنوانه إلى عنوان تاليه.

    ولا يصحّ `indexOf('البند 3')` هنا: المتنُ يحيل إلى البنود في تضاعيفه
    («وفق البند 3» في التمهيد)، وأوّلُ ورودٍ قد يسبق العنوانَ نفسَه فيخرج
    القسمُ فارغا — ويمرّ الحارسُ على فراغٍ ظانّا أنّه فحص. */
function clauseSection(body: string, n: number): string {
  const heads = [...body.matchAll(/^البند (\d+) —/gm)]
  const at = heads.find((h) => Number(h[1]) === n)
  if (!at) return ''
  const next = heads.find((h) => h.index! > at.index!)
  return body.slice(at.index!, next ? next.index! : body.length)
}

describe('متنُ العقد — لا يخرج ناقصا ولا يحمل أثرَ قالب', () => {
  it('لا قالبَ بقي بلا تعويض، ولا قيمةَ برمجيّةٍ تسرّبت إلى وثيقة', () => {
    const body = renderContractBodyAr(base())
    for (const leak of ['{{', '}}', 'undefined', 'null', 'NaN', '[object Object]']) {
      expect(body, `تسرّب «${leak}» إلى متنٍ يُوقَّع عليه`).not.toContain(leak)
    }
  })

  it('وترقيمُ البنود متّصلٌ بلا سقوطٍ ولا تكرار — فالإحالاتُ الداخليّةُ تصدق', () => {
    const nums = clauseNumbers(renderContractBodyAr(base()))
    expect(nums.length, 'لم يُقرأ بندٌ واحد — أتغيّرت صيغةُ العناوين؟').toBeGreaterThan(10)
    expect(nums, 'الترقيمُ غيرُ متّصل').toEqual(nums.map((_, i) => i + 1))
    expect(new Set(nums).size, 'بندٌ مكرَّر').toBe(nums.length)
  })

  it('والملاحقُ الأربعةُ كلُّها موجودة — ولا عقدَ بلا دوراتِه وأتعابِه', () => {
    const body = renderContractBodyAr(base())
    for (const tag of ['(أ)', '(ب)', '(ج)', '(د)']) {
      expect(body, `الملحق ${tag} غائب`).toContain(`الملحق ${tag}`)
    }
  })

  it('وإصدارُ الصياغة مطبوعٌ في المتن — فيُعرف بعد سنتين أيَّ صياغةٍ وقّع', () => {
    expect(renderContractBodyAr(base())).toContain(CONTRACT_BODY_VERSION)
  })
})

describe('الملحق (أ) صورةُ ما أُدخل — وهو صلبُ العقد', () => {
  it('كلُّ دورةٍ أُدخلت تظهر باسمها العربيّ', () => {
    const body = renderContractBodyAr(base())
    for (const c of COURSES) expect(body, `${c.titleAr} سقطت من الملحق`).toContain(c.titleAr)
  })

  it('ولا يظهر ما لم يُدرَج — لا اسما ولا رمزا لاتينيّا', () => {
    const body = renderContractBodyAr(base({ courses: [COURSES[0]] }))
    expect(body, 'ظهرت دورةٌ لم تُدرَج').not.toContain(COURSES[1].titleAr)
    /* والرموزُ اللاتينيّةُ لا تُطبَع أصلا — المدرّبُ يقرأ أسماءً لا مفاتيح */
    for (const c of COURSES) {
      expect(body, `الرمزُ ${c.courseId} في متنٍ يقرؤه إنسان`).not.toContain(c.courseId)
    }
  })

  it('وبلا دوراتٍ يقول الملحقُ ذلك صراحةً — لا جدولا خاليا يُقرأ سهوا', () => {
    const empty = renderContractBodyAr(base({ courses: [] }))
    const idx = empty.indexOf('الملحق (أ)')
    const section = empty.slice(idx, empty.indexOf('الملحق (ب)'))
    expect(section.length, 'الملحقُ (أ) خرج قسما فارغا').toBeGreaterThan(80)
    expect(section).toContain('لا دورات مدرجة')
  })
})

describe('أساسُ الأتعاب يُنتج نصّا يخصّه — وإلّا فهو زينة', () => {
  const rule = (over: Partial<ContractCompensation>): ContractCompensation =>
    ({ type: 'per_seat', rate: '25.00', currency: 'USD', minSeats: null, referralRate: null, ...over })

  it('الأنواعُ الثلاثةُ تُخرج ثلاثةَ نصوصٍ مختلفة', () => {
    const bodies = ['per_seat', 'fixed_per_cohort', 'revenue_share']
      .map((type) => renderContractBodyAr(base({ compensation: rule({ type }) })))
    expect(new Set(bodies).size, 'نوعان أنتجا النصَّ نفسَه').toBe(3)
  })

  it('والحدُّ الأدنى للمقاعد يظهر حين يوجد ويغيب حين لا يوجد', () => {
    const withFloor = renderContractBodyAr(base({ compensation: rule({ minSeats: 8 }) }))
    const without = renderContractBodyAr(base({ compensation: rule({ minSeats: null }) }))
    expect(withFloor).toContain('8')
    expect(withFloor.length, 'الحدُّ الأدنى لم يضف شيئا إلى المتن').toBeGreaterThan(without.length)
  })

  it('وبلا قاعدةِ أتعابٍ يقول المتنُ إنّها تُحدَّد لاحقا، ولا يترك المكانَ خاليا', () => {
    const body = renderContractBodyAr(base({ compensation: null, rateWaivedReasonAr: 'يُتّفق عليه بعد أوّل إسناد' }))
    expect(body).toContain('لم يتفق الطرفان بعد على أساس الأتعاب')
    expect(body).toContain('يُتّفق عليه بعد أوّل إسناد')
  })

  it('وبدلُ الإلغاء المتأخّر لا يكون صفرا في أيّ أساس — وإلّا فالبندُ 7 وعدٌ فارغ', () => {
    for (const type of ['per_seat', 'fixed_per_cohort', 'revenue_share']) {
      const body = renderContractBodyAr(base({ compensation: rule({ type, minSeats: null }) }))
      const section = clauseSection(body, 7)
      expect(section, `${type}: لا حدَّ أدنى للبدل`).toMatch(/لا يقل هذا البدل عن \d+/)
    }
  })
})

describe('وما يميّز هذا العقدَ عن غيره مكتوبٌ فيه لا مفهومٌ ضمنا', () => {
  it('التأهيلُ لا يُلزم بالإسناد — البندُ الذي طُلب أن يُكتب صراحةً', () => {
    const body = renderContractBodyAr(base())
    const section = clauseSection(body, 2)
    expect(section, 'لم يُقرأ البندُ الثاني أصلا').not.toBe('')
    /* لا مطابقةَ لجملةٍ بعينها: المقيسُ أنّ القسمَ يذكر الاحتمالاتِ الأربعةَ
       التي طلبها صاحبُ المنصّة — الكلَّ والبعضَ والواحدةَ والعدم. */
    expect(section).toMatch(/جميع|كل/)
    expect(section).toMatch(/بعض/)
    expect(section).toMatch(/واحدة/)
    expect(section).toMatch(/ألا تسند|لا تسند/)
  })

  it('والإسنادُ عرضٌ يُقبَل لا أمرٌ يُنفَّذ — وعليه يقوم شرطُ الشهر', () => {
    const body = renderContractBodyAr(base())
    const section = clauseSection(body, 3)
    expect(section, 'لم يُقرأ البندُ الثالثُ أصلا').not.toBe('')
    expect(section).toMatch(/قبول/)
    expect(section).toMatch(/لا ينشأ/)
  })

  it('ولا بندَ يُلزم المدرّبَ بردّ أتعابٍ قبضها عن عملٍ أدّاه', () => {
    const body = renderContractBodyAr(base())
    expect(body).toContain('ولا ترتب هذه الاتفاقية على المدرب أي التزام برد ما قبضه من أتعاب عن عمل أداه فعلا')
  })

  it('وحمايةُ بلد الإقامة الآمرةُ محفوظةٌ — فاختيارُ القانون لا يُلغيها', () => {
    const body = renderContractBodyAr(base())
    expect(clauseSection(body, 19)).toMatch(/حماية آمرة/)
  })
})
