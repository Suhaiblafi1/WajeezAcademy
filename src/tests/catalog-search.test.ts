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
import { courseSearchFields, pathwaySearchFields } from '../application/catalog/search-fields'
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

  /* ٨١←١١٣ و٢٠←٢٦ (2026-09-16): خمسُ عائلاتِ دوراتٍ جديدة — GRPH ٦ · PSY ٨ ·
     EDU ٦ · INTR ٦ · ENGR ٦ — وستّةُ مساراتٍ لها.
     و١١٣←١١٧ و٢٦←٢٧ (2026-09-22): عائلةُ FAM بأربعِ دوراتٍ ومسارِ الأسرة
     والتربية. والعددُ يبقى مكتوبا لا محسوبا: حارسٌ يقارن الكتالوجَ بنفسِه
     يخضرّ وإن سقط نصفُه. */
  it('والكتالوجُ المقروءُ كاملٌ — ١١٧ دورةً و٢٧ مسارا', () => {
    expect(courses.length).toBe(117)
    expect(pathways.length).toBe(27)
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

  /* ═══ وكان هذا الفحصُ يقرأ نصَّ الشاشة — ولمَ لم يعد ═══

     كانت قائمةُ الحقول مكتوبةً في `Catalog.tsx`، فلم يكن أمامَ الحارس إلّا
     أن يلتقط نداءَ `matchesCatalogQuery` بتعبيرٍ نمطيٍّ ويفتّش فيه عن أسماء
     الحقول. وهو ما يحذّر منه المستودَع نصّا: الفحصُ على البنية لا على ورودِ
     حرفٍ في ملفّ. وقد أثبت هشاشتَه بنفسه — نُقلت القائمةُ إلى مالكها
     (ع-٨) فاحمرّ، والبحثُ لم ينقص حقلا واحدا.

     فصار على **القيم**: يأخذ مسارا حقيقيّا ويتحقّق أنّ ما يوصف به يصل
     الحقولَ فعلا. ويبقى شرطُ أنّ الشاشةَ تنادي المالكَ — فلا تعود قائمةٌ
     مكتوبةٌ بيدها من بابٍ آخر. */
  it('والحقولُ الموسَّعةُ داخلَ البحث فعلا — لا الاسمُ وحدَه', () => {
    const p = pathways.find((x) => x.shortName && x.audience && x.transformation && x.output)!
    const pFields = pathwaySearchFields(p).filter(Boolean) as string[]
    for (const [label, value] of [
      ['الاسم القصير', p.shortName], ['الجمهور', p.audience],
      ['التحوّل', p.transformation], ['المخرَج', p.output], ['المهارة', p.coreSkills[0]],
    ] as const) {
      expect(pFields, `${label} خارج بحث المسارات`).toContain(value)
    }

    const c = courses.find((x) => x.promise && x.audience && x.pathwayName && x.skills.length)!
    const cFields = courseSearchFields(c).filter(Boolean) as string[]
    for (const [label, value] of [
      ['الوعد', c.promise], ['الجمهور', c.audience],
      ['اسم المسار', c.pathwayName], ['المهارة', c.skills[0]],
    ] as const) {
      expect(cFields, `${label} خارج بحث الدورات`).toContain(value)
    }

    /* والشاشةُ لا تبني قائمةً بيدها: لو بنتها لمرّ ما سبق وهي تبحث في
       حقلَين — الفحصُ أعلاه على **المالك**، والشاشةُ قد تتجاوزه.

       والفحصُ على **غياب** الصيغة السيّئة لا على حضور اسم الدالّة: استيرادٌ
       معطَّلٌ يُبقي الاسمَ في الملفّ ويُرضي `toContain` بلا أن يُنادى شيء —
       وقد جُرّبت فمرّت. أمّا قائمةٌ مكتوبةٌ بين قوسَين فلا تُخفى. */
    const code = catalogPage.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
    expect(code, 'قائمةُ حقولٍ مكتوبةٌ في الشاشة تتجاوز مالكَها')
      .not.toMatch(/matchesCatalogQuery\(\s*q\s*,\s*\[/)
    expect(code, 'طبقاتُ رتبةٍ مكتوبةٌ في الشاشة تتجاوز مالكَها')
      .not.toMatch(/catalogRank\(\s*q\s*,\s*\[/)
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

  /* ⚠️ صُحّح في ٧ سبتمبر ٢٠٢٦ — الشبكةُ رُفعت من الرئيسة بقرار صاحب المنصّة

     كان هنا `toContain('<WhoAreYou />')`. ثمّ رأى صاحبُ المنصّة الرئيسةَ
     حيّةً فقال إنّ أوّلَ سؤالِ التشخيص لا مكانَ له فيها.

     **وما بقي من البند ٣١ محروسٌ كما هو**: المراحلُ تُقرأ من بنك الأسئلة،
     والتشخيصُ يقبل `?stage=` ويسلّمه للمحرّك قبل أوّل سؤال. فرابطٌ يحمله —
     من حملةٍ أو صفحةٍ أخرى — يعمل كما كان. والذي زال موضعُ العرض وحدَه. */
  it('والشبكةُ لا تُعرض في الرئيسيّة — قرارُ صاحب المنصّة', () => {
    expect(home, 'عادت شبكةُ «أين أنت الآن؟» إلى الرئيسة').not.toContain('<WhoAreYou />')
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
