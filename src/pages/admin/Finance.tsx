import { useMemo, useState } from "react";
import { BadgePercent, CheckCircle2, CreditCard, FileText, RotateCcw, Wallet } from "lucide-react";
import AdminLayout from "./AdminLayout";
import { adminIdentity } from "./admin-identity";
import {
  addCoupon, addPlan, loadCoupons, loadEnrollmentRequests, loadInvoices, loadPlans, loadRefunds,
  updateEnrollmentRequest, updateRefund,
} from "@/data/admin-extras";

type Tab = "requests" | "invoices" | "refunds" | "coupons" | "plans";

const TABS: { key: Tab; label: string; icon: typeof Wallet }[] = [
  { key: "requests", label: "طلبات التسجيل", icon: FileText },
  { key: "invoices", label: "الفواتير والدفعات", icon: CreditCard },
  { key: "refunds", label: "الاستردادات", icon: RotateCcw },
  { key: "coupons", label: "الكوبونات", icon: BadgePercent },
  { key: "plans", label: "خطط الاشتراك", icon: Wallet },
];

/** المالية والتجارة — طلبات وفواتير ودفعات واستردادات وكوبونات وخطط (يوافق operations.routes) */
export default function AdminFinance() {
  const me = adminIdentity();
  const [tab, setTab] = useState<Tab>("requests");
  const [tick, setTick] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const state = useMemo(() => {
    void tick;
    return {
      requests: loadEnrollmentRequests(), invoices: loadInvoices(), refunds: loadRefunds(),
      coupons: loadCoupons(), plans: loadPlans(),
    };
  }, [tick]);
  const [couponCode, setCouponCode] = useState("");
  const [couponPercent, setCouponPercent] = useState("10");
  const [planName, setPlanName] = useState("");
  const [planPrice, setPlanPrice] = useState("");

  const bump = (msg: string) => { setNote(msg); setTick(tick + 1); };

  return (
    <AdminLayout title="المالية والتجارة">
      <div className="mb-6 flex flex-wrap gap-1.5 rounded-full border border-white/10 bg-white/[0.03] p-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => { setTab(t.key); setNote(null); }}
            className={`flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
              tab === t.key ? "bg-[#FABC05] text-[#0D0D0D]" : "text-white/55 hover:text-white"
            }`}>
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {note && (
        <p className="mb-5 flex items-center gap-2 rounded-2xl border border-[#38A7B4]/40 bg-[#38A7B4]/10 px-4 py-3 text-sm font-bold text-[#6EC7D1]">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {note}
        </p>
      )}

      {tab === "requests" && (
        <div className="space-y-4">
          {state.requests.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.02] p-5">
              <div className="min-w-0 flex-1">
                <p className="font-black">{r.student}</p>
                <p className="mt-0.5 text-xs text-white/50">{r.cohort} · {r.at}</p>
                <p className="mt-1 text-sm font-bold text-[#FABC05]">{r.amount.toLocaleString()}$</p>
              </div>
              {r.status === "pending" ? (
                <div className="flex gap-2">
                  <button onClick={() => { updateEnrollmentRequest(r.id, "approved"); bump(`اعتُمد ${r.id}: حُجز المقعد وأُنشئ الطلب والفاتورة — بكوبون اختياري كما في الخادم.`); }}
                    className="cursor-pointer rounded-full bg-[#38A7B4] px-4 py-2 text-xs font-black text-[#08272B] hover:bg-[#6EC7D1]">موافقة — احجز المقعد</button>
                  <button onClick={() => { updateEnrollmentRequest(r.id, "rejected"); bump(`رُفض ${r.id} — الرفض عند الخادم يتطلب سببا مفهوما يظهر للمتعلم.`); }}
                    className="cursor-pointer rounded-full border border-red-500/40 px-4 py-2 text-xs font-black text-red-400 hover:bg-red-500/10">رفض بسبب</button>
                </div>
              ) : (
                <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${r.status === "approved" ? "bg-[#38A7B4]/15 text-[#6EC7D1]" : "bg-red-500/15 text-red-400"}`}>
                  {r.status === "approved" ? "اعتُمد" : "رُفض"}
                </span>
              )}
            </div>
          ))}
          {state.requests.length === 0 && <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-white/40">لا طلبات تسجيل معلقة</p>}
        </div>
      )}

      {tab === "invoices" && (
        <div className="space-y-4">
          {state.invoices.map((inv) => (
            <div key={inv.id} className="flex flex-wrap items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.02] p-5">
              <div className="min-w-0 flex-1">
                <p className="font-black" dir="ltr">{inv.id}</p>
                <p className="mt-0.5 text-xs text-white/50">{inv.student} · {inv.item}</p>
                <p className="mt-1 text-sm text-white/70">
                  القيمة <span className="font-bold text-[#FABC05]">{inv.amount.toLocaleString()}$</span> · المحصّل {inv.paid.toLocaleString()}$
                </p>
              </div>
              {inv.status === "open" ? (
                <button onClick={() => bump(`سُجلت دفعة يدوية على ${inv.id} باسم ${me?.name} — التحويل/الكاش يتطلب تطابق قيمة الفاتورة ويُوثق في سجل المراجعة.`)}
                  className="cursor-pointer rounded-full bg-[#38A7B4] px-4 py-2 text-xs font-black text-[#08272B] hover:bg-[#6EC7D1]">سجّل دفعة يدوية</button>
              ) : (
                <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${inv.status === "paid" ? "bg-emerald-500/15 text-emerald-300" : "bg-purple-500/15 text-purple-300"}`}>
                  {inv.status === "paid" ? "مسددة" : "مستردة"}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "refunds" && (
        <div className="space-y-4">
          {state.refunds.map((r) => (
            <div key={r.id} className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex flex-wrap items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-black">{r.student} — <span className="text-[#FABC05]">{r.amount.toLocaleString()}$</span></p>
                  <p className="mt-1 text-sm leading-6 text-white/65">السبب الموثق: {r.reason}</p>
                </div>
                {r.status === "pending" ? (
                  <div className="flex gap-2">
                    <button onClick={() => { updateRefund(r.id, "executed"); bump(`نُفذ الاسترداد ${r.id} — حُدّثت الدفعة والطلب معا كما يفعل الخادم ذرّيا.`); }}
                      className="cursor-pointer rounded-full bg-[#38A7B4] px-4 py-2 text-xs font-black text-[#08272B] hover:bg-[#6EC7D1]">نفّذ الاسترداد</button>
                    <button onClick={() => { updateRefund(r.id, "rejected"); bump(`رُفض الاسترداد ${r.id} بسبب موثق.`); }}
                      className="cursor-pointer rounded-full border border-red-500/40 px-4 py-2 text-xs font-black text-red-400 hover:bg-red-500/10">ارفض</button>
                  </div>
                ) : (
                  <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${r.status === "executed" ? "bg-purple-500/15 text-purple-300" : "bg-red-500/15 text-red-400"}`}>
                    {r.status === "executed" ? "نُفذ" : "رُفض"}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "coupons" && (
        <div>
          <div className="mb-5 flex flex-wrap items-end gap-3 rounded-3xl border border-white/10 bg-white/[0.02] p-5">
            <label className="text-xs font-bold text-white/60">
              رمز الكوبون
              <input value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} dir="ltr" placeholder="SUMMER25"
                className="mt-1 block w-44 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-[#38A7B4] focus:outline-none" />
            </label>
            <label className="text-xs font-bold text-white/60">
              نسبة الخصم %
              <input value={couponPercent} onChange={(e) => setCouponPercent(e.target.value)} dir="ltr" type="number" min="1" max="90"
                className="mt-1 block w-24 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white focus:border-[#38A7B4] focus:outline-none" />
            </label>
            <button
              onClick={() => {
                const percent = Number(couponPercent);
                if (!couponCode.trim() || !percent) return;
                addCoupon({ code: couponCode.trim(), percent, active: true });
                setCouponCode("");
                bump("أُنشئ الكوبون — يطبق عند موافقة طلب التسجيل كخيار كما في الخادم.");
              }}
              className="cursor-pointer rounded-full bg-[#FABC05] px-5 py-2.5 text-xs font-black text-[#0D0D0D] hover:bg-[#FABC05]/90">أنشئ الكوبون</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {state.coupons.map((c) => (
              <div key={c.code} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-4">
                <span className="font-black tracking-wider" dir="ltr">{c.code}</span>
                <span className="text-sm text-white/60">خصم {c.percent}%</span>
                <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${c.active ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-white/40"}`}>
                  {c.active ? "فعال" : "موقوف"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "plans" && (
        <div>
          <div className="mb-5 flex flex-wrap items-end gap-3 rounded-3xl border border-white/10 bg-white/[0.02] p-5">
            <label className="text-xs font-bold text-white/60">
              اسم الخطة
              <input value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="اشتراك الفرق"
                className="mt-1 block w-52 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-[#38A7B4] focus:outline-none" />
            </label>
            <label className="text-xs font-bold text-white/60">
              السعر $
              <input value={planPrice} onChange={(e) => setPlanPrice(e.target.value)} dir="ltr" type="number" min="1"
                className="mt-1 block w-28 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white focus:border-[#38A7B4] focus:outline-none" />
            </label>
            <button
              onClick={() => {
                const price = Number(planPrice);
                if (!planName.trim() || !price) return;
                addPlan({ id: `P${Date.now()}`, name: planName.trim(), price, interval: "شهري", active: true });
                setPlanName(""); setPlanPrice("");
                bump("أُنشئت خطة الاشتراك — الفعالة منها تظهر للعامة عبر مسارها العام.");
              }}
              className="cursor-pointer rounded-full bg-[#FABC05] px-5 py-2.5 text-xs font-black text-[#0D0D0D] hover:bg-[#FABC05]/90">أنشئ الخطة</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {state.plans.map((p) => (
              <div key={p.id} className="rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-4">
                <p className="font-black">{p.name}</p>
                <p className="mt-1 text-sm text-white/60">{p.price.toLocaleString()}$ / {p.interval}</p>
                <span className={`mt-2 inline-block rounded-full px-3 py-1 text-[11px] font-bold ${p.active ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-white/40"}`}>
                  {p.active ? "فعالة" : "موقوفة"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
