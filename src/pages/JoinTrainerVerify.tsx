import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { CheckCircle2, Loader2, MailWarning } from "lucide-react";
import SiteShell from "@/components/SiteShell";
import SeoHead from "@/components/SeoHead";
import { apiPost, ApiError } from "@/services/api";

/* رابطُ بريد التأكيد يفتح هنا.

   البريدُ الذي يصل المتقدّمَ بعد إكمال طلبه يحمل تفاصيلَه ورقمَه — ويحمل
   هذا الرابط: نقرةٌ واحدة تثبت أنّ العنوانَ لصاحبه. ولا يغيّر الرابطُ مسارَ
   الطلب: هو مقدَّمٌ منذ الإكمال، والتوثيقُ يزيده صدقا عند المراجع لا غير. */

type State =
  | { kind: "working" }
  | { kind: "done"; alreadyVerified: boolean }
  | { kind: "error"; message: string };

export default function JoinTrainerVerify() {
  const [params] = useSearchParams();
  const reference = params.get("ref") ?? "";
  const token = params.get("token") ?? "";
  const linkOk = reference.length >= 5 && token.length >= 10;
  /* رابطٌ ناقص يُعرف قبل أيّ نداء — فهو حالةُ البداية لا أثرٌ يُكتب لاحقا */
  const [state, setState] = useState<State>(() =>
    linkOk ? { kind: "working" } : { kind: "error", message: "الرابط ناقص — افتحه كاملا من رسالة البريد." });

  useEffect(() => {
    if (!linkOk) return;
    let alive = true;
    void (async () => {
      try {
        const res = await apiPost<{ alreadyVerified: boolean }>("/api/v1/trainer-applications/verify-email", { reference, token });
        if (alive) setState({ kind: "done", alreadyVerified: res.alreadyVerified });
      } catch (err) {
        if (alive) setState({ kind: "error", message: err instanceof ApiError ? err.message : "تعذّر التوثيق — حاول مجددا" });
      }
    })();
    return () => { alive = false; };
  }, [reference, token, linkOk]);

  return (
    <SiteShell>
      <SeoHead title="توثيق بريد طلب الانضمام" description="توثيق بريد المتقدّم للتدريب" path="/join-trainer/verify" noindex />
      <div className="mx-auto max-w-lg px-5 py-16 text-center">
        {state.kind === "working" && (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-teal-light-ink" />
            <p className="mt-5 text-sm text-white/55">يُوثَّق بريدك…</p>
          </>
        )}

        {state.kind === "done" && (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
            <h1 className="mt-5 text-2xl font-black">
              {state.alreadyVerified ? "بريدك موثَّق من قبل" : "وُثِّق بريدك"}
            </h1>
            <p className="mt-3 text-sm leading-7 text-white/55">
              طلبك <b className="font-mono text-white/80" dir="ltr">{reference}</b> عند فريق المراجعة، وسنتواصل معك على
              الوسيلة التي اختَرتها لعقد الاجتماع التعريفي.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/auth" className="rounded-full bg-teal px-6 py-3 font-black text-on-teal hover:bg-teal-light">
                سجّل الدخول لمتابعة طلبك
              </Link>
              <Link to="/" className="rounded-full border border-white/15 px-6 py-3 font-bold text-white/80 hover:border-white/40">
                الرئيسية
              </Link>
            </div>
          </>
        )}

        {state.kind === "error" && (
          <>
            <MailWarning className="mx-auto h-12 w-12 text-[#FABC05]" />
            <h1 className="mt-5 text-2xl font-black">تعذّر توثيق البريد</h1>
            <p className="mt-3 text-sm leading-7 text-white/60">{state.message}</p>
            <p className="mt-3 text-xs leading-6 text-white/40">
              الروابط تنتهي بعد سبعة أيام. اطلب رسالة جديدة من صفحة الانضمام بإدخال بريدك في «تابع حالة طلبك».
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/join-trainer" className="rounded-full bg-teal px-6 py-3 font-black text-on-teal hover:bg-teal-light">
                صفحة الانضمام
              </Link>
              <Link to="/auth" className="rounded-full border border-white/15 px-6 py-3 font-bold text-white/80 hover:border-white/40">
                تسجيل الدخول
              </Link>
            </div>
          </>
        )}
      </div>
    </SiteShell>
  );
}
