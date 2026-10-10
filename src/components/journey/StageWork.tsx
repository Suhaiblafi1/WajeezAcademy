/* عملُ المرحلة — صندوقان لا صندوقٌ واحد.

   بكلام صاحب المنصّة: «وينجز ما هو مطلوب من دروس وحلقات وواجبات وقراءات
   ومصادر… كلُّ ما يتعلق بالدورة في خانتها والمصادرُ في خانةٍ منفصلة».

   وكان كلُّ هذا في عمودٍ واحدٍ داخل بطاقةٍ مطويّة في «دوراتي»: جلساتٌ ثمّ
   موادٌّ ثمّ واجباتٌ ثمّ شهاداتٌ تنهال بلا فاصلٍ ولا أولويّة — فمن دخل ليسلّم
   واجبا مرّ على ستّ جلساتٍ وأربع موادّ قبل أن يجده.

   فصار الصندوقان:

   • **صندوقُ الدورة** — ما يُنجَز: دروسُها وجلساتُها وواجباتُها، بتبويبٍ
     واحدٍ يُختار منه. والتبويبُ يفتح على ما ينقصه: واجبٌ لم يُسلَّم أوّلا،
     وإلّا الدروس. فالشاشةُ تبدأ من عمله لا من فهرسها.

   • **صندوقُ المصادر** — ما يُرجَع إليه: موادُّ المدرّب وتسجيلاتُ الجلسات
     ومراجعُ الدورة العلميّة. مفصولٌ لأنّه لا «يُنجَز»: خلطُه بالعمل يجعل
     قائمةَ المهامّ تبدو أطولَ مما هي. */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Award, BookMarked, BookOpen, CalendarDays, CalendarPlus, CheckCircle2, Circle, ExternalLink,
  FileText, Library, Loader2, Lock, PenLine, Play, PlayCircle, Ruler, Send, Video,
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
import { fmtDate, fmtDateTime } from "@/application/text/format-ar";
import { referencesByIds } from "@/data/methodology";
import { overlayModules, readTypedLinks, resourceKind, type LearnerCohortWorkbook, type LearnerModuleWorkbook, type LearnerSlot, type LearnerWorkbook } from "@/application/trainer/plan-overlay";
import { groupLabelAr } from "@/application/trainer/cohort-workbooks";
import { dayLabelAr } from "@/application/trainer/axis-timeline";
import { whenAr } from "@/application/learning/cohort-gate";
import { RESOURCE_META } from "@/components/resource-kind-meta";
import type { CourseFull } from "@/data/courses";
import type { JourneyStage } from "@/application/student/journey";
import type { LearnerRequest } from "@/services/learner-requests";
import { Panel, Card } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import {
  canSubmitNow, latestSubmission, pendingAssessmentCount,
  type CohortAssessment, type EnrollmentDetail,
} from "@/services/enrollment-detail";

const SUBMISSION_STATUS: Record<string, { label: string; cls: string }> = {
  submitted: { label: "بانتظار المراجعة", cls: "border-white/20 text-muted-foreground" },
  under_review: { label: "قيد مراجعة المدرب", cls: "border-gold/50 text-gold-ink" },
  resubmit_requested: { label: "مطلوب إعادة التسليم", cls: "border-red-500/40 text-red-400" },
  accepted: { label: "مقبول", cls: "border-teal/50 text-teal-light-ink" },
  rejected: { label: "مرفوض", cls: "border-red-500/40 text-red-400" },
};
const ASSESSMENT_TYPE: Record<string, string> = { assignment: "واجب", quiz: "اختبار", project: "مشروع" };
const ATTENDANCE_LABEL: Record<string, string> = { present: "حاضر", late: "متأخر", absent: "غائب", excused: "معذور" };

