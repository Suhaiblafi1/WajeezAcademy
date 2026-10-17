/* نقلُ الشعبة إلى فصلٍ آخر — المدرّبُ يطلب والإدارةُ تعتمد (١٧ أكتوبر ٢٠٢٦).

   وما يُحرس هنا:
   ١) الطلبُ لا يحرّك موعدا — ولا يُطلب لشعبةٍ ليست له، ولا طلبان معلَّقان معا.
   ٢) الاعتمادُ يزيح الشعبةَ ولقاءاتِها القائمة بأسابيعَ كاملة، ويربطها بفصلها، ويبلّغ المتعلّمين.
   ٣) الردُّ يُبقي كلَّ شيء، ويصل المدرّبَ. والسحبُ من صاحبه وحدَه. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CohortMoveService } from '../../services/cohort-move.service'
import { EnrollmentService } from '../../services/enrollment.service'
import { nextTerm } from '../../../src/application/trainer/cohort-move'
import { termOf } from '../../../src/application/terms/season'

const DAY = 86_400_000
let prisma: PrismaClient
let svc: CohortMoveService
let trainerId = ''
let otherTrainerId = ''
let adminId = ''
let learnerId = ''

/* شعبةٌ تبدأ في الفصل القادم بلقاءين — والهدفُ الفصلُ الذي بعده */
const upcoming = nextTerm(termOf(new Date()))
const target = nextTerm(upcoming)

async function mkCohort(title: string, profileId: string) {
  const first = new Date(Date.now() + 40 * DAY)
  first.setUTCHours(16, 0, 0, 0)
  const term = await prisma.term.upsert({
    where: { year_season: { year: upcoming.year, season: upcoming.season } },
    update: {},
    create: { year: upcoming.year, season: upcoming.season, titleAr: 'الفصل القادم', startsOn: new Date(), endsOn: new Date(Date.now() + 90 * DAY) },
  })
  const c = await prisma.cohort.create({
    data: {
      courseId: 'C-BIZ-101', title, status: 'open', capacity: 10, termId: term.id,
      startsAt: first, endsAt: new Date(first.getTime() + 7 * DAY), joinClosesAt: new Date(first.getTime() - DAY),
    },
  })
  await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead' } })
  await prisma.cohortSession.create({ data: { cohortId: c.id, title: 'اللقاء الأول', startsAt: first, endsAt: new Date(first.getTime() + 2 * 3_600_000) } })
  await prisma.cohortSession.create({ data: { cohortId: c.id, title: 'اللقاء الثاني', startsAt: new Date(first.getTime() + 7 * DAY) } })
  return c.id
}

let profileId = ''

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  svc = new CohortMoveService(prisma)

  trainerId = (await auth.register('move-trainer@test.local', 'Trainer#12345', 'مدرّب النقل')).userId
  await auth.setRoles(trainerId, ['trainer'])
  otherTrainerId = (await auth.register('move-other@test.local', 'Trainer#12345', 'مدرّب آخر')).userId
  await auth.setRoles(otherTrainerId, ['trainer'])
  adminId = (await auth.register('move-admin@test.local', 'Admin#12345', 'مدير الشعب')).userId
  await auth.setRoles(adminId, ['academic_manager'])
  learnerId = (await auth.register('move-learner@test.local', 'Learner#12345', 'متعلّم النقل')).userId

  const app = await prisma.trainerApplication.create({
    data: { reference: `TR-MOVE-${Date.now()}`, fullName: 'مدرّب النقل', email: 'move-trainer@test.local', status: 'active', motivation: 'اختبار', privacyConsentAt: new Date() },
  })
  profileId = (await prisma.trainerProfile.create({ data: { applicationId: app.id, userId: trainerId, isVerified: true } })).id
})

describe('① الطلب', () => {
  it('لا يحرّك موعدا — ويُحفظ فصلُها وأوّلُ لقاء', async () => {
    const cohortId = await mkCohort('شعبة الطلب', profileId)
    const before = await prisma.cohortSession.findMany({ where: { cohortId }, orderBy: { startsAt: 'asc' } })
    const r = await svc.request(trainerId, cohortId, { toYear: target.year, toSeason: target.season, reason: 'الطلب قليل هذا الفصل' })
    expect(r.status).toBe('pending')
    expect(r.fromSeason).toBe(upcoming.season)
    expect(r.fromStartsAt?.toISOString()).toBe(before[0]!.startsAt.toISOString())
    const after = await prisma.cohortSession.findMany({ where: { cohortId }, orderBy: { startsAt: 'asc' } })
    expect(after.map((s) => s.startsAt.toISOString())).toEqual(before.map((s) => s.startsAt.toISOString()))

    await expect(svc.request(trainerId, cohortId, { toYear: target.year, toSeason: target.season, reason: 'طلب ثان للشعبة نفسها' }))
      .rejects.toMatchObject({ status: 409 })
  })

  it('لا يُطلب لشعبةٍ ليست له — والحارسُ في الطريق نفسِه', async () => {
    const cohortId = await mkCohort('شعبة غيره', profileId)
    await expect(new EnrollmentService(prisma).assertCohortTrainer(otherTrainerId, cohortId)).rejects.toBeTruthy()
  })

  it('ولا إلى فصلها، ولا بلا سبب', async () => {
    const cohortId = await mkCohort('شعبة الرفض', profileId)
    await expect(svc.request(trainerId, cohortId, { toYear: upcoming.year, toSeason: upcoming.season, reason: 'إلى الفصل نفسه' }))
      .rejects.toThrow(/غير فصلها/)
    await expect(svc.request(trainerId, cohortId, { toYear: target.year, toSeason: target.season, reason: 'قصير' }))
      .rejects.toThrow(/السبب/)
  })
})

