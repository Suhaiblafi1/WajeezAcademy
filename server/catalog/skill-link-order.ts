/* ترتيبُ مهارات الدورة عند القراءة (٢٠ أكتوبر ٢٠٢٦).

   صفحةُ الدورة تعرض مهارتَها الأولى شارةً (`skill_names_ar[0]` في `src/data/courses.ts`). وكانت الروابطُ
   تُقرأ بلا ترتيب — فتعيدها PostgreSQL كما اتّفق، وتتبدّل بعد كلّ استيرادٍ يحدّث الصفوف. وفي قاعدة
   الديمو بُنيت لقطةٌ بعد إعادة استيرادٍ فخرجت ٩ دوراتٍ من ١٤٩ بشارةٍ غير مهارتها الأولى، و٣٧ بترتيبٍ آخر.

   فالترتيبُ عمودٌ يكتبه المستوردُ من المصدر (`sequence`)، والمعرّفُ بعده يحسم التعادل — فروابطُ كُتبت
   قبل العمود كلُّها صفر. ويحرسه `server/tests/catalog/skill-link-order.test.ts`. */

import type { Prisma } from '@prisma/client'

export const SKILL_LINK_ORDER: Prisma.CourseSkillLinkOrderByWithRelationInput[] = [{ sequence: 'asc' }, { skillId: 'asc' }]
