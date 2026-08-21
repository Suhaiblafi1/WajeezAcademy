/* تمرين الاسترجاع بعد الوحدة (البند ح-٣).
   المبدأ من الدليل: الاسترجاع لا إعادة القراءة. فالسؤال يُطرح **قبل** كشف
   الجواب، والتصحيح فوري، والخطأ يُشرح — لا يُترك رقما.

   قواعد مقصودة:
   - لا درجة ولا وزن: هذا تمرين لا تقييم. ويُقال ذلك صراحة للمتعلم.
   - لا تُخزَّن المحاولة على الخادم؛ يُرسل حدث مجهول (رقم الوحدة والصواب) لا أكثر.
   - يمكن إعادة المحاولة بلا حدّ: الغرض التعلّم لا الفرز.
   - الصواب والخطأ يحملهما نص وأيقونة لا اللون وحده. */

import { useState } from "react";
import { Check, RotateCcw, Sparkles, X } from "lucide-react";
import { parseChecks } from "@/application/content/module-checks";
import { track } from "@/services/analytics";

export default function ModuleCheck({
  raw,
  moduleId,
  className = "",
}: {
  raw: string;
  moduleId: string;
  className?: string;
}) {
  const { checks } = parseChecks(raw);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [round, setRound] = useState(0);

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
        {checks.map((c, qi) => {
          const chosen = picked[qi];
          const shown = chosen !== undefined;
          return (
            <li key={`${round}-${qi}`}>
              <p className="text-sm font-bold leading-7">
                <span className="me-2 tabular-nums text-teal-light-ink">{qi + 1}.</span>
                {c.promptAr}
              </p>
              <div className="mt-2.5 space-y-1.5">
                {c.options.map((opt, oi) => {
                  const isCorrect = oi === c.correctIndex;
                  const isChosen = chosen === oi;
                  const tone = !shown
                    ? "border-white/10 bg-white/[0.03] hover:border-teal/50"
                    : isCorrect
                      ? "border-teal/60 bg-teal-ink/10"
                      : isChosen
                        ? "border-red-400/50 bg-red-500/10"
                        : "border-white/8 bg-white/[0.02] opacity-60";
                  return (
                    <button
                      key={oi}
                      type="button"
                      disabled={shown}
                      onClick={() => pick(qi, oi)}
                      aria-pressed={isChosen}
                      className={`flex min-h-11 w-full items-center gap-2.5 rounded-2xl border px-4 text-right text-xs leading-6 transition ${tone} ${shown ? "cursor-default" : "cursor-pointer"}`}
                    >
                      {shown && isCorrect && <Check className="h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" />}
                      {shown && isChosen && !isCorrect && <X className="h-4 w-4 shrink-0 text-red-300" aria-hidden="true" />}
                      <span className="min-w-0 flex-1">{opt}</span>
                      {shown && isCorrect && <span className="shrink-0 text-[10px] font-bold text-teal-light-ink">الصحيح</span>}
                      {shown && isChosen && !isCorrect && <span className="shrink-0 text-[10px] font-bold text-red-300">اخترته</span>}
                    </button>
                  );
                })}
              </div>
              {shown && (
                <p className="mt-2 rounded-xl border border-white/8 bg-black/20 px-3.5 py-2.5 text-[11px] leading-6 text-white/70">
                  {chosen === c.correctIndex ? "صحيح. " : "غير صحيح. "}
                  {c.explainAr ?? "الجواب الصحيح موضَّح أعلاه."}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {done && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-4">
          <p className="text-xs font-bold">
            استرجعت <span className="tabular-nums text-teal-light-ink">{correct}</span> من {checks.length}
            <span className="ms-2 font-medium text-white/55">
              {correct === checks.length ? "— راسخة. انتقل للوحدة التالية." : "— أعد المحاولة بعد يومين، فالتباعد يضاعف الأثر."}
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
      )}
    </section>
  );
}
