/* ═══ وقتُ اللقاء من باب المدرّب — لا ماضٍ، والمردودُ يُنقل فيعود (٢٠ أكتوبر ٢٠٢٦) ═══

   ① «Block it» (صاحب المنصّة): المدرّبُ لا يضيف لقاءً ولا ينقله إلى وقتٍ مضى — كان يُعتمد ويصل متعلّميه
      دعوةً إلى ما فات. ولقاءٌ فات ولم يقع يُنقل إلى وقتٍ قادم. والإدارةُ وحدَها تسجّل لقاءً مضى.
   ② والمردودُ يُنقل فيعود إلى انتظار الإدارة — كانت الساعةُ وحدَها تتغيّر فيبقى مردودا ملغى لا يراه
      طابورُها، والمدرّبُ يظنّه أُرسل.

   ورُئي ساقطا: أُسقط `pastTimeProblem` من بابَي الإضافة والنقل فسقط ①، وأُسقط `resubmitted` فسقط ②. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { CohortService } from '../../services/cohort.service'

let prisma: PrismaClient
let cohorts: CohortService
let adminId = ''
let trainerUserId = ''
let cohortId = ''
const STAMP = Date.now()
const H = 3_600_000
const DAY = 24 * H

const inHours = (h: number) => new Date(Date.now() + h * H)
const pendingNotices = () => prisma.notification.count({ where: { templateKey: 'cohort.session.pending', userId: adminId } })
const session = (startsAt: Date, data: Record<string, unknown> = {}) => prisma.cohortSession.create({
  data: { cohortId, title: `لقاء ${startsAt.toISOString()}`, startsAt, endsAt: new Date(startsAt.getTime() + 2 * H), ...data },
})
const move = (id: string, startsAt: Date) =>
  cohorts.trainerMoveSession(trainerUserId, id, { startsAt, endsAt: new Date(startsAt.getTime() + 2 * H) })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  cohorts = new CohortService(prisma)

  adminId = (await prisma.user.create({ data: { email: `mt-admin-${STAMP}@wajeez.test`, displayName: 'المعتمِد', passwordHash: 'x' } })).id
  await prisma.userRole.create({ data: { userId: adminId, roleId: 'academic_manager' } })
  const tUser = await prisma.user.create({ data: { email: `mt-trainer-${STAMP}@wajeez.test`, displayName: 'مدرّب الوقت', passwordHash: 'x' } })
  trainerUserId = tUser.id
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-MT-${STAMP}`, fullName: 'مدرّب الوقت', email: tUser.email, status: 'active' },
  })
  const profile = await prisma.trainerProfile.create({ data: { userId: tUser.id, applicationId: application.id } })
  const course = await prisma.course.findFirst({ select: { id: true } })
  const cohort = await prisma.cohort.create({
    data: {
      courseId: course!.id, title: 'شعبة الوقت', status: 'active', capacity: 20, price: 100, currency: 'USD',
      timezone: 'Asia/Amman', deliveryMode: 'in_person',
      scheduleWindowStart: new Date(Date.now() - 10 * DAY), scheduleWindowEnd: new Date(Date.now() + 30 * DAY),
    },
  })
  cohortId = cohort.id
  await prisma.cohortTrainer.create({ data: { cohortId, profileId: profile.id, role: 'lead' } })
}, 240_000)

describe('① لا لقاء في وقت مضى من باب المدرّب', () => {
  it('⚠️ الإضافة بوقت مضى تردّ بسببها — وبوقت قادم تجدول', async () => {
    const add = (startsAt: Date) => cohorts.trainerAddSessionWithMeeting(trainerUserId, cohortId, {
      title: 'لقاء جديد', startsAt, endsAt: new Date(startsAt.getTime() + 2 * H),
    })
    await expect(add(inHours(-3))).rejects.toMatchObject({ code: 'past_time', message: 'هذا الوقت مضى — اختر وقتا قادما' })
    const ok = await add(inHours(48))
    expect(ok.session.approvalState).toBe('pending')
  })

  it('⚠️ والنقل إلى وقت مضى يردّ — ولقاء فات ولم يقع ينقل إلى وقت قادم', async () => {
    const coming = await session(inHours(72), { approvalState: 'approved', approvedBy: adminId, approvedAt: new Date() })
    await expect(move(coming.id, inHours(-2))).rejects.toMatchObject({ code: 'past_time' })
    expect((await prisma.cohortSession.findUniqueOrThrow({ where: { id: coming.id } })).startsAt.toISOString())
      .toBe(coming.startsAt.toISOString())

    const missed = await session(inHours(-30), { approvalState: 'approved', approvedBy: adminId, approvedAt: new Date() })
    const to = inHours(30)
    const moved = await move(missed.id, to)
    expect(moved.startsAt.toISOString()).toBe(to.toISOString())
  })

  it('والإدارة تسجّل لقاء مضى — بابها لا يمسّه الحدّ', async () => {
    const past = inHours(-5)
    const s = await cohorts.addSession(adminId, cohortId, { title: 'لقاء مضى سجّلته الإدارة', startsAt: past, endsAt: new Date(past.getTime() + 2 * H) })
    expect(s.startsAt.toISOString()).toBe(past.toISOString())
  })
})

describe('② المردود ينقل فيعود إلى الإدارة', () => {
  it('⚠️ ينتظر الإدارة، ويعود قادما، وتمحى ملاحظتها — وتعلم بها الإدارة', async () => {
    const rejected = await session(inHours(96), {
      approvalState: 'rejected', status: 'cancelled', reviewNote: 'الموعد يتعارض مع عطلة', approvedBy: adminId, approvedAt: new Date(),
    })
    const before = await pendingNotices()
    const moved = await move(rejected.id, inHours(120))
    expect(moved.approvalState, 'بقي مردودا بعد نقله').toBe('pending')
    expect(moved.status, 'بقي ملغى بعد نقله').toBe('scheduled')
    expect(moved.reviewNote).toBeNull()
    expect(await pendingNotices(), 'لم تعلم الإدارة بالمرسل ثانية').toBe(before + 1)
  })
})
