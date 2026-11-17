/* رفعُ أسعار الشعب القائمة مع سعر القائمة — مرّةً واحدة، بلا إعلان (١٧ نوفمبر ٢٠٢٦).

   ═══ القرار ═══

   قال صاحبُ المنصّة: «أريد منك رفع أسعار الدورات كافّة ١٠٪ لتعود كما كانت بالقديم، بدون إبلاغ أحد أنّ الأسعار ارتفعت».
   وخُيّر بين العودة إلى الأرقام القديمة بعينها والرفع ١٠٪ بأرقامٍ مستديرة، فاختار **١٠٪ مستديرة** — سلّمُها في
   `src/application/catalog/course-pricing.ts`، وسعرُ القائمة يدخل القاعدةَ مع الكتالوج في كلّ نشر (`catalog:import`).

   ═══ والشعبُ القائمة ═══

   تحمل سعرَها يومَ فُتحت، فلا ترتفع وحدَها. فهنا تُرفع مرّةً بالسلّم نفسِه (`PRICE_RAISE_MAP`) — **ما كان سعرُه درجةً من السلّم
   القديم بالدولار وحدَه**: شعبةٌ سُعّرت بيدٍ بغير ذلك تُترك كما هي وتُعدّ في الأثر. وبالقاعدة التي يوحّد بها المديرُ الأسعارَ
   (`alignCohortPrices`): **لا يُعاد تسعيرُ شعبةٍ فيها مقعدٌ محجوزٌ أو مدفوع** — ما اتُّفق عليه لا يتغيّر بعد الاتّفاق. والمنتهيةُ
   والملغاةُ لا تُمسّ. ولا بريدَ ولا إشعار: التحديثُ في القاعدة مباشرة، والأثرُ وحدَه يقول كم.

   وما يتبعه ولا يتغيّر وحدَه: أجرُ المدرّب بنسبة الإيراد يرتفع مع السعر، وخصمُ المنح نسبةٌ من السعر الجديد.

   والحارس: `server/tests/catalog/cohort-price-raise.test.ts`. */

import type { PrismaClient } from '@prisma/client'
import { recordAudit } from './audit'

/** السلّمُ القديمُ ← الجديد (+١٠٪ مستديرة) — وCPIM ٢٥٥ ← ٢٨٠ */
export const PRICE_RAISE_MAP: Readonly<Record<number, number>> = { 100: 110, 125: 140, 150: 165, 170: 185, 190: 210, 255: 280 }
export const PRICE_RAISE_REASON = 'قرار صاحب المنصة (17 نوفمبر 2026): أسعار الدورات +10% بأرقام مستديرة، بلا إعلان'
export const PRICE_RAISE_ACTION = 'catalog.cohorts.price_raise'
/** ما يُرفع: ما لم ينتهِ ولم يُلغَ */
const RAISABLE = ['draft', 'open', 'full', 'active']

export async function applyCohortPriceRaise(prisma: PrismaClient): Promise<{ raised: number; skippedCommitted: number; skippedOther: number } | null> {
  const done = await prisma.auditEvent.count({ where: { action: PRICE_RAISE_ACTION, reason: PRICE_RAISE_REASON } })
  if (done > 0) return null
  const cohorts = await prisma.cohort.findMany({
    where: { status: { in: RAISABLE }, price: { not: null } },
    select: { id: true, price: true, currency: true, enrollmentRequests: { select: { status: true, orderId: true } } },
  })
  let raised = 0, skippedCommitted = 0, skippedOther = 0
  await prisma.$transaction(async (tx) => {
    for (const c of cohorts) {
      const target = c.currency === 'USD' ? PRICE_RAISE_MAP[Number(c.price)] : undefined
      if (target === undefined) { skippedOther++; continue }
      const committed = c.enrollmentRequests.some((r) => r.status === 'seat_held' || r.status === 'converted' || r.orderId)
      if (committed) { skippedCommitted++; continue }
      await tx.cohort.update({ where: { id: c.id }, data: { price: target } })
      raised++
    }
    await recordAudit(tx, {
      actorId: null, action: PRICE_RAISE_ACTION, entityType: 'catalog', entityId: 'all', reason: PRICE_RAISE_REASON,
      meta: { raised, skippedCommitted, skippedOther, map: PRICE_RAISE_MAP },
    })
  })
  return { raised, skippedCommitted, skippedOther }
}
