import { useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import {
  AlertTriangle, ArrowRight, CheckCircle2, ClipboardCheck, FileBarChart,
  MessageSquareWarning, Upload, UserCheck, Video, X,
} from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import { trainerIdentity } from "./trainer-identity";
import {
  loadCohorts, setStudentAttendance, finalizeAttendance,
  uploadSessionRecording, requestRecordingPublish,
} from "@/data/trainer";
import { zoom } from "@/services/zoom";

const REC_LABEL: Record<string, { label: string; cls: string }> = {
  uploaded: { label: "رُفع — بانتظار طلب النشر", cls: "text-white/70" },
  pending_review: { label: "بانتظار موافقة النشر (خصوصية)", cls: "text-[#FABC05]" },
  published: { label: "منشور للشعبة", cls: "text-[#6EC7D1]" },
};

export default function CohortView() {
  const { id } = useParams();
  const me = trainerIdentity();
  const meName = me?.name ?? ""; // الإطار يعرض بوابة الهوية عند غيابها
  const [tick, setTick] = useState(0);
  const cohort = useMemo(() => { void tick; return loadCohorts(meName).find((c) => c.id === id); }, [meName, id, tick]); // tick عداد إبطال مقصود بعد كل كتابة
  const [reportSent, setReportSent] = useState(false);
  const [zoomLinks, setZoomLinks] = useState<Record<string, string>>({});
  const [note, setNote] = useState<string | null>(null);
  /* كشف الرصد المفتوح: جلسة + مسودة حالات الطلاب */
  const [roster, setRoster] = useState<{ sessionId: string; draft: Record<string, "present" | "absent"> } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);

  if (!cohort) {
    return (
      <TrainerLayout title="شعبة غير موجودة">
        <Link to="/trainer" className="flex items-center gap-2 text-[#6EC7D1]"><ArrowRight className="h-4 w-4" /> عودة لشعبي</Link>
      </TrainerLayout>
    );
  }

  const enrolled = cohort.students.length;
  const avgAttendance = Math.round(cohort.students.reduce((s, x) => s + x.attendancePct, 0) / Math.max(1, enrolled));
  const submittedPct = Math.round((cohort.students.filter((s) => s.submitted).length / Math.max(1, enrolled)) * 100);
  const grades = cohort.students.filter((s) => s.lastGrade !== undefined).map((s) => s.lastGrade!);
  const avgGrade = grades.length ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length) : null;
  const atRisk = cohort.students.filter((s) => s.atRisk);

  const openRoster = (sessionId: string, existing?: Record<string, "present" | "absent">) => {
    setRoster({
      sessionId,
      draft: existing
        ? { ...existing }
        : Object.fromEntries(cohort.students.map((s) => [s.id, "present" as const])),
    });
  };

  const saveRoster = () => {
    if (!roster) return;
    for (const [studentId, status] of Object.entries(roster.draft)) {
      setStudentAttendance(cohort.id, roster.sessionId, studentId, status);
    }
    finalizeAttendance(meName, cohort.id, roster.sessionId);
    const present = Object.values(roster.draft).filter((v) => v === "present").length;
    setNote(`رُصد حضور الجلسة: ${present} حاضر و${enrolled - present} غائب — أعيد حساب تقدم كل طالب فورا كما يفعل الخادم.`);
    setRoster(null);
    setTick(tick + 1);
  };

  const pickRecording = (sessionId: string) => {
    setUploadTarget(sessionId);
    fileRef.current?.click();
  };

  const onRecordingPicked = (file: File | null) => {
    if (!file || !uploadTarget) return;
    uploadSessionRecording(meName, cohort.id, uploadTarget, file.name);
    setNote(`رُفع «${file.name}» كملف خاص برابط رفع موقع — لا يظهر للطلاب قبل موافقة النشر.`);
    setUploadTarget(null);
    setTick(tick + 1);
  };

  return (
    <TrainerLayout title={`${cohort.courseName} — ${cohort.pathwayName}`}>
      <Link to="/trainer" className="mb-5 inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white">
        <ArrowRight className="h-4 w-4" /> عودة لشعبي
      </Link>

      {note && (
        <p className="mb-5 flex items-center gap-2 rounded-2xl border border-[#38A7B4]/40 bg-[#38A7B4]/10 px-4 py-3 text-sm font-bold text-[#6EC7D1]">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {note}
        </p>
      )}

      {/* مؤشرات الشعبة */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs text-white/50">السعة</p>
          <p className="mt-2 text-3xl font-black">{enrolled}<span className="text-sm text-white/50">/{cohort.capacity}</span></p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs text-white/50">متوسط الحضور</p>
          <p className="mt-2 text-3xl font-black">{avgAttendance}%</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs text-white/50">نسبة التسليم</p>
          <p className="mt-2 text-3xl font-black">{submittedPct}%</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs text-white/50">متوسط الدرجات</p>
          <p className="mt-2 text-3xl font-black">{avgGrade ?? "—"}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {/* الطلاب */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 lg:col-span-2">
          <p className="text-sm font-black">قائمة الطلاب ({enrolled})</p>
          <div className="mt-4 space-y-2">
            {cohort.students.map((st) => (
              <div key={st.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
                st.atRisk ? "border-red-500/30 bg-red-500/5" : "border-white/10 bg-black/20"
              }`}>
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-[#38A7B4]/15 text-sm font-black text-[#6EC7D1]">
                    {st.name.charAt(0)}
                  </span>
                  <div>
                    <p className="text-sm font-bold">{st.name}</p>
                    <p className="text-[10px] text-white/50">حضور {st.attendancePct}% · {st.submitted ? `سلّم${st.lastGrade ? ` — ${st.lastGrade}` : ""}` : "لم يسلم بعد"}</p>
                  </div>
                </div>
                {st.atRisk ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1 text-[10px] font-bold text-red-300">
                    <AlertTriangle className="h-3 w-3" /> معرض للتعثر — أبلغ المستشار
                  </span>
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-[#38A7B4]/60" />
                )}
              </div>
            ))}
          </div>
          {atRisk.length > 0 && (
            <p className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/5 px-4 py-3 text-[11px] leading-5 text-red-200">
              <MessageSquareWarning className="h-4 w-4 shrink-0" />
              {atRisk.length} {atRisk.length === 1 ? "طالب معرض" : "طلاب معرضون"} للتعثر — صعّدهم لمستشارهم بدل محاولة حلها وحدك.
            </p>
          )}
        </section>

        {/* الجلسات */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <p className="flex items-center gap-2 text-sm font-black"><Video className="h-4 w-4 text-[#FABC05]" /> إدارة الجلسات</p>
          <input
            ref={fileRef} type="file" accept="video/*" className="hidden"
            onChange={(e) => onRecordingPicked(e.target.files?.[0] ?? null)}
          />
          <div className="mt-4 space-y-3">
            {cohort.sessions.map((s) => {
              const presentCount = s.attendance ? Object.values(s.attendance).filter((v) => v === "present").length : 0;
              return (
                <div key={s.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-bold">{s.title}</p>
                  <p className="mt-1 text-[11px] text-white/45">{s.date} · {s.time}</p>
                  {zoomLinks[s.id] ? (
                    <a href={zoomLinks[s.id]} target="_blank" rel="noreferrer" className="mt-2 block rounded-full bg-[#2D8CFF] py-1.5 text-center text-[11px] font-black text-white">
                      افتح غرفة Zoom
                    </a>
                  ) : (
                    <button
                      onClick={() => zoom.getJoinInfo(s.id).then((i) => setZoomLinks({ ...zoomLinks, [s.id]: i.joinUrl }))}
                      className="mt-2 w-full cursor-pointer rounded-full border border-[#2D8CFF]/50 py-1.5 text-[11px] font-bold text-[#2D8CFF] hover:bg-[#2D8CFF]/10"
                    >
                      رابط Zoom للجلسة
                    </button>
                  )}

                  {/* الحضور الفردي */}
                  <div className="mt-2.5">
                    {!s.attendanceMarked ? (
                      <button
                        onClick={() => openRoster(s.id)}
                        className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1 text-[10px] font-bold text-white/60 hover:border-[#38A7B4]/60 hover:text-[#6EC7D1]"
                      >
                        <UserCheck className="h-3 w-3" /> رصد حضور الجلسة ({enrolled} طالبا)
                      </button>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-[#38A7B4]/15 px-2.5 py-1 text-[10px] font-bold text-[#6EC7D1]">
                          مرصود ✓ — حاضر {presentCount} · غائب {enrolled - presentCount}
                        </span>
                        <button
                          onClick={() => openRoster(s.id, s.attendance)}
                          className="cursor-pointer rounded-full border border-white/15 px-2.5 py-1 text-[10px] font-bold text-white/50 hover:text-white"
                        >
                          عدّل الرصد
                        </button>
                      </div>
                    )}
                  </div>

                  {/* التسجيل: رفع ثم طلب نشر */}
                  <div className="mt-2">
                    {s.recording === "none" ? (
                      <button
                        onClick={() => pickRecording(s.id)}
                        className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1 text-[10px] font-bold text-white/60 hover:border-[#FABC05]/60 hover:text-[#FABC05]"
                      >
                        <Upload className="h-3 w-3" /> ارفع تسجيل الجلسة
                      </button>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-bold ${REC_LABEL[s.recording].cls}`}>
                          {REC_LABEL[s.recording].label}
                        </span>
                        {s.recordingFile && <span className="text-[10px] text-white/50" dir="ltr">{s.recordingFile}</span>}
                        {s.recording === "uploaded" && (
                          <button
                            onClick={() => { requestRecordingPublish(meName, cohort.id, s.id); setNote("طُلب نشر التسجيل — لا يُنشر قبل استكمال موافقة الخصوصية."); setTick(tick + 1); }}
                            className="cursor-pointer rounded-full border border-[#FABC05]/50 px-2.5 py-1 text-[10px] font-bold text-[#FABC05] hover:bg-[#FABC05]/10"
                          >
                            اطلب نشر التسجيل
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {s.notes && <p className="mt-2 text-[10px] leading-5 text-white/50">ملاحظاتك: {s.notes}</p>}
                </div>
              );
            })}
          </div>

          {/* تقرير الشعبة */}
          <button
            onClick={() => setReportSent(true)}
            disabled={reportSent}
            className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-[#38A7B4]/40 py-2.5 text-sm font-bold text-[#6EC7D1] transition hover:bg-[#38A7B4]/10 disabled:cursor-default disabled:opacity-60"
          >
            {reportSent ? <CheckCircle2 className="h-4 w-4" /> : <FileBarChart className="h-4 w-4" />}
            {reportSent ? "أُرسل تقرير الشعبة للمنسق ✓" : "أرسل تقرير الشعبة"}
          </button>
        </section>
      </div>

      <Link to="/trainer/grading" className="mt-6 flex items-center justify-center gap-2 rounded-3xl border border-[#FABC05]/30 bg-[#FABC05]/5 p-5 text-sm font-black text-[#FABC05] transition hover:border-[#FABC05]/60">
        <ClipboardCheck className="h-4 w-4" /> انتقل لطابور تقييم واجبات هذه الشعبة وغيرها
      </Link>

      {/* نافذة كشف الحضور */}
      {roster && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5 backdrop-blur-sm">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-[#151515] p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-black">كشف حضور الجلسة</h3>
              <button onClick={() => setRoster(null)} className="cursor-pointer text-white/50 hover:text-white" aria-label="إغلاق"><X className="h-5 w-5" /></button>
            </div>
            <p className="mt-1.5 text-xs leading-6 text-white/55">
              رصد كل طالب على حدة — عند الحفظ يُعاد حساب نسبة حضوره وتقدمه فورا.
            </p>
            <div className="mt-4 space-y-2">
              {cohort.students.map((st) => {
                const v = roster.draft[st.id] ?? "present";
                return (
                  <div key={st.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-2.5">
                    <p className="text-sm font-bold">{st.name}</p>
                    <div className="flex gap-1.5">
                      {(["present", "absent"] as const).map((opt) => (
                        <button
                          key={opt}
                          onClick={() => setRoster({ ...roster, draft: { ...roster.draft, [st.id]: opt } })}
                          className={`cursor-pointer rounded-full px-3.5 py-1 text-[11px] font-bold transition ${
                            v === opt
                              ? opt === "present" ? "bg-[#38A7B4] text-[#08272B]" : "bg-red-500/80 text-white"
                              : "bg-white/[0.05] text-white/50 hover:text-white/70"
                          }`}
                        >
                          {opt === "present" ? "حاضر" : "غائب"}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              onClick={saveRoster}
              className="mt-5 w-full cursor-pointer rounded-full bg-[#FABC05] py-3 font-black text-[#0D0D0D] transition hover:bg-[#FABC05]/90"
            >
              احفظ الرصد وأعد حساب التقدم
            </button>
          </div>
        </div>
      )}
    </TrainerLayout>
  );
}
