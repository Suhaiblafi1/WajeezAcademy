/* كتابةُ صفحةٍ مُهيَّأةٍ في قالب `dist/index.html` — مشتركةٌ بين البناء والخادم.

   `scripts/prerender-seo.ts` يكتب بها الصفحاتِ العامّةَ وصفحاتِ الكتالوج وقتَ البناء.
   والخادمُ يكتب بها صفحةَ المدرّب `/t/:slug` حين تُطلب (`server/services/trainer-seo-page.ts`)
   — لأنّ اسمَه لا يُعرض إلّا ببوّابةٍ في القاعدة (`publicTrainerWhere()`)، والبناءُ بلا قاعدة.
   ونقلُها إلى هنا (٥ نوفمبر ٢٠٢٦) كي لا تكون للصفحة المُهيَّأة كتابتان تفترقان. */

import { PUBLIC_PAGES, pageTitle, ROBOTS_INDEXABLE } from './public-pages'

/** عنوانُ صفحةٍ ووصفُها ومسارُها — بلا اسم الموقع (`pageTitle` يذيّله) */
export interface SeoMeta {
  title: string
  description: string
  path: string
}

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** استبدالٌ يشترط إصابةً واحدةً بالضبط — وإلّا سقط البناء */
export function replaceOnce(html: string, pattern: RegExp, to: string, what: string): string {
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

/** مرجعُ المنظّمة في كلّ صفحة — كاملا بما يكفي لقوقل (يشترط `name` في مقدّم الدورة) */
export const providerRef = (origin: string) => ({
  '@type': 'EducationalOrganization',
  '@id': `${origin}/#organization`,
  name: 'أكاديمية وجيز',
  url: `${origin}/`,
})

export function breadcrumb(origin: string, ...trail: { title: string; path: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [{ title: 'الرئيسية', path: '/' }, ...trail].map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.title,
      item: `${origin}${t.path}`,
    })),
  }
}

export function webPage(origin: string, meta: SeoMeta) {
  return {
    '@type': 'WebPage',
    '@id': `${origin}${meta.path}#webpage`,
    url: `${origin}${meta.path}`,
    name: pageTitle(meta.title),
    description: meta.description,
    inLanguage: 'ar',
    isPartOf: { '@id': `${origin}/#website` },
  }
}

export const graphJson = (graph: unknown[]) =>
  JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2)
    /* لا يُغلق وسمَ السكربت من داخل النصّ */
    .replace(/</g, '\\u003c')

/* القالبُ هو `dist/index.html` — وهو نفسُه الملفُّ الذي تُكتب فيه الرئيسة.
   فتشغيلٌ ثانٍ بلا بناءٍ بينهما كان يقرأ قالبا مُهيَّأ سلفا: محتوًى داخل
   محتوًى، ووسمُ `robots` مكرّرٌ مرّتين. والعلامتان تجعلان ذلك قابلا للنقض —
   فيُعاد القالبُ إلى أصله قبل كلّ تصيير، ويستوي التشغيلُ الأوّلُ والعاشر. */
export const SEO_START = '<!--seo:start-->'
export const SEO_END = '<!--seo:end-->'

export function normalizeTemplate(html: string): string {
  return html
    .replace(
      new RegExp(`<div id="root">${SEO_START}[\\s\\S]*?${SEO_END}</div>`),
      '<div id="root"></div>',
    )
    .replace(new RegExp(`\\n?\\s*<meta name="robots" content="${ROBOTS_INDEXABLE}"\\s*/?>`), '')
}

