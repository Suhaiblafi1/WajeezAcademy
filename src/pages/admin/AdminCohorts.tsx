import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarClock, CalendarPlus, CheckCircle2, ChevronDown, CopyPlus, FileText, Loader2, Lock, Play, RefreshCw, Sparkles,
  ServerOff, UserPlus, Users, Video, XCircle,
} from "lucide-react";
import AdminLayout from "./AdminLayout";
import { apiGet, apiPost, apiPut, ApiError } from "@/services/api";
import { areaCls } from "@/components/FormKit";
import { CohortOps, LearningSettings } from "./CohortOps";
import CohortReadiness from "./CohortReadiness";
import CohortWizard from "./CohortWizard";
import LearnerSearchField, { type LearnerHit } from "@/components/LearnerSearchField";
import EntityAuditTimeline from "@/components/EntityAuditTimeline";
import { daysLabelAr, fmtDateTimeAr } from "@/utils/format";
import { courseById } from "@/data/courses";
import { isLiveCohort } from "@/application/schedule/cohort-status";

import { Panel, Card } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: "مسودة", cls: "border-white/20 text-muted-foreground" },
  open: { label: "مفتوحة للتسجيل", cls: "border-teal/50 text-teal-light-ink" },
  full: { label: "ممتلئة", cls: "border-gold/50 text-gold-ink" },
  active: { label: "جارية", cls: "border-teal/60 text-teal-light-ink" },
  completed: { label: "مكتملة", cls: "border-white/20 text-muted-foreground" },
  cancelled: { label: "ملغاة", cls: "border-red-500/40 text-red-400" },
};

const filterCls = "mt-1 w-full rounded-xl border border-white/15 bg-paper/30 px-2.5 py-2 text-xs text-foreground focus:border-teal focus:outline-none [&>option]:bg-surface";

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
/** لافتةُ نتيجةٍ تعرف نجاحَها من رفضها */
type Flash = { kind: "ok" | "error"; text: string } | null
interface SessionOption { id: string; title: string; startsAt: string; hasZoom: boolean }
interface Checklist { ready: boolean; missing: string[] }

