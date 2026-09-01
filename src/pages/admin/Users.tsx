/* إدارة المستخدمين — API حقيقي: قائمة، تعيين أدوار (يستبدل القائمة)، إيقاف.
   الحمايات من الخادم: لا سحب super_admin من نفسك ولا إيقاف ذاتي من هنا. */
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, Minus, Plus, RefreshCw, ServerOff, ShieldOff, UserPlus, Users as UsersIcon } from "lucide-react";
import AdminLayout from "./AdminLayout";
import ListToolbar from "@/components/admin/ListToolbar";
import { matchesQuery } from "@/application/text/search-ar";
import { paginate } from "@/application/admin/paginate";
import { apiGet, apiPost, ApiError, permissionMessage } from "@/services/api";
import { useRealSession } from "@/services/session";

const ROLE_NAMES_AR: Record<string, string> = {
  super_admin: "مدير النظام الأعلى", academic_manager: "المدير الأكاديمي",
  diagnostic_manager: "مدير التشخيص", operations_manager: "مدير العمليات",
  advisor: "مستشار", trainer: "مدرب", finance: "المالية", support: "الدعم", learner: "متعلم",
};
const ALL_ROLES = Object.keys(ROLE_NAMES_AR);

interface UserRow {
  id: string; email: string; displayName: string; status: string; createdAt: string;
  roles: { id: string; nameAr: string }[];
  grants: number; denies: number;
}

interface PermRow {
  key: string; description: string;
  fromRole: boolean;
  effect: "grant" | "deny" | null;
  reason: string | null;
  effective: boolean;
  delegatable: boolean;
  refusal: string | null;
}

interface PermView {
  user: { id: string; displayName: string; email: string };
  roles: { id: string; nameAr: string }[];
  rank: { actor: number; target: number };
  permissions: PermRow[];
}

/* المجموعة من أوّل مقطع في المفتاح — فالسجلّ نفسه يرتّبها، ولا قائمة ثانية
   تُكتب بالأيدي فتتقادم كلّما أُضيفت صلاحية. */
const GROUP_AR: Record<string, string> = {
  catalog: "الكتالوج والمحتوى", diagnostic: "التشخيص", admin: "إدارة النظام",
  trainer: "المدربون", cohort: "الشعب", enrollment: "التسجيل", material: "المواد",
  certificate: "الشهادات", advisor: "الاستشارة", cv: "السير الذاتية", commerce: "التجارة",
  finance: "المالية", reports: "التقارير", notifications: "الإشعارات", support: "الدعم",
  settings: "الإعدادات", rating: "التقييمات", learner: "بوابة المتعلم",
};

