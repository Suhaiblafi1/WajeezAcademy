/* مخططات الإدارة (البند إد-٢) — «منصة تعليمية بلا رسم بياني واحد» صارت أربعة.
   كلها من تقارير موجودة أصلا: بلا نقطة نهاية جديدة وبلا استعلام جديد.
   وكل مخطط يحمل طريقة حسابه الآتية من التقرير نفسه — لا وصف نكتبه هنا. */

import { useEffect, useState } from "react";
import { BarChart3, CalendarClock, Coins, GaugeCircle } from "lucide-react";
import BarChartCard, { type ChartBar } from "./BarChartCard";
import { apiGet } from "@/services/api";

interface ReportResponse {
  key?: string;
  titleAr?: string;
  methodAr?: string;
  rows?: Record<string, unknown>[];
}

interface ReportState {
  methodAr: string;
  rows: Record<string, unknown>[] | null;
  failed: boolean;
}

const EMPTY: ReportState = { methodAr: "", rows: null, failed: false };

/** يقرأ تقريرا واحدا — الردّ إما {rows} أو مصفوفة مباشرة */
function useReport(key: string): ReportState {
  const [state, setState] = useState<ReportState>(EMPTY);
  useEffect(() => {
    let alive = true;
    apiGet<ReportResponse | Record<string, unknown>[]>(`/api/admin/reports/${key}`)
      .then((r) => {
        if (!alive) return;
        const rows = Array.isArray(r) ? r : (r?.rows ?? []);
        const methodAr = Array.isArray(r) ? "" : (r?.methodAr ?? "");
        setState({ methodAr, rows, failed: false });
      })
      .catch(() => {
        if (alive) setState({ methodAr: "", rows: null, failed: true });
      });
    return () => {
      alive = false;
    };
  }, [key]);
  return state;
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** آخر N عنصر مرتّبة زمنيا بالمفتاح النصّي (YYYY-MM-DD أو YYYY-MM) */
function lastByKey(rows: Record<string, unknown>[], keyField: string, valueField: string, n: number): ChartBar[] {
  return rows
    .map((r) => ({ k: str(r[keyField]), v: num(r[valueField]) }))
    .filter((x) => x.k !== "")
    .sort((a, b) => a.k.localeCompare(b.k))
    .slice(-n)
    .map((x) => ({ labelAr: x.k, value: x.v }));
}

export default function AdminCharts({ className = "" }: { className?: string }) {
  const progress = useReport("progress-completion");
  const diagnostic = useReport("diagnostic");
  const revenue = useReport("revenue");
  const enrollments = useReport("enrollments");

  /* شرائح التقدم فئات مرتّبة ⇒ سلّم مضاءة. نستبعد سطر «إكمال مؤكد» فهو مقياس آخر لا شريحة */
  const progressBars: ChartBar[] | null = progress.rows
    ? progress.rows
        .filter((r) => str(r.bucket).includes("٪"))
        .map((r) => ({ labelAr: str(r.bucket), value: num(r.learners) }))
    : null;
  const confirmedCompletions = progress.rows?.find((r) => !str(r.bucket).includes("٪"));

  const diagnosticBars = diagnostic.rows ? lastByKey(diagnostic.rows, "day", "diagnostics", 10) : null;
  const revenueBars = revenue.rows ? lastByKey(revenue.rows, "monthCurrency", "revenue", 8) : null;

  /* التسجيلات مجمعة بالحالة عبر الشعب — الحالة ليست مرتّبة فصبغة واحدة */
  const enrollmentBars: ChartBar[] | null = enrollments.rows
    ? Object.entries(
        enrollments.rows.reduce<Record<string, number>>((acc, r) => {
          const k = str(r.status) || "غير محدد";
          acc[k] = (acc[k] ?? 0) + num(r.count);
          return acc;
        }, {}),
      )
        .sort((a, b) => b[1] - a[1])
        .map(([labelAr, value]) => ({ labelAr, value }))
    : null;

  return (
    <div className={`grid gap-5 lg:grid-cols-2 ${className}`.trim()}>
      <BarChartCard
        titleAr="توزيع تقدم المتعلمين"
        icon={<GaugeCircle className="h-4 w-4 text-teal-light-ink" aria-hidden="true" />}
        methodAr={
          progress.methodAr +
          (confirmedCompletions ? ` · إكمال مؤكد: ${num(confirmedCompletions.learners)}` : "")
        }
        bars={progressBars}
        unitAr="متعلم"
        ordinal
        loading={!progress.rows && !progress.failed}
        failed={progress.failed}
        emptyAr="لا سجلات تقدم بعد — يظهر التوزيع مع أول شعبة جارية"
      />
      <BarChartCard
        titleAr="التشخيصات المرفقة — آخر عشرة أيام"
        icon={<CalendarClock className="h-4 w-4 text-teal-light-ink" aria-hidden="true" />}
        methodAr={diagnostic.methodAr}
        bars={diagnosticBars}
        unitAr="تشخيص"
        loading={!diagnostic.rows && !diagnostic.failed}
        failed={diagnostic.failed}
        emptyAr="لا تشخيص مرفق بحساب بعد — يظهر المخطط مع أول نتيجة تُربط"
      />
      <BarChartCard
        titleAr="التسجيلات بحالتها"
        icon={<BarChart3 className="h-4 w-4 text-teal-light-ink" aria-hidden="true" />}
        methodAr={enrollments.methodAr}
        bars={enrollmentBars}
        unitAr="تسجيل"
        loading={!enrollments.rows && !enrollments.failed}
        failed={enrollments.failed}
        emptyAr="لا تسجيلات بعد"
      />
      <BarChartCard
        titleAr="الإيراد بالشهر"
        icon={<Coins className="h-4 w-4 text-gold-ink" aria-hidden="true" />}
        methodAr={revenue.methodAr}
        bars={revenueBars}
        loading={!revenue.rows && !revenue.failed}
        failed={revenue.failed}
        emptyAr="لا فاتورة مدفوعة بعد — يظهر المخطط مع أول دفعة مؤكدة"
      />
    </div>
  );
}
