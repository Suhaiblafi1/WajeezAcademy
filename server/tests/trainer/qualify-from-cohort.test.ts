/* الإسنادُ من الشعبة — خطوةٌ واحدة للمؤهَّل، وطلبٌ واحد لغيره.

   كان التأهيلُ والإسنادُ فعلين منفصلين في شاشتين: يُؤهَّل المدرّب من «عمليات
   المدربين»، ثمّ يُسنَد من «عمليات الشعبة». فمن أراد مدرّبا لشعبةٍ بعينها
   مشى ثلاث خطوات في مكانين، وأوّلُها لا يعرف شيئا عن آخرها — ولو نسي
   الثانية بقي المدرّبُ مؤهَّلا بلا شعبة والشعبةُ بلا مدرّب.

   وقرارُ صاحب المنصّة: «لو المدرب مؤهَّل مسبقا، الإسنادُ من الشعبة يكفي
   وحدَه. ولو غيرَ مؤهَّل، زرٌّ واحد "أهّله وأسنده الآن" يرسل طلبَ تأهيلٍ
   لموافقة المدير الأكاديميّ، وعند الموافقة يُضاف تلقائيا لتأهيلاته ويُسنَد».

   وهذا الملفّ يحرس ثلاثة أشياء لا يُتنازل عن واحدٍ منها:

   ١) **بوّابةُ نزاهة التأهيل**: من يطلب ليس من يقرّر. ولو جاز للطالب أن
      يقرّر لصارت الموافقةُ ختما لا مراجعة.
   ٢) **الموافقةُ فعلٌ واحد**: تؤهّل وتُسند معا — وإلّا عاد الافتراقُ الذي
      نغلقه من بابٍ آخر.
   ٣) **تعارضُ الجدول يُفحص قبل الطلب**: يُردّ الطالبُ الآن، لا بعد يومين من
      انتظار قرارٍ لا يقبل التنفيذ. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { CohortService } from '../../services/cohort.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let cohorts: CohortService
let app: FastifyInstance

let profileId = ''
let opsId = ''          // يدير الشعب — يطلب ولا يقرّر
let academicId = ''     // يقرّر
let opsCookie = ''
let academicCookie = ''

const COURSE = 'C-BIZ-101'
const DAY = 86_400_000

const cookieFor = async (email: string, password: string) =>
  `${SESSION_COOKIE}=${(await auth.login(email, password)).token}`

/** شعبةٌ بجلسةٍ واحدة في وقتٍ محدَّد — لتُقاس التعارضاتُ بها */
async function mkCohort(title: string, startsAt: Date) {
  const c = await prisma.cohort.create({
    data: {
      courseId: COURSE, title, status: 'open', registrationOpen: true,
      financialReady: true, price: 100, currency: 'USD', capacity: 10,
      startsAt,
    },
  })
  await prisma.cohortSession.create({
    data: { cohortId: c.id, title: `جلسة ${title}`, startsAt, endsAt: new Date(startsAt.getTime() + 3_600_000) },
  })
  return c
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  cohorts = new CohortService(prisma)
  app = await buildApp(prisma)

  const ops = await auth.register('qual-ops@test.local', 'Ops#12345', 'مدير العمليات')
  opsId = ops.userId
  await auth.setRoles(opsId, ['operations_manager'])
  opsCookie = await cookieFor('qual-ops@test.local', 'Ops#12345')

  const academic = await auth.register('qual-academic@test.local', 'Acad#12345', 'المدير الأكاديمي')
  academicId = academic.userId
  await auth.setRoles(academicId, ['academic_manager'])
  academicCookie = await cookieFor('qual-academic@test.local', 'Acad#12345')

  const trainerUser = await auth.register('qual-trainer@test.local', 'Trainer#12345', 'مدرّب التأهيل')
  await auth.setRoles(trainerUser.userId, ['trainer'])
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-QUAL-${Date.now()}`, fullName: 'مدرّب التأهيل', email: 'qual-trainer@test.local',
      status: 'active', motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  profileId = (await prisma.trainerProfile.create({
    data: { applicationId: application.id, userId: trainerUser.userId, isVerified: true },
  })).id
}, 240_000)

/** يمسح تأهيلَ المدرّب وإسناداتِه — فلا يرث اختبارٌ حالةَ ما قبله */
async function reset() {
  await prisma.trainerCourseQualification.deleteMany({ where: { profileId } })
  await prisma.cohortTrainer.deleteMany({ where: { profileId } })
  await prisma.trainerCourseAssignment.deleteMany({ where: { profileId } })
}

describe('الشاشةُ تعرف من هو المؤهَّل قبل النقر', () => {
  it('تقول عن كلّ مدرّب حالَ تأهيله لدورة هذه الشعبة', async () => {
    await reset()
    const c = await mkCohort('شعبة الترشيح', new Date(Date.now() + 30 * DAY))
    const before = (await cohorts.eligibleTrainersFor(c.id)).find((t) => t.profileId === profileId)
    expect(before?.qualification, 'غير المؤهَّل يُقرأ مؤهَّلا').toBe('none')

    await review.qualifyForCourse(profileId, COURSE, academicId)
    const after = (await cohorts.eligibleTrainersFor(c.id)).find((t) => t.profileId === profileId)
    expect(after?.qualification).toBe('qualified')
  })
})

describe('المؤهَّلُ يُسنَد بخطوةٍ واحدة', () => {
  it('الإسنادُ من الشعبة يكفي وحدَه — بلا خطوةٍ ثانية في شاشةٍ أخرى', async () => {
    await reset()
    await review.qualifyForCourse(profileId, COURSE, academicId)
    const c = await mkCohort('شعبة المؤهَّل', new Date(Date.now() + 31 * DAY))
    await cohorts.assignTrainer(c.id, profileId, opsId, 'lead')
    expect(await prisma.cohortTrainer.count({ where: { cohortId: c.id, profileId } })).toBe(1)
  })
})

describe('غيرُ المؤهَّل: طلبٌ واحد، وموافقةٌ تؤهّل وتُسند', () => {
  it('الطلبُ يُقدَّم من الشعبة ويحمل شعبتَه معه', async () => {
    await reset()
    const c = await mkCohort('شعبة الطلب', new Date(Date.now() + 32 * DAY))
    const row = await review.requestQualification(profileId, COURSE, c.id, opsId)
    expect(row.status).toBe('pending')
    expect(row.requestedCohortId, 'الطلبُ بلا شعبة — فبمَ يُسنَد بعد الموافقة؟').toBe(c.id)
  })

  it('والموافقةُ فعلٌ واحد: تؤهّل وتُسند معا', async () => {
    await reset()
    const c = await mkCohort('شعبة الموافقة', new Date(Date.now() + 33 * DAY))
    const req = await review.requestQualification(profileId, COURSE, c.id, opsId)
    const r = await review.decideQualification(req.id, true, academicId)

    expect(r.qualification.status).toBe('qualified')
    expect(r.assigned, `لم يقع الإسناد: ${r.assignNote}`).toBe(true)
    expect(await prisma.cohortTrainer.count({ where: { cohortId: c.id, profileId } })).toBe(1)
  })

  it('والرفضُ لا يكون صامتا — سببٌ يُقرأ أو لا رفض', async () => {
    await reset()
    const c = await mkCohort('شعبة الرفض', new Date(Date.now() + 34 * DAY))
    const req = await review.requestQualification(profileId, COURSE, c.id, opsId)
    await expect(review.decideQualification(req.id, false, academicId)).rejects.toThrow(/سببا/)

    const r = await review.decideQualification(req.id, false, academicId, 'خبرتُه في مجالٍ آخر')
    expect(r.qualification.status).toBe('rejected')
    expect(r.qualification.note).toBe('خبرتُه في مجالٍ آخر')
    expect(await prisma.cohortTrainer.count({ where: { cohortId: c.id, profileId } })).toBe(0)
  })

  it('ولا يُبَتّ في طلبٍ مرّتين', async () => {
    await reset()
    const c = await mkCohort('شعبة البتّ', new Date(Date.now() + 35 * DAY))
    const req = await review.requestQualification(profileId, COURSE, c.id, opsId)
    await review.decideQualification(req.id, true, academicId)
    await expect(review.decideQualification(req.id, true, academicId)).rejects.toThrow(/من قبل/)
  })

  it('ولا يُطلَب تأهيلُ من هو مؤهَّل — يُسنَد مباشرة', async () => {
    await reset()
    await review.qualifyForCourse(profileId, COURSE, academicId)
    const c = await mkCohort('شعبة المؤهَّل سلفا', new Date(Date.now() + 36 * DAY))
    await expect(review.requestQualification(profileId, COURSE, c.id, opsId)).rejects.toThrow(/مؤهَّل/)
  })
})

describe('تعارضُ الجدول يُفحص قبل الطلب لا بعد الموافقة', () => {
  it('مدرّبٌ له جلسةٌ في الوقت نفسِه لا يُطلب تأهيلُه لشعبةٍ تعارضها', async () => {
    await reset()
    const when = new Date(Date.now() + 40 * DAY)
    /* شعبةٌ مسندةٌ إليه فعلا في ذلك الوقت */
    await review.qualifyForCourse(profileId, COURSE, academicId)
    const busy = await mkCohort('شعبةٌ مشغولة', when)
    await cohorts.assignTrainer(busy.id, profileId, opsId, 'lead')

    /* ثمّ شعبةٌ أخرى في التوقيت نفسِه، ودورةٌ لم يُؤهَّل لها */
    await prisma.trainerCourseQualification.deleteMany({ where: { profileId } })
    const clash = await mkCohort('شعبةٌ تتعارض', when)
    await expect(
      review.requestQualification(profileId, COURSE, clash.id, opsId),
      'قُبل الطلبُ على تعارضٍ — فيُنتظر قرارٌ لا يقبل التنفيذ',
    ).rejects.toThrow(/تعارض جدول/)
  })
})

describe('بوّابةُ النزاهة: من يطلب ليس من يقرّر', () => {
  it('مديرُ العمليات يطلب ولا يبتّ', async () => {
    await reset()
    const c = await mkCohort('شعبة البوّابة', new Date(Date.now() + 50 * DAY))
    const ask = await app.inject({
      method: 'POST', url: `/api/admin/cohorts/${c.id}/qualification-requests`,
      headers: { cookie: opsCookie }, payload: { profileId, courseId: COURSE },
    })
    expect(ask.statusCode, ask.body).toBe(201)
    const id = ask.json().id

    const decide = await app.inject({
      method: 'POST', url: `/api/admin/qualification-requests/${id}/decide`,
      headers: { cookie: opsCookie }, payload: { approve: true },
    })
    expect(decide.statusCode, 'الطالبُ بتّ في طلبه — فالموافقةُ ختمٌ لا مراجعة').toBe(403)
  })

  it('والمديرُ الأكاديميّ يبتّ ولا يُشترط أن يكون هو الطالب', async () => {
    await reset()
    const c = await mkCohort('شعبة القرار', new Date(Date.now() + 51 * DAY))
    const ask = await app.inject({
      method: 'POST', url: `/api/admin/cohorts/${c.id}/qualification-requests`,
      headers: { cookie: opsCookie }, payload: { profileId, courseId: COURSE },
    })
    const id = ask.json().id
    const decide = await app.inject({
      method: 'POST', url: `/api/admin/qualification-requests/${id}/decide`,
      headers: { cookie: academicCookie }, payload: { approve: true },
    })
    expect(decide.statusCode, decide.body).toBe(200)
    expect(decide.json().assigned).toBe(true)
  })

  it('والطابورُ مقروءٌ لمن يبتّ وحدَه', async () => {
    const mine = await app.inject({ method: 'GET', url: '/api/admin/qualification-requests', headers: { cookie: academicCookie } })
    expect(mine.statusCode).toBe(200)
    const theirs = await app.inject({ method: 'GET', url: '/api/admin/qualification-requests', headers: { cookie: opsCookie } })
    expect(theirs.statusCode).toBe(403)
  })
})

/* ─────────── آخرُ السلسلة: قرارٌ إداريّ ينهي مسار المدرّب ───────────

   كانت السلسلةُ تنتهي عند «قبول مشروط»، ولا زرَّ بعده في `DECISIONS[]`. فمن
   اجتاز المراجعةَ الأكاديميّة يبقى `conditionally_approved` أو
   `contract_pending` إلى الأبد ما لم يُنشئ حسابَه بنفسه من رابط الدعوة — أي
   أنّ آخرَ قرارٍ في مسار المدرّب لم يكن بيد الإدارة أصلا.

   وشرطُ الحساب ليس تشدّدا: مدرّبٌ «نشط» بلا حساب لا يفتح بوابتَه ولا يُسنَد
   إليه شيء، وحالتُه في الشاشة تقول غيرَ الحقيقة. */
describe('التفعيلُ النهائيّ ورفعُ الإيقاف', () => {
  let appId = ''
  let deciderId = ''

  beforeAll(async () => {
    const d = await auth.register('activate-decider@test.local', 'Dec#12345', 'المقرِّر')
    deciderId = d.userId
    await auth.setRoles(deciderId, ['academic_manager'])
    const a = await prisma.trainerApplication.create({
      data: {
        reference: `TR-ACT-${Date.now()}`, fullName: 'مدرّب التفعيل', email: 'activate-tr@test.local',
        status: 'contract_pending', motivation: 'اختبار', privacyConsentAt: new Date(),
      },
    })
    appId = a.id
    await prisma.trainerProfile.create({ data: { applicationId: a.id } })
  })

  it('لا يُفعَّل مدرّبٌ بلا حساب — «نشطٌ» لا يستطيع الدخول حالةٌ تكذب', async () => {
    await review.decide(appId, deciderId, 'start_onboarding')
    expect((await prisma.trainerApplication.findUnique({ where: { id: appId } }))!.status).toBe('onboarding')
    await expect(review.decide(appId, deciderId, 'activate')).rejects.toThrow(/لا حساب/)
  })

  it('وبحسابٍ يُفعَّل — وهو آخرُ قرارٍ في السلسلة', async () => {
    const u = await auth.register('activate-tr@test.local', 'Tr#12345', 'مدرّب التفعيل')
    const profile = await prisma.trainerProfile.findUnique({ where: { applicationId: appId } })
    await prisma.trainerProfile.update({ where: { id: profile!.id }, data: { userId: u.userId } })

    await review.decide(appId, deciderId, 'activate')
    expect((await prisma.trainerApplication.findUnique({ where: { id: appId } }))!.status).toBe('active')
  })

  it('ورفعُ الإيقاف يُعيد الملفَّ والحساب معا — لا أحدَهما', async () => {
    const profile = await prisma.trainerProfile.findUnique({ where: { applicationId: appId } })
    await review.suspendTrainer(profile!.id, deciderId, 'اختبار الإيقاف')

    const suspended = await prisma.trainerProfile.findUnique({ where: { id: profile!.id } })
    expect(suspended!.suspendedAt).not.toBeNull()
    expect((await prisma.user.findUnique({ where: { id: suspended!.userId! } }))!.status).toBe('suspended')

    await review.decide(appId, deciderId, 'reinstate', 'انتهى سببُ الإيقاف')
    const back = await prisma.trainerProfile.findUnique({ where: { id: profile!.id } })
    expect(back!.suspendedAt, 'رُفع الإيقافُ عن الطلب وبقي على الملفّ').toBeNull()
    expect(
      (await prisma.user.findUnique({ where: { id: back!.userId! } }))!.status,
      'رُفع الإيقافُ عن الملفّ وبقي الحسابُ موقوفا — فلا يستطيع الدخول',
    ).toBe('active')
  })
})
