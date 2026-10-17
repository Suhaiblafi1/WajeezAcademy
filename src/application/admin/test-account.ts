/* ═══ حسابُ التجربة — لا يُعدّ طلبُه (١٧ أكتوبر ٢٠٢٦) ═══

   سأل صاحبُ المنصّة عن «من ينتظر دورة بلا شعبة»: كلُّ دورةٍ فيها ينتظرها واحدٌ في خطّته — وهو
   حسابُ تجربة. فقال: «اخفي هذه القائمة اذا كان الطلب من حساب تجريبي»، واختار أن يُعرف بوجهَين:

   ① **من نفسه**: حسابُ فريق العمل أو المدرّب أو المستشار (`STAFF_ROLES` وأخواتها)، وحساباتُ
      البذر على نطاق `wajeez.local` (`scripts/purge-demo-data.ts`). من يعمل في المنصّة يجرّبها،
      وطلبُه ليس طلبَ سوق.
   ② **وبيد الإدارة**: مفتاحُ «حساب تجريبي» في بطاقة الحساب (`User.isTestAccount`) — لحساب تجربةٍ
      لا يحمل إلّا دورَ المتعلّم، فلا يُعرف من نفسه.

   والحكمُ هنا وحدَه: يقرؤه الخادمُ حين يعدّ الطلب، وشاشةُ المستخدمين حين تقول أيُّ حسابٍ يُعلَّم. */

import { STAFF_ROLES } from './account-kind'

/** نطاقُ حسابات البذر — كما في `scripts/purge-demo-data.ts` */
export const DEMO_EMAIL_DOMAIN = '@wajeez.local'

/** الأدوارُ التي يُعرف بها حسابُ التجربة من نفسه: من يعمل في المنصّة */
export const WORKING_ROLES: readonly string[] = [...STAFF_ROLES, 'trainer', 'advisor']

/** أيُعرف حسابَ تجربةٍ من نفسه — بدوره أو بنطاق بريده — بلا مفتاح؟ */
export function testByItself(u: { email: string; roleIds: readonly string[] }): boolean {
  return u.email.trim().toLowerCase().endsWith(DEMO_EMAIL_DOMAIN) || u.roleIds.some((r) => WORKING_ROLES.includes(r))
}

/** أهو حسابُ تجربةٍ — من نفسه أو بمفتاح الإدارة؟ */
export function isTestAccount(u: { email: string; roleIds: readonly string[]; isTestAccount: boolean }): boolean {
  return u.isTestAccount || testByItself(u)
}
