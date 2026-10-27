/* ═══ من أيّ منصّةٍ فُتح رابطُ المدرّب (٢٧ أكتوبر ٢٠٢٦) ═══

   اقترح Claude عدّادا لروابط المدرّب — «يرى كم فتح رابطَه وكم سجّل منه، وأيُّ منصّةٍ تجلب مسجّلين» — فقال صاحبُ
   المنصّة: «كلّهم». فالرابطُ في كلّ منشورٍ جاهزٍ يحمل منصّتَه حرفين: `‎/s/XXXXXX?p=wa`. وما نسخه المدرّبُ بيده بلا
   منصّةٍ يُعدّ «مباشر». والخادمُ لا يقبل إلّا هذه الحروف (`viaOf`)، فلا يُكتب في القاعدة ما يكتبه زائر.

   ويقرؤه الخادمُ (`server/services/link-opens.ts`) والشاشةُ (`ShareKit` و«شارك دوراتك») من هنا وحدَه. */

import type { SharePlatform } from '../trainer/share-kit'

export const VIA_OF: Record<SharePlatform, string> = {
  whatsapp: 'wa', linkedin: 'li', facebook: 'fb', x: 'x', instagram: 'ig', tiktok: 'tt', email: 'em',
}

export const VIA_AR: Record<string, string> = {
  wa: 'واتساب', li: 'لينكدإن', fb: 'فيسبوك', x: 'إكس', ig: 'إنستغرام', tt: 'تيك توك', em: 'البريد',
}

/** الرابطُ القصيرُ بمنصّته — وما ليس رابطا قصيرا يُترك كما هو: الطويلُ له رمزُ إحالته ولا يمرّ بالعدّاد */
export function withVia(url: string, platform: SharePlatform): string {
  if (!/\/s\/[A-Za-z0-9]+$/.test(url)) return url
  return `${url}?p=${VIA_OF[platform]}`
}

/** حرفا المنصّة كما وصلا — وما سواهما `null` */
export function viaOf(raw: unknown): string | null {
  return typeof raw === 'string' && raw in VIA_AR ? raw : null
}

/* ═══ ومن لا يُعدّ ═══
   زاحفُ المعاينة يفتح الرابطَ حين يُلصق قبل أن يضغطه أحد — فلو عُدّ لقيل للمدرّب «فُتح» ولم يفتحه إنسان.
   وأسماؤها في متصفّحها: `facebookexternalhit` و`WhatsApp/2…` و`LinkedInBot` و`Twitterbot` وأمثالُها.
   ومتصفّحاتُ التطبيقات (FBAN في فيسبوك، وLinkedInApp) ناسٌ لا زواحف — فلا يُطابَق «linkedin» وحدَه. */
const CRAWLER = /bot|crawler|spider|facebookexternalhit|facebookcatalog|^whatsapp\/|embedly|headless|curl\/|wget\/|python-|okhttp|go-http/i

export function isCrawler(userAgent: string | null | undefined): boolean {
  return !userAgent || CRAWLER.test(userAgent)
}
