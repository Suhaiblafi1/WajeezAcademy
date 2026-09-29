/* ═══ نقلُ لقاءٍ معتمَدٍ داخلَ موعد محوره — يبقى معتمَدا (٢٩ سبتمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة (١٧ سبتمبر ٢٠٢٦): اللقاءُ المعتمَدُ «يغيّره فيرجع لانتظار
   الإدارة» — فلا يصل المسجَّلين موعدٌ لم يُراجَع. ثمّ قراراتُه العشرة بكلمة «go»
   (٢٧ سبتمبر ٢٠٢٦): «وبعد الاعتماد كلُّ تغييرٍ باعتماد — إلّا تأجيلَ لقاءٍ بعده
   أقلُّ من ثمانٍ وأربعين ساعة». ثمّ سرى ربطُ اللقاء بمحاوره وموضعُ الجلسة
   المسجّلة بلا اعتماد (٢٨ سبتمبر)، فسُئل عن نقل اللقاء المباشر فقال بنصّه: «free
   it, keep it inside the axis window».

   فاللقاءُ المعتمَدُ يُنقل **داخلَ موعد محوره** فيبقى معتمَدا — مقدَّما أو مؤجَّلا،
   قريبا أو بعيدا — ويُبلَّغ مسجَّلوه موعدَه الجديد، واجتماعُ Zoom نفسُه يُنقل
   إليه. والموعدُ هو الحدُّ لأنّ اللقاءَ يفتح مهامَّ محوره بانتهائه
   (`axis-timeline.ts`): ما خرج عنه يؤخّر فتحَها أو يسبقه بلا قارئ.

   ── وما لا يبقى معتمَدا ──

   · **ما خرج عن موعد محوره** — بدءا أو نهاية، بالقاعدة التي يحجب بها الإرسالُ
     نفسِها (`sessionInsideSlot`). يرجع إلى الانتظار كما قرّر ١٧ سبتمبر.
   · **وما لا موعدَ معروفا لمحوره** — شعبةٌ اعتُمدت قبل المواعيد، أو لقاءٌ بلا محور:
     لا حدَّ يُقاس به، فيبقى على التأجيل القريب كما كان (٣ج): تأجيلٌ لا تقديم، قبل
     أن يبدأ، وبعده أقلُّ من ثمانٍ وأربعين ساعة. ولماذا ذلك الاستثناء: مدرّبٌ مرض
     صباحَ لقائه فأجّله يوما — لو رجع إلى الانتظار لاختفى من تقاويم عشرين إنسانا
     حتّى يفتح أحدٌ في الإدارة طابورَه. */

import { realDate } from './cohort-period'
import { sessionInsideSlot } from './axis-timeline'

/** ثمانٍ وأربعون ساعة — ما دونها قبل اللقاء يُؤجَّل بلا انتظار حيث لا موعدَ لمحوره */
export const POSTPONE_WINDOW_MS = 48 * 60 * 60 * 1000

export interface MoveCheck {
  /** اللقاءُ معتمَدٌ الآن — المنتظِرُ لا اعتمادَ يُحفظ له */
  approved: boolean
  startsAt: Date
  newStartsAt: Date
  newEndsAt?: Date | null
  now: Date
  /** موعدُ محوره في الخطّة المعتمَدة — و`null` لما لا مواعيدَ له */
  slot?: { startsOn: string; endsOn: string } | null
}

/** أيبقى اللقاءُ معتمَدا بعد نقله؟ — داخلَ موعد محوره، أو تأجيلٌ قريبٌ حيث لا موعد */
export function keepsApprovalOnMove(m: MoveCheck): boolean {
  if (!m.approved) return false
  if (m.slot && realDate(m.slot.startsOn) && realDate(m.slot.endsOn)) {
    return sessionInsideSlot({ startsAt: m.newStartsAt, endsAt: m.newEndsAt ?? null }, m.slot)
  }
  const lead = m.startsAt.getTime() - m.now.getTime()
  if (lead <= 0 || lead >= POSTPONE_WINDOW_MS) return false
  return m.newStartsAt.getTime() > m.startsAt.getTime()
}
