/* بوّابةُ التجهيز — لا يُعتمَد مدرّبٌ قبل أن يتمّ تجهيزُه.

   ═══ العطبُ الذي وُلدت منه ═══

   كان الاعتمادُ نقرةً واحدةً من أيّ حالةٍ بلا فحصٍ واحد. فيصير المتقدّمُ
   «مدرّبا نشطا» وليس له أجرٌ متّفقٌ عليه — و«مستحقّاتي» عنده صفرٌ لأنّ
   `computeCohort` ترمي `no_rule` — ولا دورةٌ مؤهَّلٌ لها فيفتح بوّابتَه على
   فراغ، ولا عقدٌ وقّعه فلا وثيقةَ تحكم ما بيننا.

   قرارُ صاحب المنصّة (٢٠ سبتمبر ٢٠٢٦): تُفحَص الثلاثُ في كلّ طريقٍ إلى
   «نشط»، **ويبقى للمدير الأعلى وحدَه بابُ تجاوزٍ بسببٍ مكتوب**.

   ═══ وما تفحصه هذه الجولةُ وما لا تفحصه ═══

   الحكمُ نفسُه (أيُّ قاعدةٍ سارية؟ وأيُّ عقدٍ يُعدّ موقَّعا؟) مفحوصٌ في
   `src/tests/trainer-readiness.test.ts` بلا قاعدة. وهذه تفحص ما لا يُفحَص
   إلّا بقاعدة: أنّ المنعَ **يقع فعلا** في `decide`، وأنّ التجاوزَ يُكتب
   أثرا وسجلَّ حالة، وأنّ القبولَ الداخليَّ لا يفتح لصاحبه بوّابةً بعد. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerApplicationService } from '../../services/trainer-application.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { EarningsService } from '../../services/earnings.service'

let prisma: PrismaClient
let auth: AuthService
let apps: TrainerApplicationService
let review: TrainerReviewService
let earnings: EarningsService
let adminId: string
let ownerId: string

const COURSE = 'C-RDY-101'

const base = {
  phoneCountryCode: '+962', phone: '771050000', country: 'الأردن', timezone: 'Asia/Amman',
  jobTitle: 'مدرّبة تسويق', specialties: ['التسويق الرقمي'],
  domainYears: '8-12' as const, trainingYears: 'formal_teaching',
  bio: 'خبرةٌ ميدانيّة', trainingLanguages: ['العربية'], deliveryMode: 'both' as const,
  motivation: 'درّبتُ فرقا حقيقيّةً في بيئات عملٍ عربيّة، وأعرف الفرقَ بين من يعرف المادّة ومن يستطيع تعليمها. سأعطي كلَّ متعلّمٍ مهمّةً من واقع عمله في كلّ وحدة، وأراجع مخرجاته بنفسي وأكتب له ما ينقصه تحديدا لا تقييما عاما.',
  privacyConsent: true as const,
  password: 'Trainer#12345',
}

let seq = 0

/** متقدّمٌ كامل: حسابٌ وبريدٌ موثَّقٌ وطلبٌ مقدَّم */
async function applicant() {
  seq += 1
  const email = `rdy-${seq}@test.local`
  const res = await apps.submitPhase1({ ...base, email, fullName: `مدرّبٌ ${seq}` })
  const row = await prisma.trainerApplication.findUniqueOrThrow({ where: { reference: res.reference } })
  await apps.completePhase2(res.reference, res.candidateToken, {
    previousCourses: [], teachableCourseIds: [], availability: { seasons: ['nov_jan'] },
    demoConsent: true, contact: { channel: 'email' },
  })
  await prisma.trainerApplication.update({ where: { id: row.id }, data: { emailVerifiedAt: new Date() } })
  return { id: row.id, reference: res.reference, userId: res.userId, email }
}

