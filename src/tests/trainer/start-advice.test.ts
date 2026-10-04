/* نصيحةُ البدء — ديسمبر، أو أواخرَ نوفمبر على الأقلّ (٤ أكتوبر ٢٠٢٦).

   قال صاحبُ المنصّة: «انصح كلَّ مدرّبٍ أن يبدأ تدريبَه في ديسمبر أو أواخرَ نوفمبر
   على الأقلّ — نصيحةً فقط — كي يتّسع لنا الوقتُ لتسويق دوراته… واجعلها ودودةً
   جدّا». والعلّةُ كاملةً في رأس `src/application/trainer/start-advice.ts`. */

import { describe, expect, it } from 'vitest'
import { START_ADVICE, START_ADVICE_AR, startAdvice } from '@/application/trainer/start-advice'

const TODAY = '2026-10-04'

describe('نصيحةُ البدء تقول ما يناسب ما اختاره', () => {
  it('قبل أن يختار: تقترح', () => {
    expect(startAdvice(null, TODAY)).toBe('ask')
    expect(startAdvice('', TODAY)).toBe('ask')
  })

  it('⚠️ وأبكرُ من أواخر نوفمبر: تذكّر بلطف — واليومُ الذي قبل الحدّ منه', () => {
    expect(startAdvice('2026-10-18', TODAY)).toBe('early')
    expect(startAdvice('2026-11-21', TODAY)).toBe('early')
  })

  it('⚠️ ومن أواخر نوفمبر فما بعد: تشكر', () => {
    expect(startAdvice(START_ADVICE.lateNovember, TODAY)).toBe('thanks')
    expect(startAdvice('2026-12-06', TODAY)).toBe('thanks')
  })

  it('⚠️ ولهذا الموسم وحدَه: إذا حلّ ديسمبر سكتت', () => {
    expect(startAdvice(null, '2026-11-30')).toBe('ask')
    expect(startAdvice(null, START_ADVICE.december)).toBeNull()
    expect(startAdvice('2026-12-10', '2026-12-05')).toBeNull()
  })
})

describe('ونصُّها ودود', () => {
  it('⚠️ يسمّي ديسمبر وأواخرَ نوفمبر، ويقول لماذا — والقرارُ للمدرّب', () => {
    for (const k of ['ask', 'early'] as const) {
      expect(START_ADVICE_AR[k], k).toContain('ديسمبر')
      expect(START_ADVICE_AR[k], k).toContain('أواخر نوفمبر')
      expect(START_ADVICE_AR[k], k).toMatch(/نسوّق/)
    }
    expect(START_ADVICE_AR.early).toContain('ولك ذلك')
    expect(START_ADVICE_AR.early).toContain('والقرارُ قرارُك')
  })

  it('ولا أمرَ فيها ولا منع', () => {
    for (const text of Object.values(START_ADVICE_AR)) {
      expect(text).not.toMatch(/يجب|لا يُسمح|ممنوع|إلزاميّ|لا يمكن/)
    }
  })
})
