/* طابورُ التصحيح — حيث يُصحَّح فعلا (البند ٢٣).

   ─────────── ما كان ───────────

   كان التصحيحُ **في مكانين**: هذا التبويبُ يعرض قائمةَ تسليماتٍ لا يفعل بها
   شيئا، وكلُّ سطرٍ فيها زرٌّ يقول «قيّمه من شعبي» — بينما أدواتُ التصحيح
   كاملةً (المراجعة والدرجة والتغذية الراجعة) داخل لوحِ الشعب من ٧٢٤ سطرا،
   مدفونةً تحت الحضور والموادّ والتكليفات والرسائل واقتراحات التأجيل.

   فالمدرّبُ يفتح التبويبَ المسمّى باسم عمله، فيُحال منه إلى شاشةٍ أخرى
   يبحث فيها عن التسليم بين ستّة أقسام. وتبويبٌ لا يفعل ما يحمل اسمَه ليس
   اختصارا بل خطوةٌ زائدة.

   ─────────── وما صار ───────────

   الطابورُ هنا، والأدواتُ معه. ولوحُ الشعب لم يعد يحمله — فالتصحيحُ في
   موضعٍ واحد لا في موضعين. */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { CheckCircle2, Loader2, MessageSquarePlus, RefreshCw, ServerOff, Star } from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import { toast, toastError } from "@/components/Toast";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { fmtDateTimeAr } from "@/utils/format";

const SUBMISSION_STATUS: Record<string, string> = {
  submitted: "بانتظار المراجعة", under_review: "قيد المراجعة",
  resubmit_requested: "طُلبت إعادته", accepted: "مقبول", rejected: "مرفوض",
};

interface QueueItem {
  id: string; status: string; textAnswer: string | null; submittedAt: string; reviewNote: string | null;
  assessment: { title: string; maxScore: number; cohort: { title: string } };
  enrollment: { userId: string };
  grades: { score: string; maxScore: string }[];
  feedback: { body: string }[];
}

