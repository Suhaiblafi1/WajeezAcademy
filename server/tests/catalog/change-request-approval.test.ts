/* اعتمادُ طلبِ تغييرٍ — و«يُرفَع ما هو موجود».

   ═══ العطبُ الذي كُتب له ═══

   طلبُ التغيير ليس دائما تغييرا على صفٍّ قائم. منه ما هو **طلبُ ميلاد**:
   `skill_request` معرّفُه «مَزلَقُ» مهارةٍ لم تُخلَق بعد، ومعرّفٌ لدورةٍ
   مقترحةٍ لا صفَّ لها في `Course`.

   وكان `promoteEntity` يكتب `update({ where: { id } })` في كلّ حال — فيرمي
   Prisma الرمزَ `P2025`، وتُلغى المعاملةُ كلُّها، **ويرى المراجعُ ٥٠٠ بلا
   سبب** على أنّ قرارَه سليمٌ ومكتوبٌ وقد سُجّل في `ContentApprovalDecision`
   قبل أن يُلغى معها.

   ولم يُحرَس ببادئةٍ في الاسم: البادئةُ تحرس صنفا واحدا، والأصنافُ أكثر.
   فالقاعدةُ تُسأل عنها القاعدةُ نفسُها: **أهذا الصفُّ موجود؟**

   ═══ وهذا الملفُّ كان اسمُه `trainer-course-suggestion` ═══

   حرس طريقا ثانيا لاقتراح دورةٍ من مدرّب، أُزيل بقرار صاحب المنصّة حين
   تبيّن أنّ الطريقَ مبنيٌّ مرّتَين. وحُفظت منه هذه الحرّاسُ وحدَها لأنّ
   ما تحرسه ليس ذلك الطريقَ بل **قاعدةَ الاعتماد المشتركة** — وهي حيّةٌ
   بعده، يمرّ عليها طلبُ المهارة وكلُّ طلبِ تغييرٍ في المنصّة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { CatalogAdminService } from '../../services/catalog-admin.service'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let admin: CatalogAdminService
let auth: AuthService
let app: FastifyInstance
let courseId = ''
/* دورةٌ ثانيةٌ لاختبارِ السلك — فلا يتقاسم حارسان صفّا واحدا فيحجب أحدُهما
   سقوطَ الآخر */
let wireCourseId = ''
let superCookie = ''
let superId = ''
let managerCookie = ''

const ACTOR = '00000000-0000-0000-0000-00000000000a'
const CHECKER = '00000000-0000-0000-0000-00000000000b'
const SELF_APPROVE = 'catalog.self_approve'
const STAMP = Date.now()

async function sessionFor(email: string, role: string): Promise<{ cookie: string; userId: string }> {
  const password = 'SelfApprove#12345'
  const u = await auth.register(email, password, role)
  await auth.setRoles(u.userId, [role])
  const { token } = await auth.login(email, password)
  return { cookie: `${SESSION_COOKIE}=${token}`, userId: u.userId }
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  admin = new CatalogAdminService(prisma)
  auth = new AuthService(prisma)
  app = await buildApp(prisma)
  await app.ready()
  const courses = await prisma.course.findMany({ select: { id: true }, orderBy: { id: 'asc' }, take: 2 })
  courseId = courses[0]!.id
  wireCourseId = courses[1]!.id

  const boss = await sessionFor(`self-super-${STAMP}@test.local`, 'super_admin')
  superCookie = boss.cookie
  superId = boss.userId
  const manager = await sessionFor(`self-acad-${STAMP}@test.local`, 'academic_manager')
  managerCookie = manager.cookie
}, 240_000)

