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
import { tokensAr } from '../../../src/application/trainer/proposal-match'

let prisma: PrismaClient
let auth: AuthService
let apps: TrainerApplicationService
let review: TrainerReviewService
let proposals: CourseProposalService
let adminId: string
/** الفاعلُ برتبته: تصنيفُ الاقتراح يفتح مهمّةً، و`StaffTaskService` تقيس الرتبة */
let actor: { userId: string; roles: string[] }
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
  teachableProposals: { titleAr: string; summaryAr: string }[],
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
  actor = { userId: adminId, roles: ['academic_manager'] }

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
      { titleAr: 'أتمتةُ التقارير الماليّة', summaryAr: 'محاسبون' },
      { titleAr: 'الربطُ بين التطبيقات بلا برمجة', summaryAr: '' },
    ])
    const rows = await prisma.trainerCourseProposal.findMany({ where: { profileId: t.profileId } })
    expect(rows.length, 'لم تُبذَر اقتراحاتُه — فتحَ بوّابتَه ولم يجد ما كتبه').toBe(2)
    for (const r of rows) expect(r.status).toBe('submitted')
    expect(rows.map((r) => r.titleAr)).toContain('أتمتةُ التقارير الماليّة')
    /* والنبذةُ الفارغةُ تبقى فارغةً لا نصّا فارغا */
    expect(rows.find((r) => r.titleAr.startsWith('الربطُ'))!.summaryAr).toBeNull()
  })

  it('وسجلُّ ما قدّمه في طلبه يبقى كما هو — لا يُنقل ولا يُفرَّغ', async () => {
    const t = await approvedTrainer('prop-keep@test.local', 'ريم المدرّبة', [
      { titleAr: 'تحليلُ العمليّات', summaryAr: 'مدراء تشغيل' },
    ])
    const app = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: t.applicationId } })
    expect(app.teachableProposals, 'فُرِّغ سجلُّ ما قرأه المعتمِد').not.toBeNull()
    expect(JSON.stringify(app.teachableProposals)).toContain('تحليلُ العمليّات')
  })

  it('ولا تُبذَر مرّتَين ولو أُعيد الاعتماد — فلا تتضاعف اقتراحاتُه', async () => {
    const t = await approvedTrainer('prop-twice@test.local', 'خالد المدرّب', [
      { titleAr: 'بناءُ لوحات المتابعة', summaryAr: 'محلّلون' },
    ])
    const first = await prisma.trainerCourseProposal.count({ where: { profileId: t.profileId } })
    /* اعتمادٌ ثانٍ على الطلب نفسِه — `ensureProfile` تُعاد على ملفٍّ قائم */
    await review.decide(t.applicationId, adminId, 'approve', 'اعتمادٌ مكرّر').catch(() => undefined)
    const again = await prisma.trainerCourseProposal.count({ where: { profileId: t.profileId } })
    expect(again, 'تضاعفت اقتراحاتُه بإعادة الاعتماد').toBe(first)
  })

  it('ويعدّل ويحذف ما لم يُبتّ فيه', async () => {
    const t = await approvedTrainer('prop-edit@test.local', 'ليلى المدرّبة', [
      { titleAr: 'عنوانٌ أوّل', summaryAr: 'فئةٌ أولى' },
    ])
    const [row] = await prisma.trainerCourseProposal.findMany({ where: { profileId: t.profileId } })

    await proposals.edit(t.userId, row.id, { titleAr: 'عنوانٌ مصحَّح', summaryAr: 'فئةٌ أخرى' })
    const edited = await prisma.trainerCourseProposal.findUniqueOrThrow({ where: { id: row.id } })
    expect(edited.titleAr).toBe('عنوانٌ مصحَّح')

    await proposals.remove(t.userId, row.id)
    expect(await prisma.trainerCourseProposal.findUnique({ where: { id: row.id } })).toBeNull()
  })

  it('ولا يمسّ اقتراحَ غيره — ويُردّ بأنّه غيرُ موجودٍ لا بأنّه ممنوع', async () => {
    const a = await approvedTrainer('prop-mine@test.local', 'أحمد المدرّب', [
      { titleAr: 'دورتي أنا', summaryAr: '' },
    ])
    const b = await approvedTrainer('prop-other@test.local', 'بشرى المدرّبة', [
      { titleAr: 'دورتها هي', summaryAr: '' },
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
      { titleAr: 'أتمتةٌ للمحاسبين', summaryAr: 'محاسبون' },
    ])
    const [row] = await prisma.trainerCourseProposal.findMany({ where: { profileId: t.profileId } })
    const versionsBefore = await prisma.courseVersion.count({ where: { courseId } })

    const out = await proposals.linkToCourse(actor, row.id, courseId)
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
      { titleAr: 'دورةٌ ستُصنَّف', summaryAr: '' },
    ])
    const [row] = await prisma.trainerCourseProposal.findMany({ where: { profileId: t.profileId } })
    await proposals.linkToCourse(actor, row.id, courseId)

    await expect(proposals.edit(t.userId, row.id, { titleAr: 'محاولةُ تعديل' }))
      .rejects.toMatchObject({ status: 409 })
    await expect(proposals.remove(t.userId, row.id)).rejects.toMatchObject({ status: 409 })

    const still = await prisma.trainerCourseProposal.findUniqueOrThrow({ where: { id: row.id } })
    expect(still.titleAr, 'عُدّل ما بُتّ فيه').toBe('دورةٌ ستُصنَّف')
  })

  it('والرفضُ بلا سببٍ يُردّ — وبسببٍ يصل صاحبَه', async () => {
    const t = await approvedTrainer('prop-reject@test.local', 'زيد المدرّب', [
      { titleAr: 'دورةٌ مغطّاة', summaryAr: '' },
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
      { titleAr: 'دورةٌ في الطابور', summaryAr: 'فئةٌ ما' },
    ])
    const open = await proposals.queue('open')
    const row = open.find((r) => r.profileId === t.profileId)
    expect(row, 'لم تصل الإدارةَ').toBeTruthy()
    expect(row!.trainerName, 'الطابورُ بلا اسمِ من اقترح').toBe('هالة المدرّبة')
    expect(row!.titleAr).toBe('دورةٌ في الطابور')

    /* والمصنَّفُ يخرج من طابور «ما لم يُصنَّف» ويبقى في «الكلّ» */
    await proposals.linkToCourse(actor, row!.id, courseId)
    expect((await proposals.queue('open')).some((r) => r.id === row!.id)).toBe(false)
    const all = await proposals.queue('all')
    const decided = all.find((r) => r.id === row!.id)!
    expect(decided.status).toBe('linked')
    /* وعنوانُ الدورة يُقرأ من إصدارها الجاري */
    expect(decided.courseTitleAr).toBe('دورةُ الأتمتة القائمة')
  })
})

