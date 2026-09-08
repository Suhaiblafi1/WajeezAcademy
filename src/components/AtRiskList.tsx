/* إنذار المتعثرين (ف-٢) — أسباب مقروءة لا درجة خطر.
   القاعدة معروضة أسفل القائمة دائما: المدرب يجب أن يعرف بأي معيار صُنّف طالبه. */

import { Link } from "react-router";
import { AlertTriangle, MessageSquare, ShieldCheck } from "lucide-react";
import { RISK_RULE_AR, type AtRiskLearner } from "@/application/trainer/at-risk";

import { Card, Inset } from "@/components/ui/Surface";
export default function AtRiskList({ learners, className = "" }: { learners: AtRiskLearner[]; className?: string }) {
  return (
    <section
      aria-labelledby="at-risk-title"
      className={`rounded-3xl border border-white/10 bg-white/[0.02] p-5 sm:p-6 ${className}`.trim()}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="at-risk-title" className="flex items-center gap-2 text-sm font-black">
          <AlertTriangle className="h-4 w-4 text-gold-ink" aria-hidden="true" />
          من يحتاج تدخلك
          {learners.length > 0 && (
            <span className="rounded-full bg-gold/15 px-2 py-0.5 text-fine tabular-nums text-gold-ink">{learners.length}</span>
          )}
        </h2>
      </div>

      {learners.length === 0 ? (
        <Inset as="p" className="mt-4 flex items-center justify-center gap-2 px-4 py-6 text-center text-read text-muted-foreground">
          <ShieldCheck className="h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" />
          لا متعثر بالمعايير أدناه — الحضور والتسليمات في نطاقها المتوقع.
        </Inset>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {learners.map((l) => (
            <Card as="li" tone="warn" key={l.enrollmentId} className="flex flex-wrap items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-read font-bold">{l.nameAr}</p>
                <p className="mt-0.5 truncate text-read text-muted-foreground">{l.cohortTitleAr}</p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {l.reasons.map((r) => (
                    <li
                      key={r.kind}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-fine leading-5 text-foreground"
                    >
                      {r.textAr}
                    </li>
                  ))}
                </ul>
              </div>
              {/* لا بريدَ ولا رقما: المدرّبُ يراسل من الشعبة، والمنصّةُ هي
                  القناة — فالبريدُ ملكُ المتعلّم ولا يُعرض لغيره. */}
              <Link
                to="/trainer/board"
                className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-4 text-xs font-bold transition hover:border-teal/60 hover:text-teal-light-ink"
              >
                <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                راسله من الشعبة
              </Link>
            </Card>
          ))}
        </ul>
      )}

      <Inset as="p" className="mt-4 px-4 py-3 text-read leading-relaxed text-muted-foreground">
        {RISK_RULE_AR}
      </Inset>
    </section>
  );
}
