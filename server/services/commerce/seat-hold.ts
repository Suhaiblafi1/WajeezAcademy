/* ═══ كم يبقى المقعدُ محجوزا بلا دفع — قرارُ صاحب المنصّة (١٩ أكتوبر ٢٠٢٦) ═══

   كانت المهلةُ ساعةً لكلّ طلبٍ لم يُدفع (`reclaim_abandoned_orders`). وهي صوابٌ لمن اشترى بنفسه:
   هو في صفحة الدفع الآن، والساعةُ تتجاوز أطولَ صفحة دفع. وخطأٌ لمن حجز له الفريقُ مقعدا وهو
   غائب — يصله الخبرُ بريدا، وقد يقرؤه بعد ساعات فيجد المقعدَ ذهب. وكانت «رحلتي» تقول له
   «ومقعدك باق ما دامت الشعبة مفتوحة»، ولا شيءَ في الشيفرة يفي بها.

   فخُيّر بين ساعةٍ للجميع تُقال صراحةً، وبلا إلغاءٍ لما حجزه الفريق، ويومين لما حجزه الفريق —
   فاختار الثالث. والمهلةُ تُحسب هنا وحدَها: الوظيفةُ تُلغي بها، والشاشاتُ تعرض موعدَها. */

import type { Prisma, PrismaClient } from '@prisma/client'

export const CHECKOUT_HOLD_MS = 3_600_000
export const TEAM_HOLD_MS = 48 * 3_600_000

type Db = PrismaClient | Prisma.TransactionClient

/** أيُّ هذه الطلبات حجز الفريقُ مقاعدَها؟ — بمن قرّر الحجز: الشراءُ المباشر يكتب `decidedBy: null`،
    وموافقةُ الطلب والخطّة تكتبان المعتمِد. */
export async function teamHeldOrderIds(db: Db, orderIds?: string[]): Promise<Set<string>> {
  const rows = await db.enrollmentRequest.findMany({
    where: {
      status: 'seat_held', decidedBy: { not: null },
      orderId: orderIds ? { in: orderIds } : { not: null },
    },
    select: { orderId: true },
  })
  return new Set(rows.map((r) => r.orderId).filter((id): id is string => !!id))
}

/** آخرُ لحظةٍ للدفع — وبعدها يُلغى الطلبُ ويُفرَج عن المقعد */
export function payByOf(createdAt: Date, teamHeld: boolean): Date {
  return new Date(createdAt.getTime() + (teamHeld ? TEAM_HOLD_MS : CHECKOUT_HOLD_MS))
}
