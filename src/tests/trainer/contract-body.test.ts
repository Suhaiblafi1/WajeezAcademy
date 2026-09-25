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
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  payoutTimingNoteAr,
  PAYOUT_APPROVAL_DAYS, PAYOUT_OUTER_DAYS, PAYOUT_TRANSFER_DAYS,
} from '@/application/trainer/notice-periods'
import {
  CONTRACT_ACKS, CONTRACT_BODY_VERSION, CONTRACT_CONSENT_VERSION,
  bodyCarriesConditionClause, contractAcks, renderContractBodyAr, feeBasisAr,
  type ContractBodyInput, type ContractCompensation,
} from '@/application/trainer/contract-body'
import { parseContractDoc, feeRuleCells, blockLineAr } from '@/application/trainer/contract-sections'
import { buildFeeExampleAr, FEE_EXAMPLE_HEADING_AR, SEASON_COURSES } from '@/application/trainer/fee-example'

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
  /* والأصلُ اتفاقيّةٌ مطلقةٌ لا عرضٌ مشروط: فحرّاسُ المتن القائمةُ تفحص
     الوثيقةَ كما كانت، وللمشروط حرّاسُه أسفلَ الملفّ. */
  conditional: null,
  ...over,
})

/** شروطُ عرضٍ مشروطٍ عُرف موعدُ جلسته — وللمجهولِ موعدُها اختبارٌ بعينه */
const CONDITIONAL: NonNullable<ContractBodyInput['conditional']> = {
  orientationOnAr: 'الخميس 1 أكتوبر 2026، 7:00 م',
  deadlineOnAr: '8 أكتوبر 2026',
  windowDays: 7,
  extensionDays: 2,
}

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

/** أرقامُ الفقرات داخل بندٍ بعينه — `4-1` و`4-2` … بترتيب ورودها.

    ولمَ لا يكفي ترقيمُ البنود وحدَه: الإحالاتُ في المتن تنزل إلى الفقرة
    («وفق البند 4-5»، «استثناء من البندين 17-3 و17-4»). وإدخالُ فقرةٍ في وسط
    بندٍ يزحزح ما بعدها، فتشير الإحالةُ إلى فقرةٍ أخرى **موجودةٍ** تقول غيرَ
    ما قُصد — وذاك عطبٌ لا يُرى بالعين في وثيقةٍ من عشرين بندا. */
const subItems = (body: string, n: number) =>
  [...clauseSection(body, n).matchAll(new RegExp(`^${n}-(\\d+) `, 'gm'))].map((m) => Number(m[1]))

/** موضعُ عنوانِ ملحقٍ بعينه — عنوانا في رأس سطرٍ لا إحالةً في وسط جملة.

    و`indexOf('الملحق (ب)')` لا يصلح: المتنُ يحيل إلى ملاحقه في تضاعيفه
    (البندُ 4-1 يحيل إلى (ب)، والتمهيدُ إلى (أ))، فأوّلُ ورودٍ قد يسبق
    العنوانَ بمئات الأسطر — فيخرج «قسمُ الملحق» فارغا أو مقلوبا، **ويمرّ
    الحارسُ على فراغٍ ظانّا أنّه فحص**. وقد وقع ذلك فعلا حين دخلت إحالةُ
    4-1 إلى الملحق (ب). */
function annexAt(body: string, letter: string): number {
  const at = new RegExp(`^الملحق \\(${letter}\\) —`, 'm').exec(body)
  expect(at, `لا عنوانَ للملحق (${letter}) في رأس سطر`).toBeTruthy()
  return at!.index
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

  it('وترقيمُ الفقرات داخل كلّ بندٍ متّصلٌ كذلك — وإلّا أشارت إحالةٌ إلى غيرِ ما تقصد', () => {
    const body = renderContractBodyAr(base())
    for (const n of clauseNumbers(body)) {
      const subs = subItems(body, n)
      expect(subs.length, `البندُ ${n} خرج بلا فقرةٍ واحدة`).toBeGreaterThan(0)
      expect(subs, `ترقيمُ فقرات البند ${n} غيرُ متّصل`).toEqual(subs.map((_, i) => i + 1))
    }
  })

  it('وكلُّ إحالةٍ داخليّةٍ تقع على بندٍ وفقرةٍ موجودَين', () => {
    const body = renderContractBodyAr(base())
    const clauses = new Map(clauseNumbers(body).map((n) => [n, subItems(body, n)]))
    const refs = [...body.matchAll(/البند(?:ين)? (\d+)(?:-(\d+))?/g)]
    expect(refs.length, 'لم تُقرأ إحالةٌ واحدة — أتغيّرت صيغةُ الإحالات؟').toBeGreaterThan(10)
    for (const r of refs) {
      const clause = Number(r[1])
      expect(clauses.has(clause), `إحالةٌ إلى «البند ${clause}» ولا وجودَ له`).toBe(true)
      if (r[2]) {
        expect(
          clauses.get(clause)!.includes(Number(r[2])),
          `إحالةٌ إلى «البند ${clause}-${r[2]}» ولا وجودَ لهذه الفقرة`,
        ).toBe(true)
      }
    }
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
    const section = empty.slice(annexAt(empty, 'أ'), annexAt(empty, 'ب'))
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
    expect(clauseSection(body, 20)).toMatch(/حماية آمرة/)
  })
})


/* ═══ وسبعةٌ أُخذت من مسوّدتين سابقتين — ٢٠ سبتمبر ٢٠٢٦ ═══

   والمقيسُ في كلٍّ منها **البنيةُ التي تجعل البندَ يعمل**، لا ورودُ جملةٍ
   فيه: أنّ المنعَ له استثناءٌ يقابله، وأنّ التعويضَ يجري في الاتّجاهين،
   وأنّ الإقرارَ موصولٌ بجزائه. فبندٌ يُمنَع فيه شيءٌ بلا استثناءٍ يناقض ما
   نصرفه فعلا، وتعويضٌ في اتّجاهٍ واحدٍ يُخفَّض عند النزاع — وكلاهما يمرّ
   على حارسٍ يبحث عن عبارة. */
describe('التحصيلُ المباشرُ ممنوع — والاستثناءُ معه، وإلّا ناقض النصُّ ما نصرفه', () => {
  it('البندُ 13 يمنع أخذَ المال من المتعلّم، ويستثني ما تدفعه الأكاديميّةُ هي', () => {
    const section = clauseSection(renderContractBodyAr(base()), 13)
    expect(section, 'لم يُقرأ البندُ 13 أصلا').not.toBe('')
    expect(section, 'لا منعَ للتحصيل من المتعلّم').toMatch(/لا يحصل المدرب من متعلم/)
    expect(section, 'المنعُ بلا استثناءٍ لما تدفعه الأكاديميّةُ هي').toMatch(/ويستثنى/)
  })

  /* واسمُه «رابط الدعوة» منذ `v8` — وحّد لسانَ العقد بلسان البوّابة */
  it('ورابطُ الدعوة مستثنى بالاسم — فالمنصّةُ تدفع عليه فعلا', () => {
    const section = clauseSection(renderContractBodyAr(base()), 13)
    expect(section, 'رابطُ الدعوة غيرُ مستثنى، والمنصّةُ تدفع عليه').toMatch(/رابط دعوته/)
  })

  it('وما حُصّل خلافا لذلك يُردّ ولا يُعدّ حسما — فلا يُنقَض منعُ الحسم', () => {
    const body = renderContractBodyAr(base())
    const section = clauseSection(body, 13)
    const noDeduction = [...clauseSection(body, 4).matchAll(/^4-(\d+) ولا تجري الأكاديمية أي حسم/gm)]
    expect(noDeduction.length, 'لم تُقرأ فقرةُ منعِ الحسم في البند 4').toBe(1)
    expect(section, 'الردُّ لم يُوصَل بفقرة منع الحسم فيقرأ نقضا لها')
      .toContain(`في تطبيق البند 4-${noDeduction[0][1]}`)
  })
})

