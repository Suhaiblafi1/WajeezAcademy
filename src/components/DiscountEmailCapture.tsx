/* بريدٌ مقابل كود خصم — بديل صندوق التسجيل الكامل المحذوف من صفحتي المسار
   والتشخيص. لا يحجب شيئا: عنصر صغير اختياري، لا يُشترط ملؤه لرؤية أي محتوى
   آخر في الصفحة. عند النجاح يُعرض الكود فورا (بلا انتظار البريد) مع إشعار
   أنه أُرسل إلى بريده أيضا. */

import { useState } from "react";
import { Check, Copy, Mail } from "lucide-react";
import { apiPost, ApiError } from "@/services/api";
import { track } from "@/services/analytics";
import { safeGet, safeSet } from "@/services/safe-storage";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const STORAGE_KEY = "wajeez_discount_code";

export default function DiscountEmailCapture({
  source,
  pathwayId,
  className = "",
}: {
  source: "pathway_discount" | "diagnostic_discount";
  pathwayId?: string;
  className?: string;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<{ code: string; percentOff: number } | null>(() => {
    /* من ترك بريده سابقا لا يُطلب منه ثانية — كودُه محفوظ عنده */
    const saved = safeGet(STORAGE_KEY);
    return saved ? { code: saved, percentOff: 10 } : null;
  });
  const [copied, setCopied] = useState(false);

  const emailValid = EMAIL_RE.test(email.trim());

  const submit = async () => {
    if (!emailValid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<{ ok: boolean; code: string; percentOff: number }>(
        "/api/leads/discount-email",
        { email: email.trim(), source, ...(pathwayId ? { pathwayId } : {}) },
      );
      setCode({ code: res.code, percentOff: res.percentOff });
      safeSet(STORAGE_KEY, res.code);
      track("discount_email_captured", { source });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "تعذّر الإرسال — حاول مرة أخرى");
      track("discount_email_failed", { source });
    } finally {
      setBusy(false);
    }
  };

  const copyCode = () => {
    if (!code) return;
    void navigator.clipboard?.writeText(code.code).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  if (code) {
    return (
      <div className={`rounded-2xl border border-gold/35 bg-gold/[0.06] p-4 ${className}`}>
        <p className="text-xs font-black text-gold-ink">
          كودك جاهز — خصم {code.percentOff}٪ لأول عملية شراء
        </p>
        <div className="mt-2.5 flex items-center gap-2">
          <code dir="ltr" className="rounded-lg border border-gold/50 bg-black/30 px-2.5 py-1.5 text-sm font-black tracking-widest text-white">
            {code.code}
          </code>
          <button
            type="button"
            onClick={copyCode}
            className="flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] font-bold text-white/70 transition hover:border-gold/50 hover:text-gold-ink"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "نُسخ" : "نسخ"}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-white/45">أرسلناه إلى بريدك أيضا — يُكتب في حقل الكود عند الدفع.</p>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.03] p-4 ${className}`}>
      <p className="text-xs font-black text-white/85">أدخل بريدك واحصل فورا على كود خصم 10٪ لأول عملية شراء</p>
      <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Mail className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
          <input
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
            placeholder="name@mail.com"
            autoComplete="email"
            className="w-full rounded-xl border border-white/15 bg-black/20 py-2 pe-3 ps-9 text-sm text-white placeholder:text-white/30 focus:border-gold/50 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!emailValid || busy}
          className="shrink-0 rounded-xl bg-gold px-4 py-2 text-xs font-black text-on-gold transition hover:brightness-110 disabled:opacity-40"
        >
          {busy ? "جارٍ الإرسال…" : "أرسل كود الخصم"}
        </button>
      </div>
      {error && <p className="mt-1.5 text-[11px] font-semibold text-red-300">{error}</p>}
    </div>
  );
}
