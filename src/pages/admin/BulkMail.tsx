/* «البريد الجماعي» — حملاتٌ وقوائمُ في مكانٍ واحد (٢٢ نوفمبر ٢٠٢٦).

   طلبُ صاحب المنصّة: «ok i need to be easy like i choose which list and what email to them.. multi campaign same
   place». فالصفحةُ لسانان: «الحملات» — كلُّ حملةٍ بحالها وأرقامها، وزرُّ «حملة جديدة» — و«القوائم» تُرفع وتُسمّى
   وتُحذف. والحملةُ ثلاثُ خطواتٍ على شاشةٍ واحدة: القائمة، ثمّ الرسالة بمعاينتها، ثمّ الإرسال أو تجربتُه.

   والتأكيدُ يقول العددَ بعينه ومن لا تصله ولماذا وكم يأخذ (`confirmLinesAr`)، وفوق ألفٍ يُكتب العدد — ويُقال لماذا،
   ومعه خياراتٌ أخرى (تجربة، أو رجوع). والخادمُ في `server/services/bulk-mail/`. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, FileUp, Mail, Pencil, Plus, Send, Square, Trash2 } from "lucide-react";
import AdminLayout from "./AdminLayout";
import TabBar from "@/components/ui/TabBar";
import { Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import Chip, { type ChipTone } from "@/components/ui/Chip";
import Modal from "@/components/Modal";
import { StaffField, staffAreaCls, staffControlCls, staffSelectCls } from "@/components/FormKit";
import { toast, toastError } from "@/components/Toast";
import { apiDelete, apiGet, apiPost, apiPostFile, apiPut, ApiError } from "@/services/api";
import { fmtDateTime } from "@/application/text/format-ar";
import {
  BULK_BODY_MAX, BULK_BUTTON_LABEL_MAX, BULK_LIST_NAME_MAX, BULK_SUBJECT_MAX, CAMPAIGN_STATUS_AR, DEFAULT_STAGE_CAPS, TYPE_COUNT_WHY_AR,
  confirmLinesAr, etaAr, needsTypedCount, peopleAr, senderAr, stageLinesAr, stagePlan, stagedByDefault, typedCountMatches,
  SKIP_RECENT_DAYS, SKIP_RECENT_DEFAULT, skipRecentAr, type SkipRecentDays,
  type CampaignStatus, type SendCheck,
} from "@/application/marketing/bulk-mail";

/* ─────────── ما يأتي من الخادم ─────────── */

interface Audience {
  key: string; nameAr: string; count: number; kind: "website" | "list"
  fileName?: string | null; createdAt?: string; totalRows?: number; invalidRows?: number; duplicateRows?: number
}
interface Audiences { website: Audience[]; lists: Audience[] }

interface Campaign {
  id: string; status: CampaignStatus; subject: string; body: string; buttonLabel: string | null; buttonUrl: string | null
  audience: string | null; audienceAr: string | null; createdAt: string; sentAt: string | null; stoppedAt: string | null; finishedAt: string | null
  createdByName: string | null; sentByName: string | null; stoppedByName: string | null
  progress: { queued: number; sent: number; failed: number; waiting: number; cancelled: number; skipped: number }
  stages: Stage[]; fromName: string | null; fromEmail: string | null
}

interface Check extends SendCheck { etaMinutes: number; mailOn: boolean; from: Sender }
interface Sender { name: string; email: string; isDefault?: boolean }
interface Stage { at: string; count: number; sent: number | null; failed: number | null; waiting: number | null }

interface Preview {
  totalRows: number; valid: number; invalid: number; duplicates: number; optedOut: number; corrected: number
  emailColumn: string; nameColumn: string | null
  sample: { email: string; name: string | null }[]
  invalidSamples: { row: number; value: string }[]
}

const err = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

const STATUS_TONE: Record<CampaignStatus, ChipTone> = { draft: "neutral", sending: "info", sent: "positive", stopped: "warn" };

type Tab = "campaigns" | "lists";

export default function BulkMail() {
  const [tab, setTab] = useState<Tab>("campaigns");
  const [editing, setEditing] = useState<string | null>(null);
  const [audiences, setAudiences] = useState<Audiences | null>(null);
  const loadAudiences = useCallback(() => apiGet<Audiences>("/api/admin/bulk-mail/audiences").then(setAudiences).catch(() => setAudiences(null)), []);
  useEffect(() => { void loadAudiences(); }, [loadAudiences]);

  return (
    <AdminLayout title="البريد الجماعي">
      {editing ? (
        <CampaignEditor id={editing} audiences={audiences} reloadAudiences={loadAudiences} onClose={() => setEditing(null)} />
      ) : (
        <>
          <TabBar
            ariaLabel="أقسام البريد الجماعي" value={tab} onChange={setTab}
            items={[{ id: "campaigns", label: "الحملات" }, { id: "lists", label: "القوائم" }]}
          />
          <div className="mt-4">
            {tab === "campaigns"
              ? <Campaigns onOpen={setEditing} />
              : <Lists audiences={audiences} reload={loadAudiences} />}
          </div>
        </>
      )}
    </AdminLayout>
  );
}

