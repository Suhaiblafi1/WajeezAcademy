/* من يُنقل أو يترك شعبةً وتقويمُه (٢٧ أكتوبر ٢٠٢٦).

   خُيّر صاحبُ المنصّة في علّتَين فاختار إصلاحهما معا:

   ① نقلُ من رحل مدرّبُه إلى نظير (`TrainerDepartureService.moveLearner`) كان ينقل المقعدَ بسطرٍ في القاعدة ولا
      شيءَ بعده: تبقى لقاءاتُ المغادَرة في تقويمه، ولا تصله لقاءاتُ الوجهة التي اعتُمدت قبل نقله. فصار كتبديل
      الشعبة: تُرفع تلك، ويصله جدولُ هذه، ثمّ يُدعى مع أهلها. ومن أُسقط تسجيلُه قبل نقله لا يُرفع منه شيءٌ ثانيةً.
   ② ومن يترك شعبةً أُلغيت — يُسقَط تسجيلُه أو يُنقل — كان يصله رفعُ كلِّ لقاءٍ منها ثانيةً: رُفع من تقويمه يومَ
      أُلغيت. فلا يُرفع ما وقع ورُفع.
   ③ وما رُفع ثمّ عاد — أُجّلت الشعبةُ ثمّ اعتُمدت خطّتُها — لم يعد واقعا: من التحق بعد عودته يُرفع من تقويمه.

   ولا شبكة: لا مفاتيحَ Zoom ولا بريدَ هنا. */

