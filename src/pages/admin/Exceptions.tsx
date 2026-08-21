/* الاستثناءات التشغيلية — API حقيقي: حالات المستشارين غير المسندة + إسناد.
   الإسناد يتطلب صلاحية advisor.assign؛ قائمة المستشارين من صلاحية admin.users.manage
   وإن لم تتوفر يُدخل المعرف يدويا. */
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, ServerOff, ShieldAlert, UserPlus } from "lucide-react";
import AdminLayout from "./AdminLayout";
import FlowSteps from "@/components/FlowSteps";
import { apiGet, apiPost, ApiError, permissionMessage } from "@/services/api";

const CASE_STATUS_AR: Record<string, string> = {
  new: "جديدة", contacted: "تم التواصل", qualified: "مؤهلة", follow_up: "متابعة",
  enrolled: "سجلت", not_interested: "غير مهتمة", closed: "مغلقة", converted: "تحولت",
};

interface UnassignedCase {
  id: string; status: string; createdAt: string;
  lead: { id: string; name?: string | null; email?: string | null } | null;
  client: { displayName: string; email: string } | null;
}
interface UserRow { id: string; displayName: string; email: string; roles: { id: string }[] }

export default function Exceptions() {
  const [rows, setRows] = useState<UnassignedCase[]>([]);
  const [advisors, setAdvisors] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState<string | null>(null);
  const [flash, setFlash] = useState("");
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true); setOffline(null);
    try { setRows(await apiGet<UnassignedCase[]>("/api/admin/advisor-cases/unassigned")); }
    catch (e) { setOffline(permissionMessage(e, "الخادم غير متصل")); }
    /* قائمة المستشارين اختيارية — تتطلب صلاحية المستخدمين */
    try {
      const users = await apiGet<UserRow[]>("/api/admin/users");
      setAdvisors(users.filter((u) => u.roles.some((r) => r.id === "advisor")));
    } catch { setAdvisors([]); }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const assign = async (caseId: string) => {
    const advisorId = (pick[caseId] ?? "").trim();
    if (!advisorId || busy) return;
    setBusy(true); setFlash("");
    try {
      await apiPost(`/api/admin/advisor-cases/${caseId}/assign`, { advisorId });
      setFlash("أُسندت الحالة — تاريخ الإسناد محفوظ");
      await load();
    } catch (e) { setFlash(e instanceof ApiError ? e.message : "فشل الإسناد"); }
    finally { setBusy(false); }
  };

  if (offline) {
    return (
      <AdminLayout title="الاستثناءات">
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-20 text-center">
          <ServerOff className="h-12 w-12 text-white/20" />
          <p className="mt-4 max-w-md text-sm text-white/55">{offline}</p>
          <button onClick={() => void load()} className="mt-5 flex cursor-pointer items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-xs font-bold text-white/70 hover:border-white/40">
            <RefreshCw className="h-3.5 w-3.5" /> إعادة المحاولة
          </button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="الاستثناءات — حالات بلا مستشار">
      <FlowSteps steps={[
        { label: "حالة تصل بلا مستشار", actor: "النظام يرصدها" },
        { label: "مراجعة وإسناد", actor: "أنت هنا" },
        { label: "المستشار يستلمها", actor: "تظهر في بوابته فوراً" },
      ]} />
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => void load()} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-white/60 hover:border-white/40">
          <RefreshCw className="h-3.5 w-3.5" /> تحديث
        </button>
        {flash && <span className="flex items-center gap-1.5 text-xs font-bold text-teal-light-ink" role="status"><CheckCircle2 className="h-3.5 w-3.5" /> {flash}</span>}
      </div>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-white/30" /></div>
      ) : rows.length === 0 ? (
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-20 text-center">
          <ShieldAlert className="h-12 w-12 text-white/20" />
          <h2 className="mt-4 text-xl font-black">لا استثناءات</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-white/55">كل حالات المستشارين النشطة مسندة — الحالات الجديدة من التشخيص تظهر هنا فور وصولها.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div>
                <p className="font-black">{c.client?.displayName ?? c.lead?.name ?? "—"}</p>
                <p className="mt-1 text-xs text-white/50" dir="ltr">{c.client?.email ?? c.lead?.email ?? ""}</p>
                <p className="mt-1 text-[11px] text-white/45">
                  الحالة: {CASE_STATUS_AR[c.status] ?? c.status} · منذ {new Date(c.createdAt).toLocaleDateString("ar")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {advisors.length > 0 ? (
                  <select value={pick[c.id] ?? ""} onChange={(e) => setPick({ ...pick, [c.id]: e.target.value })}
                    className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs text-white [&>option]:bg-surface">
                    <option value="">اختر مستشارا…</option>
                    {advisors.map((a) => <option key={a.id} value={a.id}>{a.displayName} ({a.email})</option>)}
                  </select>
                ) : (
                  <input value={pick[c.id] ?? ""} onChange={(e) => setPick({ ...pick, [c.id]: e.target.value })}
                    placeholder="معرف المستشار (UUID)" dir="ltr"
                    className="w-56 rounded-xl border border-white/15 bg-black/30 px-3 py-2 font-mono text-xs text-white placeholder:text-white/25 focus:border-teal focus:outline-none" />
                )}
                <button disabled={busy || !(pick[c.id] ?? "").trim()} onClick={() => void assign(c.id)}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full bg-teal px-4 py-2 text-xs font-black text-on-teal transition hover:bg-teal-light disabled:opacity-40">
                  <UserPlus className="h-3.5 w-3.5" /> إسناد
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
