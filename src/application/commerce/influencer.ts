/* «منحة مؤثرين وجيز» — ما تشترك فيه شاشاتُ المؤثّر والإدارة والخادم (٢٦ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: لكلّ مؤثّرٍ كودٌ يكتبه متابعُه في نموذج المنحة، وعمولتُه ١٥٪ **من سعر الدورات العامّ** —
   «A، لأنّه هو يعطي الخصمَ الأكبرَ منه». فدورةٌ بمئة دولار: يدفع المتابعُ ٥٥، وللمؤثّر ١٥، وللأكاديميّة ٤٠.
   والعلّةُ في `server/services/influencer.service.ts`، والحارس: `server/tests/commerce/influencer-grant.test.ts`. */

import { money } from './discount-policy'

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
export const influencerLink = (siteUrl: string, code: string): string => `${siteUrl}${INFLUENCER_GRANT_PATH}/${encodeURIComponent(code)}`

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
export function commissionStateAr(orderStatus: string): string {
  if (orderStatus === 'refunded') return 'رد المبلغ'
  if (orderStatus === 'partially_refunded') return 'رد جزء منه'
  return 'مستحقة'
}

export const INFLUENCER_CODE_BAD_AR = 'كود المؤثر غير صحيح. اكتبه كما وصلك'
export const INFLUENCER_CODE_TAKEN_AR = 'هذا الكود لمؤثر آخر. اختر كودا غيره'
export const INFLUENCER_CODE_FORMAT_AR = 'الكود حروف إنجليزية وأرقام فقط، من 3 إلى 20'
