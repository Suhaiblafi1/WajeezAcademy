import { useCallback, useEffect, useState } from "react";
import {
  CalendarClock, CalendarDays, CalendarPlus, CheckCircle2, ChevronDown, ClipboardCheck, Loader2, MessageSquarePlus, RefreshCw, ServerOff, Star, Upload, Users, Video,
} from "lucide-react";
import { apiGet, apiPost, ApiError } from "@/services/api";
import TrainerLayout from "./TrainerLayout";
import { fmtDateTimeAr } from "@/utils/format";

const API_BASE: string = import.meta.env.VITE_API_URL ?? "";

const ATTENDANCE_OPTIONS = [
  { value: "present", label: "حاضر" }, { value: "late", label: "متأخر" },
  { value: "absent", label: "غائب" }, { value: "excused", label: "معذور" },
] as const;
const SUBMISSION_STATUS: Record<string, string> = {
  submitted: "بانتظار المراجعة", under_review: "قيد المراجعة",
  resubmit_requested: "طُلبت إعادته", accepted: "مقبول", rejected: "مرفوض",
};

interface TrainerCohort {
  role: string;
  cohort: {
    id: string; title: string; status: string;
    course: { versions: { titleAr: string }[] };
    sessions: {
      id: string; title: string; startsAt: string; status: string;
      zoom: { joinUrl: string; passcode: string | null } | null;
      recordings: { id: string; title: string; readUrl: string | null }[];
    }[];
    enrollments: {
      id: string; status: string;
      user: { displayName: string; email: string };
      courseProgress: { percent: number } | null;
      attendance: { sessionId: string; status: string }[];
    }[];
    materials: { id: string; title: string; readUrl: string | null }[];
  };
}

interface CohortMessage {
  id: string; audience: string; body: string; recipients: number; createdAt: string;
  author: { displayName: string };
  enrollment: { user: { displayName: string } } | null;
}

interface QueueItem {
  id: string; status: string; textAnswer: string | null; submittedAt: string; reviewNote: string | null;
  assessment: { title: string; maxScore: number; cohort: { title: string } };
  enrollment: { userId: string };
  grades: { score: string; maxScore: string }[];
  feedback: { body: string }[];
}

interface RescheduleItem {
  id: string; status: string; proposedStartsAt: string; reason: string; createdAt: string;
  reviewerComment: string | null;
  session: { title: string; cohort: { title: string } };
}

const RESCHEDULE_STATUS_AR: Record<string, string> = {
  pending: "بانتظار قرار الإدارة", approved: "اعتُمد", rejected: "رُفض", withdrawn: "سُحب",
};

