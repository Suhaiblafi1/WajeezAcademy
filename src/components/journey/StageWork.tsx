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

import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Award, BookOpen, CalendarDays, CalendarPlus, CheckCircle2, Circle, ExternalLink,
  FileText, Library, Loader2, Play, PlayCircle, Ruler, Send, Video,
} from "lucide-react";
import SubmissionFeedback from "@/components/SubmissionFeedback";
import SwitchCohort from "@/components/SwitchCohort";
import CourseCertificate from "@/components/journey/CourseCertificate";
import { splitLessons } from "@/application/content/lesson-split";
import { parseChecks } from "@/application/content/module-checks";
import { fmtDate, fmtDateTime } from "@/application/text/format-ar";
import { referencesByIds } from "@/data/methodology";
import type { CourseFull } from "@/data/courses";
import type { JourneyStage } from "@/application/student/journey";
import type { LearnerRequest } from "@/services/learner-requests";
import { Panel, Card } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import {
  latestSubmission, pendingAssessmentCount,
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
  const pending = pendingAssessmentCount(detail);
  /* التبويبُ الأوّل ما ينقصه: واجبٌ معلَّق قبل قراءةٍ لم تُطلب منه */
  const [tab, setTab] = useState<Tab>(pending > 0 ? "work" : "lessons");

  const doneModules = useMemo(
    () => new Set(detail.moduleProgress.filter((m) => m.status === "completed").map((m) => m.moduleId)),
    [detail.moduleProgress],
  );
  const modules = full?.modules ?? [];
  const nextModuleIndex = modules.findIndex((m) => !doneModules.has(m.id));
  const percent = detail.courseProgress?.percent ?? stage.percent ?? 0;
  const trainers = detail.cohort.trainers.map((t) => t.profile.application.fullName);
  const recordings = detail.cohort.sessions.flatMap((s) => s.recordings);
  const references = useMemo(() => referencesByIds(full?.referenceIds ?? []), [full?.referenceIds]);
  const hasResources = detail.cohort.materials.length > 0 || recordings.length > 0 || references.length > 0;

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
            <p className="mt-0.5 text-micro leading-5 text-muted-foreground">
              {detail.cohort.title}
              {trainers.length > 0 && ` · ${trainers.join("، ")}`}
              {stage.hours > 0 && ` · ${stage.hours} ساعة`}
            </p>
          </div>
          <div className="w-full max-w-[11rem]">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-teal transition-all" style={{ width: `${Math.max(2, percent)}%` }} />
            </div>
            <p className="mt-1 text-micro text-muted-foreground">{percent}٪ من دروسها مكتملة</p>
          </div>
        </div>

        {/* تبديلُ الموعد قبل أن تبدأ الشعبة — قيودُه في الخادم، وهذه الشاشةُ
            لا تعرض إلّا ما يقبله. */}
        <SwitchCohort
          enrollmentId={detail.id}
          courseId={detail.cohort.course.id}
          cohortId={detail.cohort.id}
          startsAt={detail.cohort.startsAt}
          onSwitched={handlers.onChanged}
        />

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
          {tab === "lessons" && (
            <Lessons
              modules={modules}
              doneModules={doneModules}
              nextIndex={nextModuleIndex}
              courseId={stage.courseId}
              project={full?.practicalProject ?? null}
            />
          )}
          {tab === "sessions" && <Sessions detail={detail} />}
          {tab === "work" && <Assessments detail={detail} handlers={handlers} />}
        </div>

        {/* آخرُ الدورة: قياسُ النمو ثمّ شهادتُها — بهذا الترتيب لا العكس */}
        {(detail.status === "completed" || percent >= 100 || detail.certificates.length > 0) && (
          <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
            <Card tone="accent" className="flex flex-wrap items-center justify-between gap-3 bg-teal-ink/[0.06] p-3.5">
              <p className="min-w-0 text-xs leading-5 text-foreground">
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
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            لم تُرفَع موادُّ هذه الشعبة بعد. ما يرفعه مدرّبك يظهر هنا، ومعه تسجيلاتُ الجلسات فور جهوزها.
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            {detail.cohort.materials.length > 0 && (
              <div>
                <p className="text-micro font-bold text-muted-foreground">موادُّ الشعبة</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {detail.cohort.materials.map((m) => (
                    <a
                      key={m.id}
                      href={m.readUrl ?? m.externalUrl ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-h-9 items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-micro font-bold text-foreground transition hover:border-teal/50 hover:text-teal-light-ink"
                    >
                      <FileText className="h-3 w-3" /> {m.title}
                    </a>
                  ))}
                </div>
              </div>
            )}
            {recordings.length > 0 && (
              <div>
                <p className="text-micro font-bold text-muted-foreground">تسجيلاتُ الجلسات</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {recordings.map((rec) => (
                    <a
                      key={rec.id}
                      href={rec.readUrl ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-h-9 items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-micro font-bold text-foreground transition hover:border-teal/50 hover:text-teal-light-ink"
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
                <p className="text-micro font-bold text-muted-foreground">مراجعُها العلميّة</p>
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

function Lessons({
  modules,
  doneModules,
  nextIndex,
  courseId,
  project,
}: {
  modules: CourseFull["modules"];
  doneModules: Set<string>;
  nextIndex: number;
  courseId: string;
  project: string | null;
}) {
  if (modules.length === 0) {
    return (
      <Card as="p" className="border-dashed px-4 py-6 text-center text-xs leading-6 text-muted-foreground">
        لم يُكتب متنُ هذه الدورة بعد. جلساتُها وواجباتُها في تبويبَيهما، ويظهر المتن هنا فور كتابته.
      </Card>
    );
  }
  return (
    <>
      <ol className="space-y-2">
        {modules.map((m, i) => {
          const done = doneModules.has(m.id);
          const next = i === nextIndex;
          const lessons = splitLessons(m.body);
          const checks = parseChecks(m.checks).checks.filter((c) => c.chapterIndex === null).length;
          return (
            <li
              key={m.id}
              className={`rounded-2xl border p-3 transition ${
                done ? "border-teal/40 bg-teal/[0.04]" : next ? "border-teal/50 bg-white/[0.04]" : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-xl text-micro font-black ${
                    done ? "bg-teal text-on-teal" : next ? "bg-teal/20 text-teal-light-ink" : "bg-white/5 text-muted-foreground"
                  }`}
                >
                  {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-xs font-bold leading-snug ${done || next ? "" : "text-foreground"}`}>
                    {m.title}
                  </span>
                  <span className="mt-0.5 block text-micro leading-4 text-muted-foreground">
                    {m.hours} ساعة
                    {lessons.length > 0 && ` · ${lessons.length} درسا`}
                    {checks > 0 && ` · ${checks} تمرين استرجاع`}
                    {m.scenario && " · سيناريو قرار"}
                  </span>
                </span>
                {done ? (
                  <span className="shrink-0 rounded-full border border-teal/50 px-2.5 py-0.5 text-micro font-bold text-teal-ink">
                    أنجزتها
                  </span>
                ) : next ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-teal px-2.5 py-0.5 text-micro font-black text-on-teal">
                    <Play className="h-2.5 w-2.5" /> ابدأ من هنا
                  </span>
                ) : (
                  <span className="flex shrink-0 items-center gap-1 text-micro text-muted-foreground">
                    <Circle className="h-2.5 w-2.5" /> لم تبدأ
                  </span>
                )}
                {lessons.length > 0 && (
                  <Link
                    to={`/student/course/${courseId}/module/${m.id}`}
                    className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-micro font-bold text-foreground transition hover:border-teal/50 hover:text-teal-light-ink"
                  >
                    {done ? "راجعها" : "افتحها"}
                  </Link>
                )}
              </div>
              {/* ناتجُ الدرس — سطرٌ واحد: هو ما يُقاس عليه الإنجاز */}
              {m.artifact && (
                <p className="mt-2 flex items-start gap-1.5 border-t border-white/[0.06] pt-2 text-micro leading-5 text-muted-foreground">
                  <FileText className="mt-0.5 h-3 w-3 shrink-0 text-gold-ink" />
                  <span><span className="font-bold text-foreground">ما تخرج به: </span>{m.artifact}</span>
                </p>
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-micro leading-5 text-muted-foreground">
        الدرسُ يكتمل بدليل — تسليمٌ يقبله مدرّبك، أو تقييمٌ تجتازه، أو حضورُ جلسته. لا يُعلَّم مكتملا بضغطة.
      </p>
      {project && (
        <Card tone="warn" className="mt-4">
          <p className="flex items-center gap-1.5 text-xs font-black text-gold-ink">
            <FileText className="h-3.5 w-3.5" /> مشروع هذه الدورة
          </p>
          <p className="mt-1.5 text-xs leading-6 text-foreground">{project}</p>
        </Card>
      )}
    </>
  );
}

/* ─────────── الجلسات ─────────── */

function Sessions({ detail }: { detail: EnrollmentDetail }) {
  if (detail.cohort.sessions.length === 0) {
    return <p className="text-xs leading-6 text-muted-foreground">لم تُجدول جلسات هذه الشعبة بعد — تظهر هنا بمواعيدها فور جدولتها.</p>;
  }
  return (
    <div className="space-y-2">
      {detail.cohort.sessions.map((s) => {
        const mine = detail.attendance.find((a) => a.sessionId === s.id);
        return (
          <Card key={s.id} className="bg-paper/20 p-3.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold leading-snug">{s.title}</p>
                <p className="mt-0.5 text-micro text-muted-foreground">{fmtDateTime(new Date(s.startsAt))}</p>
              </div>
              {mine && (
                <span className="shrink-0 rounded-full border border-white/15 px-2.5 py-0.5 text-micro font-bold text-muted-foreground">
                  {ATTENDANCE_LABEL[mine.status] ?? mine.status}
                </span>
              )}
              <a
                href={`/api/calendar/cohort-sessions/${s.id}.ics`}
                className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-micro font-bold text-muted-foreground transition hover:border-white/35 hover:text-foreground"
              >
                <CalendarPlus className="h-3 w-3" /> أضِفها لتقويمك
              </a>
              {s.zoom && (
                <a
                  href={s.zoom.learnerUrl ?? s.zoom.joinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-teal px-4 py-1.5 text-micro font-black text-on-teal transition hover:bg-teal-light"
                >
                  <Video className="h-3 w-3" /> ادخل الجلسة
                </a>
              )}
            </div>
            {s.zoom?.passcode && (
              <p className="mt-2 text-micro text-muted-foreground">
                رمز المرور: <span className="font-mono text-foreground" dir="ltr">{s.zoom.passcode}</span>
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* ─────────── الواجبات ─────────── */

function Assessments({ detail, handlers }: { detail: EnrollmentDetail; handlers: StageWorkHandlers }) {
  const { answers, setAnswers, busy, onSubmit, onSubmitQuiz } = handlers;
  if (detail.cohort.assessments.length === 0) {
    return <p className="text-xs leading-6 text-muted-foreground">لا واجبات على هذه الشعبة بعد — ما يُسنده مدرّبك يظهر هنا بموعد استحقاقه.</p>;
  }
  return (
    <div className="space-y-3">
      {detail.cohort.assessments.map((a: CohortAssessment) => {
        const mine = latestSubmission(detail, a.id);
        const meta = mine ? SUBMISSION_STATUS[mine.status] : null;
        const canSubmit = !mine || mine.status === "resubmit_requested";
        return (
          <Card key={a.id} className="bg-paper/20 p-3.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold leading-snug">{a.title}</p>
                <p className="mt-0.5 text-micro text-muted-foreground">
                  {ASSESSMENT_TYPE[a.type] ?? a.type} · من {a.maxScore}
                  {a.dueAt && ` · يستحق ${fmtDate(a.dueAt)}`}
                </p>
              </div>
              {meta && <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-micro font-bold ${meta.cls}`}>{meta.label}</span>}
              {mine?.grades[0] && (
                <span className="shrink-0 rounded-full bg-teal/15 px-2.5 py-0.5 text-micro font-black text-teal-light-ink">
                  {Number(mine.grades[0].score)}/{Number(mine.grades[0].maxScore)}
                </span>
              )}
            </div>
            {mine && <SubmissionFeedback submission={mine} criteria={a.rubric?.criteria} className="mt-3" />}
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
                <Button tone="confirm" disabled={busy === a.id || !(answers[a.id] ?? "").trim()}
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
          <p className="mb-1 text-xs font-bold text-foreground">
            {idx + 1}. {it.prompt}
            {it.maxScore ? <span className="mr-2 text-micro font-normal text-muted-foreground">({it.maxScore} درجات)</span> : null}
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
    <span className="flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/[0.08] px-2.5 py-0.5 text-micro font-black text-gold-ink">
      <Award className="h-3 w-3" />
      <span dir="ltr" className="font-mono">{cert.number}</span>
    </span>
  );
}
