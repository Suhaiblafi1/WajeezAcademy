/* ج-٢ — التراكبات مولَّدة وقت النشر لا وقت بناء الواجهة.

   الحقيقة التي تحميها هذه الاختبارات: سؤال M4 يُضاف بعد النشر — يقيس مهارة
   جديدة — يصبح **مرئيا للمحرك**. قبل هذا البند كان يبقى خارج
   question-plan.v2_1.json فلا يُطرح أبدا، ومهارته تبقى «غير مقيسة» للأبد. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const j = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'))

const PROBE = {
  skillId: 'SK-X-OVL-001',
  slug: 'overlay_probe_skill',
  questionId: 'QB-M4-901',
  courseId: 'C-AI-101', // دورة منشورة داخل مسار منشور
}

let prisma: PrismaClient

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
}, 180_000)

/* الحالة عامة (روابط ES حية) — تُرجَّع للحزمة المضمنة كي لا يورَّث تراكبٌ اختباري */
afterAll(async () => {
  const { installQuestionMeta, installSkillLayers } = await import('../../../src/domain/diagnostic/v2/data')
  const { installQuestionPlan } = await import('../../../src/domain/diagnostic/v2_1/data')
  const { resetUniverseCache } = await import('../../../src/domain/diagnostic/v2_1/universe')
  installQuestionMeta(null)
  installSkillLayers(null)
  installQuestionPlan(null)
  resetUniverseCache()
  await prisma.questionSkillLink.deleteMany({ where: { questionId: PROBE.questionId } }).catch(() => {})
  await prisma.questionVersion.deleteMany({ where: { questionId: PROBE.questionId } }).catch(() => {})
  await prisma.question.deleteMany({ where: { id: PROBE.questionId } }).catch(() => {})
  await prisma.courseSkillLink.deleteMany({ where: { skillId: PROBE.skillId } }).catch(() => {})
  await prisma.skillVersion.deleteMany({ where: { skillId: PROBE.skillId } }).catch(() => {})
  await prisma.skill.deleteMany({ where: { id: PROBE.skillId } }).catch(() => {})
})

describe('اللقطة تحمل التراكبات المولّدة', () => {
  it('التراكبات الثلاثة موجودة وغير فارغة', async () => {
    const { buildSnapshotFromDb } = await import('../../catalog/snapshot-builder')
    const snap = await buildSnapshotFromDb(prisma)
    const p = snap.payload as {
      overlays: {
        questionMeta: { questions: Record<string, unknown> }
        skillLayers: { skills: Record<string, unknown> }
        questionPlan: { plan: Record<string, unknown> }
      }
    }
    expect(Object.keys(p.overlays.questionMeta.questions).length).toBeGreaterThan(100)
    expect(Object.keys(p.overlays.skillLayers.skills).length).toBeGreaterThan(300)
    expect(Object.keys(p.overlays.questionPlan.plan).length).toBeGreaterThan(100)
    expect(snap.counts.overlaySkills).toBe(Object.keys(p.overlays.skillLayers.skills).length)
  })

  it('المولَّد من الصفوف يطابق المولَّد من الملفات — لا محرّكان', async () => {
    const { buildSnapshotFromDb } = await import('../../catalog/snapshot-builder')
    const snap = await buildSnapshotFromDb(prisma)
    const p = snap.payload as {
      overlays: {
        questionMeta: { questions: Record<string, unknown> }
        skillLayers: { skills: Record<string, unknown> }
        questionPlan: { plan: Record<string, unknown> }
      }
    }
    const fileMeta = j('src/data/catalog/v2/question-meta.v2.json').questions
    const fileLayers = j('src/data/catalog/v2/skill-layers.v2.json').skills
    const filePlan = j('src/data/catalog/v2_1/question-plan.v2_1.json').plan

    /* أسئلة QC مؤلَّفة في الكود لا في القاعدة، فتوجد في الملف وحده — تُستثنى */
    const dbPlanKeys = Object.keys(p.overlays.questionPlan.plan)
    for (const id of dbPlanKeys) {
      expect(p.overlays.questionPlan.plan[id], `خطة ${id}`).toEqual(filePlan[id])
    }
    for (const id of Object.keys(p.overlays.questionMeta.questions)) {
      expect(p.overlays.questionMeta.questions[id], `ميتا ${id}`).toEqual(fileMeta[id])
    }
    for (const slug of Object.keys(p.overlays.skillLayers.skills)) {
      expect(p.overlays.skillLayers.skills[slug], `طبقات ${slug}`).toEqual(fileLayers[slug])
    }
  })

  it('المهارة المدموجة تبقى في الطبقات — إسقاطها يجعلها نشطة تشخيصيا', async () => {
    const { buildSnapshotFromDb } = await import('../../catalog/snapshot-builder')
    const snap = await buildSnapshotFromDb(prisma)
    const layers = (snap.payload as { overlays: { skillLayers: { skills: Record<string, { academic_status: string; active: boolean }> } } })
      .overlays.skillLayers.skills
    /* government_data_governance مؤرشفة في القاعدة (active=false) فلا تظهر في
       حمولة `skills`، لكنها **يجب** أن تظهر في الطبقات: isDiagnosticSkillActive
       تعتبر غير الموثقة نشطة، فغيابها انحدار صامت. */
    expect(layers['government_data_governance']).toBeDefined()
    expect(layers['government_data_governance'].academic_status).toBe('merged')
    expect(layers['government_data_governance'].active).toBe(false)

    const published = (snap.payload as { skills: { skills: { slug: string }[] } }).skills.skills
    expect(published.some((s) => s.slug === 'government_data_governance')).toBe(false)
  })
})

