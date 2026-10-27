/* عملُ المرحلة — صندوقان لا صندوقٌ واحد.

   بكلام صاحب المنصّة: «وينجز ما هو مطلوب من دروس وحلقات وواجبات وقراءات
   ومصادر… كلُّ ما يتعلق بالدورة في خانتها والمصادرُ في خانةٍ منفصلة».

   • **صندوقُ الدورة** — ما يُنجَز، **طريقا من محطّات** (٢٦ أكتوبر ٢٠٢٦).
     كان ثلاثةَ تبويباتٍ (الدروس · الجلسات · الواجبات) فوقها صندوقُ الكرّاسة
     وتحتها مواعيدُ تكرّر صفحاتِها، فقال صاحبُ المنصّة: «غيرُ مفهومةٍ ومكتظّةٌ
     وغيرُ احترافيّة… تسلسلا للمراحل من أين يبدأ وماذا يقرأ… حتّى يتخرّج»،
     واختار المزيجَ «وأبقِه احترافيّا». فصار من أعلى إلى أسفل:
       ١) «خطوتك التالية» — فعلٌ واحدٌ يفتح عليه
       ٢) المحطّاتُ بترتيبها — في كلٍّ ما يُقرأ وما يُحضَر وما يُسلَّم، ونجومُها
       ٣) «حصادك» — ما قبله مدرّبُه من عمله
       ٤) الشهادةُ آخرَ الطريق
     والحسابُ كلُّه في `src/application/student/stage-path.ts`، وهنا رسمُه.

   • **صندوقُ المصادر** — ما يُرجَع إليه: موادُّ المدرّب وتسجيلاتُ الجلسات
     ومراجعُ الدورة العلميّة. مفصولٌ لأنّه لا «يُنجَز»: خلطُه بالعمل يجعل
     الطريقَ يبدو أطولَ ممّا هو. */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  ArrowLeft, Award, BookMarked, BookOpen, CalendarDays, CalendarPlus, Check, CheckCircle2, ChevronDown, Circle,
  Clock3, ExternalLink, FileText, Hourglass, Library, Loader2, Lock, Play, PlayCircle, Ruler, Send, Star, Video,
} from "lucide-react";
import SubmissionFeedback from "@/components/SubmissionFeedback";
import { SubmissionFilePick, SubmittedWork, UploadProgress } from "@/components/journey/SubmissionFile";
import { usePlatformConfig } from "@/hooks/usePlatformConfig";
import { readyToSubmit } from "@/application/learning/submission-file";
import SwitchCohort from "@/components/SwitchCohort";
import CourseCertificate from "@/components/journey/CourseCertificate";
import SessionEmbed from "@/components/journey/SessionEmbed";
import { readUserName } from "@/services/auth";
import { openableRecordings } from "@/application/learning/recording-href";
import { splitLessons } from "@/application/content/lesson-split";
import { parseChecks } from "@/application/content/module-checks";
import { fmtDate, fmtSession } from "@/application/text/format-ar";
import { westernDigits } from "@/application/text/date-parts";
import { referencesByIds } from "@/data/methodology";
import { overlayModules, readTypedLinks, resourceKind, type LearnerCohortWorkbook, type LearnerModuleWorkbook, type LearnerWorkbook } from "@/application/trainer/plan-overlay";
import { groupLabelAr } from "@/application/trainer/cohort-workbooks";
import { dayLabelAr } from "@/application/trainer/axis-timeline";
import { whenAr } from "@/application/learning/cohort-gate";
import { buildStagePath, evidenceOf, inPlanOnly, nextStep, readableModules, type NextStep, type PathStop, type StagePath } from "@/application/student/stage-path";
import { RESOURCE_META } from "@/components/resource-kind-meta";
import StopStars from "@/components/journey/StopStars";
import type { CourseFull } from "@/data/courses";
import type { JourneyStage } from "@/application/student/journey";
import type { LearnerRequest } from "@/services/learner-requests";
import { Panel, Card } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import {
  canSubmitNow, latestSubmission,
  type CohortAssessment, type CohortSession, type EnrollmentDetail, type MySubmission,
} from "@/services/enrollment-detail";
import { BriefView } from '@/components/LongText'

const SUBMISSION_STATUS: Record<string, { label: string; cls: string }> = {
  submitted: { label: "بانتظار المراجعة", cls: "border-white/20 text-muted-foreground" },
  under_review: { label: "قيد مراجعة المدرب", cls: "border-gold/50 text-gold-ink" },
  resubmit_requested: { label: "مطلوب إعادة التسليم", cls: "border-red-500/40 text-red-400" },
  accepted: { label: "مقبول", cls: "border-teal/50 text-teal-light-ink" },
  rejected: { label: "مرفوض", cls: "border-red-500/40 text-red-400" },
};
const ASSESSMENT_TYPE: Record<string, string> = { assignment: "واجب", quiz: "اختبار", project: "مشروع" };
const ATTENDANCE_LABEL: Record<string, string> = { present: "حاضر", late: "متأخر", absent: "غائب", excused: "معذور" };


export interface StageWorkHandlers {
  answers: Record<string, string>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  busy: string | null;
  onSubmit: (assessmentId: string, isResubmit: boolean) => void;
  onSubmitQuiz: (assessmentId: string, responses: { itemId: string; answer: string }[]) => void;
  onChanged: () => void;
  /* ملفُّ التسليم (١٠ أكتوبر ٢٠٢٦) — ما اختاره لكلّ واجب، ونسبةُ رفعه، وإعادةُ رفعٍ انقطع */
  files?: Record<string, File | null>;
  setFiles?: React.Dispatch<React.SetStateAction<Record<string, File | null>>>;
  progress?: Record<string, number>;
  onRetryFile?: (assessmentId: string, submissionId: string, file: File) => void;
}