/* ═══ السؤالُ قبل القرار — البابُ الثالث ═══

   كان الطابورُ بابَين: صنِّف أو ارفض. ومن وصله اقتراحٌ لا يفهمه خمّن أو رفض،
   والرفضُ لسؤالٍ لم يُسأل يُفقد المنصّةَ دورةً ويُفقد المدرّبَ ثقتَه. */
describe('السؤالُ والجواب', () => {
  it('⚠️ السؤالُ ينقل الاقتراحَ إلى صاحبه ويصله إشعارُه — وسؤالٌ لا يُعلَم به ليس سؤالا', async () => {
    const t = await approvedTrainer('prop-ask@test.local', 'سلمى المدرّبة', [
      { titleAr: 'دورةٌ غامضةُ العنوان', summaryAr: '' },
    ])
    const [row] = await prisma.trainerCourseProposal.findMany({ where: { profileId: t.profileId } })

    await proposals.askTrainer(adminId, row.id, 'كم ساعةً تراها؟ وما الفرقُ بينها وبين C-PROP-101؟')
    const asked = await prisma.trainerCourseProposal.findUniqueOrThrow({ where: { id: row.id } })
    expect(asked.status).toBe('info_requested')
    expect(asked.questionAr).toContain('كم ساعةً')
    expect(asked.questionBy).toBe(adminId)

    const note = await prisma.notification.findFirst({
      where: { userId: t.userId, templateKey: 'trainer.course_proposal.question' },
    })
    expect(note, 'سُئل ولم يُعلَم — يبقى ينتظر جوابا وهو المسؤول').toBeTruthy()
    expect(note!.audience, 'وقع سؤالُ المدرّب في جرسِ بوّابةٍ ليست بوّابتَه').toBe('trainer')
  })

  it('⚠️ والمسؤولُ يبقى مملوكا لصاحبه — يعدّله ويردّ، فالسؤالُ طلبُ تعديلٍ لا تجميد', async () => {
    const t = await approvedTrainer('prop-ask-edit@test.local', 'وليد المدرّب', [
      { titleAr: 'عنوانٌ ناقص', summaryAr: '' },
    ])
    const [row] = await prisma.trainerCourseProposal.findMany({ where: { profileId: t.profileId } })
    await proposals.askTrainer(adminId, row.id, 'وضّح المحاورَ من فضلك')

    await proposals.edit(t.userId, row.id, {
      titleAr: 'عنوانٌ مكتمل', summaryAr: 'ثلاثةُ محاور: التخطيط، التنفيذ، القياس',
    })
    const edited = await prisma.trainerCourseProposal.findUniqueOrThrow({ where: { id: row.id } })
    expect(edited.titleAr, 'مُنع من التعديل وقد سُئل ليعدّل').toBe('عنوانٌ مكتمل')
    expect(edited.summaryAr).toContain('التخطيط')
  })

  it('⚠️ والجوابُ يعيده إلى الطابور، والسؤالُ يبقى معه — وجوابٌ بلا سؤالِه نصفُ جملة', async () => {
    const t = await approvedTrainer('prop-answer@test.local', 'رنا المدرّبة', [
      { titleAr: 'دورةٌ تُسأل عنها', summaryAr: '' },
    ])
    const [row] = await prisma.trainerCourseProposal.findMany({ where: { profileId: t.profileId } })
    await proposals.askTrainer(adminId, row.id, 'كم ساعةً تراها؟')

    await proposals.answer(t.userId, row.id, 'اثنتا عشرة ساعةً على أربعة أسابيع')
    const answered = await prisma.trainerCourseProposal.findUniqueOrThrow({ where: { id: row.id } })
    expect(answered.status, 'أجاب ولم يعد إلى الطابور — فبقي ينتظر ولا أحدَ ينظر').toBe('submitted')
    expect(answered.answerAr).toContain('اثنتا عشرة')
    expect(answered.questionAr, 'مُحي السؤالُ بجوابه').toContain('كم ساعةً')

    /* والطابورُ يعرضهما معا لمن يصنّف */
    const seen = (await proposals.queue('open')).find((r) => r.id === row.id)!
    expect(seen.questionAr).toBeTruthy()
    expect(seen.answerAr).toBeTruthy()
  })

  it('ولا يُجاب سؤالٌ لم يُطرح', async () => {
    const t = await approvedTrainer('prop-noq@test.local', 'باسم المدرّب', [
      { titleAr: 'دورةٌ بلا سؤال', summaryAr: '' },
    ])
    const [row] = await prisma.trainerCourseProposal.findMany({ where: { profileId: t.profileId } })
    await expect(proposals.answer(t.userId, row.id, 'جوابٌ بلا سؤال'))
      .rejects.toMatchObject({ status: 409 })
  })

  it('⚠️ وسؤالٌ جديدٌ يمحو جوابَ سابقه — فلا يُقرأ جوابٌ قديمٌ على سؤالٍ جديد', async () => {
    const t = await approvedTrainer('prop-reask@test.local', 'غادة المدرّبة', [
      { titleAr: 'دورةٌ تُسأل مرّتَين', summaryAr: '' },
    ])
    const [row] = await prisma.trainerCourseProposal.findMany({ where: { profileId: t.profileId } })
    await proposals.askTrainer(adminId, row.id, 'السؤالُ الأوّل: كم ساعة؟')
    await proposals.answer(t.userId, row.id, 'جوابُ الأوّل: عشرُ ساعات')
    await proposals.askTrainer(adminId, row.id, 'السؤالُ الثاني: ولمن هي؟')

    const again = await prisma.trainerCourseProposal.findUniqueOrThrow({ where: { id: row.id } })
    expect(again.questionAr).toContain('الثاني')
    expect(again.answerAr, 'بقي جوابُ السؤال الأوّل معلَّقا تحت الثاني').toBeNull()
  })

  it('ولا يُسأل ما بُتّ فيه — فلا يُنقض قرارٌ من حيث لا يُرى', async () => {
    const t = await approvedTrainer('prop-ask-decided@test.local', 'ماجد المدرّب', [
      { titleAr: 'دورةٌ ستُرفض', summaryAr: '' },
    ])
    const [row] = await prisma.trainerCourseProposal.findMany({ where: { profileId: t.profileId } })
    await proposals.reject(adminId, row.id, 'مغطّاةٌ في رمزٍ قائمٍ ولا تضيف مهارة')
    await expect(proposals.askTrainer(adminId, row.id, 'سؤالٌ بعد الرفض'))
      .rejects.toMatchObject({ status: 409 })
  })
})

