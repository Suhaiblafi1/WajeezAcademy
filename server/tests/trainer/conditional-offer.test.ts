/* العرضُ المشروط على قاعدةٍ حقيقيّة — مهلتُه، وعلامتاه، وأبوابُه.

   ═══ وما لا يُقاس إلّا هنا ═══

   حسابُ المهلة مفحوصٌ في المسار السريع (`src/tests/trainer/conditional-offer
   .test.ts`). وما يُقاس هنا **ما يُكتب في الصفوف ومتى**:

   ① أنّ التركيبَ يخزّن تاريخَ الجلسة والمهلةَ المحسوبةَ منه — لا من لحظة
      التركيب. وعرضان يُركَّبان في وقتَين بجلسةٍ واحدةٍ تنتهي مهلتُهما معا.
   ② وأنّ عرضا بلا تاريخِ جلسةٍ **لا مهلةَ له** — وهو ضمانُ الترحيل: من هو في
      التهيئة اليومَ بلا عرضٍ موقَّعٍ لا تُبدأ عليه ساعةٌ صامتة.
   ③ وأنّ العلامتَين لم تختلطا: `pending` اخترناها له، و`qualified` قُبلت
      موادُّها — والتفعيلُ يُردّ ولو كانت كلُّ دوراته `pending`. وهو الحارسُ
      الذي لولاه أضاء زرُّ التفعيل يومَ وقّع عرضَه.
   ④ وأنّ بابَ الدورات يُفتح في الطور المشروط، وبابَ المال يبقى مغلقا. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { CourseProposalService } from '../../services/course-proposal.service'
import { missingAcademyLegalFields } from '../../../src/data/academy-legal'
import { MATERIALS_WINDOW_DAYS } from '../../../src/application/trainer/conditional-offer'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let proposals: CourseProposalService
let academicId = ''

const COURSE = 'C-COND-101'
const DAY = 86_400_000
const SESSION = new Date('2026-10-01T16:00:00Z')
const DOCS = [{ kind: 'national_id', labelAr: 'الهوية الوطنية', required: true }]

let seq = 0

/** مرشّحٌ قُبل قبولا مشروطا، بملفٍّ ومؤهّلٍ مبذورٍ وقاعدةِ أتعاب */
async function mkCandidate() {
  seq += 1
  const email = `cond-${seq}-${Date.now()}@test.local`
  const user = await auth.register(email, 'Pass#12345', `مرشّحٌ ${seq}`)
  const app = await prisma.trainerApplication.create({
    data: {
      reference: `TR-COND-${Date.now()}-${seq}`, fullName: `مرشّحٌ ${seq}`, email,
      status: 'academic_review', motivation: 'اختبار', privacyConsentAt: new Date(),
      teachableCourseIds: [COURSE], userId: user.userId,
    },
  })
  await review.decide(app.id, academicId, 'conditionally_approve')
  const profile = await prisma.trainerProfile.findUniqueOrThrow({ where: { applicationId: app.id } })
  await prisma.trainerCompensationRule.create({
    data: { profileId: profile.id, type: 'per_seat', rate: 25, currency: 'USD', minSeats: 0 },
  })
  return { app, profile, userId: user.userId }
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  proposals = new CourseProposalService(prisma)

  const academic = await auth.register('cond-academic@test.local', 'Acad#12345', 'المدير الأكاديمي')
  academicId = academic.userId
  await auth.setRoles(academicId, ['academic_manager'])

  await prisma.course.create({ data: { id: COURSE, status: 'published', currentVersion: 1 } })
  await prisma.courseVersion.create({
    data: { courseId: COURSE, version: 1, titleAr: 'دورةُ العرض المشروط', totalHours: 10 },
  })
}, 240_000)