type Tab = "lessons" | "sessions" | "work";

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
  const pending = pendingAssessmentCount(detail, new Date(now));
  /* التبويبُ الأوّل ما ينقصه: واجبٌ معلَّق قبل قراءةٍ لم تُطلب منه */
  const [tab, setTab] = useState<Tab>(pending > 0 ? "work" : "lessons");

  const doneModules = useMemo(
    () => new Set(detail.moduleProgress.filter((m) => m.status === "completed").map((m) => m.moduleId)),
    [detail.moduleProgress],
  );
  /* ═══ خطّةُ المدرّب تعلو الكتالوج ═══

     كان `full.modules` وحدَها — وحداتُ الكتالوج — فما يؤلّفه مدرّبُ الشعبة
     ويُعتمَد لا يصل متعلّميه. قرارُ صاحب المنصّة (١٣ سبتمبر ٢٠٢٦). */
  const modules = useMemo(
    () => overlayModules(full?.modules ?? [], detail.cohort.trainerPlan),
    [full?.modules, detail.cohort.trainerPlan],
  );
  /* «ابدأ من هنا» على أوّل ما لم يُنجَز **ممّا فُتح** — لا على محورٍ ينتظر موعدَه */
  const nextModuleIndex = modules.findIndex((m) => !doneModules.has(m.id) && !m.locked);
  const percent = detail.courseProgress?.percent ?? stage.percent ?? 0;
  const trainers = detail.cohort.trainers.map((t) => t.profile.application.fullName);
  /* ٢(ب-٢): وقتُه في الشعبة، ومواعيدُ محاورها إن كانت لها مواعيد */
  const access = detail.access?.state ?? "open";
  const slots = detail.cohort.trainerPlan?.slots ?? [];
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

  const TABS: { id: Tab; label: string; count: number; icon: typeof BookOpen }[] = [
    { id: "lessons", label: "الدروس", count: modules.length, icon: BookOpen },
    { id: "sessions", label: "الجلسات", count: detail.cohort.sessions.length, icon: CalendarDays },
    { id: "work", label: "الواجبات", count: detail.cohort.assessments.length, icon: Send },
  ];

  return (
    <div className="space-y-4">
      {/* ══ صندوقُ الدورة — ما يُنجَز ══ */}
      <Panel as="section" className="sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h3 className="text-base font-black leading-snug">{stage.titleAr}</h3>
            <p className="mt-0.5 text-read leading-5 text-muted-foreground">
              {detail.cohort.title}
              {trainers.length > 0 && ` · ${trainers.join("، ")}`}
              {stage.hours > 0 && ` · ${stage.hours} ساعة`}
            </p>
          </div>
          <div className="w-full max-w-[11rem]">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-teal transition-all" style={{ width: `${Math.max(2, percent)}%` }} />
            </div>
            <p className="mt-1 text-read text-muted-foreground">{percent}٪ من دروسها مكتملة</p>
          </div>
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
                ? `انتهت هذه الشعبة${detail.access?.closesAt ? ` ${whenAr(detail.access.closesAt)}` : ""}. تقرأ ما فُتح لك فيها${detail.access?.accessEndsAt ? ` حتّى ${whenAr(detail.access.accessEndsAt)}` : ""}، ولا تسليمَ جديدا بعد انتهائها — إلّا ما يطلب مدرّبُك إعادتَه.`
                : "انتهت مدّةُ الوصول إلى موادّ هذه الشعبة — ستّةُ أشهرٍ بعد انتهائها. تبقى هنا درجاتُك وتسليماتُك وشهادتُك."}
            </span>
          </Card>
        )}

        <div role="tablist" aria-label="عمل هذه المرحلة" className="-mx-1 mt-4 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {TABS.map((t) => {
            const on = tab === t.id;
            const nudge = t.id === "work" && pending > 0;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={on}
                onClick={() => setTab(t.id)}
                className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
                  on ? "border-teal bg-teal/15 text-teal-light-ink" : "border-white/10 bg-white/[0.03] text-muted-foreground hover:border-white/30"
                }`}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
                {t.count > 0 && <span className="tabular-nums text-muted-foreground">{t.count}</span>}
                {nudge && <span className="h-1.5 w-1.5 rounded-full bg-gold" aria-label="بانتظارك" />}
              </button>
            );
          })}
        </div>

        <div className="mt-4">
          {tab === "lessons" && cohortWorkbook && <CohortWorkbookCard wb={cohortWorkbook} modules={modules} />}
          {tab === "lessons" && slots.length === 0 && moduleWorkbooks.length > 0 && (
            <ModuleWorkbooksCard list={moduleWorkbooks} modules={modules} />
          )}
          {tab === "lessons" && (slots.length > 0 ? (
            <Timeline
              workbook={cohortWorkbook}
              moduleWorkbooks={moduleWorkbooks}
              slots={slots}
              modules={modules}
              doneModules={doneModules}
              nextIndex={nextModuleIndex}
              courseId={stage.courseId}
              enrollmentId={detail.id}
              project={full?.practicalProject ?? null}
              detail={detail}
              now={now}
              onOpenWork={() => setTab("work")}
            />
          ) : (
            <Lessons
              modules={modules}
              doneModules={doneModules}
              nextIndex={nextModuleIndex}
              courseId={stage.courseId}
              enrollmentId={detail.id}
              project={full?.practicalProject ?? null}
            />
          ))}
          {tab === "sessions" && <Sessions detail={detail} />}
          {tab === "work" && <Assessments detail={detail} handlers={handlers} now={now} />}
        </div>

        {/* آخرُ الدورة: قياسُ النمو ثمّ شهادتُها — بهذا الترتيب لا العكس */}
        {(detail.status === "completed" || percent >= 100 || detail.certificates.length > 0) && (
          <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
            <Card tone="accent" className="flex flex-wrap items-center justify-between gap-3 bg-teal-ink/[0.06] p-3.5">
              <p className="min-w-0 text-read leading-5 text-foreground">
                <span className="flex items-center gap-1.5 font-black text-foreground">
                  <Ruler className="h-3.5 w-3.5 text-teal-light-ink" /> قِس نموّك في مهارات هذه الدورة
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
      </Panel>

      {/* ══ صندوقُ المصادر — ما يُرجَع إليه ══ */}
      <Panel as="section" className="sm:p-5">
        <h3 className="flex items-center gap-2 text-sm font-black text-foreground">
          <Library className="h-4 w-4 text-gold-ink" /> مصادر هذه المرحلة
        </h3>
        {!hasResources ? (
          <p className="mt-2 text-read leading-6 text-muted-foreground">
            لم تُضَف موادُّ هذه الشعبة بعد. ما يختاره مدرّبك أو يرفعه يظهر هنا، ومعه تسجيلاتُ الجلسات فور جهوزها.
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            {/* ما اختاره مدرّبُك — من خطّته المعتمَدة، بنوعِ كلِّ مصدرٍ
                معلَنا: كتابٌ وكتابٌ صوتيٌّ وفيديو لا تُقرأ من الرابط. */}
            {planResources.length > 0 && (
              <div>
                <p className="text-read font-bold text-muted-foreground">اختارها مدرّبُك</p>
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
                <p className="text-read font-bold text-muted-foreground">موادُّ الشعبة</p>
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
                <p className="text-read font-bold text-muted-foreground">تسجيلاتُ الجلسات</p>
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
                <p className="text-read font-bold text-muted-foreground">مراجعُها العلميّة</p>
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

/** سطرُ محورٍ — يقرؤه العرضان: قائمةُ الدروس وخطُّ المواعيد */
function LessonRow({
  m,
  index,
  done,
  next,
  courseId,
  enrollmentId,
}: {
  m: LessonModule;
  index: number;
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
          {done ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-xs font-bold leading-snug ${done || next ? "" : "text-foreground"}`}>
            {m.title}
          </span>
          <span className="mt-0.5 block text-fine leading-4 text-muted-foreground">
            {/* محورٌ أضافه المدرّبُ ليس في الكتالوج، فلا ساعاتٍ له
                مقرَّرة — و«ساعة» بلا عددٍ أسوأُ من لا شيء. */}
            {m.hours ? `${m.hours} ساعة` : "من مدرّبك"}
            {m.hours && m.fromTrainer ? " · من مدرّبك" : ""}
            {!m.locked && lessons.length > 0 && ` · ${lessons.length} درسا`}
            {!m.locked && lessons.length === 0 && hasFile && " · محتواها ملفٌّ من مدرّبك"}
            {!m.locked && checks > 0 && ` · ${checks} تمرين استرجاع`}
            {!m.locked && m.scenario && " · سيناريو قرار"}
            {!m.locked && lessons.length === 0 && !hasFile && " · محتواها يُكتب الآن"}
          </span>
        </span>
        {/* وحدةٌ بلا متن لا تُوسَم «ابدأ من هنا» ولا «لم تبدأ»:
            الأولى دعوةٌ إلى فراغ، والثانية تُلقي التأخيرَ على
            المتعلّم. فتُقال حالُها كما هي. والمحجوبةُ حتّى موعدها
            يُقال متى تُفتح — لا «قيد التأليف» عن محورٍ مكتوبٍ ينتظر. */}
        {m.locked ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full border border-white/15 px-2.5 py-0.5 text-fine font-bold text-muted-foreground">
            <Lock className="h-2.5 w-2.5" aria-hidden="true" /> {m.opensAt ? `يُفتح ${whenAr(m.opensAt)}` : "طُويت موادُّه"}
          </span>
        ) : !readable ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full border border-gold/40 bg-gold/[0.07] px-2.5 py-0.5 text-fine font-bold text-gold-ink">
            <PenLine className="h-2.5 w-2.5" /> قيد التأليف
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

