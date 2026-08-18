import { useMemo, useState } from "react";
import { Bell, CheckCircle2, RefreshCw, Save } from "lucide-react";
import AdminLayout from "./AdminLayout";
import {
  loadNotificationLog, loadTemplates, retryNotification, upsertTemplate,
  type NotificationTemplate,
} from "@/data/admin-extras";

const LOG_CLS = {
  sent: "bg-emerald-500/15 text-emerald-300",
  failed: "bg-red-500/15 text-red-300",
  queued: "bg-[#FABC05]/15 text-[#FABC05]",
} as const;
const LOG_LABEL = { sent: "أُرسل", failed: "فشل", queued: "بالطابور" } as const;

/** الإشعارات — قوالب بمتغيرات {{key}} وسجل إرسال وإعادة محاولة بحد ثلاث (يوافق notifications.routes) */
export default function AdminNotifications() {
  const [tick, setTick] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const state = useMemo(() => { void tick; return { templates: loadTemplates(), log: loadNotificationLog() }; }, [tick]);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<NotificationTemplate | null>(null);
  const [logFilter, setLogFilter] = useState<"all" | "sent" | "failed" | "queued">("all");

  const bump = (msg: string) => { setNote(msg); setTick(tick + 1); };

  const startEdit = (t: NotificationTemplate) => { setEditId(t.id); setDraft({ ...t }); };
  const startNew = () => {
    const id = `NT-${Date.now()}`;
    setEditId(id);
    setDraft({ id, name: "", channel: "بريد", body: "", updatedAt: "" });
  };
  const saveDraft = () => {
    if (!draft?.name.trim() || !draft.body.trim()) return;
    upsertTemplate({ ...draft, name: draft.name.trim(), updatedAt: new Date().toISOString().slice(0, 10) });
    setEditId(null); setDraft(null);
    bump("حُفظ القالب — إنشاء أو تحديث بمتغيرات {{key}} كما يعالجها الخادم عند الإرسال.");
  };

  const retry = (id: string) => {
    const ok = retryNotification(id);
    bump(ok ? `أُعيدت محاولة ${id} ونجح الإرسال.` : `تجاوز ${id} حد المحاولات الثلاث — يتطلب مراجعة يدوية كما يفرض الخادم.`);
  };

  const shownLog = logFilter === "all" ? state.log : state.log.filter((e) => e.status === logFilter);

  return (
    <AdminLayout title="الإشعارات — القوالب وسجل الإرسال">
      {note && (
        <p className="mb-5 flex items-center gap-2 rounded-2xl border border-[#38A7B4]/40 bg-[#38A7B4]/10 px-4 py-3 text-sm font-bold text-[#6EC7D1]">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {note}
        </p>
      )}

      {/* القوالب */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-black"><Bell className="h-5 w-5 text-[#FABC05]" /> قوالب الإشعارات</h2>
        <button onClick={startNew}
          className="cursor-pointer rounded-full bg-[#FABC05] px-4 py-2 text-xs font-black text-[#0D0D0D] hover:bg-[#FABC05]/90">
          قالب جديد
        </button>
      </div>
      <div className="space-y-4">
        {state.templates.map((t) => (
          <div key={t.id} className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
            {editId === t.id && draft ? (
              <div className="space-y-3">
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="اسم القالب"
                  className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm font-bold text-white focus:border-[#38A7B4] focus:outline-none" />
                <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={3} placeholder="نص الرسالة — استخدم {{name}} و{{cohort}}…"
                  className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#38A7B4] focus:outline-none" />
                <div className="flex gap-2">
                  <button onClick={saveDraft}
                    className="flex cursor-pointer items-center gap-1.5 rounded-full bg-[#38A7B4] px-4 py-2 text-xs font-black text-[#08272B] hover:bg-[#6EC7D1]">
                    <Save className="h-3.5 w-3.5" /> احفظ
                  </button>
                  <button onClick={() => { setEditId(null); setDraft(null); }}
                    className="cursor-pointer rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-white/55 hover:text-white">إلغاء</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-black">{t.name}</p>
                    <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[10px] font-bold text-white/50">{t.channel}</span>
                  </div>
                  <p className="mt-1.5 text-sm leading-6 text-white/65">{t.body}</p>
                  <p className="mt-1 text-[10px] text-white/55">آخر تحديث: {t.updatedAt}</p>
                </div>
                <button onClick={() => startEdit(t)}
                  className="cursor-pointer rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-white/55 transition hover:border-[#38A7B4]/50 hover:text-[#6EC7D1]">
                  عدّل
                </button>
              </div>
            )}
          </div>
        ))}
        {editId && draft && !state.templates.some((t) => t.id === editId) && (
          <div className="rounded-3xl border border-[#FABC05]/30 bg-[#FABC05]/[0.04] p-5">
            <div className="space-y-3">
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="اسم القالب الجديد"
                className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm font-bold text-white placeholder:text-white/30 focus:border-[#38A7B4] focus:outline-none" />
              <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={3} placeholder="نص الرسالة — استخدم {{name}} و{{cohort}}…"
                className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#38A7B4] focus:outline-none" />
              <div className="flex gap-2">
                <button onClick={saveDraft}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full bg-[#38A7B4] px-4 py-2 text-xs font-black text-[#08272B] hover:bg-[#6EC7D1]">
                  <Save className="h-3.5 w-3.5" /> احفظ القالب
                </button>
                <button onClick={() => { setEditId(null); setDraft(null); }}
                  className="cursor-pointer rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-white/55 hover:text-white">إلغاء</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* سجل الإرسال */}
      <div className="mt-10 mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-black">سجل الإرسال</h2>
        <div className="flex gap-1.5">
          {(["all", "sent", "failed", "queued"] as const).map((s) => (
            <button key={s} onClick={() => setLogFilter(s)}
              className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                logFilter === s ? "bg-[#FABC05] text-[#0D0D0D]" : "bg-white/[0.04] text-white/50 hover:text-white"
              }`}>
              {s === "all" ? "الكل" : LOG_LABEL[s]}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {shownLog.map((e) => (
          <div key={e.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-4">
            <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${LOG_CLS[e.status]}`}>{LOG_LABEL[e.status]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{e.template}</p>
              <p className="mt-0.5 text-[11px] text-white/45">إلى <span dir="ltr">{e.to}</span> · {e.at} · المحاولات: {e.attempts} / 3</p>
            </div>
            {e.status === "failed" && (
              <button onClick={() => retry(e.id)}
                className="flex cursor-pointer items-center gap-1.5 rounded-full border border-[#38A7B4]/40 px-4 py-2 text-xs font-black text-[#6EC7D1] transition hover:bg-[#38A7B4]/10">
                <RefreshCw className="h-3.5 w-3.5" /> أعد المحاولة
              </button>
            )}
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}
