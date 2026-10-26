/* مصدرُ التسجيل — من أين جاء المتعلّم وكيف (٢٦ أكتوبر ٢٠٢٦).

   سأل صاحبُ المنصّة عن متعلّمَين في قائمة المستخدمين: «كيف أعلم من أين وصل وكيف وصل؟» —
   ولم يكن في الحساب جوابٌ: لا وسمُ حملة، ولا موقعٌ أحاله، ولا رابطُ مدرّب. فقط نموذجُ المنحة
   كان يحفظ قناتَه (`Lead.channel`)، ومن سجّل بغيره لا أثرَ لطريقه.

   ═══ «أوّلُ لمسةٍ تحمل إشارة» ═══

   المتصفّحُ يحفظ أوّلَ زيارةٍ جاء فيها بإشارة — وسمِ حملة (`utm_*`)، أو قناةٍ (`?ch=`)،
   أو رابطِ مدرّب (`?ref=`)، أو موقعٍ أحاله. وزيارةٌ بلا إشارةٍ («مباشر») تُحفظ إن لم يكن
   قبلها شيء، وتحلّ محلَّها أوّلُ زيارةٍ بإشارة. فمن رأى إعلانا في فيسبوك ثمّ كتب العنوانَ
   بيده بعد يومين يُنسب إلى فيسبوك لا إلى «مباشر».

   ولا يُحفظ من الموقع المُحيل إلّا اسمُه (`google.com`) لا عنوانُه الكامل، ولا من الصفحة
   الأولى إلّا مسارُها بلا استعلام — فلا يُخزَّن ما قد يحمل بياناتِ أحد.

   والحسابُ هنا لا في الصفحة ولا في الخادم وحدَه: المتصفّحُ يلتقط (`touchFromLocation`)،
   والخادمُ يُنظّف ما وصله (`cleanTouch`) فلا يثق بما يرسله المتصفّح، والشاشةُ تسمّي
   (`sourceLabelAr`). والحارس: `src/tests/marketing/signup-source.test.ts`. */

/** ما يُلتقط من الزيارة — كلُّه اختياريّ، والغائبُ لا يُكتب */
export interface FirstTouch {
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
  utmTerm?: string
  /** قناةُ رابط الحملة — `?ch=whatsapp` (`grant-landing.ts`) */
  channel?: string
  /** دفعتُها — `?w=1` */
  wave?: string
  /** رمزُ رابط المدرّب — `?ref=` (`referral.service.ts`) */
  refCode?: string
  /** اسمُ الموقع الذي أحاله، بلا مسار */
  referrerHost?: string
  /** أوّلُ صفحةٍ فتحها، بلا استعلام */
  landingPath?: string
  /** متى — ISO */
  at?: string
}

