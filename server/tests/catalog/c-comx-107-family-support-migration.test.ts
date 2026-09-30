/* ترحيلُ C-COMX-107 مساندةً في «الأسرة والتربية» — رابطٌ يظهر ولا يمسّ حسابَ التشخيص.

   الدورةُ دورةُ لوحةٍ لا تُستورد، فتُصنع هنا منشورةً كما هي في الإنتاج، وتُقرأ
   جملةُ الترحيل من ملفّه **نفسِه** (على حذو `restore-c-comx-107-migration`).

   ═══ وما يُفحص ═══

   ① يُكتب رابطٌ مساندٌ بسببه، بعد آخر رابطٍ في المسار — ولا يُمسّ غيرُه.
   ② واللقطةُ تعدّها مساندةً لا أساسيّة: `course_ids` الذي يقرؤه التشخيصُ كما هو،
      و`support_courses` تحملها بسببها، والدورةُ تُنسب إلى المسار.
   ③ ويبقى بعد نشرٍ للموقع: المستوردُ لا يقلّمه.
   ④ ويُعاد فلا يفسد — ولا يُكتب لدورةٍ ليست منشورة. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { importCatalog } from '../../catalog/importer'
import { buildSnapshotFromDb } from '../../catalog/snapshot-builder'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
let prisma: PrismaClient

const sql = readFileSync(join(root, 'prisma/migrations/20260930200000_c_comx_107_supports_family_pathway/migration.sql'), 'utf8')
  .split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n')
  .split(';').map((x) => x.trim()).filter(Boolean)
const migrate = async () => { for (const st of sql) await prisma.$executeRawUnsafe(st) }

const ID = 'C-COMX-107'
const PW = 'PW-FAM-001'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
}, 240_000)

async function wipe() {
  await prisma.pathwayCourse.deleteMany({ where: { courseId: ID } })
  await prisma.courseSkillLink.deleteMany({ where: { courseId: ID } })
  await prisma.courseVersion.deleteMany({ where: { courseId: ID } })
  await prisma.course.deleteMany({ where: { id: ID } })
}
/* القاعدةُ مشتركةٌ بين ملفّات الخادم — فلا تبقى بعدنا دورةٌ ولا رابط */
afterAll(wipe)

/** دورةُ لوحةٍ بحالها — كما هي في الإنتاج بعد إعادتها */
async function adminCourse(status: string) {
  await wipe()
  await prisma.course.create({ data: { id: ID, status, currentVersion: 1, createdBy: randomUUID() } })
  await prisma.courseVersion.create({ data: { courseId: ID, version: 1, status: 'published', titleAr: 'اعداد المعلمين واولاء الامور لتدريب مهارة الخطابة والالقاء لأبنائهم', totalHours: 16 } })
}

const linksOf = async () => (await prisma.pathwayCourse.findMany({ where: { pathwayId: PW }, orderBy: { sequence: 'asc' } }))
  .map((l) => ({ courseId: l.courseId, sequence: l.sequence, kind: l.kind, reasonAr: l.reasonAr }))

describe('ترحيلُ C-COMX-107 مساندةً في «الأسرة والتربية»', () => {
  it('①–④ رابطٌ مساندٌ تحمله اللقطةُ ولا يمسّ حسابَ التشخيص، ويبقى بعد الاستيراد، ويُعاد فلا يفسد', { timeout: 180_000 }, async () => {
    await adminCourse('published')
    const before = await linksOf()
    expect(before.map((l) => l.courseId), 'المسارُ بلا روابطه — تغيّر الكتالوج').toEqual(expect.arrayContaining(['C-FAM-101', 'C-EDU-101']))

    await migrate()

    /* ① رابطٌ واحدٌ جديد، مساندٌ بسببه، بعد آخر رابط — والباقي كما هو */
    const after = await linksOf()
    expect(after.slice(0, before.length)).toEqual(before)
    expect(after.slice(before.length)).toEqual([{
      courseId: ID, sequence: Math.max(...before.map((l) => l.sequence)) + 1, kind: 'support', reasonAr: expect.stringContaining('الخطابة'),
    }])

    /* ② واللقطة: أساسيّاتُ المسار كما هي، والمساندةُ فيها بسببها */
    const snap = async () => {
      const p = (await buildSnapshotFromDb(prisma)).payload as unknown as {
        coreCatalog: {
          launch_pathways: { id: string; course_ids: string[]; support_courses: { course_id: string; reason_ar: string }[] }[]
          courses: { course_id: string; pathway_id: string }[]
        }
      }
      return {
        pathway: p.coreCatalog.launch_pathways.find((x) => x.id === PW)!,
        course: p.coreCatalog.courses.find((c) => c.course_id === ID),
      }
    }
    const s = await snap()
    expect(s.pathway.course_ids, 'دخلت الأساسيّات — فتغيّر ما يقيسه التشخيص').toEqual(['C-FAM-101', 'C-FAM-102', 'C-FAM-103', 'C-FAM-104'])
    expect(s.pathway.support_courses.map((x) => x.course_id)).toEqual(['C-EDU-101', 'C-EDU-106', ID])
    expect(s.pathway.support_courses.at(-1)!.reason_ar).toContain('الخطابة')
    expect(s.course?.pathway_id, 'الدورةُ لا تُنسب إلى المسار').toBe(PW)

    /* ③ نشرٌ للموقع لا يقلّمه */
    await importCatalog(prisma)
    expect(await linksOf(), 'قلّم المستوردُ رابطَ دورة اللوحة').toEqual(after)

    /* ④ يُعاد فلا يفسد */
    await migrate()
    expect(await linksOf()).toEqual(after)
  })

  it('④ ولا يُكتب لدورةٍ ليست منشورة', { timeout: 60_000 }, async () => {
    await adminCourse('archived')
    await migrate()
    expect((await linksOf()).map((l) => l.courseId)).not.toContain(ID)
  })
})
