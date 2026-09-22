/* دوراتٌ اقترحها المدرّبون — تُصنَّف قبل أن تدخل الكتالوج (ح-٤).

   ═══ القرارُ أوّلا، ثمّ الإنشاء ═══

   «قريبةٌ من رمزٍ قائم → نسخةٌ منه · جديدةٌ حقّا → دورةٌ لها مهاراتُها».
   وهما بابان مختلفان في الأثر: الأوّلُ لا يزيد الكتالوجَ شيئا — الرمزُ
   موجودٌ وبصمةُ مهارته محسوبةٌ في التشخيص — والثاني يزيده عقدةً جديدة.
   فالخلطُ بينهما يقيس المهارةَ مرّتَين أو يترك دورةً لا يجدها التشخيص.

   ═══ ولا يُنشأ الإصدارُ باسم صاحبه ═══

   «نسخةٌ من رمزٍ قائم» **تربط ولا تكتب**: الاقتراحُ يُعلَّق بالرمز، ويُترك
   للمدرّب أن يقترح اسمَه ومحاورَه بنفسه في قناة ح-٣ (maker-checker ودائرةُ
   أثرٍ وإصدارٌ جديد). وإنشاؤه آليّا يضع في فمه ما لم يكتبه، ثمّ يُنسب إليه
   في سجلّ الأثر.

   ═══ والدورةُ الجديدةُ تُنشأ في نموذجها لا في نموذجٍ ثانٍ هنا ═══

   نموذجُ الكتالوج يحمل المسارَ والتسلسلَ والساعاتِ والمهاراتِ والوحداتِ
   ومدقّقَ التمارين. ونسخةٌ أنحفُ منه في هذه الشاشة تتخلّف عنه بعد شهرٍ
   وتُنشئ دوراتٍ ناقصةً بابُها من هنا. فالزرُّ يُحيل إلى النموذج نفسِه
   محمَّلا بعنوان الاقتراح، ثمّ يعود فيربط ما أُنشئ بالاقتراح.

   ═══ والرفضُ بسبب ═══

   من رُفض اقتراحُه بلا سببٍ لا يتعلّم شيئا: يُعيده كما هو بعد شهر. فالسببُ
   يلزم في الخادم لا في الشاشة وحدَها. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookPlus, Check, Layers, Link2, Link2Off, Loader2, MessageCircleQuestion, Pencil, Sparkles, X } from "lucide-react";
import { useNavigate } from "react-router";
import AdminLayout from "./AdminLayout";
import EmptyState from "@/components/EmptyState";
import ListToolbar from "@/components/admin/ListToolbar";
import CoursePicker from "@/components/admin/CoursePicker";
import { toast, toastError } from "@/components/Toast";
import { apiGet, apiPatch, apiPost, ApiError } from "@/services/api";
import { staffAreaCls, staffControlCls, StaffField } from "@/components/FormKit";
import { Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { fmtDateLong } from "@/application/text/format-ar";
import { matchesQuery } from "@/application/text/search-ar";
import { paginate } from "@/application/admin/paginate";

interface Suggestion {
  courseId: string;
  titleAr: string;
  score: number;
  sharedAr: string[];
}

interface Row {
  id: string;
  profileId: string;
  trainerName: string;
  trainerEmail: string;
  titleAr: string;
  summaryAr: string | null;
  status: string;
  courseId: string | null;
  courseTitleAr: string | null;
  questionAr: string | null;
  questionAt: string | null;
  answerAr: string | null;
  answeredAt: string | null;
  decisionNoteAr: string | null;
  decidedAt: string | null;
  createdAt: string;
  /** أقربُ رموزِ الكتالوج إليه — محسوبةٌ في الخادم، وفارغةٌ لما بُتّ فيه */
  suggestedCourses: Suggestion[];
}

/* والحقلُ `title` لا `titleAr`: هكذا يردّه `/api/admin/catalog/courses`.
   وواجهةٌ تسمّيه بغير اسمه تُظهر قائمةً من الفراغ بلا خطأٍ يُرى. */
/* والمساراتُ والمجالاتُ يردّهما `/api/admin/catalog/courses` من قبلُ —
   وكان النوعُ هنا أضيقَ ممّا يصل، فيُرمى ما لا يُعلَن. ومرشِّحُ
   «المجال» يُبنى منهما، فلو بقي النوعُ ضيّقا لَما ظهر المرشِّحُ أصلا. */
