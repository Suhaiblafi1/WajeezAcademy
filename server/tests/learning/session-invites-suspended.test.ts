/* الموقوفُ وتقويمُه (٢٧ أكتوبر ٢٠٢٦).

   كان الإيقافُ لا يمسّ التقويم: تبقى دعواتُ الموقوف فيه، ولا يصله بعدها تحديثٌ ولا رفع (`trainersOf` لا تعدّه) —
   فما نُقل أو أُلغي يبقى في تقويمه على غير حقيقته، ومنه شعبُه التي تُلغى في نافذة الإيقاف نفسِها. وحين يعود لا يعود
   جدولُه: `calendarSentAt` مكتوبٌ فلا يرسله العامل. فخُيّر صاحبُ المنصّة فاختار: تُرفع لقاءاتُه حين يُوقَف، ويصله جدولُ
   ما بقي من شعبه حين يعود.

   ① الإيقافُ يرفع لقاءاتِ شعبه كلِّها من تقويمه وحدَه، بسببه — ولا يمسّ تقويمَ غيره.
   ② وشعبتُه التي تُلغى في نافذة الإيقاف يصله رفعُها مرّةً — وما أُلغي قبل إيقافه لا يُرفع ثانيةً.
   ③ ورفعُ الإيقاف يعيد إليه بالعامل جدولَ ما بقي من شعبه — بما اعتُمد في إيقافه، وبلا شعبته الملغاة.
   ④ والبديلُ مكانَ الموقوف لا يرفع من تقويمه ما رُفع حين أُوقف.
   ⑤ ومن أُوقف قبل هذا اليوم: العاملُ يرفع ما بقي في تقويمه، ومن عاد قبل أن يلحقه يصله جدولُه.

   ولا شبكة: لا مفاتيحَ Zoom ولا بريدَ هنا. */

import { beforeAll, describe, expect as vexpect, it } from 'vitest'
import { plainExpect } from '../helpers/plain-expect'
const expect = plainExpect(vexpect)
import type { Prisma, PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { CohortService } from '../../services/cohort.service'
import { TrainerDepartureService } from '../../services/trainer-departure.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import {
  COHORT_CANCELLED_AR, SESSION_GUESTS, SessionInviteService, TRAINER_SUSPENDED_AR,
} from '../../services/session-invite.service'
import { sessionInviteUid } from '../../services/calendar/session-invite'
import { runTrainerCalendars } from '../../worker/jobs'

let prisma: PrismaClient
let cohorts: CohortService
let invites: SessionInviteService
let review: TrainerReviewService
let adminId = ''
let courseId = ''
const STAMP = Date.now()
const H = 3_600_000
const GUESTS = SESSION_GUESTS.map((g) => g.email)

/** الأسطرُ تُطوى عند ٧٥ ثمانيّة — فتُفرَد قبل أن يُطابَق سطرٌ طويل */
const unfold = (ics: string | null) => (ics ?? '').replace(/\r\n /g, '')
/** معرّفاتُ الأحداث سطرا كاملا — لا ورودُ حرفٍ في سطرٍ أطول */
const uids = (ics: string | null) => [...unfold(ics).matchAll(/^UID:(.*?)\r?$/gm)].map((m) => m[1])
const mails = (where: Prisma.OutboxMailWhereInput) => prisma.outboxMail.findMany({ where, orderBy: { createdAt: 'asc' } })
const to = (sessionId: string, purpose: string) =>
  mails({ batchId: sessionId, purpose }).then((rows) => rows.map((r) => r.to).sort())
/** ما رُفع من تقويمه — معرّفُ كلِّ حدثٍ في رسالته */
const removedFrom = (email: string) =>
  mails({ to: email, purpose: 'session.invite.cancel' }).then((rows) => rows.map((r) => uids(r.icsContent)[0]).sort())
const uidsOf = (...sessions: { id: string }[]) => sessions.map((s) => sessionInviteUid(s.id)).sort()

