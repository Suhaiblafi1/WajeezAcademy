/* لوحة إدارة الكتالوج — عدادات الحالات، استعراض الكيانات، إنشاء مسودات
   (مهارة/دورة/مسار)، تقديم طلبات تغيير، وقرارات maker-checker */
import { useCallback, useEffect, useState } from "react";
import {
  BookMarked, CheckCircle2, ChevronDown, FilePlus2, GitPullRequest, Layers,
  Loader2, Plus, RefreshCw, Route, Trash2, XCircle,
} from "lucide-react";
import AdminLayout from "./AdminLayout";
import { apiGet, apiPost, ApiError } from "@/services/api";
import SkillPicker from "@/components/SkillPicker";
import type { SkillMeasureState } from "@/application/catalog/skill-measurement";
import { toast } from "@/components/Toast";
import PathwayWizard from "@/components/PathwayWizard";
import { fmtDateTime } from "@/application/text/format-ar";

type Overview = {
  pathways: Record<string, number>; courses: Record<string, number>; skills: Record<string, number>
  templates: Record<string, number>; questions: Record<string, number>; changeRequests: Record<string, number>
};
type ChangeRequest = {
  id: string; entityType: string; entityId: string; status: string; createdAt: string
  decisions: { decision: string; noteAr: string | null; createdAt: string }[]
};
type PathwayRow = { id: string; status: string; title: string; courseCount: number };
type CourseRow = { id: string; status: string; title: string; hours: number; skillCount: number; pathways: string[] };
type SkillRow = {
  id: string; status: string; slug: string; nameAr: string; familyId: string | null;
  /* ب-٤: حالة القياس من الخادم — تُحسب من المحرك لا من عمود في القاعدة */
  measureState?: SkillMeasureState; measuredBy?: string | null; measureNoteAr?: string;
};
type QuestionRow = { id: string; status: string; active: boolean; module: string; text: string; optionCount: number };
type TemplateRow = { id: string; status: string; name: string; courseCount: number };

const STATUS_AR: Record<string, string> = {
  draft: "مسودة", approved: "معتمد", published: "منشور", in_review: "قيد المراجعة",
  changes_requested: "مطلوب تعديل", rejected: "مرفوض", applied: "مطبق", superseded: "تجاوزه إصدار أحدث",
  pending_academic_review: "بانتظار مراجعة أكاديمية",
};

const ENTITY_AR: Record<string, string> = {
  pathway: "مسار", course: "دورة", skill: "مهارة", question: "سؤال", template: "قالب توصية",
};