/** يُتمّ خطواتِ التجهيز الثلاث — كلَّها أو ما عدا واحدةً تُستثنى */
async function prepare(applicationId: string, skip?: 'compensation' | 'qualifications' | 'contract') {
  await review.decide(applicationId, adminId, 'conditionally_approve')
  const profile = await prisma.trainerProfile.findUniqueOrThrow({ where: { applicationId } })
  if (skip !== 'compensation') {
    await earnings.setRule(adminId, { profileId: profile.id, type: 'per_seat', rate: 25 })
  }
  if (skip !== 'qualifications') {
    await review.qualifyForCourse(profile.id, COURSE, adminId)
  }
  if (skip !== 'contract') {
    await prisma.trainerContract.create({
      data: { profileId: profile.id, title: 'عقدُ تدريبٍ للاختبار', status: 'signed' },
    })
  }
  return profile
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  apps = new TrainerApplicationService(prisma)
  review = new TrainerReviewService(prisma)
  earnings = new EarningsService(prisma)

  const admin = await auth.register('rdy-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])

  const owner = await auth.register('rdy-owner@test.local', 'Admin#12345', 'صاحبُ المنصّة')
  ownerId = owner.userId
  await auth.setRoles(ownerId, ['super_admin'])

  await prisma.course.create({ data: { id: COURSE, status: 'published', currentVersion: 1 } })
  await prisma.courseVersion.create({
    data: { courseId: COURSE, version: 1, titleAr: 'دورةُ الجاهزيّة', totalHours: 10 },
  })
}, 240_000)

describe('لا اعتمادَ قبل التجهيز', () => {
  it('والطلبُ الطازجُ يُردّ — لا ملفَّ له فضلا عن أتعابٍ وعقد', async () => {
    const a = await applicant()
    await expect(review.decide(a.id, adminId, 'approve')).rejects.toMatchObject({ code: 'not_ready' })
    const after = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: a.id } })
    expect(after.status, 'مرّ الاعتمادُ رغم المنع').toBe('submitted')
  })

  /* ═══ ولا يُنشأ أثرٌ من فعلٍ لم يقع ═══

     البوّابةُ تُفحَص **قبل** `ensureProfile` بقصد: لو فُحصت بعده لأنشأ
     الضغطُ المردودُ ملفَّ مدرّبٍ ومهامَّ تهيئةٍ ثمّ رُدّ. */
  it('والمردودُ لا يترك خلفه ملفَّ مدرّبٍ ولا مهامَّ تهيئة', async () => {
    const a = await applicant()
    await expect(review.decide(a.id, adminId, 'approve')).rejects.toThrow()
    expect(await prisma.trainerProfile.findUnique({ where: { applicationId: a.id } })).toBeNull()
  })

  it('وينقص الأتعابُ وحدَها فيُردّ — ورسالتُه تسمّي ما ينقص', async () => {
    const a = await applicant()
    await prepare(a.id, 'compensation')
    await expect(review.decide(a.id, adminId, 'approve')).rejects.toMatchObject({ code: 'not_ready' })
    await expect(review.decide(a.id, adminId, 'approve')).rejects.toThrow(/اتّفاقَ ماليَّ/)
  })

  it('وينقص التأهيلُ وحدَه فيُردّ', async () => {
    const a = await applicant()
    await prepare(a.id, 'qualifications')
    await expect(review.decide(a.id, adminId, 'approve')).rejects.toThrow(/دورةَ مؤهَّلا لها/)
  })

  it('وينقص العقدُ وحدَه فيُردّ', async () => {
    const a = await applicant()
    await prepare(a.id, 'contract')
    await expect(review.decide(a.id, adminId, 'approve')).rejects.toThrow(/عقدَ وقّعه/)
  })

  /* ═══ والاقتراحُ غيرُ المصنَّف يُرى ولا يحبس ═══

     كاد يُجعل مانعا في أوّل التصميم. وثلاثةٌ تنقضه، أوّلُها أنّ النظامَ
     يبذره بيده: `seedProposalsFromApplication` تكتبه لحظةَ القبول الداخليّ،
     فيصنع المانعَ في اللحظة التي يُفتح فيها بابُ التجهيز. وتفصيلُه في رأس
     `noticeAr` في `src/application/trainer/readiness.ts`. */
  it('واقتراحُ دورةٍ لم يُصنَّف لا يحبس الاعتماد — يُرى ملحوظةً', async () => {
    const a = await applicant()
    const profile = await prepare(a.id)
    await prisma.trainerCourseProposal.create({
      data: { profileId: profile.id, titleAr: 'دورةٌ يقترحها', status: 'submitted' },
    })
    const readiness = await review.readinessForApplication(a.id)
    expect(readiness.ready, 'حبس اقتراحٌ غيرُ مصنَّفٍ اعتمادَ صاحبه').toBe(true)
    expect(
      readiness.steps.find((st) => st.key === 'qualifications')!.noticeAr,
      'مرّ الاقتراحُ بلا أن يُقال إنّه ينتظر',
    ).toContain('1')
    await review.decide(a.id, adminId, 'approve')
    expect((await prisma.trainerApplication.findUniqueOrThrow({ where: { id: a.id } })).status).toBe('active')
  })

  it('وإذا تمّت الثلاثُ مرّ الاعتمادُ تامّا — حالةٌ وحسابٌ ودورُ مدرّب', async () => {
    const a = await applicant()
    await prepare(a.id)
    await review.decide(a.id, adminId, 'approve')
    const after = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: a.id } })
    expect(after.status).toBe('active')
    const profile = await prisma.trainerProfile.findUniqueOrThrow({ where: { applicationId: a.id } })
    expect(profile.userId, 'ملفٌّ «نشطٌ» بلا حسابٍ لا يفتح بوّابتَه').toBe(a.userId)
    const roles = await prisma.userRole.findMany({ where: { userId: a.userId } })
    expect(roles.map((r) => r.roleId)).toContain('trainer')
  })
})

