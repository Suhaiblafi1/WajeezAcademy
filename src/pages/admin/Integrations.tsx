/* شاشة التكاملات — مزود الدفع والبريد من مكان واحد بصلاحية settings.manage.
   القراءة مقنَّعة (آخر 4 خانات)، الحفظ يتجاهل القناع ولا يمسح السر المخزن،
   وفحصا الاتصال حيان يضربان خادم المزود/البريد فعلا. متغيرات البيئة تغلب كل شيء. */

import { useCallback, useEffect, useState } from "react";
import { toast, toastError } from "@/components/Toast";
import { CalendarClock, CreditCard, Loader2, Mail, MessageCircle, PlugZap, RefreshCw, Send, ServerOff, ShieldCheck, Video } from "lucide-react";
import AdminLayout from "./AdminLayout";
import { apiGet, apiPost, apiPut, ApiError } from "@/services/api";
import { DEFAULT_SENDER_EMAIL } from "@/application/site/origin";
import { TRAINER_INTERVIEW } from "@/application/trainer/application-options";
import { calendlyCardNotice } from "@/lib/calendly-card";
import { WHATSAPP_SPOTS, isValidWhatsApp, normalizeWhatsApp } from "@/application/site/whatsapp";
import { setWhatsAppNumbers } from "@/services/whatsapp";
import { fmtDateTime } from "@/application/text/format-ar";

import { Card, Inset, Panel } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { staffControlCls as inputCls } from "@/components/FormKit";
const labelCls = "block text-fine font-bold text-muted-foreground";

interface IntegrationsView {
  payment: {
    enabled: boolean; driver: "test" | "manual" | "moyasar" | "stripe"; envSourced: boolean;
    siteUrl: string; siteUrlExplicit: boolean;
    publishableKey: string; secretKey: string; webhookSecret: string; hasSecret: boolean; hasWebhookSecret: boolean;
  };
  email: {
    enabled: boolean; envSourced: boolean; apiKey: string; fromName: string; fromEmail: string; hasApiKey: boolean;
  };
  zoom: {
    enabled: boolean; envSourced: boolean; ready: boolean; missing: string[];
    accountId: string; clientId: string; clientSecret: string; hostEmail: string;
    hasAccountId: boolean; hasClientId: boolean; hasClientSecret: boolean;
    webhookSecret: string; hasWebhookSecret: boolean; webhookSecretEnvSourced: boolean; webhookUrl: string;
  };
  calendly: {
    enabled: boolean; envSourced: boolean; polling: boolean;
    signingKey: string; hasSigningKey: boolean; callbackUrl: string; siteUrlExplicit: boolean;
    token: string; hasToken: boolean; bookingUrl: string; guests: string;
  };
  whatsappHook: {
    enabled: boolean; envSourced: boolean; token: string; hasToken: boolean; url: string;
    pulse: { at: string; outcome: string; outcomeAr: string } | null;
  };
}

interface CalendlyRegisterReply {
  ok: boolean;
  message: string;
  outcome?: "existing" | "created" | "would_create";
}

const DRIVER_AR: Record<string, string> = {
  test: "اختباري — نجاح فوري بلا مال حقيقي",
  manual: "يدوي — تحويل بنكي/كاش تسجله المالية",
  moyasar: "Moyasar — صفحة دفع مستضافة (مدى/البطاقات)",
  stripe: "Stripe — صفحة Checkout مستضافة",
};

