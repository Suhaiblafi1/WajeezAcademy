/* إدارة المستخدمين — API حقيقي: إنشاء، تعيين أدوار (يستبدل القائمة)، إيقاف
   ورفعُه، وحذفٌ نهائيّ — ولمدير النظام الأعلى محوُ حسابٍ بسجلّه (ديمو وتجربة).
   الحمايات من الخادم: لا سحب super_admin من نفسك ولا إيقاف ذاتي من هنا. */
import { useCallback, useEffect, useState } from "react";
import { toast, toastError } from "@/components/Toast";
import { Archive, BadgeCheck, KeyRound, Loader2, Minus, Plus, RefreshCw, Send, ServerOff, ShieldCheck, ShieldOff, Trash2, UserPlus, Users as UsersIcon } from "lucide-react";
import AdminLayout from "./AdminLayout";
import ListToolbar from "@/components/admin/ListToolbar";
import { matchesQuery } from "@/application/text/search-ar";
import { paginate } from "@/application/admin/paginate";
import { apiDelete, apiGet, apiPost, ApiError, permissionMessage } from "@/services/api";
import { fmtDateAr } from "@/utils/format";
import { useRealSession } from "@/services/session";
import EntityAuditTimeline from "@/components/EntityAuditTimeline";
import ConfirmAction from "@/components/ConfirmAction";

