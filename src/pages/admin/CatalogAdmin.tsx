/* لوحة إدارة الكتالوج — عدادات الحالات، استعراض الكيانات، إنشاء مسودات
   (مهارة/دورة/مسار)، تقديم طلبات تغيير، وقرارات maker-checker */
import { useCallback, useEffect, useState } from "react";
import {
  BookMarked, CheckCircle2, ChevronDown, FilePlus2, GitPullRequest, Layers,
  RefreshCw, Route, XCircle,
} from "lucide-react";
import AdminLayout from "./AdminLayout";
import ListToolbar from "@/components/admin/ListToolbar";
import { matchesQuery } from "@/application/text/search-ar";
import { paginate } from "@/application/admin/paginate";
import { apiGet, apiPost, ApiError } from "@/services/api";
import type { SkillMeasureState } from "@/application/catalog/skill-measurement";
import { toast } from "@/components/Toast";
import PathwayWizard from "@/components/PathwayWizard";
import CourseWizard from "@/components/CourseWizard";
import { fmtDateTime } from "@/application/text/format-ar";

import { Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
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
    : v === "draft" ? "text-amber-300 border-amber-400/30" : "text-muted-foreground border-white/15";
  return <span className={`rounded-full border px-2 py-0.5 text-micro font-bold ${color}`}>{STATUS_AR[v] ?? v}</span>;
}

