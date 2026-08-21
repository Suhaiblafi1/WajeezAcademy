import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  CheckCircle2, ChevronDown, ChevronUp, FileText, History, Loader2, Lock, RotateCcw, X, XCircle,
} from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import { trainerIdentity } from "./trainer-identity";
import { fmtWhen } from "@/utils/format";
import { apiGet } from "@/services/api";
import { useRealSession } from "@/services/session";
import {
  loadSubmissions, gradeSubmission, closeGrading, requestGradeChange, rejectSubmission,
  loadGradeAudit, ASSIGNMENT_RUBRIC, type Submission, type SubmissionStatus,
} from "@/data/trainer";

interface RealQueueItem {
  id: string; status: string; submittedAt: string;
  assessment: { title: string; cohort: { title: string } };
}

const STATUS_LABEL: Record<SubmissionStatus, { label: string; cls: string }> = {
  pending: { label: "بانتظار التقييم", cls: "bg-gold/15 text-gold-ink" },
  approved: { label: "معتمد", cls: "bg-teal/15 text-teal-light-ink" },
  revision: { label: "طُلب تعديل", cls: "bg-orange-500/15 text-orange-300" },
  rejected: { label: "مرفوض بسبب موثق", cls: "bg-red-500/15 text-red-300" },
  closed: { label: "مغلق نهائيا", cls: "bg-white/10 text-white/45" },
};