describe('القبولُ الداخليُّ — يفتح التجهيزَ ولا يُبلّغ صاحبَه', () => {
  it('يُنشئ الملفَّ ولا ينقل الطلبَ إلى «نشط»', async () => {
    const a = await applicant()
    await review.decide(a.id, adminId, 'conditionally_approve')
    const after = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: a.id } })
    expect(after.status).toBe('conditionally_approved')
    expect(await prisma.trainerProfile.findUnique({ where: { applicationId: a.id } })).not.toBeNull()
  })

  /* ═══ ولا يدخل بوّابتَه في هذا الطور ═══

     «قبولٌ داخليّ» يعطينا أن نجهّز، ولا يَعِد المتقدّمَ بشيءٍ قد يُنقَض بعد
     أسبوعَين. والوعدُ لا يُنقض بالكلام وحدَه: لو مُنح دورَ المدرّب هنا
     لَفتح بوّابتَه ورأى نفسَه مدرّبا قبل أن يُقبَل. فالدورُ والحسابُ يبقيان
     حيث هما حتّى القبول الكامل.

     ونصُّ ما يقرؤه في صفحة حالته محروسٌ في
     `src/tests/trainer-readiness.test.ts` — فهو نصٌّ يُقرأ بلا قاعدة. */
  it('ولا يُمنَح دورَ المدرّب ولا يُربَط حسابُه — فلا بوّابةَ تُفتح قبل القبول', async () => {
    const a = await applicant()
    await review.decide(a.id, adminId, 'conditionally_approve')
    const profile = await prisma.trainerProfile.findUniqueOrThrow({ where: { applicationId: a.id } })
    expect(profile.userId, 'رُبط حسابُه بملفّه في القبول الداخليّ').toBeNull()
    const roles = await prisma.userRole.findMany({ where: { userId: a.userId! } })
    expect(roles.map((r) => r.roleId), 'مُنح دورَ المدرّب قبل أن يُقبَل').not.toContain('trainer')

    /* ثمّ يُتمّ تجهيزُه ويُعتمَد — فيُفتح حينئذٍ */
    await earnings.setRule(adminId, { profileId: profile.id, type: 'per_seat', rate: 25 })
    await review.qualifyForCourse(profile.id, COURSE, adminId)
    await prisma.trainerContract.create({
      data: { profileId: profile.id, title: 'عقدٌ', status: 'signed' },
    })
    await review.decide(a.id, adminId, 'approve')
    const after = await prisma.userRole.findMany({ where: { userId: a.userId! } })
    expect(after.map((r) => r.roleId)).toContain('trainer')
  })

  it('ويُبلَغ من كلّ حالةٍ حيّةٍ لا من «المراجعة الأكاديميّة» وحدَها', async () => {
    const a = await applicant()
    await review.decide(a.id, adminId, 'move_to_review')
    await review.decide(a.id, adminId, 'conditionally_approve')
    expect((await prisma.trainerApplication.findUniqueOrThrow({ where: { id: a.id } })).status)
      .toBe('conditionally_approved')
  })
})