export default function Integrations() {
  const [view, setView] = useState<IntegrationsView | null>(null);
  const [offline, setOffline] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [payForm, setPayForm] = useState({ enabled: false, driver: "test", publishableKey: "", secretKey: "", webhookSecret: "" });
  const [mailForm, setMailForm] = useState({ enabled: false, apiKey: "", fromName: "", fromEmail: "" });
  const [testTo, setTestTo] = useState("");
  const [zoomForm, setZoomForm] = useState({ enabled: false, accountId: "", clientId: "", clientSecret: "", hostEmail: "", webhookSecret: "" });
  const [zoomProbe, setZoomProbe] = useState<{ ok: boolean; message: string } | null>(null);
  /* الرمزُ الشخصيُّ صار محفوظا مع المفتاح: المزامنةُ الدوريّةُ تسأل Calendly
     كلَّ خمس دقائق بلا إنسانٍ يلصقه. وعلّةُ النقض في `CalendlyConfig`. */
  const [calForm, setCalForm] = useState({ enabled: false, signingKey: "", token: "", bookingUrl: "", guests: "" });
  const [calProbe, setCalProbe] = useState<CalendlyRegisterReply | null>(null);
  /* أرقامُ واتساب — نداؤها مستقلٌّ عن `/api/admin/integrations`: هي في جدول
     الإعدادات نفسِه لكنّها ليست سرّا يُقنَّع، فلا تُخلط بمن يُقنَّع. */
  const [waForm, setWaForm] = useState<Record<string, string>>({});
  /* ربطُ منصّة محادثات واتساب — والرمزُ يولَّد هنا في المتصفّح ويُنسخ قبل الحفظ: الخادمُ لا
     يُعيد سرّا كاملا، فلو ولّده هو لَلزمه أن يُعيده (`saveWhatsAppHookConfig`) */
  const [hookForm, setHookForm] = useState({ enabled: false, token: "" });
  const [hookTokenFresh, setHookTokenFresh] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setOffline(null);
    try {
      const v = await apiGet<IntegrationsView>("/api/admin/integrations");
      setView(v);
      setPayForm({
        enabled: v.payment.enabled, driver: v.payment.driver,
        publishableKey: v.payment.publishableKey, secretKey: v.payment.secretKey, webhookSecret: v.payment.webhookSecret,
      });
      setMailForm({
        enabled: v.email.enabled, apiKey: v.email.apiKey, fromName: v.email.fromName, fromEmail: v.email.fromEmail,
      });
      setZoomForm({
        enabled: v.zoom.enabled, accountId: v.zoom.accountId, clientId: v.zoom.clientId,
        clientSecret: v.zoom.clientSecret, hostEmail: v.zoom.hostEmail === "me" ? "" : v.zoom.hostEmail,
        webhookSecret: v.zoom.webhookSecret,
      });
      setCalForm({
        enabled: v.calendly.enabled, signingKey: v.calendly.signingKey,
        token: v.calendly.token, bookingUrl: v.calendly.bookingUrl, guests: v.calendly.guests,
      });
      setHookForm({ enabled: v.whatsappHook.enabled, token: v.whatsappHook.token });
      setHookTokenFresh(false);
      const wa = await apiGet<{ numbers: Record<string, string> }>("/api/admin/integrations/whatsapp");
      setWaForm(wa.numbers ?? {});
      setWhatsAppNumbers(wa.numbers ?? {});
    } catch (e) { setOffline(e instanceof ApiError ? e.message : "الخادم غير متصل"); }
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

  /* الفحصُ والتسجيلُ نداءٌ واحدٌ يفرّقه `apply` — والرمزُ يُقرأ من المحفوظ،
     فما في الحقل مقنَّعٌ لا يصلح للإرسال. */
  const probeCalendly = async (apply: boolean) => {
    if (busy) return;
    setBusy(true);
    setCalProbe(null);
    try {
      const r = await apiPost<CalendlyRegisterReply>(
        "/api/admin/integrations/calendly/register", { apply },
      );
      setCalProbe(r);
      if (r.ok && r.outcome === "created") await load();
    } catch (e) {
      setCalProbe({ ok: false, message: e instanceof ApiError ? e.message : "تعذّر الاتصال بـCalendly" });
    } finally { setBusy(false); }
  };

  const testPayment = async () => {
    setBusy(true);
    try {
      const r = await apiPost<{ ok: boolean; message: string }>("/api/admin/integrations/payment/test");
      toast(r.message);
    } catch (e) { toastError(e instanceof ApiError ? e.message : "فشل الفحص"); }
    finally { setBusy(false); }
  };

  const testEmail = async () => {
    if (!testTo.includes("@")) { toast("أدخل بريدا صحيحا للاختبار"); return; }
    setBusy(true);
    try {
      const r = await apiPost<{ ok: boolean; message: string }>("/api/admin/integrations/email/test", { to: testTo });
      toastError(r.message ?? (r.ok ? "أرسل" : "فشل"));
    } catch (e) { toastError(e instanceof ApiError ? e.message : "فشل الإرسال التجريبي"); }
    finally { setBusy(false); }
  };

  /* ما لا يصلح يُسمّى قبل الحفظ لا بعده — فلا يُرسل رقمٌ يُرَدُّ من الخادم */
  const waBad = WHATSAPP_SPOTS.filter((sp) => (waForm[sp.key] ?? "").trim() && !isValidWhatsApp(waForm[sp.key]));

  const saveWhatsApp = async () => {
    if (waBad.length) { toastError(`رقم غير صالح في «${waBad[0].labelAr}»`); return; }
    /* تُرسَل كلُّ المواضعِ لا المملوءةَ وحدَها: الفراغُ عند الخادم محوٌ،
       فمن أفرغ خانةً أراد أن يرجع موضعُها إلى الرقم العامّ. */
    const payload: Record<string, string> = {};
    for (const sp of WHATSAPP_SPOTS) payload[sp.key] = (waForm[sp.key] ?? "").trim();
    await act(async () => {
      const r = await apiPut<{ numbers: Record<string, string> }>("/api/admin/integrations/whatsapp", { numbers: payload });
      setWhatsAppNumbers(r.numbers ?? {});
    }, "حفظت أرقام واتساب");
  };

  const newHookToken = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    setHookForm((f) => ({ ...f, token: Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("") }));
    setHookTokenFresh(true);
  };

  if (offline) {
    return (
      <AdminLayout title="التكاملات">
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

  const webhookUrl = `${window.location.origin.replace("7100", "7101")}/api/webhooks/payments/${payForm.driver}`;
  /* حالُ بطاقة Calendly تُقرَّر في دالّةٍ خالصةٍ محروسة، لا في شرطٍ هنا */
  const calNotice = view ? calendlyCardNotice(view.calendly) : null;

  return (
    <AdminLayout title="التكاملات — الدفع والبريد">

      {loading || !view ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" /></div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* ════ أرقامُ واتساب ════

              أوّلَ الشاشةِ وعرضَ العمودين: هو أكثرُ ما يتغيّر (رقمُ مستشارٍ
              يُبدَّل في يوم)، وليس فيه سرٌّ يُقنَّع — فلا يُدفن بين المفاتيح. */}
          <Panel as="section" className="lg:col-span-2">
            <p className="flex items-center gap-2 text-sm font-black">
              <MessageCircle className="h-4 w-4 text-teal-ink" /> أرقام واتساب — لكلّ موضع رقمه
            </p>
            <p className="mt-1 text-read leading-6 text-muted-foreground">
              كلّ زرّ واتساب في الموقع هنا باسمه ومكانه. الخانة الفارغة تستخدم رقم
              «مراسلة مستشار وجيز» — فيكفي رقم واحد إن أردت.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {WHATSAPP_SPOTS.map((sp) => {
                const raw = waForm[sp.key] ?? "";
                const bad = Boolean(raw.trim()) && !isValidWhatsApp(raw);
                return (
                  <div key={sp.key}>
                    <label className={labelCls} htmlFor={`wa-${sp.key}`}>{sp.labelAr}</label>
                    <input
                      id={`wa-${sp.key}`}
                      dir="ltr"
                      inputMode="tel"
                      value={raw}
                      onChange={(e) => setWaForm({ ...waForm, [sp.key]: e.target.value })}
                      placeholder="962771052222"
                      className={`${inputCls} mt-1 w-full font-mono ${bad ? "border-red-400/60" : ""}`}
                    />
                    <p className="mt-1 text-read leading-5 text-muted-foreground">يظهر في: {sp.whereAr}</p>
                    {bad && (
                      <p className="mt-1 text-read leading-5 font-bold text-red-300">
                        أرقام فقط بصيغة دوليّة بلا «+» ولا صفرين — من ٨ إلى ١٥ خانة.
                      </p>
                    )}
                    {/* ما سيُحفظ فعلا يُرى قبل الحفظ: من لصق «+962 77…» يطمئنّ
                        أنّ المحفوظ صورةٌ أخرى، ولا يظنّ أنّ شيئا ضاع. */}
                    {!bad && raw.trim() && normalizeWhatsApp(raw) !== raw.trim() && (
                      <p className="mt-1 text-read leading-5 text-muted-foreground">
                        يحفظ هكذا: <span dir="ltr" className="font-mono text-teal-light-ink">{normalizeWhatsApp(raw)}</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <Button tone="confirm" disabled={busy || waBad.length > 0} onClick={() => void saveWhatsApp()} className="mt-4">
              حفظ أرقام واتساب
            </Button>
          </Panel>

          {/* ════ مزود الدفع ════ */}
          <Panel as="section">
            <p className="flex items-center gap-2 text-sm font-black"><CreditCard className="h-4 w-4 text-gold-ink" /> مزود الدفع</p>
            <p className="mt-1 text-read leading-5 text-muted-foreground">
              المزودان الحقيقيان يستخدمان صفحات دفع لديهم — بيانات البطاقات لا تمرّ بخوادمنا أبدا،
              والتسوية عبر webhook موقّع فقط.
            </p>
            {view.payment.envSourced && (
              <Inset as="p" tone="warn" className="mt-3 px-3 py-2 text-read font-bold text-gold-ink">
                يدار هذا التكامل من متغيرات البيئة (PAYMENT_DRIVER…) — الحفظ هنا لا يؤثّر حتّى تحذفها.
              </Inset>
            )}
            <div className="mt-4 space-y-3">
              <div>
                <label className={labelCls}>المزود الفعال</label>
                <select value={payForm.driver} onChange={(e) => setPayForm({ ...payForm, driver: e.target.value as typeof payForm.driver })} className={`${inputCls} mt-1 w-full`}>
                  {Object.entries(DRIVER_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              {(payForm.driver === "moyasar" || payForm.driver === "stripe") && (
                <>
                  <div>
                    <label className={labelCls}>المفتاح العلني (Publishable)</label>
                    <input dir="ltr" value={payForm.publishableKey} onChange={(e) => setPayForm({ ...payForm, publishableKey: e.target.value })}
                      placeholder={view.payment.publishableKey || "pk_live_… / pk_test_…"} className={`${inputCls} mt-1 w-full font-mono`} />
                  </div>
                  <div>
                    <label className={labelCls}>المفتاح السري (Secret) — يخزّن ولا يعرض كاملا أبدا</label>
                    <input dir="ltr" type="password" value={payForm.secretKey} onChange={(e) => setPayForm({ ...payForm, secretKey: e.target.value })}
                      placeholder={view.payment.hasSecret ? view.payment.secretKey : "sk_live_… / sk_test_…"} className={`${inputCls} mt-1 w-full font-mono`} />
                  </div>
                  <div>
                    <label className={labelCls}>سر التوقيع للـ webhook</label>
                    <input dir="ltr" type="password" value={payForm.webhookSecret} onChange={(e) => setPayForm({ ...payForm, webhookSecret: e.target.value })}
                      placeholder={view.payment.hasWebhookSecret ? view.payment.webhookSecret : "whsec_… أو رمز مشترك"} className={`${inputCls} mt-1 w-full font-mono`} />
                  </div>
                  {/* عنوانُ الموقع — يُرى قبل الحفظ لا بعد الرفض.

                      روابطُ عودة المشتري (نجاح/إلغاء) تُبنى منه وقتَ إنشاء جلسة
                      الدفع. وبلا ضبطٍ صريح يصير الاحتياطيُّ `localhost`، فيعود
                      من دفع إلى عنوانٍ لا يفتح عنده — والـwebhook مستقلّ، فيُسوّى
                      الطلبُ وتبقى سجلّاتُنا خضراء والعطبُ عند المشتري وحدَه. */}
                  {!view.payment.siteUrlExplicit && (
                    <Inset as="p" tone="danger" className="px-3 py-2 text-read font-bold leading-5 text-red-300">
                      اضبط <span dir="ltr" className="font-mono">APP_URL</span> بعنوان الموقع في بيئة الخادم أوّلا — لا يمكن التفعيل بدونه.
                      <span className="mt-1 block font-normal text-red-300/75">
                        العنوان المستعمل الآن: <span dir="ltr" className="font-mono">{view.payment.siteUrl}</span> — ومنه تبنى صفحة عودة المشتري بعد الدفع.
                      </span>
                    </Inset>
                  )}
                  <Inset className="px-3 py-2 text-fine leading-5 text-muted-foreground">
                    <p className="font-bold text-foreground">عنوان الـ webhook — سجّله في لوحة المزود:</p>
                    <p dir="ltr" className="mt-0.5 select-all font-mono text-teal-light-ink">{webhookUrl}</p>
                    {/* كان هنا أنّ Stripe يحتاج «جسرا» يعيد إرسال التوقيع بترويسة
                        x-payment-signature. صار الخادمُ يقرأ ترويسة Stripe الرسميّة
                        `stripe-signature` أوّلا ويتحقّق من صيغتها الأصليّة
                        («t=…,v1=…» موقَّعةً على «الطابع.الجسم») بنافذةِ خمس دقائق —
                        فبقاءُ النصّ القديم يدفع صاحبَ المنصّة إلى بناء ما لا لزوم له.
                        حارسُ الصيغة: server/tests/commerce/stripe-signature.test.ts */}
                    <p className="mt-1"><b className="text-foreground">Stripe:</b> أضف هذا العنوان في لوحته مباشرة وضع <span dir="ltr" className="font-mono">whsec_…</span> في «سر التوقيع» — بلا وسيط ولا رمز مشترك. والحدث المطلوب <span dir="ltr" className="font-mono">checkout.session.completed</span> فقط؛ غيره يسجّل ويهمل.</p>
                    <p className="mt-1"><b className="text-foreground">Moyasar:</b> أدخل «سر التوقيع» نفسه رمزا مشتركا في لوحتهم.</p>
                  </Inset>
                </>
              )}
              <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-foreground">
                <input type="checkbox" checked={payForm.enabled} onChange={(e) => setPayForm({ ...payForm, enabled: e.target.checked })} className="accent-gold" />
                تفعيل هذا المزود — بدون تفعيل يعمل المزود الاختباري
              </label>
              <div className="flex flex-wrap gap-2">
                <Button tone="confirm" disabled={busy} onClick={() => act(() => apiPut("/api/admin/integrations/payment", payForm), "حفظت إعدادات الدفع")}>
                  حفظ إعدادات الدفع
                </Button>
                <Button tone="secondary" disabled={busy} onClick={() => void testPayment()} className="text-teal-light-ink">
                  <PlugZap className="h-3.5 w-3.5" /> فحص الاتصال الحي
                </Button>
              </div>
            </div>
          </Panel>

          {/* ════ البريد ════ */}
          <Panel as="section">
            <p className="flex items-center gap-2 text-sm font-black"><Mail className="h-4 w-4 text-teal-ink" /> قناة البريد (Resend)</p>
            <p className="mt-1 text-read leading-5 text-muted-foreground">
              بعد التفعيل ترسل إشعارات البريد فعلا — قبول التسجيل والفواتير والشهادات.
              وبدونه تسجّل «فشل: لا مزود» وتعاد المحاولة تلقائيا.
            </p>
            {view.email.envSourced && (
              <Inset as="p" tone="warn" className="mt-3 px-3 py-2 text-read font-bold text-gold-ink">
                يدار هذا التكامل من متغيرات البيئة (RESEND_API_KEY…) — الحفظ هنا لا يؤثّر حتّى تحذفها.
              </Inset>
            )}
            <div className="mt-4 space-y-3">
              <div>
                <label className={labelCls}>مفتاح Resend API — يخزّن ولا يعرض كاملا أبدا</label>
                <input dir="ltr" type="password" value={mailForm.apiKey} onChange={(e) => setMailForm({ ...mailForm, apiKey: e.target.value })}
                  placeholder={view.email.hasApiKey ? view.email.apiKey : "re_…"} className={`${inputCls} mt-1 w-full font-mono`} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>اسم المرسل</label>
                  <input value={mailForm.fromName} onChange={(e) => setMailForm({ ...mailForm, fromName: e.target.value })}
                    placeholder="أكاديمية وجيز" className={`${inputCls} mt-1 w-full`} />
                </div>
                <div>
                  <label className={labelCls}>بريد المرسل</label>
                  <input dir="ltr" value={mailForm.fromEmail} onChange={(e) => setMailForm({ ...mailForm, fromEmail: e.target.value })}
                    placeholder={DEFAULT_SENDER_EMAIL} className={`${inputCls} mt-1 w-full font-mono`} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-foreground">
                  <input type="checkbox" checked={mailForm.enabled} onChange={(e) => setMailForm({ ...mailForm, enabled: e.target.checked })} className="accent-gold" />
                  تفعيل قناة البريد
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button tone="confirm" disabled={busy} onClick={() => act(() => apiPut("/api/admin/integrations/email", mailForm), "حفظت إعدادات البريد")}>
                  حفظ إعدادات البريد
                </Button>
                <div className="flex flex-1 items-center gap-2">
                  <input dir="ltr" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="بريد الاختبار…"
                    className={`${inputCls} min-w-0 flex-1 font-mono`} />
                  <Button tone="secondary" disabled={busy} onClick={() => void testEmail()} className="shrink-0 text-teal-light-ink">
                    <Send className="h-3.5 w-3.5" /> إرسال تجريبي
                  </Button>
                </div>
              </div>
            </div>
          </Panel>

          {/* ════ منصّةُ محادثات واتساب — تواصلُ المستشار يُسجَّل وحدَه ════

              المحادثةُ في منصّة التوزيع لا هنا، والتذكيرُ والعمولةُ يقومان على تواصلٍ مسجَّل.
              فالمنصّةُ تُخبرنا حين يراسل المستشارُ طالبا — والعلّةُ في `whatsapp-hook.service.ts`. */}
          <Panel as="section" className="lg:col-span-2">
            <p className="flex items-center gap-2 text-sm font-black">
              <MessageCircle className="h-4 w-4 text-teal-ink" /> ربط منصة محادثات واتساب
            </p>
            <p className="mt-1 text-read leading-6 text-muted-foreground">
              حين يراسل المستشار طالبا من المنصة، ترسل لنا المنصة طلبا فيسجل التواصل في حالة الطالب.
              فلا يذكر المستشار بما فعل، وتحسب عمولته.
            </p>
            {view.whatsappHook.envSourced && (
              <Inset as="p" className="mt-3 text-read leading-6 text-muted-foreground">
                الرمز مضبوط من بيئة الخادم (WHATSAPP_HOOK_TOKEN)، ولها الأولوية.
              </Inset>
            )}
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>عنوان الاستقبال — يضبط في المنصة</label>
                  <input dir="ltr" readOnly value={view.whatsappHook.url}
                    className={`${inputCls} mt-1 w-full font-mono opacity-70`} />
                </div>
                <div>
                  <label className={labelCls}>رمز الربط — يخزن ولا يعرض</label>
                  <div className="mt-1 flex gap-2">
                    <input dir="ltr" type={hookTokenFresh ? "text" : "password"} value={hookForm.token}
                      onChange={(e) => { setHookForm({ ...hookForm, token: e.target.value }); setHookTokenFresh(false); }}
                      placeholder={view.whatsappHook.hasToken ? view.whatsappHook.token : "…"}
                      className={`${inputCls} w-full font-mono`} />
                    <Button tone="secondary" size="sm" onClick={newHookToken}>أنشئ رمزا</Button>
                  </div>
                  {hookTokenFresh && (
                    <p className="mt-1 text-read leading-6 text-gold-ink">انسخ الرمز الآن وضعه في المنصة — لا يعرض بعد الحفظ.</p>
                  )}
                </div>
                <label className="flex items-center gap-2 text-read text-muted-foreground">
                  <input type="checkbox" checked={hookForm.enabled}
                    onChange={(e) => setHookForm({ ...hookForm, enabled: e.target.checked })} className="accent-gold" />
                  مفعّل
                </label>
                <Button tone="confirm" disabled={busy}
                  onClick={() => act(() => apiPut("/api/admin/integrations/whatsapp-hook", hookForm), "حفظ ربط منصة واتساب")}>
                  حفظ ربط المنصة
                </Button>
                <p className="text-read leading-6 text-muted-foreground">
                  {view.whatsappHook.pulse
                    ? `آخر طلب وصل: ${fmtDateTime(view.whatsappHook.pulse.at)} — ${view.whatsappHook.pulse.outcomeAr}`
                    : "لم يصل أي طلب بعد."}
                </p>
              </div>
              <Inset className="text-read leading-6 text-muted-foreground">
                <p className="font-bold text-foreground">ما ترسله المنصة عند كل رسالة من المستشار</p>
                <pre dir="ltr" className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-foreground">{`POST ${view.whatsappHook.url}
Authorization: Bearer <الرمز>
Content-Type: application/json

{
  "studentPhone": "962791234567",
  "advisorEmail": "advisor@example.com",
  "summary": "اختياري"
}`}</pre>
                <p className="mt-2">رقم الطالب كما يصل من واتساب. وبريد المستشار هو بريد حسابه هنا.</p>
                <p className="mt-1">يسجل التواصل لمستشار الحالة فقط، ومرة كل ست ساعات للحالة.</p>
              </Inset>
            </div>
          </Panel>

          {/* ════ Zoom ════ */}
          <Panel as="section">
            <p className="flex items-center gap-2 text-sm font-black"><Video className="h-4 w-4 text-teal-ink" /> اجتماعات Zoom</p>
            <p className="mt-1 text-read leading-5 text-muted-foreground">
              بعد إعداده ينشئ المدرّب والإدارة اجتماع اللقاء <b className="text-foreground">من داخل المنصّة</b>،
              ويصل رابطه إشعارا لكلّ مسجّل في الشعبة. وبدونه يلصق الرابط يدويّا لكلّ لقاء.
            </p>
            {/* «مفعّل» ليس «جاهز» — والفرقُ يُقال قبل أن يفشل أوّلُ لقاء */}
            {view.zoom.enabled && !view.zoom.ready && (
              <Inset as="p" tone="warn" className="mt-3 px-3 py-2 text-read font-bold text-gold-ink">
                مفعّل وغير مكتمل — ينقصه: {view.zoom.missing.join(" · ")}
              </Inset>
            )}
            {view.zoom.envSourced && (
              <Inset as="p" tone="warn" className="mt-3 px-3 py-2 text-read font-bold text-gold-ink">
                يدار هذا التكامل من متغيرات البيئة (ZOOM_ACCOUNT_ID…) — الحفظ هنا لا يؤثّر حتّى تحذفها.
              </Inset>
            )}
            <div className="mt-4 space-y-3">
              <div>
                <label className={labelCls}>معرّف الحساب — Account ID</label>
                <input dir="ltr" value={zoomForm.accountId} onChange={(e) => setZoomForm({ ...zoomForm, accountId: e.target.value })}
                  placeholder={view.zoom.hasAccountId ? view.zoom.accountId : "abcd…"} className={`${inputCls} mt-1 w-full font-mono`} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>معرّف التطبيق — Client ID</label>
                  <input dir="ltr" value={zoomForm.clientId} onChange={(e) => setZoomForm({ ...zoomForm, clientId: e.target.value })}
                    placeholder={view.zoom.hasClientId ? view.zoom.clientId : "…"} className={`${inputCls} mt-1 w-full font-mono`} />
                </div>
                <div>
                  <label className={labelCls}>سرّ التطبيق — يخزّن ولا يعرض</label>
                  <input dir="ltr" type="password" value={zoomForm.clientSecret} onChange={(e) => setZoomForm({ ...zoomForm, clientSecret: e.target.value })}
                    placeholder={view.zoom.hasClientSecret ? view.zoom.clientSecret : "…"} className={`${inputCls} mt-1 w-full font-mono`} />
                </div>
              </div>
              <div>
                <label className={labelCls}>بريد مضيف الاجتماعات — اتركه فارغا لصاحب التطبيق</label>
                <input dir="ltr" value={zoomForm.hostEmail} onChange={(e) => setZoomForm({ ...zoomForm, hostEmail: e.target.value })}
                  placeholder="lessons@wajeezacademy.com" className={`${inputCls} mt-1 w-full font-mono`} />
              </div>
              {/* ═══ أحداثُ Zoom — العنوانُ إلى لوحته، ورمزُه منها إلى هنا ═══
                  بلا الرمز يرفض Zoom العنوانَ ولا يصل حدث: لا حضورٌ ولا دخولُ مضيفٍ ولا تسجيل.
                  وكان لا يُضبط إلّا في الخادم — فمن أعدّ Zoom من هنا وحدَه بقيت أحداثُه صامتة. */}
              <div>
                <label className={labelCls}>عنوان الأحداث — يسجّل في Zoom ‹Event Subscriptions›</label>
                <input dir="ltr" readOnly value={view.zoom.webhookUrl}
                  className={`${inputCls} mt-1 w-full font-mono opacity-70`} />
              </div>
              <div>
                <label className={labelCls}>رمز التحقّق من الأحداث — Secret Token · يخزّن ولا يعرض</label>
                <input dir="ltr" type="password" value={zoomForm.webhookSecret} onChange={(e) => setZoomForm({ ...zoomForm, webhookSecret: e.target.value })}
                  placeholder={view.zoom.hasWebhookSecret ? view.zoom.webhookSecret : "…"} className={`${inputCls} mt-1 w-full font-mono`} />
                {view.zoom.webhookSecretEnvSourced && (
                  <p className="mt-1 text-read leading-6 text-gold-ink">
                    ‏ZOOM_WEBHOOK_SECRET مضبوط على الخادم — وله الأولويّة على ما يحفظ هنا حتّى يحذف.
                  </p>
                )}
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-foreground">
                <input type="checkbox" checked={zoomForm.enabled} onChange={(e) => setZoomForm({ ...zoomForm, enabled: e.target.checked })} className="accent-gold" />
                تفعيل إنشاء الاجتماعات من المنصّة
              </label>
              <div className="flex flex-wrap gap-2">
                {/* والبريدُ الفارغُ يُرسَل فارغا: فيعود المضيفُ صاحبَ التطبيق كما يعد عنوانُ حقله.
                    وكان يُحوَّل إلى لا شيء فيسقط من الطلب، والخادمُ يُبقي لما غاب قيمتَه القديمة. */}
                <Button tone="confirm" disabled={busy}
                  onClick={() => act(() => apiPut("/api/admin/integrations/zoom", { ...zoomForm, hostEmail: zoomForm.hostEmail.trim() }), "حفظت إعدادات Zoom")}>
                  حفظ إعدادات Zoom
                </Button>
                <Button tone="secondary" disabled={busy} className="text-teal-light-ink"
                  onClick={async () => {
                    setZoomProbe(null);
                    try { setZoomProbe(await apiPost<{ ok: boolean; message: string }>("/api/admin/integrations/zoom/test", {})); }
                    catch (e) { setZoomProbe({ ok: false, message: e instanceof ApiError ? e.message : "تعذّر الفحص" }); }
                  }}>
                  <Send className="h-3.5 w-3.5" /> فحص الاتصال
                </Button>
              </div>
              {zoomProbe && (
                <Inset as="p" tone={zoomProbe.ok ? "positive" : "danger"}
                  className={`text-read leading-6 ${zoomProbe.ok ? "text-emerald-200" : "text-red-200"}`}>
                  {zoomProbe.message}
                </Inset>
              )}
            </div>
          </Panel>

          {/* ════ Calendly — مقابلاتُ المتقدّمين ════

              الرابطُ وحدَه يعرض التقويم، ولا يُدخل الموعدَ عندنا. الذي يُدخله
              اشتراكُ webhook موقَّع — ولا تُنشئه لوحةُ Calendly بالضغط، بل
              واجهتُها البرمجيّة. فالزرُّ هنا يغني عن SSH وسطرِ الأوامر. */}
          <Panel>
            <p className="flex items-center gap-2 text-sm font-black">
              <CalendarClock className="h-4 w-4 text-teal-ink" /> مقابلات Calendly
            </p>
            <p className="mt-1 text-read leading-6 text-muted-foreground">
              يسجّل موعد المقابلة عندنا حين يحجزه المتقدّم، ويلغى حين يلغيه.
            </p>
            {calNotice && (
              <Inset as="p" tone={calNotice.tone === "danger" ? "danger" : "positive"}
                className={`mt-3 text-read leading-6 ${calNotice.tone === "danger" ? "text-red-200" : "text-emerald-200"}`}>
                {calNotice.textAr}
              </Inset>
            )}
            {view.calendly.envSourced && (
              <Inset as="p" className="mt-3 text-read leading-6 text-muted-foreground">
                المفتاح مضبوط من بيئة الخادم، ولها الأولويّة. غيّره في <code dir="ltr">deploy/.env.production</code>.
              </Inset>
            )}
            <div className="mt-4 space-y-3">
              {/* ═══ رابطُ الحجز أوّلا — هو ما يراه المتقدّم ═══

                  ويُقبل بأيّ صورةٍ صحيحة: اسمُ المستخدم وحدَه، أو المسارُ،
                  أو الرابطُ كاملا بـwww أو بدونها. وما لا يصحّ يُردّ بسببه
                  مكتوبا لا بـ«رابطٌ غيرُ صالح». */}
              <div>
                <label className={labelCls}>رابط الحجز — ما يفتحه المتقدّم</label>
                <input dir="ltr" value={calForm.bookingUrl}
                  onChange={(e) => setCalForm({ ...calForm, bookingUrl: e.target.value })}
                  placeholder="hadeel-7/wajeez-academy"
                  className={`${inputCls} mt-1 w-full font-mono`} />
                <p className="mt-1 text-read leading-6 text-muted-foreground">
                  يكفي اسم المستخدم أو الرابط كاملا. اتركه فارغا لاستخدام الرابط الافتراضيّ.
                </p>
              </div>
              {/* ═══ حاضرون يُضافون إلى كلّ موعدٍ بلا لمسة ═══

                  المقابلةُ بين المتقدّم والمضيف وحدَهما، فمن أراد حضورَها من
                  الإدارة لزمه أن يُضاف يدويّا في كلّ موعد — أو يفوتَه. */}
              <div>
                <label className={labelCls}>حضور إضافيّون في كلّ موعد — اختياريّ</label>
                <input dir="ltr" value={calForm.guests}
                  onChange={(e) => setCalForm({ ...calForm, guests: e.target.value })}
                  placeholder="you@example.com, someone@example.com"
                  className={`${inputCls} mt-1 w-full font-mono`} />
                <p className="mt-1 text-read leading-6 text-muted-foreground">
                  بريد أو أكثر بينها فاصلة. يضافون ضيوفا في دعوة التقويم وتصلهم تفاصيل الاجتماع.
                </p>
                <Inset as="p" className="mt-2 text-read leading-6 text-muted-foreground">
                  ⚠ فعّل <span dir="ltr">Invitees can add guests</span> في نوع الحدث عند Calendly —
                  وإلّا يتجاهل الضيوف دون أيّ خطأ. متاح في الخطّة المجّانيّة.
                </Inset>
              </div>
              <div>
                <label className={labelCls}>الرمز الشخصيّ — ليقرأ الخادم الحجوزات</label>
                <input dir="ltr" type="password" value={calForm.token}
                  onChange={(e) => setCalForm({ ...calForm, token: e.target.value })}
                  placeholder={view.calendly.hasToken ? view.calendly.token : "eyJraWQ…"}
                  className={`${inputCls} mt-1 w-full font-mono`} />
                <p className="mt-1 text-read leading-6 text-muted-foreground">
                  من Calendly ← Integrations &amp; apps ← API &amp; webhooks. ويكفي وحده، ويعمل في الخطّة المجّانيّة.
                </p>
                {/* ═══ ومن أيِّ حسابٍ يُؤخَذ ═══

                    الرمزُ لا يرى إلّا مواعيدَ حسابِه. ورابطُ الحجز قد يكون على
                    حسابٍ غيرِ حسابِ المدير، فيُزامن رمزُه صفرا أبدا — ولا يقول
                    شيءٌ إنّه صفر، لأنّ السؤالَ ينجح ويعود فارغا. فيُقال هنا. */}
                <Inset as="p" className="mt-2 text-read leading-6 text-muted-foreground">
                  يجب أن يكون من الحساب المضيف للمقابلات — <span dir="ltr">{TRAINER_INTERVIEW.url}</span> —
                  فالرمز لا يرى مواعيد حساب آخر، وستكون المزامنة فارغة دون أيّ خطأ.
                </Inset>
              </div>
              <div>
                <label className={labelCls}>مفتاح التوقيع — للاستقبال الفوريّ فقط</label>
                <input dir="ltr" type="password" value={calForm.signingKey}
                  onChange={(e) => setCalForm({ ...calForm, signingKey: e.target.value })}
                  placeholder={view.calendly.hasSigningKey ? view.calendly.signingKey : "سرّ طويل تختاره…"}
                  className={`${inputCls} mt-1 w-full font-mono`} />
                <p className="mt-1 text-read leading-6 text-muted-foreground">
                  تختاره أنت ويرسل إلى Calendly عند التسجيل. اتركه فارغا إن كفاك الفحص الدوريّ.
                </p>
              </div>
              <label className="flex items-center gap-2 text-read text-muted-foreground">
                <input type="checkbox" checked={calForm.enabled}
                  onChange={(e) => setCalForm({ ...calForm, enabled: e.target.checked })} className="accent-gold" />
                مفعّل
              </label>
              <Button tone="confirm" disabled={busy}
                onClick={() => act(() => apiPut("/api/admin/integrations/calendly", calForm), "حفظت إعدادات Calendly")}>
                حفظ إعدادات Calendly
              </Button>
            </div>

            {/* ════ المستقبِلُ الفوريُّ — اختياريٌّ ويحتاج خطّةً مدفوعة ════

                يُترك مطويّا عن الطريق الأوّل: من لا خطّةَ له لا يعنيه، ومن
                له خطّةٌ يجده حيث يتوقّعه — بعد أن يحفظ رمزَه. */}
            <div className="mt-5 border-t border-white/10 pt-4">
              <p className={labelCls}>الاستقبال الفوريّ — يحتاج خطّة مدفوعة</p>
              <p className="mt-1 text-read leading-6 text-muted-foreground">
                يصل الحجز فورا بدل انتظار الفحص الدوريّ. غير متاح في الخطّة المجّانيّة — افحص أوّلا، والفحص لا ينشئ شيئا.
              </p>
              <div>
                <label className={labelCls}>عنوان الاستقبال — يسجّل في Calendly</label>
                <input dir="ltr" readOnly value={view.calendly.callbackUrl}
                  className={`${inputCls} mt-1 w-full font-mono opacity-70`} />
                {!view.calendly.siteUrlExplicit && (
                  <p className="mt-1 text-read leading-6 text-gold-ink">
                    ‏APP_URL غير مضبوط — العنوان أعلاه تقديريّ، راجعه قبل التسجيل.
                  </p>
                )}
              </div>
              {/* معاينةٌ ثمّ تطبيق — لا يُسجَّل مستقبِلٌ حيٌّ قبل أن تُعرض النتيجة */}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button tone="secondary" size="sm" disabled={busy || !view.calendly.hasToken}
                  onClick={() => void probeCalendly(false)}>
                  <Send className="h-3.5 w-3.5" /> افحص الاشتراك
                </Button>
                <Button tone="confirm" size="sm" disabled={busy || !view.calendly.hasToken}
                  onClick={() => void probeCalendly(true)}>
                  سجّل الاشتراك
                </Button>
              </div>
              {calProbe && (
                <Inset as="p" tone={calProbe.ok ? "positive" : "danger"}
                  className={`mt-3 text-read leading-6 ${calProbe.ok ? "text-emerald-200" : "text-red-200"}`}>
                  {calProbe.message}
                </Inset>
              )}
            </div>
          </Panel>

          {/* قاعدة الأمان */}
          <Card as="p" className="flex items-start gap-2 px-4 py-3 text-read leading-6 text-muted-foreground lg:col-span-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-ink" />
            قواعد ثابتة: الأسرار تكتب ولا تقرأ (تظهر آخر 4 خانات فقط)، ومتغيرات البيئة لها الأولويّة دائما في الإنتاج،
            وكلّ حفظ وفحص يسجّل في سجلّ الأثر — ولا تسوية ماليّة إلّا عبر webhook موقّع أو تسجيل يدويّ بصلاحية.
          </Card>
        </div>
      )}
    </AdminLayout>
  );
}
