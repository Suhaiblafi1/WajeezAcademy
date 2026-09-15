/* حارسُ حدَّي رقاقات الرئيسة: لا تحت ثلاثةٍ ولا فوق أربعة.

   ═══ العطبُ الذي يحرسه ═══

   شريطا «مختارات وجيز» يُصفَّيان بالمجال، والانتقاءُ التحريريُّ لا يوزَّع
   بالتساوي على المجالات. فكان الزائرُ يضغط «إدارة المشاريع والعمليات» فيرى
   **بطاقةً واحدة** في شريطٍ عرضُه ثلاث، و«القطاع الحكومي» كذلك. ورقاقةٌ تفتح
   على بطاقةٍ واحدةٍ تُقرأ عطبا لا تصفية.

   ═══ ولمَ على الكتالوج الحيّ لا على أمثلةٍ وحدَها ═══

   القاعدةُ في `CLAUDE.md`: الفحصُ على البنية. والبنيةُ هنا **التقاءُ** الدالّة
   بالبيانات: `shownFor` تُتِمّ الثلاثةَ من المجال، فإن ضاق المجالُ فمن خارجه —
   ولا يُعرف أيُّ المجالات يضيق إلّا من الكتالوج نفسِه. فلو أُضيف مجالٌ جديد
   أو حُذف مسارٌ من مجالٍ ضيّق، أمسكه هذا الملفّ.

   والأمثلةُ المؤلَّفةُ تحته تحرس ما لا تظهره البيانات اليوم: ترتيبَ الدرجات
   الثلاث، وألّا يلبس المقترَحُ وسمَ المختار. */

import '../setup-catalog'
import { describe, expect, it } from 'vitest'
import {
  ALL_AR, MAX_PER_FILTER, MIN_PER_FILTER, filterRows, shownFor, type PickSource,
} from '@/application/catalog/home-picks'
import { bestsellers, pathwayById, pathwayDomain, pathways, type Pathway } from '@/data/pathways'
import { bestsellerCourses, courses, type Course } from '@/data/courses'

/* المصدران كما تبنيهما الرئيسة — المميّزةُ مستثناةٌ من شريط المسارات لأنّها
   معروضةٌ فوقه في بطاقتها. */
const spotlightId = bestsellers.map((b) => b.id).find((id) => pathwayById(id))!

const pathSource: PickSource<Pathway> = {
  editorial: bestsellers,
  pool: pathways,
  idOf: (p) => p.id,
  domainOf: (p) => pathwayDomain(p.id),
  exclude: [spotlightId],
}

const courseSource: PickSource<Course> = {
  editorial: bestsellerCourses,
  pool: courses,
  idOf: (c) => c.id,
  domainOf: (c) => pathwayDomain(c.pathwayId),
}

