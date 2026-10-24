/* «الاسم الجديد» مثالٌ لا اسم — لا يُقدَّم ولا يُعتمَد (`change-request-example.ts`، ٢٤ أكتوبر ٢٠٢٦).

   كانت خانةُ «طلب تعديل على كيان موجود» تُفتح وفيها `{"titleAr": "الاسم الجديد"}` قيمةً، فمن ضغط «تقديم الطلب» ولم
   يمسّها سمّى دورتَه «الاسم الجديد»، ووقع الاسمُ عند الاعتماد.

   ① التقديمُ بالمثال يُردّ.
   ② وطلبٌ قُدّم به قبل اليوم لا يُعتمَد — ويبقى اسمُ الدورة كما هو. وردُّه ممكن.
   ③ واسمٌ حقيقيٌّ يمضي كما كان. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { CatalogAdminService } from '../../services/catalog-admin.service'

const MAKER = '00000000-0000-0000-0000-0000000000c1'
const CHECKER = '00000000-0000-0000-0000-0000000000d2'

let prisma: PrismaClient
let admin: CatalogAdminService
let courseId = ''
let original = ''

const titleOf = async (id: string) =>
  (await prisma.courseVersion.findFirst({ where: { courseId: id }, orderBy: { version: 'desc' } }))!.titleAr

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  admin = new CatalogAdminService(prisma)
  courseId = (await prisma.course.findFirstOrThrow({ where: { status: 'published' }, orderBy: { id: 'desc' }, select: { id: true } })).id
  original = await titleOf(courseId)
}, 240_000)

describe('① التقديم بالمثال يرد', () => {
  it('⚠️ لا يقدم طلب يسمي الدورة «الاسم الجديد»', async () => {
    await expect(admin.submitChangeRequest('course', courseId, { titleAr: 'الاسم الجديد' }, MAKER))
      .rejects.toMatchObject({ code: 'example_title' })
  })
})

describe('② وما قدم به قبل اليوم لا يعتمد', () => {
  it('⚠️ الاعتماد يرد، واسم الدورة كما هو — والرد ممكن', async () => {
    const cr = await prisma.contentChangeRequest.create({
      data: { entityType: 'course', entityId: courseId, payload: { titleAr: 'الاسم الجديد' }, status: 'in_review', createdBy: MAKER },
    })
    await expect(admin.decide(cr.id, 'approve', undefined, CHECKER)).rejects.toMatchObject({ code: 'example_title' })
    expect(await titleOf(courseId), 'سميت الدورة بالمثال').toBe(original)
    const rejected = await admin.decide(cr.id, 'reject', 'مثال لا اسم', CHECKER)
    expect(rejected.status).toBe('rejected')
  })
})

describe('③ واسم حقيقي يمضي كما كان', () => {
  it('يقدم ويعتمد ويكتب', async () => {
    const cr = await admin.submitChangeRequest('course', courseId, { titleAr: 'المحاسبة للمبتدئين' }, MAKER)
    await admin.decide(cr.id, 'approve', undefined, CHECKER)
    expect(await titleOf(courseId)).toBe('المحاسبة للمبتدئين')
  })
})
