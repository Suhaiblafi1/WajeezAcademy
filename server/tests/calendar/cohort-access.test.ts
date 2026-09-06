/* دعوةُ جلسةِ الشعبة — لمن؟

   كانت الصلاحيةُ رايةً واحدة: `cohort.manage || trainer.cohort.operate`،
   ومن حملها تخطّى الفحصَ كلَّه. فالمديرُ يصل إلى كلّ شعبة وهذا صحيح،
   والمدرّبُ كان يصل إلى **كلّ شعبة** أيضا وهذا ليس صحيحا — بقيّةُ مسالك
   المدرّب تمرّ بـ`assertCohortTrainer`، وهذا المسلكُ وحدَه لم يمرّ.

   ولم يظهر العيبُ قبل اليوم لأنّ أحدا لم يستدعِ المسلكَ بجلسة مدرّب:
   الزرُّ كان في بوّابة المتعلّم وحدها. وأُضيف إلى لوحة المدرّب — فصار
   الفحصُ لازما، وصار له اختبار. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CohortService } from '../../services/cohort.service'
import { TrainerReviewService, RUBRIC_CRITERIA } from '../../services/trainer-review.service'
import { CalendarService } from '../../services/calendar/calendar.service'

let prisma: PrismaClient
let auth: AuthService
let cohorts: CohortService
let review: TrainerReviewService
let calendar: CalendarService

let managerId = ''
let trainerUserId = ''
let trainerProfileId = ''
let mineSessionId = ''
let othersSessionId = ''

const COURSE = 'C-BIZ-101'
const scores = () => Object.fromEntries(RUBRIC_CRITERIA.map((k) => [k, 5])) as Record<string, number>

/** مدرّبٌ نشطٌ عبر الدورة الرسمية نفسِها — لا صفٌّ يُزرع بيدٍ */
async function makeActiveTrainer(email: string, name: string) {
  const { TrainerApplicationService } = await import('../../services/trainer-application.service')
  const apps = new TrainerApplicationService(prisma)
  const p1 = await apps.submitPhase1({
    fullName: name, email, specialties: ['إدارة المشاريع والعمليات'],
    domainYears: '8-12', trainingYears: 'formal_teaching',
    trainingLanguages: ['العربية'], deliveryMode: 'remote',
    motivation: 'أريد الانضمام إلى وجيز لأنني درّبت فرقا حقيقية في بيئات عمل عربية، وأعرف الفرق بين من يعرف المادة ومن يستطيع تعليمها. سأقدّم للمتعلمين مهمة تطبيقية من واقع عملهم في كل وحدة، وأراجع مخرجاتهم بنفسي وأكتب لكل واحد ما ينقصه تحديدا لا تقييما عاما.',
    privacyConsent: true,
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
  await review.decide(app!.id, managerId, 'activate')
  const profile = await prisma.trainerProfile.findUnique({ where: { applicationId: app!.id } })
  return { userId: profile!.userId!, profileId: profile!.id }
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  /* قناة بريدٍ مفعّلةٌ بمضيفٍ لا يستجيب — فتبقى بوّابةُ التحقّق قائمةً كما
     صُمّمت (قناةٌ غيرُ مفعّلة تتحقّق تلقائيا فيسقط مسار `verifyEmail`). */
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
  cohorts = new CohortService(prisma)
  review = new TrainerReviewService(prisma)
  calendar = new CalendarService(prisma)

  const m = await auth.register('cal-manager@test.local', 'Manager#12345', 'مدير أكاديمي')
  managerId = m.userId
  await auth.setRoles(managerId, ['academic_manager'])

  const t = await makeActiveTrainer('cal-trainer@test.local', 'مدرّب التقويم')
  trainerUserId = t.userId
  trainerProfileId = t.profileId
  await review.qualifyForCourse(trainerProfileId, COURSE, managerId)

  const mine = await cohorts.create(managerId, { courseId: COURSE, title: 'شعبتي' })
  await cohorts.assignTrainer(mine.id, trainerProfileId, managerId, 'lead')
  const s1 = await cohorts.addSession(managerId, mine.id, {
    title: 'جلسة شعبتي',
    startsAt: new Date('2026-10-06T18:00:00Z'),
    endsAt: new Date('2026-10-06T20:00:00Z'),
  })
  mineSessionId = s1.id

  const others = await cohorts.create(managerId, { courseId: COURSE, title: 'شعبةُ غيري' })
  const s2 = await cohorts.addSession(managerId, others.id, {
    title: 'جلسة شعبةٍ أخرى',
    startsAt: new Date('2026-10-07T18:00:00Z'),
    endsAt: new Date('2026-10-07T20:00:00Z'),
  })
  othersSessionId = s2.id
}, 240_000)

describe('صلاحيةُ دعوة جلسة الشعبة', () => {
  it('١) مديرُ الشعب يصل إلى أيّ جلسة', async () => {
    const r = await calendar.cohortSessionIcs(othersSessionId, managerId, {
      manageAll: true, trainerOperate: false,
    })
    expect(r.content).toContain('BEGIN:VEVENT')
    expect(r.filename).toBe(`wajeez-session-${othersSessionId}.ics`)
  })

  it('٢) المدرّبُ يصل إلى جلسة شعبته المسنَدة', async () => {
    const r = await calendar.cohortSessionIcs(mineSessionId, trainerUserId, {
      manageAll: false, trainerOperate: true,
    })
    expect(r.content).toContain('BEGIN:VEVENT')
    expect(r.content).toContain('جلسة شعبتي')
  })

  it('٣) المدرّبُ لا يصل إلى جلسةِ شعبةٍ ليست له — وهو العيبُ الذي أُغلق', async () => {
    await expect(
      calendar.cohortSessionIcs(othersSessionId, trainerUserId, {
        manageAll: false, trainerOperate: true,
      }),
    ).rejects.toMatchObject({ code: 'not_enrolled' })
  })

  it('٤) من لا صلاحيةَ له ولا تسجيلَ يُردّ', async () => {
    const o = await auth.register('cal-outsider@test.local', 'Outsider#12345', 'زائر')
    await expect(
      calendar.cohortSessionIcs(mineSessionId, o.userId, { manageAll: false, trainerOperate: false }),
    ).rejects.toMatchObject({ code: 'not_enrolled' })
  })

  it('٥) جلسةٌ غيرُ موجودة تُردّ بـ404 لا بتسريبِ وجودٍ من عدمه', async () => {
    await expect(
      calendar.cohortSessionIcs('00000000-0000-4000-8000-000000000000', managerId, {
        manageAll: true, trainerOperate: false,
      }),
    ).rejects.toMatchObject({ code: 'not_found' })
  })
})
