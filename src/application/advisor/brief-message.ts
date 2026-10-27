/* رسالةُ «مستشار قبل الدفع» تحمل المسارَ نفسَه — لا تنتظر ملفّا (٢٤ أكتوبر ٢٠٢٦).

   قال صاحبُ المنصّة: «إذا لم يقم بتنزيل وتحميل PDF لن يصل إلى المستشار أو الواتساب ما هو
   المسار. اجعلها إمّا رابطا لهذا المسار أو على الأقلّ…». فالورقةُ تبقى لمن أراد أن يُرفقها،
   والرسالةُ وحدَها تكفي المستشار: اسمُ المسار، ورابطُ صفحته، والدوراتُ التي في خطّته بأسمائها.

   والدوراتُ نصٌّ لا رابطٌ وحدَه: الخطّةُ المخصّصة محفوظةٌ في متصفّح صاحبها، فرابطُ المسار يفتح
   على دوراته الأصليّة لا على ما اختار. */

import { courseLinesAr } from '../text/course-lines'
import { siteOrigin } from '../site/origin'

/** آخرُ الرسالة بلسان مرسلها — قرارُ صاحب المنصّة (٢٦ أكتوبر ٢٠٢٦): «1». كان سطرُ الورقة «أرجو إرفاق سيرتك…»
    آخرَ الرسالة، فيقرؤه المستشارُ طلبا منه هو أن يُرفق سيرتَه. فصار وعدا يذكّر المرسِلَ أن يرسلها في المحادثة. */
export const BRIEF_ATTACH_MSG_AR = 'سأرسل سيرتي الذاتية أو رابط حسابي على لينكدإن في هذه المحادثة.'

/** «حالتك تستحق جلسة مع مستشار بشري» — رسالةُ من أحاله التشخيصُ إلى مستشار */
export const REFERRAL_MSG_AR = 'مرحبا، أكملت مؤشر وجيز وأخبرني أن حالتي تستحق جلسة مع مستشار بشري — أريد حجز الجلسة التعريفية.'

/** رابطُ صفحة المسار كما يُكتب في الرسالة */
export function pathwayUrlOf(pathwayId: string): string {
  return `${siteOrigin()}/pathways/${pathwayId}`
}

/** رسالةُ الإحالة تحمل ما تحمله رسالةُ «قبل الدفع» (٢٧ أكتوبر ٢٠٢٦) — كانت سطرا واحدا بلا مسارٍ ولا دورات، فيسأل
    المستشارُ أوّلَ ما يسأل عمّا رشّحه التشخيص. قرارُ صاحب المنصّة: «Do all» على اقتراحٍ أوّلُه هذا. */
export function referralTextAr(pathwayId: string, courseNames: string[]): string {
  return advisorBriefTextAr({ message: REFERRAL_MSG_AR, pathwayUrl: pathwayUrlOf(pathwayId), courseNames, attachNote: BRIEF_ATTACH_MSG_AR })
}

export function advisorBriefTextAr({
  message,
  pathwayUrl,
  courseNames,
  attachNote,
}: {
  /** نصُّ الرسالة الأساسيّ — من الصفحة */
  message: string
  /** رابطُ صفحة المسار */
  pathwayUrl: string
  /** الدوراتُ في خطّته الآن */
  courseNames: string[]
  /** طلبُ إرفاق السيرة — آخرَ الرسالة */
  attachNote: string
}): string {
  return [
    message,
    `رابط المسار: ${pathwayUrl}`,
    ...(courseNames.length > 0 ? [`الدورات في خطتي:\n${courseLinesAr(courseNames)}`] : []),
    attachNote,
  ].join('\n\n')
}
