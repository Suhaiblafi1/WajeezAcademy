/* التهيئةُ المسبقة — لكلّ صفحةٍ وسومُها، لا وسومُ الرئيسة.

   ── العطبُ ──

   `vite build` يُخرج ملفَّ HTML واحدا، والخادمُ كان يردّه لكلّ مسار. وفيه
   `canonical` الرئيسة وعنوانُها — فكلُّ عنوانٍ في خريطة الموقع يقول للزاحف
   «أصلي هو الرئيسة»، فتُطوى الصفحاتُ كلُّها في واحدة. و`SeoHead` يصحّح ذلك
   بعد أن تعمل React، أي في طور التصيير المؤجَّل — والطيُّ يكون قد وقع من
   قراءة المصدر الأولى.

   ── والمقيسُ هنا ──

   `render` تُستدعى على قالبٍ مُصطنَعٍ يحاكي `dist/index.html`، ويُفحص **ناتجُها**
   لا نصُّ السكربت: أنّ `canonical` صار مسارَ الصفحة، وأنّ العنوانَ عنوانُها،
   وأنّ في الجسد نصّا يُقرأ بلا جافاسكربت. */

import { describe, expect, it } from 'vitest'
import { PUBLIC_PAGES, pageTitle, ROBOTS_INDEXABLE } from '../../application/site/public-pages'
import { render, normalizeTemplate } from '../../../scripts/prerender-seo'

/** قالبٌ يحاكي `dist/index.html` بوسومه كما يكتبها `index.html` */
const TEMPLATE = `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <title>مسارك يبدأ من فهمك — أكاديمية وجيز</title>
    <meta name="description" content="وصفُ الرئيسة" />
    <link rel="canonical" href="https://www.wajeezacademy.com/" />
    <meta property="og:title" content="مسارك يبدأ من فهمك — أكاديمية وجيز" />
    <meta property="og:description" content="وصفُ الرئيسة" />
    <meta property="og:url" content="https://www.wajeezacademy.com/" />
    <meta name="twitter:title" content="مسارك يبدأ من فهمك — أكاديمية وجيز" />
    <meta name="twitter:description" content="وصفُ الرئيسة" />
    <script type="application/ld+json">
    { "@context": "https://schema.org" }
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/index-abcdefgh.js"></script>
  </body>
</html>`

const attr = (html: string, re: RegExp) => re.exec(html)?.[1]
const canonicalOf = (h: string) => attr(h, /<link rel="canonical" href="([^"]*)"/)
const titleOf = (h: string) => attr(h, /<title>([^<]*)<\/title>/)
const ogUrlOf = (h: string) => attr(h, /<meta property="og:url" content="([^"]*)"/)
const descOf = (h: string) => attr(h, /<meta name="description" content="([^"]*)"/)
/** نصُّ الجسد بلا وسوم — ما يقرؤه زاحفٌ لا يشغّل جافاسكربت */
const bodyText = (h: string) =>
  (/<div id="root">([\s\S]*?)<\/body>/.exec(h)?.[1] ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

describe('التهيئةُ المسبقة: لكلّ صفحةٍ وسومُها', () => {
  it.each(PUBLIC_PAGES)('«$path» تحمل canonical الخاصَّ بها', (page) => {
    const html = render(TEMPLATE, page)
    expect(canonicalOf(html)).toBe(`https://www.wajeezacademy.com${page.path}`)
    expect(ogUrlOf(html)).toBe(`https://www.wajeezacademy.com${page.path}`)
    expect(titleOf(html)).toBe(pageTitle(page.title))
    expect(descOf(html)).toBe(page.description)
  })

  it('ولا صفحتان تتقاسمان canonical — وهو العطبُ الأصليّ بعينه', () => {
    const canonicals = PUBLIC_PAGES.map((p) => canonicalOf(render(TEMPLATE, p)))
    expect(new Set(canonicals).size, 'صفحتان تُعلنان الأصلَ نفسَه فتُطوى إحداهما').toBe(
      PUBLIC_PAGES.length,
    )
  })

  it('ولا عنوانان متطابقان — نسختان في نظر الفهرس', () => {
    const titles = PUBLIC_PAGES.map((p) => titleOf(render(TEMPLATE, p)))
    expect(new Set(titles).size).toBe(PUBLIC_PAGES.length)
  })

  it('وفي جسد كلّ صفحةٍ نصٌّ يُقرأ بلا جافاسكربت', () => {
    /* محرّكاتُ الإجابة (GPTBot وPerplexityBot وسواهما) لا تشغّل جافاسكربت في
       الغالب — فما لا يكون في المصدر لا يصل إليها. وكان الجسدُ
       `<div id="root"></div>` فارغا تماما. */
    for (const page of PUBLIC_PAGES) {
      const text = bodyText(render(TEMPLATE, page))
      expect(text.length, `جسدُ «${page.path}» فارغٌ للزاحف`).toBeGreaterThan(200)
      expect(text, `عنوانُ «${page.path}» غائبٌ عن جسدها`).toContain(page.title)
    }
  })

  it('ولكلّ صفحةٍ روابطُ الموقع — وإلّا فلا يجد الزاحفُ صفحةً من صفحة', () => {
    for (const page of PUBLIC_PAGES) {
      const html = render(TEMPLATE, page)
      const hrefs = [...html.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1])
      const missing = PUBLIC_PAGES.filter((p) => p.path !== page.path && !hrefs.includes(p.path))
      expect(missing.map((p) => p.path), `«${page.path}» لا تدلّ على أخواتها`).toEqual([])
    }
  })

  it('وتوجيهُ الفهرسة مكتوبٌ مرّةً واحدة', () => {
    for (const page of PUBLIC_PAGES) {
      const html = render(TEMPLATE, page)
      const robots = [...html.matchAll(/<meta name="robots" content="([^"]*)"/g)]
      expect(robots.length, `توجيهُ الفهرسة مكرّرٌ في «${page.path}»`).toBe(1)
      expect(robots[0][1]).toBe(ROBOTS_INDEXABLE)
    }
  })

  it('ولا تبقى علامةُ الأصل حرفيّةً في أيّ صفحة', () => {
    for (const page of PUBLIC_PAGES) {
      expect(render(TEMPLATE, page)).not.toContain('%VITE_SITE_ORIGIN%')
    }
  })
})

