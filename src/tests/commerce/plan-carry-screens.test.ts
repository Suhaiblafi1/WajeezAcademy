/* خصمُ إكمال الخطّة على الشاشات — ما يُقال للمشتري، وما يُرسَل إلى الخادم (١٢ أكتوبر ٢٠٢٦).

   الحسابُ في `cart-pricing.ts` وحارسُه `plan-carry.test.ts`. وهنا ثلاثةٌ لو انكسرت
   لم يحمرّ حسابٌ ولا خادم:

   ① **ولا هديّةَ في الخطّة** — أُلغيت (٢٦ أكتوبر ٢٠٢٦)، فلا تظهر في شاشةٍ ولا تُرسَل.
   ② **وخصمُ الإكمال يُرى باسمه** في تفصيل الحساب — بندٌ لا يُدمج في خصم الباقة.
   ③ **والزرُّ في بوّابة المتعلّم يقول رقمَ الفاتورة** لا سعرَ الشعبة. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { plainAr } from '@/application/text/plain-ar'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
/* الشيفرةُ بلا تعليقاتها — فلا يمرّ حارسٌ بجملةٍ في تعليق */
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const PANEL = code('src/components/BuyPanel.tsx')
const PATHWAY = code('src/pages/Pathway.tsx')
const COHORT = code('src/components/BuyCohort.tsx')

/* ═══ ① ولا هديّةَ في الخطّة — أُلغيت (٢٦ أكتوبر ٢٠٢٦) ═══
   كانت «الهديّةُ تُحبَس عن دفعةٍ لا تُكمل الخطّة». ثمّ سأل صاحبُ المنصّة: «لماذا تظهر بعضُ الدورات وكأنّها هديّةٌ
   مجّانيّة ولا تطبَّق على الدفع؟.. أرجو إلغاءها لأنّنا أعطينا خصوماتٍ عالية». فلا تُعرض ولا تُحفظ ولا تُستحقّ
   (`cart.service.ts`). والفحصُ على الشيفرة بلا تعليقاتها، في كلّ شاشةٍ كانت تحملها. رُئي ساقطا على الشاشات القديمة. */
const SCREENS = [
  'src/components/BuyPanel.tsx', 'src/pages/Pathway.tsx', 'src/components/CourseJourney.tsx',
  'src/pages/diagnostic/ResultPlanCards.tsx', 'src/pages/Diagnostic.tsx', 'src/components/journey/StageOffer.tsx',
  'src/pages/advisor/LearnerPanel.tsx', 'src/data/siteContent.ts',
]
describe('① ولا هدية في الخطة', () => {
  it('⚠️ لا «هدية» يراها مشتر — في شارة ولا جملة ولا شرط', () => {
    for (const f of SCREENS) expect(code(f), f).not.toMatch(/هد[ّ]?ية/)
  })

  it('⚠️ ولا يرسل أي منها هدية ولا يحبسها ولا يطرحها من السعر', () => {
    for (const f of SCREENS) expect(code(f), f).not.toMatch(/\bgift(Id|CourseId|Held|Toggle)\b|onGiftToggle|isGift\s*\?/)
    expect(PATHWAY, 'سعر المسار يطرح هدية').toMatch(/readyPathwayPrice\(courseIds, null,/)
  })
})

describe('② وخصمُ الإكمال يُرى باسمه', () => {
  it('⚠️ بندٌ مستقلٌّ في تفصيل الحساب، مشروطٌ بوجوده', () => {
    expect(PANEL).toMatch(/quote\.planCredit > 0 && \([\s\S]{0,200}خصم إكمال خطّتك[\s\S]{0,120}quote\.planCredit/)
  })

  it('وما يُقال للمشتري اليومَ يقول الخصمَ المحفوظ بنسبته', () => {
    expect(PANEL).toMatch(/planPct = buildDiscountPct\(lines\.length\)/)
    expect(PANEL).toContain('محفوظ لك')
  })

  it('وبلا تشكيلٍ إعرابيّ — «اللغةُ البيضاء»', () => {
    for (const t of ['خصم إكمال خطّتك', 'خصم خطّتك كاملة', 'يشمل خصم إكمال خطّتك', 'ابدأ بما فتح الآن']) {
      expect(t).toBe(plainAr(t))
    }
  })
})

describe('③ والزرُّ في بوّابة المتعلّم يقول رقمَ الفاتورة', () => {
  it('⚠️ يُسأل الخادمُ عن الرقم، ويُعرض ما يقوله — وسعرُ الشعبة حين يتعذّر', () => {
    expect(COHORT).toMatch(/\/api\/learner\/checkout\/quote/)
    expect(COHORT).toMatch(/const amount = quote \? quote\.total : cohort\.amount/)
    expect(COHORT, 'الزرُّ يعرض سعرَ الشعبة لا المحسوب').toMatch(/convertFromUsd\(amount, currency\)/)
  })
})
