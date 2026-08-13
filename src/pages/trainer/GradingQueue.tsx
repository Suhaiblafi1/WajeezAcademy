import { useMemo, useState } from "react";
import {
  CheckCircle2, ChevronDown, ChevronUp, FileText, History, Lock, RotateCcw, X,
} from "lucide-react";
import TrainerLayout, { trainerIdentity } from "./TrainerLayout";
import {
  loadSubmissions, gradeSubmission, closeGrading, requestGradeChange,
  loadGradeAudit, ASSIGNMENT_RUBRIC, type Submission, type SubmissionStatus,
} from "@/data/trainer";

const STATUS_LABEL: Record<SubmissionStatus, { label: string; cls: string }> = {
  pending: { label: "بانتظار التقييم", cls: "bg-[#FABC05]/15 text-[#FABC05]" },
  approved: { label: "معتمد", cls: "bg-[#38A7B4]/15 text-[#6EC7D1]" },
  revision: { label: "طُلب تعديل", cls: "bg-orange-500/15 text-orange-300" },
  closed: { label: "مغلق نهائيا", cls: "bg-white/10 text-white/45" },
};

/** طابور تقييم الواجبات — US-09: قائمة submissions + rubric + filters + feedback + audit */
export default function GradingQueue() {
  const me = trainerIdentity()!;
  const [tick, setTick] = useState(0);
  const subs = useMemo(() => loadSubmissions(me.name), [me.name, tick]);
  const audit = useMemo(() => loadGradeAudit(), [tick]);
  const [filter, setFilter] = useState<"pending" | "reviewed" | "all">("pending");
  const [openId, setOpenId] = useState<string | null>(null);
  const [rubric, setRubric] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState("");
  const [editGrade, setEditGrade] = useState<{ id: string; value: string; reason: string } | null>(null);

  const shown = subs.filter((s) =>
    filter === "all" ? true : filter === "pending" ? s.status === "pending" : s.status !== "pending"
  );

  const startGrading = (s: Submission) => {
    setOpenId(openId === s.id ? null : s.id);
    setRubric(s.rubric ?? Object.fromEntries(ASSIGNMENT_RUBRIC.map((r) => [r.key, 0])));
    setFeedback(s.feedback ?? "");
  };

  const grade = (id: string, decision: "approved" | "revision") => {
    gradeSubmission(me.name, id, rubric, feedback, decision);
    setOpenId(null);
    setTick(tick + 1);
  };

  const totalOf = (r: Record<string, number>) =>
    ASSIGNMENT_RUBRIC.reduce((sum, cr) => sum + Math.min(r[cr.key] ?? 0, cr.weight), 0);

  return (
    <TrainerLayout title="طابور التقييم — الواجبات المسلمة">
      {/* فلاتر */}
      <div className="flex flex-wrap items-center gap-2">
        {(["pending", "reviewed", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`cursor-pointer rounded-full border px-4 py-1.5 text-xs font-bold transition ${
              filter === f ? "border-[#38A7B4] bg-[#38A7B4] text-[#08272B]" : "border-white/10 text-white/55 hover:border-white/30"
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
                <FileText className="h-5 w-5 shrink-0 text-[#6EC7D1]" />
                <div className="min-w-0 flex-1">
                  <p className="font-black">{s.studentName} — {s.assignmentTitle}</p>
                  <p className="mt-0.5 text-xs text-white/50">{s.courseName} · {s.fileName} · سُلم {s.at}</p>
                </div>
                {s.grade !== undefined && <span className="text-lg font-black text-[#6EC7D1]">{s.grade}</span>}
                <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${meta.cls}`}>{meta.label}</span>
                {open ? <ChevronUp className="h-4 w-4 text-white/40" /> : <ChevronDown className="h-4 w-4 text-white/40" />}
              </button>

              {open && (
                <div className="mt-5 border-t border-white/10 pt-5">
                  {/* الروبريك */}
                  <div className="grid gap-3 sm:grid-cols-3">
                    {ASSIGNMENT_RUBRIC.map((cr) => (
                      <div key={cr.key} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-xs font-bold text-white/70">{cr.label} <span className="text-white/40">({cr.weight})</span></p>
                        <input
                          type="range" min={0} max={cr.weight}
                          value={rubric[cr.key] ?? 0}
                          disabled={s.status === "closed"}
                          onChange={(e) => setRubric({ ...rubric, [cr.key]: Number(e.target.value) })}
                          className="mt-3 w-full accent-[#38A7B4]"
                        />
                        <p className="mt-1 text-center font-black text-[#6EC7D1]">{rubric[cr.key] ?? 0}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-center text-sm">
                    الدرجة الإجمالية: <span className="text-xl font-black text-[#FABC05]">{totalOf(rubric)}</span> / 100
                  </p>
                  <textarea
                    value={feedback}
                    disabled={s.status === "closed"}
                    onChange={(e) => setFeedback(e.target.value)}
                    rows={3}
                    placeholder="ملاحظاتك للطالب — تصله كما تكتبها، فاجعلها عملية ومحفزة…"
                    className="mt-3 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-[#38A7B4] focus:outline-none disabled:opacity-50"
                  />
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {s.status !== "closed" && (
                      <>
                        <button
                          onClick={() => grade(s.id, "approved")}
                          disabled={!feedback.trim()}
                          className="flex cursor-pointer items-center gap-2 rounded-full bg-[#38A7B4] px-5 py-2.5 text-sm font-black text-[#08272B] transition hover:bg-[#6EC7D1] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <CheckCircle2 className="h-4 w-4" /> اعتماد بالدرجة
                        </button>
                        <button
                          onClick={() => grade(s.id, "revision")}
                          disabled={!feedback.trim()}
                          className="flex cursor-pointer items-center gap-2 rounded-full border border-orange-400/50 px-5 py-2.5 text-sm font-black text-orange-300 transition hover:bg-orange-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <RotateCcw className="h-4 w-4" /> طلب تعديل
                        </button>
                      </>
                    )}
                    {s.status === "approved" && (
                      <>
                        <button
                          onClick={() => { closeGrading(me.name, s.id); setTick(tick + 1); setOpenId(null); }}
                          className="flex cursor-pointer items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 text-sm font-bold text-white/70 transition hover:border-white/40"
                        >
                          <Lock className="h-4 w-4" /> إغلاق التقييم نهائيا
                        </button>
                        <button
                          onClick={() => setEditGrade({ id: s.id, value: String(s.grade ?? ""), reason: "" })}
                          className="cursor-pointer rounded-full border border-[#FABC05]/40 px-5 py-2.5 text-sm font-bold text-[#FABC05] transition hover:bg-[#FABC05]/10"
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
                        {h.action} — {h.by} · {h.at.slice(0, 10)}
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
          <p className="flex items-center gap-2 text-sm font-black"><History className="h-4 w-4 text-[#FABC05]" /> سجل تعديل الدرجات بعد الاعتماد</p>
          <div className="mt-3 space-y-2">
            {audit.map((a, i) => (
              <p key={i} className="rounded-xl border border-white/5 bg-black/20 px-4 py-2.5 text-xs leading-6 text-white/60">
                عدّلت درجة {a.submissionId} من {a.oldGrade} إلى {a.newGrade} — السبب: «{a.reason}» · {a.at.slice(0, 10)}
              </p>
            ))}
          </div>
        </section>
      )}

      {/* نافذة تعديل الدرجة */}
      {editGrade && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#151515] p-6">
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
              className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-2.5 text-sm text-white focus:border-[#FABC05] focus:outline-none"
            />
            <label className="mt-3 block text-xs font-bold text-white/60">السبب (إلزامي)</label>
            <textarea
              value={editGrade.reason}
              onChange={(e) => setEditGrade({ ...editGrade, reason: e.target.value })}
              rows={2}
              placeholder="مثال: احتُسب خطأ في معيار التوثيق بعد مراجعة الملف مجددا"
              className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[#FABC05] focus:outline-none"
            />
            <button
              onClick={() => {
                const g = Math.max(0, Math.min(100, Number(editGrade.value)));
                if (requestGradeChange(me.name, editGrade.id, g, editGrade.reason)) {
                  setEditGrade(null);
                  setTick(tick + 1);
                }
              }}
              disabled={!editGrade.reason.trim() || editGrade.value === ""}
              className="mt-5 w-full cursor-pointer rounded-full bg-[#FABC05] py-3 font-black text-[#0D0D0D] transition hover:bg-[#FABC05]/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              سجّل التعديل موثقا
            </button>
          </div>
        </div>
      )}
    </TrainerLayout>
  );
}
