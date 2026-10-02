/* اسمُ الشعبة الافتراضيّ: «اسمُ الدورة — شعبة N» (٢ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: الشعبةُ تُسمّى باسم دورتها ورقمِها فيها. وما يُقاس هنا
   على صفوف القاعدة:

   ① بلا اسمٍ تُسمّى باسم دورتها ورقمِها، والرقمُ لكلّ دورةٍ على حدة.
   ② والرقمُ لا يُعاد: يتخطّى أكبرَ رقمٍ في أسماء شعب الدورة، ويَعُدّ ما
      سُمّي بيدٍ وما أُلغي.
   ③ والاسمُ المكتوبُ بيدٍ يبقى كما كُتب.
   ④ والنسخةُ تُرقَّم كغيرها.
   ⑤ وترحيلُ المسوّدات القائمة يمسّ المسوّدةَ الفارغةَ وحدَها: ما فيه متعلّمٌ
      أو فُتح يبقى باسمه — يُشغَّل ملفُّ الترحيل نفسُه على صفوفٍ هنا. */

import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CohortService } from '../../services/cohort.service'

let prisma: PrismaClient
let cohorts: CohortService
let actorId = ''
const A = 'C-NAME-101'
const B = 'C-NAME-202'
const M = 'C-NAME-303'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  cohorts = new CohortService(prisma)
  const auth = new AuthService(prisma)
  actorId = (await auth.register('name-admin@test.local', 'Admin#12345', 'مدير')).userId
  for (const [id, t] of [[A, 'دورةُ الأسماء'], [B, 'دورةٌ ثانية'], [M, 'دورةُ الترحيل']] as const) {
    await prisma.course.create({ data: { id, status: 'published', currentVersion: 2 } })
    await prisma.courseVersion.create({ data: { courseId: id, version: 1, titleAr: `${t} القديمة`, totalHours: 10 } })
    await prisma.courseVersion.create({ data: { courseId: id, version: 2, titleAr: t, totalHours: 10 } })
  }
}, 240_000)

describe('اسمُ الشعبة الافتراضيّ', () => {
  it('① باسم الدورة الجاري ورقمِها فيها — ولكلّ دورةٍ عدُّها', async () => {
    const one = await cohorts.create(actorId, { courseId: A })
    const two = await cohorts.create(actorId, { courseId: A })
    const other = await cohorts.create(actorId, { courseId: B })
    expect(one.title).toBe('دورةُ الأسماء — شعبة ١')
    expect(two.title).toBe('دورةُ الأسماء — شعبة ٢')
    expect(other.title).toBe('دورةٌ ثانية — شعبة ١')
  })

  it('② والرقمُ لا يُعاد — يتخطّى أكبرَ رقمٍ ويَعُدّ المسمّى بيدٍ والملغى', async () => {
    await prisma.cohort.create({ data: { courseId: A, title: 'دورةُ الأسماء — شعبة ٧', status: 'cancelled' } })
    expect(await cohorts.nextTitle(A)).toBe('دورةُ الأسماء — شعبة ٨')

    await prisma.cohort.create({ data: { courseId: B, title: 'مساءُ الأحد', status: 'draft' } })
    await prisma.cohort.create({ data: { courseId: B, title: 'صباحُ السبت', status: 'cancelled' } })
    expect(await cohorts.nextTitle(B)).toBe('دورةٌ ثانية — شعبة ٤')
  })

  it('③ والمكتوبُ بيدٍ يبقى', async () => {
    const c = await cohorts.create(actorId, { courseId: B, title: 'شعبةُ رمضان' })
    expect(c.title).toBe('شعبةُ رمضان')
  })

  it('④ والنسخةُ تُرقَّم', async () => {
    const before = await cohorts.nextTitle(A)
    const src = await prisma.cohort.findFirstOrThrow({ where: { courseId: A, title: 'دورةُ الأسماء — شعبة ١' } })
    const copy = await cohorts.duplicate(actorId, src.id, {})
    expect(copy.title).toBe(before)
  })
})

describe('⑤ ترحيلُ المسوّدات القائمة', () => {
  it('يسمّي المسوّدةَ الفارغة، ولا يمسّ ما فيه متعلّمٌ ولا ما فُتح', async () => {
    const mk = (title: string, status: string, at: string) =>
      prisma.cohort.create({ data: { courseId: M, title, status, createdAt: new Date(at) } })
    const first = await mk('الإقناع — ديسمبر', 'open', '2026-01-01T00:00:00Z')
    const empty = await mk('الدفعة الأولى', 'draft', '2026-02-01T00:00:00Z')
    const seated = await mk('الشعبة الأولى', 'draft', '2026-03-01T00:00:00Z')
    const learner = await new AuthService(prisma).register('name-learner@test.local', 'Pass#12345', 'متعلّم')
    await prisma.enrollment.create({ data: { cohortId: seated.id, userId: learner.userId } })

    const sql = readFileSync(join(__dirname, '../../../prisma/migrations/20261002200000_cohort_default_titles/migration.sql'), 'utf8')
    await prisma.$executeRawUnsafe(sql.split('\n').filter((l) => !l.startsWith('--')).join('\n'))

    const read = async (id: string) => (await prisma.cohort.findUniqueOrThrow({ where: { id } })).title
    expect(await read(empty.id)).toBe('دورةُ الترحيل — شعبة ٢')
    expect(await read(first.id)).toBe('الإقناع — ديسمبر')
    expect(await read(seated.id)).toBe('الشعبة الأولى')
    /* والتاليةُ بعدها لا تأخذ رقما قائما */
    expect(await cohorts.nextTitle(M)).toBe('دورةُ الترحيل — شعبة ٤')
  })
})
