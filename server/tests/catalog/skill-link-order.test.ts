/* ترتيبُ مهارات الدورة ترتيبُ المصدر — والأولى شارتُها في صفحتها (٢٠ أكتوبر ٢٠٢٦).

   كانت الروابطُ بلا ترتيبٍ في القاعدة وتُقرأ بلا `orderBy`، فتعيدها PostgreSQL كما اتّفق. ولقطةٌ بُنيت
   بعد إعادة استيرادٍ خرجت فيها ٩ دوراتٍ من ١٤٩ بشارةٍ غير مهارتها الأولى (`SKILL_LINK_ORDER`).

   والقاعدةُ الجديدة تعيد الصفوفَ بترتيب كتابتها غالبا — فالحارسُ يقلب ترتيبَها عمدا: يحذف روابطَ دورةٍ
   ويكتبها معكوسةً بتسلسلها نفسِه. ثمّ يطلب الترتيبَ من القرّاء الثلاثة: اللقطة، والكتالوج العامّ، ولوحة
   الإدارة. فما قرأ بلا ترتيبٍ خرج معكوسا وسقط. */

import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { buildSnapshotFromDb } from '../../catalog/snapshot-builder'
import { PublicCatalogService } from '../../services/public-catalog.service'
import { CatalogAdminService } from '../../services/catalog-admin.service'

const COURSE = 'C-CAR-101'
const source = JSON.parse(readFileSync(join(process.cwd(), 'src/data/catalog/core-catalog.v2.json'), 'utf8'))
const want: string[] = source.courses.find((c: { course_id: string }) => c.course_id === COURSE).skill_ids

let prisma: PrismaClient

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  /* الصفوفُ تُكتب معكوسة — والتسلسلُ باقٍ كما كتبه المستورد */
  const rows = await prisma.courseSkillLink.findMany({ where: { courseId: COURSE } })
  expect(rows.map((r) => r.sequence).sort((a, b) => a - b), 'المستوردُ لم يكتب التسلسل').toEqual(want.map((_, i) => i))
  await prisma.courseSkillLink.deleteMany({ where: { courseId: COURSE } })
  for (const r of [...rows].sort((a, b) => b.sequence - a.sequence)) await prisma.courseSkillLink.create({ data: r })
  const raw = await prisma.courseSkillLink.findMany({ where: { courseId: COURSE } })
  expect(raw.map((r) => r.skillId), 'القاعدةُ لم تُقلَب — فالحارسُ لا يحرس شيئا').not.toEqual(want)
}, 240_000)

describe('ترتيبُ مهارات الدورة', () => {
  it('⚠️ اللقطةُ المنشورة — ومنها شارةُ صفحة الدورة', async () => {
    const { payload } = await buildSnapshotFromDb(prisma)
    const course = (payload as { coreCatalog: { courses: { course_id: string; skill_ids: string[] }[] } })
      .coreCatalog.courses.find((c) => c.course_id === COURSE)!
    expect(course.skill_ids).toEqual(want)
  })

  it('⚠️ والكتالوجُ العامّ', async () => {
    const { courses } = await new PublicCatalogService(prisma).coreCatalog() as unknown as {
      courses: { course_id: string; skill_slugs: string[] }[]
    }
    const skills = await prisma.skill.findMany({ where: { id: { in: want } }, select: { id: true, slug: true } })
    const slugOf = new Map(skills.map((s) => [s.id, s.slug]))
    expect(courses.find((c) => c.course_id === COURSE)!.skill_slugs).toEqual(want.map((id) => slugOf.get(id)))
  })

  it('⚠️ ولوحةُ الإدارة — فما تحفظه بعد التعديل هو ترتيبُها', async () => {
    const rows = await new CatalogAdminService(prisma).listCourses()
    expect(rows.find((c) => c.id === COURSE)!.skillIds).toEqual(want)
  })
})
