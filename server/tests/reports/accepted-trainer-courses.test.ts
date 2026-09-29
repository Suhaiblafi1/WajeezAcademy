/* تقريرُ «دوراتُ المدرّبين المقبولين» — على قاعدةٍ حقيقيّة.

   قواعدُ الصفّ مفحوصةٌ في `src/tests/trainer/accepted-courses.test.ts` على
   مدخلاتٍ مبنيّةٍ باليد. وهذا يفحص ما لا يُرى هناك: أنّ ما يقرؤه التقريرُ من
   القاعدة هو ما تكتبه الخدماتُ فعلا. فالمدرّبُ يُقبَل بالمسار الحقيقيّ،
   ويُعدّل اقتراحَه ويحذفه من بوّابته، وتصحّحه الإدارةُ وتربطه — ثمّ يُقرأ
   الجدول.

   وأخطرُ ما هنا **الأثر**: التقريرُ يعرف ما أُعيدت تسميتُه أو حُذف من أسطر
   `AuditEvent` بأفعالٍ يكتبها `course-proposal.service.ts`. فلو تغيّر فعلٌ
   أو موضعُ عنوانه هناك لبُعث كلُّ ما أُعيدت تسميتُه صفّا «لم يدخل الطابور»
   — ولا يقول ذلك إلّا تشغيلُ الخدمة نفسِها. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerApplicationService } from '../../services/trainer-application.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { CourseProposalService } from '../../services/course-proposal.service'
import { ReportsService } from '../../services/reports.service'
import { SOURCE_LABELS } from '../../../src/application/trainer/accepted-courses'
import { makeReadyForApproval } from '../helpers/trainer-ready'

let prisma: PrismaClient
let apps: TrainerApplicationService
let review: TrainerReviewService
let proposals: CourseProposalService
let reports: ReportsService
let adminId: string
let actor: { userId: string; roles: string[] }

const base = {
  phoneCountryCode: '+962', phone: '771060000', country: 'الأردن', timezone: 'Asia/Amman',
  jobTitle: 'مدرّبة', specialties: ['الإدارة'],
  domainYears: '8-12' as const, trainingYears: 'formal_teaching',
  bio: 'خبرةٌ ميدانيّة', trainingLanguages: ['العربية'], deliveryMode: 'both' as const,
  motivation: 'درّبتُ فرقا حقيقيّةً في بيئات عملٍ عربيّة، وأعرف الفرقَ بين من يعرف المادّة ومن يستطيع تعليمها. سأعطي كلَّ متعلّمٍ مهمّةً من واقع عمله في كلّ وحدة، وأراجع مخرجاته بنفسي وأكتب له ما ينقصه تحديدا لا تقييما عاما.',
  privacyConsent: true as const,
  password: 'Trainer#12345',
}

type Proposal = { titleAr: string; summaryAr: string }

/** طلبٌ مكتملٌ ببريدٍ ثابت — ثمّ يُترك في حالته أو يُقبَل */
async function applicant(email: string, fullName: string, teachableProposals: Proposal[], ticked: string[] = []) {
  const res = await apps.submitPhase1({ ...base, email, fullName })
  const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference: res.reference } })
  await apps.completePhase2(res.reference, res.candidateToken, {
    previousCourses: [], teachableCourseIds: ticked, availability: { seasons: ['nov_jan'] },
    demoConsent: true, contact: { channel: 'email' }, teachableProposals,
  })
  await prisma.trainerApplication.update({ where: { id: row.id }, data: { emailVerifiedAt: new Date() } })
  return { applicationId: row.id, reference: res.reference, userId: res.userId }
}

async function course(id: string, titleAr: string) {
  await prisma.course.create({ data: { id, status: 'published', currentVersion: 1 } })
  await prisma.courseVersion.create({ data: { courseId: id, version: 1, titleAr, totalHours: 12 } })
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  apps = new TrainerApplicationService(prisma)
  review = new TrainerReviewService(prisma)
  proposals = new CourseProposalService(prisma)
  reports = new ReportsService(prisma)
  const admin = await auth.register('acc-courses-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
  actor = { userId: adminId, roles: ['academic_manager'] }

  await course('C-ACC-101', 'إدارةُ الوقت للموظفين')
  await course('C-ACC-102', 'تحليلُ البيانات بالجداول الحسابيّة')
  /* عنوانٌ لا يشاركه الكتالوجُ المستورَدُ كلمةً — فالترشيحُ إليه لا يتبدّل
     بتبدّل الكتالوج */
  await course('C-ACC-103', 'زراعةُ الزعفران')
}, 240_000)