import { Panel, Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
const ROLE_NAMES_AR: Record<string, string> = {
  super_admin: "مدير النظام الأعلى", academic_manager: "المدير الأكاديمي",
  academic_coordinator: "منسّق أكاديميّ",
  diagnostic_manager: "مدير التشخيص", operations_manager: "مدير العمليات",
  advisor: "مستشار", trainer: "مدرب", finance: "المالية", support: "الدعم", learner: "متعلم",
  /* «متقدّم لعضوية التدريب» ليس في القائمة عمدا: حالةٌ يكتسبها صاحبُها
     بطلبه وينزعها القرارُ عليه، والخادمُ يرفض إسنادَها من هنا
     (`LIFECYCLE_ROLES`). واسمُها معروضٌ في بطاقة الحساب لا في أزرار التعيين. */
};
const ALL_ROLES = Object.keys(ROLE_NAMES_AR);

interface UserRow {
  id: string; email: string; displayName: string; status: string; createdAt: string;
  roles: { id: string; nameAr: string }[];
  grants: number; denies: number;
  /** حالُ دعوته: سارية، أو انتهت، أو لا دعوةَ له */
  invite: { state: "pending" | "expired" | "none"; expiresAt: string | null };
  emailVerified: boolean;
}

/** حالاتُ الحساب الأربع بالعربيّة ولونِها — «مدعوّ» ليس «نشطا» */
const STATUS_META: Record<string, { label: string; cls: string }> = {
  active: { label: "نشط", cls: "border-emerald-400/30 text-emerald-300" },
  invited: { label: "مدعوّ — لم يدخل بعد", cls: "border-gold/40 text-gold-ink" },
  suspended: { label: "موقوف", cls: "border-red-500/40 text-red-400" },
  archived: { label: "مؤرشَف", cls: "border-white/25 text-muted-foreground" },
};

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
  /* «خانةٌ منفصلة للحسابات الموقوفة» — قرارُ صاحب المنصّة. والفصلُ ليس
     تزيينا: الموقوفُ لا يُدار كالنشط، وأفعالُه ضدُّ أفعاله (رفعُ إيقافٍ
     وحذفٌ نهائيّ لا إيقافٌ وأدوار)، وخلطُهما في قائمةٍ واحدة يجعل زرَّ
     الإيقاف يقع بجوار حسابٍ موقوفٍ أصلا. */
  const [box, setBox] = useState<"active" | "invited" | "suspended" | "archived">("active");
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", displayName: "", roleId: "support" });
  const [bulk, setBulk] = useState("");
  const [busy, setBusy] = useState(false);
  /* ═══ نافذةٌ واحدةٌ لكلّ فعلٍ لا رجعةَ فيه ═══

     كانت الأرشفةُ تسأل سببَها بـ`window.prompt`، والحذفُ يطلب البريدَ
     بـ`prompt` آخر، ثمّ المحوُ بالسجلّ بـ`prompt` ثالثٍ يكتب قائمةَ ما
     سيُمحى بفواصلِ أسطر. وحوارُ المتصفّح يملك المستخدمُ كتمَه — فيصير
     الفعلُ لا يقع ولا يُقال له لماذا. */
  const [confirming, setConfirming] = useState<
    | { kind: "verifyEmail"; user: UserRow }
    | { kind: "archive"; user: UserRow }
    | { kind: "purge"; user: UserRow }
    | { kind: "purgeHistory"; user: UserRow; blockers: string[] }
    | null
  >(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [rolePick, setRolePick] = useState<string[]>([]);
  /* صلاحيات شخصٍ بعينه — لمدير النظام وحده */
  const { user: me } = useRealSession();
  /* الصلاحية لا الدور: الشاشة تُخفي ما لا يملكه، والخادم هو الحَكَم.
     وثلاثُ حبّات — الرؤية والإدارة والتفويض — لا حبّةٌ واحدة. */
  const can = (key: string) => me?.permissions.includes(key) ?? false;
  const canDelegate = can("admin.permissions.delegate");
  const canManage = can("admin.users.manage");
  const canPurge = can("admin.users.purge");
  /* المحوُ بالسجلّ حبّةٌ مستقلّة — بالصلاحية لا بالدور، فالشاشةُ لا تفحص
     أدوارا أبدا (يحرسه `src/tests/admin-permissions.test.ts`). */
  const canPurgeHistory = can("admin.users.purge_history");
  const [permFor, setPermFor] = useState<string | null>(null);
  const [perms, setPerms] = useState<PermView | null>(null);
  const [permReason, setPermReason] = useState("");
  const [permQuery, setPermQuery] = useState("");

  const openPerms = async (userId: string) => {
    if (permFor === userId) { setPermFor(null); setPerms(null); return; }
    setPermFor(userId); setPerms(null); setPermReason(""); setPermQuery("");
    try { setPerms(await apiGet<PermView>(`/api/admin/users/${userId}/permissions`)); }
    catch (e) { toastError(permissionMessage(e, "تعذّر جلب الصلاحيات")); setPermFor(null); }
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
    setBusy(true);
    try {
      const res = await fn() as { error?: { message_ar: string } } | undefined;
      if (res?.error) { toastError(res.error.message_ar); return; }
      toast(typeof doneMsg === "function" ? doneMsg(res) : doneMsg); await load();
    } catch (e) { toastError(e instanceof ApiError ? e.message : "فشل الإجراء"); }
    finally { setBusy(false); }
  };

  /* الحذفُ النهائيّ: بريدٌ يُكتب تأكيدا، ثمّ إن كان للحساب سجلٌّ عُرض
     السجلُّ بالعدد — ولمدير النظام الأعلى أن يمحوه معه بسببٍ يكتبه.
     الطلبُ الأوّل بلا قسر عمدا: الخادمُ هو من يقول ما للحساب من أثر. */
  /* الحذفُ خطوتان بطبيعته: الأولى تُجرَّب فيقول الخادمُ إن كان للحساب سجلّ،
     والثانيةُ محوٌ بالسجلّ بسببٍ مكتوب. وكلُّ خطوةٍ نافذتُها — ولا تُفتح
     الثانيةُ إلّا بجوابِ الخادم، فلا تُعرض قائمةُ محوٍ مختلَقة. */
  const purge = async (u: UserRow) => {
    setBusy(true);
    try {
      const first = await apiDelete(`/api/admin/users/${u.id}`) as
        { ok?: boolean; error?: { code: string; message_ar: string; blockers?: string[]; forceAllowed?: boolean } } | undefined;
      if (!first?.error) { toast("حُذف الحساب نهائيّا من القاعدة."); await load(); return; }
      if (first.error.code !== "has_history" || !first.error.forceAllowed) { toastError(first.error.message_ar); return; }
      setConfirming({ kind: "purgeHistory", user: u, blockers: first.error.blockers ?? [] });
    } catch (e) { toastError(e instanceof ApiError ? e.message : "فشل الحذف"); }
    finally { setBusy(false); }
  };

  const purgeWithHistory = async (u: UserRow, reason: string) => {
    setBusy(true);
    try {
      const res = await apiDelete(`/api/admin/users/${u.id}?force=1`, { reason }) as
        { ok?: boolean; error?: { message_ar: string } } | undefined;
      if (res?.error) { toastError(res.error.message_ar); return; }
      toast("مُحي الحساب بسجلّه كلّه — والأثرُ محفوظ.");
      await load();
    } catch (e) { toastError(e instanceof ApiError ? e.message : "فشل المحو"); }
    finally { setBusy(false); }
  };

  /* الترشيحُ ثمّ الترقيم: البحثُ يقع على الكلّ لا على الصفحة المعروضة —
     وإلّا لم يجد الباحثُ إلّا ما كان أمامه أصلا. */
  /* أربعُ خانات: من يعمل، ومن دُعي ولم يدخل، ومن أُوقف، ومن غادر.
     وخلطُ «مدعوّ» بـ«نشط» كان يجعل فريقا من ستّةٍ يبدو عاملا وهو لم يدخل. */
  const countOf = (st: string) => rows.filter((u) => u.status === st).length;
  const inBox = rows.filter((u) => (box === "active" ? u.status === "active" : u.status === box));
  const matched = inBox.filter((u) => matchesQuery(q, [u.displayName, u.email, ...u.roles.map((r) => r.nameAr)]));
  const view = paginate(matched, page, 20);

  if (offline) {
    return (
      <AdminLayout title="المستخدمون والأدوار">
        <Panel className="grid place-items-center py-20 text-center">
          <ServerOff className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 max-w-md text-sm text-muted-foreground">{offline}</p>
          <Button tone="secondary" onClick={() => void load()} className="mt-5">
            <RefreshCw className="h-3.5 w-3.5" /> إعادة المحاولة
          </Button>
        </Panel>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="المستخدمون والأدوار">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Button tone="secondary" onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" /> تحديث
        </Button>
        {/* إنشاءُ حسابٍ إداريّ — لم يكن له مسارٌ أصلا.

            والدورُ يُختار عند الإنشاء لا بعده: حسابٌ يُنشأ بلا دورٍ ثمّ
            يُنسى بلا دور يدخل ولا يجد شيئا، ويُقرأ ذلك عطبا لا نقصَ خطوة. */}
        {canManage && (
          <Button tone="primary" onClick={() => { setCreating(!creating);  }}>
            <UserPlus className="h-3.5 w-3.5" /> {creating ? "إلغاء" : "أنشئ حسابا"}
          </Button>
        )}
      </div>

      {creating && canManage && (
        <Card tone="warn" className="mb-5">
          <h3 className="text-sm font-black text-gold-ink">حسابٌ جديد بدوره</h3>
          <p className="mt-1 text-[11px] leading-6 text-muted-foreground">
            لا كلمةَ مرورٍ تُختار هنا: يصله بريدٌ يشرح دورَه وما يفتحه له، ويعيّن كلمتَه بنفسه من رابطٍ صالحٍ <b>سبعةَ أيّام</b>.
            ويبقى «مدعوّا» حتّى يدخل، فلا يُحسب فريقا عاملا قبل ذلك.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_12rem_auto]">
            <input
              value={newUser.displayName} onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
              placeholder="الاسم" aria-label="اسم المستخدم الجديد"
              className="rounded-xl border border-white/12 bg-paper/30 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/75 focus:border-gold/50 focus:outline-none"
            />
            <input
              value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              placeholder="البريد" aria-label="بريد المستخدم الجديد" dir="ltr" type="email"
              className="rounded-xl border border-white/12 bg-paper/30 px-3 py-2 text-left text-xs text-foreground placeholder:text-muted-foreground/75 focus:border-gold/50 focus:outline-none"
            />
            <select
              value={newUser.roleId} onChange={(e) => setNewUser({ ...newUser, roleId: e.target.value })}
              aria-label="دور المستخدم الجديد"
              className="cursor-pointer rounded-xl border border-white/12 bg-paper/30 px-3 py-2 text-xs text-foreground focus:border-gold/50 focus:outline-none [&>option]:bg-surface"
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

          {/* دفعةٌ واحدةٌ لفريقٍ كامل — سطرٌ لكلّ شخص «بريد, اسم».
              تأهيلُ ستّةٍ كان ستَّ رحلاتٍ في النموذج نفسِه. */}
          <details className="mt-4 border-t border-white/10 pt-3">
            <summary className="cursor-pointer text-[11px] font-bold text-gold-ink">أو ادعُ فريقا كاملا بدفعةٍ واحدة</summary>
            <p className="mt-2 text-[11px] leading-6 text-muted-foreground">
              سطرٌ لكلّ شخص: <span dir="ltr" className="font-mono">name@example.com, الاسم الكامل</span> — بالدور المختار أعلاه.
              وما يفشل من الأسطر يُقال وحدَه، فلا تتوقّف الدفعةُ عند أوّل خطأ.
            </p>
            <textarea
              value={bulk} onChange={(e) => setBulk(e.target.value)} rows={4}
              aria-label="أسطرُ الدعوة بالدفعة"
              placeholder={"sara@example.com, سارة العامري\nomar@example.com, عمر الشمري"}
              className="mt-2 w-full rounded-xl border border-white/12 bg-paper/30 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/75 focus:border-gold/50 focus:outline-none"
            />
            <button
              disabled={busy || bulk.trim() === ""}
              onClick={() => act(async () => {
                /* النتيجةُ تُبنى من جواب الخادم وتُعاد لـ`act` — لا تُضبط هنا،
                   فـ`act` يضبط اللافتةَ بعدها فيمحو ما قبلها. */
                const parsed = bulk.split("\n").map((line) => {
                  const [email, ...rest] = line.split(",");
                  return { email: (email ?? "").trim(), displayName: rest.join(",").trim() };
                }).filter((r) => r.email !== "" && r.displayName !== "");
                if (parsed.length === 0) throw new ApiError("bad_rows", "لا سطرَ صالحا — الصيغة «بريد, اسم»", 400);
                const r = await apiPost<{ created: number; sent: number; failed: number; results: { email: string; ok: boolean; reasonAr?: string }[] }>(
                  "/api/admin/users/bulk-invite", { roleIds: [newUser.roleId], rows: parsed },
                );
                setBulk("");
                return r;
              }, (res) => {
                const r = res as { created: number; sent: number; failed: number; results: { email: string; ok: boolean; reasonAr?: string }[] };
                const failures = r.results.filter((x) => !x.ok).map((x) => `${x.email}: ${x.reasonAr ?? "تعذّر"}`);
                return `أُنشئ ${r.created} حسابا · وصلت ${r.sent} دعوة${r.failed ? ` · تعذّر ${r.failed}: ${failures.join(" · ")}` : ""}`;
              })}
              className="mt-2 cursor-pointer rounded-xl border border-gold/45 px-5 py-2 text-xs font-black text-gold-ink transition hover:bg-gold/10 disabled:opacity-40"
            >
              ادعُ الدفعة
            </button>
          </details>
        </Card>
      )}

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" /></div>
      ) : rows.length === 0 ? (
        <Panel className="grid place-items-center py-20 text-center">
          <UsersIcon className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-sm text-muted-foreground">لا مستخدمون.</p>
        </Panel>
      ) : (
        <>
        <div className="mb-3 flex flex-wrap rounded-full border border-white/15 p-1">
          {([
            ["active", `النشطة (${countOf("active")})`],
            ["invited", `المدعوّة (${countOf("invited")})`],
            ["suspended", `الموقوفة (${countOf("suspended")})`],
            ["archived", `المؤرشَفة (${countOf("archived")})`],
          ] as const).map(([k, label]) => (
            <button key={k} onClick={() => { setBox(k); setQ(""); setPage(1); setEditing(null); setPermFor(null); }}
              className={`cursor-pointer rounded-full px-4 py-1.5 text-xs font-black transition ${box === k ? "bg-gold text-on-gold" : "text-muted-foreground hover:text-foreground"}`}>
              {label}
            </button>
          ))}
        </div>
        <ListToolbar q={q} onQ={setQ} onPage={setPage} view={view} unit="حسابا"
          placeholder="ابحث باسمٍ أو بريدٍ أو دور…" />
        {view.total === 0 ? (
          <p className="rounded-3xl border border-white/10 bg-white/[0.02] py-16 text-center text-sm text-muted-foreground">
            {q.trim() ? `لا حساب يطابق «${q.trim()}».` : `لا حسابات في هذه الخانة.`}
          </p>
        ) : (
        <div className="space-y-3">
          {view.rows.map((u) => (
            <Card key={u.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-black">{u.displayName || "—"} <span className="mr-2 text-[11px] font-normal text-muted-foreground" dir="ltr">{u.email}</span></p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {u.roles.map((r) => (
                      <span key={r.id} className="rounded-full border border-teal/40 px-2.5 py-0.5 text-micro font-bold text-teal-light-ink">{r.nameAr}</span>
                    ))}
                    <span className={`rounded-full border px-2.5 py-0.5 text-micro font-bold ${(STATUS_META[u.status] ?? STATUS_META.suspended).cls}`}>
                      {(STATUS_META[u.status] ?? { label: u.status }).label}
                    </span>
                    {u.invite.state === "pending" && (
                      <span className="rounded-full border border-teal/40 px-2.5 py-0.5 text-micro font-bold text-teal-light-ink">
                        دعوةٌ سارية حتّى {fmtDateAr(u.invite.expiresAt)}
                      </span>
                    )}
                    {u.invite.state === "expired" && (
                      <span className="rounded-full border border-gold/40 px-2.5 py-0.5 text-micro font-bold text-gold-ink">دعوةٌ انتهت</span>
                    )}
                    {/* بلا توثيقٍ لا تُصدر شهادة — فالشارةُ تقول سببَ التوقّف
                        قبل أن يُفتح الحساب، ولا تُذكر لمن وثّق. */}
                    {!u.emailVerified && (
                      <span className="rounded-full border border-gold/40 px-2.5 py-0.5 text-micro font-bold text-gold-ink">بريدٌ غيرُ موثَّق</span>
                    )}
                    {/* من له استثناءٌ يُعرف من القائمة قبل فتحه */}
                    {u.grants > 0 && <span className="rounded-full border border-teal/40 px-2.5 py-0.5 text-micro font-bold text-teal-light-ink">+{u.grants} ممنوحة</span>}
                    {u.denies > 0 && <span className="rounded-full border border-red-400/40 px-2.5 py-0.5 text-micro font-bold text-red-300">−{u.denies} ممنوعة</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  {canManage && (
                    <Button tone="secondary" size="sm" onClick={() => { setEditing(editing === u.id ? null : u.id); setRolePick(u.roles.map((r) => r.id)); }}>
                      الأدوار
                    </Button>
                  )}
                  {canDelegate && (
                    <Button tone="confirm" size="sm" onClick={() => void openPerms(u.id)} className="text-teal-light-ink">
                      <KeyRound className="h-3.5 w-3.5" /> صلاحياته
                    </Button>
                  )}
                  {/* توثيقُ البريد بيد: لا يُعرض إلّا لمن لم يوثّق — وزرٌّ
                      يظهر لمن لا يحتاجه ضجيجٌ في صفٍّ مزدحم. */}
                  {canManage && !u.emailVerified && u.status !== "archived" && (
                    <Button tone="primary" size="sm" disabled={busy}
                      onClick={() => setConfirming({ kind: "verifyEmail", user: u })} className="text-gold-ink">
                      <BadgeCheck className="h-3.5 w-3.5" /> وثّق بريده
                    </Button>
                  )}
                  {canManage && u.status === "active" && (
                    <Button tone="danger" size="sm" disabled={busy}
                      onClick={() => act(() => apiPost(`/api/admin/users/${u.id}/suspend`), "أُوقف الحساب وأُبطلت جلساته فورا")}>
                      <ShieldOff className="h-3.5 w-3.5" /> إيقاف
                    </Button>
                  )}
                  {/* إعادةُ الدعوة: لمن لم يدخل بعد، أو من انتهت دعوتُه.
                      وحين لا بريدَ يُعاد الرابطُ في الرسالة ليُسلَّم بيد. */}
                  {canManage && (u.status === "invited" || u.invite.state === "expired") && (
                    <Button tone="primary" size="sm" disabled={busy}
                      onClick={() => act(
                        () => apiPost<{ sent: boolean; note: string; link?: string }>(`/api/admin/users/${u.id}/resend-invite`, {}),
                        /* الجملةُ من الخادم: هو وحده يعرف أوصلت أم لا، ويعيد
                           الرابطَ لتسليمه بيدٍ حين لا بريد */
                        (res) => {
                          const r = res as { note?: string; link?: string } | undefined;
                          return r?.link ? `${r.note} الرابط: ${r.link}` : (r?.note ?? "أُصدرت دعوةٌ جديدة.");
                        },
                      )} className="text-gold-ink">
                      <Send className="h-3.5 w-3.5" /> أعد إرسال الدعوة
                    </Button>
                  )}
                  {canManage && u.status !== "archived" && (
                    <Button tone="secondary" size="sm" disabled={busy}
                      onClick={() => setConfirming({ kind: "archive", user: u })}>
                      <Archive className="h-3.5 w-3.5" /> أرشفة
                    </Button>
                  )}
                  {canManage && u.status === "archived" && (
                    <Button tone="secondary" size="sm" disabled={busy}
                      onClick={() => act(() => apiPost(`/api/admin/users/${u.id}/unarchive`), "أُعيد تنشيطُ الحساب")}>
                      <ShieldCheck className="h-3.5 w-3.5" /> أعد التنشيط
                    </Button>
                  )}
                  {canManage && u.status === "suspended" && (
                    <Button tone="secondary" size="sm" disabled={busy}
                      onClick={() => act(() => apiPost(`/api/admin/users/${u.id}/reinstate`), "رُفع الإيقاف — الحساب نشطٌ ويدخل من جديد")}>
                      <ShieldCheck className="h-3.5 w-3.5" /> ارفع الإيقاف
                    </Button>
                  )}
                  {/* الحذفُ النهائيّ لا رجعةَ فيه، فيُستأذن ويُكتب البريدُ تأكيدا.
                      في خانة الموقوفة لكلّ من يملك الحبّة؛ وفي خانة النشطة
                      لمدير النظام الأعلى وحده — فمن ينظّف حساباتَ الديمو لا
                      يوقف تسعةً ثمّ يحذف تسعة. */}
                  {canPurge && (u.status === "suspended" || u.status === "archived" || canPurgeHistory) && (
                    <Button tone="danger" size="sm" disabled={busy}
                      onClick={() => setConfirming({ kind: "purge", user: u })} className="bg-red-500/10">
                      <Trash2 className="h-3.5 w-3.5" /> احذف نهائيّا
                    </Button>
                  )}
                </div>
              </div>
              {permFor === u.id && (
                <Card className="mt-4 border-teal/25 bg-paper/25">
                  {!perms ? (
                    <div className="grid place-items-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" /></div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-black">صلاحيات {perms.user.displayName}</p>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
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
                          <p className="text-[11px] text-muted-foreground">صلاحيّاته الفعليّة</p>
                          <p className="text-lg font-black text-teal-light-ink">{perms.permissions.filter((p) => p.effective).length}</p>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                        <input value={permQuery} onChange={(e) => setPermQuery(e.target.value)}
                          placeholder="ابحث في الصلاحيات…" aria-label="ابحث في الصلاحيات"
                          className="w-full rounded-xl border border-white/12 bg-paper/30 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/75 focus:border-teal focus:outline-none" />
                        <input value={permReason} onChange={(e) => setPermReason(e.target.value)}
                          placeholder="سبب الاستثناء — يُقيَّد باسمك ويُقرأ عند المراجعة" aria-label="سبب الاستثناء"
                          className="w-full rounded-xl border border-white/12 bg-paper/30 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/75 focus:border-teal focus:outline-none" />
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
                            <p className="mb-1.5 text-[11px] font-black text-muted-foreground">{GROUP_AR[group] ?? group}</p>
                            <div className="space-y-1.5">
                              {list.map((p) => (
                                <div key={p.key} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 ${
                                  p.effect === "deny" ? "border-red-400/35 bg-red-400/[0.05]"
                                    : p.effect === "grant" ? "border-teal/40 bg-teal/[0.06]"
                                    : p.fromRole ? "border-white/10 bg-white/[0.02]" : "border-white/[0.07]"
                                }`}>
                                  <div className="min-w-0">
                                    <p className={`text-xs font-bold ${p.effective ? "text-foreground" : "text-muted-foreground line-through"}`}>{p.description}</p>
                                    <p className="text-micro text-muted-foreground" dir="ltr">{p.key}</p>
                                    {p.reason && <p className="mt-0.5 text-micro text-muted-foreground">السبب: {p.reason}</p>}
                                  </div>
                                  <div className="flex shrink-0 items-center gap-1.5">
                                    <span className={`rounded-full border px-2.5 py-0.5 text-micro font-bold ${
                                      p.effect === "deny" ? "border-red-400/45 text-red-300"
                                        : p.effect === "grant" ? "border-teal/45 text-teal-light-ink"
                                        : p.fromRole ? "border-white/15 text-muted-foreground" : "border-white/10 text-muted-foreground/50"
                                    }`}>
                                      {p.effect === "deny" ? "مُنعت عنه" : p.effect === "grant" ? "مُنحت له" : p.fromRole ? "من دوره" : "خارج دوره"}
                                    </span>
                                    {!p.delegatable ? (
                                      <span className="max-w-[11rem] text-left text-micro leading-4 text-muted-foreground">{p.refusal}</span>
                                    ) : p.effect ? (
                                      <Button tone="secondary" size="sm" disabled={busy} onClick={() => void setPerm(u.id, p.key, "clear")} className="text-micro">
                                        أزل الاستثناء
                                      </Button>
                                    ) : p.fromRole ? (
                                      <Button tone="danger" size="sm" disabled={busy || permReason.trim().length < 5} onClick={() => void setPerm(u.id, p.key, "deny")} className="text-micro">
                                        <Minus className="h-3 w-3" /> امنعها
                                      </Button>
                                    ) : (
                                      <Button tone="confirm" size="sm" disabled={busy || permReason.trim().length < 5} onClick={() => void setPerm(u.id, p.key, "grant")} className="text-micro text-teal-light-ink">
                                        <Plus className="h-3 w-3" /> امنحها
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      <p className="mt-3 border-t border-white/8 pt-3 text-[11px] leading-relaxed text-muted-foreground">
                        كلّ منحٍ ومنعٍ يُقيَّد في سجلّ التدقيق باسمك وسببه، وتُبطَل جلسات صاحبه فورا — فلا يعمل بصلاحيةٍ نُزعت ولا ينتظر ليعمل بما مُنح.
                      </p>
                    </>
                  )}
                </Card>
              )}

              {/* أثرُ الحساب: من أنشأه، ومن أوقفه ولماذا، ومن منحه صلاحيّةً
                  ومتى. وكان ذلك كلُّه في السجلّ العامّ وحده. */}
              <EntityAuditTimeline entityType="user" entityId={u.id} labelAr="أثرُ هذا الحساب" />

              {editing === u.id && (
                <Inset className="mt-4">
                  <p className="mb-2 text-[11px] font-bold text-muted-foreground">تعيين الأدوار — يستبدل القائمة كاملة:</p>
                  <div className="flex flex-wrap gap-2">
                    {ALL_ROLES.map((r) => (
                      <button key={r} type="button"
                        onClick={() => setRolePick(rolePick.includes(r) ? rolePick.filter((x) => x !== r) : [...rolePick, r])}
                        className={`cursor-pointer rounded-full border px-3 py-1 text-[11px] font-bold transition ${rolePick.includes(r) ? "border-gold bg-gold/10 text-gold-ink" : "border-white/15 text-muted-foreground hover:border-white/40"}`}>
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
                  <Button tone="primary" size="sm" disabled={busy || rolePick.length === 0}
                    onClick={() => act(() => apiPost(`/api/admin/users/${u.id}/roles`, { roleIds: rolePick }), "حُدثت الأدوار")} className="mt-3">
                    احفظ الأدوار
                  </Button>
                </Inset>
              )}
            </Card>
          ))}
        </div>
        )}
        </>
      )}

      {confirming?.kind === "verifyEmail" && (
        <ConfirmAction
          titleAr={`توثيقُ بريد «${confirming.user.displayName}» بيدك`}
          confirmLabelAr="وثّق البريد"
          busy={busy}
          tone="default"
          reason={{ labelAr: "لماذا تُوثّقه بيدك؟ — يقرؤه من يراجع السجلّ بعد سنة", minLength: 5 }}
          onCancel={() => setConfirming(null)}
          onConfirm={(reason) => {
            const target = confirming.user;
            setConfirming(null);
            void act(
              () => apiPost<{ message_ar: string }>(`/api/admin/users/${target.id}/verify-email`, { reason }),
              (r) => (r as { message_ar: string }).message_ar,
            );
          }}
        >
          <p><b className="text-foreground">ما يفتحه هذا:</b> إصدارُ الشهادات. الشهادةُ تُنسب إلى شخصٍ باسمه، فلا تُصدَر لبريدٍ لم يُثبت أنّه له — وهذا الحاجزُ يبقى صارما حتّى مع تعطّل قناة البريد.</p>
          <p>والشراءُ وطلبُ التسجيل لا يحتاجان هذا: هما يمرّان أصلا حين لا تكون قناةُ البريد موصولة، فالحاجزُ لا يصير قفلا بلا مفتاح.</p>
          <p><span dir="ltr" className="font-mono text-muted-foreground">{confirming.user.email}</span></p>
          <p>ويُسجَّل في أثر الحساب: من وثّق، ومتى، وبأيّ سبب.</p>
        </ConfirmAction>
      )}

      {confirming?.kind === "archive" && (
        <ConfirmAction
          titleAr={`أرشفةُ حساب «${confirming.user.displayName}»`}
          confirmLabelAr="أرشِف الحساب"
          busy={busy}
          tone="default"
          reason={{ labelAr: "سببُ الأرشفة — يقرؤه من يراجع السجلّ بعد سنة", minLength: 10 }}
          onCancel={() => setConfirming(null)}
          onConfirm={(reason) => {
            const target = confirming.user;
            setConfirming(null);
            void act(() => apiPost(`/api/admin/users/${target.id}/archive`, { reason }),
              "أُرشف الحساب — أُغلق وأُبطلت جلساتُه، وسجلّاتُه كما هي");
          }}
        >
          <p><b className="text-foreground">الأرشفةُ ليست حذفا:</b> الحسابُ يبقى بسجلّه كلِّه — تسجيلاتُه وفواتيرُه وشهاداتُه — ولا يعود يدخل، وتُبطَل جلساتُه ودعواتُه القائمةُ فورا.</p>
          <p>وتُراجَع بإعادة التنشيط من تبويب «مؤرشَفون» متى شئت.</p>
        </ConfirmAction>
      )}

      {confirming?.kind === "purge" && (
        <ConfirmAction
          titleAr={`حذفُ حساب «${confirming.user.displayName}» نهائيّا`}
          confirmLabelAr="احذف نهائيّا"
          busy={busy}
          typing={{ expected: confirming.user.email, labelAr: "اكتب بريدَ الحساب حرفا بحرف لتأكيد القصد" }}
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            const target = confirming.user;
            setConfirming(null);
            void purge(target);
          }}
        >
          <p>الحذفُ النهائيُّ <b className="text-foreground">لا رجعةَ فيه</b>: يُزال الصفُّ من القاعدة.</p>
          <p className="font-mono text-muted-foreground" dir="ltr">{confirming.user.email}</p>
          <p>وإن كان للحساب سجلٌّ (تسجيلٌ أو طلبٌ أو فاتورة) فسيرفض الخادمُ الحذفَ ويقول ما فيه — ولك بعدها خيارُ المحو بالسجلّ. والأرشفةُ هي الفعلُ الموصى به لمن غادر.</p>
        </ConfirmAction>
      )}

      {confirming?.kind === "purgeHistory" && (
        <ConfirmAction
          titleAr={`محوُ حساب «${confirming.user.displayName}» بسجلّه كلّه`}
          confirmLabelAr="امحُ الحسابَ وسجلَّه"
          busy={busy}
          reason={{ labelAr: "سببُ المحو — يبقى في الأثر بعد زوال الحساب", minLength: 5 }}
          onCancel={() => setConfirming(null)}
          onConfirm={(reason) => {
            const target = confirming.user;
            setConfirming(null);
            void purgeWithHistory(target, reason ?? "");
          }}
        >
          <p>لهذا الحساب سجلٌّ <b className="text-foreground">سيُمحى معه</b>:</p>
          <ul className="space-y-1 pr-4">
            {confirming.blockers.map((b) => <li key={b} className="list-disc">{b}</li>)}
          </ul>
          <p>محوٌ كاملٌ لا يُستعاد — يصلح لحسابات الديمو والتجربة، <b className="text-foreground">لا لعميلٍ حقيقيّ</b>. وأثرُ المحو نفسُه يبقى في السجلّ بسببه وصاحبه.</p>
        </ConfirmAction>
      )}
    </AdminLayout>
  );
}
