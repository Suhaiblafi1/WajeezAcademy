/* تغييرُ اسم الدورة — لوحُ «أسماء الدورات» (٢٠ أكتوبر ٢٠٢٦).

   يحرس أربعا:
     · القائمةُ دوراتٌ لها شعبٌ وحدَها، ولكلٍّ اقتراحاتٌ من أسماء شعبها.
     · من يعتمد ما يقدّمه يكتب الاسمَ فورا — في الإصدار وفي `renamedTitleAr` —
       ولا تتغيّر حالةُ الدورة ولا أسماءُ شعبها.
     · **واستيرادُ الملفّ في النشر التالي لا يُرجع الاسمَ القديم** — وهو ما كان
       سيقع لو كُتب الاسمُ في الإصدار وحدَه.
     · وغيرُه يقدّم طلبا، واعتمادُه يكتب الاسم — وكان الاعتمادُ يرفع الحالةَ ولا
       يكتب `titleAr` الحمولة أبدا.

   وتلقائيّتُه (٢٠ أكتوبر ٢٠٢٦، «افعله»): الاقتراحُ الجديدُ يصل «ما ينتظرك» بنفسه،
   والمعتمَدُ و«أبقِ الاسم» لا يعودان، وشعبةٌ تُفتح باسمٍ لم يُرَ تُعيده.

   ⚠ أُثبت سقوطُه: أُعيد المستوردُ إلى `titleAr: c.title_ar` فسقط حارسُ الاستيراد
   بالاسم القديم، وأُزيل `applyCourseRename` من `decide` فسقط حارسُ الطلب. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { CatalogAdminService } from '../../services/catalog-admin.service'
import { importCatalog } from '../../catalog/importer'
import { cohortTitleAr } from '../../../src/application/learning/cohort-title'
import { StaffInboxService } from '../../services/staff-inbox.service'

const MAKER = '00000000-0000-0000-0000-0000000000a1'
const CHECKER = '00000000-0000-0000-0000-0000000000b2'
const SELF_APPROVE = 'catalog.self_approve'

let prisma: PrismaClient
let admin: CatalogAdminService
let courseId = ''
let otherId = ''
let original = { titleAr: '', status: '' }
let otherOriginal = { titleAr: '', status: '' }
const cohortIds: string[] = []

const titleOf = async (id: string) =>
  (await prisma.courseVersion.findFirst({ where: { courseId: id }, orderBy: { version: 'desc' } }))!.titleAr

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  admin = new CatalogAdminService(prisma)
  const [a, b] = await prisma.course.findMany({
    where: { status: 'published' }, orderBy: { id: 'asc' }, take: 2, select: { id: true, status: true },
  })
  courseId = a!.id
  otherId = b!.id
  original = { titleAr: await titleOf(courseId), status: a!.status }
  otherOriginal = { titleAr: await titleOf(otherId), status: b!.status }
  for (const title of [
    cohortTitleAr(original.titleAr, 1),
    'إدارة المشاريع الاحترافية — شعبة ٢',
    'إدارة المشاريع الاحترافية بمنهجية أجايل',
  ]) {
    const c = await prisma.cohort.create({ data: { courseId, title } })
    cohortIds.push(c.id)
  }
}, 240_000)

afterAll(async () => {
  await prisma.cohort.deleteMany({ where: { id: { in: cohortIds } } })
  for (const [id, o] of [[courseId, original], [otherId, otherOriginal]] as const) {
    await prisma.course.update({ where: { id }, data: { renamedTitleAr: null, renamedAt: null, nameSuggestionsSeen: [], status: o.status } })
    await prisma.courseVersion.updateMany({ where: { courseId: id }, data: { titleAr: o.titleAr } })
  }
})

describe('أسماءُ الدورات', () => {
  it('القائمةُ دوراتٌ لها شعبٌ وحدَها — ولكلٍّ أسماءُ شعبها واقتراحاتُها', async () => {
    const rows = await admin.courseNames()
    const withCohorts = await prisma.course.count({ where: { cohorts: { some: {} } } })
    expect(rows.length).toBe(withCohorts)
    const row = rows.find((r) => r.id === courseId)!
    expect(row.cohorts.map((c) => c.title)).toHaveLength(3)
    expect(row.suggestions[0]).toMatchObject({ titleAr: 'إدارة المشاريع الاحترافية', kind: 'combined' })
    expect(rows.some((r) => r.id === otherId)).toBe(false)
  })

  it('من يعتمد ما يقدّمه يكتب الاسمَ فورا — والحالةُ وأسماءُ الشعب كما هي', async () => {
    const out = await admin.renameCourse(courseId, '  إدارةُ المشاريع الاحترافية ', MAKER, [SELF_APPROVE])
    expect(out).toMatchObject({ applied: true, titleAr: 'إدارة المشاريع الاحترافية' })
    expect(await titleOf(courseId)).toBe('إدارة المشاريع الاحترافية')
    const c = await prisma.course.findUniqueOrThrow({ where: { id: courseId } })
    expect(c.renamedTitleAr).toBe('إدارة المشاريع الاحترافية')
    expect(c.status).toBe(original.status)
    const cohorts = await prisma.cohort.findMany({ where: { id: { in: cohortIds } }, select: { title: true } })
    expect(cohorts.map((k) => k.title)).toContain(cohortTitleAr(original.titleAr, 1))
    const audit = await prisma.auditEvent.findFirst({ where: { action: 'catalog.course.rename', entityId: courseId } })
    expect(audit).not.toBeNull()
  })

  it('واستيرادُ الملفّ في النشر التالي لا يُرجع الاسمَ القديم', { timeout: 180_000 }, async () => {
    await importCatalog(prisma)
    expect(await titleOf(courseId)).toBe('إدارة المشاريع الاحترافية')
  })

  it('ويردّ الاسمَ نفسَه والقصيرَ جدّا', async () => {
    await expect(admin.renameCourse(courseId, 'إدارة المشاريع الاحترافية', MAKER, [SELF_APPROVE]))
      .rejects.toMatchObject({ code: 'same_title' })
    await expect(admin.renameCourse(courseId, 'اب', MAKER, [SELF_APPROVE]))
      .rejects.toMatchObject({ code: 'invalid_title' })
  })

  it('وغيرُه يقدّم طلبا — واعتمادُه يكتب الاسم ولا يمسّ حالةَ الدورة', async () => {
    const out = await admin.renameCourse(otherId, 'اسم جديد للدورة الثانية', MAKER, [])
    expect(out.applied).toBe(false)
    expect(await titleOf(otherId)).toBe(otherOriginal.titleAr)
    const pending = (await admin.courseNames()).length // لا شعبَ لها، فلا تظهر — والطلبُ قائم
    expect(pending).toBeGreaterThan(0)

    await admin.decide((out as { changeRequestId: string }).changeRequestId, 'approve', undefined, CHECKER)
    expect(await titleOf(otherId)).toBe('اسم جديد للدورة الثانية')
    const c = await prisma.course.findUniqueOrThrow({ where: { id: otherId } })
    expect(c.status).toBe(otherOriginal.status)
    expect(c.renamedTitleAr).toBe('اسم جديد للدورة الثانية')
  })

  it('والطلبُ العامّ `{ titleAr }` يكتب الاسمَ عند اعتماده', async () => {
    const cr = await admin.submitChangeRequest('course', otherId, { titleAr: 'اسم من الطلب العام' }, MAKER)
    await admin.decide(cr.id, 'approve', undefined, CHECKER)
    expect(await titleOf(otherId)).toBe('اسم من الطلب العام')
  })
})

describe('الاقتراحُ يأتي وحدَه مع كلّ شعبةٍ باسمٍ جديد', () => {
  const inboxItem = async () =>
    (await new StaffInboxService(prisma).forStaff(MAKER, ['catalog.course.edit'])).find((i) => i.key === 'course_names')
  const newCount = async (id: string) => (await admin.courseNames()).find((r) => r.id === id)?.newSuggestions ?? 0

  it('ما اعتُمد اسمٌ بجانبه لا يعود — ولا الاسمُ القديمُ الذي تحمله شعبةٌ افتراضيّة', async () => {
    /* `courseId` غُيّر اسمُها في الوصف السابق، وشعبتُها الأولى ما زالت «الاسم القديم — شعبة ١» */
    expect(await newCount(courseId)).toBe(0)
    expect((await inboxItem())?.sample.join(' ') ?? '').not.toContain('إدارة المشاريع')
  })

  it('شعبةٌ تُفتح باسمٍ لم يُرَ تعيد الدورةَ إلى «ما ينتظرك» بنفسها', async () => {
    const c = await prisma.cohort.create({ data: { courseId, title: 'قيادة المشاريع الرقمية — شعبة ٤' } })
    cohortIds.push(c.id)
    expect(await newCount(courseId)).toBe(1)
    const item = await inboxItem()
    expect(item?.href).toBe('/admin/catalog?names=1')
    expect(item?.sample.join(' ')).toContain('قيادة المشاريع الرقمية')
  })

  it('و«أبقِ الاسم الحاليّ» يُخرجها ولا يغيّر اسمَها', async () => {
    await admin.keepCourseName(courseId, MAKER)
    expect(await newCount(courseId)).toBe(0)
    expect(await titleOf(courseId)).toBe('إدارة المشاريع الاحترافية')
    expect((await inboxItem())?.sample.join(' ') ?? '').not.toContain('قيادة المشاريع الرقمية')
    const audit = await prisma.auditEvent.findFirst({ where: { action: 'catalog.course.keep_name', entityId: courseId } })
    expect(audit).not.toBeNull()
  })

  it('ولا يرى البندَ من لا يملك تعديلَ الدورة', async () => {
    const c = await prisma.cohort.create({ data: { courseId, title: 'تخطيط المشاريع الذكي' } })
    cohortIds.push(c.id)
    const keys = (await new StaffInboxService(prisma).forStaff(MAKER, ['catalog.view'])).map((i) => i.key)
    expect(keys).not.toContain('course_names')
  })
})
