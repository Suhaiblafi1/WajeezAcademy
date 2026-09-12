/* قائمةُ دول العالم — بياناتٌ يقرؤها منتقيا الهاتف والإقامة.

   وما يُحرس هنا ثلاثةٌ ينكسر كلٌّ منها صامتا:

   ١) البحثُ يطابق ما يكتبه إنسانٌ عربيّ فعلا — بلا همزةٍ ولا تاءٍ مربوطة.
      ولو انكسر التطبيعُ لبقي الصندوقُ يعمل ويقول «لا دولةَ بهذا الاسم» لمن
      كتب «الامارات»، وهو أسوأُ من عطبٍ ظاهر.
   ٢) لكلّ دولةٍ منطقةٌ زمنيّة: النموذجُ يشتقّها ولا يسأل عنها، فصفٌّ بلا
      منطقةٍ يعني مقابلةً تُجدوَل بساعةٍ مجهولة.
   ٣) ولا صفَّ مكرَّر: دولةٌ مرّتين في القائمة تُعرض مرّتين ويختار المتقدّمُ
      إحداهما بلا فرق. */

import { describe, expect, it } from 'vitest'
import {
  ARAB_COUNTRY_NAMES, COUNTRIES, COUNTRIES_SORTED, countryByName, flagOf, searchCountries, timezoneOf,
} from '@/data/countries'

describe('دولُ العالم', () => {
  it('قائمةٌ عالميّةٌ لا عربيّةٌ وحدَها', () => {
    /* كانت أحدَ عشرَ رمزا وتسعَ عشرةَ دولة. والعددُ هنا حارسُ الاتّساع لا زينة */
    expect(COUNTRIES.length, 'القائمة ضاقت — عادت إقليميّةً كما كانت').toBeGreaterThan(150)
    expect(ARAB_COUNTRY_NAMES.length, 'الدولُ العربيّة نقصت عن جامعتها').toBeGreaterThanOrEqual(22)
    for (const name of ['تركيا', 'ماليزيا', 'المملكة المتحدة', 'الولايات المتحدة', 'نيجيريا']) {
      expect(countryByName(name), `${name} غائبةٌ — والمتقدّم منها لا يجد بلدَه`).toBeTruthy()
    }
  })

  it('لكلّ دولةٍ رمزٌ ومنطقةٌ زمنيّةٌ صالحان، ولا صفَّ مكرَّر', () => {
    const seen = new Set<string>()
    for (const c of COUNTRIES) {
      expect(c.dial, `رمزُ ${c.ar} ليس بصيغة +962`).toMatch(/^\+\d{1,4}$/)
      expect(c.iso2, `ISO ${c.ar} ليس حرفين كبيرين`).toMatch(/^[A-Z]{2}$/)
      /* المنطقةُ تُجرَّب على `Intl` نفسِه: اسمٌ مخطوءٌ يرميه المتصفّح لا يقبله.
         وبلا لغةٍ مسمّاة — بوّابةُ الرقم واللغة تمنع تسميتَها خارج بيتها. */
      expect(() => new Intl.DateTimeFormat(undefined, { timeZone: c.tz }), `منطقةُ ${c.ar} مرفوضة`).not.toThrow()
      expect(seen.has(c.iso2), `${c.iso2} مكرَّرة`).toBe(false)
      seen.add(c.iso2)
    }
  })

  it('المنطقةُ تُشتقّ لمن سكن خارجَ الوطن العربيّ — وهو ما كان مفقودا', () => {
    expect(timezoneOf('الأردن')).toBe('Asia/Amman')
    expect(timezoneOf('ماليزيا'), 'من سكن خارج العربيّة يُنشأ طلبُه بلا منطقة').toBe('Asia/Kuala_Lumpur')
    expect(timezoneOf('أخرى'), 'ما ليس دولةً لا يخترع منطقة').toBeUndefined()
  })

  it('البحثُ بالدولة لا بالرمز وحدَه — وبما يكتبه الناسُ لا بما يكتبه المعجم', () => {
    const found = (q: string) => searchCountries(q).map((c) => c.iso2)
    expect(found('ماليزيا'), 'الاسمُ العربيُّ لا يُطابق').toContain('MY')
    expect(found('malaysia'), 'الاسمُ الإنجليزيُّ لا يُطابق').toContain('MY')
    expect(found('60'), 'الرمزُ بلا + لا يُطابق').toContain('MY')
    expect(found('+60'), 'الرمزُ بالـ+ لا يُطابق').toContain('MY')
    /* والتطبيعُ: همزةٌ ساقطةٌ وتاءٌ مربوطةٌ صارت هاءً — وهو أكثرُ ما يُكتب */
    expect(found('الامارات'), 'همزةٌ ساقطةٌ تُسقط النتيجة').toContain('AE')
    expect(found('جمهوريه الدومينيكان'), 'التاءُ المربوطةُ تُسقط النتيجة').toContain('DO')
    expect(found('الراس الاخضر'), 'همزةٌ في وسط الاسم تُسقط النتيجة').toContain('CV')
    expect(found('زغزغ'), 'بحثٌ لا يطابق شيئا يجب أن يعود فارغا').toEqual([])
  })

  it('العربيّةُ أوّلا في العرض — جمهورُ المنصّة لا يبحث عن بلده في المئتين', () => {
    expect(COUNTRIES_SORTED.length).toBe(COUNTRIES.length)
    const firstNonArab = COUNTRIES_SORTED.findIndex((c) => !c.arab)
    expect(firstNonArab, 'العربيّةُ لم تعد أوّلا').toBe(ARAB_COUNTRY_NAMES.length)
  })

  it('العَلَمُ يُشتقّ من ISO ولا يُخزَّن — فلا قائمةٌ ثانيةٌ تُنسى', () => {
    expect(flagOf('JO')).toBe('🇯🇴')
    expect(flagOf('xx'), 'ما ليس ISO لا يُنتج رموزا مبعثرة').toBe('')
  })
})
