/* حذفُ الشعب المتروكة بلا مدرّبٍ ولا متعلّم (١٨ أكتوبر ٢٠٢٦).

   سأل صاحبُ المنصّة: «ام هناك دورات بلا مدرب ويجب حذفها؟» — واختار «Delete permanently» لما بقي من شعبٍ
   فتحها `openAllCohorts` بلا مدرّب. تُصنع الشعبُ هنا بكلّ حالٍ قد تكون عليها في الإنتاج، وتُقرأ جملُ
   الترحيل من ملفّه **نفسِه** وتُنفَّذ عليها (على حذو `draft-trainerless-cohorts-migration`).

   ① القديمةُ بلا مدرّبٍ ولا متعلّم تُحذف — مسوّدةً أو ملغاةً أو مفتوحة — ومعها جلساتُها وخطّتُها ومهامُّها.
   ② وكلُّ أثرٍ لمتعلّمٍ أو مدرّبٍ يُبقيها — واحدا واحدا — ولا يُمسّ صفٌّ لغيرها.
   ③ ولا تُمسّ المنتهيةُ ولا ما أُنشئ بعد تقاعد الزرّ، والجملةُ تُعاد فلا تفسد. */

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

const statements = readFileSync(join(root, 'prisma/migrations/20261018090000_delete_trainerless_leftover_cohorts/migration.sql'), 'utf8')
  .split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n')
  .split(';').map((x) => x.trim()).filter(Boolean)
const migrate = async () => { for (const st of statements) await prisma.$executeRawUnsafe(st) }

const DAY = 86_400_000
/** قبل تقاعد الزرّ — حين فتح `openAllCohorts` شعبَه */
const OLD = new Date('2026-10-05T10:00:00.000Z')
let courseId = ''
let trainerId = ''
let learnerId = ''
let seq = 0

/** شعبةٌ على شكل ما فتحه `openAllCohorts`: جلسةٌ مبدئيّة، وخطّةٌ أساسيّةٌ بلا مدرّب، ومهمّة */
async function leftover(status: string, createdAt = OLD) {
  seq += 1
  return prisma.cohort.create({
    data: {
      courseId, title: `شعبة متروكة ${seq}`, status, registrationOpen: false, createdAt,
      capacity: 20, price: 150, currency: 'USD', financialReady: true,
      sessions: { create: { title: 'الجلسة 1', startsAt: new Date(Date.now() + 20 * DAY), placeholder: true } },
      plans: { create: { status: 'approved', content: { kind: 'baseline', notesAr: 'تقديمٌ عن بعد. المدرّبُ يُعيَّن قريبا.' } } },
      assessments: { create: { title: 'مهمّة', type: 'project', maxScore: 10 } },
    },
  })
}
const exists = async (id: string) => (await prisma.cohort.count({ where: { id } })) === 1

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  courseId = (await prisma.course.findFirstOrThrow({ where: { status: 'published' }, orderBy: { id: 'asc' } })).id
  trainerId = await fixtureTrainerId(prisma)
  learnerId = (await new AuthService(prisma).register('delete-mig-learner@test.local', 'Learner#12345', 'متعلّم')).userId
}, 240_000)

describe('① القديمةُ بلا مدرّبٍ ولا متعلّم تُحذف', () => {
  it('⚠️ المسوّدةُ والملغاةُ والمفتوحة — ومعها جلساتُها وخطّتُها ومهامُّها', async () => {
    const ids = await Promise.all(['draft', 'cancelled', 'open'].map(async (s) => (await leftover(s)).id))
    await migrate()
    for (const id of ids) expect(await exists(id), 'بقيت شعبة متروكة').toBe(false)
    expect(await prisma.cohortSession.count({ where: { cohortId: { in: ids } } })).toBe(0)
    expect(await prisma.cohortDeliveryPlan.count({ where: { cohortId: { in: ids } } })).toBe(0)
    expect(await prisma.cohortAssessment.count({ where: { cohortId: { in: ids } } })).toBe(0)
  })
})

describe('② وكلُّ أثرٍ لمتعلّمٍ أو مدرّبٍ يُبقيها', () => {
  const traces: [string, (cohortId: string) => Promise<unknown>][] = [
    ['تسجيلٌ ولو منسحبا', (cohortId) => prisma.enrollment.create({ data: { cohortId, userId: learnerId, status: 'dropped' } })],
    ['طلبُ تسجيل', (cohortId) => prisma.enrollmentRequest.create({ data: { cohortId, userId: learnerId } })],
    ['مدرّبٌ مسنَد', (cohortId) => prisma.cohortTrainer.create({ data: { cohortId, profileId: trainerId } })],
    ['خطّةُ مدرّبٍ ولو مسوّدة', (cohortId) => prisma.cohortDeliveryPlan.create({ data: { cohortId, trainerId, status: 'draft', content: { kind: 'trainer' } } })],
    ['تكليفُ مدرّب', (cohortId) => prisma.trainerCourseAssignment.create({ data: { cohortId, courseId, profileId: trainerId } })],
    ['عرضُ تدريس', (cohortId) => prisma.trainerAssignmentOffer.create({ data: { cohortId, courseId, profileId: trainerId, expiresAt: new Date(Date.now() + 7 * DAY) } })],
    ['طلبُ تغيير', (cohortId) => prisma.trainerChangeRequest.create({ data: { cohortId, courseId, profileId: trainerId, baseCourseVersion: 1, scope: 'cohort', reason: 'سبب' } })],
    ['رابطُ إحالة', (cohortId) => prisma.trainerReferralLink.create({ data: { cohortId, profileId: trainerId, code: `del-mig-${cohortId.slice(0, 8)}` } })],
    ['قاعدةُ أجر', (cohortId) => prisma.trainerCompensationRule.create({ data: { cohortId, profileId: trainerId, type: 'per_seat', rate: 10 } })],
  ]
  for (const [name, leave] of traces) {
    it(`⚠️ ${name}`, async () => {
      const c = await leftover('draft')
      await leave(c.id)
      await migrate()
      expect(await exists(c.id), `حُذفت وفيها ${name}`).toBe(true)
    })
  }
})

describe('③ ولا تُمسّ المنتهيةُ ولا الحديثة، والجملةُ تُعاد', () => {
  it('⚠️ المنتهيةُ وما أُنشئ بعد التقاعد باقيان — وإعادةُ الترحيل لا تغيّر شيئا', async () => {
    const done = await leftover('completed')
    const fresh = await leftover('draft', new Date('2026-10-12T09:00:00.000Z'))
    await migrate()
    await migrate()
    expect(await exists(done.id), 'حُذفت منتهية').toBe(true)
    expect(await exists(fresh.id), 'حُذفت مسوّدة حديثة').toBe(true)
  })
})
