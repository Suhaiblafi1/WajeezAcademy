/* قواعد تسعير المسار المبني من دورة واحدة، واقتراح ما يليها.

   العقد الذي تحرسه هذه الاختبارات مأخوذ من نصّ المالك حرفا:
   «لو انه اختار عدد دورات سعرهم اقل من سعر المسار كلياً.. لا يظهر له سعر
    المسار ويبقى فقط سعر الدوره او الدورات التي اختارها. عندما يصل لعدد دورات
    تكلفتهم اعلى او يساوي من سعر المسار لو اضاف دوره ..هنا نقول له ضيف دوره
    اخرى اضافيه والسعر الاجمالي سيكون كذا وهو اقل من مجموع دوراتك منفرده» */

import { describe, expect, it } from 'vitest'
import '../setup-catalog'
import { bundleNudge, pathPricing, suggestNext, BUNDLE_MIN_COURSES } from '../../application/catalog/course-path'
import { courses, coursePriceOf, courseById, pathwayCourses, pathwayPriceFor } from '../../data/courses'

const anyCourse = () => courses[0]!

describe('تسعير المسار المبني من دورة واحدة', () => {
  it('دورة واحدة: السعر سعرها منفردة ولا يُذكر سعر المسار', () => {
    const c = anyCourse()
    const p = pathPricing([c.id])
    expect(p.count).toBe(1)
    expect(p.separate).toBe(coursePriceOf(c))
    expect(p.payable).toBe(coursePriceOf(c))
    expect(p.useBundle, 'أظهر سعر الحزمة لدورة واحدة').toBe(false)
    expect(p.savingPct).toBe(0)
  })

  it('ما دام المجموع دون سعر الحزمة فالسعر هو المجموع — الحزمة لا تُعرض', () => {
    /* أرخص ثلاث دورات: مجموعها دون 500 حتما (السقف 180 للدورة) */
    const cheapest = [...courses].sort((a, b) => coursePriceOf(a) - coursePriceOf(b)).slice(0, 3)
    const p = pathPricing(cheapest.map((c) => c.id))
    expect(p.separate).toBeLessThan(p.bundle)
    expect(p.useBundle).toBe(false)
    expect(p.payable).toBe(p.separate)
  })

  it('حزمة لا تُطبّق تحت حدّها الأدنى — والكتالوج الحالي لا يبلغها بثلاث أصلا', () => {
    /* قياس: أغلى ثلاث دورات في الكتالوج مجموعها دون سعر الحزمة، فالحدّ الأدنى
       لا يُلمس بالأسعار الحالية. يبقى حارسا لو ارتفعت: «مسار» من ثلاث ليس
       مسارا، وتسعيره كذلك يبيع اسما لا محتوى. */
    const dearest = [...courses].sort((a, b) => coursePriceOf(b) - coursePriceOf(a)).slice(0, 3)
    const p = pathPricing(dearest.map((c) => c.id))
    expect(p.count).toBeLessThan(BUNDLE_MIN_COURSES)
    expect(p.separate, 'أغلى ثلاث دورات بلغت سعر الحزمة — راجع الحدّ الأدنى').toBeLessThan(p.bundle)
    expect(p.useBundle).toBe(false)
    expect(p.payable).toBe(p.separate)
  })

  it('الحارس نفسه: أيّ اختيار دون الحدّ الأدنى لا يأخذ سعر حزمة', () => {
    for (let n = 1; n < BUNDLE_MIN_COURSES; n++) {
      for (let start = 0; start + n <= Math.min(courses.length, 40); start += 7) {
        const p = pathPricing(courses.slice(start, start + n).map((c) => c.id))
        expect(p.useBundle, `${n} دورات من ${start}`).toBe(false)
        expect(p.payable).toBe(p.separate)
      }
    }
  })

  it('عند بلوغ المجموع سعر الحزمة أو تجاوزه: الحزمة هي السعر مع توفير معلن', () => {
    const dearest = [...courses].sort((a, b) => coursePriceOf(b) - coursePriceOf(a)).slice(0, 4)
    const p = pathPricing(dearest.map((c) => c.id))
    expect(p.count).toBe(4)
    expect(p.separate).toBeGreaterThanOrEqual(p.bundle)
    expect(p.useBundle).toBe(true)
    expect(p.payable).toBe(pathwayPriceFor(4))
    expect(p.savingPct).toBeGreaterThan(0)
  })

  it('السعر لا يقفز فوق سعر الحزمة أبدا بعد بلوغها', () => {
    const six = courses.slice(0, 6).map((c) => c.id)
    for (let n = BUNDLE_MIN_COURSES; n <= 6; n++) {
      const p = pathPricing(six.slice(0, n))
      expect(p.payable, `${n} دورات`).toBeLessThanOrEqual(Math.max(p.separate, p.bundle))
      if (p.useBundle) expect(p.payable).toBe(pathwayPriceFor(n))
    }
  })

  it('معرّف دورة غير موجود يُسقَط بلا انهيار', () => {
    const p = pathPricing(['LA-YOUJAD', anyCourse().id])
    expect(p.count).toBe(1)
  })
})

describe('تنبيه «دورة أخرى وتصير في السعر الأوفر»', () => {
  it('لا تنبيه وهو في الحزمة أصلا', () => {
    const dearest = [...courses].sort((a, b) => coursePriceOf(b) - coursePriceOf(a)).slice(0, 5)
    const ids = dearest.map((c) => c.id)
    expect(pathPricing(ids).useBundle).toBe(true)
    expect(bundleNudge(ids, courses.slice(0, 10).map((c) => c.id))).toBeNull()
  })

  it('لا تنبيه إن كانت الإضافة لا تبلغ حدّ الحزمة', () => {
    const cheapest = [...courses].sort((a, b) => coursePriceOf(a) - coursePriceOf(b))
    const ids = cheapest.slice(0, 1).map((c) => c.id)
    /* دورة واحدة + أرخص إضافة = دورتان: دون الحدّ الأدنى، فلا تنبيه */
    expect(bundleNudge(ids, cheapest.slice(1, 5).map((c) => c.id))).toBeNull()
  })

  it('عند ثلاث دورات وإضافة رابعة تبلغ الحزمة: تنبيه بأرقام صادقة', () => {
    const dearest = [...courses].sort((a, b) => coursePriceOf(b) - coursePriceOf(a))
    const ids = dearest.slice(0, 3).map((c) => c.id)
    const candidates = dearest.slice(3, 12).map((c) => c.id)
    const n = bundleNudge(ids, candidates)
    expect(n, 'لم يُنبَّه رغم أن الرابعة تبلغ الحزمة').not.toBeNull()
    expect(n!.nextCount).toBe(4)
    expect(n!.nextPayable).toBe(pathwayPriceFor(4))
    /* الوعد يُحسب بأرخص مرشح لا بأغلاه — وإلا كان عدّة لمن يختار غيرها */
    const cheapestCandidate = Math.min(...candidates.map((id) => coursePriceOf(courseById(id)!)))
    expect(n!.nextSeparate).toBe(pathPricing(ids).separate + cheapestCandidate)
    expect(n!.saves).toBe(n!.nextSeparate - n!.nextPayable)
    expect(n!.saves).toBeGreaterThan(0)
  })

  it('التنبيه بلا مرشحين = لا تنبيه', () => {
    const ids = courses.slice(0, 3).map((c) => c.id)
    expect(bundleNudge(ids, [])).toBeNull()
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
