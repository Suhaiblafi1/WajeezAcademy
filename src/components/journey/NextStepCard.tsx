/* «خطوتك التالية» — فعلٌ واحدٌ بزرٍّ واحد، والحكمُ في `nextStep` (`stage-path.ts`).

   تسكن ملفّا وحدَها منذ صارت الرئيسيّةُ تفتح عليها أيضا (٢٧ أكتوبر ٢٠٢٦، «C both»).
   وفي صفحة الدورة يفتح زرُّها المحطّةَ وينزل إلى المهمّة (`onReveal`)؛ وفي الرئيسيّة
   لا محطّاتِ تحته، فيقود إلى صفحة الدورة على مرحلتها — وهناك تقول البطاقةُ الخطوةَ نفسَها.

   والزرُّ فيروزيّ لا ذهبيّ: الذهبيُّ في صفحة الدورة لنموذج الاختبار
   (`one-primary-per-screen.test.ts`). */

import { Link } from "react-router";
import { ArrowLeft, Award, BookOpen, CalendarDays, CalendarPlus, Clock3, Hourglass, Play, Send, Video } from "lucide-react";
import { Card } from "@/components/ui/Surface";
import { fmtDate, fmtSession } from "@/application/text/format-ar";
import { whenAr } from "@/application/learning/cohort-gate";
import type { NextStep } from "@/application/student/stage-path";
import type { CohortSession } from "@/services/enrollment-detail";

/* عنوانٌ فيه «» لا يُلفّ بها ثانية — «بطاقة «فكرة»» قراءةٌ متعثّرة */
const quoted = (s: string) => (s.includes("«") ? s : `«${s}»`);

const STEP_BTN =
  "flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-teal px-4 py-2 text-xs font-black text-on-teal transition hover:bg-teal-light";

export default function NextStepCard({
  step,
  sessions,
  courseId,
  enrollmentId,
  onReveal,
  courseTitleAr,
  className = "mt-4",
}: {
  step: NextStep | null;
  sessions: readonly Pick<CohortSession, "id" | "startsAt" | "zoom">[];
  courseId: string;
  enrollmentId: string;
  /** في صفحة الدورة: يفتح المحطّة وينزل إلى المهمّة. وبدونه يقود الزرُّ إلى صفحة الدورة */
  onReveal?: (stopKey: string | null, targetId: string) => void;
  /** في الرئيسيّة: أيُّ دورةٍ هذه — وفي صفحة الدورة معروفٌ فلا يُكرَّر */
  courseTitleAr?: string;
  className?: string;
}) {
  if (!step) return null;
  let icon = Play;
  let title = "";
  let meta: string | null = null;
  let action: React.ReactNode = null;
  const reveal = (stopKey: string | null, target: string, label: string) =>
    onReveal ? (
      <button type="button" onClick={() => onReveal(stopKey, target)} className={`${STEP_BTN} cursor-pointer`}>
        {label} <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    ) : (
      <Link to={`/student/learning?stage=${encodeURIComponent(courseId)}`} className={STEP_BTN}>
        {label} <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
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
    <Card as="section" tone="accent" aria-label="خطوتك التالية" className={`${className} flex flex-wrap items-center gap-x-4 gap-y-3`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal text-on-teal">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 basis-[12rem]">
        <span className="block text-fine font-bold text-teal-light-ink">خطوتك التالية</span>
        <p className="mt-0.5 text-sm font-black leading-snug text-foreground">{title}</p>
        {(meta || courseTitleAr) && (
          <p className="mt-0.5 text-read text-muted-foreground">
            {[meta, courseTitleAr].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
      {action}
    </Card>
  );
}

