import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import {
  ArrowRight, CalendarDays, CheckCircle2, ChevronDown, ClipboardCheck, GraduationCap,
  Loader2, MessageSquarePlus, RefreshCw, ServerOff, Star, Upload, Users, Video,
} from "lucide-react";
import { apiGet, apiPost, ApiError } from "@/services/api";

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

interface QueueItem {
  id: string; status: string; textAnswer: string | null; submittedAt: string; reviewNote: string | null;
  assessment: { title: string; maxScore: number; cohort: { title: string } };
  enrollment: { userId: string };
  grades: { score: string; maxScore: string }[];
  feedback: { body: string }[];
}

/** قمرة الشعبة — بوابة المدرب التشغيلية: شعبي فقط، حضور، تسجيلات، مراجعة وتقدير */
export default function CohortBoard() {
  const [cohorts, setCohorts] = useState<TrainerCohort[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [flash, setFlash] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({});
  const [gradeForm, setGradeForm] = useState<Record<string, string>>({});
  const [feedbackForm, setFeedbackForm] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true); setOffline(null);
    try {
      const [c, q] = await Promise.all([
        apiGet<TrainerCohort[]>("/api/trainer/my-cohorts"),
        apiGet<QueueItem[]>("/api/trainer/grading-queue"),
      ]);
      setCohorts(c);
      setQueue(q);
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

  const sendFeedback = (submissionId: string) =>
    act(async () => {
      await apiPost(`/api/trainer/submissions/${submissionId}/feedback`, { body: feedbackForm[submissionId] });
      setFeedbackForm((prev) => ({ ...prev, [submissionId]: "" }));
    }, "أُرسلت التغذية الراجعة للمتعلم");

  return (
    <div dir="rtl" className="min-h-screen bg-paper text-white">
      <header className="border-b border-white/8 px-5 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-white/60 transition hover:text-white">
            <ArrowRight className="h-4 w-4" /> أكاديمية وجيز
          </Link>
          <h1 className="flex items-center gap-2 text-sm font-black"><GraduationCap className="h-4 w-4 text-[#6EC7D1]" /> شعبي</h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8">
        {flash && (
          <p className="mb-5 flex items-center gap-2 rounded-2xl border border-[#38A7B4]/40 bg-[#38A7B4]/10 px-4 py-3 text-sm font-bold text-[#6EC7D1]">
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
          <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[#38A7B4]" /></div>
        ) : (
          <div className="space-y-10">
            {/* ── شعبي ── */}
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-black"><Users className="h-5 w-5 text-[#6EC7D1]" /> شعبي</h2>
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
                              <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-white/70"><CalendarDays className="h-4 w-4 text-[#6EC7D1]" /> الجلسات والحضور</h3>
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
                                            {new Date(s.startsAt).toLocaleString("ar-JO", { dateStyle: "medium", timeStyle: "short" })}
                                            {s.status === "done" && " · انتهت"}
                                          </p>
                                        </div>
                                        {s.zoom && (
                                          <a href={s.zoom.joinUrl} target="_blank" rel="noreferrer"
                                            className="flex items-center gap-1.5 rounded-full bg-[#38A7B4] px-4 py-1.5 text-[11px] font-black text-[#08272B] transition hover:bg-[#6EC7D1]">
                                            <Video className="h-3 w-3" /> افتح الاجتماع
                                          </a>
                                        )}
                                        <label className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-bold text-white/60 transition hover:border-[#38A7B4]/50 hover:text-[#6EC7D1]">
                                          <Upload className="h-3 w-3" /> ارفع التسجيل
                                          <input type="file" accept="video/*" className="hidden"
                                            onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadRecording(s.id, f); e.target.value = ""; }} />
                                        </label>
                                      </div>
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
                                                        ? "border-[#38A7B4] bg-[#38A7B4]/15 text-[#6EC7D1]"
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
                                        <div className="h-full rounded-full bg-[#38A7B4]" style={{ width: `${e.courseProgress?.percent ?? 0}%` }} />
                                      </div>
                                      <p className="w-10 text-left text-[10px] text-white/45">{e.courseProgress?.percent ?? 0}٪</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── طابور المراجعة ── */}
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-black"><ClipboardCheck className="h-5 w-5 text-[#FABC05]" /> طابور المراجعة</h2>
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
                            {q.assessment.cohort.title} · {SUBMISSION_STATUS[q.status] ?? q.status} · {new Date(q.submittedAt).toLocaleString("ar-JO", { dateStyle: "medium", timeStyle: "short" })}
                          </p>
                        </div>
                        {q.grades[0] && (
                          <span className="rounded-full bg-[#38A7B4]/15 px-3 py-1 text-[11px] font-black text-[#6EC7D1]">
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
                        className="mt-3 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/25 focus:border-[#38A7B4] focus:outline-none"
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
                              className="cursor-pointer rounded-full bg-[#38A7B4] px-4 py-1.5 text-[11px] font-black text-[#08272B] transition hover:bg-[#6EC7D1]">
                              قبول
                            </button>
                            <button disabled={busy} onClick={() => void reviewAction(q.id, "request_resubmit")}
                              className="cursor-pointer rounded-full border border-[#FABC05]/40 px-4 py-1.5 text-[11px] font-bold text-[#FABC05] transition hover:bg-[#FABC05]/10">
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
                            <Star className="h-3.5 w-3.5 text-[#FABC05]" />
                            <input type="number" min={0} max={q.assessment.maxScore} value={gradeForm[q.id] ?? ""}
                              onChange={(e) => setGradeForm((prev) => ({ ...prev, [q.id]: e.target.value }))}
                              placeholder={`من ${q.assessment.maxScore}`}
                              className="w-20 rounded-lg border border-white/15 bg-black/30 px-2 py-1.5 text-xs text-white focus:border-[#38A7B4] focus:outline-none" />
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
                          className="flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/25 focus:border-[#38A7B4] focus:outline-none" />
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
      </main>
    </div>
  );
}