describe('المسؤوليّةُ والتعويض — بندٌ قائمٌ بنفسه، متبادلٌ ومسقوف', () => {
  it('البندُ 19 تعويضٌ، والقانونُ الحاكمُ آخرُ البنود', () => {
    const body = renderContractBodyAr(base())
    const nums = clauseNumbers(body)
    expect(clauseSection(body, 19), 'البندُ 19 ليس بندَ المسؤوليّة').toMatch(/المسؤولية والتعويض/)
    expect(clauseSection(body, nums[nums.length - 1])).toMatch(/القانون الحاكم/)
  })

  it('ويجري في الاتّجاهين — فتعويضٌ في اتّجاهٍ واحدٍ يُخفَّض عند النزاع', () => {
    const section = clauseSection(renderContractBodyAr(base()), 19)
    expect(section, 'لا تعويضَ من المدرّب').toMatch(/يعوض المدرب الأكاديمية/)
    expect(section, 'لا تعويضَ من الأكاديميّة — فالبندُ أحاديّ').toMatch(/تعوض الأكاديمية المدرب/)
  })

  it('وسقفُه متبادلٌ وله استثناءاتُه — وإلّا حمى المخالفَ عمدا', () => {
    const section = clauseSection(renderContractBodyAr(base()), 19)
    expect(section, 'لا سقفَ للمسؤوليّة').toMatch(/لا يتجاوز مجموع ما يلتزم به أي من الطرفين/)
    for (const out of ['الغش', 'العمد', 'الضرر الجسدي']) {
      expect(section, `السقفُ يشمل «${out}» — وهو ما لا يُسقَّف`).toContain(out)
    }
  })

  it('والبندُ يبقى بعد الإنهاء — وإلّا انتهى بانتهاء العقد وهو أحوجُ ما يكون', () => {
    const body = renderContractBodyAr(base())
    const survive = clauseSection(body, 17).match(/^17-\d+ ويبقى نافذا بعد الإنهاء: ([^\n]+)/m)
    expect(survive, 'لم تُقرأ فقرةُ ما يبقى بعد الإنهاء').not.toBeNull()
    expect(survive![1], 'بندُ المسؤوليّة لا يبقى بعد الإنهاء').toMatch(/(^|\s)و?19(\s|،)/)
  })
})

describe('إحالةُ الاتفاقية — القيدُ كان علينا وحدَنا', () => {
  it('للأكاديميّة أن تحيل، ومعها ترخيصُ البند 10-3', () => {
    const body = renderContractBodyAr(base())
    const section = clauseSection(body, 18)
    expect(section, 'لا حقَّ للأكاديميّة في الإحالة').toMatch(/وللأكاديمية أن تحيل/)
    expect(section, 'الترخيصُ لا ينتقل مع الإحالة فيبقى مع كيانٍ لم يعد يشغّل المنصّة')
      .toMatch(/الترخيص المقرر في البند 10-3/)
  })

  it('ويبقى للمدرّب أساسُ أتعابه وحقُّه في الإنهاء — وإلّا صارت الإحالةُ تغييرا للعقد', () => {
    const section = clauseSection(renderContractBodyAr(base()), 18)
    expect(section).toMatch(/أساس أتعابه كما هي/)
    expect(section, 'الإحالةُ بلا مخرجٍ للمدرّب').toMatch(/وحقه في الإنهاء/)
  })
})

describe('إقرارُ الأهليّة — موصولٌ بجزائه لا معلَّقٌ وحدَه', () => {
  it('البندُ 15 يحمل إقرارَ الأهليّة وخلوِّ الذمّة من التزامٍ سابق', () => {
    const section = clauseSection(renderContractBodyAr(base()), 15)
    expect(section, 'لا إقرارَ أهليّة').toMatch(/كامل الأهلية/)
    expect(section, 'لا إقرارَ بخلوّ الذمّة من التزامٍ سابقٍ يمنعه').toMatch(/غير مرتبط بالتزام سابق/)
  })

  it('وهو من البيانات الجوهريّة — فيرث جزاءَ الفقرة التي تعاقب الكذبَ الجوهريّ', () => {
    const section = clauseSection(renderContractBodyAr(base()), 15)
    const penalty = [...section.matchAll(/^15-(\d+) وإذا ثبت أن بيانا جوهريا/gm)]
    expect(penalty.length, 'لم تُقرأ فقرةُ جزاء البيان الجوهريّ').toBe(1)
    expect(section, 'الإقرارُ بلا جزاء — فهو جملةٌ لا بند')
      .toContain(`من البيانات الجوهرية في تطبيق البند 15-${penalty[0][1]}`)
  })
})

describe('أجلُ الصرف — رقمٌ في المتن لا إحالةٌ إلى وثيقةٍ لا وجودَ لها', () => {
  it('لا إحالةَ إلى «دورة الصرف» — فالبحثُ عنها في المستودَع يردّ العقدَ وحدَه', () => {
    expect(renderContractBodyAr(base()), 'العقدُ يحيل إلى وثيقةٍ غيرِ منشورة')
      .not.toContain('دورة الصرف')
  })

  it('والمُهَلُ الثلاثُ مطبوعةٌ من ثوابتها — فلا يفترق المتنُ عن الشاشة', () => {
    const section = clauseSection(renderContractBodyAr(base()), 4)
    for (const d of [PAYOUT_APPROVAL_DAYS, PAYOUT_TRANSFER_DAYS, PAYOUT_OUTER_DAYS]) {
      expect(section, `المهلةُ ${d} غيرُ مطبوعةٍ في البند 4`).toContain(String(d))
    }
  })

  it('والسقفُ لا يقلّ عن مجموع ما قبله — وإلّا وُعد بما لا يُوفى', () => {
    expect(PAYOUT_OUTER_DAYS).toBeGreaterThanOrEqual(PAYOUT_APPROVAL_DAYS + PAYOUT_TRANSFER_DAYS)
  })

  it('ولا تسري المُهَلُ قبل أن يعطينا حسابَه — وإلّا وعدنا بصرفٍ لا سبيلَ إليه', () => {
    const body = renderContractBodyAr(base())
    const bank = [...clauseSection(body, 4).matchAll(/^4-(\d+) ويقدم المدرب بيانات حسابه البنكي/gm)]
    expect(bank.length, 'لم تُقرأ فقرةُ الحساب البنكيّ').toBe(1)
    expect(clauseSection(body, 4)).toContain(`بيانات حسابه البنكي وفق البند 4-${bank[0][1]}`)
  })
})

describe('الإنهاءُ الفوريُّ لما لا تُصلحه مهلة', () => {
  it('استثناءٌ صريحٌ من فقرتي المهلة والشعبة الجارية — لا فقرةٌ تُقرأ معهما فتتعارض', () => {
    const body = renderContractBodyAr(base())
    const section = clauseSection(body, 17)
    const cure = [...section.matchAll(/^17-(\d+) ولأي منهما إنهاؤها فورا عند إخلال جسيم/gm)]
    const ongoing = [...section.matchAll(/^17-(\d+) ولا يمس الإنهاء شعبة قبلها المدرب وبدأت/gm)]
    expect(cure.length, 'لم تُقرأ فقرةُ مهلة التصحيح').toBe(1)
    expect(ongoing.length, 'لم تُقرأ فقرةُ الشعبة الجارية').toBe(1)
    expect(section, 'الاستثناءُ لا يذكر الفقرتَين اللتين يستثني منهما')
      .toContain(`استثناء من البندين 17-${cure[0][1]} و17-${ongoing[0][1]}`)
  })

  it('ويغطّي ما يمسّ المتعلّمَ نفسَه — وهو سببُ وجوده', () => {
    const section = clauseSection(renderContractBodyAr(base()), 17)
    for (const kind of ['إيذاء لمتعلم', 'تحرش', 'إفشاء متعمد لبيانات المتعلمين']) {
      expect(section, `الإنهاءُ الفوريُّ لا يشمل «${kind}»`).toContain(kind)
    }
    expect(section, 'الشعبةُ الجاريةُ لا يُحَلّ فيها بديل').toMatch(/إحلال مدرب بديل في شعبة جارية/)
  })

  it('وتنتهي بالوفاة أو العجز — فلا يبقى عقدٌ ساريا بلا طرف', () => {
    const section = clauseSection(renderContractBodyAr(base()), 17)
    expect(section).toMatch(/بوفاة المدرب أو بعجزه الدائم/)
    expect(section, 'ما استحقّ عن عملٍ أُدّي ضاع بالوفاة').toMatch(/لمن يثبت حقه فيه/)
  })
})

