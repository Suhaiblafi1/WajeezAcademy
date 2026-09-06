/* طابور عمل المدرب (ف-١) — كل سطر عمل واحد وزر واحد ووجهة واحدة.
   الترتيب بالإلحاح لا بالنوع: الجلسة الجارية قبل التسجيل المنسي قبل التقييم. */

import { Link } from "react-router";
import { AlertTriangle, ClipboardCheck, ClipboardList, ListChecks, Radio, Video, Upload, ArrowLeft } from "lucide-react";
import type { QueueItem, QueueKind } from "@/application/trainer/work-queue";

import { Inset } from "@/components/ui/Surface";
const ICON: Record<QueueKind, typeof Video> = {
  session_now: Radio,
  session_soon: Video,
  attendance_missing: ClipboardList,
  grading_pending: ClipboardCheck,
  not_submitted: AlertTriangle,
  recording_missing: Upload,
};

/* الإلحاح يحمله الشكل والنص؛ اللون تعزيز لا مصدرا وحيدا */
const TONE: Record<QueueKind, string> = {
  session_now: "border-teal/60 bg-teal-ink/[0.10]",
  session_soon: "border-white/10 bg-white/[0.03]",
  attendance_missing: "border-gold/40 bg-gold/[0.06]",
  grading_pending: "border-gold/40 bg-gold/[0.06]",
  not_submitted: "border-white/10 bg-white/[0.03]",
  recording_missing: "border-white/10 bg-white/[0.03]",
};

export default function TrainerWorkQueue({ items, className = "" }: { items: QueueItem[]; className?: string }) {
  return (
    <section
      aria-labelledby="work-queue-title"
      className={`rounded-3xl border border-white/10 bg-white/[0.02] p-5 sm:p-6 ${className}`.trim()}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="work-queue-title" className="flex items-center gap-2 text-sm font-black">
          <ListChecks className="h-4 w-4 text-teal-light-ink" aria-hidden="true" />
          ما ينتظرك الآن
          {items.length > 0 && (
            <span className="rounded-full bg-teal-ink/15 px-2 py-0.5 text-micro tabular-nums text-teal-light-ink">{items.length}</span>
          )}
        </h2>
        <p className="text-micro text-muted-foreground">مرتّبة بالإلحاح — لكل سطر إجراء واحد</p>
      </div>

      {items.length === 0 ? (
        <Inset as="p" className="mt-4 px-4 py-6 text-center text-xs leading-6 text-muted-foreground">
          لا شيء ينتظرك الآن — الحضور مسجَّل والتسليمات مقيَّمة ولا جلسة قريبة.
          <br />
          يظهر هنا كل ما يحتاج إجراءً منك فور حدوثه.
        </Inset>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {items.map((it, i) => {
            const Icon = ICON[it.kind];
            const cta = (
              <>
                {it.actionAr}
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              </>
            );
            return (
              <li
                key={`${it.kind}-${i}`}
                className={`flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 ${TONE[it.kind]}`}
              >
                <Icon className="h-4 w-4 shrink-0 text-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold leading-5">{it.titleAr}</p>
                  <p className="mt-0.5 truncate text-micro text-muted-foreground">{it.detailAr}</p>
                </div>
                {it.external ? (
                  <a
                    href={it.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-teal px-4 text-xs font-black text-on-teal transition hover:bg-teal-light"
                  >
                    {cta}
                  </a>
                ) : (
                  <Link
                    to={it.href}
                    className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-4 text-xs font-bold transition hover:border-teal/60 hover:text-teal-light-ink"
                  >
                    {cta}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
