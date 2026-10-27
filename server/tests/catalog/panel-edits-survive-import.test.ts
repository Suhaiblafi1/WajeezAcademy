/* ما ضبطته اللوحةُ من مهارات الدورة وترشيحِها وحدَها لا يعيده النشرُ التالي (٢٦ أكتوبر ٢٠٢٦، المرحلة الثامنة).

   كلُّ نشرٍ يستورد `core-catalog.v2.json` (`deploy.sh`: `catalog:import` ثمّ `catalog:publish`). وكان المستوردُ يعيد روابطَ
   المهارات من الملفّ ويحذف ما سواها، ويكتب «تُرشَّح وحدَها» ومجالَها وجمهورَها لكلّ دورةٍ يذكرها الملفّ — فما ضُبط في
   اللوحة يرجع بلا خبر. وخطّةُ لوحة الإدارة: «حقولٌ لا يعيدها النشرُ التالي». فصار لكلٍّ وقتُ ضبطه في الدورة
   (`skillsSetAt` و`standaloneSetAt`)، يكتبه البابُ، ويتركه المستوردُ ما دام قائما — كما يترك الاسم (`renamedTitleAr`).

   ① ما ضبطته اللوحةُ يبقى بعد الاستيراد — المهاراتُ بترتيبها، والترشيحُ بمجاله وجمهوره.
   ② وما لم تضبطه يتبع الملفَّ كما كان — فلا يتجمّد الكتالوجُ كلُّه.
   ③ والترحيلُ يعلّم ما ضُبط منذ النشر السابق ولم يُمحَ بعد — من أثره الأخير ما دام قائما في القاعدة. */

import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { CatalogAdminService } from '../../services/catalog-admin.service'
import { importCatalog } from '../../catalog/importer'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const core = JSON.parse(readFileSync(join(root, 'src/data/catalog/core-catalog.v2.json'), 'utf8')) as {
  courses: { course_id: string; recommendable_directly?: boolean; diagnostic_domains?: string[]; diagnostic_stages?: string[] }[]
}
const standalones = core.courses.filter((c) => c.recommendable_directly === true)

const backfill = readFileSync(join(root, 'prisma/migrations/20261026230100_course_panel_set_backfill/migration.sql'), 'utf8')
  .split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n')
  .split(';').map((x) => x.trim()).filter(Boolean)
const runBackfill = async () => { for (const st of backfill) await prisma.$executeRawUnsafe(st) }

const ACTOR = '00000000-0000-0000-0000-0000000000c3'

let prisma: PrismaClient
let admin: CatalogAdminService
/** دوراتٌ من الملفّ لها مهاراتٌ ثلاثٌ فأكثر — بترتيب معرّفها */
let fileCourses: string[] = []
let allSkills: string[] = []

const linksOf = async (courseId: string) =>
  (await prisma.courseSkillLink.findMany({ where: { courseId }, orderBy: { sequence: 'asc' }, select: { skillId: true } }))
    .map((l) => l.skillId)
const standaloneOf = (id: string) => prisma.course.findUniqueOrThrow({
  where: { id }, select: { recommendableDirectly: true, diagnosticDomains: true, diagnosticStages: true },
})

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  admin = new CatalogAdminService(prisma)
  const rows = await prisma.course.findMany({
    where: { createdBy: null, id: { notIn: standalones.map((c) => c.course_id) } },
    orderBy: { id: 'asc' }, select: { id: true, _count: { select: { skillLinks: true } } },
  })
  fileCourses = rows.filter((r) => r._count.skillLinks >= 3).map((r) => r.id)
  allSkills = (await prisma.skill.findMany({ orderBy: { id: 'asc' }, select: { id: true } })).map((s) => s.id)
}, 240_000)

