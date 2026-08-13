import { useMemo, useState } from "react";
import {
  AlertTriangle, CheckCircle2, CircleX, GitMerge, Lock, Play, UserPlus, XCircle,
} from "lucide-react";
import AdminLayout from "./AdminLayout";
import {
  loadAdminCohorts, cohortReadyToOpen, openCohort, autoCloseAtCapacity,
  resolveUnderMinimum, type AdminCohortStatus,
} from "@/data/admin";

const STATUS_META: Record<AdminCohortStatus, { label: string; cls: string }> = {
  draft: { label: "مسودة", cls: "border-white/20 text-white/50" },
  open: { label: "مفتوحة", cls: "border-[#38A7B4]/50 text-[#6EC7D1]" },
  full: { label: "ممتلئة — أُغلقت آليا", cls: "border-[#FABC05]/50 text-[#FABC05]" },
  running: { label: "جارية", cls: "border-[#38A7B4]/60 text-[#6EC7D1]" },
  postponed: { label: "مؤجلة", cls: "border-white/20 text-white/50" },
  cancelled: { label: "ملغاة/مدمجة", cls: "border-red-500/40 text-red-400" },
};

const CHECK_LABELS = [
  ["trainer", "مدرب معتمد"], ["schedule", "جدول منشور"], ["capacity", "سعة محددة"],
  ["content", "محتوى معتمد"], ["contract", "عقد مالي موقع"],
] as const;

/** عمليات الشعب — US-10: لا تفتح دون مدرب وجدول ومحتوى وعقد؛ تُغلق آليا عند السعة */
export default function AdminCohorts() {
  const [tick, setTick] = useState(0);
  const cohorts = useMemo(() => loadAdminCohorts(), [tick]);
  const [notice, setNotice] = useState<string | null>(null);

  const tryOpen = (id: string) => {
    const res = openCohort(id);
    setNotice(res.ok ? "فُتحت الشعبة — كل الشروط مستوفاة." : res.reason ?? "تعذر الفتح");
    setTick(tick + 1);
  };
  const enrollOne = (id: string) => {
    // محاكاة تسجيل طالب جديد — قد يغلق الشعبة آليا عند بلوغ السعة
    const list = loadAdminCohorts();
    const c = list.find((x) => x.id === id);
    if (c && c.enrolled < c.capacity) {
      c.enrolled += 1;
      localStorage.setItem("wajeez_admin_cohorts", JSON.stringify(list));
      const closed = autoCloseAtCapacity(id);
      setNotice(closed ? "بلغت الشعبة سعتها — أُغلقت تلقائيا وفتحت قائمة الانتظار." : `سُجل طالب جديد (${c.enrolled}/${c.capacity})`);
      setTick(tick + 1);
    }
  };

  return (
    <AdminLayout title="عمليات الشعب — الفتح والإغلاق والسعة">
      {notice && (
        <p className="mb-5 flex items-center gap-2 rounded-2xl border border-[#38A7B4]/40 bg-[#38A7B4]/10 px-4 py-3 text-sm font-bold text-[#6EC7D1]">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {notice}
        </p>
      )}

      <div className="space-y-4">
        {cohorts.map((c) => {
          const meta = STATUS_META[c.status];
          const check = cohortReadyToOpen(c);
          const underMin = c.enrolled < c.minSeats && (c.status === "open" || c.status === "draft");
          return (
            <div key={c.id} className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex flex-wrap items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-black">{c.courseName}</p>
                  <p className="mt-0.5 text-xs text-white/50">
                    {c.pathwayName} · {c.trainer} · تبدأ {c.startDate} · {c.enrolled}/{c.capacity} مقعدا (الحد الأدنى {c.minSeats})
                  </p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${meta.cls}`}>{meta.label}</span>
                {c.status === "draft" && (
                  <button
                    onClick={() => tryOpen(c.id)}
                    className="flex cursor-pointer items-center gap-1.5 rounded-full bg-[#38A7B4] px-4 py-2 text-xs font-black text-[#08272B] transition hover:bg-[#6EC7D1]"
                  >
                    <Play className="h-3.5 w-3.5" /> افتح الشعبة
                  </button>
                )}
                {c.status === "open" && (
                  <button
                    onClick={() => enrollOne(c.id)}
                    className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/20 px-4 py-2 text-xs font-bold text-white/70 transition hover:border-[#38A7B4]/60 hover:text-[#6EC7D1]"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> سجّل طالبا (محاكاة)
                  </button>
                )}
              </div>

              {/* قائمة تحقق الفتح — US-10 */}
              <div className="mt-4 flex flex-wrap gap-2">
                {CHECK_LABELS.map(([key, label]) => (
                  <span
                    key={key}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold ${
                      c.checklist[key] ? "border-[#38A7B4]/30 text-[#6EC7D1]" : "border-red-500/40 text-red-400"
                    }`}
                  >
                    {c.checklist[key] ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {label}
                  </span>
                ))}
              </div>
              {!check.ready && c.status === "draft" && (
                <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-red-300">
                  <Lock className="h-3.5 w-3.5" /> لا يمكن فتحها — ينقص: {check.missing.join("، ")}
                </p>
              )}

              {/* دون الحد الأدنى — دمج/تأجيل/تشغيل استثنائي */}
              {underMin && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-[#FABC05]/25 bg-[#FABC05]/5 px-4 py-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold text-[#FABC05]">
                    <AlertTriangle className="h-3.5 w-3.5" /> دون الحد الأدنى ({c.enrolled}/{c.minSeats}) — قرارك:
                  </p>
                  <button onClick={() => { resolveUnderMinimum(c.id, "merge"); setTick(tick + 1); setNotice("دُمجت الشعبة مع الشعبة الأقرب موعدا — أُشعر الطلاب."); }}
                    className="flex cursor-pointer items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-[10px] font-bold text-white/70 hover:border-white/40">
                    <GitMerge className="h-3 w-3" /> دمج
                  </button>
                  <button onClick={() => { resolveUnderMinimum(c.id, "postpone"); setTick(tick + 1); setNotice("أُجلت الشعبة — أُشعر الطلاب بالموعد الجديد وسبب التأجيل."); }}
                    className="cursor-pointer rounded-full border border-white/20 px-3 py-1 text-[10px] font-bold text-white/70 hover:border-white/40">
                    تأجيل
                  </button>
                  <button onClick={() => { resolveUnderMinimum(c.id, "exceptional_run"); setTick(tick + 1); setNotice("اعتُمد التشغيل الاستثنائي — سُجل القرار وسببه."); }}
                    className="cursor-pointer rounded-full border border-[#FABC05]/40 px-3 py-1 text-[10px] font-bold text-[#FABC05] hover:bg-[#FABC05]/10">
                    تشغيل استثنائي
                  </button>
                </div>
              )}
              {c.status === "cancelled" && (
                <p className="mt-3 flex items-center gap-1.5 text-[11px] text-red-300">
                  <CircleX className="h-3.5 w-3.5" /> أُلغيت/دُمجت — عُرض على الطلاب النقل أو الاسترداد وفق السياسة.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </AdminLayout>
  );
}
