/* ═══ «خططٌ تنتظر اعتمادك» — كلُّ خطّةٍ أرسلها مدرّبٌ، في شاشةٍ واحدة (٣ أكتوبر ٢٠٢٦) ═══

   سؤالُ صاحب المنصّة: «كيف أعتمد كلَّ شعبةٍ أنهى مدرّبُها موادَّ دوراته وتنتظر
   اعتمادي؟». وكان الجوابُ: افتح الشعبَ واحدةً واحدة — من لوح دورات المدرّب في
   «العقود» إلى بطاقة كلّ شعبةٍ في «الشعب»، ولا موضعَ يقول كم ينتظر ولا أين.
   فاختار أن تُجمع: كلُّ خطّةٍ مرسَلةٍ من كلّ مدرّب، وأمام كلٍّ «اعتمدها» و«اطلب
   تعديلات».

   ── ولا اعتمادَ بالجملة ──

   الخيارُ كان «تقرأ كلَّ خطّة، لكن في موضعٍ واحد». فالخطّةُ تُفتح هنا بمراجعتها
   الكاملة نفسِها التي في بطاقة شعبتها (`TrainerPlanReview`) — المنهجُ وما تغيّر
   وما يُعتمَد معها — ولا زرَّ يعتمد ما لم يُفتح.

   ── وخططُ المدرّب الواحد معا ──

   مدرّبُ الإعداد يُفعَّل حين تُعتمَد دوراتُه كلُّها، فمن يعتمد يسأل «كم بقي له؟»
   لا «ما أقدمُ خطّة؟». فتُجمع خططُ كلِّ مدرّبٍ تحت اسمه، والمدرّبون بترتيب أقدم
   ما أرسلوه — فلا يُؤخَّر من انتظر أطول.

   ── وما قُضي لا يختفي من تحت عين قارئه ──

   الخطّةُ التي اعتُمدت أو رُدّت تبقى في موضعها معلَّمةً بما قُضي فيها حتّى تُفتح
   الشاشةُ ثانية: لو سقطت من القائمة ساعةَ القرار لقفزت الصفحةُ تحت يده، وضاعت
   رسالةُ ما وقع — وفيها: أهذه آخرُ دوراته ففُعِّل؟ */

import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { BookOpen, ChevronDown, ChevronUp, ClipboardCheck, Download, ExternalLink, ServerOff } from "lucide-react";
import AdminLayout from "./AdminLayout";
import { apiDownload, apiGet, ApiError } from "@/services/api";
import { fmtDateTimeAr } from "@/utils/format";
import { countAr } from "@/application/text/count-ar";
import { paginate } from "@/application/admin/paginate";
import { matchesQuery } from "@/application/text/search-ar";
import { Inset, Panel } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import ListToolbar from "@/components/admin/ListToolbar";
import WorkHeader from "@/components/admin/WorkHeader";
import { revealRow } from "@/components/admin/reveal";
import TrainerPlanReview, { type PlanOutcome } from "@/components/admin/TrainerPlanReview";
import { PlanEditsBulkUpload, PlanEditsDedupeAll } from "@/components/PlanEdits";
import { BUNDLE_SCOPES, type BundleScope } from "@/application/trainer/review-bundle-scopes";
import { ReviewReportsBulkUpload } from "@/components/ReviewReports";
import { useRealSession } from "@/services/session";
import { courseLineNeeded, prepNoteAr, sharedPrepNote, type PrepFlags } from "@/application/trainer/plan-decision";
import { roundLabelAr } from "@/application/trainer/plan-timeline";

/** خطّةٌ تنتظر — كما يردّها `CohortPlanService.pending` */
interface PendingPlan {
  id: string;
  cohort: { id: string; title: string; courseId: string };
  courseTitle: string;
  trainerName: string;
  trainerProfileId: string | null;
  submittedAt: string | null;
  trainerConfirmedAt: string | null;
  /** كم مرّةً رُدّت إليه — «جديدة» أم «الجولة ٢» (`plan-timeline.ts`) */
  returns?: number;
  /** متى رُدّت إليه — للمردودة */
  reviewedAt?: string | null;
  /* شعبةُ إعداد؟ — `qualifies`: اعتمادُها يؤهّله لدورتها، و`onboarding`: هو في
     الطور فقد يفعّله اعتمادُها إن كانت آخرَ ما ينتظر (`trainer-prep.service.ts`) */
  prep: PrepFlags | null;
}