describe('الإفصاحُ عن العائق — إخطارٌ لا إذنٌ يُطلَب', () => {
  it('البندُ 9 يوجب الإخطارَ فور العلم بما يحول دون التقديم', () => {
    const section = clauseSection(renderContractBodyAr(base()), 9)
    expect(section, 'لا واجبَ إفصاح').toMatch(/ويخطر المدرب الأكاديمية كتابة فور علمه/)
    expect(section).toMatch(/تعارض مصالح/)
  })

  it('ولا يمسّ حرّيّتَه في العمل لدى غيرها — وإلّا انقلب الإفصاحُ حصريّةً', () => {
    const section = clauseSection(renderContractBodyAr(base()), 9)
    expect(section, 'الإفصاحُ بلا تحفّظٍ يُقرأ قيدا على عمله الحرّ')
      .toMatch(/ولا يقيد هذا البند حريته في العمل لدى غير الأكاديمية/)
  })
})

describe('وما يُقرأ في «مستحقّاتي» من الأرقام نفسِها — فلا يُقال رقمٌ ويُحاسَب بغيره', () => {
  it('جملةُ الشاشة مبنيّةٌ من الثوابت الثلاثة لا مكتوبةٌ حرفا', () => {
    const note = payoutTimingNoteAr()
    for (const d of [PAYOUT_APPROVAL_DAYS, PAYOUT_TRANSFER_DAYS, PAYOUT_OUTER_DAYS]) {
      expect(note, `المهلةُ ${d} غائبةٌ عن جملة الشاشة`).toContain(String(d))
    }
  })

  it('وتحيل إلى الفقرة التي تحملها في العقد — وهي موجودةٌ فيه فعلا', () => {
    const body = renderContractBodyAr(base())
    const ref = payoutTimingNoteAr().match(/البند (\d+)-(\d+)/)
    expect(ref, 'جملةُ الشاشة لا تحيل إلى فقرةٍ في العقد').not.toBeNull()
    const section = clauseSection(body, Number(ref![1]))
    expect(section, `الفقرةُ ${ref![1]}-${ref![2]} لا وجودَ لها في العقد`)
      .toMatch(new RegExp(`^${ref![1]}-${ref![2]} `, 'm'))
    expect(section.match(new RegExp(`^${ref![1]}-${ref![2]} [^\n]+`, 'm'))![0],
      'الفقرةُ المُحال إليها لا تحمل مُهَلَ الصرف').toContain(String(PAYOUT_OUTER_DAYS))
  })
})

describe('واثنان أصغرُ أُلحقا — المصاريفُ والمحتوى', () => {
  it('المصاريفُ الإضافيّةُ لا تُقبل إلّا بموافقةٍ سابقةٍ مكتوبة', () => {
    const section = clauseSection(renderContractBodyAr(base()), 4)
    expect(section, 'لا قيدَ على المطالبة بمصاريف').toMatch(/ولا تقبل منه مطالبة بمصاريف إضافية/)
    expect(section, 'الموافقةُ لاحقةٌ أو شفويّة — فالقيدُ بلا أثر').toMatch(/كتابة قبل إنفاقه/)
  })

  it('وتحمُّلُه نفقتَه موصولٌ بفقرة العمل الحرّ — فهو قرينةُ استقلالٍ لا عبءٌ معلَّق', () => {
    const body = renderContractBodyAr(base())
    const free = [...clauseSection(body, 1).matchAll(/^1-(\d+) والمدرب حر في تنظيم وقته/gm)]
    expect(free.length, 'لم تُقرأ فقرةُ حرّيّة تنظيم الوقت والأدوات').toBe(1)
    expect(clauseSection(body, 4)).toContain(`وفق ما تقرر في البند 1-${free[0][1]}`)
  })

  /* وهذا الحارسُ هو سببُ وضع المصاريف قبل الفقرة المشروطة لا بعدها: فقرةُ
     بيان الساعات تُطبَع أو لا تُطبَع بحسب المُدخَل، ومن وضع الجديدَ بعدها
     أخرج ترقيما منقطعا في كلّ عقدٍ بلا بيانِ ساعات — ولا يراه من جرّب
     بمُدخَلٍ واحد. */
  it('وترقيمُ فقرات البند 4 متّصلٌ ببيان الساعات وبدونه', () => {
    for (const hoursNoteAr of [null, 'نحو 18 ساعة تدريب لكل شعبة']) {
      const body = renderContractBodyAr(base({ hoursNoteAr }))
      const subs = [...clauseSection(body, 4).matchAll(/^4-(\d+) /gm)].map((m) => Number(m[1]))
      expect(subs, `ترقيمُ فقرات البند 4 انقطع حين ${hoursNoteAr ? 'ورد' : 'غاب'} بيانُ الساعات`)
        .toEqual(subs.map((_, i) => i + 1))
    }
  })

  it('والمحتوى المخالفُ والمسيءُ ممنوعٌ — وهو ما لا يلتقطه بندُ حقوق الغير ولا بندُ معاملة المتعلّم', () => {
    const section = clauseSection(renderContractBodyAr(base()), 9)
    expect(section, 'لا قيدَ على المحتوى نفسِه').toMatch(/محتوى مخالفا للقانون/)
    expect(section, 'الإقحامُ خارج موضوع الدورة غيرُ ممنوع').toMatch(/فلا يقحم فيها ما خرج عنه/)
  })

  it('ويرث تدرُّجَ البند 9 — فلا يحتاج جزاءً جديدا، ولا يُفصَل عنه', () => {
    const section = clauseSection(renderContractBodyAr(base()), 9)
    expect(section, 'قيدُ المحتوى خارجَ البند الذي يحمل تدرُّجَ الجزاء')
      .toMatch(/^9-\d+ ولا يقدم المدرب في الجلسات/m)
    expect(section, 'البندُ 9 بلا تدرُّجِ جزاء — فالقيدُ بلا أثر')
      .toMatch(/^9-\d+ وإذا تكرر منه إخلال بين بهذا البند/m)
  })

  it('ولا يمنع معالجةَ ما يقتضيه موضوعُ الدورة — وإلّا صار البندُ رقابةً على المادّة', () => {
    const section = clauseSection(renderContractBodyAr(base()), 9)
    expect(section).toMatch(/ما يقتضيه موضوع الدورة نفسه معالجة مهنية/)
  })
})

/* ═══ والإقناعُ يبقى خارجَ الموقَّع ═══

   قرارُ صاحب المنصّة (٢٠ سبتمبر ٢٠٢٦): المثالُ الحسابيُّ يُرسَل مع رابط
   التوقيع ولا يُدرَج في الملحق. وعلّتُه أنّ البند 18-4 يجعل «الاتفاقيةَ
   وملاحقها» كاملَ ما اتّفق عليه الطرفان — فجدولٌ وُضع ليُقنع، إن دخل، صار
   بندا يُحتجّ به يومَ يخيب التسجيل. وهذا الحارسُ يمنع عودتَه سهوا. */
/* ═══ والمثالُ الحسابيُّ دخل الملحقَ (ب) — قرارُ ٢١ سبتمبر ٢٠٢٦ ═══

   كان هنا حارسٌ يمنع أن يظهر المثالُ في المتن الموقَّع أصلا، وعلّتُه أنّ
   البندَ 18-4 يجعل الملاحقَ من «كامل ما اتّفق عليه الطرفان» — فجدولٌ وُضع
   ليُقنع يصير بندا يُحتجّ به يومَ يخيب التسجيل.

   ونقض صاحبُ المنصّة الموضعَ: «المثال… يجب أن يكون داخل العقد كمثال هناك،
   وأوضح أنّه مثال فقط». فتغيّر ما يُحرَس لا مستوى الحراسة: العلّةُ لم تسقط،
   وإنّما انتقلت من **المنع** إلى **الاستثناء المكتوب**. والمقيسُ الآن أنّ
   الثلاثةَ التي تجعله يُقرأ مثالا موجودةٌ كلُّها — وسقوطُ أيٍّ منها يعيد
   المثالَ بندا بلا أن يظهر في النصّ شيءٌ غريب. */
