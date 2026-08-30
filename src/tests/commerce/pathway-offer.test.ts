/* عرض المسار قبل التسجيل — ثلاثة أرقام، كلٌّ منها وعدٌ تُطالَب به الفاتورة.

   قرار صاحب المنصّة: الزائر يرى المسار ودوراته كاملةً، ويبقى شيئان خلف
   التسجيل — من يدرّبه وأين يدفع. وفي مكانهما عرضٌ يقول له الرقم قبل أن يُطلب
   منه شيء: من كم تبدأ الدورة، وكم يكسب في أول شراء، وكم يكسب إن أخذ المسار.

   وخطر هذا القسم أنّه يَعِد بمال. فحُرس من ثلاث جهات:
     · «تبدأ من» تُقرأ من أرخص سعر قائمةٍ في الدورات المعروضة نفسها، لا من
       رقمٍ مكتوب في الصفحة — وسعرُ القائمة ترثه الشعبة (cohort.service.ts)
       فتُصدَر به الفاتورة.
     · لا تحويل عملة: العملة تُكتب كما تُصدَر بها الفاتورة. وقد أُزيلت من هذه
       المنصّة تسعيرةٌ مُختلَقة مرّة، ولا تعود.
     · المجموع لا يُعرض ناقصا: دورةٌ بلا سعر تُسقط المجموع كلّه إلى null،
       لأنّ مجموعا ناقصا يُقرأ كاملا. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathwayOffer, formatOfferPrice, PATHWAY_BUNDLE_MAX_PCT } from '../../application/commerce/pathway-offer'
import { FIRST_TIME_PROMO } from '../../application/commerce/first-time-promo'
import { pathwayCourses, pathwaySupportCourses, readyPathwayCourseIds, courseById } from '../../data/courses'

const CORE = JSON.parse(
  readFileSync(join(process.cwd(), 'src/data/catalog/core-catalog.v2.json'), 'utf8'),
) as { launch_pathways: { id: string }[]; courses: { course_id: string; list_price: number; list_currency: string }[] }

describe('عرض المسار', () => {
  it('«تبدأ من» أرخص دورة معروضة فعلا — لا رقم مكتوب', () => {
    for (const p of CORE.launch_pathways) {
      const ids = readyPathwayCourseIds(p.id)
      const offer = pathwayOffer(ids)
      const cheapest = Math.min(...ids.map((id) => courseById(id)?.listPrice ?? Infinity))
      expect(offer.fromPrice, p.id).toBe(cheapest)
      expect(offer.fromPrice, p.id).toBeGreaterThan(0)
    }
  })

  it('المجموع يشمل الأساسية والمساندة معا — وهي ما يراه على الشاشة', () => {
    for (const p of CORE.launch_pathways) {
      const core = pathwayCourses[p.id] ?? []
      const sup = (pathwaySupportCourses[p.id] ?? []).map((s) => s.courseId)
      const offer = pathwayOffer([...core, ...sup])
      const sum = [...core, ...sup].reduce((a, id) => a + (courseById(id)?.listPrice ?? 0), 0)
      expect(offer.fullPrice, p.id).toBe(sum)
    }
  })

  it('دورة بلا سعر تُسقط المجموع كلّه — لا مجموع ناقص يُقرأ كاملا', () => {
    const withUnknown = pathwayOffer([...(pathwayCourses['PW-COM-001'] ?? []), 'C-LA-YOUJAD'])
    expect(withUnknown.fullPrice).toBeNull()
    expect(withUnknown.fromPrice).toBeGreaterThan(0)
  })

  it('النسبتان من مصدرهما لا مكتوبتين في الصفحة', () => {
    const offer = pathwayOffer(pathwayCourses['PW-COM-001'] ?? [])
    expect(offer.firstTimePct).toBe(FIRST_TIME_PROMO.percentOff)
    expect(offer.bundleMaxPct).toBe(PATHWAY_BUNDLE_MAX_PCT)
  })

  it('العملة تُكتب كما تُصدَر بها الفاتورة — بلا تحويل', () => {
    expect(formatOfferPrice(125, 'USD')).toBe('$125')
    expect(formatOfferPrice(100, 'JOD')).toBe('100 د.أ')
    expect(formatOfferPrice(90, 'EUR')).toBe('90 EUR')
    expect(new Set(CORE.courses.map((c) => c.list_currency)).size).toBe(1)
  })
})

describe('بوابة التسجيل على صفحة المسار', () => {
  const SRC = readFileSync(join(process.cwd(), 'src/pages/Pathway.tsx'), 'utf8')

  it('الفريق التدريبي ومكان الدفع خلف التسجيل', () => {
    expect(SRC).toMatch(/\{user && \(\s*\n\s*<div id="trainers-reveal"/)
    expect(SRC).toMatch(/\{user && \(\s*\n\s*<div id="buy"/)
  })

  it('وعرض الزائر لا يظهر للمسجَّل', () => {
    expect(SRC).toMatch(/\{!user && \(\s*\n\s*<div id="offer"/)
  })

  it('شارة «اعتمده تشخيصك» محذوفة — لا مخفيّة', () => {
    expect(SRC).not.toMatch(/هذا المسار اعتمده تشخيصك — بُني/)
    expect(SRC).not.toMatch(/عد لنتيجتك لإعادة التخصيص/)
  })

  it('وبعد التسجيل يُنتقل إلى أوّل ما كان مخفيّا', () => {
    expect(SRC).toMatch(/getElementById\("trainers-reveal"\)\?\.scrollIntoView/)
  })
})
