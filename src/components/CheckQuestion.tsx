/* سؤال استرجاع واحد — مشترك بين تمرين الوحدة (ح-٣) ونقاط تفتيش الفيديو (ح-٢).
   الاسترجاع أولا: الخيارات تُعرض قبل الجواب، والتصحيح بعد الاختيار مع الشرح.
   الصواب والخطأ يحملهما نص وأيقونة لا اللون وحده. */

import { Check, X } from "lucide-react";
import type { ModuleCheck } from "@/application/content/module-checks";

export default function CheckQuestion({
  check,
  index,
  chosen,
  onPick,
  className = "",
}: {
  check: ModuleCheck;
  /** رقم يُعرض قبل السؤال — أخفِه بتمرير null */
  index: number | null;
  chosen: number | undefined;
  onPick: (optionIndex: number) => void;
  className?: string;
}) {
  const shown = chosen !== undefined;
  return (
    <div className={className}>
      <p className="text-sm font-bold leading-7">
        {index !== null && <span className="me-2 tabular-nums text-teal-light-ink">{index}.</span>}
        {check.promptAr}
      </p>
      <div className="mt-2.5 space-y-1.5">
        {check.options.map((opt, oi) => {
          const isCorrect = oi === check.correctIndex;
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
              onClick={() => onPick(oi)}
              aria-pressed={isChosen}
              className={`flex min-h-11 w-full items-center gap-2.5 rounded-2xl border px-4 text-right text-xs leading-6 transition ${tone} ${shown ? "cursor-default" : "cursor-pointer"}`}
            >
              {shown && isCorrect && <Check className="h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" />}
              {shown && isChosen && !isCorrect && <X className="h-4 w-4 shrink-0 text-red-300" aria-hidden="true" />}
              <span className="min-w-0 flex-1">{opt}</span>
              {shown && isCorrect && <span className="shrink-0 text-micro font-bold text-teal-light-ink">الصحيح</span>}
              {shown && isChosen && !isCorrect && <span className="shrink-0 text-micro font-bold text-red-300">اخترته</span>}
            </button>
          );
        })}
      </div>
      {shown && (
        <p className="mt-2 rounded-xl border border-white/8 bg-black/20 px-3.5 py-2.5 text-[11px] leading-6 text-foreground">
          {chosen === check.correctIndex ? "صحيح. " : "غير صحيح. "}
          {check.explainAr ?? "الجواب الصحيح موضَّح أعلاه."}
        </p>
      )}
    </div>
  );
}
