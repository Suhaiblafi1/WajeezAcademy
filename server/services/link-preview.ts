/* ═══ معاينةُ روابط «شارك دوراتك» (٢٦ أكتوبر ٢٠٢٦) ═══

   سُئل صاحبُ المنصّة: «إذا لصق المدرّبُ رابطَه في واتساب أو فيسبوك، أتظهر صورتُه المصمَّمة؟»، فقال: «أضف معاينة،
   نعم». وكان الرابطُ القصيرُ `‎/s/XXXXXX` صفحةً في الواجهة تحوّل بجافاسكربت — وزاحفُ واتساب وفيسبوك ولينكدإن لا
   يشغّل جافاسكربت، فكان يقرأ وسومَ الرئيسة: شعارُ الأكاديميّة وعنوانُها، لا المدرّبُ ولا دوراتُه.

   فصار `‎/s/:code` يُجاب من الخادم (`public.routes.ts`، ويمرّره Caddy):
   · **رابطٌ له معاينة** — صفحةٌ صغيرةٌ فيها وسومُ المعاينة (العنوانُ والوصفُ والصورةُ ١٢٠٠×٦٣٠) ثمّ تحويلٌ فوريٌّ إلى
     وجهته. فالزاحفُ يقرأ الوسوم، والإنسانُ لا يكاد يرى الصفحة.
   · **ورابطٌ بلا معاينة** (روابطُ البريد وغيرُها) — تحويلٌ ٣٠٢ كما كان، فيقرأ الزاحفُ وسومَ الوجهة نفسِها.
   · **ومجهولٌ أو مُبطَل** — صفحةُ «رابط لا يفتح».

   والصورةُ ترسمها صفحةُ المدرّب بخطّ المنصّة (`share-art.ts`، صيغةُ `link`) وترفعها حين يتغيّر ما رُسمت منه — فالخادمُ
   بلا محرّكِ رسم. أمّا **العنوانُ والوصف فيكتبهما الخادمُ** من دورات المدرّب (`previewCopy`)، لا ممّا يرسله المتصفّح:
   ما يُعرض لكلّ من يُلصق الرابطُ عنده لا يُكتب بيد من يرفع. */

import { cohortDayAr } from '../../src/application/learning/cohort-gate'
import { splitTitle } from '../../src/application/trainer/share-kit'

/** صورةُ المعاينة JPEG ١٢٠٠×٦٣٠ — وسقفُها بعيدٌ عمّا يخرج من اللوح (نحو ١٥٠ ك.ب) */
export const PREVIEW_MAX_BYTES = 600 * 1024

/** أوّلُ ثلاثة بايتات في كلّ JPEG — فلا يُخزَّن ما ادّعى أنّه صورةٌ وليس بها */
export function isJpeg(b: Buffer): boolean {
  return b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
}

export interface PreviewInput {
  name: string
  courses: { courseTitle: string; startsAt: string | null }[]
  code: { code: string; percentOff: number } | null
  /** رابطُه العامّ (كلُّ دوراته) أم رابطُ شعبةٍ بعينها */
  wide: boolean
}

/** عنوانُ المعاينة ووصفُها — قصيران كما تقطعهما المنصّات */
export function previewCopy(x: PreviewInput): { title: string; text: string } {
  const courses = [...x.courses].sort((a, b) => (a.startsAt ?? '9').localeCompare(b.startsAt ?? '9'))
  const offer = x.code ? `خصم ${x.code.percentOff}٪ بالكود ${x.code.code}` : 'المقاعد محدودة'
  if (!x.wide && courses.length === 1) {
    const c = courses[0]
    return {
      title: `${splitTitle(c.courseTitle).name} — مع ${x.name}`,
      text: ['بث مباشر على Zoom', c.startsAt ? `تبدأ ${cohortDayAr(c.startsAt, { day: 'numeric', month: 'long' })}` : null, offer].filter(Boolean).join(' · '),
    }
  }
  const names = courses.map((c) => splitTitle(c.courseTitle).name).join('، ')
  return {
    title: `دورات ${x.name} — بث مباشر في أكاديمية وجيز`,
    text: clip(`${names ? `${names}. ` : ''}${offer}`, 280),
  }
}

