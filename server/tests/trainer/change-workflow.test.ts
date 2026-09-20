/* اختبار E2E لسير اقتراحات تعديل الدورات من المدرب:
   تأهيل → اقتراح تعديل محور → لا يُنشر مباشرة → طلب تعديل → اعتماد → نشر بالنطاق →
   حماية الحقول المحظورة → maker-checker → عدم اقتراح غير المؤهل → خطة شعبة منفصلة.

   ⚠ البند هـ-١: نطاق الكتالوج صار صلاحية تُمنح لا حقا يُفترض. فمدرب الاختبار
   يُمنح الصلاحية صراحة في الإعداد — كما يفعل مدير أكاديمي حقيقي — ويبقى
   اختبار البوابة نفسها على مدرب بلا منح. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { makeReadyForApproval } from '../helpers/trainer-ready'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService, RUBRIC_CRITERIA } from '../../services/trainer-review.service'
import { CHANGE_TYPES, TrainerChangeService } from '../../services/trainer-change.service'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let changes: TrainerChangeService
let managerId: string
let trainerUserId = ''
let profileId = ''
const COURSE = 'C-BIZ-101'

const scores = () => Object.fromEntries(RUBRIC_CRITERIA.map((k) => [k, 5])) as Record<string, number>

/** طريق مختصر لمدرب معتمد ونشط — عبر الدورة الرسمية نفسها */
async function makeActiveTrainer(email: string, name: string) {
  const apps = new (await import('../../services/trainer-application.service')).TrainerApplicationService(prisma)
  const p1 = await apps.submitPhase1({
    fullName: name, email, specialties: ['إدارة المشاريع والعمليات'],
    domainYears: '8-12', trainingYears: 'formal_teaching',
    trainingLanguages: ['العربية'], deliveryMode: 'remote',
    motivation: 'أريد الانضمام إلى وجيز لأنني درّبت فرقا حقيقية في بيئات عمل عربية، وأعرف الفرق بين من يعرف المادة ومن يستطيع تعليمها. سأقدّم للمتعلمين مهمة تطبيقية من واقع عملهم في كل وحدة، وأراجع مخرجاتهم بنفسي وأكتب لكل واحد ما ينقصه تحديدا لا تقييما عاما.', privacyConsent: true,
    password: 'Trainer#12345',
  })
  /* الطلبُ مسودّةٌ حتّى يُكمَل — الإكمالُ يجعله مقدَّما */
  await apps.completePhase2(p1.reference, p1.candidateToken, {
    previousCourses: [], teachableCourseIds: [], availability: {}, demoConsent: true, contact: { channel: 'email' },
  })
  const app = await prisma.trainerApplication.findUnique({ where: { reference: p1.reference } })
  await review.decide(app!.id, managerId, 'move_to_review')
  await review.decide(app!.id, managerId, 'shortlist')
  await review.scheduleInterview(app!.id, managerId, { scheduledAt: new Date() })
  await review.decide(app!.id, managerId, 'request_demo')
  await review.recordDemoEvaluation(app!.id, managerId, scores(), 'pass')
  await review.decide(app!.id, managerId, 'academic_review')
  await review.decide(app!.id, managerId, 'conditionally_approve')
  const contract = await review.createContract(app!.id, managerId, { title: 'عقد اختبار' })
  await review.signContract(contract.id, managerId)
  /* للمتقدّم حسابٌ منذ تقديمه — التفعيلُ يربطه بملفّه ويمنحه دورَ المدرّب */
  /* والتجهيزُ يسبق الاعتماد منذ ٢٠ سبتمبر ٢٠٢٦ — والبوّابةُ في `readiness-gate` */
  await makeReadyForApproval(prisma, app!.id, managerId)
  await review.decide(app!.id, managerId, 'activate')
  const profile = await prisma.trainerProfile.findUnique({ where: { applicationId: app!.id } })
  return { userId: profile!.userId!, profileId: profile!.id }
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  /* قناة البريد مفعّلة بمضيف لا يستجيب — البوابة البريدية تبقى قائمة كما صُمّمت.
     (قناة غير مفعّلة تُسقط البوابة عمدا؛ لها اختبارها المستقل في applications.) */
  /* إعدادُ Resend لا SMTP: انتقل الإرسالُ إلى Resend، فبقاءُ `host`/`port` هنا
     يجعل القناةَ تُقرأ «غير مهيّأة» لا «مفعّلةً تخفق». والوجهةُ الميّتة تأتي من
     `RESEND_BASE_URL` فلا يخرج الفحصُ إلى الشبكة. */
  process.env.RESEND_BASE_URL = 'http://127.0.0.1:1'
  await prisma.integrationSetting.upsert({
    where: { provider: 'email' },
    update: { enabled: true, config: { apiKey: 're_test_key', fromName: 'أكاديمية وجيز', fromEmail: 'no-reply@test.local' } },
    create: { provider: 'email', enabled: true, config: { apiKey: 're_test_key', fromName: 'أكاديمية وجيز', fromEmail: 'no-reply@test.local' } },
  })
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  changes = new TrainerChangeService(prisma)
  const m = await auth.register('change-manager@test.local', 'Manager#12345', 'مدير أكاديمي')
  managerId = m.userId
  await auth.setRoles(managerId, ['academic_manager'])
  const t = await makeActiveTrainer('change-trainer@test.local', 'مدرب التعديلات')
  trainerUserId = t.userId
  profileId = t.profileId
  /* هـ-١: منح صريح لنطاق الكتالوج — بدونه تُرفض كل اقتراحات هذا الملف بحق */
  await changes.grantCatalogScope(profileId, managerId, true)
}, 240_000)