describe('يُرفَع ما هو موجود', () => {
  /* ═══ الصنفُ الأوّل: مهارةٌ تُطلَب ولم تُخلَق ═══

     شاشةُ الكتالوج تفتح بابا واحدا لطلب مهارةٍ جديدة، فتكتب طلبَ تغييرٍ
     صنفُه `skill` ومعرّفُه اسمٌ لا صفَّ له في `Skill`. */
  it('مهارةٌ طُلب ميلادُها تُعتمد ولا تصطدم بصفٍّ معدوم', async () => {
    const cr = await admin.submitChangeRequest(
      'skill', 'mahara-la-tujad',
      { kind: 'skill_request', slug: 'mahara-la-tujad', nameAr: 'مهارةٌ مطلوبة', reasonAr: 'يحتاجها مؤلّف' },
      ACTOR,
    )
    const done = await admin.decide(cr.id, 'approve', 'مهارةٌ وجيهة', CHECKER)
    expect(done.status).toBe('approved')
    expect(
      await prisma.skill.findUnique({ where: { id: 'mahara-la-tujad' } }),
      'وُلدت مهارةٌ من باب القرار — والمهارةُ تُخلق حيث تُربط بالكتالوج',
    ).toBeNull()
  })

  /* والصنفُ الثاني: دورةٌ لم تُؤلَّف بعد */
  it('ودورةٌ لا صفَّ لها تُعتمد قرارا ولا تُخلَق بابا خلفيّا', async () => {
    const cr = await admin.submitChangeRequest(
      'course', 'C-LA-YUJAD',
      { kind: 'proposed_course', titleAr: 'تحليلُ الأثر الاجتماعيّ' },
      ACTOR,
    )
    const done = await admin.decide(cr.id, 'approve', 'مقترحٌ وجيه', CHECKER)
    expect(done.status).toBe('approved')
    expect(
      await prisma.course.findUnique({ where: { id: 'C-LA-YUJAD' } }),
      'وُلدت دورةٌ في الكتالوج من باب القرار لا من باب التأليف',
    ).toBeNull()
  })

  /* ═══ ولا يُسكِت الإصلاحُ الرفعَ حيث يجب أن يقع ═══

     حارسٌ بلا هذا نصفُ حارس: «لا يرمي» تتحقّق أيضا بـ`return` دائم. */
  it('وصفٌّ قائمٌ يُرفع كما كان — فالإصلاحُ لم يُعطّل الرفع', async () => {
    const cr = await admin.submitChangeRequest('course', courseId, { kind: 'tidy' }, ACTOR)
    const done = await admin.decide(cr.id, 'approve', 'تعديلٌ مقبول', CHECKER)
    expect(done.status).toBe('approved')
    const row = await prisma.course.findUnique({ where: { id: courseId } })
    expect(row?.status, 'الدورةُ القائمةُ لم تُرفع').toBe('approved')
  })
})

/* ═══ ومن يعتمد ما قدّمه بنفسه ═══

   maker-checker باقيةٌ قاعدةً، واستثناؤها حبّةٌ واحدةٌ يملكها المديرُ الأعلى
   وحدَه (`catalog.self_approve`). وحراسةُ ذلك تقع في **موضعَين لا واحد**:

   · في الخدمة — أنّ الحبّةَ هي التي تفتح، وأنّ فراغَها يُبقي الردَّ ٤٠٣.
   · وعلى السلك — أنّ المسارَ يمرّر صلاحيّاتِ الجلسة أصلا.

   والثاني ليس تزيّدا: لو صحّت الخدمةُ ونسي المسارُ تمريرَ `permissions`
   لَخضرّ حارسُ الخدمةِ كاملا **والزرُّ يردّ ٤٠٣ في وجه صاحب المنصّة** — وهو
   بعينه الخضارُ لسببٍ خاطئ الذي تحذّر منه قواعدُ المستودَع. */
