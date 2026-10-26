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
import { readPendingCheckout } from "@/services/pending-checkout";
import { resumeHref } from "@/application/commerce/pending-checkout";

type State = { kind: "working" } | { kind: "done"; message: string } | { kind: "error"; message: string };

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [sent, setSent] = useState<State | null>(null);
  /* الحارس يمنع النداء مرتين تحت StrictMode — والرمز يُستهلك من أول نداء،
     فالثاني كان يردّ «غير صالح» على توثيق نجح للتوّ. */
  const fired = useRef(false);
  /* ═══ والشراءُ الذي تركه ليوثّق بريده (٢٠ أكتوبر ٢٠٢٦، الخطوة ل) ═══
     كان الزرُّ الوحيد «إلى منصّتي» — فيضيع ما اختاره في صفحة الدورة، ويعود يختاره. والمحفوظُ على هذا
     الجهاز يُقرأ مرّةً (`pending-checkout.ts`)، ومن فتح الرابطَ على جهازٍ آخر يرى الزرَّين كما كانا. */
  const [pending] = useState(() => readPendingCheckout());

  useEffect(() => {
    if (fired.current || !token) return;
    fired.current = true;
    apiPost<{ message: string }>("/api/auth/email/verify", { token })
      .then((r) => setSent({ kind: "done", message: r.message }))
      .catch((e) => setSent({ kind: "error", message: permissionMessage(e, "تعذّر توثيق البريد الآن.") }));
  }, [token]);

  /* غياب الرمز يُعرف أثناء التصيير — لا حاجة إلى تأثير يقلب الحالة بعده */
  const state: State = !token
    ? { kind: "error", message: "الرابط ناقص — افتحه من الرسالة كما وصلتك." }
    : sent ?? { kind: "working" };

  return (
    <SiteShell>
      <SeoHead title="توثيق البريد" description="توثيق بريد حسابك في أكاديمية وجيز." path="/auth/verify" noindex />
      <div className="mx-auto max-w-lg px-5 py-16 text-center">
        {state.kind === "working" && (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-teal-light-ink" />
            <p className="mt-5 text-sm text-muted-foreground">يوثّق بريدك…</p>
          </>
        )}

        {state.kind === "done" && (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
            <h1 className="mt-5 text-2xl font-black">{state.message}</h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              لم يتغيّر شيء آخر في حسابك. التوثيق شرط لاستلام الشهادة فقط.
            </p>
            {/* ومن ترك شراءً ليوثّق بريده يعود إليه أوّلا — بشعبه كما اختارها (الخطوة ل) */}
            {pending && (
              <p className="mt-3 text-sm leading-7 text-foreground">
                ما زال طلبك ينتظرك: <span className="font-bold">{pending.intent.title}</span>
              </p>
            )}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {pending ? (
                <>
                  <Link to={resumeHref(pending)} className="rounded-full bg-gold px-6 py-3 font-black text-on-gold hover:bg-gold/90">
                    أكمل شراءك
                  </Link>
                  <Link to={homePathForRoles(readRoles())} className="rounded-full border border-white/15 px-6 py-3 font-bold text-muted-foreground hover:border-white/40">
                    إلى منصّتي
                  </Link>
                </>
              ) : (
                <>
                  <Link to={homePathForRoles(readRoles())} className="rounded-full bg-teal px-6 py-3 font-black text-on-teal hover:bg-teal-light">
                    إلى منصّتي
                  </Link>
                  <Link to="/courses" className="rounded-full border border-white/15 px-6 py-3 font-bold text-muted-foreground hover:border-white/40">
                    تصفّح الدورات
                  </Link>
                </>
              )}
            </div>
          </>
        )}

        {state.kind === "error" && (
          <>
            <MailWarning className="mx-auto h-12 w-12 text-[#FABC05]" />
            <h1 className="mt-5 text-2xl font-black">تعذّر توثيق البريد</h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">{state.message}</p>
            <p className="mt-3 text-read leading-6 text-muted-foreground">
              الرابط صالح ٤٨ ساعة ولمرة واحدة فقط. اطلب رابطا جديدا من صفحة حسابك.
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
