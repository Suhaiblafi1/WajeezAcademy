import { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, CheckCircle2, Clock3, Loader2, ShieldCheck, XCircle } from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import { trainerIdentity } from "./trainer-identity";
import { useRealSession } from "@/services/session";
import { apiGet, ApiError } from "@/services/api";
import { loadEarnings, EARNING_STATUS_LABEL, EARNING_KIND_LABEL, type Earning } from "@/data/trainer";

const STATUS_META: Record<Earning["status"], { icon: typeof Clock3; cls: string }> = {
  accrued: { icon: Clock3, cls: "bg-[#FABC05]/15 text-[#FABC05]" },
  approved: { icon: ShieldCheck, cls: "bg-[#38A7B4]/15 text-[#6EC7D1]" },
  paid: { icon: CheckCircle2, cls: "bg-white/10 text-white/50" },
};

const PAYOUT_STATUS: Record<string, { label: string; cls: string; icon: typeof Clock3 }> = {
  pending: { label: "بانتظار الاعتماد", cls: "border-[#FABC05]/40 text-[#FABC05]", icon: Clock3 },
  approved: { label: "معتمد — قيد الصرف", cls: "border-[#38A7B4]/40 text-[#6EC7D1]", icon: ShieldCheck },
  paid: { label: "مدفوع", cls: "border-emerald-400/40 text-emerald-300", icon: CheckCircle2 },
  cancelled: { label: "ملغى", cls: "border-white/20 text-white/40", icon: XCircle },
};

interface RealPayout {
  id: string; period: string; status: string; total: string | number; currency: string;
  paidAt?: string | null;
  items: { id: string; description: string; amount: string | number; sourceRef?: string | null }[];
}
interface RealEarnings {
  payouts: RealPayout[];
  summary: { pending: number; approved: number; paid: number; currency: string };
}

const fmt = (n: string | number) => Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });

