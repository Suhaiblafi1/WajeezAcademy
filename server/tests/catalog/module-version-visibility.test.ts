/* المسوّدة لا تُرى — حارسٌ على كلِّ قارئٍ يأخذ إصدارَ وحدة.

   خمسةُ مواضعَ في الخادم تسأل عن «أحدث إصدار» بـ`orderBy: version desc,
   take: 1` بلا أن تنظر في حالته: بانيةُ اللقطة المنشورة، والكتالوج العامّ
   (موضعان)، وبطاقاتُ المراجعة المتباعدة، والسيناريوهات، وبوابةُ المدرب.

   وما دام لا محرِّرَ لوحدةٍ قائمة، لم يظهر أثرُ ذلك: لا مسوّدةَ في القاعدة
   أصلا. لكنّ الدفعة الثالثة تُنشئ المسوّدات — فيصير «أحدثُ إصدار» هو
   المسوّدةَ نفسَها، وتُنشر إلى المتعلّم في أوّل لقطة. ورأسُ
   `public-catalog.service.ts` يَعِد بغير ذلك نصّا: «لا draft ولا in_review
   يخرج من هنا أبدا» — وعدٌ صادقٌ في الدورات والوحدات، غيرُ منفَّذٍ في
   إصداراتها.

   فالقاعدة تُجمع في `READABLE_MODULE_VERSION_STATUSES` ويُحرَس أمران:
   ١) أنّ كلَّ قارئٍ يستعملها — لا نصّا مكرَّرا يسهل أن يُنسى في السادس.
   ٢) وأنّ المنشور يُقرأ فعلا حين تعلوه مسوّدة — سلوكا لا شكلا. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { READABLE_MODULE_VERSION_STATUSES } from '../../catalog/module-version-visibility'

const ROOT = join(process.cwd(), 'server')

/** القرّاء الخمسة — كلُّ ملفٍّ يأخذ إصدارَ وحدة لعرضه */
const READERS = [
  'catalog/snapshot-builder.ts',
  'services/public-catalog.service.ts',
  'services/retrieval.service.ts',
  'services/scenario.service.ts',
  'http/routes/trainer-portal.routes.ts',
]

/** يُجرَّد التعليق كي لا يحرس الحارسُ شرحَه هو */
function codeOf(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')
}

describe('إصدارُ الوحدة لا يُقرأ بلا حالته', () => {
  it('كلُّ قارئٍ يستورد القاعدة المشتركة — لا ينسخها', () => {
    const missing = READERS.filter((r) => !codeOf(r).includes('module-version-visibility'))
    expect(missing).toEqual([])
  })

  it('ولا موضعَ يأخذ إصدارَ وحدةٍ بلا ترشيحِ الحالة', () => {
    /* `versions: { orderBy: { version: 'desc' }, take: 1 }` على وحدةٍ يجب أن
       يصحبه `where` بالحالات المقروءة. نبحث عن الشكل العاري. */
    const offenders: string[] = []
    for (const r of READERS) {
      const src = codeOf(r)
      for (const line of src.split('\n')) {
        if (!/versions:\s*\{/.test(line)) continue
        if (!/orderBy:\s*\{\s*version:\s*'desc'\s*\}/.test(line)) continue
        /* إصداراتُ المسار والدورة والقالب لها حاكميّتها؛ الحارس هنا على الوحدة */
        if (!/modules?:/.test(line) && !/courseModuleVersion/.test(line)) continue
        if (!/READABLE_MODULE_VERSION_STATUSES/.test(line)) offenders.push(`${r}: ${line.trim()}`)
      }
      for (const m of src.matchAll(/courseModuleVersion\.findFirst\(\{[\s\S]{0,220}?\}\)/g)) {
        if (!/READABLE_MODULE_VERSION_STATUSES/.test(m[0])) offenders.push(`${r}: findFirst بلا حالة`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('والمسوّدة لا تُقرأ ولو كانت أعلى رقما', async () => {
    const prisma: PrismaClient = await testPrisma()
    const published = await prisma.courseModuleVersion.findFirst({
      where: { status: { in: [...READABLE_MODULE_VERSION_STATUSES] } },
      orderBy: { version: 'desc' },
    })
    expect(published).toBeTruthy()
    const moduleId = published!.moduleId

    /* مسوّدةٌ أعلى رقما — هي «أحدث إصدار» بالمعنى الحرفيّ */
    const draftVersion = published!.version + 1
    await prisma.courseModuleVersion.create({
      data: {
        moduleId, version: draftVersion, sequence: published!.sequence,
        titleAr: 'مسوّدةٌ لا يجوز أن تُرى', bodyAr: 'نصٌّ لم يُعتمد بعد',
        hours: published!.hours, status: 'draft',
      },
    })

    const seen = await prisma.courseModuleVersion.findFirst({
      where: { moduleId, status: { in: [...READABLE_MODULE_VERSION_STATUSES] } },
      orderBy: { version: 'desc' },
    })
    expect(seen?.version).toBe(published!.version)
    expect(seen?.titleAr).not.toBe('مسوّدةٌ لا يجوز أن تُرى')

    await prisma.courseModuleVersion.delete({ where: { moduleId_version: { moduleId, version: draftVersion } } })
  })

  it('والحالاتُ المقروءة هي المنشورُ والمعتمَد وحدهما', () => {
    expect([...READABLE_MODULE_VERSION_STATUSES].sort()).toEqual(['approved', 'published'])
  })
})

beforeAll(async () => {
  await setupTestDb()
})
