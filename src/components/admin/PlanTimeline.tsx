/* ═══ «سجل التواصل» — متى أُرسلت الخطّة، ومتى رُدّت، وما قرّر المدرّبُ في البطاقات (١٧ أكتوبر ٢٠٢٦) ═══

   للإدارة وحدَها، باختيار صاحب المنصّة. يُطوى افتراضا ولا يُجلب حتّى يُفتح: أكثرُ من يفتح الخطّةَ
   جاء ليقرّر، والسجلُّ لمن أراد أن يعرف ما جرى قبل. والأسطرُ من `plan-timeline.ts`. */

import { useState } from "react";
import { History, Loader2 } from "lucide-react";
import { apiGet, ApiError } from "@/services/api";
import { fmtDateTimeAr } from "@/utils/format";
import type { TimelineEntry } from "@/application/trainer/plan-timeline";

export default function PlanTimeline({ planId }: { planId: string }) {
  const [entries, setEntries] = useState<TimelineEntry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (entries || loading) return;
    setLoading(true); setErr(null);
    try { setEntries((await apiGet<{ entries: TimelineEntry[] }>(`/api/admin/cohort-plans/${planId}/timeline`)).entries); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "تعذّر جلب السجل"); }
    finally { setLoading(false); }
  };

  return (
    <details className="mt-3" onToggle={(e) => { if ((e.target as HTMLDetailsElement).open) void load(); }}>
      <summary className="flex cursor-pointer items-center gap-2 text-read font-bold text-teal-light-ink">
        <History className="h-4 w-4" aria-hidden="true" /> سجل التواصل
      </summary>
      {loading && <Loader2 className="mt-2 h-4 w-4 animate-spin text-muted-foreground" aria-label="جار التحميل" />}
      {err && <p role="alert" className="mt-2 text-read text-danger-ink">{err}</p>}
      {entries && entries.length === 0 && (
        <p className="mt-2 text-read text-muted-foreground">لا شيء مسجّل بعد.</p>
      )}
      {entries && entries.length > 0 && (
        <ol className="mt-3 space-y-2 border-s border-white/10 ps-4">
          {entries.map((e, i) => (
            <li key={i} className="relative text-read leading-6">
              <span aria-hidden="true"
                className={`absolute -start-[1.3rem] top-2 h-2 w-2 rounded-full ${e.side === "admin" ? "bg-gold" : "bg-teal"}`} />
              <span className="font-bold text-foreground">{e.labelAr}</span>
              <span className="text-muted-foreground">
                {" "}· {e.side === "admin" ? "الإدارة" : "المدرب"}{e.by ? ` (${e.by})` : ""} · {fmtDateTimeAr(e.at)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </details>
  );
}
