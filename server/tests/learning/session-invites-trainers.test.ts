/* المدرّبُ في التقويم مع الجميع (٢٧ أكتوبر ٢٠٢٦، خطة لوحة الإدارة — المرحلة السادسة).

   قال صاحبُ المنصّة: «كل شعبه تغيرت مواعيدها يجب ان يحدث التغيير في الكلندر عند الجميع». وكانت الدعوةُ
   تصل المتعلّمين والعنوانَين، والمدرّبُ وحدَه لا يصله شيء — فما نُقل لا يتحرّك في تقويمه.

   ① يُدعى مع الجميع ويصله التحديثُ والرفع — بلا رابط: يبدأ اللقاءَ مضيفا من صفحة شعبته. والموقوفُ لا يُدعى.
   ② والرفعُ لأنّه نقل لقاءه أو حذفه لا يقول له «نقله مدرّبك».
   ③ ومن يُسنَد إلى شعبةٍ اعتُمدت لقاءاتُها يصله جدولُ ما بقي مرّةً — وتغييرُ دوره لا يعيده.
   ④ والبديلُ مكانَ الراحل: تُرفع لقاءاتُها من تقويم الراحل، ويصل البديلَ جدولُها.
   ⑤ والعاملُ يرسل جدولَ من أُسند قبل هذا اليوم مرّةً — لا الموقوفَ.

   وعلّتان في «أفي التقاويم هو؟» كُشفتا معه — كان يُقرأ من طابور البريد:
   ⑥ رفعُ اللقاء من تقويم متعلّمٍ ترك الشعبةَ كان يُقرأ رفعا للجميع — فإلغاؤها بعده لا يرفعه من تقويم أحد.
   ⑦ وما خرج من الطابور يُحذف بعد أربعة عشر يوما — فإلغاءُ شعبةٍ دُعي إلى لقاءاتها قبل أسبوعين لا يرفعها.

   ولا شبكة: لا مفاتيحَ Zoom هنا، فلا اجتماعَ ولا تسجيل. */