/** طابور تقييم الواجبات — US-09: قائمة submissions + rubric + filters + feedback + audit */
function LocalGradingQueue() {
  const me = trainerIdentity();
  const meName = me?.name ?? ""; // الإطار يعرض بوابة الهوية عند غيابها
  const [tick, setTick] = useState(0);
  const subs = useMemo(() => { void tick; return loadSubmissions(meName); }, [meName, tick]); // tick عداد إبطال مقصود بعد كل كتابة
  const audit = useMemo(() => { void tick; return loadGradeAudit(); }, [tick]); // tick عداد إبطال مقصود بعد كل كتابة
  const [filter, setFilter] = useState<"pending" | "reviewed" | "all">("pending");
  const [openId, setOpenId] = useState<string | null>(null);
  const [rubric, setRubric] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState("");
  const [editGrade, setEditGrade] = useState<{ id: string; value: string; reason: string } | null>(null);
  const [rejecting, setRejecting] = useState<{ id: string; reason: string } | null>(null);

  const shown = subs.filter((s) =>
    filter === "all" ? true : filter === "pending" ? s.status === "pending" : s.status !== "pending"
  );

  const startGrading = (s: Submission) => {
    setOpenId(openId === s.id ? null : s.id);
    setRubric(s.rubric ?? Object.fromEntries(ASSIGNMENT_RUBRIC.map((r) => [r.key, 0])));
    setFeedback(s.feedback ?? "");
  };

  const grade = (id: string, decision: "approved" | "revision") => {
    gradeSubmission(meName, id, rubric, feedback, decision);
    setOpenId(null);
    setTick(tick + 1);
  };

  const totalOf = (r: Record<string, number>) =>
    ASSIGNMENT_RUBRIC.reduce((sum, cr) => sum + Math.min(r[cr.key] ?? 0, cr.weight), 0);

  /* اختصارات لوحة المفاتيح أثناء مراجعة تسليم مفتوح:
     G/غ اعتماد · R/ر طلب تعديل · Esc إغلاق — لا تعمل داخل حقول الكتابة */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable) return;
      if (!openId) return;
      const sub = subs.find((x) => x.id === openId);
      if (!sub || (sub.status !== "pending" && sub.status !== "revision")) return;
      const k = e.key.toLowerCase();
      if (k === "g" || e.key === "غ") { if (feedback.trim()) grade(openId, "approved"); }
      else if (k === "r" || e.key === "ر") { if (feedback.trim()) grade(openId, "revision"); }
      else if (e.key === "Escape") setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <TrainerLayout title="طابور التقييم — الواجبات المسلمة">
      {/* فلاتر */}
      <div className="flex flex-wrap items-center gap-2">
        {(["pending", "reviewed", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`cursor-pointer rounded-full border px-4 py-1.5 text-xs font-bold transition ${
              filter === f ? "border-teal bg-teal text-on-teal" : "border-white/10 text-white/55 hover:border-white/30"
            }`}
          >
            {f === "pending" ? `بانتظار التقييم (${subs.filter((s) => s.status === "pending").length})` : f === "reviewed" ? "قُيّمت" : "الكل"}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {shown.length === 0 && (
          <p className="rounded-3xl border border-white/10 bg-white/[0.02] py-12 text-center text-sm text-white/45">
            لا تسليمات في هذا التصنيف — أحسنت متابعة طابورك!
          </p>
        )}
        {shown.map((s) => {
          const meta = STATUS_LABEL[s.status];
          const open = openId === s.id;
          return (
            <div key={s.id} className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
              <button onClick={() => startGrading(s)} className="flex w-full cursor-pointer flex-wrap items-center gap-4 text-right">
                <FileText className="h-5 w-5 shrink-0 text-teal-light-ink" />
                <div className="min-w-0 flex-1">
                  <p className="font-black">{s.studentName} — {s.assignmentTitle}</p>
                  <p className="mt-0.5 text-xs text-white/50">{s.courseName} · {s.fileName} · سُلم {fmtWhen(s.at)}</p>
                </div>
                {s.grade !== undefined && <span className="text-lg font-black text-teal-light-ink">{s.grade}</span>}
                <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${meta.cls}`}>{meta.label}</span>
                {open ? <ChevronUp className="h-4 w-4 text-white/50" /> : <ChevronDown className="h-4 w-4 text-white/50" />}
              </button>

              {open && (
                <div className="mt-5 border-t border-white/10 pt-5">
                  {/* الروبريك */}
                  <div className="grid gap-3 sm:grid-cols-3">
                    {ASSIGNMENT_RUBRIC.map((cr) => (
                      <div key={cr.key} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-xs font-bold text-white/70">{cr.label} <span className="text-white/50">({cr.weight})</span></p>
                        <input
                          type="range" min={0} max={cr.weight}
                          value={rubric[cr.key] ?? 0}
                          disabled={s.status === "closed"}
                          onChange={(e) => setRubric({ ...rubric, [cr.key]: Number(e.target.value) })}
                          className="mt-3 w-full accent-teal"
                        />
                        <p className="mt-1 text-center font-black text-teal-light-ink">{rubric[cr.key] ?? 0}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-center text-sm">
                    الدرجة الإجمالية: <span className="text-xl font-black text-gold-ink">{totalOf(rubric)}</span> / 100
                  </p>
                  <textarea
                    value={feedback}
                    disabled={s.status === "closed"}
                    onChange={(e) => setFeedback(e.target.value)}
                    rows={3}
                    placeholder="ملاحظاتك للطالب — تصله كما تكتبها، فاجعلها عملية ومحفزة…"
                    className="mt-3 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-teal focus:outline-none disabled:opacity-50"
                  />
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {(s.status === "pending" || s.status === "revision") && (
                      <>
                        <button
                          onClick={() => grade(s.id, "approved")}
                          disabled={!feedback.trim()}
                          title="اختصار: G"
                          className="flex cursor-pointer items-center gap-2 rounded-full bg-teal px-5 py-2.5 text-sm font-black text-on-teal transition hover:bg-teal-light disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <CheckCircle2 className="h-4 w-4" /> اعتماد بالدرجة
                          <kbd className="rounded-md bg-black/25 px-1.5 py-0.5 text-[9px] font-black">G</kbd>
                        </button>
                        <button
                          onClick={() => grade(s.id, "revision")}
                          disabled={!feedback.trim()}
                          title="اختصار: R"
                          className="flex cursor-pointer items-center gap-2 rounded-full border border-orange-400/50 px-5 py-2.5 text-sm font-black text-orange-300 transition hover:bg-orange-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <RotateCcw className="h-4 w-4" /> طلب تعديل
                          <kbd className="rounded-md bg-black/25 px-1.5 py-0.5 text-[9px] font-black">R</kbd>
                        </button>
                        <button
                          onClick={() => setRejecting({ id: s.id, reason: "" })}
                          className="flex cursor-pointer items-center gap-2 rounded-full border border-red-500/50 px-5 py-2.5 text-sm font-black text-red-300 transition hover:bg-red-500/10"
                        >
                          <XCircle className="h-4 w-4" /> رفض بسبب
                        </button>
                        <span className="text-[10px] text-white/50">اختصارات: G اعتماد · R طلب تعديل · Esc إغلاق — تتطلب ملاحظات مكتوبة</span>
                      </>
                    )}
                    {s.status === "rejected" && s.rejectReason && (
                      <p className="w-full rounded-xl border border-red-500/25 bg-red-500/5 px-4 py-2.5 text-xs leading-6 text-red-200">
                        سبب الرفض الموثق: {s.rejectReason}
                      </p>
                    )}
                    {s.status === "approved" && (
                      <>
                        <button
                          onClick={() => { closeGrading(meName, s.id); setTick(tick + 1); setOpenId(null); }}
                          className="flex cursor-pointer items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 text-sm font-bold text-white/70 transition hover:border-white/40"
                        >
                          <Lock className="h-4 w-4" /> إغلاق التقييم نهائيا
                        </button>
                        <button
                          onClick={() => setEditGrade({ id: s.id, value: String(s.grade ?? ""), reason: "" })}
                          className="cursor-pointer rounded-full border border-gold/40 px-5 py-2.5 text-sm font-bold text-gold-ink transition hover:bg-gold/10"
                        >
                          تعديل الدرجة (بسبب موثق)
                        </button>
                      </>
                    )}
                  </div>

                  {/* سجل التسليم */}
                  <div className="mt-5 rounded-2xl border border-white/5 bg-black/20 p-4">
                    <p className="flex items-center gap-2 text-[11px] font-bold text-white/50"><History className="h-3.5 w-3.5" /> سجل هذا التسليم</p>
                    {s.history.map((h, i) => (
                      <p key={i} className="mt-1.5 text-[11px] text-white/45">
                        {h.action} — {h.by} · {fmtWhen(h.at)}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* سجل تعديل الدرجات — مفتوح للمراجعة */}
      {audit.length > 0 && (
        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <p className="flex items-center gap-2 text-sm font-black"><History className="h-4 w-4 text-gold-ink" /> سجل تعديل الدرجات بعد الاعتماد</p>
          <div className="mt-3 space-y-2">
            {audit.map((a, i) => (
              <p key={i} className="rounded-xl border border-white/5 bg-black/20 px-4 py-2.5 text-xs leading-6 text-white/60">
                عدّلت درجة {a.submissionId} من {a.oldGrade} إلى {a.newGrade} — السبب: «{a.reason}» · {fmtWhen(a.at)}
              </p>
            ))}
          </div>
        </section>
      )}

      {/* نافذة تعديل الدرجة */}
      {editGrade && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-surface p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-black">تعديل درجة معتمدة</h3>
              <button onClick={() => setEditGrade(null)} className="cursor-pointer text-white/50 hover:text-white" aria-label="إغلاق"><X className="h-5 w-5" /></button>
            </div>
            <p className="mt-2 text-xs leading-6 text-white/55">
              تعديل درجة بعد اعتمادها يحتاج سببا واضحا — سيُسجل في سجل المراجعة مع القيمة السابقة والجديدة (15.2).
            </p>
            <label className="mt-4 block text-xs font-bold text-white/60">الدرجة الجديدة</label>
            <input
              type="number" min={0} max={100}
              value={editGrade.value}
              onChange={(e) => setEditGrade({ ...editGrade, value: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-2.5 text-sm text-white focus:border-gold focus:outline-none"
            />
            <label className="mt-3 block text-xs font-bold text-white/60">السبب (إلزامي)</label>
            <textarea
              value={editGrade.reason}
              onChange={(e) => setEditGrade({ ...editGrade, reason: e.target.value })}
              rows={2}
              placeholder="مثال: احتُسب خطأ في معيار التوثيق بعد مراجعة الملف مجددا"
              className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-gold focus:outline-none"
            />
            <button
              onClick={() => {
                const g = Math.max(0, Math.min(100, Number(editGrade.value)));
                if (requestGradeChange(meName, editGrade.id, g, editGrade.reason)) {
                  setEditGrade(null);
                  setTick(tick + 1);
                }
              }}
              disabled={!editGrade.reason.trim() || editGrade.value === ""}
              className="mt-5 w-full cursor-pointer rounded-full bg-gold py-3 font-black text-on-gold transition hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              سجّل التعديل موثقا
            </button>
          </div>
        </div>
      )}

      {/* نافذة رفض التسليم بسبب موثق */}
      {rejecting && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-surface p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-black">رفض التسليم</h3>
              <button onClick={() => setRejecting(null)} className="cursor-pointer text-white/50 hover:text-white" aria-label="إغلاق"><X className="h-5 w-5" /></button>
            </div>
            <p className="mt-2 text-xs leading-6 text-white/55">
              الرفض قرار نهائي على هذا التسليم — يتطلب سببا مفهوما يظهر للطالب ويُسجل في سجل المراجعة، كما يفرض الخادم.
            </p>
            <label className="mt-4 block text-xs font-bold text-white/60">سبب الرفض (إلزامي)</label>
            <textarea
              value={rejecting.reason}
              onChange={(e) => setRejecting({ ...rejecting, reason: e.target.value })}
              rows={3}
              placeholder="مثال: التسليم لا يتوافق مع موضوع الواجب المطلوب — راجع وصف المهمة"
              className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-red-400 focus:outline-none"
            />
            <button
              onClick={() => {
                if (rejectSubmission(meName, rejecting.id, rejecting.reason)) {
                  setRejecting(null);
                  setOpenId(null);
                  setTick(tick + 1);
                }
              }}
              disabled={!rejecting.reason.trim()}
              className="mt-5 w-full cursor-pointer rounded-full bg-red-500 py-3 font-black text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              سجّل الرفض موثقا
            </button>
          </div>
        </div>
      )}
    </TrainerLayout>
  );
}

/* ── الطابور الحقيقي للمدرب المسجّل — من الخادم، والتقييم من شاشة «شعبي» ── */
function RealGradingQueue() {
  const [realQueue, setRealQueue] = useState<RealQueueItem[] | null>(null);
  useEffect(() => {
    apiGet<RealQueueItem[]>("/api/trainer/grading-queue").then(setRealQueue).catch(() => setRealQueue([]));
  }, []);
  const actionable = (realQueue ?? []).filter((q) => q.status === "submitted" || q.status === "under_review");
  return (
    <TrainerLayout title="طابور التقييم">
      {realQueue === null ? (
        <div className="flex items-center justify-center gap-2 py-16 text-white/50">
          <Loader2 className="h-5 w-5 animate-spin" /> أحضر الطابور…
        </div>
      ) : actionable.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-teal-light-ink" />
          <h2 className="mt-4 text-lg font-black">الطابور نظيف — لا تسليمات بانتظارك</h2>
          <p className="mt-2 text-sm text-white/55">كل ما وصلك قيّمته. أحسنت.</p>
          {/* الفراغ فرصة توجيه لا مساحة ميتة — خطوات تالية نافعة بدل صفحة خالية */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Link
              to="/trainer/board"
              className="inline-flex min-h-11 items-center rounded-full border border-teal/40 bg-teal/10 px-5 text-sm font-bold text-teal-light transition hover:bg-teal/20"
            >
              افتح شعبي وسجّل الحضور
            </Link>
            <Link
              to="/trainer/proposals"
              className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-5 text-sm font-bold text-white/80 transition hover:border-white/30 hover:text-white"
            >
              اقترح تحسينا على المحتوى
            </Link>
            <Link
              to="/trainer/earnings"
              className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-5 text-sm font-bold text-white/80 transition hover:border-white/30 hover:text-white"
            >
              راجع مستحقاتي
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-white/60">لديك {actionable.length} {actionable.length === 1 ? "تسليم يحتاج" : "تسليمات تحتاج"} تقييمك:</p>
          {actionable.map((q) => (
            <Link key={q.id} to="/trainer/board" className="flex items-center gap-3 rounded-2xl border border-gold/30 bg-gold/5 px-5 py-4 text-sm transition hover:border-gold/60">
              <FileText className="h-4 w-4 shrink-0 text-gold-ink" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-white/85">{q.assessment.title}</p>
                <p className="mt-0.5 text-[11px] text-white/50">
                  {q.assessment.cohort.title} · أُرسل {new Date(q.submittedAt).toLocaleString("ar-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-gold px-3 py-1 text-[11px] font-black text-on-gold">قيّمه من «شعبي»</span>
            </Link>
          ))}
        </div>
      )}
    </TrainerLayout>
  );
}

/** الغلاف: جلسة مدرب حقيقية بلا هوية استعراض → الطابور الحقيقي؛ وإلا النسخة المحلية */
export default function GradingQueue() {
  const me = trainerIdentity();
  const { user, checked } = useRealSession();
  if (checked && !me && user?.permissions.includes("trainer.portal")) return <RealGradingQueue />;
  return <LocalGradingQueue />;
}
