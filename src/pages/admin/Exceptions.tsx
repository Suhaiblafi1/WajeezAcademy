import { useMemo, useState } from "react";
import { CheckCircle2, ShieldAlert, XCircle } from "lucide-react";
import AdminLayout, { adminIdentity } from "./AdminLayout";
import { loadExceptions, resolveException, EXCEPTION_KIND_LABEL, type ExceptionKind } from "@/data/admin";

const KIND_CLS: Record<ExceptionKind, string> = {
  refund: "bg-red-500/15 text-red-300",
  appeal: "bg-[#FABC05]/15 text-[#FABC05]",
  pause: "bg-[#38A7B4]/15 text-[#6EC7D1]",
  dispute: "bg-purple-500/15 text-purple-300",
};

/** الحالات الاستثنائية — 16.3: استرداد واعتراضات وإيقاف وخلافات، كل قرار موثق */
export default function Exceptions() {
  const me = adminIdentity();
  const [tick, setTick] = useState(0);
  const cases = useMemo(() => loadExceptions(), [tick]);
  const [note, setNote] = useState<string | null>(null);

  const act = (id: string, status: "approved" | "rejected") => {
    resolveException(id, status);
    setNote(`سُجل قرارك (${status === "approved" ? "موافقة" : "رفض"}) باسم ${me?.name} — موثق في سجل المراجعة مع الوقت والقيمة.`);
    setTick(tick + 1);
  };

  return (
    <AdminLayout title="الحالات الاستثنائية — قرارات عالية الأثر">
      {note && (
        <p className="mb-5 flex items-center gap-2 rounded-2xl border border-[#38A7B4]/40 bg-[#38A7B4]/10 px-4 py-3 text-sm font-bold text-[#6EC7D1]">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {note}
        </p>
      )}
      <div className="space-y-4">
        {cases.map((e) => (
          <div key={e.id} className={`rounded-3xl border p-5 ${e.status === "pending" ? "border-white/10 bg-white/[0.02]" : "border-white/5 bg-white/[0.01] opacity-70"}`}>
            <div className="flex flex-wrap items-center gap-4">
              <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${KIND_CLS[e.kind]}`}>
                {EXCEPTION_KIND_LABEL[e.kind]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-black">{e.studentName}</p>
                <p className="mt-0.5 text-xs text-white/50">{e.pathwayName}</p>
                <p className="mt-1.5 text-sm leading-6 text-white/65">{e.detail}</p>
                <p className="mt-1 text-[10px] text-white/55">
                  {e.at}{e.amount ? ` · المبلغ: ${e.amount.toLocaleString()}$` : ""}
                </p>
              </div>
              {e.status === "pending" ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => act(e.id, "approved")}
                    className="flex cursor-pointer items-center gap-1.5 rounded-full bg-[#38A7B4] px-4 py-2 text-xs font-black text-[#08272B] transition hover:bg-[#6EC7D1]"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> موافقة
                  </button>
                  <button
                    onClick={() => act(e.id, "rejected")}
                    className="flex cursor-pointer items-center gap-1.5 rounded-full border border-red-500/40 px-4 py-2 text-xs font-black text-red-400 transition hover:bg-red-500/10"
                  >
                    <XCircle className="h-3.5 w-3.5" /> رفض بسبب
                  </button>
                </div>
              ) : (
                <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${e.status === "approved" ? "bg-[#38A7B4]/15 text-[#6EC7D1]" : "bg-red-500/15 text-red-400"}`}>
                  {e.status === "approved" ? "اعتُمد" : "رُفض"}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-8 flex items-center justify-center gap-2 text-center text-[11px] text-white/55">
        <ShieldAlert className="h-3.5 w-3.5" />
        القرارات عالية الأثر (استرداد، إلغاء شهادة، خلاف مالي) تُسجل في Audit Log مع المستخدم والوقت والقيمة السابقة — دائما.
      </p>
    </AdminLayout>
  );
}