describe('هـ-١ نطاق الشعبة هو الافتراضي', () => {
  it('مدرب بلا منح ولا سجل: نطاق الكتالوج مرفوض، ونطاق الشعبة مفتوح', async () => {
    const other = await makeActiveTrainer('scope-trainer@test.local', 'مدرب بلا منح')
    await prisma.trainerCourseQualification.upsert({
      where: { profileId_courseId: { profileId: other.profileId, courseId: COURSE } },
      update: { status: 'qualified' },
      create: { profileId: other.profileId, courseId: COURSE, status: 'qualified', qualifiedBy: managerId },
    })
    const gate = await changes.catalogScopeFor(other.profileId)
    expect(gate.allowed).toBe(false)
    expect(gate.basis).toBe('none')

    await expect(changes.submit(other.userId, {
      courseId: COURSE, scope: 'catalog', reason: 'محاولة اقتراح بنطاق الكتالوج بلا صلاحية',
      items: [{ changeType: 'module_title_edit', targetKey: `${COURSE}-M1`, afterValue: { titleAr: 'عنوان' } }],
    })).rejects.toThrow(/سجل مثبت|منح صريح/)
  })

  it('المنح الصريح يفتح النطاق، وسحبه يغلقه', async () => {
    const granted = await changes.grantCatalogScope(profileId, managerId, true)
    expect(granted.grantedAt).not.toBeNull()
    expect((await changes.catalogScopeFor(profileId)).basis).toBe('granted')
    await changes.grantCatalogScope(profileId, managerId, false)
    expect((await changes.catalogScopeFor(profileId)).allowed).toBe(false)
    /* نعيد المنح: بقية الملف يعتمد عليه */
    await changes.grantCatalogScope(profileId, managerId, true)
  })
})

