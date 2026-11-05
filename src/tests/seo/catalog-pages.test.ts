/* صفحاتُ المسارات والدورات المُهيَّأة — لكلٍّ وسومُها ونصُّها وبياناتُها المنظّمة.

   كانت `/pathways/:id` و`/build/:courseId` تُقدَّم بقالب الرئيسة: عنوانُها وcanonicalها
   وجسدٌ فارغ. فلا يصل الزاحفَ منها شيءٌ في قراءته الأولى، ولا يصل محرّكاتِ الإجابة
   شيءٌ أبدا. والمقيسُ هنا **ناتجُ** التهيئة على قالبٍ مُصطنَع، لا نصُّ السكربت. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { coursePage, pathwayPage, catalogPages, renderPage, staticLlmsTxt } from '../../../scripts/prerender-seo'
import { pageTitle, PUBLIC_PAGES } from '../../application/site/public-pages'
import { courseSeo, pathwaySeo } from '../../application/site/catalog-pages'
import { publicPathways } from '../../data/public-pathways'
import { courseById } from '../../data/courses'
import { getCoreCatalogRaw } from '../../data/core-catalog-source'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

const TEMPLATE = `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <title>مسارك يبدأ من فهمك — أكاديمية وجيز</title>
    <meta name="description" content="وصف الرئيسة" />
    <link rel="canonical" href="https://www.wajeezacademy.com/" />
    <meta property="og:title" content="t" />
    <meta property="og:description" content="d" />
    <meta property="og:url" content="https://www.wajeezacademy.com/" />
    <meta name="twitter:title" content="t" />
    <meta name="twitter:description" content="d" />
    <script type="application/ld+json">
    { "@context": "https://schema.org" }
    </script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`

const canonicalOf = (h: string) => /<link rel="canonical" href="([^"]*)"/.exec(h)?.[1]
const titleOf = (h: string) => /<title>([^<]*)<\/title>/.exec(h)?.[1]
const bodyText = (h: string) =>
  (/<div id="root">([\s\S]*?)<\/body>/.exec(h)?.[1] ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const graphOf = (h: string) =>
  JSON.parse(
    (/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(h)?.[1] ?? '{}').replace(/\\u003c/g, '<'),
  ) as { '@graph': Record<string, unknown>[] }
const unescape = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')

describe('صفحات المسارات المهيّأة', () => {
  it('لكلّ مسار عامّ صفحة', () => {
    expect(publicPathways.length).toBeGreaterThan(5)
  })

  it.each(publicPathways.map((p) => [p.id, p] as const))('«%s» بعنوانه وcanonicalه ونصّه', (_id, p) => {
    const page = pathwayPage(p)
    const html = renderPage(TEMPLATE, page.meta, page.graph, page.body)
    expect(canonicalOf(html)).toBe(`https://www.wajeezacademy.com/pathways/${p.id}`)
    expect(unescape(titleOf(html) ?? '')).toBe(pageTitle(p.name))
    const text = unescape(bodyText(html))
    expect(text).toContain(p.name)
    expect(text).toContain(p.audience)
    expect(text.length).toBeGreaterThan(400)

    /* ودوراتُه روابطُ تُتبع — وإلّا فلا يجد الزاحفُ صفحاتِ الدورات */
    const hrefs = [...html.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1])
    for (const id of p.courseIds) expect(hrefs, `«${p.id}» لا يدلّ على ${id}`).toContain(`/build/${id}`)

    const program = graphOf(html)['@graph'].find((n) => n['@type'] === 'EducationalOccupationalProgram')
    expect(program, 'لا برنامج في البيانات المنظّمة').toBeTruthy()
    expect((program!.hasCourse as unknown[]).length).toBe(p.courseIds.length)
  })
})

