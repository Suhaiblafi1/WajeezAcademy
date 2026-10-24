/* إطارُ لوحة الإدارة — أقسامٌ سبعةٌ في الشريط، وصفحاتُ القسم ألسنةٌ في أعلاه (٢٤ أكتوبر ٢٠٢٦).

   المرحلةُ الثانيةُ من مقترح لوحة الإدارة، والتصنيفُ وعلّتُه في `nav-map.ts`. وهنا ما لا تراه
   مراجعةُ شيفرة:

   ① **أين أنا** (`placeOf`): المسارُ يضيء قسمَه ولسانَه — وصفحةُ التفصيل تضيء لسانَ أهلها،
      و«الرئيسية» لا تضيء في كلّ صفحة، و«حسابي» لا يضيء شيئا.
   ② **ما ينتظرك** (`waitingCounts`): عددُ كلِّ لسانٍ من شارته أو من «ما ينتظرك»، لا من الاثنين —
      والقسمُ مجموعُ ألسنته، و«اليوم» عددُ كلِّ شيءٍ لا كلُّ شيءٍ ومهامُّك فوقه، وما لا يراه صاحبُه
      لا يُعدّ له.
   ③ **والإطار**: لا قائمةَ منسدلةً على الهاتف بل شريطُ الأقسام نفسُه، والألسنةُ أسماؤها القصيرة،
      ولسانٌ واحدٌ لا يُعرض شريطا. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { allSections, placeOf, sectionsFor, waitingCounts } from '@/pages/admin/nav-map'
import { ROLE_PERMISSIONS } from '../../../server/auth/permissions'

const bare = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
const LAYOUT = bare('src/pages/admin/AdminLayout.tsx')

const where = (path: string, sections = allSections) => {
  const p = placeOf(path, sections)
  return p ? [p.section.title, p.item.to] : null
}

describe('① أين أنا', () => {
  it('⚠️ المسار يضيء قسمه ولسانه — والجذر بالمطابقة التامة', () => {
    expect(where('/admin')).toEqual(['اليوم', '/admin'])
    expect(where('/admin/')).toEqual(['اليوم', '/admin'])
    expect(where('/admin/tasks')).toEqual(['اليوم', '/admin/tasks'])
    expect(where('/admin/trainers'), '«الطلبات» التبست بغيرها').toEqual(['المدربون', '/admin/trainers'])
    expect(where('/admin/trainer-run')).toEqual(['المدربون', '/admin/trainer-run'])
    expect(where('/admin/finance')).toEqual(['المال', '/admin/finance'])
  })

  it('⚠️ وصفحة التفصيل تضيء لسان أهلها', () => {
    expect(where('/admin/plans/c-123'), 'منهاج الشعبة بلا لسان').toEqual(['المدربون', '/admin/pending-plans'])
    expect(where('/admin/terms/t-1/clashes'), 'مواعيد الفصل بلا لسان').toEqual(['الشعب', '/admin/terms'])
  })

  it('⚠️ وما لا مكان له لا يضيء شيئا — ولا ينتحل «الرئيسية»', () => {
    expect(where('/admin/account')).toBeNull()
    expect(where('/admin/no-such-screen')).toBeNull()
  })

  it('والصلاحية لا تنقل شاشة من قسمها — من يملك الأتعاب وحدها يجدها وحدها تحت «المدربون»', () => {
    const fees = sectionsFor(['trainer.compensation.manage'])
    expect(fees.map((s) => [s.title, s.items.map((i) => i.tab)])).toEqual([
      ['اليوم', ['ينتظرك', 'مهامي']],
      ['المدربون', ['الأتعاب']],
    ])
    expect(where('/admin/trainer-compensation', fees)).toEqual(['المدربون', '/admin/trainer-compensation'])
    /* وحسابُ المالية يملك العقودَ معها — فيرى لسانيه هناك */
    expect(sectionsFor(ROLE_PERMISSIONS.finance).find((s) => s.title === 'المدربون')?.items.map((i) => i.tab))
      .toEqual(['العقود', 'الأتعاب'])
  })
})

