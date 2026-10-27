/* العودةُ بعد الدخول إلى ما فُتح قبله — `/auth?next=…` (٢٧ أكتوبر ٢٠٢٦).

   كان حارسُ البوّابات (`RequireRole`) يحوّل من لا جلسةَ له إلى `/auth` بلا شيء، وصفحةُ الدخول تُنزله بعد الدخول
   على بوّابة دوره. فمن ضغط رابطا إلى موضعٍ بعينه — رابطَ ملفّ صاحب المنحة في واتساب (`/g/<كوده>`)، أو رابطا أُرسل
   إليه في بريد — وجد نفسه في رئيسة بوّابته وضاع ما جاء له. قرارُ صاحب المنصّة: «Do all» على اقتراحٍ هذا ثانيه.

   والوجهةُ تُفحص بما تُفحص به الروابطُ القصيرة (`isSafeTarget`): مسارٌ داخليٌّ وحدَه، وإلّا صار `?next=` بابَ تحويلٍ
   مفتوحٍ إلى موقعٍ آخر. */

import { isSafeTarget } from './short-link'

/** طريقُ الدخول ومعه ما يُعاد إليه بعده — وبلا `next` إن لم يكن ما يُعاد إليه */
export function authPathFor(target: string): string {
  return isReturnable(target) ? `/auth?next=${encodeURIComponent(target)}` : '/auth'
}

/** ما يُعاد إليه بعد الدخول من استعلام صفحة الدخول — أو `null` فيُنزَل على بوّابة دوره كما كان */
export function returnTargetOf(search: string): string | null {
  const next = new URLSearchParams(search).get('next')
  return next && isReturnable(next) ? next : null
}

/* الرئيسةُ وصفحةُ الدخول نفسُها ليستا وجهةً: الأولى لا تزيد على بوّابة دوره، والثانية حلقة */
function isReturnable(target: string): boolean {
  return isSafeTarget(target) && target !== '/' && !/^\/auth(?:[/?#]|$)/.test(target)
}
