/* حالاتٌ بلا مستشار — API حقيقي: حالات المستشارين غير المسندة + إسناد.
   الإسناد يتطلب صلاحية advisor.assign؛ قائمة المستشارين من صلاحية admin.users.manage
   وإن لم تتوفر يُدخل المعرف يدويا.

   وكان اسمُها «الاستثناءات» في القائمة والشاشة — اسمٌ لا يدلّ على محتواه،
   ومحروسٌ بصلاحيةِ مراجعةِ طلبات التسجيل التي لا تفتح شيئا هنا. */
import { useCallback, useEffect, useState } from "react";
import { toast, toastError } from "@/components/Toast";
import { Loader2, RefreshCw, ServerOff, ShieldAlert, UserPlus } from "lucide-react";
import AdminLayout from "./AdminLayout";
import FlowSteps from "@/components/FlowSteps";
import { apiGet, apiPost, ApiError, permissionMessage } from "@/services/api";
import { fmtDate } from "@/application/text/format-ar";

import { Panel, Card } from "@/components/ui/Surface";
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
    setBusy(true);
    try {
      await apiPost(`/api/admin/advisor-cases/${caseId}/assign`, { advisorId });
      toast("أُسندت الحالة — تاريخ الإسناد محفوظ");
      await load();
    } catch (e) { toastError(e instanceof ApiError ? e.message : "فشل الإسناد"); }
    finally { setBusy(false); }
  };

  if (offline) {
    return (
      <AdminLayout title="حالات بلا مستشار">
        <Panel className="grid place-items-center py-20 text-center">
          <ServerOff className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 max-w-md text-sm text-muted-foreground">{offline}</p>
          <button onClick={() => void load()} className="mt-5 flex cursor-pointer items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-xs font-bold text-foreground hover:border-white/40">
            <RefreshCw className="h-3.5 w-3.5" /> إعادة المحاولة
          </button>
        </Panel>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="حالات بلا مستشار">
      <FlowSteps steps={[
        { label: "حالة تصل بلا مستشار", actor: "النظام يرصدها" },
        { label: "مراجعة وإسناد", actor: "أنت هنا" },
        { label: "المستشار يستلمها", actor: "تظهر في بوابته فوراً" },
      ]} />
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => void load()} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-muted-foreground hover:border-white/40">
          <RefreshCw className="h-3.5 w-3.5" /> تحديث
        </button>
      </div>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" /></div>
      ) : rows.length === 0 ? (
        <Panel className="grid place-items-center py-20 text-center">
          <ShieldAlert className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-xl font-black">لا حالةَ بلا مستشار</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">كل حالات المستشارين النشطة مسندة — الحالات الجديدة من التشخيص تظهر هنا فور وصولها.</p>
        </Panel>
      ) : (
        <div className="space-y-3">
          {rows.map((c) => (
            <Card key={c.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-black">{c.client?.displayName ?? c.lead?.name ?? "—"}</p>
                <p className="mt-1 text-xs text-muted-foreground" dir="ltr">{c.client?.email ?? c.lead?.email ?? ""}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  الحالة: {CASE_STATUS_AR[c.status] ?? c.status} · منذ {fmtDate(new Date(c.createdAt))}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {advisors.length > 0 ? (
                  <select value={pick[c.id] ?? ""} onChange={(e) => setPick({ ...pick, [c.id]: e.target.value })}
                    className="rounded-xl border border-white/15 bg-paper/30 px-3 py-2 text-xs text-foreground [&>option]:bg-surface">
                    <option value="">اختر مستشارا…</option>
                    {advisors.map((a) => <option key={a.id} value={a.id}>{a.displayName} ({a.email})</option>)}
                  </select>
                ) : (
                  <input value={pick[c.id] ?? ""} onChange={(e) => setPick({ ...pick, [c.id]: e.target.value })}
                    placeholder="معرف المستشار (UUID)" dir="ltr"
                    className="w-56 rounded-xl border border-white/15 bg-paper/30 px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/75 focus:border-teal focus:outline-none" />
                )}
                <button disabled={busy || !(pick[c.id] ?? "").trim()} onClick={() => void assign(c.id)}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full bg-teal px-4 py-2 text-xs font-black text-on-teal transition hover:bg-teal-light disabled:opacity-40">
                  <UserPlus className="h-3.5 w-3.5" /> إسناد
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
