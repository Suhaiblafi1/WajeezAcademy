/* ترحيلُ محتوى C-COMX-107 من خطّة مدرّبها المعتمَدة (٢٦ أكتوبر ٢٠٢٦).

   «دورة إعداد المعلمين، لماذا لا يوجد لها محاور وتفاصيل أخرى كباقي الدورات؟ فهي فارغةٌ من الداخل» (صاحب المنصّة).
   تُصنع الدورةُ هنا كما هي في الإنتاج — وحدةٌ مؤقّتةٌ واحدة («اعداد القادة») بلا وصفٍ ولا أهداف — وتُقرأ جملُ الترحيل
   من ملفّه **نفسِه** وتُنفَّذ عليها (على حذو `restore-c-comx-107-migration.test.ts`).

   ① تصير ثماني وحداتٍ منشورةٍ بعناوين الخطّة ومخرَجٍ ونشاطٍ ودليلٍ لكلٍّ، بساعتين — والمجموعُ ١٦ كما هي.
   ② ويُكتب الوعدُ والوصفُ والجمهورُ والمستوى والأهدافُ والمخرجات.
   ③ وما كتبه إنسانٌ في اللوحة لا يُمسّ: وصفٌ قائمٌ يبقى، ووحدةٌ أولى غيرُ المؤقّتة تبقى، وأهدافٌ قائمةٌ لا يُضاف إليها.
   ④ وتُعاد الجملُ فلا تفسد.
   ⑤ ولا شيء بلا الدورة.
   ⑥ وما يُكتب بلا تشكيلٍ إعرابيّ — نصٌّ يراه المشتري. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const FILE = readFileSync(join(root, 'prisma/migrations/20261026120000_c_comx_107_content/migration.sql'), 'utf8')
const statements = FILE.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n')
  .split(';').map((x) => x.trim()).filter(Boolean)
let prisma: PrismaClient
const migrate = async () => { for (const st of statements) await prisma.$executeRawUnsafe(st) }
const ID = 'C-COMX-107'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
}, 240_000)

afterAll(async () => { await wipe() })

async function wipe() {
  await prisma.learningObjective.deleteMany({ where: { courseVersion: { courseId: ID } } })
  await prisma.learningOutcome.deleteMany({ where: { courseVersion: { courseId: ID } } })
  await prisma.courseModuleVersion.deleteMany({ where: { module: { courseId: ID } } })
  await prisma.courseModule.deleteMany({ where: { courseId: ID } })
  await prisma.courseVersion.deleteMany({ where: { courseId: ID } })
  await prisma.course.deleteMany({ where: { id: ID } })
}

/** الدورةُ كما هي في الإنتاج — وما يُبدَّل منها يُمرَّر */
async function asInProduction(over: { descriptionAr?: string; firstTitle?: string } = {}) {
  await wipe()
  await prisma.course.create({ data: { id: ID, status: 'published', currentVersion: 1, createdBy: randomUUID() } })
  await prisma.courseVersion.create({
    data: { courseId: ID, version: 1, status: 'published', titleAr: 'إعداد المعلمين واولياء الامور لتدريب الاطفال على مهارة الخطابة والالقاء', totalHours: 16, descriptionAr: over.descriptionAr },
  })
  await prisma.courseModule.create({ data: { id: `${ID}-M1`, courseId: ID, status: 'published' } })
  await prisma.courseModuleVersion.create({
    data: { moduleId: `${ID}-M1`, version: 1, sequence: 1, titleAr: over.firstTitle ?? 'اعداد القادة', outcomeAr: '', hours: 1, status: 'published' },
  })
}

const modules = () => prisma.courseModuleVersion.findMany({
  where: { module: { courseId: ID, status: 'published' }, status: 'published' }, orderBy: { sequence: 'asc' },
})
const version = () => prisma.courseVersion.findFirstOrThrow({
  where: { courseId: ID }, include: { objectives: true, outcomes: true },
})

describe('ترحيل محتوى C-COMX-107', () => {
  it('⚠️ ① ثماني وحدات بعناوين الخطة — ② والوصف والأهداف والمخرجات', async () => {
    await asInProduction()
    await migrate()
    const m = await modules()
    expect(m.map((x) => x.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(m[0]!.titleAr).toBe('أساسيات الخطابة للأطفال')
    expect(m[7]!.titleAr).toContain('الخطاب الختامي')
    for (const x of m) {
      expect(x.outcomeAr, x.titleAr).toBeTruthy()
      expect(x.activityAr, x.titleAr).toBeTruthy()
      expect(x.artifactAr, x.titleAr).toBeTruthy()
    }
    expect(m.reduce((s, x) => s + x.hours, 0)).toBe(16)
    const v = await version()
    expect(v.descriptionAr).toContain('5–12')
    expect(v.shortPromiseAr).toBeTruthy()
    expect(v.audienceAr).toBeTruthy()
    expect(v.objectives).toHaveLength(4)
    expect(v.outcomes).toHaveLength(3)
  })

  it('⚠️ ④ وتعاد فلا تفسد', async () => {
    await migrate()
    expect(await modules()).toHaveLength(8)
    const v = await version()
    expect(v.objectives).toHaveLength(4)
    expect(v.outcomes).toHaveLength(3)
  })

  it('⚠️ ③ وما كتبه إنسان لا يمس', async () => {
    await asInProduction({ descriptionAr: 'وصف كتبته الإدارة', firstTitle: 'وحدة كتبتها الإدارة' })
    await prisma.learningObjective.create({ data: { courseVersionId: (await version()).id, sequence: 1, textAr: 'هدف كتبته الإدارة' } })
    await migrate()
    const v = await version()
    expect(v.descriptionAr).toBe('وصف كتبته الإدارة')
    expect(v.objectives.map((o) => o.textAr)).toEqual(['هدف كتبته الإدارة'])
    expect((await modules())[0]!.titleAr).toBe('وحدة كتبتها الإدارة')
  })

  it('⑤ ولا شيء بلا الدورة', async () => {
    await wipe()
    await migrate()
    expect(await prisma.courseModule.count({ where: { courseId: ID } })).toBe(0)
  })

  it('⑥ والنص بلا تشكيل إعرابي — الشدة وحدها', () => {
    const code = FILE.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n')
    expect(code).not.toMatch(/[ً-ِْ]/)
  })
})