/** الدورةُ تأخذ مئتي إسنادٍ في كلّ مرّة — فتُعاد حتّى لا يبقى شيء */
const sweepAll = async () => {
  for (let i = 0; i < 20; i += 1) if ((await runTrainerCalendars(prisma)).done === 0) return
}

let seq = 0
/** مدرّبٌ كما تُنشئه الإدارة — بحسابه وطلبه النشط — مؤهَّلٌ لدورة الشعب هنا */
async function trainer(key: string) {
  seq += 1
  const email = `tsus-${key}-${seq}-${STAMP}@wajeez.test`
  const t = await review.createTrainerDirectly(adminId, { fullName: `مدرّب ${key}`, email })
  await prisma.trainerCourseQualification.create({ data: { profileId: t.profileId, courseId, status: 'qualified' } })
  return { profileId: t.profileId, applicationId: t.applicationId, email }
}

/** شعبةٌ لم تبدأ بمتعلّمَين ومدرّبها — وإسنادُه وصله جدولُها (`calendarSentAt`) */
async function cohortOf(lead: { profileId: string }, title: string) {
  seq += 1
  const c = await prisma.cohort.create({
    data: {
      courseId, title, status: 'open', capacity: 20, price: 100, currency: 'USD', timezone: 'Asia/Amman',
      scheduleWindowStart: new Date(Date.now() - 2 * 24 * H), scheduleWindowEnd: new Date(Date.now() + 90 * 24 * H), maxSessions: 60,
    },
  })
  await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId: lead.profileId, role: 'lead', calendarSentAt: new Date() } })
  const learners: string[] = []
  for (const k of ['a', 'b']) {
    const email = `tsus-l${seq}${k}-${STAMP}@wajeez.test`
    const u = await prisma.user.create({ data: { email, displayName: `متعلّم ${k}`, passwordHash: 'x' } })
    await prisma.enrollment.create({ data: { userId: u.id, cohortId: c.id, status: 'enrolled' } })
    learners.push(email)
  }
  return { id: c.id, learners }
}

let slot = 0
/** لقاءٌ معتمَدٌ دُعي إليه — كلٌّ في ساعته، فلا يتعارض مدرّبٌ مع نفسه بين الشعب */
async function announced(cohortId: string) {
  slot += 1
  const startsAt = new Date(Date.now() + (60 + slot * 7) * H)
  const s = await prisma.cohortSession.create({
    data: {
      cohortId, title: `لقاء ${slot}`, startsAt, endsAt: new Date(startsAt.getTime() + 2 * H),
      approvalState: 'approved', wantsMeeting: false,
    },
  })
  await invites.announce(s.id, 'new')
  return s
}

/** ما كان يفعله الإيقافُ قبل هذا اليوم: يُكتب على الملفّ وطلبه ولا يمسّ التقويم */
async function suspendedBeforeToday(t: { profileId: string; applicationId: string }) {
  await prisma.trainerProfile.update({ where: { id: t.profileId }, data: { suspendedAt: new Date() } })
  await prisma.trainerApplication.update({ where: { id: t.applicationId }, data: { status: 'suspended' } })
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  cohorts = new CohortService(prisma)
  invites = new SessionInviteService(prisma)
  review = new TrainerReviewService(prisma)
  adminId = (await prisma.user.create({ data: { email: `tsus-admin-${STAMP}@wajeez.test`, displayName: 'الإدارة', passwordHash: 'x' } })).id
  await prisma.userRole.create({ data: { userId: adminId, roleId: 'academic_manager' } })
  courseId = (await prisma.course.findFirstOrThrow({ select: { id: true } })).id
}, 240_000)

