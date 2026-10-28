/* المساراتُ العامّة — ثمانيةٌ من الدورات المفتوحة، تُعرض حين تكون لكلّ دوراتها شعبة (٢١ أكتوبر ٢٠٢٦)،
   وعشرةٌ شخصيّةٌ من دورات الشتاء، والمسارُ لا يُعرض إلّا ولكلّ دورةٍ منه شعبةٌ في فصله (٢٨ أكتوبر ٢٠٢٦).

   القرارُ والعلّةُ في `data/public-pathways.ts`. وهنا ما يُحرس:
   · بياناتُها: دوراتٌ موجودةٌ في الكتالوج، ومجالٌ وفئةٌ من رقاقات الموقع، ونصٌّ بلا تشكيل.
   · وشرطُ ظهورها: دورةٌ واحدةٌ بلا شعبةٍ تُخفي المسار.
   · وأنّ القوائمَ العامّةَ لا تسرد مسارَ الكتالوج — وأنّ صفحتَه باقيةٌ لمن يملك رابطَها.
   · وأنّ التشخيصَ لا يراها: `launch_pathways` كما هي. */

import '../setup-catalog'
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import bundled from '../../data/catalog/core-catalog.v2.json'
import { publicBestsellers, publicPathwayById, publicPathways } from '@/data/public-pathways'
import { bestsellers, pathwayById, pathwayCategory, pathwayDomain, pathwayDomains, pathways } from '@/data/pathways'
import { courseById, courseCategories, pathwayDelivery, readyPathwayCourseIds } from '@/data/courses'
import { listedWhole, shownCounts, type ListedCourses } from '@/application/catalog/listed-courses'

const ready = (ids: string[]): ListedCourses => ({ state: 'ready', ids: new Set(ids) })
const allCourseIds = [...new Set(publicPathways.flatMap((p) => p.courseIds))]

describe('بياناتُ المسارات العامّة', () => {
  it('ثمانيةَ عشرَ بمعرّفاتٍ لا تتكرّر ولا تلتبس بمسار الكتالوج', () => {
    expect(publicPathways).toHaveLength(18)
    const ids = publicPathways.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(pathways.some((p) => p.id === id), `${id} معرّفُ مسارٍ في الكتالوج`).toBe(false)
  })

  it('⚠️ كلُّ دورةٍ فيها موجودةٌ في الكتالوج — وأربعٌ لكلّ مسار', () => {
    for (const p of publicPathways) {
      expect(p.courseIds, p.id).toHaveLength(4)
      for (const id of p.courseIds) expect(courseById(id), `${p.id}: ${id}`).toBeTruthy()
    }
  })

  it('والحجمُ من دوراتها لا مكتوب — ساعاتٌ وأسابيعُ ومهارات', () => {
    for (const p of publicPathways) {
      const weeks = p.courseIds.reduce((s, id) => s + courseById(id)!.weeks, 0)
      expect(p.durationWeeks, p.id).toBe(weeks)
      expect(p.totalHours, p.id).toBeGreaterThan(0)
      expect(p.coreSkills.length, p.id).toBeGreaterThan(0)
    }
  })

  it('ومجالُه وفئتُه من رقاقات الموقع — لا رقاقةَ لا يُنقر إليها', () => {
    for (const p of publicPathways) {
      expect(pathwayDomains, p.id).toContain(p.domain)
      expect(courseCategories, p.id).toContain(p.category)
      expect(pathwayDomain(p.id)).toBe(p.domain)
      expect(pathwayCategory(p.id)).toBe(p.category)
    }
  })

  it('⚠️ ونصوصُه بلا تشكيلٍ إعرابيّ — الشدّةُ وحدَها تبقى — وبلا «عرضك»', () => {
    for (const p of publicPathways) {
      for (const t of [p.name, p.shortName, p.audience, p.notFor, p.transformation, p.output, p.delivery]) {
        expect(t, p.id).toBeTruthy()
        expect(t, `${p.id}: تشكيل في «${t}»`).not.toMatch(/[ً-ِْ]/)
        expect(t, p.id).not.toMatch(/عرض[ً-ْ]*ك(?![ء-ي])/)
      }
    }
  })

  it('والمختاراتُ منها وحدَها — وكلُّ مختارٍ بوسمه', () => {
    expect(bestsellers).toBe(publicBestsellers)
    for (const b of publicBestsellers) {
      expect(publicPathwayById(b.id), b.id).toBeTruthy()
      expect(b.note, b.id).toBeTruthy()
    }
  })
})

