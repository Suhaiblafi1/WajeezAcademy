/* خدمة تحليل الأثر — تشغّل الشخصيات الاثنتي عشرة على اللقطة المنشورة الحالية
   وعلى اللقطة المرشحة (المنشور + المعتمد)، وتقارن التوصيات حتميا.
   تعتمد على محرك التشخيص نفسه — لا محاكاة تقريبية. */

import type { PrismaClient } from '@prisma/client'
import { buildSnapshotFromDb } from '../catalog/snapshot-builder'
import { installCatalogSnapshot, type CatalogSnapshotPayload } from '../../src/domain/diagnostic/catalog'
import { runSession } from '../../src/tests/diagnostic/helpers'
import { PERSONAS } from '../../src/tests/diagnostic/personas'

export interface PersonaOutcome {
  name: string
  questions: number
  kind: string
  top: string | null
  tpl: string | null
  conf: number
}

export interface ImpactSummary {
  before: PersonaOutcome[]
  after: PersonaOutcome[]
  changed: { name: string; before: PersonaOutcome; after: PersonaOutcome }[]
  changedCount: number
  totalPersonas: number
}

/** يشغّل كل الشخصيات على الحالة الحالية للمحرك ويعيد النتائج */
function runCohort(): PersonaOutcome[] {
  return PERSONAS.map(([name, script]) => {
    const r = runSession(script)
    return {
      name,
      questions: r.askedOrder.length,
      kind: r.recommendation.kind,
      top: r.recommendation.primaryPathway?.pathwayId ?? null,
      tpl: r.recommendation.composite?.templateId ?? null,
      conf: r.recommendation.confidence.total,
    }
  })
}

const same = (a: PersonaOutcome, b: PersonaOutcome) =>
  a.kind === b.kind && a.top === b.top && a.tpl === b.tpl && Math.abs(a.conf - b.conf) < 1e-9

/** تحليل أثر كامل: لقطة منشورة حالية مقابل لقطة مرشحة تشمل المعتمد — ويعيد حالة المحرك كما كانت */
export async function analyzeImpact(prisma: PrismaClient, changeRef: string, actorId?: string): Promise<ImpactSummary & { runId: string }> {
  const publishedSnap = await buildSnapshotFromDb(prisma)
  const candidateSnap = await buildSnapshotFromDb(prisma, { extraStatuses: ['approved'] })

  installCatalogSnapshot(publishedSnap.payload as unknown as CatalogSnapshotPayload, 'impact-before')
  const before = runCohort()

  installCatalogSnapshot(candidateSnap.payload as unknown as CatalogSnapshotPayload, 'impact-after')
  const after = runCohort()

  /* إعادة المحرك إلى اللقطة المنشورة — التحليل لا يترك أثرا */
  installCatalogSnapshot(publishedSnap.payload as unknown as CatalogSnapshotPayload, 'impact-restored')

  const changed = before
    .map((b, i) => ({ name: b.name, before: b, after: after[i] }))
    .filter((x) => !same(x.before, x.after))

  const summary: ImpactSummary = { before, after, changed, changedCount: changed.length, totalPersonas: before.length }
  const run = await prisma.impactAnalysisRun.create({
    data: { changeRef, summary: summary as unknown as object, createdBy: actorId },
  })
  return { ...summary, runId: run.id }
}

/** تشغيل ارتداد للقطات المنشورة — يقارنها بالحزمة المضمنة ويحفظ DiagnosticRegressionRun */
export async function runRegressionAgainstBundled(prisma: PrismaClient, catalogVersionId?: string) {
  /* الحزمة المضمنة = إعادة التهيئة الافتراضية — نستورد وحدة جديدة المعزل؟
     بدلا من ذلك: نشغل على المضمن أولا (الحالة الافتراضية وقت الإقلاع لم تعد متاحة بعد install).
     الحل: نقرأ ملفات JSON ونبني حمولة مضمنة ثم نثبتها. */
  const { readFileSync } = await import('node:fs')
  const { join, dirname } = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
  const j = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'))
  const bundled = {
    questions: j('src/data/catalog/questions.v1.ar.json'),
    skills: j('src/data/catalog/skills.v1.ar.json'),
    coreCatalog: j('src/data/catalog/core-catalog.v2.json'),
    templates: j('src/data/catalog/composite-templates.v1.json'),
    optionEffects: j('src/data/overlays/option-effects.v2.json'),
    pathwayProfiles: j('src/data/overlays/pathway-profiles.v1.json'),
  }
  installCatalogSnapshot(bundled as unknown as CatalogSnapshotPayload, 'bundled')
  const bundledOut = runCohort()

  const dbSnap = await buildSnapshotFromDb(prisma)
  installCatalogSnapshot(dbSnap.payload as unknown as CatalogSnapshotPayload, 'db-published')
  const dbOut = runCohort()

  installCatalogSnapshot(bundled as unknown as CatalogSnapshotPayload, 'bundled-restored')

  const results = bundledOut.map((b, i) => ({ ...b, db: dbOut[i], match: same(b, dbOut[i]) }))
  const passed = results.every((r) => r.match)
  await prisma.diagnosticRegressionRun.create({
    data: { catalogVersionId: catalogVersionId ?? null, results: results as unknown as object, passed },
  })
  return { passed, results }
}
