/* هويّةُ الأكاديميّة القانونيّة — مصدرٌ واحد، ولا وثيقةَ تخرج ناقصةَ الطرف.

   ── العطبُ الذي وُضع له هذا الحارس ──

   صفحتا الشروط والخصوصيّة تحملان منذ نشرهما: «السجل التجاري: [يُعبأ من السجل
   الرسمي]». وهو في صفحةٍ تُقرأ عيبٌ يُرى ويُصلَح. أمّا في **عقدٍ يوقّعه إنسانٌ
   ويلتزم به** فهو عقدٌ بلا طرفٍ أوّل: من وقّع يحتجّ بأنّه لم يتعاقد مع أحد، أو
   يقاضي أوسعَ الكيانات المذكورة ذمّةً. **وما أُرسل لا يُستردّ.**

   فالمقيسُ خاصّيّتان لا قيمتان:

   ① **ما نقص يُسمّى.** لا يكفي أن تقول الدالّةُ «ناقصة» — فرسالةٌ لا تدلّ على
      عملٍ تُقرأ مرّتين ثمّ تُتجاوز. والحقلُ الناقصُ يُسمّى بالعربيّة في رسالةٍ
      يراها الموظّف.
   ② **وكلُّ حقلٍ مطلوبٍ يبلغ الديباجةَ فعلا.** وهذا هو العطبُ الخفيّ: يُضاف
      حقلٌ إلى القائمة فيُمنَع الإرسالُ حتّى يُملأ، ثمّ لا يُطبَع في المتن —
      فيُحبَس العملُ على بيانٍ لا يظهر في الوثيقة أصلا. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ACADEMY_LEGAL, LEGAL_FIELD_LABELS_AR, REQUIRED_LEGAL_FIELDS,
  academyEntityLineAr, academyLegalGapMessageAr, academyPartyLineAr, missingAcademyLegalFields,
} from '@/data/academy-legal'
import { CONTACT } from '@/data/stories'
import { ECOSYSTEM_NOTE, staticPageBySlug, staticPages } from '@/data/siteContent'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

/** مصدرٌ كاملٌ مصطنع — تُقاس به الآليّةُ وحدَها، فلا يتغيّر فحصُها بتغيّر
    القيم الحقيقيّة. والحقيقيُّ يُقاس في موضعه أدناه. */
const FULL: Record<string, string> = Object.fromEntries(
  Object.keys(ACADEMY_LEGAL).map((k) => [k, `قيمة-${k}`]),
)

describe('اكتمالُ هويّة الطرف الأوّل', () => {
  it('كلُّ حقلٍ مطلوبٍ له اسمٌ عربيٌّ يُعرض — فالرسالةُ تدلّ على عمل', () => {
    for (const f of REQUIRED_LEGAL_FIELDS) {
      expect(LEGAL_FIELD_LABELS_AR[f], `${f} بلا اسمٍ عربيّ`).toBeTruthy()
    }
  })

  it('والمصدرُ الكاملُ لا ينقصه شيء', () => {
    expect(missingAcademyLegalFields(FULL)).toEqual([])
  })

  it('وكلُّ حقلٍ مطلوبٍ يُفرَّغ يُسمّى وحدَه — لا «ناقصة» مبهمة', () => {
    for (const f of REQUIRED_LEGAL_FIELDS) {
      const holed = { ...FULL, [f]: '   ' }
      expect(missingAcademyLegalFields(holed), `${f} فُرّغ ولم يُلتقَط`).toEqual([f])
      expect(academyLegalGapMessageAr([f])).toContain(LEGAL_FIELD_LABELS_AR[f])
    }
  })

  it('والآليّةُ حيّةٌ على البيانات الحقيقيّة لا على المصطنعة وحدَها', () => {
    /* كان هذا يقول «والحالُ اليومَ ناقصٌ فعلا» حين كان الملفُّ ناقصا عمدا.
       وقد اكتمل (١٩ سبتمبر ٢٠٢٦)، فبقي منه ما لا يبلى: أنّ الرسالةَ تُبنى
       على الحقيقيّ متى نقص، وأنّ رقمَ السجلّ لا يُفقَد. والاكتمالُ نفسُه
       يُقاس في «الهويّةُ اكتملت» أدناه. */
    const missing = missingAcademyLegalFields()
    if (missing.length > 0) {
      expect(academyLegalGapMessageAr(missing)).toContain('لا يُرسَل عقدٌ بطرفٍ أوّلَ ناقص')
    }
    expect(ACADEMY_LEGAL.registrationNo, 'رقمُ السجلّ وصل ولا يُفقَد').toBeTruthy()
  })
})

