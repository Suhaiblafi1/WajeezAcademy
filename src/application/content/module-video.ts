/* فيديو الوحدة وفصوله (البند ح-٢) — «لا تبنِ مشغلا؛ استضف واربط».
   القيمة ليست في المشغّل بل في **الفصول المعنونة** التي تجعل الفيديو قابلا
   للرجوع إليه، وفي **نقاط التفتيش** التي تحوّله من استقبال سلبي إلى استرجاع.

   الصيغة النصّية — كالمتن والتمرين، على إصدار الوحدة وبنفس الحاكمية:

     https://www.youtube.com/watch?v=XXXXXXXXXXX
     0:00 لماذا نبدأ بالعملية لا بالأداة
     2:30 الصفات الأربع
     7:10 تمرين على حالتك

   ⚠ المضيفون مسموحون بقائمة بيضاء (YouTube وVimeo) لا بقائمة حجب: أي مضيف
   آخر يُرفض عند الحفظ. سببه أن الإطار المدمج ينفّذ شيفرة المضيف في سياق
   صفحتنا، فالثقة بالمضيف قرار لا تفصيل. */

export interface VideoChapter {
  /** بداية الفصل بالثواني */
  atSec: number
  /** الطابع كما كُتب — يُعرض للمتعلم */
  atAr: string
  titleAr: string
}

export interface ModuleVideo {
  /** الرابط كما كُتب — للفتح في تبويب جديد */
  url: string
  /** رابط الإدماج بلا طابع — يبنيه المضيف */
  embedUrl: string
  provider: 'youtube' | 'vimeo'
  chapters: VideoChapter[]
}

export interface VideoParseResult {
  video: ModuleVideo | null
  errorsAr: string[]
}

/** يبني رابط إدماج من رابط مضيف مسموح — null لأي شيء آخر */
export function toEmbed(url: string): { embedUrl: string; provider: 'youtube' | 'vimeo' } | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (u.protocol !== 'https:') return null
  const host = u.hostname.replace(/^www\./, '')

  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const id = u.searchParams.get('v')
    if (id && /^[\w-]{6,20}$/.test(id)) return { embedUrl: `https://www.youtube-nocookie.com/embed/${id}`, provider: 'youtube' }
    const m = /^\/embed\/([\w-]{6,20})$/.exec(u.pathname)
    if (m) return { embedUrl: `https://www.youtube-nocookie.com/embed/${m[1]}`, provider: 'youtube' }
    return null
  }
  if (host === 'youtu.be') {
    const id = u.pathname.replace(/^\//, '')
    if (/^[\w-]{6,20}$/.test(id)) return { embedUrl: `https://www.youtube-nocookie.com/embed/${id}`, provider: 'youtube' }
    return null
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = /(\d{6,12})/.exec(u.pathname)
    if (m) return { embedUrl: `https://player.vimeo.com/video/${m[1]}`, provider: 'vimeo' }
    return null
  }
  return null
}

/** يضيف طابع البداية بالصيغة التي يفهمها كل مضيف */
export function embedAt(video: ModuleVideo, atSec: number): string {
  if (atSec <= 0) return video.embedUrl
  return video.provider === 'youtube'
    ? `${video.embedUrl}?start=${atSec}`
    : `${video.embedUrl}#t=${atSec}s`
}

function toSeconds(stamp: string): number | null {
  const parts = stamp.split(':').map((x) => x.trim())
  if (parts.length < 2 || parts.length > 3) return null
  if (!parts.every((x) => /^\d{1,2}$/.test(x))) return null
  const n = parts.map(Number)
  const sec = parts.length === 3 ? n[0] * 3600 + n[1] * 60 + n[2] : n[0] * 60 + n[1]
  return Number.isFinite(sec) ? sec : null
}

export function parseVideo(raw: string | null | undefined): VideoParseResult {
  const errorsAr: string[] = []
  if (!raw || !raw.trim()) return { video: null, errorsAr }
  const lines = raw.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim()).filter((l) => l !== '')
  if (lines.length === 0) return { video: null, errorsAr }

  const url = lines[0]
  const embed = toEmbed(url)
  if (!embed) {
    errorsAr.push('الرابط غير مقبول — يُسمح بـYouTube وVimeo عبر https فقط، والسطر الأول هو الرابط')
    return { video: null, errorsAr }
  }

  const chapters: VideoChapter[] = []
  for (const line of lines.slice(1)) {
    const m = /^(\d{1,2}:\d{1,2}(?::\d{1,2})?)\s+(.+)$/.exec(line)
    if (!m) {
      errorsAr.push(`سطر فصل غير مفهوم: «${line.slice(0, 40)}» — الصيغة «د:ث عنوان الفصل»`)
      continue
    }
    const sec = toSeconds(m[1])
    if (sec === null) {
      errorsAr.push(`طابع زمني غير صالح: «${m[1]}»`)
      continue
    }
    chapters.push({ atSec: sec, atAr: m[1], titleAr: m[2].trim() })
  }

  /* الفصول مرتّبة زمنيا حتما — ترتيب المؤلّف لا يُفترض */
  chapters.sort((a, b) => a.atSec - b.atSec)
  return { video: { url, embedUrl: embed.embedUrl, provider: embed.provider, chapters }, errorsAr }
}

export function validateVideo(raw: string | null | undefined): { ok: true } | { ok: false; errorsAr: string[] } {
  const { video, errorsAr } = parseVideo(raw)
  if (errorsAr.length > 0) return { ok: false, errorsAr }
  if (!video) return { ok: false, errorsAr: ['لا رابط مفهوم — السطر الأول رابط YouTube أو Vimeo'] }
  return { ok: true }
}
