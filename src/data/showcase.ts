/* مسار العرض الافتراضي — يُستعمل في شاشات المحاكاة حين لا استحقاق للمستخدم.
   ⚠ سببه انحدار البند ع-١: الكتالوج يُثبَّت كسولا، فمصفوفة pathways تكون فارغة
   في أول رسم. وكانت أربع شاشات تقرأ `pathways[0].id` مباشرة فترمي TypeError
   وتُظهر صفحة سوداء فارغة: /student (وضع العرض) و/student/project
   و/student/course/:id و/trainer (عبر data/trainer). الدالة تعيد null قبل
   التثبيت، والشاشة تعرض حالة تحميل بدل أن تنكسر. */

import { pathways } from './pathways'
import { pathwayCourses } from './courses'

/** هل وصل الكتالوج؟ الشاشات تسأل قبل أي قراءة تعتمد عليه */
export function hasShowcaseCatalog(): boolean {
  return pathways.length > 0
}

/** أغنى مسار بالدورات للعرض — null قبل تثبيت الكتالوج */
export function showcasePathwayId(): string | null {
  return pathways.find((p) => (pathwayCourses[p.id] ?? []).length >= 4)?.id ?? pathways[0]?.id ?? null
}
