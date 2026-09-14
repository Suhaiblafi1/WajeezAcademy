/* لقاءاتُ الشعبة وحضورُها — في مرحلة «لقاءات مباشرة» من التجهيز (د-٤).

   ═══ لماذا انتقلت من «التشغيل» ═══

   نصُّ د-٤: «واللقاءاتُ والحضورُ تنتقل هنا من التشغيل». وعلّتُه أنّ المدرّبَ
   كان يجدول لقاءَه في مرحلةٍ ويسجّل حضورَه في شاشةٍ أخرى — والشيءُ واحد.
   فمن فتح «لقاءات مباشرة» ليرى لقاءاته وجد نموذجَ جدولةٍ وحدَه: لا يرى ما
   جدوله، ولا من حضره، ولا بابا يقترح منه تأجيلا.

   وهو كذلك شرطُ «ع-١»: التشغيلُ يصير «مركزَ التواصل» ولا يبقى فيه إلّا
   المخاطبة — ولا يُفرَّغ قبل أن ينتقل ما فيه إلى موضعه.

   ═══ ولا يُنسَخ ═══

   شبكةُ الحضور تُعيد حسابَ تقدّم المتعلّم عند كلّ ضغطة. فنسختان منها في
   شاشتَين بابان لرقمٍ واحدٍ يراه المتعلّم ويُبنى عليه استحقاقُ شهادته —
   فنُقلت ولم تُنسَخ، وحارسُها يمنع عودتَها إلى «التشغيل».

   والمصدرُ هو المصدرُ نفسُه (`/ops`): لا مسارَ جديدٌ يُبنى لعرضٍ انتقل. */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { CalendarClock, CalendarDays, CalendarPlus, Loader2, Upload, Video } from "lucide-react";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { toast, toastError } from "@/components/Toast";
