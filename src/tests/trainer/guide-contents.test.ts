/* صفحةُ محتويات الدليل وعلامةُ «جديد» (٥ أكتوبر ٢٠٢٦).

   القرارُ في `src/data/trainer-guide/toc.ts`: قال صاحبُ المنصّة إنّه لا فهرسَ يدلّ
   على ما حُدّث، واختار صفحةَ محتوياتٍ بعد الغلاف. وما يُحرَس:

   ① **«جديد» شهرا من يوم الإضافة** بتوقيت عمّان، ثمّ تسقط وحدَها.
   ② **والفهرسُ يجمع أقسامَ الدليل كلَّها** — كلٌّ مرّةً، بترتيبه ورقمه.
   ③ **والصفحةُ تعرضه بعد الغلاف وقبل «رحلتك»** — كلُّ قسمٍ رابطٌ إلى مرساته برقمه،
      وتُطبع، ولم يبقَ الصندوقُ المطويّ.
   ④ **و«جديد» على القسم الجديد وحدَه** — في المحتويات والشريط ورأس القسم، ولا شيءَ
      بعد الشهر.

   والصفحةُ تُصيَّر بـ`react-dom/server` كما هي، بيومٍ مثبَّت — لا تُقرأ شيفرتُها نصّا. */

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TrainerGuide from '@/pages/trainer/Guide'
import { GUIDE_PARTS, GUIDE_SECTIONS, shortTitle } from '@/data/trainer-guide/content'
import { guideToc, isNewSince, NEW_FOR_DAYS } from '@/data/trainer-guide/toc'

const pad2 = (n: number) => String(n).padStart(2, '0')
const at = (iso: string) => new Date(iso)

describe('① «جديد» شهرا من يوم الإضافة', () => {
  const added = '2026-10-04'
  it('من أوّل يومه بتوقيت عمّان — لا من منتصف ليل غرينتش', () => {
    expect(isNewSince(added, at('2026-10-03T21:00:00Z'))).toBe(true)
    expect(isNewSince(added, at('2026-10-03T20:59:59Z')), 'قبل يومه').toBe(false)
  })
  it(`ويبقى ${NEW_FOR_DAYS} يوما، ثمّ يسقط`, () => {
    const start = Date.parse('2026-10-03T21:00:00Z')
    expect(isNewSince(added, new Date(start + NEW_FOR_DAYS * 86_400_000 - 1))).toBe(true)
    expect(isNewSince(added, new Date(start + NEW_FOR_DAYS * 86_400_000))).toBe(false)
  })
  it('ولا «جديد» لقسمٍ بلا يوم، ولا ليومٍ لا يُقرأ', () => {
    expect(isNewSince(undefined, at('2026-10-05T09:00:00Z'))).toBe(false)
    expect(isNewSince('4 أكتوبر', at('2026-10-05T09:00:00Z'))).toBe(false)
    expect(isNewSince('2026-13-45', at('2026-10-05T09:00:00Z'))).toBe(false)
  })
})

describe('② والفهرسُ يجمع أقسامَ الدليل كلَّها', () => {
  const toc = guideToc(at('2026-10-05T09:00:00Z'))
  const parts = toc.filter((g) => g.kind === 'part')

  it('أجزاؤه أجزاءُ الدليل، وبينها التمهيدُ والخاتمة', () => {
    expect(parts.map((g) => g.title)).toEqual(GUIDE_PARTS.map((p) => p.title))
    expect(toc[0].kind).toBe('before')
    expect(toc[toc.length - 1].kind).toBe('after')
  })

  it('كلُّ قسمٍ مرّةً، بترتيبه في الدليل، ورقمُه ترتيبُه', () => {
    const items = parts.flatMap((g) => g.items)
    expect(items.map((it) => it.id), 'قسمٌ ناقصٌ أو مكرَّرٌ أو في غير موضعه').toEqual(GUIDE_SECTIONS.map((s) => s.id))
    expect(items.map((it) => it.n)).toEqual(GUIDE_SECTIONS.map((_, i) => i + 1))
    expect(items.map((it) => it.label)).toEqual(GUIDE_SECTIONS.map((s) => shortTitle(s.title)))
  })
})

/* ─────────── الصفحة مُصيَّرة ─────────── */

afterEach(() => { vi.useRealTimers() })

function page(iso: string): string {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(iso))
  return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(TrainerGuide)))
}

