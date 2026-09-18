/* تهيئةُ صفحاتِ الموقع العامّة للزاحف — بعد كلّ بناء.

   ── العطبُ ──

   الموقعُ تطبيقُ صفحةٍ واحدة، و`vite build` يُخرج ملفَّ HTML واحدا. فالخادمُ
   يردّ `dist/index.html` نفسَه لكلّ مسار، وفيه:

     <title>أكاديمية وجيز — مسارك يبدأ من فهمك</title>
     <link rel="canonical" href="https://www.wajeezacademy.com/" />
     <div id="root"></div>

   فكلُّ عنوانٍ في خريطة الموقع يقول للزاحف: «أصلي هو الصفحةُ الرئيسة». وقوقل
   يأخذ ذلك جادّا فيطوي الأربعةَ عشرَ عنوانا في واحد — والواحدُ محتواه في
   المصدر فارغٌ تماما: لا عنوانَ ولا فقرةَ ولا رابطَ يُتبع. فلا شيءَ يُفهرَس.

   ── والعلاجُ هنا: ملفٌّ لكلّ صفحة ──

   لكلّ صفحةٍ في `PUBLIC_PAGES` ملفُّ HTML خاصٌّ بها: عنوانُها ووصفُها
   و`canonical` الخاصُّ بها، وبياناتُها المنظّمة، **ومحتوى نصّيٌّ حقيقيّ**
   داخل `#root` — عنوانٌ وفقرةٌ وروابطُ الموقع.

   والمحتوى داخل `#root` بقصد: `createRoot().render()` يمسح ما في الحاوية عند
   أوّل تصيير، فيحلّ التطبيقُ محلَّه بلا أثر. فهو يخدم ثلاثةً معا:
     · الزاحفَ في قراءته الأولى، قبل أن يُصيَّر أيُّ سكربت.
     · **زاحفاتِ محرّكات الإجابة** (GPTBot وPerplexityBot وسواهما) — وهي في
       الغالب **لا تشغّل جافاسكربت أصلا**، فما لا يكون في المصدر لا يصل إليها.
     · الزائرَ نفسَه: نصٌّ يُقرأ مكان شاشةٍ فارغةٍ حتّى تصل الحزمة.

   ── ولماذا يسقط البناءُ عند أوّل وسمٍ لا يُطابَق ──

   `replaceOnce` يشترط أن يُصاب الوسمُ مرّةً واحدةً بالضبط. فلو غُيّرت صيغةُ
   وسمٍ في `index.html` ولم تُطابقه الصيغةُ هنا، لخرجت صفحاتٌ بوسمٍ غيرِ
   مُستبدَل — أي بعنوان الرئيسة و`canonical` الرئيسة، وهو العطبُ الذي يعالجه
   هذا الملفُّ بعينه، عائدا صامتا. فالسقوطُ أهونُ من صمتٍ يُعيد العطب.

   ⚠️ يُشغَّل تلقائيّا: `postbuild` و`postbuild:image` في `package.json`. */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CANONICAL_ORIGIN } from '../src/application/site/origin'
import { PUBLIC_PAGES, pageTitle, ROBOTS_INDEXABLE, type PublicPage } from '../src/application/site/public-pages'
import { faqs, staticPageBySlug } from '../src/data/siteContent'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')

/* الأصلُ من البيئة إن ضُبط، وإلّا النطاقُ الحيّ — الترتيبُ نفسُه الذي في
   `vite.config.ts`، ولا نطاقَ مكتوبٌ حرفا هنا. */
const ORIGIN = (process.env.VITE_SITE_ORIGIN || CANONICAL_ORIGIN).replace(/\/+$/, '')

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** استبدالٌ يشترط إصابةً واحدةً بالضبط — وإلّا سقط البناء */
function replaceOnce(html: string, pattern: RegExp, to: string, what: string): string {
  const all = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g')
  const hits = html.match(all)
  if (!hits || hits.length !== 1) {
    throw new Error(
      `تهيئةُ SEO: «${what}» أُصيب ${hits?.length ?? 0} مرّةً لا مرّةً واحدة.\n` +
        'غُيّرت صيغةُ الوسم في index.html ولم تُحدَّث هنا — والصفحاتُ كانت ستخرج بوسم الرئيسة.',
    )
  }
  return html.replace(pattern, () => to)
}

/* ─────────── البياناتُ المنظّمة ─────────── */

const organization = {
  '@type': ['Organization', 'EducationalOrganization'],
  '@id': `${ORIGIN}/#organization`,
  name: 'أكاديمية وجيز',
  alternateName: 'Wajeez Academy',
  url: `${ORIGIN}/`,
  logo: `${ORIGIN}/logo-full.png`,
  image: `${ORIGIN}/og-image.png`,
  description:
    'أكاديمية عربية للتعلم المهني والشخصي من مجموعة وجيز — تبدأ من تشخيص المتعلم لا من بيع دورة.',
  parentOrganization: { '@type': 'Organization', name: 'وجيز', url: 'https://wajeez.com' },
  email: 'Academy@wajeez.co',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'حي الياسمين — شارع أنس بن مالك',
    addressLocality: 'الرياض',
    addressCountry: 'SA',
  },
}

