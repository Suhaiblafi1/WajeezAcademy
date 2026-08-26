/* موجة ٦ · أ-٢ — تأليف سؤال قياس يفعّل وزن فجوة المهارة فعلا.

   الحقيقة التي تحميها هذه الاختبارات: مهارة لا يقيسها سؤال تصير **حاسمة**
   في مسارها بسؤال واحد يُؤلَّف من الإدارة — بلا نشر كود. وهذا مستحيل قبل ج-٢
   لأن خطة الأسئلة كانت مولَّدة وقت البناء. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthError } from '../../services/auth.service'
import { CatalogAdminService } from '../../services/catalog-admin.service'

/* مسار في الكتالوج المنشور، ومهارة من مهاراته لم تُقَس بعد.

   كان هذا التثبيت يشترط مسارا **صفري التغطية**، وسقط ثلاث مرات في
   2026-08-26 — في كل مرة لأن التغطية تحسّنت حتى لم يبقَ مسار خامل واحد
   (كل المسارات العشرين صار فيها مهارة مقيسة). فالشرط القديم صار يقيس حالة
   نقص في الكتالوج بدل أن يقيس القدرة التي وُجد الاختبار لحراستها.

   فأُعيدت صياغته على الخاصية الدائمة: تأليف سؤال يرفع تغطية المسار **ويجعل
   المهارة حاسمة**. يعمل هذا على أي مسار ومهارة غير مقيسة، فلا يبطله تحسّن
   التغطية بعد اليوم. لو قِيست workforce_planning لاحقا فاختر أي مهارة أخرى
   من `PW-HR-001` غير مقيسة — والقائمة تُستخرج بـ`measurableSkills()`. */
const TARGET_PATHWAY = 'PW-HR-001'
const SKILL = 'workforce_planning'
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

describe('الأثر الحقيقي: من مهارة غير مقيسة إلى مهارة حاسمة', () => {
  it('سؤال واحد يُؤلَّف من الإدارة يجعل المهارة مقيسة وحاسمة ويرفع تغطية المسار', async () => {
    const cov = await import('../../../src/application/catalog/measurement-coverage')
    const { installCatalogSnapshot } = await import('../../../src/domain/diagnostic/catalog')
    const { buildSnapshotFromDb } = await import('../../catalog/snapshot-builder')
    const universe = await import('../../../src/domain/diagnostic/v2_1/universe')

    /* الحال قبل: المسار صفري التغطية، والمهارة فجوة تفتح مسارات */
    installCatalogSnapshot((await buildSnapshotFromDb(prisma)).payload as never, 'before-authoring')
    const before = cov.buildCoverageReport()
    const pBefore = before.pathways.find((p) => p.pathwayId === TARGET_PATHWAY)!
    expect(universe.measurableSkills().has(SKILL)).toBe(false)
    expect(universe.recommendationUniverse().byId.get(TARGET_PATHWAY)!.skill_roles.decisive)
      .not.toContain(SKILL)

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
    expect(pAfter.measured).toBe(pBefore.measured + 1)
    /* ولا مسار يتراجع بسبب سؤال يُضاف */
    expect(after.totals.pathwaysZeroCoverage).toBeLessThanOrEqual(before.totals.pathwaysZeroCoverage)
    expect(after.totals.measuredSkills).toBe(before.totals.measuredSkills + 1)

    /* والمهارة صارت **حاسمة** في الكيان لا مساندة — وهذا ما يفصل بين المرشحين */
    const entity = universe.recommendationUniverse().byId.get(TARGET_PATHWAY)!
    expect(entity.skill_roles.decisive).toContain(SKILL)
    expect(entity.diagnostic_skills).toContain(SKILL)
  })
})