describe('تجاوزُ البوّابة — للمدير الأعلى وحدَه، وبسببٍ يبقى', () => {
  it('ولا يتجاوزها المديرُ الأكاديميُّ ولو كتب سببا', async () => {
    const a = await applicant()
    await prepare(a.id, 'contract')
    await expect(
      review.decide(a.id, adminId, 'approve', undefined, {
        overrideReasonAr: 'سببٌ مكتوبٌ طويلٌ بما يكفي لتجاوز البوّابة',
        actorRoles: ['academic_manager'],
      }),
    ).rejects.toMatchObject({ code: 'not_ready' })
  })

  it('ولا يتجاوزها المديرُ الأعلى بلا سبب', async () => {
    const a = await applicant()
    await prepare(a.id, 'contract')
    await expect(
      review.decide(a.id, ownerId, 'approve', undefined, { actorRoles: ['super_admin'] }),
    ).rejects.toMatchObject({ code: 'override_reason_required' })
  })

  it('ولا بسببٍ أقصرَ من أن يُفهَم بعد شهر', async () => {
    const a = await applicant()
    await prepare(a.id, 'contract')
    await expect(
      review.decide(a.id, ownerId, 'approve', undefined, {
        overrideReasonAr: 'استثناء', actorRoles: ['super_admin'],
      }),
    ).rejects.toMatchObject({ code: 'override_reason_required' })
  })

  it('ويمرّ بسببٍ مكتوب — ويُحفَظ في الأثر وفي سجلّ الحالة معا', async () => {
    const a = await applicant()
    await prepare(a.id, 'contract')
    const reason = 'مدرّبةٌ نعرفها وتبدأ شعبتَها الأحد، ويُستكمَل عقدُها هذا الأسبوع'
    await review.decide(a.id, ownerId, 'approve', 'اعتمادٌ عاجل', {
      overrideReasonAr: reason, actorRoles: ['super_admin'],
    })

    expect((await prisma.trainerApplication.findUniqueOrThrow({ where: { id: a.id } })).status).toBe('active')

    /* ① في سجلّ الأثر — يُقرأ بصلاحيّة */
    const audit = await prisma.auditEvent.findFirst({
      where: { action: 'trainer.readiness.override', entityId: a.id },
    })
    expect(audit, 'مرّ التجاوزُ بلا أثر').not.toBeNull()
    expect(JSON.stringify(audit!.meta)).toContain(reason)

    /* ② وفي سجلّ حالة الطلب — يُقرأ في ملفّه أمام من يفتحه */
    const hop = await prisma.trainerStatusHistory.findFirst({
      where: { applicationId: a.id, toStatus: 'active' },
      orderBy: { createdAt: 'desc' },
    })
    expect(hop!.note, 'سببُ التجاوز لا يُقرأ في سجلّ الحالة').toContain(reason)
  })

  it('ولا يُكتب أثرُ تجاوزٍ حين لا تجاوز — فالتامُّ يمرّ نظيفا', async () => {
    const a = await applicant()
    await prepare(a.id)
    await review.decide(a.id, ownerId, 'approve', undefined, { actorRoles: ['super_admin'] })
    const audit = await prisma.auditEvent.count({
      where: { action: 'trainer.readiness.override', entityId: a.id },
    })
    expect(audit, 'كُتب تجاوزٌ لمن لم يتجاوز شيئا').toBe(0)
  })
})
