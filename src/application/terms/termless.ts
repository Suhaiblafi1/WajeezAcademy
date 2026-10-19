/* ═══ شعبٌ بلا فصل: ما يتحدّد وحدَه وما يحتاجك (١٩ أكتوبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة عن صندوق «شعب لم يسمّ فصلها (20)»: «لماذا يجب أن أعيد التوزيع والمدرّبُ هو من حدّد وأنا
   اعتمدت.. هذا فعلٌ مكرّر». والحقّ معه: الفصلُ يُكتب وحدَه حين تُعتمَد خطّةُ المدرّب — من تاريخ البدء الذي
   اختاره (`applyPeriod`)، والمؤجَّلةُ من يوم تأجيلها، وما فات يلتقطه عاملٌ كلَّ ساعة (`assignMissingTerms`).
   وكان الصندوقُ يعرض كلَّ شعبةٍ بلا فصلٍ بزرّ «سمّ الفصل» كأنّه عملٌ ينتظرك — وأكثرُها خطّتُها عند مدرّبها
   لم تُعتمَد بعد، فاعتمادُها يسمّي فصلَها.

   · **يتحدّد وحدَه (`auto`)**: لها مدرّبٌ ولم تُعتمَد لها خطّةٌ قطّ. تُطوى في سطرٍ واحد، والاختيارُ باقٍ لمن
     شاء أن يضع حدودا مبدئيّةً قبل الاعتماد — خيارٌ لا واجب.
   · **يحتاجك (`needs`)**: لا مدرّبَ لها، أو اعتُمدت خطّتُها ولم يُعرف موسمُها (لا تاريخ بدء، أو فصلُه أُغلق).
     هذه وحدَها يُطلب لها فصلٌ منك، وسببُها مكتوب. */

import { countAr } from '../text/count-ar'

export type TermlessKind = 'auto' | 'needs'

export interface TermlessFacts {
  trainers: number
  /** اعتُمدت لمدرّبها خطّةٌ قطّ (`planApprovedOnce`) */
  approvedOnce: boolean
}

export function termlessKindOf(c: TermlessFacts): { kind: TermlessKind; whyAr: string | null } {
  if (c.trainers === 0) return { kind: 'needs', whyAr: 'لا مدرب لها' }
  if (c.approvedOnce) return { kind: 'needs', whyAr: 'اعتمدت خطتها ولم يعرف موسمها من تاريخ بدئها' }
  return { kind: 'auto', whyAr: null }
}

const PLAN_WAIT_AR: Record<string, string> = {
  draft: 'الخطة عند المدرب',
  submitted: 'الخطة تنتظر اعتمادك',
  changes_requested: 'الخطة ردت إليه بتعديلات',
}

/** سطرُ ما يتحدّد وحدَه: أين خطّتُه، ومتى يبدأ إن اختار مدرّبُه تاريخا */
export function termlessWaitAr(c: { plan: string | null; startsOn: string | null }, day: (d: string) => string): string {
  const where = (c.plan && PLAN_WAIT_AR[c.plan]) || 'لم يكتب المدرب خطته بعد'
  return c.startsOn ? `${where} · يبدأ ${day(c.startsOn)} حسب خطته` : where
}

/** رأسُ المطويّ: كم شعبةً يتحدّد فصلُها وحدَه — ولا شيءَ عليك */
export function termlessAutoAr(n: number): string {
  const head = n === 2 ? 'شعبتان' : countAr(n, { one: 'شعبة', two: 'شعبتان', few: 'شعب', many: 'شعبة' })
  return `${head} يتحدد فصلها وحده عند اعتماد خطة مدربها. لا شيء عليك الآن.`
}
