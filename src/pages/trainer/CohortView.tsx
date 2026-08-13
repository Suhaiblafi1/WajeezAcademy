import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import {
  AlertTriangle, ArrowRight, CheckCircle2, ClipboardCheck, FileBarChart,
  MessageSquareWarning, Video,
} from "lucide-react";
import TrainerLayout, { trainerIdentity } from "./TrainerLayout";
import { loadCohorts, markAttendance, requestRecordingPublish } from "@/data/trainer";
import { zoom } from "@/services/zoom";

const REC_LABEL: Record<string, { label: string; cls: string }> = {
  none: { label: "لم يُطلب النشر", cls: "text-white/35" },
  pending_review: { label: "بانتظار موافقة النشر (خصوصية)", cls: "text-[#FABC05]" },
  published: { label: "منشور للشعبة", cls: "text-[#6EC7D1]" },
};

export default function CohortView() {
  const { id } = useParams();
  const me = trainerIdentity()!;
  const [tick, setTick] = useState(0);
  const cohort = useMemo(() => loadCohorts(me.name).find((c) => c.id === id), [me.name, id, tick]);
  const [reportSent, setReportSent] = useState(false);
  const [zoomLinks, setZoomLinks] = useState<Record<string, string>>({});

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

  return (
    <TrainerLayout title={`${cohort.courseName} — ${cohort.pathwayName}`}>
      <Link to="/trainer" className="mb-5 inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white">
        <ArrowRight className="h-4 w-4" /> عودة لشعبي
      </Link>

      {/* مؤشرات الشعبة */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs text-white/50">السعة</p>
          <p className="mt-2 text-3xl font-black">{enrolled}<span className="text-sm text-white/40">/{cohort.capacity}</span></p>
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
                    <p className="text-[10px] text-white/40">حضور {st.attendancePct}% · {st.submitted ? `سلّم${st.lastGrade ? ` — ${st.lastGrade}` : ""}` : "لم يسلم بعد"}</p>
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
          <div className="mt-4 space-y-3">
            {cohort.sessions.map((s) => (
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
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {!s.attendanceMarked ? (
                    <button
                      onClick={() => { markAttendance(me.name, cohort.id, s.id); setTick(tick + 1); }}
                      className="cursor-pointer rounded-full border border-white/15 px-2.5 py-1 text-[10px] font-bold text-white/60 hover:border-[#38A7B4]/60 hover:text-[#6EC7D1]"
                    >
                      رصد الحضور
                    </button>
                  ) : (
                    <span className="rounded-full bg-[#38A7B4]/15 px-2.5 py-1 text-[10px] font-bold text-[#6EC7D1]">الحضور مرصود ✓</span>
                  )}
                  {s.recording === "none" ? (
                    <button
                      onClick={() => { requestRecordingPublish(me.name, cohort.id, s.id); setTick(tick + 1); }}
                      className="cursor-pointer rounded-full border border-white/15 px-2.5 py-1 text-[10px] font-bold text-white/60 hover:border-[#FABC05]/60 hover:text-[#FABC05]"
                    >
                      اطلب نشر التسجيل
                    </button>
                  ) : (
                    <span className={`rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-bold ${REC_LABEL[s.recording].cls}`}>
                      {REC_LABEL[s.recording].label}
                    </span>
                  )}
                </div>
                {s.notes && <p className="mt-2 text-[10px] leading-5 text-white/40">ملاحظاتك: {s.notes}</p>}
              </div>
            ))}
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
    </TrainerLayout>
  );
}
