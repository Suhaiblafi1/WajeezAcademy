/* صفحةُ المدرّب `/t/:slug` مُهيَّأةً للزاحف — يكتبها الخادمُ حين تُطلب.

   ═══ لماذا من الخادم (٥ نوفمبر ٢٠٢٦) ═══

   طلب صاحبُ المنصّة «SEO لصفحات المدرّبين كذلك». وكانت `/t/:slug` تُقدَّم لقوقل ولمحرّكات
   الإجابة بقالب الرئيسة: عنوانُها وcanonicalها وجسدٌ فارغ — فتُطوى في الرئيسة ولا يُقرأ منها
   اسمٌ ولا نبذة. وصفحاتُ المسارات والدورات تُهيَّأ وقتَ البناء، أمّا المدرّبُ فلا: اسمُه لا يُعرض
   إلّا ببوّابةٍ في القاعدة (`publicTrainerWhere()` — CLAUDE.md)، والبوّابةُ يومَ الطلب لا يومَ البناء.

   فالخادمُ يقرأ صفحتَه بالبوّابة نفسِها (`trainerPublicPage`) ويكتبها في قالب `dist/index.html`
   بالكاتب الذي يكتب به البناءُ أخواتِها (`render-page.ts`): عنوانُه ووصفُه (`trainerSeo` — وهو ما
   يكتبه `SeoHead` في الصفحة الحيّة)، وcanonicalُه، وصورتُه للمشاركة، و`ProfilePage` بـ`Person`،
   ونصٌّ يُقرأ بلا جافاسكربت: نبذتُه وتخصّصاتُه وأرقامُه ودوراتُه المفتوحة بروابطها.

   ═══ وللناس ومحرّكات البحث الصفحةُ نفسُها ═══

   لا تفريقَ بوكيل المستخدم بين إنسانٍ وزاحف: من يشغّل جافاسكربت يمحو التطبيقُ النصَّ ويرسم الصفحة
   (`data-seo` في `index.html`)، ومن لا يشغّله يقرؤه. والاستثناءُ الوحيدُ زاحفُ المعاينة (واتساب
   وفيسبوك…): يعلّمه Caddy بترويسة، فيُجاب بصورة رابطه المصمَّمة كما كان (`trainerPagePreview`).

   ولا سعرَ في البيانات المنظّمة: السعرُ من الشعبة ويتغيّر بالمنحة. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CANONICAL_ORIGIN } from '../../src/application/site/origin'
import { trainerSeo } from '../../src/application/site/trainer-seo'
import {
  A, breadcrumb, bullets, esc, graphJson, h1, h2, normalizeTemplate, P, para, providerRef, renderPageAt, shell, webPage,
} from '../../src/application/site/render-page'
import { cohortDayAr } from '../../src/application/learning/cohort-gate'

/** الأصلُ الذي تُعلنه الصفحاتُ المُهيَّأة — كالبناء (`scripts/prerender-seo.ts`) */
export function pageOrigin(): string {
  return (process.env.VITE_SITE_ORIGIN || CANONICAL_ORIGIN).replace(/\/+$/, '')
}

/* القالبُ `dist/index.html` المبنيُّ في الصورة نفسِها (`npm run build:image`) — يُقرأ مرّةً: النشرُ
   الجديدُ يعيد تشغيلَ الخادم، فلا يتخلّف القالبُ عن أصول البناء التي يشير إليها. و`WEB_DIST`
   كما في `deploy/docker-entrypoint.sh`. */
let cached: { dir: string; html: string | null } | null = null
export function readTemplate(): string | null {
  const dir = process.env.WEB_DIST || join(process.cwd(), 'dist')
  if (cached?.dir === dir) return cached.html
  let html: string | null = null
  try {
    html = readFileSync(join(dir, 'index.html'), 'utf8')
  } catch {
    html = null
  }
  cached = { dir, html }
  return html
}

/** للاختبار: يُعاد القالبُ من القرص */
export function resetTemplateCache(): void {
  cached = null
}

/** ما يلزم الصفحةَ من `trainerPublicPage` */
export interface TrainerPageData {
  slug: string
  name: string
  headline: string | null
  bio: string | null
  photoUrl: string | null
  country: string | null
  specialties: string[]
  ratingAvg: number | null
  ratingCount: number | null
  hoursTaught: number | null
  graduatesCount: number | null
  paths: { titleAr: string; blurbAr: string | null }[]
  cohorts: { courseId: string; courseTitle: string; startsAt: Date | string | null }[]
}