/** عمليات الشعب — API حقيقي: إنشاء، شروط الفتح الستة، جلسات، Zoom يدوي، تسجيل بسعة محروسة */
export default function AdminCohorts() {
  const [rows, setRows] = useState<CohortRow[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  /* سعرُ الدورة المختارة وعملتُها من الكتالوج نفسِه — وهو ما يرثه الخادم */
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<Record<string, Checklist>>({});
  const [planDraft, setPlanDraft] = useState<Record<string, string>>({});

  /* نماذج — والإنشاءُ صار في المعالج (CohortWizard)، وسعرُ الدورة وعملتُها
     يُمرَّران إليه من الكتالوج لأنّهما ما يرثه الخادمُ فعلا. */
  const [sessionForm, setSessionForm] = useState({ title: "", date: "", time: "18:00", hours: "2" });
  const [genForm, setGenForm] = useState({ weeks: "8", from: "", duration: "120" });
  const [dupForm, setDupForm] = useState({ title: "", shiftWeeks: "8", withSessions: true });
  const [zoomForm, setZoomForm] = useState<Record<string, { sessionId: string; joinUrl: string; meetingId: string; passcode: string }>>({});
  const [enrollLearner, setEnrollLearner] = useState<LearnerHit | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [reschedules, setReschedules] = useState<RescheduleRow[]>([]);
  /* الفلاتر الأربعة — قرارُ صاحب المنصّة: «فلاتر: المدرّب، التاريخ، المجال،
     الحالة». والقائمةُ تطول بطول الكتالوج (٨١ دورة)، فبلا فرزٍ يُقرأ الجدولُ
     بالتمرير لا بالسؤال. */
  const [filters, setFilters] = useState({ status: "", pathway: "", trainer: "", from: "", to: "" });
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

  /* رفضُ الخادم كان يُعرض في لافتةِ النجاح نفسِها — بلونٍ أخضرَ وعلامةِ صحّ،
     وفي أعلى صفحةٍ طويلةٍ لا يراها من يعمل في بطاقةٍ سفلى. فربطُ Zoom على
     جلسةٍ مربوطةٍ يُرَدّ بـ409 ولا يظهر شيء (شُوهد ٣ سبتمبر ٢٠٢٦). فصارت
     اللافتةُ تعرف الفرقَ، وتلزَق أعلى المحتوى فتُرى حيث كان الفعل. */
  const act = async (fn: () => Promise<unknown>, doneMsg: string) => {
    if (busy) return;
    setBusy(true); setFlash(null);
    try {
      await fn();
      setFlash({ kind: "ok", text: doneMsg });
      await load();
      if (expanded) await loadChecklist(expanded);
    } catch (err) {
      setFlash({ kind: "error", text: err instanceof ApiError ? err.message : "تعذر تنفيذ الإجراء" });
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

  /* خياراتُ الفلاتر من الصفوف نفسِها لا من قائمةٍ ثانية تبلى */
  const pathwayOf = (courseId: string) => courseById(courseId)?.pathwayName ?? "";
  const pathways = [...new Set(rows.map((c) => pathwayOf(c.courseId)).filter(Boolean))].sort();
  const trainerNames = [...new Set(rows.flatMap((c) => c.trainers.map((t) => t.name)))].sort();
  const statuses = [...new Set(rows.map((c) => c.status))];

  /* التاريخُ يقارَن على `startsAt`، والشعبةُ بلا بداية تُستبعد متى حُدّد مدى
     — فـ«ما بين تاريخين» لا يشمل ما لا تاريخ له. */
  const filtered = rows.filter((c) => {
    if (filters.status && c.status !== filters.status) return false;
    if (filters.pathway && pathwayOf(c.courseId) !== filters.pathway) return false;
    if (filters.trainer && !c.trainers.some((t) => t.name === filters.trainer)) return false;
    if (filters.from || filters.to) {
      if (!c.startsAt) return false;
      const day = c.startsAt.slice(0, 10);
      if (filters.from && day < filters.from) return false;
      if (filters.to && day > filters.to) return false;
    }
    return true;
  });
  const filtering = Object.values(filters).some(Boolean);

  if (offline) {
    return (
      <AdminLayout title="عمليات الشعب">
        <Panel className="grid place-items-center py-20 text-center">
          <ServerOff className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-xl font-black">لا يمكن الوصول للبيانات</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">{offline}</p>
          <Button tone="secondary" onClick={() => void load()} className="mt-5">
            <RefreshCw className="h-3.5 w-3.5" /> إعادة المحاولة
          </Button>
        </Panel>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="عمليات الشعب — الفتح المشروط والجلسات والتسجيل">
      {flash && (
        <p
          role={flash.kind === "error" ? "alert" : "status"}
          className={`sticky top-[4.5rem] z-30 mb-5 flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold backdrop-blur ${
            flash.kind === "error"
              ? "border-red-400/40 bg-red-500/15 text-red-200"
              : "border-teal/40 bg-teal/10 text-teal-light-ink"
          }`}
        >
          {flash.kind === "error"
            ? <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            : <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />}
          {flash.text}
        </p>
      )}

      <CohortReadiness onApplied={() => void load()} />

      {/* ── اقتراحات تأجيل الجلسات ──

          المدرب يقترح والإدارة تعتمد — وهو القرار المتّفق عليه. والموعد لا
          يتبدّل عند المتعلّمين قبل الاعتماد، فما هنا ينتظر قرارا لا علما.
          وموضعه أعلى الصفحة لأنّ ما ينتظر قرارا يسبق ما يُنشأ. */}
      {reschedules.length > 0 && (
        <Panel tone="warn" className="mb-6">
          <h2 className="flex items-center gap-2 text-sm font-black text-gold-ink">
            <CalendarClock className="h-4 w-4" /> اقتراحات تأجيل تنتظر قرارك ({reschedules.length})
          </h2>
          <div className="mt-4 space-y-3">
            {reschedules.map((r) => (
              <Card key={r.id} className="bg-paper/25">
                <p className="text-sm font-bold">{r.session.title}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {r.session.cohort.title} · اقترحه {r.requester.displayName}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-[11.5px]">
                  <span className="text-muted-foreground">الموعد الآن: <span className="text-foreground">{fmtDateTimeAr(r.currentStartsAt)}</span></span>
                  <span className="text-gold-ink">المقترح: <span className="font-bold">{fmtDateTimeAr(r.proposedStartsAt)}</span></span>
                </div>
                <p className="mt-2.5 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-xs leading-6 text-foreground">{r.reason}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    aria-label={`تعليق على اقتراح ${r.session.title}`}
                    value={rsComment[r.id] ?? ""}
                    onChange={(e) => setRsComment((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    placeholder="تعليقك — يصل المدرب مع القرار"
                    className="min-w-0 flex-1 rounded-xl border border-white/15 bg-paper/30 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/75 focus:border-teal focus:outline-none"
                  />
                  <Button tone="confirm" type="button" disabled={busy}
                    onClick={() => void reviewReschedule(r.id, "approve")}>
                    اعتمد الموعد
                  </Button>
                  <Button tone="danger" type="button" disabled={busy}
                    onClick={() => void reviewReschedule(r.id, "reject")}>
                    لا أعتمده
                  </Button>
                </div>
              </Card>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            الاعتماد يحرّك الموعد ويُخبر المتعلّمين. والردّ لا يحرّكه، ويصل المدرب بتعليقك.
          </p>
        </Panel>
      )}

      {/* إنشاء شعبة — معالجٌ من خمس خطوات: الدورة، الجدول (وجلساتُه تُولَّد)،
          المقاعد والسعر، المدرّب، ثمّ مراجعةٌ قبل الإنشاء. استعاض عن نموذجٍ
          واحدٍ كانت شروطُه الستّةُ تُكتشَف بعد الحفظ. */}
      <div className="mb-6">
        <button onClick={() => setCreateOpen(!createOpen)}
          className="mb-3 flex w-full cursor-pointer items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-3.5 text-sm font-black">
          <span>شعبة جديدة</span>
          <ChevronDown className={`h-4 w-4 transition ${createOpen ? "rotate-180" : ""}`} />
        </button>
        {createOpen && (
          <CohortWizard
            courses={courses.map((c) => {
              const meta = courseById(c.id);
              return { id: c.id, title: c.title, currency: meta?.listCurrency ?? "USD", listPrice: meta?.listPrice ?? null };
            })}
            onDone={(msg) => { setFlash({ kind: "ok", text: msg }); setCreateOpen(false); void load(); }}
            onError={(msg) => setFlash({ kind: "error", text: msg })}
          />
        )}
      </div>

      {!loading && rows.length > 0 && (
        <Panel className="mb-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <label className="text-[11px] text-muted-foreground">
              الحالة
              <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className={filterCls}>
                <option value="">كلّ الحالات</option>
                {statuses.map((st) => <option key={st} value={st}>{(STATUS_META[st] ?? STATUS_META.draft).label}</option>)}
              </select>
            </label>
            <label className="text-[11px] text-muted-foreground">
              المجال
              <select value={filters.pathway} onChange={(e) => setFilters({ ...filters, pathway: e.target.value })} className={filterCls}>
                <option value="">كلّ المجالات</option>
                {pathways.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="text-[11px] text-muted-foreground">
              المدرّب
              <select value={filters.trainer} onChange={(e) => setFilters({ ...filters, trainer: e.target.value })} className={filterCls}>
                <option value="">كلّ المدرّبين</option>
                {trainerNames.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="text-[11px] text-muted-foreground">
              تبدأ بعد
              <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className={filterCls} />
            </label>
            <label className="text-[11px] text-muted-foreground">
              تبدأ قبل
              <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className={filterCls} />
            </label>
          </div>
          {filtering && (
            <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span>{filtered.length} من {rows.length} شعبة</span>
              <Button tone="secondary" size="sm" onClick={() => setFilters({ status: "", pathway: "", trainer: "", from: "", to: "" })}>
                امسح الفلاتر
              </Button>
            </div>
          )}
        </Panel>
      )}

      {loading ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-8 w-8 animate-spin text-teal-ink" /></div>
      ) : rows.length === 0 ? (
        <p className="rounded-3xl border border-white/10 bg-white/[0.02] py-16 text-center text-sm text-muted-foreground">لا شعب بعد — أنشئ أول شعبة من الأعلى.</p>
      ) : filtered.length === 0 ? (
        /* «لا نتائج» غيرُ «لا شعب»: الأولى تُمسح فلاترُها، والثانية تُنشأ شعبةً */
        <p className="rounded-3xl border border-white/10 bg-white/[0.02] py-16 text-center text-sm text-muted-foreground">
          لا شعبة تطابق الفلاتر — وسّع المدى أو امسحها.
        </p>
      ) : (
        <div className="space-y-4">
          {filtered.map((c) => {
            const meta = STATUS_META[c.status] ?? STATUS_META.draft;
            const check = checklist[c.id];
            const isOpen = expanded === c.id;
            return (
              <Panel key={c.id}>
                <button onClick={() => toggle(c.id)} className="flex w-full cursor-pointer flex-wrap items-center gap-4 text-right">
                  <div className="min-w-0 flex-1">
                    <p className="font-black">{c.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {c.courseTitle} · {c.trainers.length ? c.trainers.map((t) => t.name).join("، ") : "بلا مدرب"}
                      {" · "}{c.enrolled}/{c.capacity ?? "—"} مقعدا · {c.sessionsCount} جلسة
                      {c.price ? ` · ${c.price} ${c.currency}` : ""}
                    </p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${meta.cls}`}>{meta.label}</span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {isOpen && (
                  <div className="mt-5 space-y-5 border-t border-white/8 pt-5">
                    {/* شروط الفتح الستة */}
                    <div>
                      <p className="mb-2 text-xs font-black text-muted-foreground">شروط الفتح</p>
                      {check ? (
                        check.ready ? (
                          <p className="flex items-center gap-1.5 text-xs font-bold text-teal-light-ink"><CheckCircle2 className="h-3.5 w-3.5" /> كل الشروط مستوفاة</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {check.missing.map((m) => (
                              <span key={m} className="flex items-center gap-1.5 rounded-full border border-red-500/40 px-3 py-1 text-micro font-bold text-red-400">
                                <XCircle className="h-3 w-3" /> {m}
                              </span>
                            ))}
                          </div>
                        )
                      ) : <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/50" />}
                    </div>

                    {/* ── خطّةُ التقديم — الشرطُ الذي لم يكن يُوفَّى من المنصّة ──

                        صفوفُ خطط الشعبة كانت تُكتب في موضعٍ واحدٍ فقط: نشرُ
                        اقتراحِ تعديلٍ من مدرّبٍ بنطاق شعبة. فالشرطُ قائمٌ ولا
                        بابَ إليه، وكلُّ شعبةٍ يدويّةٍ عالقةٌ في المسوّدة أبدا.
                        وتُعرض هنا لا في شاشةٍ أخرى: مكانُ الشرط مكانُ إيفائه. */}
                    {check && !check.ready && check.missing.some((m) => m.startsWith("لا خطة تقديم")) && (
                      <Card tone="warn">
                        <p className="text-xs font-black text-gold-ink">اكتب خطّةَ التقديم</p>
                        <p className="mt-1 text-[11px] leading-6 text-muted-foreground">
                          كيف تُقدَّم هذه الشعبة فعلا: الأيّامُ والوقتُ وطريقةُ التقديم وما يلزم المتعلّمَ إحضارُه.
                          تُقرأ ولا تُصدَّق تلقائيّا — فاكتب ما يقع، لا ما يُشتهى.
                        </p>
                        <textarea
                          value={planDraft[c.id] ?? ""}
                          onChange={(e) => setPlanDraft((d) => ({ ...d, [c.id]: e.target.value }))}
                          rows={3}
                          placeholder="مثال: تقديمٌ عن بُعد عبر Zoom، الثلاثاء والخميس ٦ مساءً بتوقيت عمّان، ثماني جلسات، مع تمرينٍ تطبيقيٍّ بعد كلّ جلسة يُراجَع في التي تليها."
                          aria-label="خطة تقديم الشعبة"
                          className={`${areaCls} mt-2.5`}
                        />
                        <Button tone="primary" type="button"
                          disabled={busy || (planDraft[c.id] ?? "").trim().length < 20}
                          onClick={() => act(async () => {
                            await apiPut(`/api/admin/cohorts/${c.id}/delivery-plan`, { notesAr: (planDraft[c.id] ?? "").trim() });
                            setPlanDraft((d) => ({ ...d, [c.id]: "" }));
                            await loadChecklist(c.id);
                          }, "حُفظت خطّةُ التقديم")} className="mt-2.5">
                          <FileText className="h-3.5 w-3.5" /> احفظ الخطّة
                        </Button>
                        {(planDraft[c.id] ?? "").trim().length > 0 && (planDraft[c.id] ?? "").trim().length < 20 && (
                          <p className="mt-1.5 text-micro text-muted-foreground">٢٠ حرفا فأكثر — خطّةٌ أقصرُ لا تُقرأ.</p>
                        )}
                      </Card>
                    )}

                    {/* إجراءات الحالة */}
                    <div className="flex flex-wrap gap-2">
                      {c.status === "draft" && (
                        <Button tone="confirm" disabled={busy} onClick={() => act(() => apiPost(`/api/admin/cohorts/${c.id}/open`), "فُتحت الشعبة — التسجيل متاح الآن")}>
                          <Play className="h-3.5 w-3.5" /> افتح الشعبة
                        </Button>
                      )}
                      {["open", "full"].includes(c.status) && (
                        <Button tone="confirm" disabled={busy} onClick={() => act(() => apiPost(`/api/admin/cohorts/${c.id}/transition`, { to: "active" }), "الشعبة جارية الآن")} className="text-teal-light-ink">
                          ابدأ التقديم
                        </Button>
                      )}
                      {c.status === "active" && (
                        <Button tone="secondary" disabled={busy} onClick={() => act(() => apiPost(`/api/admin/cohorts/${c.id}/transition`, { to: "completed" }), "اكتملت الشعبة")}>
                          اختتم الشعبة
                        </Button>
                      )}
                      {!["completed", "cancelled"].includes(c.status) && (
                        <Button tone="danger" disabled={busy} onClick={() => act(() => apiPost(`/api/admin/cohorts/${c.id}/transition`, { to: "cancelled", note: "إلغاء من لوحة الإدارة" }), "أُلغيت الشعبة")}>
                          إلغاء
                        </Button>
                      )}
                    </div>

                    {/* إضافة جلسة */}
                    {!["completed", "cancelled"].includes(c.status) && (
                      <Card className="bg-paper/20">
                        <p className="mb-3 flex items-center gap-1.5 text-xs font-black text-muted-foreground"><CalendarPlus className="h-3.5 w-3.5" /> جلسة جديدة</p>
                        <div className="grid gap-2 sm:grid-cols-5">
                          <input placeholder="عنوان الجلسة" value={sessionForm.title} onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })}
                            className="rounded-xl border border-white/15 bg-paper/30 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/75 focus:border-teal focus:outline-none sm:col-span-2" />
                          <input type="date" value={sessionForm.date} onChange={(e) => setSessionForm({ ...sessionForm, date: e.target.value })}
                            className="rounded-xl border border-white/15 bg-paper/30 px-3 py-2 text-xs text-foreground focus:border-teal focus:outline-none" />
                          <input type="time" value={sessionForm.time} onChange={(e) => setSessionForm({ ...sessionForm, time: e.target.value })}
                            className="rounded-xl border border-white/15 bg-paper/30 px-3 py-2 text-xs text-foreground focus:border-teal focus:outline-none" />
                          <button disabled={busy || sessionForm.title.length < 2 || !sessionForm.date}
                            onClick={() => act(async () => {
                              const startsAt = new Date(`${sessionForm.date}T${sessionForm.time}:00`);
                              const endsAt = new Date(startsAt.getTime() + Number(sessionForm.hours || 2) * 3600_000);
                              await apiPost(`/api/admin/cohorts/${c.id}/sessions`, { title: sessionForm.title, startsAt, endsAt });
                              setSessionForm({ title: "", date: "", time: "18:00", hours: "2" });
                            }, "أُضيفت الجلسة — وفُحص تعارض المدربين")}
                            className="cursor-pointer rounded-xl bg-white/10 px-4 py-2 text-xs font-black text-foreground transition hover:bg-white/15 disabled:opacity-40">
                            أضف
                          </button>
                        </div>
                      </Card>
                    )}

                    {/* توليدُ الجلسات من جدول الشعبة، وتكرارُ الشعبة لفصلٍ قادم.

                        الأوّلُ يُغني عن إضافةِ ستّةَ عشرَ صفًّا بيدٍ واحدة،
                        والثاني يُغني عن إعادةِ الإعداد كلِّه في كلّ فصل. */}
                    {!["completed", "cancelled"].includes(c.status) && (
                      <Card className="bg-paper/20">
                        <p className="mb-3 flex items-center gap-1.5 text-xs font-black text-muted-foreground">
                          <Sparkles className="h-3.5 w-3.5" /> توليدُ الجلسات من الجدول
                        </p>
                        {c.daysOfWeek.length === 0 || !c.startTime ? (
                          <p className="text-[11px] text-muted-foreground">
                            لا جدولَ أسبوعيًّا لهذه الشعبة — اضبط أيّامَها ووقتَها من «تعديل الشعبة» ثمّ ولّد جلساتها.
                          </p>
                        ) : (
                          <div className="grid gap-2 sm:grid-cols-4">
                            <label className="text-[11px] text-muted-foreground">
                              أسابيع
                              <input type="number" min={1} max={52} value={genForm.weeks}
                                onChange={(e) => setGenForm({ ...genForm, weeks: e.target.value })}
                                className="mt-1 w-full rounded-xl border border-white/15 bg-paper/30 px-3 py-2 text-xs text-foreground focus:border-teal focus:outline-none" />
                            </label>
                            <label className="text-[11px] text-muted-foreground">
                              من تاريخ
                              <input type="date" value={genForm.from}
                                onChange={(e) => setGenForm({ ...genForm, from: e.target.value })}
                                className="mt-1 w-full rounded-xl border border-white/15 bg-paper/30 px-3 py-2 text-xs text-foreground focus:border-teal focus:outline-none" />
                            </label>
                            <label className="text-[11px] text-muted-foreground">
                              مدّة (دقيقة)
                              <input type="number" min={15} step={15} value={genForm.duration}
                                onChange={(e) => setGenForm({ ...genForm, duration: e.target.value })}
                                className="mt-1 w-full rounded-xl border border-white/15 bg-paper/30 px-3 py-2 text-xs text-foreground focus:border-teal focus:outline-none" />
                            </label>
                            <div className="flex items-end gap-2">
                              <button disabled={busy || Number(genForm.duration) < 15 || Number(genForm.weeks) < 1}
                                onClick={() => act(async () => {
                                  const r = await apiPost<{ created: number; skipped: number }>(`/api/admin/cohorts/${c.id}/sessions/generate`, {
                                    weeks: Number(genForm.weeks),
                                    from: genForm.from ? new Date(`${genForm.from}T00:00:00.000Z`).toISOString() : undefined,
                                    durationMinutes: Number(genForm.duration),
                                    apply: true,
                                  });
                                  setFlash({ kind: "ok", text: `وُلِّدت ${r.created} جلسة${r.skipped ? ` · وتُخطّيت ${r.skipped} موجودةً أصلا` : ""}` });
                                }, "")}
                                className="flex-1 cursor-pointer rounded-xl bg-teal px-4 py-2 text-xs font-black text-on-teal transition hover:bg-teal-light disabled:opacity-40">
                                ولّد
                              </button>
                            </div>
                            <p className="text-micro leading-5 text-muted-foreground sm:col-span-4">
                              الجدول: {daysLabelAr(c.daysOfWeek)} · {c.startTime}. الموجودُ لا يُكرَّر، وبدايةُ الشعبة ونهايتُها تتبعان جلساتِها.
                            </p>
                          </div>
                        )}
                      </Card>
                    )}

                    <Card className="bg-paper/20">
                      <p className="mb-3 flex items-center gap-1.5 text-xs font-black text-muted-foreground">
                        <CopyPlus className="h-3.5 w-3.5" /> تكرارُ الشعبة لفصلٍ قادم
                      </p>
                      <div className="grid gap-2 sm:grid-cols-4">
                        <label className="text-[11px] text-muted-foreground sm:col-span-2">
                          عنوانُ النسخة
                          <input value={dupForm.title} onChange={(e) => setDupForm({ ...dupForm, title: e.target.value })}
                            placeholder={`${c.title} — نسخة`}
                            className="mt-1 w-full rounded-xl border border-white/15 bg-paper/30 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/75 focus:border-teal focus:outline-none" />
                        </label>
                        <label className="text-[11px] text-muted-foreground">
                          إزاحةُ الأسابيع
                          <input type="number" min={0} max={104} value={dupForm.shiftWeeks}
                            onChange={(e) => setDupForm({ ...dupForm, shiftWeeks: e.target.value })}
                            className="mt-1 w-full rounded-xl border border-white/15 bg-paper/30 px-3 py-2 text-xs text-foreground focus:border-teal focus:outline-none" />
                        </label>
                        <div className="flex items-end">
                          <button disabled={busy}
                            onClick={() => act(async () => {
                              await apiPost(`/api/admin/cohorts/${c.id}/duplicate`, {
                                title: dupForm.title.trim() || undefined,
                                shiftWeeks: Number(dupForm.shiftWeeks) || 0,
                                withSessions: dupForm.withSessions,
                                withMaterials: true,
                                withAssessments: true,
                              });
                              setDupForm({ title: "", shiftWeeks: "8", withSessions: true });
                            }, "أُنشئت نسخةٌ مسودّةً — بجدولها وموادّها وتكاليفها، بلا تسجيلاتٍ ولا حضور")}
                            className="w-full cursor-pointer rounded-xl bg-white/10 px-4 py-2 text-xs font-black text-foreground transition hover:bg-white/15 disabled:opacity-40">
                            كرّرها
                          </button>
                        </div>
                        <label className="flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground sm:col-span-4">
                          <input type="checkbox" checked={dupForm.withSessions}
                            onChange={(e) => setDupForm({ ...dupForm, withSessions: e.target.checked })}
                            className="h-3.5 w-3.5 cursor-pointer accent-teal" />
                          انسخ الجلساتَ أيضا بإزاحة الأسابيع (وإلّا فولّدها في النسخة بجدولها)
                        </label>
                      </div>
                    </Card>

                    {/* ربط Zoom يدوي لجلسة */}
                    <Card className="bg-paper/20">
                      <p className="mb-3 flex items-center gap-1.5 text-xs font-black text-muted-foreground"><Video className="h-3.5 w-3.5" /> ربط اجتماع Zoom يدوي</p>
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
                    </Card>

                    {/* تسجيل متعلم */}
                    {isLiveCohort(c.status) && c.registrationOpen && (
                      <Card className="bg-paper/20">
                        <p className="mb-3 flex items-center gap-1.5 text-xs font-black text-muted-foreground"><UserPlus className="h-3.5 w-3.5" /> تسجيل متعلم — الفائض يتحول لقائمة انتظار آليا</p>
                        <div className="flex gap-2">
                          <LearnerSearchField cohortId={c.id} value={enrollLearner} onChange={setEnrollLearner} disabled={busy} />
                          <button disabled={busy || !enrollLearner}
                            onClick={() => act(async () => {
                              const res = await apiPost<{ status: string }>(`/api/admin/cohorts/${c.id}/enrollments`, { userId: enrollLearner!.id });
                              const name = enrollLearner!.displayName;
                              setEnrollLearner(null);
                              setFlash({ kind: "ok", text: res.status === "waitlisted" ? `الشعبة ممتلئة — أُدرج ${name} في قائمة الانتظار` : `سُجل ${name} بنجاح` });
                            }, "")}
                            className="shrink-0 cursor-pointer rounded-xl bg-white/10 px-4 py-2 text-xs font-black text-foreground transition hover:bg-white/15 disabled:opacity-40">
                            سجّل
                          </button>
                        </div>
                      </Card>
                    )}

                    {c.status === "draft" && check && !check.ready && (
                      <p className="flex items-center gap-1.5 text-[11px] text-red-300">
                        <Lock className="h-3.5 w-3.5" /> لا يمكن فتحها قبل استيفاء الشروط أعلاه
                      </p>
                    )}
                    <p className="flex items-center gap-1.5 text-micro text-muted-foreground">
                      <Users className="h-3 w-3" /> المسجلون الفعليون: {c.enrolled} — السعة {c.capacity ?? "غير محددة"}
                    </p>

                    {/* عمليات متقدمة: مدرب، تعديل، مواد، تقييمات، شهادات، نشر عام */}
                    <CohortOps cohort={c} onDone={(msg) => { setFlash({ kind: "ok", text: msg }); void load(); }} />

                    {/* «من غيّر هذه الشعبة؟» — يُسأل هنا، فيُقرأ هنا. وكان
                        الجوابُ يقتضي فتحَ «سجلّ الأثر» ومعرفةَ معرّفِ الشعبة. */}
                    <EntityAuditTimeline entityType="cohort" entityId={c.id} labelAr="أثرُ هذه الشعبة" />
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      )}

      {/* روبرك وقواعد الإكمال */}
      <LearningSettings
        courses={courses.map((c) => ({ id: c.id, title: c.title }))}
        cohorts={rows.map((c) => ({ id: c.id, title: c.title }))}
        onDone={(msg) => setFlash({ kind: "ok", text: msg })}
      />
    </AdminLayout>
  );
}

/* نموذجُ ربط Zoom — الجلسةُ تُختار بعنوانها وتاريخها.

   كان الحقلُ الأوّلُ «معرف الجلسة (UUID)»: قيمةٌ لا تظهر على أيّ شاشةٍ في
   المنصّة، فلا سبيلَ لتعبئتها إلّا من قاعدة البيانات. وجلساتُ الشعبة معروفةٌ
   للخادم، فتُقرأ وتُعرض. ومن رُبطت جلستُه يظهر معلَّما كي لا يُربط مرّتين. */
function ZoomAttach({ cohortId, sessionsCount, value, onChange, busy, onSubmit }: {
  cohortId: string; sessionsCount: number;
  value: { sessionId: string; joinUrl: string; meetingId: string; passcode: string };
  onChange: (v: { sessionId: string; joinUrl: string; meetingId: string; passcode: string }) => void;
  busy: boolean; onSubmit: () => void;
}) {
  const [sessions, setSessions] = useState<SessionOption[] | null>(null);
  useEffect(() => {
    if (!sessionsCount) return;
    let alive = true;
    apiGet<SessionOption[]>(`/api/admin/cohorts/${cohortId}/sessions`)
      .then((r) => { if (alive) setSessions(r) })
      .catch(() => { if (alive) setSessions([]) });
    return () => { alive = false };
  }, [cohortId, sessionsCount]);

  if (!sessionsCount) return <p className="text-[11px] text-muted-foreground">أضف جلسة أولا ثم اربطها باجتماع.</p>;
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      <div>
        <label className="sr-only" htmlFor={`zoom-session-${cohortId}`}>الجلسة</label>
        <select
          id={`zoom-session-${cohortId}`}
          value={value.sessionId}
          disabled={sessions === null}
          onChange={(e) => onChange({ ...value, sessionId: e.target.value })}
          className="w-full rounded-xl border border-white/15 bg-paper/30 px-3 py-2 text-xs text-foreground focus:border-teal focus:outline-none disabled:opacity-50"
        >
          <option value="">{sessions === null ? "تُحمَّل الجلسات…" : "اختر الجلسة"}</option>
          {sessions?.map((sn) => (
            <option key={sn.id} value={sn.id}>
              {sn.title} — {fmtDateTimeAr(sn.startsAt)}{sn.hasZoom ? " (مربوطة)" : ""}
            </option>
          ))}
        </select>
      </div>
      <input placeholder="رابط الانضمام https://…" dir="ltr" value={value.joinUrl} onChange={(e) => onChange({ ...value, joinUrl: e.target.value })}
        className="rounded-xl border border-white/15 bg-paper/30 px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/75 focus:border-teal focus:outline-none lg:col-span-2" />
      <input placeholder="معرف الاجتماع (اختياري)" dir="ltr" value={value.meetingId} onChange={(e) => onChange({ ...value, meetingId: e.target.value })}
        className="rounded-xl border border-white/15 bg-paper/30 px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/75 focus:border-teal focus:outline-none" />
      <div className="flex gap-2">
        <input placeholder="رمز المرور" dir="ltr" value={value.passcode} onChange={(e) => onChange({ ...value, passcode: e.target.value })}
          className="w-full rounded-xl border border-white/15 bg-paper/30 px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/75 focus:border-teal focus:outline-none" />
        <button disabled={busy || !value.sessionId || !/^https:\/\/.+/.test(value.joinUrl)} onClick={onSubmit}
          className="shrink-0 cursor-pointer rounded-xl bg-white/10 px-4 py-2 text-xs font-black text-foreground transition hover:bg-white/15 disabled:opacity-40">
          اربط
        </button>
      </div>
    </div>
  );
}