const PLAN_FORMS = { one: "خطّة", two: "خطّتان", few: "خطط", many: "خطّة" };
const PAGE = 20;

/** «خطّتان» لا «2 خطّتان»: المفردُ والمثنّى يُقرآن بلا رقمهما */
function plansAr(n: number): string {
  if (n === 1) return "خطّة واحدة";
  if (n === 2) return "خطّتان";
  return countAr(n, PLAN_FORMS);
}

/** «من مدرّبٍ واحد» لا «من 1 مدرّب» — والعددُ يُقرأ لا يُحسب */
function fromTrainersAr(n: number): string {
  if (n === 1) return "من مدرّب واحد";
  if (n === 2) return "من مدرّبين";
  return `من ${countAr(n, { one: "مدرّب", two: "مدرّبين", few: "مدرّبين", many: "مدرّبا" })}`;
}

const trainerKey = (r: PendingPlan) => r.trainerProfileId ?? `name:${r.trainerName}`;

/** خططُ كلِّ مدرّبٍ متجاورة، والمدرّبون بترتيب أقدم ما أرسلوه. والفرزُ ثابتٌ،
    فالخادمُ يردّها أقدمَها أوّلا فتبقى كذلك داخل كلّ مدرّب. */
function byTrainer(rows: readonly PendingPlan[]): PendingPlan[] {
  const first = new Map<string, number>();
  rows.forEach((r, i) => { if (!first.has(trainerKey(r))) first.set(trainerKey(r), i); });
  return [...rows].sort((a, b) => first.get(trainerKey(a))! - first.get(trainerKey(b))!);
}

/** خططُ كلِّ مدرّبٍ معا — من قائمةٍ رُتّبت بـ`byTrainer` */
function trainerGroups(rows: readonly PendingPlan[]): { key: string; name: string; rows: PendingPlan[] }[] {
  const groups: { key: string; name: string; rows: PendingPlan[] }[] = [];
  for (const r of rows) {
    const last = groups[groups.length - 1];
    if (last && last.key === trainerKey(r)) last.rows.push(r);
    else groups.push({ key: trainerKey(r), name: r.trainerName, rows: [r] });
  }
  return groups;
}

/* ═══ وكلُّ مدرّبٍ خانةٌ تنضمّ وتنسدل (١٧ أكتوبر ٢٠٢٦) ═══

   «اريد ان يكون لكل مدرب خانه يمكن ضمها وانسدالها للسهوله» (صاحب المنصّة) — كشريط المدرّبين في
   العقود (`TrainerContracts.tsx`). فالمطويّةُ سطرٌ: الاسمُ وكم ينتظر منه، وخططُه كلُّها تحته حين تنسدل. */
function TrainerStrip({ heading: H, name, status, shown, controls, onToggle, children }: {
  heading: "h2" | "h3"; name: string; status: string; shown: boolean; controls: string; onToggle: () => void;
  children?: React.ReactNode;
}) {
  return (
    <H>
      <Inset as="button" type="button" interactive aria-expanded={shown} aria-controls={controls} onClick={onToggle}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 text-start text-read">
        <ChevronDown aria-hidden="true"
          className={`h-4 w-4 shrink-0 opacity-60 transition-transform ${shown ? "rotate-180" : ""}`} />
        <b className="min-w-0 font-black text-foreground">{name}</b>
        <span className="text-muted-foreground">{status}</span>
        {children}
      </Inset>
    </H>
  );
}

const OUTCOME_AR: Record<PlanOutcome, { label: string; tone: "positive" | "warn" }> = {
  approved: { label: "اعتمدت الآن", tone: "positive" },
  changes_requested: { label: "ردّت بملاحظاتك", tone: "warn" },
  postponed: { label: "أجّلت إلى موسم قادم", tone: "warn" },
};

