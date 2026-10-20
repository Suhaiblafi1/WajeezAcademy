/* «منحة أعضاء وجيز» — ما تشترك فيه الشاشةُ والخادم (٢٠ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: خصمٌ بالنسبة لأعضاء وجيز، محدودُ العدد، يُنقل لغيره، و«يحقّ لي تغيير
   الـ٦٠٪ كما أشاء» — وهو بدلُ خصم الباقة لا فوقه («A»). والعلّةُ في `server/services/grant.service.ts`،
   والحسابُ في `cart-pricing.ts`. وهنا النصوصُ والسعرُ بعد المنحة، فلا تقول شاشةٌ رقما يخالف الفاتورة. */

import { money } from './discount-policy'

/** الحملةُ الوحيدةُ اليوم — وبها يُقرأ صفُّها، ويُنشأ أوّلَ مرّة بإعداداتٍ افتراضيّة */
export const MEMBER_GRANT_SLUG = 'wajeez-members'
export const MEMBER_GRANT_NAME_AR = 'منحة أعضاء وجيز'

/** ما تبدأ به الحملةُ قبل أن يغيّره صاحبُ المنصّة — وتبدأ موقوفة حتّى يشغّلها */
export const GRANT_DEFAULTS = { percentOff: 60, maxCodes: 1000 } as const

/** بادئةُ الكود — تميّزه عن رمز الدعوة (WJ) وكود المدرّب (WD) */
export const GRANT_CODE_PREFIX = 'WG-'

/** ما يدفعه صاحبُ المنحة من سعر القائمة — التقريبُ نفسُه الذي تُصدَر به الفاتورة */
export const grantPrice = (listPrice: number, percentOff: number): number =>
  money(listPrice - money((listPrice * percentOff) / 100))

export const GRANT_CLOSED_AR = 'المنحة مغلقة الآن'
export const GRANT_SOLD_OUT_AR = 'انتهت المنح المتاحة'
export const GRANT_USED_AR = 'استعمل هذا الكود من قبل. كل كود منحة يستعمل مرة واحدة.'
export const GRANT_ONCE_AR = 'استعملت منحة من قبل. المنحة مرة واحدة لكل متعلم.'
export const GRANT_PENDING_AR = 'لك طلب لم يكتمل دفعه بهذا الكود. أكمله من «الفواتير».'
export const GRANT_NOT_BETTER_AR = 'سعر الباقة في سلتك أقل من سعر المنحة، فلا تحتاج الكود. احتفظ به أو أعطه لغيرك.'
export const GRANT_CHECKOUT_ONLY_AR = 'كود المنحة يستعمل عند الشراء المباشر فقط، لا في موافقة الطلبات'

/** أسبابُ ردّ كود المنحة — يُقال سببُها تحت خانة الكود ويُسعَّر الطلبُ بلا كود (`BuyPanel`) */
export const GRANT_ERROR_CODES = ['grant_closed', 'grant_used', 'grant_once', 'grant_pending', 'grant_not_better'] as const

/** «آخر يوم» من خانة تاريخ → أوّلُ اليوم الذي بعده بتوقيت الجهاز، فيبقى الكودُ صالحا يومَه كلَّه */
export function grantClosesAt(lastDay: string): string {
  const d = new Date(`${lastDay}T00:00:00`)
  d.setDate(d.getDate() + 1)
  return d.toISOString()
}

/** آخرُ يومٍ للمنحة — النهايةُ تُحفظ أوّلَ اليوم الذي بعده، فيُقال اليومُ الذي قبلها بصيغة الخانة */
export function grantLastDay(closesAt: string | Date): string {
  const d = new Date(new Date(closesAt).getTime() - 1)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
