/* ترحيلُ إعادة C-COMX-107 — ما يفعله الاعتمادُ ثمّ النشرُ في اللوحة، لدورةٍ واحدة.

   الدورةُ لا تُستورد من الملفّ (وُلدت في اللوحة)، فتُصنع هنا بكلّ حالٍ قد تكون
   عليها في الإنتاج، وتُقرأ جملُ الترحيل من ملفّه **نفسِه** وتُنفَّذ عليها — فلو
   تبدّل شرطٌ في الملفّ سقط هذا لا نسخةٌ عنه (على حذو `merge-first-job-migration`).

   ═══ وما يُفحص ═══

   ① دورةٌ مؤرشفةٌ تامّة: تُنشر هي وإصدارُها الحاليّ ووحداتُها المسوّدة — ولا تعود
      وحدةٌ مؤرشفة، ولا يُنشر تعديلٌ مسوّدٌ فوق وحدةٍ منشورة.
   ② ومسوّدةٌ لم تُنشر قطّ: تُنشر كذلك.
   ③ وبلا مهارةٍ أو بلا وحدةٍ حيّة: لا يُمسّ منها شيء — حاجزا النشر نفسُهما.
   ④ ولا تُمسّ دورةٌ غيرُها.
   ⑤ والجملُ تُعاد فلا تفسد: ولا تُنشر وحدةٌ جديدةٌ كُتبت بعد الإعادة. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
let prisma: PrismaClient
let skillId: string

const statements = readFileSync(join(root, 'prisma/migrations/20260930190000_restore_c_comx_107/migration.sql'), 'utf8')
  .split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n')
  .split(';').map((x) => x.trim()).filter(Boolean)
const migrate = async () => { for (const st of statements) await prisma.$executeRawUnsafe(st) }

const ID = 'C-COMX-107'
const OTHER = 'C-TEST-ADMIN-ARCHIVED'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  skillId = (await prisma.skill.findFirstOrThrow({ select: { id: true } })).id
}, 240_000)

/* القاعدةُ مشتركةٌ بين ملفّات الخادم: دورةُ لوحةٍ منشورةٌ تبقى بعدنا قد تُحسب في
   عدٍّ يجري بعدنا — فتُمحى */
afterAll(async () => {
  for (const id of [ID, OTHER]) await wipe(id)
})

async function wipe(id: string) {
  await prisma.courseSkillLink.deleteMany({ where: { courseId: id } })
  await prisma.courseModuleVersion.deleteMany({ where: { module: { courseId: id } } })
  await prisma.courseModule.deleteMany({ where: { courseId: id } })
  await prisma.courseVersion.deleteMany({ where: { courseId: id } })
  await prisma.course.deleteMany({ where: { id } })
}

interface Unit { status: string; versions: string[] }
/** دورةُ لوحةٍ بحالها ووحداتها — تُمحى أوّلا إن وُجدت */
async function course(id: string, s: { status: string; versions: string[]; units: Unit[]; skill: boolean }) {
  await wipe(id)
  await prisma.course.create({ data: { id, status: s.status, currentVersion: s.versions.length, createdBy: randomUUID() } })
  for (const [i, st] of s.versions.entries()) {
    await prisma.courseVersion.create({ data: { courseId: id, version: i + 1, status: st, titleAr: 'إعداد المعلّمين وأولياء الأمور لتدريب الخطابة', totalHours: 12 } })
  }
  for (const [n, u] of s.units.entries()) await unit(id, n + 1, u)
  if (s.skill) await prisma.courseSkillLink.create({ data: { courseId: id, skillId } })
}
async function unit(courseId: string, n: number, u: Unit) {
  const id = `${courseId}-M${n}`
  await prisma.courseModule.create({ data: { id, courseId, status: u.status } })
  for (const [i, st] of u.versions.entries()) {
    await prisma.courseModuleVersion.create({ data: { moduleId: id, version: i + 1, status: st, sequence: n, titleAr: `الوحدة ${n}`, hours: 3 } })
  }
}

