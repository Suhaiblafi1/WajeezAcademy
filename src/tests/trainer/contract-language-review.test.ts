/* المراجعةُ اللغويّةُ للمتن — تسعُ موافقاتٍ من صاحب المنصّة (٢٩ سبتمبر ٢٠٢٦).
 *
 * قرأ المتنَ كلَّه (٤٠٦ أسطر) ووافق على كلّ ملاحظةٍ وحدَها. وهذا يحرس ما
 * وافق عليه: لا نصّا يُطابَق حرفا في تعليق — بل **الجملةَ في موضعها من
 * الوثيقة المصيَّرة**، فما يسقط منها يسقط الحارسُ معه.
 *
 * ولمَ تُقاس على المتن لا على الشيفرة: هذه صياغاتٌ يقرؤها إنسانٌ ويوقّع
 * عليها. وفحصٌ يطابق سطرا في ملفّ مصدرٍ يخضرّ ولو لم يبلغ ذلك السطرُ
 * الوثيقةَ أصلا — وقد وقع في هذا المستودع ثلاثَ مرّات.
 */

import { describe, expect, it } from 'vitest'
import {
  renderContractBodyAr, type ContractBodyInput, CONTRACT_BODY_VERSION,
} from '@/application/trainer/contract-body'
import { parseContractDoc, summaryItem } from '@/application/trainer/contract-sections'
import { WITHDRAWAL_RECOVERY_CAP_USD } from '@/application/trainer/notice-periods'
import { ACADEMY_LEGAL, academyPartyLineAr, academyEntityLineAr } from '@/data/academy-legal'
import { PRESENTMENT_CURRENCIES } from '@/application/commerce/presentment'

const INPUT: ContractBodyInput = {
  academyPartyLineAr: academyPartyLineAr(),
  academyLegalNameAr: ACADEMY_LEGAL.legalNameAr,
  academyTradingNameAr: ACADEMY_LEGAL.tradingNameAr,
  governingLawAr: ACADEMY_LEGAL.governingLawAr,
  disputeVenueAr: ACADEMY_LEGAL.disputeVenueAr,
  trainerFullName: 'اسمٌ قانونيّ',
  trainerEmail: 'trainer@example.com',
  applicationReference: 'WJ-TR-2026-00000',
  issuedOnAr: '٢٩ سبتمبر ٢٠٢٦',
  courses: [{ courseId: 'C-1', titleAr: 'دورةٌ أولى' }],
  compensation: { type: 'per_seat', rate: '25', currency: 'USD', minSeats: 12, referralRate: '30' },
  rateWaivedReasonAr: null,
  hoursNoteAr: null,
  requiredDocuments: [{ kind: 'id', labelAr: 'الهوية', required: true }],
  conditional: { orientationOnAr: '٥ أكتوبر ٢٠٢٦', deadlineOnAr: '١٠ أكتوبر ٢٠٢٦', windowDays: 5, extensionDays: 2 },
}
const body = renderContractBodyAr(INPUT)
/** الوثيقةُ محلَّلةً — تُقرأ كما يقرؤها العارض */
const doc = () => parseContractDoc(body)

/** سطرُ البند بعينه — فالجملةُ تُقاس في موضعها لا في الوثيقة كلِّها */
const clause = (no: string): string => {
  const l = body.split('\n').find((x) => x.trimStart().startsWith(`${no} `))
  if (!l) throw new Error(`لا بندَ بالرقم «${no}» في المتن`)
  return l
}

describe('الملاحظة ١ — البند 4-1 يُقرأ جملةً تامّة', () => {
  it('«على ما نص عليه الملحق والبند 18-4» لا «وفق ما نص عليه والبند»', () => {
    expect(clause('4-1')).toContain('على ما نص عليه الملحق والبند 18-4')
    expect(body, 'عادت الجملةُ المكسورة').not.toContain('وفق ما نص عليه والبند')
  })
})

