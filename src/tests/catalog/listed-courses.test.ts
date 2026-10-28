/* دوراتُ قوائم الموقع — ما له شعبةٌ أُعلنت ولم تنتهِ (٢١ أكتوبر ٢٠٢٦).

   القاعدةُ في الخادم (`listedCohortWhere`، ويحرسها `server/tests/catalog/listed-courses.test.ts`)، وهنا ما
   تفعله الواجهةُ بجوابها: كلُّ قائمةٍ عامّةٍ تمرّ بالمرشِّح نفسِه، فلا تُخفي صفحةٌ ما تُظهره أختُها. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { availabilityNoteAr, listedFirst, listedFromResponse, listedOnly, seasonsFromResponse, type ListedCourses } from '@/application/catalog/listed-courses'

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

  it('وفصولُ الشعب تُقرأ — وغيابُها `null` لا فصولٌ فارغةٌ تُخفي كلَّ مسار', () => {
    expect(seasonsFromResponse({ courseIds: ['C-A'] })).toBeNull()
    expect(seasonsFromResponse({ seasons: ['2026-nov_jan'] })).toBeNull()
    const m = seasonsFromResponse({ seasons: { 'C-A': ['2026-nov_jan', 4, ''], 'C-B': 'x' } })!
    expect([...m.get('C-A')!]).toEqual(['2026-nov_jan'])
    expect(m.has('C-B')).toBe(false)
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

/* ═══ والتشخيصُ: ما يُشترى الآن أوّلا، والباقي «لم تفتح شعبتُه بعد» (٢١ أكتوبر ٢٠٢٦) ═══
   المحرّكُ يرشّح كما كان، والعرضُ يقدّم ما له شعبة ويقول حالَ كلٍّ. */
describe('ما يُشترى أوّلا', () => {
  it('⚠️ ما له شعبةٌ يتقدّم — وكلٌّ بترتيبه بين أمثاله', () => {
    expect(listedFirst(rows, ready(['C-C'])).map((r) => r.id)).toEqual(['C-C', 'C-A', 'C-B'])
  })

  it('والمجهولُ لا يُعاد ترتيبُه — ولا تُقال حالٌ لا تُعرف', () => {
    expect(listedFirst(rows, { state: 'failed' }).map((r) => r.id)).toEqual(['C-A', 'C-B', 'C-C'])
    expect(availabilityNoteAr('C-A', { state: 'loading' })).toBeNull()
    expect(availabilityNoteAr('C-A', ready(['C-A']))).toBe('لها شعبة')
    expect(availabilityNoteAr('C-B', ready(['C-A']))).toBe('لم تفتح شعبتها بعد')
  })
})

describe('نتيجةُ التشخيص تقدّم ما يُشترى وتقول حالَ كلّ دورة', () => {
  const PLAN = readFileSync(new URL('../../pages/diagnostic/ResultPlanCards.tsx', import.meta.url), 'utf8')
  const JOURNEY = readFileSync(new URL('../../components/CourseJourney.tsx', import.meta.url), 'utf8')

  it('⚠️ مقترحاتُ الاستبدال والإضافة كلُّها بـ«ما يُشترى أوّلا» قبل أن تُقتطع', () => {
    /* موضعان يقترحان: المسارُ الجاهز (PlanCourses) والخطّةُ المركّبة (ComposedSwap) */
    const cut = PLAN.match(/listedFirst\(ranked, listed\)\s*\.slice\(0, 6\)/g) ?? []
    expect(cut, 'مقترحاتٌ تُقتطع قبل أن يتقدّم ما له شعبة').toHaveLength(2)
    expect(PLAN, 'مقترحٌ يُقتطع من الكتالوج مباشرة').not.toMatch(/return courses\s*\.filter/)
  })

  it('⚠️ وكلُّ دورةٍ بلا شعبةٍ في الرحلة تحمل «أبلغني»', () => {
    expect(JOURNEY).toMatch(/<CourseInterestForm courseId=\{c\.id\} next=\{runningOnly\(c\.id\)\} \/>/)
  })
})
