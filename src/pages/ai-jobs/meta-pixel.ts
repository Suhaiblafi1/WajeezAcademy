/* ═══ بكسل Meta لصفحة الدورة الخاصّة — `/ai-jobs` ورابطُ الدفع وحدَهما (٢١ نوفمبر ٢٠٢٦) ═══

   طلبُ صاحب المنصّة: شيفرةُ بكسل Meta (المعرّف أدناه) «على الأقلّ في /ai-jobs». فيُحمَّل هنا من الصفحتين لا من
   `index.html`: الدورةُ دورتُه وإعلاناتُها إعلاناتُه، وصفحاتُ الأكاديميّة الأخرى لا تُرسل زوّارَها إلى حسابه
   (قرارُ «المساحة الخاصّة منفصلة» في `CLAUDE.md`).

   ═══ وصفحةُ الإعلان العامّة `/go/BF80` (٢٤ نوفمبر ٢٠٢٦) ═══
   قرارُ صاحب المنصّة بين ثلاثة: **البكسلُ نفسُه في BF80 وحدَها** («Same pixel, BF80 only») — نسخا لـ«صفحاتُ الأكاديميّة الأخرى
   لا تُرسل» فيها وحدَها. وما بعدها من صفحات الأكاديميّة لا يُرسل: الموقعُ صفحةٌ واحدة، والبكسلُ يتبع تبدّلَ العنوان ويلتقط
   الأزرارَ وحدَه — فيُحمَّل هناك `quiet`: بلا تتبّعٍ آليّ، ولا يُرسل إلّا ما نرسله صراحة.

   والأحداثُ ما يبني عليه الإعلانُ جمهورَه ويقيس نتيجتَه:
   · `PageView` عند فتح الصفحة.
   · `Lead` حين يُحجز المقعد — وهو الحدثُ الذي يُحسَّن عليه الإعلان.
   · `InitiateCheckout` حين يفتح صفحةَ الدفع بالبطاقة، و`AddPaymentInfo` حين يرفع الإيصال.
   · `Contact` حين يضغط واتساب.

   والسياسةُ في `deploy/Caddyfile` تسمح لـ`connect.facebook.net` (السكربت) و`www.facebook.com` (الإرسال) — وبدونهما
   يُردّ البكسلُ صامتا. ويحرسهما `src/tests/private-course/ai-jobs-page.test.ts`. */

export { META_PIXEL_ID } from '@/application/private-course/ai-jobs'
import { META_PIXEL_ID } from '@/application/private-course/ai-jobs'

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void
  queue: unknown[][]
  push: Fbq
  loaded: boolean
  disablePushState?: boolean
  version: string
}

declare global {
  interface Window {
    fbq?: Fbq
    _fbq?: Fbq
  }
}

let initialised = false

/** يحمّل البكسلَ مرّةً واحدةً في عمر الصفحة — الشيفرةُ الرسميّةُ نفسُها، مكتوبةً بلا تقليص */
export function loadMetaPixel(opts: { quiet?: boolean } = {}): void {
  if (typeof window === 'undefined') return
  if (!window.fbq) {
    const n = function (...args: unknown[]) {
      if (n.callMethod) n.callMethod(...args)
      else n.queue.push(args)
    } as Fbq
    n.queue = []
    n.push = n
    n.loaded = true
    n.version = '2.0'
    window.fbq = n
    if (!window._fbq) window._fbq = n
    const script = document.createElement('script')
    script.async = true
    script.src = 'https://connect.facebook.net/en_US/fbevents.js'
    document.head.appendChild(script)
  }
  if (opts.quiet) window.fbq.disablePushState = true
  if (!initialised) {
    if (opts.quiet) window.fbq('set', 'autoConfig', false, META_PIXEL_ID)
    window.fbq('init', META_PIXEL_ID)
    initialised = true
  }
}

export type PixelEvent = 'PageView' | 'Lead' | 'InitiateCheckout' | 'AddPaymentInfo' | 'Contact'

/** حدثٌ إلى البكسل — ولا يكسر شيئا إن لم يُحمَّل (مانعُ إعلانات، أو شبكةٌ تحجبه) */
export function trackPixel(event: PixelEvent, params?: Record<string, unknown>): void {
  try {
    if (typeof window === 'undefined' || !window.fbq) return
    if (params) window.fbq('track', event, params)
    else window.fbq('track', event)
  } catch {
    /* البكسلُ قياسٌ لا شرط — لا يمنع حجزا ولا دفعا */
  }
}

/** كعكتا البكسل — تُرسلان مع التسجيل ليُطابَق الشراءُ بزائر الإعلان حين يتأكّد (`meta-capi.ts`، ٢١ نوفمبر ٢٠٢٦).
    و`_fbc` إن لم يكتبها البكسلُ بعدُ تُبنى من `fbclid` في الرابط كما يبنيها هو */
export function metaCookies(): { fbp?: string; fbc?: string } {
  try {
    const jar = Object.fromEntries(document.cookie.split(';').map((c) => {
      const i = c.indexOf('=')
      return [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1).trim())]
    }))
    const fbclid = new URLSearchParams(window.location.search).get('fbclid')
    const fbc = jar._fbc || (fbclid ? `fb.1.${Date.now()}.${fbclid}` : undefined)
    return { ...(jar._fbp ? { fbp: jar._fbp } : {}), ...(fbc ? { fbc } : {}) }
  } catch {
    return {}
  }
}