describe('الملاحظة ٢ — صفوفُ المثال تصف المصدرَ نطقا واحدا', () => {
  const rows = body.split('\n').filter((l) => /^\d+\. \d+ /.test(l.trim()))

  it('ولا صفَّ يقول «منه»', () => {
    expect(rows.length, 'لم تُقرأ صفوفُ المثال — فما تحته لا يقيس').toBeGreaterThan(1)
    for (const r of rows) expect(r, `«منه» في «${r}»`).not.toMatch(/\d+ منه /)
  })

  it('والصفُّ المختلطُ يقول «عبر رابط دعوته» كما يقوله صفُّ الكلّ', () => {
    const mixed = rows.find((r) => /\d+ .* و\d+ من الأكاديمية/.test(r))
    expect(mixed, 'لا صفَّ مختلطٌ في المثال').toBeTruthy()
    expect(mixed).toContain('عبر رابط دعوته')
  })
})

describe('الملاحظة ٣ — البند 19-4 لا يُقرأ زمانا', () => {
  it('«في مواجهة الآخر» لا «قبل الآخر»', () => {
    expect(clause('19-4')).toContain('في مواجهة الآخر')
    expect(clause('19-4'), '«قبل» تُقرأ زمانا فينقلب المعنى').not.toContain('قبل الآخر')
  })
})

describe('الملاحظة ٤ — الحدُّ الأدنى مضمونٌ ولا سقفَ فوقه', () => {
  it('«مضمون للمدرب، لا سقف لأتعابه»', () => {
    expect(body).toContain('وهو حد أدنى مضمون للمدرب، لا سقف لأتعابه')
    expect(body, '«يضمن» تُقرأ مبنيّةً للفاعل').not.toContain('حد أدنى يضمن للمدرب')
    expect(body).not.toContain('ولا يحد أعلاه')
  })
})

describe('الملاحظة ٥ — «أداه فعلا» في المواضع كلِّها', () => {
  it('والبند 17-8 يقولها كما تقولها البنود 1-6 و4-6 و6-5', () => {
    expect(clause('17-8')).toContain('عن عمل أداه فعلا')
    expect(body, '«أدي» مبهمةٌ بلا شكل').not.toContain('عمل أدي فعلا')
  })

  /* والقياسُ على الاتّساق لا على موضعٍ واحد: لفظٌ واحدٌ لمعنى واحد */
  it('ولا يبقى في الوثيقة صيغتان لهذا المعنى', () => {
    const n = body.split('عن عمل أداه فعلا').length - 1
    expect(n, 'سقطت مواضعُ «أداه فعلا» الأخرى').toBeGreaterThanOrEqual(3)
  })
})

describe('الملاحظة ٦ — سقفُ التسعة للتمديدَين لا للمهلة كلِّها', () => {
  it('البند 2-10 يقيّد لفظَه ويستثني 2-9 صراحةً', () => {
    expect(clause('2-10')).toContain('فلا تجاوز المهلة بهذين التمديدين')
    expect(clause('2-10'), 'لم يُستثنَ تمديدُ الدورة الجديدة')
      .toContain('ولا يدخل في هذا السقف ما امتدت به المهلة وفق البند 2-9')
    expect(clause('2-10'), 'بقي السقفُ مطلقا').not.toContain('في مجموعها')
  })

  /* والخلاصةُ قراءةٌ ثانيةٌ للبند نفسِه: لو قالت «في مجموعها» بعد تقييده
     لَقرأ الموقِّعُ سقفَين في وثيقةٍ واحدة — وهو العطبُ الذي أُصلح. */
  it('والخلاصةُ تقوله بلفظه — فلا سقفان في وثيقة', () => {
    const line = body.split('\n').find((l) => l.includes('وما يلزمك الآن'))
    expect(line, 'سقط بندُ «ما يلزمك الآن» من الخلاصة').toBeTruthy()
    expect(line).toContain('فلا تجاوز بهما')
    expect(line, 'الخلاصةُ تقول سقفا والبندُ يقول آخر').not.toContain('في مجموعها')
  })
})