/* ═══ ما يبقى بعد التصنيف — مهمّةُ التأهيل ═══

   اقتراحٌ صُنِّف «نسخةٌ من رمزٍ قائم» لا يُدرّسه صاحبُه: التأهيلُ فعلٌ ثانٍ في
   شاشةٍ ثانية. وكان القرارُ ينتهي ولا يبقى ما يذكّر به — فهو ضياعُ العمل بعد
   إنجازه لا قبله. */
describe('التصنيفُ يفتح مهمّةً قائمة', () => {
  it('⚠️ «نسخةٌ من رمزٍ قائم» تفتح مهمّةَ تأهيلٍ على من قرّر — وإلّا صُنِّف ولم يُدرَّس', async () => {
    const t = await approvedTrainer('prop-task-link@test.local', 'عمرُ المدرّب', [
      { titleAr: 'دورةٌ تُربط ويُؤهَّل لها', summaryAr: '' },
    ])
    const [row] = await prisma.trainerCourseProposal.findMany({ where: { profileId: t.profileId } })
    const before = await prisma.staffTask.count({ where: { assigneeId: adminId, status: 'open' } })

    await proposals.linkToCourse(actor, row.id, courseId)

    const after = await prisma.staffTask.findMany({
      where: { assigneeId: adminId, status: 'open' }, orderBy: { createdAt: 'desc' },
    })
    expect(after.length, 'صُنِّف الاقتراحُ ولم يبقَ ما يذكّر بتأهيله').toBe(before + 1)
    expect(after[0].title, 'المهمّةُ لا تقول من يُؤهَّل').toContain('عمرُ المدرّب')
    expect(after[0].title).toContain(courseId)
    expect(after[0].priority, 'عملٌ نصفُه تمّ ونصفُه معلّق ليس عاديّا').toBe('high')
  })

  it('و«دورةٌ جديدة» كذلك — فالبابان يتركان الأثرَ نفسَه', async () => {
    const t = await approvedTrainer('prop-task-new@test.local', 'دينا المدرّبة', [
      { titleAr: 'دورةٌ صارت في الكتالوج', summaryAr: '' },
    ])
    const [row] = await prisma.trainerCourseProposal.findMany({ where: { profileId: t.profileId } })
    const before = await prisma.staffTask.count({ where: { assigneeId: adminId, status: 'open' } })

    await proposals.markBecameCourse(actor, row.id, courseId)
    const after = await prisma.staffTask.count({ where: { assigneeId: adminId, status: 'open' } })
    expect(after, 'الدورةُ الجديدةُ لا تترك مهمّةَ تأهيل').toBe(before + 1)
  })

  it('⚠️ والرفضُ لا يفتح مهمّة — ولا يُكلَّف أحدٌ بتأهيلٍ لدورةٍ لم تُقبل', async () => {
    const t = await approvedTrainer('prop-task-reject@test.local', 'سعدُ المدرّب', [
      { titleAr: 'دورةٌ مرفوضة', summaryAr: '' },
    ])
    const [row] = await prisma.trainerCourseProposal.findMany({ where: { profileId: t.profileId } })
    const before = await prisma.staffTask.count({ where: { assigneeId: adminId, status: 'open' } })

    await proposals.reject(adminId, row.id, 'مغطّاةٌ في رمزٍ قائمٍ ولا تضيف مهارة')
    const after = await prisma.staffTask.count({ where: { assigneeId: adminId, status: 'open' } })
    expect(after, 'فُتحت مهمّةُ تأهيلٍ لدورةٍ مرفوضة').toBe(before)
  })
})

