/* إدارة المستخدمين — API حقيقي: قائمة، تعيين أدوار (يستبدل القائمة)، إيقاف.
   الحمايات من الخادم: لا سحب super_admin من نفسك ولا إيقاف ذاتي من هنا. */
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, ServerOff, ShieldOff, Users as UsersIcon } from "lucide-react";
import AdminLayout from "./AdminLayout";
import { apiGet, apiPost, ApiError, permissionMessage } from "@/services/api";

const ROLE_NAMES_AR: Record<string, string> = {
  super_admin: "مدير النظام الأعلى", academic_manager: "المدير الأكاديمي",
  diagnostic_manager: "مدير التشخيص", operations_manager: "مدير العمليات",
  advisor: "مستشار", trainer: "مدرب", finance: "المالية", support: "الدعم", learner: "متعلم",
};
const ALL_ROLES = Object.keys(ROLE_NAMES_AR);

interface UserRow {
  id: string; email: string; displayName: string; status: string; createdAt: string;
  roles: { id: string; nameAr: string }[];
}

export default function Users() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState<string | null>(null);
  const [flash, setFlash] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [rolePick, setRolePick] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setOffline(null);
    try { setRows(await apiGet<UserRow[]>("/api/admin/users")); }
    catch (e) { setOffline(permissionMessage(e, "الخادم غير متصل")); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, doneMsg: string) => {
    if (busy) return;
    setBusy(true); setFlash("");
    try {
      const res = await fn() as { error?: { message_ar: string } } | undefined;
      if (res?.error) { setFlash(res.error.message_ar); return; }
      setFlash(doneMsg); setEditing(null); await load();
    } catch (e) { setFlash(e instanceof ApiError ? e.message : "فشل الإجراء"); }
    finally { setBusy(false); }
  };

  if (offline) {
    return (
      <AdminLayout title="المستخدمون والأدوار">
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
    <AdminLayout title="المستخدمون والأدوار">
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => void load()} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-white/60 hover:border-white/40">
          <RefreshCw className="h-3.5 w-3.5" /> تحديث
        </button>
        {flash && <span className="flex items-center gap-1.5 text-xs font-bold text-[#6EC7D1]" role="status"><CheckCircle2 className="h-3.5 w-3.5" /> {flash}</span>}
      </div>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-white/30" /></div>
      ) : rows.length === 0 ? (
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-20 text-center">
          <UsersIcon className="h-12 w-12 text-white/20" />
          <p className="mt-4 text-sm text-white/50">لا مستخدمون.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((u) => (
            <div key={u.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-black">{u.displayName || "—"} <span className="mr-2 text-[11px] font-normal text-white/40" dir="ltr">{u.email}</span></p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {u.roles.map((r) => (
                      <span key={r.id} className="rounded-full border border-[#38A7B4]/40 px-2.5 py-0.5 text-[10px] font-bold text-[#6EC7D1]">{r.nameAr}</span>
                    ))}
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${u.status === "active" ? "border-emerald-400/30 text-emerald-300" : "border-red-500/40 text-red-400"}`}>
                      {u.status === "active" ? "نشط" : u.status}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditing(editing === u.id ? null : u.id); setRolePick(u.roles.map((r) => r.id)); }}
                    className="cursor-pointer rounded-full border border-white/15 px-4 py-1.5 text-xs font-bold text-white/65 hover:border-white/40">
                    الأدوار
                  </button>
                  {u.status === "active" && (
                    <button disabled={busy}
                      onClick={() => act(() => apiPost(`/api/admin/users/${u.id}/suspend`), "أُوقف الحساب وأُبطلت جلساته فورا")}
                      className="flex cursor-pointer items-center gap-1.5 rounded-full border border-red-500/40 px-4 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/10 disabled:opacity-40">
                      <ShieldOff className="h-3.5 w-3.5" /> إيقاف
                    </button>
                  )}
                </div>
              </div>
              {editing === u.id && (
                <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="mb-2 text-[11px] font-bold text-white/50">تعيين الأدوار — يستبدل القائمة كاملة:</p>
                  <div className="flex flex-wrap gap-2">
                    {ALL_ROLES.map((r) => (
                      <button key={r} type="button"
                        onClick={() => setRolePick(rolePick.includes(r) ? rolePick.filter((x) => x !== r) : [...rolePick, r])}
                        className={`cursor-pointer rounded-full border px-3 py-1 text-[11px] font-bold transition ${rolePick.includes(r) ? "border-[#FABC05] bg-[#FABC05]/10 text-[#FABC05]" : "border-white/15 text-white/55 hover:border-white/40"}`}>
                        {ROLE_NAMES_AR[r]}
                      </button>
                    ))}
                  </div>
                  <button disabled={busy || rolePick.length === 0}
                    onClick={() => act(() => apiPost(`/api/admin/users/${u.id}/roles`, { roleIds: rolePick }), "حُدثت الأدوار")}
                    className="mt-3 cursor-pointer rounded-full bg-[#FABC05] px-5 py-1.5 text-xs font-black text-[#0D0D0D] disabled:opacity-40">
                    احفظ الأدوار
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