describe('رقاقاتُ الرئيسة — حدّان على ما تُظهره كلُّ رقاقة', () => {
  /* ── ولمَ يُكتب الرقمان هنا صراحةً ──

     جُرّب الحارسُ أوّلا بـ`toBeGreaterThanOrEqual(MIN_PER_FILTER)`، فنُقض
     بإنزال الأرضيّة إلى واحد — **فخضرّ**: الحارسُ يقيس بالمسطرة التي يحرسها،
     فمن غيّر المسطرة غيّر الحكمَ معها. فالرقمُ المقرَّر يُثبَّت هنا مرّةً،
     وتُقاس الرقاقاتُ بالعدد نفسِه صريحا تحته. */
  it('الحدّان هما ما قُرّر: أرضيّةٌ ثلاثةٌ وسقفٌ أربعة', () => {
    expect(MIN_PER_FILTER).toBe(3)
    expect(MAX_PER_FILTER).toBe(4)
  })

  it('الكتالوجُ مقروءٌ فعلا — وإلّا خضرَّ ما بعده على الفراغ', () => {
    expect(pathways.length).toBeGreaterThan(MIN_PER_FILTER)
    expect(courses.length).toBeGreaterThan(MIN_PER_FILTER)
    expect(bestsellers.length).toBeGreaterThan(0)
    expect(bestsellerCourses.length).toBeGreaterThan(0)
  })

  /* الشريطان يُفحصان بالقواعد نفسِها — ودالّةٌ مولّدةٌ لا مصفوفةٌ من مصدرين
     مختلفَي النوع: تلك تحتاج تحويلا يُسكت المترجِمَ، وهذه تحفظ النوعَ لكلٍّ. */
  const forSurface = <T,>(name: string, source: PickSource<T>) => {
    describe(name, () => {
      const rows = filterRows(source)

      it('لكلّ رقاقةٍ ثلاثٌ فأكثر', () => {
        expect(rows.length).toBeGreaterThan(0)
        for (const row of rows) {
          expect(row.shown.length, `رقاقة «${row.domain}» تحت الأرضيّة`).toBeGreaterThanOrEqual(3)
        }
      })

      it('ولا رقاقةَ فوق أربع — ولا «الكل»', () => {
        for (const row of rows) {
          expect(row.shown.length, `رقاقة «${row.domain}» فوق السقف`).toBeLessThanOrEqual(4)
        }
        expect(shownFor(source, ALL_AR).length, 'رقاقةُ «الكل» فوق السقف').toBeLessThanOrEqual(4)
      })

      it('وما يُعدّ هو ما يُعرض — الصفُّ نفسُه الذي يُصيَّر', () => {
        for (const row of rows) {
          expect(shownFor(source, row.domain)).toEqual(row.shown)
        }
      })

      it('ولا بطاقةَ مكرّرةٌ في رقاقةٍ واحدة', () => {
        for (const row of rows) {
          const ids = row.shown.map((s) => source.idOf(s.item))
          expect(new Set(ids).size, `تكرارٌ في «${row.domain}»`).toBe(ids.length)
        }
      })

      it('والمستثنى لا يعود من باب الإتمام', () => {
        for (const row of [...rows, { domain: ALL_AR, shown: shownFor(source, ALL_AR) }]) {
          for (const id of source.exclude ?? []) {
            expect(row.shown.map((s) => source.idOf(s.item)), `المستثنى ظهر في «${row.domain}»`).not.toContain(id)
          }
        }
      })

      it('والمختارُ يتقدّم المقترَح — لا يُدفن اختيارُ المؤلِّف تحت إتمامِ عدد', () => {
        for (const row of rows) {
          const kinds = row.shown.map((s) => s.kind)
          const lastEditorial = kinds.lastIndexOf('editorial')
          const firstFill = kinds.findIndex((k) => k !== 'editorial')
          if (lastEditorial >= 0 && firstFill >= 0) {
            expect(firstFill, `مقترَحٌ قبل مختارٍ في «${row.domain}»`).toBeGreaterThan(lastEditorial)
          }
        }
      })

      it('وما جاء من خارج المجال لا يجيء إلّا بعد أن يُستنفَد المجال', () => {
        for (const row of rows) {
          if (!row.shown.some((s) => s.kind === 'other')) continue
          const inDomain = source.pool.filter((x) => source.domainOf(x) === row.domain)
          const shownInDomain = row.shown.filter((s) => source.domainOf(s.item) === row.domain)
          const excluded = inDomain.filter((x) => (source.exclude ?? []).includes(source.idOf(x)))
          expect(shownInDomain.length, `«${row.domain}» خرجت من مجالها وفيه بقيّة`)
            .toBe(inDomain.length - excluded.length)
        }
      })

      it('والوسمُ الذهبيُّ للمختار وحدَه — المقترَحُ بلا وسمٍ يدّعيه', () => {
        for (const row of rows) {
          for (const s of row.shown) {
            if (s.kind === 'editorial') expect(s.note, `مختارٌ بلا وسمٍ في «${row.domain}»`).toBeTruthy()
            else expect(s.note, `مقترَحٌ لبس وسمَ المختار في «${row.domain}»`).toBeNull()
          }
        }
      })

      it('وكلُّ رقاقةٍ مجالُ مختارٍ — لا رقاقةَ اقتراحاتٍ خالصةٍ تحت «من اختيارنا»', () => {
        for (const row of rows) {
          expect(row.shown[0]?.kind, `رقاقة «${row.domain}» بلا مختارٍ أصلا`).toBe('editorial')
        }
      })
    })
  }

  forSurface('المسارات', pathSource)
  forSurface('الدورات', courseSource)
})

