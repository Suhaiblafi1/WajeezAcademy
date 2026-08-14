import { useState } from "react";
import { CalendarCheck, CheckCircle2, UserPlus, XCircle } from "lucide-react";
import AdminLayout from "./AdminLayout";
import {
  loadApplications, updateApplicationStatus,
  STATUS_LABELS, type ApplicationStatus,
} from "@/data/trainerApplications";

const STATUS_STYLE: Record<ApplicationStatus, string> = {
  new: "border-[#38A7B4]/40 text-[#6EC7D1]",
  interview: "border-[#FABC05]/50 text-[#FABC05]",
  accepted: "border-[#38A7B4]/60 bg-[#38A7B4]/10 text-[#6EC7D1]",
  rejected: "border-white/15 text-white/40",
};

/** إدارة طلبات انضمام المدربين — من النموذج العام إلى المقابلة إلى القرار */
export default function TrainerApplications() {
  const [apps, setApps] = useState(loadApplications);

  const setStatus = (id: string, status: ApplicationStatus) => {
    updateApplicationStatus(id, status);
    setApps(loadApplications());
  };

  return (
    <AdminLayout title="طلبات انضمام المدربين">
      {apps.length === 0 ? (
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-20 text-center">
          <UserPlus className="h-12 w-12 text-white/20" />
          <h2 className="mt-4 text-xl font-black">لا طلبات بعد</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-white/55">
            طلبات نموذج «انضم مدربا» في الموقع العام تظهر هنا فور إرسالها — لتدير المقابلات والقرارات من مكان واحد.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {apps.map((a) => (
            <article key={a.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-black">{a.name}</h3>
                  <p className="mt-1 text-xs text-white/50">
                    {a.domain} · خبرة {a.years}{a.role ? ` · ${a.role}` : ""} · {new Date(a.createdAt).toLocaleDateString("ar-SA")}
                  </p>
                  <p className="mt-1 text-[11px] text-white/40" dir="ltr">{a.email}{a.phone ? ` · ${a.phone}` : ""}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${STATUS_STYLE[a.status]}`}>
                  {STATUS_LABELS[a.status]}
                </span>
              </div>

              {a.why && (
                <p className="mt-4 rounded-xl border border-white/5 bg-black/20 p-3 text-xs leading-6 text-white/65">
                  <span className="font-bold text-white/40">لماذا وجيز؟ </span>{a.why}
                </p>
              )}
              {a.topics && (
                <p className="mt-2 text-xs leading-6 text-white/55">
                  <span className="font-bold text-white/40">مواضيعه: </span>{a.topics}
                </p>
              )}
              {a.links && (
                <p className="mt-1 text-[11px] text-[#6EC7D1]" dir="ltr">{a.links}</p>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                {a.status === "new" && (
                  <button onClick={() => setStatus(a.id, "interview")} className="flex cursor-pointer items-center gap-1.5 rounded-full bg-[#FABC05] px-4 py-2 text-xs font-black text-[#0D0D0D] transition hover:bg-[#FABC05]/90">
                    <CalendarCheck className="h-3.5 w-3.5" /> جدولة مقابلة
                  </button>
                )}
                {(a.status === "new" || a.status === "interview") && (
                  <>
                    <button onClick={() => setStatus(a.id, "accepted")} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-[#38A7B4]/50 px-4 py-2 text-xs font-bold text-[#6EC7D1] transition hover:bg-[#38A7B4]/10">
                      <CheckCircle2 className="h-3.5 w-3.5" /> قبول
                    </button>
                    <button onClick={() => setStatus(a.id, "rejected")} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-white/55 transition hover:border-red-400/40 hover:text-red-300">
                      <XCircle className="h-3.5 w-3.5" /> رفض بلطف
                    </button>
                  </>
                )}
                {a.status === "rejected" && (
                  <button onClick={() => setStatus(a.id, "new")} className="cursor-pointer rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-white/55 transition hover:border-white/40">
                    إعادة فتح الطلب
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
