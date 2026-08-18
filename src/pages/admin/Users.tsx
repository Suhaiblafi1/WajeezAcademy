import { useMemo, useState } from "react";
import { CheckCircle2, ShieldOff, ShieldCheck, Users } from "lucide-react";
import AdminLayout from "./AdminLayout";
import { adminIdentity } from "./admin-identity";
import { loadUsers, updateUser, ROLE_LABEL, type AdminUser } from "@/data/admin-extras";

const ALL_ROLES = Object.keys(ROLE_LABEL);

/** إدارة المستخدمين — القائمة والأدوار والإيقاف (يوافق admin-users.routes) */
export default function AdminUsers() {
  const me = adminIdentity();
  const [tick, setTick] = useState(0);
  const users = useMemo(() => { void tick; return loadUsers(); }, [tick]);
  const [note, setNote] = useState<string | null>(null);

  const toggleRole = (u: AdminUser, role: string) => {
    const roles = u.roles.includes(role) ? u.roles.filter((r) => r !== role) : [...u.roles, role];
    updateUser(u.id, { roles });
    setNote(`حُدّثت أدوار ${u.name} — تعيين الأدوار يستبدل القائمة كاملة كما في الخادم، وسُجل باسم ${me?.name}.`);
    setTick(tick + 1);
  };

  const toggleStatus = (u: AdminUser) => {
    const status = u.status === "active" ? "suspended" : "active";
    updateUser(u.id, { status });
    setNote(
      status === "suspended"
        ? `أُوقف حساب ${u.name} — الإيقاف عند الخادم يبطل كل جلساته فورا.`
        : `أُعيد تفعيل حساب ${u.name}.`
    );
    setTick(tick + 1);
  };

  return (
    <AdminLayout title="إدارة المستخدمين — الأدوار والحالات">
      {note && (
        <p className="mb-5 flex items-center gap-2 rounded-2xl border border-[#38A7B4]/40 bg-[#38A7B4]/10 px-4 py-3 text-sm font-bold text-[#6EC7D1]">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {note}
        </p>
      )}
      <div className="space-y-4">
        {users.map((u) => (
          <div key={u.id} className={`rounded-3xl border p-5 ${u.status === "active" ? "border-white/10 bg-white/[0.02]" : "border-red-500/20 bg-red-500/[0.03]"}`}>
            <div className="flex flex-wrap items-start gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black">{u.name}</p>
                  {u.status === "suspended" && (
                    <span className="rounded-full bg-red-500/15 px-3 py-0.5 text-[11px] font-bold text-red-300">موقوف</span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-white/50" dir="ltr">{u.email}</p>
                <p className="mt-1 text-[10px] text-white/55">انضم: {u.joinedAt}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {ALL_ROLES.map((role) => {
                    const on = u.roles.includes(role);
                    return (
                      <button
                        key={role}
                        onClick={() => toggleRole(u, role)}
                        title={on ? "اسحب الدور" : "امنح الدور"}
                        className={`cursor-pointer rounded-full px-3 py-1 text-[11px] font-bold transition ${
                          on ? "bg-[#38A7B4]/20 text-[#6EC7D1] ring-1 ring-[#38A7B4]/50" : "bg-white/[0.04] text-white/35 hover:text-white/60"
                        }`}
                      >
                        {ROLE_LABEL[role]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button
                onClick={() => toggleStatus(u)}
                className={`flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-xs font-black transition ${
                  u.status === "active"
                    ? "border border-red-500/40 text-red-400 hover:bg-red-500/10"
                    : "bg-[#38A7B4] text-[#08272B] hover:bg-[#6EC7D1]"
                }`}
              >
                {u.status === "active" ? <><ShieldOff className="h-3.5 w-3.5" /> إيقاف الحساب</> : <><ShieldCheck className="h-3.5 w-3.5" /> إعادة تفعيل</>}
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-8 flex items-center justify-center gap-2 text-center text-[11px] text-white/55">
        <Users className="h-3.5 w-3.5" />
        لا تصعيد ذاتي: الحساب الجديد يولد متعلما فقط، وأي دور إضافي يُمنح من هذه الشاشة ويُسجل في سجل المراجعة.
      </p>
    </AdminLayout>
  );
}
