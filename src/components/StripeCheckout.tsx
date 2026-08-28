/* نافذة الدفع (Stripe) — مشتركة بين صفحة المسار وصفحة المسار المبني من دورة.

   كانت داخل Pathway.tsx وحدها، فصفحة البناء الجديدة كانت ستحتاج نسخة ثانية:
   نسختان من شاشة دفع تفترقان مع أول تعديل، وواحدةٌ منهما تُنسى. مكوّن واحد.

   ⚠ هذه محاكاة عرض لا تكامل Stripe حقيقي: لا مفتاح ولا PaymentIntent، والنجاح
   مؤقّت زمنيا. أُبقيت كما هي عمدا — المدفوعات بند مؤجَّل بقرار المالك، وتغييرها
   ضمن نقل مكوّن يخلط تغييرين لا علاقة بينهما. */

import { useEffect, useState } from "react";
import { CreditCard, ShieldCheck } from "lucide-react";
import Modal from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { CURRENCIES, setCurrency, useCurrency, usePriceFormatter, type CurrencyCode } from "@/services/currency";
import { FIRST_TIME_PROMO, isFirstTimePromo, priceAfterPromo } from "@/application/commerce/first-time-promo";
import { track } from "@/services/analytics";

export default function StripeCheckout({
  title,
  amount,
  onSuccess,
  onClose,
}: {
  title: string;
  amount: number;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [card, setCard] = useState("");
  const [promo, setPromo] = useState("");
  const [processing, setProcessing] = useState(false);
  /* الكود يُعرض على صفحة النتيجة وصفحة المسار، فلا بد أن يعمل هنا: رقمٌ معروض
     لا يُطبَّق عند الدفع وعدٌ مكسور. النسبة من مصدر واحد لا من حرفٍ هنا. */
  const promoApplied = isFirstTimePromo(promo);
  const payable = promoApplied ? priceAfterPromo(amount) : amount;
  const cur = useCurrency();
  const fmt = usePriceFormatter();
  /* فتح نافذة الدفع = بدء عملية شراء */
  useEffect(() => { track("checkout_started"); }, []);
  const pay = () => {
    if (card.replace(/\s/g, "").length < 12) return;
    setProcessing(true);
    window.setTimeout(onSuccess, 1600);
  };
  return (
    <Modal onClose={onClose} label={`إتمام الدفع: ${title}`} panelClassName="w-full max-w-md">
      <div className="story-fade rounded-3xl border border-white/10 bg-surface p-7">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-black">
            <CreditCard className="h-5 w-5 text-teal-light-ink" />
            دفع آمن عبر Stripe
          </h3>
          <button onClick={onClose} aria-label="إغلاق نافذة الدفع" className="grid h-11 w-11 place-items-center rounded-full text-white/40 transition hover:bg-white/5 hover:text-white">✕</button>
        </div>
        <p className="mt-2 text-sm text-white/55">{title}</p>
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-white/60">الإجمالي</span>
            <span className="text-3xl font-black text-gold-ink">
              {promoApplied && <span className="me-2 text-lg font-bold text-white/35 line-through">{fmt(amount)}</span>}
              {fmt(payable)}
            </span>
          </div>
          {cur.code !== "USD" && (
            <p className="mt-1 text-left text-[11px] text-white/40">يعادل {payable}$ — التحويل بسعر ثابت للعرض</p>
          )}
          <label className="mt-3 block border-t border-white/5 pt-3">
            <span className="text-[11px] text-white/50">كود الخصم (اختياري)</span>
            <input
              value={promo}
              onChange={(e) => setPromo(e.target.value.toUpperCase())}
              placeholder={FIRST_TIME_PROMO.code}
              dir="ltr"
              maxLength={24}
              className={`mt-1.5 w-full rounded-xl border bg-white/[0.04] px-3 py-2 text-left text-sm tracking-widest placeholder:tracking-normal placeholder:text-white/25 focus:outline-none ${
                promoApplied ? "border-teal-light text-teal-light-ink" : "border-white/15 focus:border-teal-light"
              }`}
            />
            {promoApplied && (
              <span className="mt-1.5 block text-[11px] font-bold text-teal-light-ink">
                طُبِّق خصم {FIRST_TIME_PROMO.percentOff}٪ {FIRST_TIME_PROMO.labelAr}
              </span>
            )}
          </label>
          {/* عملة الدفع — تُختار هنا فقط لحظة الدفع، والافتراضي دينار أردني */}
          <label className="mt-3 flex items-center justify-between gap-3 border-t border-white/5 pt-3 text-[11px] text-white/50">
            <span>عملة الدفع</span>
            <select
              aria-label="عملة الدفع"
              value={cur.code}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="cursor-pointer rounded-lg border border-white/15 bg-transparent px-2 py-1.5 text-xs font-bold text-white/80 outline-none [&>option]:bg-surface"
            >
              {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => (
                <option key={code} value={code}>{CURRENCIES[code].label} ({CURRENCIES[code].symbol})</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 space-y-3">
          <input
            value={card}
            onChange={(e) => setCard(e.target.value.replace(/[^\d]/g, "").replace(/(.{4})/g, "$1 ").trim())}
            placeholder="4242 4242 4242 4242"
            maxLength={19}
            dir="ltr"
            className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-left text-sm placeholder:text-white/30 focus:border-teal-light focus:outline-none"
          />
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="MM / YY" dir="ltr" maxLength={7}
              className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-left text-sm placeholder:text-white/30 focus:border-teal-light focus:outline-none" />
            <input placeholder="CVC" dir="ltr" maxLength={4}
              className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-left text-sm placeholder:text-white/30 focus:border-teal-light focus:outline-none" />
          </div>
        </div>
        <Button
          onClick={pay}
          disabled={processing || card.replace(/\s/g, "").length < 12}
          className="mt-5 h-12 w-full rounded-xl bg-[#635BFF] font-black text-white hover:bg-[#635BFF]/85"
        >
          {processing ? "جارٍ تأكيد الدفع…" : `ادفع ${fmt(payable)} الآن`}
        </Button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-white/40">
          <ShieldCheck className="h-3.5 w-3.5" />
          تشفير كامل · ستصلك رسالة تأكيد على بريدك فور نجاح الدفع
        </p>
      </div>
    </Modal>
  );
}

