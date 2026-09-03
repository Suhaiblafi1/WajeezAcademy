/* تمرين الاسترجاع بعد الوحدة (البند ح-٣).
   المبدأ من الدليل: الاسترجاع لا إعادة القراءة. فالسؤال يُطرح **قبل** كشف
   الجواب، والتصحيح فوري، والخطأ يُشرح — لا يُترك رقما.

   قواعد مقصودة:
   - لا درجة ولا وزن: هذا تمرين لا تقييم. ويُقال ذلك صراحة للمتعلم.
   - لا تُخزَّن المحاولة على الخادم؛ يُرسل حدث مجهول (رقم الوحدة والصواب) لا أكثر.
   - يمكن إعادة المحاولة بلا حدّ: الغرض التعلّم لا الفرز.
   - الصواب والخطأ يحملهما نص وأيقونة لا اللون وحده.

   وبعد إتمام التمرين يُعرض طلب واحد صريح: جدولة عودة هذه الأسئلة متباعدة (ح-٤).
   الجدولة بطلب المتعلم لا بالخفاء — لا نكتب في حسابه من غير أن يطلب. وغير
   المسجَّل في الدورة لا يُعرض له الطلب أصلا لأن الخادم يرفضه بحق. */

import { useState } from "react";
import { CalendarClock, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { Link } from "react-router";
import CheckQuestion from "./CheckQuestion";
import { parseChecks } from "@/application/content/module-checks";
import { track } from "@/services/analytics";
import { apiPost } from "@/services/api";
import { spacingLabelAr } from "@/application/student/retrieval-schedule";

export default function ModuleCheck({
  raw,
  moduleId,
  className = "",
}: {
  raw: string;
  moduleId: string;
  className?: string;
}) {
  /* أسئلة الوحدة هي غير المربوطة بفصل — المربوطة تظهر كنقاط تفتيش تحت الفيديو (ح-٢) */
  const { checks: all } = parseChecks(raw);
  const checks = all.filter((c) => c.chapterIndex === null);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [round, setRound] = useState(0);
  /* idle → جاهز للطلب · busy → قيد الإرسال · done → جُدولت · unavailable → رفض الخادم */
  const [sched, setSched] = useState<"idle" | "busy" | "done" | "unavailable">("idle");

  if (checks.length === 0) return null;

  const answered = Object.keys(picked).length;
  const correct = checks.filter((c, i) => picked[i] === c.correctIndex).length;
  const done = answered === checks.length;

  const pick = (qi: number, oi: number) => {
    if (picked[qi] !== undefined) return; /* الاسترجاع مرة واحدة لكل سؤال في الجولة */
    setPicked((p) => ({ ...p, [qi]: oi }));
    track("module_check_answered", {
      module: moduleId,
      q: qi + 1,
      correct: oi === checks[qi].correctIndex,
    });
  };

  const schedule = async () => {
    setSched("busy");
    const ok = await apiPost<{ opened: number; existing: number }>(`/api/learner/retrieval/modules/${moduleId}`)
      .then(() => true)
      .catch(() => false);
    setSched(ok ? "done" : "unavailable");
  };

  return (
    <section
      aria-labelledby={`check-${moduleId}`}
      className={`rounded-3xl border border-teal/30 bg-teal-ink/[0.06] p-5 sm:p-6 ${className}`.trim()}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`check-${moduleId}`} className="flex items-center gap-2 text-sm font-black">
          <Sparkles className="h-4 w-4 text-teal-light-ink" aria-hidden="true" />
          تمرين استرجاع — {checks.length} {checks.length === 1 ? "سؤال" : "أسئلة"}
        </h3>
        <p className="text-[11px] text-white/55">بلا درجة ولا وزن — الاسترجاع نفسه هو الفائدة</p>
      </div>

      <ol className="mt-5 space-y-5">
        {checks.map((c, qi) => (
          <li key={`${round}-${qi}`}>
            <CheckQuestion check={c} index={qi + 1} chosen={picked[qi]} onPick={(oi) => pick(qi, oi)} />
          </li>
        ))}
      </ol>

      {done && (
        <div className="mt-5 border-t border-white/8 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-bold">
              استرجعت <span className="tabular-nums text-teal-light-ink">{correct}</span> من {checks.length}
              <span className="ms-2 font-medium text-white/55">
                {correct === checks.length ? "— راسخة اليوم. والتثبيت يحتاج تباعدا." : "— والخطأ اليوم أنفع من الصواب بلا استرجاع."}
              </span>
            </p>
            <button
              type="button"
              onClick={() => { setPicked({}); setRound((r) => r + 1); }}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/15 px-4 text-xs font-bold transition hover:border-teal/60 hover:text-teal-light-ink"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              أعد التمرين
            </button>
          </div>

          {/* الاسترجاع المتباعد (ح-٤) — طلب صريح، وموعد معلَن قبل الضغط */}
          {sched === "done" ? (
            <p className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-teal/30 bg-teal-ink/[0.07] px-4 py-3 text-[11px] leading-6 text-white/75">
              <CalendarClock className="h-3.5 w-3.5 shrink-0 text-teal-light-ink" aria-hidden="true" />
              جُدولت عودة هذه الأسئلة: بعد {spacingLabelAr(0)}، ثم يتباعد الموعد كلما استرجعتها.
              <Link to="/student/review" className="font-bold text-teal-light-ink underline underline-offset-4">
                صفحة «تثبيتُ ما تعلّمت»
              </Link>
            </p>
          ) : sched === "unavailable" ? null : (
            <button
              type="button"
              onClick={() => void schedule()}
              disabled={sched === "busy"}
              className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-teal/40 px-4 text-xs font-bold text-teal-light-ink transition hover:bg-teal/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sched === "busy"
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                : <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />}
              جدّل عودتها متباعدة — تبدأ بعد {spacingLabelAr(0)}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