describe('استثناءُ maker-checker — حبّةٌ تفتح، وفراغُها يُبقي الباب', () => {
  it('بلا الحبّة: ما قدّمتَه يُردّ عليك — والقاعدةُ على من دون المدير الأعلى باقية', async () => {
    const cr = await admin.submitChangeRequest('course', courseId, { kind: 'self_no_grant' }, ACTOR)
    await expect(
      admin.decide(cr.id, 'approve', 'أعتمدُ نفسي', ACTOR),
      'اعتُمد طلبٌ قدّمه صاحبُه بلا حبّةِ الاستثناء',
    ).rejects.toMatchObject({ code: 'maker_checker' })
    const after = await prisma.contentChangeRequest.findUnique({ where: { id: cr.id } })
    expect(after?.status, 'الطلبُ تحرّك رغم الردّ').toBe('in_review')
  })

  it('وبالحبّة: يُعتمد ويُرفع كيانُه كما يرفعه مراجعٌ ثانٍ', async () => {
    await prisma.course.update({ where: { id: courseId }, data: { status: 'draft' } })
    const cr = await admin.submitChangeRequest('course', courseId, { kind: 'self_with_grant' }, ACTOR)
    const done = await admin.decide(cr.id, 'approve', 'أعتمدُها', ACTOR, [SELF_APPROVE])
    expect(done.status).toBe('approved')
    const row = await prisma.course.findUnique({ where: { id: courseId } })
    expect(row?.status, 'اعتُمد الطلبُ ولم يُرفع كيانُه — فالاستثناءُ فتح بابا لا يوصل').toBe('approved')
  })

  it('ويُكتب اعتمادُ الذات في سجلّ الأثر — فلا يمرّ تخطّي الحاجزِ صامتا', async () => {
    await prisma.course.update({ where: { id: courseId }, data: { status: 'draft' } })
    const cr = await admin.submitChangeRequest('course', courseId, { kind: 'self_audited' }, ACTOR)
    await admin.decide(cr.id, 'approve', 'بسببٍ مكتوب', ACTOR, [SELF_APPROVE])
    const event = await prisma.auditEvent.findFirst({
      where: { action: 'catalog.change_request.self_approve', entityId: cr.id },
    })
    expect(event, 'اعتمادُ ذاتٍ وقع بلا أثرٍ يُقرأ في `/admin/audit`').not.toBeNull()
    expect(event?.actorId, 'الأثرُ لا يقول من اعتمد').toBe(ACTOR)
    expect(event?.reason, 'سببُ الاعتماد لم يُحفظ مع أثره').toBe('بسببٍ مكتوب')
  })

  it('واعتمادُ مراجعٍ ثانٍ لا يُكتب أثرَ ذاتٍ — وإلّا لم يميّز السجلُّ الحالتَين', async () => {
    const cr = await admin.submitChangeRequest('course', courseId, { kind: 'other_checker' }, ACTOR)
    await admin.decide(cr.id, 'approve', 'اعتمادٌ عاديّ', CHECKER, [SELF_APPROVE])
    const event = await prisma.auditEvent.findFirst({
      where: { action: 'catalog.change_request.self_approve', entityId: cr.id },
    })
    expect(event, 'كُتب اعتمادُ ذاتٍ على قرارِ مراجعٍ ثانٍ').toBeNull()
  })

  /* الردُّ إلى النفس ليس تخطّيا لحاجز: الحاجزُ على ما يمضي قُدُما */
  it('وردُّ المرءِ عملَه إلى نفسه لا يُكتب أثرَ استثناء', async () => {
    const cr = await admin.submitChangeRequest('course', courseId, { kind: 'self_return' }, ACTOR)
    const done = await admin.decide(cr.id, 'request_changes', 'أعيدُها إليّ', ACTOR, [SELF_APPROVE])
    expect(done.status).toBe('changes_requested')
    const event = await prisma.auditEvent.findFirst({
      where: { action: 'catalog.change_request.self_approve', entityId: cr.id },
    })
    expect(event, 'كُتب «اعتمادُ ذات» على ردٍّ لا اعتماد').toBeNull()
  })

  /* ═══ وعلى السلك — حيث يقف صاحبُ المنصّة فعلا ═══ */
  it('مديرُ النظام الأعلى يقدّم طلبَه ويعتمده من الشاشة نفسِها', async () => {
    await prisma.course.update({ where: { id: wireCourseId }, data: { status: 'draft' } })
    const made = await app.inject({
      method: 'POST', url: '/api/admin/catalog/change-requests', headers: { cookie: superCookie },
      payload: { entityType: 'course', entityId: wireCourseId, payload: { kind: 'wire_self' } },
    })
    expect(made.statusCode, 'لم يُقبل تقديمُ الطلب أصلا').toBe(201)
    const crId = (made.json() as { id: string }).id

    const decided = await app.inject({
      method: 'POST', url: `/api/admin/catalog/change-requests/${crId}/decision`,
      headers: { cookie: superCookie }, payload: { decision: 'approve', noteAr: 'أعتمدُها بنفسي' },
    })
    expect(
      decided.statusCode,
      `رُدّ اعتمادُ المدير الأعلى لطلبِه: ${decided.body} — المسارُ لا يمرّر صلاحيّاتِ الجلسة`,
    ).toBe(200)
    const row = await prisma.course.findUnique({ where: { id: wireCourseId } })
    expect(row?.status).toBe('approved')
    const event = await prisma.auditEvent.findFirst({
      where: { action: 'catalog.change_request.self_approve', entityId: crId },
    })
    expect(event?.actorId, 'أثرُ اعتماد الذات لا يحمل صاحبَ الجلسة').toBe(superId)
  })

  it('والمديرُ الأكاديميُّ يُردّ عن طلبِه هو — ولا يُردّ عن طلبِ غيره', async () => {
    const mine = await app.inject({
      method: 'POST', url: '/api/admin/catalog/change-requests', headers: { cookie: managerCookie },
      payload: { entityType: 'course', entityId: wireCourseId, payload: { kind: 'wire_manager_self' } },
    })
    expect(mine.statusCode).toBe(201)
    const mineId = (mine.json() as { id: string }).id
    const refused = await app.inject({
      method: 'POST', url: `/api/admin/catalog/change-requests/${mineId}/decision`,
      headers: { cookie: managerCookie }, payload: { decision: 'approve' },
    })
    expect(refused.statusCode, 'اعتمد المديرُ الأكاديميُّ طلبَه — والحبّةُ ليست له').toBe(403)
    expect((refused.json() as { error?: { code?: string } }).error?.code).toBe('maker_checker')

    /* وأنّ الردَّ سببُه «طلبُك أنت» لا «لا تملك المراجعة»: طلبُ غيرِه يمرّ */
    const fromSuper = await app.inject({
      method: 'POST', url: '/api/admin/catalog/change-requests', headers: { cookie: superCookie },
      payload: { entityType: 'course', entityId: wireCourseId, payload: { kind: 'wire_cross' } },
    })
    const crossId = (fromSuper.json() as { id: string }).id
    const allowed = await app.inject({
      method: 'POST', url: `/api/admin/catalog/change-requests/${crossId}/decision`,
      headers: { cookie: managerCookie }, payload: { decision: 'approve' },
    })
    expect(
      allowed.statusCode,
      'رُدّ المديرُ الأكاديميُّ عن طلبِ غيره — فالـ٤٠٣ أعلاه ليس عن اعتمادِ الذات',
    ).toBe(200)
  })
})