describe('صفحات الدورات المهيّأة', () => {
  const ids = getCoreCatalogRaw().courses.map((c) => c.course_id)

  it('لكلّ دورة في الكتالوج صفحة', () => {
    expect(ids.length).toBeGreaterThan(50)
    const paths = new Set(catalogPages().map((p) => p.meta.path))
    for (const id of ids) expect(paths.has(`/build/${id}`), id).toBe(true)
  })

  it.each(ids.slice(0, 40))('«%s» بعنوانه وcanonicalه وCourse', (id) => {
    const page = coursePage(id)!
    const html = renderPage(TEMPLATE, page.meta, page.graph, page.body)
    const c = courseById(id)!
    expect(canonicalOf(html)).toBe(`https://www.wajeezacademy.com/build/${id}`)
    expect(unescape(titleOf(html) ?? '')).toBe(pageTitle(c.name))
    expect(unescape(bodyText(html)).length).toBeGreaterThan(300)

    const course = graphOf(html)['@graph'].find((n) => n['@type'] === 'Course')!
    expect(course.name).toBe(c.name)
    expect((course.provider as { name: string }).name).toBe('أكاديمية وجيز')
    expect(course.hasCourseInstance).toBeTruthy()
  })

  it('ولا سعر في البيانات المنظّمة — السعر من الشعبة، ورقم يخالف الصفحة يسقط الوسم', () => {
    for (const page of catalogPages()) {
      expect(page.graph, page.meta.path).not.toMatch(/"offers"|"price"/)
    }
  })

  it('ولا canonical مكرّر بين الكتالوج والصفحات العامّة', () => {
    const all = [...PUBLIC_PAGES.map((p) => p.path), ...catalogPages().map((p) => p.meta.path)]
    expect(new Set(all).size).toBe(all.length)
  })
})

describe('العنوان واحد في الصفحة الحيّة والمهيّأة', () => {
  /* لو كتبت الصفحةُ عنوانَها بنفسها لافترق عمّا قرأه الزاحف في المصدر.
     والفحصُ على البنية: `SeoHead` يأخذ خصائصَه من الدالّة نفسِها كلَّها. */
  it('صفحة المسار تأخذ وسومها من pathwaySeo', () => {
    const src = readFileSync(join(root, 'src/pages/Pathway.tsx'), 'utf8')
    expect(src).toMatch(/<SeoHead\s+\{\.\.\.pathwaySeo\(pathway\)\}\s*\/>/)
  })

  it('وصفحة الدورة من courseSeo', () => {
    const src = readFileSync(join(root, 'src/pages/CoursePath.tsx'), 'utf8')
    expect(src).toMatch(/<SeoHead\s+\{\.\.\.courseSeo\(anchor\)\}\s*\/>/)
  })

  it('وصفحة المدرّب من trainerSeo — وهو ما يكتبه الخادم', () => {
    const src = readFileSync(join(root, 'src/pages/TrainerPublic.tsx'), 'utf8')
    expect(src).toMatch(/<SeoHead\s+\{\.\.\.trainerSeo\(page\)\}\s*\/>/)
    const server = readFileSync(join(root, 'server/services/trainer-seo-page.ts'), 'utf8')
    expect(server).toMatch(/const meta = trainerSeo\(page\)/)
  })

  it('والعنوان اسم الدورة لا جملة فعل', () => {
    expect(courseSeo({ id: 'X', name: 'دورة س', promise: 'وعد' }).title).toBe('دورة س')
    expect(pathwaySeo({ id: 'P', name: 'مسار ص', transformation: 't', level: 'أساسي', durationWeeks: 4 }).path).toBe('/pathways/P')
  })
})

describe('llms.txt الساكن', () => {
  const txt = staticLlmsTxt()

  it('بصيغة llmstxt.org: عنوان H1 ثم ملخّص مقتبس', () => {
    const lines = txt.split('\n')
    expect(lines[0]).toMatch(/^# /)
    expect(lines.find((l) => l.trim() !== '' && !l.startsWith('# '))).toMatch(/^> /)
  })

  it('يدلّ على كلّ صفحة عامّة برابط مطلق', () => {
    for (const p of PUBLIC_PAGES) expect(txt, p.path).toContain(`(https://www.wajeezacademy.com${p.path})`)
  })

  it('والصفحات القانونيّة في Optional وحدها', () => {
    const optional = txt.split('## Optional')[1] ?? ''
    expect(optional).toContain('/p/privacy')
    expect(txt.split('## Optional')[0]).not.toContain('/p/privacy)')
  })
})
