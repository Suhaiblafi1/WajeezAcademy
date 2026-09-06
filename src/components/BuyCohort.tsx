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
import Button from "@/components/ui/Button";
import {
  PRESENTMENT_CODES, PRESENTMENT_CURRENCIES, convertFromUsd, formatPresentment,
  type PresentmentCurrency,
} from "@/application/commerce/presentment";

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
  /* عملةُ البطاقة — تُختار هنا وحدَها. والسعرُ المعروض في الموقع كلِّه بالدولار
     (قرارُ صاحب المنصّة)، فلا مبدّلَ عملةٍ في أيّ صفحةٍ أخرى. */
  const [currency, setCurrency] = useState<PresentmentCurrency>("USD");

  if (!cohort) return null;

  /* التحويلُ يُعرض قبل الضغط لا بعده: من يختار الدرهم يرى ٣٦٧٫٢٥ درهما هنا،
     وهو بعينه ما سيراه على صفحة Stripe وفي كشف بطاقته. */
  const usd = cohort.currency === "USD";
  const shown = usd
    ? formatPresentment(convertFromUsd(cohort.amount, currency), currency)
    : formatOfferPrice(cohort.amount, cohort.currency);

  const buy = async () => {
    setBusy(true);
    setError(null);
    try {
      const order = await apiPost<CheckoutResult>("/api/learner/checkout", { cohortIds: [cohort.id] });
      const pay = await apiPost<PayResult>(`/api/learner/orders/${order.orderId}/pay`, {
        idempotencyKey: `buy-${order.orderId}-${currency}`,
        ...(usd ? { presentment: currency } : {}),
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
    <div className={`flex flex-col items-end gap-1.5 ${className}`}>
      {/* ثلاثُ عملاتٍ مربوطةٍ بالدولار — لا مبدّلَ عملةٍ في الموقع، بل هنا فقط */}
      {usd && (
        <div className="flex items-center gap-1" role="group" aria-label="عملة الدفع">
          {PRESENTMENT_CODES.map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              aria-pressed={currency === c}
              title={PRESENTMENT_CURRENCIES[c].labelAr}
              className={`cursor-pointer rounded-full border px-2 py-0.5 text-micro font-bold transition ${
                currency === c
                  ? "border-gold/60 bg-gold/15 text-gold-ink"
                  : "border-white/12 text-muted-foreground hover:border-white/25 hover:text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}
      <Button tone="primary" onClick={() => void buy()}
        disabled={busy} className="disabled:opacity-50">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
        اشترِ الآن · <span dir="ltr">{shown}</span>
      </Button>
      {error && <p className="max-w-[16rem] text-left text-[11px] leading-4 text-red-300">{error}</p>}
    </div>
  );
}
