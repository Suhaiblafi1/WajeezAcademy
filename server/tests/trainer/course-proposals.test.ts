/* دوراتٌ يقترحها المدرّبُ — على قاعدةٍ حقيقيّة (ح-٢ · ح-٤).

   حرّاسُ `src/tests` بنيويّون: يقرؤون الشيفرةَ ويحكمون على شكلها. وهذا
   يُشغّلها: يُعتمد متقدّمٌ فعلا، وتُبذَر اقتراحاتُه فعلا، ويُردّ ما يجب ردُّه
   برقمِ حالته. فالبنيةُ الصحيحةُ قد لا تعمل، وما لا يُشغَّل لا يُعرف.

   وأخطرُ ما هنا **البذرُ مرّتَين**: `ensureProfile` تُستدعى في أكثرَ من مسار،
   ولو بُذرت بلا شرطٍ لتضاعفت اقتراحاتُ المدرّب كلّما مُسّ ملفُّه. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerApplicationService } from '../../services/trainer-application.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { CourseProposalService } from '../../services/course-proposal.service'

let prisma: PrismaClient
let auth: AuthService
let apps: TrainerApplicationService
let review: TrainerReviewService
let proposals: CourseProposalService
let adminId: string
let courseId: string

const base = {
  phoneCountryCode: '+962', phone: '771050000', country: 'الأردن', timezone: 'Asia/Amman',
  jobTitle: 'مدرّب أتمتة', specialties: ['الأتمتة'],
  domainYears: '8-12' as const, trainingYears: 'formal_teaching',
  bio: 'خبرةٌ ميدانيّة', trainingLanguages: ['العربية'], deliveryMode: 'both' as const,
  motivation: 'درّبتُ فرقا حقيقيّةً في بيئات عملٍ عربيّة، وأعرف الفرقَ بين من يعرف المادّة ومن يستطيع تعليمها. سأعطي كلَّ متعلّمٍ مهمّةً من واقع عمله في كلّ وحدة، وأراجع مخرجاته بنفسي وأكتب له ما ينقصه تحديدا لا تقييما عاما.',
  privacyConsent: true as const,
  password: 'Trainer#12345',
}

/** متقدّمٌ كاملٌ باقتراحاتِ دوراتٍ في طلبه — ثمّ يُعتمد فيصير مدرّبا */
async function approvedTrainer(
  email: string,
  fullName: string,
  teachableProposals: { titleAr: string; audienceAr: string }[],
) {
  const res = await apps.submitPhase1({ ...base, email, fullName })
  const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference: res.reference } })
  await apps.completePhase2(res.reference, res.candidateToken, {
    previousCourses: [], teachableCourseIds: [], availability: { seasons: ['nov_jan'] },
    demoConsent: true, contact: { channel: 'email' }, teachableProposals,
  })
  await prisma.trainerApplication.update({ where: { id: row.id }, data: { emailVerifiedAt: new Date() } })
  await review.decide(row.id, adminId, 'approve', 'اعتماد للاختبار')
  const profile = await prisma.trainerProfile.findUniqueOrThrow({ where: { applicationId: row.id } })
  return { applicationId: row.id, profileId: profile.id, userId: res.userId }
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  apps = new TrainerApplicationService(prisma)
  review = new TrainerReviewService(prisma)
  proposals = new CourseProposalService(prisma)
  const admin = await auth.register('admin-proposals@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])

  /* دورةٌ قائمةٌ يُربط بها الاقتراحُ — بإصدارها، فالاسمُ يسكن الإصدارَ */
  /* والمسارُ كالدورة: اسمُه في إصداره لا فيه — `Pathway` رمزٌ وحالة */
  const pw = await prisma.pathway.create({ data: { id: 'PW-PROP-1', status: 'published' } })
  const c = await prisma.course.create({
    data: { id: 'C-PROP-101', status: 'published', currentVersion: 1, homePathwayId: pw.id },
  })
  await prisma.courseVersion.create({
    data: { courseId: c.id, version: 1, titleAr: 'دورةُ الأتمتة القائمة', totalHours: 12 },
  })
  courseId = c.id
}, 180_000)

