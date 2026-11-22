/* «منحة مؤثرين وجيز» — ما تشترك فيه شاشاتُ المؤثّر والإدارة والخادم (٢٦ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: لكلّ مؤثّرٍ كودٌ يكتبه متابعُه في نموذج المنحة، وعمولتُه ١٥٪ **من سعر الدورات العامّ** —
   «A، لأنّه هو يعطي الخصمَ الأكبرَ منه». فدورةٌ بمئة دولار: يدفع المتابعُ ٥٥، وللمؤثّر ١٥، وللأكاديميّة ٤٠.
   والعلّةُ في `server/services/influencer.service.ts`، والحارس: `server/tests/commerce/influencer-grant.test.ts`. */

import { money } from './discount-policy'
import { BLACK_FRIDAY_GRANT_PATH, BLACK_FRIDAY_GRANT_SLUG, INFLUENCER_GRANT_SLUG, isInfluencerGrant, type GrantSlug } from './grant'

/** عمولةُ المؤثّر حين يُضاف — ويغيّرها صاحبُ المنصّة لكلّ مؤثّرٍ على ما يُعطى بعدها */
export const INFLUENCER_COMMISSION_DEFAULT = 15

/** كودُ المؤثّر: حروفٌ لاتينيّةٌ وأرقام، من ثلاثةٍ إلى عشرين — يُملى ويُكتب في رابطه */
export const INFLUENCER_CODE_RE = /^[A-Z0-9]{3,20}$/

/** ما كتبه المتابعُ أو المدير → صيغةُ الكود: بلا فراغٍ وبحروفٍ كبيرة. وما لا يشبهه يصير فارغا */
export function normalizeInfluencerCode(raw: string | null | undefined): string | null {
  const v = (raw ?? '').replace(/\s+/g, '').toUpperCase()
  return INFLUENCER_CODE_RE.test(v) ? v : null
}

/** صفحةُ منحة المؤثّرين — وبكوده رابطُه الذي ينشره */
export const INFLUENCER_GRANT_PATH = '/grant/i'
/** صفحةُ حملة المؤثّرين بلا كود — `/grant/i` لمنحة المؤثّرين و`/grant/bf` لـ«بلاك فرايدي وجيز» (١٥ نوفمبر ٢٠٢٦) */
export const influencerGrantPath = (slug: GrantSlug = INFLUENCER_GRANT_SLUG): string =>
  slug === BLACK_FRIDAY_GRANT_SLUG ? BLACK_FRIDAY_GRANT_PATH : INFLUENCER_GRANT_PATH
/* ═══ ورابطُه في «بلاك فرايدي وجيز» بقناته `?ch=` لا بمسارٍ (قرارُ صاحب المنصّة (١٧ نوفمبر ٢٠٢٦): Fix all 6) ═══
   كان رابطُه فيها `/grant/bf/<كوده>`، والموقعُ يحوّل هذا المسارَ إلى `/grant/bf` بما بعد «؟» وحدَه — فيسقط الكودُ ولا يُنسب
   إلى المؤثّر من جاء برابطه الذي نسخه من حسابه. والنسبةُ فيها بالقناة وحدَها (`grant-landing.service.ts#apply` و`channelView`)،
   والقناةُ تُقرأ بلا فرقٍ بين كبير الحروف وصغيرها (`normalizeInfluencerCode`) وتُحفظ صغيرة (`campaignTag`) — فتُكتب صغيرةً كما
   أُرسل لكاسيت: `?ch=kaseet`. */
export const influencerChannel = (code: string): string => code.toLowerCase()

/** ورابطٌ قديمٌ `/grant/bf/<كوده>` نُشر قبلُ يُحوَّل بكوده قناةً — ما بعد «؟» كما هو، وقناةٌ فيه تبقى ولا تُبدَّل.
    وما لا يشبه كودا (`normalizeInfluencerCode`) لا يُكتب قناةً */
export function channelSearch(search: string, code: string | null | undefined): string {
  const q = new URLSearchParams(search)
  const c = normalizeInfluencerCode(code)
  if (c && !q.get('ch')) q.set('ch', influencerChannel(c))
  const out = q.toString()
  return out ? `?${out}` : ''
}

/** رابطُ المؤثّر في حملته — والحملةُ منحةُ المؤثّرين ما لم تُسمَّ. وفي بلاك فرايدي بقناته (`influencerChannel`) */
export const influencerLink = (siteUrl: string, code: string, slug: GrantSlug = INFLUENCER_GRANT_SLUG): string =>
  slug === BLACK_FRIDAY_GRANT_SLUG
    ? `${siteUrl}${BLACK_FRIDAY_GRANT_PATH}?ch=${encodeURIComponent(influencerChannel(code))}`
    : `${siteUrl}${influencerGrantPath(slug)}/${encodeURIComponent(code)}`