describe('الملاحظة ٧ — الديباجةُ بلا تشكيلٍ كبقيّة المتن', () => {
  /* والمقيسُ **البنية**: أيحمل سطرُ الطرف الأوّل علامةَ تشكيلٍ أصلا؟ فلا
     يُطابَق لفظٌ بعينه، ويبقى الفحصُ قائما إذا تبدّل اسمُ الكيان. */
  const HARAKAT = /[ً-ْٰ]/

  it('لا حركةَ في سطر الكيان', () => {
    const line = academyEntityLineAr()
    const found = [...line].filter((ch) => HARAKAT.test(ch))
    expect(found.length, `بقي التشكيلُ في سطر الكيان: «${line}»`).toBe(0)
  })

  it('ولا في سطر الطرف الأوّل من الديباجة', () => {
    const line = body.split('\n').find((l) => l.startsWith('الطرف الأول:'))
    expect(line, 'سقط سطرُ الطرف الأوّل').toBeTruthy()
    /* والاسمُ المسجَّلُ والمدينةُ يأتيان من السجلّ لا من صياغتنا، فيُستثنيان:
       المقيسُ حروفُ الوصل التي نكتبها نحن. */
    const ours = line!.replace(ACADEMY_LEGAL.legalNameAr, '').replace(ACADEMY_LEGAL.cityAr || '\u0000', '')
      .replace(ACADEMY_LEGAL.signatoryNameAr, '')
    expect([...ours].filter((ch) => HARAKAT.test(ch)).length, `تشكيلٌ في: «${ours}»`).toBe(0)
  })
})

describe('الملاحظة ٨ — رمزُ العملة قبل الرقم', () => {
  const $ = PRESENTMENT_CURRENCIES.USD.symbol

  it('وصفوفُ القاعدة تحمله', () => {
    expect(body).toContain(`${$}30:`)
    /* وصارت أرضيّةُ المال «$300 عن الشعبة الواحدة» (١ أكتوبر ٢٠٢٦)، والعددُ
       في اشتقاقها. والمقيسُ هنا رمزُ العملة قبل الرقم في الموضعين. */
    expect(body).toContain(`${$}300 عن الشعبة الواحدة`)
    expect(body, 'ذهب اشتقاقُ الأرضيّة من الملحق (ب)').toContain('وهو قيمة 12 مقعدا بالسعر العام')
  })

  it('ولا يبقى رمزُ العملة الثلاثيُّ بعد رقم', () => {
    expect(body, 'بقي «30 USD» في الوثيقة').not.toMatch(/\d\s+USD/)
  })

  it('والبند 6-4 يقولها بالرمز — ورقمُه من ثابته لا مكتوبا بيد', () => {
    expect(clause('6-4')).toContain(`${$}${WITHDRAWAL_RECOVERY_CAP_USD}`)
    expect(clause('6-4'), 'بقي اسمُ العملة منثورا في بند').not.toContain('دولار أمريكي')
  })

  /* وجملةُ تسمية العملة تبقى بالاسم: «بعملة واحدة هي $» لا تُقرأ.
     ومعرَّفا لا نكرةً — «ال»+«دولار أمريكي» تُخرج «الدولار أمريكي». */
  it('وجملةُ التسمية تسمّيها معرَّفةً لا برمزها', () => {
    expect(body).toContain(`بعملة واحدة هي ${PRESENTMENT_CURRENCIES.USD.labelDefiniteAr}`)
    expect(body, 'سمّت الجملةُ العملةَ برمزها').not.toContain('بعملة واحدة هي $')
    expect(body, 'نكرةٌ بعد «ال»').not.toContain('الدولار أمريكي')
  })

  /* والملاحظةُ ٨ في أصلها: رقمٌ عارٍ إلى جنب رقمٍ يحمل عملتَه */
  it('وسطرُ الأسعار المطبَّقة: كلا الرقمين يحمل رمزَه', () => {
    const line = body.split('\n').find((l) => l.includes('والأسعار المطبقة أعلاه'))
    expect(line, 'سقط سطرُ الأسعار المطبَّقة').toBeTruthy()
    expect(line).toContain(`${$}30 للمقعد عبر رابط دعوته`)
    expect(line, 'بقي الرقمُ الثاني عاريا من عملته').toContain(`${$}25 للمقعد العام`)
  })
})

