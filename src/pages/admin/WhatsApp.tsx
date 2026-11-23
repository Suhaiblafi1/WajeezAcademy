/* «واتساب» — إرسالٌ ومحادثاتٌ وموافقاتٌ وربط في مكانٍ واحد (٢٤ نوفمبر ٢٠٢٦).

   طلبُ صاحب المنصّة: «ابنه لي في الادمن لارسل واتس اب براحتي». فمن «إرسال» يختار القائمةَ والقالب ويرى من تصله ومن لا
   ولماذا، ومن «المحادثات» يردّ بنصٍّ حرٍّ ما دامت نافذةُ Meta مفتوحة. والخادمُ في `server/services/whatsapp/`. */

import { useCallback, useEffect, useState } from "react";
import { Send, Square } from "lucide-react";
import AdminLayout from "./AdminLayout";
import TabBar from "@/components/ui/TabBar";
import { Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import Chip, { type ChipTone } from "@/components/ui/Chip";
import Modal from "@/components/Modal";
import { StaffField, staffAreaCls, staffControlCls, staffSelectCls } from "@/components/FormKit";
import { toast, toastError } from "@/components/Toast";
import { apiGet, apiPost, apiPut, ApiError } from "@/services/api";
import { fmtDateTime } from "@/application/text/format-ar";
import { peopleAr } from "@/application/marketing/bulk-mail";
import {
  WA_CAMPAIGN_AR, WA_CATEGORY_AR, WA_MESSAGE_AR, WA_NAME_PARAM, WA_PARAM_MAX, WA_REPLY_MAX, waSkippedAr,
  type WaCampaignStatus, type WaCategory, type WaCheck, type WaConsentKind, type WaMessageStatus,
} from "@/application/marketing/whatsapp-send";

interface Config {
  enabled: boolean; ready: boolean; missing: string[]; dailyCap: number
  phoneNumberId: string; wabaId: string; token: string; appSecret: string; verifyToken: string; webhookUrl: string
}
interface Template { name: string; language: string; category: WaCategory; body: string; slots: number; unsupportedAr: string | null }
interface Audience { key: string; nameAr: string; utility: number; marketing: number }
interface Check extends WaCheck { category: WaCategory; preview: string }
interface Campaign {
  id: string; status: WaCampaignStatus; template: string; category: WaCategory; audienceAr: string
  queuedCount: number; createdAt: string; counts: Partial<Record<WaMessageStatus, number>>
}
interface Thread { tail: string; phone: string; name: string | null; body: string; direction: string; createdAt: string; unread: number; stopped: boolean; open: boolean }
interface Message { id: string; direction: string; status: WaMessageStatus; body: string; error: string | null; createdAt: string }

const err = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);
const TONE: Record<WaCampaignStatus, ChipTone> = { sending: "info", sent: "positive", stopped: "warn" };

type Tab = "send" | "threads" | "consents" | "connect";

export default function WhatsApp() {
  const [tab, setTab] = useState<Tab>("send");
  const [config, setConfig] = useState<Config | null>(null);
  const load = useCallback(() => apiGet<Config>("/api/admin/whatsapp/config").then(setConfig).catch(() => setConfig(null)), []);
  useEffect(() => { void load(); }, [load]);
  return (
    <AdminLayout title="واتساب">
      <TabBar
        ariaLabel="أقسام واتساب" value={tab} onChange={setTab}
        items={[{ id: "send", label: "إرسال" }, { id: "threads", label: "المحادثات" }, { id: "consents", label: "الموافقات" }, { id: "connect", label: "الربط" }]}
      />
      <div className="mt-4">
        {config && !config.ready && tab !== "connect" && (
          <p className="mb-3 text-read font-bold text-gold-ink">الإرسال مغلق الآن. أكمل «الربط» ثم افتحه.</p>
        )}
        {tab === "send" && <Sending />}
        {tab === "threads" && <Threads />}
        {tab === "consents" && <Consents />}
        {tab === "connect" && config && <Connect config={config} onSaved={setConfig} />}
      </div>
    </AdminLayout>
  );
}