/* ─────────── الحملات ─────────── */

function Campaigns({ onOpen }: { onOpen: (id: string) => void }) {
  const [data, setData] = useState<{ mailOn: boolean; campaigns: Campaign[] } | null>(null);
  const [busy, setBusy] = useState("");
  const [stopping, setStopping] = useState<Campaign | null>(null);
  const load = useCallback(() => apiGet<{ mailOn: boolean; campaigns: Campaign[] }>("/api/admin/bulk-mail/campaigns").then(setData).catch(() => setData(null)), []);
  useEffect(() => { void load(); }, [load]);
  /* ما دامت حملةٌ تُرسل تُقرأ أرقامُها كلَّ خمس ثوانٍ */
  const live = data?.campaigns.some((c) => c.status === "sending") ?? false;
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => { void load(); }, 5_000);
    return () => clearInterval(t);
  }, [live, load]);

  const create = async () => {
    setBusy("new");
    try { onOpen((await apiPost<{ id: string }>("/api/admin/bulk-mail/campaigns", {})).id); }
    catch (e) { toastError(err(e, "تعذر إنشاء الحملة")); setBusy(""); }
  };
  const duplicate = async (c: Campaign) => {
    setBusy(c.id);
    try { onOpen((await apiPost<{ id: string }>(`/api/admin/bulk-mail/campaigns/${c.id}/duplicate`)).id); }
    catch (e) { toastError(err(e, "تعذر النسخ")); setBusy(""); }
  };
  const remove = async (c: Campaign) => {
    setBusy(c.id);
    try { await apiDelete(`/api/admin/bulk-mail/campaigns/${c.id}`); await load(); }
    catch (e) { toastError(err(e, "تعذر الحذف")); }
    finally { setBusy(""); }
  };

  if (!data) return null;
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Button tone="primary" icon={Plus} loading={busy === "new"} onClick={() => void create()}>حملة جديدة</Button>
        {!data.mailOn && <p className="text-read font-bold text-gold-ink">البريد غير موصول الآن. الرسائل تنتظر حتى يوصل من التكاملات.</p>}
      </div>
      <SenderLine />
      {data.campaigns.length === 0 ? (
        <Card as="p" className="mt-4 text-read text-muted-foreground">لا حملات بعد.</Card>
      ) : (
        <div className="mt-4 grid gap-3">
          {data.campaigns.map((c) => <CampaignCard key={c.id} c={c} busy={busy === c.id} onOpen={() => onOpen(c.id)} onDuplicate={() => void duplicate(c)} onDelete={() => void remove(c)} onStop={() => setStopping(c)} />)}
        </div>
      )}
      {stopping && <StopDialog c={stopping} onClose={() => setStopping(null)} onDone={() => { setStopping(null); void load(); }} />}
    </>
  );
}

/* ─────────── مُرسِلُ الحملات: نطاقٌ فرعيّ ─────────── */

function SenderLine() {
  const [sender, setSender] = useState<Sender | null>(null);
  const [editing, setEditing] = useState(false);
  const load = useCallback(() => apiGet<Sender>("/api/admin/bulk-mail/sender").then(setSender).catch(() => setSender(null)), []);
  useEffect(() => { void load(); }, [load]);
  if (!sender) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-read text-muted-foreground">
      <span>ترسل الحملات من <span dir="ltr" className="font-bold text-foreground">{senderAr(sender)}</span></span>
      <Button tone="ghost" size="sm" icon={Pencil} onClick={() => setEditing(true)}>غير المرسل</Button>
      {editing && <SenderEdit sender={sender} onClose={() => setEditing(false)} onDone={async () => { setEditing(false); await load(); }} />}
    </div>
  );
}

