/* بوابة النتيجة النصفية — ما يراه الضيف بعد إكمال التشخيص:
   ملخص مجاني من خمسة عناصر يثبت أن التشخيص يعمل، ثم جدار تسجيل
   فوق هيكل زخرفي مضبّب (skeleton بلا أي نص حقيقي).
   قاعدة حاسمة: النتيجة الكاملة لا تُركَّب في DOM أصلا قبل التسجيل —
   الضباب هنا فوق مستطيلات رمادية زخرفية، لا فوق محتوى مخفي. */

import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { CheckCircle2, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { signIn, signUp } from "@/services/auth";
import { track } from "@/services/analytics";

interface ResultGateProps {
  composite: boolean;
  name: string;
  reasonLine: string;
  confidencePct: number; // 0–100
  durationLabel: string; // «١٢ أسبوعا» أو «٤٠ ساعة» للخطط المركبة
  durationKind: "weeks" | "hours";
  coursesCount: number;
  answeredCount: number | null;
  onDone: () => void;
}

/* نسخة تجريبية من حروف عربية للأرقام — تُعرض كما يتوقعها المستخدم */
const arNum = (n: number) => n.toLocaleString("ar-EG", { maximumFractionDigits: 0 });

export default function ResultGate({
  composite,
  name,
  reasonLine,
  confidencePct,
  durationLabel,
  durationKind,
  coursesCount,
  answeredCount,
  onDone,
}: ResultGateProps) {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pass.length < 8) {
      setError("كلمة المرور ٨ أحرف على الأقل");
      return;
    }
    setBusy(true);
    setError("");
    /* الاسم يُشتق من البريد — «بريدك فقط» وعد نلتزمه حرفيا، ويعدّله لاحقا من ملفه */
    const name = email.split("@")[0]?.trim() || "متعلم وجيز";
    const res = mode === "signup" ? await signUp(name, email, pass) : await signIn(email, pass);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (mode === "signup") track("account_created", { via: "result_gate" });
    onDone();
  };

  const inputCls =
    "w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:border-[#FABC05] focus:outline-none";

  return (
    <div>
      {/* ─── الملخص المجاني: خمسة عناصر ولا شيء غيرها ─── */}
      <div className="text-center">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge className="border border-[#38A7B4]/40 bg-[#38A7B4]/10 text-[#6EC7D1]">
            اكتمل التشخيص{answeredCount ? ` — أجبت على ${arNum(answeredCount)} سؤالا` : ""}
          </Badge>
          <Badge className={`font-black ${composite ? "bg-[#FABC05] text-[#0D0D0D]" : "bg-[#38A7B4] text-[#08272B]"}`}>
            {composite ? "خطة مركبة مخصصة" : "مسارك المقترح"}
          </Badge>
        </div>
        <h2 className="mt-5 text-3xl font-black leading-snug md:text-4xl">{name}</h2>
        <p className="mx-auto mt-4 max-w-xl leading-loose text-white/70">{reasonLine}</p>
        <dl className="mx-auto mt-8 grid max-w-lg grid-cols-3 gap-3">
          {[
            { label: "مستوى الثقة", value: `${arNum(confidencePct)}٪` },
            { label: durationKind === "weeks" ? "مدة المسار" : "حجم الخطة", value: durationLabel },
            { label: "عدد الدورات", value: arNum(coursesCount) },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-4">
              <dt className="text-[11px] font-bold text-white/55">{s.label}</dt>
              <dd className="mt-1.5 text-xl font-black text-[#6EC7D1]">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* ─── الجدار: تلاشٍ ثم هيكل زخرفي مضبّب تحمله بطاقة التسجيل ─── */}
      <div className="print:hidden">
        <div aria-hidden="true" className="h-[120px] bg-gradient-to-b from-transparent to-[#0D0D0D]" />
        <div className="relative">
          {/* الهيكل الزخرفي: مستطيلات رمادية بلا نص — لا يقرؤه قارئ الشاشة ولا يصله Tab */}
          <div aria-hidden="true" inert className="pointer-events-none absolute inset-0 select-none overflow-hidden">
            <div className="absolute inset-0 opacity-50 blur-[8px]">
              <div className="mx-auto max-w-2xl space-y-4 px-6 pt-8">
                <div className="h-28 rounded-3xl bg-white/[0.07]" />
                <div className="grid grid-cols-3 gap-3">
                  <div className="h-16 rounded-2xl bg-white/[0.06]" />
                  <div className="h-16 rounded-2xl bg-white/[0.06]" />
                  <div className="h-16 rounded-2xl bg-white/[0.06]" />
                </div>
                <div className="h-44 rounded-3xl bg-white/[0.05]" />
                <div className="h-3 w-2/3 rounded-full bg-white/[0.06]" />
                <div className="h-3 w-1/2 rounded-full bg-white/[0.06]" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-20 rounded-2xl bg-white/[0.05]" />
                  <div className="h-20 rounded-2xl bg-white/[0.05]" />
                </div>
              </div>
            </div>
          </div>

          {/* بطاقة التسجيل — أول ما يصله Tab بعد الملخص المجاني */}
          <div className="relative z-10 mx-auto max-w-md px-4 py-6 md:py-10">
            <div className="rounded-3xl border border-[#FABC05]/40 bg-[#0D0D0D]/90 p-6 shadow-2xl shadow-black/60 backdrop-blur md:p-8">
              <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-[#FABC05]/15">
                <Lock className="h-5 w-5 text-[#FABC05]" />
              </span>
              <h3 className="mt-4 text-center text-xl font-black leading-snug">
                سجّل حسابك المجاني لترى نتيجتك كاملة
                <span className="mt-1 block text-base font-bold text-white/80">
                  وتخصّص مسارك بيدك، دورة بدورة.
                </span>
              </h3>

              <p className="mt-5 text-sm font-black text-[#FABC05]">ما يفتحه لك الحساب:</p>
              <ul className="mt-2.5 space-y-2">
                {[
                  "التفسير الكامل لتوصيتك وقوة أدلتها",
                  "البدائل المناسبة — ولماذا لم تُرشَّح لك",
                  "خطة الدورات دورة بدورة، تعدّلها كما تشاء",
                  "حفظ نتيجتك والعودة إليها من أي جهاز",
                  "اعتماد مسارك ومتابعة تقدمك",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm leading-relaxed text-white/80">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#6EC7D1]" />
                    {f}
                  </li>
                ))}
              </ul>

              <form onSubmit={submit} className="mt-6 space-y-3">
                <label className="sr-only" htmlFor="gate-email">بريدك الإلكتروني</label>
                <input
                  id="gate-email"
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  placeholder="بريدك الإلكتروني"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                />
                <label className="sr-only" htmlFor="gate-pass">كلمة المرور</label>
                <input
                  id="gate-pass"
                  type="password"
                  required
                  minLength={8}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  placeholder="كلمة المرور (٨ أحرف فأكثر)"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  className={inputCls}
                />
                {error && (
                  <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-xs font-bold leading-relaxed text-red-200">
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={busy}
                  className="h-12 w-full rounded-full bg-[#FABC05] text-base font-black text-[#0D0D0D] hover:bg-[#FABC05]/90 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : mode === "signup" ? "أنشئ حسابي المجاني" : "دخول"}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === "signup" ? "login" : "signup");
                    setError("");
                  }}
                  className="h-11 w-full rounded-full border border-white/20 text-sm font-bold text-white/75 transition hover:border-[#6EC7D1]/60 hover:text-white"
                >
                  {mode === "signup" ? "لدي حساب — دخول" : "حساب جديد — إنشاء مجاني"}
                </button>
                {mode === "login" && (
                  <p className="text-center">
                    <Link to="/auth" className="text-xs font-semibold text-white/60 underline-offset-4 hover:text-[#6EC7D1] hover:underline">
                      نسيت كلمة المرور؟
                    </Link>
                  </p>
                )}
              </form>

              <p className="mt-4 text-center text-xs leading-relaxed text-white/70">
                ثانية واحدة — بريدك فقط. ولن يصلك شيء لم تطلبه.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
