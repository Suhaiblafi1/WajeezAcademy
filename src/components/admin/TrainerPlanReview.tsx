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
import { apiGet, apiPost, ApiError } from "@/services/api";
import { useRealSession } from "@/services/session";
import { fmtDateAr, fmtDateTimeAr } from "@/utils/format";
import type { PlanSlot } from "@/application/trainer/axis-timeline";
import CurriculumReview from "@/components/CurriculumReview";
import { asLevelRange, levelRangeAr } from "@/application/trainer/cohort-level";
import { ReviewNotesForm, ReviewNotesList } from "@/components/ReviewNotes";
import { PendingTasks } from "@/components/PendingTasks";
import { awaitingTasks } from "@/application/trainer/task-approval";
import { PlanDiffList, SinceReturnList } from "@/components/PlanDiff";
import { planDiff, sinceReturn } from "@/application/trainer/plan-diff";
import { hasReviewNotes, type ReviewNotes } from "@/application/trainer/review-notes";
import { curriculumView, type CurriculumInput } from "@/application/trainer/curriculum-view";
import { PLAN_AR, planApprovedMsg, taskDecisionMsg, type PlanDecision } from "@/application/trainer/plan-decision";
import { adminRegistrationLine } from "@/application/learning/registration-state";
import TrainerNextSteps from "@/components/admin/TrainerNextSteps";
import { signalPlansChanged } from "@/services/plans-signal";
import { Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { cohortDayAr } from "@/application/learning/cohort-gate";

interface TrainerPlan {
  id: string; status: string; reviewerNote: string | null; trainerName: string | null;
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
  content: {
    summaryAr?: string | null; modules?: { moduleId: string; titleAr: string }[]; resources?: { title: string; url: string }[];
    /* مدّةُ الشعبة كما حدّدها مدرّبُها — تُعتمَد مع الخطّة (٢٧ سبتمبر ٢٠٢٦) */
    startsOn?: string | null; endsOn?: string | null;
    /* مستوى الشعبة — مدًى من الثلاثة (٦ أكتوبر ٢٠٢٦)، ويُقرأ بـ`asLevelRange` */
    level?: unknown;
    /* ومواعيدُ المحاور وكرّاساتُها — `application/trainer/axis-timeline.ts` */
    slots?: PlanSlot[] | null;
  } | null;
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
export type PlanOutcome = "approved" | "changes_requested";

export default function TrainerPlanReview({ cohortId, cohortTitle, onDone, onPlanDecided }: {
  cohortId: string;
  /** اسمُ الشعبة كما في القائمة — عنوانُ المنهج إن خلت منه الخطّة */
  cohortTitle: string;
  /** بعد كلّ فعلٍ نجح — برسالته */
  onDone?: (msg: string) => void;
  onPlanDecided?: (outcome: PlanOutcome) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  /* خطّةُ المدرّب لهذه الشعبة — يعتمدها من يملك `cohort.plan.approve` (الأكاديميُّ
     والأعلى)، ويذكّره بها من يدير الشعبة. */
  const { user: viewer } = useRealSession();
  const canApprovePlan = viewer?.permissions.includes("cohort.plan.approve") ?? false;
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
  const [asking, setAsking] = useState(false);
  /* وفُعِّل مدرّبُها بهذا الاعتماد — فيظهر ما بقي عليك (`TrainerNextSteps`، «3a») */
  const [activated, setActivated] = useState(false);
  /* القضاءُ في الخطّة يُبلَّغ مرّتين: البابُ الذي فُتحت منه (الطابورُ يعلّمها)،
     والإطارُ الذي يعدّ ما ينتظر (`plans-signal.ts`) — فلا تبقى شارتُه على عددٍ مضى */
  const decided = (outcome: PlanOutcome) => { onPlanDecided?.(outcome); signalPlansChanged(); };

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
        <p className="text-read leading-6 text-muted-foreground">لم يبدأ المدرّبُ تجهيزَ الشعبة بعد.</p>
      ) : (
        <>
          <p className="text-read leading-6">
            <b>{PLAN_AR[trainerPlan.status] ?? trainerPlan.status}</b>
            {trainerPlan.trainerName ? <> · {trainerPlan.trainerName}</> : null}
            {trainerPlan.submittedAt ? <> · أُرسلت {fmtDateTimeAr(trainerPlan.submittedAt)}</> : null}
            {trainerPlan.trainerConfirmedAt ? <> · وأكّد موافقتَه على كلّ ما فيها</> : null}
          </p>
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
          {/* ═══ المدّةُ أوّلُ ما يُقرأ — وهي ما يُعتمَد (٢٧ سبتمبر ٢٠٢٦) ═══
              صار المدرّبُ يحدّد متى تبدأ شعبتُه ومتى تنتهي، وباعتمادك تصير
              حدودَها المعلَنة ويُشتقّ فصلُها من تاريخ بدئها. */}
          {trainerPlan.content?.startsOn && trainerPlan.content?.endsOn && (
            <p className="mt-2 text-read leading-6 text-foreground">
              المدّة: من <b>{cohortDayAr(trainerPlan.content.startsOn)}</b> إلى <b>{cohortDayAr(trainerPlan.content.endsOn)}</b>
              {" "}<span className="text-muted-foreground">— تصير حدودَ الشعبة المعلَنة باعتمادك.</span>
            </p>
          )}
          {/* ═══ ومستواها — لمن تُدرَّس (٦ أكتوبر ٢٠٢٦) ═══
              يختاره المدرّبُ في خطوته الأولى: مستوًى أو مدًى متّصل. والخطّةُ المرسَلةُ
              قبل القرار تصل بلا مستوى — فيُقال ذلك ولا يُخفى السطر. */}
          {(() => {
            const lv = levelRangeAr(asLevelRange(trainerPlan.content?.level));
            return (
              <p className="mt-1 text-read leading-6 text-foreground">
                المستوى: {lv ? <b>{lv}</b> : <span className="text-muted-foreground">لم يُحدَّد — أُرسلت قبل أن يُسأل عنه</span>}
              </p>
            );
          })()}
          {/* ═══ وما تغيّر عن المعتمَد — مراجعةٌ لخطّةٍ معتمَدة (٣ج-٤) ═══

              المنهجُ أدناه كما سيكون، ولا يقول ما الذي تغيّر: فإمّا يقرأ المعتمِدُ
              عشرين موعدا ليجد التعديلَ الواحد، وإمّا يعتمد ما لم يره. فيُقال هنا
              بخطوات المدرّب — حيث يكتب ملاحظتَه إن ردّ. */}
          {trainerPlan.status === "submitted" && trainerPlan.approvedPlan && (
            <Inset className="mt-3" role="region" aria-label="ما تغيّر عن المعتمَد">
              <p className="text-read font-black text-foreground">
                ما تغيّر عن المعتمَد
                {trainerPlan.approvedPlan.reviewedAt && <span className="font-normal text-muted-foreground"> — اعتُمدت {fmtDateAr(trainerPlan.approvedPlan.reviewedAt)}</span>}
              </p>
              <p className="mt-1 text-read leading-6 text-muted-foreground">
                هذه مراجعةٌ لخطّةٍ معتمَدة — وهذا ما تغيّر فيها بخطوات المدرّب. والمنهجُ أدناه كما سيكون باعتمادك.
              </p>
              <div className="mt-2">
                <PlanDiffList
                  sections={planDiff(trainerPlan.approvedPlan.content, trainerPlan.content, { date: cohortDayAr })}
                  emptyText="لم يتغيّر في الخطّة نفسِها شيء — وما يُعتمَد معها من لقاءاتٍ ومهامّ مذكورٌ أدناه."
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
                  {trainerPlan.returned.at && <span className="font-normal text-muted-foreground"> — رُدّت {fmtDateAr(trainerPlan.returned.at)}</span>}
                </p>
                <p className="mt-1 text-read leading-6 text-muted-foreground">
                  أعاد المدرّبُ إرسالَها بعد ردّك — هذا ما عدّله عن النسخة التي رددتَها، وملاحظتُك في كلّ خطوةٍ بجانبه.
                </p>
                <div className="mt-2">
                  <SinceReturnList general={since.general} rows={since.rows} />
                </div>
              </Inset>
            );
          })()}
          {/* ═══ والمنهجُ كاملا — ما قرأه المدرّبُ قبل أن يرسل (المرحلة ٣) ═══

              «وهو ما سنقرؤه عند الموافقة» (صاحب المنصّة). وكانت البطاقةُ سطرا
              لكلّ موعدٍ وعددا للمصادر، ولا ترى مهمّةً ولا لقاءً — فيُعتمَد
              منهجٌ لم يُقرأ نصفُه. فصارت الصفحةَ نفسَها التي يقرؤها المدرّبُ في
              خطوته الأخيرة (`CurriculumReview`): لكلّ موعدٍ محاورُه ومتونُها
              وكرّاستُه ولقاءاتُه ومهامُّه ومصادرُه، بالترتيب. وتُفتح مطويّةً
              إلّا حين تنتظر قرارا. */}
          <details className="mt-3" open={trainerPlan.status === "submitted"}>
            <summary className="cursor-pointer text-read font-bold text-teal-light-ink">المنهجُ كاملا — من الألف إلى الياء</summary>
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
          </details>
          {/* وما طُلب منه يُقرأ بأقسامه — وبعد إعادة الإرسال «ما طلبتَه» ليُقابَل
              بما عُدّل في المنهج أعلاه، لا ليُتذكَّر من الذاكرة */}
          {(() => {
            const notes: ReviewNotes = trainerPlan.reviewerNotes ?? (trainerPlan.reviewerNote ? { general: trainerPlan.reviewerNote } : {});
            if (!hasReviewNotes(notes)) return null;
            /* وقيلت في «ما تغيّر منذ ردّك» أعلاه بجانب ما تغيّر — فلا تُكرَّر هنا (⑦) */
            if (trainerPlan.status === "submitted" && trainerPlan.returned) return null;
            const heading = trainerPlan.status === "submitted"
              ? "ما طلبتَه في الردّ السابق — قابِله بما عُدّل"
              : trainerPlan.status === "changes_requested" ? "ما طُلب منه" : "ملاحظةُ القرار";
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
          باعتمادها {riding.length === 1 ? "يُعتمَد لقاؤها المنتظِرُ معها" : `تُعتمَد لقاءاتُها المنتظِرةُ (${riding.length}) معها`}:
          {" "}يُنشأ لكلٍّ اجتماعُ Zoom، ويُنشَر للمسجَّلين بتاريخه ويصلهم بالبريد — وأوّلُها يرفع ما بقي من الجدول المبدئيّ إن كان.
        </p>
      )}
      {/* ومهامُّها المنتظِرةُ كذلك — الاعتمادُ واحد (٣ج-٣) */}
      {trainerPlan?.status === "submitted" && canApprovePlan && waitingTasks.length > 0 && (
        <p className="mt-2 text-read leading-6 text-muted-foreground">
          {waitingTasks.length === 1
            ? "وباعتمادها تُعتمَد معها المهمّةُ المنتظِرةُ أدناه — كما تقرؤها في المنهج أعلاه."
            : `وباعتمادها تُعتمَد معها المهامُّ المنتظِرةُ (${waitingTasks.length}) أدناه — كما تقرؤها في المنهج أعلاه.`}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {trainerPlan?.status === "submitted" && canApprovePlan && !asking && (
          <>
            <Button tone="confirm" size="sm" disabled={busy}
              onClick={() => act(
                () => apiPost<PlanDecision>(`/api/admin/cohort-plans/${trainerPlan.id}/decide`, { approve: true })
                  .then(async (r) => { await Promise.all([loadPlan(), loadPendingSessions()]); if (r.prep?.activated) setActivated(true); decided("approved"); return r; }),
                (r) => planApprovedMsg(r as PlanDecision),
              )}>
              {riding.length > 0 ? `اعتمدها ولقاءاتِها (${riding.length})` : "اعتمدها"}
            </Button>
            <Button tone="danger" size="sm" disabled={busy} onClick={() => setAsking(true)}>
              اطلب تعديلات
            </Button>
          </>
        )}
        {trainerPlan?.status !== "submitted" && trainerPlan?.status !== "approved" && (
          <Button tone="secondary" size="sm" disabled={busy}
            onClick={() => {
              const note = window.prompt("كلمةٌ تُضاف إلى التذكير (اختياريّ):") ?? "";
              void act(() => apiPost(`/api/admin/cohorts/${cohortId}/remind-trainer`, { note: note.trim() || undefined }), "ذُكِّر المدرّب — جرسٌ وبريد");
            }}>
            ذكّر المدرّب بإكمال التجهيز
          </Button>
        )}
      </div>
      {trainerPlan?.status === "submitted" && canApprovePlan && asking && (
        <ReviewNotesForm
          busy={busy}
          onCancel={() => setAsking(false)}
          onSend={(notes) => void act(
            () => apiPost(`/api/admin/cohort-plans/${trainerPlan.id}/decide`, { approve: false, note: notes }).then(loadPlan),
            "رُدّت إليه — وكلُّ ملاحظةٍ في رأس خطوتها عنده",
          ).then((ok) => { if (ok) { setAsking(false); decided("changes_requested"); } })}
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
            ? "لقاءٌ واحدٌ ينتظر خطّةَ الشعبة — يُعتمَد معها حين يرسلها المدرّب، فلا قرارَ عليه وحدَه."
            : `لقاءاتٌ (${riding.length}) تنتظر خطّةَ الشعبة — تُعتمَد معها حين يرسلها المدرّب، فلا قرارَ عليها وحدَها.`}
        </p>
      )}
      {individual.length > 0 && canApprovePlan && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="text-read font-black text-foreground">
            لقاءاتٌ مباشرةٌ تنتظر قرارك ({individual.length})
          </p>
          <p className="mt-1 text-read leading-6 text-muted-foreground">
            باعتمادك يُنشأ اجتماعُ Zoom ويُنشَر اللقاءُ للمسجَّلين بتاريخه ويصلهم بالبريد.
            {/* والأوّلُ منها يرفع الجدولَ المبدئيّ (`clearPlaceholders`) — يُقال
                قبل النقر، فمن يعتمد يعرف ما يُخرجه من تقاويم المسجَّلين. */}
            {" "}وأوّلُ لقاءٍ تعتمده يرفع ما بقي من الجدول المبدئيّ الذي فُتحت به الشعبة، إن كان — فيرى المسجَّلون مواعيدَ مدرّبهم وحدَها.
          </p>
          <ul className="mt-3 space-y-2">
            {individual.map((ps) => (
              <Inset as="li" key={ps.id}>
                <p className="text-read font-bold text-foreground">{ps.title}</p>
                <p className="mt-1 text-read text-muted-foreground">
                  {fmtDateTimeAr(ps.startsAt)}
                  {ps.endsAt && <> — {fmtDateTimeAr(ps.endsAt)}</>}
                  {ps.attachmentName && <> · مرفقٌ: {ps.attachmentName}</>}
                </p>
                {ps.noteAr && <p className="mt-1 whitespace-pre-line text-read leading-6 text-muted-foreground">{ps.noteAr}</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button tone="confirm" size="sm" disabled={busy}
                    onClick={() => act(
                      () => apiPost(`/api/admin/cohort-sessions/${ps.id}/decide`, { approve: true }).then(loadPendingSessions),
                      "اعتُمد اللقاء — أُنشئ اجتماعُه وبُلِّغ المسجَّلون",
                    )}>
                    اعتمِدْه وأعلِنه
                  </Button>
                  <Button tone="danger" size="sm" disabled={busy}
                    onClick={() => {
                      const note = window.prompt("لمَ يُردّ؟ يصل مدرّبَه بنصّه:");
                      if (!note?.trim()) return;
                      void act(
                        () => apiPost(`/api/admin/cohort-sessions/${ps.id}/decide`, { approve: false, note: note.trim() }).then(loadPendingSessions),
                        "رُدّ اللقاءُ إلى مدرّبه",
                      );
                    }}>
                    ردَّه
                  </Button>
                </div>
              </Inset>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
