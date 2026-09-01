import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  ArrowLeft, Award, BookOpen, CalendarDays, CheckCircle2, ChevronDown, FileText,
  Loader2, PlayCircle, RefreshCw, Ruler, Send, ServerOff, Video,
} from "lucide-react";
import PortalLayout from "./PortalLayout";
import SubmissionFeedback from "@/components/SubmissionFeedback";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { fmtDate, fmtDateTime } from "@/application/text/format-ar";

const ENROLL_STATUS: Record<string, string> = {
  enrolled: "مسجل", waitlisted: "قائمة انتظار", completed: "مكتمل", dropped: "منسحب",
};
const SUBMISSION_STATUS: Record<string, { label: string; cls: string }> = {
  submitted: { label: "بانتظار المراجعة", cls: "border-white/20 text-white/60" },
  under_review: { label: "قيد مراجعة المدرب", cls: "border-gold/50 text-gold-ink" },
  resubmit_requested: { label: "مطلوب إعادة التسليم", cls: "border-red-500/40 text-red-400" },
  accepted: { label: "مقبول", cls: "border-teal/50 text-teal-light-ink" },
  rejected: { label: "مرفوض", cls: "border-red-500/40 text-red-400" },
};
const ASSESSMENT_TYPE: Record<string, string> = { assignment: "واجب", quiz: "اختبار", project: "مشروع" };
const ATTENDANCE_LABEL: Record<string, string> = { present: "حاضر", late: "متأخر", absent: "غائب", excused: "معذور" };

interface EnrollmentRow {
  id: string; status: string; createdAt: string;
  cohort: {
    id: string; title: string;
    course: { id: string; versions: { titleAr: string }[] };
    trainers: { profile: { application: { fullName: string } } }[];
  };
  courseProgress: { percent: number } | null;
  certificates: { id: string; number: string; status: string }[];
}

interface EnrollmentDetail extends EnrollmentRow {
  cohort: EnrollmentRow["cohort"] & {
    sessions: {
      id: string; title: string; startsAt: string; endsAt: string | null; status: string;
      zoom: { joinUrl: string; learnerUrl: string | null; meetingId: string | null; passcode: string | null } | null;
      recordings: { id: string; title: string; durationSec: number | null; readUrl: string | null }[];
    }[];
    materials: { id: string; title: string; kind: string; externalUrl: string | null; readUrl: string | null }[];
    assessments: {
      id: string; title: string; type: string; dueAt: string | null; maxScore: number;
      items: { id: string; prompt: string; kind?: string; maxScore?: number }[];
      /* الروبرك يصل من الخادم أصلا ولم يكن يُقرأ — عليه يقوم تفصيل الدرجة (ص-٢) */
      rubric?: { id: string; title: string; criteria: { id: string; title: string; maxScore: number; sequence: number }[] } | null;
    }[];
  };
  attendance: { sessionId: string; status: string }[];
  submissions: {
    id: string; assessmentId: string; status: string; reviewNote: string | null; submittedAt: string;
    grades: {
      score: string; maxScore: string;
      rubricScores?: { criterionId: string; score: number }[] | null;
      history?: { oldScore: string | null; newScore: string | null; createdAt?: string }[] | null;
    }[];
    feedback: { body: string; createdAt: string }[];
  }[];
  certificates: { id: string; number: string; status: string }[];
}

