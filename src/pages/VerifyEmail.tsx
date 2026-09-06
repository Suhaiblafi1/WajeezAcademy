/* توثيق البريد (١هـ) — الصفحة التي يفتحها رابط الرسالة.

   لا تطلب من الزائر شيئا: الرمز في العنوان، فتُنفَّذ الخطوة فور الفتح وتُقال
   نتيجتها. وحين يفشل الرمز تقول لماذا وتعطي الطريق التالي — «رابط غير صالح»
   وحدها تترك الواقف واقفا. */

import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { CheckCircle2, MailWarning, Loader2 } from "lucide-react";
import SiteShell from "@/components/SiteShell";
import SeoHead from "@/components/SeoHead";
import { apiPost, permissionMessage } from "@/services/api";
import { homePathForRoles, readRoles } from "@/services/auth";

type State = { kind: "working" } | { kind: "done"; message: string } | { kind: "error"; message: string };

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [sent, setSent] = useState<State | null>(null);
  /* الحارس يمنع النداء مرتين تحت StrictMode — والرمز يُستهلك من أول نداء،
     فالثاني كان يردّ «غير صالح» على توثيق نجح للتوّ. */
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current || !token) return;
    fired.current = true;
    apiPost<{ message: string }>("/api/auth/email/verify", { token })
      .then((r) => setSent({ kind: "done", message: r.message }))
      .catch((e) => setSent({ kind: "error", message: permissionMessage(e, "تعذّر توثيق البريد الآن.") }));
  }, [token]);

  /* غياب الرمز يُعرف أثناء التصيير — لا حاجة إلى تأثير يقلب الحالة بعده */
  const state: State = !token
    ? { kind: "error", message: "الرابط بلا رمز — افتحه من الرسالة كما وصلتك." }
    : sent ?? { kind: "working" };

  return (
    <SiteShell>
      <SeoHead title="توثيق البريد" description="توثيق بريد حسابك في أكاديمية وجيز." path="/auth/verify" noindex />
      <div className="mx-auto max-w-lg px-5 py-16 text-center">
        {state.kind === "working" && (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-teal-light-ink" />
            <p className="mt-5 text-sm text-muted-foreground">يُوثَّق بريدك…</p>
          </>
        )}

        {state.kind === "done" && (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
            <h1 className="mt-5 text-2xl font-black">{state.message}</h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              لم يتغيّر شيء آخر في حسابك — التوثيق يفتح الشراء واستلام الشهادة فقط.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to={homePathForRoles(readRoles())} className="rounded-full bg-teal px-6 py-3 font-black text-on-teal hover:bg-teal-light">
                إلى منصّتي
              </Link>
              <Link to="/courses" className="rounded-full border border-white/15 px-6 py-3 font-bold text-muted-foreground hover:border-white/40">
                تصفّح الدورات
              </Link>
            </div>
          </>
        )}

        {state.kind === "error" && (
          <>
            <MailWarning className="mx-auto h-12 w-12 text-[#FABC05]" />
            <h1 className="mt-5 text-2xl font-black">تعذّر توثيق البريد</h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">{state.message}</p>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              الروابط تنتهي بعد ٤٨ ساعة، وتُستهلك بعد أوّل فتح. اطلب رابطا جديدا من صفحة حسابك.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/student/account" className="rounded-full bg-teal px-6 py-3 font-black text-on-teal hover:bg-teal-light">
                اطلب رابطا جديدا
              </Link>
              <Link to="/auth" className="rounded-full border border-white/15 px-6 py-3 font-bold text-muted-foreground hover:border-white/40">
                تسجيل الدخول
              </Link>
            </div>
          </>
        )}
      </div>
    </SiteShell>
  );
}
