/* لوحة إدارة الكتالوج — عدادات الحالات، استعراض الكيانات واسمِ الدورة ومهاراتِها وترشيحِها، إنشاء مسودات
   (مهارة/دورة/مسار)، وطابور طلبات التغيير وقراراته (maker-checker) */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  ArrowRight, BookMarked, ChevronDown, FilePlus2, GitPullRequest, Layers, PenLine, RefreshCw, Route,
} from "lucide-react";
import AdminLayout from "./AdminLayout";
import ListToolbar from "@/components/admin/ListToolbar";
import WorkHeader from "@/components/admin/WorkHeader";
import { revealRow } from "@/components/admin/reveal";
import { matchesQuery } from "@/application/text/search-ar";
import { paginate } from "@/application/admin/paginate";
import { apiGet, apiPost, apiPut, ApiError } from "@/services/api";
import type { SkillMeasureState } from "@/application/catalog/skill-measurement";
import { changeRequestView, draftApprovalBody } from "@/application/catalog/change-request-view";
import { renameDoneAr, tidyCourseTitleAr } from "@/application/catalog/course-name-suggest";
import { toast } from "@/components/Toast";
import PathwayWizard from "@/components/PathwayWizard";
import CourseWizard from "@/components/CourseWizard";
import SkillPicker from "@/components/SkillPicker";
import CourseNamesPanel from "@/components/admin/CourseNamesPanel";
import ChangeRequestItem from "@/components/admin/ChangeRequestItem";
import DraftApproval from "@/components/admin/DraftApproval";
import { useRealSession } from "@/services/session";
import { safeAdminBack } from "@/application/trainer/idea-links";

import { Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
/* مجالاتُ التشخيص من مصدرها الواحد — ونسخةٌ في الشاشة تفترق عنه يوما،
   فتُعرض مجالاتٌ لا يعرفها المحرّكُ ويردّها الخادم. */
import { domainsV2 as DIAGNOSTIC_DOMAINS } from "@/domain/diagnostic/v2/data";
import { CAREER_STAGE_LABELS_AR } from "@/domain/diagnostic/v2_1/maps";
import { staffControlCls as inputCls } from "@/components/FormKit";
type Overview = {
  pathways: Record<string, number>; courses: Record<string, number>; skills: Record<string, number>
  templates: Record<string, number>; questions: Record<string, number>; changeRequests: Record<string, number>
};
type ChangeRequest = {
  id: string; entityType: string; entityId: string; status: string; createdAt: string
  payload?: Record<string, unknown> | null
  /* اسمُ ما يُطلب وحالتُه الآن — من الخادم (`listChangeRequests`) */
  entityLabelAr?: string | null; entityStatus?: string | null
  decisions: { decision: string; noteAr: string | null; createdAt: string }[]
};
type RenameResult = { applied: boolean; titleAr: string; published: boolean };

type PathwayRow = { id: string; status: string; title: string; courseCount: number };
type CourseRow = {
  id: string; status: string; title: string; hours: number; skillCount: number;
  skillIds: string[]; pathways: string[]; pathwayNames?: string[];
  /* ك-٥: دورةٌ قائمةٌ بنفسها تُرشَّح بمهاراتها — الرمزُ ومجالُه معا */
  recommendableDirectly?: boolean; diagnosticDomains?: string[]; diagnosticStages?: string[];
};
type SkillRow = {
  id: string; status: string; slug: string; nameAr: string; familyId: string | null;
  /* ب-٤: حالة القياس من الخادم — تُحسب من المحرك لا من عمود في القاعدة */
  measureState?: SkillMeasureState; measuredBy?: string | null; measureNoteAr?: string;
};
type QuestionRow = { id: string; status: string; active: boolean; module: string; text: string; optionCount: number };
type TemplateRow = { id: string; status: string; name: string; courseCount: number };

/* «١ طلبٌ» و«٢ طلبان» و«٣ طلبات» و«١١ طلبا» — والعددُ يُقرأ لا يُحسب */
const CR_FORMS = { one: "طلب تغيير", two: "طلبا تغيير", few: "طلبات تغيير", many: "طلب تغيير" };

const STATUS_AR: Record<string, string> = {
  draft: "مسودة", approved: "معتمد", published: "منشور", in_review: "قيد المراجعة",
  changes_requested: "مطلوب تعديل", rejected: "مرفوض", applied: "مطبق", superseded: "تجاوزه إصدار أحدث",
  pending_academic_review: "بانتظار مراجعة أكاديمية",
};

function Pill({ v }: { v: string }) {
  const color = v === "published" || v === "approved" || v === "applied" ? "text-emerald-300 border-emerald-400/30"
    : v === "draft" ? "text-amber-300 border-amber-400/30" : "text-muted-foreground border-white/15";
  return <span className={`rounded-full border px-2 py-0.5 text-fine font-bold ${color}`}>{STATUS_AR[v] ?? v}</span>;
}


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
  /* ك-٥: تحريرُ إذن الترشيح المستقلّ — مفتوحٌ لدورةٍ واحدةٍ في كلّ مرّة */
  const [soloFor, setSoloFor] = useState<string | null>(null);
  const [soloDomains, setSoloDomains] = useState<string[]>([]);
  const [soloStages, setSoloStages] = useState<string[]>([]);
  /* الصلاحيةُ لا الدور — والشاشةُ تُخفي ما لا يملكه، والخادمُ هو الحَكَم */
  const { user: me } = useRealSession();
  const canEditCourse = me?.permissions.includes("catalog.course.edit") ?? false;
  /* استثناءُ maker-checker — تُقرأ من الجلسة لا من اسم الدور: الحبّةُ تُمنح
     وتُنزع، والاسمُ لا يتبعها. والسطرُ أسفلَ الطابور يقول أيَّهما يحكمك،
     فلا يُكتشف الجوابُ بضغطِ زرٍّ يردّ ٤٠٣. */
  const canSelfApprove = me?.permissions.includes("catalog.self_approve") ?? false;
  /* والقرارُ في الطابور حبّةُ مساره نفسُها — والخادمُ هو الحَكَم */
  const canDecide = me?.permissions.includes("catalog.pathway.review") ?? false;
  /* ويقدّم المسودّةَ للاعتماد من يملك تأليفَ صنفها — حبّةُ باب إنشائه */
  const canSubmitDraft: Record<string, boolean> = {
    course: canEditCourse,
    skill: me?.permissions.includes("catalog.skill.edit") ?? false,
    question: me?.permissions.includes("diagnostic.question.edit") ?? false,
    pathway: me?.permissions.includes("catalog.pathway.create") ?? false,
  };
  /* اسمُ دورةٍ قائمة — لكلّ دورةٍ لا لما له شعبٌ وحدَه: كان صندوقُ JSON بابَ ما سواها */
  const [nameFor, setNameFor] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  /* ك-٣: محرِّرُ مهارات دورةٍ قائمة — مفتوحٌ لواحدةٍ في المرّة، ومسوّدتُه
     منفصلةٌ عن المحفوظ حتّى يُضغط الحفظ. */
  const [skillsFor, setSkillsFor] = useState<string | null>(null);
  const [skillDraft, setSkillDraft] = useState<string[]>([]);
  /* فرزُ الكتالوج — قرارُ صاحب المنصّة: «طريقٌ أسهلُ لفرز الدورات».

     الكتالوجُ اليومَ ٨١ دورةً و٣٠٥ مهارةً ومئاتُ الأسئلة، وكانت تُسرد قوائمَ
     مسطّحةً بلا بحثٍ ولا ترشيح: من أراد دورةً بعينها مرّرها بعينه، ومن أراد
     «ما بقي مسوّدةً في مسار القيادة» لم يكن له طريق. */
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [statusPick, setStatusPick] = useState("");
  const [pathPick, setPathPick] = useState("");

  const [skillForm, setSkillForm] = useState({ id: "", slug: "", nameAr: "", familyId: "" });
  const [openForm, setOpenForm] = useState<"names" | "skill" | "course" | "pathway" | null>(null);

  /* ═══ قادمٌ من اقتراحِ مدرّبٍ صُنِّف «دورةً جديدة» (ح-٤) ═══

     النموذجُ هنا هو النموذجُ الوحيد: مسارٌ وتسلسلٌ وساعاتٌ ومهاراتٌ ووحدات
     ومدقّقُ تمارين. وثانيةٌ أنحفُ منه في شاشة الطابور تتخلّف عنه بعد شهر.
     فيُفتَح هذا محمَّلا بعنوان الاقتراح، ويُربط ما أُنشئ بصاحبه عند التمام —
     فلا يُنسخ الرمزُ بيدٍ ولا يُنسى الربطُ فيبقى الاقتراحُ معلّقا. */
  const [params, setParams] = useSearchParams();
  const fromProposal = params.get("proposalId");
  const seedTitleAr = params.get("titleAr") ?? undefined;
  /* ويُقرَّر الاقتراحُ في ملفّ صاحبه (قرارُ «A»، ٢٦ أكتوبر ٢٠٢٦) — فيعود إليه بعد الربط، على الاقتراح نفسِه.
     والوجهةُ مسارٌ في الإدارة وحدَها (`safeAdminBack`): رابطٌ يحمل `back` لا يُحوِّل إلى خارجها */
  const backTo = safeAdminBack(params.get("back"));
  const navigate = useNavigate();
  useEffect(() => {
    if (fromProposal) setOpenForm("course");
  }, [fromProposal]);
  /* بندُ «اقتراحات أسماء لدورات» في «ما ينتظرك» يصل هنا ولوحُه مفتوح */
  const openNames = params.get("names") === "1";
  useEffect(() => {
    if (openNames) setOpenForm("names");
  }, [openNames]);
  /* وبندُ «تغييرات محتوى تنتظر مراجعة» يصل الطابورَ نفسَه (`?requests=1`) — بعد أن يُحمَّل، ومرّةً واحدة: كان يفتح
     «النشر» ولا طابورَ فيه */
  const openRequests = params.get("requests") === "1";
  const requestsShown = useRef(false);

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
      setError(e instanceof ApiError ? e.message : "تعذر تحميل الكتالوج");
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  /* والرسالةُ قد تُبنى ممّا ردّه الخادم — اسمٌ نُشر الآن أو ينتظر النشرَ التالي. ويقول إن نجح: المحرّرُ يُغلق
     بعد ما وقع لا بعد ما رُدّ */
  const act = async <T,>(fn: () => Promise<T>, doneMsg: string | ((out: T) => string) = "تم التنفيذ"): Promise<boolean> => {
    setBusy(true); setError(null);
    try {
      const out = await fn();
      await refresh();
      toast(typeof doneMsg === "function" ? doneMsg(out) : doneMsg);
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "فشل الإجراء");
      return false;
    } finally { setBusy(false); }
  };

  useEffect(() => {
    if (!openRequests || overview === null || requestsShown.current) return;
    requestsShown.current = true;
    revealRow("change-requests");
  }, [openRequests, overview]);

  /* المسودّةُ تُقدَّم من صفّها — كان بابُها صندوقَ JSON (`draftApprovalBody`) */
  const submitDraft = (entityType: string, entityId: string) => void act(
    () => apiPost("/api/admin/catalog/change-requests", draftApprovalBody(entityType, entityId)),
    "قدم للاعتماد — ينتظر مراجعا في «طلبات التغيير»",
  );

  /* القرارُ ورسالتُه — واسمٌ اعتُمد يقول أنُشر الآن أم ينتظر النشرَ التالي (`decide` يقول إن كتب اسما) */
  const decideCr = (cr: ChangeRequest, decision: "approve" | "reject") => {
    const renameTo = changeRequestView(cr).renameTo;
    void act(
      () => apiPost<{ renamed?: boolean; published?: boolean }>(`/api/admin/catalog/change-requests/${cr.id}/decision`, { decision }),
      (out) => decision === "reject" ? "رفض الطلب — لم يتغير شيء"
        : out.renamed && renameTo ? renameDoneAr({ applied: true, titleAr: renameTo, published: out.published })
        : "اعتمد الطلب",
    );
  };

  /* ب-٤: طلب مهارة غير موجودة يمرّ بالمراجعة (maker-checker) لا يُنشأ صامتا —
     فلا يحشر المؤلّف مهارة قريبة خاطئة لأن الصحيحة غير موجودة. */
  const requestSkill = async (input: { slug: string; nameAr: string; reasonAr: string }) => {
    await apiPost("/api/admin/catalog/change-requests", {
      entityType: "skill",
      entityId: input.slug,
      payload: { kind: "skill_request", slug: input.slug, nameAr: input.nameAr, reasonAr: input.reasonAr },
    });
    toast("قدّم طلب المهارة للمراجعة");
  };

  const FormHead = ({ id, icon: Icon, title, hint }: { id: typeof openForm & string; icon: typeof FilePlus2; title: string; hint: string }) => (
    <button onClick={() => setOpenForm(openForm === id ? null : id)}
      className="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-right transition hover:border-gold/40">
      <span className="flex items-center gap-2 text-lg font-black"><Icon className="h-5 w-5 text-gold-ink" /> {title}</span>
      <span className="flex items-center gap-3">
        <span className="hidden text-fine text-muted-foreground sm:inline">{hint}</span>
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

  /* ما ينتظر قرارا فعلا: `in_review` وحدَها — والمعتمَدُ والمرفوضُ تاريخٌ
     لا عمل، وعدُّهما في الرأس يَعِد بعملٍ لا وجودَ له. */
  const waitingCrs = crs.filter((cr) => cr.status === "in_review");
  const decidedCrs = crs.filter((cr) => cr.status !== "in_review");
  const pendingCrs = waitingCrs.length;
  /* ما له طلبٌ ينتظر — فلا يُقدَّم مرّتين */
  const waitingFor = new Set(waitingCrs.map((cr) => `${cr.entityType}:${cr.entityId}`));
  const draftControl = (entityType: string, row: { id: string; status: string }) => (
    <DraftApproval status={row.status} waiting={waitingFor.has(`${entityType}:${row.id}`)}
      canSubmit={canSubmitDraft[entityType] ?? false} busy={busy} onSubmit={() => submitDraft(entityType, row.id)} />
  );

  /* مسارٌ واحدٌ لكلّ مرشِّحٍ يُعرض — فلا يُنسى ترشيحٌ ظاهرٌ على قائمةٍ لا تعنيه */
  const browseUi = browse === null ? null
    : browse === "pathways" ? { view: pathwayView, rows: pathways, unit: "مسارا", ph: "ابحث بمعرّف أو عنوان…" }
    : browse === "courses" ? { view: courseView, rows: courses, unit: "دورة", ph: "ابحث بمعرّف أو عنوان أو مسار…" }
    : browse === "skills" ? { view: skillView, rows: skills, unit: "مهارة", ph: "ابحث بمعرّف أو اسم أو عائلة…" }
    : browse === "questions" ? { view: questionView, rows: questions, unit: "سؤالا", ph: "ابحث بنصّ السؤال أو الوحدة…" }
    : { view: templateView, rows: templates, unit: "قالبا", ph: "ابحث بمعرّف أو اسم…" };

  return (
    <AdminLayout title="إدارة الكتالوج الأكاديمي">
      {error && <Inset as="p" tone="danger" className="mb-4 px-4 py-3 text-sm text-red-200">{error}</Inset>}

      {/* ── العملُ قبل العدد ──

          كانت الشاشةُ تفتح بستِّ بطاقاتِ عددٍ متساويةِ الوزن، وفيها بطاقةُ
          «طلبات التغيير» — وهي وحدَها ما ينتظر قرارا. فكان الذي يُعمل معروضا
          بحجم الذي لا يُعمل، والقارئُ يعدّ ستًّا ليجد واحدةً تخصّه.

          فصار ما ينتظر القرارَ جملةً في الرأس وزرًّا يبلغه، والمجاميعُ
          سطرا تحته. والبطاقاتُ باقيةٌ لأنّها تفصّل الحالاتِ لا تكرّر الرقم. */}
      <WorkHeader
        loading={overview === null && !error}
        icon={GitPullRequest}
        count={pendingCrs}
        forms={CR_FORMS}
        waitingAr="تنتظر قرارك"
        stats={[
          `${pathways.length} مسارا`, `${courses.length} دورة`, `${skills.length} مهارة`,
          `${questions.length} سؤالا`, `${templates.length} قالبا`,
        ]}
        actionAr="راجعها"
        onAction={() => revealRow("change-requests")}
        doneAr="لا طلب تغيير ينتظر قرارك — وما يقدّم منها يصل هذه الشاشة فورا."
      />

      {overview && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {([["المسارات", overview.pathways], ["الدورات", overview.courses], ["المهارات", overview.skills],
             ["القوالب", overview.templates], ["الأسئلة", overview.questions], ["طلبات التغيير", overview.changeRequests]] as const).map(([label, bag]) => (
            <Card key={label}>
              <p className="text-read font-bold text-muted-foreground">{label}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(bag).map(([s, n]) => (
                  <span key={s} className="text-fine text-foreground">{n} <Pill v={s} /></span>
                ))}
                {Object.keys(bag).length === 0 && <span className="text-fine text-muted-foreground">لا شيء بعد</span>}
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
                aria-label="رشّح بالحالة"
                className="rounded-xl border border-white/12 bg-paper/30 px-3 py-2 text-xs text-foreground focus:border-gold focus:outline-none [&>option]:bg-surface">
                <option value="">كلّ الحالات</option>
                {statusesOf(browseUi.rows).map((st) => <option key={st} value={st}>{STATUS_AR[st] ?? st}</option>)}
              </select>
              {browse === "courses" && (
                <select value={pathPick} onChange={(e) => { setPathPick(e.target.value); setPage(1); }}
                  aria-label="رشّح بالمسار"
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
                <span className="font-mono text-fine text-muted-foreground" dir="ltr">{p.id}</span>
                <span className="font-bold">{p.title}</span>
                <span className="text-fine text-muted-foreground">{p.courseCount} دورة</span>
                <span className="mr-auto flex items-center gap-2"><Pill v={p.status} />{draftControl("pathway", p)}</span>
              </Inset>
            ))}
            {pathways.length === 0 && <p className="text-sm text-muted-foreground">لا مسارات بعد.</p>}
          </ul>
        )}
        {browse === "courses" && (
          <ul className="mt-3 space-y-2">
            {courseView.rows.map((c) => (
              <Inset as="li" key={c.id} className="px-4 py-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-fine text-muted-foreground" dir="ltr">{c.id}</span>
                  <span className="font-bold">{c.title}</span>
                  <span className="text-fine text-muted-foreground">{c.hours} ساعة · {c.skillCount} مهارة · {c.pathways.join("، ") || "بلا مسار"}</span>
                  {/* ك-٣: «بلا مهارات» تُقال هنا لا عند النشر — فمن يقرأ الصفَّ
                      يعرف لماذا لن تُنشر، ولا يكتشفه بعد أسبوعٍ عند الحاجز. */}
                  {c.skillCount === 0 && (
                    <Chip tone="danger">بلا مهارات — لن تنشر ولن يرشّحها التشخيص</Chip>
                  )}
                  {/* ك-٥: ودورةٌ بلا مسارٍ تُقال حالُها صراحةً — فالتي لا
                      تُرشَّح وحدَها لا يراها التشخيصُ إطلاقا، وذلك يُعرَف من
                      الصفّ لا بعد شهرٍ من تساؤلٍ عن دورةٍ لا تظهر. */}
                  {c.pathways.length === 0 && (
                    c.recommendableDirectly
                      ? <Chip tone="positive">ترشّح وحدها · {(c.diagnosticDomains ?? []).length} مجال</Chip>
                      : <Chip tone="warn">بلا مسار ولا ترشيح مستقلّ — لا يراها التشخيص</Chip>
                  )}
                  <span className="mr-auto flex items-center gap-2">
                    <Pill v={c.status} />
                    {draftControl("course", c)}
                    {canEditCourse && (
                      <Button
                        tone="ghost" size="sm"
                        aria-expanded={nameFor === c.id}
                        onClick={() => {
                          if (nameFor === c.id) { setNameFor(null); return; }
                          setNameFor(c.id); setNameDraft(c.title);
                        }}
                      >
                        اسمها
                      </Button>
                    )}
                    {canEditCourse && (
                      <Button
                        tone={c.skillCount === 0 ? "danger" : "ghost"} size="sm"
                        aria-expanded={skillsFor === c.id}
                        onClick={() => {
                          if (skillsFor === c.id) { setSkillsFor(null); return; }
                          setSkillsFor(c.id); setSkillDraft(c.skillIds);
                        }}
                      >
                        مهاراتها
                      </Button>
                    )}
                    {canEditCourse && (
                      <Button
                        tone="ghost" size="sm"
                        aria-expanded={soloFor === c.id}
                        onClick={() => {
                          if (soloFor === c.id) { setSoloFor(null); return; }
                          setSoloFor(c.id);
                          setSoloDomains(c.diagnosticDomains ?? []);
                          setSoloStages(c.diagnosticStages ?? []);
                        }}
                      >
                        ترشيحها وحدها
                      </Button>
                    )}
                  </span>
                </div>
                {/* الاسمُ حقلٌ لا صندوقُ JSON — ويُكتب بالباب الذي تكتبه «أسماء الدورات» (`renameCourse`): مباشرةً لمن
                    يعتمد ما يقدّمه، وطلبا في الطابور لغيره. ولا يعيده النشرُ التالي (`renamedTitleAr`) */}
                {nameFor === c.id && (() => {
                  const next = tidyCourseTitleAr(nameDraft);
                  return (
                    <Inset className="mt-3 grid gap-2">
                      <label htmlFor={`course-name-${c.id}`} className="text-read font-bold text-muted-foreground">اسمها الجديد</label>
                      <input id={`course-name-${c.id}`} value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} className={inputCls} />
                      {nameDraft.trim() !== "" && !next && <p className="text-read text-muted-foreground">الاسم من ٣ إلى ١٢٠ حرفا.</p>}
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          tone="confirm" size="sm" loading={busy}
                          disabled={!next || next === c.title}
                          onClick={() => void act(
                            () => apiPost<RenameResult>(`/api/admin/catalog/courses/${c.id}/rename`, { titleAr: next }),
                            renameDoneAr,
                          ).then((ok) => { if (ok) setNameFor(null); })}
                        >
                          {canSelfApprove ? "اعتمد الاسم" : "قدم للاعتماد"}
                        </Button>
                        <Button tone="ghost" size="sm" onClick={() => setNameFor(null)}>أغلق</Button>
                        <span className="text-fine text-muted-foreground">
                          {canSelfApprove ? "يتغير في الموقع الآن." : "ينتظر مراجعا آخر في «طلبات التغيير»."} ولا تتغير أسماء شعبها.
                        </span>
                      </div>
                    </Inset>
                  );
                })()}
                {soloFor === c.id && (
                  <Inset className="mt-3 grid gap-3">
                    <p className="text-read leading-7 text-muted-foreground">
                      دورة مستقلّة يرشّحها التشخيص بمهاراتها ومجالها دون مسار.
                      <b className="text-foreground"> ولا تنافس المسارات</b>: تظهر حين لا يجد التشخيص
                      ما يناسب المتعلّم بدل تحويله إلى مستشار.
                    </p>
                    <fieldset className="grid gap-1.5">
                      <legend className="text-read font-bold text-muted-foreground">
                        مجال التشخيص — اختر واحدا على الأقلّ
                      </legend>
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                        {DIAGNOSTIC_DOMAINS.map((d) => (
                          <label key={d.id} className="flex items-center gap-1.5 text-read text-foreground">
                            <input
                              type="checkbox"
                              checked={soloDomains.includes(d.id)}
                              onChange={() => setSoloDomains((cur) => (
                                cur.includes(d.id) ? cur.filter((x) => x !== d.id) : [...cur, d.id]
                              ))}
                            />
                            {d.name_ar}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <fieldset className="grid gap-1.5">
                      <legend className="text-read font-bold text-muted-foreground">
                        جمهورها — اختر واحدا على الأقلّ
                      </legend>
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                        {Object.entries(CAREER_STAGE_LABELS_AR).map(([id, label]) => (
                          <label key={id} className="flex items-center gap-1.5 text-read text-foreground">
                            <input
                              type="checkbox"
                              checked={soloStages.includes(id)}
                              onChange={() => setSoloStages((cur) => (
                                cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
                              ))}
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        tone="confirm" size="sm" loading={busy}
                        disabled={soloDomains.length === 0 || soloStages.length === 0 || c.skillCount === 0}
                        onClick={() => void act(
                          () => apiPut(`/api/admin/catalog/courses/${c.id}/standalone`, {
                            recommendable: true, domains: soloDomains, stages: soloStages,
                          }),
                          "صارت ترشّح وحدها — يبدأ ترشيحها بعد النشر",
                        ).then(() => setSoloFor(null))}
                      >
                        اجعلها ترشّح وحدها
                      </Button>
                      {c.recommendableDirectly && (
                        <Button
                          tone="danger" size="sm" loading={busy}
                          onClick={() => void act(
                            () => apiPut(`/api/admin/catalog/courses/${c.id}/standalone`, {
                              recommendable: false, domains: soloDomains, stages: soloStages,
                            }),
                            "توقّف ترشيحها المستقلّ — ومجالها محفوظ",
                          ).then(() => setSoloFor(null))}
                        >
                          أطفئ ترشيحها
                        </Button>
                      )}
                      <Button tone="ghost" size="sm" onClick={() => setSoloFor(null)}>أغلق</Button>
                      {c.skillCount === 0 && (
                        <span className="text-read text-amber-300">
                          اربط مهاراتها أوّلا — لا ترشيح بلا مهارات.
                        </span>
                      )}
                    </div>
                  </Inset>
                )}
                {skillsFor === c.id && (
                  <Inset className="mt-3">
                    <SkillPicker
                      skills={skills}
                      selectedIds={skillDraft}
                      onToggle={(id) => setSkillDraft((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))}
                      onRequestSkill={requestSkill}
                    />
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        tone="confirm" size="sm" loading={busy}
                        onClick={() => void act(
                          () => apiPut(`/api/admin/catalog/courses/${c.id}/skills`, { skillIds: skillDraft }),
                          skillDraft.length === 0
                            ? "أزيلت مهارات الدورة — ولن تنشر قبل ربط مهارة واحدة على الأقلّ"
                            : `ربطت ${skillDraft.length} مهارة بالدورة`,
                        ).then(() => setSkillsFor(null))}
                      >
                        احفظ المهارات
                      </Button>
                      <Button tone="ghost" size="sm" onClick={() => setSkillsFor(null)}>أغلق</Button>
                      {/* الاستبدالُ يُقال صراحةً: من ظنّها إضافةً فكَّ ما لم يقصد */}
                      <span className="text-fine text-muted-foreground">
                        ما تختاره هنا يحلّ محلّ المحفوظ ولا يضاف إليه.
                      </span>
                    </div>
                  </Inset>
                )}
              </Inset>
            ))}
            {courses.length === 0 && <p className="text-sm text-muted-foreground">لا دورات بعد.</p>}
          </ul>
        )}
        {browse === "skills" && (
          <>
            {/* ب-٤: الحصيلة أولا — «كم مهارة تُقاس فعلا» هو السؤال الذي يخفيه جدول من ٣٠٥ صفوف */}
            <Card as="p" className="mt-3 px-4 py-3 text-read leading-6 text-foreground">
              {skills.filter((s) => s.measureState === "measured").length} مقيسة ·{" "}
              {skills.filter((s) => s.measureState === "registered_unmeasured").length} مسجّلة بلا سؤال ·{" "}
              {skills.filter((s) => s.measureState === "inactive").length} موقوفة تشخيصيا · من {skills.length}
              <span className="text-muted-foreground"> — غير المقيسة تحسب في نسبة تغطية القياس ولا تقاس.</span>
            </Card>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {skillView.rows.map((s) => (
                <Inset as="li" key={s.id} className="px-4 py-2.5">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-mono text-fine text-muted-foreground" dir="ltr">{s.id}</span>
                    <span className="min-w-0 flex-1 truncate font-bold">{s.nameAr}</span>
                    <Pill v={s.status} />
                    {draftControl("skill", s)}
                  </div>
                  {s.measureNoteAr && (
                    <p className={`mt-1 text-read ${s.measureState === "measured" ? "text-teal-light-ink" : "text-muted-foreground"}`}>
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
                <span className="font-mono text-fine text-muted-foreground" dir="ltr">{qq.id}</span>
                <span className="min-w-0 flex-1 font-bold">{qq.text || "—"}</span>
                <span className="text-fine text-muted-foreground">{qq.module} · {qq.optionCount} خيار{!qq.active && " · موقوف"}</span>
                <span className="mr-auto flex items-center gap-2"><Pill v={qq.status} />{draftControl("question", qq)}</span>
              </Inset>
            ))}
            {questions.length === 0 && <p className="text-sm text-muted-foreground">لا أسئلة بعد.</p>}
          </ul>
        )}
        {browse === "templates" && (
          <ul className="mt-3 space-y-2">
            {templateView.rows.map((t) => (
              <Inset as="li" key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                <span className="font-mono text-fine text-muted-foreground" dir="ltr">{t.id}</span>
                <span className="font-bold">{t.name || "—"}</span>
                <span className="text-fine text-muted-foreground">{t.courseCount} دورة مركبة</span>
                <span className="mr-auto"><Pill v={t.status} /></span>
              </Inset>
            ))}
            {templates.length === 0 && <p className="text-sm text-muted-foreground">لا قوالب بعد.</p>}
          </ul>
        )}
      </section>

      {/* نماذج الإنشاء */}
      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-black">إنشاء وتعديل — كلّها مسودّات تمرّ بالاعتماد</h2>

        <FormHead id="names" icon={PenLine} title="أسماء الدورات" hint="اقتراحات من أسماء الشعب — اختر واعتمد" />
        {openForm === "names" && <CourseNamesPanel canSelfApprove={canSelfApprove} onRenamed={() => void refresh()} />}

        <FormHead id="course" icon={BookMarked} title="دورة جديدة (مسودة)" hint="أربع خطوات: الدورة، وحداتها، مهاراتها، مراجعة" />
        {openForm === "course" && fromProposal && (
          /* يُقال من أين جاء وإلى أين يعود — ومن غيّر رأيه رجع بلا دورة */
          <Inset className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm leading-6">
            <span>
              من اقتراح مدرب{seedTitleAr && <>: <b className="text-foreground">«{seedTitleAr}»</b></>}.
              {" "}تربط به حين تنشأ{backTo ? "، ثم تعود إلى ملفه." : "."}
            </span>
            {backTo && (
              <Button as={Link} to={backTo} tone="ghost" size="sm" icon={ArrowRight}>ارجع دون إنشاء</Button>
            )}
          </Inset>
        )}
        {openForm === "course" && (
          <CourseWizard
            pathways={pathways.map((p) => ({ id: p.id, title: p.title }))}
            skills={skills}
            onRequestSkill={requestSkill}
            seedTitleAr={seedTitleAr}
            onDone={(courseId) => {
              setOpenForm(null);
              /* الربطُ عند التمام لا قبله: اقتراحٌ يُعلَّق بدورةٍ لم تُنشأ
                 يترك المدرّبَ يقرأ «صارت دورةً» ولا دورةَ هناك. */
              if (fromProposal && courseId) {
                void apiPost(`/api/admin/course-proposals/${fromProposal}/became-course`, { courseId })
                  .then(() => toast("ربط اقتراح المدرّب بالدورة الجديدة"))
                  .catch(() => toast("أنشئت الدورة ولم يربط الاقتراح بها — اربطه بها من ملف المدرب", "error"))
                  .finally(() => {
                    if (backTo) { navigate(backTo); return; }
                    params.delete("proposalId"); params.delete("titleAr"); params.delete("back");
                    setParams(params, { replace: true });
                  });
              }
              void refresh();
            }}
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

        <FormHead id="skill" icon={FilePlus2} title="مهارة جديدة (مسودة)" hint="ما يقيسه التشخيص" />
        {openForm === "skill" && (
          <Card className="border-gold/20">
            <div className="grid gap-3 sm:grid-cols-4">
              {([["id", "SK-X-XXX-000"], ["slug", "skill_slug"], ["nameAr", "الاسم العربي"], ["familyId", "رمز العائلة (COG…)"]] as const).map(([k, ph]) => (
                <input key={k} value={skillForm[k]} onChange={(e) => setSkillForm({ ...skillForm, [k]: e.target.value })}
                  placeholder={ph} className={inputCls} />
              ))}
            </div>
            <Button tone="confirm" disabled={busy || !skillForm.id || !skillForm.slug || skillForm.nameAr.length < 2}
              onClick={() => act(async () => {
                await apiPost("/api/admin/catalog/skills", { ...skillForm, familyId: skillForm.familyId || undefined });
                /* وتُقدَّم للاعتماد معها — فلا تبقى مسودّةً بلا طريقٍ إلى النشر */
                await apiPost("/api/admin/catalog/change-requests", draftApprovalBody("skill", skillForm.id));
                setSkillForm({ id: "", slug: "", nameAr: "", familyId: "" });
              }, "أنشئت المهارة وقدمت للاعتماد — تنتظر مراجعا في «طلبات التغيير»")} className="mt-4">
              إنشاء المسودة
            </Button>
          </Card>
        )}

      </section>

      {/* طلبات التغيير — وهي هدفُ زرِّ الرأس، فتقبل التركيزَ لتُقرأ حين تُبلَغ.
          ما ينتظر قرارا أوّلا، وما قُرّر تاريخٌ مطويٌّ تحته: كانت كلُّها قائمةً واحدةً بالأحدث، فيُبحث عن العمل بين التاريخ. */}
      <section id="change-requests" tabIndex={-1} className="mt-8 outline-none">
        <h2 className="flex items-center gap-2 text-lg font-black"><GitPullRequest className="h-5 w-5 text-gold-ink" /> طلبات التغيير</h2>
        <div className="mt-4 space-y-3">
          {waitingCrs.length === 0 && <p className="text-sm text-muted-foreground">لا طلب ينتظر قرارا.</p>}
          {waitingCrs.map((cr) => (
            <ChangeRequestItem key={cr.id} cr={cr} status={<Pill v={cr.status} />} canDecide={canDecide} busy={busy} onDecide={(d) => decideCr(cr, d)} />
          ))}
        </div>
        {decidedCrs.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-read font-bold text-muted-foreground">قرارات سابقة ({decidedCrs.length})</summary>
            <div className="mt-3 space-y-3">
              {decidedCrs.map((cr) => (
                <ChangeRequestItem key={cr.id} cr={cr} status={<Pill v={cr.status} />} canDecide={canDecide} busy={busy} onDecide={(d) => decideCr(cr, d)} />
              ))}
            </div>
          </details>
        )}
        <p className="mt-3 flex items-center gap-1.5 text-read text-muted-foreground">
          <BookMarked className="h-3.5 w-3.5" />
          {canSelfApprove
            ? "من يقدم الطلب لا يعتمده، إلا حسابك: تعتمد ما قدمته، ويسجل ذلك في سجل الأثر."
            : "من يقدم الطلب لا يعتمده، والخادم يرفض ذلك."}
        </p>
      </section>

      <Button tone="ghost" size="sm" icon={RefreshCw} className="mt-6 px-0" onClick={() => void refresh()}>
        تحديث
      </Button>
    </AdminLayout>
  );
}