const website = {
  '@type': 'WebSite',
  '@id': `${ORIGIN}/#website`,
  name: 'أكاديمية وجيز',
  url: `${ORIGIN}/`,
  inLanguage: 'ar',
  publisher: { '@id': `${ORIGIN}/#organization` },
}

const faqPage = {
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
}

function breadcrumb(page: PublicPage) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'الرئيسية', item: `${ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: page.title, item: `${ORIGIN}${page.path}` },
    ],
  }
}

export function graphFor(page: PublicPage): string {
  const isHome = page.path === '/'
  const graph: unknown[] = [
    {
      '@type': 'WebPage',
      '@id': `${ORIGIN}${page.path}#webpage`,
      url: `${ORIGIN}${page.path}`,
      name: pageTitle(page.title),
      description: page.description,
      inLanguage: 'ar',
      isPartOf: { '@id': `${ORIGIN}/#website` },
    },
  ]
  /* المنظّمةُ والموقعُ يُعلنان على الرئيسة — هي بيتُهما، وتكرارُهما في كلّ
     صفحةٍ يضخّم الوسمَ بلا فائدةٍ للفهرسة. */
  if (isHome) graph.push(organization, website)
  else graph.push(breadcrumb(page))
  /* والأسئلةُ الشائعة حيث تُعرض فعلا — لا في كلّ صفحة.
     وكانت في `index.html` أي في **كلّ** عنوان، وذلك ادّعاءٌ يُخالف الصفحة. */
  if (isHome || page.path === '/p/faq') graph.push(faqPage)

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2)
    /* لا يُغلق وسمَ السكربت من داخل النصّ */
    .replace(/</g, '\\u003c')
}

/* ─────────── التطبيع: القالبُ يعود بِكرا قبل كلّ صفحة ─────────── */

/* القالبُ هو `dist/index.html` — وهو نفسُه الملفُّ الذي تُكتب فيه الرئيسة.
   فتشغيلٌ ثانٍ بلا بناءٍ بينهما كان يقرأ قالبا مُهيَّأ سلفا: محتوًى داخل
   محتوًى، ووسمُ `robots` مكرّرٌ مرّتين. والعلامتان تجعلان ذلك قابلا للنقض —
   فيُعاد القالبُ إلى أصله قبل كلّ تصيير، ويستوي التشغيلُ الأوّلُ والعاشر. */
const SEO_START = '<!--seo:start-->'
const SEO_END = '<!--seo:end-->'

export function normalizeTemplate(html: string): string {
  return html
    .replace(
      new RegExp(`<div id="root">${SEO_START}[\\s\\S]*?${SEO_END}</div>`),
      '<div id="root"></div>',
    )
    .replace(new RegExp(`\\n?\\s*<meta name="robots" content="${ROBOTS_INDEXABLE}"\\s*/?>`), '')
}

/* ─────────── المحتوى النصّيّ داخل `#root` ─────────── */

export function contentFor(page: PublicPage): string {
  const parts: string[] = [`<h1 style="margin:0 0 .75rem;font-size:1.9rem;line-height:1.5">${esc(page.title)}</h1>`]
  parts.push(`<p style="margin:0 0 1.5rem;font-size:1.05rem;line-height:2;opacity:.85">${esc(page.description)}</p>`)

  /* صفحاتُ `/p/:slug` محتواها نصٌّ كاملٌ عندنا — فيُكتب كما هو.
     وهو ما تقرؤه محرّكاتُ الإجابة، إذ لا تشغّل جافاسكربت. */
  const slug = page.path.startsWith('/p/') ? page.path.slice(3) : null
  const staticPage = slug ? staticPageBySlug(slug) : undefined
  if (staticPage) {
    for (const s of staticPage.sections) {
      if (s.heading) parts.push(`<h2 style="margin:1.75rem 0 .5rem;font-size:1.25rem">${esc(s.heading)}</h2>`)
      for (const p of s.paragraphs ?? []) parts.push(`<p style="margin:0 0 .75rem;line-height:2">${esc(p)}</p>`)
      if (s.bullets?.length) {
        parts.push(
          `<ul style="margin:0 0 .75rem;padding-inline-start:1.25rem;line-height:2">${s.bullets
            .map((b) => `<li>${esc(b)}</li>`)
            .join('')}</ul>`,
        )
      }
    }
  }

  /* الأسئلةُ الشائعة نصّا لا وسما فقط: محرّكاتُ الإجابة تقتبس النصّ، وJSON-LD
     يفسّره. فالاثنان معا، وبالمحتوى نفسِه. */
  if (page.path === '/' || page.path === '/p/faq') {
    parts.push('<h2 style="margin:2rem 0 .5rem;font-size:1.25rem">الأسئلة الشائعة</h2>')
    for (const f of faqs) {
      parts.push(`<h3 style="margin:1.25rem 0 .35rem;font-size:1.05rem">${esc(f.q)}</h3>`)
      parts.push(`<p style="margin:0;line-height:2;opacity:.85">${esc(f.a)}</p>`)
    }
  }

  /* شبكةُ الروابط الداخليّة — وبدونها لا يجد الزاحفُ صفحةً من صفحة.
     روابطُ التطبيق تُرسَم بجافاسكربت، فمن لا يشغّله يرى صفحةً بلا مخرج. */
  const links = PUBLIC_PAGES.filter((p) => p.path !== page.path)
    .map((p) => `<li style="margin:0 0 .35rem"><a href="${p.path}" style="color:#5eead4">${esc(p.title)}</a></li>`)
    .join('')
  parts.push(
    `<nav aria-label="روابط الموقع" style="margin-top:2.5rem;border-top:1px solid rgba(255,255,255,.12);padding-top:1.25rem">` +
      `<h2 style="margin:0 0 .75rem;font-size:1rem;opacity:.7">صفحات أكاديمية وجيز</h2>` +
      `<ul style="list-style:none;margin:0;padding:0">${links}</ul></nav>`,
  )

  return (
    `${SEO_START}<div style="max-width:48rem;margin:0 auto;padding:2.5rem 1.25rem;font-family:'IBM Plex Sans Arabic',system-ui,sans-serif">` +
    `<img src="/logo-mark.png" alt="أكاديمية وجيز" width="56" height="56" style="display:block;margin-bottom:1.25rem" />` +
    parts.join('\n      ') +
    `</div>${SEO_END}`
  )
}

