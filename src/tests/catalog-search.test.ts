/* الكتالوجُ والبحث — سبعةُ أعطابٍ وحرسُها (البنود ٢٧–٣٣).

   ٢٧ · **صفحةٌ عنوانُها «كلّ الدورات» تعرض ٤ من ٨١**: القيمةُ الافتراضيّةُ
        لمرشِّح المجال كانت «أساسيات» لا «الكل».
   ٢٨ · **تصنيفان متعارضان في شاشةٍ واحدة**: جدولٌ ثانٍ (`PW_CATEGORY`) لا
        يعرف اثنتي عشرةَ عائلة، فيسقط ١٣ مسارا في «أساسيات» خطأً، ورقاقتان
        لا تُطابقان شيئا أبدا.
   ٢٩ · **البحثُ مطابقةُ نصٍّ حرفيّة**، والعربيّةُ لا تُكتب مرّتين بالشكل
        نفسِه: خمسةٌ من ثمانيةِ استعلاماتٍ واقعيّةٍ تُرجع صفرا.
   ٣٠ · **الاسمُ القصيرُ والجمهورُ و«ليس لك إن…»** مؤلَّفةٌ كلُّها في الكتالوج
        ولا تُعرض لأحد.
   ٣١ · **لا بابَ لمن لا يعرف ما يريد** — والرقاقاتُ تسأله بلغة الكتالوج.
   ٣٢ · **لوحُ البحث محجوبٌ على الموظّفين** — والزائرُ هو من جاء يبحث.
   ٣٣ · **الترتيبُ بالاسم لا يرتّب شيئا**: ٨١ عنوانا من ٨١ يبدأ بـ«دورة». */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import './setup-catalog'
import { pathways, pathwayDomain, pathwayDomains } from '../data/pathways'
import { courses } from '../data/courses'
import { catalogRank, matchesCatalogQuery } from '../application/catalog/catalog-search'
import { normalizeAr } from '../application/text/search-ar'
import { sortKeyAr } from '../application/catalog/course-title'
import { resolveCatalogRefsAr } from '../application/catalog/visitor-text'
import { STAGE_OPTIONS_AR, resolveEntryStage } from '../application/diagnostic/entry-stage'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const catalogPage = read('src/pages/Catalog.tsx')
const siteShell = read('src/components/SiteShell.tsx')
const home = read('src/pages/Home.tsx')
const diagnostic = read('src/pages/Diagnostic.tsx')

const pathwayFields = (p: (typeof pathways)[number]) =>
  [p.name, p.shortName, p.audience, p.transformation, p.output, ...p.coreSkills]
const courseFields = (c: (typeof courses)[number]) =>
  [c.name, c.promise, c.audience, c.pathwayName, ...c.skills]

describe('٢٧ · «كلّ الدورات» تعني كلَّها', () => {
  it('المرشِّحُ الافتراضيُّ «الكل» لا تصنيفٌ يُخفي ٩٥٪', () => {
    expect(catalogPage, 'الافتراضيُّ يُخفي الكتالوج')
      .toMatch(/params\.get\('cat'\) \?\? 'الكل'/)
  })

  it('والكتالوجُ المقروءُ كاملٌ — ٨١ دورةً و٢٠ مسارا', () => {
    expect(courses.length).toBe(81)
    expect(pathways.length).toBe(20)
  })
})

describe('٢٨ · تصنيفٌ واحدٌ لا اثنان', () => {
  it('لا جدولَ تصنيفٍ ثانٍ في صفحة الكتالوج', () => {
    expect(catalogPage, 'جدولٌ ثانٍ يفترق عن الدالّة المركزيّة').not.toContain('PW_CATEGORY')
  })

  it('وكلُّ رقاقةٍ معروضةٍ تُعطي نتيجةً واحدةً على الأقلّ — لا رقاقةَ ميّتة', () => {
    const dead = pathwayDomains
      .filter((d) => d !== 'الكل')
      .filter((d) => pathways.every((p) => pathwayDomain(p.id) !== d))
    expect(dead, `رقاقاتٌ لا تُطابق شيئا أبدا: ${dead.join('، ')}`).toEqual([])
  })

  it('ولا مسارَ بلا تصنيفٍ يعرفه شريطُ الرقاقات', () => {
    const orphans = pathways.filter((p) => !pathwayDomains.includes(pathwayDomain(p.id)))
    expect(orphans.map((p) => p.id), 'مسارٌ لا تبلغه أيُّ رقاقة').toEqual([])
  })
})

