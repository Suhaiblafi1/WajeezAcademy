/* تأليف متن الوحدات — الشاشة التي تملأ الأربعمائة.

   ٤٠٤ وحدة، لها متنٌ ٤. والعرضُ للمتعلّم جاهزٌ منذ البند ح. فهذه الشاشة
   هي الجسرُ الوحيد الناقص بين كتالوجٍ فيه عناوينُ الدروس وكتالوجٍ فيه
   الدروسُ نفسُها.

   ثلاثةُ قراراتٍ في تصميمها:

   ١) المعاينة بعارض المتعلّم نفسِه — `LessonBody` و`ModuleCheck`
      و`ModuleVideo` و`DecisionScenario` كما هي، لا نسخةٌ «تقريبيّة» منها.
      فما يُرى هنا هو ما يُرى هناك حرفا، ولا مفاجأةَ بعد النشر.

   ٢) والطابور إلى جانب المحرّر لا في صفحةٍ أخرى: من يكتب أربعمائة وحدة
      ينتقل بينها عشراتِ المرّات، فذهابٌ وإيابٌ بين صفحتين ضريبةٌ تُدفع في
      كلِّ مرّة.

   ٣) وأخطاءُ الصيغة تُعرض وأنت تكتب، بالمحلّلات نفسها التي يحكم بها
      الخادم — فلا يُفاجأ الكاتب بردٍّ ٤٢٢ بعد أن كتب صفحة. */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, CheckCircle2, Eye, FileText, Film, GitBranch, Loader2,
  ClipboardCheck, ClipboardList, ListChecks, RefreshCw, Save, Search, Send, ShieldCheck, Undo2, Users,
} from "lucide-react";
import AdminLayout from "./AdminLayout";
import { apiGet, apiPost, apiPut, ApiError, permissionMessage } from "@/services/api";
import { useRealSession } from "@/services/session";
import LessonBody from "@/components/LessonBody";
import ModuleCheck from "@/components/ModuleCheck";
import ModuleVideo from "@/components/ModuleVideo";
import DecisionScenario from "@/components/DecisionScenario";
import PracticeActivity from "@/components/PracticeActivity";
import RubricSelfReview from "@/components/RubricSelfReview";
import { validateChecks } from "@/application/content/module-checks";
import { validateScenario } from "@/application/content/scenario";
import { validateVideo } from "@/application/content/module-video";
import { validatePractice } from "@/application/content/practice";
import { validateRubric } from "@/application/content/rubric";
import { fmtShortDateTimeAr } from "@/utils/format";
import { fmtNum } from "@/application/text/format-ar";

interface WorkRow {
  moduleId: string; courseId: string; courseTitleAr: string; titleAr: string; sequence: number;
  hasBody: boolean; hasChecks: boolean; hasVideo: boolean; hasScenario: boolean;
  hasPractice: boolean; hasRubric: boolean;
  draftStatus: string | null; learnersWaiting: number; courseHasOpenCohort: boolean;
}
interface CourseGroup { courseId: string; titleAr: string; total: number; withBody: number }
interface Worklist {
  total: number; withBody: number; missing: number;
  courses: CourseGroup[];
  rows: WorkRow[];
}

/* ثلاثةُ مرشّحات لا رايةٌ واحدة.

   كانت خانةَ اختيارٍ واحدة: «الناقصة فقط» أو الكلّ. وشكوى صاحب المنصّة:
   «التركيز على الناقص فقط يصعّب الوصول لمتنٍ مكتمل تريد تعديله» — وهو حقّ:
   من يريد مراجعةَ ما كُتب يبحث عنه وسط أربعمائةِ فارغة. */
type BodyFilter = "all" | "missing" | "written";

const BODY_FILTERS: { id: BodyFilter; label: string }[] = [
  { id: "all", label: "الكلّ" },
  { id: "missing", label: "بلا متن" },
  { id: "written", label: "لها متن" },
];

interface Draft {
  version: number; status: string;
  bodyAr: string | null; checksAr: string | null; videoAr: string | null; scenarioAr: string | null;
  practiceAr: string | null; rubricAr: string | null;
}

