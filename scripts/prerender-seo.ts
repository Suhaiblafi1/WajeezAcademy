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
import { PUBLIC_PAGES, type PublicPage } from '../src/application/site/public-pages'
import { courseSeo, pathwaySeo, type SeoMeta } from '../src/application/site/catalog-pages'
import { llmsTxt, sitemapXml } from '../src/application/site/seo-feeds'
import {
  A, breadcrumb as breadcrumbAt, bullets, esc, graphJson, h1, h2, normalizeTemplate, P, para,
  providerRef as providerRefAt, renderPageAt, shell, webPage as webPageAt,
} from '../src/application/site/render-page'
import { faqs, staticPageBySlug } from '../src/data/siteContent'
import bundledCatalog from '../src/data/catalog/core-catalog.v2.json'
import { getCoreCatalogRaw, installCoreCatalogRaw, type CoreCatalogRaw } from '../src/data/core-catalog-source'
import { publicPathways, type PublicPathway } from '../src/data/public-pathways'
import { courseById, weeksLabel } from '../src/data/courses'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')

/* الأصلُ من البيئة إن ضُبط، وإلّا النطاقُ الحيّ — الترتيبُ نفسُه الذي في
   `vite.config.ts`، ولا نطاقَ مكتوبٌ حرفا هنا. */
const ORIGIN = (process.env.VITE_SITE_ORIGIN || CANONICAL_ORIGIN).replace(/\/+$/, '')


export { normalizeTemplate }

/* الكتابةُ في القالب في `render-page.ts` — وهنا تُقيَّد بأصل البناء */
const providerRef = providerRefAt(ORIGIN)
const breadcrumb = (...trail: { title: string; path: string }[]) => breadcrumbAt(ORIGIN, ...trail)
const webPage = (meta: SeoMeta) => webPageAt(ORIGIN, meta)

/** يكتب في القالب وسومَ صفحةٍ وبياناتِها المنظّمةَ ونصَّها */
export function renderPage(template: string, meta: SeoMeta, graph: string, body: string): string {
  return renderPageAt(template, ORIGIN, meta, graph, body)
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
  /* ما تُعرف به — يقرؤه قوقل ومحرّكاتُ الإجابة في ربط الأكاديمية بأسئلةٍ عن مجالاتها */
  knowsAbout: [
    'ريادة الأعمال',
    'التسويق',
    'البحث عن عمل والمقابلات',
    'القيادة وإدارة الفرق',
    'الموارد البشرية',
    'الخطابة والتواصل',
    'العمل الحر',
    'الإدارة المالية الشخصية',
    'الأمن السيبراني والحوسبة السحابية',
    'اللغة الإنجليزية',
  ],
  areaServed: { '@type': 'Place', name: 'العالم العربي' },
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    email: 'Academy@wajeez.co',
    url: `${ORIGIN}/contact`,
    availableLanguage: ['ar', 'en'],
  },
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
  description: 'تشخيص تعليمي مجاني ومسارات تدريب عملي عبر الإنترنت بالعربية — من أكاديمية وجيز.',
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


export function graphFor(page: PublicPage): string {
  const isHome = page.path === '/'
  const graph: unknown[] = [webPage(page)]
  /* المنظّمةُ والموقعُ يُعلنان على الرئيسة — هي بيتُهما، وتكرارُهما في كلّ
     صفحةٍ يضخّم الوسمَ بلا فائدةٍ للفهرسة. */
  if (isHome) graph.push(organization, website)
  else graph.push(breadcrumb({ title: page.title, path: page.path }))
  /* والأسئلةُ الشائعة حيث تُعرض فعلا — لا في كلّ صفحة.
     وكانت في `index.html` أي في **كلّ** عنوان، وذلك ادّعاءٌ يُخالف الصفحة. */
  if (isHome || page.path === '/p/faq') graph.push(faqPage)

  return graphJson(graph)
}

/* ─────────── التطبيع: القالبُ يعود بِكرا قبل كلّ صفحة ─────────── */


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

  return shell(parts, page.path)
}


/* ─────────── التهيئة ─────────── */

export function render(template: string, page: PublicPage): string {
  return renderPage(template, page, graphFor(page), contentFor(page))
}