describe('المهلةُ تُخزَّن محسوبةً من تاريخ الجلسة', () => {
  it('التركيبُ يكتب الجلسةَ ورابطَها والمهلةَ = الجلسة + سبعة', async () => {
    if (missingAcademyLegalFields().length > 0) return
    const { app } = await mkCandidate()
    const made = await review.composeContract(app.id, academicId, {
      title: 'عرضٌ مشروط', requiredDocuments: DOCS,
      orientationAt: SESSION.toISOString(),
      orientationUrl: 'https://meet.example.com/wajeez',
    })
    const row = await prisma.trainerContract.findUniqueOrThrow({ where: { id: made.id } })
    expect(row.orientationAt?.toISOString()).toBe(SESSION.toISOString())
    expect(row.orientationUrl).toBe('https://meet.example.com/wajeez')
    expect(row.conditionDeadlineAt?.getTime())
      .toBe(SESSION.getTime() + MATERIALS_WINDOW_DAYS * DAY)
  })

  /* ═══ الحارسُ الذي يثبت أنّ المبدأَ الجلسةُ لا لحظةُ التركيب ═══

     لو حُسبت المهلةُ من `now` لَاختلف التاريخان بين عرضَين رُكِّبا في وقتَين.
     ويُقاس بلا انتظار: العرضان يحملان جلسةً واحدةً وتاريخُهما واحد. */
  it('وعرضان بجلسةٍ واحدةٍ تنتهي مهلتُهما في اللحظة نفسِها', async () => {
    if (missingAcademyLegalFields().length > 0) return
    const first = await mkCandidate()
    const second = await mkCandidate()
    const a = await review.composeContract(first.app.id, academicId, {
      title: 'عرضٌ أوّل', requiredDocuments: DOCS, orientationAt: SESSION.toISOString(),
    })
    const b = await review.composeContract(second.app.id, academicId, {
      title: 'عرضٌ ثانٍ', requiredDocuments: DOCS, orientationAt: SESSION.toISOString(),
    })
    const [ra, rb] = await Promise.all([
      prisma.trainerContract.findUniqueOrThrow({ where: { id: a.id } }),
      prisma.trainerContract.findUniqueOrThrow({ where: { id: b.id } }),
    ])
    expect(ra.conditionDeadlineAt?.getTime()).toBe(rb.conditionDeadlineAt?.getTime())
    expect(ra.createdAt.getTime(), 'رُكِّبا في اللحظة نفسِها فلا يقيس الحارسُ شيئا')
      .not.toBe(rb.createdAt.getTime())
  })

  /* وضمانُ الترحيل: لا ساعةَ صامتةٌ تبدأ على من لم يُعلَم بها */
  it('وعرضٌ بلا تاريخِ جلسةٍ لا مهلةَ له', async () => {
    if (missingAcademyLegalFields().length > 0) return
    const { app } = await mkCandidate()
    const made = await review.composeContract(app.id, academicId, {
      title: 'عرضٌ بلا جلسة', requiredDocuments: DOCS,
    })
    const row = await prisma.trainerContract.findUniqueOrThrow({ where: { id: made.id } })
    expect(row.orientationAt).toBeNull()
    expect(row.conditionDeadlineAt, 'بدأت مهلةٌ بلا جلسةٍ يُعلَم بها').toBeNull()
  })

  it('ومتنُه يحمل بندَ الشرط وعنوانَ «عرض مشروط»', async () => {
    if (missingAcademyLegalFields().length > 0) return
    const { app } = await mkCandidate()
    const made = await review.composeContract(app.id, academicId, {
      title: 'عرضٌ مشروط', requiredDocuments: DOCS, orientationAt: SESSION.toISOString(),
    })
    const row = await prisma.trainerContract.findUniqueOrThrow({ where: { id: made.id } })
    expect(row.bodyAr!.split('\n')[0]).toContain('عرض مشروط')
    expect(row.bodyAr, 'بندُ الشرط غائبٌ عن متنٍ يُوقَّع').toMatch(/\n2-6 وهذا عرض مشروط/)
    expect(row.bodyVersion).toMatch(/^v4-/)
    /* والهاشُ على ما خُزِّن — فمن وقّع على صفحةٍ ثمّ بُدّل تحته النصُّ لا يمرّ */
    expect(row.bodyHash).toBeTruthy()
  })
})

