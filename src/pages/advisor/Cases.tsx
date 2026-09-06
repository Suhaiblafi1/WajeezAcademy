import { useCallback, useEffect, useState } from "react";
import { toast, toastError } from "@/components/Toast";
import {
  CalendarClock, CheckCircle2, ChevronLeft, ClipboardList, FileText, Loader2, MessageSquarePlus,
  PhoneCall, Plus, Send, ServerOff, StickyNote, UserRound, GraduationCap, BadgePercent,
} from "lucide-react";
import AdvisorLayout from "./AdvisorLayout";
import { apiGet, apiPost, ApiError } from "@/services/api";
import Pipeline from "./Pipeline";
import LearnerPanel from "./LearnerPanel";
import RequestsPanel from "./RequestsPanel";
import { STATUS_AR } from "@/application/advisor/pipeline";
import { fmtDateWith } from "@/application/text/format-ar";
import ConfirmAction from "@/components/ConfirmAction";

import { Panel, Card } from "@/components/ui/Surface";
/* أسماءُ المراحل من `pipeline` وحدَه — لا جدولَ ثانيا يفترق عن القِمع */
const STATUS_LABELS = STATUS_AR;
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

const INPUT = "w-full rounded-xl border border-white/15 bg-paper/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/75 focus:border-teal focus:outline-none";
const LBL = "mb-1 block text-[11px] font-bold text-muted-foreground";

/* `ar-SA` تُخرج تقويما **هجريّا**، فكان المستشار وحده يرى «١٥ ربيع الآخر»
   بينما الشعبةُ مجدولةٌ ميلاديّا في كل شاشةٍ أخرى — فيُقارن موعدين
   بتقويمين. و`ar-u-ca-gregory` تُثبّت الميلاديّ مهما كانت لغة المتصفّح. */