/** غلافُ النصّ: العلامة، فالمحتوى، فشبكةُ روابط الموقع — واحدٌ لكلّ صفحةٍ مُهيَّأة */
export function shell(parts: string[], currentPath: string): string {
  /* شبكةُ الروابط الداخليّة — وبدونها لا يجد الزاحفُ صفحةً من صفحة.
     روابطُ التطبيق تُرسَم بجافاسكربت، فمن لا يشغّله يرى صفحةً بلا مخرج. */
  const links = PUBLIC_PAGES.filter((p) => p.path !== currentPath)
    .map((p) => `<li style="margin:0 0 .35rem"><a href="${p.path}" style="color:#5eead4">${esc(p.title)}</a></li>`)
    .join('')
  parts.push(
    `<nav aria-label="روابط الموقع" style="margin-top:2.5rem;border-top:1px solid rgba(255,255,255,.12);padding-top:1.25rem">` +
      `<h2 style="margin:0 0 .75rem;font-size:1rem;opacity:.7">صفحات أكاديمية وجيز</h2>` +
      `<ul style="list-style:none;margin:0;padding:0">${links}</ul></nav>`,
  )

  /* ═══ `data-seo` — ولمَ يُخفى عن الإنسان ولا يُحذف (٢١ سبتمبر ٢٠٢٦) ═══

     شكا صاحبُ المنصّة: «تظهر لي هذه الصفحةُ عند فتح الموقع أو الدخول أو
     التحديث، لأقلّ من ثانية — ولا أدري من أين تأتي».

     وهي هذه: يرسمها المتصفّحُ فور وصول HTML، ويمحوها `createRoot().render()`
     عند أوّل تصيير. فالوميضُ هو الفجوةُ بين الرسمَتين — وكانت **مقصودةً**
     بالبند الثالث أعلاه: «نصٌّ يُقرأ مكان شاشةٍ فارغة». غير أنّ ما يُقرأ في
     جزءٍ من ثانيةٍ لا يُقرأ، وإنّما يُرى صفحةً غريبةً تومض فتُقلق.

     فبقي البندان الأوّلان — وهما اللذان لا بديلَ لهما: الزاحفُ في قراءته
     الأولى، ومحرّكاتُ الإجابة التي لا تشغّل جافاسكربت أصلا. وسقط الثالث
     بقرار صاحبه.

     وليس إخفاءً عن الزاحف وإظهارا للإنسان — بل عكسُه تماما: من لا يشغّل
     جافاسكربت (وهو الزاحفُ الذي كُتب له هذا) يراه كما كان، ومن يشغّلها يصله
     التطبيقُ نفسُه بعد أجزاءٍ من الثانية. فالمخفيُّ لا يُخفي شيئا عن أحد —
     إنّما يمنع رسمَ ما سيُمحى بعد لحظة. */
  return (
    `${SEO_START}<div data-seo style="max-width:48rem;margin:0 auto;padding:2.5rem 1.25rem;font-family:'Tajawal','IBM Plex Sans Arabic',system-ui,sans-serif">` +
    `<img src="/logo-mark.png" alt="أكاديمية وجيز" width="56" height="56" style="display:block;margin-bottom:1.25rem" />` +
    parts.join('\n      ') +
    `</div>${SEO_END}`
  )
}

/** يكتب في القالب وسومَ صفحةٍ وبياناتِها المنظّمةَ ونصَّها — لكلّ صفحةٍ مُهيَّأةٍ عامّةً كانت أو من الكتالوج */
export interface RenderOptions {
  /** صورةُ المشاركة إن خالفت صورةَ الأكاديميّة — رابطٌ مطلق */
  image?: string | null
}

export function renderPageAt(
  template: string,
  origin: string,
  meta: SeoMeta,
  graph: string,
  body: string,
  opts: RenderOptions = {},
): string {
  const page = meta
  const url = `${origin}${page.path === '/' ? '/' : page.path}`
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
    `<script type="application/ld+json">\n${graph}\n    </script>`,
    'JSON-LD',
  )
  if (opts.image) {
    const img = esc(opts.image)
    html = replaceOnce(html, /<meta property="og:image" content="[^"]*"\s*\/?>/, `<meta property="og:image" content="${img}" />`, 'og:image')
    html = replaceOnce(html, /<meta name="twitter:image" content="[^"]*"\s*\/?>/, `<meta name="twitter:image" content="${img}" />`, 'twitter:image')
    /* أبعادُ صورة الأكاديميّة لا تصدق على صورةٍ أخرى */
    html = html.replace(/\n?\s*<meta property="og:image:(width|height)" content="[^"]*"\s*\/?>/g, '')
  }
  html = replaceOnce(html, /<div id="root"><\/div>/, `<div id="root">${body}</div>`, 'root')

  if (html.includes('%VITE_SITE_ORIGIN%')) {
    throw new Error(`تهيئةُ SEO: بقي %VITE_SITE_ORIGIN% حرفيّا في ${page.path}`)
  }
  return html
}

/* ─────────── عناصرُ النصّ ─────────── */

export const H2 = 'style="margin:1.75rem 0 .5rem;font-size:1.25rem"'
export const P = 'style="margin:0 0 .75rem;line-height:2"'
export const UL = 'style="margin:0 0 .75rem;padding-inline-start:1.25rem;line-height:2"'
export const A = 'style="color:#5eead4"'

export const h1 = (t: string) => `<h1 style="margin:0 0 .75rem;font-size:1.9rem;line-height:1.5">${esc(t)}</h1>`
export const h2 = (t: string) => `<h2 ${H2}>${esc(t)}</h2>`
export const para = (t: string) => `<p ${P}>${esc(t)}</p>`
export const bullets = (items: readonly string[], ordered = false) =>
  `<${ordered ? 'ol' : 'ul'} ${UL}>${items.map((i) => `<li>${i}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`
