/* أسماءُ أنواعِ التغيير بالعربيّة — طبقةٌ مشتركةٌ يقرؤها المدرّبُ والإدارة.

   ولمَ ملفٌّ جديدٌ ولم تُنقَل القائمةُ نفسُها إلى هنا: `CHANGE_TYPES` في
   `server/services/trainer-change.service.ts` **يُقرأ نصّا** من حارسٍ قائم
   (`src/tests/trainer/cohort-proposals.test.ts`) يقتصّ ما بين
   `export const CHANGE_TYPES = [` و`] as const` ليُثبت أنّ نوعَ اسم الدورة
   لم يعد فيها. فنقلُها يجعل ذلك الحارسَ يقتصّ من `indexOf` سالبٍ — فلا
   يسقط، بل **يحرس فراغا** ويبقى أخضر. وحارسٌ أخضرُ لا يحرس شيئا أسوأُ من
   لا حارس.

   فالقائمةُ حيث هي، وهذا معجمُها. واتّفاقُهما ليس أدبا يُرجى: يحرسه
   `server/tests/trainer/own-course-authoring.test.ts` — نوعٌ يُضاف هناك بلا
   اسمٍ هنا يظهر للمدرّب رمزا لاتينيّا، واسمٌ هنا بلا نوعٍ هناك يعرض عليه
   بابا يردّه الخادم. */

/** بالترتيب الذي يُعرَض به: المحاورُ أوّلا ثمّ ما يُعلَّق عليها ثمّ حدودُ الدورة */
export const CHANGE_TYPE_LABELS_AR: Record<string, string> = {
  module_add: 'إضافةُ محور',
  module_title_edit: 'تعديلُ عنوانِ محور',
  module_reorder: 'إعادةُ ترتيبِ المحاور',
  explanation_improve: 'تحسينُ الشرح',
  examples_update: 'تحديثُ الأمثلة',
  material_add: 'إضافةُ مصدر',
  activity_add: 'إضافةُ نشاط',
  assignment_add: 'إضافةُ مهمّة',
  assessment_improve: 'تحسينُ التقييم',
  project_propose: 'اقتراحُ مشروعٍ تطبيقيّ',
  outcome_propose: 'اقتراحُ مخرَجٍ تعلّميّ',
  duration_propose: 'اقتراحُ مدّةٍ بالساعات',
}

/** اسمُ النوعِ أو النوعُ نفسُه — فلا يُعرَض فراغٌ لنوعٍ لم يُسمَّ بعد */
export function changeTypeLabelAr(changeType: string): string {
  return CHANGE_TYPE_LABELS_AR[changeType] ?? changeType
}
