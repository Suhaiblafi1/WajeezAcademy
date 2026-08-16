/* محاكاة 12 شخصية — كل شخصية تُشغَّل مرتين للتحقق من الحتمية.
   تفشل المحاكاة عند: تجاوز 18 سؤالا في الوضع السريع، تكرار سؤال، أو اختلاف التشغيلين. */

import { runSession } from '../src/tests/diagnostic/helpers'
import { PERSONAS } from '../src/tests/diagnostic/personas'

let failures = 0
const rows: string[] = []

for (const [name, script] of PERSONAS) {
  const a = runSession(script)
  const b = runSession(script)

  const dup = new Set(a.askedOrder).size !== a.askedOrder.length
  const overCap = a.askedOrder.length > 18
  const recA = {
    kind: a.recommendation.kind,
    top: a.recommendation.primaryPathway?.pathwayId ?? null,
    tpl: a.recommendation.composite?.templateId ?? null,
    conf: a.recommendation.confidence.total,
  }
  const recB = {
    kind: b.recommendation.kind,
    top: b.recommendation.primaryPathway?.pathwayId ?? null,
    tpl: b.recommendation.composite?.templateId ?? null,
    conf: b.recommendation.confidence.total,
  }
  const nonDet =
    JSON.stringify(a.askedOrder) !== JSON.stringify(b.askedOrder) ||
    JSON.stringify(recA) !== JSON.stringify(recB)

  if (dup || overCap || nonDet) failures++
  const flags = [dup ? 'تكرار!' : '', overCap ? 'تجاوز18!' : '', nonDet ? 'لا-حتمية!' : '']
    .filter(Boolean)
    .join(' ')
  rows.push(
    [
      name,
      String(a.askedOrder.length),
      recA.kind,
      recA.top ?? '—',
      recA.tpl ?? '—',
      (recA.conf * 100).toFixed(0) + '٪',
      flags || '✓',
    ].join(' | '),
  )
}

console.log('\nشخصية | أسئلة | نوع | مسار أول | قالب | ثقة | حالة')
console.log('---')
for (const r of rows) console.log(r)
console.log('---')
if (failures > 0) {
  console.error(`فشلت ${failures} شخصية من ${PERSONAS.length}`)
  process.exit(1)
}
console.log(`نجحت المحاكاة: ${PERSONAS.length} شخصية، كل واحدة حتمية عبر تشغيلين.`)
