/* خريطةُ الموقع وllms.txt الحيّتان — تدعوان إلى ما يُعرض الآن وحدَه.

   المسارُ يُعرض حين تكون لكلّ دوراته شعبةٌ في فصله (`listedWhole`)، وقرارُ صاحب المنصّة
   (٢٨ أكتوبر ٢٠٢٦) أن يبقى ما سواه مخفيّا. فخريطةٌ تدعو الزاحفَ إلى مسارٍ مخفيٍّ تُظهره
   في البحث بعد أن أُخفي من الموقع. والمقيسُ: خدمةٌ بجوابٍ مُصطنَعٍ عن الشعب. */

import { describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import publicPathwaysJson from '../../data/catalog/public-pathways.json'
import { SeoFeedsService, liveLlmsTxt, liveSitemap, EMPTY_LIVE } from '../../../server/services/seo-feeds.service'
import { sitemapXml } from '../../application/site/seo-feeds'
import { PUBLIC_PAGES } from '../../application/site/public-pages'

const PATHWAYS = publicPathwaysJson.pathways as { id: string; course_ids: string[] }[]
const SEASON = '2026-nov_jan'

/** خدمةٌ بجوابٍ مُصطنَع: دوراتُ `open` لها شعبةٌ في الفصل، وكلُّها منشورة */
function serviceWith(open: string[]) {
  const svc = new SeoFeedsService({} as PrismaClient)
  const allIds = [...new Set(PATHWAYS.flatMap((p) => p.course_ids))]
  ;(svc as unknown as { catalog: unknown }).catalog = {
    listedCourses: async () => ({
      courseIds: open,
      seasons: Object.fromEntries(open.map((id) => [id, [SEASON]])),
      season: SEASON,
    }),
    courses: async () => allIds.map((id) => ({ id, title: `دورة ${id}`, totalHours: 16 })),
  }
  return svc
}

describe('ما يعرض الآن', () => {
  const [first, second] = PATHWAYS

  it('المسار الذي لكلّ دوراته شعبة يدخل، والذي ينقصه دورة لا يدخل', async () => {
    const open = [...first.course_ids, ...second.course_ids.slice(1)]
    const live = await serviceWith(open).live()
    const paths = live.pathways.map((p) => p.path)
    expect(paths).toContain(`/pathways/${first.id}`)
    expect(paths, 'مسار مخفي يدعى إليه الزاحف').not.toContain(`/pathways/${second.id}`)
  })

  it('والدورة بلا شعبة لا تدخل', async () => {
    const live = await serviceWith(first.course_ids.slice(0, 1)).live()
    expect(live.courses.map((c) => c.path)).toEqual([`/build/${first.course_ids[0]}`])
  })

  it('والخريطة الحيّة: الصفحات العامّة ثمّ ما يعرض', async () => {
    const xml = liveSitemap(await serviceWith(first.course_ids).live())
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
    for (const p of PUBLIC_PAGES) expect(locs).toContain(`https://www.wajeezacademy.com${p.path}`)
    expect(locs).toContain(`https://www.wajeezacademy.com/pathways/${first.id}`)
    expect(new Set(locs).size).toBe(locs.length)
  })

  it('وإن تعذّرت القاعدة رُدّت الصفحات العامّة لا خطأ', async () => {
    const svc = new SeoFeedsService({} as PrismaClient)
    ;(svc as unknown as { catalog: unknown }).catalog = {
      listedCourses: async () => {
        throw new Error('db down')
      },
      courses: async () => [],
    }
    let logged = false
    const live = await svc.liveOrEmpty(() => (logged = true))
    expect(logged).toBe(true)
    expect(liveSitemap(live)).toBe(sitemapXml('https://www.wajeezacademy.com', PUBLIC_PAGES))
  })

  it('وllms.txt يسمّي المسارات المعروضة بقسمها', async () => {
    const txt = liveLlmsTxt(await serviceWith(first.course_ids).live())
    expect(txt).toContain('## المسارات المتاحة الآن')
    expect(txt).toContain(`/pathways/${first.id})`)
    expect(liveLlmsTxt(EMPTY_LIVE)).not.toContain('## المسارات المتاحة الآن')
  })
})
