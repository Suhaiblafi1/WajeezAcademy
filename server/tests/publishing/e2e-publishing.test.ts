/* اختبار E2E لدورة نشر كاملة — من إنشاء مهارة إلى rollback، عبر الخدمات وHTTP.
   السيناريو المطلوب: إنشاء مهارة → دورة → مسار → فشل نشر بنقص متعمد → استكمال →
   محاكاة → اعتماد (maker-checker) → نشر → ظهور في اللقطة → بقاء النتائج القديمة → rollback */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService, AuthError } from '../../services/auth.service'
import { CatalogAdminService } from '../../services/catalog-admin.service'
import { PublishingService } from '../../services/publishing.service'
import { analyzeImpact } from '../../services/impact.service'
import { buildApp } from '../../http/app'

/** الشكل الأدنى من حمولة اللقطة الذي يفحصه هذا الاختبار */
interface SnapshotPayload {
  skills: { skills: { skill_id: string }[] }
  coreCatalog: {
    launch_pathways: { id: string }[]
    courses: { course_id: string }[]
    skill_extensions: { skill_id: string }[]
  }
}

let prisma: PrismaClient
let auth: AuthService
let admin: CatalogAdminService
let pub: PublishingService
let makerId: string
let checkerId: string

const S = 'E2E' // بادئة معرفات الاختبار

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  admin = new CatalogAdminService(prisma)
  pub = new PublishingService(prisma)

  /* مستخدمان: صانع ومراجع — maker-checker */
  const m = await auth.register('e2e-maker@test.local', 'Maker#12345', 'صانع المحتوى')
  const c = await auth.register('e2e-checker@test.local', 'Checker#12345', 'المراجع الأكاديمي')
  makerId = m.userId
  checkerId = c.userId
  await auth.setRoles(makerId, ['academic_manager'])
  await auth.setRoles(checkerId, ['academic_manager'])
}, 180_000)

