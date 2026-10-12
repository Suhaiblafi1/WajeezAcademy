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
import { useCallback, useEffect, useState } from "react";
import { apiDownload, apiGet, apiPost, ApiError } from "@/services/api";
import { useRealSession } from "@/services/session";
import { fmtDateAr, fmtDateTimeAr } from "@/utils/format";
import type { PlanSlot } from "@/application/trainer/axis-timeline";
import CurriculumReview from "@/components/CurriculumReview";
import { asLevelRange, levelRangeAr } from "@/application/trainer/cohort-level";
import { asAudience, goalsAr, stagesAr } from "@/application/trainer/cohort-audience";
import { ReviewNotesForm, ReviewNotesList } from "@/components/ReviewNotes";
import { PendingTasks } from "@/components/PendingTasks";
import { awaitingTasks } from "@/application/trainer/task-approval";
import { PlanDiffList, SinceReturnList } from "@/components/PlanDiff";
import { planDiff, sinceReturn } from "@/application/trainer/plan-diff";
import { REVIEW_NOTE_MAX, hasReviewNotes, type ReviewNotes } from "@/application/trainer/review-notes";
import { StaffField, staffAreaCls } from "@/components/FormKit";
import { ReviewReportUploader, type ReviewReport } from "@/components/ReviewReports";
import { PlanEditsUploader } from "@/components/PlanEdits";
import { curriculumView, type CurriculumInput } from "@/application/trainer/curriculum-view";
import { PLAN_AR, approvalBody, planApprovedMsg, taskDecisionMsg, type PlanDecision } from "@/application/trainer/plan-decision";
import { adminRegistrationLine } from "@/application/learning/registration-state";
import TrainerNextSteps from "@/components/admin/TrainerNextSteps";
import { signalPlansChanged } from "@/services/plans-signal";
import { Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { Download, ExternalLink } from "lucide-react";
import { Link } from "react-router";
import TabBar from "@/components/ui/TabBar";
import { cohortDayAr } from "@/application/learning/cohort-gate";
import { ownMaterialLabels, type WorkbookContent } from "@/application/trainer/cohort-workbooks";
import PlanScorecard from "@/components/PlanScorecard";
import { postponeChoices, postponedLineAr, seasonAr, seasonStart, type Season } from "@/application/trainer/plan-postpone";
import { blockedItems, planScorecard, scorecardNotes } from "@/application/trainer/plan-scorecard";

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
  /* أيُّ اللسانين يُعرض — الإدارةُ أوّلا: ما ينتظر قرارك (١١ أكتوبر ٢٠٢٦) */
  const [tab, setTab] = useState<"admin" | "plan">("admin");
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
  const [asking, setAsking] = useState(false);
  /* ما ينتظر المدرّبَ من التعديلات المقترحة — يكفي سببا لـ«اطلب تعديلات» */
  const [editsPending, setEditsPending] = useState(0);
  /* ما يُبدأ به صندوقُ الردّ — فارغا، أو ممّا سقط من بطاقة المعايير بنقرة (٨ أكتوبر ٢٠٢٦) */
  const [askFrom, setAskFrom] = useState<ReviewNotes | undefined>(undefined);
  /* ═══ والتأجيلُ إلى موسمٍ قادم — قرارٌ ثالث (٨ أكتوبر ٢٠٢٦) ═══
     «أختار أفضلَ اثنتين أو ثلاث… وأقول لهم أن يؤجّلوا الباقية — ويجب أن يعرفوا أنّي لا
     أقبلها لهذا الفصل». يُختار الموسمُ (التالي مقترَحا)، وكلمةٌ اختياريّة. */
  const [postponing, setPostponing] = useState(false);
  const [postponeTo, setPostponeTo] = useState(0);
  const [postponeNote, setPostponeNote] = useState("");
  /* وكلمةٌ تصله مع الاعتماد — للمقترَح لا للمطلوب (`approvalBody`، ٧ أكتوبر ٢٠٢٦) */
  const [approveNote, setApproveNote] = useState("");
  /* وفُعِّل مدرّبُها بهذا الاعتماد — فيظهر ما بقي عليك (`TrainerNextSteps`، «3a») */
  const [activated, setActivated] = useState(false);
  /* القضاءُ في الخطّة يُبلَّغ مرّتين: البابُ الذي فُتحت منه (الطابورُ يعلّمها)،
     والإطارُ الذي يعدّ ما ينتظر (`plans-signal.ts`) — فلا تبقى شارتُه على عددٍ مضى */
  const decided = (outcome: PlanOutcome) => { onPlanDecided?.(outcome); signalPlansChanged(); };

  /* ═══ وتُنزَّل للمراجعة خارجَ المنصّة (٧ أكتوبر ٢٠٢٦) ═══
     قرارُ صاحب المنصّة: زرُّ تنزيل. ZIP فيه المنهجُ نصّا مقروءا وكلُّ ملفٍّ رفعه
     المدرّب (`plan-review-bundle.ts`). ليس قرارا في الخطّة — فلا يمرّ بـ`act` ولا
     يُبلَّغ به البابُ الذي فُتحت منه، ولا يحبس أزرارَ القرار وهو يُنزَّل. */
  const [downloading, setDownloading] = useState(false);
  const downloadBundle = async () => {
    if (downloading) return;
    setDownloading(true); setMsg("");
    try {
      const name = await apiDownload(`/api/admin/cohorts/${cohortId}/trainer-plan/review-bundle`, "خطة-الشعبة.zip");
      setMsg(`نزّلت «${name}» — فيها المنهج وملفّات المدرّب. ولم تتغيّر الخطّة.`);
    } catch (e) { setMsg(e instanceof ApiError ? e.message : "تعذّر التنزيل"); }
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
          {/* ═══ لسانان: «الإدارة» لما تقرّره، و«المنهاج» لما أرسله المدرّب (١١ أكتوبر ٢٠٢٦) ═══
              «كثيرُ الكلام.. اجعله على شكل تابات». فالمنهجُ — أطولُ ما في البطاقة — في لسانه،
              ولا يمرّ عليه من جاء ليعتمد تعديلاتٍ أو يرفع تقريرا. والإدارةُ أوّلا: ما ينتظر قرارك. */}
          <TabBar
            className="mt-3"
            ariaLabel="أقسام الخطّة"
            items={[{ id: "admin", label: "الإدارة" }, { id: "plan", label: "المنهاج" }]}
            value={tab}
            onChange={setTab}
          />
        </>
      )}
      {trainerPlan && tab === "plan" && (
        <div role="tabpanel" aria-label="المنهاج" className="mt-3">
          <div className="flex flex-wrap gap-2">
            <Button as={Link} to={`/admin/plans/${cohortId}`} target="_blank" rel="noreferrer" tone="secondary" size="sm" icon={ExternalLink}>
              افتحه في صفحة منفصلة
            </Button>
        <Button tone="secondary" size="sm" icon={Download} disabled={downloading} onClick={() => void downloadBundle()}>
          {downloading ? "يجهّز التنزيل…" : "نزّل الخطّة للمراجعة"}
        </Button>
          </div>
          {msg && <p className="mt-3 text-read font-bold text-teal-light-ink" role="status">{msg}</p>}
          <div className="mt-3">
            <PlanCurriculum trainerPlan={trainerPlan} cohortTitle={cohortTitle} />
          </div>
        </div>
      )}
      {(!trainerPlan || tab === "admin") && (
        <div role="tabpanel" aria-label="الإدارة">
          {trainerPlan && (
            <>
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
              {/* ═══ وما تغيّر عن المعتمَد — مراجعةٌ لخطّةٍ معتمَدة (٣ج-٤) ═══

                  المنهجُ أدناه كما سيكون، ولا يقول ما الذي تغيّر: فإمّا يقرأ المعتمِدُ
                  عشرين موعدا ليجد التعديلَ الواحد، وإمّا يعتمد ما لم يره. فيُقال هنا
                  بخطوات المدرّب — حيث يكتب ملاحظتَه إن ردّ. */}
              {trainerPlan.status === "submitted" && trainerPlan.approvedPlan && (
                <Inset className="mt-3" role="region" aria-label="ما تغيّر عن المعتمد">
                  <p className="text-read font-black text-foreground">
                    ما تغيّر عن المعتمد
                    {trainerPlan.approvedPlan.reviewedAt && <span className="font-normal text-muted-foreground"> — اعتمدت {fmtDateAr(trainerPlan.approvedPlan.reviewedAt)}</span>}
                  </p>
                  <p className="mt-1 text-read leading-6 text-muted-foreground">
                    هذه خطّة معتمدة سابقا، وهنا ما غيّره المدرّب. والمنهج بعد اعتمادك في تبويب «المنهاج».
                  </p>
                  <div className="mt-2">
                    <PlanDiffList
                      sections={planDiff(trainerPlan.approvedPlan.content, trainerPlan.content, { date: cohortDayAr })}
                      emptyText="لم تتغيّر الخطّة نفسها — واللقاءات والمهامّ التي تعتمد معها أدناه."
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
                  <Inset className="mt-3" role="region" aria-label="ما تغيّر منذ ردّك">
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
              {/* ═══ بطاقةُ المعايير (٨ أكتوبر ٢٠٢٦) ═══
                  «أضف معاييرَ أخرى لتقييم العمل… اقترح أخرى وأنا أوافقك». ما تحسبه المنصّةُ
                  من الخطّة — ساعاتُ اللقاء، والفاصلُ بينها وأوقاتُها، والتطبيقاتُ والمهامّ
                  والمصادر — يُقرأ هنا قبل المنهج، والمدرّبُ رأى البطاقةَ نفسَها قبل أن يرسل. */}
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
              {/* سطرٌ واحدٌ بعدّها، وتُفتح بنقرة — ومفتوحةً إن سقط مطلوب («كثيرُ الكلام»، ١١ أكتوبر ٢٠٢٦) */}
              <details className="mt-3" open={blocked.length > 0}>
                <summary className="cursor-pointer text-read font-bold text-teal-light-ink">
                  بطاقة المعايير — {scorecard.filter((i) => i.status === "ok").length} تحقّق
                  {" · "}{scorecard.filter((i) => i.status === "advice").length} نصيحة
                  {" · "}{blocked.length} مطلوب
                </summary>
                <PlanScorecard
                  items={scorecard}
                  heading="بطاقة المعايير"
                  intro="تحسبها المنصّة من الخطّة، ورآها المدرّب قبل الإرسال. «مطلوب» يمنع الإرسال، و«نصيحة» قراره."
                />
              </details>
              {/* وما طُلب منه يُقرأ بأقسامه — وبعد إعادة الإرسال «ما طلبتَه» ليُقابَل
                  بما عُدّل في المنهج أعلاه، لا ليُتذكَّر من الذاكرة */}
              {(() => {
                const notes: ReviewNotes = trainerPlan.reviewerNotes ?? (trainerPlan.reviewerNote ? { general: trainerPlan.reviewerNote } : {});
                if (!hasReviewNotes(notes)) return null;
                /* وقيلت في «ما تغيّر منذ ردّك» أعلاه بجانب ما تغيّر — فلا تُكرَّر هنا (⑦) */
                if (trainerPlan.status === "submitted" && trainerPlan.returned) return null;
                const heading = trainerPlan.status === "submitted"
                  ? "ما طلبته في الردّ السابق — قابله بما عدّل"
                  : trainerPlan.status === "changes_requested" ? "ما طلب منه" : "ملاحظة القرار";
                return (
                  <Inset tone="warn" className="mt-2">
                    <p className="text-read font-black text-gold-ink">{heading}</p>
                    <ReviewNotesList notes={notes} />
                  </Inset>
                );
              })()}
              {/* وسقط هنا صندوقُ «يقترح المدرّبُ اسما آخر» (د-٦): اعتمادُ خطّةٍ
                  لا يُعيد تسميةَ دورةٍ في الكتالوج. واقتراحُ الاسم يصل الإدارةَ
                  في طابور اقتراحات المدرّبين، ويُعتمَد فيصير إصدارا جديدا (ح-٣). */}
            </>
          )}
          {/* والاعتمادُ يقول ما يُطلقه قبل النقر: اللقاءاتُ المنتظِرةُ تُعتمَد معه،
              ولكلٍّ اجتماعُه وإعلانُه (`decide` ← `decideSession`) */}
          {trainerPlan?.status === "submitted" && canApprovePlan && riding.length > 0 && (
            <p className="mt-3 text-read leading-6 text-muted-foreground">
              باعتمادها {riding.length === 1 ? "يعتمد لقاؤها المنتظر معها" : `تعتمد لقاءاتها المنتظرة (${riding.length}) معها`}:
              {" "}ينشأ لكل لقاء اجتماع Zoom، ويصل المسجّلين بالبريد — وأوّلها يزيل الجدول المبدئيّ إن وجد.
            </p>
          )}
          {/* ومهامُّها المنتظِرةُ كذلك — الاعتمادُ واحد (٣ج-٣) */}
          {trainerPlan?.status === "submitted" && canApprovePlan && waitingTasks.length > 0 && (
            <p className="mt-2 text-read leading-6 text-muted-foreground">
              {waitingTasks.length === 1
                ? "وتعتمد معها المهمّة المنتظرة أدناه، كما في تبويب «المنهاج»."
                : `وتعتمد معها المهامّ المنتظرة (${waitingTasks.length}) أدناه، كما في تبويب «المنهاج».`}
            </p>
          )}
          {/* ═══ وكلمةٌ تصله مع الاعتماد (٧ أكتوبر ٢٠٢٦) ═══
              الخطّةُ التي ليس عليها إلّا مقترحاتٌ تُعتمَد ولا تُردّ، وتصل مقترحاتُها في خبر
              اعتمادها «وكلمةُ الإدارة: …». وما يُطلب قبل الاعتماد مكانُه «اطلب تعديلات». */}
          {/* ═══ وتقريرُ المراجعة — يُرفع قبل القرار ويُحفظ مع الخطّة (٨ أكتوبر ٢٠٢٦) ═══
              يُرى مع «اعتمدها» ومع «اطلب تعديلات» معا: التقريرُ يرافع القرارَ أيًّا كان */}
          {trainerPlan?.status === "submitted" && canApprovePlan && (
            <ReviewReportUploader planId={trainerPlan.id} reports={trainerPlan.reviewReports ?? []} onChange={loadPlan} />
          )}
          {/* ═══ وتعديلاتٌ مقترحةٌ يقبل المدرّبُ كلًّا أو يرفضه (٨ أكتوبر ٢٠٢٦) ═══
              تُرفع والخطّةُ بانتظار القرار أو في يده، ويُرى حالُ كلّ بندٍ بعدها حتّى تُعتمَد */}
          {trainerPlan && trainerPlan.status !== "approved" && trainerPlan.status !== "published" && (
            <PlanEditsUploader
              planId={trainerPlan.id}
              cohortId={cohortId}
              canUpload={canApprovePlan}
              canReview={canReviewEdits}
              onPending={setEditsPending}
              offerSchedule={scorecard.some((i) => (i.key === "rhythm" || i.key === "session_times") && i.status !== "ok")}
            />
          )}
          {trainerPlan?.status === "submitted" && canApprovePlan && !asking && (
            <details className="mt-3" open={approveNote.length > 0}>
              <summary className="cursor-pointer text-read font-bold text-teal-light-ink">أضف كلمة تصله مع الاعتماد (اختياريّ)</summary>
              <div className="mt-2">
                <StaffField
                  label="كلمة الإدارة"
                  hint="تصل المدرّب مع خبر الاعتماد. للاقتراحات فقط؛ وما يجب تعديله قبل الاعتماد مكانه «اطلب تعديلات»."
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
          {trainerPlan?.status === "submitted" && canApprovePlan && !asking && blocked.length > 0 && (
            <Inset tone="warn" className="mt-3" role="group" aria-label="معايير ملزمة لم تتحقّق">
              <p className="text-read font-black text-gold-ink">
                {blocked.length === 1 ? "معيار ملزم لم يتحقّق" : `${blocked.length} معايير ملزمة لم تتحقّق`}: {blocked.map((b) => b.labelAr).join(" · ")}
              </p>
              <ul className="mt-2 list-disc space-y-1 ps-5 text-read leading-6 text-foreground">
                <li><b>اطلب تعديلات بما في البطاقة</b> (الأفضل): تملأ صناديق الردّ بما نقص في كل خطوة، فتعدّلها ثمّ ترسلها. ولا يعيد إرسالها حتّى يكمل المطلوب.</li>
                <li><b>اعتمدها كما هي</b>: تعتمد ناقصة، ويراها المتعلّمون كذلك — ويمكنك كتابة اقتراحاتك في كلمة الاعتماد أعلاه.</li>
              </ul>
            </Inset>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {trainerPlan?.status === "submitted" && canApprovePlan && !asking && (
              <>
                <Button tone="confirm" size="sm" disabled={busy}
                  onClick={() => act(
                    () => apiPost<PlanDecision>(`/api/admin/cohort-plans/${trainerPlan.id}/decide`, approvalBody(approveNote))
                      .then(async (r) => { setApproveNote(""); await Promise.all([loadPlan(), loadPendingSessions()]); if (r.prep?.activated) setActivated(true); decided("approved"); return r; }),
                    (r) => planApprovedMsg(r as PlanDecision),
                  )}>
                  {riding.length > 0 ? `اعتمدها ولقاءاتها (${riding.length})` : "اعتمدها"}{blocked.length > 0 ? " كما هي" : ""}{approveNote.trim() ? " مع كلمتك" : ""}
                </Button>
                {scorecard.some((i) => i.status !== "ok") && (
                  <Button tone="danger" size="sm" disabled={busy} onClick={() => { setAskFrom(scorecardNotes(scorecard)); setAsking(true); }}>
                    اطلب تعديلات بما في البطاقة
                  </Button>
                )}
                <Button tone={scorecard.some((i) => i.status !== "ok") ? "secondary" : "danger"} size="sm" disabled={busy} onClick={() => { setAskFrom(undefined); setAsking(true); }}>
                  {scorecard.some((i) => i.status !== "ok") ? "اطلب تعديلات بكلماتك" : "اطلب تعديلات"}
                </Button>
                {/* وشعبةٌ تعمل لا تُؤجَّل — مراجعتُها تُعتمَد أو تُردّ (`postpone` في الخادم) */}
                {!trainerPlan.approvedOnce && (
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
          {trainerPlan?.status === "submitted" && canApprovePlan && !asking && postponing && !trainerPlan.approvedOnce && (() => {
            const choices: Season[] = postponeChoices(trainerPlan.period, new Date().toISOString().slice(0, 10));
            const to = choices[postponeTo] ?? choices[0]!;
            return (
              <Inset tone="warn" className="mt-3" role="group" aria-label="تأجيل الشعبة إلى موسم قادم">
                <p className="text-read font-black text-gold-ink">أجّلها إلى موسم قادم — لم تقبل لهذا الفصل</p>
                <ul className="mt-2 list-disc space-y-1 ps-5 text-read leading-6 text-foreground">
                  <li>يصل المدرّب جرس وبريد يقولان صراحة إنّها <b>لم تقبل لهذا الفصل</b> وأجّلت إلى {seasonAr(to)} — ومعهما تقرير المراجعة إن رفعته أعلاه.</li>
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
                      () => apiPost(`/api/admin/cohort-plans/${trainerPlan.id}/postpone`, { year: to.year, season: to.season, note: postponeNote.trim() || undefined }).then(loadPlan),
                      `أجّلت إلى ${seasonAr(to)} — وصله جرس وبريد بأنّها لم تقبل لهذا الفصل`,
                    ).then((ok) => { if (ok) { setPostponing(false); setPostponeNote(""); decided("postponed"); } })}>
                    أجّلها إلى {seasonAr(to)}
                  </Button>
                  <Button tone="ghost" size="sm" disabled={busy} onClick={() => setPostponing(false)}>تراجع</Button>
                </div>
              </Inset>
            );
          })()}
          {trainerPlan?.status === "submitted" && canApprovePlan && asking && (
            <ReviewNotesForm
              key={askFrom ? "from-scorecard" : "blank"}
              initial={askFrom}
              editsPending={editsPending}
              onSend={(notes) => void act(
                () => apiPost(`/api/admin/cohort-plans/${trainerPlan.id}/decide`, { approve: false, note: notes }).then(loadPlan),
                "ردّت إليه — وكلّ ملاحظة في رأس خطوتها عنده",
              ).then((ok) => { if (ok) { setAsking(false); decided("changes_requested"); } })}
              busy={busy}
              onCancel={() => setAsking(false)}
            />
          )}
          {/* وما قاله الفعلُ يُقرأ حيث نُقر — لا أعلى البطاقة بعد منهجٍ طويل */}
          {msg && <p className="mt-3 text-read font-bold text-teal-light-ink" role="status">{msg}</p>}
          {/* وما بقي بعد الاعتماد الأخير — فتحُ شعبه وظهورُه العامّ، في الموضع الذي فُعِّل فيه */}
          {activated && <TrainerNextSteps cohortId={cohortId} />}

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
      )}
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