function SenderEdit({ sender, onClose, onDone }: { sender: Sender; onClose: () => void; onDone: () => Promise<void> }) {
  const [name, setName] = useState(sender.name);
  const [email, setEmail] = useState(sender.email);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await apiPut("/api/admin/bulk-mail/sender", { name, email }); toast("حفظنا المرسل"); await onDone(); }
    catch (e) { toastError(err(e, "تعذر الحفظ")); setBusy(false); }
  };
  return (
    <Modal onClose={onClose} label="مرسل الحملات" panelClassName="w-full max-w-md">
      <Inset dir="rtl" tone="solid" className="text-foreground sm:p-6">
        <h2 className="text-sm font-black">مرسل الحملات</h2>
        <p className="mt-1 text-read leading-6 text-muted-foreground">
          نطاق فرعي للحملات يحمي بريد الحساب والدفع. وثقه في Resend أولا، وإلا تتعذر رسائل الحملة ولا ترسل من نطاق آخر. رسائل الحساب تبقى من مرسلها.
        </p>
        <div className="mt-3 grid gap-3">
          <StaffField label="الاسم">
            <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className={`${staffControlCls} w-full`} />
          </StaffField>
          <StaffField label="البريد">
            <input value={email} dir="ltr" maxLength={254} onChange={(e) => setEmail(e.target.value)} className={`${staffControlCls} w-full`} />
          </StaffField>
        </div>
        <div className="mt-4 flex gap-2">
          <Button tone="confirm" loading={busy} disabled={!name.trim() || !email.trim()} onClick={() => void save()}>احفظ</Button>
          <Button tone="secondary" disabled={busy} onClick={onClose}>ليس الآن</Button>
        </div>
      </Inset>
    </Modal>
  );
}

