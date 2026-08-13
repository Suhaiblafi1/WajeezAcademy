import { useState } from "react";
import { Link } from "react-router";
import { Check, Eye, EyeOff, Linkedin, Lock, Mail, ShieldCheck, UserRound } from "lucide-react";

/* أيقونة قوقل الرسمية بألوانها الأربعة */
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

/** بوابة الدخول والتسجيل — صفحة مهيبة بلا مشتتات، تحقق فوري، وثقة قبل كل شيء */
export default function AuthGate({ onDone, message }: { onDone: () => void; message?: string }) {
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [err, setErr] = useState("");

  const emailValid = EMAIL_RE.test(email.trim());
  const passValid = pass.length >= 8;
  const nameValid = mode === "login" || name.trim().length >= 2;
  const formValid = emailValid && passValid && nameValid;
  const strength = strengthOf(pass);

  const socialLogin = (provider: string) => {
    localStorage.setItem("wajeez_user", JSON.stringify({ name: `عضو عبر ${provider}`, at: Date.now() }));
    onDone();
  };

  const submit = () => {
    if (!formValid) {
      setErr(
        !nameValid
          ? "أدخل اسمك — لنرحب بك باسمك لا برقم"
          : !emailValid
            ? "صيغة البريد غير صحيحة — مثال: name@mail.com"
            : "كلمة المرور ٨ أحرف على الأقل — أضف رقما أو رمزا لتقويتها"
      );
      return;
    }
    const display = name.trim() || email.trim().split("@")[0];
    localStorage.setItem("wajeez_user", JSON.stringify({ name: display, email: email.trim(), at: Date.now() }));
    onDone();
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="overflow-hidden rounded-3xl border border-[#38A7B4]/25 bg-gradient-to-b from-[#12262A] to-[#0D0D0D] shadow-[0_24px_80px_-24px_rgba(56,167,180,0.35)]">
        {/* الترويسة */}
        <div className="border-b border-white/5 px-8 pb-6 pt-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#38A7B4] text-xl font-black text-[#08272B]">
            و
          </span>
          <h2 className="mt-4 text-2xl font-black text-white">
            {mode === "signup" ? "ابدأ رحلتك مع وجيز" : "أهلا بعودتك"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-white/55">
            {message ?? "حساب واحد يحفظ تشخيصك ومسارك وشهاداتك"}
          </p>
        </div>

        <div className="px-8 py-6">
          {/* تبويب الوضع */}
          <div className="mb-6 grid grid-cols-2 rounded-full border border-white/10 bg-white/[0.04] p-1">
            {(["signup", "login"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setErr("");
                }}
                className={`rounded-full py-2 text-sm font-bold transition ${
                  mode === m ? "bg-[#38A7B4] text-[#08272B]" : "text-white/55 hover:text-white"
                }`}
              >
                {m === "signup" ? "حساب جديد" : "دخول"}
              </button>
            ))}
          </div>

          {/* الدخول الاجتماعي أولا — أسرع طريق */}
          <div className="space-y-3">
            <button
              onClick={() => socialLogin("قوقل")}
              className="flex h-12 w-full items-center justify-center gap-3 rounded-2xl bg-white text-sm font-black text-[#1F1F1F] transition hover:bg-white/90"
            >
              <GoogleMark />
              المتابعة بحساب قوقل
            </button>
            <button
              onClick={() => socialLogin("لينكدإن")}
              className="flex h-12 w-full items-center justify-center gap-3 rounded-2xl bg-[#0A66C2] text-sm font-black text-white transition hover:bg-[#0A66C2]/90"
            >
              <Linkedin className="h-5 w-5" />
              المتابعة بحساب لينكدإن
            </button>
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-white/40">
              <ShieldCheck className="h-3.5 w-3.5 text-[#38A7B4]" />
              لن ننشر شيئا باسمك أبدا — حسابك لحفظ مسارك ونتيجتك فقط
            </p>
          </div>

          <div className="my-5 flex items-center gap-3 text-xs text-white/35">
            <span className="h-px flex-1 bg-white/10" />
            أو بالبريد الإلكتروني
            <span className="h-px flex-1 bg-white/10" />
          </div>

          {/* النموذج */}
          <div className="space-y-3">
            {mode === "signup" && (
              <div className="relative">
                <UserRound className="absolute right-3.5 top-3.5 h-4 w-4 text-white/35" />
                {name.trim().length >= 2 && (
                  <Check className="absolute left-3.5 top-3.5 h-4 w-4 text-[#34A853]" />
                )}
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="اسمك الكريم"
                  autoComplete="name"
                  className="h-12 w-full rounded-2xl border border-white/15 bg-white/[0.04] pr-11 pl-11 text-sm text-white placeholder:text-white/30 focus:border-[#38A7B4] focus:outline-none"
                />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute right-3.5 top-3.5 h-4 w-4 text-white/35" />
              {emailValid && <Check className="absolute left-3.5 top-3.5 h-4 w-4 text-[#34A853]" />}
              <input
                dir="ltr"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@mail.com"
                autoComplete="email"
                className="h-12 w-full rounded-2xl border border-white/15 bg-white/[0.04] pr-11 pl-11 text-left text-sm text-white placeholder:text-white/30 focus:border-[#38A7B4] focus:outline-none"
              />
            </div>
            <div className="relative">
              <Lock className="absolute right-3.5 top-3.5 h-4 w-4 text-white/35" />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                aria-label={showPass ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                className="absolute left-3.5 top-3.5 text-white/35 transition hover:text-white/70"
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <input
                dir="ltr"
                type={showPass ? "text" : "password"}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="كلمة المرور — ٨ أحرف فأكثر"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                className="h-12 w-full rounded-2xl border border-white/15 bg-white/[0.04] pr-11 pl-11 text-left text-sm text-white placeholder:text-white/30 focus:border-[#38A7B4] focus:outline-none"
              />
            </div>

            {/* مؤشر القوة أثناء الكتابة */}
            {mode === "signup" && pass.length > 0 && (
              <div>
                <div className="flex gap-1.5" dir="ltr">
                  {[1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className="h-1 flex-1 rounded-full transition-colors duration-300"
                      style={{
                        backgroundColor:
                          i <= strength ? STRENGTH_META[strength].color : "rgba(255,255,255,0.1)",
                      }}
                    />
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] font-semibold" style={{ color: STRENGTH_META[strength].color }}>
                  كلمة مرور {STRENGTH_META[strength].label}
                  {strength < 3 && " — أضف رقما أو رمزا (! @ #) لتقويتها"}
                </p>
              </div>
            )}

            {mode === "login" && (
              <p className="text-left">
                <Link to="/p/contact" className="text-xs text-white/45 transition hover:text-[#6EC7D1]">
                  نسيت كلمة المرور؟ راسلنا وسنساعدك
                </Link>
              </p>
            )}

            {err && (
              <p className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-center text-xs font-semibold leading-relaxed text-red-300">
                {err}
              </p>
            )}

            <button
              onClick={submit}
              disabled={!formValid}
              className="h-12 w-full rounded-2xl bg-[#FABC05] text-sm font-black text-[#0D0D0D] transition hover:bg-[#FABC05]/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {mode === "signup" ? "أنشئ حسابي وابدأ" : "ادخل إلى حسابي"}
            </button>
          </div>

          <p className="mt-5 text-center text-[11px] leading-relaxed text-white/35">
            بالمتابعة أنت توافق على{" "}
            <Link to="/p/terms" className="text-white/55 underline underline-offset-4 hover:text-[#6EC7D1]">
              شروط الاستخدام
            </Link>{" "}
            و
            <Link to="/p/privacy" className="text-white/55 underline underline-offset-4 hover:text-[#6EC7D1]">
              سياسة الخصوصية
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
