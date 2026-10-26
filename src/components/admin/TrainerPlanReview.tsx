/* ═══ مراجعةُ خطّة المدرّب لشعبةٍ واحدة — تُقرأ كاملةً ويُقرَّر فيها ═══

   كانت قسما في بطاقة الشعبة (`src/pages/admin/CohortOps.tsx`) وحدَها. وسأل
   صاحبُ المنصّة (٣ أكتوبر ٢٠٢٦): كيف أعتمد كلَّ شعبةٍ أنهى مدرّبُها موادَّها
   وتنتظرني؟ وكان الجوابُ أن يفتح شعبةً شعبة — كلُّ خطّةٍ في بطاقتها، ولا موضعَ
   يجمعها. فصارت مكوّنا يُعرض في الموضعين: بطاقةِ الشعبة، و«خططٌ تنتظر اعتمادك»
   (`src/pages/admin/PendingPlans.tsx`) التي تجمع خططَ المدرّبين كلِّهم.

   والمراجعةُ **واحدةٌ فيهما بقصد**: ما يُقرأ قبل الاعتماد لا يختلف باختلاف
   الباب. فلا يُعتمَد من الطابور منهجٌ أقصرُ ممّا يُعتمَد من البطاقة — المنهجُ
   كاملا، وما تغيّر عن المعتمَد، وملاحظاتُ الردّ السابق، واللقاءاتُ والمهامُّ
   التي تُعتمَد معها. */