describe('المثالُ الحسابيُّ في الملحق (ب) — ومقروءا مثالا لا بندا', () => {
  it('يظهر في الملحق (ب) لا في موضعٍ آخرَ من الوثيقة', () => {
    const body = renderContractBodyAr(base())
    const at = body.indexOf(FEE_EXAMPLE_HEADING_AR)
    expect(at, 'لا مثالَ في الوثيقة أصلا').toBeGreaterThan(-1)
    const annexB = annexAt(body, 'ب')
    const annexC = annexAt(body, 'ج')
    expect(at, 'المثالُ قبل الملحق (ب)').toBeGreaterThan(annexB)
    expect(at, 'المثالُ خرج من الملحق (ب) إلى ما بعده').toBeLessThan(annexC)
  })

  it('وأرقامُه هي أرقامُ المحرّك — لا حسابٌ ثانٍ يفترق عن الكشف', () => {
    const c = base().compensation!
    const ex = buildFeeExampleAr(c)!
    const body = renderContractBodyAr(base())
    for (const r of ex.rows) {
      expect(body, `صفٌّ بقيمة ${r.amount} غائبٌ عن المثال في العقد`).toContain(String(r.amount))
    }
    /* وذيلُ المثال تبدّل (٢٤ سبتمبر): كان مجموعَ الصفوف، وهي في أجر
       المقعد حالاتٌ متنافيةٌ لدورةٍ واحدة — فجمعُها يعدُ بما لا يقع. وصار
       توقّعَ موسمٍ بالحالة الوسطى. والمحروسُ واحدٌ لم يتغيّر: الرقمُ
       المطبوعُ حسابُ المحرّك لا حسابٌ ثانٍ يفترق عنه. */
    const middle = ex.rows[Math.floor(ex.rows.length / 2)]!
    expect(body, 'توقّعُ الموسم غائبٌ أو مخالفٌ للمحرّك')
      .toContain(`وعلى فرض ${SEASON_COURSES} دورات في الموسم بالحالة الوسطى: ${middle.amount * SEASON_COURSES}`)
    /* ولا يعود جمعُ المتنافيات إلى أجر المقعد */
    expect(body, 'عاد جمعُ حالاتٍ متنافيةٍ إلى المثال').not.toContain(`مجموع هذا المثال: ${ex.total}`)
  })

  it('وثلاثةٌ تجعله يُقرأ مثالا: صدرُه، وإحالةُ 4-1، واستثناءُ 18-4', () => {
    const body = renderContractBodyAr(base())
    /* ① صدرُ المثال نفسِه */
    expect(body, 'صدرُ المثال لا يقول إنّه استرشاديّ').toContain(FEE_EXAMPLE_HEADING_AR)
    expect(body, 'المثالُ لا يقول إنّ الأعدادَ مفترضة').toMatch(/مفترضة للإيضاح/)
    /* ② إحالةٌ من البند 4 — يقرؤها قبل أن يبلغ الملحق.

       والمقيسُ وجودُها لا لفظُها: كان يُطابَق «الملحق (ب) مثال حسابي»
       بحروفه، فسقط يومَ صار 4-1 مُحيلا على الملحق (v7) فلم يَعُد يسمّيه
       مرّتين في نفَسٍ واحد. والمحروسُ أنّ البندَ يذكر أنّ ثَمّ مثالا
       وأين هو — لا الصياغةُ التي يُذكَران بها. */
    const clause4 = clauseSection(body, 4)
    expect(clause4, 'البندُ 4 لا يذكر أنّ ثَمّ مثالا حسابيّا').toMatch(/مثال حسابي/)
    expect(clause4, 'البندُ 4 لا يدلّ على موضع المثال').toMatch(/الملحق \(ب\)/)
    /* ③ واستثناءٌ بحروفه في 18-4 — وهو البندُ الذي كان يجعله بندا */
    expect(clauseSection(body, 18), 'البندُ 18 لا يستثني المثال').toMatch(/يستثنى من ذلك المثال الحسابي/)
  })

  it('وحيث لا مثالَ لا تبقى إحالةٌ إليه — فإحالةٌ إلى غائبٍ أسوأُ من غيابهما', () => {
    /* نسبةُ الإيراد لا يُبنى لها مثال: رقمُها دالّةٌ في سعرٍ نملكه نحن */
    const share = renderContractBodyAr(base({
      compensation: { type: 'revenue_share', rate: '40', currency: 'USD', minSeats: null, referralRate: null },
    }))
    expect(buildFeeExampleAr({ type: 'revenue_share', rate: '40', currency: 'USD', minSeats: null, referralRate: null })).toBeNull()
    expect(share, 'مثالٌ حيث لا يصحّ').not.toContain(FEE_EXAMPLE_HEADING_AR)
    expect(clauseSection(share, 4), 'إحالةٌ إلى مثالٍ لا وجودَ له').not.toMatch(/مثال حسابي/)

    const noRule = renderContractBodyAr(base({ compensation: null }))
    expect(noRule, 'مثالٌ بلا قاعدةِ أتعاب').not.toContain(FEE_EXAMPLE_HEADING_AR)
    expect(clauseSection(noRule, 4), 'إحالةٌ إلى مثالٍ لا وجودَ له').not.toMatch(/مثال حسابي/)
  })
})

/* ═══ الإقرارُ السادس — خصمُه هو، لا خصمُنا (٢٢ سبتمبر ٢٠٢٦) ═══

   البند 4-10 هو الالتزامُ المالـيُّ الوحيدُ في العقد الذي ينشأ **بفعلٍ يفعله
   المدرّبُ بعد التوقيع**: نقرةٌ يختارها فيخرج بها مالٌ من كشفه بعد شهر. ومن
   رأى سطرا سالبا في كشفه عن رجلٍ أعطاه رمزا قبل شهرين يسأل «ومتى قبلتُ هذا؟»
   — فالمقيسُ أنّ الجوابَ موجودٌ في صفحة التوقيع.

   ولا يُقاس ورودُ الجملة حرفا: تُعاد صياغتُها. والمقيسُ خصائصُها — أنّها
   تحيل إلى البندين معا، وأنّ شطرَها الثاني قائم. */
describe('إقراراتُ التوقيع تغطّي ما يُنازَع فيه — ومنه خصمُ المدرّب', () => {
  const ack = (key: string) => CONTRACT_ACKS.find((a) => a.key === key)

  it('لكلّ إقرارٍ مفتاحٌ فريدٌ ونصٌّ يُقرأ — ولا مفتاحَ بلا جملة', () => {
    expect(CONTRACT_ACKS.length, 'الإقراراتُ نقصت عمّا كانت').toBeGreaterThanOrEqual(6)
    const keys = CONTRACT_ACKS.map((a) => a.key)
    expect(new Set(keys).size, 'مفتاحٌ مكرَّر — فيسقط أحدُهما من التحقّق').toBe(keys.length)
    for (const a of CONTRACT_ACKS) {
      expect(a.textAr.length, `الإقرار «${a.key}» بلا نصٍّ يُقرأ`).toBeGreaterThan(40)
    }
  })

  it('وفيها إقرارٌ بخصمه هو — يحيل إلى 4-10 ويقول إنّه يتحمّله وحدَه', () => {
    const a = ack('issued_discount')
    expect(a, 'لا إقرارَ بالخصم الذي يصدره المدرّبُ بنفسه').toBeTruthy()
    expect(a!.textAr, 'الإقرارُ لا يحيل إلى البند 4-10').toContain('4-10')
    expect(a!.textAr, 'لا يقول إنّه يتحمّله هو').toMatch(/أتحمله أنا وحدي|أتحمله وحدي/)
  })

  /* وشطرُه الثاني ليس زينة: بلا ذكرِ 4-9 تُقرأ الجملةُ «الخصومُ كلُّها عليّ»،
     فيمتنع عن إصدار خصمه ظانّا أنّ حملاتِنا تُحسم منه أيضا. */
  it('ويقول في المقابل إنّ خصومَ الأكاديميّة لا تمسّه (4-9) — في الجملة نفسِها', () => {
    const a = ack('issued_discount')!
    expect(a.textAr, 'الإقرارُ لا يستثني خصومَ الأكاديميّة — فيُقرأ «الكلُّ عليّ»').toContain('4-9')
  })

  it('وكلُّ بندٍ يحيل إليه إقرارٌ موجودٌ في المتن فعلا', () => {
    const body = renderContractBodyAr(base())
    const clauses = new Map(clauseNumbers(body).map((n) => [n, subItems(body, n)]))
    for (const a of CONTRACT_ACKS) {
      for (const m of a.textAr.matchAll(/البند(?:ين)? (\d+)-(\d+)/g)) {
        const [clause, sub] = [Number(m[1]), Number(m[2])]
        expect(clauses.has(clause), `إقرارٌ يحيل إلى «البند ${clause}» ولا وجودَ له`).toBe(true)
        expect(
          clauses.get(clause)!.includes(sub),
          `إقرارٌ يحيل إلى «البند ${clause}-${sub}» ولا وجودَ لهذه الفقرة`,
        ).toBe(true)
      }
    }
  })

  /* وإصدارُ الإقرارات يتحرّك بتحرّكها: من وقّع `v1` أقرّ بخمسٍ لا سادسَ لها،
     ولا يُعرف ذلك إن بقي الرمزُ كما كان. */
  it('وإصدارُ الإقرارات ليس `v1` بعد أن دخلت السادسة', () => {
    expect(CONTRACT_CONSENT_VERSION, 'أُضيف إقرارٌ ولم يتحرّك إصدارُه').not.toMatch(/^v1-/)
  })
})