describe('دوراتُ المدرّبين المقبولين — من القاعدة كما تكتبها الخدمات', () => {
  it('ما لم يدخل الطابورَ يُقال، وما دخله لا يُكرَّر ولا يُبعَث — والمستثنى لا يُقرأ', async () => {
    /* ═══ أ — مقبولةٌ نشطة، مرّ على اقتراحاتها كلُّ ما يقع في الحياة ═══ */
    const a = await applicant('acc-a@test.local', 'أمل المدرّبة', [
      { titleAr: 'تحليلُ البيانات للمبتدئين', summaryAr: '' },
      { titleAr: 'قيادةُ الفرق عن بُعد', summaryAr: '' },
      { titleAr: 'التسويقُ بالمحتوى', summaryAr: '' },
      { titleAr: 'زراعةُ الزعفران المنزليّة', summaryAr: 'لأصحاب الحدائق' },
    ], ['C-ACC-101'])
    await makeReadyForApproval(prisma, a.applicationId, adminId)
    await review.decide(a.applicationId, adminId, 'approve', 'اعتماد للاختبار')
    const profile = await prisma.trainerProfile.findUniqueOrThrow({ where: { applicationId: a.applicationId } })
    const seeded = await prisma.trainerCourseProposal.findMany({ where: { profileId: profile.id } })
    const idOf = (t: string) => seeded.find((s) => s.titleAr === t)!.id

    /* صاحبتُها تعيد تسميةَ واحدٍ ثمّ يُربط، والإدارةُ تصحّح ثانيا، وتحذف
       صاحبتُها ثالثا من بوّابتها */
    await proposals.edit(a.userId, idOf('تحليلُ البيانات للمبتدئين'), { titleAr: 'تحليلُ البيانات بالجداول' })
    await proposals.linkToCourse(actor, idOf('تحليلُ البيانات للمبتدئين'), 'C-ACC-102')
    await proposals.editByStaff(adminId, idOf('قيادةُ الفرق عن بُعد'), { titleAr: 'قيادةُ الفرق الموزّعة' })
    await proposals.remove(a.userId, idOf('التسويقُ بالمحتوى'))

    /* ثمّ تُسمّى في محرّر الطلب — بعد إنشاء ملفّها — دورةٌ جديدةٌ مع الأربعِ
       مكتوبةً بلا تشكيل. والمحرّرُ يكتب في الطلب وحدَه، فالجديدةُ لا تبلغ
       الطابور. */
    await review.saveTeachableProposals(a.applicationId, adminId, [
      { titleAr: 'تحليل البيانات للمبتدئين', summaryAr: '' },
      { titleAr: 'قيادة الفرق عن بعد', summaryAr: '' },
      { titleAr: 'التسويق بالمحتوى', summaryAr: '' },
      { titleAr: 'زراعة الزعفران المنزلية', summaryAr: '' },
      { titleAr: 'إدارةُ المشاريع الرشيقة', summaryAr: 'لمدراء المشاريع' },
    ])
    const free = 'دورة في الخطابة\nدورة في كتابة التقارير'
    await prisma.trainerApplication.update({ where: { id: a.applicationId }, data: { teachableOther: free } })

    /* ═══ هـ — قبولٌ داخليٌّ بلا بند ═══ */
    const e = await applicant('acc-e@test.local', 'إياد بلا بنود', [])
    await review.decide(e.applicationId, adminId, 'conditionally_approve')

    /* ═══ د — مقبولٌ بلا ملفّ (حالٌ لا ينبغي أن تقع، وتُقال إن وقعت) ═══ */
    const d = await applicant('acc-d@test.local', 'دانة بلا ملفّ', [{ titleAr: 'الخطابةُ للقادة', summaryAr: '' }])
    await prisma.trainerApplication.update({ where: { id: d.applicationId }, data: { status: 'conditionally_approved' } })

    /* ═══ ب وج — قيد المراجعة، وموقوف: خارجَ الجرد ═══ */
    const b = await applicant('acc-b@test.local', 'باسل قيد المراجعة', [{ titleAr: 'لا يُقرأ ١', summaryAr: '' }])
    await prisma.trainerApplication.update({ where: { id: b.applicationId }, data: { status: 'under_review' } })
    const c = await applicant('acc-c@test.local', 'جود الموقوفة', [{ titleAr: 'لا يُقرأ ٢', summaryAr: '' }])
    await prisma.trainerApplication.update({ where: { id: c.applicationId }, data: { status: 'suspended' } })

    const out = await reports.run('accepted-trainer-courses')
    const rows = out.rows as Record<string, string>[]
    const of = (ref: string) => rows.filter((r) => r.reference === ref)
    const titles = (ref: string, source: string) => of(ref).filter((r) => r.source === source).map((r) => r.title)

    /* أ — الطابورُ كما هو بعد الحياة: المُعادُ تسميتُه باسمه الجديد، والمحذوفُ غائب */
    expect(titles(a.reference, SOURCE_LABELS.queue).sort()).toEqual(
      ['تحليلُ البيانات بالجداول', 'قيادةُ الفرق الموزّعة', 'زراعةُ الزعفران المنزليّة'].sort(),
    )
    expect(
      titles(a.reference, SOURCE_LABELS.application),
      'بُعث ما أُعيدت تسميتُه أو حُذف — أو غاب ما سُمّي بعد إنشاء الملفّ',
    ).toEqual(['إدارةُ المشاريع الرشيقة'])
    expect(titles(a.reference, SOURCE_LABELS.freeText)).toEqual([free])

    const linked = of(a.reference).find((r) => r.title === 'تحليلُ البيانات بالجداول')!
    expect(linked.itemStatus).toBe('نسخةٌ من رمزٍ قائم')
    expect(linked.course).toBe('C-ACC-102 — تحليلُ البيانات بالجداول الحسابيّة')
    expect(linked.nearest).toBe('—')
    expect(linked.proposalId).toBe(idOf('تحليلُ البيانات للمبتدئين'))
    /* والمفتوحُ يُرشَّح له بالمرشِّح نفسِه الذي في الطابور */
    const saffron = of(a.reference).find((r) => r.title === 'زراعةُ الزعفران المنزليّة')!
    expect(saffron.nearest).toBe('C-ACC-103 — زراعةُ الزعفران')
    expect(saffron.summary).toBe('لأصحاب الحدائق')

    /* ما اختارته من الكتالوج صار عند قبولها تأهيلا معلَّقا — يُقال في صفّه ولا يُعاد */
    const ticked = of(a.reference).filter((r) => r.source === SOURCE_LABELS.ticked)
    expect(ticked.map((r) => r.course)).toEqual(['C-ACC-101 — إدارةُ الوقت للموظفين'])
    expect(ticked[0].qualification).toBe('طلبُ تأهيلٍ ينتظر قرارَك')
    const qualRows = of(a.reference).filter((r) => r.source === SOURCE_LABELS.qualification)
    expect(qualRows.map((r) => r.course.split(' — ')[0])).not.toContain('C-ACC-101')

    /* هـ — صفٌّ واحدٌ يقول إنّه لا بندَ له */
    expect(of(e.reference).map((r) => r.source)).toEqual([SOURCE_LABELS.nothing])
    expect(of(e.reference)[0].trainerStatus).toBe('قبولٌ داخليّ — قيد التجهيز')

    /* د — اقتراحاتُ طلبه كلُّها، ويُقال إنّه لا ملفَّ له */
    expect(titles(d.reference, SOURCE_LABELS.application)).toEqual(['الخطابةُ للقادة'])
    expect(of(d.reference)[0].note).toContain('لا ملفَّ')

    /* ب وج — لا صفَّ لهما */
    expect(of(b.reference), 'قُرئ من لم يُقبَل').toHaveLength(0)
    expect(of(c.reference), 'قُرئ الموقوف — ولا يُجهَّز موقوف').toHaveLength(0)

    /* ولا بريدَ في الجدول — يُصدَّر ويُرسَل */
    const text = JSON.stringify(rows)
    for (const mail of ['acc-a@test.local', 'acc-d@test.local', 'acc-e@test.local']) {
      expect(text, 'خرج بريدٌ في جدولٍ يُصدَّر').not.toContain(mail)
    }

    /* وكلُّ عمودٍ بعنوانٍ عربيّ — لا مفتاحُ قاعدةٍ خامٌ في رأس ملفٍّ يُصدَّر */
    for (const k of Object.keys(rows[0])) {
      expect(out.columnsAr[k], `عمودٌ بلا عنوانٍ عربيّ: ${k}`).not.toBe(k)
    }
  })

  /* ═══ ومقبولٌ تغيّر حالُه بعد قبوله — لا يغيب (٢٩ سبتمبر ٢٠٢٦) ═══

     وقع في الإنتاج: مقبولةٌ داخليّا طُلبت منها ورقةٌ فصار حالُها «بانتظار
     معلومات المرشح» — فغابت عن الجدول، وهي ممّن بُني الجدولُ لهم. والحدُّ
     صار ملفَّ المدرّب لا اسمَ الحالة (`ENDED_TRAINER_STATUSES`). وكلُّ نقلةٍ
     هنا بـ`decide` نفسِها التي تضغطها الشاشة. */
  it('مقبولٌ طُلبت منه معلوماتٌ أو أُعيد إلى المراجعة يبقى ويُقال لمَ — والمردودُ بعد قبوله يخرج', async () => {
    const f = await applicant('acc-f@test.local', 'فرح طُلبت منها ورقة', [{ titleAr: 'الخطابةُ للمعلّمين', summaryAr: '' }])
    await review.decide(f.applicationId, adminId, 'conditionally_approve')
    await review.decide(f.applicationId, adminId, 'request_info', 'ينقص ملفَّها شهادةُ الخبرة')
    const g = await applicant('acc-g@test.local', 'غيث أُعيد إلى المراجعة', [])
    await review.decide(g.applicationId, adminId, 'conditionally_approve')
    await review.decide(g.applicationId, adminId, 'move_to_review', 'قراءةٌ ثانية')
    const h = await applicant('acc-h@test.local', 'هالة رُدّت بعد قبولها', [{ titleAr: 'لا يُقرأ ٣', summaryAr: '' }])
    await review.decide(h.applicationId, adminId, 'conditionally_approve')
    await review.decide(h.applicationId, adminId, 'reject', 'لم تُكمل التجهيز')

    /* الحالُ كما كتبتها الخدمة — لا كما يفترضها الاختبار */
    const fApp = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: f.applicationId } })
    expect([fApp.status, fApp.infoRequestedFrom]).toEqual(['information_requested', 'conditionally_approved'])

    const rows = (await reports.run('accepted-trainer-courses')).rows as Record<string, string>[]
    const of = (ref: string) => rows.filter((r) => r.reference === ref)

    expect(of(f.reference).map((r) => r.title), 'غابت مقبولةٌ طُلبت منها معلومات').toEqual(['الخطابةُ للمعلّمين'])
    expect(of(f.reference)[0].trainerStatus)
      .toBe('بانتظار معلومات المرشح — طُلبت منه في «قبولٌ داخليّ — قيد التجهيز»، ويعود إليها حين يجيب')
    expect(of(g.reference).map((r) => r.source), 'غاب مقبولٌ أُعيد إلى المراجعة').toEqual([SOURCE_LABELS.nothing])
    expect(of(g.reference)[0].trainerStatus).toBe('قيد المراجعة — وله ملفُّ مدرّبٍ من قبولٍ سابق')
    expect(of(h.reference), 'قُرئت مردودةٌ — والردُّ بعد القبول نهايةٌ كغيره').toHaveLength(0)
  })
})