/* ─────────── إرسال ─────────── */

function Sending() {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [problem, setProblem] = useState("");
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [audience, setAudience] = useState("all");
  const [picked, setPicked] = useState("");
  const [params, setParams] = useState<string[]>([]);
  const [check, setCheck] = useState<Check | null>(null);
  const [busy, setBusy] = useState("");

  const loadCampaigns = useCallback(() => apiGet<{ campaigns: Campaign[] }>("/api/admin/whatsapp/campaigns").then((d) => setCampaigns(d.campaigns)).catch(() => {}), []);
  useEffect(() => {
    void apiGet<{ templates: Template[] }>("/api/admin/whatsapp/templates").then((d) => setTemplates(d.templates))
      .catch((e) => { setTemplates([]); setProblem(err(e, "لم نقرأ القوالب")); });
    void apiGet<{ audiences: Audience[] }>("/api/admin/whatsapp/audiences").then((d) => setAudiences(d.audiences)).catch(() => {});
    void loadCampaigns();
  }, [loadCampaigns]);
  const live = campaigns.some((c) => c.status === "sending");
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => { void loadCampaigns(); }, 5_000);
    return () => clearInterval(t);
  }, [live, loadCampaigns]);

  const template = templates?.find((t) => `${t.name}|${t.language}` === picked) ?? null;
  const choose = (key: string) => {
    setPicked(key);
    const t = templates?.find((x) => `${x.name}|${x.language}` === key);
    setParams(Array.from({ length: t?.slots ?? 0 }, (_, i) => (i === 0 ? WA_NAME_PARAM : "")));
  };
  const input = template && { template: template.name, language: template.language, params, audience };
  const review = async () => {
    setBusy("check");
    try { setCheck(await apiPost<Check>("/api/admin/whatsapp/check", input)); }
    catch (e) { toastError(err(e, "تعذر الفحص")); }
    finally { setBusy(""); }
  };
  const send = async () => {
    if (!check) return;
    setBusy("send");
    try {
      const out = await apiPost<{ queued: number }>("/api/admin/whatsapp/send", { ...input, confirmCount: check.recipients });
      toast(`بدأ الإرسال إلى ${peopleAr(out.queued)}`);
      setCheck(null);
      await loadCampaigns();
    } catch (e) { toastError(err(e, "تعذر الإرسال")); }
    finally { setBusy(""); }
  };
  const stop = async (id: string) => {
    setBusy(id);
    try { const out = await apiPost<{ cancelled: number }>(`/api/admin/whatsapp/campaigns/${id}/stop`); toast(`أوقف. ألغيت ${out.cancelled}`); await loadCampaigns(); }
    catch (e) { toastError(err(e, "تعذر الإيقاف")); }
    finally { setBusy(""); }
  };
  const skipped = check && waSkippedAr(check);

  return (
    <div className="grid gap-4">
      <Card>
        <div className="grid gap-3">
          <StaffField label="القائمة">
            <select value={audience} onChange={(e) => setAudience(e.target.value)} className={`${staffSelectCls} w-full`}>
              {audiences.map((a) => <option key={a.key} value={a.key}>{`${a.nameAr} (خدمة ${a.utility} · تسويق ${a.marketing})`}</option>)}
            </select>
          </StaffField>
          <StaffField label="القالب">
            <select value={picked} onChange={(e) => choose(e.target.value)} className={`${staffSelectCls} w-full`}>
              <option value="">اختر القالب</option>
              {templates?.map((t) => (
                <option key={`${t.name}|${t.language}`} value={`${t.name}|${t.language}`} disabled={!!t.unsupportedAr}>
                  {`${t.name} (${t.language}) · ${WA_CATEGORY_AR[t.category]}${t.unsupportedAr ? ` · ${t.unsupportedAr}` : ""}`}
                </option>
              ))}
            </select>
          </StaffField>
          {problem && <p className="text-read text-muted-foreground">{problem}</p>}
          {template && (
            <>
              <Inset><p className="whitespace-pre-wrap text-read">{template.body}</p></Inset>
              {params.map((p, i) => (
                <StaffField key={i} label={`الخانة ${i + 1}`}>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-read">
                      <input type="checkbox" checked={p === WA_NAME_PARAM} onChange={(e) => setParams(params.map((x, k) => (k === i ? (e.target.checked ? WA_NAME_PARAM : "") : x)))} />
                      الاسم الأول
                    </label>
                    {p !== WA_NAME_PARAM && (
                      <input value={p} maxLength={WA_PARAM_MAX} aria-label={`نص الخانة ${i + 1}`} onChange={(e) => setParams(params.map((x, k) => (k === i ? e.target.value : x)))} className={`${staffControlCls} flex-1`} />
                    )}
                  </div>
                </StaffField>
              ))}
            </>
          )}
          <div>
            <Button tone="primary" loading={busy === "check"} disabled={!template || params.some((p) => !p.trim())} onClick={() => void review()}>راجع من تصله</Button>
          </div>
        </div>
      </Card>

      {campaigns.length === 0 ? <Card as="p" className="text-read text-muted-foreground">لم ترسل شيئا بعد.</Card> : campaigns.map((c) => (
        <Card key={c.id}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-black" dir="ltr">{c.template}</p>
              <p className="mt-1 text-read text-muted-foreground">{c.audienceAr} · {WA_CATEGORY_AR[c.category]} · {fmtDateTime(c.createdAt)}</p>
            </div>
            <Chip tone={TONE[c.status]} srPrefixAr="الحالة">{WA_CAMPAIGN_AR[c.status]}</Chip>
          </div>
          <p className="mt-2 text-read text-muted-foreground">
            {[`العدد ${c.queuedCount}`, ...(["queued", "sent", "delivered", "read", "failed", "cancelled"] as const).filter((s) => c.counts[s]).map((s) => `${WA_MESSAGE_AR[s]} ${c.counts[s]}`)].join(" · ")}
          </p>
          {c.status === "sending" && <div className="mt-3"><Button tone="secondary" size="sm" icon={Square} loading={busy === c.id} onClick={() => void stop(c.id)}>أوقف</Button></div>}
        </Card>
      ))}

      {check && (
        <Modal onClose={() => setCheck(null)} label="تأكيد الإرسال" panelClassName="w-full max-w-lg">
          <Inset dir="rtl" tone="solid" className="text-foreground sm:p-6">
            <h2 className="text-sm font-black">أترسل الرسالة؟</h2>
            <p className="mt-3 text-read">تصل {peopleAr(check.recipients)} في «{check.audienceAr}» · {WA_CATEGORY_AR[check.category]}</p>
            {skipped && <p className="mt-1 text-read text-muted-foreground">{skipped}</p>}
            <Inset className="mt-3"><p className="whitespace-pre-wrap text-read">{check.preview}</p></Inset>
            <p className="mt-2 text-read text-muted-foreground">تحسب Meta ثمن كل رسالة تصل. والرسالة لا ترجع بعد أن تصل.</p>
            <div className="mt-4 flex gap-2">
              <Button tone="confirm" icon={Send} loading={busy === "send"} disabled={check.recipients === 0} onClick={() => void send()}>أرسل إلى {check.recipients}</Button>
              <Button tone="secondary" disabled={busy === "send"} onClick={() => setCheck(null)}>ليس الآن</Button>
            </div>
          </Inset>
        </Modal>
      )}
    </div>
  );
}

