/* ═══ ما يُنتقى من بلاغ `recording.completed` ═══

   التسجيلُ الواحدُ عند Zoom **عدّةُ ملفّات**: مرئيٌّ وصوتٌ ودردشةٌ ونصٌّ
   وخطُّ زمن. وبلاغُه يحملها كلَّها، ومنها يُنتقى ما يُعرض.

   ── ولمَ القرارُ هنا لا في الخدمة ──

   اختباراتُ الخادم تحتاج PostgreSQL، ولا تعمل إلّا في CI. فلو سكن هذا
   القرارُ في `zoom-events.service.ts` وحدَه لما جُرِّب نقضُه محلّيّا مرّةً
   — والقاعدةُ في هذا المستودَع أنّ الحارسَ **يُثبَت سقوطُه**.

   فالقرارُ هنا خالصا ويُجرَّب، والخدمةُ تكتب ما ينتقيه: صفٌّ في القاعدة
   وأثرٌ في السجلّ.

   ── وثلاثةُ أحكامٍ مكتوبة ──

     ١ · المرئيُّ وحدَه: ملفُّ دردشةٍ ليس «تسجيلَ اللقاء»، ومن عرضه عرَض
         نصًّا يظنّه المتعلّمُ درسا.
     ٢ · و«الشاشةُ مع المتحدّث» تُقدَّم على غيرها حين تُوجد: هي ما يريده من
         فاته الدرس — لا وجهُ المدرّب وحدَه ولا شريحةٌ بلا صوته.
     ٣ · وبلا رابطٍ لا شيء: `null` تعني «لا يُكتب صفّ». وصفُّ تسجيلٍ لا
         يُفتح أسوأُ من لا صفّ — لأنّه يُسكت طابورَ «تسجيلٌ لم يُرفع». */

export interface ZoomRecordingFileLike {
  file_type?: string
  recording_type?: string
  status?: string
  recording_start?: string
  recording_end?: string
  play_url?: string
}

export interface ZoomRecordingPayloadLike {
  /** مدّةُ اللقاء بالدقائق كما يقولها Zoom — بديلٌ حين لا مدى للملفّ */
  duration?: number
  share_url?: string
  recording_play_passcode?: string
  recording_files?: ZoomRecordingFileLike[]
}

export interface PickedRecording {
  url: string
  durationSec: number | null
}

const at = (v?: string): number | null => {
  if (!v) return null
  const t = new Date(v).getTime()
  return Number.isNaN(t) ? null : t
}

export function pickRecording(o: ZoomRecordingPayloadLike): PickedRecording | null {
  const files = o.recording_files ?? []
  /* والحالةُ الغائبةُ تُقرأ «جاهز»: Zoom لا يرسلها في كلّ صيغة، وقراءتُها
     نقصا تُسقط تسجيلاتٍ تامّة. */
  const ready = files.filter((f) => (f.status ?? 'completed') === 'completed' && f.file_type === 'MP4')
  const file = ready.find((f) => f.recording_type === 'shared_screen_with_speaker_view') ?? ready[0]

  /* رابطُ المشاركة أوّلا: هو صفحةُ التسجيل كاملا، و`play_url` ملفٌّ واحدٌ منه */
  const base = o.share_url || file?.play_url || ''
  if (!base) return null

  /* ── والرمزُ يُلحَق متى أرسله Zoom ──

     حساباتٌ تشترط رمزا لفتح التسجيل المشترَك وترسله معه. ورابطٌ بلا رمزِه
     يفتح صفحةً تسأل عمّا لا يملكه المتعلّم — عطبٌ صامتٌ تامّ: كلُّ شيءٍ
     يبدو واصلا ولا شيءَ يعمل.

     وثمنُه مقولٌ لا مخبوء: الرابطُ يصير حاملا — من نُسخ إليه شاهد. وهو دون
     سترِ الروابط الموقّعة التي تنتهي، وفوق تسجيلٍ لا يُفتح أصلا. والبابُ
     الذي يُعرض فيه محروسٌ بالالتحاق كما كان. */
  const pass = o.recording_play_passcode
  const url = pass ? `${base}${base.includes('?') ? '&' : '?'}pwd=${encodeURIComponent(pass)}` : base

  const from = at(file?.recording_start)
  const to = at(file?.recording_end)
  const durationSec = from !== null && to !== null
    ? Math.max(0, Math.round((to - from) / 1000))
    : typeof o.duration === 'number' ? Math.max(0, Math.round(o.duration * 60)) : null

  return { url, durationSec }
}
