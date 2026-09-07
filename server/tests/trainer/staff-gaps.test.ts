/* ثلاثُ فجواتٍ في منصّات العاملين — وحرسُها (البنود ٢٢ · ٢٤ · ٢٥).

   ٢٢ · **تعيينُ مدرّبٍ داخليّا لم يكن موجودا إطلاقا.** ملفُّ المدرّب لا
        يُنشأ في الخادم كلِّه إلّا داخلَ البتّ في طلبٍ عامّ، وطلبُ الانضمام
        لا يُنشأ إلّا من النموذجِ العامّ بلا مصادقة. فمن أراد المديرُ
        تعيينَه ملأ له النموذجَ بنفسه — أو أنشأ حسابا بدور «مدرّب» فاصطدم
        صاحبُه بجدارِ «بلا ملفّ مدرّب»، ولا يُؤهَّل ولا يُسنَد.

   ٢٤ · **جرسُ المدرّب فارغٌ شبهَ دائم.** التعيينُ والتأهيلُ لا يكتبان
        إشعارا، وفي الخادم كلِّه مساران يكتبان إشعارا للمدرّب. فيُؤهَّل
        ويُسنَد ولا يعلم.

   ٢٥ · **المستشارُ لا يُدخل من قابله، ولا يعلم بإسنادٍ إليه.** الحالاتُ
        تولد من متعلّمٍ مسجَّلٍ أنهى التشخيص ثمّ يُسنِدها إداريّ، والإسنادُ
        لا يكتب إشعارا — فتُكتشَف الحالاتُ بإعادة التحميل. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { AdvisorService } from '../../services/advisor.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let auth: AuthService
let app: FastifyInstance
let review: TrainerReviewService
let advisors: AdvisorService
let superCookie = ''
let academicCookie = ''
let opsCookie = ''
let advisorId = ''

async function cookieFor(email: string, password: string): Promise<string> {
  const { token } = await auth.login(email, password)
  return `${SESSION_COOKIE}=${token}`
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  /* قناةُ بريدٍ مفعّلةٌ بوجهةٍ ميّتة: البوّابةُ قائمةٌ ولا يخرج الفحصُ للشبكة */
  process.env.RESEND_BASE_URL = 'http://127.0.0.1:1'
  await prisma.integrationSetting.upsert({
    where: { provider: 'email' },
    update: { enabled: true, config: { apiKey: 're_test_key', fromName: 'أكاديمية وجيز', fromEmail: 'no-reply@test.local' } },
    create: { provider: 'email', enabled: true, config: { apiKey: 're_test_key', fromName: 'أكاديمية وجيز', fromEmail: 'no-reply@test.local' } },
  })
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  advisors = new AdvisorService(prisma)
  app = await buildApp(prisma)

  const su = await auth.register('gaps-super@test.local', 'Super#12345', 'المدير الأعلى')
  await auth.setRoles(su.userId, ['super_admin'])
  superCookie = await cookieFor('gaps-super@test.local', 'Super#12345')

  /* المديرُ الأكاديميّ: يملك قرارَ المدرّبين ولا يملك الحسابات */
  const am = await auth.register('gaps-academic@test.local', 'Acad#12345', 'مدير أكاديمي')
  await auth.setRoles(am.userId, ['academic_manager'])
  academicCookie = await cookieFor('gaps-academic@test.local', 'Acad#12345')

  const om = await auth.register('gaps-ops@test.local', 'Ops#12345', 'مدير عمليات')
  await auth.setRoles(om.userId, ['operations_manager'])
  opsCookie = await cookieFor('gaps-ops@test.local', 'Ops#12345')

  const adv = await auth.register('gaps-advisor@test.local', 'Advisor#12345', 'مستشار')
  await auth.setRoles(adv.userId, ['advisor'])
  advisorId = adv.userId
}, 240_000)

