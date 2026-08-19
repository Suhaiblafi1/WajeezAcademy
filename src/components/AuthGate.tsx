import { useState } from "react";
import { Link } from "react-router";
import { Check, Eye, EyeOff, Linkedin, Lock, Mail, ShieldCheck, UserRound } from "lucide-react";
import {
  OAUTH_READY,
  lockedMinutes,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  signIn,
  signUp,
} from "@/services/auth";
import { track } from "@/services/analytics";

/* أيقونة قوقل الرسمية بألوانها الأربعة — جاهزة ليوم اكتمال ربط OAuth */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.39 3.62v3h3.86c2.26-2.09 3.57-5.16 3.57-8.81z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.86-3c-1.07.72-2.44 1.15-4.08 1.15-3.14 0-5.8-2.12-6.75-4.97H1.29v3.1A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.25 14.27A7.2 7.2 0 0 1 4.87 12c0-.79.14-1.55.38-2.27v-3.1H1.29a12 12 0 0 0 0 10.84l3.96-3.2z"
      />
      <path
        fill="#EA4335"
        d="M12 4.76c1.76 0 3.34.61 4.58 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.29 6.63l3.96 3.1C6.2 6.88 8.86 4.76 12 4.76z"
      />
    </svg>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* قوة كلمة المرور: الطول ثم الأرقام ثم الرموز */
function strengthOf(p: string): 0 | 1 | 2 | 3 {
  if (!p) return 0;
  let score = 0;
  if (p.length >= 8) score++;
  if (/\d/.test(p)) score++;
  if (/[^\w\s]/.test(p) || /[A-Z]/.test(p)) score++;
  return Math.min(3, Math.max(1, score)) as 1 | 2 | 3;
}
const STRENGTH_META = [
  { label: "", color: "rgba(255,255,255,0.1)" },
  { label: "ضعيفة", color: "#EF4444" },
  { label: "متوسطة", color: "#FABC05" },
  { label: "قوية", color: "#34A853" },
];

type View = "auth" | "reset" | "verify" | "resetConfirm";

const FIELD_CLS =
  "h-12 w-full rounded-2xl border border-white/15 bg-white/[0.04] pr-11 pl-11 text-left text-sm text-white placeholder:text-white/30 focus:border-[#38A7B4] focus:outline-none";
const LABEL_CLS = "mb-1.5 block text-xs font-bold text-white/60";

