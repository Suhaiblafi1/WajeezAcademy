import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarClock, CalendarPlus, CheckCircle2, ChevronDown, CopyPlus, Loader2, Lock, Play, RefreshCw, Sparkles,
  ServerOff, UserPlus, Users, Video, XCircle,
} from "lucide-react";
import AdminLayout from "./AdminLayout";
import { apiGet, apiPost, apiPut, ApiError } from "@/services/api";
import { staffControlCls, staffSelectCls } from "@/components/FormKit";
import { CohortOps, LearningSettings } from "./CohortOps";
import { COHORT_TABS, type CohortTab } from "./cohort-tabs";
import { awaitsOpening, COHORT_LISTS, inCohortList, type CohortList } from "./cohort-lists";
import { tabForGap } from "@/application/learning/open-gaps";
import CohortReadiness from "./CohortReadiness";
import CourseDemand from "./CourseDemand";
import CohortWizard, { type WizardTerm } from "./CohortWizard";
import LearnerSearchField, { type LearnerHit } from "@/components/LearnerSearchField";
import EntityAuditTimeline from "@/components/EntityAuditTimeline";
import { daysLabelAr, fmtDateTimeAr } from "@/utils/format";
import { isLiveCohort } from "@/application/schedule/cohort-status";

import { Card, Inset, Panel } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import ListToolbar from "@/components/admin/ListToolbar";
import { paginate } from "@/application/admin/paginate";
import { matchesQuery } from "@/application/text/search-ar";
import TabBar from "@/components/ui/TabBar";
import { movedLabelAr as movedLabel } from "@/application/trainer/cohort-move";
import { cohortDayAr as movedDayAr } from "@/application/learning/cohort-gate";
/** وسمُ الشعبة المنقولة — بيومها بتوقيت الأكاديميّة */
const movedLabelAr = (m: { toYear: number; toSeason: string; firstAt: string | null }) => movedLabel(m, movedDayAr);
const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: "مسودة", cls: "border-white/20 text-muted-foreground" },
  open: { label: "مفتوحة للتسجيل", cls: "border-teal/50 text-teal-light-ink" },
  full: { label: "ممتلئة", cls: "border-gold/50 text-gold-ink" },
  active: { label: "جارية", cls: "border-teal/60 text-teal-light-ink" },
  completed: { label: "مكتملة", cls: "border-white/20 text-muted-foreground" },
  cancelled: { label: "ملغاة", cls: "border-red-500/40 text-red-400" },
};

const filterCls = `mt-1 ${staffSelectCls}`;

interface RescheduleRow {
  id: string; currentStartsAt: string; proposedStartsAt: string; reason: string; createdAt: string;
  requester: { displayName: string };
  session: { id: string; title: string; cohort: { id: string; title: string } };
}

/* طلبُ نقل شعبةٍ إلى فصلٍ آخر — من المدرّب، ولا يقع إلّا باعتمادك (١٧ أكتوبر ٢٠٢٦) */
interface MoveRow {
  id: string; cohortId: string; cohortTitle: string; learners: number; requester: string; reason: string;
  fromAr: string | null; toAr: string; fromStartsAt: string | null; newStartsAt: string | null;
}

interface CohortRow {
  id: string; title: string; status: string; courseId: string; courseTitle: string;
  startsAt: string | null; endsAt: string | null; daysOfWeek: string[]; startTime: string | null;
  timezone: string | null; capacity: number | null; enrolled: number;
  price: string | null; currency: string; language: string; deliveryMode: string;
  registrationOpen: boolean; financialReady: boolean; sessionsCount: number;
  /* نافذةُ جدولةِ المدرّب — الثلاثةُ تُقرأ معا، وغيابُ أيٍّ منها بابٌ مغلَق */
  scheduleWindowStart: string | null; scheduleWindowEnd: string | null;
  trainers: { profileId: string; name: string; role: string }[];
  /** اعتُمدت لمدرّبها خطّة — شرطُ عرضِها في الموقع وبيعِها (١٢ أكتوبر ٢٠٢٦) */
  trainerPlanApproved: boolean;
  /** نُقلت إلى فصلٍ آخر — آخرُ نقلٍ معتمَد، وأوّلُ لقاءٍ فيها الآن (١٧ أكتوبر ٢٠٢٦) */
  moved?: { toYear: number; toSeason: string; firstAt: string | null } | null;
}

