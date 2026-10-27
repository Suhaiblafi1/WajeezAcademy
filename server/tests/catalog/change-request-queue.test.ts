/* طابورُ طلبات التغيير (٢٦ أكتوبر ٢٠٢٦، المرحلة الثامنة — ب).

   ① كان `promoteEntity` يكتب «معتمد» على الكيان في كلّ حال: فاعتمادُ `{ "titleAr": … }` من صندوق JSON على دورةٍ
      منشورة يُخرجها من الكتالوج العامّ حتى النشر التالي، ومؤرشفةٌ تعود «معتمدة» فيعيدها النشرُ إلى الموقع. فصار
      يرفع ما كان على الحالة السابقة وحدَه — والمسودّةُ ما تزال تُرفع.
   ② والقائمةُ تحمل اسمَ ما يُطلب وحالتَه الآن — كان الطابورُ يعرض المعرّفَ وحدَه.
   ③ واسمٌ اعتُمد من الطابور يُنشر في الحال، كالاسم الذي يُكتب مباشرة — كان ينتظر النشرَ التالي.
   ④ وبندُ «ما ينتظرك» يصل الطابورَ في «الكتالوج»، ولمن يملك القرارَ وحدَه — كان يفتح «النشر». */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { CatalogAdminService } from '../../services/catalog-admin.service'
import { StaffInboxService } from '../../services/staff-inbox.service'
import { AuthService } from '../../services/auth.service'
import { ROLE_PERMISSIONS } from '../../auth/permissions'
import { getActiveSnapshot } from '../../catalog/snapshot-builder'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let admin: CatalogAdminService
let app: FastifyInstance
/** دوراتٌ منشورةٌ من الملفّ — لكلّ حارسٍ دورتُه فلا يحجب أحدُهما سقوطَ الآخر */
let published: string[] = []
let managerCookie = ''
let superCookie = ''

const MAKER = '00000000-0000-0000-0000-0000000000b1'
const CHECKER = '00000000-0000-0000-0000-0000000000b2'
const STAMP = Date.now()

const courseNow = (id: string) => prisma.course.findUniqueOrThrow({
  where: { id },
  select: { status: true, currentVersion: true, versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true, status: true } } },
})

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  admin = new CatalogAdminService(prisma)
  const auth = new AuthService(prisma)
  app = await buildApp(prisma)
  await app.ready()
  const sessionFor = async (email: string, role: string) => {
    const u = await auth.register(email, 'QueueCheck#12345', role)
    await auth.setRoles(u.userId, [role])
    const { token } = await auth.login(email, 'QueueCheck#12345')
    return `${SESSION_COOKIE}=${token}`
  }
  managerCookie = await sessionFor(`queue-acad-${STAMP}@test.local`, 'academic_manager')
  superCookie = await sessionFor(`queue-super-${STAMP}@test.local`, 'super_admin')
  published = (await prisma.course.findMany({
    where: { status: 'published', createdBy: null }, orderBy: { id: 'asc' }, take: 5, select: { id: true },
  })).map((c) => c.id)
}, 240_000)

describe('① الاعتماد يرفع المسودة وحدها', () => {
  it('⚠️ طلب على دورة منشورة يكتب اسمها ولا ينزلها', async () => {
    const id = published[0]!
    const cr = await admin.submitChangeRequest('course', id, { titleAr: 'اسم من صندوق قديم' }, MAKER)
    const out = await admin.decide(cr.id, 'approve', undefined, CHECKER)
    expect(out.renamed, 'لم يقل القرار إن اسما كتب').toBe(true)
    const c = await courseNow(id)
    expect(c.status, 'اعتماد الطلب أنزل الدورة المنشورة — فتخرج من الكتالوج حتى النشر التالي').toBe('published')
    expect(c.versions[0]?.titleAr).toBe('اسم من صندوق قديم')
  })

  it('ومؤرشفة تبقى مؤرشفة — ونسختها كما هي', async () => {
    const id = published[1]!
    await prisma.course.update({ where: { id }, data: { status: 'archived' } })
    const before = (await courseNow(id)).versions[0]?.status
    const cr = await admin.submitChangeRequest('course', id, { kind: 'tidy' }, MAKER)
    const out = await admin.decide(cr.id, 'approve', undefined, CHECKER)
    expect(out.renamed).toBe(false)
    const c = await courseNow(id)
    expect(c.status, 'عادت المؤرشفة «معتمدة» — فيعيدها النشر إلى الموقع').toBe('archived')
    expect(c.versions[0]?.status).toBe(before)
  })

  it('والمسودة ترفع كما كانت — بالطلب الذي يقدمها به المعالج وزر صفها', async () => {
    const pathway = await prisma.pathway.findFirstOrThrow({ where: { status: 'published' }, orderBy: { id: 'asc' } })
    const skill = await prisma.skill.findFirstOrThrow({ where: { status: 'published' }, orderBy: { id: 'asc' } })
    const { id } = await admin.createCourse({
      pathwayId: pathway.id, sequence: 9, titleAr: 'دورة من المعالج للطابور', totalHours: 4, skillIds: [skill.id],
      modules: [{ sequence: 1, titleAr: 'وحدتها الأولى', hours: 4 }],
    }, MAKER)
    try {
      /* جسمُ `draftApprovalBody` في الشاشة — كان بابُ المسودّة صندوقَ JSON */
      const cr = await admin.submitChangeRequest('course', id, { action: 'create' }, MAKER)
      await admin.decide(cr.id, 'approve', undefined, CHECKER)
      const c = await courseNow(id)
      expect(c.status).toBe('approved')
      expect(c.versions[0]?.status).toBe('approved')
    } finally {
      /* ولا تبقى معتمدةً ينشرها النشرُ في ③ — فلا يقع حارسٌ على عمل آخر */
      await prisma.course.delete({ where: { id } })
    }
  })
})