describe('سير اقتراحات التعديل', () => {
  it('1) غير المؤهل لا يقترح — وبعد التأهيل يقترح', async () => {
    await expect(changes.submit(trainerUserId, {
      courseId: COURSE, scope: 'catalog', reason: 'تحسين عنوان محور قائم',
      items: [{ changeType: 'module_title_edit', targetKey: `${COURSE}-M1`, afterValue: { titleAr: 'عنوان أفضل' } }],
    })).rejects.toMatchObject({ code: 'not_qualified' })

    await review.qualifyForCourse(profileId, COURSE, managerId)
  })

  it('2) الحقول المحظورة مرفوضة — السعر وقواعد التشخيص والمهارات والنشر', async () => {
    await expect(changes.submit(trainerUserId, {
      courseId: COURSE, scope: 'catalog', reason: 'محاولة تعديل سعر',
      items: [{ changeType: 'module_title_edit', targetKey: `${COURSE}-M1`, afterValue: { titleAr: 'x', priceUsd: 99 } }],
    })).rejects.toMatchObject({ code: 'forbidden_field' })
  })

  let requestId = ''
  let baseVersion = 0
  let firstModuleId = ''

  it('3) اقتراح تعديل محور يُسجل ولا يغير المنشور', async () => {
    const course = await prisma.course.findUnique({
      where: { id: COURSE },
      include: { modules: { include: { versions: { orderBy: { version: 'desc' }, take: 1 } } } },
    })
    baseVersion = course!.currentVersion
    firstModuleId = course!.modules
      .sort((a, b) => (a.versions[0]?.sequence ?? 0) - (b.versions[0]?.sequence ?? 0))[0].id

    const req = await changes.submit(trainerUserId, {
      courseId: COURSE, scope: 'catalog', reason: 'عنوان المحور الحالي غامض للمتعلمين الجدد',
      evidence: 'ملاحظات من شعبتين سابقتين',
      items: [{
        changeType: 'module_title_edit', targetKey: firstModuleId,
        beforeValue: { titleAr: 'العنوان القديم' }, afterValue: { titleAr: 'أساسيات العمليات — مدخل عملي' },
      }],
    })
    requestId = req.id
    expect(req.status).toBe('submitted')

    /* المنشور لم يتغير */
    const after = await prisma.course.findUnique({ where: { id: COURSE } })
    expect(after!.currentVersion).toBe(baseVersion)
  })

  it('4) المدرب لا يعتمد اقتراحه بنفسه (maker-checker)', async () => {
    await expect(changes.decide(requestId, trainerUserId, 'approve_for_catalog'))
      .rejects.toMatchObject({ code: 'maker_checker' })
  })

  it('5) المسؤول يطلب تعديلا ثم يعتمد للكتالوج', async () => {
    const r1 = await changes.decide(requestId, managerId, 'request_changes', 'وضّح عنوان الوحدة أكثر')
    expect(r1.status).toBe('changes_requested')
    const r2 = await changes.decide(requestId, managerId, 'approve_for_catalog', 'معتمد كإصدار جديد')
    expect(r2.status).toBe('approved_for_catalog')
  })

  it('ب-٢) النشر بنطاق الكتالوج مرفوض قبل فحص الأثر التشخيصي', async () => {
    await expect(changes.publish(requestId, managerId)).rejects.toThrow(/فحص أثره التشخيصي/)
    expect((await changes.impactChecked(requestId)).checked).toBe(false)
  })

  it('6) النشر ينشئ إصدارا جديدا بالعنوان المعدل ويبقي الإصدار السابق', async () => {
    /* ب-٢: الفحص شرط النشر بنطاق الكتالوج — كما يفعل المعتمِد في الشاشة */
    const { analyzeImpact } = await import('../../services/impact.service')
    await analyzeImpact(prisma, TrainerChangeService.impactRef(requestId), managerId)
    expect((await changes.impactChecked(requestId)).checked).toBe(true)
    await changes.publish(requestId, managerId)
    const course = await prisma.course.findUnique({
      where: { id: COURSE },
      include: {
        versions: { orderBy: { version: 'desc' } },
        modules: { where: { id: firstModuleId }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } } },
      },
    })
    expect(course!.currentVersion).toBe(baseVersion + 1)
    expect(course!.versions.length).toBeGreaterThanOrEqual(2)
    expect(course!.modules[0].versions[0].titleAr).toBe('أساسيات العمليات — مدخل عملي')
    const done = await prisma.trainerChangeRequest.findUnique({ where: { id: requestId } })
    expect(done!.status).toBe('published')
  })

  it('7) اقتراح نطاق شعبة يُنشر كخطة تنفيذ دون تغيير الكتالوج', async () => {
    const cohort = await review.createCohort(managerId, { courseId: COURSE, title: 'شعبة سبتمبر 2026' })
    const req = await changes.submit(trainerUserId, {
      courseId: COURSE, scope: 'cohort', cohortId: cohort.id,
      reason: 'أمثلة محلية أنسب لهذه الشعبة تحديدا',
      items: [{ changeType: 'examples_update', targetKey: firstModuleId, afterValue: { text: 'مثال: شركة أردنية ناشئة' } }],
    })
    await changes.decide(req.id, managerId, 'approve_for_cohort', 'معتمد لهذه الشعبة فقط')
    await changes.publish(req.id, managerId)

    const plan = await prisma.cohortDeliveryPlan.findFirst({ where: { cohortId: cohort.id, status: 'published' } })
    expect(plan).toBeTruthy()
    expect(plan!.sourceChangeRequestId).toBe(req.id)

    /* الكتالوج لم يتغير بهذا النشر */
    const course = await prisma.course.findUnique({ where: { id: COURSE } })
    expect(course!.currentVersion).toBe(baseVersion + 1)
  })

  it('8) الاعتماد بنطاق غير مطابق مرفوض، والرفض بلا سبب مرفوض', async () => {
    const req = await changes.submit(trainerUserId, {
      courseId: COURSE, scope: 'catalog', reason: 'اقتراح آخر للتحقق من القواعد',
      items: [{ changeType: 'duration_propose', afterValue: { totalHours: 12 } }],
    })
    await expect(changes.decide(req.id, managerId, 'approve_for_cohort')).rejects.toMatchObject({ code: 'scope_mismatch' })
    await expect(changes.decide(req.id, managerId, 'reject')).rejects.toMatchObject({ code: 'no_reason' })
    await changes.decide(req.id, managerId, 'reject', 'لا حاجة حاليا')
    const r = await prisma.trainerChangeRequest.findUnique({ where: { id: req.id } })
    expect(r!.status).toBe('rejected')
  })

  it('9) الاقتراح المسحوب لا يُبت فيه', async () => {
    const req = await changes.submit(trainerUserId, {
      courseId: COURSE, scope: 'catalog', reason: 'اقتراح سيسحبه صاحبه بنفسه',
      items: [{ changeType: 'activity_add', targetKey: firstModuleId, afterValue: { text: 'نشاط إضافي' } }],
    })
    await changes.withdraw(trainerUserId, req.id)
    await expect(changes.decide(req.id, managerId, 'approve_for_catalog', 'متأخر')).rejects.toMatchObject({ code: 'bad_state' })
  })

  it('10) كل قرارات الاقتراحات موثقة في سجل التدقيق', async () => {
    const audits = await prisma.auditEvent.findMany({
      where: { entityType: 'trainer_change_request', entityId: requestId },
    })
    const actions = audits.map((a) => a.action)
    expect(actions).toContain('trainer.change.submit')
    expect(actions).toContain('trainer.change.decide')
    expect(actions).toContain('trainer.change.publish')
  })
})