/* ═══ العرضُ المشروط — ما يفترق فيه المتنُ، وما لا يجوز أن يفترق ═══ */
describe('العرضُ المشروط', () => {
  const offer = (over: Partial<NonNullable<ContractBodyInput['conditional']>> = {}) =>
    renderContractBodyAr(base({ conditional: { ...CONDITIONAL, ...over } }))
  const plain = () => renderContractBodyAr(base())

  it('عنوانُه يقول إنّه عرضٌ مشروطٌ لا اتفاقيّة', () => {
    expect(offer().split('\n')[0]).toContain('عرض مشروط')
    expect(plain().split('\n')[0], 'بندٌ يُوثَّق على مدرّبٍ نشطٍ صار عرضا مشروطا').not.toContain('عرض مشروط')
  })

  it('وبندُ الشرط ستُّ فقراتٍ في البند 2 — ولا واحدةَ منها في المطلق', () => {
    const body = offer()
    for (const n of ['2-6', '2-7', '2-8', '2-9', '2-10', '2-11']) {
      expect(body, `فقرةٌ ناقصةٌ من بند الشرط: ${n}`).toContain(`\n${n} `)
    }
    const p = plain()
    for (const n of ['2-6', '2-7', '2-8', '2-9', '2-10', '2-11']) {
      expect(p, `شرطٌ في عقدٍ لا شرطَ فيه: ${n}`).not.toContain(`\n${n} `)
    }
  })

  /* ═══ الحارسُ الذي يمنع كارثةَ إعادة الترقيم ═══

     ثلاثةُ إقراراتٍ تُحيل على أرقام بنودٍ (4-10 و4-9 و15)، وبنودٌ تُحيل على
     18-4. فلو أُضيف بندُ الشرط **بندا جديدا** في وسط المستند لَانزاحت
     الأرقامُ كلُّها وصارت الإحالاتُ إلى غير موضعها. */
  it('ولا يُعاد ترقيمُ بندٍ واحد — الأرقامُ في المشروط هي هي', () => {
    expect(clauseNumbers(offer())).toEqual(clauseNumbers(plain()))
  })

  it('وملحقُه (أ) يقول إنّ موادَّ كلِّ دورةٍ قيد التقييم', () => {
    const body = offer()
    const at = body.indexOf('الملحق (أ)')
    expect(at, 'لا ملحقَ (أ)').toBeGreaterThan(0)
    const tail = body.slice(at)
    expect(tail).toMatch(/قيد التقييم/)
    expect(tail, 'لم يُقل إنّه لا يُدرَّس قبل الاعتماد').toMatch(/لا يقدم المدرب منها شيئا/)
    expect(plain().slice(plain().indexOf('الملحق (أ)')), 'تقييمٌ في عقدٍ لا شرطَ فيه').not.toMatch(/قيد التقييم/)
  })

  it('وموعدُ الجلسة ومهلتُها مطبوعان حين يُعرفان', () => {
    const body = offer()
    expect(body).toContain(CONDITIONAL.orientationOnAr!)
    expect(body).toContain(CONDITIONAL.deadlineOnAr!)
    expect(body, 'المهلةُ لم تُذكر بعددها').toMatch(/مهلة 7 أيام/)
  })

  /* ومن أُرسل إليه عرضٌ ولمّا يُعرَف موعدُ جلسته: لا يُخترَع له تاريخٌ ولا
     يُقال «أمامك سبعةٌ» بلا مبدإٍ — بل يُقال إنّ المهلةَ لا تبدأ قبل إخطاره. */
  it('ومن لا موعدَ لجلسته يقول متنُه إنّ المهلةَ لا تبدأ قبل إخطاره', () => {
    const body = offer({ orientationOnAr: null, deadlineOnAr: null })
    expect(body).toMatch(/ولا تبدأ المهلة قبل إخطاره به/)
    expect(body, 'تاريخٌ اختُرع لجلسةٍ لم يُعرَف موعدُها').not.toContain(CONDITIONAL.orientationOnAr!)
    expect(body, 'مهلةٌ انتهت إلى تاريخٍ لا مبدأَ له').not.toMatch(/وتنتهي هذه المهلة بتاريخ/)
  })

  it('وديباجتُه تقول إنّ نفاذَه معلَّقٌ على الشرط', () => {
    expect(offer()).toMatch(/نفاذه معلق على تحقق الشرط/)
    expect(plain()).not.toMatch(/نفاذه معلق/)
  })

  /* والفقرةُ الخامسةُ (2-9) هي ما يشتري الحمايةَ: بلا «لا إخلال» يبقى عدمُ
     قبول الموادّ سببَ فسخٍ لا شرطا لم يتحقّق. */
  it('و«لا إخلالَ من أحد» منصوصةٌ — وهي مِلاكُ الحماية', () => {
    const body = offer()
    expect(body).toMatch(/فلا يعد ذلك إخلالا من أي من الطرفين/)
    expect(body, 'لم يُعرَض عليه المخرجان').toMatch(/تأجيل عرضه إلى الموسم التدريبي القادم/)
    expect(body).toMatch(/حذف حسابه/)
  })

  it('ويقول إنّ توقيعَنا في آخر الطور يجعله نهائيّا', () => {
    expect(offer()).toMatch(/وتوقع الأكاديمية هذا العرض من جهتها يوم يتحقق الشرط/)
  })

  it('والمثالُ الحسابيُّ في متنه — وهو موضعُه وحدَه', () => {
    expect(offer(), 'المثالُ غاب عن المتن وقد حُذف من البريد، فلا يقرؤه أحد')
      .toContain(FEE_EXAMPLE_HEADING_AR)
  })
})

describe('إقراراتُ التوقيع', () => {
  it('سبعةٌ للمشروط وستٌّ لغيره', () => {
    expect(contractAcks(true).length).toBe(CONTRACT_ACKS.length + 1)
    expect(contractAcks(false).length).toBe(CONTRACT_ACKS.length)
    expect(contractAcks(true).map((a) => a.key)).toContain('offer_is_conditional')
    expect(contractAcks(false).map((a) => a.key), 'إقرارٌ بشرطٍ في عقدٍ لا شرطَ فيه')
      .not.toContain('offer_is_conditional')
  })

  it('والسابعُ يقرّ بالشرط ويُحيل على بنوده', () => {
    const ack = contractAcks(true).find((a) => a.key === 'offer_is_conditional')!
    expect(ack.textAr).toMatch(/عرض مشروط لا عقد نهائي/)
    expect(ack.textAr, 'لم يُحِل على بنود الشرط').toMatch(/2-6 إلى 2-11/)
    expect(ack.textAr, 'لم يُقرّ بأنّ الاعتمادَ لكلّ دورةٍ على حدة').toMatch(/لكل دورة على حدة/)
  })

  it('وإصدارُ الإقرارات ارتفع مع السابع', () => {
    expect(CONTRACT_CONSENT_VERSION).toMatch(/^v3-/)
  })

  /* والإصدارُ يُقرأ رقما لا مطابقةَ حرف: كان مثبَّتا على «v4» بعينه، فكان
     يحمرّ عند كلّ رفعٍ مشروعٍ للإصدار ويطلب تعديلَ نفسِه — وحارسٌ يُعدَّل في
     كلّ مرّةٍ يُعطَّل بعد ثالثة. والمقيسُ ما كان يعنيه: بندُ الشرط دخل في
     الجيل الرابع، فما حمل الشرطَ لا ينزل إصدارُه عنه. */
  it('وإصدارُ المتن لا ينزل عن الجيل الذي دخل فيه بندُ الشرط', () => {
    const shape = /^v(\d+)-\d{4}-\d{2}-\d{2}$/.exec(CONTRACT_BODY_VERSION)
    expect(shape, 'إصدارُ المتن على غير صيغة vN-YYYY-MM-DD').toBeTruthy()
    expect(Number(shape![1]), 'نزل إصدارُ المتن عن الجيل الذي حمل بندَ الشرط')
      .toBeGreaterThanOrEqual(4)
  })
})

