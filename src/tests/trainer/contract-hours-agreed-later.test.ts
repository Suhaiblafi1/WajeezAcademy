/* ساعاتُ الدورة لا تُطبَع رقما من الكتالوج — ويُقال من يحدّدها ومتى.
 *
 * ── القرار ──
 *
 * صاحبُ المنصّة (٢٩ سبتمبر ٢٠٢٦): «لا داعي لذكر عدد الساعات لكل دورة من
 * الكاتلوج لانه هو من سيحددها بالاتفاق معنا ويفضل ان لا تقل عن ١٦ ساعة
 * مباشره.. اتركها فارغه او اقترح شي اخر».
 *
 * ── والعطبُ الذي يحرسه ──
 *
 * ثلاثةٌ، وكلُّها تُقاس على المتن المصيَّر لا على الشيفرة:
 *
 * ① **لا رقمَ كتالوجٍ في وثيقةٍ تُوقَّع.** كان الملحقُ (أ) يطبع «— 24 ساعة»
 *    أمام كلّ دورة، ومعه بندُ تسامحٍ ٢٠٪. وهو رقمٌ لم يتّفق عليه أحد.
 *
 * ② **ولا يُترَك السؤالُ بلا جواب.** الفراغُ يُعيد العطبَ الذي أُدخلت
 *    الساعاتُ لأجله («يوقّع المدرّبُ على تأهيلٍ لدورةٍ لا يعرف حجمَها»).
 *    فيُقال من يحدّدها ومتى، ومعه ما تخطّط له الأكاديميّة.
 *
 * ③ **ولا يُنزَع رقمٌ من عقدٍ وُقّع.** لقطةٌ حُفظت بساعاتها تُطبَع بساعاتها
 *    وببند تسامحها — وإلّا تبدّل ما قرأه من وقّع. وهي القاعدةُ التي بُني
 *    عليها المتنُ كلُّه: المعروضُ هو الموقَّع.
 */

import { describe, expect, it } from 'vitest'
import {
  renderContractBodyAr, type ContractBodyInput, type ContractCourseRow,
} from '@/application/trainer/contract-body'
import { HOURS_TOLERANCE_PERCENT, MIN_LIVE_HOURS_GUIDE } from '@/application/catalog/course-hours'
import { ACADEMY_LEGAL, academyPartyLineAr } from '@/data/academy-legal'

const base = (courses: readonly ContractCourseRow[]): ContractBodyInput => ({
  academyPartyLineAr: academyPartyLineAr(),
  academyLegalNameAr: ACADEMY_LEGAL.legalNameAr,
  academyTradingNameAr: ACADEMY_LEGAL.tradingNameAr,
  governingLawAr: ACADEMY_LEGAL.governingLawAr,
  disputeVenueAr: ACADEMY_LEGAL.disputeVenueAr,
  trainerFullName: 'اسمٌ قانونيّ',
  trainerEmail: 'trainer@example.com',
  applicationReference: 'WJ-TR-2026-00000',
  issuedOnAr: '٢٩ سبتمبر ٢٠٢٦',
  courses,
  compensation: { type: 'per_seat', rate: '25', currency: 'USD', minSeats: 12, referralRate: '30' },
  rateWaivedReasonAr: null,
  hoursNoteAr: null,
  requiredDocuments: [{ kind: 'id', labelAr: 'الهوية', required: true }],
  conditional: null,
})

/** لقطةُ اليوم: عنوانٌ بلا ساعات — وهو ما يكتبه `chosenCourses` */
const TODAY: ContractCourseRow[] = [
  { courseId: 'C-1', titleAr: 'إدارة المشاريع' },
  { courseId: 'C-2', titleAr: 'التفاوض' },
]
/** ولقطةُ عقدٍ وُقّع قبل القرار — بساعاتها */
const SIGNED: ContractCourseRow[] = [
  { courseId: 'C-1', titleAr: 'إدارة المشاريع', totalHours: 24, recordedHours: 6 },
]

const today = renderContractBodyAr(base(TODAY))
const signed = renderContractBodyAr(base(SIGNED))

/** سطرُ الدورة في الملحق (أ) — يُقرأ من المتن لا يُفترَض */
const courseLines = (body: string): string[] =>
  body.split('\n').filter((l) => /^\d+\.\s/.test(l.trim()))

