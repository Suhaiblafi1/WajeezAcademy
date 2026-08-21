/* تمرين الاسترجاع بعد الوحدة (البند ح-٣).
   المبدأ من الدليل: الاسترجاع لا إعادة القراءة. فالسؤال يُطرح **قبل** كشف
   الجواب، والتصحيح فوري، والخطأ يُشرح — لا يُترك رقما.

   قواعد مقصودة:
   - لا درجة ولا وزن: هذا تمرين لا تقييم. ويُقال ذلك صراحة للمتعلم.
   - لا تُخزَّن المحاولة على الخادم؛ يُرسل حدث مجهول (رقم الوحدة والصواب) لا أكثر.
   - يمكن إعادة المحاولة بلا حدّ: الغرض التعلّم لا الفرز.
   - الصواب والخطأ يحملهما نص وأيقونة لا اللون وحده. */

import { useState } from "react";
import { RotateCcw, Sparkles } from "lucide-react";
import CheckQuestion from "./CheckQuestion";
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
  /* أسئلة الوحدة هي غير المربوطة بفصل — المربوطة تظهر كنقاط تفتيش تحت الفيديو (ح-٢) */
  const { checks: all } = parseChecks(raw);
  const checks = all.filter((c) => c.chapterIndex === null);
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
        {checks.map((c, qi) => (
          <li key={`${round}-${qi}`}>
            <CheckQuestion check={c} index={qi + 1} chosen={picked[qi]} onPick={(oi) => pick(qi, oi)} />
          </li>
        ))}
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
