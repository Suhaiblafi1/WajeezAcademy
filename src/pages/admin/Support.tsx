/* الدعم الفني للإدارة — API حقيقي: قائمة، تفاصيل ورسائل، رد (عام/داخلي)،
   تحويل حالة، أولوية، إسناد لوكيل. الرسائل الداخلية مخفية عن العميل. */
import { useCallback, useEffect, useState } from "react";
import { toast, toastError } from "@/components/Toast";
import {
  ChevronRight, EyeOff, LifeBuoy, Loader2, RefreshCw, Send, ServerOff, UserPlus,
} from "lucide-react";
import AdminLayout from "./AdminLayout";
import ListToolbar from "@/components/admin/ListToolbar";
import { matchesQuery } from "@/application/text/search-ar";
import { paginate } from "@/application/admin/paginate";
import FlowSteps from "@/components/FlowSteps";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { useAutoRefresh } from "@/services/useAutoRefresh";
import { fmtDateTime } from "@/application/text/format-ar";

const STATUS_AR: Record<string, string> = {
  open: "مفتوحة", in_progress: "قيد المعالجة", waiting_customer: "بانتظار العميل",
  resolved: "محلولة", closed: "مغلقة", reopened: "أُعيد فتحها",
};
const PRIORITY_AR: Record<string, string> = { low: "منخفضة", normal: "عادية", high: "عالية", urgent: "عاجلة" };

interface TicketRow {
  id: string; subject: string; category: string; status: string; priority: string; updatedAt: string;
  user: { displayName: string; email: string };
  assignments: { agentId: string }[];
  _count: { messages: number };
}
interface TicketDetail extends TicketRow {
  messages: { id: string; authorId: string; body: string; internal: boolean; createdAt: string }[];
  statusHistory: { fromStatus: string | null; toStatus: string; createdAt: string }[];
}

const inputCls = "rounded-xl border border-white/15 bg-paper/30 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/75 focus:border-teal focus:outline-none";

