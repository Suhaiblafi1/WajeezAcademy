/* قواعد تسعير المسار المبني من دورة واحدة، واقتراح ما يليها.

   العقد تراكمي بنصّ المالك: «يظهر سعر كل دورة · يظهر إجمالي السعر قبل الخصم ·
   يرتفع خصم المسار كلما أضاف المستخدم دورة وفق سياسة خصم محددة مسبقًا ·
   يظهر بجانب الإجمالي: نسبة الخصم، قيمة التوفير، والسعر النهائي». وسقفه خمس
   دورات، وما زاد يُحفظ للمرحلة التالية.

   وحارسان لا يظهران في أي شاشة ولكن كسرُهما يفسد المنتج كله:
   ألا يكون البناءُ الحر أغلى من المسار الجاهز بالعدد نفسه — وإلا عُوقب من
   اختار لنفسه؛ وألا تخفض إضافةُ دورةٍ الإجماليَّ — وإلا صار السلّم بابا
   لسعرٍ سالب. كلاهما مقيس على الكتالوج كله لا على مثال. */

import { describe, expect, it } from 'vitest'
import '../setup-catalog'
import { bundleNudge, pathPricing, suggestNext, MAX_BUILT_COURSES } from '../../application/catalog/course-path'
import { buildDiscountPct, nextBuildStep } from '../../application/commerce/discount-policy'
import { courses, coursePriceOf, courseById, pathwayCourses, pathwayPriceFor } from '../../data/courses'

const anyCourse = () => courses[0]!
const byPrice = (dir: 1 | -1) => [...courses].sort((a, b) => dir * (coursePriceOf(a) - coursePriceOf(b)))
const cheapestId = (ids: readonly string[]) =>
  ids.reduce((best, id) => (coursePriceOf(courseById(id)!) < coursePriceOf(courseById(best)!) ? id : best), ids[0])

describe('سلّم خصم البناء', () => {
  it('دورة واحدة بلا خصم — الخصم مكافأة تركيب لا هدية', () => {
    expect(buildDiscountPct(1)).toBe(0)
    const c = anyCourse()
    const p = pathPricing([c.id])
    expect(p.separate).toBe(coursePriceOf(c))
    expect(p.payable).toBe(coursePriceOf(c))
    expect(p.discountPct).toBe(0)
    expect(p.saving).toBe(0)
  })

  it('يرتفع مع كل دورة حتى السقف ثم يثبت', () => {
    for (let n = 2; n <= MAX_BUILT_COURSES; n++) {
      expect(buildDiscountPct(n), `${n} دورات`).toBeGreaterThan(buildDiscountPct(n - 1))
    }
    /* ما فوق السقف لا يُبنى أصلا، فنسبته نسبتُه — لا صفرا يقلب السعر */
    expect(buildDiscountPct(MAX_BUILT_COURSES + 3)).toBe(buildDiscountPct(MAX_BUILT_COURSES))
  })

  it('السقف خمس دورات، ويُعلَن في التسعير نفسه', () => {
    expect(MAX_BUILT_COURSES).toBe(5)
    const ids = courses.slice(0, 5).map((c) => c.id)
    expect(pathPricing(ids.slice(0, 4)).atCap).toBe(false)
    expect(pathPricing(ids).atCap).toBe(true)
    expect(nextBuildStep(MAX_BUILT_COURSES)).toBeNull()
  })
})

describe('حارسا التسعير — على الكتالوج كله', () => {
  it('البناء الحر لا يتجاوز سعر المسار الجاهز بالعدد نفسه', () => {
    /* أغلى ما يمكن اختياره: إن نجا هذا نجا كل ما دونه */
    const dearest = byPrice(-1)
    for (let n = 1; n <= MAX_BUILT_COURSES; n++) {
      const p = pathPricing(dearest.slice(0, n).map((c) => c.id))
      expect(p.payable, `${n} دورات: البناء الحر أغلى من المسار الجاهز`).toBeLessThanOrEqual(pathwayPriceFor(n))
    }
  })

  it('إضافة دورة لا تخفض الإجمالي أبدا — بأي خليط من أرخص وأغلى', () => {
    const mixes = [byPrice(1), byPrice(-1), [...byPrice(-1).slice(0, 4), ...byPrice(1).slice(0, 4)]]
    for (const mix of mixes) {
      for (let n = 2; n <= MAX_BUILT_COURSES; n++) {
        const before = pathPricing(mix.slice(0, n - 1).map((c) => c.id)).payable
        const after = pathPricing(mix.slice(0, n).map((c) => c.id)).payable
        expect(after, `${n} دورات: الإضافة خفضت الإجمالي`).toBeGreaterThan(before)
      }
    }
  })

  it('التوفير المعلن يساوي الفرق فعلا، والمدفوع صحيح لا كسر', () => {
    const ids = byPrice(-1).slice(0, 4).map((c) => c.id)
    const p = pathPricing(ids)
    expect(p.saving).toBe(p.separate - p.payable)
    expect(Number.isInteger(p.payable)).toBe(true)
    /* النسبة مشتقّة مما يدفع: تساوي السلّم أو تفوقه حين يحسم سقف المسار الجاهز */
    expect(p.discountPct).toBeGreaterThanOrEqual(buildDiscountPct(4))
  })

  it('معرّف دورة غير موجود يُسقَط بلا انهيار', () => {
    const p = pathPricing(['LA-YOUJAD', anyCourse().id])
    expect(p.count).toBe(1)
  })
})

