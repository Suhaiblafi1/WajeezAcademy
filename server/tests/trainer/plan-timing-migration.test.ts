/* ترحيلُ خطط المدرّبين التي في أيديهم إلى مواعيدَ من لقاءاتها (١٧ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «خذ التوقيتَ من اللقاءات» — وما اعتُمد يبقى على مواعيده حتّى يُعدَّل.
   تُصنع الخططُ هنا بكلّ حالٍ قد تكون عليها في الإنتاج، وتُقرأ جملُ الترحيل من ملفّه **نفسِه**
   وتُنفَّذ عليها (على حذو `restore-c-comx-107-migration`).

   ① المسوّدةُ والمردودةُ إلى المدرّب: تُعلَّم وتسقط مواعيدُها — ويبقى ما سواها فيها.
   ② والمرسَلةُ والمعتمَدةُ والمنشورةُ والسابقة: كما هي.
   ③ وخطّةُ الإدارة وما ليس خطّةَ مدرّب: كما هي.
   ④ والجملُ تُعاد فلا تفسد. */

import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { fixtureTrainerId } from '../helpers/approved-trainer'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
let prisma: PrismaClient

const statements = readFileSync(join(root, 'prisma/migrations/20261017130000_plan_timing_from_meetings/migration.sql'), 'utf8')
  .split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n')
  .split(';').map((x) => x.trim()).filter(Boolean)
const migrate = async () => { for (const st of statements) await prisma.$executeRawUnsafe(st) }

const SLOTS = [{ startsOn: '2027-02-07', endsOn: '2027-02-13', moduleIds: ['M1'] }]
const trainerContent = { kind: 'trainer', summaryAr: 'خطّة', modules: [{ moduleId: 'M1', titleAr: 'محور' }], slots: SLOTS }
let cohortId = ''
let trainerId = ''

async function plan(status: string, content: object, byTrainer = true) {
  return prisma.cohortDeliveryPlan.create({
    data: { cohortId, status, content, ...(byTrainer ? { trainerId } : {}) },
  })
}
const contentOf = async (id: string) =>
  (await prisma.cohortDeliveryPlan.findUniqueOrThrow({ where: { id } })).content as Record<string, unknown>

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const course = await prisma.course.findFirstOrThrow({ select: { id: true } })
  cohortId = (await prisma.cohort.create({ data: { courseId: course.id, title: 'شعبة الترحيل', status: 'draft' } })).id
  trainerId = await fixtureTrainerId(prisma)
}, 240_000)

describe('① في يد المدرّب', () => {
  it('⚠️ المسوّدة والمردودة تُعلَّمان وتسقط مواعيدهما — ويبقى ما سواها', async () => {
    const ids = [(await plan('draft', trainerContent)).id, (await plan('changes_requested', trainerContent)).id]
    await migrate()
    for (const id of ids) {
      const c = await contentOf(id)
      expect(c.timing, 'لم تُعلَّم').toBe('meetings')
      expect('slots' in c, 'بقيت مواعيدها').toBe(false)
      expect(c.summaryAr).toBe('خطّة')
      expect(c.modules).toEqual([{ moduleId: 'M1', titleAr: 'محور' }])
    }
  })
})

describe('② وما خرج من يده كما هو', () => {
  it('⚠️ المرسلة والمعتمدة والمنشورة والسابقة على مواعيدها', async () => {
    const ids = await Promise.all(['submitted', 'approved', 'published', 'superseded'].map(async (s) => (await plan(s, trainerContent)).id))
    await migrate()
    for (const id of ids) expect(await contentOf(id), 'مُسّت خطّة خرجت من يده').toEqual(trainerContent)
  })
})

describe('③ وما ليس خطّة مدرّب', () => {
  it('⚠️ خطّة الإدارة، وخطّة بشكل خطّة المدرّب بلا مدرّب، وما لا نوع مدرّب له — كما هي', async () => {
    const baseline = { kind: 'baseline', notesAr: 'خطّة الإدارة', slots: SLOTS }
    const ids = [
      (await plan('draft', baseline, false)).id,
      (await plan('draft', trainerContent, false)).id,
      (await plan('draft', { kind: 'other', slots: SLOTS })).id,
    ]
    await migrate()
    expect(await contentOf(ids[0])).toEqual(baseline)
    expect(await contentOf(ids[1]), 'مُسّت خطّة بلا مدرّب').toEqual(trainerContent)
    expect(await contentOf(ids[2])).toEqual({ kind: 'other', slots: SLOTS })
  })
})

describe('④ والجمل تعاد', () => {
  it('إعادة الترحيل لا تغيّر شيئا', async () => {
    const id = (await plan('draft', trainerContent)).id
    await migrate()
    const once = await contentOf(id)
    await migrate()
    expect(await contentOf(id)).toEqual(once)
  })
})
