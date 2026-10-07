/* سعرُ الدورة يطيع قاعدةَ الصعوبة والندرة — وكلُّ دورةٍ في الكتالوج تُفحص.

   الأسعارُ مكتوبةٌ رقما رقما في الكتالوج. لكنّ الطاعةَ بلا حارسٍ صدفةٌ تنتهي
   عند أوّل دورةٍ تُضاف: يكتب المؤلّفُ رقما بيده، فيصيبه أو يخطئه، ولا شيءَ
   يقول أيّهما فعل.

   وأخطرُ ما يمسكه هذا الفحصُ ليس خطأً في رقم، بل **قاعدةً تغيّرت ولم تُكتب**:
   لو قرّر صاحبُ المنصّة سعرا جديدا فغيّره في الكتالوج وحدَه، لَبقيت وحدةُ
   التسعير تعلن قاعدةً ماتت. فالفشلُ هنا يقول: إمّا السعرُ خطأ، وإمّا القاعدةُ
   تغيّرت فاكتبها في `course-pricing.ts`.

   والمقيسُ الخاصّيّةُ لا القيمة: أيَّ درجةٍ أُريدت لأيّ مستوًى أو مجال، يكفي
   أن يتّفق الإعلانُ مع الكتالوج، وأن يبقى المدى الذي أعلنه صاحبُ المنصّة
   (١٢٠–٢٢٥، قرارُ ٧ أكتوبر ٢٠٢٦) محفوظا، وأن يكون كلُّ خروجٍ عنه مسمّى بسببه. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  coursePrice, courseDomainCode, isPriceAllowed, LEVEL_DIFFICULTY, DOMAIN_RARITY,
  PRICE_BY_SCORE, COURSE_PRICE_RANGE, PRICE_EXCEPTIONS,
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

describe('سعرُ الدورة من صعوبتها وندرتها', () => {
  it('الكتالوجُ يُقرأ فعلا — الفحصُ ليس فارغا', () => {
    expect(CORE.courses.length).toBeGreaterThan(50)
  })

  it('كلُّ دورةٍ في الكتالوج تطيع القاعدة — لا استثناءَ غيرَ مسمّى', () => {
    const offenders: string[] = []
    for (const c of CORE.courses) {
      const expected = coursePrice(c.course_id, c.level_ar)
      if (expected !== c.list_price) {
        offenders.push(`${c.course_id}: «${c.level_ar}» ← ${c.list_price} والقاعدةُ تقول ${expected}`)
      }
    }
    expect(offenders, 'إمّا السعرُ خطأ، وإمّا القاعدةُ تغيّرت ولم تُكتب في course-pricing.ts').toEqual([])
  })

  it('ولا مستوًى ولا مجالَ في الكتالوج بلا درجةٍ معلنة — وإلّا فدورةٌ بلا سعرٍ محسوب', () => {
    const levels = new Set(Object.keys(LEVEL_DIFFICULTY))
    const domains = new Set(Object.keys(DOMAIN_RARITY))
    expect([...new Set(CORE.courses.map((c) => c.level_ar))].filter((l) => !levels.has(l)), 'مستوياتٌ بلا درجة').toEqual([])
    expect([...new Set(CORE.courses.map((c) => courseDomainCode(c.course_id)))].filter((d) => !domains.has(d)), 'مجالاتٌ بلا درجة').toEqual([])
  })

  it('والمدى المعلَن محفوظ — بين ١٢٠ و٢٢٥، وما خرج عنه مسمّى بسببه', () => {
    for (const c of CORE.courses) {
      expect(isPriceAllowed(c.course_id, c.list_price), `${c.course_id} ← ${c.list_price}`).toBe(true)
    }
    /* والقاعدةُ نفسُها لا تُخرج رقما خارج المدى مهما كانت الدرجتان */
    const maxScore = Math.max(...Object.values(LEVEL_DIFFICULTY)) + Math.max(...Object.values(DOMAIN_RARITY))
    expect(PRICE_BY_SCORE.length).toBe(maxScore + 1)
    expect(Math.min(...PRICE_BY_SCORE)).toBe(COURSE_PRICE_RANGE.min)
    expect(Math.max(...PRICE_BY_SCORE)).toBe(COURSE_PRICE_RANGE.max)
    for (const e of Object.values(PRICE_EXCEPTIONS)) expect(e.reasonAr.length).toBeGreaterThan(10)
  })

  it('والسعرُ يصعد مع الدرجة ولا ينزل — الأصعبُ أو الأندرُ لا يكون أرخص', () => {
    for (let i = 1; i < PRICE_BY_SCORE.length; i++) expect(PRICE_BY_SCORE[i]).toBeGreaterThan(PRICE_BY_SCORE[i - 1])
    expect(coursePrice('C-COMX-199', 'تأسيسي')).toBe(120)
    expect(coursePrice('C-CYB-199', 'ممارس')).toBe(225)
  })

  it('ومستوًى أو مجالٌ مجهول: لا سعرَ محسوب — ولا صفرٌ يُقرأ «مجّانا»', () => {
    expect(coursePrice('C-COMX-101', 'مستوًى لا وجود له')).toBeNull()
    expect(coursePrice('C-ZZZ-101', 'تأسيسي')).toBeNull()
    expect(coursePrice('C-COMX-101', '')).toBeNull()
  })

  it('والاستثناءُ لا يُسعِّر غيرَه، ولا يقبل سعرا غيرَ سعره', () => {
    for (const [id, e] of Object.entries(PRICE_EXCEPTIONS)) {
      expect(coursePrice(id, 'تأسيسي')).toBe(e.price)
      expect(isPriceAllowed(id, e.price - 1)).toBe(false)
    }
    expect(isPriceAllowed('C-COMX-101', 300)).toBe(false)
  })
})