import { useCallback, useEffect, useRef, useState } from "react";
import { apiDownload, apiGet, apiPost, ApiError } from "@/services/api";
import { useRealSession } from "@/services/session";
import { fmtDateAr, fmtDateTimeAr } from "@/utils/format";
import type { PlanSlot } from "@/application/trainer/axis-timeline";
import CurriculumReview from "@/components/CurriculumReview";
import { asLevelRange, levelRangeAr } from "@/application/trainer/cohort-level";
import { asAudience, goalsAr, stagesAr } from "@/application/trainer/cohort-audience";
import { ReviewNotesList } from "@/components/ReviewNotes";
import { PendingTasks } from "@/components/PendingTasks";
import { awaitingTasks } from "@/application/trainer/task-approval";
import { PlanDiffList, SinceReturnList } from "@/components/PlanDiff";
import { planDiff, sinceReturn } from "@/application/trainer/plan-diff";
import { REVIEW_NOTE_MAX, hasReviewNotes, type ReviewNotes } from "@/application/trainer/review-notes";
import { StaffField, staffAreaCls } from "@/components/FormKit";
import { REVIEW_REPORT_ACCEPT, ReviewReportFiles, type ReviewReport } from "@/components/ReviewReports";
import { useReviewReports } from "@/hooks/useReviewReports";
import { PlanEditsDrafts, PlanEditsSent, PlanEditsSetAside } from "@/components/PlanEdits";
import { usePlanEdits } from "@/hooks/usePlanEdits";
import { curriculumView, type CurriculumInput } from "@/application/trainer/curriculum-view";
import { PLAN_AR, approvalBody, planApprovedMsg, taskDecisionMsg, type PlanDecision } from "@/application/trainer/plan-decision";
import { adminRegistrationLine } from "@/application/learning/registration-state";
import TrainerNextSteps from "@/components/admin/TrainerNextSteps";
import { signalPlansChanged } from "@/services/plans-signal";
import { Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { CalendarClock, ChevronDown, Download, ExternalLink, FileJson, Upload, Wrench } from "lucide-react";
import { Link } from "react-router";
import TabBar from "@/components/ui/TabBar";
import PlanTimeline from "@/components/admin/PlanTimeline";
import { cohortDayAr } from "@/application/learning/cohort-gate";
import { ownMaterialLabels, type WorkbookContent } from "@/application/trainer/cohort-workbooks";
import PlanScorecard from "@/components/PlanScorecard";
import { postponeChoices, postponedLineAr, seasonAr, seasonStart, type Season } from "@/application/trainer/plan-postpone";
import { blockedItems, planScorecard } from "@/application/trainer/plan-scorecard";
import { WORKSPACE_TABS, cardTally, cardsLineAr, draftsLineAr, planSizeAr, scoreLineAr, workspaceTabAr, type WorkspaceTab } from "@/application/trainer/plan-workspace";

export interface TrainerPlan {
  id: string; status: string; reviewerNote: string | null; trainerName: string | null;
  /* رفع مدرّبُها كرّاسةً قبل قالب وجيز — فالقالبُ له مستحسَنٌ لا إلزاميّ (٦ أكتوبر ٢٠٢٦) */
  workbookBeforeTemplate?: boolean;
  /* ملاحظاتُ الردّ لكلّ خطوة — تبقى بعد إعادة الإرسال ليُقابَل بها ما عُدّل (٣ب) */
  reviewerNotes?: ReviewNotes;
  submittedAt: string | null; trainerConfirmedAt: string | null; reviewedAt: string | null;
  /* المنهجُ كاملا للمعتمِد — لقاءاتُ الشعبة ومهامُّها مع خطّتها (المرحلة ٣) */
  cohortTitle: string;
  period: { startsOn: string; endsOn: string } | null;
  sessions: CurriculumInput["sessions"];
  assessments: CurriculumInput["assessments"];
  /* التسجيلُ كما يُحكَم — لا يُفتح قبل الاعتماد، والالتحاقُ حتّى الموعد الثاني (٣ج)،
     وعلمُ الشعبة نفسُه: شعبةُ الإعداد لا يرفعه اعتمادُها (٣ أكتوبر ٢٠٢٦) */
  registration?: { awaitingPlan: boolean; joinClosesAt: string | null; registrationOpen?: boolean };
  /* اعتُمدت للمدرّب خطّةٌ قطّ — فما يغيّره في مهامّه بعدها ينتظر قرارَك (٣ج-٣) */
  approvedOnce?: boolean;
  /* والمعتمَدةُ التي تراجعها هذه إن كانت مراجعة — منها «ما تغيّر» (٣ج-٤) */
  approvedPlan?: { content: unknown; reviewedAt: string | null } | null;
  /* والخطّةُ كما رُدّت إن أُعيد إرسالُها بعد ردّ — منها «ما تغيّر منذ ردّك» (⑦) */
  returned?: { content: unknown; at: string | null } | null;
  /* وتقريرُ المراجعة المرفوعُ لهذه الخطّة — تذكره رسالةُ القرار (٨ أكتوبر ٢٠٢٦) */
  reviewReports?: ReviewReport[];
  /* مؤجّلةٌ إلى موسمٍ قادم — أوّلُ يومٍ فيه (٨ أكتوبر ٢٠٢٦، `plan-postpone.ts`) */
  postponedTo?: string | null;
  content: ({
    summaryAr?: string | null; modules?: { moduleId: string; titleAr: string }[]; resources?: { title: string; url: string }[];
    /* مدّةُ الشعبة كما حدّدها مدرّبُها — تُعتمَد مع الخطّة (٢٧ سبتمبر ٢٠٢٦) */
    startsOn?: string | null; endsOn?: string | null;
    /* مستوى الشعبة — مدًى من الثلاثة (٦ أكتوبر ٢٠٢٦)، ويُقرأ بـ`asLevelRange` */
    level?: unknown;
    /* لمن هي وماذا يريد متعلّمُها (٦ أكتوبر ٢٠٢٦) — ويُقرأ بـ`asAudience` */
    audience?: unknown;
    /* ومواعيدُ المحاور وكرّاساتُها — `application/trainer/axis-timeline.ts` */
    slots?: PlanSlot[] | null;
    /* والكرّاسةُ: للدورة أو لكلّ محور، وما قاله المدرّبُ في كلٍّ — `cohort-workbooks.ts` */
  } & WorkbookContent) | null;
}
/** لقاءٌ مباشرٌ ينتظر قرارَ الإدارة — يجدوله المدرّبُ ولا يُعلَن حتّى يُعتمَد */
interface PendingSession {
  id: string; title: string; startsAt: string; endsAt: string | null; noteAr: string | null;
  attachmentName: string | null; createdAt: string;
  cohort: { id: string; title: string };
  /* يُعتمَد مع خطّة الشعبة لا وحدَه — ما دامت لم تُعتمَد لمدرّبها خطّةٌ قطّ (٣ب) */
  withPlan?: boolean;
}

/** القرارُ في الخطّة نفسِها — للطابور يعلّمها مقضيّةً ولا يُسقطها من تحت عين قارئها */
export type PlanOutcome = "approved" | "changes_requested" | "postponed";

export default function TrainerPlanReview({ cohortId, cohortTitle, onDone, onPlanDecided }: {
  cohortId: string;
  /** اسمُ الشعبة كما في القائمة — عنوانُ المنهج إن خلت منه الخطّة */
  cohortTitle: string;
  /** بعد كلّ فعلٍ نجح — برسالته */
  onDone?: (msg: string) => void;
  onPlanDecided?: (outcome: PlanOutcome) => void;
}) {
  const [busy, setBusy] = useState(false);
  /* أيُّ الألسنة الثلاثة اختير — وقبل الاختيار يُحسب من حال الخطّة (`tab` أدناه) */
  const [tabPick, setTab] = useState<WorkspaceTab | null>(null);
  const [msg, setMsg] = useState("");
  /* خطّةُ المدرّب لهذه الشعبة — يعتمدها من يملك `cohort.plan.approve` (الأكاديميُّ
     والأعلى)، ويذكّره بها من يدير الشعبة. */
  const { user: viewer } = useRealSession();
  const canApprovePlan = viewer?.permissions.includes("cohort.plan.approve") ?? false;
  /* ومراجعةُ التعديلات المقترحة قبل أن تصل المدرّب (١٠ أكتوبر ٢٠٢٦) */
  const canReviewEdits = viewer?.permissions.includes("cohort.plan.edits.review") ?? false;
  const [trainerPlan, setTrainerPlan] = useState<TrainerPlan | null>(null);
  const loadPlan = useCallback(async () => {
    try { setTrainerPlan(await apiGet<TrainerPlan | null>(`/api/admin/cohorts/${cohortId}/trainer-plan`)); }
    catch { setTrainerPlan(null); }
  }, [cohortId]);
  useEffect(() => { void loadPlan(); }, [loadPlan]);
  /* ═══ ولقاءاتُ هذه الشعبة المنتظِرة — في الطابور نفسِه (١٥ سبتمبر ٢٠٢٦) ═══

     «الموافقةُ في طابور الإدارة الحالي» (صاحب المنصّة). فلا شاشةٌ ثانيةٌ
     يُنسى فتحُها: من فتح الشعبةَ ليعتمد خطّتَها يجد لقاءاتِها المنتظِرةَ
     تحتها، ويقرّر في الموضع نفسِه. */
  const [pendingSessions, setPendingSessions] = useState<PendingSession[]>([]);
  const loadPendingSessions = useCallback(async () => {
    try { setPendingSessions(await apiGet<PendingSession[]>(`/api/admin/cohort-sessions/pending?cohortId=${cohortId}`)); }
    catch { setPendingSessions([]); }
  }, [cohortId]);
  useEffect(() => { void loadPendingSessions(); }, [loadPendingSessions]);
  /* ═══ الاعتمادُ واحد، والردُّ لكلّ خطوةٍ ملاحظتُها (٣ب) ═══

     ما يُعتمَد مع الخطّة من اللقاءات لا يُعرض بطاقةً بطاقة — يُعدّ على زرّ
     اعتمادها. وما بقي بطاقاتٍ فتغييرٌ بعد اعتمادٍ سابق يُقرَّر وحدَه. */
  const riding = pendingSessions.filter((p) => p.withPlan);
  const individual = pendingSessions.filter((p) => !p.withPlan);
  /* ومهامُّ ما بعد الاعتماد المنتظِرة — بالقاعدة التي يحكم بها الخادم (٣ج-٣) */
  const waitingTasks = trainerPlan ? awaitingTasks(trainerPlan.assessments, trainerPlan.approvedOnce ?? false) : [];
  const axisNo = new Map((trainerPlan?.content?.modules ?? []).map((m, i) => [m.moduleId, i + 1] as const));
  /* وبطاقةُ المعايير — الحسابُ نفسُه الذي رآه المدرّبُ قبل أن يرسل (٨ أكتوبر ٢٠٢٦) */
  const scorecard = trainerPlan
    ? planScorecard({ period: trainerPlan.period, content: trainerPlan.content, sessions: trainerPlan.sessions, assessments: trainerPlan.assessments })
    : [];
  const blocked = blockedItems(scorecard);
  /* ═══ والمردودةُ إليه تُعتمد كذلك — بما حفظه فيها الآن (١٧ أكتوبر ٢٠٢٦) ═══
     «اريد ان اعتمد التعديلات واعتمد الدوره نفسها.. ولكن اريد ان تبقى تعديلاتي ظاهره امامه» (صاحب المنصّة) — واختار
     «Yes, for returned plans». فخطّةٌ رُدّت إليه لا تنتظر أن يعيد إرسالها: «اعتمدها» يعتمد ما حفظه، وبطاقاتُك تبقى
     عنده اقتراحات. والردُّ والتأجيلُ وتقريرُ المراجعة لما ينتظر قرارك وحدَه، والمؤجَّلةُ لا تُعتمد من هنا (`decide`) */
  const returnedNow = trainerPlan?.status === "changes_requested" && !trainerPlan.postponedTo;
  const approvable = canApprovePlan && (trainerPlan?.status === "submitted" || returnedNow);
  /* ═══ «اطلب تعديلات» يردّها ببطاقاتها وحدَها — لا ملاحظاتٍ نصّيّة (١٣ أكتوبر ٢٠٢٦) ═══
     كان الزرُّ يفتح صناديقَ ردٍّ يملؤها ما سقط من بطاقة المعايير («مقترح — …»)، فتصل المدرّبَ ملاحظاتٍ نصّيّةً
     يعملها بيده — وهي ما نسخه قرارُ «قبل/بعد» (١٢ أكتوبر). ثمّ اختار صاحبُ المنصّة: «No text notes» — يردّها بما
     ينتظره من بطاقات، وسطرٍ واحدٍ تكتبه المنصّةُ بعددها (`suggestedEditsLineAr`). ولا بطاقةَ تنتظر: لا ردّ، ويُقال
     لماذا وما الخيارات. */
  const edits = usePlanEdits(trainerPlan?.id ?? null, cohortId);
  const editsPending = edits.pendingCards;
  /* ومسوّداتٌ لم تُعتمد للمدرّب — «اعتمدها» يقول إنّها لا تصله (١٧ أكتوبر ٢٠٢٦) */
  const editsDrafts = edits.drafts.length;
  /* ═══ والتأجيلُ إلى موسمٍ قادم — قرارٌ ثالث (٨ أكتوبر ٢٠٢٦) ═══
     «أختار أفضلَ اثنتين أو ثلاث… وأقول لهم أن يؤجّلوا الباقية — ويجب أن يعرفوا أنّي لا
     أقبلها لهذا الفصل». يُختار الموسمُ (التالي مقترَحا)، وكلمةٌ اختياريّة. */
  const [postponing, setPostponing] = useState(false);
  const [postponeTo, setPostponeTo] = useState(0);
  const [postponeNote, setPostponeNote] = useState("");
  /* وكلمةٌ تصله مع الاعتماد — للمقترَح لا للمطلوب (`approvalBody`، ٧ أكتوبر ٢٠٢٦) */
  const [approveNote, setApproveNote] = useState("");
  /* ═══ وما بقي بعد الاعتماد يظهر على كلّ خطّةٍ معتمَدة (١٨ أكتوبر ٢٠٢٦) ═══
     كان لوحُ «ما بقي عليك» (`TrainerNextSteps`، «3a») يظهر بعد الاعتماد الذي فعّل المدرّبَ وحدَه — فكلُّ شعبةٍ
     بعدها لمدرّبٍ نشطٍ لا تُفتح إلّا من «الشعب». واختار صاحبُ المنصّة («All, in order»، الخطوة A): يظهر على كلّ خطّةٍ
     معتمَدة، والخادمُ يقول ما بقي (مسوّداتُه المعتمَدة)، واللوحُ لا يفتح لمدرّبٍ لم يفعّل بعد. */
  const planApproved = trainerPlan?.status === "approved" || trainerPlan?.status === "published";
  /* ═══ مساحةُ المراجعة: اللسانُ والأدواتُ والأسطرُ الثلاثة (٢٦ أكتوبر ٢٠٢٦، المرحلة الخامسة) ═══
     يُفتح على «اقتراحات Claude» — ما ينتظر قرارك — والمعتمَدةُ على «بطاقات للمدرب»: لا مسوّداتٍ بعد الاعتماد، وما بقي
     عنده يُقرأ. والرفعُ لمن يعتمد والخطّةُ لم تُعتمد، وتقريرُ المراجعة والخطّةُ بانتظار قرارك (كما كانا في صندوقيهما). */
  const tab: WorkspaceTab = tabPick ?? (planApproved ? "trainer" : "claude");
  const [toolsOpen, setToolsOpen] = useState(false);
  const editsFile = useRef<HTMLInputElement>(null);
  const reportFile = useRef<HTMLInputElement>(null);
  const canUploadEdits = canApprovePlan && !!trainerPlan && !planApproved;
  const canUploadReport = trainerPlan?.status === "submitted" && canApprovePlan;
  const reports = useReviewReports(trainerPlan?.id ?? null, loadPlan, edits.say);
  /* وجدولٌ ثابتٌ مقترحٌ حين تنصح البطاقةُ في الإيقاع أو أوقات اللقاءات (١١ أكتوبر ٢٠٢٦) */
  const offerSchedule = scorecard.some((i) => (i.key === "rhythm" || i.key === "session_times") && i.status !== "ok");
  /* ═══ بطاقةُ المعايير تُفتح بنقرة — والمطلوبُ الساقطُ يُقرأ باسمه في سطرها (٢٦ أكتوبر ٢٠٢٦) ═══
     كانت تُفتح وحدَها إن سقط مطلوب (١١ أكتوبر) كي لا يخفى — فدفعت الألسنةَ تحت عشرين سطرا. وصار سطرُها يسمّي ما سقط
     («المطلوب: …» كما في خطّة لوحة الإدارة، ٣د)، وتحذيرُ القرار يسمّيه قبل الاعتماد: فلا يخفى، وتبقى مطويّة. */
  const [cardShown, setCardOpen] = useState(false);
  /* وحجمُ الخطّة كما يعدّه المنهاجُ نفسُه (`curriculumView`) — لا عدٌّ ثانٍ يخالفه */
  const planSize = (() => {
    if (!trainerPlan) return { meetings: 0, tasks: 0, workbooks: 0 };
    const v = curriculumView({
      title: trainerPlan.cohortTitle || cohortTitle, period: trainerPlan.period, content: trainerPlan.content,
      sessions: trainerPlan.sessions, assessments: trainerPlan.assessments, approvedOnce: trainerPlan.approvedOnce,
    });
    return {
      meetings: v.counts.meetings,
      tasks: v.counts.tasks,
      workbooks: (v.workbook?.url || v.workbook?.fileKey ? 1 : 0) + v.moduleWorkbooks.filter((w) => w.done).length,
    };
  })();
  /* وتأجيلُ آخرِ ما يُعِدّه يفعّله (#547) — فيظهر اللوحُ لشعبه المعتمَدة وإن لم تكن هذه منها */
  const [activated, setActivated] = useState(false);
  /* القضاءُ في الخطّة يُبلَّغ مرّتين: البابُ الذي فُتحت منه (الطابورُ يعلّمها)،
     والإطارُ الذي يعدّ ما ينتظر (`plans-signal.ts`) — فلا تبقى شارتُه على عددٍ مضى */
  const decided = (outcome: PlanOutcome) => { onPlanDecided?.(outcome); signalPlansChanged(); };

  /* ═══ وتُنزَّل للمراجعة خارجَ المنصّة (٧ أكتوبر ٢٠٢٦) ═══
     قرارُ صاحب المنصّة: زرُّ تنزيل. ZIP فيه المنهجُ نصّا مقروءا وكلُّ ملفٍّ رفعه
     المدرّب (`plan-review-bundle.ts`). ليس قرارا في الخطّة — فلا يمرّ بـ`act` ولا
     يُبلَّغ به البابُ الذي فُتحت منه، ولا يحبس أزرارَ القرار وهو يُنزَّل. وصار في «أدوات Claude»،
     فرسالتُه في سطرها (٢٦ أكتوبر ٢٠٢٦). */
  const [downloading, setDownloading] = useState(false);
  const downloadBundle = async () => {
    if (downloading) return;
    setDownloading(true); edits.say("");
    try {
      const name = await apiDownload(`/api/admin/cohorts/${cohortId}/trainer-plan/review-bundle`, "خطة-الشعبة.zip");
      edits.say(`نزّلت «${name}» — فيها المنهج وملفّات المدرّب. ولم تتغيّر الخطّة.`);
    } catch (e) { edits.say(e instanceof ApiError ? e.message : "تعذّر التنزيل"); }
    finally { setDownloading(false); }
  };

  /* ويعود بنجاحه — فنموذجٌ كُتب فيه لا يُطوى على خطأ فيضيع ما كُتب. والرسالةُ
     قد تُبنى ممّا عاد (اعتمادُ الخطّة يقول لقاءاتِه) */
  const act = useCallback(async (fn: () => Promise<unknown>, done: string | ((r: unknown) => string)): Promise<boolean> => {
    if (busy) return false;
    setBusy(true); setMsg("");
    try { const r = await fn(); const m = typeof done === "function" ? done(r) : done; setMsg(m); onDone?.(m); return true; }
    catch (e) { setMsg(e instanceof ApiError ? e.message : "فشل الإجراء"); return false; }
    finally { setBusy(false); }
  }, [busy, onDone]);

  return (
    <>
      {!trainerPlan ? (
        <p className="text-read leading-6 text-muted-foreground">لم يبدأ المدرّب تجهيز الشعبة بعد.</p>
      ) : (
        <>
          <p className="text-read leading-6">
            <b>{PLAN_AR[trainerPlan.status] ?? trainerPlan.status}</b>
            {trainerPlan.trainerName ? <> · {trainerPlan.trainerName}</> : null}
            {trainerPlan.submittedAt ? <> · أرسلت {fmtDateTimeAr(trainerPlan.submittedAt)}</> : null}
            {trainerPlan.trainerConfirmedAt ? <> · وأكّد موافقته على كلّ ما فيها</> : null}
          </p>
          {/* متى أُرسلت ومتى رُدّت وما قرّره في البطاقات — للإدارة وحدَها (١٧ أكتوبر ٢٠٢٦) */}
          <PlanTimeline planId={trainerPlan.id} />
          {/* ═══ ومتى يُفتح التسجيل — لا يُفتح قبل الاعتماد وإن رُفع علمُه (٣ج) ═══

              «التسجيلُ يُفتح بعد الاعتماد، ويُغلق يومَ البدء، والالتحاقُ المتأخّرُ حتّى
              الموعد الثاني» (صاحب المنصّة). فيُقال للمعتمِد ما يحكم به الخادم: علمٌ
              مرفوعٌ على خطّةٍ لم تُعتمَد لا يُدخل أحدا — وكان يُقرأ «مفتوحا». */}
          {/* ═══ وعلمُ الشعبة قبل الاعتماد وبعده (٣ أكتوبر ٢٠٢٦) ═══
              كان يقول «يُفتح باعتمادك» و«الالتحاقُ مفتوح» لكلّ شعبة — وشعبةُ الإعداد
              مسوّدةٌ علمُها منزولٌ لا يرفعه الاعتماد. فالجملةُ من حالها كما يحكم
              الخادم (`registration-state.ts`)، وتقول أين تُفتح إن كانت مغلقة. */}
          {(() => {
            const r = trainerPlan.registration;
            const line = r ? adminRegistrationLine({ ...r, registrationOpen: r.registrationOpen ?? true }, new Date()) : null;
            return line ? (
              <p className="mt-2 text-read leading-6 text-muted-foreground">
                {line.lead}{line.date && <b className="text-foreground">{line.date}</b>}{line.tail}
              </p>
            ) : null;
          })()}
          {trainerPlan.postponedTo && (
            <Inset tone="warn" className="mt-3" role="status">
              <p className="text-read font-black text-gold-ink">
                {postponedLineAr(trainerPlan.postponedTo)} — لم تقبل للفصل الذي أرسلت له
              </p>
              <p className="mt-1 text-read leading-6 text-muted-foreground">
                {trainerPlan.status === "submitted"
                  ? `أعاد المدرّب إرسالها لموسمها: يجب أن تبدأ في ${cohortDayAr(trainerPlan.postponedTo)} أو بعده.`
                  : `المدرّب يعدّلها، ولا يرسلها إلّا إذا بدأت في ${cohortDayAr(trainerPlan.postponedTo)} أو بعده.`}
              </p>
            </Inset>
          )}

          {/* ═══ ثلاثةُ أسطرٍ فوق الألسنة (٢٦ أكتوبر ٢٠٢٦، المرحلة الخامسة) ═══
              «خطّة لوحة الإدارة» (٣د): بطاقةُ المعايير بعدّها، وما فعله المدرّبُ ببطاقاتك، والخطّةُ بحجمها — تُقرأ قبل أن
              يُفتح لسان، ولكلٍّ بابُه. والحسابُ في `plan-workspace.ts`. */}
          <div className="mt-3 grid gap-2 sm:grid-cols-3" role="group" aria-label="الخطة في ثلاثة أسطر">
            {/* بطاقةُ المعايير سطرٌ بعدّها يفتحها، ومفتوحةٌ إن سقط مطلوب («كثيرُ الكلام»، ١١ أكتوبر ٢٠٢٦) */}
            <Inset className="flex flex-col gap-1 px-3 py-2.5">
              <span className="text-fine font-black text-muted-foreground">بطاقة المعايير</span>
              <p className="text-read font-bold text-foreground">
                {scoreLineAr({ ok: scorecard.filter((i) => i.status === "ok").length, advice: scorecard.filter((i) => i.status === "advice").length, required: blocked.length })}
              </p>
              {blocked.length > 0 && <p className="text-read leading-6 text-gold-ink">المطلوب: {blocked.map((b) => b.labelAr).join(" · ")}</p>}
              <button type="button" className="mt-auto w-fit cursor-pointer text-read font-bold text-teal-light-ink underline" aria-expanded={cardShown} onClick={() => setCardOpen(!cardShown)}>
                {cardShown ? "اطوها" : "افتحها"}
              </button>
            </Inset>
            {/* وما فعله المدرّبُ ببطاقاتك — أو ما ينتظرك منها إن لم يصله شيء */}
            <Inset className="flex flex-col gap-1 px-3 py-2.5">
              <span className="text-fine font-black text-muted-foreground">{trainerPlan.returned ? "ما تغير منذ ردك" : "بطاقاتك"}</span>
              <p className="text-read font-bold text-foreground">{cardsLineAr(cardTally(edits.items)) ?? draftsLineAr(editsDrafts)}</p>
              {trainerPlan.returned && trainerPlan.status === "submitted" && (
                <button type="button" className="mt-auto w-fit cursor-pointer text-read font-bold text-teal-light-ink underline" onClick={() => setTab("plan")}>
                  اقرأ ما عدّله في الخطة
                </button>
              )}
            </Inset>
            {/* والخطّةُ بحجمها — ولسانُها بنقرة */}
            <Inset className="flex flex-col gap-1 px-3 py-2.5">
              <span className="text-fine font-black text-muted-foreground">الخطة</span>
              <p className="text-read font-bold text-foreground">{planSizeAr(planSize)}</p>
              {trainerPlan.status === "submitted" && trainerPlan.approvedPlan && (
                <p className="text-read leading-6 text-gold-ink">مراجعة لخطة معتمدة</p>
              )}
              <button type="button" className="mt-auto w-fit cursor-pointer text-read font-bold text-teal-light-ink underline" onClick={() => setTab("plan")}>
                افتح المنهاج
              </button>
            </Inset>
          </div>
          {cardShown && (
            <PlanScorecard
              items={scorecard}
              heading="بطاقة المعايير"
              intro="تحسبها المنصّة من الخطّة، ورآها المدرّب قبل الإرسال. «مطلوب» يمنع الإرسال، و«نصيحة» قراره."
            />
          )}

          {/* ═══ ثلاثةُ ألسنةٍ بترتيب العمل، و«أدوات Claude» قائمةٌ واحدة (٢٦ أكتوبر ٢٠٢٦، المرحلة الخامسة) ═══
              «خطّة لوحة الإدارة» (٣د): «تعديلاتُ Claude تصل بطاقات، تُبقي كلًّا أو تحذفه، والمدرّبُ يقبل أو يرفض» — فلسانٌ لما
              اقترحه Claude ولم تقرّر فيه، ولسانٌ لما اعتمدته للمدرّب، ولسانٌ للمنهاج كما أرسله. وأدواتُ الجملة صارت قائمةً
              واحدة: تنزيلُ الخطّة لـClaude، ورفعُ ما يرجع منه، وتقريرُ المراجعة. وكان لسانان «الإدارة» و«المنهاج» (١١ أكتوبر). */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <TabBar
              ariaLabel="أقسام الخطّة"
              items={WORKSPACE_TABS.map((id) => ({ id, label: workspaceTabAr(id, id === "claude" ? editsDrafts : id === "trainer" ? editsPending : 0) }))}
              value={tab}
              onChange={setTab}
            />
            <Button tone="secondary" size="sm" icon={Wrench} aria-expanded={toolsOpen} aria-controls={`claude-tools-${cohortId}`} onClick={() => setToolsOpen((v) => !v)}>
              أدوات Claude
              <ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 transition ${toolsOpen ? "rotate-180" : ""}`} />
            </Button>
          </div>
          {toolsOpen && (
            <Inset id={`claude-tools-${cohortId}`} className="mt-2 flex flex-wrap gap-2 px-3 py-2.5" role="group" aria-label="أدوات Claude">
              {/* وتُنزَّل للمراجعة خارجَ المنصّة — المنهجُ نصّا وملفّاتُ المدرّب (٧ أكتوبر ٢٠٢٦) */}
              <Button tone="secondary" size="sm" icon={Download} disabled={downloading} onClick={() => void downloadBundle()}>
                {downloading ? "يجهّز التنزيل…" : "نزّل الخطّة للمراجعة"}
              </Button>
              {/* ويرجع منه ملفُّ التعديلات — مسوّداتٌ لا يراها المدرّب حتّى تعتمدها له (٨ أكتوبر ٢٠٢٦) */}
              {canUploadEdits && (
                <>
                  <input
                    ref={editsFile}
                    type="file"
                    className="sr-only"
                    aria-label="ملفّ التعديلات المقترحة"
                    accept="application/json,.json"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void edits.upload(f).then(() => { setTab("claude"); if (editsFile.current) editsFile.current.value = ""; });
                    }}
                  />
                  <Button tone="secondary" size="sm" icon={FileJson} disabled={edits.busy} onClick={() => editsFile.current?.click()}>
                    {edits.busy ? "يفحص…" : "ارفع ملفّ التعديلات"}
                  </Button>
                </>
              )}
              {/* وتقريرُ المراجعة يُرفع قبل القرار ويُحفظ مع الخطّة — يرافع القرارَ أيًّا كان (٨ أكتوبر ٢٠٢٦) */}
              {canUploadReport && (
                <>
                  <input
                    ref={reportFile}
                    type="file"
                    className="sr-only"
                    aria-label="ملفّ تقرير المراجعة"
                    accept={REVIEW_REPORT_ACCEPT}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void reports.upload(f).then(() => { if (reportFile.current) reportFile.current.value = ""; });
                    }}
                  />
                  <Button tone="secondary" size="sm" icon={Upload} disabled={reports.busy} onClick={() => reportFile.current?.click()}>
                    {reports.busy ? "يرفع…" : "ارفع تقرير المراجعة"}
                  </Button>
                </>
              )}
              {/* وجدولٌ ثابتٌ بسلسلته حين تنصح البطاقةُ في الإيقاع أو الأوقات (١١ أكتوبر ٢٠٢٦) */}
              {canUploadEdits && offerSchedule && (
                <Button tone="secondary" size="sm" icon={CalendarClock} disabled={edits.busy} onClick={() => void edits.schedule().then(() => setTab("claude"))}>
                  جهّز جدولا ثابتا مقترحا
                </Button>
              )}
              {canUploadEdits && edits.open > 0 && (
                <Button tone="ghost" size="sm" disabled={edits.busy} onClick={() => void edits.withdraw()}>
                  اسحب ما لم يقرّر ({edits.open})
                </Button>
              )}
            </Inset>
          )}
          {/* وما قالته الأدواتُ والبطاقاتُ سطرٌ واحد تحت الألسنة — والقرارُ سطرُه عند أزراره */}
          {edits.msg && <p className="mt-2 whitespace-pre-wrap text-read font-bold text-teal-light-ink" role="status">{edits.msg}</p>}

          {tab === "claude" && (
            <div role="tabpanel" aria-label="اقتراحات Claude" className="mt-3">
              {editsDrafts > 0 ? (
                <PlanEditsDrafts edits={edits} planId={trainerPlan.id} canReview={canReviewEdits && !planApproved} />
              ) : (
                <p className="text-read leading-6 text-muted-foreground">
                  {planApproved
                    ? "الخطة معتمدة، فلا مسوّدات بعدها."
                    : "لا اقتراحات تنتظرك. نزّل الخطة من «أدوات Claude» لمراجعتها، ثمّ ارفع ملف التعديلات الذي يرجع: تصل هنا مسوّدات لا يراها المدرّب حتّى تعتمدها له."}
                </p>
              )}
              <PlanEditsSetAside edits={edits} />
            </div>
          )}
          {tab === "trainer" && (
            <div role="tabpanel" aria-label="بطاقات للمدرب" className="mt-3">
              <p className="mb-2 text-read leading-6 text-muted-foreground">
                {planApproved
                  ? "الخطة معتمدة: ما اعتمدته له بقي عنده اقتراحات اختيارية، وما يقبله يدخل الخطة مباشرة."
                  : "ما اعتمدته له. يصله بـ«اطلب تعديلات» فيقبل كلّا أو يرفضه، أو يبقى عنده اقتراحات اختيارية إن اعتمدت الخطة."}
              </p>
              <PlanEditsSent edits={edits} />
              <ReviewReportFiles reports={trainerPlan.reviewReports ?? []} busy={reports.busy} onRemove={canUploadReport ? (key, name) => void reports.remove(key, name) : undefined} />
            </div>
          )}
          {tab === "plan" && (
            <div role="tabpanel" aria-label="المنهاج" className="mt-3">
              {/* ═══ وما تغيّر عن المعتمَد — مراجعةٌ لخطّةٍ معتمَدة (٣ج-٤) ═══

                  المنهجُ تحته كما سيكون، ولا يقول ما الذي تغيّر: فإمّا يقرأ المعتمِدُ
                  عشرين موعدا ليجد التعديلَ الواحد، وإمّا يعتمد ما لم يره. فيُقال أوّلَ اللسان
                  بخطوات المدرّب. */}
              {trainerPlan.status === "submitted" && trainerPlan.approvedPlan && (
                <Inset className="mb-3" role="region" aria-label="ما تغيّر عن المعتمد">
                  <p className="text-read font-black text-foreground">
                    ما تغيّر عن المعتمد
                    {trainerPlan.approvedPlan.reviewedAt && <span className="font-normal text-muted-foreground"> — اعتمدت {fmtDateAr(trainerPlan.approvedPlan.reviewedAt)}</span>}
                  </p>
                  <p className="mt-1 text-read leading-6 text-muted-foreground">
                    هذه خطّة معتمدة سابقا، وهنا ما غيّره المدرّب. والمنهج بعد اعتمادك تحته.
                  </p>
                  <div className="mt-2">
                    <PlanDiffList
                      sections={planDiff(trainerPlan.approvedPlan.content, trainerPlan.content, { date: cohortDayAr })}
                      emptyText="لم تتغيّر الخطّة نفسها — واللقاءات والمهامّ التي تعتمد معها تحت."
                    />
                  </div>
                </Inset>
              )}
              {/* ═══ وما تغيّر منذ ردّك — إعادةُ مراجعةٍ بعد ردٍّ بملاحظات (٣ أكتوبر ٢٠٢٦، ⑦) ═══

                  كان يُرى «ما طلبتَه» أسفلَ المنهج ولا يُرى ما تغيّر — فيُقرأ المنهجُ كلُّه
                  ليُعرف أأُجيبت الملاحظة. فتُقابَل المرسَلةُ بالتي رُدّت، وكلُّ ملاحظةٍ
                  بجانب ما تغيّر في خطوتها (`sinceReturn`). */}
              {trainerPlan.status === "submitted" && trainerPlan.returned && (() => {
                const notes: ReviewNotes = trainerPlan.reviewerNotes ?? (trainerPlan.reviewerNote ? { general: trainerPlan.reviewerNote } : {});
                const since = sinceReturn(trainerPlan.returned.content, trainerPlan.content, notes, { date: cohortDayAr });
                return (
                  <Inset className="mb-3" role="region" aria-label="ما تغيّر منذ ردّك">
                    <p className="text-read font-black text-foreground">
                      ما تغيّر منذ ردّك
                      {trainerPlan.returned.at && <span className="font-normal text-muted-foreground"> — ردّت {fmtDateAr(trainerPlan.returned.at)}</span>}
                    </p>
                    <p className="mt-1 text-read leading-6 text-muted-foreground">
                      أعاد المدرّب إرسالها بعد ردّك — هذا ما عدّله، وملاحظتك بجانب كل خطوة.
                    </p>
                    <div className="mt-2">
                      <SinceReturnList general={since.general} rows={since.rows} />
                    </div>
                  </Inset>
                );
              })()}
              {/* وما طُلب منه يُقرأ بأقسامه — وبعد إعادة الإرسال «ما طلبتَه» ليُقابَل
                  بما عُدّل في المنهج تحته، لا ليُتذكَّر من الذاكرة */}
              {(() => {
                const notes: ReviewNotes = trainerPlan.reviewerNotes ?? (trainerPlan.reviewerNote ? { general: trainerPlan.reviewerNote } : {});
                if (!hasReviewNotes(notes)) return null;
                /* وقيلت في «ما تغيّر منذ ردّك» بجانب ما تغيّر — فلا تُكرَّر (⑦) */
                if (trainerPlan.status === "submitted" && trainerPlan.returned) return null;
                const heading = trainerPlan.status === "submitted"
                  ? "ما طلبته في الردّ السابق — قابله بما عدّل"
                  : trainerPlan.status === "changes_requested" ? "ما طلب منه" : "ملاحظة القرار";
                return (
                  <Inset tone="warn" className="mb-3">
                    <p className="text-read font-black text-gold-ink">{heading}</p>
                    <ReviewNotesList notes={notes} />
                  </Inset>
                );
              })()}
              {/* وسقط هنا صندوقُ «يقترح المدرّبُ اسما آخر» (د-٦): اعتمادُ خطّةٍ
                  لا يُعيد تسميةَ دورةٍ في الكتالوج. واقتراحُ الاسم يصل الإدارةَ
                  في طابور اقتراحات المدرّبين، ويُعتمَد فيصير إصدارا جديدا (ح-٣). */}
              <Button as={Link} to={`/admin/plans/${cohortId}`} target="_blank" rel="noreferrer" tone="secondary" size="sm" icon={ExternalLink}>
                افتحه في صفحة منفصلة
              </Button>
              <div className="mt-3">
                <PlanCurriculum trainerPlan={trainerPlan} cohortTitle={cohortTitle} />
              </div>
            </div>
          )}
        </>
      )}
      {/* ═══ والقرارُ تحت الألسنة — لا يُطوى بلسان (٢٦ أكتوبر ٢٠٢٦، المرحلة الخامسة) ═══
          «الجولةُ ووقتُ الانتظار في الأعلى… وأزرارُ القرار في الأسفل» (خطّة لوحة الإدارة، ٣د). كان القرارُ في لسان «الإدارة»
          وحدَه: من قرأ المنهاجَ في لسانه رجع ليعتمد. فصار تحت اللسانين معا — وما يقوله قبل النقر معه. */}
      <div>
          {/* والاعتمادُ يقول ما يُطلقه قبل النقر: اللقاءاتُ المنتظِرةُ تُعتمَد معه،
              ولكلٍّ اجتماعُه وإعلانُه (`decide` ← `decideSession`) */}
          {approvable && riding.length > 0 && (
            <p className="mt-3 text-read leading-6 text-muted-foreground">
              باعتمادها {riding.length === 1 ? "يعتمد لقاؤها المنتظر معها" : `تعتمد لقاءاتها المنتظرة (${riding.length}) معها`}:
              {" "}ينشأ لكل لقاء اجتماع Zoom، ويصل المسجّلين بالبريد — وأوّلها يزيل الجدول المبدئيّ إن وجد.
            </p>
          )}
          {/* ومهامُّها المنتظِرةُ كذلك — الاعتمادُ واحد (٣ج-٣) */}
          {approvable && waitingTasks.length > 0 && (
            <p className="mt-2 text-read leading-6 text-muted-foreground">
              {waitingTasks.length === 1
                ? "وتعتمد معها المهمّة المنتظرة أدناه، كما في تبويب «المنهاج»."
                : `وتعتمد معها المهامّ المنتظرة (${waitingTasks.length}) أدناه، كما في تبويب «المنهاج».`}
            </p>
          )}
          {/* ═══ وكلمةٌ تصله مع الاعتماد (٧ أكتوبر ٢٠٢٦) ═══
              الخطّةُ التي ليس عليها إلّا مقترحاتٌ تُعتمَد ولا تُردّ، وتصل مقترحاتُها في خبر
              اعتمادها «وكلمةُ الإدارة: …». وما يُطلب قبل الاعتماد مكانُه «اطلب تعديلات». */}
          {approvable && (
            <details className="mt-3" open={approveNote.length > 0}>
              <summary className="cursor-pointer text-read font-bold text-teal-light-ink">أضف كلمة تصله مع الاعتماد (اختياريّ)</summary>
              <div className="mt-2">
                <StaffField
                  label="كلمة الإدارة"
                  hint="تصل المدرّب مع خبر الاعتماد: شكر أو تهنئة. وما يعدل في خطته مكانه بطاقة «قبل/بعد» ثمّ «اطلب تعديلات»."
                >
                  <textarea
                    rows={3}
                    maxLength={REVIEW_NOTE_MAX}
                    value={approveNote}
                    onChange={(e) => setApproveNote(e.target.value)}
                    placeholder="مثلا: اعتمدناها، وأرفقنا مصادر عربيّة مقترحة لكل محور."
                    className={staffAreaCls}
                  />
                </StaffField>
              </div>
            </details>
          )}
          {/* ═══ ومطلوبٌ لم يتحقّق: الخياران وفرقُهما، والقرارُ لك (٨ أكتوبر ٢٠٢٦) ═══
              «لا إجبارَ على فعل» (٢ أكتوبر ٢٠٢٦): المطلوبُ يمنع المدرّبَ من الإرسال، ولا يُغلق
              على المعتمِد بابَ الاعتماد. يُقال ما يقع بكلٍّ، ويختار. وخطّةٌ كهذه أُرسلت قبل
              أن يصير المعيارُ مُلزِما — فالمرسَلةُ بعده لا تصل ناقصة. */}
          {trainerPlan?.status === "submitted" && canApprovePlan && blocked.length > 0 && (
            <Inset tone="warn" className="mt-3" role="group" aria-label="معايير ملزمة لم تتحقّق">
              <p className="text-read font-black text-gold-ink">
                {blocked.length === 1 ? "معيار ملزم لم يتحقّق" : `${blocked.length} معايير ملزمة لم تتحقّق`}: {blocked.map((b) => b.labelAr).join(" · ")}
              </p>
              <ul className="mt-2 list-disc space-y-1 ps-5 text-read leading-6 text-foreground">
                <li><b>اطلب تعديلات</b> (الأفضل): تردّها إليه ببطاقاتها، فيقبل كلّ بطاقة أو يرفضها ثمّ يرسلها. ولا يعيد إرسالها حتّى يكمل المطلوب.</li>
                <li><b>اعتمدها كما هي</b>: تعتمد ناقصة، ويراها المتعلّمون كذلك — وتبقى البطاقات التي اعتمدتها له عنده اقتراحات اختيارية.</li>
              </ul>
            </Inset>
          )}
          {/* والمردودةُ إليه: يُقال قبل النقر ما يُعتمد — ما حفظه الآن، بلا انتظار إرسالها (١٧ أكتوبر ٢٠٢٦) */}
          {returnedNow && canApprovePlan && (
            <p className="mt-3 text-read leading-6 text-muted-foreground">
              الخطة عند المدرب الآن، رددتها إليه بتعديلات. «اعتمدها» يعتمد ما حفظه فيها حتى الآن ولا ينتظر أن يرسلها، ويصله خبر الاعتماد.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {approvable && trainerPlan && (
              <>
                <Button tone="confirm" size="sm" disabled={busy}
                  onClick={() => act(
                    () => apiPost<PlanDecision>(`/api/admin/cohort-plans/${trainerPlan.id}/decide`, approvalBody(approveNote))
                      .then(async (r) => { setApproveNote(""); await Promise.all([loadPlan(), loadPendingSessions()]); decided("approved"); return r; }),
                    (r) => planApprovedMsg(r as PlanDecision),
                  )}>
                  {riding.length > 0 ? `اعتمدها ولقاءاتها (${riding.length})` : "اعتمدها"}{blocked.length > 0 ? " كما هي" : ""}{approveNote.trim() ? " مع كلمتك" : ""}
                </Button>
                {/* ═══ واعتمادٌ وفتحٌ بنقرةٍ واحدة (٢٠ أكتوبر ٢٠٢٦) ═══
                    سأل صاحبُ المنصّة: «لماذا يجب أن أنقر العديدَ من النقرات لأنشر دورةً اعتمدتُها وكلُّ شيءٍ
                    واضحٌ فيها؟» — واختار زرّا بجانب «اعتمدها» لا فتحا آليّا، فيبقى له أن يعتمد ولا يفتح.
                    والفتحُ من بابه نفسِه (`/open`) بشروطه: ما ينقص يُقال، والاعتمادُ يبقى. ولأوّل اعتمادٍ وحدَه:
                    شعبةٌ اعتُمدت قبلُ مفتوحةٌ أو تعمل. */}
                {!trainerPlan.approvedOnce && (
                  <Button tone="confirm" size="sm" disabled={busy}
                    onClick={() => act(
                      async () => {
                        const r = await apiPost<PlanDecision>(`/api/admin/cohort-plans/${trainerPlan.id}/decide`, approvalBody(approveNote));
                        setApproveNote("");
                        let openedAr = "وفتحت للتسجيل.";
                        try { await apiPost(`/api/admin/cohorts/${cohortId}/open`); }
                        catch (e) { openedAr = `ولم تفتح: ${e instanceof ApiError ? e.message : "تعذر الفتح"}`; }
                        await Promise.all([loadPlan(), loadPendingSessions()]);
                        decided("approved");
                        return `${planApprovedMsg(r)} ${openedAr}`;
                      },
                      (m) => m as string,
                    )}>
                    اعتمد وافتح للتسجيل
                  </Button>
                )}
                {/* والردُّ لما ينتظر قرارك وحدَه — المردودةُ عنده فعلا */}
                {trainerPlan.status === "submitted" && (
                <Button tone="danger" size="sm" disabled={busy || editsPending === 0}
                  onClick={() => void act(
                    () => apiPost(`/api/admin/cohort-plans/${trainerPlan.id}/decide`, { approve: false }).then(loadPlan),
                    "ردّت إليه ببطاقاتها — يقبل كلّ بطاقة أو يرفضها",
                  ).then((ok) => { if (ok) decided("changes_requested"); })}>
                  {editsPending > 0 ? `اطلب تعديلات (${editsPending === 1 ? "بطاقة واحدة" : `${editsPending} بطاقات`})` : "اطلب تعديلات"}
                </Button>
                )}
                {/* وشعبةٌ تعمل لا تُؤجَّل — مراجعتُها تُعتمَد أو تُردّ (`postpone` في الخادم) */}
                {trainerPlan.status === "submitted" && !trainerPlan.approvedOnce && (
                  <Button tone="secondary" size="sm" disabled={busy} aria-expanded={postponing} onClick={() => setPostponing((v) => !v)}>
                    أجّلها إلى الفصل القادم
                  </Button>
                )}
              </>
            )}
            {trainerPlan?.status !== "submitted" && trainerPlan?.status !== "approved" && (
              <Button tone="secondary" size="sm" disabled={busy}
                onClick={() => {
                  const note = window.prompt("كلمة تضاف إلى التذكير (اختياريّ):") ?? "";
                  void act(() => apiPost(`/api/admin/cohorts/${cohortId}/remind-trainer`, { note: note.trim() || undefined }), "ذكّر المدرّب — جرس وبريد");
                }}>
                ذكّر المدرّب بإكمال التجهيز
              </Button>
            )}
          </div>
          {trainerPlan?.status === "submitted" && canApprovePlan && postponing && !trainerPlan.approvedOnce && (() => {
            const choices: Season[] = postponeChoices(trainerPlan.period, new Date().toISOString().slice(0, 10));
            const to = choices[postponeTo] ?? choices[0]!;
            return (
              <Inset tone="warn" className="mt-3" role="group" aria-label="تأجيل الشعبة إلى موسم قادم">
                <p className="text-read font-black text-gold-ink">أجّلها إلى موسم قادم — لم تقبل لهذا الفصل</p>
                <ul className="mt-2 list-disc space-y-1 ps-5 text-read leading-6 text-foreground">
                  <li>يصل المدرّب جرس وبريد يقولان صراحة إنّها <b>لم تقبل لهذا الفصل</b> وأجّلت إلى {seasonAr(to)} — ومعهما تقرير المراجعة إن رفعته من «أدوات Claude».</li>
                  <li>تخرج من قائمتك، ولا تفتح للتسجيل هذا الفصل، وتنتقل الشعبة إلى ذلك الموسم.</li>
                  <li>تبقى خطّته ويعدّلها متى شاء — ولا يرسلها إلّا إذا بدأت في {cohortDayAr(seasonStart(to))} أو بعده.</li>
                </ul>
                <fieldset className="mt-3">
                  <legend className="text-read font-bold text-foreground">إلى أيّ موسم؟</legend>
                  <div className="mt-1 flex flex-wrap gap-4">
                    {choices.map((c, i) => (
                      <label key={`${c.year}-${c.season}`} className="flex items-center gap-2 text-read">
                        <input type="radio" name="postpone-to" checked={postponeTo === i} onChange={() => setPostponeTo(i)} />
                        {seasonAr(c)}{i === 0 ? " (التالي)" : ""}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="mt-3">
                  <StaffField label="كلمة تصله مع التأجيل (اختياريّة)" hint="مثلا سبب التأجيل: اخترنا أجهز دوراتك لهذا الفصل. والتعديلات مكانها التقرير.">
                    <textarea rows={2} maxLength={REVIEW_NOTE_MAX} value={postponeNote} onChange={(e) => setPostponeNote(e.target.value)} className={staffAreaCls} />
                  </StaffField>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button tone="danger" size="sm" disabled={busy}
                    onClick={() => void act(
                      /* وإن لم يبقَ له غيرُ المؤجّلة فُعِّل بها (١٨ أكتوبر ٢٠٢٦) — فتُعرض خطواتُه التالية كما بعد الاعتماد */
                      () => apiPost(`/api/admin/cohort-plans/${trainerPlan.id}/postpone`, { year: to.year, season: to.season, note: postponeNote.trim() || undefined })
                        .then(async (res) => {
                          const r = res as { prep?: { activated?: boolean } | null };
                          await loadPlan();
                          if (r.prep?.activated) setActivated(true);
                          return r;
                        }),
                      (r) => (r as { prep?: { activated?: boolean } | null }).prep?.activated
                        ? `أجّلت إلى ${seasonAr(to)} — ولم يبق له غيرها ففعّل ووقّع عقده`
                        : `أجّلت إلى ${seasonAr(to)} — وصله جرس وبريد بأنّها لم تقبل لهذا الفصل`,
                    ).then((ok) => { if (ok) { setPostponing(false); setPostponeNote(""); decided("postponed"); } })}>
                    أجّلها إلى {seasonAr(to)}
                  </Button>
                  <Button tone="ghost" size="sm" disabled={busy} onClick={() => setPostponing(false)}>تراجع</Button>
                </div>
              </Inset>
            );
          })()}
          {/* ═══ و«اعتمدها» يقول ما يقع بالبطاقات قبل النقر (١٧ أكتوبر ٢٠٢٦) ═══
              «when I press اعتمدها, the changes still appear for the trainer… no need for a new button» (صاحب
              المنصّة): ما اعتمدته له يبقى عنده اقتراحا، والمسوّدةُ التي لم تعتمدها لا تصله. */}
          {approvable && editsPending > 0 && (
            <p className="mt-2 text-read leading-6 text-muted-foreground">
              «اعتمدها» يبقي البطاقات التي اعتمدتها له ({editsPending}) عنده اقتراحات اختيارية: ما يقبله يدخل الخطة المعتمدة مباشرة، وما يرفضه لا يغير شيئا.
              {editsDrafts > 0 && <> والمسودات التي لم تعتمدها له ({editsDrafts}) لا تصله — اعتمدها في «اقتراحات Claude» أولا إن أردت أن تصله.</>}
            </p>
          )}
          {trainerPlan?.status === "submitted" && canApprovePlan && editsPending === 0 && (
            <p className="mt-2 text-read text-muted-foreground">
              لا بطاقة تنتظر المدرّب بعد، فلا ردّ. لك أن ترفع التعديلات أو تعتمد مسوّداتها في «اقتراحات Claude» فيصير الزرّ يردّها بها، أو تعتمدها كما هي، أو تؤجّلها.
            </p>
          )}
          {/* وما قاله الفعلُ يُقرأ حيث نُقر — لا أعلى البطاقة بعد منهجٍ طويل */}
          {msg && <p className="mt-3 text-read font-bold text-teal-light-ink" role="status">{msg}</p>}
          {/* وما بقي بعد الاعتماد — فتحُ شعبه المعتمَدة وظهورُه العامّ، على كلّ خطّةٍ معتمَدة */}
          {canApprovePlan && (planApproved || activated) && <TrainerNextSteps cohortId={cohortId} />}

          {/* ═══ ومهامُّ ما بعد الاعتماد تنتظر قرارك (٣ج-٣) ═══
              «وبعد الاعتماد كلُّ تغييرٍ باعتماد» — جديدةٌ أو تعديلٌ أو حذف، والمتعلّمون
              على المعتمَد حتّى تقرّر. والردُّ بسببه يصل المدرّب. */}
          {canApprovePlan && (
            <PendingTasks
              tasks={waitingTasks}
              axisNo={axisNo}
              busy={busy}
              onDecide={(id, approve, note) => act(
                () => apiPost(`/api/admin/cohort-assessments/${id}/decide`, { approve, note })
                  .then(async (r) => { await loadPlan(); return r; }),
                (r) => taskDecisionMsg(r as { status?: string; kind?: string } | null),
              )}
            />
          )}

          {/* ═══ لقاءاتٌ مباشرةٌ تنتظر قرارك ═══

              وبالاعتماد يقع كلُّ شيء: يُنشأ اجتماعُ Zoom، ويُنشَر اللقاءُ في
              منصّة الطلبة بتاريخه، ويصلهم البريدُ به. فيُقال ذلك على الزرّ
              صراحةً — من يعتمد يعرف ما يُطلقه، لا يكتشفه بعد النقر. */}
          {/* ولقاءاتٌ تنتظر خطّتَها التي لم تُرسَل بعد — تُقال ولا تُقرَّر هنا:
              تُعتمَد معها حين تصل (وحين تصل يعدّها زرُّ الاعتماد أعلاه) */}
          {riding.length > 0 && canApprovePlan && trainerPlan?.status !== "submitted" && (
            <p className="mt-4 border-t border-white/10 pt-4 text-read leading-6 text-muted-foreground">
              {riding.length === 1
                ? "لقاء واحد ينتظر خطّة الشعبة — يعتمد معها حين يرسلها المدرّب."
                : `لقاءات (${riding.length}) تنتظر خطّة الشعبة — تعتمد معها حين يرسلها المدرّب.`}
            </p>
          )}
          {individual.length > 0 && canApprovePlan && (
            <div className="mt-4 border-t border-white/10 pt-4">
              <p className="text-read font-black text-foreground">
                لقاءات مباشرة تنتظر قرارك ({individual.length})
              </p>
              <p className="mt-1 text-read leading-6 text-muted-foreground">
                باعتمادك ينشأ اجتماع Zoom، ويظهر اللقاء للمسجّلين ويصلهم بالبريد.
                {/* والأوّلُ منها يرفع الجدولَ المبدئيّ (`clearPlaceholders`) — يُقال
                    قبل النقر، فمن يعتمد يعرف ما يُخرجه من تقاويم المسجَّلين. */}
                {" "}وأوّل لقاء تعتمده يزيل الجدول المبدئيّ إن وجد، فيرى المسجّلون مواعيد المدرّب فقط.
              </p>
              <ul className="mt-3 space-y-2">
                {individual.map((ps) => (
                  <Inset as="li" key={ps.id}>
                    <p className="text-read font-bold text-foreground">{ps.title}</p>
                    <p className="mt-1 text-read text-muted-foreground">
                      {fmtDateTimeAr(ps.startsAt)}
                      {ps.endsAt && <> — {fmtDateTimeAr(ps.endsAt)}</>}
                      {ps.attachmentName && <> · مرفق: {ps.attachmentName}</>}
                    </p>
                    {ps.noteAr && <p className="mt-1 whitespace-pre-line text-read leading-6 text-muted-foreground">{ps.noteAr}</p>}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button tone="confirm" size="sm" disabled={busy}
                        onClick={() => act(
                          () => apiPost(`/api/admin/cohort-sessions/${ps.id}/decide`, { approve: true }).then(loadPendingSessions),
                          "اعتمد اللقاء — أنشئ اجتماعه وبلّغ المسجّلون",
                        )}>
                        اعتمده وأعلنه
                      </Button>
                      <Button tone="danger" size="sm" disabled={busy}
                        onClick={() => {
                          const note = window.prompt("لم يردّ؟ يصل مدرّبه بنصّه:");
                          if (!note?.trim()) return;
                          void act(
                            () => apiPost(`/api/admin/cohort-sessions/${ps.id}/decide`, { approve: false, note: note.trim() }).then(loadPendingSessions),
                            "ردّ اللقاء إلى مدرّبه",
                          );
                        }}>
                        ردّه
                      </Button>
                    </div>
                  </Inset>
                ))}
              </ul>
            </div>
          )}
      </div>
    </>
  );
}

/* ═══ المنهاجُ كما أرسله المدرّب — لسانُ «المنهاج» وصفحتُه المنفصلة (١١ أكتوبر ٢٠٢٦) ═══

   «يمكن فتحُ منهاجه منفصلا وتنزيلُه إذا رغبتُ أنا» (صاحب المنصّة). فالمنهاجُ هنا وحدَه: مدّتُه
   ومستواه ولمن هو، ثمّ الصفحةُ نفسُها التي قرأها المدرّبُ قبل أن يرسل (`CurriculumReview`).
   ويُعرض في لسانه، وفي `/admin/plans/:cohortId` منفصلا (`PlanCurriculumPage.tsx`). */
export function PlanCurriculum({ trainerPlan, cohortTitle }: { trainerPlan: TrainerPlan; cohortTitle: string }) {
  return (
    <>
      {/* ═══ المدّةُ أوّلُ ما يُقرأ — وهي ما يُعتمَد (٢٧ سبتمبر ٢٠٢٦) ═══
          صار المدرّبُ يحدّد متى تبدأ شعبتُه ومتى تنتهي، وباعتمادك تصير
          حدودَها المعلَنة ويُشتقّ فصلُها من تاريخ بدئها. */}
      {trainerPlan.content?.startsOn && trainerPlan.content?.endsOn && (
        <p className="mt-2 text-read leading-6 text-foreground">
          المدّة: من <b>{cohortDayAr(trainerPlan.content.startsOn)}</b> إلى <b>{cohortDayAr(trainerPlan.content.endsOn)}</b>
          {" "}<span className="text-muted-foreground">— تصير حدود الشعبة المعلنة باعتمادك.</span>
        </p>
      )}
      {/* ═══ ومستواها — لمن تُدرَّس (٦ أكتوبر ٢٠٢٦) ═══
          يختاره المدرّبُ في خطوته الأولى: مستوًى أو مدًى متّصل. والخطّةُ المرسَلةُ
          قبل القرار تصل بلا مستوى — فيُقال ذلك ولا يُخفى السطر. */}
      {/* ═══ ولمن هي وماذا يريد متعلّمُها — بجانب المستوى (٦ أكتوبر ٢٠٢٦) ═══
          طلبُ صاحب المنصّة: «أضِفهما إلى الرأس» — كانا في بطاقة المنهج وحدَها، فيقرأ
          المعتمِدُ المستوى في سطر الحقائق ويبحث عن جمهوره في البطاقة تحته. */}
      {(() => {
        const lv = levelRangeAr(asLevelRange(trainerPlan.content?.level));
        const aud = asAudience(trainerPlan.content?.audience);
        const who = stagesAr(aud);
        const goal = goalsAr(aud);
        const unset = <span className="text-muted-foreground">لم يحدّد — أرسلت قبل إضافة هذا الحقل</span>;
        const own = ownMaterialLabels(trainerPlan.content, (trainerPlan.content?.modules ?? []).map((m) => m.moduleId));
        return (
          <>
            <p className="mt-1 text-read leading-6 text-foreground">
              المستوى: {lv ? <b>{lv}</b> : unset}
            </p>
            <p className="mt-1 text-read leading-6 text-foreground">
              لمن: {who ? <b>{who}</b> : unset}
            </p>
            <p className="mt-1 text-read leading-6 text-foreground">
              الهدف: {goal ? <b>{goal}</b> : unset}
            </p>
            {/* وقالبُ الكرّاسة: إلزاميٌّ للجدد، ومستحسَنٌ لمن رفع كرّاسةً قبله (٦ أكتوبر ٢٠٢٦) —
                ثمّ صار للجديد أن يرفع مادّتَه الجاهزة بدلَه ويقولها، والمعتمِدُ يقرّر (٧ أكتوبر):
                فيُسمّى هنا ما رُفع بها، وما قاله في كلّ كرّاسةٍ بجانبها في بطاقة المنهج تحت */}
            <p className="mt-1 text-read leading-6 text-foreground">
              قالب الكرّاسة:{" "}
              {trainerPlan.workbookBeforeTemplate
                ? <><b>مستحسن لهذا المدرّب</b> <span className="text-muted-foreground">— رفع كرّاسة قبل القالب</span></>
                : <><b>القالب أو مادّته الجاهزة</b> <span className="text-muted-foreground">— يقول أيّهما في كلّ كرّاسة</span></>}
            </p>
            {own.length > 0 && (
              <p className="mt-1 text-read leading-6 text-gold-ink">
                بمادّته الجاهزة لا على القالب: <b>{own.join("، و")}</b> — اقبلها، أو أعدها إليه بملاحظة في «الكرّاسة».
              </p>
            )}
          </>
        );
      })()}
      {/* ═══ والمنهجُ كاملا — ما قرأه المدرّبُ قبل أن يرسل (المرحلة ٣) ═══

          «وهو ما سنقرؤه عند الموافقة» (صاحب المنصّة). وكانت البطاقةُ سطرا
          لكلّ موعدٍ وعددا للمصادر، ولا ترى مهمّةً ولا لقاءً — فيُعتمَد
          منهجٌ لم يُقرأ نصفُه. فصارت الصفحةَ نفسَها التي يقرؤها المدرّبُ في
          خطوته الأخيرة (`CurriculumReview`): لكلّ موعدٍ محاورُه ومتونُها
          وكرّاستُه ولقاءاتُه ومهامُّه ومصادرُه، بالترتيب. وتُفتح مطويّةً
          إلّا حين تنتظر قرارا. */}
      <div className="mt-3">
        <CurriculumReview
          view={curriculumView({
            title: trainerPlan.cohortTitle || cohortTitle,
            period: trainerPlan.period,
            content: trainerPlan.content,
            sessions: trainerPlan.sessions,
            assessments: trainerPlan.assessments,
            approvedOnce: trainerPlan.approvedOnce,
          })}
        />
      </div>
    </>
  );
}
