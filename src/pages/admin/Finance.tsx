/* المالية — API حقيقي: طلبات التسجيل (موافقة بكوبون/رفض)، فواتير ودفعات يدوية
   واستردادات، كوبونات، خطط اشتراك. */
import { useCallback, useEffect, useState } from "react";
import {
  BadgePercent, CheckCircle2, CreditCard, FileText, Loader2, RefreshCw,
  RotateCcw, ServerOff, Wallet, XCircle,
} from "lucide-react";
import AdminLayout from "./AdminLayout";
import FlowSteps from "@/components/FlowSteps";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { useAutoRefresh } from "@/services/useAutoRefresh";
import { fmtDate, fmtDateTime } from "@/application/text/format-ar";

const inputCls = "rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/25 focus:border-teal focus:outline-none";

interface EnrollReq {
  id: string; status: string; note: string | null; createdAt: string;
  user: { displayName: string; email: string };
  cohort: { id: string; title: string; price: string | null; course: { versions: { titleAr: string }[] } };
}
interface Invoice {
  id: string; status: string; total: string; currency: string; issuedAt: string;
  order: { user: { displayName: string; email: string }; items: { title?: string; titleAr?: string }[] };
  payments: { id: string; amount: string; status: string; method?: string | null; refunds: { id: string }[] }[];
}
interface Refund { id: string; status: string; amount: string; reason: string; createdAt: string; payment: { id: string; invoice: { id: string } } }
interface Coupon { id: string; code: string; percentOff: number | null; amountOff: string | null; currency: string; maxUses: number | null; usedCount?: number; active: boolean; expiresAt: string | null }

const ER_STATUS: Record<string, string> = { pending: "بانتظار المراجعة", seat_held: "مقعد محجوز", approved: "موافق عليه", converted: "تحوّل إلى تسجيل ✓", rejected: "مرفوض", expired: "منتهي" };
const INV_STATUS: Record<string, string> = { issued: "صادرة", paid: "مدفوعة", partially_refunded: "مستردة جزئيا", refunded: "مستردة", void: "ملغاة" };
const RF_STATUS: Record<string, string> = { requested: "مطلوب", approved: "منفذ", rejected: "مرفوض" };

type Tab = "requests" | "invoices" | "refunds" | "coupons";

