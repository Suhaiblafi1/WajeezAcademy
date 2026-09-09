/* تشغيلُ الشعبة — المرحلةُ الثانية من صفحة الشعبة الواحدة.

   ═══ ما كان ═══

   شاشتان لشعبةٍ واحدة: «ورشةُ الشعبة» للتجهيز (الاسمُ والمحاورُ والمصادرُ
   والاعتماد)، و«شعبي» للتشغيل (الحضورُ والموادُّ والتكاليفُ والرسائل) — وكلُّ
   شعبةٍ في «شعبي» طيّةٌ تُفتح على كلّ ذلك دفعةً واحدة. فسأل صاحبُ المنصّة:
   «أين المصادر وأين تفاصيل الواجبات؟ أرى فقط عنوانا» — كانت في الشاشة
   الأخرى.

   ═══ القرار (٨ سبتمبر ٢٠٢٦) ═══

   صفحةٌ واحدةٌ للشعبة بمرحلتين: «التجهيز» ثمّ «التشغيل». وهذا الملفُّ هو
   التشغيل: ما يفعله المدرّبُ والشعبةُ جارية — يسجّل الحضور، ويفتح الاجتماع،
   ويرفع التسجيل، ويقترح تأجيلا، ويخاطب متعلّميه، ويضيف موادّ، ويرى تكاليفَه
   وما سُلّم منها. وأمّا تأليفُ التكاليف فمرحلةٌ في التجهيز، ومن هنا بابٌ
   إليها.

   والحرّاسُ الذين كانوا على «شعبي» انتقلوا إلى هنا بحمولتهم نفسِها
   (`cohort-messaging.test.ts` · `cohort-board-assignments.test.ts`): الرسالةُ
   تُسجَّل ثمّ تُوصَّل والسجلُّ يُعاد تحميلُه، والتأجيلُ يُقترح ولا يُغيَّر،
   وأزرارُ الحضور تقول حالتَها لمن لا يرى. */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import {
  CalendarClock, CalendarDays, CalendarPlus, ClipboardCheck, Loader2, MessageSquarePlus, Upload, Users, Video,
} from "lucide-react";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { toast, toastError } from "@/components/Toast";
import { fmtDateTimeAr } from "@/utils/format";
import { usePlatformConfig } from "@/hooks/usePlatformConfig";
import { Panel, Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { controlCls, areaCls } from "@/components/FormKit";
import CohortAssignments, { type CohortAssessment } from "./CohortAssignments";

const API_BASE: string = import.meta.env.VITE_API_URL ?? "";

const ATTENDANCE_OPTIONS = [
  { value: "present", label: "حاضر" }, { value: "late", label: "متأخر" },
  { value: "absent", label: "غائب" }, { value: "excused", label: "معذور" },
] as const;

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
      user: { displayName: string };
      courseProgress: { percent: number } | null;
      attendance: { sessionId: string; status: string }[];
      referredByMe?: boolean;
    }[];
    materials: { id: string; title: string; readUrl: string | null }[];
    assessments: CohortAssessment[];
  };
}

interface CohortMessage {
  id: string; audience: string; body: string; recipients: number; createdAt: string;
  author: { displayName: string };
  enrollment: { user: { displayName: string } } | null;
}