describe('② الاعتماد', () => {
  it('يزيح الشعبةَ ولقاءاتِها بأسابيعَ كاملة، ويربطها بفصلها، ويبلّغ المتعلّم', async () => {
    const cohortId = await mkCohort('شعبة الاعتماد', profileId)
    await prisma.enrollment.create({ data: { userId: learnerId, cohortId, status: 'enrolled' } })
    const newTerm = await prisma.term.upsert({
      where: { year_season: { year: target.year, season: target.season } }, update: {},
      create: { year: target.year, season: target.season, titleAr: 'الفصل الذي بعده', startsOn: new Date(), endsOn: new Date() },
    })
    const before = await prisma.cohortSession.findMany({ where: { cohortId }, orderBy: { startsAt: 'asc' } })
    const cBefore = await prisma.cohort.findUniqueOrThrow({ where: { id: cohortId } })
    const r = await svc.request(trainerId, cohortId, { toYear: target.year, toSeason: target.season, reason: 'الطلب قليل هذا الفصل' })

    const pending = await svc.pending()
    expect(pending.find((p) => p.id === r.id)?.learners).toBe(1)

    await svc.review(adminId, r.id, { action: 'approve' })
    const after = await prisma.cohortSession.findMany({ where: { cohortId }, orderBy: { startsAt: 'asc' } })
    const shift = after[0]!.startsAt.getTime() - before[0]!.startsAt.getTime()
    expect(shift).toBeGreaterThan(0)
    expect(shift % (7 * DAY), 'الإزاحة ليست أسابيع كاملة').toBe(0)
    after.forEach((s, i) => expect(s.startsAt.getTime() - before[i]!.startsAt.getTime()).toBe(shift))
    expect(after[0]!.endsAt!.getTime() - after[0]!.startsAt.getTime()).toBe(2 * 3_600_000)
    expect(termOf(after[0]!.startsAt)).toEqual(target)

    const c = await prisma.cohort.findUniqueOrThrow({ where: { id: cohortId } })
    expect(c.termId).toBe(newTerm.id)
    expect(c.startsAt!.getTime() - cBefore.startsAt!.getTime()).toBe(shift)
    expect(c.joinClosesAt!.getTime() - cBefore.joinClosesAt!.getTime()).toBe(shift)

    const bell = await prisma.notification.findFirst({ where: { userId: learnerId, channel: 'in_app' }, orderBy: { queuedAt: 'desc' } })
    expect(bell?.title).toContain('شعبة الاعتماد')
    expect(await prisma.cohortMoveRequest.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({ status: 'approved', reviewedBy: adminId })
    await expect(svc.review(adminId, r.id, { action: 'approve' })).rejects.toMatchObject({ status: 409 })
  })
})

describe('③ الردّ والسحب', () => {
  it('الردّ يبقي المواعيد ويصل المدرّب بتعليقه', async () => {
    const cohortId = await mkCohort('شعبة الردّ', profileId)
    const before = await prisma.cohortSession.findMany({ where: { cohortId }, orderBy: { startsAt: 'asc' } })
    const r = await svc.request(trainerId, cohortId, { toYear: target.year, toSeason: target.season, reason: 'الطلب قليل هذا الفصل' })
    await svc.review(adminId, r.id, { action: 'reject', comment: 'نحتاجها هذا الفصل' })
    const after = await prisma.cohortSession.findMany({ where: { cohortId }, orderBy: { startsAt: 'asc' } })
    expect(after.map((s) => s.startsAt.toISOString())).toEqual(before.map((s) => s.startsAt.toISOString()))
    const n = await prisma.notification.findFirst({ where: { userId: trainerId }, orderBy: { queuedAt: 'desc' } })
    expect(n?.body).toBe('نحتاجها هذا الفصل')
  })

  it('السحب من صاحبه وحده — ثمّ يُطلب من جديد', async () => {
    const cohortId = await mkCohort('شعبة السحب', profileId)
    const r = await svc.request(trainerId, cohortId, { toYear: target.year, toSeason: target.season, reason: 'الطلب قليل هذا الفصل' })
    await expect(svc.withdraw(otherTrainerId, r.id)).rejects.toMatchObject({ status: 404 })
    await svc.withdraw(trainerId, r.id)
    const again = await svc.request(trainerId, cohortId, { toYear: target.year, toSeason: target.season, reason: 'بعد السحب أطلب ثانية' })
    expect(again.status).toBe('pending')
  })
})
