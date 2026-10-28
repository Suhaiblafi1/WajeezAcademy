/* ═══ ما يُرفع من لقاءات شعبةٍ حين يُحذف مدرّبُها — قاعدةٌ واحدةٌ لما يُقال وما يقع (٢٨ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «Warn, remove for all». فالإنذارُ قبل الحذف يعدّ هذه اللقاءات (`purgeImpact`)، والحذفُ يرفعها
   (`CohortService.clearSessionsOfDeletedTrainer`) — بالقاعدة نفسِها، فلا يقول الإنذارُ عددا ويقع غيرُه:

   · القادمُ وحدَه — وما مضى سجلُّ ما وقع.
   · وغيرُ المبدئيّ — مثالُ الإدارة للتسجيل، ليس في تقويم أحد.
   · ولا ما انعقد أو سُجّل فيه حضور — واقعةٌ لا مسودّة، كحذف المدرّب لقاءه (`trainerDeleteSession`). */

import type { Prisma } from '@prisma/client'

export function removableOnTrainerDelete(cohortId: string, now: Date): Prisma.CohortSessionWhereInput {
  return {
    cohortId, placeholder: false, status: { notIn: ['done', 'cancelled'] }, startsAt: { gt: now },
    attendance: { none: {} },
    OR: [{ zoom: { is: null } }, { zoom: { is: { actualStartAt: null } } }],
  }
}
