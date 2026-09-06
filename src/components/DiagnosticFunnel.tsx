/* قمع التشخيص وجدار التسجيل — أول مخطط بياني في المنصة.
   الشكل: أشرطة أفقية لمقادير على مراحل مرتبة (سلسلة واحدة فلا مفتاح — العنوان يسمّيها)،
   ونسبة التحويل رقم رئيسي لا شريط، لأن الرقم الواحد لا يُرسم.
   الألوان: هوية واحدة بلون العلامة، وتباين الشريط مع السطح ≥ 3:1 في الوضعين
   (#38A7B4 على الداكن، و#1E666E على الفاتح عبر متغير CSS يتجاوزه light.css).
   الهوية ليست باللون وحده: اسم المرحلة وقيمتها نصّان دائما. */

import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { apiGet } from "@/services/api";

import { Panel } from "@/components/ui/Surface";
interface FunnelRow {
  stage: string;
  users: number | string;
}

const CONVERSION_STAGE = "نسبة التحويل";

export default function DiagnosticFunnel() {
  const [rows, setRows] = useState<FunnelRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    /* المسار يرجع { key, titleAr, methodAr, rows } — لا مصفوفة مباشرة */
    apiGet<{ rows?: FunnelRow[] } | FunnelRow[]>("/api/admin/reports/diagnostic-funnel")
      .then((r) => setRows(Array.isArray(r) ? r : (r?.rows ?? [])))
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null;

  const stages = (rows ?? []).filter((r) => typeof r.users === "number") as { stage: string; users: number }[];
  const conversion = (rows ?? []).find((r) => r.stage.includes(CONVERSION_STAGE));
  const peak = Math.max(1, ...stages.map((s) => s.users));
  const started = stages[0]?.users ?? 0;

  return (
    <Panel as="section" className="funnel" aria-labelledby="funnel-title">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="funnel-title" className="flex items-center gap-2 text-sm font-black text-foreground">
          <BarChart3 className="h-4 w-4 text-teal-light-ink" aria-hidden="true" />
          قمع التشخيص وجدار التسجيل
        </h2>
        {/* النسبةُ لا تُعرض قبل أن يبدأ أحد.

            كانت تُعرض دائما، فتقول «نسبة التحويل عند الجدار: ٠٪» بينما الجسمُ
            تحتها يقول «لا أحداث بعد» — فيُقرأ الصفرُ **نتيجةً** وهو **غيابُ
            بيانات**، وبينهما فرقٌ يُبنى عليه قرار: الأوّلُ يقول «الجدارُ يطرد
            الناسَ كلَّهم» والثاني يقول «لم يمرّ أحدٌ بعد». */}
        {conversion && started > 0 && (
          <p className="text-xs text-muted-foreground">
            نسبة التحويل عند الجدار:{" "}
            <span className="text-lg font-black tabular-nums text-gold-ink">{String(conversion.users)}</span>
          </p>
        )}
      </div>

      {rows === null ? (
        <p className="mt-6 text-sm text-muted-foreground">يُحسب من أحداث الرحلة…</p>
      ) : started === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          لا أحداث بعد. تظهر المراحل هنا حين يبدأ أول متعلم التشخيص.
        </p>
      ) : (
        <ol className="mt-5 space-y-2.5">
          {stages.map((s, i) => {
            const pct = Math.round((s.users / peak) * 100);
            const dropFromPrev = i > 0 && stages[i - 1].users > 0
              ? Math.round(((stages[i - 1].users - s.users) / stages[i - 1].users) * 100)
              : 0;
            return (
              <li key={s.stage} className="grid grid-cols-[9.5rem_1fr_auto] items-center gap-3 text-xs sm:grid-cols-[11rem_1fr_auto]">
                <span className="text-foreground">{s.stage}</span>
                <span
                  className="relative h-3 rounded-full bg-white/[0.06]"
                  title={`${s.stage}: ${s.users} جهازا${dropFromPrev > 0 ? ` · تسرّب ${dropFromPrev}٪ عن المرحلة السابقة` : ""}`}
                >
                  <span
                    className="funnel-bar absolute inset-y-0 right-0 rounded-full"
                    style={{ width: `${Math.max(pct, s.users > 0 ? 2 : 0)}%` }}
                  />
                </span>
                <span className="tabular-nums font-black text-foreground">
                  {s.users}
                  {dropFromPrev > 0 && (
                    <span className="ms-2 font-medium text-muted-foreground">({dropFromPrev}٪ تسرّب)</span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground">
        أجهزة فريدة عند كل مرحلة — لا زيارات. النسبة المئوية بجانب كل مرحلة هي التسرّب عن سابقتها.
      </p>
    </Panel>
  );
}
