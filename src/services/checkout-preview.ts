/* معاينةُ سعر السلّة من الخادم — `POST /api/public/checkout/preview` (٤ نوفمبر ٢٠٢٦).

   الرقمُ الذي تعرضه صفحةُ «ابنِ مسارك» قبل الدفع يأتي من هنا، وهو حسابُ الفاتورة نفسُه (`priceCart` عبر
   `CommerceService.quote`) — فلا يُعاد حسابُ المنحة ولا الكود في المتصفّح. والنداءُ عامٌّ: يعمل لمن لم يدخل بعد،
   ومن دخل يُسعَّر بحسابه. والعلّةُ في `server/services/commerce.service.ts#preview`. */

import { useEffect, useState } from "react";
import { apiPost, ApiError } from "@/services/api";

export interface PreviewItem {
  cohortId: string;
  courseId: string;
  titleAr: string;
  listPrice: number;
  unitPrice: number;
  couponApplies?: boolean;
}

export interface PreviewExcluded {
  cohortId: string;
  courseId: string;
  titleAr: string;
  reason: string;
  messageAr: string;
}

export interface CheckoutPreview {
  currency: string;
  couponCode: string | null;
  excluded: PreviewExcluded[];
  subtotal: number;
  listTotal: number;
  bundlePct: number;
  bundleDiscount: number;
  capDiscount: number;
  planCredit: number;
  couponDiscount: number;
  grantPct: number | null;
  grantNameAr: string | null;
  firstPurchasePct: number | null;
  discount: number;
  total: number;
  items: PreviewItem[];
  /** سببُ ردّ الكود — والسعرُ معه بلا كود */
  couponError: { code: string; messageAr: string } | null;
  /** شعبٌ في الطلب لا وجودَ لها — تُترك ويُسعَّر الباقي */
  unknownCohorts: number;
  /** أفُحص ما يخصّ الحساب (مسجّلٌ فيها · منحةٌ سابقة · أوّلُ شراء)؟ — لا، لمن لم يدخل بعد */
  accountChecked: boolean;
}

export type PreviewState =
  | { state: "idle" }
  | { state: "loading"; last: CheckoutPreview | null }
  | { state: "ready"; preview: CheckoutPreview }
  | { state: "failed"; messageAr: string };

/** يسعّر الشعبَ والكودَ كلّما تبدّلا — بمهلةٍ قصيرة فلا يُنادى الخادمُ لكلّ نقرةٍ متتالية */
export function useCheckoutPreview(cohortIds: readonly string[], code: string | null, enabled = true, asVisitor = false): PreviewState {
  const [st, setSt] = useState<PreviewState>({ state: "idle" });
  const key = `${[...cohortIds].sort().join(",")}|${code ?? ""}`;
  useEffect(() => {
    if (!enabled || cohortIds.length === 0) return;
    let on = true;
    const t = setTimeout(() => {
      setSt((prev) => ({ state: "loading", last: prev.state === "ready" ? prev.preview : prev.state === "loading" ? prev.last : null }));
      apiPost<CheckoutPreview>("/api/public/checkout/preview", {
        cohortIds: [...new Set(cohortIds)].slice(0, 10),
        ...(code ? { couponCode: code } : {}),
        ...(asVisitor ? { asVisitor: true } : {}),
      })
        .then((preview) => { if (on) setSt({ state: "ready", preview }); })
        .catch((e) => {
          if (!on) return;
          setSt({
            state: "failed",
            messageAr: e instanceof ApiError && e.status === 429
              ? "طلبات كثيرة. انتظر دقائق ثم أعد فتح الصفحة."
              : e instanceof ApiError ? e.message : "تعذر حساب السعر الآن.",
          });
        });
    }, 250);
    return () => { on = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- المفتاحُ يجمع الشعبَ والكود
  }, [key, enabled, asVisitor]);
  return st;
}
