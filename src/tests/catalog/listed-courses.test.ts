/* دوراتُ قوائم الموقع — ما له شعبةٌ أُعلنت ولم تنتهِ (٢١ أكتوبر ٢٠٢٦).

   القاعدةُ في الخادم (`listedCohortWhere`، ويحرسها `server/tests/catalog/listed-courses.test.ts`)، وهنا ما
   تفعله الواجهةُ بجوابها: كلُّ قائمةٍ عامّةٍ تمرّ بالمرشِّح نفسِه، فلا تُخفي صفحةٌ ما تُظهره أختُها. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { listedFromResponse, listedOnly, type ListedCourses } from '@/application/catalog/listed-courses'

const rows = [{ id: 'C-A' }, { id: 'C-B' }, { id: 'C-C' }]
const ready = (ids: string[]): ListedCourses => ({ state: 'ready', ids: new Set(ids) })

describe('المرشِّح', () => {
  it('⚠️ يُبقي ما له شعبةٌ وحدَه — بترتيبه', () => {
    expect(listedOnly(rows, ready(['C-C', 'C-A'])).map((r) => r.id)).toEqual(['C-A', 'C-C'])
  })

  it('⚠️ وقبل الجواب لا شيء — لا كتالوجٌ كاملٌ يومض ثمّ ينكمش', () => {
    expect(listedOnly(rows, { state: 'loading' })).toEqual([])
  })

  it('⚠️ وإن تعذّر الجوابُ فالكتالوجُ كلُّه — لا قسمٌ فارغ', () => {
    expect(listedOnly(rows, { state: 'failed' })).toHaveLength(3)
  })

  it('والجوابُ المعطوبُ لا يُقرأ قائمةً فارغة — بل تعذّرا', () => {
    expect(listedFromResponse({ courseIds: 'C-A' })).toBeNull()
    expect(listedFromResponse(null)).toBeNull()
    expect([...listedFromResponse({ courseIds: ['C-A', 3, '', 'C-B'] })!]).toEqual(['C-A', 'C-B'])
  })
})

/* كلُّ قائمةٍ عامّةٍ للدورات تمرّ بالمرشِّح — قسمُ الدورات والرئيسةُ والبحث.
   والفحصُ على البنية: لا يمرّ على `courses` (ولا المختارات) مرورٌ مباشر — ترشيحٌ أو تكرار — إلّا عبر `listedOnly`. */
const SURFACES = ['../../pages/Catalog.tsx', '../../pages/home/Bestsellers.tsx', '../../components/PublicSearch.tsx']
/** مرورٌ مباشرٌ على الكتالوج: `courses.filter(` · `courses\n.filter(` · `of courses)` · `bestsellerCourses,` في المختارات */
const RAW_PASS = /(?<![\w(])(?:courses|bestsellerCourses)\s*\.\s*(?:filter|map|slice|forEach)\s*\(|\bof\s+courses\s*\)|editorial:\s*bestsellerCourses\b/

describe('القوائمُ العامّة كلُّها بالمرشِّح نفسِه', () => {
  for (const rel of SURFACES) {
    it(`⚠️ ${rel.split('/').pop()} لا تسرد دورةً بلا شعبة`, () => {
      const src = readFileSync(new URL(rel, import.meta.url), 'utf8')
      expect(src, 'لا تقرأ جوابَ الخادم').toMatch(/useListedCourses\(\)/)
      expect(src, 'تمرّ على الكتالوج بلا مرشِّح').not.toMatch(RAW_PASS)
      expect(src).toMatch(/listedOnly\(\s*courses\s*,\s*listed\s*\)/)
    })
  }
})
