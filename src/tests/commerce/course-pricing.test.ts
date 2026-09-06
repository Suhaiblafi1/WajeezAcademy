/* سعرُ الدورة يطيع قاعدةَ العمق — وكلُّ دورةٍ في الكتالوج تُفحص.

   الأسعارُ مكتوبةٌ رقما رقما في الكتالوج، وتُطيع قاعدةَ المستوى والساعات بلا
   استثناء. لكنّ الطاعةَ بلا حارسٍ صدفةٌ تنتهي عند أوّل دورةٍ تُضاف: يكتب
   المؤلّفُ رقما بيده، فيصيبه أو يخطئه، ولا شيءَ يقول أيّهما فعل.

   وأخطرُ ما يمسكه هذا الفحصُ ليس خطأً في رقم، بل **قاعدةً تغيّرت ولم تُكتب**:
   لو قرّر صاحبُ المنصّة سعرا جديدا لمستوى، فغيّره في الكتالوج وحدَه، لَبقيت
   هذه الوحدةُ تعلن قاعدةً ماتت — وهو ما وقع في هذه المنصّة مرارا (رقمان
   لشيءٍ واحد، أحدُهما وعدٌ على الشاشة والآخر ما يُحسب). فالفشلُ هنا يقول:
   إمّا السعرُ خطأ، وإمّا القاعدةُ تغيّرت فاكتبها.

   والمقيسُ الخاصّيّةُ لا القيمة: أيَّ أساسٍ أُريد لأيّ مستوى، يكفي أن يتّفق
   الإعلانُ مع الكتالوج، وأن يبقى المدى الذي أعلنه صاحبُ المنصّة محفوظا. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  coursePriceFromDepth, LEVEL_BASE_PRICE, LONG_COURSE_HOURS,
  LONG_COURSE_SURCHARGE, COURSE_PRICE_RANGE,
} from '../../application/catalog/course-pricing'

interface RawCourse {
  course_id: string
  level_ar: string
  total_hours: number
  list_price: number
  list_currency: string
}
const CORE = JSON.parse(
  readFileSync(join(process.cwd(), 'src/data/catalog/core-catalog.v2.json'), 'utf8'),
) as { courses: RawCourse[] }

describe('سعرُ الدورة من عمقها', () => {
  it('الكتالوجُ يُقرأ فعلا — الفحصُ ليس فارغا', () => {
    expect(CORE.courses.length).toBeGreaterThan(50)
  })

  it('كلُّ دورةٍ في الكتالوج تطيع القاعدة — لا استثناءَ واحدا', () => {
    const offenders: string[] = []
    for (const c of CORE.courses) {
      const expected = coursePriceFromDepth(c.level_ar, c.total_hours)
      if (expected !== c.list_price) {
        offenders.push(`${c.course_id}: «${c.level_ar}» ${c.total_hours}س ← ${c.list_price} والقاعدةُ تقول ${expected}`)
      }
    }
    expect(offenders, 'إمّا السعرُ خطأ، وإمّا القاعدةُ تغيّرت ولم تُكتب في course-pricing.ts').toEqual([])
  })

  it('ولا مستوًى في الكتالوج بلا أساسٍ معلن — وإلّا فدورةٌ بلا سعرٍ محسوب', () => {
    const known = new Set(Object.keys(LEVEL_BASE_PRICE))
    const unknown = [...new Set(CORE.courses.map((c) => c.level_ar))].filter((l) => !known.has(l))
    expect(unknown, 'مستوياتٌ في الكتالوج لا أساسَ لها').toEqual([])
  })

  it('والمدى المعلَن محفوظ — بين ١٠٠ و٢٠٠ بقرار صاحب المنصّة', () => {
    for (const c of CORE.courses) {
      expect(c.list_price, c.course_id).toBeGreaterThanOrEqual(COURSE_PRICE_RANGE.min)
      expect(c.list_price, c.course_id).toBeLessThanOrEqual(COURSE_PRICE_RANGE.max)
    }
    /* والقاعدةُ نفسُها لا تُخرج رقما خارج المدى مهما كان المستوى والطول */
    const maxBase = Math.max(...Object.values(LEVEL_BASE_PRICE))
    const minBase = Math.min(...Object.values(LEVEL_BASE_PRICE))
    expect(maxBase + LONG_COURSE_SURCHARGE).toBeLessThanOrEqual(COURSE_PRICE_RANGE.max)
    expect(minBase).toBeGreaterThanOrEqual(COURSE_PRICE_RANGE.min)
  })

  it('والطولُ المضاعف يزيد درجةً واحدة لا سلّما ثانيا', () => {
    for (const level of Object.keys(LEVEL_BASE_PRICE)) {
      const short = coursePriceFromDepth(level, 8)!
      const long = coursePriceFromDepth(level, LONG_COURSE_HOURS)!
      expect(long - short, level).toBe(LONG_COURSE_SURCHARGE)
      /* وما بين الطولين لا يُعامَل معاملةَ المضاعف */
      expect(coursePriceFromDepth(level, LONG_COURSE_HOURS - 1), level).toBe(short)
    }
  })

  it('ومستوًى مجهول: لا سعرَ محسوب — ولا صفرٌ يُقرأ «مجّانا»', () => {
    expect(coursePriceFromDepth('مستوًى لا وجود له', 8)).toBeNull()
    expect(coursePriceFromDepth('', 8)).toBeNull()
  })
})
