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
import { CalendarDays, CalendarPlus, Loader2, Trash2, Upload, Video } from "lucide-react";
import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from "@/services/api";
import { toast, toastError } from "@/components/Toast";
import { fmtDateTimeAr } from "@/utils/format";
import { usePlatformConfig } from "@/hooks/usePlatformConfig";
import { Panel, Card, Inset } from "@/components/ui/Surface";
import ConfirmAction from "@/components/ConfirmAction";
import Button from "@/components/ui/Button";
import { controlCls } from "@/components/FormKit";
import { countAr } from "@/application/text/count-ar";
import { openableRecordings } from "@/application/learning/recording-href";

const API_BASE: string = import.meta.env.VITE_API_URL ?? "";

/** مرجعٌ ثابتٌ للحقل الفارغ — كائنٌ جديدٌ في كلّ تصيير يُعيد بناءَ الحقل */
const EMPTY_MOVE = { date: "", from: "", to: "" };

/* صيغةُ العدد لا تُرتجَل: «١١٨ دقيقةٌ» و«١ حاضر» يقرؤهما المدرّبُ في كلّ لقاء */
const MINUTE_FORMS = { one: "دقيقة", two: "دقيقتان", few: "دقائق", many: "دقيقة" } as const;
const PERSON_FORMS = { one: "واحد", two: "اثنان", few: "أشخاص", many: "شخصا" } as const;

const ATTENDANCE_OPTIONS = [
  { value: "present", label: "حاضر" }, { value: "late", label: "متأخر" },
  { value: "absent", label: "غائب" }, { value: "excused", label: "معذور" },
] as const;