export default function Support() {
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [agentId, setAgentId] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); setOffline(null); }
    try { setRows(await apiGet<TicketRow[]>(`/api/admin/support/tickets${statusFilter ? `?status=${statusFilter}` : ""}`)); }
    catch (e) { if (!silent) setOffline(e instanceof ApiError ? e.message : "الخادم غير متصل"); }
    finally { if (!silent) setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { void load(); }, [load]);
  /* نبض صامت كل دقيقة — تذاكر جديدة تظهر دون تحديث يدوي، وانقطاع عابر لا يقلب الصفحة */
  const silentReload = useCallback(() => { void load(true); }, [load]);
  useAutoRefresh(silentReload, 60_000);

  const openDetail = async (id: string) => {
    try { setDetail(await apiGet<TicketDetail>(`/api/admin/support/tickets/${id}`)); setReply(""); setInternal(false); }
    catch (e) { toastError(e instanceof ApiError ? e.message : "تعذر فتح التذكرة"); }
  };

  const act = async (fn: () => Promise<unknown>, doneMsg: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn(); toast(doneMsg);
      if (detail) await openDetail(detail.id);
      await load();
    } catch (e) { toastError(e instanceof ApiError ? e.message : "فشل الإجراء"); }
    finally { setBusy(false); }
  };

  /* الحالةُ تُرشَّح في الخادم، والبحثُ هنا على ما وصل — والاثنان يتراكبان */
  const matched = rows.filter((t) => matchesQuery(q, [t.subject, t.category, t.user.displayName, t.user.email]));
  const view = paginate(matched, page, 20);

  if (offline) {
    return (
      <AdminLayout title="الدعم الفني">
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-20 text-center">
          <ServerOff className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 max-w-md text-sm text-muted-foreground">{offline}</p>
          <button onClick={() => void load()} className="mt-5 flex cursor-pointer items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-xs font-bold text-foreground hover:border-white/40">
            <RefreshCw className="h-3.5 w-3.5" /> إعادة المحاولة
          </button>
        </div>
      </AdminLayout>
    );
  }

  /* ── تفاصيل تذكرة ── */
  if (detail) {
    const t = detail;
    return (
      <AdminLayout title={`تذكرة: ${t.subject}`}>
        <button onClick={() => setDetail(null)} className="mb-4 flex cursor-pointer items-center gap-1.5 text-xs font-bold text-teal-light-ink hover:text-teal-ink">
          <ChevronRight className="h-4 w-4" /> كل التذاكر
        </button>

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-black">{t.subject}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{t.user.displayName} · <span dir="ltr">{t.user.email}</span> · {t.category}</p>
                </div>
                <div className="flex gap-2">
                  <span className="rounded-full border border-teal/40 px-3 py-1 text-[11px] font-bold text-teal-light-ink">{STATUS_AR[t.status] ?? t.status}</span>
                  <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${t.priority === "urgent" || t.priority === "high" ? "border-red-500/40 text-red-400" : "border-white/15 text-muted-foreground"}`}>{PRIORITY_AR[t.priority] ?? t.priority}</span>
                </div>
              </div>
              <ol className="mt-5 space-y-3">
                {t.messages.map((m) => (
                  <li key={m.id} className={`rounded-2xl border p-3 text-xs leading-6 ${m.internal ? "border-gold/30 bg-gold/5" : "border-white/10 bg-paper/20"}`}>
                    <p className="mb-1 flex items-center gap-2 text-micro font-bold text-muted-foreground">
                      {fmtDateTime(new Date(m.createdAt))}
                      {m.internal && <span className="flex items-center gap-1 text-gold-ink"><EyeOff className="h-3 w-3" /> داخلية — لا يراها العميل</span>}
                    </p>
                    {m.body}
                  </li>
                ))}
              </ol>
              <div className="mt-4 border-t border-white/8 pt-4">
                <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder="اكتب ردا…" className={`${inputCls} w-full`} />
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
                    <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="accent-gold" />
                    رد داخلي (مخفي عن العميل)
                  </label>
                  <button disabled={busy || !reply.trim()}
                    onClick={() => act(() => apiPost(`/api/admin/support/tickets/${t.id}/reply`, { body: reply, internal }), "أُرسل الرد")}
                    className="flex cursor-pointer items-center gap-1.5 rounded-full bg-teal px-5 py-2 text-xs font-black text-on-teal hover:bg-teal-light disabled:opacity-40">
                    <Send className="h-3.5 w-3.5" /> إرسال
                  </button>
                </div>
              </div>
            </article>
          </div>

          <div className="space-y-4">
            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <h4 className="text-sm font-black">تحويل الحالة</h4>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {Object.entries(STATUS_AR).filter(([k]) => k !== t.status).map(([k, v]) => (
                  <button key={k} disabled={busy}
                    onClick={() => act(() => apiPost(`/api/admin/support/tickets/${t.id}/transition`, { to: k }), `الحالة الآن: ${v}`)}
                    className="cursor-pointer rounded-xl border border-white/15 px-3 py-2 text-[11px] font-bold text-muted-foreground hover:border-teal/50 hover:text-teal-light-ink disabled:opacity-40">
                    {v}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-micro text-muted-foreground">الخادم يرفض الانتقالات غير المشروعة برسالة مفهومة.</p>
            </article>

            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <h4 className="text-sm font-black">الأولوية</h4>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(PRIORITY_AR).map(([k, v]) => (
                  <button key={k} disabled={busy || t.priority === k}
                    onClick={() => act(() => apiPost(`/api/admin/support/tickets/${t.id}/priority`, { priority: k }), `الأولوية: ${v}`)}
                    className={`cursor-pointer rounded-full border px-3 py-1 text-[11px] font-bold transition disabled:opacity-40 ${t.priority === k ? "border-gold bg-gold/10 text-gold-ink" : "border-white/15 text-muted-foreground hover:border-white/40"}`}>
                    {v}
                  </button>
                ))}
              </div>
            </article>

            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <h4 className="flex items-center gap-2 text-sm font-black"><UserPlus className="h-4 w-4 text-teal-light-ink" /> إسناد لوكيل دعم</h4>
              <div className="mt-3 flex gap-2">
                <input value={agentId} onChange={(e) => setAgentId(e.target.value)} placeholder="معرف الوكيل (UUID)" dir="ltr" className={`${inputCls} flex-1 font-mono`} />
                <button disabled={busy || !agentId.trim()}
                  onClick={() => act(() => apiPost(`/api/admin/support/tickets/${t.id}/assign`, { agentId: agentId.trim() }), "أُسندت التذكرة")}
                  className="cursor-pointer rounded-full bg-teal px-4 py-2 text-xs font-black text-on-teal disabled:opacity-40">
                  إسناد
                </button>
              </div>
              <p className="mt-2 text-micro text-muted-foreground">الوكيلون بدور «support» من صفحة المستخدمين.</p>
            </article>

            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <h4 className="text-sm font-black">سجل الحالات</h4>
              <ol className="mt-3 space-y-1.5">
                {t.statusHistory.map((h, i) => (
                  <li key={i} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal" />
                    <b className="text-foreground">{STATUS_AR[h.toStatus] ?? h.toStatus}</b>
                    <span className="mr-auto text-muted-foreground/50">{fmtDateTime(new Date(h.createdAt))}</span>
                  </li>
                ))}
              </ol>
            </article>
          </div>
        </div>
      </AdminLayout>
    );
  }

  /* ── القائمة ── */
  return (
    <AdminLayout title="الدعم الفني — التذاكر">
      <FlowSteps steps={[
        { label: "تذكرة مفتوحة", actor: "العميل" },
        { label: "قيد المعالجة", actor: "أنت هنا" },
        { label: "بانتظار العميل", actor: "العميل يرد" },
        { label: "محلولة ثم مغلقة", actor: "أنت — ويُبلَّغ العميل" },
      ]} />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="رشّح بالحالة"
          className="rounded-xl border border-white/15 bg-paper/30 px-3 py-2 text-xs text-foreground [&>option]:bg-surface">
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={() => void load()} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-muted-foreground hover:border-white/40">
          <RefreshCw className="h-3.5 w-3.5" /> تحديث
        </button>
      </div>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" /></div>
      ) : rows.length === 0 ? (
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-20 text-center">
          <LifeBuoy className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-sm text-muted-foreground">لا تذاكر بهذه الحالة — تذاكر المتعلمين تصل هنا فور فتحها من بوابتهم.</p>
        </div>
      ) : (
        <>
        <ListToolbar q={q} onQ={setQ} onPage={setPage} view={view} unit="تذكرة"
          placeholder="ابحث بعنوانٍ أو صاحبِ تذكرةٍ أو تصنيف…" />
        {view.total === 0 ? (
          <p className="rounded-3xl border border-white/10 bg-white/[0.02] py-16 text-center text-sm text-muted-foreground">
            لا تذكرة تطابق «{q.trim()}».
          </p>
        ) : (
        <div className="space-y-3">
          {view.rows.map((t) => (
            <button key={t.id} onClick={() => void openDetail(t.id)}
              className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-right transition hover:border-teal/40">
              <div>
                <p className="font-black">{t.subject}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.user.displayName} · {t._count.messages} رسالة · {t.assignments.length ? "مسندة" : "غير مسندة"} · {fmtDateTime(new Date(t.updatedAt))}
                </p>
              </div>
              <div className="flex gap-2">
                <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${t.priority === "urgent" || t.priority === "high" ? "border-red-500/40 text-red-400" : "border-white/15 text-muted-foreground"}`}>{PRIORITY_AR[t.priority] ?? t.priority}</span>
                <span className="rounded-full border border-teal/40 px-3 py-1 text-[11px] font-bold text-teal-light-ink">{STATUS_AR[t.status] ?? t.status}</span>
              </div>
            </button>
          ))}
        </div>
        )}
        </>
      )}
    </AdminLayout>
  );
}
