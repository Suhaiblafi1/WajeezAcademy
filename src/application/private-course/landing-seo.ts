/* ═══ صفحةُ الدورة الخاصّة كما يقرؤها واتساب وقوقل — `dist/ai-jobs.html` (١٩ نوفمبر ٢٠٢٦) ═══

   الرابطُ يُنشر في واتساب ولينكدإن. وزاحفُ المعاينة لا يشغّل جافاسكربت: يقرأ وسومَ الصفحة كما وصلت. فلولا ملفٌّ
   مُهيَّأٌ لها لظهرت معاينتُها عنوانَ الرئيسة وصورتَها — رابطُ الدورة بوجه الأكاديميّة. فيكتبه `scripts/prerender-seo.ts`
   بعد كلّ بناء: عنوانُ الدورة ووصفُها وصورةُ المنشور الأولى، ونصٌّ للزاحف. ويخدمه Caddy بـ`{path}.html`.

   والعنوانُ بلا ذيل «— أكاديمية وجيز»: الدورةُ دورةُ صاحبها، لا صفحةٌ من صفحات الأكاديميّة. */

import { AI_JOBS, AI_JOBS_SEO } from './ai-jobs'
import { SEO_END, SEO_START, esc, graphJson, renderPageAt } from '../site/render-page'
import { pageTitle } from '../site/public-pages'

export const AI_JOBS_PATH = '/ai-jobs'
const AI_JOBS_PAGE_TITLE = AI_JOBS_SEO.title
const AI_JOBS_PAGE_DESC = AI_JOBS_SEO.description
export const AI_JOBS_IMAGE_PATH = '/campaigns/ai-jobs/og.jpg'

export function renderAiJobsPage(template: string, origin: string): string {
  const meta = { path: AI_JOBS_PATH, title: AI_JOBS_PAGE_TITLE, description: AI_JOBS_PAGE_DESC }
  const graph = graphJson([{
    '@type': 'Course',
    '@id': `${origin}${AI_JOBS_PATH}#course`,
    name: AI_JOBS.title,
    description: AI_JOBS_PAGE_DESC,
    inLanguage: 'ar',
    url: `${origin}${AI_JOBS_PATH}`,
    image: `${origin}${AI_JOBS_IMAGE_PATH}`,
    provider: { '@type': 'Person', name: AI_JOBS.trainer },
    offers: { '@type': 'Offer', price: AI_JOBS.priceUsd, priceCurrency: 'USD', url: `${origin}${AI_JOBS_PATH}#register`, category: 'Paid' },
    hasCourseInstance: AI_JOBS.sections.map((s) => ({
      '@type': 'CourseInstance',
      name: s.title,
      courseMode: 'Online',
      startDate: s.startsAt,
      endDate: s.endsAt,
      location: { '@type': 'VirtualLocation', url: `${origin}${AI_JOBS_PATH}` },
    })),
  }])
  const body =
    `${SEO_START}<div data-seo style="max-width:48rem;margin:0 auto;padding:2.5rem 1.25rem;font-family:'Tajawal',system-ui,sans-serif">` +
    `<h1 style="margin:0 0 .75rem;font-size:1.9rem;line-height:1.5">${esc(AI_JOBS.headline)}</h1>` +
    `<p style="margin:0 0 .75rem;line-height:2">${esc(AI_JOBS_PAGE_DESC)}</p>` +
    `<ul style="line-height:2">${AI_JOBS.sections.map((s) => `<li>${esc(`${s.title}: ${s.timeLabel} بتوقيت عمّان`)}</li>`).join('')}</ul>` +
    `<p style="line-height:2">${esc(`الدفع بتحويل CliQ إلى ${AI_JOBS.cliqAlias} — ${AI_JOBS.priceJod} دينار، ثم التسجيل من هذه الصفحة.`)}</p>` +
    `</div>${SEO_END}`
  const html = renderPageAt(template, origin, meta, graph, body, { image: `${origin}${AI_JOBS_IMAGE_PATH}` })
  /* `renderPageAt` يذيّل العنوانَ باسم الأكاديميّة في ثلاثة وسوم — ويُنزع هنا من ثلاثتها */
  return html.split(esc(pageTitle(AI_JOBS_PAGE_TITLE))).join(esc(AI_JOBS_PAGE_TITLE))
}