/** كشف مستحقات حقيقي من الخادم — للمدرب المسجل بحساب فعلي */
function RealEarningsView() {
  const [data, setData] = useState<RealEarnings | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try { setData(await apiGet<RealEarnings>("/api/trainer/earnings")); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "تعذر تحميل المستحقات"); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (err) {
    return (
      <TrainerLayout title="مستحقاتي">
        <p className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center text-sm font-bold text-red-300" role="alert">{err}</p>
      </TrainerLayout>
    );
  }
  if (!data) {
    return (
      <TrainerLayout title="مستحقاتي">
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-white/30" /></div>
      </TrainerLayout>
    );
  }

  const { summary, payouts } = data;
  return (
    <TrainerLayout title="مستحقاتي — كشف مبسط وشفاف">
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-[#FABC05]/30 bg-[#FABC05]/5 p-5">
          <p className="text-xs text-[#FABC05]">بانتظار الاعتماد</p>
          <p className="mt-2 text-2xl font-black text-[#FABC05]">{fmt(summary.pending)} <span className="text-xs">{summary.currency}</span></p>
        </div>
        <div className="rounded-2xl border border-[#38A7B4]/30 bg-[#38A7B4]/5 p-5">
          <p className="text-xs text-[#6EC7D1]">معتمدة للصرف</p>
          <p className="mt-2 text-2xl font-black text-[#6EC7D1]">{fmt(summary.approved)} <span className="text-xs">{summary.currency}</span></p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs text-white/50">مدفوعة</p>
          <p className="mt-2 text-2xl font-black text-white/70">{fmt(summary.paid)} <span className="text-xs">{summary.currency}</span></p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {payouts.length === 0 && (
          <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-16 text-center">
            <Banknote className="h-10 w-10 text-white/20" />
            <p className="mt-3 max-w-sm text-sm leading-7 text-white/50">
              لا كشوف بعد — عند اعتماد أول مستحقات لك من الإدارة المالية تظهر هنا تلقائياً ببنودها وحالتها.
            </p>
          </div>
        )}
        {payouts.map((p) => {
          const meta = PAYOUT_STATUS[p.status] ?? PAYOUT_STATUS.pending;
          return (
            <div key={p.id} className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-black">كشف فترة <span dir="ltr" className="font-mono text-sm">{p.period}</span></p>
                  {p.paidAt && <p className="mt-0.5 text-[11px] text-white/40">صُرف {new Date(p.paidAt).toLocaleString("ar")}</p>}
                </div>
                <div className="text-left">
                  <p className="text-xl font-black">{fmt(p.total)} <span className="text-xs text-white/50">{p.currency}</span></p>
                  <p className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${meta.cls}`}>
                    <meta.icon className="h-3 w-3" /> {meta.label}
                  </p>
                </div>
              </div>
              <ul className="mt-3 space-y-1.5 border-t border-white/8 pt-3">
                {p.items.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 text-xs text-white/60">
                    <span>{i.description}{i.sourceRef ? <span dir="ltr" className="mr-2 font-mono text-[10px] text-white/35">{i.sourceRef}</span> : null}</span>
                    <span dir="ltr" className="font-mono font-bold text-white/80">{fmt(i.amount)} {p.currency}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <p className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-center text-[11px] leading-6 text-white/45">
        الكشف يمر بثلاث مراحل: إنشاء من الإدارة المالية ← اعتماد ← صرف. كل بند مرتبط بمصدره لمنع الازدواج —
        ولأي استفسار عن بند تواصل مع منسقك قبل موعد الصرف.
      </p>
    </TrainerLayout>
  );
}

/** مستحقات المدرب — جلسة حقيقية: من الخادم مباشرة. بلا جلسة (ديمو محلي): البيانات التوضيحية المحلية */
export default function Earnings() {
  const me = trainerIdentity();
  const { user: sessionUser, checked } = useRealSession();

  if (checked && !me && sessionUser?.permissions.includes("trainer.portal")) {
    return <RealEarningsView />;
  }

  return <DemoEarningsView />;
}

/** العرض التوضيحي المحلي — يعمل بلا خادم للزائر المتصفح للبوابة */
function DemoEarningsView() {
  const me = trainerIdentity();
  const meName = me?.name ?? "";
  const earnings = useMemo(() => loadEarnings(meName), [meName]);
  const totals = useMemo(() => ({
    accrued: earnings.filter((e) => e.status === "accrued").reduce((s, e) => s + e.amount, 0),
    approved: earnings.filter((e) => e.status === "approved").reduce((s, e) => s + e.amount, 0),
    paid: earnings.filter((e) => e.status === "paid").reduce((s, e) => s + e.amount, 0),
  }), [earnings]);

  return (
    <TrainerLayout title="مستحقاتي — كشف مبسط وشفاف">
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-[#FABC05]/30 bg-[#FABC05]/5 p-5">
          <p className="text-xs text-[#FABC05]">قيد التراكم</p>
          <p className="mt-2 text-2xl font-black text-[#FABC05]">{totals.accrued.toLocaleString()}$</p>
        </div>
        <div className="rounded-2xl border border-[#38A7B4]/30 bg-[#38A7B4]/5 p-5">
          <p className="text-xs text-[#6EC7D1]">معتمدة للدفع</p>
          <p className="mt-2 text-2xl font-black text-[#6EC7D1]">{totals.approved.toLocaleString()}$</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs text-white/50">مدفوعة</p>
          <p className="mt-2 text-2xl font-black text-white/70">{totals.paid.toLocaleString()}$</p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {earnings.map((e) => {
          const meta = STATUS_META[e.status];
          return (
            <div key={e.id} className="flex flex-wrap items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.02] p-5">
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${meta.cls}`}>
                <Banknote className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-black">{e.label}</p>
                <p className="mt-0.5 text-xs text-white/50">
                  {EARNING_KIND_LABEL[e.kind]} · المصدر: {e.source}
                </p>
              </div>
              <div className="text-left">
                <p className="text-xl font-black">{e.amount.toLocaleString()}$</p>
                <p className={`mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${meta.cls}`}>
                  <meta.icon className="h-3 w-3" /> {EARNING_STATUS_LABEL[e.status]}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-center text-[11px] leading-6 text-white/45">
        كل بند مرتبط بحدث مصدر (جلسة أو تسليم أو عقد) لمنع الازدواج — ولك اعتراض خلال 7 أيام من الكشف الأولي.
        أي تعديل لاحق يصدر كتسوية مستقلة، لا تعديل صامت للتاريخ. الاعتراضات عبر منسقك.
      </p>
    </TrainerLayout>
  );
}