/* ─────────── التهيئة ─────────── */

export function render(template: string, page: PublicPage): string {
  const url = `${ORIGIN}${page.path === '/' ? '/' : page.path}`
  const title = pageTitle(page.title)
  let html = normalizeTemplate(template)

  html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`, 'title')
  html = replaceOnce(
    html,
    /<meta name="description" content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${esc(page.description)}" />\n` +
      `    <meta name="robots" content="${ROBOTS_INDEXABLE}" />`,
    'meta description',
  )
  html = replaceOnce(html, /<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${url}" />`, 'canonical')
  html = replaceOnce(html, /<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${esc(title)}" />`, 'og:title')
  html = replaceOnce(
    html,
    /<meta property="og:description" content="[^"]*"\s*\/?>/,
    `<meta property="og:description" content="${esc(page.description)}" />`,
    'og:description',
  )
  html = replaceOnce(html, /<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${url}" />`, 'og:url')
  html = replaceOnce(html, /<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${esc(title)}" />`, 'twitter:title')
  html = replaceOnce(
    html,
    /<meta name="twitter:description" content="[^"]*"\s*\/?>/,
    `<meta name="twitter:description" content="${esc(page.description)}" />`,
    'twitter:description',
  )
  html = replaceOnce(
    html,
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
    `<script type="application/ld+json">\n${graphFor(page)}\n    </script>`,
    'JSON-LD',
  )
  html = replaceOnce(html, /<div id="root"><\/div>/, `<div id="root">${contentFor(page)}</div>`, 'root')

  if (html.includes('%VITE_SITE_ORIGIN%')) {
    throw new Error(`تهيئةُ SEO: بقي %VITE_SITE_ORIGIN% حرفيّا في ${page.path}`)
  }
  return html
}

/** خريطةُ الموقع — تُولَّد من السجلّ نفسِه، فلا تفترق عمّا يُهيَّأ فعلا */
export function sitemap(): string {
  const urls = PUBLIC_PAGES.map(
    (p) => `  <url><loc>${ORIGIN}${p.path}</loc><priority>${p.priority.toFixed(1)}</priority></url>`,
  ).join('\n')
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<!-- مولَّدٌ آليّا بـscripts/prerender-seo.ts من PUBLIC_PAGES — لا يُحرَّر بيد. -->\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    `${urls}\n` +
    '</urlset>\n'
  )
}

export function main() {
  const indexPath = join(dist, 'index.html')
  let template: string
  try {
    template = readFileSync(indexPath, 'utf8')
  } catch {
    throw new Error('تهيئةُ SEO: dist/index.html مفقود — شغّل البناءَ أوّلا')
  }

  for (const page of PUBLIC_PAGES) {
    const html = render(template, page)
    /* الرئيسةُ هي `index.html` نفسُه، وسواها ملفٌّ باسم مسارها.
       وملفٌّ `.html` لا مجلّدٌ بقصد: مجلّدٌ يجعل الخادمَ يحوّل `/pathways`
       إلى `/pathways/` — عنوانا ثانيا بشرطةٍ مائلةٍ يخالف `canonical`. */
    const out = page.path === '/' ? indexPath : join(dist, `${page.path.replace(/^\//, '')}.html`)
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, html)
  }

  writeFileSync(join(dist, 'sitemap.xml'), sitemap())
  console.log(`تهيئةُ SEO: ${PUBLIC_PAGES.length} صفحةً وخريطةُ الموقع — الأصل ${ORIGIN}`)
}

/* يُشغَّل حين يُستدعى الملفُّ مباشرةً لا حين يُستورَد — فالحارسُ يستورد
   `render` ليقيسها على قالبٍ مُصطنَع، ولا ينبغي أن يكتب في `dist/` ليفعل. */
const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) main()
