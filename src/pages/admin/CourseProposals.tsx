/* دوراتٌ اقترحها المدرّبون — تُصنَّف قبل أن تدخل الكتالوج (ح-٤).

   ═══ وتُقرَّر في ملفّ صاحبها — قرارُ صاحب المنصّة «A» (٢٦ أكتوبر ٢٠٢٦) ═══

   سُئل: أين تُقرَّر دوراتٌ يقترحها المدرّب؟ في ملفّه بجانب أجره ودوراته، أم هنا؟ فقال «A»: في ملفّه — نسخةٌ من رمزٍ
   قائم، أو دورةٌ جديدة، أو اسأله، أو ليس الآن. فالأبوابُ الأربعةُ وما يُقرَّر به (أجوبةُ الفورم، والسؤالُ وجوابُه،
   وأقربُ الرموز إليه) في الخطوة الثانية من «الاتفاقية» (`CoursesStep` في `PreparationSteps.tsx`). وهنا يبقى ما لا
   يُرى من ملفٍّ واحد: القائمةُ عبرَ المدرّبين، وتقريرُ التجميع، وكرّاسةُ Claude ورفعُها. وكلُّ سطرٍ يفتح ملفَّ صاحبه
   على الاقتراح نفسِه (`ideaRecordHref`). وما تحت هذا علّةُ الأبواب حيث صارت.

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
   ومدقّقَ التمارين. ونسخةٌ أنحفُ منه في ملفّ المدرّب تتخلّف عنه بعد شهرٍ
   وتُنشئ دوراتٍ ناقصة. فالزرُّ يُحيل إلى النموذج نفسِه محمَّلا بعنوان
   الاقتراح، ثمّ يعود فيربط ما أُنشئ بالاقتراح ويرجع إلى الملفّ.

   ═══ والرفضُ بسبب ═══

   من رُفض اقتراحُه بلا سببٍ لا يتعلّم شيئا: يُعيده كما هو بعد شهر. فالسببُ
   يلزم في الخادم لا في الشاشة وحدَها. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookPlus, Layers, Loader2 } from "lucide-react";
import { Link } from "react-router";
import AdminLayout from "./AdminLayout";
import EmptyState from "@/components/EmptyState";
import ListToolbar from "@/components/admin/ListToolbar";
import CourseDecisionsUpload from "@/components/admin/CourseDecisionsUpload";
import { apiGet, ApiError } from "@/services/api";
import { useRealSession } from "@/services/session";
import { Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { fmtDateLong } from "@/application/text/format-ar";
import { matchesQuery } from "@/application/text/search-ar";
import { paginate } from "@/application/admin/paginate";
import { proposalDetailRows, type ProposalDetails } from "@/application/trainer/proposal-details";
import { ideaRecordHref } from "@/application/trainer/idea-links";

interface Row {
  id: string;
  profileId: string;
  /** طلبُ صاحبه — عنوانُ ملفّه الذي يُقرَّر فيه */
  applicationId: string;
  trainerName: string;
  trainerEmail: string;
  titleAr: string;
  summaryAr: string | null;
  /** أجوبةُ أسئلة الفورم — المحاورُ والأقربُ في الكتالوج وقبولُ الدمج */
  details: ProposalDetails | null;
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
}

/* ما لم يُبَتَّ فيه — وله الأبوابُ الأربعة في ملفّ صاحبه (ربطٌ · دورةٌ جديدة · سؤالٌ · ليس الآن).

   ═══ والمربوطُ ليس منه، وليس منتهيا كذلك (٢٠ سبتمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «حين أربطه يذهب — وأريده أن يبقى مكتوبا عليه أنّه رُبط
   بكذا، فأعيد النظر فيه لاحقا». والربطُ أضعفُ القرارات الثلاثة: حكمُ تشابهٍ
   يُخطأ فيه ويُكتشف بعد أسبوعٍ حين يُقرأ الاقتراحُ ثانية. أمّا الرفضُ فجوابٌ
   وصل صاحبَه، و«صارت دورةً» أنشأت في الكتالوج شيئا له حياتُه — فيُطويان.

   فللمربوط حالٌ ثالثة: يبقى معروضا هنا، وأفعالُه في ملفّ صاحبه — يُربط بغيره،
   أو يُنقض ربطُه فيعود إلى الطابور، أو يُصحَّح نصُّه. والخادمُ يردّه في نطاق
   `open` (انظر `QUEUE_VISIBLE`). */
