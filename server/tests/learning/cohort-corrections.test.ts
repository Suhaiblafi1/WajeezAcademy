/* تصحيحُ شعبةٍ نُقلت سنةً كاملة باسم موسمٍ ملتبس — مرّةً واحدة (١٩ أكتوبر ٢٠٢٦).

   «استراتيجية التسعير — شعبة ٤» نُقلت إلى «موسم الشتاء 2027» على أنّه الشتاءُ القادم، فصار أوّلُ لقائها بعد سنة. واختار
   صاحبُ المنصّة نقلَها إلى الشتاء القادم. والتصحيحُ يمرّ بالنقل نفسِه (`staffMove`) ويُشترط له موعدُها المنقولُ إليه خطأ.

   ① تنتقل إلى الفصل المختار بأسابيعَ كاملة، وتُربط به، ويصل مدرّبتَها خبرُها — باسم من اعتمد النقلَ الأوّل.
   ② ولا يقع مرّتين: دورةٌ ثانيةٌ لا تجد ما تصحّحه.
   ③ وما نقلته الإدارةُ بعده إلى فصلٍ آخر لا يُردّ إلى الشتاء — فالشرطُ موعدُها المنقولُ إليه خطأ، لا فصلُها. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { applyCohortCorrections, type CohortCorrection } from '../../worker/jobs'
import { CohortMoveService } from '../../services/cohort-move.service'
import { nextTerm } from '../../../src/application/trainer/cohort-move'
import { termBounds, termOf } from '../../../src/application/terms/season'

const DAY = 86_400_000
let prisma: PrismaClient
let adminId = ''
let trainerUserId = ''
let cohortId = ''
let list: CohortCorrection[] = []
const upcoming = nextTerm(termOf(new Date()))
/* الموسمُ نفسُه بعد سنة — كما وقع: «الشتاء 2027» بدل الشتاء القادم */
const yearLater = nextTerm(nextTerm(nextTerm(nextTerm(upcoming))))

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  adminId = (await auth.register('correct-admin@test.local', 'Admin#12345', 'صاحب المنصة')).userId
  await auth.setRoles(adminId, ['academic_manager'])
  trainerUserId = (await auth.register('correct-trainer@test.local', 'Trainer#12345', 'مدربة التسعير')).userId
  const app = await prisma.trainerApplication.create({
    data: { reference: `TR-CORR-${Date.now()}`, fullName: 'مدربة التسعير', email: 'correct-trainer@test.local', status: 'active', motivation: 'اختبار', privacyConsentAt: new Date() },
  })
  const profileId = (await prisma.trainerProfile.create({ data: { applicationId: app.id, userId: trainerUserId, isVerified: true } })).id

  const first = new Date(termBounds(yearLater.year, yearLater.season).startsOn.getTime() + 29 * DAY)
  first.setUTCHours(15, 0, 0, 0)
  const c = await prisma.cohort.create({
    data: { courseId: 'C-BIZ-104', title: 'استراتيجية التسعير — شعبة ٤', status: 'open', capacity: 20, startsAt: first, endsAt: new Date(first.getTime() + 18 * DAY) },
  })
  cohortId = c.id
  await prisma.cohortTrainer.create({ data: { cohortId, profileId, role: 'lead' } })
  await prisma.cohortSession.create({ data: { cohortId, title: 'اللقاء الأول', startsAt: first, endsAt: new Date(first.getTime() + 2 * 3_600_000) } })
  await prisma.cohortSession.create({ data: { cohortId, title: 'اللقاء الثاني', startsAt: new Date(first.getTime() + 5 * DAY) } })
  /* والنقلُ الأوّلُ الذي اعتمده صاحبُ المنصّة — وباسمه يُكتب التصحيح */
  await prisma.cohortMoveRequest.create({
    data: { cohortId, requestedBy: trainerUserId, toYear: yearLater.year, toSeason: yearLater.season, reason: 'نقل إلى الشتاء', status: 'approved', reviewedBy: adminId, reviewedAt: new Date() },
  })
  list = [{ cohortId, firstAt: first.toISOString(), to: upcoming, reasonAr: 'نقلت باسم ملتبس، ومقصودها الشتاء القادم — بقرار صاحب المنصة.' }]
}, 240_000)

describe('تصحيح شعبة نقلت سنة كاملة', () => {
  it('⚠️ ① تنتقل إلى الفصل المختار بأسابيع كاملة، وتربط به، ويصل مدربتها خبرها', async () => {
    const before = await prisma.cohortSession.findMany({ where: { cohortId }, orderBy: { startsAt: 'asc' } })
    const r = await applyCohortCorrections(prisma, list)
    expect(r.done).toBe(1)
    const after = await prisma.cohortSession.findMany({ where: { cohortId }, orderBy: { startsAt: 'asc' } })
    expect(termOf(after[0]!.startsAt), 'لم تقع في الفصل المختار').toEqual(upcoming)
    const shift = after[0]!.startsAt.getTime() - before[0]!.startsAt.getTime()
    expect(shift, 'لم تعد إلى الوراء').toBeLessThan(0)
    expect(Math.abs(shift) % (7 * DAY), 'الإزاحة ليست أسابيع كاملة').toBe(0)
    after.forEach((s, i) => expect(s.startsAt.getTime() - before[i]!.startsAt.getTime()).toBe(shift))
    const c = await prisma.cohort.findUniqueOrThrow({ where: { id: cohortId }, select: { term: { select: { year: true, season: true } } } })
    expect(c.term).toEqual(upcoming)
    const moved = await prisma.cohortMoveRequest.findFirstOrThrow({ where: { cohortId, requestedBy: adminId } })
    expect(moved).toMatchObject({ status: 'approved', reviewedBy: adminId, toYear: upcoming.year, toSeason: upcoming.season })
    const bell = await prisma.notification.findFirst({ where: { userId: trainerUserId, title: { contains: 'نقلت الإدارة' } } })
    expect(bell, 'لم يصل المدربة خبر').toBeTruthy()
  })

  it('⚠️ ② ولا يقع مرتين', async () => {
    const before = await prisma.cohortSession.findMany({ where: { cohortId }, orderBy: { startsAt: 'asc' } })
    const r = await applyCohortCorrections(prisma, list)
    expect(r).toMatchObject({ done: 0, failed: 0 })
    const after = await prisma.cohortSession.findMany({ where: { cohortId }, orderBy: { startsAt: 'asc' } })
    expect(after.map((s) => s.startsAt.toISOString())).toEqual(before.map((s) => s.startsAt.toISOString()))
  })

  it('⚠️ ③ وما نقلته الإدارة بعده إلى فصل آخر لا يرد إلى الشتاء', async () => {
    const later = nextTerm(upcoming)
    await new CohortMoveService(prisma).staffMove(adminId, cohortId, { toYear: later.year, toSeason: later.season, reason: 'طلبت المدربة نقلها إلى الفصل الذي يليه لظرف عائلي' })
    const before = await prisma.cohortSession.findMany({ where: { cohortId }, orderBy: { startsAt: 'asc' } })
    expect(termOf(before[0]!.startsAt)).toEqual(later)
    const r = await applyCohortCorrections(prisma, list)
    expect(r).toMatchObject({ done: 0, failed: 0 })
    const after = await prisma.cohortSession.findMany({ where: { cohortId }, orderBy: { startsAt: 'asc' } })
    expect(after.map((s) => s.startsAt.toISOString()), 'ردها التصحيح إلى الشتاء').toEqual(before.map((s) => s.startsAt.toISOString()))
  })
})
