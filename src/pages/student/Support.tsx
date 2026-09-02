/* دعم الطالب — API حقيقي: فتح تذكرة برسالة أولى، تذاكري بخيوطها (الداخلية مخفية)،
   رد، وإعادة فتح للمحلولة/المغلقة. */
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ChevronRight, LifeBuoy, Loader2, Plus, RefreshCw, Send } from "lucide-react";
import PortalLayout from "./PortalLayout";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { fmtWhen } from "@/utils/format";

const STATUS_AR: Record<string, string> = {
  open: "مفتوحة", in_progress: "قيد المعالجة", waiting_customer: "بانتظار ردك",
  resolved: "محلولة", closed: "مغلقة", reopened: "أُعيد فتحها",
};

interface Ticket {
  id: string; subject: string; category: string; status: string; priority: string; updatedAt: string;
  messages: { id: string; authorId: string; body: string; internal: boolean; createdAt: string }[];
}

const inputCls = "w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-teal focus:outline-none";

export default function StudentSupport() {
  const [rows, setRows] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState("");
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ subject: "", category: "other", body: "" });
  const [reply, setReply] = useState("");
  const [reopenFor, setReopenFor] = useState<string | null>(null);
  const [reopenNote, setReopenNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setRows(await apiGet<Ticket[]>("/api/learner/support/tickets")); }
    catch (e) { setError(e instanceof ApiError ? e.message : "تعذر تحميل التذاكر"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, doneMsg: string) => {
    if (busy) return;
    setBusy(true); setFlash("");
    try { await fn(); setFlash(doneMsg); await load(); }
    catch (e) { setFlash(e instanceof ApiError ? e.message : "فشل الإجراء"); }
    finally { setBusy(false); }
  };

  const open = rows.find((t) => t.id === openId) ?? null;

  return (
    <PortalLayout title="الدعم الفني">
      {flash && <p className="mb-4 flex items-center gap-2 rounded-xl border border-teal/40 bg-teal/10 px-4 py-3 text-sm font-bold text-teal-light-ink" role="status"><CheckCircle2 className="h-4 w-4" /> {flash}</p>}
      {error && <p className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}

      {/* فتح تذكرة */}
      <div className="mb-6 rounded-3xl border border-white/10 bg-white/[0.02] p-5">
        <button onClick={() => setCreateOpen(!createOpen)} className="flex w-full cursor-pointer items-center justify-between text-sm font-black">
          <span className="flex items-center gap-2"><Plus className="h-4 w-4 text-teal-ink" /> تذكرة جديدة</span>
          <ChevronRight className={`h-4 w-4 transition ${createOpen ? "rotate-90" : ""}`} />
        </button>
        {createOpen && (
          <div className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="الموضوع" className={inputCls} />
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={`${inputCls} [&>option]:bg-surface`}>
                <option value="billing">الفواتير والدفع</option>
                <option value="learning">المحتوى والجلسات</option>
                <option value="technical">مشكلة تقنية</option>
                <option value="other">أخرى</option>
              </select>
            </div>
            <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={3} placeholder="اشرح المشكلة بالتفصيل…" className={inputCls} />
            <button disabled={busy || form.subject.trim().length < 3 || form.body.trim().length < 3}
              onClick={() => act(async () => {
                await apiPost("/api/learner/support/tickets", form);
                setForm({ subject: "", category: "other", body: "" });
                setCreateOpen(false);
              }, "فُتحت التذكرة — يرد عليك فريق الدعم هنا")}
              className="cursor-pointer rounded-full bg-teal px-6 py-2.5 text-xs font-black text-on-teal transition hover:bg-teal-light disabled:opacity-40">
              إرسال التذكرة
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-8 w-8 animate-spin text-teal-ink" /></div>
      ) : rows.length === 0 ? (
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-16 text-center">
          <LifeBuoy className="h-12 w-12 text-white/20" />
          <p className="mt-4 text-sm text-white/50">لا تذاكر — افتح أول تذكرة من الأعلى وسنرد عليك في نفس الخيط.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((t) => (
            <div key={t.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <button onClick={() => setOpenId(openId === t.id ? null : t.id)} className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-3 text-right">
                <div>
                  <p className="font-black">{t.subject}</p>
                  <p className="mt-1 text-xs text-white/50">{t.messages.length} رسالة · آخر تحديث {fmtWhen(t.updatedAt)}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${t.status === "resolved" || t.status === "closed" ? "border-white/15 text-white/50" : "border-teal/40 text-teal-light-ink"}`}>
                  {STATUS_AR[t.status] ?? t.status}
                </span>
              </button>

              {open?.id === t.id && (
                <div className="mt-4 border-t border-white/8 pt-4">
                  <ol className="space-y-2.5">
                    {t.messages.map((m) => (
                      <li key={m.id} className="rounded-xl border border-white/8 bg-black/20 p-3 text-xs leading-6 text-white/75">
                        {m.body}
                        <span className="mt-1 block text-[10px] text-white/35">{fmtWhen(m.createdAt)}</span>
                      </li>
                    ))}
                  </ol>
                  {!["closed"].includes(t.status) && (
                    <div className="mt-3 flex gap-2">
                      <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="اكتب ردا…" className={`${inputCls} flex-1`} />
                      <button disabled={busy || !reply.trim()}
                        onClick={() => act(async () => { await apiPost(`/api/learner/support/tickets/${t.id}/reply`, { body: reply }); setReply(""); }, "أُرسل ردك")}
                        className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-teal px-4 py-2 text-xs font-black text-on-teal disabled:opacity-40">
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  {["resolved", "closed"].includes(t.status) && (
                    reopenFor === t.id ? (
                      <div className="mt-3 flex gap-2">
                        <input
                          value={reopenNote}
                          onChange={(e) => setReopenNote(e.target.value)}
                          placeholder="لماذا تعيد فتح التذكرة؟ (٣ أحرف على الأقل)"
                          className={`${inputCls} flex-1`}
                        />
                        <button disabled={busy || reopenNote.trim().length < 3}
                          onClick={() => act(async () => {
                            await apiPost(`/api/learner/support/tickets/${t.id}/reopen`, { note: reopenNote.trim() });
                            setReopenFor(null); setReopenNote("");
                          }, "أُعيد فتح التذكرة")}
                          className="cursor-pointer rounded-xl bg-gold px-4 py-2 text-xs font-black text-on-gold disabled:opacity-40">
                          تأكيد
                        </button>
                        <button disabled={busy}
                          onClick={() => { setReopenFor(null); setReopenNote(""); }}
                          className="cursor-pointer rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-white/60 hover:text-white disabled:opacity-40">
                          إلغاء
                        </button>
                      </div>
                    ) : (
                      <button disabled={busy}
                        onClick={() => { setReopenFor(t.id); setReopenNote(""); }}
                        className="mt-3 cursor-pointer rounded-full border border-gold/40 px-4 py-1.5 text-xs font-bold text-gold-ink hover:bg-gold/10 disabled:opacity-40">
                        إعادة فتح التذكرة
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <button onClick={() => void load()} className="mt-6 flex cursor-pointer items-center gap-1.5 text-xs text-white/50 hover:text-white">
        <RefreshCw className="h-3.5 w-3.5" /> تحديث
      </button>
    </PortalLayout>
  );
}
