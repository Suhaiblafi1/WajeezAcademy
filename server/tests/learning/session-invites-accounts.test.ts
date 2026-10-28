/* الحسابُ المغلقُ وتقويمُه (٢٨ أكتوبر ٢٠٢٦).

   كان إيقافُ الحساب من شاشة المستخدمين وأرشفتُه يغلقان الدخولَ وحدَه: تبقى دعواتُ لقاءاته في تقويمه، ويصله ما يُعتمَد
   بعدها وما يتغيّر. فخُيّر صاحبُ المنصّة فاختار: تُرفع لقاءاتُه، ولا يُدعى بعدها، ويُلغى رابطُه في Zoom — ويعود ذلك
   كلُّه حين يعود حسابُه (وZoom في `zoom-registrant-release.test.ts`).

   ① إيقافُ حساب المتعلّم يرفع لقاءاتِ شعبه من تقويمه وحدَه، بسببه — ولا يُدعى بعدها إلى جديدٍ ولا تحديث.
   ② ورفعُ الإيقاف يعيد إليه جدولَ ما بقي — بما اعتُمد في إيقافه — ثمّ يُدعى مع الجميع.
   ③ والأرشفةُ ورفعُها كذلك، بسببها.
   ④ ومدرّبٌ أُوقف حسابُه: تُرفع لقاءاتُ شعبه من تقويمه، ولا يُدعى ولا يصله جدولٌ بإسنادٍ ولا بالعامل — ويعود جدولُه بعودته.
   ⑤ وإسقاطُ مقعدِه بعد الإغلاق، والبديلُ مكانَه، لا يرفعان من تقويمه ما رُفع.
   ⑥ والعاملُ يلحق ما أُغلق بغير بابه وما عاد بغيره — مرّةً لكلٍّ.
   ⑦ والعنوانُ المعمّى عند المحو لا يُراسَل.
   ⑧ ومن صار له مقعدٌ وحسابُه مغلق لا يصله جدول — حتّى يعود.
   ⑨ وإسنادُ الحساب المغلق لا يحبس دورةَ العامل.

   ولا شبكة: لا مفاتيحَ Zoom ولا بريدَ هنا. */

import { beforeAll, describe, expect as vexpect, it } from 'vitest'
import { plainExpect } from '../helpers/plain-expect'
const expect = plainExpect(vexpect)
import type { Prisma, PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CohortService } from '../../services/cohort.service'
import { EnrollmentService } from '../../services/enrollment.service'
import { TrainerDepartureService } from '../../services/trainer-departure.service'
import {
  ACCOUNT_ARCHIVED_AR, ACCOUNT_SUSPENDED_AR, SESSION_GUESTS, SessionInviteService,
} from '../../services/session-invite.service'
import { sessionInviteUid } from '../../services/calendar/session-invite'
import { runAccountCalendars, runTrainerCalendars } from '../../worker/jobs'

let prisma: PrismaClient
let auth: AuthService
let cohorts: CohortService
let enrollments: EnrollmentService
let invites: SessionInviteService
let adminId = ''
let courseId = ''
const STAMP = Date.now()
const H = 3_600_000
const DAY = 24 * H
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
/** جداولُه — معرّفاتُ أحداث كلِّ رسالة */
const schedulesOf = (email: string) =>
  mails({ to: email, purpose: 'session.invite.schedule' }).then((rows) => rows.map((r) => uids(r.icsContent)))
const uidsOf = (...sessions: { id: string }[]) => sessions.map((s) => sessionInviteUid(s.id)).sort()
const closedAt = (userId: string) => prisma.user.findUniqueOrThrow({ where: { id: userId } }).then((u) => u.calendarClosedAt)

/** الدورتان تأخذان مئتين في كلّ مرّة — فتُعادان حتّى لا يبقى شيء */
const drain = async (run: (p: PrismaClient) => Promise<{ done: number }>) => {
  for (let i = 0; i < 20; i += 1) if ((await run(prisma)).done === 0) return
}

let seq = 0
async function account(key: string) {
  seq += 1
  const email = `tacc-${key}-${seq}-${STAMP}@wajeez.test`
  const u = await prisma.user.create({ data: { email, displayName: `حساب ${key}`, passwordHash: 'x' } })
  return { userId: u.id, email }
}