function fmt(d: string | null) {
  if (!d) return "—";
  return fmtDateWith(new Date(d), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
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
  /* نتيجةُ المتابعة تُكتب في نافذة المنصّة: كانت `window.prompt("نتيجة
     المتابعة؟")` — سؤالٌ بلا سياقٍ في حوارٍ يملك المتصفّحُ كتمَه. */
  const [closingFollowUp, setClosingFollowUp] = useState<{ id: string; whenAr: string } | null>(null);
  const [openingCv, setOpeningCv] = useState<string | null>(null);
  /* إدخالُ عميلٍ قابله المستشارُ خارج المنصّة (البند ٢٥) */
  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState({ fullName: "", email: "", phone: "", note: "" });

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
    try {
      setDetail(await apiGet<CaseDetail>(`/api/advisor/cases/${id}`));
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "تعذر فتح الحالة");
    }
  };

  /* فتحُ سيرةٍ برابطٍ موقَّع — يُطلَب عند النقر، ويُسجَّل عند طلبه */
  const openCv = async (cvId: string) => {
    setOpeningCv(cvId);
    try {
      const { url } = await apiGet<{ url: string }>(`/api/cv/${cvId}/read-url`);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "تعذّر فتح السيرة");
    } finally {
      setOpeningCv(null);
    }
  };

  /* إجراء عام — يعيد تحميل التفاصيل والقائمة */
  const act = async (fn: () => Promise<unknown>, okMsg: string) => {
    try {
      await fn();
      toast(okMsg);
      if (detail) await openCase(detail.id);
      await load();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "تعذر تنفيذ الإجراء");
    }
  };

  if (offline) {
    return (
      <AdvisorLayout title="حالاتي — عملاء التشخيص">
        <Panel className="grid place-items-center py-20 text-center">
          <ServerOff className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-xl font-black">لا يمكن الوصول للبيانات</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">{offline}</p>
        </Panel>
      </AdvisorLayout>
    );
  }

  /* ══ عرض ملف الحالة ══ */
  if (detail) {
    return (
      <AdvisorLayout title={`ملف الحالة — ${partyOf(detail).name}`}>
        <button onClick={() => setDetail(null)} className="mb-4 flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> عودة للقائمة
        </button>

        <div className="grid gap-5 lg:grid-cols-3">
          {/* العميل والتشخيص */}
          <Card as="section">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-teal-light-ink"><UserRound className="h-4 w-4" /> العميل</h2>
            <p className="font-black">{partyOf(detail).name}</p>
            {partyOf(detail).email && <p className="mt-1 text-xs text-muted-foreground" dir="ltr">{partyOf(detail).email}</p>}
            {partyOf(detail).phone && <p className="text-xs text-muted-foreground" dir="ltr">{partyOf(detail).phone}</p>}
            <p className="mt-2 text-[11px] text-muted-foreground">المصدر: {partyOf(detail).source === "diagnostic" ? "التشخيص الذكي" : partyOf(detail).source ?? "حساب مسجل"}</p>
            <p className="mt-3 rounded-xl bg-white/[0.04] p-3 text-xs leading-6 text-foreground">
              {snapshotSummary(detail.client?.learnerProfile?.diagnosticSnapshot ?? detail.diagnosticSnapshot)}
            </p>
            {/* ── سيرةُ العميل: تُقرأ لا تُعدّ ──

                كانت أسماءُ السير تُعرض ولا شيءَ يفتحها: `cv.view` ممنوحةٌ
                للمستشار، والخادمُ يأذن صراحةً «للمستشار المُسنَد» في
                `/api/cv/:id/read-url` — والبابُ الوحيدُ الذي يبلغه لم يكن
                مرسوما في أيّ شاشة. فكان يقرأ اسمَ ملفٍّ لا يستطيع فتحه.

                والرابطُ يُطلَب عند النقر لا عند العرض: هو موقَّعٌ بمهلة،
                وكلُّ طلبٍ له يُسجَّل في الأثر — فلا تُسجَّل فتحةٌ لم تقع. */}
            {(detail.client?.cvSubmissions ?? []).length > 0 && (
              <div className="mt-3">
                <h3 className={LBL}>السير الذاتية النشطة</h3>
                <ul className="space-y-1.5">
                  {(detail.client?.cvSubmissions ?? []).map((cv) => (
                    <li key={cv.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="min-w-0 text-xs text-foreground">{cv.originalName} — {fmt(cv.createdAt)}</span>
                      <button
                        onClick={() => void openCv(cv.id)}
                        disabled={openingCv === cv.id}
                        className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full border border-teal/35 px-3 py-1 text-[11px] font-bold text-teal-light-ink transition hover:border-teal disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {openingCv === cv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                        افتحها
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-micro leading-5 text-muted-foreground">كلُّ فتحةٍ تُسجَّل في سجلّ الأثر باسمك.</p>
              </div>
            )}
          </Card>

          {/* الحالة والإجراء التالي */}
          <Card as="section">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-teal-light-ink"><CalendarClock className="h-4 w-4" /> الحالة والإجراء</h2>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <button key={k} disabled={detail.status === k}
                  onClick={() => void act(() => apiPost(`/api/advisor/cases/${detail.id}/status`, { status: k }), `انتقلت الحالة إلى «${v}»`)}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-[11px] font-bold transition disabled:cursor-default ${
                    detail.status === k ? "border-gold bg-gold/10 text-gold-ink" : "border-white/15 text-muted-foreground hover:border-teal/50 hover:text-foreground"
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
          </Card>

          {/* الوجه الأكاديميّ — أين وصل عميلي */}
          <Card as="section">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-teal-light-ink"><GraduationCap className="h-4 w-4" /> أين وصل — قراءةٌ لا تعديل</h2>
            <LearnerPanel key={detail.id} caseId={detail.id} />
          </Card>

          {/* ما لا يملكه المستشار وحده */}
          <Card as="section" className="lg:col-span-2">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-black text-teal-light-ink"><BadgePercent className="h-4 w-4" /> طلباتٌ تبتّ فيها الإدارة</h2>
            <p className="mb-3 text-[11px] leading-6 text-muted-foreground">
              خصمٌ على فاتورته، أو تعديلٌ على خطّته. لا يُنفَّذ بطلبك وحده — ويبقى أثرُه مكتوبا.
            </p>
            <RequestsPanel key={detail.id} caseId={detail.id} />
          </Card>

          {/* تسجيل تواصل */}
          <Card as="section">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-teal-light-ink"><PhoneCall className="h-4 w-4" /> سجل التواصل</h2>
            <ContactForm onSubmit={(channel, summary) => void act(
              () => apiPost(`/api/advisor/cases/${detail.id}/contact`, { channel, summary }),
              "سُجل التواصل"
            )} />
            <ul className="mt-3 max-h-48 space-y-2 overflow-auto">
              {detail.contactEvents.map((c) => (
                <li key={c.id} className="rounded-xl bg-white/[0.04] p-2.5 text-xs leading-5 text-foreground">
                  <span className="font-bold text-foreground">{CHANNEL_LABELS[c.channel] ?? c.channel}</span>
                  {c.direction === "in" ? " (واردة)" : ""} — {c.summary}
                  <span className="block text-micro text-muted-foreground">{fmt(c.createdAt)}</span>
                </li>
              ))}
              {detail.contactEvents.length === 0 && <li className="text-xs text-muted-foreground">لا تواصل مسجل بعد</li>}
            </ul>
          </Card>

          {/* المتابعات */}
          <Card as="section">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-teal-light-ink"><CalendarClock className="h-4 w-4" /> المتابعات</h2>
            <FollowUpForm onSubmit={(scheduledAt, channel, note) => void act(
              () => apiPost(`/api/advisor/cases/${detail.id}/follow-ups`, { scheduledAt, channel, ...(note ? { note } : {}) }),
              "جُدولت المتابعة"
            )} />
            <ul className="mt-3 max-h-48 space-y-2 overflow-auto">
              {detail.followUps.map((f) => (
                <li key={f.id} className="flex items-start justify-between gap-2 rounded-xl bg-white/[0.04] p-2.5 text-xs">
                  <span className="leading-5 text-foreground">
                    {CHANNEL_LABELS[f.channel] ?? f.channel} — {fmt(f.scheduledAt)}
                    {f.note ? ` — ${f.note}` : ""}
                    {f.doneAt && <span className="block text-micro text-[#34A853]">أُنجزت: {f.outcome}</span>}
                  </span>
                  {!f.doneAt && (
                    <button onClick={() => setClosingFollowUp({ id: f.id, whenAr: fmt(f.scheduledAt) })}
                      className="cursor-pointer rounded-full border border-white/15 p-1.5 text-muted-foreground transition hover:border-[#34A853]/50 hover:text-[#34A853]" title="إنجاز المتابعة">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
              {detail.followUps.length === 0 && <li className="text-xs text-muted-foreground">لا متابعات بعد</li>}
            </ul>
          </Card>

          {/* المهام */}
          <Card as="section">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-teal-light-ink"><ClipboardList className="h-4 w-4" /> المهام</h2>
            <TaskForm onSubmit={(title, dueAt) => void act(
              () => apiPost(`/api/advisor/cases/${detail.id}/tasks`, { title, ...(dueAt ? { dueAt } : {}) }),
              "أُضيفت المهمة"
            )} />
            <ul className="mt-3 max-h-48 space-y-2 overflow-auto">
              {detail.tasks.map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-2 rounded-xl bg-white/[0.04] p-2.5 text-xs">
                  <span className={`leading-5 ${t.status === "done" ? "text-muted-foreground line-through" : "text-foreground"}`}>
                    {t.title}
                    {t.dueAt && <span className="block text-micro text-muted-foreground">تستحق: {fmt(t.dueAt)}</span>}
                  </span>
                  {t.status !== "done" && (
                    <button onClick={() => void act(() => apiPost(`/api/advisor/tasks/${t.id}/complete`, {}), "أُنجزت المهمة")}
                      className="cursor-pointer rounded-full border border-white/15 p-1.5 text-muted-foreground transition hover:border-[#34A853]/50 hover:text-[#34A853]" title="إنجاز المهمة">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
              {detail.tasks.length === 0 && <li className="text-xs text-muted-foreground">لا مهام بعد</li>}
            </ul>
          </Card>

          {/* الملاحظات الداخلية */}
          <Card as="section">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-teal-light-ink"><StickyNote className="h-4 w-4" /> ملاحظات داخلية — لا يراها العميل</h2>
            <NoteForm onSubmit={(body) => void act(() => apiPost(`/api/advisor/cases/${detail.id}/notes`, { body }), "حُفظت الملاحظة")} />
            <ul className="mt-3 max-h-48 space-y-2 overflow-auto">
              {detail.notes.map((n) => (
                <li key={n.id} className="rounded-xl bg-white/[0.04] p-2.5 text-xs leading-5 text-foreground">
                  {n.body}
                  <span className="block text-micro text-muted-foreground">{fmt(n.createdAt)}</span>
                </li>
              ))}
              {detail.notes.length === 0 && <li className="text-xs text-muted-foreground">لا ملاحظات بعد</li>}
            </ul>
          </Card>
        </div>
      </AdvisorLayout>
    );
  }

  /* ══ قائمة الحالات ══ */
  return (
    <AdvisorLayout title="حالاتي — عملاء التشخيص المسندون إليّ">
      {/* القِمع أوّلا — «أين أنا؟» في نظرة، ثمّ التصفية لمن أرادها */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button onClick={() => setStatusFilter("")}
          className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-bold transition ${!statusFilter ? "border-gold bg-gold/10 text-gold-ink" : "border-white/15 text-muted-foreground hover:text-foreground"}`}>
          كل الحالات
        </button>
        {Object.entries(STATUS_LABELS).map(([k, v]) => (
          <button key={k} onClick={() => setStatusFilter(k)}
            className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-bold transition ${statusFilter === k ? "border-gold bg-gold/10 text-gold-ink" : "border-white/15 text-muted-foreground hover:text-foreground"}`}>
            {v}
          </button>
        ))}
        <button onClick={() => setNewOpen((v) => !v)}
          className="me-auto flex cursor-pointer items-center gap-1.5 rounded-full border border-teal/40 bg-teal/10 px-4 py-1.5 text-xs font-black text-teal-light-ink transition hover:border-teal">
          <Plus className="h-3.5 w-3.5" /> {newOpen ? "أغلق" : "أدخِل عميلا"}
        </button>
      </div>

      {/* ── من قابلتَه خارج المنصّة ──

          كانت الحالاتُ تولد من متعلّمٍ **مسجَّلٍ أنهى التشخيص** ثمّ يُسنِدها
          إداريّ، ولا مسارَ غيرُه. فمن قابلَ عميلا في معرضٍ أو مكالمةٍ لم يجد
          موضعا يُدخله فيه: ينتظر أن يأتيَ الرجلُ ويُشخّص، ثمّ ينتظر إداريّا.
          والحالةُ التي تُدخلها تُسنَد إليك في الفعل نفسِه. */}
      {newOpen && (
        <form
          className="mb-5 rounded-2xl border border-teal/25 bg-teal/[0.04] p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fullName = newForm.fullName.trim();
            const email = newForm.email.trim();
            const phone = newForm.phone.trim();
            if (fullName.length < 2 || (!email && !phone)) return;
            void act(async () => {
              await apiPost("/api/advisor/cases", {
                fullName,
                ...(email ? { email } : {}),
                ...(phone ? { phone } : {}),
                ...(newForm.note.trim() ? { note: newForm.note.trim() } : {}),
              });
              setNewForm({ fullName: "", email: "", phone: "", note: "" });
              setNewOpen(false);
            }, "فُتحت الحالة وأُسندت إليك");
          }}
        >
          <p className="text-[11.5px] leading-6 text-muted-foreground">
            بريدٌ أو هاتفٌ على الأقلّ — <b className="text-foreground">حالةٌ بلا سبيلٍ إلى صاحبها لا تُفتح</b>.
            ولا تشخيصَ يُنسب إليه قبل أن يُقاس.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className={LBL}>الاسم الكامل</span>
              <input required minLength={2} maxLength={120} className={INPUT}
                value={newForm.fullName} onChange={(e) => setNewForm((f) => ({ ...f, fullName: e.target.value }))} />
            </label>
            <label className="block">
              <span className={LBL}>البريد</span>
              <input type="email" dir="ltr" className={`${INPUT} text-right`}
                value={newForm.email} onChange={(e) => setNewForm((f) => ({ ...f, email: e.target.value }))} />
            </label>
            <label className="block">
              <span className={LBL}>الهاتف</span>
              <input dir="ltr" maxLength={30} className={`${INPUT} text-right`}
                value={newForm.phone} onChange={(e) => setNewForm((f) => ({ ...f, phone: e.target.value }))} />
            </label>
          </div>
          <label className="mt-3 block">
            <span className={LBL}>ملاحظةُ أوّلِ لقاء (اختياريّة) — تُحفظ ملاحظةً داخليّة</span>
            <textarea rows={2} maxLength={2000} className={INPUT}
              value={newForm.note} onChange={(e) => setNewForm((f) => ({ ...f, note: e.target.value }))} />
          </label>
          <button type="submit"
            disabled={newForm.fullName.trim().length < 2 || (!newForm.email.trim() && !newForm.phone.trim())}
            className="mt-3 flex cursor-pointer items-center gap-1.5 rounded-full bg-teal px-5 py-2 text-xs font-black text-on-teal transition hover:bg-teal-light disabled:cursor-not-allowed disabled:opacity-40">
            <Plus className="h-3.5 w-3.5" /> افتح الحالة
          </button>
        </form>
      )}


      {loading ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" /></div>
      ) : cases.length === 0 ? (
        <Panel className="grid place-items-center py-16 text-center">
          <ClipboardList className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-xl font-black">لا حالات مسندة هنا</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">حين تُسنَد إليك حالةٌ من لوحة الإدارة تظهر هنا فورا — ويصلك جرسُها. أو <b className="text-foreground">أدخِل عميلا قابلتَه</b> بنفسك من الزرّ أعلاه.</p>
        </Panel>
      ) : statusFilter ? (
        /* تصفيةٌ صريحة: قائمةٌ مسطّحة أنفعُ من قِمعٍ بعمودٍ واحد */
        <div className="space-y-3">
          {cases.map((c) => (
            <button key={c.id} onClick={() => void openCase(c.id)}
              className="block w-full cursor-pointer rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-right transition hover:border-teal/50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-black">{partyOf(c).name} <span className="text-[11px] font-normal text-muted-foreground" dir="ltr">{partyOf(c).email}</span></p>
                  <p className="mt-1 text-xs text-muted-foreground">{snapshotSummary(c.diagnosticSnapshot)}</p>
                  {c.nextAction && <p className="mt-1 text-[11px] text-gold-ink">التالي: {c.nextAction}{c.nextFollowUpAt ? ` — ${fmt(c.nextFollowUpAt)}` : ""}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {c.followUps[0] && (
                    <span className="rounded-full border border-teal/40 px-3 py-1 text-micro font-bold text-teal-light-ink">
                      متابعة {fmt(c.followUps[0].scheduledAt)}
                    </span>
                  )}
                  <span className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-bold text-foreground">
                    {STATUS_LABELS[c.status] ?? c.status}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <Pipeline
          cases={cases}
          onOpen={(id) => void openCase(id)}
          renderName={(id) => {
            const c = cases.find((x) => x.id === id);
            return c ? partyOf(c) : { name: "—", email: "" };
          }}
        />
      )}

      {closingFollowUp && (
        <ConfirmAction
          tone="default"
          titleAr={`إنجازُ متابعةِ ${closingFollowUp.whenAr}`}
          confirmLabelAr="سجّل الإنجاز"
          reason={{ labelAr: "ماذا كانت النتيجة؟ — تُقرأ في سجلّ الحالة", minLength: 2 }}
          onCancel={() => setClosingFollowUp(null)}
          onConfirm={(outcome) => {
            const target = closingFollowUp;
            setClosingFollowUp(null);
            void act(() => apiPost(`/api/advisor/follow-ups/${target.id}/complete`, { outcome }), "أُنجزت المتابعة");
          }}
        >
          <p>تُغلَق المتابعةُ وتبقى نتيجتُها في سجلّ الحالة — يقرؤها من يتابع بعدك.</p>
        </ConfirmAction>
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
        className="mt-2 flex cursor-pointer items-center gap-1.5 rounded-full bg-teal px-4 py-1.5 text-[11px] font-black text-on-teal transition hover:bg-teal/90 disabled:opacity-40">
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
          className="rounded-xl border border-white/15 bg-paper/30 px-2 py-2 text-xs text-foreground [&>option]:bg-surface">
          {Object.entries(CHANNEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="ملخص التواصل…" className={INPUT} />
      </div>
      <button type="submit" disabled={summary.trim().length < 3}
        className="mt-2 flex cursor-pointer items-center gap-1.5 rounded-full bg-teal px-4 py-1.5 text-[11px] font-black text-on-teal transition hover:bg-teal/90 disabled:opacity-40">
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
          className="rounded-xl border border-white/15 bg-paper/30 px-2 py-2 text-xs text-foreground [&>option]:bg-surface">
          {Object.entries(CHANNEL_LABELS).filter(([k]) => k !== "in_app").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة (اختياري)" className={INPUT} />
      </div>
      <button type="submit" disabled={!at}
        className="mt-2 flex cursor-pointer items-center gap-1.5 rounded-full bg-teal px-4 py-1.5 text-[11px] font-black text-on-teal transition hover:bg-teal/90 disabled:opacity-40">
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
        className="mt-2 flex cursor-pointer items-center gap-1.5 rounded-full bg-teal px-4 py-1.5 text-[11px] font-black text-on-teal transition hover:bg-teal/90 disabled:opacity-40">
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
        className="mt-2 flex cursor-pointer items-center gap-1.5 rounded-full bg-teal px-4 py-1.5 text-[11px] font-black text-on-teal transition hover:bg-teal/90 disabled:opacity-40">
        <StickyNote className="h-3 w-3" /> حفظ الملاحظة
      </button>
    </form>
  );
}