/** تعلّمي — بوابة المتعلم الحقيقية: شعبي وجلساتي وروابط Zoom وتسجيلاتي وواجباتي وشهاداتي */
export default function MyLearning() {
  /* عودة الدفع تهبط هنا لا في «الفواتير» (التوصية ٥): من أتمّ دفعه يريد أن
     يبدأ لا أن يقرأ فاتورته. و`paid` ليست دليل دفع — التسوية بـwebhook موقَّت
     وحده — فالرسالة تقول «نؤكّد» لا «تأكّد»، والقائمة أدناه هي الدليل. */
  const [params] = useSearchParams();
  const paidOrder = params.get("paid");
  const [rows, setRows] = useState<EnrollmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EnrollmentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setOffline(null);
    try {
      setRows(await apiGet<EnrollmentRow[]>("/api/learner/my-learning"));
    } catch (err) {
      setOffline(
        err instanceof ApiError && err.status === 401
          ? "سجّل دخولك بحسابك الحقيقي لتصل إلى شعبك وجلساتك وواجباتك هنا."
          : err instanceof ApiError ? err.message : "الخادم غير متصل — أعد المحاولة بعد قليل"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openDetail = async (id: string) => {
    if (openId === id) { setOpenId(null); setDetail(null); return; }
    setOpenId(id); setDetailLoading(true); setFlash("");
    try {
      setDetail(await apiGet<EnrollmentDetail>(`/api/learner/enrollments/${id}`));
    } catch (err) {
      setFlash(err instanceof ApiError ? err.message : "تعذر فتح محتوى الشعبة");
      setOpenId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const submit = async (assessmentId: string, isResubmit: boolean) => {
    const text = (answers[assessmentId] ?? "").trim();
    if (busy || !text) return;
    setBusy(assessmentId); setFlash("");
    try {
      await apiPost(`/api/learner/assessments/${assessmentId}/${isResubmit ? "resubmit" : "submissions"}`, { textAnswer: text });
      setAnswers((prev) => ({ ...prev, [assessmentId]: "" }));
      setFlash(isResubmit ? "أُعيد التسليم — سيمراجعه المدرب" : "سُلم الواجب — سيمراجعه المدرب");
      if (openId) {
        setDetail(await apiGet<EnrollmentDetail>(`/api/learner/enrollments/${openId}`));
      }
    } catch (err) {
      setFlash(err instanceof ApiError ? err.message : "تعذر التسليم");
    } finally {
      setBusy(null);
    }
  };

  /* تسليم اختبار بالبنود — محاولة رسمية تُقيّم في الخادم */
  const submitQuiz = async (assessmentId: string, responses: { itemId: string; answer: string }[]) => {
    if (busy || responses.length === 0) return;
    setBusy(assessmentId); setFlash("");
    try {
      await apiPost(`/api/learner/assessments/${assessmentId}/attempts`, { responses });
      setFlash("سُلمت إجاباتك — ستُقيّم وتظهر درجتك هنا");
      if (openId) {
        setDetail(await apiGet<EnrollmentDetail>(`/api/learner/enrollments/${openId}`));
      }
    } catch (err) {
      setFlash(err instanceof ApiError ? err.message : "تعذر تسليم الاختبار");
    } finally {
      setBusy(null);
    }
  };

  return (
    <PortalLayout title="تعلّمي">
      <div className="mx-auto max-w-4xl">
        {paidOrder && (
          <div className="mb-5 rounded-2xl border border-teal/40 bg-teal/10 px-4 py-3.5">
            <p className="flex items-center gap-2 text-sm font-black text-teal-light-ink">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> شكرا لك — عدنا بك إلى تعلّمك
            </p>
            <p className="mt-1.5 text-[12px] leading-6 text-white/60">
              نؤكّد دفعتك مع البنك، وشعبك تظهر أدناه فور تأكيدها — عادةً خلال دقائق.
              وتفصيل الفاتورة في <Link to="/student/billing" className="font-bold text-teal-light-ink underline underline-offset-4">الفواتير</Link>.
            </p>
          </div>
        )}
        {flash && (
          <p className="mb-5 flex items-center gap-2 rounded-2xl border border-teal/40 bg-teal/10 px-4 py-3 text-sm font-bold text-teal-light-ink">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> {flash}
          </p>
        )}

        {offline ? (
          <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-20 text-center">
            <ServerOff className="h-12 w-12 text-white/20" />
            <h2 className="mt-4 text-xl font-black">لا يمكن الوصول لبوابتك</h2>
            <p className="mt-2 max-w-md text-sm leading-7 text-white/55">{offline}</p>
            <button onClick={() => void load()} className="mt-5 flex cursor-pointer items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-xs font-bold text-white/70 hover:border-white/40">
              <RefreshCw className="h-3.5 w-3.5" /> إعادة المحاولة
            </button>
          </div>
        ) : loading ? (
          <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-teal-ink" /></div>
        ) : rows.length === 0 ? (
          <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-20 text-center">
            <BookOpen className="h-12 w-12 text-white/20" />
            <h2 className="mt-4 text-xl font-black">لا شعب مسجلة بعد</h2>
            <p className="mt-2 max-w-md text-sm leading-7 text-white/55">عند تسجيلك في شعبة ستظهر هنا جلساتك وموادك وواجباتك وتقدمك.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((r) => {
              const isOpen = openId === r.id;
              return (
                <div key={r.id} className="rounded-3xl border border-white/10 bg-white/[0.02]">
                  <button onClick={() => void openDetail(r.id)} className="flex w-full cursor-pointer flex-wrap items-center gap-4 p-5 text-right">
                    <div className="min-w-0 flex-1">
                      <p className="font-black">{r.cohort.course.versions[0]?.titleAr ?? r.cohort.title}</p>
                      <p className="mt-0.5 text-xs text-white/50">
                        {r.cohort.title}
                        {r.cohort.trainers.length > 0 && ` · المدرب: ${r.cohort.trainers.map((t) => t.profile.application.fullName).join("، ")}`}
                      </p>
                    </div>
                    {r.courseProgress && (
                      <div className="w-28">
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-teal" style={{ width: `${r.courseProgress.percent}%` }} />
                        </div>
                        <p className="mt-1 text-center text-[10px] text-white/45">{r.courseProgress.percent}٪ مكتمل</p>
                      </div>
                    )}
                    <span className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-bold text-white/60">
                      {ENROLL_STATUS[r.status] ?? r.status}
                    </span>
                    <ChevronDown className={`h-4 w-4 text-white/50 transition ${isOpen ? "rotate-180" : ""}`} />
                  </button>

                  {isOpen && (
                    <div className="border-t border-white/8 p-5">
                      {/* محطات الدورة: المتن والتمارين والسيناريو — صفحةٌ مستقلّة
                          لأنها قراءةٌ طويلة لا تُقرأ داخل بطاقة مطويّة. */}
                      <Link
                        to={`/student/course/${r.cohort.course.id}`}
                        className="mb-5 flex items-center justify-center gap-2 rounded-2xl border border-teal/40 bg-teal/[0.07] py-3 text-sm font-black text-teal-light-ink transition hover:bg-teal/15"
                      >
                        <BookOpen className="h-4 w-4" /> افتح محطات الدورة
                      </Link>
                      {detailLoading || !detail ? (
                        <div className="grid place-items-center py-8"><Loader2 className="h-6 w-6 animate-spin text-teal-ink" /></div>
                      ) : (
                        <LearnerCohortDetail
                          detail={detail}
                          answers={answers}
                          setAnswers={setAnswers}
                          busy={busy}
                          onSubmit={submit}
                          onSubmitQuiz={submitQuiz}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}

function LearnerCohortDetail({ detail, answers, setAnswers, busy, onSubmit, onSubmitQuiz }: {
  detail: EnrollmentDetail;
  answers: Record<string, string>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  busy: string | null;
  onSubmit: (assessmentId: string, isResubmit: boolean) => void;
  onSubmitQuiz: (assessmentId: string, responses: { itemId: string; answer: string }[]) => void;
}) {
  const fmtWhen = (iso: string) => fmtDateTime(new Date(iso));
  return (
    <div className="space-y-6">
      {/* الجلسات */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-white/70"><CalendarDays className="h-4 w-4 text-teal-light-ink" /> الجلسات</h3>
        {detail.cohort.sessions.length === 0 ? (
          <p className="text-xs text-white/50">لم تُجدول جلسات بعد.</p>
        ) : (
          <div className="space-y-2">
            {detail.cohort.sessions.map((s) => {
              const myAttendance = detail.attendance.find((a) => a.sessionId === s.id);
              return (
                <div key={s.id} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">{s.title}</p>
                      <p className="mt-0.5 text-[11px] text-white/45">{fmtWhen(s.startsAt)}</p>
                    </div>
                    {myAttendance && (
                      <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-[10px] font-bold text-white/55">
                        {ATTENDANCE_LABEL[myAttendance.status] ?? myAttendance.status}
                      </span>
                    )}
                    {s.zoom && (
                      <a href={s.zoom.learnerUrl ?? s.zoom.joinUrl} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 rounded-full bg-teal px-4 py-1.5 text-[11px] font-black text-on-teal transition hover:bg-teal-light">
                        <Video className="h-3 w-3" /> ادخل الجلسة
                      </a>
                    )}
                  </div>
                  {s.zoom?.passcode && (
                    <p className="mt-2 text-[11px] text-white/45">رمز المرور: <span className="font-mono text-white/70" dir="ltr">{s.zoom.passcode}</span></p>
                  )}
                  {s.recordings.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-white/8 pt-3">
                      {s.recordings.map((rec) => (
                        <a key={rec.id} href={rec.readUrl ?? "#"} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 text-[10px] font-bold text-white/65 transition hover:border-teal/50 hover:text-teal-light-ink">
                          <PlayCircle className="h-3 w-3" /> {rec.title}
                          {rec.durationSec ? ` · ${Math.round(rec.durationSec / 60)} د` : ""}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* المواد */}
      {detail.cohort.materials.length > 0 && (
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-white/70"><FileText className="h-4 w-4 text-teal-light-ink" /> المواد</h3>
          <div className="flex flex-wrap gap-2">
            {detail.cohort.materials.map((m) => (
              <a key={m.id} href={m.readUrl ?? m.externalUrl ?? "#"} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-bold text-white/65 transition hover:border-teal/50 hover:text-teal-light-ink">
                <FileText className="h-3 w-3" /> {m.title}
              </a>
            ))}
          </div>
        </section>
      )}

      {/* الواجبات والتقييمات */}
      {detail.cohort.assessments.length > 0 && (
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-white/70"><Send className="h-4 w-4 text-teal-light-ink" /> الواجبات والتقييمات</h3>
          <div className="space-y-3">
            {detail.cohort.assessments.map((a) => {
              const mine = detail.submissions
                .filter((s) => s.assessmentId === a.id)
                .sort((x, y) => y.submittedAt.localeCompare(x.submittedAt))[0];
              const meta = mine ? SUBMISSION_STATUS[mine.status] : null;
              const canSubmit = !mine || mine.status === "resubmit_requested";
              return (
                <div key={a.id} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">{a.title}</p>
                      <p className="mt-0.5 text-[11px] text-white/45">
                        {ASSESSMENT_TYPE[a.type] ?? a.type} · من {a.maxScore}
                        {a.dueAt && ` · يستحق ${fmtDate(a.dueAt)}`}
                      </p>
                    </div>
                    {meta && <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${meta.cls}`}>{meta.label}</span>}
                    {mine?.grades[0] && (
                      <span className="rounded-full bg-teal/15 px-2.5 py-0.5 text-[10px] font-black text-teal-light-ink">
                        {Number(mine.grades[0].score)}/{Number(mine.grades[0].maxScore)}
                      </span>
                    )}
                  </div>
                  {/* ص-٢: الحكم كاملا — تفصيل الروبرك وملاحظة المراجعة في كل الحالات وتعليقات معنونة */}
                  {mine && (
                    <SubmissionFeedback submission={mine} criteria={a.rubric?.criteria} className="mt-3" />
                  )}
                  {canSubmit && a.type === "quiz" && a.items.length > 0 && (
                    <QuizAttemptForm
                      items={a.items}
                      busy={busy === a.id}
                      onSubmit={(responses) => onSubmitQuiz(a.id, responses)}
                    />
                  )}
                  {canSubmit && a.type !== "quiz" && (
                    <div className="mt-3">
                      <textarea
                        value={answers[a.id] ?? ""}
                        onChange={(e) => setAnswers((prev) => ({ ...prev, [a.id]: e.target.value }))}
                        placeholder={mine?.status === "resubmit_requested" ? "أعد التسليم بعد معالجة الملاحظات…" : "اكتب إجابتك هنا…"}
                        rows={3}
                        className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-teal focus:outline-none"
                      />
                      <button
                        disabled={busy === a.id || !(answers[a.id] ?? "").trim()}
                        onClick={() => onSubmit(a.id, mine?.status === "resubmit_requested")}
                        className="mt-2 flex cursor-pointer items-center gap-1.5 rounded-full bg-teal px-5 py-2 text-xs font-black text-on-teal transition hover:bg-teal-light disabled:opacity-40"
                      >
                        {busy === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                        {mine?.status === "resubmit_requested" ? "أعد التسليم" : "سلّم الواجب"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* قياس النمو بعد الإتمام (ح-٧) — يظهر لمن أتمّ الدورة فقط، وصفحته تحسم الأهلية نهائيا */}
      {(detail.status === "completed" || detail.certificates.some((c) => c.status === "active")) && (
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal/30 bg-teal-ink/[0.07] p-4">
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-sm font-black">
                <Ruler className="h-4 w-4 text-teal-light-ink" aria-hidden="true" />
                قِس نموك في مهارات هذه الدورة
              </h3>
              <p className="mt-1 text-[11px] leading-6 text-white/60">
                بالسلّم نفسه الذي قاسك قبلها — فيظهر الفرق مقيسا. مرة واحدة لكل دورة.
              </p>
            </div>
            <Link
              to={`/student/remeasure/${detail.id}`}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-gold px-5 text-xs font-black text-on-gold transition hover:bg-gold/90"
            >
              افتح القياس
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </section>
      )}

      {/* الشهادات */}
      {detail.certificates.length > 0 && (
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-white/70"><Award className="h-4 w-4 text-gold-ink" /> الشهادات</h3>
          <div className="space-y-2">
            {detail.certificates.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-gold/25 bg-gold/5 p-4">
                <p className="min-w-0 flex-1 font-mono text-xs text-white/70" dir="ltr">{c.number}</p>
                <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${c.status === "active" ? "border-teal/50 text-teal-light-ink" : "border-red-500/40 text-red-400"}`}>
                  {c.status === "active" ? "فعالة" : "ملغاة"}
                </span>
                <Link to={`/verify/${c.number}`} className="text-[11px] font-bold text-teal-light-ink underline underline-offset-4">
                  صفحة التحقق العامة
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** نموذج اختبار بالبنود — إجابة نصية لكل بند، تُرسل كمحاولة واحدة */
function QuizAttemptForm({ items, busy, onSubmit }: {
  items: { id: string; prompt: string; kind?: string; maxScore?: number }[];
  busy: boolean;
  onSubmit: (responses: { itemId: string; answer: string }[]) => void;
}) {
  const [resp, setResp] = useState<Record<string, string>>({});
  const answered = items.filter((i) => (resp[i.id] ?? "").trim()).length;
  return (
    <div className="mt-3 space-y-3">
      {items.map((it, idx) => (
        <div key={it.id}>
          <p className="mb-1 text-xs font-bold text-white/75">
            {idx + 1}. {it.prompt}
            {it.maxScore ? <span className="mr-2 text-[10px] font-normal text-white/50">({it.maxScore} درجات)</span> : null}
          </p>
          <textarea
            rows={2}
            value={resp[it.id] ?? ""}
            onChange={(e) => setResp((prev) => ({ ...prev, [it.id]: e.target.value }))}
            placeholder="إجابتك…"
            className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-teal focus:outline-none"
          />
        </div>
      ))}
      <button
        disabled={busy || answered < items.length}
        onClick={() => onSubmit(items.map((i) => ({ itemId: i.id, answer: (resp[i.id] ?? "").trim() })))}
        className="flex cursor-pointer items-center gap-1.5 rounded-full bg-gold px-5 py-2 text-xs font-black text-on-gold transition hover:bg-gold/90 disabled:opacity-40"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
        سلّم الاختبار ({answered}/{items.length})
      </button>
    </div>
  );
}
