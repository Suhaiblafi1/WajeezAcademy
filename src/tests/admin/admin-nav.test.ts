/* تصنيفُ لوحة الإدارة — مجموعاتٌ تُقرأ، لا درجٌ يُفتَّش.
 *
 * ── العطبُ الذي وُلد منه، مقيسا ──
 *
 * كانت الشاشاتُ الثمانيَ والعشرون في ثلاثة أبواب، بابٌ منها («الأكاديمية»)
 * يحمل **ثمانيَ عشرة**: كتالوجا وتأليفا ونشرا وشعبا ومواسمَ وطلبةً وخمسَ
 * شاشاتِ مدرّبين وثلاثَ شاشاتِ مستشارين وجودةَ تشخيصٍ وتقييمات.
 *
 * وشاشاتُ المدرّبين مفرَّقةٌ على بابين: خمسٌ هناك و«أتعاب المدربين» في
 * «الأمور الفنّية» — وُضعت هناك لأنّ صلاحيّتَها ماليّة. أي أنّ **حارسَ
 * الصلاحية كان يرسم التصنيف**، وهما شيئان: الصلاحيةُ تقرّر من يرى،
 * والتصنيفُ يقرّر أين يبحث.
 *
 * ── وما يحرسه هذا الملفّ ──
 *
 * ثلاثةٌ لا تُرى في مراجعةِ شيفرةٍ ولا تُحمِّر شيئا وحدَها:
 *
 *   ١) شاشةٌ تُضاف بلا مجموعة — تصير بابا لا يبلغه أحدٌ إلّا بعنوانه.
 *   ٢) قسمٌ يكبر فوق تسعة ألسنة — وهي بذرةُ «الأكاديمية» نفسِها من جديد (وكانت «فوق خمسٍ»
 *      حين كانت المجموعاتُ بنودا في الشريط، قبل الأقسام السبعة في ٢٤ أكتوبر ٢٠٢٦).
 *   ٣) دليلٌ يفترق عن قائمة — فيَعِد بشاشةٍ لا بابَ لها، أو يخفي بابا قائما.
 *
 * والفحصُ على **البنية** لا على ورود حرف: المسارات تُقرأ من `App.tsx`،
 * والمجموعاتُ من كتلة `allSections`، والتحويلاتُ (`<Navigate`) تُستثنى
 * بشكلها لا باسمها — فلا قائمةَ استثناءاتٍ تتقادم.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const NAV = read('src/pages/admin/nav-map.ts')
const LAYOUT = read('src/pages/admin/AdminLayout.tsx')
const APP = read('src/App.tsx')
const DIRECTORY = read('src/components/admin/ScreenDirectory.tsx')

/** كتلةُ المجموعات وحدَها — لا التعليقاتُ حولها ولا بقيّةُ الملفّ */
const BLOCK = /export const allSections[\s\S]*?\n\];/.exec(NAV)?.[0] ?? ''

/** المجموعاتُ كما كُتبت: عنوانٌ ثمّ مساراتُ بنودها */
function groups(): { title: string; routes: string[] }[] {
  const out: { title: string; routes: string[] }[] = []
  /* كلُّ `title:` يفتح مجموعةً، وما بعده من `to: "/admin…"` لها حتّى التالي */
  const marks = [...BLOCK.matchAll(/title: "([^"]+)"/g)]
  marks.forEach((m, i) => {
    const from = m.index!
    const to = i + 1 < marks.length ? marks[i + 1].index! : BLOCK.length
    const slice = BLOCK.slice(from, to)
    out.push({
      title: m[1],
      routes: [...slice.matchAll(/to: "(\/admin[^"]*)"/g)].map((r) => r[1]),
    })
  })
  return out
}