describe('ح-٢ — اقتراحاتُه تُبذَر من طلبه ثمّ يملكها', () => {
  it('تُبذَر عند الاعتماد بحالة «مقدَّمة» — لا مسوّدةً تنتظر تقديما لن يأتي', async () => {
    const t = await approvedTrainer('prop-seed@test.local', 'سامي المدرّب', [
      { titleAr: 'أتمتةُ التقارير الماليّة', audienceAr: 'محاسبون' },
      { titleAr: 'الربطُ بين التطبيقات بلا برمجة', audienceAr: '' },
    ])
    const rows = await prisma.trainerCourseProposal.findMany({ where: { profileId: t.profileId } })
    expect(rows.length, 'لم تُبذَر اقتراحاتُه — فتحَ بوّابتَه ولم يجد ما كتبه').toBe(2)
    for (const r of rows) expect(r.status).toBe('submitted')
    expect(rows.map((r) => r.titleAr)).toContain('أتمتةُ التقارير الماليّة')
    /* و«لمن هي» الفارغةُ تبقى فارغةً لا نصّا فارغا */
    expect(rows.find((r) => r.titleAr.startsWith('الربطُ'))!.audienceAr).toBeNull()
  })

  it('وسجلُّ ما قدّمه في طلبه يبقى كما هو — لا يُنقل ولا يُفرَّغ', async () => {
    const t = await approvedTrainer('prop-keep@test.local', 'ريم المدرّبة', [
      { titleAr: 'تحليلُ العمليّات', audienceAr: 'مدراء تشغيل' },
    ])
    const app = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: t.applicationId } })
    expect(app.teachableProposals, 'فُرِّغ سجلُّ ما قرأه المعتمِد').not.toBeNull()
    expect(JSON.stringify(app.teachableProposals)).toContain('تحليلُ العمليّات')
  })

  it('ولا تُبذَر مرّتَين ولو أُعيد الاعتماد — فلا تتضاعف اقتراحاتُه', async () => {
    const t = await approvedTrainer('prop-twice@test.local', 'خالد المدرّب', [
      { titleAr: 'بناءُ لوحات المتابعة', audienceAr: 'محلّلون' },
    ])
    const first = await prisma.trainerCourseProposal.count({ where: { profileId: t.profileId } })
    /* اعتمادٌ ثانٍ على الطلب نفسِه — `ensureProfile` تُعاد على ملفٍّ قائم */
    await review.decide(t.applicationId, adminId, 'approve', 'اعتمادٌ مكرّر').catch(() => undefined)
    const again = await prisma.trainerCourseProposal.count({ where: { profileId: t.profileId } })
    expect(again, 'تضاعفت اقتراحاتُه بإعادة الاعتماد').toBe(first)
  })

  it('ويعدّل ويحذف ما لم يُبتّ فيه', async () => {
    const t = await approvedTrainer('prop-edit@test.local', 'ليلى المدرّبة', [
      { titleAr: 'عنوانٌ أوّل', audienceAr: 'فئةٌ أولى' },
    ])
    const [row] = await prisma.trainerCourseProposal.findMany({ where: { profileId: t.profileId } })

    await proposals.edit(t.userId, row.id, { titleAr: 'عنوانٌ مصحَّح', audienceAr: 'فئةٌ أخرى' })
    const edited = await prisma.trainerCourseProposal.findUniqueOrThrow({ where: { id: row.id } })
    expect(edited.titleAr).toBe('عنوانٌ مصحَّح')

    await proposals.remove(t.userId, row.id)
    expect(await prisma.trainerCourseProposal.findUnique({ where: { id: row.id } })).toBeNull()
  })

  it('ولا يمسّ اقتراحَ غيره — ويُردّ بأنّه غيرُ موجودٍ لا بأنّه ممنوع', async () => {
    const a = await approvedTrainer('prop-mine@test.local', 'أحمد المدرّب', [
      { titleAr: 'دورتي أنا', audienceAr: '' },
    ])
    const b = await approvedTrainer('prop-other@test.local', 'بشرى المدرّبة', [
      { titleAr: 'دورتها هي', audienceAr: '' },
    ])
    const [hers] = await prisma.trainerCourseProposal.findMany({ where: { profileId: b.profileId } })
    await expect(proposals.remove(a.userId, hers.id)).rejects.toMatchObject({ status: 404 })
    /* ولم تُحذف فعلا */
    expect(await prisma.trainerCourseProposal.findUnique({ where: { id: hers.id } })).not.toBeNull()
  })
})