describe('سؤال يُضاف بعد النشر', () => {
  it('يدخل الخطة والميتا والطبقات ويصير مهارته مقيسة — وهو مستحيل من الملف المضمن', async () => {
    /* ١) مهارة جديدة مربوطة بدورة منشورة داخل مسار منشور */
    await prisma.skill.create({
      data: { id: PROBE.skillId, slug: PROBE.slug, nameAr: 'مهارة فحص التراكب', status: 'published' },
    })
    await prisma.courseSkillLink.create({ data: { courseId: PROBE.courseId, skillId: PROBE.skillId } })

    /* ٢) سؤال M4 منشور يقيسها بمقياس الدليل */
    await prisma.question.create({
      data: {
        id: PROBE.questionId, moduleId: 'M4', moduleName: 'أدلة المهارات',
        answerType: 'skill_level_5', optionsKey: null, personaScope: [],
        measures: [PROBE.slug], triggerCondition: 'always',
        reasonAr: 'يقيس مهارة فحص التراكب بمقياس الدليل — تغيّر الفجوة المقيسة.',
        sensitivityLevel: 'low', requiredLevel: 'core', weight: 1,
        active: true, status: 'published',
        versions: { create: { version: 1, textAr: 'ما مستواك في مهارة فحص التراكب؟', status: 'published' } },
      },
    })

    const { buildSnapshotFromDb } = await import('../../catalog/snapshot-builder')
    const { installCatalogSnapshot } = await import('../../../src/domain/diagnostic/catalog')
    /* ⚠ بلا تفكيك: تفكيك `export let` يجمّد القيمة لحظتها فلا يُرى التثبيت.
       الوصول عبر مساحة الوحدة هو ما يحفظ رابط ES الحيّ. */
    const v2data = await import('../../../src/domain/diagnostic/v2/data')
    const v21 = await import('../../../src/domain/diagnostic/v2_1/data')
    const { measurableSkills } = await import('../../../src/domain/diagnostic/v2_1/universe')

    /* الحزمة المضمنة لا تعرفه — هذا هو حال ما قبل ج-٢ */
    expect(v21.planOf(PROBE.questionId)).toBeUndefined()
    expect(measurableSkills().has(PROBE.slug)).toBe(false)

    /* ٣) تثبيت اللقطة الجديدة */
    const snap = await buildSnapshotFromDb(prisma)
    installCatalogSnapshot(snap.payload as never, 'overlay-probe')

    /* الخطة: سؤال M4 يأخذ افتراض وحدته — سطح B2C ونشط */
    const plan = v21.planOf(PROBE.questionId)
    expect(plan).toBeDefined()
    expect(plan!.surface).toBe('b2c')
    expect(plan!.final_status).toBe('active_b2c')
    expect(plan!.layer21).toBe('evidence_skill')

    /* الميتا: دليل مهاري */
    expect(v2data.questionMetaV2[PROBE.questionId]?.decision_impact).toBe('skill_evidence')

    /* الطبقات: مقيسة ومتطلب مسار في الوقت نفسه */
    const layer = v2data.skillLayersV2[PROBE.slug]
    expect(layer).toBeDefined()
    expect(layer.layers).toContain('diagnostic')
    expect(layer.layers).toContain('pathway_requirement')
    expect(layer.measured_by).toBe(PROBE.questionId)

    /* والنتيجة العملية: المحرك يعدّها مهارة قابلة للقياس.
       هذا يمرّ فقط لأن resetUniverseCache يُنادى عند التثبيت (كان موثقا بلا منادٍ). */
    expect(measurableSkills().has(PROBE.slug)).toBe(true)
  })
})