import { fmtDateTimeAr } from "@/utils/format";
import { usePlatformConfig } from "@/hooks/usePlatformConfig";
import { Panel, Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { controlCls } from "@/components/FormKit";

const API_BASE: string = import.meta.env.VITE_API_URL ?? "";

/** مرجعٌ ثابتٌ للحقل الفارغ — كائنٌ جديدٌ في كلّ تصيير يُعيد بناءَ الحقل */
const EMPTY_REC = { title: "", url: "" };

const ATTENDANCE_OPTIONS = [
  { value: "present", label: "حاضر" }, { value: "late", label: "متأخر" },
  { value: "absent", label: "غائب" }, { value: "excused", label: "معذور" },
] as const;

interface OpsRow {
  cohort: {
    sessions: {
      id: string; title: string; startsAt: string; status: string;
      zoom: { joinUrl: string; passcode: string | null } | null;
      recordings: { id: string; title: string; readUrl: string | null }[];
    }[];
    enrollments: {
      id: string; status: string;
      user: { displayName: string };
      attendance: { sessionId: string; status: string }[];
    }[];
  };
}

export default function SessionsAndAttendance({ cohortId }: { cohortId: string }) {
  const { fileUploads } = usePlatformConfig();
  const [row, setRow] = useState<OpsRow | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [recLink, setRecLink] = useState<Record<string, { title: string; url: string }>>({});
  const [rescheduleFor, setRescheduleFor] = useState<string | null>(null);
  const [rescheduleForm, setRescheduleForm] = useState({ at: "", reason: "" });

  const load = useCallback(async () => {
    try { setRow(await apiGet<OpsRow>(`/api/trainer/cohorts/${cohortId}/ops`)); setErr(""); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "تعذّر قراءة لقاءات الشعبة"); }
  }, [cohortId]);
  useEffect(() => { void load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, doneMsg: string) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); toast(doneMsg); await load(); }
    catch (e) { toastError(e instanceof ApiError ? e.message : "تعذر تنفيذ الإجراء"); }
    finally { setBusy(false); }
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
          method: "PUT", credentials: "include", headers: { "content-type": "application/octet-stream" }, body: file,
        });
        if (!put.ok) throw new ApiError("upload_failed", "تعذر رفع الملف بعد التسجيل", put.status);
      }
    }, "سُجل التسجيل ورُفع — سيظهر للمسجلين في الشعبة");

  const addRecordingLink = (sessionId: string) => {
    const form = recLink[sessionId] ?? EMPTY_REC;
    return act(
      () => apiPost(`/api/trainer/sessions/${sessionId}/recording-link`, { title: form.title.trim(), url: form.url.trim() }),
      "أُضيف التسجيل",
    ).then(() => setRecLink((prev) => ({ ...prev, [sessionId]: EMPTY_REC })));
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

  if (err) return <Card tone="danger" role="alert" className="text-center text-read font-bold text-red-300">{err}</Card>;
  if (!row) return <div className="grid place-items-center py-10"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground/50" aria-label="جارٍ التحميل" /></div>;

  const c = row.cohort;
  const active = c.enrollments.filter((e) => e.status !== "waitlisted");

  return (
    <Panel as="section">
      <h3 className="flex items-center gap-2 text-sm font-black text-foreground"><CalendarDays className="h-4 w-4 text-teal-light-ink" /> اللقاءات والحضور</h3>
      {c.sessions.length === 0 ? (
        <p className="mt-2 text-read text-muted-foreground">لا لقاءات مجدولة بعد — حدّدها في مرحلة «اللقاءات» من التجهيز.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {c.sessions.map((s) => (
            <Card key={s.id}>
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{s.title}</p>
                  <p className="mt-0.5 text-read text-muted-foreground">
                    {fmtDateTimeAr(s.startsAt)}
                    {s.status === "done" && " · انتهت"}
                  </p>
                </div>
                {s.zoom && (
                  <a href={s.zoom.joinUrl} target="_blank" rel="noreferrer"
                    className="flex min-h-9 items-center gap-1.5 rounded-full bg-teal px-4 py-1.5 text-fine font-black text-on-teal transition hover:bg-teal-light">
                    <Video className="h-3 w-3" /> افتح الاجتماع
                  </a>
                )}
                {s.status !== "done" && (
                  <a href={`/api/calendar/cohort-sessions/${s.id}.ics`}
                    className="flex min-h-9 items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-fine font-bold text-muted-foreground transition hover:border-white/35 hover:text-foreground">
                    <CalendarPlus className="h-3 w-3" /> أضِفها لتقويمك
                  </a>
                )}
                {/* الزرُّ يظهر حين يستطيع الخادمُ تخزينَ الملفّ — لا قبله */}
                {fileUploads && (
                  <label className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-fine font-bold text-muted-foreground transition hover:border-teal/50 hover:text-teal-light-ink">
                    <Upload className="h-3 w-3" /> ارفع التسجيل
                    <input type="file" accept="video/*" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadRecording(s.id, f); e.target.value = ""; }} />
                  </label>
                )}
                {s.status !== "done" && (
                  <Button tone="secondary" size="sm" type="button"
                    onClick={() => { setRescheduleFor(rescheduleFor === s.id ? null : s.id); setRescheduleForm({ at: "", reason: "" }); }} className="min-h-9">
                    <CalendarClock className="h-3 w-3" /> اقترح موعدا
                  </Button>
                )}
              </div>

              {/* الاقتراح لا يغيّر شيئا حتى تعتمده الإدارة — والنصّ يقولها قبل الضغط */}
              {rescheduleFor === s.id && (
                <Inset tone="warn" className="mt-3 space-y-2.5">
                  <p className="text-read leading-relaxed text-gold-ink">
                    تقترح ولا تغيّر: الموعد يبقى كما هو عند متعلّميك حتى تعتمد الإدارة اقتراحك.
                    {" "}ومآلُ اقتراحك — وسحبُه — في <Link to="/trainer/schedule" className="font-black underline">جدولي</Link>.
                  </p>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <div>
                      <label htmlFor={`rs-at-${s.id}`} className="mb-1 block text-read font-bold text-muted-foreground">الموعد المقترح</label>
                      <input id={`rs-at-${s.id}`} type="datetime-local" dir="ltr" value={rescheduleForm.at}
                        onChange={(e) => setRescheduleForm((f) => ({ ...f, at: e.target.value }))} className={`${controlCls} text-left`} />
                    </div>
                    <div>
                      <label htmlFor={`rs-why-${s.id}`} className="mb-1 block text-read font-bold text-muted-foreground">السبب — تقرؤه الإدارة لتقرّر</label>
                      <input id={`rs-why-${s.id}`} value={rescheduleForm.reason}
                        onChange={(e) => setRescheduleForm((f) => ({ ...f, reason: e.target.value }))}
                        placeholder="مثال: سفر في موعد الجلسة" className={controlCls} />
                    </div>
                  </div>
                  <Button tone="confirm" size="sm" type="button" disabled={busy || !rescheduleForm.at || rescheduleForm.reason.trim().length < 10}
                    onClick={() => void proposeReschedule(s.id)} className="disabled:cursor-not-allowed">
                    أرسل الاقتراح للإدارة
                  </Button>
                </Inset>
              )}
              {/* تسجيلُ اللقاء — رابطٌ يُلصَق، أو ملفٌّ يُرفع حين يُفتح التخزين.
                  موضعُه بطاقةُ اللقاء نفسِها: كانت لوحةً ثانيةً تُعيد سردَ
                  اللقاءات في الخطوة نفسِها، فقائمتان لشيءٍ واحدٍ في شاشةٍ
                  واحدةٍ هي الكثافةُ التي شكا منها صاحبُ المنصّة. */}
              <div className="mt-3 border-t border-white/8 pt-3">
                {s.recordings.length > 0 && (
                  <ul className="mb-2 space-y-1 text-read">
                    {s.recordings.map((r) => (
                      <li key={r.id}>
                        <a href={r.readUrl ?? "#"} target="_blank" rel="noreferrer" className="text-teal-light-ink underline decoration-dotted underline-offset-4">{r.title}</a>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <input value={(recLink[s.id] ?? EMPTY_REC).title}
                    onChange={(e) => setRecLink({ ...recLink, [s.id]: { ...(recLink[s.id] ?? EMPTY_REC), title: e.target.value } })}
                    placeholder="اسم التسجيل" aria-label={`اسم تسجيل ${s.title}`} className={controlCls} />
                  <input dir="ltr" value={(recLink[s.id] ?? EMPTY_REC).url}
                    onChange={(e) => setRecLink({ ...recLink, [s.id]: { ...(recLink[s.id] ?? EMPTY_REC), url: e.target.value } })}
                    placeholder="https://…" aria-label={`رابط تسجيل ${s.title}`} className={`${controlCls} text-left`} />
                  <Button tone="secondary" size="sm" disabled={busy || (recLink[s.id] ?? EMPTY_REC).title.trim().length < 2 || !/^https?:\/\//.test((recLink[s.id] ?? EMPTY_REC).url)}
                    onClick={() => void addRecordingLink(s.id)}>
                    أضف التسجيل
                  </Button>
                </div>
              </div>
              {s.zoom?.passcode && (
                <p className="mt-2 text-read text-muted-foreground">رمز المرور: <span className="font-mono text-foreground" dir="ltr">{s.zoom.passcode}</span></p>
              )}
              {/* شبكة الحضور — الحالةُ تُعلَن بـaria-pressed لا باللون وحدَه، وكلُّ زرٍّ باسم صاحبه */}
              <div className="mt-3 space-y-1.5 border-t border-white/8 pt-3">
                {active.map((e) => {
                  const current = e.attendance.find((a) => a.sessionId === s.id)?.status;
                  return (
                    <div key={e.id} className="flex items-center gap-3">
                      <p className="min-w-0 flex-1 truncate text-read text-foreground">{e.user.displayName}</p>
                      <div className="flex gap-1">
                        {ATTENDANCE_OPTIONS.map((opt) => (
                          <button key={opt.value} disabled={busy}
                            aria-pressed={current === opt.value}
                            aria-label={`${e.user.displayName}: ${opt.label}`}
                            onClick={() => void markAttendance(s.id, e.id, opt.value)}
                            className={`cursor-pointer rounded-full border px-2.5 py-1 text-fine font-bold transition disabled:opacity-40 ${
                              current === opt.value
                                ? "border-teal bg-teal/15 text-teal-light-ink"
                                : "border-white/12 text-muted-foreground hover:border-white/30 hover:text-foreground"
                            }`}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {active.length === 0 && <p className="text-read text-muted-foreground">لا متعلمين مسجلين بعد.</p>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </Panel>
  );
}
