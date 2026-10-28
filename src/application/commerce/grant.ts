/* «منحة وجيز» و«منحة مؤثرين وجيز» — ما تشترك فيه الشاشةُ والخادم (٢٠ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: خصمٌ بالنسبة لأعضاء وجيز، محدودُ العدد، يُنقل لغيره، و«يحقّ لي تغيير
   الـ٦٠٪ كما أشاء» — وهو بدلُ خصم الباقة لا فوقه («A»). والعلّةُ في `server/services/grant.service.ts`،
   والحسابُ في `cart-pricing.ts`. وهنا النصوصُ والسعرُ بعد المنحة، فلا تقول شاشةٌ رقما يخالف الفاتورة. */

import { money } from './discount-policy'
import { ACADEMY_ZONE, zonedDay, zonedInstant } from '../trainer/cohort-period'

/** الحملةُ الأولى — وبها يُقرأ صفُّها، ويُنشأ أوّلَ مرّة بإعداداتٍ افتراضيّة. واسمُها «منحة وجيز» بقرار صاحب
    المنصّة (٢٦ أكتوبر ٢٠٢٦)، وكان «منحة أعضاء وجيز» — والمعرّفُ باقٍ: به حُفظ كلُّ من عبّأ نموذجها */
export const MEMBER_GRANT_SLUG = 'wajeez-members'
export const MEMBER_GRANT_NAME_AR = 'منحة وجيز'

/** ما تبدأ به الحملةُ قبل أن يغيّره صاحبُ المنصّة — وتبدأ موقوفة حتّى يشغّلها */
export const GRANT_DEFAULTS = { percentOff: 60, maxCodes: 1000, maxCourses: 4 } as const

/* ═══ والثانية: «منحة مؤثرين وجيز» (٢٦ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: منحةٌ بخصمٍ أقلّ ينشرها المؤثّرون، ولكلّ مؤثّرٍ كودٌ يكتبه متابعُه في نموذجها، وعمولتُه من سعر
   الدورات العامّ. وصفحتُها غيرُ صفحة الأولى («A»): رابطُ المؤثّر يفتحها بنسبتها وكودُه مكتوب، و`/grant` تبقى للأولى.
   والعلّةُ في `server/services/influencer.service.ts`. */
export const INFLUENCER_GRANT_SLUG = 'wajeez-influencers'
export const INFLUENCER_GRANT_NAME_AR = 'منحة مؤثرين وجيز'
export const INFLUENCER_GRANT_DEFAULTS = { percentOff: 45, maxCodes: 1000, maxCourses: 4 } as const

export type GrantSlug = typeof MEMBER_GRANT_SLUG | typeof INFLUENCER_GRANT_SLUG

/** الحملتان باسمَيهما وما تبدأ به كلٌّ منهما */
export const GRANT_CAMPAIGNS: Record<GrantSlug, { nameAr: string; defaults: { percentOff: number; maxCodes: number; maxCourses: number } }> = {
  [MEMBER_GRANT_SLUG]: { nameAr: MEMBER_GRANT_NAME_AR, defaults: GRANT_DEFAULTS },
  [INFLUENCER_GRANT_SLUG]: { nameAr: INFLUENCER_GRANT_NAME_AR, defaults: INFLUENCER_GRANT_DEFAULTS },
}

/** بادئةُ الكود — تميّزه عن رمز الدعوة (WJ) وكود المدرّب (WD) */
export const GRANT_CODE_PREFIX = 'WG-'

/** ما يدفعه صاحبُ المنحة من سعر القائمة — التقريبُ نفسُه الذي تُصدَر به الفاتورة */
export const grantPrice = (listPrice: number, percentOff: number): number =>
  money(listPrice - money((listPrice * percentOff) / 100))

export const GRANT_CLOSED_AR = 'المنحة مغلقة الآن'
export const GRANT_SOLD_OUT_AR = 'انتهت المنح المتاحة'
/** الكودُ بلغ حدَّ دوراته — قرارُ صاحب المنصّة (٢٨ أكتوبر ٢٠٢٦): الحدُّ على الكود في كلّ مشترياته لا مرّةٌ واحدة */
export const grantUsedUpAr = (n: number) => `استعملت كل دورات هذا الكود (${n}).`
export const GRANT_ONCE_AR = 'استعملت منحة من قبل. المنحة مرة واحدة لكل متعلم.'
export const GRANT_NOT_BETTER_AR = 'سعر الباقة في سلتك أقل من سعر المنحة، فلا تحتاج الكود. احتفظ به أو أعطه لغيرك.'
export const grantMaxCoursesAr = (n: number) => `المنحة لـ${n} دورات بحد أقصى. احذف دورة من سلتك.`
/** وما بقي منه أقلّ من حدّه — «بقي لك بهذا الكود دورتان» */
export const grantCoursesLeftAr = (left: number) =>
  `بقي لك بهذا الكود ${left === 1 ? 'دورة واحدة' : left === 2 ? 'دورتان' : `${left} دورات`}. احذف دورة من سلتك.`
export const GRANT_CHECKOUT_ONLY_AR = 'كود المنحة يستعمل عند الشراء المباشر فقط، لا في موافقة الطلبات'

/** أسبابُ ردّ كود المنحة — يُقال سببُها تحت خانة الكود ويُسعَّر الطلبُ بلا كود (`BuyPanel`) */
export const GRANT_ERROR_CODES = ['grant_closed', 'grant_used', 'grant_once', 'grant_not_better', 'grant_max_courses'] as const

/** «آخر يوم» من خانة تاريخ → أوّلُ اليوم الذي بعده بتوقيت عمّان، فيبقى الكودُ صالحا يومَه كلَّه.
    وكان بتوقيت الجهاز: من حفظ أيَّ إعدادٍ من جهازٍ بتوقيتٍ غيره (الخليج مثلا) نقل النهايةَ ساعاتٍ — فالحفظُ يرسلها
    كلَّ مرّة ولو لم يغيّر التاريخ (٢٧ أكتوبر ٢٠٢٦) */
export function grantClosesAt(lastDay: string): string {
  const [y, m, d] = lastDay.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
  return zonedInstant(next, [0, 0, 0, 0], ACADEMY_ZONE).toISOString()
}

/** آخرُ يومٍ للمنحة — النهايةُ تُحفظ أوّلَ اليوم الذي بعده، فيُقال اليومُ الذي قبلها بصيغة الخانة، بتوقيت عمّان */
export function grantLastDay(closesAt: string | Date): string {
  return zonedDay(new Date(new Date(closesAt).getTime() - 1), ACADEMY_ZONE)
}