/* ═══ وأمثلةٌ مؤلَّفةٌ لما لا تُظهره بياناتُ اليوم ═══ */

interface Row { id: string; domain: string }
const fixture = (rows: Row[], editorial: { id: string; note: string }[], exclude?: string[]): PickSource<Row> => ({
  editorial,
  pool: rows,
  idOf: (r) => r.id,
  domainOf: (r) => r.domain,
  exclude,
})

describe('درجاتُ الإتمام الثلاث', () => {
  const pool: Row[] = [
    { id: 'a1', domain: 'أ' }, { id: 'a2', domain: 'أ' }, { id: 'a3', domain: 'أ' }, { id: 'a4', domain: 'أ' }, { id: 'a5', domain: 'أ' },
    { id: 'b1', domain: 'ب' },
  ]

  it('المختارُ وحدَه حين يبلغ الثلاثة — فلا يُقحَم اقتراحٌ على مجالٍ مكتفٍ', () => {
    const src = fixture(pool, [
      { id: 'a1', note: 'اختيار' }, { id: 'a2', note: 'اختيار' }, { id: 'a3', note: 'اختيار' },
    ])
    expect(shownFor(src, 'أ').map((s) => [s.item.id, s.kind])).toEqual([
      ['a1', 'editorial'], ['a2', 'editorial'], ['a3', 'editorial'],
    ])
  })

  it('والسقفُ أربعةٌ ولو كان المختارُ خمسة', () => {
    const src = fixture(pool, pool.filter((r) => r.domain === 'أ').map((r) => ({ id: r.id, note: 'اختيار' })))
    expect(shownFor(src, 'أ')).toHaveLength(MAX_PER_FILTER)
  })

  it('والنقصُ يُتَمّ من المجال نفسِه — لا من غيره ما دام فيه بقيّة', () => {
    const src = fixture(pool, [{ id: 'a1', note: 'اختيار' }])
    const shown = shownFor(src, 'أ')
    expect(shown.map((s) => s.kind)).toEqual(['editorial', 'domain', 'domain'])
    expect(shown.every((s) => s.item.domain === 'أ')).toBe(true)
  })

  it('فإن ضاق المجالُ كلُّه جاء الإتمامُ من خارجه — ووُسم بأنّه من خارجه', () => {
    const src = fixture(pool, [{ id: 'b1', note: 'اختيار' }, { id: 'a1', note: 'اختيار' }])
    const shown = shownFor(src, 'ب')
    expect(shown).toHaveLength(MIN_PER_FILTER)
    expect(shown[0]).toMatchObject({ kind: 'editorial' })
    expect(shown.slice(1).map((s) => s.kind)).toEqual(['other', 'other'])
    /* والمختارُ من خارج المجال يسبق غيرَ المختار — أقربُ ما يُقترح ما اختير */
    expect(shown[1].item.id).toBe('a1')
  })

  it('و«الكل» لا تستدعي خارجا — لا خارجَ لها', () => {
    const src = fixture([{ id: 'a1', domain: 'أ' }], [{ id: 'a1', note: 'اختيار' }])
    expect(shownFor(src, ALL_AR).map((s) => s.kind)).toEqual(['editorial'])
  })

  it('والمستثنى لا يُحسب ولا يُعرض — ولو كان مختارا', () => {
    const src = fixture(pool, [{ id: 'a1', note: 'اختيار' }, { id: 'a2', note: 'اختيار' }], ['a1'])
    const shown = shownFor(src, 'أ')
    expect(shown.map((s) => s.item.id)).not.toContain('a1')
    expect(shown).toHaveLength(MIN_PER_FILTER)
  })

  it('ورقاقاتُ الصفّ مجالاتُ المختار بترتيبه — لا كلُّ مجالٍ في الكتالوج', () => {
    const src = fixture(pool, [{ id: 'b1', note: 'اختيار' }, { id: 'a1', note: 'اختيار' }])
    expect(filterRows(src).map((r) => r.domain)).toEqual(['ب', 'أ'])
  })
})