describe('متى يُعرض المسار', () => {
  it('⚠️ حين تكون لكلّ دوراته شعبة — ودورةٌ واحدةٌ بلا شعبةٍ تُخفيه', () => {
    expect(listedWhole(publicPathways, ready(allCourseIds))).toHaveLength(18)
    /* «استراتيجية التسعير» في «من الفكرة إلى خطة عمل» وحدَه */
    const shown = listedWhole(publicPathways, ready(allCourseIds.filter((id) => id !== 'C-BIZ-104')))
    expect(shown.map((p) => p.id)).not.toContain('PP-BIZ')
    expect(shown).toHaveLength(17)
  })

  it('والدورةُ المشتركةُ تُخفي كلَّ مسارٍ هي فيه', () => {
    /* «الإلقاء» في «الخطابة» و«انطلاقتك المهنية» و«وظيفتك الأولى» و«اظهر بثقة» */
    const shown = listedWhole(publicPathways, ready(allCourseIds.filter((id) => id !== 'C-COMX-103')))
    for (const id of ['PP-SPK', 'PP-CAR', 'PP-FIRSTJOB', 'PP-VOICE']) expect(shown.map((p) => p.id)).not.toContain(id)
  })

  it('وقبل الجواب لا شيء، وإن تعذّر فكلُّها', () => {
    expect(listedWhole(publicPathways, { state: 'loading' })).toEqual([])
    expect(listedWhole(publicPathways, { state: 'failed' })).toHaveLength(18)
  })
})

/* ═══ وشعبتُها في فصل المسار (٢٨ أكتوبر ٢٠٢٦) ═══
   «أبقِ المساراتِ الحاليّةَ التي فيها دوراتٌ مستقبليّةٌ خارج فصل الشتاء مخفيّة». */
describe('المسارُ في فصله', () => {
  const WINTER = '2026-nov_jan'
  /** الجوابُ بفصول شعبه — `{ دورة: [فصل…] }` */
  const seasoned = (map: Record<string, string[]>): ListedCourses => ({
    state: 'ready',
    ids: new Set(Object.keys(map)),
    seasons: new Map(Object.entries(map).map(([id, keys]) => [id, new Set(keys)])),
  })

  /* المعروضُ يومَ القرار كما قاله الخادم: أربعٌ وعشرون دورةً شعبتُها في الشتاء، وتسعٌ بعده */
  const LATER: Record<string, string> = {
    'C-BIZ-103': '2027-feb_apr', 'C-BIZ-104': '2027-feb_apr', 'C-CYB-106': '2027-feb_apr',
    'C-CYB-104': '2027-may_jul', 'C-CYB-105': '2027-may_jul', 'C-NEG-104': '2027-may_jul',
    'C-NEG-105': '2027-aug_oct', 'C-NEG-101': '2027-nov_jan', 'C-NEG-103': '2028-may_jul',
  }
  const WINTER_IDS = [
    'C-AI-101', 'C-BIZ-101', 'C-BIZ-106', 'C-BIZ-108', 'C-COMX-103', 'C-COMX-104', 'C-COMX-107', 'C-COMX-108',
    'C-CYB-101', 'C-CYB-107', 'C-FIN-101', 'C-FINM-107', 'C-HR-104', 'C-HR-105', 'C-JOB-104', 'C-MGR-101',
    'C-MGR-107', 'C-MGR-108', 'C-MKT-101', 'C-MKT-103', 'C-MKT-106', 'C-PSY-109', 'C-SVC-101', 'C-WEL-102',
  ]
  const decisionDay = seasoned({
    ...Object.fromEntries(WINTER_IDS.map((id) => [id, [WINTER]])),
    ...Object.fromEntries(Object.entries(LATER).map(([id, key]) => [id, [key]])),
    /* «العلاقات العامة» لها شعبتان: في الشتاء وفي الصيف */
    'C-COMX-108': [WINTER, '2027-may_jul'],
  })

  it('⚠️ المساراتُ كلُّها لفصل الشتاء', () => {
    for (const p of publicPathways) expect(p.season, p.id).toBe(WINTER)
  })

  it('⚠️ يومَ القرار: الجديدةُ العشرةُ تُعرض، وما فيه دورةٌ بعد الشتاء يُخفى', () => {
    const shown = listedWhole(publicPathways, decisionDay).map((p) => p.id)
    expect(shown).toEqual([
      'PP-LAUNCH', 'PP-GROW', 'PP-FIRSTJOB', 'PP-LEAD', 'PP-PEOPLE', 'PP-VOICE', 'PP-FREELANCE', 'PP-TECH', 'PP-HOME', 'PP-SIDE',
      'PP-CAR', 'PP-MKT',
    ])
    /* لها كلِّها شعبةٌ — في فصلٍ آخر */
    for (const id of ['PP-BIZ', 'PP-SPK', 'PP-NEG', 'PP-CYB']) {
      for (const c of publicPathwayById(id)!.courseIds) expect([...WINTER_IDS, ...Object.keys(LATER)], `${id}: ${c}`).toContain(c)
      expect(shown, id).not.toContain(id)
    }
  })

  it('⚠️ ويعود المسارُ وحدَه حين تُفتح لدورته شعبةٌ في الشتاء', () => {
    const neg = publicPathwayById('PP-NEG')!
    const back = seasoned(Object.fromEntries(neg.courseIds.map((id) => [id, [LATER[id], WINTER]])))
    expect(listedWhole(publicPathways, back).map((p) => p.id)).toEqual(['PP-NEG'])
  })

  it('والخادمُ الأقدمُ بلا فصولٍ لا يُخفي مسارا', () => {
    expect(listedWhole(publicPathways, ready(allCourseIds))).toHaveLength(18)
  })

  it('⚠️ ودوراتُ الجديدة كلُّها لها شعبةٌ في الشتاء يومَ بُنيت', () => {
    for (const p of publicPathways.filter((x) => !['PP-BIZ', 'PP-MKT', 'PP-SPK', 'PP-NEG', 'PP-ENG', 'PP-CYB', 'PP-MGR', 'PP-CAR'].includes(x.id))) {
      for (const id of p.courseIds) expect(WINTER_IDS, `${p.id}: ${id}`).toContain(id)
    }
  })
})