const absolute = (origin: string, url: string | null) =>
  !url ? null : url.startsWith('http') ? url : `${origin}${url.startsWith('/') ? '' : '/'}${url}`

/** الصفحةُ مكتوبةً في القالب */
export function trainerSeoHtml(template: string, page: TrainerPageData, origin = pageOrigin()): string {
  const meta = trainerSeo(page)
  const url = `${origin}${meta.path}`
  const photo = absolute(origin, page.photoUrl)

  /* دوراتُه المفتوحة — الدورةُ مرّةً وإن تعدّدت شعبُها، وأقربُ بدايةٍ لها */
  const courses = new Map<string, { title: string; startsAt: Date | string | null }>()
  for (const c of page.cohorts) {
    if (!c.courseTitle) continue
    const prev = courses.get(c.courseId)
    const earlier = prev && prev.startsAt && c.startsAt ? new Date(c.startsAt) < new Date(prev.startsAt) : !prev
    if (earlier) courses.set(c.courseId, { title: c.courseTitle, startsAt: c.startsAt })
  }

  const person: Record<string, unknown> = {
    '@type': 'Person',
    '@id': `${url}#person`,
    name: page.name,
    url,
    jobTitle: 'مدرب',
    worksFor: providerRef(origin),
  }
  if (page.headline) person.description = page.headline
  if (photo) person.image = photo
  if (page.specialties.length) person.knowsAbout = page.specialties

  const graph = graphJson([
    {
      ...webPage(origin, meta),
      '@type': 'ProfilePage',
      mainEntity: { '@id': `${url}#person` },
    },
    breadcrumb(origin, { title: 'الفريق التدريبي', path: '/trainers' }, { title: page.name, path: meta.path }),
    person,
    ...[...courses.entries()].map(([id, c]) => ({
      '@type': 'Course',
      '@id': `${origin}/build/${id}#course`,
      name: c.title,
      url: `${origin}/build/${id}`,
      provider: providerRef(origin),
      instructor: { '@id': `${url}#person` },
    })),
  ])

  const parts: string[] = [h1(page.name)]
  if (page.headline) parts.push(para(page.headline))
  parts.push(para(meta.description))
  const bio = (page.bio ?? '').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)
  if (bio.length) parts.push(h2('نبذة'), ...bio.map(para))
  if (page.specialties.length) parts.push(h2('التخصصات'), para(page.specialties.join('، ')))
  const facts = [
    page.ratingAvg != null && page.ratingCount ? `التقييم: ${page.ratingAvg.toFixed(1)} من 5 (${page.ratingCount} تقييم)` : '',
    page.hoursTaught ? `ساعات التدريب: ${page.hoursTaught}` : '',
    page.graduatesCount ? `الخريجون: ${page.graduatesCount}` : '',
  ].filter(Boolean)
  if (facts.length) parts.push(h2('في أرقام'), bullets(facts.map(esc)))
  if (courses.size) {
    parts.push(
      h2('دوراته المفتوحة للتسجيل'),
      bullets(
        [...courses.entries()].map(
          ([id, c]) =>
            `<a href="/build/${esc(id)}" ${A}>${esc(c.title)}</a>` +
            (c.startsAt ? ` — تبدأ ${esc(cohortDayAr(c.startsAt))}` : ''),
        ),
      ),
    )
  }
  if (page.paths.length) {
    parts.push(
      h2('مسارات بناها'),
      bullets(page.paths.map((p) => `<strong>${esc(p.titleAr)}</strong>${p.blurbAr ? ` — ${esc(p.blurbAr)}` : ''}`)),
    )
  }
  parts.push(`<p ${P}><a href="/trainers" ${A}>كل الفريق التدريبي</a></p>`)

  return renderPageAt(template, origin, meta, graph, shell(parts, meta.path), { image: photo })
}

/** صفحةُ «لا مدرّب بهذا المسار» — القالبُ كما هو بلا فهرسة، والتطبيقُ يقول ما جرى */
export function trainerNotFoundHtml(template: string): string {
  return normalizeTemplate(template).replace(
    /(<meta name="description" content="[^"]*"\s*\/?>)/,
    '$1\n    <meta name="robots" content="noindex, nofollow" />',
  )
}
