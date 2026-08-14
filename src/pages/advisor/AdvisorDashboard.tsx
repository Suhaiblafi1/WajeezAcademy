import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  AlertTriangle, CheckCircle2, ChevronLeft, ClipboardList,
  Clock3, TrendingUp, Users,
} from "lucide-react";
import AdvisorLayout from "./AdvisorLayout";
import {
  loadAdvisorStudents, loadPathReviews, riskScore, riskLevel,
  nextBestAction, studentPathwayName, type RiskLevel,
} from "@/data/advisor";

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
  const [filter, setFilter] = useState<"all" | RiskLevel>("all");

  const ranked = useMemo(
    () =>
      students
        .map((s) => ({ s, score: riskScore(s.signals), level: riskLevel(riskScore(s.signals)) }))
        .sort((a, b) => b.score - a.score)
        .filter((x) => filter === "all" || x.level === filter),
    [students, filter]
  );

  const counts = useMemo(() => {
    const red = students.filter((s) => riskLevel(riskScore(s.signals)) === "red").length;
    const yellow = students.filter((s) => riskLevel(riskScore(s.signals)) === "yellow").length;
    const active = students.filter((s) => s.status === "active" || s.status === "at_risk").length;
    return { red, yellow, active, total: students.length, pendingReviews: reviews.filter((r) => r.status === "pending").length };
  }, [students, reviews]);

  return (
    <AdvisorLayout title="طلبةي — مرتبون بأولوية التدخل">
      {/* إحصاءات */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="flex items-center gap-2 text-xs text-white/50"><Users className="h-4 w-4" /> طلبة نشطون</p>
          <p className="mt-2 text-3xl font-black">{counts.active}<span className="text-sm text-white/40"> / {counts.total}</span></p>
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

      {/* فلاتر */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
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
          <Clock3 className="h-3.5 w-3.5" /> المخاطرة حُسبت اليوم بقواعد الملحق ب — قابلة للشرح، وليست عقوبة آلية
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
                  <p className="flex items-center gap-1 text-[10px] text-white/40">
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
                    <p className="mt-1.5 text-[11px] text-white/40">
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
