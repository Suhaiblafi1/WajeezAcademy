/* فواتيري — API حقيقي: طلباتي وفواتيري ودفعاتي واسترداداتي في مكان واحد.
   زر الدفع يتبع المزود الفعال: اختباري = نجاح فوري بلا مال؛ حقيقي = تحويل
   لصفحة دفع مستضافة عند المزود، والتسوية تصل عبر webhook موقَّت لا برجوع المتصفح. */
import { useCallback, useEffect, useState } from "react";
import { CircleSlash, CreditCard, Loader2, ReceiptText, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";
import PortalLayout from "./PortalLayout";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { fmtWhen } from "@/utils/format";
import { toast, toastError } from '@/components/Toast';

interface Payment { id: string; amount: string; status: string; method: string | null; refunds: { id: string; status: string; amount: string }[] }
interface Invoice { id: string; total: string; currency: string; status: string; issuedAt: string; payments: Payment[] }
interface Order {
  id: string; status: string; total: string; currency: string; createdAt: string;
  items: { id: string; titleAr?: string | null; title?: string | null; price?: string | null }[];
  invoice: Invoice | null;
}
interface PaymentProviderInfo { driver: "test" | "manual" | "moyasar" | "stripe" }

/* حالاتُ الطلب بأسمائها كما يكتبها الخادم.

   كان المفتاحُ هنا `pending` والخادمُ يكتب `pending_payment` (المخطَّط:
   `Order.status @default("pending_payment")`) — فيقرأ المتعلّمُ في شاشته
   `pending_payment` بالإنجليزيّة، و**زرّ إكمال الدفع لا يُعرض أصلا** لأنّ
   شرطَه لا يتحقّق. أي أنّ طلبا لم يكتمل دفعُه لم يكن له طريقٌ يُكمل به —
   بينما «تعلّمي» تحيل إليه: «أكمل الدفع متى شئت من الفواتير». */
const ORDER_STATUS: Record<string, string> = {
  pending_payment: "بانتظار الدفع",
  pending: "بانتظار الدفع",
  paid: "مدفوع",
  cancelled: "ملغي",
  partially_refunded: "مسترد جزئيا",
  refunded: "مسترد",
};

/** أطلبٌ لم يكتمل دفعُه؟ — الاسمان مقبولان فلا تُكسر الشاشة بتسميةٍ واحدة */
const isUnpaid = (status: string) => status === "pending_payment" || status === "pending";
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
    setBusy(order.id);
    try {
      /* مفتاح idempotency للمحاولة لا للطلب.

         كان `pay-${order.id}` ثابتا للطلب كلِّه: فمن غادر صفحةَ الدفع
         المستضافة بلا إتمام تُسجَّل له دفعةٌ `pending`، ثمّ لا يعيده هذا
         الزرُّ إليها أبدا — `payOrder` يرى المفتاح مستعملا فيُعيد الدفعةَ
         القديمة بلا `redirectUrl`، فلا يقع شيء. فيُبنى المفتاحُ على عدد
         محاولاتِ هذه الفاتورة: نقرةٌ مزدوجةٌ في نفس اللحظة تُعيد المفتاح
         نفسَه (فلا دفعتان)، ومحاولةٌ جديدةٌ بعد دفعةٍ معلّقة تأخذ مفتاحا
         جديدا فتُفتح لها صفحةُ دفعٍ جديدة. */
      const attempt = order.invoice?.payments.length ?? 0;
      const res = await apiPost<{ redirectUrl?: string }>(`/api/learner/orders/${order.id}/pay`, {
        idempotencyKey: `pay-${order.id}-${attempt}`,
      });
      /* مزود مستضاف: نحوّل المتعلم لصفحة الدفع عند المزود — التسوية تصل بـ webhook */
      if (res.redirectUrl) { window.location.assign(res.redirectUrl); return; }
      toast(provider.driver === "test" ? "تم الدفع الاختباري — فُتح وصولك وتحدثت الفاتورة" : "سُجل الدفع — فُتح وصولك");
      await load();
    } catch (e) { toastError(e instanceof ApiError ? e.message : "فشل الدفع"); }
    finally { setBusy(null); }
  };

  /* الإلغاءُ قبل الدفع — البابُ الآخر لمقعدٍ محجوز.

     الحجزُ يُقفل شراءً ثانيا على الشعبة نفسِها حتّى لا يُدفع ثمنُها مرّتين،
     فلا بدّ لصاحب الطلب من مفتاح: إمّا يُكمل دفعه، وإمّا يُلغيه فيُفرَج عن
     مقعده. وبلا هذا يبقى طلبٌ متروكٌ قافلا شعبةً لا يشتريها ولا يتركها. */
  const cancel = async (order: Order) => {
    if (busy) return;
    setBusy(order.id);
    try {
      await apiPost(`/api/learner/orders/${order.id}/cancel`, {});
      toast("أُلغي طلبك وفُكّ حجزُ مقعدك — يمكنك الشراء من جديد متى شئت");
      await load();
    } catch (e) { toastError(e instanceof ApiError ? e.message : "تعذّر إلغاء الطلب"); }
    finally { setBusy(null); }
  };

  return (
    <PortalLayout title="فواتيري وطلباتي">
      {error && <p className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-teal-ink" /></div>
      ) : rows.length === 0 ? (
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-20 text-center">
          <ReceiptText className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-xl font-black">لا طلبات بعد</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">
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
                  <p className="mt-1 text-xs text-muted-foreground">{fmtWhen(o.createdAt)} · <span dir="ltr" className="font-mono text-micro">{o.id.slice(0, 8)}…</span></p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black">{o.total} <span className="text-xs font-normal text-muted-foreground">{o.currency}</span></span>
                  <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${o.status === "paid" ? "border-emerald-400/30 text-emerald-300" : "border-gold/40 text-gold-ink"}`}>
                    {ORDER_STATUS[o.status] ?? o.status}
                  </span>
                </div>
              </div>

              {isUnpaid(o.status) && provider.driver !== "manual" && (
                <div className="mt-4">
                  <button disabled={busy === o.id} onClick={() => void pay(o)}
                    className="flex cursor-pointer items-center gap-2 rounded-full bg-gold px-6 py-2.5 text-xs font-black text-on-gold transition hover:bg-gold/90 disabled:opacity-40">
                    {busy === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
                    {PAY_LABEL[provider.driver] ?? PAY_LABEL.test}
                  </button>
                  {provider.driver !== "test" && (
                    <p className="mt-2 flex items-center gap-1.5 text-micro text-muted-foreground">
                      <ShieldCheck className="h-3 w-3 text-teal-ink" />
                      تُحوَّل لصفحة دفع مستضافة عند المزود — لا تمر بيانات بطاقتك بخوادمنا، ويُفتح وصولك فور تأكيد المزود.
                    </p>
                  )}
                </div>
              )}
              {isUnpaid(o.status) && (
                <button disabled={busy === o.id} onClick={() => void cancel(o)}
                  className="mt-3 flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-4 py-1.5 text-[11px] font-bold text-muted-foreground transition hover:border-white/40 disabled:opacity-40">
                  <CircleSlash className="h-3 w-3" /> ألغِ الطلب وافكّ حجز مقعدي
                </button>
              )}
              {isUnpaid(o.status) && provider.driver === "manual" && (
                <p className="mt-4 rounded-xl border border-gold/30 bg-gold/5 px-4 py-2.5 text-xs font-bold text-gold-ink">
                  {PAY_LABEL.manual}
                </p>
              )}

              {o.invoice && (
                <div className="mt-4 rounded-2xl border border-white/8 bg-paper/20 p-4">
                  <p className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                    <span>الفاتورة — {INV_STATUS[o.invoice.status] ?? o.invoice.status}</span>
                    <span>{o.invoice.total} {o.invoice.currency}</span>
                  </p>
                  {o.invoice.payments.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {o.invoice.payments.map((p) => (
                        <li key={p.id} className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <CreditCard className="h-3 w-3 text-muted-foreground/50" />
                          دفعة {p.amount} {o.invoice!.currency} — {p.status === "succeeded" ? "ناجحة" : p.status === "pending" ? "بانتظار تأكيد المزود" : p.status}
                          {p.method && <span className="text-muted-foreground">({p.method})</span>}
                          {p.refunds.map((r) => (
                            <span key={r.id} className="flex items-center gap-1 rounded-full border border-gold/30 px-2 py-0.5 text-micro text-gold-ink">
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

      <button onClick={() => void load()} className="mt-6 flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <RefreshCw className="h-3.5 w-3.5" /> تحديث
      </button>
    </PortalLayout>
  );
}
