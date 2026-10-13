/* ترحيلُ الشعب الافتراضيّة بلا مدرّبٍ ولا متعلّم إلى المسوّدة (١٣ أكتوبر ٢٠٢٦).

   سأل صاحبُ المنصّة عن «جلسات هذا الأسبوع بلا مدرّب أو بلا رابط» — تسعُ جلساتٍ من شعبٍ
   فتحها `openAllCohorts` بلا مدرّب، أخفاها #508 وبقيت حالتُها «مفتوحة». وقرارُه: تعود مسوّدة.

   تُصنع الشعبُ هنا بكلّ حالٍ قد تكون عليها في الإنتاج، وتُقرأ جملُ الترحيل من ملفّه
   **نفسِه** وتُنفَّذ عليها (على حذو `restore-c-comx-107-migration`).

   ① شعبةٌ بلا مدرّبٍ ولا متعلّم — مفتوحةً أو ممتلئةً أو جارية — تعود مسوّدةً بعلمٍ مُنزَل،
      وجلساتُها وسعرُها وخطّتُها الأساسيّةُ باقية.
   ② وكلُّ أثرٍ لمتعلّمٍ أو مدرّبٍ يُبقيها كما هي — واحدا واحدا.
   ③ ولا تُمسّ مسوّدةٌ ولا منتهيةٌ ولا ملغاة، والجملُ تُعاد فلا تفسد.
   ④ و«ما ينتظرك» لا يعدّ جلساتِها بعده — ويعدّ شعبةً فيها متعلّمٌ بلا مدرّب. */

import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { StaffInboxService } from '../../services/staff-inbox.service'
import { fixtureTrainerId } from '../helpers/approved-trainer'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
let prisma: PrismaClient

const statements = readFileSync(join(root, 'prisma/migrations/20261013090000_draft_trainerless_default_cohorts/migration.sql'), 'utf8')
  .split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n')
  .split(';').map((x) => x.trim()).filter(Boolean)
const migrate = async () => { for (const st of statements) await prisma.$executeRawUnsafe(st) }

const DAY = 86_400_000
let courseId = ''
let trainerId = ''
let learnerId = ''
let seq = 0

/** شعبةٌ على شكل ما فتحه `openAllCohorts`: جلسةٌ مبدئيّةٌ هذا الأسبوع وخطّةٌ أساسيّةٌ بلا مدرّب */
async function defaultCohort(status: string, inDays = 2) {
  seq += 1
  return prisma.cohort.create({
    data: {
      courseId, title: `شعبة افتراضية ${seq}`, status, registrationOpen: status !== 'draft',
      capacity: 20, price: 150, currency: 'USD', financialReady: true,
      sessions: { create: { title: 'الجلسة 1', startsAt: new Date(Date.now() + inDays * DAY), placeholder: true } },
      plans: { create: { status: 'approved', content: { kind: 'basic' } } },
    },
  })
}

const statusOf = async (id: string) =>
  (await prisma.cohort.findUniqueOrThrow({ where: { id }, select: { status: true } })).status

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  courseId = (await prisma.course.findFirstOrThrow({ where: { status: 'published' }, orderBy: { id: 'asc' } })).id
  trainerId = await fixtureTrainerId(prisma)
  learnerId = (await new AuthService(prisma).register('draft-mig-learner@test.local', 'Learner#12345', 'متعلّم')).userId
}, 240_000)

describe('① بلا مدرّبٍ ولا متعلّم — تعود مسوّدة', () => {
  it('⚠️ المفتوحةُ والممتلئةُ والجارية — بعلمٍ مُنزَل، ولا يُمحى منها شيء', async () => {
    const ids = await Promise.all(['open', 'full', 'active'].map(async (s) => (await defaultCohort(s)).id))
    await migrate()
    for (const id of ids) {
      const c = await prisma.cohort.findUniqueOrThrow({
        where: { id }, include: { sessions: true, plans: true },
      })
      expect(c.status, `بقيت ${c.title} على حالها`).toBe('draft')
      expect(c.registrationOpen).toBe(false)
      expect(c.sessions).toHaveLength(1)
      expect(c.plans).toHaveLength(1)
      expect(Number(c.price)).toBe(150)
    }
  })
})

describe('② وكلُّ أثرٍ لمتعلّمٍ أو مدرّبٍ يُبقيها', () => {
  const traces: [string, (cohortId: string) => Promise<unknown>][] = [
    ['تسجيلٌ ولو منسحبا', (cohortId) => prisma.enrollment.create({ data: { cohortId, userId: learnerId, status: 'dropped' } })],
    ['طلبُ تسجيل', (cohortId) => prisma.enrollmentRequest.create({ data: { cohortId, userId: learnerId } })],
    ['مدرّبٌ مسنَد', (cohortId) => prisma.cohortTrainer.create({ data: { cohortId, profileId: trainerId } })],
    ['خطّةُ مدرّبٍ مرسَلة', (cohortId) => prisma.cohortDeliveryPlan.create({ data: { cohortId, trainerId, status: 'submitted', content: { kind: 'trainer' } } })],
    ['تكليفُ مدرّب', (cohortId) => prisma.trainerCourseAssignment.create({ data: { cohortId, courseId, profileId: trainerId } })],
    ['عرضُ تدريس', (cohortId) => prisma.trainerAssignmentOffer.create({ data: { cohortId, courseId, profileId: trainerId, expiresAt: new Date(Date.now() + 7 * DAY) } })],
  ]
  for (const [name, leave] of traces) {
    it(`⚠️ ${name}`, async () => {
      const c = await defaultCohort('open')
      await leave(c.id)
      await migrate()
      expect(await statusOf(c.id), `أُعيدت مسوّدةً وفيها ${name}`).toBe('open')
    })
  }
})

describe('③ ولا يُمسّ ما ليس مفتوحا، والجملُ تُعاد', () => {
  it('المسوّدةُ والمنتهيةُ والملغاةُ على حالها — وإعادةُ الترحيل لا تغيّر شيئا', async () => {
    const kept = await Promise.all(['draft', 'completed', 'cancelled'].map(async (s) => ({ s, id: (await defaultCohort(s)).id })))
    await migrate()
    await migrate()
    for (const { s, id } of kept) expect(await statusOf(id)).toBe(s)
  })
})

describe('④ و«ما ينتظرك» بعده', () => {
  it('⚠️ لا يعدّ جلساتِ الشعبة الافتراضيّة — ويعدّ شعبةً فيها متعلّمٌ بلا مدرّب', async () => {
    /* غدا — قبل جلسات ما سبق، فتكونان أوّلَ ما يُعرض من العيّنة */
    const empty = await defaultCohort('open', 1)
    const taken = await defaultCohort('open', 1)
    await prisma.enrollment.create({ data: { cohortId: taken.id, userId: learnerId } })
    await migrate()

    const items = await new StaffInboxService(prisma).forStaff(learnerId, ['cohort.manage'])
    const sample = items.find((i) => i.key === 'sessions_at_risk')?.sample ?? []
    expect(sample.some((s) => s.startsWith(`${empty.title} — `)), 'بقيت جلسةُ شعبةٍ افتراضيّةٍ في التنبيه').toBe(false)
    expect(sample.some((s) => s.startsWith(`${taken.title} — `)), 'سقطت شعبةٌ فيها متعلّمٌ من التنبيه').toBe(true)
  })
})