export default function CohortOps({ cohortId, onAuthorAssignment }: {
  cohortId: string;
  /** تأليفُ التكاليف مرحلةٌ في التجهيز — الزرُّ هنا يقود إليها */
  onAuthorAssignment?: () => void;
}) {
  const { fileUploads } = usePlatformConfig();
  const [row, setRow] = useState<TrainerCohort | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [materialLink, setMaterialLink] = useState({ title: "", url: "" });
  const [msgForm, setMsgForm] = useState({ body: "", enrollmentId: "" });
  const [msgLog, setMsgLog] = useState<Record<string, CohortMessage[]>>({});
  const [rescheduleFor, setRescheduleFor] = useState<string | null>(null);
  const [rescheduleForm, setRescheduleForm] = useState({ at: "", reason: "" });

  const load = useCallback(async () => {
    try { setRow(await apiGet<TrainerCohort>(`/api/trainer/cohorts/${cohortId}/ops`)); setErr(""); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "تعذّر قراءة تشغيل الشعبة"); }
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

  /* رفعُ ملفٍّ — تسجيلٌ ثمّ رفعٌ موقّع. والخادمُ يفكّ جسمَ الرفع كـoctet-stream
     فقط؛ النوعُ الحقيقيُّ مسجَّلٌ في خطوة التسجيل التي قبله. */
  const putFile = async (uploadUrl: string, file: File, failMsg: string) => {
    const put = await fetch(`${API_BASE}${uploadUrl}`, {
      method: "PUT", credentials: "include", headers: { "content-type": "application/octet-stream" }, body: file,
    });
    if (!put.ok) throw new ApiError("upload_failed", failMsg, put.status);
  };

  const uploadMaterialFile = (file: File) =>
    act(async () => {
      const res = await apiPost<{ uploadUrl?: string }>(`/api/trainer/cohorts/${cohortId}/materials`, {
        title: file.name.replace(/\.[^.]+$/, ""), kind: "file",
        file: { originalName: file.name, mime: file.type || "application/octet-stream", sizeBytes: file.size },
      });
      if (res.uploadUrl) await putFile(res.uploadUrl, file, "تعذر رفع الملف بعد تسجيل المادة");
    }, "أُضيفت المادة ورُفعت — تظهر للمسجلين في الشعبة");

  const addMaterialLink = () => {
    if (!materialLink.title.trim() || !materialLink.url.trim()) return;
    return act(
      () => apiPost(`/api/trainer/cohorts/${cohortId}/materials`, { title: materialLink.title.trim(), kind: "link", externalUrl: materialLink.url.trim() }),
      "أُضيف الرابط إلى مواد الشعبة",
    ).then(() => setMaterialLink({ title: "", url: "" }));
  };

  const uploadRecording = (sessionId: string, file: File) =>
    act(async () => {
      const res = await apiPost<{ uploadUrl?: string }>(`/api/trainer/sessions/${sessionId}/recordings`, {
        title: file.name.replace(/\.[^.]+$/, ""), mime: file.type || "video/mp4", sizeBytes: file.size,
      });
      if (res.uploadUrl) await putFile(res.uploadUrl, file, "تعذر رفع الملف بعد التسجيل");
    }, "سُجل التسجيل ورُفع — سيظهر للمسجلين في الشعبة");

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
    if (!msgForm.body.trim()) return;
    void act(async () => {
      await apiPost(`/api/trainer/cohorts/${cohortId}/messages`, {
        audience: msgForm.enrollmentId ? "learner" : "cohort",
        enrollmentId: msgForm.enrollmentId || undefined,
        body: msgForm.body.trim(),
      });
      setMsgForm({ body: "", enrollmentId: "" });
      await loadMessages(cohortId);
    }, msgForm.enrollmentId ? "وصلت رسالتك المتعلّم — وبقيت في السجلّ" : "بلغ إعلانك الشعبة — وبقي في السجلّ");
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
  if (!row) return <div className="grid place-items-center py-16"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground/50" aria-label="جارٍ التحميل" /></div>;

  const c = row.cohort;
  const active = c.enrollments.filter((e) => e.status !== "waitlisted");

  return (
    <div className="space-y-5">
      {/* ── اللقاءات والحضور ── */}
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

      {/* ── تقدّم المتعلّمين ── */}
      <Panel as="section">
        <h3 className="flex items-center gap-2 text-sm font-black text-foreground"><Users className="h-4 w-4 text-teal-light-ink" /> من التحق وتقدّمُه ({active.length})</h3>
        {active.length === 0 ? (
          <p className="mt-2 text-read text-muted-foreground">لم يلتحق أحدٌ بعد — يظهرون هنا فورَ تسجيلهم.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {active.map((e) => (
              <div key={e.id} className="flex items-center gap-3">
                <p className="w-40 truncate text-read text-foreground">
                  {e.user.displayName}
                  {e.referredByMe && <span className="mr-2 rounded-full bg-gold/15 px-2 py-0.5 text-read font-bold text-gold-ink">عبر رابطك</span>}
                </p>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-teal" style={{ width: `${e.courseProgress?.percent ?? 0}%` }} />
                </div>
                <p className="w-10 text-left text-read text-muted-foreground">{e.courseProgress?.percent ?? 0}٪</p>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* ── مخاطبة الشعبة ── */}
      <Panel as="section">
        <h3 className="flex items-center gap-2 text-sm font-black text-foreground">
          <MessageSquarePlus className="h-4 w-4 text-teal-light-ink" /> مخاطبة الشعبة
        </h3>
        <p className="mt-1 text-read leading-relaxed text-muted-foreground">
          إعلانٌ يبلغ كلّ مسجَّل، أو رسالةٌ إلى متعلّم بعينه. وكلاهما يبقى في السجلّ أدناه.
        </p>
        <div className="mt-3 space-y-2.5">
          <select aria-label="إلى من" value={msgForm.enrollmentId}
            onChange={(e) => setMsgForm((f) => ({ ...f, enrollmentId: e.target.value }))}
            className={`${controlCls} [&>option]:bg-surface`}>
            <option value="">إلى الشعبة كلّها ({active.length} متعلّما)</option>
            {active.map((e) => <option key={e.id} value={e.id}>إلى {e.user.displayName} وحده</option>)}
          </select>
          <textarea aria-label="نصّ الرسالة" rows={3} maxLength={2000} value={msgForm.body}
            onChange={(e) => setMsgForm((f) => ({ ...f, body: e.target.value }))}
            placeholder="اكتب ما تريد أن يبلغهم…" className={areaCls} />
          <Button tone="confirm" size="sm" type="button" disabled={busy || msgForm.body.trim().length < 2}
            onClick={() => sendMessage(c.id)} className="min-h-9 disabled:cursor-not-allowed">
            <MessageSquarePlus className="h-3 w-3" /> أرسل
          </Button>
        </div>
        <div className="mt-4 border-t border-white/8 pt-3">
          <Button type="button" tone="ghost" size="sm" className="px-0 text-teal-light-ink" onClick={() => void loadMessages(c.id)}>
            {msgLog[c.id] ? "حدّث السجلّ" : "اعرض سجلّ ما أُرسل"}
          </Button>
          {msgLog[c.id] && (
            msgLog[c.id].length === 0 ? (
              <p className="mt-2 text-read text-muted-foreground">لم تُرسل شيئا في هذه الشعبة بعد.</p>
            ) : (
              <ul className="mt-2.5 space-y-2">
                {msgLog[c.id].map((m) => (
                  <Inset as="li" key={m.id}>
                    <p className="text-read text-muted-foreground">
                      {m.audience === "cohort" ? `إلى الشعبة · ${m.recipients} متعلّما` : `إلى ${m.enrollment?.user.displayName ?? "متعلّم"}`}
                      {" · "}{fmtDateTimeAr(m.createdAt)}
                    </p>
                    <p className="mt-1.5 whitespace-pre-line text-read leading-6 text-foreground">{m.body}</p>
                  </Inset>
                ))}
              </ul>
            )
          )}
        </div>
      </Panel>

      {/* ── مواد الشعبة ── */}
      <Panel as="section">
        <h3 className="flex items-center gap-2 text-sm font-black text-foreground"><Upload className="h-4 w-4 text-teal-light-ink" /> مواد الشعبة</h3>
        {c.materials.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {c.materials.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 text-read text-foreground">
                <span className="min-w-0 truncate">{m.title}</span>
                {m.readUrl && (
                  <a href={`${API_BASE}${m.readUrl}`} target="_blank" rel="noreferrer" className="shrink-0 font-bold text-teal-light-ink underline decoration-dotted underline-offset-4">افتح</a>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-read text-muted-foreground">لا مواد بعد — {fileUploads ? "ارفع كرّاسة أو أضف رابطا." : "أضف رابطا أدناه."}</p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {fileUploads ? (
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-teal/45 px-3.5 py-1.5 text-fine font-bold text-teal-light-ink transition hover:bg-teal/10">
              <Upload className="h-3 w-3" /> ارفع ملفا (كرّاسة أو فيديو)
              <input type="file" className="hidden" disabled={busy}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadMaterialFile(f); e.target.value = ""; }} />
            </label>
          ) : (
            <p className="text-read leading-6 text-muted-foreground">
              رفعُ الملفّات لم يُفعَّل على هذه المنصّة بعد — <span className="font-bold text-foreground">أضف المادّةَ برابطٍ أدناه</span> (Drive أو YouTube أو أيّ رابطٍ يفتحه طلبتُك).
            </p>
          )}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input aria-label="عنوان الرابط" placeholder="عنوان المادة" value={materialLink.title}
            onChange={(e) => setMaterialLink((f) => ({ ...f, title: e.target.value }))} className={controlCls} />
          <input aria-label="رابط المادة" dir="ltr" placeholder="https://…" value={materialLink.url}
            onChange={(e) => setMaterialLink((f) => ({ ...f, url: e.target.value }))} className={`${controlCls} text-left`} />
          <Button tone="secondary" size="sm" disabled={busy || !materialLink.title.trim() || !materialLink.url.trim()} onClick={() => void addMaterialLink()}>
            أضف رابطا
          </Button>
        </div>
      </Panel>

      {/* ── التكاليف: ما سُلّم وما ينتظر — والتأليفُ في التجهيز ── */}
      <Panel as="section">
        <h3 className="flex items-center gap-2 text-sm font-black text-foreground"><ClipboardCheck className="h-4 w-4 text-gold-ink" /> التكاليفُ وتسليماتُها</h3>
        <CohortAssignments items={c.assessments} learners={active.length} />
        {onAuthorAssignment && (
          <Button tone="secondary" size="sm" type="button" onClick={onAuthorAssignment} className="mt-3">
            <ClipboardCheck className="h-3 w-3" /> ألّف تكليفا جديدا — من مرحلة التكاليف
          </Button>
        )}
      </Panel>
    </div>
  );
}