export default function Finance() {
  const [tab, setTab] = useState<Tab>("requests");
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState<string | null>(null);
  const [flash, setFlash] = useState("");
  const [busy, setBusy] = useState(false);
  const [requests, setRequests] = useState<EnrollReq[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponForm, setCouponForm] = useState({ code: "", percentOff: "", amountOff: "", maxUses: "", expiresAt: "" });
  const [planForm, setPlanForm] = useState({ code: "", nameAr: "", price: "", intervalMonths: "1", features: "" });
  const [couponFor, setCouponFor] = useState<Record<string, string>>({});
  const [payForm, setPayForm] = useState<Record<string, string>>({});
  const [refundForm, setRefundForm] = useState<Record<string, { amount: string; reason: string }>>({});

  const load = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); setOffline(null); }
    try {
      const [er, inv, rf, cp] = await Promise.all([
        apiGet<EnrollReq[]>("/api/admin/enrollment-requests"),
        apiGet<Invoice[]>("/api/admin/invoices"),
        apiGet<Refund[]>("/api/admin/refunds"),
        apiGet<Coupon[]>("/api/admin/coupons"),
      ]);
      setRequests(er); setInvoices(inv); setRefunds(rf); setCoupons(cp);
    } catch (e) { if (!silent) setOffline(e instanceof ApiError ? e.message : "الخادم غير متصل"); }
    finally { if (!silent) setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  /* نبض صامت كل دقيقة — طلبات التسجيل والفواتير تتحدث دون تحديث يدوي */
  const silentReload = useCallback(() => { void load(true); }, [load]);
  useAutoRefresh(silentReload, 60_000);

  const act = async (fn: () => Promise<unknown>, doneMsg: string) => {
    if (busy) return;
    setBusy(true); setFlash("");
    try { await fn(); setFlash(doneMsg); await load(); }
    catch (e) { setFlash(e instanceof ApiError ? e.message : "فشل الإجراء"); }
    finally { setBusy(false); }
  };

  if (offline) {
    return (
      <AdminLayout title="المالية">
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-20 text-center">
          <ServerOff className="h-12 w-12 text-white/20" />
          <p className="mt-4 max-w-md text-sm text-white/55">{offline}</p>
          <button onClick={() => void load()} className="mt-5 flex cursor-pointer items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-xs font-bold text-white/70 hover:border-white/40">
            <RefreshCw className="h-3.5 w-3.5" /> إعادة المحاولة
          </button>
        </div>
      </AdminLayout>
    );
  }

  const tabs: [Tab, string, number][] = [
    ["requests", "طلبات التسجيل", requests.filter((r) => r.status === "pending").length],
    ["invoices", "الفواتير", invoices.length],
    ["refunds", "الاستردادات", refunds.filter((r) => r.status === "requested").length],
    ["coupons", "الكوبونات والخطط", coupons.length],
  ];

  return (
    <AdminLayout title="المالية — طلبات وفواتير واستردادات وكوبونات">
      <FlowSteps steps={[
        { label: "طلب تسجيل", actor: "الطالب" },
        { label: "مراجعة وموافقة أو اعتذار", actor: "أنت هنا" },
        { label: "فاتورة تُصدر", actor: "النظام تلقائياً" },
        { label: "الدفع يُسجَّل", actor: "أنت أو بوابة الدفع" },
        { label: "المنصة تُفتح للطالب", actor: "تلقائي فور الدفع" },
      ]} />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap rounded-full border border-white/15 p-1">
          {tabs.map(([k, label, n]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`cursor-pointer rounded-full px-4 py-1.5 text-xs font-black transition ${tab === k ? "bg-gold text-on-gold" : "text-white/60 hover:text-white"}`}>
              {label} {n > 0 && <span className="mr-1 opacity-70">({n})</span>}
            </button>
          ))}
        </div>
        <button onClick={() => void load()} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-white/60 hover:border-white/40">
          <RefreshCw className="h-3.5 w-3.5" /> تحديث
        </button>
        {flash && <span className="text-xs font-bold text-teal-light-ink" role="status">{flash}</span>}
      </div>

      {loading && <div className="grid place-items-center py-16"><Loader2 className="h-8 w-8 animate-spin text-white/30" /></div>}

      {/* طلبات التسجيل */}
      {!loading && tab === "requests" && (
        <div className="space-y-3">
          {requests.length === 0 && <p className="rounded-3xl border border-white/10 bg-white/[0.02] py-16 text-center text-sm text-white/45">لا طلبات تسجيل.</p>}
          {requests.map((r) => (
            <div key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-black">{r.user.displayName} <span className="text-[11px] font-normal text-white/40" dir="ltr">{r.user.email}</span></p>
                  <p className="mt-1 text-xs text-white/55">
                    {r.cohort.course.versions[0]?.titleAr ?? "—"} · {r.cohort.title} · {r.cohort.price ? `${r.cohort.price} د.أ` : "بلا سعر"}
                  </p>
                  {r.note && <p className="mt-1 text-[11px] text-white/45">ملاحظة المتعلم: {r.note}</p>}
                </div>
                <span className="rounded-full border border-teal/40 px-3 py-1 text-[11px] font-bold text-teal-light-ink">{ER_STATUS[r.status] ?? r.status}</span>
              </div>
              {r.status === "pending" && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/8 pt-3">
                  <input value={couponFor[r.id] ?? ""} onChange={(e) => setCouponFor({ ...couponFor, [r.id]: e.target.value })}
                    placeholder="كوبون (اختياري)" dir="ltr" className={`${inputCls} w-32 font-mono`} />
                  <button disabled={busy}
                    onClick={() => act(() => apiPost(`/api/admin/enrollment-requests/${r.id}/approve`, { couponCode: couponFor[r.id] || undefined }), "وُوفق: حُجز المقعد وأُنشئت الفاتورة")}
                    className="flex cursor-pointer items-center gap-1.5 rounded-full bg-teal px-4 py-1.5 text-xs font-black text-on-teal hover:bg-teal-light disabled:opacity-40">
                    <CheckCircle2 className="h-3.5 w-3.5" /> موافقة وحجز مقعد
                  </button>
                  <button disabled={busy}
                    onClick={() => {
                      const reason = window.prompt("سبب الرفض (5+ أحرف):");
                      if (reason && reason.length >= 5) void act(() => apiPost(`/api/admin/enrollment-requests/${r.id}/reject`, { reason }), "رُفض الطلب");
                    }}
                    className="flex cursor-pointer items-center gap-1.5 rounded-full border border-red-500/40 px-4 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/10 disabled:opacity-40">
                    <XCircle className="h-3.5 w-3.5" /> رفض
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* الفواتير */}
      {!loading && tab === "invoices" && (
        <div className="space-y-3">
          {invoices.length === 0 && <p className="rounded-3xl border border-white/10 bg-white/[0.02] py-16 text-center text-sm text-white/45">لا فواتير.</p>}
          {invoices.map((inv) => (
            <div key={inv.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-black">{inv.total} {inv.currency} <span className="mr-2 font-mono text-[10px] font-normal text-white/40" dir="ltr">{inv.id.slice(0, 8)}…</span></p>
                  <p className="mt-1 text-xs text-white/55">{inv.order.user.displayName} · {fmtDate(new Date(inv.issuedAt))}</p>
                </div>
                <span className="rounded-full border border-teal/40 px-3 py-1 text-[11px] font-bold text-teal-light-ink">{INV_STATUS[inv.status] ?? inv.status}</span>
              </div>
              {inv.status === "issued" && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/8 pt-3">
                  <input value={payForm[inv.id] ?? ""} onChange={(e) => setPayForm({ ...payForm, [inv.id]: e.target.value })}
                    placeholder="طريقة الدفع — تحويل بنكي / كاش" className={`${inputCls} flex-1`} />
                  <button disabled={busy || (payForm[inv.id] ?? "").length < 3}
                    onClick={() => act(() => apiPost(`/api/admin/invoices/${inv.id}/manual-payment`, { methodNote: payForm[inv.id] }), "سُجلت الدفعة اليدوية الموثقة")}
                    className="flex cursor-pointer items-center gap-1.5 rounded-full bg-teal px-4 py-1.5 text-xs font-black text-on-teal hover:bg-teal-light disabled:opacity-40">
                    <CreditCard className="h-3.5 w-3.5" /> تسجيل دفعة يدوية
                  </button>
                </div>
              )}
              {inv.payments.filter((p) => p.status === "succeeded").map((p) => (
                <div key={p.id} className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-white/8 bg-black/20 p-3 text-xs">
                  <span className="font-bold text-emerald-300">دفعة ناجحة {p.amount} {inv.currency}</span>
                  <span className="text-white/40">{p.refunds.length} استرداد</span>
                  <input value={refundForm[p.id]?.amount ?? ""} onChange={(e) => setRefundForm({ ...refundForm, [p.id]: { ...refundForm[p.id], amount: e.target.value, reason: refundForm[p.id]?.reason ?? "" } })}
                    placeholder="مبلغ" type="number" className={`${inputCls} w-24`} />
                  <input value={refundForm[p.id]?.reason ?? ""} onChange={(e) => setRefundForm({ ...refundForm, [p.id]: { ...refundForm[p.id], reason: e.target.value, amount: refundForm[p.id]?.amount ?? "" } })}
                    placeholder="سبب موثق (5+ أحرف)" className={`${inputCls} flex-1`} />
                  <button disabled={busy || (refundForm[p.id]?.reason ?? "").length < 5 || !Number(refundForm[p.id]?.amount)}
                    onClick={() => act(() => apiPost(`/api/admin/payments/${p.id}/refund`, { amount: Number(refundForm[p.id].amount), reason: refundForm[p.id].reason }), "قُدم طلب الاسترداد")}
                    className="flex cursor-pointer items-center gap-1 rounded-full border border-gold/40 px-3 py-1 text-[10px] font-bold text-gold-ink disabled:opacity-40">
                    <RotateCcw className="h-3 w-3" /> طلب استرداد
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* الاستردادات */}
      {!loading && tab === "refunds" && (
        <div className="space-y-3">
          {refunds.length === 0 && <p className="rounded-3xl border border-white/10 bg-white/[0.02] py-16 text-center text-sm text-white/45">لا طلبات استرداد.</p>}
          {refunds.map((rf) => (
            <div key={rf.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div>
                <p className="font-black">{rf.amount} <span className="text-xs font-normal text-white/50">— {rf.reason}</span></p>
                <p className="mt-1 text-[11px] text-white/45">{fmtDateTime(new Date(rf.createdAt))}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-teal/40 px-3 py-1 text-[11px] font-bold text-teal-light-ink">{RF_STATUS[rf.status] ?? rf.status}</span>
                {rf.status === "requested" && (
                  <>
                    <button disabled={busy} onClick={() => act(() => apiPost(`/api/admin/refunds/${rf.id}/process`, { approve: true }), "نُفذ الاسترداد وحُدثت الدفعة والطلب")}
                      className="cursor-pointer rounded-full bg-emerald-500/20 border border-emerald-400/40 px-4 py-1.5 text-xs font-bold text-emerald-300 disabled:opacity-40">
                      تنفيذ
                    </button>
                    <button disabled={busy} onClick={() => act(() => apiPost(`/api/admin/refunds/${rf.id}/process`, { approve: false, note: "مرفوض من المالية" }), "رُفض الاسترداد")}
                      className="cursor-pointer rounded-full border border-red-500/40 px-4 py-1.5 text-xs font-bold text-red-400 disabled:opacity-40">
                      رفض
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* الكوبونات والخطط */}
      {!loading && tab === "coupons" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="flex items-center gap-2 text-sm font-black"><BadgePercent className="h-4 w-4 text-gold-ink" /> كوبون جديد</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })} placeholder="الرمز — WAJEEZ20" dir="ltr" className={`${inputCls} font-mono`} />
              <input type="number" min={1} max={100} value={couponForm.percentOff} onChange={(e) => setCouponForm({ ...couponForm, percentOff: e.target.value })} placeholder="خصم %" className={inputCls} />
              <input type="number" min={0.5} value={couponForm.amountOff} onChange={(e) => setCouponForm({ ...couponForm, amountOff: e.target.value })} placeholder="أو مبلغ ثابت (د.أ)" className={inputCls} />
              <input type="number" min={1} value={couponForm.maxUses} onChange={(e) => setCouponForm({ ...couponForm, maxUses: e.target.value })} placeholder="أقصى استخدام" className={inputCls} />
              <input type="date" value={couponForm.expiresAt} onChange={(e) => setCouponForm({ ...couponForm, expiresAt: e.target.value })} className={inputCls} />
            </div>
            <button disabled={busy || couponForm.code.length < 3 || (!couponForm.percentOff && !couponForm.amountOff)}
              onClick={() => act(async () => {
                await apiPost("/api/admin/coupons", {
                  code: couponForm.code,
                  percentOff: couponForm.percentOff ? Number(couponForm.percentOff) : undefined,
                  amountOff: couponForm.amountOff ? Number(couponForm.amountOff) : undefined,
                  maxUses: couponForm.maxUses ? Number(couponForm.maxUses) : undefined,
                  expiresAt: couponForm.expiresAt ? new Date(couponForm.expiresAt) : undefined,
                });
                setCouponForm({ code: "", percentOff: "", amountOff: "", maxUses: "", expiresAt: "" });
              }, "أُنشئ الكوبون")}
              className="mt-3 cursor-pointer rounded-full bg-gold px-5 py-2 text-xs font-black text-on-gold disabled:opacity-40">
              أنشئ الكوبون
            </button>
            <ul className="mt-4 space-y-2">
              {coupons.map((c) => (
                <li key={c.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs">
                  <span className="font-mono font-bold text-gold-ink" dir="ltr">{c.code}</span>
                  <span className="text-white/60">{c.percentOff ? `${c.percentOff}%` : `${c.amountOff} ${c.currency}`}</span>
                  <span className="text-white/40">{c.usedCount ?? 0}/{c.maxUses ?? "∞"}</span>
                  {!c.active && <span className="rounded-full border border-red-500/40 px-2 py-0.5 text-[10px] text-red-400">معطل</span>}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="flex items-center gap-2 text-sm font-black"><Wallet className="h-4 w-4 text-gold-ink" /> خطة اشتراك جديدة</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input value={planForm.code} onChange={(e) => setPlanForm({ ...planForm, code: e.target.value })} placeholder="الرمز — monthly" dir="ltr" className={`${inputCls} font-mono`} />
              <input value={planForm.nameAr} onChange={(e) => setPlanForm({ ...planForm, nameAr: e.target.value })} placeholder="اسم الخطة" className={inputCls} />
              <input type="number" min={0} value={planForm.price} onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })} placeholder="السعر (د.أ)" className={inputCls} />
              <input type="number" min={1} value={planForm.intervalMonths} onChange={(e) => setPlanForm({ ...planForm, intervalMonths: e.target.value })} placeholder="كل كم شهر" className={inputCls} />
              <input value={planForm.features} onChange={(e) => setPlanForm({ ...planForm, features: e.target.value })} placeholder="مزايا مفصولة بفاصلة" className={`${inputCls} sm:col-span-2`} />
            </div>
            <button disabled={busy || planForm.code.length < 2 || planForm.nameAr.length < 3 || !planForm.price}
              onClick={() => act(async () => {
                await apiPost("/api/admin/subscription-plans", {
                  code: planForm.code, nameAr: planForm.nameAr, price: Number(planForm.price),
                  intervalMonths: Number(planForm.intervalMonths) || 1,
                  features: planForm.features ? planForm.features.split(/[،,]/).map((f) => f.trim()).filter(Boolean) : undefined,
                });
                setPlanForm({ code: "", nameAr: "", price: "", intervalMonths: "1", features: "" });
              }, "أُنشئت الخطة وأصبحت عامة فورا")}
              className="mt-3 cursor-pointer rounded-full bg-gold px-5 py-2 text-xs font-black text-on-gold disabled:opacity-40">
              أنشئ الخطة
            </button>
            <p className="mt-3 flex items-center gap-1.5 text-[10px] text-white/40">
              <FileText className="h-3 w-3" /> الخطط الفعالة تظهر للعامة عبر /api/public/subscription-plans
            </p>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