/* ═══ الدرزُ بين القديم والجديد — عرضٌ بلا شرطٍ في متنه ═══

   عرضٌ رُكِّب قبل بند الشرط يحمل `gatesActivation = true` ولا شرطا في متنه،
   فبريدُه يحدّث المتقدّمَ عن جلسةٍ ومهلةٍ لا تحملهما الوثيقةُ التي يوقّعها. */
describe('بندُ الشرط يُفحَص في المتن قبل الإرسال', () => {
  it('متنُ العرض المشروط يحمل العلامةَ، ومتنُ المطلق لا يحملها', () => {
    expect(bodyCarriesConditionClause(renderContractBodyAr(base({ conditional: CONDITIONAL })))).toBe(true)
    expect(bodyCarriesConditionClause(renderContractBodyAr(base()))).toBe(false)
  })

  it('والمتنُ الفارغُ والمعدومُ لا يحملانها', () => {
    expect(bodyCarriesConditionClause(null)).toBe(false)
    expect(bodyCarriesConditionClause(undefined)).toBe(false)
    expect(bodyCarriesConditionClause('')).toBe(false)
  })

  /* ═══ والعلامةُ تُعوَّض في المتن ولا تُكتب فيه بيدها ═══

     فما دامت مُعوَّضةً استحال أن تفترق عن المفحوص: صياغةٌ واحدةٌ تُطبَع
     وتُفحَص. والخطرُ الحقيقيُّ أن يعود أحدٌ فيكتب الجملةَ حرفا في المتن —
     يومَها يُفحَص عن جملةٍ لا وجودَ لها ويمرّ كلُّ عرض، وهو حارسٌ يقول
     «سليم» عن كلّ شيء.

     فيُقاس المصدرُ نفسُه: صدرُ الفقرة تعويضٌ لا نصّ. ولا يُقاس المتنُ
     المطبوع — ذاك يمرّ دائما بحكم التعويض، فلا يقيس شيئا. */
  it('وصدرُ الفقرة تعويضٌ في المصدر لا جملةٌ مكتوبةٌ بيدها', () => {
    const source = readFileSync(join(process.cwd(), 'src/application/trainer/contract-body.ts'), 'utf8')
    expect(source, 'صدرُ بند الشرط كُتب حرفا — فانفصل الفحصُ عن الطباعة')
      .toContain('\n${CONDITION_CLAUSE_MARK} لا عقد نهائي')
    expect(source, 'الجملةُ مكتوبةٌ حرفا في المتن إلى جانب الثابت')
      .not.toContain('\n2-6 وهذا عرض مشروط لا عقد نهائي')
  })
})

/* ═══ «الخلاصة في سطور» — §٨-٢، والقرارُ الخامسُ في §١٥ ═══

   ── ولمَ تُحرَس وحدةُ مصدرها لا حسنُ صياغتها ──

   الخطرُ فيها واحدٌ بعينه: أن تفترق عن البنود. فخلاصةٌ تقول أتعابا غيرَ التي
   في 4-1، أو مُدَدَ صرفٍ غيرَ التي في 4-2، تُقرأ ويُحتجّ بها **وقد كذبت** —
   وهي حينها أسوأُ من غيابها، إذ صارت الوثيقةُ تقول رقمَين لشيءٍ واحد.

   فالمقيسُ هنا أنّ ما تطبعه الخلاصةُ **هو ما يطبعه البندُ نفسُه**، لا أنّه
   يشبهه. وموضعُها مقيسٌ كذلك: خلاصةٌ تحت عشرين بندا لا تُقرأ، فلا معنى لها. */