/** ما يأخذه متابعُه: خصمُه هو إن كُتب له، وإلّا نسبةُ الحملة — قرارُ صاحب المنصّة (١٥ نوفمبر ٢٠٢٦): «قيمة الخصم للمؤثر
    كلا على حدا». ويُكتب في كوبون كلّ كودٍ يومَ يُعطى، فخفضُه يقع على ما بعده كالعمولة (`grant.service.ts#issue`) — ورفعُه
    يرفع أكوادَ متابعيه القائمة معه (٢٢ نوفمبر ٢٠٢٦: «Raise to 65%»، `influencer.service.ts#raiseInfluencerCodes`) */
export const influencerPercentOff = (campaignPercent: number, own: number | null | undefined): number => own ?? campaignPercent

/* ═══ وآخرُ يومٍ لمنحة متابعيه — كلٌّ على حدة (١٧ نوفمبر ٢٠٢٦) ═══
   قال صاحبُ المنصّة: «الإعدادات للكلّ.. أريد فقط لشات تري». فآخرُ يومِ المؤثّر — إن كُتب — يغلب نهايةَ الحملة لمتابعيه: به
   تُفتح صفحتُه، وتُعطى أكوادُه، وتُستعمل عند الدفع، ولو انتهت الحملة أو امتدّت بعده. وفارغُه بنهاية الحملة كما كان.
   وتشغيلُ الحملة نفسِها (`active`) يبقى شرطا: موقوفةٌ لا يفتحها يومُ أحد. */
export const influencerClosesAt = (campaignClosesAt: Date | null, own: Date | null | undefined): Date | null =>
  own ?? campaignClosesAt

/* ═══ وفي منحة المؤثّرين وحدَها (قرارُ صاحب المنصّة (١٧ نوفمبر ٢٠٢٦): Fix all 6) ═══
   كودُ بلاك فرايدي جاء برابط مؤثّرٍ يحمل مؤثّرَه (`?ch=`)، فكان الدفعُ يقرأ آخرَ يومِ المؤثّر عليه — وإعطاؤه وصفحتُه لا يقرآنه
   (`isInfluencerGrant` في `grant.service.ts#issue` و`grant-landing.service.ts#view`). فمن أخذ كودَ بلاك فرايدي وهي مفتوحةٌ رُدّ
   عند الدفع «انتهت المنحة» لأنّ يومَ مؤثّره في منحةٍ أخرى مضى. فالقاعدةُ واحدةٌ هنا: يومُه يغلب في حملته هو وحدَها. */
/** الحملةُ كما يراها متابعُ هذا المؤثّر — بآخر يومه إن كان له، في منحة المؤثّرين وحدَها */
export function withInfluencerEnd<C extends { slug: string; closesAt: Date | null }>(campaign: C, influencer: { closesAt?: Date | null } | null | undefined): C {
  return influencer?.closesAt && isInfluencerGrant(campaign.slug) ? { ...campaign, closesAt: influencer.closesAt } : campaign
}

/** عمولتُه على طلب: نسبتُه من سعر الدورات قبل المنحة، ناقصا ما رُدّ من الثمن بنسبته */
export function influencerCommission(listTotal: number, percent: number, refundedShare = 0): number {
  const kept = 1 - Math.min(1, Math.max(0, refundedShare))
  return money(((listTotal * percent) / 100) * kept)
}

