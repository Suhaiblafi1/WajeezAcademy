/* أنواعُ الكوبونات ومن يديرها — والعلّةُ في `src/components/admin/CouponsPanel.tsx` (٢٦ أكتوبر ٢٠٢٦) */

export interface AdminCoupon {
  id: string; code: string; percentOff: number | null; amountOff: string | null; currency: string | null;
  maxUses: number | null; usedCount?: number; active: boolean; expiresAt: string | null;
  trainerCode?: { percentOff: number | null; amountOff: string | null; status: string } | null;
  trainerDiscount?: { status: string } | null;
  grantCode?: { id: string } | null;
  trainerShareCode?: { id: string } | null;
  _count?: { orders: number };
}

export type CouponKind = "ours" | "trainer" | "grant";

/** نوعُ الكود — ومن يديره */
export function couponKind(c: AdminCoupon): CouponKind {
  if (c.grantCode) return "grant";
  if (c.trainerCode || c.trainerDiscount || c.trainerShareCode) return "trainer";
  return "ours";
}

/** يُعدَّل هنا؟ — كوبوناتنا وحدَها، والباقي من صفحاته */
export const editableHere = (c: AdminCoupon) => couponKind(c) === "ours";
/** يُحذف؟ — ما لم يُستعمل قطّ من كوبوناتنا */
export const deletable = (c: AdminCoupon) => editableHere(c) && (c.usedCount ?? 0) === 0 && (c._count?.orders ?? 0) === 0;