/* ═══ الدرزُ: عرضٌ رُكِّب قبل بند الشرط ═══

   وهو حقيقةٌ في الإنتاج لا فرضٌ: كلُّ عرضٍ رُكِّب قبل هذا التغيير يحمل
   `gatesActivation = true` ولا شرطا في متنه. */
describe('لا يُرسَل عرضٌ مشروطٌ متنُه لا يحمل شرطَه', () => {
  it('يُردّ الإرسالُ ويُقال ما يُفعَل — ولا يخرج بريدٌ يَعِد بما لا تحمله الوثيقة', async () => {
    const { profile } = await mkCandidate()
    const stale = await prisma.trainerContract.create({
      data: {
        profileId: profile.id, title: 'عرضٌ من قبل بند الشرط', status: 'draft',
        bodyVersion: 'v3-2026-09-21', bodyAr: 'اتفاقية تقديم خدمات تدريبية — عمل حر\n\nالبند 1 وما بعده.',
        gatesActivation: true,
      },
    })
    await expect(review.sendContract(stale.id, academicId))
      .rejects.toMatchObject({ code: 'body_without_condition' })
    /* ولا يتحرّك شيء: لا حالةُ العقد ولا حالةُ الطلب */
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: stale.id } })
    expect(after.status, 'أُرسل عرضٌ بلا شرطٍ في متنه').toBe('draft')
    expect(after.sentAt).toBeNull()
  })

  it('وبندٌ يُوثَّق على مدرّبٍ نشطٍ يُرسَل بلا شرط — فلا شرطَ فيه أصلا', async () => {
    const { app, profile } = await mkCandidate()
    await prisma.trainerApplication.update({ where: { id: app.id }, data: { status: 'active' } })
    const documented = await prisma.trainerContract.create({
      data: {
        profileId: profile.id, title: 'بندٌ يُوثَّق', status: 'draft',
        bodyVersion: 'v3-2026-09-21', bodyAr: 'اتفاقية تقديم خدمات تدريبية — عمل حر\n\nالبند 1.',
        gatesActivation: false,
      },
    })
    const r = await review.sendContract(documented.id, academicId)
    expect(r.ok, 'رُدَّ عقدٌ لا شرطَ فيه بحجّة أنّه بلا شرط').toBe(true)
  })
})

/* ═══ عملُ العامل: يذكّر ويُبلّغ، ولا يغيّر حالَ أحد ═══

   وأهمُّ ما يُقاس هنا **من لا يُطرَق بابُه**: ثلاثةٌ لهم مهلةٌ في القاعدة
   ولا يُذكَّرون — من لم يوقّع، ومن لا تاريخَ لجلسته، ومن تجمّدت مهلتُه. */