interface CourseOption {
  id: string; status: string; title: string;
  listPrice: number | null; listCurrency: string; pathwayNames: string[];
}
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
  const deepLinked = useRef(false);
  /* ــ أربعةُ ألسنةٍ بدل سبعِ طيّاتٍ متداخلة ــ

     كانت البطاقةُ طيًّا داخلَ طيّ: الصفحةُ قائمةُ شُعَب، والشعبةُ بطاقةٌ
     تُطوى، وفيها سبعُ بطاقاتٍ تُطوى. فبلوغُ «أرشفةِ مادّة» ثلاثُ نقراتٍ في
     ثلاثة مستويات، ولا شيءَ يقول إنّ المستوى الثالث موجود.

     ووصفه صاحبُ المنصّة: «معقّدة… فيها أمورٌ كثيرةٌ لا داعي لها».

     والفرزُ بالعمل لا بالجدول: كلُّ لسانٍ **شغلٌ واحدٌ يعمله شخصٌ واحدٌ في
     وقتٍ واحد**. ولذلك انفصلت «تعديلُ الشعبة» التي كانت تجمع العنوانَ
     والجدولَ والسعرَ وبوّابتَي الفتح في نموذجٍ واحد — وهي ثلاثةُ أعمالٍ لا
     تُعمل معا ولا يعملها الشخصُ نفسُه. */
  const [tab, setTab] = useState<CohortTab>("identity");
  /* «معتمدة — تنتظر فتحك» لسانٌ في رأس القائمة (١٢ أكتوبر ٢٠٢٦، `cohort-lists.ts`) */
  const [list, setList] = useState<CohortList>("all");
  const [checklist, setChecklist] = useState<Record<string, Checklist>>({});
  /* وما ردّ به الفتحُ — بجانب زرّه لا أعلى الصفحة وحدَه (٣ أكتوبر ٢٠٢٦) */
  const [openError, setOpenError] = useState<Record<string, string>>({});

  /* نماذج — والإنشاءُ صار في المعالج (CohortWizard)، وسعرُ الدورة وعملتُها
     يُمرَّران إليه من الكتالوج لأنّهما ما يرثه الخادمُ فعلا. */
  const [sessionForm, setSessionForm] = useState({ title: "", date: "", time: "18:00", hours: "2", withZoom: true });
  /* آخرُ لقاءٍ أُنشئ — ليُقال عددُ من بُلِّغ فعلا لا «تمّ» */
  const [lastSession, setLastSession] = useState<{ notified: number; zoom: { joinUrl: string } | null } | null>(null);
  const [genForm, setGenForm] = useState({ weeks: "8", from: "", duration: "120" });
  const [dupForm, setDupForm] = useState({ title: "", shiftWeeks: "8", withSessions: true });
  const [zoomForm, setZoomForm] = useState<Record<string, { sessionId: string; joinUrl: string; meetingId: string; passcode: string }>>({});
  const [enrollLearner, setEnrollLearner] = useState<LearnerHit | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [reschedules, setReschedules] = useState<RescheduleRow[]>([]);
  const [moves, setMoves] = useState<MoveRow[]>([]);
  /* الفلاتر الأربعة — قرارُ صاحب المنصّة: «فلاتر: المدرّب، التاريخ، المجال،
     الحالة». والقائمةُ تطول بطول الكتالوج (٨١ دورة)، فبلا فرزٍ يُقرأ الجدولُ
     بالتمرير لا بالسؤال. */
  const [filters, setFilters] = useState({ status: "", pathway: "", trainer: "", from: "", to: "" });
  /* الفلاترُ الأربعةُ تُضيّق، والبحثُ يجد. وهما شيئان: من يعرف اسمَ الشعبة
     يكتبه، ومن يريد «شعبَ فلانٍ في نوفمبر» يفرز. وكان الأوّلُ غائبا،
     فالوصولُ إلى شعبةٍ بعينها تمريرٌ في قائمةٍ بطول الكتالوج. */
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [rsComment, setRsComment] = useState<Record<string, string>>({});
  const [terms, setTerms] = useState<WizardTerm[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setOffline(null);
    try {
      const [cohortRows, courseRows, rsRows, termRows, moveRows] = await Promise.all([
        apiGet<CohortRow[]>("/api/admin/cohorts"),
        apiGet<CourseOption[]>("/api/admin/catalog/courses"),
        /* اقتراحات التأجيل لا تُسقط الصفحة: غيابها أهون من شعبٍ لا تُدار */
        apiGet<RescheduleRow[]>("/api/admin/session-reschedules").catch(() => [] as RescheduleRow[]),
        /* والمواسمُ كذلك: الشعبةُ تُولَد بفصلها منذ ١٧ سبتمبر ٢٠٢٦ */
        apiGet<WizardTerm[]>("/api/admin/terms?all=true").catch(() => [] as WizardTerm[]),
        apiGet<MoveRow[]>("/api/admin/cohort-moves").catch(() => [] as MoveRow[]),
      ]);
      setRows(cohortRows);
      /* ═══ رابطٌ إلى شعبةٍ بعينها: `?cohort=<id>` (٢ أكتوبر ٢٠٢٦) ═══
         من شاشة العقود: «افتح خطّتَها» لشعبة إعداد مدرّبٍ في طور الموادّ. فتُفتح
         الشعبةُ على لسان محتواها — حيث تُعتمَد خطّتُها — وتُصفّى القائمةُ باسمها
         فلا تضيع في صفحةٍ أخرى. مرّةً واحدة: ما يفعله بعدها بيده. */
      const linked = new URLSearchParams(window.location.search).get("cohort");
      const row = linked && !deepLinked.current ? cohortRows.find((c) => c.id === linked) : undefined;
      if (row) {
        deepLinked.current = true;
        setQ(row.title);
        setExpanded(row.id);
        setTab("content");
        /* ═══ وشروطُ فتحها معها (٣ أكتوبر ٢٠٢٦) ═══
           كان الرابطُ يبسط البطاقةَ ولا يجلب شروطَها — فبقيت «شروط الفتح» دوّامةً
           لا تقف، و«افتح الشعبة» يُنقر فيردّ «لا سعة محددة» أعلى الصفحة. وكلُّ من
           جاء من «خططٌ تنتظر اعتمادك» أو من العقود جاء من هذا الرابط. */
        apiGet<Checklist>(`/api/admin/cohorts/${row.id}/open-checklist`)
          .then((check) => setChecklist((prev) => ({ ...prev, [row.id]: check })))
          .catch(() => undefined);
      }
      setCourses(courseRows.filter((c) => c.status === "published"));
      setReschedules(rsRows);
      setMoves(moveRows);
      setTerms(termRows);
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
      action === "approve" ? "اعتمد الموعد الجديد — وأخبر المتعلّمون" : "لم يعتمد الاقتراح — ووصل المدرب تعليقك",
    );

  /* ونقلُ الشعبة كلّها — الاعتمادُ يحرّك مواعيدَها ويبلّغ المتعلّمين */
  const reviewMove = (id: string, action: "approve" | "reject") =>
    act(
      () => apiPost(`/api/admin/cohort-moves/${id}/review`, { action, comment: rsComment[id]?.trim() || undefined }),
      action === "approve" ? "نقلت الشعبة — وأخبر المتعلّمون والمدرب" : "لم ينقل — ووصل المدرب تعليقك",
    );

  /* «افتح الشعبة» — وما ردّ به يُقال بجانبه، وتُقرأ الشروطُ بعده كما صارت */
  const openCohort = async (id: string) => {
    if (busy) return;
    setBusy(true); setFlash(null);
    setOpenError((prev) => ({ ...prev, [id]: "" }));
    try {
      await apiPost(`/api/admin/cohorts/${id}/open`);
      setFlash({ kind: "ok", text: "فتحت الشعبة — التسجيل متاح الآن" });
      await load();
    } catch (err) {
      setOpenError((prev) => ({ ...prev, [id]: err instanceof ApiError ? err.message : "تعذّر فتح الشعبة" }));
    } finally {
      await loadChecklist(id);
      setBusy(false);
    }
  };

  const loadChecklist = async (id: string) => {
    try {
      const check = await apiGet<Checklist>(`/api/admin/cohorts/${id}/open-checklist`);
      setChecklist((prev) => ({ ...prev, [id]: check }));
    } catch { /* الفحص اختياري العرض */ }
  };

  const toggle = (id: string) => {
    const next = expanded === id ? null : id;
    setExpanded(next);
    /* شعبةٌ جديدةٌ تُفتح على لسانها الأوّل — لا على اللسان الذي تُرك فيه غيرُها */
    setTab("identity");
    if (next) void loadChecklist(next);
  };

  /* خياراتُ الفلاتر من الصفوف نفسِها لا من قائمةٍ ثانية تبلى */
  /* اسمُ المجال من الـAPI: `courseById` تقرأ الكتالوجَ المضمَّن، وهو لا
     يُثبَّت في لوحة الإدارة — فكان مرشِّحُ «المجال» فارغا دائما، لا لأنّ
     الشعبَ بلا مجال بل لأنّ الاسمَ لم يصل. */
  const pathwayOf = (courseId: string) =>
    courses.find((c) => c.id === courseId)?.pathwayNames[0] ?? "";
  const pathways = [...new Set(rows.map((c) => pathwayOf(c.courseId)).filter(Boolean))].sort();
  const trainerNames = [...new Set(rows.flatMap((c) => c.trainers.map((t) => t.name)))].sort();
  const statuses = [...new Set(rows.map((c) => c.status))];

  /* التاريخُ يقارَن على `startsAt`، والشعبةُ بلا بداية تُستبعد متى حُدّد مدى
     — فـ«ما بين تاريخين» لا يشمل ما لا تاريخ له. */
  const filtered = rows.filter((c) => {
    if (!inCohortList(list, c)) return false;
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
  }).filter((c) => matchesQuery(q, [c.title, c.courseTitle, ...c.trainers.map((t) => t.name)]));
  const filtering = Object.values(filters).some(Boolean);
  /* الشعبُ صفحاتٌ: بطاقةٌ واحدةٌ تُفتح في كلّ حين، وعشرُ بطاقاتٍ في الصفحة
     تكفي للمسح بالعين. */
  const view = paginate(filtered, page, 10);

  if (offline) {
    return (
      <AdminLayout title="تشغيل الشعب">
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
    <AdminLayout title="تشغيل الشعب">
      {flash && (
        <Card as="p" tone={flash.kind === "error" ? "danger" : "accent"} role={flash.kind === "error" ? "alert" : "status"} className={`sticky top-[4.5rem] z-30 mb-5 flex items-center gap-2 px-4 py-3 text-sm font-bold backdrop-blur ${flash.kind === "error" ? "text-red-200" : "text-teal-light-ink"}`}>
          {flash.kind === "error"
            ? <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            : <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />}
          {flash.text}
        </Card>
      )}

      {/* من ينتظر دورةً بلا شعبة — لأيّها يُبحث عن مدرّبٍ أوّلا (١٢ أكتوبر ٢٠٢٦) */}
      <CourseDemand />

      <CohortReadiness onApplied={() => void load()} />

      {/* ── اقتراحات تأجيل الجلسات ──

          المدرب يقترح والإدارة تعتمد — وهو القرار المتّفق عليه. والموعد لا
          يتبدّل عند المتعلّمين قبل الاعتماد، فما هنا ينتظر قرارا لا علما.
          وموضعه أعلى الصفحة لأنّ ما ينتظر قرارا يسبق ما يُنشأ. */}
      {moves.length > 0 && (
        <Panel tone="warn" className="mb-6">
          <h2 className="flex items-center gap-2 text-sm font-black text-gold-ink">
            <CalendarClock className="h-4 w-4" /> طلبات نقل شعب إلى فصل آخر ({moves.length})
          </h2>
          <div className="mt-4 space-y-3">
            {moves.map((m) => (
              <Card key={m.id} className="bg-paper/25">
                <p className="text-sm font-bold">{m.cohortTitle}</p>
                <p className="mt-0.5 text-read text-muted-foreground">طلبه {m.requester} · فيها {m.learners} متعلّما</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs">
                  <span className="text-muted-foreground">الآن: <span className="text-foreground">{m.fromAr ?? "بلا فصل"}{m.fromStartsAt ? ` · ${fmtDateTimeAr(m.fromStartsAt)}` : ""}</span></span>
                  <span className="text-gold-ink">إلى: <span className="font-bold">{m.toAr}{m.newStartsAt ? ` · ${fmtDateTimeAr(m.newStartsAt)}` : ""}</span></span>
                </div>
                <Inset as="p" className="mt-2.5 px-3 py-2 text-read leading-6 text-foreground">{m.reason}</Inset>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    aria-label={`تعليق على طلب نقل ${m.cohortTitle}`}
                    value={rsComment[m.id] ?? ""}
                    onChange={(e) => setRsComment((prev) => ({ ...prev, [m.id]: e.target.value }))}
                    placeholder="تعليقك — يصل المدرب مع القرار"
                    className={`${staffControlCls} min-w-0 flex-1`}
                  />
                  <Button tone="confirm" type="button" disabled={busy} onClick={() => void reviewMove(m.id, "approve")}>
                    انقل الشعبة
                  </Button>
                  <Button tone="danger" type="button" disabled={busy} onClick={() => void reviewMove(m.id, "reject")}>
                    لا أنقلها
                  </Button>
                </div>
              </Card>
            ))}
          </div>
          <p className="mt-3 text-read leading-relaxed text-muted-foreground">
            النقل يحرّك كل مواعيد الشعبة بأسابيع كاملة، ويبلّغ المتعلّمين بالجرس والبريد. والرفض يبقيها كما هي.
          </p>
        </Panel>
      )}

      {reschedules.length > 0 && (
        <Panel tone="warn" className="mb-6">
          <h2 className="flex items-center gap-2 text-sm font-black text-gold-ink">
            <CalendarClock className="h-4 w-4" /> اقتراحات تأجيل تنتظر قرارك ({reschedules.length})
          </h2>
          <div className="mt-4 space-y-3">
            {reschedules.map((r) => (
              <Card key={r.id} className="bg-paper/25">
                <p className="text-sm font-bold">{r.session.title}</p>
                <p className="mt-0.5 text-read text-muted-foreground">
                  {r.session.cohort.title} · اقترحه {r.requester.displayName}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs">
                  <span className="text-muted-foreground">الموعد الآن: <span className="text-foreground">{fmtDateTimeAr(r.currentStartsAt)}</span></span>
                  <span className="text-gold-ink">المقترح: <span className="font-bold">{fmtDateTimeAr(r.proposedStartsAt)}</span></span>
                </div>
                <Inset as="p" className="mt-2.5 px-3 py-2 text-read leading-6 text-foreground">{r.reason}</Inset>
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
          <p className="mt-3 text-read leading-relaxed text-muted-foreground">
            الاعتماد ينقل الموعد ويبلّغ المتعلّمين. والرفض يبقيه، ويصل تعليقك للمدرّب.
          </p>
        </Panel>
      )}

      {/* إنشاء شعبة — معالجٌ من خمس خطوات: الدورة، الجدول (وجلساتُه تُولَّد)،
          المقاعد والسعر، المدرّب، ثمّ مراجعةٌ قبل الإنشاء. استعاض عن نموذجٍ
          واحدٍ كانت شروطُه الستّةُ تُكتشَف بعد الحفظ. */}
      <div className="mb-6">
        {/* سطحٌ يُضغط لا زرٌّ: `Card interactive` تحمل حلقةَ التركيز
            والتحويمَ من أصلها، فلا تُكتب في مكانها ولا تُنسى. */}
        <Card as="button" interactive onClick={() => setCreateOpen(!createOpen)}
          aria-expanded={createOpen}
          className="mb-3 flex w-full items-center justify-between text-sm font-black">
          <span>شعبة جديدة</span>
          <ChevronDown className={`h-4 w-4 transition ${createOpen ? "rotate-180" : ""}`} />
        </Card>
        {createOpen && (
          <CohortWizard
            terms={terms}
            /* من الـAPI لا من الكتالوج المضمَّن: هذه الشاشةُ لا تطلب
               `/api/public/core-catalog` أصلا، فـ`courseById` كانت تردّ
               `undefined` للدوراتِ كلِّها — فيُعرض «—» ثمّ تُفتح الشعبةُ
               بسعرٍ لم يره أحد. */
            courses={courses.map((c) => ({
              id: c.id, title: c.title,
              currency: c.listCurrency, listPrice: c.listPrice,
            }))}
            onDone={(msg) => { setFlash({ kind: "ok", text: msg }); setCreateOpen(false); void load(); }}
            onError={(msg) => setFlash({ kind: "error", text: msg })}
          />
        )}
      </div>

      {!loading && rows.length > 0 && (
        <TabBar className="mb-4" ariaLabel="قوائم الشعب" value={list}
          onChange={(next) => { setList(next); setPage(1); }}
          items={COHORT_LISTS.map((l) => ({ id: l.id, label: `${l.label} (${rows.filter((c) => inCohortList(l.id, c)).length})` }))} />
      )}
      {!loading && rows.length > 0 && (
        <Panel className="mb-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <label className="text-fine text-muted-foreground">
              الحالة
              <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className={filterCls}>
                <option value="">كلّ الحالات</option>
                {statuses.map((st) => <option key={st} value={st}>{(STATUS_META[st] ?? STATUS_META.draft).label}</option>)}
              </select>
            </label>
            <label className="text-fine text-muted-foreground">
              المجال
              <select value={filters.pathway} onChange={(e) => setFilters({ ...filters, pathway: e.target.value })} className={filterCls}>
                <option value="">كلّ المجالات</option>
                {pathways.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="text-fine text-muted-foreground">
              المدرّب
              <select value={filters.trainer} onChange={(e) => setFilters({ ...filters, trainer: e.target.value })} className={filterCls}>
                <option value="">كلّ المدرّبين</option>
                {trainerNames.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="text-fine text-muted-foreground">
              تبدأ بعد
              <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className={filterCls} />
            </label>
            <label className="text-fine text-muted-foreground">
              تبدأ قبل
              <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className={filterCls} />
            </label>
          </div>
          {filtering && (
            <div className="mt-3 flex items-center gap-3 text-fine text-muted-foreground">
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
        <Panel as="p" className="py-16 text-center text-sm text-muted-foreground">لا شعب بعد — أنشئ أول شعبة من الأعلى.</Panel>
      ) : filtered.length === 0 ? (
        /* «لا نتائج» غيرُ «لا شعب»: الأولى تُمسح فلاترُها، والثانية تُنشأ شعبةً.
           ولسانُ المعتمَدة بلا فلاتر فارغٌ لأنّه لا شيءَ ينتظر — لا لأنّ الفلاتر ضيّقة */
        <Panel as="p" className="py-16 text-center text-sm text-muted-foreground">
          {list === "approved" && !filtering && !q
            ? "لا شعبة معتمدة تنتظر الفتح الآن."
            : "لا شعبة تطابق الفلاتر — وسّع المدى أو امسحها."}
        </Panel>
      ) : (
        <div className="space-y-4">
          <ListToolbar q={q} onQ={setQ} onPage={setPage} view={view} unit="شعبة"
            placeholder="ابحث باسم الشعبة أو دورتها أو مدرّبها…" />
          {view.rows.map((c) => {
            const meta = STATUS_META[c.status] ?? STATUS_META.draft;
            const check = checklist[c.id];
            const isOpen = expanded === c.id;
            return (
              <Panel key={c.id}>
                <button onClick={() => toggle(c.id)} aria-expanded={isOpen}
                  className="flex w-full cursor-pointer flex-wrap items-center gap-4 rounded-xl text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-paper">
                  <div className="min-w-0 flex-1">
                    <p className="font-black">{c.title}</p>
                    <p className="mt-0.5 text-read text-muted-foreground">
                      {c.courseTitle} · {c.trainers.length ? c.trainers.map((t) => t.name).join("، ") : "بلا مدرب"}
                      {" · "}{c.enrolled}/{c.capacity ?? "—"} مقعدا · {c.sessionsCount} جلسة
                      {c.price ? ` · ${c.price} ${c.currency}` : ""}
                    </p>
                  </div>
                  {/* الحالةُ وحدَها لا تقول ما يراه الزائر: شعبةٌ «مفتوحة» بلا خطّة مدرّبٍ
                      معتمَدة لا يعرضها الموقعُ ولا يبيعها، ومسوّدةٌ اعتُمدت خطّتُها تنتظر
                      قرارَ فتحها. فيُقال الاثنان بجانب الحالة (١٢ أكتوبر ٢٠٢٦) */}
                  {isLiveCohort(c.status) && !c.trainerPlanApproved && (
                    <span className="rounded-full border border-gold/50 px-3 py-1 text-fine font-bold text-gold-ink"
                      title="لا مدرّب معتمد — لا تعرض في الموقع ولا تباع حتّى تعتمد خطّة مدرّبها">
                      مخفيّة عن الموقع
                    </span>
                  )}
                  {/* نُقلت إلى فصلٍ آخر — يُرى بلا فتحها، فلا تُقرأ «تنتظر فتحك» بمواعيدها القديمة */}
                  {c.moved && (
                    <span className="rounded-full border border-gold/50 px-3 py-1 text-fine font-bold text-gold-ink">
                      {movedLabelAr(c.moved)}
                    </span>
                  )}
                  {awaitsOpening(c) && (
                    <span className="rounded-full border border-teal/50 px-3 py-1 text-fine font-bold text-teal-light-ink"
                      title="خطّة مدرّبها معتمدة — تعرض وتباع حين تفتحها من «الهُويّة والحالة»">
                      معتمدة — تنتظر فتحك
                    </span>
                  )}
                  <span className={`rounded-full border px-3 py-1 text-fine font-bold ${meta.cls}`}>{meta.label}</span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {isOpen && (
                  <div className="mt-5 space-y-5 border-t border-white/8 pt-5">
                    {/* شريطُ الألسنة — الأربعةُ ظاهرةٌ دائما، فيُعرف ما في
                        الشعبة بلا فتحِ طيّاتٍ واحدةً واحدة. ووصفُ اللسان تحت
                        اسمه: «الجدول واللقاءات» لا تقول ماذا فيها لمن لم
                        يفتحها من قبل. */}
                    {/* كان `Button` بنبرتَين — وهو أقربُ ما وصلت إليه الألسنةُ
                        السّتُّ قبل أن تصير درجةً. والفرقُ ليس شكلا: الشريطُ
                        وقفةٌ واحدةٌ في التنقّل، والأسهمُ تمشي بين ألسنته. */}
                    <TabBar
                      ariaLabel="أقسام الشعبة"
                      value={tab}
                      onChange={setTab}
                      items={COHORT_TABS.map((t) => ({ id: t.id, label: t.label, hint: t.hint }))}
                    />
                    <p className="-mt-2 text-read text-muted-foreground">
                      {COHORT_TABS.find((t) => t.id === tab)?.hint}
                    </p>

                    {/* ══════ ① الهُويّة والحالة ══════ */}
                    {tab === "identity" && (<>
                    {/* شروط الفتح الستة */}
                    <div>
                      <p className="mb-2 text-read font-black text-muted-foreground">شروط الفتح</p>
                      {check ? (
                        check.ready ? (
                          <p className="flex items-center gap-1.5 text-read font-bold text-teal-light-ink"><CheckCircle2 className="h-3.5 w-3.5" /> كل الشروط مستوفاة</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {check.missing.map((m) => {
                              /* والنقصُ الذي يُوفى في لسانٍ آخر يفتحه — لا يُترك يُبحث عنه */
                              const fixAt = tabForGap(m);
                              const chip = "flex items-center gap-1.5 rounded-full border border-red-500/40 px-3 py-1 text-fine font-bold text-red-400";
                              return fixAt ? (
                                <button key={m} type="button" onClick={() => setTab(fixAt)} className={`${chip} hover:bg-red-500/10`}
                                  title={`افتح «${COHORT_TABS.find((t) => t.id === fixAt)?.label}»`}>
                                  <XCircle className="h-3 w-3" /> {m} — أكملها في «{COHORT_TABS.find((t) => t.id === fixAt)?.label}»
                                </button>
                              ) : (
                                <span key={m} className={chip}>
                                  <XCircle className="h-3 w-3" /> {m}
                                </span>
                              );
                            })}
                          </div>
                        )
                      ) : <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/50" />}
                    </div>

                    {/* ── وكانت هنا «اكتب خطّةَ التقديم» لشعبةٍ بلا خطّة ──

                        سقطت مع شرطها (١٢ أكتوبر ٢٠٢٦): الشعبةُ لا تُفتح إلّا بخطّة
                        مدرّبٍ معتمَدة، فخطّةٌ أساسيّةٌ يكتبها المديرُ لا تفتح شيئا —
                        وعرضُها نقصا يُوفى هنا يَعِد بما لا يقع. والسببُ في
                        `CohortService.openChecklist`. */}
                    {/* إجراءات الحالة */}
                    <div className="flex flex-wrap gap-2">
                      {c.status === "draft" && (
                        <Button tone="confirm" disabled={busy} onClick={() => void openCohort(c.id)}>
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
                        <Button tone="danger" disabled={busy} onClick={() => act(() => apiPost(`/api/admin/cohorts/${c.id}/transition`, { to: "cancelled", note: "إلغاء من لوحة الإدارة" }), "ألغيت الشعبة")}>
                          إلغاء
                        </Button>
                      )}
                    </div>

                    {c.status === "draft" && openError[c.id] && (
                      <p className="text-read font-bold text-red-300" role="alert">{openError[c.id]}</p>
                    )}
                    {c.status === "draft" && check && !check.ready && (
                      <p className="flex items-center gap-1.5 text-read text-red-300">
                        <Lock className="h-3.5 w-3.5" /> لا يمكن فتحها قبل استيفاء الشروط أعلاه
                      </p>
                    )}
                    </>)}

                    {/* ══════ ② الجدول واللقاءات ══════ */}
                    {tab === "schedule" && (<>
                    {/* إضافة جلسة */}
                    {!["completed", "cancelled"].includes(c.status) && (
                      <Card className="bg-paper/20">
                        {/* «جلسة جديدة» كان عنوانا لا يقول ماذا يفعل.

                            سأل صاحبُ المنصّة: «ما معنى جلسة جديدة؟» — وهو من
                            بناها. و«جلسة» في العربيّة الرقميّة تسبق إلى الذهن
                            بمعنى جلسةِ الدخول، والمنصّةُ تستعملها للمعنيين.
                            فالعنوانُ يسمّيها **لقاءً**، والسطرُ تحته يقول
                            أثرَها: أين تظهر، وما الذي يُبنى عليها. */}
                        <p className="flex items-center gap-1.5 text-read font-black text-foreground"><CalendarPlus className="h-3.5 w-3.5" /> لقاء واحد — يضاف بيده</p>
                        <p className="mb-3 mt-1 text-read leading-5 text-muted-foreground">
                          لقاء مباشر واحد. يظهر في تقويم المتعلّم والمدرّب، ويرتبط به الحضور وتسجيل اللقاء ورابط الاجتماع.
                        </p>
                        <div className="grid gap-2 sm:grid-cols-5">
                          <input placeholder="عنوان الجلسة" value={sessionForm.title} onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })}
                            className="rounded-xl border border-white/15 bg-paper/30 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/75 focus:border-teal focus:outline-none sm:col-span-2" />
                          <input type="date" value={sessionForm.date} onChange={(e) => setSessionForm({ ...sessionForm, date: e.target.value })}
                            className="rounded-xl border border-white/15 bg-paper/30 px-3 py-2 text-xs text-foreground focus:border-teal focus:outline-none" />
                          <input type="time" value={sessionForm.time} onChange={(e) => setSessionForm({ ...sessionForm, time: e.target.value })}
                            className="rounded-xl border border-white/15 bg-paper/30 px-3 py-2 text-xs text-foreground focus:border-teal focus:outline-none" />
                          <Button tone="confirm" disabled={busy || sessionForm.title.length < 2 || !sessionForm.date}
                            onClick={() => act(async () => {
                              const startsAt = new Date(`${sessionForm.date}T${sessionForm.time}:00`);
                              const endsAt = new Date(startsAt.getTime() + Number(sessionForm.hours || 2) * 3600_000);
                              const r = await apiPost<{ notified: number; zoom: { joinUrl: string } | null }>(
                                `/api/admin/cohorts/${c.id}/sessions`,
                                { title: sessionForm.title, startsAt, endsAt, withZoom: sessionForm.withZoom },
                              );
                              setSessionForm({ title: "", date: "", time: "18:00", hours: "2", withZoom: sessionForm.withZoom });
                              setLastSession(r);
                            }, "أضيف اللقاء")}>
                            أضف
                          </Button>
                        </div>
                        {/* الاجتماعُ يُنشأ من هنا لا من موقع Zoom — والمفتاحُ
                            مضاءٌ افتراضا لأنّه المقصود، ومن أراد لقاءً حضوريّا
                            يُطفئه. ولو لم يكن التكاملُ مضبوطا قال الخادمُ ما
                            ينقصه بالاسم بدل أن يسقط الطلبُ صامتا. */}
                        <label className="mt-3 flex items-start gap-2 text-read leading-5 text-muted-foreground">
                          <input type="checkbox" checked={sessionForm.withZoom}
                            onChange={(e) => setSessionForm({ ...sessionForm, withZoom: e.target.checked })}
                            className="mt-0.5 h-4 w-4 shrink-0 accent-teal" />
                          <span>
                            <b className="text-foreground">أنشئ اجتماع Zoom وبلّغ المسجّلين</b> — باسم الأكاديميّة، ويصل رابطه لكل متعلّمي الشعبة.
                          </span>
                        </label>
                        {lastSession && (
                          <Inset as="p" tone="positive" className="mt-3 text-read leading-6 text-emerald-200">
                            {lastSession.zoom
                              ? `أنشئ اللقاء واجتماعه، وبلّغ ${lastSession.notified} متعلّما.`
                              : `أنشئ اللقاء بلا اجتماع، وبلّغ ${lastSession.notified} متعلّما.`}
                          </Inset>
                        )}
                      </Card>
                    )}

                    {/* توليدُ الجلسات من جدول الشعبة، وتكرارُ الشعبة لفصلٍ قادم.

                        الأوّلُ يُغني عن إضافةِ ستّةَ عشرَ صفًّا بيدٍ واحدة،
                        والثاني يُغني عن إعادةِ الإعداد كلِّه في كلّ فصل. */}
                    {!["completed", "cancelled"].includes(c.status) && (
                      <Card className="bg-paper/20">
                        {/* ولماذا هذه البطاقةُ هنا أصلا؟ — سؤالُ صاحب المنصّة.

                            لأنّ معالجَ الإنشاء يولّد لقاءاتِ الشعبة عند
                            إنشائها (`CohortWizard`). فهذه لا تلزم إلّا حين
                            **يتغيّر الجدولُ بعد ذلك** — حالةٌ نادرةٌ كانت
                            تُعرض كأنّها يوميّة. فيُقال ذلك صراحةً، ويُقال
                            كم لقاءً في الشعبة الآن كي يُعرف أثمّةَ ما يُولَّد. */}
                        <p className="flex items-center gap-1.5 text-read font-black text-foreground">
                          <Sparkles className="h-3.5 w-3.5" /> توليد اللقاءات من الجدول الأسبوعيّ
                        </p>
                        <p className="mb-3 mt-1 text-read leading-5 text-muted-foreground">
                          {c.sessionsCount > 0
                            ? `في الشعبة ${c.sessionsCount} لقاء مجدولا. استخدمه فقط إن تغيّر الجدول، ولن تتكرّر اللقاءات الموجودة.`
                            : "لا لقاءات بعد. ينشئ كل لقاءات الأسابيع دفعة واحدة من أيّام الشعبة ووقتها."}
                        </p>
                        {c.daysOfWeek.length === 0 || !c.startTime ? (
                          <p className="text-read text-muted-foreground">
                            لا جدول أسبوعيّا — حدّد الأيّام والوقت من «تعديل الشعبة» ثمّ ولّد الجلسات.
                          </p>
                        ) : (
                          <div className="grid gap-2 sm:grid-cols-4">
                            <label className="text-fine text-muted-foreground">
                              أسابيع
                              <input type="number" min={1} max={52} value={genForm.weeks}
                                onChange={(e) => setGenForm({ ...genForm, weeks: e.target.value })}
                                className="mt-1 w-full rounded-xl border border-white/15 bg-paper/30 px-3 py-2 text-xs text-foreground focus:border-teal focus:outline-none" />
                            </label>
                            <label className="text-fine text-muted-foreground">
                              من تاريخ
                              <input type="date" value={genForm.from}
                                onChange={(e) => setGenForm({ ...genForm, from: e.target.value })}
                                className="mt-1 w-full rounded-xl border border-white/15 bg-paper/30 px-3 py-2 text-xs text-foreground focus:border-teal focus:outline-none" />
                            </label>
                            <label className="text-fine text-muted-foreground">
                              مدّة (دقيقة)
                              <input type="number" min={15} step={15} value={genForm.duration}
                                onChange={(e) => setGenForm({ ...genForm, duration: e.target.value })}
                                className="mt-1 w-full rounded-xl border border-white/15 bg-paper/30 px-3 py-2 text-xs text-foreground focus:border-teal focus:outline-none" />
                            </label>
                            <div className="flex items-end gap-2">
                              <Button tone="confirm" disabled={busy || Number(genForm.duration) < 15 || Number(genForm.weeks) < 1}
                                onClick={() => act(async () => {
                                  const r = await apiPost<{ created: number; skipped: number }>(`/api/admin/cohorts/${c.id}/sessions/generate`, {
                                    weeks: Number(genForm.weeks),
                                    from: genForm.from ? new Date(`${genForm.from}T00:00:00.000Z`).toISOString() : undefined,
                                    durationMinutes: Number(genForm.duration),
                                    apply: true,
                                  });
                                  setFlash({ kind: "ok", text: `ولّدت ${r.created} جلسة${r.skipped ? ` · وتخطّيت ${r.skipped} موجودة أصلا` : ""}` });
                                }, "")} className="flex-1">
                                ولّد
                              </Button>
                            </div>
                            <p className="text-read leading-5 text-muted-foreground sm:col-span-4">
                              الجدول: {daysLabelAr(c.daysOfWeek)} · {c.startTime}. لن تتكرّر اللقاءات الموجودة، وتتبع بداية الشعبة ونهايتها جلساتها.
                            </p>
                          </div>
                        )}
                      </Card>
                    )}

                    <Card className="bg-paper/20">
                      <p className="mb-3 flex items-center gap-1.5 text-read font-black text-muted-foreground">
                        <CopyPlus className="h-3.5 w-3.5" /> تكرار الشعبة لفصل قادم
                      </p>
                      <div className="grid gap-2 sm:grid-cols-4">
                        <label className="text-fine text-muted-foreground sm:col-span-2">
                          عنوان النسخة
                          <input value={dupForm.title} onChange={(e) => setDupForm({ ...dupForm, title: e.target.value })}
                            placeholder={`${c.title} — نسخة`}
                            className="mt-1 w-full rounded-xl border border-white/15 bg-paper/30 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/75 focus:border-teal focus:outline-none" />
                        </label>
                        <label className="text-fine text-muted-foreground">
                          إزاحة الأسابيع
                          <input type="number" min={0} max={104} value={dupForm.shiftWeeks}
                            onChange={(e) => setDupForm({ ...dupForm, shiftWeeks: e.target.value })}
                            className="mt-1 w-full rounded-xl border border-white/15 bg-paper/30 px-3 py-2 text-xs text-foreground focus:border-teal focus:outline-none" />
                        </label>
                        <div className="flex items-end">
                          <Button tone="secondary" disabled={busy}
                            onClick={() => act(async () => {
                              await apiPost(`/api/admin/cohorts/${c.id}/duplicate`, {
                                title: dupForm.title.trim() || undefined,
                                shiftWeeks: Number(dupForm.shiftWeeks) || 0,
                                withSessions: dupForm.withSessions,
                                withMaterials: true,
                                withAssessments: true,
                              });
                              setDupForm({ title: "", shiftWeeks: "8", withSessions: true });
                            }, "أنشئت نسخة مسودّة — بجدولها وموادّها ومهامّها، بلا تسجيلات ولا حضور")}
                            className="w-full">
                            كرّرها
                          </Button>
                        </div>
                        <label className="flex cursor-pointer items-center gap-2 text-fine text-muted-foreground sm:col-span-4">
                          <input type="checkbox" checked={dupForm.withSessions}
                            onChange={(e) => setDupForm({ ...dupForm, withSessions: e.target.checked })}
                            className="h-3.5 w-3.5 cursor-pointer accent-teal" />
                          انسخ الجلسات أيضا مع إزاحة الأسابيع (أو ولّدها لاحقا من الجدول)
                        </label>
                      </div>
                    </Card>

                    {/* ── مَن يجدول لقاءات هذه الشعبة؟ ──

                        سؤالُ صاحب المنصّة: «لماذا الأدمن يقوم بها؟» وجوابُه
                        أنّه لا ينبغي. فالمدرّبُ يعرف متى يستطيع، وبوّابتُه
                        كانت تقول له «الإدارة تضيف الجدول» ولا تعطيه إلّا أن
                        **يقترح** تأجيلا يُرفع إلى طابور موافقات.

                        فهنا تضع الإدارةُ الحدَّ — مدًى بلا سقف (٤ أكتوبر ٢٠٢٦) —
                        ويقرّر المدرّبُ داخله. والحدّان يُفتحان معا أو لا يُفتحان. */}
                    <ScheduleWindowCard cohort={c} busy={busy} act={act} />

                    {/* ربط Zoom يدوي لجلسة */}
                    <Card className="bg-paper/20">
                      <p className="mb-3 flex items-center gap-1.5 text-read font-black text-muted-foreground"><Video className="h-3.5 w-3.5" /> ربط اجتماع Zoom يدوي</p>
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
                        }, "ربط اجتماع Zoom بالجلسة")} />
                    </Card>

                    </>)}

                    {/* ══════ ③ التسجيل والمال ══════ */}
                    {tab === "enrollment" && (<>
                    {/* تسجيل متعلم */}
                    {isLiveCohort(c.status) && c.registrationOpen && (
                      <Card className="bg-paper/20">
                        <p className="mb-3 flex items-center gap-1.5 text-read font-black text-muted-foreground"><UserPlus className="h-3.5 w-3.5" /> تسجيل متعلم — الفائض يتحول لقائمة انتظار آليا</p>
                        <div className="flex gap-2">
                          <LearnerSearchField cohortId={c.id} value={enrollLearner} onChange={setEnrollLearner} disabled={busy} />
                          <Button tone="confirm" className="shrink-0" disabled={busy || !enrollLearner}
                            onClick={() => act(async () => {
                              const res = await apiPost<{ status: string }>(`/api/admin/cohorts/${c.id}/enrollments`, { userId: enrollLearner!.id });
                              const name = enrollLearner!.displayName;
                              setEnrollLearner(null);
                              setFlash({ kind: "ok", text: res.status === "waitlisted" ? `الشعبة ممتلئة — أدرج ${name} في قائمة الانتظار` : `سجل ${name} بنجاح` });
                            }, "")}>
                            سجّل
                          </Button>
                        </div>
                      </Card>
                    )}

                    <p className="flex items-center gap-1.5 text-read text-muted-foreground">
                      <Users className="h-3 w-3" /> المسجلون الفعليون: {c.enrolled} — السعة {c.capacity ?? "غير محددة"}
                    </p>
                    </>)}

                    {/* ══════ ④ المحتوى والشهادات ══════ */}

                    {/* وأقسامُ `CohortOps` تُفرَّق على الألسنة الأربعة — لا
                        تُعرض كلُّها في كلّ لسان. فهي تعرف لسانَها وتصمت في
                        غيره. */}
                    {/* وما يُحفظ هنا يُعاد معه شروطُ الفتح (١٢ أكتوبر ٢٠٢٦): حُفظت السعةُ والسعر
                        فصار الرأسُ «0/25 مقعدا · 170» وبقيت الشاراتُ «لا سعة محددة» حتّى تُطوى البطاقة */}
                    <CohortOps cohort={c} tab={tab} onDone={(msg) => { setFlash({ kind: "ok", text: msg }); void load(); void loadChecklist(c.id); }} />

                    {/* «من غيّر هذه الشعبة؟» — يُسأل هنا، فيُقرأ هنا. وكان
                        الجوابُ يقتضي فتحَ «سجلّ الأثر» ومعرفةَ معرّفِ الشعبة. */}
                    {tab === "identity" && (
                      <EntityAuditTimeline entityType="cohort" entityId={c.id} labelAr="أثر هذه الشعبة" />
                    )}
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
/* نافذةُ جدولةِ المدرّب — تُفتح بالحدّين، وتُغلق بإفراغهما.

   ولا حالةَ ثالثة: نصفُ نافذةٍ لا يفتح بابا، ولذلك يُعطَّل الحفظُ حتّى
   يكتمل الحدّان أو يفرغا. وكان معهما «سقفُ اللقاءات» ثالثا؛ ثمّ قال صاحبُ
   المنصّة (٤ أكتوبر ٢٠٢٦): «لا حاجةَ لسقف الشعبة — يضيفون ما شاؤوا، وساعاتٌ
   أكثرُ جودةٌ أعلى». فسقط الحقلُ، ولا يُقرأ ما حُفظ فيه من قبل. */
function ScheduleWindowCard({ cohort, busy, act }: {
  cohort: CohortRow;
  busy: boolean;
  act: (fn: () => Promise<unknown>, msg: string) => Promise<void>;
}) {
  const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
  const [form, setForm] = useState({
    start: day(cohort.scheduleWindowStart),
    end: day(cohort.scheduleWindowEnd),
  });
  const filled = [form.start, form.end].filter(Boolean).length;
  const complete = filled === 2;
  const cleared = filled === 0;
  const isOpen = Boolean(cohort.scheduleWindowStart && cohort.scheduleWindowEnd);

  return (
    <Card className="bg-paper/20">
      <p className="flex items-center gap-1.5 text-read font-black text-foreground">
        <CalendarClock className="h-4 w-4 shrink-0 text-teal-ink" /> نافذة جدولة المدرّب
      </p>
      <p className="mt-1 text-read leading-6 text-muted-foreground">
        {isOpen
          ? "مفتوحة — يضيف المدرّب اللقاءات وينقلها داخل هذه الفترة بلا موافقة. وما خارجها يصلك اقتراحا."
          : "مغلقة — الجدولة لك وحدك، والمدرّب يقترح التأجيل فقط. افتحها ليجدول ضمن فترة تحدّدها."}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-fine text-muted-foreground">
          من تاريخ
          <input type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })}
            className={`${staffControlCls} mt-1`} />
        </label>
        <label className="text-fine text-muted-foreground">
          إلى تاريخ
          <input type="date" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })}
            className={`${staffControlCls} mt-1`} />
        </label>
      </div>
      {!complete && !cleared && (
        <p className="mt-2 text-read text-gold-ink">
          الحدّان يفتحان معا — املأ ما نقص، أو أفرغهما لإغلاق النافذة.
        </p>
      )}
      <Button tone="confirm" disabled={busy || (!complete && !cleared)} className="mt-3"
        onClick={() => act(
          () => apiPut(`/api/admin/cohorts/${cohort.id}/schedule-window`, {
            start: form.start ? new Date(`${form.start}T00:00:00.000Z`).toISOString() : null,
            end: form.end ? new Date(`${form.end}T23:59:59.000Z`).toISOString() : null,
          }),
          complete ? "فتحت نافذة الجدولة — المدرّب يقرّر داخل حدّك" : "أغلقت نافذة الجدولة — الجدولة إليك وحدك",
        )}>
        {complete ? "افتح النافذة" : "أغلق النافذة"}
      </Button>
      {isOpen && (
        <p className="mt-2 text-read text-muted-foreground">
          في الشعبة {cohort.sessionsCount} لقاء — بلا سقف.
        </p>
      )}
    </Card>
  );
}

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

  if (!sessionsCount) return <p className="text-read text-muted-foreground">أضف جلسة أولا ثم اربطها باجتماع.</p>;
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
          <option value="">{sessions === null ? "تحمّل الجلسات…" : "اختر الجلسة"}</option>
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
        <Button tone="confirm" className="shrink-0"
          disabled={busy || !value.sessionId || !/^https:\/\/.+/.test(value.joinUrl)} onClick={onSubmit}>
          اربط
        </Button>
      </div>
    </div>
  );
}