describe('البياناتُ المنظّمة', () => {
  const graphOf = (html: string) =>
    JSON.parse(
      (/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '{}').replace(
        /\\u003c/g,
        '<',
      ),
    ) as { '@graph': { '@type': string | string[] }[] }

  const typesOn = (path: string) => {
    const page = PUBLIC_PAGES.find((p) => p.path === path)!
    return graphOf(render(TEMPLATE, page))['@graph'].flatMap((n) =>
      Array.isArray(n['@type']) ? n['@type'] : [n['@type']],
    )
  }

  it('كلُّ صفحةٍ تُعرّف نفسَها WebPage', () => {
    for (const page of PUBLIC_PAGES) expect(typesOn(page.path)).toContain('WebPage')
  })

  it('والمنظّمةُ على الرئيسة وحدها — لا في كلّ عنوان', () => {
    expect(typesOn('/')).toContain('EducationalOrganization')
    expect(typesOn('/')).toContain('WebSite')
    expect(typesOn('/pathways')).not.toContain('EducationalOrganization')
  })

  it('والأسئلةُ الشائعة حيث تُعرض فعلا — وكانت تُدّعى في كلّ صفحة', () => {
    /* كانت `FAQPage` في `index.html`، أي في **كلّ** عنوانٍ يخدمه الخادم —
       ادّعاءٌ يخالف ما في الصفحة، وهو ما يُسقط الوسمَ عند قوقل. */
    expect(typesOn('/')).toContain('FAQPage')
    expect(typesOn('/p/faq')).toContain('FAQPage')
    expect(typesOn('/pathways')).not.toContain('FAQPage')
    expect(typesOn('/contact')).not.toContain('FAQPage')
  })

  it('وفتاتُ الخبز على الصفحات الداخلية لا على الرئيسة', () => {
    expect(typesOn('/pathways')).toContain('BreadcrumbList')
    expect(typesOn('/')).not.toContain('BreadcrumbList')
  })
})

describe('التطبيع: القالبُ يعود بِكرا', () => {
  it('تشغيلٌ ثانٍ على ناتجِ الأوّل يُخرج النتيجةَ نفسَها', () => {
    /* `dist/index.html` هو القالبُ **وهو** ملفُّ الرئيسة. فبلا تطبيعٍ كان
       التشغيلُ الثاني يُدخل محتوًى في محتوًى ويكرّر وسمَ `robots`. */
    const home = PUBLIC_PAGES[0]
    const once = render(TEMPLATE, home)
    const twice = render(once, home)
    expect(twice).toBe(once)
  })

  it('والتطبيعُ يُعيد الجسدَ فارغا كما بناه Vite', () => {
    const filled = render(TEMPLATE, PUBLIC_PAGES[1])
    expect(normalizeTemplate(filled)).toContain('<div id="root"></div>')
  })
})
