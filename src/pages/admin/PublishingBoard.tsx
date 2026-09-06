/* لوحة النشر والجودة — إصدارات الكتالوج، التحقق، تحليل الأثر، النشر الذري، الرجوع */
import { useCallback, useEffect, useState } from "react";
import { Activity, ArrowUpCircle, History, PlayCircle, Rocket, ShieldCheck, Trash2, Undo2 } from "lucide-react";
import AdminLayout from "./AdminLayout";
import FlowSteps from "@/components/FlowSteps";
import { apiDelete, apiGet, apiPost, ApiError, permissionMessage } from "@/services/api";
import { fmtDateTime } from "@/application/text/format-ar";
import { Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import ConfirmAction from '@/components/ConfirmAction'

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
  const [busy, setBusy] = useState<string | null>(null)
  /* مسودّةٌ تنتظر تأكيدَ حذفها — نافذةٌ واحدةٌ للفعل الذي لا يُستعاد */
  const [pendingDelete, setPendingDelete] = useState<{ id: string; label: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      setVersions(await apiGet<Version[]>("/api/admin/publishing/versions"));
      /* تشغيلاتُ الارتداد تخصّ صلاحيّةَ الجودة؛ المديرُ الأكاديميّ يرى الإصداراتَ
         بلا لافتة «تتطلّب مدير النظام» على صفحته هو (شُوهدت في جولة ٢٠٢٦-٠٩) */
      try { setRuns(await apiGet<RegressionRun[]>("/api/admin/quality/regression-runs")); }
      catch (e) { if (!(e instanceof ApiError && e.status === 403)) throw e; setRuns([]); }
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
      {error && <Inset as="p" tone="danger" className="mb-4 px-4 py-3 text-sm text-red-200">{error}</Inset>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card as="section">
          <h2 className="flex items-center gap-2 font-black"><ShieldCheck className="h-5 w-5 text-gold-ink" /> 1 · التحقق البنيوي</h2>
          <Button tone="secondary" disabled={busy !== null} onClick={() => act("validate", async () => setValidation(await apiPost<Validation>("/api/admin/publishing/validate")))} className="mt-4 w-full">
            {busy === "validate" ? "يفحص…" : "فحص الكيانات المعتمدة"}
          </Button>
          {validation && (
            <div className="mt-3 text-xs leading-6">
              {validation.ok
                ? <p className="text-emerald-300">سليم — لا نقص يمنع النشر.</p>
                : validation.errors.map((e, i) => <p key={i} className="text-red-300">• {e}</p>)}
            </div>
          )}
        </Card>

        <Card as="section">
          <h2 className="flex items-center gap-2 font-black"><Activity className="h-5 w-5 text-gold-ink" /> 2 · تحليل الأثر</h2>
          <Button tone="secondary" disabled={busy !== null} onClick={() => act("impact", async () => setImpact(await apiPost<Impact>("/api/admin/publishing/impact", { changeRef: "تحليل من لوحة النشر" })))} className="mt-4 w-full">
            {busy === "impact" ? "يحاكي 12 شخصية…" : "محاكاة قبل/بعد (12 شخصية)"}
          </Button>
          {impact && (
            <p className="mt-3 text-xs leading-6 text-foreground">
              تغيّرت توصية {impact.changedCount} من {impact.totalPersonas} شخصية.
              {/* الرقم بلا مرجعه يُقرأ خطأ: «صفر» عن قياسٍ على الجداول لا على
                  اللقطة الحية يعني «لا معتمد ينتظر»، لا «النشر بلا أثر». */}
              <span className="mt-1 block text-muted-foreground">مقيس على: {impact.baselineAr}</span>
              {impact.changed.map((c) => <span key={c.name} className="block text-amber-300">• {c.name}</span>)}
            </p>
          )}
        </Card>

        <Card as="section">
          <h2 className="flex items-center gap-2 font-black"><Rocket className="h-5 w-5 text-gold-ink" /> 3 · نشر إصدار</h2>
          <div className="mt-4 flex gap-2">
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="2026.08.16-01" dir="ltr"
              className="w-full rounded-xl border border-white/10 bg-paper/30 px-3 py-2 text-sm outline-none focus:border-gold/60" />
            <Button tone="primary" disabled={busy !== null || !label.trim()} onClick={() => act("create", async () => {
              const v = await apiPost<Version>("/api/admin/publishing/versions", { label: label.trim() });
              setLabel("");
              await act("publish", () => apiPost(`/api/admin/publishing/versions/${v.id}/publish`));
            })}>
              {busy === "create" || busy === "publish" ? "ينشر…" : "أنشئ وانشر"}
            </Button>
          </div>
          <p className="mt-2 text-micro text-muted-foreground">النشر ذري: يرفض عند أي نقص ولا ينشر شيئًا جزئيًا.</p>
        </Card>
      </div>

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-lg font-black"><History className="h-5 w-5 text-gold-ink" /> الإصدارات</h2>
        <div className="mt-4 space-y-2">
          {versions.map((v) => (
            <Card key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-bold text-sm" dir="ltr">{v.label}</p>
                <p className="mt-0.5 text-micro text-muted-foreground" dir="ltr">{v.snapshots[0]?.payloadHash.slice(0, 12)}… · {v.events.map((e) => e.action).join(", ") || "—"}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-micro font-bold ${v.status === "published" ? "border-emerald-400/30 text-emerald-300" : "border-white/15 text-muted-foreground"}`}>
                  {STATUS_AR[v.status] ?? v.status}
                </span>
                {v.status !== "published" && v.snapshots.length > 0 && (
                  <Button tone="secondary" size="sm" disabled={busy !== null} onClick={() => act(`rb-${v.id}`, () => apiPost("/api/admin/publishing/rollback", { targetVersionId: v.id, reasonAr: "رجوع من لوحة النشر" }))}>
                    <Undo2 className="h-3.5 w-3.5" /> استرجاع هذه اللقطة
                  </Button>
                )}
                {/* مسودة بلا لقطة = نشرٌ أخفق بعد إنشاء الإصدار: لا تُنشر ولا
                    تُسترجع، وتحجز تسميتها للأبد. هذا طريقها الوحيد للخروج. */}
                {v.status === "draft" && v.snapshots.length === 0 && (
                  <Button tone="danger" size="sm" disabled={busy !== null}
                    /* كان `confirm` خامّا: سطرٌ واحدٌ في حوار متصفّحٍ يملك
                       المستخدمُ كتمَه — فيصير الحذفُ لا يقع ولا يُقال لماذا. */
                    onClick={() => setPendingDelete({ id: v.id, label: v.label })}>
                    <Trash2 className="h-3.5 w-3.5" /> احذف المسودة
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-black"><PlayCircle className="h-5 w-5 text-gold-ink" /> اختبار الارتداد</h2>
          <Button tone="secondary" disabled={busy !== null} onClick={() => act("sim", () => apiPost("/api/admin/quality/simulate"))}>
            <ArrowUpCircle className="h-4 w-4" /> {busy === "sim" ? "يحاكي…" : "تشغيل الآن (منشور مقابل مضمن)"}
          </Button>
        </div>
        <div className="mt-4 space-y-2">
          {runs.length === 0 && <p className="text-sm text-muted-foreground">لا تشغيلات بعد.</p>}
          {runs.map((r) => (
            <Card key={r.id} className="flex items-center justify-between px-4 py-3">
              <p className="text-xs text-muted-foreground">{fmtDateTime(new Date(r.createdAt))}</p>
              <p className={`text-sm font-black ${r.passed ? "text-emerald-300" : "text-red-300"}`}>
                {r.passed ? "✓ متطابق" : `✗ انحراف ${r.results.filter((x) => !x.match).length} شخصية`}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {pendingDelete && (
        <ConfirmAction
          titleAr={`حذفُ المسودّة المعلّقة «${pendingDelete.label}»`}
          confirmLabelAr="احذف المسودّة"
          busy={busy !== null}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            const target = pendingDelete
            setPendingDelete(null)
            void act(`del-${target.id}`, () => apiDelete(`/api/admin/publishing/versions/${target.id}`, { reasonAr: "تنظيف مسودة معلّقة من لوحة النشر" }))
          }}
        >
          <p>مسودّةٌ بلا لقطةٍ تعني نشرا أخفق بعد إنشاء الإصدار: لا تُنشر ولا تُسترجع، وتحجز تسميتها للأبد.</p>
          <p>بحذفها <b className="text-foreground">تُحرَّر التسميةُ للاستعمال</b>، ويُسجَّل الحذفُ في سجلّ الأثر بصاحبه ووقته. ولا يُمَسّ أيُّ إصدارٍ منشور.</p>
        </ConfirmAction>
      )}
    </AdminLayout>
  );
}
