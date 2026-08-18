/* اختبار الارتداد التشخيصي — الدليل الحاسم على الربط:
   يبني لقطة الكتالوج من قاعدة البيانات العلائقية، يثبتها في المحرك،
   ويقارن سلوك 12 شخصية (الأسئلة المطروحة بالترتيب + التوصية + الثقة)
   مع سلوك الحزمة المضمنة الأصلية. أي انحراف = فشل.
   تُحفظ النتيجة في DiagnosticRegressionRun للأثر التاريخي. */

import { getPrisma, disconnectPrisma } from '../server/db/client'
import { stopEmbeddedPostgres } from '../server/db/embedded'
import { buildSnapshotFromDb } from '../server/catalog/snapshot-builder'
import { installCatalogSnapshot, type CatalogSnapshotPayload } from '../src/domain/diagnostic/catalog'
import { runSession, type Script } from '../src/tests/diagnostic/helpers'
import { PERSONAS } from '../src/tests/diagnostic/personas'

interface RunSummary {
  askedOrder: string[]
  kind: string
  top: string | null
  tpl: string | null
  conf: number
}

const summarize = (script: Script): RunSummary => {
  const r = runSession(script)
  return {
    askedOrder: r.askedOrder,
    kind: r.recommendation.kind,
    top: r.recommendation.primaryPathway?.pathwayId ?? null,
    tpl: r.recommendation.composite?.templateId ?? null,
    conf: r.recommendation.confidence.total,
  }
}

/* المرحلة 1: الحزمة المضمنة (المرجع) */
const baseline = new Map(PERSONAS.map(([name, s]) => [name, summarize(s)]))

/* المرحلة 2: لقطة مبنية من قاعدة البيانات */
const prisma = await getPrisma()
const snap = await buildSnapshotFromDb(prisma)
console.log(`لقطة القاعدة: ${snap.counts.pathways} مسارا · ${snap.counts.courses} دورة · ${snap.counts.modules} وحدة · ${snap.counts.skills} مهارة · ${snap.counts.questions} سؤالا · ${snap.counts.templates} قالبا`)
console.log(`بصمة اللقطة: ${snap.hash.slice(0, 16)}…`)

installCatalogSnapshot(snap.payload as unknown as CatalogSnapshotPayload, 'db-regression')

let failures = 0
const results: { persona: string; match: boolean; kind: string; top: string | null; tpl: string | null }[] = []
for (const [name, script] of PERSONAS) {
  const after = summarize(script)
  const before = baseline.get(name)!
  const match = JSON.stringify(before) === JSON.stringify(after)
  if (!match) failures++
  results.push({ persona: name, match, kind: after.kind, top: after.top, tpl: after.tpl })
  console.log(`${match ? '✓' : '✗'} ${name} — ${after.kind} ${after.top ?? after.tpl ?? ''} (${(after.conf * 100).toFixed(0)}٪)`)
  if (!match) {
    console.log(`   مرجع: ${JSON.stringify({ kind: before.kind, top: before.top, tpl: before.tpl, conf: before.conf, asked: before.askedOrder.length })}`)
    console.log(`   قاعدة: ${JSON.stringify({ kind: after.kind, top: after.top, tpl: after.tpl, conf: after.conf, asked: after.askedOrder.length })}`)
  }
}

/* حفظ جولة الارتداد في القاعدة — أثر تاريخي */
await prisma.diagnosticRegressionRun.create({
  data: {
    results: JSON.parse(JSON.stringify({ snapshotHash: snap.hash, counts: snap.counts, results })),
    passed: failures === 0,
  },
})

await disconnectPrisma()
process.on('uncaughtException', (e) => {
  if (String(e).includes('terminat')) process.exit(failures === 0 ? 0 : 1)
  throw e
})
await stopEmbeddedPostgres()

if (failures > 0) {
  console.error(`\n❌ ارتداد: ${failures} شخصية انحرفت بين الحزمة المضمنة ولقطة القاعدة`)
  process.exit(1)
}
console.log(`\n✅ لا ارتداد: 12 شخصية متطابقة تماما بين الحزمة المضمنة ولقطة قاعدة البيانات`)