import { beforeAll, describe, expect as vexpect, it } from 'vitest'
import { plainExpect } from '../helpers/plain-expect'
const expect = plainExpect(vexpect)
import type { Prisma, PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { CohortService } from '../../services/cohort.service'
import { EnrollmentService } from '../../services/enrollment.service'
import { TrainerDepartureService } from '../../services/trainer-departure.service'
import { COHORT_POSTPONED_AR, SessionInviteService } from '../../services/session-invite.service'
import { sessionInviteUid } from '../../services/calendar/session-invite'

let prisma: PrismaClient
let cohorts: CohortService
let enrollments: EnrollmentService
let invites: SessionInviteService
let adminId = ''
let courseId = ''
const STAMP = Date.now()
const H = 3_600_000
const DAY = 24 * H

/** الأسطرُ تُطوى عند ٧٥ ثمانيّة — فتُفرَد قبل أن يُطابَق سطرٌ طويل */
const unfold = (ics: string | null) => (ics ?? '').replace(/\r\n /g, '')
/** معرّفاتُ الأحداث سطرا كاملا — لا ورودُ حرفٍ في سطرٍ أطول */
const uids = (ics: string | null) => [...unfold(ics).matchAll(/^UID:(.*?)\r?$/gm)].map((m) => m[1])
const mails = (where: Prisma.OutboxMailWhereInput) => prisma.outboxMail.findMany({ where, orderBy: { createdAt: 'asc' } })
/** ما رُفع من تقويمه — معرّفُ كلِّ حدثٍ في رسالته */
const removedFrom = (email: string) =>
  mails({ to: email, purpose: 'session.invite.cancel' }).then((rows) => rows.map((r) => uids(r.icsContent)[0]).sort())
const uidsOf = (...sessions: { id: string }[]) => sessions.map((s) => sessionInviteUid(s.id)).sort()

let seq = 0
/** مدرّبٌ بحسابه وطلبه النشط */
async function trainer(key: string) {
  seq += 1
  const email = `tmov-${key}-${seq}-${STAMP}@wajeez.test`
  const u = await prisma.user.create({ data: { email, displayName: `مدرّب ${key}`, passwordHash: 'x' } })
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-TMOV-${seq}-${STAMP}`, fullName: `مدرّب ${key}`, email, status: 'active' },
  })
  return (await prisma.trainerProfile.create({ data: { userId: u.id, applicationId: application.id } })).id
}

/** شعبةٌ لم تبدأ بمدرّبها، وجدولُه وصله */
async function cohortOf(profileId: string, title: string) {
  const c = await prisma.cohort.create({
    data: {
      courseId, title, status: 'open', capacity: 20, price: 100, currency: 'USD', timezone: 'Asia/Amman',
      scheduleWindowStart: new Date(Date.now() - 2 * DAY), scheduleWindowEnd: new Date(Date.now() + 90 * DAY), maxSessions: 60,
    },
  })
  await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead', calendarSentAt: new Date() } })
  return { id: c.id, title }
}

/** متعلّمٌ بمقعدٍ قائمٍ في الشعبة */
async function learner(cohortId: string, key: string) {
  seq += 1
  const email = `tmov-l-${key}-${seq}-${STAMP}@wajeez.test`
  const u = await prisma.user.create({ data: { email, displayName: `متعلّم ${key}`, passwordHash: 'x' } })
  const e = await prisma.enrollment.create({ data: { userId: u.id, cohortId, status: 'enrolled' } })
  return { email, userId: u.id, enrollmentId: e.id }
}

let slot = 0
/** لقاءٌ معتمَدٌ دُعي إليه — كلٌّ في ساعته */
async function announced(cohortId: string, hours?: number) {
  slot += 1
  const startsAt = new Date(Date.now() + (hours ?? 60 + slot * 7) * H)
  const s = await prisma.cohortSession.create({
    data: {
      cohortId, title: `لقاء ${slot}`, startsAt, endsAt: new Date(startsAt.getTime() + 2 * H),
      approvalState: 'approved', wantsMeeting: false,
    },
  })
  await invites.announce(s.id, 'new')
  return s
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  cohorts = new CohortService(prisma)
  enrollments = new EnrollmentService(prisma)
  invites = new SessionInviteService(prisma)
  adminId = (await prisma.user.create({ data: { email: `tmov-admin-${STAMP}@wajeez.test`, displayName: 'الإدارة', passwordHash: 'x' } })).id
  await prisma.userRole.create({ data: { userId: adminId, roleId: 'academic_manager' } })
  courseId = (await prisma.course.findFirstOrThrow({ select: { id: true } })).id
}, 240_000)

describe('① من رحل مدرّبُه فنُقل إلى نظير', () => {
  it('⚠️ تُرفع لقاءاتُ المغادَرة من تقويمه، ويصله جدولُ الوجهة — ثمّ يُدعى مع أهلها لا مع أولئك', async () => {
    const gone = await trainer('departed')
    const other = await trainer('peer')
    const from = await cohortOf(gone, 'شعبة الراحل')
    const to = await cohortOf(other, 'الشعبة النظيرة')
    const l = await learner(from.id, 'moved')
    const f1 = await announced(from.id)
    const f2 = await announced(from.id)
    const t1 = await announced(to.id)

    const dep = new TrainerDepartureService(prisma)
    const d = await dep.open(adminId, gone, 'أنهى تعاقده معنا')
    const c = await prisma.departureCase.findFirstOrThrow({ where: { departureId: d.id, enrollmentId: l.enrollmentId } })
    await dep.moveLearner(adminId, c.id, to.id, 'لا بديل مؤهل')

    expect(await removedFrom(l.email), 'بقيت لقاءاتُ المغادَرة في تقويمه').toEqual(uidsOf(f1, f2))
    for (const r of await mails({ to: l.email, purpose: 'session.invite.cancel' })) {
      expect(r.text).toContain(`انتقل مقعدك إلى «${to.title}»`)
    }
    const schedules = await mails({ to: l.email, purpose: 'session.invite.schedule' })
    expect(schedules, 'لم يصله جدولُ الوجهة').toHaveLength(1)
    expect(uids(schedules[0]!.icsContent)).toEqual([sessionInviteUid(t1.id)])

    await invites.announce(t1.id, 'update')
    await invites.announce(f1.id, 'update')
    expect((await mails({ batchId: t1.id, purpose: 'session.invite.update' })).map((m) => m.to)).toContain(l.email)
    expect((await mails({ batchId: f1.id, purpose: 'session.invite.update' })).map((m) => m.to)).not.toContain(l.email)
  })

  it('⚠️ ومن أُسقط تسجيلُه قبل نقله رُفعت لقاءاتُها يومئذ — فلا تُرفع ثانيةً، ولا يصله جدول', async () => {
    const gone = await trainer('departed-dropped')
    const other = await trainer('peer-dropped')
    const from = await cohortOf(gone, 'شعبة راحل آخر')
    const to = await cohortOf(other, 'نظيرة أخرى')
    const l = await learner(from.id, 'dropped-then-moved')
    const f = await announced(from.id)
    await announced(to.id)

    const dep = new TrainerDepartureService(prisma)
    const d = await dep.open(adminId, gone, 'أنهى تعاقده معنا')
    const c = await prisma.departureCase.findFirstOrThrow({ where: { departureId: d.id, enrollmentId: l.enrollmentId } })
    await enrollments.drop(l.enrollmentId, adminId, 'رد ما دفع')
    expect(await removedFrom(l.email)).toEqual(uidsOf(f))

    await dep.moveLearner(adminId, c.id, to.id, 'لا بديل مؤهل')
    expect(await removedFrom(l.email), 'رُفع من تقويمه مرّتين').toEqual(uidsOf(f))
    expect(await mails({ to: l.email, purpose: 'session.invite.schedule' }), 'وصل من لا مقعد له جدول').toHaveLength(0)
  })
})

describe('② ومن يترك شعبةً أُلغيت', () => {
  it('⚠️ رُفعت لقاءاتُها من تقويمه يومَ أُلغيت — فإسقاطُ تسجيله لا يرفعها ثانيةً', async () => {
    const t = await trainer('cancelled')
    const c = await cohortOf(t, 'شعبة ألغيت')
    const l = await learner(c.id, 'dropped')
    const s = await announced(c.id)
    await cohorts.transition(c.id, 'cancelled', adminId, 'اختبار', { reasonAr: 'اختبار' })
    expect(await removedFrom(l.email)).toEqual(uidsOf(s))

    await enrollments.drop(l.enrollmentId, adminId, 'رد ما دفع')
    expect(await removedFrom(l.email), 'رُفع من تقويمه مرّتين').toEqual(uidsOf(s))
  })
})

describe('③ وما أُجّل ثمّ عاد', () => {
  it('⚠️ لم يعد واقعا — فمن التحق بعد عودته يُرفع من تقويمه حين يتركها', async () => {
    const t = await trainer('postponed')
    const c = await cohortOf(t, 'شعبة أجلت ثم عادت')
    const s = await announced(c.id, 5 * 24)
    const plan = await prisma.cohortDeliveryPlan.create({
      data: { cohortId: c.id, trainerId: t, content: {}, status: 'changes_requested', postponedTo: new Date(Date.now() + 10 * DAY) },
    })
    expect(await invites.withdrawCohort(c.id, COHORT_POSTPONED_AR)).toBe(1)
    /* واعتُمدت خطّتُها، فلم يعد ما قبل موسمها الجديد واقعا (`voidBefore`) */
    await prisma.cohortDeliveryPlan.update({ where: { id: plan.id }, data: { status: 'approved' } })

    const late = await learner(c.id, 'joined-after')
    expect(await invites.welcome(late.enrollmentId)).toBe(1)
    const [schedule] = await mails({ to: late.email, purpose: 'session.invite.schedule' })
    expect(uids(schedule!.icsContent), 'لم يصله اللقاءُ وقد عاد').toEqual([sessionInviteUid(s.id)])

    await enrollments.drop(late.enrollmentId, adminId, 'رد ما دفع')
    expect(await removedFrom(late.email), 'بقي في تقويمه لقاءُ شعبةٍ تركها').toEqual(uidsOf(s))
  })
})
