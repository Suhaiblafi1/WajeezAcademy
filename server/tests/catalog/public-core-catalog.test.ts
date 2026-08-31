/* المسلك الذي تقرؤه الواجهة الحيّة فعلا: /api/public/core-catalog.

   الفصل بين دورات المسار الأساسية والمساندة كان محروسا في موضعين — ملفّ
   المصدر (src/tests/catalog/support-courses.test.ts) وبناء اللقطة — وكلاهما
   يخضر بينما الموقع الحيّ لا يقرأ أيّا منهما: services/public-content.ts
   يجلب هذا المسلك، وهو يبني course_ids من روابط المسار كلّها بلا تمييز نوع.
   فكانت المساندات الثلاث تدخل course_ids عند أوّل تحميلٍ من القاعة، ومنها
   يقرؤها pathwaySkills فتُشتقّ منها فجوةُ المهارات التي تزن ٢٥٪ من ترتيب
   المسارات — أي أنّ الحارسين كانا يطمئنان على شيء لا يقع في مكانه.

   أمسكته بروفةُ الاستيراد والنشر على قاعدة حقيقية، لا الاختبارات. وهذا
   الملفّ يجعل المسلك محروسا كسائره. */

import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { PublicCatalogService } from '../../services/public-catalog.service'
import { SUPPORT_PER_PATHWAY } from '../../../src/data/courses'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const CORE = JSON.parse(readFileSync(join(root, 'src/data/catalog/core-catalog.v2.json'), 'utf8')) as {
  launch_pathways: { id: string; course_ids: string[]; support_courses?: { course_id: string; reason_ar: string }[] }[]
}

let prisma: PrismaClient
let payload: Awaited<ReturnType<PublicCatalogService['coreCatalog']>>

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  payload = await new PublicCatalogService(prisma).coreCatalog()
}, 180_000)

describe('/api/public/core-catalog — ما تقرؤه الواجهة الحيّة', () => {
  it('يردّ المسارات العشرين', () => {
    expect(payload.launch_pathways.length).toBe(CORE.launch_pathways.length)
  })

  it('course_ids تطابق المصدر — بلا مساندة واحدة', () => {
    let supportsChecked = 0
    for (const src of CORE.launch_pathways) {
      const live = payload.launch_pathways.find((p) => p.id === src.id)
      expect(live, src.id).toBeDefined()
      expect([...live!.course_ids].sort(), src.id).toEqual([...src.course_ids].sort())
      for (const s of src.support_courses ?? []) {
        expect(live!.course_ids, `${src.id}: المساندة ${s.course_id} تسرّبت إلى course_ids`).not.toContain(s.course_id)
        supportsChecked++
      }
    }
    /* فحصٌ لا يفحص شيئا أسوأ من غيابه: نثبت أنّ هناك مساندات فُحصت فعلا.
       والعدد من الثابت لا من رقمٍ مكتوب هنا — كُتب ٣ فلمّا صارت مساندتين
       احمرّ الحارس على تغييرٍ مقصود بدل أن يتبع مصدره. */
    expect(supportsChecked).toBe(CORE.launch_pathways.length * SUPPORT_PER_PATHWAY)
  })

  /* عيبٌ ثانٍ من المساندات نفسها، ظهر على الإنتاج: صار للدورة أكثر من رابط
     مسار — واحدٌ أساسيّ وحتى أربعةٌ مساندة — وكان `pathwayLinks[0]` يلتقط
     أحدها اعتباطا. فظهرت «دورة الكتابة والبحث بالذكاء الاصطناعي» منسوبةً إلى
     «قرارك المهني الأول» بترتيب ٥ بدل ٣، فسقطت من فئتها في كتالوج الدورات:
     صفحة الدورات تُصنّف من `pathway_id`، فاختفت الدورة من «أساسيات». */
  it('كل دورة منسوبة إلى مسارها الأمّ لا إلى مسارٍ تسانده', () => {
    const truth = new Map(
      (JSON.parse(readFileSync(join(root, 'src/data/catalog/core-catalog.v2.json'), 'utf8')) as {
        courses: { course_id: string; pathway_id: string; sequence: number }[]
      }).courses.map((c) => [c.course_id, { pathwayId: c.pathway_id, sequence: c.sequence }]),
    )
    const wrong = payload.courses
      .map((c) => ({ id: c.course_id, live: { pathwayId: c.pathway_id, sequence: c.sequence }, src: truth.get(c.course_id) }))
      .filter((x) => x.src && (x.live.pathwayId !== x.src.pathwayId || x.live.sequence !== x.src.sequence))
    expect(wrong, 'دورات نُسبت إلى مسارٍ تسانده لا إلى مسارها').toEqual([])

    /* والفحص يفحص شيئا: لا بدّ من دوراتٍ تحمل رابطا مساندا فعلا */
    const supported = new Set(payload.launch_pathways.flatMap((p) => (p.support_courses ?? []).map((s) => s.course_id)))
    expect(supported.size).toBeGreaterThanOrEqual(20)
  })

  it('المساندات تصل كاملة بأسبابها — وإلا عُرضت بلا تفسير أو بلا وسم', () => {
    for (const src of CORE.launch_pathways) {
      const live = payload.launch_pathways.find((p) => p.id === src.id)!
      const expected = (src.support_courses ?? []).map((s) => s.course_id).sort()
      expect((live.support_courses ?? []).map((s) => s.course_id).sort(), src.id).toEqual(expected)
      for (const s of live.support_courses ?? []) {
        /* السبب هو ما يميّز المساندة في العرض — الفراغ يُسقط وسمها كلّه */
        expect(s.reason_ar.trim().length, `${src.id} · ${s.course_id}`).toBeGreaterThan(20)
      }
    }
  })
})
