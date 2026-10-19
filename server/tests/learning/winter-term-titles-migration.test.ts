/* الشتاءُ بسنتيه — ترحيلُ أسماء الفصول المحفوظة (١٩ أكتوبر ٢٠٢٦).

   «موسم الشتاء 2027» كان يعني نوفمبر 2027 إلى يناير 2028 ويُقرأ شتاءَ أوّل 2027، فنُقلت شعبةٌ سنةً كاملة. وصار
   `termTitleAr` يسمّيه بسنتيه، وما حُفظ بالاسم الآليّ القديم يُعاد بالترحيل. تُقرأ جملُه من ملفّه **نفسِه**.
   ① الشتاءُ بالاسم الآليّ القديم يصير بسنتيه. ② وما سمّته الإدارةُ بيدها، وغيرُ الشتاء، لا يُمسّ. ③ والجملةُ تُعاد فلا تفسد. */

import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { termTitleAr } from '../../../src/application/terms/season'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
let prisma: PrismaClient
const statements = readFileSync(join(root, 'prisma/migrations/20261019200000_winter_term_titles/migration.sql'), 'utf8')
  .split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n')
  .split(';').map((x) => x.trim()).filter(Boolean)
const migrate = async () => { for (const st of statements) await prisma.$executeRawUnsafe(st) }

const term = (year: number, season: string, titleAr: string) => prisma.term.create({
  data: { year, season, titleAr, startsOn: new Date(`${year}-01-01`), endsOn: new Date(`${year}-03-01`) },
})
const title = async (id: string) => (await prisma.term.findUniqueOrThrow({ where: { id } })).titleAr

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
}, 240_000)

describe('أسماء فصول الشتاء المحفوظة', () => {
  it('⚠️ ① الشتاء بالاسم الآلي القديم يصير بسنتيه — كما يسميه termTitleAr', async () => {
    const t = await term(2088, 'nov_jan', 'موسم الشتاء 2088')
    await migrate()
    expect(await title(t.id)).toBe('موسم الشتاء 2088/2089')
    expect(await title(t.id)).toBe(termTitleAr(2088, 'nov_jan'))
  })

  it('② وما سمته الإدارة بيدها، وغير الشتاء، لا يمس', async () => {
    const custom = await term(2089, 'nov_jan', 'شتاء التجربة')
    const spring = await term(2090, 'feb_apr', 'موسم الربيع 2090')
    await migrate()
    expect(await title(custom.id)).toBe('شتاء التجربة')
    expect(await title(spring.id)).toBe('موسم الربيع 2090')
  })

  it('③ والجملة تعاد فلا تفسد', async () => {
    const t = await term(2091, 'nov_jan', 'موسم الشتاء 2091')
    await migrate()
    await migrate()
    expect(await title(t.id)).toBe('موسم الشتاء 2091/2092')
  })
})
