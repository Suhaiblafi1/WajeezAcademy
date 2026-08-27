/* الوعد المعلن للمتعلم: خطة من ستة مقررات على الأكثر، يستبدل منها ويحذف،
 * وفوقها الهدية المجانية. وهذا الملف يحرس ذلك الوعد من جهتين انكسر منهما فعلا.
 *
 * ١) الخطة المركّبة كانت مسقوفة بالساعات (٨٠) وحدها، بلا سقف على العدد — فبلغت
 *    النسخة الكاملة ثمانية أو تسعة مقررات والموسّعة عشرة في القوالب الستة عشر
 *    كلها. لا قالب واحد كان يفي بالوعد.
 *
 * ٢) وكانت الصفحة تعرض خطتين متتاليتين تسمّي كلٌّ منهما نفسها «خطتك»، فيرى
 *    المتعلم ١٠–١١ بطاقة دورة، أربع أو خمس منها الدورات نفسها مكرّرة.
 *
 * والفحص الأول يقرأ القوالب من ملفها لا من قائمة تُنسى: قالب يُضاف غدا بمقررات
 * أكثر يسقط هنا قبل أن يصل إلى متعلم.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildCoursePlan } from '@/domain/diagnostic/composite'
import { TEMPLATE_THRESHOLDS } from '@/domain/diagnostic/config'
import { foldComposedPlan, COMPOSED_CARD_MIN_NOVEL } from '@/application/diagnostic/composed-fold'

const CAP = TEMPLATE_THRESHOLDS.max_plan_courses
const templates = JSON.parse(
  readFileSync('src/data/catalog/composite-templates.v1.json', 'utf8'),
).templates as Record<string, unknown>[]

describe('حجم الخطة المركّبة', () => {
  it('لا نسخة من أي قالب تتجاوز سقف المقررات — إلا بمقررات أساسية مرفوعة صراحة', () => {
    expect(templates.length, 'لم تُقرأ القوالب').toBeGreaterThan(10)

    const over: string[] = []
    for (const tpl of templates) {
      for (const variant of ['starter', 'full', 'extended'] as const) {
        const plan = buildCoursePlan(tpl as never, variant, [])
        if (plan.items.length <= CAP) continue
        /* التجاوز الوحيد المقبول: مقررات القالب الأساسية وحدها فوق السقف —
           لا يُقتطع أساسي بصمت، بل يُرفع ليُحسم في بيانات القالب. */
        if (plan.requiredOverCourseCap) continue
        over.push(`${String(tpl.template_id)} · ${variant} · ${plan.items.length} مقررا`)
      }
    }
    expect(over, `خطط تتجاوز ${CAP} مقررات بلا مبرر مرفوع`).toEqual([])
  })

  it('يرفع القالب الذي لا تفي بياناته بالسقف بدل أن يقتطع منه أساسيا بصمت', () => {
    const flagged = templates
      .filter((t) => buildCoursePlan(t as never, 'full', []).requiredOverCourseCap)
      .map((t) => String(t.template_id))
    /* TPL-ECOM-001 بسبعة مقررات أساسية — قرار محتوى لا قرار محرك. الفحص يثبت
       أن الحالة تُرفع لا تُخفى؛ وحين تُصلَح بياناته تصير القائمة فارغة ويبقى أخضر. */
    for (const id of flagged) {
      const plan = buildCoursePlan(templates.find((t) => t.template_id === id) as never, 'full', [])
      expect(plan.items.filter((i) => i.type !== 'required').length,
        `${id}: رُفع العلم ومع ذلك أُضيفت مقررات اختيارية فوق السقف`).toBe(0)
    }
  })

  it('نسخة البداية تبقى أصغر من الكاملة — وإلا فقدت معناها', () => {
    for (const tpl of templates) {
      const s = buildCoursePlan(tpl as never, 'starter', []).items.length
      const f = buildCoursePlan(tpl as never, 'full', []).items.length
      if (s === 0 || f === 0) continue
      expect(s, `${String(tpl.template_id)}: البداية ليست أصغر من الكاملة`).toBeLessThanOrEqual(f)
    }
  })
})

describe('طيّ الخطة المرتَّبة حين تكرّر ما عُرض', () => {
  const gaps = ['a', 'b', 'c']
  const plan = (ids: string[]) => ({ courses: ids.map((courseId) => ({ courseId })), coveredGaps: gaps })

  it('تُطوى حين تكون إعادة سرد للخطة المعروضة', () => {
    const shown = ['C1', 'C2', 'C3', 'C4', 'C5']
    const r = foldComposedPlan(plan(shown), shown)
    expect(r.showCard, 'عُرضت قائمة ثانية بالدورات نفسها').toBe(false)
    expect(r.gapNote, 'طُويت بلا أن تُحفظ قيمتها التفسيرية').toContain('3')
  })

  it('تُطوى أيضا حين تضيف مقررا واحدا فقط — مقرر لا يستحق صفّا ثانيا', () => {
    const shown = ['C1', 'C2', 'C3', 'C4', 'C5']
    expect(foldComposedPlan(plan([...shown, 'NEW']), shown).showCard).toBe(false)
  })

  it('تُعرض حين تضيف مقررين فأكثر — هنا تستحق مكانها', () => {
    const shown = ['C1', 'C2', 'C3']
    const r = foldComposedPlan(plan(['C1', 'N1', 'N2', 'N3']), shown)
    expect(r.showCard).toBe(true)
    expect(r.gapNote, 'ظهرت البطاقة وتكرّر معها السطر').toBeNull()
  })

  it('العتبة معلنة لا مبثوثة في الشيفرة', () => {
    const shown = ['C1']
    const novel = Array.from({ length: COMPOSED_CARD_MIN_NOVEL }, (_, i) => `N${i}`)
    expect(foldComposedPlan(plan([...shown, ...novel]), shown).showCard).toBe(true)
    expect(foldComposedPlan(plan([...shown, ...novel.slice(1)]), shown).showCard).toBe(false)
  })

  it('لا خطة ولا فجوات — لا بطاقة ولا سطر', () => {
    expect(foldComposedPlan(null, ['C1'])).toEqual({ showCard: false, gapNote: null })
    expect(foldComposedPlan({ courses: [{ courseId: 'C1' }], coveredGaps: [] }, ['C1']))
      .toEqual({ showCard: false, gapNote: null })
  })
})
