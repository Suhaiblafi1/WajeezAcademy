/* «لم تقرر بعد؟ اترك رقمك» — في المسار العامّ `/go/BF80` وحدَه (٢٤ نوفمبر ٢٠٢٦).

   حملةٌ زار صفحتَها ٥٤٠ ولم يسجّل أحد: كان الزائرُ يدفع أو يخرج، ولا خطوةَ بينهما. فاسمٌ ورقمُ واتساب ويتواصل معه مستشار —
   حالةٌ بطريق «اترك رقمك» نفسِه (`/api/public/go/:code/contact`). و`Lead` للبكسل بعد أن يقبلها الخادم لا عند الضغط، وبلا
   اسمٍ ولا رقمٍ فيه. */

import { useState } from "react";
import { Check, Loader2, MessageCircle } from "lucide-react";
import { apiPost, ApiError } from "@/services/api";
import { safeGet, safeSet } from "@/services/safe-storage";
import { controlCls, Field, invalidProps } from "@/components/FormKit";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Surface";
import { PhoneCodePicker } from "@/components/CountryPicker";
import { useHoneypot } from "@/components/HoneypotField";
import { trackPixel } from "@/pages/ai-jobs/meta-pixel";
import { GRANT_PHONE_REQUIRED_AR, intlPhone, PATH_CONTACT_CONSENT_AR } from "@/application/advisor/guest-contact";

export default function PathLeadForm({ code }: { code: string }) {
  const sentKey = `wajeez_path_lead_${code}`;
  const [name, setName] = useState("");
  const [dial, setDial] = useState("+962");
  const [phone, setPhone] = useState("");
  const hp = useHoneypot();
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(() => safeGet(sentKey) === "1");
  const [error, setError] = useState<string | null>(null);

  const intl = intlPhone(dial, phone);
  const nameError = tried && name.trim().length < 2 ? "اكتب اسمك" : null;
  const phoneError = tried && !intl ? GRANT_PHONE_REQUIRED_AR : null;

  const submit = async () => {
    setTried(true);
    if (busy || name.trim().length < 2 || !intl) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/api/public/go/${code}/contact`, { fullName: name.trim(), phone: intl, website: hp.value });
      trackPixel("Lead", { content_name: code });
      safeSet(sentKey, "1");
      setSent(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "تعذر الإرسال. أعد المحاولة");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mt-4 p-4 sm:p-5" data-testid="path-lead">
      {sent ? (
        <p className="flex items-center gap-2 text-read font-bold text-teal-light-ink" role="status">
          <Check className="h-4 w-4" aria-hidden="true" /> وصل طلبك. سيتواصل معك مستشار على واتساب.
        </p>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate>
          <h2 className="text-lg font-black">لم تقرر بعد؟ اترك رقمك</h2>
          <p className="mt-1 text-read text-muted-foreground">مستشار يجيب أسئلتك على واتساب، بلا حساب ولا دفع.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="اسمك" htmlFor="path-lead-name" error={nameError}>
              <input id="path-lead-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120}
                className={controlCls} {...invalidProps("path-lead-name-error", nameError)} />
            </Field>
            <Field label="رقم واتساب" htmlFor="path-lead-phone" error={phoneError}>
              <div className="flex gap-2" dir="ltr">
                <PhoneCodePicker id="path-lead-cc" value={dial} onChange={setDial} className={`${controlCls.replace("w-full", "")} w-32 shrink-0 px-2`} />
                <input id="path-lead-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel-national" maxLength={30}
                  className={`${controlCls} min-w-0 text-left`} {...invalidProps("path-lead-phone-error", phoneError)} />
              </div>
            </Field>
          </div>
          {hp.field}
          <Button type="submit" tone="secondary" disabled={busy} className="mt-3 w-full sm:w-auto">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <MessageCircle className="h-4 w-4" aria-hidden="true" />} تواصلوا معي
          </Button>
          <p className="mt-2 text-read leading-5 text-muted-foreground">{PATH_CONTACT_CONSENT_AR}</p>
          {error && <p role="alert" className="mt-1.5 text-read leading-5 text-red-300">{error}</p>}
        </form>
      )}
    </Card>
  );
}