/** وسمٌ من الرابط: حروفٌ لاتينيّةٌ وأرقامٌ وشَرطات، وما سواه يُترك */
const TAG_RE = /^[a-z0-9._-]{1,60}$/i
const tag = (raw: unknown): string | undefined => {
  if (typeof raw !== 'string') return undefined
  const v = raw.trim().toLowerCase()
  return TAG_RE.test(v) ? v : undefined
}
/** ورمزُ رابط المدرّب بحروفه الكبيرة كما يُصدر (`WJ-…`) — فيُطابَق صفُّه */
const code = (raw: unknown): string | undefined => {
  if (typeof raw !== 'string') return undefined
  const v = raw.trim().toUpperCase()
  return TAG_RE.test(v) ? v : undefined
}
const HOST_RE = /^[a-z0-9.-]{1,120}$/i
const host = (raw: unknown): string | undefined => {
  if (typeof raw !== 'string') return undefined
  const v = raw.trim().toLowerCase().replace(/^www\./, '')
  return HOST_RE.test(v) ? v : undefined
}
const path = (raw: unknown): string | undefined => {
  if (typeof raw !== 'string') return undefined
  const v = raw.split(/[?#]/)[0].slice(0, 200)
  return v.startsWith('/') ? v : undefined
}
const iso = (raw: unknown): string | undefined => {
  if (typeof raw !== 'string') return undefined
  const t = Date.parse(raw)
  return Number.isFinite(t) ? new Date(t).toISOString() : undefined
}

/** يُبقي ما له قيمةٌ وحدَه */
function compact(t: FirstTouch): FirstTouch {
  return Object.fromEntries(Object.entries(t).filter(([, v]) => v !== undefined)) as FirstTouch
}

/** أفي الزيارة إشارةٌ إلى مصدرها؟ — وبلاها هي «مباشر» */
export function hasSignal(t: FirstTouch | null | undefined): boolean {
  return Boolean(t && (t.utmSource || t.utmCampaign || t.channel || t.refCode || t.referrerHost))
}

/** ما تقوله الزيارةُ عن مصدرها — يناديه المتصفّح عند فتح أيّ صفحة.
    والمُحيلُ من موقعنا نفسِه ليس مصدرا: هو تنقّلٌ داخله. */
export function touchFromLocation(search: string, referrer: string, ownHost: string, landingPath: string, now: Date): FirstTouch {
  const q = new URLSearchParams(search)
  let referrerHost: string | undefined
  try {
    const h = referrer ? host(new URL(referrer).hostname) : undefined
    const own = host(ownHost)
    referrerHost = h && own && (h === own || h.endsWith(`.${own}`) || own.endsWith(`.${h}`)) ? undefined : h
  } catch {
    referrerHost = undefined
  }
  return compact({
    utmSource: tag(q.get('utm_source')),
    utmMedium: tag(q.get('utm_medium')),
    utmCampaign: tag(q.get('utm_campaign')),
    utmContent: tag(q.get('utm_content')),
    utmTerm: tag(q.get('utm_term')),
    channel: tag(q.get('ch')),
    wave: tag(q.get('w')),
    refCode: code(q.get('ref')),
    referrerHost,
    landingPath: path(landingPath),
    at: now.toISOString(),
  })
}

/** أيُّ الزيارتين تبقى؟ — الأولى، إلّا مباشرةً تأتي بعدها زيارةٌ بإشارة */
export function keepTouch(stored: FirstTouch | null, fresh: FirstTouch): FirstTouch {
  if (!stored) return fresh
  if (!hasSignal(stored) && hasSignal(fresh)) return fresh
  return stored
}

/** ما وصل الخادمَ من المتصفّح — يُنظَّف حقلا حقلا، فلا يُكتب في القاعدة ما لم يُفحص */
export function cleanTouch(raw: unknown): FirstTouch | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const t = compact({
    utmSource: tag(r.utmSource),
    utmMedium: tag(r.utmMedium),
    utmCampaign: tag(r.utmCampaign),
    utmContent: tag(r.utmContent),
    utmTerm: tag(r.utmTerm),
    channel: tag(r.channel),
    wave: tag(r.wave),
    refCode: code(r.refCode),
    referrerHost: host(r.referrerHost),
    landingPath: path(r.landingPath),
    at: iso(r.at),
  })
  return Object.keys(t).length > 0 ? t : null
}

/* ─────────── الاسمُ الذي يُقرأ ─────────── */

/** المنصّاتُ بأسمائها — من وسم الحملة أو القناة */
const PLATFORM_AR: Record<string, string> = {
  facebook: 'فيسبوك', fb: 'فيسبوك', meta: 'فيسبوك',
  instagram: 'إنستغرام', ig: 'إنستغرام',
  whatsapp: 'واتساب', wa: 'واتساب',
  linkedin: 'لينكدإن', x: 'إكس', twitter: 'إكس',
  google: 'جوجل', youtube: 'يوتيوب', tiktok: 'تيك توك', snapchat: 'سناب شات',
  telegram: 'تيليجرام', email: 'البريد', newsletter: 'البريد',
}

/** والمواقعُ المُحيلة بأسمائها — والمجهولُ يُقال باسم موقعه */
const HOSTS_AR: readonly [RegExp, string][] = [
  [/(^|\.)google\./, 'بحث جوجل'],
  [/(^|\.)bing\.com$/, 'بحث بينغ'],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, 'فيسبوك'],
  [/(^|\.)instagram\.com$/, 'إنستغرام'],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, 'واتساب'],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, 'لينكدإن'],
  [/(^|\.)(x\.com|t\.co|twitter\.com)$/, 'إكس'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'يوتيوب'],
  [/(^|\.)tiktok\.com$/, 'تيك توك'],
  [/(^|\.)(chatgpt\.com|openai\.com|perplexity\.ai|claude\.ai|gemini\.google\.com)$/, 'مساعد ذكاء اصطناعي'],
]