/* ─────────── صفحاتُ الكتالوج: المساراتُ والدورات ─────────── */

/* المسارُ والدورةُ لكلٍّ ملفُّه: `/pathways/PP-LAUNCH` في `dist/pathways/PP-LAUNCH.html`
   و`/build/C-BIZ-101` في `dist/build/C-BIZ-101.html` — و`try_files {path}.html` يخدمهما.

   والمصدرُ الكتالوجُ المضمَّن: هو الاحتياطيُّ الذي تعرضه الصفحةُ الحيّة نفسُها حين لا تصل
   اللقطةُ المنشورة، فما فيه معتمَدٌ للعرض. وعنوانُ كلٍّ ووصفُه من `catalog-pages.ts` —
   وهو ما يكتبه `SeoHead` في الصفحة الحيّة، فلا يتذبذب العنوان. */

/** ساعاتٌ بصيغة ISO 8601 — «PT16H» و«PT2.5H» */
const isoHours = (h: number) => `PT${Number(h.toFixed(2))}H`

type RawCourse = CoreCatalogRaw['courses'][number]

const rawCourse = (id: string): RawCourse | undefined => getCoreCatalogRaw().courses.find((c) => c.course_id === id)

const modulesOf = (id: string) =>
  getCoreCatalogRaw()
    .modules.filter((m) => m.course_id === id)
    .sort((a, b) => a.sequence - b.sequence)

export interface CatalogPage {
  meta: SeoMeta
  graph: string
  body: string
}

/** صفحةُ مسارٍ عامّ — برنامجٌ تعليميٌّ ودوراتُه بروابطها */
export function pathwayPage(p: PublicPathway): CatalogPage {
  const meta = pathwaySeo(p)
  const url = `${ORIGIN}${meta.path}`
  const courseList = p.courseIds.map((id) => courseById(id)).filter((c): c is NonNullable<typeof c> => Boolean(c))

  const program = {
    '@type': 'EducationalOccupationalProgram',
    '@id': `${url}#program`,
    name: p.name,
    description: meta.description,
    url,
    provider: providerRef,
    inLanguage: 'ar',
    educationalProgramMode: 'online',
    timeToComplete: `P${p.durationWeeks}W`,
    educationalCredentialAwarded: 'شهادة إتمام موثقة من أكاديمية وجيز',
    audience: { '@type': 'EducationalAudience', audienceType: p.audience },
    hasCourse: courseList.map((c) => {
      const cm = courseSeo(c)
      return {
        '@type': 'Course',
        '@id': `${ORIGIN}${cm.path}#course`,
        name: c.name,
        description: cm.description,
        url: `${ORIGIN}${cm.path}`,
        provider: providerRef,
      }
    }),
  }
  const graph = graphJson([
    webPage(meta),
    breadcrumb({ title: 'كل المسارات', path: '/pathways' }, { title: p.name, path: meta.path }),
    program,
  ])

  const parts = [h1(p.name), para(meta.description)]
  parts.push(h2('لمن هذا المسار'), para(p.audience))
  if (p.notFor) parts.push(h2('ليس لمن'), para(p.notFor))
  parts.push(h2('ماذا تخرج به'), para(p.transformation))
  if (p.output) parts.push(h2('مشروع التخرج'), para(p.output))
  parts.push(
    h2('تفاصيل المسار'),
    bullets([
      esc(`${p.courseCount} دورات · ${p.totalHours} ساعة · ${weeksLabel(p.durationWeeks)}`),
      esc(`المستوى: ${p.level}`),
      esc(`طريقة التعلم: ${p.delivery}`),
      esc('في الختام: شهادة إتمام موثقة يتحقق منها أي أحد برقمها.'),
    ]),
  )
  if (courseList.length) {
    parts.push(
      h2('دورات المسار بترتيب دراستها'),
      bullets(
        courseList.map(
          (c) => `<a href="/build/${esc(c.id)}" ${A}>${esc(c.name)}</a>${c.promise ? ` — ${esc(c.promise)}` : ''}`,
        ),
        true,
      ),
    )
  }
  parts.push(
    para('لا تعرف إن كان هذا المسار يناسبك؟ التشخيص المجاني يوصي بمسار واحد ويشرح سببه.'),
    `<p ${P}><a href="/diagnostic" ${A}>ابدأ التشخيص المجاني</a></p>`,
  )
  return { meta, graph, body: shell(parts, meta.path) }
}