const OPEN = ["draft", "submitted", "info_requested"];

const SAID: Record<string, string> = {
  linked: "نسخة من رمز قائم",
  became_course: "صارت دورة في الكتالوج",
  rejected: "لم تقبل",
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
      .catch((e) => setErr(e instanceof ApiError ? e.message : "تعذّر بناء التقرير"));
  }, [open, scope]);

  return (
    <Card className="mb-4">
      <Button tone="ghost" icon={Layers} onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? "أخف تقرير التجميع" : "هل تشكّل هذه مسارات؟ — اعرض التقرير"}
      </Button>

      {open ? (
        <div className="mt-3">
          {loading ? (
            <div className="grid place-items-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" aria-label="جار الحساب" />
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
                            لا يصله هدف اليوم
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-1 text-sm leading-7 text-muted-foreground">{c.verdictAr}</p>

                      <div className="mt-1 text-xs text-muted-foreground/70">
                        الجمهور المشترك:{" "}
                        {c.commonStagesAr.length > 0 ? c.commonStagesAr.join(" · ") : "— لا جمهور يجمعها —"}
                      </div>

                      <ul className="mt-2 grid gap-1.5">
                        {c.proposals.map((p) => (
                          <li key={p.id} className="text-sm text-muted-foreground">
                            «<b className="text-foreground">{p.titleAr}</b>»
                            {p.trainerName ? <span className="text-muted-foreground/70"> — {p.trainerName}</span> : null}
                            <div className="text-xs text-muted-foreground/70">
                              أقرب رمز: {p.nearestCourseId} «{p.nearestTitleAr}»
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
                    لا تشترك عناوينها بأيّ كلمة مع الكتالوج، فلا مجال لها. فهي إمّا
                    <b> موضوع جديد فعلا</b>، أو عنوان غامض تسأل صاحبه عنه.
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
                <b>◆ مرشّح مسار</b> — {data.pathCourseCount} فأكثر بجمهور واحد. للقراءة فقط:
                المسار يحتاج هدفا ومشروعا ختاميّا وشهادة، لا عناوين متجاورة فحسب.
                {" · "}<b>◇ يقسم بالجمهور</b> — عددها يكفي لكن بلا جمهور مشترك.
                {" · "}<b>· دورة قائمة بنفسها</b> — ما دون ذلك.
                {" "}ومجال بلا هدف: الحلّ في بنك الأسئلة لا في مسار جديد.
              </p>
            </>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

export default function CourseProposals() {
  const { user } = useRealSession();
  /* والملفُّ بصلاحيّة قراءة الطلبات — فلا يُعرض بابٌ يردّه الخادم (كما في «المدربون») */
  const canOpenRecord = user?.permissions.includes("trainer.applications.view") ?? false;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [showDecided, setShowDecided] = useState(false);

  const load = useCallback(() => {
    apiGet<Row[]>(`/api/admin/course-proposals?scope=${showDecided ? "all" : "open"}`)
      .then((r) => { setRows(r); setErr(null); })
      .catch((e) => setErr(e instanceof ApiError ? e.message : "تعذّر تحميل القائمة"));
  }, [showDecided]);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(
    () => (rows ?? []).filter((r) => matchesQuery(q, [r.titleAr, r.summaryAr ?? "", r.trainerName, r.trainerEmail, r.details?.topicsAr, r.details?.closestCourseAr])),
    [rows, q],
  );

  const view = paginate(shown, page, 8);

  return (
    <AdminLayout title="دورات اقترحها المدرّبون">
      <Card className="mb-4">
        <p className="text-sm leading-7 text-muted-foreground">
          كلّ اقتراح هنا <b>ليس دورة بعد</b>. تقرّر فيه من <b>ملف صاحبه</b>، بجانب أجره ودوراته:
          نسخة من رمز قائم، أو دورة جديدة، أو اسأله، أو ليس الآن.
          {" "}وهنا القائمة عبر المدرّبين، وتقرير التجميع، وكرّاسة Claude.
        </p>
      </Card>

      {err ? (
        <Card tone="danger" role="alert" className="text-center text-read font-bold text-red-300">{err}</Card>
      ) : !rows ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground/50" aria-label="جار التحميل" />
        </div>
      ) : (
        <>
          <ClusterPanel key={showDecided ? "all" : "open"} scope={showDecided ? "all" : "open"} />
          <CourseDecisionsUpload onApplied={load} />

          <ListToolbar q={q} onQ={setQ} onPage={setPage} view={view} unit="اقتراحا"
            placeholder="ابحث بعنوان الدورة أو باسم المدرّب…" />

          <div className="mb-3 mt-2">
            <Button tone="ghost" onClick={() => setShowDecided(!showDecided)}>
              {showDecided ? "أخف المحسوم" : "أظهر المحسوم — المربوط والمرفوض"}
            </Button>
          </div>

          {view.total === 0 ? (
            <EmptyState
              icon={BookPlus}
              titleAr={showDecided ? "لا اقتراح يطابق بحثك" : "لا اقتراحات تنتظر قرارا"}
              reasonAr="هنا تصل الدورات التي يقترحها المدرّبون عند الانضمام أو من بوّابتهم، ولا تدخل الكتالوج قبل القرار فيها."
            />
          ) : (
            <div className="grid gap-3">
              {view.rows.map((r) => {
                const open = OPEN.includes(r.status);
                /* المربوطُ ليس مفتوحا — ولا هو منتهٍ: يُراجَع في ملفّ صاحبه */
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
                        {/* أجوبةُ الفورم — ما يُبنى عليه الدمجُ أو الإضافة بلا سؤالٍ ينتظر */}
                        {proposalDetailRows(r.details).length > 0 ? (
                          <dl className="mt-2 grid gap-x-5 gap-y-1 text-sm sm:grid-cols-2">
                            {proposalDetailRows(r.details).map((d) => (
                              <div key={d.labelAr} className="min-w-0">
                                <dt className="inline font-bold text-foreground">{d.labelAr}: </dt>
                                <dd className="inline whitespace-pre-wrap text-muted-foreground">{d.valueAr}</dd>
                              </div>
                            ))}
                          </dl>
                        ) : null}
                        <div className="mt-1 text-sm text-muted-foreground">
                          اقترحها <b className="text-foreground">{r.trainerName}</b>
                          <span className="text-muted-foreground/70"> · {r.trainerEmail}</span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground/70">
                          {r.decidedAt ? `صنّفت ${fmtDateLong(r.decidedAt)}` : `وصلت ${fmtDateLong(r.createdAt)}`}
                        </div>
                        {/* واقفٌ على جوابه هو — فلا يُقرأ الطابورُ كأنّه كلُّه ينتظرنا */}
                        {r.status === "info_requested" ? (
                          <span className="mt-2 inline-block rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-300">
                            سئل — ننتظر جوابه
                          </span>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {!open ? (
                          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold text-muted-foreground">
                            {SAID[r.status] ?? r.status}
                          </span>
                        ) : null}
                        {/* ═══ والقرارُ في ملفّه (قرارُ «A») — على الاقتراح نفسِه، لا في رأس الملفّ يُبحث عنه ═══ */}
                        {canOpenRecord ? (
                          <Button
                            as={Link} to={ideaRecordHref(r.applicationId, r.id)} size="sm" icon={ArrowLeft}
                            tone={open ? "confirm" : linked ? "secondary" : "ghost"}
                          >
                            {open ? "افتح ملفه وقرّر" : "افتح ملفه"}
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    {/* ما صارت إليه، وما قيل لصاحبها */}
                    {!open ? (
                      <Inset className="mt-3 text-sm leading-7 text-muted-foreground">
                        {linked ? (
                          <>
                            <b className="text-teal-light-ink">ربطت بـ «{r.courseTitleAr ?? r.courseId}»</b>
                            <span className="text-muted-foreground"> — تبقى هنا للمراجعة، ولا تدخل الكتالوج باسمها.</span>
                            {" "}
                          </>
                        ) : r.courseId ? (
                          <>الرمز: <b className="text-foreground">{r.courseId}</b>{r.courseTitleAr ? ` — ${r.courseTitleAr}` : ""}. </>
                        ) : null}
                        {r.decisionNoteAr || (r.status === "rejected" ? "بلا سبب مكتوب." : "")}
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
                          <p className="text-read text-muted-foreground">ولم يجب بعد.</p>
                        )}
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
