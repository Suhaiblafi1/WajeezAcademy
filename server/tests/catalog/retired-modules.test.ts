/* الوحدةُ المتقاعدة تُؤرشف بالاسم — ووحدةُ المدرّب لا تُطفأ بالغياب.

   حين صارت الدوراتُ كلُّها ستَّ عشرةَ ساعة (٧ أكتوبر ٢٠٢٦) نزلت خمسٌ من أربعٍ
   وعشرين: اثنتا عشرة وحدةً صارت ثمانيا. والمستوردُ لا يحذف الوحدات ولا كان
   يؤرشفها، فكانت المدموجةُ ستبقى «منشورة» في القاعدة تحت دورةٍ لم تعُد
   تعدّها — واللقطةُ والكتالوجُ العامّ يقرآن كلَّ وحدةٍ منشورة.

   فالملفُّ يسمّيها في `retired_modules`، والمستوردُ يؤرشف ما سُمّي وحدَه.
   ويحرس هذا الملفُّ الوجهين: المسمّاةُ تُؤرشف، ووحدةٌ أضافها مدرّبٌ من لوحته
   بالتسمية نفسِها — غائبةٌ عن الملفّ لكنّها غيرُ مسمّاة — تبقى كما هي.

   ⚠ أُثبت سقوطُه: عُطّلت أرشفةُ `retired_modules` في المستورد فسقط الفحصُ
   الأوّل مسمّيا الوحدة، ثمّ أُعيدت فخضرّ. */

import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { importCatalog } from '../../catalog/importer'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const core = JSON.parse(readFileSync(join(root, 'src/data/catalog/core-catalog.v2.json'), 'utf8')) as {
  modules: { module_id: string; course_id: string }[]
  retired_modules: { module_id: string; course_id: string; merged_into: string; reason_ar: string }[]
}

let prisma: PrismaClient

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
}, 180_000)

describe('الوحداتُ المتقاعدة', () => {
  it('الملفُّ يسمّيها، وكلٌّ منها مدموجةٌ في وحدةٍ باقيةٍ من دورتها', () => {
    expect(core.retired_modules.length, 'لا وحدةَ متقاعدة — تغيّرت البنية؟').toBeGreaterThan(0)
    const kept = new Map(core.modules.map((m) => [m.module_id, m.course_id]))
    for (const r of core.retired_modules) {
      expect(kept.has(r.module_id), `${r.module_id} متقاعدةٌ وما تزال في الوحدات`).toBe(false)
      expect(kept.get(r.merged_into), `${r.module_id} دُمجت في ما ليس من دورتها`).toBe(r.course_id)
      expect(r.reason_ar.length).toBeGreaterThan(10)
    }
  })

  it('المسمّاةُ تُؤرشف — ووحدةُ المدرّب الغائبةُ عن الملفّ تبقى منشورة', { timeout: 180_000 }, async () => {
    const retired = core.retired_modules[0]
    /* وحدةٌ بتسمية الملفّ نفسِها لكنّها ليست فيه ولا في المتقاعدة — كما يضيفها المدرّب */
    const trainerModule = `${retired.course_id}-M99`
    expect(core.modules.some((m) => m.module_id === trainerModule)).toBe(false)

    /* القاعدةُ كما في الإنتاج قبل الدمج: المتقاعدةُ ما تزال منشورة */
    await prisma.courseModule.upsert({
      where: { id: retired.module_id },
      update: { courseId: retired.course_id, status: 'published' },
      create: { id: retired.module_id, courseId: retired.course_id, status: 'published' },
    })
    await prisma.courseModule.upsert({
      where: { id: trainerModule },
      update: { courseId: retired.course_id, status: 'published' },
      create: { id: trainerModule, courseId: retired.course_id, status: 'published' },
    })

    try {
      await importCatalog(prisma)
      const status = async (id: string) => (await prisma.courseModule.findUniqueOrThrow({ where: { id } })).status
      expect(await status(retired.module_id), `${retired.module_id} بقيت منشورةً بعد الاستيراد`).toBe('archived')
      expect(await status(trainerModule), 'أُطفئت وحدةُ مدرّبٍ لم يسمّها الملفّ').toBe('published')

      /* ومرّةً ثانيةً لا يتغيّر شيء */
      await importCatalog(prisma)
      expect(await status(retired.module_id)).toBe('archived')
    } finally {
      await prisma.courseModule.deleteMany({ where: { id: { in: [trainerModule, retired.module_id] } } })
    }
  })
})
