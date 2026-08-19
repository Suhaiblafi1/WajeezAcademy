import { useCallback, useEffect, useState } from "react";
import {
  CalendarClock, CheckCircle2, ChevronLeft, ClipboardList, Loader2, MessageSquarePlus,
  PhoneCall, Send, ServerOff, StickyNote, UserRound,
} from "lucide-react";
import AdvisorLayout from "./AdvisorLayout";
import FlowSteps from "@/components/FlowSteps";
import { apiGet, apiPost, ApiError } from "@/services/api";

const STATUS_LABELS: Record<string, string> = {
  new: "جديدة", contacted: "تم التواصل", needs_review: "تحتاج مراجعة", follow_up: "متابعة",
  recommended: "أوصينا بمسار", enrolled: "سجّل", not_interested: "غير مهتم", closed: "مغلقة",
};
const CHANNEL_LABELS: Record<string, string> = { whatsapp: "واتساب", email: "بريد", phone: "اتصال", in_app: "داخل المنصة" };

interface CaseRow {
  id: string; status: string; nextAction: string | null; nextFollowUpAt: string | null;
  createdAt: string; updatedAt: string; diagnosticSnapshot: unknown;
  lead: { fullName: string; email: string; phone: string | null; source: string } | null;
  client: { displayName: string; email: string } | null;
  followUps: { id: string; scheduledAt: string; channel: string; note: string | null }[];
}

/* طرف الحالة — عميل محتمل (lead) أو حساب مسجل (client)؛ كلاهما قد يغيب */
function partyOf(c: { lead: CaseRow["lead"]; client: CaseRow["client"] }) {
  return {
    name: c.lead?.fullName ?? c.client?.displayName ?? "عميل بلا اسم",
    email: c.lead?.email ?? c.client?.email ?? "",
    phone: c.lead?.phone ?? null,
    source: c.lead?.source ?? null,
  };
}

interface CaseDetail extends CaseRow {
  client: (CaseRow["client"] & {
    learnerProfile: { diagnosticSnapshot: unknown; attachedAt: string | null } | null;
    cvSubmissions: { id: string; originalName: string; mime: string; sizeBytes: number; createdAt: string }[];
  }) | null;
  notes: { id: string; body: string; createdAt: string }[];
  tasks: { id: string; title: string; status: string; dueAt: string | null; doneAt: string | null; createdAt: string }[];
  followUps: { id: string; scheduledAt: string; channel: string; note: string | null; doneAt: string | null; outcome: string | null }[];
  contactEvents: { id: string; channel: string; direction: string; summary: string; createdAt: string }[];
}

const INPUT = "w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-[#38A7B4] focus:outline-none";
const LBL = "mb-1 block text-[11px] font-bold text-white/60";

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/* لقطة التشخيص: نستخرج أبرز مسار وثقة مهما كان شكل الحفظ */
function snapshotSummary(snap: unknown): string {
  if (!snap || typeof snap !== "object") return "لا لقطة تشخيص";
  const s = snap as Record<string, unknown>;
  const top = s.top ?? (s.result as Record<string, unknown> | undefined)?.top;
  const conf = s.confidence ?? (s.result as Record<string, unknown> | undefined)?.confidence;
  const topId = typeof top === "string" ? top : (top as Record<string, unknown> | undefined)?.pathwayId ?? (top as Record<string, unknown> | undefined)?.id;
  return [topId ? `أبرز مسار: ${String(topId)}` : null, typeof conf === "number" ? `ثقة ${Math.round(conf * 100)}٪` : null]
    .filter(Boolean).join(" · ") || "لقطة محفوظة";
}

