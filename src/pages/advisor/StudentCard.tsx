import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import {
  AlertTriangle, ArrowRight, CalendarClock, CalendarPlus, CheckCircle2, FileText,
  GitBranch, History, ListChecks, MessageSquarePlus, ShieldAlert, StickyNote, X,
} from "lucide-react";
import AdvisorLayout from "./AdvisorLayout";
import { advisorIdentity } from "./advisor-identity";
import { toast } from "@/components/Toast";
import { fmtWhen } from "@/utils/format";
import {
  loadAdvisorStudents, riskScore, riskLevel, nextBestAction,
  studentPathwayName, studentCourseCount, currentCourseName, logAudit, RISK_RULES,
  caseForStudent, setCaseStatus, setCaseNextAction, addCaseTask, completeCaseTask,
  addCaseFollowUp, completeCaseFollowUp, addCaseContact, addCaseNote, viewCaseCv,
  caseSeenAt, markCaseSeen, isNewSince,
  CASE_STATUSES, CASE_STATUS_META, CHANNEL_LABEL, isOverdue, fmtDT,
  type CaseStatus, type ContactChannel,
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
  const [tab, setTab] = useState<"overview" | "case">("overview");
  const [tick, setTick] = useState(0);
  const [confirmEnd, setConfirmEnd] = useState<CaseStatus | null>(null);
  /* «جديد منذ آخر زيارة» — التقط وقت آخر زيارة قبل هذه، وحدّثه عند المغادرة */
  const [seenAt] = useState<string | null>(() => (id ? caseSeenAt(id) : null));
  useEffect(() => () => { if (id) markCaseSeen(id); }, [id]);
  void tick;

  /* نماذج ملف الحالة */
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [fuWhen, setFuWhen] = useState("");
  const [fuChannel, setFuChannel] = useState<ContactChannel>("whatsapp");
  const [fuNote, setFuNote] = useState("");
  const [fuDoneId, setFuDoneId] = useState<string | null>(null);
  const [fuOutcome, setFuOutcome] = useState("");
  const [ctChannel, setCtChannel] = useState<ContactChannel>("whatsapp");
  const [ctDir, setCtDir] = useState<"out" | "in">("out");
  const [ctSummary, setCtSummary] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [naText, setNaText] = useState<string | null>(null);
  const [naWhen, setNaWhen] = useState<string | null>(null);

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
  const advisorMsg = `مرحبا ${s.name.split(" ")[0]}، معك ${me?.name ?? "مستشارك"} من أكاديمية وجيز — أتابع تقدمك في مسارك وأردت الاطمئنان عليك.`;
  const kase = caseForStudent(s.id);
  const myName = me?.name ?? "مستشار";

  const submitWorkflow = () => {
    logAudit(myName, `طلب تغيير دورة إلى «${courseById(swapCourse)?.name ?? swapCourse}» — بانتظار موافقة المنسق`, s.id);
    toast("أُرسل طلب التغيير لسير الموافقات — سيُنفذ بعد اعتماد المنسق ويُوثق في السجل.");
    setWorkflow(false);
  };

  /* ── إجراءات ملف الحالة — كل واحدة توثق في السجل كما يفعل الخادم ── */
  const act = (fn: () => void, audit: string) => {
    fn();
    logAudit(myName, audit, s.id);
    setTick((t) => t + 1);
  };
  /* حالات الإنهاء (مغلقة/غير مهتم) تحتاج نقرة تأكيد ثانية — قرار إنهاء لا يحدث بزر عابر */
  const changeStatus = (to: CaseStatus) => {
    if (!kase) return;
    const isEnding = to === "closed" || to === "not_interested";
    if (isEnding && confirmEnd !== to) {
      setConfirmEnd(to);
      return;
    }
    setConfirmEnd(null);
    act(() => setCaseStatus(kase.id, to, myName), `غيّر حالة الحالة إلى «${CASE_STATUS_META[to].label}»`);
  };
  const saveNextAction = () => {
    if (!kase) return;
    const text = (naText ?? kase.nextAction ?? "").trim();
    if (text.length < 3) return;
    act(() => setCaseNextAction(kase.id, text, naWhen ?? kase.nextFollowUpAt), `حدد الإجراء التالي: «${text}»`);
    toast("حُفظ الإجراء التالي وموعد المتابعة — كما في POST /api/advisor/cases/:id/next-action.");
  };
  const submitTask = () => {
    if (!kase || taskTitle.trim().length < 3) return;
    act(() => addCaseTask(kase.id, taskTitle.trim(), taskDue || undefined), `أضاف مهمة: «${taskTitle.trim()}»`);
    setTaskTitle(""); setTaskDue("");
  };
  const submitFollowUp = () => {
    if (!kase || !fuWhen) return;
    act(() => addCaseFollowUp(kase.id, fuWhen, fuChannel, fuNote.trim() || undefined), `جدول متابعة ${CHANNEL_LABEL[fuChannel]} في ${fmtDT(fuWhen)}`);
    setFuWhen(""); setFuNote("");
  };
  const submitFollowUpDone = (fuId: string) => {
    if (!kase || fuOutcome.trim().length < 2) return;
    act(() => completeCaseFollowUp(kase.id, fuId, fuOutcome.trim()), `أنجز متابعة بنتيجة: «${fuOutcome.trim()}»`);
    setFuDoneId(null); setFuOutcome("");
  };
  const submitContact = () => {
    if (!kase || ctSummary.trim().length < 3) return;
    const wasNew = kase.status === "new";
    act(
      () => addCaseContact(kase.id, ctChannel, ctDir, ctSummary.trim(), myName),
      `سجل تواصلا (${CHANNEL_LABEL[ctChannel]}، ${ctDir === "out" ? "صادر" : "وارد"})${wasNew ? " — نُقلت الحالة إلى «تم التواصل» تلقائيا" : ""}`
    );
    setCtSummary("");
    if (wasNew) toast("أول تواصل مسجل — انتقلت الحالة تلقائيا إلى «تم التواصل» كما يفعل الخادم.");
  };
  const submitNote = () => {
    if (!kase || noteBody.trim().length < 3) return;
    act(() => addCaseNote(kase.id, noteBody.trim(), myName), "أضاف ملاحظة داخلية (لا تظهر للعميل)");
    setNoteBody("");
  };
  const openCv = () => {
    if (!kase) return;
    act(() => viewCaseCv(kase.id, myName), "فتح رابط قراءة السيرة — مشاهدة مسجلة");
    toast("فُتح رابط قراءة موقع للسيرة وسُجلت مشاهدتك في السجل — كما في GET /api/cv/:id/read-url.");
  };

  return (
    <AdvisorLayout title={`بطاقة الطالب — ${s.name}`}>
      <Link to="/advisor" className="mb-5 inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white">
        <ArrowRight className="h-4 w-4" /> عودة للقائمة
      </Link>

      {/* تبويبات داخلية — الصفحة طويلة، فقُسّمت لنظرة عامة وملف الحالة */}
      <div className="mb-6 flex w-fit items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
        {([
          { key: "overview" as const, label: "نظرة عامة" },
          { key: "case" as const, label: "ملف الحالة التشغيلي" },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`cursor-pointer rounded-full px-5 py-2 text-sm font-bold transition ${
              tab === t.key ? "bg-[#38A7B4] text-[#08272B]" : "text-white/60 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
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
              <p><span className="text-white/50">الهدف: </span>{s.goal}</p>
              <p><span className="text-white/50">المسار النشط: </span>«{studentPathwayName(s)}»</p>
              <p><span className="text-white/50">درجة ثقة التوصية عند القبول: </span>{s.confidence}%</p>
              <p><span className="text-white/50">الدورة الحالية: </span>{currentCourseName(s)}</p>
              <p><span className="text-white/50">التقدم: </span>{courses.done} من {courses.total} دورات ({s.progressPct}%)</p>
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
                    active ? "border-red-500/30 bg-red-500/5 text-white/85" : "border-white/5 text-white/55"
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
            <p className="mt-3 text-[10px] leading-5 text-white/55">
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
                    <p className="text-[10px] text-white/55">{fmtWhen(e.at)}</p>
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
      )}

      {/* ════ ملف الحالة التشغيلي — يطابق مسارات operations.routes.ts ════ */}
      {tab === "case" && kase && (
        <section className="mt-6 space-y-5">
          {/* ترويسة: الحالة + الإسناد + السيرة */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-black">ملف الحالة التشغيلي — الحالات الثماني الموثقة</p>
              <div className="flex items-center gap-3 text-[11px] text-white/50">
                <span>مسندة إلى: <span className="font-bold text-[#6EC7D1]">{kase.assignedTo ?? "بلا مستشار"}</span></span>
                {kase.cv && (
                  <button
                    onClick={openCv}
                    className="flex cursor-pointer items-center gap-1.5 rounded-full border border-[#38A7B4]/50 px-3 py-1.5 font-bold text-[#6EC7D1] transition hover:bg-[#38A7B4]/10"
                    title={`${kase.cv.fileName} · ${kase.cv.sizeKb}KB — كل مشاهدة مسجلة`}
                  >
                    <FileText className="h-3.5 w-3.5" /> السيرة الذاتية
                    {kase.cv.views.length > 0 && <span className="rounded-full bg-[#38A7B4]/20 px-1.5">{kase.cv.views.length}</span>}
                  </button>
                )}
              </div>
            </div>
            {/* شريط الحالات الثماني — POST /api/advisor/cases/:id/status */}
            <div className="mt-4 flex flex-wrap gap-2">
              {CASE_STATUSES.map((st) => {
                const meta = CASE_STATUS_META[st];
                const active = kase.status === st;
                const confirming = confirmEnd === st;
                return (
                  <button
                    key={st}
                    onClick={() => changeStatus(st)}
                    disabled={active}
                    className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-bold transition disabled:cursor-default ${
                      active
                        ? "border-[#FABC05] bg-[#FABC05] text-[#0D0D0D]"
                        : confirming
                          ? "border-red-500 bg-red-500 text-white"
                          : `${meta.cls} hover:border-white/40`
                    }`}
                  >
                    {confirming ? `تأكيد: ${meta.label}؟` : meta.label}
                  </button>
                );
              })}
              {confirmEnd && (
                <span className="self-center text-[10px] text-red-300">إنهاء الحالة قرار مؤثر — اضغط «تأكيد» مجددا للمتابعة</span>
              )}
            </div>
            {/* الإجراء التالي وموعد المتابعة — POST /:id/next-action */}
            <div className="mt-4 flex flex-wrap items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="min-w-[220px] flex-1">
                <label className="text-[10px] font-bold text-white/45">الإجراء التالي</label>
                <input
                  value={naText ?? kase.nextAction ?? ""}
                  onChange={(e) => setNaText(e.target.value)}
                  placeholder="ما الخطوة القادمة مع هذا العميل؟"
                  className="mt-1 w-full rounded-xl border border-white/15 bg-[#0D0D0D] px-3 py-2 text-xs text-white focus:border-[#FABC05] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-white/45">موعد المتابعة القادم</label>
                <input
                  type="datetime-local"
                  value={naWhen ?? kase.nextFollowUpAt ?? ""}
                  onChange={(e) => setNaWhen(e.target.value)}
                  className="mt-1 block cursor-pointer rounded-xl border border-white/15 bg-[#0D0D0D] px-3 py-2 text-xs text-white [color-scheme:dark] focus:border-[#FABC05] focus:outline-none"
                />
              </div>
              <button
                onClick={saveNextAction}
                className="cursor-pointer rounded-full bg-[#38A7B4] px-5 py-2 text-xs font-black text-[#08272B] transition hover:bg-[#6EC7D1]"
              >
                حفظ
              </button>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {/* المهام — POST /:id/tasks + POST /tasks/:taskId/complete */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <p className="flex items-center gap-2 text-sm font-black"><ListChecks className="h-4 w-4 text-[#FABC05]" /> مهام الحالة</p>
              <div className="mt-3 space-y-2">
                {kase.tasks.length === 0 && (
                  <div className="rounded-xl border border-dashed border-white/15 px-3 py-4 text-center">
                    <p className="text-[11px] font-bold text-white/55">لا مهام على هذه الحالة بعد</p>
                    <p className="mt-1 text-[10px] leading-5 text-white/50">المهمة بوعد واضح: اكتب ما ستفعله لهذا العميل وحدد موعد استحقاقه في الحقلين أدناه — سيظهران في لوحتك.</p>
                  </div>
                )}
                {kase.tasks.map((t) => (
                  <div key={t.id} className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${
                    t.done ? "border-white/5 text-white/50 line-through" : isOverdue(t.dueAt) ? "border-red-500/40 bg-red-500/5 text-white/85" : "border-white/10 text-white/80"
                  }`}>
                    {!t.done && (
                      <button
                        onClick={() => act(() => completeCaseTask(kase.id, t.id), `أنجز مهمة: «${t.title}»`)}
                        className="mt-0.5 shrink-0 cursor-pointer text-white/30 transition hover:text-[#6EC7D1]"
                        title="إنجاز"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                    )}
                    <div>
                      <p className="leading-5">{t.title}</p>
                      {t.dueAt && <p className={`mt-0.5 text-[10px] ${t.done ? "" : isOverdue(t.dueAt) ? "font-bold text-red-400" : "text-white/50"}`}>
                        {t.done ? `أُنجزت ${fmtDT(t.doneAt)}` : `تستحق ${fmtDT(t.dueAt)}${isOverdue(t.dueAt) ? " — متأخرة" : ""}`}
                      </p>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                <input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="مهمة جديدة على الحالة…"
                  className="w-full rounded-xl border border-white/15 bg-[#0D0D0D] px-3 py-2 text-xs text-white focus:border-[#FABC05] focus:outline-none"
                />
                <div className="flex gap-2">
                  <input
                    type="datetime-local"
                    value={taskDue}
                    onChange={(e) => setTaskDue(e.target.value)}
                    className="min-w-0 flex-1 cursor-pointer rounded-xl border border-white/15 bg-[#0D0D0D] px-3 py-2 text-xs text-white [color-scheme:dark] focus:border-[#FABC05] focus:outline-none"
                  />
                  <button
                    onClick={submitTask}
                    disabled={taskTitle.trim().length < 3}
                    className="cursor-pointer rounded-full bg-[#FABC05] px-4 text-xs font-black text-[#0D0D0D] transition hover:bg-[#FABC05]/90 disabled:opacity-40"
                  >
                    أضف
                  </button>
                </div>
              </div>
            </div>

            {/* المتابعات — POST /:id/follow-ups + POST /follow-ups/:id/complete */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <p className="flex items-center gap-2 text-sm font-black"><CalendarClock className="h-4 w-4 text-[#38A7B4]" /> المتابعات المجدولة</p>
              <div className="mt-3 space-y-2">
                {kase.followUps.length === 0 && (
                  <div className="rounded-xl border border-dashed border-white/15 px-3 py-4 text-center">
                    <p className="text-[11px] font-bold text-white/55">لا متابعات مجدولة</p>
                    <p className="mt-1 text-[10px] leading-5 text-white/50">المتابعة المجدولة هي ما يمنع نسيان العميل — حدد موعدا وقناة أدناه وستنعكس على موعد متابعة الحالة ولوحتك.</p>
                  </div>
                )}
                {kase.followUps.map((f) => (
                  <div key={f.id} className={`rounded-xl border px-3 py-2 text-xs ${f.doneAt ? "border-white/5 text-white/50" : "border-white/10 text-white/80"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold">{fmtDT(f.scheduledAt)}{f.channel ? ` · ${CHANNEL_LABEL[f.channel]}` : ""}</p>
                      {!f.doneAt && (
                        <button
                          onClick={() => { setFuDoneId(fuDoneId === f.id ? null : f.id); setFuOutcome(""); }}
                          className="shrink-0 cursor-pointer rounded-full border border-[#38A7B4]/50 px-2.5 py-1 text-[10px] font-bold text-[#6EC7D1] hover:bg-[#38A7B4]/10"
                        >
                          إنجاز بنتيجة
                        </button>
                      )}
                    </div>
                    {f.note && <p className="mt-1 text-[11px] leading-5 text-white/50">{f.note}</p>}
                    {f.doneAt && <p className="mt-1 text-[11px] text-[#6EC7D1]">النتيجة: {f.outcome}</p>}
                    {fuDoneId === f.id && (
                      <div className="mt-2 flex gap-2">
                        <input
                          value={fuOutcome}
                          onChange={(e) => setFuOutcome(e.target.value)}
                          placeholder="نتيجة المتابعة…"
                          className="min-w-0 flex-1 rounded-xl border border-white/15 bg-[#0D0D0D] px-3 py-1.5 text-xs text-white focus:border-[#38A7B4] focus:outline-none"
                        />
                        <button
                          onClick={() => submitFollowUpDone(f.id)}
                          disabled={fuOutcome.trim().length < 2}
                          className="cursor-pointer rounded-full bg-[#38A7B4] px-3 text-[10px] font-black text-[#08272B] disabled:opacity-40"
                        >
                          سجّل
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                <div className="flex gap-2">
                  <input
                    type="datetime-local"
                    value={fuWhen}
                    onChange={(e) => setFuWhen(e.target.value)}
                    className="min-w-0 flex-1 cursor-pointer rounded-xl border border-white/15 bg-[#0D0D0D] px-3 py-2 text-xs text-white [color-scheme:dark] focus:border-[#38A7B4] focus:outline-none"
                  />
                  <select
                    value={fuChannel}
                    onChange={(e) => setFuChannel(e.target.value as ContactChannel)}
                    className="cursor-pointer rounded-xl border border-white/15 bg-[#0D0D0D] px-2 py-2 text-xs text-white focus:border-[#38A7B4] focus:outline-none"
                  >
                    {(Object.keys(CHANNEL_LABEL) as ContactChannel[]).filter((c) => c !== "in_app").map((c) => (
                      <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>
                    ))}
                  </select>
                </div>
                <input
                  value={fuNote}
                  onChange={(e) => setFuNote(e.target.value)}
                  placeholder="ملاحظة الموعد (اختياري)…"
                  className="w-full rounded-xl border border-white/15 bg-[#0D0D0D] px-3 py-2 text-xs text-white focus:border-[#38A7B4] focus:outline-none"
                />
                <button
                  onClick={submitFollowUp}
                  disabled={!fuWhen}
                  className="w-full cursor-pointer rounded-full border border-[#38A7B4]/50 py-2 text-xs font-black text-[#6EC7D1] transition hover:bg-[#38A7B4]/10 disabled:opacity-40"
                >
                  جدولة متابعة — تنعكس على موعد متابعة الحالة
                </button>
              </div>
            </div>

            {/* التواصل + الملاحظات الداخلية */}
            <div className="space-y-5">
              {/* تسجيل تواصل — POST /:id/contact */}
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                <p className="flex items-center gap-2 text-sm font-black"><MessageSquarePlus className="h-4 w-4 text-[#38A7B4]" /> سجل التواصل</p>
                <div className="mt-3 max-h-44 space-y-2 overflow-y-auto">
                  {kase.contacts.length === 0 && (
                    <div className="rounded-xl border border-dashed border-white/15 px-3 py-4 text-center">
                      <p className="text-[11px] font-bold text-white/55">لا تواصل مسجل بعد</p>
                      <p className="mt-1 text-[10px] leading-5 text-white/50">سجّل أول تواصل من الأسفل — ستنتقل الحالة تلقائياً إلى «تم التواصل».</p>
                    </div>
                  )}
                  {kase.contacts.map((c) => (
                    <div key={c.id} className="rounded-xl border border-white/10 px-3 py-2 text-xs">
                      <p className="flex items-center justify-between font-bold text-white/80">
                        <span className="flex items-center gap-2">
                          {CHANNEL_LABEL[c.channel]} · {c.direction === "out" ? "صادر" : "وارد"}
                          {isNewSince(c.at, seenAt) && <span className="rounded-full bg-[#FABC05]/20 px-1.5 py-0.5 text-[9px] font-black text-[#FABC05]">جديد</span>}
                        </span>
                        <span className="text-[10px] font-normal text-white/50">{fmtDT(c.at)}</span>
                      </p>
                      <p className="mt-1 leading-5 text-white/55">{c.summary}</p>
                      <p className="mt-0.5 text-[10px] text-white/50">{c.by}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                  <div className="flex gap-2">
                    <select
                      value={ctChannel}
                      onChange={(e) => setCtChannel(e.target.value as ContactChannel)}
                      className="flex-1 cursor-pointer rounded-xl border border-white/15 bg-[#0D0D0D] px-2 py-2 text-xs text-white focus:border-[#38A7B4] focus:outline-none"
                    >
                      {(Object.keys(CHANNEL_LABEL) as ContactChannel[]).map((c) => (
                        <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>
                      ))}
                    </select>
                    <select
                      value={ctDir}
                      onChange={(e) => setCtDir(e.target.value as "out" | "in")}
                      className="cursor-pointer rounded-xl border border-white/15 bg-[#0D0D0D] px-2 py-2 text-xs text-white focus:border-[#38A7B4] focus:outline-none"
                    >
                      <option value="out">صادر</option>
                      <option value="in">وارد</option>
                    </select>
                  </div>
                  <input
                    value={ctSummary}
                    onChange={(e) => setCtSummary(e.target.value)}
                    placeholder="ملخص التواصل…"
                    className="w-full rounded-xl border border-white/15 bg-[#0D0D0D] px-3 py-2 text-xs text-white focus:border-[#38A7B4] focus:outline-none"
                  />
                  <button
                    onClick={submitContact}
                    disabled={ctSummary.trim().length < 3}
                    className="w-full cursor-pointer rounded-full bg-[#38A7B4] py-2 text-xs font-black text-[#08272B] transition hover:bg-[#6EC7D1] disabled:opacity-40"
                  >
                    تسجيل تواصل
                  </button>
                </div>
              </div>

              {/* ملاحظات داخلية — POST /:id/notes */}
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                <p className="flex items-center gap-2 text-sm font-black">
                  <StickyNote className="h-4 w-4 text-[#FABC05]" /> ملاحظات داخلية
                  <span className="mr-auto rounded-full bg-[#FABC05]/15 px-2 py-0.5 text-[10px] font-bold text-[#FABC05]">لا تظهر للعميل</span>
                </p>
                <div className="mt-3 max-h-36 space-y-2 overflow-y-auto">
                  {kase.notes.length === 0 && (
                    <div className="rounded-xl border border-dashed border-[#FABC05]/20 px-3 py-4 text-center">
                      <p className="text-[11px] font-bold text-white/55">لا ملاحظات داخلية</p>
                      <p className="mt-1 text-[10px] leading-5 text-white/50">دون هنا ما لا يجب أن يراه العميل — حساسية، اتفاق شفهي، خطة تعامل. تبقى داخلية دائما.</p>
                    </div>
                  )}
                  {kase.notes.map((n) => (
                    <div key={n.id} className="rounded-xl border border-[#FABC05]/20 bg-[#FABC05]/5 px-3 py-2 text-xs">
                      <p className="flex items-start justify-between gap-2 leading-5 text-white/75">
                        {n.body}
                        {isNewSince(n.at, seenAt) && <span className="mt-0.5 shrink-0 rounded-full bg-[#FABC05]/20 px-1.5 py-0.5 text-[9px] font-black text-[#FABC05]">جديد</span>}
                      </p>
                      <p className="mt-1 text-[10px] text-white/50">{n.by} · {fmtDT(n.at)}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2 border-t border-white/10 pt-3">
                  <input
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                    placeholder="ملاحظة داخلية جديدة…"
                    className="min-w-0 flex-1 rounded-xl border border-white/15 bg-[#0D0D0D] px-3 py-2 text-xs text-white focus:border-[#FABC05] focus:outline-none"
                  />
                  <button
                    onClick={submitNote}
                    disabled={noteBody.trim().length < 3}
                    className="cursor-pointer rounded-full bg-[#FABC05] px-4 text-xs font-black text-[#0D0D0D] transition hover:bg-[#FABC05]/90 disabled:opacity-40"
                  >
                    أضف
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* سجل انتقالات الحالة — كل تغيير موثق */}
          {kase.history.length > 0 && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <p className="flex items-center gap-2 text-sm font-black"><History className="h-4 w-4 text-white/60" /> سجل انتقالات الحالة</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {kase.history.map((h, i) => (
                  <span key={i} className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[11px] text-white/60">
                    {CASE_STATUS_META[h.from].label} ← {CASE_STATUS_META[h.to].label} · {h.by} · {fmtDT(h.at)}{h.note ? ` · ${h.note}` : ""}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

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
