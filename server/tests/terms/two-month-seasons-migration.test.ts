/* شهران عملٌ وشهرٌ راحة — ترحيلُ الفصول يومَ القرار (٢١ نوفمبر ٢٠٢٦). تُقرأ جملُه من ملفّه **نفسِه**.

   ① فصلُ ربيع ٢٠٢٧ يُنشأ بحدوده واسمه كما يحسبهما `termBounds` و`termTitleAr` — وما كان قائما لا يُمسّ، والجملةُ تُعاد فلا تفسد.
   ② وفصلُ التقويم القديم بعد آخر يناير ٢٠٢٧ يُلغى إن كان فارغا مخطَّطا لم يُنشر.
   ③ وما فيه شعبةٌ أو مسارُ مدرّب، أو نُشر تقويمُه، أو فُتح — يبقى كما هو. وما قبل الحدّ (شتاء ٢٠٢٦/٢٠٢٧) لا يُمسّ. */

import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { termBounds, termTitleAr } from '../../../src/application/terms/season'
import type { TrainingSeason } from '../../../src/application/trainer/application-options'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
let prisma: PrismaClient
const statements = readFileSync(join(root, 'prisma/migrations/20261121130000_two_month_seasons/migration.sql'), 'utf8')
  .split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n')
  .split(';').map((x) => x.trim()).filter(Boolean)
const migrate = async () => { for (const st of statements) await prisma.$executeRawUnsafe(st) }

const STAMP = Date.now()
const term = (year: number, season: TrainingSeason, extra: { status?: string; calendarPublishedAt?: Date } = {}) => {
  const { startsOn, endsOn } = termBounds(year, season)
  return prisma.term.create({ data: { year, season, titleAr: termTitleAr(year, season), startsOn, endsOn, ...extra } })
}
const status = async (id: string) => (await prisma.term.findUniqueOrThrow({ where: { id } })).status
const day = (d: Date) => d.toISOString().slice(0, 10)

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  await prisma.term.deleteMany({ where: { year: { in: [2093, 2094, 2095] } } })
}, 240_000)

describe('① فصل ربيع 2027', () => {
  it('⚠️ ينشأ مخطّطا بحدوده واسمه — من 1 أبريل إلى 31 مايو', async () => {
    await prisma.cohort.updateMany({ where: { term: { year: 2027, season: 'apr_may' } }, data: { termId: null } })
    await prisma.trainerPath.updateMany({ where: { term: { year: 2027, season: 'apr_may' } }, data: { termId: null } })
    await prisma.term.deleteMany({ where: { year: 2027, season: 'apr_may' } })
    await migrate()
    const t = await prisma.term.findUniqueOrThrow({ where: { year_season: { year: 2027, season: 'apr_may' } } })
    const b = termBounds(2027, 'apr_may')
    expect(day(t.startsOn)).toBe('2027-04-01')
    expect(day(t.endsOn)).toBe('2027-05-31')
    expect(day(t.startsOn)).toBe(day(b.startsOn))
    expect(day(t.endsOn)).toBe(day(b.endsOn))
    expect(t.titleAr).toBe(termTitleAr(2027, 'apr_may'))
    expect(t.status).toBe('planned')
  })

  it('والقائم لا يمسّ — والجملة تعاد فلا تفسد', async () => {
    await prisma.term.update({ where: { year_season: { year: 2027, season: 'apr_may' } }, data: { titleAr: 'ربيع سمته الإدارة' } })
    await migrate()
    await migrate()
    const rows = await prisma.term.findMany({ where: { year: 2027, season: 'apr_may' } })
    expect(rows).toHaveLength(1)
    expect(rows[0]!.titleAr).toBe('ربيع سمته الإدارة')
  })
})

describe('② و③ فصول التقويم القديم بعد يناير 2027', () => {
  it('⚠️ الفارغ المخطّط الذي لم ينشر يلغى', async () => {
    const empty = await term(2093, 'feb_apr')
    const winter = await term(2093, 'nov_jan')
    await migrate()
    expect(await status(empty.id)).toBe('cancelled')
    expect(await status(winter.id)).toBe('cancelled')
  })

  it('⚠️ وما فيه شعبة أو مسار مدرب أو نشر تقويمه أو فتح يبقى كما هو', async () => {
    const course = await prisma.course.findFirstOrThrow({ where: { status: 'published' }, select: { id: true } })
    const withCohort = await term(2094, 'feb_apr')
    await prisma.cohort.create({ data: { courseId: course.id, title: `شعبة التقويم القديم ${STAMP}`, status: 'draft', termId: withCohort.id } })

    const withPath = await term(2094, 'may_jul')
    const app = await prisma.trainerApplication.create({
      data: { reference: `TR-2M-${STAMP}`, fullName: 'مدرب المواسم', email: `2m-${STAMP}@test.local`, status: 'active', motivation: 'اختبار', privacyConsentAt: new Date() },
    })
    const profile = await prisma.trainerProfile.create({ data: { applicationId: app.id, isVerified: true } })
    await prisma.trainerPath.create({ data: { profileId: profile.id, titleAr: 'مسار الموسم', termId: withPath.id } })

    const published = await term(2094, 'aug_oct', { calendarPublishedAt: new Date() })
    const opened = await term(2095, 'feb_apr', { status: 'open' })
    await migrate()
    expect(await status(withCohort.id)).toBe('planned')
    expect(await status(withPath.id)).toBe('planned')
    expect(await status(published.id)).toBe('planned')
    expect(await status(opened.id)).toBe('open')
  })

  it('⚠️ وما قبل الحد لا يمس — شتاء 2026/2027 يجري، والجديد لا يلغى', async () => {
    const before = await prisma.term.upsert({
      where: { year_season: { year: 2026, season: 'nov_jan' } },
      update: {},
      create: { year: 2026, season: 'nov_jan', titleAr: termTitleAr(2026, 'nov_jan'), ...termBounds(2026, 'nov_jan') },
    })
    const statusBefore = before.status
    const fresh = await term(2095, 'jul_aug')
    await migrate()
    expect(await status(before.id)).toBe(statusBefore)
    expect(await status(fresh.id)).toBe('planned')
  })
})