/** حالات المستشار الحقيقية — كل الإجراءات محروسة بالإسناد في الخادم */
export default function AdvisorCases() {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState<string | null>(null);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [flash, setFlash] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setOffline(null);
    try {
      setCases(await apiGet<CaseRow[]>(`/api/advisor/cases${statusFilter ? `?status=${statusFilter}` : ""}`));
    } catch (err) {
      setOffline(err instanceof ApiError ? err.message : "الخادم غير متصل — هذه الصفحة تتطلب جلسة مستشار حقيقية عبر API");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { void load(); }, [load]);

  const openCase = async (id: string) => {
    setFlash("");
    try {
      setDetail(await apiGet<CaseDetail>(`/api/advisor/cases/${id}`));
    } catch (err) {
      setFlash(err instanceof ApiError ? err.message : "تعذر فتح الحالة");
    }
  };

  /* إجراء عام — يعيد تحميل التفاصيل والقائمة */
  const act = async (fn: () => Promise<unknown>, okMsg: string) => {
    try {
      await fn();
      setFlash(okMsg);
      if (detail) await openCase(detail.id);
      await load();
    } catch (err) {
      setFlash(err instanceof ApiError ? err.message : "تعذر تنفيذ الإجراء");
    }
  };

  if (offline) {
    return (
      <AdvisorLayout title="حالاتي — عملاء التشخيص">
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-20 text-center">
          <ServerOff className="h-12 w-12 text-white/20" />
          <h2 className="mt-4 text-xl font-black">لا يمكن الوصول للبيانات</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-white/55">{offline}</p>
        </div>
      </AdvisorLayout>
    );
  }

  /* ══ عرض ملف الحالة ══ */
  if (detail) {
    return (
      <AdvisorLayout title={`ملف الحالة — ${partyOf(detail).name}`}>
        <button onClick={() => setDetail(null)} className="mb-4 flex cursor-pointer items-center gap-1 text-xs text-white/55 hover:text-white">
          <ChevronLeft className="h-4 w-4" /> عودة للقائمة
        </button>
        {flash && <p role="status" className="mb-4 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs font-bold text-white/80">{flash}</p>}

        <div className="grid gap-5 lg:grid-cols-3">
          {/* العميل والتشخيص */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-[#6EC7D1]"><UserRound className="h-4 w-4" /> العميل</h2>
            <p className="font-black">{partyOf(detail).name}</p>
            {partyOf(detail).email && <p className="mt-1 text-xs text-white/55" dir="ltr">{partyOf(detail).email}</p>}
            {partyOf(detail).phone && <p className="text-xs text-white/55" dir="ltr">{partyOf(detail).phone}</p>}
            <p className="mt-2 text-[11px] text-white/50">المصدر: {partyOf(detail).source === "diagnostic" ? "التشخيص الذكي" : partyOf(detail).source ?? "حساب مسجل"}</p>
            <p className="mt-3 rounded-xl bg-white/[0.04] p-3 text-xs leading-6 text-white/70">
              {snapshotSummary(detail.client?.learnerProfile?.diagnosticSnapshot ?? detail.diagnosticSnapshot)}
            </p>
            {(detail.client?.cvSubmissions ?? []).length > 0 && (
              <div className="mt-3">
                <h3 className={LBL}>السير الذاتية النشطة</h3>
                {(detail.client?.cvSubmissions ?? []).map((cv) => (
                  <p key={cv.id} className="text-xs text-white/65">{cv.originalName} — {fmt(cv.createdAt)}</p>
                ))}
              </div>
            )}
          </section>

          {/* الحالة والإجراء التالي */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-[#6EC7D1]"><CalendarClock className="h-4 w-4" /> الحالة والإجراء</h2>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <button key={k} disabled={detail.status === k}
                  onClick={() => void act(() => apiPost(`/api/advisor/cases/${detail.id}/status`, { status: k }), `انتقلت الحالة إلى «${v}»`)}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-[11px] font-bold transition disabled:cursor-default ${
                    detail.status === k ? "border-[#FABC05] bg-[#FABC05]/10 text-[#FABC05]" : "border-white/15 text-white/55 hover:border-[#38A7B4]/50 hover:text-white"
                  }`}>
                  {v}
                </button>
              ))}
            </div>
            <NextActionForm caseId={detail.id} current={detail.nextAction} currentAt={detail.nextFollowUpAt}
              onSubmit={(nextAction, nextFollowUpAt) => void act(
                () => apiPost(`/api/advisor/cases/${detail.id}/next-action`, { nextAction, ...(nextFollowUpAt ? { nextFollowUpAt } : {}) }),
                "حُفظ الإجراء التالي"
              )} />
          </section>

          {/* تسجيل تواصل */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-[#6EC7D1]"><PhoneCall className="h-4 w-4" /> سجل التواصل</h2>
            <ContactForm onSubmit={(channel, summary) => void act(
              () => apiPost(`/api/advisor/cases/${detail.id}/contact`, { channel, summary }),
              "سُجل التواصل"
            )} />
            <ul className="mt-3 max-h-48 space-y-2 overflow-auto">
              {detail.contactEvents.map((c) => (
                <li key={c.id} className="rounded-xl bg-white/[0.04] p-2.5 text-xs leading-5 text-white/70">
                  <span className="font-bold text-white/85">{CHANNEL_LABELS[c.channel] ?? c.channel}</span>
                  {c.direction === "in" ? " (واردة)" : ""} — {c.summary}
                  <span className="block text-[10px] text-white/50">{fmt(c.createdAt)}</span>
                </li>
              ))}
              {detail.contactEvents.length === 0 && <li className="text-xs text-white/50">لا تواصل مسجل بعد</li>}
            </ul>
          </section>

          {/* المتابعات */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-[#6EC7D1]"><CalendarClock className="h-4 w-4" /> المتابعات</h2>
            <FollowUpForm onSubmit={(scheduledAt, channel, note) => void act(
              () => apiPost(`/api/advisor/cases/${detail.id}/follow-ups`, { scheduledAt, channel, ...(note ? { note } : {}) }),
              "جُدولت المتابعة"
            )} />
            <ul className="mt-3 max-h-48 space-y-2 overflow-auto">
              {detail.followUps.map((f) => (
                <li key={f.id} className="flex items-start justify-between gap-2 rounded-xl bg-white/[0.04] p-2.5 text-xs">
                  <span className="leading-5 text-white/70">
                    {CHANNEL_LABELS[f.channel] ?? f.channel} — {fmt(f.scheduledAt)}
                    {f.note ? ` — ${f.note}` : ""}
                    {f.doneAt && <span className="block text-[10px] text-[#34A853]">أُنجزت: {f.outcome}</span>}
                  </span>
                  {!f.doneAt && (
                    <button onClick={() => {
                      const outcome = window.prompt("نتيجة المتابعة؟");
                      if (outcome && outcome.length >= 2) void act(() => apiPost(`/api/advisor/follow-ups/${f.id}/complete`, { outcome }), "أُنجزت المتابعة");
                    }} className="cursor-pointer rounded-full border border-white/15 p-1.5 text-white/50 transition hover:border-[#34A853]/50 hover:text-[#34A853]" title="إنجاز المتابعة">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
              {detail.followUps.length === 0 && <li className="text-xs text-white/50">لا متابعات بعد</li>}
            </ul>
          </section>

          {/* المهام */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-[#6EC7D1]"><ClipboardList className="h-4 w-4" /> المهام</h2>
            <TaskForm onSubmit={(title, dueAt) => void act(
              () => apiPost(`/api/advisor/cases/${detail.id}/tasks`, { title, ...(dueAt ? { dueAt } : {}) }),
              "أُضيفت المهمة"
            )} />
            <ul className="mt-3 max-h-48 space-y-2 overflow-auto">
              {detail.tasks.map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-2 rounded-xl bg-white/[0.04] p-2.5 text-xs">
                  <span className={`leading-5 ${t.status === "done" ? "text-white/50 line-through" : "text-white/80"}`}>
                    {t.title}
                    {t.dueAt && <span className="block text-[10px] text-white/50">تستحق: {fmt(t.dueAt)}</span>}
                  </span>
                  {t.status !== "done" && (
                    <button onClick={() => void act(() => apiPost(`/api/advisor/tasks/${t.id}/complete`, {}), "أُنجزت المهمة")}
                      className="cursor-pointer rounded-full border border-white/15 p-1.5 text-white/50 transition hover:border-[#34A853]/50 hover:text-[#34A853]" title="إنجاز المهمة">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
              {detail.tasks.length === 0 && <li className="text-xs text-white/50">لا مهام بعد</li>}
            </ul>
          </section>

          {/* الملاحظات الداخلية */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-[#6EC7D1]"><StickyNote className="h-4 w-4" /> ملاحظات داخلية — لا يراها العميل</h2>
            <NoteForm onSubmit={(body) => void act(() => apiPost(`/api/advisor/cases/${detail.id}/notes`, { body }), "حُفظت الملاحظة")} />
            <ul className="mt-3 max-h-48 space-y-2 overflow-auto">
              {detail.notes.map((n) => (
                <li key={n.id} className="rounded-xl bg-white/[0.04] p-2.5 text-xs leading-5 text-white/70">
                  {n.body}
                  <span className="block text-[10px] text-white/50">{fmt(n.createdAt)}</span>
                </li>
              ))}
              {detail.notes.length === 0 && <li className="text-xs text-white/50">لا ملاحظات بعد</li>}
            </ul>
          </section>
        </div>
      </AdvisorLayout>
    );
  }

  /* ══ قائمة الحالات ══ */
  return (
    <AdvisorLayout title="حالاتي — عملاء التشخيص المسندون إليّ">
      <FlowSteps steps={[
        { label: "حالة جديدة", actor: "تُسند إليك" },
        { label: "أول تواصل", actor: "أنت هنا" },
        { label: "متابعة ومراجعة", actor: "أنت" },
        { label: "توصية بمسار", actor: "أنت" },
        { label: "تسجيل أو إغلاق", actor: "العميل يقرر" },
      ]} />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button onClick={() => setStatusFilter("")}
          className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-bold transition ${!statusFilter ? "border-[#FABC05] bg-[#FABC05]/10 text-[#FABC05]" : "border-white/15 text-white/55 hover:text-white"}`}>
          الكل
        </button>
        {Object.entries(STATUS_LABELS).map(([k, v]) => (
          <button key={k} onClick={() => setStatusFilter(k)}
            className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-bold transition ${statusFilter === k ? "border-[#FABC05] bg-[#FABC05]/10 text-[#FABC05]" : "border-white/15 text-white/55 hover:text-white"}`}>
            {v}
          </button>
        ))}
      </div>

      {flash && <p role="status" className="mb-4 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs font-bold text-white/80">{flash}</p>}

      {loading ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-8 w-8 animate-spin text-white/30" /></div>
      ) : cases.length === 0 ? (
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-16 text-center">
          <ClipboardList className="h-12 w-12 text-white/20" />
          <h2 className="mt-4 text-xl font-black">لا حالات مسندة هنا</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-white/55">حين يُسند إليك عميل من لوحة الأدمن (الاستثناءات) سيظهر هنا فورا.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cases.map((c) => (
            <button key={c.id} onClick={() => void openCase(c.id)}
              className="block w-full cursor-pointer rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-right transition hover:border-[#38A7B4]/50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-black">{partyOf(c).name} <span className="text-[11px] font-normal text-white/50" dir="ltr">{partyOf(c).email}</span></p>
                  <p className="mt-1 text-xs text-white/55">{snapshotSummary(c.diagnosticSnapshot)}</p>
                  {c.nextAction && <p className="mt-1 text-[11px] text-[#FABC05]">التالي: {c.nextAction}{c.nextFollowUpAt ? ` — ${fmt(c.nextFollowUpAt)}` : ""}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {c.followUps[0] && (
                    <span className="rounded-full border border-[#38A7B4]/40 px-3 py-1 text-[10px] font-bold text-[#6EC7D1]">
                      متابعة {fmt(c.followUps[0].scheduledAt)}
                    </span>
                  )}
                  <span className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-bold text-white/70">
                    {STATUS_LABELS[c.status] ?? c.status}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </AdvisorLayout>
  );
}

/* ── نماذج صغيرة ── */

function NextActionForm({ current, currentAt, onSubmit }: {
  caseId: string; current: string | null; currentAt: string | null;
  onSubmit: (nextAction: string, nextFollowUpAt: string) => void;
}) {
  const [text, setText] = useState(current ?? "");
  const [at, setAt] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (text.trim().length >= 3) onSubmit(text.trim(), at); }}>
      <label className={LBL}>الإجراء التالي{current ? ` — الحالي: ${current}` : ""}{currentAt ? ` (${fmt(currentAt)})` : ""}</label>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="مثال: تأكيد موعد المقابلة" className={INPUT} />
      <label className={`${LBL} mt-2`}>موعد المتابعة القادم (اختياري)</label>
      <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} className={INPUT} dir="ltr" />
      <button type="submit" disabled={text.trim().length < 3}
        className="mt-2 flex cursor-pointer items-center gap-1.5 rounded-full bg-[#38A7B4] px-4 py-1.5 text-[11px] font-black text-[#08272B] transition hover:bg-[#38A7B4]/90 disabled:opacity-40">
        <Send className="h-3 w-3" /> حفظ الإجراء
      </button>
    </form>
  );
}

function ContactForm({ onSubmit }: { onSubmit: (channel: string, summary: string) => void }) {
  const [channel, setChannel] = useState("whatsapp");
  const [summary, setSummary] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (summary.trim().length >= 3) { onSubmit(channel, summary.trim()); setSummary(""); } }}>
      <div className="flex gap-2">
        <select value={channel} onChange={(e) => setChannel(e.target.value)}
          className="rounded-xl border border-white/15 bg-black/30 px-2 py-2 text-xs text-white [&>option]:bg-[#121B1D]">
          {Object.entries(CHANNEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="ملخص التواصل…" className={INPUT} />
      </div>
      <button type="submit" disabled={summary.trim().length < 3}
        className="mt-2 flex cursor-pointer items-center gap-1.5 rounded-full bg-[#38A7B4] px-4 py-1.5 text-[11px] font-black text-[#08272B] transition hover:bg-[#38A7B4]/90 disabled:opacity-40">
        <MessageSquarePlus className="h-3 w-3" /> تسجيل
      </button>
    </form>
  );
}

function FollowUpForm({ onSubmit }: { onSubmit: (scheduledAt: string, channel: string, note: string) => void }) {
  const [at, setAt] = useState("");
  const [channel, setChannel] = useState("whatsapp");
  const [note, setNote] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (at) { onSubmit(new Date(at).toISOString(), channel, note.trim()); setAt(""); setNote(""); } }}>
      <div className="flex flex-wrap gap-2">
        <input type="datetime-local" required value={at} onChange={(e) => setAt(e.target.value)} className={INPUT} dir="ltr" />
        <select value={channel} onChange={(e) => setChannel(e.target.value)}
          className="rounded-xl border border-white/15 bg-black/30 px-2 py-2 text-xs text-white [&>option]:bg-[#121B1D]">
          {Object.entries(CHANNEL_LABELS).filter(([k]) => k !== "in_app").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة (اختياري)" className={INPUT} />
      </div>
      <button type="submit" disabled={!at}
        className="mt-2 flex cursor-pointer items-center gap-1.5 rounded-full bg-[#38A7B4] px-4 py-1.5 text-[11px] font-black text-[#08272B] transition hover:bg-[#38A7B4]/90 disabled:opacity-40">
        <CalendarClock className="h-3 w-3" /> جدولة
      </button>
    </form>
  );
}

function TaskForm({ onSubmit }: { onSubmit: (title: string, dueAt: string) => void }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (title.trim().length >= 3) { onSubmit(title.trim(), due ? new Date(due).toISOString() : ""); setTitle(""); setDue(""); } }}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان المهمة…" className={INPUT} />
      <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className={`${INPUT} mt-2`} dir="ltr" />
      <button type="submit" disabled={title.trim().length < 3}
        className="mt-2 flex cursor-pointer items-center gap-1.5 rounded-full bg-[#38A7B4] px-4 py-1.5 text-[11px] font-black text-[#08272B] transition hover:bg-[#38A7B4]/90 disabled:opacity-40">
        <ClipboardList className="h-3 w-3" /> إضافة مهمة
      </button>
    </form>
  );
}

function NoteForm({ onSubmit }: { onSubmit: (body: string) => void }) {
  const [body, setBody] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (body.trim().length >= 3) { onSubmit(body.trim()); setBody(""); } }}>
      <textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="ملاحظة داخلية…" className={INPUT} />
      <button type="submit" disabled={body.trim().length < 3}
        className="mt-2 flex cursor-pointer items-center gap-1.5 rounded-full bg-[#38A7B4] px-4 py-1.5 text-[11px] font-black text-[#08272B] transition hover:bg-[#38A7B4]/90 disabled:opacity-40">
        <StickyNote className="h-3 w-3" /> حفظ الملاحظة
      </button>
    </form>
  );
}