interface HistoryRow {
  id: string; version: number; status: string; titleAr: string;
  bodyAr: string | null; checksAr: string | null; videoAr: string | null; scenarioAr: string | null;
  practiceAr: string | null; rubricAr: string | null;
  createdAt: string; submittedAt: string | null; reviewedAt: string | null;
  reviewNoteAr: string | null; hasAuthor: boolean;
}

type Tab = "body" | "checks" | "video" | "scenario" | "practice" | "rubric";

const TABS: { id: Tab; label: string; icon: typeof FileText; field: keyof Draft }[] = [
  { id: "body", label: "المتن", icon: FileText, field: "bodyAr" },
  { id: "checks", label: "التمرين", icon: ListChecks, field: "checksAr" },
  { id: "video", label: "الفيديو", icon: Film, field: "videoAr" },
  { id: "scenario", label: "السيناريو", icon: GitBranch, field: "scenarioAr" },
  { id: "practice", label: "النشاط", icon: ClipboardList, field: "practiceAr" },
  { id: "rubric", label: "الروبرك", icon: ClipboardCheck, field: "rubricAr" },
];

const STATUS_AR: Record<string, string> = {
  draft: "مسوّدة", in_review: "بانتظار الاعتماد الأكاديميّ",
  awaiting_final: "بانتظار الموافقة النهائية", published: "منشور", approved: "معتمد",
};

const PLACEHOLDER: Record<Tab, string> = {
  body: "# عنوان الدرس\n\nفقرةٌ تشرح الفكرة.\n\n- نقطة\n- نقطة\n\n> اقتباس أو تنبيه",
  checks: "س: نصّ السؤال\n- خيار خطأ\n+ خيار صحيح\nش: شرحُ الصواب",
  video: "https://www.youtube.com/watch?v=...\n0:00 مقدّمة\n2:30 الفكرة الأولى",
  scenario: "موقف: وصفُ الموقف المهنيّ\n\nعقدة: البداية\nنص: ما الذي تراه\n> خيارٌ أوّل\nأثر: ما يترتّب\nإلى: البداية",
  practice: "نشاط: عنوانُ ما سيفعله على عملٍ حقيقيّ\nزمن: 55\nمخرَج: القطعةُ التي تدخل ملفَّه المهنيّ\nبديل: من لا عمل له: مهمّةٌ محدَّدةٌ بديلة\n> خطوة: 15 · ما يُفعل بالضبط في هذه الخطوة\n> خطوة: 25 · الخطوةُ الثانية\n> خطوة: 15 · الخطوةُ الثالثة",
  rubric: "معيار: ما يُقاس به المخرَج\n- 3: وصفُ المستوى الأعلى بالسلوك\n- 2: وصفُ الأوسط\n- 1: وصفُ الأدنى\n\nمعيار: معيارٌ ثانٍ\n- 3: وصف\n- 2: وصف\n- 1: وصف",
};

/** أخطاءُ الصيغة للتبويب الحالي — بالمحلّل نفسه الذي يحكم به الخادم */
function errorsFor(tab: Tab, value: string): string[] {
  const v = value.trim();
  if (!v) return [];
  if (tab === "checks") { const r = validateChecks(v); return r.ok ? [] : r.errorsAr; }
  if (tab === "scenario") { const r = validateScenario(v); return r.ok ? [] : r.errorsAr; }
  if (tab === "video") { const r = validateVideo(v); return r.ok ? [] : r.errorsAr; }
  if (tab === "practice") { const r = validatePractice(v); return r.ok ? [] : r.errorsAr; }
  if (tab === "rubric") { const r = validateRubric(v); return r.ok ? [] : r.errorsAr; }
  return [];
}

