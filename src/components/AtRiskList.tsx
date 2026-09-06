/* إنذار المتعثرين (ف-٢) — أسباب مقروءة لا درجة خطر.
   القاعدة معروضة أسفل القائمة دائما: المدرب يجب أن يعرف بأي معيار صُنّف طالبه. */

import { AlertTriangle, Mail, ShieldCheck } from "lucide-react";
import { RISK_RULE_AR, type AtRiskLearner } from "@/application/trainer/at-risk";

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
            <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[11px] tabular-nums text-gold-ink">{learners.length}</span>
          )}
        </h2>
      </div>

      {learners.length === 0 ? (
        <p className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-white/8 bg-paper/20 px-4 py-6 text-center text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" />
          لا متعثر بالمعايير أدناه — الحضور والتسليمات في نطاقها المتوقع.
        </p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {learners.map((l) => (
            <li
              key={l.enrollmentId}
              className="flex flex-wrap items-start gap-3 rounded-2xl border border-gold/30 bg-gold/[0.05] px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold">{l.nameAr}</p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{l.cohortTitleAr}</p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {l.reasons.map((r) => (
                    <li
                      key={r.kind}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-micro leading-5 text-foreground"
                    >
                      {r.textAr}
                    </li>
                  ))}
                </ul>
              </div>
              {l.email && (
                <a
                  href={`mailto:${l.email}?subject=${encodeURIComponent(`متابعة تقدمك في ${l.cohortTitleAr}`)}`}
                  className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-4 text-xs font-bold transition hover:border-teal/60 hover:text-teal-light-ink"
                >
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  تواصل معه
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 rounded-2xl border border-white/8 bg-paper/20 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
        {RISK_RULE_AR}
      </p>
    </section>
  );
}
