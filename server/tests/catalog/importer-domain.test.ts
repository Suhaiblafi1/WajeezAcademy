/* المستوردُ يكتب مجالَ الدورة — كما يكتبه المعالج.

   `Course.domainAr` يقارنه مخطِّطُ الفصل حرفا بحرفٍ ليمنع دورتين من مجالٍ
   واحدٍ أن تتزاحما (`application/terms/planner`)، وتعرضه رقاقاتُ التقويم.
   وكان المعالجُ وحدَه يكتبه؛ ودوراتُ ملفّ الكتالوج مُلئ مجالُها بترحيلَين لما
   كان قائما يومَهما. فكلُّ دورةٍ أُضيفت إلى الملفّ بعدهما وُلدت بلا مجال —
   ومنها الإحدى والعشرون التي وُلدت من اقتراحات المدرّبين (٢٩ سبتمبر ٢٠٢٦).

   والحارسُ على الطريقين: الإنشاءُ (القالبُ يُبنى باستيرادٍ على قاعدةٍ فارغة)
   والتحديثُ (مجالٌ قديمٌ أو فارغٌ في القاعدة يُصحَّح بإعادة الاستيراد) — فاسمٌ
   يتغيّر في `course-domain.ts` يصل دوراتِ الملفّ بلا ترحيل. */

import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { importCatalog } from '../../catalog/importer'
import { COURSE_DOMAIN_FAMILIES, courseDomain } from '../../../src/application/catalog/course-domain'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const core = JSON.parse(readFileSync(join(root, 'src/data/catalog/core-catalog.v2.json'), 'utf8')) as {
  courses: { course_id: string }[]
}
const sourceIds = core.courses.map((c) => c.course_id)
const familyOf = (id: string) => /^C-([A-Z0-9]+)-/.exec(id)?.[1] ?? ''

let prisma: PrismaClient

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
}, 180_000)

describe('المستوردُ يكتب مجالَ الدورة', () => {
  it('كلُّ دورةٍ من عائلةٍ مسمّاةٍ تحمل مجالَها — وما لا يُسمّى فراغٌ لا «أخرى»', async () => {
    const rows = await prisma.course.findMany({ where: { id: { in: sourceIds } }, select: { id: true, domainAr: true } })
    expect(rows).toHaveLength(sourceIds.length)

    const named = rows.filter((r) => COURSE_DOMAIN_FAMILIES.includes(familyOf(r.id)))
    /* الحارسُ يرى ما يحرسه: الكتالوجُ كلُّه تقريبا من عائلاتٍ مسمّاة */
    expect(named.length).toBeGreaterThan(100)
    for (const r of named) expect(r.domainAr, r.id).toBe(courseDomain(r.id))

    /* «أخرى» عنوانُ الشاشة لما لا يُعرف، لا مجالٌ يُكتب في القاعدة: لو كُتب
       لرآه المخطِّطُ مجالا واحدا يجمع كلَّ مجهولٍ فمنع تجاورَ ما لا يتزاحم */
    expect(rows.filter((r) => r.domainAr === 'أخرى').map((r) => r.id)).toEqual([])

    /* وعائلةٌ وُلدت مع دوراتها تصل باسمها — لا بمجالٍ فارغٍ ينتظر ترحيلا */
    expect(rows.find((r) => r.id === 'C-WEB-101')?.domainAr).toBe('البرمجة وتطوير الويب')
  })

  it('إعادةُ الاستيراد تصحّح مجالا قديما أو فارغا — التحديثُ يكتبه كالإنشاء', { timeout: 180_000 }, async () => {
    await prisma.course.update({ where: { id: 'C-WEB-101' }, data: { domainAr: 'اسمٌ قديمٌ للمجال' } })
    await prisma.course.update({ where: { id: 'C-COMX-110' }, data: { domainAr: null } })

    await importCatalog(prisma)

    const after = await prisma.course.findMany({
      where: { id: { in: ['C-WEB-101', 'C-COMX-110'] } },
      select: { id: true, domainAr: true },
      orderBy: { id: 'asc' },
    })
    expect(after).toEqual([
      { id: 'C-COMX-110', domainAr: 'التواصل والإلقاء' },
      { id: 'C-WEB-101', domainAr: 'البرمجة وتطوير الويب' },
    ])
  })
})
