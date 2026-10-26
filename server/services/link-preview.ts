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
  const url = `${x.origin}/s/${x.code}`
  const image = `${x.origin}/api/public/links/${x.code}/preview.jpg?v=${encodeURIComponent(x.sig)}`
  const to = `${x.origin}${x.target}`
  const t = esc(x.title)
  const d = esc(x.text)
  /* والوجهةُ مسارٌ داخليٌّ مفحوص، وتُكتب في السكربت نصّا لا يكسر الوسم */
  const js = JSON.stringify(to).replace(/</g, '\\u003c')
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
<meta property="og:url" content="${esc(url)}" />
<meta property="og:image" content="${esc(image)}" />
<meta property="og:image:type" content="image/jpeg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="${t}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${t}" />
<meta name="twitter:description" content="${d}" />
<meta name="twitter:image" content="${esc(image)}" />
</head>
<body>
<p><a href="${esc(to)}">${t}</a></p>
<script>location.replace(${js})</script>
</body>
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
