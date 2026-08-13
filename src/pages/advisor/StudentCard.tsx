import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import {
  AlertTriangle, ArrowRight, CalendarPlus, CheckCircle2, GitBranch,
  ShieldAlert, X,
} from "lucide-react";
import AdvisorLayout, { advisorIdentity } from "./AdvisorLayout";
import {
  loadAdvisorStudents, riskScore, riskLevel, nextBestAction,
  studentPathwayName, studentCourseCount, currentCourseName, logAudit, RISK_RULES,
} from "@/data/advisor";
import { pathwayCourses, courseById } from "@/data/courses";

const KIND_ICON: Record<string, string> = {
  message: "💬", call: "📞", payment: "💳", login: "🟢", complete: "🏁",
  absence: "⚠️", submission: "📤", grade: "📝", note: "📌",
};
import AdvisorContact from "@/components/AdvisorContact";

/** بطاقة الطالب للمستشار — القسم 14.2: خط زمني موحد + الإجراء الأفضل + تغيير المسار عبر موافقة */
export default function StudentCard() {
  const { id } = useParams();
  const students = useMemo(() => loadAdvisorStudents(), []);
  const s = students.find((x) => x.id === id);
  const me = advisorIdentity();
  const [workflow, setWorkflow] = useState(false);
  const [swapCourse, setSwapCourse] = useState("");
  const [sent, setSent] = useState<string | null>(null);

  if (!s) {
    return (
      <AdvisorLayout title="طالب غير موجود">
        <Link to="/advisor" className="flex items-center gap-2 text-[#6EC7D1]"><ArrowRight className="h-4 w-4" /> عودة لطلبةي</Link>
      </AdvisorLayout>
    );
  }

  const score = riskScore(s.signals);
  const level = riskLevel(score);
  const nba = nextBestAction(s);
  const courses = studentCourseCount(s);
  const ids = pathwayCourses[s.pathwayId] ?? [];
  const advisorMsg = `مرحبا ${s.name.split(" ")[0]}، معك ${me?.name ?? "مستشارك"} من أكاديمي وجيز — أتابع تقدمك في مسارك وأردت الاطمئنان عليك.`;

  const submitWorkflow = () => {
    logAudit(me?.name ?? "مستشار", `طلب تغيير دورة إلى «${courseById(swapCourse)?.name ?? swapCourse}» — بانتظار موافقة المنسق`, s.id);
    setSent(`أُرسل طلب التغيير لسير الموافقات — سيُنفذ بعد اعتماد المنسق، ويُوثق في سجل المراجعة. لا تعديل مباشر بلا أثر.`);
    setWorkflow(false);
  };

  return (
    <AdvisorLayout title={`بطاقة الطالب — ${s.name}`}>
      <Link to="/advisor" className="mb-5 inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white">
        <ArrowRight className="h-4 w-4" /> عودة للقائمة
      </Link>

      {sent && (
        <p className="mb-5 flex items-center gap-2 rounded-2xl border border-[#38A7B4]/40 bg-[#38A7B4]/10 px-4 py-3 text-sm font-bold text-[#6EC7D1]">
          <CheckCircle2 className="h-4 w-4" /> {sent}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* الملخص */}
        <section className="space-y-5">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-[#38A7B4] to-[#247B84] text-xl font-black">
                {s.name.charAt(0)}
              </span>
              <div>
                <p className="font-black">{s.name}</p>
                <p className="text-xs text-white/50">{s.role}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-xs leading-6">
              <p><span className="text-white/40">الهدف: </span>{s.goal}</p>
              <p><span className="text-white/40">المسار النشط: </span>«{studentPathwayName(s)}»</p>
              <p><span className="text-white/40">درجة ثقة التوصية عند القبول: </span>{s.confidence}%</p>
              <p><span className="text-white/40">الدورة الحالية: </span>{currentCourseName(s)}</p>
              <p><span className="text-white/40">التقدم: </span>{courses.done} من {courses.total} دورات ({s.progressPct}%)</p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#38A7B4]" style={{ width: `${Math.max(2, s.progressPct)}%` }} />
            </div>
          </div>

          {/* الإجراء الأفضل التالي */}
          <div className="rounded-3xl border border-[#FABC05]/30 bg-[#FABC05]/5 p-6">
            <p className="text-xs font-bold text-[#FABC05]">الإجراء الأفضل التالي</p>
            <p className="mt-2 font-black leading-7">{nba.action}</p>
            <p className="mt-1.5 text-xs leading-6 text-white/55">{nba.why}</p>
            {nba.channel === "whatsapp" && (
              <AdvisorContact
                text={advisorMsg}
                label="راسله"
                className="mt-4 flex items-center justify-center gap-2 rounded-full bg-[#25D366] py-2.5 text-sm font-black text-white hover:bg-[#25D366]/85"
              />
            )}
            {nba.channel === "booking" && (
              <button className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-[#FABC05]/50 py-2.5 text-sm font-black text-[#FABC05] hover:bg-[#FABC05]/10">
                <CalendarPlus className="h-4 w-4" /> احجز جلسة له
              </button>
            )}
          </div>
        </section>

        {/* المخاطرة + الخط الزمني */}
        <div className="space-y-5 lg:col-span-2">
          {/* إشارات الخطر — قابلة للشرح */}
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-black">
                <ShieldAlert className={`h-4 w-4 ${level === "red" ? "text-red-400" : level === "yellow" ? "text-[#FABC05]" : "text-[#38A7B4]"}`} />
                سجل المخاطرة — {score} نقطة
              </p>
              <span className={`rounded-full px-3 py-1 text-[11px] font-black ${
                level === "red" ? "bg-red-500/15 text-red-400" : level === "yellow" ? "bg-[#FABC05]/15 text-[#FABC05]" : "bg-[#38A7B4]/15 text-[#6EC7D1]"
              }`}>
                {level === "red" ? "أحمر 50+" : level === "yellow" ? "أصفر 25–49" : "أخضر 0–24"}
              </span>
            </div>
            <div className="mt-4 space-y-2">
              {RISK_RULES.map((r) => {
                const active = s.signals.find((x) => x.key === r.key)?.active;
                return (
                  <div key={r.key} className={`flex items-center justify-between rounded-xl border px-4 py-2.5 text-xs ${
                    active ? "border-red-500/30 bg-red-500/5 text-white/85" : "border-white/5 text-white/35"
                  }`}>
                    <span className="flex items-center gap-2">
                      {active ? <AlertTriangle className="h-3.5 w-3.5 text-red-400" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      {r.label}
                    </span>
                    <span className="font-black">{r.points > 0 ? `+${r.points}` : r.points}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[10px] leading-5 text-white/35">
              القواعد تُختبر وتُعدل دوريا، ولا تُستخدم لعقوبة آلية — القرار النهائي لك أنت كمستشار.
            </p>
          </section>

          {/* الخط الزمني الموحد */}
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <p className="text-sm font-black">الخط الزمني الموحد — رسائل ومكالمات ودفع ودخول وإكمال وغياب وتسليم وتقييم</p>
            <div className="mt-4 space-y-0">
              {s.timeline.map((e, i) => (
                <div key={i} className="relative flex gap-4 pb-5 pr-2">
                  {i < s.timeline.length - 1 && <span className="absolute right-[13px] top-6 h-full w-px bg-white/10" />}
                  <span className="z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 bg-[#151515] text-sm">
                    {KIND_ICON[e.kind] ?? "•"}
                  </span>
                  <div className="pt-1">
                    <p className="text-sm leading-6 text-white/80">{e.text}</p>
                    <p className="text-[10px] text-white/35">{e.at}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* تغيير المسار/الدورة — workflow موافقة لا تعديل مباشر */}
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-black"><GitBranch className="h-4 w-4 text-[#FABC05]" /> تغيير المسار أو الدورة</p>
                <p className="mt-1 text-[11px] text-white/45">يفتح سير موافقة موثقا — لا يعدل البيانات مباشرة بلا أثر (14.2).</p>
              </div>
              <button
                onClick={() => setWorkflow(true)}
                className="cursor-pointer rounded-full border border-[#FABC05]/50 px-5 py-2.5 text-sm font-black text-[#FABC05] transition hover:bg-[#FABC05]/10"
              >
                اطلب تغييرا
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* نافذة سير الموافقة */}
      {workflow && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#151515] p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-black">طلب تغيير دورة — {s.name}</h3>
              <button onClick={() => setWorkflow(false)} className="cursor-pointer text-white/50 hover:text-white" aria-label="إغلاق"><X className="h-5 w-5" /></button>
            </div>
            <p className="mt-2 text-xs leading-6 text-white/55">
              سيفحص الطلب: الأهلية، تكافؤ المهارة، سعة الشعبة، وأثر السعر — ثم يعتمد المنسق أو يرفض بسبب موثق.
            </p>
            <label className="mt-4 block text-xs font-bold text-white/60">الدورة البديلة المقترحة</label>
            <select
              value={swapCourse}
              onChange={(e) => setSwapCourse(e.target.value)}
              className="mt-1.5 w-full cursor-pointer rounded-xl border border-white/15 bg-[#0D0D0D] px-3 py-2.5 text-sm text-white focus:border-[#FABC05] focus:outline-none"
            >
              <option value="">— اختر من بدائل المسار —</option>
              {ids.map((cid) => {
                const c = courseById(cid);
                return c ? <option key={cid} value={cid}>{c.name}</option> : null;
              })}
            </select>
            <button
              onClick={submitWorkflow}
              disabled={!swapCourse}
              className="mt-5 w-full cursor-pointer rounded-full bg-[#FABC05] py-3 font-black text-[#0D0D0D] transition hover:bg-[#FABC05]/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              أرسل لسير الموافقات
            </button>
          </div>
        </div>
      )}
    </AdvisorLayout>
  );
}