const EVIDENCE_NOTE = "الدرسُ يكتمل بدليل — تسليمٌ يقبله مدرّبك، أو تقييمٌ تجتازه، أو حضورُ جلسته. لا يُعلَّم مكتملا بضغطة.";

function Lessons({
  modules,
  doneModules,
  nextIndex,
  courseId,
  enrollmentId,
  project,
}: {
  modules: LessonModule[];
  doneModules: Set<string>;
  nextIndex: number;
  courseId: string;
  enrollmentId: string;
  project: string | null;
}) {
  if (modules.length === 0) {
    return (
      <Card as="p" className="border-dashed px-4 py-6 text-center text-read leading-6 text-muted-foreground">
        لم يُكتب متنُ هذه الدورة بعد. جلساتُها وواجباتُها في تبويبَيهما، ويظهر المتن هنا فور كتابته.
      </Card>
    );
  }
  return (
    <>
      <ol className="space-y-2">
        {modules.map((m, i) => (
          <LessonRow
            key={m.id}
            m={m}
            index={i}
            done={doneModules.has(m.id)}
            next={i === nextIndex}
            courseId={courseId}
            enrollmentId={enrollmentId}
          />
        ))}
      </ol>
      <p className="mt-3 text-read leading-5 text-muted-foreground">{EVIDENCE_NOTE}</p>
      <ProjectCard project={project} />
    </>
  );
}