describe('صفحةُ المسار', () => {
  it('العامُّ يُقرأ بمعرّفه — بدوراته الأربع وطريقة تقديمه', () => {
    const p = pathwayById('PP-MGR')!
    expect(p.shortName).toBe('المدير الجديد')
    expect(readyPathwayCourseIds('PP-MGR')).toEqual(publicPathwayById('PP-MGR')!.courseIds)
    expect(pathwayDelivery('PP-MGR')).toBeTruthy()
  })

  it('⚠️ ومسارُ الكتالوج باقٍ لمن يملك رابطَه — والتشخيصُ يحيل إليه', () => {
    for (const p of pathways) expect(pathwayById(p.id)?.id, p.id).toBe(p.id)
  })
})

describe('التشخيصُ لا يرى المسارات العامّة', () => {
  it('⚠️ `launch_pathways` بلا معرّفٍ منها', () => {
    const launch = (bundled as { launch_pathways: { id: string }[] }).launch_pathways.map((p) => p.id)
    for (const p of publicPathways) expect(launch).not.toContain(p.id)
    expect(pathways.map((p) => p.id)).toEqual(launch)
  })
})

/* القوائمُ العامّةُ للمسارات تسرد العامّةَ بشرطها — قسمُ المسارات والرئيسةُ والبحث. والفحصُ على البنية:
   لا يمرّ على `pathways` (مسار الكتالوج) مرورُ سرد — ترشيحٌ أو اقتطاعٌ أو تجميع — والسردُ بـ`listedWhole`. */
const SURFACES = ['../../pages/Catalog.tsx', '../../pages/home/Bestsellers.tsx', '../../components/PublicSearch.tsx']
/** سردٌ مباشرٌ لمسار الكتالوج: `pathways.filter(` · `pool: pathways` · `of pathways)` — و`.map(` لأسماء الإحالات مسموح */
const RAW_PASS = /(?<![\w(.])pathways\s*\.\s*(?:filter|slice|forEach)\s*\(|\bpool:\s*pathways\b|\bof\s+pathways\s*\)/

describe('القوائمُ العامّة تسرد المساراتِ العامّة وحدَها', () => {
  for (const rel of SURFACES) {
    it(`⚠️ ${rel.split('/').pop()} لا تسرد مسارَ الكتالوج`, () => {
      const src = readFileSync(new URL(rel, import.meta.url), 'utf8')
      expect(src, 'تسرد مسارَ الكتالوج').not.toMatch(RAW_PASS)
      expect(src).toMatch(/listedWhole\(\s*publicPathways\s*,\s*listed\s*\)/)
    })
  }
})

/* ═══ وحجمُ الكتالوج في «من نحن» و«المنهجيّة»: ما يُعرض، وأنّه دفعةٌ أولى (٢١ أكتوبر ٢٠٢٦) ═══
   كانتا تقولان «٢٧ مسارا في الكتالوج» والقسمُ يعرض ثمانية. */
describe('ما يُقال عن حجم الكتالوج', () => {
  it('⚠️ يُعدّ ما يُعرض — ولا رقمَ قبل الجواب', () => {
    const someCourses = [{ id: 'C-BIZ-101' }, { id: 'C-X' }]
    expect(shownCounts(publicPathways, someCourses, { state: 'loading' })).toBeNull()
    expect(shownCounts(publicPathways, someCourses, ready(publicPathwayById('PP-BIZ')!.courseIds)))
      .toEqual({ pathways: 1, courses: 1 })
  })

  for (const rel of ['../../pages/About.tsx', '../../pages/Methodology.tsx']) {
    it(`⚠️ ${rel.split('/').pop()} تعدّ ما يُعرض وتقول إنّه دفعةٌ أولى`, () => {
      const src = readFileSync(new URL(rel, import.meta.url), 'utf8')
      expect(src, 'تعدّ مسارَ الكتالوج').not.toMatch(/(?<![\w.])pathways\.length/)
      expect(src).toMatch(/shownCounts\(publicPathways, courses,/)
      expect(src).toContain('TRIAL_NOTE_AR')
    })
  }
})
