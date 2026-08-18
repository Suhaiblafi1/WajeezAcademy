import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  BadgeCheck, CheckCircle2, CreditCard, ReceiptText, RefreshCcw,
} from "lucide-react";
import PortalLayout from "./PortalLayout";
import { toast } from "@/components/Toast";
import { loadOrders, payOrderTest, newIdempotencyKey, type DemoOrder } from "@/data/billing";

const ORDER_STATUS: Record<DemoOrder["status"], { label: string; cls: string }> = {
  paid: { label: "مدفوع", cls: "bg-[#38A7B4]/15 text-[#6EC7D1]" },
  pending: { label: "بانتظار الدفع", cls: "bg-[#FABC05]/15 text-[#FABC05]" },
  refunded: { label: "مسترد", cls: "bg-white/10 text-white/50" },
};
const INVOICE_STATUS: Record<string, { label: string; cls: string }> = {
  paid: { label: "مسددة", cls: "bg-[#38A7B4]/15 text-[#6EC7D1]" },
  open: { label: "مفتوحة", cls: "bg-[#FABC05]/15 text-[#FABC05]" },
  void: { label: "ملغاة", cls: "bg-white/10 text-white/50" },
};

/** فواتيري وطلباتي ودفعاتي — GET /api/learner/orders + دفع اختباري idempotent */
export default function Billing() {
  const [tick, setTick] = useState(0);
  const [paying, setPaying] = useState<string | null>(null);
  /* مفتاح idempotency لكل طلب — يُنشأ مرة ويُعاد استخدامه عند إعادة النقر، تماما كعقد الخادم */
  const [keys, setKeys] = useState<Record<string, string>>({});
  const orders = useMemo(() => loadOrders(), [tick]);

  const pay = (orderId: string) => {
    const key = keys[orderId] ?? newIdempotencyKey();
    setKeys((k) => ({ ...k, [orderId]: key }));
    setPaying(orderId);
    /* محاكاة زمن المزود التجريبي */
    window.setTimeout(() => {
      const res = payOrderTest(orderId, key);
      setPaying(null);
      if (!res) return;
      toast(
        res.alreadyProcessed
          ? "نفس مفتاح العملية — أعاد الخادم النتيجة نفسها دون خصم مكرر (idempotent)."
          : "تم الدفع الاختباري بنجاح — سُددت الفاتورة وفُتح ما يرتبط بها تلقائيا. لا مال حقيقي.",
        res.alreadyProcessed ? "info" : "success"
      );
      setTick((t) => t + 1);
    }, 900);
  };

  const totals = useMemo(() => {
    const paid = orders.reduce((sum, o) => sum + o.invoice.payments.filter((p) => p.status === "success").reduce((s, p) => s + p.amount, 0), 0);
    const due = orders.filter((o) => o.invoice.status === "open").reduce((s, o) => s + o.invoice.amount, 0);
    return { paid, due };
  }, [orders]);

  return (
    <PortalLayout title="طلباتي وفواتيري">
      <p className="mb-5 max-w-2xl rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-6 text-white/55">
        كل عملية شراء لها رقم مرجعي وفاتورة وسجل دفعات — كما يعيدها GET /api/learner/orders.
        الدفع هنا اختباري عبر المزود التجريبي: idempotent بمفتاح عملية، ولا يحرك مالا حقيقيا.
      </p>

      {/* ملخص */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="flex items-center gap-2 text-xs text-white/50"><ReceiptText className="h-4 w-4" /> عدد الطلبات</p>
          <p className="mt-2 text-3xl font-black">{orders.length}</p>
        </div>
        <div className="rounded-2xl border border-[#38A7B4]/30 bg-[#38A7B4]/5 p-5">
          <p className="flex items-center gap-2 text-xs text-[#6EC7D1]"><BadgeCheck className="h-4 w-4" /> إجمالي ما دفعته</p>
          <p className="mt-2 text-3xl font-black text-[#6EC7D1]">{totals.paid}<span className="text-sm text-white/50"> ر.س</span></p>
        </div>
        <div className="rounded-2xl border border-[#FABC05]/30 bg-[#FABC05]/5 p-5">
          <p className="flex items-center gap-2 text-xs text-[#FABC05]"><CreditCard className="h-4 w-4" /> مستحق الآن</p>
          <p className="mt-2 text-3xl font-black text-[#FABC05]">{totals.due}<span className="text-sm text-white/50"> ر.س</span></p>
        </div>
      </div>

      {/* الطلبات */}
      <div className="mt-6 space-y-4">
        {orders.map((o) => (
          <section key={o.id} className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-black">{o.itemName}</p>
                <p className="mt-1 text-[11px] text-white/50">
                  طلب {o.ref} · {o.kind === "pathway" ? "مسار كامل" : "دورة"} · {o.createdAt}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${ORDER_STATUS[o.status].cls}`}>
                {ORDER_STATUS[o.status].label}
              </span>
            </div>

            {/* الفاتورة */}
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <p className="text-white/70">
                  فاتورة <span className="font-bold text-white" dir="ltr">{o.invoice.number}</span> · أُصدرت {o.invoice.issuedAt}
                </p>
                <p className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${INVOICE_STATUS[o.invoice.status].cls}`}>
                    {INVOICE_STATUS[o.invoice.status].label}
                  </span>
                  <span className="text-base font-black">{o.invoice.amount} {o.invoice.currency}</span>
                </p>
              </div>

              {/* الدفعات */}
              {o.invoice.payments.length > 0 && (
                <div className="mt-3 space-y-1.5 border-t border-white/10 pt-3">
                  {o.invoice.payments.map((p) => (
                    <p key={p.id} className="flex items-center gap-2 text-[11px] text-white/55">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#38A7B4]" />
                      دفعة {p.amount} {o.invoice.currency} · {p.method} · {p.at}
                      <span className="text-white/25" dir="ltr">· key: {p.idempotencyKey.slice(0, 18)}…</span>
                    </p>
                  ))}
                </div>
              )}

              {/* دفع اختباري للفواتير المفتوحة */}
              {o.invoice.status === "open" && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => pay(o.id)}
                    disabled={paying === o.id}
                    className="flex cursor-pointer items-center gap-2 rounded-full bg-[#FABC05] px-6 py-2.5 text-sm font-black text-[#0D0D0D] transition hover:bg-[#FABC05]/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {paying === o.id ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                    {paying === o.id ? "جار الدفع عبر المزود التجريبي…" : "ادفع اختباريا — لا مال حقيقي"}
                  </button>
                  <p className="text-[10px] leading-5 text-white/50">
                    مفتاح العملية ثابت لهذه الجلسة — إعادة النقر لا تخصم مرة ثانية (idempotent).
                  </p>
                </div>
              )}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-6 text-center text-xs leading-6 text-white/45">
        لطلب استرداد أو مراجعة فاتورة: <Link to="/contact" className="font-bold text-[#6EC7D1] underline-offset-4 hover:underline">صفحة التواصل</Link> — اختر «طلب استرداد» وسيُعالج بسبب موثق.
      </p>
    </PortalLayout>
  );
}
