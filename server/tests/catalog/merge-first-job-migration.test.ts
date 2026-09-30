/* ترحيلُ دمج دورات «التحضير لأول وظيفة» — التأهيلُ ينتقل ولا يُفقد.

   جرى الترحيلُ على قاعدةٍ فارغةٍ حين هُيّئت قاعدةُ الاختبار، فلا يُقاس أثرُه
   هناك. فتُقرأ جملُه من ملفّه **نفسِه** وتُنفَّذ على صفوفٍ تُصنع هنا بكلّ حالٍ
   من أحواله — فلو تبدّل شرطٌ في الملفّ سقط هذا لا نسخةٌ عنه (على حذو
   `importer-prune.test.ts`).

   ═══ وما يُفحص ═══

   ① المؤهَّلُ لجزءٍ وحدَه يصير مؤهَّلا للمدموجة — بصفّه نفسِه وموادّه.
   ② ومن له الاثنتان تُرفع حالتُه في الباقية ولا تُخفَض، ويُتقاعَد صفُّ الجزء.
   ③ والردُّ لا ينتقل، ولا طلبُ التأهيل من أجل شعبةٍ بعينها.
   ④ والاقتراحُ المربوطُ بالمُدمَجة يُربط بالباقية.
   ⑤ والجملُ تُعاد فلا تفسد. */

import { beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
let prisma: PrismaClient
let seq = 0

const statements = readFileSync(join(root, 'prisma/migrations/20260930150000_merge_first_job_courses/migration.sql'), 'utf8')
  .split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n')
  .split(';').map((x) => x.trim()).filter(Boolean)
const migrate = async () => { for (const st of statements) await prisma.$executeRawUnsafe(st) }

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  /* المُدمَجتان زالتا من الملفّ فلا يستوردهما شيء — وفي الإنتاج هما قائمتان
     حين يجري الترحيل، فتُصنعان هنا كما هما هناك: دورتان بلا نسخة */
  for (const id of ['C-JOB-103', 'C-JOB-105']) {
    await prisma.course.upsert({ where: { id }, update: {}, create: { id, status: 'published', currentVersion: 1 } })
  }
}, 240_000)

/** ملفُّ مدرّبٍ بطلبه — والتأهيلاتُ تُعطى بحالاتها */
async function trainer(quals: Record<string, { status: string; cohort?: boolean; materials?: unknown }>) {
  seq += 1
  const app = await prisma.trainerApplication.create({
    data: {
      reference: `TR-MJ-${Date.now()}-${seq}`, fullName: `مدرّبٌ ${seq}`, email: `mj-${seq}-${Date.now()}@test.local`,
      status: 'active', motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: app.id } })
  const rows: Record<string, string> = {}
  for (const [courseId, q] of Object.entries(quals)) {
    const row = await prisma.trainerCourseQualification.create({
      data: {
        profileId: profile.id, courseId, status: q.status,
        requestedCohortId: q.cohort ? randomUUID() : null,
        materials: (q.materials ?? undefined) as never,
      },
    })
    rows[courseId] = row.id
  }
  return { profileId: profile.id, rows }
}

const qualsOf = async (profileId: string) =>
  Object.fromEntries((await prisma.trainerCourseQualification.findMany({ where: { profileId } }))
    .map((q) => [q.courseId, q.status]))

describe('ترحيلُ دمج دورات «التحضير لأول وظيفة»', () => {
  it('①–⑤ على كلّ حالٍ من أحواله', { timeout: 120_000 }, async () => {
    const onlyPart = await trainer({ 'C-JOB-103': { status: 'qualified', materials: { files: ['a.pdf'] } } })
    const both = await trainer({ 'C-JOB-101': { status: 'pending' }, 'C-JOB-103': { status: 'qualified' } })
    const noDowngrade = await trainer({ 'C-JOB-104': { status: 'qualified' }, 'C-JOB-105': { status: 'pending' } })
    const rejected = await trainer({ 'C-JOB-105': { status: 'rejected' } })
    const forCohort = await trainer({ 'C-JOB-103': { status: 'pending', cohort: true } })
    const proposal = await prisma.trainerCourseProposal.create({
      data: { profileId: onlyPart.profileId, titleAr: 'استراتيجية البحث عن عمل', status: 'linked', courseId: 'C-JOB-105' },
    })

    await migrate()

    /* ① بصفّه نفسِه — فالموادُّ والتاريخُ معه لا نسخةٌ عنه */
    expect(await qualsOf(onlyPart.profileId)).toEqual({ 'C-JOB-101': 'qualified' })
    const moved = await prisma.trainerCourseQualification.findUniqueOrThrow({ where: { id: onlyPart.rows['C-JOB-103'] } })
    expect([moved.courseId, moved.materials]).toEqual(['C-JOB-101', { files: ['a.pdf'] }])

    /* ② تُرفع ولا تُخفَض — والجزءُ يُتقاعَد ولا يُحذف */
    expect(await qualsOf(both.profileId)).toEqual({ 'C-JOB-101': 'qualified', 'C-JOB-103': 'retired' })
    expect(await qualsOf(noDowngrade.profileId)).toEqual({ 'C-JOB-104': 'qualified', 'C-JOB-105': 'retired' })

    /* ③ الردُّ سجلٌّ على دورته، وطلبُ الشعبة على دورة شعبته */
    expect(await qualsOf(rejected.profileId)).toEqual({ 'C-JOB-105': 'rejected' })
    expect(await qualsOf(forCohort.profileId)).toEqual({ 'C-JOB-103': 'pending' })

    /* ④ */
    expect((await prisma.trainerCourseProposal.findUniqueOrThrow({ where: { id: proposal.id } })).courseId).toBe('C-JOB-104')

    /* ⑤ تُعاد فلا تفسد */
    const snapshot = await prisma.trainerCourseQualification.findMany({
      where: { profileId: { in: [onlyPart, both, noDowngrade, rejected, forCohort].map((t) => t.profileId) } },
      orderBy: { id: 'asc' }, select: { id: true, courseId: true, status: true },
    })
    await migrate()
    expect(await prisma.trainerCourseQualification.findMany({
      where: { profileId: { in: [onlyPart, both, noDowngrade, rejected, forCohort].map((t) => t.profileId) } },
      orderBy: { id: 'asc' }, select: { id: true, courseId: true, status: true },
    })).toEqual(snapshot)
  })
})