import { beforeAll, describe, expect as vexpect, it } from 'vitest'
import { plainExpect } from '../helpers/plain-expect'
const expect = plainExpect(vexpect)
import type { Prisma, PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { CohortService } from '../../services/cohort.service'
import { TrainerDepartureService } from '../../services/trainer-departure.service'
import {
  COHORT_CANCELLED_AR, SESSION_GUESTS, SessionInviteService, TRAINER_LEFT_AR,
} from '../../services/session-invite.service'
import { sessionInviteUid } from '../../services/calendar/session-invite'
import { runTrainerCalendars } from '../../worker/jobs'

let prisma: PrismaClient
let cohorts: CohortService
let invites: SessionInviteService
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

let seq = 0
/** مدرّبٌ بحسابه، مؤهَّلٌ لدورة الشعب هنا */
async function trainer(key: string, suspended = false) {
  seq += 1
  const email = `tinv-${key}-${seq}-${STAMP}@wajeez.test`
  const u = await prisma.user.create({ data: { email, displayName: `مدرّب ${key}`, passwordHash: 'x' } })
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-TINV-${seq}-${STAMP}`, fullName: `مدرّب ${key}`, email, status: 'active' },
  })
  const p = await prisma.trainerProfile.create({
    data: { userId: u.id, applicationId: application.id, ...(suspended ? { suspendedAt: new Date() } : {}) },
  })
  await prisma.trainerCourseQualification.create({ data: { profileId: p.id, courseId, status: 'qualified' } })
  return { userId: u.id, profileId: p.id, email }
}

/** شعبةٌ بمتعلّمَين ومدرّبها — وإسنادُه قديمٌ وصله جدولُه (`calendarSentAt`) إلّا أن يُطلب غيرُه */
async function cohortWith(lead: { profileId: string } | null, title: string, sent: Date | null = new Date()) {
  seq += 1
  const c = await prisma.cohort.create({
    data: {
      courseId, title, status: 'open', capacity: 20, price: 100, currency: 'USD', timezone: 'Asia/Amman',
      scheduleWindowStart: new Date(Date.now() - 2 * 24 * H), scheduleWindowEnd: new Date(Date.now() + 90 * 24 * H), maxSessions: 60,
    },
  })
  if (lead) await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId: lead.profileId, role: 'lead', calendarSentAt: sent } })
  const learners: { email: string; userId: string; enrollmentId: string }[] = []
  for (const k of ['a', 'b']) {
    const email = `tinv-l${seq}${k}-${STAMP}@wajeez.test`
    const u = await prisma.user.create({ data: { email, displayName: `متعلّم ${k}`, passwordHash: 'x' } })
    const e = await prisma.enrollment.create({ data: { userId: u.id, cohortId: c.id, status: 'enrolled' } })
    learners.push({ email, userId: u.id, enrollmentId: e.id })
  }
  return { id: c.id, learners }
}

let slot = 0
/** لقاءٌ معتمَدٌ دُعي إليه — كلٌّ في ساعته، فلا يتعارض مدرّبٌ مع نفسه بين الشعب */
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
  invites = new SessionInviteService(prisma)
  adminId = (await prisma.user.create({ data: { email: `tinv-admin-${STAMP}@wajeez.test`, displayName: 'الإدارة', passwordHash: 'x' } })).id
  await prisma.userRole.create({ data: { userId: adminId, roleId: 'academic_manager' } })
  courseId = (await prisma.course.findFirstOrThrow({ select: { id: true } })).id
}, 240_000)

describe('① المدرّبُ يُدعى مع الجميع — بلا رابط، إلى صفحة شعبته', () => {
  it('⚠️ الدعوةُ والتحديثُ والرفعُ تصله كما تصل المتعلّمين والعنوانَين', async () => {
    const t = await trainer('lead')
    const c = await cohortWith(t, 'شعبة الدعوة')
    const s = await announced(c.id)
    const everyone = [...c.learners.map((l) => l.email), t.email, ...GUESTS].sort()
    expect(await to(s.id, 'session.invite.new')).toEqual(everyone)

    await invites.announce(s.id, 'update')
    expect(await to(s.id, 'session.invite.update')).toEqual(everyone)
    await invites.withdraw({
      id: s.id, cohortId: c.id, cohortTitle: 'شعبة الدعوة', title: s.title, startsAt: s.startsAt, endsAt: s.endsAt,
    }, 'رفع للاختبار.')
    expect(await to(s.id, 'session.invite.cancel')).toEqual(everyone)
  })

  it('⚠️ ودعوتُه لا تحمل رابطَ مشارك — وتدلّه على صفحة شعبته لا على «صفحة رحلتك»', async () => {
    const t = await trainer('host')
    const c = await cohortWith(t, 'شعبة المضيف')
    const s = await announced(c.id)
    await invites.announce(s.id, 'update')
    for (const m of await mails({ to: t.email, batchId: s.id })) {
      expect(m.icsContent, `${m.purpose}: رابطُ مشاركٍ يُدخله مشاركا لا مضيفا`).not.toContain('LOCATION:')
      expect(unfold(m.icsContent)).toContain(`/trainer/cohort/${c.id}`)
      expect(m.html).toContain(`/trainer/cohort/${c.id}`)
      expect(m.text).toContain('صفحة شعبتك')
      expect(m.text).not.toContain('صفحة رحلتك')
      expect(m.text).not.toContain('بقي رابط الدخول نفسه')
    }
  })

  it('⚠️ والموقوفُ لا يُدعى', async () => {
    const lead = await trainer('active')
    const off = await trainer('suspended', true)
    const c = await cohortWith(lead, 'شعبة الموقوف')
    await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId: off.profileId, role: 'assistant' } })
    const s = await announced(c.id)
    const sent = await to(s.id, 'session.invite.new')
    expect(sent).toContain(lead.email)
    expect(sent).not.toContain(off.email)
  })
})

describe('② ورفعُ ما نقله أو حذفه لا يقول له «نقله مدرّبك»', () => {
  it('⚠️ نقلٌ يعيد اللقاءَ لانتظار الإدارة — لكلٍّ سببُه', async () => {
    const t = await trainer('mover')
    const c = await cohortWith(t, 'شعبة النقل')
    const s = await announced(c.id, 300)
    const at = new Date(s.startsAt.getTime() + 2 * H)
    const moved = await cohorts.trainerMoveSession(t.userId, s.id, { startsAt: at, endsAt: new Date(at.getTime() + 2 * H) })
    expect(moved.approvalState, 'البعيدُ بلا موعدٍ لمحوره يعود للانتظار').toBe('pending')

    const [mine] = await mails({ to: t.email, batchId: s.id, purpose: 'session.invite.cancel' })
    expect(mine!.text).toContain('نقل هذا اللقاء ويراجع الآن عند الإدارة')
    expect(mine!.text).not.toContain('نقله مدرّبك')
    const [learner] = await mails({ to: c.learners[0]!.email, batchId: s.id, purpose: 'session.invite.cancel' })
    expect(learner!.text).toContain('نقله مدرّبك')
  })

  it('⚠️ وحذفُه — والمتعلّمُ يُقال له إنّ بديلَه يصله', async () => {
    const t = await trainer('deleter')
    const c = await cohortWith(t, 'شعبة الحذف')
    const s = await announced(c.id)
    await cohorts.trainerDeleteSession(t.userId, s.id)
    const [mine] = await mails({ to: t.email, batchId: s.id, purpose: 'session.invite.cancel' })
    expect(mine!.text).toContain('حذف هذا اللقاء من جدول الشعبة')
    expect(mine!.text).not.toContain('ويصلك بديله')
    const [learner] = await mails({ to: c.learners[0]!.email, batchId: s.id, purpose: 'session.invite.cancel' })
    expect(learner!.text).toContain('ويصلك بديله')
  })
})

describe('③ يُسنَد إلى شعبةٍ اعتُمدت لقاءاتُها — جدولُ ما بقي مرّةً', () => {
  it('⚠️ رسالةٌ واحدةٌ بما بقي بلا روابط — ثمّ يُدعى مع الجميع، وتغييرُ دوره لا يعيدها', async () => {
    const c = await cohortWith(null, 'شعبة الإسناد')
    const s1 = await announced(c.id)
    const s2 = await announced(c.id)
    const t = await trainer('joiner')

    await cohorts.assignTrainer(c.id, t.profileId, adminId, 'lead', false)
    const link = await prisma.cohortTrainer.findUniqueOrThrow({
      where: { cohortId_profileId: { cohortId: c.id, profileId: t.profileId } },
    })
    const schedules = await mails({ to: t.email, purpose: 'session.invite.schedule' })
    expect(schedules, 'رسالةٌ لكلّ لقاء — أو لا رسالة').toHaveLength(1)
    expect(schedules[0]!.batchId).toBe(link.id)
    expect(schedules[0]!.icsMethod).toBe('PUBLISH')
    expect(uids(schedules[0]!.icsContent)).toEqual([sessionInviteUid(s1.id), sessionInviteUid(s2.id)])
    expect(schedules[0]!.icsContent).not.toContain('LOCATION:')
    expect(schedules[0]!.text).toContain('صفحة شعبتك')
    expect(link.calendarSentAt, 'لم يُكتب أنّ جدولَه وصل — فيرسله العاملُ ثانيةً').not.toBeNull()

    await cohorts.assignTrainer(c.id, t.profileId, adminId, 'assistant', false)
    expect(await mails({ to: t.email, purpose: 'session.invite.schedule' }), 'تغييرُ الدور أعاد الجدول').toHaveLength(1)

    const s3 = await announced(c.id)
    expect(await to(s3.id, 'session.invite.new')).toContain(t.email)
  })

  it('ومن أُسند قبل أن يُعتمَد لقاءٌ لا تصله رسالةٌ فارغة — ويُكتب أنّه لا شيءَ يُرسَل', async () => {
    const c = await cohortWith(null, 'شعبة بلا لقاءات')
    const t = await trainer('early')
    await cohorts.assignTrainer(c.id, t.profileId, adminId, 'lead', false)
    expect(await mails({ to: t.email, purpose: 'session.invite.schedule' })).toHaveLength(0)
    const link = await prisma.cohortTrainer.findUniqueOrThrow({
      where: { cohortId_profileId: { cohortId: c.id, profileId: t.profileId } },
    })
    expect(link.calendarSentAt).not.toBeNull()
  })
})

describe('④ البديلُ مكانَ الراحل', () => {
  it('⚠️ تُرفع لقاءاتُ الشعبة من تقويم الراحل بسببها — ويصل البديلَ جدولُها، ثمّ يُدعى هو وحدَه', async () => {
    const gone = await trainer('departed')
    const next = await trainer('substitute')
    const c = await cohortWith(gone, 'شعبة الرحيل')
    const s1 = await announced(c.id)
    const s2 = await announced(c.id)
    const departure = await prisma.trainerDeparture.create({
      data: { profileId: gone.profileId, reasonAr: 'اختبار', openedBy: adminId },
    })

    await new TrainerDepartureService(prisma).substitute(adminId, departure.id, c.id, next.profileId)

    const removed = await mails({ to: gone.email, purpose: 'session.invite.cancel' })
    expect(removed.map((r) => uids(r.icsContent)[0]).sort()).toEqual([sessionInviteUid(s1.id), sessionInviteUid(s2.id)].sort())
    for (const r of removed) {
      expect(r.icsMethod).toBe('CANCEL')
      expect(r.text).toContain(TRAINER_LEFT_AR)
      expect(unfold(r.icsContent), 'رفعُ المدرّب يدلّه على صفحة المتعلّم').not.toContain('/student/learning')
    }
    const [schedule] = await mails({ to: next.email, purpose: 'session.invite.schedule' })
    expect(uids(schedule!.icsContent)).toEqual([sessionInviteUid(s1.id), sessionInviteUid(s2.id)])
    expect(await mails({ to: { in: c.learners.map((l) => l.email) }, purpose: 'session.invite.cancel' }), 'رُفع من تقويم المتعلّمين').toHaveLength(0)

    await invites.announce(s1.id, 'update')
    const updated = await to(s1.id, 'session.invite.update')
    expect(updated).toContain(next.email)
    expect(updated).not.toContain(gone.email)
  })
})

describe('⑤ والعاملُ يرسل جدولَ من أُسند قبل هذا اليوم — مرّةً', () => {
  /** الدورةُ تأخذ مئتي إسنادٍ في كلّ مرّة — فتُعاد حتّى لا يبقى شيء */
  const sweepAll = async () => {
    for (let i = 0; i < 20; i += 1) if ((await runTrainerCalendars(prisma)).done === 0) return
  }

  it('⚠️ جدولُ ما بقي لمن لم يصله — ولا يتكرّر، ولا يصل الموقوف', async () => {
    const old = await trainer('before-today')
    const off = await trainer('suspended-before', true)
    const c = await cohortWith(old, 'شعبة قديمة', null)
    await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId: off.profileId, role: 'assistant' } })
    const s = await announced(c.id)

    await sweepAll()
    const [schedule, ...more] = await mails({ to: old.email, purpose: 'session.invite.schedule' })
    expect(more).toHaveLength(0)
    expect(uids(schedule!.icsContent)).toEqual([sessionInviteUid(s.id)])
    expect(await mails({ to: off.email })).toHaveLength(0)

    await sweepAll()
    expect(await mails({ to: old.email, purpose: 'session.invite.schedule' }), 'أُرسل الجدولُ مرّتين').toHaveLength(1)
    const offLink = await prisma.cohortTrainer.findUniqueOrThrow({
      where: { cohortId_profileId: { cohortId: c.id, profileId: off.profileId } },
    })
    expect(offLink.calendarSentAt, 'كُتب للموقوف أنّ جدولَه وصل — فلا يصله إن عاد').toBeNull()
  })
})

describe('⑥ رفعُه من تقويم من ترك الشعبة لا يُقرأ رفعا للجميع', () => {
  it('⚠️ متعلّمٌ تركها ثمّ أُلغيت — فيُرفع من تقويم من بقي ومدرّبها والعنوانَين', async () => {
    const t = await trainer('cancel-after-leave')
    const c = await cohortWith(t, 'شعبة الترك')
    const s = await announced(c.id)
    const [leaver, stayer] = c.learners
    await prisma.enrollment.update({ where: { id: leaver!.enrollmentId }, data: { status: 'dropped' } })
    await invites.release({ email: leaver!.email }, c.id, 'ترك الشعبة.')

    await cohorts.transition(c.id, 'cancelled', adminId, 'اختبار', { reasonAr: 'اختبار' })
    const removed = await mails({ batchId: s.id, purpose: 'session.invite.cancel', to: { not: leaver!.email } })
    expect(removed.map((r) => r.to).sort()).toEqual([stayer!.email, t.email, ...GUESTS].sort())
    for (const r of removed) expect(r.text).toContain(COHORT_CANCELLED_AR)
    expect(await mails({ batchId: s.id, to: leaver!.email, purpose: 'session.invite.cancel' }), 'رُفع ممّن تركها مرّتين').toHaveLength(1)
  })

  it('⚠️ وإعادةُ فتح ما لم يُلغَ لا تدعو إليه ثانيةً', async () => {
    const t = await trainer('reopen-after-leave')
    const c = await cohortWith(t, 'شعبة الترك والفتح')
    const s = await announced(c.id)
    await invites.release({ email: c.learners[0]!.email }, c.id, 'ترك الشعبة.')
    expect(await invites.reannounceCohort(c.id)).toBe(0)
    expect(await mails({ batchId: s.id, purpose: 'session.invite.new' })).toHaveLength(2 + 1 + GUESTS.length)
  })
})

describe('⑦ وما حُذف من طابور البريد بعد أسبوعين لا يُنسي أنّه في التقاويم', () => {
  it('⚠️ شعبةٌ دُعي إلى لقاءاتها ثمّ قُلّم الطابورُ — إلغاؤها يرفعها من تقاويم الجميع', async () => {
    const t = await trainer('retention')
    const c = await cohortWith(t, 'شعبة الطابور المقلّم')
    const s = await announced(c.id)
    /* ما يفعله `enforceRetention` بما خرج قبل أربعة عشر يوما */
    await prisma.outboxMail.deleteMany({ where: { batchId: s.id } })

    await cohorts.transition(c.id, 'cancelled', adminId, 'اختبار', { reasonAr: 'اختبار' })
    expect(await to(s.id, 'session.invite.cancel')).toEqual([...c.learners.map((l) => l.email), t.email, ...GUESTS].sort())
    const row = await prisma.cohortSession.findUniqueOrThrow({ where: { id: s.id } })
    expect(row.calendarWithdrawnAt).not.toBeNull()
  })
})