/* ─────────── خطُّ المواعيد ───────────

   قرارُ صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦): «إذا حدّد المحورَ الأوّل للأسبوع الأوّل
   فتظهر الكرّاسةُ لهذا المحور… وبعد اللقاء تظهر واجباتُ المحور ومصادرُه… وهكذا
   للمحور الثاني والثالث والرابع». فالشعبةُ التي لخطّتها مواعيدُ تُقرأ مواعيدَ:
   لكلّ موعدٍ تاريخاه وكرّاستُه ومحاورُه ومهامُّها، وما لم يُفتح يُقال متى يُفتح.
   والحجبُ نفسُه في الخادم (`projectPlanForLearner` و`gateAssessment`) — وهنا
   عرضُه وحدَه. */

/** رابطُ الكرّاسة — الملفُّ من المسار المحروس، والرابطُ خارجيّ */
function WorkbookLink({ wb, labelAr = "كرّاسةُ الموعد" }: { wb: LearnerWorkbook; labelAr?: string }) {
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
   تحمل الكرّاسةَ مرّةً واحدة، وتحتها خريطتُها بترتيب المحاور: أين يبدأ كلٌّ
   منها. وفي كلّ موعدٍ سطرٌ يقول أين محاورُه فيها — فيفتحها على موضعه. */
function CohortWorkbookCard({ wb, modules }: { wb: LearnerCohortWorkbook; modules: LessonModule[] }) {
  const no = new Map(modules.map((m, i) => [m.id, i + 1]));
  const title = new Map(modules.map((m) => [m.id, m.title]));
  return (
    <Card tone="accent" className="mb-3 p-3">
      <p className="flex items-center gap-1.5 text-read font-black text-foreground">
        <BookMarked className="h-4 w-4 text-teal-light-ink" aria-hidden="true" /> كرّاسةُ الدورة
      </p>
      <p className="mt-0.5 text-read leading-6 text-muted-foreground">
        كرّاسةٌ واحدةٌ فيها المحاورُ كلُّها بترتيبها — اتبعها محورا محورا مع مواعيدك.
      </p>
      {wb.file ? (
        <WorkbookLink wb={wb.file} labelAr="افتح كرّاسةَ الدورة" />
      ) : wb.locked && wb.opensAt ? (
        <p className="mt-2 flex items-center gap-1.5 text-read text-muted-foreground">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" /> تُفتح {whenAr(wb.opensAt)} — أوّلَ يومٍ في الشعبة
        </p>
      ) : null}
      {wb.parts.length > 0 && (
        <ol className="mt-2 grid gap-1 text-read leading-6">
          {wb.parts.map((p) => (
            <li key={p.moduleId} className="flex flex-wrap gap-x-1.5">
              <span className="font-bold text-teal-light-ink tabular-nums">المحور {no.get(p.moduleId) ?? "؟"}</span>
              <span className="text-muted-foreground">· {title.get(p.moduleId) ?? ""}</span>
              <span className="font-bold text-foreground">— {p.whereAr}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/* ─────────── كرّاساتُ المحاور (٦ أكتوبر ٢٠٢٦) ───────────

   لكلّ محورٍ كرّاستُه — أو لمحاورَ متجاورةٍ كرّاسةٌ واحدة — تُفتح أوّلَ يومٍ في
   موعد أسبق محاورها. في كلّ موعدٍ تُذكر كرّاساتُ محاوره: رابطٌ إن فُتحت، ومتى
   تُفتح إن لم تُفتح. وبلا مواعيدَ تُجمع في بطاقةٍ واحدةٍ أعلى الدروس. */
function ModuleWorkbookLine({ w, ids }: { w: LearnerModuleWorkbook; ids: string[] }) {
  const label = `كرّاسةُ ${groupLabelAr(w, ids)}`;
  if (w.file) return <WorkbookLink wb={w.file} labelAr={label} />;
  if (w.locked && w.opensAt) {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-read text-muted-foreground">
        <Lock className="h-3.5 w-3.5" aria-hidden="true" /> {label} تُفتح {whenAr(w.opensAt)}
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
        <BookMarked className="h-4 w-4 text-teal-light-ink" aria-hidden="true" /> كرّاساتُ المحاور
      </p>
      <p className="mt-0.5 text-read leading-6 text-muted-foreground">لكلّ محورٍ كرّاستُه — تُفتح أوّلَ يومٍ في موعده.</p>
      {list.map((w) => <ModuleWorkbookLine key={w.moduleIds.join("+")} w={w} ids={ids} />)}
    </Card>
  );
}

function Timeline({
  workbook,
  moduleWorkbooks,
  slots,
  modules,
  doneModules,
  nextIndex,
  courseId,
  enrollmentId,
  project,
  detail,
  now,
  onOpenWork,
}: {
  workbook: LearnerCohortWorkbook | null;
  moduleWorkbooks: LearnerModuleWorkbook[];
  slots: LearnerSlot[];
  modules: LessonModule[];
  doneModules: Set<string>;
  nextIndex: number;
  courseId: string;
  enrollmentId: string;
  project: string | null;
  detail: EnrollmentDetail;
  now: number;
  onOpenWork: () => void;
}) {
  const at = new Map(modules.map((m, i) => [m.id, i]));
  const inSlots = new Set(slots.flatMap((s) => s.moduleIds));
  const loose = modules.filter((m) => !inSlots.has(m.id));
  const row = (id: string) => {
    const i = at.get(id);
    if (i === undefined) return null;
    const m = modules[i];
    return (
      <LessonRow key={m.id} m={m} index={i} done={doneModules.has(m.id)} next={i === nextIndex} courseId={courseId} enrollmentId={enrollmentId} />
    );
  };
  return (
    <>
      <ol className="space-y-3">
        {slots.map((s, si) => {
          const past = now > Date.parse(s.closesAt);
          const tasks = detail.cohort.assessments.filter((a) => a.moduleId && s.moduleIds.includes(a.moduleId));
          return (
            <Card as="li" key={`${s.startsOn}-${si}`} tone={s.locked || past ? "default" : "accent"} className="p-3">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <p className="text-read font-black text-foreground">
                  الموعد {si + 1}
                  <span className="font-bold text-muted-foreground"> · {dayLabelAr(s.startsOn)} – {dayLabelAr(s.endsOn)}</span>
                </p>
                <span className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-fine font-bold ${s.locked ? "border-white/15 text-muted-foreground" : past ? "border-white/15 text-muted-foreground" : "border-teal/50 text-teal-light-ink"}`}>
                  {s.locked && <Lock className="h-2.5 w-2.5" aria-hidden="true" />}
                  {s.locked ? `يُفتح ${whenAr(s.opensAt)}` : past ? "مضى" : "جارٍ الآن"}
                </span>
              </div>
              {s.workbook ? (
                <WorkbookLink wb={s.workbook} />
              ) : s.hasWorkbook && s.locked ? (
                <p className="mt-2 flex items-center gap-1.5 text-read text-muted-foreground">
                  <BookMarked className="h-3.5 w-3.5" aria-hidden="true" /> كرّاستُه تُفتح أوّلَ يومٍ في موعده
                </p>
              ) : null}
              {/* كرّاساتُ محاوره — والممتدّةُ على موعدين تُذكر في كليهما */}
              {moduleWorkbooks
                .filter((w) => w.moduleIds.some((id) => s.moduleIds.includes(id)))
                .map((w) => <ModuleWorkbookLine key={w.moduleIds.join("+")} w={w} ids={modules.map((m) => m.id)} />)}
              <ul className="mt-2 space-y-2">{s.moduleIds.map(row)}</ul>
              {/* أين محاورُ هذا الموعد في كرّاسة الدورة — ويفتحها من هنا متى فُتحت */}
              {workbook && s.moduleIds.some((id) => workbook.parts.some((p) => p.moduleId === id)) && (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="flex items-center gap-1.5 text-read text-muted-foreground">
                    <BookMarked className="h-3.5 w-3.5" aria-hidden="true" />
                    في الكرّاسة:{" "}
                    {s.moduleIds
                      .map((id) => {
                        const where = workbook.parts.find((p) => p.moduleId === id)?.whereAr;
                        const n = (at.get(id) ?? -1) + 1;
                        return where ? `المحور ${n} ${where}` : null;
                      })
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {!s.locked && workbook.file && <WorkbookLink wb={workbook.file} labelAr="افتح الكرّاسة" />}
                </div>
              )}
              {tasks.length > 0 && (
                <div className="mt-2 border-t border-white/[0.06] pt-2">
                  <ul className="space-y-1">
                    {tasks.map((a) => {
                      const mine = latestSubmission(detail, a.id);
                      return (
                        <li key={a.id} className="flex flex-wrap items-center gap-x-2 text-read leading-6 text-muted-foreground">
                          <Send className="h-3 w-3 shrink-0" aria-hidden="true" />
                          <span className="font-bold text-foreground">{a.title}</span>
                          <span>
                            {a.locked
                              ? a.opensAt ? `· تُفتح ${whenAr(a.opensAt)} بعد لقاء محورها` : "· طُويت"
                              : mine ? `· ${SUBMISSION_STATUS[mine.status]?.label ?? "سلّمتَها"}`
                              : a.dueAt ? `· آخرُ موعدها ${fmtDate(a.dueAt)}` : "· مفتوحة"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <button type="button" onClick={onOpenWork} className="mt-1.5 cursor-pointer text-read font-bold text-teal-light-ink hover:underline">
                    إلى الواجبات
                  </button>
                </div>
              )}
            </Card>
          );
        })}
      </ol>
      {loose.length > 0 && (
        <div className="mt-4">
          <p className="text-read font-bold text-muted-foreground">محاورُ أخرى</p>
          <ul className="mt-2 space-y-2">{loose.map((m) => row(m.id))}</ul>
        </div>
      )}
      <p className="mt-3 text-read leading-5 text-muted-foreground">{EVIDENCE_NOTE}</p>
      <ProjectCard project={project} />
    </>
  );
}

/* ─────────── الجلسات ─────────── */

function Sessions({ detail }: { detail: EnrollmentDetail }) {
  /* قبل الخروج المبكّر: خطّافٌ بعد `return` يكسر ترتيبَ الخطّافات */
  const [openHere, setOpenHere] = useState<string | null>(null);
  if (detail.cohort.sessions.length === 0) {
    return <p className="text-read leading-6 text-muted-foreground">لم تُجدول جلسات هذه الشعبة بعد — تظهر هنا بمواعيدها فور جدولتها.</p>;
  }
  return (
    <div className="space-y-2">
      {detail.cohort.sessions.map((s) => {
        const mine = detail.attendance.find((a) => a.sessionId === s.id);
        /* ٢(ب-١): اللقاءُ الذي انتهى يُكتب «انعقد» — ورابطُه لا يصل أصلا
           (الخادمُ يُسقطه). فلا «أضِفها لتقويمك» على ما مضى. */
        const held = s.status === "done";
        return (
          <Card key={s.id} className="bg-paper/20 p-3.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <div className="min-w-0 flex-1">
                <p className="text-read font-bold leading-snug">{s.title}</p>
                <p className="mt-0.5 text-read text-muted-foreground">{fmtDateTime(new Date(s.startsAt))}</p>
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
                  <CalendarPlus className="h-3 w-3" /> أضِفها لتقويمك
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
                  onClick={() => setOpenHere((cur) => (cur === s.id ? null : s.id))}
                  aria-expanded={openHere === s.id}
                  className="min-h-9 shrink-0"
                >
                  {openHere === s.id ? "أغلِق هنا" : "افتح هنا"}
                </Button>
              )}
            </div>
            {s.zoom?.passcode && (
              <p className="mt-2 text-read text-muted-foreground">
                رمز المرور: <span className="font-mono text-foreground" dir="ltr">{s.zoom.passcode}</span>
              </p>
            )}
            {openHere === s.id && (
              <SessionEmbed
                sessionId={s.id}
                userName={readUserName() ?? "متعلم وجيز"}
                onClose={() => setOpenHere(null)}
              />
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* ─────────── الواجبات ─────────── */

function Assessments({ detail, handlers, now }: { detail: EnrollmentDetail; handlers: StageWorkHandlers; now: number }) {
  const { answers, setAnswers, busy, onSubmit, onSubmitQuiz, files = {}, setFiles, progress = {}, onRetryFile } = handlers;
  const { fileUploads } = usePlatformConfig();
  if (detail.cohort.assessments.length === 0) {
    return <p className="text-read leading-6 text-muted-foreground">لا واجبات على هذه الشعبة بعد — ما يُسنده مدرّبك يظهر هنا بموعد استحقاقه.</p>;
  }
  return (
    <div className="space-y-3">
      {detail.cohort.assessments.map((a: CohortAssessment) => {
        const mine = latestSubmission(detail, a.id);
        const meta = mine ? SUBMISSION_STATUS[mine.status] : null;
        /* ٢(ب-٢): يحكم بها `submitVerdict` نفسُها التي يحكم بها الخادم —
           مهمّةٌ لم تُفتح، أو شعبةٌ انتهت، لا نموذجَ لها */
        const canSubmit = canSubmitNow(detail, a, new Date(now));
        const closed = !a.locked && !canSubmit && (!mine || mine.status === "resubmit_requested");
        const overdue = canSubmit && !mine && a.dueAt !== null && Date.parse(a.dueAt) < now;
        if (a.locked) {
          return (
            <Card key={a.id} className="border-dashed bg-paper/10 p-3.5">
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
                  {a.opensAt ? `تُفتح ${whenAr(a.opensAt)}` : "طُويت"}
                </span>
              </div>
              {a.opensAt && (
                <p className="mt-2 text-read leading-6 text-muted-foreground">تُفتح بعد انتهاء أوّل لقاءٍ لمحورها — وتعليماتُها معها.</p>
              )}
            </Card>
          );
        }
        return (
          <Card key={a.id} className="bg-paper/20 p-3.5">
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
                <span className="shrink-0 rounded-full border border-gold/40 px-2.5 py-0.5 text-fine font-bold text-gold-ink">سُلّم متأخّرا</span>
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
            {a.briefAr && <p className="mt-3 whitespace-pre-line text-read leading-6 text-foreground">{a.briefAr}</p>}
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
              <p className="mt-3 text-read leading-6 text-muted-foreground">انتهت الشعبة — والتسليمُ يتوقّف بانتهائها.</p>
            )}
            {overdue && (
              <p className="mt-3 text-read leading-6 text-gold-ink">فات موعدُها — وما زال التسليمُ يُقبل، ويُعلَّم متأخّرا.</p>
            )}
            {canSubmit && a.type === "quiz" && a.items.length > 0 && (
              <QuizAttemptForm items={a.items} busy={busy === a.id} onSubmit={(r) => onSubmitQuiz(a.id, r)} />
            )}
            {canSubmit && a.type !== "quiz" && (
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
      })}
    </div>
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