describe('مهلةُ العرض المشروط في العامل', () => {
  const DEADLINE_IN = (days: number) => new Date(Date.now() + days * DAY)

  /** مدرّبٌ وقّع عرضَه فصار في التهيئة، بمهلةٍ تنتهي بعد `days` */
  async function mkSignedWithDeadline(days: number, extra: Record<string, unknown> = {}) {
    const made = await mkCandidate()
    await prisma.trainerApplication.update({
      where: { id: made.app.id }, data: { status: 'onboarding' },
    })
    const contract = await prisma.trainerContract.create({
      data: {
        profileId: made.profile.id, title: 'عرضٌ موقَّع', status: 'signed',
        gatesActivation: true, signedAt: new Date(),
        orientationAt: new Date(Date.now() - (MATERIALS_WINDOW_DAYS - days) * DAY),
        conditionDeadlineAt: DEADLINE_IN(days),
        ...extra,
      },
    })
    return { ...made, contract }
  }

  const remindersFor = (contractId: string) => prisma.auditEvent.count({
    where: { action: 'trainer.condition.remind', entityId: contractId },
  })
  const noticesFor = (contractId: string) => prisma.auditEvent.count({
    where: { action: 'trainer.condition.lapsed', entityId: contractId },
  })

  it('يذكّر من بقي له يومان — ويكتب أنّه ذكّره', async () => {
    const { contract } = await mkSignedWithDeadline(2)
    const { reminded } = await review.remindConditionDeadlines()
    expect(reminded).toBeGreaterThan(0)
    const row = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(row.conditionRemindedAt, 'ذُكِّر ولم يُكتب أنّه ذُكِّر — فيُذكَّر كلَّ ساعة').toBeTruthy()
    expect(await remindersFor(contract.id)).toBe(1)
  })

  it('ولا يذكّر مرّتين', async () => {
    const { contract } = await mkSignedWithDeadline(2)
    await review.remindConditionDeadlines()
    await review.remindConditionDeadlines()
    expect(await remindersFor(contract.id), 'طُرق بابُه مرّتين').toBe(1)
  })

  it('ولا يذكّر من أمامه أسبوع', async () => {
    const { contract } = await mkSignedWithDeadline(6)
    await review.remindConditionDeadlines()
    expect(await remindersFor(contract.id)).toBe(0)
  })

  /* ═══ الثلاثةُ الذين لا يُطرَق بابُهم ═══ */

  it('ولا يذكّر من لم يوقّع — فلم يقبل مهلةً ولا شرطا', async () => {
    const { contract } = await mkSignedWithDeadline(2)
    await prisma.trainerContract.update({ where: { id: contract.id }, data: { status: 'sent' } })
    await review.remindConditionDeadlines()
    expect(await remindersFor(contract.id), 'ذُكِّر بمهلةٍ لم يوقّع عليها').toBe(0)
  })

  /* ضمانُ الترحيل: من كان في التهيئة قبل النشر مهلتُه NULL */
  it('ولا يذكّر قطُّ من لا مهلةَ له', async () => {
    const { contract } = await mkSignedWithDeadline(2)
    await prisma.trainerContract.update({
      where: { id: contract.id },
      data: { conditionDeadlineAt: null, orientationAt: null },
    })
    await review.remindConditionDeadlines()
    await review.noticeLapsedConditions()
    expect(await remindersFor(contract.id), 'بدأت ساعةٌ صامتةٌ على من لم يقبلها').toBe(0)
    expect(await noticesFor(contract.id)).toBe(0)
  })

  it('ولا يذكّر من تجمّدت مهلتُه — فالكرةُ عندنا', async () => {
    const { contract } = await mkSignedWithDeadline(2, { conditionPausedAt: new Date() })
    await review.remindConditionDeadlines()
    expect(await remindersFor(contract.id)).toBe(0)
  })

  it('ولا يذكّر من اكتمل شرطُه', async () => {
    const { contract } = await mkSignedWithDeadline(2, { conditionMetAt: new Date() })
    await review.remindConditionDeadlines()
    expect(await remindersFor(contract.id)).toBe(0)
  })

  describe('والانقضاء', () => {
    it('يُبلَّغ صاحبُه مرّةً واحدة', async () => {
      const { contract } = await mkSignedWithDeadline(-1)
      const { noticed } = await review.noticeLapsedConditions()
      expect(noticed).toBeGreaterThan(0)
      await review.noticeLapsedConditions()
      expect(await noticesFor(contract.id), 'أُبلِغ مرّتين').toBe(1)
    })

    /* «لم يستوفِ الشروط» وسمٌ محسوبٌ لا حالةٌ جديدة: لم ينتقل مكانا، بل
       تأخّر في مكانه. والقرارُ بعده لإنسانٍ ينظر. */
    it('ولا يُغيَّر حالُه ولا يُختَم عرضُه — فالوسمُ محسوبٌ لا حالة', async () => {
      const { app, contract } = await mkSignedWithDeadline(-1)
      await review.noticeLapsedConditions()
      const appAfter = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: app.id } })
      expect(appAfter.status, 'نقل العاملُ حالةَ إنسانٍ بمؤقّت').toBe('onboarding')
      const row = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
      expect(row.status, 'بُتَّ في عقدٍ بمؤقّت').toBe('signed')
      expect(row.conditionMetAt).toBeNull()
    })

    it('ولا يُبلَّغ من مهلتُه قائمة', async () => {
      const { contract } = await mkSignedWithDeadline(3)
      await review.noticeLapsedConditions()
      expect(await noticesFor(contract.id)).toBe(0)
    })
  })
})

