/* الاسمُ المسجَّلُ في الديباجة — فتعريفُ الطرف الأوّل يُطابَق بالسجلّ.
 *
 * ── العطبُ الذي يحرسه ──
 *
 * شهادةُ التأسيس (BVI Business Companies Act 2004، القسم 7، ٢٦ فبراير ٢٠١٩)
 * تسمّي الكيانَ «Faylasof LTD» ورقمَه 2007303. والكيانُ مسجَّلٌ بلسانٍ
 * لاتينيٍّ وحدَه: ليس لاسمه صورةٌ عربيّةٌ في أيّ سجلّ.
 *
 * وكانت الديباجةُ تطبع «شركة فيلسوف ليمتد» وحدَها — وهو نقلٌ صوتيٌّ كتبناه
 * نحن. فمن طابَق العقدَ بالسجلّ لم يجد الكيانَ، وهو العطبُ الذي كُتب في رأس
 * `academy-legal.ts` نفسِه: **عقدٌ لا يُعرَّف فيه الطرفُ الأوّلُ عقدٌ بلا طرفٍ
 * أوّل**، يحتجّ من وقّعه بأنّه لم يتعاقد مع أحد.
 *
 * ── والمقيسُ البنيةُ لا اللفظ ──
 *
 * لا يُطابَق «Faylasof LTD» حرفا: يُقرأ من `ACADEMY_LEGAL` فيبقى الفحصُ
 * قائما يومَ يتبدّل الاسم. والمقيسُ **أنّ المسجَّلَ يبلغ الديباجة**، وأنّ
 * غيابَه لا يُخرج قوسَين فارغَين في وثيقةٍ تُوقَّع.
 */

import { describe, expect, it } from 'vitest'
import {
  ACADEMY_LEGAL, academyEntityLineAr, academyPartyLineAr,
  missingAcademyLegalFields, REQUIRED_LEGAL_FIELDS,
} from '@/data/academy-legal'

describe('الاسمُ المسجَّلُ يبلغ الديباجة', () => {
  it('وهو مكتوبٌ في المصدر أصلا — فلا يخضرّ الفحصُ على فراغ', () => {
    expect(ACADEMY_LEGAL.legalNameEn, 'لا اسمَ مسجَّلٌ في المصدر').toBeTruthy()
  })

  it('⚠️ يُطبَع مع المنقول لا بدلا عنه', () => {
    const line = academyPartyLineAr()
    expect(line, 'سقط الاسمُ المنقول').toContain(ACADEMY_LEGAL.legalNameAr)
    expect(line, 'سقط الاسمُ المسجَّلُ — فلا يُطابَق العقدُ بالسجلّ')
      .toContain(ACADEMY_LEGAL.legalNameEn)
  })

  it('وموضعُه بعد المنقول بين قوسَين — فلا يُقطَع سياقُ الجملة', () => {
    expect(academyEntityLineAr())
      .toContain(`${ACADEMY_LEGAL.legalNameAr} (${ACADEMY_LEGAL.legalNameEn})`)
  })

  /* ولا يُحبَس إرسالٌ عليه: تعريفٌ يُحسَّن لا شرطٌ يُشترَط */
  it('وليس من المطلوب — فلا عقدَ محبوسٌ على غيابه', () => {
    expect(REQUIRED_LEGAL_FIELDS).not.toContain('legalNameEn')
    expect(missingAcademyLegalFields({ ...ACADEMY_LEGAL, legalNameEn: '' })).toEqual([])
  })

  /* ويغيب كلَّه إن فرغ — كما يغيب الرقمُ الضريبيّ. فقوسان فارغان في وثيقةٍ
     يوقّعها إنسانٌ عطبٌ يُرى، وهو ما وقع في هذا الملفّ مرّتَين قبلُ. */
  it('⚠️ ولا يُخرج قوسَين فارغَين إن لم يُكتب', () => {
    const bare = { ...ACADEMY_LEGAL, legalNameEn: '   ' } as unknown as typeof ACADEMY_LEGAL
    const line = academyEntityLineAr(bare)
    expect(line, 'قوسان معلَّقان على فراغ').not.toContain('()')
    expect(line, 'بقيت مسافةٌ قبل الفاصلة').toContain(`${ACADEMY_LEGAL.legalNameAr}، `)
  })
})

describe('و«الرقم الوطني للمنشأة» حُذف — لا نظيرَ له في الجزر', () => {
  /* مفهومٌ أردنيٌّ: سجلُّ عمّان يُصدره إلى جانب الرقم التجاريّ. وجزرُ العذراء
     تُصدر معرِّفا واحدا هو رقمُ الشركة — وهو `registrationNo` نفسُه. فحقلٌ
     فارغٌ لا نظيرَ له يُغري من يأتي بعدُ بأن «يُكمله» برقم الشركة. */
  it('الحقلُ لم يعد في المصدر', () => {
    expect(Object.hasOwn(ACADEMY_LEGAL, 'nationalNo'), 'عاد الحقلُ الذي لا نظيرَ له').toBe(false)
  })

  it('ورقمُ الشركة مخزَّنٌ مرّةً واحدةً لا مرّتَين', () => {
    const same = Object.entries(ACADEMY_LEGAL)
      .filter(([, v]) => typeof v === 'string' && v === ACADEMY_LEGAL.registrationNo)
    expect(same.map(([k]) => k), 'الرقمُ الواحدُ مخزَّنٌ باسمَين').toEqual(['registrationNo'])
  })
})