/** بوابة الدخول والتسجيل — نموذج حقيقي، تحقق آمن، ورسائل عربية لا تكشف شيئا */
export default function AuthGate({ onDone, message }: { onDone: () => void; message?: string }) {
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [view, setView] = useState<View>("auth");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);
  const [resetToken, setResetToken] = useState("");

  const emailValid = EMAIL_RE.test(email.trim());
  const passValid = pass.length >= 8;
  const confirmValid = mode === "login" || confirm === pass;
  const nameValid = mode === "login" || name.trim().length >= 2;
  const consentValid = mode === "login" || agreed;
  const formValid = emailValid && passValid && confirmValid && nameValid && consentValid;
  const strength = strengthOf(pass);
  const locked = lockedMinutes();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (locked > 0) {
      setErr(`محاولات كثيرة متتالية — انتظر ${locked} دقائق ثم حاول مجددا`);
      return;
    }
    if (!formValid) {
      setErr(
        !nameValid
          ? "أدخل اسمك — لنرحب بك باسمك لا برقم"
          : !emailValid
            ? "صيغة البريد غير صحيحة — مثال: name@mail.com"
            : !passValid
              ? "كلمة المرور ٨ أحرف على الأقل — أضف رقما أو رمزا لتقويتها"
              : !confirmValid
                ? "تأكيد كلمة المرور لا يطابقها — أعد كتابتها"
                : "نحتاج موافقتك على شروط الاستخدام وسياسة الخصوصية أولا"
      );
      return;
    }
    setBusy(true);
    setErr("");
    track("account_started", { mode });
    try {
      const result =
        mode === "signup" ? await signUp(name, email, pass) : await signIn(email, pass);
      if (!result.ok) {
        track("account_failed");
        setErr(result.error);
        return;
      }
      if (mode === "signup") {
        track("account_created");
        setView("verify");
        setResent(false);
      } else {
        onDone();
      }
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !emailValid) return;
    setBusy(true);
    try {
      // رسالة الخادم آمنة ولا تكشف وجود الحساب
      const { message, devToken } = await requestPasswordReset(email);
      setErr("");
      if (devToken) {
        // وضع التطوير: الخادم يعيد الرمز مباشرة بدل البريد — نكمل التعيين فورا
        setResetToken(devToken);
        setView("resetConfirm");
        return;
      }
      setView("auth");
      setMode("login");
      setNotice(message);
    } finally {
      setBusy(false);
    }
  };

  const submitResetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !resetToken.trim() || !passValid || confirm !== pass) return;
    setBusy(true);
    setErr("");
    try {
      const { ok, message } = await resetPassword(resetToken, pass);
      if (!ok) {
        setErr(message);
        return;
      }
      setPass("");
      setConfirm("");
      setResetToken("");
      setNotice("عُيّنت كلمة المرور — سجّل الدخول من جديد");
      setView("auth");
      setMode("login");
    } finally {
      setBusy(false);
    }
  };

  const [notice, setNotice] = useState("");

  /* ── شاشة: تحقق من بريدك (بعد إنشاء الحساب) ── */
  if (view === "verify") {
    return (
      <div className="mx-auto max-w-md">
        <div className="overflow-hidden rounded-3xl border border-[#38A7B4]/25 bg-gradient-to-b from-[#12262A] to-[#0D0D0D] px-8 py-10 text-center shadow-[0_24px_80px_-24px_rgba(56,167,180,0.35)]">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#38A7B4]/15">
            <Mail className="h-7 w-7 text-[#6EC7D1]" />
          </span>
          <h2 className="mt-5 text-2xl font-black text-white">تم إنشاء حسابك — بقي تأكيد بريدك</h2>
          <p className="mt-3 text-sm leading-relaxed text-white/55">
            أرسلنا رابط تحقق إلى <span dir="ltr" className="font-bold text-white/80">{email.trim()}</span>.
            افتح الرسالة واضغط الرابط لتفعيل حسابك بالكامل.
          </p>
          <div className="mt-6 space-y-3">
            <button
              onClick={() => {
                resendVerification(email);
                setResent(true);
              }}
              disabled={resent}
              className="h-11 w-full rounded-2xl border border-white/15 text-sm font-bold text-white/70 transition hover:border-[#38A7B4]/50 hover:text-[#6EC7D1] disabled:opacity-50"
            >
              {resent ? "أُعيد إرسال الرسالة — تفقد بريدك" : "لم تصلك؟ أعد إرسال رسالة التحقق"}
            </button>
            <button
              onClick={onDone}
              className="h-12 w-full rounded-2xl bg-[#FABC05] text-sm font-black text-[#0D0D0D] transition hover:bg-[#FABC05]/90"
            >
              متابعة — سأؤكد بريدي لاحقا
            </button>
          </div>
          <p className="mt-5 text-[11px] leading-relaxed text-white/55">
            تفقد مجلد الرسائل غير المرغوبة إن لم تجدها خلال دقائق
          </p>
        </div>
      </div>
    );
  }

  /* ── شاشة: استعادة كلمة المرور ── */
  if (view === "reset") {
    return (
      <div className="mx-auto max-w-md">
        <div className="overflow-hidden rounded-3xl border border-[#38A7B4]/25 bg-gradient-to-b from-[#12262A] to-[#0D0D0D] shadow-[0_24px_80px_-24px_rgba(56,167,180,0.35)]">
          <div className="border-b border-white/5 px-8 pb-6 pt-8 text-center">
            <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="mx-auto h-12 w-12 object-contain" />
            <h2 className="mt-4 text-2xl font-black text-white">استعادة كلمة المرور</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              أدخل بريدك وسنرسل لك رابط إعادة التعيين
            </p>
          </div>
          <form onSubmit={submitReset} noValidate className="px-8 py-6">
            <label htmlFor="reset-email" className={LABEL_CLS}>البريد الإلكتروني</label>
            <div className="relative">
              <Mail className="absolute right-3.5 top-3.5 h-4 w-4 text-white/55" />
              <input
                id="reset-email"
                name="email"
                dir="ltr"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@mail.com"
                autoComplete="email"
                className={FIELD_CLS}
              />
            </div>
            {!emailValid && email.length > 0 && (
              <p className="mt-1.5 text-[11px] font-semibold text-red-300">صيغة البريد غير صحيحة — مثال: name@mail.com</p>
            )}
            <button
              type="submit"
              disabled={busy || !emailValid}
              className="mt-4 h-12 w-full rounded-2xl bg-[#FABC05] text-sm font-black text-[#0D0D0D] transition hover:bg-[#FABC05]/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "جارٍ الإرسال…" : "أرسل رابط الاستعادة"}
            </button>
            <button
              type="button"
              onClick={() => { setView("auth"); setErr(""); }}
              className="mt-3 w-full text-center text-xs text-white/45 transition hover:text-[#6EC7D1]"
            >
              عودة لتسجيل الدخول
            </button>
            <button
              type="button"
              onClick={() => { setView("resetConfirm"); setErr(""); }}
              className="mt-2 w-full text-center text-xs text-white/45 transition hover:text-[#6EC7D1]"
            >
              وصلك الرمز؟ أدخله مباشرة لتعيين كلمة المرور
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* ── شاشة: تعيين كلمة مرور جديدة برمز الاستعادة ── */
  if (view === "resetConfirm") {
    return (
      <div className="mx-auto max-w-md">
        <div className="overflow-hidden rounded-3xl border border-[#38A7B4]/25 bg-gradient-to-b from-[#12262A] to-[#0D0D0D] shadow-[0_24px_80px_-24px_rgba(56,167,180,0.35)]">
          <div className="border-b border-white/5 px-8 pb-6 pt-8 text-center">
            <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="mx-auto h-12 w-12 object-contain" />
            <h2 className="mt-4 text-2xl font-black text-white">تعيين كلمة مرور جديدة</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              أدخل رمز الاستعادة وكلمة المرور الجديدة — تُبطل الجلسات القديمة تلقائيا
            </p>
          </div>
          <form onSubmit={submitResetConfirm} noValidate className="space-y-4 px-8 py-6">
            <div>
              <label htmlFor="reset-token" className={LABEL_CLS}>رمز الاستعادة</label>
              <div className="relative">
                <ShieldCheck className="absolute right-3.5 top-3.5 h-4 w-4 text-white/55" />
                <input
                  id="reset-token"
                  name="reset-token"
                  dir="ltr"
                  type="text"
                  required
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  placeholder="الرمز من رسالة البريد"
                  autoComplete="one-time-code"
                  className={FIELD_CLS}
                />
              </div>
            </div>
            <div>
              <label htmlFor="reset-pass" className={LABEL_CLS}>كلمة المرور الجديدة</label>
              <div className="relative">
                <Lock className="absolute right-3.5 top-3.5 h-4 w-4 text-white/55" />
                <input
                  id="reset-pass"
                  name="new-password"
                  dir="ltr"
                  type="password"
                  required
                  minLength={8}
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="٨ أحرف على الأقل"
                  autoComplete="new-password"
                  className={FIELD_CLS}
                />
              </div>
              {pass.length > 0 && !passValid && (
                <p className="mt-1.5 text-[11px] font-semibold text-red-300">كلمة المرور ٨ أحرف على الأقل</p>
              )}
            </div>
            <div>
              <label htmlFor="reset-confirm" className={LABEL_CLS}>تأكيد كلمة المرور</label>
              <div className="relative">
                <Lock className="absolute right-3.5 top-3.5 h-4 w-4 text-white/55" />
                <input
                  id="reset-confirm"
                  name="new-password-confirm"
                  dir="ltr"
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="أعد كتابتها للتأكيد"
                  autoComplete="new-password"
                  className={FIELD_CLS}
                />
              </div>
              {confirm.length > 0 && confirm !== pass && (
                <p className="mt-1.5 text-[11px] font-semibold text-red-300">لا تطابق كلمة المرور — أعد كتابتها</p>
              )}
            </div>
            {err && (
              <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-center text-xs font-semibold leading-relaxed text-red-300">
                {err}
              </p>
            )}
            <button
              type="submit"
              disabled={busy || !resetToken.trim() || !passValid || confirm !== pass}
              className="h-12 w-full rounded-2xl bg-[#FABC05] text-sm font-black text-[#0D0D0D] transition hover:bg-[#FABC05]/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "جارٍ التعيين…" : "عيّن كلمة المرور الجديدة"}
            </button>
            <button
              type="button"
              onClick={() => { setView("reset"); setErr(""); }}
              className="w-full text-center text-xs text-white/45 transition hover:text-[#6EC7D1]"
            >
              عودة — اطلب رمزا جديدا
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* ── الشاشة الرئيسية: دخول / حساب جديد ── */
  return (
    <div className="mx-auto max-w-md">
      <div className="overflow-hidden rounded-3xl border border-[#38A7B4]/25 bg-gradient-to-b from-[#12262A] to-[#0D0D0D] shadow-[0_24px_80px_-24px_rgba(56,167,180,0.35)]">
        <div className="border-b border-white/5 px-8 pb-6 pt-8 text-center">
          <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="mx-auto h-12 w-12 object-contain" />
          <h1 className="mt-4 text-2xl font-black text-white">
            {mode === "signup" ? "ابدأ رحلتك مع أكاديمية وجيز" : "أهلا بعودتك"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-white/55">
            {message ?? "حساب واحد يحفظ تشخيصك ومسارك وشهاداتك"}
          </p>
        </div>

        <div className="px-8 py-6">
          {/* تبويب الوضع */}
          <div className="mb-6 grid grid-cols-2 rounded-full border border-white/10 bg-white/[0.04] p-1" role="tablist">
            {(["signup", "login"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  setMode(m);
                  setErr("");
                  setNotice("");
                }}
                className={`rounded-full py-2 text-sm font-bold transition ${
                  mode === m ? "bg-[#38A7B4] text-[#08272B]" : "text-white/55 hover:text-white"
                }`}
              >
                {m === "signup" ? "حساب جديد" : "دخول"}
              </button>
            ))}
          </div>

          {/* الدخول الاجتماعي — مخفي حتى يكتمل ربط OAuth الحقيقي والمختبَر */}
          {OAUTH_READY && (
            <>
              <div className="space-y-3">
                <button className="flex h-12 w-full items-center justify-center gap-3 rounded-2xl bg-white text-sm font-black text-[#1F1F1F] transition hover:bg-white/90">
                  <GoogleMark />
                  المتابعة بحساب قوقل
                </button>
                <button className="flex h-12 w-full items-center justify-center gap-3 rounded-2xl bg-[#0A66C2] text-sm font-black text-white transition hover:bg-[#0A66C2]/90">
                  <Linkedin className="h-5 w-5" />
                  المتابعة بحساب لينكدإن
                </button>
                <p className="flex items-center justify-center gap-1.5 text-[11px] text-white/40">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#38A7B4]" />
                  لن ننشر شيئا باسمك أبدا — حسابك لحفظ مسارك ونتيجتك فقط
                </p>
              </div>
              <div className="my-5 flex items-center gap-3 text-xs text-white/55">
                <span className="h-px flex-1 bg-white/10" />
                أو بالبريد الإلكتروني
                <span className="h-px flex-1 bg-white/10" />
              </div>
            </>
          )}

          <form onSubmit={submit} noValidate className="space-y-4">
            {mode === "signup" && (
              <div>
                <label htmlFor="auth-name" className={LABEL_CLS}>الاسم الكريم</label>
                <div className="relative">
                  <UserRound className="absolute right-3.5 top-3.5 h-4 w-4 text-white/55" />
                  {name.trim().length >= 2 && <Check className="absolute left-3.5 top-3.5 h-4 w-4 text-[#34A853]" />}
                  <input
                    id="auth-name"
                    name="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: سارة العتيبي"
                    autoComplete="name"
                    className={`${FIELD_CLS} text-right`}
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className={LABEL_CLS}>البريد الإلكتروني</label>
              <div className="relative">
                <Mail className="absolute right-3.5 top-3.5 h-4 w-4 text-white/55" />
                {emailValid && <Check className="absolute left-3.5 top-3.5 h-4 w-4 text-[#34A853]" />}
                <input
                  id="auth-email"
                  name="email"
                  dir="ltr"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@mail.com"
                  autoComplete="email"
                  aria-describedby="auth-email-hint"
                  className={FIELD_CLS}
                />
              </div>
              {email.length > 0 && !emailValid && (
                <p id="auth-email-hint" className="mt-1.5 text-[11px] font-semibold text-red-300">
                  صيغة البريد غير صحيحة — مثال: name@mail.com
                </p>
              )}
            </div>

            <div>
              <label htmlFor="auth-pass" className={LABEL_CLS}>كلمة المرور</label>
              <div className="relative">
                <Lock className="absolute right-3.5 top-3.5 h-4 w-4 text-white/55" />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  className="absolute left-3.5 top-3.5 text-white/55 transition hover:text-white/70"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <input
                  id="auth-pass"
                  name="password"
                  dir="ltr"
                  type={showPass ? "text" : "password"}
                  required
                  minLength={8}
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="٨ أحرف على الأقل"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  className={FIELD_CLS}
                />
              </div>
              {mode === "signup" && (
                <p className="mt-1.5 text-[11px] text-white/40">
                  ٨ أحرف فأكثر — ويُفضّل رقم أو رمز (! @ #) لتقويتها
                </p>
              )}
            </div>

            {/* مؤشر القوة أثناء الكتابة */}
            {mode === "signup" && pass.length > 0 && (
              <div aria-live="polite">
                <div className="flex gap-1.5" dir="ltr">
                  {[1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className="h-1 flex-1 rounded-full transition-colors duration-300"
                      style={{ backgroundColor: i <= strength ? STRENGTH_META[strength].color : "rgba(255,255,255,0.1)" }}
                    />
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] font-semibold" style={{ color: STRENGTH_META[strength].color }}>
                  كلمة مرور {STRENGTH_META[strength].label}
                </p>
              </div>
            )}

            {mode === "signup" && (
              <div>
                <label htmlFor="auth-confirm" className={LABEL_CLS}>تأكيد كلمة المرور</label>
                <div className="relative">
                  <Lock className="absolute right-3.5 top-3.5 h-4 w-4 text-white/55" />
                  {confirm.length > 0 && confirmValid && <Check className="absolute left-3.5 top-3.5 h-4 w-4 text-[#34A853]" />}
                  <input
                    id="auth-confirm"
                    name="password-confirm"
                    dir="ltr"
                    type={showPass ? "text" : "password"}
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="أعد كتابتها للتأكيد"
                    autoComplete="new-password"
                    aria-describedby="auth-confirm-hint"
                    className={FIELD_CLS}
                  />
                </div>
                {confirm.length > 0 && !confirmValid && (
                  <p id="auth-confirm-hint" className="mt-1.5 text-[11px] font-semibold text-red-300">
                    لا تطابق كلمة المرور — أعد كتابتها
                  </p>
                )}
              </div>
            )}

            {mode === "login" && (
              <p className="text-left">
                <button
                  type="button"
                  onClick={() => { setView("reset"); setErr(""); setNotice(""); }}
                  className="text-xs text-white/45 transition hover:text-[#6EC7D1]"
                >
                  نسيت كلمة المرور؟
                </button>
              </p>
            )}

            {mode === "signup" && (
              <label htmlFor="auth-consent" className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <input
                  id="auth-consent"
                  name="consent"
                  type="checkbox"
                  required
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#38A7B4]"
                />
                <span className="text-[11px] leading-relaxed text-white/55">
                  أوافق على{" "}
                  <Link to="/p/terms" className="font-bold text-white/75 underline underline-offset-4 hover:text-[#6EC7D1]">
                    شروط الاستخدام
                  </Link>{" "}
                  و
                  <Link to="/p/privacy" className="font-bold text-white/75 underline underline-offset-4 hover:text-[#6EC7D1]">
                    سياسة الخصوصية
                  </Link>
                </span>
              </label>
            )}

            {notice && (
              <p className="rounded-xl border border-[#38A7B4]/30 bg-[#38A7B4]/10 px-4 py-2.5 text-center text-xs font-semibold leading-relaxed text-[#6EC7D1]">
                {notice}
              </p>
            )}
            {err && (
              <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-center text-xs font-semibold leading-relaxed text-red-300">
                {err}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || !formValid}
              className="h-12 w-full rounded-2xl bg-[#FABC05] text-sm font-black text-[#0D0D0D] transition hover:bg-[#FABC05]/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "لحظات…" : mode === "signup" ? "أنشئ حسابي وابدأ" : "ادخل إلى حسابي"}
            </button>
          </form>

          {mode === "login" && (
            <p className="mt-4 text-center text-[11px] leading-relaxed text-white/55">
              لحمايتك: يُقفل الدخول مؤقتا بعد خمس محاولات خاطئة
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