describe('① الإيقافُ يرفع لقاءاتِ شعبه من تقويمه وحدَه', () => {
  it('⚠️ كلُّ لقاءٍ آتٍ في كلّ شعبةٍ له — قائدا أو مساعدا — برسالة رفعٍ بسببه، ولا يمسّ تقويمَ غيره', async () => {
    const t = await trainer('suspended')
    const peer = await trainer('peer')
    const a = await cohortOf(t, 'شعبته')
    const b = await cohortOf(peer, 'شعبة يساعد فيها')
    await prisma.cohortTrainer.create({ data: { cohortId: b.id, profileId: t.profileId, role: 'assistant', calendarSentAt: new Date() } })
    const s1 = await announced(a.id)
    const s2 = await announced(a.id)
    const s3 = await announced(b.id)

    await review.suspendTrainer(t.profileId, adminId, 'إيقاف اختباري')

    expect(await removedFrom(t.email)).toEqual(uidsOf(s1, s2, s3))
    for (const r of await mails({ to: t.email, purpose: 'session.invite.cancel' })) {
      expect(r.icsMethod).toBe('CANCEL')
      expect(r.text).toContain(TRAINER_SUSPENDED_AR)
      expect(unfold(r.icsContent), 'رفعُ المدرّب يدلّه على صفحة المتعلّم').not.toContain('/student/learning')
    }
    const others = [...a.learners, ...b.learners, peer.email, ...GUESTS]
    expect(
      await mails({ to: { in: others }, batchId: { in: [s1.id, s2.id, s3.id] }, purpose: 'session.invite.cancel' }),
      'رُفع من تقويم غيره',
    ).toHaveLength(0)

    const links = await prisma.cohortTrainer.findMany({ where: { profileId: t.profileId } })
    expect(links.map((l) => l.calendarSentAt), 'بقي أنّ جدولَها في تقويمه — فلا يرسله العاملُ إن عاد').toEqual([null, null])
  })
})

describe('② وشعبُه الملغاة', () => {
  it('⚠️ ما يُلغى في نافذة الإيقاف يصله رفعُه مرّةً — مع الجميع', async () => {
    const t = await trainer('cancel-at-suspend')
    const c = await cohortOf(t, 'تلغى مع إيقافه')
    const s1 = await announced(c.id)
    const s2 = await announced(c.id)

    expect((await review.suspendTrainer(t.profileId, adminId, 'إيقاف اختباري', { cancelCohortIds: [c.id] })).cancelled).toBe(1)

    const everyone = [...c.learners, t.email, ...GUESTS].sort()
    for (const s of [s1, s2]) {
      expect(await to(s.id, 'session.invite.cancel'), 'رفعُ اللقاء لم يصل أحدا — أو وصله مرّتين').toEqual(everyone)
    }
    const [learner] = await mails({ to: c.learners[0]!, batchId: s1.id, purpose: 'session.invite.cancel' })
    expect(learner!.text).toContain(COHORT_CANCELLED_AR)
  })

  it('⚠️ وما أُلغي قبل إيقافه وصله رفعُه يومئذ — فلا يُرفع ثانيةً', async () => {
    const t = await trainer('cancelled-before')
    const c = await cohortOf(t, 'ألغيت قبل إيقافه')
    const s = await announced(c.id)
    await cohorts.transition(c.id, 'cancelled', adminId, 'اختبار', { reasonAr: 'اختبار' })
    expect(await removedFrom(t.email)).toEqual(uidsOf(s))

    await review.suspendTrainer(t.profileId, adminId, 'إيقاف اختباري')
    expect(await removedFrom(t.email), 'رُفع من تقويمه مرّتين').toEqual(uidsOf(s))
  })
})