const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).replace(/\s+\S*$/, '')}…`)

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** صفحةُ الرابط بمعاينته — وسومٌ للزاحف، وتحويلٌ فوريٌّ للإنسان */
export function previewPage(x: { origin: string; code: string; target: string; title: string; text: string; sig: string }): string {
  return metaPage({
    title: x.title, text: x.text, url: `${x.origin}/s/${x.code}`, to: `${x.origin}${x.target}`, redirect: true,
    image: { url: `${x.origin}/api/public/links/${x.code}/preview.jpg?v=${encodeURIComponent(x.sig)}`, type: 'image/jpeg', w: 1200, h: 630 },
  })
}

/* ═══ وصفحتُه العامّةُ نفسُها `‎/t/اسمه` (٢٧ أكتوبر ٢٠٢٦) ═══
   سُئل صاحبُ المنصّة عن الروابط الطويلة التي نُشرت قبل الروابط القصيرة — صفحةُ المدرّب العامّة تظهر بشعار
   الأكاديميّة وعنوانِ الرئيسة — فقال: «الاثنتان». وصفحتُه في الواجهة تُرسم بجافاسكربت، والزاحفُ لا يشغّله.
   فزاحفُ المعاينة وحدَه (واتساب وفيسبوك ولينكدإن وإكس وتيليغرام… لا محرّكاتُ البحث: لها الصفحةُ نفسُها كما
   يراها الناس) يُمرّره Caddy إلى الخادم (`@previewCrawler` في `deploy/Caddyfile`) فيُجاب بوسوم المدرّب:
   · **صورتُه المصمَّمة** إن رسمتها صفحتُه لرابطه العامّ (معاينةُ رابطه القصير — العنوانُ والوصفُ والصورةُ نفسُها).
   · **وإلّا صورتُه ومسمّاه** — وصورةُ الأكاديميّة إن لم تكن له صورة.
   والبوّابةُ بوّابةُ صفحته (`trainerPublicPage` → `publicTrainerWhere()`): من لا تُعرض صفحتُه لا تُعرض معاينتُه.
   ولا تحويلَ فيها: الزاحفُ وحدَه يبلغها، ولو بلغها إنسانٌ لوجد الرابطَ إلى الصفحة نفسِها. */
export function trainerPagePreview(x: {
  origin: string; slug: string; name: string; headline: string | null; photoUrl: string | null
  /** معاينةُ رابطه العامّ القصير إن رُسمت */
  link: { code: string; title: string; text: string; sig: string } | null
}): string {
  const url = `${x.origin}/t/${encodeURIComponent(x.slug)}`
  if (x.link) {
    return metaPage({
      title: x.link.title, text: x.link.text, url, to: url, redirect: false,
      image: { url: `${x.origin}/api/public/links/${x.link.code}/preview.jpg?v=${encodeURIComponent(x.link.sig)}`, type: 'image/jpeg', w: 1200, h: 630 },
    })
  }
  const photo = x.photoUrl ? (x.photoUrl.startsWith('http') ? x.photoUrl : `${x.origin}${x.photoUrl}`) : null
  return metaPage({
    title: `${x.name} — أكاديمية وجيز`, text: x.headline ?? 'دورات بث مباشر في أكاديمية وجيز', url, to: url, redirect: false,
    image: photo ? { url: photo, type: null, w: null, h: null } : { url: `${x.origin}/og-image.png`, type: 'image/png', w: 1200, h: 630 },
  })
}

function metaPage(x: {
  title: string; text: string; url: string; to: string; redirect: boolean
  image: { url: string; type: string | null; w: number | null; h: number | null }
}): string {
  const t = esc(x.title)
  const d = esc(x.text)
  /* والوجهةُ مسارٌ داخليٌّ مفحوص، وتُكتب في السكربت نصّا لا يكسر الوسم */
  const js = JSON.stringify(x.to).replace(/</g, '\\u003c')
  const wide = x.image.w !== null
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${t}</title>
<meta name="robots" content="noindex" />
<meta name="description" content="${d}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="أكاديمية وجيز" />
<meta property="og:locale" content="ar_AR" />
<meta property="og:title" content="${t}" />
<meta property="og:description" content="${d}" />
<meta property="og:url" content="${esc(x.url)}" />
<meta property="og:image" content="${esc(x.image.url)}" />
${x.image.type ? `<meta property="og:image:type" content="${x.image.type}" />\n` : ''}${wide ? `<meta property="og:image:width" content="${x.image.w}" />
<meta property="og:image:height" content="${x.image.h}" />\n` : ''}<meta property="og:image:alt" content="${t}" />
<meta name="twitter:card" content="${wide ? 'summary_large_image' : 'summary'}" />
<meta name="twitter:title" content="${t}" />
<meta name="twitter:description" content="${d}" />
<meta name="twitter:image" content="${esc(x.image.url)}" />
</head>
<body>
<p><a href="${esc(x.to)}">${t}</a></p>
${x.redirect ? `<script>location.replace(${js})</script>\n` : ''}</body>
</html>`
}

/** صفحةُ رابطٍ لا يفتح — مجهولٌ أو مُبطَل، بالجواب نفسِه بقصد (`ShortLinkService.resolve`) */
export function deadLinkPage(origin: string): string {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>رابط لا يفتح — أكاديمية وجيز</title><meta name="robots" content="noindex" /></head>
<body style="font-family:system-ui,sans-serif;text-align:center;padding:4rem 1rem">
<h1>رابط لا يفتح</h1>
<p>تأكد من نسخه كاملا، أو ابدأ من <a href="${esc(origin)}/">صفحة الأكاديمية</a>.</p>
</body>
</html>`
}