/* ═══ ق٥: بابُ اسم الدورة مغلقٌ — من جذره لا من شاشته ═══

   كان هنا وصفٌ يحرس القناةَ التي فتحها ح-٣: المدرّبُ يقترح اسما، فيمرّ
   بـmaker-checker وينتهي **إصدارا جديدا** باسمه الجديد، والقديمُ باقٍ
   باسمه لمن صدرت شهادتُه عليه. وكان ذلك صوابا في موضعه.

   ثمّ أغلق صاحبُ المنصّة القناةَ كلَّها (١٧ سبتمبر ٢٠٢٦): «بابُ اسم الدورة
   يُغلق» — قناةٌ لا يملكها أحدٌ أسوأُ من لا قناة.

   ═══ وما يُقاس هنا ═══

   والإغلاقُ يُقاس عند **جذره**: `CHANGE_TYPES`. فحذفُ الشاشة والمسلك يترك
   `submit` مفتوحةً لكلِّ من يناديها — وهو بعينه عطبُ «المساراتِ الميّتة»
   الذي حُذفت له أربعةُ مسالكَ في هذه المنصّة من قبل. والنوعُ لمّا خرج من
   القائمة صار الردُّ في موضعٍ واحدٍ يمرّ به كلُّ نداء (`bad_change_type`).

   ولا يُقاس بغياب كلمةٍ من ملفّ: يُنادى البابُ فعلا فيُردّ. */
