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
  academyLegalGapMessageAr, academyPartyLineAr, missingAcademyLegalFields,
} from '@/data/academy-legal'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

/** مصدرٌ كاملٌ مصطنع — فالحقيقيُّ ناقصٌ اليومَ عمدا، ولا يُختبَر به الاكتمال */
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

  it('والحالُ اليومَ ناقصٌ فعلا — وهذا مقصودٌ لا سهو', () => {
    /* لا يُقاس أيُّ حقلٍ ينقص، بل أنّ الآليّةَ حيّةٌ على البيانات الحقيقيّة:
       يومَ تكتمل يبقى هذا أخضرَ بالفرع الآخر. */
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
       ومنها ما يُطبَع في البند 19. والمقيسُ هنا الديباجةُ وحدَها، فيُستثنى
       ما موضعُه غيرُها — ويُسمّى الاستثناءُ كي لا يتّسع بالسهو. */
    const elsewhere = ['governingLawAr', 'disputeVenueAr', 'countryAr']
    if (elsewhere.includes(f)) continue
    it(`${LEGAL_FIELD_LABELS_AR[f]} يظهر في سطر الطرف الأوّل`, () => {
      expect(line, `${f} مطلوبٌ ولا يُطبَع`).toContain(FULL[f])
    })
  }
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
