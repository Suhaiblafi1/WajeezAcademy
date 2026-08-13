import { useMemo } from "react";
import { Banknote, CheckCircle2, Clock3, ShieldCheck } from "lucide-react";
import TrainerLayout, { trainerIdentity } from "./TrainerLayout";
import { loadEarnings, EARNING_STATUS_LABEL, EARNING_KIND_LABEL, type Earning } from "@/data/trainer";

const STATUS_META: Record<Earning["status"], { icon: typeof Clock3; cls: string }> = {
  accrued: { icon: Clock3, cls: "bg-[#FABC05]/15 text-[#FABC05]" },
  approved: { icon: ShieldCheck, cls: "bg-[#38A7B4]/15 text-[#6EC7D1]" },
  paid: { icon: CheckCircle2, cls: "bg-white/10 text-white/50" },
};

/** مستحقات المدرب — القسم 17: تقديرية ومعتمدة ومدفوعة، كل بند مرتبط بحدث ومصدر، دون كشف ربحية كاملة */
export default function Earnings() {
  const me = trainerIdentity()!;
  const earnings = useMemo(() => loadEarnings(me.name), [me.name]);
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