/** قمرة الشعبة — بوابة المدرب التشغيلية: شعبي فقط، حضور، تسجيلات، مراجعة وتقدير */
export default function CohortBoard() {
  const [cohorts, setCohorts] = useState<TrainerCohort[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [reschedules, setReschedules] = useState<RescheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [flash, setFlash] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({});
  const [gradeForm, setGradeForm] = useState<Record<string, string>>({});
  const [feedbackForm, setFeedbackForm] = useState<Record<string, string>>({});
  /* أدوات الشعبة: رابط مادة، وعنوان تكليف ونوعه — لكل شعبة على حدة */
  const [materialLink, setMaterialLink] = useState<Record<string, { title: string; url: string }>>({});
  const [taskForm, setTaskForm] = useState<Record<string, { title: string; type: string }>>({});
  /* المخاطبة والتأجيل — لكل شعبة وجلسة على حدة */
  const [msgForm, setMsgForm] = useState<Record<string, { body: string; enrollmentId: string }>>({});
  const [msgLog, setMsgLog] = useState<Record<string, CohortMessage[]>>({});
  const [rescheduleFor, setRescheduleFor] = useState<string | null>(null);
  const [rescheduleForm, setRescheduleForm] = useState({ at: "", reason: "" });

  const load = useCallback(async () => {
    setLoading(true); setOffline(null);
    try {
      const [c, q, r] = await Promise.all([
        apiGet<TrainerCohort[]>("/api/trainer/my-cohorts"),
        apiGet<QueueItem[]>("/api/trainer/grading-queue"),
        apiGet<RescheduleItem[]>("/api/trainer/reschedules"),
      ]);
      setCohorts(c);
      setQueue(q);
      setReschedules(r);
    } catch (err) {
      setOffline(err instanceof ApiError ? err.message : "الخادم غير متصل — هذه الصفحة تتطلب جلسة مدرب حقيقية");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, doneMsg: string) => {
    if (busy) return;
    setBusy(true); setFlash("");
    try {
      await fn();
      setFlash(doneMsg);
      await load();
    } catch (err) {
      setFlash(err instanceof ApiError ? err.message : "تعذر تنفيذ الإجراء");
    } finally {
      setBusy(false);
    }
  };

  const markAttendance = (sessionId: string, enrollmentId: string, status: string) =>
    act(() => apiPost(`/api/trainer/sessions/${sessionId}/attendance`, { enrollmentId, status }), "سُجل الحضور وأُعيد حساب التقدم");

  /* رفع كرّاسة أو فيديو لمادة الشعبة — نفس نمط تسجيل الجلسة: تسجيل ثم رفع موقّع */
  const uploadMaterialFile = (cohortId: string, file: File) =>
    act(async () => {
      const res = await apiPost<{ uploadUrl?: string }>(`/api/trainer/cohorts/${cohortId}/materials`, {
        title: file.name.replace(/\.[^.]+$/, ""), kind: "file",
        file: { originalName: file.name, mime: file.type || "application/octet-stream", sizeBytes: file.size },
      });
      if (res.uploadUrl) {
        const put = await fetch(`${API_BASE}${res.uploadUrl}`, {
          method: "PUT", credentials: "include",
          headers: { "content-type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!put.ok) throw new ApiError("upload_failed", "تعذر رفع الملف بعد تسجيل المادة", put.status);
      }
    }, "أُضيفت المادة ورُفعت — تظهر للمسجلين في الشعبة");

  const addMaterialLink = (cohortId: string) => {
    const f = materialLink[cohortId];
    if (!f?.title.trim() || !f.url.trim()) return;
    return act(
      () => apiPost(`/api/trainer/cohorts/${cohortId}/materials`, { title: f.title.trim(), kind: "link", externalUrl: f.url.trim() }),
      "أُضيف الرابط إلى مواد الشعبة",
    ).then(() => setMaterialLink({ ...materialLink, [cohortId]: { title: "", url: "" } }));
  };

  const createAssessment = (cohortId: string) => {
    const f = taskForm[cohortId];
    if (!f?.title.trim() || !f.type) return;
    return act(
      () => apiPost(`/api/trainer/cohorts/${cohortId}/assessments`, { title: f.title.trim(), type: f.type, maxScore: 100 }),
      "أُنشئ التكليف — يظهر للمسجلين ويعود إليك تسليمهم في طابور المراجعة",
    ).then(() => setTaskForm({ ...taskForm, [cohortId]: { title: "", type: "assignment" } }));
  };

  const uploadRecording = (sessionId: string, file: File) =>
    act(async () => {
      const res = await apiPost<{ uploadUrl?: string }>(`/api/trainer/sessions/${sessionId}/recordings`, {
        title: file.name.replace(/\.[^.]+$/, ""), mime: file.type || "video/mp4", sizeBytes: file.size,
      });
      if (res.uploadUrl) {
        const put = await fetch(`${API_BASE}${res.uploadUrl}`, {
          method: "PUT", credentials: "include",
          headers: { "content-type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!put.ok) throw new ApiError("upload_failed", "تعذر رفع الملف بعد التسجيل", put.status);
      }
    }, "سُجل التسجيل ورُفع — سيظهر للمسجلين في الشعبة");

  const reviewAction = (submissionId: string, action: string) =>
    act(() => apiPost(`/api/trainer/submissions/${submissionId}/review`, { action, note: reviewNote[submissionId] || undefined }),
      action === "accept" ? "قُبل التسليم" : action === "reject" ? "رُفض التسليم مع السبب" : action === "request_resubmit" ? "طُلبت إعادة التسليم" : "بدأت المراجعة");

  const grade = (submissionId: string, maxScore: number) =>
    act(async () => {
      const score = Number(gradeForm[submissionId]);
      await apiPost("/api/trainer/grade", { submissionId, score, maxScore });
      setGradeForm((prev) => ({ ...prev, [submissionId]: "" }));
    }, "سُجلت الدرجة — وأي تعديل لاحق سيوثق في السجل");

  /* ── مخاطبة الشعبة ──
     الرسالة تُسجَّل ثم تُوصَّل، والسجلّ يُعاد تحميله فورا: من أرسل يرى أثره
     لا رسالةَ نجاحٍ تختفي. */
  const loadMessages = useCallback(async (cohortId: string) => {
    try {
      const list = await apiGet<CohortMessage[]>(`/api/trainer/cohorts/${cohortId}/messages`);
      setMsgLog((prev) => ({ ...prev, [cohortId]: list }));
    } catch { /* السجلّ رفاهية — غيابه لا يمنع الإرسال */ }
  }, []);

  const sendMessage = (cohortId: string) => {
    const f = msgForm[cohortId];
    if (!f?.body.trim()) return;
    void act(async () => {
      await apiPost(`/api/trainer/cohorts/${cohortId}/messages`, {
        audience: f.enrollmentId ? "learner" : "cohort",
        enrollmentId: f.enrollmentId || undefined,
        body: f.body.trim(),
      });
      setMsgForm((prev) => ({ ...prev, [cohortId]: { body: "", enrollmentId: "" } }));
      await loadMessages(cohortId);
    }, f.enrollmentId ? "وصلت رسالتك المتعلّم — وبقيت في السجلّ" : "بلغ إعلانك الشعبة — وبقي في السجلّ");
  };

  /* ── اقتراح موعد ──
     يُقترح ولا يُغيَّر: الموعد لا يتبدّل عند المتعلّمين إلا باعتماد الإدارة. */
  const proposeReschedule = (sessionId: string) =>
    act(async () => {
      await apiPost(`/api/trainer/sessions/${sessionId}/reschedule`, {
        proposedStartsAt: new Date(rescheduleForm.at).toISOString(),
        reason: rescheduleForm.reason.trim(),
      });
      setRescheduleFor(null);
      setRescheduleForm({ at: "", reason: "" });
    }, "وصل اقتراحك الإدارة — والموعد لا يتغيّر حتى تعتمده");

  const withdrawReschedule = (id: string) =>
    act(() => apiPost(`/api/trainer/reschedules/${id}/withdraw`), "سُحب اقتراحك");

  const sendFeedback = (submissionId: string) =>
    act(async () => {
      await apiPost(`/api/trainer/submissions/${submissionId}/feedback`, { body: feedbackForm[submissionId] });
      setFeedbackForm((prev) => ({ ...prev, [submissionId]: "" }));
    }, "أُرسلت التغذية الراجعة للمتعلم");

  /* إطارُ البوابة نفسه، لا إطارٌ ثالثٌ خاصّ بها.

     كانت هذه الشاشة تبني رأسا لنفسها — شعارٌ ورابطٌ إلى الموقع العامّ ولا
     شيء غير ذلك — فصار في بوابةٍ واحدة ثلاثة إطارات: الكامل على خمس شاشات،
     ولا إطارَ على الرئيسية، وهذا على السادسة. وهي مع ذلك ورشةُ عمل المدرب
     الفعليّة (الحضور والمواد والتكليفات والدرجات) ولم تكن في التبويبات أصلا،
     فلا يبلغها إلا من يكتب مسارها بيده. */
  return (
    <TrainerLayout title="شعبي وجلساتها">

      {/* ب-٢: حاوية تخطيط لا منطقة landmark — منطقة main واحدة في التطبيق

                (App.tsx) وهي هدف رابط «تجاوز إلى المحتوى». main متداخلة تجعل

                التخطي غامضا وتُجبر قارئ الشاشة على الاختيار بين منطقتين. */}

      <div className="mx-auto max-w-5xl px-5 py-8">
        {flash && (
          <p className="mb-5 flex items-center gap-2 rounded-2xl border border-teal/40 bg-teal/10 px-4 py-3 text-sm font-bold text-teal-light-ink">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> {flash}
          </p>
        )}

        {offline ? (
          <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-20 text-center">
            <ServerOff className="h-12 w-12 text-white/20" />
            <h2 className="mt-4 text-xl font-black">لا يمكن الوصول لشعبك</h2>
            <p className="mt-2 max-w-md text-sm leading-7 text-white/55">{offline}</p>
            <button onClick={() => void load()} className="mt-5 flex cursor-pointer items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-xs font-bold text-white/70 hover:border-white/40">
              <RefreshCw className="h-3.5 w-3.5" /> إعادة المحاولة
            </button>
          </div>
        ) : loading ? (
          <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-teal-ink" /></div>
        ) : (
          <div className="space-y-10">
            {/* ── شعبي ── */}
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-black"><Users className="h-5 w-5 text-teal-light-ink" /> شعبي</h2>
              {cohorts.length === 0 ? (
                <p className="rounded-3xl border border-white/10 bg-white/[0.02] py-12 text-center text-sm text-white/45">
                  لا شعب مسندة إليك بعد — ستظهر هنا فور إسناد الإدارة لك.
                </p>
              ) : (
                <div className="space-y-4">
                  {cohorts.map(({ role, cohort: c }) => {
                    const isOpen = expanded === c.id;
                    return (
                      <div key={c.id} className="rounded-3xl border border-white/10 bg-white/[0.02]">
                        <button onClick={() => setExpanded(isOpen ? null : c.id)} className="flex w-full cursor-pointer flex-wrap items-center gap-4 p-5 text-right">
                          <div className="min-w-0 flex-1">
                            <p className="font-black">{c.course.versions[0]?.titleAr ?? c.title}</p>
                            <p className="mt-0.5 text-xs text-white/50">
                              {c.title} · دورك: {role === "lead" ? "مدرب رئيس" : "مساعد"} · {c.enrollments.length} متعلما · {c.sessions.length} جلسة
                            </p>
                          </div>
                          <ChevronDown className={`h-4 w-4 text-white/50 transition ${isOpen ? "rotate-180" : ""}`} />
                        </button>

                        {isOpen && (
                          <div className="space-y-6 border-t border-white/8 p-5">
                            {/* الجلسات والحضور */}
                            <div>
                              <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-white/70"><CalendarDays className="h-4 w-4 text-teal-light-ink" /> الجلسات والحضور</h3>
                              {c.sessions.length === 0 ? (
                                <p className="text-xs text-white/50">لا جلسات مجدولة — الإدارة تضيف الجدول.</p>
                              ) : (
                                <div className="space-y-3">
                                  {c.sessions.map((s) => (
                                    <div key={s.id} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                                      <div className="flex flex-wrap items-center gap-3">
                                        <div className="min-w-0 flex-1">
                                          <p className="text-sm font-bold">{s.title}</p>
                                          <p className="mt-0.5 text-[11px] text-white/45">
                                            {fmtDateTimeAr(s.startsAt)}
                                            {s.status === "done" && " · انتهت"}
                                          </p>
                                        </div>
                                        {s.zoom && (
                                          <a href={s.zoom.joinUrl} target="_blank" rel="noreferrer"
                                            className="flex items-center gap-1.5 rounded-full bg-teal px-4 py-1.5 text-[11px] font-black text-on-teal transition hover:bg-teal-light">
                                            <Video className="h-3 w-3" /> افتح الاجتماع
                                          </a>
                                        )}
                                        {/* دعوةُ التقويم كانت للمتعلّم وحدَه، ومن يُدير الجلسة
                                            أولى بها: الصلاحيةُ محروسةٌ في الخدمة (`trainer.cohort.operate`). */}
                                        {s.status !== "done" && (
                                          <a
                                            href={`/api/calendar/cohort-sessions/${s.id}.ics`}
                                            className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-bold text-white/60 transition hover:border-white/35 hover:text-white"
                                          >
                                            <CalendarPlus className="h-3 w-3" /> أضِفها لتقويمك
                                          </a>
                                        )}
                                        <label className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-bold text-white/60 transition hover:border-teal/50 hover:text-teal-light-ink">
                                          <Upload className="h-3 w-3" /> ارفع التسجيل
                                          <input type="file" accept="video/*" className="hidden"
                                            onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadRecording(s.id, f); e.target.value = ""; }} />
                                        </label>
                                        {s.status !== "done" && (
                                          <button type="button"
                                            onClick={() => { setRescheduleFor(rescheduleFor === s.id ? null : s.id); setRescheduleForm({ at: "", reason: "" }); }}
                                            className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-bold text-white/60 transition hover:border-gold/50 hover:text-gold-ink">
                                            <CalendarClock className="h-3 w-3" /> اقترح موعدا
                                          </button>
                                        )}
                                      </div>

                                      {/* الاقتراح لا يغيّر شيئا حتى تعتمده الإدارة — والنصّ يقولها
                                          قبل الضغط لا بعده، فلا يظنّ المدرب أن الموعد تبدّل. */}
                                      {rescheduleFor === s.id && (
                                        <div className="mt-3 space-y-2.5 rounded-2xl border border-gold/30 bg-gold/[0.05] p-3.5">
                                          <p className="text-[11px] leading-relaxed text-gold-ink">
                                            تقترح ولا تغيّر: الموعد يبقى كما هو عند متعلّميك حتى تعتمد الإدارة اقتراحك.
                                          </p>
                                          <div className="grid gap-2.5 sm:grid-cols-2">
                                            <div>
                                              <label htmlFor={`rs-at-${s.id}`} className="mb-1 block text-[11px] font-bold text-white/55">الموعد المقترح</label>
                                              <input id={`rs-at-${s.id}`} type="datetime-local" dir="ltr" value={rescheduleForm.at}
                                                onChange={(e) => setRescheduleForm((f) => ({ ...f, at: e.target.value }))}
                                                className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-left text-xs text-white focus:border-teal focus:outline-none" />
                                            </div>
                                            <div>
                                              <label htmlFor={`rs-why-${s.id}`} className="mb-1 block text-[11px] font-bold text-white/55">السبب — تقرؤه الإدارة لتقرّر</label>
                                              <input id={`rs-why-${s.id}`} value={rescheduleForm.reason}
                                                onChange={(e) => setRescheduleForm((f) => ({ ...f, reason: e.target.value }))}
                                                placeholder="مثال: سفر في موعد الجلسة"
                                                className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:border-teal focus:outline-none" />
                                            </div>
                                          </div>
                                          <button type="button" disabled={busy || !rescheduleForm.at || rescheduleForm.reason.trim().length < 10}
                                            onClick={() => void proposeReschedule(s.id)}
                                            className="cursor-pointer rounded-full bg-gold px-5 py-1.5 text-[11px] font-black text-on-gold transition hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-40">
                                            أرسل الاقتراح للإدارة
                                          </button>
                                        </div>
                                      )}
                                      {s.zoom?.passcode && (
                                        <p className="mt-2 text-[11px] text-white/45">رمز المرور: <span className="font-mono text-white/70" dir="ltr">{s.zoom.passcode}</span></p>
                                      )}
                                      {/* شبكة الحضور */}
                                      <div className="mt-3 space-y-1.5 border-t border-white/8 pt-3">
                                        {c.enrollments.filter((e) => e.status !== "waitlisted").map((e) => {
                                          const current = e.attendance.find((a) => a.sessionId === s.id)?.status;
                                          return (
                                            <div key={e.id} className="flex items-center gap-3">
                                              <p className="min-w-0 flex-1 truncate text-xs text-white/65">{e.user.displayName}</p>
                                              <div className="flex gap-1">
                                                {ATTENDANCE_OPTIONS.map((opt) => (
                                                  <button key={opt.value} disabled={busy}
                                                    onClick={() => void markAttendance(s.id, e.id, opt.value)}
                                                    className={`cursor-pointer rounded-full border px-2.5 py-1 text-[10px] font-bold transition disabled:opacity-40 ${
                                                      current === opt.value
                                                        ? "border-teal bg-teal/15 text-teal-light-ink"
                                                        : "border-white/12 text-white/50 hover:border-white/30 hover:text-white/70"
                                                    }`}>
                                                    {opt.label}
                                                  </button>
                                                ))}
                                              </div>
                                            </div>
                                          );
                                        })}
                                        {c.enrollments.filter((e) => e.status !== "waitlisted").length === 0 && (
                                          <p className="text-[11px] text-white/50">لا متعلمين مسجلين بعد.</p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* تقدم المتعلمين */}
                            {c.enrollments.length > 0 && (
                              <div>
                                <h3 className="mb-3 text-sm font-black text-white/70">تقدم المتعلمين</h3>
                                <div className="space-y-2">
                                  {c.enrollments.map((e) => (
                                    <div key={e.id} className="flex items-center gap-3">
                                      <p className="w-36 truncate text-xs text-white/65">{e.user.displayName}</p>
                                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                                        <div className="h-full rounded-full bg-teal" style={{ width: `${e.courseProgress?.percent ?? 0}%` }} />
                                      </div>
                                      <p className="w-10 text-left text-[10px] text-white/45">{e.courseProgress?.percent ?? 0}٪</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* ── مخاطبة الشعبة ──

                                كان المدرب يرى المتعثّر ولا يملك أن يخاطبه: التغذية
                                الراجعة تُكتب على تسليم، ومن لم يُسلّم شيئا لا يبلغه
                                شيء. والرسالة تُسجَّل ثم تُوصَّل — فالسجلّ هو الأثر
                                الباقي، ومن مسح الإشعار لم يمسح الرسالة. */}
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                              <h3 className="flex items-center gap-2 text-sm font-black text-white/75">
                                <MessageSquarePlus className="h-4 w-4 text-teal-light-ink" /> مخاطبة الشعبة
                              </h3>
                              <p className="mt-1 text-[11px] leading-relaxed text-white/45">
                                إعلانٌ يبلغ كلّ مسجَّل، أو رسالةٌ إلى متعلّم بعينه. وكلاهما يبقى في السجلّ أدناه.
                              </p>
                              <div className="mt-3 space-y-2.5">
                                <select
                                  aria-label="إلى من"
                                  value={msgForm[c.id]?.enrollmentId ?? ""}
                                  onChange={(e) => setMsgForm((prev) => ({ ...prev, [c.id]: { body: prev[c.id]?.body ?? "", enrollmentId: e.target.value } }))}
                                  className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs text-white focus:border-teal focus:outline-none [&>option]:bg-surface"
                                >
                                  <option value="">إلى الشعبة كلّها ({c.enrollments.filter((e) => e.status !== "waitlisted").length} متعلّما)</option>
                                  {c.enrollments.filter((e) => e.status !== "waitlisted").map((e) => (
                                    <option key={e.id} value={e.id}>إلى {e.user.displayName} وحده</option>
                                  ))}
                                </select>
                                <textarea
                                  aria-label="نصّ الرسالة" rows={3} maxLength={2000}
                                  value={msgForm[c.id]?.body ?? ""}
                                  onChange={(e) => setMsgForm((prev) => ({ ...prev, [c.id]: { enrollmentId: prev[c.id]?.enrollmentId ?? "", body: e.target.value } }))}
                                  placeholder="اكتب ما تريد أن يبلغهم…"
                                  className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs leading-6 text-white placeholder:text-white/30 focus:border-teal focus:outline-none"
                                />
                                <button type="button" disabled={busy || (msgForm[c.id]?.body ?? "").trim().length < 2}
                                  onClick={() => sendMessage(c.id)}
                                  className="flex cursor-pointer items-center gap-1.5 rounded-full bg-teal px-5 py-1.5 text-[11px] font-black text-on-teal transition hover:bg-teal-light disabled:cursor-not-allowed disabled:opacity-40">
                                  <MessageSquarePlus className="h-3 w-3" /> أرسل
                                </button>
                              </div>

                              <div className="mt-4 border-t border-white/8 pt-3">
                                <button type="button" onClick={() => void loadMessages(c.id)}
                                  className="cursor-pointer text-[11px] font-bold text-teal-light-ink transition hover:text-teal-ink">
                                  {msgLog[c.id] ? "حدّث السجلّ" : "اعرض سجلّ ما أُرسل"}
                                </button>
                                {msgLog[c.id] && (
                                  msgLog[c.id].length === 0 ? (
                                    <p className="mt-2 text-[11px] text-white/40">لم تُرسل شيئا في هذه الشعبة بعد.</p>
                                  ) : (
                                    <ul className="mt-2.5 space-y-2">
                                      {msgLog[c.id].map((m) => (
                                        <li key={m.id} className="rounded-xl border border-white/8 bg-black/20 p-3">
                                          <p className="text-[10.5px] text-white/45">
                                            {m.audience === "cohort"
                                              ? `إلى الشعبة · ${m.recipients} متعلّما`
                                              : `إلى ${m.enrollment?.user.displayName ?? "متعلّم"}`}
                                            {" · "}{fmtDateTimeAr(m.createdAt)}
                                          </p>
                                          <p className="mt-1.5 whitespace-pre-line text-xs leading-6 text-white/75">{m.body}</p>
                                        </li>
                                      ))}
                                    </ul>
                                  )
                                )}
                              </div>
                            </div>

                            {/* ── مواد الشعبة وتكاليفها ──
                                كانت المواد معلَنة في نوع البيانات ولا تُعرض في الصفحة أصلا،
                                والمدرب يصحّح تكليفا لا يستطيع تأليفه. الاثنان هنا. */}
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                              <h3 className="flex items-center gap-2 text-sm font-black text-white/75">
                                <Upload className="h-4 w-4 text-teal-light-ink" /> مواد الشعبة
                              </h3>
                              {c.materials.length > 0 ? (
                                <ul className="mt-3 space-y-1.5">
                                  {c.materials.map((m) => (
                                    <li key={m.id} className="flex items-center justify-between gap-3 text-xs text-white/65">
                                      <span className="min-w-0 truncate">{m.title}</span>
                                      {m.readUrl && (
                                        <a href={`${API_BASE}${m.readUrl}`} target="_blank" rel="noreferrer"
                                          className="shrink-0 font-bold text-teal-light-ink underline decoration-dotted underline-offset-4">
                                          افتح
                                        </a>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="mt-2 text-[11px] text-white/45">لا مواد بعد — ارفع كرّاسة أو أضف رابطا.</p>
                              )}

                              <div className="mt-4 flex flex-wrap items-center gap-2">
                                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-teal/45 px-3.5 py-1.5 text-[11px] font-bold text-teal-light-ink transition hover:bg-teal/10">
                                  <Upload className="h-3 w-3" /> ارفع ملفا (كرّاسة أو فيديو)
                                  <input type="file" className="hidden" disabled={busy}
                                    onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadMaterialFile(c.id, f); e.target.value = ""; }} />
                                </label>
                              </div>

                              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                                <input
                                  aria-label="عنوان الرابط" placeholder="عنوان المادة"
                                  value={materialLink[c.id]?.title ?? ""}
                                  onChange={(e) => setMaterialLink({ ...materialLink, [c.id]: { title: e.target.value, url: materialLink[c.id]?.url ?? "" } })}
                                  className="rounded-lg border border-white/12 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:border-teal focus:outline-none"
                                />
                                <input
                                  aria-label="رابط المادة" dir="ltr" placeholder="https://…"
                                  value={materialLink[c.id]?.url ?? ""}
                                  onChange={(e) => setMaterialLink({ ...materialLink, [c.id]: { title: materialLink[c.id]?.title ?? "", url: e.target.value } })}
                                  className="rounded-lg border border-white/12 bg-black/30 px-3 py-2 text-left text-xs text-white placeholder:text-white/30 focus:border-teal focus:outline-none"
                                />
                                <button
                                  disabled={busy || !materialLink[c.id]?.title?.trim() || !materialLink[c.id]?.url?.trim()}
                                  onClick={() => void addMaterialLink(c.id)}
                                  className="cursor-pointer rounded-lg border border-white/15 px-4 py-2 text-[11px] font-bold text-white/70 transition hover:border-teal/50 hover:text-teal-light-ink disabled:opacity-40"
                                >
                                  أضف رابطا
                                </button>
                              </div>

                              <div className="mt-5 border-t border-white/10 pt-4">
                                <h3 className="flex items-center gap-2 text-sm font-black text-white/75">
                                  <ClipboardCheck className="h-4 w-4 text-gold-ink" /> تكليف جديد
                                </h3>
                                <p className="mt-1 text-[11px] text-white/45">
                                  ما تؤلّفه هنا يصل المسجلين، ويعود إليك تسليمهم في طابور المراجعة أدناه.
                                </p>
                                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                                  <input
                                    aria-label="عنوان التكليف" placeholder="عنوان الواجب أو المشروع"
                                    value={taskForm[c.id]?.title ?? ""}
                                    onChange={(e) => setTaskForm({ ...taskForm, [c.id]: { title: e.target.value, type: taskForm[c.id]?.type ?? "assignment" } })}
                                    className="rounded-lg border border-white/12 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:border-teal focus:outline-none"
                                  />
                                  <select
                                    aria-label="نوع التكليف"
                                    value={taskForm[c.id]?.type ?? "assignment"}
                                    onChange={(e) => setTaskForm({ ...taskForm, [c.id]: { title: taskForm[c.id]?.title ?? "", type: e.target.value } })}
                                    className="rounded-lg border border-white/12 bg-black/30 px-3 py-2 text-xs text-white focus:border-teal focus:outline-none [&>option]:bg-surface"
                                  >
                                    <option value="assignment">واجب</option>
                                    <option value="quiz">اختبار</option>
                                    <option value="project">مشروع تخرج</option>
                                  </select>
                                  <button
                                    disabled={busy || !taskForm[c.id]?.title?.trim()}
                                    onClick={() => void createAssessment(c.id)}
                                    className="cursor-pointer rounded-lg border border-gold/50 px-4 py-2 text-[11px] font-bold text-gold-ink transition hover:bg-gold/10 disabled:opacity-40"
                                  >
                                    أنشئ
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── اقتراحات التأجيل ──
                كانت الشاشة تقترح ولا تعرض ما اقترحته من قبل ولا تسمح بسحبه —
                المدرب يقترح موعدا ثم لا يعرف أين وقف اقتراحه إلا بسؤال الإدارة. */}
            {reschedules.length > 0 && (
              <section>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-black"><CalendarClock className="h-5 w-5 text-gold-ink" /> اقتراحات التأجيل</h2>
                <div className="space-y-3">
                  {reschedules.map((r) => (
                    <div key={r.id} className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold">{r.session.title} — {r.session.cohort.title}</p>
                          <p className="mt-0.5 text-[11px] text-white/45">موعد مقترح: {fmtDateTimeAr(r.proposedStartsAt)}</p>
                          <p className="mt-1 text-xs text-white/60">{r.reason}</p>
                          {r.reviewerComment && (
                            <p className="mt-1 text-[11px] text-white/50">ملاحظة الإدارة: {r.reviewerComment}</p>
                          )}
                        </div>
                        <span className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold ${r.status === "approved" ? "border-teal/40 text-teal-light-ink" : r.status === "rejected" ? "border-red-400/40 text-red-300" : r.status === "withdrawn" ? "border-white/15 text-white/45" : "border-gold/40 text-gold-ink"}`}>
                          {RESCHEDULE_STATUS_AR[r.status] ?? r.status}
                        </span>
                        {r.status === "pending" && (
                          <button type="button" disabled={busy}
                            onClick={() => void withdrawReschedule(r.id)}
                            className="shrink-0 cursor-pointer rounded-full border border-white/15 px-4 py-1.5 text-[11px] font-bold text-white/60 transition hover:border-red-400/40 hover:text-red-300 disabled:opacity-40">
                            سحب الاقتراح
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── طابور المراجعة ── */}
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-black"><ClipboardCheck className="h-5 w-5 text-gold-ink" /> طابور المراجعة</h2>
              {queue.length === 0 ? (
                <p className="rounded-3xl border border-white/10 bg-white/[0.02] py-12 text-center text-sm text-white/45">
                  لا تسليمات معلقة — كل شيء تحت السيطرة.
                </p>
              ) : (
                <div className="space-y-4">
                  {queue.map((q) => (
                    <div key={q.id} className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-black">{q.assessment.title}</p>
                          <p className="mt-0.5 text-xs text-white/50">
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
                        <p className="mt-3 max-h-32 overflow-y-auto rounded-2xl bg-black/30 p-4 text-sm leading-7 text-white/75">{q.textAnswer}</p>
                      )}
                      <textarea
                        value={reviewNote[q.id] ?? ""}
                        onChange={(e) => setReviewNote((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder="ملاحظة للمتعلم — إلزامية عند الرفض أو طلب الإعادة"
                        rows={2}
                        className="mt-3 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/25 focus:border-teal focus:outline-none"
                      />
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {q.status === "submitted" && (
                          <button disabled={busy} onClick={() => void reviewAction(q.id, "start_review")}
                            className="cursor-pointer rounded-full border border-white/20 px-4 py-1.5 text-[11px] font-bold text-white/70 transition hover:border-white/40">
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
                              className="w-20 rounded-lg border border-white/15 bg-black/30 px-2 py-1.5 text-xs text-white focus:border-teal focus:outline-none" />
                            <button disabled={busy || !(gradeForm[q.id] ?? "").trim()} onClick={() => void grade(q.id, q.assessment.maxScore)}
                              className="cursor-pointer rounded-full border border-white/20 px-3 py-1.5 text-[11px] font-bold text-white/70 transition hover:border-white/40 disabled:opacity-40">
                              سجّل الدرجة
                            </button>
                          </span>
                        )}
                      </div>
                      <div className="mt-3 flex gap-2 border-t border-white/8 pt-3">
                        <input value={feedbackForm[q.id] ?? ""}
                          onChange={(e) => setFeedbackForm((prev) => ({ ...prev, [q.id]: e.target.value }))}
                          placeholder="تغذية راجعة إضافية للمتعلم…"
                          className="flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/25 focus:border-teal focus:outline-none" />
                        <button disabled={busy || (feedbackForm[q.id] ?? "").trim().length < 3} onClick={() => void sendFeedback(q.id)}
                          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-[11px] font-black text-white transition hover:bg-white/15 disabled:opacity-40">
                          <MessageSquarePlus className="h-3 w-3" /> أرسل
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </TrainerLayout>
  );
}