export default function GradingQueue() {
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [offline, setOffline] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({});
  const [gradeForm, setGradeForm] = useState<Record<string, string>>({});
  const [feedbackForm, setFeedbackForm] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setOffline(null);
    try {
      setQueue(await apiGet<QueueItem[]>("/api/trainer/grading-queue"));
    } catch (err) {
      setOffline(err instanceof ApiError ? err.message : "الخادم غير متصل — هذه الصفحة تتطلب جلسة مدرب حقيقية");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, doneMsg: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      toast(doneMsg);
      await load();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "تعذر تنفيذ الإجراء");
    } finally {
      setBusy(false);
    }
  };

  const reviewAction = (submissionId: string, action: string) =>
    act(() => apiPost(`/api/trainer/submissions/${submissionId}/review`, { action, note: reviewNote[submissionId] || undefined }),
      action === "accept" ? "قُبل التسليم" : action === "reject" ? "رُفض التسليم مع السبب" : action === "request_resubmit" ? "طُلبت إعادة التسليم" : "بدأت المراجعة");

  const grade = (submissionId: string, maxScore: number) =>
    act(async () => {
      const score = Number(gradeForm[submissionId]);
      await apiPost("/api/trainer/grade", { submissionId, score, maxScore });
      setGradeForm((prev) => ({ ...prev, [submissionId]: "" }));
    }, "سُجلت الدرجة — وأي تعديل لاحق سيوثق في السجل");

  const sendFeedback = (submissionId: string) =>
    act(async () => {
      await apiPost(`/api/trainer/submissions/${submissionId}/feedback`, { body: feedbackForm[submissionId] });
      setFeedbackForm((prev) => ({ ...prev, [submissionId]: "" }));
    }, "أُرسلت التغذية الراجعة للمتعلم");

  if (offline) {
    return (
      <TrainerLayout title="طابور التصحيح">
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-20 text-center">
          <ServerOff className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-xl font-black">لا يمكن الوصول للطابور</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">{offline}</p>
          <button onClick={() => void load()} className="mt-5 flex cursor-pointer items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-xs font-bold text-foreground hover:border-white/40">
            <RefreshCw className="h-3.5 w-3.5" /> إعادة المحاولة
          </button>
        </div>
      </TrainerLayout>
    );
  }

  if (queue === null) {
    return (
      <TrainerLayout title="طابور التصحيح">
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> أحضر الطابور…
        </div>
      </TrainerLayout>
    );
  }

  return (
    <TrainerLayout title="طابور التصحيح">
      {queue.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-teal-light-ink" />
          <h2 className="mt-4 text-lg font-black">الطابور نظيف — لا تسليمات بانتظارك</h2>
          <p className="mt-2 text-sm text-muted-foreground">كل ما وصلك قيّمته. أحسنت.</p>
          {/* الفراغ فرصة توجيه لا مساحة ميتة — خطوات تالية نافعة بدل صفحة خالية */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Link to="/trainer/board" className="inline-flex min-h-11 items-center rounded-full border border-teal/40 bg-teal/10 px-5 text-sm font-bold text-teal-light transition hover:bg-teal/20">
              افتح شعبي وسجّل الحضور
            </Link>
            <Link to="/trainer/learners" className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-5 text-sm font-bold text-foreground transition hover:border-white/30">
              تفقّد من تعثّر من متعلّميّ
            </Link>
            <Link to="/trainer/proposals" className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-5 text-sm font-bold text-foreground transition hover:border-white/30">
              اقترح تحسينا على المحتوى
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {queue.length} {queue.length === 1 ? "تسليمٌ" : "تسليماتٍ"} في طابورك — تُصحَّح هنا.
          </p>
          {queue.map((q) => (
            <div key={q.id} className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-black">{q.assessment.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {q.assessment.cohort.title} · {SUBMISSION_STATUS[q.status] ?? q.status} · {fmtDateTimeAr(q.submittedAt)}
                  </p>
                </div>
                {q.grades[0] && (
                  <span className="rounded-full bg-teal/15 px-3 py-1 text-[11px] font-black text-teal-light-ink">
                    {Number(q.grades[0].score)}/{Number(q.grades[0].maxScore)}
                  </span>
                )}
              </div>
              {q.textAnswer && (
                <p className="mt-3 max-h-32 overflow-y-auto rounded-2xl bg-paper/30 p-4 text-sm leading-7 text-foreground">{q.textAnswer}</p>
              )}
              <textarea
                value={reviewNote[q.id] ?? ""}
                onChange={(e) => setReviewNote((prev) => ({ ...prev, [q.id]: e.target.value }))}
                placeholder="ملاحظة للمتعلم — إلزامية عند الرفض أو طلب الإعادة"
                rows={2}
                className="mt-3 w-full rounded-xl border border-white/15 bg-paper/30 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/75 focus:border-teal focus:outline-none"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {q.status === "submitted" && (
                  <button disabled={busy} onClick={() => void reviewAction(q.id, "start_review")}
                    className="cursor-pointer rounded-full border border-white/20 px-4 py-1.5 text-[11px] font-bold text-foreground transition hover:border-white/40">
                    ابدأ المراجعة
                  </button>
                )}
                {q.status === "under_review" && (
                  <>
                    <button disabled={busy} onClick={() => void reviewAction(q.id, "accept")}
                      className="cursor-pointer rounded-full bg-teal px-4 py-1.5 text-[11px] font-black text-on-teal transition hover:bg-teal-light">
                      قبول
                    </button>
                    <button disabled={busy} onClick={() => void reviewAction(q.id, "request_resubmit")}
                      className="cursor-pointer rounded-full border border-gold/40 px-4 py-1.5 text-[11px] font-bold text-gold-ink transition hover:bg-gold/10">
                      اطلب إعادة التسليم
                    </button>
                    <button disabled={busy} onClick={() => void reviewAction(q.id, "reject")}
                      className="cursor-pointer rounded-full border border-red-500/40 px-4 py-1.5 text-[11px] font-bold text-red-400 transition hover:bg-red-500/10">
                      رفض
                    </button>
                  </>
                )}
                {["under_review", "submitted"].includes(q.status) && (
                  <span className="flex items-center gap-1.5">
                    <Star className="h-3.5 w-3.5 text-gold-ink" />
                    <input type="number" min={0} max={q.assessment.maxScore} value={gradeForm[q.id] ?? ""}
                      onChange={(e) => setGradeForm((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      placeholder={`من ${q.assessment.maxScore}`}
                      aria-label={`درجةُ «${q.assessment.title}» من ${q.assessment.maxScore}`}
                      className="w-20 rounded-lg border border-white/15 bg-paper/30 px-2 py-1.5 text-xs text-foreground focus:border-teal focus:outline-none" />
                    <button disabled={busy || !(gradeForm[q.id] ?? "").trim()} onClick={() => void grade(q.id, q.assessment.maxScore)}
                      className="cursor-pointer rounded-full border border-white/20 px-3 py-1.5 text-[11px] font-bold text-foreground transition hover:border-white/40 disabled:opacity-40">
                      سجّل الدرجة
                    </button>
                  </span>
                )}
              </div>
              <div className="mt-3 flex gap-2 border-t border-white/8 pt-3">
                <input value={feedbackForm[q.id] ?? ""}
                  onChange={(e) => setFeedbackForm((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="تغذية راجعة إضافية للمتعلم…"
                  aria-label={`تغذيةٌ راجعةٌ على «${q.assessment.title}»`}
                  className="flex-1 rounded-xl border border-white/15 bg-paper/30 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/75 focus:border-teal focus:outline-none" />
                <button disabled={busy || (feedbackForm[q.id] ?? "").trim().length < 3} onClick={() => void sendFeedback(q.id)}
                  className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-[11px] font-black text-foreground transition hover:bg-white/15 disabled:opacity-40">
                  <MessageSquarePlus className="h-3 w-3" /> أرسل
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </TrainerLayout>
  );
}