interface CourseRow {
  id: string; title: string; status: string;
  pathwayNames?: string[]; diagnosticDomains?: string[];
}

/* ما لم يُبَتَّ فيه — وله الأبوابُ الأربعة (ربطٌ · دورةٌ جديدة · سؤالٌ · ردّ).

   ═══ والمربوطُ ليس منه، وليس منتهيا كذلك (٢٠ سبتمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «حين أربطه يذهب — وأريده أن يبقى مكتوبا عليه أنّه رُبط
   بكذا، فأعيد النظر فيه لاحقا». والربطُ أضعفُ القرارات الثلاثة: حكمُ تشابهٍ
   يُخطأ فيه ويُكتشف بعد أسبوعٍ حين يُقرأ الاقتراحُ ثانية. أمّا الرفضُ فجوابٌ
   وصل صاحبَه، و«صارت دورةً» أنشأت في الكتالوج شيئا له حياتُه — فيُطويان.

   فللمربوط حالٌ ثالثةٌ في هذه الشاشة: يبقى معروضا بأفعاله هو — يُربط بغيره،
   أو يُنقض ربطُه فيعود إلى الطابور، أو يُصحَّح نصُّه. والخادمُ يردّه في نطاق
   `open` (انظر `QUEUE_VISIBLE`)، وهذه تعرف أنّه يُعمل فيه. */
const OPEN = ["draft", "submitted", "info_requested"];



const SAID: Record<string, string> = {
  linked: "نسخةٌ من رمزٍ قائم",
  became_course: "صارت دورةً في الكتالوج",
  rejected: "لم تُقبل",
};

/* ═══ تقريرُ التجميع — أتتجمّع الاقتراحاتُ في مسارات؟ ═══

   سأل صاحبُ المنصّة: أنجمعها كلَّ فترةٍ في مسارات بدل دورةٍ دورة؟ والقواعدُ
   في `src/application/catalog/proposal-clusters.ts` تجيبه بقياس. وكان بابُها
   سكربتا يُنادى بـSSH ودوكر — وتقريرٌ يُقرأ كلَّ فترةٍ ويحتاج ثلاثَ أدواتٍ
   ليُفتح لا يُقرأ. فهو هنا، في الشاشة التي يُصنَّف فيها.

   **ومطويٌّ حتّى يُطلَب**: مسحُه يقرأ الكتالوجَ كلَّه وفضاءَ التوصيات، ومن
   فتح الشاشةَ ليصنّف اقتراحا واحدا لا يُحمَّل ذلك. */
interface ClusterProposal {
  id: string; titleAr: string; trainerName: string | null;
  nearestCourseId: string; nearestTitleAr: string; score: number; sharedAr: string[];
}
interface ClusterRow {
  domain: string; domainLabelAr: string;
  verdict: "path_candidate" | "split_by_audience" | "standalone";
  verdictAr: string; commonStagesAr: string[]; domainReachable: boolean;
  proposals: ClusterProposal[];
}
interface ClusterReport {
  totalProposals: number; pathCourseCount: number; headlineAr: string;
  clusters: ClusterRow[];
  unanchored: { id: string; titleAr: string; summaryAr: string | null; trainerName: string | null }[];
}

/** علامةُ الحكم — ◆ مرشَّحُ مسار · ◇ يُقسَم بالجمهور · · دورةٌ وحدَها */
const VERDICT_AR: Record<ClusterRow["verdict"], { mark: string; cls: string }> = {
  path_candidate: { mark: "◆", cls: "text-emerald-300" },
  split_by_audience: { mark: "◇", cls: "text-amber-300" },
  standalone: { mark: "·", cls: "text-muted-foreground" },
};