describe('٢٢ · تعيينُ مدرّبٍ داخليّا — شاشةٌ واحدة، ثلاثةُ حقول، نقرة', () => {
  it('النقرةُ تُنشئ الأربعةَ معا: حسابا وطلبا نشطا وملفّا ودورا', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/admin/trainers/direct', headers: { cookie: superCookie },
      payload: { fullName: 'زميلٌ عُيّن داخليّا', email: 'direct-trainer@test.local', headline: 'مدرّبُ قيادة' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()

    const application = await prisma.trainerApplication.findUnique({ where: { id: body.applicationId } })
    expect(application!.status, 'الطلبُ يولد نشطا — لا مسوّدةً تنتظر بتّا').toBe('active')
    expect(application!.reference).toMatch(/^WJ-TR-/)

    const profile = await prisma.trainerProfile.findUnique({ where: { id: body.profileId } })
    expect(profile, 'بلا ملفٍّ يصطدم صاحبُه بجدارِ «حسابٌ بلا ملفّ مدرّب»').toBeTruthy()
    expect(profile!.userId, 'ملفٌّ بلا حسابٍ لا يفتح بوّابةً ولا يُسنَد إليه').toBe(body.userId)

    const roles = await prisma.userRole.findMany({ where: { userId: body.userId } })
    expect(roles.map((r) => r.roleId)).toContain('trainer')

    /* مهامُّ التهيئةِ نفسُها التي يبذرها الاعتمادُ من الطابور */
    const tasks = await prisma.trainerOnboardingTask.findMany({ where: { profileId: body.profileId } })
    expect(tasks.length).toBe(4)
  })

  it('ولا ظهورَ عامّا ولا توثيقَ بريدٍ يُدَّعى — المديرُ يشهد بالشخص لا بالعنوان', async () => {
    const application = await prisma.trainerApplication.findFirst({ where: { email: 'direct-trainer@test.local' } })
    expect(application!.emailVerifiedAt, 'توثيقُ البريدِ فعلُ صاحبِه لا شهادةُ غيره').toBeNull()
    const profile = await prisma.trainerProfile.findUnique({ where: { applicationId: application!.id } })
    expect(profile!.publicVisibility).toBe(false)
    expect(profile!.publishApprovedAt).toBeNull()
  })

  it('والمعيَّنُ داخليّا يُؤهَّل ويُسنَد فورا — وهذا كلُّ غرضِ البند', async () => {
    const application = await prisma.trainerApplication.findFirst({ where: { email: 'direct-trainer@test.local' } })
    const profile = await prisma.trainerProfile.findUnique({ where: { applicationId: application!.id } })
    const course = await prisma.course.findFirst()
    expect(course, 'الكتالوجُ فارغٌ — تعذّر فحصُ التأهيل').toBeTruthy()
    const q = await review.qualifyForCourse(profile!.id, course!.id, advisorId)
    expect(q.status).toBe('qualified')
  })

  it('ولا يُنشأ ثانٍ لمن له طلبٌ قائم — الطابورُ لا يُطمَس', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/admin/trainers/direct', headers: { cookie: superCookie },
      payload: { fullName: 'مكرَّر', email: 'direct-trainer@test.local' },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().error.message_ar).toContain('طلبٌ قائم')
  })

  it('والحارسُ قبّعتان لا واحدة: الحساباتُ وقرارُ المدرّبين معا', async () => {
    /* المديرُ الأكاديميّ يملك القرارَ ولا يملك الحسابات */
    const r1 = await app.inject({
      method: 'POST', url: '/api/admin/trainers/direct', headers: { cookie: academicCookie },
      payload: { fullName: 'لا يمرّ', email: 'nope-1@test.local' },
    })
    expect(r1.statusCode).toBe(403)
    /* ومديرُ العمليّات لا يملك أيّا منهما */
    const r2 = await app.inject({
      method: 'POST', url: '/api/admin/trainers/direct', headers: { cookie: opsCookie },
      payload: { fullName: 'لا يمرّ', email: 'nope-2@test.local' },
    })
    expect(r2.statusCode).toBe(403)

    /* ── والقبّعةُ الثانيةُ تُقاس وحدَها ──

       حارسُ المسار `admin.users.manage` يردّ الدورَين أعلاه قبل أن يُسأل
       عن القرار — فلا يُثبتان شيئا عن الشرط الثاني. فهذا حسابٌ يملك
       الحساباتِ ومنزوعٌ منه قرارُ المدرّبين وحدَه: بلا الشرط الثاني يمرّ. */
    const half = await auth.register('gaps-half@test.local', 'Half#12345', 'يملك الحسابات وحدها')
    await auth.setRoles(half.userId, ['super_admin'])
    await prisma.userPermission.create({
      data: {
        userId: half.userId, permissionKey: 'trainer.applications.decide', effect: 'deny',
        reason: 'فحصُ الشرط الثاني: الحساباتُ بلا قرارِ المدرّبين',
      },
    })
    const halfCookie = await cookieFor('gaps-half@test.local', 'Half#12345')
    const r3 = await app.inject({
      method: 'POST', url: '/api/admin/trainers/direct', headers: { cookie: halfCookie },
      payload: { fullName: 'لا يمرّ', email: 'nope-3@test.local' },
    })
    expect(r3.statusCode, 'صلاحيةُ الحسابات وحدَها بابٌ جانبيٌّ حول الطابور').toBe(403)
    expect(r3.json().error.message_ar).toContain('قرارَ المدرّبين')

    expect(await prisma.trainerApplication.count({ where: { email: { startsWith: 'nope-' } } })).toBe(0)
  })
})

