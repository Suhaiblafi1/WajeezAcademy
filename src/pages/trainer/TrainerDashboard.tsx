import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { AlertTriangle, CheckCircle2, ChevronLeft, Circle, ClipboardCheck, GitPullRequest, GraduationCap, ListChecks, Loader2, ServerOff, Users, Video } from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import { trainerIdentity } from "./trainer-identity";
import { apiGet } from "@/services/api";
import { useRealSession } from "@/services/session";
import { loadCohorts, loadSubmissions, loadOnboardingTasks, toggleOnboardingTask, type CohortStatus } from "@/data/trainer";

/* ── الصفحة الحقيقية للمدرب المسجّل — من الخادم مباشرة، بلا بيانات استعراض ── */

interface RealCohort {
  role: string;
  cohort: {
    id: string; title: string; status: string;
    course: { versions: { titleAr: string }[] };
    sessions: { id: string; title: string; startsAt: string; status: string }[];
    enrollments: { id: string; status: string; user: { displayName: string } }[];
  };
}
interface RealQueueItem { id: string; status: string }

function RealTrainerHome({ name }: { name: string }) {
  const [cohorts, setCohorts] = useState<RealCohort[] | null>(null);
  const [queue, setQueue] = useState<RealQueueItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    Promise.all([
      apiGet<RealCohort[]>("/api/trainer/my-cohorts"),
      apiGet<RealQueueItem[]>("/api/trainer/grading-queue"),
    ])
      .then(([c, q]) => { setCohorts(c); setQueue(q); })
      .catch(() => setFailed(true));
  }, []);

  if (failed)
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] py-16 text-white/50">
        <ServerOff className="h-5 w-5" /> تعذر جلب شعبك — تأكد أن الخادم يعمل ثم حدّث الصفحة.
      </div>
    );
  if (!cohorts || !queue)
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-white/50">
        <Loader2 className="h-5 w-5 animate-spin" /> أحضر شعبك…
      </div>
    );

  const students = cohorts.reduce((n, c) => n + c.cohort.enrollments.length, 0);
  const awaiting = queue.filter((q) => q.status === "submitted" || q.status === "under_review").length;
  const now = new Date().toISOString();
  const upcoming = cohorts
    .flatMap((c) => c.cohort.sessions.filter((s) => s.startsAt > now && s.status !== "done").map((s) => ({ ...s, cohortTitle: c.cohort.title })))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 4);

  return (
    <div>
      <p className="mb-6 text-sm text-white/60">أهلاً {name} — {cohorts.length > 0 ? `لديك ${cohorts.length} ${cohorts.length === 1 ? "شعبة" : "شعب"} و${students} طالباً.` : "لم تُسند إليك شعب بعد — ستظهر هنا فور إسنادها."}</p>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Link to="/trainer/board" className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/30">
          <p className="flex items-center gap-2 text-xs text-white/50"><GraduationCap className="h-4 w-4" /> شعبي</p>
          <p className="mt-2 text-3xl font-black">{cohorts.length}</p>
        </Link>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="flex items-center gap-2 text-xs text-white/50"><Users className="h-4 w-4" /> طلابي</p>
          <p className="mt-2 text-3xl font-black">{students}</p>
        </div>
        <Link to="/trainer/board" className={`rounded-2xl border p-5 transition hover:border-white/30 ${awaiting > 0 ? "border-[#FABC05]/40 bg-[#FABC05]/5" : "border-white/10 bg-white/[0.03]"}`}>
          <p className="flex items-center gap-2 text-xs text-[#FABC05]"><ClipboardCheck className="h-4 w-4" /> تسليمات بانتظار تقييمي</p>
          <p className="mt-2 text-3xl font-black text-[#FABC05]">{awaiting}</p>
        </Link>
        <Link to="/trainer/proposals" className="rounded-2xl border border-[#38A7B4]/30 bg-[#38A7B4]/5 p-5 transition hover:border-[#38A7B4]/60">
          <p className="flex items-center gap-2 text-xs text-[#6EC7D1]"><GitPullRequest className="h-4 w-4" /> اقتراحاتي على المحتوى</p>
          <p className="mt-2 text-3xl font-black text-[#6EC7D1]">↗</p>
        </Link>
      </div>

      <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.02] p-5">
        <p className="flex items-center gap-2 text-sm font-black"><Video className="h-4 w-4 text-[#38A7B4]" /> جلساتي القادمة</p>
        <div className="mt-3 space-y-2">
          {upcoming.length === 0 && <p className="py-3 text-center text-xs text-white/50">لا جلسات قادمة مجدولة</p>}
          {upcoming.map((s) => (
            <Link key={s.id} to="/trainer/board" className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-2.5 text-xs transition hover:border-white/30">
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-white/85">{s.title}</p>
                <p className="mt-0.5 truncate text-[10px] text-white/50">{s.cohortTitle}</p>
              </div>
              <span className="shrink-0 text-[10px] font-bold text-white/50">
                {new Date(s.startsAt).toLocaleString("ar-SA", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <p className="mt-6 text-center text-[11px] text-white/35">
        الحضور والتقييم والتسجيلات تُدار من شاشة «شعبي» — هذه الصفحة ملخص حي فقط.
      </p>
    </div>
  );
}

const STATUS_LABEL: Record<CohortStatus, { label: string; cls: string }> = {
  open: { label: "مفتوحة للتسجيل", cls: "border-[#38A7B4]/40 text-[#6EC7D1]" },
  full: { label: "ممتلئة", cls: "border-[#FABC05]/40 text-[#FABC05]" },
  running: { label: "جارية", cls: "border-[#38A7B4]/60 text-[#6EC7D1]" },
  postponed: { label: "مؤجلة", cls: "border-white/20 text-white/50" },
  done: { label: "منتهية", cls: "border-white/10 text-white/50" },
};

export default function TrainerDashboard() {
  const me = trainerIdentity();
  const meName = me?.name ?? ""; // الإطار يعرض بوابة الهوية عند غيابها — لا نكسر الصفحة
  const [tick, setTick] = useState(0);
  const cohorts = useMemo(() => loadCohorts(meName), [meName]);
  const subs = useMemo(() => loadSubmissions(meName), [meName]);
  const tasks = useMemo(() => { void tick; return loadOnboardingTasks(meName); }, [meName, tick]); // tick عداد إبطال مقصود بعد كل كتابة
  const tasksDone = tasks.filter((t) => t.done).length;
  const pending = subs.filter((s) => s.status === "pending").length;
  const totalStudents = cohorts.reduce((sum, c) => sum + c.students.length, 0);
  const atRisk = cohorts.reduce((sum, c) => sum + c.students.filter((s) => s.atRisk).length, 0);
  const upcoming = cohorts
    .flatMap((c) => c.sessions.filter((s) => !s.attendanceMarked && s.date >= new Date().toISOString().slice(0, 10)).map((s) => ({ ...s, cohort: c })))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);

  /* جلسة مدرب حقيقية (ولم يختر هوية استعراض محلية) → الملخص الحي من الخادم */
  const { user: sessionUser, checked } = useRealSession();
  if (checked && !me && sessionUser?.permissions.includes("trainer.portal")) {
    return (
      <TrainerLayout title="شعبي — ملخص اليوم">
        <RealTrainerHome name={sessionUser.displayName} />
      </TrainerLayout>
    );
  }

  return (
    <TrainerLayout title={`شعبي — ${meName}`}>
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

      {/* مهام التهيئة — من ملف المدرب عند الخادم: تأهيله وإسناداته ومهام التهيئة */}
      {tasksDone < tasks.length && (
        <section className="mt-6 rounded-3xl border border-[#38A7B4]/25 bg-[#38A7B4]/[0.05] p-6">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-black"><ListChecks className="h-4 w-4 text-[#6EC7D1]" /> مهام تهيئتك كمدرب</p>
            <span className="text-xs font-bold text-[#6EC7D1]">{tasksDone} / {tasks.length}</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[#38A7B4] transition-all" style={{ width: `${(tasksDone / tasks.length) * 100}%` }} />
          </div>
          <div className="mt-4 space-y-2">
            {tasks.map((t) => (
              <button
                key={t.id}
                onClick={() => { toggleOnboardingTask(meName, t.id); setTick(tick + 1); }}
                className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right transition hover:border-[#38A7B4]/40"
              >
                {t.done
                  ? <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-[#38A7B4]" />
                  : <Circle className="h-4.5 w-4.5 shrink-0 text-white/25" />}
                <span className={`text-sm ${t.done ? "text-white/50 line-through" : "font-bold text-white/85"}`}>{t.label}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-5 text-white/50">
            إكمال مهام التهيئة شرط قبل ظهور ملفك للعامة وقبول إسنادات جديدة.
          </p>
        </section>
      )}

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
                    <p className="text-[10px] text-white/50">مقاعد</p>
                  </div>
                  <div>
                    <p className="font-black text-white/85">{avgAttendance}%</p>
                    <p className="text-[10px] text-white/50">حضور</p>
                  </div>
                  <div>
                    <p className="font-black text-white/85">{submittedPct}%</p>
                    <p className="text-[10px] text-white/50">تسليم</p>
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