describe('ق٥ بابُ اسم الدورة مغلقٌ من جذره', () => {
  const RENAMED = 'إدارةُ العمليات — من التخطيط إلى القياس'

  it('⚠️ لا نوعَ تغييرٍ لاسم الدورة في القائمة — والنوعُ هو البابُ لا الشاشة', () => {
    expect(CHANGE_TYPES as readonly string[], 'عاد نوعُ الاسم، فعاد البابُ لكلّ من ينادي `submit`')
      .not.toContain('course_title_edit')
  })

  it('⚠️ واقتراحٌ يحمله يُردّ من الخدمة — ولو نُودي `submit` مباشرةً بلا شاشة', async () => {
    await expect(changes.submit(trainerUserId, {
      courseId: COURSE, scope: 'catalog',
      reason: 'الاسمُ الحاليُّ يصف الأداةَ لا المهارةَ التي يخرج بها المتعلّم',
      items: [{ changeType: 'course_title_edit' as never, targetKey: COURSE, afterValue: { titleAr: RENAMED } }],
    })).rejects.toMatchObject({ code: 'bad_change_type' })
  })

  it('⚠️ ولا يُكتب شيءٌ خلف الردّ — لا طلبَ يُولَد ثمّ يُهمَل', async () => {
    const before = await prisma.trainerChangeRequest.count()
    await expect(changes.submit(trainerUserId, {
      courseId: COURSE, scope: 'catalog', reason: 'محاولةٌ ثانيةٌ بالنوع المغلق',
      items: [{ changeType: 'course_title_edit' as never, targetKey: COURSE, afterValue: { titleAr: RENAMED } }],
    })).rejects.toMatchObject({ code: 'bad_change_type' })
    expect(await prisma.trainerChangeRequest.count(), 'وُلد طلبٌ لا تعرف الشاشةُ كيف تعرضه').toBe(before)
  })

  it('⚠️ والنشرُ يُبقي اسمَ الإصدار الأساس — لا بندَ يبدّله بعد اليوم', async () => {
    const course = await prisma.course.findUniqueOrThrow({ where: { id: COURSE }, select: { currentVersion: true } })
    const titleBefore = (await prisma.courseVersion.findUniqueOrThrow({
      where: { courseId_version: { courseId: COURSE, version: course.currentVersion } },
    })).titleAr

    const { analyzeImpact } = await import('../../services/impact.service')
    const req = await changes.submit(trainerUserId, {
      courseId: COURSE, scope: 'catalog', reason: 'محورٌ جديدٌ يكمل الفجوةَ بين الثاني والثالث',
      items: [{ changeType: 'module_add', afterValue: { titleAr: 'محورٌ مكمّل', hours: 2 } }],
    })
    await changes.decide(req.id, managerId, 'approve_for_catalog', 'محورٌ في موضعه')
    await analyzeImpact(prisma, TrainerChangeService.impactRef(req.id), managerId)
    await changes.publish(req.id, managerId)

    const after = await prisma.course.findUniqueOrThrow({ where: { id: COURSE }, select: { currentVersion: true } })
    expect(after.currentVersion, 'لم يُنشَر إصدارٌ أصلا — تعطّل الفحصُ نفسُه').toBe(course.currentVersion + 1)
    const fresh = await prisma.courseVersion.findUniqueOrThrow({
      where: { courseId_version: { courseId: COURSE, version: after.currentVersion } },
    })
    expect(fresh.titleAr, 'تبدّل اسمُ الدورة في إصدارٍ لا بندَ اسمٍ فيه').toBe(titleBefore)
  })
})