/* ─────────── المحادثات ─────────── */

function Threads() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [tail, setTail] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => apiGet<{ threads: Thread[] }>("/api/admin/whatsapp/threads").then((d) => setThreads(d.threads)).catch(() => {}), []);
  const open = useCallback((t: string) => apiGet<{ messages: Message[] }>(`/api/admin/whatsapp/threads/${t}`).then((d) => setMessages(d.messages)).catch(() => {}), []);
  useEffect(() => {
    const tick = () => { void load(); if (tail) void open(tail); };
    tick();
    const t = setInterval(tick, 10_000);
    return () => clearInterval(t);
  }, [load, open, tail]);
  const pick = (t: string) => { setTail(t); setText(""); setMessages([]); };
  const current = threads.find((t) => t.tail === tail);
  const send = async () => {
    setBusy(true);
    try { await apiPost(`/api/admin/whatsapp/threads/${tail}/reply`, { body: text }); setText(""); }
    catch (e) { toastError(err(e, "لم تصل")); }
    finally { setBusy(false); await open(tail); }
  };
  if (threads.length === 0) return <Card as="p" className="text-read text-muted-foreground">لم يراسلك أحد بعد.</Card>;
  return (
    <div className="grid gap-4 md:grid-cols-[18rem_1fr]">
      <ul className="grid content-start gap-2">
        {threads.map((t) => (
          <li key={t.tail}>
            <button type="button" aria-pressed={t.tail === tail} onClick={() => pick(t.tail)} className={`w-full border-s-2 p-3 text-start ${t.tail === tail ? "border-primary" : "border-transparent"}`}>
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-black">{t.name ?? <span dir="ltr">{t.phone}</span>}</span>
                {t.unread > 0 && <Chip tone="info">{t.unread}</Chip>}
              </span>
              <span className="mt-1 block truncate text-read text-muted-foreground">{t.body}</span>
            </button>
          </li>
        ))}
      </ul>
      {current && (
        <Card>
          <p className="text-sm font-black">{current.name} <span dir="ltr">{current.phone}</span></p>
          <div className="mt-3 grid max-h-96 gap-2 overflow-y-auto">
            {messages.map((m) => (
              <Inset key={m.id} className={`max-w-prose ${m.direction === "in" ? "justify-self-start" : "justify-self-end"}`}>
                <p className="whitespace-pre-wrap text-read">{m.body}</p>
                <p className="mt-1 text-read text-muted-foreground">{fmtDateTime(m.createdAt)}{m.direction === "out" ? ` · ${WA_MESSAGE_AR[m.status]}` : ""}{m.error ? ` · ${m.error}` : ""}</p>
              </Inset>
            ))}
          </div>
          {current.stopped ? <p className="mt-3 text-read font-bold text-gold-ink">طلب ألا نراسله على واتساب.</p>
            : !current.open ? <p className="mt-3 text-read font-bold text-gold-ink">مضت 24 ساعة على آخر رسالة منه. أرسل له قالبا معتمدا.</p>
              : (
                <div className="mt-3 grid gap-2">
                  <textarea value={text} rows={3} maxLength={WA_REPLY_MAX} aria-label="الرد" onChange={(e) => setText(e.target.value)} className={`${staffAreaCls} w-full`} />
                  <div><Button tone="confirm" icon={Send} loading={busy} disabled={!text.trim()} onClick={() => void send()}>أرسل الرد</Button></div>
                </div>
              )}
        </Card>
      )}
    </div>
  );
}

