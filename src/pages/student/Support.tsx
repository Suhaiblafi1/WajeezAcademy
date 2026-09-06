/* دعم الطالب — API حقيقي: فتح تذكرة برسالة أولى، تذاكري بخيوطها (الداخلية مخفية)،
   رد، وإعادة فتح للمحلولة/المغلقة. */
import { useCallback, useEffect, useState } from "react";
import { ChevronRight, LifeBuoy, Loader2, Plus, RefreshCw, Send } from "lucide-react";
import PortalLayout from "./PortalLayout";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { fmtWhen } from "@/utils/format";
import { toast, toastError } from '@/components/Toast';
import { FieldError, invalidProps } from "@/components/FormKit";

import { Panel, Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
const STATUS_AR: Record<string, string> = {
  open: "مفتوحة", in_progress: "قيد المعالجة", waiting_customer: "بانتظار ردك",
  resolved: "محلولة", closed: "مغلقة", reopened: "أُعيد فتحها",
};

interface Ticket {
  id: string; subject: string; category: string; status: string; priority: string; updatedAt: string;
  messages: { id: string; authorId: string; body: string; internal: boolean; createdAt: string }[];
}

const inputCls = "w-full rounded-xl border border-white/15 bg-paper/30 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/75 focus:border-teal focus:outline-none";

export default function StudentSupport() {
  const [rows, setRows] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ subject: "", category: "other", body: "" });
  const [reply, setReply] = useState("");
  const [reopenFor, setReopenFor] = useState<string | null>(null);
  const [reopenNote, setReopenNote] = useState("");
  /* ═══ التحقّقُ عند الحقل، بعد أوّل لمسةٍ لا قبلها ═══

     كان الزرُّ يُغلَق بلا سبب: من كتب موضوعا بحرفَين يجد «إرسال التذكرة»
     باهتا ولا شيءَ يقول له لماذا. فيظنّ العطبَ في المنصّة لا في مُدخَله.

     والرسالةُ لا تظهر قبل أن يلمس الحقلَ: لومٌ على حقلٍ فارغٍ لم يُكتب فيه
     بعد ليس إرشادا. */
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const errors = {
    subject: form.subject.trim().length === 0
      ? "اكتب موضوعا يُعرَف به طلبُك"
      : form.subject.trim().length < 3 ? "الموضوعُ قصيرٌ — ثلاثةُ أحرفٍ فأكثر" : null,
    body: form.body.trim().length === 0
      ? "اشرح المشكلة كي يفهمها من يقرؤها"
      : form.body.trim().length < 3 ? "الشرحُ قصيرٌ جدّا — أضف تفصيلا يُعين على الفهم" : null,
  };
  const showError = (k: keyof typeof errors) => (touched[k] ? errors[k] : null);
  const formReady = !errors.subject && !errors.body;

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setRows(await apiGet<Ticket[]>("/api/learner/support/tickets")); }
    catch (e) { setError(e instanceof ApiError ? e.message : "تعذر تحميل التذاكر"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, doneMsg: string) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); toast(doneMsg); await load(); }
    catch (e) { toastError(e instanceof ApiError ? e.message : "فشل الإجراء"); }
    finally { setBusy(false); }
  };

  const open = rows.find((t) => t.id === openId) ?? null;

  return (
    <PortalLayout title="الدعم الفني">
      {error && <p className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}

      {/* فتح تذكرة */}
      <Panel className="mb-6">
        <button onClick={() => setCreateOpen(!createOpen)} className="flex w-full cursor-pointer items-center justify-between text-sm font-black">
          <span className="flex items-center gap-2"><Plus className="h-4 w-4 text-teal-ink" /> تذكرة جديدة</span>
          <ChevronRight className={`h-4 w-4 transition ${createOpen ? "rotate-90" : ""}`} />
        </button>
        {createOpen && (
          <div className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="sr-only" htmlFor="ticket-subject">موضوعُ التذكرة</label>
                <input
                  id="ticket-subject"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  onBlur={() => setTouched((t) => ({ ...t, subject: true }))}
                  placeholder="الموضوع"
                  className={`${inputCls} ${showError("subject") ? "border-red-400/60" : ""}`}
                  {...invalidProps("ticket-subject-error", showError("subject"))}
                />
                <FieldError id="ticket-subject-error">{showError("subject")}</FieldError>
              </div>
              <div>
                <label className="sr-only" htmlFor="ticket-category">تصنيفُ التذكرة</label>
                <select id="ticket-category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={`${inputCls} [&>option]:bg-surface`}>
                  <option value="billing">الفواتير والدفع</option>
                  <option value="learning">المحتوى والجلسات</option>
                  <option value="technical">مشكلة تقنية</option>
                  <option value="other">أخرى</option>
                </select>
              </div>
            </div>
            <div>
              <label className="sr-only" htmlFor="ticket-body">شرحُ المشكلة</label>
              <textarea
                id="ticket-body"
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                onBlur={() => setTouched((t) => ({ ...t, body: true }))}
                rows={3}
                placeholder="اشرح المشكلة بالتفصيل…"
                className={`${inputCls} ${showError("body") ? "border-red-400/60" : ""}`}
                {...invalidProps("ticket-body-error", showError("body"))}
              />
              <FieldError id="ticket-body-error">{showError("body")}</FieldError>
            </div>
            {/* الزرُّ لا يُغلَق بلا سبب: يُضغَط فيُظهر ما ينقص عند حقله */}
            <Button tone="confirm" disabled={busy}
              onClick={!formReady
                ? () => setTouched({ subject: true, body: true })
                : () => act(async () => {
                  await apiPost("/api/learner/support/tickets", form);
                  setForm({ subject: "", category: "other", body: "" });
                  setTouched({});
                  setCreateOpen(false);
                }, "فُتحت التذكرة — يرد عليك فريق الدعم هنا")}>
              إرسال التذكرة
            </Button>
          </div>
        )}
      </Panel>

      {loading ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-8 w-8 animate-spin text-teal-ink" /></div>
      ) : rows.length === 0 ? (
        <Panel className="grid place-items-center py-16 text-center">
          <LifeBuoy className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-sm text-muted-foreground">لا تذاكر — افتح أول تذكرة من الأعلى وسنرد عليك في نفس الخيط.</p>
        </Panel>
      ) : (
        <div className="space-y-3">
          {rows.map((t) => (
            <Card key={t.id}>
              <button onClick={() => setOpenId(openId === t.id ? null : t.id)} className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-3 text-right">
                <div>
                  <p className="font-black">{t.subject}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t.messages.length} رسالة · آخر تحديث {fmtWhen(t.updatedAt)}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-micro font-bold ${t.status === "resolved" || t.status === "closed" ? "border-white/15 text-muted-foreground" : "border-teal/40 text-teal-light-ink"}`}>
                  {STATUS_AR[t.status] ?? t.status}
                </span>
              </button>

              {open?.id === t.id && (
                <div className="mt-4 border-t border-white/8 pt-4">
                  <ol className="space-y-2.5">
                    {t.messages.map((m) => (
                      <Inset as="li" key={m.id} className="text-xs leading-6 text-foreground">
                        {m.body}
                        <span className="mt-1 block text-micro text-muted-foreground">{fmtWhen(m.createdAt)}</span>
                      </Inset>
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
                          className="cursor-pointer rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-muted-foreground hover:text-foreground disabled:opacity-40">
                          إلغاء
                        </button>
                      </div>
                    ) : (
                      <Button tone="primary" size="sm" disabled={busy}
                        onClick={() => { setReopenFor(t.id); setReopenNote(""); }} className="mt-3 text-gold-ink">
                        إعادة فتح التذكرة
                      </Button>
                    )
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <button onClick={() => void load()} className="mt-6 flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <RefreshCw className="h-3.5 w-3.5" /> تحديث
      </button>
    </PortalLayout>
  );
}
