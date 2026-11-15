/* «منحة مؤثرين وجيز» — ما تشترك فيه شاشاتُ المؤثّر والإدارة والخادم (٢٦ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: لكلّ مؤثّرٍ كودٌ يكتبه متابعُه في نموذج المنحة، وعمولتُه ١٥٪ **من سعر الدورات العامّ** —
   «A، لأنّه هو يعطي الخصمَ الأكبرَ منه». فدورةٌ بمئة دولار: يدفع المتابعُ ٥٥، وللمؤثّر ١٥، وللأكاديميّة ٤٠.
   والعلّةُ في `server/services/influencer.service.ts`، والحارس: `server/tests/commerce/influencer-grant.test.ts`. */

import { money } from './discount-policy'
import { BLACK_FRIDAY_GRANT_PATH, BLACK_FRIDAY_GRANT_SLUG, INFLUENCER_GRANT_SLUG, type GrantSlug } from './grant'

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
/** رابطُ المؤثّر في حملته — والحملةُ منحةُ المؤثّرين ما لم تُسمَّ */
export const influencerLink = (siteUrl: string, code: string, slug: GrantSlug = INFLUENCER_GRANT_SLUG): string =>
  `${siteUrl}${influencerGrantPath(slug)}/${encodeURIComponent(code)}`

/** ما يأخذه متابعُه: خصمُه هو إن كُتب له، وإلّا نسبةُ الحملة — قرارُ صاحب المنصّة (١٥ نوفمبر ٢٠٢٦): «قيمة الخصم للمؤثر
    كلا على حدا». ويُكتب في كوبون كلّ كودٍ يومَ يُعطى، فتغييرُه يقع على ما بعده كالعمولة (`grant.service.ts#issue`) */
export const influencerPercentOff = (campaignPercent: number, own: number | null | undefined): number => own ?? campaignPercent

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
/** تحت خانة تغيير الكود — الرابطُ القديمُ يبقى يعمل (`formerCodes`) */
export const INFLUENCER_CODE_KEEPS_AR = 'الرابط القديم يبقى يعمل ويوصل إلى الكود الجديد.'