/* ─────────── الموافقات ─────────── */

function Consents() {
  const [phones, setPhones] = useState("");
  const [kind, setKind] = useState<WaConsentKind>("utility");
  const [textAr, setTextAr] = useState("");
  const [busy, setBusy] = useState(false);
  const list = phones.split(/[\n,،;]+/).map((p) => p.trim()).filter(Boolean);
  const save = async () => {
    setBusy(true);
    try {
      const o = await apiPost<{ added: number; existing: number; invalid: number; optedOut: number }>("/api/admin/whatsapp/consents", { phones: list, kind, textAr });
      toast(`سجلنا ${o.added} · مسجل قبل ${o.existing} · غير صالح ${o.invalid} · طلب الإيقاف ${o.optedOut}`);
      setPhones("");
    } catch (e) { toastError(err(e, "تعذر الحفظ")); }
    finally { setBusy(false); }
  };
  return (
    <div className="grid gap-4">
      <Card>
        <h2 className="text-sm font-black">كيف تزيد من تراسلهم</h2>
        <p className="mt-2 text-read leading-7 text-muted-foreground">من يكتب «اشترك» لرقمك تسجل موافقته على التسويق. ومن يكتب «توقف» لا تصله رسالة بعدها.</p>
      </Card>
      <Card>
        <h2 className="text-sm font-black">سجل موافقات عندك</h2>
        <div className="mt-3 grid gap-3">
          <StaffField label="الأرقام بمفتاح الدولة، رقم في كل سطر">
            <textarea value={phones} rows={6} dir="ltr" onChange={(e) => setPhones(e.target.value)} className={`${staffAreaCls} w-full`} />
          </StaffField>
          <StaffField label="وافقوا على">
            <select value={kind} onChange={(e) => setKind(e.target.value as WaConsentKind)} className={`${staffSelectCls} w-full`}>
              <option value="utility">الحجز والتذكير فقط</option>
              <option value="marketing">العروض والدورات الجديدة</option>
            </select>
          </StaffField>
          <StaffField label="كيف وافقوا ومتى وعلى ماذا">
            <textarea value={textAr} rows={2} maxLength={500} onChange={(e) => setTextAr(e.target.value)} className={`${staffAreaCls} w-full`} />
          </StaffField>
          <p className="text-read text-muted-foreground">يحفظ النص باسمك دليلا. لا تسجل من لم يوافق: شكاواهم قد توقف رقمك.</p>
          <div><Button tone="confirm" loading={busy} disabled={list.length === 0 || textAr.trim().length < 10} onClick={() => void save()}>سجل {list.length}</Button></div>
        </div>
      </Card>
    </div>
  );
}