describe('٢٩ · ثمانيةُ استعلاماتٍ واقعيّة — وكان خمسةٌ منها يُرجع صفرا', () => {
  /* الجدولُ نفسُه الذي في التقرير، بالحرف. وشرطُ القبولِ المعلَن هناك:
     أن تُرجع الثمانيةُ كلُّها **نتيجةً ذاتَ صلة** — لا مجرّدَ نتيجة. */
  const QUERIES: [query: string, why: string][] = [
    ['ريادة الاعمال', 'تُكتب بلا همزةٍ في أغلب لوحات المفاتيح'],
    ['تسويق رقمي', 'بلا «أل»، وبترتيبٍ طبيعيّ'],
    ['اكسل', 'المرادفُ الشائعُ لجداول البيانات'],
    ['موارد بشرية', 'المصطلحُ المتداولُ في السوق'],
    ['ai', 'يكتبها كثيرون باللاتينيّة'],
    ['قيادة', 'كلمةٌ مفردةٌ مطابقة'],
    ['بيانات', 'كلمةٌ مفردةٌ مطابقة'],
    ['الذكاء الاصطناعي', 'مطابقٌ حرفيّا'],
  ]

  it.each(QUERIES)('«%s» تُرجع نتائج — %s', (query) => {
    const p = pathways.filter((x) => matchesCatalogQuery(query, pathwayFields(x)))
    const c = courses.filter((x) => matchesCatalogQuery(query, courseFields(x)))
    expect(p.length + c.length, `«${query}» تُرجع صفرا والمنصّةُ عندها ما يناسبها`).toBeGreaterThan(0)
  })

  /* ── ما يَعِد به الترتيبُ بالضبط ──

     لا يَعِد بأنّ كلَّ استعلامٍ يجد مطابقةً في اسم: «تسويق رقمي» كلمتان لا
     يجمعهما عنوانُ دورةٍ واحد، وأعلى ما تبلغه رتبةُ الوعدِ والمهارات. وإنّما
     يَعِد بشيئين: **ألّا يسبق الأدنى الأعلى**، وأنّ ما طابق في اسمه يبلغ
     القمّةَ حين يوجد. وهذان هما المقيسان. */
  it('والأدنى لا يسبق الأعلى — التوسعةُ لا تُصعّد مطابقةً عرضيّة', () => {
    const rank = (c: (typeof courses)[number], q: string) =>
      catalogRank(q, [[c.name], [c.promise, ...c.skills], [c.audience, c.pathwayName]])
    for (const q of ['تسويق رقمي', 'قيادة', 'بيانات']) {
      const ranks = courses
        .filter((c) => matchesCatalogQuery(q, courseFields(c)))
        .map((c) => rank(c, q))
        .sort((a, b) => b - a)
      expect(ranks.length, `«${q}» بلا نتائج`).toBeGreaterThan(1)
      for (let i = 1; i < ranks.length; i++) {
        expect(ranks[i], `«${q}» رتّبت الأدنى قبل الأعلى`).toBeLessThanOrEqual(ranks[i - 1])
      }
      expect(ranks[0], `«${q}» لا تجد أفضلَ من مطابقةٍ عرضيّة`).toBeGreaterThan(1)
    }
  })

  /* «أل» تنفع في الاتّجاه الذي تسقط فيه المطابقةُ بالاحتواء: من كتبها
     يريد ما لم يُكتب بها. والفرقُ مقيسٌ لا مفترَض. */
  it('ومن كتب «القيادة» يجد «قيادة الذات» — والاحتواءُ وحدَه يردّه', () => {
    const naive = (q: string, fields: string[]) => {
      const terms = normalizeAr(q).split(' ').filter(Boolean)
      const hay = fields.filter(Boolean).map(normalizeAr)
      return terms.every((t) => hay.some((h) => h.includes(t)))
    }
    const withAl = courses.filter((c) => matchesCatalogQuery('القيادة', courseFields(c))).length
    const without = courses.filter((c) => naive('القيادة', courseFields(c) as string[])).length
    expect(without, 'تغيّر الكتالوج — يُراجَع هذا الحارس').toBeLessThan(withAl)
    expect(withAl, '«القيادة» لا تجد ما كُتب «قيادة …»').toBeGreaterThanOrEqual(5)
  })

  it('وما طابق في اسمه يبلغ القمّة', () => {
    const rank = (c: (typeof courses)[number], q: string) =>
      catalogRank(q, [[c.name], [c.promise, ...c.skills], [c.audience, c.pathwayName]])
    const top = courses
      .filter((c) => matchesCatalogQuery('الذكاء الاصطناعي', courseFields(c)))
      .map((c) => rank(c, 'الذكاء الاصطناعي'))
      .sort((a, b) => b - a)[0]
    expect(top, 'مطابقةُ الاسم لم تبلغ أعلى رتبة').toBe(3)
  })

  /* يُقاس نداءُ البحث نفسُه لا ورودُ الاسم في الملفّ: `p.audience` تظهر في
     البطاقة أيضا (البند ٣٠)، فالفحصُ على النصّ كلِّه يمرّ ولو خرجت من البحث. */
  it('والحقولُ الموسَّعةُ داخلَ نداء البحث — لا الاسمُ وحدَه', () => {
    const call = (subject: string) =>
      new RegExp(`matchesCatalogQuery\\(q, \\[${subject}[^\\]]*\\]\\)`).exec(catalogPage)?.[0] ?? ''
    const pathwayCall = call('p\\.name')
    expect(pathwayCall, 'المساراتُ لا تُبحَث بالمطابقة العربيّة').toBeTruthy()
    for (const field of ['p.shortName', 'p.audience', 'p.transformation', 'p.output', 'p.coreSkills']) {
      expect(pathwayCall, `${field} خارج بحث المسارات`).toContain(field)
    }
    const courseCall = call('c\\.name')
    expect(courseCall, 'الدوراتُ لا تُبحَث بالمطابقة العربيّة').toBeTruthy()
    for (const field of ['c.promise', 'c.audience', 'c.pathwayName', 'c.skills']) {
      expect(courseCall, `${field} خارج بحث الدورات`).toContain(field)
    }
  })
})