describe('وما مُنع الإرسالُ لأجله يبلغ الديباجةَ فعلا', () => {
  const line = academyPartyLineAr(FULL as typeof ACADEMY_LEGAL)

  for (const f of REQUIRED_LEGAL_FIELDS) {
    /* المدينةُ والدولةُ والقانونُ وجهةُ النزاع: منها ما يُطبَع في الديباجة
       ومنها ما يُطبَع في البند 20. والمقيسُ هنا الديباجةُ وحدَها، فيُستثنى
       ما موضعُه غيرُها — ويُسمّى الاستثناءُ كي لا يتّسع بالسهو. */
    const elsewhere = ['governingLawAr', 'disputeVenueAr', 'countryAr']
    if (elsewhere.includes(f)) continue
    it(`${LEGAL_FIELD_LABELS_AR[f]} يظهر في سطر الطرف الأوّل`, () => {
      expect(line, `${f} مطلوبٌ ولا يُطبَع`).toContain(FULL[f])
    })
  }
})

describe('الهويّةُ اكتملت — ويُرسَل العقدُ فعلا (١٩ سبتمبر ٢٠٢٦)', () => {
  /* كان الملفُّ ناقصا عمدا فيُردُّ كلُّ إرسال. وقد وصل العنوانُ من صاحب
     المنصّة («الأردن — عمّان — الصويفية»)، وخرج الرقمُ الضريبيُّ من المطلوب
     بقراره. فصار البابُ مفتوحا — وهذا الحارسُ يمنع إغلاقَه بالسهو: من فرّغ
     حقلا مطلوبا حبس كلَّ عقدٍ في المنصّة ولا يعلم. */
  it('⚠️ لا ينقص الطرفَ الأوّلَ شيء — فلا عقدَ محبوس', () => {
    expect(missingAcademyLegalFields(), 'عاد الإرسالُ محبوسا على هويّةٍ ناقصة').toEqual([])
  })

  it('والعنوانُ المسجَّلُ يبلغ الديباجةَ بنصّه', () => {
    expect(academyPartyLineAr()).toContain(ACADEMY_LEGAL.registeredAddressAr)
  })

  /* ═══ والمدينةُ فارغةٌ اليومَ — فلا تُقاس بـ`toContain` ═══

     `toContain('')` يمرّ على كلّ نصّ. وكان هذا السطرُ يقيس المدينةَ به، فيومَ
     فرغت (المقرُّ المسجَّلُ صار «جزر العذراء البريطانية» بلا مدينة) لبقي
     أخضرَ وهو لا يقيس شيئا — وهو عطبُ الحرّاس الذي يتكرّر في هذا المستودع.

     فالمقيسُ **الشرط**: مدينةٌ مكتوبةٌ تُطبَع، وفارغةٌ لا تُخرج فاصلةً
     معلَّقةً على فراغ. وكلتا الحالتَين تُجرَّب بمصدرٍ مصطنع، فلا يتبدّل
     الفحصُ يومَ يصل عنوانٌ فيه مدينة. */
  it('والمدينةُ تُطبَع إن كُتبت، ولا تُخرج فاصلةً معلَّقةً إن فرغت', () => {
    /* و`as unknown` كما في فحوص الرقم الضريبيّ أعلاه: المصدرُ `as const`
       فنوعُ `cityAr` الحرفيُّ `''`، ولا يُوسَّع إلّا بها. */
    const with_ = { ...ACADEMY_LEGAL, cityAr: 'رود تاون' } as unknown as typeof ACADEMY_LEGAL
    expect(academyEntityLineAr(with_)).toContain(`${ACADEMY_LEGAL.registeredAddressAr}، رود تاون`)

    const noCity = { ...ACADEMY_LEGAL, cityAr: '   ' } as unknown as typeof ACADEMY_LEGAL
    const line = academyEntityLineAr(noCity)
    expect(line, 'فاصلةٌ معلَّقةٌ على فراغٍ في وثيقةٍ تُوقَّع').not.toMatch(/،\s*$/)
    expect(line).toContain(ACADEMY_LEGAL.registeredAddressAr)
  })
})