describe('دورة النشر الكاملة', () => {
  it('1) إنشاء مهارة ودورة ومسار كمسودات', async () => {
    const skill = await admin.createSkill({ id: `SK-X-${S}-001`, slug: `e2e_skill_${Date.now()}`, nameAr: 'مهارة اختبار شاملة', familyId: 'COG' }, makerId)
    expect(skill.status).toBe('draft')

    const course = await admin.createCourse({
      id: `C-${S}-001`, pathwayId: 'PW-STU-003', sequence: 9, titleAr: 'دورة اختبار النشر الشامل',
      totalHours: 8, skillIds: [`SK-X-${S}-001`],
      modules: [{ sequence: 1, titleAr: 'وحدة الاختبار الأولى', hours: 8 }],
    }, makerId)
    expect(course.status).toBe('draft')

    const pathway = await admin.createPathway({
      id: `PW-${S}-001`, title: 'مسار اختبار النشر', beforeText: 'قبل', afterText: 'بعد',
      durationWeeks: 4, weeklyHours: '4–5', level: 'تمهيدي', capstone: 'مشروع تخرج اختباري',
      courseIds: [`C-${S}-001`],
    }, makerId)
    expect(pathway.status).toBe('draft')

    /* المسودات لا تتسرب إلى اللقطة المنشورة */
    const snap = await import('../../catalog/snapshot-builder').then((m) => m.buildSnapshotFromDb(prisma))
    const skillIds = [
      ...(snap.payload as unknown as SnapshotPayload).skills.skills.map((s) => s.skill_id),
      ...(snap.payload as unknown as SnapshotPayload).coreCatalog.skill_extensions.map((s) => s.skill_id),
    ]
    expect(skillIds).not.toContain(`SK-X-${S}-001`)
  })

  it('2) فشل النشر بنقص متعمد — كيانات معتمدة الحالة بلا طلب تغيير موثق', async () => {
    /* رفع يدوي متعمد خارج الحوكمة لمحاكاة خلل */
    await prisma.skill.update({ where: { id: `SK-X-${S}-001` }, data: { status: 'approved' } })
    const validation = await pub.validateDrafts()
    expect(validation.ok).toBe(false)
    expect(validation.errors.join('|')).toContain('maker-checker')

    const v = await pub.createDraftVersion(`e2e-${Date.now()}`, makerId)
    await expect(pub.publish(v.id, makerId)).rejects.toThrow(AuthError)
    /* لا شيء نُشر جزئيا */
    const skill = await prisma.skill.findUnique({ where: { id: `SK-X-${S}-001` } })
    expect(skill!.status).toBe('approved')
    const vAfter = await prisma.catalogVersion.findUnique({ where: { id: v.id } })
    expect(vAfter!.status).toBe('draft')
  })

  it('3) maker-checker: المنع ثم الاعتماد من مراجع آخر', async () => {
    await prisma.skill.update({ where: { id: `SK-X-${S}-001` }, data: { status: 'draft' } })

    for (const [entityType, entityId] of [['skill', `SK-X-${S}-001`], ['course', `C-${S}-001`], ['pathway', `PW-${S}-001`]] as const) {
      const cr = await admin.submitChangeRequest(entityType, entityId, { action: 'create' }, makerId)
      await expect(admin.decide(cr.id, 'approve', undefined, makerId)).rejects.toThrow(AuthError) // اعتماد الذات ممنوع
      const done = await admin.decide(cr.id, 'approve', 'سليم', checkerId)
      expect(done.status).toBe('approved')
    }

    const statuses = await Promise.all([
      prisma.skill.findUnique({ where: { id: `SK-X-${S}-001` } }),
      prisma.course.findUnique({ where: { id: `C-${S}-001` } }),
      prisma.pathway.findUnique({ where: { id: `PW-${S}-001` } }),
    ])
    expect(statuses.map((s) => s!.status)).toEqual(['approved', 'approved', 'approved'])
  })

  it('4) التحقق + تحليل الأثر ثم النشر الذري', async () => {
    /* ج-١ · ج-٣: مسار ناقص لا يُنشر — بلا مجال لا يدخل مطابقة احتياج المستخدم،
       وبلا جمهور يطابق الجميع، وبلا جمهور مكتوب لا يعرف المتعلم لمن المسار.
       الحاجز يُثبت هنا داخل الدورة الحقيقية، ثم يُفتح بالأبواب المخصصة لا بكتابة خام.
       والرسائل هي نصوص خطوات الجاهزية نفسها — تعريفٌ واحد لا نسختان. */
    const incomplete = await pub.validateDrafts()
    expect(incomplete.ok).toBe(false)
    const joined = incomplete.errors.join(' | ')
    expect(joined).toContain(`pathway PW-${S}-001 · المجال: بلا مجال`)
    expect(joined).toContain(`pathway PW-${S}-001 · الجمهور والهدف`)
    expect(joined).toContain(`pathway PW-${S}-001 · بيانات المسار`)

    await expect(admin.setPathwayDomains(`PW-${S}-001`, ['not_a_domain'])).rejects.toThrow(AuthError)
    await admin.setPathwayDomains(`PW-${S}-001`, ['career_direction'])
    await expect(admin.setPathwayProfile(`PW-${S}-001`, { personas: ['not_a_persona'], goals: ['career_direction'] }))
      .rejects.toThrow(AuthError)
    await admin.setPathwayProfile(`PW-${S}-001`, { personas: ['student'], goals: ['career_direction'] })
    /* الجمهور المكتوب: حقل نصّي على إصدار المحتوى لا على الملف التشخيصي */
    await prisma.pathwayVersion.updateMany({
      where: { pathwayId: `PW-${S}-001` },
      data: { audience: 'طالب جامعي يريد تحديد مجاله قبل التخرج' },
    })

    const validation = await pub.validateDrafts()
    expect(validation.ok, validation.errors.join(' | ')).toBe(true)

    const impact = await analyzeImpact(prisma, 'E2E: مسار اختبار النشر', makerId)
    expect(impact.totalPersonas).toBe(12)

    const before = await prisma.catalogVersion.findFirst({ where: { status: 'published' } })
    const v = await pub.createDraftVersion(`e2e-pub-${Date.now()}`, makerId)
    const result = await pub.publish(v.id, checkerId)

    expect(result.version.status).toBe('published')

    /* اللقطة الفعالة تحوي الجديد */
    const { getActiveSnapshot } = await import('../../catalog/snapshot-builder')
    const active = await getActiveSnapshot(prisma)
    const payload = active!.payload as unknown as SnapshotPayload
    /* أعداد النشر يجب أن تطابق ما وصل فعلا إلى اللقطة — بلا أرقام جامدة:
       الكتالوج المضمّن يتطور، والاختبار يحمي الاتساق لا الحجم */
    expect(result.counts.pathways).toBe(payload.coreCatalog.launch_pathways.length)
    expect(result.counts.courses).toBe(payload.coreCatalog.courses.length)
    expect(result.counts.skills).toBe(payload.skills.skills.length + payload.coreCatalog.skill_extensions.length)

    /* الإصدار السابق superseded */
    const old = await prisma.catalogVersion.findUnique({ where: { id: before!.id } })
    expect(old!.status).toBe('superseded')

    expect(payload.coreCatalog.launch_pathways.map((p) => p.id)).toContain(`PW-${S}-001`)
    expect(payload.coreCatalog.courses.map((c) => c.course_id)).toContain(`C-${S}-001`)
    expect(payload.coreCatalog.skill_extensions.map((s) => s.skill_id)).toContain(`SK-X-${S}-001`)
  })

  it('5) لقطة الإصدار القديم لم تتغير — النتائج القديمة محفوظة', async () => {
    const old = await prisma.catalogVersion.findFirst({ where: { label: 'catalog-v2.0-import' }, include: { snapshots: true } })
    expect(old!.snapshots[0].payloadHash).toMatch(/^[0-9a-f]{64}$/)
    const payload = old!.snapshots[0].payload as unknown as SnapshotPayload
    expect(payload.coreCatalog.launch_pathways).toHaveLength(20) // بلا أثر رجعي
  })

  it('6) rollback يعيد اللقطة القديمة كنشر جديد', async () => {
    const old = await prisma.catalogVersion.findFirst({ where: { label: 'catalog-v2.0-import' } })
    const rb = await pub.rollback(old!.id, checkerId, 'اختبار E2E')
    const { getActiveSnapshot } = await import('../../catalog/snapshot-builder')
    const active = await getActiveSnapshot(prisma)
    expect(active!.hash).toBe(rb.snapshotHash)
    const payload = active!.payload as unknown as SnapshotPayload
    expect(payload.coreCatalog.launch_pathways).toHaveLength(20)
  })
})