describe('تصنيف اللوحة · لكلّ شاشة مجموعة واحدة', () => {
  const GROUPS = groups()

  it('الكتلة تقرأ أصلا — وإلّا فالفحص كلّه زينة', () => {
    expect(BLOCK, 'كتلة المجموعات مفقودة').toBeTruthy()
    expect(GROUPS.length, 'لا مجموعات في الكتلة').toBeGreaterThan(3)
  })

  /* ═══ وصفحةُ تفصيلٍ تُفتح من شاشةٍ في مجموعة — لا تُصنَّف وحدَها (١١ أكتوبر ٢٠٢٦) ═══
     منهاجُ الشعبة في صفحته (`/admin/plans/:cohortId`) يُفتح من لسان «المنهاج» في بطاقة
     الخطّة، ولا معنى له بندا في القائمة بلا شعبة. فيُستثنى بشرطٍ يُفحص: أن يربط إليه ملفٌّ
     تعرضه شاشةٌ في مجموعة — وإلّا عاد «لا يبلغها إلّا من يعرف عنوانها». */
  const DETAIL: Record<string, { from: string; link: RegExp; shownOn: string }> = {
    '/admin/plans/:cohortId': {
      from: 'src/components/admin/TrainerPlanReview.tsx',
      link: /to=\{`\/admin\/plans\/\$\{cohortId\}`\}/,
      shownOn: '/admin/pending-plans',
    },
    /* وملفُّ المدرّب — يُفتح من صفّه في «الطلبات» ومن بطاقته في «المدربون» (٢٤ أكتوبر ٢٠٢٦، المرحلة الثالثة) */
    '/admin/trainers/:id': {
      from: 'src/pages/admin/TrainerRunOps.tsx',
      link: /to=\{`\/admin\/trainers\/\$\{t\.applicationId\}`\}/,
      shownOn: '/admin/trainer-run',
    },
    /* ومواعيدُ الفصل بلا تعارض لفصلٍ بعينه — تُفتح من بطاقته في «المواسم والتقويم» (٢٢ أكتوبر ٢٠٢٦) */
    '/admin/terms/:id/clashes': {
      from: 'src/pages/admin/Terms.tsx',
      link: /to=\{`\/admin\/terms\/\$\{t\.id\}\/clashes`\}/,
      shownOn: '/admin/terms',
    },
  }

  it('وصفحة التفصيل يربط إليها ملفّ تعرضه شاشة في مجموعة', () => {
    const placed = GROUPS.flatMap((g) => g.routes)
    for (const [path, d] of Object.entries(DETAIL)) {
      expect(APP, `${path} ليس في App.tsx`).toContain(`<Route path="${path}"`)
      expect(read(d.from), `لا يربط ${d.from} إلى ${path}`).toMatch(d.link)
      expect(placed, `${d.shownOn} ليست في مجموعة`).toContain(d.shownOn)
    }
  })

  it('كلّ مسار إدارة في `App.tsx` له مجموعة — إلّا تحويلا أو شاشة حساب', () => {
    /* التحويلُ يُعرف بشكله: `element={<Navigate` — فلا يُنتظر له تبويب.
       و«حسابي» تُفتح من قائمة الحساب في الترويسة لا من تصنيفِ عمل. */
    const ACCOUNT = '/admin/account'
    const routes = [...APP.matchAll(/<Route path="(\/admin[^"]*)" element=\{([^}]*)/g)]
      .filter(([, , el]) => !el.includes('<Navigate'))
      .map(([, path]) => path)
      .filter((p) => p !== ACCOUNT)
      .filter((p) => !(p in DETAIL))

    expect(routes.length, 'لم تقرأ مسارات الإدارة من App.tsx').toBeGreaterThan(20)

    const placed = GROUPS.flatMap((g) => g.routes)
    const orphans = routes.filter((r) => !placed.includes(r))
    expect(orphans, `شاشة بلا مجموعة — لا يبلغها إلّا من يعرف عنوانها:\n${orphans.join('\n')}`).toEqual([])
  })

  it('ولا شاشة في مجموعتين — فالباحث عنها يجدها مرّة لا مرّتين', () => {
    const placed = GROUPS.flatMap((g) => g.routes)
    const twice = placed.filter((r, i) => placed.indexOf(r) !== i)
    expect([...new Set(twice)], 'شاشة مكرّرة في مجموعتين').toEqual([])
  })

  /* ═══ سبعةُ أقسامٍ بألسنة — لا مجموعاتٌ بين اثنتين وخمس (٢٤ أكتوبر ٢٠٢٦) ═══

     كان الحارسُ هنا «المجموعةُ بين اثنتين وخمس»، لأنّ المجموعةَ كانت بنودا في الشريط الجانبيّ يُمسح
     بالعين. ثمّ صار الشريطُ أقسامًا سبعةً وصفحاتُ القسم ألسنةً في أعلاه — المرحلةُ الثانيةُ من مقترح
     لوحة الإدارة، وقال صاحبُ المنصّة «اختر أنت». فالذي يُحرَس الآن: أسماءُ الأقسام وترتيبُها كما
     عُرضت، وألسنةُ كلِّ قسمٍ بين اثنين وتسعة. وتسعةٌ لأنّ كلَّ شاشةٍ باقيةٌ اليومَ في «المدربون»؛
     وتنزل حين تُدمج (الانضمامُ والظهور) — وتنزل معها هذه، ولا ترتفع لتمرّ شاشةٌ عاشرة. */
  it('والأقسام سبعة بأسمائها وترتيبها', () => {
    expect(GROUPS.map((g) => g.title)).toEqual(['اليوم', 'المدربون', 'الشعب', 'الدورات', 'المستشارون', 'المال', 'الإدارة'])
  })

  it('والقسم بين لسانين وتسعة — فلا يعود درجا في الأعلى بدل الجانب', () => {
    const bad = GROUPS.filter((g) => g.routes.length < 2 || g.routes.length > 9)
      .map((g) => `${g.title}: ${g.routes.length}`)
    expect(bad, `قسم خارج المدى (٢–٩):\n${bad.join('\n')}`).toEqual([])
  })

  it('ولكلّ شاشة اسم قصير للسانها — لا يتكرّر في قسمه', () => {
    /* على البنية لا على ورود الحقل: عددُ الأسماء القصيرة عددُ الشاشات، ولا لسانان باسمٍ واحد في قسم */
    const items = [...BLOCK.matchAll(/to: "\/admin[^"]*"/g)].length
    const tabs = [...BLOCK.matchAll(/label: "[^"]+", tab: "([^"]+)"/g)].length
    expect(tabs, `${items} شاشة و${tabs} اسما قصيرا — بعضها بلا لسان`).toBe(items)
    for (const g of GROUPS) {
      const from = BLOCK.indexOf(`title: "${g.title}"`)
      const next = GROUPS[GROUPS.indexOf(g) + 1]
      const slice = BLOCK.slice(from, next ? BLOCK.indexOf(`title: "${next.title}"`) : BLOCK.length)
      const names = [...slice.matchAll(/tab: "([^"]+)"/g)].map((m) => m[1])
      expect(names.filter((n, i) => names.indexOf(n) !== i), `لسانان باسم واحد في «${g.title}»`).toEqual([])
    }
  })

  it('ولكلّ شاشة سطر يقول ما تفعله — لا اسم عار', () => {
    /* بلا السطر لا يفرّق أحدٌ بين «طلبات المتعلّمين» و«الطلبة المسجَّلون»،
       فيفتح الاثنتين ليعرف. والفحصُ على **عدد** البنود لا على ورودِ الحقل:
       حقلٌ واحدٌ مكتوبٌ يُرضي `toContain` وتسعةٌ وعشرون بلا سطر. */
    const items = [...BLOCK.matchAll(/to: "\/admin[^"]*"/g)].length
    const descs = [...BLOCK.matchAll(/descAr: "([^"]{8,})"/g)].length
    expect(descs, `${items} شاشة و${descs} سطر وصف — بعضها بلا سطر`).toBe(items)
  })
})

describe('تصنيف اللوحة · الدليل والقائمة من مصدر واحد', () => {
  it('الدليل يقرأ `sectionsFor` ولا يكتب قائمته', () => {
    expect(DIRECTORY, 'الدليل لا يقرأ مصدر القائمة').toContain('sectionsFor')
    /* ولا يكتب مسارا بيده: نسخةٌ ثانيةٌ تفترق عن الأولى عند أوّل تعديل */
    const own = [...DIRECTORY.matchAll(/to="\/admin[^"]*"/g)].map((m) => m[0])
    expect(own, `الدليل يكتب مساراته بيده:\n${own.join('\n')}`).toEqual([])
  })

  it('والترشيح بالصلاحية يقع في المصدر الواحد لا في كلّ بنسخته', () => {
    expect(NAV, 'لا دالّة ترشيح مشتركة').toContain('export function sectionsFor')
    /* والشريطُ نفسُه يستعملها — وإلّا بقيت الدالّةُ للدليل وحدَه */
    expect(LAYOUT, 'الشريط لا يستعمل الدالّة المشتركة').toContain('sectionsFor(user?.permissions)')
  })
})
