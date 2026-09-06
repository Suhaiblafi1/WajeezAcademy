/* شاشة التكاملات — مزود الدفع والبريد من مكان واحد بصلاحية settings.manage.
   القراءة مقنَّعة (آخر 4 خانات)، الحفظ يتجاهل القناع ولا يمسح السر المخزن،
   وفحصا الاتصال حيان يضربان خادم المزود/البريد فعلا. متغيرات البيئة تغلب كل شيء. */

import { useCallback, useEffect, useState } from "react";
import { toast, toastError } from "@/components/Toast";
import { CreditCard, Loader2, Mail, PlugZap, RefreshCw, Send, ServerOff, ShieldCheck } from "lucide-react";
import AdminLayout from "./AdminLayout";
import { apiGet, apiPost, apiPut, ApiError } from "@/services/api";
import { DEFAULT_SENDER_EMAIL } from "@/application/site/origin";

import { Panel, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
const inputCls = "rounded-xl border border-white/15 bg-paper/30 px-3 py-2 text-xs text-foreground focus:border-teal focus:outline-none";
const labelCls = "block text-micro font-bold text-muted-foreground";

interface IntegrationsView {
  payment: {
    enabled: boolean; driver: "test" | "manual" | "moyasar" | "stripe"; envSourced: boolean;
    siteUrl: string; siteUrlExplicit: boolean;
    publishableKey: string; secretKey: string; webhookSecret: string; hasSecret: boolean; hasWebhookSecret: boolean;
  };
  email: {
    enabled: boolean; envSourced: boolean; apiKey: string; fromName: string; fromEmail: string; hasApiKey: boolean;
  };
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

  const testPayment = async () => {
    setBusy(true);
    try {
      const r = await apiPost<{ ok: boolean; message: string }>("/api/admin/integrations/payment/test");
      toast(r.message);
    } catch (e) { toastError(e instanceof ApiError ? e.message : "فشل الفحص"); }
    finally { setBusy(false); }
  };

  const testEmail = async () => {
    if (!testTo.includes("@")) { toast("أدخل بريداً صحيحاً للاختبار"); return; }
    setBusy(true);
    try {
      const r = await apiPost<{ ok: boolean; message: string }>("/api/admin/integrations/email/test", { to: testTo });
      toastError(r.message ?? (r.ok ? "أُرسل" : "فشل"));
    } catch (e) { toastError(e instanceof ApiError ? e.message : "فشل الإرسال التجريبي"); }
    finally { setBusy(false); }
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

  return (
    <AdminLayout title="التكاملات — الدفع والبريد">

      {loading || !view ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" /></div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* ════ مزود الدفع ════ */}
          <Panel as="section">
            <p className="flex items-center gap-2 text-sm font-black"><CreditCard className="h-4 w-4 text-gold-ink" /> مزود الدفع</p>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
              المزودان الحقيقيان يعملان بصفحات دفع مستضافة لديهم — لا بيانات بطاقات تمر بخوادمنا أبداً،
              والتسوية تتم عبر webhook موقَّت فقط.
            </p>
            {view.payment.envSourced && (
              <p className="mt-3 rounded-xl border border-gold/30 bg-gold/5 px-3 py-2 text-[11px] font-bold text-gold-ink">
                هذا التكامل يُدار من متغيرات البيئة (PAYMENT_DRIVER…) — الحفظ هنا لن يؤثر حتى تُزال متغيرات البيئة.
              </p>
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
                    <label className={labelCls}>المفتاح السري (Secret) — يُخزَّن ولا يُعرض كاملاً أبداً</label>
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
                    <p className="rounded-xl border border-red-500/40 bg-red-500/[0.07] px-3 py-2 text-[11px] font-bold leading-5 text-red-300">
                      اضبط <span dir="ltr" className="font-mono">APP_URL</span> بعنوان الموقع في بيئة الخادم أولا — لن يُقبل التفعيل بدونه.
                      <span className="mt-1 block font-normal text-red-300/75">
                        العنوان المستعمل الآن: <span dir="ltr" className="font-mono">{view.payment.siteUrl}</span> — ومنه تُبنى صفحة عودة المشتري بعد الدفع.
                      </span>
                    </p>
                  )}
                  <Inset className="px-3 py-2 text-micro leading-5 text-muted-foreground">
                    <p className="font-bold text-foreground">عنوان الـ webhook — سجّله في لوحة المزود:</p>
                    <p dir="ltr" className="mt-0.5 select-all font-mono text-teal-light-ink">{webhookUrl}</p>
                    {/* كان هنا أنّ Stripe يحتاج «جسرا» يعيد إرسال التوقيع بترويسة
                        x-payment-signature. صار الخادمُ يقرأ ترويسة Stripe الرسميّة
                        `stripe-signature` أوّلا ويتحقّق من صيغتها الأصليّة
                        («t=…,v1=…» موقَّعةً على «الطابع.الجسم») بنافذةِ خمس دقائق —
                        فبقاءُ النصّ القديم يدفع صاحبَ المنصّة إلى بناء ما لا لزوم له.
                        حارسُ الصيغة: server/tests/commerce/stripe-signature.test.ts */}
                    <p className="mt-1"><b className="text-foreground">Stripe:</b> صِلْ لوحتَه بهذا العنوان مباشرة وضع <span dir="ltr" className="font-mono">whsec_…</span> في «سر التوقيع» — لا جسرَ ولا رمزَ مشترك. والحدثُ المطلوب <span dir="ltr" className="font-mono">checkout.session.completed</span> وحدَه؛ غيرُه يُسجَّل ويُتجاهَل.</p>
                    <p className="mt-1"><b className="text-foreground">Moyasar:</b> سجّل «سر التوقيع» نفسَه رمزاً مشتركاً في لوحتهم.</p>
                  </Inset>
                </>
              )}
              <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-foreground">
                <input type="checkbox" checked={payForm.enabled} onChange={(e) => setPayForm({ ...payForm, enabled: e.target.checked })} className="accent-gold" />
                تفعيل هذا المزود — غير المفعّل يعني: المزود الاختباري يعمل
              </label>
              <div className="flex flex-wrap gap-2">
                <Button tone="primary" disabled={busy} onClick={() => act(() => apiPut("/api/admin/integrations/payment", payForm), "حُفظت إعدادات الدفع")}>
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
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
              فور التفعيل تصبح قناة email في الإشعارات حقيقية — قبول التسجيل والفواتير والشهادات تصل بريداً.
              غير المفعّلة تسجَّل «فشل: لا مزود» وتُعاد المحاولة تلقائياً.
            </p>
            {view.email.envSourced && (
              <p className="mt-3 rounded-xl border border-gold/30 bg-gold/5 px-3 py-2 text-[11px] font-bold text-gold-ink">
                هذا التكامل يُدار من متغيرات البيئة (RESEND_API_KEY…) — الحفظ هنا لن يؤثر حتى تُزال متغيرات البيئة.
              </p>
            )}
            <div className="mt-4 space-y-3">
              <div>
                <label className={labelCls}>مفتاح Resend API — يُخزَّن ولا يُعرض كاملاً أبداً</label>
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
                <Button tone="primary" disabled={busy} onClick={() => act(() => apiPut("/api/admin/integrations/email", mailForm), "حُفظت إعدادات البريد")}>
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

          {/* قاعدة الأمان */}
          <p className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-[11px] leading-6 text-muted-foreground lg:col-span-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-ink" />
            قواعد ثابتة: الأسرار تُكتب ولا تُقرأ (آخر 4 خانات فقط للعرض)، ومتغيرات البيئة تغلب الشاشة دائماً لبيئات الإنتاج،
            وكل حفظ وفحص موثق في سجل الأثر — ولا تسوية مالية إلا عبر webhook موقَّت أو تسجيل يدوي بصلاحية.
          </p>
        </div>
      )}
    </AdminLayout>
  );
}