/** المشتري كما يراه المؤثّر: اسمُه الأوّلُ وأوّلُ حرفٍ ممّا بعده — يعرف أنّه من متابعيه ولا يُكشف له أكثر */
export function buyerNameAr(displayName: string | null | undefined): string {
  const parts = (displayName ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'متعلم'
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1].slice(0, 1)}.`
}

/** حالُ عمولة الطلب كما تُقال — من حال الطلب نفسه */
/** طلبُ المؤثّر نفسِه بكوده — منحتُه له وعمولتُه صفر: قرارُ صاحب المنصّة (٢٧ أكتوبر ٢٠٢٦) «b» */
export const OWN_PURCHASE_AR = 'شراء صاحب الكود — بلا عمولة'

export function commissionStateAr(orderStatus: string): string {
  if (orderStatus === 'refunded') return 'رد المبلغ'
  if (orderStatus === 'partially_refunded') return 'رد جزء منه'
  return 'مستحقة'
}

/** اسمُ خانة الكود في نموذج المنحة — باسم المؤثّر إن جاء برابطه: قرارُ صاحب المنصّة (٢٦ أكتوبر ٢٠٢٦): «كود المؤثّر
    استبدلها بـ"الكود الخاصّ بـ" ضع اسم المؤثّر». ومن جاء بلا رابطٍ لا يُعرف مؤثّرُه بعد، فيُقال «بالمؤثّر» */
export function influencerCodeLabelAr(nameAr: string | null | undefined): string {
  const name = nameAr?.trim()
  return name ? `الكود الخاص بـ${name}` : 'الكود الخاص بالمؤثر'
}

export const INFLUENCER_CODE_BAD_AR = 'كود المؤثر غير صحيح. اكتبه كما وصلك'
export const INFLUENCER_CODE_TAKEN_AR = 'هذا الكود لمؤثر آخر. اختر كودا غيره'
export const INFLUENCER_CODE_FORMAT_AR = 'الكود حروف إنجليزية وأرقام فقط، من 3 إلى 20'
export const INFLUENCER_DISCOUNT_BAD_AR = 'الخصم عدد صحيح من 0 إلى 100، أو اتركه فارغا'

/* ═══ رقمُ المؤثّر (١٥ نوفمبر ٢٠٢٦) ═══
   قرارُ صاحب المنصّة: «تغيير كل التفاصيل، إيميله، رقمه وإلى آخره». فالرقمُ حرٌّ بشكله — مفتاحُ الدولة ومسافاتٌ وشرطات —
   يُقرأ ويُتّصل به، لا يُطبَّع: أرقامٌ و+ ومسافاتٌ و- فقط، ومن ٦ أرقامٍ إلى ٢٠. */
export const INFLUENCER_PHONE_BAD_AR = 'الرقم أرقام فقط، ويمكن أن يبدأ بـ+ وفيه مسافات، من 6 إلى 20 رقما'
const PHONE_CHARS_RE = /^\+?[\d\s-]+$/

/** رقمُه بعد التنظيف: الفارغُ `null` (بلا رقم)، وما لا يشبه رقما `undefined` */
export function cleanInfluencerPhone(raw: string | null | undefined): string | null | undefined {
  const v = (raw ?? '').replace(/\s+/g, ' ').trim()
  if (v === '') return null
  const digits = v.replace(/\D/g, '').length
  return PHONE_CHARS_RE.test(v) && digits >= 6 && digits <= 20 ? v : undefined
}
/** تحت خانة تغيير الكود — الرابطُ القديمُ يبقى يعمل (`formerCodes`) */
export const INFLUENCER_CODE_KEEPS_AR = 'الرابط القديم يبقى يعمل ويوصل إلى الكود الجديد.'

/* ═══ كاسيت — مؤثّرٌ بصفحته وشعاره (١٧ نوفمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «Influencer page + logo». كاسيت كودُ مؤثّرٍ لا صفحةُ شريك (قرارُه ١٦ نوفمبر)، بعمولة ٥٪ لا ١٥٪،
   وتُنشأ في الإنتاج مرّةً بلا نقرةٍ في الإدارة (`applyInfluencerLaunch` في `server/services/influencer.service.ts`).
   وكودُها **KASEET** كما أُرسل لها: «wajeezacademy.com/grant/bf?ch=kaseet — أو راسل الأكاديمية بالكود KASEET». و`KASSET`
   كودٌ سابقٌ لها (`formerCodes`) فيوصل `/grant/i/KASSET` إليها أيضا. */
export const KASEET_INFLUENCER = {
  nameAr: 'كاسيت',
  nameEn: 'Kaseet',
  code: 'KASEET',
  formerCodes: ['KASSET'],
  commissionPercent: 5,
  phone: '+962781010288',
  email: 'jameelzatara@kaseet.com',
} as const

/* ═══ صهيب — مؤثّرٌ بكود SUHAIB وعمولة ٥٪ (١٨ نوفمبر ٢٠٢٦) ═══
   قرارُ صاحب المنصّة: «ضع فيه كود suhaib كانفلونسر بالنظام وفعّل حسابه suhaiblafi2@gmail.com رقم 0797708080 والنسبة ٥٪».
   فيُنشأ أو يُشغَّل مرّةً بلا نقرةٍ في الإدارة (`applySuhaibLaunch`)، ويأخذ ٥٪ على بلاك فرايدي برابطه `?ch=SUHAIB` كما تأخذ كاسيت. */
export const SUHAIB_INFLUENCER = {
  nameAr: 'صهيب لافي',
  code: 'SUHAIB',
  commissionPercent: 5,
  phone: '+962797708080',
  email: 'suhaiblafi2@gmail.com',
} as const

/* ═══ ومن يأخذ عمولتَه على بلاك فرايدي برابطه (١٧ نوفمبر ٢٠٢٦، قرارُ صاحب المنصّة «Yes, 5% on Black Friday») ═══
   بلاك فرايدي بلا عمولة (#951/#953). وسأل صاحبُ المنصّة عن كاسيت ومن جاء برابطها `?ch=kaseet`: «Yes, 5% on Black Friday».
   فمن ذُكر هنا يأخذ عمولتَه هو (`commissionPercent` في ملفّه) على كود بلاك فرايدي الذي جاء برابطه، ومن لم يُذكر يُنسب
   إليه بلا عمولةٍ كما كان. وفحصُ الهامش يعدّها لهم (`grant-margins.service.ts`). */
export const BLACK_FRIDAY_PAID_INFLUENCERS: readonly string[] = ['KASEET', 'SUHAIB']

/* ═══ والمؤثّرُ يُعرف بكوده اليومَ أو بكودٍ كان له (قرارُ صاحب المنصّة (١٧ نوفمبر ٢٠٢٦): Fix all 6) ═══
   كانت القائمتان (`BLACK_FRIDAY_PAID_INFLUENCERS` و`BUILT_IN_INFLUENCER_LOGOS`) تُطابَقان بكوده الحاليّ وحدَه، فإن غيّر المديرُ
   كودَ كاسيت سقطت عمولتُها ٥٪ على بلاك فرايدي ورأسُ صفحتها بلا أثرٍ يقول. والكودُ القديمُ لا يضيع: ينتقل إلى `formerCodes`
   (`influencer.service.ts`)، ولا يأخذه مؤثّرٌ غيرُه أبدا (`assertCodeFree`). فالمطابقةُ بأكواده كلِّها — ما كان منها وما هو —
   بلا عمودٍ جديدٍ ولا منعٍ لتغيير الكود. ومن مُرّر كودُه نصّا وحدَه يُطابَق به كما كان. */
export type InfluencerCodes = string | { code: string; formerCodes?: readonly string[] | null }
const codesOf = (i: InfluencerCodes): readonly string[] => (typeof i === 'string' ? [i] : [i.code, ...(i.formerCodes ?? [])])

/** عمولةُ كود بلاك فرايدي لمؤثّرٍ جاء الزائرُ برابطه — نسبتُه إن كان في القائمة بأحد أكواده، وإلّا صفر */
export const blackFridayCommission = (influencer: InfluencerCodes, commissionPercent: number): number =>
  codesOf(influencer).some((c) => BLACK_FRIDAY_PAID_INFLUENCERS.includes(c)) ? commissionPercent : 0

/* ═══ شعاراتُ المؤثّرين مع الموقع — كشعارات الشركاء (`BUILT_IN_PARTNER_LOGOS`) ═══

   لا رفعَ لشعار المؤثّر في الإدارة، فما أرسله صاحبُ المنصّة يُشحن مع الموقع في `public/influencers` بكود المؤثّر.
   ومن ذُكر هنا له رأسُ صفحةٍ مشترك «<اسمه> × أكاديمية وجيز» وزرُّ واتساب برسالته — في صفحته `/grant/i/<كوده>` وفي بلاك فرايدي
   برابطه `?ch=<كوده>`. وقيمتُه `null` حتى يصل ملفُّه، فيظهر اسمُه مكانَ الشعار. ومن لم يُذكر بقيت صفحتُه كما هي.
   وإضافةُ الشعار: الملفُّ في `public/influencers/` وقيمتُه هنا مسارُه (`'/influencers/kaseet.png'`).
   ووصل شعارُ كاسيت (٢٢ نوفمبر ٢٠٢٦، «وهذا اللوقو الخاص بالمؤثر ضعه»): شريطُ كاسيت واسمُها، بخلفيّةٍ شفّافة. */
export const BUILT_IN_INFLUENCER_LOGOS: Readonly<Record<string, string | null>> = {
  KASEET: '/influencers/kaseet.png',
}
/** رأسُ صفحة المؤثّر المشتركُ بشعاره (أو `null` فاسمُه) — أو `null` لمن لا رأسَ له. ويُعرف بأحد أكواده (`InfluencerCodes`) */
export function influencerBrand(influencer: InfluencerCodes): { logoUrl: string | null } | null {
  const key = codesOf(influencer).find((c) => Object.prototype.hasOwnProperty.call(BUILT_IN_INFLUENCER_LOGOS, c))
  return key === undefined ? null : { logoUrl: BUILT_IN_INFLUENCER_LOGOS[key] ?? null }
}

/* ═══ رسالةُ واتساب من صفحة المؤثّر (١٧ نوفمبر ٢٠٢٦) ═══
   قرارُ صاحب المنصّة: طلبُ عميلٍ عمليّ، واسمُ المؤثّر في آخرها وحدَه فنعرف من أين جاء — لا كودَ ولا «جئت من طرف». */
export const influencerWhatsAppTextAr = (nameAr: string): string =>
  `مرحبا، أحتاج مساعدتكم في اختيار الدورات المناسبة لي - ${nameAr}`
