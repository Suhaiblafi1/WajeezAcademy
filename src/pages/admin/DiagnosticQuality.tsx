/* لوحة جودة التشخيص والمحاكي — نتائج الارتداد التفصيلية وتحليلات الأثر */
import { useCallback, useEffect, useState } from "react";
import { FlaskConical, RefreshCw } from "lucide-react";
import AdminLayout from "./AdminLayout";
import { apiGet, ApiError } from "@/services/api";

type PersonaResult = {
  persona: string; questions?: number; kind: string; top: string | null; tpl: string | null; conf?: number; match: boolean
};
/* الشكل الحقيقي للخادم: results كائن فيه counts إجمالية + results مصفوفة الشخصيات */
type RegressionRun = {
  id: string; passed: boolean; createdAt: string;
  results: { counts?: Record<string, number>; results: PersonaResult[]; snapshotHash?: string }
};
type ImpactRun = {
  id: string; changeRef: string; createdAt: string
  summary: { changedCount: number; totalPersonas: number; changed: { name: string }[] }
};
/* ملخص آراء المتعلمين في نتائجهم — من بطاقة الرأي أسفل النتيجة الكاملة */
type FeedbackSummary = {
  total: number;
  verdicts: { yes: number; somewhat: number; no: number };
  recent: { id: string; verdict: string; note: string | null; pathwayId: string | null; createdAt: string }[];
};

const VERDICT_AR: Record<string, string> = { yes: "نعم", somewhat: "إلى حد ما", no: "لا" };

const KIND_AR: Record<string, string> = {
  pathway: "مسار", composite: "خطة مركبة", advisor: "إحالة لمستشار",
  single_pathway: "مسار واحد", template: "قالب", none: "بلا نتيجة",
};