export default function Authoring() {
  const { user } = useRealSession();
  const canDecide = user?.permissions.includes("catalog.course.publish") ?? false;
  /* الحلقةُ الأخيرة بحبّةٍ منفصلة — لا يملكها المديرُ الأكاديميّ */
  const canFinalApprove = user?.permissions.includes("catalog.content.final_approve") ?? false;

  const [work, setWork] = useState<Worklist | null>(null);
  const [bodyFilter, setBodyFilter] = useState<BodyFilter>("missing");
  /* الاختيارُ يبدأ بالدورة ثمّ وحداتُها تحتها بالترتيب — وهو ما طلبه صاحب
     المنصّة. وأربعُ مئةِ وحدةٍ في قائمةٍ واحدة تُقرأ طابورا لا كتالوجا. */
  const [courseId, setCourseId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selected, setSelected] = useState<WorkRow | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tab, setTab] = useState<Tab>("body");
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [note, setNote] = useState("");

  const loadWork = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const qs = new URLSearchParams({ body: bodyFilter, limit: "400" });
      if (courseId) qs.set("courseId", courseId);
      setWork(await apiGet<Worklist>(`/api/admin/authoring/worklist?${qs}`));
    } catch (e) {
      setError(permissionMessage(e, "تعذّر جلب طابور التأليف"));
    } finally { setLoading(false); }
  }, [bodyFilter, courseId]);

  useEffect(() => { void loadWork(); }, [loadWork]);

  const open = useCallback(async (row: WorkRow) => {
    setSelected(row); setNotice(""); setNote(""); setTab("body"); setBusy("open");
    try {
      const d = await apiPost<Draft>(`/api/admin/authoring/${row.moduleId}/draft`);
      setDraft(d);
      const h = await apiGet<{ history: HistoryRow[] }>(`/api/admin/authoring/${row.moduleId}`);
      setHistory(h.history);
    } catch (e) {
      setNotice(permissionMessage(e, "تعذّر فتح المسوّدة"));
      setDraft(null);
    } finally { setBusy(""); }
  }, []);

  const field = TABS.find((t) => t.id === tab)!.field;
  const value = ((draft?.[field] as string | null) ?? "");
  const liveErrors = useMemo(() => errorsFor(tab, value), [tab, value]);

  const setValue = (v: string) => setDraft((d) => (d ? { ...d, [field]: v } : d));

  const act = async (kind: "save" | "submit" | "withdraw" | "approve" | "changes" | "publish" | "return") => {
    if (!selected || !draft) return;
    setBusy(kind); setNotice("");
    try {
      const base = `/api/admin/authoring/${selected.moduleId}`;
      if (kind === "save") {
        await apiPut(`${base}/draft`, {
          bodyAr: draft.bodyAr, checksAr: draft.checksAr, videoAr: draft.videoAr, scenarioAr: draft.scenarioAr,
        });
        setNotice("حُفظت المسوّدة — ولا يراها متعلّم حتى تُنشر.");
      } else if (kind === "submit") {
        const r = await apiPost<Draft>(`${base}/submit`);
        setDraft((d) => (d ? { ...d, status: r.status } : d));
        setNotice("رُفعت للمراجعة. لا تعتمدها بنفسك — يراجعها غيرك.");
      } else if (kind === "withdraw") {
        const r = await apiPost<Draft>(`${base}/withdraw`);
        setDraft((d) => (d ? { ...d, status: r.status } : d));
        setNotice("سُحبت من المراجعة — تستطيع تعديلها الآن.");
      } else if (kind === "approve" || kind === "changes") {
        /* الحلقةُ الوسطى: اعتمادٌ أكاديميّ يرفعها للأخير، أو ردٌّ إلى الكاتب */
        const r = await apiPost<Draft>(`${base}/review`, {
          decision: kind === "approve" ? "approve" : "request_changes",
          noteAr: note,
        });
        setDraft((d) => (d ? { ...d, status: r.status } : d));
        setNotice(kind === "approve"
          ? "اعتُمدت أكاديميّا — وتنتظر الموافقة النهائية."
          : "أُعيدت إلى كاتبها مع ملاحظتك.");
        setNote("");
        await loadWork();
      } else {
        /* الحلقةُ الأخيرة: نشرٌ، أو إعادةٌ إلى المدير الأكاديميّ بملاحظة */
        const r = await apiPost<Draft>(`${base}/final`, {
          decision: kind === "publish" ? "publish" : "return_to_academic",
          noteAr: note,
        });
        setDraft((d) => (d ? { ...d, status: r.status } : d));
        setNotice(kind === "publish"
          ? "نُشرت — يراها المتعلّم الآن باسم الأكاديمية."
          : "أُعيدت إلى المدير الأكاديميّ مع ملاحظتك.");
        setNote("");
        await loadWork();
      }
      const h = await apiGet<{ history: HistoryRow[] }>(`/api/admin/authoring/${selected.moduleId}`);
      setHistory(h.history);
    } catch (e) {
      setNotice(e instanceof ApiError ? e.message : "تعذّر تنفيذ الإجراء");
    } finally { setBusy(""); }
  };

  const rows = useMemo(() => {
    const q = query.trim();
    if (!q) return work?.rows ?? [];
    return (work?.rows ?? []).filter((r) =>
      r.titleAr.includes(q) || r.courseTitleAr.includes(q) || r.courseId.includes(q));
  }, [work, query]);

  const isDraft = draft?.status === "draft";
  const isReview = draft?.status === "in_review";
  const isAwaitingFinal = draft?.status === "awaiting_final";

  return (
    <AdminLayout title="تأليف متون الوحدات">
      {work && (
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <Stat label="وحدات الكتالوج" value={work.total} />
          <Stat label="لها متن" value={work.withBody} tone="good" />
          <Stat label="بلا متن" value={work.missing} tone="warn" />
        </div>
      )}

      {error && (
        <p className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-xs leading-6 text-amber-200">{error}</p>
      )}

      <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
        {/* ── الطابور ── */}
        <aside className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Search className="h-4 w-4 shrink-0 text-white/40" />
            <input
              value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث بعنوان الوحدة أو الدورة"
              className="w-full rounded-lg border border-white/10 bg-transparent px-2.5 py-1.5 text-xs outline-none placeholder:text-white/30 focus:border-teal/50"
            />
          </div>
          {/* الدورةُ أوّلا — ثمّ وحداتُها تحتها بترتيبها */}
          <label className="mb-2.5 block text-[11px] font-bold text-white/50">
            الدورة
            <select
              value={courseId}
              onChange={(e) => { setCourseId(e.target.value); setSelected(null); setDraft(null); }}
              className="mt-1 w-full cursor-pointer rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white outline-none focus:border-teal/50 [&>option]:bg-surface"
            >
              <option value="">كلّ الدورات</option>
              {(work?.courses ?? []).map((c) => (
                <option key={c.courseId} value={c.courseId}>
                  {c.titleAr} — {c.withBody}/{c.total}
                </option>
              ))}
            </select>
          </label>

          <div className="mb-3 flex gap-1" role="group" aria-label="ترشيح بحال المتن">
            {BODY_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setBodyFilter(f.id)}
                aria-pressed={bodyFilter === f.id}
                className={`flex-1 cursor-pointer rounded-lg border px-2 py-1 text-[11px] font-bold transition ${
                  bodyFilter === f.id
                    ? "border-teal/60 bg-teal/15 text-teal-light-ink"
                    : "border-white/10 text-white/50 hover:border-white/25 hover:text-white/75"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="grid place-items-center py-10"><Loader2 className="h-5 w-5 animate-spin text-white/40" /></div>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-xs leading-6 text-white/50">
              {bodyFilter === "missing"
                ? "لا وحدةَ بلا متن هنا — اكتمل ما اخترتَه."
                : bodyFilter === "written"
                  ? "لا وحدةَ لها متنٌ بعد في هذا النطاق."
                  : "لا نتيجة لهذا البحث."}
            </p>
          ) : (
            <ul className="max-h-[34rem] space-y-1.5 overflow-y-auto pl-1">
              {rows.map((r) => (
                <li key={r.moduleId}>
                  <button
                    type="button" onClick={() => void open(r)}
                    className={`w-full rounded-xl border px-3 py-2.5 text-right transition ${
                      selected?.moduleId === r.moduleId
                        ? "border-teal/50 bg-teal/10"
                        : "border-white/10 bg-white/[0.02] hover:border-white/25"}`}
                  >
                    <span className="block text-xs font-bold leading-5">{r.titleAr}</span>
                    <span className="mt-0.5 block text-[10px] text-white/45">{r.courseTitleAr || r.courseId}</span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Chip on={r.hasBody} label="متن" />
                      <Chip on={r.hasChecks} label="تمرين" />
                      <Chip on={r.hasVideo} label="فيديو" />
                      <Chip on={r.hasScenario} label="سيناريو" />
                      <Chip on={r.hasPractice} label="نشاط" />
                      <Chip on={r.hasRubric} label="روبرك" />
                      {r.draftStatus && (
                        <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[9px] font-bold text-gold">
                          {STATUS_AR[r.draftStatus] ?? r.draftStatus}
                        </span>
                      )}
                      {r.learnersWaiting > 0 && (
                        <span className="flex items-center gap-1 rounded-full bg-teal/15 px-2 py-0.5 text-[9px] font-bold text-teal-ink">
                          <Users className="h-2.5 w-2.5" /> {r.learnersWaiting} ينتظر
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => void loadWork()} className="mt-3 flex items-center gap-1.5 text-[11px] text-white/50 hover:text-white/80">
            <RefreshCw className="h-3 w-3" /> تحديث الطابور
          </button>
        </aside>

        {/* ── المحرّر ── */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          {!selected ? (
            <p className="py-20 text-center text-sm leading-7 text-white/50">
              اختر وحدةً من الطابور لتبدأ.
              <br />
              <span className="text-xs text-white/35">الترتيب يضع من ينتظره متعلّمٌ مسجَّلٌ أوّلا.</span>
            </p>
          ) : !draft ? (
            <div className="grid place-items-center py-20"><Loader2 className="h-5 w-5 animate-spin text-white/40" /></div>
          ) : (
            <>
              <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <h2 className="text-sm font-black">{selected.titleAr}</h2>
                  <p className="mt-1 text-[11px] text-white/45">
                    {selected.courseTitleAr || selected.courseId} · إصدار {draft.version} ·{" "}
                    <span className={isReview ? "text-gold" : "text-white/60"}>{STATUS_AR[draft.status] ?? draft.status}</span>
                  </p>
                </div>
                <p className="max-w-xs rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] leading-5 text-white/50">
                  يُنشر باسم الأكاديمية — لا يظهر اسم كاتبه للمتعلّم.
                </p>
              </header>

              <nav className="mb-3 flex flex-wrap gap-1.5">
                {TABS.map((t) => {
                  const filled = Boolean((draft[t.field] as string | null)?.trim());
                  return (
                    <button
                      key={t.id} type="button" onClick={() => setTab(t.id)}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-bold transition ${
                        tab === t.id ? "border-teal/50 bg-teal/10 text-teal-ink" : "border-white/10 text-white/60 hover:border-white/25"}`}
                    >
                      <t.icon className="h-3.5 w-3.5" />
                      {t.label}
                      {filled && <CheckCircle2 className="h-3 w-3 text-teal" />}
                    </button>
                  );
                })}
              </nav>

              <div className="grid gap-4 xl:grid-cols-2">
                <div>
                  <textarea
                    dir="auto" value={value} onChange={(e) => setValue(e.target.value)}
                    readOnly={!isDraft}
                    placeholder={PLACEHOLDER[tab]}
                    rows={18}
                    className={`w-full rounded-xl border bg-black/20 p-3 font-mono text-xs leading-6 outline-none placeholder:text-white/25 ${
                      liveErrors.length > 0 ? "border-amber-400/50" : "border-white/10 focus:border-teal/50"} ${
                      isDraft ? "" : "opacity-60"}`}
                  />
                  {!isDraft && (
                    <p className="mt-2 text-[11px] leading-5 text-gold">
                      المسوّدة قيد المراجعة — اسحبها لتعديلها.
                    </p>
                  )}
                  {liveErrors.length > 0 && (
                    <ul className="mt-2 space-y-1 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
                      {liveErrors.map((e, i) => (
                        <li key={i} className="flex gap-2 text-[11px] leading-5 text-amber-200">
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {e}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black text-white/45">
                    <Eye className="h-3 w-3" /> كما يراه المتعلّم
                  </p>
                  <div className="max-h-[26rem] overflow-y-auto">
                    {!value.trim() ? (
                      <p className="py-10 text-center text-[11px] text-white/35">لا شيء بعد.</p>
                    ) : tab === "body" ? (
                      <LessonBody body={value} />
                    ) : liveErrors.length > 0 ? (
                      <p className="py-10 text-center text-[11px] leading-6 text-white/40">
                        تُعرض المعاينة حين تصحّ الصيغة.
                      </p>
                    ) : tab === "checks" ? (
                      <ModuleCheck raw={value} moduleId={`preview-${selected.moduleId}`} />
                    ) : tab === "video" ? (
                      <ModuleVideo raw={value} checksRaw={draft.checksAr} moduleId={`preview-${selected.moduleId}`} />
                    ) : tab === "practice" ? (
                      <PracticeActivity raw={value} moduleId={`preview-${selected.moduleId}`} />
                    ) : tab === "rubric" ? (
                      <RubricSelfReview raw={value} moduleId={`preview-${selected.moduleId}`} />
                    ) : (
                      <DecisionScenario raw={value} moduleId={`preview-${selected.moduleId}`} />
                    )}
                  </div>
                </div>
              </div>

              {notice && (
                <p className="mt-4 rounded-xl border border-teal/30 bg-teal/10 px-4 py-2.5 text-xs leading-6 text-teal-ink">{notice}</p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
                {isDraft && (
                  <>
                    <button
                      type="button" onClick={() => void act("save")} disabled={busy !== "" || liveErrors.length > 0}
                      className="flex items-center gap-1.5 rounded-lg bg-white/10 px-4 py-2 text-xs font-bold hover:bg-white/15 disabled:opacity-40"
                    >
                      {busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      حفظ المسوّدة
                    </button>
                    <button
                      type="button" onClick={() => void act("submit")}
                      disabled={busy !== "" || liveErrors.length > 0 || !draft.bodyAr?.trim()}
                      className="flex items-center gap-1.5 rounded-lg bg-teal px-4 py-2 text-xs font-black text-on-teal hover:brightness-110 disabled:opacity-40"
                    >
                      {busy === "submit" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      رفعٌ للمراجعة
                    </button>
                    {!draft.bodyAr?.trim() && (
                      <span className="text-[11px] text-white/40">لا تُرفع وحدةٌ بلا متن.</span>
                    )}
                  </>
                )}

                {isReview && (
                  <button
                    type="button" onClick={() => void act("withdraw")} disabled={busy !== ""}
                    className="flex items-center gap-1.5 rounded-lg bg-white/10 px-4 py-2 text-xs font-bold hover:bg-white/15 disabled:opacity-40"
                  >
                    <Undo2 className="h-3.5 w-3.5" /> سحبٌ للتعديل
                  </button>
                )}

                {/* ─────────── حلقتا القرار ───────────

                    كان زرٌّ واحد اسمُه «نشر» يملكه المديرُ الأكاديميّ، فالسلسلةُ
                    خطوتان: يكتب ويُنشر. وقرارُ صاحب المنصّة ثلاث — فصارت
                    الحلقةُ الوسطى تعتمد ولا تنشر، والأخيرةُ توقّع أو تُعيد. */}
                {isReview && canDecide && (
                  <div className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-gold/25 bg-gold/[0.05] p-3">
                    <p className="flex w-full items-center gap-1.5 text-[11px] font-black text-gold">
                      <ShieldCheck className="h-3.5 w-3.5" /> الاعتماد الأكاديميّ — ولا يعتمد أحدٌ ما كتبه
                    </p>
                    <input
                      value={note} onChange={(e) => setNote(e.target.value)}
                      placeholder="ما الذي يُعدَّل؟ (مطلوبٌ عند الإعادة)"
                      className="min-w-[16rem] flex-1 rounded-lg border border-white/10 bg-transparent px-3 py-1.5 text-xs outline-none placeholder:text-white/30 focus:border-gold/50"
                    />
                    <button
                      type="button" onClick={() => void act("approve")} disabled={busy !== ""}
                      className="rounded-lg bg-teal px-4 py-2 text-xs font-black text-on-teal hover:brightness-110 disabled:opacity-40"
                    >
                      اعتمِدها أكاديميّا
                    </button>
                    <button
                      type="button" onClick={() => void act("changes")} disabled={busy !== "" || note.trim().length < 5}
                      className="rounded-lg bg-white/10 px-4 py-2 text-xs font-bold hover:bg-white/15 disabled:opacity-40"
                    >
                      إعادةٌ إلى الكاتب مع ملاحظة
                    </button>
                    <p className="w-full text-[10.5px] leading-5 text-white/45">
                      الاعتمادُ لا ينشر — يرفعها إلى الموافقة النهائية، ولا يراها متعلّمٌ قبلها.
                    </p>
                  </div>
                )}

                {isAwaitingFinal && (
                  canFinalApprove ? (
                    <div className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-teal/30 bg-teal/[0.06] p-3">
                      <p className="flex w-full items-center gap-1.5 text-[11px] font-black text-teal-light-ink">
                        <ShieldCheck className="h-3.5 w-3.5" /> الموافقة النهائية — ولا يوقّعها كاتبُها ولا مَن اعتمدها أكاديميّا
                      </p>
                      <input
                        value={note} onChange={(e) => setNote(e.target.value)}
                        placeholder="سببُ الإعادة (مطلوبٌ عند الإعادة)"
                        className="min-w-[16rem] flex-1 rounded-lg border border-white/10 bg-transparent px-3 py-1.5 text-xs outline-none placeholder:text-white/30 focus:border-teal/50"
                      />
                      <button
                        type="button" onClick={() => void act("publish")} disabled={busy !== ""}
                        className="rounded-lg bg-teal px-4 py-2 text-xs font-black text-on-teal hover:brightness-110 disabled:opacity-40"
                      >
                        وافِق وانشر
                      </button>
                      <button
                        type="button" onClick={() => void act("return")} disabled={busy !== "" || note.trim().length < 5}
                        className="rounded-lg bg-white/10 px-4 py-2 text-xs font-bold hover:bg-white/15 disabled:opacity-40"
                      >
                        أعِدها للمدير الأكاديميّ
                      </button>
                    </div>
                  ) : (
                    <p className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[11px] leading-6 text-white/55">
                      اعتُمدت أكاديميّا وتنتظر الموافقة النهائية — وهي بحبّةِ صلاحيةٍ لا يملكها حسابك.
                    </p>
                  )
                )}
              </div>

              {history.length > 0 && (
                <details className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <summary className="cursor-pointer text-[11px] font-black text-white/60">
                    سجلّ الإصدارات ({history.length})
                  </summary>
                  <ul className="mt-3 space-y-2">
                    {history.map((h) => (
                      <li key={h.id} className="rounded-lg border border-white/10 px-3 py-2">
                        <p className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="font-black">إصدار {h.version}</span>
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px]">{STATUS_AR[h.status] ?? h.status}</span>
                          <span className="text-white/40">{fmtShortDateTimeAr(h.reviewedAt ?? h.submittedAt ?? h.createdAt)}</span>
                          <span className="text-white/35">{fmtNum(h.bodyAr?.length ?? 0)} حرفا</span>
                        </p>
                        {h.reviewNoteAr && (
                          <p className="mt-1 text-[11px] leading-5 text-gold/80">ملاحظة المراجع: {h.reviewNoteAr}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "good" | "warn" }) {
  const color = tone === "good" ? "text-teal-ink" : tone === "warn" ? "text-gold" : "text-white";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <p className="text-[11px] text-white/50">{label}</p>
      <p className={`mt-1 text-2xl font-black tabular-nums ${color}`}>{fmtNum(value)}</p>
    </div>
  );
}

function Chip({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
      on ? "bg-teal/15 text-teal-ink" : "bg-white/[0.06] text-white/30"}`}>
      {label}
    </span>
  );
}
