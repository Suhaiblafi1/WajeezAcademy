/* «اترك رقمك ويتواصل معك مستشار» — آخرَ التشخيص، لمن لا حساب له (١٨ أكتوبر ٢٠٢٦).

   ═══ لماذا ═══

   نتيجةُ الضيف كانت تبقى على جهازه: لا يراها مستشارٌ، ولا يعرف أحدٌ أنّه
   مرّ. وقرارُ صاحب المنصّة: سؤالٌ **اختياريٌّ في آخر التشخيص**، ببريدٍ أو
   واتساب. والعلّةُ كاملةً في `src/application/advisor/guest-contact.ts`.

   ═══ ولمَ مطويٌّ في سطرٍ لا نموذجٌ ظاهر ═══

   يقع حيث ينتهي التشخيصُ — وأكثرُ ذلك صفحةُ المسار وصفحةُ الدورة، وغرضُهما
   الشراء. ونموذجٌ بثلاثة حقولٍ تحت زرّ الشراء يزاحمه، وهو لمن أراده لا
   للجميع. فسطرٌ يُفتح، كـ«أبلغني» في صفحة الدورة.

   ═══ ولا يظهر لمن له حساب ═══

   من دخل بحسابه تُرفق نتيجتُه بحسابه حين ينتهي (`attachToAccount`)، وتُفتح
   له حالةٌ بلا أن يسأل. فسؤالُه عن رقمه سؤالٌ عمّا نعرفه. */

import { useState } from "react";
import { Check, Loader2, MessageCircle } from "lucide-react";
import { apiPost, ApiError } from "@/services/api";
import { readSession } from "@/services/auth";
import { safeGet, safeSet } from "@/services/safe-storage";
import { controlCls, Field, invalidProps } from "@/components/FormKit";
import Button from "@/components/ui/Button";
import { contactErrors, GUEST_CONTACT_CONSENT_AR } from "@/application/advisor/guest-contact";

/** أُرسل الطلبُ من هذا المتصفّح — فيُقال ذلك بدل أن يُعرض السطرُ ثانية */
const SENT_KEY = "wajeez_advisor_contact_sent";

export default function AdvisorCallbackForm({
  snapshot,
  className = "",
}: {
  /** نتيجةُ التشخيص التي يقرؤها المستشار — تُقرأ عند الإرسال لا عند العرض */
  snapshot: () => unknown;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(() => safeGet(SENT_KEY) === "1");
  const [error, setError] = useState<string | null>(null);

  if (readSession()) return null;

  if (sent) {
    return (
      <p className={`flex items-start justify-center gap-1.5 text-read leading-5 text-teal-light-ink ${className}`}>
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        وصل طلبك — سيتواصل معك مستشار قريبا.
      </p>
    );
  }

  if (!open) {
    return (
      <p className={`text-read leading-5 text-muted-foreground ${className}`}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 font-bold text-teal-light-ink underline underline-offset-4 transition hover:text-[#6EC7D1]"
        >
          <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> اترك رقمك ويتواصل معك مستشار
        </button>
      </p>
    );
  }

  const errs = contactErrors({ name, phone, email });
  const shown = tried ? errs : { name: null, phone: null, email: null, contact: null };

  const submit = async () => {
    setTried(true);
    if (errs.name || errs.phone || errs.email || errs.contact) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost("/api/public/advisor-contact", {
        fullName: name.trim(),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(email.trim() ? { email: email.trim() } : {}),
        snapshot: snapshot() ?? undefined,
      });
      safeSet(SENT_KEY, "1");
      setSent(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "تعذّر الإرسال — أعد المحاولة");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`mx-auto max-w-md text-right ${className}`}>
      <p className="text-read leading-5 text-muted-foreground">
        اترك رقم واتساب أو بريدك، ويتواصل معك مستشار بخصوص نتيجتك.
      </p>
      <div className="mt-3 grid gap-3">
        <Field label="اسمك" htmlFor="advisor-contact-name" error={shown.name}>
          <input
            id="advisor-contact-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            className={controlCls}
            {...invalidProps("advisor-contact-name-error", shown.name)}
          />
        </Field>
        <Field label="رقم واتساب" htmlFor="advisor-contact-phone" hint="يكفي الرقم أو البريد" error={shown.phone ?? shown.contact}>
          <input
            id="advisor-contact-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+962 7X XXX XXXX"
            dir="ltr"
            autoComplete="tel"
            className={`${controlCls} text-left`}
            {...invalidProps("advisor-contact-phone-error", shown.phone ?? shown.contact)}
          />
        </Field>
        <Field label="البريد الإلكتروني" htmlFor="advisor-contact-email" error={shown.email}>
          <input
            id="advisor-contact-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            dir="ltr"
            autoComplete="email"
            className={`${controlCls} text-left`}
            {...invalidProps("advisor-contact-email-error", shown.email)}
          />
        </Field>
      </div>
      <Button tone="confirm" onClick={() => void submit()} disabled={busy} className="mt-3 disabled:opacity-50">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
        أرسل
      </Button>
      <p className="mt-2 text-read leading-5 text-muted-foreground">{GUEST_CONTACT_CONSENT_AR}</p>
      {error && <p role="alert" className="mt-1.5 text-read leading-5 text-red-300">{error}</p>}
    </div>
  );
}
