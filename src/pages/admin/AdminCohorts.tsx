import { useCallback, useEffect, useState } from "react";
import {
  CalendarClock, CalendarPlus, CheckCircle2, ChevronDown, Loader2, Lock, Play, RefreshCw,
  ServerOff, UserPlus, Users, Video, XCircle,
} from "lucide-react";
import AdminLayout from "./AdminLayout";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { CohortOps, LearningSettings } from "./CohortOps";
import CohortReadiness from "./CohortReadiness";
import { fmtDateTimeAr } from "@/utils/format";
import { courseById } from "@/data/courses";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: "مسودة", cls: "border-white/20 text-white/50" },
  open: { label: "مفتوحة للتسجيل", cls: "border-teal/50 text-teal-light-ink" },
  full: { label: "ممتلئة", cls: "border-gold/50 text-gold-ink" },
  active: { label: "جارية", cls: "border-teal/60 text-teal-light-ink" },
  completed: { label: "مكتملة", cls: "border-white/20 text-white/60" },
  cancelled: { label: "ملغاة", cls: "border-red-500/40 text-red-400" },
};

interface RescheduleRow {
  id: string; currentStartsAt: string; proposedStartsAt: string; reason: string; createdAt: string;
  requester: { displayName: string };
  session: { id: string; title: string; cohort: { id: string; title: string } };
}

interface CohortRow {
  id: string; title: string; status: string; courseId: string; courseTitle: string;
  startsAt: string | null; endsAt: string | null; daysOfWeek: string[]; startTime: string | null;
  timezone: string | null; capacity: number | null; enrolled: number;
  price: string | null; currency: string; language: string; deliveryMode: string;
  registrationOpen: boolean; financialReady: boolean; sessionsCount: number;
  trainers: { profileId: string; name: string; role: string }[];
}

interface CourseOption { id: string; status: string; title: string }
interface Checklist { ready: boolean; missing: string[] }

