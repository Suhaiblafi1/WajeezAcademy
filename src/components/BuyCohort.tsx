/* «اشترِ الآن» — من قرار الشراء إلى الدفع بلا صفحةٍ وسيطة ولا انتظارِ أحد.

   كان الطريق: «اطلب شعبة» ← صفحة الشعب المفتوحة ← طلبٌ ينتظر موافقة الإدارة
   ← فاتورة ← دفع. وقرار صاحب المنتج: «الأسعار معلنة والدفع مباشر بلا طلب».
   فصار نداءين: `checkout` يُنشئ الطلب ويحجز المقعد، و`pay` يُنشئ الدفعة عند
   المزوّد المضبوط ويعيد رابط صفحته حين يكون مستضافا (Stripe).

   والتحويل إلى المزوّد لا يعني أنّ الدفع تمّ: التسوية بـwebhook موقَّع، ورجوع
   المتصفّح ليس دليلا. فلا نقول «تمّ» هنا — نقول «إلى صفحة الدفع». */

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { apiPost, ApiError } from "@/services/api";
import type { CohortOption } from "@/services/cohort-prices";
import { formatOfferPrice } from "@/application/commerce/pathway-offer";

interface CheckoutResult { orderId: string; total: number; currency: string }
interface PayResult { redirectUrl?: string; status?: string }

export default function BuyCohort({
  cohort,
  onBought,
  className = "",
}: {
  cohort: CohortOption | null;
  /** بعد دفعةٍ فوريّة (مزوّد غير مستضاف) — لتُحدَّث الصفحة */
  onBought?: () => void;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!cohort) return null;

  const buy = async () => {
    setBusy(true);
    setError(null);
    try {
      const order = await apiPost<CheckoutResult>("/api/learner/checkout", { cohortIds: [cohort.id] });
      const pay = await apiPost<PayResult>(`/api/learner/orders/${order.orderId}/pay`, {
        idempotencyKey: `buy-${order.orderId}`,
      });
      if (pay.redirectUrl) {
        /* صفحة دفعٍ مستضافة — نغادر الموقع، فلا حاجة لإطفاء الانشغال */
        window.location.assign(pay.redirectUrl);
        return;
      }
      onBought?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "تعذّر إتمام الشراء — أعد المحاولة");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`flex flex-col items-end gap-1 ${className}`}>
      <button
        onClick={() => void buy()}
        disabled={busy}
        className="flex cursor-pointer items-center gap-2 rounded-full bg-gold px-5 py-2 text-xs font-black text-on-gold transition hover:bg-gold/90 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
        اشترِ الآن · <span dir="ltr">{formatOfferPrice(cohort.amount, cohort.currency)}</span>
      </button>
      {error && <p className="max-w-[16rem] text-left text-[11px] leading-4 text-red-300">{error}</p>}
    </div>
  );
}