describe('①② النشر لا يعيد ما ضبطته اللوحة — وما لم تضبطه يتبع الملفّ', () => {
  it('⚠️ المهارات بترتيبها والترشيح بمجاله يبقيان بعد الاستيراد — والمتروكة ترجع إلى الملفّ', { timeout: 240_000 }, async () => {
    expect(fileCourses.length, 'لا دورة من الملفّ بثلاث مهارات — تغيّرت البنية؟').toBeGreaterThan(2)
    expect(standalones.length, 'لا دورة يعلنها الملفّ مرشّحة وحدها').toBeGreaterThan(1)
    const [edited, control] = fileCourses
    const fileLinks = { edited: await linksOf(edited!), control: await linksOf(control!) }

    /* اللوحة: مهارتان معكوستان ومهارةٌ ليست في الملفّ — والأولى شارة الدورة */
    const extra = allSkills.find((s) => !fileLinks.edited.includes(s))!
    const panelSkills = [fileLinks.edited[1]!, fileLinks.edited[0]!, extra]
    await admin.setCourseSkills(edited!, panelSkills, ACTOR)
    /* ومن غير اللوحة — يدٌ في القاعدة لا تكتب وقتَ الضبط: يعيدها الملفّ */
    await prisma.courseSkillLink.deleteMany({ where: { courseId: control!, skillId: fileLinks.control[0]! } })

    const [onFile, offFile] = standalones
    await admin.setStandaloneRecommendation(onFile!.course_id, {
      recommendable: false, domains: onFile!.diagnostic_domains ?? [], stages: onFile!.diagnostic_stages ?? [],
    }, ACTOR)
    await prisma.course.update({ where: { id: offFile!.course_id }, data: { recommendableDirectly: false } })

    await importCatalog(prisma)

    expect(await linksOf(edited!), 'أعاد الاستيرادُ مهاراتِ الملفّ فوق ما ضبطته اللوحة').toEqual(panelSkills)
    expect(await linksOf(control!), 'دورةٌ لم تضبطها اللوحة لم ترجع إلى الملفّ').toEqual(fileLinks.control)
    expect((await standaloneOf(onFile!.course_id)).recommendableDirectly, 'أعاد الاستيرادُ ترشيحَ الملفّ فوق ما ضبطته اللوحة').toBe(false)
    expect((await standaloneOf(offFile!.course_id)).recommendableDirectly, 'دورةٌ لم تضبطها اللوحة لم ترجع إلى الملفّ').toBe(true)
  })

  it('والبابان يكتبان وقت الضبط', async () => {
    const [edited] = fileCourses
    const row = await prisma.course.findUniqueOrThrow({ where: { id: edited! }, select: { skillsSetAt: true } })
    expect(row.skillsSetAt).toBeInstanceOf(Date)
    const sa = await prisma.course.findUniqueOrThrow({ where: { id: standalones[0]!.course_id }, select: { standaloneSetAt: true } })
    expect(sa.standaloneSetAt).toBeInstanceOf(Date)
  })
})

describe('③ والترحيل يعلّم ما ضبط ولم يمح بعد', () => {
  const at = new Date('2026-10-25T10:00:00Z')
  const auditSkills = (courseId: string, skillIds: string[]) => prisma.auditEvent.create({
    data: { actorId: ACTOR, action: 'catalog.course.skills_set', entityType: 'course', entityId: courseId, createdAt: at,
      before: { skillIds: [] }, after: { skillIds: [...skillIds].sort() } },
  })
  const auditStandalone = (courseId: string, after: { recommendable: boolean; domains: string[]; stages: string[] }) =>
    prisma.auditEvent.create({
      data: { actorId: ACTOR, action: 'catalog.course.standalone_set', entityType: 'course', entityId: courseId, createdAt: at, after },
    })
  const marks = async (id: string) =>
    prisma.course.findUniqueOrThrow({ where: { id }, select: { skillsSetAt: true, standaloneSetAt: true } })

  it('⚠️ أثرٌ أخيرٌ قائمٌ في القاعدة يعلَّم بوقته — والممحوّ والصامت لا يعلَّمان', async () => {
    const [, , alive, wiped, silent] = fileCourses
    expect(silent, 'دوراتٌ أقلّ ممّا يحتاجه الفحص').toBeDefined()
    /* قائمٌ: روابطه الآن ما قاله أثرُه (والترتيبُ ليس شرطا) */
    await auditSkills(alive!, [...(await linksOf(alive!))].reverse())
    /* ممحوّ: أثرُه يقول غيرَ ما في القاعدة — أعاده نشرٌ سابق، فلا يُرجَع */
    await auditSkills(wiped!, [extraSkill(await linksOf(wiped!))])

    const [, , standAlive, standWiped] = standalones
    const a = await standaloneOf(standAlive!.course_id)
    await auditStandalone(standAlive!.course_id, { recommendable: a.recommendableDirectly, domains: [...a.diagnosticDomains].reverse(), stages: a.diagnosticStages })
    const w = await standaloneOf(standWiped!.course_id)
    await auditStandalone(standWiped!.course_id, { recommendable: !w.recommendableDirectly, domains: w.diagnosticDomains, stages: w.diagnosticStages })

    await runBackfill()

    expect((await marks(alive!)).skillsSetAt?.toISOString()).toBe(at.toISOString())
    expect((await marks(wiped!)).skillsSetAt, 'علّم ما محاه نشرٌ سابق').toBeNull()
    expect((await marks(silent!)).skillsSetAt, 'علّم دورةً بلا أثر').toBeNull()
    expect((await marks(standAlive!.course_id)).standaloneSetAt?.toISOString()).toBe(at.toISOString())
    expect((await marks(standWiped!.course_id)).standaloneSetAt, 'علّم ترشيحا محاه نشرٌ سابق').toBeNull()

    /* ويُعاد فلا يفسد: ما عُلّم يبقى بوقته */
    await runBackfill()
    expect((await marks(alive!)).skillsSetAt?.toISOString()).toBe(at.toISOString())
  })
})

function extraSkill(linked: string[]): string {
  return allSkills.find((s) => !linked.includes(s))!
}