/* ─────────── الربط ─────────── */

function Connect({ config, onSaved }: { config: Config; onSaved: (c: Config) => void }) {
  const [f, setF] = useState({ ...config, dailyCap: String(config.dailyCap) });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const save = async (enabled: boolean) => {
    setBusy(true);
    try {
      const out = await apiPut<Config>("/api/admin/whatsapp/config", {
        enabled, phoneNumberId: f.phoneNumberId, wabaId: f.wabaId, token: f.token, appSecret: f.appSecret, verifyToken: f.verifyToken, dailyCap: Number(f.dailyCap) || 250,
      });
      onSaved(out);
      setF({ ...out, dailyCap: String(out.dailyCap) });
      toast(enabled ? "الإرسال مفتوح" : "حفظنا والإرسال مغلق");
    } catch (e) { toastError(err(e, "تعذر الحفظ")); }
    finally { setBusy(false); }
  };
  const fields = [["phoneNumberId", "معرف الرقم (Phone number ID)", "text"], ["wabaId", "معرف الحساب (WhatsApp Business Account ID)", "text"], ["token", "رمز الوصول الدائم", "password"], ["appSecret", "سر التطبيق (App secret)", "password"], ["verifyToken", "رمز التحقق — تختاره أنت وتكتبه في Meta", "password"]] as const;
  return (
    <Card>
      <p className="text-read">الحال: <span className="font-bold">{config.ready ? "الإرسال مفتوح" : "الإرسال مغلق"}</span>{config.missing.length > 0 ? ` · ينقص: ${config.missing.join("، ")}` : ""}</p>
      <div className="mt-3 grid gap-3">
        {fields.map(([k, label, type]) => (
          <StaffField key={k} label={label}>
            <input type={type} value={f[k]} dir="ltr" autoComplete="off" onChange={set(k)} className={`${staffControlCls} w-full`} />
          </StaffField>
        ))}
        <StaffField label="أقصى عدد أشخاص في اليوم">
          <input value={f.dailyCap} inputMode="numeric" dir="ltr" onChange={set("dailyCap")} className={`${staffControlCls} w-40`} />
        </StaffField>
        <StaffField label="عنوان Webhook — الصقه في Meta واشترك في messages">
          <input readOnly value={config.webhookUrl} dir="ltr" className={`${staffControlCls} w-full`} />
        </StaffField>
        <div className="flex flex-wrap gap-2">
          <Button tone="confirm" loading={busy} onClick={() => void save(true)}>احفظ وافتح الإرسال</Button>
          <Button tone="secondary" disabled={busy} onClick={() => void save(false)}>احفظ والإرسال مغلق</Button>
        </div>
      </div>
    </Card>
  );
}
