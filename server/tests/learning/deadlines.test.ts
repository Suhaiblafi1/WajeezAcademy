/* «ما عليك بموعد» — لوحُ المتعلّم وجدولُ المدرّب (المهمّة ٧٢).

   البياناتُ موجودةٌ منذ زمنٍ ولا شاشةَ تجمعها بالوقت. وأخطرُ ما يقع في
   ميزةٍ كهذه أن **تُطالِب بما سُلِّم** أو أن **تُخفي ما رُدَّ للإعادة** —
   فالأوّلُ يُفقِد اللوحَ ثقتَه، والثاني يُفقِد المتعلّمَ درجتَه.

   وأربعةُ شروطٍ صامتةٍ تُحرَس هنا لأنّ سقوطَها لا يُرى في الشاشة:

   ١) تقييمٌ **بلا `dueAt`** ليس موعدا، فلا يُعرض بموعدٍ مُختلَق.
   ٢) تقييمٌ **مسوّدةٌ أو مغلق** ليس مطلوبا.
   ٣) تسجيلٌ **منسحبٌ أو في قائمة الانتظار** لا يُطالَب صاحبُه.
   ٤) و«طُلبت إعادةُ التسليم» **تُرجِع** التقييمَ إلى اللوح — سلّم قبلا أو لم
      يسلّم، الكرةُ في ملعبه.

   وفي جدول المدرّب شرطٌ واحدٌ هو سببُ الشاشة: التزاحمُ **بين شعبه هو**،
   وهو ما لا يمنعه حارسُ الإسناد لأنّ الجلسةَ أُضيفت بعده. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { DeadlinesService } from '../../services/deadlines.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let auth: AuthService
let deadlines: DeadlinesService
let app: FastifyInstance

let learnerId = ''
let learnerCookie = ''
let trainerUserId = ''
let trainerCookie = ''
let profileId = ''

const COURSE = 'C-BIZ-101'
const DAY = 86_400_000

async function mkCohort(title: string) {
  return prisma.cohort.create({
    data: {
      courseId: COURSE, title, status: 'active', registrationOpen: true,
      financialReady: true, price: 100, currency: 'USD', capacity: 20,
    },
  })
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  deadlines = new DeadlinesService(prisma)
  app = await buildApp(prisma)

  const learner = await auth.register('deadlines-learner@test.local', 'Learn#12345', 'متعلّمُ المواعيد')
  learnerId = learner.userId
  await auth.setRoles(learnerId, ['learner'])
  learnerCookie = `${SESSION_COOKIE}=${(await auth.login('deadlines-learner@test.local', 'Learn#12345')).token}`

  const academic = await auth.register('deadlines-academic@test.local', 'Acad#12345', 'المدير الأكاديمي')
  await auth.setRoles(academic.userId, ['academic_manager'])

  const trainerUser = await auth.register('deadlines-trainer@test.local', 'Trainer#12345', 'مدرّبُ الجدول')
  trainerUserId = trainerUser.userId
  await auth.setRoles(trainerUserId, ['trainer'])
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-DL-${Date.now()}`, fullName: 'مدرّبُ الجدول', email: 'deadlines-trainer@test.local',
      status: 'active', motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  profileId = (await prisma.trainerProfile.create({
    data: { applicationId: application.id, userId: trainerUserId, isVerified: true },
  })).id
  await new TrainerReviewService(prisma).qualifyForCourse(profileId, COURSE, academic.userId)
  trainerCookie = `${SESSION_COOKIE}=${(await auth.login('deadlines-trainer@test.local', 'Trainer#12345')).token}`
}, 240_000)

async function reset() {
  await prisma.assignmentSubmission.deleteMany({})
  await prisma.assessmentAttempt.deleteMany({})
  await prisma.cohortAssessment.deleteMany({})
  await prisma.enrollment.deleteMany({ where: { userId: learnerId } })
  await prisma.cohortTrainer.deleteMany({ where: { profileId } })
  await prisma.cohortSession.deleteMany({})
  await prisma.retrievalCard.deleteMany({ where: { userId: learnerId } })
}

describe('مواعيدُ المتعلّم', () => {
  it('تقييمٌ منشورٌ بموعدٍ لم يُسلَّم يظهر بموعده ودرجةِ إلحاحه', async () => {
    await reset()
    const c = await mkCohort('شعبةُ المواعيد')
    const e = await prisma.enrollment.create({ data: { cohortId: c.id, userId: learnerId, status: 'enrolled' } })
    await prisma.cohortAssessment.create({
      data: { cohortId: c.id, title: 'واجبُ الأسبوع', type: 'assignment', dueAt: new Date(Date.now() + 2 * DAY) },
    })
    const out = await deadlines.forLearner(learnerId)
    expect(out.items).toHaveLength(1)
    expect(out.items[0].title).toBe('واجبُ الأسبوع')
    expect(out.items[0].urgency).toBe('soon')
    expect(out.items[0].dueLabelAr).toBe('بعد يومين')
    expect(out.items[0].enrollmentId).toBe(e.id)
    /* المعرّفُ الذي تفتح به الواجهةُ مرحلةَ الدورة — لا رابطٌ إلى العدم */
    expect(out.items[0].courseId).toBe(COURSE)
    expect(out.overdue).toBe(0)
  })

  it('وما فات موعدُه يُعَدّ فائتا ويُقال في المعنى', async () => {
    await reset()
    const c = await mkCohort('شعبةُ الفائت')
    await prisma.enrollment.create({ data: { cohortId: c.id, userId: learnerId, status: 'enrolled' } })
    await prisma.cohortAssessment.create({
      data: { cohortId: c.id, title: 'واجبٌ فات', type: 'assignment', dueAt: new Date(Date.now() - 3 * DAY) },
    })
    const out = await deadlines.forLearner(learnerId)
    expect(out.overdue).toBe(1)
    expect(out.items[0].urgency).toBe('overdue')
    /* عربيّةٌ سليمة: «وواحدٌ منها فات موعدُه» لا «منها ١ فات موعدُه» */
    expect(out.meaningAr).toContain('وواحدٌ منها فات موعدُه')
    expect(out.meaningAr).not.toMatch(/منها 1 /)
  })

  it('وما سُلِّم لا يُطالَب به — وإلّا فقد اللوحُ ثقتَه', async () => {
    await reset()
    const c = await mkCohort('شعبةُ التسليم')
    const e = await prisma.enrollment.create({ data: { cohortId: c.id, userId: learnerId, status: 'enrolled' } })
    const a = await prisma.cohortAssessment.create({
      data: { cohortId: c.id, title: 'واجبٌ سُلِّم', type: 'assignment', dueAt: new Date(Date.now() + DAY) },
    })
    await prisma.assignmentSubmission.create({
      data: { assessmentId: a.id, enrollmentId: e.id, textAnswer: 'جوابي', status: 'submitted' },
    })
    expect((await deadlines.forLearner(learnerId)).items).toHaveLength(0)
  })

  it('و«طُلبت إعادةُ التسليم» تُرجعه إلى اللوح موسوما — لا تُخفيه', async () => {
    await reset()
    const c = await mkCohort('شعبةُ الإعادة')
    const e = await prisma.enrollment.create({ data: { cohortId: c.id, userId: learnerId, status: 'enrolled' } })
    const a = await prisma.cohortAssessment.create({
      data: { cohortId: c.id, title: 'واجبٌ رُدَّ', type: 'assignment', dueAt: new Date(Date.now() + DAY) },
    })
    await prisma.assignmentSubmission.create({
      data: { assessmentId: a.id, enrollmentId: e.id, textAnswer: 'جوابي', status: 'resubmit_requested' },
    })
    const out = await deadlines.forLearner(learnerId)
    expect(out.items).toHaveLength(1)
    expect(out.items[0].resubmitRequested).toBe(true)
  })

  it('ومحاولةُ اختبارٍ مسجَّلةٌ تُخرجه من اللوح كما يُخرجه التسليم', async () => {
    await reset()
    const c = await mkCohort('شعبةُ الاختبار')
    const e = await prisma.enrollment.create({ data: { cohortId: c.id, userId: learnerId, status: 'enrolled' } })
    const a = await prisma.cohortAssessment.create({
      data: { cohortId: c.id, title: 'اختبارٌ أُدّي', type: 'quiz', dueAt: new Date(Date.now() + DAY) },
    })
    await prisma.assessmentAttempt.create({ data: { assessmentId: a.id, enrollmentId: e.id, status: 'submitted' } })
    expect((await deadlines.forLearner(learnerId)).items).toHaveLength(0)
  })

  it('وتقييمٌ بلا موعدٍ ليس موعدا — فلا يُعرض بتاريخٍ مُختلَق', async () => {
    await reset()
    const c = await mkCohort('شعبةٌ بلا موعد')
    await prisma.enrollment.create({ data: { cohortId: c.id, userId: learnerId, status: 'enrolled' } })
    await prisma.cohortAssessment.create({
      data: { cohortId: c.id, title: 'مشروعٌ مفتوح', type: 'project', dueAt: null },
    })
    const out = await deadlines.forLearner(learnerId)
    expect(out.items).toHaveLength(0)
    expect(out.meaningAr).toContain('لا تسليمَ عليك')
  })

  it('والمسوّدةُ والمغلقُ ليسا مطلوبَين', async () => {
    await reset()
    const c = await mkCohort('شعبةُ الحالات')
    await prisma.enrollment.create({ data: { cohortId: c.id, userId: learnerId, status: 'enrolled' } })
    await prisma.cohortAssessment.create({
      data: { cohortId: c.id, title: 'مسوّدة', type: 'assignment', status: 'draft', dueAt: new Date(Date.now() + DAY) },
    })
    await prisma.cohortAssessment.create({
      data: { cohortId: c.id, title: 'مغلق', type: 'assignment', status: 'closed', dueAt: new Date(Date.now() + DAY) },
    })
    expect((await deadlines.forLearner(learnerId)).items).toHaveLength(0)
  })

  it('والمنسحبُ والمنتظرُ في القائمة لا يُطالَبان', async () => {
    await reset()
    const dropped = await mkCohort('شعبةٌ انسحب منها')
    const waiting = await mkCohort('شعبةُ الانتظار')
    await prisma.enrollment.create({ data: { cohortId: dropped.id, userId: learnerId, status: 'dropped' } })
    await prisma.enrollment.create({ data: { cohortId: waiting.id, userId: learnerId, status: 'waitlisted' } })
    for (const c of [dropped, waiting]) {
      await prisma.cohortAssessment.create({
        data: { cohortId: c.id, title: `واجبُ ${c.title}`, type: 'assignment', dueAt: new Date(Date.now() + DAY) },
      })
    }
    expect((await deadlines.forLearner(learnerId)).items).toHaveLength(0)
  })

  it('وما بعد الأفق (٣٠ يوما) لا يُعرض — عرضُ البعيد يُغرق القريب', async () => {
    await reset()
    const c = await mkCohort('شعبةُ الأفق')
    await prisma.enrollment.create({ data: { cohortId: c.id, userId: learnerId, status: 'enrolled' } })
    await prisma.cohortAssessment.create({
      data: { cohortId: c.id, title: 'واجبٌ بعيد', type: 'assignment', dueAt: new Date(Date.now() + 60 * DAY) },
    })
    expect((await deadlines.forLearner(learnerId)).items).toHaveLength(0)
  })

  it('وبطاقاتُ الاسترجاعِ تُعَدّ ولا تُعرَض صفوفا — أثرُها مختلف', async () => {
    await reset()
    for (let i = 0; i < 4; i++) {
      await prisma.retrievalCard.create({
        data: { userId: learnerId, moduleId: `C-BIZ-101-M${i + 1}`, checkIndex: 0, step: 0, dueAt: new Date(Date.now() - DAY) },
      })
    }
    const out = await deadlines.forLearner(learnerId)
    expect(out.retrievalDue).toBe(4)
    expect(out.items).toHaveLength(0)
    expect(out.meaningAr).toContain('مراجعتي')
  })

  it('والمسارُ محروسٌ بصلاحيّة المتعلّم ولا يبلغه زائر', async () => {
    const anon = await app.inject({ method: 'GET', url: '/api/learner/deadlines' })
    expect(anon.statusCode).toBe(401)
    const mine = await app.inject({
      method: 'GET', url: '/api/learner/deadlines', headers: { cookie: learnerCookie },
    })
    expect(mine.statusCode).toBe(200)
    const trainer = await app.inject({
      method: 'GET', url: '/api/learner/deadlines', headers: { cookie: trainerCookie },
    })
    expect(trainer.statusCode).toBe(403)
  })
})