/** عمليات الشعب — API حقيقي: إنشاء، شروط الفتح الستة، جلسات، Zoom يدوي، تسجيل بسعة محروسة */
export default function AdminCohorts() {
  const [rows, setRows] = useState<CohortRow[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  /* سعرُ الدورة المختارة وعملتُها من الكتالوج نفسِه — وهو ما يرثه الخادم */
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState<string | null>(null);
  const [flash, setFlash] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<Record<string, Checklist>>({});

  /* نماذج */
  const [createForm, setCreateForm] = useState({ courseId: "", title: "", capacity: "20", price: "", days: "", startTime: "18:00" });
  /* سعرُ الدورة المختارة وعملتُها من الكتالوج — وهو ما يرثه الخادم فعلا
     (cohort.service.ts:64–65)، فالعنوانُ يقول ما سيقع لا ما نظنّه. */
  const selectedCourse = createForm.courseId ? courseById(createForm.courseId) : null;
  const selectedCurrency = selectedCourse?.listCurrency ?? "USD";
  const selectedListPrice = selectedCourse?.listPrice ?? null;
  const [sessionForm, setSessionForm] = useState({ title: "", date: "", time: "18:00", hours: "2" });
  const [zoomForm, setZoomForm] = useState<Record<string, { sessionId: string; joinUrl: string; meetingId: string; passcode: string }>>({});
  const [enrollUserId, setEnrollUserId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [reschedules, setReschedules] = useState<RescheduleRow[]>([]);
  const [rsComment, setRsComment] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true); setOffline(null);
    try {
      const [cohortRows, courseRows, rsRows] = await Promise.all([
        apiGet<CohortRow[]>("/api/admin/cohorts"),
        apiGet<CourseOption[]>("/api/admin/catalog/courses"),
        /* اقتراحات التأجيل لا تُسقط الصفحة: غيابها أهون من شعبٍ لا تُدار */
        apiGet<RescheduleRow[]>("/api/admin/session-reschedules").catch(() => [] as RescheduleRow[]),
      ]);
      setRows(cohortRows);
      setCourses(courseRows.filter((c) => c.status === "published"));
      setReschedules(rsRows);
    } catch (err) {
      setOffline(err instanceof ApiError ? err.message : "الخادم غير متصل — شغّل واجهة API أولا");
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
      if (expanded) await loadChecklist(expanded);
    } catch (err) {
      setFlash(err instanceof ApiError ? err.message : "تعذر تنفيذ الإجراء");
    } finally {
      setBusy(false);
    }
  };

  /* قرار الإدارة — والاعتماد وحده يحرّك الموعد عند المتعلّمين */
  const reviewReschedule = (id: string, action: "approve" | "reject") =>
    act(
      () => apiPost(`/api/admin/session-reschedules/${id}/review`, { action, comment: rsComment[id]?.trim() || undefined }),
      action === "approve" ? "اعتُمد الموعد الجديد — وأُخبر المتعلّمون" : "لم يُعتمد الاقتراح — ووصل المدرب تعليقك",
    );

  const loadChecklist = async (id: string) => {
    try {
      const check = await apiGet<Checklist>(`/api/admin/cohorts/${id}/open-checklist`);
      setChecklist((prev) => ({ ...prev, [id]: check }));
    } catch { /* الفحص اختياري العرض */ }
  };

  const toggle = (id: string) => {
    const next = expanded === id ? null : id;
    setExpanded(next);
    if (next) void loadChecklist(next);
  };

  const createCohort = () => act(async () => {
    await apiPost("/api/admin/cohorts", {
      courseId: createForm.courseId,
      title: createForm.title,
      capacity: createForm.capacity ? Number(createForm.capacity) : undefined,
      price: createForm.price ? Number(createForm.price) : undefined,
      daysOfWeek: createForm.days ? createForm.days.split(/[،,]/).map((d) => d.trim()).filter(Boolean) : undefined,
      startTime: createForm.startTime || undefined,
    });
    setCreateForm({ courseId: "", title: "", capacity: "20", price: "", days: "", startTime: "18:00" });
    setCreateOpen(false);
  }, "أُنشئت الشعبة كمسودة — أكمل شروط الفتح الستة");

  if (offline) {
    return (
      <AdminLayout title="عمليات الشعب">
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-20 text-center">
          <ServerOff className="h-12 w-12 text-white/20" />
          <h2 className="mt-4 text-xl font-black">لا يمكن الوصول للبيانات</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-white/55">{offline}</p>
          <button onClick={() => void load()} className="mt-5 flex cursor-pointer items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-xs font-bold text-white/70 hover:border-white/40">
            <RefreshCw className="h-3.5 w-3.5" /> إعادة المحاولة
          </button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="عمليات الشعب — الفتح المشروط والجلسات والتسجيل">
      {flash && (
        <p className="mb-5 flex items-center gap-2 rounded-2xl border border-teal/40 bg-teal/10 px-4 py-3 text-sm font-bold text-teal-light-ink">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {flash}
        </p>
      )}

      <CohortReadiness onApplied={() => void load()} />

      {/* ── اقتراحات تأجيل الجلسات ──

          المدرب يقترح والإدارة تعتمد — وهو القرار المتّفق عليه. والموعد لا
          يتبدّل عند المتعلّمين قبل الاعتماد، فما هنا ينتظر قرارا لا علما.
          وموضعه أعلى الصفحة لأنّ ما ينتظر قرارا يسبق ما يُنشأ. */}
      {reschedules.length > 0 && (
        <div className="mb-6 rounded-3xl border border-gold/30 bg-gold/[0.05] p-5">
          <h2 className="flex items-center gap-2 text-sm font-black text-gold-ink">
            <CalendarClock className="h-4 w-4" /> اقتراحات تأجيل تنتظر قرارك ({reschedules.length})
          </h2>
          <div className="mt-4 space-y-3">
            {reschedules.map((r) => (
              <div key={r.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="text-sm font-bold">{r.session.title}</p>
                <p className="mt-0.5 text-[11px] text-white/50">
                  {r.session.cohort.title} · اقترحه {r.requester.displayName}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-[11.5px]">
                  <span className="text-white/55">الموعد الآن: <span className="text-white/80">{fmtDateTimeAr(r.currentStartsAt)}</span></span>
                  <span className="text-gold-ink">المقترح: <span className="font-bold">{fmtDateTimeAr(r.proposedStartsAt)}</span></span>
                </div>
                <p className="mt-2.5 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-xs leading-6 text-white/70">{r.reason}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    aria-label={`تعليق على اقتراح ${r.session.title}`}
                    value={rsComment[r.id] ?? ""}
                    onChange={(e) => setRsComment((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    placeholder="تعليقك — يصل المدرب مع القرار"
                    className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:border-teal focus:outline-none"
                  />
                  <button type="button" disabled={busy}
                    onClick={() => void reviewReschedule(r.id, "approve")}
                    className="cursor-pointer rounded-full bg-teal px-5 py-2 text-[11px] font-black text-on-teal transition hover:bg-teal-light disabled:opacity-40">
                    اعتمد الموعد
                  </button>
                  <button type="button" disabled={busy}
                    onClick={() => void reviewReschedule(r.id, "reject")}
                    className="cursor-pointer rounded-full border border-red-400/40 px-5 py-2 text-[11px] font-bold text-red-300 transition hover:bg-red-400/10 disabled:opacity-40">
                    لا أعتمده
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-white/45">
            الاعتماد يحرّك الموعد ويُخبر المتعلّمين. والردّ لا يحرّكه، ويصل المدرب بتعليقك.
          </p>
        </div>
      )}

      {/* إنشاء شعبة */}
      <div className="mb-6 rounded-3xl border border-white/10 bg-white/[0.02] p-5">
        <button onClick={() => setCreateOpen(!createOpen)} className="flex w-full cursor-pointer items-center justify-between text-sm font-black">
          <span>شعبة جديدة</span>
          <ChevronDown className={`h-4 w-4 transition ${createOpen ? "rotate-180" : ""}`} />
        </button>
        {createOpen && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs text-white/50">
              الدورة (المنشورة فقط)
              <select value={createForm.courseId} onChange={(e) => setCreateForm({ ...createForm, courseId: e.target.value })}
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white focus:border-teal focus:outline-none">
                <option value="">اختر دورة…</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.id})</option>)}
              </select>
            </label>
            <label className="text-xs text-white/50">
              عنوان الشعبة
              <input value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                placeholder="شعبة أكتوبر 2026 — مسائية"
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-teal focus:outline-none" />
            </label>
            <label className="text-xs text-white/50">
              السعة
              <input value={createForm.capacity} onChange={(e) => setCreateForm({ ...createForm, capacity: e.target.value })} type="number" min={1}
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white focus:border-teal focus:outline-none" />
            </label>
            {/* العملةُ تُقرأ ولا تُفترض.

                كان مكتوبا «السعر (دينار أردني)»، وأسعارُ الكتالوج كلُّها
                بالدولار (٨١ دورة)، والشعبةُ ترث عملةَ دورتها
                (cohort.service.ts:65) لا الافتراضَ الأردنيّ. فمن يكتب ١٢٥
                ظانّا أنّها دنانير، تُقبض منه ١٢٥ **دولارا** — والفرقُ نحو
                الأربعين بالمئة، ولا شيءَ على الشاشة يُنبّه.

                فصار العنوان يقول عملةَ الدورة المختارة نفسِها. */}
            <label className="text-xs text-white/50">
              السعر ({selectedCurrency})
              <input value={createForm.price} onChange={(e) => setCreateForm({ ...createForm, price: e.target.value })} type="number" min={0}
                placeholder={selectedListPrice !== null ? String(selectedListPrice) : undefined}
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-teal focus:outline-none" />
              {selectedListPrice !== null && (
                <span className="mt-1 block text-[10px] text-white/35">
                  سعر قائمة الدورة {selectedListPrice} {selectedCurrency} — يُورَث إن تُرك فارغا
                </span>
              )}
            </label>
            <label className="text-xs text-white/50">
              أيام الأسبوع (افصل بفاصلة)
              <input value={createForm.days} onChange={(e) => setCreateForm({ ...createForm, days: e.target.value })}
                placeholder="الأحد، الثلاثاء"
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-teal focus:outline-none" />
            </label>
            <label className="text-xs text-white/50">
              وقت البدء
              <input value={createForm.startTime} onChange={(e) => setCreateForm({ ...createForm, startTime: e.target.value })} type="time"
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white focus:border-teal focus:outline-none" />
            </label>
            <div className="flex items-end">
              <button disabled={busy || !createForm.courseId || createForm.title.length < 3} onClick={createCohort}
                className="flex cursor-pointer items-center gap-2 rounded-full bg-teal px-6 py-2.5 text-xs font-black text-on-teal transition hover:bg-teal-light disabled:opacity-40">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} أنشئ المسودة
              </button>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-8 w-8 animate-spin text-teal-ink" /></div>
      ) : rows.length === 0 ? (
        <p className="rounded-3xl border border-white/10 bg-white/[0.02] py-16 text-center text-sm text-white/45">لا شعب بعد — أنشئ أول شعبة من الأعلى.</p>
      ) : (
        <div className="space-y-4">
          {rows.map((c) => {
            const meta = STATUS_META[c.status] ?? STATUS_META.draft;
            const check = checklist[c.id];
            const isOpen = expanded === c.id;
            return (
              <div key={c.id} className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
                <button onClick={() => toggle(c.id)} className="flex w-full cursor-pointer flex-wrap items-center gap-4 text-right">
                  <div className="min-w-0 flex-1">
                    <p className="font-black">{c.title}</p>
                    <p className="mt-0.5 text-xs text-white/50">
                      {c.courseTitle} · {c.trainers.length ? c.trainers.map((t) => t.name).join("، ") : "بلا مدرب"}
                      {" · "}{c.enrolled}/{c.capacity ?? "—"} مقعدا · {c.sessionsCount} جلسة
                      {c.price ? ` · ${c.price} ${c.currency}` : ""}
                    </p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${meta.cls}`}>{meta.label}</span>
                  <ChevronDown className={`h-4 w-4 text-white/50 transition ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {isOpen && (
                  <div className="mt-5 space-y-5 border-t border-white/8 pt-5">
                    {/* شروط الفتح الستة */}
                    <div>
                      <p className="mb-2 text-xs font-black text-white/60">شروط الفتح</p>
                      {check ? (
                        check.ready ? (
                          <p className="flex items-center gap-1.5 text-xs font-bold text-teal-light-ink"><CheckCircle2 className="h-3.5 w-3.5" /> كل الشروط مستوفاة</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {check.missing.map((m) => (
                              <span key={m} className="flex items-center gap-1.5 rounded-full border border-red-500/40 px-3 py-1 text-[10px] font-bold text-red-400">
                                <XCircle className="h-3 w-3" /> {m}
                              </span>
                            ))}
                          </div>
                        )
                      ) : <Loader2 className="h-4 w-4 animate-spin text-white/30" />}
                    </div>

                    {/* إجراءات الحالة */}
                    <div className="flex flex-wrap gap-2">
                      {c.status === "draft" && (
                        <button disabled={busy} onClick={() => act(() => apiPost(`/api/admin/cohorts/${c.id}/open`), "فُتحت الشعبة — التسجيل متاح الآن")}
                          className="flex cursor-pointer items-center gap-1.5 rounded-full bg-teal px-4 py-2 text-xs font-black text-on-teal transition hover:bg-teal-light disabled:opacity-40">
                          <Play className="h-3.5 w-3.5" /> افتح الشعبة
                        </button>
                      )}
                      {["open", "full"].includes(c.status) && (
                        <button disabled={busy} onClick={() => act(() => apiPost(`/api/admin/cohorts/${c.id}/transition`, { to: "active" }), "الشعبة جارية الآن")}
                          className="cursor-pointer rounded-full border border-teal/50 px-4 py-2 text-xs font-bold text-teal-light-ink transition hover:bg-teal/10">
                          ابدأ التقديم
                        </button>
                      )}
                      {c.status === "active" && (
                        <button disabled={busy} onClick={() => act(() => apiPost(`/api/admin/cohorts/${c.id}/transition`, { to: "completed" }), "اكتملت الشعبة")}
                          className="cursor-pointer rounded-full border border-white/20 px-4 py-2 text-xs font-bold text-white/70 transition hover:border-white/40">
                          اختتم الشعبة
                        </button>
                      )}
                      {!["completed", "cancelled"].includes(c.status) && (
                        <button disabled={busy} onClick={() => act(() => apiPost(`/api/admin/cohorts/${c.id}/transition`, { to: "cancelled", note: "إلغاء من لوحة الإدارة" }), "أُلغيت الشعبة")}
                          className="cursor-pointer rounded-full border border-red-500/40 px-4 py-2 text-xs font-bold text-red-400 transition hover:bg-red-500/10">
                          إلغاء
                        </button>
                      )}
                    </div>

                    {/* إضافة جلسة */}
                    {!["completed", "cancelled"].includes(c.status) && (
                      <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                        <p className="mb-3 flex items-center gap-1.5 text-xs font-black text-white/60"><CalendarPlus className="h-3.5 w-3.5" /> جلسة جديدة</p>
                        <div className="grid gap-2 sm:grid-cols-5">
                          <input placeholder="عنوان الجلسة" value={sessionForm.title} onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })}
                            className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/25 focus:border-teal focus:outline-none sm:col-span-2" />
                          <input type="date" value={sessionForm.date} onChange={(e) => setSessionForm({ ...sessionForm, date: e.target.value })}
                            className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs text-white focus:border-teal focus:outline-none" />
                          <input type="time" value={sessionForm.time} onChange={(e) => setSessionForm({ ...sessionForm, time: e.target.value })}
                            className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs text-white focus:border-teal focus:outline-none" />
                          <button disabled={busy || sessionForm.title.length < 2 || !sessionForm.date}
                            onClick={() => act(async () => {
                              const startsAt = new Date(`${sessionForm.date}T${sessionForm.time}:00`);
                              const endsAt = new Date(startsAt.getTime() + Number(sessionForm.hours || 2) * 3600_000);
                              await apiPost(`/api/admin/cohorts/${c.id}/sessions`, { title: sessionForm.title, startsAt, endsAt });
                              setSessionForm({ title: "", date: "", time: "18:00", hours: "2" });
                            }, "أُضيفت الجلسة — وفُحص تعارض المدربين")}
                            className="cursor-pointer rounded-xl bg-white/10 px-4 py-2 text-xs font-black text-white transition hover:bg-white/15 disabled:opacity-40">
                            أضف
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ربط Zoom يدوي لجلسة */}
                    <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                      <p className="mb-3 flex items-center gap-1.5 text-xs font-black text-white/60"><Video className="h-3.5 w-3.5" /> ربط اجتماع Zoom يدوي</p>
                      <ZoomAttach cohortId={c.id} sessionsCount={c.sessionsCount}
                        value={zoomForm[c.id] ?? { sessionId: "", joinUrl: "", meetingId: "", passcode: "" }}
                        onChange={(v) => setZoomForm((prev) => ({ ...prev, [c.id]: v }))}
                        busy={busy}
                        onSubmit={() => act(async () => {
                          const z = zoomForm[c.id];
                          await apiPost(`/api/admin/sessions/${z.sessionId}/zoom`, {
                            joinUrl: z.joinUrl, meetingId: z.meetingId || undefined, passcode: z.passcode || undefined,
                          });
                          setZoomForm((prev) => ({ ...prev, [c.id]: { sessionId: "", joinUrl: "", meetingId: "", passcode: "" } }));
                        }, "رُبط اجتماع Zoom بالجلسة")} />
                    </div>

                    {/* تسجيل متعلم */}
                    {["open", "full", "active"].includes(c.status) && c.registrationOpen && (
                      <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                        <p className="mb-3 flex items-center gap-1.5 text-xs font-black text-white/60"><UserPlus className="h-3.5 w-3.5" /> تسجيل متعلم — الفائض يتحول لقائمة انتظار آليا</p>
                        <div className="flex gap-2">
                          <input placeholder="معرف المستخدم (UUID)" dir="ltr" value={enrollUserId} onChange={(e) => setEnrollUserId(e.target.value)}
                            className="flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2 font-mono text-xs text-white placeholder:text-white/25 focus:border-teal focus:outline-none" />
                          <button disabled={busy || !enrollUserId.trim()}
                            onClick={() => act(async () => {
                              const res = await apiPost<{ status: string }>(`/api/admin/cohorts/${c.id}/enrollments`, { userId: enrollUserId.trim() });
                              setEnrollUserId("");
                              setFlash(res.status === "waitlisted" ? "الشعبة ممتلئة — أُدرج المتعلم في قائمة الانتظار" : "سُجل المتعلم بنجاح");
                            }, "")}
                            className="cursor-pointer rounded-xl bg-white/10 px-4 py-2 text-xs font-black text-white transition hover:bg-white/15 disabled:opacity-40">
                            سجّل
                          </button>
                        </div>
                      </div>
                    )}

                    {c.status === "draft" && check && !check.ready && (
                      <p className="flex items-center gap-1.5 text-[11px] text-red-300">
                        <Lock className="h-3.5 w-3.5" /> لا يمكن فتحها قبل استيفاء الشروط أعلاه
                      </p>
                    )}
                    <p className="flex items-center gap-1.5 text-[10px] text-white/50">
                      <Users className="h-3 w-3" /> المسجلون الفعليون: {c.enrolled} — السعة {c.capacity ?? "غير محددة"}
                    </p>

                    {/* عمليات متقدمة: مدرب، تعديل، مواد، تقييمات، شهادات، نشر عام */}
                    <CohortOps cohort={c} onDone={(msg) => { setFlash(msg); void load(); }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* روبرك وقواعد الإكمال */}
      <LearningSettings
        courses={courses.map((c) => ({ id: c.id, title: c.title }))}
        cohorts={rows.map((c) => ({ id: c.id, title: c.title }))}
        onDone={(msg) => setFlash(msg)}
      />
    </AdminLayout>
  );
}

/** نموذج ربط Zoom — يحتاج معرف الجلسة من قاعدة البيانات (يظهر في استجابة إضافة الجلسة أو من المدرب) */
function ZoomAttach({ cohortId, sessionsCount, value, onChange, busy, onSubmit }: {
  cohortId: string; sessionsCount: number;
  value: { sessionId: string; joinUrl: string; meetingId: string; passcode: string };
  onChange: (v: { sessionId: string; joinUrl: string; meetingId: string; passcode: string }) => void;
  busy: boolean; onSubmit: () => void;
}) {
  void cohortId;
  if (!sessionsCount) return <p className="text-[11px] text-white/50">أضف جلسة أولا ثم اربطها باجتماع.</p>;
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      <input placeholder="معرف الجلسة (UUID)" dir="ltr" value={value.sessionId} onChange={(e) => onChange({ ...value, sessionId: e.target.value })}
        className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 font-mono text-xs text-white placeholder:text-white/25 focus:border-teal focus:outline-none" />
      <input placeholder="رابط الانضمام https://…" dir="ltr" value={value.joinUrl} onChange={(e) => onChange({ ...value, joinUrl: e.target.value })}
        className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 font-mono text-xs text-white placeholder:text-white/25 focus:border-teal focus:outline-none lg:col-span-2" />
      <input placeholder="معرف الاجتماع (اختياري)" dir="ltr" value={value.meetingId} onChange={(e) => onChange({ ...value, meetingId: e.target.value })}
        className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 font-mono text-xs text-white placeholder:text-white/25 focus:border-teal focus:outline-none" />
      <div className="flex gap-2">
        <input placeholder="رمز المرور" dir="ltr" value={value.passcode} onChange={(e) => onChange({ ...value, passcode: e.target.value })}
          className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 font-mono text-xs text-white placeholder:text-white/25 focus:border-teal focus:outline-none" />
        <button disabled={busy || !value.sessionId.trim() || !/^https:\/\/.+/.test(value.joinUrl)} onClick={onSubmit}
          className="shrink-0 cursor-pointer rounded-xl bg-white/10 px-4 py-2 text-xs font-black text-white transition hover:bg-white/15 disabled:opacity-40">
          اربط
        </button>
      </div>
    </div>
  );
}