describe('والرقمُ الضريبيُّ جملةٌ تُزاد لا فراغٌ يُطبَع', () => {
  /* خرج من المطلوب بقرار صاحب المنصّة. ولو بقي في سطر الديباجة بلا شرطٍ
     لخرجت الوثيقةُ تقول «والرقم الضريبيّ ،» — فراغٌ معلَّقٌ في عقدٍ يوقّعه
     إنسانٌ ويلتزم به. والفحصُ على البنية: الجملةُ تغيب بغيابه وتحضر بحضوره.

     وبلا تشكيلٍ منذ ٢٩ سبتمبر ٢٠٢٦ (الملاحظة ٧): نُزع من سطر الكيان كلِّه. */
  const TAX_LEAD = 'والرقم الضريبي'

  it('⚠️ يغيب ذكرُه كلَّه ما دام فارغا — لا «والرقم الضريبيّ» بلا رقم', () => {
    const line = academyPartyLineAr({ ...FULL, taxNo: '   ' } as unknown as typeof ACADEMY_LEGAL)
    expect(line, 'طُبعت جملةُ الضريبيّ على فراغ').not.toContain(TAX_LEAD)
  })

  it('ويعود وحدَه يومَ يُكتب — بلا تعديلِ سطر', () => {
    const line = academyPartyLineAr({ ...FULL, taxNo: '٩٩٩' } as unknown as typeof ACADEMY_LEGAL)
    expect(line).toContain(`${TAX_LEAD} ٩٩٩`)
  })

  it('وهو خارجُ المطلوب — فلا يُحبَس إرسالٌ على غيابه', () => {
    expect(REQUIRED_LEGAL_FIELDS).not.toContain('taxNo')
    expect(missingAcademyLegalFields({ ...FULL, taxNo: '' })).toEqual([])
  })

  it('ويبقى له اسمٌ عربيٌّ — فيومَ يُعاد إلى المطلوب تُقرأ رسالتُه', () => {
    expect(LEGAL_FIELD_LABELS_AR.taxNo).toBeTruthy()
  })
})

describe('والمقرُّ المسجَّلُ لا يُعرَض مكتبا (٢٩ سبتمبر ٢٠٢٦)', () => {
  /* ═══ ما كان يحرسه هذا الموضع، ولمَ انقلب ═══

     كان يحرس **تطابُقَهما**: عنوانُ مكتب عمّان في الموقع هو العنوانُ المسجَّلُ
     نفسُه، يُقرأ من مصدرٍ واحدٍ فلا تخرج العقودُ بعنوانٍ غيرِ المنشور. وكان
     ذلك صوابا ما دام المقرُّ المسجَّلُ **هو** مكتبَ عمّان.

     وقد صار الطرفُ الأوّلُ كيانا مسجَّلا في جزر العذراء البريطانيّة، ومكتبُ
     عمّان قائمٌ يُزار. فافترق الشيئان في الواقع، وحارسُ التطابق يُلزم
     بتوحيد ما فرّقه الواقعُ.

     ═══ والعطبُ الذي يُحرَس اليومَ ═══

     أن يُسكَب المقرُّ المسجَّلُ في بطاقة التواصل: فيرى الزائرُ «الأردن —
     عمّان» وتحتَه عنوانٌ في الكاريبي، وخريطةً تدلّ على الصويفية. وهو ما
     يقع بالسهو أوّلَ مرّةٍ يُعاد ربطُ الحقلَين.

     (وأمّا الحدُّ الأصليُّ — ألّا يُكتب العنوانُ المسجَّلُ حرفا في ملفّ عرضٍ —
      فيبقى تحت، ومعناه اليومَ أوضح.) */
  const ammanLabel = 'الأردن — عمّان'

  it('بطاقةُ عمّان قائمةٌ بعنوانِ مكتبها', () => {
    const amman = CONTACT.locations.find((l) => l.label === ammanLabel)
    expect(amman, `لا بطاقةَ بالعنوان «${ammanLabel}» في بيانات التواصل`).toBeTruthy()
    expect(amman!.address.trim().length, 'بطاقةُ عمّان بلا عنوان').toBeGreaterThan(8)
    expect(amman!.href, 'بطاقةُ عمّان بلا خريطةٍ تدلّ عليها').toContain('http')
  })

  it('⚠️ ولا يُسكَب المقرُّ المسجَّلُ في بطاقةِ مكتبٍ — فلا عنوانَ كاريبيٍّ تحت «عمّان»', () => {
    for (const l of CONTACT.locations) {
      expect(l.address, `بطاقةُ «${l.label}» تعرض المقرَّ المسجَّل`)
        .not.toContain(ACADEMY_LEGAL.registeredAddressAr)
    }
  })

  it('⚠️ ولا يُكتب المقرُّ المسجَّلُ حرفا في `stories.ts` — ونسختان تفترقان', () => {
    expect(
      read('src/data/stories.ts').includes(ACADEMY_LEGAL.registeredAddressAr),
      'العنوانُ المسجَّلُ مكتوبٌ حرفا في ملفّ العرض',
    ).toBe(false)
  })
})