/** ما حُفظ مع الحساب — `via` يقول كيف أُنشئ */
export interface StoredSource extends FirstTouch {
  via: string
}

/** صفُّ القاعدة (حقولُه الغائبةُ null) إلى ما يُسمّى — أو null لمن لا صفَّ له */
export function storedSource(row: {
  via: string; firstSeenAt: Date | null
  utmSource: string | null; utmMedium: string | null; utmCampaign: string | null; utmContent: string | null; utmTerm: string | null
  channel: string | null; wave: string | null; refCode: string | null; referrerHost: string | null; landingPath: string | null
} | null): StoredSource | null {
  if (!row) return null
  const u = (v: string | null) => v ?? undefined
  return {
    via: row.via,
    utmSource: u(row.utmSource), utmMedium: u(row.utmMedium), utmCampaign: u(row.utmCampaign),
    utmContent: u(row.utmContent), utmTerm: u(row.utmTerm),
    channel: u(row.channel), wave: u(row.wave), refCode: u(row.refCode),
    referrerHost: u(row.referrerHost), landingPath: u(row.landingPath),
    at: row.firstSeenAt?.toISOString(),
  }
}

/** اسمُ المصدر في سطرٍ قصير، وتفصيلُه إن وُجد — لبطاقة الحساب في قائمة المستخدمين.
    `refTrainerAr` اسمُ صاحب رابط المدرّب إن عُرف. */
export function sourceLabelAr(
  s: StoredSource | null,
  refTrainerAr?: string | null,
): { labelAr: string; detailAr: string | null } {
  if (!s) return { labelAr: 'غير معروف', detailAr: 'سجل قبل تتبع المصدر' }
  if (s.via === 'admin') return { labelAr: 'أضافه مدير', detailAr: null }

  const details: string[] = []
  if (s.utmCampaign) details.push(`حملة: ${s.utmCampaign}`)
  if (s.wave) details.push(`دفعة: ${s.wave}`)
  if (s.landingPath) details.push(`أول صفحة: ${s.landingPath}`)
  const detailAr = details.length > 0 ? details.join(' · ') : null

  if (s.refCode) return { labelAr: refTrainerAr ? `رابط المدرّب ${refTrainerAr}` : 'رابط مدرّب', detailAr }
  const tagged = s.utmSource ?? s.channel
  if (tagged) {
    const name = PLATFORM_AR[tagged] ?? tagged
    const medium = s.utmMedium === 'cpc' || s.utmMedium === 'paid' || s.utmMedium === 'ads' ? ' (إعلان)' : ''
    return { labelAr: `${name}${medium}`, detailAr }
  }
  if (s.referrerHost) {
    const known = HOSTS_AR.find(([re]) => re.test(s.referrerHost!))
    return { labelAr: known ? known[1] : `موقع ${s.referrerHost}`, detailAr }
  }
  return { labelAr: 'دخول مباشر', detailAr: detailAr ?? 'كتب العنوان، أو رابط بلا وسم' }
}