describe('الخلاصةُ في سطور', () => {
  const offer = (over: Partial<NonNullable<ContractBodyInput['conditional']>> = {}) =>
    renderContractBodyAr(base({ conditional: { ...CONDITIONAL, ...over } }))

  /** نصُّ الخلاصة وحدَه — بحدود المحلّل لا بقصٍّ بين عنوانين.

      كان يُقَصُّ من «الخلاصة في سطور» إلى «الديباجة». فلمّا دخل قسمُ
      «ما تعنيه الكلمات» بينهما (v8) ابتلعه القصُّ، فقرأ الحارسُ **نفيَ
      إلزام التعريفات** حاسبا إيّاه نفيَ إلزام الخلاصة — وسقط لسببٍ صحيح
      على شيفرةٍ سليمة.

      فالحدُّ من `parseContractDoc` نفسِه: هو الذي يرسم الأقسامَ للوثيقة،
      فلا يفترق الحارسُ عنه يومَ يدخل قسمٌ ثالث. */
  function summaryOf(body: string): string {
    const doc = parseContractDoc(body)
    const summary = doc.sections.find((x) => x.kind === 'summary')
    expect(summary, 'لا خلاصةَ في المتن').toBeTruthy()
    /* وموضعُها في الرأس: قبل الديباجة وقبل أوّل بند — خلاصةٌ تحت عشرين
       بندا لا تُقرأ، فلا معنى لها. */
    const at = doc.sections.indexOf(summary!)
    const preamble = doc.sections.findIndex((x) => x.titleAr === 'الديباجة')
    expect(preamble, 'لا ديباجةَ في المتن').toBeGreaterThan(-1)
    expect(at, 'الخلاصةُ بعد الديباجة — وهي إنّما تُقرأ في الرأس').toBeLessThan(preamble)
    return [summary!.titleAr, ...summary!.blocks.map(blockLineAr)].join('\n')
  }

  /** سطرٌ من الخلاصة يبدأ بعنوانه — ونصُّه بلا العنوان */
  function line(body: string, headAr: string): string {
    const found = summaryOf(body).split('\n').find((l) => l.startsWith(`· ${headAr}`))
    expect(found, `لا سطرَ «${headAr}» في الخلاصة`).toBeTruthy()
    return found!.slice(`· ${headAr}`.length).trim()
  }

  it('١) في الرأس قبل البند الأوّل — لا في آخر الوثيقة', () => {
    const body = renderContractBodyAr(base())
    const at = body.indexOf('الخلاصة في سطور')
    const first = /^البند 1 —/m.exec(body)!.index
    expect(at, 'الخلاصةُ بعد البند الأوّل').toBeLessThan(first)
    expect(body.indexOf(CONTRACT_BODY_VERSION), 'الخلاصةُ قبل ترويسة المرجع والإصدار')
      .toBeLessThan(at)
  })

  it('٢) ولا تكسر ترقيمَ البنود ولا عناوينَ الملاحق', () => {
    /* وهو خطرٌ حقيقيّ لا نظريّ: سطرٌ في الخلاصة يبدأ بـ«البند 4 —» يُحسَب
       عنوانَ بندٍ رابعٍ ثانٍ، فينكسر الترقيمُ المتّصلُ الذي تقوم عليه
       الإحالاتُ كلُّها. فإحالاتُها بين قوسَين في وسط السطر لا في رأسه. */
    for (const body of [renderContractBodyAr(base()), offer()]) {
      expect(clauseNumbers(body), 'ترقيمُ البنود انكسر بدخول الخلاصة')
        .toEqual([...Array(20)].map((_, i) => i + 1))
      for (const letter of ['أ', 'ب']) expect(annexAt(body, letter)).toBeGreaterThan(0)
    }
  })

  it('٣) وسطرُ الأتعاب فيها هو نصُّ المصدر نفسُه — لا صياغةٌ ثانية', () => {
    /* أقوى ما يُقاس في هذا الباب: لا يُطابَق معنى بمعنى بل **نصٌّ بنصّ**.
       فلو صِيغت الأتعابُ في الخلاصة صياغةً ثانيةً — ولو صحيحةً اليومَ —
       سقط هذا الحارس، وهو مقصودُه: المصدرُ واحدٌ أو لا خلاصة.

       وكان يُقابَل بالبند 4-1، فذاك موضعُ النصّ. وقد صارت القاعدةُ صفوفا
       في الملحق (ب) و4-1 مُحيلا عليها (v7)، فلم يبقَ في المتن نصٌّ نثريٌّ
       يُطابَق به. فالمقابلةُ على `feeBasisAr` — المصدرِ الذي كان 4-1 يطبعه
       — فيبقى المحروسُ هو هو: صياغةٌ واحدةٌ لا ثانيةَ لها. */
    const c = base().compensation!
    const body = renderContractBodyAr(base())
    const feeLine = line(body, 'والأتعاب:').replace(/\s*\(الملحق ب\)$/, '')
    expect(feeLine.length, 'سطرُ الأتعاب في الخلاصة فارغ').toBeGreaterThan(20)
    expect(feeLine, 'أتعابُ الخلاصة صياغةٌ ثانيةٌ لا نصُّ المصدر')
      .toBe(feeBasisAr(c))
  })

  /* ═══ والصياغتان لا تفترقان في رقم ═══

     بعد `v7` تُكتب القاعدةُ مرّتين بلفظين: صفوفا مُلزِمةً في الملحق (ب)،
     ونثرا في الخلاصة. وكلتاهما من `compensation` فاستحال الافتراقُ بالبناء
     — وهذا يُثبته بدل أن يَعِد به: كلُّ مبلغٍ في الصفوف مذكورٌ في النثر،
     وكلُّ مبلغٍ في النثر مذكورٌ في الصفوف.

     ولو افترقا لَقالت الوثيقةُ رقمَين لشيءٍ واحدٍ يقبضه إنسان. */
  it('٣ب) وصفوفُ الملحق (ب) والنثرُ لا يفترقان في مبلغ', () => {
    const c = base().compensation!
    const body = renderContractBodyAr(base())
    const rows = parseContractDoc(body).sections
      .find((s) => s.kind === 'annex' && s.titleAr === 'أساس الأتعاب')!
      .blocks.map(feeRuleCells).filter(Boolean)
    expect(rows.length, 'لا صفوفَ قاعدةٍ في الملحق (ب)').toBeGreaterThan(0)

    const prose = feeBasisAr(c)
    const nums = (t: string) => [...t.matchAll(/\d+/g)].map((m) => m[0])
    for (const r of rows) {
      for (const n of nums(r!.amountAr)) {
        expect(prose, `مبلغٌ في الصفوف لا يقابله في النثر: ${r!.amountAr}`).toContain(n)
      }
    }
    const inRows = rows.map((r) => r!.amountAr).join(' ')
    for (const n of nums(prose)) {
      expect(inRows, `مبلغٌ في النثر لا يقابله في الصفوف: ${n}`).toContain(n)
    }
  })

  it('٤) ومُدَدُ الصرف فيها هي ثوابتُ البند 4-2 نفسُها', () => {
    const payout = line(renderContractBodyAr(base()), 'وصرفها:')
    for (const d of [PAYOUT_APPROVAL_DAYS, PAYOUT_TRANSFER_DAYS, PAYOUT_OUTER_DAYS]) {
      expect(payout, `مدّةٌ في الخلاصة لا تطابق ثابتَها: ${d}`).toContain(String(d))
    }
  })

  it('٥) والمشروطُ تُعلن خلاصتُه مهلتَه وتاريخَ انتهائها', () => {
    const mudda = line(offer(), 'والمهلة:')
    expect(mudda).toContain(String(CONDITIONAL.windowDays))
    expect(mudda, 'لا تاريخَ لجلسة التهيئة').toContain(CONDITIONAL.orientationOnAr!)
    expect(mudda, 'لا تاريخَ لانتهاء المهلة').toContain(CONDITIONAL.deadlineOnAr!)
  })

  /* ═══ وهذا أهمُّ ما يُقاس فيها ═══

     عرضٌ يُرسَل ولمّا يُعرَف موعدُ جلسته **لا مهلةَ له أصلا** — القرارُ
     الرابعُ في §١٥، وضمانُ الترحيل نفسُه. فخلاصةٌ تُعلن له تاريخا تُنشئ
     التزاما نفاه البندُ 2-8 بنصّه، وهي أوّلُ ما يقرأ. */
  it('٦) ومن لا تاريخَ لجلسته لا تُعلن له خلاصتُه تاريخا', () => {
    const mudda = line(offer({ orientationOnAr: null, deadlineOnAr: null }), 'والمهلة:')
    /* والمقيسُ **ألّا يُعلَن انتهاءٌ أصلا** لا أن يخلو السطرُ من تاريخٍ
       بعينه: ذاك لا يُنقَض بحال — فالتاريخُ غيرُ ممرَّرٍ أصلا فلا سبيلَ إلى
       طبعه، وحارسٌ لا يُنقَض زينة. أمّا «وتنتهي» فتُطبَع بنقضٍ واحد. */
    expect(mudda, 'أُعلن انتهاءُ مهلةٍ لمن لا تاريخَ لجلسته').not.toMatch(/وتنتهي/)
    expect(mudda, 'لم تُحَل إلى إخطارٍ لاحقٍ بالتاريخ').toMatch(/تخطرك/)
  })

  it('٧) والاتفاقيّةُ المطلقةُ لا خلاصةَ شرطٍ فيها ولا مهلة', () => {
    const summary = summaryOf(renderContractBodyAr(base()))
    expect(summary, 'خلاصةُ عقدٍ مطلقٍ تتحدّث عن مهلة').not.toMatch(/والمهلة:/)
    expect(summary, 'خلاصةُ عقدٍ مطلقٍ تقول إنّه عرضٌ مشروط').not.toMatch(/عرض مشروط/)
  })

  it('٨) وتحتها سطرٌ ينفي عنها الإلزام — وهو آخرُها', () => {
    for (const body of [renderContractBodyAr(base()), offer()]) {
      const summary = summaryOf(body)
      const lines = summary.trim().split('\n')
      const last = lines[lines.length - 1]
      expect(last, 'آخرُ الخلاصة ليس سطرَ نفي الإلزام').toMatch(/ليست بندا/)
      expect(last, 'لا يقول أين المُلزِم').toMatch(/البنود والملاحق/)
      /* وموضعُه تحتها لا فوقها: بنودُها تُقرأ أوّلا ثمّ يُقال ما حكمُها */
      expect(summary.indexOf('· الصفة:'), 'سطرُ النفي فوق الخلاصة لا تحتها')
        .toBeLessThan(summary.indexOf(last))
    }
  })

  it('٩) ولا قيمةَ برمجيّةٍ تسرّبت إليها في أيٍّ من أشكالها الثلاثة', () => {
    /* والأشكالُ ثلاثةٌ لأنّ سطرَ المهلة فيه تعويضان متداخلان: تاريخُ الجلسة
       وتاريخُ الانتهاء، وكلٌّ منهما يقبل الفراغ. */
    for (const body of [
      renderContractBodyAr(base()),
      offer(),
      offer({ orientationOnAr: null, deadlineOnAr: null }),
    ]) {
      const summary = summaryOf(body)
      for (const leak of ['undefined', 'null', 'NaN', '[object', '{{']) {
        expect(summary, `أثرُ قيمةٍ برمجيّةٍ في خلاصةٍ تُقرأ: ${leak}`).not.toContain(leak)
      }
    }
  })
})

/* ═══ ما تعنيه الكلمات — قرارُ ٢٥ سبتمبر ٢٠٢٦ ═══

   ── العطبُ الذي يحرسه ──

   «شعبة» ترد إحدى وستّين مرّةً في المتن، و«إسناد» ستّا وعشرين، و«تأهيل»
   إحدى عشرة — ولم يكن لواحدةٍ منها تعريف. ومن لا يفرّق بين التأهيل
   والإسناد **لا يعرف ما وقّع عليه**: أحدُهما إذنٌ لا يرتّب شيئا، والآخرُ
   هو الذي تنشأ به الأتعاب. */