interface OpsRow {
  cohort: {
    sessions: {
      id: string; title: string; startsAt: string; endsAt: string | null; status: string;
      /* موقفُ الإدارة من اللقاء — والفارغُ معتمَدٌ (صفوفُ ما قبل العمود) */
      approvalState?: string | null; reviewNote?: string | null;
      zoom: {
        joinUrl: string; passcode: string | null;
        /* ما وقع فعلا — يملؤه webhook زووم لا يدٌ. والمجدولُ نيّةٌ، وهذا خبر. */
        actualStartAt: string | null; durationMin: number | null; participantCount: number | null;
        syncState: string | null; syncError: string | null;
      } | null;
      recordings: { id: string; title: string; readUrl: string | null; externalUrl: string | null }[];
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
  const [moveFor, setMoveFor] = useState<string | null>(null);
  const [moveForm, setMoveForm] = useState(EMPTY_MOVE);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);

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

  /* ═══ ينقل موعدَه بنفسه — لا يستأذن فيه ═══

     كان هنا «اقترح موعدا»: يرفع طلبا إلى طابورٍ عند الإدارة وينتظر. وقال
     صاحبُ المنصّة (١٧ سبتمبر ٢٠٢٦): «لماذا يقترح موعدا وهو من يحدّده
     بالبداية؟» — وهو محقّ. والمسلكُ الصحيحُ كُتب في الخادم في ١٣ سبتمبر
     («المدرّبُ ينقل لقاءَه — لا يقترح نقله») **ولم تنادِه شاشةٌ واحدة**؛
     بقيت هذه اللوحةُ تنادي بابَ الاستثناء وتترك بابَ الروتين.

     وقرارُه في النقل: «يغيّرُه فيرجع لانتظار الإدارة». فالنقلُ ينفُذ في
     الحال، ويسقط اللقاءُ المعتمَدُ إلى الانتظار، ويُبلَّغ مسجَّلوه. */
  const moveSession = (sessionId: string) =>
    act(async () => {
      await apiPatch(`/api/trainer/sessions/${sessionId}`, {
        startsAt: new Date(`${moveForm.date}T${moveForm.from}`).toISOString(),
        endsAt: new Date(`${moveForm.date}T${moveForm.to}`).toISOString(),
      });
      setMoveFor(null);
      setMoveForm(EMPTY_MOVE);
    }, "نُقل الموعد — ويعود للاعتماد قبل أن يصل متعلّميك");

  /* والحذفُ فعلٌ كانت الشاشةُ تأمر به ولا بابَ له — وصار له مسلكٌ محروس */
  const removeSession = (sessionId: string) =>
    act(() => apiDelete(`/api/trainer/sessions/${sessionId}`), "حُذف اللقاء");

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
                  {/* ═══ الحالةُ تُقال حين تكون غيرَ الأصل ═══
                      والمعتمَدُ بلا حبّة: شارةٌ خضراءُ على كلّ صفٍّ تجعل
                      الصفراءَ لا تُرى. والفارغُ معتمَدٌ — صفوفُ ما قبل العمود. */}
                  {s.approvalState === "pending" && (
                    <p className="mt-1 text-read leading-6 text-muted-foreground">
                      <span className="me-1.5 inline-flex items-center rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 text-fine font-black text-gold-ink">
                        بانتظار اعتماد الإدارة
                      </span>
                      غيرُ ظاهرةٍ للمتعلّمين بعد.
                    </p>
                  )}
                  {s.approvalState === "rejected" && (
                    <p className="mt-1 text-read leading-6 text-muted-foreground">
                      <span className="me-1.5 inline-flex items-center rounded-full border border-red-400/40 bg-red-400/10 px-2.5 py-0.5 text-fine font-black text-red-300">
                        رُدَّت
                      </span>
                      {s.reviewNote || "راجِع ملاحظةَ الإدارة ثمّ انقل موعدَها."}
                    </p>
                  )}
                  {/* ═══ وما وقع فعلا — كانت زووم تكتبه ولا يراه أحد ═══

                      `actualStartAt` و`durationMin` و`participantCount` تُملأ
                      من أحداث زووم منذ زمن، ويُسقطها الإسقاطُ قبل الشاشة. فكان
                      المدرّبُ يرى موعدَه **المجدوَل** ولا يعرف أنعقد أصلا ولا
                      كم دام ولا كم حضر — ثمّ يُسأل عن لقاءٍ لا خبرَ له عنه.

                      والمجدولُ نيّةٌ وهذا خبر، فلا يحلّ محلَّه: يُقال تحته. */}
                  {s.zoom?.actualStartAt && (
                    <p className="mt-1 text-read leading-6 text-muted-foreground">
                      انعقد {fmtDateTimeAr(s.zoom.actualStartAt)}
                      {s.zoom.durationMin !== null && ` · ${countAr(s.zoom.durationMin, MINUTE_FORMS)}`}
                      {s.zoom.participantCount !== null && ` · حضره ${countAr(s.zoom.participantCount, PERSON_FORMS)}`}
                    </p>
                  )}
                  {/* ═══ ومزامنةٌ سقطت تُقال لصاحبها ═══

                      كُتب في الخدمة أنّ السببَ «يُكتب في `syncError` فيُقرأ في
                      الشاشة» — ولا شاشةَ كانت تقرؤه. فيسقط جلبُ الحضور، ويبقى
                      المدرّبُ ينتظر أسماءً لا تأتي ولا يعرف أنّها لن تأتي.
                      والفعلُ الذي يزيله في يده: يسجّله بنفسه أدناه. */}
                  {s.zoom?.syncState === "failed" && (
                    <p className="mt-1 text-read leading-6 text-gold-ink">
                      تعذّرت مزامنةُ الحضور من زووم — سجّله بيدك أدناه.
                      {s.zoom.syncError ? ` (${s.zoom.syncError})` : ""}
                    </p>
                  )}
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
                    onClick={() => {
                      const open = moveFor === s.id;
                      setMoveFor(open ? null : s.id);
                      /* ويُهيَّأ بموعده الحاليّ لا فارغا: من ينقل ساعةً واحدة
                         لا يُطالَب بكتابة التاريخ كلِّه من جديد. */
                      setMoveForm(open ? EMPTY_MOVE : {
                        date: s.startsAt.slice(0, 10),
                        from: s.startsAt.slice(11, 16),
                        to: (s.endsAt ?? s.startsAt).slice(11, 16),
                      });
                    }} className="min-h-9">
                    <CalendarDays className="h-3 w-3" /> انقل الموعد
                  </Button>
                )}
                {s.status !== "done" && (
                  <Button tone="ghost" size="sm" type="button" className="min-h-9"
                    aria-label={`احذف لقاء ${s.title}`}
                    onClick={() => setPendingDelete({ id: s.id, title: s.title })}>
                    <Trash2 className="h-3 w-3" aria-hidden="true" /> احذفه
                  </Button>
                )}
              </div>

              {/* والنقلُ يقول أثرَه قبل الضغط لا بعده */}
              {moveFor === s.id && (
                <Inset tone="accent" className="mt-3 space-y-2.5">
                  <p className="text-read leading-relaxed text-foreground">
                    الموعدُ لك داخلَ أشهر فصلك. وما تنقله <b>يعود لانتظار الإدارة</b> —
                    فيغيب عن شاشات متعلّميك حتّى تعتمده، ويصلهم خبرُ التغيير.
                  </p>
                  <div className="grid gap-2.5 sm:grid-cols-3">
                    <div>
                      <label htmlFor={`mv-d-${s.id}`} className="mb-1 block text-read font-bold text-muted-foreground">التاريخ</label>
                      <input id={`mv-d-${s.id}`} type="date" dir="ltr" value={moveForm.date}
                        onChange={(e) => setMoveForm((f) => ({ ...f, date: e.target.value }))} className={`${controlCls} text-left`} />
                    </div>
                    <div>
                      <label htmlFor={`mv-f-${s.id}`} className="mb-1 block text-read font-bold text-muted-foreground">من الساعة</label>
                      <input id={`mv-f-${s.id}`} type="time" dir="ltr" value={moveForm.from}
                        onChange={(e) => setMoveForm((f) => ({ ...f, from: e.target.value }))} className={`${controlCls} text-left`} />
                    </div>
                    <div>
                      <label htmlFor={`mv-t-${s.id}`} className="mb-1 block text-read font-bold text-muted-foreground">إلى الساعة</label>
                      <input id={`mv-t-${s.id}`} type="time" dir="ltr" value={moveForm.to}
                        onChange={(e) => setMoveForm((f) => ({ ...f, to: e.target.value }))} className={`${controlCls} text-left`} />
                    </div>
                  </div>
                  <Button tone="confirm" size="sm" type="button"
                    disabled={busy || !moveForm.date || !moveForm.from || moveForm.to <= moveForm.from}
                    onClick={() => void moveSession(s.id)} className="disabled:cursor-not-allowed">
                    انقلْه
                  </Button>
                  {!!moveForm.from && moveForm.to <= moveForm.from && (
                    <p className="text-read font-bold text-gold-ink">ساعةُ الانتهاء قبل ساعة البدء.</p>
                  )}
                </Inset>
              )}
              {/* ═══ تسجيلُ اللقاء — يُقرأ ولا يُكتب ═══

                  كانت هنا خانةُ رابطٍ تقبل `https://…`. وسأل صاحبُ المنصّة
                  (١٧ سبتمبر ٢٠٢٦): «ما الرابطُ الذي تتوقّعه منه وأنت تعلم
                  أنّ التدريبَ من خلال زووم خاصٍّ فينا؟» — والخانةُ أخطرُ
                  ممّا تبدو: هي **الخانةُ الوحيدةُ في الشاشة التي تقبل
                  رابطا**، فمدرّبٌ يملك زووم خاصًّا يلصق فيها رابطَ اجتماعه
                  هو، فيصل المتعلّمين، ويخرج اللقاءُ من حسابنا إلى حسابه
                  بلا أن تعلم المنصّة. فذهبت.

                  ورفعُ الملفّ باقٍ: الاجتماعاتُ تُنشأ منذ (١٨ سبتمبر ٢٠٢٦)
                  بـ`auto_recording: 'cloud'` فيصل التسجيلُ وحدَه، لكنّ
                  التسجيلَ السحابيَّ في حسابات Zoom المدفوعة وحدَها — ومن
                  سقط عنده يبقى الرفعُ بابَه.

                  ── ويُقرأ المصدران معا ──

                  المرفوعُ رابطٌ موقَّعٌ (`readUrl`) والواصلُ من Zoom رابطٌ
                  خارجيّ (`externalUrl`). وقراءةُ الأوّلِ وحدَه — كما كان —
                  تجعل كلَّ تسجيلٍ يصل من Zoom سطرا يفتح على `#`. */}
              {openableRecordings(s.recordings).length > 0 && (
                <div className="mt-3 border-t border-white/8 pt-3">
                  <ul className="space-y-1 text-read">
                    {openableRecordings(s.recordings).map((r) => (
                      <li key={r.id}>
                        <a href={r.href} target="_blank" rel="noreferrer" className="text-teal-light-ink underline decoration-dotted underline-offset-4">{r.title}</a>
                      </li>
                    ))}
                  </ul>
                </div>
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

      {/* والحذفُ يقول أثرَه كاملا قبل وقوعه — لا «أنت متأكّد؟» */}
      {pendingDelete && (
        <ConfirmAction
          titleAr="حذفُ اللقاء"
          confirmLabelAr="احذفه"
          busy={busy}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => { const d = pendingDelete; setPendingDelete(null); void removeSession(d.id); }}
        >
          <p className="text-read leading-7">
            يُحذف «{pendingDelete.title}» من شعبتك، ويُلغى اجتماعُ Zoom معه.
            وإن كان معتمَدا وصل مسجَّليك خبرُ إلغائه.
            {" "}ولا يُحذف لقاءٌ سُجّل فيه حضورٌ أو انعقد اجتماعُه — تلك واقعةٌ لا مسوّدة.
          </p>
        </ConfirmAction>
      )}
    </Panel>
  );
}