export default function Users() {
  const [rows, setRows] = useState<UserRow[]>([]);
  /* بحثٌ وترقيم — القائمةُ تطول بعدد من على المنصّة، والشريطُ مشتركٌ مع
     ثلاث شاشاتٍ أخرى فلا تتفرّق صيغةُ العدّ ولا تطبيعُ الهمزة. */
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState<string | null>(null);
  const [flash, setFlash] = useState("");
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", displayName: "", roleId: "support" });
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [rolePick, setRolePick] = useState<string[]>([]);
  /* صلاحيات شخصٍ بعينه — لمدير النظام وحده */
  const { user: me } = useRealSession();
  /* الصلاحية لا الدور: الشاشة تُخفي ما لا يملكه، والخادم هو الحَكَم.
     وثلاثُ حبّات — الرؤية والإدارة والتفويض — لا حبّةٌ واحدة. */
  const can = (key: string) => me?.permissions.includes(key) ?? false;
  const canDelegate = can("admin.permissions.delegate");
  const canManage = can("admin.users.manage");
  const [permFor, setPermFor] = useState<string | null>(null);
  const [perms, setPerms] = useState<PermView | null>(null);
  const [permReason, setPermReason] = useState("");
  const [permQuery, setPermQuery] = useState("");

  const openPerms = async (userId: string) => {
    if (permFor === userId) { setPermFor(null); setPerms(null); return; }
    setPermFor(userId); setPerms(null); setPermReason(""); setPermQuery("");
    try { setPerms(await apiGet<PermView>(`/api/admin/users/${userId}/permissions`)); }
    catch (e) { setFlash(permissionMessage(e, "تعذّر جلب الصلاحيات")); setPermFor(null); }
  };

  const setPerm = (userId: string, key: string, effect: "grant" | "deny" | "clear") =>
    act(async () => {
      const res = await apiPost(`/api/admin/users/${userId}/permissions`, {
        permissionKey: key, effect, reason: effect === "clear" ? undefined : permReason.trim(),
      }) as { error?: { message_ar: string } } | undefined;
      if (res?.error) throw new ApiError("failed", res.error.message_ar, 400);
      setPerms(await apiGet<PermView>(`/api/admin/users/${userId}/permissions`));
    }, effect === "grant" ? "مُنحت الصلاحية — وأُبطلت جلساته ليدخل بها"
      : effect === "deny" ? "مُنعت الصلاحية — وأُبطلت جلساته فورا"
      : "أُزيل الاستثناء — عاد إلى ما يمنحه دوره");

  const load = useCallback(async () => {
    setLoading(true); setOffline(null);
    try { setRows(await apiGet<UserRow[]>("/api/admin/users")); }
    catch (e) { setOffline(permissionMessage(e, "الخادم غير متصل")); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /* الرسالةُ قد تُشتقّ من جواب الخادم: «أُنشئ الحساب ووصلته دعوة» كذبةٌ حين
     لا بريد — والخادمُ يعرف أأُرسلت أم لا، فيُقرأ منه لا يُفترض عنه. */
  const act = async (fn: () => Promise<unknown>, doneMsg: string | ((res: unknown) => string)) => {
    if (busy) return;
    setBusy(true); setFlash("");
    try {
      const res = await fn() as { error?: { message_ar: string } } | undefined;
      if (res?.error) { setFlash(res.error.message_ar); return; }
      setFlash(typeof doneMsg === "function" ? doneMsg(res) : doneMsg); await load();
    } catch (e) { setFlash(e instanceof ApiError ? e.message : "فشل الإجراء"); }
    finally { setBusy(false); }
  };

  /* الترشيحُ ثمّ الترقيم: البحثُ يقع على الكلّ لا على الصفحة المعروضة —
     وإلّا لم يجد الباحثُ إلّا ما كان أمامه أصلا. */
  const matched = rows.filter((u) => matchesQuery(q, [u.displayName, u.email, ...u.roles.map((r) => r.nameAr)]));
  const view = paginate(matched, page, 20);

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
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button onClick={() => void load()} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-white/60 hover:border-white/40">
          <RefreshCw className="h-3.5 w-3.5" /> تحديث
        </button>
        {/* إنشاءُ حسابٍ إداريّ — لم يكن له مسارٌ أصلا.

            والدورُ يُختار عند الإنشاء لا بعده: حسابٌ يُنشأ بلا دورٍ ثمّ
            يُنسى بلا دور يدخل ولا يجد شيئا، ويُقرأ ذلك عطبا لا نقصَ خطوة. */}
        {canManage && (
          <button
            onClick={() => { setCreating(!creating); setFlash(""); }}
            className="flex cursor-pointer items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-black text-on-gold transition hover:bg-gold/90"
          >
            <UserPlus className="h-3.5 w-3.5" /> {creating ? "إلغاء" : "أنشئ حسابا"}
          </button>
        )}
        {flash && <span className="flex items-center gap-1.5 text-xs font-bold text-teal-light-ink" role="status"><CheckCircle2 className="h-3.5 w-3.5" /> {flash}</span>}
      </div>

      {creating && canManage && (
        <div className="mb-5 rounded-2xl border border-gold/25 bg-gold/[0.04] p-5">
          <h3 className="text-sm font-black text-gold-ink">حسابٌ جديد بدوره</h3>
          <p className="mt-1 text-[11px] leading-6 text-white/55">
            لا كلمةَ مرورٍ تُختار هنا: يصله بريدٌ يشرح دورَه وما يفتحه له، ويعيّن كلمتَه بنفسه من رابطٍ صالحٍ لساعة.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_12rem_auto]">
            <input
              value={newUser.displayName} onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
              placeholder="الاسم" aria-label="اسم المستخدم الجديد"
              className="rounded-xl border border-white/12 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:border-gold/50 focus:outline-none"
            />
            <input
              value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              placeholder="البريد" aria-label="بريد المستخدم الجديد" dir="ltr" type="email"
              className="rounded-xl border border-white/12 bg-black/30 px-3 py-2 text-left text-xs text-white placeholder:text-white/30 focus:border-gold/50 focus:outline-none"
            />
            <select
              value={newUser.roleId} onChange={(e) => setNewUser({ ...newUser, roleId: e.target.value })}
              aria-label="دور المستخدم الجديد"
              className="cursor-pointer rounded-xl border border-white/12 bg-black/30 px-3 py-2 text-xs text-white focus:border-gold/50 focus:outline-none [&>option]:bg-surface"
            >
              {ALL_ROLES.map((r) => <option key={r} value={r}>{ROLE_NAMES_AR[r]}</option>)}
            </select>
            <button
              disabled={busy || !newUser.email.trim() || newUser.displayName.trim().length < 2}
              onClick={() => act(
                async () => {
                  const r = await apiPost<{ inviteNote: string }>("/api/admin/users", {
                    email: newUser.email.trim(), displayName: newUser.displayName.trim(), roleIds: [newUser.roleId],
                  });
                  setNewUser({ email: "", displayName: "", roleId: "support" });
                  setCreating(false);
                  return r;
                },
                /* الجملةُ كاملةٌ من الخادم: هو وحده يعرف أوصلت الدعوةُ أم لا */
                (res) => (res as { inviteNote?: string } | undefined)?.inviteNote ?? "أُنشئ الحساب.",
              )}
              className="cursor-pointer rounded-xl bg-gold px-5 py-2 text-xs font-black text-on-gold transition hover:bg-gold/90 disabled:opacity-40"
            >
              أنشئ
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-white/30" /></div>
      ) : rows.length === 0 ? (
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-20 text-center">
          <UsersIcon className="h-12 w-12 text-white/20" />
          <p className="mt-4 text-sm text-white/50">لا مستخدمون.</p>
        </div>
      ) : (
        <>
        <ListToolbar q={q} onQ={setQ} onPage={setPage} view={view} unit="حسابا"
          placeholder="ابحث باسمٍ أو بريدٍ أو دور…" />
        {view.total === 0 ? (
          <p className="rounded-3xl border border-white/10 bg-white/[0.02] py-16 text-center text-sm text-white/45">
            لا حساب يطابق «{q.trim()}».
          </p>
        ) : (
        <div className="space-y-3">
          {view.rows.map((u) => (
            <div key={u.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-black">{u.displayName || "—"} <span className="mr-2 text-[11px] font-normal text-white/40" dir="ltr">{u.email}</span></p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {u.roles.map((r) => (
                      <span key={r.id} className="rounded-full border border-teal/40 px-2.5 py-0.5 text-[10px] font-bold text-teal-light-ink">{r.nameAr}</span>
                    ))}
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${u.status === "active" ? "border-emerald-400/30 text-emerald-300" : "border-red-500/40 text-red-400"}`}>
                      {u.status === "active" ? "نشط" : u.status}
                    </span>
                    {/* من له استثناءٌ يُعرف من القائمة قبل فتحه */}
                    {u.grants > 0 && <span className="rounded-full border border-teal/40 px-2.5 py-0.5 text-[10px] font-bold text-teal-light-ink">+{u.grants} ممنوحة</span>}
                    {u.denies > 0 && <span className="rounded-full border border-red-400/40 px-2.5 py-0.5 text-[10px] font-bold text-red-300">−{u.denies} ممنوعة</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  {canManage && (
                    <button onClick={() => { setEditing(editing === u.id ? null : u.id); setRolePick(u.roles.map((r) => r.id)); }}
                      className="cursor-pointer rounded-full border border-white/15 px-4 py-1.5 text-xs font-bold text-white/65 hover:border-white/40">
                      الأدوار
                    </button>
                  )}
                  {canDelegate && (
                    <button onClick={() => void openPerms(u.id)}
                      className="flex cursor-pointer items-center gap-1.5 rounded-full border border-teal/40 px-4 py-1.5 text-xs font-bold text-teal-light-ink hover:bg-teal/10">
                      <KeyRound className="h-3.5 w-3.5" /> صلاحياته
                    </button>
                  )}
                  {canManage && u.status === "active" && (
                    <button disabled={busy}
                      onClick={() => act(() => apiPost(`/api/admin/users/${u.id}/suspend`), "أُوقف الحساب وأُبطلت جلساته فورا")}
                      className="flex cursor-pointer items-center gap-1.5 rounded-full border border-red-500/40 px-4 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/10 disabled:opacity-40">
                      <ShieldOff className="h-3.5 w-3.5" /> إيقاف
                    </button>
                  )}
                </div>
              </div>
              {permFor === u.id && (
                <div className="mt-4 rounded-2xl border border-teal/25 bg-black/25 p-4">
                  {!perms ? (
                    <div className="grid place-items-center py-8"><Loader2 className="h-6 w-6 animate-spin text-white/30" /></div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-black">صلاحيات {perms.user.displayName}</p>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-white/45">
                            الدور حزمةٌ، وهذا استثناءٌ لشخصه: منحٌ زائدٌ عليه، أو منعٌ ينزع منه وحده. والمنع أعلى من الدور والمنح معا.
                          </p>
                          {/* لا تفويضَ في العلوّ: من لا يعلو رتبةَ صاحبه لا يمسّ شيئا — ويُقال قبل المحاولة */}
                          {perms.rank.actor <= perms.rank.target && (
                            <p className="mt-2 rounded-xl border border-[#FABC05]/40 bg-[#FABC05]/10 px-3 py-2 text-[11px] font-bold leading-6 text-[#FABC05]">
                              لا تُدار إلّا صلاحياتُ من هو أقلّ منك رتبة — هذا الحساب في رتبتك أو فوقها.
                            </p>
                          )}
                        </div>
                        <div className="text-left">
                          <p className="text-[11px] text-white/45">صلاحيّاته الفعليّة</p>
                          <p className="text-lg font-black text-teal-light-ink">{perms.permissions.filter((p) => p.effective).length}</p>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                        <input value={permQuery} onChange={(e) => setPermQuery(e.target.value)}
                          placeholder="ابحث في الصلاحيات…" aria-label="ابحث في الصلاحيات"
                          className="w-full rounded-xl border border-white/12 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:border-teal focus:outline-none" />
                        <input value={permReason} onChange={(e) => setPermReason(e.target.value)}
                          placeholder="سبب الاستثناء — يُقيَّد باسمك ويُقرأ عند المراجعة" aria-label="سبب الاستثناء"
                          className="w-full rounded-xl border border-white/12 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:border-teal focus:outline-none" />
                      </div>

                      <div className="mt-3 max-h-96 space-y-4 overflow-y-auto pl-1">
                        {Object.entries(
                          perms.permissions
                            .filter((p) => !permQuery.trim()
                              || p.key.includes(permQuery.trim())
                              || p.description.includes(permQuery.trim()))
                            .reduce<Record<string, PermRow[]>>((acc, p) => {
                              const g = p.key.split(".")[0];
                              (acc[g] ??= []).push(p);
                              return acc;
                            }, {}),
                        ).map(([group, list]) => (
                          <div key={group}>
                            <p className="mb-1.5 text-[11px] font-black text-white/50">{GROUP_AR[group] ?? group}</p>
                            <div className="space-y-1.5">
                              {list.map((p) => (
                                <div key={p.key} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 ${
                                  p.effect === "deny" ? "border-red-400/35 bg-red-400/[0.05]"
                                    : p.effect === "grant" ? "border-teal/40 bg-teal/[0.06]"
                                    : p.fromRole ? "border-white/10 bg-white/[0.02]" : "border-white/[0.07]"
                                }`}>
                                  <div className="min-w-0">
                                    <p className={`text-xs font-bold ${p.effective ? "text-white/85" : "text-white/45 line-through"}`}>{p.description}</p>
                                    <p className="text-[10px] text-white/35" dir="ltr">{p.key}</p>
                                    {p.reason && <p className="mt-0.5 text-[10px] text-white/45">السبب: {p.reason}</p>}
                                  </div>
                                  <div className="flex shrink-0 items-center gap-1.5">
                                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                                      p.effect === "deny" ? "border-red-400/45 text-red-300"
                                        : p.effect === "grant" ? "border-teal/45 text-teal-light-ink"
                                        : p.fromRole ? "border-white/15 text-white/55" : "border-white/10 text-white/30"
                                    }`}>
                                      {p.effect === "deny" ? "مُنعت عنه" : p.effect === "grant" ? "مُنحت له" : p.fromRole ? "من دوره" : "خارج دوره"}
                                    </span>
                                    {!p.delegatable ? (
                                      <span className="max-w-[11rem] text-left text-[10px] leading-4 text-white/35">{p.refusal}</span>
                                    ) : p.effect ? (
                                      <button disabled={busy} onClick={() => void setPerm(u.id, p.key, "clear")}
                                        className="cursor-pointer rounded-full border border-white/15 px-3 py-1 text-[10px] font-bold text-white/60 hover:border-white/35 disabled:opacity-40">
                                        أزل الاستثناء
                                      </button>
                                    ) : p.fromRole ? (
                                      <button disabled={busy || permReason.trim().length < 5} onClick={() => void setPerm(u.id, p.key, "deny")}
                                        className="flex cursor-pointer items-center gap-1 rounded-full border border-red-400/40 px-3 py-1 text-[10px] font-bold text-red-300 hover:bg-red-400/10 disabled:opacity-40">
                                        <Minus className="h-3 w-3" /> امنعها
                                      </button>
                                    ) : (
                                      <button disabled={busy || permReason.trim().length < 5} onClick={() => void setPerm(u.id, p.key, "grant")}
                                        className="flex cursor-pointer items-center gap-1 rounded-full border border-teal/45 px-3 py-1 text-[10px] font-bold text-teal-light-ink hover:bg-teal/10 disabled:opacity-40">
                                        <Plus className="h-3 w-3" /> امنحها
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      <p className="mt-3 border-t border-white/8 pt-3 text-[11px] leading-relaxed text-white/45">
                        كلّ منحٍ ومنعٍ يُقيَّد في سجلّ التدقيق باسمك وسببه، وتُبطَل جلسات صاحبه فورا — فلا يعمل بصلاحيةٍ نُزعت ولا ينتظر ليعمل بما مُنح.
                      </p>
                    </>
                  )}
                </div>
              )}

              {editing === u.id && (
                <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="mb-2 text-[11px] font-bold text-white/50">تعيين الأدوار — يستبدل القائمة كاملة:</p>
                  <div className="flex flex-wrap gap-2">
                    {ALL_ROLES.map((r) => (
                      <button key={r} type="button"
                        onClick={() => setRolePick(rolePick.includes(r) ? rolePick.filter((x) => x !== r) : [...rolePick, r])}
                        className={`cursor-pointer rounded-full border px-3 py-1 text-[11px] font-bold transition ${rolePick.includes(r) ? "border-gold bg-gold/10 text-gold-ink" : "border-white/15 text-white/55 hover:border-white/40"}`}>
                        {ROLE_NAMES_AR[r]}
                      </button>
                    ))}
                  </div>
                  {/* نزعُ «متعلّم» يُغلق بوابة تعلّم صاحب الحساب — ولا يظهر أثره
                      إلّا عنده لا هنا. فيُقال قبل الحفظ لا بعد الشكوى. */}
                  {u.roles.some((r) => r.id === "learner") && !rolePick.includes("learner") && (
                    <p className="mt-3 flex items-start gap-2 rounded-xl border border-[#FABC05]/40 bg-[#FABC05]/10 px-3 py-2.5 text-[11px] font-bold leading-6 text-[#FABC05]">
                      <ShieldOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      بنزع «متعلّم» تُغلق بوابة التعلّم عن هذا الحساب: لا شعبه ولا نواتجه
                      ولا شهاداته. وما اشتراه يبقى محفوظا ويعود بإعادة الدور.
                    </p>
                  )}
                  <button disabled={busy || rolePick.length === 0}
                    onClick={() => act(() => apiPost(`/api/admin/users/${u.id}/roles`, { roleIds: rolePick }), "حُدثت الأدوار")}
                    className="mt-3 cursor-pointer rounded-full bg-gold px-5 py-1.5 text-xs font-black text-on-gold disabled:opacity-40">
                    احفظ الأدوار
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        )}
        </>
      )}
    </AdminLayout>
  );
}