const inputCls = "w-full rounded-xl border border-white/10 bg-paper/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/75 outline-none focus:border-[#FABC05]/60";
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
  /* فرزُ الكتالوج — قرارُ صاحب المنصّة: «طريقٌ أسهلُ لفرز الدورات».

     الكتالوجُ اليومَ ٨١ دورةً و٣٠٥ مهارةً ومئاتُ الأسئلة، وكانت تُسرد قوائمَ
     مسطّحةً بلا بحثٍ ولا ترشيح: من أراد دورةً بعينها مرّرها بعينه، ومن أراد
     «ما بقي مسوّدةً في مسار القيادة» لم يكن له طريق. */
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [statusPick, setStatusPick] = useState("");
  const [pathPick, setPathPick] = useState("");

  const [skillForm, setSkillForm] = useState({ id: "", slug: "", nameAr: "", familyId: "" });
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

  /* لا يُطلب معرّفٌ يُنسخ من قائمةٍ أعلاه — يُختار بالاسم من هنا مباشرة */
  const entityOptionsFor = (t: string): { id: string; label: string }[] => {
    if (t === "pathway") return pathways.map((p) => ({ id: p.id, label: p.title }));
    if (t === "course") return courses.map((c) => ({ id: c.id, label: c.title }));
    if (t === "skill") return skills.map((s) => ({ id: s.id, label: s.nameAr }));
    if (t === "question") return questions.map((qq) => ({ id: qq.id, label: qq.text || qq.id }));
    return templates.map((t2) => ({ id: t2.id, label: t2.name }));
  };

  const FormHead = ({ id, icon: Icon, title, hint }: { id: typeof openForm & string; icon: typeof FilePlus2; title: string; hint: string }) => (
    <button onClick={() => setOpenForm(openForm === id ? null : id)}
      className="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-right transition hover:border-gold/40">
      <span className="flex items-center gap-2 text-lg font-black"><Icon className="h-5 w-5 text-gold-ink" /> {title}</span>
      <span className="flex items-center gap-3">
        <span className="hidden text-micro text-muted-foreground sm:inline">{hint}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${openForm === id ? "rotate-180" : ""}`} />
      </span>
    </button>
  );

    /* لكلّ قائمةٍ مرشِّحاتُها، والترقيمُ واحد. والحالاتُ من الصفوف نفسِها
     فلا تُعرض حالةٌ لا وجودَ لها في القائمة المعروضة. */
  const statusesOf = (rows: { status: string }[]) => [...new Set(rows.map((r) => r.status))];

  const pathwayView = paginate(
    pathways.filter((p) => (!statusPick || p.status === statusPick) && matchesQuery(q, [p.id, p.title])),
    page, 25);
  const courseView = paginate(
    courses.filter((c) => (!statusPick || c.status === statusPick)
      && (!pathPick || c.pathways.includes(pathPick))
      && matchesQuery(q, [c.id, c.title, ...c.pathways])),
    page, 25);
  const skillView = paginate(
    skills.filter((s2) => (!statusPick || s2.status === statusPick) && matchesQuery(q, [s2.id, s2.slug, s2.nameAr, s2.familyId])),
    page, 25);
  const questionView = paginate(
    questions.filter((qq) => (!statusPick || qq.status === statusPick) && matchesQuery(q, [qq.id, qq.text, qq.module])),
    page, 25);
  const templateView = paginate(
    templates.filter((t) => (!statusPick || t.status === statusPick) && matchesQuery(q, [t.id, t.name])),
    page, 25);

  /* مسارٌ واحدٌ لكلّ مرشِّحٍ يُعرض — فلا يُنسى ترشيحٌ ظاهرٌ على قائمةٍ لا تعنيه */
  const browseUi = browse === null ? null
    : browse === "pathways" ? { view: pathwayView, rows: pathways, unit: "مسارا", ph: "ابحث بمعرّفٍ أو عنوان…" }
    : browse === "courses" ? { view: courseView, rows: courses, unit: "دورة", ph: "ابحث بمعرّفٍ أو عنوانٍ أو مسار…" }
    : browse === "skills" ? { view: skillView, rows: skills, unit: "مهارة", ph: "ابحث بمعرّفٍ أو اسمٍ أو عائلة…" }
    : browse === "questions" ? { view: questionView, rows: questions, unit: "سؤالا", ph: "ابحث بنصّ السؤال أو الوحدة…" }
    : { view: templateView, rows: templates, unit: "قالبا", ph: "ابحث بمعرّفٍ أو اسم…" };

  return (
    <AdminLayout title="إدارة الكتالوج الأكاديمي">
      {error && <Inset as="p" tone="danger" className="mb-4 px-4 py-3 text-sm text-red-200">{error}</Inset>}

      {overview && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {([["المسارات", overview.pathways], ["الدورات", overview.courses], ["المهارات", overview.skills],
             ["القوالب", overview.templates], ["الأسئلة", overview.questions], ["طلبات التغيير", overview.changeRequests]] as const).map(([label, bag]) => (
            <Card key={label}>
              <p className="text-xs font-bold text-muted-foreground">{label}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(bag).map(([s, n]) => (
                  <span key={s} className="text-micro text-foreground">{n} <Pill v={s} /></span>
                ))}
                {Object.keys(bag).length === 0 && <span className="text-micro text-muted-foreground">لا شيء بعد</span>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* استعراض الكيانات */}
      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-lg font-black"><Layers className="h-5 w-5 text-gold-ink" /> الكيانات الحالية</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {([["pathways", `المسارات (${pathways.length})`], ["courses", `الدورات (${courses.length})`], ["skills", `المهارات (${skills.length})`], ["questions", `بنك الأسئلة (${questions.length})`], ["templates", `قوالب التوصية (${templates.length})`]] as const).map(([k, label]) => (
            <button key={k} onClick={() => { setBrowse(browse === k ? null : k); setQ(""); setPage(1); setStatusPick(""); setPathPick(""); }}
              className={`cursor-pointer rounded-full border px-4 py-1.5 text-xs font-bold transition ${browse === k ? "border-gold bg-gold/10 text-gold-ink" : "border-white/15 text-muted-foreground hover:border-white/40"}`}>
              {label}
            </button>
          ))}
        </div>

        {browseUi && browseUi.rows.length > 0 && (
          <div className="mt-4">
            <div className="mb-3 flex flex-wrap gap-2">
              <select value={statusPick} onChange={(e) => { setStatusPick(e.target.value); setPage(1); }}
                aria-label="رشِّح بالحالة"
                className="rounded-xl border border-white/12 bg-paper/30 px-3 py-2 text-xs text-foreground focus:border-gold focus:outline-none [&>option]:bg-surface">
                <option value="">كلّ الحالات</option>
                {statusesOf(browseUi.rows).map((st) => <option key={st} value={st}>{STATUS_AR[st] ?? st}</option>)}
              </select>
              {browse === "courses" && (
                <select value={pathPick} onChange={(e) => { setPathPick(e.target.value); setPage(1); }}
                  aria-label="رشِّح بالمسار"
                  className="rounded-xl border border-white/12 bg-paper/30 px-3 py-2 text-xs text-foreground focus:border-gold focus:outline-none [&>option]:bg-surface">
                  <option value="">كلّ المسارات</option>
                  {[...new Set(courses.flatMap((c) => c.pathways))].sort().map((pw) => <option key={pw} value={pw}>{pw}</option>)}
                </select>
              )}
            </div>
            <ListToolbar q={q} onQ={setQ} onPage={setPage} view={browseUi.view} unit={browseUi.unit} placeholder={browseUi.ph} />
            {browseUi.view.total === 0 && (
              <Card as="p" className="py-10 text-center text-sm text-muted-foreground">
                لا نتيجة بهذا الفرز — وسّعه أو امسح البحث.
              </Card>
            )}
          </div>
        )}

        {browse === "pathways" && (
          <ul className="mt-3 space-y-2">
            {pathwayView.rows.map((p) => (
              <Inset as="li" key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                <span className="font-mono text-micro text-muted-foreground" dir="ltr">{p.id}</span>
                <span className="font-bold">{p.title}</span>
                <span className="text-micro text-muted-foreground">{p.courseCount} دورة</span>
                <span className="mr-auto"><Pill v={p.status} /></span>
              </Inset>
            ))}
            {pathways.length === 0 && <p className="text-sm text-muted-foreground">لا مسارات بعد.</p>}
          </ul>
        )}
        {browse === "courses" && (
          <ul className="mt-3 space-y-2">
            {courseView.rows.map((c) => (
              <Inset as="li" key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                <span className="font-mono text-micro text-muted-foreground" dir="ltr">{c.id}</span>
                <span className="font-bold">{c.title}</span>
                <span className="text-micro text-muted-foreground">{c.hours} ساعة · {c.skillCount} مهارة · {c.pathways.join("، ") || "بلا مسار"}</span>
                <span className="mr-auto"><Pill v={c.status} /></span>
              </Inset>
            ))}
            {courses.length === 0 && <p className="text-sm text-muted-foreground">لا دورات بعد.</p>}
          </ul>
        )}
        {browse === "skills" && (
          <>
            {/* ب-٤: الحصيلة أولا — «كم مهارة تُقاس فعلا» هو السؤال الذي يخفيه جدول من ٣٠٥ صفوف */}
            <Card as="p" className="mt-3 px-4 py-3 text-micro leading-6 text-foreground">
              {skills.filter((s) => s.measureState === "measured").length} مقيسة ·{" "}
              {skills.filter((s) => s.measureState === "registered_unmeasured").length} مسجَّلة بلا سؤال ·{" "}
              {skills.filter((s) => s.measureState === "inactive").length} موقوفة تشخيصيا · من {skills.length}
              <span className="text-muted-foreground"> — غير المقيسة تدخل مقام تغطية القياس ولا تُقاس أبدا.</span>
            </Card>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {skillView.rows.map((s) => (
                <Inset as="li" key={s.id} className="px-4 py-2.5">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-mono text-micro text-muted-foreground" dir="ltr">{s.id}</span>
                    <span className="min-w-0 flex-1 truncate font-bold">{s.nameAr}</span>
                    <Pill v={s.status} />
                  </div>
                  {s.measureNoteAr && (
                    <p className={`mt-1 text-micro ${s.measureState === "measured" ? "text-teal-light-ink" : "text-muted-foreground"}`}>
                      {s.measureNoteAr}
                    </p>
                  )}
                </Inset>
              ))}
              {skills.length === 0 && <p className="text-sm text-muted-foreground">لا مهارات بعد.</p>}
            </ul>
          </>
        )}
        {browse === "questions" && (
          <ul className="mt-3 space-y-2">
            {questionView.rows.map((qq) => (
              <Inset as="li" key={qq.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                <span className="font-mono text-micro text-muted-foreground" dir="ltr">{qq.id}</span>
                <span className="min-w-0 flex-1 font-bold">{qq.text || "—"}</span>
                <span className="text-micro text-muted-foreground">{qq.module} · {qq.optionCount} خيار{!qq.active && " · موقوف"}</span>
                <span className="mr-auto"><Pill v={qq.status} /></span>
              </Inset>
            ))}
            {questions.length === 0 && <p className="text-sm text-muted-foreground">لا أسئلة بعد.</p>}
          </ul>
        )}
        {browse === "templates" && (
          <ul className="mt-3 space-y-2">
            {templateView.rows.map((t) => (
              <Inset as="li" key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                <span className="font-mono text-micro text-muted-foreground" dir="ltr">{t.id}</span>
                <span className="font-bold">{t.name || "—"}</span>
                <span className="text-micro text-muted-foreground">{t.courseCount} دورة مركبة</span>
                <span className="mr-auto"><Pill v={t.status} /></span>
              </Inset>
            ))}
            {templates.length === 0 && <p className="text-sm text-muted-foreground">لا قوالب بعد.</p>}
          </ul>
        )}
      </section>

      {/* نماذج الإنشاء */}
      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-black">إنشاء وتعديل — كلها مسودات تمر بسير الاعتماد</h2>

        <FormHead id="course" icon={BookMarked} title="دورة جديدة (مسودة)" hint="أربع خطوات: الدورة، وحداتها، مهاراتها، مراجعة" />
        {openForm === "course" && (
          <CourseWizard
            pathways={pathways.map((p) => ({ id: p.id, title: p.title }))}
            skills={skills}
            onRequestSkill={requestSkill}
            onDone={() => { setOpenForm(null); void refresh(); }}
          />
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
          <Card className="border-gold/20">
            <div className="grid gap-3 sm:grid-cols-4">
              {([["id", "SK-X-XXX-000"], ["slug", "skill_slug"], ["nameAr", "الاسم العربي"], ["familyId", "رمز العائلة (COG…)"]] as const).map(([k, ph]) => (
                <input key={k} value={skillForm[k]} onChange={(e) => setSkillForm({ ...skillForm, [k]: e.target.value })}
                  placeholder={ph} className={inputCls} />
              ))}
            </div>
            <Button tone="primary" disabled={busy || !skillForm.id || !skillForm.slug || skillForm.nameAr.length < 2}
              onClick={() => act(async () => {
                await apiPost("/api/admin/catalog/skills", { ...skillForm, familyId: skillForm.familyId || undefined });
                setSkillForm({ id: "", slug: "", nameAr: "", familyId: "" });
              }, "أُنشئت المهارة كمسودة")} className="mt-4">
              إنشاء المسودة
            </Button>
          </Card>
        )}

        <FormHead id="cr" icon={GitPullRequest} title="طلب تعديل على كيان موجود" hint="المسميات والأهداف والروابط — لا يطبق قبل اعتماد مراجع آخر" />
        {openForm === "cr" && (
          <Card className="border-gold/20">
            <div className="grid gap-3 sm:grid-cols-2">
              <select value={crForm.entityType} onChange={(e) => setCrForm({ ...crForm, entityType: e.target.value, entityId: "" })} className={selectCls}>
                {Object.entries(ENTITY_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select value={crForm.entityId} onChange={(e) => setCrForm({ ...crForm, entityId: e.target.value })} className={selectCls}>
                <option value="">اختر {ENTITY_AR[crForm.entityType]}…</option>
                {entityOptionsFor(crForm.entityType).map((o) => <option key={o.id} value={o.id}>{o.label} ({o.id})</option>)}
              </select>
            </div>
            <textarea value={crForm.payload} onChange={(e) => setCrForm({ ...crForm, payload: e.target.value })} rows={5}
              dir="ltr" className={`${inputCls} mt-3 font-mono text-xs`} />
            <p className="mt-2 text-micro text-muted-foreground">
              أمثلة حقول: titleAr للاسم، objectives للأهداف، skillIds لربط المهارات — تُدمج في إصدار جديد بعد الاعتماد والنشر.
            </p>
            <Button tone="primary" disabled={busy || !crForm.entityId.trim()} onClick={submitChangeRequest} className="mt-3">
              تقديم الطلب
            </Button>
          </Card>
        )}
      </section>

      {/* طلبات التغيير */}
      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-lg font-black"><GitPullRequest className="h-5 w-5 text-gold-ink" /> طلبات التغيير</h2>
        <div className="mt-4 space-y-3">
          {crs.length === 0 && <p className="text-sm text-muted-foreground">لا طلبات بعد.</p>}
          {crs.map((cr) => (
            <Card key={cr.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-bold text-sm">{ENTITY_AR[cr.entityType] ?? cr.entityType} · <span dir="ltr" className="font-mono text-xs">{cr.entityId}</span></p>
                <p className="mt-1 text-xs text-muted-foreground">{fmtDateTime(new Date(cr.createdAt))} — {cr.decisions.length} قرار</p>
              </div>
              <div className="flex items-center gap-2">
                <Pill v={cr.status} />
                {cr.status === "in_review" && (
                  <>
                    <Button tone="secondary" size="sm" disabled={busy} onClick={() => act(() => apiPost(`/api/admin/catalog/change-requests/${cr.id}/decision`, { decision: "approve" }), "اعتُمد الطلب")}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> اعتماد
                    </Button>
                    <Button tone="secondary" size="sm" disabled={busy} onClick={() => act(() => apiPost(`/api/admin/catalog/change-requests/${cr.id}/decision`, { decision: "request_changes", noteAr: "راجع التفاصيل" }), "طُلب تعديل")}>
                      <XCircle className="h-3.5 w-3.5" /> طلب تعديل
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-micro text-muted-foreground">
          <BookMarked className="h-3.5 w-3.5" /> maker-checker: لا يستطيع صانع الطلب اعتماده بنفسه — الخادم يرفض ذلك.
        </p>
      </section>

      <button onClick={() => void refresh()} className="mt-6 flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <RefreshCw className="h-3.5 w-3.5" /> تحديث
      </button>
    </AdminLayout>
  );
}
