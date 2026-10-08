/* بطاقةُ المعايير — ما تُقاس به خطّةُ الشعبة، بخطواتها (٨ أكتوبر ٢٠٢٦).

   الوجهُ نفسُه للمعتمِد في بطاقة المراجعة وللمدرّب في فحصه قبل الإرسال: يرى
   المدرّبُ ما سيُقرأ به عملُه قبل أن يُقرأ. والحسابُ كلُّه في
   `application/trainer/plan-scorecard.ts` — هنا الرسمُ وحدَه.

   والحالاتُ ثلاث بألوانها وكلماتها معا لا بالألوان وحدَها: «تحقّق» و«نصيحة»
   و«مطلوب». والنصيحةُ تُقال بسببها ولا تمنع شيئا — والمطلوبُ وحدَه يمنع الإرسال. */

import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { STAGE_LABELS } from "@/application/trainer/review-notes";
import type { ScoreItem, ScoreStatus } from "@/application/trainer/plan-scorecard";
import type { WorkspaceStep } from "@/application/trainer/workspace-step";

const LOOK: Record<ScoreStatus, { icon: typeof CheckCircle2; word: string; cls: string }> = {
  ok: { icon: CheckCircle2, word: "تحقّق", cls: "text-teal-light-ink" },
  advice: { icon: AlertTriangle, word: "نصيحة", cls: "text-gold-ink" },
  blocked: { icon: XCircle, word: "مطلوب", cls: "text-danger-ink" },
};

const STEP_ORDER: WorkspaceStep[] = ["identity", "modules", "workbooks", "sessions", "assignments"];
const stepLabel = (s: WorkspaceStep) => (s in STAGE_LABELS ? STAGE_LABELS[s as keyof typeof STAGE_LABELS] : s);

export function scorecardCounts(items: readonly ScoreItem[]) {
  return {
    ok: items.filter((i) => i.status === "ok").length,
    advice: items.filter((i) => i.status === "advice").length,
    blocked: items.filter((i) => i.status === "blocked").length,
  };
}

export default function PlanScorecard({ items, heading, intro, onStep }: {
  items: readonly ScoreItem[];
  heading: string;
  intro?: string;
  /** يفتح الخطوةَ التي يُصلَح فيها المعيار — للمدرّب. وبلا هذا تُقرأ البطاقةُ ولا تُنقل */
  onStep?: (step: WorkspaceStep) => void;
}) {
  const n = scorecardCounts(items);
  return (
    <Inset className="mt-3" role="region" aria-label={heading}>
      <p className="text-read font-black text-foreground">{heading}</p>
      <p className="mt-1 text-read leading-6 text-muted-foreground">
        {intro ?? "تحسبها المنصّةُ من الخطّة نفسِها."}{" "}
        <span className="font-bold text-teal-light-ink">{n.ok} تحقّق</span>
        {" · "}<span className="font-bold text-gold-ink">{n.advice} نصيحة</span>
        {" · "}<span className="font-bold text-danger-ink">{n.blocked} مطلوب</span>
      </p>
      {STEP_ORDER.filter((s) => items.some((i) => i.step === s)).map((step) => (
        <div key={step} className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-read font-bold text-foreground">{stepLabel(step)}</p>
            {onStep && items.some((i) => i.step === step && i.status !== "ok") && (
              <Button tone="ghost" size="sm" onClick={() => onStep(step)}>افتح الخطوة</Button>
            )}
          </div>
          <ul className="mt-1 space-y-2">
            {items.filter((i) => i.step === step).map((i) => {
              const look = LOOK[i.status];
              const Icon = look.icon;
              return (
                <li key={i.key} className="text-read leading-6" data-score={i.key} data-status={i.status}>
                  <div className="flex items-start gap-2">
                    <Icon className={`mt-1 h-4 w-4 shrink-0 ${look.cls}`} aria-hidden="true" />
                    <div className="min-w-0">
                      <p>
                        <span className={`font-bold ${look.cls}`}>{look.word}</span>
                        {" — "}<span className="font-bold text-foreground">{i.labelAr}</span>
                        {i.required && i.status === "ok" && <span className="text-muted-foreground"> (مُلزِم)</span>}
                        {": "}<span className="text-muted-foreground">{i.measuredAr}</span>
                      </p>
                      <p className="text-muted-foreground">المعيار: {i.standardAr}</p>
                      {i.gaps.length > 0 && (
                        <ul className="mt-1 list-disc pe-1 ps-5 text-foreground">
                          {i.gaps.map((g) => <li key={g}>{g}</li>)}
                        </ul>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </Inset>
  );
}