describe('٢٤ · جرسُ المدرّب — التأهيلُ والإسنادُ خبران يبلغان صاحبَهما', () => {
  it('التأهيلُ يكتب إشعارا في بوّابة المدرّب — لا في بوّابةِ متعلّم', async () => {
    const application = await prisma.trainerApplication.findFirst({ where: { email: 'direct-trainer@test.local' } })
    const profile = await prisma.trainerProfile.findUnique({ where: { applicationId: application!.id } })
    const notes = await prisma.notification.findMany({ where: { userId: profile!.userId! } })
    const qualified = notes.filter((n) => n.templateKey === 'trainer.qualified')
    expect(qualified.length, 'أُهِّل ولم يعلم').toBeGreaterThan(0)
    expect(qualified[0].audience, 'خبرُ عملٍ يقع في بوّابة العمل').toBe('trainer')
  })

  it('والإسنادُ كذلك — ويحمل اسمَ الشعبة', async () => {
    const application = await prisma.trainerApplication.findFirst({ where: { email: 'direct-trainer@test.local' } })
    const profile = await prisma.trainerProfile.findUnique({ where: { applicationId: application!.id } })
    const course = await prisma.course.findFirst()
    const cohort = await prisma.cohort.create({
      data: { courseId: course!.id, title: 'شعبةُ الإشعار', status: 'draft', startsAt: new Date(Date.now() + 86_400_000) },
    })
    await review.assignToCohort(profile!.id, course!.id, cohort.id, advisorId)
    const notes = await prisma.notification.findMany({
      where: { userId: profile!.userId!, templateKey: 'trainer.assigned' },
    })
    expect(notes.length, 'أُسنِد ولم يعلم').toBeGreaterThan(0)
    expect(notes[0].body).toContain('شعبةُ الإشعار')
    expect(notes[0].audience).toBe('trainer')
  })

  it('ولا يُخترع صفٌّ لمن لا حسابَ له — «نشطٌ» بلا حسابٍ لا جرسَ له', async () => {
    const before = await prisma.notification.count()
    /* ملفٌّ بلا حساب: يُنشأ مباشرةً لأنّ المسارات كلَّها تشترط الحساب */
    const orphan = await prisma.trainerApplication.create({
      data: { reference: 'WJ-TR-ORPHAN-1', email: 'orphan@test.local', fullName: 'بلا حساب', status: 'active' },
    })
    const orphanProfile = await prisma.trainerProfile.create({ data: { applicationId: orphan.id } })
    const course = await prisma.course.findFirst()
    await review.qualifyForCourse(orphanProfile.id, course!.id, advisorId)
    expect(await prisma.notification.count(), 'صفٌّ لا يقرؤه أحد').toBe(before)
  })
})

describe('٢٥ · المستشار — يُدخل من قابله، ويعلم بما أُسنِد إليه', () => {
  it('الإسنادُ يكتب إشعارا — كانت الحالاتُ تُكتشَف بإعادة التحميل', async () => {
    const lead = await prisma.lead.create({ data: { fullName: 'عميلُ الإسناد', email: 'assigned-lead@test.local', source: 'diagnostic' } })
    const kase = await prisma.advisorCase.create({ data: { leadId: lead.id } })
    await advisors.assign(kase.id, advisorId, advisorId)
    const notes = await prisma.notification.findMany({
      where: { userId: advisorId, templateKey: 'advisor.case.assigned' },
    })
    expect(notes.length).toBe(1)
    expect(notes[0].body).toContain('عميلُ الإسناد')
    expect(notes[0].audience, 'بوّابةُ المستشار تقرأ جرسَها من جمهور الموظّفين').toBe('staff')
  })

  it('ويُدخل من قابله — والحالةُ تُسنَد إليه في الفعل نفسِه', async () => {
    const kase = await advisors.createOwnCase(advisorId, {
      fullName: 'من قابلتُه في المعرض', phone: '+962790000000', note: 'لقاءٌ أوّلٌ في معرض التعليم — يسأل عن مسار القيادة',
    })
    const link = await prisma.advisorAssignment.findFirst({ where: { caseId: kase.id, unassignedAt: null } })
    expect(link!.advisorId, 'من أدخله هو صاحبُه — لا طابورُ إسنادٍ ثانٍ').toBe(advisorId)
    const note = await prisma.advisorNote.findFirst({ where: { caseId: kase.id } })
    expect(note!.body).toContain('معرض التعليم')
  })

  it('ولا تشخيصَ يُدَّعى لمن لم يُقَس', async () => {
    const kase = await prisma.advisorCase.findFirst({ where: { lead: { fullName: 'من قابلتُه في المعرض' } } })
    expect(kase!.diagnosticSnapshot, 'ما لم يُقَس لا يُكتب').toBeNull()
  })

  it('وحالةٌ بلا سبيلٍ إلى صاحبها لا تُفتح', async () => {
    await expect(advisors.createOwnCase(advisorId, { fullName: 'بلا قناة' }))
      .rejects.toThrow(/بريدٌ أو هاتف/)
  })

  it('ولا حالتان مفتوحتان لبريدٍ واحد — ولو أدخله اثنان', async () => {
    await advisors.createOwnCase(advisorId, { fullName: 'أوّل', email: 'dup-client@test.local' })
    await expect(advisors.createOwnCase(advisorId, { fullName: 'ثانٍ', email: 'dup-client@test.local' }))
      .rejects.toThrow(/حالةٌ مفتوحة/)
  })
})
