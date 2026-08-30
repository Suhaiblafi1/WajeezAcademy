/* سلّم أسعارٍ صناعيّ — للاختبار وحده، لا يُعرض ولا يُفوتَر.

   حوارس التسعير في `course-path.test.ts` تقيس خصائصَ الصيغة لا أسعارَ السوق:
   ألّا تخفض إضافةُ دورةٍ الإجماليَّ أبدا، وأن يساوي التوفيرُ المعلن الفرقَ
   فعلا، وألّا تَعِد رسالةُ «دورة أخرى» بأكثر مما تعطي. وقياسُها يحتاج مدى
   أسعارٍ عريضا مضمونا فوق الكتالوج كله — وأسعارُ الشعب الحقيقية قليلةٌ الآن
   ومتغيّرة، فاختبارٌ عليها يخضرّ صدفةً لا برهانا.

   وكان هذا السلّم يعيش في `src/data/courses.ts` ويُعرض على المتعلم. نُقل إلى
   شجرة الاختبارات ليصير عرضُه مستحيلا بنيةً لا انضباطا: ما ليس في الحزمة لا
   يُرسَم. ويحرس ذلك `no-fabricated-prices.test.ts`. */

import type { Course } from '../data/courses'

const PREMIUM_KEYWORDS = [
  'ذكاء اصطناعي', 'AI', 'بيانات', 'تحليل', 'قيادة', 'تفاوض', 'مشاريع',
  'استراتيجية', 'مالية', 'مشتريات', 'عقود', 'حوكمة', 'تحول رقمي', 'إدارة المخاطر',
]

/** سعرٌ صناعيّ ١٣٠–١٨٠ لكل دورة — مدى عريض يكفي لكسر أي صيغةٍ معتلّة */
export function scalePriceOf(c: Course): number {
  const base = c.weeks <= 1 ? 130 : c.weeks === 2 ? 145 : c.weeks === 3 ? 160 : 170
  const premium = PREMIUM_KEYWORDS.some((k) => c.name.includes(k) || c.skill.includes(k)) ? 10 : 0
  return Math.min(180, base + premium)
}

/** دالّة السعر كما تتلقّاها `pathPricing` */
export const scaleOf = (id: string, byId: (id: string) => Course | undefined) => {
  const c = byId(id)
  return c ? scalePriceOf(c) : null
}
