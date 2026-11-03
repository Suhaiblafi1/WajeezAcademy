/* «المنح» لسانٌ واحد، وروابطُها في رأس صفحتها — وشريطُ الألسنة يلصق في كلّ الصفحات الداخلية (٣ نوفمبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «ابقِ هذا الشريطَ ثابتا لكلّ الصفحات الداخلية، وضع روابطَ المنح في مكانٍ معيّنٍ في صفحة
   المنح». فالمنحُ الثلاثُ تُطوى تحت لسانٍ واحد (`inTab`)، ويضيء هو في صفحاتها الثلاث، وتبقى كلُّ منحةٍ في الدليل
   والبحث باسمها. والفحصُ على البنية: الألسنةُ تُحسب بالدالّة التي يرسم بها الإطار، لا بورود اسمٍ في ملفّ. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { allSections, placeOf, sectionTabs, tabOf, type AdminNavSection } from '@/pages/admin/nav-map'
import { GRANT_SCREENS } from '@/pages/admin/grant-screens'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const MONEY = allSections.find((s) => s.title === 'المال')!
const GRANTS = ['/admin/member-grant', '/admin/influencer-grant', '/admin/open-grant']

describe('المنح لسان واحد في «المال»', () => {
  it('⚠️ لسان واحد للمنح الثلاث — لا ثلاثة', () => {
    const tabs = sectionTabs(MONEY).map((t) => t.to)
    expect(tabs.filter((t) => GRANTS.includes(t)), 'عادت المنح ألسنة في الشريط').toEqual(['/admin/member-grant'])
    expect(sectionTabs(MONEY).find((t) => t.to === '/admin/member-grant')?.tab).toBe('المنح')
  })

  it('⚠️ وفي كلّ صفحة منحة يضيء لسانها', () => {
    for (const path of GRANTS) {
      const place = placeOf(path, allSections)
      expect(place?.section.title, `${path} خارج «المال»`).toBe('المال')
      expect(tabOf(place!.section, place!.item).to, `${path} لا يضيء لسان المنح`).toBe('/admin/member-grant')
    }
  })

  it('وكلّ منحة باقية بندا باسمها — في الدليل والبحث', () => {
    const items = MONEY.items.map((it) => it.to)
    for (const path of GRANTS) expect(items, `${path} خرجت من القسم`).toContain(path)
  })

  it('ومن لا يرى لسان المنح يرى منحته لسانا — فلا شاشة بلا باب', () => {
    const without: AdminNavSection = { ...MONEY, items: MONEY.items.filter((it) => it.to !== '/admin/member-grant') }
    const tabs = sectionTabs(without).map((t) => t.to)
    expect(tabs).toContain('/admin/influencer-grant')
    expect(tabs).toContain('/admin/open-grant')
  })
})

describe('روابط المنح في رأس صفحتها', () => {
  it('⚠️ الثلاث في المبدّل، وكلّ مسار فيه بند في القسم', () => {
    expect(GRANT_SCREENS.map((g) => g.to)).toEqual(GRANTS)
  })

  it('⚠️ والصفحة ترسمه في كلّ أحوالها — تحميلا وانقطاعا وعرضا', () => {
    const page = read('src/pages/admin/MemberGrant.tsx')
    const layouts = [...page.matchAll(/<AdminLayout title=\{nameAr\}>\s*(?:\{\/\*[\s\S]*?\*\/\}\s*)?<GrantSwitcher current=\{variant\} \/>/g)]
    expect(layouts.length, 'حال من أحوال الصفحة بلا روابط المنح').toBe(page.split('<AdminLayout').length - 1)
  })
})

describe('شريط الألسنة يلصق في كلّ الصفحات الداخلية', () => {
  it('⚠️ لاصق تحت الترويسة — بأرضيّة يمرّ تحتها المتن', () => {
    const layout = read('src/pages/admin/AdminLayout.tsx')
    const at = layout.indexOf('look="chip"')
    expect(at, 'لا شريط ألسنة').toBeGreaterThan(-1)
    const open = [...layout.slice(0, at).matchAll(/<div className="([^"]*)"/g)].at(-1)?.[1].split(/\s+/) ?? []
    expect(open).toEqual(expect.arrayContaining(['sticky', 'top-16', 'bg-paper/90']))
  })
})
