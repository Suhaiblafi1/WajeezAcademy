/* ═══ من أين جاء الزائر — ليُعرف أيُّ منشورٍ يبيع (٢٠ نوفمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة (اقتراحُ «٥»): يُحفظ مع كلّ حجزٍ مصدرُه ويُعرض في `/private` وملفّ Excel.

   والمصدرُ بالترتيب:
   ١) ما كتبه هو في الرابط: `?src=instagram` (الأقصر)، أو `utm_source` و`utm_medium` و`utm_campaign`.
      فرابطٌ في قصّة إنستغرام `…/ai-jobs?src=ig&utm_campaign=bf1` يُقرأ «Instagram · bf1».
   ٢) وإلّا فالموقعُ الذي أحاله (`document.referrer`) باسمٍ يُعرف: `l.instagram.com` ← «Instagram».
   ٣) وإلّا فلا شيء — «مباشر» في اللوحة. ومتصفّحُ واتساب وإنستغرام داخلَ التطبيق كثيرا ما لا يقول من أين، فالأصدقُ
      أن يحمل كلُّ رابطٍ يُنشر `?src=`.

   ويُحفظ آخرُ مصدرٍ غيرِ مباشرٍ على الجهاز: من جاء من إنستغرام ثمّ عاد غدا من مفضّلته يُنسب إلى إنستغرام. */

import { safeGet, safeSet } from '../../services/safe-storage'

const KEY = 'aij_source'

/** أسماءٌ مختصرةٌ تُكتب في الرابط — وما سواها يُكتب كما هو */
const NAMES: Record<string, string> = {
  ig: 'Instagram', insta: 'Instagram', instagram: 'Instagram',
  fb: 'Facebook', facebook: 'Facebook',
  li: 'LinkedIn', linkedin: 'LinkedIn',
  wa: 'WhatsApp', whatsapp: 'WhatsApp',
  x: 'X', twitter: 'X',
  tt: 'TikTok', tiktok: 'TikTok',
  yt: 'YouTube', youtube: 'YouTube',
  tg: 'Telegram', telegram: 'Telegram',
  sc: 'Snapchat', snapchat: 'Snapchat',
  google: 'Google', email: 'Email', mail: 'Email',
}

/** مواقعُ الإحالة المعروفة — بنطاقها لا بجزءٍ من اسمها */
const HOSTS: ReadonlyArray<[RegExp, string]> = [
  [/(^|\.)instagram\.com$/, 'Instagram'],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/, 'Facebook'],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, 'LinkedIn'],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, 'X'],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, 'WhatsApp'],
  [/(^|\.)tiktok\.com$/, 'TikTok'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube'],
  [/(^|\.)(t\.me|telegram\.org)$/, 'Telegram'],
  [/(^|\.)snapchat\.com$/, 'Snapchat'],
  [/(^|\.)google\.[a-z.]+$/, 'Google'],
  [/(^|\.)bing\.com$/, 'Bing'],
]

const clip = (v: string) => v.trim().replace(/\s+/g, ' ').slice(0, 40)

/** المصدرُ من الرابط والإحالة — أو `null` لدخولٍ مباشرٍ أو من الموقع نفسِه */
export function readSource(search: string, referrer: string, ownHost: string): string | null {
  const q = new URLSearchParams(search)
  const raw = q.get('src') || q.get('utm_source') || q.get('ref')
  if (raw && clip(raw)) {
    const name = NAMES[clip(raw).toLowerCase()] ?? clip(raw)
    const rest = [q.get('utm_medium'), q.get('utm_campaign')].filter((v): v is string => Boolean(v && clip(v))).map(clip)
    return [name, ...rest].join(' · ')
  }
  if (referrer) {
    let host = ''
    try { host = new URL(referrer).hostname.toLowerCase() } catch { /* إحالةٌ لا تُقرأ — كأنّها لم تكن */ }
    if (host && host !== ownHost.toLowerCase()) {
      for (const [re, name] of HOSTS) if (re.test(host)) return name
      return host.replace(/^www\./, '')
    }
  }
  /* و`fbclid` بلا إحالة: رابطٌ من فيسبوك أو إنستغرام فُتح داخل تطبيقهما */
  if (q.get('fbclid')) return 'Facebook/Instagram'
  return null
}

/** يُنادى عند فتح الصفحة — يحفظ المصدرَ إن كان، ولا يمحو مصدرا سابقا بدخولٍ مباشر */
export function rememberSource(search: string, referrer: string, ownHost: string): void {
  const s = readSource(search, referrer, ownHost)
  if (s) safeSet(KEY, s)
}

/** ما يُرسل مع الحجز */
export function storedSource(): string | null {
  return safeGet(KEY)
}
