/* إدارة الإشعارات — API حقيقي: قوالب (upsert بمتغيرات {{key}})، سجل الإرسال
   بترشيح الحالة، وإعادة محاولة الفاشل (حد ثلاث محاولات من الخادم). */
import { useCallback, useEffect, useState } from "react";
import { toast, toastError } from "@/components/Toast";
import { Bell, Loader2, RefreshCw, Save, Send, ServerOff } from "lucide-react";
import AdminLayout from "./AdminLayout";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { fmtDateTime } from "@/application/text/format-ar";

const inputCls = "rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/25 focus:border-teal focus:outline-none";

const CHANNEL_AR: Record<string, string> = { in_app: "داخلي", email: "بريد", sms: "رسالة نصية", whatsapp: "واتساب" };
const LOG_STATUS_AR: Record<string, string> = { queued: "بالطابور", sent: "أُرسل", delivered: "سُلم", read: "قُرئ", failed: "فشل" };

interface Template { id: string; key: string; channel: string; titleAr: string; bodyAr: string; active: boolean }
interface LogRow {
  id: string; channel: string; status: string; titleRendered?: string | null; lastError: string | null;
  attempts: number; queuedAt: string; user: { displayName: string; email: string };
}

export default function Notifications() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [log, setLog] = useState<LogRow[]>([]);
  const [logFilter, setLogFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ key: "", channel: "in_app", titleAr: "", bodyAr: "", active: true });

  const load = useCallback(async () => {
    setLoading(true); setOffline(null);
    try {
      const [t, l] = await Promise.all([
        apiGet<Template[]>("/api/admin/notification-templates"),
        apiGet<LogRow[]>(`/api/admin/notifications-log${logFilter ? `?status=${logFilter}` : ""}`),
      ]);
      setTemplates(t); setLog(l);
    } catch (e) { setOffline(e instanceof ApiError ? e.message : "الخادم غير متصل"); }
    finally { setLoading(false); }
  }, [logFilter]);

  useEffect(() => { void load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, doneMsg: string) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); toast(doneMsg); await load(); }
    catch (e) { toastError(e instanceof ApiError ? e.message : "فشل الإجراء"); }
    finally { setBusy(false); }
  };

  if (offline) {
    return (
      <AdminLayout title="الإشعارات">
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
    <AdminLayout title="الإشعارات — القوالب والسجل">

      <div className="grid gap-5 lg:grid-cols-2">
        {/* قالب جديد / تحديث */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
          <h3 className="flex items-center gap-2 text-sm font-black"><Bell className="h-4 w-4 text-gold-ink" /> قالب جديد أو تحديث — متغيرات {"{{key}}"}</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="المفتاح — enrollment.approved" dir="ltr" className={`${inputCls} font-mono`} />
            <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} className={`${inputCls} [&>option]:bg-surface`}>
              {Object.entries(CHANNEL_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input value={form.titleAr} onChange={(e) => setForm({ ...form, titleAr: e.target.value })} placeholder="العنوان" className={`${inputCls} sm:col-span-2`} />
            <textarea value={form.bodyAr} onChange={(e) => setForm({ ...form, bodyAr: e.target.value })} rows={3} placeholder="النص — مرحبا {{name}}…" className={`${inputCls} sm:col-span-2`} />
          </div>
          <label className="mt-2 flex cursor-pointer items-center gap-1.5 text-[11px] text-white/60">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="accent-teal" />
            قالب فعال
          </label>
          <button disabled={busy || form.key.length < 2 || !form.titleAr || !form.bodyAr}
            onClick={() => act(async () => {
              await apiPost("/api/admin/notification-templates", form);
              setForm({ key: "", channel: "in_app", titleAr: "", bodyAr: "", active: true });
            }, "حُفظ القالب (upsert بالمفتاح والقناة)")}
            className="mt-3 flex cursor-pointer items-center gap-1.5 rounded-full bg-gold px-5 py-2 text-xs font-black text-on-gold disabled:opacity-40">
            <Save className="h-3.5 w-3.5" /> حفظ القالب
          </button>

          <ul className="mt-4 space-y-2">
            {templates.map((t) => (
              <li key={t.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs">
                <p className="flex items-center gap-2 font-bold">
                  <span dir="ltr" className="font-mono text-white/50">{t.key}</span>
                  <span className="rounded-full border border-teal/40 px-2 py-0.5 text-[10px] text-teal-light-ink">{CHANNEL_AR[t.channel] ?? t.channel}</span>
                  {!t.active && <span className="rounded-full border border-red-500/40 px-2 py-0.5 text-[10px] text-red-400">معطل</span>}
                </p>
                <p className="mt-1 text-white/65">{t.titleAr}</p>
                <p className="mt-0.5 line-clamp-1 text-white/40">{t.bodyAr}</p>
              </li>
            ))}
            {templates.length === 0 && !loading && <p className="text-xs text-white/45">لا قوالب بعد.</p>}
          </ul>
        </section>

        {/* سجل الإرسال */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-black"><Send className="h-4 w-4 text-gold-ink" /> سجل الإرسال</h3>
            <select value={logFilter} onChange={(e) => setLogFilter(e.target.value)} aria-label="رشّح بالحالة"
              className={`${inputCls} [&>option]:bg-surface`}>
              <option value="">كل الحالات</option>
              {Object.entries(LOG_STATUS_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {loading ? (
            <div className="grid place-items-center py-12"><Loader2 className="h-6 w-6 animate-spin text-white/30" /></div>
          ) : (
            <ul className="mt-3 max-h-[32rem] space-y-2 overflow-y-auto">
              {log.map((n) => (
                <li key={n.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold">{n.user.displayName} <span className="font-normal text-white/40">{CHANNEL_AR[n.channel] ?? n.channel}</span></p>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${n.status === "failed" ? "border-red-500/40 text-red-400" : "border-emerald-400/30 text-emerald-300"}`}>
                      {LOG_STATUS_AR[n.status] ?? n.status}
                    </span>
                  </div>
                  {n.lastError && <p className="mt-1 text-[10px] text-red-300">{n.lastError}</p>}
                  <p className="mt-1 text-[10px] text-white/40">{n.attempts} محاولة · {fmtDateTime(new Date(n.queuedAt))}</p>
                  {n.status === "failed" && (
                    <button disabled={busy}
                      onClick={() => act(() => apiPost(`/api/admin/notifications/${n.id}/retry`), "أُعيدت المحاولة")}
                      className="mt-2 flex cursor-pointer items-center gap-1 rounded-full border border-gold/40 px-3 py-1 text-[10px] font-bold text-gold-ink disabled:opacity-40">
                      <RefreshCw className="h-3 w-3" /> إعادة المحاولة
                    </button>
                  )}
                </li>
              ))}
              {log.length === 0 && <p className="text-xs text-white/45">السجل فارغ بهذه الحالة.</p>}
            </ul>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
