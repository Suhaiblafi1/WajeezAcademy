/* «تعرّف على مدرّبك» — فيديو المدرّب في صفحة الدورة وصفحته (٨ نوفمبر ٢٠٢٦).

   ═══ القرار ═══

   كان المدرّبُ يلصق رابطَ فيديو في «التسويق» من بوّابته، ولا يُعرض الرابطُ للعامّة في أيّ موضع —
   في بوّابته وشاشة الإدارة وحدَهما. والفيديو وُجد «ليقنع الناسَ بالانضمام» (قرارُ ٢٩ سبتمبر، في رأس
   `server/services/trainer-marketing.service.ts`). فاختار صاحبُ المنصّة أن يُعرض **في صفحة الدورة
   التي يراها الزائر** قسما بعنوان «تعرّف على مدرّبك».

   ═══ ما يُعرض، وبأيّ ترتيب (`pickPublicVideo`) ═══

   فيديو المدرّب لهذه الدورة أوّلا، ثمّ فيديو تعريفه (`bio`). ولا شيءَ غيرُهما: لا صندوقَ فارغ ولا
   «لا فيديو بعد». ومن يُسأل عنه أصلا يقرّره الخادمُ ببوّابة الظهور نفسِها التي تُعلن اسمَه على
   الدورة (`publicCourseTrainer` ← `trainerPubliclyVisible`)، لا هذا الملفّ.

   ═══ والتضمينُ آمنٌ بالبناء (`videoEmbedOf`) ═══

   الرابطُ كتبه إنسانٌ، فلا يدخل `src` إطارٍ كما هو أبدا. يُقرأ منه المعرّفُ وحدَه بتعبيرٍ صارم، ثمّ
   يُبنى رابطُ التضمين من أصلٍ ثابتٍ معروف:

     يوتيوب  (watch?v= · youtu.be/ · /shorts/ · /embed/ · /live/) ← www.youtube-nocookie.com/embed/<id>
     فيميو   (vimeo.com/<id>[/<hash>] · player.vimeo.com/video/<id>) ← player.vimeo.com/video/<id>
     درايف   (/file/d/<id>/… · open?id=<id>)                       ← drive.google.com/file/d/<id>/preview

   وما سوى ذلك من روابط https يُعرض زرّا يفتح الرابطَ في لسانٍ جديد — لا إطار. وما ليس https لا
   يُعرض بتاتا (`cleanMarketingUrl` نفسُها التي يُحفظ بها).

   والأصولُ الثلاثةُ وحدَها في `frame-src` من سياسة الموقع (`deploy/Caddyfile`) — يقرؤها حارسُها من
   `VIDEO_EMBED_ORIGINS` هنا، فلا يفترق ما نبنيه عمّا تسمح به السياسة.

   والدالّةُ ثابتةٌ على ناتجها: رابطُ التضمين يُقرأ ثانيةً فيعطي نفسَه. وبذلك تفحص الواجهةُ ما وصلها
   من الخادم بالدالّة نفسِها (`renderableVideo`) قبل أن تضعه في إطار. */

import { cleanMarketingUrl } from './marketing'

export type VideoProvider = 'youtube' | 'vimeo' | 'drive'

/** ما يُعرض للزائر: إطارٌ بُني رابطُه عندنا، أو زرٌّ يفتح الرابطَ كما هو */
export type PublicTrainerVideo =
  | { kind: 'embed'; provider: VideoProvider; src: string }
  | { kind: 'link'; href: string }