describe('ح-٤ — التصنيفُ قبل الكتالوج', () => {
  it('«نسخةٌ من رمزٍ قائم» تربط ولا تُنشئ إصدارا باسم صاحبها', async () => {
    const t = await approvedTrainer('prop-link@test.local', 'فادي المدرّب', [
      { titleAr: 'أتمتةٌ للمحاسبين', audienceAr: 'محاسبون' },
    ])
    const [row] = await prisma.trainerCourseProposal.findMany({ where: { profileId: t.profileId } })
    const versionsBefore = await prisma.courseVersion.count({ where: { courseId } })

    const out = await proposals.linkToCourse(adminId, row.id, courseId)
    expect(out.status).toBe('linked')
    expect(out.courseId).toBe(courseId)
    expect(out.decidedBy).toBe(adminId)

    const versionsAfter = await prisma.courseVersion.count({ where: { courseId } })
    expect(versionsAfter, 'الربطُ أنشأ إصدارا — وهو ما لم يكتبه المدرّب').toBe(versionsBefore)
    /* ولا اقتراحَ تعديلٍ انتُحل باسمه */
    expect(await prisma.trainerChangeRequest.count({ where: { profileId: t.profileId } })).toBe(0)
  })

  it('وما بُتّ فيه لا يعدّله صاحبُه ولا يحذفه', async () => {
    const t = await approvedTrainer('prop-frozen@test.local', 'نور المدرّبة', [
      { titleAr: 'دورةٌ ستُصنَّف', audienceAr: '' },
    ])
    const [row] = await prisma.trainerCourseProposal.findMany({ where: { profileId: t.profileId } })
    await proposals.linkToCourse(adminId, row.id, courseId)

    await expect(proposals.edit(t.userId, row.id, { titleAr: 'محاولةُ تعديل' }))
      .rejects.toMatchObject({ status: 409 })
    await expect(proposals.remove(t.userId, row.id)).rejects.toMatchObject({ status: 409 })

    const still = await prisma.trainerCourseProposal.findUniqueOrThrow({ where: { id: row.id } })
    expect(still.titleAr, 'عُدّل ما بُتّ فيه').toBe('دورةٌ ستُصنَّف')
  })

  it('والرفضُ بلا سببٍ يُردّ — وبسببٍ يصل صاحبَه', async () => {
    const t = await approvedTrainer('prop-reject@test.local', 'زيد المدرّب', [
      { titleAr: 'دورةٌ مغطّاة', audienceAr: '' },
    ])
    const [row] = await prisma.trainerCourseProposal.findMany({ where: { profileId: t.profileId } })

    await expect(proposals.reject(adminId, row.id, '  ')).rejects.toMatchObject({ status: 400 })
    const untouched = await prisma.trainerCourseProposal.findUniqueOrThrow({ where: { id: row.id } })
    expect(untouched.status, 'رُفض بلا سبب').toBe('submitted')

    await proposals.reject(adminId, row.id, 'مغطّاةٌ في C-PROP-101 ولا تضيف مهارةً جديدة')
    const mine = await proposals.mine(t.userId)
    const seen = mine.find((p) => p.id === row.id)!
    expect(seen.status).toBe('rejected')
    expect(seen.decisionNoteAr, 'رُفض ولا يعرف صاحبُه لماذا').toContain('مغطّاة')
  })

  it('وطابورُ الإدارة يجمع اقتراحاتِ المدرّبين كلِّهم بأسمائهم', async () => {
    const t = await approvedTrainer('prop-queue@test.local', 'هالة المدرّبة', [
      { titleAr: 'دورةٌ في الطابور', audienceAr: 'فئةٌ ما' },
    ])
    const open = await proposals.queue('open')
    const row = open.find((r) => r.profileId === t.profileId)
    expect(row, 'لم تصل الإدارةَ').toBeTruthy()
    expect(row!.trainerName, 'الطابورُ بلا اسمِ من اقترح').toBe('هالة المدرّبة')
    expect(row!.titleAr).toBe('دورةٌ في الطابور')

    /* والمصنَّفُ يخرج من طابور «ما لم يُصنَّف» ويبقى في «الكلّ» */
    await proposals.linkToCourse(adminId, row!.id, courseId)
    expect((await proposals.queue('open')).some((r) => r.id === row!.id)).toBe(false)
    const all = await proposals.queue('all')
    const decided = all.find((r) => r.id === row!.id)!
    expect(decided.status).toBe('linked')
    /* وعنوانُ الدورة يُقرأ من إصدارها الجاري */
    expect(decided.courseTitleAr).toBe('دورةُ الأتمتة القائمة')
  })
})