describe('الملاحظة ٩ — القانونُ قانونُ الكيان، والمحكمةُ محكمةُ العمل', () => {
  it('البند 20-1 يُخضعها لقانون جزر العذراء', () => {
    expect(clause('20-1')).toContain('جزر العذراء البريطانية')
    expect(clause('20-1'), 'بقي القانونُ الأردنيّ').not.toContain('المملكة الأردنية الهاشمية')
  })

  it('والبند 20-3 يُبقي محاكمَ عمّان', () => {
    expect(clause('20-3')).toContain('محاكم عمّان')
  })

  /* وهما مسألتان لا واحدة: لو تبع أحدُهما الآخرَ بالسهو لَخرجت وثيقةٌ
     تُحاكَم في الكاريبي على حسمِ ثلاث مئة. */
  it('ولا تتبع المحكمةُ القانونَ بالسهو', () => {
    expect(clause('20-3'), 'انتقلت المحكمةُ إلى الجزر').not.toContain('جزر العذراء')
  })

  /* والبند 20-4 أشدُّ لزوما بعد هذا التبديل: هو ما يمنع أن يُقرأ اختيارُ
     قانونٍ بعيدٍ إسقاطا لحمايةٍ آمرةٍ في بلد المدرّب. */
  it('وحمايةُ بلد المدرّب الآمرةُ باقيةٌ في 20-4', () => {
    expect(clause('20-4')).toContain('حماية آمرة')
    expect(clause('20-4')).toContain('بلد إقامته')
  })
})

describe('وإصدارُ الصياغة رُفع — فلا يُقرأ متنٌ جديدٌ بإصدارٍ قديم', () => {
  /* وكان يُطبَع في ترويسة المتن، فقيس أنّه الحاليّ. وخرج منها في ١ أكتوبر
     ٢٠٢٦ («no need») — فلا يُقرأ فيه إصدارٌ أصلا، قديما ولا حاضرا. */
  it('الإصدارُ الحاليّ — ولا يُطبَع رمزُه في المتن', () => {
    expect(CONTRACT_BODY_VERSION).toBe('v21-2026-10-01')
    expect(body, 'عاد رمزُ الإصدار إلى المتن').not.toMatch(/\bv\d+-\d{4}-\d{2}-\d{2}\b/)
  })
})

/* ═══ وإحالةُ الجمع تُقرأ كأخواتها (٢٩ سبتمبر ٢٠٢٦) ═══
 *
 * وُجد بتصيير الوثيقة في المتصفّح ورؤيتها — لا باختبار. فحارسُ التمام يخضرّ
 * والنصُّ تامٌّ، لكنّ صفَّين من ستّةٍ يُعرضان على نَسَقٍ آخر: إحالتُهما تبقى
 * في متن التفصيل بلا لون الإحالة ولا وزنِها، وتُقطَع بين سطرَين.
 *
 * وعلّتُه أنّ `REF_RE` كان يعرف «البند» و«البندان» و«الملحق» ولا يعرف الجمع.
 */
describe('إحالاتُ الخلاصة تُقتطَع كلُّها — والجمعُ منها', () => {
  const items = (doc().sections.find((s) => s.kind === 'summary')?.blocks ?? [])
    .map(summaryItem).filter((i): i is NonNullable<typeof i> => i !== null)

  it('وفي الخلاصة إحالةُ جمعٍ أصلا — فلا يخضرّ الفحصُ على لا شيء', () => {
    const line = body.split('\n').find((l) => l.includes('(البنود '))
    expect(line, 'لا إحالةَ جمعٍ في المتن — فما تحته لا يقيس').toBeTruthy()
  })

  it('⚠️ كلُّ بندٍ في الخلاصة له إحالةٌ مقتطَعة', () => {
    expect(items.length).toBeGreaterThan(3)
    for (const it of items) {
      expect(it.refAr, `بندُ «${it.keyAr}» بلا إحالةٍ مقتطَعة — تبقى في متنه`)
        .toMatch(/^\((البند|البندان|البنود|الملحق)/)
    }
  })

  it('ولا تبقى الإحالةُ في التفصيل', () => {
    for (const it of items) {
      expect(it.noteAr, `إحالةٌ بقيت في تفصيل «${it.keyAr}»`).not.toMatch(/\(البنود [^)]*\)$/)
    }
  })
})
