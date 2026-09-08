/* نافذةُ جدولةِ المدرّب — الحدُّ الذي يجعل نقلَ الصلاحية آمنا.

   قرارُ صاحب المنصّة (٨ سبتمبر ٢٠٢٦): يملك المدرّبُ جدولَ شعبته **ضمن حدودٍ
   تضعها الإدارة**. وقبله كانت بوّابتُه تقول له «الإدارة تضيف الجدول»، وما
   يملكه أن يقترح تأجيلا يُرفع إلى طابور موافقات — طابورٌ بُني ليعوّض
   صلاحيّةً لم تُمنح.

   ونقلُ صلاحيّةٍ يُختبر بما **يمنعه** لا بما يسمح به. فالمفحوصُ هنا أربعةُ
   حدود، كلُّها تُرَدّ:

     ① نافذةٌ لم تُفتح            → لا جدولةَ أصلا
     ② موعدٌ خارجَ المدى          → يُرَدّ ولو كانت مفتوحة
     ③ سقفُ اللقاءات مبلوغ        → يُرَدّ ولو كان داخلَ المدى
     ④ من ليس مدرّبَ الشعبة       → يُرَدّ ولو كان مدرّبا مؤهَّلا

   والخامسُ أنّ المسموحَ يقع فعلا — وإلّا كان الحارسُ يحرس بابا مسدودا. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService, RUBRIC_CRITERIA } from '../../services/trainer-review.service'
import { CohortService } from '../../services/cohort.service'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let cohorts: CohortService
let managerId = ''
let trainerUserId = ''
let trainerProfileId = ''
let strangerUserId = ''
const COURSE = 'C-BIZ-101'

const scores = () => Object.fromEntries(RUBRIC_CRITERIA.map((k) => [k, 5])) as Record<string, number>

async function makeActiveTrainer(email: string, name: string) {
  const apps = new (await import('../../services/trainer-application.service')).TrainerApplicationService(prisma)
  const p1 = await apps.submitPhase1({
    fullName: name, email, specialties: ['إدارة المشاريع والعمليات'],
    domainYears: '8-12', trainingYears: 'formal_teaching',
    trainingLanguages: ['العربية'], deliveryMode: 'remote',
    motivation: 'أريد الانضمام إلى وجيز لأنني درّبت فرقا حقيقية في بيئات عمل عربية، وأعرف الفرق بين من يعرف المادة ومن يستطيع تعليمها. سأقدّم للمتعلمين مهمة تطبيقية من واقع عملهم في كل وحدة، وأراجع مخرجاتهم بنفسي وأكتب لكل واحد ما ينقصه تحديدا لا تقييما عاما.',
    privacyConsent: true, password: 'Trainer#12345',
  })
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
  await review.decide(app!.id, managerId, 'activate')
  const profile = await prisma.trainerProfile.findUnique({ where: { applicationId: app!.id } })
  return { userId: profile!.userId!, profileId: profile!.id }
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  process.env.RESEND_BASE_URL = 'http://127.0.0.1:1'
  await prisma.integrationSetting.upsert({
    where: { provider: 'email' },
    update: { enabled: true, config: { apiKey: 're_test_key', fromName: 'أكاديمية وجيز', fromEmail: 'no-reply@test.local' } },
    create: { provider: 'email', enabled: true, config: { apiKey: 're_test_key', fromName: 'أكاديمية وجيز', fromEmail: 'no-reply@test.local' } },
  })
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  cohorts = new CohortService(prisma)
  const m = await auth.register('window-manager@test.local', 'Manager#12345', 'مدير أكاديمي')
  managerId = m.userId
  await auth.setRoles(managerId, ['academic_manager'])

  const t = await makeActiveTrainer('window-trainer@test.local', 'مدرّبُ النافذة')
  trainerUserId = t.userId
  trainerProfileId = t.profileId
  await review.qualifyForCourse(trainerProfileId, COURSE, managerId)

  /* غريبٌ لا شعبةَ له — يُفحص به الحدُّ الرابع */
  const s = await auth.register('window-stranger@test.local', 'Stranger#12345', 'مدرّبٌ آخر')
  strangerUserId = s.userId
}, 240_000)

