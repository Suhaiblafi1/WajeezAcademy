/* اسم المهارة العربي من شريحتها — مصدر واحد لكل شاشة تعرض اسم مهارة.
   الكتالوج يُحمَّل كسولا (ع-١)، فتُستدعى الدالة عند العرض لا عند تحميل الوحدة.
   بلا مطابقة تُعاد الشريحة مقروءة: لا اسم مختلق ولا فراغ. */

import { skillsCatalog } from '../domain/diagnostic/catalog'

export function skillNameOf(slug: string): string {
  const entry = skillsCatalog.find((s) => s.slug === slug)
  return entry?.name_ar ?? slug.replace(/_/g, ' ')
}
