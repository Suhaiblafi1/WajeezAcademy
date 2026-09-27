/* ═══ تأجيلُ لقاءٍ قريب — يبقى معتمَدا (المرحلة ٣ج) ═══

   قرارُ صاحب المنصّة (١٧ سبتمبر ٢٠٢٦): اللقاءُ المعتمَدُ «يغيّره فيرجع لانتظار
   الإدارة» — فلا يصل المسجَّلين موعدٌ لم يُراجَع. وقراراتُه العشرة بكلمة «go»
   (٢٧ سبتمبر ٢٠٢٦): «وبعد الاعتماد كلُّ تغييرٍ باعتماد — إلّا تأجيلَ لقاءٍ بعده
   أقلُّ من ثمانٍ وأربعين ساعة».

   ولماذا الاستثناء: مدرّبٌ مرض صباحَ لقائه فأجّله يوما. لو رجع اللقاءُ إلى
   الانتظار لاختفى من تقاويم عشرين إنسانا حتّى يفتح أحدٌ في الإدارة طابورَه —
   وقد لا يفتحه قبل الموعد القديم، فيحضر المتعلّمون في وقتٍ لا أحدَ فيه ولا
   يجدون الجديد. فالتأجيلُ القريبُ ينفُذ معتمَدا، ويُبلَّغ المسجَّلون بموعده
   الجديد، واجتماعُ Zoom نفسُه يُنقل إليه.

   ── وحدودُه ──

   · **تأجيلٌ لا تقديم**: ما نُقل إلى وقتٍ أبكر يضيّق على من رتّب يومَه — فيُراجَع.
   · **قبل أن يبدأ**: لقاءٌ بدأ أو مضى لا يُؤجَّل من هنا.
   · **داخلَ موعد محوره**: اللقاءُ يفتح مهامَّ محوره بانتهائه (`axis-timeline.ts`)،
     وتأجيلُه خارجَ موعده يؤخّر فتحَها بلا قارئ — فيُراجَع كسائر النقل.
   وما عدا ذلك يرجع إلى الانتظار كما قرّر ١٧ سبتمبر. */

import { periodBounds, realDate } from './cohort-period'

/** ثمانٍ وأربعون ساعة — ما دونها قبل اللقاء يُؤجَّل بلا انتظار */
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

/** أيبقى اللقاءُ معتمَدا بعد نقله؟ — تأجيلٌ قريبٌ داخلَ موعد محوره */
export function keepsApprovalOnMove(m: MoveCheck): boolean {
  if (!m.approved) return false
  const lead = m.startsAt.getTime() - m.now.getTime()
  if (lead <= 0 || lead >= POSTPONE_WINDOW_MS) return false
  if (m.newStartsAt.getTime() <= m.startsAt.getTime()) return false
  if (m.slot && realDate(m.slot.startsOn) && realDate(m.slot.endsOn)) {
    const { from, to } = periodBounds(m.slot)
    const end = m.newEndsAt ?? m.newStartsAt
    if (m.newStartsAt.getTime() < from.getTime() || end.getTime() > to.getTime()) return false
  }
  return true
}