/** صفحةُ دورة — `Course` ووحداتُها ومخرجاتُها ومشروعُها. و`null` لدورةٍ ليست في الكتالوج */
export function coursePage(id: string): CatalogPage | null {
  const c = courseById(id)
  const raw = rawCourse(id)
  if (!c || !raw) return null
  const meta = courseSeo(c)
  const url = `${ORIGIN}${meta.path}`
  const modules = modulesOf(id)
  const hours = Number(raw.total_hours) || 0
  const inPathways = publicPathways.filter((p) => p.courseIds.includes(id))

  const course: Record<string, unknown> = {
    '@type': 'Course',
    '@id': `${url}#course`,
    name: c.name,
    description: raw.description_ar ? `${meta.description} ${raw.description_ar}` : meta.description,
    url,
    provider: providerRef,
    inLanguage: 'ar',
    hasCourseInstance: [
      {
        '@type': 'CourseInstance',
        courseMode: 'Online',
        inLanguage: 'ar',
        ...(hours > 0 ? { courseWorkload: isoHours(hours) } : {}),
      },
    ],
  }
  if (raw.title_term_en) course.alternateName = raw.title_term_en
  if (raw.level_ar) course.educationalLevel = raw.level_ar
  if (raw.skill_names_ar?.length) course.teaches = raw.skill_names_ar
  if (raw.prerequisites_ar) course.coursePrerequisites = raw.prerequisites_ar
  if (hours > 0) course.timeRequired = isoHours(hours)
  if (raw.target_audience_ar) course.audience = { '@type': 'EducationalAudience', audienceType: raw.target_audience_ar }
  if (modules.length) {
    course.syllabusSections = modules.map((m) => ({
      '@type': 'Syllabus',
      name: m.title_ar,
      description: m.module_outcome_ar,
      ...(Number(m.expected_hours) > 0 ? { timeRequired: isoHours(Number(m.expected_hours)) } : {}),
    }))
  }
  if (inPathways.length) {
    course.isPartOf = inPathways.map((p) => ({ '@id': `${ORIGIN}${pathwaySeo(p).path}#program` }))
  }

  const graph = graphJson([
    webPage(meta),
    breadcrumb({ title: 'كل الدورات', path: '/courses' }, { title: c.name, path: meta.path }),
    course,
  ])

  const parts = [h1(c.name)]
  if (raw.title_term_en) parts.push(`<p ${P} lang="en" dir="ltr">${esc(raw.title_term_en)}</p>`)
  parts.push(para(meta.description))
  if (raw.description_ar) parts.push(para(raw.description_ar))
  if (raw.target_audience_ar) parts.push(h2('لمن هذه الدورة'), para(raw.target_audience_ar))
  if (raw.prerequisites_ar) parts.push(h2('المتطلبات'), para(raw.prerequisites_ar))
  parts.push(
    h2('تفاصيل الدورة'),
    bullets(
      [
        hours > 0 ? `${hours} ساعة تعلم وتطبيق` : '',
        raw.level_ar ? `المستوى: ${raw.level_ar}` : '',
        'طريقة التعلم: مباشر عبر الإنترنت، لقاء أسبوعي مع المدرب وتطبيق عملي بين اللقاءات.',
        'شهادة إتمام موثقة يتحقق منها أي أحد برقمها.',
      ]
        .filter(Boolean)
        .map(esc),
    ),
  )
  if (raw.learning_objectives_ar?.length) parts.push(h2('ما ستتعلمه'), bullets(raw.learning_objectives_ar.map(esc)))
  if (raw.learning_outcomes_ar?.length) parts.push(h2('ما ستقدر عليه بعدها'), bullets(raw.learning_outcomes_ar.map(esc)))
  if (modules.length) {
    parts.push(
      h2('وحدات الدورة'),
      bullets(
        modules.map((m) => `<strong>${esc(m.title_ar)}</strong>${m.module_outcome_ar ? ` — ${esc(m.module_outcome_ar)}` : ''}`),
        true,
      ),
    )
  }
  if (raw.practical_project_ar) parts.push(h2('المشروع العملي'), para(raw.practical_project_ar))
  if (raw.skill_names_ar?.length) parts.push(h2('المهارات'), para(raw.skill_names_ar.join('، ')))
  if (inPathways.length) {
    parts.push(
      h2('ضمن هذه المسارات'),
      bullets(inPathways.map((p) => `<a href="${pathwaySeo(p).path}" ${A}>${esc(p.name)}</a>`)),
    )
  }
  return { meta, graph, body: shell(parts, meta.path) }
}

