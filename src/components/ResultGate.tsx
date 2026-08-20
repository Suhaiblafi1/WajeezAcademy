/* بوابة النتيجة — التصميم المعتمد «حدّ الظهور وبطاقة التسجيل»:
   الصفحة الأم تعرض مقروءا كل شيء حتى نهاية بطاقة «ماذا ستحصل عليه فعليا؟»،
   وكل ما بعد الحدّ يُغلَّف بهذا المكوّن: المحتوى الحقيقي يبقى في مكانه ويُغطّى
   بضباب blur(8px) + opacity .4 بلا أي نص شارح خلفه — الضباب بلا معالم،
   والمستخدم يعرف ما ينتظره من بطاقة التسجيل لا من خلفها.
   بطاقة التسجيل تطفو موسّطة فوق الضباب وتلتصق أثناء التمرير داخل المنطقة
   المضبّبة، وهي المكان الوحيد الذي يُكتب فيه ما ينتظر المستخدم.
   بعد التسجيل: الضباب يزول blur(8px)→blur(0) على ٤٠٠ms، والبطاقة تتلاشى على
   ٣٠٠ms — نفس الصفحة، بلا انتقال ولا إعادة تحميل ولا قفزة تخطيط، وموضع
   التمرير كما هو. المحتوى المضبّب aria-hidden + inert، وقبل التسجيل لا يُطبع. */

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signIn, signUp } from "@/services/auth";
import { track } from "@/services/analytics";

interface ResultGateProps {
  revealed: boolean; // موثق أو انكشف للتو — الضباب يزول والبطاقة تتلاشى
  onDone: () => void;
  children: ReactNode; // كل محتوى النتيجة الواقع بعد حدّ الظهور
}

/* البنود الستة داخل بطاقة التسجيل — وهي كل ما يُكتب عمّا ينتظر المستخدم */
const UNLOCKS: { lead: string; rest: string }[] = [
  { lead: "ماذا ستحقق فعليا", rest: "من أين تبدأ وإلى أين تصل، ومشروعك الختامي ومقياس نجاحه" },
  { lead: "تفاصيل دوراتك", rest: "ترتيبها وساعاتها ومخرَج كل دورة" },
  { lead: "من سيرافقك", rest: "مدربك ومواصفته المهنية" },
  { lead: "🎁 هدية وجيز", rest: "اختر دورة إضافية مجانية تُضاف لمسارك، نقترح عليك الأقرب لهدفك" },
  { lead: "لماذا هذا المسار", rest: "كيف بُنيت التوصية، والبدائل ولماذا لم تُرشَّح لك" },
  { lead: "تخصيص مسارك بيدك", rest: "عدّله، واحفظه، وعُد إليه من أي جهاز" },
];

export default function ResultGate({ revealed, onDone, children }: ResultGateProps) {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  /* البطاقة تتلاشى ٣٠٠ms ثم تُرفع من الشجرة فلا تحجب شيئا مما انكشف تحتها */
  const [cardGone, setCardGone] = useState(false);

  useEffect(() => {
    if (!revealed) return;
    const t = window.setTimeout(() => setCardGone(true), 320);
    return () => window.clearTimeout(t);
  }, [revealed]);

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
    <div className="relative">
      {/* بطاقة التسجيل — موسّطة فوق المنطقة المضبّبة، تلتصق أثناء التمرير داخلها
          فلا يمرّ المستخدم بضباب بلا دعوة. نصها كله مقروء بتباين كامل — لا ضباب عليها إطلاقا */}
      {!cardGone && (
        <div className="sticky top-20 z-10 h-0 overflow-visible print:hidden md:top-24">
          <div className="px-4">
            <div
              className={`mx-auto max-h-[calc(100dvh-6rem)] max-w-md overflow-y-auto rounded-3xl border border-[#FABC05]/50 bg-[#0D0D0D]/95 p-6 shadow-2xl shadow-black/70 backdrop-blur-md motion-safe:transition-opacity motion-safe:duration-300 ${
                revealed ? "pointer-events-none opacity-0" : ""
              }`}
            >
              <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-[#FABC05]/15">
                <Lock className="h-5 w-5 text-[#FABC05]" />
              </span>
              <h3 className="mt-4 text-center text-xl font-black leading-snug text-white">
                سجّل الآن لتعرف المزيد
              </h3>
              <p className="mt-2 text-center text-sm leading-relaxed text-white/75">
                نتيجتك جاهزة — والتسجيل يكشف بقيتها في نفس الصفحة.
              </p>

              <p className="mt-5 text-sm font-black text-[#FABC05]">سيُفتح لك فورا:</p>
              <ul className="mt-2.5 space-y-2.5">
                {UNLOCKS.map((u) => (
                  <li key={u.lead} className="flex items-start gap-2.5 text-sm leading-relaxed">
                    <span aria-hidden="true" className="mt-1 shrink-0 text-[10px] text-[#FABC05]">◆</span>
                    <span className="text-white/75">
                      <span className="font-bold text-white">{u.lead}</span>
                      {" — "}
                      {u.rest}
                    </span>
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
      )}

      {/* كل ما بعد حدّ الظهور — محتوى حقيقي في مكانه، يغطّيه قبل التسجيل ضباب
          بلا معالم: لا يقرؤه قارئ الشاشة ولا يصله Tab ولا يُطبع ولا يُحدد */}
      <div
        aria-hidden={revealed ? undefined : true}
        inert={revealed ? undefined : true}
        className={
          revealed
            ? "opacity-100 blur-[0px] motion-safe:transition-[filter,opacity] motion-safe:duration-[400ms]"
            : "pointer-events-none select-none opacity-40 blur-[8px] print:hidden"
        }
      >
        {children}
      </div>
    </div>
  );
}