export default function DiagnosticQuality() {
  const [runs, setRuns] = useState<RegressionRun[]>([]);
  const [impacts, setImpacts] = useState<ImpactRun[]>([]);
  const [feedback, setFeedback] = useState<FeedbackSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setRuns(await apiGet<RegressionRun[]>("/api/admin/quality/regression-runs"));
      setImpacts(await apiGet<ImpactRun[]>("/api/admin/quality/impact-runs"));
      setFeedback(await apiGet<FeedbackSummary>("/api/admin/quality/feedback"));
    } catch (e) {
      /* 403 تعني أن الدور الحالي ليس مدير التشخيص/النظام — رسالة مفهومة لا «عطل» */
      if (e instanceof ApiError && e.status === 403) {
        setError("هذه اللوحة خاصة بدور «مدير التشخيص» أو «مدير النظام» — حسابك الحالي لا يملك صلاحية المحاكي. في الديمو: ادخل بحساب superadmin.demo@wajeez.local لعرضها.");
      } else {
        setError(e instanceof ApiError ? e.message : "تعذر الاتصال بخادم API — شغّله بـ npm run api:dev");
      }
    }
  }, []);

  useEffect(() => {
    /* الجلب غير متزامن — لا setState مباشرا داخل الأثر */
    const t = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(t);
  }, [refresh]);

  const latest = runs[0];
  /* دفاعي: لا انهيار مهما تغير شكل الحمولة — صفحة سوداء ممنوعة */
  const latestRows: PersonaResult[] = latest
    ? Array.isArray(latest.results) ? latest.results : (latest.results?.results ?? [])
    : [];
  const counts = latest && !Array.isArray(latest.results) ? latest.results?.counts : undefined;
  const COUNT_AR: Record<string, string> = {
    skills: "مهارة", courses: "دورة", modules: "وحدة", pathways: "مسارا", questions: "سؤالا", templates: "قالبا",
  };

  return (
    <AdminLayout title="جودة التشخيص والمحاكي">
      {error && <p className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}

      <section>
        <h2 className="flex items-center gap-2 text-lg font-black">
          <FlaskConical className="h-5 w-5 text-[#FABC05]" /> أحدث تشغيل ارتداد
          {latest && <span className={`text-sm ${latest.passed ? "text-emerald-300" : "text-red-300"}`}>{latest.passed ? "— متطابق تماما" : "— فيه انحراف"}</span>}
        </h2>
        {counts && (
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(counts).map(([k, v]) => (
              <span key={k} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-white/60">
                <span className="font-black text-white">{v}</span> {COUNT_AR[k] ?? k}
              </span>
            ))}
          </div>
        )}
        {!latest && <p className="mt-3 text-sm text-white/50">لا تشغيلات بعد — شغّل المحاكاة من لوحة النشر.</p>}
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
                {latestRows.map((r) => (
                  <tr key={r.persona} className="border-t border-white/5">
                    <td className="px-3 py-2 font-bold">{r.persona}</td>
                    <td className="px-3 py-2">{r.questions ?? "—"}</td>
                    <td className="px-3 py-2">{KIND_AR[r.kind] ?? r.kind}</td>
                    <td className="px-3 py-2" dir="ltr">{r.top ?? "—"}</td>
                    <td className="px-3 py-2" dir="ltr">{r.tpl ?? "—"}</td>
                    <td className="px-3 py-2">{r.conf !== undefined ? `${(r.conf * 100).toFixed(0)}٪` : "—"}</td>
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
          {impacts.length === 0 && <p className="text-sm text-white/50">لا تحليلات بعد.</p>}
          {impacts.map((r) => (
            <div key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">{r.changeRef}</p>
                <p className="text-[11px] text-white/50">{new Date(r.createdAt).toLocaleString("ar")}</p>
              </div>
              <p className="mt-1 text-xs text-white/60">
                تغيّرت {r.summary.changedCount} من {r.summary.totalPersonas} شخصية
                {r.summary.changed.length > 0 && <span className="text-amber-300"> — {r.summary.changed.map((c) => c.name).join("، ")}</span>}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-black">آراء المتعلمين في نتائجهم</h2>
        <p className="mt-1 text-xs text-white/50">بطاقة «هل تصف هذه النتيجة وضعك؟» أسفل النتيجة الكاملة — مربوطة بجلسة التشخيص والمسار.</p>
        {!feedback || feedback.total === 0 ? (
          <p className="mt-3 text-sm text-white/50">لا آراء بعد — تصل هنا فور إرسال أول متعلم رأيه.</p>
        ) : (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
                <p className="text-2xl font-black">{feedback.total}</p>
                <p className="mt-1 text-[11px] text-white/55">إجمالي الآراء</p>
              </div>
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-4 text-center">
                <p className="text-2xl font-black text-emerald-300">{feedback.verdicts.yes}</p>
                <p className="mt-1 text-[11px] text-white/55">نعم — تصف وضعهم</p>
              </div>
              <div className="rounded-2xl border border-[#FABC05]/30 bg-[#FABC05]/5 p-4 text-center">
                <p className="text-2xl font-black text-[#FABC05]">{feedback.verdicts.somewhat}</p>
                <p className="mt-1 text-[11px] text-white/55">إلى حد ما</p>
              </div>
              <div className="rounded-2xl border border-red-400/30 bg-red-400/5 p-4 text-center">
                <p className="text-2xl font-black text-red-300">{feedback.verdicts.no}</p>
                <p className="mt-1 text-[11px] text-white/55">لا</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {feedback.recent.filter((r) => r.note).map((r) => (
                <div key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full border border-[#38A7B4]/40 bg-[#38A7B4]/10 px-2.5 py-0.5 text-[11px] font-bold text-[#6EC7D1]">
                      {VERDICT_AR[r.verdict] ?? r.verdict}
                    </span>
                    <p className="text-[11px] text-white/45" dir="ltr">{r.pathwayId ?? "—"} · {new Date(r.createdAt).toLocaleString("ar")}</p>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-white/70">{r.note}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <button onClick={() => void refresh()} className="mt-6 flex cursor-pointer items-center gap-1.5 text-xs text-white/50 hover:text-white">
        <RefreshCw className="h-3.5 w-3.5" /> تحديث
      </button>
    </AdminLayout>
  );
}
