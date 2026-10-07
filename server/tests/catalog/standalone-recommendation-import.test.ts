/* ترشيحُ الدورة وحدَها يصل من الملفّ — وما علّمته اللوحةُ ولم يذكره الملفُّ يبقى.

   قرّر صاحبُ المنصّة (٧ أكتوبر ٢٠٢٦) جمهورَ ٣٢ دورةً قائمةً بنفسها ومجالَها،
   دورةً دورة، فصار ذلك في `core-catalog.v2.json` ويكتبه المستوردُ في كلّ نشر.
   وقبلها كان صندوقا في لوحة الكتالوج وحدَه، فلم يُعلَّم في الإنتاج لدورةٍ واحدة.

   ويحرس هذا الملفُّ الوجهين:
     · ما في الملفّ يصل القاعدةَ كما هو — فاللقطةُ ترى ما تراه الحزمة.
     · وما سكت عنه الملفُّ لا يُطفئه الاستيراد — فما علّمته اللوحةُ لدورةٍ
       أخرى يبقى بعد كلّ نشر.

   ⚠ أُثبت سقوطُه: عُطّلت كتابةُ الحقول في المستورد فسقط الأوّلُ مسمّيا الدورة،
   ثمّ أُعيدت فخضرّ. */

import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { importCatalog } from '../../catalog/importer'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const core = JSON.parse(readFileSync(join(root, 'src/data/catalog/core-catalog.v2.json'), 'utf8')) as {
  courses: { course_id: string; recommendable_directly?: boolean; diagnostic_domains?: string[]; diagnostic_stages?: string[] }[]
}
const declared = core.courses.filter((c) => c.recommendable_directly !== undefined)
const silent = core.courses.find((c) => c.recommendable_directly === undefined)!

let prisma: PrismaClient

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
}, 180_000)

describe('ترشيحُ الدورة وحدَها من الملفّ', () => {
  it('الملفُّ يعلن دوراتٍ تُرشَّح وحدَها — وفيه دورةٌ ساكتةٌ يُختبر بها الوجهُ الآخر', () => {
    expect(declared.length, 'لا دورةَ في الملفّ تعلن ترشيحَها — تغيّرت البنية؟').toBeGreaterThan(20)
    expect(silent).toBeDefined()
  })

  it('ما في الملفّ يصل القاعدة، وما سكت عنه يبقى كما علّمته اللوحة', { timeout: 180_000 }, async () => {
    /* اللوحةُ علّمت دورةً لا يذكرها الملفّ */
    await prisma.course.update({
      where: { id: silent.course_id },
      data: { recommendableDirectly: true, diagnosticDomains: ['ai_productivity'], diagnosticStages: ['early_career'] },
    })
    try {
      await importCatalog(prisma)

      const wrong: string[] = []
      for (const c of declared) {
        const row = await prisma.course.findUniqueOrThrow({
          where: { id: c.course_id },
          select: { recommendableDirectly: true, diagnosticDomains: true, diagnosticStages: true },
        })
        const same = row.recommendableDirectly === c.recommendable_directly
          && JSON.stringify([...row.diagnosticDomains].sort()) === JSON.stringify([...(c.diagnostic_domains ?? [])].sort())
          && JSON.stringify([...row.diagnosticStages].sort()) === JSON.stringify([...(c.diagnostic_stages ?? [])].sort())
        if (!same) wrong.push(c.course_id)
      }
      expect(wrong, 'دوراتٌ لم يصل قرارُ ترشيحها من الملفّ إلى القاعدة').toEqual([])

      const kept = await prisma.course.findUniqueOrThrow({
        where: { id: silent.course_id },
        select: { recommendableDirectly: true, diagnosticDomains: true, diagnosticStages: true },
      })
      expect(kept, 'أطفأ الاستيرادُ ما علّمته اللوحةُ لدورةٍ لا يذكرها الملفّ').toEqual({
        recommendableDirectly: true, diagnosticDomains: ['ai_productivity'], diagnosticStages: ['early_career'],
      })
    } finally {
      await prisma.course.update({
        where: { id: silent.course_id },
        data: { recommendableDirectly: false, diagnosticDomains: [], diagnosticStages: [] },
      })
    }
  })
})