/** مدرّبٌ بحسابه وطلبه النشط، مؤهَّلٌ لدورة الشعب هنا */
async function trainer(key: string) {
  const a = await account(`t-${key}`)
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-TACC-${seq}-${STAMP}`, fullName: `مدرّب ${key}`, email: a.email, status: 'active' },
  })
  const p = await prisma.trainerProfile.create({ data: { userId: a.userId, applicationId: application.id } })
  await prisma.trainerCourseQualification.create({ data: { profileId: p.id, courseId, status: 'qualified' } })
  return { ...a, profileId: p.id }
}

/** شعبةٌ لم تبدأ بمدرّبها — وصله جدولُها — ومتعلّمين بمقاعد */
async function cohortWith(lead: { profileId: string }, title: string, learners: { userId: string }[] = []) {
  const c = await prisma.cohort.create({
    data: {
      courseId, title, status: 'open', capacity: 20, price: 100, currency: 'USD', timezone: 'Asia/Amman',
      scheduleWindowStart: new Date(Date.now() - 2 * DAY), scheduleWindowEnd: new Date(Date.now() + 90 * DAY), maxSessions: 60,
    },
  })
  await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId: lead.profileId, role: 'lead', calendarSentAt: new Date() } })
  const seats: string[] = []
  for (const l of learners) {
    seats.push((await prisma.enrollment.create({ data: { userId: l.userId, cohortId: c.id, status: 'enrolled' } })).id)
  }
  return { id: c.id, title, seats }
}

let slot = 0
/** لقاءٌ معتمَدٌ دُعي إليه — كلٌّ في ساعته، فلا يتعارض مدرّبٌ مع نفسه */
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

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  cohorts = new CohortService(prisma)
  enrollments = new EnrollmentService(prisma)
  invites = new SessionInviteService(prisma)
  adminId = (await prisma.user.create({ data: { email: `tacc-admin-${STAMP}@wajeez.test`, displayName: 'الإدارة', passwordHash: 'x' } })).id
  await prisma.userRole.create({ data: { userId: adminId, roleId: 'academic_manager' } })
  courseId = (await prisma.course.findFirstOrThrow({ select: { id: true } })).id
}, 240_000)

describe('① و② إيقافُ حساب المتعلّم ورفعُه', () => {
  it('⚠️ تُرفع لقاءاتُ شعبه من تقويمه وحدَه، ولا يُدعى بعدها — ثمّ يعود جدولُه بما اعتُمد في إيقافه', async () => {
    const t = await trainer('lead')
    const off = await account('suspended')
    const stay = await account('stays')
    const c = await cohortWith(t, 'شعبة الموقوف', [off, stay])
    const s1 = await announced(c.id)
    const s2 = await announced(c.id)

    await auth.suspend(off.userId)
    expect(await removedFrom(off.email), 'بقيت لقاءاتُ شعبه في تقويمه').toEqual(uidsOf(s1, s2))
    for (const r of await mails({ to: off.email, purpose: 'session.invite.cancel' })) expect(r.text).toContain(ACCOUNT_SUSPENDED_AR)
    expect(await mails({ to: { in: [stay.email, t.email, ...GUESTS] }, purpose: 'session.invite.cancel', batchId: { in: [s1.id, s2.id] } }))
      .toHaveLength(0)
    expect(await closedAt(off.userId)).not.toBeNull()

    await invites.announce(s1.id, 'update')
    const s3 = await announced(c.id)
    expect(await to(s1.id, 'session.invite.update'), 'وصل الموقوفَ تحديث').not.toContain(off.email)
    expect(await to(s3.id, 'session.invite.new'), 'وصل الموقوفَ دعوة').not.toContain(off.email)

    await auth.reinstate(off.userId)
    expect(await schedulesOf(off.email), 'لم يعد جدولُه').toEqual([[s1, s2, s3].map((s) => sessionInviteUid(s.id))])
    expect(await closedAt(off.userId)).toBeNull()
    await invites.announce(s2.id, 'update')
    expect(await to(s2.id, 'session.invite.update')).toContain(off.email)
  })
})

describe('③ الأرشفةُ ورفعُها', () => {
  it('⚠️ تُرفع لقاءاتُه بسبب الأرشفة، ويعود جدولُه حين يُعاد تنشيطه', async () => {
    const t = await trainer('archive-lead')
    const gone = await account('archived')
    const c = await cohortWith(t, 'شعبة المؤرشف', [gone])
    const s = await announced(c.id)

    await auth.archive(gone.userId, adminId, 'غادر المنصة بطلبه')
    const [removed, ...more] = await mails({ to: gone.email, purpose: 'session.invite.cancel' })
    expect(more).toHaveLength(0)
    expect(uids(removed!.icsContent)).toEqual([sessionInviteUid(s.id)])
    expect(removed!.text).toContain(ACCOUNT_ARCHIVED_AR)

    await auth.unarchive(gone.userId)
    expect(await schedulesOf(gone.email)).toEqual([[sessionInviteUid(s.id)]])
  })
})

describe('④ مدرّبٌ أُوقف حسابُه', () => {
  it('⚠️ تُرفع لقاءاتُ شعبه من تقويمه، ولا يُدعى، ولا يصله جدولٌ بإسنادٍ ولا بالعامل — ويعود جدولُه بعودته', async () => {
    const t = await trainer('account-off')
    const c = await cohortWith(t, 'شعبة مدرب أوقف حسابه')
    const s = await announced(c.id)

    await auth.suspend(t.userId)
    expect(await removedFrom(t.email)).toEqual(uidsOf(s))
    const [removed] = await mails({ to: t.email, purpose: 'session.invite.cancel' })
    expect(removed!.text).toContain(ACCOUNT_SUSPENDED_AR)
    expect(unfold(removed!.icsContent), 'رفعُ المدرّب يدلّه على صفحة المتعلّم').not.toContain('/student/learning')
    const link = await prisma.cohortTrainer.findUniqueOrThrow({ where: { cohortId_profileId: { cohortId: c.id, profileId: t.profileId } } })
    expect(link.calendarSentAt, 'بقي أنّ جدولَها في تقويمه').toBeNull()

    await invites.announce(s.id, 'update')
    expect(await to(s.id, 'session.invite.update'), 'وصل المغلقَ تحديث').not.toContain(t.email)
    const other = await cohortWith((await trainer('other-lead')), 'شعبة يسند إليها')
    await announced(other.id)
    await cohorts.assignTrainer(other.id, t.profileId, adminId, 'assistant', false)
    await drain(runTrainerCalendars)
    expect(await schedulesOf(t.email), 'وصل المغلقَ جدول').toEqual([])

    await auth.reinstate(t.userId)
    await drain(runTrainerCalendars)
    expect((await schedulesOf(t.email)).length, 'لم يعد جدولُ شعبتَيه').toBe(2)
  })
})

describe('⑤ وتركُ مقعده بعد الإغلاق', () => {
  it('⚠️ إسقاطُ تسجيله لا يرفع من تقويمه ما رُفع حين أُغلق', async () => {
    const t = await trainer('drop-lead')
    const off = await account('dropped-after')
    const c = await cohortWith(t, 'شعبة الإسقاط بعد الإيقاف', [off])
    const s = await announced(c.id)
    await auth.suspend(off.userId)
    expect(await removedFrom(off.email)).toEqual(uidsOf(s))

    await enrollments.drop(c.seats[0]!, adminId, 'رد ما دفع')
    expect(await removedFrom(off.email), 'رُفع من تقويمه مرّتين').toEqual(uidsOf(s))
  })

  it('⚠️ والبديلُ مكانَ مدرّبٍ أُغلق حسابُه لا يرفع من تقويمه ما رُفع', async () => {
    const off = await trainer('substituted-after')
    const next = await trainer('substitute')
    const c = await cohortWith(off, 'شعبة بديل المغلق')
    const s = await announced(c.id)
    await auth.suspend(off.userId)
    expect(await removedFrom(off.email)).toEqual(uidsOf(s))

    const departure = await prisma.trainerDeparture.create({ data: { profileId: off.profileId, reasonAr: 'اختبار', openedBy: adminId } })
    await new TrainerDepartureService(prisma).substitute(adminId, departure.id, c.id, next.profileId)
    expect(await removedFrom(off.email), 'رُفع من تقويمه مرّتين').toEqual(uidsOf(s))
  })
})

describe('⑥ والعاملُ يلحق ما تغيّر بغير بابه', () => {
  it('⚠️ يرفع لقاءاتِ من أُغلق حسابُه مرّةً — ويعيد جدولَه حين يعود، مرّةً', async () => {
    const t = await trainer('sweep-lead')
    const off = await account('closed-directly')
    const c = await cohortWith(t, 'شعبة العامل', [off])
    const s = await announced(c.id)
    /* ما يفعله إيقافُ التدريب بحساب من لا موقعَ له سواه، وما كان قبل هذا اليوم: الحالُ وحدَها */
    await prisma.user.update({ where: { id: off.userId }, data: { status: 'suspended', suspendedAt: new Date() } })

    await drain(runAccountCalendars)
    expect(await removedFrom(off.email)).toEqual(uidsOf(s))
    await drain(runAccountCalendars)
    expect(await removedFrom(off.email), 'رُفع من تقويمه مرّتين').toEqual(uidsOf(s))

    /* وما تفعله إعادةُ المؤسِّسين عند الإقلاع */
    await prisma.user.update({ where: { id: off.userId }, data: { status: 'active', suspendedAt: null } })
    await drain(runAccountCalendars)
    await drain(runAccountCalendars)
    expect(await schedulesOf(off.email), 'لم يعد جدولُه — أو عاد مرّتين').toEqual([[sessionInviteUid(s.id)]])
  })
})

describe('⑦ والعنوانُ المعمّى عند المحو', () => {
  it('⚠️ لا يُراسَل — متعلّما كان أو مدرّبا — ويُكتب أنّ تقويمَه أُغلق', async () => {
    const t = await trainer('erased-lead')
    const erased = await account('erased')
    const c = await cohortWith(t, 'شعبة الممحو', [erased])
    await announced(c.id)
    /* ما يفعله محوُ الحسابات (`account-reset.service.ts`): يُؤرشَف ويُعمّى عنوانُه */
    const scrambled = [erased, t].map((a) => ({ id: a.userId, email: `archived+${a.userId}@wajeez.invalid` }))
    for (const a of scrambled) await prisma.user.update({ where: { id: a.id }, data: { status: 'archived', email: a.email } })

    await drain(runAccountCalendars)
    expect(await mails({ to: { in: scrambled.map((a) => a.email) } }), 'رُوسل عنوانٌ لا يصل أحدا').toHaveLength(0)
    for (const a of scrambled) expect(await closedAt(a.id)).not.toBeNull()
  })
})

describe('⑧ ومن صار له مقعدٌ وحسابُه مغلق', () => {
  it('⚠️ لا يصله جدولُ الشعبة — ويصله حين يعود', async () => {
    const t = await trainer('seat-lead')
    const off = await account('seated-while-off')
    const c = await cohortWith(t, 'شعبة مقعد المغلق')
    const s = await announced(c.id)
    await auth.suspend(off.userId)

    const e = await prisma.enrollment.create({ data: { userId: off.userId, cohortId: c.id, status: 'enrolled' } })
    expect(await invites.welcome(e.id), 'وصل المغلقَ جدول').toBe(0)
    await auth.reinstate(off.userId)
    expect(await schedulesOf(off.email)).toEqual([[sessionInviteUid(s.id)]])
  })
})

describe('⑨ وإسنادُ الحساب المغلق في دورة العامل', () => {
  it('⚠️ لا يُعدّ — فلا يحبس مئتَي الدورة بإسنادٍ لا يُرسَل له شيء', async () => {
    const t = await trainer('starved')
    await cohortWith(t, 'شعبة لا تحبس العامل')
    await auth.suspend(t.userId)
    await drain(runTrainerCalendars)
    expect((await invites.sweepTrainerCalendars()).links).toBe(0)
  })
})
