/* خلاصةُ تشخيص العميل في بطاقة حالته — سطرٌ يقرؤه المستشار (١٩ أكتوبر ٢٠٢٦).

   كان السطرُ يعرض **رمزَ** المسار (`PW-FND-003`) لا اسمَه، ويضرب الثقةَ في مئة — وهي في
   النتيجة المحفوظة مئويّةٌ أصلا (`view-model.ts`: `Math.floor(total * 100)`)، فتُقرأ «٨٢٠٠٪».
   واللقطاتُ أشكال: نتيجةٌ كاملةٌ من التشخيص (`top` كائنٌ باسمه)، أو قديمةٌ (`pathwayId`
   وثقةٌ بين صفرٍ وواحد). فالاسمُ من اللقطة إن حملته، وإلّا من الكتالوج بمعرّفه، وإلّا المعرّف. */

import { pathwayById } from '../../data/pathways'

export function snapshotSummary(snap: unknown): string {
  if (!snap || typeof snap !== 'object') return 'لا لقطة تشخيص'
  const s = snap as Record<string, unknown>
  const inner = s.result as Record<string, unknown> | undefined
  const top = s.top ?? inner?.top
  const conf = s.confidence ?? inner?.confidence
  const topObj = top && typeof top === 'object' ? (top as Record<string, unknown>) : null
  const topId = typeof top === 'string'
    ? top
    : typeof topObj?.pathwayId === 'string' ? topObj.pathwayId
      : typeof topObj?.id === 'string' ? topObj.id
        : typeof s.pathwayId === 'string' ? s.pathwayId : null
  const name = typeof topObj?.name === 'string' ? topObj.name : topId ? pathwayById(topId)?.name ?? topId : null
  const pct = typeof conf === 'number' ? Math.round(conf <= 1 ? conf * 100 : conf) : null
  return [name ? `أبرز مسار: ${name}` : null, pct !== null ? `ثقة ${pct}٪` : null]
    .filter(Boolean).join(' · ') || 'لقطة محفوظة'
}
