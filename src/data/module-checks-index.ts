/* فهرس نصوص أسئلة الاسترجاع (البند ح-٤) — يبني خريطة «معرّف الوحدة#ترتيب السؤال»
   إلى نصّ السؤال من الكتالوج المنشور نفسه الذي يقرأه المتعلم في صفحة الدورة.

   لهذا لا يرسل الخادم نصوص الأسئلة مع البطاقات: مصدر واحد للنصّ فلا تتباعد
   نسخة الخادم عن نسخة الشاشة، ولا يظهر سؤال محفوظ بصيغة قديمة بعد تعديل معتمد.

   ⚠ الكتالوج يُحمَّل كسولا (ع-١): تُستدعى هذه الدالة داخل useMemo مرتبط بنسخة
   الكتالوج، لا مرة واحدة عند تحميل الوحدة — وإلا بُنيت الخريطة فارغة. */

import { courses, courseFullById } from './courses'
import { parseChecks } from '../application/content/module-checks'

export interface CheckText {
  promptAr: string
  options: string[]
  correctIndex: number
  explainAr: string | null
  moduleTitleAr: string | null
  courseTitleAr: string | null
}

/** المفتاح الموحَّد للبطاقة — نفس ما يستعمله الخادم في القيد الفريد */
export function cardKey(moduleId: string, checkIndex: number): string {
  return `${moduleId}#${checkIndex}`
}

export function buildCheckTextIndex(): Map<string, CheckText> {
  const out = new Map<string, CheckText>()
  /* courses هي الفهرس المختصر؛ الوحدات تأتي من courseFullById بنفس المصدر */
  for (const brief of courses) {
    const c = courseFullById(brief.id)
    if (!c) continue
    for (const m of c.modules) {
      if (!m.checks) continue
      const { checks } = parseChecks(m.checks)
      checks.forEach((q, i) => {
        out.set(cardKey(m.id, i), {
          promptAr: q.promptAr,
          options: q.options,
          correctIndex: q.correctIndex,
          explainAr: q.explainAr,
          moduleTitleAr: m.title,
          courseTitleAr: c.title,
        })
      })
    }
  }
  return out
}
