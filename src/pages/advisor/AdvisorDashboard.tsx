import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  AlertTriangle, CalendarClock, CheckCircle2, ChevronLeft, ClipboardList,
  Clock3, ListChecks, Loader2, Search, ServerOff, TrendingUp, UserPlus, Users,
} from "lucide-react";
import AdvisorLayout from "./AdvisorLayout";
import { advisorIdentity } from "./advisor-identity";
import { apiGet } from "@/services/api";
import { useRealSession } from "@/services/session";
import {
  loadAdvisorStudents, loadPathReviews, riskScore, riskLevel,
  nextBestAction, studentPathwayName, loadCases, unassignedCases,
  completeCaseTask, assignCase, logAudit, isOverdue, fmtDT,
  type RiskLevel, type AdvisorCase,
} from "@/data/advisor";

/* ── الصفحة الحقيقية للمستشار المسجّل — كلها من الخادم، بلا بيانات استعراض ── */

interface RealCase {
  id: string; status: string; nextAction: string | null; nextFollowUpAt: string | null;
  lead: { fullName: string } | null; client: { displayName: string } | null;
}
const CASE_STATUS: Record<string, string> = {
  new: "جديدة", contacted: "تم التواصل", needs_review: "تحتاج مراجعة", follow_up: "متابعة",
  recommended: "أوصينا بمسار", enrolled: "سجّل", not_interested: "غير مهتم", closed: "مغلقة",
};

function RealAdvisorHome({ name }: { name: string }) {
  const [rows, setRows] = useState<RealCase[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiGet<RealCase[]>("/api/advisor/cases")
      .then(setRows)
      .catch(() => setFailed(true));
  }, []);

  if (failed)
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] py-16 text-white/50">
        <ServerOff className="h-5 w-5" /> تعذر جلب حالاتك — تأكد أن الخادم يعمل ثم حدّث الصفحة.
      </div>
    );
  if (!rows)
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-white/50">
        <Loader2 className="h-5 w-5 animate-spin" /> أحضر حالاتك…
      </div>
    );

  const open = rows.filter((c) => !["closed", "enrolled", "not_interested"].includes(c.status));
  const needReview = rows.filter((c) => c.status === "needs_review").length;
  const fresh = rows.filter((c) => c.status === "new").length;
  const upcoming = rows
    .filter((c) => c.nextFollowUpAt)
    .sort((a, b) => (a.nextFollowUpAt ?? "").localeCompare(b.nextFollowUpAt ?? ""))
    .slice(0, 5);

  return (
    <div>
      <p className="mb-6 text-sm text-white/60">أهلاً {name} — لديك {open.length} حالة مفتوحة{fresh > 0 ? ` منها ${fresh} جديدة لم تُلامس بعد` : ""}.</p>

      <div className="mb-8 flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-3 text-[11px] text-white/55">
        <span className="font-black text-white/75">من أين أبدأ؟</span>
        {["افتح الحالات الجديدة أولاً", "سجّل أول تواصل", "جدول المتابعة التالية"].map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            {i > 0 && <span className="text-white/20">←</span>}
            <Link to="/advisor/cases" className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 font-bold transition hover:border-[#FABC05]/60 hover:text-[#FABC05]">
              <span className="grid h-4 w-4 place-items-center rounded-full bg-[#FABC05]/15 text-[10px] text-[#FABC05]">{["١", "٢", "٣"][i]}</span>
              {s}
            </Link>
          </span>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Link to="/advisor/cases" className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/30">
          <p className="flex items-center gap-2 text-xs text-white/50"><Users className="h-4 w-4" /> حالاتي المفتوحة</p>
          <p className="mt-2 text-3xl font-black">{open.length}</p>
        </Link>
        <Link to="/advisor/cases" className={`rounded-2xl border p-5 transition hover:border-white/30 ${fresh > 0 ? "border-[#FABC05]/40 bg-[#FABC05]/5" : "border-white/10 bg-white/[0.03]"}`}>
          <p className="flex items-center gap-2 text-xs text-[#FABC05]"><UserPlus className="h-4 w-4" /> جديدة بانتظار أول تواصل</p>
          <p className="mt-2 text-3xl font-black text-[#FABC05]">{fresh}</p>
        </Link>
        <Link to="/advisor/cases" className={`rounded-2xl border p-5 transition hover:border-white/30 ${needReview > 0 ? "border-red-500/40 bg-red-500/5" : "border-white/10 bg-white/[0.03]"}`}>
          <p className="flex items-center gap-2 text-xs text-red-300"><AlertTriangle className="h-4 w-4" /> تحتاج مراجعة</p>
          <p className="mt-2 text-3xl font-black text-red-400">{needReview}</p>
        </Link>
        <div className="rounded-2xl border border-[#38A7B4]/30 bg-[#38A7B4]/5 p-5">
          <p className="flex items-center gap-2 text-xs text-[#6EC7D1]"><CheckCircle2 className="h-4 w-4" /> سجّلوا أو أُغلقوا</p>
          <p className="mt-2 text-3xl font-black text-[#6EC7D1]">{rows.length - open.length}</p>
        </div>
      </div>

      <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.02] p-5">
        <p className="flex items-center gap-2 text-sm font-black">
          <CalendarClock className="h-4 w-4 text-[#38A7B4]" /> أقرب متابعاتك
        </p>
        <div className="mt-3 space-y-2">
          {upcoming.length === 0 && <p className="py-3 text-center text-xs text-white/50">لا متابعات مجدولة — جدولها من ملف الحالة</p>}
          {upcoming.map((c) => (
            <Link key={c.id} to="/advisor/cases" className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-2.5 text-xs transition hover:border-white/30">
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-white/85">{c.lead?.fullName ?? c.client?.displayName ?? "عميل بلا اسم"}</p>
                <p className="mt-0.5 truncate text-[10px] text-white/50">{c.nextAction ?? CASE_STATUS[c.status] ?? c.status}</p>
              </div>
              <span className="shrink-0 text-[10px] font-bold text-white/50">{fmtDT(c.nextFollowUpAt ?? undefined)}</span>
            </Link>
          ))}
        </div>
      </section>

      <p className="mt-6 text-center text-[11px] text-white/35">
        كل حالاتك وإجراءاتها في شاشة «حالاتي» — هذه الصفحة ملخص حي فقط.
      </p>
    </div>
  );
}