describe('① لا رقمَ ساعاتٍ من الكتالوج في عقدٍ يُكتب اليوم', () => {
  it('سطرُ الدورة عنوانٌ وحدَه — لا شرطةَ ولا «ساعة»', () => {
    const lines = courseLines(today).filter((l) => TODAY.some((c) => l.includes(c.titleAr)))
    expect(lines.length, 'لم يُقرأ سطرُ دورةٍ في الملحق — فما تحته لا يقيس').toBe(TODAY.length)
    for (const l of lines) {
      expect(l, `طُبع رقمُ ساعاتٍ في «${l}»`).not.toMatch(/ساعة|ساعات|مباشرة|مسجَّلة/)
      expect(l, `طُبعت شرطةُ الساعات في «${l}»`).not.toContain(' — ')
    }
  })

  it('ولا بندَ تسامحٍ — فلا رقمَ يُتسامَح فيه', () => {
    expect(today, 'بندُ التسامح يُقال حيث لا رقم').not.toContain(`${HOURS_TOLERANCE_PERCENT}٪`)
  })
})

describe('② ويُقال من يحدّدها ومتى — فلا يوقّع على حجمٍ يجهله', () => {
  it('الملحقُ يقول إنّها تُتّفق لكلّ دورةٍ قبل إسنادها، ويُحيل إلى البند 3-2', () => {
    expect(today).toContain('ولا يبين هذا الملحق عدد ساعات كل دورة')
    expect(today, 'لم يُقل متى تُثبَت').toContain('قبل إسنادها')
    expect(today, 'لم تُذكر جهةُ إثباتها').toContain('عرض الإسناد وفق البند 3-2')
  })

  it('وما تخطّط له الأكاديميّةُ مذكورٌ — ومن ثابته لا مكتوبا بيد', () => {
    /* و«لنحو» لا «لا يقل عن» (٣٠ سبتمبر ٢٠٢٦): أمرُ صاحب المنصّة أن تتحرّك
       في الاتّجاهين — «يحق للمدرب تقليل عدد الساعات أو زيادتها بالاتفاق مع
       الإدارة» — و«لا يقل عن» تُقرأ أرضيّةً لا إرشادا. */
    expect(today).toContain(`لنحو ${MIN_LIVE_HOURS_GUIDE} ساعة مباشرة`)
    expect(today, 'عادت الصيغةُ التي تُقرأ حدّا أدنى').not.toContain('لا يقل عن')
  })

  /* وهو **استرشاديٌّ** لا حدٌّ: قال «يُفضَّل ألّا تقلّ»، ومن كتبها إلزاما
     ألزم الأكاديميّةَ بما لم تُقرِّره. فالنصُّ يجب أن ينزع عنه الإلزام. */
  it('⚠️ ولا يُقرأ إلزاما — «بيان استرشادي لا شرط»، ويتحرّك في الاتّجاهين', () => {
    const at = today.indexOf(`لنحو ${MIN_LIVE_HOURS_GUIDE} ساعة مباشرة`)
    expect(at, 'لم يُوجد ذكرُ التخطيط').toBeGreaterThan(-1)
    /* في الجملة نفسِها لا في موضعٍ آخرَ من الوثيقة — وإلّا انفصل القيدُ عن
       الرقم بتحريرٍ لاحقٍ وبقي الرقمُ وحدَه يُقرأ شرطا. */
    const sentence = today.slice(at, today.indexOf('.', at) + 1)
    expect(sentence, 'رقمٌ بلا قيدٍ في جملته يُقرأ شرطا')
      .toContain('إرشاد لا شرط')
    expect(sentence, 'لم يُقَل إنّ للمدرّب أن ينقصه أو يزيده')
      .toContain('ينقص هذا العدد أو يزيده')
  })
})

describe('③ ولقطةٌ وُقّعت بساعاتها تبقى بحروفها', () => {
  it('الرقمُ يُطبَع كما حُفظ', () => {
    const line = courseLines(signed).find((l) => l.includes('إدارة المشاريع'))
    expect(line, 'سقط سطرُ الدورة').toBeTruthy()
    expect(line, 'نُزع من عقدٍ وُقّع ما قرأه صاحبُه').toContain('24 ساعة')
    expect(line).toContain('18 مباشرة + 6 مسجَّلة')
  })

  it('وبندُ تسامحه معه', () => {
    expect(signed).toContain(`${HOURS_TOLERANCE_PERCENT}٪`)
  })

  it('ولا يُزاد فيه نصُّ اليوم — فلا جملتان تتناقضان في وثيقةٍ واحدة', () => {
    expect(signed, 'قالت الوثيقةُ إنّها لا تبين الساعات وهي تبينها')
      .not.toContain('ولا يبين هذا الملحق عدد ساعات كل دورة')
  })
})
