/* موجة ٦ · أ-٢ — تأليف سؤال قياس يفعّل وزن فجوة المهارة فعلا.

   الحقيقة التي تحميها هذه الاختبارات: مسار وزنُ فجوة المهارة فيه خامل تماما
   (صفر مهارة مقيسة) يصير له مهارة **حاسمة** بسؤال واحد يُؤلَّف من الإدارة —
   بلا نشر كود. وهذا مستحيل قبل ج-٢ لأن خطة الأسئلة كانت مولَّدة وقت البناء. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthError } from '../../services/auth.service'
import { CatalogAdminService } from '../../services/catalog-admin.service'

/* مسار صفري التغطية في الكتالوج المنشور، وrisk_management من مهاراته.
   كان PW-CYB-001 حتى 2026-08-26، ثم صار مغطّى بسؤال clear_expression الجديد
   (QB-M4-028) فلم يعد يصلح «حالة قبل». المسارات الصفرية الباقية التي يفتحها
   risk_management: PW-AUT-001 · PW-FIN-001 · PW-SCM-001 — واخترنا الأول.
   لو غُطّيت كلها لاحقا فهذا نجاح لا عطل: يُختار مسار صفري آخر ومهارته. */
const TARGET_PATHWAY = 'PW-AUT-001'
const SKILL = 'risk_management'
const QID = 'QB-M4-901'

let prisma: PrismaClient
let admin: CatalogAdminService

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  admin = new CatalogAdminService(prisma)
}, 180_000)

afterAll(async () => {
  const { installCatalogSnapshot } = await import('../../../src/domain/diagnostic/catalog')
  const { readFileSync } = await import('node:fs')
  const { join, dirname } = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
  const j = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'))
  /* إرجاع الحزمة المضمنة بلا تراكبات — كي لا يورّث هذا الملف قياسا اختباريا */
  installCatalogSnapshot({
    questions: j('src/data/catalog/questions.v1.ar.json'),
    skills: j('src/data/catalog/skills.v1.ar.json'),
    coreCatalog: j('src/data/catalog/core-catalog.v2.json'),
    templates: j('src/data/catalog/composite-templates.v1.json'),
    optionEffects: j('src/data/overlays/option-effects.v2.json'),
    pathwayProfiles: j('src/data/overlays/pathway-profiles.v1.json'),
  } as never, 'bundled-restored')
  await prisma.questionOption.deleteMany({ where: { questionId: QID } }).catch(() => {})
  await prisma.questionSkillLink.deleteMany({ where: { questionId: QID } }).catch(() => {})
  await prisma.questionVersion.deleteMany({ where: { questionId: QID } }).catch(() => {})
  await prisma.question.deleteMany({ where: { id: QID } }).catch(() => {})
})

describe('حراسة التأليف', () => {
  it('معرف بغير صيغة M4 يُرفض — الوحدة تحدد الطبقة والسطح', async () => {
    await expect(admin.createMeasurementQuestion({
      id: 'QB-M2-901', skillSlug: SKILL, textAr: 'نص طويل كافٍ لسؤال القياس هنا',
      decisionImpactAr: 'أثر قرار مكتوب بما يكفي من التفصيل',
    })).rejects.toThrow(AuthError)
  })

  it('مهارة غير مسجَّلة تُرفض — يُسأل المتعلم ولا يُحتسب جوابه', async () => {
    await expect(admin.createMeasurementQuestion({
      id: QID, skillSlug: 'skill_that_does_not_exist', textAr: 'نص طويل كافٍ لسؤال القياس هنا',
      decisionImpactAr: 'أثر قرار مكتوب بما يكفي من التفصيل',
    })).rejects.toThrow(AuthError)
  })

  it('مهارة موقوفة أو مدموجة تُرفض', async () => {
    await expect(admin.createMeasurementQuestion({
      id: QID, skillSlug: 'government_data_governance', textAr: 'نص طويل كافٍ لسؤال القياس هنا',
      decisionImpactAr: 'أثر قرار مكتوب بما يكفي من التفصيل',
    })).rejects.toThrow(AuthError)
  })

  it('أثر قرار غائب يُرفض — سؤال بلا أثر يصير متقاعدا في الخطة فلا يُطرح', async () => {
    await expect(admin.createMeasurementQuestion({
      id: QID, skillSlug: SKILL, textAr: 'نص طويل كافٍ لسؤال القياس هنا', decisionImpactAr: 'قصير',
    })).rejects.toThrow(AuthError)
  })
})