/** ما بين فتح وسمٍ يحمل `id` وأوّلِ وسمِ `<section` بعده */
const slice = (html: string, id: string) => {
  const start = html.indexOf(`id="${id}"`)
  const end = html.indexOf('<section', start)
  return start < 0 ? '' : html.slice(start, end < 0 ? undefined : end)
}
/* والسماتُ بأيّ ترتيب: أداةُ التطوير تضع `code-path` أوّلَ كلّ وسمٍ في الاختبار */
const anchors = (html: string) =>
  [...html.matchAll(/<a\b[^>]*\bhref="#([a-z-]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({ id: m[1], inner: m[2] }))
const NEW = /data-hue="coral">جديد</

describe('③ والصفحةُ تعرضه بعد الغلاف وقبل «رحلتك»', () => {
  const html = page('2026-10-05T09:00:00Z')
  const contents = slice(html, 'contents')

  it('تُعرض فعلا — وإلّا خضرّ ما بعده على فراغ', () => {
    expect(contents.length, 'لا صفحةَ محتويات').toBeGreaterThan(500)
  })

  it('بعد الغلاف وقبل «رحلتُك في المنصّة»', () => {
    const cover = html.indexOf('id="guide-title"')
    const at = html.indexOf('id="contents"')
    expect(cover).toBeGreaterThan(-1)
    expect(at, 'المحتوياتُ قبل الغلاف').toBeGreaterThan(cover)
    expect(at, 'المحتوياتُ بعد «رحلتك»').toBeLessThan(html.indexOf('id="journey"'))
  })

  it('وتُطبع — صفحةٌ من صفحات الدليل لا شيءٌ يُخفى على الورق', () => {
    const open = /<section\b[^>]*\bid="contents"[^>]*>/.exec(html)?.[0] ?? ''
    expect(open).toMatch(/\bguide-page\b/)
    expect(open).not.toMatch(/guide-noprint/)
  })

  it('كلُّ قسمٍ رابطٌ إلى مرساته باسمه ورقمه، بترتيب الدليل', () => {
    const links = anchors(contents)
    expect(links.map((l) => l.id)).toEqual(['journey', 'first-week', ...GUIDE_SECTIONS.map((s) => s.id), 'faq', 'help'])
    for (const [i, s] of GUIDE_SECTIONS.entries()) {
      const l = links.find((x) => x.id === s.id)!
      expect(l.inner, `رابطُ ${s.id} بلا رقمه`).toContain(`>${pad2(i + 1)}<`)
      expect(l.inner, `رابطُ ${s.id} بلا اسمه`).toContain(shortTitle(s.title))
    }
  })

  it('ولم يبقَ الصندوقُ المطويّ', () => {
    expect(html).not.toMatch(/<details[^>]*>\s*<summary[^>]*>(?:(?!<\/summary>)[\s\S])*محتويات الدليل/)
  })
})

describe('④ و«جديد» على القسم الجديد وحدَه', () => {
  const fresh = GUIDE_SECTIONS.filter((s) => s.added && isNewSince(s.added, at('2026-10-05T09:00:00Z'))).map((s) => s.id)

  it('في الدليل اليومَ قسمٌ جديد — «معيارُ الموادّ» — وإلّا خضرّ ما بعده على فراغ', () => {
    expect(fresh).toEqual(['standard'])
  })

  it('في المحتويات والشريط الجانبيّ ورأس القسم — وعلى غيره لا', () => {
    const html = page('2026-10-05T09:00:00Z')
    const contents = anchors(slice(html, 'contents'))
    const sidebar = anchors(html.slice(html.indexOf('<aside'), html.indexOf('</aside>')))
    for (const [where, links] of [['المحتويات', contents], ['الشريط', sidebar]] as const) {
      const marked = links.filter((l) => NEW.test(l.inner)).map((l) => l.id)
      expect(marked, `«جديد» في ${where}`).toEqual(fresh)
    }
    const heads = GUIDE_SECTIONS.filter((s) => NEW.test(slice(html, s.id).split('</h2>')[1]?.split('</p>')[0] ?? '')).map((s) => s.id)
    expect(heads, '«جديد» في رأس القسم').toEqual(fresh)
  })

  it('وبعد الشهر لا «جديد» في الصفحة كلّها', () => {
    const html = page('2026-11-10T09:00:00Z')
    expect(html).not.toMatch(NEW)
  })
})