describe('ولا تُكتب هذه القيمُ حرفا في ملفٍّ آخر', () => {
  /* على نمط `academy-email.test.ts`: مصدرٌ واحدٌ يُغيَّر فيه، ولا نسخةٌ
     منسيّةٌ في صفحةٍ تبقى تقول الرقمَ القديم. */
  const SOURCES = ['src/data/academy-legal.ts']
  const WATCHED = [
    'src/data/siteContent.ts',
    'src/data/stories.ts',
    'src/application/trainer/contract-body.ts',
    'server/services/trainer-review.service.ts',
  ]

  it('رقمُ السجلّ التجاريّ لا يظهر إلّا في مصدره', () => {
    for (const f of [...WATCHED, ...SOURCES]) {
      const has = read(f).includes(ACADEMY_LEGAL.registrationNo)
      expect(has, `${f}: ${SOURCES.includes(f) ? 'المصدرُ فقد قيمتَه' : 'رقمُ السجلّ مكتوبٌ حرفا هنا'}`)
        .toBe(SOURCES.includes(f))
    }
  })

  it('واسمُ الكيان المسجَّلُ كذلك', () => {
    for (const f of WATCHED) {
      expect(read(f).includes(ACADEMY_LEGAL.legalNameAr), `${f}: الاسمُ المسجَّلُ مكتوبٌ حرفا هنا`).toBe(false)
    }
  })
})

describe('وصفحتا الخصوصيّة والشروط تقرآن الكيانَ من مصدره (٢٩ سبتمبر ٢٠٢٦)', () => {
  /* كانتا تقولان «التابعة لكيان Faylasof — السجل التجاري: [يُعبأ من السجل
     الرسمي]» والمسجَّلُ في السجلّ غيرُه — يقرؤه كلُّ شريكٍ يتحقّق منّا قبل أن
     يتعاقد. والفحصُ على ما يُعرض للزائر لا على نصّ الملفّ: فتعليقٌ يذكر القوسَ
     لا يُسقطه، وقيمةٌ تُقرأ من مصدرها تُعَدّ. */
  const pageText = (slug: string) => {
    const p = staticPageBySlug(slug)
    if (!p) throw new Error(`لا صفحةَ بالمعرّف «${slug}»`)
    return [p.title, p.intro, ...p.sections.flatMap((s) => [s.heading ?? '', ...(s.paragraphs ?? []), ...(s.bullets ?? [])])].join('\n')
  }
  const LEGAL_PAGES = ['privacy', 'terms']

  for (const slug of LEGAL_PAGES) {
    it(`«${slug}» تطبع سطرَ الكيان نفسَه — الاسمَ المسجَّلَ ورقمَ السجلّ`, () => {
      expect(pageText(slug)).toContain(academyEntityLineAr())
    })
  }

  it('⚠️ والطرفُ في الشروط هو المسجَّل — في قسم «الطرفان» بعينه لا في أيّ موضع', () => {
    const parties = staticPageBySlug('terms')?.sections.find((s) => s.heading === 'الطرفان والخدمة')
    expect(parties, 'لا قسمَ للطرفين في الشروط').toBeTruthy()
    expect((parties!.paragraphs ?? []).join(' ')).toContain(ACADEMY_LEGAL.legalNameAr)
  })

  it('⚠️ ولا بيانَ بين قوسين معقوفين في أيّ صفحةٍ ثابتة — فهو فراغٌ لم يُعبَّأ', () => {
    for (const p of staticPages) {
      expect(pageText(p.slug).match(/\[[^\]]*\]/g), `«${p.slug}» فيها بيانٌ لم يُعبَّأ`).toBeNull()
    }
  })

  it('والرقمُ الضريبيُّ لا يُذكر فيهما ما دام فارغا — ويعود مع سطر الكيان يومَ يُكتب', () => {
    const bare = (t: string) => t.replace(/[\u064B-\u0652]/g, '')
    for (const slug of LEGAL_PAGES) {
      expect(bare(pageText(slug)).includes('الرقم الضريبي'), `«${slug}»`).toBe(Boolean(String(ACADEMY_LEGAL.taxNo).trim()))
    }
  })

  it('والانتماءُ إلى وجيز بنصّه المعتمد لا بصيغةٍ ثانية', () => {
    for (const slug of LEGAL_PAGES) expect(pageText(slug)).toContain(ECOSYSTEM_NOTE)
  })

  it('وسطرُ العقد يبدأ بسطر الكيان نفسِه — فلا يفترق الموقعُ والعقدُ في تعريفه', () => {
    expect(academyPartyLineAr().startsWith(academyEntityLineAr())).toBe(true)
    expect(academyPartyLineAr(FULL as typeof ACADEMY_LEGAL).startsWith(academyEntityLineAr(FULL as typeof ACADEMY_LEGAL))).toBe(true)
  })
})