describe('② القائمة تسمي ما يطلب وتقول حالته', () => {
  it('⚠️ اسم الدورة والمسار وحالتهما — وما لم يولد بلا اسم ولا حالة', async () => {
    const id = published[2]!
    const course = await courseNow(id)
    const pathway = await prisma.pathway.findFirstOrThrow({
      where: { status: 'published' }, orderBy: { id: 'asc' },
      select: { id: true, versions: { orderBy: { version: 'desc' }, take: 1, select: { title: true } } },
    })
    const rename = await admin.submitChangeRequest('course', id,
      { kind: 'course_rename', titleAr: 'اسم ينتظر قرارا', fromTitleAr: course.versions[0]!.titleAr }, MAKER)
    const onPathway = await admin.submitChangeRequest('pathway', pathway.id, { kind: 'tidy' }, MAKER)
    const skill = await admin.submitChangeRequest('skill', `mahara-tutlab-${STAMP}`,
      { kind: 'skill_request', slug: `mahara-tutlab-${STAMP}`, nameAr: 'مهارة تطلب' }, MAKER)

    const rows = await admin.listChangeRequests('in_review')
    const of = (crId: string) => rows.find((r) => r.id === crId)!
    expect(of(rename.id)).toMatchObject({ entityLabelAr: course.versions[0]!.titleAr, entityStatus: 'published' })
    expect(of(onPathway.id)).toMatchObject({ entityLabelAr: pathway.versions[0]!.title, entityStatus: 'published' })
    expect(of(skill.id)).toMatchObject({ entityLabelAr: null, entityStatus: null })
  })
})

describe('③ والاسم المعتمد من الطابور ينشر في الحال', () => {
  it('⚠️ يقدمه المدير الأكاديمي ويعتمده مراجع آخر — فيصل اللقطة المنشورة', { timeout: 240_000 }, async () => {
    const id = published[3]!
    const made = await app.inject({
      method: 'POST', url: `/api/admin/catalog/courses/${id}/rename`, headers: { cookie: managerCookie },
      payload: { titleAr: 'اسم يعتمد من الطابور' },
    })
    expect(made.statusCode, made.body).toBe(200)
    const { applied, changeRequestId } = made.json() as { applied: boolean; changeRequestId: string }
    expect(applied, 'كتب الاسم مباشرة — والمدير الأكاديمي لا يعتمد ما يقدمه').toBe(false)

    const decided = await app.inject({
      method: 'POST', url: `/api/admin/catalog/change-requests/${changeRequestId}/decision`,
      headers: { cookie: superCookie }, payload: { decision: 'approve' },
    })
    expect(decided.statusCode, decided.body).toBe(200)
    expect(decided.json()).toMatchObject({ renamed: true, published: true })
    const active = await getActiveSnapshot(prisma)
    const courses = (active?.payload as { coreCatalog: { courses: { course_id: string; title_ar: string }[] } }).coreCatalog.courses
    expect(courses.find((c) => c.course_id === id)?.title_ar, 'اعتمد الاسم ولم يصل الموقع').toBe('اسم يعتمد من الطابور')
  })

  it('والرد لا يكتب اسما ولا ينشر', async () => {
    const id = published[4]!
    const before = (await courseNow(id)).versions[0]!.titleAr
    const made = await app.inject({
      method: 'POST', url: `/api/admin/catalog/courses/${id}/rename`, headers: { cookie: managerCookie },
      payload: { titleAr: 'اسم يرفض' },
    })
    const { changeRequestId } = made.json() as { changeRequestId: string }
    const decided = await app.inject({
      method: 'POST', url: `/api/admin/catalog/change-requests/${changeRequestId}/decision`,
      headers: { cookie: superCookie }, payload: { decision: 'reject' },
    })
    expect(decided.statusCode, decided.body).toBe(200)
    expect(decided.json()).toMatchObject({ status: 'rejected', renamed: false })
    expect((decided.json() as { published?: boolean }).published).toBeUndefined()
    expect((await courseNow(id)).versions[0]!.titleAr).toBe(before)
  })
})

describe('④ بند «ما ينتظرك» يصل الطابور — ولمن يملك القرار وحده', () => {
  it('⚠️ يفتح «الكتالوج» على الطابور — لا «النشر»', async () => {
    const inbox = new StaffInboxService(prisma)
    const item = (await inbox.forStaff(MAKER, ROLE_PERMISSIONS.academic_manager as readonly string[]))
      .find((i) => i.key === 'content_review')
    expect(item?.count, 'لا طلب ينتظر — والحارس يحتاج واحدا').toBeGreaterThan(0)
    expect(item?.href).toBe('/admin/catalog?requests=1')
  })

  it('ولا يراه من يرد عن زر القرار', async () => {
    const inbox = new StaffInboxService(prisma)
    const keys = async (perms: string[]) => (await inbox.forStaff(MAKER, perms)).map((i) => i.key)
    expect(await keys(['catalog.view', 'catalog.course.review']), 'رآه من يرد عن القرار بـ٤٠٣').not.toContain('content_review')
    expect(await keys(['catalog.view', 'catalog.content.final_approve'])).not.toContain('content_review')
    expect(await keys(['catalog.view', 'catalog.pathway.review'])).toContain('content_review')
  })
})