describe('الأثر الحقيقي: من وزنٍ خامل إلى مهارة حاسمة', () => {
  it('سؤال واحد يُؤلَّف من الإدارة يجعل المهارة مقيسة والمسار مغطّى', async () => {
    const cov = await import('../../../src/application/catalog/measurement-coverage')
    const { installCatalogSnapshot } = await import('../../../src/domain/diagnostic/catalog')
    const { buildSnapshotFromDb } = await import('../../catalog/snapshot-builder')
    const universe = await import('../../../src/domain/diagnostic/v2_1/universe')

    /* الحال قبل: المسار صفري التغطية، والمهارة فجوة تفتح مسارات */
    installCatalogSnapshot((await buildSnapshotFromDb(prisma)).payload as never, 'before-authoring')
    const before = cov.buildCoverageReport()
    const pBefore = before.pathways.find((p) => p.pathwayId === TARGET_PATHWAY)!
    expect(pBefore.measured).toBe(0)
    expect(pBefore.costAr).toContain('خامل')
    const gapBefore = before.gaps.find((g) => g.slug === SKILL)!
    expect(gapBefore.unlocks).toContain(TARGET_PATHWAY)
    expect(universe.measurableSkills().has(SKILL)).toBe(false)

    /* التأليف — مسودة لا تدخل المنشور */
    const created = await admin.createMeasurementQuestion({
      id: QID, skillSlug: SKILL,
      textAr: 'قيّم مستواك الحالي في إدارة المخاطر: تحديد الخطر وتقدير أثره واختيار استجابة.',
      decisionImpactAr: 'يدخل فجوة المهارة المقيسة ويفصل بين مسارات المخاطر والامتثال.',
    })
    expect(created.status).toBe('draft')
    expect(created.noteAr).toBeNull() // المهارة مربوطة بدورات فعلا

    /* المسودة لا تتسرّب: لقطة المنشور لا تراها */
    installCatalogSnapshot((await buildSnapshotFromDb(prisma)).payload as never, 'draft-not-leaked')
    expect(universe.measurableSkills().has(SKILL)).toBe(false)

    /* بعد النشر: اللقطة المرشّحة (approved) تحمله */
    await prisma.question.update({ where: { id: QID }, data: { status: 'published' } })
    await prisma.questionVersion.updateMany({ where: { questionId: QID }, data: { status: 'published' } })
    installCatalogSnapshot((await buildSnapshotFromDb(prisma)).payload as never, 'after-authoring')

    /* الأثر: المهارة صارت مقيسة، والمسار خرج من الصفر */
    expect(universe.measurableSkills().has(SKILL)).toBe(true)
    const after = cov.buildCoverageReport()
    const pAfter = after.pathways.find((p) => p.pathwayId === TARGET_PATHWAY)!
    expect(pAfter.measured).toBeGreaterThan(0)
    expect(pAfter.costAr).not.toContain('خامل')
    expect(after.totals.pathwaysZeroCoverage).toBeLessThan(before.totals.pathwaysZeroCoverage)
    /* وسؤال واحد أخرج كل ما كانت الفجوة تفتحه — لا مسارا واحدا */
    expect(before.totals.pathwaysZeroCoverage - after.totals.pathwaysZeroCoverage)
      .toBe(gapBefore.unlocks.length)

    /* والمهارة صارت **حاسمة** في الكيان لا مساندة — وهذا ما يفصل بين المرشحين */
    const entity = universe.recommendationUniverse().byId.get(TARGET_PATHWAY)!
    expect(entity.skill_roles.decisive).toContain(SKILL)
    expect(entity.diagnostic_skills).toContain(SKILL)
  })
})
