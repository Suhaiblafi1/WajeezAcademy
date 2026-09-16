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
 *   ٢) مجموعةٌ تكبر فوق خمسٍ — وهي بذرةُ «الأكاديمية» نفسِها من جديد.
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

describe('تصنيفُ اللوحة · لكلّ شاشةٍ مجموعةٌ واحدة', () => {
  const GROUPS = groups()

  it('الكتلةُ تُقرأ أصلا — وإلّا فالفحصُ كلُّه زينة', () => {
    expect(BLOCK, 'كتلةُ المجموعات مفقودة').toBeTruthy()
    expect(GROUPS.length, 'لا مجموعاتِ في الكتلة').toBeGreaterThan(3)
  })

  it('كلُّ مسارِ إدارةٍ في `App.tsx` له مجموعةٌ — إلّا تحويلا أو شاشةَ حساب', () => {
    /* التحويلُ يُعرف بشكله: `element={<Navigate` — فلا يُنتظر له تبويب.
       و«حسابي» تُفتح من قائمة الحساب في الترويسة لا من تصنيفِ عمل. */
    const ACCOUNT = '/admin/account'
    const routes = [...APP.matchAll(/<Route path="(\/admin[^"]*)" element=\{([^}]*)/g)]
      .filter(([, , el]) => !el.includes('<Navigate'))
      .map(([, path]) => path)
      .filter((p) => p !== ACCOUNT)

    expect(routes.length, 'لم تُقرأ مساراتُ الإدارة من App.tsx').toBeGreaterThan(20)

    const placed = GROUPS.flatMap((g) => g.routes)
    const orphans = routes.filter((r) => !placed.includes(r))
    expect(orphans, `شاشةٌ بلا مجموعة — لا يبلغها إلّا من يعرف عنوانها:\n${orphans.join('\n')}`).toEqual([])
  })

  it('ولا شاشةَ في مجموعتين — فالباحثُ عنها يجدها مرّةً لا مرّتين', () => {
    const placed = GROUPS.flatMap((g) => g.routes)
    const twice = placed.filter((r, i) => placed.indexOf(r) !== i)
    expect([...new Set(twice)], 'شاشةٌ مكرَّرةٌ في مجموعتين').toEqual([])
  })

  it('والمجموعةُ بين اثنتين وخمسٍ — فلا تعود «الأكاديمية» ذاتُ الثماني عشرة', () => {
    /* الحدُّ الأعلى هو الحارسُ الحقيقيّ: ما فوق خمسٍ يُمسح بالعين مسحَ قائمة
       لا مسحَ مجموعة. والأدنى يمنع عنوانا لشاشةٍ واحدة. */
    const bad = GROUPS.filter((g) => g.routes.length < 2 || g.routes.length > 5)
      .map((g) => `${g.title}: ${g.routes.length}`)
    expect(bad, `مجموعةٌ خارج المدى (٢–٥):\n${bad.join('\n')}`).toEqual([])
  })

  it('ولكلّ شاشةٍ سطرٌ يقول ما تفعله — لا اسمٌ عارٍ', () => {
    /* بلا السطر لا يفرّق أحدٌ بين «طلبات المتعلّمين» و«الطلبة المسجَّلون»،
       فيفتح الاثنتين ليعرف. والفحصُ على **عدد** البنود لا على ورودِ الحقل:
       حقلٌ واحدٌ مكتوبٌ يُرضي `toContain` وتسعةٌ وعشرون بلا سطر. */
    const items = [...BLOCK.matchAll(/to: "\/admin[^"]*"/g)].length
    const descs = [...BLOCK.matchAll(/descAr: "([^"]{8,})"/g)].length
    expect(descs, `${items} شاشةً و${descs} سطرَ وصف — بعضُها بلا سطر`).toBe(items)
  })
})

describe('تصنيفُ اللوحة · الدليلُ والقائمةُ من مصدرٍ واحد', () => {
  it('الدليلُ يقرأ `sectionsFor` ولا يكتب قائمتَه', () => {
    expect(DIRECTORY, 'الدليلُ لا يقرأ مصدرَ القائمة').toContain('sectionsFor')
    /* ولا يكتب مسارا بيده: نسخةٌ ثانيةٌ تفترق عن الأولى عند أوّل تعديل */
    const own = [...DIRECTORY.matchAll(/to="\/admin[^"]*"/g)].map((m) => m[0])
    expect(own, `الدليلُ يكتب مساراتِه بيده:\n${own.join('\n')}`).toEqual([])
  })

  it('والترشيحُ بالصلاحية يقع في المصدر الواحد لا في كلٍّ بنسخته', () => {
    expect(NAV, 'لا دالّةَ ترشيحٍ مشتركة').toContain('export function sectionsFor')
    /* والشريطُ نفسُه يستعملها — وإلّا بقيت الدالّةُ للدليل وحدَه */
    expect(LAYOUT, 'الشريطُ لا يستعمل الدالّةَ المشتركة').toContain('sectionsFor(user?.permissions)')
  })
})