export default function StageWork({
  stage,
  detail,
  full,
  request,
  handlers,
}: {
  stage: JourneyStage;
  detail: EnrollmentDetail;
  /** تفاصيلُ الدورة من الكتالوج — قد تنقص فتُقال، ولا تُختلق */
  full: CourseFull | null;
  /** طلبُ شهادةِ هذه الدورة إن كان — تقرؤه الصفحةُ مرّةً وتوزّعه */
  request: LearnerRequest | null;
  handlers: StageWorkHandlers;
}) {
  /* ٢(ب-٢): الساعةُ في حالةٍ لا في الرسم — `Date.now()` في الرسم غيرُ نقيّ.
     ونبضةٌ كلَّ دقيقةٍ تقلب «جارٍ الآن» إلى «مضى» بلا إعادة تحميل؛ أمّا فتحُ
     المحجوب فحكمُ الخادم، يصل مع القراءة التالية. */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  /* الأثرُ من موضعٍ واحدٍ تقرؤه شاشةُ الدراسة أيضا — فلا تختلف نجومُ المحطّة بينهما */
  const evidence = useMemo(() => evidenceOf(detail), [detail]);
  const { doneModules, attended, accepted } = evidence;
  /* ═══ خطّةُ المدرّب تعلو الكتالوج ═══

     كان `full.modules` وحدَها — وحداتُ الكتالوج — فما يؤلّفه مدرّبُ الشعبة
     ويُعتمَد لا يصل متعلّميه. قرارُ صاحب المنصّة (١٣ سبتمبر ٢٠٢٦). */
  const modules = useMemo(
    () => inPlanOnly(overlayModules(full?.modules ?? [], detail.cohort.trainerPlan), detail.cohort.trainerPlan),
    [full?.modules, detail.cohort.trainerPlan],
  );
  const percent = detail.courseProgress?.percent ?? stage.percent ?? 0;
  const trainers = detail.cohort.trainers.map((t) => t.profile.application.fullName);
  /* ٢(ب-٢): وقتُه في الشعبة، ومواعيدُ محاورها إن كانت لها مواعيد */
  const access = detail.access?.state ?? "open";
  const slots = useMemo(() => detail.cohort.trainerPlan?.slots ?? [], [detail.cohort.trainerPlan]);
  const cohortWorkbook = detail.cohort.trainerPlan?.workbook ?? null;
  /* أو كرّاساتُ المحاور — كلٌّ بموعد أسبق محاورها (٦ أكتوبر ٢٠٢٦) */
  const moduleWorkbooks = detail.cohort.trainerPlan?.moduleWorkbooks ?? [];
  /* وما لا رابطَ له يسقط هنا: التسجيلُ يصل من بابَين — مرفوعٌ عندنا أو
     واصلٌ من Zoom — وقراءةُ أحدِهما وحدَها تُظهر سطرا يفتح على `#`. */
  const recordings = openableRecordings(detail.cohort.sessions.flatMap((s) => s.recordings));
  const references = useMemo(() => referencesByIds(full?.referenceIds ?? []), [full?.referenceIds]);
  const planResources = detail.cohort.trainerPlan?.resources ?? [];
  const hasResources =
    detail.cohort.materials.length > 0 || recordings.length > 0 || references.length > 0 || planResources.length > 0;

  /* ═══ الطريق — أثرٌ مسجَّلٌ لا ضغطة ═══ */
  const latest = useMemo(
    () => new Map(detail.cohort.assessments.map((a) => [a.id, latestSubmission(detail, a.id)])),
    [detail],
  );
  const readable = useMemo(() => readableModules(modules), [modules]);
  const path = useMemo(
    () => buildStagePath({
      modules, slots, sessions: detail.cohort.sessions, assessments: detail.cohort.assessments,
      doneModules, attended, accepted,
    }),
    [modules, slots, detail.cohort.sessions, detail.cohort.assessments, doneModules, attended, accepted],
  );
  const at = new Date(now);
  const submittable = new Set(detail.cohort.assessments.filter((a) => canSubmitNow(detail, a, at)).map((a) => a.id));
  const step = nextStep({
    path,
    modules,
    sessions: detail.cohort.sessions,
    assessments: detail.cohort.assessments,
    submittable,
    resubmit: new Set([...submittable].filter((id) => latest.get(id)?.status === "resubmit_requested")),
    inReview: new Set([...latest].filter(([, s]) => s?.status === "submitted" || s?.status === "under_review").map(([id]) => id)),
    readable,
    doneModules,
    now,
  });
  /* «ابدأ من هنا» على المحور الذي تدعو إليه البطاقةُ نفسُه — حقيقةٌ واحدة لا اثنتان */
  const nextModuleId = step?.kind === "read" ? step.moduleId : null;

  /* المحطّةُ الحاليّةُ مفتوحةٌ أوّلَ ما يدخل، والباقي مطويّ يُفتح بنقرة */
  const [openStops, setOpenStops] = useState<Set<string>>(
    () => new Set(path.currentIndex >= 0 ? [path.stops[path.currentIndex].key] : []),
  );
  const toggleStop = (key: string, open: boolean) =>
    setOpenStops((cur) => {
      if (cur.has(key) === open) return cur;
      const next = new Set(cur);
      if (open) next.add(key);
      else next.delete(key);
      return next;
    });
  /* زرُّ البطاقة يفتح محطّتَه ثمّ ينزل إلى ما يدعو إليه */
  const reveal = (stopKey: string | null, targetId: string) => {
    if (stopKey) toggleStop(stopKey, true);
    window.setTimeout(() => {
      const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      document.getElementById(targetId)?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
    }, 60);
  };

  const finished = detail.status === "completed" || percent >= 100 || detail.certificates.length > 0;

  return (
    <div className="space-y-4">
      {/* ══ صندوقُ الدورة — ما يُنجَز ══ */}
      <Panel as="section" className="sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <h3 className="text-base font-black leading-snug">{stage.titleAr}</h3>
            <p className="mt-0.5 text-read leading-5 text-muted-foreground">
              {detail.cohort.title}
              {trainers.length > 0 && ` · ${trainers.join("، ")}`}
              {stage.hours > 0 && ` · ${stage.hours} ساعة`}
            </p>
          </div>
          <PathProgress path={path} percent={percent} />
        </div>

        {/* ونبذةُ المدرّب عن شعبته — كما قرأها المتعلّمُ قبل أن يدفع (١٠ أكتوبر ٢٠٢٦) */}
        {detail.cohort.trainerPlan?.summaryAr && (
          <p className="mt-3 whitespace-pre-line text-read leading-6 text-foreground">{detail.cohort.trainerPlan.summaryAr}</p>
        )}

        {/* تبديلُ الموعد قبل أن تبدأ الشعبة — قيودُه في الخادم، وهذه الشاشةُ
            لا تعرض إلّا ما يقبله. */}
        <SwitchCohort
          enrollmentId={detail.id}
          courseId={detail.cohort.course.id}
          cohortId={detail.cohort.id}
          startsAt={detail.cohort.startsAt}
          onSwitched={handlers.onChanged}
        />

        {/* ═══ بعد انتهاء الشعبة (٢(ب-٢)) ═══
            «تتوقّف اللقاءاتُ والتسليمات، ويبقى للمتعلّم ستّةُ أشهرٍ يقرأ فيها
            ما فُتح له». فتُقال له الحالُ وأجلُها — لا يكتشفها من زرٍّ يُردّ. */}
        {access !== "open" && (
          <Card as="p" tone="warn" className="mt-3 flex items-start gap-2 p-3.5 text-read leading-6 text-foreground">
            <Lock className="mt-1 h-3.5 w-3.5 shrink-0 text-gold-ink" aria-hidden="true" />
            <span>
              {access === "readonly"
                ? `انتهت هذه الشعبة${detail.access?.closesAt ? ` ${whenAr(detail.access.closesAt)}` : ""}. تقرأ ما فتح لك فيها${detail.access?.accessEndsAt ? ` حتّى ${whenAr(detail.access.accessEndsAt)}` : ""}، ولا تسليم جديدا بعد انتهائها — إلّا ما يطلب مدرّبك إعادته.`
                : "انتهت مدّة الوصول إلى موادّ هذه الشعبة — ستّة أشهر بعد انتهائها. تبقى هنا درجاتك وتسليماتك وشهادتك."}
            </span>
          </Card>
        )}

        <NextStepCard
          step={step}
          sessions={detail.cohort.sessions}
          courseId={stage.courseId}
          enrollmentId={detail.id}
          onReveal={reveal}
        />

        {/* كرّاسةُ الدورة مرّةً واحدة — وموضعُ كلّ محطّةٍ منها داخلَ المحطّة */}
        {cohortWorkbook && <CohortWorkbookCard wb={cohortWorkbook} />}
        {slots.length === 0 && moduleWorkbooks.length > 0 && (
          <ModuleWorkbooksCard list={moduleWorkbooks} modules={modules} />
        )}

        {path.stops.length === 0 ? (
          <Card as="p" className="mt-4 border-dashed px-4 py-6 text-center text-read leading-6 text-muted-foreground">
            لم يكتب متن هذه الدورة بعد. يظهر هنا فور كتابته.
          </Card>
        ) : (
          <ol aria-label="محطات الدورة" className="relative mt-5 space-y-3 before:absolute before:inset-y-6 before:start-[17px] before:w-0.5 before:rounded-full before:bg-foreground/15">
            {path.stops.map((s) => (
              <StopItem
                key={s.key}
                stop={s}
                open={openStops.has(s.key)}
                onToggle={(o) => toggleStop(s.key, o)}
                modules={modules}
                doneModules={doneModules}
                nextModuleId={nextModuleId}
                courseId={stage.courseId}
                enrollmentId={detail.id}
                workbook={cohortWorkbook}
                moduleWorkbooks={moduleWorkbooks}
                detail={detail}
                handlers={handlers}
                now={now}
              />
            ))}
            <FinishStop path={path} finished={finished} />
          </ol>
        )}

        <Elsewhere
          path={path}
          modules={modules}
          doneModules={doneModules}
          nextModuleId={nextModuleId}
          courseId={stage.courseId}
          enrollmentId={detail.id}
          detail={detail}
          handlers={handlers}
          now={now}
          hasSlots={slots.length > 0}
        />

        <p className="mt-4 text-read leading-5 text-muted-foreground">{EVIDENCE_NOTE}</p>
        <ProjectCard project={full?.practicalProject ?? null} />

        <Harvest detail={detail} latest={latest} />

        {/* آخرُ الطريق: قياسُ النمو ثمّ شهادتُها — بهذا الترتيب لا العكس */}
        <div id="certificate" className="mt-4 scroll-mt-4">
          {finished && (
            <div className="space-y-3 border-t border-white/10 pt-4">
              <Card tone="accent" className="flex flex-wrap items-center justify-between gap-3 bg-teal-ink/[0.06] p-3.5">
                <p className="min-w-0 text-read leading-5 text-foreground">
                  <span className="flex items-center gap-1.5 font-black text-foreground">
                    <Ruler className="h-3.5 w-3.5 text-teal-light-ink" /> قس نموّك في مهارات هذه الدورة
                  </span>
                  بالسلّم نفسه الذي قاسك قبلها — فيظهر الفرق مقيسا. مرّة واحدة لكلّ دورة.
                </p>
                <Link
                  to={`/student/remeasure/${detail.id}`}
                  className="shrink-0 rounded-full border border-teal/50 px-4 py-2 text-xs font-black text-teal-light-ink transition hover:bg-teal/10"
                >
                  افتح القياس
                </Link>
              </Card>
              <CourseCertificate
                enrollmentId={detail.id}
                courseTitleAr={stage.titleAr}
                certificates={detail.certificates}
                request={request}
                onChanged={handlers.onChanged}
              />
            </div>
          )}
          {/* ومن استوفى قواعد الإكمال قبل آخرها يرى طلبَ شهادته — أو طلبَه القائم (`CourseCertificate`) */}
          {!finished && (
            <div className="empty:hidden">
              <CourseCertificate
                enrollmentId={detail.id}
                courseTitleAr={stage.titleAr}
                certificates={detail.certificates}
                request={request}
                onChanged={handlers.onChanged}
                onlyIfEligible
              />
            </div>
          )}
        </div>
      </Panel>

      {/* ══ صندوقُ المصادر — ما يُرجَع إليه ══ */}
      <Panel as="section" className="sm:p-5">
        <h3 className="flex items-center gap-2 text-sm font-black text-foreground">
          <Library className="h-4 w-4 text-gold-ink" /> مصادر هذه المرحلة
        </h3>
        {!hasResources ? (
          <p className="mt-2 text-read leading-6 text-muted-foreground">
            لم تضف موادّ هذه الشعبة بعد. ما يختاره مدرّبك أو يرفعه يظهر هنا، ومعه تسجيلات الجلسات فور جهوزها.
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            {/* ما اختاره مدرّبُك — من خطّته المعتمَدة، بنوعِ كلِّ مصدرٍ
                معلَنا: كتابٌ وكتابٌ صوتيٌّ وفيديو لا تُقرأ من الرابط. */}
            {planResources.length > 0 && (
              <div>
                <p className="text-read font-bold text-muted-foreground">اختارها مدرّبك</p>
                <ul className="mt-2 space-y-1.5">
                  {planResources.map((r, i) => {
                    const meta = RESOURCE_META[resourceKind(r.kind)];
                    /* د-٣: المرفوعُ يُفتح من مسارٍ محروسٍ بالجلسة والالتحاق،
                       لا من رابطٍ خارجيّ — ولا `target="_blank"` عليه: هو
                       ملفُّ شعبته لا موقعٌ آخر. */
                    const uploaded = (r.bodyFileKey ?? "").trim();
                    const href = uploaded
                      ? `/api/v1/cohort-files/${encodeURIComponent(uploaded)}`
                      : r.url ?? "#";
                    return (
                      <li key={`${uploaded || r.url}-${i}`}>
                        <a
                          href={href}
                          {...(uploaded ? {} : { target: "_blank", rel: "noreferrer" })}
                          className="flex items-start gap-2 text-read leading-6 text-foreground transition hover:text-teal-light-ink"
                        >
                          <meta.icon className="mt-1 h-3.5 w-3.5 shrink-0 text-teal-light-ink" aria-hidden="true" />
                          <span className="min-w-0">
                            <span className="font-bold">{r.title}</span>
                            <span className="text-muted-foreground"> · {meta.label}</span>
                            {r.noteAr && <span className="mt-0.5 block text-muted-foreground">{r.noteAr}</span>}
                          </span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {detail.cohort.materials.length > 0 && (
              <div>
                <p className="text-read font-bold text-muted-foreground">موادّ الشعبة</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {detail.cohort.materials.map((m) => (
                    <a
                      key={m.id}
                      href={m.readUrl ?? m.externalUrl ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-h-9 items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-fine font-bold text-foreground transition hover:border-teal/50 hover:text-teal-light-ink"
                    >
                      <FileText className="h-3 w-3" /> {m.title}
                    </a>
                  ))}
                </div>
              </div>
            )}
            {recordings.length > 0 && (
              <div>
                <p className="text-read font-bold text-muted-foreground">تسجيلات الجلسات</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {recordings.map((rec) => (
                    <a
                      key={rec.id}
                      href={rec.href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-h-9 items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-fine font-bold text-foreground transition hover:border-teal/50 hover:text-teal-light-ink"
                    >
                      <PlayCircle className="h-3 w-3" /> {rec.title}
                      {rec.durationSec ? ` · ${Math.round(rec.durationSec / 60)} د` : ""}
                    </a>
                  ))}
                </div>
              </div>
            )}
            {/* مراجعُ الدورة العلميّة — من سجلّ المنهجيّة بأكوادها، وما لا
                يُعرف كودُه يُسقَط: لا مرجعَ يُختلق للمتعلّم. */}
            {references.length > 0 && (
              <div>
                <p className="text-read font-bold text-muted-foreground">مراجعها العلميّة</p>
                <ul className="mt-2 space-y-1.5">
                  {references.map((r) => (
                    <li key={r.id}>
                      <a
                        href={r.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-start gap-1.5 text-xs leading-5 text-muted-foreground transition hover:text-teal-light-ink"
                      >
                        <ExternalLink className="mt-1 h-3 w-3 shrink-0" />
                        <span>
                          <span className="font-bold text-foreground">{r.name_ar}</span>
                          <span className="text-muted-foreground"> · {r.organization}</span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ─────────── الدروس ─────────── */

type LessonModule = CourseFull["modules"][number] & {
  fromTrainer: boolean;
  bodyFileKey?: string | null;
  locked?: boolean;
  opensAt?: string | null;
};

/** سطرُ محورٍ في محطّته. بلا رقم: الرقمُ للمحطّة، ورقمُ المحور في القائمة كان
    يقفز «١ ثمّ ٩» حين تكون محاورُ الشعبة من مدرّبها بعد محاور الكتالوج (٢٦ أكتوبر ٢٠٢٦) */
function LessonRow({
  m,
  done,
  next,
  courseId,
  enrollmentId,
}: {
  m: LessonModule;
  done: boolean;
  next: boolean;
  courseId: string;
  /* شاشةُ الدراسة بمعرّف الدورة لا الشعبة، فلا تعرف أيَّ خطّةٍ تعلو متنَها.
     والمعرّفُ يُمرَّر في العنوان: المتعلّمُ نفسُه صاحبُ هذا التسجيل،
     والخادمُ يردّ ٤٠٣ لمن ليس صاحبَه — فلا يُقرأ به متنُ شعبةِ غيره. */
  enrollmentId: string;
}) {
  const lessons = splitLessons(m.body);
  const checks = parseChecks(m.checks).checks.filter((c) => c.chapterIndex === null).length;
  /* ع-٢: متنٌ مرفوعٌ متنٌ — لا «قيد التأليف» على محورٍ أرفق مدرّبُه وثيقتَه */
  const hasFile = Boolean((m.bodyFileKey ?? "").trim());
  const readable = !m.locked && (lessons.length > 0 || hasFile);
  return (
    <li
      className={`rounded-2xl border p-3 transition ${
        done ? "border-teal/40 bg-teal/[0.04]" : next && !m.locked ? "border-teal/50 bg-white/[0.04]" : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-xl text-fine font-black ${
            done ? "bg-teal text-on-teal" : next && !m.locked ? "bg-teal/20 text-teal-light-ink" : "bg-white/5 text-muted-foreground"
          }`}
        >
          {done ? <CheckCircle2 className="h-4 w-4" /> : <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />}
        </span>
        <span className="min-w-0 flex-1 basis-[10rem]">
          <span className={`block text-xs font-bold leading-snug ${done || next ? "" : "text-foreground"}`}>
            {m.title}
          </span>
          <span className="mt-0.5 block text-fine leading-4 text-muted-foreground">
            {/* محورٌ أضافه المدرّبُ ليس في الكتالوج، فلا ساعاتٍ له
                مقرَّرة — و«ساعة» بلا عددٍ أسوأُ من لا شيء. */}
            {m.hours ? `${m.hours} ساعة` : "من مدرّبك"}
            {m.hours && m.fromTrainer ? " · من مدرّبك" : ""}
            {!m.locked && lessons.length > 0 && ` · ${lessons.length} درسا`}
            {!m.locked && lessons.length === 0 && hasFile && " · محتواها ملفّ من مدرّبك"}
            {!m.locked && checks > 0 && ` · ${checks} تمرين استرجاع`}
            {!m.locked && m.scenario && " · سيناريو قرار"}
          </span>
        </span>
        {/* وحدةٌ بلا متن لا تُوسَم «ابدأ من هنا» ولا «لم تبدأ»:
            الأولى دعوةٌ إلى فراغ، والثانية تُلقي التأخيرَ على
            المتعلّم. فتُقال حالُها كما هي. والمحجوبةُ حتّى موعدها
            يُقال متى تُفتح — لا «قيد التأليف» عن محورٍ مكتوبٍ ينتظر. */}
        {m.locked ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full border border-white/15 px-2.5 py-0.5 text-fine font-bold text-muted-foreground">
            <Lock className="h-2.5 w-2.5" aria-hidden="true" /> {m.opensAt ? `يفتح ${whenAr(m.opensAt)}` : "طويت موادّه"}
          </span>
        ) : !readable ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full border border-gold/40 bg-gold/[0.07] px-2.5 py-0.5 text-fine font-bold text-gold-ink">
            {/* «قيد التأليف» كانت تُقرأ «الدورة لم تكتمل» — فقرّر صاحبُ المنصّة (٢٧ أكتوبر ٢٠٢٦)
                أن يُقال ما يعني المتعلّمَ: متى يصله، لا أنّ أحدا يكتبه */}
            <Clock3 className="h-2.5 w-2.5" aria-hidden="true" /> يصلك قبل جلسته
          </span>
        ) : done ? (
          <span className="shrink-0 rounded-full border border-teal/50 px-2.5 py-0.5 text-fine font-bold text-teal-ink">
            أنجزتها
          </span>
        ) : next ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-teal px-2.5 py-0.5 text-fine font-black text-on-teal">
            <Play className="h-2.5 w-2.5" /> ابدأ من هنا
          </span>
        ) : (
          <span className="flex shrink-0 items-center gap-1 text-fine text-muted-foreground">
            <Circle className="h-2.5 w-2.5" /> لم تبدأ
          </span>
        )}
        {readable && (
          <Link
            to={`/student/course/${courseId}/module/${m.id}?e=${encodeURIComponent(enrollmentId)}`}
            className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-fine font-bold text-foreground transition hover:border-teal/50 hover:text-teal-light-ink"
          >
            {done ? "راجعها" : "افتحها"}
          </Link>
        )}
      </div>
      {/* ناتجُ الدرس — سطرٌ واحد: هو ما يُقاس عليه الإنجاز */}
      {m.artifact && (
        <p className="mt-2 flex items-start gap-1.5 border-t border-white/[0.06] pt-2 text-read leading-5 text-muted-foreground">
          <FileText className="mt-0.5 h-3 w-3 shrink-0 text-gold-ink" />
          <span><span className="font-bold text-foreground">ما تخرج به: </span>{m.artifact}</span>
        </p>
      )}
    </li>
  );
}

function ProjectCard({ project }: { project: string | null }) {
  if (!project) return null;
  return (
    <Card tone="warn" className="mt-4">
      <p className="flex items-center gap-1.5 text-read leading-5 font-black text-gold-ink">
        <FileText className="h-3.5 w-3.5" /> مشروع هذه الدورة
      </p>
      <p className="mt-1.5 text-read leading-6 text-foreground">{project}</p>
    </Card>
  );
}

const EVIDENCE_NOTE = "الدرس يكتمل بدليل — تسليم يقبله مدرّبك، أو تقييم تجتازه، أو حضور جلسته. لا يعلّم مكتملا بضغطة.";

/* ─────────── خطُّ المواعيد ───────────

   قرارُ صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦): «إذا حدّد المحورَ الأوّل للأسبوع الأوّل
   فتظهر الكرّاسةُ لهذا المحور… وبعد اللقاء تظهر واجباتُ المحور ومصادرُه… وهكذا
   للمحور الثاني والثالث والرابع». فالشعبةُ التي لخطّتها مواعيدُ تُقرأ مواعيدَ:
   لكلّ موعدٍ تاريخاه وكرّاستُه ومحاورُه ومهامُّها، وما لم يُفتح يُقال متى يُفتح.
   والحجبُ نفسُه في الخادم (`projectPlanForLearner` و`gateAssessment`) — وهنا
   عرضُه وحدَه. */

/** رابطُ الكرّاسة — الملفُّ من المسار المحروس، والرابطُ خارجيّ */
function WorkbookLink({ wb, labelAr = "كرّاسة الموعد" }: { wb: LearnerWorkbook; labelAr?: string }) {
  const key = (wb.bodyFileKey ?? "").trim();
  const href = key ? `/api/v1/cohort-files/${encodeURIComponent(key)}` : wb.url ?? "";
  if (!href) return null;
  return (
    <a
      href={href}
      {...(key ? {} : { target: "_blank", rel: "noreferrer" })}
      className="mt-2 flex min-h-9 w-fit items-center gap-1.5 rounded-full border border-teal/40 bg-teal/[0.06] px-3 py-1.5 text-read font-bold text-teal-light-ink transition hover:border-teal"
    >
      <BookMarked className="h-3.5 w-3.5" aria-hidden="true" />
      {wb.title?.trim() || labelAr}
    </a>
  );
}

/* ─────────── كرّاسةُ الدورة — واحدةٌ للمحاور كلِّها (٣٠ سبتمبر ٢٠٢٦) ───────────

   قرارُ صاحب المنصّة: «اجعل الكرّاسةَ واحدةً فقط… على أن تكون كاملةً لكلّ
   المحاور، وأن يتأكّد أن تكون سهلةً على الطالب يتبعها محورا محورا». فالبطاقةُ
   تحمل الكرّاسةَ مرّةً واحدة، وفي كلّ محطّةٍ سطرٌ يقول أين محاورُها فيها.
   وكانت تحتها خريطتُها كاملةً أيضا — فتُقرأ الصفحاتُ مرّتين في الشاشة نفسِها،
   وهو أوّلُ ما سُمّي «مكتظّا» (٢٦ أكتوبر ٢٠٢٦). فبقيت الخريطةُ في المحطّات وحدَها. */
function CohortWorkbookCard({ wb }: { wb: LearnerCohortWorkbook }) {
  return (
    <Card tone="accent" className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 p-3">
      <p className="min-w-0 text-read leading-6">
        <span className="flex items-center gap-1.5 font-black text-foreground">
          <BookMarked className="h-4 w-4 text-teal-light-ink" aria-hidden="true" /> كرّاسة الدورة
        </span>
        <span className="text-muted-foreground">كرّاسة واحدة لكل المحطات. كل محطة تقول صفحاتها.</span>
      </p>
      {wb.file ? (
        <WorkbookLink wb={wb.file} labelAr="افتح كرّاسة الدورة" />
      ) : wb.locked && wb.opensAt ? (
        <p className="flex items-center gap-1.5 text-read text-muted-foreground">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" /> تفتح {whenAr(wb.opensAt)}
        </p>
      ) : null}
    </Card>
  );
}

/* ─────────── كرّاساتُ المحاور (٦ أكتوبر ٢٠٢٦) ───────────

   لكلّ محورٍ كرّاستُه — أو لمحاورَ متجاورةٍ كرّاسةٌ واحدة — تُفتح أوّلَ يومٍ في
   موعد أسبق محاورها. في كلّ موعدٍ تُذكر كرّاساتُ محاوره: رابطٌ إن فُتحت، ومتى
   تُفتح إن لم تُفتح. وبلا مواعيدَ تُجمع في بطاقةٍ واحدةٍ أعلى الدروس. */
function ModuleWorkbookLine({ w, ids }: { w: LearnerModuleWorkbook; ids: string[] }) {
  const label = `كرّاسة ${groupLabelAr(w, ids)}`;
  if (w.file) return <WorkbookLink wb={w.file} labelAr={label} />;
  if (w.locked && w.opensAt) {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-read text-muted-foreground">
        <Lock className="h-3.5 w-3.5" aria-hidden="true" /> {label} تفتح {whenAr(w.opensAt)}
      </p>
    );
  }
  return null;
}

function ModuleWorkbooksCard({ list, modules }: { list: LearnerModuleWorkbook[]; modules: LessonModule[] }) {
  const ids = modules.map((m) => m.id);
  return (
    <Card tone="accent" className="mb-3 p-3">
      <p className="flex items-center gap-1.5 text-read font-black text-foreground">
        <BookMarked className="h-4 w-4 text-teal-light-ink" aria-hidden="true" /> كرّاسات المحاور
      </p>
      <p className="mt-0.5 text-read leading-6 text-muted-foreground">لكلّ محور كرّاسته — تفتح أوّل يوم في موعده.</p>
      {list.map((w) => <ModuleWorkbookLine key={w.moduleIds.join("+")} w={w} ids={ids} />)}
    </Card>
  );
}

/* ─────────── التقدّمُ في رأس الصندوق ───────────

   «المحطّة ن من م» وشريطٌ مقطَّعٌ بعدد المحطّات — يرى أين هو من الطريق كلِّه
   لا نسبةً وحدَها. والنسبةُ باقيةٌ تحته: هي ما يحكم به الإكمال. */
function PathProgress({ path, percent }: { path: StagePath; percent: number }) {
  const n = path.stops.length;
  const done = path.stops.filter((s) => s.state === "done").length;
  return (
    <div className="w-full sm:max-w-[15rem]">
      {n > 0 && (
        <div className="mb-1.5 flex items-center justify-between gap-3 text-read">
          <span className="font-bold text-foreground tabular-nums">
            {path.currentIndex >= 0 ? `المحطة ${path.currentIndex + 1} من ${n}` : `أنجزت ${done} من ${n}`}
          </span>
          {path.stars.total > 0 && (
            <span className="flex items-center gap-1 font-bold tabular-nums text-gold-ink" aria-label={`نجومك ${path.stars.earned} من ${path.stars.total}`}>
              <Star className="h-3.5 w-3.5 fill-gold text-gold" aria-hidden="true" />
              {path.stars.earned}/{path.stars.total}
            </span>
          )}
        </div>
      )}
      {n > 0 ? (
        <div className="flex gap-1" aria-hidden="true">
          {path.stops.map((s) => (
            <span
              key={s.key}
              className={`h-1.5 flex-1 rounded-full ${s.state === "done" ? "bg-teal" : s.state === "current" ? "bg-gold" : "bg-foreground/10"}`}
            />
          ))}
        </div>
      ) : (
        <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
          <div className="h-full rounded-full bg-teal transition-all" style={{ width: `${Math.max(2, percent)}%` }} />
        </div>
      )}
      {/* والنسبةُ ليست دروسا وحدَها: ٤٠٪ دروس و٣٠٪ حضور و٣٠٪ واجبات واختبارات (`progress.service.ts`).
          وكانت تُقرأ «من دروسها مكتملة» فيرى من أتمّ دروسَه كلَّها ٧٠٪ ولا يدري لماذا (١٩ أكتوبر ٢٠٢٦) */}
      <p className="mt-1 text-read text-muted-foreground" title="من الدروس والحضور والواجبات">تقدمك {percent}٪</p>
    </div>
  );
}

/* ─────────── «خطوتك التالية» ───────────

   فعلٌ واحدٌ بزرٍّ واحد، والحكمُ في `nextStep`. والزرُّ فيروزيّ لا ذهبيّ:
   الذهبيُّ في هذه الشاشة لنموذج الاختبار (`one-primary-per-screen.test.ts`). */
/* عنوانٌ فيه «» لا يُلفّ بها ثانية — «بطاقة «فكرة»» قراءةٌ متعثّرة */
const quoted = (s: string) => (s.includes("«") ? s : `«${s}»`);

const STEP_BTN =
  "flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-teal px-4 py-2 text-xs font-black text-on-teal transition hover:bg-teal-light";

function NextStepCard({
  step,
  sessions,
  courseId,
  enrollmentId,
  onReveal,
}: {
  step: NextStep | null;
  sessions: CohortSession[];
  courseId: string;
  enrollmentId: string;
  onReveal: (stopKey: string | null, targetId: string) => void;
}) {
  if (!step) return null;
  let icon = Play;
  let title = "";
  let meta: string | null = null;
  let action: React.ReactNode = null;
  const reveal = (stopKey: string | null, target: string, label: string) => (
    <button type="button" onClick={() => onReveal(stopKey, target)} className={`${STEP_BTN} cursor-pointer`}>
      {label} <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );

  switch (step.kind) {
    case "live": {
      const s = sessions.find((x) => x.id === step.sessionId);
      icon = Video;
      title = `الجلسة الآن: ${step.title}`;
      meta = s ? fmtSession(s.startsAt) : null;
      action = s?.zoom ? (
        <a href={s.zoom.learnerUrl ?? s.zoom.joinUrl} target="_blank" rel="noreferrer" className={STEP_BTN}>
          <Video className="h-3.5 w-3.5" aria-hidden="true" /> ادخل الجلسة
        </a>
      ) : null;
      break;
    }
    case "resubmit":
      icon = Send;
      title = `أعد تسليم ${quoted(step.title)}`;
      meta = "طلب مدرّبك تعديله";
      action = reveal(step.stopKey, `task-${step.assessmentId}`, "افتح المهمة");
      break;
    case "submit":
      icon = Send;
      title = `سلّم ${quoted(step.title)}`;
      meta = step.dueAt ? `آخر موعد ${fmtDate(step.dueAt)}` : null;
      action = reveal(step.stopKey, `task-${step.assessmentId}`, "افتح المهمة");
      break;
    case "read":
      icon = BookOpen;
      title = `اقرأ ${quoted(step.title)}`;
      action = (
        <Link to={`/student/course/${courseId}/module/${step.moduleId}?e=${encodeURIComponent(enrollmentId)}`} className={STEP_BTN}>
          ابدأ القراءة <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      );
      break;
    case "session":
      icon = CalendarDays;
      title = `جلستك القادمة: ${step.title}`;
      meta = fmtSession(step.startsAt);
      action = (
        <a href={`/api/calendar/cohort-sessions/${step.sessionId}.ics`} className={STEP_BTN}>
          <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" /> أضفها لتقويمك
        </a>
      );
      break;
    case "review":
      icon = Hourglass;
      title = `عملك ${quoted(step.title)} عند مدرّبك`;
      meta = "يصلك رده هنا.";
      break;
    case "wait":
      icon = Clock3;
      title = `المحطة التالية: ${step.title}`;
      meta = step.opensAt ? `تفتح ${whenAr(step.opensAt)}` : null;
      break;
    case "finish":
      icon = Award;
      title = "أتممت محطات الدورة";
      meta = "شهادتك في آخر الطريق.";
      action = reveal(null, "certificate", "إلى الشهادة");
      break;
  }
  const Icon = icon;
  return (
    <Card as="section" tone="accent" aria-label="خطوتك التالية" className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal text-on-teal">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 basis-[12rem]">
        <span className="block text-fine font-bold text-teal-light-ink">خطوتك التالية</span>
        <p className="mt-0.5 text-sm font-black leading-snug text-foreground">{title}</p>
        {meta && <p className="mt-0.5 text-read text-muted-foreground">{meta}</p>}
      </div>
      {action}
    </Card>
  );
}

/* ─────────── المحطّة ───────────

   عقدةٌ على الخطّ تقول حالَها بشكلها لا بلونها وحدَه — علامةٌ لما أُنجز، ورقمٌ
   لما هو مفتوح، وقفلٌ لما ينتظر موعدَه — ومعها تسميةٌ نصّيّةٌ دائما. والمحطّةُ
   `<details>`: تُطوى وتُفتح بلا شيفرة، وما فيها في الصفحة وإن طُويت. */
function StopNode({ stop }: { stop: PathStop }) {
  const base = "absolute start-0 top-3 z-[1] grid h-9 w-9 place-items-center rounded-full text-xs font-black tabular-nums ring-4 ring-background";
  if (stop.state === "done") {
    return <span className={`${base} bg-teal text-on-teal`} aria-hidden="true"><Check className="h-4 w-4" /></span>;
  }
  if (stop.state === "current") {
    return <span className={`${base} bg-gold text-on-gold`} aria-hidden="true">{stop.seq}</span>;
  }
  if (stop.state === "locked") {
    return <span className={`${base} border border-foreground/15 bg-background text-muted-foreground`} aria-hidden="true"><Lock className="h-3.5 w-3.5" /></span>;
  }
  return <span className={`${base} border-2 border-teal/60 bg-background text-teal-light-ink`} aria-hidden="true">{stop.seq}</span>;
}

function StopChip({ stop }: { stop: PathStop }) {
  if (stop.state === "done") {
    return <span className="shrink-0 rounded-full border border-teal/50 px-2.5 py-0.5 text-fine font-bold text-teal-light-ink">أنجزتها</span>;
  }
  if (stop.state === "current") {
    return <span className="shrink-0 rounded-full bg-teal px-2.5 py-0.5 text-fine font-black text-on-teal">أنت هنا</span>;
  }
  if (stop.state === "locked") {
    return (
      <span className="flex shrink-0 items-center gap-1 rounded-full border border-foreground/15 px-2.5 py-0.5 text-fine font-bold text-muted-foreground">
        <Lock className="h-2.5 w-2.5" aria-hidden="true" /> {stop.opensAt ? `يفتح ${whenAr(stop.opensAt)}` : "لم يفتح بعد"}
      </span>
    );
  }
  return <span className="shrink-0 rounded-full border border-foreground/15 px-2.5 py-0.5 text-fine font-bold text-muted-foreground">مفتوحة</span>;
}

function StopPart({
  icon: Icon,
  label,
  done,
  children,
}: {
  icon: typeof BookOpen;
  label: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-read font-black text-foreground">
        <Icon className="h-3.5 w-3.5 text-teal-light-ink" aria-hidden="true" /> {label}
        {done && <CheckCircle2 className="h-3.5 w-3.5 text-teal-light-ink" aria-label="تم" />}
      </p>
      {children}
    </div>
  );
}

function StopItem({
  stop: s,
  open,
  onToggle,
  modules,
  doneModules,
  nextModuleId,
  courseId,
  enrollmentId,
  workbook,
  moduleWorkbooks,
  detail,
  handlers,
  now,
}: {
  stop: PathStop;
  open: boolean;
  onToggle: (open: boolean) => void;
  modules: LessonModule[];
  doneModules: Set<string>;
  nextModuleId: string | null;
  courseId: string;
  enrollmentId: string;
  workbook: LearnerCohortWorkbook | null;
  moduleWorkbooks: LearnerModuleWorkbook[];
  detail: EnrollmentDetail;
  handlers: StageWorkHandlers;
  now: number;
}) {
  const byId = new Map(modules.map((m) => [m.id, m]));
  const sessions = s.sessionIds.map((id) => detail.cohort.sessions.find((x) => x.id === id)).filter((x): x is CohortSession => Boolean(x));
  const tasks = s.assessmentIds.map((id) => detail.cohort.assessments.find((x) => x.id === id)).filter((x): x is CohortAssessment => Boolean(x));
  /* أين محاورُ هذه المحطّة في كرّاسة الدورة — مرّةً هنا لا في بطاقةٍ ثانيةٍ فوقها.
     والأرقامُ غربيّةٌ كسائر الشاشة: «ص ١٣–٢٠» بجانب «1 ديسمبر» رقمان في سطر. */
  const pages = workbook
    ? s.moduleIds.map((id) => workbook.parts.find((p) => p.moduleId === id)?.whereAr).filter((w): w is string => Boolean(w)).map(westernDigits)
    : [];
  return (
    <li className="relative ps-11 sm:ps-12">
      <StopNode stop={s} />
      {/* البطاقةُ من `Surface` لا حوافُّ مكتوبةٌ بيدها (`design-system.test.ts`). والعنوانُ
          يمتدّ إلى حوافّها بهامشٍ سالب، فالنقرُ على أيّ موضعٍ منها يفتحها */}
      <Card
        as="details"
        id={s.key}
        open={open}
        onToggle={(e: React.SyntheticEvent<HTMLElement>) => onToggle((e.currentTarget as HTMLDetailsElement).open)}
        tone={s.state === "current" ? "accent" : "default"}
        className="group scroll-mt-4"
      >
        <summary className="-m-5 flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1.5 p-5 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1 basis-[13rem]">
            <span className={`block text-sm font-black leading-snug ${s.state === "locked" ? "text-muted-foreground" : "text-foreground"}`}>
              {s.title}
            </span>
            <span className="mt-0.5 block text-read text-muted-foreground">
              {s.slot ? `الموعد ${s.seq} · ${dayLabelAr(s.slot.startsOn)} – ${dayLabelAr(s.slot.endsOn)}` : `المحطة ${s.seq}`}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <StopStars stars={s.stars} />
            <StopChip stop={s} />
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition group-open:rotate-180" aria-hidden="true" />
        </summary>

        <div className="mt-5 space-y-4 border-t border-foreground/[0.06] pt-4">
          <StopPart icon={BookOpen} label="اقرأ" done={s.marks.read === "done"}>
            {s.slot?.workbook ? (
              <WorkbookLink wb={s.slot.workbook} />
            ) : s.slot?.hasWorkbook && s.slot.locked ? (
              <p className="mb-2 flex items-center gap-1.5 text-read text-muted-foreground">
                <BookMarked className="h-3.5 w-3.5" aria-hidden="true" /> كرّاسته تفتح أوّل يوم في موعده
              </p>
            ) : null}
            {/* كرّاساتُ محاوره — والممتدّةُ على موعدين تُذكر في كليهما */}
            {s.slot && moduleWorkbooks
              .filter((w) => w.moduleIds.some((id) => s.moduleIds.includes(id)))
              .map((w) => <ModuleWorkbookLine key={w.moduleIds.join("+")} w={w} ids={modules.map((m) => m.id)} />)}
            <ul className="mt-2 space-y-2">
              {s.moduleIds.map((id) => {
                const m = byId.get(id);
                return m ? (
                  <LessonRow key={m.id} m={m} done={doneModules.has(m.id)} next={m.id === nextModuleId} courseId={courseId} enrollmentId={enrollmentId} />
                ) : null;
              })}
            </ul>
            {pages.length > 0 && workbook && (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="flex items-center gap-1.5 text-read text-muted-foreground">
                  <BookMarked className="h-3.5 w-3.5" aria-hidden="true" /> في الكرّاسة: {pages.join(" · ")}
                </p>
                {!s.locked && workbook.file && <WorkbookLink wb={workbook.file} labelAr="افتح الكرّاسة" />}
              </div>
            )}
          </StopPart>

          {sessions.length > 0 && (
            <StopPart icon={CalendarDays} label="احضر" done={s.marks.attend === "done"}>
              <div className="space-y-2">
                {sessions.map((x) => <SessionCard key={x.id} s={x} detail={detail} />)}
              </div>
            </StopPart>
          )}

          {tasks.length > 0 && (
            <StopPart icon={Send} label="سلّم" done={s.marks.submit === "done"}>
              <div className="space-y-3">
                {tasks.map((a) => <AssessmentCard key={a.id} a={a} detail={detail} handlers={handlers} now={now} />)}
              </div>
            </StopPart>
          )}
        </div>
      </Card>
    </li>
  );
}

/* آخرُ الطريق — الشهادةُ عقدةٌ مميّزةُ الشكل لا محطّةٌ أخرى */
function FinishStop({ path, finished }: { path: StagePath; finished: boolean }) {
  const left = path.stops.filter((s) => s.state !== "done").length;
  return (
    <li className="relative ps-11 sm:ps-12">
      <span
        className={`absolute start-0 top-1.5 z-[1] grid h-9 w-9 place-items-center rounded-full ring-4 ring-background ${
          finished ? "bg-gold text-on-gold" : "border border-foreground/15 bg-background text-gold-ink"
        }`}
        aria-hidden="true"
      >
        <Award className="h-4 w-4" />
      </span>
      <a href="#certificate" className="block rounded-2xl px-1 py-2 transition hover:text-teal-light-ink">
        <span className="block text-sm font-black text-foreground">الشهادة</span>
        <span className="block text-read text-muted-foreground">
          {finished ? "أتممت الطريق. شهادتك في الأسفل." : `تصدر بعد آخر محطة · باقي ${left} من ${path.stops.length}`}
        </span>
      </a>
    </li>
  );
}

/* ─────────── ما لا محطّةَ له ───────────

   محاورُ ليست في موعدٍ من خطّة الشعبة، وجلساتٌ خارج مواعيدها، ومهامُّ بلا محور.
   تُعرض بعد الطريق كما هي — لا تُخفى، ولا تُحسب في نجومه. */
function Elsewhere({
  path,
  modules,
  doneModules,
  nextModuleId,
  courseId,
  enrollmentId,
  detail,
  handlers,
  now,
  hasSlots,
}: {
  path: StagePath;
  modules: LessonModule[];
  doneModules: Set<string>;
  nextModuleId: string | null;
  courseId: string;
  enrollmentId: string;
  detail: EnrollmentDetail;
  handlers: StageWorkHandlers;
  now: number;
  hasSlots: boolean;
}) {
  const loose = modules.filter((m) => path.looseModuleIds.includes(m.id));
  const sessions = detail.cohort.sessions.filter((s) => path.looseSessionIds.includes(s.id));
  const tasks = detail.cohort.assessments.filter((a) => path.looseAssessmentIds.includes(a.id));
  const noSessions = detail.cohort.sessions.length === 0;
  if (loose.length === 0 && sessions.length === 0 && tasks.length === 0 && !noSessions) return null;
  return (
    <div className="mt-5 space-y-4 border-t border-foreground/10 pt-4">
      {loose.length > 0 && (
        <StopPart icon={BookOpen} label="محاور أخرى" done={false}>
          <ul className="space-y-2">
            {loose.map((m) => (
              <LessonRow key={m.id} m={m} done={doneModules.has(m.id)} next={m.id === nextModuleId} courseId={courseId} enrollmentId={enrollmentId} />
            ))}
          </ul>
        </StopPart>
      )}
      {sessions.length > 0 && (
        <StopPart icon={CalendarDays} label={hasSlots ? "جلسات أخرى" : "جلسات الدورة"} done={false}>
          <div className="space-y-2">
            {sessions.map((x) => <SessionCard key={x.id} s={x} detail={detail} />)}
          </div>
        </StopPart>
      )}
      {noSessions && (
        <p className="text-read leading-6 text-muted-foreground">لم تجدول جلسات هذه الشعبة بعد — تظهر هنا بمواعيدها فور جدولتها.</p>
      )}
      {tasks.length > 0 && (
        <StopPart icon={Send} label="مهام عامة" done={false}>
          <div className="space-y-3">
            {tasks.map((a) => <AssessmentCard key={a.id} a={a} detail={detail} handlers={handlers} now={now} />)}
          </div>
        </StopPart>
      )}
    </div>
  );
}

/* ─────────── «حصادك» ───────────

   ما قبله مدرّبُه من عمله، يُجمع محطّةً محطّة — فيرى في آخر الدورة ما صنعه
   لا نسبةً عنه. والمقبولُ وحدَه: ما ينتظر المراجعةَ ليس حصادا بعد. */
function Harvest({ detail, latest }: { detail: EnrollmentDetail; latest: Map<string, MySubmission | null> }) {
  if (detail.cohort.assessments.length === 0) return null;
  const items = detail.cohort.assessments
    .map((a) => ({ a, s: latest.get(a.id) ?? null }))
    .filter((x): x is { a: CohortAssessment; s: MySubmission } => x.s?.status === "accepted");
  return (
    <Card as="section" aria-label="حصادك" className="mt-4">
      <p className="flex items-center gap-1.5 text-read font-black text-foreground">
        <Award className="h-4 w-4 text-gold-ink" aria-hidden="true" /> حصادك
        <span className="font-bold text-muted-foreground tabular-nums">· {items.length} من {detail.cohort.assessments.length}</span>
      </p>
      {items.length === 0 ? (
        <p className="mt-1 text-read leading-6 text-muted-foreground">كل عمل يقبله مدرّبك يجمع هنا، فترى في آخر الدورة ما أنجزته.</p>
      ) : (
        <ul className="mt-2 divide-y divide-foreground/[0.06]">
          {items.map(({ a, s }) => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-read">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-teal-light-ink" aria-hidden="true" />
              <span className="min-w-0 flex-1 basis-[10rem] font-bold text-foreground">{a.title}</span>
              <span className="text-muted-foreground">{fmtDate(s.submittedAt)}</span>
              {s.grades[0] && (
                <span className="rounded-full bg-teal/15 px-2.5 py-0.5 text-fine font-black tabular-nums text-teal-light-ink">
                  {Number(s.grades[0].score)}/{Number(s.grades[0].maxScore)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ─────────── الجلسة ─────────── */

function SessionCard({ s, detail }: { s: CohortSession; detail: EnrollmentDetail }) {
  const [here, setHere] = useState(false);
  const mine = detail.attendance.find((a) => a.sessionId === s.id);
  /* ٢(ب-١): اللقاءُ الذي انتهى يُكتب «انعقد» — ورابطُه لا يصل أصلا
     (الخادمُ يُسقطه). فلا «أضِفها لتقويمك» على ما مضى. */
  const held = s.status === "done";
  return (
    <Card className="bg-paper/20 p-3.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-[11rem]">
          <p className="text-read font-bold leading-snug">{s.title}</p>
          <p className="mt-0.5 text-read text-muted-foreground">{fmtSession(s.startsAt)}</p>
        </div>
        {held && (
          <span className="shrink-0 rounded-full border border-white/15 px-2.5 py-0.5 text-fine font-bold text-muted-foreground">
            انعقد
          </span>
        )}
        {mine && (
          <span className="shrink-0 rounded-full border border-white/15 px-2.5 py-0.5 text-fine font-bold text-muted-foreground">
            {ATTENDANCE_LABEL[mine.status] ?? mine.status}
          </span>
        )}
        {!held && (
          <a
            href={`/api/calendar/cohort-sessions/${s.id}.ics`}
            className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-fine font-bold text-muted-foreground transition hover:border-white/35 hover:text-foreground"
          >
            <CalendarPlus className="h-3 w-3" /> أضفها لتقويمك
          </a>
        )}
        {s.zoom && (
          <a
            href={s.zoom.learnerUrl ?? s.zoom.joinUrl}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-teal px-4 py-1.5 text-fine font-black text-on-teal transition hover:bg-teal-light"
          >
            <Video className="h-3 w-3" /> ادخل الجلسة
          </a>
        )}
        {/* «هنا» إضافةٌ هادئةٌ بجانب الفعل لا بديلٌ عنه: من ضغطها بقيَ في
            صفحته، ومن لم يضغطها فتطبيقُ Zoom كما كان. ولا تظهر لجلسةٍ
            بلا رقمِ اجتماعٍ لأنّ التضمينَ يحتاج الرقمَ لا الرابط. */}
        {s.zoom?.meetingId && (
          <Button
            tone="secondary"
            size="sm"
            icon={Video}
            onClick={() => setHere((v) => !v)}
            aria-expanded={here}
            className="min-h-9 shrink-0"
          >
            {here ? "أغلق هنا" : "افتح هنا"}
          </Button>
        )}
      </div>
      {s.zoom?.passcode && (
        <p className="mt-2 text-read text-muted-foreground">
          رمز المرور: <span className="font-mono text-foreground" dir="ltr">{s.zoom.passcode}</span>
        </p>
      )}
      {here && (
        <SessionEmbed
          sessionId={s.id}
          userName={readUserName() ?? "متعلم وجيز"}
          onClose={() => setHere(false)}
        />
      )}
    </Card>
  );
}

/* ─────────── المهمّة ─────────── */

function AssessmentCard({ a, detail, handlers, now }: { a: CohortAssessment; detail: EnrollmentDetail; handlers: StageWorkHandlers; now: number }) {
  const { answers, setAnswers, busy, onSubmit, onSubmitQuiz, files = {}, setFiles, progress = {}, onRetryFile } = handlers;
  const { fileUploads } = usePlatformConfig();
  const mine = latestSubmission(detail, a.id);
  const meta = mine ? SUBMISSION_STATUS[mine.status] : null;
  /* ٢(ب-٢): يحكم بها `submitVerdict` نفسُها التي يحكم بها الخادم —
     مهمّةٌ لم تُفتح، أو شعبةٌ انتهت، لا نموذجَ لها */
  const canSubmit = canSubmitNow(detail, a, new Date(now));
  const closed = !a.locked && !canSubmit && (!mine || mine.status === "resubmit_requested");
  const overdue = canSubmit && !mine && a.dueAt !== null && Date.parse(a.dueAt) < now;
  if (a.locked) {
    return (
      <Card id={`task-${a.id}`} className="scroll-mt-4 border-dashed bg-paper/10 p-3.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="min-w-0 flex-1">
            <p className="text-read font-bold leading-snug text-muted-foreground">{a.title}</p>
            <p className="mt-0.5 text-read text-muted-foreground">
              {ASSESSMENT_TYPE[a.type] ?? a.type}
              {a.dueAt && ` · يستحق ${fmtDate(a.dueAt)}`}
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1 rounded-full border border-white/15 px-2.5 py-0.5 text-fine font-bold text-muted-foreground">
            <Lock className="h-2.5 w-2.5" aria-hidden="true" />
            {a.opensAt ? `تفتح ${whenAr(a.opensAt)}` : "طويت"}
          </span>
        </div>
        {a.opensAt && (
          <p className="mt-2 text-read leading-6 text-muted-foreground">تفتح بعد انتهاء أوّل لقاء لمحورها — وتعليماتها معها.</p>
        )}
      </Card>
    );
  }
  return (
    <Card id={`task-${a.id}`} className="scroll-mt-4 bg-paper/20 p-3.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="text-read font-bold leading-snug">{a.title}</p>
          <p className="mt-0.5 text-read text-muted-foreground">
            {ASSESSMENT_TYPE[a.type] ?? a.type} · من {a.maxScore}
            {a.dueAt && ` · يستحق ${fmtDate(a.dueAt)}`}
          </p>
        </div>
        {meta && <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-fine font-bold ${meta.cls}`}>{meta.label}</span>}
        {/* «المتأخّرُ يُقبل ويُعلَّم» — والعلامةُ كُتبت لحظةَ التسليم */}
        {mine?.late && (
          <span className="shrink-0 rounded-full border border-gold/40 px-2.5 py-0.5 text-fine font-bold text-gold-ink">سلّم متأخّرا</span>
        )}
        {mine?.grades[0] && (
          <span className="shrink-0 rounded-full bg-teal/15 px-2.5 py-0.5 text-fine font-black text-teal-light-ink">
            {Number(mine.grades[0].score)}/{Number(mine.grades[0].maxScore)}
          </span>
        )}
      </div>
      {/* ═══ التعليماتُ والمرفقات ═══

          كان المتعلّمُ يُطالَب بتسليمٍ ويرى عنوانا ودرجةً وموعدا لا
          غير: `briefAr` — ما يكتبه مدرّبُه من تعليمات — لم يكن يُعرض
          له أصلا. فهو يُسأل عملا بلا أن يُقال له ما المطلوب.

          والتعليماتُ نصٌّ كما كُتبت لا Markdown مصيَّرا: هذه الشاشةُ
          خريطةٌ لا مشغّل، وحارسُ `lesson-split.test.ts` يمنع تفريغَ
          المتن فيها — وهو محقّ، فالجدارُ الذي شُكي منه عاد منه. وهي
          تُعرض كما يراها مدرّبُها في شاشته حرفا بحرف. */}
      {a.briefAr && <BriefView text={a.briefAr} className="mt-3" />}
      {readTypedLinks(a.attachments).length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {readTypedLinks(a.attachments).map((att, i) => {
            const meta = RESOURCE_META[resourceKind(att.kind)];
            /* والمرفقُ المرفوعُ من المسار المحروس — يُقرأ بعد فتح مهمّته وحدَه */
            const key = (att.bodyFileKey ?? "").trim();
            return (
              <li key={`${key || att.url}-${i}`}>
                <a
                  href={key ? `/api/v1/cohort-files/${encodeURIComponent(key)}` : att.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-9 items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-read font-bold text-foreground transition hover:border-teal/50 hover:text-teal-light-ink"
                >
                  <meta.icon className="h-3.5 w-3.5 text-teal-light-ink" aria-hidden="true" /> {att.title}
                </a>
              </li>
            );
          })}
        </ul>
      )}
      {mine && (
        <SubmittedWork submission={mine} kept={files[a.id] ?? null} busy={busy === a.id}
          onRetry={onRetryFile ? (f) => onRetryFile(a.id, mine.id, f) : undefined} />
      )}
      {busy === a.id && progress[a.id] !== undefined && <UploadProgress pct={progress[a.id]} />}
      {mine && <SubmissionFeedback submission={mine} criteria={a.rubric?.criteria} className="mt-3" />}
      {closed && (
        <p className="mt-3 text-read leading-6 text-muted-foreground">انتهت الشعبة — والتسليم يتوقّف بانتهائها.</p>
      )}
      {overdue && (
        <p className="mt-3 text-read leading-6 text-gold-ink">فات موعدها — وما زال التسليم يقبل، ويعلّم متأخّرا.</p>
      )}
      {canSubmit && a.type === "quiz" && a.items.length > 0 && (
        <QuizAttemptForm items={a.items} busy={busy === a.id} onSubmit={(r) => onSubmitQuiz(a.id, r)} />
      )}
      {/* ═══ واختبارٌ بلا أسئلةٍ يُجاب كتابةً (٢٠ أكتوبر ٢٠٢٦) ═══
           المدرّبُ يختار «اختبار» ولا محرّرَ أسئلةٍ له بعد، فكانت بطاقتُه بلا نموذجٍ أبدا وتبقى في «ما عليك» —
           قرارُ صاحب المنصّة «Treat as text»: يُسلَّم نصّا أو ملفّا ويقيّمه المدرّبُ في طابوره */}
      {canSubmit && (a.type !== "quiz" || a.items.length === 0) && (
        <div className="mt-3">
          <textarea
            value={answers[a.id] ?? ""}
            onChange={(e) => setAnswers((prev) => ({ ...prev, [a.id]: e.target.value }))}
            placeholder={mine?.status === "resubmit_requested" ? "أعد التسليم بعد معالجة الملاحظات…" : "اكتب إجابتك هنا…"}
            rows={3}
            className="w-full rounded-xl border border-white/15 bg-paper/30 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/75 focus:border-teal focus:outline-none"
          />
          {/* والملفُّ مع النصّ أو وحدَه — لا يُطلب من المتعلّم رابطٌ مكانَ ملفّه */}
          {fileUploads && setFiles && (
            <SubmissionFilePick file={files[a.id] ?? null} disabled={busy === a.id}
              onPick={(f) => setFiles((prev) => ({ ...prev, [a.id]: f }))} />
          )}
          <Button tone="confirm" disabled={busy === a.id || !readyToSubmit(answers[a.id], fileUploads ? files[a.id] : null)}
            onClick={() => onSubmit(a.id, mine?.status === "resubmit_requested")} className="mt-2">
            {busy === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            {mine?.status === "resubmit_requested" ? "أعد التسليم" : "سلّم الواجب"}
          </Button>
        </div>
      )}
    </Card>
  );
}

/** نموذجُ اختبارٍ بالبنود — إجابةٌ لكلّ بند، تُرسل محاولةً واحدة */
function QuizAttemptForm({
  items,
  busy,
  onSubmit,
}: {
  items: { id: string; prompt: string; kind?: string; maxScore?: number }[];
  busy: boolean;
  onSubmit: (responses: { itemId: string; answer: string }[]) => void;
}) {
  const [resp, setResp] = useState<Record<string, string>>({});
  const answered = items.filter((i) => (resp[i.id] ?? "").trim()).length;
  return (
    <div className="mt-3 space-y-3">
      {items.map((it, idx) => (
        <div key={it.id}>
          <p className="mb-1 text-read leading-5 font-bold text-foreground">
            {idx + 1}. {it.prompt}
            {it.maxScore ? <span className="mr-2 text-fine font-normal text-muted-foreground">({it.maxScore} درجات)</span> : null}
          </p>
          <textarea
            rows={2}
            value={resp[it.id] ?? ""}
            onChange={(e) => setResp((prev) => ({ ...prev, [it.id]: e.target.value }))}
            placeholder="إجابتك…"
            className="w-full rounded-xl border border-white/15 bg-paper/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/75 focus:border-teal focus:outline-none"
          />
        </div>
      ))}
      <Button tone="primary" disabled={busy || answered < items.length}
        onClick={() => onSubmit(items.map((i) => ({ itemId: i.id, answer: (resp[i.id] ?? "").trim() })))}>
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
        سلّم الاختبار ({answered}/{items.length})
      </Button>
    </div>
  );
}

/** شارةُ «لا شهادة بعد» — تُستعمل في لوحاتٍ أخرى تعرض المرحلة مختصرة */
export function CertificateChip({ cert }: { cert: { number: string; status: string } }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/[0.08] px-2.5 py-0.5 text-fine font-black text-gold-ink">
      <Award className="h-3 w-3" />
      <span dir="ltr" className="font-mono">{cert.number}</span>
    </span>
  );
}