/** صفحاتُ الكتالوج كلُّها — المساراتُ العامّة، ثمّ كلُّ دورةٍ في الكتالوج */
export function catalogPages(): CatalogPage[] {
  const pages: CatalogPage[] = publicPathways.map(pathwayPage)
  for (const c of getCoreCatalogRaw().courses) {
    const page = coursePage(c.course_id)
    if (page) pages.push(page)
  }
  return pages
}

/* ─────────── خريطةُ الموقع وllms.txt — النسخةُ الساكنة ─────────── */

/** خريطةُ الموقع الساكنة — الصفحاتُ العامّةُ وحدَها.

    والحيّةُ يجيبها الخادم (`server/services/seo-feeds.service.ts`) ومعها ما يُعرض الآن من
    المسارات والدورات والمدرّبين — فذلك يحكمه الخادمُ بالشعب، لا البناء. وهذه احتياطٌ لمن
    يخدم `dist/` وحدَه. */
export function sitemap(): string {
  return sitemapXml(ORIGIN, PUBLIC_PAGES)
}

/** روابطُ llms.txt من الصفحات العامّة: الأساسيّةُ أوّلا، والقانونيّةُ في «Optional» */
export const LEGAL_SLUGS = new Set(['privacy', 'terms', 'refund'])

export function staticLlmsTxt(): string {
  const legal = (p: PublicPage) => p.path.startsWith('/p/') && LEGAL_SLUGS.has(p.path.slice(3))
  return llmsTxt(ORIGIN, {
    pages: PUBLIC_PAGES.filter((p) => !legal(p)).map((p) => ({ path: p.path, title: p.title, note: p.description })),
    optional: PUBLIC_PAGES.filter(legal).map((p) => ({ path: p.path, title: p.title, note: p.description })),
    faqs,
  })
}

export function main() {
  const indexPath = join(dist, 'index.html')
  let template: string
  try {
    template = readFileSync(indexPath, 'utf8')
  } catch {
    throw new Error('تهيئةُ SEO: dist/index.html مفقود — شغّل البناءَ أوّلا')
  }

  /* الكتالوجُ في المتصفّح يصل من الشبكة؛ وهنا يُثبَّت المضمَّنُ قبل أيّ قراءة */
  installCoreCatalogRaw(bundledCatalog as unknown as CoreCatalogRaw)

  const write = (path: string, html: string) => {
    /* الرئيسةُ هي `index.html` نفسُه، وسواها ملفٌّ باسم مسارها.
       وملفٌّ `.html` لا مجلّدٌ بقصد: مجلّدٌ يجعل الخادمَ يحوّل `/pathways`
       إلى `/pathways/` — عنوانا ثانيا بشرطةٍ مائلةٍ يخالف `canonical`. */
    const out = path === '/' ? indexPath : join(dist, `${path.replace(/^\//, '')}.html`)
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, html)
  }

  for (const page of PUBLIC_PAGES) write(page.path, render(template, page))
  const catalog = catalogPages()
  for (const page of catalog) write(page.meta.path, renderPage(template, page.meta, page.graph, page.body))

  writeFileSync(join(dist, 'sitemap.xml'), sitemap())
  writeFileSync(join(dist, 'llms.txt'), staticLlmsTxt())
  console.log(
    `تهيئةُ SEO: ${PUBLIC_PAGES.length} صفحةً عامّة و${catalog.length} صفحةَ كتالوج وخريطةُ الموقع وllms.txt — الأصل ${ORIGIN}`,
  )
}

/* يُشغَّل حين يُستدعى الملفُّ مباشرةً لا حين يُستورَد — فالحارسُ يستورد
   `render` ليقيسها على قالبٍ مُصطنَع، ولا ينبغي أن يكتب في `dist/` ليفعل. */
const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) main()