describe('٣٠ · البطاقةُ تعرض ما أُلِّف لها', () => {
  it('الحقولُ الثلاثةُ موجودةٌ في كلّ مسارٍ من عشرين', () => {
    for (const p of pathways) {
      expect(p.shortName, `${p.id} بلا اسمٍ قصير`).toBeTruthy()
      expect(p.audience, `${p.id} بلا جمهور`).toBeTruthy()
      expect(p.notFor, `${p.id} بلا «ليس لك إن…»`).toBeTruthy()
    }
  })

  it('والاسمُ القصيرُ أقصرُ فعلا — وإلّا فالبطاقةُ لم تكسب شيئا', () => {
    const avgFull = pathways.reduce((s, p) => s + p.name.length, 0) / pathways.length
    const avgShort = pathways.reduce((s, p) => s + p.shortName.length, 0) / pathways.length
    expect(avgShort).toBeLessThan(avgFull * 0.75)
  })

  it('والبطاقةُ تعرضها — لا تحملها البياناتُ وحدَها', () => {
    expect(catalogPage).toContain('{p.shortName}')
    expect(catalogPage).toContain('ليس لك إن')
  })

  it('ولا معرِّفَ داخليٌّ يُعرض لزائر — «PW-STU-002» ليست إرشادا', () => {
    const nameById = new Map(pathways.map((p) => [p.id, p.shortName]))
    for (const p of pathways) {
      const shown = resolveCatalogRefsAr(p.notFor, (id) => nameById.get(id))
      expect(shown, `${p.id} يعرض معرِّفا داخليّا للزائر`).not.toMatch(/\b(?:PW|C)-[A-Z]{2,4}-\d{2,3}\b/)
    }
  })

  it('والإحالةُ المعروفةُ تصير اسما لا تُحذف', () => {
    const nameById = new Map(pathways.map((p) => [p.id, p.shortName]))
    const p = pathways.find((x) => x.id === 'PW-STU-003')!
    const shown = resolveCatalogRefsAr(p.notFor, (id) => nameById.get(id))
    expect(shown).toContain(nameById.get('PW-STU-002'))
  })
})

