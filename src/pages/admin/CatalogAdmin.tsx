/* لوحة إدارة الكتالوج — عدادات الحالات، قوائم الكيانات، إنشاء مسودات، طلبات التغيير */
import { useCallback, useEffect, useState } from "react";
import { BookMarked, CheckCircle2, FilePlus2, GitPullRequest, RefreshCw, XCircle } from "lucide-react";
import AdminLayout from "./AdminLayout";
import { apiGet, apiPost, ApiError } from "@/services/api";

type Overview = {
  pathways: Record<string, number>; courses: Record<string, number>; skills: Record<string, number>
  templates: Record<string, number>; questions: Record<string, number>; changeRequests: Record<string, number>
};
type ChangeRequest = {
  id: string; entityType: string; entityId: string; status: string; createdAt: string
  decisions: { decision: string; noteAr: string | null; createdAt: string }[]
};

const STATUS_AR: Record<string, string> = {
  draft: "مسودة", approved: "معتمد", published: "منشور", in_review: "قيد المراجعة",
  changes_requested: "مطلوب تعديل", rejected: "مرفوض", applied: "مطبق", superseded: "تجاوزه إصدار أحدث",
};

function Pill({ v }: { v: string }) {
  const color = v === "published" || v === "approved" || v === "applied" ? "text-emerald-300 border-emerald-400/30"
    : v === "draft" ? "text-amber-300 border-amber-400/30" : "text-white/60 border-white/15";
  return <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${color}`}>{STATUS_AR[v] ?? v}</span>;
}

export default function CatalogAdmin() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [crs, setCrs] = useState<ChangeRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [skillForm, setSkillForm] = useState({ id: "", slug: "", nameAr: "", familyId: "" });

  const refresh = useCallback(async () => {
    try {
      setOverview(await apiGet<Overview>("/api/admin/catalog/overview"));
      setCrs(await apiGet<ChangeRequest[]>("/api/admin/catalog/change-requests"));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "تعذر الاتصال بخادم API — شغّله بـ npm run api:dev");
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); await refresh(); } catch (e) { setError(e instanceof ApiError ? e.message : "فشل الإجراء"); }
    finally { setBusy(false); }
  };

  return (
    <AdminLayout title="إدارة الكتالوج الأكاديمي">
      {error && <p className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}

      {overview && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {([["المسارات", overview.pathways], ["الدورات", overview.courses], ["المهارات", overview.skills],
             ["القوالب", overview.templates], ["الأسئلة", overview.questions], ["طلبات التغيير", overview.changeRequests]] as const).map(([label, bag]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-bold text-white/50">{label}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(bag).map(([s, n]) => (
                  <span key={s} className="text-[11px] text-white/75">{n} <Pill v={s} /></span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="flex items-center gap-2 text-lg font-black"><FilePlus2 className="h-5 w-5 text-[#FABC05]" /> مهارة جديدة (مسودة)</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {([["id", "SK-X-XXX-000"], ["slug", "skill_slug"], ["nameAr", "الاسم العربي"], ["familyId", "رمز العائلة (COG…)"]] as const).map(([k, ph]) => (
            <input key={k} value={skillForm[k]} onChange={(e) => setSkillForm({ ...skillForm, [k]: e.target.value })}
              placeholder={ph} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#FABC05]/60" />
          ))}
        </div>
        <button disabled={busy} onClick={() => act(async () => {
          await apiPost("/api/admin/catalog/skills", { ...skillForm, familyId: skillForm.familyId || undefined });
          setSkillForm({ id: "", slug: "", nameAr: "", familyId: "" });
        })} className="mt-4 cursor-pointer rounded-full bg-[#FABC05] px-5 py-2 text-sm font-black text-[#0D0D0D] disabled:opacity-40">
          إنشاء المسودة
        </button>
        <p className="mt-2 text-[11px] text-white/40">المسودة لا تظهر للمحرك قبل طلب تغيير معتمد ثم نشر إصدار.</p>
      </section>

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-lg font-black"><GitPullRequest className="h-5 w-5 text-[#FABC05]" /> طلبات التغيير</h2>
        <div className="mt-4 space-y-3">
          {crs.length === 0 && <p className="text-sm text-white/40">لا طلبات بعد.</p>}
          {crs.map((cr) => (
            <div key={cr.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div>
                <p className="font-bold text-sm" dir="ltr">{cr.entityType} · {cr.entityId}</p>
                <p className="mt-1 text-xs text-white/45">{new Date(cr.createdAt).toLocaleString("ar")} — {cr.decisions.length} قرار</p>
              </div>
              <div className="flex items-center gap-2">
                <Pill v={cr.status} />
                {cr.status === "in_review" && (
                  <>
                    <button disabled={busy} onClick={() => act(() => apiPost(`/api/admin/catalog/change-requests/${cr.id}/decision`, { decision: "approve" }))}
                      className="flex cursor-pointer items-center gap-1 rounded-full border border-emerald-400/40 px-3 py-1.5 text-xs font-bold text-emerald-300 disabled:opacity-40">
                      <CheckCircle2 className="h-3.5 w-3.5" /> اعتماد
                    </button>
                    <button disabled={busy} onClick={() => act(() => apiPost(`/api/admin/catalog/change-requests/${cr.id}/decision`, { decision: "request_changes", noteAr: "راجع التفاصيل" }))}
                      className="flex cursor-pointer items-center gap-1 rounded-full border border-amber-400/40 px-3 py-1.5 text-xs font-bold text-amber-300 disabled:opacity-40">
                      <XCircle className="h-3.5 w-3.5" /> طلب تعديل
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-white/40">
          <BookMarked className="h-3.5 w-3.5" /> maker-checker: لا يستطيع صانع الطلب اعتماده بنفسه — الخادم يرفض ذلك.
        </p>
      </section>

      <button onClick={() => void refresh()} className="mt-6 flex cursor-pointer items-center gap-1.5 text-xs text-white/50 hover:text-white">
        <RefreshCw className="h-3.5 w-3.5" /> تحديث
      </button>
    </AdminLayout>
  );
}