describe('جدولُ المدرّب عبر شعبه', () => {
  it('يجمع جلساتِ شعبتَين في خطٍّ زمنيٍّ واحدٍ مرتَّب', async () => {
    await reset()
    const a = await mkCohort('شعبةُ الأحد')
    const b = await mkCohort('شعبةُ الاثنين')
    await prisma.cohortTrainer.createMany({
      data: [{ cohortId: a.id, profileId }, { cohortId: b.id, profileId }],
    })
    await prisma.cohortSession.create({
      data: { cohortId: b.id, title: 'جلسةُ الاثنين', startsAt: new Date(Date.now() + 3 * DAY), endsAt: new Date(Date.now() + 3 * DAY + 3_600_000) },
    })
    await prisma.cohortSession.create({
      data: { cohortId: a.id, title: 'جلسةُ الأحد', startsAt: new Date(Date.now() + 2 * DAY), endsAt: new Date(Date.now() + 2 * DAY + 3_600_000) },
    })
    const out = await deadlines.forTrainer(trainerUserId)
    expect(out.sessions.map((s) => s.title)).toEqual(['جلسةُ الأحد', 'جلسةُ الاثنين'])
    expect(out.cohorts).toBe(2)
    expect(out.clashing).toBe(0)
  })

  it('ويُظهر التزاحمَ بين شعبه — وهو ما لا يمنعه حارسُ الإسناد', async () => {
    await reset()
    const a = await mkCohort('شعبةٌ أولى')
    const b = await mkCohort('شعبةٌ ثانية')
    await prisma.cohortTrainer.createMany({
      data: [{ cohortId: a.id, profileId }, { cohortId: b.id, profileId }],
    })
    /* الجلستان أُضيفتا **بعد** الإسناد — فالحارسُ لم يُسأل عنهما */
    const at = Date.now() + 5 * DAY
    await prisma.cohortSession.create({
      data: { cohortId: a.id, title: 'جلسةٌ أولى', startsAt: new Date(at), endsAt: new Date(at + 2 * 3_600_000) },
    })
    await prisma.cohortSession.create({
      data: { cohortId: b.id, title: 'جلسةٌ متزاحمة', startsAt: new Date(at + 3_600_000), endsAt: new Date(at + 3 * 3_600_000) },
    })
    const out = await deadlines.forTrainer(trainerUserId)
    expect(out.clashing).toBe(2)
    expect(out.sessions[0].clashesWith).toHaveLength(1)
    expect(out.sessions[1].clashesWith).toHaveLength(1)
    /* والمثنّى مثنّى: «واثنتان منها تتزاحمان» لا «و٢ منها تتزاحم» */
    expect(out.meaningAr).toContain('واثنتان منها تتزاحمان')
    expect(out.meaningAr).toContain('جلستان في شعبتين')
  })

  it('وجلسةٌ بلا وقتِ نهايةٍ تُقدَّر ساعةً — فلا تتزاحم مع ما بعدها بساعتين', async () => {
    await reset()
    const a = await mkCohort('شعبةٌ بلا نهاية')
    const b = await mkCohort('شعبةٌ بعدها')
    await prisma.cohortTrainer.createMany({
      data: [{ cohortId: a.id, profileId }, { cohortId: b.id, profileId }],
    })
    const at = Date.now() + 7 * DAY
    await prisma.cohortSession.create({
      data: { cohortId: a.id, title: 'جلسةٌ بلا نهاية', startsAt: new Date(at), endsAt: null },
    })
    await prisma.cohortSession.create({
      data: { cohortId: b.id, title: 'بعد ساعتين', startsAt: new Date(at + 2 * 3_600_000), endsAt: new Date(at + 3 * 3_600_000) },
    })
    expect((await deadlines.forTrainer(trainerUserId)).clashing).toBe(0)
    /* وبعد نصف ساعةٍ تتزاحم — التقديرُ ساعةٌ لا صفر */
    await prisma.cohortSession.create({
      data: { cohortId: b.id, title: 'بعد نصف ساعة', startsAt: new Date(at + 1_800_000), endsAt: new Date(at + 2 * 3_600_000) },
    })
    expect((await deadlines.forTrainer(trainerUserId)).clashing).toBe(2)
  })

  it('والملغاةُ والماضيةُ خارجَ الجدول — الجدولُ ما أمامه لا ما خلفه', async () => {
    await reset()
    const c = await mkCohort('شعبةُ الحالات')
    await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId } })
    await prisma.cohortSession.create({
      data: { cohortId: c.id, title: 'ملغاة', status: 'cancelled', startsAt: new Date(Date.now() + DAY) },
    })
    await prisma.cohortSession.create({
      data: { cohortId: c.id, title: 'ماضية', startsAt: new Date(Date.now() - DAY) },
    })
    expect((await deadlines.forTrainer(trainerUserId)).sessions).toHaveLength(0)
  })

  it('ولا يرى المدرّبُ جلسةَ شعبةٍ لا يدرّبها', async () => {
    await reset()
    const mine = await mkCohort('شعبتي')
    const other = await mkCohort('شعبةُ غيري')
    await prisma.cohortTrainer.create({ data: { cohortId: mine.id, profileId } })
    await prisma.cohortSession.create({
      data: { cohortId: mine.id, title: 'جلستي', startsAt: new Date(Date.now() + DAY), endsAt: new Date(Date.now() + DAY + 3_600_000) },
    })
    await prisma.cohortSession.create({
      data: { cohortId: other.id, title: 'جلسةُ غيري', startsAt: new Date(Date.now() + DAY), endsAt: new Date(Date.now() + DAY + 3_600_000) },
    })
    const out = await deadlines.forTrainer(trainerUserId)
    expect(out.sessions.map((s) => s.title)).toEqual(['جلستي'])
  })

  it('والمسارُ محروسٌ بصلاحيّة تشغيل الشعب ولا يبلغه متعلّم', async () => {
    const anon = await app.inject({ method: 'GET', url: '/api/trainer/me/schedule' })
    expect(anon.statusCode).toBe(401)
    const learner = await app.inject({
      method: 'GET', url: '/api/trainer/me/schedule', headers: { cookie: learnerCookie },
    })
    expect(learner.statusCode).toBe(403)
    const mine = await app.inject({
      method: 'GET', url: '/api/trainer/me/schedule?days=7', headers: { cookie: trainerCookie },
    })
    expect(mine.statusCode).toBe(200)
    expect(JSON.parse(mine.body).days).toBe(7)
  })
})
