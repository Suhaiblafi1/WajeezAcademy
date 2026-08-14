import { useMemo } from "react";
import { Link } from "react-router";
import { AlertTriangle, ChevronLeft, ClipboardCheck, Users, Video } from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import { trainerIdentity } from "./trainer-identity";
import { loadCohorts, loadSubmissions, type CohortStatus } from "@/data/trainer";

const STATUS_LABEL: Record<CohortStatus, { label: string; cls: string }> = {
  open: { label: "مفتوحة للتسجيل", cls: "border-[#38A7B4]/40 text-[#6EC7D1]" },
  full: { label: "ممتلئة", cls: "border-[#FABC05]/40 text-[#FABC05]" },
  running: { label: "جارية", cls: "border-[#38A7B4]/60 text-[#6EC7D1]" },
  postponed: { label: "مؤجلة", cls: "border-white/20 text-white/50" },
  done: { label: "منتهية", cls: "border-white/10 text-white/40" },
};

export default function TrainerDashboard() {
  const me = trainerIdentity()!;
  const cohorts = useMemo(() => loadCohorts(me.name), [me.name]);
  const subs = useMemo(() => loadSubmissions(me.name), [me.name]);
  const pending = subs.filter((s) => s.status === "pending").length;
  const totalStudents = cohorts.reduce((sum, c) => sum + c.students.length, 0);
  const atRisk = cohorts.reduce((sum, c) => sum + c.students.filter((s) => s.atRisk).length, 0);
  const upcoming = cohorts
    .flatMap((c) => c.sessions.filter((s) => !s.attendanceMarked && s.date >= new Date().toISOString().slice(0, 10)).map((s) => ({ ...s, cohort: c })))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);

  return (
    <TrainerLayout title={`شعبي — ${me.name}`}>
      {/* إحصاءات */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="flex items-center gap-2 text-xs text-white/50"><Users className="h-4 w-4" /> طلابي</p>
          <p className="mt-2 text-3xl font-black">{totalStudents}</p>
        </div>
        <Link to="/trainer/grading" className="rounded-2xl border border-[#FABC05]/30 bg-[#FABC05]/5 p-5 transition hover:border-[#FABC05]/60">
          <p className="flex items-center gap-2 text-xs text-[#FABC05]"><ClipboardCheck className="h-4 w-4" /> تسليمات بانتظار تقييمي</p>
          <p className="mt-2 text-3xl font-black text-[#FABC05]">{pending}</p>
        </Link>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="flex items-center gap-2 text-xs text-white/50"><Video className="h-4 w-4" /> جلسات قادمة</p>
          <p className="mt-2 text-3xl font-black">{upcoming.length}</p>
        </div>
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
          <p className="flex items-center gap-2 text-xs text-red-300"><AlertTriangle className="h-4 w-4" /> معرضون للتعثر</p>
          <p className="mt-2 text-3xl font-black text-red-400">{atRisk}</p>
        </div>
      </div>

      {/* الشعب المسندة */}
      <div className="mt-6 space-y-3">
        {cohorts.map((c) => {
          const meta = STATUS_LABEL[c.status];
          const enrolled = c.students.length;
          const submittedPct = Math.round((c.students.filter((s) => s.submitted).length / Math.max(1, enrolled)) * 100);
          const avgAttendance = Math.round(c.students.reduce((s, x) => s + x.attendancePct, 0) / Math.max(1, enrolled));
          return (
            <Link
              key={c.id}
              to={`/trainer/cohort/${c.id}`}
              className="block rounded-3xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-[#38A7B4]/50"
            >
              <div className="flex flex-wrap items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-black">{c.courseName}</p>
                  <p className="mt-0.5 text-xs text-white/50">من مسار «{c.pathwayName}» · بدأت {c.startDate}</p>
                </div>
                <div className="flex items-center gap-4 text-center text-xs">
                  <div>
                    <p className="font-black text-white/85">{enrolled}/{c.capacity}</p>
                    <p className="text-[10px] text-white/40">مقاعد</p>
                  </div>
                  <div>
                    <p className="font-black text-white/85">{avgAttendance}%</p>
                    <p className="text-[10px] text-white/40">حضور</p>
                  </div>
                  <div>
                    <p className="font-black text-white/85">{submittedPct}%</p>
                    <p className="text-[10px] text-white/40">تسليم</p>
                  </div>
                </div>
                <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${meta.cls}`}>{meta.label}</span>
                <ChevronLeft className="h-5 w-5 shrink-0 text-white/25" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* الجلسات القادمة */}
      {upcoming.length > 0 && (
        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <p className="flex items-center gap-2 text-sm font-black"><Video className="h-4 w-4 text-[#FABC05]" /> أقرب جلساتي</p>
          <div className="mt-4 space-y-2.5">
            {upcoming.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <div>
                  <p className="text-sm font-bold">{s.title} — {s.cohort.courseName}</p>
                  <p className="text-[11px] text-white/45">{s.date} · {s.time} · {s.cohort.students.length} طالبا</p>
                </div>
                <Link to={`/trainer/cohort/${s.cohort.id}`} className="rounded-full border border-[#38A7B4]/40 px-4 py-1.5 text-xs font-bold text-[#6EC7D1] transition hover:bg-[#38A7B4] hover:text-[#08272B]">
                  إدارة الجلسة
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="mt-8 text-center text-[11px] leading-5 text-white/55">
        حدود المدرب: لا يغير الأسعار ولا شروط الشهادات، لا يضيف طالبا دون منسق،
        ولا يرى بيانات دفع الطلاب — وتعديل الدرجة المعتمدة يحتاج سببا موثقا.
      </p>
    </TrainerLayout>
  );
}