/** حالُ الدورة كلُّها في سطرٍ يُقارَن */
async function state(id: string) {
  const c = await prisma.course.findUniqueOrThrow({ where: { id }, include: { versions: { orderBy: { version: 'asc' } } } })
  const units = await prisma.courseModule.findMany({ where: { courseId: id }, orderBy: { id: 'asc' }, include: { versions: { orderBy: { version: 'asc' } } } })
  return {
    course: c.status,
    versions: c.versions.map((v) => v.status),
    units: units.map((u) => ({ status: u.status, versions: u.versions.map((v) => v.status) })),
  }
}

describe('ترحيلُ إعادة C-COMX-107', () => {
  it('① مؤرشفةٌ تامّة تُنشر — بلا وحدةٍ مؤرشفةٍ تعود ولا تعديلٍ لم يُراجَع — ④ وغيرُها لا يُمسّ — ⑤ وتُعاد فلا تفسد', { timeout: 120_000 }, async () => {
    await course(ID, {
      status: 'archived',
      versions: ['published', 'approved'],
      units: [
        { status: 'draft', versions: ['draft'] },
        { status: 'published', versions: ['published', 'draft'] },
        { status: 'archived', versions: ['published'] },
      ],
      skill: true,
    })
    const other = { status: 'archived', versions: ['published'], units: [{ status: 'draft', versions: ['draft'] }], skill: true }
    await course(OTHER, other)
    const otherBefore = await state(OTHER)

    await migrate()

    expect(await state(ID)).toEqual({
      course: 'published',
      versions: ['published', 'published'],
      units: [
        { status: 'published', versions: ['published'] },
        /* التعديلُ المسوّدُ فوق المنشور يبقى مسوّدة: لم يراجعه أحد */
        { status: 'published', versions: ['published', 'draft'] },
        /* والمؤرشفةُ تبقى مؤرشفة: أُرشفت لسبب */
        { status: 'archived', versions: ['published'] },
      ],
    })
    expect(await state(OTHER), 'مُسّت دورةٌ غيرُ C-COMX-107').toEqual(otherBefore)

    /* ⑤ تُعاد فلا تفسد — ووحدةٌ تُكتب بعد الإعادة تبقى مسوّدةً حتّى تُراجَع */
    const after = await state(ID)
    await unit(ID, 4, { status: 'draft', versions: ['draft'] })
    await migrate()
    expect(await state(ID)).toEqual({ ...after, units: [...after.units, { status: 'draft', versions: ['draft'] }] })
  })

  it('② ومسوّدةٌ لم تُنشر قطّ تُنشر كذلك', { timeout: 60_000 }, async () => {
    await course(ID, { status: 'draft', versions: ['draft'], units: [{ status: 'draft', versions: ['draft'] }], skill: true })
    await migrate()
    expect(await state(ID)).toEqual({ course: 'published', versions: ['published'], units: [{ status: 'published', versions: ['published'] }] })
  })

  it('③ وبلا مهارةٍ أو بلا وحدةٍ حيّة لا يُمسّ منها شيء — حاجزا النشر نفسُهما', { timeout: 60_000 }, async () => {
    const noSkill = { status: 'archived', versions: ['approved'], units: [{ status: 'draft', versions: ['draft'] }], skill: false }
    await course(ID, noSkill)
    const a = await state(ID)
    await migrate()
    expect(await state(ID), 'نُشرت دورةٌ بلا مهارة — حيّةٌ في القائمة ميّتةٌ في المحرّك').toEqual(a)

    const noLiveUnit = { status: 'archived', versions: ['approved'], units: [{ status: 'archived', versions: ['published'] }], skill: true }
    await course(ID, noLiveUnit)
    const b = await state(ID)
    await migrate()
    expect(await state(ID), 'نُشرت دورةٌ بلا وحدةٍ حيّة').toEqual(b)
  })
})