function ClusterPanel({ scope }: { scope: "open" | "all" }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ClusterReport | null>(null);
  const [err, setErr] = useState<string | null>(null);

  /* ولا حالةَ «جارٍ التحميل»: هي مشتقّةٌ لا محفوظة — مفتوحٌ بلا نتيجةٍ ولا
     خطأ. وحفظُها كان يلزمه `setLoading(true)` في جسم الأثر، وذاك دينُ
     تلويمٍ أمسكه الحاجز (`react-hooks/set-state-in-effect`): كتابةٌ متزامنةٌ
     في الأثر تُصيّر الشاشةَ مرّتين بلا سبب. */
  const loading = open && data === null && err === null;

  /* والمدى يُقرأ مع الفتح، واللوحةُ تُعاد بتبدّله (`key` في موضع تركيبها) —
     فمن بدّل «أظهِر ما انتهى أمرُه» وهو مفتوحٌ لا يرى تقريرا عن مدى غيرِ
     الذي يقرؤه في الطابور. */
  useEffect(() => {
    if (!open) return;
    apiGet<ClusterReport>(`/api/admin/course-proposals/clusters?scope=${scope}`)
      .then((r) => { setData(r); setErr(null); })
      .catch((e) => setErr(e instanceof ApiError ? e.message : "تعذّر بناءُ التقرير"));
  }, [open, scope]);

  return (
    <Card className="mb-4">
      <Button tone="ghost" icon={Layers} onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? "أخفِ تقريرَ التجميع" : "أتتجمّع هذه في مسارات؟ — اعرض التقرير"}
      </Button>

      {open ? (
        <div className="mt-3">
          {loading ? (
            <div className="grid place-items-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" aria-label="جارٍ الحساب" />
            </div>
          ) : err ? (
            <p role="alert" className="text-read font-bold text-red-300">{err}</p>
          ) : data ? (
            <>
              <p className="text-sm leading-7 text-foreground">{data.headlineAr}</p>

              {data.clusters.length > 0 ? (
                <div className="mt-3 grid gap-3">
                  {data.clusters.map((c) => (
                    <Inset key={c.domain}>
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className={`text-lg font-black ${VERDICT_AR[c.verdict].cls}`} aria-hidden>
                          {VERDICT_AR[c.verdict].mark}
                        </span>
                        <b className="text-read text-foreground">{c.domainLabelAr}</b>
                        <span className="text-sm text-muted-foreground">
                          {c.proposals.length} اقتراحا
                        </span>
                        {!c.domainReachable ? (
                          <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-300">
                            لا يصله هدفٌ اليوم
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-1 text-sm leading-7 text-muted-foreground">{c.verdictAr}</p>

                      <div className="mt-1 text-xs text-muted-foreground/70">
                        الجمهورُ المشترَك:{" "}
                        {c.commonStagesAr.length > 0 ? c.commonStagesAr.join(" · ") : "— لا جمهورَ يجمعها —"}
                      </div>

                      <ul className="mt-2 grid gap-1.5">
                        {c.proposals.map((p) => (
                          <li key={p.id} className="text-sm text-muted-foreground">
                            «<b className="text-foreground">{p.titleAr}</b>»
                            {p.trainerName ? <span className="text-muted-foreground/70"> — {p.trainerName}</span> : null}
                            <div className="text-xs text-muted-foreground/70">
                              أقربُ رمز: {p.nearestCourseId} «{p.nearestTitleAr}»
                              {p.sharedAr.length > 0 ? ` · تشترك في: ${p.sharedAr.join("، ")}` : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </Inset>
                  ))}
                </div>
              ) : null}

              {/* وأهمُّ صفوفه: ما لا يشبه شيئا في الكتالوج — يُقرأ بعين */}
              {data.unanchored.length > 0 ? (
                <Inset className="mt-3">
                  <b className="text-read text-foreground">
                    بلا مرساة ({data.unanchored.length})
                  </b>
                  <p className="mt-1 text-sm leading-7 text-muted-foreground">
                    لا تشترك كلمةٌ من عناوينها مع الكتالوج، فلا تُوضَع في مجال. وهي إمّا
                    <b> بابٌ جديدٌ فعلا</b>، وإمّا عنوانٌ غامضٌ يُسأل صاحبُه عنه.
                  </p>
                  <ul className="mt-2 grid gap-1.5">
                    {data.unanchored.map((p) => (
                      <li key={p.id} className="text-sm text-muted-foreground">
                        «<b className="text-foreground">{p.titleAr}</b>»
                        {p.trainerName ? <span className="text-muted-foreground/70"> — {p.trainerName}</span> : null}
                      </li>
                    ))}
                  </ul>
                </Inset>
              ) : null}

              <p className="mt-3 text-sm leading-7 text-muted-foreground/70">
                <b>◆ مرشَّحُ مسار</b> — {data.pathCourseCount} فأكثرُ بجمهورٍ واحد. يُقرأ ولا يُنفَّذ:
                المسارُ وعدٌ ومخرَجٌ ختاميٌّ وشهادة، ولا يُولَد من عناوينَ اجتمعت في عمود.
                {" · "}<b>◇ يُقسَم بالجمهور</b> — عددُه يكفي ولا جمهورَ يجمعه.
                {" · "}<b>· دورةٌ قائمةٌ بنفسها</b> — ما دون ذلك.
                {" "}ومجالٌ لا يصله هدفٌ: العلاجُ بنكُ الأسئلة لا مسارٌ جديد.
              </p>
            </>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

export default function CourseProposals() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [showDecided, setShowDecided] = useState(false);

  /* بابٌ مفتوحٌ واحدٌ في كلّ وقت: الربطُ أو الرفض، لا الاثنان معا */
  const [linkFor, setLinkFor] = useState<string | null>(null);
  const [linkCourse, setLinkCourse] = useState("");
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [askFor, setAskFor] = useState<string | null>(null);
  const [askText, setAskText] = useState("");
  const [editFor, setEditFor] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");

  const load = useCallback(() => {
    Promise.all([
      apiGet<Row[]>(`/api/admin/course-proposals?scope=${showDecided ? "all" : "open"}`),
      apiGet<CourseRow[]>("/api/admin/catalog/courses"),
    ])
      .then(([r, c]) => { setRows(r); setCourses(c); setErr(null); })
      .catch((e) => setErr(e instanceof ApiError ? e.message : "تعذّر تحميل الطابور"));
  }, [showDecided]);

  useEffect(() => { load(); }, [load]);

  async function run(work: () => Promise<unknown>, okAr: string) {
    setBusy(true);
    try {
      await work();
      toast(okAr);
      setLinkFor(null);
      setRejectFor(null);
      setAskFor(null);
      setEditFor(null);
      setLinkCourse("");
      setRejectNote("");
      setAskText("");
      load();
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر تنفيذ القرار");
    } finally {
      setBusy(false);
    }
  }

  const shown = useMemo(
    () => (rows ?? []).filter((r) => matchesQuery(q, [r.titleAr, r.summaryAr ?? "", r.trainerName, r.trainerEmail])),
    [rows, q],
  );

  const view = paginate(shown, page, 8);

  return (
    <AdminLayout title="دوراتٌ اقترحها المدرّبون">
      <Card className="mb-4">
        <p className="text-sm leading-7 text-muted-foreground">
          كلُّ اقتراحٍ هنا <b>ليس دورةً بعد</b>: لا يظهر في الكتالوج ولا يُحسب في التشخيص حتّى يُصنَّف.
          وبابان للتصنيف — <b>نسخةٌ من رمزٍ قائم</b> إن كانت قريبةً منه فتُربط به ويقترح المدرّبُ
          نسختَه بنفسه، أو <b>دورةٌ جديدة</b> تُنشأ في نموذج الكتالوج بمهاراتها ثمّ تُربط هنا.
          {" "}وقبلهما <b>اسأل المدرّب</b> إن نقصك ما تقرّر به — فيعود الاقتراحُ إليك بجوابه.
          {" "}وكلُّ تصنيفٍ يفتح لك <b>مهمّةً قائمةً بتأهيله</b> للدورة، فلا يُصنَّف اقتراحٌ ويبقى صاحبُه لا يدرّسه.
        </p>
      </Card>

      {err ? (
        <Card tone="danger" role="alert" className="text-center text-read font-bold text-red-300">{err}</Card>
      ) : !rows ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground/50" aria-label="جارٍ التحميل" />
        </div>
      ) : (
        <>
          <ClusterPanel key={showDecided ? "all" : "open"} scope={showDecided ? "all" : "open"} />

          <ListToolbar q={q} onQ={setQ} onPage={setPage} view={view} unit="اقتراحا"
            placeholder="ابحث بعنوانِ الدورة أو باسم المدرّب…" />

          <div className="mb-3 mt-2">
            <Button tone="ghost" onClick={() => setShowDecided(!showDecided)}>
              {showDecided ? "أخفِ ما انتهى أمرُه" : "أظهِر ما انتهى أمرُه — الدوراتِ والمردودَ"}
            </Button>
          </div>

          {view.total === 0 ? (
            <EmptyState
              icon={BookPlus}
              titleAr={showDecided ? "لا اقتراحَ يطابق بحثَك" : "لا اقتراحَ ينتظر التصنيفَ ولا مربوطَ يُراجَع"}
              reasonAr="تصل هنا الدوراتُ التي يقولها المدرّبون في طلبِ انضمامهم أو من بوّابتهم — ولا تدخل الكتالوجَ حتّى تُصنَّف."
            />
          ) : (
            <div className="grid gap-3">
              {view.rows.map((r) => {
                const open = OPEN.includes(r.status);
                /* المربوطُ ليس مفتوحا — ولا هو منتهٍ: له أفعالُه هو */
                const linked = r.status === "linked";
                return (
                  <Card key={r.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-[16rem] flex-1">
                        <div className="text-read font-bold text-foreground">{r.titleAr}</div>
                        {r.summaryAr ? (
                          <div className="mt-1 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                            {r.summaryAr}
                          </div>
                        ) : null}
                        <div className="mt-1 text-sm text-muted-foreground">
                          اقترحها <b className="text-foreground">{r.trainerName}</b>
                          <span className="text-muted-foreground/70"> · {r.trainerEmail}</span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground/70">
                          {r.decidedAt ? `صُنِّفت ${fmtDateLong(r.decidedAt)}` : `وصلت ${fmtDateLong(r.createdAt)}`}
                        </div>
                        {/* واقفٌ على جوابه هو — فلا يُقرأ الطابورُ كأنّه كلُّه ينتظرنا */}
                        {r.status === "info_requested" ? (
                          <span className="mt-2 inline-block rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-300">
                            سُئل — ننتظر جوابَه
                          </span>
                        ) : null}
                      </div>

                      {open ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            tone="secondary" icon={Link2} disabled={busy}
                            onClick={() => { setLinkFor(linkFor === r.id ? null : r.id); setRejectFor(null); setAskFor(null); }}
                          >
                            نسخةٌ من رمزٍ قائم
                          </Button>
                          {/* الإنشاءُ في نموذج الكتالوج نفسِه — مع عنوان الاقتراح ومعرّفه،
                              فيعود النموذجُ ويربط ما أُنشئ بصاحبه بلا نسخٍ يدويّ. */}
                          <Button
                            tone="confirm" icon={BookPlus} disabled={busy}
                            onClick={() => nav(
                              `/admin/catalog?proposalId=${r.id}`
                              + `&titleAr=${encodeURIComponent(r.titleAr)}#course`,
                            )}
                          >
                            دورةٌ جديدة
                          </Button>
                          {/* بابٌ قبل القرار: اسأل. ومن صنّف ما لا يفهم خمّن أو رفض. */}
                          <Button
                            tone="ghost" icon={MessageCircleQuestion} disabled={busy}
                            onClick={() => { setAskFor(askFor === r.id ? null : r.id); setLinkFor(null); setRejectFor(null); }}
                          >
                            اسأل المدرّب
                          </Button>
                          <Button
                            tone="danger" icon={X} disabled={busy}
                            onClick={() => { setRejectFor(rejectFor === r.id ? null : r.id); setLinkFor(null); setAskFor(null); }}
                          >
                            لا تُقبل
                          </Button>
                        </div>
                      ) : linked ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            tone="secondary" icon={Link2} disabled={busy}
                            onClick={() => { setLinkFor(linkFor === r.id ? null : r.id); setLinkCourse(r.courseId ?? ""); setRejectFor(null); setAskFor(null); setEditFor(null); }}
                          >
                            اربِطْها بغيره
                          </Button>
                          <Button
                            tone="ghost" icon={Link2Off} disabled={busy}
                            onClick={() => void run(
                              () => apiPost(`/api/admin/course-proposals/${r.id}/unlink`, {}),
                              "نُقض الربطُ — عادت إلى الطابور",
                            )}
                          >
                            انقُضِ الربط
                          </Button>
                          <Button
                            tone="ghost" icon={Pencil} disabled={busy}
                            onClick={() => {
                              setEditFor(editFor === r.id ? null : r.id);
                              setEditTitle(r.titleAr); setEditSummary(r.summaryAr ?? "");
                              setLinkFor(null); setRejectFor(null); setAskFor(null);
                            }}
                          >
                            صحِّحْ نصَّها
                          </Button>
                        </div>
                      ) : (
                        <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold text-muted-foreground">
                          {SAID[r.status] ?? r.status}
                        </span>
                      )}
                    </div>

                    {/* ما صارت إليه، وما قيل لصاحبها */}
                    {!open ? (
                      <Inset className="mt-3 text-sm leading-7 text-muted-foreground">
                        {linked ? (
                          <>
                            <b className="text-teal-light-ink">رُبطت بـ «{r.courseTitleAr ?? r.courseId}»</b>
                            <span className="text-muted-foreground"> — تبقى هنا لتُراجَع، ولا تدخل الكتالوجَ باسمها.</span>
                            {" "}
                          </>
                        ) : r.courseId ? (
                          <>الرمز: <b className="text-foreground">{r.courseId}</b>{r.courseTitleAr ? ` — ${r.courseTitleAr}` : ""}. </>
                        ) : null}
                        {r.decisionNoteAr || (r.status === "rejected" ? "بلا سببٍ مكتوب." : "")}
                      </Inset>
                    ) : null}

                    {/* ── تصحيحُ نصٍّ كتبه صاحبُه ── */}
                    {editFor === r.id ? (
                      <Inset className="mt-3 grid gap-3">
                        <StaffField label="عنوانُ الدورة" hint="وهي كلماتُ صاحبها — فما كان يُكتب في سجلّ الأثر كاملا">
                          <input
                            className={staffControlCls} value={editTitle} maxLength={200}
                            onChange={(e) => setEditTitle(e.target.value)}
                          />
                        </StaffField>
                        <StaffField label="نبذتُها">
                          <textarea
                            className={staffAreaCls} rows={3} maxLength={2000} value={editSummary}
                            onChange={(e) => setEditSummary(e.target.value)}
                          />
                        </StaffField>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            tone="confirm" disabled={busy || editTitle.trim().length < 3}
                            onClick={() => void run(
                              () => apiPatch(`/api/admin/course-proposals/${r.id}`, {
                                titleAr: editTitle.trim(), summaryAr: editSummary.trim() || null,
                              }),
                              "صُحِّح نصُّ الاقتراح — وما كان في الأثر",
                            )}
                          >
                            احفظْ
                          </Button>
                          <Button tone="ghost" disabled={busy} onClick={() => setEditFor(null)}>تراجعْ</Button>
                        </div>
                      </Inset>
                    ) : null}

                    {/* ── الربطُ برمزٍ قائم ── */}
                    {linkFor === r.id ? (
                      <Inset className="mt-3 grid gap-3">
                        {/* ═══ ما يرشّحه النظام ═══

                            القائمةُ تحته فيها واحدٌ وثمانون رمزا، ومن لا يحفظ
                            الكتالوجَ بظهر قلبٍ أنشأ ثانيةً لما هو موجود. وكلُّ
                            ترشيحٍ يقول **لماذا** رُشّح — وترشيحٌ بلا سببٍ
                            يُقبل بلا قراءةٍ أو يُهمَل كلُّه. */}
                        {r.suggestedCourses.length > 0 ? (
                          <div>
                            <div className="mb-2 flex items-center gap-1.5 text-sm font-bold text-foreground">
                              <Sparkles className="h-4 w-4 text-teal" aria-hidden />
                              أقربُ ما عندنا إليها
                            </div>
                            <div className="grid gap-2">
                              {r.suggestedCourses.map((sug) => (
                                <button
                                  key={sug.courseId}
                                  type="button"
                                  onClick={() => setLinkCourse(sug.courseId)}
                                  className={
                                    "rounded-xl border px-3 py-2 text-right transition "
                                    + (linkCourse === sug.courseId
                                      ? "border-teal/60 bg-teal/10"
                                      : "border-white/10 bg-white/[0.03] hover:border-teal/40")
                                  }
                                >
                                  <div className="text-sm font-bold text-foreground">{sug.titleAr}</div>
                                  <div dir="ltr" className="text-left font-mono text-xs text-muted-foreground/70">
                                    {sug.courseId}
                                  </div>
                                  <div className="mt-0.5 text-xs text-muted-foreground">
                                    تشترك في: {sug.sharedAr.join("، ")}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-read leading-6 text-muted-foreground">
                            لم يجد النظامُ رمزا قريبا — اخترْ من القائمة، أو أنشئها دورةً جديدة.
                          </p>
                        )}
                        <StaffField
                          label="أيُّ رمزٍ هي نسخةٌ منه؟"
                          hint="يُربط الاقتراحُ به، ويقترح المدرّبُ اسمَه ومحاورَه بنفسه"
                        >
                          <CoursePicker
                            courses={courses} value={linkCourse}
                            onChange={setLinkCourse} labelAr="أيُّ رمزٍ هي نسخةٌ منه؟"
                          />
                        </StaffField>
                        <div className="flex gap-2">
                          <Button
                            tone="confirm" icon={Check} loading={busy} disabled={!linkCourse}
                            onClick={() => run(
                              () => apiPost(`/api/admin/course-proposals/${r.id}/link`, { courseId: linkCourse }),
                              "رُبط الاقتراحُ بالرمز",
                            )}
                          >
                            اربِطها
                          </Button>
                          <Button tone="ghost" icon={X} onClick={() => setLinkFor(null)}>تراجَع</Button>
                        </div>
                      </Inset>
                    ) : null}

                    {/* ── السؤالُ قبل القرار ── */}
                    {askFor === r.id ? (
                      <Inset className="mt-3 grid gap-3">
                        <StaffField
                          label="ما الذي تريد أن تعرفه عنها؟"
                          hint="يصل المدرّبَ في «دوراتي المقترحة» ويُشعَر به — ويعود الاقتراحُ إليك بجوابه"
                        >
                          <textarea
                            className={staffControlCls} value={askText} maxLength={2000} rows={3}
                            placeholder="مثلا: كم ساعةً تراها؟ وما الفرق بينها وبين C-BIZ-104؟"
                            onChange={(e) => setAskText(e.target.value)}
                          />
                        </StaffField>
                        <div className="flex gap-2">
                          <Button
                            tone="confirm" icon={Check} loading={busy} disabled={askText.trim().length < 5}
                            onClick={() => run(
                              () => apiPost(`/api/admin/course-proposals/${r.id}/ask`, { questionAr: askText.trim() }),
                              "وصل السؤالُ صاحبَها",
                            )}
                          >
                            أرسِل السؤال
                          </Button>
                          <Button tone="ghost" icon={X} onClick={() => setAskFor(null)}>تراجَع</Button>
                        </div>
                      </Inset>
                    ) : null}

                    {/* خيطُ السؤال وجوابه — يبقى بعد القرار: من قرأ «رُفضت»
                        بعد شهرٍ يحتاج أن يرى ما سُئل عنه وبمَ أُجيب. */}
                    {r.questionAr ? (
                      <Inset className="mt-3 grid gap-2 text-sm leading-7">
                        <div>
                          <span className="font-bold text-foreground">سألناه</span>
                          {r.questionAt ? (
                            <span className="ms-1.5 text-xs text-muted-foreground/70">{fmtDateLong(r.questionAt)}</span>
                          ) : null}
                          <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{r.questionAr}</p>
                        </div>
                        {r.answerAr ? (
                          <div>
                            <span className="font-bold text-foreground">فأجاب</span>
                            {r.answeredAt ? (
                              <span className="ms-1.5 text-xs text-muted-foreground/70">{fmtDateLong(r.answeredAt)}</span>
                            ) : null}
                            <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{r.answerAr}</p>
                          </div>
                        ) : (
                          <p className="text-read text-muted-foreground">ولم يُجب بعد.</p>
                        )}
                      </Inset>
                    ) : null}

                    {/* ── الرفضُ بسبب ── */}
                    {rejectFor === r.id ? (
                      <Inset className="mt-3 grid gap-3">
                        <StaffField label="لماذا لا تُقبل؟" hint="يقرؤه المدرّبُ في بوّابته — وبلا سببٍ يُعيدها كما هي">
                          <input
                            className={staffControlCls} value={rejectNote} maxLength={2000}
                            placeholder="مثلا: مغطّاةٌ في C-AUT-103، ولا تضيف مهارةً جديدة"
                            onChange={(e) => setRejectNote(e.target.value)}
                          />
                        </StaffField>
                        <div className="flex gap-2">
                          <Button
                            tone="danger" icon={Check} loading={busy} disabled={rejectNote.trim().length < 5}
                            onClick={() => run(
                              () => apiPost(`/api/admin/course-proposals/${r.id}/reject`, { noteAr: rejectNote.trim() }),
                              "سُجّل الرفضُ بسببه",
                            )}
                          >
                            ارفِضها
                          </Button>
                          <Button tone="ghost" icon={X} onClick={() => setRejectFor(null)}>تراجَع</Button>
                        </div>
                      </Inset>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </AdminLayout>
  );
}