describe('٣١ · بابٌ لمن لا يعرف ما يريد', () => {
  it('المراحلُ العشرُ تُقرأ من بنك الأسئلة لا من جدولٍ ثانٍ', () => {
    expect(STAGE_OPTIONS_AR.length, 'المراحلُ لم تُقرأ من البنك').toBe(10)
  })

  it('والشبكةُ معروضةٌ في الرئيسيّة', () => {
    expect(home).toContain('<WhoAreYou />')
  })

  it('ومن أجاب فيها لا يُسأل ثانيةً — الجوابُ يُسلَّم للمحرّك قبل أوّل سؤال', () => {
    expect(diagnostic, 'التشخيصُ لا يقرأ ما جاء من الرئيسيّة').toContain('resolveEntryStage')
    expect(diagnostic, 'الجوابُ يُقرأ ولا يُسلَّم').toMatch(/session\.submit\(STAGE_QUESTION_ID/)
  })

  it('والمرحلةُ المجهولةُ تُتجاهَل بلا ضجّة — رابطٌ قديمٌ لا يُسقط التشخيص', () => {
    expect(resolveEntryStage('رائد فضاء')).toBeNull()
    expect(resolveEntryStage(null)).toBeNull()
    expect(resolveEntryStage(STAGE_OPTIONS_AR[0])).not.toBeNull()
  })
})

describe('٣٢ · البحثُ للزائر لا للموظّفين وحدَهم', () => {
  it('الترويسةُ العامّةُ تحمل بحثا', () => {
    expect(siteShell).toContain('PublicSearch')
    expect(siteShell).toContain('wajeez:open-public-search')
  })

  it('وهو يقرأ الكتالوجَ في المتصفّح لا الخادم — لا يكشف ما لا يُعرض', () => {
    const palette = read('src/components/PublicSearch.tsx')
    expect(palette, 'بحثُ الزائر ينادي الخادم').not.toMatch(/apiGet|apiPost|fetch\(/)
  })

  it('وبالمطابقة نفسِها التي في صفحة الكتالوج — لا نتيجتان لاستعلامٍ واحد', () => {
    const palette = read('src/components/PublicSearch.tsx')
    expect(palette).toContain('matchesCatalogQuery')
    expect(palette).toContain('catalogRank')
  })
})

describe('٣٣ · الترتيبُ بالاسم يرتّب فعلا', () => {
  it('٨١ عنوانا من ٨١ يبدأ بـ«دورة» — والمفتاحُ يتجاوزها', () => {
    const prefixed = courses.filter((c) => c.name.startsWith('دورة '))
    expect(prefixed.length, 'تغيّرت العناوين — يُراجَع هذا الحارس').toBe(courses.length)
    const keys = new Set(courses.map((c) => sortKeyAr(c.name)[0]))
    expect(keys.size, 'الفرزُ ما زال داخل حرفٍ واحد').toBeGreaterThan(5)
  })

  it('والعنوانُ المعروضُ لا يتغيّر — السابقةُ قرارُ صاحب المنتج', () => {
    expect(sortKeyAr('دورة القيادة')).toBe('القيادة')
    expect(courses[0].name.startsWith('دورة ')).toBe(true)
  })

  it('والصفحةُ ترتّب بالمفتاح لا بالعنوان', () => {
    expect(catalogPage).toMatch(/sortKeyAr\(a\.name\)\.localeCompare\(sortKeyAr\(b\.name\), 'ar'\)/)
  })
})
