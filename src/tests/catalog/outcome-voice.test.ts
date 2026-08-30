/* مخرجات التعلّم: وعدٌ محدّد لا قالبٌ بخانةٍ مُبدَّلة.

   كانت ١٧٩ من ٤٠٤ مخرَجا (٤٤٪) مكتوبةً بثلاثة قوالب:
     «يحلل [س] في حالة مهنية ويحدد الافتراضات والقرار المطلوب.»   ×٦٠
     «يقيّم [س] وفق معايير واضحة ويصحح الخلل في مثال معطى.»        ×٦٠
     «ينتج [س]. ويبرر قراراته بالبيانات أو الأدلة المناسبة.»       ×٥٩

   وثلاث دورات متتالية في مسار الأتمتة كانت تقول الجملة نفسها حرفيا بتبديل
   «العملية الحالية» بـ«Triggers وActions» بـ«تصميم التدفق». والمتعلّم يقرؤها
   خمس مرات في خطّته الواحدة، فيفهم — بحقّ — أنها مولَّدة.

   وضررها أبعد من الشكل: قِيس بها تشابهُ محتوى الدورات في تحليل الدمج فأعطى
   ٤٧٪ تشابها بين «تحليل السبب الجذري» و«استراتيجيات التفاوض» — لأن المقياس
   كان يقرأ القالب لا المحتوى.

   أُعيد تأليفها كلها في 2026-08-30 على نسق ما كان مكتوبا جيدا أصلا في
   C-MGR-104 وC-DAT-104: فعلٌ ملموس + مفعولٌ محدّد + شرطٌ يُختبر. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const CORE = JSON.parse(
  readFileSync(join(process.cwd(), 'src/data/catalog/core-catalog.v2.json'), 'utf8'),
) as { courses: { course_id: string; learning_outcomes_ar: string[] }[] }

const outcomes = CORE.courses.flatMap((c) =>
  c.learning_outcomes_ar.map((text) => ({ courseId: c.course_id, text })),
)
const norm = (t: string) => t.replace(/[ً-ْـ]/g, '').replace(/\s+/g, ' ').trim()

describe('نبرة مخرجات التعلّم', () => {
  it('الشجرة تُقرأ فعلا — وإلا كان الحارس يخضرّ على فراغ', () => {
    expect(outcomes.length).toBeGreaterThan(350)
  })

  /* الحشو المعروف: عباراتٌ تملأ الجملة ولا تَعِد بشيء يُلاحظ */
  const FILLER = [
    'في حالة مهنية ويحدد الافتراضات والقرار المطلوب',
    'وفق معايير واضحة ويصحح الخلل في مثال معطى',
    'ويبرر قراراته بالبيانات أو الأدلة المناسبة',
  ]
  it.each(FILLER)('لا مخرَج يحمل الحشو: «%s»', (phrase) => {
    const hits = outcomes.filter((o) => norm(o.text).includes(phrase))
    expect(hits.map((h) => h.courseId), `${hits.length} مخرَجا يحمل الحشو`).toEqual([])
  })

  /* الحارس البنيويّ: لا قالبَ جديد يتسلّل. البصمة = أوّل كلمة + آخر أربع،
     فتكشف الجملة المكرّرة مهما تغيّرت خانتها الوسطى. */
  it('لا نمط يتكرّر في خمس دورات فأكثر', () => {
    const fp = (t: string) => {
      const w = norm(t).split(' ')
      return w.length >= 5 ? `${w[0]} … ${w.slice(-4).join(' ')}` : norm(t)
    }
    const byPattern = new Map<string, Set<string>>()
    for (const o of outcomes) {
      const k = fp(o.text)
      if (!byPattern.has(k)) byPattern.set(k, new Set())
      byPattern.get(k)!.add(o.courseId)
    }
    const repeated = [...byPattern.entries()]
      .filter(([, ids]) => ids.size >= 5)
      .map(([k, ids]) => `«${k}» في ${ids.size} دورة`)
    expect(repeated, `أنماط متكرّرة: ${repeated.join(' · ')}`).toEqual([])
  })
})
