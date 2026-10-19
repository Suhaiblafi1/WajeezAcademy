/* لا شعبةَ بلا مدرّب — تُحذف كلُّها (١٩ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «الدورةُ من المدرّب ثمّ الدورة ثمّ الموادّ ثمّ أفتح. كلُّ شعبةٍ بلا مدرّبٍ تُحذف»، ثمّ
   «Delete only». تُصنع الشعبُ هنا بكلّ حالٍ قد تكون عليها في الإنتاج، وتُقرأ جملُ الترحيل من ملفّه **نفسِه**
   وتُنفَّذ عليها (على حذو `delete-trainerless-cohorts-migration`).

   ① كلُّ شعبةٍ بلا مدرّبٍ تُحذف — بأيّ حالٍ وتاريخ، ومنتهيةً — ومعها جلساتُها وخطّتُها ومهامُّها.
   ② والعرضُ الذي رُدّ أو انقضى لا يُبقيها — يبقى صفُّه وتُفرَغ شعبتُه.
   ③ وكلُّ أثرٍ لمتعلّمٍ أو لمدرّبٍ في الطريق يُبقيها — واحدا واحدا — والجملةُ تُعاد فلا تفسد. */

import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { fixtureTrainerId } from '../helpers/approved-trainer'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
let prisma: PrismaClient

const statements = readFileSync(join(root, 'prisma/migrations/20261019090000_delete_all_trainerless_cohorts/migration.sql'), 'utf8')
  .split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n')
  .split(';').map((x) => x.trim()).filter(Boolean)
const migrate = async () => { for (const st of statements) await prisma.$executeRawUnsafe(st) }

const DAY = 86_400_000
let courseId = ''
let trainerId = ''
let learnerId = ''
let seq = 0

/** شعبةٌ بلا مدرّب: جلسةٌ مبدئيّة، وخطّةٌ أساسيّةٌ بلا مدرّب، ومهمّة */
async function trainerless(status: string, createdAt = new Date()) {
  seq += 1
  return prisma.cohort.create({
    data: {
      courseId, title: `شعبة بلا مدرب ${seq}`, status, registrationOpen: false, createdAt,
      capacity: 20, price: 150, currency: 'USD', financialReady: true,
      sessions: { create: { title: 'الجلسة 1', startsAt: new Date(Date.now() + 20 * DAY), placeholder: true } },
      plans: { create: { status: 'approved', content: { kind: 'baseline', notesAr: 'خطة أساسية.' } } },
      assessments: { create: { title: 'مهمة', type: 'project', maxScore: 10 } },
    },
  })
}
const exists = async (id: string) => (await prisma.cohort.count({ where: { id } })) === 1
const offer = (cohortId: string, status: string) => prisma.trainerAssignmentOffer.create({
  data: { cohortId, courseId, profileId: trainerId, status, expiresAt: new Date(Date.now() + 7 * DAY) },
})

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  courseId = (await prisma.course.findFirstOrThrow({ where: { status: 'published' }, orderBy: { id: 'asc' } })).id
  trainerId = await fixtureTrainerId(prisma)
  learnerId = (await new AuthService(prisma).register('delete-all-mig-learner@test.local', 'Learner#12345', 'متعلم')).userId
}, 240_000)

describe('① كلُّ شعبةٍ بلا مدرّبٍ تُحذف', () => {
  it('⚠️ بأيّ حالٍ — مسوّدةً ومفتوحةً وجاريةً وملغاةً ومنتهية — ولو أُنشئت اليوم', async () => {
    const ids = await Promise.all(['draft', 'open', 'full', 'active', 'cancelled', 'completed'].map(async (s) => (await trainerless(s)).id))
    await migrate()
    for (const id of ids) expect(await exists(id), 'بقيت شعبة بلا مدرب').toBe(false)
    expect(await prisma.cohortSession.count({ where: { cohortId: { in: ids } } })).toBe(0)
    expect(await prisma.cohortDeliveryPlan.count({ where: { cohortId: { in: ids } } })).toBe(0)
    expect(await prisma.cohortAssessment.count({ where: { cohortId: { in: ids } } })).toBe(0)
  })

  it('⚠️ وشعبةٌ لها مدرّبٌ مسنَدٌ لا تُمسّ', async () => {
    const c = await trainerless('open')
    await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId: trainerId, role: 'lead' } })
    await migrate()
    expect(await exists(c.id), 'حذفت شعبة لها مدرب').toBe(true)
  })
})

describe('② والعرضُ الذي رُدّ أو انقضى لا يُبقيها', () => {
  for (const status of ['declined', 'lapsed', 'withdrawn']) {
    it(`⚠️ عرضٌ ${status} — تُحذف ويبقى صفُّه بلا شعبة`, async () => {
      const c = await trainerless('draft')
      const o = await offer(c.id, status)
      await migrate()
      expect(await exists(c.id), `بقيت وعرضها ${status}`).toBe(false)
      expect((await prisma.trainerAssignmentOffer.findUniqueOrThrow({ where: { id: o.id } })).cohortId).toBeNull()
    })
  }
})

describe('③ وكلُّ أثرٍ لمتعلّمٍ أو لمدرّبٍ في الطريق يُبقيها', () => {
  const traces: [string, (cohortId: string) => Promise<unknown>][] = [
    ['تسجيلٌ ولو منسحبا', (cohortId) => prisma.enrollment.create({ data: { cohortId, userId: learnerId, status: 'dropped' } })],
    ['طلبُ تسجيل', (cohortId) => prisma.enrollmentRequest.create({ data: { cohortId, userId: learnerId } })],
    ['عرضُ تدريسٍ ينتظر جوابَه', (cohortId) => offer(cohortId, 'offered')],
    ['خطّةُ مدرّبٍ ولو مسوّدة', (cohortId) => prisma.cohortDeliveryPlan.create({ data: { cohortId, trainerId, status: 'draft', content: { kind: 'trainer' } } })],
    ['تكليفُ مدرّب', (cohortId) => prisma.trainerCourseAssignment.create({ data: { cohortId, courseId, profileId: trainerId } })],
    ['طلبُ تغيير', (cohortId) => prisma.trainerChangeRequest.create({ data: { cohortId, courseId, profileId: trainerId, baseCourseVersion: 1, scope: 'cohort', reason: 'سبب' } })],
    ['طلبُ نقلٍ إلى موسم', (cohortId) => prisma.cohortMoveRequest.create({ data: { cohortId, requestedBy: learnerId, toYear: 2027, toSeason: 'feb_apr', reason: 'سبب' } })],
    ['رابطُ إحالة', (cohortId) => prisma.trainerReferralLink.create({ data: { cohortId, profileId: trainerId, code: `del-all-${cohortId.slice(0, 8)}` } })],
    ['قاعدةُ أجر', (cohortId) => prisma.trainerCompensationRule.create({ data: { cohortId, profileId: trainerId, type: 'per_seat', rate: 10 } })],
  ]
  for (const [name, leave] of traces) {
    it(`⚠️ ${name}`, async () => {
      const c = await trainerless('draft')
      await leave(c.id)
      await migrate()
      expect(await exists(c.id), `حُذفت وفيها ${name}`).toBe(true)
    })
  }

  it('والجملةُ تُعاد فلا تفسد', async () => {
    const keep = await trainerless('open')
    await prisma.enrollment.create({ data: { cohortId: keep.id, userId: learnerId, status: 'enrolled' } })
    await migrate()
    await migrate()
    expect(await exists(keep.id)).toBe(true)
  })
})
