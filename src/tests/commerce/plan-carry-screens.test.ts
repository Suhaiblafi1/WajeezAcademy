/* خصمُ إكمال الخطّة على الشاشات — ما يُقال للمشتري، وما يُرسَل إلى الخادم (١٢ أكتوبر ٢٠٢٦).

   الحسابُ في `cart-pricing.ts` وحارسُه `plan-carry.test.ts`. وهنا ثلاثةٌ لو انكسرت
   لم يحمرّ حسابٌ ولا خادم:

   ① **الهديّةُ تُحبَس عن دفعةٍ لا تُكمل الخطّة** — وإلّا فُوترت بثمنها اليوم، ثمّ لا
      تعود هديّةً حين تكتمل الخطّة. والفحصُ على البنية: أنّ ما يُرسَل (`cohortIds`)
      يُرشَّح بها، لا أنّ جملتَها مكتوبة.
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

describe('① الهديّةُ تُحبَس عن دفعةٍ لا تُكمل الخطّة', () => {
  it('⚠️ تُحبَس في شراء الخطّة كاملةً حين بعضُها بلا شعبة — لا في كلّ شراء', () => {
    expect(PANEL).toMatch(/giftHeld\s*=\s*kind === "pathway" && giftCourseId !== null && withoutCohort\.length > 0/)
  })

  it('⚠️ وما يُرسَل إلى الخادم يُرشَّح بها — لا تُقال وحدَها', () => {
    const ids = PANEL.slice(PANEL.indexOf('const cohortIds = useMemo'), PANEL.indexOf('const cohortIds = useMemo') + 400)
    expect(ids, 'الهديّةُ المحبوسة تُرسَل مع الطلب').toMatch(/!\(giftHeld && line\.courseId === giftCourseId\)/)
  })

  it('وصفحةُ المسار تمرّر هديّةَ الخطّة إلى لوح شرائها كاملةً', () => {
    expect(PATHWAY).toMatch(/giftCourseId=\{checkout\.kind === "pathway" \? giftId : null\}/)
  })
})

describe('② وخصمُ الإكمال يُرى باسمه', () => {
  it('⚠️ بندٌ مستقلٌّ في تفصيل الحساب، مشروطٌ بوجوده', () => {
    expect(PANEL).toMatch(/quote\.planCredit > 0 && \([\s\S]{0,200}خصم إكمال خطّتك[\s\S]{0,120}quote\.planCredit/)
  })

  it('وما يُقال للمشتري اليومَ يقول الخصمَ المحفوظ بنسبته', () => {
    expect(PANEL).toMatch(/planPct = buildDiscountPct\(lines\.filter\(\(l\) => l\.courseId !== giftCourseId\)\.length\)/)
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