describe('قسمُ التعريفات يُقرأ قبل أن تَرِد الكلمات', () => {
  const doc = () => parseContractDoc(renderContractBodyAr(base()))
  const gloss = () => doc().sections.find((s) => s.titleAr === 'ما تعنيه الكلمات في هذا العقد')

  it('قسمٌ قائمٌ بذاته لا سطورٌ تنضمّ إلى الخلاصة', () => {
    expect(gloss(), 'لا قسمَ تعريفات — أو انضمّ إلى ما قبله').toBeTruthy()
  })

  /* وموضعُه: بعد الخلاصة وقبل الديباجة. فتعريفٌ بعد عشرين بندا استُعملت
     فيه الكلمةُ يأتي بعد أن احتار القارئ. */
  it('وموضعُه بين الخلاصة والديباجة', () => {
    const ss = doc().sections
    const g = ss.findIndex((s) => s.titleAr === 'ما تعنيه الكلمات في هذا العقد')
    const sum = ss.findIndex((s) => s.kind === 'summary')
    const pre = ss.findIndex((s) => s.titleAr === 'الديباجة')
    expect(g, 'التعريفاتُ قبل الخلاصة').toBeGreaterThan(sum)
    expect(g, 'التعريفاتُ بعد الديباجة').toBeLessThan(pre)
  })

  /* والكلماتُ التي سأل عنها صاحبُ المنصّة بأعيانها، وكلُّها **مستعمَلةٌ
     في المتن فعلا** — فتعريفُ ما لا يَرِد حشوٌ، وتركُ ما يَرِد هو العطب. */
  it('ويعرّف ما سُئل عنه، ولا يعرّف ما لا يَرِد', () => {
    /* والمفتاحُ ما قبل النقطتين، ويُجرَّد من المقابل الإنجليزيّ بين قوسين:
       «رابط الدعوة (referral link)» لا تَرِد في المتن بهذا التمام، وإنّما
       يَرِد المصطلحُ وحدَه. */
    /* والتعريفاتُ نقاطٌ وحدَها: ذيلُ القسم فقرةٌ تنفي الإلزام، ليست تعريفا */
    const keys = gloss()!.blocks
      .filter((b) => b.kind === 'bullet')
      .map((b) => ('textAr' in b ? b.textAr.split(':')[0].replace(/\s*\([^)]*\)\s*$/, '').trim() : ''))
    expect(keys.length, 'لا تعريفاتٍ في القسم').toBeGreaterThanOrEqual(6)
    for (const k of ['الشعبة', 'التأهيل', 'الإسناد', 'كشف المستحقات']) {
      expect(keys, `لا تعريفَ لـ«${k}»`).toContain(k)
    }
    /* والمقيسُ صدرُ المصطلح مجرَّدا من «ال»: العربيّةُ تعرّف وتنكّر، فالمتنُ
       يقول «كشف مستحقات» والتعريفُ «كشف المستحقات» — وهما واحد. ومطابقةٌ
       حرفيّةٌ تردّ ما هو وارد. */
    const bare2 = (t: string) => t.replace(/\bال/g, '')
    const body = bare2(renderContractBodyAr(base()))
    for (const k of keys.filter(Boolean)) {
      const head = bare2(k.split(/\s+/)[0])
      expect(body.split(head).length - 1, `عُرّفت كلمةٌ لا تَرِد في المتن: ${k}`).toBeGreaterThan(1)
    }
  })

  /* ولا إلزامَ فيه: بيانٌ يشرح ليس بندا، وإلّا احتُجّ بلفظِ شرحٍ على بند */
  it('وينفي عن نفسه الإلزام ويقول أين المُلزِم', () => {
    const last = gloss()!.blocks.slice(-1)[0]
    const t = 'textAr' in last ? last.textAr : ''
    expect(t, 'التعريفاتُ لا تنفي عن نفسها الإلزام').toMatch(/ليس بندا/)
    expect(t, 'لا تقول أين المُلزِم عند الخلاف').toMatch(/فما في البنود هو المعتبر/)
  })
})

/* ═══ وقاعدةُ الأتعاب تُقرأ بمصدر المتعلّم ═══

   قال صاحبُ المنصّة إنّ هذا أهمُّ ما يقرؤه المدرّب وإنّه غيرُ واضح:
   «٢٥ إذا كان من الرابط و١٥ من عندنا» لا تقول **ما الذي يغيّر السعر**. */
describe('الملحقُ (ب) يقول الأساسَ قبل الأرقام', () => {
  const annex = (b: string) => parseContractDoc(b).sections
    .find((s) => s.kind === 'annex' && s.titleAr === 'أساس الأتعاب')!

  it('صدرٌ يقول على أيّ شيء تُحتسب، وما الذي يغيّرها', () => {
    const first = annex(renderContractBodyAr(base())).blocks[0]
    const t = 'textAr' in first ? first.textAr : ''
    expect(t, 'الملحقُ يبدأ بالرقم لا بالأساس').toMatch(/عن كل متعلم يسجل في شعبته/)
    expect(t, 'لا يُنفى ما ليس أساسا').toMatch(/لا عن الساعة/)
    expect(t, 'لا يُقال ما الذي يغيّر السعر').toMatch(/الجهة التي جاء منها المتعلم/)
  })

  it('وصفوفُه تُعنوَن بمصدر المتعلّم لا بنوع المقعد', () => {
    const rows = annex(renderContractBodyAr(base())).blocks.map(feeRuleCells).filter(Boolean)
    const labels = rows.map((r) => r!.labelAr)
    expect(labels, 'لا صفَّ لمن جاء عبر رابط المدرّب').toContain('من جاء عبر رابط دعوة المدرب')
    expect(labels, 'لا صفَّ لمن جاء من تسويقنا').toContain('من جاء من تسويق الأكاديمية')
    /* والتسميةُ القديمةُ لا تعود */
    expect(labels.join(' '), 'عادت تسميةُ «المقعد العام» المبهمة').not.toMatch(/المقعد العام/)
  })

  /* والحدُّ الأدنى في **صالح** المدرّب، وكان يُسمّى «الحد الأدنى للشعبة»
     فيُقرأ قيدا عليه. فيُسمّى بما هو، ويُقال صراحةً إنّه لا يحدّ أعلاه. */
  it('والحدُّ الأدنى يُسمّى مضمونا ويُنفى أن يكون سقفا', () => {
    const rows = annex(renderContractBodyAr(base())).blocks.map(feeRuleCells).filter(Boolean)
    const floor = rows.find((r) => /الحد الأدنى/.test(r!.labelAr))
    expect(floor, 'لا صفَّ للحدّ الأدنى').toBeTruthy()
    expect(floor!.labelAr, 'يُقرأ قيدا على المدرّب لا ضمانا له').toContain('المضمون')
    expect(floor!.whenAr, 'لا يُنفى أن يكون سقفا').toMatch(/ولا يحد أعلاه/)
  })

  /* ═══ وصيغةُ العدد ═══
     «8 مقعدا» خطأٌ نحويّ كان مطبوعا في عقودٍ وُقّعت — والثلاثةُ إلى
     العشرة جمع. ويُقرأ في أهمّ سطرٍ في الوثيقة. */
  it('وعددُ المقاعد بصيغته الصحيحة في المدى كلِّه', () => {
    const seats = (n: number) => {
      const b = renderContractBodyAr(base({
        compensation: { type: 'per_seat', rate: '30', currency: 'USD', minSeats: n, referralRate: '45' },
      }))
      const rows = annex(b).blocks.map(feeRuleCells).filter(Boolean)
      return rows.find((r) => /الحد الأدنى/.test(r!.labelAr))!.amountAr
    }
    expect(seats(1)).toBe('1 مقعد')
    expect(seats(2)).toBe('2 مقعدين')
    expect(seats(8), 'ثمانيةٌ جمعٌ لا مفردٌ منصوب').toBe('8 مقاعد')
    expect(seats(12), 'ما فوق العشرة مفردٌ منصوب').toBe('12 مقعدا')
  })
})

/* ولا يبقى «رابط الإحالة» في المتن: البوّابةُ تسمّيه «دعوتي» والبندُ 4-10
   يحيل إليها بهذا الاسم منذ كُتب — فلسانان لشيءٍ واحدٍ يُربكان قارئَه. */
describe('لسانُ العقد ولسانُ الشاشة واحد', () => {
  it('«رابط الدعوة» لا «رابط الإحالة»', () => {
    for (const body of [renderContractBodyAr(base()), renderContractBodyAr(base({ conditional: CONDITIONAL }))]) {
      expect(body, 'بقي «رابط الإحالة» في المتن').not.toMatch(/رابط الإحالة|رابط إحالته/)
      expect(body, 'لا ذكرَ لرابط الدعوة').toMatch(/رابط الدعوة|رابط دعوته/)
    }
  })

  it('ويُذكَر مرّةً بالإنجليزيّة لمن يعرفها بها', () => {
    expect(renderContractBodyAr(base()), 'لا مقابلَ إنجليزيٌّ للمصطلح').toContain('referral link')
  })
})
