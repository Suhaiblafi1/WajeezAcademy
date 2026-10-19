/* فواتيري — API حقيقي: طلباتي وفواتيري ودفعاتي واسترداداتي في مكان واحد.
   زر الدفع يتبع المزود الفعال: اختباري = نجاح فوري بلا مال؛ حقيقي = تحويل
   لصفحة دفع مستضافة عند المزود، والتسوية تصل عبر webhook موقَّت لا برجوع المتصفح. */
import { useCallback, useEffect, useState } from "react";
import { CircleSlash, CreditCard, Loader2, ReceiptText, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";
import PortalLayout from "./PortalLayout";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { fmtWhen } from "@/utils/format";
import { fmtSession } from "@/application/text/format-ar";
import { toast, toastError } from '@/components/Toast';

import { Card, Inset, Panel } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
/* ═══ وأسماءُ الحقول كما يكتبها الخادم (١٩ أكتوبر ٢٠٢٦) ═══
   كانت الشاشةُ تقرأ `invoice.total` و`payment.method` — والمخطّطُ يكتب `amount` و`provider`/`methodNote`
   (`prisma/schema.prisma`). فكان سطرُ الفاتورة بلا مبلغ، وطريقةُ الدفع لا تُرى أبدا. */
interface Payment { id: string; amount: string; status: string; provider: string; methodNote: string | null; refunds: { id: string; status: string; amount: string }[] }
interface Invoice { id: string; number: string; amount: string; currency: string; status: string; issuedAt: string; payments: Payment[] }
interface Order {
  id: string; status: string; total: string; currency: string; createdAt: string;
  items: { id: string; titleAr?: string | null; title?: string | null; price?: string | null }[];
  invoice: Invoice | null;
  /** آخرُ لحظةٍ للدفع قبل أن يُفرَج عن المقعد — من الخادم (`seat-hold.ts`)، ولما لم يُدفع وحدَه */
  payBy?: string | null;
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
/* وحالاتُ الدفعة والردّ بالعربيّة — كانت تُطبع كما هي: failed وrefunded وpending وprocessed */
const PAYMENT_STATUS: Record<string, string> = {
  succeeded: "ناجحة", pending: "بانتظار تأكيد المزود", failed: "لم تنجح",
  partially_refunded: "رد جزء منها", refunded: "ردت كلها",
};
const REFUND_STATUS: Record<string, string> = { pending: "قيد المراجعة", processed: "أعيد المبلغ", rejected: "لم يقبل" };
const PROVIDER_AR: Record<string, string> = { test: "تجريبي", manual: "يدوي", moyasar: "بطاقة", stripe: "بطاقة" };
const INV_STATUS: Record<string, string> = { issued: "صادرة", paid: "مدفوعة", partially_refunded: "مستردة جزئيا", refunded: "مستردة كليا", void: "ملغاة" };
const PAY_LABEL: Record<string, string> = {
  test: "ادفع الآن (مزود اختباري — لا مال حقيقي)",
  moyasar: "ادفع الآن — صفحة دفع آمنة (مدى/البطاقات)",
  stripe: "ادفع الآن — صفحة دفع آمنة (Stripe)",
  manual: "الدفع يدوي — حوّل بنكيا ثم أكّد مع المالية",
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
      toast(provider.driver === "test" ? "تم الدفع الاختباري — فتح وصولك" : "سجل الدفع — فتح وصولك");
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
      toast("ألغي طلبك وفكّ حجز مقعدك");
      await load();
    } catch (e) { toastError(e instanceof ApiError ? e.message : "تعذّر إلغاء الطلب"); }
    finally { setBusy(null); }
  };

  return (
    <PortalLayout title="فواتيري وطلباتي">
      {error && <Inset as="p" tone="danger" className="mb-4 px-4 py-3 text-sm text-red-200">{error}</Inset>}

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-teal-ink" /></div>
      ) : rows.length === 0 ? (
        <Panel className="grid place-items-center py-20 text-center">
          <ReceiptText className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-xl font-black">لا طلبات بعد</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">
            تظهر هنا فاتورة كل دورة تسجل فيها، ودفعها يفتح وصولك تلقائيا.
          </p>
        </Panel>
      ) : (
        <div className="space-y-4">
          {rows.map((o) => (
            <Panel as="article" key={o.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-black">{o.items.map((i) => i.titleAr ?? i.title ?? "عنصر").join(" · ") || "طلب"}</p>
                  <p className="mt-1 text-read leading-5 text-muted-foreground">{fmtWhen(o.createdAt)} · <span dir="ltr" className="font-mono text-fine">{o.invoice?.number ?? `${o.id.slice(0, 8)}…`}</span></p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black">{o.total} <span className="text-xs font-normal text-muted-foreground">{o.currency}</span></span>
                  <span className={`rounded-full border px-3 py-1 text-fine font-bold ${o.status === "paid" ? "border-emerald-400/30 text-emerald-300" : "border-gold/40 text-gold-ink"}`}>
                    {ORDER_STATUS[o.status] ?? o.status}
                  </span>
                </div>
              </div>

              {/* والمهلةُ تُقال (١٩ أكتوبر ٢٠٢٦): ساعةٌ لمن اشترى بنفسه، ويومان لما حجزه الفريق —
                  وبعدها يُلغى الطلبُ ويُفرَج عن المقعد. وكان يُلغى ولا يُقال متى */}
              {isUnpaid(o.status) && o.payBy && (
                <p className="mt-3 text-read leading-6 font-bold text-gold-ink">
                  ادفع قبل {fmtSession(o.payBy)}، وبعدها يفرج عن المقعد لغيرك.
                </p>
              )}
              {isUnpaid(o.status) && provider.driver !== "manual" && (
                <div className="mt-4">
                  <Button tone="primary" disabled={busy === o.id} onClick={() => void pay(o)}>
                    {busy === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
                    {PAY_LABEL[provider.driver] ?? PAY_LABEL.test}
                  </Button>
                  {provider.driver !== "test" && (
                    <p className="mt-2 flex items-center gap-1.5 text-read text-muted-foreground">
                      <ShieldCheck className="h-3 w-3 text-teal-ink" />
                      تدفع في صفحة المزود — بطاقتك لا تمر بخوادمنا، ويفتح وصولك فور تأكيده.
                    </p>
                  )}
                </div>
              )}
              {isUnpaid(o.status) && (
                <Button tone="secondary" size="sm" disabled={busy === o.id} onClick={() => void cancel(o)} className="mt-3">
                  <CircleSlash className="h-3 w-3" /> ألغ الطلب وفكّ حجز مقعدي
                </Button>
              )}
              {isUnpaid(o.status) && provider.driver === "manual" && (
                <Inset as="p" tone="warn" className="mt-4 px-4 py-2.5 text-read leading-5 font-bold text-gold-ink">
                  {PAY_LABEL.manual}
                </Inset>
              )}

              {o.invoice && (
                <Card className="mt-4 bg-paper/20">
                  <p className="flex items-center justify-between text-read leading-5 font-bold text-muted-foreground">
                    <span>الفاتورة — {INV_STATUS[o.invoice.status] ?? o.invoice.status}</span>
                    <span>{o.invoice.amount} {o.invoice.currency}</span>
                  </p>
                  {o.invoice.payments.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {o.invoice.payments.map((p) => (
                        <li key={p.id} className="flex flex-wrap items-center gap-2 text-read text-muted-foreground">
                          <CreditCard className="h-3 w-3 text-muted-foreground/50" />
                          دفعة {p.amount} {o.invoice!.currency} — {PAYMENT_STATUS[p.status] ?? "حالها غير معروفة"}
                          <span className="text-muted-foreground">({p.methodNote || PROVIDER_AR[p.provider] || "دفع"})</span>
                          {p.refunds.map((r) => (
                            <span key={r.id} className="flex items-center gap-1 rounded-full border border-gold/30 px-2 py-0.5 text-fine text-gold-ink">
                              <RotateCcw className="h-2.5 w-2.5" /> استرداد {r.amount} — {REFUND_STATUS[r.status] ?? "حاله غير معروف"}
                            </span>
                          ))}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              )}
            </Panel>
          ))}
        </div>
      )}

      <button onClick={() => void load()} className="mt-6 flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <RefreshCw className="h-3.5 w-3.5" /> تحديث
      </button>
    </PortalLayout>
  );
}