export default function PendingPlans() {
  const [rows, setRows] = useState<PendingPlan[] | null>(null);
  /* ═══ والمردودةُ إلى مدرّبيها — تُعتمد من هنا أيضا (١٧ أكتوبر ٢٠٢٦) ═══
     «اريد ان اعتمد التعديلات واعتمد الدوره نفسها.. ولكن اريد ان تبقى تعديلاتي ظاهره امامه» (صاحب المنصّة) — واختار
     «Yes, for returned plans». فلها قائمتُها تحت المنتظِرة، وبطاقتُها نفسُها: «اعتمدها» يعتمد ما حفظه المدرّب */
  const [returned, setReturned] = useState<PendingPlan[]>([]);
  const [offline, setOffline] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  /* من لوح دورات المدرّب في «العقود»: خططُه وحدَه، وخطّةُ الشعبة المنقورة مفتوحة */
  const trainerFilter = params.get("trainer");
  const wantedCohort = params.get("cohort");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [decided, setDecided] = useState<Record<string, PlanOutcome>>({});
  /* وخانةُ كلِّ مدرّبٍ مطويّةٌ ابتداءً — إلّا مدرّبا وحيدا في قائمته، فلا شيءَ يُختار بينه */
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({});
  const groupShown = (key: string, alone: boolean) => groupOpen[key] ?? alone;
  const toggleGroup = (key: string, alone: boolean) => setGroupOpen((s) => ({ ...s, [key]: !(s[key] ?? alone) }));
  /* ═══ وملفّاتُ التعديلات كلُّها دفعةً واحدة (١٠ أكتوبر ٢٠٢٦) ═══
     «I need one place to upload all of them same time!» (صاحب المنصّة). والرفعُ لمن يعتمد
     وحدَه كما في البطاقة، وكلُّ خطّةٍ رُفع إليها تُعاد بطاقتُها إن كانت مفتوحة — فتُرى بنودُها. */
  const { user: viewer } = useRealSession();
  const canUploadEdits = viewer?.permissions.includes("cohort.plan.approve") ?? false;
  const [uploaded, setUploaded] = useState<Record<string, number>>({});
  /* ═══ والطابورُ كلُّه حزمةً واحدة (٧ أكتوبر ٢٠٢٦) ═══
     قرارُ صاحب المنصّة: زرُّ تنزيلٍ تُراجَع به الخططُ خارجَ المنصّة. لكلّ خطّةٍ
     مجلّدُها في ZIP واحد بترتيب الطابور، وفي رأسه فهرس (`plan-review-bundle.service.ts`).
     والزرُّ للطابور كلِّه وإن كان البحثُ أو المدرّبُ مصفّى — يُقال ذلك بجانبه. */
  const [bundle, setBundle] = useState<{ busy: boolean; msg: string }>({ busy: false, msg: "" });
  /* ═══ وحزمةٌ ثانيةٌ للخطط المفتوحة كلِّها — ومنها ما عند المدرّبين (١٢ أكتوبر ٢٠٢٦) ═══
     «طبّق ذلك على كلّ خطّةٍ أرسلتُها إلى المدرّبين» (صاحب المنصّة) — وحزمةُ المنتظِرة لا تحملها. والزرّان
     معا بما يقع بكلٍّ: المنتظِرةُ وحدَها، أو المفتوحةُ كلُّها بما فعله المدرّبون بالتعديلات (`allOpen`). */
  const downloadAll = async (scope: BundleScope = "pending") => {
    if (bundle.busy) return;
    setBundle({ busy: true, msg: "" });
    try {
      const name = await apiDownload(BUNDLE_SCOPES[scope].path, BUNDLE_SCOPES[scope].fileName);
      setBundle({ busy: false, msg: `نزّلت «${name}» — ولم يتغيّر في أيّ خطّة شيء.` });
    } catch (e) {
      setBundle({ busy: false, msg: e instanceof ApiError ? e.message : "تعذّر التنزيل" });
    }
  };
  /* الخطّةُ التي تُبلَغ بعد أن تُرسَم — مرجعٌ لا حال: بلوغُها أثرٌ في الصفحة
     لا شيءٌ يُرسَم، فلا يُحدث رسما ثانيا */
  const revealNext = useRef<string | null>(null);
  useEffect(() => {
    if (!revealNext.current) return;
    revealRow(`plan-${revealNext.current}`);
    revealNext.current = null;
  });

  /* بلوغُ خطّةٍ بعينها: صفحتُها، ثمّ فتحُها، ثمّ الانزلاقُ إليها بعد أن تُرسَم */
  const goTo = useCallback((list: readonly PendingPlan[], id: string) => {
    const at = list.findIndex((r) => r.id === id);
    if (at < 0) return;
    revealNext.current = id;
    setPage(Math.floor(at / PAGE) + 1);
    setOpen((s) => new Set(s).add(id));
    /* وخانةُ مدرّبها تنسدل — لا تُبلَغ خطّةٌ في خانةٍ مطويّة */
    setGroupOpen((s) => ({ ...s, [trainerKey(list[at]!)]: true }));
  }, []);

  useEffect(() => {
    let alive = true;
    apiGet<PendingPlan[]>("/api/admin/cohort-plans/returned")
      .then((r) => { if (alive) setReturned(r); })
      .catch(() => { /* الصفحةُ تُقرأ بلا المردودة */ });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    apiGet<PendingPlan[]>("/api/admin/cohort-plans/pending")
      .then((r) => {
        if (!alive) return;
        setRows(r);
        setOffline(null);
        /* والرابطُ الذي يسمّي شعبةً يفتح خطّتَها عند الوصول (من لوح دورات المدرّب) */
        if (!wantedCohort) return;
        const list = byTrainer(r.filter((x) => !trainerFilter || x.trainerProfileId === trainerFilter));
        const hit = list.find((x) => x.cohort.id === wantedCohort);
        if (hit) goTo(list, hit.id);
      })
      .catch((e: unknown) => { if (alive) setOffline(e instanceof ApiError ? e.message : "الخادم غير متصل"); });
    return () => { alive = false; };
  }, [wantedCohort, trainerFilter, goTo]);

  const scoped = (rows ?? []).filter((r) => !trainerFilter || r.trainerProfileId === trainerFilter);
  const returnedScoped = returned.filter((r) => !trainerFilter || r.trainerProfileId === trainerFilter);
  /* يُبحث بالشعبة والدورة والمدرّب — وهي ما يُسأل به فعلا */
  const ordered = byTrainer(scoped.filter((r) => matchesQuery(q, [r.cohort.title, r.courseTitle, r.trainerName])));
  const view = paginate(ordered, page, PAGE);
  const waiting = scoped.filter((r) => !decided[r.id]);
  const filteredName = trainerFilter ? scoped[0]?.trainerName ?? null : null;

  const toggle = (id: string) => setOpen((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  if (offline) {
    return (
      <AdminLayout title="خطط تنتظر اعتمادك">
        <Panel className="grid place-items-center py-20 text-center">
          <ServerOff className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-xl font-black">لا يمكن الوصول للبيانات</h2>
          <p className="mt-2 max-w-md text-read leading-7 text-muted-foreground">{offline}</p>
        </Panel>
      </AdminLayout>
    );
  }

  /* مجموعاتُ الصفحة المعروضة — والعددُ تحت كلّ اسمٍ من القائمة كلِّها لا من الصفحة */
  const groups = trainerGroups(view.rows);
  const pendingAlone = new Set(ordered.map(trainerKey)).size === 1;
  const returnedGroups = trainerGroups(byTrainer(returnedScoped));
  const returnedAlone = returnedGroups.length === 1;
  const trainers = new Set(waiting.map(trainerKey)).size;
  const inPrep = waiting.filter((r) => r.prep?.onboarding).length;

  return (
    <AdminLayout title="خطط تنتظر اعتمادك">
      <p className="mb-4 max-w-3xl text-read leading-7 text-muted-foreground">
        خطط الشعب التي أرسلها المدرّبون وأكّدوا موافقتهم عليها، مرتّبة باسم كل مدرّب.
        افتح الخطّة لتقرأ منهجها كاملا، ثمّ «اعتمدها» أو «اطلب تعديلات». ولا يفتح تسجيل الشعبة قبل اعتماد خطّتها.
      </p>

      {rows !== null && (
        <Inset className="mb-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          {rows.length > 0 && (
            <>
              <p className="max-w-2xl text-read leading-6 text-muted-foreground">
                للمراجعة خارج المنصّة: ملفّ مضغوط فيه كل الخطط المنتظرة ({plansAr(rows.length)}) بمناهجها وملفّاتها.
                {(trainerFilter || q) && " ويشمل ما أخفته التصفية."}
              </p>
              <Button size="sm" tone="secondary" icon={Download} disabled={bundle.busy} onClick={() => void downloadAll("pending")}>
                {bundle.busy ? "يجهّز التنزيل…" : "نزّل الخطط كلّها للمراجعة"}
              </Button>
            </>
          )}
          <p className="max-w-2xl text-read leading-6 text-muted-foreground">{BUNDLE_SCOPES.open.whatAr}</p>
          <Button size="sm" tone="secondary" icon={Download} disabled={bundle.busy} onClick={() => void downloadAll("open")}>
            {bundle.busy ? "يجهّز التنزيل…" : BUNDLE_SCOPES.open.labelAr}
          </Button>
          {bundle.msg && <p className="w-full text-read font-bold text-teal-light-ink" role="status">{bundle.msg}</p>}
        </Inset>
      )}

      {rows !== null && canUploadEdits && (
        <PlanEditsBulkUpload
          plans={[...scoped, ...returnedScoped].map((r) => ({ id: r.id, labelAr: `${r.cohort.title} — ${r.trainerName}` }))}
          onUploaded={(id) => setUploaded((u) => ({ ...u, [id]: (u[id] ?? 0) + 1 }))}
          onOpen={(id) => { setQ(""); goTo(byTrainer(scoped), id); }}
        />
      )}
      {/* و«احذف المكرر» للخطط المفتوحة كلِّها — ولو لم تكن في هذه القائمة (١٢ أكتوبر ٢٠٢٦، `keepLatestAll`) */}
      {rows !== null && canUploadEdits && (
        <PlanEditsDedupeAll onCleaned={(id) => setUploaded((u) => ({ ...u, [id]: (u[id] ?? 0) + 1 }))} />
      )}
      {/* وتقاريرُ المراجعة وملاحقُها كذلك — دفعةً واحدة، لمن يعتمد (١١ أكتوبر ٢٠٢٦) */}
      {rows !== null && canUploadEdits && (
        <ReviewReportsBulkUpload
          plans={scoped.map((r) => ({ id: r.id, labelAr: `${r.cohort.title} — ${r.trainerName}`, trainerName: r.trainerName, cohortTitle: r.cohort.title }))}
          onUploaded={(id) => setUploaded((u) => ({ ...u, [id]: (u[id] ?? 0) + 1 }))}
          onOpen={(id) => { setQ(""); goTo(byTrainer(scoped), id); }}
        />
      )}

      {trainerFilter && (
        <Inset className="mb-4 flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <p className="text-read text-foreground">
            {filteredName ? <>تعرض خطط <b>{filteredName}</b> وحدها.</> : "لا خطّة تنتظر اعتمادك لهذا المدرّب الآن."}
          </p>
          <Button size="sm" tone="ghost" onClick={() => {
            setParams((p) => { const n = new URLSearchParams(p); n.delete("trainer"); n.delete("cohort"); return n; });
            setPage(1);
          }}>
            اعرض خطط المدرّبين كلّهم
          </Button>
        </Inset>
      )}

      <WorkHeader
        loading={rows === null}
        icon={ClipboardCheck}
        count={waiting.length}
        forms={PLAN_FORMS}
        waitingAr="تنتظر اعتمادك"
        stats={rows ? [
          fromTrainersAr(trainers),
          ...(inPrep > 0 ? [`في طور الإعداد: ${plansAr(inPrep)}`] : []),
        ] : []}
        actionAr="ابدأ بأقدمها"
        /* الأقدمُ أوّلُ ما لم يُقضَ فيه في الترتيب المعروض — والبحثُ قد يُخفيه */
        disabledReasonAr={waiting.length > 0 && !ordered.some((r) => !decided[r.id])
          ? "البحث الحاليّ يخفي الخطط المنتظرة — امسحه."
          : undefined}
        onAction={() => {
          const first = ordered.find((r) => !decided[r.id]);
          if (first) goTo(ordered, first.id);
        }}
        doneAr="لا خطّة تنتظر اعتمادك. حين يرسل مدرّب خطّته تظهر هنا، ويظهر عددها بجانب اسم الشاشة."
      />

      {rows !== null && scoped.length > 0 && (
        <>
          <ListToolbar q={q} onQ={setQ} onPage={setPage} view={view} unit="خطّة"
            placeholder="ابحث باسم الشعبة أو الدورة أو المدرّب…" />
          {view.rows.length === 0 ? (
            /* «لا نتائج» غيرُ «لا خطط»: الأولى تُمسح كلمتُها، والثانية تُنتظر */
            <Panel as="p" className="py-12 text-center text-read text-muted-foreground">
              لا خطّة تطابق بحثك — امسح الكلمة أو جرّب غيرها.
            </Panel>
          ) : (
            <div className="space-y-6">
              {groups.map((g, gi) => {
                const all = scoped.filter((r) => trainerKey(r) === g.key);
                const left = all.filter((r) => !decided[r.id]).length;
                const onboarding = all.some((r) => r.prep?.onboarding);
                /* جملةُ شعبة الإعداد مرّةً في رأسه إن صدقت على بطاقاته كلِّها (⑨) */
                const shared = sharedPrepNote(g.rows.map((r) => ({ prep: r.prep, decided: Boolean(decided[r.id]) })));
                const shown = groupShown(g.key, pendingAlone);
                return (
                  <section key={g.key} aria-label={`خطط ${g.name}`}>
                    <TrainerStrip heading="h2" name={g.name} shown={shown} controls={`trainer-plans-${gi}`}
                      onToggle={() => toggleGroup(g.key, pendingAlone)}
                      status={left > 0 ? `${plansAr(left)} ${left === 2 ? "تنتظران" : "تنتظر"}` : "انتهت كلّها"}>
                      {onboarding && <Chip tone="accent" srPrefixAr="المرحلة">في مرحلة الإعداد</Chip>}
                    </TrainerStrip>
                    {shown && (
                      <div id={`trainer-plans-${gi}`} className="mt-2">
                        {onboarding && (
                          <p className="mt-1 text-read leading-6 text-muted-foreground">
                            في مرحلة الإعداد — يفعّل حين تعتمد كل دورات الإعداد، وتجد عند كل خطّة كم بقي.
                          </p>
                        )}
                        {shared && <p className="mt-1 text-read leading-6 text-muted-foreground">{shared}</p>}
                        <ul className="mt-3 space-y-3">
                          {g.rows.map((r) => {
                            const isOpen = open.has(r.id);
                            const done = decided[r.id];
                            /* اسمُ الدورة حين لا يحمله اسمُ الشعبة وحدَه (⑨) */
                            const sent = r.submittedAt ? `أرسلها ${fmtDateTimeAr(r.submittedAt)}` : "";
                            const facts = [courseLineNeeded(r.cohort.title, r.courseTitle) ? `دورة «${r.courseTitle}»` : "", sent]
                              .filter(Boolean).join(" · ")
                              + (r.trainerConfirmedAt ? `${sent ? " و" : ""}أكّد موافقته على كلّ ما فيها` : "");
                            return (
                              /* هدفُ زرِّ الرأس — يقبل التركيزَ ليُقرأ حين يُبلَغ بلوحة المفاتيح */
                              <Panel as="li" key={r.id} id={`plan-${r.id}`} tabIndex={-1} className="outline-none">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-read font-black text-foreground">{r.cohort.title}</p>
                                    {facts && <p className="mt-1 text-read leading-6 text-muted-foreground">{facts}</p>}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    {/* جديدةٌ أم أعادها بعد ردّها — يُرى قبل الفتح (١٧ أكتوبر ٢٠٢٦) */}
                                    {r.returns !== undefined && (
                                      <Chip tone={r.returns === 0 ? "info" : "warn"} srPrefixAr="جولتها">{roundLabelAr(r.returns)}</Chip>
                                    )}
                                    {r.prep && <Chip tone="accent" srPrefixAr="نوعها">شعبة إعداد</Chip>}
                                    {done && <Chip tone={OUTCOME_AR[done].tone} srPrefixAr="القرار">{OUTCOME_AR[done].label}</Chip>}
                                  </div>
                                </div>
                                {r.prep && !done && !shared && (
                                  <p className="mt-2 text-read leading-6 text-muted-foreground">{prepNoteAr(r.prep)}</p>
                                )}
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                  <Button size="sm" tone={isOpen ? "ghost" : "primary"} icon={isOpen ? ChevronUp : BookOpen}
                                    aria-expanded={isOpen} onClick={() => toggle(r.id)}>
                                    {isOpen ? "اطوها" : done ? "اعرضها" : "اقرأها وقرّر"}
                                  </Button>
                                  <Button as={Link} to={`/admin/cohorts?cohort=${r.cohort.id}`} size="sm" tone="ghost" icon={ExternalLink}>
                                    افتح بطاقة الشعبة
                                  </Button>
                                </div>
                                {/* تُجلب حين تُفتح لا قبلها: عشرون خطّةً لا تُجلب مناهجُها
                                    كلُّها لمن جاء ليقرأ واحدة */}
                                {isOpen && (
                                  <div className="mt-4 border-t border-white/10 pt-4">
                                    <TrainerPlanReview
                                      cohortId={r.cohort.id}
                                      key={`${r.id}:${uploaded[r.id] ?? 0}`}
                                      cohortTitle={r.cohort.title}
                                      onPlanDecided={(outcome) => setDecided((d) => ({ ...d, [r.id]: outcome }))}
                                    />
                                  </div>
                                )}
                              </Panel>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}

      {returnedScoped.length > 0 && (
        <section aria-label="خطط رددتها إلى مدربيها" className="mt-8">
          <h2 className="text-read font-black text-foreground">
            رددتها إلى مدربيها ({returnedScoped.length})
          </h2>
          <p className="mt-1 max-w-3xl text-read leading-6 text-muted-foreground">
            خطط رددتها بـ«اطلب تعديلات» وهي عند مدربيها. لك أن تعتمدها الآن بما حفظوه فيها، وتبقى بطاقاتك عندهم اقتراحات يقبلونها أو يرفضونها.
          </p>
          <div className="mt-3 space-y-4">
            {returnedGroups.map((g, gi) => {
              const left = g.rows.filter((r) => !decided[r.id]).length;
              const shown = groupShown(`ret:${g.key}`, returnedAlone);
              return (
                <section key={g.key} aria-label={`خطط ${g.name} المردودة`}>
                  <TrainerStrip heading="h3" name={g.name} shown={shown} controls={`returned-plans-${gi}`}
                    onToggle={() => toggleGroup(`ret:${g.key}`, returnedAlone)}
                    status={left > 0 ? plansAr(left) : "انتهت كلّها"} />
                  {shown && (
                    <ul id={`returned-plans-${gi}`} className="mt-2 space-y-3">
                      {g.rows.map((r) => {
                        const isOpen = open.has(r.id);
                        const done = decided[r.id];
                        return (
                          <Panel as="li" key={r.id} id={`plan-${r.id}`} tabIndex={-1} className="outline-none">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-read font-black text-foreground">{r.cohort.title}</p>
                                {r.reviewedAt && (
                                  <p className="mt-1 text-read leading-6 text-muted-foreground">رددتها {fmtDateTimeAr(r.reviewedAt)}</p>
                                )}
                              </div>
                              {done && <Chip tone={OUTCOME_AR[done].tone} srPrefixAr="القرار">{OUTCOME_AR[done].label}</Chip>}
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <Button size="sm" tone={isOpen ? "ghost" : "secondary"} icon={isOpen ? ChevronUp : BookOpen}
                                aria-expanded={isOpen} onClick={() => toggle(r.id)}>
                                {isOpen ? "اطوها" : done ? "اعرضها" : "اقرأها وقرّر"}
                              </Button>
                              <Button as={Link} to={`/admin/cohorts?cohort=${r.cohort.id}`} size="sm" tone="ghost" icon={ExternalLink}>
                                افتح بطاقة الشعبة
                              </Button>
                            </div>
                            {isOpen && (
                              <div className="mt-4 border-t border-white/10 pt-4">
                                <TrainerPlanReview
                                  cohortId={r.cohort.id}
                                  key={`${r.id}:${uploaded[r.id] ?? 0}`}
                                  cohortTitle={r.cohort.title}
                                  onPlanDecided={(outcome) => setDecided((d) => ({ ...d, [r.id]: outcome }))}
                                />
                              </div>
                            )}
                          </Panel>
                        );
                      })}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </section>
      )}
    </AdminLayout>
  );
}