function Pill({ v }: { v: string }) {
  const color = v === "published" || v === "approved" || v === "applied" ? "text-emerald-300 border-emerald-400/30"
    : v === "draft" ? "text-amber-300 border-amber-400/30" : "text-white/60 border-white/15";
  return <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${color}`}>{STATUS_AR[v] ?? v}</span>;
}

const inputCls = "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-[#FABC05]/60";
const selectCls = `${inputCls} [&>option]:bg-surface`;

export default function CatalogAdmin() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [crs, setCrs] = useState<ChangeRequest[]>([]);
  const [pathways, setPathways] = useState<PathwayRow[]>([]);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [browse, setBrowse] = useState<"pathways" | "courses" | "skills" | "questions" | "templates" | null>(null);

  const [skillForm, setSkillForm] = useState({ id: "", slug: "", nameAr: "", familyId: "" });
  const [courseForm, setCourseForm] = useState({
    id: "", pathwayId: "", sequence: "1", titleAr: "", shortPromiseAr: "", levelAr: "",
    totalHours: "", skillIds: [] as string[],
  });
  const [modules, setModules] = useState([{ titleAr: "", outcomeAr: "", activityAr: "", artifactAr: "", bodyAr: "", checksAr: "", videoAr: "", scenarioAr: "", hours: "" }]);
  const [crForm, setCrForm] = useState({ entityType: "course", entityId: "", payload: '{\n  "titleAr": "الاسم الجديد"\n}' });
  const [openForm, setOpenForm] = useState<"skill" | "course" | "pathway" | "cr" | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [ov, crList, pw, co, sk, qs, tp] = await Promise.all([
        apiGet<Overview>("/api/admin/catalog/overview"),
        apiGet<ChangeRequest[]>("/api/admin/catalog/change-requests"),
        apiGet<PathwayRow[]>("/api/admin/catalog/pathways"),
        apiGet<CourseRow[]>("/api/admin/catalog/courses"),
        apiGet<SkillRow[]>("/api/admin/catalog/skills"),
        apiGet<QuestionRow[]>("/api/admin/catalog/questions"),
        apiGet<TemplateRow[]>("/api/admin/catalog/templates"),
      ]);
      setOverview(ov); setCrs(crList); setPathways(pw); setCourses(co); setSkills(sk);
      setQuestions(qs); setTemplates(tp);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "تعذر الاتصال بخادم API — شغّله بـ npm run api:dev");
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const act = async (fn: () => Promise<unknown>, doneMsg = "تم التنفيذ") => {
    setBusy(true); setError(null);
    try { await fn(); await refresh(); toast(doneMsg); } catch (e) { setError(e instanceof ApiError ? e.message : "فشل الإجراء"); }
    finally { setBusy(false); }
  };

  const toggleId = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  /* ب-٤: طلب مهارة غير موجودة يمرّ بالمراجعة (maker-checker) لا يُنشأ صامتا —
     فلا يحشر المؤلّف مهارة قريبة خاطئة لأن الصحيحة غير موجودة. */
  const requestSkill = async (input: { slug: string; nameAr: string; reasonAr: string }) => {
    await apiPost("/api/admin/catalog/change-requests", {
      entityType: "skill",
      entityId: input.slug,
      payload: { kind: "skill_request", slug: input.slug, nameAr: input.nameAr, reasonAr: input.reasonAr },
    });
    toast("قُدّم طلب المهارة للمراجعة");
  };

  const submitCourse = () => act(async () => {
    await apiPost("/api/admin/catalog/courses", {
      id: courseForm.id.trim(),
      pathwayId: courseForm.pathwayId,
      sequence: Number(courseForm.sequence) || 1,
      titleAr: courseForm.titleAr.trim(),
      shortPromiseAr: courseForm.shortPromiseAr.trim() || undefined,
      levelAr: courseForm.levelAr.trim() || undefined,
      totalHours: Number(courseForm.totalHours),
      skillIds: courseForm.skillIds,
      modules: modules.map((m, i) => ({
        sequence: i + 1, titleAr: m.titleAr.trim(),
        outcomeAr: m.outcomeAr.trim() || undefined,
        activityAr: m.activityAr.trim() || undefined,
        artifactAr: m.artifactAr.trim() || undefined,
        bodyAr: m.bodyAr.trim() || undefined,
        checksAr: m.checksAr.trim() || undefined,
        videoAr: m.videoAr.trim() || undefined,
        scenarioAr: m.scenarioAr.trim() || undefined,
        hours: Number(m.hours) || 1,
      })),
    });
    setCourseForm({ id: "", pathwayId: "", sequence: "1", titleAr: "", shortPromiseAr: "", levelAr: "", totalHours: "", skillIds: [] });
    setModules([{ titleAr: "", outcomeAr: "", activityAr: "", artifactAr: "", bodyAr: "", checksAr: "", videoAr: "", scenarioAr: "", hours: "" }]);
    setOpenForm(null);
  }, "أُنشئت الدورة كمسودة مرتبطة بالمسار والمهارات — أكمل سير الاعتماد ثم النشر");

  const submitChangeRequest = () => act(async () => {
    let payload: Record<string, unknown>;
    try { payload = JSON.parse(crForm.payload) as Record<string, unknown>; }
    catch { setError("صيغة JSON غير صالحة في حقل التعديلات"); return; }
    await apiPost("/api/admin/catalog/change-requests", {
      entityType: crForm.entityType, entityId: crForm.entityId.trim(), payload,
    });
    setCrForm({ ...crForm, entityId: "" });
    setOpenForm(null);
  }, "قُدم طلب التغيير — ينتظر اعتماد مراجع آخر (maker-checker)");

  const courseValid = courseForm.id.trim().length >= 3 && courseForm.pathwayId && courseForm.titleAr.trim().length >= 3
    && Number(courseForm.totalHours) >= 1 && modules.every((m) => m.titleAr.trim().length >= 3);

  const FormHead = ({ id, icon: Icon, title, hint }: { id: typeof openForm & string; icon: typeof FilePlus2; title: string; hint: string }) => (
    <button onClick={() => setOpenForm(openForm === id ? null : id)}
      className="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-right transition hover:border-gold/40">
      <span className="flex items-center gap-2 text-lg font-black"><Icon className="h-5 w-5 text-gold-ink" /> {title}</span>
      <span className="flex items-center gap-3">
        <span className="hidden text-[11px] text-white/50 sm:inline">{hint}</span>
        <ChevronDown className={`h-4 w-4 text-white/50 transition ${openForm === id ? "rotate-180" : ""}`} />
      </span>
    </button>
  );

  return (
    <AdminLayout title="إدارة الكتالوج الأكاديمي">
      {error && <p className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}

      {overview && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {([["المسارات", overview.pathways], ["الدورات", overview.courses], ["المهارات", overview.skills],
             ["القوالب", overview.templates], ["الأسئلة", overview.questions], ["طلبات التغيير", overview.changeRequests]] as const).map(([label, bag]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-bold text-white/50">{label}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(bag).map(([s, n]) => (
                  <span key={s} className="text-[11px] text-white/75">{n} <Pill v={s} /></span>
                ))}
                {Object.keys(bag).length === 0 && <span className="text-[11px] text-white/55">لا شيء بعد</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* استعراض الكيانات */}
      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-lg font-black"><Layers className="h-5 w-5 text-gold-ink" /> الكيانات الحالية</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {([["pathways", `المسارات (${pathways.length})`], ["courses", `الدورات (${courses.length})`], ["skills", `المهارات (${skills.length})`], ["questions", `بنك الأسئلة (${questions.length})`], ["templates", `قوالب التوصية (${templates.length})`]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setBrowse(browse === k ? null : k)}
              className={`cursor-pointer rounded-full border px-4 py-1.5 text-xs font-bold transition ${browse === k ? "border-gold bg-gold/10 text-gold-ink" : "border-white/15 text-white/60 hover:border-white/40"}`}>
              {label}
            </button>
          ))}
        </div>
        {browse === "pathways" && (
          <ul className="mt-3 space-y-2">
            {pathways.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5 text-sm">
                <span className="font-mono text-[11px] text-white/55" dir="ltr">{p.id}</span>
                <span className="font-bold">{p.title}</span>
                <span className="text-[11px] text-white/50">{p.courseCount} دورة</span>
                <span className="mr-auto"><Pill v={p.status} /></span>
              </li>
            ))}
            {pathways.length === 0 && <p className="text-sm text-white/45">لا مسارات بعد.</p>}
          </ul>
        )}
        {browse === "courses" && (
          <ul className="mt-3 space-y-2">
            {courses.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5 text-sm">
                <span className="font-mono text-[11px] text-white/55" dir="ltr">{c.id}</span>
                <span className="font-bold">{c.title}</span>
                <span className="text-[11px] text-white/50">{c.hours} ساعة · {c.skillCount} مهارة · {c.pathways.join("، ") || "بلا مسار"}</span>
                <span className="mr-auto"><Pill v={c.status} /></span>
              </li>
            ))}
            {courses.length === 0 && <p className="text-sm text-white/45">لا دورات بعد.</p>}
          </ul>
        )}
        {browse === "skills" && (
          <>
            {/* ب-٤: الحصيلة أولا — «كم مهارة تُقاس فعلا» هو السؤال الذي يخفيه جدول من ٣٠٥ صفوف */}
            <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[11px] leading-6 text-white/70">
              {skills.filter((s) => s.measureState === "measured").length} مقيسة ·{" "}
              {skills.filter((s) => s.measureState === "registered_unmeasured").length} مسجَّلة بلا سؤال ·{" "}
              {skills.filter((s) => s.measureState === "inactive").length} موقوفة تشخيصيا · من {skills.length}
              <span className="text-white/45"> — غير المقيسة تدخل مقام تغطية القياس ولا تُقاس أبدا.</span>
            </p>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {skills.map((s) => (
                <li key={s.id} className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-mono text-[11px] text-white/55" dir="ltr">{s.id}</span>
                    <span className="min-w-0 flex-1 truncate font-bold">{s.nameAr}</span>
                    <Pill v={s.status} />
                  </div>
                  {s.measureNoteAr && (
                    <p className={`mt-1 text-[10px] ${s.measureState === "measured" ? "text-teal-light-ink" : "text-white/50"}`}>
                      {s.measureNoteAr}
                    </p>
                  )}
                </li>
              ))}
              {skills.length === 0 && <p className="text-sm text-white/45">لا مهارات بعد.</p>}
            </ul>
          </>
        )}
        {browse === "questions" && (
          <ul className="mt-3 space-y-2">
            {questions.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5 text-sm">
                <span className="font-mono text-[11px] text-white/55" dir="ltr">{q.id}</span>
                <span className="min-w-0 flex-1 font-bold">{q.text || "—"}</span>
                <span className="text-[11px] text-white/50">{q.module} · {q.optionCount} خيار{!q.active && " · موقوف"}</span>
                <span className="mr-auto"><Pill v={q.status} /></span>
              </li>
            ))}
            {questions.length === 0 && <p className="text-sm text-white/45">لا أسئلة بعد.</p>}
          </ul>
        )}
        {browse === "templates" && (
          <ul className="mt-3 space-y-2">
            {templates.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5 text-sm">
                <span className="font-mono text-[11px] text-white/55" dir="ltr">{t.id}</span>
                <span className="font-bold">{t.name || "—"}</span>
                <span className="text-[11px] text-white/50">{t.courseCount} دورة مركبة</span>
                <span className="mr-auto"><Pill v={t.status} /></span>
              </li>
            ))}
            {templates.length === 0 && <p className="text-sm text-white/45">لا قوالب بعد.</p>}
          </ul>
        )}
      </section>

      {/* نماذج الإنشاء */}
      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-black">إنشاء وتعديل — كلها مسودات تمر بسير الاعتماد</h2>

        <FormHead id="course" icon={BookMarked} title="دورة جديدة (مسودة)" hint="تُربط بمسار ومهارات وتُبنى من وحدات" />
        {openForm === "course" && (
          <div className="rounded-2xl border border-gold/20 bg-white/[0.02] p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <input value={courseForm.id} onChange={(e) => setCourseForm({ ...courseForm, id: e.target.value })} placeholder="المعرف — CRS-XXX-000" dir="ltr" className={inputCls} />
              <select value={courseForm.pathwayId} onChange={(e) => setCourseForm({ ...courseForm, pathwayId: e.target.value })} className={selectCls}>
                <option value="">المسار الأم…</option>
                {pathways.map((p) => <option key={p.id} value={p.id}>{p.title} ({p.id})</option>)}
              </select>
              <input value={courseForm.sequence} onChange={(e) => setCourseForm({ ...courseForm, sequence: e.target.value })} type="number" min={1} placeholder="الترتيب في المسار" className={inputCls} />
              <input value={courseForm.titleAr} onChange={(e) => setCourseForm({ ...courseForm, titleAr: e.target.value })} placeholder="اسم الدورة" className={`${inputCls} sm:col-span-2`} />
              <input value={courseForm.totalHours} onChange={(e) => setCourseForm({ ...courseForm, totalHours: e.target.value })} type="number" min={1} placeholder="إجمالي الساعات" className={inputCls} />
              <input value={courseForm.shortPromiseAr} onChange={(e) => setCourseForm({ ...courseForm, shortPromiseAr: e.target.value })} placeholder="الوعد المختصر (اختياري)" className={`${inputCls} sm:col-span-2`} />
              <input value={courseForm.levelAr} onChange={(e) => setCourseForm({ ...courseForm, levelAr: e.target.value })} placeholder="المستوى (اختياري)" className={inputCls} />
            </div>

            {/* البند ب-٤: منتقٍ ببحث وحالة قياس وتحذيرات حيّة — بديل رقائق ٣٠٥ مهارة الصامتة */}
            <SkillPicker
              className="mt-4"
              skills={skills}
              selectedIds={courseForm.skillIds}
              onToggle={(id) => setCourseForm({ ...courseForm, skillIds: toggleId(courseForm.skillIds, id) })}
              onRequestSkill={requestSkill}
            />

            <p className="mt-4 mb-2 text-xs font-black text-white/60">الوحدات ({modules.length})</p>
            <div className="space-y-3">
              {modules.map((m, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-white/50">الوحدة {i + 1}</span>
                    {modules.length > 1 && (
                      <button type="button" onClick={() => setModules(modules.filter((_, j) => j !== i))} className="cursor-pointer text-white/40 hover:text-red-300">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <input value={m.titleAr} onChange={(e) => setModules(modules.map((x, j) => (j === i ? { ...x, titleAr: e.target.value } : x)))} placeholder="عنوان الوحدة" className={inputCls} />
                    <input value={m.hours} onChange={(e) => setModules(modules.map((x, j) => (j === i ? { ...x, hours: e.target.value } : x)))} type="number" min={1} placeholder="الساعات" className={inputCls} />
                    <input value={m.outcomeAr} onChange={(e) => setModules(modules.map((x, j) => (j === i ? { ...x, outcomeAr: e.target.value } : x)))} placeholder="المخرج (اختياري)" className={inputCls} />
                    <input value={m.activityAr} onChange={(e) => setModules(modules.map((x, j) => (j === i ? { ...x, activityAr: e.target.value } : x)))} placeholder="النشاط (اختياري)" className={inputCls} />
                    <input value={m.artifactAr} onChange={(e) => setModules(modules.map((x, j) => (j === i ? { ...x, artifactAr: e.target.value } : x)))} placeholder="الأثر/التسليمة (اختياري)" className={inputCls} />
                  </div>
                  {/* البند ح-١: متن الدرس — Markdown مقيّد يقرؤه المتعلم داخل المنصة */}
                  <textarea
                    value={m.bodyAr}
                    onChange={(e) => setModules(modules.map((x, j) => (j === i ? { ...x, bodyAr: e.target.value } : x)))}
                    rows={6}
                    placeholder="متن الدرس (اختياري) — # عنوان · - قائمة · > اقتباس · **عريض** · [نص](رابط) · ```كود```"
                    className={`${inputCls} mt-2 w-full font-mono leading-7`}
                  />
                  <p className="mt-1 text-[10px] leading-5 text-white/50">
                    ما يُكتب هنا يظهر للمتعلم درسا داخل الدورة. يمرّ بنفس حاكمية النسخ والاعتماد والنشر — ولا يُعدَّل على إصدار منشور بأثر رجعي.
                  </p>
                  {/* البند ح-٣: تمرين استرجاع بعد الوحدة */}
                  <textarea
                    value={m.checksAr}
                    onChange={(e) => setModules(modules.map((x, j) => (j === i ? { ...x, checksAr: e.target.value } : x)))}
                    rows={5}
                    placeholder={"تمرين استرجاع (اختياري)\nس: نص السؤال\n- خيار\n+ الخيار الصحيح\nش: شرح الخطأ"}
                    className={`${inputCls} mt-2 w-full font-mono leading-7`}
                  />
                  <p className="mt-1 text-[10px] leading-5 text-white/50">
                    ثلاثة أسئلة كافية. علامة <span dir="ltr" className="font-mono">+</span> قبل الجواب الصحيح — واحد فقط لكل سؤال، والصيغة تُتحقَّق عند الحفظ.
                    ولربط سؤال بفصل فيديو أضف سطر <span dir="ltr" className="font-mono">ف: 2</span> داخله فيصير نقطة تفتيش بعد الفصل الثاني.
                  </p>
                  {/* البند ح-٢: فيديو الوحدة وفصوله */}
                  <textarea
                    value={m.videoAr}
                    onChange={(e) => setModules(modules.map((x, j) => (j === i ? { ...x, videoAr: e.target.value } : x)))}
                    rows={4}
                    placeholder={"فيديو الوحدة (اختياري)\nhttps://www.youtube.com/watch?v=…\n0:00 عنوان الفصل الأول\n2:30 عنوان الفصل الثاني"}
                    dir="ltr"
                    className={`${inputCls} mt-2 w-full font-mono leading-7`}
                  />
                  <p className="mt-1 text-[10px] leading-5 text-white/50">
                    السطر الأول رابط YouTube أو Vimeo عبر https — لا مضيف آخر. ثم سطر لكل فصل بصيغة «د:ث عنوان الفصل».
                  </p>
                  {/* البند ح-٥: سيناريو القرار المتفرّع */}
                  <textarea
                    value={m.scenarioAr}
                    onChange={(e) => setModules(modules.map((x, j) => (j === i ? { ...x, scenarioAr: e.target.value } : x)))}
                    rows={8}
                    placeholder={"سيناريو قرار (اختياري)\nموقف: وصف الموقف المهني\n\nعقدة: البداية\nنص: ما أول ما تفعله؟\n> خيار: نص الخيار\n  أثر: ما ترتب عليه\n  إلى: عنوان العقدة التالية\n\nعقدة: عنوان العقدة التالية\nنص: النتيجة\nتأمل: سؤال التأمل"}
                    className={`${inputCls} mt-2 w-full font-mono leading-7`}
                  />
                  <p className="mt-1 text-[10px] leading-5 text-white/50">
                    كل عقدة غير نهائية تحتاج خيارين على الأقل، و«إلى:» لا تشير إلا إلى عقدة موجودة،
                    والعقدة النهائية (بلا خيارات) تحتاج «تأمل:». يُتحقَّق المسار كاملا عند الحفظ:
                    عقدة لا تُبلَغ أو مسار يدور بلا نهاية يُرفض.
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => setModules([...modules, { titleAr: "", outcomeAr: "", activityAr: "", artifactAr: "", bodyAr: "", checksAr: "", videoAr: "", scenarioAr: "", hours: "" }])}
                className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-4 py-1.5 text-xs font-bold text-white/60 hover:border-white/40">
                <Plus className="h-3.5 w-3.5" /> وحدة إضافية
              </button>
              <button disabled={busy || !courseValid} onClick={submitCourse}
                className="flex cursor-pointer items-center gap-2 rounded-full bg-gold px-6 py-2 text-sm font-black text-on-gold disabled:opacity-40">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} إنشاء المسودة
              </button>
            </div>
          </div>
        )}

        <FormHead id="pathway" icon={Route} title="مسار جديد (مسودة)" hint="يربط دورات موجودة في رحلة واحدة" />
        {openForm === "pathway" && (
          /* ج-٣: معالج بخمس خطوات بدل نموذج مسطّح — النموذج المسطّح كان يقبل
             مسارا بلا جمهور أو بلا مجال، والنقص لا يظهر إلا في تدقيق لاحق. */
          <PathwayWizard
            courses={courses.map((c) => ({ id: c.id, title: c.title }))}
            onDone={() => { setOpenForm(null); void refresh(); }}
          />
        )}

        <FormHead id="skill" icon={FilePlus2} title="مهارة جديدة (مسودة)" hint="وحدة قياس المحرك التشخيصي" />
        {openForm === "skill" && (
          <div className="rounded-2xl border border-gold/20 bg-white/[0.02] p-5">
            <div className="grid gap-3 sm:grid-cols-4">
              {([["id", "SK-X-XXX-000"], ["slug", "skill_slug"], ["nameAr", "الاسم العربي"], ["familyId", "رمز العائلة (COG…)"]] as const).map(([k, ph]) => (
                <input key={k} value={skillForm[k]} onChange={(e) => setSkillForm({ ...skillForm, [k]: e.target.value })}
                  placeholder={ph} className={inputCls} />
              ))}
            </div>
            <button disabled={busy || !skillForm.id || !skillForm.slug || skillForm.nameAr.length < 2}
              onClick={() => act(async () => {
                await apiPost("/api/admin/catalog/skills", { ...skillForm, familyId: skillForm.familyId || undefined });
                setSkillForm({ id: "", slug: "", nameAr: "", familyId: "" });
              }, "أُنشئت المهارة كمسودة")}
              className="mt-4 cursor-pointer rounded-full bg-gold px-5 py-2 text-sm font-black text-on-gold disabled:opacity-40">
              إنشاء المسودة
            </button>
          </div>
        )}

        <FormHead id="cr" icon={GitPullRequest} title="طلب تعديل على كيان موجود" hint="المسميات والأهداف والروابط — لا يطبق قبل اعتماد مراجع آخر" />
        {openForm === "cr" && (
          <div className="rounded-2xl border border-gold/20 bg-white/[0.02] p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <select value={crForm.entityType} onChange={(e) => setCrForm({ ...crForm, entityType: e.target.value })} className={selectCls}>
                {Object.entries(ENTITY_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input value={crForm.entityId} onChange={(e) => setCrForm({ ...crForm, entityId: e.target.value })}
                placeholder="معرف الكيان — من قائمة الاستعراض أعلاه" dir="ltr" className={inputCls} />
            </div>
            <textarea value={crForm.payload} onChange={(e) => setCrForm({ ...crForm, payload: e.target.value })} rows={5}
              dir="ltr" className={`${inputCls} mt-3 font-mono text-xs`} />
            <p className="mt-2 text-[11px] text-white/50">
              أمثلة حقول: titleAr للاسم، objectives للأهداف، skillIds لربط المهارات — تُدمج في إصدار جديد بعد الاعتماد والنشر.
            </p>
            <button disabled={busy || !crForm.entityId.trim()} onClick={submitChangeRequest}
              className="mt-3 cursor-pointer rounded-full bg-gold px-6 py-2 text-sm font-black text-on-gold disabled:opacity-40">
              تقديم الطلب
            </button>
          </div>
        )}
      </section>

      {/* طلبات التغيير */}
      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-lg font-black"><GitPullRequest className="h-5 w-5 text-gold-ink" /> طلبات التغيير</h2>
        <div className="mt-4 space-y-3">
          {crs.length === 0 && <p className="text-sm text-white/50">لا طلبات بعد.</p>}
          {crs.map((cr) => (
            <div key={cr.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div>
                <p className="font-bold text-sm">{ENTITY_AR[cr.entityType] ?? cr.entityType} · <span dir="ltr" className="font-mono text-xs">{cr.entityId}</span></p>
                <p className="mt-1 text-xs text-white/45">{fmtDateTime(new Date(cr.createdAt))} — {cr.decisions.length} قرار</p>
              </div>
              <div className="flex items-center gap-2">
                <Pill v={cr.status} />
                {cr.status === "in_review" && (
                  <>
                    <button disabled={busy} onClick={() => act(() => apiPost(`/api/admin/catalog/change-requests/${cr.id}/decision`, { decision: "approve" }), "اعتُمد الطلب")}
                      className="flex cursor-pointer items-center gap-1 rounded-full border border-emerald-400/40 px-3 py-1.5 text-xs font-bold text-emerald-300 disabled:opacity-40">
                      <CheckCircle2 className="h-3.5 w-3.5" /> اعتماد
                    </button>
                    <button disabled={busy} onClick={() => act(() => apiPost(`/api/admin/catalog/change-requests/${cr.id}/decision`, { decision: "request_changes", noteAr: "راجع التفاصيل" }), "طُلب تعديل")}
                      className="flex cursor-pointer items-center gap-1 rounded-full border border-amber-400/40 px-3 py-1.5 text-xs font-bold text-amber-300 disabled:opacity-40">
                      <XCircle className="h-3.5 w-3.5" /> طلب تعديل
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-white/50">
          <BookMarked className="h-3.5 w-3.5" /> maker-checker: لا يستطيع صانع الطلب اعتماده بنفسه — الخادم يرفض ذلك.
        </p>
      </section>

      <button onClick={() => void refresh()} className="mt-6 flex cursor-pointer items-center gap-1.5 text-xs text-white/50 hover:text-white">
        <RefreshCw className="h-3.5 w-3.5" /> تحديث
      </button>
    </AdminLayout>
  );
}