describe('③ ورفعُ الإيقاف يعيد إليه جدولَ ما بقي من شعبه', () => {
  it('⚠️ بالعامل: جدولُ شعبته بما اعتُمد في إيقافه — ولا شيءَ عن شعبته الملغاة، ولا يتكرّر', async () => {
    const t = await trainer('reinstated')
    const kept = await cohortOf(t, 'تبقى له')
    const gone = await cohortOf(t, 'تلغى مع إيقافه')
    const s1 = await announced(kept.id)
    await announced(gone.id)
    await review.suspendTrainer(t.profileId, adminId, 'إيقاف اختباري', { cancelCohortIds: [gone.id] })

    /* ويُعتمَد في إيقافه لقاءٌ لا يُدعى إليه — والعاملُ لا يرسل للموقوف جدولا */
    const s2 = await announced(kept.id)
    expect(await to(s2.id, 'session.invite.new')).not.toContain(t.email)
    await sweepAll()
    expect(await mails({ to: t.email, purpose: 'session.invite.schedule' }), 'وصل الموقوفَ جدول').toHaveLength(0)

    await review.decide(t.applicationId, adminId, 'reinstate', 'انتهى سبب الإيقاف')
    await sweepAll()
    const schedules = await mails({ to: t.email, purpose: 'session.invite.schedule' })
    expect(schedules, 'جدولٌ لكلّ شعبةٍ بقي له فيها لقاء — والملغاةُ لا').toHaveLength(1)
    expect(schedules[0]!.icsMethod).toBe('PUBLISH')
    expect(uids(schedules[0]!.icsContent)).toEqual([sessionInviteUid(s1.id), sessionInviteUid(s2.id)])

    await sweepAll()
    expect(await mails({ to: t.email, purpose: 'session.invite.schedule' }), 'أُرسل جدولُه مرّتين').toHaveLength(1)
  })
})

describe('④ والبديلُ مكانَ الموقوف', () => {
  it('⚠️ لا يرفع من تقويم الموقوف ما رُفع حين أُوقف — ويصل البديلَ جدولُها', async () => {
    const off = await trainer('suspended-departed')
    const next = await trainer('substitute')
    const c = await cohortOf(off, 'شعبة الموقوف')
    const s = await announced(c.id)
    await review.suspendTrainer(off.profileId, adminId, 'إيقاف اختباري')
    expect(await removedFrom(off.email)).toEqual(uidsOf(s))

    const departure = await prisma.trainerDeparture.create({
      data: { profileId: off.profileId, reasonAr: 'اختبار', openedBy: adminId },
    })
    await new TrainerDepartureService(prisma).substitute(adminId, departure.id, c.id, next.profileId)

    expect(await removedFrom(off.email), 'رُفع من تقويمه مرّتين').toEqual(uidsOf(s))
    const schedules = await mails({ to: next.email, purpose: 'session.invite.schedule' })
    expect(schedules, 'لم يصل البديلَ جدولُها').toHaveLength(1)
    expect(uids(schedules[0]!.icsContent)).toEqual([sessionInviteUid(s.id)])
  })
})

describe('⑤ ومن أُوقف قبل هذا اليوم', () => {
  it('⚠️ العاملُ يرفع ما بقي في تقويمه مرّةً — ومنه ما أُلغي في إيقافه فلم يصله رفعُه', async () => {
    const t = await trainer('suspended-before-fix')
    const c = await cohortOf(t, 'شعبة قبل الإصلاح')
    const d = await cohortOf(t, 'ألغيت في إيقافه')
    const s1 = await announced(c.id)
    const s2 = await announced(d.id)
    await suspendedBeforeToday(t)
    await cohorts.transition(d.id, 'cancelled', adminId, 'اختبار', { reasonAr: 'اختبار' })
    expect(await to(s2.id, 'session.invite.cancel'), 'وصل الموقوفَ رفعٌ مع الجميع').not.toContain(t.email)

    await sweepAll()
    expect(await removedFrom(t.email)).toEqual(uidsOf(s1, s2))
    await sweepAll()
    expect(await removedFrom(t.email), 'رُفع من تقويمه مرّتين').toEqual(uidsOf(s1, s2))
  })

  it('⚠️ ومن عاد قبل أن يلحقه العاملُ يصله جدولُ ما بقي من شعبه', async () => {
    const t = await trainer('reinstated-before-sweep')
    const c = await cohortOf(t, 'شعبة العائد')
    const s = await announced(c.id)
    await suspendedBeforeToday(t)

    await review.decide(t.applicationId, adminId, 'reinstate', 'انتهى سبب الإيقاف')
    await sweepAll()
    const schedules = await mails({ to: t.email, purpose: 'session.invite.schedule' })
    expect(schedules, 'لم يصله جدولُ شعبته — بقي تقويمُه على ما كان يومَ أُوقف').toHaveLength(1)
    expect(uids(schedules[0]!.icsContent)).toEqual([sessionInviteUid(s.id)])
  })
})