describe('نافذةُ جدولةِ المدرّب', () => {
  let cohortId = ''
  /* المدى: أسبوعان من أوّل ديسمبر. وخارجُه يقع قبله وبعده. */
  const from = new Date('2026-12-01T00:00:00Z')
  const to = new Date('2026-12-14T23:59:59Z')
  const inside = new Date('2026-12-03T18:00:00Z')

  it('يُهيَّأ: شعبةٌ لها مدرّبُها', async () => {
    const c = await cohorts.create(managerId, { courseId: COURSE, title: 'شعبةُ نافذةِ الجدولة' })
    cohortId = c.id
    await cohorts.assignTrainer(cohortId, trainerProfileId, managerId, 'lead')
    const w = await cohorts.scheduleWindowFor(trainerUserId, cohortId)
    expect(w.mine, 'الإسنادُ لم يقع — ما بعده يخضرّ بلا معنى').toBe(true)
  })

  it('① نافذةٌ لم تُفتح — لا جدولةَ للمدرّب أصلا', async () => {
    const w = await cohorts.scheduleWindowFor(trainerUserId, cohortId)
    expect(w.open).toBe(false)
    await expect(cohorts.trainerAddSession(trainerUserId, cohortId, {
      title: 'لقاءٌ قبل فتح النافذة', startsAt: inside,
    })).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('ونصفُ نافذةٍ لا يفتح بابا — الثلاثةُ تُقرأ معا', async () => {
    /* مدًى بلا سقف: النافذةُ تبقى مغلقة، فلا تصير «مفتوحةً بلا حدّ» */
    await cohorts.setScheduleWindow(managerId, cohortId, { start: from, end: to, maxSessions: null })
    const w = await cohorts.scheduleWindowFor(trainerUserId, cohortId)
    expect(w.open).toBe(false)
    await expect(cohorts.trainerAddSession(trainerUserId, cohortId, {
      title: 'لقاءٌ بنصف نافذة', startsAt: inside,
    })).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('② تُفتح النافذة — فيقع ما بداخلها، ويُرَدّ ما خارجَ مداها', async () => {
    await cohorts.setScheduleWindow(managerId, cohortId, { start: from, end: to, maxSessions: 2 })
    const w = await cohorts.scheduleWindowFor(trainerUserId, cohortId)
    expect(w.open).toBe(true)
    expect(w.remaining).toBe(2)

    /* المسموحُ يقع فعلا — وإلّا كان الحارسُ يحرس بابا مسدودا */
    const s = await cohorts.trainerAddSession(trainerUserId, cohortId, {
      title: 'لقاءٌ داخلَ المدى', startsAt: inside, endsAt: new Date('2026-12-03T20:00:00Z'),
    })
    expect(s.cohortId).toBe(cohortId)

    /* قبل المدى وبعده — كلاهما يُرَدّ */
    await expect(cohorts.trainerAddSession(trainerUserId, cohortId, {
      title: 'لقاءٌ قبل المدى', startsAt: new Date('2026-11-20T18:00:00Z'),
    })).rejects.toMatchObject({ code: 'forbidden' })
    await expect(cohorts.trainerAddSession(trainerUserId, cohortId, {
      title: 'لقاءٌ بعد المدى', startsAt: new Date('2027-01-05T18:00:00Z'),
    })).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('③ السقفُ يُبلَغ فيُرَدّ ما بعده — ولو كان داخلَ المدى', async () => {
    /* السقفُ اثنان، وفي الشعبة واحد. فالثاني يقع والثالثُ يُرَدّ. */
    await cohorts.trainerAddSession(trainerUserId, cohortId, {
      title: 'اللقاءُ الثاني', startsAt: new Date('2026-12-10T18:00:00Z'),
    })
    const w = await cohorts.scheduleWindowFor(trainerUserId, cohortId)
    expect(w.remaining).toBe(0)

    await expect(cohorts.trainerAddSession(trainerUserId, cohortId, {
      title: 'اللقاءُ الثالثُ فوق السقف', startsAt: new Date('2026-12-12T18:00:00Z'),
    })).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('والنقلُ لا يُحسب على السقف — يبقى داخلَ المدى وحدَه', async () => {
    const one = await prisma.cohortSession.findFirst({
      where: { cohortId }, orderBy: { startsAt: 'asc' }, select: { id: true },
    })
    /* السقفُ مبلوغٌ، والنقلُ مع ذلك يقع: لأنّه لا يزيد العدد */
    const moved = await cohorts.trainerMoveSession(trainerUserId, one!.id, {
      startsAt: new Date('2026-12-05T18:00:00Z'),
    })
    expect(moved.startsAt.toISOString()).toBe('2026-12-05T18:00:00.000Z')

    /* أمّا خارجَ المدى فيُرَدّ ولو كان نقلا */
    await expect(cohorts.trainerMoveSession(trainerUserId, one!.id, {
      startsAt: new Date('2027-02-01T18:00:00Z'),
    })).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('④ من ليس مدرّبَ الشعبة يُرَدّ — والصلاحيّةُ وحدَها لا تكفي', async () => {
    await expect(cohorts.trainerAddSession(strangerUserId, cohortId, {
      title: 'لقاءٌ من غريب', startsAt: new Date('2026-12-08T18:00:00Z'),
    })).rejects.toMatchObject({ code: 'forbidden' })

    const one = await prisma.cohortSession.findFirst({ where: { cohortId }, select: { id: true } })
    await expect(cohorts.trainerMoveSession(strangerUserId, one!.id, {
      startsAt: new Date('2026-12-09T18:00:00Z'),
    })).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('والإغلاقُ يعيد الأمرَ إلى ما كان — بإفراغ الثلاثة', async () => {
    await cohorts.setScheduleWindow(managerId, cohortId, { start: null, end: null, maxSessions: null })
    const w = await cohorts.scheduleWindowFor(trainerUserId, cohortId)
    expect(w.open).toBe(false)
    await expect(cohorts.trainerAddSession(trainerUserId, cohortId, {
      title: 'لقاءٌ بعد الإغلاق', startsAt: new Date('2026-12-06T18:00:00Z'),
    })).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('ونهايةٌ قبل بدايةٍ تُرَدّ عند الإدارة نفسِها', async () => {
    await expect(cohorts.setScheduleWindow(managerId, cohortId, {
      start: to, end: from, maxSessions: 4,
    })).rejects.toMatchObject({ code: 'bad_request' })
    await expect(cohorts.setScheduleWindow(managerId, cohortId, {
      start: from, end: to, maxSessions: 0,
    })).rejects.toMatchObject({ code: 'bad_request' })
  })
})