describe('② ما ينتظرك', () => {
  it('⚠️ بند «ما ينتظرك» يعدّ في لسان رابطه — ولو حمل الرابط سؤالا', () => {
    const w = waitingCounts(allSections, { badges: {}, inbox: [{ href: '/admin/catalog?names=1', count: 4 }] })
    expect(w.byTab['/admin/catalog']).toBe(4)
    expect(w.bySection['الدورات']).toBe(4)
  })

  it('⚠️ وللسان شارته وحدها إن كانت له — لا تضاف إليها بنود «ما ينتظرك»', () => {
    const w = waitingCounts(allSections, {
      badges: { awaitingPlans: 2, awaitingCountersign: 1 },
      inbox: [{ href: '/admin/pending-plans', count: 2 }, { href: '/admin/trainers', count: 5 }],
    })
    expect(w.byTab['/admin/pending-plans'], 'عُدّت الخطط مرّتين').toBe(2)
    expect(w.bySection['المدربون']).toBe(2 + 1 + 5)
  })

  it('⚠️ و«اليوم» عدد كلّ شيء — لا كلّ شيء ومهامّك فوقه', () => {
    const w = waitingCounts(allSections, {
      badges: {},
      inbox: [{ href: '/admin/tasks', count: 3 }, { href: '/admin/support', count: 2 }, { href: '/admin/cohorts', count: 1 }],
    })
    expect(w.total).toBe(6)
    expect(w.byTab['/admin'], '«ينتظرك» لا يعدّ كلّ شيء').toBe(6)
    expect(w.byTab['/admin/tasks']).toBe(3)
    expect(w.bySection['اليوم'], 'عُدّت المهامّ مرّتين').toBe(6)
  })

  it('⚠️ وما لا يرى صاحبه لسانه لا يعدّ له', () => {
    const finance = sectionsFor(ROLE_PERMISSIONS.finance)
    const w = waitingCounts(finance, { badges: {}, inbox: [{ href: '/admin/trainers', count: 7 }, { href: '/admin/finance', count: 1 }] })
    expect(w.total, 'عُدّ لحساب المالية طابور لا يراه').toBe(1)
    expect(w.bySection['المدربون'] ?? 0).toBe(0)
  })
})

describe('③ والإطار', () => {
  it('⚠️ لا قائمة منسدلة على الهاتف — شريط الأقسام نفسه', () => {
    expect(LAYOUT, 'عادت القائمة المنسدلة').not.toMatch(/<select\b/)
    const mobile = LAYOUT.slice(LAYOUT.indexOf('<div className="w-full px-5 pt-3 sm:px-8 lg:hidden">'), LAYOUT.indexOf('<aside'))
    expect(mobile, 'لا شريط أقسام على الهاتف').toMatch(/<PortalTabs[\s\S]*label="أقسام الإدارة"[\s\S]*tabs=\{sections\.map\(/)
  })

  it('⚠️ والسكّة أقسام لا شاشات — وكلّ قسم يفتح أوّل ألسنته', () => {
    const aside = LAYOUT.slice(LAYOUT.indexOf('<aside'), LAYOUT.indexOf('</aside>'))
    expect(aside).toMatch(/sections\.map\(\(s\) => \{[\s\S]*?<Link\s+key=\{s\.title\}\s+to=\{s\.items\[0\]\.to\}/)
    expect(aside, 'عادت الشاشات بنودا في الشريط').not.toMatch(/s\.items\.map\(/)
  })

  /* ═══ والسكّةُ ضيّقةٌ لتسع الألسنةُ كلُّها على الحاسوب (قرار ٢٧ سبتمبر ٢٠٢٦) ═══
     قِيس بالمتصفّح: شريطٌ بعرض ١٢rem يُخرج من ألسنة «المدربون» التسعة اثنين إلى «المزيد» على ١٣٦٦
     وثلاثةً على ١٢٨٠، وبعرض ٦rem تُرى كلُّها من ١٢٨٠. فمن عرّضها عاد «المزيد» إلى الحاسوب. */
  it('⚠️ والسكّة بعرض ٦rem لا أعرض', () => {
    const aside = /<aside className="([^"]*)"/.exec(LAYOUT)?.[1] ?? ''
    expect(aside.split(/\s+/), 'عرضت السكّة — فتخرج ألسنة إلى «المزيد» على الحاسوب').toContain('w-24')
  })

  it('⚠️ ومرشّح الشاشات صار في لوحة البحث — أوّل ما تجده، بما يملكه صاحب الجلسة', () => {
    const palette = bare('src/components/SearchPalette.tsx')
    expect(LAYOUT, 'عاد مرشّح ثان في الإطار').not.toContain('ترشيح شاشات الإدارة بالاسم')
    expect(palette).toMatch(/sectionsFor\(user\?\.permissions\)\.flatMap\(\(s\) => s\.items\s*\.filter\(\(it\) => matchesQuery\(term, \[it\.label, it\.tab, it\.descAr, s\.title\]\)\)/)
    /* وأوّلُ ما في القائمة والأسهم: الشاشاتُ ثمّ ما جاء من الخادم */
    expect(palette).toMatch(/const flat = useMemo\(\(\) => \[\s*\.\.\.screens,/)
    expect(palette.indexOf('{screens.length > 0 && ('), 'الشاشات بعد نتائج الخادم').toBeLessThan(palette.indexOf('{groups && GROUP_META.map('))
  })

  it('⚠️ والألسنة بأسمائها القصيرة ونشاطها من موضعها — ولسان واحد لا يعرض شريطا', () => {
    const from = LAYOUT.indexOf('{place && place.section.items.length > 1 && (')
    const tabs = LAYOUT.slice(from, LAYOUT.indexOf('<h1', from))
    expect(tabs, 'شريط لسان واحد').toContain('place.section.items.length > 1')
    expect(tabs).toMatch(/label: it\.tab,/)
    expect(tabs, 'النشاط من المطابقة لا من الموضع — فصفحة التفصيل بلا لسان مضيء').toMatch(/active: place\.item\.to === it\.to,/)
  })
})