function CampaignCard({ c, busy, onOpen, onDuplicate, onDelete, onStop }: {
  c: Campaign; busy: boolean; onOpen: () => void; onDuplicate: () => void; onDelete: () => void; onStop: () => void
}) {
  const p = c.progress;
  const done = p.sent + p.failed;
  const pct = p.queued > 0 ? Math.min(100, Math.round((done / p.queued) * 100)) : 0;
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-black">{c.subject || "بلا عنوان"}</p>
          <p className="mt-1 text-read text-muted-foreground">
            {c.audienceAr ?? (c.audience ? "قائمة مختارة" : "لم تختر القائمة")}
            {" · "}
            {c.sentAt ? `أرسلها ${c.sentByName ?? "مدير"} ${fmtDateTime(c.sentAt)}` : `كتبها ${c.createdByName ?? "مدير"} ${fmtDateTime(c.createdAt)}`}
          </p>
        </div>
        <Chip tone={STATUS_TONE[c.status]} srPrefixAr="الحالة">{CAMPAIGN_STATUS_AR[c.status]}</Chip>
      </div>

      {c.status !== "draft" && (
        <>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="ما خرج من الحملة">
            <div className="h-full bg-teal-light-ink" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-read text-muted-foreground" data-testid="campaign-counts">
            في الطابور {p.queued} · وصل {p.sent} · تعذر {p.failed}
            {c.status === "sending" ? ` · ينتظر ${p.waiting} (${etaAr(p.waiting)})` : ""}
            {p.cancelled > 0 ? ` · ألغي ${p.cancelled}` : ""}
            {p.skipped > 0 ? ` · لم يرسل لـ${p.skipped}` : ""}
          </p>
          {c.stages.length > 1 && (
            <ul className="mt-1 grid gap-0.5 text-read text-muted-foreground" data-testid="campaign-stages">
              {c.stages.map((st, i) => (
                <li key={st.at}>
                  اليوم {i + 1} ({fmtDateTime(st.at)}): {st.count}
                  {st.sent !== null ? ` · وصل ${st.sent} · تعذر ${st.failed} · ينتظر ${st.waiting}` : ""}
                </li>
              ))}
            </ul>
          )}
          {c.fromEmail && <p className="mt-1 text-read text-muted-foreground">من <span dir="ltr">{c.fromEmail}</span></p>}
          {c.status === "stopped" && c.stoppedAt && (
            <p className="mt-1 text-read text-muted-foreground">أوقفها {c.stoppedByName ?? "مدير"} {fmtDateTime(c.stoppedAt)}</p>
          )}
        </>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {c.status === "draft" && <Button icon={Pencil} disabled={busy} onClick={onOpen}>افتح</Button>}
        {c.status === "sending" && <Button tone="danger" icon={Square} disabled={busy} onClick={onStop}>أوقف</Button>}
        <Button icon={Copy} loading={busy} onClick={onDuplicate}>انسخها</Button>
        {c.status === "draft" && <Button tone="ghost" icon={Trash2} disabled={busy} onClick={onDelete}>احذف</Button>}
      </div>
    </Card>
  );
}

function StopDialog({ c, onClose, onDone }: { c: Campaign; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const stop = async () => {
    setBusy(true);
    try {
      const out = await apiPost<{ cancelled: number; sent: number }>(`/api/admin/bulk-mail/campaigns/${c.id}/stop`);
      toast(`أوقفت. ألغي ${out.cancelled}، ووصل قبلها ${out.sent}`);
      onDone();
    } catch (e) { toastError(err(e, "تعذر الإيقاف")); setBusy(false); }
  };
  return (
    <Modal onClose={onClose} label="أتوقف الحملة؟" panelClassName="w-full max-w-lg">
      <Inset dir="rtl" tone="solid" className="text-foreground sm:p-6">
        <h2 className="text-sm font-black">أتوقف «{c.subject}»؟</h2>
        <div className="mt-4 grid gap-3">
          <div>
            <Button tone="danger" loading={busy} onClick={() => void stop()}>أوقفها</Button>
            <p className="mt-1 text-read text-muted-foreground">لا يرسل ما بقي ({c.progress.waiting}). وما وصل لا يرجع.</p>
          </div>
          <div>
            <Button tone="secondary" disabled={busy} onClick={onClose}>دعها ترسل</Button>
            <p className="mt-1 text-read text-muted-foreground">تكمل حتى آخر شخص.</p>
          </div>
        </div>
      </Inset>
    </Modal>
  );
}

/* ─────────── الحملة: القائمة، ثم الرسالة، ثم الإرسال ─────────── */

interface Draft { subject: string; body: string; buttonLabel: string; buttonUrl: string; audience: string }

function CampaignEditor({ id, audiences, reloadAudiences, onClose }: {
  id: string; audiences: Audiences | null; reloadAudiences: () => Promise<void>; onClose: () => void
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState("");
  const [uploading, setUploading] = useState(false);
  const [check, setCheck] = useState<Check | null>(null);
  const [html, setHtml] = useState("");

  useEffect(() => {
    void apiGet<{ campaigns: Campaign[] }>("/api/admin/bulk-mail/campaigns").then((d) => {
      const c = d.campaigns.find((x) => x.id === id);
      if (!c) { onClose(); return; }
      const next = { subject: c.subject, body: c.body, buttonLabel: c.buttonLabel ?? "", buttonUrl: c.buttonUrl ?? "", audience: c.audience ?? "" };
      setDraft(next);
      setSaved(JSON.stringify(next));
    });
  }, [id, onClose]);

  /* المعاينةُ تتبع ما يُكتب — بعد توقّفه بنصف ثانية */
  const content = draft ? { subject: draft.subject, body: draft.body, buttonLabel: draft.buttonLabel || null, buttonUrl: draft.buttonUrl || null } : null;
  const contentKey = JSON.stringify(content);
  useEffect(() => {
    if (!content) return;
    const t = setTimeout(() => {
      void apiPost<{ html: string }>("/api/admin/bulk-mail/preview", content).then((r) => setHtml(r.html)).catch(() => {});
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- المفتاحُ النصّيُّ يغني عن الكائن
  }, [contentKey]);

  const all = useMemo(() => [...(audiences?.website ?? []), ...(audiences?.lists ?? [])], [audiences]);
  if (!draft) return null;
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const dirty = JSON.stringify(draft) !== saved;
  const chosen = all.find((a) => a.key === draft.audience);
  const ready = !!draft.subject.trim() && !!draft.body.trim() && !!chosen;

  const save = async (quiet = false) => {
    setBusy("save");
    try {
      await apiPut(`/api/admin/bulk-mail/campaigns/${id}`, { ...draft, audience: draft.audience || null, buttonLabel: draft.buttonLabel || null, buttonUrl: draft.buttonUrl || null });
      setSaved(JSON.stringify(draft));
      if (!quiet) toast("حفظت المسودة");
      return true;
    } catch (e) { toastError(err(e, "تعذر الحفظ")); return false; }
    finally { setBusy(""); }
  };
  const test = async () => {
    setBusy("test");
    try {
      const out = await apiPost<{ to: string; status: string; error: string | null }>("/api/admin/bulk-mail/test", content);
      if (out.status === "sent") toast(`أرسلنا التجربة إلى ${out.to}`);
      else if (out.status === "not_configured") toastError("البريد غير موصول. وصله من التكاملات ثم جرب");
      else toastError(out.error ?? "تعذر إرسال التجربة");
    } catch (e) { toastError(err(e, "تعذر إرسال التجربة")); }
    finally { setBusy(""); }
  };
  const review = async () => {
    if (dirty && !(await save(true))) return;
    setBusy("check");
    try { setCheck(await apiGet<Check>(`/api/admin/bulk-mail/campaigns/${id}/check?skipRecentDays=${SKIP_RECENT_DEFAULT}`)); }
    catch (e) { toastError(err(e, "تعذر حساب العدد")); }
    finally { setBusy(""); }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button tone="ghost" onClick={onClose}>رجوع إلى الحملات</Button>
        {dirty && <span className="text-read text-muted-foreground">تغييرات لم تحفظ</span>}
      </div>

      <Card>
        <h2 className="text-sm font-black">1. القائمة</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <StaffField label="من تصله الرسالة">
            <select value={draft.audience} onChange={(e) => set({ audience: e.target.value })} className={`${staffSelectCls} w-full`}>
              <option value="">اختر القائمة</option>
              {(audiences?.lists.length ?? 0) > 0 && (
                <optgroup label="قوائمك">
                  {audiences!.lists.map((a) => <option key={a.key} value={a.key}>{a.nameAr} ({a.count})</option>)}
                </optgroup>
              )}
              <optgroup label="من الموقع">
                {(audiences?.website ?? []).map((a) => <option key={a.key} value={a.key}>{a.nameAr} ({a.count})</option>)}
              </optgroup>
            </select>
          </StaffField>
          <Button icon={FileUp} onClick={() => setUploading(true)}>ارفع قائمة جديدة</Button>
        </div>
        {chosen && <p className="mt-2 text-read text-muted-foreground">{peopleAr(chosen.count)} قبل حذف من ألغى الاشتراك.</p>}
      </Card>

      <Card className="mt-3">
        <h2 className="text-sm font-black">2. الرسالة</h2>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div className="grid content-start gap-3">
            <StaffField label="العنوان">
              <input value={draft.subject} maxLength={BULK_SUBJECT_MAX} onChange={(e) => set({ subject: e.target.value })} className={`${staffControlCls} w-full`} />
            </StaffField>
            <StaffField label="النص" hint="تبدأ بـ«مرحبا» واسمه الأول إن كان معروفا. سطر فارغ يفصل الفقرات، والروابط تفتح بضغطة.">
              <textarea value={draft.body} maxLength={BULK_BODY_MAX} rows={10} onChange={(e) => set({ body: e.target.value })} className={`${staffAreaCls} w-full`} />
            </StaffField>
            <div className="grid gap-3 sm:grid-cols-2">
              <StaffField label="زر (اختياري)">
                <input value={draft.buttonLabel} maxLength={BULK_BUTTON_LABEL_MAX} placeholder="سجل الآن" onChange={(e) => set({ buttonLabel: e.target.value })} className={`${staffControlCls} w-full`} />
              </StaffField>
              <StaffField label="رابط الزر">
                <input value={draft.buttonUrl} dir="ltr" placeholder="https://" onChange={(e) => set({ buttonUrl: e.target.value })} className={`${staffControlCls} w-full`} />
              </StaffField>
            </div>
          </div>
          <div>
            <p className="mb-2 text-read font-bold">كما تصل</p>
            <iframe title="معاينة الرسالة" srcDoc={html} sandbox="" className="h-[32rem] w-full rounded-lg border border-border bg-white" />
          </div>
        </div>
      </Card>

      <Card className="mt-3">
        <h2 className="text-sm font-black">3. الإرسال</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button tone="confirm" icon={Send} loading={busy === "check"} disabled={!ready || !!busy} onClick={() => void review()}>أرسل</Button>
          <Button icon={Mail} loading={busy === "test"} disabled={!draft.subject.trim() || !draft.body.trim() || !!busy} onClick={() => void test()}>أرسل تجربة لي</Button>
          <Button tone="secondary" loading={busy === "save"} disabled={!dirty || !!busy} onClick={() => void save()}>احفظ مسودة</Button>
        </div>
        {!ready && <p className="mt-2 text-read text-muted-foreground">اختر القائمة واكتب العنوان والنص ليفتح الإرسال.</p>}
      </Card>

      {uploading && (
        <UploadList
          onClose={() => setUploading(false)}
          onSaved={async (listId) => { setUploading(false); await reloadAudiences(); set({ audience: `list:${listId}` }); }}
        />
      )}
      {check && <SendConfirm id={id} check={check} onClose={() => setCheck(null)} onTest={() => { setCheck(null); void test(); }} onSent={onClose} />}
    </>
  );
}

/* ─────────── التأكيد: العددُ بعينه، ومن لا تصله، وكم يأخذ ─────────── */

function SendConfirm({ id, check: first, onClose, onTest, onSent }: { id: string; check: Check; onClose: () => void; onTest: () => void; onSent: () => void }) {
  /* وتخطّي من وصلته حملةٌ قريبا — يُعاد العدُّ عند تغييره، فالعددُ المُرسَل هو ما يراه (٢٣ نوفمبر ٢٠٢٦، `SKIP_RECENT_DAYS`) */
  const [days, setDays] = useState<SkipRecentDays>(SKIP_RECENT_DEFAULT);
  const [check, setCheck] = useState<Check>(first);
  const [recounting, setRecounting] = useState(false);
  const changeDays = async (d: SkipRecentDays) => {
    setDays(d); setRecounting(true);
    try { setCheck(await apiGet<Check>(`/api/admin/bulk-mail/campaigns/${id}/check?skipRecentDays=${d}`)); }
    catch (e) { toastError(err(e, "تعذر حساب العدد")); }
    finally { setRecounting(false); }
  };
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const mustType = needsTypedCount(check.recipients);
  const typedOk = !mustType || typedCountMatches(typed, check.recipients);
  /* على مراحل: مفتوحٌ افتراضا فوق ألفين، والأرقامُ تُعدَّل، والباقي في اليوم الذي بعدها */
  const [staged, setStaged] = useState(stagedByDefault(check.recipients));
  const [caps, setCaps] = useState<number[]>([...DEFAULT_STAGE_CAPS]);
  const capsOk = caps.every((n) => Number.isInteger(n) && n >= 1);
  const plan = stagePlan(check.recipients, staged ? caps : null);
  const send = async () => {
    setBusy(true);
    try {
      const out = await apiPost<{ queued: number }>(`/api/admin/bulk-mail/campaigns/${id}/send`, {
        confirmCount: check.recipients, stages: staged ? caps : null, skipRecentDays: days,
      });
      toast(`بدأ الإرسال إلى ${peopleAr(out.queued)}`);
      onSent();
    } catch (e) { toastError(err(e, "تعذر الإرسال")); setBusy(false); }
  };
  return (
    <Modal onClose={onClose} label="تأكيد الإرسال" panelClassName="w-full max-w-lg">
      <Inset dir="rtl" tone="solid" className="text-foreground sm:p-6">
        <h2 className="text-sm font-black">أترسل الحملة؟</h2>
        <ul className="mt-3 grid gap-1 text-read" data-testid="send-confirm-lines">
          {confirmLinesAr(check).map((l) => <li key={l}>{l}</li>)}
        </ul>
        <p className="mt-1 text-read text-muted-foreground">من <span dir="ltr">{senderAr(check.from)}</span></p>

        <label className="mt-4 block text-read">
          <span className="block font-bold">تخط من وصلته حملة خلال</span>
          <select
            value={days} disabled={recounting} data-testid="skip-recent"
            onChange={(e) => void changeDays(Number(e.target.value) as SkipRecentDays)}
            className="mt-1 rounded-lg border border-border bg-card px-2 py-1"
          >
            {SKIP_RECENT_DAYS.map((d) => <option key={d} value={d}>{skipRecentAr(d)}</option>)}
          </select>
          <span className="mt-1 block text-muted-foreground">لا تصل الرسالة مرتين لنفس الشخص في أيام قليلة.</span>
        </label>
        {!check.mailOn && <p className="mt-2 text-read font-bold text-gold-ink">البريد غير موصول الآن: تنتظر الرسائل حتى يوصل.</p>}

        <label className="mt-4 flex items-start gap-2">
          <input type="checkbox" checked={staged} onChange={(e) => setStaged(e.target.checked)} className="mt-1" />
          <span>
            <span className="block text-read font-bold">أرسل على مراحل</span>
            <span className="block text-read text-muted-foreground">نطاق جديد يرسل الآلاف في يوم واحد قد يذهب للرسائل المزعجة. الأيام تحسب من الآن.</span>
          </span>
        </label>
        {staged && (
          <div className="mt-2 grid gap-2">
            <div className="flex flex-wrap gap-3">
              {caps.map((n, i) => (
                <label key={i} className="text-read">
                  اليوم {i + 1}
                  <input
                    value={n} inputMode="numeric" dir="ltr" aria-label={`عدد اليوم ${i + 1}`}
                    onChange={(e) => setCaps(caps.map((c, k) => (k === i ? Number(e.target.value.replace(/\D/g, "")) : c)))}
                    className={`${staffControlCls} ms-2 w-24`}
                  />
                </label>
              ))}
              <span className="self-center text-read text-muted-foreground">والباقي في اليوم {caps.length + 1}</span>
            </div>
            <ul className="grid gap-1 text-read" data-testid="send-stage-lines">
              {stageLinesAr(plan).map((l) => <li key={l}>{l}</li>)}
            </ul>
          </div>
        )}
        {mustType && (
          <label className="mt-4 block">
            <span className="block text-read leading-6 text-muted-foreground">{TYPE_COUNT_WHY_AR}</span>
            <input
              value={typed} inputMode="numeric" dir="ltr" placeholder={String(check.recipients)} aria-label="اكتب العدد"
              onChange={(e) => setTyped(e.target.value)} className={`${staffControlCls} mt-2 w-40`}
            />
          </label>
        )}
        <div className="mt-4 grid gap-3">
          <div>
            <Button tone="confirm" icon={Send} loading={busy} disabled={recounting || !typedOk || (staged && !capsOk)} onClick={() => void send()}>
              أرسل إلى {check.recipients}
            </Button>
            <p className="mt-1 text-read text-muted-foreground">
              {plan.length > 1
                ? `على ${plan.length} أيام. اليوم الأول يأخذ ${etaAr(plan[0])}. تقدر توقفها في أي وقت.`
                : `تبدأ الآن وتأخذ ${etaAr(check.recipients)}. تقدر توقفها في أي وقت.`}
            </p>
          </div>
          <div>
            <Button icon={Mail} disabled={busy} onClick={onTest}>أرسل تجربة لي أولا</Button>
            <p className="mt-1 text-read text-muted-foreground">تصل بريدك وحده، وتبقى الحملة مسودة.</p>
          </div>
          <div>
            <Button tone="secondary" disabled={busy} onClick={onClose}>ليس الآن</Button>
            <p className="mt-1 text-read text-muted-foreground">تبقى مسودة كما هي.</p>
          </div>
        </div>
      </Inset>
    </Modal>
  );
}

/* ─────────── القوائم ─────────── */

function Lists({ audiences, reload }: { audiences: Audiences | null; reload: () => Promise<void> }) {
  const [uploading, setUploading] = useState(false);
  const [renaming, setRenaming] = useState<Audience | null>(null);
  const [removing, setRemoving] = useState<Audience | null>(null);
  if (!audiences) return null;
  const idOf = (a: Audience) => a.key.slice("list:".length);
  return (
    <>
      <Button icon={FileUp} onClick={() => setUploading(true)}>ارفع قائمة</Button>
      <h2 className="mt-5 text-sm font-black">قوائمك</h2>
      {audiences.lists.length === 0 ? (
        <Card as="p" className="mt-2 text-read text-muted-foreground">لا قوائم بعد. ارفع ملف Excel أو CSV فيه عمود البريد.</Card>
      ) : (
        <div className="mt-2 grid gap-2">
          {audiences.lists.map((a) => (
            <Card key={a.key} className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-bold">{a.nameAr}</p>
                <p className="text-read text-muted-foreground">
                  {peopleAr(a.count)}
                  {a.fileName ? ` · ${a.fileName}` : ""}
                  {a.createdAt ? ` · ${fmtDateTime(a.createdAt)}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button tone="ghost" icon={Pencil} onClick={() => setRenaming(a)}>الاسم</Button>
                <Button tone="ghost" icon={Trash2} onClick={() => setRemoving(a)}>احذف</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <h2 className="mt-5 text-sm font-black">من الموقع</h2>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {audiences.website.map((a) => (
          <Card key={a.key} className="flex items-center justify-between gap-2">
            <span className="font-bold">{a.nameAr}</span>
            <span className="text-read text-muted-foreground">{peopleAr(a.count)}</span>
          </Card>
        ))}
      </div>
      {uploading && <UploadList onClose={() => setUploading(false)} onSaved={async () => { setUploading(false); await reload(); }} />}
      {renaming && <RenameList a={renaming} id={idOf(renaming)} onClose={() => setRenaming(null)} onDone={async () => { setRenaming(null); await reload(); }} />}
      {removing && <RemoveList a={removing} id={idOf(removing)} onClose={() => setRemoving(null)} onDone={async () => { setRemoving(null); await reload(); }} />}
    </>
  );
}

function UploadList({ onClose, onSaved }: { onClose: () => void; onSaved: (listId: string) => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const pick = async (f: File | undefined) => {
    if (!f) return;
    setFile(f); setPreview(null); setName(f.name.replace(/\.(xlsx|csv)$/i, "").slice(0, BULK_LIST_NAME_MAX));
    setBusy("read");
    try { setPreview(await apiPostFile<Preview>("/api/admin/bulk-mail/lists/preview", f)); }
    catch (e) { toastError(err(e, "تعذرت قراءة الملف")); setFile(null); }
    finally { setBusy(""); }
  };
  const save = async () => {
    if (!file) return;
    setBusy("save");
    try {
      const out = await apiPostFile<{ id: string; count: number }>(
        `/api/admin/bulk-mail/lists?name=${encodeURIComponent(name)}&file=${encodeURIComponent(file.name)}`, file,
      );
      toast(`حفظت القائمة: ${peopleAr(out.count)}`);
      await onSaved(out.id);
    } catch (e) { toastError(err(e, "تعذر الحفظ")); setBusy(""); }
  };
  return (
    <Modal onClose={onClose} label="رفع قائمة" panelClassName="w-full max-w-2xl">
      <Inset dir="rtl" tone="solid" className="text-foreground sm:p-6">
        <h2 className="text-sm font-black">ارفع قائمة</h2>
        <p className="mt-1 text-read text-muted-foreground">ملف Excel (xlsx) أو CSV فيه عمود البريد، وعمود الاسم إن وجد. حتى 60000 صف. لا نحفظ الملف، نحفظ العناوين فقط.</p>
        <input ref={input} type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
        <div className="mt-3">
          <Button icon={FileUp} loading={busy === "read"} onClick={() => input.current?.click()}>{file ? "اختر ملفا آخر" : "اختر الملف"}</Button>
          {file && <span className="ms-2 text-read text-muted-foreground" dir="ltr">{file.name}</span>}
        </div>

        {preview && (
          <>
            <ul className="mt-4 grid gap-1 text-read" data-testid="upload-preview-counts">
              <li>صفوف الملف: <b>{preview.totalRows}</b></li>
              <li>بريد صالح: <b>{preview.valid}</b></li>
              {preview.invalid > 0 && <li>بريد غير صالح لن يحفظ: <b>{preview.invalid}</b></li>}
              {preview.duplicates > 0 && <li>مكرر حذفناه: <b>{preview.duplicates}</b></li>}
              {/* والنطاقُ المخطوءُ يُصحَّح ولا يسقط (٢٣ نوفمبر ٢٠٢٦: «why not to fix these instead taking them off») */}
              {preview.corrected > 0 && <li>صححنا نطاقه المكتوب خطأ (مثل gmial.com): <b>{preview.corrected}</b></li>}
              {preview.optedOut > 0 && <li>ألغوا الاشتراك ولن تصلهم رسائل: <b>{preview.optedOut}</b></li>}
              <li className="text-muted-foreground">عمود البريد: {preview.emailColumn}{preview.nameColumn ? ` · عمود الاسم: ${preview.nameColumn}` : " · بلا عمود اسم"}</li>
            </ul>
            {preview.invalidSamples.length > 0 && (
              <p className="mt-2 text-read text-muted-foreground">
                مثل: {preview.invalidSamples.map((s) => `صف ${s.row} «${s.value || "فارغ"}»`).join("، ")}
              </p>
            )}
            <div className="mt-3 max-h-60 overflow-auto rounded-lg border border-border">
              <table className="w-full text-read">
                <thead><tr className="text-muted-foreground"><th className="p-2 text-start">البريد</th><th className="p-2 text-start">الاسم</th></tr></thead>
                <tbody>
                  {preview.sample.map((r) => (
                    <tr key={r.email} className="border-t border-border"><td className="p-2" dir="ltr">{r.email}</td><td className="p-2">{r.name ?? "—"}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4">
              <StaffField label="اسم القائمة">
                <input value={name} maxLength={BULK_LIST_NAME_MAX} onChange={(e) => setName(e.target.value)} className={`${staffControlCls} w-full`} />
              </StaffField>
            </div>
          </>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button tone="confirm" loading={busy === "save"} disabled={!preview || preview.valid === 0 || !!busy} onClick={() => void save()}>
            احفظ القائمة {preview ? `(${preview.valid})` : ""}
          </Button>
          <Button tone="secondary" disabled={busy === "save"} onClick={onClose}>ليس الآن</Button>
        </div>
      </Inset>
    </Modal>
  );
}

function RenameList({ a, id, onClose, onDone }: { a: Audience; id: string; onClose: () => void; onDone: () => Promise<void> }) {
  const [name, setName] = useState(a.nameAr);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await apiPut(`/api/admin/bulk-mail/lists/${id}`, { name }); await onDone(); }
    catch (e) { toastError(err(e, "تعذر الحفظ")); setBusy(false); }
  };
  return (
    <Modal onClose={onClose} label="اسم القائمة" panelClassName="w-full max-w-md">
      <Inset dir="rtl" tone="solid" className="text-foreground sm:p-6">
        <StaffField label="اسم القائمة">
          <input value={name} maxLength={BULK_LIST_NAME_MAX} onChange={(e) => setName(e.target.value)} className={`${staffControlCls} w-full`} />
        </StaffField>
        <div className="mt-4 flex gap-2">
          <Button tone="confirm" loading={busy} disabled={!name.trim()} onClick={() => void save()}>احفظ</Button>
          <Button tone="secondary" disabled={busy} onClick={onClose}>ليس الآن</Button>
        </div>
      </Inset>
    </Modal>
  );
}

function RemoveList({ a, id, onClose, onDone }: { a: Audience; id: string; onClose: () => void; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    setBusy(true);
    try { await apiDelete(`/api/admin/bulk-mail/lists/${id}`); toast("حذفت القائمة"); await onDone(); }
    catch (e) { toastError(err(e, "تعذر الحذف")); setBusy(false); }
  };
  return (
    <Modal onClose={onClose} label={`أتحذف ${a.nameAr}؟`} panelClassName="w-full max-w-lg">
      <Inset dir="rtl" tone="solid" className="text-foreground sm:p-6">
        <h2 className="text-sm font-black">أتحذف «{a.nameAr}»؟</h2>
        <div className="mt-4 grid gap-3">
          <div>
            <Button tone="danger" loading={busy} onClick={() => void remove()}>احذفها</Button>
            <p className="mt-1 text-read text-muted-foreground">تحذف عناوينها ({a.count}). الحملات التي أرسلت لها تبقى، والمسودات عليها تحتاج قائمة أخرى.</p>
          </div>
          <div>
            <Button tone="secondary" disabled={busy} onClick={onClose}>ليس الآن</Button>
            <p className="mt-1 text-read text-muted-foreground">تبقى كما هي.</p>
          </div>
        </div>
      </Inset>
    </Modal>
  );
}
