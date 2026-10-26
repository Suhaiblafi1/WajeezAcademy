/* لقاءاتُ الشعبة الملغاة أو المؤجَّلة تُرفع من التقاويم (٢٦ أكتوبر ٢٠٢٦).

   بلاغُ صاحب المنصّة: «لماذا لا تحذف الجلسات من الكلندر للدورات التي تم تأجيلها أو إلغاؤها؟». كان الإلغاءُ
   يُبلغ بالجرس ويترك دعواتِ لقاءاتها في تقويم كلِّ مسجَّلٍ وفي تقويم الإدارة.

   ① إلغاءُ الشعبة يرفع ما دُعي إليه من لقاءاتها الآتية — للمسجَّلين وللعنوانَين — لا ما مضى ولا ما لم يُدعَ إليه أحد.
   ② ولا دعوةَ بعده إلى لقاءٍ منها، والعاملُ لا يكرّر الرفع.
   ③ وإعادةُ فتحها تُرجع ما رُفع بالمعرّف نفسِه.
   ④ وشعبةٌ أُلغيت بغير بابه (كتابةٌ مباشرة، أو قبل الإصلاح) يرفع العاملُ لقاءاتِها.
   ⑤ وتأجيلُ الخطّة إلى موسمٍ قادم يرفع ما قبل موسمها الجديد وحدَه، ويُخفيه من جدول المدرّب. */

import { beforeAll, describe, expect as vexpect, it } from 'vitest'
import { plainExpect } from '../helpers/plain-expect'
const expect = plainExpect(vexpect)
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { CohortService } from '../../services/cohort.service'
import { DeadlinesService } from '../../services/deadlines.service'
import { SESSION_GUESTS, SessionInviteService } from '../../services/session-invite.service'
import { runVoidedSessionInvites } from '../../worker/jobs'

let prisma: PrismaClient
let cohorts: CohortService
let invites: SessionInviteService
let adminId = ''
let trainerUserId = ''
let profileId = ''
let courseId = ''
const STAMP = Date.now()
const H = 3_600_000
const DAY = 24 * H
const GUESTS = SESSION_GUESTS.map((g) => g.email)

const mails = (sessionId: string, purpose: string) =>
  prisma.outboxMail.findMany({ where: { batchId: sessionId, purpose }, select: { to: true } })

let seq = 0
async function makeCohort(status = 'open') {
  seq += 1
  const c = await prisma.cohort.create({
    data: { courseId, title: `شعبة ${seq}`, status, capacity: 20, price: 100, currency: 'USD', timezone: 'Asia/Amman' },
  })
  await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead' } })
  const u = await prisma.user.create({ data: { email: `void-l${seq}-${STAMP}@wajeez.test`, displayName: 'متعلّم', passwordHash: 'x' } })
  await prisma.enrollment.create({ data: { userId: u.id, cohortId: c.id, status: 'enrolled' } })
  return { id: c.id, learnerEmail: u.email }
}

/** لقاءٌ معتمَدٌ دُعي إليه — `announced: false` لمعتمَدٍ لم تخرج دعوتُه */
async function session(cohortId: string, hours: number, announced = true) {
  seq += 1
  const startsAt = new Date(Date.now() + hours * H)
  const s = await prisma.cohortSession.create({
    data: { cohortId, title: `لقاء ${seq}`, startsAt, endsAt: new Date(startsAt.getTime() + H), approvalState: 'approved' },
  })
  if (announced) await invites.announce(s.id, 'new')
  return s
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  cohorts = new CohortService(prisma)
  invites = new SessionInviteService(prisma)
  adminId = (await prisma.user.create({ data: { email: `void-admin-${STAMP}@wajeez.test`, displayName: 'الإدارة', passwordHash: 'x' } })).id
  const tUser = await prisma.user.create({ data: { email: `void-trainer-${STAMP}@wajeez.test`, displayName: 'المدرّب', passwordHash: 'x' } })
  trainerUserId = tUser.id
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-VOID-${STAMP}`, fullName: 'المدرّب', email: tUser.email, status: 'active' },
  })
  profileId = (await prisma.trainerProfile.create({ data: { userId: tUser.id, applicationId: application.id } })).id
  courseId = (await prisma.course.findFirst({ select: { id: true } }))!.id
}, 240_000)

describe('إلغاءُ الشعبة وإعادةُ فتحها', () => {
  it('① يرفع ما دُعي إليه من لقاءاتها الآتية — ② ولا يُدعى بعده، ولا يتكرّر — ③ والفتحُ يُرجعه', async () => {
    const c = await makeCohort()
    const upcoming = await session(c.id, 48)
    const silent = await session(c.id, 72, false)
    expect((await mails(upcoming.id, 'session.invite.new')).length).toBe(1 + GUESTS.length)

    await cohorts.transition(c.id, 'cancelled', adminId, 'اختبار', { reasonAr: 'اختبار' })
    const cancelled = (await mails(upcoming.id, 'session.invite.cancel')).map((m) => m.to).sort()
    expect(cancelled).toEqual([c.learnerEmail, ...GUESTS].sort())
    expect((await mails(silent.id, 'session.invite.cancel')).length).toBe(0)

    expect(await invites.announce(upcoming.id, 'update')).toBe(0)
    await runVoidedSessionInvites(prisma)
    expect((await mails(upcoming.id, 'session.invite.cancel')).length).toBe(1 + GUESTS.length)

    await cohorts.reopen(c.id, adminId)
    expect((await mails(upcoming.id, 'session.invite.new')).length).toBe(2 * (1 + GUESTS.length))
  })

  it('④ شعبةٌ أُلغيت بغير بابه يرفع العاملُ لقاءاتِها مرّةً واحدة', async () => {
    const c = await makeCohort()
    const s = await session(c.id, 30)
    await prisma.cohort.update({ where: { id: c.id }, data: { status: 'cancelled' } })
    expect((await mails(s.id, 'session.invite.cancel')).length).toBe(0)

    await runVoidedSessionInvites(prisma)
    expect((await mails(s.id, 'session.invite.cancel')).length).toBe(1 + GUESTS.length)
    await runVoidedSessionInvites(prisma)
    expect((await mails(s.id, 'session.invite.cancel')).length).toBe(1 + GUESTS.length)
  })
})

describe('تأجيلُ الخطّة إلى موسمٍ قادم', () => {
  it('⑤ يرفع ما قبل موسمها الجديد وحدَه، ويُخفيه من جدول المدرّب', async () => {
    const c = await makeCohort('draft')
    const old = await session(c.id, 5 * 24)
    const next = await session(c.id, 20 * 24)
    await prisma.cohortDeliveryPlan.create({
      data: {
        cohortId: c.id, trainerId: profileId, content: {}, status: 'changes_requested',
        postponedTo: new Date(Date.now() + 10 * DAY),
      },
    })

    await runVoidedSessionInvites(prisma)
    expect((await mails(old.id, 'session.invite.cancel')).length).toBe(1 + GUESTS.length)
    expect((await mails(next.id, 'session.invite.cancel')).length).toBe(0)
    expect(await invites.announce(old.id, 'update')).toBe(0)

    const schedule = await new DeadlinesService(prisma).forTrainer(trainerUserId, new Date(), 30)
    const ids = schedule.sessions.map((s) => s.sessionId)
    expect(ids).toContain(next.id)
    expect(ids).not.toContain(old.id)
  })
})
