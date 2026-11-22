/* «مسارٌ عامّ» `/go/BF80` — قاعدتُه في `src/application/commerce/private-path.ts` (٢٢ نوفمبر ٢٠٢٦).

   طلبُ صاحب المنصّة: الدوراتُ الثلاث في رابطٍ عامّ، يدخل صاحبُه أو ينشئ حسابا فيظهر باسمه. ثمّ قرارُه: لا استبدالَ ولا
   إضافةَ فيه — يختار من دوراته الثلاث واحدةً أو أكثر.

   ① **الرمزُ يُعرف بأيّ حالةٍ للحروف** — ولا يصطدم برموز المسارات الخاصّة (ثمانيةٌ عشوائيّة).
   ② **ولا استبدالَ ولا إضافةَ فيه** — والمسارُ الخاصّ باقٍ بهما.
   ③ **والاختيارُ من دوراته وحدَها، واحدةٌ على الأقلّ** — وبترتيب المسار. */

import { describe, expect, it } from 'vitest'
import {
  GO_CODE_LENGTH, PUBLIC_PATHS, isGoCode, pathEditable, publicPathOf, publicPathSelection,
} from '@/application/commerce/private-path'
import { BLACK_FRIDAY_GRANT_SLUG } from '@/application/commerce/grant'

const THREE = ['C-JOB-104', 'C-MGR-107', 'C-BIZ-107']

describe('① الرمز يعرف بأي حالة للحروف', () => {
  it('⚠️ BF80 بدوراته الثلاث وحملة بلاك فرايدي — وbf80 مثله', () => {
    for (const raw of ['BF80', 'bf80', ' Bf80 ']) {
      const def = publicPathOf(raw)
      expect(def?.code, raw).toBe('BF80')
      expect(def?.courseIds).toEqual(THREE)
      expect(def?.campaign).toBe(BLACK_FRIDAY_GRANT_SLUG)
      expect(isGoCode(raw), raw).toBe(true)
    }
    expect(publicPathOf('BF81')).toBeNull()
    expect(publicPathOf('toString')).toBeNull()
  })

  it('⚠️ ولا يصطدم برموز المسارات الخاصة — كل رمز عام أقصر من ثمانية', () => {
    for (const code of Object.keys(PUBLIC_PATHS)) expect(code.length).toBeLessThan(GO_CODE_LENGTH)
    expect(isGoCode('K6XLRYUF')).toBe(true)
  })
})

describe('② لا استبدال ولا إضافة في المسار العام', () => {
  it('⚠️ العام لا يعدل — والخاص يعدل', () => {
    expect(pathEditable(true)).toBe(false)
    expect(pathEditable(false)).toBe(true)
  })
})

describe('③ الاختيار من دوراته وحدها، واحدة على الأقل', () => {
  it('⚠️ واحدة أو اثنتان أو الثلاث — بترتيب المسار', () => {
    expect(publicPathSelection(THREE, ['C-BIZ-107'])).toEqual(['C-BIZ-107'])
    expect(publicPathSelection(THREE, ['C-BIZ-107', 'C-JOB-104'])).toEqual(['C-JOB-104', 'C-BIZ-107'])
    expect(publicPathSelection(THREE, THREE)).toEqual(THREE)
  })
  it('⚠️ ولا شيء أو دورة من خارجه لا يتابع به', () => {
    expect(publicPathSelection(THREE, [])).toBeNull()
    expect(publicPathSelection(THREE, ['C-JOB-104', 'C-OTHER-1'])).toBeNull()
  })
})
