/* اختبارات استيراد الكتالوج وبناء اللقطة — على قاعدة اختبار معزولة */

import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const j = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'))

let prisma: PrismaClient

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
}, 180_000)

describe('استيراد الكتالوج', () => {
  it('يطابق أعداد ملفات المصدر الموثقة', async () => {
    const core = j('src/data/catalog/core-catalog.v2.json')
    const questions = j('src/data/catalog/questions.v1.ar.json')
    const skills = j('src/data/catalog/skills.v1.ar.json')
    const templates = j('src/data/catalog/composite-templates.v1.json')

    expect(await prisma.pathway.count()).toBe(core.launch_pathways.length)
    expect(await prisma.course.count()).toBe(core.courses.length)
    expect(await prisma.courseModule.count()).toBe(core.modules.length)
    expect(await prisma.question.count()).toBe(questions.questions.length)
    expect(await prisma.skill.count()).toBe(skills.skills.length + (core.skill_extensions?.length ?? 0))
    expect(await prisma.compositeTemplate.count()).toBe(templates.templates.length)
  })

  /* ⚠ مهلة صريحة: هذا الاختبار يعيد استيراد الكتالوج كاملا (٤٠٠ وحدة و٣٠٠ مهارة)
     فيتجاوز مهلة vitest الافتراضية (٥ ثوان). كان يفشل بالمهلة لا بالمنطق —
     وفشلٌ زائف في CI أسوأ من لا CI، لأنه يعلّم القارئ تجاهل الأحمر. */
  it('idempotent — التشغيل الثاني لا يغير شيئا', { timeout: 120_000 }, async () => {
    const before = {
      p: await prisma.pathway.count(), c: await prisma.course.count(), q: await prisma.question.count(),
      v: await prisma.catalogVersion.count(), s: await prisma.catalogSnapshot.count(),
    }
    const { importCatalog } = await import('../../catalog/importer')
    await importCatalog(prisma)
    expect(await prisma.pathway.count()).toBe(before.p)
    expect(await prisma.course.count()).toBe(before.c)
    expect(await prisma.question.count()).toBe(before.q)
    expect(await prisma.catalogVersion.count()).toBe(before.v)
    expect(await prisma.catalogSnapshot.count()).toBe(before.s)
  })

  it('لا تكرار في course_id ولا مراجع مفقودة', async () => {
    const links = await prisma.pathwayCourse.findMany()
    const ids = new Set((await prisma.course.findMany({ select: { id: true } })).map((c) => c.id))
    for (const l of links) expect(ids.has(l.courseId), `مرجع مفقود ${l.courseId}`).toBe(true)
  })
})

describe('باني اللقطة', () => {
  it('يبني حمولة تطابق سلوك الحزمة المضمنة على 12 شخصية', async () => {
    const { buildSnapshotFromDb } = await import('../../catalog/snapshot-builder')
    const { installCatalogSnapshot } = await import('../../../src/domain/diagnostic/catalog')
    const { runSession } = await import('../../../src/tests/diagnostic/helpers')
    const { PERSONAS } = await import('../../../src/tests/diagnostic/personas')

    const snap = await buildSnapshotFromDb(prisma)
    expect(snap.counts.pathways).toBe(20)
    expect(snap.counts.courses).toBe(100)

    /* المضمن أولا */
    const bundled = {
      questions: j('src/data/catalog/questions.v1.ar.json'),
      skills: j('src/data/catalog/skills.v1.ar.json'),
      coreCatalog: j('src/data/catalog/core-catalog.v2.json'),
      templates: j('src/data/catalog/composite-templates.v1.json'),
      optionEffects: j('src/data/overlays/option-effects.v2.json'),
      pathwayProfiles: j('src/data/overlays/pathway-profiles.v1.json'),
    }
    const outcome = () => PERSONAS.map(([, script]) => {
      const r = runSession(script)
      return {
        asked: r.askedOrder, kind: r.recommendation.kind,
        top: r.recommendation.primaryPathway?.pathwayId ?? null,
        tpl: r.recommendation.composite?.templateId ?? null,
        conf: r.recommendation.confidence.total,
      }
    })

    installCatalogSnapshot(bundled as never, 'bundled')
    const a = outcome()
    installCatalogSnapshot(snap.payload as never, 'db')
    const b = outcome()
    installCatalogSnapshot(bundled as never, 'bundled-restored')

    expect(JSON.stringify(b)).toBe(JSON.stringify(a))
  })

  it('اللقطة الفعالة = أحدث إصدار منشور', async () => {
    const { getActiveSnapshot } = await import('../../catalog/snapshot-builder')
    const active = await getActiveSnapshot(prisma)
    expect(active).not.toBeNull()
    expect(active!.label).toBe('catalog-v2.0-import')
  })
})