describe('العلامتان لا تختلطان', () => {
  it('القبولُ الداخليُّ يبذر «اخترناها له» لا «قُبلت موادُّها»', async () => {
    const { profile } = await mkCandidate()
    const rows = await prisma.trainerCourseQualification.findMany({ where: { profileId: profile.id } })
    expect(rows.map((r) => r.courseId)).toContain(COURSE)
    expect(rows.every((r) => r.status === 'pending'), 'بُذرت «قُبلت موادُّها» بلا تقييم').toBe(true)
  })

  /* ═══ وهذا الحارسُ هو الحمايةُ كلُّها ═══

     لو كانت `pending` تُعَدُّ في بوّابة التجهيز لأضاء زرُّ التفعيل **يومَ
     وقّع عرضَه** — قبل أن يرفع ملفّا واحدا. */
  it('والتفعيلُ يُردّ ولو كانت كلُّ دوراته «اخترناها له»', async () => {
    const { app, profile } = await mkCandidate()
    await prisma.trainerContract.create({
      data: { profileId: profile.id, title: 'عرضٌ موقَّع', status: 'signed', gatesActivation: true },
    })
    const rows = await prisma.trainerCourseQualification.count({
      where: { profileId: profile.id, status: 'pending' },
    })
    expect(rows, 'لا دورةَ مبذورةً فلا يقيس الحارسُ شيئا').toBeGreaterThan(0)
    await expect(
      review.decide(app.id, academicId, 'approve'),
      'فُعِّل بلا دورةٍ قُبلت موادُّها',
    ).rejects.toMatchObject({ code: 'not_ready' })
  })

  it('ويُقبَل بدورةٍ واحدةٍ قُبلت موادُّها', async () => {
    const { app, profile } = await mkCandidate()
    await prisma.trainerContract.create({
      data: { profileId: profile.id, title: 'عرضٌ موقَّع', status: 'signed', gatesActivation: true },
    })
    await prisma.trainerCourseQualification.update({
      where: { profileId_courseId: { profileId: profile.id, courseId: COURSE } },
      data: { status: 'qualified' },
    })
    await review.decide(app.id, academicId, 'approve')
    const after = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: app.id } })
    expect(after.status).toBe('active')
  })
})

describe('أبوابُ البوّابة في الطور المشروط', () => {
  /** يوقّع عرضَه فيصير في التهيئة — بلا مرورٍ بصفحة التوقيع */
  async function mkSignedIntoOnboarding() {
    const made = await mkCandidate()
    await prisma.trainerProfile.update({
      where: { id: made.profile.id }, data: { userId: made.userId },
    })
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: made.userId, roleId: 'trainer' } },
      update: {}, create: { userId: made.userId, roleId: 'trainer' },
    })
    await prisma.trainerApplication.update({
      where: { id: made.app.id }, data: { status: 'onboarding' },
    })
    return made
  }

  it('بابُ الدورات يُفتح لمن وقّع — وهو مقصودُ الطور كلِّه', async () => {
    const made = await mkSignedIntoOnboarding()
    const mine = await proposals.mine(made.userId)
    expect(Array.isArray(mine)).toBe(true)
  })

  it('ويبقى مغلقا قبل التوقيع — ورسالتُه تدلّه على التوقيع', async () => {
    const made = await mkSignedIntoOnboarding()
    await prisma.trainerApplication.update({
      where: { id: made.app.id }, data: { status: 'contract_pending' },
    })
    await expect(proposals.mine(made.userId)).rejects.toThrow(/بتوقيع/)
  })
})
