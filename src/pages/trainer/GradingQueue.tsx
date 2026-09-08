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
import { ClipboardCheck, MessageSquarePlus, RefreshCw, ServerOff, Star } from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import { toast, toastError } from "@/components/Toast";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { signalGradingChanged } from "@/services/grading-signal";
import { fmtDateTimeAr } from "@/utils/format";
import { Panel } from "@/components/ui/Surface";
import WorkHeader from "@/components/admin/WorkHeader";
import { revealRow } from "@/components/admin/reveal";
import ListToolbar from "@/components/admin/ListToolbar";
import { paginate } from "@/application/admin/paginate";
import { matchesQuery } from "@/application/text/search-ar";
import Button from "@/components/ui/Button";
import { areaCls, controlCls } from "@/components/FormKit";

/* أزرارُ الإجراء الخمسة تشترك في هيئةٍ واحدة، ويفترق لونُها وحدَه */

/* «١ تسليمٌ» و«٢ تسليمان» و«٣ تسليمات» و«١١ تسليما» — والعددُ يُقرأ لا يُحسب */
const SUBMISSION_FORMS = { one: "تسليمٌ", two: "تسليمان", few: "تسليمات", many: "تسليما" };

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
  /* اسمُه `query` لا `q`: صفُّ الطابور في التصيير أدناه اسمُه `q`، وحرفٌ
     واحدٌ لمعنيَين في ملفٍّ واحدٍ يُقرأ خطأً قبل أن يُترجَم خطأً. */
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
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
      /* الشارةُ في الإطار فوق هذه الصفحة، ولا تعرف أنّ الطابورَ تغيّر —
         فكانت تبقى «١» بعد قبول آخرِ تسليم. تُبلَّغ هنا مرّةً واحدة، بعد
         كلّ فعلٍ ينجح، فيصير العددان قولا واحدا. */
      signalGradingChanged();
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
        <Panel className="grid place-items-center py-20 text-center">
          <ServerOff className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-xl font-black">لا يمكن الوصول للطابور</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">{offline}</p>
          <Button onClick={() => void load()} icon={RefreshCw} className="mt-5">إعادة المحاولة</Button>
        </Panel>
      </TrainerLayout>
    );
  }

  /* الطابورُ يطول بطول ما يُسلَّم: مدرّبٌ في ثلاث شعبٍ يستقبل عشراتِ
     التسليمات في الأسبوع، ولم يكن فيه ما يُبلَغ به تسليمٌ بعينه — من أراد
     تسليمَ متعلّمٍ سأل عنه مرّره بعينه. */
  const matched = (queue ?? []).filter((s2) => matchesQuery(query, [
    s2.assessment.title, s2.assessment.cohort.title, s2.textAnswer,
  ]));
  const view = paginate(matched, page, 20);

  return (
    <TrainerLayout title="طابور التصحيح">
      {/* ── العملُ قبل القائمة ──

          كانت الشاشةُ تفتح بسطرٍ رماديٍّ يقول «١٢ تسليماتٍ في طابورك» بحجم
          المتن، ثمّ بالقائمة. والعددُ هنا هو العملُ كلُّه. فصار جملةً في
          الرأس وزرًّا يبلغ أوّلَ التسليمات ويضع التركيزَ عليه.

          والدوّامةُ صارت هيكلا: مساحةٌ بقياس ما سيحلّ محلَّها فلا تقفز
          الصفحةُ عند وصوله. */}
      <WorkHeader
        loading={queue === null}
        icon={ClipboardCheck}
        count={queue?.length ?? 0}
        forms={SUBMISSION_FORMS}
        waitingAr="تنتظر تصحيحَك"
        stats={queue ? [`${queue.filter((q) => q.status === "under_review").length} بدأتَ مراجعتَها`] : []}
        actionAr="ابدأ بأوّلها"
        disabledReasonAr={queue && queue.length > 0 && view.total === 0
          ? "البحثُ الحاليُّ لا يُظهر منها شيئا — امسحه لتبدأ."
          : undefined}
        onAction={() => { if (view.rows[0]) revealRow(`submission-${view.rows[0].id}`); }}
        doneAr="الطابورُ نظيف — كلُّ ما وصلك قيّمتَه. أحسنت."
      />

      {queue !== null && queue.length === 0 ? (
        <Panel className="p-10 text-center">
          {/* الفراغ فرصة توجيه لا مساحة ميتة — خطوات تالية نافعة بدل صفحة خالية */}
          <p className="text-sm text-muted-foreground">وهذه وجهاتٌ تنفع الآن:</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
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
        </Panel>
      ) : (
        <div className="space-y-4">
          {/* العددُ في الرأس لا هنا: كان يُقال مرّتين بصيغتَين — والصيغةُ
              هنا كانت تُخطئ المثنّى والجمعَ («٢ تسليماتٍ»). */}
          <ListToolbar q={query} onQ={setQuery} onPage={setPage} view={view} unit="تسليما"
            placeholder="ابحث بعنوان التقييم أو الشعبة أو نصّ الإجابة…" />
          {view.total === 0 && (
            <Panel as="p" className="py-12 text-center text-sm text-muted-foreground">
              لا تسليمَ يطابق «{query.trim()}» — امسح الكلمة أو جرّب غيرها.
            </Panel>
          )}
          {view.rows.map((q) => (
            /* هدفُ زرِّ الرأس — يقبل التركيزَ ليُقرأ حين يُبلَغ بلوحة المفاتيح */
            <Panel key={q.id} id={`submission-${q.id}`} tabIndex={-1} className="outline-none">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-black">{q.assessment.title}</p>
                  <p className="mt-0.5 text-read text-muted-foreground">
                    {q.assessment.cohort.title} · {SUBMISSION_STATUS[q.status] ?? q.status} · {fmtDateTimeAr(q.submittedAt)}
                  </p>
                </div>
                {q.grades[0] && (
                  <span className="rounded-full bg-teal/15 px-3 py-1 text-fine font-black text-teal-light-ink">
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
                className={`mt-3 ${areaCls}`}
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {q.status === "submitted" && (
                  <Button size="sm" disabled={busy} onClick={() => void reviewAction(q.id, "start_review")}>
                    ابدأ المراجعة
                  </Button>
                )}
                {q.status === "under_review" && (
                  <>
                    {/* القبولُ فعلٌ مُثبِتٌ في القسم: نبرتُه `confirm` — وكان
                        ممتلئا بالفيروزيّ مكتوبا بيده، أي `confirm` بلا اسمه. */}
                    <Button tone="confirm" size="sm" disabled={busy} onClick={() => void reviewAction(q.id, "accept")}>
                      قبول
                    </Button>
                    <Button size="sm" disabled={busy} onClick={() => void reviewAction(q.id, "request_resubmit")}>
                      اطلب إعادة التسليم
                    </Button>
                    <Button tone="danger" size="sm" disabled={busy} onClick={() => void reviewAction(q.id, "reject")}>
                      رفض
                    </Button>
                  </>
                )}
                {/* ── الدرجةُ بعد المراجعة لا قبلها ──

                    الخادمُ يشترط `under_review` أو `accepted`
                    (`assessment.service.ts` — «راجع التسليم أولا قبل
                    الدرجة»، ٤٠٩). وكان الحقلُ والزرُّ مفعَّلَين على
                    `submitted` كذلك، فيكتب المدرّبُ الرقمَ ويضغط ويُردّ.
                    والحالةُ معروفةٌ في الشاشة، فالشرطُ يُقال قبل الضغط. */}
                {["under_review", "submitted"].includes(q.status) && (
                  <span className="flex items-center gap-1.5">
                    <Star className="h-3.5 w-3.5 text-gold-ink" />
                    <input type="number" min={0} max={q.assessment.maxScore} value={gradeForm[q.id] ?? ""}
                      disabled={q.status !== "under_review"}
                      onChange={(e) => setGradeForm((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      placeholder={`من ${q.assessment.maxScore}`}
                      aria-label={`درجةُ «${q.assessment.title}» من ${q.assessment.maxScore}`}
                      className="w-20 rounded-lg border border-white/15 bg-paper/30 px-2 py-1.5 text-xs text-foreground focus:border-teal focus:outline-none disabled:cursor-not-allowed disabled:opacity-45" />
                    <Button size="sm" disabled={busy || q.status !== "under_review" || !(gradeForm[q.id] ?? "").trim()}
                      onClick={() => void grade(q.id, q.assessment.maxScore)}>
                      سجّل الدرجة
                    </Button>
                    {q.status !== "under_review" && (
                      <span className="text-fine text-muted-foreground">اضغط «ابدأ المراجعة» أوّلا</span>
                    )}
                  </span>
                )}
              </div>
              <div className="mt-3 flex gap-2 border-t border-white/8 pt-3">
                <input value={feedbackForm[q.id] ?? ""}
                  onChange={(e) => setFeedbackForm((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="تغذية راجعة إضافية للمتعلم…"
                  aria-label={`تغذيةٌ راجعةٌ على «${q.assessment.title}»`}
                  className={`flex-1 ${controlCls}`} />
                <Button size="sm" icon={MessageSquarePlus} className="shrink-0"
                  disabled={busy || (feedbackForm[q.id] ?? "").trim().length < 3}
                  onClick={() => void sendFeedback(q.id)}>
                  أرسل
                </Button>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </TrainerLayout>
  );
}
