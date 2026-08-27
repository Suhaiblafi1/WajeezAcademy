/* بوابة النتيجة — التصميم المعتمد «حدّ الظهور وبطاقة التسجيل»:
   الصفحة الأم تعرض مقروءا كل شيء حتى نهاية بطاقة «ماذا ستحصل عليه فعليا؟»،
   وكل ما بعد الحدّ يُغلَّف بهذا المكوّن: المحتوى الحقيقي يبقى في مكانه ويُغطّى
   بضباب blur(8px) + opacity .4 بلا أي نص شارح خلفه — الضباب بلا معالم،
   والمستخدم يعرف ما ينتظره من لافتة التسجيل لا من خلفها.
   اللافتة ونموذج التسجيل في التدفق الطبيعي أعلى المنطقة المضبّبة — ينزلان مع
   الصفحة أثناء التمرير ولا يلتصقان بالشاشة، والنموذج بلا شريط تمرير داخلي.
   النموذج هو بوابة الدخول/التسجيل الرسمية (AuthGate — نفس بوابة /auth بحقولها
   وتحققها واستعادة كلمة المرور كاملة) بعد أن كانت نموذجا مختصرا خاصا.
   بعد التسجيل: الضباب يزول blur(8px)→blur(0) على ٤٠٠ms، واللافتة تنطوي
   (ارتفاعها وشفافيتها إلى صفر على ٥٠٠ms) فلا قفزة تخطيط — نفس الصفحة،
   بلا انتقال ولا إعادة تحميل. المحتوى المضبّب aria-hidden + inert،
   وقبل التسجيل لا يُطبع. */

import { useEffect, useState, type ReactNode } from "react";
import { BookOpen, Gift, Lock, SlidersHorizontal, Sparkles, Target, UserCheck } from "lucide-react";
import AuthGate from "@/components/AuthGate";

interface ResultGateProps {
  revealed: boolean; // موثق أو انكشف للتو — الضباب يزول واللافتة تتلاشى
  onDone: () => void;
  children: ReactNode; // كل محتوى النتيجة الواقع بعد حدّ الظهور
}

/* البنود الستة داخل لافتة التسجيل — الوعود نفسها بأقصر صياغة، أيقونة وسطر واحد */
/* البنود الستة تتبع حدّ الظهور — لا تسبقه.
   حين انتقل الحدّ إلى ما بعد الخطة وتحذير التقاطع، صار «تفاصيل دوراتك» و«لماذا
   هذا المسار» مقروءَين قبل التسجيل، فالوعد بهما وعدٌ بما في اليد أصلا — وهو
   أسوأ من ألّا يُوعد به. وما بقي خلف الحدّ فعلا هو ما يُذكر. */
const UNLOCKS: { icon: typeof Target; label: string }[] = [
  { icon: Target, label: "اعتماد خطتك والبدء" },
  { icon: SlidersHorizontal, label: "تخصيصها وحفظها" },
  { icon: UserCheck, label: "من سيرافقك" },
  { icon: Gift, label: "هدية مجانية تختارها" },
  { icon: BookOpen, label: "خريطة فجواتك مهارة بمهارة" },
  { icon: Sparkles, label: "البدائل الأسرع والأوفر" },
];

export default function ResultGate({ revealed, onDone, children }: ResultGateProps) {
  /* اللافتة تنطوي على ٥٠٠ms ثم تُرفع من الشجرة فلا تحجب شيئا مما انكشف تحتها */
  const [cardGone, setCardGone] = useState(false);

  useEffect(() => {
    if (!revealed) return;
    const t = window.setTimeout(() => setCardGone(true), 520);
    return () => window.clearTimeout(t);
  }, [revealed]);

  return (
    <div className="relative">
      {/* لافتة التسجيل ونموذجها — في التدفق الطبيعي أعلى المنطقة المضبّبة،
          ينزلان مع الصفحة أثناء التمرير (لا التصاق ولا تمرير داخلي).
          بعد التسجيل تنطوي الرقعة تدريجيا (max-height + opacity) فلا قفزة تخطيط */}
      {!cardGone && (
        <div
          className={`relative z-10 overflow-hidden print:hidden motion-safe:transition-[max-height,opacity] motion-safe:duration-500 ${
            revealed ? "pointer-events-none max-h-0 opacity-0" : "max-h-[2200px] opacity-100"
          }`}
        >
          <div className="mx-auto max-w-md px-4 pb-8 pt-10">
            {/* لافتة «ما ينتظرك» — العنوان والبنود الستة المعتمدة، تسبق النموذج الرسمي */}
            <div className="relative overflow-hidden rounded-3xl border border-[#FABC05]/35 bg-surface/95 p-5 shadow-[0_24px_70px_-18px_rgba(0,0,0,0.85)] ring-1 ring-white/5 backdrop-blur-xl">
              {/* توهج علوي خفيف بلون العلامة — لمسة عمق بلا تشويش */}
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-gold/[0.08] to-transparent" />

              <div className="relative flex items-center justify-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-gold/15">
                  <Lock className="h-3.5 w-3.5 text-gold-ink" />
                </span>
                <h3 className="text-lg font-black leading-snug text-white">
                  سجّل الآن لتعرف المزيد
                </h3>
              </div>
              <p className="relative mt-1.5 text-center text-xs leading-relaxed text-white/65">
                خطتك أمامك كاملة — والحساب يفتح اعتمادها وتخصيصها وحفظها.
              </p>

              <ul className="relative mt-4 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-white/[0.07] pt-3.5">
                {UNLOCKS.map((u) => (
                  <li key={u.label} className="flex items-center gap-1.5 text-xs font-bold text-white/80">
                    <u.icon className="h-3.5 w-3.5 shrink-0 text-teal-light-ink" />
                    {u.label}
                  </li>
                ))}
              </ul>
            </div>

            {/* نموذج الدخول والتسجيل الرسمي — نفس بوابة /auth بكل حقولها:
                اسم وبريد وكلمة مرور بمؤشر قوة وتأكيد وموافقة واستعادة كلمة مرور.
                يبدأ بوضع «حساب جديد» لأن اللافتة دعوة تسجيل، ويُوسَّم مصدره للتحليلات */}
            <div className="mt-4">
              <AuthGate onDone={onDone} initialMode="signup" source="result_gate" />
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