describe('تنبيه «دورة أخرى ترفع خصمك»', () => {
  it('لا تنبيه عند السقف', () => {
    const ids = courses.slice(0, MAX_BUILT_COURSES).map((c) => c.id)
    expect(pathPricing(ids).atCap).toBe(true)
    expect(bundleNudge(ids, courses.slice(10, 20).map((c) => c.id))).toBeNull()
  })

  it('لا تنبيه بلا مرشحين', () => {
    expect(bundleNudge([anyCourse().id], [])).toBeNull()
  })

  it('أرقامه تصدق على أرخص مرشح — لا على أغلاه', () => {
    const dearest = byPrice(-1)
    const ids = dearest.slice(0, 2).map((c) => c.id)
    const candidates = dearest.slice(2, 12).map((c) => c.id)
    const n = bundleNudge(ids, candidates)
    expect(n, 'لم يُنبَّه رغم أن الثالثة ترفع الخصم').not.toBeNull()
    const cheapest = Math.min(...candidates.map((id) => coursePriceOf(courseById(id)!)))
    expect(n!.listPrice).toBe(cheapest)
    expect(n!.nextCount).toBe(3)
    expect(n!.nextSeparate).toBe(pathPricing(ids).separate + cheapest)
    expect(n!.nextPayable).toBe(pathPricing([...ids, cheapestId(candidates)]).payable)
  })

  it('الكلفة الحقيقية للإضافة دون سعرها المعلن — وهو كل ما يَعِد به', () => {
    const dearest = byPrice(-1)
    for (let n = 1; n < MAX_BUILT_COURSES; n++) {
      const ids = dearest.slice(0, n).map((c) => c.id)
      const nudge = bundleNudge(ids, dearest.slice(n, n + 10).map((c) => c.id))
      if (!nudge) continue
      expect(nudge.marginal, `${n} دورات`).toBeLessThan(nudge.listPrice)
      expect(nudge.marginal, 'الإضافة بلا كلفة أو بكلفة سالبة').toBeGreaterThan(0)
    }
  })
})

describe('اقتراح ما يلي الدورة', () => {
  it('يبدأ ببقية مسار الدورة الأولى بترتيبه المصمَّم', () => {
    const anchor = courses.find((c) => (pathwayCourses[c.pathwayId] ?? []).length >= 3)!
    const s = suggestNext([anchor.id], 12)
    const sameP = (pathwayCourses[anchor.pathwayId] ?? []).filter((id) => id !== anchor.id)
    expect(s.length).toBeGreaterThan(0)
    /* أول المقترحات من مسار الدورة نفسها وبترتيب المسار */
    const firstFromPathway = s.filter((x) => sameP.includes(x.courseId)).map((x) => x.courseId)
    expect(firstFromPathway).toEqual(sameP.filter((id) => firstFromPathway.includes(id)))
    expect(s[0].rank).toBe(1)
  })

  it('لا يقترح ما اختير أصلا ولا يكرر مقررا', () => {
    const anchor = courses.find((c) => (pathwayCourses[c.pathwayId] ?? []).length >= 3)!
    const chosen = (pathwayCourses[anchor.pathwayId] ?? []).slice(0, 3)
    const s = suggestNext(chosen, 20)
    for (const x of s) expect(chosen).not.toContain(x.courseId)
    expect(new Set(s.map((x) => x.courseId)).size).toBe(s.length)
  })

  it('كل اقتراح يحمل سببا غير فارغ', () => {
    const s = suggestNext([anyCourse().id], 8)
    for (const x of s) expect(x.reason_ar.trim().length).toBeGreaterThan(8)
  })

  it('دورة غير موجودة لا تنتج اقتراحات', () => {
    expect(suggestNext(['LA-YOUJAD'])).toEqual([])
  })
})
