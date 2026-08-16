/* لوحة جودة التشخيص والمحاكي — نتائج الارتداد التفصيلية وتحليلات الأثر */
import { useCallback, useEffect, useState } from "react";
import { FlaskConical, RefreshCw } from "lucide-react";
import AdminLayout from "./AdminLayout";
import { apiGet, ApiError } from "@/services/api";

type PersonaResult = {
  name: string; questions: number; kind: string; top: string | null; tpl: string | null; conf: number; match: boolean
};
type RegressionRun = { id: string; passed: boolean; createdAt: string; results: PersonaResult[] };
type ImpactRun = {
  id: string; changeRef: string; createdAt: string
  summary: { changedCount: number; totalPersonas: number; changed: { name: string }[] }
};

const KIND_AR: Record<string, string> = { pathway: "مسار", composite: "خطة مركبة", advisor: "إحالة لمستشار" };

export default function DiagnosticQuality() {
  const [runs, setRuns] = useState<RegressionRun[]>([]);
  const [impacts, setImpacts] = useState<ImpactRun[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setRuns(await apiGet<RegressionRun[]>("/api/admin/quality/regression-runs"));
      setImpacts(await apiGet<ImpactRun[]>("/api/admin/quality/impact-runs"));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "تعذر الاتصال بخادم API — شغّله بـ npm run api:dev");
    }
  }, []);

  useEffect(() => {
    /* الجلب غير متزامن — لا setState مباشرا داخل الأثر */
    const t = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(t);
  }, [refresh]);

  const latest = runs[0];

  return (
    <AdminLayout title="جودة التشخيص والمحاكي">
      {error && <p className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}

      <section>
        <h2 className="flex items-center gap-2 text-lg font-black">
          <FlaskConical className="h-5 w-5 text-[#FABC05]" /> أحدث تشغيل ارتداد
          {latest && <span className={`text-sm ${latest.passed ? "text-emerald-300" : "text-red-300"}`}>{latest.passed ? "— متطابق تماما" : "— فيه انحراف"}</span>}
        </h2>
        {!latest && <p className="mt-3 text-sm text-white/40">لا تشغيلات بعد — شغّل المحاكاة من لوحة النشر.</p>}
        {latest && (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-right text-xs">
              <thead className="bg-white/[0.04] text-white/50">
                <tr>
                  <th className="px-3 py-2">الشخصية</th><th className="px-3 py-2">أسئلة</th><th className="px-3 py-2">النوع</th>
                  <th className="px-3 py-2">المسار الأول</th><th className="px-3 py-2">القالب</th><th className="px-3 py-2">الثقة</th><th className="px-3 py-2">التطابق</th>
                </tr>
              </thead>
              <tbody>
                {latest.results.map((r) => (
                  <tr key={r.name} className="border-t border-white/5">
                    <td className="px-3 py-2 font-bold">{r.name}</td>
                    <td className="px-3 py-2">{r.questions}</td>
                    <td className="px-3 py-2">{KIND_AR[r.kind] ?? r.kind}</td>
                    <td className="px-3 py-2" dir="ltr">{r.top ?? "—"}</td>
                    <td className="px-3 py-2" dir="ltr">{r.tpl ?? "—"}</td>
                    <td className="px-3 py-2">{(r.conf * 100).toFixed(0)}٪</td>
                    <td className={`px-3 py-2 font-black ${r.match ? "text-emerald-300" : "text-red-300"}`}>{r.match ? "✓" : "✗"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-black">تحليلات الأثر السابقة</h2>
        <div className="mt-4 space-y-2">
          {impacts.length === 0 && <p className="text-sm text-white/40">لا تحليلات بعد.</p>}
          {impacts.map((r) => (
            <div key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">{r.changeRef}</p>
                <p className="text-[11px] text-white/40">{new Date(r.createdAt).toLocaleString("ar")}</p>
              </div>
              <p className="mt-1 text-xs text-white/60">
                تغيّرت {r.summary.changedCount} من {r.summary.totalPersonas} شخصية
                {r.summary.changed.length > 0 && <span className="text-amber-300"> — {r.summary.changed.map((c) => c.name).join("، ")}</span>}
              </p>
            </div>
          ))}
        </div>
      </section>

      <button onClick={() => void refresh()} className="mt-6 flex cursor-pointer items-center gap-1.5 text-xs text-white/50 hover:text-white">
        <RefreshCw className="h-3.5 w-3.5" /> تحديث
      </button>
    </AdminLayout>
  );
}