/* ═══ الترشيحُ في الطابور ═══ */
describe('ترشيحُ أقربِ رمزٍ — في حمولة الطابور لا في المتصفّح', () => {
  it('⚠️ الاقتراحُ المفتوحُ يصحبه ترشيحُه — ومن لم يُرشَّح له أنشأ ثانيةً لما هو موجود', async () => {
    const t = await approvedTrainer('prop-suggest@test.local', 'نادرُ المدرّب', [
      { titleAr: 'الأتمتةُ الماليّة', summaryAr: 'أتمتةُ التقارير' },
    ])
    const row = (await proposals.queue('open')).find((r) => r.profileId === t.profileId)!
    expect(row.suggestedCourses.length, 'لم يُرشَّح شيءٌ ورمزُ أتمتةٍ في الكتالوج').toBeGreaterThan(0)

    /* ولا يُطلَب رمزٌ بعينه: الكتالوجُ المبذورُ فيه دوراتُ أتمتةٍ حقيقيّةٌ
       أقربُ من دورة الاختبار، وترتيبُها عليها هو الصوابُ لا الخطأ. والمفحوصُ
       هنا **أنّ الترشيحَ يُحسب ويصحب الحمولة**، وترتيبُه يحرسه
       `src/tests/trainer/proposal-match.test.ts` على كتالوجٍ مضبوط.

       والسببُ يُفحص بنيةً لا عدّا: كلُّ كلمةٍ معروضةٍ سببا يجب أن تكون من
       عنوان الاقتراح فعلا — وإلّا عُرض للأدمن سببٌ لا أصلَ له. */
    const titleWords = [...tokensAr('الأتمتةُ الماليّة', 'أتمتةُ التقارير')]
    for (const sug of row.suggestedCourses) {
      expect(sug.sharedAr.length, `رُشّح ${sug.courseId} بلا سببٍ يُقرأ`).toBeGreaterThan(0)
      for (const word of sug.sharedAr) {
        expect(titleWords, `عُرضت «${word}» سببا وليست ممّا كتبه المدرّب`).toContain(word)
      }
    }
  })

  it('وما بُتّ فيه لا يُرشَّح له — قد بُتّ فيه', async () => {
    const t = await approvedTrainer('prop-suggest-done@test.local', 'هدى المدرّبة', [
      { titleAr: 'الأتمتةُ المحاسبيّة', summaryAr: '' },
    ])
    const [row] = await prisma.trainerCourseProposal.findMany({ where: { profileId: t.profileId } })
    await proposals.linkToCourse(actor, row.id, courseId)
    const seen = (await proposals.queue('all')).find((r) => r.id === row.id)!
    expect(seen.suggestedCourses).toEqual([])
  })
})