const LEVEL_META: Record<RiskLevel, { label: string; dot: string; ring: string; text: string }> = {
  green: { label: "مطمئن", dot: "bg-[#38A7B4]", ring: "border-[#38A7B4]/30", text: "text-[#6EC7D1]" },
  yellow: { label: "يحتاج انتباها", dot: "bg-[#FABC05]", ring: "border-[#FABC05]/40", text: "text-[#FABC05]" },
  red: { label: "خطر تعثر", dot: "bg-red-500", ring: "border-red-500/50", text: "text-red-400" },
};

const STATUS_LABEL: Record<string, string> = {
  onboarding: "تهيئة", active: "نشط", at_risk: "معرض للتعثر",
  paused: "موقوف مؤقتا", refunded: "مسترد", completed: "خريج",
};

export default function AdvisorDashboard() {
  const students = useMemo(() => loadAdvisorStudents(), []);
  const reviews = useMemo(() => loadPathReviews(), []);
  const [tick, setTick] = useState(0);
  const [filter, setFilter] = useState<"all" | RiskLevel>("all");
  const [query, setQuery] = useState("");
  const me = advisorIdentity();
  void tick;

  const cases = useMemo(() => loadCases(), [tick]);
  const unassigned = useMemo(() => unassignedCases(), [tick]);

  /* مهامي المستحقة وأقرب متابعاتي — كما في GET /api/advisor/cases (المسند إليّ فقط) */
  const myCases = useMemo(
    () => cases.filter((c) => c.assignedTo === (me?.name ?? "أ. ريم القحطاني")),
    [cases, me]
  );
  const dueTasks = useMemo(() => {
    const rows: { kase: AdvisorCase; taskId: string; title: string; dueAt?: string }[] = [];
    for (const c of myCases)
      for (const t of c.tasks) if (!t.done) rows.push({ kase: c, taskId: t.id, title: t.title, dueAt: t.dueAt });
    return rows.sort((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999")).slice(0, 5);
  }, [myCases]);
  const nextFollowUps = useMemo(() => {
    const rows = myCases
      .filter((c) => c.nextFollowUpAt)
      .sort((a, b) => (a.nextFollowUpAt ?? "").localeCompare(b.nextFollowUpAt ?? ""));
    return rows.slice(0, 4);
  }, [myCases]);

  const ranked = useMemo(
    () =>
      students
        .map((s) => ({ s, score: riskScore(s.signals), level: riskLevel(riskScore(s.signals)) }))
        .sort((a, b) => b.score - a.score)
        .filter((x) => filter === "all" || x.level === filter)
        .filter((x) => {
          const q = query.trim();
          if (!q) return true;
          return x.s.name.includes(q) || x.s.role.includes(q) || studentPathwayName(x.s).includes(q);
        }),
    [students, filter, query]
  );

  const counts = useMemo(() => {
    const red = students.filter((s) => riskLevel(riskScore(s.signals)) === "red").length;
    const yellow = students.filter((s) => riskLevel(riskScore(s.signals)) === "yellow").length;
    const active = students.filter((s) => s.status === "active" || s.status === "at_risk").length;
    return { red, yellow, active, total: students.length, pendingReviews: reviews.filter((r) => r.status === "pending").length };
  }, [students, reviews]);

  const doneTask = (caseId: string, taskId: string, title: string) => {
    completeCaseTask(caseId, taskId);
    logAudit(me?.name ?? "مستشار", `أنجز مهمة: «${title}»`, caseId);
    setTick((t) => t + 1);
  };
  const claimCase = (c: AdvisorCase) => {
    assignCase(c.id, me?.name ?? "مستشار");
    logAudit(me?.name ?? "مستشار", `أُسندت إليه حالة «${c.studentName}»`, c.id);
    setTick((t) => t + 1);
  };

  /* جلسة مستشار حقيقية (ولم يختر هوية استعراض محلية) → الملخص الحي من الخادم */
  const { user: sessionUser, checked } = useRealSession();
  if (checked && !me && sessionUser?.permissions.includes("advisor.cases.view")) {
    return (
      <AdvisorLayout title="حالاتي — ملخص اليوم">
        <RealAdvisorHome name={sessionUser.displayName} />
      </AdvisorLayout>
    );
  }

  return (
    <AdvisorLayout title="طلبةي — مرتبون بأولوية التدخل">
      {/* إحصاءات */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="flex items-center gap-2 text-xs text-white/50"><Users className="h-4 w-4" /> طلبة نشطون</p>
          <p className="mt-2 text-3xl font-black">{counts.active}<span className="text-sm text-white/50"> / {counts.total}</span></p>
        </div>
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
          <p className="flex items-center gap-2 text-xs text-red-300"><AlertTriangle className="h-4 w-4" /> خطر مرتفع</p>
          <p className="mt-2 text-3xl font-black text-red-400">{counts.red}</p>
        </div>
        <div className="rounded-2xl border border-[#FABC05]/30 bg-[#FABC05]/5 p-5">
          <p className="flex items-center gap-2 text-xs text-[#FABC05]"><TrendingUp className="h-4 w-4" /> يحتاجون انتباها</p>
          <p className="mt-2 text-3xl font-black text-[#FABC05]">{counts.yellow}</p>
        </div>
        <Link to="/advisor/reviews" className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-[#38A7B4]/50">
          <p className="flex items-center gap-2 text-xs text-white/50"><ClipboardList className="h-4 w-4" /> طلبات مراجعة معلقة</p>
          <p className="mt-2 text-3xl font-black">{counts.pendingReviews}</p>
        </Link>
      </div>

      {/* مهامي المستحقة + أقرب متابعاتي — مسندة إليّ فقط كما في GET /api/advisor/cases */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
          <p className="flex items-center gap-2 text-sm font-black">
            <ListChecks className="h-4 w-4 text-[#FABC05]" /> مهامي المستحقة
            <span className="mr-auto text-[10px] font-normal text-white/50">لكل مهمة موعد استحقاق واضح</span>
          </p>
          <div className="mt-3 space-y-2">
            {dueTasks.length === 0 && <p className="py-3 text-center text-xs text-white/50">لا مهام معلقة عليك — أحسنت</p>}
            {dueTasks.map((t) => (
              <div key={t.taskId} className={`flex items-center gap-3 rounded-2xl border px-4 py-2.5 text-xs ${
                isOverdue(t.dueAt) ? "border-red-500/40 bg-red-500/5" : "border-white/10 bg-white/[0.02]"
              }`}>
                <button
                  onClick={() => doneTask(t.kase.id, t.taskId, t.title)}
                  className="grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-full border border-white/25 text-transparent transition hover:border-[#38A7B4] hover:text-[#6EC7D1]"
                  title="إنجاز المهمة"
                  aria-label={`إنجاز مهمة: ${t.title}`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-white/85">{t.title}</p>
                  <p className="mt-0.5 text-[10px] text-white/50">
                    {t.kase.studentName} · {t.dueAt ? (isOverdue(t.dueAt) ? `متأخرة — كانت ${fmtDT(t.dueAt)}` : `تستحق ${fmtDT(t.dueAt)}`) : "بلا موعد"}
                  </p>
                </div>
                {isOverdue(t.dueAt) && <span className="shrink-0 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-black text-red-400">متأخرة</span>}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
          <p className="flex items-center gap-2 text-sm font-black">
            <CalendarClock className="h-4 w-4 text-[#38A7B4]" /> أقرب متابعاتي
          </p>
          <div className="mt-3 space-y-2">
            {nextFollowUps.length === 0 && <p className="py-3 text-center text-xs text-white/50">لا متابعات مجدولة — جدولها من ملف الحالة</p>}
            {nextFollowUps.map((c) => {
              const link = c.studentId ? `/advisor/student/${c.studentId}` : "/advisor";
              const overdue = isOverdue(c.nextFollowUpAt);
              return (
                <Link key={c.id} to={link} className={`flex items-center gap-3 rounded-2xl border px-4 py-2.5 text-xs transition hover:border-white/30 ${
                  overdue ? "border-[#FABC05]/40 bg-[#FABC05]/5" : "border-white/10 bg-white/[0.02]"
                }`}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-white/85">{c.studentName}</p>
                    <p className="mt-0.5 truncate text-[10px] text-white/50">{c.nextAction ?? "متابعة مجدولة"}</p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold ${overdue ? "text-[#FABC05]" : "text-white/50"}`}>
                    {overdue ? "فات موعدها · " : ""}{fmtDT(c.nextFollowUpAt)}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      </div>

      {/* حالات بلا مستشار — GET /api/admin/advisor-cases/unassigned */}
      {unassigned.length > 0 && (
        <section className="mt-4 rounded-3xl border border-[#FABC05]/30 bg-[#FABC05]/5 p-5">
          <p className="flex items-center gap-2 text-sm font-black text-[#FABC05]">
            <UserPlus className="h-4 w-4" /> {unassigned.length} {unassigned.length === 1 ? "حالة بلا مستشار" : "حالات بلا مستشار"} — تنتظر الإسناد
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {unassigned.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-full border border-[#FABC05]/30 bg-[#0D0D0D]/60 py-1.5 pr-4 pl-1.5 text-xs">
                <span className="font-bold text-white/80">{c.studentName}</span>
                <button
                  onClick={() => claimCase(c)}
                  className="cursor-pointer rounded-full bg-[#FABC05] px-3 py-1 text-[10px] font-black text-[#0D0D0D] transition hover:bg-[#FABC05]/85"
                >
                  أسنِدها لي
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* فلاتر + بحث */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/50" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث باسم الطالب أو دوره أو مساره…"
            aria-label="بحث في طلبتي"
            className="w-64 rounded-full border border-white/10 bg-white/[0.03] py-1.5 pr-9 pl-3 text-xs text-white placeholder:text-white/50 focus:border-[#FABC05] focus:outline-none"
          />
        </div>
        {(["all", "red", "yellow", "green"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`cursor-pointer rounded-full border px-4 py-1.5 text-xs font-bold transition ${
              filter === f ? "border-[#FABC05] bg-[#FABC05] text-[#0D0D0D]" : "border-white/10 text-white/55 hover:border-white/30"
            }`}
          >
            {f === "all" ? "الكل" : LEVEL_META[f].label}
          </button>
        ))}
        <span className="mr-auto flex items-center gap-1.5 text-[11px] text-white/55">
          <Clock3 className="h-3.5 w-3.5" /> مؤشر الانتباه يُحدَّث يومياً بقواعد موثقة وقابلة للشرح — وليس عقوبة آلية
        </span>
      </div>

      {/* القائمة المرتبة — US-08 */}
      <div className="mt-4 space-y-3">
        {ranked.map(({ s, score, level }) => {
          const meta = LEVEL_META[level];
          const nba = nextBestAction(s);
          const activeSignals = s.signals.filter((x) => x.active && x.points > 0);
          return (
            <Link
              key={s.id}
              to={`/advisor/student/${s.id}`}
              className={`block rounded-3xl border bg-white/[0.02] p-5 transition hover:border-white/30 ${meta.ring}`}
            >
              <div className="flex flex-wrap items-center gap-4">
                {/* درجة الخطر */}
                <div className="grid w-16 shrink-0 place-items-center text-center">
                  <p className={`text-2xl font-black ${meta.text}`}>{score}</p>
                  <p className="flex items-center gap-1 text-[10px] text-white/50">
                    <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} /> {meta.label}
                  </p>
                </div>
                {/* الطالب */}
                <div className="min-w-0 flex-1">
                  <p className="font-black">
                    {s.name}
                    {s.isRealUser && <span className="mr-2 rounded-full bg-[#38A7B4]/15 px-2 py-0.5 text-[10px] font-bold text-[#6EC7D1]">مستخدم هذا الجهاز</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-white/50">{s.role} · مسار «{studentPathwayName(s)}» · ثقة التوصية {s.confidence}%</p>
                  {activeSignals.length > 0 && (
                    <p className="mt-1.5 text-[11px] text-white/50">
                      {activeSignals.map((x) => x.label).join(" · ")}
                    </p>
                  )}
                </div>
                {/* الحالة والإجراء المقترح */}
                <div className="text-left">
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-white/50">{STATUS_LABEL[s.status]}</span>
                  <p className={`mt-2 max-w-[220px] text-[11px] leading-5 ${level === "green" ? "text-white/45" : meta.text}`}>
                    {level === "green" ? <CheckCircle2 className="ml-1 inline h-3 w-3" /> : <AlertTriangle className="ml-1 inline h-3 w-3" />}
                    {nba.action}
                  </p>
                  <p className="mt-0.5 text-[10px] text-white/30">
                    {s.lastActiveDays === 0 ? "نشط الآن" : `آخر نشاط قبل ${s.lastActiveDays} ${s.lastActiveDays === 1 ? "يوم" : "أيام"}`}
                  </p>
                </div>
                <ChevronLeft className="h-5 w-5 shrink-0 text-white/25" />
              </div>
            </Link>
          );
        })}
      </div>
    </AdvisorLayout>
  );
}