describe('المصادقة عبر HTTP', () => {
  it('register/login/me/logout + حراسة الصلاحيات', async () => {
    const app = await buildApp(prisma)

    const bad = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'e2e-maker@test.local', password: 'wrong-pass' } })
    expect(bad.statusCode).toBe(401)
    expect(bad.json().error.code).toBe('bad_credentials')

    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'e2e-maker@test.local', password: 'Maker#12345' } })
    expect(login.statusCode).toBe(200)
    const cookie = login.cookies.find((c) => c.name === 'wajeez_session')!
    expect(cookie.httpOnly).toBe(true)

    const me = await app.inject({ method: 'GET', url: '/api/auth/me', cookies: { wajeez_session: cookie.value } })
    expect(me.json().user.roles).toContain('academic_manager')

    /* learner بلا صلاحيات يُمنع من لوحة الإدارة */
    await auth.register('e2e-learner@test.local', 'Learner#12345', 'متعلم')
    const lLogin = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'e2e-learner@test.local', password: 'Learner#12345' } })
    const lCookie = lLogin.cookies.find((c) => c.name === 'wajeez_session')!
    const forbidden = await app.inject({ method: 'GET', url: '/api/admin/catalog/overview', cookies: { wajeez_session: lCookie.value } })
    expect(forbidden.statusCode).toBe(403)

    /* اللقطة العامة متاحة بلا دخول */
    const snap = await app.inject({ method: 'GET', url: '/api/catalog/active-snapshot' })
    expect(snap.statusCode).toBe(200)

    await app.close()
  })

  it('استعادة كلمة المرور تبطل الجلسات', async () => {
    const { tokenForDelivery } = await auth.requestPasswordReset('e2e-learner@test.local')
    expect(tokenForDelivery).toBeTruthy()
    const login = await auth.login('e2e-learner@test.local', 'Learner#12345')
    await auth.resetPassword(tokenForDelivery!, 'NewPass#12345')
    expect(await auth.resolve(login.token)).toBeNull() // الجلسة القديمة باطلة
    const relogin = await auth.login('e2e-learner@test.local', 'NewPass#12345')
    expect(relogin.token).toBeTruthy()
  })
})
