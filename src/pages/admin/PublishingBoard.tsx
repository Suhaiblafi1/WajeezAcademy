/* لوحة النشر والجودة — إصدارات الكتالوج، التحقق، تحليل الأثر، النشر الذري، الرجوع */
import { useCallback, useEffect, useState } from "react";
import { Activity, ArrowUpCircle, History, PlayCircle, Rocket, ShieldCheck, Undo2 } from "lucide-react";
import AdminLayout from "./AdminLayout";
import FlowSteps from "@/components/FlowSteps";
import { apiGet, apiPost, ApiError, permissionMessage } from "@/services/api";

type Version = {
  id: string; label: string; status: string; createdAt: string; publishedAt: string | null
  snapshots: { payloadHash: string }[]; events: { action: string; createdAt: string }[]
};
type Impact = { runId: string; changedCount: number; totalPersonas: number; changed: { name: string }[]; baselineAr: string };
type Validation = { ok: boolean; errors: string[] };
type RegressionRun = { id: string; passed: boolean; createdAt: string; results: { name: string; match: boolean }[] };

const STATUS_AR: Record<string, string> = { draft: "مسودة", published: "منشور", superseded: "تجاوزه إصدار أحدث" };

export default function PublishingBoard() {
  const [versions, setVersions] = useState<Version[]>([]);
  const [runs, setRuns] = useState<RegressionRun[]>([]);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setVersions(await apiGet<Version[]>("/api/admin/publishing/versions"));
      setRuns(await apiGet<RegressionRun[]>("/api/admin/quality/regression-runs"));
    } catch (e) {
      setError(permissionMessage(e, "تعذر الاتصال بخادم API — شغّله بـ npm run api:dev"));
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key); setError(null);
    try { await fn(); await refresh(); } catch (e) { setError(e instanceof ApiError ? e.message : "فشل الإجراء"); }
    finally { setBusy(null); }
  };

  return (
    <AdminLayout title="النشر المحكوم وجودة التشخيص">
      <FlowSteps steps={[
        { label: "مسودة محتوى", actor: "فريق المحتوى / مدرب" },
        { label: "مراجعة", actor: "مراجع الكتالوج" },
        { label: "اعتماد", actor: "معتمد الكتالوج" },
        { label: "نشر للطلاب", actor: "من هذه الشاشة" },
      ]} />
      {error && <p className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="flex items-center gap-2 font-black"><ShieldCheck className="h-5 w-5 text-gold-ink" /> 1 · التحقق البنيوي</h2>
          <button disabled={busy !== null} onClick={() => act("validate", async () => setValidation(await apiPost<Validation>("/api/admin/publishing/validate")))}
            className="mt-4 w-full cursor-pointer rounded-full border border-white/15 px-4 py-2 text-sm font-bold hover:border-gold/60 disabled:opacity-40">
            {busy === "validate" ? "يفحص…" : "فحص الكيانات المعتمدة"}
          </button>
          {validation && (
            <div className="mt-3 text-xs leading-6">
              {validation.ok
                ? <p className="text-emerald-300">سليم — لا نقص يمنع النشر.</p>
                : validation.errors.map((e, i) => <p key={i} className="text-red-300">• {e}</p>)}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="flex items-center gap-2 font-black"><Activity className="h-5 w-5 text-gold-ink" /> 2 · تحليل الأثر</h2>
          <button disabled={busy !== null} onClick={() => act("impact", async () => setImpact(await apiPost<Impact>("/api/admin/publishing/impact", { changeRef: "تحليل من لوحة النشر" })))}
            className="mt-4 w-full cursor-pointer rounded-full border border-white/15 px-4 py-2 text-sm font-bold hover:border-gold/60 disabled:opacity-40">
            {busy === "impact" ? "يحاكي 12 شخصية…" : "محاكاة قبل/بعد (12 شخصية)"}
          </button>
          {impact && (
            <p className="mt-3 text-xs leading-6 text-white/70">
              تغيّرت توصية {impact.changedCount} من {impact.totalPersonas} شخصية.
              {/* الرقم بلا مرجعه يُقرأ خطأ: «صفر» عن قياسٍ على الجداول لا على
                  اللقطة الحية يعني «لا معتمد ينتظر»، لا «النشر بلا أثر». */}
              <span className="mt-1 block text-white/45">مقيس على: {impact.baselineAr}</span>
              {impact.changed.map((c) => <span key={c.name} className="block text-amber-300">• {c.name}</span>)}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="flex items-center gap-2 font-black"><Rocket className="h-5 w-5 text-gold-ink" /> 3 · نشر إصدار</h2>
          <div className="mt-4 flex gap-2">
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="2026.08.16-01" dir="ltr"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-gold/60" />
            <button disabled={busy !== null || !label.trim()} onClick={() => act("create", async () => {
              const v = await apiPost<Version>("/api/admin/publishing/versions", { label: label.trim() });
              setLabel("");
              await act("publish", () => apiPost(`/api/admin/publishing/versions/${v.id}/publish`));
            })} className="cursor-pointer rounded-full bg-gold px-4 py-2 text-sm font-black text-on-gold disabled:opacity-40">
              {busy === "create" || busy === "publish" ? "ينشر…" : "أنشئ وانشر"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-white/50">النشر ذري: يرفض عند أي نقص ولا ينشر شيئًا جزئيًا.</p>
        </section>
      </div>

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-lg font-black"><History className="h-5 w-5 text-gold-ink" /> الإصدارات</h2>
        <div className="mt-4 space-y-2">
          {versions.map((v) => (
            <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div>
                <p className="font-bold text-sm" dir="ltr">{v.label}</p>
                <p className="mt-0.5 text-[11px] text-white/50" dir="ltr">{v.snapshots[0]?.payloadHash.slice(0, 12)}… · {v.events.map((e) => e.action).join(", ") || "—"}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${v.status === "published" ? "border-emerald-400/30 text-emerald-300" : "border-white/15 text-white/60"}`}>
                  {STATUS_AR[v.status] ?? v.status}
                </span>
                {v.status !== "published" && v.snapshots.length > 0 && (
                  <button disabled={busy !== null} onClick={() => act(`rb-${v.id}`, () => apiPost("/api/admin/publishing/rollback", { targetVersionId: v.id, reasonAr: "رجوع من لوحة النشر" }))}
                    className="flex cursor-pointer items-center gap-1 rounded-full border border-amber-400/40 px-3 py-1.5 text-xs font-bold text-amber-300 disabled:opacity-40">
                    <Undo2 className="h-3.5 w-3.5" /> استرجاع هذه اللقطة
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-black"><PlayCircle className="h-5 w-5 text-gold-ink" /> اختبار الارتداد</h2>
          <button disabled={busy !== null} onClick={() => act("sim", () => apiPost("/api/admin/quality/simulate"))}
            className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-xs font-bold hover:border-gold/60 disabled:opacity-40">
            <ArrowUpCircle className="h-4 w-4" /> {busy === "sim" ? "يحاكي…" : "تشغيل الآن (منشور مقابل مضمن)"}
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {runs.length === 0 && <p className="text-sm text-white/50">لا تشغيلات بعد.</p>}
          {runs.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-xs text-white/55">{new Date(r.createdAt).toLocaleString("ar")}</p>
              <p className={`text-sm font-black ${r.passed ? "text-emerald-300" : "text-red-300"}`}>
                {r.passed ? "✓ متطابق" : `✗ انحراف ${r.results.filter((x) => !x.match).length} شخصية`}
              </p>
            </div>
          ))}
        </div>
      </section>
    </AdminLayout>
  );
}
