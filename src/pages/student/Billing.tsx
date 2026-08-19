/* فواتيري — API حقيقي: طلباتي وفواتيري ودفعاتي واسترداداتي في مكان واحد.
   زر الدفع يتبع المزود الفعال: اختباري = نجاح فوري بلا مال؛ حقيقي = تحويل
   لصفحة دفع مستضافة عند المزود، والتسوية تصل عبر webhook موقَّت لا برجوع المتصفح. */
import { useCallback, useEffect, useState } from "react";
import { CreditCard, Loader2, ReceiptText, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";
import PortalLayout from "./PortalLayout";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { fmtWhen } from "@/utils/format";

interface Payment { id: string; amount: string; status: string; method: string | null; refunds: { id: string; status: string; amount: string }[] }
interface Invoice { id: string; total: string; currency: string; status: string; issuedAt: string; payments: Payment[] }
interface Order {
  id: string; status: string; total: string; currency: string; createdAt: string;
  items: { id: string; titleAr?: string | null; title?: string | null; price?: string | null }[];
  invoice: Invoice | null;
}
interface PaymentProviderInfo { driver: "test" | "manual" | "moyasar" | "stripe" }

const ORDER_STATUS: Record<string, string> = { pending: "بانتظار الدفع", paid: "مدفوع", cancelled: "ملغي", refunded: "مسترد" };
const INV_STATUS: Record<string, string> = { issued: "صادرة", paid: "مدفوعة", partially_refunded: "مستردة جزئيا", refunded: "مستردة كليا", void: "ملغاة" };
const PAY_LABEL: Record<string, string> = {
  test: "ادفع الآن (مزود اختباري — لا مال حقيقي)",
  moyasar: "ادفع الآن — صفحة دفع آمنة (مدى/البطاقات)",
  stripe: "ادفع الآن — صفحة دفع آمنة (Stripe)",
  manual: "الدفع يدوي — حوّل بنكياً ثم أكّد مع المالية",
};

export default function Billing() {
  const [rows, setRows] = useState<Order[]>([]);
  const [provider, setProvider] = useState<PaymentProviderInfo>({ driver: "test" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setRows(await apiGet<Order[]>("/api/learner/orders")); }
    catch (e) { setError(e instanceof ApiError ? e.message : "تعذر تحميل الفواتير"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    apiGet<PaymentProviderInfo>("/api/learner/payment-provider").then(setProvider).catch(() => undefined);
  }, []);

  const pay = async (order: Order) => {
    if (busy) return;
    setBusy(order.id); setFlash("");
    try {
      /* مفتاح idempotency ثابت لكل طلب — إعادة النقر لا تدفع مرتين */
      const res = await apiPost<{ redirectUrl?: string }>(`/api/learner/orders/${order.id}/pay-test`, { idempotencyKey: `pay-${order.id}` });
      /* مزود مستضاف: نحوّل المتعلم لصفحة الدفع عند المزود — التسوية تصل بـ webhook */
      if (res.redirectUrl) { window.location.assign(res.redirectUrl); return; }
      setFlash(provider.driver === "test" ? "تم الدفع الاختباري — فُتح وصولك وتحدثت الفاتورة" : "سُجل الدفع — فُتح وصولك");
      await load();
    } catch (e) { setFlash(e instanceof ApiError ? e.message : "فشل الدفع"); }
    finally { setBusy(null); }
  };

  return (
    <PortalLayout title="فواتيري وطلباتي">
      {flash && <p className="mb-4 rounded-xl border border-[#38A7B4]/40 bg-[#38A7B4]/10 px-4 py-3 text-sm font-bold text-[#6EC7D1]" role="status">{flash}</p>}
      {error && <p className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[#38A7B4]" /></div>
      ) : rows.length === 0 ? (
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-20 text-center">
          <ReceiptText className="h-12 w-12 text-white/20" />
          <h2 className="mt-4 text-xl font-black">لا طلبات بعد</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-white/55">
            عند موافقة العمليات على طلب تسجيلك تُنشأ فاتورة هنا — والدفع يفتح وصولك للمنصة تلقائيا.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((o) => (
            <article key={o.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-black">{o.items.map((i) => i.titleAr ?? i.title ?? "عنصر").join(" · ") || "طلب"}</p>
                  <p className="mt-1 text-xs text-white/50">{fmtWhen(o.createdAt)} · <span dir="ltr" className="font-mono text-[10px]">{o.id.slice(0, 8)}…</span></p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black">{o.total} <span className="text-xs font-normal text-white/50">{o.currency}</span></span>
                  <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${o.status === "paid" ? "border-emerald-400/30 text-emerald-300" : "border-[#FABC05]/40 text-[#FABC05]"}`}>
                    {ORDER_STATUS[o.status] ?? o.status}
                  </span>
                </div>
              </div>

              {o.status === "pending" && provider.driver !== "manual" && (
                <div className="mt-4">
                  <button disabled={busy === o.id} onClick={() => void pay(o)}
                    className="flex cursor-pointer items-center gap-2 rounded-full bg-[#FABC05] px-6 py-2.5 text-xs font-black text-[#0D0D0D] transition hover:bg-[#FABC05]/90 disabled:opacity-40">
                    {busy === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
                    {PAY_LABEL[provider.driver] ?? PAY_LABEL.test}
                  </button>
                  {provider.driver !== "test" && (
                    <p className="mt-2 flex items-center gap-1.5 text-[10px] text-white/45">
                      <ShieldCheck className="h-3 w-3 text-[#38A7B4]" />
                      تُحوَّل لصفحة دفع مستضافة عند المزود — لا تمر بيانات بطاقتك بخوادمنا، ويُفتح وصولك فور تأكيد المزود.
                    </p>
                  )}
                </div>
              )}
              {o.status === "pending" && provider.driver === "manual" && (
                <p className="mt-4 rounded-xl border border-[#FABC05]/30 bg-[#FABC05]/5 px-4 py-2.5 text-xs font-bold text-[#FABC05]">
                  {PAY_LABEL.manual}
                </p>
              )}

              {o.invoice && (
                <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 p-4">
                  <p className="flex items-center justify-between text-xs font-bold text-white/60">
                    <span>الفاتورة — {INV_STATUS[o.invoice.status] ?? o.invoice.status}</span>
                    <span>{o.invoice.total} {o.invoice.currency}</span>
                  </p>
                  {o.invoice.payments.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {o.invoice.payments.map((p) => (
                        <li key={p.id} className="flex flex-wrap items-center gap-2 text-[11px] text-white/55">
                          <CreditCard className="h-3 w-3 text-white/30" />
                          دفعة {p.amount} {o.invoice!.currency} — {p.status === "succeeded" ? "ناجحة" : p.status === "pending" ? "بانتظار تأكيد المزود" : p.status}
                          {p.method && <span className="text-white/40">({p.method})</span>}
                          {p.refunds.map((r) => (
                            <span key={r.id} className="flex items-center gap-1 rounded-full border border-[#FABC05]/30 px-2 py-0.5 text-[10px] text-[#FABC05]">
                              <RotateCcw className="h-2.5 w-2.5" /> استرداد {r.amount} — {r.status}
                            </span>
                          ))}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <button onClick={() => void load()} className="mt-6 flex cursor-pointer items-center gap-1.5 text-xs text-white/50 hover:text-white">
        <RefreshCw className="h-3.5 w-3.5" /> تحديث
      </button>
    </PortalLayout>
  );
}