/** أصولُ الإطارات التي نبنيها — وهي وحدَها ما يُضاف لأجلها إلى `frame-src` */
export const VIDEO_EMBED_ORIGINS: Readonly<Record<VideoProvider, string>> = {
  youtube: 'https://www.youtube-nocookie.com',
  vimeo: 'https://player.vimeo.com',
  drive: 'https://drive.google.com',
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/
const VIMEO_ID = /^[0-9]{1,12}$/
/** بصمةُ فيديو فيميو غيرِ المدرَج — بلا هذه لا يعمل إطارُه */
const VIMEO_HASH = /^[0-9a-f]{6,20}$/
const DRIVE_ID = /^[A-Za-z0-9_-]{10,100}$/

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'])
const YOUTUBE_PATHS = new Set(['shorts', 'embed', 'live'])
const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com'])

function embed(provider: VideoProvider, path: string): PublicTrainerVideo {
  return { kind: 'embed', provider, src: `${VIDEO_EMBED_ORIGINS[provider]}${path}` }
}

/** أجزاءُ المسار بلا الفراغات — `/a//b/` ← `['a','b']` */
function segments(u: URL): string[] {
  return u.pathname.split('/').filter(Boolean)
}

function youtubeId(u: URL): string | null {
  const host = u.hostname.toLowerCase()
  const parts = segments(u)
  if (host === 'youtu.be') return parts.length === 1 ? parts[0]! : null
  if (!YOUTUBE_HOSTS.has(host)) return null
  if (parts.length === 1 && parts[0] === 'watch') return u.searchParams.get('v')
  if (parts.length === 2 && YOUTUBE_PATHS.has(parts[0]!)) return parts[1]!
  return null
}

function vimeoEmbed(u: URL): PublicTrainerVideo | null {
  const host = u.hostname.toLowerCase()
  const parts = segments(u)
  let id: string | undefined
  let hash: string | null = null
  if (host === 'player.vimeo.com') {
    if (parts.length !== 2 || parts[0] !== 'video') return null
    id = parts[1]
    hash = u.searchParams.get('h')
  } else if (VIMEO_HOSTS.has(host)) {
    /* vimeo.com/<id> · vimeo.com/<id>/<hash> · vimeo.com/channels/<اسم>/<id> */
    if (parts.length === 3 && parts[0] === 'channels') id = parts[2]
    else if (parts.length === 1 || parts.length === 2) {
      id = parts[0]
      hash = parts[1] ?? null
    }
  }
  if (!id || !VIMEO_ID.test(id)) return null
  if (hash !== null && !VIMEO_HASH.test(hash)) return null
  return embed('vimeo', `/video/${id}${hash ? `?h=${hash}` : ''}`)
}

function driveId(u: URL): string | null {
  if (u.hostname.toLowerCase() !== 'drive.google.com') return null
  const parts = segments(u)
  if (parts.length >= 3 && parts[0] === 'file' && parts[1] === 'd') return parts[2]!
  if (parts.length === 1 && parts[0] === 'open') return u.searchParams.get('id')
  return null
}

/** رابطُ فيديو المدرّب كما حفظه ← ما يُعرض منه للزائر، أو `null` إن لم يصلح للعرض أصلا */
export function videoEmbedOf(raw: unknown): PublicTrainerVideo | null {
  const clean = cleanMarketingUrl(raw)
  if (!clean) return null
  const u = new URL(clean)
  /* رابطٌ بمنفذٍ أو باسم مستخدمٍ ليس رابطَ مزوّدٍ نعرفه — يبقى زرّا */
  if (u.port || u.username || u.password) return { kind: 'link', href: clean }

  const yt = youtubeId(u)
  if (yt !== null) return YOUTUBE_ID.test(yt) ? embed('youtube', `/embed/${yt}`) : { kind: 'link', href: clean }

  const vimeo = vimeoEmbed(u)
  if (vimeo) return vimeo

  const drive = driveId(u)
  if (drive !== null) return DRIVE_ID.test(drive) ? embed('drive', `/file/d/${drive}/preview`) : { kind: 'link', href: clean }

  return { kind: 'link', href: clean }
}

/** صفٌّ من `TrainerMarketingVideo` بما يلزم الاختيارَ منه */
export interface MarketingVideoRow {
  targetKind: string
  targetId: string
  url: string
}

/** فيديو المدرّب لهذه الدورة، ثمّ تعريفُه — أوّلُ ما يصلح منهما للعرض. و`courseId` فارغٌ لصفحته هو: تعريفُه وحدَه */
export function pickPublicVideo(rows: readonly MarketingVideoRow[], courseId: string | null): PublicTrainerVideo | null {
  const course = courseId ? rows.find((r) => r.targetKind === 'course' && r.targetId === courseId) : undefined
  const bio = rows.find((r) => r.targetKind === 'bio' && r.targetId === '')
  for (const r of [course, bio]) {
    const v = r ? videoEmbedOf(r.url) : null
    if (v) return v
  }
  return null
}

/** ما وصل من الشبكة يُفحص قبل أن يُرسم: الإطارُ يُعاد بناؤه من رابطه فيلزم أن يعطي نفسَه، والزرُّ https وحدَه */
export function renderableVideo(v: unknown): PublicTrainerVideo | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  if (o.kind === 'embed') {
    const again = videoEmbedOf(o.src)
    return again?.kind === 'embed' && again.src === o.src ? again : null
  }
  if (o.kind === 'link') {
    const href = cleanMarketingUrl(o.href)
    return href ? { kind: 'link', href } : null
  }
  return null
}
