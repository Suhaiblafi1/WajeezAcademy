/* بطاقة مخطط أشرطة (البند إد-٢) — البدائية الوحيدة لكل مخططات المنصة، فتقرأ كنظام واحد.
   قواعد التمثيل المطبَّقة:
   - أشرطة أفقية: أسماء الفئات عربية طويلة، والأفقي يمنحها سطرا كاملا بلا دوران.
   - سلسلة واحدة ⇒ لا مفتاح؛ العنوان يسمّي ما يُرسم.
   - القيمة نصّ بجانب كل شريط: الهوية ليست باللون وحده، والجدول والمخطط شيء واحد.
   - سلّم ترتيبي (ramp) للفئات المرتّبة فقط (شرائح النسب)؛ وصبغة واحدة لغير المرتّب،
     فلا يُعاد ترميز طول الشريط بلون.
   - أسطر الشبكة والمحاور غائبة عمدا: مع قيم نصّية ظاهرة تصير حِبرا بلا بيان.
   - طريقة الحساب تُعرض أسفل المخطط — الرقم بلا طريقته لا يُراجَع. */

import { Loader2, ServerOff } from "lucide-react";
import { fmtNum } from "@/application/text/format-ar";

export interface ChartBar {
  labelAr: string;
  value: number;
}

const RAMP = ["bg-ramp-1", "bg-ramp-2", "bg-ramp-3", "bg-ramp-4", "bg-ramp-5"] as const;

function fmt(n: number): string {
  return fmtNum(n);
}

export default function BarChartCard({
  titleAr,
  methodAr,
  bars,
  unitAr,
  ordinal = false,
  loading = false,
  failed = false,
  emptyAr = "لا بيانات بعد — يظهر المخطط فور تسجيل أول قراءة",
  className = "",
  icon,
}: {
  titleAr: string;
  methodAr: string;
  bars: ChartBar[] | null;
  unitAr?: string;
  /** فئات مرتّبة (شرائح، مراحل) ⇒ سلّم مضاءة؛ غير ذلك صبغة واحدة */
  ordinal?: boolean;
  loading?: boolean;
  failed?: boolean;
  emptyAr?: string;
  className?: string;
  icon?: React.ReactNode;
}) {
  const rows = bars ?? [];
  const peak = Math.max(1, ...rows.map((b) => b.value));
  const titleId = `chart-${titleAr.replace(/\s+/g, "-")}`;

  return (
    <section aria-labelledby={titleId} className={`rounded-3xl border border-white/10 bg-white/[0.03] p-6 ${className}`.trim()}>
      <h2 id={titleId} className="flex items-center gap-2 text-sm font-black text-white/75">
        {icon}
        {titleAr}
      </h2>

      {failed ? (
        <p className="mt-5 flex items-center gap-2 text-xs text-white/55">
          <ServerOff className="h-4 w-4 shrink-0" aria-hidden="true" />
          تعذّر جلب هذا المخطط — حدّث الصفحة.
        </p>
      ) : loading ? (
        <div className="mt-6 grid place-items-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-teal-ink" aria-label="جارٍ التحميل" />
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-5 text-xs leading-6 text-white/55">{emptyAr}</p>
      ) : (
        <ol className="mt-5 space-y-2.5">
          {rows.map((b, i) => (
            <li key={`${b.labelAr}-${i}`} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-3 text-xs sm:grid-cols-[10rem_1fr_auto]">
              <span className="truncate text-white/70" title={b.labelAr}>{b.labelAr}</span>
              <span className="relative h-3 rounded-full bg-white/[0.06]">
                <span
                  aria-hidden="true"
                  className={`absolute inset-y-0 right-0 rounded-full ${ordinal ? RAMP[Math.min(RAMP.length - 1, i)] : "bg-teal-ink"}`}
                  style={{ width: `${Math.max(2, Math.round((b.value / peak) * 100))}%` }}
                />
              </span>
              <span className="tabular-nums font-black text-white/85">
                {fmt(b.value)}
                {unitAr && <span className="ms-1 font-medium text-white/55">{unitAr}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-5 text-[11px] leading-relaxed text-white/50">{methodAr}</p>
    </section>
  );
}
