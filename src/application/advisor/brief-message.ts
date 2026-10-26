/* رسالةُ «مستشار قبل الدفع» تحمل المسارَ نفسَه — لا تنتظر ملفّا (٢٤ أكتوبر ٢٠٢٦).

   قال صاحبُ المنصّة: «إذا لم يقم بتنزيل وتحميل PDF لن يصل إلى المستشار أو الواتساب ما هو
   المسار. اجعلها إمّا رابطا لهذا المسار أو على الأقلّ…». فالورقةُ تبقى لمن أراد أن يُرفقها،
   والرسالةُ وحدَها تكفي المستشار: اسمُ المسار، ورابطُ صفحته، والدوراتُ التي في خطّته بأسمائها.

   والدوراتُ نصٌّ لا رابطٌ وحدَه: الخطّةُ المخصّصة محفوظةٌ في متصفّح صاحبها، فرابطُ المسار يفتح
   على دوراته الأصليّة لا على ما اختار. */

import { courseLinesAr } from '../text/course-lines'

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
